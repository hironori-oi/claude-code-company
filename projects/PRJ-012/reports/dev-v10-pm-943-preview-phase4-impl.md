# PRJ-012 v1.1 / PM-943 — Preview Phase 4.1 実装レポート (Tauri 2 secondary WebviewWindow / 案 D1 MVP)

- **案件**: PRJ-012 Claude Code マルチプロジェクト IDE
- **タスク**: PM-943 Preview 機能 Phase 4.1 — `@tauri-apps/api/webviewWindow` による別 window preview 実装
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **対象 branch**: `v1.1-dev`（本件で commit はしていない / オーナー判断待ち）
- **日付**: 2026-04-20
- **担当**: 開発部門 (dev-v10)
- **前提レポート**:
  - PM-942 (feasibility): `projects/PRJ-012/reports/dev-v10-pm-942-preview-phase4-feasibility.md`（§7 PM-943 prompt 骨子 / §3 capability 整理 / §8 risk）
  - PM-936 (iframe 撤退): `projects/PRJ-012/reports/dev-v10-pm-936-preview-iframe-retreat.md`

---

## 0. エグゼクティブサマリー

PM-942 feasibility §7 骨子に沿い、**案 D1 (`WebviewWindow` 別 window) MVP** を `v1.1-dev` に実装。iframe で詰まっていた X-Frame-Options / WebView2 site-isolation を原理的に回避する経路を復活させた。

- **変更ファイル**: 4 (+1 new)
  - `components/preview/PreviewPane.tsx`（大改修: 「アプリ内で開く」ボタン追加）
  - `lib/stores/preview.ts`（`openedWebviewLabels` state + register/unregister action + `partialize` 追加）
  - `src-tauri/capabilities/default.json`（permission 3 件追加）
  - `tests/e2e/fixtures.ts`（WebviewWindow 系 IPC を空 stub でモック）
  - `tests/e2e/preview-webview-window.spec.ts`（**新規**、E2E smoke 2 本）
- **cargo check**: 0 error（3 warning は既存の dead code）
- **cargo test --lib**: 105 tests all pass
- **npx tsc --noEmit**: 0 error
- **npx next build**: 成功（App Router 7 pages 静的 export）
- **E2E**: 新規 2 spec pass。既存 7 spec も pass 継続（既存 5 spec は v1.1-dev baseline で元から fail、PM-943 起因ではない）。
- **実工数**: 約 2.5〜3h（PM-942 見積 4.5〜5.5h の下限以下、既存 iframe 撤退版のコード基盤がそのまま使えたため）

---

## 1. 実装設計

### 1-1. UX: 2 ボタン並置（dropdown ではなく）

PM-942 §7-1 の「アプリ内で開く」「ブラウザで開く」2 ボタン並置案をそのまま採用。dropdown だと選択コストが上がり、MVP で「外部ブラウザ fallback を素早く取れる」要件を損なう。

```tsx
<Button onClick={handleOpenInApp} variant="default">
  <Monitor /> アプリ内で開く
</Button>
<Button onClick={handleOpenExternal} variant="outline">
  <ExternalLink /> ブラウザで開く
</Button>
```

- form submit (Enter キー) の既定挙動は **「アプリ内で開く」** にリマップ。iframe 撤退版では外部ブラウザが既定だったが、v1.1 の主経路はアプリ内 preview なので主動作を合わせる。
- 「ブラウザで開く」は `type="button"` で form submit から外し、明示クリックのみ。
- Input placeholder / 履歴 dropdown / Reload / Back/Forward は**依然非表示**（Phase 4.2 で再検討）。

### 1-2. WebviewWindow 設定

```ts
const label = `preview:${sanitize(activeProjectId)}`;
const preview = new WebviewWindow(label, {
  url: target,
  title: `Preview - ${target}`,
  width: 1280,
  height: 800,
  resizable: true,
  focus: true,
});
```

- **label**: `preview:${projectId}`。Tauri の label 仕様 (`[a-zA-Z0-9\-/:_]`) に合わせた sanitize を保険で入れた（UUID 前提なら no-op）。project 切替で label が衝突しない。
- **parent: "main" は指定しない**: PM-942 §4-1 では「`parent: "main"` + `alwaysOnTop: false`」推奨だったが、Windows では parent 指定が taskbar 挙動に影響し (メイン閉じるとき子も死ぬ owner 関係になる)、preview を独立 task として扱いたい要件に合わなかった。MVP では独立 window を優先。将来 macOS Space 問題が出たら parent オプションを再導入検討。
- **devtools**: MVP では JS 側の `devtools` options は渡さず、必要なら OS native の右クリック→検証 or `tauri.conf.json` の production 設定に依存。
- **width/height**: 1280x800 は指示文通り。

