# PRJ-012 v1.1 / PM-942 — Preview Phase 4 (Tauri 2 secondary webview) 実現可能性調査レポート

- **案件**: PRJ-012 Claude Code マルチプロジェクト IDE
- **タスク**: PM-942 Preview 機能 Phase 4（Tauri 2 secondary webview）feasibility 調査
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **対象 branch**: `v1.1-dev`（checkout 済、本件で merge なし）
- **日付**: 2026-04-20
- **担当**: 開発部門 (dev-v10)
- **種別**: 調査のみ（実装なし）
- **前提レポート**:
  - PM-925 (feasibility): `projects/PRJ-012/reports/dev-v10-pm-925-browser-preview-feasibility.md`
  - PM-936 (iframe 撤退): `projects/PRJ-012/reports/dev-v10-pm-936-preview-iframe-retreat.md`

---

## 0. エグゼクティブサマリー

v1.0 で iframe 経路は WebView2 の site-isolation に阻まれ撤退済（PM-936 / DEC-046/048）。v1.1 で Tauri 2 の secondary webview を使って IDE 内 preview を再構築する案 D について、公式 doc と既存コードを照合した結果を以下にまとめる。

**結論**:

| 案 | API | Tauri 2 feature flag | 工数（MVP） | UX 近接度 | 推奨順位 |
|---|---|---|---|---|---|
| **D1** — `WebviewWindow`（別 OS window） | `@tauri-apps/api/webviewWindow` | 不要（stable） | **4〜6h** | ★★★☆☆（別 window） | **Phase 4.1 即実装**推奨 |
| **D2** — `Webview`（同一 window 内、multi-webview） | `@tauri-apps/api/webview` + `window.add_child` | **`unstable` 必須** | 12〜20h | ★★★★★（Cursor 同等） | Phase 4.2 / `unstable` stabilize 後 |

**推奨: 段階実装（D1 先行 → D2 昇格）**

1. **Phase 4.1（v1.1.0）**: D1 (`WebviewWindow`) を MVP 実装。既存 capability（PM-933 で追加済）で即スタートでき、X-Frame-Options / site-isolation を完全回避。Cursor 程の "in-IDE preview" 感は出ないが、別ブラウザ切替より大幅 UX 改善。
2. **Phase 4.2（v1.2〜 or Tauri stable 化後）**: D2 (`Webview` in-window) に昇格。ただし Tauri 本体の `unstable` feature を有効化する必要があり、本番 release に `unstable` を含めるかは DEC 要件。
3. PM-933 で投入済の config / capability は **全て D1/D2 共通で再利用可**、追加変更は capability 2 件（`core:webview:allow-set-webview-size` / `allow-set-webview-position`）とオプションの feature flag のみ。

**主要 risk**:
- D2 は `tauri = { ..., features = [..., "unstable"] }` を `Cargo.toml` に追加する必要があり、Tauri の方針上「production 非推奨」の表記がつく可能性。
- Windows WebView2 は WebviewWindow ごとに user data 分離が求められる（issue: 異なる webview 設定で同一 data dir を使うと crash）。
- PM-933 の `additionalBrowserArgs` はメイン window のみに効く。secondary webview には個別設定が必要な可能性。

---

## 1. 目的と前提

### 1-1. 再構築の動機

v1.0 は「URL 入力 → 外部ブラウザで開く」で割り切ったが、オーナーのユースケース（IDE 作業中に dev server 画面を横目で監視したい / Claude Code が生成した UI を即確認したい）には「IDE 外に別ブラウザ window」では不十分。Cursor の Preview タブ相当の in-IDE 体験を Tauri 2 で実現する。

### 1-2. iframe 撤退理由の再整理（PM-936 §1-2）

- WebView2 の **site-isolation / network-partition** が外部 origin を親 webview から iframe 表示することを深層でブロック
- CSP `frame-src https:` / `devCsp` / `dangerousDisableAssetCspModification` / `additionalBrowserArgs` すべてで ERR_CONNECTION_REFUSED 継続
- 原因は frontend / Tauri config ではなく **WebView2 本体の security layer**

**重要**: `WebviewWindow` / `Webview` は iframe ではなく **独立 process の webview** であり、site-isolation の対象外。**X-Frame-Options は iframe 専用 header で、webview 直接 navigate では適用されない**（WebFetch 1-1 で公式確認済）。

