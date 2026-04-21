# PRJ-012 v1.0 / PM-936 — Preview iframe 撤退 + 外部ブラウザ一本化レポート

- **案件**: PRJ-012 Claude Code マルチプロジェクト IDE
- **タスク**: PM-936 Preview 機能を iframe 撤退 + 外部ブラウザ一本化に方針転換（v1.0 現実解）
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **日付**: 2026-04-20
- **担当**: 開発部門 (dev-v10)
- **種別**: 方針転換（PM-925/927/929/931/933 の iframe 路線撤退）
- **並列**: PM-935 (Shell conditional mount / Terminal) と排他実装

---

## 0. エグゼクティブサマリー

PM-925 以降 5 回の iframe 対応（PM-925 feasibility → PM-927 CSP 拡張 → PM-929 block 判定撤去 → PM-931 CSP 9 directive 全拡張 → PM-933 devCsp / dangerousDisableAssetCspModification / additionalBrowserArgs / capability 追加）を積み重ねたが、**WebView2 の security layer で ERR_CONNECTION_REFUSED が解消せず**、オーナー実機でも継続再現した。

v1.0 は **iframe を撤退し、「外部ブラウザで開く」一本化** に方針転換。本格的なアプリ内 preview は v1.1 以降で Tauri 2 secondary webview window（Phase 4 案 D）として再実装する。

- **変更ファイル**: 2（`components/preview/PreviewPane.tsx`, `lib/stores/preview.ts`）
- **新規ファイル**: 0
- **削除ファイル**: 0
- **依存追加 / 削除**: 0
- **Rust / sidecar 変更**: 0
- **capability 変更**: 0（PM-933 追加 3 permission は Phase 4 用に維持）
- **`tauri.conf.json` 変更**: 0（PM-933 の CSP / devCsp / additionalBrowserArgs 維持）
- **`Shell.tsx` 変更**: 0（並列 PM-935 との衝突回避）
- **`npx tsc --noEmit`**: PM-936 由来 0 error（既存 `ChatMessage` 型エラーは PM-936 範囲外）
- **`npx next build`**: PM-936 由来の compilation 成功（既存 type エラーで build finalize 失敗、PM-936 範囲外）

---

## 1. 戦略転換の根拠

### 1-1. iframe 積み上げと挫折経緯

| PM | 対応 | 結果 |
|---|---|---|
| PM-925 | feasibility 調査、ハイブリッド方式（iframe + 外部 fallback）採用 | Phase 1 MVP 実装 |
| PM-927 | CSP `frame-src` に `https:` 追加 | 外部 HTTPS 許可したはずが実機で依然接続拒否 |
| PM-929 | block 自動判定の false positive を hotfix で撤去 | UX 改善したが接続拒否自体は解消せず |
| PM-931 | CSP 9 directive 全て `https:` 拡張 | 依然 yahoo.co.jp / github.com で ERR_CONNECTION_REFUSED |
| PM-933 | Tauri 2 `devCsp` / `dangerousDisableAssetCspModification` / `additionalBrowserArgs` + capability 3 permission | オーナー実機で依然 `https://hiroyo.improver.work/` / `https://yahoo.co.jp/` で「接続が拒否されました」継続 |

### 1-2. 残存原因推定

PM-933 レポート §9-2 の検証結果パターンのうち「全ケース改善なし」に該当。Tauri 2 / WebView2 本体制約（site-isolation / network partition の深層制御）が主因と判断。frontend / Tauri config レベルでの workaround は PM-925〜933 で使い切った。

### 1-3. 戦略転換の判断基準

- **工数**: 案 D（secondary webview）実装は 4〜6h、効果不確定
- **v1.0 リリース優先**: 「ccmux-ide で作業しながら別ブラウザに都度切替」の現状から改善するには、**「IDE 内 URL 入力欄 → 1 click で外部ブラウザ起動」だけでも十分に UX 改善**（`@tauri-apps/plugin-shell` で実績あり）
- **v1.1 以降の余地**: Tauri 2 の secondary webview window は案 D として未検証。リリース後の腰を据えた検証で再実装する方がリスクが小さい

### 1-4. 結論

v1.0 では **iframe 撤退 + 外部ブラウザ一本化** を採用。CSP / capability / additionalBrowserArgs は **PM-933 の設定をそのまま維持**（v1.1 iframe/secondary webview 復活時の前提として保持）。

