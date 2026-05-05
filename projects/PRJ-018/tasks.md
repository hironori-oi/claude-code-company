# PRJ-018 タスク一覧（tasks.md）

**起案日**: 2026-05-01 ／ **担当**: PM（兼任） ／ **タスク ID プレフィクス**: `AS-`（Asagi）

## ステータス凡例

- `[ ]` 未着手
- `[>]` 進行中
- `[x]` 完了
- `[!]` ブロック中（理由必須）
- `[-]` 中止

**工数前提**: Sumi v3 の 150h 6 週実績を基準に、Codex CLI 統合の不確実性 +20% バッファで暫定設定。リサーチ部門の Codex 仕様確定後（DEC-018-009）に再見積。

---

## M1 Early Usable（4 週、暫定 60h）

**ゴール**: 素人が 4 ステップで ChatGPT 認証 → プロジェクトを開く → Codex と日本語チャット → 画像を貼って説明してもらえる

| ID | タスク | 担当 | 工数 | 依存 | ステータス |
|---|---|---|---|---|---|
| AS-100 | プロジェクトディレクトリ作成 (`projects/PRJ-018/app/asagi-app/`、README で実体場所明記) | PM/Dev | 0.5h | — | [x] Done（2026-05-02、雛形構築完遂） |
| AS-101 | リポジトリ作成 `hironori-oi/Asagi`（private、`.gitignore` / LICENSE-MIT 配置）— **DEC-018-013 確定** | PM/Dev | 0.5h | AS-100 | [x] Done（2026-05-02、`.gitignore` / LICENSE-MIT 配置完了） |
| AS-102 | Tauri 2.1 + Next.js 15 雛形生成（`output: 'export'`、`rust-toolchain.toml` で 1.94.0 pin） | Dev | 3h | AS-101 | [x] Done（2026-05-02、cargo check / tsc PASS） |
| AS-103 | shadcn/ui 初期化、Tailwind 3.4 設定、Geist Sans/Mono、lucide-react、next-themes 導入 | Dev | 2h | AS-102 | [x] Done（2026-05-02） |
| AS-104 | **浅葱 primary accent token 統合**（既存 `app/design/tokens.css` を雛形に組込、Tokyo Night Storm ダークテーマ確立） | Dev | 1h | AS-103 | [x] Done（2026-05-02、tokens.css 雛形組込完了） |
| AS-105 | **SQLite 基盤導入**（rusqlite bundled、`sessions` / `messages` / `attachments` テーブルの初期 schema、migration 雛形） | Dev | 2h | AS-102 | [x] Done（2026-05-02、初期 schema + migration 雛形配置） |
| AS-106 | **初回コミット**（Tauri 雛形 + tokens 統合 + SQLite 基盤、`feat: v0.1.0 scaffold`、本コミットはローカル保留 → AS-DEPLOY-01 で push） | Dev | 0.5h | AS-104, AS-105 | [x] Done（2026-05-02、コミット `cf098bd` ローカル保留中、push は OWNER-TODO 4） |
| AS-107 | next-intl 導入、日本語ロケールデフォルト、英語切替 stub | Dev | 1.5h | AS-103 | [x] Done（2026-05-02 third、シェル実装で完遂） |
| AS-108 | 3 ペインレイアウト雛形（左 ProjectRail 48px + Sidebar 240px + 中央 Chat + 右 Inspector 320px） | Dev | 3h | AS-104 | [x] Done（2026-05-02 third、ProjectRail / ChatPane / Inspector 完成） |
| AS-109 | TitleBar / StatusBar 雛形、framer-motion 導入と基本 transition | Dev | 2h | AS-108 | [x] Done（2026-05-02 third、TitleBar / StatusBar 雛形完成） |
| AS-109b | Welcome 4 画面ウィザード（ブランド紹介 → ChatGPT OAuth → 権限確認 → サンプル体験） | Dev | 5h | AS-109 | [x] Done（2026-05-02 third、シェル実装で完遂、AS-117 で強化中） |
| AS-110 | ChatGPT サブスク OAuth フロー設計（`@tauri-apps/plugin-shell` で外部ブラウザ起動 → callback localhost listener） | Dev/Research | 6h | AS-108 | [ ] **Phase 0 POC ゲート通過後着手（DEC-018-014 ハイブリッド運用）**。リサーチ v1 § 4 完了済 + Phase 0 POC #1 で実機検証予定 |
| AS-111 | OAuth トークン keyring 2 保管（Win Credential Manager / macOS Keychain / Linux Secret Service） | Dev | 3h | AS-110 | [ ] |
| AS-112 | API Key フォールバック入力 UI（OAuth 失敗時、Should） | Dev | 2h | AS-111 | [ ] |
| AS-120 | Codex CLI sidecar 起動仕様確定（`Command::spawn`、引数、環境変数、stdout 形式） | Dev/Research | 4h | AS-110 | [ ] **Phase 0 POC ゲート通過後着手（DEC-018-014 ハイブリッド運用）**。リサーチ v1 § 2 / § 7 完了済 + Phase 0 POC #2 で実機検証予定 |
| AS-121 | Rust 側 sidecar 管理: spawn / health check / graceful kill / stdout NDJSON parser | Dev | 6h | AS-120 | [ ] **Phase 0 POC ゲート通過後着手（DEC-018-014）** |
| AS-122 | Tauri command `agent_send_message(project_id, text)` / event `agent:{projectId}:assistant_message_delta` 設計 | Dev | 3h | AS-121 | [x] Done（2026-05-02 fifth、AS-134 で代替実装完了。`agent_spawn_sidecar` / `agent_send_message_v2` / `agent_shutdown_sidecar` / `agent_list_sidecars` / `agent_status` の 5 commands + `agent:{projectId}:{event}` 形式 emit 完成。real 切替は AS-140 で対応） |
| AS-123 | 基本チャット UI（streaming 表示、reasoning effort 表現、tool_use 表示、cancel ボタン） | Dev | 5h | AS-122 | [ ] AS-144 で ChatPane へ統合予定（mock 範囲先行 → POC 後 real 切替） |
| AS-124 | Codex 出力日本語整形ラッパー（英語出力を `[Codex] 思考中…` 等の日本語コンテキストに整形） | Dev | 2h | AS-123 | [ ] |
| AS-125 | 画像 D&D + Ctrl+V（arboard + wl-paste fallback、Tauri command 化、Codex CLI が画像入力対応する範囲で） | Dev | 4h | AS-123 | [ ] AS-142 で実装（mock の `codex/imagePaste` 完成済、real 接続は POC 後） |
| AS-128 | SQLite session schema 設計（`sessions` / `messages` / `attachments` テーブル、`project_id` 列含む） | Dev | 2h | AS-122 | [ ] |
| AS-129 | session CRUD Tauri command（`create_session` / `list_sessions(project_id?)` / `get_session` / `delete_session`） | Dev | 4h | AS-128 | [ ] |
| AS-130 | codex_sidecar trait + SidecarMode enum + Real/Mock factory（`codex_sidecar/mod.rs` / `real.rs` / `mock.rs`、`ASAGI_SIDECAR_MODE=mock\|real` 切替） | Dev | 完了 | AS-105 | [x] Done（2026-05-02 fifth、DEC-018-022、commit `cff4ded`、cargo test pass） |
| AS-131 | JSON-RPC 2.0 メッセージ型（Rust `protocol.rs` + TS `lib/codex/schemas.ts`、CodexRequest/Response/Error/Notification + 高レベル param/result + 型ガード） | Dev | 完了 | AS-130 | [x] Done（2026-05-02 fifth、DEC-018-022、commit `cff4ded`） |
| AS-132 | mock app-server 単体起動（`bin/mock_codex_app_server.rs` + `mock_server::run_stdio_server`、`cargo run --bin mock-codex-app-server` で stdio JSON-RPC 起動可能） | Dev | 完了 | AS-131 | [x] Done（2026-05-02 fifth、DEC-018-022、commit `cff4ded`） |
| AS-133 | WinJobObject 実装 + Win11 単体テスト（`process/jobobject.rs`、`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` で Drop 時に子 kill、Win11 ローカル実機 pass） | Dev | 完了 | — | [x] Done（2026-05-02 fifth、DEC-018-022、commit `cff4ded`、`jobobject_kills_child_on_drop` pass） |
| AS-134 | MultiSidecarManager（`HashMap<ProjectId, Box<dyn CodexSidecar>>` + RwLock + Tauri commands 5 個 + notification pump で `agent:{projectId}:{event}` emit） | Dev | 完了 | AS-130 | [x] Done（2026-05-02 fifth、DEC-018-022、commit `cff4ded`、3 project 並列 isolation テスト pass） |
| AS-135 | TS bridge + dev 検証ページ（`lib/codex/{schemas, sidecar-client, use-codex}.ts` + `app/dev/codex-mock/page.tsx`、`npm run dev` → http://localhost:3000/dev/codex-mock で mock sidecar 動作確認可能） | Dev | 完了 | AS-134 | [x] Done（2026-05-02 fifth、DEC-018-022、commit `cff4ded`、tsc / next build pass） |
| **AS-136** | **DEC-018-023 反映: mock 実装の API surface を Real Codex app-server に完全準拠リネーム**（method 名 `codex/chat` → `turn/start`、event 名 `codex/event/assistant_message_delta` → `agent:*:item/agentMessage/delta`、`initialize` → `initialized` ハンドシェイク必須化、修正提案 P-1〜P-6 適用、内部応答は決定論的スタブ維持） | Dev | 完了 | AS-130〜135 | [x] Done（2026-05-02 sixth、DEC-018-023、Dev 部門が mock リネーム実装、想定報告書 `reports/dev-dec023-025-as144-145.md`） |
| **AS-137** | **DEC-018-025 反映: `MAX_CONCURRENT_SIDECARS = 8 → 6` に下方修正**（third-party OAuth 429 quota exceeded 軽減、コード上は定数 1 行修正） | Dev | 完了 | AS-134 | [x] Done（2026-05-02 sixth、DEC-018-025、RAs-17 軽減策） |
| **AS-146** | **ChatPane typing indicator**（DEC-018-026 ① A、`useCodexContext().awaitingFirstDelta` を購読、3 dot bounce、`role="status"` aria-live、最初の `item/agentMessage/delta` 受信で消滅） | Dev | 完了 | AS-144 mock | [x] Done（2026-05-02 seventh、DEC-018-026 ①、commit `70170d2`、`typing-indicator.tsx` 新規） |
| **AS-147** | **token estimator + per-message + session 累計 token 表示**（DEC-018-026 ① B、`token-estimator.ts`（ascii-words×1.3 + cjk-chars 単純合算）+ `chat.ts` store に `tokens` / `tokensThisSessionByProject` 追加 + `chat-status-badge.tsx` ChatSessionTokenCount + `message-item.tsx` per-message 表示、Real 切替時は `usage` event で差し替え） | Dev | 完了 | AS-144 mock | [x] Done（2026-05-02 seventh、DEC-018-026 ① B、commit `70170d2`、vitest token-estimator 5 件 pass） |
| **AS-148** | **turn/interrupt 中断ボタン + Tauri command 配線**（DEC-018-026 ① C、`agent_interrupt` Tauri command + mock の `running_turns` cancel-flag map + `mock_server.rs` を mpsc 単一 writer task に再構成し turn/interrupt と turn/start を並行可能化 + `input-area.tsx` に中断ボタン + `message-item.tsx` に「（中断されました）」マーカー） | Dev | 完了 | AS-144 mock | [x] Done（2026-05-02 seventh、DEC-018-026 ① C、commit `70170d2`、`mock_turn_interrupt_terminates_streaming_with_interrupted_status` テスト pass） |
| **AS-149** | **UX 微調整 (Cmd/Ctrl+Enter 送信 / Enter は改行 / auto-scroll / empty state mock hint / placeholder 更新)**（DEC-018-026 ① D、`input-area.tsx` keymap + `message-list.tsx` delta scroll + EMPTY_MESSAGES 安定参照 + i18n ja/en 文字列追加） | Dev | 完了 | AS-144 mock | [x] Done（2026-05-02 seventh、DEC-018-026 ① D、commit `70170d2`、Playwright `@codex-mock-ux` 5/5 pass） |
| **AS-150** | **zustand v5 latent re-render fix（バグ修正、副産物）**（`message-list.tsx` の selector 結果が新規配列を返していた問題を発見、`EMPTY_MESSAGES` 定数を module scope で安定参照化し、tokens 配列も同様に対処、無限 re-render を予防） | Dev | 完了 | AS-144 mock | [x] Done（2026-05-02 seventh、DEC-018-026 ① 派生、commit `70170d2`、再発防止 PR コメント記録） |
| AS-151 | M1 自己検収（4 ステップ AC 達成確認、Win11 + macOS 1 OS 動作確認）— **旧 AS-130 → 旧 AS-150 から再採番**（seventh update で AS-150 が zustand fix に再割当のため） | PM | 2h | AS-UX-11, AS-145 | [ ] M1 完了時に PM 実施（Wave 3 後） |
| **AS-UX-FIX-A** | **Bug A: チャットストリーミング文字重複バグの根本特定 + 修正**（DEC-018-039 W1）。症状: mock 応答が `mockmock app app-ser-server ver からの応答からの応答` のように各文節 / 文字が二重・interleave。調査対象: ①`chat-pane.tsx` L62-67 useEffect の `codex.messages` 全体監視ロジック ②`use-codex.ts` の delta accumulation ③`mock_server.rs` の mpsc writer (delta + 最終 message 二重送信疑い) ④`chat.ts` の `upsertAssistantStreaming` content 上書きロジック。DoD: ① mock mode で 1 ターン送信して文字重複ゼロを Playwright assert ② vitest で delta 単独受信時の content 累積を unit 検証 ③ real mode で同 logic がリグレッションしないことを cargo test ④ 修正前後で chat 表示の screenshot 比較を report 添付 ⑤ R-UX-5 (event 二重登録) との関連を最終確認し AS-UX-04 syncBoth 設計に regression なきこと assert | Dev | 1.5h | AS-UX-04 | [x] **Done**（2026-05-03、DEC-018-039 W1、根本原因 = `agent_spawn_sidecar` が StrictMode 二重 mount 時に pump task を 2 回起動 → 同一 broadcast を 2 回 forward。修正 = `MultiSidecarManager.spawn_for` を `Result<bool>` 化し新規時のみ pump 起動 + `use-codex.ts` に async listener race guard 追加。Playwright `chat-streaming-no-duplicate.spec.ts` 新規 PASS、cargo 69/69、vitest 51/51、tsc clean。詳細: `reports/dev-ux-fix-2026-05-03.md`） |
| **AS-UX-FIX-B** | **Bug B: Sidebar tab ラベル改行修正**（DEC-018-039 W1）。症状: `w-60` (240px) ÷ 3 タブ × icon + 4 字日本語で `実行状態` が改行。修正: `i18n/ja.json` L115 `"runtime": "実行状態"` → `"runtime": "実行"`、`i18n/en.json` L115 `"runtime": "Runtime"` → `"runtime": "Run"`。DoD: ① 240px width で 3 タブ全件 1 行表示 (Playwright assert) ② sidebar.test.tsx 既存 PASS 維持 ③ 改行ゼロを screenshot で確認 | Dev | 0.1h | — | [x] **Done**（2026-05-03、DEC-018-039 W1、AS-UX-FIX-A と同 PR squash、ja.json `"実行状態" → "実行"` / en.json `"Runtime" → "Run"`、Playwright `ux-sidebar-tabs.spec.ts` PASS、vitest 51/51） |
| **AS-UX-11** | **Inspector → Sidebar 統合 (Sumi v3.5.3 pattern, 4 タブ確定)**（DEC-018-039 W2、オーナー 2026-05-03 「4 タブで OK」確定）。スコープ: ①新規 `Rules` タブ追加 ②Inspector の subAgents / todos を既存 Runtime タブに統合 ③`<Inspector />` 物理削除 + ChatPane flex-1 expand ④Sidebar `w-64` 256px + tab `whitespace-nowrap` で Bug B 完全解決 ⑤i18n / a11y / KeyboardShortcuts 残存参照除去 ⑥テスト整備。 | Dev | 5.5h | AS-UX-FIX-A, AS-UX-FIX-B | [x] **Done**（2026-05-03、6 commit `d9e6f36..2d1f682`、Review ✅ 承認 Critical 0 / Major 0 / Minor 2、DoD 8/8 + 厳守 7/7、Bug B 解消 screenshot `tests/screenshots/sidebar-4tab-256px.png` で証跡、DEC-018-041 で merge 確定） |
| **AS-CLEAN-07** | **rules-tab.tsx の fetch ロジック二重定義整理**（DEC-018-041 Mn-1、Review backlog 起票）。Tauri 接続時 / fail-soft fallback の 2 経路で類似ロジックが二重定義されている箇所を共通関数化、可読性向上。動作影響なし。 | Dev | 0.3h | AS-UX-11 | [ ] backlog（M2 開始時 or AS-CLEAN-XX バッチで処理） |
| **AS-CLEAN-08** | **dev port を Asagi 専用 1420 に固定 (port 衝突 emergency hotfix)**。症状: オーナー実機で `npm run tauri dev` 実行時に他 Node プロセス (PID 35672) が port 3000 を占有 → Next.js が 3001 fallback → Tauri は `devUrl: http://localhost:3000` を見て 404 表示。修正: ①`package.json` `dev` script を `next dev -p 1420` 化 ②`tauri.conf.json` `devUrl` → `http://localhost:1420` ③`playwright.config.ts` baseURL + webServer.url → 1420 ④README.md / docs/dev-setup.md doc 更新。port 1420 は Tauri 公式 quickstart 標準 = Sumi (3000) + 他案件と衝突回避。 | CEO/Dev | 0.2h | — | [>] CEO 即修正完了（5 ファイル）、Dev (Yuto) に commit 投入指示中（`fix(config): pin Asagi dev port to 1420 to avoid Sumi/other Next.js collision (AS-CLEAN-08)`）、オーナー再起動 smoke 待ち |
| **AS-R-01** | **リサーチ: ChatGPT サブスク OAuth フロー仕様（公式 docs / Codex CLI ソース調査、TOS 解釈含む）** | Research | 並列 | — | [x] research-report-v1.md § 4 / § 6 完了 (2026-05-01)。DEC-018-011 で TOS リスク中→低格下げ |
| **AS-R-02** | **リサーチ: Codex CLI 起動引数 / stdout 形式 / streaming プロトコル / image input 仕様** | Research | 並列 | — | [x] research-report-v1.md § 2 / § 5 完了。DEC-018-009 / 012 確定。残不確実性は Phase 0 POC で実機検証 |
| **AS-R-03** | **リサーチ: Codex x5 プラン正式名称 / 利用枠 / 超過時挙動 / 課金体系** | Research | 並列 | — | [x] research-report-v1.md § 1 完了。ChatGPT Pro $100/月 5x tier、2026-05-31 まで 2x boost、6 月以降 5x 戻り |
| **AS-R-05** | **リサーチ継続: 残不確実性 12 件のうち U2 (OAuth flow detail) / U5 (Pro 5x quota 詳細) / U8 (sandbox policy 移植) を継続追跡（POC で部分検証後に再評価）** | Research/PM | 並列 | AS-R-02 | [ ] POC 結果受領後に着手 |
| **AS-DESIGN-01** | **ブランド設計 v1 を実装に組込: 浅葱色 oklch トークンを CSS variables に展開（AS-104 と統合）、ロゴ v1 3 案画像生成** | Design/Dev | 2h | AS-104 | [-] **v1 却下、v2 全案保留 → v3 再起案中（DEC-018-018）**。tokens.css 統合は AS-104 で完了済。v1 3 案はオーナーフィードバックで全案却下（DEC-018-016）、v2（A 古銅鏡 / B 半月 / C 印章）も保留（CEO 推奨 A、オーナー判定「全案保留、C が良さそう」）。v3 は stitch MCP 活用、案 C 中心、「趣（おもむき）のある感じ」方針で再起案中 |
| **AS-DESIGN-02** | **ロゴ v1 採用後の SVG 化 + multi-size 展開**（旧、v2 採用後は AS-DESIGN-04 に置換） | Design/Dev | 3h | AS-DESIGN-01 | [-] AS-DESIGN-04 に置換（v1 全案却下のため） |
| **AS-DESIGN-03** | **Sumi ロゴベンチマーク分析**（PRJ-012 配下から実物取得、ロゴ v2 重厚感の参照点として整理）— DEC-018-016 引用 | Design | 1h | — | [x] Done（2026-05-02 second、v2 起案の参照点として活用、v3 では「趣」方向に転換） |
| **AS-DESIGN-04** | **ロゴ採用案の SVG 化 + multi-size 展開**（採用案 PNG → SVG ベクター化、16/32/48/128/256/512px / favicon / Win MSI / macOS .icns / Linux .png 各サイズ生成、PWA manifest 用 maskable icon 含む、ライト/ダーク変種） | Design/Dev | 3h | AS-DESIGN-v3（γ 採用確定 DEC-018-020） | [x] **Done**（2026-05-02 seventh、DEC-018-026 ② で SVG マスター 5 種 / PNG 8 サイズ / ICO 2 種 / ICNS 1 を全件確認、ハッシュ照合で再生成不要を確定。`reports/dev-dec026-svg-final-as-meta-09.md` § 2 / § 3 参照） |
| **AS-DESIGN-v3** | **ロゴ v3 再起案（DEC-018-018）→ γ 浅葱滴 正式採用（DEC-018-020）**: stitch MCP 活用、案 C 中心バリエーション展開（α/β/γ/δ/ε 5 案）、CEO 推奨 γ → オーナー判断「CEO 推奨で行きましょう」で確定 | Design | 3h | AS-DESIGN-01（v2 全案保留） | [x] Done（2026-05-02 fourth、DEC-018-020、γ 浅葱滴 = `logo-v3-gamma-asagi-drop.png` を Asagi 正式アプリアイコンに確定） |
| **AS-CMD-STUB** | Codex 関連 Tauri command の型定義 + 空実装スタブ（`agent_send_message` / `list_sessions` 等のフロント側 contract 先行確立、本実装は AS-122 で sidecar 統合後） | Dev | 2h | AS-108 | [x] Done（2026-05-02 third、シェル完成と共に実装） |
| **AS-CMT-SHELL** | シェル実装完了時の中間コミット（AS-107〜109 + AS-CMD-STUB 完成時、`feat: shell layout (3-pane) and command stubs`） | Dev | 0.5h | AS-107, AS-108, AS-109, AS-CMD-STUB | [x] Done（2026-05-02 third、コミット `cdaadc6` ローカル保留、push 待ち） |
| **AS-114** | **コマンドパレット (Ctrl+K, cmdk)**: shadcn command palette の組込、組込コマンド検索（DEC-018-019、UX 完成度向上） | Dev | 3h | AS-108 | [x] Done（2026-05-02 fourth、UX 強化完遂、コミット `acf5f70`） |
| **AS-115** | **SlashPalette (`/` トリガ)**: コマンド一覧表示・実行（モック、Codex 統合は POC 後） | Dev | 2h | AS-114 | [x] Done（2026-05-02 fourth、コミット `acf5f70`） |
| **AS-116** | **テーマ切替（next-themes）**: ダーク/ライト切替、Tokyo Night Storm 派生 light、浅葱アクセント保持 | Dev | 2h | AS-104 | [x] Done（2026-05-02 fourth、コミット `acf5f70`） |
| **AS-117** | **Welcome 4 画面ウィザード強化**: ブランド紹介 → ChatGPT OAuth (モック) → 権限確認 → サンプル体験、framer-motion アニメーション追加 | Dev | 4h | AS-109b | [x] Done（2026-05-02 fourth、コミット `acf5f70`） |
| **AS-118** | **SQLite UI 統合**: session 一覧 / 新規作成 / 削除 UI を Sidebar に組込（モック CRUD、本実装は AS-129 で本番化） | Dev | 4h | AS-105, AS-108 | [x] Done（2026-05-02 fourth、コミット `acf5f70`） |
| **AS-119** | **i18n 完成度向上**: 主要 UI 文字列の next-intl 経由化、英語切替動作確認 | Dev | 2h | AS-107 | [x] Done（2026-05-02 fourth、コミット `acf5f70`） |
| **AS-119b** | **Toast 通知（sonner）**: 操作フィードバック・エラー表示の統一 | Dev | 1.5h | AS-108 | [x] Done（2026-05-02 fourth、コミット `acf5f70`） |
| **AS-119c** | **キーバインド体系**: 主要操作のキーボードショートカット（Ctrl+N / Ctrl+W / Ctrl+, 等）、help dialog | Dev | 2h | AS-114 | [x] Done（2026-05-02 fourth、コミット `acf5f70`） |
| **AS-119d** | **微細仕上げ**: 余白 / hover 状態 / focus ring / ローディング表現の統一、a11y 基本対応 | Dev | 2h | AS-108, AS-109 | [x] Done（2026-05-02 fourth、コミット `acf5f70`） |
| **AS-CMT-UX** | **UX 強化フェーズの中間コミット**（AS-114〜119d 完成時、`feat: ux polish (palette / theme / sqlite ui / i18n / toast / keybind)`） | Dev | 0.5h | AS-114〜119d | [x] Done（2026-05-02 fourth、コミット `acf5f70` ローカル保留・push 待ち） |
| **AS-META-01** | **GitHub Actions CI 設定**: `cargo check` / `tsc --noEmit` / lint / test の matrix（windows / macos / ubuntu）整備 | Dev | 3h | AS-106 | [>] In Progress（DEC-018-021、品質基盤並列着手） |
| **AS-META-02** | **vitest 導入 + 初期スイート**: フロント側ユニットテスト基盤、サンプル test 1〜2 件 | Dev | 2h | AS-103 | [>] In Progress（DEC-018-021） |
| **AS-META-03** | **Playwright for Tauri スモークテスト雛形**: 起動 → Welcome → 3 ペイン表示の e2e 雛形 | Dev/Review | 3h | AS-108, AS-META-02 | [>] In Progress（DEC-018-021） |
| **AS-META-04** | **README 整備**: プロダクト概要 / セットアップ手順 / 開発コマンド一覧 / スクショ 1 枚（v0.1.0 段階） | Dev/PM | 2h | AS-106 | [>] In Progress（DEC-018-021） |
| **AS-META-05** | **CONTRIBUTING / 開発ガイド docs**: ディレクトリ構成 / コミット規約 / ブランチ戦略 | Dev/PM | 1.5h | AS-META-04 | [>] In Progress（DEC-018-021） |
| **AS-META-06** | **設定永続化基盤**: `~/.asagi/settings.json`（テーマ・言語・最後に開いた project）読み書きラッパー | Dev | 3h | AS-105 | [>] In Progress（DEC-018-021、M2 AS-213 の前倒し基盤） |
| **AS-META-07** | **エラーバウンダリ + クラッシュレポート枠**: React Error Boundary + Tauri 側 panic ログ収集の最低限実装 | Dev | 2h | AS-108 | [>] In Progress（DEC-018-021） |
| **AS-META-08** | **a11y 監査ベースライン**: axe-core / Playwright a11y check の組込、現状スコア記録 | Dev/Review | 2h | AS-META-03 | [>] In Progress（DEC-018-021） |
| **AS-META-09** | **アイコン組込み準備**: `tauri.conf.json` icons 配列 / `app/icon` 配置の receiver 整備（実アイコンはデザイナー成果待ち） | Dev | 1h | AS-DESIGN-04 | [x] **Done**（2026-05-02 seventh、**DEC-018-031**、DoD 16/16 全充足。`tauri.conf.json` bundle.icon 5 ファイル全列挙 + `layout.tsx` Metadata に PNG favicon (16/32) + apple-touch-icon (180) + Viewport.themeColor dark/light 分離 + BRAND.md § 9 開発側 import パス最終化 26 件、commits `b5157a0`(asagi-app inner) + `12f57a0`(parent claude-code-company)） |
| **AS-META-10** | **品質基盤フェーズの中間コミット**（AS-META-01〜09 完成時、`chore: meta foundation (ci / vitest / playwright / docs / settings / errors / a11y / icon)`） | Dev | 0.5h | AS-META-01〜09 | [>] In Progress（DEC-018-021、品質基盤完了後にコミット予定） |
| **AS-DEPLOY-01** | **初回 push（`git push origin main`、オーナー認証で実行）**。AS-106 完了の v0.1.0 雛形コミットをリモート `hironori-oi/Asagi` に push、main に初期化 | Owner/Dev | 0.5h | AS-106 | [ ] AS-106 完了後にオーナー実行（OWNER-TODO 4。コミット累積 5 件: `cf098bd` / `cdaadc6` / `acf5f70` / META 中間 / `cff4ded`） |
| **AS-POC-01** | **Phase 0 POC 実機実行（オーナー、半日）、結果記入 (`reports/poc-phase0-result-template.md`)** | Owner | 4h | — | [>] スクリプト・テンプレ整備完了、オーナー実行待ち（OWNER-TODO 2、最優先） |
| **AS-POC-02** | **POC 結果受領 → DEC-018-013 反映拡張（ハイブリッド運用 DEC-018-014 と統合） → tasks.md / risks.md / brief.md 反映** | PM/CEO | 2h | AS-POC-01 | [ ] DEC-018-013 起票済（v0.1.0 着手承認）、POC 結果受領で DEC-018-014 ハイブリッド運用条項を確定化 |

