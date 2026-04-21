# PRJ-012 v1.0 / PM-929 — Preview 外部 URL 表示 hotfix レポート

- **案件**: PRJ-012 Claude Code マルチプロジェクト IDE
- **タスク**: PM-929 Preview で外部 URL がまだ見えない問題の再調査 + 修正
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **日付**: 2026-04-20
- **担当**: 開発部門 (dev-v10)
- **種別**: hotfix（PM-927 の UX 副作用対応）
- **前提**: PM-925 Phase 1 MVP + PM-927 外部 URL 対応（CSP 拡張 + block 自動検知）完了
- **発端**: オーナー報告「まだプレビューで外部 URL が見えません」

---

## 0. エグゼクティブサマリー

PM-927 で入れた「5 秒 timeout + SecurityError catch」による iframe block 自動検知は **false positive が多発**し、正常に iframe で表示できている HTTPS サイトまで「ブロック」扱いになり、amber 警告バナー + `opacity-50` 半透明化で「見えない」状態になっていた。

根本対処として **block 自動判定のロジックを全削除** し、以下に刷新:

- iframe は常時 full opacity で mount、dim 表示なし
- 「外部で開く」ボタンは常時 `variant="default"`（primary 色）で強調
- toolbar に `Info` icon + Tooltip を追加し、「iframe 埋込が許可されていないサイトは『外部で開く』」の静的ヘルプで代替
- status indicator / amber banner / `BLOCK_DETECT_TIMEOUT_MS` / `handleLoad` 内の blocked 判定は完全撤去

CSP (`tauri.conf.json`) 側は **PM-927 の設定のまま変更なし**（`frame-src ... https:` / `connect-src ... https:` は既に正しい）。問題は CSP ではなく、フロントエンドの自動判定 UX の副作用だった。

- **変更ファイル**: 1（`components/preview/PreviewPane.tsx` のみ）
- **新規ファイル**: 0
- **依存追加**: 0
- **Rust 変更**: 0
- **CSP 変更**: 0（PM-927 の内容を維持）
- **store 変更**: 0
- **型検査**: `npx tsc --noEmit` 0 error
- **ビルド**: `npx next build` 成功（9/9 static pages exported）
- **Rust**: `cargo check` 0 error（既存 warning 3 件のみ）

---

## 1. H1〜H5 仮説検証

### H1: CSP 変更が反映されていない → **部分的に該当（運用要因）**

`src-tauri/tauri.conf.json` line 27 を確認:

```
"csp": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost https://ipc.localhost https://api.anthropic.com https:; img-src 'self' data: blob: asset: http://asset.localhost https://asset.localhost; frame-src http://localhost:* http://127.0.0.1:* http://*.localhost https:"
```

PM-927 の変更（`frame-src ... https:` / `connect-src ... https:`）は **正しく commit されている**。ただし:

- `tauri.conf.json` は webview の起動時に読込まれる → tauri dev の **完全再起動**（Ctrl+C → `npm run tauri:dev`）が必要。
- frontend hot reload（Next.js の HMR）では反映されない。
- `target/` や `src-tauri/gen/` の cache は CSP を保持しないが、webview が生きたまま再起動なしだと旧 CSP のまま。

**→ 対処**: レポート §5 オーナー検証手順で「Tauri dev の完全再起動」を強調。CSP 側の変更は不要。

### H2: CSP の他 directive が block している → **該当せず**

`default-src 'self'` は `frame-src` が明示されている場合は iframe には適用されない（CSP 仕様: `frame-src` fallback は `child-src` → `default-src`、ただし明示があれば上書き）。iframe 内の sub-resource (`img-src` / `script-src` など) は **iframe 自身の origin** で評価されるため、親側（ccmux-ide-gui）の CSP は無関係。

- iframe の **ロード許可判定**: `frame-src https:` で許可済 ✔︎
- iframe 内の script 実行: iframe 自体の origin の CSP（Google なら google.com の CSP）で判定される → 親の `script-src 'self' 'unsafe-inline'` は無関係
- `connect-src` の `https:` 追加は念のため（iframe が暗黙発行する preflight 等の稀ケースを救う予防的措置）

**→ 対処なし**。現状の CSP で正しく iframe は通る。

### H3: block 検知の false positive → **主原因**

PM-927 の `components/preview/PreviewPane.tsx` にあった以下が不具合源:

```tsx
useEffect(() => {
  setStatus("loading");
  blockTimeoutRef.current = setTimeout(() => {
    setStatus((prev) => (prev === "loading" ? "blocked" : prev));
  }, 5000);  // ← BLOCK_DETECT_TIMEOUT_MS
}, [committedUrl, reloadKey]);
```

