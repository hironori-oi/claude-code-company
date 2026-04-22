# PRJ-012 v1.4 / PM-955: Claude Code MCP 対応 (Phase 1 MVP) 完了レポート

- **日付**: 2026-04-20
- **PM**: PM-955
- **担当 Agent**: dev (build-error-resolver role 経由)
- **対象 repo**: `C:\Users\hiron\Desktop\ccmux-ide-gui` / main branch
- **作業種別**: 調査 + Phase 1 実装 (Case A 採用)
- **起点 commit**: `27f7d8a` (v1.3.0 release)

## TL;DR

- **採用ケース**: **Case A = disk scan ベースの list 表示** (MVP Phase 1)
  - Case B/C 相当 API (SDK `query.mcpServerStatus()` / `setMcpServers()` / `toggleMcpServer()`) は **SDK 0.2.x に first-class 実装済** を確認。Phase 2+ で活用する形で明示的に申し送り
- **追加 Rust command**: `list_mcp_servers(project_path?: string) -> McpServerDef[]`
- **SlashPalette MCP section** を emerald accent + `Plug` icon で追加
- 既存 `read_mcp_config` / `write_mcp_config` / `/mcp` slash dispatcher / `/settings/mcp` editor 画面はそのまま温存 (追加専念、改修ゼロ)
- `cargo check` 0 error / `cargo test --lib` 138 passed (+13 new) / `npx tsc --noEmit` 0 error / `npx next build` 成功
- plugins.rs (PM-954) / skills.rs (PM-953) と同形の「独立 disk 走査 + SDK 実行委譲」ポリシーで一貫性確保

---

## Step 1: Claude Code MCP 公式仕様調査

WebFetch は不要 — **`@anthropic-ai/claude-agent-sdk/sdk.d.ts` と実機ファイル** を直接確認することで仕様を精査した。

### 1.1 設定ファイル格納先 (5 スコープ)

Claude Code が MCP 設定を解決する経路は **5 種類**:

| # | スコープ | 格納先 | 共有単位 |
|---|---------|--------|---------|
| 1 | Global (user-level) | `~/.claude/settings.json` の `mcpServers` | 全 project 横断、マシン全体 |
| 2 | User (top-level) | `~/.claude.json` 直下の `mcpServers` | 全 project 横断、Claude Code CLI 経由のみ書込 |
| 3 | User-project | `~/.claude.json` の `projects["<abs-path>"].mcpServers` | 特定 project 専用 (trust dialog 後に CLI が記録) |
| 4 | Plugin-bundled | `<~/.claude/plugins/cache/.../install-path>/.mcp.json` | plugin 単位 (`enabledPlugins` で on/off) |
| 5 | Project-local | `<project>/.mcp.json` | git commit 可能、チーム共有想定 |

### 1.2 設定 format (全スコープ共通)

```json
{
  "mcpServers": {
    "stitch": {                           // stdio transport
      "command": "cmd",
      "args": ["/c", "npx", "@_davideast/stitch-mcp"],
      "env": { "STITCH_API_KEY": "..." }
    },
    "aidesigner": {                       // http transport
      "type": "http",
      "url": "https://api.aidesigner.ai/api/v1/mcp"
    },
    "example-sse": {                      // sse transport
      "type": "sse",
      "url": "https://sse.example/mcp"
    }
  }
}
```

### 1.3 Transport 判別ルール

- `type: "http"` or `type: "sse"` → `url` 採用
- `type` 無しで `command` あり → stdio 扱い (`args`, `env` 採用)
- それ以外 → `unknown`

### 1.4 disable 系リスト

同じ `~/.claude.json` の project entry に以下の配列が入る:
- `disabledMcpServers: string[]` — 個別 server 名 (eg `"foo"`) or plugin server marker (`"plugin:<plugin-short>:<server>"`) を含む
- `disabledMcpjsonServers: string[]` — project-local `.mcp.json` 由来の server を opt-out する名前一覧
- `enabledMcpjsonServers: string[]` — 同じく opt-in allowlist (本 MVP では参照せず、CLI 側の allowlist ロジック担当)