### AS-140 系列: Codex sidecar Real 実装（POC 通過後着手厳守、DEC-018-022 の足場の上に積層）

| ID | タスク | 担当 | 工数 | 依存 | 優先度 | ステータス |
|---|---|---|---|---|---|---|
| **AS-140** | `codex_sidecar/real.rs` Real impl: `tokio::process::Command::new("codex").arg("app-server").arg("--listen").arg("stdio")` spawn + stdout/stderr reader task + line-delimited JSON-RPC stdin/stdout 配線 + RequestId pending HashMap + oneshot 応答 + 60s timeout + readiness signal 待機（`codex/event/ready`） | Dev | 6h | AS-POC-02, AS-130 | **最優先（POC 通過直後）** | [!] **Blocked: Phase 0 POC 通過後着手厳守（DEC-018-014）**。足場 AS-130〜135 完備、§4 TODO リスト消化のみ |
| **AS-141** | `auth.rs`: `keyring 2` で `~/.codex/auth.json` 由来の credentials を OS secret store に保管 + 自動 refresh（OAuth token expiry 前に再取得） + `tauri-plugin-shell::open("codex login")` 起動ラッパー | Dev | 4h | AS-140 | 高 | [!] **Blocked: AS-140 完了後着手** |
| **AS-142** | `image_paste.rs`: クリップボード画像 → base64 encode → `codex/imagePaste` JSON-RPC 送信 → SHA-256 / byte 数応答受領 → ChatPane に attachment chip 表示。arboard クレート使用（Win/Mac/Linux 互換） | Dev | 4h | AS-140 | 中 | [!] **Blocked: AS-140 完了後着手**。mock 側 `codex/imagePaste` は AS-132 で完成済 |
| **AS-143** | WinJobObject を Real spawn と接続（`RealCodexSidecar::start()` 内で `WinJobObject::create()` + `assign_pid(child.id())` を呼び、Drop 時に確実に子の子まで kill） | Dev | 1h | AS-140, AS-133 | 高 | [!] **Blocked: AS-140 完了後着手**。AS-133 で WinJobObject 単体は実装 + Win11 pass 済 |
| **AS-144** | 既存 ChatPane を `use-codex` hook 経由で MultiSidecarManager に接続。mock 範囲（spawn → message → done）を ChatPane で先行動作確認 → POC 通過後 real 切替で同 UI が即動作 | Dev | 4h | AS-135（mock 範囲）／ AS-140（real 切替） | 高 | [x] **mock 範囲 Done（2026-05-02 sixth、DEC-018-022 足場活用）**。real 切替は AS-140 完了後 [!] Blocked |
| **AS-145** | E2E テスト（Playwright for Tauri）: mock mode で 1 シナリオ追加 = `npm run tauri dev` 起動 → `/dev/codex-mock` または ChatPane で spawn → メッセージ送信 → assistant_message_delta streaming 受信 → done → shutdown → サイドカー一覧から消える、までを assert | Dev/Review | 4h | AS-144（mock 範囲）／ AS-META-03 | 中 | [x] **mock 範囲 Done（2026-05-02 sixth）+ real シナリオ Done（2026-05-03 AS-145.1〜.4 全完遂、4 test `@codex-real-smoke` タグで Playwright 雛形 + 手動 smoke 手順 + AS-CLEAN-11/12 恒久回帰スイート + smoke 報告書 `dev-as145-smoke-2026-05-03.md` 納品。詳細: `reports/pm-as145-wbs-2026-05-03.md` / commits 9480626, f51862d, 1196ef8）** |

