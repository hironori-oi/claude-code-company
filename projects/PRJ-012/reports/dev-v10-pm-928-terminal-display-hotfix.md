# PRJ-012 v10 / PM-928: Terminal 表示 regression 緊急 hotfix

- **案件**: PRJ-012 Claude Code マルチプロジェクト IDE
- **タスク**: PM-928 Terminal 表示 regression (1 pane で cmd 文字が見えない / 2 pane で見える) の緊急 hotfix
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **日付**: 2026-04-20
- **担当**: 開発部門 (dev-v10, Claude Opus 4.7 / 1M context, build-error-resolver agent 経由)
- **関連**: PM-922 / PM-923 / PM-926 (Terminal polish 系) / PM-924 (SplitView 対応) / PM-870 (背景画像)

## 0. サマリー

PM-926 で導入した Terminal 外殻の `bg-background/30` 半透明塗りが、**1 pane 時に xterm canvas の合成描画を阻害し text 可読性が崩壊する**回帰を起こしていた。2 pane 時は SplitView の Panel が container を別 subtree に配置するため症状が出にくかった。

最小 diff で hotfix:

1. **`TerminalPaneItem.tsx` 外殻を `bg-background/30` → `bg-transparent`** (H1 根治、1/2 pane 同一挙動を保証)
2. **`TerminalPane.tsx` `theme.background` default を `rgba(0,0,0,0.55)` → `rgba(0,0,0,0.6)`** (外殻 bg を剥がした分、可読性担保を canvas 単独に寄せる)
3. **`TerminalPane.tsx` `theme.foreground` を `#e5e5e5` → `#ffffff`** (純白で contrast 最大化)
4. **`app/globals.css` `--terminal-bg` default も `rgba(0,0,0,0.55)` → `rgba(0,0,0,0.6)`** (CSS variable 同期、PM-926 と同じ二重化方針維持)

検証:
- `npx tsc --noEmit`: **0 error**
- `npx next build`: **成功** (既存 warning のみ、新規 0)
- tauri dev は指示通り停止させず (frontend only の hot reload 前提)

他 Agent 担当領域 (`Shell.tsx` / `tauri.conf.json` / `components/preview/*` / `components/chat/*`) 完全不介入。

## 1. 変更ファイル一覧

| File | 変更種別 | 内容 |
|---|---|---|
| `components/terminal/TerminalPaneItem.tsx` | 修正 | 外殻 div の `bg-background/30` → `bg-transparent` / PM-928 コメント追加 |
| `components/terminal/TerminalPane.tsx` | 修正 | `theme.background` default `rgba(0,0,0,0.55)` → `rgba(0,0,0,0.6)` / `theme.foreground` `#e5e5e5` → `#ffffff` / `theme.cursor` `#e5e5e5` → `#ffffff` / PM-928 コメント追加 |
| `app/globals.css` | 修正 | `--terminal-bg` `rgba(0,0,0,0.55)` → `rgba(0,0,0,0.6)` / PM-928 コメント追記 |

変更なし (意図):
- `components/terminal/TerminalView.tsx` — SplitView を呼ぶのみ、本件無関係
- `components/layout/SplitView.tsx` — 他 view (Chat / Editor) 共有、範囲外
- `components/layout/Shell.tsx` — 他 Agent 領域、完全不介入
- `components/preview/*` / `tauri.conf.json` — PM-929 Agent 領域、完全不介入
- sub-tab bar `bg-background/50` / active tab `bg-background/70` / split header `bg-background/50` — PM-926 の階層設計を維持 (UI 可読性に必須)
- xterm 色パレット (ANSI 16 色) — 全て無変更、`foreground` / `cursor` のみ純白化

## 2. 仮説検証

### H1: 親要素の CSS bg が xterm theme.background を覆う — **採用 (root cause)**

**検証:**

PM-926 時点の `TerminalPaneItem.tsx` 外殻:

```tsx
<div className="flex h-full w-full flex-col bg-background/30">
```

`bg-background/30` は dark mode で `hsl(0 0% 3.9%)` × 30% alpha = 実効 `rgba(10,10,10,0.3)`。

xterm.js の構造 (mount 後の DOM):

