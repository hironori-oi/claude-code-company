# PM-945 Preview window position/size 記憶 実装完了レポート

- **プロジェクト**: PRJ-012 ccmux-ide-gui
- **バージョン**: v1.2-dev
- **Round**: PM-945 (Preview Phase 4.2 先行)
- **前置**: PM-944 (v1.1.0 Rust `WebviewWindowBuilder` spawn 切替) で Preview window の
  安定 spawn を達成。本 Round は UX 改善として geometry 記憶を追加。
- **担当**: 開発部門
- **対象ブランチ**: `v1.2-dev`
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **作業日**: 2026-04-20

## 結論

Preview window を閉じる直前の **outer position (x, y) / inner size (width, height)** を
project ごとに localStorage へ persist し、次回「アプリ内で開く」押下時に
`spawn_preview_window` command の新 optional 引数 `x / y / width / height` 経由で
Rust `WebviewWindowBuilder::position()` / `.inner_size()` に渡して復元する実装を完了。

Cursor / VSCode の Preview と同等の「前回の配置で開く」UX を実現した。

全ビルド検証パス:

| 検証 | 結果 |
|---|---|
| `cargo check` | 0 error (pre-existing warning 3 件のみ) |
| `cargo test --lib` | 106 passed / 0 failed (+1 本: `commands::preview::tests::module_compiles`) |
| `npx tsc --noEmit` | 0 error |
| `npx next build` | 成功 (7/7 static pages, Exporting 2/2) |
| `next lint` (変更 2 ファイル) | No ESLint warnings or errors |

実機動作は下記 §6 の検証手順で要確認（`cargo check` は通過済みだが Tauri runtime
で WebviewWindowBuilder の `.position()` + `.inner_size()` 組合せが Windows 実機で
期待通り動くかは実機のみで確認可能）。

---

## 1. 仕様・背景

### 1-1. ユーザー要求

- PM-944 (v1.1.0) で Preview を Rust 側 `WebviewWindowBuilder` で spawn する方式に
  切替。ただし **毎回 default 位置（center）・default サイズ（1280x800）** で spawn
  されるため、ユーザーが window を移動・リサイズしても次回開いた時にリセットされる。
- Cursor / VSCode の Preview は位置・サイズを記憶している。v1.2 でこの UX 改善を提供。

### 1-2. 要求仕様（再掲 + 実装で確定した事項）

1. Preview window を閉じる時の **outer position (x, y) / inner size (width, height)**
   を保存する。
   - 確定: 単位は physical pixels（Tauri の `PhysicalPosition` / `PhysicalSize`）。
   - 確定: outer position を使うのは OS window 全体（decoration 含む）の左上座標を
     記録するため。Rust 側 `.position(x, y)` も outer 基準なので対称。
   - 確定: inner size を使うのは webview コンテンツ領域を記録するため。Rust 側
     `.inner_size(w, h)` も inner 基準。PM-944 の既存 spawn コードが `inner_size`
     だったのでそれに合わせた。
2. 次回「アプリ内で開く」押下時に **保存した位置・サイズで spawn**。
3. 保存先は **project ごと** (`usePreviewStore` persist)。
4. 初回（保存値なし）は default（center + 1280x800）で spawn（PM-944 現状動作を維持）。

---

## 2. 実装方針（実装後の確定版）

### 2-1. store 拡張（`lib/stores/preview.ts`）

- 新型: `PreviewWindowGeometry = { x: number; y: number; width: number; height: number }`
- 新 state member: `windowGeometries: Record<projectId, PreviewWindowGeometry>`
- 新 action: `getWindowGeometry(projectId) => PreviewWindowGeometry | undefined`
- 新 action: `setWindowGeometry(projectId, geometry)` — `width<=0` / `NaN` / `Infinity`
  は guard で無視（minimize 中の 0 サイズ event 対策）。
- `persist.partialize` に `windowGeometries` を追加（`urls` と並列で localStorage
  `ccmux-preview-urls` に書き出される）。
- `openedWebviewLabels` は従来通り persist から除外（揮発）。

### 2-2. Rust command 拡張（`src-tauri/src/commands/preview.rs`）

`spawn_preview_window` の signature に optional の `x / y / width / height: Option<f64>`
を追加。builder ロジックを以下に変更:

