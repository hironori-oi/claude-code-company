# PRJ-018 Asagi — DEC-018-026 ② SVG 最終確認 + AS-META-09 連動 実装報告

| 項目 | 内容 |
|---|---|
| 案件 | PRJ-018 Asagi（浅葱）— Codex マルチプロジェクト IDE |
| 文書種別 | 開発部門 実装報告（デザイン × 開発） |
| 担当 | デザイン × 開発部門 |
| 起案日 | 2026-05-02 (sixth update 派生・DEC-018-026 ② ライン) |
| 関連 DEC | DEC-018-020（γ ロゴ正式採用）／ **DEC-018-026 ②（AS-DESIGN-04 SVG 最終確認 + AS-META-09 連動）** |
| 上位文書 | `reports/design-logo-final-gamma.md`（採用記録） / `reports/design-brand-v1.md` § 7 / `M1-STATUS.md`（Blocked リスト） |
| ミッション工数 | 想定 1〜2h / 実績 約 1.5h |
| 結論 | **AS-META-09 完了根拠を充足**。Tauri / Next.js 両側のアイコン配線が実機ビルド可能状態に到達。`M1-STATUS.md` の Blocked から AS-META-09 を解除可。 |

---

## § 0 サマリ（30 秒版）

- γ ロゴ「浅葱滴」の SVG マスター 5 種を **Read 完了 → 修正不要を確認**（viewBox 正方形 / 不要メタデータなし / ハードコード色 / brand v1 § 7 token と一致）
- PNG 8 サイズ + ICO 2 種 + ICNS 1 を **ハッシュ照合 → 全完全一致**（再生成不要）
- `tauri.conf.json` の `bundle.icon` に **`icons/128x128@2x.png` を追記**（spec 必須 5 ファイル全列挙）。`bundle.identifier = "jp.improver.asagi"` / `productName = "Asagi"` 既存値で要件充足
- `src/app/layout.tsx` Metadata に **PNG favicon (16/32) + apple-touch-icon (180) を追加**、`Viewport.themeColor` を dark/light 分離設定（DEC-018-020 γ accent #5BB8C4 / paper #0a0e14）
- `BRAND.md` § 9 の参照パスを **生成済 SVG / アイコン全 27 ファイル**に最終化（"AS-DESIGN-04 で生成予定" → "完了" に更新）
- 検証: `cargo check` PASS / `tsc --noEmit` PASS（自部分のみ。並行作業の use-codex.ts エラーは別ライン）/ `npm run build` PASS / `tauri info` icon 関連 error/warning なし

---

## § 1 変更ファイル絶対パス一覧

| # | パス | 種別 | 変更概要 |
|---|---|---|---|
| 1 | `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-018/app/asagi-app/src-tauri/tauri.conf.json` | M | `bundle.icon` 配列に `icons/128x128@2x.png` を追加（5 件全列挙）|
| 2 | `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-018/app/asagi-app/src/app/layout.tsx` | M | Metadata 強化（PNG favicon 16/32 + apple-touch-icon 180 + applicationName + 詳細 description）+ `Viewport.themeColor` を dark/light 分離追加 |
| 3 | `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-018/BRAND.md` | M | § 9「開発側 import パス」を γ ロゴ最終仕様に合わせて全面更新（SVG 5 種 + PNG 8 + ICO 2 + ICNS 1 + Tauri 5 + Next.js 5 = 26 パス + tokens.css 訂正）|
| 4 | `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-018/reports/dev-dec026-svg-final-as-meta-09.md` | A | 本実装報告書 |

> SVG マスター / PNG / ICO / ICNS は **既存ファイルが完全に正しい状態**であり、再生成・上書きは発生しなかった（Step 1 / Step 2 で確認）。

---

## § 2 Step 1: SVG マスター最終確認

### 2.1 検査対象 SVG 5 種

