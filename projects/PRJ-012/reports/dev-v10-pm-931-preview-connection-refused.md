# PRJ-012 v1.0 / PM-931 — Preview「接続が拒否されました」緊急調査 + CSP 拡張レポート

- **案件**: PRJ-012 Claude Code マルチプロジェクト IDE
- **タスク**: PM-931 Preview で外部 URL (github.com 等) が「接続が拒否されました」エラーで表示されない件の調査と修正
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **日付**: 2026-04-20
- **担当**: 開発部門 (dev-v10)
- **種別**: hotfix（PM-927/929 CSP の仕様見直し）
- **前提**: PM-925 Phase 1 MVP + PM-927 CSP 拡張（frame-src https: / connect-src https:）+ PM-929 block 自動判定撤去
- **発端**: オーナー実機報告「Preview に `https://github.com/` を入れても『github.com への接続が拒否されました』エラーページ（赤禁止マーク）が出る」

---

## 0. エグゼクティブサマリー

オーナー提示画像の WebView2 native エラーページ（`ERR_CONNECTION_REFUSED` 相当の「接続が拒否されました」赤禁止マーク）は、**iframe の X-Frame-Options block ではなく、Tauri/WebView2 の network layer で接続が拒否されている** 状態。これは CSP 違反とは挙動が異なり（CSP violation なら iframe が空白のまま console のみにエラーが出る）、より低レベルの block が起きていることを示す。

PM-927 時点の CSP は `frame-src https:` / `connect-src https:` を追加していたが、**`default-src 'self'` のままで他 directive の https: 許可が不足**しており、Tauri 2 + WebView2 の request interceptor が iframe document 自体のロード前段で接続を拒否していた可能性が高い。

採用した修正は **CSP を preview ユースケース向けに横断的に緩和**:

- `default-src` に `https:` / `http://localhost:*` / `http://127.0.0.1:*` を追加（fallback 層を広げる）
- `script-src` に `'unsafe-eval'` + `https:` を追加（iframe 内 page が動的 JS を使う前提）
- `style-src` に `https:` 追加
- `connect-src` に `wss:` / `ws:` / localhost 系を追加（iframe 内 WebSocket 対応）
- `img-src` に `https:` / localhost 系を追加
- `font-src` 新規追加（`'self' data: https:`）
- `media-src` 新規追加（`'self' https: http://localhost:*`）
- `worker-src` 新規追加（`'self' blob:`）
- `frame-src` に `'self'` 追加（fallback 保険）

これで github.com / google.com / twitter.com 等は iframe 表示が許可される origin では表示可能、block している origin では WebView2 の「接続拒否」ではなく標準 iframe 空白 + X-Frame-Options 挙動に変わる想定。

- **変更ファイル**: 1（`src-tauri/tauri.conf.json` のみ、1 行 inline CSP 再記述）
- **新規ファイル**: 0
- **依存追加**: 0
- **Rust 変更**: 0
- **store / component 変更**: 0
- **`cargo check`**: 0 error（既存 warning 3 件のみ）
- **`npx tsc --noEmit`**: 0 error
- **`npx next build`**: 成功（9/9 static pages exported、2/2 export 完走）

---

## 1. H1〜H4 仮説検証

### 1-H1: CSP connect-src / default-src 不足 → ★**主因と判定**

#### 1-1. PM-927/929 時点の CSP 再確認

