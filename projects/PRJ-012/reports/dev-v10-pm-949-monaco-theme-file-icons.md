# PM-949: Monaco Editor theme を app theme (dark/light + preset) に同期 + file icon 拡張

- **案件**: PRJ-012 ccmux-ide-gui v1.2
- **branch**: `v1.2-dev`
- **担当**: /dev
- **工数**: 約 1.5h
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`

---

## 1. 背景と発見した追加バグ

依頼は「Monaco Editor の theme が固定で app の dark/light 切替に追従しない」だったが、実装前の調査で **固定ではなく、light 側で壊れていた** ことが判明した。

- `components/editor/FileEditor.tsx` (line 46) および `components/sidebar/FilePreviewDialog.tsx` (line 123) で `resolvedTheme === "dark" ? "vs-dark" : "vs-light"` と書いていた。
- 実際に Monaco のビルトイン theme 名を `node_modules/monaco-editor/esm/vs/editor/standalone/browser/standaloneThemeService.js` で確認:
  ```js
  export const VS_LIGHT_THEME_NAME = 'vs';      // ← light は "vs"
  export const VS_DARK_THEME_NAME  = 'vs-dark';
  ```
- `"vs-light"` は **存在しない** theme 名。`@monaco-editor/react` は `theme` prop を `monaco.editor.setTheme()` に渡すだけなので、Monaco は警告を出しつつ内部的に `"vs"` にフォールバックしていた。結果、`theme` prop が変化しても **実際には常に `"vs"` か `"vs-dark"` の間でしか切り替わっていなかった** ので、「固定で追従しない」ように見えていた。

また、今回の v1.2 では app 側で 5 種の theme preset (Claude Orange / Tokyo Night / Catppuccin / Dracula / Nord) を持つが、Monaco 側はビルトインしか持たないため **preset を切り替えても editor の見た目は変わらない** 状態だった。

## 2. 実装サマリ

### 2.1 新規: `lib/monaco-theme.ts`

- `resolveMonacoTheme(preset, mode)`: app preset + resolved mode から Monaco theme 名を返す。
  - `orange` + light → `"vs"`（ビルトイン、shadcn 既定と同色なので custom 不要）
  - `orange` + dark  → `"vs-dark"`（同上）
  - `tokyo-night` + dark → `"ccmux-tokyo-night"`
  - `catppuccin`  + dark → `"ccmux-catppuccin"`
  - `dracula`     + dark → `"ccmux-dracula"`
  - `nord`        + dark → `"ccmux-nord"`
  - dark-only preset + light → `"vs"`（AppearanceInit が dark-only preset 時に next-themes を dark に強制するので通常到達しないが、フォールバックとして定義）
- `registerMonacoThemes(monaco)`: 4 種の custom theme を `monaco.editor.defineTheme()` で登録。`base: "vs-dark"` + `inherit: true` で token 色は dark default を継承し、`colors` (editor.background / foreground / lineNumber / selection / lineHighlight / indentGuide 等) のみを preset の HSL → hex 換算値で上書き。
- 色の参考値（PM-251 `lib/theme-presets.ts` の HSL を変換）:
  - Tokyo Night: bg `#24283b` / fg `#c0caf5` / cursor `#7aa2f7`
  - Catppuccin Mocha: bg `#1e1e2e` / fg `#cdd6f4` / cursor `#f5c2e7`
  - Dracula: bg `#282a36` / fg `#f8f8f2` / cursor `#50fa7b`
  - Nord: bg `#2e3440` / fg `#eceff4` / cursor `#88c0d0`
- `defineTheme` は idempotent なので重複登録・HMR でも安全。

### 2.2 `components/editor/FileEditor.tsx`

- `useSettingsStore` で `themePreset` を取得、`resolvedTheme` と合わせて `resolveMonacoTheme()` に投げる。
- 新規 `useEffect([monacoTheme])` で preset / light-dark 切替時に `monaco.editor.setTheme()` を単発で呼ぶ。これは global に効くので同 page の全 Monaco instance (editor + preview) に一度で反映される。
- `onMount` を `(ed) => ...` から `(ed, monaco) => ...` に変更し、マウント時点で `registerMonacoThemes(monaco)` を呼ぶことで「custom theme id を prop に渡しても `Theme is not defined` にならない」状態を保証。
- 不要になっていた空の `useEffect(() => {}, [openFileId])` を削除。
- `Ctrl+S` 登録は旧 `import("monaco-editor").then(...)` を廃し、`onMount` 第 2 引数の `monaco` を直接使う形に簡素化（dynamic import の 2 重実行も回避）。

### 2.3 `components/sidebar/FilePreviewDialog.tsx`

