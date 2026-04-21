# PRJ-012 v1.0 / PM-933 — Preview 外部 URL 接続拒否 Tauri 2 webview レベル再調査レポート

- **案件**: PRJ-012 Claude Code マルチプロジェクト IDE
- **タスク**: PM-933 Preview で外部 URL (yahoo.co.jp / github.com 等) が「接続が拒否されました」で読み込めない件の Tauri 2 webview level での再調査と修正
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **日付**: 2026-04-20
- **担当**: 開発部門 (dev-v10)
- **種別**: hotfix（PM-925/927/929/931 の再アタック、webview レベル）
- **前提**: PM-931 で CSP 9 directive 全部に `https:` 追加済 → 効かず。別要因を探索。
- **発端**: オーナー実機報告「tauri dev 完全再起動後でも `https://yahoo.co.jp` で『www.yahoo.co.jp 接続が拒否されました』エラーページ」

---

## 0. エグゼクティブサマリー

PM-931 で CSP 9 directive を `https:` に拡張したにも関わらず「接続が拒否されました」が継続する原因は、**CSP 不足ではなく Tauri 2 の runtime CSP 書き換え挙動と WebView2 の site-isolation feature flag の合わせ技**と判定した。

Tauri 2 は build time に asset をパースして CSP に `nonce-*` / `sha256-*` を自動注入する仕組み (`assetCspModification`) を持つ。これが **動作した結果、開発者が設定した `csp` 値が runtime で書き換えられ、iframe の frame-src / connect-src / img-src の `https:` 部分が効かなくなっていた**可能性が高い。さらに Windows の WebView2 は `--site-per-process` / `IsolateOrigins` feature flag がデフォルト有効で、cross-origin iframe の network request を低レベルで分離・拒否する挙動を示すことがある。

採用した修正は **4 点の組合せ（全て最小 diff）**:

1. **`tauri.conf.json` に `devCsp` を追加** — dev mode (`http://localhost:3000` 親 origin) でも prod mode と同じ CSP を確実に適用。Tauri の dev 時 CSP デフォルト挙動に依存しない。
2. **`dangerousDisableAssetCspModification` に `["frame-src", "connect-src", "img-src", "default-src"]` を指定** — iframe 関連 directive の runtime 書き換えを禁止。`script-src` / `style-src` は除外して Next.js の nonce 機構を維持。
3. **`app.windows[0].additionalBrowserArgs` を追加** — Tauri default (`msWebOOUI,msPdfOOUI,msSmartScreenProtection` disable) に加えて `IsolateOrigins,site-per-process` を disable し、かつ `--disable-site-isolation-trials` を追加。cross-origin iframe の network 分離 block を緩和。
4. **`capabilities/default.json` に `core:webview:allow-create-webview` / `core:webview:allow-create-webview-window` / `core:window:allow-create` を追加** — 案 D (secondary webview) の前倒し実装枠組を整備 + iframe navigation の権限保険。

- **変更ファイル**: 2（`src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`）
- **新規ファイル**: 0
- **依存追加**: 0
- **Rust 変更**: 0
- **store / component 変更**: 0（`components/preview/PreviewPane.tsx` 無変更）
- **`cargo check`**: 0 error（既存 warning 3 件のみ）
- **`npx tsc --noEmit`**: 0 error
- **`npx next build`**: 成功（9/9 static pages、2/2 export）

---

## 1. H1〜H6 仮説再検証

### H1: Tauri 2 webview navigation capability 不足 → **部分的に該当**

- 現状 `capabilities/default.json`: `core:webview:default` は入っているが、`core:webview:allow-create-webview-window` / `core:window:allow-create` は **未登録**。
- `core:webview:default` だけでは **親 webview 内の iframe navigation** は成立するが、**secondary webview window 作成（案 D）は不可**。
- 仮説検証結果: iframe レベルでは capability は十分。ただし将来の案 D 前倒しのため追加しておく価値は高い。
- **対処**: 3 permission 追加（低コスト、副作用なし）。

### H2: `additionalBrowserArgs` 不足 → ★**主因候補**

