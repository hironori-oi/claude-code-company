# PRJ-012 Codex 統合の徹底調査と提案

- **作成日**: 2026-05-01
- **担当**: 開発部門（シニアアーキテクト兼リサーチャー）
- **対象案件**: PRJ-012 sumi（Claude Code マルチプロジェクト IDE）
- **対象バージョン候補**: v1.42.x 〜 v2.0.0（DEC-081 想定）
- **位置づけ**: **調査・提案のみ**。コードへの変更は一切なし。

---

## 0. TL;DR（CEO 用、5〜10 行）

1. **Codex CLI は 2026-05 時点で本番品質。** ChatGPT Plus / Pro / Business / Enterprise の **サブスク認証で API 課金不要**で使える（Plus は 5 時間あたり GPT-5.5 で 15〜80 メッセージ）。インストールは npm / brew / バイナリ。Apache-2.0、Rust 製。
2. **Codex には公式の `codex app-server`（JSON-RPC 2.0 over stdio / WebSocket / Unix socket）が存在する。** これは Sumi の sidecar アーキテクチャと **ほぼ同じ思想** で、OpenAI 自身が IDE 統合を想定して用意した API。
3. **Codex は MCP サーバとしても起動可能（`codex mcp-server`）** で、`codex` / `codex-reply` の 2 tool を露出する。Claude Code 内で `mcp__codex__codex` として呼べる。
4. **`.md` 管理は AGENTS.md を中心化する** のが業界標準（Linux Foundation / AAIF が governance、Codex / Cursor / Copilot / Aider / Devin が native 対応）。Claude Code はまだ AGENTS.md を native 認識しないが、**`CLAUDE.md` が「AGENTS.md を読め」と参照する 2 行戦略**で実用上ほぼ DRY 化できる。
5. **個人開発者が自分のサブスクを自分のツールで使うのは Anthropic / OpenAI ともに OK。** ただし「他人のアカウントを Sumi 経由で代理リクエストする SaaS」は Anthropic ToS 違反。Sumi の「ローカル個人ツール」位置づけは安全。
6. **推奨統合パス**: **案 A+C のハイブリッド** —— Codex も sidecar として並走（engine = `claude` / `codex` を pane 単位で選択）+ Codex MCP server を Claude sidecar から呼べるオプションを提供。Codex 側は **公式 `codex app-server` を JSON-RPC で叩く**（独自 NDJSON ラッパは作らない）。**規模 L、3 段階（v1.42 / v1.44 / v2.0）でリリース**。
7. **重大リスク**: ChatGPT サブスクの Codex 利用枠は変動中。Anthropic が「Sumi のような第三者 IDE」への OAuth を将来締めるリスクあり（API key fallback 必須）。Windows ネイティブ Codex は experimental（WSL2 が安定）。

---

## 1. Codex の正体と現状（2026 年時点）

### 1.1 Codex CLI の仕様

| 項目 | 内容 | 出典 |
|---|---|---|
| リポジトリ | https://github.com/openai/codex | [openai/codex](https://github.com/openai/codex) |
| 言語 | Rust（`codex-rs/`）+ npm 配布のラッパ（`@openai/codex`） | install.md |
| ライセンス | **Apache-2.0** | README |
| インストール | `npm i -g @openai/codex` / `brew install --cask codex` / GitHub Releases バイナリ（DotSlash） | install docs |
| 対応 OS | macOS 12+ / Ubuntu 20.04+ / Debian 10+ / **Windows 11 (WSL2 が安定、ネイティブは experimental)** | install.md |
| 最新版 | (バージョン番号は docs に固定記述なし、リリースは継続的) | Releases |
| 配布形態 | CLI / IDE Extension (VS Code, Cursor, Windsurf) / Desktop (Microsoft Store) | developers.openai.com |

**重要**: Sumi はオーナー環境 = Windows 11 WSL2 (Ubuntu 24.04) を使っているため、**WSL2 環境で codex を動かすパスが第一候補**。Sumi の sidecar も Linux ELF を使っているので相性良し。Windows ネイティブの codex.exe は AppContainer sandbox 付きで進化中だが「experimental」扱い、当面は WSL2 を主路線にする。

### 1.2 認証方式

Codex CLI は **2 系統** の認証を持つ:

1. **Sign in with ChatGPT (OAuth)** ←— **本案件の主戦場**
   - ローカルに HTTP コールバックサーバを `localhost:1455` で立てる
   - 既定ブラウザで OAuth フロー → access token + refresh token を受領
   - `~/.codex/auth.json` または OS keychain に保管（`cli_auth_credentials_store = "auto" | "keyring" | "file"`）
   - **トークンは自動 refresh**。アクティブな期間は再ログイン不要
   - ヘッドレスは `codex login --device-auth`（device code flow / Beta）
2. **API key**
   - `OPENAI_API_KEY` 環境変数 / `codex login --api-key ...`
   - ChatGPT サブスクが未契約 / CI 等で従量課金したいケース

両者の切替は管理者制約も可能（`forced_login_method = "chatgpt"|"api"`）。

