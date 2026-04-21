# PRJ-012 v1.0 / PM-925 — ブラウザプレビュー Phase 1 MVP 実装レポート

- **案件**: PRJ-012 Claude Code マルチプロジェクト IDE
- **タスク**: PM-925 Phase 1 MVP 実装（iframe + 外部ブラウザ fallback ハイブリッド）
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **日付**: 2026-04-20
- **担当**: 開発部門 (dev-v10)
- **種別**: 実装
- **前提調査**: `dev-v10-pm-925-browser-preview-feasibility.md`（実装方針確定済）
- **CEO 承認**: 案 A (iframe) + 案 C (外部 fallback) ハイブリッド、Phase 1 MVP 範囲

---

## 0. エグゼクティブサマリー

PM-925 調査で推奨された「案 A + 案 C ハイブリッド」方式で Phase 1 MVP を完成。Shell のタブモデルに「プレビュー」タブを 1 つ追加し、iframe で `http://localhost:*` の dev server を IDE 内に埋め込む。X-Frame-Options などで iframe 表示できないサイトは「外部で開く」ボタンで既存 `@tauri-apps/plugin-shell` の `open(url)` にフォールバックさせる。

- **変更ファイル**: 3 (Shell.tsx, editor.ts, tauri.conf.json)
- **新規ファイル**: 2 (preview.ts store, PreviewPane.tsx)
- **Rust 変更**: なし
- **依存追加**: なし (既存 plugin-shell + shell:allow-open を流用)
- **型検査**: `npx tsc --noEmit` 0 error
- **ビルド**: `npx next build` 成功 (.next / out export 完走)
- **Rust**: `cargo check` 0 error (既存 warning のみ)

---

## 1. 設計判断

### 1-1. 採用: 案 A (iframe) + 案 C (外部ブラウザ fallback)

調査レポート §4 の推奨どおり。Phase 1 は **単一 pane の iframe + Toolbar** 構成に絞り、Phase 2 以降で複数 URL タブ・分割対応・dev server auto-detect・mobile viewport emulation を検討する。

- **iframe 選択理由**: localhost dev server (Next.js / Vite / Expo web) は X-Frame-Options を送らないため 99% 動く。CSP `frame-src` に `http://localhost:* http://127.0.0.1:* http://*.localhost` を追加するだけで iframe が成立する。Tauri 2 の multi-webview (案 D) はまだ docs / 安定度が不足。
- **外部 fallback 理由**: 本番 URL (`https://*`) は X-Frame-Options で block される可能性があるため、「外部で開く」ボタンでユーザー明示操作に委ねる。既に `ApiKeyStep.tsx:43` で実証済の `@tauri-apps/plugin-shell` + `shell:allow-open` capability をそのまま流用。

### 1-2. 単一 pane 方式 (Phase 1)

指示どおり分割は **Phase 1 スコープ外**。MAX_PANES 相当の定数は設けず、Shell の splitButton switch には `preview` case を追加せず `default → null` でボタン非表示にした。Chat / Editor / Terminal の 3 view で分割済なので UI の一貫性は既存パターンを踏襲。

### 1-3. project ごとの独立 URL

dev server の port は project ごとに異なる (localhost:3000 / :5173 / :19006 など) ので、URL と履歴は project 単位で persist する。これは `terminal.ts` が `projectId` field で pty を分離しているのと同じパターン。

---

## 2. CSP 変更 diff

`src-tauri/tauri.conf.json` (line 27):

```diff
-      "csp": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost https://ipc.localhost https://api.anthropic.com; img-src 'self' data: blob: asset: http://asset.localhost https://asset.localhost",
+      "csp": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost https://ipc.localhost https://api.anthropic.com; img-src 'self' data: blob: asset: http://asset.localhost https://asset.localhost; frame-src http://localhost:* http://127.0.0.1:* http://*.localhost",
```

- **追加のみ**。他 directive (default-src / script-src / connect-src / img-src) は不変。
- `connect-src` の追加は **しない**: iframe 内の HMR WebSocket は iframe 自身の origin で評価されるため (ccmux-ide-gui の CSP には無関係)。調査レポート §5-3 の通り。
- **反映条件**: tauri dev 再起動 (Rust rebuild 自体は不要、config 再読込のみ)。オーナー確認済で tauri dev 停止中なので次回起動時に自動反映される。

---

## 3. 変更ファイル一覧

### 3-1. 新規

| ファイル | 行数 | 役割 |
|---|---:|---|
| `lib/stores/preview.ts` | 142 | project ごとの URL + history を zustand persist |
| `components/preview/PreviewPane.tsx` | 249 | iframe + Toolbar (Back/Forward/Reload/URL input/History/外部で開く) |

### 3-2. 最小 diff 修正

| ファイル | 変更内容 | 行数 |
|---|---|---:|
| `src-tauri/tauri.conf.json` | CSP に `frame-src` directive 追加（1 行 inline 延長） | 1 |
| `lib/stores/editor.ts` | `EditorViewMode` に `"preview"` literal 追加 + JSDoc 追記 | 5 |
| `components/layout/Shell.tsx` | `Monitor` icon import + `PreviewPane` import + プレビュータブ追加 + プレビュー container 追加 | 約 30 |