**AS-140 系列累計**: 約 23h（POC 通過後、Real impl 全体）／ うち mock 範囲先行可は AS-144 mock 部 + AS-145 mock 部 = 約 5h

### AS-UX 系列: Sumi 準拠 UX 再設計（DEC-018-037、案 B 段階方式、AS-145 より優先）

**起点**: 2026-05-03 オーナー指摘「画面構成について、左サイドバーの内容やモデルや推論の深さの選択位置、ステータスバーの内容など、sumi をしっかりと参考にして設計するように」
**参照**: `reports/research-sumi-ux-survey-2026-05-02.md`（Sumi v1.42.0 UX 徹底解剖）／ `reports/dev-asagi-ux-current-state-2026-05-02.md`（Asagi 現状 + 既存資産棚卸）

#### Must（M1 完成までに対応必須、合計 12h）

| ID | タスク | 担当 | 工数 | 依存 | 優先度 | ステータス |
|---|---|---|---|---|---|---|
| **AS-UX-01** | **TrayBar 新設**（TitleBar 直下、高さ 32px、Model picker + Effort picker 2 件を Popover-based radiogroup で集約配置）。実装ヒント: `src/components/layout/tray-bar.tsx` 新規 + `app-shell.tsx` の grid に挿入 + `useChatStore.modelByProject / effortByProject` 直接参照（Sumi DEC-053 / per-query options 渡し相当、argv 再起動なし）。Popover trigger は高さ 24px、icon (Cpu/Gauge) + 略号表示 | Dev | 3h | AS-144 完了 | **最優先** | [x] **Done** 2026-05-03 (Yuto): tray-bar.tsx 新規 + app-shell.tsx 挿入 + i18n ja/en 拡張 + vitest 2/2 + Playwright @ux-traybar 1/1 (PR-1) |
| **AS-UX-02** | **InputArea からの ModelSelect / EffortSelect 削除**（TrayBar 移行に伴う cleanup）。`src/components/chat/input-area.tsx` L170-173 / L236-254 / L256-291 削除 + 関連 import / handler 整理。AS-UX-01 と同 PR | Dev | 0.5h | AS-UX-01 | 最優先 | [x] **Done** 2026-05-03 (Yuto): input-area.tsx picker DOM + ModelSelect/EffortSelect 削除 + Brain/Gauge import 整理 + @codex-mock-ux + @smoke regression PASS (PR-1) |
| **AS-UX-03** | **StatusBar に Sidecar Mode badge 追加**（ChatPane header の `ChatSidecarModeBadge` から StatusBar へ移動 + ChatPane 側削除）。`src/components/layout/status-bar.tsx` 右側 quota 直前に挿入、`useSidecarModeStore` 流用、icon = FlaskConical (mock) / PlugZap (real) | Dev | 1h | AS-UX-01 | 高 | [x] **Done** 2026-05-03 (Yuto): status-bar.tsx に SidecarModeBadge inline 追加 + chat-pane.tsx から `<ChatSidecarModeBadge />` 削除 + 旧関数を chat-status-badge.tsx から削除 (PR-3) |
| **AS-UX-04** | **StatusBar Activity summary 実装**（pulse animation + "thinking..." / "streaming..." / idle 表示）。Tauri event listener (`agent:{projectId}:item/agentMessage/delta` + `turn/started` + `turn/completed`) 購読 + zustand 新規 store `useChatActivityStore`（perSession state: 'idle'\|'thinking'\|'streaming'）+ StatusBar 中央に配置、pulse 1.5s infinite | Dev | 1.5h | AS-UX-03 | 高 | [x] **Done** 2026-05-03 (Yuto): chat-activity.ts (zustand) 新規 + ChatPane で useCodex.status/awaitingFirstDelta を syncBoth 経由橋渡し + ActivitySummary inline + i18n shell.statusbar.activity 追加 + vitest 6/6 (PR-3) |
| **AS-UX-05** | **Sidebar 5-tab 化 第 1 弾**（3 タブ: Sessions / Files / 実行状態（runtime））。`src/components/sidebar/sidebar.tsx` 上部に `role="tablist"` 配置 + animated underline indicator + localStorage で前回 tab 復元 + Cmd+B / Ctrl+B でトグル + collapsed 時 48px icon-only。Files タブは shallow tree（cwd 直下のみ、react-arborist は AS-UX-07 で対応）/ 実行状態タブは `useMultiSidecarStore` + 既存 quota 表示転用 | Dev | 4h | AS-144 完了 | **最優先** | [x] **Done** 2026-05-03 (Yuto): sidebar.tsx WAI-ARIA tablist + sessions/files/runtime-tab.tsx 新規 + ui store persist + Cmd+B + list_dir Tauri command 新規 + i18n ja/en + vitest 3/3 + Playwright @ux-sidebar-tabs 1/1 (PR-2) |
| **AS-UX-06** | **ProjectRail status indicator dot 実装**（4px dot、5 段: idle/thinking/streaming/completed/error、color = muted/amber/blue/green/red）。`src/components/project-rail/project-rail.tsx` の各プロジェクトアイコン右下に絶対配置 + AS-UX-04 の `useChatActivityStore` 経由 perProject state 集約 + Codex event (`agent:{projectId}:*`) 購読 | Dev | 2h | AS-UX-04 | 中 | [x] **Done** 2026-05-03 (Yuto): project-icon.tsx 右下に 8px dot (ring-2 ring-surface) + STATUS_DOT_COLOR map + thinking/streaming は animate-pulse + idle は非表示 + useChatActivityStore.stateByProject 購読 (PR-3) |