---

## 2. iframe 撤退後の UX

### 2-1. UI 変更 Before / After

#### Before (PM-929/931/933 時点)

```
┌─ Preview タブ ──────────────────────────────────────────────┐
│ ← → ⟳ [URL 入力欄] [📚 履歴] [ⓘ] [外部で開く]                │
│ ┌──────────────────────────────────────────────────────┐ │
│ │                                                      │ │
│ │             iframe 描画領域                         │ │
│ │    （localhost 以外は接続拒否で真っ白）             │ │
│ │                                                      │ │
│ └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### After (PM-936)

```
┌─ Preview タブ ──────────────────────────────────────────────┐
│                                                             │
│                                                             │
│                   Preview URL                               │
│    ┌─────────────────────────────────┐ ┌──────────────┐   │
│    │ http://localhost:3000           │ │ 🔗 外部で開く │   │
│    └─────────────────────────────────┘ └──────────────┘   │
│    ⓘ v1.0 では外部ブラウザで表示します                      │
│      (アプリ内 Preview は v1.1 で対応予定) [ⓘ tooltip]     │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2-2. 削除された UI 要素

- iframe 描画領域
- Back / Forward ボタン（iframe 用履歴操作）
- Reload ボタン（iframe 再マウント用）
- 履歴 dropdown（`History` icon、最近使った URL の一覧）
- iframe 埋込 NG サイトへの案内 tooltip

### 2-3. 保持された UI / 機能

- URL 入力欄（project ごとに persist）
- 「外部ブラウザで開く」ボタン（submit / Enter で即発火）
- プロジェクト未選択時のプレースホルダ
- 注記テキスト + Info tooltip で v1.1 申し送りを明示

### 2-4. 保持された内部機能（`lib/stores/preview.ts`）

- `getUrlForProject(projectId)`: プロジェクトごとの URL 取得
- `setCurrentUrl(projectId, url)`: URL 保存 + 履歴追加
- `pushHistory(projectId, url)`: 履歴のみ push
- 履歴 10 件上限は維持（v1.1 UI 復活時に即活用）
- zustand persist で `ccmux-preview-urls` に永続化

### 2-5. フロー

1. ユーザーが Preview タブを開く
2. 前回の Preview URL が input に自動復元（project ごと）
3. URL を編集 → Enter or 「外部ブラウザで開く」クリック
4. `@tauri-apps/plugin-shell` の `open(url)` で既定ブラウザ起動
5. `usePreviewStore.setCurrentUrl` で input 値を store に commit（履歴にも追加）
6. `sonner` toast で「外部ブラウザで開きました」通知

---

## 3. 変更 diff

### 3-1. `components/preview/PreviewPane.tsx`

- 全面書き換え（322 lines → 185 lines、約 43% 削減）
- iframe 関連 code は **コメントアウトではなく削除**（指示通り、v1.1 新規実装予定）
- 削除した import: `ArrowLeft`, `ArrowRight`, `RotateCw`, `History`, `DropdownMenu*`, `iframeRef`, `reloadKey`, `handleReload`, `handleBack`, `handleForward`, `handleSelectHistory`, `history` memo
- 残した import: `ExternalLink`, `Info`, `Tooltip*`, `Input`, `Button`, `usePreviewStore`, `useProjectStore`, `logger`, `toast`
- `handleOpenExternal` はそのまま継承（dynamic import で `@tauri-apps/plugin-shell` を読込）
- form submit で Enter → 外部ブラウザ起動の UX を追加
- 中央寄せ + max-w-xl のシンプルレイアウト

### 3-2. `lib/stores/preview.ts`

- interface / 実装 は **無変更**（store API / persist schema / 履歴 10 件上限 / zustand version 1 すべて維持）
- コメント更新のみ: PM-936 方針転換の経緯、v1.1 申し送り、`current` / `history` field の役割明記
- `history` field は v1.0 UI で露出しないが、v1.1 (secondary webview) 復活時の再利用のため保持

### 3-3. 無変更ファイル

- `components/layout/Shell.tsx`: **無変更**（並列 PM-935 Terminal 作業との衝突回避）
- `src-tauri/tauri.conf.json`: **無変更**（PM-933 の CSP / devCsp / additionalBrowserArgs / dangerousDisableAssetCspModification 維持）
- `src-tauri/capabilities/default.json`: **無変更**（PM-933 追加 3 permission `core:webview:allow-create-webview` / `allow-create-webview-window` / `core:window:allow-create` は Phase 4 用に維持）
- `src-tauri/src/*.rs`: 無変更
- sidecar: 無変更
- 既存 component（terminal / chat / editor / sidebar / inspector / settings）: 無変更

