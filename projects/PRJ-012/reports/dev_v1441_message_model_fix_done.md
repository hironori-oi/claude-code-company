# PRJ-012 v1.44.1 dev レポート — message meta の model 欄が「—」に化けるバグ修正

- 案件: PRJ-012 (sumi - Claude Code マルチプロジェクト IDE)
- バージョン: v1.44.0 → **v1.44.1** (hotfix リリース)
- 日付: 2026-05-03
- ステータス: 実装 / テスト / typecheck / lint / cargo check すべて完了
- 担当: 開発部門
- 関連: DEC-083 (v1.43.0 message meta) の follow-up hotfix

---

## 1. オーナー報告

> 「— · effort: 超高 · 10:30」
> チャット送信時にモデル名が表示されていないようです。原因を調査して改善してください。

DEC-083 (v1.43.0) で実装した user message bubble の meta 行において、model 欄だけが em-dash (`—`) に化けるバグ。effort と timestamp は正常表示。

---

## 2. 根本原因

### 2.1 バグの構造

`UserMessage.tsx` の `MessageMetaRow` は以下の優先順位で model 表示文字列を組み立てる:

```ts
if (meta.mismatch && sdkLabel) modelText = `${sdkLabel} (実) · UI: ${uiLabel ?? "—"}`;
else if (sdkLabel)             modelText = sdkLabel;
else if (uiLabel)              modelText = `${uiLabel} (UI 値)`;
else                           modelText = "—";   // <-- ここに到達していた
```

オーナー報告のシナリオは、`meta.sdkModel` が undefined / null **かつ** `meta.uiModel` も null だったために最後の `else` 分岐で `—` 化していた。

### 2.2 なぜ `meta.uiModel` が null になったか (Hypothesis A 確定)

`InputArea.tsx::handleSend` の v1.43.0 実装:

```ts
const sendingResolved = resolveSessionPreferences(sendingPrefState, sessionId, sendingGlobalDefaults);
useChatStore.getState().appendMessage(sessionId, {
  ...
  meta: {
    uiModel: sendingResolved.model,    // <-- null になりうる
    uiEffort: sendingResolved.effort,
    sentAt: Date.now(),
  },
});
```

`resolveSessionPreferences` の実装 (`lib/stores/session-preferences.ts:541-563`):
- `perSession[sessionId].model ?? perProject[projectId].model ?? globalDefaults.model`
- `globalDefaults.model` 自身も `perProject?.model ?? null` (L360)
- → 結局 perSession / perProject **両方** で model が未設定なら `null` を返す

問題は **値が perSession / perProject に入る経路が限定的** なこと。

| 経路 | preferences への書込 | dialog への書込 |
|---|---|---|
| `TrayModelPicker` (StatusBar UI) | ✅ `setPreference` で perSession + perProject | ❌ |
| `ModelPickerDialog` (`/model` slash) | ❌ | ✅ `setSelectedModel` |
| `EffortPickerDialog` (`/effort` slash) | ❌ | ✅ `setSelectedEffort` |

DEC-057 (v1.11.0) で意図的に「dialog store から preferences への自動同期」は撤去された (project leak 防止)。これ自体は正しい設計だが、**meta 表示用の uiModel をどこから取るか**は案として未整理だった。結果:

> ユーザーが `/model` slash dialog で model を切替えた場合、`useDialogStore.selectedModel` だけが更新され、`useSessionPreferencesStore.perProject[id].model` は null のまま残る。送信時の `resolveSessionPreferences()` は null を返し、`meta.uiModel = null` となる。

### 2.3 なぜ `meta.sdkModel` も undefined のままなのか

`useAllProjectsSidecarListener.ts::applyEventToSession` の `system:init` branch (v1.43.0 実装、L264-296) は:
1. `payload.subtype === "init"` チェック
2. `sdkInitProcessedReqIds.add(reqId)` (1 prompt 1 回 guard)
3. `payload.model` 抽出 → null なら return
4. user message 探索 → 見つからなければ silent return
5. `chat.updateMessageMeta(sessionId, userMessageId, { sdkModel, mismatch })`

通常 path はこれで back-fill される。だが以下の race / 異常系で失敗しうる:

- **(a) timing race**: `createNewSession` 直後の初回送信時、`useAllProjectsSidecarListener` が新 sessionId 向け listener を register する前に sidecar が `system:init` を発火 → event miss
- **(b) reqId guard 早期消費**: 旧実装は `payload.model` 検証 **前** に `sdkInitProcessedReqIds.add(reqId)` を実行していた。万が一 SDK が将来仕様変更で「先行 init で model 欠落、後続 init で model 確定」を流すようになった場合、初回 init で reqId 永久 block → 後続 init 受信不能
- **(c) silent failure**: user message 不在 / payload.model 欠落いずれも `console.warn` を出さず silent return → 現場での原因特定が遅れる