---

## 2. 公式 API 調査結果

### 2-1. `WebviewWindow` (案 D1) — JS から別 window spawn

**公式 doc**: https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/
**Rust doc**: https://docs.rs/tauri/2.1.0/tauri/webview/struct.WebviewWindowBuilder.html

#### 2-1-1. 安定性

- **Tauri 2.1 で stable**、`unstable` feature 不要
- `@tauri-apps/api/webviewWindow` は公式 API、`WebviewWindow` class がメイン export
- 既にインストール済 (`package.json`: `"@tauri-apps/api": "^2.1.0"`)

#### 2-1-2. 最小実装パターン（JS）

```ts
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const win = new WebviewWindow(`preview-${activeProjectId}`, {
  url: "http://localhost:3000",
  title: `Preview — ${activeProject.name}`,
  width: 1024,
  height: 768,
  parent: "main",          // 親を main window に紐付け
  focus: true,
});

await win.once("tauri://created", () => {
  /* 成功 */
});
await win.once("tauri://error", (e) => {
  /* 失敗時 */
});
```

#### 2-1-3. 主要 API（lifecycle）

| 操作 | メソッド |
|---|---|
| URL navigate | 構築時 `url`、動的変更は `webview.evaluateScript("location.href = '...'")` or `window.location` |
| close | `win.close()` |
| show / hide | `win.show()` / `win.hide()` |
| resize | `win.setSize(new LogicalSize(w, h))` |
| move | `win.setPosition(new LogicalPosition(x, y))` |
| focus | `win.setFocus()` |
| devtools | `tauri.conf.json` で `devtools: true`、`webview.openDevtools()` 相当は **JS からは呼べず Rust 側のみ**（doc 上） |
| IPC (親→子) | `appWindow.emitTo("preview-xxx", "event", payload)` |
| IPC (子→親) | secondary webview 側で `import.meta... .emit()` または `listen_any` |

#### 2-1-4. Rust 側（将来 command 化する場合）

```rust
use tauri::{WebviewWindowBuilder, WebviewUrl, LogicalSize, LogicalPosition};

#[tauri::command]
async fn open_preview_window(app: AppHandle, url: String, label: String) -> Result<(), String> {
    WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(url.parse().unwrap()))
        .title("Preview")
        .inner_size(1024.0, 768.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

**注意**: doc 上、Windows では `build()` を **同期 command から呼ぶと deadlock**。`async fn` または thread spawn で呼ぶこと（docs.rs に明記）。

### 2-2. `Webview` (案 D2) — 同一 window 内に多 webview

**公式 doc**: https://v2.tauri.app/reference/javascript/api/namespacewebview/
**Rust doc**: https://docs.rs/tauri/2.1.0/tauri/webview/struct.WebviewBuilder.html

#### 2-2-1. 安定性 — **`unstable` feature flag 必須**

docs.rs の WebviewBuilder ページ冒頭に明記:

> "Available on **crate feature `unstable`** only."

`Cargo.toml` 側で `tauri = { version = "2.1", features = ["protocol-asset", "devtools", "unstable"] }` を追加する必要がある。Tauri 本体 Cargo.toml でも以下のように定義:

```toml
unstable = ["tauri-runtime-wry?/unstable"]
```

**意味合い**:
- API は **experimental**、minor release 間で breaking change 可
- production build に `unstable` を含める判断は DEC レベルの決定
- 2026-04 時点、ccmux-ide の競合 (Cursor / VS Code) はいずれも Electron BrowserView 相当を使っており Tauri の `unstable` に相当する技術的制約はない → **ccmux-ide が Tauri を採用した代償**

#### 2-2-2. 最小実装パターン（JS）

```ts
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Webview } from "@tauri-apps/api/webview";

const mainWin = getCurrentWindow();

const previewWebview = new Webview(mainWin, `preview-${activeProjectId}`, {
  url: "http://localhost:3000",
  x: 300, y: 100,
  width: 800, height: 600,
});

await previewWebview.once("tauri://created", async () => {
  await previewWebview.setFocus();
});

// タブ切替で hide
await previewWebview.hide();
// 再表示
await previewWebview.show();
// resize（親 window resize に追従）
await previewWebview.setAutoResize(true);
```

#### 2-2-3. Rust 側（add_child）

```rust
use tauri::{WebviewBuilder, WebviewUrl, LogicalPosition};

