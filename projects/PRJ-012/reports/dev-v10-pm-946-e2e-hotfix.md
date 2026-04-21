# PRJ-012 v1.1.1 PM-946 E2E Hotfix レポート

- **日時**: 2026-04-20
- **担当**: 開発部門 (dev)
- **対象 branch**: `main` (v1.1.0 tag push 後の direct hotfix)
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **目的**: v1.1.0 tag push 後の GitHub Actions E2E CI 6 件 fail を緊急修正

## 結論

- **TypeScript 型チェック**: 0 error (`npx tsc --noEmit` 成功)
- **Next.js 本番ビルド**: 成功 (`npx next build` / `window is not defined` 消失)
- **Playwright E2E**: **14 / 14 passed** (local Chromium で確認)
- **変更行数**: 7 ファイル / +168 -33 (最小 diff を維持、過度な refactor なし)
- **Rust / sidecar**: 無変更 (frontend + test 層のみ)

## 失敗していた 6 件の原因分析と修正

根本原因は以下 3 層に分解できる:

### 根本原因 1: SSR 時の `window is not defined` (全 spec の ground truth 崩壊)

`lib/stores/project.ts:943` で `onRehydrateStorage` 内から `@tauri-apps/api/core` の
`invoke<SidecarInfo[]>("list_active_sidecars")` を呼んでおり、Next.js dev server の
SSR / build 時に `window` が存在しないコンテキストでも発火して `ReferenceError` を
起こしていた (オーナー提示の `[WebServer]` log と一致)。

この error が発生すると **ハイドレーション連鎖が早期 break** するため、spec 側で
active project 登録等の store 初期化が正常に走らず、複数 spec の textarea /
SessionList / Command Palette が描画されないタイミングが重なっていた。

### 根本原因 2: PM-938 Welcome Wizard 撤去 + PM-939 project-first 強制化

`/` RootPage が `check_claude_authenticated` を invoke するように変わったのは
spec 影響はないが (spec は `/workspace` 直叩き)、**PM-939 で CommandPalette /
SessionList / InputArea の振る舞いが activeProjectId 必須に変わった** 結果、
fixture 未更新の spec が軒並み fail する状態になった:

- `command-palette.spec.ts`: 「新規セッション」CommandItem が `disabled={!activeProjectId}`
- `sessions.spec.ts`: 「新規セッション」Button が `disabled={!activeProjectId}`
  + `SessionList` が `visibleSessions` を `s.projectId === activeProjectId` で filter
- `slash-palette.spec.ts`: textarea placeholder が `activeProjectId === null` で
  「プロジェクトを選択してください...」に切替わり `/メッセージを入力/` regex が match しない
- `chat.spec.ts`: `InputArea` の送信 guard が `sidecarStatus === "running"` を要求
  (PM-784 / v3.5.8 で自動起動廃止済)

また `pruneStaleProjects()` が `plugin:fs|exists` で投入済 project を drop して
しまう既知の race が fixture にあり、`preview-webview-window.spec.ts` が `patchFsExistsTrue`
で個別 workaround していた状態 (他 spec には未適用)。

### 根本原因 3: PM-943 → PM-944 の preview spawn API 変更

`preview-webview-window.spec.ts` は PM-943 の JS API 時代に作られ、
`plugin:webview|create_webview_window` を assert していた。PM-944 で Rust 側
`#[tauri::command] spawn_preview_window(label, url, title)` に切替わり、
`PreviewPane.handleOpenInApp` が `callTauri("spawn_preview_window", ...)` を
直接呼ぶようになったため assertion ズレで fail。

## 修正内容（最小 diff / ファイル別）

### 1. `lib/stores/project.ts` (+8 -0) — SSR guard 追加

`onRehydrateStorage` 内の非同期 IIFE で `pruneStaleProjects` 完了後、
`@tauri-apps/api/core` 動的 import 直前に SSR 早期 return を追加:

```diff
+          // v1.1.1 PM-946 hotfix: SSR / Next.js build 時は `window` が無いので
+          // `@tauri-apps/api/core` の invoke が即死する (ReferenceError: window is not
+          // defined at project.ts:943)。persist middleware は onRehydrateStorage を
+          // SSR でも叩くケースがあるため、ここで明示的に server-side を早期 return する。
+          if (typeof window === "undefined") {
+            return;
+          }
           const live = useProjectStore.getState();
           try {
             const { invoke } = await import("@tauri-apps/api/core");
```

他の invoke 呼出 (start/stop_agent_sidecar 等) は既に zustand action 経由で、
いずれもユーザー操作起点 (TitleBar 等) のため SSR 文脈では走らない。
`safeExists` は try/catch wrap 済で SSR でも throw しない (既存)。

### 2. `tests/e2e/fixtures.ts` (+66 -4) — mock state / cmd handler を拡張

4 つの mock 追加を 1 fixture に集約:

1. **`check_claude_authenticated` mock**
   PM-938 Welcome 撤去後の RootPage からの invoke を `"Authenticated"` で stub。
   spec 側は `/workspace` 直叩きだが、logger warn / トースト抑止のため fixture で吸収。

2. **`spawn_preview_window` mock** (PM-944)
   Rust 側 command `spawn_preview_window` を `null` で resolve する stub。
   旧 `plugin:webview|create_webview_window` stub は残置 (後方互換)。

3. **`plugin:fs|exists` の selective true 化**
   `mockState.existingPaths: Set<string>` を新設し、`initialProjects[].path` で seed。
   該当 path への exists invoke は true を返し、`pruneStaleProjects` が active
   project を drop しないようにした。他 path は従来通り false。
   → `preview-webview-window.spec.ts` の個別 `patchFsExistsTrue` workaround を
     不要化 (仕様統一)。

4. **`list_active_sidecars` の dynamic 応答 + start/stop_agent_sidecar 連動**
   `mockState.runningSidecarIds: Set<string>` を新設。`activeProjectId` が渡された
   時点で seed し、以降 `start_agent_sidecar` / `stop_agent_sidecar` invoke と同期する。
   `list_active_sidecars` は set を `SidecarInfo[]` に map して返す。
   → `onRehydrateStorage` で `sidecarStatus[TEST_PROJECT_ID] = "running"` となり、
     `InputArea` の `status === "running"` guard を通過する (chat.spec.ts fix)。

5. **`sessions[].projectId` / `sdkSessionId` を optional field として追加**
   SessionSummary の必須 field を型に追記。デフォルト値は null。

### 3. `tests/e2e/helpers.ts` (+28 -5) — `FIXTURE_WITH_ONE_SESSION` を active project 付に

```diff
 export const FIXTURE_WITH_ONE_SESSION: TauriFixtureOptions = {
   sessions: [
     {
       id: "sess-existing-1",
       title: "最初のセッション",
       ...
-      projectPath: null,
+      projectPath: TEST_PROJECT_PATH,
+      projectId: TEST_PROJECT_ID,
+      sdkSessionId: null,
       ...
     },
   ],
+  initialProjects: [{ id: TEST_PROJECT_ID, path: TEST_PROJECT_PATH, ... }],
+  activeProjectId: TEST_PROJECT_ID,
 };
```

→ `SessionList` の `visibleSessions` filter を通過、新規セッション button が enabled に。

### 4. `tests/e2e/preview-webview-window.spec.ts` (+15 -14) — PM-944 API 追随