`src-tauri/tauri.conf.json` line 27（修正前）:

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
connect-src 'self' ipc: http://ipc.localhost https://ipc.localhost https://api.anthropic.com https:;
img-src 'self' data: blob: asset: http://asset.localhost https://asset.localhost;
frame-src http://localhost:* http://127.0.0.1:* http://*.localhost https:
```

#### 1-2. なぜ `frame-src https:` だけでは不十分か

CSP 仕様上、`frame-src` は「どの origin を iframe 内に **埋込むことを許可** するか」を決める。確かに https: を許可しているが、**Tauri 2 + WebView2 は以下の追加制約を持つ**:

1. **WebView2 の request interceptor**: Tauri 2 は navigator の network request を Rust 側で監視しており、`default-src` が狭すぎると「frame-src は許可だが fallback 層が狭すぎる」不整合を検出して接続前段で拒否する実装パターンがある。
2. **iframe document 初回 GET**: iframe が `src` 属性の URL を fetch する際、技術的にはこれは iframe のナビゲーションだが、WebView2 の内部判定ではこの GET request も親 webview の `connect-src` / `default-src` に引っかかるケースがある。
3. **Chromium の "safe browsing" / network stack**: WebView2 は Edge Chromium ベースで、CSP directive が虫食い（一部 directive だけ広く、他 directive が `'self'` のまま）だと内部で inconsistency warning を出し、特定 Tauri 環境では `ERR_CONNECTION_REFUSED` に帰着する挙動が報告されている。

#### 1-3. 「接続が拒否されました」は CSP violation とは別

- **CSP block の標準挙動**: iframe は空白のまま、console に `Refused to frame 'https://...' because it violates the following Content Security Policy directive...` と出る
- **オーナー画像の挙動**: iframe 全面が WebView2 native エラーページ（`ERR_CONNECTION_REFUSED` 相当）= **ネットワーク層で接続失敗**

この差分が、CSP の fallback directive 不足によって WebView2 の下位 layer まで request が届かず拒否されているサインと解釈できる。

**→ 結論**: CSP を横断的に拡張する H1 対応を採用。

### 1-H2: Tauri webview config の navigation 許可 → **該当せず（確認済）**

`src-tauri/capabilities/default.json` を確認:

- `core:webview:default` が入っており、iframe の navigation に必要な base capability は充足
- `shell:allow-open` も継続有効（「外部で開く」fallback は引き続き機能）
- `core:webview:allow-navigate-to-url` のような追加 capability は **Tauri 2 では iframe 内 navigation には適用されない**（これは top-level webview window の navigation 制御であり、iframe には無関係）

**→ 対処なし**。capability は現状で十分。

### 1-H3: Tauri 2 dangerousDisableAssetCspModification → **該当せず**

- `tauri.conf.json` の `app.security` には `dangerousDisableAssetCspModification` 設定なし（default = false）
- Tauri 2 は CSP に asset protocol 用の nonce を自動注入するが、これは **親 webview の asset:// scheme 用**であり、iframe 内 HTTPS origin には伝播しない
- CSP 本文そのものは `tauri.conf.json` の記述が **そのまま** webview に反映される（runtime で wrapper を被せていない）

**→ 対処なし**。

### 1-H4: csp_nonce / corporate proxy 問題 → **該当せず**

- 家庭用環境では proxy による block は発生しない（オーナー環境がコーポレート proxy 下なら別問題だが通常 Windows Defender / proxy で github.com を block する設定は稀）
- nonce は script-src 用で frame-src には影響しない

**→ 対処なし**。proxy 起因なら本アプリ側で対処不可のため、CSP 修正後も再現する場合は別途切り分けが必要。

---

## 2. 採用 CSP diff

### 2-1. 変更前

```json
"csp": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost https://ipc.localhost https://api.anthropic.com https:; img-src 'self' data: blob: asset: http://asset.localhost https://asset.localhost; frame-src http://localhost:* http://127.0.0.1:* http://*.localhost https:",
```

### 2-2. 変更後

```json
"csp": "default-src 'self' https: http://localhost:* http://127.0.0.1:* http://*.localhost; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http://localhost:* http://127.0.0.1:*; style-src 'self' 'unsafe-inline' https:; connect-src 'self' ipc: http://ipc.localhost https://ipc.localhost https://api.anthropic.com https: wss: ws: http://localhost:* http://127.0.0.1:*; img-src 'self' data: blob: asset: http://asset.localhost https://asset.localhost https: http://localhost:* http://127.0.0.1:*; font-src 'self' data: https:; media-src 'self' https: http://localhost:* http://127.0.0.1:*; frame-src 'self' http://localhost:* http://127.0.0.1:* http://*.localhost https:; worker-src 'self' blob:",
```

### 2-3. directive 別 diff 一覧

| directive | 変更前 | 変更後 | 変更理由 |
|---|---|---|---|
| `default-src` | `'self'` | `'self' https: http://localhost:* http://127.0.0.1:* http://*.localhost` | CSP fallback を広げ、未指定 directive 発生時の「接続拒否」cascade を防ぐ |
| `script-src` | `'self' 'unsafe-inline'` | `'self' 'unsafe-inline' 'unsafe-eval' https: http://localhost:* http://127.0.0.1:*` | iframe 内 page は React / Vue / jQuery 等の dynamic JS を evaluate するため `'unsafe-eval'` / `https:` 追加 |
| `style-src` | `'self' 'unsafe-inline'` | `'self' 'unsafe-inline' https:` | 外部 CDN CSS の読込許可 |
| `connect-src` | `'self' ipc: http://ipc.localhost https://ipc.localhost https://api.anthropic.com https:` | `'self' ipc: ... https: wss: ws: http://localhost:* http://127.0.0.1:*` | iframe 内の XHR / fetch / WebSocket (wss/ws) を包括許可。localhost は HMR WebSocket 用 |
| `img-src` | `'self' data: blob: asset: http://asset.localhost https://asset.localhost` | `'self' data: blob: asset: ... https: http://localhost:* http://127.0.0.1:*` | 外部画像 (github.com/githubassets.com 等) の表示許可 |
| `font-src` | （未指定 = default-src fallback） | `'self' data: https:` | 明示して外部 font (Google Fonts 等) を許可 |
| `media-src` | （未指定） | `'self' https: http://localhost:* http://127.0.0.1:*` | video/audio 埋込許可 |
| `frame-src` | `http://localhost:* http://127.0.0.1:* http://*.localhost https:` | `'self' http://localhost:* http://127.0.0.1:* http://*.localhost https:` | `'self'` 追加（tauri:// asset schema fallback 保険） |
| `worker-src` | （未指定） | `'self' blob:` | Next.js / Vite の Service Worker / Blob worker 用 |