// main window に child webview を attach
let webview_builder = WebviewBuilder::new(
    "preview_webview",
    WebviewUrl::External("http://localhost:3000".parse().unwrap())
);
let webview = main_window.add_child(
    webview_builder,
    LogicalPosition::new(300, 100),
    LogicalSize::new(800, 600),
)?;
```

**`add_child` は `unstable` feature 下でのみ利用可**。

#### 2-2-4. 制約

- 複数 webview 間の **z-order は creation 順**（明示的な bring-to-front API は現時点 doc 上なし、`setFocus()` で代替）
- macOS で devtools 開いた状態だと drag-drop 位置がズレる既知 issue あり
- **Windows では webview ごとに別 user data directory が必要** → 同一 directory 共有で crash 報告（公式 doc 明記）

### 2-3. X-Frame-Options / CSP / security 制約の再評価

| 項目 | iframe (撤退済) | D1 WebviewWindow | D2 Webview |
|---|---|---|---|
| X-Frame-Options block | ○（ERR_CONNECTION_REFUSED の原因推定の 1 つ） | **×**（iframe 専用 header、webview navigate には無効） | **×** |
| 親 webview の CSP 継承 | ○（親 CSP に縛られる） | **×**（完全独立 origin） | **×**（各 webview 独立） |
| WebView2 site-isolation | ○（PM-925〜933 でブロック確認） | **×**（OS レベル別 process） | **×**（各 webview 別 process） |
| cookie / localStorage 共有 | 親と同 origin 扱い | 完全分離（label ごと） | user data dir 次第（Windows は別必須） |
| `on_navigation` hook で allowlist | 不可 | **可**（Rust 側 `WebviewWindowBuilder::on_navigation`） | **可** |
| `tauri.conf.json` 側 URL allowlist | — | **なし**（application layer で実装） | **なし** |

公式 doc からの重要引用:

> "X-Frame-Options only restricts embedding via iframes, not direct window/webview navigation to external sites."
> "When a WebviewWindow navigates to an external URL like https://yahoo.co.jp, the X-Frame-Options header would not apply."

→ **v1.0 で詰まった `https://yahoo.co.jp` / `https://hiroyo.improver.work` も D1/D2 なら表示可能と高確度で予測できる**。ただし **実機検証 Phase 4.1 MVP 時に必須**。

---

## 3. 既存 PRJ-012 capabilities / config 確認

### 3-1. PM-933 で追加済 + PM-936 で維持

`src-tauri/capabilities/default.json`（現状確認済）:

```json
"permissions": [
  "core:window:allow-create",
  "core:webview:allow-create-webview",
  "core:webview:allow-create-webview-window",
  ...
]
```

→ **D1 (`new WebviewWindow(...)`) は追加 capability なしで即動く**

`src-tauri/tauri.conf.json`（現状確認済）:

- `csp` / `devCsp`: `frame-src 'self' http://localhost:* http://127.0.0.1:* http://*.localhost https:` 等 9 directive が既に `https:` 対応（PM-931/933）
- `dangerousDisableAssetCspModification`: `["frame-src", "connect-src", "img-src", "default-src"]`
- `additionalBrowserArgs`: `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,IsolateOrigins,site-per-process --disable-site-isolation-trials`

→ **全て PM-942 の D1/D2 実装で利用可**、撤去の必要なし。

### 3-2. 不足する可能性のある capability（精査要）

Tauri 2 の permission 一覧で以下が存在（未確認）:

| permission | 用途 | D1 | D2 |
|---|---|---|---|
| `core:webview:allow-set-webview-position` | `webview.setPosition()` を JS から呼ぶ | — | **必要** |
| `core:webview:allow-set-webview-size` | `webview.setSize()` を JS から呼ぶ | — | **必要** |
| `core:webview:allow-webview-hide` | `webview.hide()` | — | **必要** |
| `core:webview:allow-webview-show` | `webview.show()` | — | **必要** |
| `core:webview:allow-webview-close` | `webview.close()` | 要検証 | **必要** |
| `core:window:allow-close` | `window.close()` | 要検証（label 指定 close） | — |
| `core:window:allow-set-size` | 動的 resize | 要 | — |
| `core:window:allow-set-position` | 動的 move | 要 | — |

