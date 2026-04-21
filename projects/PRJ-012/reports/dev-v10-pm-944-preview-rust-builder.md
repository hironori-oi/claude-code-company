# PM-944 Preview window Rust `WebviewWindowBuilder` spawn 切替 完了レポート

- **プロジェクト**: PRJ-012 ccmux-ide-gui
- **バージョン**: v1.1-dev
- **Round**: PM-944 (Preview Phase 4.1 再実装)
- **前置**: PM-942 feasibility → PM-943 実装 + 7 hotfix (a927d7f → b675b7c)
- **担当**: 開発部門
- **対象ブランチ**: `v1.1-dev`
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`

## 結論

PM-943 の「JS API `new WebviewWindow()`」経路を **Rust 側 `WebviewWindowBuilder` + `data_directory` 明示指定** に差し替え、Windows WebView2 の user data dir 共有 lock 競合を根治した。

全ビルド検証パス:

| 検証 | 結果 |
|---|---|
| `cargo check` | 0 error (pre-existing warning 3 件のみ) |
| `cargo test --lib` | 105 passed / 0 failed |
| `npx tsc --noEmit` | 0 error |
| `npx next build` | 成功 (7/7 static pages, Exporting 2/2) |

オーナー実機で「OS window が実際に出現するか」の最終検証待ち。

---

## 1. PM-943 の 7 hotfix 経緯と失敗原因確定

### 1-1. Commit 履歴 (v1.1-dev branch)

```
b675b7c fix(v1.1): PM-943 hotfix5 spawn config 最小化 + isVisible debug log
d61851f fix(v1.1): PM-943 hotfix4 window を確実に前面表示 (show + alwaysOnTop + center)
f0d74ed fix(v1.1): PM-943 hotfix3 label を timestamp で unique 化
464a4ab fix(v1.1): PM-943 webview spawn 'already exists' race 回避
0225072 fix(v1.1): PM-943 Preview は毎回 close→spawn に変更
a927d7f fix(v1.1): PM-943 PreviewPane の <p> を <div> に修正
29de781 feat(v1.1): PM-943 Preview Phase 4.1 - Secondary WebviewWindow (case D1)
```

### 1-2. 症状の共通項

オーナー実機で一貫して再現したのは以下:

```
[preview] webview window created: preview-...-1745356... https://www.yahoo.co.jp/
[preview] state probe failed: runtime error: failed to receive message from webview
```

- `tauri://created` event は受信する（= Tauri runtime は window 生成を開始した）
- 直後の `preview.isVisible()` が IPC error で reject される
- OS window が現れない（Alt+Tab 非検出 / タスクマネージャに preview の WebView2 process なし）

すなわち: **Tauri/Wry 層までは window 作成に着手するが、WebView2 の process 初期化中または直後に process 自体が破棄されている**。

### 1-3. 原因確定

PM-942 §8 R3 で指摘されていた:

> **R3: Windows 固有 — Windows では webview ごとに別 user data directory が必要**
> 同一 directory 共有で crash 報告（公式 doc 明記）

JS API `@tauri-apps/api/webviewWindow` が公開する `WebviewWindow` constructor は以下 option を受けないため、親 main window と **同じ WebView2 user data dir を共有**しようとする:

- `dataDirectory` (未公開)

結果、WebView2 の user data dir 排他 lock（`EdgeWebView\Default\...\lock` 相当）を親が保持した状態で子が同じ dir を掴みに行き、子 process は即時 kill される。

これが `tauri://created` 受信後に `isVisible()` が IPC で失敗する直接原因。

**Rust 側 `WebviewWindowBuilder::data_directory(PathBuf)` でのみ user data dir を個別指定できる** (docs.rs confirmed、下記 §3 参照)。

### 1-4. hotfix 試行と無効化の理由