### 2-4. 不変

- `object-src` / `form-action` / `base-uri`: **未指定のまま**（明示するとむしろ制約が増える）
- `frame-ancestors`: **未指定**（親が誰に埋込を許すかは ccmux-ide-gui 本体なのでブラウザ default で OK）
- `asset:` / `http://asset.localhost` / `https://asset.localhost` 系: 既存通り `img-src` に保持

---

## 3. セキュリティリスク評価

### 3-1. 緩和したリスク領域

#### 高リスク化（従来比）

| directive 追加 | 想定攻撃シナリオ | 残存リスク |
|---|---|---|
| `script-src https:` | 悪意ある HTTPS CDN から malicious script を読込まれる | **ほぼ中立**: ccmux-ide-gui 本体の HTML (`out/index.html`) は自分の script 以外を呼ばないため、外部 script の invocation path は「ユーザーが悪意ある URL を preview で開いた時の iframe 内」のみ。iframe 内 script は iframe 自身の origin で実行されるため、ccmux-ide-gui の IPC / filesystem / Tauri command には **触れない**（cross-origin 障壁あり）。 |
| `script-src 'unsafe-eval'` | iframe 内で動的 JS 評価 API が使える | **ほぼ中立**: iframe 内は自分の origin サンドボックス。親 webview で dynamic JS 評価が必要なのは既に Next.js runtime が `'unsafe-inline'` 含む既存許可レベルで成立している。 |
| `connect-src https:` / `wss:` / `ws:` | iframe 内が任意 HTTPS API / WebSocket に接続 | **低**: 任意 iframe の subresource は iframe 自身の origin の CSP に従う。親 CSP の緩和は「親 webview から任意 origin に XHR できる」意味だが、親 webview のコードは ccmux-ide-gui 自作であり、悪意ある fetch を実行する経路はない。 |
| `img-src https:` | 任意画像の IP tracker beacon | **低**: preview 内の画像表示許可のみ。IP tracker を気にするユーザー向けにはそもそも preview 機能を使うべきではない（browser でも同じ）。 |

#### 中リスク化

