# PRJ-012 v1.43.0 message meta 表示機能 - 品質レビュー

- 案件: PRJ-012 (sumi - Claude Code マルチプロジェクト IDE)
- 対象: v1.43.0 候補 (DEC-083 候補)、メッセージ単位の model + effort + 送信時刻 表示
- 計画書: `projects/PRJ-012/reports/dev_message_model_effort_proposal.md` § 2 案 C
- 完了レポート: `projects/PRJ-012/reports/dev_v143_message_meta_done.md`
- 担当: レビュー部門 (シニアレビュアー)
- 日付: 2026-04-30

---

## 判定: **CONDITIONAL APPROVE**

合格水準。**Phase 1 設計仕様 (案 C) は誠実に実装され、オーナー要望「claud から実 model を取得して送信した user message に表示」の核心は満たされている**。
但し以下 1 点の **Major (CHANGELOG 数値矛盾)** と数件の Minor を、リリース前 (CEO commit 反映前) に修正することを推奨する。
コードレベルでの設計欠陥・回帰リスクは検出されず、現在 17 ファイル diff のままタグ反映しても安全に動作する。

---

## 1. 仕様遵守 (計画書 § 2 案 C / § 4 / § 5)

### 1-A. 送信時 attach (案 A 部分) — **PASS**

- `components/chat/InputArea.tsx:330-361` で `appendMessage` 呼出に `meta = { uiModel, uiEffort, sentAt: Date.now() }` が渡される。
- `uiModel` / `uiEffort` の resolve 元: `useSessionPreferencesStore.getState()` → `resolveSessionPreferences(sendingPrefState, sessionId, sendingGlobalDefaults)` で導出 (L334-350)。これは後段 L521 の `perQueryOptions` 構築で使われる `resolvedPrefs` と **同じ純関数 `resolveSessionPreferences` の同じ source** を使っており、UI 値と SDK 送信値の整合は保証される。
- `sentAt` は `Date.now()` の epoch ms。送信失敗時に user message が残るのは既存挙動 (本タスク範囲外、計画書 §2-A 注釈と整合)。

### 1-B. SDK init event 抽出 (案 B 部分) — **PASS**

- `hooks/useAllProjectsSidecarListener.ts:264-296` で `ev.type === "system"` 分岐を追加。`payload.subtype === "init"` のみ処理 (L268)。
- `payload.model` を取得し型 guard 後 (L276-280)、`${reqId}:u` user message を `readMessages().find(...)` で引いて `meta.sdkModel` に back-fill (L282-294)。
- 1 prompt あたり最初の init のみ処理する guard: モジュール level の `sdkInitProcessedReqIds: Set<string>` (L211) で reqId 単位 dedup。L272-275 で early return。
- session_id は `applyEventToSession(sessionId, ...)` の引数で固定されるため、別 session に back-fill が漏れることはない (関数引数 scoping)。

### 1-C. mismatch 検出 — **PASS**

- `compareModelIds(uiModel, sdkModel)` (`lib/utils/model-display.ts:149-163`) で family レベル比較。`MODEL_CHOICES` から動的に family 辞書を構築するため新 model 追加時に自動追従。
- L290-294 で mismatch 時に `meta.mismatch = true` を立てる。
- UI: `components/chat/UserMessage.tsx:103-177` の `MessageMetaRow` で `AlertTriangle` icon (lucide-react) + tooltip (L141-145, L167-176)。tooltip 文言: 「UI で選択した <UI> と実際に Claude が使った <SDK> が異なります。sidecar 再起動中の可能性があります。」(L130-132)。

---

## 2. 型 / store 設計 — **PASS**

- `MessageMeta` 型 (`lib/stores/chat.ts:75-81`) は計画書 § 2 案 C の最終形と一致:
  `{ uiModel, uiEffort, sdkModel?, sentAt, mismatch? }`。
- `ChatMessage.meta?` は optional (L98)、過去 message との後方互換 OK。
- `updateMessageMeta(sessionId, messageId, patch)` (L891-921):
  - 既存 meta あり → spread merge (L905)
  - 既存 meta なし → defensive default `{ uiModel: null, uiEffort: null, sentAt: 0 }` を base に merge (L900-904)
  - 該当 messageId なし → no-op、参照同一性も維持 (L897 `changed = false`)
