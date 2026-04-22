# PRJ-012 v1.2 / PM-947 Terminal Keyboard Shortcut 拡充

**日付**: 2026-04-20
**対象 branch**: `v1.2-dev`
**対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
**目的**: Cursor / VSCode 相当の生産性を組込 Terminal (xterm.js) にも確保する

---

## 追加した hotkey 一覧

全て **xterm.js canvas に focus がある時のみ** 有効化される。Chat / Editor / Sidebar に focus がある時は従来どおり別機能（例: Ctrl+Shift+F は SearchPalette）が動作する。

| shortcut | 動作 | 実装 |
|---------|------|------|
| Ctrl/Cmd + Shift + F | Terminal 内検索 (scrollback 全体) | xterm-addon-search `findNext/findPrevious` + 専用 overlay |
| Ctrl/Cmd + Shift + C | 選択範囲を clipboard にコピー | `term.getSelection()` → `navigator.clipboard.writeText` |
| Ctrl/Cmd + Shift + V | clipboard から paste | `navigator.clipboard.readText` → `pty_write` |
| Ctrl/Cmd + Shift + K | Terminal viewport クリア (scrollback は保持) | `term.clear()` |
| Ctrl/Cmd + Shift + N | 同 pane に新規 Terminal 起動 | `useTerminalStore.createTerminal(projectId, cwd, undefined, paneId)` |
| Ctrl/Cmd + Shift + W | 現在 Terminal を close | `useTerminalStore.closeTerminal(ptyId)` |
| Ctrl + Tab | 同 pane 内で次 Terminal に切替 | `siblings` 配列で index 計算 + `setActiveTerminal` |
| Ctrl + Shift + Tab | 同 pane 内で前 Terminal に切替 | 同上 (direction = -1) |
| Ctrl/Cmd + Shift + L (既存 PM-921) | viewport reset (alt screen 残留復旧) | 既存動作維持 |

---

## 実装ポイント

### 1. xterm.js の `attachCustomKeyEventHandler` で一元化

Terminal focus 時のみ発火させるため、document level の `useHotkeys` ではなく xterm.js の公式 hook `attachCustomKeyEventHandler` を利用する方式を採用した。

```ts
term.attachCustomKeyEventHandler((ev) => {
  if (ev.type !== "keydown") return true;
  // Ctrl+Shift+F / C / V / K / N / W + Ctrl+Tab を handle
  // 該当時は preventDefault + stopPropagation + return false
});
```

**効果**:
- `return false` で xterm の文字入力処理 (`onData` → `pty_write`) が skip される → shell に余計な control sequence が送られない
- `stopPropagation` で document level の `useHotkeys` (SearchPalette の `mod+shift+f`) に到達しない
- `preventDefault` で webview (Tauri 内蔵 browser) の既定動作 (Ctrl+Tab タブ切替など) を抑止

### 2. xterm-addon-search の UI 設計

- **package.json**: `@xterm/addon-search@^0.16.0` を追加 (既存 `@xterm/addon-fit@^0.10.0` と同 family)
- **mount**: `TerminalPane.tsx` の useEffect 内で dynamic import → `term.loadAddon(new SearchAddon())` → ref に保持
- **overlay**: Terminal pane の右上に絶対配置。`position:absolute, right:2, top:2, z-10`, backdrop-blur-sm, border-border/50
- **操作**:
  - Enter: 次を検索 (`findNext`)
  - Shift+Enter: 前を検索 (`findPrevious`)
  - Esc: close + `clearDecorations()` + term に focus 戻す
  - Ctrl+Shift+F 再押下: toggle close
  - ↑ / ↓ / × ボタンで GUI 操作も可能 (accessibility 配慮)
- **入力時のフィルタ**: input field では xterm handler は動かないので、input 側で独自に `onKeyDown` 処理

### 3. Ctrl+Tab の Ring buffer 動作