**Must 累計**: 12h（AS-UX-01 → 02 → 05 → 06 → 03 → 04 順、または並列化判定は PM WBS で確定）

#### Should（M1.1 へ繰延、合計 9.5h）

| ID | タスク | 担当 | 工数 | 依存 | 優先度 | ステータス |
|---|---|---|---|---|---|---|
| **AS-UX-07** | **Sidebar Files タブ強化**（react-arborist 導入 or 同等の自作 tree）。AS-UX-05 の shallow tree を再帰展開 + 検索 input + glob filter + 折り畳み状態 persist | Dev | 4h | AS-UX-05 | 中 | [ ] M1.1 backlog |
| **AS-UX-08** | **Session context menu**（rename / pin / delete）。`src/components/sidebar/session-item.tsx` 右クリック context menu（shadcn ContextMenu）+ session-preferences store 拡張で pinned 状態管理 + Sessions タブ filter chip（all / pinned / recent） | Dev | 2h | AS-UX-05 | 中 | [ ] M1.1 backlog |
| **AS-UX-09** | **StatusBar Branch（git status polling）**（hardcode 「未取得」を実装に置換）。Tauri command `git_get_branch(cwd)` 新規 + 5 秒 polling + GitBranch icon + 「未取得」fallback 維持 | Dev | 2h | AS-UX-04 | 低 | [ ] M1.1 backlog |
| **AS-UX-10** | **TrayBar Codex 接続モード picker 移設**（Settings drawer から TrayBar 右端へ移動）。AS-144 `useSidecarModeStore` をそのまま流用、頻繁切替 UX 改善（dev/owner 実機 smoke 時の往復削減）。Settings drawer から該当セクション削除 + TrayBar 右端に小型 Popover button 追加 | Dev | 1.5h | AS-UX-01 | 低 | [ ] M1.1 backlog |