- `appendMessage` の引数は既存と同一 (`message: ChatMessage`)。`ChatMessage.meta?` 経由で optional 受け取り、追加 API 破壊なし。
- 既存 chat store の他 action (`updateStreamingMessage` / `appendToolUse` / `clearSessionMessages` 等) には変更なし、責務分離が適切。

---

## 3. ヘルパ品質 (`lib/utils/model-display.ts`) — **PASS**

### `formatSdkModelName`
- `"claude-opus-4-7-20251015"` → `"Opus 4.7"`: `resolveFamily` の prefix match (L104-108) と `stripLabelSuffix` (L67-69) の組み合わせで「(1M)」等の補助記号を剥がしつつ family 単位に揃える。test ケース 6 件で網羅。
- 未知 id (例 `claude-future-9-9`) は raw を返す (L133)。空文字 / null / undefined は空文字 (L130)。defensive 設計妥当。

### `compareModelIds`
- family 比較 (opus vs sonnet vs haiku)、date suffix 違いは "match" 扱い (L162)。
- `uiId` を一旦 `modelIdToSdkId()` で `[1m]` を剥がしてから family 解決 (L157-159) → false positive (`[1m]` suffix 違いだけで mismatch) 防止 OK。
- nullish / 解決不能 → "unknown" (L153-161)。listener 側 (L290-293) では `mismatch: cmp === "mismatch"` としているため、"unknown" は false 扱い。「unknown 時に mismatch を立てない」設計は計画書 § 7.6 の方針と一致。
- test 10 ケース、family 異形 / suffix 同形 / nullish 各組合せを網羅。

---

## 4. DB 永続化 (`src-tauri/src/commands/history.rs`) — **PASS**

- 新規 DB: CREATE TABLE 内に `meta_json TEXT DEFAULT NULL` (L350)。
- 既存 DB: `migrate_messages_meta_json` (L286-296) が `table_has_column` (L185-204) で列存在確認後 ALTER TABLE 発行、idempotent。`apply_ddl` から呼出 (L408)。
- 既存の sessions migration (`migrate_sessions_project_id` / `migrate_sessions_sdk_session_id`) と同パターンで揃っており、運用上の認知負荷が低い。
- `append_message` (L580-660) は `meta_json: Option<String>` 引数を受け取り、INSERT に含める (L617-619)。`#[tauri::command(rename_all = "camelCase")]` 化済 (L580)。
- 新 command `update_message_meta(messageId, metaJson)` (L677-696):
  - SQL: `UPDATE messages SET meta_json = ?1 WHERE id = ?2`
  - 影響行 0 で明示的 Err (L690-692)、silent 飲み込まない設計が監査 OK
- `get_session_messages` (L873) で `meta_json` を SELECT に追加、frontend に渡す。
- `Message` struct に `#[serde(skip_serializing_if = "Option::is_none")]` 付き `meta_json: Option<String>` (L121-125)。NULL 時は frontend `metaJson` undefined で渡る。
- frontend `toChatMessage` (`lib/stores/session.ts:111-152`) で JSON.parse 失敗時は静かに `meta = undefined` (L137)、UI は何も表示しない defensive fallback。
- `lib.rs:27,178,197` で invoke_handler 登録済。
- schema_version table は持たないが、PRAGMA table_info ベースの idempotent migration は既存パターンと整合。

### 単一 race の議論 (Minor)
完了レポート § 8.3 で言及されている「init event が append_message INSERT 完了より早い稀な race → `dbRowIdByMessageId` 未登録 → silent skip」は、frontend state には `updateMessageMeta` 経由で正しく反映されるため UI には影響なし (DB 側だけ NULL のまま)。次回 reload 時は UI 値だけ表示される。観測 reluctance とのバランスで現方針 (skip) は妥当。Phase 2 で計測してから対応で OK。

---

## 5. UI / UX — **PASS (Minor あり)**