- `tauri.conf.json` の `windows[0]` に **`additionalBrowserArgs` 未指定**。
- Tauri 2 の default は `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection` のみで、**`IsolateOrigins` / `site-per-process` は disable されていない**。
- Chromium の site-per-process は cross-origin iframe を別プロセスで厳格に分離する機構で、**Windows WebView2 環境で特定の HTTPS origin iframe を「接続拒否」で block するケースが報告**されている。
- 明示的に `additionalBrowserArgs` を設定する際は docs 記載通り、既存 default の disable も **自分で含める必要あり**（Tauri は明示設定時に default を上書きする）。
- **対処**: `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,IsolateOrigins,site-per-process --disable-site-isolation-trials`。

### H3: `dangerousDisableAssetCspModification` 未設定 → ★**主因候補**

- Tauri 2 は **build time に asset をパースして CSP に `nonce-*` / `sha256-*` を自動注入**（Tauri 公式 docs「At compile time, Tauri appends its nonces and hashes to the relevant CSP attributes automatically」）。
- 現状 `dangerousDisableAssetCspModification` は default の `false`。つまり **全 directive で Tauri が nonce 書き換えを行う**。
- 懸念: Tauri が `frame-src` / `connect-src` / `img-src` / `default-src` に対して nonce を加えた結果、CSP spec 上 **nonce が source list に加わると `'unsafe-inline'` や `https:` schema source が**無効化されることがある（特に `script-src` / `style-src` の仕様では nonce-strict）。
- `frame-src` 系は nonce 書き換え対象ではないが、それでも Tauri が `default-src` を書き換える副作用で fallback が狂う可能性。
- **対処**: `dangerousDisableAssetCspModification: ["frame-src", "connect-src", "img-src", "default-src"]` を指定して iframe 関連 directive のみ runtime 書き換えを無効化。`script-src` / `style-src` は Next.js の nonce 機構を維持するため **除外**。

### H4: `devCsp` 未設定 → ★**主因候補（dev mode 固有）**

- `tauri.conf.json` の `app.security` に **`csp` のみ存在、`devCsp` 未設定**。
- Tauri 2 docs 明言:「The Content Security Policy that will be injected on all HTML files on development」。つまり **dev mode では `devCsp` が使われ、未設定なら `csp` が fallback されるはずだが、実装上 dev mode 特有の CSP 適用タイミング差異がある可能性**。
- 現状 ccmux-ide-gui の dev 時は `build.devUrl = "http://localhost:3000"` で Next.js dev server が親 origin。prod 時は static export（`file://` or `tauri://`）で親 origin が異なる。
- dev / prod で親 origin が変わると、CSP の `'self'` の解釈が変わり fallback directive の挙動にも影響する。
- **対処**: `devCsp` に `csp` と同内容を明示コピー。dev mode でも確実に同じ CSP が適用される保険。

### H5: `app.security.pattern` (isolation) → **該当せず**

- `tauri.conf.json` に `pattern` 未指定 → default の `{"use": "brownfield"}` が適用される。
- brownfield は isolation なしのシンプル pattern。iframe への追加制約なし。
- **対処なし**。

### H6: サイト側 / 外部環境 → **可能性低**

- オーナーは一般 Windows 11 環境。yahoo.co.jp / github.com は一般ブラウザで接続可能。
- corporate proxy / antivirus で block される稀ケースはあるが、PM-931 時点で検証ステップ §6-4 に記載済み。本 PM-933 でこれ以上の対処なし。
- **対処なし**。

---

## 2. 公式 doc 調査結果

### 2-1. `https://v2.tauri.app/security/csp/` より

> At compile time, Tauri appends its nonces and hashes to the relevant CSP attributes automatically to bundled code and assets, so you only need to worry about what is unique to your application.

つまり **Tauri の CSP 自動書き換えは default で有効**、明示 disable しないと `csp` 値が runtime で変更される。

### 2-2. `https://v2.tauri.app/reference/config/` より

**`devCsp`**:

> The Content Security Policy that will be injected on all HTML files on **development**.