```diff
-  test("clicking 'アプリ内で開く' invokes create_webview_window", async ({
+  test("clicking 'アプリ内で開く' invokes spawn_preview_window", async ({
     ...
-    const log = await getInvokeLog(page);
-    const spawn = log.find(
-      (l) => l.cmd === "plugin:webview|create_webview_window"
-    );
-    const args = (spawn?.args ?? {}) as {
-      options?: { url?: string; label?: string };
-    };
-    expect(args.options?.url).toBe("http://localhost:4321");
-    expect(args.options?.label).toMatch(/^preview:/);
+    const log = await getInvokeLog(page);
+    const spawn = log.find((l) => l.cmd === "spawn_preview_window");
+    const args = (spawn?.args ?? {}) as {
+      label?: string; url?: string; title?: string;
+    };
+    expect(args.url).toBe("http://localhost:4321");
+    expect(args.label).toMatch(/^preview-/);
```

- cmd 名: `plugin:webview|create_webview_window` → `spawn_preview_window`
- payload shape: ネスト `{options: {url, label}}` → flat `{label, url, title}`
- label prefix: `preview:` → `preview-` (Rust command が sanitize 済 `preview-${projectId}`)

describe ブロックタグも PM-943 → PM-944 に更新。

### 5. `tests/e2e/command-palette.spec.ts` (+13 -9)

- `setupE2EPage(page)` → `setupE2EPage(page, FIXTURE_WITH_TEST_PROJECT)` で project を投入
- 「新規セッション」の locator を `getByText("新規セッション").first()` から
  `getByRole("dialog").getByRole("option", { name: /新規セッション/ })` に変更。
  Welcome 撤去後は sidebar 「新規セッション」button も enabled 同文言になり、
  `.first()` が sidebar button を拾ってしまい dialog overlay の `bg-black/80` が
  pointer event を block する (実測: 30s timeout)。

### 6. `tests/e2e/monaco-diff.spec.ts` (+4 -2)

- `.monaco-editor` 先頭要素が `gutter monaco-editor` (visible=false) にマッチ
  してしまう問題を回避するため `.monaco-diff-editor` (diff 専用 root) に変更。

### 7. `tests/e2e/slash-palette.spec.ts` (+6 -2)

- `setupE2EPage(page)` → `setupE2EPage(page, FIXTURE_WITH_TEST_PROJECT)`。
  textarea placeholder が `/メッセージを入力/` regex にマッチする正規形になる。

## 検証結果

### TypeScript
```
$ npx tsc --noEmit
<exit 0>
```

### Next.js 本番ビルド (= SSR 検証)
```
$ npx next build
✓ Compiled successfully in 5.9s
✓ Generating static pages (7/7)
✓ Exporting (2/2)
Route (app)                 Size  First Load JS
┌ ○ /                     1.4 kB    116 kB
├ ○ /_not-found             1 kB    105 kB
├ ○ /settings           10.6 kB    158 kB
├ ○ /settings/mcp        6.52 kB    144 kB
└ ○ /workspace          4.51 kB    196 kB
```
→ `[project-store] list_active_sidecars failed: ReferenceError: window is not defined` **消失**。

### Playwright E2E (local Chromium, `npx playwright test --reporter=list --workers=1`)
```
Running 14 tests using 1 worker
  ✓   1 chat.spec.ts › sends a user message and receives streamed assistant reply (5.9s)
  ✓   2 command-palette.spec.ts › opens on Ctrl+K and invokes create_session ... (2.1s)
  ✓   3 command-palette.spec.ts › Escape closes the dialog (1.8s)
  ✓   4 image-paste.spec.ts › attaching clipboard image adds thumbnail to InputArea (2.1s)
  ✓   5 monaco-diff.spec.ts › Edit tool renders ToolUseCard with expandable Monaco diff (2.4s)
  ✓   6 preview-webview-window.spec.ts › clicking 'アプリ内で開く' invokes spawn_preview_window (1.2s)
  ✓   7 preview-webview-window.spec.ts › clicking 'ブラウザで開く' invokes shell open (1.2s)
  ✓   8 search-palette.spec.ts › opens on Ctrl+Shift+F and shows results after debounce (2.1s)
  ✓   9 sessions.spec.ts › creating a new session calls create_session and adds list item (1.5s)
  ✓  10 sessions.spec.ts › renaming existing session calls rename_session (2.0s)
  ✓  11 sessions.spec.ts › deleting existing session opens confirm dialog and calls delete_session (2.0s)
  ✓  12 settings.spec.ts › shows 3 tabs and switches content (2.1s)
  ✓  13 settings.spec.ts › toggling theme to dark adds dark class to <html> (827ms)
  ✓  14 slash-palette.spec.ts › typing / opens palette, selecting /ceo injects into textarea (2.0s)

  14 passed (34.0s)
```