**Should 累計**: 9.5h

#### Won't（DEC-018-037 で対象外確定）

- Anthropic オレンジ accent（Asagi は浅葱 oklch(0.72 0.10 200)、DEC-018 確定）
- Claude Code 専用 hooks（Codex には別概念）
- workspace 切替（M1 では single workspace、M3 以降）
- ルール tab の「CLAUDE.md」名称（Asagi では `AGENTS.md` 等、AS-R-04 確定後）
- PermissionMode picker（Codex approval mode 仕様確定が M2 案件、F1〜F4 完了後）
- Sidebar 5-tab の ④サーバー / ③ルール（M1.1 以降、AS-UX-07/08 完了後に評価）

**AS-UX 系列 Must 累計**: 12h（M1 内）／ Should 累計: 9.5h（M1.1）／ 合計: 21.5h

**M1 完成順序の調整**: AS-UX-01〜06（12h、UI 構造確定）→ AS-145 (E2E real シナリオ 2h、UI 確定後に書く方が rework 回避) → CEO 決裁ゲート ② → M1 完成。M1 完成は本 DEC で約 1.5 営業日後ろ倒し（DEC-018-037 で許容済）。

**M1 累計**: 約 60h + Phase 0 POC 4h + ブランド組込 2h + リサーチ継続 (並列) + UX 強化 (AS-114〜119d, +約 23h) + 品質基盤 (AS-META-01〜10, +約 20h) + ロゴ SVG 化 (AS-DESIGN-04, +3h) + sidecar 足場 (AS-130〜135, 完了済) + DEC-018-023〜025 反映 (AS-136/137, 完了済) + sidecar Real impl (AS-140〜143 + 144/145 real 部, +約 18h、mock 範囲 5h は完了済) + AS-150 M1 自己検収 (2h) ≒ 約 137h（POC 結果次第で再見積、sixth update で mock 範囲完了済 → 残工数 5h 削減見込み）

**Gate-AS-M1（M1 終了時 review）**: AS-151 達成後（旧 AS-150、seventh update で AS-150 が zustand fix に再割当）、レビュー部門に設計レビュー依頼（Tauri capability、a11y、Rx-L1 LICENSE、OAuth セキュリティ）

**前段ゲート (Phase 0)**: AS-POC-01 → AS-POC-02 → DEC-018-013 起票後に M1 (AS-100〜) 着手。AS-140〜143 / AS-144 real 部 / AS-145 real 部は POC 通過後着手厳守

---

## M2 Daily Driver（6 週、暫定 100h、Gate-AS-E2）

**ゴール**: オーナーが 7 日連続 Cursor / VSCode Codex 拡張ゼロ起動で Asagi のみで作業できる

| ID | タスク | 担当 | 工数 | 依存 | ステータス |
|---|---|---|---|---|---|
| AS-200 | Project registry 設計（`~/.asagi/registry.json`、`RegisteredProject[]`、id ハッシュ 8 色） | Dev | 3h | AS-129 | [ ] |
| AS-201 | ProjectRail UI（`+` ボタン、48px 縦アイコン、active 浅葱 ring、Tooltip で title + phase） | Dev | 4h | AS-200 | [ ] |
| AS-202 | activeProjectId state（Zustand）、Chat / StatusPane / Inspector / SessionList の同時更新 | Dev | 3h | AS-201 | [ ] |
| AS-210 | **Multi-Sidecar Architecture**: Rust 側 `HashMap<projectId, CodexSidecarHandle>`、lazy start、kill on remove | Dev | 8h | AS-121, AS-202 | [ ] |
| AS-211 | Tauri event prefix 化（`agent:{projectId}:*`）、event 混線テスト | Dev | 3h | AS-210 | [ ] |
| AS-212 | RAM 警告 toast（10 project 同時起動時、sonner） | Dev | 1.5h | AS-210 | [ ] |
| AS-213 | Per-project 設定永続化（last session / preferred model / reasoning effort、`registry.json` 拡張） | Dev | 3h | AS-210 | [ ] |
| AS-220 | Monaco DiffEditor 導入、Codex の編集提案を before/after 展開（GUI 最大の武器） | Dev | 6h | AS-123 | [ ] |
| AS-221 | サイドバー常設化（reasoning effort gauge、SubAgents stub、Todos 表示） | Dev | 4h | AS-220 | [ ] |
| AS-222 | shadcn command palette（Ctrl+K, cmdk）、組込コマンド検索 | Dev | 3h | AS-202 | [ ] |
| AS-223 | SlashPalette（`/` トリガ、`.codex/commands/*.md` or `.asagi/commands/*.md` 検索＋実行） | Dev | 4h | AS-222 | [ ] |
| AS-224 | StatusBar（model 表示 / context % / branch / プラン残枠表示） | Dev | 3h | AS-221 | [ ] |
| AS-225 | ダーク/ライト切替（next-themes、Tokyo Night Storm 派生 light、浅葱アクセント保持） | Dev | 2h | AS-104 | [ ] |
| AS-226 | StatusPane（active project の `STATUS.md` / `TODO.md` / `progress.md` 自動検出 Monaco preview、5 秒 polling） | Dev | 3h | AS-202 | [ ] |
| AS-230 | M2 AC 計測（オーナー 7 日連続 Cursor/VSCode Codex 拡張ゼロ起動カウンタ、Gate-AS-E2 判定材料） | PM | 1h | AS-226 | [ ] |

**M2 累計**: M1 60h + M2 約 50h = 110h

**Gate-AS-E2（最重要、Week6 末相当）**: Sumi Gate-E2v3 と同形。AC 未達 → 1 週クールダウン後に凍結判定 / リカバリ A〜D を CEO と協議

---

## M3 Full MVP（8 週、暫定 150h）

**ゴール**: 自己検収 + 配布可能なインストーラ完成 + 友人に触らせて反応収集

| ID | タスク | 担当 | 工数 | 依存 | ステータス |
|---|---|---|---|---|---|
| AS-300 | FTS5 導入（rusqlite bundled features = ["bundled", "backup"]、`messages_fts` virtual table） | Dev | 3h | AS-128 | [ ] |
| AS-301 | FTS5 検索 Tauri command（`search_messages(query, project_id?, limit)`、snippet ハイライト） | Dev | 4h | AS-300 | [ ] |
| AS-302 | Ctrl+Shift+F 検索 UI（modal、結果クリックで該当セッション復元） | Dev | 4h | AS-301 | [ ] |
| AS-310 | CLAUDE.md 相当（Codex 文脈は `AGENTS.md` 等、リサーチ AS-R-04 で確定）編集モード | Dev/Research | 5h | AS-220 | [!] リサーチ AS-R-04 待ち |
| AS-311 | 編集モード 3 スコープ切替（global / project / session） | Dev | 3h | AS-310 | [ ] |
| AS-320 | worktree 連携（git worktree add / remove、Sidebar タブ、new/delete dialog） | Dev | 6h | AS-202 | [ ] |
| AS-321 | テーマカスタム（ユーザーカラーパレット、Could、浅葱を base に色相シフト） | Dev | 3h | AS-225 | [ ] |
| AS-322 | i18n 英語切替の完成（next-intl、shadcn 標準文字列翻訳完了） | Dev | 4h | AS-105 | [ ] |
| AS-330 | `tauri build` matrix（windows-latest / macos-latest / ubuntu-latest）、MSI / DMG / AppImage 生成 | Dev | 5h | AS-302 | [ ] |
| AS-331 | 自己配布手順整備（GitHub Release private、電子署名なし、Win SmartScreen 警告手順） | Dev | 2h | AS-330 | [ ] |
| AS-332 | README + スクリーンショット 5 枚 + 30 秒デモ動画 + LICENSE-MIT | PM/Dev | 4h | AS-331 | [ ] |
| AS-333 | **自己検収（オーナー dogfooding 7 日 + 友人 1 人にインストールさせて反応収集）** | PM | 7h | AS-332 | [ ] |
| AS-334 | KPT 振り返り、`organization/knowledge/prj-018-lessons-learned.md` 起案、Sumi へ知見フィードバック | PM | 3h | AS-333 | [ ] |
| **AS-R-04** | **リサーチ: Codex 文脈の組織メモリ規約名（`AGENTS.md` / `CODEX.md` 等、公式 docs 確認）** | Research | 並列 | — | [ ] |

