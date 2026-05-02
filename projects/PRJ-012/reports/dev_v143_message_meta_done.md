# PRJ-012 v1.43.0 (DEC-083) 実装完了レポート — Message Meta (model + effort + 送信時刻)

- 案件: PRJ-012 (sumi - Claude Code マルチプロジェクト IDE)
- 担当: 開発部門 (`/dev`、シニアエンジニア)
- 実装版: v1.42.0 → **v1.43.0**
- DEC: **DEC-083** 候補
- 着手: 2026-04-30
- 種別: 実装完了レポート (実装範囲・diff 要点・動作確認結果・残課題)
- 実装計画書: `projects/PRJ-012/reports/dev_message_model_effort_proposal.md` § 案 C ハイブリッド

---

## 0. TL;DR

- 計画書 § 5 Phase 1 の **全項目を実装完了**。実装規模 M (2〜2.5d 想定) を 1 セッションで完了。
- 「送信した user message bubble に **実 Claude が使った model** + UI で選んだ effort + 送信時刻」を表示する meta 行を新設。SDK の `system:init` event から実 model を back-fill し、UI 値との乖離を警告 icon + tooltip で可視化。
- DB に `messages.meta_json TEXT NULL` 列を 1 列追加 (idempotent ALTER)。既存 message は何も表示しない defensive fallback。
- 全品質確認 PASS:
  - typecheck PASS
  - lint 新規警告 0 (既存 warning のみ)
  - vitest 102 → **123 ケース PASS** (新規 21)
  - cargo check PASS、cargo test 177 → **182 ケース PASS** (新規 5)
- 触ったファイル: **frontend 9 / Rust 2 / version 3 / CHANGELOG / 新規 3 / E2E 2 = 計 17 ファイル**
- 絶対 commit / push しない (CEO 一括反映ルール遵守済)。

---

## 1. ChatMessage.meta の型定義と persist 経路

### 1.1 型 (`lib/stores/chat.ts:65-89`)

```ts
export interface MessageMeta {
  uiModel: ModelId | null;       // Sumi UI で選んだ値 (送信直後 attach、案 A)
  uiEffort: EffortLevel | null;  // 同上 (SDK 応答に effort なしの限界対応)
  sdkModel?: string;             // SDK system:init.model 由来 (back-fill、案 B)
  sentAt: number;                // epoch ms (送信時刻、UI で時刻表示)
  mismatch?: boolean;            // family レベルで uiModel ≠ sdkModel なら true
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  streaming?: boolean;
  attachments?: Attachment[];
  toolUse?: ToolUseEvent;
  meta?: MessageMeta;            // v1.43.0 追加
}
```

### 1.2 persist 経路

```
[送信時 attach (案 A)]
InputArea.handleSend
  └─ resolveSessionPreferences で uiModel/uiEffort 解決
      └─ chat.appendMessage(sid, { id: "<reqId>:u", meta: { uiModel, uiEffort, sentAt: Date.now() } })
            └─ persistMessageToDb (内部) — JSON.stringify(meta) を append_message の metaJson 引数に
                  └─ Rust append_message — INSERT messages (..., meta_json)
                        ←── 戻り値 { id: <DB row UUID> } を frontend が
                            dbRowIdByMessageId.set(<reqId>:u, <DB UUID>) でマップ保持

[back-fill (案 B)]
sidecar agent:<sid>:raw event
  └─ useAllProjectsSidecarListener.applyEventToSession
      └─ ev.type === "system" && payload.subtype === "init"
          └─ sdkInitProcessedReqIds で reqId 単位 1 回 guard
              └─ chat.updateMessageMeta(sid, "<reqId>:u", { sdkModel, mismatch })
                    └─ state を partial merge
                    └─ persistMessageMetaToDb — dbRowIdByMessageId 経由で
                          DB row UUID を引いて update_message_meta(messageId, metaJson) を発行

[DB load 経路]
session.loadSession
  └─ get_session_messages → StoredMessage[]
      └─ toChatMessage で metaJson を JSON.parse、parse 失敗は undefined fallback
            └─ chat.hydrateSessionMessages — dbRowIdByMessageId にも自己 id を登録
                (DB 復元では message.id === DB row id なので同値)
```

### 1.3 frontend message id ↔ DB row id の対応マップ

問題: `appendMessage` 直後の Rust `Message.id` (UUID v4) と frontend message id (`<reqId>:u`) は別物。`update_message_meta(messageId)` の対象引きで困る。