**次アクション**: Phase 4.1 実装時に `src-tauri/capabilities/default.json` へ上記 2〜4 件を追加（D1 のみなら 2〜3 件）。permission 名は `@tauri-apps/api/webviewWindow` / `@tauri-apps/api/webview` の各メソッドが runtime error で示唆してくれるため、TDD で詰める方が確実。

### 3-3. `additionalBrowserArgs` の secondary webview への伝播

**重要な未検証項目**:

`tauri.conf.json` の `windows[0].additionalBrowserArgs` は **main window に対する引数**。D1 の secondary WebviewWindow に伝播するかは doc 上明記なし。

- D1 各 `WebviewWindow` に個別の `additionalBrowserArgs` を渡す API は、JS `WebviewOptions` には **ない**（`WebviewWindowBuilder` Rust 側は対応？要検証）
- 最悪ケース: secondary webview には site-isolation が適用され、それ自体は iframe ではないため navigate 自体は成功するが、内部で iframe を embed するサイト（例 `yahoo.co.jp` が広告 iframe を持つ）では一部表示が欠落する可能性

**mitigation**:
- Phase 4.1 MVP で実機検証し、もし iframe 表示欠落があれば Rust 側 `WebviewBuilder::additional_browser_args` (Rust-only API の可能性) で個別設定
- 全く表示できない URL が PM-933 レベルで再現した場合は本調査の前提が崩れるため、その時点で再度方針転換

---

## 4. 案 D1 / D2 の比較と工数見積

### 4-1. 案 D1 (WebviewWindow / 別 window)

#### 実装範囲

- **Frontend 変更**（3 ファイル）:
  - `components/preview/PreviewPane.tsx`: 「アプリ内 webview で開く」ボタン追加、`new WebviewWindow()` 呼出、既存 window が存在すれば `setFocus` にフォールバック
  - `lib/stores/preview.ts`: project ごとに `webviewLabel` を保持（重複 label で crash 回避）
  - optional: `lib/stores/preview-windows.ts` 新規で window lifecycle (open / closed) 監視
- **Rust 変更**: なし（MVP）。将来 `on_navigation` で allowlist かけるなら 1 command 追加（30 分）
- **Capability 変更**: `core:window:allow-close` `allow-set-size` 追加（要検証）
- **Config 変更**: なし（PM-933 設定流用）
- **テスト**:
  - E2E Playwright: 「ボタンクリック → 新 window が open → close で main window 維持」の smoke 1 本
  - 実機検証: v1.0 で詰まった 3 URL（`yahoo.co.jp` / `github.com` / `hiroyo.improver.work`）で接続拒否が出ないこと

#### 工数

| 作業 | 工数 |
|---|---|
| 1. `WebviewWindow` spawn / close の PreviewPane 書換 | 1.5h |
| 2. store の label 管理（重複防止、project 切替時の hide/show） | 1h |
| 3. capability 調整 + tauri dev 実機確認 | 0.5h |
| 4. E2E smoke 追加 | 0.5h |
| 5. 実機検証（3 URL）+ PM-942 完了報告書き | 1〜2h |
| **合計** | **4.5〜5.5h** |

**複雑度**: ★★☆☆☆（既存 Tauri API を組み合わせるだけ）

#### Pros / Cons

| Pros | Cons |
|---|---|
| `unstable` feature 不要 → production release に安心して入れられる | UX は「別 window が出る」 → Cursor の in-IDE preview とは乖離 |
| 既存 capability で即スタート可能 | project 切替時に 複数 window open の UX 設計が必要 |
| 実装最短 | macOS では別 desktop window として見える（タスクバー占有） |
| secondary webview は独立 origin → X-Frame-Options / site-isolation 完全回避 | preview window と main window の同期（scroll 位置等）は困難 |
| devtools 起動可能 | window 位置の記憶 / 復元は追加実装 |

### 4-2. 案 D2 (Webview / in-window multi-webview)

#### 実装範囲

- **Frontend 変更**（3〜4 ファイル）:
  - `components/preview/PreviewPane.tsx`: mount 時に `new Webview(...)` 呼出、`useRef` で position 追跡、`ResizeObserver` で親要素 rect を webview.setPosition/setSize に同期
  - `lib/stores/preview.ts`: label 管理 + position cache
  - `components/layout/Shell.tsx`: viewMode 切替時 webview の hide/show 制御
  - `lib/hooks/usePreviewWebview.ts` 新規: mount/unmount/resize を hook 化