### 5-A. DOM 配置 / 視覚デザイン
- `UserMessage.tsx:199` で `{message.meta && <MessageMetaRow meta={message.meta} />}` の短絡 → 過去 message 非表示 OK。
- bubble 内、attachments の後、`border-t border-primary-foreground/20` の細い区切り線 (L139)。`mt-2 pt-1.5 text-[11px]` で控えめ。
- `tabular-nums` で時刻等幅 (L139)。

### 5-B. 表示 3 パターン
- 通常時: `<sdkLabel>` のみ、effort と sentAt が `·` 区切りで続く (L116, L149-160)。
- mismatch 時: `<sdkLabel> (実) · UI: <uiLabel>` + warning (L112-114, L141-145)。
- sdkModel 未到達: `<uiLabel> (UI 値)` (L117-118)。

### 5-C. timestamp フォーマット
- `formatSentAt` (L73-91): 同日 `HH:mm` / 別日同年 `M/d HH:mm` / 今年外 `yyyy/MM/dd HH:mm`。zero-pad は時/分のみ (M/d は L88 で zero-pad なし)。`Number.isNaN` guard あり (L75)。ローカル timezone は `Date` のデフォルトに任せる挙動で OK。

### 5-D. アクセシビリティ
- `role="note"` (L136)、`aria-label` で model / effort / 時刻 / mismatch 文言を埋め込む (L124-128, L137)。
- mismatch 時のみ `aria-live="polite"` (L138)、SR 通知の暴発を防ぐ良い設計。
- 警告は icon (`AlertTriangle`) + text 併記 (L141-145, L113)、色だけに依存しない (L143 `text-amber-300` だが文言・icon でも区別可能) → WCAG 1.4.1 (色だけに依存しない) クリア。
- bubble 背景 `bg-primary` に対して `text-primary-foreground/70` (L139)。OKLCH ベースの primary token なら 70% でも AA 圏内、shadcn の token に追従。

### Minor 5-1: spinner / 10秒タイムアウトの仕様乖離
計画書 § 4.2 では「sdkModel 未到達: `Opus 4.7 (UI 値) · effort: 高 · ⏳`、10 秒で諦める」と記載されていたが、実装は **spinner icon と 10 秒タイマーが省略**され「静かに UI 値表示で確定が続く」挙動に簡素化されている。完了レポート § 5 でも明記。
- **判定**: Minor。UX 観点で「spinner を出すほど遅延しない (実機 < 1 秒)」「タイマーがちらつき源になる」という判断は合理的で、Phase 1 を最低限の implementation にする方針として許容。
- **推奨**: CHANGELOG Notes に「sdkModel 未到達時は spinner を出さず UI 値だけ表示する」を明示する (誤解防止のため)。

---

## 6. コード品質

### Critical: なし

### Major

#### M-1: CHANGELOG のテスト件数表記が done レポートと矛盾
- `CHANGELOG.md:58`:
  > vitest 102 → **120 ケース PASS** (新規 `lib/utils/model-display.test.ts` **12 ケース**、`lib/stores/chat.test.ts` 6 ケース)
- 実測:
  - `lib/utils/model-display.test.ts`: **15 it()** (`grep -c "  it("` 結果 15)
  - `lib/stores/chat.test.ts`: **6 it()** (同 6)
  - 合計新規 **21 ケース**、102 → **123** が正
- 完了レポート (`dev_v143_message_meta_done.md` § 6) は「123 PASS、新規 21」と正しく記載されているため、CHANGELOG だけが古い数字。
- **影響**: 機能には影響なし (純粋にドキュメント矛盾)。但し release notes が tag から自動生成される運用 (release.yml § 766-) では公開数値が誤情報になる。
- **推奨**: CHANGELOG L58 を「102 → 123 ケース PASS、新規 model-display 15 / chat 6 = 21」に修正してから tag を切る。

### Minor

#### m-1: sidecar 側型保証の欠如 (defensive 担保で実害なし)
listener `applyEventToSession` で `ev.payload as { subtype?: unknown; model?: unknown }` (L265-267) と unknown cast。`payload.subtype !== "init"` の strict 等価判定 (L268) と `typeof payload.model === "string"` (L277) で実用上は十分守られているが、SDK 側 `SDKSystemMessage` 型を sidecar 経由でフロント側に再 export する余地はある (将来 SDK upgrade 時の lint 検知に役立つ)。Phase 2 候補。

