# PRJ-012 v1.1 — PM-890 Shell Snapshot Orchestrate 移管レポート

- **日付**: 2026-04-20
- **担当**: dev (build-error-resolver 役割 / 最小 diff 移管)
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **対象バージョン**: v1.1 (PM-810 regression hotfix 後 → PM-890 で縮退解消)
- **工数実績**: 調査 30m + 実装 30m + 型/build 検証 + レポート = ~1.5h
- **ステータス**: **実装完了、オーナー実機検証待ち** (frontend のみ / Rust / sidecar 無変更、tauri dev なら HMR 反映のみで OK)

---

## 0. TL;DR

PM-810 regression hotfix で ChatPanel.tsx に `initialMountRef` guard を入れた副作用で **project 切替時の snapshot save/restore が縮退** していた (streaming 中メッセージが切替で失われる)。本タスクでは:

1. **Shell.tsx** に `activeProjectId` 監視の useEffect を追加し、project 切替時に `saveProjectSnapshot(prev) → restoreProjectSnapshot(next)` + cache miss 時の `loadSession(lastSessionId)` を orchestrate
2. **ChatPanel.tsx** の snapshot swap useEffect 本体を削除 (`initialMountRef` guard は保険として維持、snapshot 復元ロジックは空にする)
3. PM-810 paneId routing (`reqIdToPane` / `pendingSendsByProject`) は `useAllProjectsSidecarListener` 内で独立管理されており、本移管では touch していないため regression なし

検証結果:
- `cd C:\Users\hiron\Desktop\ccmux-ide-gui && npx tsc --noEmit` → **exit 0**
- `cd C:\Users\hiron\Desktop\ccmux-ide-gui && npx next build` → **Compiled successfully in 6.8s**、static export 2/2 成功
- 追加した警告なし (既存の StatusBar / AppearanceSettings 等の warning のみ残存、本タスク無関係)

---

## 1. Before / After の data flow

### 1.1 Before (PM-810 regression hotfix 後)

```
[project 切替: A → B]
  ↓
Shell <motion.main key={activeProjectId}> が remount trigger
  ↓
ChatPanel.tsx (A) unmount / (B) mount
  ↓
ChatPanel useEffect [activeProjectId]:
  - initialMountRef.current === true
  - → initialMountRef = false、prevActiveProjectIdRef = "B"
  - → snapshot swap SKIP (hotfix で導入された guard)
  ↓
  mountLoadRanRef useEffect:
  - isActivePane === true
  - panes["main"].currentSessionId (persist 復元値) or lastSessionId で DB load
  ↓
体感: A project の streaming 中メッセージは失われる (snapshot に保存されない)、
       B project は DB から confirmed messages のみ復元。
```

問題点:
- `saveProjectSnapshot` が呼ばれない → A の streaming / tool_use / activity が破棄
- B への restore も走らない → 以前 B で表示していた streaming message も復元されない
- DB 経由の load のみが残り、「streaming 中の切替 → 戻り」で会話が消えた体感

### 1.2 After (PM-890)

```
[project 切替: A → B]
  ↓
Shell useEffect [activeProjectId] が先に発火 (ChatPanel の remount 前):
  - prev = "A", next = "B"
  - prev !== undefined && prev !== next → orchestrate 実行
  - chat.saveProjectSnapshot("A")  ← panes 全体を deep copy して snapshot に退避
  - useProjectStore.updateProject("A", { lastSessionId }) で write back
  - chat.restoreProjectSnapshot("B") → hit なら panes に復元 (streaming 中も残る)
  - miss なら panes 初期化 + lastSessionId から loadSession
  ↓
React re-render → Shell の <motion.main key="B"> で ChatPanel (B) remount
  ↓
ChatPanel useEffect [activeProjectId]:
  - initialMountRef.current === true → prev ref を "B" に刻んで early return
  - (snapshot swap body は削除済のため副作用なし)
  ↓
  mountLoadRanRef useEffect:
  - snapshot hit で既に messages が復元済 → messagesLen > 0 で loadSession skip
  - snapshot miss で lastSessionId 経路が Shell 側で走った場合も同様 skip
  - リロード直後 (Shell 側 orchestrate の初回 sentinel skip) のみ persisted
    currentSessionId から DB load を担当
  ↓
体感: A の streaming 中メッセージは snapshot 保存され、B に戻った時に
       streaming / tool_use / activity を含めて瞬時復元。
```