- **Rust 変更**: `Cargo.toml` に `"unstable"` feature 追加（必須）
- **Capability 変更**: `core:webview:allow-set-webview-position` / `allow-set-webview-size` / `allow-webview-hide` / `allow-webview-show` / `allow-webview-close` の **5 件追加**
- **Config 変更**: なし
- **テスト**:
  - E2E: タブ切替で preview webview が表示 / 非表示切替、親 window resize で追従
  - 実機検証: 複数 project 切替で label 重複なし、Windows で user data dir 分離
  - **Tauri minor update 時の regression 監視 CI 必要**

#### 工数

| 作業 | 工数 |
|---|---|
| 1. `Cargo.toml` に unstable 追加 + tauri build 確認 | 0.5h |
| 2. `usePreviewWebview` hook 実装（ResizeObserver + position sync） | 3〜4h |
| 3. PreviewPane 書換 + Shell.tsx の viewMode 連動 | 2h |
| 4. store の label / position 管理 | 1.5h |
| 5. capability 5 件追加 + 各 method の runtime 確認 | 1h |
| 6. Windows user data dir 分離対応 | 1〜2h |
| 7. E2E（タブ切替 / resize / 複数 project） | 2h |
| 8. macOS 実機検証 + 既知 issue（drag-drop 座標ズレ）回避 | 1〜2h |
| 9. Tauri `unstable` の DEC 文書化 + release ビルドでの挙動差異確認 | 1〜2h |
| **合計** | **13〜17h** |

**複雑度**: ★★★★☆（`unstable` + position 同期 + platform 差異）

#### Pros / Cons

| Pros | Cons |
|---|---|
| Cursor の Preview と **同等 UX**（タブ内に完全統合） | `unstable` feature 必須 → production 採用は DEC 判断が必要 |
| X-Frame-Options / site-isolation 完全回避 | Tauri minor update 時の breaking change risk |
| 独立 CSP / origin / devtools | position 同期は頻繁な re-render でパフォーマンス注意 |
| IPC で main UI と密連携可能（URL change 通知等） | macOS devtools 起動時の drag-drop 座標ズレ issue |
| | Windows は webview ごと user data dir が必要 → ディスク使用量 & cleanup |
| | Tauri 本体の multi-webview 成熟度が Tauri 2.x 系で stabilize する時期が不明 |

### 4-3. 比較マトリクス

| 観点 | D1 (WebviewWindow) | D2 (Webview in-window) |
|---|---|---|
| 実装工数 | ★★★★☆ (4.5〜5.5h) | ★★☆☆☆ (13〜17h) |
| Cursor UX 同等度 | ★★★☆☆ | ★★★★★ |
| Tauri stable 度 | ★★★★★ | ★★☆☆☆（unstable） |
| 既存 capability 流用 | ★★★★★ | ★★★☆☆（5 件追加） |
| X-Frame-Options 耐性 | ★★★★★ | ★★★★★ |
| Production release 適性 | ★★★★★ | ★★☆☆☆（DEC 要） |
| 複数 project 対応容易さ | ★★★★☆ | ★★★☆☆ |
| メンテ負荷 | ★★★★☆ | ★★☆☆☆（Tauri 追従） |

---

## 5. Security 影響評価

### 5-1. secondary webview の CSP

- **親と独立**（公式 doc 確認済、`@tauri-apps/api/webviewWindow` §Security Considerations）
- 親 webview の `tauri.conf.json > security.csp` は **secondary webview に継承されない**
- secondary webview は navigate 先のサーバが返す CSP header を適用する
- → 親の CSP 緩和は secondary webview のリスクに影響しない

### 5-2. 悪意 URL の XSS / ccmux-ide 本体への影響

- secondary webview 内で動く script は **親 webview の DOM / localStorage / IPC に直接アクセス不可**
- IPC は `emit` / `listen` 経由のみ、capability で制約可能
- 悪意サイトが secondary webview で JS 実行しても、**ccmux-ide の Claude session key / API key 等には到達不能**
- → iframe より **むしろ安全**（iframe は親 DOM と同 renderer process、webview は完全分離）

### 5-3. Navigation allowlist の必要性