#### m-2: spinner / 10 秒タイマー省略 (5-1 で詳述)
CHANGELOG / done レポートに方針乖離を明示することを推奨。

#### m-3: `dbRowIdByMessageId` の memory 上限なし
1 sumi セッションあたり数百件想定の Map で揮発、再起動でリセット。長時間 (数日) 動作 + 数千件履歴で M-order メモリを少し食う可能性あり。完了レポートも明示。Phase 2 で監視。

#### m-4: `sdkInitProcessedReqIds` も同上
Set がクリーンアップされない (L208-211 で「クリーンアップ不要」と判断記載)。長時間動作下では monotonic に成長する。実害は M-order だが、`purgeSessions` cleanup と整合させると尚良い (Phase 2)。

---

## 7. テストカバレッジ — **PASS (M-1 修正前提)**

### vitest
- 完了レポート: 102 → **123 ケース PASS** (新規 21)。実測一致。
- `model-display.test.ts`: 15 ケース。formatSdkModelName 6 + compareModelIds 9。計画書 §1-A で要求された「典型 8〜12 ケース」を上回る、family 異形 / suffix 同形 / nullish 各組合せをカバー。**PASS**。
- `chat.test.ts`: 6 ケース。appendMessage に meta 渡し / partial merge / mismatch 上書き / defensive default 新規作成 / 存在しない id への no-op / 空 sessionId|messageId の no-op。**PASS**。
- 既存 102 ケースの regression なし (完了レポート § 6 で確認済)。

### cargo test
- 177 → **182 ケース PASS** (新規 5: meta_json column 存在 / migration 冪等 / DDL 2 回適用 / round-trip / NULL INSERT)。完了レポート記載と実測 (`history.rs:1755-1880` の `#[test]` 5 件) が一致。
- 計画書 §1-B 想定 5 ケースを過不足なくカバー。**PASS**。

### E2E
- `chat.spec.ts` に 1 ケース追加 (`buildSystemInitPayload` mock injection 経由)。**ローカル port 競合で skip、CI 再検証前提**を CHANGELOG / done レポート両方で明示済。
- リスク: 本ケースは CI で初回検証となるため、tag 反映後 Actions で fail する可能性が残る。`buildSystemInitPayload` ヘルパが正しく Tauri event 形を作っていれば通る想定。**PASS (但し CI 結果監視必須)**。

---

## 8. 副作用・エッジケース — **PASS**

| エッジケース | 想定挙動 | 実装確認 |
|---|---|---|
| 過去 message (meta なし) | 何も表示しない | UserMessage.tsx:199 短絡 OK |
| DB の `meta_json IS NULL` 行 load | `metaJson` undefined → meta なし | session.ts:122 OK |
| init event が来ない | UI 値だけ表示が続く | UserMessage.tsx:117-121 OK |
| 同 prompt の init 重複 | 最初の 1 回のみ処理 | listener L211, L272-275 OK |
| session 切替中の back-fill | session_id で scoping、別 session 漏れない | applyEventToSession 引数 scoping OK |
| DEC-082 monitor との独立性 | message 単位 (本機能) vs session 単位 (monitor) で責務分離、map も別 | 完了レポート § 8.3 / chat.ts L75-81 vs monitor.ts 独立 OK |
| append_message 失敗 | `persistedIds` から remove して retry 余地、UI には残る | chat.ts:402-409 OK |
| update_message_meta 失敗 | warn のみ、UI には実害なし | chat.ts:448-454 OK |
| race (init が append 完了より早い) | dbRowIdByMessageId 未登録で silent skip、frontend state は反映 | chat.ts:435-436 OK (Phase 2 で計測) |
| JSON.parse 失敗 (DB load 時) | meta = undefined、何も表示しない | session.ts:136-138 OK |

---

## 9. リリース準備 — **CONDITIONAL (M-1 修正後 PASS)**