本 MVP では:
- **`disabledMcpServers` → scope 全般に反映** (plugin marker も含めてフラット match)
- **`disabledMcpjsonServers` → project scope (.mcp.json 由来) のみに反映**

### 1.5 plugin 無効化

`~/.claude/settings.json` の `enabledPlugins["<name>@<marketplace>"]: boolean` が false なら、その plugin 配下の全 MCP server を `enabled=false` に patch する。

---

## Step 2: SDK サポート確認

`@anthropic-ai/claude-agent-sdk@0.2.x` (sidecar 同梱) の `sdk.d.ts` を grep 精査。

### 2.1 MCP 関連型・API 全量

| 種別 | API / 型 | 用途 |
|-----|---------|------|
| Option | `Options.mcpServers?: AgentMcpServerSpec[]` | `query()` 起動時に渡す初期 server list |
| Option | `McpStdioServerConfig` / `McpSSEServerConfig` / `McpHttpServerConfig` / `McpSdkServerConfig` | 4 transport の設定型 |
| Query API | `query.mcpServerStatus(): Promise<McpServerStatus[]>` | **実接続状態と tool 一覧取得** (connected / failed / needs-auth / pending / disabled) |
| Query API | `query.toggleMcpServer(name, enabled): Promise<void>` | 動的 enable/disable |
| Query API | `query.reconnectMcpServer(name): Promise<void>` | 再接続 |
| Query API | `query.setMcpServers(record): Promise<McpSetServersResult>` | dynamic に全入れ替え |
| Helper | `createSdkMcpServer(options)` | in-process SDK MCP server 生成 |
| Hook | `HookInput.type === "Elicitation"` | MCP server からのユーザ入力要求 (OAuth 等) |

### 2.2 McpServerStatus の shape

```ts
type McpServerStatus = {
  name: string;
  status: 'connected' | 'failed' | 'needs-auth' | 'pending' | 'disabled';
  serverInfo?: { name: string; version: string };
  error?: string;
  config?: McpServerStatusConfig;
  scope?: string;  // 'project' | 'user' | 'local' | 'claudeai' | 'managed'
  tools?: { name: string; description?: string; annotations?: {...} }[];
};
```

**= 実装可能性 = 高**。Phase 2 で `mcpServerStatus()` を sidecar 経由で呼び、tool 数・接続状態を live 表示する道筋が確定。

---

## Step 3: オーナー環境の実稼働 MCP server 認識状況

実機ファイルを読んで現状を把握した:

### 3.1 Global (`~/.claude/settings.json`)

```json
{
  "mcpServers": {
    "stitch":     { "command": "cmd", "args": ["/c", "npx", "@_davideast/stitch-mcp", "proxy"], "env": { "STITCH_API_KEY": "..." } },
    "aidesigner": { "type": "http", "url": "https://api.aidesigner.ai/api/v1/mcp" }
  }
}
```

### 3.2 Enabled plugins (`~/.claude/settings.json` の `enabledPlugins`)

- `frontend-design@claude-plugins-official`
- `playwright@claude-plugins-official`
- `supabase@claude-plugins-official`
- `github@claude-plugins-official`
- `security-guidance@claude-plugins-official`
- `vercel@claude-plugins-official`
- `everything-claude-code@everything-claude-code`
- `rust-analyzer-lsp@claude-plugins-official`
- `claude-mem@thedotmack` (false)

そのうち `vercel@...` は `cache/claude-plugins-official/vercel/0.40.0/.mcp.json` を保持 (http, `https://mcp.vercel.com`)。

### 3.3 User-project (`~/.claude.json` の `projects` sub-map)

- `C:/Users/hiron/Documents/app/hr-evaluation-system` に `{ vercel: { type: http, url: https://mcp.vercel.com } }` が記録済
- `claude-code-company` 自身は空 (本 project で MCP 使用実績なし)

### 3.4 disabledMcpServers

`claude-code-company` project entry:
```json
{ "disabledMcpServers": ["plugin:vercel:vercel", "plugin:claude-mem:mcp-search"] }
```