ポイント:
- snapshot の save/restore は **ChatPanel の mount 完了前に Shell effect で確定** する
- ChatPanel は subscriber として panes / projectSnapshots を購読するだけで副作用を起こさない
- リロード後の persisted session → DB load は ChatPanel の `mountLoadRanRef` が担当 (役割分離)

---

## 2. 実装 diff

### 2.1 `components/layout/Shell.tsx`

**変更 A: import**

```diff
-import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
+import {
+  useCallback,
+  useEffect,
+  useMemo,
+  useRef,
+  useState,
+  type ReactNode,
+} from "react";
```

```diff
 import { useProjectStore } from "@/lib/stores/project";
+import { useSessionStore } from "@/lib/stores/session";
 import {
   useTerminalStore,
   TERMINAL_MAX_PANES,
 } from "@/lib/stores/terminal";
+import { logger } from "@/lib/logger";
 import { cn } from "@/lib/utils";
```

**変更 B: snapshot orchestrate effect を追加 (activeProjectId 購読直後)**

- `prevActiveProjectIdRef` を `undefined` sentinel で初期化し、初回 mount では即 return (起動直後/リロード直後の復元を ChatPanel 側 `mountLoadRanRef` に委ねる)
- prev → next 変化で `saveProjectSnapshot(prev)` + `updateProject(prev, { lastSessionId })` + `restoreProjectSnapshot(next)` を実行
- cache miss 時のみ `loadSession(lastSessionId)` を呼ぶ (hit 時は snapshot を 100% 信じる、v3.5.10 方針踏襲)
- ログは `logger.debug("[pm890-orchestrate]", { prev, next, hit })` (PM-746 production gate 対応)

行数: +40 コード + 42 コメント (冒頭の「経緯/方針」ブロック) = **実質コード追加 40 行**

### 2.2 `components/chat/ChatPanel.tsx`

**変更: snapshot swap useEffect 本体を削除、コメント更新**

- 旧 useEffect (line 124-282、約 159 行) の swap 本体 (save/restore/loadSession 分岐) を削除
- `initialMountRef` guard と `prevActiveProjectIdRef` 維持ロジックは保険として残存
- 新コメントで PM-890 移管の経緯と、ChatPanel に残る責務 (mountLoadRanRef 経路) を明記

```diff
-  // ... (159 行の snapshot swap ロジック + 説明コメント) ...
-  const initialMountRef = useRef(true);
-  const prevActiveProjectIdRef = useRef<string | null>(null);
-  useEffect(() => {
-    if (initialMountRef.current) {
-      initialMountRef.current = false;
-      prevActiveProjectIdRef.current = activeProjectId;
-      return;
-    }
-    const prev = prevActiveProjectIdRef.current;
-    const next = activeProjectId;
-    prevActiveProjectIdRef.current = next;
-    if (prev === next) return;
-    if (!isActiveRef.current) return;
-    (async () => {
-      // ... 90 行の save/restore/loadSession orchestrate ...
-    })();
-  }, [activeProjectId, paneId]);
+  const initialMountRef = useRef(true);
+  const prevActiveProjectIdRef = useRef<string | null>(null);
+  useEffect(() => {
+    if (initialMountRef.current) {
+      initialMountRef.current = false;
+      prevActiveProjectIdRef.current = activeProjectId;
+      return;
+    }
+    // PM-890: snapshot save/restore は Shell 側に移管済。
+    prevActiveProjectIdRef.current = activeProjectId;
+  }, [activeProjectId, paneId]);
```

行数: 実質削除 ~110 行 (swap 本体) / 残存 ~40 行コメント更新。logic 差分は **-110 / +4**。

### 2.3 サマリ

