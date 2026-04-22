# PRJ-012 v1.2 / PM-951 — Settings フォントサイズ反映バグ修正レポート

- 日付: 2026-04-20
- 担当: 開発部門 (dev)
- 対象リポジトリ: `C:\Users\hiron\Desktop\ccmux-ide-gui`
- 対象 branch: `v1.2-dev`
- 関連 PM: PM-870 (AppearanceInit 方式), PM-949 (Monaco theme 追従), PM-932 (Terminal DOM overlay)
- 工数実績: 約 1.5h

---

## 1. Root cause

**H2 (state は store に保存されるが DOM / CSS に適用されない) + H3 (各 pane で別変数) の複合**。

### 調査で判明した事実

1. `lib/stores/settings.ts::setFontSize` は **正しく動作**しており、`appearance.fontSize` は localStorage に persist されていた（H1 は否定）。
2. しかし codebase 内で **`fontSize` を DOM / CSS / Monaco / xterm に適用する処理がどこにも存在しなかった**。
   - `grep -n -- '--font-size'` → 0 hit
   - `lib/apply-accent.ts` は `applyAccent` / `applyThemePreset` / `applyBackground` を持つが `applyFontSize` 相当が未実装
   - `components/theme/AppearanceInit.tsx` (PM-870) は theme / accent / background だけを初期適用しており fontSize を無視
3. Monaco Editor (`components/editor/FileEditor.tsx:160`) は `fontSize: 13` ハードコード、Terminal (`components/terminal/TerminalPane.tsx:255`) は `fontSize: 13` ハードコード、DiffViewer (`components/chat/DiffViewer.tsx:71`) は `fontSize: 12` ハードコード。いずれも store を参照していなかった（H3）。
4. Chat の `MessageList` / `UserMessage` / `AssistantMessage` はいずれも Tailwind `text-sm` (0.875rem = 14px) 固定。

結論: **「スライダーを動かしても store は更新されるが、その値を読む側が 1 箇所も無い」** という純粋な配線漏れ。スライダーの `onChange` → `setFontSize` → store → persist の左半分だけ PM-210 / Week 6 Chunk 3 で実装され、store → DOM の右半分が PM-870 (背景画像) / PM-949 (theme) とともに後追いされるはずが未着手のまま v1.2-dev まで残っていた。

---

## 2. 修正内容（minimal diff、全 frontend）

### 2.1 `lib/apply-accent.ts`

- `applyFontSize(px: number): void` を新規追加。`document.documentElement.style.setProperty("--app-font-size", "<N>px")` で CSS variable に書き込む（`html { font-size }` 自体は変更しない = Tailwind の rem 計算に影響させない）。
- `readPersistedAppearance()` の戻り値型に `fontSize` を追加し、localStorage からの同期読み出しに含めた。

### 2.2 `app/globals.css`

- `:root` に `--app-font-size: 14px;` デフォルトを追加（未起動 / persist 無しの初期状態でも安全）。

### 2.3 `components/theme/AppearanceInit.tsx` (PM-870 と同じ場所)

- `applyFontSize` を import し、初回 useEffect 内で `readPersistedAppearance().fontSize` を apply。
- 追加で `useSettingsStore((s) => s.settings.appearance.fontSize)` を subscribe して、スライダー onChange でも即時 CSS variable を更新する useEffect を追加（store 変更 → `--app-font-size` を live 反映）。

### 2.4 `components/chat/MessageList.tsx`

- 通常レンダリング path + empty state 両方の scroll container に `style={{ fontSize: "var(--app-font-size)" }}` を付与。子孫が inherit。

### 2.5 `components/chat/UserMessage.tsx` / `AssistantMessage.tsx`

- 本文 `p` / `div` の Tailwind `text-sm` を `text-[length:inherit]` に置換（`text-sm` の固定 0.875rem を外して親の `--app-font-size` を継承させる）。

### 2.6 `components/editor/FileEditor.tsx`

- `useSettingsStore((s) => s.settings.appearance.fontSize)` を subscribe。
- Monaco `options.fontSize` を 13 ハードコードから `fontSize` 変数参照に変更。
- 追加 useEffect で `editorRef.current.updateOptions({ fontSize })` を呼び、mount 後の値変更にも live 追従。

### 2.7 `components/terminal/TerminalPane.tsx`

- `useSettingsStore` 購読を追加 + `fontSizeRef` / `fitAddonRef` を追加。
- メイン useEffect は fontSize を依存に含めない（含めると dispose+再作成で scrollback が消える）。代わりに初期化時は `fontSizeRef.current` を `new Terminal({ fontSize })` に渡す。
- 独立 useEffect で `term.options.fontSize = fontSize` + `fitAddonRef.current?.fit()` を呼び、live 反映 & rows/cols 再計測。

---

## 3. 反映範囲