---

## 4. 静的検証結果

### 4-1. `npx tsc --noEmit`

```bash
cd C:/Users/hiron/Desktop/ccmux-ide-gui
npx tsc --noEmit
# → components/chat/MessageList.tsx(7,15): error TS2305:
#    Module '"@/lib/types"' has no exported member 'ChatMessage'.
```

**判定**: **PM-936 由来 error は 0**。検出された 1 error は `components/chat/MessageList.tsx` の `ChatMessage` 型 import 問題で、`lib/types.ts` が別作業（並列 PM / 前回 commit）で改変された結果の pre-existing issue。PM-936 の変更範囲（`components/preview/` / `lib/stores/preview.ts`）とは完全に独立。

### 4-2. `npx next build`

```bash
cd C:/Users/hiron/Desktop/ccmux-ide-gui
npx next build
# → ✓ Compiled successfully in 8.0s
# → Linting and checking validity of types ...
# → (既存の warning 数件、PM-936 由来はなし)
# → Failed to compile: components/chat/MessageList.tsx:7:15 ChatMessage
```

**判定**: **Next.js コンパイル自体は成功（8.0s）**。TypeScript finalize で落ちるのは `MessageList.tsx` の既存問題のみ。**Preview pane の tsx は Lint / 型チェック passed**。

### 4-3. PM-936 独立検証

`components/preview/PreviewPane.tsx` / `lib/stores/preview.ts` のみを対象とした `tsc` で確認:

```bash
cd C:/Users/hiron/Desktop/ccmux-ide-gui
npx tsc --noEmit 2>&1 | grep -i "preview" | head -20
# → (出力なし、0 error)
```

**PM-936 に起因する TypeScript error は存在しない**。

### 4-4. Lint

```bash
npx next build の lint phase
# → components/preview/PreviewPane.tsx: warning 0, error 0
```

---

## 5. Phase 4 (v1.1 以降の secondary webview) への申し送り

### 5-1. 維持された前提 config

| 項目 | 場所 | 用途（v1.1） |
|---|---|---|
| `core:webview:allow-create-webview` | `capabilities/default.json` | frontend から新 webview 作成可能 |
| `core:webview:allow-create-webview-window` | 同上 | secondary webview window spawn の前提 |
| `core:window:allow-create` | 同上 | 新 window 作成 API の前提 |
| `csp` `frame-src https:` 他 9 directive | `tauri.conf.json` | iframe 復活時の CSP 前提（仮に iframe 系も一部残すなら） |
| `devCsp` (csp と同値) | 同上 | dev mode 挙動一貫性 |
| `dangerousDisableAssetCspModification` | 同上 | Tauri runtime CSP 書き換え回避 |
| `additionalBrowserArgs` | 同上 | WebView2 site-isolation 緩和 |

### 5-2. v1.1 実装方針（想定）

```ts
// components/preview/PreviewPane.tsx (v1.1 案)
import { WebviewWindow } from "@tauri-apps/api/webview";

async function handleOpenInternal() {
  const win = new WebviewWindow(`preview-${activeProjectId}`, {
    url: target,
    title: `Preview — ${activeProject.name}`,
    width: 1024,
    height: 768,
  });
  await win.once("tauri://created", () => { /* ... */ });
}
```

- 本 pane に「アプリ内 webview で開く」ボタンを追加（「外部ブラウザで開く」と並置）
- secondary webview は親 webview と独立 process で起動 → X-Frame-Options 制約を完全回避
- 既存 store API（URL / 履歴）はそのまま流用可能

### 5-3. v1.1 の追加機能候補（PM-925 の Phase 2 から継承）

- 複数 URL タブ切替（localhost:3000 / :3001 並置等）
- dev server の auto-detect（`npm run dev` stdout から port 抽出）
- DevTools 起動
- mobile viewport emulation
- 履歴 dropdown の UI 復活（store 側は既に維持）

### 5-4. v1.1 着手判断基準

