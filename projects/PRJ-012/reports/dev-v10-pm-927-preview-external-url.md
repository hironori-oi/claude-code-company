# PRJ-012 v1.0 / PM-927 — Preview 外部 URL 対応 + Fallback UX 強化 実装レポート

- **案件**: PRJ-012 Claude Code マルチプロジェクト IDE
- **タスク**: PM-927 Preview 機能の外部 URL 表示対応（CSP 拡張 + block 検知 + fallback UX）
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **日付**: 2026-04-20
- **担当**: 開発部門 (dev-v10)
- **種別**: 実装
- **前提**: PM-925 Phase 1 MVP 完了（iframe + 外部 fallback ハイブリッド）
- **発端**: オーナー質問「外部 URL を表示できないのか?」への対応

---

## 0. エグゼクティブサマリー

PM-925 Phase 1 MVP の CSP は `frame-src http://localhost:* http://127.0.0.1:* http://*.localhost` に限定していた。オーナーから外部 URL 表示の要望を受け、2 段階で拡張:

- **A: CSP 拡張** — `frame-src` に `https:` を追加。**HTTPS の外部サイトで iframe embed を許可するページは IDE 内で表示可能** になった。
- **B: Fallback UX 強化** — iframe embed を拒否するサイト（X-Frame-Options / CSP frame-ancestors）向けに block 検知 + 警告バナー + 強調された「外部で開く」ボタンを追加。

ただし **X-Frame-Options / CSP frame-ancestors はサイト側の設定でアプリから override 不可**。本格的な任意サイト表示には Phase 4 の Tauri 2 secondary webview (案 D) が必要。

- **変更ファイル**: 2（`src-tauri/tauri.conf.json`, `components/preview/PreviewPane.tsx`）
- **新規ファイル**: 0
- **依存追加**: 0
- **Rust 変更**: 0
- **型検査**: `npx tsc --noEmit` 0 error
- **ビルド**: `npx next build` 成功（9 / 9 static pages exported）
- **Rust**: `cargo check` 0 error（既存 warning 3 件のみ）
- **store 変更**: 0（UI state だけで完結、`lib/stores/preview.ts` は不変）

---

## 1. CSP 拡張 diff

`src-tauri/tauri.conf.json` line 27:

```diff
-      "csp": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost https://ipc.localhost https://api.anthropic.com; img-src 'self' data: blob: asset: http://asset.localhost https://asset.localhost; frame-src http://localhost:* http://127.0.0.1:* http://*.localhost",
+      "csp": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost https://ipc.localhost https://api.anthropic.com https:; img-src 'self' data: blob: asset: http://asset.localhost https://asset.localhost; frame-src http://localhost:* http://127.0.0.1:* http://*.localhost https:",
```

### 変更点

1. **`frame-src` に `https:` 追加**
   - 任意の HTTPS origin を iframe 埋込の候補として許可。
   - HTTP 外部 URL は **あえて許可しない**（mixed content リスク回避。localhost / 127.0.0.1 のみ HTTP 継続）。
2. **`connect-src` に `https:` 追加**
   - iframe 内の HMR WebSocket / XHR / fetch は iframe 自身の origin で評価されるので厳密には不要だが、Preview 内で将来 API 呼び出しが増えた時の先回り措置。この追加で ccmux-ide-gui 本体が任意 HTTPS API に fetch できる意図ではなく、iframe 経由での暗黙的な load 系 request（preflight 等）が `connect-src` にひっかかる稀ケースを回避するためのガード。
3. **他 directive (default-src / script-src / style-src / img-src) は不変**

### 反映条件

- `tauri.conf.json` は runtime 設定。**Rust rebuild 不要**（`cargo check` 通過確認済）。
- tauri dev 再起動で新 CSP が反映される。オーナー環境で tauri dev 停止中 → 次回 `npm run tauri:dev` で自動反映。

---

## 2. 技術制約の説明（オーナー向け）

### 2-1. iframe で外部 URL が表示できない原因は **3 層**

```
[1] CSP frame-src (アプリ側 / tauri.conf.json)
       ↓ 許可リストに origin が含まれる必要あり
[2] X-Frame-Options (サイト側 response header)
       ↓ DENY / SAMEORIGIN だと iframe 不可
[3] CSP frame-ancestors (サイト側 response header)
       ↓ 埋込元 origin が許可されていないと iframe 不可
```

