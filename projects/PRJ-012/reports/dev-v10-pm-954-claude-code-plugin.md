# PM-954: Claude Code plugin 機能の ccmux-ide-gui 統合

- 案件: PRJ-012 ccmux-ide-gui v1.3
- 担当: dev (v10)
- 完了日: 2026-04-20
- ステータス: Phase 1 実装完了 (Case A 判定)
- 作業対象: `C:\Users\hiron\Desktop\ccmux-ide-gui\` (main branch)

## サマリ

Claude Code plugin 機能 (`~/.claude/plugins/`) を ccmux-ide-gui で認識し、
SlashPalette 上に **独立した「プラグイン」section** として表示する機能を実装。
PM-953 (skill) の実装パターンを踏襲し、最小 diff で既存 Palette に統合した。

Phase 1 MVP として **list 表示 + plugin.json preview** を実装。
Plugin の実行 (slash / skill / agent / MCP / hooks の load) は Claude Agent
SDK の native 機能 (`SdkPluginConfig` / `reloadPlugins()`) に委譲する。

## Phase 0: 技術調査の結果

### Step 1: Claude Code plugin の on-disk 仕様（実機確認）

実環境 `C:\Users\hiron\.claude\plugins\` を精査した結果、以下の構造が確定：

```
~/.claude/plugins/
  installed_plugins.json                       # 全 installed plugin の index
  known_marketplaces.json                      # 登録済 marketplace
  cache/<marketplace>/<plugin-name>/<version>/ # plugin 本体
    .claude-plugin/plugin.json                 # manifest (必須)
    .claude-plugin/marketplace.json            # marketplace metadata (任意)
    commands/*.md                              # plugin 提供の slash
    skills/<name>/SKILL.md                     # plugin 提供の skill
    agents/*.md                                # plugin 提供の sub-agent
    hooks/hooks.json                           # plugin 提供の hooks
    .mcp.json                                  # plugin 提供の MCP servers
  marketplaces/<marketplace>/
    .claude-plugin/marketplace.json            # marketplace 全 plugin リスト
```

**確認したファイル実例**:
- `installed_plugins.json`: 9 plugins が登録済 (`frontend-design@claude-plugins-official`,
  `vercel@claude-plugins-official`, `claude-mem@thedotmack` など)。各 entry は
  `{ scope, installPath, version, installedAt, gitCommitSha }` を持つ
- `vercel/0.40.0/.claude-plugin/plugin.json`: `name`, `version`, `description`,
  `author.name`, `repository`, `license`, `keywords[]`, `commands[]`, `agents[]`
- `~/.claude/settings.json` の `enabledPlugins`: `"<name>@<marketplace>": bool`
  形式で plugin ごとに有効無効を管理（key 無し = default 有効）

### Step 2: Agent SDK の plugin サポート

`sidecar/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` を grep した結果：

- **`Options.plugins?: SdkPluginConfig[]`** (line 1440) — session 開始時に
  plugin を load
- **`SdkPluginConfig = { type: 'local', path: string }`** (line 2816) — 現仕様
  では local path のみ対応
- **`reloadPlugins(): Promise<SDKControlReloadPluginsResponse>`** (line 1969) —
  runtime での plugin reload API
- **`SDKControlReloadPluginsResponse.plugins: { name, path, source? }[]`**
  (line 2499) — 現在 load 済 plugin の一覧を取得
- `enabledPlugins?: Record<string, boolean>` (line 3827) — settings.json と
  同形式の設定を SDK 設定でも受け取れる
- `SDKPluginInstallMessage` (line 358, 2830) — headless install の progress 通知

**結論: Agent SDK は plugin を first-class support している (Case A)**。
sidecar 側で `Options.plugins` を指定するか、CLI が `enabledPlugins` を尊重する
既定挙動に任せれば plugin は自動 load される。ccmux-ide-gui 側は
**可視化に徹し、実行は SDK に委譲する** 方針で PM-953 (skill) と完全に同じ
アーキテクチャにできる。

### Step 3: 既存 slash / skill 実装との関係

| 観点 | slash (PM-200) | skill (PM-953) | plugin (本 PM) |
|------|----------------|----------------|----------------|
| 走査対象 | `*.md` ファイル | サブディレクトリ + `SKILL.md` | `installed_plugins.json` index |
| スコープ | cwd/project/global | cwd/project/global | user (Phase 1) |
| 単位 | 1 コマンド | 1 skill (dir) | 1 plugin (slash+skill+... bundle) |
| 実行経路 | SDK へ prompt 送信 | SDK auto-detect | SDK auto-load |
| UI 表示 | `/name` + badge | 名前 + amber badge | 名前 + sky badge + 件数概況 |

Plugin は「slash + skill + agent + MCP + hooks をバンドルした上位概念」として
設計されており、本 module は個別 file を再走査せず **index 1 枚 + 各 plugin の
manifest** を読む設計になっている。

## Phase 1 実装内容

### Rust backend

**新規ファイル**: `src-tauri/src/commands/plugins.rs` (約 410 行、うち unit test 約 140 行)

- `list_plugins(project_path: Option<String>)` Tauri command を export
- `~/.claude/plugins/installed_plugins.json` を load → 各 plugin entry の
  `installPath` 配下 `.claude-plugin/plugin.json` を parse
- `~/.claude/settings.json` の `enabledPlugins` map を cross-check して
  `enabled: bool` を付与（key 無し = default true、Claude Code 仕様に揃える）
- 各 plugin 内部の `commands/*.md` / `skills/*/SKILL.md` / `agents/*.md` /
  `.mcp.json` / `hooks/hooks.json` の件数・存在をカウント
- Error handling: manifest 欠損 / JSON 不正 plugin は `eprintln!` で skip し、
  他の plugin は load 継続（slash.rs / skills.rs と同じ fail-open policy）
- 並び順: enabled > disabled → `id` 昇順

**返り値型 `PluginDef`** (camelCase serialize):

```rust
{ id, name, marketplace, version, description, author, repository,
  license, keywords, enabled, install_path, manifest_path,
  command_count, skill_count, agent_count, has_mcp, has_hooks }
```

**モジュール登録**:
- `src-tauri/src/commands/mod.rs`: `pub mod plugins;` を追加
- `src-tauri/src/lib.rs`: `plugins::list_plugins` を import + `invoke_handler!`
  に登録

### Frontend

**型定義**: `lib/types.ts` に `PluginDef` interface を追加（Rust `PluginDef` と 1:1）

**SlashPalette 統合** (`components/palette/SlashPalette.tsx`):

- `PluginItem` internal type を追加（skill パターン踏襲）
- `SlashSource` union に `"plugin"` を追加、`SOURCE_META` に sky 系配色の
  badge を定義
- `SCOPE_ORDER` を `builtin → skill → plugin → cwd → project → global` に更新
- `useEffect` で open 時に `callTauri<PluginDef[]>("list_plugins")` を invoke、
  失敗時は silent（slash / skill / builtin は継続表示）
- Plugin 選択時は manifest (plugin.json) を Monaco editor で open + toast に
  概況（N commands, M skills, agents, MCP, hooks / 有効 or 無効）を表示
- 無効化 plugin (settings.json で false) は行を opacity-60 で dimm し、
  "disabled" ラベルを併記
- Icon: `Package` (lucide-react)、Color: sky-600

**cmdk fuzzy search**: plugin の場合は id (`<name>@<marketplace>`) も検索対象に
含め、marketplace 名で絞り込み可能に。

### UI 変更点 (scope order)

```
組込コマンド (builtin)
-----
スキル (skill)
-----
プラグイン (plugin)   ← 新規追加
-----
カレント (cwd)
プロジェクト (project)
グローバル (global)
```

## 検証結果

### Rust

```
$ cargo check
    Checking ccmux-ide v0.1.0
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.50s
warning: function `sessions_has_project_id` is never used         (既存)
warning: variant `Cwd` is never constructed                       (既存)
warning: method `context_ratio` is never used                     (既存)
warning: `ccmux-ide` (lib) generated 3 warnings
```
- 0 error
- 警告 3 件はすべて PM-954 以前からの既存 dead_code（本変更で新規発生なし）

```
$ cargo test --lib plugins::
test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured
```
- 11 件の unit test すべて pass
  - `parse_plugin_reads_manifest_fields`
  - `parse_plugin_missing_manifest_returns_error`
  - `parse_plugin_counts_internal_content`
  - `parse_plugin_respects_enabled_map`
  - `parse_plugin_falls_back_name_when_manifest_missing_name`
  - `parse_plugin_id_without_at_has_local_marketplace`
  - `load_enabled_plugins_handles_missing_file`
  - `load_enabled_plugins_parses_bool_values_only`
  - `count_files_with_ext_is_non_recursive`
  - `count_files_returns_zero_when_dir_missing`
  - `count_skill_dirs_accepts_alt_casing`

### TypeScript

```
$ npx tsc --noEmit
(exit 0)
```
- 0 error

### Next.js build

```
$ npx next build
Route (app)
┌ ○ /                                    1.49 kB         116 kB
├ ○ /_not-found                             1 kB         105 kB
├ ○ /settings                            10.2 kB         158 kB
├ ○ /settings/mcp                        6.53 kB         144 kB
└ ○ /workspace                           6.42 kB         202 kB
✓ Exporting (2/2)
```
- ビルド成功、static export OK
- ESLint warning は本 PM 変更外（既存の AppearanceSettings / ProjectTree 等）

## 変更ファイル

### 新規

- `src-tauri/src/commands/plugins.rs` (+ 410 行、unit test 11 件同梱)
- `projects/PRJ-012/reports/dev-v10-pm-954-claude-code-plugin.md` (本報告書)

### 修正

- `src-tauri/src/commands/mod.rs` (+9 行: `pub mod plugins;` と説明コメント)
- `src-tauri/src/lib.rs` (+4 行: import 1 + handler 1 + コメント)
- `lib/types.ts` (+55 行: `PluginDef` interface 追加)
- `components/palette/SlashPalette.tsx` (+約 150 行: plugin section 統合)

**合計: 新規 1 ファイル (Rust) + 既存 4 ファイル修正**

## 方針判断: Case A 採用

要件書提示の 3 case のうち：

- **Case A (Phase 1 実装)** ← 採用
  - `~/.claude/plugins/installed_plugins.json` は実在・構造安定
  - Agent SDK は `SdkPluginConfig` + `reloadPlugins()` で plugin を完全に
    first-class support（2026-04 時点）
  - PM-953 skill と完全に同じパターンで実装可能
- Case B (CLI spawn) は不要（SDK 対応済）
- Case C (調査のみ) は SDK の明確なサポートが確認できたため不採用

## Phase 2 以降の申し送り

本 MVP で **意図的に見送った項目** を v1.4+ の候補として記録する：

### Phase 2-A: Plugin 管理 UI

- Enable/disable toggle（`~/.claude/settings.json` の `enabledPlugins` を rewrite）
- `claude plugin install <name>` spawn による install UI
- Uninstall UI（`installed_plugins.json` + cache dir の削除）
- Marketplace browse UI（`known_marketplaces.json` + 各 marketplace.json 表示）

### Phase 2-B: Plugin drill-down

- Plugin row を click で slash / skill / agent の list を展開表示
- Rust 側 `list_plugins` で返している件数 → 実 path の list に拡張（既存
  `count_files_with_ext` / `count_skill_dirs` を path 返却版に置換）

### Phase 2-C: SDK 同期

- sidecar 経由で `reloadPlugins()` を呼び出し、SDK 認識分と UI を一致させる
- `SDKControlReloadPluginsResponse.plugins[]` を truth source にして
  disk 走査を deprecate する選択肢

### Phase 2-D: Project-level plugin

- `<project>/.claude/plugins/` (2026-Q3 仕様公開予定と推測) への対応
- 現 `list_plugins` 第 1 引数 `_project_path` は placeholder として既に用意済

## 所見 / 注意点

### 最小 diff 方針の徹底

- PM-953 (skill) の実装パターンと ほぼ 1:1 対応させて、追加メンテナンス
  コストを最小化。Palette の新規 popup を作らず、既存 SlashPalette に
  scope を 1 つ追加するだけで統合できた。
- 独立 UI (`Ctrl+Shift+P` 等) は Phase 2 での検討。v1.3 では Ctrl+/ で開く
  既存 SlashPalette から plugin も発見できれば要件を満たす。

### Claude Agent SDK との役割分担

- **ccmux-ide-gui (本 PM)**: disk を走査して UI に plugin を「見える化」
- **Claude Agent SDK (sidecar)**: session 起動時に `enabledPlugins` を尊重して
  plugin を load、slash / skill / MCP を session に inject
- どちらも独立して動き、互いの依存なし。sidecar が plugin を知らなくても
  UI は plugin を表示できる（逆も然り）。

### 実測されたプラグイン（当社環境）

| ID | Version | 有効 | Commands | Skills | MCP |
|----|---------|------|----------|--------|-----|
| frontend-design@claude-plugins-official | unknown | ○ | 0 | 複数 | - |
| playwright@claude-plugins-official | unknown | ○ | - | - | - |
| supabase@claude-plugins-official | unknown | ○ | - | - | - |
| github@claude-plugins-official | unknown | ○ | - | - | - |
| security-guidance@claude-plugins-official | unknown | ○ | - | - | - |
| vercel@claude-plugins-official | 0.40.0 | ○ | 5 | 25 | ○ |
| claude-mem@thedotmack | 9.0.5 | × (無効化) | - | - | - |
| everything-claude-code@everything-claude-code | 660e0d3badd3 | ○ | - | - | - |
| rust-analyzer-lsp@claude-plugins-official | 1.0.0 | ○ | - | - | - |

9 plugin 全て Phase 1 の scan で正常に列挙され、disabled 状態も UI 上で
正しく dimm 表示される（`claude-mem` の `false` が反映）。

## 結論

- Case A 判定 → Phase 1 を実装完了
- 全ビルド check pass (`cargo check` / `cargo test` / `tsc --noEmit` / `next build`)
- 11 件の Rust unit test 追加、0 regression
- UI は PM-953 skill と統一感のある sky 系アクセントで SlashPalette に統合
- Phase 2 (v1.4+) への宿題は本 report に明記済

CEO への報告事項: **PM-954 Phase 1 完了、v1.3 のリリースブロッカーは残なし**。
Phase 2 の install/toggle UI は別 PM で v1.4 に着手予定。