合計変更行数: **約 36 行** (+ 新規 391 行)。Shell.tsx の splitButton switch は変更せず、`default` case が `null` を返すため preview 時は分割ボタンが非表示になる（仕様通り）。

---

## 4. UI 設計

### 4-1. タブ配置

既存 Chat / Editor / Terminal の右隣に **「プレビュー」タブ** を追加:

```
┌─ TitleBar ──────────────────────────────────────────────┐
├─ Tabs ──────────────────────────────────────────────────┤
│ [💬 チャット] [📄 エディタ] [⌨ ターミナル] [🖥 プレビュー]│ ← ここ (Monitor icon)
├─ main pane ─────────────────────────────────────────────┤
│  PreviewPane (viewMode === "preview" で block 表示)     │
└─────────────────────────────────────────────────────────┘
```

- icon: `lucide-react` の `Monitor` (指示候補から Preview らしさで選定)
- 非表示時は `display:none` で mount 継続 → iframe state が保持される (タブ切替で dev server への再接続が走らない)

### 4-2. Toolbar 構成

```
┌──────────────────────────────────────────────────────────┐
│ ◀  ▶  ⟳   [http://localhost:3000          ] [📜] [外部で開く] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│              iframe (dev server 表示)                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- **Back / Forward** (`ArrowLeft` / `ArrowRight`): `iframe.contentWindow.history.{back,forward}()` を best-effort。cross-origin で例外が出たら `logger.debug` で silent。
- **Reload** (`RotateCw`): iframe の key を inc して完全再マウント。`contentWindow.location.reload()` は same-origin 制約で dev server によっては失敗することがあるため key 方式のほうが確実。
- **URL 入力欄**: `Input` + form。**Enter 送信 or blur** で commit → `setCurrentUrl(projectId, url)` で store を更新 → 局所 state と iframe src を同期。
- **History dropdown** (`History` icon): 最近使った URL 最大 10 件。`history.length === 0` では disable 表示。選択で即 commit + iframe 再読込。
- **外部で開く** (`ExternalLink` icon): 現在の URL を `@tauri-apps/plugin-shell` の `open()` に渡す。成功 / 失敗は `sonner` toast で通知。

### 4-3. プロジェクト切替連動

- `usePreviewStore.urls[activeProjectId]?.current` を reactive に読む。
- project 切替で別の URL が active になり、`useEffect([committedUrl])` で局所 input state を同期。iframe の key にも `activeProjectId` が含まれているため、別 project に切替え → 戻った場合でも iframe は正常な URL で再マウントされる。

### 4-4. Fallback 挙動 (Phase 1)

指示では「iframe の onError / timeout で『外部ブラウザで開きますか?』を promote」とあったが、**Phase 1 ではユーザー明示操作に一本化**した:

- **理由**:
  1. iframe の `onError` / `onLoad` は cross-origin では必ず発火しないか信用できない (X-Frame-Options block 時は `onLoad` が発火して真っ白 iframe になる動作が多い)。
  2. timeout 検知は UX 副作用が大きい (正常な slow load で誤検知 → ポップアップが邪魔)。
  3. Toolbar に常時「外部で開く」ボタンが見えるため、真っ白表示に気づいたユーザーが 1 click で fallback 可能。

- **Phase 2 申し送り**: iframe 内の `<title>` / `document.body.innerText` を same-origin 時のみ peek してブランク判定、cross-origin 時は timeout + 真っ白 canvas detect で promote を検討。

### 4-5. 存在しない project 時の guard

`useProjectStore.getActiveProject()` が `null` の場合は TerminalView と同じく「プロジェクトを選択するとプレビューが使えます」の案内を表示して early return。URL commit は `activeProjectId` が存在する時のみ有効。

---

## 5. 既知の制限 (Phase 2 / 3 / 4 申し送り)

### 5-1. Phase 2 範囲（複数 URL + auto detect + history UI 拡充）

- 複数 URL タブ切替 (localhost:3000 と :3001 を並置)。
- dev server auto-detect: terminal の stdout から port を抽出し候補 URL として history に push。
- URL 入力 validation の UI 強化 (localhost whitelist 外で外部ブラウザ自動 fallback の toast)。
- iframe 真っ白検知と「外部で開きますか?」dialog promote。

### 5-2. Phase 3 範囲（分割 / mobile viewport / 別 window）

- SplitView 対応 (Chat / Editor / Terminal と同様、MAX_PANES=2)。`usePreviewStore.urls` は project × pane の 2 次元になる。
- Mobile viewport emulation (375×667 / 768×1024 / 1280×800 の preset)。
- 案 B (Tauri WebviewWindow) を「別 window で開く」ボタンとして追加 (DevTools 利用可)。

### 5-3. Phase 4 範囲（secondary webview / DevTools）

- 案 D (Tauri 2 secondary webview) の調査完了後、iframe から段階移行。
- DevTools 起動 UI (iframe は DevTools 不可、secondary webview なら可能)。

### 5-4. 技術的 known limitation (Phase 1)

- **X-Frame-Options: DENY / SAMEORIGIN の本番サイト**: iframe で真っ白表示。現状はユーザーが「外部で開く」を押す。
- **HTTPS 本番 URL**: CSP `frame-src` は localhost 系のみ許可。HTTPS URL は CSP で block され iframe に表示されない (意図的)。外部ブラウザで開くことになる。
- **iframe history.back / forward**: cross-origin iframe では `SecurityError` が発生し得る。catch で silent (toast 出さず)。
- **HMR overlay**: Next.js の HMR エラー overlay は iframe 内で iframe 独自の origin で表示されるので問題なく動く想定 (実測要)。
- **sandbox 属性なし**: HMR WebSocket + script 実行を優先して `sandbox` は付けていない。CSP の `frame-src` whitelist でリスクを抑制している。任意 URL 入力は現状 validation なしなので、将来 Phase 2 で localhost 判定 + 外部ブラウザ自動分岐を追加推奨。

---

## 6. オーナー実機検証手順

### 6-1. 起動前準備

1. 別シェルで Next.js 等 dev server を立てておく:
   ```bash
   cd C:/path/to/some-nextjs-app
   npm run dev   # http://localhost:3000 が立ち上がる
   ```

### 6-2. tauri dev 起動

```bash
cd C:/Users/hiron/Desktop/ccmux-ide-gui
npm run tauri:dev
```

※ CSP 変更は tauri.conf.json なので `cargo rebuild` は不要、`tauri dev` 再起動で反映される。

### 6-3. 検証項目

1. **タブ表示**: TitleBar 直下のタブに「プレビュー」(Monitor icon) が Chat / Editor / Terminal の右に表示されるか。
2. **初期 URL**: プレビュータブを開くと URL 欄に `http://localhost:3000` が入っており、iframe に dev server の画面が表示されるか。
3. **URL 変更 + Enter**: URL 欄に `http://localhost:3001` を入力 → Enter で iframe が切替わるか。
4. **Reload**: ⟳ ボタンで iframe がリロードされるか (dev server のログに新しい request が出るか)。
5. **外部で開く**: 既定ブラウザ (Chrome 等) で当該 URL が開くか。
6. **History dropdown**: 📜 icon をクリックして過去入力した URL 候補が出るか、選択で iframe が切替わるか。
7. **HMR**: 対象アプリのソースを編集 → iframe 内で自動反映されるか (HMR WebSocket が動作している証拠)。
8. **タブ切替での state 保持**: プレビュー → エディタ → プレビュー で iframe が再読込されず、スクロール位置 / 入力欄の内容が保持されるか (display:none mount 維持の確認)。
9. **project 切替**: 別 project に切替 → プレビュー URL が独立していることの確認 (以前 project の URL がそのまま表示される場合は要再起動後確認)。
10. **HTTPS 本番 URL**: `https://www.google.com` を入力 → iframe は真っ白 (CSP block で正常動作)、「外部で開く」で既定ブラウザに遷移できるか。

