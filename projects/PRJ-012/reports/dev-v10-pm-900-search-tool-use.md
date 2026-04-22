# PRJ-012 v1.2 PM-900: SearchPalette tool_use 構造化表示

- 日付: 2026-04-20
- 担当: 開発部門 (Claude dev agent)
- 対象リポジトリ: `C:\Users\hiron\Desktop\ccmux-ide-gui`
- 対象 branch: `v1.2-dev`
- 関連 issue: PM-831 / PM-880 (ToolUseCard) の延長、PM-900

## 背景

PM-831 / PM-880 で chat 画面の tool_use message は `ToolUseCard` で
構造化表示されているが、Ctrl+Shift+F で開く SearchPalette の検索結果では
persisted content (`JSON.stringify({name, input, status, output})`) が
そのまま snippet として表示され、可読性が低かった。

本タスクで SearchPalette 側にも tool_use の構造化プレビューを追加する。

## 実装範囲

1. **`lib/tool-content-parser.ts`**: snippet 向けの軽量抽出ヘルパを追加。
2. **`components/palette/SearchPalette.tsx`**: tool role の結果を構造化表示へ
   分岐。既存 user / assistant の表示は完全維持。

Rust FTS5 (`search_messages`) / sidecar は無変更。frontend 最小 diff。

## 変更詳細

### `lib/tool-content-parser.ts`
- 新規: `ToolSnippetInfo` 型と `extractToolSnippetInfo(snippet: string)`。
  - FTS5 snippet は 16 token で truncate され `parseToolMessageContent`
    (JSON.parse) が通らないケースが多いため、正規表現で `"name":"..."`
    と主要 field (`file_path` / `path` / `command` / `pattern` / `query` /
    `url` / `description`) の順にフォールバック抽出する。
  - 優先順位と field は `ToolUseCard.summarizeInput` と揃える。
  - hit marker `[...]` が値内に挟まるケースも許容（後段 HighlightedSnippet
    で span 化できるよう原文のまま返す）。
- 既存の `parseToolMessageContent` / `tryParseJson` はそのまま（署名変更なし）。

### `components/palette/SearchPalette.tsx`
- 結果 1 件の描画を 2 層に分離:
  - `SearchResultHeader`: 既存の role icon + session title + 相対時刻に加え、
    tool_use と判定できた場合は tool icon + `Badge` (tool 名) を追加表示。
  - `ToolStructuredPreview`: 主要 field 1 行 (例: `FILE components/chat/...`)
    + raw snippet の 2 段表示。いずれも `HighlightedSnippet` を通して `[...]`
    マーカーを `<mark>` に変換するため、既存の hit 強調ロジックは維持。
- tool 判定フロー:
  1. `result.role === "tool"` のみ対象
  2. まず `parseToolMessageContent(snippet)` を試行（短い tool message で
     snippet が完全 JSON の場合は精確に復元できる）
  3. 失敗したら `extractToolSnippetInfo(snippet)` の正規表現抽出にフォールバック
  4. tool 名が取れなかった場合は既存 2 行 snippet 表示に完全回帰 (fallback)
- `summarizeToolInput`: `ToolUseEvent.input` から代表 field を選ぶ純関数。
  ToolUseCard の `summarizeInput` と優先順位を揃え、`previewKey` も返す。
- `Badge` import と `lucide-react` の tool icon 群 (`FileText` / `FileEdit`
  / `FilePlus` / `Terminal` / `FolderSearch` / `Search` / `Globe` / `Sparkles`)
  を追加。

## UI 変更イメージ

Before:
```
[ツール] · セッションタイトル                                3 分前
{"name":"Edit","input":{"file_path":"components/chat/Msg...
```

After:
```
[ツール] [ Edit components/chat/... ] · セッションタイトル   3 分前
FILE components/chat/MessageList.tsx
{"name":"Edit","input":{"file_path":"...[hit]..."}}...
```

- role icon / session title / 相対時刻の既存 layout は維持。
- tool 名 (Edit / Bash / Read など) が Badge 付きで即座に判別できる。
- 主要 field (Edit → file_path / Bash → command / Grep → pattern 等) を
  1 行目に強調表示。
- 2 行目は raw snippet なので、field 以外でヒットした場合 (old_string /
  output など) も検索ヒット位置を視認できる。
- hit 部分の `<mark>` 強調は 1 行目 / 2 行目いずれにも適用される。

## フォールバック方針

- `result.role !== "tool"`: 既存挙動そのまま (`HighlightedSnippet` のみ)。
- tool だが name を抽出できない (snippet の冒頭でなくマッチ位置が中盤のとき
  `"name"` 片が含まれないケース): 既存 2 行 snippet 表示にフォールバック。
- parse / regex で throw しても `try/catch` で握り潰して fallback パスへ。
  SearchPalette がクラッシュしないことを保証。

## テスト / 検証

- `npx tsc --noEmit`: **0 error** (出力なし)。
- `npx next build`: **成功**。既存 warning (StatusBar / TerminalPane 等)
  のみで、本変更由来の新規 warning は無し。
- 手動検証 (推奨):
  1. `npm run tauri dev` で起動
  2. Ctrl+Shift+F で SearchPalette 起動
  3. 既存セッションに対し `file_path` / `components` / `command` 等で検索
  4. tool role の結果に Badge と field preview が出ることを確認
  5. user / assistant の結果は従来どおり 2 行 snippet のみであることを確認
  6. `[...]` highlight が 1 行目 (field) / 2 行目 (raw) 共に維持されること

## 並列作業との衝突確認

- PM-947 (Terminal shortcut, `components/terminal/*` + `lib/stores/terminal.ts`)
  とはファイルが完全に分離しているため衝突なし。
- `package.json` / `package-lock.json` の変更は PM-947 側 (xterm 系?) のもので
  本タスクは依存追加なし。

## 変更ファイル

- `lib/tool-content-parser.ts` (+75 lines)
- `components/palette/SearchPalette.tsx` (+202 / -15 lines)

## 今後の拡張候補 (本タスク対象外)

- Rust `search_messages` の戻り値に `tool_name` / `tool_input_summary` を
  直接含めれば、frontend の regex 抽出を廃し精度を更に上げられる
  (ただし DB migration or persist 形式変更が必要で工数増)。
- 検索 input に `tool:Edit` のような絞り込み syntax を導入し、構造化 filter
  を提供する (PM-901 相当の後続候補)。

## 完了条件チェック

- [x] SearchPalette で tool_use が構造化表示される
- [x] Edit / Bash / Read / Grep 等の主要 field が preview に出る
- [x] 検索 hit highlight (`<mark>`) は維持
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功
- [x] frontend only / Rust 無変更 / logger wrapper 方針遵守
- [x] PM-947 並列作業との衝突なし