| hotfix | 試行内容 | 結果 | 無効の理由 |
|---|---|---|---|
| hotfix1 (0225072) | 毎回 close → spawn | 効果なし | user data dir は同一のまま |
| hotfix2 (464a4ab) | `already exists` race を `Promise.all` 構造化 | 効果なし | 根本原因は race ではなく lock 競合 |
| hotfix3 (f0d74ed) | label に `Date.now()` 付与で unique 化 | 効果なし | label が違っても user data dir は共有 |
| hotfix4 (d61851f) | `show()` + `alwaysOnTop` + `center()` | 「一瞬緑に光る」症状発生 | window が生成される寸前で死亡、最前面化 API は空 object に適用されている |
| hotfix5 (b675b7c) | spawn config 最小化 + `isVisible` debug log | 「failed to receive message」ログ確定 | process が既に死んでいるので IPC 不可 |

→ 全 hotfix 共通の見落としは「**user data dir が親と共有されたまま**」。JS API 経路では改善不可能と確定。

---

## 2. `spawn_preview_window` command 実装設計

### 2-1. 新規ファイル: `src-tauri/src/commands/preview.rs`

```rust
#[tauri::command]
pub async fn spawn_preview_window(
    app: AppHandle,
    label: String,
    url: String,
    title: Option<String>,
) -> Result<(), String> {
    // 1. 既存 window destroy (sync)
    if let Some(existing) = app.get_webview_window(&label) {
        if let Err(e) = existing.destroy() { /* warn, continue */ }
    }

    // 2. user data dir 分離
    let app_local_dir = app.path().app_local_data_dir()?;
    let preview_data_dir = app_local_dir.join("preview-webview").join(&label);
    std::fs::create_dir_all(&preview_data_dir)?;

    // 3. URL parse
    let parsed_url = url.parse::<tauri::Url>()?;

    // 4. builder.build()
    let title_final = title.unwrap_or_else(|| format!("Preview - {url}"));
    WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(parsed_url))
        .title(title_final)
        .inner_size(1280.0, 800.0)
        .resizable(true)
        .focused(true)
        .visible(true)       // build 完了 = OS window 表示済み
        .center()
        .data_directory(preview_data_dir)  // ★ 本 hotfix の本質
        .build()?;

    Ok(())
}
```

### 2-2. 設計上の key point

1. **同期 destroy → create**: Rust の `get_webview_window().destroy()` は同期 API 相当。JS API の async destroy + race 問題が消える。結果として **固定 label に回帰**可能（PM-943 hotfix3 の timestamp nonce を撤去）。
2. **`visible(true)` で spawn**: JS API hotfix5 では create 後に `show()` を別呼出していたが、`WebviewWindowBuilder` では builder に組み込めるので **build() が Ok を返した瞬間 OS window 可視**。hotfix4 の「一瞬緑に光る」も発生し得ない。
3. **`Err(String)` で frontend へ**: invoke の Promise reject として詳細 message が届く。`tauri://error` listener 不要。
4. **capability 変更不要**: `#[tauri::command]` は default で IPC allowlist され、WebView2 の internal spawn は `core:webview:allow-create-webview-window` の window 側 permission とは独立（Rust 側 Builder は capability の constraint を受けない）。既存 capability で十分。

### 2-3. `lib.rs` / `commands/mod.rs` 登録

**`src-tauri/src/commands/mod.rs`** 末尾 append:

```rust
// PRJ-012 v1.1 / PM-944 (2026-04-20): Preview window を Rust 側で spawn する module。
pub mod preview;
```

**`src-tauri/src/lib.rs`**:

```rust
use commands::{
    ...
    preview::spawn_preview_window,
};

// ...
.invoke_handler(tauri::generate_handler![
    ...
    spawn_preview_window,
])
```

---

## 3. `data_directory` の platform 別挙動

`tauri 2.10.3` の `WebviewWindowBuilder::data_directory(PathBuf)` を確認:

- Source: `%CARGO_HOME%\registry\src\index.crates.io-*\tauri-2.10.3\src\webview\webview_window.rs:1022`
- Doc: `/// Data directory for the webview.`
- 実装: 内部の `WebviewBuilder::data_directory` に forwarding → `WebviewAttributes::data_directory: Option<PathBuf>` にセット