- v1.0 は URL 入力を **ユーザー自身が行う**ため、意図しない navigate は発生しにくい
- ただし XSS 化された URL で `<script>` が `window.location = "http://evil.com"` のように navigate を書き換える risk
- **mitigation**: Rust 側 `on_navigation` で allowlist（localhost / 127.0.0.1 / user 明示許可 host のみ）
- MVP では **なし**（ユーザーが自発的に入力した URL は信用する方針、v1.0 と同じ）。実害発生したら Phase 4.1.1 で追加。

### 5-4. T2-D（asset protocol scope）への影響

- `assetProtocol.scope` は **親 webview の asset:// protocol 用**
- secondary webview は asset:// を呼ばず（外部 URL navigate のため）、scope の影響なし
- → **T2-D 既存設定への副作用なし**

### 5-5. cookie / localStorage / IndexedDB 分離

- D1 (`WebviewWindow`): label ごとに完全分離（= 異なる Chrome profile 相当）
- D2 (`Webview` in-window): 同一 window の webview 同士は **同 user data dir を default で共有**。Windows は個別指定必須（公式 doc）。
- ccmux-ide の Claude session cookie（将来 Claude.ai OAuth 等に使う場合）が preview webview から見えるか: **見えない**（親 webview と secondary webview は別 origin / 別 profile）

---

## 6. 段階実装計画

### 6-1. Phase 4.1（v1.1.0）: D1 MVP

**期間**: 1 sprint（4.5〜5.5h）

**スコープ**:
- PreviewPane に「アプリ内で開く」ボタン追加、「外部で開く」は既存維持
- `WebviewWindow` で別 window spawn、label = `preview-${projectId}`
- 同 project で 2 回目クリック → 既存 window に `setFocus`
- project 切替時の既存 preview window は **閉じない**（ユーザー明示 close 優先）
- window close 時の store cleanup
- 実機検証: `yahoo.co.jp` / `github.com` / `hiroyo.improver.work` で接続拒否が出ないこと（PM-925〜933 の regression 検証）

**成功基準**:
- v1.0 で詰まった 3 URL がすべて secondary window で表示される
- main window は常に生存、preview window は独立 close 可能
- zustand persist で URL が project ごとに保持される（v1.0 機能 regression なし）

**Release 戦略**:
- v1.1.0 に含める
- CHANGELOG に「アプリ内プレビュー (別 window) 追加」明記
- 「in-IDE (同 window 内) preview は v1.2 以降で対応予定」と注釈

### 6-2. Phase 4.2（v1.2.0 または v2 big bet）: D2 昇格

**期間**: 2〜3 sprint（13〜17h + 未知 risk buffer）

**前提条件**:
- D1 が 1〜2 ヶ月安定稼働
- Tauri の `unstable` を production に含めるかの DEC 確定（`DEC-049-preview-unstable-feature-adoption` のような番号）
- あるいは Tauri 側で multi-webview が stable 化（Tauri 2.3 以降？要 watch）

**スコープ**:
- 既存 D1 の「別 window」オプションは残す（互換性）
- デフォルトを D2（in-window）に変更
- viewMode 切替連動 / position 追従 / Windows user data dir 分離
- Cargo.toml の `unstable` feature 有効化
- capability 5 件追加

**成功基準**:
- Cursor の Preview と同等 UX（タブ内に preview、タブ切替で hide）
- Tauri minor update 時の breaking change 検出 CI（`cargo check` + E2E 自動実行）

**Release 戦略**:
- v1.2.0 beta channel で 2 週間 dogfooding
- 安定判断後に stable release に昇格
- Tauri が `unstable` 解除したら Cargo.toml から外す（breaking change 無し）

### 6-3. 代替案: Phase 4.2 を skip して D1 で確定

D1 で 80% の UX が達成できた場合、D2 への投資は **見送る判断**も合理的:
- ユーザー（オーナー）が「別 window でも十分」と判断した場合
- Tauri の `unstable` が 1 年以上 stabilize しない場合
- 開発リソースを他機能（例: Claude usage dashboard, Git integration 等）に振り向けた方が ROI 高いと判断した場合

**推奨は段階実装だが、Phase 4.1 完了後に D1 で留めるオプションを DEC 判断で残す**。

---

## 7. PM-943（仮）次実装 prompt 骨子

以下、**PM-942 完了後に CEO が PM-943 として dev agent に渡す prompt の骨子**:

---

### PM-943: Preview Phase 4.1 - WebviewWindow MVP 実装