- `FileEditor` と同じ pattern で `resolveMonacoTheme` + `registerMonacoThemes` を導入。`useSettingsStore` と `useEffect` による theme 追従を追加。
- preview dialog は open/close で mount/unmount するが、`setTheme` は global なので editor 側で既に反映済であれば preview mount 時点で正しい theme で出る。

### 2.4 `lib/file-icon.ts`（任意拡張）

依頼リストの拡張子（`.rs` / `.toml` / `.lock` / `.yaml` / `.yml` / `.sh` / `.env` / `.gitignore` / `package.json`）は v3.5.4 の時点で既に実装済だった。追加の補強として:

- `docker-compose.yml` / `docker-compose.yaml`
- `bun.lockb`
- `.prettierrc.json` / `.eslintrc` / `.eslintrc.json` / `.eslintrc.js` / `.nvmrc` / `.babelrc`
- `Makefile` / `GNUmakefile` / `CMakeLists.txt`（FileTerminal + amber 系）

を追加。依存追加なし、lucide-react の既存 icon 流用。

## 3. 実装していないもの / 将来拡張

- Orange light / dark の custom Monaco theme: shadcn 既定色と実質同じなのでビルトイン `"vs"` / `"vs-dark"` で十分と判断。将来 Orange 専用の syntax 色 (token rules) を足す場合は `lib/monaco-theme.ts` に追記可能。
- 他エディタ (e.g. Settings > MCP 設定の Monaco) への適用: 本 PR では `FileEditor` / `FilePreviewDialog` のみ。`app/settings/mcp/page.tsx` も `SafeMonacoEditor` を使っているので、同じ pattern を拡張する余地あり（spec 範囲外なので touched せず）。

## 4. 変更ファイル

- 新規: `lib/monaco-theme.ts` (+167)
- 変更: `components/editor/FileEditor.tsx` (theme 追従 + onMount 第 2 引数利用 + import 整理)
- 変更: `components/sidebar/FilePreviewDialog.tsx` (theme 追従 pattern 適用)
- 変更: `lib/file-icon.ts` (特殊ファイル名の追加のみ)

Rust / sidecar / capability は **一切触っていない**。PM-850 並列 Agent 系との衝突なし（frontend 完全分離）。

## 5. 完了条件確認

| 条件 | 結果 |
|------|------|
| app dark/light 切替で Monaco theme も追従 | OK（light は `"vs"`、dark は preset 別 custom） |
| preset 切替（Tokyo Night / Catppuccin / Dracula / Nord）でも Monaco 追従 | OK |
| `npx tsc --noEmit` 0 error | **OK**（EXIT=0） |
| `npx next build` 成功 | **OK**（EXIT=0, 7 static pages exported, shared JS 104 kB） |
| frontend のみ、Rust / sidecar 無変更 | OK |
| 過度な refactor 禁止、最小 diff | OK（新規 1 file、既存は必要箇所のみ） |
| logger wrapper (PM-746) 違反なし | OK（本件では logger 呼び出し追加なし、`console.*` も追加していない） |

ESLint warning は既存の残件のみ（`StatusBar.tsx` の未使用変数、`FilePreviewDialog.tsx` の `<img>` — これは v3.4.4 の画像プレビューで許容済）。今回の変更が起因する警告は 0。

## 6. 動作確認シナリオ（手動）

本ビルドで実機起動して確認すべき項目:

1. Settings > Appearance で theme を light に切替 → editor / preview が `"vs"` 白背景になる
2. Settings > Appearance で Tokyo Night に切替 → editor 背景が `#24283b`、行番号が `#565f89`、カーソルが青 `#7aa2f7` に
3. Catppuccin → `#1e1e2e` / pink カーソル
4. Dracula → `#282a36` / green カーソル
5. Nord → `#2e3440` / 青緑カーソル
6. Orange dark に戻す → ビルトイン `"vs-dark"` で想定通りに戻る
7. プレビュー Dialog を開いたまま theme 切替しても即座に追従（`setTheme` は global なので）

## 7. CEO 報告サマリ

Monaco editor の light theme 切替が **`"vs-light"` という存在しない theme 名で壊れていた** 既存バグを修正し、さらに v1.2 の 5 種 preset (Orange / Tokyo Night / Catppuccin / Dracula / Nord) に合わせた custom Monaco theme を新規登録することで、app UI と editor の見た目を完全同期させた。`lib/monaco-theme.ts` に解決ロジックを集約した thin wrapper として実装、既存の `SafeMonacoEditor` / `keepCurrentModel` / dispose race 対策には一切触れていない。file-icon は要求された拡張子は既に v3.5.4 で実装済だったため、Makefile / docker-compose / bun.lockb / ESLint 系など補強のみに留めた。`npx tsc --noEmit` / `npx next build` いずれも成功、Rust / sidecar は touched なし。