→ 仕様書要望にあった「github / playwright / supabase / pencil / stitch / aidesigner / claude_ai_*」のうち、**オーナー要望記載は記憶ベースで、実機の settings.json には stitch / aidesigner の 2 件のみが明示**。他 (github / playwright / supabase) は **plugin 由来** (plugin が bundle する `.mcp.json`) で、**本 MVP の `scope="plugin"` で拾える**ことを確認。

### 3.5 project-local .mcp.json

`C:\Users\hiron\Desktop\claude-code-company\.mcp.json` は **存在するがファイル中身は pencil MCP の instruction prompt が埋まっている特殊ケース**。MVP は実 JSON のみ parse、format 壊れた場合は silent skip で fail-open する実装とした。

---

## Step 4: 既存実装の棚卸し

調査前に既に存在していたもの (今回は改変ゼロで保持):

| ファイル | 内容 |
|---------|------|
| `components/chat/ChatPanel.tsx` / `lib/builtin-slash.ts` | `/mcp` slash は `open_mcp_settings` action で `/settings/mcp` へ router.push する実装済 |
| `app/settings/mcp/page.tsx` | Monaco Editor で JSON 直接編集、Global/Project 2 タブ、JSON validation 付き |
| `src-tauri/src/commands/builtin_slash.rs` | `read_mcp_config` / `write_mcp_config` 実装済 (global=`~/.claude.json` の mcpServers section only、project=`<project>/.mcp.json` 全体) |
| `sidecar/src/agent.ts` | SDK options の **`mcpServers` option は未渡し**。SDK default の自動 load (設定ファイル解決) に委ねる状態 |

すなわち **設定編集 UI と `/mcp` slash は完成済** で、不足していたのは:

1. Discovery (一覧可視化) — **本 MVP で追加**
2. Live status (`mcpServerStatus()` 連携) — **Phase 2 申し送り**
3. Toggle / Add / Remove UI — **Phase 3 申し送り**

---

## 採用 Case と実装内容

### Case 判定: Case A (MVP) + 申し送り Case B (v1.5+)

- **Case A = 高実装可能性**: 設定ファイル格納先 / format は公式で確定、plugins.rs の既存パターン完全流用可能
- **Case B = 高実装可能性だが Phase 2**: SDK `mcpServerStatus()` あり。ただし sidecar ⇔ frontend 間の event 配線 + 更新タイミング設計が必要で工数大 → MVP では載せない
- **Case C = 不採用**: ccmux-ide-gui が「Cursor 上の Claude Code 体験を提供する」ことを目指す以上、MCP を完全 black-box にするのは価値低下

### 4.1 追加ファイル

#### `src-tauri/src/commands/mcp.rs` (新規、521 行)

5 スコープを統合走査して `Vec<McpServerDef>` を返す Tauri command `list_mcp_servers(project_path)` を実装。主要点:

- **走査順**: global → user → plugin → user-project → project の順で `BTreeMap<name, McpServerDef>` に insert (後勝ち = 近いスコープが override)
- **並び順**: enabled 優先 → scope_rank (`project` < `user-project` < `plugin` < `user` < `global`) → name ASC
- **fail-open**: ファイル不在 / JSON 不正は致命的ではなく当該 scope を空扱いして継続
- **secret 漏洩防止**: `env` は **key 名のみ返す** (値は shape にすら含めない → `env_keys: Vec<String>`)
- **settings.json 誤認防止**: `allow_top_level_fallback: bool` パラメータで、`settings.json` のような `permissions`/`enabledPlugins`/`language` 等の他 top-level key を mcpServers と誤認するバグを回避 (初版で実地テスト失敗 → 修正)
- **Windows/Unix path 正規化**: `~/.claude.json` の `projects` key は forward/back slash 両方で登録されうるので 3 パターン lookup
- **plugin disable marker 対応**: `disabledMcpServers` 中の `plugin:<short>:<server>` 形式に対応

#### テスト: 13 件