解決: `lib/stores/chat.ts:dbRowIdByMessageId: Map<string, string>` を揮発で保持。
- `appendMessage` → `persistMessageToDb` の戻り値 `{ id }` を受けてマップに登録
- `hydrateSessionMessages` (DB load) では `message.id === DB row id` なので同値登録
- `purgeSessions` で session purge と同時に対応マップも cleanup

`updateMessageMeta` action 内では `persistMessageMetaToDb(messageId, meta)` を呼び、内部で `dbRowIdByMessageId.get(messageId)` を引いて UPDATE する。マップ未登録 (= まだ append_message が完了していない race) の場合は静かに skip (次回 reload で UI 値だけ表示)。

---

## 2. 送信時 attach の前後 diff

### `components/chat/InputArea.tsx`

`handleSend` 内、`appendMessage` 呼出 (旧 L329) を拡張。

```diff
-    useChatStore.getState().appendMessage(sessionId, {
-      id: `${id}:u`,
-      role: "user",
-      content: trimmed,
-      attachments: [...attachments],
-    });
+    // v1.43.0 (DEC-083): 送信時の UI 値 (model / effort) と sentAt を `meta` に
+    // 貼り付け、後で SDK init event の `sdkModel` で back-fill できるようにする。
+    const sendingPrefState = useSessionPreferencesStore.getState();
+    const sendingProjectPref =
+      sendingPrefState.perProject[activeProjectId] ?? null;
+    const sendingGlobalDefaults: SessionPreferences = {
+      model: sendingProjectPref?.model ?? null,
+      effort: sendingProjectPref?.effort ?? null,
+      permissionMode:
+        sendingProjectPref?.permissionMode ?? DEFAULT_PERMISSION_MODE,
+      allowedTools: sendingProjectPref?.allowedTools ?? [],
+      deniedTools: sendingProjectPref?.deniedTools ?? [],
+      chromeEnabled: sendingProjectPref?.chromeEnabled ?? false,
+    };
+    const sendingResolved = resolveSessionPreferences(
+      sendingPrefState,
+      sessionId,
+      sendingGlobalDefaults,
+    );
+    useChatStore.getState().appendMessage(sessionId, {
+      id: `${id}:u`,
+      role: "user",
+      content: trimmed,
+      attachments: [...attachments],
+      meta: {
+        uiModel: sendingResolved.model,
+        uiEffort: sendingResolved.effort,
+        sentAt: Date.now(),
+      },
+    });
```

ポイント:
- `resolveSessionPreferences` は handleSend 後段 (旧 L494 周辺) で再計算しているが、appendMessage タイミングではこの時点で resolve する必要があるため early-call を追加 (副作用なし、純関数)
- 送信失敗 / start_agent_sidecar 失敗時に user message が残るが、これは既存挙動 (本タスクの範囲外、特殊対応なし)

---

## 3. system:init event の back-fill + mismatch 判定 diff

### `hooks/useAllProjectsSidecarListener.ts`

#### a) reqId 単位 dedup Set 追加 (module level)

```ts
// 1 prompt あたり init event は最初の 1 回だけ処理 (resume / retry 時の重複対策)
const sdkInitProcessedReqIds: Set<string> = new Set();
```

#### b) `applyEventToSession` に system 分岐を追加

```ts
if (ev.type === "system") {
  const payload = ev.payload as
    | { subtype?: unknown; model?: unknown }
    | undefined;
  if (!payload || payload.subtype !== "init") return;
  const reqId = ev.id;
  if (!reqId || sdkInitProcessedReqIds.has(reqId)) return;
  sdkInitProcessedReqIds.add(reqId);
  const sdkModel =
    typeof payload.model === "string" && payload.model.length > 0
      ? payload.model
      : null;
  if (!sdkModel) return;

  const userMessageId = `${reqId}:u`;
  const userMessage = readMessages().find((m) => m.id === userMessageId);
  if (!userMessage) return;
  const uiModel = userMessage.meta?.uiModel ?? null;
  const cmp = compareModelIds(uiModel, sdkModel);
  chat.updateMessageMeta(sessionId, userMessageId, {
    sdkModel,
    mismatch: cmp === "mismatch",
  });
  return;
}
```

#### c) `compareModelIds` (`lib/utils/model-display.ts`)

family レベルでのみ比較。`claude-opus-4-7` と `claude-opus-4-7-20251015` は同 family 扱い → "match"。`claude-opus-4-7` vs `claude-sonnet-4-6` → "mismatch"。`MODEL_CHOICES` から動的に family 辞書を構築するため新 model 追加時も自動追従。

