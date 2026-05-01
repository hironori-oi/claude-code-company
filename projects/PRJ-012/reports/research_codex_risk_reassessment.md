# PRJ-012 Codex 統合 - リスク再検証 + MCP ルーティングルール (第二の意見)

- **作成日**: 2026-05-01
- **担当**: 開発部門 (シニアアーキテクト兼リスクアナリスト) — **第二の独立意見**
- **対象**: 1 人目の調査 `research_codex_integration_proposal.md` の再点検 + 同時実装リスク + MCP ルーティングルール設計
- **位置づけ**: 調査・提案のみ。コード変更ゼロ。1 人目に依存せず独立判断。

---

## 0. TL;DR (CEO 即決用)

1. **同時実装は「条件付き YES」**。1 人目の "案 A+C ハイブリッド 3 段階" は方向として妥当だが、**Phase 1 v1.42.0 のスコープに重大な見落とし** が 3 つある (後述 §1)。修正なしで着手すると課金暴走 / 規約違反 / silent fail のリスク。
2. **Critical 級の新規リスク** が 3 件:
   - **(C1) ChatGPT Plus は default で training opt-in** ([OpenAI Help](https://help.openai.com/en/articles/5722486)) — クライアント案件 (PRJ-002 / PRJ-007) コードを Codex に流すと **OpenAI の training data に入る可能性**。Anthropic Business / API は default opt-out なので非対称。
   - **(C2) Plus rate limit 到達時の API key fallback はバグ報告あり** ([codex#5823](https://github.com/openai/codex/issues/5823)) — Sumi 内で silent fail し、ユーザは「Claude が Codex を呼んだのに何も返ってこない」状態に。
   - **(C3) Claude が MCP 経由で Codex を呼ぶと「両側課金」** — Claude の input/output token + Codex の Plus メッセージ枠が **同時に** 消費。1 ターンで Claude が Codex を 5 回 chain したら Plus 5 時間枠の 1/3〜1/16 が吹き飛ぶ。
3. **「Codex のみ利用」は Phase 1 では実質不可能**。MCP 方式は Claude が orchestrator なので必ず Claude を経由する。Phase 2 の engine selector まで待つか、Phase 1 で「`/codex` slash command が PTY で `codex` を spawn する逃げ道」を残すかの二択。
4. **Phase 0 (POC) を強く推奨**。1 人目は付録 B で「不確実項目 6 件」を列挙したが、Phase 1 着手前にこれらを潰す **半日 POC** をやらずに走ると Phase 1 が手戻り確定。
5. **DEC-081 確定前に修正必須** の項目: (a) AGENTS.md inject の対象範囲を「Sumi 自身の repo」に限定、(b) Codex の training opt-out を Sumi UI で必須プロンプト、(c) Plus 上限到達時のダウングレード UX 設計、(d) MCP tool name (`mcp__codex__codex`) を `disallowedTools` に入れる "Claude only" モードを Phase 1 で実装。

**結論**: 1 人目の方向性は維持しつつ、**Phase 1 のスコープに +4 項目追加**、**Phase 0 半日 POC を必須化**、それで GO。

---

## 1. 1 人目の結論への独立意見

### 1.1 1 人目の主張の再点検

| 1 人目の主張 | 評価 | 第二の意見 |
|---|---|---|
| Codex CLI は 2026-05 時点で本番品質、Apache-2.0、Rust | ◎ 同意 | 一次情報通り |
| `codex app-server` (JSON-RPC) は Sumi sidecar と同型 | ◯ 概ね同意 | ただし NDJSON ⇄ JSON-RPC の **正規化レイヤを Sumi が背負う** 工数を 1 人目は規模 M で見積もっているが、実体は **L 寄り**。turn/start, item/agentMessage/delta, plan_update など Codex 独自概念のマッピングは骨が折れる |
| `codex mcp-server` を Claude が呼ぶ案 C は規模 XS | △ 過小評価 | 設定書込は XS だが、**permission UX (毎回 ask) / disallowedTools 統合 / Plus 上限到達時のエラーハンドリング** は別途 S〜M 必要 |
| AGENTS.md を真実の源、CLAUDE.md は 2 行参照 | ◯ 方向は同意 | ただし **claude-code-company の組織レベル AGENTS.md** を Sumi 自身の repo より優先して入れるのは時期尚早。組織側の AGENTS.md は Phase 2 以降で良い (1 人目もそう書いているが、Phase 1 で Sumi リポ内 AGENTS.md を作る規模感が「2 行」と過小に見える) |
| 個人開発者が自分のサブスクで自分のツールを叩くのは Anthropic / OpenAI 共に OK | ◯ 同意 | ただし **「自分のクライアント案件のコードを Codex に流す」点は別問題** — クライアントとの NDA / 個人情報保護観点では「Sumi が個人ツールでも、流すデータの所有者は OK か」を別途取る必要 (1 人目は §8.5 で言及あるが Phase 1 から制限フラグが必要) |
| Plus サブスクで $0、Pro Boost 中 | ◯ 短期は同意 | 2026-05-31 で 2x boost が終了。**Phase 2 着手時 (v1.44.0 想定 = 6〜10 週後) には boost 終了済**。コスト想定は boost 後で組むべき |
| 推奨案 A+C のハイブリッド | ◯ 同意 | **修正提案あり** (§4) |

### 1.2 §8 リスクで漏れている項目 (新規列挙)

1 人目の §8 は 6 件 (サブスク仕様変動 / breaking change / policy 衝突 / 維持負荷 / 法的プライバシー / Windows native experimental)。以下が **明確に漏れている** か **過小評価**:

| # | 漏れ / 過小 | 重要度 | §8 のどこに追加すべきか |
|---|---|---|---|
| L1 | **Plus rate limit 到達時の silent fail** ([codex#5823](https://github.com/openai/codex/issues/5823) 既知バグ) | **Critical** | §8.1 の補強 |
| L2 | **両側課金** (Claude token + Codex Plus 枠) | **Critical** | 新設 §8.7 |
| L3 | **ChatGPT Plus の training opt-in default** | **Critical** | §8.5 の補強 |
| L4 | **Sumi が `~/.claude/.credentials.json` 経由で Anthropic OAuth を裏で使う件** が ToS グレー | Major | §8.3 の補強 (1 人目は「個人なら OK」と書くがこれは Anthropic 公式が明示した範囲ではない) |
| L5 | **MCP server のサプライチェーン攻撃** — 公式 `codex mcp-server` 自体は OK だが、誰かが `codex-as-mcp` 系の community fork を入れたら supply chain 攻撃ベクタになる | Major | 新設 §8.8 |
| L6 | **AGENTS.md と CLAUDE.md の同期ドリフト** — 1 人目の「2 行 fallback 戦略」は理屈上 OK だが、現実には CLAUDE.md 限定セクションが膨らんで両者の "single source of truth" が壊れる | Minor〜Major | §2.4 で言及あるが Phase 1 後の手動運用負荷を過小評価 |
| L7 | **JobObject (Windows kill-on-drop) は Codex プロセスもカバーするか** が未検証 | Major | §8.6 の補強 |
| L8 | **engine 別 sandbox 既定の整合** — Claude Code の permission mode と Codex の `read-only`/`workspace-write`/`danger-full` を Sumi UI でどう統一表示するか | Major | §3 の構成案に欠落 |
| L9 | **Multi-Project + Multi-Engine の最悪ケース** — 10 project × 2 engine × 3 session/project = **60 sidecar の可能性**。`MAX_CONCURRENT_SIDECARS = 8` は Phase 2 で破綻 | Critical | §8.4 の補強 |
| L10 | **「同じ質問を Claude / Codex 両方に手動で投げて比較」UX** で **倍課金** を Sumi が自動で警告しない | Minor | §3 UI 設計に追加 |
| L11 | **AGENTS.md を Claude sidecar が読み込む際のサイズ問題** — 1 人目は 32〜64 KiB と書くが、Claude SDK の `appendSystemPrompt` には別途上限あり | Minor | §2.5 補強 |
| L12 | **個人開発者が Phase 2 着手時に Sumi の機能数 (現 v1.34.0 → +12 機能予定) で精神的に詰む** リスク (人的サステナビリティ) | Major | 新設 §8.9 |

### 1.3 1 人目が「問題なし」と言ったが要注意なもの

- **「§5.2 統一方針: Sumi はトークンに触れない」** — 美しい設計だが、**ログイン状態の同期が CLI 任せ** = `~/.codex/auth.json` を Sumi が watch しないと「ログアウトされたのに status bar が ◯」状態が発生する。**Phase 1 で fs.watch + 5 秒 polling fallback** が必要。
- **「§4.2 MCP は CLI より 4x 速い」** — 出典 1 件のみ ([jdhodges blog](https://www.jdhodges.com/blog/codex-cli-claude-code-mcp-speeds-command-line/))、ベンチ条件不明。Sumi 環境 (WSL2 + sidecar 経由) で再現するかは別問題。**Phase 0 で実測**。
- **「§7.3 Phase 1 = 2 週間」** — 規模 S と書きつつ、付録 A の変更ファイル 8 件 + 既存 `mcp_install.rs` のテンプレ化 + 新規 `codex_auth.rs` + Settings UI 1 画面 + AGENTS.md inject + status bar = **どう見ても 3〜4 週**。1 人目の 2 週見積は楽観。

---

## 2. リスク再検証

### 2.1 アーキテクチャ・性能

| ID | リスク | レベル | Phase | 対策あり/なし |
|---|---|---|---|---|
| A1 | **Multi-Project × Multi-Engine で sidecar 数が爆発** (10 project × 2 engine × 3 session = 60 max) | **Critical** | Phase 2 | なし → `MAX_CONCURRENT_SIDECARS` を engine 別 6+6 で済ませる 1 人目案では足りない。**LRU evict + active-only spawn** が必要 |
| A2 | Codex Rust プロセスの起動オーバーヘッドが Node sidecar より遅い場合の UX 悪化 | Major | Phase 2 | あり (lazy spawn 既存パターンに乗る) |
| A3 | **JobObject (Windows kill-on-drop) が Codex プロセスを掴めるか未検証** — `codex app-server` は `tauri-plugin-shell` の `CommandChild` 配下に入るので **理屈上 OK** だが、Codex が内部で fork した child まで kill されるかは別問題 | Major | Phase 2 | なし → Phase 0 で実機確認 |
| A4 | Claude / Codex が同じファイルを並列編集する race condition (同 session 内で `codex` が `mcp__codex__codex` 経由 + Claude 自身が `Edit` tool を呼ぶ) | Major | Phase 1 | なし → Codex を `read-only` sandbox で固定 (推奨) |
| A5 | Tauri command の輻輳 (engine 数 ×2 で IPC が増える) | Minor | Phase 2 | あり (既存 NDJSON channel 設計で吸収) |
| A6 | **メモリ消費** — Node sidecar (Claude) ~150 MB + Codex Rust (~50 MB) ×8 session = 約 1.6 GB だけで Sumi 占有 | Major | Phase 2 | あり (Sumi の既存 8 同時上限で抑制、ただし上限引上げ要望が来たら詰む) |

### 2.2 UX・メンタルモデル

| ID | リスク | レベル | Phase | 対策あり/なし |
|---|---|---|---|---|
| U1 | **どっちが何をしたか混乱** — Claude が MCP で Codex を呼んだ結果が Claude の発言として表示される。ユーザは「Claude が言った」と誤認 | Major | Phase 1 | あり (Sumi UI で `via Codex` バッジ表示が必要、規模 S 追加) |
| U2 | **engine 切替の認知コスト** — pane ごとに engine を選ぶ UI、Slack 風 rail にどう収めるか | Major | Phase 2 | あり (engine icon を pane header に) |
| U3 | **AGENTS.md と CLAUDE.md の差分見落とし** — 「2 行戦略」を破ってオーナーがうっかり CLAUDE.md にだけ書いたら Codex には伝わらない | Minor | Phase 1 | あり (CLAUDE.md 内に「ここに書くと Claude only に効く」警告 comment) |
| U4 | **倍課金の自覚なし** — Hybrid モードで使うほど両側で枠を消費するが UI に表示なし | Major | Phase 1 | なし → status bar に「Plus 残: 27/80 msg, Claude: 推定 $0.34/h」を出す UI 追加 (規模 S) |
| U5 | **Claude が Codex の context 履歴を持っていない** — Claude が Codex を 1 ターン呼んでも、次のターンで Codex は前ターンを覚えていない (`codex-reply` で thread_id を引き継ぐが Sumi が wire しないと意味なし) | Major | Phase 1 | あり (`mcp__codex__codex-reply` を Sumi 側が Claude に教えるツール説明追記) |
| U6 | **「同じ質問を両方に手動で投げる」倍時間 UX** | Minor | Phase 1 | あり (将来の broadcast モード警告) |

### 2.3 法的・契約

| ID | リスク | レベル | Phase | 対策あり/なし |
|---|---|---|---|---|
| L1 | **Anthropic ToS: 出力を競合 AI training に使わない** ([Commercial Terms D.4](https://www.anthropic.com/legal/commercial-terms)) — Claude の出力を Codex に渡すこと自体は「training に使う」ではないが、Codex 側で training opt-in だと **間接的に Claude 出力が GPT 訓練に流れる** 解釈リスク | **Critical** | Phase 1 | **未** → Sumi の README + Settings UI に「Codex を有効化する前に Codex 側 training opt-out が必須」フローを強制 |
| L2 | **OpenAI ToS: 出力を OpenAI 競合モデルに使わない** ([Usage Policies](https://openai.com/policies/usage-policies)) — Codex 出力を Claude に渡すのも対称に問題、ただし Anthropic の 競合認定有無は不明 | Major | Phase 1 | あり (個人ローカル利用なら大半は許容) |
| L3 | **クライアント案件コードを Codex に流す合意** | **Critical** | Phase 1 | **不十分** → 1 人目が言及した `client-communication.md` への追記だけでは弱い。**Sumi の project 設定で「engine: codex 禁止」フラグ** を Phase 1 から実装 (規模 XS) |
| L4 | **Sumi が `~/.claude/.credentials.json` を裏で使う件** — 1 人目は「個人なら OK と Anthropic 公式が明言」と書くが、本当に Anthropic 公式が個別に明言したのは API key 経路。OAuth 経由は **改訂された 2025-08 ToS でグレー** ([The Register](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/)) | Major | Phase 1 (継続中) | あり (個人 local だけ、再配布しない、API key fallback 用意) |
| L5 | **Sumi が将来 OSS 配布されたら** — README に「自分のサブスクで」と書いても、配布バイナリを使う他者の責任問題が Sumi に飛び火 | Minor | v2.x | あり (LICENSE + DISCLAIMER) |

### 2.4 セキュリティ・プライバシー

| ID | リスク | レベル | Phase | 対策あり/なし |
|---|---|---|---|---|
| S1 | **Codex CLI の supply chain** — npm `@openai/codex` 公式は OK だが、community MCP fork (`codex-as-mcp` 等) を Sumi が薦めると攻撃面 | Major | Phase 1 | あり (公式 `codex mcp-server` のみ Sumi 推奨、community は手動設定) |
| S2 | **secret leak: Claude が見ている env / token を MCP 経由で Codex に渡す** — Claude Code の `Edit` tool で `.env` を読んだ直後に MCP で Codex に「review してください」と投げると **平文で OpenAI に到達** | **Critical** | Phase 1 | **未** → Sumi sidecar で MCP 呼出時の payload を `.env` / `.git/config` / `*key*.json` パターンで sanitize (規模 M) |
| S3 | **audit trail の分散** — Anthropic console + OpenAI usage page + Sumi local の 3 箇所にログ。incident 時の調査が困難 | Minor | Phase 2 | あり (Sumi 側で両 engine の `mcp_tool_call` event を統一ログに) |
| S4 | **WSL2 → Windows のクロスドメイン file access** — Codex sandbox `workspace-write` が `/mnt/c/` 配下を「書込可」と判定する範囲が Codex 側の Linux Landlock + WSL2 の挙動依存 | Major | Phase 2 | なし → Phase 0 で実機確認 |
| S5 | **MCP server 追加で Claude の attack surface 増** — `codex` MCP が `codex` 自体を任意に実行できる (sandbox 内とはいえ) ので、Claude が prompt injection 経由で「`codex exec --sandbox danger-full ...`」を実行する経路 | Major | Phase 1 | あり (MCP server 起動時の引数に `--sandbox=read-only` を強制、規模 XS) |

### 2.5 運用

| ID | リスク | レベル | Phase | 対策あり/なし |
|---|---|---|---|---|
| O1 | **Plus 上限到達時の silent fail** ([codex#5823](https://github.com/openai/codex/issues/5823) 既知) | **Critical** | Phase 1 | **未** → Sumi 側で Codex の `error` event を catch して toast + status bar 警告 (規模 S) |
| O2 | Anthropic / OpenAI 片側障害時の挙動 (graceful degradation) | Major | Phase 1 | あり (engine selector で切替可能) |
| O3 | bug 切り分けが engine 双方の可能性で 2 倍困難に | Major | 全 Phase | あり (engine 別ログ tag) |
| O4 | **個人開発者の保守工数 2 倍** — Codex CLI のリリースを weekly check + Sumi 側互換性テスト | Major | 全 Phase | あり (Phase 1 を最小に) |
| O5 | **Boost 終了 (2026-05-31)** 後の Pro 5x 値段が変動 | Minor | Phase 2 以降 | あり (Phase 2 着手時に再見積) |

### 2.6 コスト・経済性

| ID | リスク | レベル | Phase | 対策あり/なし |
|---|---|---|---|---|
| C1 | **両側課金** (Claude API token + Codex Plus 枠) | **Critical** | Phase 1 | **未** → Sumi UI で「MCP 経由 Codex 呼出時の累計推定コスト」を session 単位で表示 (規模 S) |
| C2 | **Claude 暴走 → MCP で Codex を 5 回 chain** — 現実的な暴走シナリオ: Claude が「Codex の最初の答えを Codex に再確認、その答えをまた…」のループ。Plus 枠 80 msg/5h を 1 セッションで枯渇させる距離は近い | **Critical** | Phase 1 | **未** → MCP tool 呼出回数の hard cap (1 turn あたり 3 回まで) を Sumi sidecar で実装 (規模 S) |
| C3 | API key fallback 時の請求暴走 — Plus 枯渇 → 自動 API key 切替で「気づいたら $200 課金」 | **Critical** | Phase 1 | **未** → API key fallback は **default OFF**、ユーザが明示有効化 (規模 XS) |
| C4 | Cloud Tasks (Pro+) 課金は Phase 1 では関係なし | N/A | v2.x | — |

### 2.7 認知負荷・運用継続性

| ID | リスク | レベル | Phase | 対策あり/なし |
|---|---|---|---|---|
| K1 | Sumi が PRJ-012 v1.34.0 で機能数すでに豊富 (Multi-Project, Editor Slot, auto-compact, …)。+Codex で更に複雑化 | Major | Phase 2 | あり (Phase 1 は最小機能、settings tab 1 個だけ) |
| K2 | ナレッジが 2 系統 (claude-code-company の `organization/knowledge/` vs Codex best practice docs) | Minor | Phase 2 | あり (AGENTS.md に集約) |
| K3 | **ドキュメンテーションの 2 倍化** — 各案件の `decisions.md` で「どちらの engine で実装したか」記録、報告書の出典 URL が両ベンダーに散らばる | Major | 全 Phase | あり (template に `engine` field 追加) |
| K4 | オーナー個人開発で Phase 3 (v2.0) まで完走できる体力か | Major | v2.0 | あり (Phase 1 だけで止まる選択肢を確保) |

### 2.8 リスク総括 (Critical のみ抽出)

| # | 内容 | Phase | 1 人目言及 |
|---|---|---|---|
| **C-α** | Plus rate limit silent fail (O1) | 1 | × 漏れ |
| **C-β** | 両側課金 (C1) + 暴走 chain (C2) + API key 暴走 (C3) | 1 | × 漏れ |
| **C-γ** | Plus default training opt-in (L1, S2) | 1 | △ 部分言及 |
| **C-δ** | クライアント案件コードの engine 制限フラグ (L3) | 1 | △ 部分言及 |
| **C-ε** | Multi-Project × Multi-Engine 60 sidecar 最悪ケース (A1) | 2 | × 漏れ |
| **C-ζ** | secret leak via MCP (S2) | 1 | × 漏れ |

**6 件の Critical のうち 4 件は 1 人目漏れ、2 件は部分言及のみ**。

---

## 3. MCP 経由の Codex 呼び出し判断ルール

### 3.1 Claude の自律判断メカニズム

Claude Code が MCP tool を呼ぶか呼ばないかは **Claude モデルの autonomous reasoning** に基づく。以下が影響因子:

| 因子 | 影響度 | 制御性 |
|---|---|---|
| MCP server が露出する **tool description** | 高 | server 側で書く (`codex mcp-server` の固定値、Sumi は変更不可) |
| **system prompt 指示** (CLAUDE.md / AGENTS.md / `--append-system-prompt` / `Options.appendSystemPrompt`) | 高 | Sumi sidecar が完全制御 |
| タスクの性質 (例: "セキュリティレビュー" は Claude が Codex を呼びたがる) | 中 | 制御不可 (モデル判断) |
| 前ターンの利用履歴 (一度呼んだら傾向が続く) | 中 | session 切替で reset |
| **`disallowedTools` / `allowedTools`** の hard rule | **絶対** | Sumi sidecar が完全制御 ([Claude Docs](https://code.claude.com/docs/en/permissions)) |
| **PreToolUse hook** で deny | **絶対** | Sumi sidecar が完全制御 |

**結論**: 「Claude が Codex を **呼ぶか呼ばないか** の判断を Sumi が完全に握る」ことは **`disallowedTools` で技術的には可能**。一方「呼んでほしいときだけ呼ぶ」という確率的誘導は system prompt 設計依存。

### 3.2 ユーザのコントロール手段 (公式 docs 引用)

公式に提供される control surface:

#### (a) MCP server 有効/無効 — file 編集

`.claude/settings.json` または `~/.claude.json`:
```json
{
  "mcpServers": {
    "codex": { "command": "codex", "args": ["mcp-server"] }
  }
}
```
file から削除すれば Codex MCP は完全に無効化。Sumi UI は **トグルスイッチ 1 つ** で書込/削除すれば良い。

#### (b) tool 単位 allow/deny ([Claude Docs](https://code.claude.com/docs/en/permissions))

```json
{
  "permissions": {
    "deny": ["mcp__codex__*"],     // Codex MCP 全 tool 拒否
    "allow": ["mcp__codex__codex"] // 1 ターン Codex のみ許可、reply は不可
  }
}
```
- **deny は allow より強い** — 一度 deny したら Sumi の他層では覆せない (これは安全)
- ワイルドカード `mcp__codex__*` で server 単位拒否可能

#### (c) per-tool permission prompt (default: ask)

設定なしの default は「Claude が tool を呼ぼうとしたら user に毎回確認」。これは **Phase 1 ではむしろ user 教育に良い**。Phase 2 で session 単位 "always allow this session" を提供。

#### (d) PreToolUse hook ([Claude Docs](https://code.claude.com/docs/en/hooks))

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "mcp__codex__*",
      "hooks": [{ "type": "command", "command": "/path/to/codex-guard.sh" }]
    }]
  }
}
```
script の終了 code で deny 可。**Plus 枠残量チェック / `.env` sanitize** に最適。

#### (e) Sumi 独自: engine selector UI (Phase 2)

pane 単位で engine = `claude` / `codex` / `hybrid` を選択。`hybrid` は Claude が orchestrator (Phase 1 の現状)、`claude` は MCP 無効化 (= disallow)、`codex` は Claude sidecar をスキップして Codex sidecar 直接駆動。

#### (f) Slash command 経由の明示呼出 (Phase 1 から提供推奨)

`.claude/commands/codex.md`:
```
---
description: Codex (GPT-5.5) でセカンドオピニオンを取る
---
mcp__codex__codex で「$ARGUMENTS」を依頼してください。sandbox_mode は read-only 固定で。
```
ユーザは `/codex この auth コードをレビュー` と打つと **Claude は確実に Codex を呼ぶ** (system prompt で誘導)。逆に通常 chat では呼ばないように `disallowedTools` で覆う設計が綺麗。

### 3.3 「Codex のみ利用」モードの現実解 (Phase 別)

オーナーの specific question: **「Codex のみ利用したいときどうするか」**

#### Phase 1 (v1.42.0)
**MCP 方式は構造上 Claude を必ず通る**ので、純粋な「Codex only」は不可能。**3 つの逃げ道**:

1. **Sumi の terminal pane で `codex` を素手で起動** (最低限、UI は Sumi の TUI) — 工数ゼロ、ただし Sumi の構造化 chat UI は使えない
2. **`/codex {prompt}` slash command で `codex exec --json` を実行 → Sumi の chat UI に貼る** — 1 人目が「使わない」と切ったが、**「Codex only」モードのために Phase 1 から実装する価値あり**。規模 XS
3. **Sumi の Phase 1 スコープに「Codex sidecar 直接呼出」最小実装を含める** — 工数 +1 週、Phase 1 が 4 週 → 5 週に

**推奨**: **#2 を Phase 1 で実装** (規模 XS)。完全なる Codex only pane は Phase 2 で。

#### Phase 2 (v1.44.0)
- Pane の engine selector に `codex` 選択肢追加
- Codex sidecar (`codex app-server`) を spawn
- 完全な Codex only 動作

#### Phase 3 (v2.0.0)
- engine routing rule で「特定タスク種別 → 自動 Codex」
- broadcast モード (両方に同時送信) も engine routing で記述可能

### 3.4 推奨ルール設計表 (CEO 向け確定案)

| ニーズ | Phase 1 (v1.42.0) | Phase 2 (v1.44.0) | Phase 3 (v2.0.0) |
|---|---|---|---|
| **Claude only** (現状維持) | settings で MCP server `codex` 無効、または `disallowedTools: ["mcp__codex__*"]` | engine selector = `claude` | 同左 |
| **Hybrid** (Claude が orchestrator、必要時 Codex 呼出) | engine selector なし、MCP 有効 (default) | engine selector = `hybrid` | + auto routing rule |
| **Codex only** | `/codex` slash command で明示呼出 (推奨) or terminal で `codex` 直起動 | engine selector = `codex` | 同左 |
| **Both 並列 (broadcast)** | 不可 | 不可 | engine routing で `broadcast: true` |
| **特定タスク強制 Codex** | system prompt で誘導 + `/codex` 推奨 | + role pinning per pane | + auto routing rule |
| **特定 project で Codex 禁止** | `.sumi/engine-allowlist.toml` (Phase 1 で設計のみ) | UI で project 設定 | 同左 |

#### Phase 1 で実装する control surface (確定案)

| Control | 実装場所 | 規模 |
|---|---|---|
| **MCP server 有効/無効トグル** | Settings → AI Engines タブ | XS |
| **`disallowedTools` 編集** | Settings → AI Engines → Advanced | S |
| **`/codex` slash command (Codex only 明示)** | `.claude/commands/codex.md` テンプレ自動生成 | XS |
| **`/codex-disable` slash command** (一時的に Codex 無効化) | builtin slash command | XS |
| **`.sumi/engine-allowlist.toml`** (project 単位の engine 制限) | `.sumi/` 設計ドラフト + reader 実装 | S |
| **API key fallback トグル (default OFF)** | Settings → AI Engines | XS |
| **MCP 呼出 hard cap (1 turn 3 回)** | sidecar PreToolUse logic | S |
| **secret sanitize hook** | sidecar PreToolUse logic | M |
| **status bar: Plus 残量 / Claude 推定コスト** | UI | S |

合計: 1 人目の Phase 1 規模 S → **第二の意見では M〜L**。期間 2 週 → **3〜4 週**。

---

## 4. 1 人目の結論との整合性 / 修正提案

### 4.1 整合する部分 (維持)

- 案 A+C ハイブリッド (案 D は v2.0 で完成) — **方向性は維持**
- AGENTS.md を真実の源にする — **維持**
- Codex 公式 `app-server` を JSON-RPC で叩く (案 A) — **維持**
- 案 B (PTY で生 TUI) は採用しない — **維持** (ただし `/codex` slash command として **限定的に Phase 1 で復活**)
- Phase 1 / Phase 2 / Phase 3 の 3 段階 — **維持**

### 4.2 修正提案

#### Phase 1 (v1.42.0) スコープ拡張

1 人目の Phase 1 (5 項目, 規模 S, 2 週) に以下を **追加** (Critical リスク対応):

| # | 追加項目 | 規模 | 対応 Critical リスク |
|---|---|---|---|
| 1 | Plus 上限到達 silent fail 検出 + toast + status bar 警告 | S | C-α (O1) |
| 2 | MCP 呼出 hard cap (1 turn 3 回) | S | C-β (C2) |
| 3 | API key fallback **default OFF** トグル | XS | C-β (C3) |
| 4 | Codex 起動前に「training opt-out 確認」UI 必須プロンプト | XS | C-γ (L1) |
| 5 | secret sanitize PreToolUse hook | M | C-ζ (S2) |
| 6 | `.sumi/engine-allowlist.toml` (project 単位 engine 制限) | S | C-δ (L3) |
| 7 | `/codex` slash command (Codex only 明示呼出) | XS | "Codex only" 要望 |
| 8 | status bar に両側課金推定 | S | U4 / C1 |

**改訂 Phase 1 規模**: M〜L、**3〜4 週**、DEC-081 の scope を上記まで拡張。

#### Phase 0 (POC) を Phase 1 着手前に必須化

1 人目の付録 B「不確実 6 件」を **半日 POC** で潰す:

| 不確実項目 | POC 内容 | 工数 |
|---|---|---|
| WSL2 で `codex login` の OAuth フロー (port 1455) | オーナー環境で素手実行 | 30 分 |
| `codex mcp-server` の実レイテンシ (Sumi sidecar 経由) | 既存 sidecar に MCP 1 行追加して計測 | 1 時間 |
| `codex app-server` の Windows native 安定性 | (Phase 2 着手前で OK、Phase 0 ではスキップ) | 0 |
| Anthropic ToS 上の MCP 構成許容性 | developer relations 問合せ (オーナー判断) | 別途 |
| `~/.codex/auth.json` の WSL2/Windows 共有 | `/mnt/c` vs `~` で挙動確認 | 30 分 |
| `project_doc_max_bytes` 既定値 | `codex --help` / config schema 実機確認 | 15 分 |
| **+ JobObject が Codex プロセスを掴むか** (新規) | Codex を child spawn → 親 kill → child 残留チェック | 1 時間 |
| **+ Codex の `read-only` sandbox が WSL2 mount をどう扱うか** | `/mnt/c/Users/...` で `Edit` を試行 | 30 分 |

**Phase 0 工数**: 半日 (4〜5 時間)。**Phase 1 着手前に必須**。

#### Phase 2 (v1.44.0) スコープに追加

- **engine 別 sandbox 既定の統一 UX 設計** (Claude permission mode と Codex `read-only` を Sumi UI で統一表示)
- **Multi-Project × Multi-Engine の sidecar LRU evict** (60 sidecar 最悪ケース対応)
- **MAX_CONCURRENT_SIDECARS を engine ペアで再設計** (`{claude: 6, codex: 6, total: 10}` の 3 値)

#### Phase 3 (v2.0.0) — 1 人目案を維持、追記なし

### 4.3 案 A+C ハイブリッド推奨は依然有効か

**YES — ただし Phase 1 が修正後 (3〜4 週) であることが前提**。

修正なしの「Phase 1 = 2 週で MCP + 基本 UI のみ」では、**Critical リスク 6 件中 4 件が未対応** で本番投入することになり、**最初の 1 週間で課金事故 / silent fail / training data 流出のいずれかが起きる確率が高い**。

---

## 5. 結論と CEO への助言

### 5.1 「同時実装は本当に問題ないか」 — **条件付き YES**

| 条件 | 必須度 |
|---|---|
| Phase 0 (POC, 半日) を実施 | **必須** |
| Phase 1 のスコープを §4.2 通り拡張 (規模 M〜L, 3〜4 週) | **必須** |
| §4.2 の Critical リスク対応 8 項目を全て Phase 1 に含める | **必須** |
| `.sumi/engine-allowlist.toml` を Phase 1 で骨組みだけでも作る | 強く推奨 |
| Plus 上限到達 silent fail を **Phase 1 リリースブロッカー** とする | **必須** |
| Codex 有効化前 training opt-out 必須プロンプト | **必須** |

これらを満たさず Phase 1 を強行する場合は **NO** (リリース後 1 週間で事故確率が高い)。

### 5.2 「Codex のみ利用」の現実解

- **Phase 1**: `/codex` slash command で明示呼出 (規模 XS、Phase 1 に追加推奨)。完全な Codex only pane は不可
- **Phase 2**: engine selector で `codex` 選択 → 真の Codex only pane
- **オーナー要望が「短期で Codex only も使いたい」なら Phase 1 に `/codex` を確実に入れる**

### 5.3 段階リリース計画への修正提案

| Phase | Version | 1 人目 | 第二の意見 (修正後) |
|---|---|---|---|
| **Phase 0** | (POC) | 付録 B で言及のみ | **半日 POC を必須化、Phase 1 着手前** |
| **Phase 1** | v1.42.0 | 規模 S, 2 週, DEC-081 | **規模 M〜L, 3〜4 週, DEC-081**, スコープ +8 項目 |
| **Phase 2** | v1.44.0 | 規模 M〜L, 4〜6 週 | 規模 L, 6〜8 週 (sidecar 最悪ケース対応 +1 週、sandbox 統一 UX +1 週) |
| **Phase 3** | v2.0.0 | 規模 L, 8〜10 週 | 同左 |

### 5.4 Phase 0 (POC) 強く推奨するか

**YES — 強く推奨**。

理由:
1. Phase 1 で 1 人目が "S, 2 週" と見積もったが、§4.2 修正後は M〜L, 3〜4 週。**事前 POC で不確実を半日で潰せば手戻り 1 週分回収**
2. WSL2 + `codex login` OAuth + JobObject + sandbox の 4 点は **どれも実機確認しないと分からない**。Phase 1 着手後に詰むと精神的にも痛い
3. オーナーは個人開発者で時間が貴重 — 半日 POC は最も効率の良い投資

### 5.5 CEO への 3 行助言

1. **方向性 GO** — 1 人目の案 A+C ハイブリッドは正しい。ただし Phase 1 を **3〜4 週・DEC-081 スコープ拡張** で組み直す
2. **Phase 0 半日 POC 必須** — オーナー環境で `codex login` / MCP レイテンシ / JobObject を実機確認してから DEC-081 確定
3. **Critical リスク 6 件のうち 4 件は 1 人目漏れ** — 課金暴走 (両側 + 暴走 chain + API key) と Plus default training opt-in と secret leak は **Phase 1 リリースブロッカー** にする

---

## 6. 参照リンク (再確認した URL)

### Anthropic ToS / Claude Code Docs
- [Anthropic Commercial Terms (Section D.4 — competing models 禁止)](https://www.anthropic.com/legal/commercial-terms)
- [Claude Code: Configure permissions (`allowedTools` / `disallowedTools` / hooks)](https://code.claude.com/docs/en/permissions)
- [Anthropic clarifies ban on third-party tool access (The Register, 2026-02)](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/)

### OpenAI / Codex
- [OpenAI Usage Policies](https://openai.com/policies/usage-policies/)
- [Using Codex with your ChatGPT plan (OpenAI Help)](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)
- [How your data is used to improve model performance (Plus default opt-in)](https://help.openai.com/en/articles/5722486-how-your-data-is-used-to-improve-model-performance)
- [Codex GitHub Issue #5823 — API key fallback バグ](https://github.com/openai/codex/issues/5823)
- [Codex Rate limits reset April 28 2026 (OpenAI Community)](https://community.openai.com/t/codex-rate-limits-reset-for-all-paid-plans-april-28-2026/1379921)
- [Codex MCP (公式)](https://developers.openai.com/codex/mcp)

### 1 人目の調査
- `projects/PRJ-012/reports/research_codex_integration_proposal.md`

### Sumi 既存コード (再確認)
- `projects/PRJ-012/app/ccmux-ide-gui/src-tauri/src/commands/agent.rs:63` — `MAX_CONCURRENT_SIDECARS = 8` (engine 拡張時の制約)
- `projects/PRJ-012/app/ccmux-ide-gui/src-tauri/src/commands/agent.rs:75-158` — Windows JobObject (Codex プロセスへの拡張可能性は未検証)
- `projects/PRJ-012/app/ccmux-ide-gui/src-tauri/src/commands/mcp_install.rs` — MCP 登録 UI のテンプレ元 (Codex MCP install で再利用)

---

**以上、第二の独立意見として完。**
**CEO 確定後の追加検討事項**: (a) Phase 0 POC を 5/2 (明日) 半日で実施するか、(b) 修正後 Phase 1 スコープを DEC-081 として確定するか、(c) `.sumi/engine-allowlist.toml` のスキーマを Phase 1 着手前に決めるか。