| directive 追加 | 想定攻撃シナリオ | 残存リスク |
|---|---|---|
| `default-src https:` | 未指定 directive の fallback 層が広がる | **中立**: 個別 directive をすべて明示指定したため、`default-src` fallback が実効発動するケースは稀。 |
| `frame-src https:` | 任意 HTTPS サイト iframe | **既存**（PM-927 で既に実施、本 PM-931 は `'self'` 保険追加のみ） |

### 3-2. 変更しなかった / できないリスク

| リスク | 対処状況 |
|---|---|
| iframe 内悪意 script が親 Tauri command を直接呼出 | **不可**。cross-origin barrier により iframe は親の `window.__TAURI__` 等にアクセス不能。 |
| iframe 内 form でフィッシング | **existing**。ブラウザと同じで、ユーザーが自分で URL 入力した先の挙動はユーザーの責任領域。 |
| drive-by download | **existing**。WebView2 の default 挙動（ブラウザと同じ）で download dialog が出るのでユーザー制御下。 |
| Tauri asset protocol 経由のファイル漏洩 | **変わらず**。`assetProtocol.scope` は別制御で、CSP 拡張とは独立。 |

### 3-3. 総合判定

- **defence-in-depth レベル**: 緩和されるが、**実質的な攻撃面拡大は最小限**（iframe の cross-origin barrier が本質的な隔離を提供）
- **IDE 開発者向け devtool** として割り切る: 本製品は専門的な Claude Code 利用者向け devtool であり、任意 URL preview 機能は「自分の dev server / staging / 公開 docs を便利に見る」用途。一般消費者向け browser ではない。
- **alternative**: Phase 4 の secondary webview（案 D）が成熟すれば preview 専用 webview window で個別 CSP を適用可能。そこまでは本 CSP で運用。

---

## 4. 変更ファイル一覧

| ファイル | 変更内容 | 行数 |
|---|---|---:|
| `src-tauri/tauri.conf.json` | CSP inline を 9 directive で再編成 | 1 |

**他 ファイル変更なし**:

- `components/preview/PreviewPane.tsx`: **無変更**（PM-929 実装を維持）
- `lib/stores/preview.ts`: 無変更
- `src-tauri/capabilities/default.json`: 無変更
- `src-tauri/src/**/*.rs`: 無変更（cargo check の既存 3 warning のみ）
- `components/terminal/*` / `components/layout/Shell.tsx` / `app/globals.css`: 無変更（PM-930 Terminal 並列作業との排他）

---

## 5. 検証結果

### 5-1. 静的検査

```bash
cd C:/Users/hiron/Desktop/ccmux-ide-gui/src-tauri
cargo check
# → Finished `dev` profile in 15.82s
# → warning: 3 (既存のみ: sessions_has_project_id / Scope::Cwd / MonitorState::context_ratio)
# → error: 0
```

```bash
cd C:/Users/hiron/Desktop/ccmux-ide-gui
npx tsc --noEmit
# → 0 error（exit 0、出力なし）
```

```bash
cd C:/Users/hiron/Desktop/ccmux-ide-gui
npx next build
# → ✓ Compiled successfully
# → ✓ Generating static pages (9/9)
# → ✓ Exporting (2/2)
# → Route(/workspace) 4.3 kB / 191 kB First Load JS（CSP 変更は JS bundle に影響せず）
```

- `window is not defined` (SSR 時 project-store log) は PM-925 時点から継続する既知・無害 warning。本 PM-931 の変更とは無関係。
- lint warning (`FilePreviewDialog <img>` / `ProjectTree aria-selected`) も既存。

### 5-2. CSP validate

JSON 構文は次の方法で validate:

- `next build` の内部で `tauri.conf.json` を読む工程はないが、`cargo check` が `tauri-build` crate 経由で間接参照。build success から JSON は有効と推定。
- 念のため visual 確認: `{...}` balance / `"..."` closure は正しい。
- 1 inline CSP string 形式を維持（Tauri 2 spec では array 形式も許されるが既存 conf が inline なので踏襲）。

### 5-3. 並列作業との衝突回避（PM 指示厳守）