加えて `handleLoad` 側:

```tsx
const isBlankSurrogate =
  href === "about:blank" || href === "" ||
  (bodyText === "" && contentDocument.body?.children.length === 0);
if (isBlankSurrogate) {
  setStatus((prev) => (prev === "blocked" ? prev : "loaded"));
}
```

**確認された副作用**（5 パターン）:

1. **初回 load が遅い HTTPS サイト**: onLoad 発火前に 5 s 経過 → `blocked` 確定 → amber banner + iframe `opacity-50` になる。後続で onLoad が来ても表示が blocked のまま残ることがある（状態遷移の competing update）。
2. **localhost dev server の起動が遅い場合**: Next.js の compile 初回 5 s 超過で `blocked` 判定 → 見えない。
3. **HMR 発火時の iframe 内 re-mount**: onLoad の間隔が 5 s 超えると同じ誤判定。
4. **中間的な same-origin redirect**: `contentDocument.body` が一瞬 empty のタイミングで `handleLoad` が評価され `isBlankSurrogate` が true になることがある。
5. **SecurityError 発生は正常動作**: cross-origin iframe の `contentDocument` アクセスは設計上 SecurityError なので、catch した時点で `loaded` に倒すロジック自体は OK。ただし `setStatus` の competing が残るため実用上 false positive 側が優勢。

**→ 結論**: 自動判定ではユーザーの実体験（真っ白なのか正常なのか）と確実に一致しない。**自動判定を撤去**し、ユーザーの目視判断に委ねる方針へ舵を切る。

### H4: iframe 自体が mount されていない → **該当せず**

現状コード確認:

- `activeProjectId` が null の時のみ early return（「プロジェクトを選択するとプレビューが使えます」表示）
- それ以外は `<iframe key={...} src={committedUrl} />` が無条件 mount
- `committedUrl` は `urlEntry?.current ?? DEFAULT_PREVIEW_URL = "http://localhost:3000"` で必ず値あり
- `inputValue` の onChange / onBlur / form onSubmit は正しく `handleCommitUrl` を呼ぶ

→ iframe mount は機能している。

### H5: Tauri webview の iframe 制約 → **該当せず**

Windows WebView2 (Chromium Edge) は https iframe 読込を標準サポート。`frame-src` が CSP で許可されていれば embed 可能。macOS WKWebView も同様。Tauri 2 の webview に iframe の https 禁止のような systemic 制約は存在しない。本番で frame-ancestors / X-Frame-Options block されるサイトはブラウザ挙動と同じで、これは iframe の設計通り（= Tauri 固有ではない）。

---

## 2. 修正案（採用方針）

### 2-1. 採用: block 自動判定を全削除

PM 指示「block 判定はユーザー判断に委ねる」の方針に従い、以下を撤去:

- `type PreviewLoadStatus = "loading" | "loaded" | "blocked"` と `const [status, setStatus]`
- `BLOCK_DETECT_TIMEOUT_MS = 5000` と `blockTimeoutRef`
- status 変化を監視する `useEffect([committedUrl, reloadKey])`
- `handleLoad` 内の `isBlankSurrogate` 判定 / setStatus
- toolbar の status indicator (`読込中… / 表示中 / ブロック`)
- amber 警告バナー（`role="alert"` + AlertTriangle + バナー右の『外部で開く』）
- iframe の `opacity-50` dim 表示
- `AlertTriangle` import

### 2-2. 追加: info icon + Tooltip（静的ヘルプ）

toolbar 右側、URL 入力欄と「外部で開く」ボタンの間に:

```tsx
<TooltipProvider delayDuration={200}>
  <Tooltip>
    <TooltipTrigger asChild>
      <button aria-label="プレビューの挙動について">
        <Info className="h-3.5 w-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="bottom" className="max-w-[280px] text-[11px]">
      iframe 埋込が許可されていないサイト（X-Frame-Options / CSP
      frame-ancestors 制約）は真っ白に表示されます。その場合は
      「外部で開く」でご利用ください。
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

- 常時非侵襲（ユーザーが「あれ?」と思った時に hover で気づく）
- dark mode 対応（既存の popover class を踏襲）
- a11y: `aria-label` + 非 primary button style で focus 可能

### 2-3. 変更: 「外部で開く」を常時強調

```diff
- variant={status === "blocked" ? "default" : "ghost"}
+ variant="default"
```

block 有無に関わらず primary 色で常時表示。ユーザーが真っ白画面を見た瞬間に即 1 click で外部ブラウザへ逃がせる。

### 2-4. 不採用: CSP 追加拡張

H2 の通り親 CSP は iframe 内 sub-resource に影響しない。`img-src` / `style-src` / `script-src` に `https:` を足しても iframe 表示は変わらない（むしろ親アプリの攻撃面を広げるだけ）。**CSP は PM-927 のまま変更しない**。

---

## 3. 変更 diff 一覧

### 3-1. 変更ファイル

| ファイル | 変更内容 | 行数 |
|---|---|---:|
| `components/preview/PreviewPane.tsx` | block 自動判定削除 + info Tooltip 追加 + 外部ボタン常時 primary | -約 130 / +約 30（実質 -100 行） |

### 3-2. 削除されたシンボル

- `AlertTriangle` import
- `type PreviewLoadStatus` type alias
- `BLOCK_DETECT_TIMEOUT_MS` const
- `status` / `setStatus` state hook
- `blockTimeoutRef` ref
- status 初期化 useEffect
- `handleLoad` callback
- `statusLabel` / `statusColorClass` 変数
- `<span>` status indicator
- `{status === "blocked" && ...}` banner JSX
- iframe の conditional `opacity-50`

### 3-3. 追加されたシンボル

- `Info` lucide icon import
- `Tooltip` / `TooltipContent` / `TooltipProvider` / `TooltipTrigger` from `@/components/ui/tooltip`
- info button + Tooltip block（toolbar 内）

### 3-4. 不変のシンボル

- `useProjectStore` / `usePreviewStore` 周り
- `handleCommitUrl` / `handleSubmit` / `handleReload` / `handleBack` / `handleForward` / `handleOpenExternal` / `handleSelectHistory`
- iframe 本体（`src` / `key` / `ref` / form 連動）
- URL 入力欄 / history dropdown / 戻る / 進む / 再読込ボタン

---

## 4. 検証結果

### 4-1. 静的検査

```bash
cd C:/Users/hiron/Desktop/ccmux-ide-gui

npx tsc --noEmit
# → 0 error（exit 0、出力なし）

npx next build
# → ✓ Compiled successfully
# → ✓ Generating static pages (9/9)
# → ✓ Exporting (2/2)
# → Route(/workspace) 4.3 kB / 191 kB First Load JS（preview pane 簡素化で軽微増減）