```rust
let mut builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(parsed_url))
    .title(title_final)
    .resizable(true)
    .focused(true)
    .visible(true)
    .data_directory(preview_data_dir);

// inner size: 保存値があれば優先、なければ default
builder = match (width, height) {
    (Some(w), Some(h)) if w > 0.0 && h > 0.0 => builder.inner_size(w, h),
    _ => builder.inner_size(1280.0, 800.0),
};

// outer position: 保存値があれば優先、なければ center
builder = match (x, y) {
    (Some(px), Some(py)) => builder.position(px, py),
    _ => builder.center(),
};
```

**設計判断**:

- `match` の `if` guard で `w > 0.0 && h > 0.0` を追加し、万一不正値が Rust まで
  届いても default にフォールバック（frontend 側 guard との defense-in-depth）。
- `x / y` の検証は guard せず（負座標は multi-monitor の左側 display で正当）。
- `.position()` と `.center()` は Tauri 内部で「後から set されたほうが勝つ」挙動
  なので排他で分岐。
- `title / data_directory / visible / focused / resizable` 等 PM-944 で確立した
  「Windows WebView2 で spawn 成功する最小セット」は一切変更しない（リグレ回避）。

### 2-3. frontend (`components/preview/PreviewPane.tsx`)

#### (a) spawn 時に geometry を渡す

```tsx
const savedGeometry = getWindowGeometry(activeProjectId);

await callTauri<void>("spawn_preview_window", {
  label,
  url: target,
  title,
  x: savedGeometry?.x,
  y: savedGeometry?.y,
  width: savedGeometry?.width,
  height: savedGeometry?.height,
});
```

`savedGeometry` が `undefined` の場合、各プロパティも `undefined` になり JSON
serialize で key ごと欠落する → Rust 側で `Option<f64>` が `None` になり default 動作。

#### (b) geometry 取得方式: **案 A = event-driven (polling なし)**

仕様書で提案された「polling or event listen」のうち、**event listen を採用**した。
理由:

- Tauri の `Window` (WebviewWindow は Window を extends) は `onMoved` / `onResized` /
  `onCloseRequested` を既に提供しており、polling より軽量で正確。
- polling (5 秒間隔) は不要な IPC トラフィックと「close 直前 5 秒の移動を取り逃がす」
  欠点がある。event-driven なら close 時に必ず最新値が取れる。

#### (c) 実装フロー

`handleOpenInApp` で Rust spawn が成功した直後、`attachGeometryListeners(projectId, label)`
を fire-and-forget で呼ぶ:

```
1. WebviewWindow.getByLabel(label) で handle を取得
2. 初期 snapshot: outerPosition() + innerSize() を同時取得し
   latestGeometryRef と store に記録（event が飛ぶ前に閉じられた場合の保険）
3. onMoved  → latestGeometryRef の x, y のみ更新（ref のみ / store は未更新）
4. onResized → latestGeometryRef の width, height のみ更新（ref のみ / store 未更新）
5. onCloseRequested → latestGeometryRef を store に flush + listener 全解除
```

**なぜ event 毎に store へ書き込まないか**:
- `onMoved` / `onResized` は drag 中に毎フレーム発火する（60Hz 付近）。
  毎回 localStorage に書き込むと I/O 負荷 + zustand subscriber の rerender 嵐。
- ref のみ更新 → close 時に 1 回 flush で十分（最新値のみ保存されれば良い）。

**unmount 時 cleanup**:
- `useEffect` の cleanup で `clearGeometryListeners(flush=true)` を呼び、途中で
  project 切替 / app 終了 になっても最新値を persist する。

#### (d) 既存動作との互換

- 「外部ブラウザで開く」ボタン: 変更なし。
- URL 入力 / commit: 変更なし。
- 連打防止 `isOpeningInApp` guard: 変更なし。
- PM-944 の `registerWebviewWindow` / `unregisterWebviewWindow`: 変更なし。

---

## 3. 変更ファイル一覧

| ファイル | 変更内容 | 行数目安 |
|---|---|---|
| `src-tauri/src/commands/preview.rs` | signature に 4 optional 引数追加 / builder を match 分岐化 / smoke test 追加 | +40 / -10 |
| `lib/stores/preview.ts` | `PreviewWindowGeometry` 型 + 2 action + partialize 拡張 | +60 / -5 |
| `components/preview/PreviewPane.tsx` | 2 useRef + 2 helper useCallback + useEffect(unmount cleanup) + handleOpenInApp 拡張 | +140 / -5 |