- classify_server (stdio/http/sse/unknown 判別)
- parse_mcp_section (env key extraction、secret 値は含まれない)
- scan_settings_json (nested format / fallback flag / 非 mcpServers key 誤認防止)
- scan_claude_json_top_level (user scope のみ拾う)
- scan_user_project_mcp (project key lookup)
- read_project_meta (disabledMcpServers / disabledMcpjsonServers 抽出)
- scan_plugin_mcp (plugin enabled + disable marker の組合せ 3 ケース)
- **all_scope_helpers_integrate_consistently** — `scan_all()` 直呼びではなく一段下の helper 群で 5 scope を積み上げる integration test (`dirs::home_dir()` の Windows override 不可問題を回避するため、初版 HOME 書換え test を helper 呼出に書き換え)
- scope_rank / list_mcp_servers (fail-open) / normalize_project_lookup_keys

**結果**: 13/13 pass。lib 全体で 138/138 pass (既存テスト破壊ゼロ)。

### 4.2 編集ファイル

#### `src-tauri/src/commands/mod.rs`

`pub mod mcp;` を末尾 append (既存 chunk 衝突回避ポリシーに準拠)。PM-953/PM-954 と同じコメント style。

#### `src-tauri/src/lib.rs`

- `use commands::{ mcp::list_mcp_servers, ... }` を追加
- `invoke_handler![ ..., list_mcp_servers, ... ]` に登録

#### `lib/types.ts`

`McpServerDef` interface を追加 (Rust struct と 1:1)。scope は `"global" | "user" | "user-project" | "plugin" | "project"` の union literal で frontend 側も型安全。

#### `components/palette/SlashPalette.tsx`

既存の plugin section と同パターンで:

- `lucide-react` から `Plug` icon を追加 import
- `SlashSource` union に `"mcp"` 追加
- `SOURCE_META.mcp` 追加 (emerald accent + 見出し「MCP サーバ (Model Context Protocol)」)
- `SCOPE_ORDER` に `mcp` 挿入 (plugin の次)
- `MCP_SCOPE_LABEL` 日本語ラベル map
- `McpItem` interface + `PaletteItem` union に包含
- `mcpServers` state + fetch useEffect (activeProjectPath ごとに invalidate)
- merge / group / overflow 計算に `mcp` 配列を参加
- `handleMcpClick` — 選択時に `configPath` を Monaco で open + toast で scope/transport/enabled/接続先を案内 (Phase 1 = 実行しない、表示のみ)
- matchesQuery / cmdkValue に transport / originalScope / pluginId を追加 (fuzzy search 拡張)
- PaletteRow に icon (Plug) / nameColor (emerald) / disabled dimm ルール追加

---

## 検証結果 (全合格)

| 検証 | コマンド | 結果 |
|-----|---------|------|
| Rust 型チェック | `cargo check --lib` | 0 error (pre-existing warnings 3 件のみ) |
| Rust 単体テスト | `cargo test --lib commands::mcp::` | 13/13 pass |
| Rust 全体回帰 | `cargo test --lib` | 138/138 pass (既存 125 + 新規 13) |
| TypeScript 型チェック | `npx tsc --noEmit` | 0 error |
| Next.js production build | `npx next build` | `Compiled successfully in 11.9s` + static export 成功 |

lint warning は StatusBar.tsx / AppearanceSettings.tsx / FilePreviewDialog.tsx / ProjectTree.tsx の **PM-955 範囲外の pre-existing** のみ (本 Round 無関連)。

---

## UX 挙動 (実装済)

1. Chat 入力欄で `/` と打つと SlashPalette popup が開く
2. 従来の「組込 / スキル / プラグイン / スラッシュ (cwd/project/global)」の **間に "MCP サーバ (Model Context Protocol)" section が emerald accent で出る**
3. 各 MCP 行は `Plug` icon + name + 1 行 description (transport · scope · 接続先 · plugin ID?) + `mcp` badge
4. disabled の server は opacity 60% + "disabled" 小バッジ (既存 plugin と同 UI)
5. 選択クリックで **設定ファイル (config_path) が Monaco Editor で開く** + toast で状態サマリ
6. fuzzy search は name / description / transport / scope / pluginId 全対象

## Phase 2+ 申し送り

### Phase 2 (v1.5+): Live status 表示 = Case B

**目的**: 接続失敗 / OAuth 要求 / tool 総数をユーザに即時可視化。