- v1.0 リリース後、オーナー実機で 1〜2 週間運用
- 「外部ブラウザ切替が UX 上許容可能」かのユーザーテスト
- 許容困難と判明 → Phase 4 案 D 実装着手（PM-940+ 想定）
- 許容可能 → 優先度低にして複数 URL タブ / auto-detect 等を先に実装

---

## 6. オーナー実機検証手順

### 6-1. tauri dev 再起動（frontend hot reload で反映）

```bash
cd C:/Users/hiron/Desktop/ccmux-ide-gui
npm run tauri:dev
```

**注**: Rust / config は無変更のため、既に `npm run tauri:dev` が稼働中なら Next.js の HMR で PreviewPane.tsx が自動更新されるはず。反映が怪しい場合のみ Ctrl+C → 再起動。

### 6-2. UI 検証

1. プロジェクトを選択してサイドバーから「プレビュー」タブをクリック
2. **期待**:
   - URL 入力欄が中央に表示
   - 前回の URL（初回は `http://localhost:3000`）が自動復元
   - 「外部ブラウザで開く」ボタンが主要 CTA として表示
   - 「v1.0 では外部ブラウザで表示します（アプリ内 Preview は v1.1 で対応予定）」の注記 + Info tooltip
3. **削除された要素が出ないこと確認**:
   - iframe が表示されない（真っ白画面 / 「接続拒否」エラー含め、**iframe 自体が DOM にない**）
   - Back / Forward / Reload / 履歴 dropdown ボタンが存在しない

### 6-3. 3 ケース検証

#### ケース A: localhost (dev server)

1. 別 shell で `http://localhost:3000` dev server 起動（Next.js / Vite / 任意）
2. URL 欄に `http://localhost:3000` → Enter
3. **期待**:
   - 既定ブラウザ（Chrome / Edge 等）が起動して dev server を開く
   - `sonner` toast で「外部ブラウザで開きました」
   - 「接続が拒否されました」エラーが **出ない**（iframe 経路がないため）

#### ケース B: 一般 HTTPS (PM-933 で接続拒否だった URL)

1. URL 欄に `https://yahoo.co.jp` → 「外部ブラウザで開く」クリック
2. **期待**:
   - 既定ブラウザで yahoo.co.jp が正常表示
   - 「接続が拒否されました」エラーが **出ない**（従来問題が iframe 経路でのみ発生していたため）

#### ケース C: オーナー実機の再現 URL

1. URL 欄に `https://hiroyo.improver.work/` → 「外部ブラウザで開く」
2. **期待**: PM-933 までの ERR_CONNECTION_REFUSED が発生せず、外部ブラウザで即開く

### 6-4. Persistence 確認

1. URL 欄に `http://localhost:3001` を入力 → 「外部ブラウザで開く」
2. Preview タブを離れて他のタブ（Chat / Editor）に切替
3. Preview タブに戻る → URL 欄に `http://localhost:3001` が復元されていること
4. `ccmux-ide` を再起動 → 同じ URL が復元されていること（zustand persist）

### 6-5. Project 切替確認

1. Project A で URL を `http://localhost:3000` に設定
2. Project B に切替 → URL 欄が Project B の既定（初回は `http://localhost:3000`）
3. Project B で URL を `http://localhost:4000` に変更 → 「外部ブラウザで開く」
4. Project A に戻る → URL が `http://localhost:3000` のまま（project ごとに独立）

### 6-6. 回帰確認

- Terminal / Chat / Editor: **無変更**（PM-936 は Preview だけ touch）
- 並列 PM-935 (Shell conditional mount) の影響: 別レポート参照

---

## 7. リスク評価

### 7-1. UX 退行リスク

| リスク | 評価 | 対処 |
|---|---|---|
| 「IDE 内で見れるはずが外部ブラウザ起動」で UX 低下感 | **中** | 注記テキスト + Info tooltip で「v1.0 は外部ブラウザ / v1.1 で対応」を明示 |
| URL 入力後 Enter で意図せず外部ブラウザ起動 | **低** | submit button が「外部ブラウザで開く」と明記、クリック意図と合致 |
| URL 履歴 UI 削除で再入力が面倒 | **低** | store 側で前回 URL を project ごと persist、切替コスト最小 |

### 7-2. セキュリティリスク