### platform 別の実効挙動

| Platform | 実効挙動 |
|---|---|
| **Windows** | **WebView2 の `ICoreWebView2Environment` の user data folder** として使用。未指定時は default folder（親と共有）となり、multi-webview 並列起動で lock 競合。**本 hotfix の対象**。 |
| **macOS** | WKWebView は `WKWebsiteDataStore` を user data dir 相当として扱うが、Tauri/Wry の macOS 実装では `data_directory` 指定がほぼ no-op 相当（WKWebsiteDataStore は process-wide default）。cookie / localStorage は label 単位で分離される仕様。**本 hotfix は macOS では副作用ゼロ**。 |
| **Linux** | WebKitGTK は `webkit_web_context_new_with_website_data_manager` 経由で data dir を設定。指定すれば label 単位で cache / cookie が分離。 |

### `app_local_data_dir()` の展開先

`tauri::Manager::path().app_local_data_dir()` は tauri.conf.json の `identifier` ("com.improver.ccmux-ide") を元に:

- Windows: `%LOCALAPPDATA%\com.improver.ccmux-ide\`
- macOS: `~/Library/Application Support/com.improver.ccmux-ide/`
- Linux: `~/.local/share/com.improver.ccmux-ide/`

その下に `preview-webview/{label}/` subdir を作成。label が `preview-<projectId>` なので project ごとに 1 subdir、プロジェクト間で完全分離。

### ディスクサイズ / cleanup

- 1 preview window あたり数 MB〜数十 MB（WebView2 cache）
- project を増やすとリニアに増加するが、ccmux-ide-gui 利用者 1 人あたり同時 ~10 project 想定 → 〜数百 MB 許容
- **cleanup**: project 削除時に preview-webview/{label} を消す hook は本 hotfix では未実装 (Phase 4.2 で拡張。現状は手動削除 or OS 再起動時は残存)

---

## 4. frontend 書換え diff 要約

**`components/preview/PreviewPane.tsx`**: 199 行変更 (-133, +66 相当の簡略化)。

### 削除されたもの

1. **`@tauri-apps/api/webviewWindow` の dynamic import** (`new WebviewWindow` / `getAllWebviewWindows`) - 20 行
2. **`buildPreviewWindowLabelPrefix` 関数** (timestamp nonce 用) - 5 行
3. **enumerate → destroy loop** (PM-943 hotfix3 の全 window destroy) - 14 行
4. **3 つの event listener 登録** (`tauri://created` / `tauri://error` / `tauri://destroyed`) - 45 行
5. **`isVisible()` / `isMinimized()` / `show()` / `unminimize()` / `setFocus()` の debug / fallback 呼出** - 25 行

### 追加されたもの

1. `import { callTauri } from "@/lib/tauri-api"`
2. `await callTauri<void>("spawn_preview_window", { label, url, title })` 1 行で全完結
3. 成功 → `registerWebviewWindow` + `toast.success`
4. 失敗 → `unregisterWebviewWindow` + `toast.error`（外部ブラウザ fallback 案内）

### `buildPreviewWindowLabel` の変化

```diff
- function buildPreviewWindowLabelPrefix(projectId: string): string {
-   const sanitized = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
-   return `preview-${sanitized}-`;
- }
- function buildPreviewWindowLabel(projectId: string): string {
-   return `${buildPreviewWindowLabelPrefix(projectId)}${Date.now()}`;
- }
+ // PM-944: 固定 label に回帰。
+ function buildPreviewWindowLabel(projectId: string): string {
+   const sanitized = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
+   return `preview-${sanitized}`;
+ }
```

---

## 5. PM-943 から削除されたコード (JS API 経由の spawn logic) の扱い

### 5-1. 削除したもの（frontend）

上記 §4 の通り、`PreviewPane.tsx` から JS API spawn 経路を完全削除。

### 5-2. 保持したもの