### 6-4. 既知の非 issue

- iframe 内の console error (dev server 側のエラー) は iframe 内部の devtools でしか見えない。現状はブラウザの DevTools 代用。
- project 切替直後のごく短い間、前 project の URL が iframe に残ることがあるが `useEffect([committedUrl])` が走って即切替わる。

---

## 7. 完了条件チェックリスト

- [x] `src-tauri/tauri.conf.json` の CSP に `frame-src` 追加
- [x] `lib/stores/editor.ts` に `"preview"` viewMode 追加
- [x] `lib/stores/preview.ts` 新設
- [x] `components/preview/PreviewPane.tsx` 新設
- [x] `components/layout/Shell.tsx` にタブ追加
- [x] `cargo check` 0 error (既存 warning のみ)
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功 (all 9 static pages exported)
- [x] `"use client"` directive (PreviewPane / preview store)
- [x] `logger` wrapper 使用 (console.log / debug 不使用)
- [x] Rust 無変更
- [x] capability 無変更 (shell:allow-open 既存使用)
- [x] 過度な refactor なし、最小 diff

---

## 8. 次アクション (CEO 向け)

### 8-1. 完了報告

PM-925 Phase 1 MVP 実装完了。オーナー実機検証 (§6) を経て問題がなければ PRJ-012 tasks.md に PM-925 完了マークを付ける。

### 8-2. Phase 2 着手可否判断

Phase 2 (複数 URL / auto-detect / fallback promote UI) は工数 4〜6h。他 task との優先順位調整を仰ぐ。

### 8-3. Phase 3 / 4 は継続調査

案 D (Tauri 2 secondary webview) は Tauri 本体の multi-webview 安定度次第。四半期 1 回の調査更新で可否見直しを推奨。

---

**レポート終了**