```ts
const siblings = Object.values(state.terminals)
  .filter((t) => t.projectId === current.projectId &&
                (t.paneId ?? TERMINAL_DEFAULT_PANE_ID) === paneId)
  .sort((a, b) => a.startedAt - b.startedAt);
const nextIdx = (idx + direction + siblings.length) % siblings.length;
```

- 同 `projectId` + 同 `paneId` 内のみを巡回 (別 pane の terminal は除外)
- 巡回順は `startedAt` 昇順 (sub-tab 表示順と一致)
- siblings が 1 個以下なら no-op

### 4. 既存 hotkey との衝突回避策

| 衝突対象 | 対応 |
|---------|------|
| **Ctrl+Shift+F** (SearchPalette PM-231) | xterm handler が先に `stopPropagation` するため、document level の `useHotkeys("mod+shift+f")` に到達しない。他の画面では従来どおり会話検索が開く。 |
| **Ctrl+Tab** (browser 既定タブ切替) | `preventDefault` で Tauri webview の既定動作を抑止。Tauri 2.x の webview は Chromium 相当だが、Ctrl+Tab は SPA routing に影響しない (tab UI が OS 側に無い) ので実害は無い。 |
| **Ctrl+Shift+L** (PM-921 reset) | `attachCustomKeyEventHandler` 内で `return false` のみ (動作は既存 container keydown listener に委譲)。xterm に "L" 文字入力が流れる事故を防ぐ。 |
| **Ctrl+Shift+V** (他部 paste 系) | Chat 側の画像 paste は `Ctrl + V` (Shift なし) なので非衝突。Terminal 内のみ `Ctrl+Shift+V` が clipboard text paste として動く。 |
| **Ctrl+Shift+C/V** (chat 側の通常 copy/paste) | chat は browser native の Ctrl+C/V を使う (Shift なし)。Terminal は Ctrl+Shift+C を使う理由が shell 側 Ctrl+C が SIGINT だから。衝突なし。 |

### 5. Clipboard API 利用

- `navigator.clipboard.writeText` / `readText` を利用 (Tauri plugin-clipboard-manager は使わない)
  - webview では navigator.clipboard が直接使える
  - Tauri plugin を使うと allowlist 設定が必要になるが、現行 `tauri.conf.json` には未登録
- 失敗時は `logger.warn` で silent fail (UX を壊さない)

### 6. 最小 diff 方針

- `TerminalPane.tsx`: 既存 useEffect の構造は温存 (term 初期化 / ResizeObserver / pendingWrites / PM-941 registerActiveTerminal は無変更)
- 追加点: import 3 行 / 新規 state 2 つ / 新規 useCallback 4 つ / useEffect 内で `SearchAddon` load + `attachCustomKeyEventHandler` / JSX に search overlay 追加
- `HelpDialog.tsx`: Terminal section を 1 つ追記
- `package.json`: dependency 1 行追加
- Rust / sidecar / store 無変更

---

## 変更ファイル

```
M components/terminal/TerminalPane.tsx      (+280 lines, 1 section の新規追加)
M components/chat/HelpDialog.tsx            (+48 lines, Terminal shortcut section)
M package.json                              (+1 line, @xterm/addon-search)
M package-lock.json                         (auto-regenerated)
```

Rust / `src-tauri/**` は **無変更**。

---

## ビルド検証

```
$ npx tsc --noEmit
(0 error)

$ npx next build
 ✓ Compiled successfully
 ✓ Linting and checking validity of types
 ✓ Generating static pages (7/7)
Route (app)                                 Size  First Load JS
└ ○ /workspace                           6.42 kB         202 kB
```

- TypeScript: 0 error
- ESLint: 0 error (警告は cycleTerminal の exhaustive-deps のみ、`eslint-disable-next-line` で抑制済)
- Next.js build: success
- Bundle size impact: `/workspace` route は +0.02 kB (addon-search が dynamic import で chunk 分割)

---

## オーナー実機検証手順

### 前提
```
cd C:\Users\hiron\Desktop\ccmux-ide-gui
npm install      (package-lock 更新確認)
npm run tauri:dev
```