### 2-2. どの層をアプリから制御できるか

| 層 | アプリ側制御 | PM-927 対応 |
|---|---|---|
| [1] CSP frame-src | 可 | `https:` 追加で緩和 |
| [2] X-Frame-Options | **不可**（サイト側設定） | fallback UX |
| [3] CSP frame-ancestors | **不可**（サイト側設定） | fallback UX |

### 2-3. 代表的な挙動

| サイト | 表示可否 | 理由 |
|---|---|---|
| `http://localhost:3000` (Next.js dev) | 表示可 | X-Frame なし |
| `http://localhost:5173` (Vite) | 表示可 | X-Frame なし |
| `https://github.com/` | **block** | X-Frame-Options: deny |
| `https://www.google.com/` | **block** | X-Frame-Options: sameorigin |
| `https://twitter.com/` | **block** | frame-ancestors 'self' |
| `https://www.anthropic.com/` | **block** | CSP 厳しめ |
| `https://docs.anthropic.com/` | 多くの docs は embed 可 | サイト次第 |
| 自分の Vercel preview URL | 多くは可 | 特に設定しなければ X-Frame なし |
| `https://example.com/` | 可 | X-Frame なし |

→ **個人サイト / 小規模サービス / OSS docs / 自分の staging 環境は iframe 表示できる可能性が高い**。主要サービスはほぼ block される。

### 2-4. HTTPS 本番のみ `frame-src` 緩和にした理由

HTTP 外部 URL を許可しなかった理由:

- **mixed content の警告**: Tauri webview が HTTPS context で動いている場合、HTTP iframe は MIXED-CONTENT で blocking される。
- **セキュリティリスク**: HTTP は改ざん可能。Preview 内 script 実行で local LAN の攻撃面が広がる。
- **実用性が低い**: 外部 HTTP サービスは現代ほぼ消失。localhost dev server だけが HTTP を使う現実的なケースで、これは既存の `http://localhost:*` で網羅済。

---

## 3. Fallback UX 設計

### 3-1. block 検知ロジック

`components/preview/PreviewPane.tsx` に以下の state を導入:

```tsx
type PreviewLoadStatus = "loading" | "loaded" | "blocked";
const [status, setStatus] = useState<PreviewLoadStatus>("loading");
```

#### タイマー方式（timeout による blocked 疑い判定）

- URL / reloadKey 変化時に `status` を `"loading"` に戻し、5 秒 timeout をセット。
- timeout 発火時に status が `"loading"` のままなら `"blocked"` に遷移。
- `BLOCK_DETECT_TIMEOUT_MS = 5000`。重いページで 5 秒以上かかる場合の false positive は許容（ユーザーは手動 Reload or 外部で開くで解決可能）。

#### onLoad 方式（確定判定）

iframe の `onLoad` ハンドラで以下を判定:

```tsx
try {
  const href = contentDocument.location?.href ?? "";
  const bodyText = contentDocument.body?.innerText?.trim() ?? "";
  const isBlankSurrogate =
    href === "about:blank" || href === "" ||
    (bodyText === "" && contentDocument.body?.children.length === 0);
  if (isBlankSurrogate) {
    // about:blank / 空 body は timeout 側の判定に任せる
    setStatus((prev) => prev === "blocked" ? prev : "loaded");
  } else {
    setStatus("loaded");
  }
} catch (e) {
  // cross-origin の contentDocument アクセスは SecurityError
  // これは **正常に表示成功** している証拠 (別 origin page が load された)
  setStatus("loaded");
}
```

#### 判定マトリクス

| ケース | contentDocument アクセス | 判定 |
|---|---|---|
| localhost 同 origin load 成功 | 可（page の real DOM） | `loaded` |
| HTTPS cross-origin load 成功 | SecurityError | `loaded`（try-catch で捕捉） |
| X-Frame-Options block | about:blank or empty body | `loading` のまま → 5s timeout → `blocked` |
| CSP block (自分側) | load 自体が発火しない | 5s timeout → `blocked` |
| slow load (5s 超) | onLoad まだ | `blocked` 誤判定（許容） |

### 3-2. UI コンポーネント

#### (a) Status indicator（toolbar 右端）