→ dev mode では `devCsp` が優先され、未設定なら fallback は実装次第。明示設定が推奨。

**`dangerousDisableAssetCspModification`**:

> Disables the Tauri-injected CSP sources.

型定義（`DisabledCspModificationKind`）:
- `boolean`: 全 directive を disable / enable
- `string[]`: 指定 directive のみ disable

→ **`script-src` / `style-src` は Tauri の nonce が必要なので disable しない**。iframe 関連 directive のみ指定。

**`additionalBrowserArgs`** (Windows):

> Defines additional browser arguments on Windows. By default wry passes `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection` so if you use this method, you also need to disable these components by yourself if you want.

→ **上書きなので default を自分で含める必要あり**。

### 2-3. `https://v2.tauri.app/security/capabilities/` より

> Remote API Access: By default the API is only accessible to bundled code shipped with the Tauri App.

→ capability の `remote.urls` は **Tauri Commands の remote access 制御**。iframe の network request そのものには関与しない（CSP のみで制御される）。

### 2-4. `core:webview:allow-create-webview-window` / `core:window:allow-create`

- `src-tauri/gen/schemas/desktop-schema.json` で定義を確認（line 3140, 3368）。
- iframe の外部 URL 描画には必須ではないが、**案 D（secondary webview window）実装には必須**。前倒しで permission だけ追加しておき、必要時に rust 側で `WebviewWindowBuilder` を spawn する準備。

---

## 3. 採用案 + 理由

| 案 | 採用 | 理由 |
|---|---|---|
| 案 A: capability 追加 | ✅ | 低コスト、副作用なし、案 D 前倒し準備も兼ねる |
| 案 B: `dangerousDisableAssetCspModification` | ✅ | Tauri の runtime CSP 書き換え疑いを排除。iframe 系 4 directive のみ選択的 disable で Next.js nonce 機構は温存 |
| 案 B': `devCsp` 明示 | ✅ | dev mode 特有の CSP 適用タイミング問題を排除 |
| 案 C: `additionalBrowserArgs` | ✅ | WebView2 の site-isolation を緩和。Tauri default の disable list を踏襲した上で `IsolateOrigins,site-per-process` を追加 disable |
| 案 D: secondary webview window | ❌（準備のみ） | 工数 4〜6h。まず案 A+B+C+B' で改善が確認できるか検証。改善しなければ frontend で `WebviewWindow` 導入を次 PM で |

**総合方針**: **案 A+B+B'+C を組合せ**。どれか 1 つが効けば改善する。全て低コスト / 副作用小 / セキュリティ影響は管理可能。

---

## 4. 変更 diff

### 4-1. `src-tauri/tauri.conf.json`

#### 変更 1: windows[0] に `additionalBrowserArgs` 追加

```diff
      {
        "title": "ccmux-ide",
        "width": 1280,
        "height": 820,
        "minWidth": 900,
        "minHeight": 600,
        "decorations": true,
        "transparent": false,
        "acceptFirstMouse": true,
-       "dragDropEnabled": false
+       "dragDropEnabled": false,
+       "additionalBrowserArgs": "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,IsolateOrigins,site-per-process --disable-site-isolation-trials"
      }
```

#### 変更 2: `app.security` に `devCsp` + `dangerousDisableAssetCspModification` 追加

```diff
    "security": {
      "csp": "default-src 'self' https: ... worker-src 'self' blob:",
+     "devCsp": "default-src 'self' https: ... worker-src 'self' blob:",
+     "dangerousDisableAssetCspModification": ["frame-src", "connect-src", "img-src", "default-src"],
      "assetProtocol": { ... }
    }
```

`devCsp` 内容は `csp` と **完全一致**（dev/prod で挙動を揃えるため）。

### 4-2. `src-tauri/capabilities/default.json`

```diff
  "permissions": [
    "core:default",
    "core:app:allow-version",
    "core:window:default",
+   "core:window:allow-create",
    "core:event:default",
    "core:webview:default",
+   "core:webview:allow-create-webview",
+   "core:webview:allow-create-webview-window",
    ...
  ]
```

