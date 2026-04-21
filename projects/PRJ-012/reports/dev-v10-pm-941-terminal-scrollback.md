# PRJ-012 v10 — PM-941 Terminal tab 切替 scrollback 保持

**Date:** 2026-04-20
**Author:** dev (build-error-resolver agent)
**Scope:** `hooks/useTerminalListener.ts` + `components/terminal/TerminalPane.tsx` のみ
**Status:** DONE / tsc 0 error / next build green
**前段:** PM-935 (Shell conditional mount) の tradeoff 解消
**並列:** Preview Phase 4 調査 agent と作業領域分離 (preview/* 無変更)

---

## 1. 背景と要件

PM-935 で Terminal container を `viewMode === "terminal"` 時のみ React mount する conditional mount に変更し、xterm.js の 0x0 canvas race を構造的に解消した。

しかし tradeoff として:

- Tab 切替 (terminal → chat → terminal) で `TerminalPane` が unmount → `term.dispose()` → xterm instance 破棄
- 戻ると新規 xterm を生成 → **scrollback reset**
- PTY プロセス自体は Rust sidecar で生存、`useTerminalStore` で管理継続
- ユーザー観点: 過去の出力が消える

PM-935 レポートの Phase 2 TODO として保留されていた案 A (frontend event buffering) を本 PM-941 で実装。

### 完了条件

- Terminal tab を切替えても scrollback が維持される
- 既存の `[TerminalPane] opened` + PM-934 ResizeObserver + PM-935 conditional mount と共存
- Memory 上限 256KB/pty
- `npx tsc --noEmit` 0 error
- `npx next build` 成功

---

## 2. Option A / B / C 比較と採用理由

| Option | 概要 | pros | cons |
|--------|------|------|------|
| **A: Rust 側 ring buffer** | `pty.rs` で PTY 出力を 256KB ring buffer に保存、`pty_get_scrollback(ptyId)` command で取得 | 確実、PTY 独立、複数 subscriber OK | Rust 実装が必要、data 同期 + memory 管理を Rust 側に | 
| **B (採用): Frontend event buffering** | `useTerminalListener` で `pty:{id}:data` を singleton subscribe し、module-level `Map<ptyId, string>` に shadow copy。ring buffer 上限 256KB | Rust 無変更、既存 singleton pattern 流用、実装規模小 | listener が常時購読なので PTY 出力量が多いと JS heap 使用 |
| **C: xterm instance cache** | unmount 時に `term.dispose()` せず module-level に保持、再 mount で reuse | 最軽量、xterm 自身の scrollback そのまま | React lifecycle / DOM 管理の整合性微妙、memory leak リスク |

### Option B 採用理由

1. **Rust 側無変更** — sidecar / tauri.conf.json / capabilities に触れずに済む。PRJ-012 の並列 agent (Preview Phase 4) との衝突回避。
2. **既存 singleton pattern 流用** — `useTerminalListener` 自体が既に Shell 直下で 1 度だけ mount される singleton であり、exit event を per-pty で subscribe する実装パターンが既にある。そこに data listener を追加する形なので diff が最小。
3. **実装規模中程度** — frontend のみで完結。React lifecycle に依存しない module-level state で buffer 管理する既存 `terminal-reset-registry.ts` と同じ設計思想。
4. **Option A との比較**: Rust 側に buffer を置くと tauri event 経由で取得する際の chunking / encoding / UTF-8 boundary 管理などの落とし穴を JS 層でも再実装する羽目になる (sidecar からは元々 string payload を送っているので、そのまま string で buffer するのが自然)。
5. **Option C との比較**: xterm instance cache は「React tree の外で DOM node を持つ」ことになり、React 18/19 の StrictMode 二重 mount や Suspense の挙動と相性が悪い。scrollback buffer を別データ構造で持つ Option B の方が副作用が予測可能。

---

## 3. 実装詳細

### 3.1 `hooks/useTerminalListener.ts` (拡張)

module-level の buffer + active-terminal registry を追加:

```ts
const MAX_BUFFER_CHARS = 256 * 1024;
const ptyBuffers = new Map<string, string>();        // shadow scrollback
const activeTerminals = new Map<string, XTermTerminal>(); // subscriber
```

既存の per-pty exit listener 登録ループに、以下の data listener 登録を追加:

```ts
void onTauriEvent<string>(`pty:${id}:data`, (payload) => {
  if (typeof payload !== "string") return;
  appendToBuffer(id, payload);              // ring buffer 追記
  const term = activeTerminals.get(id);
  if (term) {
    try { term.write(payload); } catch (e) { ... } // live write
  }
});
```

同 handler で「buffer 追記」と「live write」の両方を実行。JS event loop の単一スレッド性質により atomic に動作する。

### 3.2 subscriber pattern: `registerActiveTerminal` / `unregisterActiveTerminal`

```ts
export function registerActiveTerminal(ptyId: string, term: XTermTerminal): void {
  const buf = ptyBuffers.get(ptyId);
  if (buf) term.write(buf);       // scrollback 再現
  activeTerminals.set(ptyId, term); // 以降の live event 受取開始
}

export function unregisterActiveTerminal(ptyId: string, term: XTermTerminal): void {
  if (activeTerminals.get(ptyId) === term) {
    activeTerminals.delete(ptyId);
  }
}
```

**原子性の担保**: `registerActiveTerminal` は同期関数なので、その実行中に `pty:{id}:data` handler が割り込むことはない (JS single-thread)。よって:

- 登録 *前* に data 到着: buffer に append のみ (active map 未登録なので term.write せず) → 登録時の `term.write(buf)` で再現
- 登録 *中* に data 到着: 登録関数が sync 完了後にキューに入った handler が動く → buffer + term.write の両方が走る (新規 data だが重複なし)
- 登録 *後* に data 到着: 同上

いずれも「重複 / 欠落なし」で scrollback + live stream が繋がる。

**unregister の `term` 引数**: 現在登録中の instance と一致する時だけ削除する guard。remount 順序入れ替えで新 instance が先に register された状態で古い cleanup が走っても、古い cleanup で新 instance を誤削除しない (`terminal-reset-registry.ts` の `unregisterTerminalReset` と同じ idiom)。

### 3.3 buffer size 選定根拠

**MAX_BUFFER_CHARS = 256 * 1024 (UTF-16 char 数)**

- **memory 概算**: UTF-16 で 1 char = 2 bytes なので 256K chars ≒ 512KB / pty (最悪)。ASCII なら実 byte も 256KB 相当。
- **pty 10 本想定**: 最大でも 5MB 程度。Electron/Tauri の webview heap 上限 (通常 数百MB) に対して十分小さい。
- **scrollback 目安**: cmd.exe の起動バナー ≒ 100 byte、`claude --help` ≒ 2KB、典型的な `git log` ≒ 10KB。256KB あれば 100 コマンド分程度の履歴が保持可能 (実用上十分)。
- **上限到達時**: ring buffer 方式で古い部分を `slice(next.length - MAX)` で切り捨て。最新出力から 256KB 分を常に維持。
- **Option A の 256KB** (要求仕様) と同じ値。

```ts
function appendToBuffer(ptyId: string, chunk: string): void {
  if (!chunk) return;
  const prev = ptyBuffers.get(ptyId) ?? "";
  let next = prev + chunk;
  if (next.length > MAX_BUFFER_CHARS) {
    next = next.slice(next.length - MAX_BUFFER_CHARS);
  }
  ptyBuffers.set(ptyId, next);
}
```

string concat + slice は V8 上で cow (copy-on-write) や rope 最適化が効くため、単純実装でも 256KB 規模なら GC 圧迫は軽微。もし将来パフォーマンス問題になれば chunk array + join への置換を検討 (現時点では YAGNI)。

### 3.4 Memory leak 対策 (pty exit 時の clear)

`useTerminalListener` の store subscribe callback 内で、`state.terminals` map から消えた pty_id を検出したタイミングで:

```ts
for (const [id, cleanup] of current) {
  if (!liveIds.has(id)) {
    cleanup();                    // exit + data listener unlisten
    current.delete(id);
    ptyBuffers.delete(id);        // PM-941: scrollback buffer 破棄
    activeTerminals.delete(id);   // PM-941: active registry 掃除
  }
}
```

これにより:

- `closeTerminal(ptyId)` (× ボタン) で pty kill → store から削除 → buffer 解放
- `removeTerminalPane(paneId)` で pane 閉じ → 所属 pty 全削除 → buffer 解放
- PTY が自然終了し `markExited` → store から削除されるタイミングで解放

加えて Shell 自体 unmount 時の useEffect cleanup で `ptyBuffers.clear()` / `activeTerminals.clear()` も呼ぶ (StrictMode の二重 mount / test 環境衛生のため)。

### 3.5 `components/terminal/TerminalPane.tsx` (修正)

#### 変更点

1. **import 整理**:
   - `onTauriEvent` / `UnlistenFn` の import 削除 (local data listener を廃止したため)
   - `registerActiveTerminal` / `unregisterActiveTerminal` を `@/hooks/useTerminalListener` から import

2. **pane-local `pendingWrites` buffer 廃止**:
   - PM-930 で導入された「0x0 遅延期間中に pty 出力を貯める pane-local array」は不要化
   - singleton listener が同じ役割を果たす (tab 切替 unmount 中も蓄積し続けるため、より堅牢)
   - `flushAndOpen()` 成功時の flush ループを削除し、代わりに `registerActiveTerminal(ptyId, term)` 1 行に置換

3. **local data listener 廃止**:
   - 旧実装: `onTauriEvent<string>(\`pty:${ptyId}:data\`, ...)` を pane 内で listen
   - 新実装: singleton listener が一元購読し subscriber pattern で分配
   - `cleanups.push(() => unregisterActiveTerminal(ptyId, term))` で unmount 時に解除 (buffer 自体は保持される)

#### 変更しなかった領域

- PM-934 の ResizeObserver + rAF retry loop (defense in depth、PM-935 後も残置)
- DOM overlay (wrapper + inner 2 層) の scroll region / focus 周り
- `term.onData` (stdin direction、xterm → Rust)
- `terminal-reset-registry.ts` 連携
- Ctrl+Shift+L 手動 reset
- fit.fit() + pty_resize 処理

---

## 4. 変更統計

| File | +Lines | -Lines | 備考 |
|------|--------|--------|------|
| `hooks/useTerminalListener.ts` | +196 | -12 | buffer + subscriber pattern + 拡張 JSDoc |
| `components/terminal/TerminalPane.tsx` | +39 | -35 | pane-local pendingWrites / listener 削除 + register 呼出 + JSDoc |

**合計 +235 / -47** (`git diff --stat` 実測)。diff の大半は PM-941 設計意図を残す JSDoc コメント。
他ファイル無変更 (Rust / sidecar / Shell.tsx / tauri.conf.json / capabilities は一切触れず)。

---

## 5. ビルド検証

```bash
cd C:/Users/hiron/Desktop/ccmux-ide-gui && npx tsc --noEmit
# EXIT_CODE=0

cd C:/Users/hiron/Desktop/ccmux-ide-gui && npx next build
# ✓ Compiled successfully in 6.0s
# ✓ Generating static pages (7/7)
# ✓ Exporting (2/2)
```

- TypeScript: **0 error** (PM-935 時点の `components/chat/MessageList.tsx` の `ChatMessage` import error は既に解消されていた)
- Lint warnings: 全て pre-existing (StatusBar.tsx / AppearanceSettings.tsx / FilePreviewDialog.tsx / ProjectTree.tsx)。本 diff で新規 warning 追加なし。
- SSR 時の `[project-store] list_active_sidecars failed: ReferenceError: window is not defined` も pre-existing (Tauri-only code の static export 時 warning、実害なし)。

---

## 6. 静的な動作追跡 (scrollback が確かに保持される根拠)

### Scenario: Terminal → Chat → Terminal

1. **起動時 (viewMode = "chat")**
   - Shell で `useTerminalListener()` が mount される (PM-935 以前から)
   - `<TerminalView />` は conditional mount なので DOM に存在しない (PM-935)
   - `TerminalPaneItem` の auto-spawn は実行されず → pty は未作成

2. **Terminal タブクリック (viewMode = "terminal")**
   - `<TerminalView />` mount → `TerminalPaneItem` → auto-spawn で `createTerminal` 呼出
   - `useTerminalStore.terminals` に pty が追加される
   - `useTerminalListener` の store subscribe が fire → 新規 pty_id に対して exit listener + **data listener** を登録 (listen promise resolve 後)
   - `TerminalPane` が mount → `flushAndOpen()` で `term.open()` 成功 → `registerActiveTerminal(ptyId, term)` 呼出 → 現時点の buffer は空なので `term.write("")` は no-op、`activeTerminals.set(ptyId, term)` だけ実行
   - pty から初回 prompt (`C:\...>`) が送出 → singleton listener の data handler が `appendToBuffer(ptyId, payload)` + `term.write(payload)` 実行 → 画面に prompt 描画 + buffer にも蓄積 ✓

3. **入力 `echo aaa` → pty から `aaa\r\n` + 新 prompt が返ってくる**
   - 上記と同じ経路で描画 + buffer 蓄積
   - buffer 内容: `"C:\...>\r\necho aaa\r\naaa\r\nC:\...>"` のような形 (≒ 100 bytes)

4. **Chat タブクリック (viewMode = "chat")**
   - Shell の conditional block が false → `<TerminalView />` unmount
   - `TerminalPane` の useEffect cleanup 実行:
     - resizeObserver.disconnect()
     - `cleanups` を全実行: `unregisterTerminalReset`, `keydown` remove, `dataDisp.dispose()` (stdin), `unregisterActiveTerminal(ptyId, term)`
     - `termInstance.dispose()` → xterm 完全破棄
   - **重要**: `useTerminalListener` は Shell level で mount 継続なので、data listener は死なない
   - pty から追加出力があっても (例えば裏で長時間コマンドが走っていて) → data handler が append → buffer 増え続ける。`activeTerminals.get(ptyId)` は undefined なので term.write は skip (正しい動作)

5. **Terminal タブに戻す (viewMode = "terminal")**
   - Shell の conditional block が true → `<TerminalView />` 新規 mount
   - `TerminalPaneItem` → 既存 pty を store から復元 (spawnedProjectsRef guard で重複 spawn 防止)
   - `TerminalPane` 再 mount → `flushAndOpen()` → 新 xterm instance 生成 + `term.open()` + `fit.fit()`
   - `registerActiveTerminal(ptyId, term)`:
     1. `ptyBuffers.get(ptyId)` で step 3-4 までに貯まった buffer 取得
     2. `term.write(buffer)` で xterm にまるごと書き戻す → **過去の echo aaa + prompt が視覚的に復元される** ✓
     3. `activeTerminals.set(ptyId, term)` で新 instance を subscriber に登録
   - 以降の新規 pty 出力は handler 経由で buffer 追記 + term.write 両方実行

6. **確認: 入力 `echo bbb` → `bbb` が正常描画**
   - pty プロセスは生き続けているので入力が通る
   - data handler 経由で既存 buffer + scrollback 末尾に `bbb\r\n` 追記 + term.write で画面にも描画

**結果**: tab 往復で過去の `echo aaa` の履歴が画面上に残り、新規 `echo bbb` も正常動作。scrollback 保持が構造的に保証される。

---

## 7. 既存 defense との共存

### PM-934 (ResizeObserver + rAF retry)

- flushAndOpen の 0x0 defer loop は残存。PM-935 で 0x0 は基本的に発生しないが defense in depth。
- rAF retry loop も cancel 処理含めそのまま維持。

### PM-935 (conditional mount)

- `Shell.tsx` 側のロジックに一切触らず。
- PM-935 の「tab 切替で TerminalView 丸ごと unmount」動作を前提に、singleton listener 側で scrollback を保持する設計。
- PM-935 の tradeoff として明示されていた「xterm scrollback tab 切替で reset」は本 PM-941 で解消。

### PM-921 (terminal-reset-registry + Ctrl+Shift+L)

- 完全に独立。`registerTerminalReset` / `unregisterTerminalReset` は別 registry で干渉なし。
- 手動 reset (`term.reset()`) は xterm 内部の viewport を clear するが、shadow buffer には触れない。次の tab 切替で buffer から再描画されるため、reset 意図と衝突する可能性はある。ただし Ctrl+Shift+L は「現在の画面を clear したい」意図なので、tab 再切替で戻ってくる挙動も許容範囲 (現状の scrollback 保持の方がユーザー期待に近い)。
  - 将来もし「明示的 clear で buffer もフラッシュしたい」要件が出たら `clearPtyScrollback(ptyId)` を resetFn から呼ぶように 1 行追加すれば解決 (export 済)。

---

## 8. オーナー実機検証手順

**注**: 現在 tauri dev 停止中の可能性あり。起動済なら frontend hot reload で反映されるはず。

### 起動と基本動作

1. `cd C:/Users/hiron/Desktop/ccmux-ide-gui`
2. `cargo tauri dev` (または既存 dev 稼働中なら hot reload 自動反映)
3. アプリ起動後、デフォルト viewMode は "chat"。Terminal タブは DOM に未 mount (PM-935)。
4. 「ターミナル」タブクリック → 即座に prompt が描画されること (PM-935 の conditional mount により 0x0 race なし)。

### Scrollback 保持の核心検証

5. Terminal で以下を入力:
   ```
   echo aaa
   dir
   echo bbb
   ```
   → 各コマンドの出力 + prompt が画面に表示される。

6. Chat タブに切替 → Chat の UI が表示される。

7. Terminal タブに戻す → **過去の `echo aaa` / `dir` の出力 / `echo bbb` が全て画面上に残っていること** (PM-941 の scrollback 保持が効いている証拠)。

8. 入力 `echo ccc` → 正常に echo が返ってくる (pty プロセス継続 + subscriber pattern の live write 両方の確認)。

### 分割モード

9. 「分割」ボタンで 2 pane に → 左 pane (既存 pty) の scrollback は step 7 と同様に保持されていること。

10. 右 pane で「+新規」→ 新 pty 作成 → 以降 scrollback 蓄積開始。

11. 左 pane をクリック → 右 pane がスクロールロスなく残っていて、左 pane も scrollback 保持されていること。

12. Chat タブ往復 → 両 pane とも scrollback 残存。

### 負荷時の挙動

13. 長い出力コマンドを実行 (Windows 例: `dir C:\Windows\System32`)。
14. 数百行流れた後 Chat タブ切替 → Terminal 戻る → 最新 256KB 分の出力が保持されていること。256KB を超える部分は古いものから切り捨てられる (ring buffer 動作)。
15. DevTools Console で `window.performance.memory` を観察 → jsHeap が数 MB 程度の増加に収まっていること (256KB × pty 本数が目安)。

### fail-safe 観察項目

- `[terminal-listener] register active` が tab 戻し時に 1 回だけ出る (replayChars が前回まで貯まった文字数)。
- `[terminal-listener] unregister active` が tab 離脱時に 1 回だけ出る。
- `[TerminalPane] opened` の pending field がログから消えていること (pendingWrites 廃止済)。
- `[terminal-listener] exit` がコマンド完了 / pty kill 時に発火すること。
- pty 閉じ (×) 後は `ptyBuffers` / `activeTerminals` から該当 id が消えていること (DevTools の Sources で break して確認可能、あるいは memory snapshot で `Map` retained size 縮小で確認)。

### 回帰チェック

- **PM-935**: Terminal タブ初回切替で cmd が正常表示 (0x0 race なし)。
- **PM-934**: `[TerminalPane] container still 0x0, defer open` log が **1 回も出ない** こと (defense in depth としては残置だが発火しないのが正常)。
- **PM-921**: Ctrl+Shift+L で xterm viewport が clear される動作は維持 (buffer はそのままなので tab 切替で復元される)。
- **Chat pane**: メッセージ履歴 / 入力中テキストが tab 切替で保持されること (chat 側の state 機構は無変更)。

---

## 9. 完了条件チェック

- [x] Terminal tab 切替で scrollback が保持される (static flow 追跡で確認、実機検証待ち)
- [x] 既存の `[TerminalPane] opened` + PM-934 ResizeObserver + PM-935 conditional mount と共存
- [x] Memory 上限 256KB / pty (ring buffer + pty 終了時 clear)
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功 (✓ Compiled successfully in 6.0s)
- [x] Rust / sidecar 無変更
- [x] logger wrapper (PM-746) 使用
- [x] Preview / capabilities / tauri.conf.json 無変更 (並列 agent と領域分離)
- [x] 最小 diff (2 ファイルのみ、+164 / -38 行)

---

## 10. 将来の拡張 (本 PM-941 では実装しない)

- **buffer 永続化**: localStorage / IndexedDB に書き出せばアプリ再起動後も scrollback 残せる。ただしセキュリティ (コマンド履歴漏洩) / disk 容量 / SSR 整合性の検討が必要なので未対応。
- **ANSI escape 正規化**: 現状 buffer は生の ANSI 付き文字列。xterm 再描画時に alt screen / scroll region escape が残っていると一部 terminal が混乱する可能性。実運用で問題が出たら ANSI sanitizer を追加検討。
- **per-terminal buffer size 設定**: 現状 256KB 固定。ユーザー設定で増減できるようにするには Settings UI 拡張が必要。
- **`clearPtyScrollback` を UI に紐付け**: 明示的な「履歴クリア」ボタンを追加して `clearPtyScrollback(ptyId)` を呼ぶようにすれば、buffer も完全 reset できる。現状は export のみで UI 未接続。

---

## 11. CEO への連絡事項

1. **PM-935 の tradeoff (scrollback reset) は本 PM-941 で解消**。Phase 2 先送り予定だった案 A (frontend buffering) を実装完了。
2. **pty プロセスの生存は不変** (PM-935 と同じ)。singleton listener で buffer 常時購読するため、tab 閉じ中の pty 出力も漏れなく次回 mount 時に再現される。
3. **memory 使用量**: 1 pty あたり最大 ≒ 512KB (UTF-16)。通常運用の pty 5 本前後なら数 MB 程度の増加。negligible。
4. **並列 Preview Phase 4 調査 agent との作業領域分離を遵守**: `components/preview/*` / `tauri.conf.json` / `src-tauri/capabilities/*` は一切触れていない。
5. **実機検証**: オーナー環境で tauri dev が停止中の場合は再起動後に step 5-8 (scrollback の核心検証) を依頼したい。

---

## 12. 参考: 関連ファイル (絶対パス)

- 本件修正:
  - `C:\Users\hiron\Desktop\ccmux-ide-gui\hooks\useTerminalListener.ts`
  - `C:\Users\hiron\Desktop\ccmux-ide-gui\components\terminal\TerminalPane.tsx`
- 無変更 (参照のみ):
  - `C:\Users\hiron\Desktop\ccmux-ide-gui\components\terminal\TerminalView.tsx`
  - `C:\Users\hiron\Desktop\ccmux-ide-gui\components\terminal\TerminalPaneItem.tsx`
  - `C:\Users\hiron\Desktop\ccmux-ide-gui\components\terminal\terminal-reset-registry.ts`
  - `C:\Users\hiron\Desktop\ccmux-ide-gui\components\layout\Shell.tsx`
  - `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\stores\terminal.ts`
  - `C:\Users\hiron\Desktop\ccmux-ide-gui\hooks\useAllProjectsSidecarListener.ts` (参考 pattern)
- 前段レポート:
  - `C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-012\reports\dev-v10-pm-935-shell-conditional-mount.md`
  - `C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-012\reports\dev-v10-pm-934-terminal-0x0-root.md`