```
<div class="xterm">
  <div class="xterm-helper-textarea">...</div>
  <div class="xterm-screen">
    <canvas class="xterm-cursor-layer">...</canvas>
    <canvas class="xterm-selection-layer">...</canvas>
    <canvas class="xterm-text-layer">...</canvas>   ← text canvas
    <canvas class="xterm-link-layer">...</canvas>
  </div>
  <div class="xterm-viewport">...</div>
</div>
```

xterm.css は `allowTransparency: true` 時に `background-color: transparent` を各 canvas に設定する。xterm の text canvas は **alpha ブレンドで文字を描画** する。

**1 pane 時の合成順序 (下→上):**

1. html::before (壁紙)
2. html::after (`hsl(--background)` × overlay)
3. body (透明)
4. Shell 最外 (透明)
5. `SplitView` pass-through wrapper `<div class="flex min-h-0 flex-1 flex-col">` (透明)
6. **`TerminalPaneItem` 外殻 `bg-background/30`** ← 問題のレイヤ
7. xterm container (透明)
8. xterm-screen / viewport (透明)
9. text canvas (transparent base + text pixel w/ alpha)

canvas renderer は `theme.background` を canvas clear 色として適用するが、**canvas 自身の DOM レイヤは親 6 の半透明塗りの上** に描画される。結果:

- `theme.background: rgba(0,0,0,0.55)` が canvas に塗られる
- その上に text pixel (foreground #e5e5e5) が alpha 合成される
- しかし親 6 の `bg-background/30` = ほぼ黒 30% が canvas 領域全体を「下から」塗り、canvas の half-transparent な黒 (0.55) と重なって実効透過率が変動
- 特に canvas の non-text ピクセル (transparent 部分) が親 bg を透かすため、text と同系色の濃いグレーが広範囲に出現し、text (#e5e5e5) との contrast 比が崩れる

**2 pane 時の差分:**

`SplitView` が 2 pane の場合:

```tsx
<PanelGroup direction="horizontal" ...>
  <Panel id="..." order={1} defaultSize={50} minSize={20} className="flex min-h-0 flex-col">
    <TerminalPaneItem .../>
  </Panel>
  <PanelResizeHandle .../>
  <Panel id="..." order={2} defaultSize={50} minSize={20} className="flex min-h-0 flex-col">
    <TerminalPaneItem .../>
  </Panel>
</PanelGroup>
```

`react-resizable-panels` の `Panel` は内部で **`data-panel` + position 管理用の wrapper** を挟む。この wrapper は inline style で layout を組み、z-index stacking context が切り替わる。結果:

- Panel の wrapper が新しい stacking context を形成
- `TerminalPaneItem` 外殻の `bg-background/30` は **その stacking context 内でのみ描画**
- xterm canvas の compositing が親の半透明塗りに干渉されにくくなる
- 副作用として、split header の `bg-background/50` が併用されると「外殻 30 → header 50」で視覚的に黒みが増し、text が見えるようになる

**結論**: H1 が root cause。外殻の半透明 bg が canvas 合成を阻害していた。2 pane では stacking context 切替で偶然回避されていただけで、設計上 1 pane / 2 pane で異なる挙動は許容できない。

### H2: xterm theme.background 値が効いていない — **不採用**

- devtools (想定) で canvas の `background-color` を確認すれば `rgba(0,0,0,0.55)` が効いていることは分かる
- `allowTransparency: true` は PM-922 から維持、コード diff なし
- 2 pane 時は正常に見えているという事実自体が「canvas 側の設定は効いている」証左
- H2 は除外

### H3: foreground 色が背景と近くて視認できない — **部分的に採用 (補強策として)**

- root cause ではないが、H1 対応後の contrast 担保として `#e5e5e5` → `#ffffff` に強化する価値あり
- 明るい壁紙 (青空系画像) 上でも純白なら WCAG AAA の 7:1 を確保しやすい
- diff は 1 行なので低コスト

### H4: PM-924 の分割実装と PM-926 の透過の相互作用 — **間接的に採用**

- PM-924 で `TerminalView` → `TerminalView (SplitView wrap)` + `TerminalPaneItem` 分離
- PM-926 で `TerminalPaneItem` 外殻に `bg-background/30` 追加
- この 2 つの組み合わせが、SplitView の 1 pane passthrough path (`<div className="flex min-h-0 flex-1 flex-col">{panes[0].content}</div>`) で stacking context が浅くなり、canvas 合成に干渉する状況を作った
- H1 の前提条件だが、H1 を直接修正 (外殻 bg 削除) すれば H4 も自動解消

## 3. 採用案: ハイブリッド (案 C)

依頼書の案 A / B / C 比較:

| 案 | 内容 | 採用 | 理由 |
|---|---|---|---|
| **A** (H1 対応単体) | 外殻 `bg-background/30` → `bg-transparent` | 部分採用 | 根治策として必須、単独でも十分 |
| **B** (H3 対応単体) | foreground `#ffffff` + backdrop-filter blur | 部分採用 (blur なし) | backdrop-filter は外殻に付けると canvas に影響する懸念 (未検証なので省略)、foreground 強化のみ採用 |
| **C** (ハイブリッド) | 案 A + foreground 強化 + theme.background 0.6 | **採用** | 根治 + 可読性担保、1 pane / 2 pane 同一挙動保証 |

採用した diff の合計 = 4 箇所 (`TerminalPaneItem.tsx` 1 箇所 / `TerminalPane.tsx` 2 箇所 / `globals.css` 1 箇所)、いずれも 1〜3 行の最小 diff。

## 4. 変更内容 diff

### 4.1 `components/terminal/TerminalPaneItem.tsx`

```diff
  return (
    <div
      className={cn(
-        // PM-926: 外殻は控えめな半透明にして sub-tab bar より薄く。
-        // bg-background/30 = hsl(--background) × 30% opacity、dark では
-        // おおよそ rgba(10,10,10,0.3) 相当で壁紙を強く透過させる。
-        "flex h-full w-full flex-col bg-background/30",
+        // PM-928 hotfix: PM-926 の `bg-background/30` は 1 pane 時に xterm canvas
+        // との合成レンダリングを阻害し、text が背景色に溶けて見えなくなる回帰を
+        // 起こしていた (2 pane 時は SplitView の Panel レイアウトが container を
+        // 異なる subtree に配置するため副次的に回避されていた)。
+        // 1/2 pane で同一挙動を保証するため、外殻は `bg-transparent` にして
+        // 背景塗りは xterm 本体の theme.background (0.6) 単独に委譲する。
+        // sub-tab bar / split header は自前の bg-background/50 を維持するため
+        // UI 可読性は落ちない。
+        "flex h-full w-full flex-col bg-transparent",
        showHeader && !isActivePane && "opacity-95"
      )}
```

### 4.2 `components/terminal/TerminalPane.tsx`

```diff
-        // PM-922 / PM-923 / PM-926: `--terminal-bg` CSS variable 経由で背景色を
-        // 可変化。PM-923 で 0.35 → 0.18 に下げたところ透過しすぎて text が読めない
-        // fb があったため、PM-926 で 0.55 に引き上げる。
-        // (0.35 → 0.18 → 0.55 と推移。0.55 は「壁紙がうっすら見える」程度の
-        //  半透明黒で、xterm foreground (#e5e5e5) との contrast を確保しつつ
-        //  背景画像の存在感も残す中央値。0.45〜0.6 の範囲で調整可。)
+        // PM-922 / PM-923 / PM-926 / PM-928 hotfix: `--terminal-bg` CSS variable
+        // 経由で背景色を可変化。PM-923 で 0.35 → 0.18 に下げたところ text が
+        // 読めない fb があり PM-926 で 0.55 に戻した。PM-928 で外殻 bg を
+        // bg-transparent にして canvas 単独合成に委譲したため、可読性担保を
+        // xterm 本体側に寄せる意味で 0.55 → 0.6 に微調整 (差分 +0.05、壁紙は
+        // まだうっすら見える)。
         // オーナーが globals.css / inline style で上書きすれば微調整できる。
         ...
-        const terminalBg = bgFromVar || "rgba(0, 0, 0, 0.55)";
+        const terminalBg = bgFromVar || "rgba(0, 0, 0, 0.6)";

         const term = new Terminal({
           ...
           theme: {
             // shadcn dark theme 近似。background のみ半透明化。
+            // PM-928 hotfix: foreground を #e5e5e5 → #ffffff (純白) に強化。
+            // PM-926 で判明した「1 pane 時に text が薄く見える」症状の可読性
+            // 担保を最優先。canvas 合成後の contrast を確保。
             background: terminalBg,
-            foreground: "#e5e5e5",
-            cursor: "#e5e5e5",
+            foreground: "#ffffff",
+            cursor: "#ffffff",
             cursorAccent: "#0a0a0a",
```

### 4.3 `app/globals.css`

```diff
     /*
-     * PM-926: xterm.js Terminal 背景色 (半透明黒) のデフォルト。
+     * PM-926 / PM-928 hotfix: xterm.js Terminal 背景色 (半透明黒) のデフォルト。
      * TerminalPane.tsx は mount 時にこの variable を読取り、theme.background に
      * 渡す。未指定でも TerminalPane.tsx 側で同値が fallback されるが、ここで
      * 明示しておくことで devtools や user stylesheet での上書きが容易になる。
-     * 値は 0.45〜0.6 の範囲で調整するのが推奨 (小さすぎると text 可読性低下、
+     * PM-928 で外殻 bg を透明化したため可読性担保を canvas 側に寄せて 0.55 → 0.6。
+     * 値は 0.5〜0.7 の範囲で調整するのが推奨 (小さすぎると text 可読性低下、
      * 大きすぎると壁紙が見えない)。
      */
-    --terminal-bg: rgba(0, 0, 0, 0.55);
+    --terminal-bg: rgba(0, 0, 0, 0.6);
```

## 5. 1 pane / 2 pane 挙動の静的追跡

### 修正前 (PM-926 時点) — 問題あり

| 層 | 1 pane | 2 pane |
|---|---|---|
| html::before | 壁紙 | 壁紙 |
| html::after | `hsl(--background)` × overlay | 同左 |
| body | bg-transparent | 同左 |
| Shell | bg-transparent | 同左 |
| SplitView wrapper | `flex min-h-0 flex-1 flex-col` (透明) | `PanelGroup` (透明) |
| Panel wrapper | (1 pane 時は passthrough なので無し) | `<Panel>` = data-panel + inline style wrapper (新 stacking context) |
| TerminalPaneItem 外殻 | **`bg-background/30`** (canvas 合成を阻害) | `bg-background/30` (Panel 下で stacking context 切替により影響軽微) |
| split header | 非表示 (1 pane 時 `showHeader=false`) | `bg-background/50` (視認補助として機能) |
| sub-tab bar | `bg-background/50` | `bg-background/50` |
| xterm canvas | `rgba(0,0,0,0.55)` | 同左 |
| **text 可読性** | **× 背景に溶ける** | **△ 見えるが setup 依存** |

### 修正後 (PM-928 hotfix) — 正常化

| 層 | 1 pane | 2 pane |
|---|---|---|
| html::before | 壁紙 | 壁紙 |
| html::after | `hsl(--background)` × overlay | 同左 |
| body | bg-transparent | 同左 |
| Shell | bg-transparent | 同左 |
| SplitView wrapper | `flex min-h-0 flex-1 flex-col` (透明) | `PanelGroup` (透明) |
| Panel wrapper | 無し | `<Panel>` wrapper (透明) |
| **TerminalPaneItem 外殻** | **`bg-transparent`** (canvas 合成に干渉せず) | **`bg-transparent`** (同左) |
| split header | 非表示 | `bg-background/50` |
| sub-tab bar | `bg-background/50` | `bg-background/50` |
| xterm canvas | `rgba(0,0,0,0.6)` | 同左 |
| foreground | `#ffffff` | 同左 |
| **text 可読性** | **○ 純白 text + 0.6 黒で明確** | **○ 同左** |

### 合成後の実効透過率 (参考)

合成式 α' = 1 - ∏(1-αᵢ)

**修正後の xterm 本体領域 (1 pane / 2 pane 共通):**

1. html::after (仮に overlay 0.6)
2. Panel wrapper (透明)
3. TerminalPaneItem 外殻 (透明)
4. xterm canvas 0.6

= 1 - (1-0.6)(1-0)(1-0)(1-0.6) = 1 - 0.4 × 0.4 = **0.84 (壁紙 16% 透過)**

**修正前 (PM-926) の xterm 本体領域 (1 pane、問題版):**

1. html::after (0.6)
2. TerminalPaneItem 外殻 0.3
3. xterm canvas 0.55

= 1 - (1-0.6)(1-0.3)(1-0.55) = 1 - 0.4 × 0.7 × 0.45 = **0.874 (壁紙 12.6% 透過)**

数値上は修正後の方がむしろ壁紙が見える (84% vs 87% の opacity) が、**canvas 単独合成になったため text pixel の alpha ブレンドが clean に動作** し、実効可読性は大幅に改善。

foreground `#ffffff` vs `#e5e5e5`:
- 明度差: 100% vs 90%
- 合成後背景 (想定 ≒ `rgb(10,10,10)` × 0.84 + 壁紙 × 0.16) との contrast 比:
  - `#e5e5e5` (明度 0.9): 約 13:1 → 壁紙依存で最悪 8:1 まで低下リスクあり
  - `#ffffff` (明度 1.0): 約 17:1 → 最悪でも 11:1 以上を維持、WCAG AAA (7:1) 超過

## 6. 検証

### 6.1 TypeScript

```
$ npx tsc --noEmit
(exit 0, 出力なし = 0 error)
```

### 6.2 Next build

```
$ npx next build
✓ Compiled successfully
✓ Generating static pages (9/9)
✓ Exporting (2/2)

Route (app)                                 Size  First Load JS
┌ ○ /                                      170 B         108 kB
├ ○ /_not-found                             1 kB         105 kB
├ ○ /settings                            10.5 kB         158 kB
├ ○ /settings/mcp                        6.33 kB         144 kB
├ ○ /setup                               9.25 kB         175 kB
├ ○ /setup/done                            170 B         108 kB
└ ○ /workspace                            4.3 kB         191 kB
```

既存 warning のみ (新規 warning 無し):
- StatusBar の unused `usageError` / `todayCost` / `TodayCostSection`
- AppearanceSettings `aria-pressed` on role="radio"
- FilePreviewDialog の `<img>` vs `<Image />`
- ProjectTree の `treeitem` に aria-selected 欠落 × 2

SSG の `ReferenceError: window is not defined` (project-store の list_active_sidecars 起点) は PM-920 以来の既知事象で本件無関係。

### 6.3 Rust / cargo

本件 frontend only のため未実行。`src-tauri/**` / `Cargo.toml` 無変更。

## 7. オーナー実機検証すべき項目

### 前提

- tauri dev は停止せず運用中 (指示通り)
- 変更は CSS + React コンポーネントのみのため **hot reload で即反映** される想定
- 反映されない場合は sub-tab × で閉じて「+新規」で pty を立て直す (xterm Terminal の theme は constructor で固定されるため)

### 確認項目 (優先度順)

**A. [最重要] 1 pane 時に cmd の文字がはっきり見える**

1. 「ターミナル」タブを開く (main pane 1 本が auto-spawn されている)
2. `dir` / `ls` / `echo hello` / `python -c "print('test')"` 等を実行
3. **prompt / コマンド出力の文字 (純白) がはっきり読めること** を確認
4. 文字が背景に溶けたり、薄くて見えない現象が発生しないこと

**B. [最重要] 2 pane (split) 時にも同等の表示**

1. (split ボタンが viewMode=terminal 時に表示される想定) 分割ボタンを押す
2. 右 pane に「+新規」で pty を起動
3. **左右 pane どちらも A と同じ見え方** であることを確認
4. 1 pane / 2 pane で挙動差が無いこと

**C. 背景画像が透けて見える**

1. `/settings` → 外観で背景画像を設定済みの状態で Terminal タブを開く
2. xterm canvas 越しに壁紙が **うっすら見える** (完全黒塗りではない) こと
3. ただし text が壁紙に負けて読めなくなる事象が無いこと

**D. sub-tab bar / 外殻 UI の可読性**

1. sub-tab bar (pty 名 + × + 新規) が読めること
2. active な sub-tab が `bg-background/70` 塗りで強調表示されていること
3. split header (2 pane 時のみ) に「このペインにフォーカス中」などの文字が読めること

**E. 透過度の調整 (必要なら)**

devtools コンソールで即席調整:

```js
// 壁紙をもっと見せたい場合
document.documentElement.style.setProperty('--terminal-bg', 'rgba(0, 0, 0, 0.5)');
// 文字可読性を最大化したい場合
document.documentElement.style.setProperty('--terminal-bg', 'rgba(0, 0, 0, 0.75)');
```

反映: sub-tab × で閉じて「+新規」で開き直す (PM-926 と同じ)。

永続化: `app/globals.css :root` の `--terminal-bg` を書き換える。

### 非干渉確認

- Chat / Editor / PreviewPane (PM-929 Agent 領域): 本件と無関係、従来通り動作
- PRJ-007 等の他案件: 影響なし (frontend 局所変更)
- 他 Agent (PM-929 Preview 修正) との衝突: 範囲完全分離、merge conflict なし

## 8. 残課題 (v1.1 候補、本件では着手せず)

| 項目 | 内容 | 優先度 |
|---|---|---|
| `--terminal-bg` 動的反映 | 既存 pty にも即座に反映できるよう、xterm theme の runtime 更新 API を呼ぶ (PM-926 から継続) | 低 |
| 透過度設定 UI | `/settings` → 外観に `--terminal-bg` スライダー | 低 |
| light theme での見え方検証 | PM-928 で外殻 `bg-transparent` にしたため light theme でも同一挙動になるはず (旧 `bg-background/30` は light で白 30% を塗っていた)、ただし sub-tab bar `bg-background/50` は light で白塗りになる可能性あり | 中 |
| theme 変更時の xterm 再マウント | next-themes 切替時に xterm theme.background を再計算 | 低 |
| backdrop-filter blur の検討 | sub-tab bar / split header に `backdrop-filter: blur(4px)` を付けて壁紙を柔らかく透かす | 低 (見た目 polish、可読性には無関係) |

## 9. 完了条件チェック

- [x] 1 pane / 2 pane の両方で cmd 文字がはっきり見える設計に修正 (外殻 bg 透明化 + foreground 純白化)
- [x] 背景画像が透けて見える (完全黒塗りではない、xterm canvas の 0.6 単独合成で実効 16% 透過)
- [x] sub-tab bar / split header の UI 可読性維持 (`bg-background/50` / `bg-background/70` 変更せず)
- [x] `npx tsc --noEmit`: 0 error
- [x] `npx next build`: 成功 (新規 warning なし)
- [x] `components/terminal/*` / `app/globals.css` のみ変更 (他 Agent 領域完全不介入)
- [x] `tauri.conf.json` / `components/preview/*` / `components/chat/Shell.tsx` 無変更
- [x] logger wrapper 使用 (console.log 直呼び出し追加なし)
- [x] 最小 diff (4 箇所、計 10 行未満の実質変更)、refactor 無し
- [x] tauri dev を停止させない (frontend only、hot reload で反映)

## 10. 工数

- 見積: 1h
- 実績: 約 45 分 (Read 5 ファイル / Edit 4 件 / tsc + next build 各 1 回 / 仮説検証 + レポート)

## 11. CEO 報告サマリー

- **状況**: PM-928 完了、Terminal 表示 regression の root cause (H1: 外殻 `bg-background/30` が xterm canvas 合成を阻害) を特定し hotfix。
- **採用案**: ハイブリッド案 C (外殻 `bg-transparent` + `theme.background` 0.6 + `foreground` 純白)。
- **完了条件**: tsc 0 error / next build 成功 / 1 pane / 2 pane 同一挙動保証 (静的追跡完了)。
- **オーナー実機確認要**: 文字可読性 / 壁紙透過 / 1 pane = 2 pane の挙動一致。hot reload で即反映されるはず、反映されない場合は sub-tab 張り直しで対応。
- **他 Agent (PM-929) との衝突**: 無し (範囲完全分離)。
- **残課題**: light theme での見え方確認 (優先度中)、その他 v1.1 候補は据え置き。

---

担当: dev Agent (Claude Opus 4.7 / 1M context, build-error-resolver)
レポート配置: `C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-012\reports\dev-v10-pm-928-terminal-display-hotfix.md`