出典: [Authentication – Codex](https://developers.openai.com/codex/auth) / [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)

### 1.3 サブスクプランと Codex CLI の関係

**結論: ChatGPT Plus / Pro / Business / Enterprise / Edu に契約していれば、Codex CLI は追加課金なしで使える**（API 課金には切り替わらない）。

| プラン | 月額 | 5 時間ウィンドウあたりの GPT-5.5 メッセージ | Cloud Tasks | 備考 |
|---|---|---|---|---|
| Plus | $20 | **15〜80** | × | 個人標準。Sumi のオーナーがここなら最適コスパ |
| Pro (5x) | $100 | **80〜400**（5x〜20x boost）2026-05-31 まで 2x boost 中 | × | ヘビーユーザ向け |
| Business | 従量 | Plus 同等の base + シート | （larger VM）| チーム向け |
| Enterprise / Edu | 個別 | レート制限なし、credits ベース | ◯ | カスタム |

- 上限超過時: 追加 credits 購入 / モデル降格 (gpt-5.4-mini 等) / API key fallback
- 画像生成は **3〜5x** 早く credits を消費
- API key 経路の単価（参考、2026-05 時点）:
  - GPT-5.5: 125 in / 750 out credits per 1M tokens
  - GPT-5.4: 62.50 in / 375 out
  - GPT-5.4-mini: 18.75 in / 113 out

出典: [Pricing – Codex](https://developers.openai.com/codex/pricing)

**Sumi の経済性的にどうか**: オーナーは ChatGPT Plus 契約を前提とすれば、**追加コスト $0** で Codex を Sumi に統合できる。Claude Code は Pro/Max でも同様の OAuth 経路。**両方持っていれば月 $40 ($20 + $20 Pro 相当)** で Sumi が両 AI ユーザになれる。これは Cursor の月額 $20 + 内部 API 経由よりむしろ柔軟。

### 1.4 対応モデル / rate limit

Codex CLI が選択できるモデル（2026-05 時点）:

- `gpt-5.5`（最新フラッグシップ、5 時間枠制限が厳しい）
- `gpt-5.4`, `gpt-5.4-mini`（API key 経路でも使える）
- `gpt-5.3-codex`, `gpt-5.3-codex-spark`（コーディング特化）
- ローカル実行は `--oss` で Ollama 連携可能

`--model` フラグ / `~/.codex/config.toml` で固定可能。

### 1.5 Sandbox / 権限モデル

Codex は **3 段階 sandbox** を持つ（Sumi の `--allowed-tools` / Claude Code の permission mode と類似）:

| モード | 内容 |
|---|---|
| `read-only` | 閲覧のみ、書込・コマンド実行不可 |
| `workspace-write` | **既定**。working dir 配下のみ書込可 |
| `danger-full-access` | sandbox なし（VM 内推奨） |

OS レベルでは macOS=Seatbelt / Linux=Landlock / Windows=AppContainer を使う。**Sumi 側で「engine 別に sandbox 既定値を持つ」設計が望ましい**。

承認モードは `untrusted | on-request | never` の 3 値で `--ask-for-approval` で切替。

出典: [CLI features](https://developers.openai.com/codex/cli/features) / [Inside the Agent Harness](https://medium.com/jonathans-musings/inside-the-agent-harness-how-codex-and-claude-code-actually-work-63593e26c176)

### 1.6 MCP / hook / subagent の有無

| 機能 | Codex | Claude Code | 備考 |
|---|---|---|---|
| **MCP client (= MCP server を呼ぶ)** | ◯ STDIO + HTTP | ◯ STDIO + HTTP | 設定先: `~/.codex/config.toml` vs `~/.claude/.mcp.json` |
| **MCP server (= 自分が server になる)** | ◯ `codex mcp-server` | ◯ Claude Code Plugin 経由 | **両方が両方を MCP tool として呼べる** |
| **Subagent** | ◯ TOML in `~/.codex/agents/` (model / mcp / sandbox 単位で隔離) | ◯ Markdown frontmatter in `.claude/agents/` | 概念はほぼ同じ |
| **Hook** | (PreToolUse 相当の `tool_suggest.disabled_tools` あり、明示 hook 体系は薄い) | ◯ 12 ライフサイクル事象 (PreToolUse / PostToolUse / Stop / etc.) | Claude Code の方が hook は強い |
| **Slash command** | ◯ `/review`, `/permissions`, `/fork`, `/side`, `/agent` | ◯ カスタムも可 | |
| **Skills (内蔵 prompt)** | ◯ `skills.config` | ◯ `.claude/skills/` | |
| **Plugins** | △ (`tool_suggest.disabled_tools` で plugin/connector 単位制御) | ◯ `~/.claude/plugins/` | |

出典: [Codex MCP](https://developers.openai.com/codex/mcp) / [Codex Subagents](https://developers.openai.com/codex/subagents) / [Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents)

### 1.7 streaming プロトコル / resume

Codex の出力は **JSONL (NDJSON) ストリーム** で、`codex exec --json` および app-server で同じスキーマ。

**Event types**: `thread.started`, `turn.started`, `turn.completed`, `turn.failed`, `item.started`, `item.updated`, `item.completed`, `error`

**Item types**: `assistant_message`, `reasoning`, `command_execution`, `file_change`, `mcp_tool_call`, `web_search`, `plan_update`

**Resume**: `codex resume [SESSION_ID]` / `codex resume --last`、app-server では `thread/resume` メソッド。

これは **Sumi の現在の sidecar→frontend NDJSON プロトコル（`{type: "message"|"tool_use"|"tool_result"|...}`) と概念的に同型**。マッピングレイヤを 1 枚噛ませれば既存 UI でほぼそのまま流せる。

### 1.8 公式 SDK の有無

- **`codex app-server`** が **公式 IDE 統合 API**（Codex Desktop / VS Code Extension がこれを使う）
  - JSON-RPC 2.0 over stdio / WebSocket / Unix socket
  - 「サーバを起動してクライアントが接続する」形式
  - WebSocket 認証は capability-token / signed-bearer-token
- TypeScript / Python 公式 SDK は「使い慣れた方を選んでね」で、`@openai/agents-js` (Agents SDK) 経由でも Codex を起動できる
- Elixir 等のサードパーティ SDK もある (`codex_sdk` Hex package)

出典: [App Server](https://developers.openai.com/codex/app-server) / [Use Codex with Agents SDK](https://developers.openai.com/codex/guides/agents-sdk)

**結論**: Sumi が **Codex の公式 IDE 統合パスに乗る = `codex app-server` を JSON-RPC で叩く** のが最も筋が良い。CLI 出力の NDJSON を独自 parse する案より遥かに安定。

---

## 2. .md ファイル管理体系

### 2.1 各ツールの現状

| ツール | native 読み込みファイル | フォールバック | 備考 |
|---|---|---|---|
| **Claude Code** | `CLAUDE.md` (`~/.claude/CLAUDE.md` → repo root → 各ディレクトリ) | **AGENTS.md は native 不読み**（issue #34235 オープン中） | ユーザ要望多い |
| **Codex CLI** | `AGENTS.md` (`~/.codex/AGENTS.md` → git root → 各ディレクトリ)。`AGENTS.override.md` で local 上書き | `project_doc_fallback_filenames` で他名指定可 | size 既定 32〜64 KiB |
| **Cursor** | `.cursor/rules/*.mdc` (scoped) | `.cursorrules` (legacy)、`AGENTS.md` も読む | Always On / Auto Attached / Manual |
| **GitHub Copilot** | `.github/copilot-instructions.md` + `.github/instructions/*.instructions.md` (glob) | なし | |
| **Windsurf** | `.windsurf/rules/*.md` | `.windsurfrules` | 6000 char/file, 12000 total |
| **Gemini CLI** | `GEMINI.md` | `~/.gemini/` 階層 | |

### 2.2 業界の標準化トレンド

- **AGENTS.md** が **Linux Foundation / Agentic AI Foundation (AAIF)** 配下で governance されており、OpenAI / Cursor / Google / Amp / Factory が共同で推進。
- **MCP も同 AAIF 配下**（Anthropic が donate）。**MCP = ツール呼び出し標準, AGENTS.md = 指示文書標準** の双柱で多 AI 時代を支える設計。
- 60,000+ OSS リポジトリが AGENTS.md を採用済み（agents.md 公式調べ）。
- Claude Code は **2026-05 時点でまだ native 不対応**（要望増加中、issue #34235）。

出典: [agents.md/](https://agents.md/) / [How to Build Your AGENTS.md (2026)](https://www.augmentcode.com/guides/how-to-build-agents-md) / [Anthropic feature request #34235](https://github.com/anthropics/claude-code/issues/34235)

### 2.3 Sumi 上の推奨ファイル構成

#### Sumi が開く各 user project（例: PRJ-???? のソースコードリポジトリ）の構成

```
your-project/
├── AGENTS.md                       # ★ Single source of truth (両 AI が読む)
├── AGENTS.override.md              # 個人別ローカル上書き (gitignore 推奨)
├── CLAUDE.md                       # ★ 2 行で AGENTS.md を参照 + Claude 限定の例外
├── .codex/
│   ├── config.toml                 # project-scoped Codex 設定 (model / sandbox / mcp)
│   └── agents/                     # project subagents (reviewer / mapper など)
├── .claude/
│   ├── agents/                     # Claude Code subagents (frontmatter 形式)
│   ├── skills/                     # Skills
│   └── settings.json               # hooks / permissions
└── .sumi/                          # ★ Sumi 独自設定
    ├── workspace.json              # pane / session / engine 既定値
    └── engine-routing.toml         # task 種別 → engine ルール (後述)
```

**`CLAUDE.md` の 2 行戦略**（公式 fallback がないため）:

```markdown
# Project Instructions for Claude Code

This project uses AGENTS.md as the canonical instruction file.
**Read AGENTS.md first**, then return here for Claude-specific overrides.

## Claude-only overrides

(空でも良い。Claude にしか効かない指示があるときのみ追記。例: subagent 限定の話、specific tool restriction)
```

これで **AGENTS.md = 共通真実, CLAUDE.md = 差分のみ** の DRY を達成。

#### Sumi 自身の repository (PRJ-012) の構成

```
projects/PRJ-012/app/ccmux-ide-gui/
├── AGENTS.md                       # PRJ-012 開発規約 (新設) ★
├── CLAUDE.md                       # → AGENTS.md 参照 + Sumi 開発時の Claude 限定指針
├── .codex/agents/                  # Sumi 自身の dev workflow 用 subagents
│   ├── reviewer.toml
│   ├── ui-debugger.toml
│   └── tauri-rust-fixer.toml
└── .claude/agents/                 # 既存
```

組織レベル (claude-code-company) では:

```
claude-code-company/
├── CLAUDE.md                       # ★ 既存 (組織標準)
├── AGENTS.md                       # ★ 新設、CLAUDE.md と同等内容のシンボリックフロー
└── organization/rules/             # 既存ルール群
```

組織側は急がず Phase 2 で AGENTS.md を追加すれば良い。

### 2.4 重複回避と矛盾検出

- **DRY ルール**: 「両 AI が共通で守る話 = AGENTS.md」「片方しか守れない / 守らせたい話 = 各専用ファイル」。例えば「Claude Code の subagent 設計は CLAUDE.md (or `.claude/agents/`) に書く」「Codex の sandbox profile は `.codex/config.toml` に書く」。
- **矛盾検出**: Sumi に linter ツールを将来内蔵（v2.x 候補）。例: `npm run lint:agents-md` が CLAUDE.md / AGENTS.md / .codex/config.toml を読み、両者が `model` で違う指定をしていたら warning。**Phase 1 では手動運用で十分**。
- **`AGENTS.override.md` を `.gitignore` に登録**するルールを Sumi の project-setup-checklist に追加。

### 2.5 system prompt 合成手順（Sumi が裏で組み立てる）

両 engine への投入順序を **Sumi 側で正規化** する:

```
[Engine: Claude]
  1. Anthropic system prompt (Claude SDK 既定)
  2. ~/.claude/CLAUDE.md (user global)
  3. <repo>/CLAUDE.md  (project)
  4. <repo>/AGENTS.md  (project, fallback)  ← Sumi が手動 inject
  5. user message

[Engine: Codex]
  1. OpenAI system prompt (Codex 既定)
  2. ~/.codex/AGENTS.md (user global)
  3. <repo>/AGENTS.md  (project)
  4. <repo>/.codex/agents/<agent>.toml の developer_instructions
  5. user message
```

**Claude 側の手動 inject は Sumi sidecar が実装すべき**: AGENTS.md を読み、`Options.appendSystemPrompt` 等で Claude SDK に渡す。実装規模 S（既存 sidecar に 1 関数追加）。

---

## 3. アーキテクチャ統合案

### 案 A: Codex Sidecar 並行（Claude と対称設計）

```
┌─────────── Tauri (Rust) ───────────┐
│  AgentState (既存)                  │
│  ├─ HashMap<sessionId, ClaudeSidecar> │ ← 既存 (Node + claude-agent-sdk)
│  └─ HashMap<sessionId, CodexSidecar>  │ ← 新設
│                                     │
│  Frontend events:                    │
│   agent:{sessionId}:raw   (既存)     │
│   codex:{sessionId}:raw   (新設)     │
└─────────────────────────────────────┘
```

- **Codex Sidecar の中身** = `codex app-server --listen stdio` を子プロセスで起動し、stdin/stdout を JSON-RPC として読み書き。
- Frontend には `engine: "claude" | "codex"` セレクタ。pane 単位で engine を持つ。
- **Pros**:
  - 完全並列、互いに干渉しない
  - 公式 app-server を使うので安定
  - Codex の thread/turn モデルを直接活用 (resume / fork / archive がそのまま使える)
  - sandbox / approval も Codex 公式 ON
- **Cons**:
  - sidecar 数が倍に。ただし lazy spawn で実害は薄い
  - UI 抽象化レイヤ（メッセージ正規化）が必要
  - 8 同時 sidecar 制限を engine 別に持つか共有か検討
- **規模**: M〜L（既存 `agent.rs` を ~700 行追加複製、frontend 抽象化、event prefix 整理）
- **Sumi 既存設計との整合**: ◎ 完全に対称

### 案 B: PTY 経由で Codex CLI 起動（生 TUI）

```
Sumi terminal pane (既存 portable-pty)
   └─ codex (interactive TUI)  ← TUI そのまま表示
```

- Sumi の terminal 機能 (DEC-045) で `codex` コマンドを実行、TUI として表示。
- **Pros**:
  - 実装ほぼゼロ（既存 PTY を呼ぶだけ）
  - Codex の最新機能が即時利用可能
- **Cons**:
  - **Sumi のチャット UI / structured message / tool_use 表示と切れる** ←— 致命的
  - resume / interrupt も TUI のキーバインド頼り
  - Sumi の「Slack 風 rail + session 分離」価値が薄れる
- **規模**: S
- **採否**: 「Codex を試したい人向けの逃げ道」として残す価値はあるが、メイン路線にしない。

### 案 C: MCP Server として Codex を Claude Code 内に組み込む

```
Claude sidecar (既存)
   └─ MCP client が起動時に codex mcp-server を spawn
       └─ codex / codex-reply tool を露出
```

- 設定: `.claude/settings.json` または Sumi 側 MCP install command (DEC-???? 既存) で `codex` MCP を登録。
- **Pros**:
  - 既存 sidecar に 1 行追加で済む（規模 XS）
  - 「Claude Code 内で Codex を呼び出す」要望に **完全直撃**
  - Claude が orchestrator / Codex が specialist という多 AI ワークフロー
- **Cons**:
  - **逆方向 (Codex → Claude) には対応しない**
  - Codex の「フル UI 体験」(Cloud Tasks, Image generation, /review TUI) は Sumi で見えない
  - Codex 側のレート制限を Claude 経由で消費
- **規模**: XS〜S
- **採否**: **必ず実装すべき**。案 A の補完。

### 案 D: 全部のせ (A + B + C のミックス)

- **案 A** で対称統合 + **案 C** で連携 + **案 B** を「逃げ道」として保持
- **Pros**: 最大柔軟性。**ユースケース毎に最適パスを選べる**
- **Cons**: 実装量、テスト面、UI の複雑性。
- **規模**: XL（v2.0 級）
- **採否**: **ロードマップ全体 = 案 D を 3 段階で実現**（後述）

### Sumi 既存コードとの整合性チェック

- `app/ccmux-ide-gui/sidecar/src/agent.ts`: Anthropic claude-agent-sdk wrapper。**変更なしのまま Claude 専用**として残す。
- `app/ccmux-ide-gui/sidecar/src/index.ts`: NDJSON プロトコル handler。**抽象化して engine 共通プロトコルに昇格**（既存メッセージ shape は Claude 専用 raw として保ちつつ、engine 共通正規化レイヤを挟む）。
- `src-tauri/src/commands/agent.rs`: HashMap<sessionId, ...> の構造を **engine ペアに拡張**（または新規 `commands/codex.rs`）。
- イベント prefix: `agent:{sessionId}:*` を保ちつつ、`codex:{sessionId}:*` を追加 or `engine:{engineId}:{sessionId}:*` に統一する案。
- 既存 `MAX_CONCURRENT_SIDECARS = 8` は engine 共有 8 → engine 別 6+6 に再考。

---

## 4. Claude Code 内で Codex を呼び出すベストプラクティス

オーナーの最重要要望。現状把握の結論を先に言うと:

> **MCP server 方式 (= 案 C) が圧倒的本命。実測でも CLI 経由 13 秒 → MCP 経由 3 秒 (4x 高速)。**
> 出典: [Codex CLI + Claude Code: MCP Is 4x Faster Than CLI](https://www.jdhodges.com/blog/codex-cli-claude-code-mcp-speeds-command-line/)

### 4.1 Slash command 方式

```
.claude/commands/codex.md
  → 引数を受けて codex exec --json $ARGUMENTS をシェル実行 → 結果を Claude に貼る
```

- **Pros**: 設定 1 ファイル
- **Cons**: 13s レイテンシ、context 注入が手作業、tool_use の構造化なし
- **採否**: **使わない**（MCP に劣る）

### 4.2 MCP server 方式（**推奨候補**）

#### 設定（`~/.claude.json` または `.claude/settings.json`）

```json
{
  "mcpServers": {
    "codex": {
      "command": "codex",
      "args": ["mcp-server"]
    }
  }
}
```

#### Claude が Codex に依頼する例

```
User: 「この auth 周りのコード、Codex でセキュリティレビューして」
Claude: (内部で mcp__codex__codex tool を呼ぶ)
  arguments = { prompt: "Review src/auth/* for security issues", model: "gpt-5.5", sandbox_mode: "read-only" }
Codex: (バックグラウンドで GPT-5.5 がレビュー → 結果返却)
Claude: 「Codex の指摘 3 件をまとめると...」
```

#### Sumi 側の貢献

- **Sumi の MCP 管理 UI (`commands/mcp_install.rs` 既存)** に「Codex を MCP として登録」ワンクリックボタンを追加。
- 認証 → Sumi 内蔵の OAuth フローで Codex ログイン → `codex mcp-server` を on-demand で起動。
- **規模 XS**: 既存 mcp_install をテンプレ化するだけ。

#### 露出される tool

- `codex`: 1 ターン Codex セッションを実行。引数は Codex の Config struct そのまま (model, sandbox_mode, mcp_servers, etc.)
- `codex-reply`: thread_id を指定してフォローアップ

出典: [Codex MCP](https://developers.openai.com/codex/mcp) / [Claude + Codex CLI Agentic Coding](https://medium.com/@sangho.oh/claude-codex-cli-agentic-coding-a98c83ba043e)

### 4.3 subagent 拡張方式

- Claude Code の subagent は frontmatter で model 指定できるが **Anthropic Claude モデルしか走らない**（2026-05 時点）。
- 「Codex を subagent として」やりたければ、**subagent の中で MCP tool として Codex を呼ぶ** のが現実解。
  ```yaml
  # .claude/agents/codex-reviewer.md
  ---
  name: codex-reviewer
  description: GPT-5.5 によるセカンドオピニオン code review
  tools: ["mcp__codex__codex"]
  ---
  あなたは Codex (GPT-5) を呼び出してコードレビューを依頼するスペシャリストです。
  必ず最初に mcp__codex__codex tool を引数 { prompt, sandbox_mode: "read-only" } で呼び出し、
  得られた指摘を整形してユーザに返してください。
  ```
- **採否**: 案 C の上に乗る薄いレイヤ。Sumi として `.claude/agents/codex-*` テンプレを公式提供する価値あり。

### 4.4 逆方向 (Codex → Claude)

- Codex 側にも MCP client があり、`mcp_servers.claude.command = "claude"` 等を `~/.codex/config.toml` に書けば Claude を tool として呼べる **ただし**:
  - Anthropic は OAuth トークンでの第三者ツール経由を制限する方向（2025-08 ToS 改訂）。
  - **個人開発者が自分のサブスク Token で自分の Sumi の中で叩く** のは OK と Anthropic 公式が明言。
  - Sumi が他人にこの構成をシップする場合は **API Key 経路を既定** にする。
- **実装**: `.codex/config.toml` に MCP として `claude` を登録すればよい。これも Sumi の MCP UI からワンクリック設定する。
- **採否**: v1.44 以降の任意機能として提供。**主路線ではない**（オーナーは Claude が主、Codex が補だから）。

出典: [Anthropic clarifies ban on third-party tool access](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/) / [Anthropic agent SDK confusion](https://thenewstack.io/anthropic-agent-sdk-confusion/)

### 4.5 context handoff（共有メモリ / 引継ぎ）

複数 AI が同じタスクを順に触る際、状態を渡す方法:

1. **AGENTS.md / プロジェクト docs** に最新の TODO / decisions を書く（Sumi のセッション終了時に「wrap-up skill」を発動）
2. **MCP shared memory server**（コミュニティ実装あり）を Sumi 経由で起動
3. **Sumi の `.sumi/handoff.md`** を Sumi 自体が自動生成（v2.0 候補）

**Phase 1 では「AGENTS.md + 手動 wrap-up」で運用、Phase 2 で自動 handoff を Sumi 内蔵**。

出典: [Codex Wrap-up: Claude Code Skill for Session Handoff](https://mcpmarket.com/tools/skills/session-handoff-wrap-up)

### 4.6 使い分けの指針（タスク別 ベンチマーク + 実用評判）

ベンチマーク（2026-04 時点）:

| 評価項目 | Claude Opus 4.7 | GPT-5.5 | 出典 |
|---|---|---|---|
| SWE-bench Pro | **64.3%** | 58.6% | [SWE-Bench 2026](https://localaimaster.com/models/swe-bench-explained-ai-benchmarks) |
| SWE-Bench (verified) | 77.2% | 74.9% | 同上 |
| HumanEval | 96%+（飽和） | 96%+（飽和） | 飽和ベンチで差なし |
| LiveCodeBench | (Mythos Preview > Opus 4.7 > Gemini 3.1 Pro) | (Codex spark 系強い) | [BenchLM.ai](https://benchlm.ai/coding) |
| 100 万トークン context | ◯（Sumi がこのモードで動作中） | △ | |

**実用での使い分け（ベストプラクティス）**:

| タスク | 推奨 | 理由 |
|---|---|---|
| **大規模リファクタ / 複数ファイル相関** | Claude (Opus 4.7) | 1M context、SWE-bench Pro で優位 |
| **長時間 multi-step** | Claude | 既知の autonomous loop 強さ |
| **画像生成 / sprite / banner** | Codex | gpt-image-2 内蔵 |
| **Web 検索を含むリサーチ** | Codex | live web search 既定 ON |
| **Plan レビュー / セカンドオピニオン** | 「Claude → Codex」or 「Codex → Claude」 | **異なる訓練データの目で漏れを発見** |
| **セキュリティレビュー** | Codex で 2nd pass | 同上 (cross-provider review が業界推奨) |
| **scratch / quick prototyping** | Codex spark | gpt-5.3-codex-spark は速い |
| **稟議書 / docstring / 業務文書** | どちらでも | |

出典: [MindStudio: Cross-Provider AI Review](https://www.mindstudio.ai/blog/openai-codex-plugin-claude-code-cross-provider-review)

---

## 5. 認証（ChatGPT サブスク）

### 5.1 Codex CLI の OAuth フロー

```
1. Sumi UI で「Codex にログイン」クリック
2. Sumi が `codex login` を子プロセスで起動 (or 内蔵で OAuth フロー実装)
3. localhost:1455 が立ち、既定ブラウザを開く
4. ユーザが ChatGPT で認証
5. authorization code → access token + refresh token
6. ~/.codex/auth.json or OS keychain に保存 (cli_auth_credentials_store)
7. 以降、自動 refresh
```

**Tauri アプリでの OAuth 受け方の典型パターン**:

- 子プロセスで `codex login` を spawn し、終了 status だけ気にする（**最もシンプル、推奨**）
- カスタム URI scheme (`sumi://oauth/callback`) を Tauri に登録して自前で受け取る（**過剰**）

**結論**: **「`codex login` を Sumi UI から起動するだけ」**で十分。トークンは Codex CLI 側で管理させ、Sumi は触らない。

### 5.2 Sumi 既存 auth 機構との統合

Sumi は現在 Claude OAuth について `~/.claude/.credentials.json` を **claude-agent-sdk が自動検出する** 経路に乗っている (`agent.ts` の冒頭コメント)。**これは Anthropic ToS 上、個人ツール扱いで OK** だが、再配布する際は注意が必要 (Section 8 リスク参照)。

Codex の場合、**Sumi が直接トークンを管理しない方針** が望ましい:

| ベンダー | 認証ストア | Sumi の関わり方 |
|---|---|---|
| Anthropic Claude | `~/.claude/.credentials.json` (CLI 管理) | sidecar から SDK auto-detect |
| OpenAI Codex | `~/.codex/auth.json` or OS keychain | sidecar から `codex` CLI に委譲 |

**統一方針**: **Sumi はトークンに触れず、各ベンダー CLI の管理に任せる**。Sumi UI は「ログイン状態 (logged in / API key / not logged in)」だけ表示。これは ToS リスク最小化の観点でも最適。

### 5.3 token 保管 / refresh

- Codex 側は CLI が refresh
- Claude 側も CLI / SDK が refresh
- Sumi の status bar に「Claude: ◯ logged in / Codex: ◯ logged in」を出す
- 失効時は user に「再ログイン」CTA、`codex login` / `claude login` を呼ぶだけ

**実装規模**: S（status indicator + login launch）

---

## 6. 比較表 (Claude Code vs Codex CLI)

| 項目 | Claude Code | Codex CLI | 備考 |
|---|---|---|---|
| **提供元** | Anthropic | OpenAI | |
| **言語実装** | Node + native binary | Rust (`codex-rs`) | Codex の方が起動軽量 |
| **ライセンス** | プロプライエタリ | Apache-2.0 | Codex は OSS |
| **モデル** | Claude Opus 4.7 / Haiku / Sonnet | GPT-5.5 / 5.4 / codex-spark | |
| **OAuth** | Pro $20 / Max $100〜 | Plus $20 / Pro $100 / Business / Enterprise | 価格帯ほぼ同じ |
| **API key 経路** | ◯ | ◯ | |
| **MCP client** | ◯ | ◯ | 双方向 |
| **MCP server (自身)** | △（Plugin 経由） | ◯ (`codex mcp-server`) | Codex の方が公式・素直 |
| **subagent** | ◯ Markdown frontmatter | ◯ TOML | 概念類似 |
| **hook** | ◎ 12 lifecycle | △ 限定 | Claude が強い |
| **sandbox** | permission mode | read-only / workspace-write / danger-full | 同等 |
| **JSON streaming** | NDJSON (SDK) | NDJSON / JSON-RPC | Codex の app-server が強力 |
| **resume** | session persist | thread/resume | 同等 |
| **画像入力** | ◯ | ◯ | |
| **画像生成** | × | ◯ (gpt-image-2 内蔵) | Codex 優位 |
| **Web 検索内蔵** | △ (要 MCP/tool) | ◯ 既定 ON | Codex 優位 |
| **Cloud Tasks / VM** | × | ◯ (Pro+ 上位プラン) | Codex 優位 |
| **VS Code Extension** | ◯ | ◯ | |
| **公式 IDE Server API** | △（Plugin） | ◎ `codex app-server` JSON-RPC 2.0 | Codex 優位 |
| **AGENTS.md native** | ×（issue オープン中） | ◎ | Codex 優位 |
| **CLAUDE.md native** | ◎ | ×（fallback 設定で読める） | Claude 専用 |
| **Windows ネイティブ** | ◯ | △ experimental | Claude 優位 |
| **大規模 context (1M)** | ◎ | △ | Claude 優位 |

---

## 7. 推奨構成（CEO 向け最終提案）

### 7.1 採択する統合案と理由

**案 A + 案 C のハイブリッド**を 3 段階リリースで実装する。**案 B は採用しない**（PTY で生 TUI を出すと Sumi の構造化 UI 価値が消える）。**案 D は v2.0 で完成**。

#### 採択理由 (3 行)

1. **案 A (Codex sidecar 並行)** は Sumi の Multi-Sidecar Architecture (DEC-033 v3.3) と完全対称で、Codex の公式 `app-server` JSON-RPC を使うため最も保守容易。
2. **案 C (Codex を Claude の MCP として)** は **オーナーの「Claude Code 内で Codex を呼び出す」要望に直撃**、かつ実装規模 XS で即時価値。
3. **両者は補完的**。A で「engine を選ぶ」、C で「Claude が orchestrator / Codex が specialist」、両方使える Sumi が業界一柔軟な個人 IDE になる。

### 7.2 .md 管理体系の確定案

- **Sumi が開く user project 側**: AGENTS.md を真実の源、CLAUDE.md は 2 行参照、`.codex/agents/` & `.claude/agents/` で engine 別の subagent
- **Sumi 自身 (PRJ-012)**: `app/ccmux-ide-gui/AGENTS.md` を新設（`CLAUDE.md` 内容と統合 → CLAUDE.md は AGENTS.md 参照に縮小）
- **claude-code-company 組織側**: AGENTS.md を **後追い** で追加（Phase 2）
- **AGENTS.override.md** を `.gitignore` に登録するルールを `organization/rules/project-setup-checklist.md` に追記

### 7.3 段階リリース計画

#### Phase 1 — v1.42.0 (規模 S) 「Codex MCP 連携 (案 C 先行)」

- 目的: 最小実装で「Claude 内で Codex を呼ぶ」を即実現
- 内容:
  1. Sumi 設定に「Codex MCP を有効化」ボタン (`commands/mcp_install.rs` テンプレ追加)
  2. `~/.claude.json` または project `.claude/settings.json` に `mcpServers.codex` を自動書込
  3. 「Codex にログイン」UI（裏で `codex login` 呼ぶだけ）
  4. status bar に Claude / Codex のログイン状態 (○/×)
  5. AGENTS.md 自動 inject の Sumi 内蔵処理（Claude sidecar 側で `Options.appendSystemPrompt` に AGENTS.md を読んで足す）
- 期間: 2 週間
- DEC: **DEC-081**

#### Phase 2 — v1.44.0 (規模 M) 「Codex sidecar 並行 (案 A コア)」

- 目的: Codex を engine として独立 pane で動かす
- 内容:
  1. `commands/codex.rs` を新設、`codex app-server --listen stdio` を spawn
  2. JSON-RPC 2.0 client 実装（既存 NDJSON とは別レイヤ、初期化 + thread/start + turn/start + 通知 listen）
  3. `engine: "claude" | "codex"` を session に持たせ、pane header に engine 表示
  4. メッセージ正規化レイヤ（Codex `item/agentMessage/delta` → Sumi `message` event）
  5. approval flow を Sumi UI で受ける（既存の permission UI を engine 横断化）
  6. AGENTS.md / `.codex/agents/` を Codex に渡す
- 期間: 4〜6 週間
- DEC: DEC-08?（Phase 1 の続き番号）

#### Phase 3 — v2.0.0 (規模 L) 「engine routing & 双方向 (案 D 完成)」

- 目的: 両 AI の良いとこどりを **自動化**
- 内容:
  1. `.sumi/engine-routing.toml` で「タスク種別 → engine」ルール (例: `image_gen → codex`, `large_refactor → claude`)
  2. 自動 handoff（`.sumi/handoff.md` の自動生成・自動読み込み）
  3. 逆方向: Codex 側の MCP に Claude を登録するワンクリック
  4. Sumi 内蔵の **engine routing UI** (Slack 風 rail と並ぶ engine selector)
  5. Cross-engine review skill (`/codex-review` slash command が Claude 側 / `/claude-review` が Codex 側)
- 期間: 8〜10 週間（v2.0 マイルストン全体の中で）
- DEC: DEC-???（v2.0 ロードマップ確定後）

#### 各 Phase での「捨てる」決断

- **PTY で codex を立ち上げる案 B は実装しない**。Sumi の terminal pane でユーザが手動で `codex` 打つことは妨げないが、Sumi 公式 UI として位置付けない
- **Sumi が自前 OAuth トークンを持つ案は実装しない**（Codex CLI / Claude CLI に管理委譲）
- **AGENTS.md linter は Phase 1 では実装しない**（手動運用）

### 7.4 DEC 番号案

- **DEC-081** = Phase 1 (v1.42.0) Codex MCP 連携 + AGENTS.md 自動 inject

(Phase 2/3 の DEC 番号は Phase 1 完了後の状況で確定)

### 7.5 規模感サマリ

| Phase | Version | 規模 | 期間 | 価値 |
|---|---|---|---|---|
| Phase 1 | v1.42.0 | S | 2 週 | Claude が Codex を即時呼べる |
| Phase 2 | v1.44.0 | M〜L | 4〜6 週 | Codex pane 独立、engine 切替 |
| Phase 3 | v2.0.0 | L | 8〜10 週 | engine routing 自動化、双方向 |

---

## 8. リスク

### 8.1 ChatGPT サブスク仕様変動

- 2026-05-31 まで Pro 5x の 2x boost 中など、レート枠が頻繁に変動
- 将来「Codex CLI が ChatGPT 同梱外し」される可能性は **低いが非ゼロ**（OpenAI が Codex で API ARR を伸ばす戦略を取る場合）
- **ミティゲーション**: Sumi は **API Key fallback を Phase 1 から実装**（`OPENAI_API_KEY` env に対応するだけ）

### 8.2 Codex CLI breaking changes

- まだ若いツール（OSS 化 1 年程度）。app-server の JSON-RPC スキーマは安定方向だが Experimental Method 群が動く
- **ミティゲーション**:
  - `clientInfo.version` で Codex バージョンを取り、不一致時は warning
  - `capabilities.experimentalApi` を有効化したフィールドだけ依存
  - JSON-RPC client を抽象化し、メソッド差を 1 ファイルで吸収
  - **Codex 0.87+ を最小要件**としてドキュメント化

### 8.3 Anthropic / OpenAI の policy 衝突

- **Anthropic**: 2025-08 以降、第三者 IDE が Claude Pro/Max OAuth を「ユーザの代理で」使うのは ToS 違反。**個人が自分の Sumi で自分のトークンを使うのは OK と公式コメント**。
- **OpenAI**: Codex CLI の OAuth は明示的に IDE 拡張用途を許可（VS Code, Cursor, Windsurf, **そして第三者**）。
- **両者を Sumi 内に同居させること自体は禁止されていない**（同一プロセスで叩いてもツール A の B 利用ではない）。
- **ミティゲーション**:
  - Sumi の README / docs で「自分のサブスクで自分のローカルツールとして動かすこと」を明記
  - Sumi を商用 SaaS 化する場合は API Key 経路に必須切替
  - 将来 Anthropic が IDE Plugin Program 等を出したら参加

出典: [Anthropic agent SDK confusion](https://thenewstack.io/anthropic-agent-sdk-confusion/) / [Anthropic clarifies ban](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/)

### 8.4 個人開発者の維持負荷

- 2 つの SDK / CLI を追跡するコスト（リリースノート購読 + monthly テスト）
- **ミティゲーション**:
  - Phase 1 を最小に絞り、まずは Codex MCP 連携だけ。動かなくなっても影響範囲が小さい
  - Phase 2 以降は時間に余裕があるときに進める

### 8.5 法的 / プライバシー

- 同じコードを Anthropic / OpenAI 両ベンダーに送る判断
- 顧客案件 (PRJ-002 / PRJ-007 等) コードを Codex に投げる場合の合意
- **ミティゲーション**:
  - `organization/rules/client-communication.md` に「Codex (OpenAI) を使う案件は事前合意」を追加
  - Sumi に **engine 制限フラグ** を project 単位で持たせる（v2.0）
  - sandbox=read-only でレビューだけ Codex に投げる運用を推奨

### 8.6 Windows ネイティブ Codex の experimental 状態

- オーナー環境は Windows 11、現状 Sumi は WSL2 経路で Claude を動かしている
- Codex も **WSL2 経路** が安定（ネイティブは AppContainer 等まだ若い）
- **ミティゲーション**: Sumi 既定で WSL2 経路を選択。Phase 2 で Windows ネイティブ実験オプション追加

---

## 9. 残課題と将来 (将来 Phase 候補)

| 項目 | Phase | 備考 |
|---|---|---|
| **AGENTS.md linter** (両 engine 設定の矛盾を Sumi で検出) | v2.x | Phase 3 後 |
| **engine routing UI** (Slack 風 rail に engine selector) | v2.0 (Phase 3) | |
| **Codex Cloud Tasks 統合** (Pro+ 限定機能の Sumi 表示) | v2.x | OpenAI 側の API 安定化待ち |
| **画像生成 inline 表示** (Codex `gpt-image-2` を Sumi で受ける) | v2.x | |
| **MCP shared memory server 内蔵** (両 AI の handoff を自動化) | v2.x | Codex Wrap-up skill のクローン |
| **Local LLM (Ollama) サポート** (Codex `--oss` を Sumi UI から) | v2.x | Codex 側機能を流用 |
| **engine 性能比較ダッシュボード** (同タスクを両 AI に投げて比較) | v3.x | Sumi の差別化候補 |
| **Codex GitHub Action 経由の cloud handoff** | v3.x | |
| **AGENTS.md linter を `lint` package として OSS 公開** | v3.x | コミュニティ貢献 |

---

## 10. 参照リンク

### Codex CLI 公式

- [openai/codex (GitHub)](https://github.com/openai/codex)
- [Codex Developers Portal](https://developers.openai.com/codex)
- [CLI – Codex](https://developers.openai.com/codex/cli)
- [Features – Codex CLI](https://developers.openai.com/codex/cli/features)
- [Command line options](https://developers.openai.com/codex/cli/reference)
- [Authentication – Codex](https://developers.openai.com/codex/auth)
- [Pricing – Codex](https://developers.openai.com/codex/pricing)
- [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)
- [Quickstart](https://developers.openai.com/codex/quickstart)
- [Non-interactive mode (`codex exec`)](https://developers.openai.com/codex/noninteractive)
- [Model Context Protocol (Codex MCP)](https://developers.openai.com/codex/mcp)
- [Codex Subagents](https://developers.openai.com/codex/subagents)
- [Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
- [Use Codex with the Agents SDK](https://developers.openai.com/codex/guides/agents-sdk)
- [App Server (JSON-RPC 2.0)](https://developers.openai.com/codex/app-server)
- [App Server README (codex-rs/app-server)](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)
- [Configuration Reference](https://developers.openai.com/codex/config-reference)
- [Advanced Configuration](https://developers.openai.com/codex/config-advanced)
- [Windows – Codex](https://developers.openai.com/codex/windows)

### AGENTS.md / 標準化

- [AGENTS.md 公式](https://agents.md/)
- [How to Build Your AGENTS.md (2026) — Augment Code](https://www.augmentcode.com/guides/how-to-build-agents-md)
- [CLAUDE.md, AGENTS.md & Copilot Instructions: Configure Every AI Coding Assistant — DeployHQ](https://www.deployhq.com/blog/ai-coding-config-files-guide)
- [Feature request: support AGENTS.md as a native context file alongside CLAUDE.md (anthropics/claude-code #34235)](https://github.com/anthropics/claude-code/issues/34235)
- [AGENTS.md: Complete Guide — Vibecoding](https://vibecoding.app/blog/agents-md-guide)
- [The Complete Guide to AI Agent Memory Files — Medium](https://medium.com/data-science-collective/the-complete-guide-to-ai-agent-memory-files-claude-md-agents-md-and-beyond-49ea0df5c5a9)
- [Writing a good CLAUDE.md — HumanLayer Blog](https://www.humanlayer.dev/blog/writing-a-good-claude-md)

### Claude Code / Anthropic

- [Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Authentication](https://code.claude.com/docs/en/authentication)
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)
- [Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Anthropic clarifies ban on third-party tool access (The Register)](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/)
- [Anthropic Agent SDK confusion (The New Stack)](https://thenewstack.io/anthropic-agent-sdk-confusion/)
- [Anthropic Revokes OpenAI's Access to Claude (Slashdot)](https://developers.slashdot.org/story/25/08/01/2237220/anthropic-revokes-openais-access-to-claude-over-terms-of-service-violation)
- [Inside Claude Code Architecture — Penligent](https://www.penligent.ai/hackinglabs/inside-claude-code-the-architecture-behind-tools-memory-hooks-and-mcp/)

### Claude × Codex 連携事例

- [Claude + Codex CLI: Agentic Coding (Sangho Oh, Medium)](https://medium.com/@sangho.oh/claude-codex-cli-agentic-coding-a98c83ba043e)
- [Codex CLI + Claude Code: MCP Is 4x Faster Than CLI (J.D. Hodges)](https://www.jdhodges.com/blog/codex-cli-claude-code-mcp-speeds-command-line/)
- [What Is the OpenAI Codex Plugin for Claude Code? (MindStudio)](https://www.mindstudio.ai/blog/openai-codex-plugin-claude-code-cross-provider-review)
- [tuannvm/codex-mcp-server (GitHub)](https://github.com/tuannvm/codex-mcp-server)
- [kky42/codex-as-mcp (GitHub)](https://github.com/kky42/codex-as-mcp)
- [leonardsellem/codex-subagents-mcp (Claude-style subagents for Codex)](https://github.com/leonardsellem/codex-subagents-mcp)
- [milisp/codexia (Tauri-based Codex+Claude workstation)](https://github.com/milisp/codexia)
- [Inside the Agent Harness — Jonathan Fulton](https://medium.com/jonathans-musings/inside-the-agent-harness-how-codex-and-claude-code-actually-work-63593e26c176)
- [Use subagents and custom agents in Codex — Simon Willison](https://simonwillison.net/2026/Mar/16/codex-subagents/)
- [What Are Multi-Agent Systems and Subagents? — Dreamwalker, Medium](https://medium.com/@aristojeff/what-are-multi-agent-systems-and-subagents-a-comparison-of-codex-claude-code-and-gemini-cli-304376584f51)

### ベンチマーク

- [SWE-Bench 2026: Claude vs GPT-5 (Local AI Master)](https://localaimaster.com/models/swe-bench-explained-ai-benchmarks)
- [Best AI Coding Models 2026: SWE-Bench Leaderboard](https://localaimaster.com/models/best-ai-coding-models)
- [SWE-bench & LiveCodeBench Leaderboard March 2026 — BenchLM.ai](https://benchlm.ai/coding)
- [Claude AI Benchmarks — Claude5.ai](https://claude5.ai/benchmarks)

### Tauri / 実装パターン

- [Embedding External Binaries — Tauri v2](https://v2.tauri.app/develop/sidecar/)
- [Node.js as a sidecar — Tauri v2](https://v2.tauri.app/learn/sidecar-nodejs/)
- [Codex App-Server Protocol Guide — cankolabuilds](https://cankolabuilds.com/codex-app-server-protocol-guide)
- [Building a High-Performance App Server for Codex Agents — n1n.ai](https://explore.n1n.ai/blog/building-codex-app-server-json-rpc-guide-2026-02-05)
- [The Codex App-Server: Building Custom Integrations with the JSON-RPC Protocol — codex.danielvaughan.com](https://codex.danielvaughan.com/2026/03/28/codex-app-server-json-rpc-protocol/)

### Sumi 内部参照（PRJ-012）

- `projects/PRJ-012/decisions.md` — DEC-033 / DEC-063 / DEC-073 / DEC-074 / DEC-080
- `projects/PRJ-012/app/ccmux-ide-gui/sidecar/src/index.ts` — 既存 NDJSON プロトコル実装
- `projects/PRJ-012/app/ccmux-ide-gui/sidecar/src/agent.ts` — 既存 claude-agent-sdk wrapper
- `projects/PRJ-012/app/ccmux-ide-gui/src-tauri/src/commands/agent.rs` — Multi-Sidecar 管理
- `projects/PRJ-012/app/ccmux-ide-gui/src-tauri/src/commands/mcp.rs` / `mcp_install.rs` — 既存 MCP 管理 UI のテンプレ元

---

## 付録 A: Phase 1 実装プレビュー（DEC-081 想定の概略）

> 注: **これは実装ではなく、Phase 1 で発生する変更の事前マッピング**。

### 変更が見込まれるファイル（Phase 1 / v1.42.0）

| ファイル | 変更内容 |
|---|---|
| `src-tauri/src/commands/mcp_install.rs` | `install_codex_mcp(app: AppHandle)` を追加。Claude Code の `~/.claude.json` `mcpServers.codex` を upsert |
| `src-tauri/src/commands/codex_auth.rs` (**新規**) | `codex_login(app)` / `codex_status() -> { logged_in: bool, mode: "chatgpt"|"api"|null }` を実装。実体は `codex login` / `codex auth` を spawn して exit code を見るだけ |
| `sidecar/src/agent.ts` | `Options.appendSystemPrompt` に `<repoRoot>/AGENTS.md` を追加読み込み（CLAUDE.md と並列） |
| `src/components/StatusBar.tsx` (or 既存 status component) | Codex / Claude の login バッジ追加 |
| `src/components/Settings/AIEngines.tsx` (**新規**) | Settings 画面に「AI Engines」タブ。Claude / Codex のログイン状態 + ボタン |
| `AGENTS.md` (Sumi root) | Sumi 自身用に新設、CLAUDE.md と内容統合 |
| `CLAUDE.md` (Sumi root) | AGENTS.md 参照に縮小、Claude 限定差分のみ残す |
| `organization/rules/project-setup-checklist.md` | 「AGENTS.md / CLAUDE.md / `.codex/` / `.claude/` のセットアップ」追記 |

### 変更が見込まれるが Phase 1 では触らないファイル

- `commands/agent.rs` — Phase 2 で `codex.rs` を新設するため Phase 1 では未変更
- `sidecar/src/index.ts` — Phase 2 で engine 抽象化レイヤを入れるため Phase 1 では未変更

### Phase 1 完了時にユーザができること

1. Sumi 設定 → AI Engines → 「Codex を有効化」クリック → ブラウザ OAuth 完了
2. Claude チャット pane で「Codex でこの auth コードをセキュリティレビューして」と依頼すると、Claude が `mcp__codex__codex` を呼んで結果を返す
3. AGENTS.md を書けば両 AI が読むようになる
4. Codex 側の status は status bar から確認できる

これで「Claude Code 内で Codex を呼び出す」要望は **Phase 1 で完結**。Phase 2/3 は更にリッチな体験を積む。

---

## 付録 B: 不確実 / 未確認事項（要 Phase 0 検証）

| 不確実項目 | リスク | 検証方法 |
|---|---|---|
| Windows WSL2 環境で `codex login` のローカルコールバック (port 1455) がブラウザに見えるか | ChatGPT OAuth が完了しないリスク | オーナー環境で `codex login` を素手で実行して挙動確認（30 分） |
| `codex mcp-server` を Claude Code から呼んだときの実レイテンシ（Sumi sidecar 経由で） | 4x 速いという出典は単一ブログ依拠 | Phase 1 完了直後に簡易計測 |
| `codex app-server` の Windows native での安定性 | Phase 2 で詰む可能性 | Phase 2 着手前に POC（半日） |
| Anthropic が「Codex MCP を Claude Code 内で呼ぶ」構成を ToS で許容するか | 万が一 NG なら Phase 1 価値毀損 | Anthropic developer relations に問合せ（オーナー判断） |
| `~/.codex/auth.json` が WSL2 / Windows 間で共有可能か | Sumi UX が分裂するリスク | Phase 0 で確認 |
| AGENTS.md の `project_doc_max_bytes` 既定値（32 vs 64 KiB）の現バージョン値 | 大規模 monorepo で truncation | `codex --help` / config schema で実機確認 |

---

**以上、徹底調査と提案を終わる。CEO の方針確定後、Phase 1 (DEC-081 / v1.42.0) の詳細タスク分解 + ChatGPT Plus アカウントでの POC 実機確認を実施する用意がある。**