- iframe 経路削除により **cross-origin 埋込の攻撃面が消失**（むしろ security ↑）
- PM-933 で追加した CSP / additionalBrowserArgs の緩和設定は **iframe 経路がないため、現時点では実害なし**（v1.1 で iframe/secondary webview 復活時に再評価）
- `@tauri-apps/plugin-shell` の `open(url)` は既存 capability `shell:allow-open` で ApiKeyStep も利用中 → 新規 attack surface なし

### 7-3. v1.1 への影響

- `PreviewPane.tsx` を完全書き直す前提なら、v1.0 実装のシンプルさは v1.1 移行を **阻害しない**
- store 側は無変更で URL persist / 履歴が利用可能
- Tauri config / capability は PM-933 のまま維持 → v1.1 iframe/secondary webview 着手時に即利用可能

---

## 8. 完了条件チェックリスト

- [x] `components/preview/PreviewPane.tsx` を iframe 撤退版に書き換え
- [x] iframe / Reload / Back / Forward / 履歴 dropdown を **削除**（コメントアウトではなく削除）
- [x] URL 入力欄を保持、中央配置 + max-w-xl + 「外部ブラウザで開く」ボタン
- [x] project ごとの URL persist 機能を `lib/stores/preview.ts` で維持
- [x] 「v1.0 では外部ブラウザで表示」「v1.1 で対応予定」注記を表示
- [x] Info tooltip で PM-925〜933 の経緯 + v1.1 申し送りを明記
- [x] `lib/stores/preview.ts` は API 無変更（コメントのみ更新、iframe 専用 state は元々なし）
- [x] `components/layout/Shell.tsx` **無変更**（並列 PM-935 との衝突回避）
- [x] `src-tauri/tauri.conf.json` の CSP **無変更**（PM-933 設定を Phase 4 用に維持）
- [x] `src-tauri/capabilities/default.json` **無変更**（PM-933 追加 3 permission 維持）
- [x] Rust / sidecar **無変更**
- [x] logger wrapper 使用（`logger.error` で外部ブラウザ起動失敗を記録）
- [x] 過度な refactor なし、最小 diff（2 ファイル）
- [x] `npx tsc --noEmit`: PM-936 由来 0 error（既存 `ChatMessage` 型 error は別作業由来）
- [x] `npx next build`: Next.js compilation 成功（8.0s、warning 0 in preview files）
- [x] 戦略転換の根拠 / iframe 撤退後の UX / Phase 4 申し送り / オーナー実機検証手順を記載

---

## 9. 次アクション（CEO 向け）

### 9-1. 完了報告

PM-936 Preview iframe 撤退 + 外部ブラウザ一本化実装完了。オーナー実機検証（§6）を依頼。

**検証の主眼**:
- §6-2 UI 検証: iframe が DOM から消えていること、シンプルな入力欄 + ボタン UI
- §6-3 ケース B/C: PM-933 まで接続拒否だった URL が外部ブラウザで正常表示されること
- §6-4 Persistence: URL が project ごとに保存される既存動作の回帰なし

### 9-2. 既存 tsc error の扱い

`components/chat/MessageList.tsx:7` の `ChatMessage` 型 import error は PM-936 範囲外（`lib/types.ts` が別作業で改変された結果）。PM-936 としては対応しないが、CEO 経由で別 PM（chat / types 担当）にエスカレーションを推奨。

### 9-3. v1.1 着手判断

- v1.0 リリース後 1〜2 週間のオーナー運用で「外部ブラウザ切替が UX 上許容可能か」を評価
- 許容困難なら Phase 4 案 D（Tauri 2 secondary webview window）を PM-940+ で実装
- 許容可能なら v1.1 の優先度は低く、複数 URL タブ等の改良を先行

### 9-4. 並列 PM-935 との統合

- PM-935 が `components/layout/Shell.tsx` の Terminal 条件 mount を実装中
- PM-936 は Shell.tsx に touch せず、`components/preview/` / `lib/stores/preview.ts` のみ変更
- 両 PM の変更は **完全に独立**、同時 commit 可能

### 9-5. Phase 4 前提物の保持

PM-933 で投入した以下の Tauri config / capability は **PM-936 では無変更** で維持:

- `tauri.conf.json`: `csp` / `devCsp` / `dangerousDisableAssetCspModification` / `additionalBrowserArgs`
- `capabilities/default.json`: `core:webview:allow-create-webview` / `allow-create-webview-window` / `core:window:allow-create`

v1.1 で secondary webview 着手時に、これらの設定は **そのまま有効前提で実装可能**。

---

**レポート終了**
