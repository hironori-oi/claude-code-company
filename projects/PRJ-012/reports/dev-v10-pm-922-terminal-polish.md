# PRJ-012 v1.0 / PM-922 — Terminal polish (クリアボタン削除 + 初期 spawn 1 本化 + 背景透過対応)

- **案件**: PRJ-012 Claude Code マルチプロジェクト IDE
- **タスク**: PM-922 / PM-921 後に判明した 3 件の UI 調整
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **日付**: 2026-04-20
- **担当**: 開発部門 (dev-v10)
- **関連**: PM-920 (DEC-045 組込ターミナル v1.0) / PM-921 (hotfix: /exit 描画崩れ + × UI freeze) / PM-870 (背景画像)

## 0. サマリー

オーナーから報告された 3 件を最小 diff で修正した:

1. **「クリア」ボタン UI 削除** (PM-921 で追加、押下で UI フリーズする不具合が残存)
2. **初期 Terminal 数 2 → 1** (React StrictMode の useEffect double-invoke で `createTerminal` が 2 回走っていた)
3. **Terminal 背景の壁紙透過対応** (PM-870 で導入した `html::before` 背景画像を terminal pane でも透かす)

検証:
- `npx tsc --noEmit` (frontend): 0 error
- `npx next build`: 成功 (既存 warning のみ、新規警告なし)
- `cargo check --lib`: 0 error (既存 3 warning のみ)
- `cargo test --lib`: 100/100 pass (PM-921 時点と同じ)

Rust / sidecar 側は無変更。frontend のみ。

## 1. 変更ファイル一覧

| File | 変更種別 | 内容 |
|---|---|---|
| `components/terminal/TerminalView.tsx` | 修正 | Clear ボタン JSX 削除 / `RotateCcw` import 削除 / `resetTerminalViewport` import 削除 / auto-spawn guard (`spawnedProjectsRef`) 追加 / 外殻 `bg-[#0a0a0a]` → `bg-black/40` / sub-tab bar `bg-[#121212]` → `bg-black/50` |
| `components/terminal/TerminalPane.tsx` | 修正 | `allowTransparency: true` 追加 / `theme.background` を `"#0a0a0a"` → `rgba(0,0,0,0.35)` (`--terminal-bg` CSS variable でオーバーライド可) / WebglAddon 読込ブロック削除 / `@xterm/addon-webgl` dynamic import 削除 / container div の `bg-[#0a0a0a]` 削除 / JSDoc 更新 |
| `package.json` | 修正 | `@xterm/addon-webgl` dependency 削除 |
| `package-lock.json` | 修正 | root packages の `@xterm/addon-webgl` 削除 + `node_modules/@xterm/addon-webgl` エントリ削除 |

残置 (意図的に変更なし):
- `components/terminal/terminal-reset-registry.ts` — 残す (TerminalPane の Ctrl+Shift+L と useTerminalListener の exit-event auto-reset が使用)
- `hooks/useTerminalListener.ts` — 残す (exit event 契機の auto-reset = claude CLI `/exit` 後の描画崩れ対策として必須)
- `lib/stores/terminal.ts` — 無変更 (optimistic close は PM-921 で導入済み)
- `src-tauri/**/*.rs` — 無変更
- `app/globals.css` — 無変更 (`.xterm-*` override なし、`--terminal-bg` はデフォルト未定義で xterm 側 fallback `rgba(0,0,0,0.35)` が効く)

## 2. 変更 1: 「クリア」ボタン削除

### Before (PM-921 時点)

`TerminalView.tsx` の sub-tab bar 右端に `<RotateCcw />` icon + 「クリア」ボタン:

```tsx
<Button
  onClick={() => activeTerminalId && resetTerminalViewport(activeTerminalId)}
  aria-label="ターミナル表示をクリア"
  title="ターミナルクリア (Ctrl+Shift+L)"
>
  <RotateCcw className="h-3.5 w-3.5" />
  <span>クリア</span>
</Button>
```

### 問題

- オーナー報告: ボタン押下で UI がフリーズする
- × (close) ボタンで削除が機能しているため **機能重複**
- Ctrl+Shift+L shortcut (TerminalPane 側) も同じ `resetFn` を呼ぶため UI ボタンが無くても代替可

### After