フェール 6 件 (chat / command-palette / monaco-diff / preview-webview / sessions×2
相当の sessions.spec.ts rename + delete — 修正前は create も fail していたが
`FIXTURE_WITH_ONE_SESSION` fix で連鎖解決) + slash-palette は **すべて green**。
14 中 14 passed、所要時間 34 秒。

## v1.1.1 patch tag の必要性判断

**必要**: main branch に hotfix commit を入れた上で `v1.1.1` patch tag を切るべき。

理由:

1. **CI 再走 trigger**: GitHub Actions の E2E workflow は push 契機で走るが、
   本 hotfix は `main` への直 commit で自然 trigger される (commit 時点で fix 反映)。
   別途 tag push がなくても CI は回復する。

2. **release artifact**: 本修正は test / fixture 層 + SSR guard のみで、Tauri
   binary (`.msi` / `.dmg`) への反映は不要。ただし v1.1.0 tarball に含まれる
   test は broken 状態なので、**次 release 時に v1.1.1 tag を切って**「v1.1.0
   + E2E CI hotfix」として source tarball を更新するのが健全。

3. **branch 戦略**: v1.1.0 tag は保持 (release 済 msi の source 対応として)。
   v1.1.1 は `main` HEAD (本 commit 後) をそのまま tag する形で可。

推奨手順:
```bash
cd /c/Users/hiron/Desktop/ccmux-ide-gui
git add lib/stores/project.ts tests/e2e/
git commit -m "fix(v1.1.1): PM-946 E2E CI hotfix (SSR guard + PM-944 spec + fixture 整備)"
git push origin main           # CI 再走 trigger
# (CI green 確認後)
git tag v1.1.1
git push origin v1.1.1         # release workflow trigger
```

## 変更ファイル一覧

- `lib/stores/project.ts` (+8 -0) — SSR guard
- `tests/e2e/fixtures.ts` (+66 -4)
- `tests/e2e/helpers.ts` (+28 -5)
- `tests/e2e/preview-webview-window.spec.ts` (+15 -14)
- `tests/e2e/command-palette.spec.ts` (+13 -9)
- `tests/e2e/slash-palette.spec.ts` (+6 -2)
- `tests/e2e/monaco-diff.spec.ts` (+4 -2)

合計 7 files / +168 -33。Rust / sidecar / production component 本体は無変更。

## 申し送り (既知の小課題 / 将来 Phase)

1. `preview-webview-window.spec.ts` の `patchFsExistsTrue` workaround は fixture
   の selective true 化で冗長になったが、defense-in-depth として残置。削除希望が
   あれば PM-947 として個別 cleanup 推奨。
2. `list_sessions` mock は `projectId` 引数で filter していない (全件返す)。
   SessionList は client 側で filter しているため現状問題ないが、仕様整合 update
   は Phase 4.2 test infra 刷新と併せて検討。
3. 本 hotfix で `runningSidecarIds` を activeProjectId から seed したため、
   「sidecar 未起動状態での送信拒否」を検証する新 spec を追加する場合は
   fixture に opt-out flag (`suppressAutoRunning?: boolean`) を足す必要がある。
   現時点では該当 spec 無しのため無対応。

---

以上。オーナー / CEO 確認後、`main` へ push → CI green 確認 → `v1.1.1` tag
push の流れを推奨します。