`components/editor/*` / `components/palette/*` / 他 Rust command は一切触っていない
（PM-948 並列実行との競合回避）。

---

## 4. Rust command 拡張 diff（サマリ）

```diff
 #[tauri::command]
 pub async fn spawn_preview_window(
     app: AppHandle,
     label: String,
     url: String,
     title: Option<String>,
+    x: Option<f64>,
+    y: Option<f64>,
+    width: Option<f64>,
+    height: Option<f64>,
 ) -> Result<(), String> {
     // ... (destroy existing / user data dir / URL parse は不変) ...

     let title_final = title.unwrap_or_else(|| format!("Preview - {url}"));
-    let builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(parsed_url))
+    let mut builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(parsed_url))
         .title(title_final)
-        .inner_size(1280.0, 800.0)
         .resizable(true)
         .focused(true)
         .visible(true)
-        .center()
         .data_directory(preview_data_dir);
+
+    builder = match (width, height) {
+        (Some(w), Some(h)) if w > 0.0 && h > 0.0 => builder.inner_size(w, h),
+        _ => builder.inner_size(1280.0, 800.0),
+    };
+    builder = match (x, y) {
+        (Some(px), Some(py)) => builder.position(px, py),
+        _ => builder.center(),
+    };

     builder.build().map_err(|e| format!("..."))?;
     Ok(())
 }
```

---

## 5. store persist 設計

`localStorage["ccmux-preview-urls"]` の JSON schema が以下に拡張される:

```json
{
  "state": {
    "urls": {
      "<projectId>": { "current": "...", "history": ["...", "..."] }
    },
    "windowGeometries": {
      "<projectId>": { "x": 120, "y": 80, "width": 1440, "height": 900 }
    }
  },
  "version": 1
}
```

- `version` は据え置き (1)。旧 state (geometry なし) を読み込んでも zustand
  の default `windowGeometries: {}` が勝つので migration 不要。
- 旧 data (`urls` のみ) との後方互換: 既存 user は「初回だけ default 位置で開く、
  2 回目以降は記憶される」動作になり、ユーザーから見て regression なし。

### guard ロジック

`setWindowGeometry` は以下を弾く:

- `!Number.isFinite(x|y|width|height)` (NaN / ±Infinity)
- `width <= 0` / `height <= 0`

これは Windows で minimize 時に size=0 event が飛ぶ報告があるため。`x / y` の
負値は multi-monitor 対応で許容（display が主画面の左にある場合、負座標が正常値）。

---

## 6. 実機検証手順

**重要**: Rust command 変更を含むため `tauri dev` の再起動が必須（rebuild 必要）。

### 6-1. Clean rebuild

```bash
cd C:\Users\hiron\Desktop\ccmux-ide-gui
# (既存 tauri dev が起動していれば Ctrl+C で停止)
rm -rf src-tauri/target/debug/.fingerprint/ccmux-ide-*  # cache 無効化（任意）
npm run tauri:dev
```

### 6-2. Smoke test

1. アプリ起動後、適当なプロジェクトを開く。
2. Preview pane で URL を入力 → 「アプリ内で開く」
   - 期待: 画面中央に 1280x800 で Preview window が出現（PM-944 動作と同一）。
3. Preview window を画面右上などに drag 移動 → 一回り大きくリサイズ。
4. Preview window を X ボタンで閉じる。
   - 期待: main window の devtools console に `[preview] saved geometry on close: <projectId> {x:..., y:..., width:..., height:...}` が出力される。
5. 再度「アプリ内で開く」を押す。
   - 期待: 手順 3 で設定した位置・サイズで Preview window が出現する。

### 6-3. Cross-project 独立性

1. プロジェクト A で Preview を左上（100, 50, 800x600）に配置して閉じる。
2. プロジェクト B に切替 → Preview を右下（1000, 600, 1600x1000）に配置して閉じる。
3. プロジェクト A に戻して Preview を開く。
   - 期待: (100, 50, 800x600) で復元。
4. プロジェクト B に切替して Preview を開く。
   - 期待: (1000, 600, 1600x1000) で復元。

### 6-4. Persist across app restart

1. Preview を適当な位置・サイズで閉じる。
2. アプリ全体を終了 → `npm run tauri:dev` で再起動。
3. 同じプロジェクトで Preview を開く。
   - 期待: 終了前と同じ位置・サイズで開く。
4. `localStorage` を devtools で確認: `ccmux-preview-urls` の value に
   `"windowGeometries": { "<projectId>": {...} }` が含まれる。

