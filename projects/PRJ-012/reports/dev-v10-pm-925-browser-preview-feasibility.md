# PRJ-012 v1.0 / PM-925 — ブラウザプレビュー機能 実現可能性調査レポート

- **案件**: PRJ-012 Claude Code マルチプロジェクト IDE
- **タスク**: PM-925 「Cursor 風ブラウザ起動 / アプリ実装確認」機能の実現可能性調査
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **日付**: 2026-04-20
- **担当**: 開発部門 (dev-v10)
- **種別**: 調査 + 提案（実装なし）

---

## 0. エグゼクティブサマリー

Cursor の Preview / Open in browser 相当の機能を ccmux-ide-gui に追加することは **技術的に十分可能** であり、**既存コードへの影響は極めて小さい**。

既存 Shell.tsx のタブモデル（チャット / エディタ / ターミナル）に「プレビュー」タブを 1 つ追加する形で組み込むのが最も自然。既に `@tauri-apps/plugin-shell` + `shell:allow-open` capability で外部ブラウザ起動の基盤がある（ApiKeyStep が `open(URL)` で使用中）。

**推奨**: **案 A（iframe）+ 案 C（外部ブラウザ）ハイブリッド**。MVP 工数 4〜6h、本格版 10〜14h。Tauri のメイン CSP に `frame-src http://localhost:* http://127.0.0.1:*` を追加するだけで localhost 系の dev server は iframe で包み込める。iframe ブロック時（X-Frame-Options / CSP 側の deny など）のみ外部ブラウザへ fallback。

**案 B（plugin-webview 別 window）と案 D（secondary in-window webview）は Tauri 2 公式 plugin が未出荷 / 実験的** なため、MVP では採用せず本格版 Phase で再検討とする。

---

## 1. 目的と要件

### 1-1. ユーザーストーリー

- 開発者（自分）が Claude Code に Next.js アプリの実装を依頼し、`npm run dev` で立ち上げた dev server (`http://localhost:3000`) を **IDE から離れずに** 即座に確認したい。
- 現状は Alt+Tab で別ブラウザウィンドウに切り替えている → 視線移動コストが高い。
- Cursor の "Preview" / "Open Preview" が該当機能。

### 1-2. 要件

| 優先度 | 要件 |
|---|---|
| Must | `http://localhost:{port}` を IDE 内で表示できる |
| Must | URL 入力欄 + Reload / Back / Forward ボタン |
| Must | 「外部ブラウザで開く」ボタン（iframe で開けないサイト用 fallback） |
| Must | プロジェクトごとに preview URL を persist |
| Should | Hot Reload / HMR が iframe 内で動作 |
| Should | 複数 URL タブ切替（例: localhost:3000 と localhost:3001 を並置） |
| Nice | DevTools 呼出（console / network 確認） |
| Nice | Mobile viewport emulation（レスポンシブ確認） |

### 1-3. 非要件（本 Phase では対応しない）

- 任意 https URL のプロキシ経由表示（X-Frame-Options 回避）
- Electron BrowserView 相当の完全独立コンテキスト分離
- 本番サイトの継続 uptime 監視

---

## 2. 現状コードベースの調査結果

### 2-1. Tauri 構成

- **Tauri 版**: 2.1（`src-tauri/Cargo.toml` line 20 `tauri = { version = "2.1", features = ["protocol-asset", "devtools"] }`）
- **Next.js**: 15.5.15、App Router、`output: "export"`（static export）→ Tauri は file:// で serve（`next.config.ts` line 5）
- **Window 数**: 1（`tauri.conf.json` line 13-25、main window のみ）

### 2-2. 既存 CSP（`tauri.conf.json` line 27）

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
connect-src 'self' ipc: http://ipc.localhost https://ipc.localhost https://api.anthropic.com;
img-src 'self' data: blob: asset: http://asset.localhost https://asset.localhost
```

- **重要な発見**: `frame-src` / `child-src` が **未定義**。`default-src 'self'` が効くため、現状の CSP では **外部 origin への iframe 埋め込みはブロックされる**。
- `http://localhost:3000` は `'self'` 扱いされない（ccmux-ide-gui の origin は `tauri://localhost` または `http://tauri.localhost`）。iframe 対応には CSP 変更が **必須**。

### 2-3. 既存 plugin と capability