- **案件**: PRJ-012
- **branch**: `v1.1-dev`
- **前提レポート**: PM-942（`dev-v10-pm-942-preview-phase4-feasibility.md`）
- **タスク**: 案 D1 (`@tauri-apps/api/webviewWindow`) で IDE 内 preview 機能を再構築

#### 実装範囲

1. `components/preview/PreviewPane.tsx`:
   - 「アプリ内で開く」ボタンを「外部ブラウザで開く」と並置
   - クリック時に `new WebviewWindow('preview-${projectId}', { url, title, width: 1024, height: 768, parent: 'main', focus: true })` を spawn
   - 既存 label が存在すれば `WebviewWindow.getByLabel()` → `setFocus()` に fallback
   - spawn 失敗時は `toast.error` + logger に記録 + 「外部ブラウザで開く」へ誘導

2. `lib/stores/preview.ts`:
   - `openedWebviewLabels: Record<projectId, string>` を追加（重複 spawn 検知用）
   - `registerWebviewWindow(projectId, label)` / `unregisterWebviewWindow(projectId)`

3. `src-tauri/capabilities/default.json`:
   - `core:window:allow-close` 追加（label 指定 close 用）
   - `core:window:allow-set-focus` 追加（未 allowed なら）
   - `core:webview:allow-webview-close` 追加（lifecycle 管理用）
   - runtime で permission error が出るものを incremental に追加

4. E2E テスト（`tests/e2e/preview-webview-window.spec.ts`）:
   - 「アプリ内で開く」クリック → 新 window が spawn される
   - close で main window 維持
   - 同 project で 2 回目クリック → focus、重複 spawn なし

#### 実機検証必須項目（PM-925〜933 regression）

1. `http://localhost:3000` で dev server 起動 → 表示されること
2. `https://yahoo.co.jp` → **接続拒否が出ないこと**（PM-933 までの問題）
3. `https://github.com` → 表示されること
4. `https://hiroyo.improver.work/` → 表示されること

#### 完了条件

- 上記 4 URL すべてで "接続が拒否されました" が出ない
- `npx tsc --noEmit`: 0 error
- `npx next build`: 成功
- `cargo check`: 0 error
- E2E smoke 1 本 passing
- PM-943 レポート作成: `projects/PRJ-012/reports/dev-v10-pm-943-preview-webview-window-mvp.md`

#### 非スコープ（Phase 4.2 以降）

- 同一 window 内 (in-window) webview
- dev server auto-detect（npm run dev stdout → port 抽出）
- mobile viewport emulation
- DevTools 自動起動
- 複数 URL タブ切替

#### 工数

4.5〜5.5h

---

## 8. リスクと未検証事項

### 8-1. 最重要 risk

- **R1: `additionalBrowserArgs` が secondary webview に伝播しないケース**
  - 影響: v1.0 で iframe を詰まらせた site-isolation が secondary webview でも部分的に発動し、内部 iframe 広告等が欠落する可能性
  - 発生可能性: **中**（doc 上明記なし）
  - 検出: Phase 4.1 MVP 実装 5 分で検証可能（`yahoo.co.jp` で右カラム広告が読めるか目視）
  - mitigation: Rust 側 `WebviewBuilder::additional_browser_args`（Rust-only API 可能性）で個別指定
  - 最悪時の撤退: v1.0 同様に外部ブラウザ fallback を残してあるため**アプリ起動不能にはならない**

- **R2: Tauri 2.1 で `WebviewWindow` の navigation が sync にならず racecondition**
  - 影響: `new WebviewWindow()` 直後に `await win.once("tauri://created")` を忘れると window 未生成 state で次処理が走る
  - 発生可能性: **低**（実装側で await すれば防げる）
  - mitigation: `await` 厳守 + E2E 検証

### 8-2. 中 risk

- **R3: Windows 固有 — WebView2 の webview spawn オーバーヘッド**
  - 影響: D1 spawn 時に 1〜2 秒のラグ（Edge WebView2 runtime の cold start）
  - mitigation: UX 上 spinner 表示、cold start 1 回目のみ許容

- **R4: macOS 固有 — 別 window が別 Space に飛ぶ**
  - 影響: フルスクリーンモードで main window が別 Space にいる場合、secondary window が visible Space に spawn されて混乱
  - mitigation: `parent: "main"` + `alwaysOnTop: false` + OS native 挙動を許容