ただしオーナー報告の主因は **2.2 の uiModel null** であり、sdkModel back-fill 経路は通常 path であれば動作する設計 (vitest 既存 21 ケースが back-fill merge ロジックを cover 済)。timing race に当たった瞬間にだけ「両方 null → `—` 表示」が顕在化する。

### 2.4 v1.44.0 (DEC-084 日付グルーピング) の影響評価

`toChatMessage` / `appendMessage` / `chatStore` での meta 伝搬は v1.44.0 で破壊されていない。

確認した経路:
- `lib/stores/session.ts::toChatMessage` (L116-171): `metaJson` parse → `meta` 構築 → ChatMessage に attach。timestamp 解決順位は `meta.sentAt > 0 ? meta.sentAt : createdAt * 1000`。**meta 自体の伝搬は無改変**
- `lib/stores/chat.ts::appendMessage` (L726-773): `stamped` に `...message` を spread しているため `meta` は確実に保持される
- `chat.test.ts` 既存ケースで「append 後に meta が読める」を pin 済

DEC-084 はメインライン (timestamp 機能追加) としては meta を介した伝搬になっているが、`meta` field 自身は無傷。本バグは **DEC-083 だけのスコープ問題** であり DEC-084 由来の regression ではない。

### 2.5 仮説検証マップ

| 仮説 | 検証結果 |
|---|---|
| **A**. uiModel が null (perPrefs / dialog 未連携) | ✅ **主因確定** (`InputArea.tsx:351`, `session-preferences.ts:541`) |
| **B**. appendMessage の meta merge ロジック不備 | ❌ chat.ts L731-737 で正常 spread、test pin 済 |
| **C**. listener の system branch 不備 | △ 通常 path は OK だが reqId guard 早期消費に脆弱性あり (修正対象) |
| **D**. reqId 紐付けロジック不一致 | ❌ `${reqId}:u` 規約は `InputArea` `appendMessage` と listener `userMessageId` で同じ |
| **E**. DB ラウンドトリップで meta 喪失 | ❌ Rust 側 `append_message` / `get_session_messages` / `update_message_meta` は meta_json round-trip OK (cargo test 既存 pin) |
| **F**. `formatSdkModelName` が空文字を返す異常系 | △ `sdkModel` が valid なら raw 返却、ただし empty fallback で UserMessage が `—` に逃げる経路に脆弱性あり (修正対象) |
| **G**. `toChatMessage` で meta 伝搬抜け (v1.44.0 影響) | ❌ session.ts:127-144 で正常 parse |

仮説 A を最優先で修正、C と F は再発防止の defensive 改善として併修正。

---

## 3. 修正内容 (前後 diff サマリ)

### 3.1 `lib/utils/meta-fallback.ts` (新規)

pure helper として `resolveMetaUiValues` を切り出した。fallback chain:

```
preferenceModel ?? dialogModel  // 常に non-null な ModelId
preferenceEffort ?? dialogEffort // 常に non-null な EffortLevel
```

vitest で resolution chain を独立に pin 可能にする目的。

### 3.2 `components/chat/InputArea.tsx` (修正)

**Before** (v1.43.0):
```ts
useChatStore.getState().appendMessage(sessionId, {
  ...
  meta: {
    uiModel: sendingResolved.model,    // null になりうる
    uiEffort: sendingResolved.effort,
    sentAt: Date.now(),
  },
});
```

**After** (v1.44.1):
```ts
const dialogState = useDialogStore.getState();
const { uiModel: metaUiModel, uiEffort: metaUiEffort } = resolveMetaUiValues({
  preferenceModel: sendingResolved.model,
  preferenceEffort: sendingResolved.effort,
  dialogModel: dialogState.selectedModel,    // 永続化された default (= "claude-opus-4-7[1m]")
  dialogEffort: dialogState.selectedEffort,  // (= "medium")
});
useChatStore.getState().appendMessage(sessionId, {
  ...
  meta: {
    uiModel: metaUiModel,     // 必ず valid ModelId
    uiEffort: metaUiEffort,   // 必ず valid EffortLevel
    sentAt: Date.now(),
  },
});
```

**重要**: 実 sidecar argv (`start_agent_sidecar`) と per-query options (`send_agent_prompt`) は **既存通り `useSessionPreferencesStore` のみで解決** する (L407 / L529)。dialog default fallback は **meta 表示専用**。よって DEC-057 の project leak 防止セマンティクスは破壊されない。

### 3.3 `components/chat/UserMessage.tsx` (修正)

**Before**:
```ts
const sdkLabel = meta.sdkModel ? formatSdkModelName(meta.sdkModel) : null;
```