- `@tauri-apps/plugin-shell` + `shell:allow-open`（`default.json` line 46）→ **外部ブラウザ起動は即利用可**。`ApiKeyStep.tsx:43` が実証済 (`await open(ANTHROPIC_CONSOLE_URL)`)。
- `@tauri-apps/plugin-opener` は未インストール。plugin-shell の `open()` で代替可能なので追加不要。
- `@tauri-apps/api/webview` の `WebviewWindow` / `Webview` は API 上存在するが、公式 plugin ではなく Tauri 本体の一部。ただし複数 webview 周りは Tauri 2 でまだ docs / 安定度に粒度ムラがある。

### 2-4. Shell.tsx のタブ構造

- `EditorViewMode = "chat" | "editor" | "terminal"` (`lib/stores/editor.ts:62`)
- Shell.tsx 上部に `<ViewModeTab>` が 3 個（チャット / エディタ / ターミナル）並ぶ
- 各 pane は `display:none` で常時 mount、state 保持
- **「プレビュー」タブ追加は既存パターン（ターミナル追加の DEC-045 と同じ）に完全に沿う**

### 2-5. プロジェクト単位の state

- `lib/stores/project.ts` で `RegisteredProject` を zustand persist（`ccmux-project-registry`）
- `lib/stores/editor.ts` は **グローバル** editor state（project 切替でも open file 一覧は共通）— ターミナルは `lib/stores/terminal.ts` で **project ごと** に pty_id を分離している
- Preview URL 履歴は **project ごと** に保存するのが自然（プロジェクトごとに dev server port が異なる: localhost:3000, :3001, :5173 等）

---

## 3. 技術選択肢の比較

### 案 A: iframe 埋め込み

- 実装: Next.js の React コンポーネント内で `<iframe src={url} />`
- 変更が必要な場所:
  - `tauri.conf.json` CSP に `frame-src http://localhost:* http://127.0.0.1:*` を追加
  - 新規コンポーネント `PreviewPane.tsx` + `PreviewToolbar.tsx`
  - `lib/stores/preview.ts`（zustand persist、project ごとに url 履歴）
- 工数: 4〜6h（MVP）、8〜10h（URL 履歴 + 複数タブ切替を含む）

### 案 B: Tauri WebviewWindow（別 window）

- 実装: `new WebviewWindow('preview', { url: 'http://localhost:3000' })` で独立 window spawn
- メリット: X-Frame-Options / CSP の影響受けない（各 webview は独立 origin）、DevTools 開ける
- デメリット:
  - **IDE 外部に別 window が出る UX** → Cursor の in-IDE preview とは異なる
  - アプリ終了時の cleanup が必要（Tauri close hook で明示的に destroy）
  - `core:webview:default` capability は既に allow 済だが、新規 window 作成は追加 permission 要検証（`core:window:allow-create` 相当）
- 工数: 6〜8h

### 案 C: 外部ブラウザ起動（plugin-shell）

- 実装: `await open("http://localhost:3000")` 1 行で完了
- 既に ApiKeyStep で実証済の最短実装
- デメリット: **IDE 内プレビューではない**（ユーザーが別ブラウザで確認）。Cursor の UX とは異なる。
- 工数: 0.5〜1h
- **位置づけ**: 単独では不十分。**iframe fallback としてハイブリッドに組み込むのが最適**

### 案 D: Tauri 2 secondary webview（同一 window 内）

- 実装: Tauri 2 の `Webview` API で main webview と並置
- メリット: Cursor の UX に最も近い、CSP 分離、DevTools 可
- デメリット:
  - Tauri 2 での multi-webview-in-window は docs が限定的、`app.webviews` API の安定度に課題
  - Next.js 側の React tree との共存（主 webview の React が secondary webview のサイズ管理する）設計が複雑
  - Windows WebView2 の既知 issue: overlay レンダリング時の z-index 競合
- 工数: 12〜20h（調査込み）
- **結論**: **MVP では見送り**。本格版 Phase で再検討。

### 3-1. 比較マトリクス

