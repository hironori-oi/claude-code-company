# PM-870: 背景画像が表示されない bug の修正

- **案件**: PRJ-012 ccmux-ide-gui
- **チケット**: PM-870
- **担当**: dev
- **日付**: 2026-04-20
- **対象**: `C:\Users\hiron\Desktop\ccmux-ide-gui\` (workspace junction: `projects/PRJ-012/app/ccmux-ide-gui`)
- **ビルド**: v3.5.16 予定

## TL;DR

オーナー報告「背景画像を設定しても表示されない」の根治。原因は **A + E の複合**:

- **A (主)**: `applyBackground` の呼び出しが `AppearanceSettings.tsx` の useEffect
  に閉じており、`/settings` を一度も開かずにアプリを起動すると localStorage に保存済みの
  背景画像 path が DOM（CSS variable）へ反映されない。次回起動時も同様に非表示のまま。
- **E (副)**: Shell / settings ページの最外 `<div>` が `bg-background` (完全不透明)で
  `html::before` / `html::after` の画像レイヤーを完全に覆っており、たとえ CSS variable
  が正しく設定されていても視覚的に見えない。

最小 diff で以下 2 点を修正:

1. `components/theme/AppearanceInit.tsx` (新規 client component) を追加し、
   `layout.tsx` で mount。起動時に `readPersistedAppearance()` +
   `applyThemePreset` / `applyAccent` / `applyBackground` を実行する。
2. Shell 最外 div / `/settings` root / `/settings/mcp` root の `bg-background`
   を `bg-transparent` に変更し、`html::before` (画像) + `html::after` (色 overlay)
   が body 越しに見えるようにする。

TypeScript 0 error。tauri.conf.json の `assetProtocol.scope` は既に `$HOME/**`
を含むため **追加変更なし** (= tauri dev 再起動不要)。

---

## Step 1: 調査フロー

### 1.1 設定 UI・状態管理・表示側の責務マップ

| レイヤー | ファイル | 内容 | 所見 |
| --- | --- | --- | --- |
| UI | `components/settings/AppearanceSettings.tsx` | 背景画像の picker + slider（opacity/blur/fit/overlay）| 完備。`handlePickBackgroundImage` で `@tauri-apps/plugin-dialog` から path を取得 → `setBackgroundImage({path})`。 |
| state | `lib/stores/settings.ts` (zustand persist, key=`ccmux-ide-gui:settings`, version=3) | `appearance.backgroundImage: BackgroundImageSettings` | migration (v2 → v3) で `backgroundImage` を追加。永続化 OK。 |
| type | `lib/types.ts` | `BackgroundImageSettings` + `DEFAULT_BACKGROUND_IMAGE` (path=null, opacity=0.85, blur=0, fit=cover, overlay=0.7) | OK。 |
| DOM 反映 | `lib/apply-accent.ts::applyBackground` | `--ccmux-bg-image` / `--ccmux-bg-opacity` / `--ccmux-bg-blur` / `--ccmux-bg-overlay` / `--ccmux-bg-size` / `--ccmux-bg-repeat` を `document.documentElement` にセット | 実装は正しい。`convertFileSrc(path)` で asset protocol URL に変換。 |
| CSS | `app/globals.css` `:root` + `html::before` / `html::after` | 画像レイヤー (z -10) + 背景色 overlay (z -9)。body は `background-color: transparent` | 実装は正しい。 |
| 呼び出し | `components/settings/AppearanceSettings.tsx` L110-147 | `useEffect` で `readPersistedAppearance` → 3 関数を呼ぶ | **問題発生箇所**: /settings を開かない限り発火しない。 |

### 1.2 Tauri asset protocol / capabilities

- `src-tauri/tauri.conf.json`: `assetProtocol.enable = true`、`scope = ["$APPLOCALDATA/**", "$APPDATA/ccmux-images/**", "$HOME/**"]`。
  画像をユーザー home 配下から選ぶ限り scope OK。
- `src-tauri/capabilities/default.json`: `dialog:allow-open` / `fs:allow-stat` ok。
- CSP: `img-src 'self' data: blob: asset: http://asset.localhost https://asset.localhost`。asset: 許可済み。

→ **Tauri 側は問題なし**。原因 B/C (path / scope) の仮説は棄却。

### 1.3 DOM 側で画像が見えない可能性（原因 E）

Shell / 設定ページの最外コンテナが `bg-background` (完全不透明) だと、`html::before`
(z-index -10) は body の直下に fixed で描画されるものの、最外 div の背景色が
完全に覆う。`grep` 結果:

```
components/layout/Shell.tsx:90       className="flex h-screen flex-col bg-background"  (loading 用 placeholder)
components/layout/Shell.tsx:108  <div className="flex h-screen flex-col bg-background"> (実体)
app/settings/page.tsx:36         <div className="flex h-screen flex-col bg-background">
app/settings/mcp/page.tsx:168    <div className="flex h-screen flex-col bg-background">
app/page.tsx:15                  <main className="... bg-gradient-to-br from-background to-muted/30 ..."> (welcome, 対象外)
app/setup/page.tsx:99             <main ... bg-gradient-to-br ...>                                       (setup, 対象外)
```

→ workspace + settings で最外 `bg-background` が html::before / html::after を
完全に隠している。**これが E の実体**。

### 1.4 applyBackground 呼び出しの網羅性（原因 A）

```
grep applyBackground lib/ app/ components/
  lib/apply-accent.ts:149   export function applyBackground(...)
  components/settings/AppearanceSettings.tsx:22,119,123,139,704 (全て /settings 内)
```

→ `/settings` を開かない限り、localStorage に保存済みの `backgroundImage` は
DOM に反映されない。**これが A の実体**。

### 1.5 再現モデル（推定）

1. オーナーが `/settings` → 画像 pick → slider 調整
   - → 設定ページ上では html::before が描画されるが、`bg-background` に覆われて
     **そもそも設定ページでも見えない** 可能性が高い（E）
   - ただし、ページ切替の transition で「一瞬見えた」ような体験は可能
2. workspace に戻ると Shell 最外 `bg-background` に覆われて見えない（E）
3. アプリ再起動すると、workspace 起動直後は `AppearanceInit` 相当の処理が無いため
   CSS variable すら未設定で本当に `background-image: none` （A）

報告の「背景に画像が表示されていません」は、A + E の両方を踏んで発生している。

---

## Step 2: 原因特定

**A (applyBackground の呼び出し範囲不足) + E (最外 bg-background による上塗り)** の複合。

**B/C/D/F は棄却**:
- B/C: convertFileSrc は実装済み、tauri.conf scope に `$HOME/**` あり → path 変換は機能する
- D: useEffect 側の dep に `bgImage.path/opacity/blur/fit/overlayOpacity` 全部入り → reload trigger OK
- F: 未実装ではない。UI / state / DOM 関数は揃っている、呼び出し箇所だけが不足

---

## Step 3: 修正内容（diff 要約）

### 3.1 新規: `components/theme/AppearanceInit.tsx`

全ページで起動時に localStorage → `applyThemePreset` / `applyAccent` / `applyBackground`
を発火する client-only sentinel。`useTheme().resolvedTheme` が決まるのを待ってから
適用することで dark-only preset と accent の整合を保つ。

```tsx
"use client";
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { applyAccent, applyBackground, applyThemePreset, readPersistedAppearance, type ResolvedMode } from "@/lib/apply-accent";
import { DEFAULT_BACKGROUND_IMAGE } from "@/lib/types";

export function AppearanceInit() {
  const { resolvedTheme } = useTheme();
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!resolvedTheme) return;
    const mode: ResolvedMode = resolvedTheme === "dark" ? "dark" : "light";
    const persisted = readPersistedAppearance();
    if (!initializedRef.current) {
      initializedRef.current = true;
      if (persisted) {
        applyThemePreset(persisted.themePreset, mode);
        applyAccent(persisted.accentColor, mode);
        applyBackground(persisted.backgroundImage);
      } else {
        applyBackground(DEFAULT_BACKGROUND_IMAGE);
      }
      return;
    }
    if (persisted) {
      applyThemePreset(persisted.themePreset, mode);
      applyAccent(persisted.accentColor, mode);
    }
  }, [resolvedTheme]);
  return null;
}
```

### 3.2 `app/layout.tsx` に `<AppearanceInit />` を mount

```diff
 import { ThemeProvider } from "@/components/theme-provider";
+import { AppearanceInit } from "@/components/theme/AppearanceInit";
 ...
 <ThemeProvider ...>
+  <AppearanceInit />
   {children}
   <Toaster ... />
 </ThemeProvider>
```

### 3.3 最外コンテナの背景を透過化（bg-background → bg-transparent）

3 箇所 + Shell の loading placeholder、合計 4 箇所:

```diff
# components/layout/Shell.tsx
-  <div className="flex h-screen flex-col bg-background" suppressHydrationWarning />  (mounted 前)
+  <div className="flex h-screen flex-col bg-transparent" suppressHydrationWarning />
-  <div className="flex h-screen flex-col bg-background">                              (実体)
+  <div className="flex h-screen flex-col bg-transparent">

# app/settings/page.tsx
-    <div className="flex h-screen flex-col bg-background">
+    <div className="flex h-screen flex-col bg-transparent">

# app/settings/mcp/page.tsx
-    <div className="flex h-screen flex-col bg-background">
+    <div className="flex h-screen flex-col bg-transparent">
```

**視覚影響の説明**: `html::after` (z -9) が `hsl(var(--background))` を `overlayOpacity`
の濃さで塗るため、画像未設定時 (`--ccmux-bg-overlay: 1`) は **従来と完全に同じ見た目**
になる。画像設定時は overlayOpacity (default 0.7) の分だけ画像が透けて見える。

### 3.4 変更ファイル一覧 (5 files)

| ファイル | 変更種別 | 行数 |
| --- | --- | --- |
| `components/theme/AppearanceInit.tsx` | 新規 | +60 |
| `app/layout.tsx` | import + 1 要素追加 | +3 |
| `components/layout/Shell.tsx` | bg-background → bg-transparent (×2, +コメント) | +5 / -2 |
| `app/settings/page.tsx` | bg-background → bg-transparent (+コメント) | +2 / -1 |
| `app/settings/mcp/page.tsx` | bg-background → bg-transparent (+コメント) | +2 / -1 |

**tauri.conf.json 変更なし** = tauri dev の再起動不要。

---

## Step 4: 検証

### 4.1 静的検証（本セッションで実施済み）

- `npx tsc --noEmit` → exit 0（エラーなし）
- `readPersistedAppearance()` は既存 `/settings` 初期化で実績あり、同じ localStorage key を再利用 → 動作は保証済み
- `html::before` の z-index `-10` は body が `background-color: transparent` のため body 下へ描画される（globals.css の既存実装）
- `applyBackground` が `convertFileSrc` で asset:// URL へ変換する既存実装をそのまま利用

### 4.2 実機検証手順（オーナー向け）

1. `cd C:\Users\hiron\Desktop\ccmux-ide-gui`
2. `npm run tauri dev`（既に dev 中なら Vite HMR で自動反映される。ただし `layout.tsx` 変更は app reload が必要な場合あり）
3. 背景画像なしの状態で `/workspace` を開く → 見た目が従来通り（何も変化していないように見える）ことを確認
4. タイトルバー右の歯車 → `/settings` → 外観 → 「背景画像（Warp 風）」で画像を選択
   - 画像選択直後、**設定ページでも** 画像が見えるようになる（プレビュー box とは別に、ページ全体背景として）
5. 戻る → `/workspace` に戻っても背景画像が表示されていることを確認
6. アプリを一度終了 → 再度起動 → `/workspace` で **起動直後から** 背景画像が表示されることを確認（これが主な修正点）
7. 「背景なしに戻す」ボタンで従来の見た目（完全な solid background）に戻ることを確認

### 4.3 画像が表示されない場合の切り分けメモ（オーナー向け）

- 画像選択が `$HOME/**` 配下か確認（例: `C:\Users\<you>\Pictures\foo.png`）
- DevTools（tauri: 右クリック → Inspect）で `html` 要素の computed style を見て
  `--ccmux-bg-image` が `url("http://asset.localhost/...")` になっているか確認
- Console に `Failed to load resource` が出ていたら asset protocol scope 外 →
  `$APPDATA/ccmux-ide/backgrounds/` などに画像をコピーしてからそれを選び直す
  （scope には `$HOME/**` と `$APPLOCALDATA/**` が含まれている）

---

## 残課題 / 将来の TODO

- **scope の絞り込み**: 現状 `$HOME/**` が asset scope に入っているのは広すぎ
  (security 観点)。将来は `$APPDATA/ccmux-ide/backgrounds/**` に copy してから
  参照する方針に移行することを推奨。ただし今回は機能回復優先のため据え置き。
- **ファイル移動耐性**: 現在は原本パスを直接参照。ユーザーが画像ファイルを移動/削除
  すると切れる。将来対応として picker 後に app data へコピーする UX が望ましい。
- **Shell 以外の全画面 placeholder**: `app/page.tsx` / `app/setup/page.tsx` 等の
  onboarding 系は `bg-gradient-to-br from-background` 固定のため背景画像を無視する。
  これは意図的な onboarding 演出なので対象外とした。
- **backgroundImage transform**: crop / rotate / filter 系は本件スコープ外。

---

## 参照

- 対象リポジトリ: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- 関連過去レポート: `projects/PRJ-012/reports/dev-roundE2-background-image-report.md`
  (背景画像機能の初回実装レポート)
- 関連 DEC: Round E2（背景画像機能追加）