**実装方針**:
- sidecar (`sidecar/src/index.ts`) に `mcp_status_request` / `mcp_status_snapshot` の outbound event を追加
- `query.mcpServerStatus()` を一定間隔 (例: 30s) or 初回 init 完了直後に実行、結果を frontend に push
- frontend で `McpItem.liveStatus?: 'connected' | 'failed' | 'needs-auth' | 'pending' | 'disabled'` と `toolCount?: number` を optional 拡張
- SlashPalette 行末に small dot indicator (緑=connected / 赤=failed / 橙=needs-auth / 灰=pending)
- StatusBar に総 tool 数 pill を追加する案もあり (Cursor の右下表示に準拠)

**API 流用**:
- `query.mcpServerStatus()` (query.ts) → async iteration の control 経路で呼べる (他 `supportedModels()` / `supportedAgents()` と同じ control API)

### Phase 3 (v1.6+): Add / Remove / Toggle UI = Case B 拡張

**目的**: `~/.claude.json` / `<project>/.mcp.json` を直接 JSON 編集せず UI で管理。

**実装方針**:
- `app/settings/mcp/page.tsx` に「現在の MCP server 一覧」card を追加 (PM-955 でも list API があるので簡単)
- 各行に toggle switch → Rust `update_mcp_server_enabled(scope, name, enabled)` → `~/.claude.json` の `disabledMcpServers` / `disabledMcpjsonServers` or `enabledPlugins` を書換
- 「Add Server」button → transport 選択 dialog (stdio / sse / http) + field 入力 → `<project>/.mcp.json` に merge 保存
- 削除は行末の ゴミ箱 icon
- Sidecar 接続済 session 中は `query.setMcpServers(...)` で即時反映 (reload 不要)

### Phase 3 補足: Elicitation Hook

SDK には `HookInput.type === "Elicitation"` が存在し、OAuth 認証等のユーザ入力要求が MCP server から来た場合 hook で intercept 可能。aidesigner のような OAuth 必須 server が新規追加されるケースのために、Phase 3 では `mcp-elicitation` dialog を用意して UI で応答させる経路も用意する。

### Phase 3 補足: Hot reload

`query.reconnectMcpServer(name)` を「更新」メニューに露出。現状 CLI 再起動が必要な MCP server の認証情報更新などがワンクリックで済む。

---

## Diff 規模

- 新規: `src-tauri/src/commands/mcp.rs` (521 行、うちテスト 218 行)
- 編集: `src-tauri/src/commands/mod.rs` (+16 行コメント含む)
- 編集: `src-tauri/src/lib.rs` (+7 行)
- 編集: `lib/types.ts` (+55 行)
- 編集: `components/palette/SlashPalette.tsx` (+147 行)
- **合計**: 新規 1 + 編集 4、実行テスト 13 追加、既存テスト破壊ゼロ

既存 architecture / data flow への影響なし。plugins.rs / skills.rs のパターンを完全踏襲しており、拡張性 (Phase 2/3) の余地を仕様書どおり残している。

---

## 完了条件チェック

- [x] Claude Code MCP 公式仕様調査 (5 scope / transport / disable lists)
- [x] SDK サポート確認 (`mcpServerStatus` / `setMcpServers` / `toggleMcpServer` 全 first-class 確認)
- [x] オーナー環境の実稼働 MCP server 認識状況 (global 2 件 + plugin-bundled vercel + user-project ごとの記録を把握)
- [x] 採用 Case (A = MVP) + 実装内容 記載
- [x] `cargo check` 0 error
- [x] `cargo test` 全 138 pass
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功
- [x] Phase 2+ 申し送り記載 (Live status / Toggle UI / Elicitation / Hot reload)

---

## 主要変更ファイル (absolute path)

- `C:\Users\hiron\Desktop\ccmux-ide-gui\src-tauri\src\commands\mcp.rs` (新規)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\src-tauri\src\commands\mod.rs`
- `C:\Users\hiron\Desktop\ccmux-ide-gui\src-tauri\src\lib.rs`
- `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\types.ts`
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\palette\SlashPalette.tsx`

CEO 報告後、approval を得て v1.4 向け commit + CHANGELOG 追記を進める想定。