cd src-tauri && cargo check
# → Finished `dev` profile in 0.50s
# → warning: 3 (既存のみ: sessions_has_project_id / Scope::Cwd / MonitorState::context_ratio)
# → error: 0
```

- `window is not defined` (SSR 時 project-store log) は PM-925 時点から継続する既知 / 無害 warning。PM-929 変更とは無関係。
- lint warning（FilePreviewDialog の `<img>` / ProjectTree の `aria-selected` 等）も PM-929 で触っていない既存 warning。

### 4-2. 並列作業との衝突回避

PM 指示の排他範囲を厳守:

- **触った**: `components/preview/PreviewPane.tsx` のみ
- **触っていない**: `src-tauri/tauri.conf.json` / `components/terminal/*` / `app/globals.css` / `components/layout/Shell.tsx` / `lib/stores/preview.ts`
- PM-928 Terminal 修正と ortho。commit の衝突リスクなし。

### 4-3. logger 方針

`logger.debug` / `logger.error` のみ使用（`handleBack` / `handleForward` / `handleOpenExternal` の既存 3 箇所）。`console.*` は不使用。

---

## 5. オーナー実機検証手順

### 5-1. ⚠ 最重要: tauri dev の **完全再起動** が必須

PM-927 の CSP 変更 (`frame-src ... https:`) が webview に反映されるためには、tauri dev を **完全再起動** する必要がある。フロント側の HMR では CSP は更新されない。

1. 既存の `npm run tauri:dev` プロセスを **Ctrl+C で完全終了**。
2. terminal window を閉じて新規 terminal を開き直す（残留 webview プロセスが居ないことを保証）。
3. タスクマネージャで `ccmux-ide.exe` / `tauri` 関連プロセスが残っていないか確認、残っていれば手動 kill。
4. 再度起動:
   ```bash
   cd C:/Users/hiron/Desktop/ccmux-ide-gui
   npm run tauri:dev
   ```

### 5-2. 3 ケース検証

#### ケース A: localhost（従来どおり）

1. 別シェルで `http://localhost:3000` の dev server を起動（Next.js など）。
2. ccmux-ide でプロジェクト選択 → 「プレビュー」タブを開く。
3. URL 欄に `http://localhost:3000` が入り、iframe に dev server が即表示される。
4. toolbar 右端: info icon（?/小 Info mark） → 「外部で開く」（primary 色）の順で並ぶ。
5. amber banner は **表示されない**（削除済）。iframe は **常時 full opacity**（半透明化なし）。

#### ケース B: iframe 埋込 OK な HTTPS サイト

1. URL 欄に `https://example.com/` → Enter。
2. 数秒で iframe に example.com が表示される。
3. banner なし・ dim なし。「外部で開く」は常時 primary 色のまま。
4. **重要**: PM-927 の実装では slow load で一度 `blocked` 判定が挟まり banner が flash していたが、PM-929 では **一切 banner が出ない**。

#### ケース C: iframe 埋込 NG な HTTPS サイト

1. URL 欄に `https://www.google.com/` → Enter。
2. iframe は **真っ白のまま**（X-Frame-Options: sameorigin で Google が block）。
3. banner / 自動警告は **出ない**（撤去済）。
4. toolbar の「外部で開く」ボタン（primary 色）を 1 click → 既定ブラウザで Google が開く / toast「外部ブラウザで開きました」。
5. info icon に hover → Tooltip で「iframe 埋込が許可されていないサイト ... は真っ白に表示されます。『外部で開く』でご利用ください」のヘルプが出る。

### 5-3. Reload / History / 戻る / 進むの回帰確認

- **Reload** (⟳): 同 URL で iframe が再マウントされる（dev server のログに新規 request が来る）。
- **履歴 dropdown** (📜): 過去入力 URL が選べる、選択で即 iframe 切替。
- **戻る / 進む**: same-origin では動作、cross-origin では silent（エラー toast なし、logger.debug のみ）。
- **タブ切替で state 保持**: Preview → Editor → Preview で iframe が再読込されずスクロール位置保持。

### 5-4. 既知の非 issue

- 真っ白画面は iframe 埋込 NG サイトの **正常動作**（ブラウザ挙動と同じ）。解決は「外部で開く」で一択。
- PM-927 実装の amber banner が出なくなる代わりに、info Tooltip で説明を静的に提供。
- Phase 4 で Tauri 2 secondary webview（案 D）が成熟すれば iframe ではなく独立 webview で表示可能になる（X-Frame-Options の制約を回避）。

---

## 6. 完了条件チェックリスト

- [x] block 自動判定（timeout / onLoad isBlankSurrogate / status state）をすべて撤去
- [x] iframe 常時 full opacity（`opacity-50` conditional 削除）
- [x] 「外部で開く」ボタンを常時 `variant="default"` で強調
- [x] toolbar に Info icon + Tooltip を追加（静的ヘルプ）
- [x] amber banner / status indicator / AlertTriangle import を削除
- [x] CSP（`tauri.conf.json`）は PM-927 のまま変更なし（`frame-src ... https:` が効いているか静的確認済）
- [x] `cargo check` 0 error（既存 warning 3 件のみ）
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功（9/9 static pages exported）
- [x] `"use client"` directive 維持
- [x] `logger` wrapper 使用、`console.*` 不使用
- [x] Rust 無変更
- [x] capability 無変更（shell:allow-open 既存使用）
- [x] Terminal 関連 (`components/terminal/*` / `globals.css`) には触っていない（PM-928 との排他）
- [x] `tauri.conf.json` には触っていない（CSP 再検証のため read のみ）
- [x] 過度な refactor なし、最小 diff（1 ファイル / 差分 -約 100 行）
- [x] store 無変更で完結

---

## 7. 次アクション（CEO 向け）

### 7-1. 完了報告

PM-929 Preview hotfix 完了。オーナー実機検証（§5）を依頼。特に **tauri dev の完全再起動**（§5-1）が最重要 → PM-927 の CSP 変更が反映されていない場合、ケース B の HTTPS サイトが表示されない。

### 7-2. 想定される検証結果パターン

| 結果 | 原因推定 |
|---|---|
| ケース A / B / C 全て期待通り | **PM-929 で解決**。PM-927 の block 自動判定が真因だった。 |
| ケース A のみ OK、B で例えば example.com も白 | CSP 未反映 → tauri dev を再度完全再起動、タスクマネージャで残留プロセス確認 |
| 全ケースで真っ白 | tauri.conf.json の CSP が壊れているか、別 webview 制約の疑い → 追加調査 |

### 7-3. 中期: Phase 4 案 D（secondary webview）

X-Frame-Options block サイトまで IDE 内で見たい要求が出た場合は Phase 4 の Tauri 2 multi-webview 調査を再開。現状は「外部で開く」1 click fallback で十分想定。

### 7-4. 関連タスク

- PM-928 Terminal 修正と排他完了、同時 commit 可能。
- PM-925 Phase 2（複数 URL タブ / auto-detect）は別途判断。

---

**レポート終了**