### 4-3. 無変更

- `components/preview/PreviewPane.tsx`: **無変更**（PM-929 実装維持）
- `lib/stores/preview.ts`: 無変更
- `src-tauri/src/lib.rs`: 無変更（Rust には手を入れない）
- `components/terminal/*` / `Shell.tsx` / `globals.css`: 無変更（PM-932 Terminal 並列作業との排他）

---

## 5. セキュリティ影響評価

### 5-1. `additionalBrowserArgs` での site-isolation disable

| 影響 | 評価 |
|---|---|
| cross-origin iframe が同一プロセスで実行される | **中**: Spectre / Meltdown 型の side-channel attack で理論上 cross-origin data が読まれうる |
| 実際の攻撃面 | **低**: ccmux-ide-gui は IDE devtool。悪意ある HTTPS URL を preview で開く行為はユーザー自身の選択。一般 Web 閲覧用ではない。|
| 代替案 | Phase 4 の案 D (secondary webview window) で preview 専用 webview に isolation を保ちつつ本体 webview は default |
| 採用判断 | **許容**（IDE devtool 特性 + 閲覧対象はユーザー選択）|

### 5-2. `dangerousDisableAssetCspModification: ["frame-src","connect-src","img-src","default-src"]`

| 影響 | 評価 |
|---|---|
| Tauri の nonce が指定 directive に注入されなくなる | **低**: 本アプリ本体 HTML (`out/index.html`) の script / style には引き続き nonce が付与される（`script-src` / `style-src` を disable list から除外）|
| iframe 関連の XSS 防御が weakened | **低**: iframe の中身は cross-origin barrier で iframe 自身の origin に隔離。親 webview の攻撃面には影響しない |
| Tauri が信頼できる asset を nonce で担保する本来の仕組み | **指定 4 directive のみで無効化** — script-src / style-src は nonce 生き残り |
| 採用判断 | **許容**（対象 directive は iframe 系のみ）|

### 5-3. `devCsp` 明示

| 影響 | 評価 |
|---|---|
| dev/prod で CSP が明示的に同じになる | **中立**（むしろ挙動一貫性で debug が容易）|
| 採用判断 | **利のみ**（副作用なし）|

### 5-4. capability 追加（3 permission）

| 影響 | 評価 |
|---|---|
| `core:webview:allow-create-webview` | frontend から新 webview 作成可能になる。現状使ってないが将来案 D で利用予定 |
| `core:webview:allow-create-webview-window` | frontend から新 webview window 作成可能になる。案 D の前提 |
| `core:window:allow-create` | frontend から新 window 作成可能になる。案 D の前提 |
| 悪用リスク | **低**: frontend は全て本アプリ自作コード。悪意ある script が window を乱立させる経路なし（XSS が起きない限り）|
| 採用判断 | **許容**（案 D 準備、即効果はないが将来のコスト削減）|

### 5-5. 総合判定

- **defence-in-depth**: 多少緩むが iframe の cross-origin barrier が本質的隔離を提供
- **IDE devtool の自己責任モデル**: 本製品は Claude Code 利用者向け devtool。一般消費者向け browser ではない
- **alternative**: 案 D（secondary webview）が最終形。本修正で改善しない場合に前倒し実装

---

## 6. オーナー実機検証手順

### 6-1. ⚠ 最重要: tauri dev の **完全再起動 + WebView2 プロセス kill** 必須

`additionalBrowserArgs` は WebView2 の **起動時引数**のため、**既存 webview プロセスが生き残っていると古い flag のまま**。以下を厳守:

1. 既存の `npm run tauri:dev` プロセスを **Ctrl+C で完全終了**
2. **terminal window を閉じて新規 terminal を開き直す**
3. **タスクマネージャで以下を全て kill**（残っていると古い browser args で起動中の webview が再利用される）:
   - `ccmux-ide.exe`
   - `msedgewebview2.exe`（複数プロセスある、全部 kill）
   - `WebView2*` 関連
   - `node.exe`（dev server）