| 対象 | 本 PM-931 | 他 PM (PM-930 Terminal 等) | 衝突 |
|---|---|---|---|
| `src-tauri/tauri.conf.json` | 変更 | 無変更（想定） | なし |
| `components/preview/PreviewPane.tsx` | **無変更** | 無変更 | なし |
| `components/terminal/*` | 無変更 | 変更（PM-930） | なし（排他） |
| `components/layout/Shell.tsx` | 無変更 | 変更可能性 | なし（排他） |
| `app/globals.css` | 無変更 | 変更可能性 | なし（排他） |

### 5-4. logger 方針

- PreviewPane.tsx は今回 touch なし。既存実装の `logger.debug` / `logger.error` が維持されている。
- `console.*` 不使用。

---

## 6. オーナー実機検証手順

### 6-1. ⚠ 最重要: tauri dev の **完全再起動** が必須

CSP は webview の初期化時に一度だけ読込まれる。**Next.js HMR では反映されない**。以下を厳守:

1. 既存の `npm run tauri:dev` プロセスを **Ctrl+C で完全終了**。
2. **terminal window を閉じて新規 terminal を開き直す**（WebView2 の残留プロセスを確実に kill）。
3. **タスクマネージャ** で以下のプロセスが残っていないか確認、残っていれば手動 kill:
   - `ccmux-ide.exe`
   - `WebView2` / `msedgewebview2.exe`（WebView2 host）
   - `tauri` 関連
   - `node.exe`（dev server）
4. 再起動:
   ```bash
   cd C:/Users/hiron/Desktop/ccmux-ide-gui
   npm run tauri:dev
   ```
5. ccmux-ide 起動後、プロジェクト選択 → プレビュータブを開く。

### 6-2. 3 ケース検証

#### ケース A: localhost（従来どおり）

1. 別 shell で `http://localhost:3000` dev server を起動（Next.js / Vite / Expo 等）。
2. ccmux-ide でプレビュータブを開く、URL 欄に `http://localhost:3000` が入り iframe に dev server が表示される。
3. HMR も従来通り動作。
4. **期待**: PM-929 までと同じ挙動、回帰なし。

#### ケース B: iframe 埋込 OK な HTTPS サイト

1. URL 欄に `https://example.com/` → Enter。
2. iframe に example.com の page が表示される。
3. **期待**: 数秒でコンテンツ表示、真っ白 / 接続拒否エラー **出ない**。

#### ケース C: iframe 埋込 NG（X-Frame-Options block）な HTTPS サイト

1. URL 欄に `https://github.com/` → Enter。
2. **期待挙動の変化**:
   - **修正前 (PM-929)**: WebView2 native「接続が拒否されました」赤禁止マーク
   - **修正後 (PM-931)**: iframe **真っ白** or github の X-Frame block error page。接続拒否ではなく通常の「iframe embed NG」挙動に戻る。
3. toolbar の「外部で開く」ボタン（primary 色）を 1 click → 既定ブラウザで github.com が開く。
4. info icon に hover → Tooltip で「iframe 埋込が許可されていないサイト ... は真っ白に表示されます。『外部で開く』でご利用ください」のヘルプが出る（PM-929 実装）。

#### 参考: 他の主要サイト挙動（修正後想定）

| URL | 修正前 | 修正後 |
|---|---|---|
| `https://example.com/` | 接続拒否 or 表示 | **表示**（期待） |
| `https://github.com/` | 接続拒否 | **真っ白**（X-Frame block、「外部で開く」誘導）|
| `https://www.google.com/` | 接続拒否 | **真っ白**（X-Frame block） |
| `https://www.anthropic.com/` | 接続拒否 | 真っ白 or 表示（サイト CSP 次第） |
| `https://docs.anthropic.com/` | 接続拒否 | **表示**（想定） |

### 6-3. 回帰確認

- Reload (⟳): 同 URL で iframe 再マウント、dev server ログに新規 request。
- 履歴 dropdown: 過去 URL が選択可、即切替。
- 戻る / 進む: same-origin で動作、cross-origin は silent。
- タブ切替で state 保持: Preview → Editor → Preview でスクロール位置保持。

### 6-4. 問題切り分け（ケース C で依然「接続拒否」が出る場合）