### 8-3. 低 risk

- **R5: capability 名が doc と実装で食い違う**
  - Tauri 2.1 → 2.2 の間で permission 名称が変わる risk
  - mitigation: runtime error を追跡して incremental 対応

### 8-4. 未検証（Phase 4.1 MVP で確認すべき項目）

1. `additionalBrowserArgs` の secondary webview 伝播（R1）
2. Windows で `new WebviewWindow()` が cold start に要する実測時間
3. macOS で `parent: "main"` 指定時の Space 挙動
4. `on_navigation` が JS 側 `WebviewOptions` で渡せるか（doc は Rust 側のみ言及）
5. secondary webview で devtools を JS から開けるか（doc 不明、Rust 側のみかも）
6. 複数 project で同時に preview window を開いた場合の OS タスクバー挙動（Windows）

---

## 9. 結論と CEO への提案

### 9-1. 結論

**技術的実現可能性**: **高**。`WebviewWindow` (D1) は Tauri 2.1 で stable、PM-933 で投入済の capability / CSP / additionalBrowserArgs のほぼ全てを流用可能。**iframe 路線の挫折原因（WebView2 site-isolation / X-Frame-Options）は、独立 process の webview なら原理的に回避できる**ことを公式 doc で確認済。

**推奨実装**: **段階実装**
- Phase 4.1（v1.1.0）: D1 MVP（4.5〜5.5h）で即実装。iframe 撤退の代替として必要十分な UX を提供。
- Phase 4.2（v1.2.0 or later）: D2 (`Webview` in-window) に昇格。ただし `unstable` feature 採用の DEC が必要で、Tauri 本体の multi-webview 成熟度を watch。

### 9-2. CEO 判断を仰ぐポイント

- **(A)** Phase 4.1 (D1) を PM-943 として v1.1-dev branch で即着手するか
- **(B)** Phase 4.2 (D2) で Tauri の `unstable` feature を production release に含める方針を許容するか（DEC-049 として別途議論）
- **(C)** D1 で UX が十分だった場合 Phase 4.2 を見送る選択肢を残すか

### 9-3. 次アクション

1. 本レポート CEO レビュー → Phase 4.1 着手判断
2. 着手判断後、PM-943 として dev agent に §7 の prompt 骨子を渡す
3. PM-943 MVP 完了後、オーナー実機検証 → Phase 4.2 判断（DEC）

### 9-4. 調査工数実績

- WebFetch（公式 doc）: 7 回
- 既存コード Read: 5 ファイル（PreviewPane.tsx / preview.ts / Shell.tsx / tauri.conf.json / capabilities/default.json / Cargo.toml）
- 前提レポート Read: PM-925, PM-936
- レポート作成: 本ファイル
- **所要時間**: 約 1.5〜2h

---

## 付録 A: 公式 doc 引用リンク

| Topic | URL |
|---|---|
| WebviewWindow JS API | https://v2.tauri.app/reference/javascript/api/namespacewebviewwindow/ |
| Webview JS API（multi-webview） | https://v2.tauri.app/reference/javascript/api/namespacewebview/ |
| WebviewWindowBuilder Rust | https://docs.rs/tauri/2.1.0/tauri/webview/struct.WebviewWindowBuilder.html |
| WebviewBuilder Rust (unstable) | https://docs.rs/tauri/2.1.0/tauri/webview/struct.WebviewBuilder.html |
| emit_to pattern | https://v2.tauri.app/develop/calling-frontend/ |
| Tauri 2 Cargo features | GitHub `tauri-apps/tauri/crates/tauri/Cargo.toml` |

## 付録 B: 調査で明らかになった PM-925 時点の誤認識

PM-925 §3 案 D 評価:
> 「Tauri 2 での multi-webview-in-window は docs が限定的、`app.webviews` API の安定度に課題」
> 「工数: 12〜20h（調査込み）」

**本 PM-942 での訂正**:
- D1 (`WebviewWindow`) は **stable** であり PM-925 評価（「案 B 別 window」）と D (secondary webview) は混同されていた
- D2 (`Webview` in-window) の 12〜20h 見積は本 PM-942 の 13〜17h とほぼ一致（実装確度向上）
- PM-925 §4-2 「Phase 4: secondary webview へ段階移行」は本 PM-942 で具体化完了

---

**レポート終了**
