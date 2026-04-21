# PM-880 tool content parse の DB 復元経路への統合

- 作成日: 2026-04-20
- 担当: dev (Claude Opus 4.7 1M)
- 対象: PRJ-012 ccmux-ide-gui (frontend のみ)
- 関連: PM-831（display 層の workaround 実装元）の正規化・回収タスク
- 対象リポジトリ: `C:\Users\hiron\Desktop\ccmux-ide-gui\`

## 1. 調査結果（Step 1）

### 1.1 `toChatMessage` の所在

`lib/stores/session.ts:98-119` に `toChatMessage(m: StoredMessage)` が存在。StoredMessage（Rust `get_session_messages` の戻り値 = DB row）を ChatMessage 形へ map する pure 関数。役割は「role 正規化」と「attachments 配列の有無判定」のみで、tool role でも `content` を string のまま素通ししていた。

### 1.2 `parseToolMessageContent` の API（PM-831 で新設済み）

`lib/tool-content-parser.ts` に純関数 2 つ。

| 関数 | 入力 | 出力 | 備考 |
|------|------|------|------|
| `parseToolMessageContent(content)` | string | `ToolUseEvent \| null` | `{ name, input, status, output }` 形を要求。status は pending/error 以外 success 扱い |
| `tryParseJson(text)` | string | `unknown \| null` | `{` / `[` 始まりのみ JSON.parse、失敗 / primitive は null |

### 1.3 `chat.ts:392-395` の JSDoc

「復元時の JSON parse は v3.5.13 段階で未対応 / 後続で UI 側を拡張できる」と記載。本タスクで整合する形で改訂した（下記 Step 2）。

### 1.4 live event 経路の調査（Step 4）

`hooks/useAllProjectsSidecarListener.ts` を精査。

- `applyEventToState` → `ev.type === "message"` / `p.type === "assistant"` 分岐（L504-522）で `extractToolUses` → `ToolUseBlock` → `ToolUseEvent` 組立 → `{ id, role: "tool", content: "", toolUse: toolEvent }` として `pane.messages` に push。
- `p.type === "user"`（tool_result）分岐（L538-552）と `ev.type === "tool_result"` 分岐（L581-594）で既存 message を `toolUse.status` / `toolUse.output` 更新でマージ。
- **live event 経路では最初から `toolUse` が structured に付いた状態で messages に入る**。よって live event 側の parse 追加は不要。
- 該当経路は `persistMessageToDb` を通じて DB に `JSON.stringify({ name, input, status, output })` を保存（`chat.ts:411-425`）。

→ 結論: `MessageList.tsx` の display 層 fallback は **「DB 復元経路で toolUse が欠けた時のみ」** 効く workaround だった。

## 2. 統合前/後の data flow

### 統合前（PM-831 段階）

```
[live event 経路]
  sidecar NDJSON
    → useAllProjectsSidecarListener (extractToolUses で structured 化)
    → { role: "tool", toolUse: ToolUseEvent, content: "" } として pane.messages push
    → persistMessageToDb で JSON.stringify(toolUse shape) を DB 保存
    → MessageList では m.toolUse 分岐で ToolUseCard 表示（OK）

[DB 復元経路]
  loadSession(id) → get_session_messages → StoredMessage[]
    → session.ts toChatMessage (role / attachments のみ復元、content は raw 文字列)
    → setMessages → panes[].messages に { role: "tool", content: "<JSON>", toolUse: undefined }
    → MessageList の tool 分岐で m.toolUse が undefined
      → PM-831 fallback が parseToolMessageContent(m.content) して ToolUseCard に流す
    （display 層で parse している状態）
```

### 統合後（PM-880）

```
[live event 経路]  … 変更なし。structured な状態で届く。

[DB 復元経路]
  loadSession(id) → get_session_messages → StoredMessage[]
    → session.ts toChatMessage
      ├─ role === "tool" なら parseToolMessageContent(content) を実行
      ├─ 成功 → { ..., toolUse: ToolUseEvent } を返す
      └─ 失敗 → { ..., toolUse: undefined } を返す（旧挙動互換）
    → setMessages → panes[].messages に structured な ChatMessage
    → MessageList の tool 分岐で m.toolUse が直接 hit → ToolUseCard 表示

  （display 層の fallback は最終防衛ラインとして残置、通常経路では使われない）
```

効果:
- DB 復元後の messages は live event 直後と完全同一の shape（toolUse 完備）
- 将来 SearchPalette / message id 検索等の他機能が `m.toolUse` を前提にしても安全
- parse 処理の一元化（display 層に散らばらない）

## 3. live event 経路の fallback 削除可否

Step 4 の調査結果を踏まえた判断:

| 観点 | 結論 |
|------|------|
| live event 経路は parse が必要か | **不要**。最初から structured |
| DB 復元経路は parse が必要か | **必要**。PM-880 で session.ts に統合済 |
| MessageList の fallback は削除可能か | 論理上は削除可。ただし本タスクでは **残置**（コメント更新のみ） |

残置判断の理由:
- 古いビルドで DB へ直接書込まれた歴史的データや、手動 INSERT / migration 途中の data shape 変動に対する最終防衛になる
- 削除しても差分は +1 / -8 行程度で節約量が小さく、維持コストも低い
- 依頼文「推奨: 安全側で fallback は残すが『session.ts で既に parse 済』のコメントを添える」に準拠

→ 次回 PM で DB migration テスト / E2E snapshot を整備した段階で、display 層 fallback の削除判断を再実施する（残課題）。

## 4. 修正ファイル一覧

| ファイル | 種別 | 差分行数（概算） | 概要 |
|----------|------|------------------|------|
| `lib/stores/session.ts` | 修正 | +20 / -3 | `toChatMessage` に `parseToolMessageContent` を統合。返却型に `toolUse?: ToolUseEvent` を追加。import に `ToolUseEvent` 型 / `parseToolMessageContent` 関数を追加 |
| `components/chat/MessageList.tsx` | 修正 | +6 / -4 | tool role fallback のコメント差替え（削除判断含む設計意図を明記）。ロジック自体は無変更 |
| `lib/stores/chat.ts` | 修正 | +3 / -4 | `persistMessageToDb` の JSDoc を PM-880 統合後の実態に合わせ改訂（「v3.5.13 段階では未対応」→「PM-880 で session.ts に統合済」） |

listener / chat store 本体の append ロジック / Rust / sidecar には変更なし。

### 4.1 diff 要約

**`lib/stores/session.ts`**

```diff
 import { callTauri } from "@/lib/tauri-api";
 import type { Session, SessionSummary, StoredMessage } from "@/lib/types";
-import { useChatStore } from "@/lib/stores/chat";
+import { useChatStore, type ToolUseEvent } from "@/lib/stores/chat";
+import { parseToolMessageContent } from "@/lib/tool-content-parser";

 function toChatMessage(m: StoredMessage): {
   id: string;
   role: "user" | "assistant" | "tool";
   content: string;
   attachments?: { id: string; path: string }[];
+  toolUse?: ToolUseEvent;
 } {
   const role = ... (既存)
+  const toolUse =
+    role === "tool"
+      ? parseToolMessageContent(m.content) ?? undefined
+      : undefined;
   return {
     id: m.id,
     role,
     content: m.content,
     attachments: ... (既存),
+    toolUse,
   };
 }
```

**`components/chat/MessageList.tsx`**（コメント差替えのみ）

```diff
-                  // PM-831: live event 経路では `m.toolUse` が必ず付く。DB 復元
-                  // 経路 (session.ts toChatMessage) では toolUse が剥がれるため、
-                  // content を JSON parse して同等 shape を作り直してから渲染する。
-                  // parse 失敗時は raw JSON が見える AssistantMessage に流す。
+                  // PM-880: live event 経路 / DB 復元経路のいずれも `toolUse`
+                  // が付いた状態で届く前提。以下 fallback は最終防衛ライン。
```

**`lib/stores/chat.ts`**（JSDoc 更新）

```diff
- * tool role の content は toolUse event を JSON serialize して格納する（復元時は
- * `session.ts toChatMessage` が文字列として content を受け、UI 側で parse する
- * 前提。v3.5.13 段階では復元時の JSON parse は未対応だが、DB に保存さえあれば
- * 後続で UI 側を拡張できる）。
+ * tool role の content は toolUse event を JSON serialize して格納する。復元時は
+ * `session.ts toChatMessage` が content を parse して `toolUse` field を
+ * 再構築するため（PM-880 で統合）、UI 側は structured `toolUse` を直接参照できる。
+ * parse 失敗時は display 層 (`MessageList.tsx`) で最終 fallback が走る。
```

## 5. 完了条件チェック

- [x] `npx tsc --noEmit` 0 error（exit code 0 確認済）
- [x] `session.ts toChatMessage` で tool content parse 統合済
- [x] `MessageList.tsx` fallback の扱い明確化（残置 + コメント差替え）
- [x] live event 経路の fallback 削除可否を調査結果とともに判断（削除可だが残置）
- [x] レポート作成

## 6. オーナー検証手順

1. **リポジトリ切替**
   `C:\Users\hiron\Desktop\ccmux-ide-gui` で作業する（`projects/PRJ-012/app/ccmux-ide-gui` junction 経由でも同じ）。

2. **型チェック確認**
   ```bash
   cd C:\Users\hiron\Desktop\ccmux-ide-gui
   npx tsc --noEmit
   echo %errorlevel%    # 0 なら OK
   ```

3. **動作確認**（Tauri dev で手動 QA）
   - `pnpm tauri dev`（または既存の起動コマンド）で起動
   - 既存 session を 1 つ開く → tool_use が含まれる session（Edit / Bash / Read 等を実行した履歴）を狙う
   - 履歴の tool メッセージが Edit の diff、Bash の command 強調、汎用 key-value のいずれかで **整形表示される** ことを確認（PM-831 実装時と同じ見え方になるのが正解）
   - 新規送信でも tool_use が streaming → complete で従来通り表示されることを確認（live 経路が回帰していないかの確認）

4. **fallback の regression 確認（任意）**
   開発者コンソールで `localStorage` / DB に `{ "name": ..., "input": {...}, ... }` 以外の content を持つ旧型 tool row がある場合、従来通り `AssistantMessage` に raw 表示されてクラッシュしないことを確認。

5. **検証 NG 時の切り戻し**
   `lib/stores/session.ts` の `toChatMessage` 変更を revert すれば PM-831 と完全同挙動に戻る（display 層 fallback がそのまま動く）。

## 7. 残課題 / 引継ぎ

- **display 層 fallback の最終削除**: DB migration / E2E snapshot 整備後に再検討（`components/chat/MessageList.tsx` の tool 分岐を `m.toolUse ? <ToolUseCard /> : <AssistantMessage />` に単純化可能）。
- **SearchPalette での tool 情報の structured 検索**: PM-880 で DB 復元 message にも `toolUse` が付くため、将来 `toolUse.name` / `toolUse.input.file_path` で filter する UI が加工しやすくなる。Phase 2 候補。
- **debug log は残置**（PM-746 で将来整理予定のため本タスクでは手を付けず）。
- **E2E regression**: tool message を含む SQLite fixture を `tests/e2e/` に追加し、`loadSession → ToolUseCard 表示` を playwright snapshot で固めるのが理想。本タスクスコープ外。

以上。