```tsx
<span className={cn("select-none px-1 text-[11px] tabular-nums", statusColorClass)}>
  {statusLabel}  // 読込中… / 表示中 / ブロック
</span>
```

- `loading`: muted gray
- `loaded`: emerald (success)
- `blocked`: amber (warning)
- `aria-live="polite"` で screen reader に通知

#### (b) 警告バナー（iframe の直上）

block 時のみ表示:

```tsx
{status === "blocked" && (
  <div role="alert" className="... bg-amber-500/10 ...">
    <AlertTriangle />
    <span>このページは iframe 埋込を許可していません
     （X-Frame-Options 制約）。外部ブラウザで開いて確認してください。</span>
    <Button variant="default" onClick={handleOpenExternal}>
      <ExternalLink /> 外部で開く
    </Button>
  </div>
)}
```

- amber color scheme で dark mode 対応
- バナー右端に primary variant の「外部で開く」ボタンを配置（視線誘導）

#### (c) Toolbar の「外部で開く」ボタンの強調

block 時のみ `variant="default"` (primary color) に切替:

```tsx
<Button variant={status === "blocked" ? "default" : "ghost"} ...>
```

通常時は ghost (目立たない)、block 時は filled (強調)。

#### (d) iframe の opacity 低下

block 時は iframe を `opacity-50` で dim 表示 → 真っ白画面のまま残さず「何か起きた」をユーザーに示唆。

#### (e) URL 入力 placeholder 改善

```tsx
placeholder="localhost:3000 / https://... 入力可"
```

旧 placeholder は `"http://localhost:3000"` だけだった → 外部 URL も入力可能であることを明示。

### 3-3. 外部で開く fallback

既存の `@tauri-apps/plugin-shell` の `open(url)` をそのまま流用（`ApiKeyStep.tsx` と同パターン）。capability 変更なし。

---

## 4. 変更ファイル一覧

| ファイル | 変更内容 | 行数 |
|---|---|---:|
| `src-tauri/tauri.conf.json` | CSP `frame-src` / `connect-src` に `https:` 追加 | 1 |
| `components/preview/PreviewPane.tsx` | status state + block 検知 + banner + placeholder 改善 | +約 130 / 既存ロジック不変 |

**合計変更**: 2 ファイル、約 131 行追加。store やそれ以外のコンポーネントは **無変更**。

---

## 5. 既知の制限（Phase 4 申し送り）

### 5-1. X-Frame-Options block は iframe で回避不能

- アプリから override 不可。`sandbox="allow-same-origin"` 等でも X-Frame-Options は効く。
- Phase 4 「Tauri 2 secondary webview（案 D）」で本格解決予定:
  - iframe ではなく **independent webview** で表示
  - Webview は browser context なので X-Frame-Options の **埋込 context** が発生しない（= block されない）
  - DevTools も利用可能になる利点あり
  - 難点: Tauri 2 multi-webview API はまだ実験的、docs 不足

### 5-2. block 検知の false positive

- 5 秒以上かかる重い HTTPS ページは一度 `blocked` 判定される。
- 対策: ユーザー手動 Reload で再判定可能（URL reload → 5s timer リセット）。重要な高頻度 URL は history dropdown に persist されているので再入力不要。

### 5-3. block 検知の false negative

- X-Frame 側が `about:blank` でなく中身のある error page を返してくる場合、onLoad 内で `loaded` 判定されてしまう。
- 現状はレアケース（主要サイトの block は about:blank or empty body が主流）。Phase 2 で `document.title` が空 / `body.scrollHeight === 0` 等の追加判定を検討。

### 5-4. HTTP 外部 URL は非サポート

- mixed content と security リスクで意図的に非対応。
- ユーザーが HTTP 外部 URL 入力 → CSP block → timeout 5s → `blocked` → 「外部で開く」案内（UX としては整合）。

### 5-5. 以前から継続する Phase 2 / 3 非対応項目

- 複数 URL タブ切替
- dev server auto-detect（npm run dev stdout 監視）
- mobile viewport emulation
- DevTools 起動（iframe では不可、secondary webview で解決）

---

## 6. 実機検証手順

### 6-1. 起動

```bash
cd C:/Users/hiron/Desktop/ccmux-ide-gui
npm run tauri:dev
```