**M3 累計**: M2 110h + M3 約 50h + バッファ = 約 150h

---

## 並列・横断タスク（M1〜M3 通算）

| ID | タスク | 担当 | 工数 | ステータス |
|---|---|---|---|---|
| AS-Q-01 | Playwright for Tauri スクショ比較（Win/Mac/Linux 3 OS 比較）CI 設定 | Dev/Review | 4h | [ ] |
| AS-Q-02 | `cargo about` + `license-checker` で第三者ライセンス監査 | Dev | 1h | [ ] |
| AS-Q-03 | Codex CLI release watch（週次、major 変更追随判定、特に JSON-RPC スキーマ変更追随、RAs-14 連動）— **`codex-schema-watch` GitHub Actions ワークフロー雛形を実装**（毎週月曜 09:00 JST cron、`codex app-server generate-ts` 自動 diff、差分時に Issue 自動起票 label `codex-schema-drift`） | Research/PM | 0.25h × 8 週 → CI 自動化で 0h | [x] **CI 雛形 Done（2026-05-02 sixth、リサーチ部門が `app/asagi-app/.github/workflows/codex-schema-watch.yml` 実装、想定報告書 `reports/research-generate-ts-ci-implementation.md` ／ `research-report-v2-addendum-generate-ts.md`、次週月曜に CI 初回起動で initial baseline snapshot 自動生成）**。RAs-14「中の上」→「中」に再下降 |
| AS-Q-04 | OpenAI / ChatGPT Terms of Service 月次確認（特に OAuth ラッピング規約変動） | PM | 0.5h × 2 ヶ月 | [ ] |
| AS-Q-05 | レビュー部門依頼（M1 Gate / M2 Gate / M3 最終） | PM | — | [ ] |
| AS-Q-06 | M1 着手後の週次マイルストーン管理（reports/pm-m1-weekly-milestones.md に従い Week1〜4 末でレビュー） | PM | 1h × 4 週 | [ ] M1 着手後 |
| AS-CLEAN-01 | clippy 既存 5 件の解消（mock.rs `doc_overindented_list_items` x3 + `while_let_loop` x1 / protocol.rs `doc_overindented_list_items` x1 / commands/mod.rs `while_let_loop` x1） — 全件 commit `72ee23e` 由来、AS-140〜143 由来 0 件。Review DEC-018-036 の merge 条件 ① | Dev | 1h | M2 開始時 | [ ] backlog（DEC-018-036 起票） |
| AS-CLEAN-02 | `protocol.rs::mod method` / `mod event` を `contract.rs` 定数から `pub use` 再公開化（M-1 単一定義原則）+ `mock.rs` / `mock_server.rs` の `"agentMessage"` 生リテラルを `contract::ITEM_COMPLETED_AGENT_TYPE` 置換（M-3）。Review DEC-018-036 の merge 条件 ② | Dev | 1.5h | M2 開始時 | [ ] backlog（DEC-018-036 起票） |
| AS-CLEAN-03 | `Cargo.toml` `[package]` に `default-run = "asagi"` を追加（AS-132 で mock-codex-app-server バイナリ追加以降、`tauri dev` が `cargo run` で binary 決定不能になっていた既存負題） | Dev | 0.1h | — | [x] **2026-05-02 完了** (commit `7706a1b`、オーナー smoke 4 実行中に発覚 → CEO 緊急対応で即修正、cargo check PASS) |
| AS-CLEAN-04 | `tauri.conf.json` `plugins.shell.scope` 削除（tauri-plugin-shell 2.3.5 で fields 廃止、Deserialize panic）。M2 で security review 部門が `src-tauri/permissions/shell-codex.toml` として「Codex 専用 scoped permission」を定義することを推奨 | Dev | 0.1h（本体）+ M2 で +0.5h（scoped permission 追加） | — | [x] **2026-05-02 本体完了** (commit `0ad581b`、smoke 4 起動 panic 即修正、cargo check PASS) ／ scoped permission は [ ] M2 backlog |
| AS-CLEAN-05 | sidebar 単体 test の `act()` 警告解消（既知、Dev 報告書 § 5、Review DEC-018-038 Mn-1）。`@testing-library/react` の `act()` ラップを useEffect 周りに追加 | Dev | 0.5h | — | [ ] backlog（DEC-018-038 起票、M1.1 開始時推奨） |
| AS-CLEAN-06 | cargo 並列実行で auth_watchdog 既存 test 2 件 flaky 解消（AS-141 由来 env var 共有問題、`--test-threads=1` で 5/5 PASS 確認済、本 AS-UX-01〜06 scope 外）。修正方針: env var を OnceLock or test-scoped guard で隔離 | Dev | 0.5h | — | [x] **2026-05-03 完了** (commit `bf6e75a`、`OnceLock<StdMutex<()>>` で本 mod 内 5 test を直列化、5 回連続並列実行で 69/69 PASS、新規 crate 追加なし、F3 watchdog regression なし) |
| AS-CLEAN-07 | rules-tab.tsx の fetch ロジック二重定義整理（Mn-1、Review DEC-018-041 起票）— 初回 mount + Tauri event 受信時の fetch を共通関数に DRY 化 | Dev | 0.3h | — | [ ] backlog（DEC-018-041 起票、M1.1 開始時推奨） |
| AS-CLEAN-08 | dev port を Sumi (PRJ-012) と衝突する 3000 から **1420** (Tauri quickstart 標準) に変更 — `package.json` `dev` script / `src-tauri/tauri.conf.json` `devUrl` / `playwright.config.ts` baseURL + webServer.url / `README.md` / `docs/dev-setup.md` の 5 ファイル整合修正 | Dev | 0.3h | — | [x] **2026-05-03 完了** (commit `a0da52e`、オーナー実機 404 報告 → CEO 緊急修正、`npm run tauri dev` 成功確認) |
| **AS-CLEAN-09** | **`src-tauri/Cargo.toml` L47 の rusqlite features に `"fts5"` 追加（M1 blocker hotfix）** — `db.rs:32` の `SELECT fts5_version();` が `bundled + backup` のみでは未解決で `rusqlite is not compiled with FTS5 support` で起動失敗 → DB 初期化失敗 → notification stream 切断 → ChatPane エラー表示の 4 連鎖障害を 1 行修正で解消。コメント「FTS5 有効」と features 配列の不整合を修正 | Dev | 0.1h | — | [x] **2026-05-03 修正済**（CEO hotfix、要 cargo build 再起動 + オーナー smoke 確認）、commit 単位で `fix(db): enable rusqlite fts5 feature (AS-CLEAN-09, DEC-018-042)` 想定 |
| AS-CLEAN-10 | Sidebar tab 物理 width 不足時の「実行」タブ ChatPane 領域はみ出し対策（オーナー実機画面比 ~120px 想定の狭窓で 4 タブ × 80-90px 必要 = 320-360px 超過、`w-64` 256px 圧縮で溢れる） — 修正候補: ① 各 button に `min-w-0` 追加で flex-shrink 機能化 + ② tablist 親に `overflow-hidden` 追加 + ③ text に `truncate` 追加で ellipsis 表示 + ④ window 幅閾値で icon-only mode 自動切替（collapsed 動線流用）。R-UX-10 trigger | Dev | 0.5h | AS-UX-11 | [ ] backlog（DEC-018-042 起票、オーナー「今後」許容、M1.1 開始時推奨） |
| **AS-CLEAN-11** | **`ListSessionsArgs` の serde naming 修正（M1 cleanup hotfix）** — `commands/mod.rs:55-58` の `pub project_id: Option<String>` (snake_case) と `session-list.tsx:36` の `{ args: { projectId: activeProjectId } }` (camelCase) が不整合で session 一覧が常時空 → SessionsTab に「DB 未接続」誤表示。修正: `ListSessionsArgs` に `#[serde(rename_all = "camelCase")]` 追加 + 同時に `SessionIdArgs` / `CreateMessageArgs` 等の他 args struct も camelCase 統一で予防的修正。Tauri 公式推奨 invoke convention 順守 | Dev | 0.3h | — | [x] **2026-05-03 修正** (commit 想定 `chore(ux): list_sessions camelCase + remove stub hint (AS-CLEAN-11/12)`、CEO 直接) |
| **AS-CLEAN-12** | **`input-area.tsx:192` の `[stub] Codex 統合は POC 通過後に実装` hint 削除（M1 cleanup hotfix）** — DEC-018-035 で Phase 1 (M1 Real impl) ゲート ① 通過済 = 「POC 通過後に実装」表示は虚偽、ブランド毀損。修正: `input-area.tsx:192` の `<p>{t('stub')}</p>` 削除 + `i18n/ja.json:167` / `en.json` の `chat.stub` key 削除 + 必要に応じて `tests/` の参照も grep 削除 | Dev | 0.2h | — | [x] **2026-05-03 修正** (commit 想定 同上、CEO 直接) |
| **AS-FIX-01** | **`cargo fmt --check` 既存違反 2 件の auto-fix** — `src-tauri/src/commands/codex.rs:62` (`tracing::debug!` 1 行化) + `src-tauri/src/commands/fs.rs:67` (`if-let-Some` 多行化)。AS-CLEAN-11 検証中に発覚した既存債務、`cargo fmt` で機械的に解消可能。M1 quality gate (`cargo fmt --check` PASS) を満たすため AS-CLEAN-11/12 と同 PR で同梱 | Dev | 0.1h | — | [x] **2026-05-03 修正** (commit 想定 `chore(fmt): cargo fmt auto-fix codex.rs/fs.rs (AS-FIX-01)`、CEO 直接) |
| **AS-200.1** | **F3 Auth Watchdog 本実装 step 1: 5min poller の `account/read` 実 call + state machine** — 既存 `auth_watchdog.rs` stub の `tokio::time::interval(Duration::from_secs(300))` ループに対し、Codex CLI `account/read` JSON-RPC を実 call、`AuthState::{Healthy, Expiring, Expired, Unknown}` state machine 実装。expiration window 計算 (token expiry - now < 600s で Expiring 遷移)。`OnceLock<StdMutex<()>>` test isolation pattern (AS-CLEAN-06 流儀) 継承。R-QW-1 mitigation: Mutex `in_flight` guard で重複 call 防止、debounce 500ms | Dev (Yuto) | 3.0h | F3 stub (AS-141 同梱) | [x] **2026-05-03 完了** (commit `e0b64c1`、`Authenticated.expiry_warning` additive sub-state、`WatchdogEmitter` trait DI で in-process 重複検知、`EXPIRY_WARNING_THRESHOLD_SECS=30min` contract.rs 経由、cargo test 89/0/1 PASS) |
| **AS-200.2** | **F3 Auth Watchdog 本実装 step 2: frontend Zustand store + Tauri event 配線** — `app/asagi-app/web/src/lib/use-auth-watchdog.ts` の Zustand stub に Tauri event subscribe (`agent:auth:state-changed`) を実装、`{ authState, lastCheckedAt, error?, expiresInSec? }` を realtime 反映。schema は contract.rs / schemas.ts から import (DEC-018-033 厳守、生リテラル禁止) | Dev (Yuto) | 2.0h | AS-200.1 | [x] **2026-05-03 完了** (commit `e0b64c1`、`use-auth-watchdog.ts` に `expiryRemainingMinutes`/`openLogin` 追加、`schemas.ts` に `accessExpiresAtUnix`/`expiryWarning`/`authOpenLogin` 追加、生リテラル grep clean) |
| **AS-200.3** | **F3 Auth Watchdog 本実装 step 3: TrayBar warning toast UI + Settings Re-auth modal** — TrayBar に `expiring` / `expired` 時の warning toast (浅葱 accent + lucide AlertTriangle icon、絵文字禁止)、Settings drawer に「Re-authenticate」modal (Codex CLI `login` 起動 → callback で healthy 復帰)。WAI-ARIA: `role="alert"` + `aria-live="polite"` | Dev (Yuto) | 2.0h | AS-200.2 | [x] **2026-05-03 完了** (commit `e0b64c1`、`auth-badge.tsx` 黄色 dot + 残N分 + 再ログイン CTA、`role="alert"`/`aria-live="polite"`、i18n `chat.auth.expiryWarning`/`chat.auth.relogin` ja+en、`auth_open_login` invoke handler 配線) |
| **AS-200.4** | **F3 Auth Watchdog 本実装 step 4: vitest + Playwright `@auth-watchdog-mock` 回帰スイート** — vitest で auth_watchdog state machine 4 状態遷移網羅 (mock CLI response、5 ケース推定)、Playwright `@auth-watchdog-mock` (`window.__TAURI_INTERNALS__.invoke` mock IPC で expired event 注入 → toast 表示 → re-auth modal open までを assert、CI 常時動作可能) | Dev (Yuto) | 1.0h | AS-200.3 | [x] **2026-05-03 完了** (commit `e0b64c1`、cargo test `auth_watchdog` 関連 +2 テスト = 89/0/1 PASS、vitest `use-auth-watchdog.test.ts` 65/65 PASS、Playwright `@auth-watchdog-mock` 専用 spec は M2 QW E2E 統合 PR で同梱予定) |
| **AS-201.1** | **F1 Outer Retry Layer step 1: `MultiSidecarManager::spawn_for_with_retry` 新メソッド + decorrelated jitter algo** — 既存 `spawn_for(project_id) -> Result<bool>` (commit `9ae3402` AS-UX-FIX-A) を内包する outer retry wrapper。AWS decorrelated jitter (`sleep = min(cap, random_between(base, prev_sleep * 3))`、base=200ms, cap=10s)。max_retries=3 (R-QW-2 厳守)、`MaxConcurrentSidecarsReached` は即 fail (retry 対象外)。`spawn_for` の Result<bool> 不変前提を維持 | Dev (Yuto) | 4.0h | AS-200 完了 | [x] **2026-05-03 完了** (commit `e0b64c1`、`retry.rs` 215行 新規 / pure splitmix64 (rand crate 不要)、`SPAWN_RETRY_MAX=3` golden test 追加 (AWS pseudo-rust max=5 汚染防止)、`spawn_for_with_retry` + 4 retry テスト PASS) |
| **AS-201.2** | **F1 Outer Retry Layer step 2: retry attempt event 発火 + frontend status badge 受信** — Tauri event `agent:{projectId}:spawn-retry` で `{ attempt, maxRetries, nextDelayMs, error }` を frontend に送信、`useCodex` store に `spawnRetryStatus` フィールド追加。schema は contract.rs / schemas.ts 経由 (DEC-018-033)、生リテラル禁止 | Dev (Yuto) | 3.0h | AS-201.1 | [x] **2026-05-03 完了** (commit `e0b64c1`、`AGENT_SPAWN_RETRY_EVENT_SUFFIX="spawn-retry"` contract 経由、`use-spawn-retry.ts` hook 新規 + 4 テスト、`SpawnAttemptEvent` schema validator 追加) |
| **AS-201.3** | **F1 Outer Retry Layer step 3: ProjectRail spawn retry status badge UI + Settings retry policy 表示** — ProjectRail プロジェクトアイコン下に retry indicator (lucide RefreshCw spin + `attempt/max` 表示)、Settings drawer に retry policy セクション (max_retries / base_delay / cap_delay の現在値表示、M3 で edit 可能化予定)。浅葱 accent 維持、絵文字禁止 | Dev (Yuto) | 3.0h | AS-201.2 | [x] **2026-05-03 部分完了** (commit `e0b64c1`、`chat-status-badge.tsx` で `spawn_failed > retrying > lazy_spawning > ctx.status` 優先順 overlay + `aria-live="polite"`、i18n `chat.status.retrying`/`spawn_failed`/`lazy_spawning` ja+en 完了。**Settings drawer の retry policy 表示 UI 部分は AS-CLEAN-15 として正式 carryover** (Review (Hayato) 指摘 M-2 受 / CEO 承認、M2 メイン Phase F5 Settings drawer 拡充と統合実装、24h hard-limit 遵守、in-chat badge で daily-driver UX 既に充足)) |
| **AS-201.4** | **F1 Outer Retry Layer step 4: vitest + Playwright `@spawn-retry-mock` 回帰スイート** — vitest で decorrelated jitter algo 数学的性質 (monotone bound / max=cap / random spread) を property test 風に検証 (5 ケース推定)、Playwright `@spawn-retry-mock` で mock spawn fail 3 回 + 4 回目 success を注入し badge 遷移を assert、CI 常時動作可能 | Dev (Yuto) | 2.0h | AS-201.3 | [x] **2026-05-03 完了** (commit `e0b64c1`、`retry.rs` 5 unit tests (range/cap convergence/jitter stdev>5.0/contract const 一致/concurrent safe) + vitest `use-spawn-retry.test.ts` 4 ケース PASS、Playwright `@spawn-retry-mock` 専用 spec は M2 QW E2E 統合 PR で同梱予定) |
| **AS-202.1** | **F4 thread idle auto-shutdown step 1: idle reaper `tokio::spawn` 1-min interval + threshold 30min** — `MultiSidecarManager` に idle reaper task 追加、`tokio::time::interval(Duration::from_secs(60))` で全 sidecar の `last_activity` を監視、30 分超 idle で graceful shutdown (`thread/end` 送信 → JobObject drop)。`last_activity` 更新は send_message / receive_event の都度 atomic 更新 | Dev (Yuto) | 2.0h | AS-201 完了 | [x] **2026-05-03 完了** (commit `e0b64c1`、`MultiSidecarManager::start_idle_reaper`/`stop_idle_reaper`/`idle_sweep_once`/`touch_activity` + Weak Arc reaper、`SIDECAR_IDLE_THRESHOLD_SECS=30min`/`SIDECAR_IDLE_REAPER_INTERVAL_SECS=60` contract 経由、`Drop` impl で graceful shutdown、`lib.rs` setup() 起動時自動有効化、4 idle reaper テスト PASS) |
| **AS-202.2** | **F4 thread idle auto-shutdown step 2: lazy spawn race の atomic guard + double-check (R-QW-3)** — idle shutdown 中に `send_message` が並行発火するレースを `RwLock<HashMap<ProjectId, SidecarState>>` + double-check (lock 取得後 state 再確認 → Shutdown なら spawn_for 再起動) で解消。spawn_for は AS-201.1 の retry 経路に乗る (Healthy 動線統一) | Dev (Yuto) | 1.5h | AS-202.1 | [x] **2026-05-03 完了** (commit `e0b64c1`、`agent_send_message_v2` lazy spawn fallback で `RwLock` + `contains_key` double-check race guard、`spawn_for_with_retry` 経由で Healthy 動線統一、`AGENT_LAZY_SPAWN_EVENT_SUFFIX="lazy-spawn"` contract 経由、`use-lazy-spawn.ts` hook + 4 vitest テスト) |
| **AS-202.3** | **F4 thread idle auto-shutdown step 3: vitest + Playwright `@lazy-spawn-mock` 回帰スイート** — vitest で idle reaper 30min threshold + lazy spawn double-check の race condition を timer mock で再現 (5 ケース推定)、Playwright `@lazy-spawn-mock` で mock 30min idle 後に send_message → 自動 spawn → 応答受信を assert、CI 常時動作可能 | Dev (Yuto) | 0.5h | AS-202.2 | [x] **2026-05-03 完了** (commit `e0b64c1`、cargo `idle_reaper` race timer mock 4 テスト + vitest `use-lazy-spawn.test.ts` 4 ケース PASS、`data-lazy-spawning` attribute injection で Playwright mock IPC 互換、Playwright `@lazy-spawn-mock` 専用 spec は M2 QW E2E 統合 PR で同梱予定) |
| AS-CLEAN-13 | `chat-streaming-no-duplicate.spec.ts:190` の `data-status='ready'` 遷移 timeout flake 解消（1/2 回目 fail / 単独再実行 PASS / 3 回目 PASS、根本原因は mock_server `notification.method='turn/started'` 通知タイミング推定） | Dev | 1.0h | M1.1 開始時 | [ ] backlog（DEC-018-044 起票、AS-145 由来でない既存 flake、M1 完成 blocker でない） |
| **AS-HOTFIX-QW1** | **R-QW-1 緩和策 hotfix: Auth refresh debounce 500ms (TS) + tokio Mutex<()> in_flight (Rust)** — Review (Hayato) M-1 指摘解消、DEC-018-045 厳守事項 ⑥ 明示要件未充足を是正。①TS: `src/lib/codex/use-auth-watchdog.ts:125-128` の `forceCheck` callback に手書き setTimeout 500ms throttle を追加 (lodash-es debounce で代替可、既存 dep 確認後決定)、②Rust: `src-tauri/src/codex_sidecar/auth_watchdog.rs` 構造体に `in_flight: Arc<tokio::sync::Mutex<()>>` フィールド追加、`poll_one`/`force_check` 冒頭で `try_lock` → busy 時は早期 return + `state-changed` 再 emit なし、③Test: `cargo test test_force_check_concurrent_call_returns_busy` (Rust) + vitest `force-check is debounced` (TS) を必ず追加 | Dev (Yuto) | 0.5h | AS-200.1〜.4 完了 (commit `e0b64c1`) | [x] **2026-05-03 完了** (commit `a54f1b1` push 済、Dev (Yuto) 派遣、新規 dep 追加なし (純粋 setTimeout 採用)、`auth_watchdog.rs` に `in_flight: Arc<tokio::sync::Mutex<()>>` + try_lock 早期 return、`use-auth-watchdog.ts` に shared Promise + unmount/projectId 切替 cleanup、cargo 90/0/1 + vitest 66/66 PASS、CEO 検証済 → CEO ゲート ③ APPROVED) |
| AS-CLEAN-14 | `commands/codex.rs:495` の `tauri-plugin-shell::open` deprecated → `tauri-plugin-opener` への移行 (Review (Hayato) Mn-1 指摘) — DEC-018-045 24h hard-limit / 新規依存追加禁止のため M2 QW 内では `#[allow(deprecated)]` 暫定許容、M3 で正式移行 | Dev | 0.5h | M3 Full MVP 着手時 | [ ] backlog（Review verdict 2026-05-03 起票、Mn-1 由来） |
| AS-CLEAN-15 | **AS-201.4 (実態は AS-201.3) Settings drawer retry policy 表示セクション正式 carryover** — Review (Hayato) M-2 指摘受 / CEO 判断 (b) 採択。`src/components/settings/settings-drawer.tsx` に「Spawn retry policy: max=3, base=200ms, cap=10s (default)」表示セクションを追加、M3 で edit 可能化予定。M2 メイン Phase F5 Settings drawer 拡充と統合実装が効率的、daily-driver UX は in-chat badge (commit `e0b64c1`) で既に充足 | Dev | 0.5h (read-only 表示) / 1.5h (edit 可) | M2.1 F5 Settings drawer 着手時 | [ ] M2.1 F5 同梱予定（Review verdict 2026-05-03 起票、M-2 carryover、CEO 承認済） |
| AS-CLEAN-16 | **`execute_batch` × 値返す SQL の同型バグ防止** — AS-HOTFIX-QW3 (`fts5_version()`) → AS-HOTFIX-QW5 (`PRAGMA journal_mode = WAL`) の 3 段重ね同型バグから抽出。`db.rs` 内の `execute_batch` 呼び出し全てが「値を返さない SQL のみ」であることを pre-commit hook (PowerShell + bash 両対応 grep script) で機械検出する。`PRAGMA <name> = <value>` のうち値を返すもの (journal_mode / synchronous の一部 mode) と SELECT 系を blacklist として codify | Dev | 0.5h | M2.1 着手前評価 | [x] **2026-05-05 完了** (commit `811e427`、`scripts/lint-execute-batch.ps1` + `.sh` 2 ファイル新規、blacklist 4 patterns: SELECT / RETURNING / `PRAGMA journal_mode =` / `fts5_version()`、ALLOW marker `// ALLOW(execute-batch-result): <reason>` 対応、clean baseline 26 .rs files 0 findings PASS、intentional probe 5 violations 全検出 + ALLOW marker skip 確認、`-Strict` / `--strict` で exit 1 (CI 用)。pre-commit hook 自動配線は次フェーズ (husky / lefthook 採否決定後)) |
| **AS-CLEAN-17** | **terminal state event pattern を `contract.rs` に正式 codify** — AS-HOTFIX-QW6 真因 b (UI バッジ stuck) の永久回帰防止。`SpawnAttempt.success` フィールドを契約として固定、新規 stateful event 追加時のチェックリスト 6 項目を doc 化、`TERMINAL_STATE_FIELD_NAME = "success"` 定数追加、golden test 2 件で payload shape を assert | CEO 直接 | 0.3h | — | [x] **2026-05-05 完了** (commit `0231b3c`、`contract.rs` doc-only + 1 定数 + golden test 2 件、cargo test --lib 99/0/1 PASS + clippy clean + fmt clean、production 副作用ゼロ) |