| 観点 | 案 A: iframe | 案 B: 別 window | 案 C: 外部 browser | 案 D: secondary webview |
|---|---|---|---|---|
| 実装工数 | ★★★★ (4〜6h) | ★★★ (6〜8h) | ★★★★★ (0.5h) | ★ (12〜20h) |
| UX (Cursor 同等度) | ★★★★ (in-IDE) | ★★ (別 window) | ★ (別 app) | ★★★★★ (完全 in-IDE) |
| X-Frame-Options 耐性 | ★★ (block あり) | ★★★★★ | ★★★★★ | ★★★★★ |
| DevTools | × | ○ | × (別 app 側) | ○ |
| 依存追加 | なし | なし | なし | なし |
| 成熟度（Tauri 2） | ★★★★★ | ★★★★ | ★★★★★ | ★★ |
| HMR / WebSocket | ○ | ○ | ○ | ○ |

---

## 4. 推奨案

### 4-1. 採用方針: 案 A + 案 C ハイブリッド

**理由**:

1. **工数対効果が最大**: MVP 4〜6h で Cursor の UX 80% を再現
2. **既存コード影響最小**: Shell.tsx のタブ追加パターン（PM-920 ターミナル追加）と同じ構造、capability 変更不要（CSP のみ）
3. **localhost dev server は iframe で 99% 動く**: Next.js / Vite / Expo web はいずれも X-Frame-Options を設定しない（開発モード）
4. **fallback が簡単**: iframe onerror 検知 or ユーザー明示操作で `open(url)` すれば外部ブラウザで開ける
5. **本格版 Phase の選択肢を残す**: 案 B / D は Tauri 2 の multi-webview 周りが安定してから段階的に移行可

### 4-2. MVP vs 本格版の Phase 分け

| Phase | 内容 | 工数 |
|---|---|---|
| **MVP (Phase 1)** | 「プレビュー」タブ追加、URL 入力 + iframe + Reload / Back / Forward / 外部で開く | 4〜6h |
| **Phase 2** | プロジェクトごとの URL 履歴 persist、複数 URL タブ切替、dev server 自動検出（npm run dev の stdout から port 抽出） | 4〜6h |
| **Phase 3** | Mobile viewport emulation（width toggle）、別 window プレビュー（案 B 追加選択可に） | 6〜8h |
| **Phase 4** | DevTools 呼出、secondary webview（案 D）へ段階移行検討 | 調査 + 12h〜 |

### 4-3. MVP 実装の詳細設計

#### 4-3-1. 新規ファイル

| File | 役割 |
|---|---|
| `components/preview/PreviewPane.tsx` | iframe + Toolbar の container。`viewMode === "preview"` 時に表示 |
| `components/preview/PreviewToolbar.tsx` | URL 入力、Reload / Back / Forward / 外部で開く ボタン |
| `lib/stores/preview.ts` | zustand persist（project ごとの `url`, `urlHistory: string[]`） |

#### 4-3-2. 既存ファイル最小 diff

| File | 変更点 |
|---|---|
| `src-tauri/tauri.conf.json` | CSP に `frame-src http://localhost:* http://127.0.0.1:* http://*.localhost` を追加 |
| `lib/stores/editor.ts` | `EditorViewMode` に `"preview"` を追加（`"chat" \| "editor" \| "terminal" \| "preview"`） |
| `components/layout/Shell.tsx` | `<ViewModeTab>` 1 個追加、`<PreviewPane>` を `display:none` 制御で常時 mount |

#### 4-3-3. PreviewPane.tsx の UX モック（JSX イメージ）

```tsx
export function PreviewPane() {
  const { url, setUrl, urlHistory } = usePreviewStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="flex h-full flex-col">
      <PreviewToolbar
        url={url}
        onChangeUrl={setUrl}
        onReload={() => iframeRef.current?.contentWindow?.location.reload()}
        onBack={() => iframeRef.current?.contentWindow?.history.back()}
        onForward={() => iframeRef.current?.contentWindow?.history.forward()}
        onOpenExternal={async () => {
          const { open } = await import("@tauri-apps/plugin-shell");
          await open(url);
        }}
        history={urlHistory}
      />
      <iframe
        ref={iframeRef}
        src={url}
        className="min-h-0 flex-1 border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        title="Preview"
      />
    </div>
  );
}
```

#### 4-3-4. Toolbar UX