| 項目 | 状態 |
|---|---|
| 3 version files 1.43.0 一致 | PASS (`package.json`, `Cargo.toml`, `tauri.conf.json` 全て 1.43.0) |
| CHANGELOG `## [v1.43.0] - 2026-05-02` セクション | PASS (L14) |
| Added / Changed / Notes 構成 | PASS |
| effort SDK 応答非含有を Notes 明示 | PASS (L51) |
| 過去 message に meta 表示なし Notes 明示 | PASS (L52) |
| release.yml awk パターン整合 | PASS (`## [v1.43.0]` literal は `awk -v header="## [$TAG_NAME]" + index($0, header) == 1` で正しく match、release.yml L772-774) |
| **テスト件数表記の正確性** | **FAIL — M-1 修正必要** (102 → 120 と書かれているが正は 102 → 123、新規 12 ではなく 15) |
| commit / push / tag 未実施 | PASS (CEO 一括反映ルール遵守) |

---

## 10. 計画書 § 7 不確実事項の対応状況

| ID | 内容 | 対応 |
|---|---|---|
| 7.1 | SDK 応答 effort 非含有 | uiEffort attach + CHANGELOG Notes 明記 (L51)。**PASS** |
| 7.2 | model 名 date suffix | `compareModelIds` の prefix match で吸収、test ケース 2 件 (L19, L43) で証明。**PASS** |
| 7.3 | 過去 message | meta なし時 UserMessage.tsx:199 で短絡、CHANGELOG L52 明記。Phase 1 推奨方針。**PASS** |
| 7.4 | init event の reqId 紐付け | `sdkInitProcessedReqIds` で 1 prompt 1 回 guard (listener L211, L272-275)。**PASS** |
| 7.5 | Options.effort (deprecated) 移行 | 本タスク範囲外、PM-761 別チケット明記 (done レポート § 8.1)。**PASS** |
| 7.6 | mismatch 検知の false positive | family 比較で `[1m]` suffix 違いを吸収、test ケース 2 件 (L43, L49) で証明。**PASS** |

---

## 11. Phase 2 への引き継ぎ評価

完了レポート § 8 と整合する形で、本レビューが追加で検出した Phase 2 候補:

### 11.1 計画書由来 (既出)
- **「同じ設定で再送」ボタン** (UserMessage hover 時に `message.meta` を読むだけで実装可能) — UX 拡張として有用、本機能の自然な延長
- **AssistantMessage 側にも meta 表示** — message 単位の cost / model 履歴を assistant に拡張
- **`SDKResultMessage.modelUsage` を message-level に attach** で **cost 推定** (input/output token + family 別単価で円換算)
- **Mixed-model session の audit dashboard** (DEC-082 monitor + meta history を統合)

### 11.2 本レビューが新規に検出
- **m-1**: SDK 型を sidecar 経由で frontend に再 export → SDK upgrade 時の lint 検知強化 (現状 unknown cast の defensive parse のみ)
- **m-3 / m-4**: `dbRowIdByMessageId` / `sdkInitProcessedReqIds` の memory cleanup を `purgeSessions` と整合させる (長時間動作下の monotonic 成長を抑える)
- **race window 計測**: 完了レポート § 8.3 にも記載されている race の発生頻度を dogfood 期間で観測してから対応 (現状 silent skip で実害なし)

### 11.3 監視推奨
- **date suffix 違いの実測**: 完了レポート § 8.3 と整合。dogfood 中に sidecar log で `system:init.model` を 1 度 sampling し、`compareModelIds` の prefix match 戦略が想定通りかを確認することを推奨
- **CI E2E 結果**: 本リリースで初回 CI 走行となる新規 1 ケース (chat.spec.ts) の結果を tag 反映後にウォッチ

---

## 12. 推奨修正

**リリース前 (CEO commit 反映前)**:

### 必須 (Major)
1. **CHANGELOG のテスト件数を実測値に合わせる** (M-1):
   - `CHANGELOG.md:58` の「102 → 120 ケース PASS、新規 model-display 12 ケース」を「102 → 123 ケース PASS、新規 model-display 15 ケース、chat 6 ケース」に修正