### 6-5. Regression check（PM-944 互換）

1. 新規 project（geometry 未登録）で Preview を開く。
   - 期待: 画面中央に 1280x800 で出現（PM-944 の default 挙動）。
2. Preview window が正常に描画される（URL にアクセスできる）。
   - 期待: PM-944 で解消済みの Windows WebView2 user data dir 競合が再発していない。

---

## 7. 既知の制限 / 将来の改善候補

| 項目 | 内容 | 対応予定 |
|---|---|---|
| multi-monitor 切断時の画面外 | 前回 display が外れた状態で開くと画面外座標で復元されて見えなくなる恐れ | Phase 4.2 で `workArea` 取得 + clamp |
| maximize 状態の復元 | 現状 maximize 状態は記録せず、常に restored size で開く | Phase 4.2 で `isMaximized()` 取得 + `.maximized()` builder |
| DPI 変化時の見かけズレ | physical px 保存のため、高 DPI display へ移動後に再起動すると見た目のサイズが変わる | ユーザー影響軽微のため保留 |
| `onMoved` / `onResized` の throttle | drag 中 ref 更新は軽量なので現状 throttle 不要。store flush は close 時のみ | 現状維持 |

---

## 8. 検証ログ（コマンド実行結果）

### `cargo check`

```
Compiling ccmux-ide v0.1.0 (C:\Users\hiron\Desktop\ccmux-ide-gui\src-tauri)
warning: function `sessions_has_project_id` is never used     (pre-existing)
warning: variant `Cwd` is never constructed                    (pre-existing)
warning: method `context_ratio` is never used                  (pre-existing)
warning: `ccmux-ide` (lib) generated 3 warnings
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 15.65s
```

### `cargo test --lib`

```
test commands::preview::tests::module_compiles ... ok
...
test result: ok. 106 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

### `npx tsc --noEmit`

```
(0 output = 0 error)
```

### `npx next build`

```
 ✓ Compiled successfully in 5.6s
 ✓ Generating static pages (7/7)
 ✓ Exporting (2/2)
Route (app)                                 Size  First Load JS
┌ ○ /                                    1.49 kB         116 kB
├ ○ /_not-found                             1 kB         105 kB
├ ○ /settings                            10.6 kB         158 kB
├ ○ /settings/mcp                        6.52 kB         144 kB
└ ○ /workspace                           5.79 kB         200 kB
```

### `next lint` (変更 2 ファイル)

```
✔ No ESLint warnings or errors
```

---

## 9. 並列実行 Agent との排他確認

- **PM-948 (Editor file 検索 Agent)** が並列実行中。
  - 触ったパス: `src-tauri/src/commands/preview.rs` / `components/preview/PreviewPane.tsx`
    / `lib/stores/preview.ts` のみ。
  - `components/editor/*` / `components/palette/*` / その他 Rust command は
    一切変更していない。
  - 競合リスクなし。

---

## 10. 完了条件チェックリスト

- [x] Preview window 閉じる前の位置・サイズを記憶
- [x] 次回 spawn 時に記憶した位置・サイズで表示
- [x] project ごとに独立保存 (`windowGeometries: Record<projectId, ...>`)
- [x] `cargo check` 0 error
- [x] `cargo test --lib` pass (106 passed)
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功
- [x] `next lint` 0 warning on changed files
- [x] logger wrapper (PM-746) 使用
- [x] PM-948 / 他 Agent 担当パスへの変更なし
- [x] 過度な refactor なし、最小 diff
- [x] v1.2-dev branch で作業
- [x] レポート出力 (`projects/PRJ-012/reports/dev-v10-pm-945-preview-geometry-memory.md`)
- [ ] オーナー実機検証（§6 の手順待ち）
- [ ] v1.2-dev branch へ commit（CEO 承認後に dev 部門で実施）

---

## 11. CEO への報告要旨

PM-945「Preview window position/size 記憶」を v1.2-dev で実装完了。
Rust command 拡張・frontend event listener・zustand persist 追加を最小 diff で完遂し、
全自動検証 (`cargo check` / `cargo test` / `tsc` / `next build` / `next lint`) を
通過。実機検証は §6 の手順でオーナー側で実施依頼したい。

次 Round 候補 (Phase 4.2): multi-monitor 画面外フォールバック / maximize 状態復元 /
同一 window 内 webview (Cursor 同等 UX)。