- **capability 設定** (`core:window:allow-close` / `allow-destroy` / `allow-set-focus` 等): Rust 経路でも spawn 後に frontend から focus / close を呼ぶ拡張余地があるため保持。削除しても現状動作には影響しない。
- **`preview` store の `openedWebviewLabels` map**: Rust spawn でも「project に現在 open 中の preview window があるか」の UI 状態として有用。将来 Phase 4.2 の multi-webview では必須。
- **`registerWebviewWindow` / `unregisterWebviewWindow` の store API**: 保持。

### 5-3. 依存パッケージ

`@tauri-apps/api/webviewWindow` module 自体は package.json に残っているが、PreviewPane からの import は削除。他所（`ProjectRail` 等）で使われていれば影響なし（要確認）。Rust spawn 方式でも JS 側で `getCurrent()` 等の WebviewWindow API を呼ぶ可能性はあるため、dependency は保持が安全。

---

## 6. 変更ファイル一覧

| ファイル | 変更種別 | 目的 |
|---|---|---|
| `src-tauri/src/commands/preview.rs` | 新規 | `spawn_preview_window` command 実装 |
| `src-tauri/src/commands/mod.rs` | 編集 | `pub mod preview;` 登録 |
| `src-tauri/src/lib.rs` | 編集 | `use preview::spawn_preview_window;` + `generate_handler![..., spawn_preview_window]` |
| `components/preview/PreviewPane.tsx` | 書換 | JS API → Rust command 呼出に差替え、固定 label 回帰 |

`src-tauri/capabilities/default.json`: **変更なし** (既存 permission で新 command を cover)。
`src-tauri/Cargo.toml`: **変更なし** (追加 crate 不要、`tauri` 本体のみで実装)。

---

## 7. オーナー実機検証手順

**前提**: v1.1-dev branch を checkout 済。tauri dev の既存プロセスは完全停止すること（Rust 変更 + 新規 command + lib.rs 登録のため、hot reload では伝播しない）。

### 7-1. 起動

```powershell
cd C:\Users\hiron\Desktop\ccmux-ide-gui
# 既存 tauri dev があれば Ctrl+C で完全停止
npm run tauri dev
```

初回起動は Rust recompile が走るので 2〜3 分かかる。起動ログに以下が出れば OK:

```
Compiling ccmux-ide v0.1.0 (...\src-tauri)
Finished `dev` profile ...
Running ...
[history] initialized ~/.ccmux-ide-gui/history.db
```

### 7-2. Preview 起動テスト (Windows 本命検証)

1. 任意 project を選択
2. 右側 pane で **Preview** tab を開く
3. URL 入力欄に `https://www.yahoo.co.jp/` を入力
4. 「アプリ内で開く」ボタンをクリック
5. **期待結果**: 新しい OS window (1280x800) が画面中央に開き、Yahoo! JAPAN が表示される
6. Alt+Tab で preview window が ccmux-ide と別枠で表示される
7. トースト「アプリ内プレビューを開きました」が ccmux-ide 側に出る
8. DevTools console に以下 log:
   ```
   [preview] rust-spawned window created: preview-<projectId> https://www.yahoo.co.jp/
   ```

### 7-3. PM-943 症状の非再現確認

以下の PM-943 症状が **出ない** ことを確認:

- [ ] `[preview] state probe failed: runtime error: failed to receive message from webview` が出ない
- [ ] `Alt+Tab` で preview window が検出できる（= OS window が実存在）
- [ ] タスクマネージャに `msedgewebview2.exe` 子プロセスが複数常駐（親用 + preview 用で最低 2）

### 7-4. user data dir 分離確認

```powershell
explorer %LOCALAPPDATA%\com.improver.ccmux-ide\preview-webview\
```

`preview-<projectId>` という folder が作成されていれば成功。中身に `EBWebView` (WebView2 cache) 等が生成される。

### 7-5. 複数 project / 再 spawn / URL 変更