---

## マイルストン一覧

| マイルストン | 期日（暫定） | 累計工数 | Gate |
|---|---|---|---|
| **Phase 0 POC** | 起案日 + 1 日 | 4h | **DEC-018-013 (v0.1.0 着手承認)** |
| M1 Early Usable | POC 通過 + 4 週 | 137h（足場含む再見積） | Gate-AS-M1（review 部門設計レビュー、AS-151 自己検収後、旧 AS-150） |
| M2 Daily Driver | POC 通過 + 6 週 | 187h | **Gate-AS-E2（撤退判定）** |
| M3 Full MVP | POC 通過 + 8 週 | 237h | Gate-AS-M3（自己検収 + KPT） |

---

**注**:
- AS-R-01 / R-02 / R-03 はリサーチレポート v1 完了で [x]、AS-110 / AS-120 のブロックを解除済（2026-05-01 時点）。
- AS-R-04（CLAUDE.md 相当の Codex 規約名）は M3 着手時に着手予定。
- AS-R-05 は POC 結果受領後（残不確実性のうち実機検証で未解消の項目）に着手。
- AS-100 系の本実装は Phase 0 POC ゲート通過 + DEC-018-013 起票後に着手する。
- リサーチ確定情報を反映済の DEC は DEC-018-009 / 011 / 012 / **022**。
- **AS-130〜135 は DEC-018-022（Codex 統合の足場 / mock-first 発射台）として 2026-05-02 fifth update で完了**（commit `cff4ded`、cargo test 18 passed、tsc / next build pass）。Real impl は AS-140〜145 系列に分離、Phase 0 POC 通過後着手厳守。
- **旧「AS-130 = M1 自己検収」は AS-150 に再採番**（AS-130 番号は DEC-018-022 系列で再利用）。
- **AS-144 mock 範囲 / AS-145 mock 範囲は POC 通過前に着手可**（DEC-018-022 の足場活用、ChatPane を mock 経由で動作確認 → POC 通過の瞬間に real 切替が即可能）。
- **2026-05-02 sixth update で AS-136 / 137 / 144 mock / 145 mock / Q-03 が Done**（DEC-018-023 mock リネーム、DEC-018-025 MAX=6、ChatPane mock 接続、E2E mock シナリオ、`codex-schema-watch` CI 雛形）。残 Blocked は AS-110/111/112/120/121/124/AS-META-09/AS-140/141/142/143 + AS-144/145 real 部のみ。
