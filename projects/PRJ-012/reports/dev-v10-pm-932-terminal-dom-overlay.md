# PRJ-012 v1.0 / PM-932 Dev Report: Terminal 透過問題 根治 (DOM overlay 方式)

- **Date**: 2026-04-20
- **Author**: /dev (Claude Code Agent)
- **Scope**: ccmux-ide-gui `components/terminal/TerminalPane.tsx` + `app/globals.css`
- **Status**: DONE — `npx tsc --noEmit` 0 error / `npx next build` 成功
- **Priority**: 緊急 (オーナー画像 4 で「active pane 黒 / 非 active pane 透過」混在確認)

---

## 1. 背景

### 1.1 これまでの経緯

| Rev | 対応 | 結果 |
|-----|------|------|
| PM-922 | WebglAddon 削除 → canvas renderer 単独 | 透過前提の合成を canvas に委ねる前提に変更 |
| PM-926 | `theme.background` を 0.18 → 0.55 に戻す | 可読性改善、壁紙透過 |
| PM-928 | 外殻 `bg-transparent` + canvas `rgba(0,0,0,0.6)` + `foreground:#ffffff` | 1/2 pane の text 可読性担保、**が画像 4 で「active pane 黒 / 非 active pane 透過」現象** |
| PM-930 | `flushAndOpen` (container 0x0 で `term.open()` 遅延) | 0×0 初期化 race 解消、描画自体は動く |

### 1.2 PM-930 後に残存した現象 (画像 4)

- 分割時: active pane は **不透明黒** に cmd が描画される
- 非 active pane は空で **壁紙透過**
- 1 pane 時はときどき不透明黒、ときどき透過 — 再現が不安定

### 1.3 根本原因推定

xterm.js 0.x の canvas renderer は `allowTransparency: true` と `theme.background: rgba(...)` の組合せが **Chromium の canvas 合成モードや GPU driver の状態に強く依存** しており、以下のケースで透過合成が効かない:

- focus / blur により canvas の `willReadFrequently` / `context` mode が変化
- 初期化時の container size や font metric 測定で renderer が別 code path に分岐
- 2 pane SplitView 内で active/非 active の paint 順序が異なる

結果として **canvas 上で `rgba(0,0,0,0.6)` が単に 60% opacity の黒ピクセルとして塗られ、背面の DOM 要素に透過されない** paint フレームが発生する。

---

## 2. 解決策: DOM overlay 方式

### 2.1 設計方針

**canvas の透過合成に依存しない**。xterm canvas を **完全透明** にし、半透明黒の overlay は **純粋な CSS (wrapper div の background)** で描画する。Chromium の compositor は DOM 要素の半透明合成は確実に処理するため、canvas renderer の挙動ブレの影響を受けない。

### 2.2 3 層構造

```
[ z = -10 ]  html::before  : 壁紙画像 (PM-870)
[ z =  -9 ]  html::after   : 背景色 overlay (hsl(--background) × overlay-opacity)
[ z =   0 ]  .ide-shell ...: 通常 DOM フロー
    └─ TerminalPane wrapper  : rgba(0,0,0,0.55) ← PM-932 新設 overlay 層
         └─ inner (xterm mount) : transparent (canvas 透明で text のみ描画)
              └─ canvas          : text glyph + cursor のみ
```

各 frame: 壁紙 → 背景色 overlay → wrapper overlay (0.55 alpha 黒) → canvas text の順で合成。

### 2.3 変更差分 (最小 diff)

#### `components/terminal/TerminalPane.tsx`

**ref 構造の 2 層化** — `containerRef` 1 本 → `wrapperRef` + `innerRef`:

```tsx
// before
const containerRef = useRef<HTMLDivElement>(null);
...
<div ref={containerRef} className="h-full w-full overflow-hidden" />

// after (PM-932)
const wrapperRef = useRef<HTMLDivElement>(null);
const innerRef = useRef<HTMLDivElement>(null);
...
<div
  ref={wrapperRef}
  className="relative h-full w-full overflow-hidden"
  style={{ background: "rgba(0, 0, 0, 0.55)" }}
  aria-label="ターミナル"
  role="application"
>
  <div ref={innerRef} className="absolute inset-0" />
</div>
```

**xterm Terminal の theme 変更**:

```diff
- background: terminalBg,             // rgba(0, 0, 0, 0.6)
+ background: "rgba(0, 0, 0, 0)",     // 完全透明 (PM-932)
  foreground: "#ffffff",
  cursor: "#ffffff",
  cursorAccent: "#0a0a0a",
- selectionBackground: "#3a3a3a",
+ selectionBackground: "rgba(255, 255, 255, 0.3)",  // 透明 canvas でも選択範囲視認
```

**wrapper background を CSS variable で runtime 上書き** (useEffect 内):

```ts
const bgFromVar = getComputedStyle(document.documentElement)
  .getPropertyValue("--terminal-bg").trim();
const wrapperBg = bgFromVar || "rgba(0, 0, 0, 0.55)";
wrapper.style.background = wrapperBg;
```

**useEffect ローカル変数**:

```ts
// before
const container = containerRef.current;
// after
const container = innerRef.current;
const wrapper = wrapperRef.current;
```

— `container` の identifier は残存 (xterm mount 先として使う既存ロジックはそのまま)。

#### `app/globals.css`

```diff
- --terminal-bg: rgba(0, 0, 0, 0.6);
+ --terminal-bg: rgba(0, 0, 0, 0.55);
```

