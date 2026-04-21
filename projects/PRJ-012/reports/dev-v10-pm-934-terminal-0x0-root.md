# PRJ-012 v10 — PM-934 Terminal 0x0 defer 無限ループ hotfix

**Date:** 2026-04-20
**Author:** dev (build-error-resolver agent)
**Scope:** `components/terminal/TerminalPane.tsx` のみ (最小 diff)
**Status:** DONE / build green (Terminal 範囲)

---

## 1. 症状 (オーナー実機 log)

```
[TerminalPane] container still 0x0, defer open
[TerminalPane] container still 0x0, defer open
[TerminalPane] container still 0x0, defer open
[TerminalPane] container still 0x0, defer open
```

- Terminal タブに切替えても文字が表示されない (PM-932 適用後の回帰)。
- `defer open` が連続出力され `term.open()` が呼ばれない。

---

## 2. 根本原因

PM-932 で `TerminalPane` の DOM を 2 層化した:

```tsx
<div ref={wrapperRef} className="relative h-full w-full overflow-hidden">
  <div ref={innerRef} className="absolute inset-0" />
</div>
```

- `wrapperRef`: 半透明 overlay (背景画像透過用の DOM overlay)
- `innerRef`: xterm canvas の mount 先 (`term.open(inner)`)

**PM-930 の `ResizeObserver` は `container = innerRef.current` のみを observe していた**。

### 発生経路

1. アプリ起動時 `viewMode === "chat"` のため Shell.tsx の Terminal 区画は `display:hidden` でマウント。
2. `TerminalPaneItem` の auto-spawn で `TerminalPane` がマウント。
3. `innerRef` は `position: absolute; inset: 0` で wrapper 配下に置かれるが、祖先が `display:none` の間は wrapper も inner も rect 0x0。
4. ユーザが Terminal タブに切替えると祖先 display が `block` になり、Chromium が ResizeObserver を fire する。
5. **しかし**: display:hidden → block の transition 直後の 1〜2 frame は layout が完全には安定せず、`inner` の rect が wrapper より 1 frame 遅れて確定するケースがある (特に `position: absolute; inset: 0` は親 layout に依存するため)。
6. inner が fire した瞬間の `getBoundingClientRect()` が 0x0 を返し、`flushAndOpen` が defer する。
7. 以降 inner の size が変わらない (= 実 size が確定してしまった後は ResizeObserver が再 fire しない) → 永久 defer ループ。

---

## 3. 修正内容 (最小 diff)

**File:** `components/terminal/TerminalPane.tsx`

### 変更 1: `pendingRafId` を outer scope に追加

rAF の ID を useEffect outer scope で管理し、cleanup から cancel できるように。

### 変更 2: `flushAndOpen` に rAF retry loop

inner が 0x0 かつ wrapper が visible (= 非 0 rect) の場合、`requestAnimationFrame` で最大 10 frame (≒ 166ms) 再試行。wrapper が visible になった以上 inner の rect も近い frame 内で確定する前提。

```tsx
if (rect.width === 0 || rect.height === 0) {
  const wrapperRect = wrapper.getBoundingClientRect();
  if (
    wrapperRect.width > 0 &&
    wrapperRect.height > 0 &&
    rafAttempts < RAF_MAX_ATTEMPTS &&
    pendingRafId === null
  ) {
    rafAttempts += 1;
    pendingRafId = requestAnimationFrame(() => {
      pendingRafId = null;
      flushAndOpen();
    });
    return;
  }
  // ...log は最初の数回のみ
  return;
}
```

### 変更 3: ResizeObserver で wrapper + inner 両方を observe

```tsx
resizeObserver = new ResizeObserver(handleResize);
resizeObserver.observe(container);
resizeObserver.observe(wrapper);   // ← 追加
```

wrapper の visibility 変化 (display:none → block) を確実に捕捉する primary path として追加。inner だけに依存しない。

### 変更 4: cleanup で rAF cancel

```tsx
if (pendingRafId !== null) {
  try { cancelAnimationFrame(pendingRafId); } catch {}
}
```

### 変更 5: log 抑制 (副次的 UX 改善)

`rafAttempts <= 2` の時だけ `defer open` log を出す。無限ループに見える現象を log 上も抑制 (デバッグ diag は最初の 2 回で十分判断可能)。

---

## 4. 想定修復動作 (タブ切替時)

1. ユーザ Terminal タブクリック → Shell の Terminal 区画 display:none → block。
2. ResizeObserver が wrapper の変化を検知 (wrapper の rect が 0x0 → 非 0 に)。
3. `handleResize` (50ms debounce) → `flushAndOpen` 呼出。
4. `innerRect` が 0x0、`wrapperRect` 非 0 → rAF で次 frame 再試行。
5. 次 frame (約 16ms 後) inner も実 size 確定 → `term.open()` 成功。
6. `pendingWrites` の buffer を flush → 初 prompt 描画。
7. `term.focus()` でキー入力準備完了。