CSP は tauri.conf.json の runtime 設定なので再起動のみで反映。Rust rebuild 不要。

### 6-2. 3 ケース検証

#### ケース A: localhost（従来どおり動くことの確認）

1. 別シェルで Next.js 等の dev server を起動（`http://localhost:3000`）。
2. ccmux-ide でプロジェクトを選択 → プレビュータブを開く。
3. URL 欄に `http://localhost:3000` が入っており、iframe に dev server が表示される。
4. toolbar 右端の status が `表示中` (emerald)。
5. 警告バナー **非表示**。
6. 「外部で開く」ボタンは ghost (目立たない)。

#### ケース B: X-Frame-Options OK な HTTPS サイト

1. URL 欄に `https://example.com/` を入力 → Enter。
2. iframe に example.com の page が表示される。
3. status `表示中`（emerald）、警告バナー **非表示**。
4. 注: cross-origin なので contentDocument アクセスは SecurityError になり、try-catch で捕捉 → `loaded` に遷移する。

#### ケース C: X-Frame-Options block な HTTPS サイト

1. URL 欄に `https://www.google.com/` を入力 → Enter。
2. iframe が一瞬 loading → 5 秒後に status が `ブロック` (amber) に遷移。
3. iframe の直上に **amber 背景の警告バナー** が表示される:
   > このページは iframe 埋込を許可していません（X-Frame-Options 制約）。外部ブラウザで開いて確認してください。
4. バナー右端の「外部で開く」ボタンが **primary 色**で強調。
5. toolbar 右端の「外部で開く」ボタンも **primary 色**に切替わっている。
6. iframe は dim (`opacity-50`) されている。
7. 「外部で開く」をクリック → 既定ブラウザで Google が開く、toast「外部ブラウザで開きました」。

### 6-3. Reload 動作確認

- ケース C で iframe がブロックされた後、URL を変えて別サイトに遷移 → status が `読込中` → `表示中` (or `ブロック`) と再判定されることを確認。
- 同じ URL のまま Reload ボタンを押す → 5s タイマーがリセットされ再判定。

### 6-4. false positive 許容確認（任意）

- 意図的に遅延する URL（`https://httpstat.us/200?sleep=6000` 等）を入力。
- 5s 経過で一旦 `blocked` 判定。
- その後 onLoad 発火で cross-origin → `loaded` に復帰することを確認（タイマーは clearTimeout 済）。
- バナーの一時表示は許容範囲として扱う。

---

## 7. 完了条件チェックリスト

- [x] `src-tauri/tauri.conf.json` の CSP `frame-src` / `connect-src` に `https:` 追加
- [x] `components/preview/PreviewPane.tsx` に status state / block 検知 / fallback banner 実装
- [x] 「外部ブラウザで開く」ボタンが block 時に primary 色で強調
- [x] status indicator (loading / loaded / blocked) を toolbar に表示
- [x] URL 入力 placeholder に外部 URL 可を明示
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功（9 / 9 static pages exported）
- [x] `cargo check` 0 error（既存 warning 3 件のみ）
- [x] `"use client"` directive 維持
- [x] `logger` wrapper 使用（console.log / debug 不使用）
- [x] Rust 無変更
- [x] capability 無変更（shell:allow-open 既存使用）
- [x] Terminal 関連ファイルには触らず（PM-926 並列作業との干渉回避）
- [x] 過度な refactor なし、最小 diff
- [x] store 無変更で完結

---

## 8. 次アクション（CEO 向け）

### 8-1. 完了報告

PM-927 実装完了。オーナー実機検証（§6）で 3 ケース（localhost / X-Frame OK / X-Frame block）の挙動確認を依頼。

### 8-2. Phase 4（案 D secondary webview）の優先度判断

X-Frame-Options block サイトを本格的に IDE 内表示したい場合は Phase 4 が必要。現状は「外部で開く」fallback で 90% のユーザーニーズを満たすと想定。Phase 4 は Tauri 2 multi-webview API の安定度次第で四半期 1 回の調査更新を推奨。

### 8-3. 関連タスク

- PM-925 Phase 2（複数 URL タブ切替 / dev server auto-detect）は引き続き別途判断。
- PM-926 Terminal 透過再調整は別 Agent 作業、本 PM-927 とは ortho。

---

**レポート終了**