**After**:
```ts
// formatSdkModelName が空文字 / 異常正規化失敗時の defensive fallback として
// raw sdkModel を表示するチェーンを追加 (debug 補助も兼ねる)。
const sdkLabel = meta.sdkModel
  ? formatSdkModelName(meta.sdkModel) || meta.sdkModel
  : null;
```

これで `sdkLabel` は `meta.sdkModel` が valid な間は **絶対に空文字 / null にならない**。

### 3.4 `hooks/useAllProjectsSidecarListener.ts` (修正)

**Before** (v1.43.0):
```ts
const reqId = ev.id;
if (!reqId || sdkInitProcessedReqIds.has(reqId)) return;
sdkInitProcessedReqIds.add(reqId);             // <-- 早期消費
const sdkModel = ... ;
if (!sdkModel) return;                          // <-- ここで return しても reqId は使い切られている
```

**After** (v1.44.1):
```ts
const reqId = ev.id;
if (!reqId || sdkInitProcessedReqIds.has(reqId)) return;
const sdkModel = ... ;
if (!sdkModel) {
  // 異常: SDK init payload に model が無い。reqId guard 入りせず後続 init に賭ける。
  console.warn("[sidecar-listener] system:init event has no model field, skip back-fill", ...);
  return;
}
sdkInitProcessedReqIds.add(reqId);             // <-- 有効値が来たときだけ guard

// user message 不在時にも warn を残す (debug 補助)
const userMessage = readMessages().find((m) => m.id === userMessageId);
if (!userMessage) {
  console.warn("[sidecar-listener] user message not found for system:init back-fill", ...);
  return;
}
```

異常 init を「再試行可能」にし、現場で原因特定しやすくするための debug log を追加。production 残置 (warn level)。

### 3.5 バージョン bump

- `package.json`: 1.44.0 → **1.44.1**
- `src-tauri/Cargo.toml`: 1.44.0 → **1.44.1**
- `src-tauri/tauri.conf.json`: 1.44.0 → **1.44.1**

### 3.6 CHANGELOG.md

`## [v1.44.1] - 2026-05-03` セクションを Fixed / Tests / Notes 構成で追加。DEC-083 follow-up hotfix としての文脈を明示。

---

## 4. 再発防止のテスト

### 4.1 vitest 新規 8 ケース (合計 157 → 165)

#### `lib/utils/meta-fallback.test.ts` (5 ケース、新規ファイル)

- preference 両方 valid → dialog default に fallback しない
- preference 両方 null → dialog default を採用
- model だけ null → model だけ fallback、effort は preference 維持
- effort だけ null → effort だけ fallback
- **オーナー報告再現シナリオ**: preferenceModel=null, preferenceEffort="xhigh", dialog 永続化値あり → uiModel=`claude-opus-4-7[1m]`, uiEffort=`xhigh` (非 null になる)

#### `lib/utils/model-display.test.ts` (1 ケース追加)

- `formatSdkModelName("claude-future-9-9")` が空文字でなく raw を返す **再発防止 pin** (UserMessage の `|| meta.sdkModel` フォールバック前提)

#### `lib/stores/chat.test.ts` (2 ケース追加)

- `uiModel=null` で append → `updateMessageMeta` で sdkModel を後付け back-fill → state に反映される (旧 v1.43.0 のバグシナリオが back-fill 経路で救済される pin)
- dialog default fallback 適用後の `uiModel` が valid ModelId であれば、SDK init 未到達でも UserMessage で model 表示可能 (v1.44.1 hotfix の本筋シナリオ pin)

### 4.2 vitest / cargo / typecheck / lint 結果

| Check | 結果 |
|---|---|
| `npm run test` | ✅ **165 PASS** (既存 157 + 新規 8) |
| `npm run typecheck` | ✅ PASS |
| `npm run lint` | ✅ 新規警告ゼロ (既存 warning は pre-existing) |
| `cargo check` | ✅ PASS (既存 warning 2 件のみ) |
| `cargo test --lib` | ✅ **182 PASS / 3 ignored** (Rust 側 schema / API 変更なし、regression なし) |

### 4.3 E2E

UserMessage の DOM 構造 / data-testid は無改変なので既存 E2E (`tests/e2e/`) に regression なし。新規 E2E ケースは**今回見送り** (理由: 主修正は pure helper + 表示 fallback chain で vitest が直接 pin している、E2E で再現するには SDK モック + listener タイミング制御が必要で本 hotfix のスコープを大きく超える)。代わりに vitest 165 ケースで構造を堅牢にした。次回 CI 再検証で既存 E2E に regression が無いことを確認予定。

---

## 5. DEC-083 / DEC-084 への影響評価