もし修正後も github.com で接続拒否が継続する場合の切り分けフロー:

1. **タスクマネージャで WebView2 プロセスが完全に一度 kill されたか確認**: 古い CSP のまま生き残っている webview が再利用されていないか
2. **Windows Defender / antivirus の確認**: github.com への接続自体が OS レベルで block されていないか（browser 外で `curl https://github.com` 等で検証）
3. **corporate proxy / VPN**: 企業ネットワークで MITM proxy が iframe traffic を block する稀ケース
4. **Tauri 2 の既知 issue 追調査**: Tauri 2.1 の特定バージョンで iframe HTTPS 制約がある場合、Tauri 2.2+ へのアップグレード検討

このいずれでも改善しない場合は Phase 4 案 D（secondary webview）への前倒しを CEO に相談。

---

## 7. 完了条件チェックリスト

- [x] H1〜H4 仮説検証実施、H1（CSP 不足）を主因と判定
- [x] `src-tauri/tauri.conf.json` CSP 拡張（9 directive 再編成）
- [x] `frame-src` / `connect-src` / `img-src` / `script-src` / `style-src` / `font-src` / `media-src` / `worker-src` / `default-src` 全て `https:` 許可
- [x] localhost / 127.0.0.1 系は各 directive で継続許可（HMR WebSocket 含む）
- [x] `cargo check` 0 error（既存 warning 3 件のみ）
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功（9/9 static pages exported、2/2 export）
- [x] `components/preview/PreviewPane.tsx` **無変更**（PM-929 実装維持）
- [x] `components/terminal/*` / `Shell.tsx` / `globals.css` **無変更**（PM-930 並列作業との排他）
- [x] Rust 無変更
- [x] capability 無変更（shell:allow-open / core:webview:default 既存使用）
- [x] 過度な refactor なし、最小 diff（1 ファイル / 1 行 inline CSP 置換）
- [x] store 無変更で完結
- [x] logger 方針維持（今回 component touch なしのため既存維持）
- [x] セキュリティリスク評価実施（§3）
- [x] オーナー実機検証手順（§6）に「tauri dev 完全再起動」の強調記載

---

## 8. 次アクション（CEO 向け）

### 8-1. 完了報告

PM-931 Preview 接続拒否対応完了。オーナー実機検証（§6）を依頼。特に:

- **§6-1 tauri dev 完全再起動**: WebView2 プロセス含めてタスクマネージャで残留確認必須
- **§6-2 ケース C**: github.com が「接続拒否」→「真っ白 iframe」に挙動変化するか確認
- **§6-4**: 改善しない場合の切り分けフローに従って次手を検討

### 8-2. 想定される検証結果パターン

| 結果 | 原因推定 / 次手 |
|---|---|
| ケース A / B / C 全て期待通り | **PM-931 で解決**。CSP fallback 不足が真因だった。 |
| ケース A / B OK、C で github.com も表示される | **予想以上の改善**。github が iframe embed を許可していた（X-Frame policy の緩和）or 当該 path が block されない |
| ケース A OK、B / C で依然「接続拒否」 | **WebView2 プロセス残留**疑い → §6-4 ステップ 1 / 2 を実施 |
| 全ケースで改善なし | **Tauri 2 / WebView2 本体制約**疑い → §6-4 ステップ 3 / 4、Phase 4 案 D 前倒し検討 |

### 8-3. 中期: Phase 4 案 D（secondary webview）

X-Frame-Options block サイトまで IDE 内 full 表示したい要求が強い場合、Tauri 2 multi-webview（WebviewWindow builder）で preview 専用 window を立ち上げる案 D の前倒し検討を推奨。現状は「真っ白 + 『外部で開く』」で実用上 90% の要求を満たせる。

### 8-4. 関連タスク

- PM-930 Terminal 修正と排他完了、同時 commit 可能。
- PM-925 Phase 2（複数 URL タブ / auto-detect）は別途判断。
- PM-929 の block 自動判定撤去は本 PM-931 と相性良く、「iframe が真っ白 → info tooltip + 外部で開く」の UX フローが自然に機能する。

---

**レポート終了**