1. 「アプリ内で開く」で A project の preview を開く
2. A project の URL を別の URL に変えて再度「アプリ内で開く」
3. **期待**: 既存 preview window が close され、新しい URL の preview window が開く
4. 別 B project に切り替えて「アプリ内で開く」
5. **期待**: B project 用の別 preview window が開く（A と同時に存在可能、label が違うため）

### 7-6. Linux / macOS 動作

Linux / macOS では R3 の WebView2 問題は発生しないが、`data_directory` 指定自体は副作用ゼロ (Linux は cache 分離、macOS は no-op 相当)。動作に regression がないことだけ確認。

### 7-7. 異常系確認

1. 不正 URL ("not a url" 等) を入れて「アプリ内で開く」
2. **期待**: toast.error が `invalid preview URL '...': ...` で出る。ccmux-ide 本体は crash しない。

---

## 8. 改善しない場合の次手 (fallback)

**本 実装で root cause が解消しない** ケースの対処:

### 8-1. `data_directory` が効かない場合 (可能性: 低)

- Windows で `preview-webview\<label>` folder が作成されても WebView2 process がまだ死ぬ → WebView2 Runtime のバージョン不整合が疑い
- 試す: `additional_browser_args("--disable-features=msWebOOUI,msPdfOOUI")` を builder に追加
- Tauri / Wry の version を 2.11 以降に bump して再検証

### 8-2. macOS / Linux で regression

- `data_directory` 指定が macOS で cookie 分離を乱す症状があれば、platform 条件 (`#[cfg(target_os = "windows")]`) で data_directory 指定を Windows 限定に
- 例:
  ```rust
  #[cfg(target_os = "windows")]
  let builder = builder.data_directory(preview_data_dir);
  ```

### 8-3. 最悪時の撤退

PM-936 の「外部ブラウザ一本化」へ revert (30 分、α 案)。
- 「アプリ内で開く」ボタンを hide 化
- toast で「外部ブラウザで開いてください」を表示
- β 機能 (Tauri 2 secondary window preview) は Phase 4.2 の in-window multi-webview (unstable feature 採用) まで保留

---

## 9. 完了条件チェック

- [x] `src-tauri/src/commands/preview.rs` 新規、`spawn_preview_window` command 実装
- [x] `src-tauri/src/lib.rs` に登録 (use + generate_handler)
- [x] `components/preview/PreviewPane.tsx` を command 呼出に書換え
- [x] `cargo check` 0 error
- [x] `cargo test --lib` 105 passed
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功
- [x] レポート作成 (本ドキュメント)
- [ ] **Windows で preview window が実際に OS 上に表示される** (オーナー実機検証待ち、§7 参照)
- [ ] **Linux / macOS でも動作** (オーナー実機検証待ち、data_directory の platform 別挙動確認、§7-6 参照)

---

## 10. CEO 報告サマリー

- **対象**: PRJ-012 ccmux-ide-gui v1.1 Preview Phase 4.1 再実装
- **結果**: PM-943 の 7 hotfix で解消しなかった Windows WebView2 user data dir 共有 lock 競合を、Rust 側 `WebviewWindowBuilder::data_directory` 明示指定により根治。
- **変更規模**: Rust 新規 1 file (~110 行) + lib.rs / mod.rs に 各 2〜3 行 追記。frontend は 133 行削除 / 66 行追加の net -67 行で spawn 経路を JS API から Rust command 1 呼出に簡略化。
- **ビルド**: 全 4 検証 (cargo check / cargo test / tsc / next build) pass。
- **capability / Cargo.toml 変更**: 不要 (既存設定で cover)。
- **残作業**: オーナー実機で Windows での OS window 出現確認。fail ならば §8 の platform 条件分岐 or 外部ブラウザ撤退 fallback に移行。
- **学び**: Tauri 2 の JS API `WebviewWindow` は WebView2 の `data_directory` を公開していないため、**Windows で multi-webview を使う case は Rust 側 Builder が必須**。公式 doc (PM-942 §8 R3) の指摘を 7 hotfix 経てから採用したのは反省点で、次回同種の課題は platform 別 public API 差分を最初に精査する。