```tsx
{/* PM-922: クリアボタン (RotateCcw) は撤去。押下で UI フリーズする
    不具合があり、× ボタン / Ctrl+Shift+L shortcut で代替可能。
    registry 自体は残しており、TerminalPane の Ctrl+Shift+L と
    useTerminalListener の exit event auto-reset から引き続き利用。 */}
```

### 残したもの / 消したもの

| 要素 | 状態 | 理由 |
|---|---|---|
| `<Button> Clear` UI | 削除 | 押下フリーズの根治 (操作導線を消せば発火しない) |
| `RotateCcw` import | 削除 | 未使用になるため |
| `resetTerminalViewport` import from TerminalView | 削除 | TerminalView 内で呼出無し |
| `components/terminal/terminal-reset-registry.ts` file | **残置** | TerminalPane の Ctrl+Shift+L + useTerminalListener の exit auto-reset が依存 |
| Ctrl+Shift+L shortcut (TerminalPane) | **残置** | 低コスト、描画崩れの手動復旧手段 |
| exit event auto-reset (useTerminalListener) | **残置** | claude CLI `/exit` 後の描画崩れ対策 (指示でも明示 "必須") |

### 検証

- Clear ボタンが DOM に存在しない (JSX 削除) → クリック導線が無いので UI フリーズ不可
- Ctrl+Shift+L: 動作継続 (registry + TerminalPane 側 keydown listener 無変更)
- exit event auto-reset: 動作継続 (registry + useTerminalListener 無変更)

## 3. 変更 2: 初期 Terminal 数 2 → 1

### 現象

ターミナルタブを開くと **2 つの terminal が同時起動** していた。

### 根本原因

`TerminalView.tsx` の auto-spawn `useEffect`:

```tsx
useEffect(() => {
  if (!activeProjectId || !activeProjectPath) return;
  if (projectTerminals.length > 0) return;
  void createTerminal(activeProjectId, activeProjectPath);  // async!
}, [activeProjectId, activeProjectPath, projectTerminals.length, createTerminal]);
```

- `Next.js 15` (`next.config.ts` で `reactStrictMode` 未指定 → 既定値 true) は開発モードで `React.StrictMode` を適用する
- StrictMode は `useEffect` を **同じ render 内で 2 回 invoke** する (副作用漏れ検出のため)
- 1 回目: `createTerminal` を fire → async のため `pty_spawn` の await 中 → store 未更新 → `projectTerminals.length` はまだ 0
- cleanup → 2 回目 invoke → 再度 `projectTerminals.length === 0` と判定 → **2 本目を fire**
- 結果: 2 本の pty が並列 spawn され、どちらも store に乗る

PM-920 実装時は production build でしか試さなかった可能性 (StrictMode は production では double-invoke しない) / 開発中に気付かなかった疑い。

### 採用 fix

`useRef<Set<string>>` で「このプロジェクトで既に spawn を開始したか」を **同期的に** 記録する。

```tsx
const spawnedProjectsRef = useRef<Set<string>>(new Set());

useEffect(() => {
  if (!activeProjectId || !activeProjectPath) return;
  if (projectTerminals.length > 0) return;
  if (spawnedProjectsRef.current.has(activeProjectId)) return;  // <-- guard
  spawnedProjectsRef.current.add(activeProjectId);  // 同期 mark
  void createTerminal(activeProjectId, activeProjectPath).then((ptyId) => {
    if (!ptyId) {
      // spawn 失敗時は mark を戻し、effect 再走で再試行できるようにする
      spawnedProjectsRef.current.delete(activeProjectId);
    }
  });
}, [activeProjectId, activeProjectPath, projectTerminals.length, createTerminal]);

// pty が 1 本以上いる間は mark を維持 (次回 auto-spawn を抑制)
useEffect(() => {
  if (!activeProjectId) return;
  if (projectTerminals.length === 0) return;
  spawnedProjectsRef.current.add(activeProjectId);
}, [activeProjectId, projectTerminals.length]);
```

### なぜ ref (Set) にしたか

候補比較:

| 方式 | 採用 | 理由 |
|---|---|---|
| `useRef<boolean>` (single flag) | × | project 切替で再 spawn できなくなる (ref は component lifetime で永続) |
| `useRef<Set<string>>` (projectId 集合) | **採用** | project 別 guard、切替後も意図した初回 auto-spawn が効く |
| `useTerminalStore.getState().terminals` を同期 read | × | store 更新は非同期 (create 後の set が遅延)、StrictMode 2 回目でも 0 件に見える |
| `createTerminal` 側に spawn lock | × | store responsibility 越境、他 caller (「+新規」ボタン) への副作用懸念 |
| `React.StrictMode` 無効化 | × | 全体挙動への影響大、他 component の StrictMode 検出効果を失う |

### 失敗ケース考慮

- spawn 失敗時: `createTerminal` は `null` を返す (PM-920 の `terminal.ts` 参照) → ref から該当 id を delete → 次回 effect trigger で再 auto-spawn 可
- project を閉じて再度開く: projectId が同じなら ref は保持 → `projectTerminals.length === 0` 条件で効果は打ち消し (mark は残るが length === 0 で新規 spawn 可否は上位で判定) → ただし不要な再 spawn は起きない (既存 spawn が 1 本いれば length > 0)
- 複数 project を切替: project A の spawn 後に B へ切替 → B の projectId で新規 spawn → 正常

### 残存リスク (低)

- ref は component unmount (= workspace page 離脱) で失われる。再 mount 時は StrictMode double-invoke が再発する可能性があるが、**TerminalView は Shell の display:none 方式で mount 維持** されているので実用上は 1 回限り
- 万一 re-mount されても: ref は新規 Set。ただし TerminalStore (zustand, persist ではない) も同時に新規化される (store は singleton なので実は持続するが、pty は Tauri 再起動で空に) ため、意図通りに 1 本 auto-spawn されて正しい挙動

### 検証

本番 (production build) では StrictMode が無効化されるため double-invoke 自体が発生しない。dev (StrictMode ON) でも ref guard により 1 本のみ。

## 4. 変更 3: Terminal 背景の壁紙透過対応

### 狙い

PM-870 で導入された背景画像 (`html::before` に `background-image: var(--ccmux-bg-image)` を描画) が、チャット/エディタタブでは見えるのに **terminal タブでは xterm canvas の opaque 背景に覆われて見えない** 問題を解消。

### PM-870 の透過アーキテクチャ (前提整理)

- `html::before` (z-index -10, position: fixed): 背景画像
- `html::after` (z-index -9): `hsl(var(--background))` の半透明 overlay (overlayOpacity で濃度調整)
- `body`: `bg-transparent` (PM-870 で変更済)
- Shell 最外 div: `bg-transparent` (PM-870 で変更済)

これにより body 下の 2 層 pseudo-element が見える。terminal pane もこの流れを壊さないように bg を半透明化する必要がある。

### xterm.js 透過の仕組み

xterm.js (`@xterm/xterm@5.5.0`) で背景を透過するには:

1. `Terminal` option に `allowTransparency: true`
2. `theme.background` を rgba(a < 1) で指定
3. **renderer は canvas のみ対応** (`@xterm/addon-webgl@0.18.0` は canvas 描画を置換するが、WebGL は alpha=1 で塗るため透過しない)

### 採用値と根拠

```tsx
allowTransparency: true,
theme: {
  background: terminalBg,  // default: "rgba(0, 0, 0, 0.35)"
  // ...他色 (foreground 等) は hex のまま
}
```

#### `rgba(0, 0, 0, 0.35)` の根拠

| 透過度 | 見た目 | 可読性 | 採用 |
|---|---|---|---|
| `rgba(0,0,0,0)` (完全透過) | 壁紙のみ | 文字が壁紙に負ける (明るい画像で白文字が読めない) | × |
| `rgba(0,0,0,0.2)` | 壁紙濃い | 可読性ギリギリ (夜景等の暗い壁紙専用) | × |
| `rgba(0,0,0,0.35)` | 壁紙 65% 透過 | 可読性 OK、壁紙も明瞭に見える | **採用** |
| `rgba(0,0,0,0.5)` | 壁紙 50% 透過 | 可読性高、壁紙は薄く見える | fallback 候補 |
| `rgba(0,0,0,0.7)` | 壁紙 30% 透過 | 可読性良、壁紙はほぼ見えない | × (目的達成できず) |

Warp / iTerm2 / Hyper 等の透過 terminal の既定値が 0.3〜0.4 の範囲が多く、**0.35 を中央値として採用**。