### 1-3. 重複 spawn 回避: `WebviewWindow.getByLabel` → `setFocus` fallback

```ts
const existing = await WebviewWindow.getByLabel(label);
if (existing) {
  let focusOk = false;
  try {
    await existing.setFocus();
    focusOk = true;
  } catch (focusErr) {
    // 壊れている疑い → destroy して下で再作成
    try { await existing.destroy(); } catch {}
    unregisterWebviewWindow(activeProjectId, label);
  }
  if (focusOk) {
    registerWebviewWindow(activeProjectId, label);
    toast.info("アプリ内プレビューをフォーカスしました");
    return;
  }
  // fall-through to spawn
}
```

- `getByLabel` は `plugin:window|get_all_windows` を内部で呼んで label 一致を探す非同期 API。
- `setFocus` 失敗 = window オブジェクトは残っているが挙動不能 → `destroy()` で掃除してから下で新規 spawn に fall-through。
- store の `unregisterWebviewWindow` は label 一致チェック付きで、race で別 window が既に登録された時の誤削除を防ぐ。

### 1-4. URL navigation 戦略

PM-942 §2-1-3 / §4-1 で言及した「URL 変更は close → create」方式を採用せず、**「2 回目は既存 window に focus、URL 変更はユーザーが明示的に close してから再実行」** とした。

理由:
- `new WebviewWindow()` で渡す `url` オプションは初回 navigate のみ。Tauri 2.10 時点で JS からの動的 navigate API (`webview.navigate(url)`) は stable ではない。
- 「URL 変えて連打したら毎回 close → create される」挙動はフラッシュ / 履歴消失で逆に UX 劣化する。MVP では「同 project は 1 つだけ、再利用優先」に寄せた。
- Phase 4.2 で navigate API が stable 化したら、この挙動を「URL が変わったら in-place navigate」に差し替え可能な設計になっている（`handleOpenInApp` 内の分岐ポイントが 1 箇所）。

### 1-5. Cleanup

Tauri 2 の `tauri://destroyed` を listen して、ユーザーが window の × ボタンで閉じた場合も store の `openedWebviewLabels` から掃除する。

```ts
preview.once("tauri://destroyed", () => {
  unregisterWebviewWindow(activeProjectId, label);
});
```

- `tauri://destroyed` は（PM-942 §8 R2 との関連で確認済）Tauri の共通 event で local listener ではなく global event system 経由。
- ccmux-ide 本体のアプリ終了時は OS が全 window を kill するので cleanup 不要。`openedWebviewLabels` は揮発 state なので次回起動時は空 map からやり直し。

### 1-6. capability 追加

**PM-942 §3-2 で Phase 4.1 に必要と予測した 3 件をそのまま追加**:

```json
"core:window:allow-close",    // 既存 window に close() を呼べる
"core:window:allow-destroy",  // 壊れた window の強制 destroy
"core:window:allow-set-focus" // 2 回目クリックで setFocus 優先
```

- PM-933 で追加済の `core:window:allow-create` / `core:webview:allow-create-webview-window` と組み合わせて spawn / focus / close の lifecycle を cover。
- `core:window:default` / `core:webview:default` の autogenerated permission list（`src-tauri/target/debug/build/tauri-*/out/permissions/window/autogenerated/default.toml`）には `close`/`destroy`/`set_focus` は**含まれていない**ことを確認した上で、必要分のみ最小追加した。
- `additionalBrowserArgs` / `csp` / `devCsp` / `dangerousDisableAssetCspModification` は **PM-931/933 の設定をそのまま流用**、secondary webview への効力は実機検証 (§5) 待ち。

---

## 2. PreviewPane UI 変更詳細

### 2-1. Before (PM-936)

- 単一 「外部ブラウザで開く」ボタン
- form submit = 外部で開く

### 2-2. After (PM-943)