コメントも PM-932 の DOM overlay 仕様に合わせて書き換え。0.55 は「text 可読性 + 壁紙透過」のスイートスポット (0.5 以下だと text 判読困難、0.7 以上だと壁紙が見えない)。

---

## 3. 影響範囲と互換性

### 3.1 pty / Rust sidecar

**無影響**。xterm の theme はコンストラクタ時に確定するが、`background` の値を変えただけで pty の spawn / データフロー / resize 送信に変更なし。

既存 pty への影響: 本変更は TerminalPane が **unmount → re-mount されるタイミング** でしか反映されない。現状の Shell.tsx では ptyId を key として TerminalPane を render しているため、tauri dev の HMR reload 後にすべての TerminalPane が再 mount され新 theme が適用される。明示的な再 spawn 不要。

### 3.2 ResizeObserver / FitAddon

`ResizeObserver` は `container`(= `innerRef.current`) を観察。innerRef は `absolute inset-0` で wrapper を完全に埋めるため、wrapper の size 変化は innerRef に 1:1 伝播する。既存の `handleResize` → `fit.fit()` → `pty_resize` ロジックは無変更で動作。

PM-930 の `flushAndOpen` (container 0x0 時の遅延 open) も innerRef 基準でそのまま動作。

### 3.3 keydown / reset 登録

`container.addEventListener("keydown", ...)` は innerRef に付与される。xterm は `.xterm` 要素を innerRef 配下に生成するため、event bubble で innerRef に到達する。Ctrl+Shift+L の reset (PM-921) は継続して動作。

### 3.4 TerminalPaneItem

外殻 `bg-transparent` + sub-tab bar `bg-background/50` の構造は無変更。active pane ↔ 非 active pane で同じ wrapper overlay が適用されるため、画像 4 で見られた「active だけ黒」現象は構造上発生しえない。

### 3.5 非 active pane の 1 行問題 (画像 5)

PM-930 の `flushAndOpen` で既に根治済の想定。DOM overlay 化によって canvas 初期化タイミングは変わらないため、本件で新たに発生する risk なし。もし依然 1 行のみの症状が出る場合は `term.refresh(0, term.rows - 1)` の強制発火を検討するが、本修正単独での対応は不要と判断。

---

## 4. 検証

### 4.1 型検査

```bash
cd C:\Users\hiron\Desktop\ccmux-ide-gui
npx tsc --noEmit --pretty
```
Exit code 0、エラー 0。

### 4.2 production build

```bash
npx next build
```
`Compiled successfully in 5.1s` / `Generating static pages (9/9)` 成功。
ESLint warning は全て **既存** (`StatusBar.tsx`, `AppearanceSettings.tsx`, `FilePreviewDialog.tsx`, `ProjectTree.tsx`) で本修正と無関係。

### 4.3 実機検証手順 (オーナー側)

1. `npm run tauri dev` 稼働中 → frontend HMR で自動反映
2. ccmux-ide-gui 起動、`設定 > 外観 > 背景画像` で任意画像を 80% opacity で設定
3. project を開き Terminal タブ表示
4. **検証 A (1 pane)**: `cmd` or `powershell` の prompt が半透明黒 overlay の上にはっきり表示され、背面の壁紙が 55% alpha 越しに透けて見えるか
5. **検証 B (split)**: 右上「分割」ボタンで 2 pane に。**両 pane が同じ半透明黒 overlay** を持ち、壁紙が透けて見えるか。active / 非 active で透過度に差が出ない
6. **検証 C (focus 切替)**: pane クリックで active 切替しても、**どの pane も黒塗り (不透明) にならない**
7. **検証 D (サブタブ切替)**: 同一 pane 内で pty タブ切替しても overlay が維持される
8. **検証 E (selection)**: text を drag 選択すると白半透明 (30% alpha) で範囲が視認できる

### 4.4 期待しない結果 (regression check)

- text が滲む / ぼやける → canvas transparent bg の合成でサブピクセル描画が変わる懸念 (Chromium ClearType)
  - 対策: `wrapperBg` の alpha を 0.6 に上げる (globals.css の `--terminal-bg`)
- scroll 残像 → xterm canvas の自動消去がない場合
  - 対策: `term.options.smoothScrollDuration = 0` (既 default)

---

## 5. 変更ファイル

| File | 目的 | 変更行数 |
|------|------|---------|
| `components/terminal/TerminalPane.tsx` | ref 2 層化 + theme.background 透明化 + wrapper inline style | ~40 行 (主に JSX + theme block、既存ロジック維持) |
| `app/globals.css` | `--terminal-bg` default 0.6 → 0.55 + コメント更新 | ~8 行 |

他ファイル (tauri.conf.json / components/preview/* / src-tauri/capabilities/*) には一切触れていない (並列中の PM-933 Preview 修正と衝突なし)。

---

## 6. まとめ

**根本原因**: xterm.js canvas renderer の `allowTransparency` 実装依存性。
**解決**: canvas を完全透明にし、半透明黒 overlay を wrapper div の CSS background で描画 (DOM overlay 方式)。canvas 合成の不確実性から脱却、壁紙透過を純粋な DOM 合成で保証。
**影響**: pty / Rust / サブタブ / resize / keydown の全フローで挙動変化なし。
**検証**: tsc 0 error / next build 成功。実機検証はオーナー画像 4 / 画像 5 の両シナリオで「pane 種別に依存せず必ず壁紙透過 + text 視認」を確認頂きたい。

---

**工数**: 約 45 分 (想定 1h 以内)。
**CEO への報告**: 完了。実機検証結果待ち。