### テストシナリオ

1. **検索 (Ctrl+Shift+F)**
   - Terminal で `ls` など大量出力を実行
   - Terminal を click して focus
   - Ctrl+Shift+F 押下 → 右上に検索 overlay が出る
   - `.md` と打つ → 最初の match にハイライト + scroll
   - Enter で次、Shift+Enter で前
   - Esc で close、ハイライト消滅、Terminal に focus 戻る
   - **Chat 入力欄に focus を当てて Ctrl+Shift+F** → 従来通り会話検索 (SearchPalette) が開くこと

2. **Copy / Paste (Ctrl+Shift+C / V)**
   - Terminal で `echo hello world` を実行
   - マウスドラッグで "hello world" を選択
   - Ctrl+Shift+C → OS clipboard に "hello world" がコピーされる (メモ帳で確認可)
   - Terminal 内で Ctrl+Shift+V → prompt に "hello world" が貼られる

3. **Clear (Ctrl+Shift+K)**
   - 大量出力後、Ctrl+Shift+K → 画面クリア、scrollback は残る (マウスホイールで戻れる)
   - Ctrl+Shift+L (従来) → viewport reset + scroll 全消去 の挙動違いが確認できる

4. **新規 / 閉じる (Ctrl+Shift+N / W)**
   - Terminal focus 状態で Ctrl+Shift+N → 同 pane の sub-tab bar に `#2` が追加される
   - Ctrl+Shift+W → 現在 sub-tab が close される (×ボタン押下と同じ効果、pty_kill も実行)

5. **Tab 切替 (Ctrl+Tab)**
   - `#1` / `#2` / `#3` を作った状態で Ctrl+Tab → `#1 → #2 → #3 → #1 ...` 循環
   - Ctrl+Shift+Tab → 逆方向循環
   - 1 つしか無い時は no-op (副作用なし)

6. **他画面への影響無し確認**
   - Chat に focus → Ctrl+Shift+F で SearchPalette 開く (既存通り)
   - Editor に focus → 通常の Monaco hotkey が従来通り動く
   - Terminal 非表示時 (chat view) に Ctrl+Tab → browser 動作に任せる (Tauri webview では no-op のはず)

### 既知の挙動

- **Windows cmd.exe**: `term.clear()` 後に prompt 再描画されないため、画面は空のまま次の enter で prompt が戻る。bash / powershell は `\f` で再描画される。
- **macOS**: Cmd+Shift+F / Cmd+Shift+V も Ctrl と同等に動作 (useHotkeys の `mod` と同じ判定)。`ev.metaKey || ev.ctrlKey` で両方扱い。
- **選択範囲が空で Ctrl+Shift+C**: clipboard 書込を skip (既存 clipboard 内容を保持)

---

## 完了条件チェック

- [x] xterm-addon-search の dependency 追加
- [x] Terminal focus 時のみ有効な 7 種類の hotkey 実装
- [x] 既存 Ctrl+Shift+F (SearchPalette) / Ctrl+Shift+L (PM-921) と非衝突
- [x] HelpDialog に「ターミナル内ショートカット」section 追加
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功
- [x] Rust / sidecar 無変更

---

## 参考

- 変更対象: `C:\Users\hiron\Desktop\ccmux-ide-gui\components\terminal\TerminalPane.tsx`
- 変更対象: `C:\Users\hiron\Desktop\ccmux-ide-gui\components\chat\HelpDialog.tsx`
- 変更対象: `C:\Users\hiron\Desktop\ccmux-ide-gui\package.json`
- 既存 SearchPalette: `C:\Users\hiron\Desktop\ccmux-ide-gui\components\palette\SearchPalette.tsx`
- 既存 PM-921 reset: `TerminalPane.tsx` 内 `handleKeydown` (Ctrl+Shift+L)

工数: 約 2h (調査 0.5h + 実装 1h + ビルド検証 + レポート 0.5h)。
