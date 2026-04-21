# PM-831 tool_use メッセージ表示の JSON parse 復元

- 作成日: 2026-04-20
- 担当: dev (Claude Opus 4.7 1M)
- 対象: PRJ-012 ccmux-ide-gui (frontend のみ)
- 関連: 並列実行中の PM-810 と衝突回避（listener / chat store の append 系には触れていない）

## 1. 調査結果

### 1.1 過去の parse ロジックの所在

`git log --all -S "JSON.parse" -- components/chat/` の結果、`components/chat/`
配下に「過去に存在して撤去された JSON.parse」 commit は存在しなかった。
唯一 hit するのは `bf9f3cf feat(Week 4-6)` (`ToolUseCard.tsx` 初出 commit) の
みで、当該 commit 時点でも tool input は `JSON.stringify(tool.input, null, 2)`
を `<pre>` に流し込むだけの最小実装だった。

つまり「v3.5 以前は parse していた機構が削除された」という当初仮説は誤りで、
**「DB → UI の parse 経路は最初から実装されていなかった」** が真因。

ただし `lib/stores/chat.ts:392-395` の `persistMessageToDb` JSDoc に明確な記述
があった:

> tool role の content は toolUse event を JSON serialize して格納する（復元時は
> `session.ts toChatMessage` が文字列として content を受け、UI 側で parse する
> 前提。**v3.5.13 段階では復元時の JSON parse は未対応だが**、DB に保存さえ
> あれば後続で UI 側を拡張できる）。

→ 設計者は意図的に「保存はするが parse は後回し」とコメントを残しており、
本タスクはまさにその後回し分の回収。

### 1.2 現状の表示パスと不具合

| 経路 | message 形 | 表示分岐 (`MessageList.tsx`) | 結果 |
|------|------------|---------------------------------|------|
| live event (`useAllProjectsSidecarListener`) | `role=tool` + `toolUse` 完備 | `ToolUseCard` | OK だが汎用 input は `JSON.stringify` 1 枚で可読性低 |
| DB 復元 (`session.ts loadSession → toChatMessage`) | `role=tool` + **toolUse 無し** + content に raw JSON 文字列 | `m.toolUse` 不成立 → `AssistantMessage` 落ち | raw JSON が markdown としてレンダーされる（バグ表示） |

`session.ts:98-119 toChatMessage` は `attachments` だけ復元し、tool 情報は
content 文字列のまま返している。

### 1.3 入出力データの shape

- input: listener (`extractToolUses`) で `Record<string, unknown>` として
  そのまま流れ込むので **既に object**（追加 parse 不要）。
- output: listener (`extractToolResults`) で string 化されて格納される。Bash 等が
  返す JSON 文字列も string 扱いなので、UI 側で必要に応じ parse する余地あり。

## 2. 設計判断

タスク制約（listener / store の append には手を入れない）を踏まえ、復元処理は
**display 層で完結** させた。`session.ts toChatMessage` を修正すれば 1 箇所で
済むが、衝突回避を優先。

- 新規モジュール `lib/tool-content-parser.ts` に純関数 2 つ:
  - `parseToolMessageContent(content: string) → ToolUseEvent | null`
    DB から戻った tool message の content (`{ name, input, status, output }`
    JSON) を `ToolUseEvent` shape へ復元。型 / parse 失敗時は null。
  - `tryParseJson(text: string) → unknown | null`
    `{` / `[` で始まる文字列のみ parse 試行。失敗 / プリミティブは null。
- `MessageList.tsx` の `m.role === "tool"` 分岐内で、`toolUse` 不在時に
  `parseToolMessageContent` を試し、成功時のみ `ToolUseCard` に流す。**parse 失敗
  時は従来通り AssistantMessage にフォールバック**（クラッシュしない）。
- `ToolUseCard.tsx` の input/output 表示を強化:
  - 既存の Edit / MultiEdit 専用 view (Monaco DiffEditor / 簡易 2 列 diff) は **無改変**。
  - 汎用 input → `ToolInputView`:
    - Bash の `command` だけ専用 1 ブロック + 残り field は key-value
    - 全 field が primitive なら `<dl>` で key-value テーブル
    - 複雑 / 未知 tool は pretty-printed JSON を Collapsible に流す
  - 汎用 output → `ToolOutputView`:
    - `tryParseJson` で JSON ならインデント整形 + Collapsible
    - それ以外は raw を `whitespace-pre-wrap` で Collapsible に
  - Collapsible ヘルパは 10 行超で「もっと見る (残り N 行)」、inline モードは 120
    字超で `…` truncate に切替