---

## 4. DB migration の SQL と schema version

### 新規 DDL (apply_ddl 内)

```sql
CREATE TABLE IF NOT EXISTS messages(
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT,
    content TEXT,
    created_at INTEGER,
    meta_json TEXT DEFAULT NULL,        -- ← v1.43.0 追加
    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
```

### 既存 DB への ALTER (idempotent)

```rust
fn migrate_messages_meta_json(conn: &Connection) -> Result<()> {
    if table_has_column(conn, "messages", "meta_json")? {
        return Ok(());
    }
    conn.execute(
        "ALTER TABLE messages ADD COLUMN meta_json TEXT DEFAULT NULL",
        [],
    )
    .context("ALTER TABLE messages ADD COLUMN meta_json 失敗")?;
    Ok(())
}
```

`apply_ddl` から `migrate_messages_meta_json(conn)?` を呼ぶ (sessions 系列の migration 群と同じパターン、過去 DEC-032 / PM-830 の boilerplate を完コピ)。

### Schema version

frontend 側 zustand persist の version 変更は **なし** (chat-panes は messages を持たないため)。DB 側は **明示的 schema_version table を持たない** (SQLite IF NOT EXISTS / PRAGMA table_info ベースの idempotent migration)。

### 新規 Tauri command

- `update_message_meta(messageId: String, metaJson: String) -> Result<(), String>`
  - 用途: sidecar init event back-fill 経路、`UPDATE messages SET meta_json = ?1 WHERE id = ?2`
  - 失敗時: 該当 message なし → 明示的 Err、SQL 失敗 → Err

### 既存 command 拡張

- `append_message`: `meta_json: Option<String>` 引数追加、INSERT に列追加、`#[tauri::command(rename_all = "camelCase")]` に変更
- `get_session_messages`: SELECT に meta_json を追加し、`Message.meta_json: Option<String>` で frontend に返す

---

## 5. UI 描画の before / after

### Before (v1.42.0)

```
┌────────────────────────────┐
│ ユーザーの送信文           │
│ [画像] [画像]              │
└────────────────────────────┘
```

bubble に attachments のみ。timestamp / model / effort なし。

### After (v1.43.0、通常時)

```
┌────────────────────────────┐
│ ユーザーの送信文           │
│ [画像] [画像]              │
│ ─────                      │  ← 区切り線 (border-t border-primary-foreground/20)
│ Opus 4.7 · effort: 高 · 14:32 │  ← text-[11px] opacity-70 tabular-nums
└────────────────────────────┘
```

### After (mismatch 時)

```
┌────────────────────────────┐
│ ユーザーの送信文           │
│ ─────                      │
│ [!] Sonnet 4.6 (実) · UI: Opus 4.7 · effort: 高 · 14:32 │
└────────────────────────────┘
```

`AlertTriangle` (lucide-react) icon + tooltip:
> UI で選択した Opus 4.7 と実際に Claude が使った Sonnet 4.6 が異なります。sidecar 再起動中の可能性があります。

### After (sdkModel 未到達)

```
│ Opus 4.7 (UI 値) · effort: 高 · 14:32 │
```

10 秒経っても init event が来なければ静かに `sdkModel` 未確定のまま UI 値だけ表示が続く (Phase 1 推奨方針、UX 上問題なし)。

### After (過去 message、meta なし)

bubble 内に何も追加表示しない。`{message.meta && <MessageMetaRow meta={message.meta} />}` の短絡で defensive fallback。

### timestamp フォーマット

| 状況 | 例 |
|---|---|
| 同日 | `14:32` |
| 別日同年 | `4/29 14:32` |
| 今年外 | `2025/12/31 23:59` |

`tabular-nums` で等幅、ローカル timezone で表示。

### アクセシビリティ

- `<div role="note" aria-label="送信設定: <model>、effort <level>、<HH:mm>">`
- mismatch 時は `aria-live="polite"` で SR 通知、aria-label に「UI で選択した model と異なる model で応答されました」を追加
- 警告は icon (AlertTriangle) + text の併記、色だけに依存しない
- bubble 背景 `bg-primary` に対して `text-primary-foreground/70` で WCAG AA contrast 確保

---

## 6. 動作確認結果

### TypeScript

```
$ npm run typecheck
> sumi@1.43.0 typecheck
> tsc --noEmit
(no errors)
```

PASS。

### ESLint

```
$ npm run lint
(既存の unused-vars warning のみ、新規ファイルに関する警告なし)
```