| ファイル | +コード | -コード | 備考 |
|---|---|---|---|
| `components/layout/Shell.tsx` | +40 | 0 | snapshot orchestrate effect 新設 |
| `components/chat/ChatPanel.tsx` | +4 | -110 | swap 本体削除、initialMountRef は保険維持 |
| **合計** | **+44** | **-110** | 差引 -66 行の単純化 |

Rust: **無変更**。sidecar: **無変更**。`lib/stores/chat.ts`: **無変更** (store API は既存のまま転用)。`hooks/useAllProjectsSidecarListener.ts`: **無変更** (PM-810 routing 完全温存)。

---

## 3. PM-810 hotfix の `initialMountRef` guard の扱い

- **保持**。Shell 側 orchestrate は ChatPanel の mount 前に発火するが、Shell effect 実行と ChatPanel の初回 useEffect 実行順序は React レンダリングパイプライン上 Shell → 子 ChatPanel の順で確定する保証があるため、理論上 race はない。
- それでも `initialMountRef` を残す理由:
  1. **将来 ChatPanel 内部に snapshot を触る action を追加した際の保険**: 例えば「この pane だけ snapshot 更新」系のカスタム action を足したときに mount race を自動で止める
  2. **最小 diff 方針**: PM-810 hotfix で導入された guard を安易に外すとレグレッションリスクが出るため、swap body だけを削り guard は残置
- 結果、`initialMountRef` 経由の useEffect は「prev ref を更新するだけ」となり実質 no-op。ESLint / tsc は警告なし (ref 書込みが残っているため unused にならない)。

---

## 4. streaming 中切替時の動作理論

### 4.1 期待シナリオ (本修正で復活)

```
1. ユーザが project A で "長い回答を書いて" 送信
2. sidecar が streaming delta を流し始める (A の panes["main"] の assistant message に追記、
   activity = "streaming")
3. ユーザが ProjectRail で project B に切替
4. Shell useEffect [activeProjectId]:
   - prev = "A", next = "B"
   - chat.saveProjectSnapshot("A") ← **streaming 中の assistant message ごと deep copy**
   - chat.restoreProjectSnapshot("B") → B の以前の snapshot があれば復元
5. sidecar から到来し続ける A の delta event は useAllProjectsSidecarListener が受信し、
   applyToProjectPane("A", paneId, activeProjectId="B", updater) 経由で
   **projectSnapshots["A"] を直接更新** (activeProjectId !== "A" のため)
6. ユーザが A に戻る:
   - Shell useEffect: prev = "B", next = "A"
   - chat.saveProjectSnapshot("B")
   - chat.restoreProjectSnapshot("A") → snapshot hit で streaming 中の最新 state が復元
7. A の ChatPanel は panes を購読しているため、streaming 中 UI が瞬時復活
```

### 4.2 cache miss 経路 (初回遷移、snapshot が未作成の時)

```
1. 起動直後、A を選択して会話、B に切替 (B は初めて選択)
2. Shell useEffect: prev = "A", next = "B"
   - saveProjectSnapshot("A") 済
   - restoreProjectSnapshot("B") → hit = false、panes を { main: 空 } にリセット
   - project.lastSessionId があれば loadSession で confirmed messages を DB 復元
   - 無ければ空 pane で継続 (新規会話準備)
3. ChatPanel (B) mount → mountLoadRanRef は panes["main"].messages.length > 0 の場合 skip
```

### 4.3 リロード直後の経路 (Shell effect の初回 sentinel skip)

```
1. ブラウザリロード → Zustand persist で activePaneId / panes[*].currentSessionId のみ復元
2. Shell useEffect: prev = undefined (sentinel) → sentinel 抜けるだけで orchestrate skip
3. ChatPanel mount → mountLoadRanRef が panes[paneId].currentSessionId を見て
   messagesLen === 0 なら loadSession で DB から復元
```

これにより「初回 mount 時の snapshot 誤発火」(PM-810 の本来の regression 原因) は Shell 側でも発生しない構造となる。

---

## 5. PM-810 paneId routing への影響確認 (静的追跡)