- 2 ボタン並置（「アプリ内で開く」 primary / 「ブラウザで開く」 outline）
- form submit = アプリ内で開く
- 「アプリ内で開く」中は `isOpeningInApp` で disabled（連打ガード、spawn IPC 解決後に再有効化）
- 注記文言を更新: 「アプリ内で開く」は ccmux-ide 内の別 window で表示します（PM-943 / v1.1 Phase 4.1）。表示されないサイトは「ブラウザで開く」をご利用ください。
- tooltip: v1.0〜v1.1 の技術経緯を 4 行で要約（PM-925〜933 iframe → WebView2 security → secondary window 切替 → Phase 4.2 で in-window 予定）。

### 2-3. layout 微調整

URL input と 2 ボタンを **縦積み + flex-wrap** に変更。

```
[ URL input (full width) ]
[ アプリ内で開く ][ ブラウザで開く ]
```

従来の「URL + 1 ボタン」横並びに比べ、ボタンが 2 つに増えたため横幅 max-w-xl (576px) では窮屈。縦積みで各ボタン 10rem 程度を確保。

---

## 3. state 管理: `openedWebviewLabels` lifecycle

### 3-1. 新規フィールド

```ts
interface PreviewStoreState {
  urls: Record<string, PreviewProjectState>;           // 既存 (persist 対象)
  openedWebviewLabels: Record<string, string>;         // 新規 (persist 外)
  // ...
  registerWebviewWindow(projectId, label): void;       // 新規
  unregisterWebviewWindow(projectId, label?): void;    // 新規
}
```

### 3-2. persist / partialize

`preview.ts` は従来 **全 state を persist** していたが、今回 `openedWebviewLabels` を揮発 (実 window の生死と常にズレないよう localStorage に載せない) に切り替えるために `partialize` を追加:

```ts
partialize: (state) => ({ urls: state.urls }),
```

**後方互換性**:
- persist storage key: `ccmux-preview-urls` (変更なし)
- persist version: 1 (変更なし、migration 不要)
- 既存ユーザーの localStorage には `openedWebviewLabels` フィールドが存在しないが、zustand persist は hydrate 時に **初期 state と localStorage を shallow merge する**ため、`openedWebviewLabels: {}` の初期値がそのまま残る → 問題なし。

### 3-3. lifecycle 各 hook

| Event | 実装位置 | 呼び出す action |
|---|---|---|
| `tauri://created` | `handleOpenInApp` 内 `once` | `registerWebviewWindow(pid, label)` |
| `tauri://error` | 同上 | `unregisterWebviewWindow(pid, label)` |
| `tauri://destroyed` | 同上 | `unregisterWebviewWindow(pid, label)` |
| getByLabel で既存見つけた + `setFocus` 成功 | 同上 | `registerWebviewWindow(pid, label)` (念のため再登録) |
| `setFocus` fail + destroy 成功 | 同上 | `unregisterWebviewWindow(pid, label)` → fall-through to spawn |

---

## 4. 既存設定の流用・維持

### 4-1. そのまま流用

- `tauri.conf.json > security.csp` / `devCsp` (PM-931/933) — **変更なし**、secondary webview は navigate 先の CSP で動くため親の緩和策は影響しないが、「親 iframe」経路も将来に備えて残置。
- `tauri.conf.json > security.dangerousDisableAssetCspModification` — 変更なし。
- `tauri.conf.json > windows[0].additionalBrowserArgs` — 変更なし。PM-942 §2-3 / §8 R1 の通り、**secondary webview への伝播は未検証**。実機検証結果次第で Rust 側 `WebviewBuilder::additional_browser_args` 個別指定への切替を検討。

### 4-2. 新規追加

- `capabilities/default.json` に 3 permission（§1-6 参照）。
- `capabilities/default.json` の `description` フィールドに PM-943 の追加理由を追記。

---

## 5. 動作検証（静的 / E2E）

### 5-1. 静的検証

```
npx tsc --noEmit                     → 0 error
cd src-tauri && cargo check          → 0 error (3 pre-existing warning)
cd src-tauri && cargo test --lib     → 105 tests all pass
npx next build                       → success (7 pages static export)
npx next lint <changed files>        → no new warning (1 既存 warning)
```

### 5-2. E2E smoke 2 本追加

`tests/e2e/preview-webview-window.spec.ts` に以下 2 シナリオを追加:

1. **「アプリ内で開く」クリック → `plugin:webview|create_webview_window` が invoke される**
   - URL input に `http://localhost:4321` を流し込み、ボタンクリック後に invoke log を poll。
   - spawn options の `url` が入力値と一致、`label` が `/^preview:/` prefix を持つことを assert。
2. **「外部ブラウザで開く」クリック → `plugin:shell|open` が invoke される**
   - PM-936 の regression 検知用。v1.0 の「ブラウザで開く」経路が壊れていないことを保証。

両 spec ともローカル環境で **pass**。

**fixture 変更点**:
- `fixtures.ts` の `plugin:*` passthrough に WebviewWindow 系 4 stub を追加:
  - `plugin:window|get_all_windows` → `[]` (getByLabel が空配列を find して null を返すよう)
  - `plugin:webview|create_webview_window` → `null` (成功扱い、local event `tauri://created` が発火する)
  - `plugin:window|set_focus` / `close` / `destroy` → `null`
- これらは既存 spec にも共有されるが、いずれの既存 spec も WebviewWindow 系 IPC を呼ばないため副作用なしを確認済（既存 spec の pass/fail は PM-943 前後で不変）。

**project 有効化 workaround**:
- v1.1-dev baseline で `FIXTURE_WITH_TEST_PROJECT` は refreshStatus の `plugin:fs|exists=false` により project が drop される既知 race あり（chat.spec.ts 等 5 spec が baseline で fail）。
- 本 spec では `page.addInitScript` で `plugin:fs|exists` のみ true を返すよう invoke を wrap する局所 override を追加、PM-943 の検証を fixture race から切り離した。
- 将来 fixture 側が直ったら本 override は不要（spec 内にコメントで明記済）。

### 5-3. 全 E2E 実行結果

```
  9 passed (48.1s)
  5 failed (pre-existing, PM-943 起因ではない)
```

pre-existing 5 failure:
- `chat.spec.ts` / `command-palette.spec.ts` / `monaco-diff.spec.ts` / `sessions.spec.ts:19` / `slash-palette.spec.ts`
- いずれも `FIXTURE_WITH_TEST_PROJECT` の project drop race を踏んでいる。これは別 Issue として別途 fixture 修正タスクを切るべき。

---

## 6. オーナー実機検証手順

PM-942 §7 の regression 検証項目を **オーナー環境での Tauri dev 実行**で確認する手順:

### 6-1. 準備

```bash
cd C:\Users\hiron\Desktop\ccmux-ide-gui
git status  # 本実装は未 commit、オーナー確認後に commit する想定
npm run tauri:dev
```

- Rust の capability 変更が入っているため、**初回は必ず rebuild される**（2〜3 分）。
- tauri dev 起動後、ccmux-ide main window が開く。

### 6-2. 検証シナリオ

**シナリオ A: ローカル dev server (必ず表示されるべき)**

1. 任意のフォルダで `npx next dev` 等を起動（例: `http://localhost:3000`）
2. ccmux-ide 内でプロジェクトを作成または選択
3. プレビュータブへ切替
4. URL input に `http://localhost:3000` を入力
5. 「アプリ内で開く」クリック
6. **期待**: 別 window が開き、Next.js の dev 画面が表示される
7. toast: 「アプリ内プレビューを開きました」が右下に出る

**シナリオ B: X-Frame-Options ブロックで v1.0 iframe が詰まっていた URL**

1. プレビュータブで URL を以下の 3 つで順次試す:
   - `https://yahoo.co.jp/`
   - `https://github.com/`
   - `https://hiroyo.improver.work/`
2. 「アプリ内で開く」クリック
3. **期待**: 3 URL すべてで別 window が開き、**"接続が拒否されました" が出ない**
   - PM-925〜933 で詰まっていたのと同じ URL。iframe ではなく secondary webview のため X-Frame-Options / site-isolation が効かない（PM-942 §2-3 公式 doc 確認済）
4. ヤフー右カラム広告等、**embed iframe がサイト内部にあるケースで表示欠落が起きないか**も目視確認
   - もし欠落するなら PM-942 §8 R1 のケース。Phase 4.1.1 で Rust 側 `additional_browser_args` 個別指定を追加する

**シナリオ C: 重複 spawn 回避**

1. シナリオ A の後、プレビュータブで同じ URL のまま「アプリ内で開く」を **2 回目**クリック
2. **期待**: 既存の別 window が手前に来る (focus が移る)、**2 つ目の window は開かない**
3. toast: 「アプリ内プレビューをフォーカスしました」