「**最初は 1 つの汎用 renderer + 特定 tool の key を強調表示程度に留める**」と
いう brief 指示に沿い、tool 別 view は Bash の command 強調 1 件のみ追加（既存
の Edit / MultiEdit はそのまま残置）。

## 3. 対応した tool 一覧

| tool | input 表示 | output 表示 |
|------|-----------|------------|
| Edit | Monaco DiffEditor (既存、無改変) | 共通 (JSON 自動 parse + Collapsible) |
| MultiEdit | 簡易 2 列 diff (既存、無改変) | 共通 |
| Bash | command 1 ブロック + description 等 key-value | 共通 |
| Read / Write / Glob / Grep / WebFetch / WebSearch / Task / その他既知 tool | 全 field key-value (primitive のみの場合) | 共通 |
| 未知 / 複雑構造 | pretty JSON + Collapsible | 共通 |

## 4. fallback 動作

| 条件 | 挙動 |
|------|------|
| `parseToolMessageContent` 失敗 (DB content が想定外 shape) | `AssistantMessage` で raw 表示。クラッシュしない |
| `JSON.stringify(input)` 例外 (循環参照等) | `String(input)` にフォールバック |
| `tryParseJson` 失敗 | output を raw 文字列のまま Collapsible で表示 |
| object / array でない JSON プリミティブ | `tryParseJson` が null 返却 → raw 表示 |
| input が key-value 化不能（object/array 値混在） | pretty JSON + Collapsible |

## 5. 変更ファイル一覧

| ファイル | 種別 | 概要 |
|----------|------|------|
| `lib/tool-content-parser.ts` | 新規 | DB content / tool output の安全な parse ヘルパ (2 関数, 純関数) |
| `components/chat/MessageList.tsx` | 修正 | tool role で toolUse 欠落時に parse 経由で復元してから ToolUseCard に渡す分岐を追加 |
| `components/chat/ToolUseCard.tsx` | 修正 | 汎用 input/output 表示を ToolInputView / ToolOutputView / Collapsible に置換。Edit / MultiEdit / summarizeInput / status badge は無改変 |

差分行数は概算で +200 / -10 程度。listener / chat store / session store には一切
手を入れていない。

## 6. before / after 要約

### before
- live event の tool input → `JSON.stringify(input, null, 2)` 1 枚 pre block
- live event の tool output → raw 文字列 1 枚 pre block (max-h-64)
- DB 復元の tool message → `toolUse` 欠落で `AssistantMessage` 落ち、
  `{"name":"Edit","input":{"file_path":"...", ...}}` が markdown レンダーされる

### after
- live event の tool input → 主要 field は key-value、Bash command は強調表示。
  複雑構造は pretty JSON。10 行超で折り畳み
- live event の tool output → JSON 風文字列は自動 parse + 整形。raw も折り畳み
- DB 復元 → `parseToolMessageContent` で `ToolUseEvent` 復元 → `ToolUseCard` で
  上記と同じ整形表示。parse 失敗時のみ AssistantMessage フォールバック

## 7. 完了条件チェック

- [x] `npx tsc --noEmit` 0 error (確認済)
- [x] `npx next lint` 対象 3 ファイルとも 0 warning / 0 error
- [x] tool_use / tool_result が JSON 整形 or key-value で表示される
- [x] parse 失敗時にクラッシュしない（全 try/catch + null fallback）
- [x] listener / chat store の append ロジック無改変（PM-810 衝突回避）
- [x] レポート作成

## 8. 残課題 / 引継ぎ

- `session.ts toChatMessage` 自体に parse を組込めば display 層の workaround は
  不要になる。**PM-810 完了後** に統合し直すと上位互換。
- DB 復元時の `toolUse` 復元を store 側でやれば、検索 UI（`SearchPalette` 等）
  からも tool 情報を構造化検索可能になる（現状は content 文字列に対する全文検索
  のみ）。Phase 2 で検討候補。
- E2E テストは `tests/e2e/` に既存セットがある（playwright）。tool message が
  含まれる SQLite session を用意して `loadSession → ToolUseCard 表示` をスナップ
  ショットしておくと regression を捕まえやすい。本タスクスコープ外。

以上。