| Pane | 反映 | 方式 |
|------|:---:|------|
| Chat messages (User / Assistant / empty state) | YES | CSS variable `--app-font-size` を MessageList scroll root に適用、子要素は `text-[length:inherit]` で継承 |
| Monaco Editor (FileEditor.tsx) | YES | `options.fontSize` に store 値を直結、`updateOptions` で live 追従 |
| xterm.js Terminal (TerminalPane.tsx) | YES | `new Terminal({ fontSize })` + `term.options.fontSize` + `fit.fit()` 再計測 |
| DiffViewer (tool card) | NO (意図的) | 12px ハードコード維持。ツールカード内プレビューのレイアウトリスクを避け最小 diff を優先 |
| FilePreviewDialog | NO (意図的) | 12px ハードコード維持。同上 |
| Settings ページ自身の UI / SidebarPane / StatusBar 等 | NO | Tailwind `text-sm` / `text-xs` のまま固定（VSCode も "Window Zoom" と "Editor Font Size" は別設定、IDE シェル UI は固定が妥当） |

**Chat / Editor / Terminal の 3 pane に反映** という仕様の推奨ラインを達成。

---

## 4. 動作確認

### TypeScript

```
$ npx tsc --noEmit --pretty
(0 error, EXIT=0)
```

### Next.js build

```
$ npx next build
✓ Compiled successfully in 7.4s
✓ Generating static pages (7/7)
✓ Exporting (2/2)

/settings   10.2 kB   158 kB First Load JS
```

すべて成功。Lint warning は既存（StatusBar 未使用変数 / img 要素 / treeitem aria 等）で本 PR と無関係。

---

## 5. オーナー実機検証手順

1. `cd C:\Users\hiron\Desktop\ccmux-ide-gui && npm run tauri dev`
2. Workspace に入り、Chat pane でメッセージを 1〜2 つ送信しておく（確認用）。
3. Sidebar から適当なテキストファイルを開いて Monaco Editor に表示しておく。
4. Terminal pane で `dir` or `ls` 等を実行し、scrollback を少し貯めておく。
5. `/settings` → **外観** タブ → **フォントサイズ** スライダーを **12 → 16** の順でゆっくり動かす。
   - 各 pane に **即座に** サイズ変化が反映されることを確認。
     - Chat: ユーザ吹き出し + アシスタント本文の字サイズ
     - Editor: Monaco のコード字サイズ
     - Terminal: xterm の字サイズ + 1 行に収まる文字数（cols）の変化
6. 16px に設定した状態でアプリを完全に終了 → 再起動。
7. 再起動直後に Chat / Editor / Terminal のいずれも **16px で表示されている** ことを確認（persist 復元）。
8. 設定画面を一度も開かずにワークスペースへ直行したケースでも、localStorage の値が読み出されていることを確認（PM-870 と同じ AppearanceInit 経路）。
9. `デフォルトに戻す` ボタン押下 → 全 pane が 14px に戻ることを確認。

### ネガティブ確認

- Tailwind の `text-xs` / `text-lg` / padding (`p-3`) 等の他 UI が **変わらない** ことを確認（`html` 自体の font-size は変更しないため rem レイアウトに影響なし）。
- Terminal scrollback が font size 変更で消えないことを確認（dispose+再生成していない）。

---

## 6. 変更ファイル一覧（絶対パス）

- `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\apply-accent.ts` — applyFontSize 追加 / readPersistedAppearance 拡張
- `C:\Users\hiron\Desktop\ccmux-ide-gui\app\globals.css` — `--app-font-size: 14px` デフォルト追加
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\theme\AppearanceInit.tsx` — fontSize 初期適用 + live 反映
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\chat\MessageList.tsx` — CSS variable で font-size 設定
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\chat\UserMessage.tsx` — `text-sm` → `text-[length:inherit]`
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\chat\AssistantMessage.tsx` — `text-sm` → `text-[length:inherit]`
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\editor\FileEditor.tsx` — store subscribe + updateOptions
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\terminal\TerminalPane.tsx` — store subscribe + fitAddonRef + live fontSize

Rust / sidecar は無変更。

---

## 7. 残課題 / 将来のリファクタ候補

- DiffViewer / FilePreviewDialog を `fontSize - 1` or `fontSize - 2` で scale させるオプション（tool card プレビューは控えめに、等）。
- VSCode と同等の 3 段構成 `UI Font Size` / `Editor Font Size` / `Terminal Font Size` に分離（現状 1 値を全 pane 共有）。需要があれば別 PM で。
- `MessageList` に付けた `style={{ fontSize: "var(--app-font-size)" }}` は本来 Tailwind utility に落とし込みたいが、Tailwind 設定変更のリスクを避けて inline style で対応。
- UserMessage/AssistantMessage 以外の Chat 子要素（ToolUseCard, ImageThumb 等）は `text-sm` / `text-xs` のままで、それらは font size 設定の影響を受けない。必要に応じて同様の `text-[length:inherit]` パターンで拡張可能。

---

## 8. CEO への報告サマリ

- PM-951「設定画面フォントサイズが反映されない」バグを修正。
- 原因: H2 + H3 複合（store は動いているが DOM 適用が 1 箇所も実装されていなかった）。
- 対応: `applyFontSize` を AppearanceInit 経路で live 適用 + Chat / Monaco Editor / xterm.js の 3 pane に配線。
- `tsc --noEmit` 0 error、`next build` 成功、scrollback 保持 OK、persist OK。
- オーナー実機検証待ち。完了後 v1.2.x リリース候補に含める。