| 観点 | 結果 |
|---|---|
| `reqIdToPane` map (`hooks/useAllProjectsSidecarListener.ts` 内) | Shell effect は touch せず |
| `pendingSendsByProject` キュー | Shell effect は touch せず |
| `claimNextSendForPane` / `resolvePaneForEvent` / `releaseReqIdIfTerminal` | 未変更 |
| `applyToProjectPane` の振分け (active → panes / 非active → snapshot) | 未変更 |
| split 2 pane 独立送信 (PM-810 Case B) | 既存 routing そのまま |
| 並列送信 (PM-810 Case C) | 既存 routing そのまま |

Shell effect は `useChatStore` の `saveProjectSnapshot` / `restoreProjectSnapshot` / `applyToProjectPane` (経由無し、直接 panes/projectSnapshots を set) を呼ぶが、これらは reqId/paneId map に無関係な namespace で動作するため routing に影響しない。

---

## 6. 検証

### 6.1 型チェック

```
cd C:\Users\hiron\Desktop\ccmux-ide-gui && npx tsc --noEmit
EXIT=0
```

### 6.2 Next.js production build

```
cd C:\Users\hiron\Desktop\ccmux-ide-gui && npx next build
 ✓ Compiled successfully in 6.8s
 ✓ Generating static pages (7/7)
 ✓ Exporting (2/2)

Route (app)                                 Size  First Load JS
┌ ○ /                                     1.4 kB         116 kB
├ ○ /_not-found                             1 kB         105 kB
├ ○ /settings                            10.6 kB         158 kB
├ ○ /settings/mcp                        6.52 kB         144 kB
└ ○ /workspace                           4.51 kB         196 kB
```

既存警告のみ残存 (StatusBar.tsx unused vars / FilePreviewDialog `<img>` / ProjectTree aria-selected)、本タスク無関係。新規警告 0 件。

### 6.3 build 反映手順

- **frontend**: `next dev` (tauri dev 内) は HMR で自動反映。HMR 不安定なら `Ctrl+R` で webview reload。
- **sidecar**: 無変更のため rebuild 不要。
- **Rust**: 無変更のため tauri rebuild 不要。

---

## 7. オーナー実機検証手順

### 7.1 準備

1. アプリ起動中なら `Ctrl+R` で webview reload (HMR 反映確認のため推奨)
2. DevTools を開き (`Ctrl+Shift+I`) → Console タブ filter に `pm890` を設定

### 7.2 Case A: streaming 中の project 切替 → 戻り (PM-890 の中心検証)

1. project A を選択、長文生成依頼を送信 (例: "1000 字の markdown を書いて")
2. streaming 中 (delta が流れている最中) に ProjectRail から project B に切替
3. B の画面が表示されることを確認
4. **期待**: DevTools Console に `[pm890-orchestrate] { prev: "A-id", next: "B-id", hit: <true/false> }` が 1 行出力
5. 数秒経ってから project A に戻す
6. **期待**:
   - A の assistant message が streaming を継続した状態で復活 (delta は snapshot 側に蓄積されていたため、切替中も進行していた)
   - activity indicator が "streaming" / "tool_use" を復元
   - DevTools に `[pm890-orchestrate] { prev: "B-id", next: "A-id", hit: true }` が出力

### 7.3 Case B: 初回 project 切替 (cache miss)

1. 起動直後、A → B と切替 (B は本セッションで初アクセス)
2. **期待**:
   - `[pm890-orchestrate] { prev: "A-id", next: "B-id", hit: false }`
   - B の panes は初期 1 pane に reset、B.lastSessionId があれば confirmed messages が DB 復元
   - A に戻ると `hit: true` で A 側の snapshot (= 送信済み会話) が復元

### 7.4 Case C: リロード後の復元 (Shell sentinel skip 経路)

1. project A で会話済の状態で `Ctrl+R` でリロード
2. **期待**:
   - Shell useEffect [activeProjectId] は sentinel から抜けるだけで orchestrate log 出ない
   - ChatPanel の `mountLoadRanRef` 経路が persisted `currentSessionId` を拾って `loadSession`
   - A の DB 確定メッセージが復元される (streaming 中だった delta は当然失われる = リロード前提の仕様)

### 7.5 Case D: split 2 pane での project 切替 (PM-810 との共存確認)