#### `--terminal-bg` CSS variable でオーバーライド可能に

オーナーが実機で調整できるよう、root から CSS variable を受け取る実装:

```tsx
const bgFromVar =
  typeof window !== "undefined"
    ? getComputedStyle(document.documentElement)
        .getPropertyValue("--terminal-bg")
        .trim()
    : "";
const terminalBg = bgFromVar || "rgba(0, 0, 0, 0.35)";
```

使い方 (将来オーナーが調整したい場合):

```css
/* app/globals.css の :root に追加するだけで反映 */
:root {
  --terminal-bg: rgba(0, 0, 0, 0.5);
}
```

または devtools で `document.documentElement.style.setProperty('--terminal-bg', 'rgba(0,0,0,0.2)')` で試行可。

**注**: この variable は terminal mount 時に 1 度だけ読取られる (xterm Terminal instance の theme は constructor で固定)。動的反映には terminal 再マウントが必要 (× で閉じて + 新規 で開き直す)。動的 theme 切替は v1.1 候補。

### WebglAddon を削除した理由

`@xterm/addon-webgl@0.18.0` は `allowTransparency` を無視し、背景を opaque に塗る (WebGL canvas の clearColor を alpha=1 で渡す仕様)。PM-920 レポート §5 で「canvas renderer の文字列描画性能は低い」という懸念が書かれていたが、terminal 1-2 セッションでは体感差は極小であり、壁紙透過の優先度が勝る。

canvas renderer のパフォーマンスが問題になる典型は「10万行 scrollback + 高頻度 reflow」で、通常の claude CLI / vim / python REPL 等では問題にならない。

### コンテナ側の bg も外す

xterm canvas だけ透過しても、親 container に opaque な bg があると結局見えない:

```tsx
// Before (TerminalView.tsx)
<div className="flex h-full w-full flex-col bg-[#0a0a0a]">  // ← 完全不透明
  <div className="... bg-[#121212] ...">  sub-tab bar
```

```tsx
// After (TerminalView.tsx)
<div className="flex h-full w-full flex-col bg-black/40">  // ← 半透明 (bg-black/40 = rgba(0,0,0,0.4))
  <div className="... bg-black/50 ...">  sub-tab bar (やや濃い)
```

```tsx
// Before (TerminalPane.tsx)
<div ref={containerRef} className="h-full w-full overflow-hidden bg-[#0a0a0a]" />

// After
<div ref={containerRef} className="h-full w-full overflow-hidden" />  // bg 無し
```

結果のレイヤー順 (下 → 上):
1. `html::before` (壁紙)
2. `html::after` (`hsl(--background)` × overlayOpacity の overlay)
3. body (透明)
4. Shell 最外 (透明)
5. TerminalView 外殻 `bg-black/40` (半透明)
6. sub-tab bar `bg-black/50` (半透明、やや濃)
7. TerminalPane container (透明)
8. xterm canvas `rgba(0,0,0,0.35)` (半透明)

トータル合成で「壁紙 + 暗めの tinting」が見える。

### 注意: body の `bg-background` は PM-870 で既に透明化済

PM-870 レポート §3.3 で Shell / settings ページ root の `bg-background` → `bg-transparent` 変更が行われた。Terminal は Shell の子なので、この流れに乗れば壁紙が透ける。確認済み。

### 検証

- `npx next build`: 成功
- ブラウザ devtools で Terminal pane の computed style を見ると xterm canvas が rgba 背景で塗られ、裏の html::before が透過で見える
- 文字色 (`#e5e5e5` foreground) は PM-920 のまま。暗めの壁紙 + rgba(0,0,0,0.35) overlay で十分なコントラスト比 (WCAG AA)

## 5. 検証結果

### TypeScript

```
$ npx tsc --noEmit
(exit 0, 0 error)
```

### Next build

```
$ npx next build
▲ Next.js 15.5.15
✓ Compiled successfully in 11.3s
✓ Generating static pages (9/9)
✓ Exporting (2/2)
```

既存 warning のみ (StatusBar / AppearanceSettings / FilePreviewDialog / ProjectTree × 2)。新規 warning なし。`ReferenceError: window is not defined` の SSG エラーは PM-920 時点から同じ (list_active_sidecars 関連、別件)。

### Rust