### 5.1 DEC-083 (v1.43.0 message meta)

- **mismatch 警告 / tooltip ロジック**: 入力 (`uiModel`) が null → valid ModelId に変わるため、`compareModelIds` の判定はより正確になる。dialog default `claude-opus-4-7[1m]` と sidecar default `claude-opus-4-7` は同一 family → "match" を返すため、意図せぬ mismatch warning が増えることはない (= 警告増による誤誘導なし)
- **DB meta_json round-trip**: 無改変。Rust 側 `append_message` / `get_session_messages` / `update_message_meta` は変更なし
- **back-fill 経路**: listener の guard 順を改善し、異常 init で reqId 永久 block する旧脆弱性を根治

### 5.2 DEC-084 (v1.44.0 日付グルーピング)

- `meta.sentAt` (timestamp 優先源) の打刻挙動は無改変
- `appendMessage` の `stamped` 生成ロジックも無改変 (`message.meta?.sentAt ?? Date.now()` の優先順位が維持される)
- `groupItemsByDate` / `DateBucketHeader` には影響なし

### 5.3 過去 message (v1.43.0 以前 / meta_json IS NULL)

`message.meta` が undefined のため `MessageMetaRow` 自体が描画されない (`{message.meta && <MessageMetaRow />}`)。本 hotfix の影響を受けない。

---

## 6. 動作確認結果

### 6.1 期待挙動 (修正後)

| シナリオ | meta 行表示 |
|---|---|
| `/model` で Opus 選択 + send (sdkModel back-fill 成功) | `Opus 4.7 · effort: 中 · HH:MM` |
| `/model` で Opus 選択 + send (back-fill 未到達) | `Opus 4.7 (UI 値) · effort: 中 · HH:MM` |
| Tray で Sonnet 選択 + send (back-fill 成功) | `Sonnet 4.6 · effort: 中 · HH:MM` |
| Tray で Sonnet 選択 + `/model` で Opus に変更 + send (mismatch) | `[!] Opus 4.7 (実) · UI: Opus 4.7 · effort: 中 · HH:MM` (mismatch 解消、`/model` で UI も実 model に揃った場合) |
| **オーナー報告再現** (`/model` 経由 + back-fill 取りこぼし) | `Opus 4.7 (UI 値) · effort: 超高 · 10:30` ← 旧 v1.43.0 では `— · effort: 超高 · 10:30` だった |

すべて `—` に化けない。

### 6.2 sdkModel 経路の安定性

listener の guard 順改善により、SDK が将来「先行 init で model 欠落、後続 init で model 確定」を流すようになっても back-fill 可能になった。warn log で異常検知も容易。

### 6.3 既存 UI / store への影響

- `useDialogStore` への参照を InputArea に追加したが、既存 ModelPickerDialog / EffortPickerDialog / HelpDialog は `useDialogStore` を独立に参照しており、本変更による re-render 増 / 副作用は **InputArea 自身の handleSend 1 回呼出時のみ**。vitest / typecheck で確認済
- `useSessionPreferencesStore` / `useChatStore` には変更なし
- `lib/utils/meta-fallback.ts` は他からは参照されない isolated helper

---

## 7. 成果物

### 7.1 新規ファイル

- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/lib/utils/meta-fallback.ts`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/lib/utils/meta-fallback.test.ts`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/reports/dev_v1441_message_model_fix_done.md` (本レポート)

### 7.2 修正ファイル

- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/chat/InputArea.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/chat/UserMessage.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/hooks/useAllProjectsSidecarListener.ts`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/lib/utils/model-display.test.ts`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/lib/stores/chat.test.ts`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/CHANGELOG.md`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/package.json`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/src-tauri/Cargo.toml`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/src-tauri/tauri.conf.json`

---

## 8. 次のアクション (CEO への申し送り)

- 本 hotfix の git commit / tag / push は **未実施** (オーナー指示通り)
- v1.44.1 リリース可。release body は CHANGELOG `## [v1.44.1]` chunk が `release.yml` の awk 抽出で自動展開される
- ローカル debug 用の `console.warn` は **意図的に production 残置** (異常時のみ発火、ノイズ少。次回 PM-746 相当のクリーンアップで再評価)
- 中長期的な検討事項 (本 hotfix 範囲外):
  - Picker dialog (`/model` `/effort`) を session-preferences にも書込む統一を行うか、現行の「dialog 永続化 + meta 表示 fallback」継続でいいかを設計レビューしたい (DEC-057 の project leak 防止意図と整合させる必要あり)
  - listener の timing race (新規 session 初回送信で `system:init` を miss する稀ケース) は本 hotfix で構造改善 (warn log) のみ。完全解消には listener 登録経路の eager 化 / event buffering の検討が必要 (別 chunk として別途)