**シナリオ D: 別 URL に変えて再度 spawn**

1. シナリオ A の別 window を閉じずに、URL を変えて「アプリ内で開く」
2. **期待（MVP 挙動）**: 既存 window に focus のみ戻る、URL は変わらない。URL 変更を反映したい場合はユーザーが既存 window を明示的に閉じてから再実行する
3. オーナーが「URL 変更で自動再作成してほしい」希望の場合は Phase 4.1.1 の挙動変更候補として別途判断

**シナリオ E: window 外部 close → store cleanup**

1. 別 window の OS × ボタンで閉じる
2. その直後に同プロジェクト同 URL で「アプリ内で開く」再クリック
3. **期待**: 新規 window が open する (既存 label を fetch しても null が返って新規 spawn 経路へ入る)
4. devtools の console で `[preview] webview window destroyed: preview:...` ログを確認

**シナリオ F: 「ブラウザで開く」regression 確認**

1. 任意 URL で「ブラウザで開く」クリック
2. **期待**: OS 既定ブラウザで URL が開く、toast「外部ブラウザで開きました」
3. PM-936 からの挙動維持

### 6-3. 失敗時の切り分け

| 現象 | 切り分け先 |
|---|---|
| 別 window が開くが **真っ白 / ERR_CONNECTION_REFUSED** | PM-942 §8 R1 (additionalBrowserArgs 伝播) の可能性大。Rust 側個別指定を追加する Phase 4.1.1 タスクを起票 |
| `new WebviewWindow()` の **capability error** が console に出る | permission 不足。error message に permission 名が出るので追加。`core:webview:*` 系で不足があれば追加 |
| **何も起きず toast.error も出ない** | dynamic import が失敗している可能性。devtools → console で `[preview] open in-app failed:` を探す |
| **別 window は開くが focus が main に残る** | OS 挙動差異 (Windows vs macOS)。`focus: true` オプションは spawn 時のみ効くため、setFocus() を spawn 直後に追加する必要あり (Phase 4.1.1) |

---

## 7. Phase 4.2 への申し送り

### 7-1. 本 MVP では対応しなかった項目

| 項目 | Phase 4.2 で検討 | 現状の理由 |
|---|---|---|
| 同一 window 内 webview (`@tauri-apps/api/webview` + `unstable` feature) | **yes**（本丸） | PM-942 §2-2 の通り、Tauri の `unstable` feature を production に入れる DEC が必要 |
| 動的 navigate API (close/create → webview.navigate) | **yes** | Tauri 2.10 現在 JS 側 stable API がない。stable 化を watch |
| 複数 URL タブ切替 | stretch | Preview pane 内で URL タブ UI を持つ。in-window webview と合わせて実装するのが自然 |
| dev server auto-detect (npm run dev stdout から port 抽出) | stretch | Terminal sidecar stdout を解析、またはプロジェクト設定の dev port フィールドを追加 |
| mobile viewport emulation | stretch | WebviewWindow の user agent / viewport メタ書換えで可能 |
| DevTools 自動起動 | stretch | `WebviewWindow.openDevtools()` は Rust side のみ、command 化が必要 |
| Rust 側 `on_navigation` allowlist | Phase 4.1.1 候補 | ユーザー自発入力 URL 前提では MVP では不要。XSS で `window.location` 書換え等があれば追加 |

### 7-2. 構造的にやり残した設計

- **`PreviewPane.tsx` の window 管理層の分離**: 現状は `handleOpenInApp` 1 関数に全ロジックが入っている。Phase 4.2 で in-window webview に差し替える時は、この関数の内部を hook (`usePreviewWebviewWindow`) に切り出す方針。
- **project 切替時の既存 preview window の挙動**: 現状は「閉じない」(ユーザー明示 close 優先)。Phase 4.2 で in-window になったらタブ切替ロジックに置き換わる。

### 7-3. R1 (additionalBrowserArgs 伝播) 次アクション

実機検証で secondary webview 内の iframe 表示欠落が確認された場合、以下の Rust side PoC で切り分け:

```rust
// src-tauri/src/commands/preview.rs (新規)
use tauri::{WebviewWindowBuilder, WebviewUrl, AppHandle};

#[tauri::command]
async fn spawn_preview_window(
    app: AppHandle,
    label: String,
    url: String,
) -> Result<(), String> {
    WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::External(url.parse().map_err(|e: url::ParseError| e.to_string())?),
    )
    .title(format!("Preview - {}", url))
    .inner_size(1280.0, 800.0)
    .additional_browser_args(
        "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,IsolateOrigins,\
         site-per-process --disable-site-isolation-trials",
    )
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
}
```

Frontend では `invoke("spawn_preview_window", ...)` で呼ぶ形に差し替え。JS `WebviewWindowOptions` には `additionalBrowserArgs` 相当が存在しないため、カスタム引数を投入したい場合は Rust command 経由にする必要がある。

---

## 8. 変更ファイル一覧

```
ccmux-ide-gui/
├── components/preview/PreviewPane.tsx              (大改修, ~260 lines)
├── lib/stores/preview.ts                           (小規模拡張, +50 lines)
├── src-tauri/capabilities/default.json             (+3 permissions, description 更新)
├── tests/e2e/fixtures.ts                           (+4 stubs in plugin:* passthrough)
└── tests/e2e/preview-webview-window.spec.ts        (新規, 2 smoke test)
```

**commit 分割の提案** (オーナー判断):
- **commit 1**: `src-tauri/capabilities/default.json` + `lib/stores/preview.ts` (store と capability の土台)
- **commit 2**: `components/preview/PreviewPane.tsx` (UI 実装、commit 1 に依存)
- **commit 3**: `tests/e2e/fixtures.ts` + `tests/e2e/preview-webview-window.spec.ts` (E2E smoke)

もしくは PM-943 一括 commit でも良い。CHANGELOG には v1.1.0 エントリとして「アプリ内プレビュー (Tauri secondary WebviewWindow) を追加、iframe 撤退版 (v1.0) から復活」を記載する。

---

## 9. CEO 報告用サマリー

### 9-1. 完了条件チェック

- [x] PreviewPane に「アプリ内で開く」ボタン追加
- [x] `WebviewWindow` で secondary window spawn、任意の HTTPS URL が表示可能な設計（静的追跡で確認、実機検証は §6 でオーナー側）
- [x] localhost URL / yahoo.co.jp / github.com 等、iframe で詰まっていた URL も別 window なら表示可能な設計 (PM-942 §2-3 根拠)
- [x] window 閉じる / アプリ終了時の cleanup (`tauri://destroyed` listener + openedWebviewLabels 揮発化)
- [x] `cargo check` 0 error
- [x] `cargo test --lib` pass (105/105)
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功
- [x] レポート作成 (本ファイル)
- [x] 実装設計 (capability / WebviewWindow config / URL navigation 戦略) 明記
- [x] PreviewPane UI 変更 (2 ボタン並置理由) 明記
- [x] state 管理 (activeWindow の lifecycle) 明記
- [x] Phase 4.2 への申し送り (in-window webview、navigate API の stable 化待ち等) 明記
- [x] オーナー実機検証手順 (localhost / X-Frame block サイト 3 例) 明記

### 9-2. CEO 判断を仰ぐポイント

- **(A)** 本実装を `v1.1-dev` に commit → push するタイミング（オーナー実機検証の前か後か）
- **(B)** 実機検証 §6 シナリオ B で X-Frame block URL が **やはり表示されない**場合、Phase 4.1.1 として Rust 側 `additional_browser_args` 対応を即時追加するか、Phase 4.2 まで待つか
- **(C)** シナリオ D (URL 変更で既存 window が更新されない挙動) について、MVP 仕様通りで行くか / 「URL 変わったら close → create」に変更するか（4.1.1 候補）
- **(D)** commit 分割は 3-split / 一括のどちらにするか

### 9-3. 実工数

**約 2.5〜3h**（PM-942 見積 4.5〜5.5h の下限以下）。要因:
- PM-936 iframe 撤退版の UI 骨格 (input / form / toast / tooltip) がそのまま流用できた
- PM-942 feasibility で capability / 設計が事前に詰まっており、試行錯誤なしで書けた
- 新規 Rust 実装なし (JS API 経由 spawn のみで Phase 4.1 MVP 成立)

---

**レポート終了**

次アクション: CEO レビュー → commit 判断 (§9-2 A) → オーナー実機検証 (§6) → Phase 4.2 判断。