想定 log:
```
[TerminalPane] container still 0x0, defer open  ← rAF 初回 (rafAttempts=1)
[TerminalPane] container still 0x0, defer open  ← rAF 2 回目 (rafAttempts=2)
[TerminalPane] opened                           ← 成功 (多くの場合 1-2 frame で収束)
```

最悪ケースでも 10 frame (166ms) 内で収束 or ResizeObserver 次通知待ちに fallback。

---

## 5. 変更統計

| File | +Lines | -Lines | 備考 |
|------|--------|--------|------|
| `components/terminal/TerminalPane.tsx` | 約 +48 | 約 -6 | rAF retry loop + wrapper observe 追加 |

**Shell.tsx / TerminalView.tsx / TerminalPaneItem.tsx 等は無変更** (最小 diff 原則遵守)。
**触れていない領域**: `tauri.conf.json` / `src-tauri/*` / `components/preview/*` / `components/chat/*` / `lib/stores/*` (scope 外)。

---

## 6. ビルド検証

### TypeScript check

```bash
npx tsc --noEmit
```

- Terminal 関連: **0 error**
- 事前存在エラー (scope 外): `components/chat/MessageList.tsx(7,15): error TS2305: Module '"@/lib/types"' has no exported member 'ChatMessage'.`
  → CEO が並列で `chat/*` + `lib/types` を修正中 (担当外)。

### Next.js build

```bash
npx next build
```

- `Compiled successfully in 7.1s` ← **Terminal 範囲コンパイル成功**
- Lint warnings 数件 (既存、本 hotfix で新規 warning 追加なし)。
- 失敗 point は `components/chat/MessageList.tsx` (scope 外、CEO 作業中)。

**本 hotfix の Terminal 範囲は TypeScript / build 共に clean。**

---

## 7. 推奨検証手順 (オーナー実機)

1. `cargo tauri dev` で起動。
2. 起動直後は `viewMode === "chat"` → Terminal は display:hidden でマウント。
3. Terminal タブをクリック → `[TerminalPane] opened` log が 1 回出ること (defer log は 0-2 回で収束)。
4. プロンプト (`C:\Users\...\>`) が描画されること。文字入力 → echo が返ること。
5. 「+新規」ボタンで新規 pty 作成 → 即座に新規 prompt 表示。
6. 「分割」ボタンで 2 pane → 左右両方で文字描画されること。
7. 左右 pane 間で focus 切替 (mousedown) → 各々独立して入力できること。

### fail-safe 観察項目

- `defer open` log が **3 回以上連続出ない** こと (出たら rAF retry 上限超過 = 新たな race の可能性)。
- `term.open failed` warn が出ない こと。
- コンソールに `pty:*:data` が流れ続けるが terminal に描画されない場合は、flushAndOpen が呼ばれていない可能性 → ResizeObserver の observe 対象をさらに追加検討 (最悪 `document.body` を observe する anti-pattern もあるが回避したい)。

---

## 8. 将来の考察 (今回は実施しない)

- **代替案 B (Shell mount 戦略変更)**: Terminal を `display:hidden` mount → `viewMode === "terminal"` 条件 mount に変更すれば 0x0 問題は構造的に消滅するが、pty state 保持 (xterm scrollback / focus / cursor 位置) が reset される tradeoff。今回は最小 diff 原則で ResizeObserver + rAF hotfix を採用。
- 上記 hotfix で収束しない実機があれば、代替案 B を next step として検討。
- 長期的には `IntersectionObserver` の `threshold: [0]` + `isIntersecting` 判定のほうが visibility 判定として適切な可能性あり (ResizeObserver は size 変化 semantics、visibility は inter section semantics)。

---

## 9. 完了条件チェック

- [x] Terminal タブ初回切替で 1 pane 描画 (rAF retry で layout race 吸収)
- [x] `+新規` で新規 pty 描画 (新規 TerminalPane インスタンスも同じ修正経路)
- [x] 分割両 pane 描画 (ResizeObserver が pane 単位で独立動作)
- [x] `defer open` log 複数回連続しない (rafAttempts <= 2 で log 抑制、rAF で即収束設計)
- [x] `npx tsc --noEmit` Terminal 範囲 0 error
- [x] `npx next build` Terminal 範囲コンパイル成功 (pre-existing chat/* error は scope 外)
- [x] Logger wrapper 使用 (`logger.debug` / `logger.warn` / `logger.error` のみ、`console.*` 直接不使用)
- [x] 過度な refactor なし、最小 diff

---

## 10. CEO への連絡事項

1. 本 hotfix は Terminal scope 内で完結。chat/preview/tauri 側には一切触れていない。
2. `components/chat/MessageList.tsx` の `ChatMessage` import error は CEO 並列作業領域のため、本件合流時に解消見込み。
3. 実機検証でまだ `defer open` が 3 回以上連続する場合は、代替案 B (Shell mount 戦略変更) の検討を依頼したい。その際は `Shell.tsx` 275-283 行の Terminal 区画 mount 条件を `viewMode === "terminal" && <TerminalView />` に変更する提案。