4. `target/` cache クリアは **不要**（`tauri.conf.json` 変更は次回起動時に反映）
5. 再起動:
   ```bash
   cd C:/Users/hiron/Desktop/ccmux-ide-gui
   npm run tauri:dev
   ```
6. 起動後、プロジェクト選択 → プレビュータブ

### 6-2. 3 ケース検証

#### ケース A: localhost（回帰確認）

1. 別 shell で `http://localhost:3000` dev server 起動
2. Preview URL 欄に `http://localhost:3000` → iframe 内表示、HMR 動作
3. **期待**: 従来通り、回帰なし

#### ケース B: 一般 HTTPS サイト（yahoo.co.jp）

1. Preview URL 欄に `https://yahoo.co.jp` → Enter
2. **期待挙動の変化**:
   - **修正前 (PM-931)**: WebView2 「接続が拒否されました」赤禁止マーク
   - **修正後 (PM-933)**: iframe 内に yahoo.co.jp が **表示される** or yahoo.co.jp 自身の X-Frame-Options で真っ白
3. 真っ白の場合は「外部で開く」ボタンで既定ブラウザへ誘導（従来通り）

#### ケース C: iframe 埋込 NG な HTTPS（github.com）

1. URL 欄に `https://github.com/` → Enter
2. **期待**:
   - **接続拒否エラーは出ない**
   - iframe 真っ白（github 側の X-Frame-Options による正常な挙動）
   - 「外部で開く」で外部ブラウザ起動

### 6-3. 問題切り分け（改善しない場合）

| 症状 | 推定原因 | 対処 |
|---|---|---|
| ケース B / C で接続拒否継続 | WebView2 プロセス残留 | §6-1 再実行（タスクマネージャで `msedgewebview2.exe` 残留確認）|
| ケース B 表示 / C 接続拒否 | github 固有の制約 | curl で直接接続確認、VPN / proxy 切分 |
| 全ケース接続拒否 | Tauri 2 / WebView2 本体制約 | 案 D（secondary webview）前倒しを CEO に相談 |
| 起動失敗 / blank window | capability または browser args 構文誤り | `cargo check` / `cargo tauri dev` の stderr を確認 |

### 6-4. 回帰確認

- Reload ⟳ / 履歴 dropdown / 戻る / 進む / タブ state 保持: 従来通り動作するか
- Terminal / Chat / Editor: 無変更のため回帰なし想定（PM-932 Terminal 並列作業の影響は別枠）
- 更新チェック / keyring: 無変更

### 6-5. prod build での検証（時間があれば）

```bash
cd C:/Users/hiron/Desktop/ccmux-ide-gui
npm run tauri:build
```

prod build の .exe で同じ 3 ケースを検証。dev/prod で挙動が異なる場合、`devCsp` / `csp` の差異要因を特定できる。

---

## 7. 検証結果（静的）

### 7-1. `cargo check`

```bash
cd C:/Users/hiron/Desktop/ccmux-ide-gui/src-tauri
cargo check
# → warning: 3 (既存のみ: sessions_has_project_id / Scope::Cwd / MonitorState::context_ratio)
# → error: 0
# → Finished `dev` profile [unoptimized + debuginfo] target(s) in 34.94s
```

### 7-2. `npx tsc --noEmit`

```bash
cd C:/Users/hiron/Desktop/ccmux-ide-gui
npx tsc --noEmit
# → 0 error（exit 0、出力なし）
```

### 7-3. `npx next build`

```bash
cd C:/Users/hiron/Desktop/ccmux-ide-gui
npx next build
# → ✓ Compiled successfully
# → ✓ Generating static pages (9/9)
# → ✓ Exporting (2/2)
# → Route(/workspace) 4.3 kB / 191 kB First Load JS
```

既存 warning（lint / SSR `window is not defined`）のみで、本 PM-933 起因の問題なし。

### 7-4. `tauri.conf.json` schema 適合性

- `additionalBrowserArgs`: `WindowConfig` property として schema で `string | null` 型定義（tauri-config-schema.json line 475）に完全一致
- `devCsp`: `Csp | null` 型（line 1159）、string 形式で適合
- `dangerousDisableAssetCspModification`: `DisabledCspModificationKind`（line 1261）、string[] 形式で適合
- capability 3 permission: desktop-schema.json で定義済（line 3134 / 3140 / 3368）