### 任意 (Minor、非ブロッキング)
2. **CHANGELOG Notes に sdkModel 未到達時の挙動を追記** (m-2): 「sdkModel 未到達時は spinner / タイマーを出さず UI 値表示で確定する (Phase 1 簡素化方針)」を Notes に 1 行追加すると誤解防止に役立つ
3. **Phase 2 候補のチケット起票** (m-3, m-4): メモリ cleanup の整合は急がないが、issue tracker に登録して可視化推奨

---

## 13. 最終判断と CEO への報告

### 判定: **CONDITIONAL APPROVE (Major M-1 を修正後、即タグ可)**

### 核心要件達成度

オーナー要望「**送信した user message に、claud から取得した実 model を貼り付けて、後から見返せる**」 — **満たしている**。

- SDK の `system:init.model` を listener で抽出し (`useAllProjectsSidecarListener.ts:264-296`)、`${reqId}:u` の user message に back-fill (chat.ts:891-921)。
- UI 値との乖離 (mismatch) は family レベル比較で誠実に検出し (`compareModelIds`)、警告 icon + tooltip で可視化 (`UserMessage.tsx:103-177`)。
- DB 永続化 (`messages.meta_json TEXT`) で再起動後も meta 表示が維持される (idempotent migration、defensive parse)。
- effort は SDK 仕様上 request-only のため UI 値で attach する限界を CHANGELOG Notes / done レポートで誠実に明示。

### CEO 報告サマリ

1. **DEC-083 候補として品質ゲート PASS の見込み**。CHANGELOG L58 の数値矛盾 (M-1) を修正してから tag 反映を推奨。
2. **計画書 § 5 Phase 1 を完全実装**。touch ファイル 17、既存テスト 102 → 123 / 177 → 182 全 PASS、新規警告ゼロ。
3. **核心要件 (claud から実 model 取得 → user message に back-fill) を字義満足**。mismatch 検知という副次的バグ検知能力も獲得 (PM-840 系統の安全網)。
4. **互換性 OK**: 過去 message 静かに非表示 (defensive)、DB migration idempotent、persist version 変更なし、DEC-082 session-scoped 設計を破壊しない。
5. **Phase 2 引き継ぎ事項を整理済**: 「同じ設定で再送」ボタン、AssistantMessage meta、cost 推定、memory cleanup 整合、SDK 型 re-export、race window 計測。
6. **リリース blocker は CHANGELOG 数値修正 1 件のみ**。コードレベルでの設計欠陥・回帰リスクはなし、現状 17 ファイル diff のままタグ反映しても安全に動作する。

---

## 付録 A: 参照ファイル (絶対パス、確認済)

| 役割 | ファイル | 確認した行 |
|---|---|---|
| ヘルパ実装 | `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/lib/utils/model-display.ts` | 全体 (1-163) |
| ヘルパ test | 同上 `model-display.test.ts` | 全体 (1-88、15 it ケース) |
| chat store 型 / action | 同上 `lib/stores/chat.ts` | 65-99 / 240-254 / 422-455 / 660-687 / 698-716 / 872-921 |
| chat store test | 同上 `lib/stores/chat.test.ts` | 全体 (1-117、6 it ケース) |
| 送信時 attach | 同上 `components/chat/InputArea.tsx` | 320-361 |
| UI 描画 | 同上 `components/chat/UserMessage.tsx` | 1-203 |
| listener back-fill | 同上 `hooks/useAllProjectsSidecarListener.ts` | 199-296 |
| Rust history | 同上 `src-tauri/src/commands/history.rs` | 100-145 / 185-204 / 278-296 / 350 / 575-696 / 873 / 1745-1880 |
| Rust lib (invoke_handler) | 同上 `src-tauri/src/lib.rs` | 27, 178, 197 |
| StoredMessage 型 | 同上 `lib/types.ts` | 92-106 |
| toChatMessage parse | 同上 `lib/stores/session.ts` | 105-152 |
| CHANGELOG | 同上 `CHANGELOG.md` | 14-62 |
| 計画書 | `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/reports/dev_message_model_effort_proposal.md` | 全体 |
| 完了レポート | `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/reports/dev_v143_message_meta_done.md` | 全体 |