新規警告ゼロ。

### vitest

```
$ npm run test
 Test Files  10 passed (10)
      Tests  123 passed (123)
   Duration  1.11s
```

| ファイル | ケース数 | 状態 |
|---|---|---|
| (既存) keymap 7 ファイル + monitor | 102 | PASS |
| **新規** `lib/utils/model-display.test.ts` | **15** | **PASS** |
| **新規** `lib/stores/chat.test.ts` | **6** | **PASS** |
| **合計** | **123** | **PASS** |

新規テストは計画書 §9-A に対応 (formatSdkModelName / compareModelIds の典型 8〜12 ケース、updateMessageMeta の partial update / merge / 新規作成 / no-op 各シナリオ)。

### cargo check

```
$ cargo check
warning: 2 既存 warning (本タスクと無関係)
Finished `dev` profile [unoptimized + debuginfo] target(s) in 13.41s
```

新規警告ゼロ、PASS。

### cargo test

```
$ cargo test --lib
test result: ok. 182 passed; 0 failed; 3 ignored; 0 measured
```

| カテゴリ | 旧 | 新 | 増分 |
|---|---|---|---|
| 既存 | 177 | — | — |
| 新規 (DEC-083) | — | +5 | meta_json column 存在 / migrate 冪等 / DDL 2 回適用 / round-trip / NULL INSERT |
| **合計** | 177 | **182** | **+5** |

### E2E

E2E はローカル port 3000 競合のため未実行 (CHANGELOG にも明記、計画書 §9-B の方針と同じく CI 再検証前提)。新規 1 ケース `tests/e2e/chat.spec.ts` に追加済 (送信→meta 行出現→system init event mock→sdkModel back-fill 後も meta 行に Opus 4.7 が表示される)。

---

## 7. 触ったファイル一覧

### 新規 (3)

| パス | 役割 |
|---|---|
| `lib/utils/model-display.ts` | `formatSdkModelName` / `compareModelIds` (family 辞書 + 比較) |
| `lib/utils/model-display.test.ts` | 上記の vitest unit (15 ケース) |
| `lib/stores/chat.test.ts` | `updateMessageMeta` の merge / no-op / defensive default テスト (6 ケース) |

### 変更 — frontend (9)

| パス | 主な変更 |
|---|---|
| `lib/stores/chat.ts` | `MessageMeta` 型 / `ChatMessage.meta?` / `updateMessageMeta` action / `persistMessageMetaToDb` / `dbRowIdByMessageId` map / persistMessageToDb の metaJson 経路 / purgeSessions の cleanup |
| `lib/stores/session.ts` | `toChatMessage` で `metaJson` を `JSON.parse` → `MessageMeta` に展開 |
| `lib/types.ts` | `StoredMessage.metaJson?` 追加 |
| `components/chat/InputArea.tsx` | 送信時 `meta` attach (resolveSessionPreferences early-call) |
| `components/chat/UserMessage.tsx` | bubble 末尾の `MessageMetaRow` 追加 (lucide AlertTriangle / tooltip / a11y) |
| `hooks/useAllProjectsSidecarListener.ts` | `system:init` event back-fill branch + reqId 単位 dedup Set |

### 変更 — Rust (2)

| パス | 主な変更 |
|---|---|
| `src-tauri/src/commands/history.rs` | `messages.meta_json TEXT` 列 / `Message.meta_json` field / `append_message` の metaJson 引数 / `update_message_meta` 新コマンド / `get_session_messages` の SELECT 列追加 / `migrate_messages_meta_json` / `table_has_column` 汎用 helper / 5 件の新規テスト |
| `src-tauri/src/lib.rs` | `update_message_meta` を invoke_handler 登録 |

### 変更 — version 3

- `package.json`: 1.42.0 → 1.43.0
- `src-tauri/Cargo.toml`: 1.42.0 → 1.43.0
- `src-tauri/tauri.conf.json`: 1.42.0 → 1.43.0
- (`Cargo.lock` も自動同期、確認済)

### 変更 — その他

- `CHANGELOG.md`: `## [v1.43.0] - 2026-05-02` セクションを追加 (Added / Changed / Notes、effort SDK 非応答 / 過去 message 非表示の Phase 1 推奨方針を明記)
- `tests/e2e/helpers.ts`: `buildSystemInitPayload` builder 追加
- `tests/e2e/chat.spec.ts`: meta 行表示 + sdkModel back-fill の smoke test 1 ケース追加

---