```
┌──────────────────────────────────────────────────────────────────┐
│ ◀  ▶  ⟳   [http://localhost:3000     ▼]  [外部で開く]  [+]      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│              (iframe 領域 — dev server 表示)                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

- URL 欄は `<input>` + `history` dropdown（過去入力した URL 上位 10 件）
- 現在の project の `preview.url` を読む（project 切替時に URL 自動切替）
- `+` ボタンは Phase 2 で複数タブ切替用、MVP では disable

---

## 5. 課題とリスク

### 5-1. CSP frame-src の緩和範囲

- **推奨設定**: `frame-src http://localhost:* http://127.0.0.1:* http://*.localhost`
- **リスク**: 任意 URL を許可すると malicious site 埋め込みリスク → 初期実装は **localhost/127.0.0.1 限定**、任意 https URL は外部ブラウザ fallback とする
- **mitigation**: URL 入力 validation で localhost / 127.0.0.1 / 192.168.x.x 以外を入れた場合は「iframe で開けないため外部ブラウザで開きます」と警告 + `open(url)` に自動分岐

### 5-2. X-Frame-Options / CSP `frame-ancestors` ブロック

- Next.js dev server は X-Frame-Options を送らない → OK
- Vite dev server も同様 → OK
- 本番 URL (例: https://google.com) は送る → iframe で真っ白画面 → ユーザーが「外部で開く」を押す fallback に誘導

### 5-3. HMR / WebSocket

- Next.js の HMR は WebSocket (`ws://localhost:3000/_next/webpack-hmr`) で動作 → iframe 内でも動く（origin は iframe 自身）
- CSP は iframe 自身（Tauri webview ではない）が評価する → ccmux-ide-gui の CSP は影響しない
- 実測要確認だが、通常 dev server は問題なく動くことが知られている

### 5-4. localhost アクセスの Tauri 固有制約

- Tauri 2 の webview から http://localhost:* への iframe 埋込は **`frame-src` CSP が許可されている限り動く**
- `connect-src` は fetch / WebSocket 用で iframe には関係しない
- 実測で Windows 11 WebView2 / macOS WKWebView 両方で動作確認するのが望ましい

### 5-5. ユーザー入力 URL の安全性

- ユーザーが malicious URL を入力して iframe に注入すれば XSS / clickjacking リスク
- **mitigation**: URL whitelist（localhost / 127.0.0.1 / 10.x.x.x / 192.168.x.x / *.localhost / *.local）、外の URL は外部ブラウザ強制

### 5-6. Project 切替時の iframe reload

- project 切替で iframe の `src` が変わる → 強制 reload で UX 壊れる懸念
- **mitigation**: `key={activeProjectId}` を iframe に付けて project ごとに iframe を完全再生成 or iframe を keep-alive にして URL 変更検知時のみ reload

---

## 6. 必要な dependency / capability 追加

### 6-1. 追加 npm package

**なし**。React の `<iframe>` は純正 HTML、`@tauri-apps/plugin-shell` は既にインストール済。

### 6-2. 追加 Rust crate

**なし**。MVP は frontend 完結（Rust 側 command 追加不要）。

### 6-3. 追加 Tauri capability

**なし**。`shell:allow-open` は既に capability に含まれている。

### 6-4. 設定変更（必須）

- `src-tauri/tauri.conf.json` CSP の `default-src 'self'` を維持したまま、`frame-src` directive を追加

変更前:
```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost https://ipc.localhost https://api.anthropic.com; img-src 'self' data: blob: asset: http://asset.localhost https://asset.localhost
```

変更後（追記部分のみ強調）:
```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost https://ipc.localhost https://api.anthropic.com; img-src 'self' data: blob: asset: http://asset.localhost https://asset.localhost; frame-src http://localhost:* http://127.0.0.1:* http://*.localhost
```

---

## 7. 既存実装への影響範囲

| 項目 | 影響 | 備考 |
|---|---|---|
| Chat / Editor / Terminal タブ | なし | `viewMode` が `"chat" / "editor" / "terminal"` の時は既存挙動そのまま |
| Multi-Sidecar / Split Sessions | なし | Preview は独立 tab、sidecar と無関係 |
| Project Rail | なし | project 切替時に `usePreviewStore` の key が `activeProjectId` に切り替わるのみ |
| Command Palette | 小 | Phase 2 で「プレビューを開く」コマンド追加検討 |
| E2E test (Playwright) | 新規テスト追加 | `projects/PRJ-012/tests/` に `preview.spec.ts` を追加 |
| CSP | **変更あり** | `frame-src` 追加（他 directive 不変） |
| Tauri capability | なし | 既存 `shell:allow-open` で充足 |
| package.json | なし | 新規 dependency 不要 |
| Cargo.toml | なし | Rust 変更なし |

---

## 8. 実装順序（MVP 着手時の推奨手順）

1. `lib/stores/preview.ts` の zustand store 作成（1h）
2. `lib/stores/editor.ts` の `EditorViewMode` に `"preview"` 追加（0.3h）
3. `components/preview/PreviewToolbar.tsx` 実装（1h）
4. `components/preview/PreviewPane.tsx` 実装（1h）
5. `components/layout/Shell.tsx` にタブ + pane mount 追記（0.5h）
6. `src-tauri/tauri.conf.json` CSP 変更 → `npm run tauri dev` で確認（0.5h）
7. 手動検証: localhost:3000 で Next.js dev server を起動して iframe 表示確認、HMR 動作確認、Project 切替 URL persist 確認（1h）
8. Playwright E2E 基本テスト追加（Phase 2 で充実化、MVP は smoke 1 本）（0.5〜1h）

**合計 MVP 工数**: 5〜6h

---

## 9. 結論と CEO への提案

### 9-1. 結論

- **実現可能性**: **高**。技術的阻害要因なし、既存パターンに完全に沿う。
- **推奨実装**: 案 A（iframe）+ 案 C（外部ブラウザ fallback）ハイブリッド。
- **MVP 工数**: 5〜6h。
- **影響範囲**: CSP 1 行追加、Shell.tsx タブ 1 個追加、新規コンポーネント 2 + store 1。既存機能への副作用なし。

### 9-2. CEO 判断を仰ぐポイント

- (A) MVP を PM-925 として即着手するか、他 task 優先順位との兼ね合いで保留するか
- (B) Phase 2 以降（複数 URL タブ、dev server auto-detect、mobile viewport）を同 release に含めるか分離するか
- (C) 案 D（secondary webview）は将来の big bet として残すが、いつ調査 Phase を立てるか

### 9-3. 次アクション

本レポートを CEO にレビュー依頼 → 採用判断後、PM-925 タスクとして `projects/PRJ-012/tasks.md` に追記 + 実装着手（別 dev agent セッション）。

---

## 付録 A: 検討済みだが採用しなかった設計

### A-1. Tauri custom protocol で localhost 画面をキャプチャ

- Rust 側で `reqwest` でページを fetch → HTML を Tauri webview 内で render
- デメリット: JS / CSS / asset の relative URL がすべて破綻、SPA / HMR 完全不可
- **却下**

### A-2. Playwright embedded を IDE 内に埋め込む

- Playwright headed mode を IDE 内で launch
- デメリット: バイナリサイズ肥大（Chromium ~300MB）、起動時間、ライセンス
- **却下**

### A-3. CDP (Chrome DevTools Protocol) でリモート Chrome を操作

- ユーザーが別途起動した Chrome に CDP 接続して screenshot ストリーム
- デメリット: 実装複雑度が Preview という軽機能に対して過剰
- **却下**

---

## 付録 B: 実装時の参考 code パターン

### B-1. zustand store のサンプル（`lib/stores/preview.ts`）

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface PreviewProjectState {
  url: string;
  urlHistory: string[];
}

interface PreviewStoreState {
  byProject: Record<string, PreviewProjectState>;
  getUrl: (projectId: string) => string;
  setUrl: (projectId: string, url: string) => void;
}

export const usePreviewStore = create<PreviewStoreState>()(
  persist(
    (set, get) => ({
      byProject: {},
      getUrl: (projectId) =>
        get().byProject[projectId]?.url ?? "http://localhost:3000",
      setUrl: (projectId, url) =>
        set((s) => {
          const prev = s.byProject[projectId] ?? { url: "", urlHistory: [] };
          const history = [url, ...prev.urlHistory.filter((u) => u !== url)].slice(0, 10);
          return {
            byProject: {
              ...s.byProject,
              [projectId]: { url, urlHistory: history },
            },
          };
        }),
    }),
    {
      name: "ccmux-preview",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
```

### B-2. URL validator（localhost 判定）

```ts
export function isLocalhostUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname.endsWith(".localhost") ||
      u.hostname.endsWith(".local") ||
      /^10\./.test(u.hostname) ||
      /^192\.168\./.test(u.hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname)
    );
  } catch {
    return false;
  }
}
```

iframe に食わせる前に `isLocalhostUrl(url)` が false なら「この URL は外部ブラウザで開きます」と toast して `open(url)` に分岐する。

---

**レポート終了**