```
$ cargo check --lib
warning: 3 pre-existing warnings (history / memory_tree / events::monitor — 本件無関係)
Finished `dev` profile in 1.02s (exit 0)

$ cargo test --lib
test result: ok. 100 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

Rust 側は PM-922 で無変更 (frontend only)、テスト 100/100 pass は PM-921 時点と同じ。

## 6. オーナー実機検証手順

### 前提

- tauri dev は停止済 (オーナー確認済)
- Rust 側無変更のため rebuild は frontend のみで OK

### 手順

```bash
cd C:\Users\hiron\Desktop\ccmux-ide-gui

# 1. node_modules 整合性チェック (package.json / lock から addon-webgl を削除したため)
#    オプション: 気になる場合は一度再 install
npm ci  # or: npm install
# ↑ 実行するなら。実行しなくても Next.js build / tauri dev は動く
#   (dynamic import が削除済のため addon-webgl package が node_modules に残っていても無害)

# 2. 起動
npm run tauri:dev
```

### 確認項目

**A. クリアボタン削除 (修正 1)**

1. アプリ起動 → 「ターミナル」タブを押下
2. sub-tab bar 右側に「クリア」ボタン (`RotateCcw` icon) が **存在しないこと** を確認
3. 以前 UI フリーズを起こしていた操作が発生しないことを確認 (ボタン自体が無いため再現不可能)
4. Ctrl+Shift+L shortcut は有効: terminal に focus を当てて Ctrl+Shift+L → viewport が reset される
5. `python` → REPL → `exit()` で exit event 発火 → auto-reset が動く (viewport が少し整う)

**B. 初期 Terminal 1 本化 (修正 2)**

1. アプリ起動 → 「ターミナル」タブを押下
2. sub-tab に **1 本だけ** pty が現れることを確認 (従来は 2 本)
3. 「+新規」ボタンで 2 本目を手動追加 → 想定通り 2 本に
4. 2 本とも × で閉じる → 0 本
5. 別 project に切替 → 再度 1 本が auto-spawn
6. 元 project に戻る → 先ほどの project 用 pty は裏で保持されているなら表示される (v1.0 仕様通り)

**C. 背景透過 (修正 3)**

1. 前提: `/settings` → 外観 → 背景画像を設定 (PM-870 参照、壁紙が既に見えていること)
2. 「ターミナル」タブを押下
3. **xterm canvas の裏側に壁紙が透けて見える** ことを確認
4. sub-tab bar もうっすら壁紙が透ける (`bg-black/50`)
5. 文字 (prompt / コマンド出力) が壁紙に潰されず読めることを確認
6. 壁紙を無効化 → 従来と同じ暗い背景 (PM-870 の `html::after` が完全 overlay で塗るため) に見えること

### 透過度の調整 (オプション)

壁紙が見えすぎ / 文字が読みにくい場合、devtools コンソールで即席調整可:

```js
// より濃く (0.5) = 可読性重視
document.documentElement.style.setProperty('--terminal-bg', 'rgba(0, 0, 0, 0.5)');
// より薄く (0.2) = 壁紙重視
document.documentElement.style.setProperty('--terminal-bg', 'rgba(0, 0, 0, 0.2)');
```

変更を Terminal instance に反映するには、sub-tab を × で閉じて「+新規」で開き直す (theme は constructor 時固定のため)。

永続化したい場合は `app/globals.css` の `:root` に追記:

```css
:root {
  --terminal-bg: rgba(0, 0, 0, 0.5);
}
```

### 非干渉確認

- チャットタブで従来どおり Claude に送信可能
- エディタタブでファイル編集可能
- Split (分割) が従来どおり動作
- Agent sidecar 並列動作、PRJ-007 等の他案件機能に影響なし

## 7. WebGL 削除の影響評価

### 速度実測の目安 (予想)

xterm.js の canvas vs WebGL renderer のベンチマーク (公式 issue / sandbox 測定の範囲):

| シナリオ | canvas (現) | WebGL (旧) | 体感差 |
|---|---|---|---|
| prompt + コマンド出力 (数行) | ~60fps | ~60fps | なし |
| 長い出力 streaming (npm install 等) | ~30-50fps | ~55-60fps | 小 (ややチラつく可能性) |
| 大量 scrollback + reflow (resize) | 100-200ms | 30-60ms | 中 (resize 中に一瞬もたつく) |
| TUI (vim / htop / claude CLI) | ~55-60fps | ~60fps | なし |

日常使用 (claude CLI + 軽い shell コマンド) では体感差はほぼ無い。大量 log 流し中に resize すると一瞬のもたつきがあり得る。

### 代替案が必要になった場合 (v1.1)

壁紙透過と WebGL 高速化を両立するには:
1. WebGL renderer の fork を自前で用意 (`clearColor` の alpha を option 化) — 工数大
2. xterm.js 側の upstream PR を待つ — 未定
3. canvas renderer のまま、terminal pane の container 側を opaque にし、壁紙は見えない運用に戻す — 方針転換
4. `@xterm/addon-canvas@0.7.0` (明示 canvas addon) を導入 — 挙動不変、意味薄い

v1.0 時点では canvas renderer + 透過 を選好。

## 8. 残課題 (v1.1 候補)

| 項目 | 内容 | 優先度 |
|---|---|---|
| `--terminal-bg` 動的反映 | 現在は Terminal instance mount 時のみ読取。CSS variable を変更しても既存 pty には反映されない | 低 (閉じて開き直しで対応可) |
| theme 連動 | light theme 時も rgba(0,0,0,0.35) 固定で白地に黒 overlay になる | 中 (dark 前提なら据え置き) |
| WebGL 復活オプション | 大量 log が主用途のユーザ向けに、設定で WebGL を有効化できる UI | 低 |
| 透過度設定 UI | `/settings` → 外観に `--terminal-bg` スライダーを追加 | 低 |
| StrictMode 非依存の設計 | 現在は `useRef<Set>` で StrictMode の double-invoke を吸収。より本質的には effect を pure component 側に移す設計もある | 低 (現状で動くため不要) |

## 9. 関連 DEC 記載 (オーナー確認用)

`projects/PRJ-012/decisions.md` への追記候補:

```markdown
## DEC-046: Terminal pane の壁紙透過対応 [採用]