## 8. 残課題 (Phase 2 候補に整理)

計画書 § 5 Phase 2 / 7 不確実事項に対応する形で整理。

### 8.1 SDK 仕様により今回は実装不可

- **effort の SDK 応答からの back-fill**: `Options.effort` は request-only。SDK が将来 system / assistant event で effort 応答するようになったら同経路で back-fill 可能 (本機能の延長線で 1 行追加で対応可能)
- **`Options.effort` (deprecated 移行)**: 現在は `maxThinkingTokens` 経路のまま。本機能とは独立、PM-761 として既存提起済

### 8.2 Phase 2 として将来検討

- 「**同じ設定で再送**」ボタン (UserMessage hover時に表示、`message.meta` を読むだけで実装可能、UX 拡張として有用)
- AssistantMessage 側にも meta 表示 (現状は user 単位だけだが、assistant も model / cost を出す価値あり)
- `SDKResultMessage.modelUsage` を message-level に attach して **cost 推定** (input/output token + family 別単価で円換算)
- Mixed-model session の audit trail (session 内で model 切替したときの「この prompt は Opus、次は Sonnet」を一覧で見せる dashboard)

### 8.3 監視の必要があるもの

- **date suffix 違いの実測**: 公式 docs では `claude-opus-4-7` 系の date suffix は API 経由で返る可能性ありと記述。実機で 1 度 SDK の `system:init.model` を log で観察し、`compareModelIds` の prefix match 戦略が想定通りかを確認したい (誤検知 = false mismatch を防ぐため)。dogfood 期間中に sidecar log で sampling 推奨
- **race condition (init event が append 完了より早い稀なケース)**: 現状は `dbRowIdByMessageId` 未登録時に `update_message_meta` を skip する設計。実際に発生するかは観測待ち。発生した場合は `appendMessage` を await にして race を closeする選択肢もあるが、体感レイテンシ悪化のため Phase 2 で計測してから判断

### 8.4 互換性メモ

- DB schema migration は idempotent (既存 DB への ALTER ADD COLUMN、既存 row は NULL fallback)
- frontend persist version は変更なし (`chat-panes` は messages を持たない、DEC-064 以降の構造のおかげ)
- 過去 message (v1.43.0 以前 / meta_json IS NULL) は静かに何も表示しない defensive fallback (Phase 1 推奨方針、CHANGELOG 明記)

---

## 9. CEO 報告サマリ

1. **DEC-083 候補としての実装完了**。計画書 § 5 Phase 1 を 1 セッションで完了 (2〜2.5d 想定 → 圧縮)。
2. **要望「claud から取得」を字義満足**: SDK の `system:init.model` を listener で抽出し、user message bubble に back-fill 表示。UI 値との乖離 (mismatch) も警告 icon + tooltip で可視化。
3. **effort は SDK 仕様上 request-only** のため UI 値で attach する方式 (案 A 相当)。Notes に明示。
4. **互換性 OK**: 過去 message は静かに非表示 (defensive)、DB migration は idempotent ALTER、persist version 変更なし、DEC-082 の session-scoped 設計を破壊しない。
5. **品質**: typecheck / lint / vitest 123 / cargo test 182 全 PASS、新規警告ゼロ。E2E は port 競合のため CI 再検証前提。
6. **commit / push / tag は未実施** (CEO 一括反映ルール遵守)。

`/dev` 実装はここまで。CEO のレビューと commit / push / tag 反映待ちです。

---

## 付録 A: 主要参照ファイル (絶対パス)

| 役割 | ファイル |
|---|---|
| 型定義 | `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/lib/stores/chat.ts` |
| ヘルパ (新規) | `.../lib/utils/model-display.ts` |
| ヘルパ unit (新規) | `.../lib/utils/model-display.test.ts` |
| chat store unit (新規) | `.../lib/stores/chat.test.ts` |
| 送信時 attach | `.../components/chat/InputArea.tsx` |
| UI 描画 | `.../components/chat/UserMessage.tsx` |
| SDK init event 抽出 | `.../hooks/useAllProjectsSidecarListener.ts` |
| Rust DB | `.../src-tauri/src/commands/history.rs` |
| Rust invoke_handler | `.../src-tauri/src/lib.rs` |
| StoredMessage 型 | `.../lib/types.ts` |
| toChatMessage parse | `.../lib/stores/session.ts` |
| 実装計画書 | `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/reports/dev_message_model_effort_proposal.md` |
| CHANGELOG | `.../CHANGELOG.md` (## [v1.43.0] セクション) |