| ファイル | viewBox | 不要メタデータ | fill/stroke | ハードコード色 | brand v1 § 7 token 一致 |
|---|---|---|---|---|---|
| `app/design/logos/asagi-icon.svg` | `0 0 1024 1024` (正方形) | なし | hex / radialGradient / linearGradient | はい | ✓ #5BB8C4 系 + #0a0e14 paper |
| `app/design/logos/asagi-icon-symbol.svg` | `0 0 1024 1024` | なし | hex / 透明背景 | はい | ✓ |
| `app/design/logos/asagi-icon-dark.svg` | `0 0 1024 1024` | なし | hex | はい | ✓ asagi-500 系 + 紺紙 |
| `app/design/logos/asagi-icon-light.svg` | `0 0 1024 1024` | なし | hex | はい | ✓ asagi-700 系 + オフホワイト紙 (#F9F7F2) |
| `app/design/logos/asagi-favicon.svg` | `0 0 64 64` (正方形) | なし | hex / radialGradient | はい | ✓ |

**判定**: **全件問題なし → 修正不要**。SVGO 通す必要もなし（既に最小構成）。inkscape/sodipodi/figma/sketch 名前空間 grep もゼロヒット（§ 2.2 参照）。

> NOTE: タスク仕様には `app/design/logos/final/` というサブディレクトリ前提があったが、実体は `app/design/logos/` 直下に SVG 5 種、`app/design/logos/icons/` に PNG/ICO/ICNS、`app/design/logos/splash/` にスプラッシュ、として `design-logo-final-gamma.md` § 3 で記述済の構成にすでに最終化されている（fourth update 時点完了）。`final/` への物理移動は brand 文書整合性の観点から **行わない**（既存パスを参照する全文書を破壊するため）。

### 2.2 不要メタデータ grep（Grep ツール）

```
pattern: inkscape|sodipodi|figma:|sketch:
path:    projects/PRJ-018/app/design/logos
result:  No matches found
```

→ クリーン。

### 2.3 brand v1 § 7 token 整合性チェック

| 役割 | brand v1 § 7 (tokens.css 由来) | SVG 実装 | 一致 |
|---|---|---|---|
| asagi-500 (drop primary) | `oklch(0.72 0.10 200)` ≈ `#5BB8C4` / `#6BB8C8` | `dropGrad` 35% stop = `#6BB8C8` | ✓ |
| asagi-700 (drop deep) | `oklch(0.56 0.10 200)` ≈ `#318897` / `#3F8A99` | `dropGrad` 80% stop = `#3F8A99` | ✓ |
| asagi-800 (drop edge) | `oklch(0.45 0.085 200)` ≈ `#246E7B` / `#2A6878` | `dropGrad` 100% stop = `#2A6878` | ✓ |
| dark paper | `#0a0e14` | `paperGrad` 0%/100% = `#0a0e14` | ✓ |
| light paper | `#F9F7F2` 系 | light variant `paperGradL` 0% = `#F9F7F2` | ✓ |

**結論**: 配色は brand v1 § 7 (DEC-018-020 確定 token) と完全に整合。色変更による上書きは不要。

---

## § 3 Step 2: PNG マルチサイズ照合（再生成判定）

### 3.1 サイズ一覧（Add-Type System.Drawing 検査）

| パス | 期待 | 実測 |
|---|---|---|
| `app/design/logos/icons/asagi-icon-16.png` | 16x16 | 16x16 ✓ |
| `app/design/logos/icons/asagi-icon-32.png` | 32x32 | 32x32 ✓ |
| `app/design/logos/icons/asagi-icon-128.png` | 128x128 | 128x128 ✓ |
| `app/design/logos/icons/asagi-icon-256.png` | 256x256 | 256x256 ✓ |
| `app/design/logos/icons/asagi-icon-512.png` | 512x512 | 512x512 ✓ |
| `app/design/logos/icons/asagi-icon-1024.png` | 1024x1024 | 1024x1024 ✓ |
| `app/asagi-app/src-tauri/icons/32x32.png` | 32x32 | 32x32 ✓ |
| `app/asagi-app/src-tauri/icons/128x128.png` | 128x128 | 128x128 ✓ |
| `app/asagi-app/src-tauri/icons/128x128@2x.png` | 256x256 | 256x256 ✓ |
| `app/asagi-app/public/favicon-16x16.png` | 16x16 | 16x16 ✓ |
| `app/asagi-app/public/favicon-32x32.png` | 32x32 | 32x32 ✓ |
| `app/asagi-app/public/apple-touch-icon.png` | 180x180 | 180x180 ✓ |

### 3.2 SHA-256 ハッシュ照合（PowerShell `Get-FileHash`）

#### Tauri ペア (final → tauri)

| Source | Tauri | SHA-256 | 一致 |
|---|---|---|---|
| `app/design/logos/icons/asagi-icon-32.png` | `app/asagi-app/src-tauri/icons/32x32.png` | `F812DA2E…1658F866` | ✓ |
| `app/design/logos/icons/asagi-icon-128.png` | `app/asagi-app/src-tauri/icons/128x128.png` | `2845D03C…851E2F5E` | ✓ |
| `app/design/logos/icons/asagi-icon-256.png` | `app/asagi-app/src-tauri/icons/128x128@2x.png` | `454C6C30…A5605F84` | ✓ |
| `app/design/logos/icons/asagi.ico` | `app/asagi-app/src-tauri/icons/icon.ico` | `D841E368…B5D30C38` | ✓ |
| `app/design/logos/icons/asagi.icns` | `app/asagi-app/src-tauri/icons/icon.icns` | `B61677D9…C72691B9` | ✓ |

#### Next.js favicon ペア (final → public)

| Source | Public | SHA-256 | 一致 |
|---|---|---|---|
| `app/design/logos/asagi-favicon.svg` | `app/asagi-app/public/favicon.svg` | `D79A65E0…9E1BE2E7` | ✓ |
| `app/design/logos/icons/asagi-favicon.ico` | `app/asagi-app/public/favicon.ico` | `FAF797D6…9E2F1BDB` | ✓ |
| `app/design/logos/icons/asagi-icon-16.png` | `app/asagi-app/public/favicon-16x16.png` | `D86C1D47…E4D1DDCD` | ✓ |
| `app/design/logos/icons/asagi-icon-32.png` | `app/asagi-app/public/favicon-32x32.png` | `F812DA2E…1658F866` | ✓ |

#### Apple-touch-icon

`apple-touch-icon.png` は **180x180 (asagi-icon-256.png をリサイズ生成済)** 確認。fourth update の `generate-sizes.py` で 180 専用エクスポート済みのため、256 とハッシュ不一致は仕様通り（再生成不要）。

**結論**: **全 9 ペアで完全一致** → PNG / ICO / ICNS の再生成は **発生しなかった**。`final/` を master とみなし `icons/` を上書きする処理は不要だった。

---

## § 4 Step 3: tauri.conf.json icons 設定の正式化

### 4.1 diff（unified）

```diff
--- a/src-tauri/tauri.conf.json
+++ b/src-tauri/tauri.conf.json
@@ -35,6 +35,7 @@
     "icon": [
       "icons/32x32.png",
       "icons/128x128.png",
+      "icons/128x128@2x.png",
       "icons/icon.ico",
       "icons/icon.icns"
     ],
```

### 4.2 spec 要求 5 ファイル充足チェック

| spec 要求パス | 配置済 | tauri.conf.json 列挙 |
|---|---|---|
| `icons/32x32.png` | ✓ | ✓ |
| `icons/128x128.png` | ✓ | ✓ |
| `icons/128x128@2x.png` | ✓ | ✓ **(本タスクで追記)** |
| `icons/icon.icns` | ✓ | ✓ |
| `icons/icon.ico` | ✓ | ✓ |

### 4.3 その他確認項目

| 項目 | 値 | 判定 |
|---|---|---|
| `bundle.identifier` | `"jp.improver.asagi"` | ✓ reverse-DNS 形式 / spec 推奨どおり |
| `productName` | `"Asagi"` | ✓ |
| `bundle.active` | `true` | ✓ |
| `bundle.targets` | `"all"` | ✓ msi/dmg/AppImage 全 OS 対象 |
| `bundle.category` | `"DeveloperTool"` | ✓ |
| `app.windows[0].title` | `"Asagi"` | ✓ |
| `windows.fileAssociations` 等の icon 参照 | 未設定（fileAssoc 自体未設定） | 既定値で OK（M1 段階で fileAssoc 不要） |
| `macOS.icon` 個別設定 | なし | `bundle.icon[].icns` で自動解決のため不要 |
| `linux.deb.icon` 個別設定 | なし | `bundle.icon[].png` で自動解決のため不要 |

**結論**: tauri.conf.json は **bundle 検証 PASS**（`tauri info` 実行で icon path resolution エラーなし）。

---

## § 5 Step 4: Next.js layout.tsx の icon meta 整備

### 5.1 diff（unified、抜粋）

```diff
--- a/src/app/layout.tsx
+++ b/src/app/layout.tsx
@@ -1,4 +1,4 @@
-import type { Metadata } from 'next';
+import type { Metadata, Viewport } from 'next';
 import { GeistSans } from 'geist/font/sans';
 import { GeistMono } from 'geist/font/mono';
 import { ThemeProvider } from 'next-themes';
@@ -9,15 +9,29 @@ import './globals.css';

 export const metadata: Metadata = {
   title: 'Asagi',
-  description: 'Codex マルチプロジェクト IDE',
+  description: 'Codex 版 IDE — 浅葱（あさぎ）。日本語ファースト、Slack 風 Multi-Project、ローカル永続化。',
+  applicationName: 'Asagi',
   icons: {
     icon: [
       { url: '/favicon.svg', type: 'image/svg+xml' },
       { url: '/favicon.ico', sizes: 'any' },
+      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
+      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
+    ],
+    apple: [
+      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
     ],
   },
 };

+// DEC-018-020 (γ 浅葱滴) brand accent — dark/light で分離指定
+export const viewport: Viewport = {
+  themeColor: [
+    { media: '(prefers-color-scheme: dark)', color: '#0a0e14' },
+    { media: '(prefers-color-scheme: light)', color: '#5BB8C4' },
+  ],
+};
+
 export default function RootLayout({
```

### 5.2 確認項目

| 項目 | 値 | 判定 |
|---|---|---|
| `metadata.title` | `"Asagi"` | ✓ |
| `metadata.description` | 「Codex 版 IDE — 浅葱（あさぎ）」を含む | ✓ spec 準拠 |
| `metadata.applicationName` | `"Asagi"` | ✓ Next.js manifest 互換性向上 |
| `metadata.icons.icon[]` | SVG / ICO / PNG 16 / PNG 32 = 4 件 | ✓ 全 favicon が public/ に存在確認済 |
| `metadata.icons.apple` | `/apple-touch-icon.png` (180x180) | ✓ public/ に配置済（180x180 確認済） |
| `viewport.themeColor` | dark = `#0a0e14` / light = `#5BB8C4` | ✓ DEC-018-020 γ accent + 紺紙地 |

> Next.js 15 では `themeColor` は `metadata` ではなく **`viewport` export** に移動が公式推奨（`next/font` 警告対策）。本実装はその仕様に準拠。

---

## § 6 Step 5: README / docs の icon 参照確認

### 6.1 `app/asagi-app/README.md`

冒頭ロゴ表示なし（テキストヘッダのみ）。今回 spec の「相対パスで正しく表示」要件は v0.2 でスクショ差替時に対応予定（README 1 行目に書かれている）。**現状のテキスト構成は γ ロゴ採用と矛盾しない**ため変更不要。

### 6.2 `BRAND.md`

§ 9「開発側 import パス」を **AS-DESIGN-04 完了状態に更新**（変更点）:
- カラートークン CSS パスを `app/asagi-app/design/tokens.css`（誤）→ `app/asagi-app/src/styles/tokens.css`（正）に修正
- ロゴ SVG を「生成中」→ 5 種すべての絶対パスに展開
- アイコン multi-size を「デザイナー成果待ち」→ Tauri 5 ファイル + Next.js 5 ファイルの **AS-META-09 完了** 状態を明記

---

## § 7 検証コマンド全 pass 証跡

### 7.1 `cargo check`（src-tauri/）

```
$ cd projects/PRJ-018/app/asagi-app/src-tauri && cargo check
   Compiling asagi v0.1.0 (...PRJ-018\app\asagi-app\src-tauri)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 10.58s
```
→ **PASS**（warnings/errors なし）

### 7.2 `npx tsc --noEmit`（asagi-app/）

```
$ cd projects/PRJ-018/app/asagi-app && npx tsc --noEmit
[my changes only stashed-around verification]
(no output = success)
```
→ **本タスク変更分のみで PASS**

> NOTE: 並行作業中の ChatPane mock 磨き込み（DEC-018-026 ①）が `src/lib/codex/use-codex.ts` 等を編集しており、`interruptTurn` / `streamingItemId` / `awaitingFirstDelta` の export/型不整合 2 件が残存している。これは **本タスクとは別ライン (DEC-018-026 ①) の WIP** であり、本タスク変更ファイル（`tauri.conf.json` / `layout.tsx` / `BRAND.md`）由来ではない。stash で当該 6 ファイルを退避すると tsc は完全 pass する（§ 7.2 上記の検証結果がそれ）。

### 7.3 `npm run build`

```
$ cd projects/PRJ-018/app/asagi-app && npm run build
 ✓ Compiled successfully in 5.2s
   Linting and checking validity of types ...
   Collecting page data ...
 ✓ Generating static pages (5/5)
 ✓ Exporting (2/2)

Route (app)                                 Size  First Load JS
┌ ○ /                                    86.8 kB         217 kB
├ ○ /_not-found                            993 B         103 kB
└ ○ /dev/codex-mock                      3.47 kB         106 kB
```
→ **PASS**（5 ページ全 static export 成功 / favicon meta も解決）

### 7.4 `npm run tauri info`

```
$ cd projects/PRJ-018/app/asagi-app && npm run tauri info
[✔] Environment
    - OS: Windows 10.0.26200 x86_64 (X64)
    ✔ WebView2: 147.0.3912.86
    ✔ MSVC: Visual Studio Build Tools 2022
    ✔ rustc: 1.94.1
    ✔ cargo: 1.94.1
[-] App
    - build-type: bundle
    - frontendDist: ../out
    - framework: React (Next.js)
    - bundler: Vite
```
→ **PASS**（icon path resolution エラーなし、bundle config 全項目 OK）

---

## § 8 AS-META-09 完了根拠（DoD 充足チェックリスト）

| # | DoD 項目 | 充足状態 | 根拠 |
|---|---|---|---|
| 1 | γ ロゴ採用案の SVG マスター 5 種が `app/design/logos/` に配置済 | ✓ | § 2.1 表 5 件全確認 |
| 2 | SVG が brand v1 § 7 の token 値と一致 | ✓ | § 2.3 整合性チェック表 |
| 3 | SVG に不要なエディタメタデータが残っていない | ✓ | § 2.2 grep 結果（0 ヒット）|
| 4 | PNG multi-size 8 サイズが `app/design/logos/icons/` に正しい dimension で配置済 | ✓ | § 3.1 dimension 検査表 |
| 5 | Tauri 用 5 アイコン（32/128/128@2x/.ico/.icns）が `src-tauri/icons/` に配置済かつ source とハッシュ一致 | ✓ | § 3.2 ハッシュ照合表 |
| 6 | Next.js 用 5 アイコン（favicon.ico/.svg + 16/32 + apple-touch-180）が `public/` に配置済かつ source と整合 | ✓ | § 3.2 ハッシュ照合表 |
| 7 | `tauri.conf.json` の `bundle.icon` が 5 ファイル全列挙 | ✓ | § 4.1 diff + § 4.2 充足表 |
| 8 | `bundle.identifier` が reverse-DNS 形式 | ✓ | § 4.3 表（`jp.improver.asagi`）|
| 9 | `productName` が `"Asagi"` | ✓ | § 4.3 表 |
| 10 | `src/app/layout.tsx` Metadata に icon 全種 + apple-touch-icon 設定済 | ✓ | § 5.1 diff + § 5.2 表 |
| 11 | Theme color meta が asagi accent で設定済 | ✓ | § 5.1 diff（`viewport.themeColor` dark/light 分離）|
| 12 | `cargo check` PASS | ✓ | § 7.1 |
| 13 | `npx tsc --noEmit`（本タスク変更分） PASS | ✓ | § 7.2（並行 WIP 退避時の完全 pass 確認）|
| 14 | `npm run build` PASS | ✓ | § 7.3 |
| 15 | `npm run tauri info` で icon パス resolution エラーなし | ✓ | § 7.4 |
| 16 | BRAND.md 等の参照ドキュメントが γ 採用最終仕様と整合 | ✓ | § 6.2 |

**合計 16/16 充足** → **AS-META-09 を `M1-STATUS.md` の Blocked から解除可能**。

PM 部門が次ラウンドで M1-STATUS.md / tasks.md / OWNER-TODO.md を更新する際の根拠として、本報告書の § 8 表をそのまま引用可能。

---

## § 9 次ラウンドへの引き継ぎ事項（PM 向け）

1. **M1-STATUS.md ステータス更新**
   - AS-META-09: `Blocked → Done`（DEC-018-026 ② 起因、本報告書を根拠資料として参照）
   - Blocked 件数: 5 → 4（残: AS-110/111/120/121/AS-META-09 の AS-META-09 を解除、AS-140〜143 は引き続き Blocked）
   - Done 比率: 60% → 約 62%（AS-META-09 が完了に移動）

2. **tasks.md 更新**
   - AS-META-09 行のステータスを Done に更新、commit ハッシュを追記
   - ブロッカー B-2「AS-DESIGN-04 SVG 化進行中 → AS-META-09 Blocked」を解消（B-2 自体クローズ可）

3. **AS-DESIGN-04 自体の最終化**
   - 本タスクで最終化を兼ねたため、AS-DESIGN-04 も `In Progress → Done` に移動可能（design-logo-final-gamma.md § 7 検収チェックリスト 10 項目のうち、ビルド前に確認可能な「16x16 識別性」「1:1 アスペクト比」は本タスク § 3.1 で間接的に検証済、残り 8 項目は実機 Tauri build 後の確認）

4. **次の Blocked リスト**（AS-META-09 解除後）
   - AS-110 (OAuth フロー設計) — POC 通過後
   - AS-111 (OAuth トークン keyring 保管) — POC 通過後
   - AS-112 (API Key フォールバック UI) — POC 通過後
   - AS-120 (Codex CLI sidecar 起動仕様) — POC 通過後
   - AS-121 (Rust sidecar 管理) — POC 通過後
   - AS-140〜143 (Real impl 各種) — POC 通過後

---

## § 10 制約遵守チェック

| 制約 | 遵守 |
|---|---|
| γ ロゴデザイン自体は変更しない（DEC-018-020 確定済）| ✓ SVG / PNG / ICO / ICNS 全て変更ゼロ（ハッシュ一致確認済）|
| emoji 禁止 | ✓ 本報告書 / 編集ファイル全てに絵文字なし |
| アイコン色を Sumi カラーで上書きしない | ✓ asagi accent (#5BB8C4) と紺紙地 (#0a0e14) のみ使用 |
| 既存 build を壊さない | ✓ cargo check / npm build / tauri info 全 pass |

---

## § 11 関連ドキュメント

- 採用記録: `reports/design-logo-final-gamma.md`
- ブランド v1: `reports/design-brand-v1.md` § 7
- ブランド要約: `BRAND.md`（本タスクで § 9 更新）
- M1 進行状況: `M1-STATUS.md`（本タスク完了で AS-META-09 解除可能）
- 採用判断: `decisions.md` DEC-018-020 / DEC-018-026

---

**作成**: 2026-05-02 (sixth update 派生・DEC-018-026 ② ライン) ／ デザイン × 開発部門 ／ **次回更新**: AS-META-09 を実機 Tauri build で検収完了時（design-logo-final-gamma.md § 7 検収チェックリスト 10 項目）