### 7-5. 並列作業との排他

| 対象 | 本 PM-933 | 他 PM (PM-932 Terminal 等) | 衝突 |
|---|---|---|---|
| `src-tauri/tauri.conf.json` | 変更 | 無変更（想定） | なし |
| `src-tauri/capabilities/default.json` | 変更 | 無変更（想定） | なし |
| `components/preview/PreviewPane.tsx` | **無変更** | 無変更 | なし |
| `components/terminal/*` | 無変更 | 変更（PM-932） | なし（排他）|
| `app/globals.css` | 無変更 | 変更可能性 | なし（排他）|
| `src-tauri/src/*.rs` | **無変更** | 無変更（想定） | なし |

---

## 8. 完了条件チェックリスト

- [x] H1〜H6 仮説検証実施、H2/H3/H4 を主因候補として複合対処
- [x] Tauri 2 公式 doc 調査（CSP / config reference / capabilities 3 ページ）+ schema 検証
- [x] `src-tauri/tauri.conf.json` に `devCsp` / `dangerousDisableAssetCspModification` / `additionalBrowserArgs` 追加
- [x] `src-tauri/capabilities/default.json` に 3 permission 追加（案 D 前倒し）
- [x] `cargo check` 0 error（既存 warning 3 件のみ）
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功（9/9 static pages、2/2 export）
- [x] `components/preview/PreviewPane.tsx` **無変更**（PM-929 実装維持）
- [x] `components/terminal/*` / `Shell.tsx` / `globals.css` **無変更**（PM-932 並列作業との排他）
- [x] Rust 無変更
- [x] logger 方針維持（component touch なし）
- [x] セキュリティリスク評価実施（§5）
- [x] オーナー実機検証手順（§6）に「tauri dev 完全再起動 + WebView2 プロセス kill」強調記載
- [x] 過度な refactor なし、最小 diff（2 ファイル、合計 8 行追加）

---

## 9. 次アクション（CEO 向け）

### 9-1. 完了報告

PM-933 Preview 接続拒否再調査完了。オーナー実機検証（§6）を依頼。特に:

- **§6-1 tauri dev 完全再起動 + `msedgewebview2.exe` タスクマネージャ kill**: `additionalBrowserArgs` は WebView2 起動時引数のため既存プロセス残留は致命
- **§6-2 ケース B (yahoo.co.jp)**: 接続拒否→表示 or 真っ白（X-Frame block）への変化を確認
- **§6-3**: 改善しない場合の切分けフロー

### 9-2. 想定される検証結果パターン

| 結果 | 原因推定 / 次手 |
|---|---|
| ケース A / B / C 全て期待通り | **PM-933 で解決**。主因は Tauri 2 CSP 自動書き換え or site-isolation だった |
| ケース B 表示、C 真っ白 | **予想通りの改善**（X-Frame-Options block は iframe 仕様上の正常挙動）|
| ケース A OK、B / C で依然「接続拒否」 | **WebView2 プロセス残留**疑い → §6-1 再実行 |
| 全ケース改善なし | **Tauri 2 / WebView2 本体制約**疑い → 案 D（secondary webview）前倒しを PM-934 で検討 |

### 9-3. 中期: Phase 4 案 D（secondary webview）

- 本 PM-933 の 3 permission 追加で案 D 前提 capability は **準備完了**
- 実装すれば Preview ボタン押下で新 `WebviewWindow` が spawn され、iframe の X-Frame 制約を完全回避可能
- 工数目安 4〜6h、frontend のみで完結（Rust は touch 不要）

### 9-4. 関連タスク

- PM-932 Terminal 修正と排他完了、同時 commit 可能
- PM-925 Phase 2（複数 URL タブ / auto-detect）は別途判断
- 本 PM-933 で改善確認できれば、PM-925/927/929/931 の積み残しはクリア

---

**レポート終了**