1. project A で分割ボタン押下 → 2 pane 配置
2. 左 pane (main) と右 pane (pane-X) それぞれで送信、両方に assistant message がある状態を作る
3. project B に切替
4. project A に戻る
5. **期待**:
   - 2 pane 構成 (main + pane-X) がそのまま復元
   - 各 pane の messages が独立して残る
   - `[pm890-orchestrate] { hit: true }`

### 7.6 Case E: addPane 中の regression 確認 (PM-810 本来のバグが再発しないか)

1. project A で 1 pane 状態から「分割」ボタン押下
2. **期待**:
   - 新 pane-X が追加され panes が 2 個に
   - `[pm890-orchestrate]` ログは出ない (activeProjectId は変わっていないため)
   - 新 pane mount 時の ChatPanel useEffect は `initialMountRef` guard で early return → panes 破壊なし

### 7.7 log pattern 早見表

| grep | 意味 |
|---|---|
| `[pm890-orchestrate]` | Shell 側 snapshot orchestrate 実行。prev/next/hit が見える |
| `[pm810-claim]` / `[pm810-resolve]` / `[pm810-release]` | PM-810 split pane routing (既存、無変更) |
| `[sdk_session_ready]` | PM-830 SDK session UUID attach (既存、無変更) |

---

## 8. 既知の残留 / 後続タスク候補

### 8.1 既知の一時後退 (解消済)

- ~~PM-810 hotfix で縮退した「project 切替時 streaming 中メッセージ保持」~~ → **本タスクで解消**

### 8.2 残存 debug log

- `[pm890-orchestrate]` を追加 (PM-746 の logger.debug 経由 = production では silent)
- PM-810 系 debug log (`[pm810-claim]` 等) も残存、PM-746 整理タスクで本 log と一緒に削除予定

### 8.3 推奨後続タスク

- **PM-xxx (将来)**: cache hit 時に裏で `loadSession` を走らせ DB 差分を merge する仕組み (v3.5.10 で削除された機能)。現状は snapshot 100% 信頼で streaming / activity を優先しているが、pane 単位の DB merge API があると「長時間切替後の戻り」で DB に書き込まれた他経由 message を取り込めて理想。
- **PM-746 (既存)**: PM-810 / PM-890 で追加した debug log を含めて清掃。

---

## 9. 変更ファイル絶対パス

- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\layout\Shell.tsx` (snapshot orchestrate effect 新設)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\chat\ChatPanel.tsx` (snapshot swap 本体削除、initialMountRef 保険維持)

## 10. 変更していないが参照した関連ファイル

- `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\stores\chat.ts` (saveProjectSnapshot / restoreProjectSnapshot / applyToProjectPane の動作確認)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\stores\session.ts` (loadSession の副作用確認)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\stores\project.ts` (updateProject シグネチャ確認)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\hooks\useAllProjectsSidecarListener.ts` (PM-810 paneId routing 無影響の確認)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\logger.ts` (PM-746 logger wrapper 使用)
- `C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-012\reports\dev-v10-pm-810-regression-hotfix.md` (縮退仕様の前提確認)
- `C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-012\reports\dev-v10-pm-810-split-pane-session-id.md` (paneId routing 設計参照)

---

## CEO への上申

- PM-810 regression hotfix で縮退した「project 切替時 snapshot save/restore」を、Shell 側 `useEffect([activeProjectId])` に orchestrate を移管する形で **縮退解消**。
- frontend のみで 2 ファイル (Shell.tsx +40 / ChatPanel.tsx -110 相当) の最小 diff、Rust / sidecar / chat store / useAllProjectsSidecarListener は無変更。
- PM-810 の split pane routing (`reqIdToPane` / `pendingSendsByProject`) には触れていないため regression なし、静的追跡で確認済。
- `npx tsc --noEmit` exit 0、`npx next build` 成功 (新規警告 0)。
- オーナー実機で **Case A (streaming 中切替 → 戻りで streaming 中 messages が復活)** を最優先で確認いただきたい。併せて Case D (split 2 pane 切替) / Case E (addPane regression 無再発) も確認いただければ PM-810 との共存が検証できる。