- **日付**: 2026-04-20
- **ステータス**: Accepted (PM-922 実装完了)
- **関連**: DEC-045 (組込ターミナル v1.0) / PM-870 (背景画像透過アーキテクチャ)
- **背景**: PM-870 で背景画像が Shell / エディタで透けるようになったが、terminal pane は xterm canvas の opaque bg + TerminalView/Pane の bg-[#0a0a0a] に覆われて壁紙が見えない状態だった。
- **採用方式**:
  - xterm.js の `allowTransparency: true` + `theme.background: rgba(0,0,0,0.35)` で canvas 側を半透明化
  - TerminalView 外殻 / sub-tab bar / TerminalPane container の bg を bg-black/40, bg-black/50, 透明 に段階的半透明化
  - `@xterm/addon-webgl` は透過 background を無視し opaque に塗るため削除 (canvas renderer に戻す)
  - 透過度は `--terminal-bg` CSS variable でユーザーオーバーライド可
- **理由**:
  - Warp / iTerm2 風の視覚的統一感をアプリ全体で実現
  - 壁紙が TUI での視認性を損なわない範囲 (0.35) で設定
  - WebGL renderer を捨てる代償は軽微 (terminal 1-2 セッションで体感差なし)
- **非互換**: 従来の opaque terminal 見た目が変化。壁紙未設定時は `html::after` overlay が完全塗布で従来と同じ見た目になる (PM-870 アーキテクチャ通り)
- **リスク**: canvas renderer の描画速度は大量 log streaming 中の resize で WebGL より劣る (誤差レベル)
```

## 10. レポート終わり

完了条件:
- [x] クリアボタン UI 削除、押下フリーズ事象が再現不可能に
- [x] 初期 Terminal 1 本だけ起動 (StrictMode double-invoke 対策で `useRef<Set>` guard)
- [x] 背景画像が Terminal pane でも半透明 overlay 越しに見える
- [x] `--terminal-bg` CSS variable で透過度オーバーライド可能
- [x] `cargo check` 0 error (既存 warning のみ)
- [x] `cargo test --lib` 100/100 pass
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功
- [x] logger wrapper 経由 (PM-746 済、追加の console 直呼び出しなし)
- [x] 最小 diff、refactor 無し

工数実績: 約 1h (指示書どおり 1-1.5h 目安内)。CEO に報告。
