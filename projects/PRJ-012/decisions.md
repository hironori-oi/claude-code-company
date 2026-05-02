# PRJ-012 意思決定記録

本案件の重要な意思決定を時系列で記録する。各決定は「理由」と「代替案と却下理由」を伴う。

**重要**: 2026-04-18 に v1（Electron+Monaco）から **v2（ccmux fork / Rust TUI）** へ技術方針を転換。DEC-001〜009 は v1 時点の決裁、**DEC-010〜014 が v2 転換に伴う新設・改訂**。

---

## DEC-001: ベース技術（**2026-04-18 改訂**）

- **改訂日**: 2026-04-18
- **意思決定者**: CEO + オーナー
- **旧内容（v1）**: Electron + Monaco Editor の新規 IDE
- **新内容（v2）**: **ccmux（Rust TUI、MIT）の soft fork**
  - 既存機能（ペイン分割、Claude 検出、JSONL 監視、ファイルツリー、Windows ConPTY）を継承
  - 新機能は `src/ide/` サブモジュールに集約、既存ファイルへの改造は 30〜50 行以内
- **改訂理由**:
  - オーナー方針: 「ccmux を fork して改造」（2026-04-18 AskUserQuestion 回答）
  - 開発+PM v2 レポート: 総工数 200〜224h → **120h（−30〜40%）**
  - 既存 OSS 流用率が「低」→「高」（PTY/ANSI/JSONL/ペイン分割が無料）
  - 4大価値の B（マルチエージェント）と C（コンテキスト管理）は既存実装で 60% 完了
- **代替案と却下理由**:
  - Electron+Monaco（v1）: 純工数で劣後、画像 UX は優位だが Must には不要
  - ccmux hard fork: upstream 追従ができず陳腐化リスク
  - ccmux をそのまま利用: 画像コピペ・差分・CLAUDE.md階層・FTS5 が欠如
- **関連**: `reports/dev-pm-report-v2.md` §6、`reports/research-report-v2.md` §エグゼクティブサマリー

---

## DEC-002: Claude 統合方式（**2026-04-18 改訂**）

- **改訂日**: 2026-04-18
- **意思決定者**: CEO
- **旧内容（v1）**: `@anthropic-ai/claude-agent-sdk` primary + CLI spawn 補助
- **新内容（v2）**: **Claude Code CLI 実行 + JSONL 監視 primary（ccmux の既存実装）**
  - `portable-pty` で `claude` を spawn、既存 `pane.rs`
  - `claude_monitor.rs` が `~/.claude/projects/<encoded>/*.jsonl` を 500ms throttle で追従、tool_use / Agent / TodoWrite / usage / stop_reason を逐次パース
  - 画像投入は **PTY に `@<path>`文字列を write、Claude Code CLI 側の Vision が発火**（Week0 PoC で検証必須）
  - Agent SDK は**使わない**（TypeScript SDK を Rust から呼ぶのは不自然、ccmux の CLI 統合で十分）
- **改訂理由**:
  - Rust ベースで SDK は技術的親和性が低い
  - ccmux の既存 JSONL 監視が成熟（3-phase lock 設計、requestId で重複カウント排除）
  - CLI の Windows Ctrl+V 制約は「**画像を先に temp 保存 → `@path` 注入**」で回避可能（SDK 不要）
- **代替案と却下理由**:
  - Agent SDK を FFI 経由で呼ぶ: オーバーエンジニアリング、2ヶ月MVPに不適
  - Anthropic API 直叩き: CLAUDE.md / tool loop / MCP の再実装不要

---

## DEC-003: 2段階リリース（維持）

- **日付**: 2026-04-17（v1決裁）、2026-04-18 有効性確認
- **内容**: Phase 0 → Phase 1 前半 → Phase 1 後半、**M1/M2/M3 + Gate-E2**
- **v2 での対応**:
  - M1 Early Usable = Week2末（画像コピペ本実装 + サイドバー）
  - M2 Daily Driver = Week4末（差分・スラッシュ・CLAUDE.md ツリー、Cursor 起動ゼロ3日連続）
  - M3 Full MVP = Week8末（worktree・横断通知・FTS5・配布）

---

## DEC-004: node-pty 後ろ倒し（**2026-04-18 撤回**）

- **撤回日**: 2026-04-18
- **撤回理由**: v2 では `portable-pty` を採用（ccmux 由来）、node-pty は不要。Spectre libs 問題も無関係（Rust 側の rusqlite-bundled は cc crate 別系統で影響なし）

---

## DEC-005: Won't リスト（**2026-04-18 更新**）

- **更新日**: 2026-04-18
- **v2 Won't リスト**:
  1. **Rust GUI への再転換**（Tauri / egui / Iced）— TUI で十分差別化可能、工数過大
  2. macOS / Linux の画像プロトコル最適化 — まず Windows Terminal 動作を最優先
  3. 複数ファイル D&D 一括投入 — TUI ではマウス D&D が不完全
  4. リッチな画像編集（クロップ・アノテーション） — 別 OSS で代替可
  5. 他 LLM（GPT/Gemini）対応 — Claude 特化が看板
  6. **Monaco / xterm.js 統合**（v1 の設計） — 方針転換により削除
  7. **Electron 自動更新**（electron-updater） — GitHub Release 手動配布へ
  8. Node.js 系プラグインエコシステム — Rust 側で再発明しない
  9. EV コードサイニング証明書取得 — 2026-03 CA/B Forum 改定で 1 年有効制限、Microsoft Azure Trusted Signing は日本個人不可。自己署名+Defender除外で運用
  10. クラウド同期・チーム共有・商用化機能・音声入力（v1から継続）

---

## DEC-006: 撤退基準（Gate-E2）（維持）

- **日付**: 2026-04-17（v1決裁）、2026-04-18 有効性確認
- **内容**: Week4末 M2 時点で以下のいずれかに該当 → 1週間クールダウン後に凍結検討
  - AC2-1（Cursor 起動ゼロ連続3日）未達
  - 本業支障、累計遅延2週以上、モチベ低下2週連続
- **v2 追加のエスカレーション閾値**（Rust 遅延検知）:
  - Week0 PM-004（ccmux コード読解 4h）が 8h 超
  - Week1 PM-013（image_paste.rs 6h）が 12h 超
  - Week2終了時に arboard + PTY 注入の動作確認が取れない
  - `cargo build` が 2 日連続で通らない
- **リカバリオプション**: A. 学習バッファ +10h 追加、M1 を Week3 末へ延期 / B. M1 を画像コピペのみに縮退 / C. v1（Electron）案へ再転換（最終手段）

---

## DEC-007: 過去案件資産流用（**2026-04-18 更新**）

- **更新日**: 2026-04-18
- **旧内容（v1）**: PRJ-006/007 から IPC型・keytar・トレイ・SQLite・release CI など約60%流用
- **新内容（v2）**:
  - **流用率は 10%程度**（設計思想のみ）
  - **使えるもの**: IPC 型安全の考え方 → Rust では `enum` / `struct` の型定義に置換、エラー分類の考え方、Windows パス境界テストのパターン、PRJ-007 Actions の「Win x64 matrix で cargo build → Release upload」部分
  - **使えないもの**: keytar(JS) → **keyring crate**、electron-updater → **GitHub Release 手動 or cargo-dist**、Monaco / xterm.js / node-pty / Electron Forge / electron-builder 関連すべて
- **理由**: Rust/TUI 環境では JS エコシステムが非互換。ただし ccmux 既存コードが「新しい資産」として機能する

---

## DEC-008: 参考OSS・ライセンス運用（**2026-04-18 更新**）

- **更新日**: 2026-04-18
- **内容**:
  - **ccmux** (MIT) を **内包＋fork 対象**に格上げ（従来「参考」→「ベース」）
    - LICENSE 継承、著作権表記保持、README 冒頭に `Based on ccmux by @Shin-sibainu, MIT Licensed` 明記
  - 引き続き参考: **Cline** (Apache-2.0) / **Aider** (Apache-2.0) / **claude-mem**（ローカル RAG）
  - **`siteboon/claudecodeui`（AGPL-3.0）は借用禁止**維持
- **第三者 crate ライセンス**: 追加する全 crate（ratatui/crossterm/portable-pty/similar/rusqlite/image/keyring/notify/ratatui-image など）は MIT / Apache-2.0 / BSD-3。`cargo about` を CI に追加推奨

---

## DEC-009: 法務確認（維持、**Week0 に前倒し**）

- **日付**: 2026-04-17（v1決裁）、2026-04-18 前倒し決定
- **旧内容**: Week1 Day1 に Anthropic 利用規約／Claude Code CLI ライセンス確認
- **v2 更新**: **Week0 の PM-006 と同時に実施**（Claude CLI の `@path.png` Vision 動作検証と併せて、JSONL ローカル読み取りの利用規約も確認）
- **依頼先**: 次回 `/research` セッション、または開発者（オーナー）自身が Claude CLI docs を確認
- **ccmux 由来リスク**: Claude Code JSONL をローカルで読むのは claude-mem 等も同様の運用、外部送信しない限り規約違反にならない想定

---

## DEC-010: ccmux soft fork 運用方針（**新設 2026-04-18**）

- **新設日**: 2026-04-18
- **意思決定者**: CEO
- **内容**:
  1. **soft fork 戦略**: `https://github.com/<owner>/ccmux-ide`（または `claude-ide-tui`）として fork
  2. **ブランチ運用**: `master`（upstream 追従）、`ide-main`（自作機能）、必要に応じ `feature/<name>`
  3. **upstream 追従**: 月1回の `git fetch upstream && git rebase upstream/master`
  4. **既存ファイルへの改造を最小化**: 新機能は **`src/ide/` サブモジュール**に集約、`app.rs` への変更は key dispatcher の 1 分岐＋`State` に `ide: IdeState` フィールド追加のみ（推定30〜50行）
  5. **package 名変更**: `Cargo.toml` の `name` を `ccmux` → **`ccmux-ide`** または **`claude-ide-tui`** に変更（npm の既存 `ccmux-cli` は Shin-sibainu 氏のみ publish 可能なため）
  6. **fork リポジトリは当面 private**（Must 完了前の粗い状態を非公開、M3 完了後に公開／private 判断）
  7. **Cargo.toml 冒頭に license = "MIT"**、原著作権表記を継承
- **理由**: upstream の追従コストを最小化しつつ、自作機能領域で自由度を確保
- **関連**: `reports/dev-pm-report-v2.md` §1.1、`reports/research-report-v2.md` §5

---

## DEC-011: 画像コピペ実装方針（**新設 2026-04-18**）

- **新設日**: 2026-04-18
- **意思決定者**: CEO
- **実装パス**:
  1. **取得**: `arboard::Clipboard::get_image()` → `ImageData { width, height, bytes: Cow<[u8]> (RGBA) }`
  2. **エンコード**: `image` crate 0.25 で PNG にエンコード
  3. **保存**: `~/.claude/ccmux-images/paste-<UTC時刻>.png` に保存（ディレクトリは自動作成）
  4. **注入**: アクティブ PTY に ` @"<path>" \n` を `pane.write()` で送信（**ダブルクォート固定**でスペース・日本語対策）
  5. **キーバインド**: ccmux の prefix（`Ctrl+A` 等） + `v`（変更可能）
  6. **UI フィードバック**: ratatui overlay で「Pasted: filename.png」のバナー（成功/失敗）を3秒表示
- **プレビュー方針**:
  - **Must**: フォールバック（枠 + ファイル名 + 縦横サイズ表示のみ）
  - **Should**: `ratatui-image 0.7+` で Kitty/Sixel/iTerm2/halfblocks 自動検出（対応ターミナル向け）
- **Windows 固有対策**:
  - arboard は CF_DIB/CF_BITMAP のみ読める（CF_HDROP 不可、Chrome コピーなど一部で alpha 欠落）
  - CF_HDROP のケースは別実装（`clipboard-win` crate 検討、Should）
  - 失敗時は「スクショしてからコピーしてください」とガイド
- **検証**:
  - Week0 PM-006 で `claude --print ... @path.png` が Vision を発火するか PoC
  - Week1 PM-013 で実機動作
  - Week2 M1 自己検収で「20回連続成功」を AC とする

---

## DEC-012: Rust 学習コスト許容（**新設 2026-04-18**）

- **新設日**: 2026-04-18
- **意思決定者**: CEO
- **内容**: Rust 学習 13〜21h + ccmux コード理解 8〜12h（**合計 18〜32h**）を Week0〜Week1 に明示割当
- **学習内訳**:
  | 項目 | 工数 | 方法 |
  |---|---|---|
  | 所有権・借用・ライフタイム | 4〜6h | The Rust Book 該当章 + ccmux 既存コード読解 |
  | tokio async（broadcast / select!） | 3〜4h | tokio 公式 + claude_monitor.rs 写経 |
  | ratatui レイアウト / widget | 3〜5h | ratatui examples + ui.rs 読解 |
  | crossterm イベント / KeyModifiers | 1〜2h | 実装しながら |
  | serde_json カスタム型 | 1〜2h | tool_use ペイロード型定義 |
  | rusqlite トランザクション | 1〜2h | FTS5 実装時 |
- **前提**: オーナーは PRJ-007（Tauri）で Rust 触り済のため、**下限13h寄り**を基本見積とする
- **遅延検知閾値**: DEC-006 のエスカレーション閾値に統合（Week0 PM-004 が 8h超 等）

---

## DEC-013: 配布パイプ（**新設 2026-04-18**）

- **新設日**: 2026-04-18
- **意思決定者**: CEO
- **内容**:
  - **ccmux の `.github/workflows/release.yml` を fork** し、Windows x64 / macOS x64+arm64 / Linux x64 の matrix ビルド＋SHA-256 checksums＋GitHub Release への upload をほぼそのまま流用
  - **npm 配布は Trusted Publishing（OIDC、鍵不要）** を使用、ただし **package 名を変更**（`ccmux-cli` は Shin-sibainu 氏のみ publish 可能のため、`ccmux-ide-cli` 等に）
  - **Windows 署名は MVP では無し**（EV 証明書は 2026-03 CA/B Forum 改定で 1 年制限、Azure Trusted Signing は日本個人不可）→ **Defender 除外＋SmartScreen回避の説明を README に記載**
  - M3 での v0.1.0 リリースを目標
- **代替案**: `cargo-dist` での自動リリース、ただし ccmux 既存 CI のほうが確実

---

## DEC-014: upstream 貢献方針（**新設 2026-04-18**）

- **新設日**: 2026-04-18
- **意思決定者**: CEO
- **内容**:
  - **Shin-sibainu 氏への PR 還元は歓迎**するが、大幅改造は fork 側で実施（MIT ライセンスのため自由）
  - **小さな PR 還元候補**:
    - `claude_monitor.rs` の `context_limit()` に **Opus 4.7 (1M context) 対応 1行**追加
    - arboard の Windows 画像取得改善（もし汎用的に有用なら）
  - 大改造（画像コピペ、worktree連携、FTS5 検索等）は **fork 側で独自機能として維持**し、ccmux 本家の方向性と必ずしも一致しない前提
  - README に `Based on ccmux by @Shin-sibainu, MIT Licensed` 明記（礼儀）
  - コンタクトは M1 完了後、動くものができてから（issue / discussion）

---

---

## DEC-015: WSLg 画像コピペは arboard + wl-paste フォールバック（**新設 2026-04-18**）

- **意思決定者**: CEO
- **内容**: `arboard::Clipboard::get_image()` が `Error::ContentNotAvailable` を返した場合、`#[cfg(target_os="linux")]` で `wl-paste` CLI を `Command::spawn` し、Wayland clipboard から image/bmp（または image/png）を取得。`image` crate で BMP→PNG 変換して `~/.claude/ccmux-images/paste-<ts>-<uuid>.png` に保存
- **理由**:
  - WSLg (Windows 11 の WSL2 GUI ブリッジ) は Windows のクリップボード画像を **image/bmp のみ**で Wayland に提供（image/png は提供しない、2026-04 時点）
  - arboard 3.6 の Linux 実装は image/png 前提で、image/bmp が提供されると ContentNotAvailable 相当の失敗
  - wl-paste 直接呼び出しで両 MIME type 対応できる、追加 crate 不要（`wl-clipboard` apt パッケージのみ）
- **前提**: オーナー環境に `sudo apt install wl-clipboard` 済
- **影響範囲**: `src/ide/image_paste.rs` に `try_wl_paste_as_png()` 関数追加（約 80 行、cfg gate 済）
- **代替案と却下理由**:
  - arboard バージョンアップ: 2026-04 時点の最新 3.6 でも同じ挙動
  - clipboard-win crate を Linux で使う: プラットフォーム違い
  - Windows から WSL へ image/png でブリッジを要求する upstream 提案: 時間的に待てない

---

## DEC-016: rustc ICE 回避は `#[allow(warnings)]`（**新設 2026-04-18**）

- **意思決定者**: CEO
- **内容**: `src/main.rs` の `mod ide;` に `#[allow(warnings)]` outer attribute を付与し、ide モジュール配下の全 warning 生成を抑止
- **発生事象**: rustc 1.94.0 / 1.95.0 両方で下記の ICE が発生
  - `thread 'rustc' panicked at library/alloc/src/vec/mod.rs:2873: slice index starts at 5 but ends at 3`
  - 発生モジュール: `src/ide/{config,image_display,keybindings,memory_tree,notify,search_fts,worktree}.rs`
  - 共通点: dead_code warning 表示で日本語 doc コメントを含む source range を slice index する際の UTF-8 境界計算バグ
- **選定理由**:
  - warning 自体を生成しなければ slice 計算は走らず ICE しない
  - 日本語 doc を英訳する労力を避けられる（ide-skeleton 全 12 ファイルが日本語 doc 満載）
- **代替案と却下理由**:
  - 全 doc を英語化: 工数大、本質的でない
  - rustc 更新待ち: リリーススケジュール不確定、MVP 間に合わない
  - 日本語 doc を全削除: 知識的価値を失う
- **撤回条件**: rustc 側で該当バグが修正されたバージョン（未定）で `#[allow(warnings)]` を外して再検証

---

## DEC-017: profile.release は opt-level=0 に暫定緩和（**新設 2026-04-18**）

- **意思決定者**: CEO
- **内容**: `Cargo.toml [profile.release]` で `opt-level=0` のみ設定し、`lto`/`codegen-units`/`strip` は全てコメントアウト
- **理由**:
  - `lto = "thin"` + `codegen-units = 1` + `strip = true` の組合せで別種の rustc ICE（bin crate link stage）
  - 緩和しないとビルド通過せず MVP 開発が進まない
- **MVP への影響**:
  - バイナリサイズ: 15.6MB（LTO 有効なら推定 5〜8MB）
  - 起動時間: 問題なし（ネイティブ ELF、即時起動）
  - 実行速度: 非最適化のため理論上遅いが、TUI IDE では体感差ほぼなし
- **撤回条件**: **DEC-013 の M3 配布時に GitHub Actions CI 上で `opt-level=3` / `lto=thin` 通過を確認**してから本番リリースに使う。ローカル開発中は opt-level=0 維持

---

## DEC-018: ローカル開発 WSL2 / Windows ビルドは CI（**新設 2026-04-18**）

- **意思決定者**: CEO
- **内容**: ローカル開発は WSL2 Ubuntu-24.04 で `cargo build --release`、Windows ネイティブ `.exe` は **GitHub Actions CI**（ccmux release.yml fork）で生成する方針
- **理由**:
  - Windows 側 **WDAC (Windows Defender Application Control) / AppLocker** が `target/**/build-script-build.exe` の実行をブロック（os error 4551 "アプリケーション制御ポリシーによってブロックされました"）
  - `CARGO_TARGET_DIR` を別パスに変えても同じエラー、抜本回避困難
- **WSL2 構成実績**:
  - Ubuntu-24.04、Rust 1.94.0 (rustup)
  - 依存: `build-essential pkg-config libssl-dev libx11-dev libxcb1-dev libxcb-shape0-dev libxcb-xfixes0-dev libxkbcommon-dev libwayland-dev libsecret-1-dev libdbus-1-dev wl-clipboard`
  - nvm + Node 24.15.0 + @anthropic-ai/claude-code（native Linux ELF）
- **配布計画**（DEC-013 と整合）:
  - M3 Week8 PM-082 で ccmux の `.github/workflows/release.yml` を fork、matrix ビルド（Win x64 MSVC / Mac x64+arm64 / Linux x64）
  - GitHub Release に upload、npm Trusted Publishing（OIDC）
  - Windows 署名は自己署名のみ（EV 証明書取得は Won't）
- **撤回条件**: WDAC 例外追加が可能になる（IT 管理者承認）or 別マシン調達

---

## DEC-019: サイドバー実データ化は claude_monitor 直接参照（**新設 2026-04-18**）

- **意思決定者**: CEO
- **内容**: `ui::render` で `app.claude_monitor.state(app.ws().focused_pane_id)` → `ClaudeState`（clone 返却）を取得し、`sidebar::draw(f, area, &app.ide, &cs)` に渡す
- **設計判断**:
  - `tokio::sync::broadcast::Sender` を claude_monitor に追加する案は採用せず
  - 代わりに毎フレーム `state()` で snapshot 取得（Mutex<HashMap<usize, PaneMonitor>> のガードは短時間）
  - ccmux 既存ファイル `claude_monitor.rs` への改造を避ける（upstream 追従容易）
- **表示項目**（`src/ide/ui/sidebar.rs`）:
  - **Session box**（3行）: 累積 tokens（humanize K/M）、short model 名、git branch
  - **Context Gauge**（3行）: 現在値%、k/k 内訳、threshold color（緑→黄→赤）
  - **Sub-Agents list**（Min 3 行）: 現在 tool、サブエージェント列挙、Todos 進捗

---

## DEC-020: WSL2 claude CLI は native ELF 優先、PATH 強制（**新設 2026-04-18**）

- **意思決定者**: CEO
- **内容**: `~/.bashrc` 末尾に以下を追記
  ```bash
  if [ -d "$HOME/.nvm/versions/node/v24.15.0/bin" ]; then
    export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"
  fi
  if [ -x "$HOME/.nvm/versions/node/v24.15.0/bin/claude" ]; then
    alias claude='$HOME/.nvm/versions/node/v24.15.0/bin/claude'
  fi
  ```
- **理由**:
  - WSL2 の PATH には Windows PATH（`/mnt/c/Users/hiron/AppData/Roaming/npm`）が append され、`which claude` が Windows 版 `.cmd` を指す
  - ccmux の pane は portable-pty で interactive shell を起動 → PTY 上で Windows `cmd.exe` 経由の claude TUI は描画不整合で無反応
  - WSL2 native claude（npm で install、ファイル名は `claude.exe` だが実体は **Linux ELF 236MB**）を PATH 先頭に置けば問題なし
- **認証**:
  - WSL2 native claude は Windows 版とは別セッション扱い、初回起動時に OAuth URL 表示 → ブラウザ認証
  - 認証済なら次回以降は即起動
- **interactive shell 限定**: Ubuntu デフォルト `.bashrc` 冒頭で non-interactive は return するため、`.bashrc` 設定は interactive shell でのみ有効。ccmux pane は PTY アタッチで interactive 扱いなので動作する

---

---

## DEC-021: v3 GUI 方針転換（**新設 2026-04-18 深夜**）

- **意思決定者**: CEO + オーナー
- **トリガー**: Week0+M1 技術達成直後、TUI を実機で触ったオーナーの所感「TUI は扱いにくい、素人でも触れる GUI アプリにしたい、見た目もおしゃれに」。加えて **2026-04-14 に Anthropic 公式 Claude Code Desktop がリリース**（v2 決裁の4日前）し、機能網羅で張り合うのは不合理と判明
- **新方針**: ccmux（Rust TUI）fork 路線から、**Tauri 2.x + Next.js 15 + shadcn/ui による GUI デスクトップアプリ**へ再転換
- **差別化軸（全4軸採用、DEC-023）**:
  1. 日本語 UI + 日本語ユーザファースト（公式は英語中心）
  2. デザインのおしゃれさ（Linear / Arc / Raycast 水準の UI 洗練度）
  3. claude-code-company 組織運営との統合（/ceo /dev /pm 等のスラッシュコマンド、案件管理 projects/PRJ-XXX、組織ルールの GUI ファースト）
  4. ローカル永続化・プライバシー重視・FTS5 横断検索
- **位置づけ**: 公式 Claude Code Desktop とは**正面衝突せず、局地戦（日本語ローカル組織運営特化）**を取る
- **v2 との関係**: ccmux-ide（Rust TUI）は **v0.1.0 として凍結**（DEC-022）。v2 で作った Rust モジュール（image_paste, claude_monitor, memory_tree, worktree 等）は新リポジトリに**選択的コピー移植**（40〜80% 流用見込）
- **代替案と却下理由**:
  - ccmux-ide TUI のまま UI 改善継続: 素人向けは根本的に限界
  - 凍結（PRJ-008 方式）: 差別化軸があり自作価値があるため早計
  - 公式 Desktop + extension: Anthropic が extension API を公開していない、実現性不明

---

## DEC-022: ccmux-ide (TUI) は v0.1.0 で凍結、`ide-tui-archive` ブランチに保存（**新設 2026-04-18 深夜**）

- **意思決定者**: CEO
- **内容**:
  - 現状の ccmux-ide リポジトリ（`hironori-oi/ccmux`、ide-main ブランチ）を **v0.1.0 でタグ付け** → `ide-tui-archive` ブランチに rename
  - 今後 TUI 版へは機能追加しない（破壊的修正のみ許容）
  - 新規 GUI プロジェクトを別リポ `ccmux-ide-gui`（仮称、正式名は M1 達成時に決定）で立ち上げる
  - TUI 資産（Rust コード）は **選択的にコピー移植**。バージョン管理は独立
- **流用対象**（Research v3 / Dev+PM v3 報告準拠、概ね一致しない部分は Research v3 を採用）:
  - `image_paste.rs`（arboard + wl-paste fallback）→ Tauri backend として 95〜98% 流用
  - `memory_tree.rs`（walkdir 3 スコープ）→ 90% 流用
  - `worktree.rs`（std::process::Command）→ 90% 流用
  - `config.rs`（keyring）→ 80% 流用
  - `search_fts.rs`（rusqlite bundled FTS5）→ 90% 流用（TODO 骨格だが設計流用）
  - `claude_monitor.rs`（JSONL 監視）→ **部分流用**（Agent SDK で代替するため、token counting / tool_use 監視ロジックだけ参考）
  - `slash_palette.rs`（scan + fuzzy）→ 設計流用、TypeScript 再実装が早い
  - `diff_view.rs`（similar crate）→ Monaco DiffEditor で代替、削除
- **完全破棄**:
  - `ui/*.rs`（ratatui の全描画）
  - `pane.rs`（portable-pty ベースは Tauri backend で不要、xterm.js で代替）
  - `app.rs` の UI ロジック（Next.js + shadcn で書き直し）

---

## DEC-023: Claude 統合は Node sidecar + Claude Agent SDK TypeScript primary（**新設 2026-04-18 深夜**）

- **意思決定者**: CEO
- **内容**: v1 Electron 案で検討した `@anthropic-ai/claude-agent-sdk` TypeScript primary 路線を **部分復活**。Tauri の Node.js sidecar 機能で Agent SDK を起動し、Tauri frontend（Next.js / React）と IPC（Tauri Command + Event）で連携
- **理由**:
  - v2 の「Rust から Claude Code CLI spawn」は Rust + pty 実装負担が大
  - v3 では UI 側で Agent SDK の `canUseTool` callback / hooks / streaming input（画像）をダイレクトに叩ける方が、4大価値の実装密度が上がる
  - JSONL 監視を自前で書く必要がなくなる（Agent SDK が構造化イベントを stream で返す）
  - Windows の Claude CLI 画像ペースト未対応も streaming input で回避（v1 時点の勝ち筋を継承）
- **構成**:
  - **Next.js フロント**: UI、状態管理、shadcn/ui レンダ
  - **Node sidecar**: Agent SDK `query()` 実行、Tauri の IPC で結果を frontend に push
  - **Tauri Rust backend**: ファイル IO、keyring、rusqlite FTS5、git worktree、clipboard（arboard）、画像保存
- **バージョン pin**: `@anthropic-ai/claude-agent-sdk` v0.2.112+（Opus 4.7 対応）、Node.js 22 LTS sidecar
- **代替案と却下理由**:
  - Rust からのみ Claude API 叩く: canUseTool / hooks が TypeScript SDK でしか便利に使えない
  - Node.js 全面（Electron 回帰）: Tauri のバンドルサイズ優位を捨てることになる

---

## DEC-024: 新規リポジトリ立ち上げと命名（**新設 2026-04-18 深夜**）

- **意思決定者**: CEO（リポジトリ名はオーナー承認で最終確定）
- **内容**: 新規 GitHub リポジトリを立ち上げ、Next.js + Tauri プロジェクトとして初期化
- **仮称**: `ccmux-ide-gui`（開発期間中の作業リポ名）
- **正式名候補**（M1 達成時にオーナー決定）:
  - `ccmux-ide-gui` — v2 延長線の認知しやすさ
  - `claude-studio-jp` — 日本語特化を明示
  - `nihongo-claude` — 日本語を前面に
  - `<未定 / ブランド名を別途>` — 完全新規の独立ブランド
- **構造**:
  - モノレポか単一リポかは未定（Dev+PM v3 推奨は単一リポ、必要なら monorepo は M2 以降に決定＝DEC-025 候補）
  - 初期は `ccmux-ide-gui/` single repo、`src-tauri/` (Rust) + `app/` (Next.js App Router) + `sidecar/` (Node Agent SDK) + `components/ui/` (shadcn)
- **ライセンス**: MIT（ccmux fork 由来を README で明示、DEC-008 の継承原則遵守）
- **public / private**: 当面 **private**、M3 達成後に公開判定（DEC-017 前身）

---

## DEC-025: Gate-E2v3 撤退基準（**新設 2026-04-18 深夜**）

- **意思決定者**: CEO
- **内容**: v3 のマイルストン判定基準を以下に設定
- **新 M1 Early Usable（Week4末）**: Next.js + Tauri 雛形 + 初回 welcome + API Key 設定 + 基本チャット + 画像 D&D の最小動作
- **新 M2 Daily Driver（Week6末 / Gate-E2v3）**: トークン/サイドバー + Monaco DiffEditor + スラッシュコマンドパレット + 組織統合ワークフロー（PRJ-XXX 読み込み、/ceo /dev 等起動）を揃え、**オーナーが日常で Cursor も公式 Desktop も開かず本アプリで7日連続作業できる**こと
- **新 M3 Full MVP（Week8末）**: worktree 連携 + FTS5 横断検索 + CLAUDE.md 階層エディタ + MSI/DMG インストーラ + 署名なし自己配布
- **撤退条件（Gate-E2v3、Week6末）**:
  - AC2-1（7日連続公式/Cursor 起動ゼロ）未達 → 1週間クールダウン後に凍結判定
  - 本業支障 / 遅延2週以上 / モチベ低下2週連続 → 同上
  - **Tauri plugin の想定外の壁**（Linux Wayland の clipboard 等、v2 で遭遇したような環境固有問題）3日以上解消しない → CEO 相談
- **リカバリ**: A. 学習バッファ +10h / B. Should/Could 切り落とし / C. Electron 回帰（最終手段）

---

## DEC-026: 残工数配分と Must/Should/Could（**新設 2026-04-18 深夜**、Research v3 § 6 準拠）

- **意思決定者**: CEO
- **残工数**: 約 150h（本日までに消費 10〜12h、合計 170h 想定から差し引き）
- **Must（60h、Week3〜5）**: Tauri 2 + Next.js 15 setup / 3 step onboarding / Agent SDK 統合 / 画像 D&D / 会話永続化 SQLite
- **Should（30h、Week6〜7）**: Monaco DiffEditor / トークンサイドバー / dark mode / テーマ切替 / FTS5 検索
- **Could（20h、Week8）**: worktree / slash palette GUI / CLAUDE.md エディタ / MSI/DMG リリース
- **バッファ**: 40h（各週に 7〜8h 内包）
- **Won't**: OSS 完全公開、商用化、他LLM対応、macOS universal binary、音声入力 — Rust 時代から継続

---

## DEC-027: PRJ-012 汎用化方針（**新設 2026-04-20**）

- **日付**: 2026-04-20
- **意思決定者**: CEO + オーナー
- **内容**: ccmux-ide-gui を **claude-code-company 特化 → 任意 Claude Code プロジェクト対応の汎用 GUI** へ転換する
  - Workspace は `~/Desktop/claude-code-company` の hardcode をやめ、ユーザーが任意ディレクトリを選択可能
  - Project auto-detection を 3 モード化: `prj-pattern`（PRJ-XXX/brief.md、従来）/ `git-children`（`.git` を持つ直下）/ `all-children`（直下全フォルダ）
  - Slash 組織ロール 8 件（ceo/dev/pm/research/review/secretary/marketing/web-ops）の Rust hardcode を除去、純粋に `.claude/commands/` の動的検出のみ
  - Status pane を新設（任意 workspace の `STATUS.md` / `TODO.md` / `NOTES.md` / `progress.md` / `CHANGELOG.md` を自動検出、Monaco preview）
  - 差別化軸 C を「claude-code-company 組織運営統合」→「**任意 Claude Code プロジェクトの統合開発支援**」に再定義
- **理由**:
  - オーナー自身が他案件（PRJ-001〜011）でも活用したいという利用実感
  - 汎用化しても差別化 4 軸（日本語 UI / おしゃれ / ローカル永続化 / プロジェクト統合）は維持可能
  - claude-code-company ユーザーは `.claude/commands/ceo.md` 等の動的検出で従来通りの体験を享受（特殊ケースとして内包）
  - 配布対象を広げる（素人開発者 + 非エンジニア）上で組織運営前提は障壁
- **代替案と却下理由**:
  - 特化のまま進める: 自分以外への配布時に claude-code-company の組織設計理解が前提となり、学習コスト高
  - v4 として切り出す: M3 未達の状況で v4 着手は非効率、dogfood 価値が遅延
- **影響範囲**: Week 7 Could 枠を活用、推定 12〜16h（Chunk A/B 並列実装）
- **関連**: `reports/dev-v4-chunk-a-report.md` / `dev-v4-chunk-b-report.md`（Agent 並列実装中、2026-04-20）、brief.md § 差別化軸 C 書換予定

---

## DEC-028: 組込 Slash コマンド対応方針（**新設 2026-04-20**）

- **日付**: 2026-04-20
- **意思決定者**: CEO
- **内容**: Claude Code 組込 slash コマンド（`/mcp` `/clear` `/model` `/init` `/help` `/compact` `/config`）を **A 案（GUI ネイティブ代替）で Must 実装**、B 案（PTY + xterm.js + claude CLI 併用）は **Could / M3 後 v4 候補**
  - A 案 実装範囲:
    - `/mcp` → `/settings/mcp` 画面遷移、Global（`~/.claude.json` の mcpServers）/ Project（`.mcp.json`）を Monaco JSON editor で GUI 編集
    - `/clear` → AlertDialog 確認後に現 session messages クリア
    - `/model` → ModelPickerDialog で Opus 4.7 / Sonnet 4.6 / Haiku 4.5 切替
    - `/init` → workspace root に CLAUDE.md 雛形生成（既存時は警告）
    - `/help` → 組込・ユーザー定義コマンド一覧 dialog（日本語）
    - `/compact` → M3 Could、toast 案内のみ
    - `/config` → `/settings` 遷移
  - B 案: research 部門が v4 着手判断用の技術調査レポートを作成中（`reports/research-pty-cli-mode.md`）
- **理由**:
  - Agent SDK 経由では組込コマンドは直接実行不可（CLI ユーザー対話層の機能のため）
  - A 案は差別化軸 A（日本語 UI）+ B（おしゃれ）と高く整合、素人向け路線を維持
  - B 案は PTY + xterm.js の複雑性増、M3 残工数（約 35h）には収まらない
  - A 案で実用 90% をカバー可能、上級者向け escape hatch は v4 で B 案を検討
- **代替案と却下理由**:
  - B 案のみ実装: 素人向け路線と不整合、v2 TUI の反省（扱いにくい）が活きない
  - 実装しない: `/mcp` の GUI 化要望が出ており、差別化軸 C 汎用化後の実用性不足
  - C 案（A+B ハイブリッド）: M3 収まらず、v4 で検討（research 調査結果次第）
- **工数見積**: A 案 Must 20h（Chunk C 並列実装中）
- **関連**: `reports/dev-v4-chunk-c-report.md`（実装中）、`reports/research-pty-cli-mode.md`（調査中）

---

## DEC-029: ブランド・リネーム判定の M3 後延期（**新設 2026-04-20**）

- **日付**: 2026-04-20
- **意思決定者**: CEO
- **内容**: `ccmux-ide-gui` 現行名を **M3 達成まで維持**、正式リネーム（例: `claude-desk` / `claude-lab` / 汎用名）は M3 後に再検討
- **理由**:
  - dogfood 継続中（PM-220）での名称変更はコスト大、検証サイクル阻害
  - 正式名称は M3 AC 達成後のポジショニング確定（汎用 or 特定ニッチ）に合わせる
  - 汎用化（DEC-027）により `ccmux` 由来の名前は将来的に不整合、ただし今は優先度低
- **代替案と却下理由**:
  - 即リネーム: dogfood 中断 + リポ移転コスト
  - 永久に現行名: 配布時の認知獲得不利、仮称のまま
- **関連**: DEC-024（新規リポ `ccmux-ide-gui` 仮称）継承

---

## DEC-030: v3.2 Multi-Project Context Isolation 方針（**新設 2026-04-20**）

- **日付**: 2026-04-20
- **意思決定者**: CEO + オーナー
- **背景**: v3.1 汎用化実装後、オーナーより「Cursor での画面切替・複数プロジェクト管理が困難」が差別化軸 C の核心課題と明示。ProjectRail（Discord/Slack 風 48px 縦アイコン）は既存実装されていたが、**各プロジェクトの Claude Code セッション / Status / Inspector が独立してスワップされる** 挙動が欠落
- **内容**: v3.2 として「Multi-Project Context Isolation」を新設、M3 手前（Week 7 後半）で実装
  - 各 project アイコン = 独立した Claude Code ワークスペース（独自 session 一覧 / last session 記憶 / preferred model / MCP config）
  - project 切替時に **Chat / StatusPane / Inspector / Sidebar session 全てをスワップ**（framer-motion 150〜200ms transition）
  - ProjectRail の `+` ボタンが first-class な project 追加経路（任意ディレクトリ）
- **理由**:
  - Cursor / 公式 Claude Code Desktop ともに project switch の摩擦が高く、差別化軸 C を決定的にできる局面
  - v3.1 で ProjectRail / addProjectFromPath 基盤は完成、v3.2 は session 分離と context swap を足すのみで 16〜18h で M3 前に収まる
  - 差別化 4 軸のうち C（組織統合）+ A（日本語）を融合し、「**複数 Claude Code を瞬時に切替**」という単一明確な価値提案を確立
- **代替案と却下理由**:
  - M3 後に v4 として実装: Full Win（Cursor 代替として自他ともに納得）の AC がずれる、dogfood 価値が下がる
  - Workspace 内 project フィルタのみ: session は横断のまま、Cursor 代替の核心を外す
- **工数見積**: 18h（Chunk A 6h + Chunk B 6h + Chunk C 4h + Review 2h）
- **関連**: `reports/dev-v4-chunk-a-report.md`（v3.1 Rail 実装）、v3.2 実装レポート 3 本予定

---

## DEC-031: Workspace UI 概念の完全撤去（**新設 2026-04-20、DEC-027 部分巻き戻し**）

- **日付**: 2026-04-20
- **意思決定者**: CEO + オーナー
- **背景**: v3.1 DEC-027 で「任意 Workspace + その配下 projects の 3 mode auto-detect」を実装。しかしオーナーの実運用イメージは「**各プロジェクトが独立した任意ディレクトリ**」であり、workspace という中間概念はむしろ UX を複雑化する
- **内容**: Workspace 概念を UI から完全撤去し、すべて **Project = 任意ディレクトリ** の単層モデルに統一
  - `lib/stores/workspace.ts` 削除
  - `components/sidebar/WorkspacePicker.tsx` 削除
  - `lib/stores/project.ts` を registry 型（`RegisteredProject[]` + `activeProjectId`）に書換、3 mode auto-detection（prj-pattern / git-children / all-children）も削除
  - `app/setup/page.tsx` の「Workspace 選択ステップ」→「最初のプロジェクト追加（任意）」に変更、スキップ可能
  - localStorage `ccmux-project-registry` で registry を persist
  - claude-code-company ユーザー向け: 初回 setup で `~/Desktop/claude-code-company/projects/PRJ-XXX/` を検出した場合、**一括登録 or 単体登録の suggestion**（自動登録はしない）を提供
- **理由**:
  - オーナーの運用モデル（「Cursor のウィンドウごとのプロジェクト」+「Slack のサーバー切替」の融合）と一致
  - 「Workspace 内 projects」の階層を消すことで UX が素人向けに簡潔化（差別化軸 A + B）
  - v3.1 の Chunk A（workspace picker）は dogfood 未実施のため捨てコスト低
- **代替案と却下理由**:
  - Workspace 概念を残し、任意ディレクトリ混在: 階層が 2 重で UX 複雑
  - v3.1 のまま dogfood 継続: オーナーの運用イメージと乖離、Full Win 達成が遠のく
- **v3.1 からの撤去範囲**: DEC-027 のうち Workspace picker / 3 mode auto-detect は撤去。「Slash 組織ロール hardcode 除去」「Status pane 新設」「組込コマンド GUI」は維持・継承
- **後方互換**: localStorage の `ccmux-workspace` キーは廃棄、`ccmux-project-registry` に新規書込
- **関連**: DEC-027（v3.1、部分巻き戻し対象）、Chunk A 実装レポート

---

## DEC-032: Session 完全分離（**新設 2026-04-20**）

- **日付**: 2026-04-20
- **意思決定者**: CEO + オーナー
- **内容**: SQLite `sessions` テーブルに `project_id TEXT` 列を追加（idempotent migration）、session を project 単位で DB 上も分離
  - 既存 session は `project_id = NULL`（未分類）として保持、UI 上「未分類」カテゴリで toggle 表示可能
  - `create_session(title, project_id)` command 拡張、`list_sessions(project_id?)` に filter 追加
  - SessionList は activeProjectId の session のみ表示（default）、未分類は toggle
  - 新規 session 作成時に activeProjectId を自動 attach
  - 各 project は「最後に開いていた session」を `last_session_id` として RegisteredProject に記録、再選択時に自動復元
- **理由**:
  - DEC-030 Multi-Project Context Isolation の実効性を DB レイヤで担保
  - 検索（FTS5）もプロジェクト単位で絞り込める副産物
  - Cursor / 公式 Desktop / Nimbalyst が提供していない明確な差別化軸
- **代替案と却下理由**:
  - UI フィルタのみ（DB 分離なし）: FTS5 絞り込み不可、性能劣化リスク、拡張性低
  - 新規 project ごとに別 DB ファイル: オーバーエンジニアリング、バックアップ複雑化
- **工数見積**: 6h（Chunk B）、migration + command 拡張 + session store filter + SessionList UI
- **関連**: DEC-030、`src-tauri/src/commands/history.rs` 拡張、`reports/dev-v5-chunk-b-report.md` 予定

---

## DEC-033: v3.3 Multi-Sidecar Architecture — 1 project = 1 Claude プロセス（**新設 2026-04-20**）

- **日付**: 2026-04-20
- **意思決定者**: CEO + オーナー
- **背景**: v3.2 Multi-Project Context Isolation 実装後、オーナーから「各プロジェクトでそれぞれ Claude プロセスが起動、Cursor の複数ウィンドウ相当を 1 アプリで実現したい」との明示的な要求。コード確認で現状 `AgentState { child: Mutex<Option<CommandChild>> }` が **アプリ全体で 1 sidecar のみ** の singleton 設計であり、オーナーイメージ（multi-sidecar）と根本的に乖離していたことが判明。Cursor 代替の核心差別化価値（複数プロジェクト並行実行）が欠落していた
- **内容**: Multi-Sidecar アーキテクチャに全面転換（**Option A: 1 project = 1 sidecar**）
  - **Rust 側**: `AgentState` を `HashMap<String, SidecarHandle>` に書換、project_id を key に sidecar を管理
  - **Tauri command 拡張**: `start_agent_sidecar(projectId, cwd)` / `stop_agent_sidecar(projectId)` / `send_agent_prompt(projectId, prompt, attachments)` / `list_active_sidecars() -> Vec<{projectId, cwd, startedAt}>` / `send_agent_interrupt(projectId)`
  - **Tauri event prefix 変更**: `agent:ready` → `agent:{projectId}:ready` 等、multi-sidecar の event 混線防止
  - **起動タイミング: Lazy**（project 登録時は起動せず、初回 setActiveProject 時に start）
  - **閉じた project の扱い: 即 kill**（ActiveProjectPanel「閉じる」で removeProject + stop_agent_sidecar を連動）
  - **上限警告: 10 project で toast 警告**（任意上限、後日調整可）
  - **session 切替**: 同 sidecar 内で conversation を reset（Claude プロセスは project 単位で共有、session ごと起動はしない）
  - **TitleBar cwd 編集ボタン**: read-only 表示に降格（cwd は project に固定、手動編集は廃止）
  - **DEC-033 は v3.2 で検討した「cwd 自動同期」を包含**（multi-sidecar 化で自動的に解決）
- **理由**:
  - **Cursor 代替の核心価値の本質的実現**: オーナーイメージと完全整合、「複数ウィンドウ不要」差別化を成立
  - **並行実行の成立**: Project A で長時間 tool use 中でも Project B に切替えて別作業可能、v3.2 までの致命的欠落を解消
  - **cwd と activeProject の連動が自然に成立**: 各 sidecar が固有 cwd で起動、手動同期不要
  - **RAM コスト許容範囲**: Node 1 プロセス ~200-300MB、10 project で 2-3GB、Windows 16GB マシンで実用範囲
  - **Lazy start**: 登録時の重さを分散、初回選択時のみ起動コスト、未選択 project は RAM 占有ゼロ
- **代替案と却下理由**:
  - **Option B（1 session = 1 sidecar）**: RAM 5-8GB、実装 20-24h、over-engineering。session 並行実行は稀、idle timeout 必要で複雑
  - **Option C（Lazy hybrid）**: A とほぼ同設計、差は eager/lazy のみ。A で Lazy 採用により同一（統合）
  - **現状維持（1 sidecar singleton）**: Cursor 代替価値が根本欠落、オーナーイメージと乖離継続
- **影響範囲**: Rust / frontend / sidecar bundle の 3 層全て、推定 12〜16h（3 Chunk 並列で実時間 2〜3h 目標）
- **Chunk 分割**:
  - **Chunk A（Rust sidecar manager）**: `src-tauri/src/commands/agent.rs` を HashMap 化 + Tauri command 拡張 + event prefix 化 + ユニットテスト
  - **Chunk B（Frontend sidecar router + store lifecycle）**: `lib/stores/project.ts` に sidecar lifecycle state + ensure/stop actions、`lib/stores/chat.ts` を activeProjectId 連動化、`sidecar/src/index.ts` で project_id 対応、`ChatPanel.tsx` / `InputArea.tsx` の invoke 更新
  - **Chunk C（UX lifecycle + 10 warning）**: `TitleBar.tsx` cwd を read-only 化、`ActiveProjectPanel.tsx` 閉じる時に stop 連動、`ProjectRail.tsx` 登録数 10 で warning toast、Lazy start UX 整備
- **関連**: v3.2 DEC-030（Multi-Project Context Isolation 基盤、本 DEC で完全達成）、v3.3 実装レポート 3 本 + /review 予定
- **実装差異記録（2026-04-20 /review v6 指摘）**: 契約上は 7 種細分 event（`ready` / `assistant_message_delta` / `tool_use` / `tool_result` / `complete` / `error` / `terminated`）を予定したが、既存の NDJSON 1 本集約方式（v2 `claude_monitor.rs` 流用）との整合を優先し、**実装は 3 種集約**（`agent:{projectId}:raw` / `stderr` / `terminated`）に着地。Rust stdout parser 内 `dispatch_to_monitor` で NDJSON を後処理、monitor integration は既存ロジック流用で成立。将来 GUI 側で細かい粒度の state（tool use 個別進捗等）を必要とする場合は frontend の post-process 拡張で追加可能、Rust 側の再細分化は不要

---

## DEC-034: v3.4 Cursor 代替核心機能 3 選（**新設 2026-04-20**）

- **日付**: 2026-04-20
- **意思決定者**: CEO + オーナー
- **背景**: v3.3 Multi-Sidecar で Cursor 代替の根幹（並行実行）は完成したが、CEO の Cursor gap 分析で「**コードを書ける / @file mention / Git UI**」の 3 欠落が残存、これらが無いと日常使いでユーザーが Cursor に戻らざるを得ない。M3 Full Win の AC「7 日連続 Cursor ゼロ起動」到達のブロッカー
- **内容**: v3.4 として **Must 3 選** を並列実装（24〜32h、Week 7 後半〜Week 8 前半で吸収）
  - **Must 1: ファイルエディタ統合（12〜16h）** — ProjectTree ファイルクリックで Monaco エディタ open、タブ管理、dirty 検知 + save、SafeMonacoEditor 基盤流用
  - **Must 2: @file / @folder mention（4〜6h）** — InputArea で `@` 入力 → cmdk ベース AtMentionPicker → `@"<path>"` 注入、既存画像 attachment 仕組みをファイルに拡張
  - **Must 3: Git 統合パネル最小版（8〜10h）** — Sidebar Git タブ、staged/unstaged/untracked 一覧、Monaco DiffEditor（HEAD vs working）、commit、current branch 表示
- **理由**:
  - Claude Code 利用観点で「コードを読む / 書く」を本アプリ内で完結させる必要
  - ファイルエディタ統合は「ToolUseCard の Edit 提案を 1 クリック反映」の前提基盤、Cursor 体験への最終到達
  - @file mention は「このファイル見て」を 1 秒で可能にし、Read tool を待たず context を明示付与
  - Git UI は多くの開発者が毎日見る panel、slash command 専用だと Cursor より UX が劣る
- **代替案と却下理由**:
  - **Tab Autocomplete（AI 補完）**: 100h+、Cursor の商用核心領域と正面衝突、Claude Code 利用観点では必須でないため **実装非推奨**
  - **Cursor Composer (Cmd+K)**: Claude Code の slash command + @file で代替可能、追加実装不要
  - **組込ターミナル**: 12〜16h、Should/v4 候補（DEC-039 PTY 併用と統合検討）、v3.4 には重い
  - **Codebase semantic search**: 8h、Should/v4 候補、FTS5 拡張で対応予定
  - **M3 配布優先で v3.4 スキップ**: Full Win AC 未達の確率が高い、dogfood 期に Cursor 戻り発生で差別化価値が証明できず
- **Chunk 分割**:
  - **Chunk A（ファイルエディタ統合）**: `components/editor/FileEditor.tsx` / `EditorTabs.tsx` / `lib/stores/editor.ts` 新規、Shell.tsx に editor pane 追加、ProjectTree ファイルクリック連動
  - **Chunk B（@file mention）**: `components/chat/AtMentionPicker.tsx` 新規、InputArea で `@` パース、既存 SlashPalette cmdk 基盤流用
  - **Chunk C（Git 統合パネル）**: Rust `src-tauri/src/commands/git.rs` 新規（git status/stage/unstage/commit/diff/branch 6 command）、`lib/stores/git.ts` + `components/sidebar/GitPanel.tsx` 新規、Sidebar タブ追加
- **影響範囲**: frontend 中心（Chunk A / B）+ Rust git integration（Chunk C）、推定 24〜32h（3 Chunk 並列で実時間 2〜3h 目標）
- **関連**: Cursor gap 分析（CEO 提案 2026-04-20）、v3.3 DEC-033 Multi-Sidecar（基盤）、v4 候補 DEC-039（PTY） + DEC-041（session sidecar）

---

## DEC-044: アプリ実体の `projects/PRJ-012/app/` 格納方式（**新設 2026-04-20**）

- **意思決定日**: 2026-04-20
- **意思決定者**: CEO + オーナー
- **決定内容**: `ccmux-ide-gui` と `ccmux-ide` の実体は `C:\Users\hiron\Desktop\` 配下に置いたまま、**Windows Junction** で `projects/PRJ-012/app/{ccmux-ide-gui,ccmux-ide}` にマウントする
- **背景**:
  - オーナー指示「PRJ-012 で作成したツールは PRJ-012 フォルダの中に入れる」「今後のプロジェクトで該当のプロジェクトフォルダにキチンとアプリが格納されるように社内ルールを徹底」
  - 社内ルール側: `CLAUDE.md` §2 / `organization/rules/project-setup-checklist.md` 最優先ルール / `organization/rules/project-lifecycle.md` Phase 5 に「`projects/{案件ID}/app/` 配下格納」を明文化
- **代替案と却下理由**:
  - **物理移動**: node_modules / target 削除 → mv → 再 install 必要。Claude Code Agent SDK の session jsonl パス (`~/.claude/projects/C--Users-hiron-Desktop-ccmux-ide-gui-sidecar/`) が齟齬を起こし過去会話の resume が不能になるリスク → **却下**（現在 v3.5.19 hotfix 検証中で稼働中アプリを動かすのは危険）
  - **Git submodule**: ccmux-ide-gui をリモート repo にホストする前提が未整備。将来 v1.0 release 時の移行先として保留
- **理由**:
  - 実体を動かさない → Tauri dev 稼働中プロセス・session jsonl・絶対パス依存すべて無影響
  - Junction は ファイルエクスプローラ / CLI / エディタから通常フォルダと同じに見える
  - `.gitignore` の既存ルール `projects/*/app/` により Git 追跡対象外（実体の .git は独立 repo として別運用）
  - 他者展開時は README 記載の再構築手順で復元可能
- **実施内容**:
  - `projects/PRJ-012/app/ccmux-ide-gui` → `C:\Users\hiron\Desktop\ccmux-ide-gui` junction
  - `projects/PRJ-012/app/ccmux-ide` → `C:\Users\hiron\Desktop\ccmux-ide` junction
  - `projects/PRJ-012/app/README.md` に管理方式・再構築手順・将来の移行パスを記載
- **将来の移行候補**: v1.0 release 時に submodule 化 or 物理集約を再検討

---

## DEC-045: Terminal 本格版 v1.0 同梱（**新設 2026-04-20**）

- **意思決定日**: 2026-04-20
- **意思決定者**: CEO + オーナー
- **決定内容**: PM-920 として **xterm.js + portable-pty の組込ターミナル本格版を v1.0 に同梱**する。簡易版（command 単発実行）は不採用
- **背景**:
  - DEC-034（v3.4）で組込ターミナルは Should / v4 候補扱いだったが、DEC-033 Multi-Sidecar 運用後のオーナー dogfood で「Cursor 代替の完成度には interactive terminal が不可欠」との実感が明確化
  - Cursor 利用時に `cmd` / `bash` / `vim` / `git` 等の対話 shell を使う頻度が高く、外部ターミナル併用では Cursor 代替価値が欠ける
  - PRJ-012 の核心差別化「Cursor 切替困難の解消」（project_prj012 memory）の最終ピース
- **代替案と却下理由**:
  - **簡易版**（`tokio::process::Command` で単発 run、stdout 表示）: 工数 3〜5h と軽量だが、**interactive コマンド（vim / less / claude TUI 等）が動作しない**。UX 制約が大きく差別化価値に結びつかない → 却下
  - **外部ターミナル常用の継続**: Cursor 代替の完成度が頭打ち、v1.0 の目玉機能を欠く → 却下
  - **v4 への先送り**: v1.0 リリースで dogfood が安定した後の後付けになると前提 UX が崩れる、v1.0 で一括統合がコストパフォーマンス最良 → 却下
- **実装内容**:
  - 依存: `xterm` / `xterm-addon-fit` / `xterm-addon-web-links`（frontend）、`portable-pty`（Rust）
  - `TerminalView.tsx` / `TerminalPane.tsx` + `src-tauri/src/commands/terminal.rs`（spawn / write / resize / kill）
  - Project 単位で PTY session を管理（DEC-033 Multi-Sidecar 流儀に整合）
  - shell 自動選択: Windows `cmd.exe`、Unix `$SHELL`（fallback `/bin/bash`）
- **工数**: 10h（PM-920 + PM-921/922/923 hotfix/polish 系統）
- **関連**: DEC-034 v3.4（Should/v4 候補から昇格）、PM-920 実装レポート、PM-935（DEC-047）との統合

---

## DEC-046: Preview Phase 1 iframe 採用 → v1.0 では iframe 撤退（**新設 2026-04-20**）

- **意思決定日**: 2026-04-20
- **意思決定者**: CEO
- **決定内容**: PM-925 で Preview 機能を **Phase 1 iframe + 外部 fallback のハイブリッド方式**で採用、5 回の hotfix を経て PM-936 で **iframe 撤退、外部ブラウザ一本化**に方針転換。v1.0 は外部ブラウザ一本化で出荷
- **背景**:
  - PM-925 feasibility で Tauri 2 iframe の CSP 拡張により mini-browser 実装が可能と判断、Phase 1 として MVP 実装
  - 実機検証で **WebView2 の ERR_CONNECTION_REFUSED** が yahoo.co.jp / github.com / improver.work 等で解消せず、PM-925 / 927 / 929 / 931 / 933 と 5 回 hotfix を積み上げたが収束せず
  - CSP `frame-src` 拡張（PM-927）→ 9 directive 全拡張（PM-931）→ Tauri 2 `devCsp` / `dangerousDisableAssetCspModification` / `additionalBrowserArgs` + capability 3 permission 追加（PM-933）を経ても ERR_CONNECTION_REFUSED 継続
- **撤退理由**:
  - WebView2 の site-isolation / network partition 深層制御が原因推定、frontend / Tauri config レベルで対処しきれない
  - 時間コスト累積が大（5 hotfix ≒ 10h 相当）、v1.0 リリース優先度が勝る
  - 「IDE 内 URL 入力欄 → 1 click で外部ブラウザ起動」で実用 UX は十分改善できる（`@tauri-apps/plugin-shell` の `open` で実績）
- **代替案と却下理由**:
  - **iframe 実装継続**: ERR_CONNECTION_REFUSED 解消の見通しなし → 却下
  - **Tauri 2 secondary webview window（Phase 4 案 D）**: 実装 4〜6h、効果不確定。v1.0 出荷優先のため **v1.1 以降で検証**に持ち越し
  - **Preview 機能自体を削除**: URL 保存と外部起動だけでも価値があり、UI シンプル化で実装余力を温存 → 採用（DEC-048）
- **v1.1 以降の申し送り**:
  - Tauri 2 secondary webview window による本格的な IDE 内 preview を再検証
  - PM-933 で追加した CSP / capability / `additionalBrowserArgs` はそのまま維持（復活時の前提として保持）
- **関連**: DEC-048（iframe 撤退・外部ブラウザ一本化の最終形）、PM-925〜936 レポート群

---

## DEC-047: Terminal Shell conditional mount（**新設 2026-04-20**）

- **意思決定日**: 2026-04-20
- **意思決定者**: CEO
- **決定内容**: PM-935 として Terminal pane の **conditional mount 方式**を採用。従来の `display:hidden` 常時 mount を改め、`viewMode === "terminal"` の時のみ React mount する
- **背景**:
  - xterm.js の 0x0 canvas 問題を PM-920〜934 の 9 回 hotfix で追跡
    - PM-930: ResizeObserver で container rect 検知 → 初回切替で一部成功
    - PM-932: DOM 2 層化（wrapper + inner）→ inner rect 0x0 race 残存
    - PM-934: wrapper + inner 両 observe + rAF 最大 10 frame retry → defer log 抑制したが実機で prompt 未描画ケース残存
  - **根本原因**: xterm.js の `term.open()` は canvas font metric 測定を **mount 時 1 回のみ**実施。`display:none` 配下で呼ばれると測定値が壊れたまま固定化、後から `display:block` にしても復旧しない
  - 構造的に 0x0 container で mount される race が残り続ける
- **決定**: PM-934 Agent 提示の Plan B を採用
  - `<TerminalView />` を `viewMode === "terminal"` 時のみ React 木に mount、離脱時 unmount
  - 0x0 container で `term.open()` が呼ばれる経路を **構造的に消滅**
- **代替案と却下理由**:
  - 常時 mount + race hotfix 追加: PM-930/932/934 の延長、race 条件を調整するのみで根本解消せず → 却下
  - xterm.js fork で font metric 再測定対応: 工数過大、upstream 追従不能 → 却下
  - Terminal 機能自体を v1.0 で断念: DEC-045 の判断と矛盾 → 却下
- **tradeoff**:
  - **Tab 切替で xterm scrollback が reset** される（unmount で DOM 消失のため）
  - PTY 自体（Rust 側 portable-pty session）は維持するが、frontend 表示履歴は失われる
  - **v1.1 候補**: data stream buffering（xterm 側の scrollback を Rust 側に shadow copy し、再 mount 時に replay）
- **関連**: PM-935 実装レポート、DEC-045 Terminal 本格版の付随決定

---

## DEC-048: Preview iframe 撤退、外部ブラウザ一本化（**新設 2026-04-20**）

- **意思決定日**: 2026-04-20
- **意思決定者**: CEO + オーナー
- **決定内容**: PM-936 として Preview pane の iframe 表示を撤退し、**外部ブラウザ起動のみ**に一本化。DEC-046 の最終形
- **実装内容**:
  - `PreviewPane.tsx`: iframe 要素を削除、URL 入力欄 + 「外部で開く」ボタンのみの簡素 UI に
  - 外部起動: `@tauri-apps/plugin-shell` の `open(url)` でシステム既定ブラウザを起動
  - Project ごとの URL 保存（`lib/stores/preview.ts`）は維持、history / last URL も復元可能
  - CSP / capability / additionalBrowserArgs（PM-933 設定）は v1.1 復活時の前提として削除せず維持
- **変更**:
  - `components/preview/PreviewPane.tsx`（iframe 削除、UI シンプル化）
  - `lib/stores/preview.ts`（iframe 関連 state 削除）
  - Rust / sidecar 変更なし、capability 変更なし、Shell.tsx 変更なし（PM-935 並列との衝突回避）
- **代替案と却下理由**:
  - iframe 継続: DEC-046 参照（ERR_CONNECTION_REFUSED 未解消）
  - 機能自体を削除: URL 保存と 1 click 起動の UX 価値が失われる → 却下
  - Tauri 2 secondary webview window: v1.1 以降の検証枠に移送
- **UX 影響**:
  - 「ccmux-ide で作業しながら別ブラウザに都度切替」→「IDE 内 URL 入力欄 → 1 click で外部ブラウザ起動」に改善
  - v1.0 の実用域を満たす（オーナー dogfood 確認）
- **関連**: DEC-046（本 DEC の上位決定）、PM-936 実装レポート

---

## DEC-049: 1/2/4 pane 分割対応（**新設 2026-04-20**）

- **意思決定日**: 2026-04-20
- **意思決定者**: CEO + オーナー
- **決定内容**: PM-937 として Chat / Editor / Terminal の 3 view mode で **1 / 2 / 4 pane 切替**に対応。4 pane は 2×2 grid、MAX_PANES を 2 → 4 に拡張
- **背景**:
  - DEC-050（Approach A）で Editor / Terminal の 2 pane 分割が成立、Chat は PM-810 で 2 pane 先行実装済
  - オーナー dogfood で「Cursor の 4 分割相当が欲しい」要望、特に Terminal 並行実行（build / test / watch）や Editor 多画面編集で効果
- **実装内容**:
  - `components/layout/SplitView.tsx`: 4 pane 時は **vertical `PanelGroup`（外側）+ horizontal `PanelGroup` × 2（各行）** の 2×2 grid
  - `autoSaveId` を layout ごとに分離（`splitview-2` / `splitview-4-outer` / `-top` / `-bottom`）→ 2↔4 切替時の旧比率混入防止
  - 分割ボタンを Dropdown 化（1 / 2 / 4 mode 切替）、trigger icon が現 pane 数に応じ変化
  - 各 store の MAX_PANES を 2 → 4:
    - `lib/stores/chat.ts` / `lib/stores/editor.ts` / `lib/stores/terminal.ts`
  - 5 件以上は fail-safe で 4 件だけ描画（store 側で上限保証）
- **対象外**:
  - **Preview pane は分割対象外**（iframe + 外部 WebView の複雑性回避、DEC-046/048 の撤退方針と整合）
- **代替案と却下理由**:
  - 3 pane / 6 pane 等の可変分割: ratio 管理と UI 複雑化、代替 UX 価値が不足 → 却下
  - 2 pane 固定維持: オーナー要望と乖離 → 却下
- **tradeoff**:
  - Terminal 4 pane 時は PTY process が project 当たり最大 4 個生成、メモリ消費増
  - ユーザが明示選択した場合のみ発動するため通常利用では影響なし
- **関連**: DEC-050（Editor/Terminal 2 pane 基盤）、PM-810（Chat 分割）、PM-937 実装レポート

---

## DEC-050: Editor / Terminal split 対応（**新設 2026-04-20**）

- **意思決定日**: 2026-04-20
- **意思決定者**: CEO
- **決定内容**: PM-924 として Chat pane 分割（PM-810）パターンを Editor / Terminal に拡張。**Approach A: 最小 store 拡張方式**を採用
- **背景**:
  - PM-810 で Chat の 2 pane 分割が成立、各 pane が独立した session に routing されて `agent:{projectId}:` event が正しく配送される設計が機能
  - Editor / Terminal にも同等の分割を広げて Cursor の multi-pane 体験に近づけたいオーナー要望
- **Approach A（採用）**:
  - **リソース（openFiles / terminals）は全 pane 共有**（app-wide な単一 store）
  - 各 pane は「参照リスト」（pane.tabIds: string[]、pane.activeTabId: string | null）のみ保持
  - pane 追加・削除は pane array の操作のみ、リソース本体は触らない
  - Editor: 同じファイルを複数 pane で開いても単一 buffer を共有（dirty state 一貫性確保）
  - Terminal: 同じ PTY session を別 pane で表示（scrollback 同一源）も可能、別 session 生成も可能
- **代替案と却下理由**:
  - **Approach B（各 pane 完全独立 store）**: buffer / PTY process が重複、メモリ / 実装複雑化、差別化価値に寄与しない → 却下
  - **Approach C（workspace-split 型、外部ライブラリ依存）**: 既存 `react-resizable-panels` で十分、追加依存不要 → 却下
- **実装ファイル**:
  - `lib/stores/editor.ts`: `panes: EditorPane[]` / `addPane` / `removePane` / `moveTabBetweenPanes` 追加
  - `lib/stores/terminal.ts`: 同構造の `panes: TerminalPane[]` 追加
  - `components/editor/FileEditor.tsx` / `components/terminal/TerminalView.tsx`: pane 引数受取に拡張
  - `components/layout/SplitView.tsx`: Chat / Editor / Terminal で共通の split container として流用
- **関連**: PM-810（Chat 分割の先行実装）、PM-924 実装レポート、DEC-049（4 pane 拡張の前提）

---

## DEC-051: Preview Phase 4.1 を Rust `WebviewWindowBuilder` で実装（**新設 2026-04-22**）

- **意思決定日**: 2026-04-22
- **意思決定者**: CEO + オーナー
- **決定内容**: v1.1 Preview 機能を Tauri 2 JS API `new WebviewWindow()` ではなく、**Rust 側 `WebviewWindowBuilder::data_directory(...)`** 経路で実装する (PM-944 採用)
- **背景**:
  - PM-943 で JS API spawn を試み、v1.1-dev で 7 hotfix (a927d7f → b675b7c) を積み上げた
  - Windows 実機で `tauri://created` event は発火するが、`isVisible()` が `failed to receive message from webview` で reject、OS 上に window が表示されない症状が継続
  - PM-942 §8 R3「Windows は multi-webview で user data dir 個別指定必須」が的中、JS API では `dataDirectory` option が公開されていない
- **解法 (PM-944)**:
  - `src-tauri/src/commands/preview.rs` で `spawn_preview_window` command 新設
  - `WebviewWindowBuilder::data_directory($APPLOCALDATA/preview-webview/{label})` で WebView2 user data dir を label 固有に分離
  - `build()` sync で OS window 生成、frontend は `invoke()` 1 呼出で成否判定
  - 固定 label `preview-{projectId}` に回帰 (PM-943 hotfix3 の timestamp nonce 撤去)
- **代替案と却下理由**:
  - JS API 継続: 7 hotfix で root cause 未解消、JS API 側に `dataDirectory` 不在で根本的に不可能 → 却下
  - 外部ブラウザ一本 (α 案): v1.0 と同じで v1.1 としての目玉が弱い → 却下
- **実機検証結果**: 2026-04-22 オーナー確認、yahoo.co.jp / github.com 等の iframe 不可 URL が secondary window で表示成功
- **関連**: PM-925〜936（iframe 試行と撤退）、PM-942（feasibility 調査、R3 的中）、PM-943（JS API 試行と 7 hotfix）、PM-944（Rust 実装）

---

## DEC-052: In-window Preview (案 D2) を v1.1 見送り（**新設 2026-04-22**）

- **意思決定日**: 2026-04-22
- **意思決定者**: CEO + オーナー（案 A 採用）
- **決定内容**: Cursor 同等の **同一 window 内 multi-webview preview (案 D2)** は v1.1 では見送り、Tauri 2 の multi-webview API が stable 化するまで待機 (v1.2+ で再検討)
- **背景**:
  - DEC-051 (PM-944) で案 D1 別 window 方式が実動作することを確認
  - オーナー質問「別 window ではなくアプリ内で表示できないか」に対し、Tauri 2 の in-window multi-webview は `unstable` feature flag 必須と判明
- **見送り理由**:
  - `tauri = { features = ["unstable"] }` を production ship するリスク (Tauri minor 更新で API breaking)
  - PM-942 見積で工数 13〜17h、v1.1 release タイミングを遅延させる
  - stability が Tauri community でも検証途上
  - 現状の別 window 方式で実用 UX は確保 (任意 URL 表示可、X-Frame 制約も回避)
- **代替案と却下理由**:
  - B (unstable 採用で v1.1 に含める): 上記 risk で非推奨 → 却下
  - C (別 window UX 改善 + v1.2+ で D2 本格): 部分的な v1.1 改善として候補だが、v1.1 release 優先のため見送り
- **v1.2+ 申し送り**:
  - Tauri 2.x で multi-webview が stable API 化するタイミングで再検討
  - 別 window の position/size 記憶は v1.2 の UX 改善候補 (PM-945 相当)
- **関連**: DEC-051（案 D1 採用）、PM-942（案 D1/D2 比較）

---

## PM-957: 1 pane エディタで壁紙が前面に出て文字が見えない regression 修正（2026-04-23）

### 背景
- v1.3.1 時点で、エディタビューを 1 pane にすると壁紙しか見えず Monaco 本体が不可視になる症状をオーナーが再報告。
- 2 pane / 4 pane では Monaco が正しく描画されていたため、PM-956（透過）系の修正では根治しないことが画像 2 枚（1 pane / 2 pane 同時比較）で確定。
- DEC-045 hotfix4 までは「Monaco DOM が壁紙を透過しすぎて text が溶ける」と誤診していたが、真因は別。

### 真因
- `Shell.tsx` の viewMode 切替コンテナがエディタ/プレビュー分岐のみ `block` で、チャット/ターミナル分岐は `flex flex-col` だった。
- SplitView の 1 pane 分岐は `flex min-h-0 flex-1 flex-col` を張っていたが、`flex-1` は親が flex container でないと効かない。`block` 親配下では高さが 0 に潰れる。
- 一方 2 pane / 4 pane 分岐は `PanelGroup`（react-resizable-panels）が ResizeObserver で実測して inline `style="height:XXXpx"` を注入するため、block 親でも生存。
- 結果として 1 pane だけ Monaco が `height: 5px` 以下に collapse し、壁紙 `html::before`（z-index -10, position:fixed）が唯一の可視レイヤになっていた。

### 決定
- **PM-957**: 以下 2 点を修正。
  1. `components/layout/Shell.tsx`: エディタ/プレビュー viewMode コンテナを `block` → `flex flex-col` に変更（チャットコンテナと統一）。
  2. `components/layout/SplitView.tsx`: 1 pane 分岐を `flex-1` → `h-full w-full` に変更し、親が flex かどうかに依存しない形へ補強。
- 透過系 hotfix（FileEditor の rgba overlay / globals.css の Monaco transparent 強制）は残置。壁紙を透過させつつ読ませるデザイン要件はオーナーから「壁紙必須」で確定済。

### 検証
- `npx tsc --noEmit` PASS（型エラーなし）。
- ロジック修正なし・CSS class のみの変更のため既存テスト影響なし。
- 手動確認は実機（Tauri）で「1 pane にしてもエディタが描画されること」「2 pane / 4 pane 切替で regress しないこと」「プレビューも同様に潰れないこと」をオーナー側で実施。

### 影響範囲
- エディタ 1 pane 表示。
- プレビュー 1 pane 表示（同じパターンだったため予防的に同修正）。
- チャット / ターミナルはもとから `flex flex-col` だったため影響なし。

---

## PM-956 hotfix5: エディタ overlay 強度をターミナルに揃える（2026-04-23）

### 背景
- PM-957 で 1 pane 高さ潰れが解消し、エディタ文字が見えるようになった。
- ただし hotfix4 の `rgba(0, 0, 0, 0.65)` + `backdrop-filter: blur(2px)` では壁紙の視認性が低く、オーナーから「ターミナルと同じ程度に」と要望。

### 決定
- `FileEditor.tsx` の overlay を `rgba(0, 0, 0, 0.55)` に変更し `backdrop-filter` を除去。
- ターミナル (`--terminal-bg: rgba(0, 0, 0, 0.55)`) と完全に同じ overlay 強度に統一。

### 影響
- エディタ領域で壁紙の視認性が向上。
- blur 除去により壁紙の質感（星空 / 人物シルエット等）が鮮明に。
- text 可読性は PM-932 で検証済の 0.55 同値なので維持される前提（オーナー実機確認）。

---

## PM-958: 起動時に最大化表示（2026-04-23）

### 背景
- オーナーから「アプリが起動した際に全画面で開くように」との要望。
- 従来は `1280 x 820` 固定で起動し、ユーザーが手動で最大化する必要があった。
- 画面サイズが大きいモニタでは特に小さく感じられ、チャット / エディタ / ターミナルの 3 pane 構成が手狭。

### 決定
- `src-tauri/tauri.conf.json` の `app.windows[0]` に `"maximized": true` を追加。
- `fullscreen` ではなく `maximized` を選択（タイトルバーとタスクバーを残す、一般的な「最大化」挙動）。
- `width` / `height` / `minWidth` / `minHeight` は残置 — ユーザーが最大化解除 → 通常ウィンドウへ戻した時の復元サイズおよび最小サイズの制約として機能する。

### 検証
- JSON schema `https://schema.tauri.app/config/2` に準拠（`maximized` は `WindowConfig` の正式プロパティ）。
- 次回 `cargo tauri build` / `cargo tauri dev` 時から有効。

---

## PM-959 / DEC-050: claude-code-company 固有要素を ccmux-ide-gui から完全撤去（2026-04-23）

### 背景
- DEC-027 で `ORGANIZATION_SLASHES` の hardcode 削除と `SlashPalette` の組織グループ UI 撤去は実施済。
- しかし README / CHANGELOG / docs / 一部の production code に「claude-code-company」名称と組織ロール列挙が残存していた。
- オーナーから「**完全な汎用 IDE を目指す** / claude-code-company を使いたい時は当該ディレクトリをプロジェクトとして開けば十分」との指示。
- 徹底調査（Explore agent）で 5 ファイル・8 箇所の参照を特定。

### 決定
以下をすべて削除 / 汎用化した。

| # | File | Before | After |
|---|------|--------|-------|
| 1 | `lib/stores/project.ts` | `defaultWorkspaceRoot()` が `~/Desktop/claude-code-company` hardcode を返す + `detectClaudeCodeCompanyProjects()` が `projects/PRJ-XXX/brief.md` を前提に走査 | 両関数を **完全削除**（どこからも呼ばれていないデッドコード）。未使用になった `homeDir` import も除去。コメントも「旧 Workspace」表現に。 |
| 2 | `lib/types.ts` L126 | 「かつて: `claude-code-company` workspace 配下の 1 プロジェクト」 | 「かつて: 固定 workspace ルート配下の 1 プロジェクト」 |
| 3 | `src-tauri/src/commands/builtin_slash.rs` L133 | 「claude-code-company の組織標準に準拠した最小 4 セクション」 | 「汎用 4 セクション構成 / Claude Code の hierarchical memory ルール」 |
| 4 | `src-tauri/src/commands/slash.rs` L27 | 「claude-code-company 8 役のハードコード」 | 「特定組織ロール 8 役のハードコード」（撤去記録は保持） |
| 5 | `README.md` L13-18, L174, L186-195, L235 | "組織運営統合" を差別化軸として明示 + 8 ロール列挙 + claude-code-company リンク（日英両方） | 「Claude Code エコシステム完全対応（slash/skill/plugin/MCP 自動検出、どんな組織体系でも動く）」に書き換え。credits の claude-code-company 行も除去。 |
| 6 | `docs/release-checklist.md` L64, L102, L173, L227-228, L237 | "Organization workflow integration (/ceo /dev /pm)" / "organization/knowledge/..." / "PRJ-XXX tree navigation" | 「Full Claude Code ecosystem discovery」/ プロジェクト汎用表現に変更。リリース告知文の「claude-code-company と PRJ-012 の文脈含む」も除去。 |
| 7 | `docs/screenshots/SCREENSHOTS-TODO.md` L72-73 | ProjectSwitcher のスクショ指定が "PRJ-001 〜 PRJ-012（claude-code-company 由来）" | 「登録済みプロジェクトの一覧」に汎用化。 |
| 8 | `CHANGELOG.md` L65, L97, L149, L178 | 4 箇所で "組織運営統合は claude-code-company のメタ設計に基づく" | **全 4 行削除**（Credits 節から除去）。 |

### 保持する参照（歴史記録 / 個人情報として妥当）
- `LICENSE` 著作権表示 `Copyright (c) 2026 hironori-oi (improver.jp)`: 法的記載。
- `src-tauri/Cargo.toml` authors email `ai-lab@improver.jp`: package 著作者情報。
- `slash.rs` L27-33 の DEC-027 撤去記録コメント: 「旧版が組織ロールを hardcode していたが本リリースで削除済」という技術的文書として保持（"claude-code-company" 固有名は除去済、汎用的な「特定組織ロール」表現に変更）。

### 検証
- `npx tsc --noEmit` PASS（TypeScript 型エラーなし、未使用 import 除去済）。
- `cargo check` PASS（Rust build OK、既存 3 warning のみ、いずれも本変更と無関係）。
- `grep -ri "claude-code-company"` で production ソース / docs にヒットなし（LICENSE / Cargo.toml の著作者情報は意図的に保持）。

### 影響
- **アプリの挙動変化なし**: 削除した 2 関数はどこからも呼ばれていなかった。
- **コンセプト明確化**: 「日本語ファースト + おしゃれな汎用 Claude IDE」として再定義。claude-code-company を使いたければ当該 directory を project 登録すれば、CLAUDE.md 自動ロードと slash/skill/MCP 自動検出で同等の体験が得られる。
- **再発防止**: 今後 `/ceo` 等の組織ロール前提の UI / コードを書き足さない方針を明文化。

---

## PM-960 / DEC-051: A+C 併用 — cwd scope 完全撤去 + 組織コマンドのグローバル → プロジェクト移行（2026-04-23）

### 背景
- PM-959 で claude-code-company 固有参照を撤去したが、実機スクリーンショットで **`/ceo` が ai-company プロジェクトで "CWD" バッジ付きで表示される** regression をオーナーが発見。
- 2 つの問題が同時発生していた:
  1. `~/.claude/commands/` に置いた組織コマンド 11 個（`ceo`/`dev`/`pm`/`research`/`review`/`secretary`/`marketing`/`web-ops`/`status`/`report`/`new-project`）が **全プロジェクト横断** で表示されていた（Claude Code 仕様通りだが、オーナー意図「claude-code-company でのみ使いたい」と不一致）。
  2. `src-tauri/src/commands/slash.rs` の **cwd chain scan** が process cwd から 5 階層上まで `.claude/commands/` を walk するため、`~/.claude/commands/` に到達して **global コマンドが "cwd" source に上書き** される label bug があった。

### 決定（オーナー承認）
**A + C 併用**:
- **A: cwd scope を完全撤去** — desktop IDE では process cwd が意味を持たないため、Global / Project の 2 スコープに簡素化。
- **C: 組織コマンド 11 個を claude-code-company/.claude/commands/ に集約** — claude-code-company を project として開いた時のみ表示されるようにする。

### 実施内容

#### Step C: ファイル移行（破壊的操作、慎重に段階実施）
1. **事前検証**: `diff` で `~/.claude/commands/*.md` と `~/Desktop/claude-code-company/.claude/commands/*.md` の内容が **全 11 ファイル完全一致** を確認。移行ではなく**重複削除**で足りることが判明。
2. **バックアップ**: `~/.claude/commands.backup-20260423-global-to-project-migration/` に 11 ファイルをコピー保持（復旧可能）。
3. **グローバル側削除**: `~/.claude/commands/` の 11 ファイルを削除。プロジェクト側（claude-code-company）は既存維持で何も触らない。
4. **検証**: 両ディレクトリの最終状態を ls で確認。

#### Step A: cwd scope 廃止（コード修正）
- **`src-tauri/src/commands/slash.rs`**:
  - `scan_all` から cwd chain block（5 階層 walk）を完全削除。
  - `list_slash_commands` から `std::env::current_dir()` 取得を削除、引数は `project_path` のみ。
  - `source_rank`: `"cwd" => 0, "project" => 1, "global" => 2` → `"project" => 0, "global" => 1`。
  - `SlashCmd.source` doc を `"global" | "project"` に限定。
  - 未使用になった `use std::path::PathBuf` import を削除。
  - Tests: `scan_all_cwd_overrides_global` / `source_rank_orders_cwd_first_...` を `scan_project_and_global_are_independent` / `source_rank_orders_project_first_then_global` に置換。
- **`src-tauri/src/commands/skills.rs`**:
  - slash.rs と同じパターンで cwd chain 削除。`list_skills` も project_path のみを受ける。
- **`src-tauri/src/commands/memory_tree.rs`**:
  - `Scope` enum から **dead variant `Cwd` を削除**（scan 処理で一度も emit されていなかったゾンビ）。
- **`lib/types.ts`**:
  - `SlashCmd.source`、`SkillDef.source` を `"global" | "project"` に。
  - `TreeNode.scope` から `"Cwd"` を削除。
- **`components/palette/SlashPalette.tsx`**:
  - `SCOPE_META.cwd` エントリ削除、`SCOPE_ORDER` から `"cwd"` 除去、`GroupedItems.cwd` フィールド削除、`groupAndLimit` の初期化と合計件数計算も更新。
- **`components/inspector/MemoryTreeView.tsx`**:
  - `GroupKey` 型から `"Cwd"` 削除、`GROUP_LABEL`/`openGroups` 初期化/grouping ロジックを 2 scope (Global / Project) に簡素化。
- **`tests/e2e/fixtures.ts`**:
  - `slashCommands.source` 型から `"cwd"` 削除。
- **`docs/release-checklist.md`**:
  - `CLAUDE.md 3-scope (Global / Project / Cwd)` → `2-scope (Global / Project, including Parent fallback)` に修正。

### 検証
- `npx tsc --noEmit` → **PASS**（exit 0）
- `cargo test --lib` → **138 passed; 0 failed**
  - `slash::tests::source_rank_orders_project_first_then_global` ✓
  - `slash::tests::scan_project_and_global_are_independent` ✓
  - `skills::tests::source_rank_matches_slash_rule` ✓
- `cargo check` → **PASS**、`Cwd` variant の dead_code warning 消滅（既存 2 warning のみ残存、本件と無関係）。

### 期待される挙動
- ai-company など claude-code-company 以外のプロジェクトでは `/ceo` 他の組織コマンドは **一切表示されない**。
- claude-code-company を project として開くと、`.claude/commands/` 内の 13 ファイル（aidesigner + 11 組織ロール + CLAUDE.md）が "PROJECT" バッジで表示される。
- CLAUDE.md Inspector は Global / Project の 2 グループ accordion（旧 "カレント (cwd)" グループは消滅）。

### 復旧手順（万一の不具合時）
- `~/.claude/commands.backup-20260423-global-to-project-migration/*.md` をコピーで `~/.claude/commands/` に戻せば復旧。ただし戻した後も slash.rs の cwd scope が廃止されているため、"GLOBAL" ラベルで全プロジェクトに表示される状態になる。

### 影響範囲
- **破壊的変更**: 旧 "cwd" source / "Cwd" scope に依存していたコードは型エラーとして検出済（既に全箇所修正）。
- **ユーザー影響**: `~/.claude/commands/` に他の global コマンドを配置している場合は引き続き "GLOBAL" として表示される（本変更は cwd だけを対象、global は維持）。

---

## PM-961 / DEC-052: ccmux-ide 公式サイト（landing + docs）構築（2026-04-23）

### 背景
- オーナー要望で `https://shin-sibainu.github.io/ccmux/` + `/docs/` のような公式サイトを ccmux-ide 用に構築。
- GitHub Pages 上で landing page + docs 5 ページを提供し、Releases への導線 / 機能紹介 / 使い方説明を一元化する。

### 決定
- **配置**: `ccmux-ide-gui/site/` を **独立した Next.js 15 App Router プロジェクト** として追加（親の Tauri アプリとは `node_modules` 非共有）。
- **スタック選定**: Nextra を採用せず、主アプリと同じ **Next.js 15 + Tailwind CSS + TypeScript + framer-motion + lucide-react + next-themes** で統一。デザインシステムを共有し、バンドル軽量化 + 完全カスタム。
- **静的書き出し**: `output: 'export'`, `basePath: '/ccmux-ide'`, `assetPrefix: '/ccmux-ide/'`, `trailingSlash: true`（GitHub Pages `/docs/` ルーティング互換）。
- **配信**: `.github/workflows/deploy-site.yml`（新規）で push to main 時 `site/**` 変更を検知し `actions/deploy-pages@v4` でデプロイ。ワンタイム設定として Settings → Pages → Source: GitHub Actions が必要。
- **日本語ファースト**: 全ページ日本語。英語版ミラーは将来拡張（MVP では不要）。
- **ブランド**: Claude Orange (`hsl(18 55% 50%)`) アクセント + zinc/stone ニュートラル + Geist Sans/Mono + `◆` ロゴグリフ。ダークモード default（code-editor-like）。

### 生成物
- **landing**: `/` — Nav / Hero / Features grid (6 cards) / Compare table / Why pillars (3) / Install grid (3 OS) / Closing CTA / Footer。
- **docs**: `/docs/` + `getting-started` + `features` + `keybindings` + `architecture` の 5 ページ。左 Sidebar + 本文 + 右 ToC レール。
- **Components 12 個**: Hero, FeaturesGrid, CompareTable, WhyPillars, InstallGrid, ClosingCTA, Footer, SiteHeader, DocsSidebar, DocsLayout, ThemeProvider, ThemeToggle。
- **CI**: `.github/workflows/deploy-site.yml`（2 job: build → deploy-pages）。

### 検証
- `cd site && npm install && npm run build` → 成功（warning / error なし）。
- Landing route: **42.2 kB route / 148 kB First Load JS**（framer-motion 同梱のため）。
- Docs pages: 各 770 B route / 107 kB First Load JS。
- Shared: 102 kB。総静的ファイル ~1.6 MB。
- 生成された `site/out/` に `index.html`（landing）/ `docs/index.html` + 4 subpages（docs）/ `404.html` / `_next/` assets。
- Hero コピー `Claude Code を、デスクトップで、美しく。` が HTML 出力に正しく含まれる（mojibake なし）。
- basePath 確認: CSS / JS asset URL がすべて `/ccmux-ide/_next/...` で始まる。
- `.nojekyll` を `public/` に静的配置 + workflow で `touch out/.nojekyll` の二重防衛。

### 既知の placeholder / 残課題
1. **SHA256 ハッシュ**: `InstallGrid.tsx` は TBD。初回 Release の asset hash 確定後に埋める。
2. **スクリーンショット**: `/docs/features` 内に `TODO: スクリーンショット` コメント。Welcome Wizard / streaming chat / DiffEditor の 3 枚が欲しい。
3. **OG 画像 / favicon**: `public/og.png` / `public/favicon.ico` 未配置。メタデータはテキストのみ。
4. **英語版ミラー**: 未対応（MVP 優先）。

### 次のアクション（オーナー手動）
1. GitHub → Settings → Pages → Source → **GitHub Actions** に切替（1 回のみ）。
2. `site/` と `.github/workflows/deploy-site.yml` をコミットし main に push → workflow が自動デプロイ、`https://hironori-oi.github.io/ccmux-ide/` で公開。
3. SHA256 / screenshots / og.png / favicon を順次補充（非ブロッカー）。

### 影響範囲
- 破壊的変更なし（新規 subdirectory + 新規 workflow のみ）。
- 親 Tauri アプリのビルド / 既存 workflow には影響なし（`site/**` と `.github/workflows/deploy-site.yml` のみが trigger）。

---

## PM-962 / DEC-053: Sumi (墨) ブランドアイデンティティ確定（2026-04-23）

### 背景
- ccmux-ide を製品として成立させるための正式リネーム + ブランド確立（DEC-029 / DEC-041 の具体化）。
- 既存の `◆` グリフ + 「ccmux-ide」ワードマークは仮置き。職人的で静謐な和のトーンを核に据えた新アイデンティティが必要。

### 決定
- **製品名**: `ccmux-ide` → **Sumi (墨)**
- **ブランド哲学**: 「墨の哲学 × モダンテック」。属性優先順位 = 侘寂 > 静謐 > 職人的 > 濃密。
- **ロゴ方向**: 3 案（A: 円相 + 滴 / B: 墨字ミニマル化 / C: 一筆 + 墨滴）のうち **C 案を採用**。
- **カラー**: Claude Orange (`hsl(18 55% 50%)`) を CTA / focus 専用のアクセントとして保持し、主パレットを sumi.ink / charcoal / ash / mist / paper の墨色 5 段に置換。status 色は enso (gold) / chigiri (red)。70/20/10 ルール（墨 70% / 和紙 20% / orange 10%）。
- **タイポ**: Geist Sans / Mono 継続。和文強調は serif ではなく tracking で表現（`tracking-[0.2em]`）。Noto Serif JP 等の和文 serif は不使用。
- **アセット配置**: すべて `site/public/brand/` 配下。`src-tauri/icons/*` は **本 PR では触らない** — ブランド切替は別コミット。

### C 案採用理由（A / B の棄却理由を含む）
- **C 案の強み**: (1) 16px favicon まで崩れない — 一本線 + ドットは圧縮に強い。(2) 世界市場で識別可能 — 漢字読解に依存しない。(3) "pro designer" シグナル最強 — かすれ (kasure) の表現そのものが職人技。(4) 「決定的な一筆」のメタファーが IDE のコード決定行為と符合。
- **A 案（円相 + 滴）棄却**: 瞑想 / メンタル系アプリで既視感が強い、ジェネリックに見える。
- **B 案（墨字ミニマル化）棄却**: 漢字非読者に「読めない落書き」と映るリスク、12 画の簡略化で個性が失われる trade-off が悪い。

### 生成物
- **SVG 6 本**: `logo.svg` / `logo-dark.svg` / `logo-light.svg` / `logo-mark-{dark,light}.svg` / `logo-wordmark-{dark,light}.svg` — すべて手書き最適化、`<title>` / `<desc>` 付与、`currentColor` 対応。
- **アプリアイコン**: `app-icon-1024.svg`（master）+ 32/64/128/128@2x/256/512/1024 PNG（`scripts/generate-icons.mjs` で sharp 経由生成）。
- **favicon**: `public/favicon.ico`（png-to-ico）+ `public/icon.svg`（Safari mask-icon 対応、16px 向け簡略版）。
- **OG 画像**: `public/brand/og.svg` + `og.png`（1200×630）。
- **BRAND.md**: `public/brand/BRAND.md` — logo / color / type / voice / do-don't / icon 生成 / motion を網羅。
- **サイト反映**: `SiteHeader` / `Hero` / `Footer` / `layout.tsx` metadata / `tailwind.config.ts` を更新。hero コピーを `Claude Code を、墨でしたためる。` に差替。`<Logo />` / `<Wordmark />` コンポーネント新設。

### 検証
- `npm run build` 成功（warning なし、/ route 148 kB First Load JS、従前と同等）。
- `out/index.html` に `墨でしたためる` / `Sumi` 両方が含まれることを確認。
- `src-tauri/icons/*` のタイムスタンプが 4月18日のまま = 未変更を確認。

### 非ブロッカー残課題
1. `src-tauri/icons/*` への実際のアイコン反映（BRAND.md §6 のマッピング通りに次回 PR）。
2. Tauri アプリ名 / productName の `Sumi` 変更（`tauri.conf.json` / package metadata）。
3. リポジトリ名自体 `ccmux-ide` → `sumi` 変更は DEC-041 の範囲で別途。

---

## PM-963 / DEC-054: アプリ本体 ccmux-ide → Sumi リネーム + migration（2026-04-23）

### 背景
- DEC-053 で Sumi ブランドを確定、web サイトは反映済（PM-961）。
- 残課題: アプリ本体（Tauri バイナリ / Rust crate / npm package / OS keyring / localStorage）の実リネーム。
- **6 release 実配布済** (v1.0.0〜v1.3.1) により ID 変更は既存ユーザーの資産に影響するため migration shim が必要。

### 決定
**「アプリ本体のみ改称、repo 名は据え置き」** の段階移行戦略。transparent migration で既存ユーザーの資産を引き継ぐ。

### 実施内容

#### A. アイコン再生成
- `npx @tauri-apps/cli icon site/public/brand/app-icon-1024.png` で `src-tauri/icons/` 配下の全 40+ アイコン（desktop / iOS / Android）を Sumi ブランドで再生成。
- 128x128.png が一筆ブラシ + 橙の墨滴の新デザインで生成されたことを目視確認。

#### B. 中核 identity 変更
| ファイル | 変更 |
|---------|------|
| `src-tauri/tauri.conf.json` | `productName` `ccmux-ide` → `Sumi`, `identifier` `jp.improver.ccmux-ide` → `jp.improver.sumi`, window title `ccmux-ide` → `Sumi`, `assetProtocol.scope` に `$HOME/.sumi/**` 追加（`.ccmux-ide-gui/` も互換残置） |
| `src-tauri/Cargo.toml` | `name` `ccmux-ide` → `sumi`, `[lib] name` `ccmux_ide_lib` → `sumi_lib` |
| `src-tauri/src/main.rs` | `ccmux_ide_lib::run()` → `sumi_lib::run()` |
| `package.json` | `name` `ccmux-ide` → `sumi` |

repo URL `hironori-oi/ccmux-ide` は据え置き（updater endpoint 継続利用）、repo 名変更は DEC-041 で別追跡。

#### C. Transparent migration shim（既存ユーザー資産保護）

**1. OS Keyring（API Key 保管）** — `src-tauri/src/commands/config.rs`:
- `KEYRING_SERVICE` `"ccmux-ide"` → `"sumi"`、`LEGACY_KEYRING_SERVICE: "ccmux-ide"` 定数追加
- `load_api_key()` で新 service 空 → 旧 service 参照 → 見つかれば新に書き込み + 旧削除する `migrate_legacy_api_key()` 実装
- v1.3.x で保存した API Key が v1.4+ で自動移行、ユーザー再入力不要

**2. localStorage project registry** — `lib/stores/project.ts`:
- `PROJECT_REGISTRY_STORAGE_KEY` `"ccmux-project-registry"` → `"sumi-project-registry"`、`LEGACY_PROJECT_REGISTRY_KEY` 定数追加
- `safeStorage` の `getItem` を override し、新 key 未存在 + 旧 key 存在時に transparent コピー + 旧削除
- zustand persist の初回 rehydrate でマイグレーション後データを読めるため state 空初期化を回避

**3. localStorage settings** — `lib/stores/settings.ts` + `lib/apply-accent.ts`:
- 新 key `"sumi:settings"` に変更、旧 `"ccmux-ide-gui:settings"` からの transparent 移行
- 起動時早期の同期読みは新 → 旧の順で fallback

#### D. CI workflow artifact 名
- `build-windows.yml`: `ccmux-ide-{nsis,msi,portable}` → `sumi-{nsis,msi,portable}`, binary path を `sumi.exe` + `Sumi.exe` glob
- `release.yml`: artifact 名 / download pattern を `sumi-*` に
- `e2e.yml` / `deploy-site.yml`: コメントヘッダ更新

#### E. コメント / doc 整合
- `src-tauri/src/lib.rs` header → 「Sumi Tauri backend entrypoint」、upstream credit を `ccmux by @Shin-sibainu` に正確化
- `README.md` 日英両セクションを Sumi 名義に、installer ファイル名 `Sumi_0.1.0_*` 表記、命名変遷の脚注追加
- `tsconfig.json`: pre-existing バグ修正で `site/` を exclude 追加

### 検証
- `npx tsc --noEmit` → **PASS**（exit 0）
- `cargo test --lib` → **138 passed; 0 failed**
- `npm run build` → **PASS**（静的 export、4 route、warning/error なし）
- `grep "ccmux_ide_lib\\|jp.improver.ccmux"` → ヒットなし（内部識別子完全置換確認）

### Breaking changes
1. **Bundle identifier 変更** で v1.3.x からの auto-update は切断。ユーザーは手動で Releases から Sumi 版をダウンロードする必要あり。Release notes で明示する。
2. **install path 変更**（Windows %LOCALAPPDATA%\\ccmux-ide → \\Sumi）: 旧バージョン共存可能、アンインストールは手動。
3. **~/.ccmux-ide-gui/ config dir** は引き継がない（初回起動は clean state）。ただし localStorage + keyring の transparent migration で API Key / 設定 / project 一覧は引き継がれる。

### 後続タスク（非ブロッカー）
- v1.4.0 Release Notes に改称告知 + 手動 DL 案内
- DEC-041 実施時に updater endpoint URL 更新 + repo redirect 運用
- `src-tauri/icons/Square*Logo.png` は Tauri bundle 未参照の dead asset、次期 clean up で削除可

---

## PM-964: ブランド UI 重複解消 + エディタタブ切替バグ修正（2026-04-23）

### 背景
オーナー実機確認で発見:
1. 画面左上に「Sumi」が 3 つ並んで重複感: (a) OS ウィンドウタイトルバー, (b) アプリ内 TitleBar + Sparkles ✦ アイコン, (c) Sidebar の `Sumi` ラベル。
2. TitleBar 左の Sparkles アイコンが OS ウィンドウアイコン（同じ位置にあるアプリアイコン）と視覚的に競合。
3. **エディタタブを左クリックしてファイル切替しようとするとドロップダウン（保存 / 閉じる / 他のタブを閉じる）が開き、切替不能**の regression。

### 決定
1. **Sidebar 内の `Sumi` ラベル削除** — TitleBar 側に残して 1 箇所に集約。collapsed 時の空 header は collapse toggle ボタンのみ残す。`AnimatePresence` 未使用化で import も削除。
2. **TitleBar の `Sparkles` アイコン削除** — OS アプリアイコンと重複するため。テキスト「Sumi」のみ残す。未使用 import も除去。
3. **エディタタブ左クリックをドロップダウンから切替に戻す** — 根因は `DropdownMenuTrigger asChild` で tab div を包んでいたため全クリックが menu 起動を奪っていた。`DropdownMenu*` コンポーネント一式を削除し、純粋な `<div role="tab">` に戻す。閉じる導線は既存の X ボタンと **middle-click（`onAuxClick` で button===1）** を維持。保存は Ctrl+S（FileEditor の `addCommand` で登録済）で引き続き可能。

### 影響
- **UI 密度向上**: 左上ブランド表示が 1 → 1（OS 含めれば 2）に正規化、視覚ノイズ低減。
- **エディタ UX 回復**: タブ切替が直感通り動作。
- **失われた機能**: 右クリック / タブクリックから開けた「他のタブを閉じる」アクション。必要なら将来 `@radix-ui/react-context-menu` を追加して右クリック専用メニューとして再導入する（現状は運用影響小と判断）。

### 検証
- `npx tsc --noEmit` → PASS（exit 0）
- 実機動作はオーナー側で確認。

---

## PM-966 / DEC-055: Claude Agent SDK の settingSources + cwd 明示で Cursor 相当の context 理解を実現（2026-04-23）

### 背景
オーナー実機検証で判明:
1. claude-code-company を Sumi でプロジェクト指定 → チャットで "PRJ-012 の sumi ウェブページを確認して" と依頼 → Claude が「どのディレクトリですか？絶対パスを教えて」と返答。**CLAUDE.md / プロジェクト構造が一切読まれていない**。
2. `/ceo` スキルが SlashPalette に表示されるのに、呼び出すと Claude が「そのスキルは登録されていません」と返答。
3. Claude のプロンプトで自身の cwd を「`C:\Program Files\Sumi\…`」のような Sumi インストールディレクトリだと認識している。

### 根因（3 層）
Explore agent による sidecar / Rust / SDK 型定義の徹底調査で以下が確定:

#### 1. **cwd が毎回のプロンプトで SDK に渡されていない**
- `src-tauri/src/commands/agent.rs` の `send_agent_prompt` は options JSON に cwd を含めず、sidecar 側は `process.cwd() = sidecar インストールディレクトリ` にフォールバックしていた。
- `SidecarHandle.cwd` にプロジェクトパスを保存するコードはあったものの、`send_agent_prompt` 時に利用されず dead 状態だった。

#### 2. **settingSources が未指定**
- Claude Agent SDK は **`settingSources` が未指定のとき、CLAUDE.md / .claude/settings.json / MCP config / skills / slash commands を一切自動読込しない**（SDK デフォルト動作）。Claude Code CLI とは異なる。
- `sidecar/src/agent.ts` の `AgentQueryOptions` 型は `settingSources` を受け付ける構造だが、`sidecar/src/index.ts` の opts 構築時に指定が欠如していた。

#### 3. **skill 実行経路は SDK 自動検出で足りる（P3 不要と判明）**
- SDK の `Options` には top-level `skills` 無し。`skills` は `settingSources` で有効化された後、SDK が `~/.claude/skills/` + `<cwd>/.claude/skills/` を自動検出する仕組み。
- したがって P1 (settingSources) を有効化すれば P3 (skill 個別登録) も同時に解決する。

### 決定

**すべての prompt 送信で `cwd` と `settingSources: ['user', 'project', 'local']` を SDK に渡す**。これにより Cursor / Claude Code CLI と同等の context 理解・skill 自動登録を実現。

### 実施内容

#### A. Rust: `send_agent_prompt` で cwd + settingSources 注入
- `src-tauri/src/commands/agent.rs:726-755`:
  - `handle.cwd`（`start_agent_sidecar` 起動時に記録済のプロジェクトパス）を毎回の options に `cwd` として挿入
  - `settingSources: ["user", "project", "local"]` を毎回の options に挿入（Claude Code CLI と同等の読込挙動）

#### B. sidecar: defense-in-depth として default を設定
- `sidecar/src/index.ts:327-347`:
  - `opts` 構築時に `settingSources: req.options?.settingSources ?? ["user", "project", "local"]` を default として明示
  - Rust 側が指定しないケース（手動 IPC や将来の変更）でも安全に動作
- `sidecar/src/index.ts:363-365`:
  - debug stderr ログに `settingSources` を追加し、実機で有効状態を可視化

#### C. SlashPalette: skill click の toast 文言修正
- `components/palette/SlashPalette.tsx:648-674`:
  - 「Claude のセッションでは自動で利用されます」→「次のプロンプト送信時に Claude が自動で読み込みます」に変更
  - DEC-055 で **実際に動作する** ようになったため、正確な表現に

### 期待される挙動

| 機能 | Before | After |
|------|--------|-------|
| CLAUDE.md 読込 | ❌ 完全に無視 | ✅ user + project 階層を自動読込 |
| `.claude/settings.json` | ❌ 無視 | ✅ user + project 両方を merge |
| `.claude/commands/*.md` | △ SlashPalette で表示のみ | ✅ SDK が session で識別、`/cmd` 呼出で実行 |
| `.claude/skills/<name>/SKILL.md` | △ 表示のみ、呼出で "registered しない" | ✅ SDK が auto-discover、`/ceo` 等で実行可能 |
| MCP servers | △ 表示のみ | ✅ SDK が `.mcp.json` 自動 load |
| sidecar cwd | ❌ インストールディレクトリ | ✅ プロジェクトパスに設定（ファイル操作が project root 基準） |

### 検証
- `npx tsc --noEmit`（root + sidecar）: PASS
- `cargo test --lib`: **138 passed, 0 failed**
- sidecar bundle 再ビルド: 806 KB dist/index.mjs 生成成功
- 実機動作はオーナー側で `npm run tauri:dev` + claude-code-company を開いて確認

### Breaking changes
- なし（既存動作を「壊れていた」→「正しく動く」に修正するだけ）
- ただし「Claude が突然 CLAUDE.md に書かれたルールに従い始める」ため、既存会話で Claude が急に口調や挙動を変える可能性あり（期待される変化）

### 後続タスク
- v1.4.0 は既に tag 済のため、本修正は v1.4.1 として次回リリースに含める
- Phase 2 で `/skill-name` のフォーム付き呼び出し UI を検討（現状は SDK 経由で Claude が自然言語で認識）
- MCP 接続状態の live 表示（Phase 2、v1.5+）

---

## PM-967 / PM-968 / PM-969 / DEC-056: UX 改修 3 本（tool 折り畳み / PDF viewer / Workspace）（2026-04-23）

### 背景
オーナー実機検証から 3 つの改修要望:
1. **チャット可読性**: Claude レスポンス中の tool use（Read / Edit / Bash / Grep）が数十件並び本質的回答が埋もれる。折り畳み表示したい。
2. **PDF 文字化け**: `.pdf` をエディタで開くと Monaco が text として流し込み文字化け。正しくビューワで表示したい。
3. **ヘテロ分割**: chat / editor / terminal / preview が別々の viewMode になっており、同時表示できない。ドラッグ&ドロップで自由に配置したい。

案 C（Tray Bar + DnD）を採用、フル実装で対応。

### 決定

#### PM-967: Tool use 折り畳み表示（v1.4.2）
- `AppSettings` に `chatDisplay: { showToolDetails: boolean }` を追加、**default `false`（折り畳み ON）**。
- `components/chat/ToolUseGroup.tsx` 新規: 連続 tool を「N 件の tool 操作 · Read × 5 · Edit × 2」で集約、アコーディオンで展開可能。
- `MessageList` に `groupConsecutiveTools` の pre-processing を追加、`useMemo` で再計算最小化。
- `ChatPanel` ヘッダ右上に `Eye / EyeOff` トグルボタン追加、tooltip 付きで状態切替。
- settings store version 3 → 4、migration で既存ユーザーに `chatDisplay` section を自動注入。

#### PM-968: PDF / 画像 / 動画 / 音声ビューワ（v1.4.2）
- `components/editor/FileViewer.tsx` 新規: 拡張子別ディスパッチャ
  - `.pdf` → iframe + `asset://` URL（WebView2/WebKit 内蔵 PDF viewer を流用、外部依存ゼロ）
  - 画像 7 拡張子 → `<img>`、SVG も同様
  - 動画 4 拡張子 → `<video controls>`、音声 5 拡張子 → `<audio controls>`
  - その他 → 既存 `<FileEditor>`（Monaco）
- `EditorPaneItem` の `FileEditor` → `FileViewer` 差替。
- `lib/stores/editor.ts` に `BINARY_VIEWER_EXTENSIONS` + `isBinaryViewerFile()` 追加、バイナリ拡張子は `readTextFile` をスキップして `loading:false` で即終了、1MB → 50MB に上限緩和。

#### PM-969: Workspace モード（Tray + DnD ヘテロ分割）（v1.5.0）
- 新規依存: `@dnd-kit/core@^6.3.1`（~30KB、キーボード a11y 込み）
- `EditorViewMode` に `"workspace"` 5 番目のモード追加。
- `lib/stores/workspace-layout.ts` 新規: zustand persist store
  - `slots: Array<SlotContent | null>` 最大 4
  - `layout: "1" | "2h" | "2v" | "4"` （2x2 grid の表示パターン）
  - `SlotContent = { kind: "chat" | "editor" | "terminal" | "preview", refId: string }`
  - storage key `sumi:workspace-layout`
- `components/workspace/TrayBar.tsx` 新規: 既存 store から chat panes / open files / terminals / preview を導出、種類別グループ（青/橙/緑/水色）でチップ一覧。各チップは `useDraggable`。すでに slot に配置中の項目は dim 表示。
- `components/workspace/SlotContainer.tsx` 新規: `useDroppable` でドロップゾーン、slot content の kind に応じて `ChatPanel` / `FileViewer` / `TerminalPane` / `PreviewPane` を描画。ヘッダに種別アイコン + タイトル + ✕ ボタン。空のとき「トレイから項目をドラッグして配置」プレースホルダ。
- `components/workspace/WorkspaceView.tsx` 新規: `DndContext` で全体を wrap、`onDragEnd` で `setSlot` を発火。`DragOverlay` でドラッグ中の ghost chip を表示。右上に LayoutSwitcher（1 / 2h / 2v / 4）を配置。
- `Shell.tsx` にワークスペース タブ追加、`viewMode === "workspace"` のとき `<WorkspaceView />` を mount（非 active 時は unmount、既存 view との DOM 競合を回避）。

### 検証
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS（既存 pre-existing warning のみ）
- ChatPanel / FileViewer / TerminalPane / PreviewPane が既存 `paneId` / `openFileId` / `ptyId` prop 設計と整合しているため、slot 内でも同じインスタンスを描画可能。

### Breaking changes
なし（既存 view mode はすべて維持、workspace は追加の 5 番目 mode）。

### 残課題（v1.6+ 候補）
- Slot 内 Terminal は TerminalPane を流用しているが、`ptyId` 指定の軽量 renderer に差し替えると UI がさらにすっきりする。
- Slot の比率可変（現状は grid で均等 50/50）。
- ストレージに置換した slot の「閉じる」時に対応する chat pane / file も削除する option。
- keyboard-only での DnD（@dnd-kit は KeyboardSensor 対応のため追加容易）。

---

## PM-970 / DEC-057: Workspace-First UI（タブ廃止 + Tray 刷新）（2026-04-23）

### 背景
v1.5.0 で追加した Workspace モードは 5 番目のタブとして共存させたが、
オーナーから「タブ自体が不要、Workspace がアプリそのもの」「Tray Bar の
チップ名が長すぎる」「サイドバーのファイルを slot 直接 D&D で開きたい」との
最高 UX を目指す要望。

### 決定

1. **全タブ撤去**。旧 5 タブ（chat/editor/terminal/preview/workspace）を削除、
   起動時から WorkspaceView のみを常時 mount。
2. **Tray Bar 1 行化 + コンパクト化**。高さ 44px の 1 段構成に、チップは
   icon-first で label は 12 文字 truncate + tooltip。
3. **Tray Bar に新規作成ボタン統合**。💬+ / 🖥+ を 1 クリックで追加可能。
4. **LayoutSwitcher を Tray 右端に inline 配置**。旧 WorkspaceView の独立行撤去。
5. **Sidebar → Slot 直接 D&D**。HTML5 native drag (CCMUX_FILE_PATH_MIME) を
   Slot 側で受け、`@dnd-kit` ハイブリッドで共存。

### 実施内容

#### Shell.tsx の劇的簡素化
- ViewModeTab 5 件 + 分割 dropdown を削除
- chat/editor/terminal/preview の display:none / conditional mount block を撤去
- `<WorkspaceView />` のみを常時 mount
- viewMode store は残置（openFile の `setViewMode("editor")` 等の副作用は
  workspace モードでは無視されるだけで害なし）

#### TrayBar 全面書き直し
- 1 行構成: [チップ一覧] [spacer] [新規作成ボタン 2 種] [区切り] [LayoutSwitcher 4]
- チップ compact 化: `MAX_CHIP_LABEL_CHARS = 12`、icon + truncated label + tooltip
- 配置済チップは `opacity-50` で dim 表示、placedRefs は **visible slot のみ** を
  チェック（非表示 slot に入った参照でも dim しない）
- 新規作成ボタン:
  - Chat: `useChatStore.addPane()`
  - Terminal: `createTerminal(projectId, path)` で pty_spawn
  - Editor: sidebar 経由のため button 不在
  - Preview: 1 project = 1 preview なので chip 常時存在、button 不在
- CreationButton component: tooltip + disabled state + loading indicator

#### SlotContainer の dual-drop 対応
- @dnd-kit の `useDroppable` は維持（Tray チップ用）
- HTML5 native の `onDragOver` / `onDrop` を追加
  - `dataTransfer.types.includes(CCMUX_FILE_PATH_MIME)` で accept 判定
  - `dropEffect = "copy"` でカーソル表示
  - `openFile(path)` → `openFiles.find(path)` で id 取得 → `setSlot` 発火
- `isDragTarget` を `(@dnd-kit isOver && active) || HTML5 isFileDragOver` で統合

#### WorkspaceView 簡素化
- LayoutSwitcher / LayoutBtn 削除（TrayBar に移動）
- SlotGrid のみ残置

### 期待される UX
- **起動直後**: Tray Bar は空 or project 由来の preview チップ + Tips、Slot は
  「ドラッグして配置」プレースホルダ
- **チャット追加**: Tray の 💬+ で 1 クリック、チップ生成後に slot へドラッグ
- **ファイル open**: Sidebar ツリーからファイルを slot 直接ドロップ → 即表示
- **ターミナル追加**: Tray の 🖥+ で 1 クリックで spawn + チップ生成
- **レイアウト切替**: Tray 右端のアイコン 4 つで 1 / 2h / 2v / 2x2 を即切替

### 検証
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS（既存 pre-existing warning のみ）
- `cargo check`: PASS

### Breaking changes
- **ユーザー向け UX の全面変更**: 旧 5 タブを覚えていたユーザーは戸惑う可能性
  あり。ただし新 UI は「Tray + Slot」の 2 ステップで直感的なため、学習コスト
  は低い想定。
- `EditorViewMode` の `"workspace"` 以外の値は内部で意味を持たなくなるが、
  store / openFile 等の副作用は無害。

### 残課題（非ブロッカー）
- `viewMode` store の完全撤去（v1.7+ で cleanup）
- Tab キーでのフォーカス順回遊の最適化
- Sidebar file drop 中の slot グリッド全体に overlay 表示（視認性向上）

---

## DEC-053: Model / Effort / PermissionMode を TrayBar に移しセッション別管理（**新設 2026-04-24**）

- **意思決定者**: CEO（オーナー指示）
- **対象バージョン**: v1.9.0（ccmux-ide-gui）
- **内容**:
  - StatusBar にあった Model picker / Effort picker を **TrayBar へ移設**し、**セッション単位**で独立管理する
  - 新規に **PermissionMode picker** を TrayBar に追加（`default` / `acceptEdits` / `bypassPermissions` / `plan` の 4 値、SDK 定義準拠）、これもセッション単位
  - StatusBar からは Model / Effort UI を撤去。OAuth gauge 等その他は残す

- **設計判断**:
  1. **store 分離**: `lib/stores/session-preferences.ts` を**新規作成**（monitor.ts 拡張は却下）。理由: monitor.ts は sidecar 計測イベントの受け皿で責務が違う。ユーザー設定と混ぜない
  2. **Global fallback**: `useDialogStore` の `selectedModel/selectedEffort` は保持し、新規セッション作成時の初期値として継承する（sticky 挙動。`—` 表示ではなく global default をプレロード）
  3. **sidecar 渡し**: 起動時 argv ではなく `send_agent_prompt` の options に per-query で含める。セッション切替で sidecar 再起動は不要
  4. **permissionMode 初期値**: `"default"`（現行 sidecar デフォルトと同じ）

- **代替案と却下理由**:
  - 「monitor.ts に統合」: 責務混在、調査時に dev 提案されたが CEO が却下
  - 「完全 session 独立（global fallback なし）」: 新規 session で毎回 model 選び直しになり UX 劣化、PM-840 の sticky 思想と矛盾
  - 「sidecar 再起動で argv 注入」: セッション切替のたびに遅延が発生、永続プロセスの利点が消える

- **実装範囲**:
  - 新規: `lib/stores/session-preferences.ts`, `components/workspace/TrayModelPicker.tsx`, `TrayEffortPicker.tsx`, `TrayPermissionModePicker.tsx`
  - 改修: `components/workspace/TrayBar.tsx`, `components/layout/StatusBar.tsx`, `components/chat/InputArea.tsx`（または送信経路）, `src-tauri/src/commands/agent.rs`
  - 型追加: `lib/types.ts` に `PermissionMode` と `PERMISSION_MODE_CHOICES`

- **関連**: オーナー指示 2026-04-24、前回 session で pending となっていたタスクの正式決裁

---

## DEC-054: 画面分割パターン刷新（2v 削除 / L 字 3 分割追加）（**新設 2026-04-24**）

- **意思決定者**: CEO（オーナー指示）
- **対象バージョン**: v1.10.0
- **内容**:
  - LayoutSwitcher の `WorkspaceLayout` 集合を **`"1" | "2h" | "2v" | "4"` → `"1" | "2h" | "3" | "4"`** に変更
  - 新 `"3"` は **L 字レイアウト（左 1 画面 + 右上下 2 画面）**。CSS Grid `grid-cols-2 grid-rows-2` で slot0 が左 `row-span-2`、slot1 右上、slot2 右下
  - `VISIBLE_SLOTS["3"] = [0, 1, 2]`
- **Migration**:
  - 既存 localStorage の `"2v"` は起動時に `"2h"` に自動変換
  - slot2 に配置されていた chip は slot1 に移送、slot1 既存内容は slot2 にスワップせず破棄（情報量減るが破壊的ではない）
- **理由**: オーナー要望「3 分割を追加、2v は使っていないため削除」。2v + 2h の差別化が弱く、L 字 3 分割の方が Chat / Editor / Preview の一般的 IDE レイアウトに合致
- **代替案と却下理由**:
  - 2v を残し 3 を追加（5 種類）: LayoutSwitcher ボタンが増えて UI 圧迫、オーナーが明示的に 2v 削除指示
  - 3 分割を「左右3 等分」: IDE 用途としてペイン幅が狭すぎる

---

## DEC-055: Project 別 Workspace Layout 独立保持（**新設 2026-04-24**）

- **意思決定者**: CEO（オーナー指示）
- **対象バージョン**: v1.10.0
- **内容**:
  - `useWorkspaceLayoutStore` を **`layouts: Record<sessionId, SessionLayout>` → `layouts: Record<projectId | "__global__", Record<sessionId | "__default__", SessionLayout>>`** に拡張
  - Current key は `(activeProjectId ?? "__global__", currentSessionId ?? "__default__")` の複合で参照
  - project 切替時に前 project の layout が新 project に影響しない
- **原因分析**:
  - 現行 store は sessionId キーのみ。project 切替で同一 sessionId が再利用される（project A で使った session が project B でも active）と、前 project の slot 配置 / layout 種別が復活する
  - v1.7.4 PM-981 の session 別化は session 切替には効いたが project 切替は想定外だった
- **Migration**:
  - 旧 flat 形 `{ [sid]: {...} }` は新形の `{ "__legacy__": { [sid]: {...} } }` に退避
  - `__legacy__` は参照されない（各 project が空から始まる）
  - 既存ユーザーは「初期レイアウト」が新 project ごとにリセットされる（破壊的だが期待挙動）
- **理由**: オーナー実測で leak 確認、CEO として責務分離的に project scope に移す必要あり
- **代替案と却下理由**:
  - 新規 session を project 切替時に自動作成: session 切替ロジック追加で影響範囲大
  - layout を project 単位だけ（session は持たない）: session 別管理 PM-981 を後退させる

---

## DEC-056: Preview を localhost は in-window iframe、外部 URL は別ウィンドウに分岐（**新設 2026-04-24、DEC-052 条件付き上書き**）

- **意思決定者**: CEO（オーナー指示）
- **対象バージョン**: v1.10.0
- **内容**:
  - URL 判定: `localhost` / `127.0.0.1` / `*.localhost` / `0.0.0.0` を **internal** 判定
  - internal: slot 内に `<iframe>` で表示
  - external: 既存 `spawn_preview_window`（Rust `WebviewWindowBuilder`、DEC-051）継続、slot 内は「外部ウィンドウで開く」ボタン + URL 状態表示
  - iframe 属性: `sandbox="allow-same-origin allow-scripts allow-forms allow-popups"` / `referrerpolicy="no-referrer"`
- **DEC-052 との関係**: DEC-052 は「同一 window 内 multi-webview（Tauri unstable feature）」を見送ったもので、**通常の `<iframe>` とは別技術**。今回の localhost iframe は CSP `frame-src http://localhost:* http://127.0.0.1:* http://*.localhost https:` で既に許可済み、複雑性は低い
- **DEC-048 との関係**: DEC-048 の iframe 撤退理由は外部 URL の `X-Frame-Options: DENY` 問題が主因。localhost はサーバ側で自己コントロール可能なため撤退対象外
- **代替案と却下理由**:
  - 全 URL で別ウィンドウ（現状維持）: localhost 開発の UX が別プロセス行き来になり不便
  - 全 URL で iframe: 外部 URL は X-Frame-Options DENY で表示不能、DEC-048 で既に不採用
  - Tauri WebviewBuilder で slot 埋め込み（DEC-052 案 D2）: unstable feature で stability リスク、DEC-052 で見送り済

---

## DEC-057: Session Preferences を Project 別に独立保持（DEC-053 改訂）（**新設 2026-04-24**）

- **意思決定者**: CEO（オーナー指示）
- **対象バージョン**: v1.11.0
- **背景**:
  - DEC-053 で session-preferences store を導入、global fallback として `useDialogStore.selectedModel/selectedEffort` を新規 session の初期値とした
  - 結果、project A で model を変更 → dialog.selectedModel = Opus → project B に切替 → B の session でも Opus が継承（Project 切替で前 project の設定が引き連れられる leak 発生）
  - DEC-055（Workspace Layout の project 別化）と同根の問題

- **内容**:
  - `useSessionPreferencesStore` を拡張し、**project 単位の「最後に使った設定」** を保持する `perProject: Record<projectId, SessionPreferences>` を追加
  - `perSession: Record<sessionId, SessionPreferences>` は維持（session 別の現行値）
  - 新 session 作成 / 初期化時は、**そのセッションが所属する project の `perProject[projectId]` を継承**（存在しなければハードコード default）
  - **`useDialogStore` の `selectedModel` / `selectedEffort` は session-preferences の初期化源から除外**（完全に project 単位へ移管）
  - `setPreference(sessionId, patch)` 時に該当 session の projectId を解決し、`perProject[projectId]` も同時更新（project scoped sticky）

- **Hard-coded default**:
  - `model`: `null`（sidecar 側で SDK auto-detect、= Claude Max プランの既定モデル）
  - `effort`: `null`（SDK adaptive thinking）
  - `permissionMode`: `"default"`

- **Migration**:
  - 既存の `perSession` データはそのまま保持（session ID は不変）
  - `perProject` は空で開始、各 project で次回 setPreference 時に記録される
  - `persist` version を上げ、旧形は `perSession` のみ存在するものとして読み込み

- **代替案と却下理由**:
  - 「global fallback を完全撤廃、session 毎に hard-coded default」: 毎回モデル選び直しで UX 劣化（sticky 喪失）
  - 「project ごとに project-level runningModel/runningEffort (useProjectStore) を使う」: project.ts は揮発フィールドの責務、permission/effort も混ざると責務混在
  - 「DEC-053 の dialog 継承を維持」: 本 leak が解消しない（=差戻しの要因）

- **関連**: オーナー指示 2026-04-24、DEC-053 の改訂、DEC-055 と同パターンで project scope 独立化

---

## DEC-058: Project 削除時に Session を cascade 削除 + 関連 store 全 cleanup（**新設 2026-04-24**）

- **意思決定者**: CEO（オーナー指示）
- **対象バージョン**: v1.12.0
- **問題**:
  - Project を削除しても、その project に所属していた session が DB / store に残留
  - session が「親 project なし」の孤児状態になり、画面上にも残ったり、他 project に誤って表示される恐れ
  - session-preferences / workspace-layout / preview / session-order など、projectId をキーにする store でも entry が残る

- **内容**:
  1. **Rust (DB) 層**: `delete_project(projectId)` 実行時に以下を**同一トランザクション**で処理
     - `sessions` テーブルから `WHERE project_id = ?` を DELETE（cascade）
     - session に紐付く JSONL / artifacts があれば該当パスもクリーンアップ（任意、破壊範囲限定）
     - 最後に `projects` テーブルから削除
     - 既存の `sessions_has_project_id` 列（cargo warning で未使用と検知されていた）を正式活用
  2. **Frontend store cleanup**（削除成功後にフロント側で）:
     - `useSessionStore`: 該当 project の session を state から除外、`currentSessionId` が削除対象なら null or 残存 session へ切替
     - `useSessionPreferencesStore`: `perProject[projectId]` 削除 + 削除対象 session 群の `perSession[sid]` 削除
     - `useWorkspaceLayoutStore`: `layouts[projectId]` 削除
     - `usePreviewStore` / `usePreviewInstancesStore`: project 単位の URL 履歴 / geometry / instance を削除
     - `useSessionOrderStore`: `order[projectId]` があれば削除
     - `useMonitorStore`: 削除対象 session 群の `perSession[sid]` を削除
     - `useTerminalStore` / `useEditorStore` / `useChatStore` / `usePreviewInstances` 等、session キーを持つ他 store も併せてパージ

- **設計判断**:
  - **DB cascade は SQLite FK `ON DELETE CASCADE` ではなく Rust transaction 内で明示 DELETE**（FK 制約が既存マイグレーションで有効化されていない可能性 + 他 metadata cleanup も同 transaction で完結できる方が明示的）
  - **Frontend cleanup は 1 箇所に集約**（`lib/stores/session.ts` の `deleteProject` action 相当 or 新規 `purgeProjectArtifacts(projectId, sessionIds)` util）
  - **削除の非可逆性**: confirm dialog は既存の有無に応じて現状維持、今回は root-cause の cleanup 漏れを修正するのみ

- **代替案と却下理由**:
  - 「SQLite の `ON DELETE CASCADE` を FK に追加」: 既存 DB migration の複雑化、他 metadata (artifacts path 等) は DB 外なので cascade ではカバーしきれない
  - 「session を論理削除（flag）」: UI 上の残留が解消せず、ゴミデータが累積

- **関連**: DEC-055（layout 別化）、DEC-057（prefs 別化）の延長として、project 削除による leak 方向の leak 解消

---

## DEC-059: デフォルト allowedTools 拡張 + ツール許可承認 UI 実装（**新設 2026-04-24**）

- **意思決定者**: CEO（オーナー指示）
- **対象バージョン**: v1.13.0
- **問題**:
  - `sidecar/src/index.ts:336-343` の `allowedTools` デフォルトが `Read/Edit/Write/Bash/Glob/Grep` のみ
  - SDK は allowedTools 未列挙のツール実行時に `canUseTool` callback を呼ぶが、Sumi は未実装
  - 結果、WebSearch 等を要求すると「haven't granted it yet」で無限停止

- **内容（2 案を同一 PR で）**:

  ### 案A: デフォルト allowedTools の拡張
  - `sidecar/src/index.ts` のデフォルト `allowedTools` に以下を追加:
    - `WebSearch`、`WebFetch`、`TodoWrite`、`NotebookEdit`
  - 理由: リサーチ系は destructive でないため無確認許可で UX 向上。TodoWrite / NotebookEdit は既存の Edit / Write と同レベルの破壊性

  ### 案B: ツール許可承認 UI（canUseTool 経由）
  - **sidecar**: `AgentQueryOptions.canUseTool` callback を登録。tool 実行要求時に Rust へ JSON line で `permission_request` を送信、Rust からの response を `await` で待って SDK に `{behavior: "allow"|"deny", ...}` を返却
  - **Rust**: stdout parser で `permission_request` を処理し、Tauri event で Frontend へ emit。Frontend からの `resolve_permission_request` command で sidecar stdin へ response 送信
  - **Frontend**: 
    - 新規 store `lib/stores/permission-requests.ts` で保留中 request をキュー管理
    - 新規コンポーネント `components/permission/PermissionDialog.tsx` をモーダル表示
    - 選択肢: 「今回のみ許可」「今回のみ拒否」「このセッションで常に許可」「このセッションで常に拒否」の 4 ボタン
    - tool input の要約表示（Bash→command、Write→path、WebSearch→query 等、長文は折りたたみ）
  - **session-preferences 拡張**: `SessionPreferences` に `allowedTools: string[]`, `deniedTools: string[]` を追加。"常に許可/拒否" 選択時に記録、次回以降の同 tool 要求を自動判定
  - **タイムアウトなし**: ユーザー応答を無期限待機（SDK abort controller で interrupt 可能）

- **設計判断**:
  - **案A の追加リスト** は「Web 情報取得 + タスク管理 + Notebook 編集」に限定。MCP tools (`mcp__*`) は含めない（明示承認が妥当）
  - **永続化スコープ は session 単位** から開始。project / global は v1.14 以降で検討（スコープ肥大防止）
  - **UI 位置** はモーダル中央表示（タスクブロッキングが前提）、右下トースト通知方式は却下（見落とし多発）
  - **「拒否」時の挙動**: SDK に `{behavior: "deny", message: "ユーザーが拒否しました"}` を返却、Claude 側で代替行動を検討させる
  - **複数同時 request** はキュー化、順次処理

- **代替案と却下理由**:
  - 「案A のみ、案B は後送り」: オーナー指示で両方要望、本質的解決は案B
  - 「案B のみ、allowedTools デフォルトは据え置き」: 案A の 4 tool は承認 UI で都度聞く必要なし（ノイズ増）
  - 「タイムアウト 60 秒で自動拒否」: 長時間席を外した場合に生産性低下、SDK abort で代替
  - 「project / global 永続化も同時実装」: スコープ肥大、まず session 単位で仕上げてから拡張

- **関連**: DEC-053（TrayPermissionModePicker）、オーナー指示 2026-04-24

---

## DEC-060: plansDirectory を project cwd 配下に固定 + cwd 外書込 UI 警告（**新設 2026-04-24**）

- **意思決定者**: CEO（オーナー指示）
- **対象バージョン**: v1.14.0
- **問題**:
  - `~/.claude/planit/` (正確には `~/.claude/plans/`) 配下に ExitPlanMode が plan を書き込んでいた
  - オーナーは「指定作業ディレクトリ配下でのみ作業してほしい」との要望
- **原因**:
  - sidecar が `settingSources: ["user", "project", "local"]` を渡しており、SDK が `~/.claude/settings.json` を読込
  - その際 `plansDirectory` が SDK デフォルト `~/.claude/plans/` として解決される
  - ExitPlanMode は plansDirectory 絶対パスに書込、cwd と無関係
  - cwd 自体は Frontend → Rust → sidecar → SDK まで正しく project dir が渡っている
- **Claude Code 公式仕様**（公式 docs 確認）:
  - Bash: cwd + subdirectories に sandbox
  - Read/Edit/Write: sandbox なし、permission system で制御
  - SDK に cwd-sandbox 全体オプションは無い
  - つまり Claude Code Desktop も「ハイブリッド方式」。Sumi も同方針でよい

- **内容**:
  1. **plansDirectory を project cwd 配下に固定**
     - Rust `send_agent_prompt` で options に `plansDirectory: "{cwd}/.claude/plans"` を常時注入（呼び出し側で明示指定が無い場合）
     - これで ExitPlanMode の書込先が project 内に限定
  2. **Permission Dialog (DEC-059 案B) の拡張**
     - Write / Edit tool の permission request 受信時、絶対パスを解析
     - `path` が cwd 配下でない場合、dialog 内に赤色警告バナーを表示: 「作業ディレクトリ外への書込みです: `<cwd>` の外側」
     - ユーザーが判断しやすいよう、cwd 配下 / 外で dialog の配色 (ボーダー赤) を切替
  3. **却下案**:
     - settingSources から `"user"` 除外: `~/.claude/.credentials.json` の Max OAuth に影響、却下
     - Tool wrapper / hooks で cwd 外書込 reject: Bash 以外の hard sandbox 実装は SDK 非標準で複雑、DEC-060 では見送り（必要なら v1.15 で検討）
     - systemPrompt 注入: モデル気まぐれで弱い、補助すら不要と判断
- **後方互換**: 既存 `.claude/plans/` への書込ユーザーは引っ越し不要（新書込みは project 内に行くだけ、過去データは削除もしない）
- **関連**: DEC-059（permission UI）、オーナー指示 2026-04-24

---

## DEC-061: Chat Markdown レンダリング品質を Cursor レベルに引き上げ（**新設 2026-04-24**）

- **意思決定者**: CEO（オーナー指示）
- **対象バージョン**: v1.15.0
- **問題**:
  - Chat 表示で Markdown table がプレーンテキスト（`|`、`---` がそのまま）
  - 段落と table が連結表示（blank line が欠落）
  - 全体的に Cursor 上の Claude Code 並みの美観に達していない
- **調査結果の要旨**:
  - `react-markdown@9` + `remark-gfm@4` + `rehype-highlight@7` + `highlight.js@11` は導入済、設定も正しい
  - `@tailwindcss/typography` **未導入** — 手書き mdComponents で table 等を個別整形しているが不完全
  - sidecar → Frontend 経路で `\n` は保持されている
  - 真因: **Claude が出力する markdown で table 直前に blank line が欠落することがあり、GFM parser が table と認識しない**
- **内容（3 本柱）**:

  ### Must（必須）
  1. **`@tailwindcss/typography` 導入** — devDependency に追加、`tailwind.config.*` の plugins に登録
  2. **`prose` class 適用** — `AssistantMessage` root に `prose prose-sm prose-invert max-w-none` 適用、theme に応じて light / dark 切替
  3. **`remark-breaks` plugin 追加** — 単一 `\n` も `<br />` として扱い、段落/table 境界の blank line 不足を吸収（GitHub 互換挙動）
  4. **手書き mdComponents の整理** — prose が担当する要素（p / ul / ol / blockquote / h1〜h6 / table）は削除、残すのは `a` / `code` / `pre` / `img` の特殊ハンドリング
  5. **table の CSS 強化** — `prose` のデフォルトに border / padding / header bg を tailwind config extend で上書き

  ### Should（推奨）
  6. **リンクのクリック可能化** — `a` タグを Tauri `shell.open` で外部ブラウザ起動（既存の `@tauri-apps/plugin-shell` 利用）
  7. **Code block のコピーボタン** — `pre` の右上に「コピー」ボタン、clipboard-manager 既存 dep 利用
  8. **言語別 syntax highlight の視認確認** — `github-dark.css` / `github.css` を theme で切替
  9. **Task list 対応** — `- [ ]` / `- [x]` のチェックボックス表示（GFM 仕様、remark-gfm で自動）

  ### Could（将来候補、v1.15 では見送り）
  10. Diff view（```diff block 独自 styling）
  11. Mermaid / KaTeX（dependency 肥大）
  12. 折りたたみ可能な details block（既に `<details>` は rehype-raw で可）

- **blank line 自動補完の判断**:
  - sidecar 側で Claude 出力を改変するのは**却下**（本来の出力を変更すべきでない）
  - 代わりに **`remark-breaks` で parser 側が寛容に解釈**する（業界慣行）
  - 追加で、Frontend 側で**軽量 preprocess**（「行頭に `|` がある行の直前が blank line でない場合、空行を挿入」）も検討
- **影響範囲**:
  - `AssistantMessage.tsx` が大幅書き換え
  - `tailwind.config.ts` に typography plugin 追加
  - 表示の見た目が広範囲に変わる（改善方向）
  - 既存スレッドのメッセージも新表示で再レンダリングされる（非破壊）
- **代替案と却下理由**:
  - 「手書き mdComponents を拡張し prose 不使用」: Cursor 品質に到達するコストが高い、typography plugin で解決した方が効率
  - 「sidecar で markdown preprocess」: 出力の正確性を壊すリスク、却下
- **関連**: オーナー指示 2026-04-24

---

## DEC-062: 自動更新機能の再有効化 + UX 強化（**新設 2026-04-24**）

- **意思決定者**: CEO（オーナー指示）
- **対象バージョン**: v1.16.0
- **現状調査結果**:
  - `tauri-plugin-updater v2` 導入済、`tauri.conf.json` の endpoint / installMode / pubkey=空 設定済（PM-283 / DEC 記録）
  - `components/updates/UpdateNotifier.tsx` (216 行) が完全実装済: 起動時 silent check / 手動 check / download progress / sonner toast / relaunch 全機能
  - `Shell.tsx:44-45` で **コメントアウト（disabled）状態** — M3 MVP 時に React error #185 容疑で一時 disable、その後 dogfood で不要と判断され放置
  - `.github/workflows/release.yml` は完全機能、v1.15.0 release で `latest.json` が正常配信確認済（GitHub 302 → 200）
  - pubkey 空のため署名検証は skip（DEC 記録通り M3 MVP 許容、将来 Ed25519 鍵発行で差し替え）

- **内容**:

  ### Must（v1.16.0 で必須）
  1. **UpdateNotifier を Shell に再マウント** — `Shell.tsx:44-45` のコメント解除
  2. **React error #185 の再発防止策**:
     - UpdateNotifier 全体を独自 ErrorBoundary で包み、万一のクラッシュでもアプリ本体には波及させない
     - `useEffect` 内の dependency 配列を精査、Zustand selector が useCallback 依存に混ざっていないか確認
     - listener 登録は mount once、unmount で確実に cleanup
  3. **TitleBar に update available バッジ追加**:
     - update が検出された時点で TitleBar 右端に小さな「新バージョン」アイコン（lucide `DownloadCloud`）+ dot を表示
     - クリックで UpdateDialog を開き「更新する」「後で」「このバージョンをスキップ」の 3 択

  ### Should（v1.16.0 推奨）
  4. **「このバージョンをスキップ」機能**:
     - 選択時に `localStorage` に `sumi:updater:skip-version = "1.16.0"` を記録
     - 次回 startup check で同バージョンは無視、次のバージョンが出るまで通知しない
  5. **設定に「自動更新チェック」ON/OFF toggle**:
     - 新規 `useUpdaterSettings` store（localStorage persist）
     - `autoCheck: boolean`（default: true）
     - OFF の場合 startup check を skip、手動 check は引き続き有効

  ### Could（v1.17 以降）
  - 定期チェック（例: 6 時間ごと）
  - リリースノート表示（GitHub Release API から markdown 取得）
  - Ed25519 署名検証（pubkey 鍵発行）

- **UX 指針**（Cursor / VSCode 準拠）:
  - silent startup check → 見つかったら toast + TitleBar badge
  - toast は 20 秒、ユーザーが見逃しても TitleBar badge で気づける
  - download は toast に progress %、完了時は toast success + 自動 relaunch
  - 「後で」「スキップ」「今すぐ」の 3 択で強制しない

- **リスク対策**:
  - React error #185 再発 → ErrorBoundary で封じ込め + crash 時 disable fallback
  - 署名検証なし → M3 MVP 許容、endpoint は固定 github.com のため TOFU リスクは限定的
  - passive install の UX → installMode=passive は変えず、toast に「再起動中」明示

- **代替案と却下理由**:
  - 「disabled のまま維持し手動 check のみ」: オーナー要望に未到達
  - 「pubkey を同時発行して署名検証有効化」: スコープ肥大、v1.17 以降で鍵発行と合わせて実装
  - 「独自 updater に置き換え」: tauri-plugin-updater で十分、再発明不要

- **関連**: PM-283（updater 初期導入）、オーナー指示 2026-04-24

---

## DEC-063: Session-Level Sidecar 正式昇格 (DEC-042 Option B)（**新設 2026-04-24**）

- **意思決定者**: CEO（オーナー指示）
- **対象バージョン**: v1.17.0
- **関連**: DEC-033 (Multi-Sidecar / JobObject) / DEC-042 (Option B 候補) / DEC-053-058 (Session Scope) / DEC-059 (Permission) / PM-810 (Pane Routing) / PM-830 (Resume)

- **問題**:
  - 現状 v3.3 (Option A) は `AgentState { HashMap<project_id, SidecarHandle> }` で **1 project 1 sidecar**
  - 同一 project 内で 2 session を並列実行すると、sidecar の並列 prompt 処理 + Frontend routing が DEFAULT_PANE_ID 固定のため、session 間のメッセージが混線
  - SDK の同一プロセス内並列 query について context 混在 zero guarantee なし

- **調査結果の要旨**:
  - **真因箇所**: `src-tauri/src/commands/agent.rs` L605-645 (stdout/stderr リレーが session 未分離), `sidecar/src/index.ts` L771 (handlePrompt が void で await しない並列実行), `hooks/useAllProjectsSidecarListener.ts` L104 (DEFAULT_PANE_ID 固定), `lib/stores/chat.ts` L236-241 (同一 pane 内で複数 concurrent session がマージされる)
  - **Anthropic 公式 Claude Code Desktop** は split-panel で「2 fully independent AI agent contexts, they don't share memory, they don't interfere」と明言 (https://claude.com/blog/claude-code-desktop-redesign)
  - **SDK** は `each query() call starts a new session by default` と記載、session-level sidecar = session ごと独立 query() call の設計を full support

- **内容**:

  ### 採用案: Option B (Session-Level Lazy Spawn Sidecar)
  - `AgentState` を `HashMap<session_id, SidecarHandle>` に**移行**（project_id キーは廃止）
  - **Lazy spawn**: session の初回 `send_agent_prompt` で sidecar を spawn、以降 reuse
  - **明示停止**: session 削除 (`purgeSessions`) で sidecar を kill。project 削除 (DEC-058) でも所属 session の sidecar を全 kill
  - **OAuth 共有**: `~/.claude/.credentials.json` は全 sidecar が独立読込可能（SDK 仕様）
  - **cwd / plansDirectory**: 同 project 内なら同一 cwd を使うが、書込は `.claude/plans/<session-id>/` 以下に分離して競合回避（DEC-060 延長）
  - **Max 同時上限**: 8 session（内部制限、UI 非表示）。超過時は最古の idle sidecar を hibernate or reject（今回は reject + toast で通知）
  - **JobObject**: DEC-033 Chunk A の仕組みを流用、複数 sidecar を 1 JobObject で管理
  - **Frontend routing**: `useAllProjectsSidecarListener` で `(projectId, sessionId)` tuple の pane 逆引きを実装、DEFAULT_PANE_ID 固定を解除
  - **DB**: `sessions` table に `sidecar_pid` (nullable, debug 用) / `sidecar_started_at` (nullable) カラム追加、migration 付き

  ### 却下した代替案
  - **Option A (常時起動)**: メモリ消費大（10 session × 100MB = 1GB）、v1.17 不現実
  - **Option C (single sidecar + strict routing)**: SDK 内部の hidden state black-box、cross-contaminate zero guarantee なし、SDK update 追従リスク
  - **Hibernate (N 分 idle で kill)**: 再 spawn 2-3 秒の遅延で UX 劣化、v1.18 以降検討

- **リソース試算**:
  - 10 session 同時: Node.js プロセス 80-120MB × 10 = 800MB-1.2GB（Windows で許容範囲）
  - 起動時間: 初回 prompt で 1-2 秒追加遅延（toast で通知）、以降 reuse で即応
  - 現実的 UX 上限: 5-8 session 並列（内部 max 8）

- **影響範囲**:
  - DEC-033: 継続（JobObject は session-level でも有効）
  - DEC-053-057: 拡張（session ごと sidecar + preferences）
  - DEC-058: 統合（session cascade delete → sidecar kill 追加）
  - DEC-059: 継続（canUseTool callback は session スコープ内で正常動作）
  - PM-810 (v3.6 Pane Routing): 準備（session_id を event payload に含める）
  - PM-830 (Resume): 継続（session 単位 resume は既実装）

- **実装タスク分解 (10〜17 日)**:
  1. AgentState を session_id キーに移行（start/stop/send の signature 変更）
  2. Frontend → Rust 呼び出しを session 単位に切替
  3. sidecar 起動 argv / env に session_id を追加
  4. Frontend routing を (projectId, sessionId) tuple で pane 逆引き
  5. Session 削除 cascade kill（DEC-058 統合）
  6. Project 削除 cascade kill (project 所属 session の sidecar を一括)
  7. Max 同時上限 + toast 通知
  8. plansDirectory を session 単位に細分化（`.claude/plans/<session-id>/`）
  9. DB migration (sessions.sidecar_pid / sidecar_started_at)
  10. 既存 E2E test の追従 + 新規 E2E: 2 session 同時指示で独立性確認
  11. Resource leak 検証 (タスクマネージャ kill、孤立プロセス監視)
  12. review 部門レビュー → push → tag v1.17.0

- **関連**: オーナー指示 2026-04-24

---

## DEC-064: Message Storage を Session 単位に移行 + SessionList に状態マーク追加（**新設 2026-04-24**）

- **意思決定者**: CEO（オーナー指示）
- **対象バージョン**: v1.18.0
- **背景**:
  - v1.17.0 (DEC-063) で sidecar 分離は完了、session ごとに独立 Claude プロセスが動作
  - しかし messages を保持する `useChatStore` は依然 **pane 単位** (`panes[paneId].messages`) のまま
  - event 受信時に `findPaneIdForSession(projectId, sessionId)` で pane 逆引き → 該当 pane が見つからない場合に fallback で active pane に描画される可能性
  - 結果: session A の prompt を送った後 session B に切替えると、A の response が B を表示中の pane に届いて混線
  - ユーザー観察: 「session 1 で『何度指示した？』と聞くと正しく『1回』と回答するが、続けて『どう回答した？』と聞くと、Claude B（session 2）の回答を返してくる」 = Claude 自体は独立だが UI 描画側が混線
  - 加えて session の作業状態が可視化されていない（どの session が思考中 / 完了か）

- **内容**:

  ### 1. Message Storage を Session 単位に移行
  - `useChatStore` を refactor:
    - 旧: `panes: { [paneId]: { messages, ... } }` に messages が pane 単位
    - 新: `sessionMessages: Record<sessionId, ChatMessage[]>` に **session 単位**で保持、`panes` は viewport (どの session を表示中か) のみ
  - pane の表示は `sessionMessages[pane.currentSessionId]` を参照
  - 同一 session を複数 pane で表示する場合、**両方の pane が同じ history を見る**（真の一貫性）
  - event 受信時は **session_id 一択**で messages を追加、pane 探索は不要に
  - session 削除時は `sessionMessages[sessionId]` を削除（DEC-058 cascade に統合）

  ### 2. Event Routing を session_id 厳密化
  - `useAllProjectsSidecarListener` で pane 逆引きを廃止、event の session_id で **直接** `sessionMessages` に append
  - 「どの pane にも該当 session が表示されていない」状態でも、messages は session の history として蓄積
  - ユーザーが後で該当 session を pane で開くと履歴が即座に表示される

  ### 3. Session 状態マーク
  - `useSessionStore` の各 session に **volatile な status** を追加:
    - `status: "idle" | "thinking" | "streaming" | "error"`
    - `lastActivityAt: number`
  - sidecar event のライフサイクルで status 更新:
    - `send_agent_prompt` invoke → `thinking`
    - 最初の `message_start` or `text_delta` → `streaming`
    - `message_stop` / `result` → `idle`
    - `error` → `error`
  - **SessionList に icon 表示**:
    - thinking: Loader 回転（lucide `Loader2` animate-spin）
    - streaming: 点滅 dot（primary color）
    - idle: 表示なし（デフォルト）
    - error: 赤 `AlertCircle`
  - tooltip で状態ラベル（「思考中」「応答中」「完了」「エラー」）

  ### 4. 互換性
  - 既存の `panes[paneId].messages` は廃止、localStorage migration で削除（session_id で再構築不可なので **破棄**）
  - 既存 history は **session DB (messages table)** に残っているので、session re-open 時に hydration
  - `creatingSessionId` による pane scope（v1.7.4 PM-979）は保持（session 作成時の初期化に必要）

- **設計判断**:
  - **Message を session 単位に移すのが正解**（pane は viewport、session が truth）
  - 同じ session を 2 pane で開いたときの「両 pane が同じ history を見る」仕様は**意図通り**（session は 1 会話、pane は複数窓）
  - 「送信時の pane を session に binding」案は却下（pane を close したら session も孤立する、UX 劣化）
  - status は volatile（永続化不要、再起動で idle リセット）
  - Max 8 session の制限は DEC-063 で既存、status 表示はそれに直交

- **代替案と却下理由**:
  - pane 単位保持のまま event routing を厳密化: session 切替で pane の messages 入れ替え時に混乱が残る
  - session に `activePaneId` を持たせる: pane close で dangling reference、UX 劣化
  - status 永続化: 再起動で必ず reset が自然、永続化の利点なし

- **関連**: DEC-063 (session-level sidecar)、DEC-058 (cascade), PM-979 (creatingSessionId), オーナー指示 2026-04-24

### 追記（2026-04-24 同日）: 思考中アイコンの持続
- オーナー観察: 「思考中にセッションを移動すると、思考中であったセッションの思考中マークが消える」
- 原因仮説: session.status を pane 切替に連動して reset している、または SessionList が pane.currentSessionId 基準でステータスを描画している
- 仕様確定:
  - session.status は **pane 切替とは独立** の session 固有 volatile 値
  - SessionList は各 session row について **その session 自身の status** を表示（pane が何を表示しているかと無関係）
  - 思考中 session を非アクティブ pane で待機させても、sidebar で常に「思考中」アイコンが見え続けることが正しい挙動
  - 応答受信完了 (`message_stop` / `result`) で初めて `idle` に戻す

---

## DEC-065: Ed25519 署名ベース updater への移行（DEC-059 の署名検証保留を解除）（**新設 2026-04-24**）

- **意思決定者**: CEO（オーナー指示 + 技術的強制）
- **対象バージョン**: v1.19.0
- **背景**:
  - v1.16.0 以降、`tauri.conf.json` の `pubkey=""` 運用で auto-updater を deploy
  - v1.18.1 で signature 空文字列のまま updater が「Invalid encoding in minisign data」エラーで fail
  - v1.18.2 で signature field 省略を試みたが、dev 調査で `tauri-plugin-updater 2.10.1` の `ReleaseManifestPlatform.signature: String` が **serde 必須 field**（非 Option）と判明、missing でも deserialize エラー
  - Tauri v2 公式 docs で「signature verification cannot be disabled」明記、pubkey 空の skip は v1 系の仕様
- **結論**: 署名なし運用は完全に破綻、Ed25519 鍵ペア発行 + 署名ベース updater に移行するしかない

- **内容**:
  1. **Ed25519 鍵ペア発行**: dev が local で `npx @tauri-apps/cli signer generate -w ~/.tauri/sumi.key` 相当を実行
  2. **Public key を `src-tauri/tauri.conf.json` の `plugins.updater.pubkey`** に埋め込み
  3. **Private key を GitHub Secrets** に登録（環境変数 `TAURI_SIGNING_PRIVATE_KEY`、passphrase は `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` optional）
     - private key は dev から出力値を CEO 経由でオーナーに渡し、オーナーが GitHub repo の Secrets 設定画面で登録
     - private key は **絶対に git に commit しない**、.gitignore / secret scanning 対策確認
  4. **`.github/workflows/release.yml` 拡張**: 
     - env に `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` を渡す
     - tauri-action (または手動 tauri build) で署名生成、各 artifact に `.sig` ファイルが生成される
     - latest.json 生成時に各 platform の `.sig` ファイル内容を読んで `signature` field に埋める
  5. **既存 v1.16.0 〜 v1.18.2 ユーザーの移行**:
     - 自動更新は**不可能**（既存 binary の埋め込み pubkey が空なので、新 v1.19.0 の署名付き latest.json を検証できない、もしくは検証しようとして新しいエラーになる）
     - 対応: CHANGELOG / Release notes / LP に「v1.19.0 以降は Ed25519 署名付き、既存 v1.18 以前からの自動更新不可。**GitHub Release ページから v1.19.0 installer を手動 DL し上書きインストールしてください**」を明記
     - LP (`site/`) にも「手動移行の案内」バナーを一時掲出
  6. **v1.19.0 以降は自動更新が正常動作**

- **代替案と却下理由**:
  - 「updater 完全無効化」: オーナー要望の自動更新が失われる、却下
  - 「tauri v1 系にダウングレード」: 他機能（protocol-asset、PTY 等）の互換性問題、非現実的
  - 「別 updater プラグインの採用」: エコシステム外、サポート薄い、メンテ負担大

- **リスク**:
  - private key の管理ミスで漏洩したら攻撃者が偽 update を配信可能 → Secrets 管理を厳守、鍵 rotation 手順もドキュメント化（v1.20 以降）
  - v1.18.2 までの既存 installed 版は「自動更新できない」ロックイン、オーナー手動移行が必須
  - GitHub Release の release.yml が `TAURI_SIGNING_PRIVATE_KEY` Secret 不在だと build fail → dev 実装時に graceful fallback 検討（Secret 無ければ警告だけで build 続行、artifact は unsigned で release）

- **関連**: DEC-059（permission UI、pubkey 将来対応と記載）、DEC-062（updater 有効化）、オーナー指示 2026-04-24

---

## DEC-066: ProjectRail アイコンの状態可視化強化 + プロジェクト別 accentColor（**新設 2026-04-25**）

- **意思決定者**: CEO（オーナー指示）
- **対象バージョン**: v1.20.0

- **問題（4 点）**:
  1. ProjectRail のアイコン応答中マークが**非選択プロジェクトでは消える**（選択連動の描画 bug、DEC-064 で session 側を直した同パターン）
  2. 応答完了時のマークが**即消え**してしまう。ユーザーが該当 project を開くまで「未読」として継続表示したい
  3. 現在「実行中」は右下ドットで表現しているが、オーナー要望で**アイコン自体の背景色で停止／実行中を可視化**したい
  4. **プロジェクトごとにアイコン背景色を選択**可能にしたい（視覚的区別）

- **内容**:

  ### 1. Project 状態の volatile 集約
  - `useProjectStore` の各 project entry に volatile status を追加:
    - `status: "idle" | "thinking" | "streaming" | "completed" | "error"` (default `"idle"`)
    - `hasUnread: boolean` (completed が解除されるまで true)
    - `lastActivityAt: number | null`
  - 集約ロジック（selector で computed）:
    - 所属 session のいずれかが `thinking` / `streaming` なら project は同じ最優先状態
    - 全 session idle で、**直近の session 応答完了** から project が active view で開かれるまで `completed`
    - 該当 project を active にすると `completed` → `idle` 遷移、`hasUnread` クリア
  - volatile、localStorage 非永続化（再起動で idle リセット）
  - DEC-063 以降の session.status から derive、session 側の更新に連動

  ### 2. Completed の継続表示（未読的挙動）
  - session 応答完了 (`message_stop` / `result`) → 該当 session を pane で**表示していなければ** session.hasUnread=true
  - Project 集約時、いずれかの session が hasUnread=true なら project.status=`completed`
  - ユーザーが project を active にして該当 session pane を開くと hasUnread=false に戻る
  - SessionList の既存アイコン（DEC-064）と整合、session でも completed 表示（Sparkles Check 等の確認アイコン）

  ### 3. アイコン背景色での実行状態表現
  - ProjectRail の project icon component を改修
  - 旧: 右下に小さな status dot
  - 新: **アイコン自体の背景色** を status で変化
    - idle: accentColor（ユーザー設定色）そのまま
    - thinking: accentColor に pulse animation（primary ring）
    - streaming: accentColor + pulse 強め
    - completed: accentColor + 確認アイコン overlay（未読強調）
    - error: destructive overlay（赤系）
  - 右下 dot は廃止、代わりにステータス overlay / ring で表現

  ### 4. プロジェクト別 accentColor
  - `useProjectStore` の ProjectRegistry 型に `accentColor: string | null` field 追加（persist）
  - プリセット色（Tailwind tokens）: `slate` / `red` / `orange` / `amber` / `yellow` / `lime` / `green` / `emerald` / `teal` / `cyan` / `sky` / `blue` / `indigo` / `violet` / `purple` / `fuchsia` / `pink` / `rose` / `neutral`（デフォルト）
  - 値の保存方式: Tailwind token 名（`"blue"` 等の短い文字列、CSS variables や classname で使いやすい）
  - UI:
    - プロジェクト右クリックメニュー or Settings > Project > Accent Color picker
    - 色選択 popover（grid 状に 12-18 色のチップ、クリックで即適用）
    - 既存項目「リネーム」「削除」の近くに「色を変更」アイテム追加
  - デフォルト: `neutral`（色付けなし）、ユーザーが明示的に選ばなければ中立色

- **設計判断**:
  - status は volatile、永続化不要（再起動で idle から出発が自然）
  - hasUnread は volatile、永続化不要（再起動時に「未読」は意味を失う、新規送信で再計算）
  - accentColor は persist（永続化、ユーザー設定）
  - アイコン配色は `bg-{color}-500` / `hover:bg-{color}-600` / `ring-{color}-400` の Tailwind tokens で統一
  - ダーク/ライト theme 両対応（`dark:bg-{color}-400` 等）

- **代替案と却下理由**:
  - 「完了マーク自動消失タイマー 5 秒」: ユーザーが気づかない可能性、未読永続化が自然
  - 「accentColor を自由 HEX 入力」: UX 複雑化、プリセット 19 色で十分
  - 「背景色と dot 両方残す」: 視覚ノイズ過多、オーナー指示で dot を廃止し背景色に統一

- **関連**: DEC-064 (session status)、DEC-063 (session-level sidecar)、オーナー指示 2026-04-25

---

## DEC-067: Claude 応答中の追加チャット送信 + Esc 停止（Cursor 互換 UX）（**新設 2026-04-25**）

- **意思決定者**: CEO（オーナー指示）
- **対象バージョン**: v1.21.0

- **問題（2 点）**:
  1. 現状 InputArea は Claude 応答中（thinking / streaming）に textarea / 送信ボタン両方 disabled になり、追加質問を打てない。Cursor の Claude Code は応答中でも入力でき、送信時に現応答を停止して新 turn を始められる
  2. Esc キーで応答停止する経路が無い（現状は SessionList の停止ボタンか sidecar 終了経由のみ）。Cursor の Claude Code では Esc で即停止できる

- **採用方針（案1: interrupt + 新 turn）**:
  - SDK は streaming input mode で `streamInput()` による mid-turn injection をサポートするが、現 sidecar 実装は string prompt + AbortController 経路。streaming input mode への移行は SDK の `Query` ハンドルを sidecar 側で長期保持する必要があり、設計変更が大きい
  - 既存の `send_agent_interrupt` Tauri command + sidecar の `handleInterrupt` (AbortController.abort()) は v3.3.1 で実装済 (DEC-059 系列の review v6 で導入)。これに依拠する形が最小実装で確実
  - 案1 (interrupt + 新 turn): 送信時に現 query を abort → 新 prompt として送信。Cursor の挙動と外形上同等で、UX の差異は小さい
  - 案2 (mid-turn injection): SDK streaming input mode で `streamInput({type: "user", message: ...})` を中断せず投入。現 sidecar 設計から逸脱、v1.21.0 では採用しない

- **内容**:
  ### 1. Esc 停止
  - グローバル keydown listener を Shell に `EscapeProvider` として 1 箇所マウント
  - `Escape` 押下 + 以下を全て満たす場合のみ `send_agent_interrupt(sessionId)` 発火:
    - IME composition 中ではない (`event.isComposing` / `keyCode === 229` 除外)
    - PermissionDialog が開いていない (`permission-requests.pending.length === 0`)
    - その他の Radix Dialog (open) が DOM に無い (`[role="dialog"][data-state="open"]` 不在)
    - active pane の current session が存在し、status が `thinking` / `streaming`
  - modifier (Ctrl/Shift/Alt/Meta) は要求しない (Cursor 互換)
  - status reset は sidecar からの `interrupted` event を受けて `useAllProjectsSidecarListener` が捌く既存経路を再利用

  ### 2. 応答中の追加チャット送信
  - InputArea の textarea / 送信ボタンの disabled 判定を緩和: 応答中も入力可、ボタンも有効
  - 送信時の挙動: status が thinking/streaming なら `send_agent_interrupt` を await してから `send_agent_prompt` を呼ぶ
  - sidecar 側の `handleInterrupt` は AbortController を全 in-flight に `abort()` する。新 prompt は同 session の handlePrompt が並列実行可能 (controller は req.id ごとに独立)
  - 「中断中…」等の transient toast は出さない (UX を spam しない)

  ### 3. UI/UX
  - 応答中のみ「Esc で停止 / そのまま送信すると停止して新しい turn になります」のヒントを InputArea 下に表示
  - 送信ボタンの label を状態で切替: idle 時「送信」、応答中「停止して送信」
  - placeholder も応答中は「応答中... (Esc で停止 / 送信で停止して新しい turn)」に変更

- **設計判断**:
  - sidecar 側の AbortController は req.id ごとの Map で管理されており、interrupt 時は当該 session の全 in-flight を一括 abort できる (sidecar は session 単位起動なので 1 session = 1 sidecar = 高々 1 in-flight が通常)
  - Rust 側 `send_agent_interrupt` は既に存在 (commands/agent.rs)。新規追加は不要
  - グローバル listener は `window.addEventListener("keydown")` で bubble phase listen し、Radix Dialog (Permission/Update) 自身の Esc=close ハンドラを尊重
  - permission_request 中の Esc は dialog 側の deny ハンドラ優先 (PermissionDialog の既存挙動)
  - InputArea 内 SlashPalette / AtMentionPicker open 中の Esc は palette close 優先 (e.preventDefault() 後に bubble するが、グローバル handler は `e.defaultPrevented` を見て no-op)

- **代替案と却下理由**:
  - **案2 (mid-turn injection)**: SDK の streaming input mode は `prompt: AsyncIterable<SDKUserMessage>` を要求。sidecar の handlePrompt は string prompt の `for await (const ev of runAgentQuery(...))` 構造で、AsyncGenerator の制御権は SDK 内部にある。mid-turn injection を真にサポートするには `Query` ハンドルを保持し `query.streamInput()` を呼ぶ別コードパスが要る。v1.21.0 では UX 同等の案1 で出荷し、案2 は将来の改善候補とする
  - **送信時 toast 表示**: 「中断して送信中...」を出すと UX が冗長。interrupt の Promise を await するだけで体感遅延は最小化される
  - **Esc に modifier 要求 (Ctrl+Esc 等)**: Cursor 互換性の損失、UX 後退。modifier 無しで採用

- **関連**: DEC-063 (session-level sidecar)、DEC-059 (permission dialog)、v3.3.1 review v6 Should Fix S-2 (interrupt 既存実装)、オーナー指示 2026-04-25

---

## DEC-068: permissionMode を実装と説明文で整合化、allowedTools を動的構成（DEC-059 改訂）（**新設 2026-04-25**）

- **意思決定者**: CEO（オーナー指示 + 仕様矛盾の根治）
- **対象バージョン**: v1.22.0
- **問題**:
  - 現状 `sidecar/src/index.ts:529-540` が `allowedTools: ["Read","Edit","Write","Bash","Glob","Grep","WebSearch","WebFetch","TodoWrite","NotebookEdit"]` を **永続的に許可**
  - `permissionMode: "default"` でも Edit / Write / Bash 等が **無確認実行** されてしまう
  - TrayPermissionModePicker の説明文「標準: **編集ごとに確認を求める**」と完全矛盾
  - DEC-059 案A は「便利さ優先」で導入したが、permissionMode 仕様と整合していなかった

- **内容**: permission mode に応じて allowedTools を **動的構成**

  | Mode | UI 説明 | allowedTools 動的構成 | 挙動 |
  |---|---|---|---|
  | `default` | 編集ごとに確認を求める | `Read, Glob, Grep, WebSearch, WebFetch` のみ | 編集系は canUseTool で都度承認 |
  | `acceptEdits` | 編集を自動で承認 | `Read, Glob, Grep, WebSearch, WebFetch, Edit, Write, NotebookEdit, TodoWrite, Bash` | 全自動許可 |
  | `bypassPermissions` | 全操作を許可 | 全許可 | 全自動 |
  | `plan` | 提案のみ、ファイル変更なし | `Read, Glob, Grep, WebSearch, WebFetch` | 書込系は SDK が plan mode で block |

- **設計判断**:
  - 公式 Claude Code SDK 仕様（`default`=都度確認、`acceptEdits`=編集自動承認）に整合
  - readonly tool は全 mode で許可（情報取得は permission を求めない）
  - 編集系は `acceptEdits` / `bypassPermissions` でのみ自動許可
  - `default` モードでは編集系は canUseTool で dialog 経由（DEC-059 案B の UI を活用）
  - 呼び出し側が options.allowedTools を明示指定したらそちらを優先

- **影響範囲**:
  - sidecar/src/index.ts の allowedTools 構築ロジックを mode 連動に
  - 既存「標準」モード使用中の session で、次回送信から編集系操作で permission dialog が出る（破壊的だが期待通り）

- **関連**: DEC-053、DEC-059、オーナー指示 2026-04-25

---

## DEC-069: localhost サーバー管理機能（Phase 1 MVP）（**新設 2026-04-25**）

- **意思決定者**: CEO（オーナー指示）
- **対象バージョン**: v1.23.0
- **背景**: Sumi 内蔵ターミナルや外部で起動した localhost サーバーを Sumi UI で確認・kill したい要望
- **内容（Phase 1 MVP）**:
  1. Rust commands: `list_local_servers()` / `kill_local_server(pid, force)`
  2. crates: `sysinfo` (プロセス情報 + kill) + `netstat2` (port→pid マッピング)
  3. Frontend: `components/sidebar/LocalServersPanel.tsx` を sidebar の新 tab として追加
  4. 5 秒 polling、tab 非アクティブ時は停止
  5. kill は AlertDialog で destructive 確認
  6. Sumi 自身のプロセスは kill 候補から除外
  7. LISTEN のみ表示、TIME_WAIT / CLOSE_WAIT は除外
  8. IPv4 / IPv6 同 pid は 1 行に集約

- **採用案**: sidebar tab（常時参照可能、StatusBar からの dialog より UX 上優位）
- **後続フェーズ（候補）**:
  - Phase 2 (v1.24): Preview との双方向連携、Sumi 由来プロセス識別
  - Phase 3 (v1.25+): lineage 追跡、health check、起動履歴

- **関連**: オーナー指示 2026-04-25

---

## DEC-070: `/chrome` ブラウザ操作機能の Sumi 統合（Phase 1）（**新設 2026-04-25**）

- **意思決定者**: CEO（オーナー指示）
- **対象バージョン**: v1.24.0
- **背景**:
  - Anthropic 公式 Claude Code CLI の `--chrome` / `/chrome` 機能（ベータ）を Sumi に統合
  - 公式 docs: https://code.claude.com/docs/ja/chrome
  - オーナー環境: CLI 2.1.113（要件 2.0.73+ クリア）、Claude Max OAuth、Windows native（WSL 不可は影響なし）
  - 既存 Chrome 拡張「Claude in Chrome」と Native Messaging Host 経由で接続、組み込み MCP `claude-in-chrome` でブラウザ操作 tool を提供

- **内容（Phase 1 MVP）**:
  1. **`/chrome` slash command** を Sumi SlashPalette built-in に登録
     - 入力 → SDK に通常 prompt として送信（CLI 仕様に乗る、最軽量実装）
     - 説明文「Chrome 接続のステータス確認・有効化・再接続」
  2. **Settings に「ブラウザ操作」セクション**
     - 「Chrome 拡張をインストール」ボタン → chromewebstore を外部ブラウザで開く
     - 「**Chrome デフォルト ON**」toggle（**既定 OFF**、context 節約）→ ON で sidecar の query options に `extraArgs: { chrome: null }` を session ごとに付与
     - CLI version 自動検知（`claude --version` を spawn）→ 2.0.73 未満なら warning
     - 接続ステータス表示（拡張検知 / Native Messaging Host 確認）
     - ヘルプ「`/chrome` でいつでも接続管理できます」
  3. **エラー UX**
     - 「Browser extension is not connected」「Extension not detected」「No tab available」「Receiving end does not exist」を日本語に翻訳して toast 表示
     - 「拡張をインストール」「Chrome を再起動」等の具体 CTA を併記
     - v1.22.6 の sidecar stderr toast filter と整合

- **設計判断**:
  - **既定 OFF**: 公式 docs が context 消費増を警告、オーナー要望で「都度 `/chrome` で有効化」が UX 上自然
  - **公式既定 profile（Cookie 共有）尊重**: 公式機能の利便性（Gmail/Notion/Slack 等のログイン状態共有）を最優先、isolated profile はオーナーが望めば Phase 2 でオプトイン
  - **`extraArgs: { chrome: null }` を session 単位で付与**: DEC-053/057 の session-preferences パターンに統合（chromeEnabled: boolean を追加）
  - **chrome-devtools-mcp / playwright-mcp 併用は Phase 2**: `/chrome` 公式単体で Phase 1 出荷、third-party MCP は別途
  - **TrayBar UI 追加は Phase 2**: Phase 1 は SlashPalette + Settings のみ、CLI 実機検証後に UX 改善

- **実装範囲**:
  - 新規: `components/settings/BrowserAutomationSection.tsx`（Settings の新セクション）
  - 修正: `lib/builtin-slash.ts`（`/chrome` 追加）, `lib/stores/session-preferences.ts`（`chromeEnabled` 追加）, `sidecar/src/index.ts`（chromeEnabled→`extraArgs` マッピング）, `src-tauri/src/commands/agent.rs`（options pass-through 確認）, `hooks/useAllProjectsSidecarListener.ts`（browser エラー日本語化）
  - 非対応: chrome-devtools-mcp / playwright-mcp 統合 UI / Live View / domain ホワイトリスト（Phase 2 以降）

- **関連**: DEC-053（session-preferences）、DEC-057（perProject sticky）、DEC-068（permissionMode）、オーナー指示 2026-04-25

---

## DEC-071: 応答テキスト中間欠落の根治 — last-write-wins 化（**新設 2026-04-28**）

- **意思決定者**: CEO（オーナー指示「Option A で進めてください」）
- **対象バージョン**: v1.31.2
- **背景**:
  - オーナーが「sumi の応答が稀に一部欠落する」現象を 2026-04-28 に報告、添付スクショで再現確認
  - 現象: 文の塊単位で中間が消え、引用符が壊れた状態（例「sync-h-to-web.sh で improver-web へ反映しま」→ 唐突に「ット" として残っている」に飛ぶ）が表示される
  - 改行 / 文字境界破損ではなく、明らかに sentence chunk 単位で消失 → reducer の delta 計算ミスを最有力仮説として CEO が判断

- **原因（CEO 判定）**:
  - `hooks/useAllProjectsSidecarListener.ts` の assistant event 処理が
    `text.slice(existed.content.length)` という **prefix-extension 前提** で
    delta を抽出していた
  - Claude Agent SDK の assistant event は内部で text block を分裂・再結合・
    thinking 挿入で再構成することがあり、`extractText` が `\n` join した結果が:
    - **累積長が前回より短くなる** → 以降 slice() が空文字 → 中間欠落
    - **prefix が一致しない** → 重複 / 文字化け
  - これが構造的バグであることを `extractText` 実装と SDK の content array 仕様
    から確証

- **判断**:
  - **last-write-wins** で content を完全置換する方式に切り替える
  - sidecar 側 (Rust buffer / Tauri emit) の遡及調査は見送り、frontend reducer
    だけで現象を吸収できるかをまず確認（Option A: 観測 + 軽量防御）
  - 観測ログで non-monotonic 更新を warn 化し、再発 / 別原因の場合の現場証拠を残す

- **実装**:
  1. `lib/stores/chat.ts`: `replaceStreamingMessage(sessionId, id, content)` を新規追加
  2. `hooks/useAllProjectsSidecarListener.ts`: assistant event の delta append を
     完全置換に切替、`prevLen / newLen / isShrink / prefixOk / prevTail / newTail`
     を console.warn (anomaly) / logger.debug (正常) で記録

- **設計判断**:
  - 既存の rendering 経路は `m.content` を読むだけで破壊的変更なし
  - DB 永続化は finalizeStreamingMessage 経由で最終状態のみ書き込むため
    last-write-wins と相性が良い
  - 観測 warn は production にも残す（再現が稀で短期 dogfood では掴みきれないため）

- **関連**: DEC-064（session 単位 message store）、DEC-063（session-level sidecar）、
  オーナー指示 2026-04-28

---

## DEC-072: Session 単位の起動/停止 UI 露出 + 起動数可視化 + プロジェクト並び替え（**新設 2026-04-28**）

- **意思決定者**: CEO（オーナー指示「各セッションの起動停止を別々に行えるようにしたい」）
- **対象バージョン**: v1.32.0
- **背景**:
  - DEC-063 (v1.17.0) で **1 session = 1 sidecar (Claude プロセス)** に正式昇格済み
  - しかし UI は project 単位の一括起動/停止しか提供しておらず、TitleBar の
    「停止」ボタンは project 内の全 session sidecar を kill する設計だった
  - オーナーは「必要な session だけ起動して総 RAM 消費を抑えたい」「起動して
    いる Claude の合計を可視化したい」「session ごとの起動/停止状態を視覚的に
    把握したい」「project 並び順を変更したい」を要望（2026-04-28）

- **判断**:
  - frontend のみで完結する（Rust 側は `start_agent_sidecar` / `stop_agent_sidecar` /
    `list_active_sidecars` の session 単位 API がすでに揃っている）
  - **active-sidecars store** を新設し、`list_active_sidecars` を 5 秒間隔で
    poll して Rust を source of truth とする一元管理にする
  - **UI 露出は SessionList の DropdownMenu に「Claude を起動 / 停止」項目を追加**
    する形で控えめに（誤操作防止 + 既存 UX を破壊しない）
  - **state dot は session 行右側に常時表示**（緑=起動中 / 灰=停止中）
  - **StatusBar の "N sidecars" は session 単位カウントに改修**、tooltip でも
    session タイトル（project 名）を列挙
  - **ProjectRail の並び替え** は `@dnd-kit/sortable` で実装、PointerSensor の
    activationConstraint=8 でクリック選択 / 右クリックメニューと両立

- **実装**:
  1. **新規 `lib/stores/active-sidecars.ts`**: `Record<sessionId, SidecarInfo>` を保持
     する Zustand store。`refresh()` / `markStarted` / `markStopped` / `isRunning`
     を提供。persist しない（プロセス終了で sidecar 全 kill されるため）
  2. **新規 `hooks/useActiveSidecarsPoll.ts`**: 5 秒間隔 polling hook、Shell から
     1 回マウント
  3. **新規 `lib/session-sidecar.ts`**: `startSessionSidecar(sessionId, projectId)` /
     `stopSessionSidecar(sessionId)` の薄い wrapper。InputArea の send 経路と
     整合する model / effort 解決ロジックを内包
  4. **`components/sidebar/SessionList.tsx`**: SessionItem に sidecar 状態 dot +
     DropdownMenu の「Claude を起動 / 停止」項目を追加。session_id を Set 化して
     Map lookup を高速化
  5. **`components/layout/StatusBar.tsx`**: ActiveSidecarsIndicator を session 単位
     カウントに改修。tooltip も session タイトル + project 名で再構成
  6. **`components/layout/ProjectRail.tsx`**: SortableContext + SortableProjectRailItem
     で並び替え対応、`reorderProjects` action を project store に追加
  7. **`lib/stores/project.ts`**: `reorderProjects(fromIndex, toIndex)` を追加。
     persist 経由で localStorage に保存

- **設計判断**:
  - **polling 間隔 5 秒**: Rust HashMap lookup は <1ms、毎秒だと不要負荷、10 秒
    だと操作直後の UI 反映が遅い。操作直後は明示 refresh で間 polling 待ちを排除
  - **state dot の click 起動は採用しない**: 誤操作（session 切替時に dot を
    踏んで停止）を防ぐため、起動/停止操作は DropdownMenu 経由のみ
  - **TitleBar の「停止」は変更しない**: project 単位の「全部停止」は緊急停止
    用途として価値があり、既存挙動を維持。UI に「ここは project 単位 / SessionList
    は session 単位」の二段構成が成立する
  - **ProjectRail D&D distance=8**: SessionList の 4 だと右クリックメニュー誤発火
    が起きやすいため、icon 主体の rail はやや厳しめに

- **関連**: DEC-063（session-level sidecar）、DEC-066（ProjectRail status）、
  PM-983（session 並び替え）、オーナー指示 2026-04-28

---

## DEC-073: Editor Slot を複数タブコンテナに格上げ（**新設 2026-04-28**）

- **意思決定者**: CEO（オーナー指示「Editor チップに複数ファイルをタブで開けるようにしたい」）
- **対象バージョン**: v1.33.0
- **背景**:
  - 旧仕様 (v1.32.x まで): `SlotContent { kind: "editor", refId: <fileId> }` で
    1 ファイル = 1 Slot に固定。複数ファイルを並列表示するには Slot を分けるしかない
  - Tray の「Editor チップ」は openFiles の各ファイルごとに動的生成され、ペインに
    1 つドラッグするごとに既存内容を置換する破壊的 UX だった
  - オーナー要望: 「Editor (空) チップを 1 個」「ペイン上部にタブバー」「複数ペイン
    でそれぞれ独立した Editor」「タブの drag 並び替え + 別ペイン移動」も実装

- **採用案 (オーナー A 案 + 全機能投入)**:
  - **A 案**: ファイル単位 chip を**廃止**、Tray は固定 4 chips (Chat / Terminal /
    Preview / Editor) に統合
  - **複数 Editor pane 並列**: 各 Slot の Editor は **独立した tab セット**
  - **タブ操作**: クリック切替 / × 閉じる / 中クリック閉じる / drag 並び替え /
    別 Slot Editor へ drag 移動 / 右クリック (保存・他閉じる)

- **設計**:
  1. **SlotContent.editor.refId のセマンティクス変更**: `fileId` → `editorPaneId`
     (editor.ts の `editorPanes[paneId]` の key)
  2. **editor.ts の既存 pane API を再利用**: `addEditorPane()` / `removeEditorPane()` /
     `openFile(path, paneId)` / `closeFile(id, paneId)` / `setActiveFile(id, paneId)`
     はすでに存在 (PM-924)。新規追加は `reorderEditorTabs(paneId, from, to)` /
     `moveEditorTabToPane(fromPaneId, fileId, toPaneId, targetIndex?)` のみ
  3. **新 Component**: `components/editor/EditorTabPane.tsx`
     - paneId を受け、その pane の openFileIds を購読してタブバー描画
     - active tab に応じて FileViewer / MarkdownEditorArea を切替
     - 同 pane 内 drag 並び替え + cross-pane drag 移動を内蔵 (dnd-kit/sortable)
  4. **SlotContainer.handleDrop**: ファイル D&D 受領
     - Slot に既存 Editor → `openFile(path, refId)` で tab に追加
     - Slot に Editor 不在 → `addEditorPane()` で新 paneId 採番 → openFile + setSlot
  5. **SlotContainer.handleClear**: Slot を空にする時 `removeEditorPane(refId)` で
     editor pane も掃除 (孤立 pane 残留を防ぐ)
  6. **TrayBar の Editor 固定 chip**: refId=null。drop 時 WorkspaceView.handleDragEnd
     が `addEditorPane()` を呼んで新 paneId を採番 + slot bind
  7. **Migration (v3 → v4)**: 旧 fileId-based editor slot は復元不可能なため null 化
     (`clearLegacyEditorSlots`)。ユーザーは再ドラッグで復元

- **却下した代替案**:
  - **新規 editor-panes store 新設**: 既に editor.ts が pane 概念を持っているため
    重複となる。再利用が筋
  - **B 案 (file 単位 chip 残す + 空 chip 追加)**: UI が散らかる、A 案で運用上の
    複雑性も低いと判断 (オーナーも A 案を選択)
  - **タブ操作の段階リリース**: drag 並び替え / cross-pane 移動を Phase 2 にする案も
    あったが、規模が手の届く範囲で、一発投入で UX 完成度が高い

- **影響範囲**:
  - `components/editor/EditorTabPane.tsx` (新規)
  - `components/workspace/SlotContainer.tsx` (handleDrop / handleClear /
    SlotContentRenderer / EditorSlotLabel 改修, SlotEditorRenderer 廃止)
  - `components/workspace/TrayBar.tsx` (editorItems / EditorChipGroup / EditorChip /
    EditorDeleteButton 廃止, 固定 Editor chip 1 個追加)
  - `components/workspace/WorkspaceView.tsx` (editor lazy spawn 経路追加)
  - `lib/stores/editor.ts` (`reorderEditorTabs` / `moveEditorTabToPane` 追加)
  - `lib/stores/workspace-layout.ts` (persist version 4 + clearLegacyEditorSlots)
  - **注意**: 既存の persist データ (Slot に置いた editor) は v3 → v4 で破棄される

- **関連**: PM-924 (editor 多 pane)、DEC-049/050/055 (Workspace D&D)、
  PM-982 (TrayBar)、オーナー指示 2026-04-28

---

## DEC-074: auto-compact 通知の実装 + manual `/compact` は据え置き（**新設 2026-04-29**）

- **意思決定者**: CEO（オーナー指示「auto-compact 通知のみ実装、manual compaction は SDK 提供されていれば実装」）
- **対象バージョン**: v1.34.0
- **背景**:
  - オーナーから「Sumi は auto compact 動くのか / ctx 表示は Cursor の `/context` と一致しているか」の質問
  - 調査結果（CEO 報告 2026-04-29）:
    - Sumi の `/compact` は frontend で intercept され toast「対応予定」表示、SDK 経由実行は未実装
    - "ctx" 表示は API レスポンスの `usage.input_tokens + cache_read + cache_create` (実効入力)、Cursor `/context` は CLI 内部 estimator (system + tools + history + memory の見積)。意味が異なるため数値も一致しない（両者とも正しい）
  - 公式 SDK docs (https://platform.claude.com/docs/en/agent-sdk/typescript, compact-2026-01-12 beta) で確認:
    - **`SDKCompactBoundaryMessage`** が実装されている: `{ type: "system", subtype: "compact_boundary", compact_metadata: { trigger: "manual" | "auto", pre_tokens } }`
    - **PreCompact hook** event も提供されているが、ここでは消費側（通知）に絞る
    - **manual compaction を SDK consumer 側から起動する primitive は未提供** (SDK 経由で `/compact` を強制起動する手段は無し)

- **判断**:
  - **A 案 (ラベル明確化)**: 不要 (オーナー判断: ctx の意味は理解済)
  - **B 案 (manual compaction 実装)**: SDK 提供されている primitive が無いため**対応不要** (オーナー条件付け通り)
  - **C 案 (auto-compact 通知)**: SDK message stream の `compact_boundary` を捕捉して toast 通知する。**実装する**

- **実装**:
  1. `sidecar/src/index.ts`:
     - `OutboundType` に `"compact_boundary"` 追加
     - SDK message handler の `case "system":` 内で `subtype === "compact_boundary"` を検知し、`{ trigger, preTokens }` を frontend に forward
  2. `hooks/useAllProjectsSidecarListener.ts`:
     - `SidecarEvent.type` 共用体に `"compact_boundary"` を追加
     - 受領時に `toast.message` で「Claude が会話履歴を自動で要約しました (要約前 NNk tokens)」を 6 秒表示
     - active project のときだけ表示 (背景 project の通知でユーザを混乱させない)
     - `humanizeTokensShort` ヘルパで token 数を `124k` 形式に短縮
  3. version bump 1.33.1 → 1.34.0

- **設計判断**:
  - **`PreCompact` hook は使わない**: Sumi は consumer なので「要約完了の事後通知」のみで充分。事前 hook は将来の compaction policy カスタマイズで使う想定（DEC-075 候補）
  - **toast duration 6 秒**: 短すぎると見逃す、長すぎると邪魔。会話継続中に控えめに残す
  - **manual / auto を文言で出し分け**: manual は将来 `/compact` 実装時にも同 path を通る前提 (SDK 仕様準拠)
  - **active project のみ通知**: 並行起動中の他 project で auto-compact が走っても toast が増えると UI が騒がしくなるため

- **影響範囲**:
  - sidecar/src/index.ts (system handler 拡張 + OutboundType 追加)
  - hooks/useAllProjectsSidecarListener.ts (compact_boundary handler 追加)
  - 旧挙動への影響なし (system event の他 subtype は従来通り raw forward)

- **関連**: 公式 SDK docs (compact-2026-01-12 beta)、オーナー指示 2026-04-29、
  PM-830 (sdk_session_ready の同 system handler), 対応保留中の `/compact` 手動 (lib/builtin-slash.ts)

---

## DEC-075: チャットスクロール改善 — 回答先頭オートスクロール + 直前質問ジャンプ FAB（**新設 2026-04-30**）

- **意思決定者**: CEO（オーナー指示「Claude 回答完了時に最下部ではなく回答先頭にスクロール / 直前の質問にジャンプするボタン追加」）
- **対象バージョン**: v1.35.0
- **背景**:
  - 現行 (v1.34.0) の `MessageList.tsx` は `messages` / `streaming` 変化のたびに `scrollTo({ top: scrollHeight })` で最下部追従しており、Claude の応答完了後にユーザーが手動で回答先頭まで戻す操作が毎ターン必要だった
  - 過去ターンを遡って読み返す導線が無く、検索パレット (`Ctrl+F`) を経由しない簡易ジャンプが要望

- **判断**:
  - **要望 1 (回答先頭オートスクロール)**: 実装する。最後の assistant message の `streaming: true→false` エッジで `scrollIntoView({ block: "start" })` を発火
  - **要望 2 (直前質問ジャンプ FAB)**: 実装する。右下 FAB から `data-msg-id` 走査でビューポート上端より上の最直近 user message へジャンプ（連続クリックで N 個前へ）
  - **必須 UX ガード**: ユーザーが手動で上スクロール中（`scrollHeight - scrollTop - clientHeight > 80px`）はオートスクロール介入しない
  - **新 turn 検知ガードリセット**: 新規 assistant ID を検知した瞬間に上スクロールガードを `false` にリセット（M-1 対応、レビュー指摘）

- **実装**:
  1. `components/chat/MessageList.tsx`:
     - `userScrolledUpRef` + scroll listener 追加（80px 閾値）
     - 既存末尾追従 effect にユーザー上スクロールガード追加
     - 「streaming → 完了」エッジ検知 effect 追加（最後 assistant message 先頭へ smooth scrollIntoView、検索ジャンプ中・短文応答時は no-op）
     - 新 assistant ID 検知時の `userScrolledUpRef.current = false` リセット（M-1）
     - 右下 FAB（`lucide-react` の `ArrowUp`、aria-label 日本語、最先頭で disabled）
  2. `tests/e2e/scroll-improvement.spec.ts` 新規追加（オートスクロール / FAB 挙動の 2 ケース）
  3. version bump 1.34.0 → 1.35.0

- **設計判断**:
  - **アイコンは lucide-react**: アプリ内 78 ファイルで lucide 統一、Heroicons 使用 0 件のためプロジェクト一貫性を優先（オーナー方針 Heroicons はサブプロジェクト整合の観点で踏襲せず、必要なら全体刷新を別タスク化）
  - **smooth scroll**: `behavior: "smooth"`。`prefers-reduced-motion` 対応は v1.36.0 へ繰越（レビュー Minor N-1）
  - **ガード閾値 80px**: 短すぎると勢いスクロールで誤判定、長すぎると介入過多。Cursor / VSCode の chat 系の体感に合わせて 80px
  - **FAB はビューポート相対計算**: state を持たず、毎クリックで現在のスクロール位置から見た「上方向の最直近 user message」を再計算。連続クリックで自然に N 個前へ遡れる
  - **persist schema / store action 変更なし**: `MessageList.tsx` 1 ファイルに集約、複数 pane scope は既存 `scrollRef` パターン踏襲

- **影響範囲**:
  - `components/chat/MessageList.tsx`（実装本体）
  - `tests/e2e/scroll-improvement.spec.ts`（新規 E2E）
  - 旧挙動への影響: streaming 中の最下部追従は維持、検索ジャンプ・新規メッセージ通知は無干渉

- **品質ゲート**:
  - typecheck: PASS
  - lint: 新規警告なし
  - E2E (scroll-improvement.spec / chat.spec): 3/3 PASS
  - レビュー判定: CONDITIONAL APPROVE → M-1 修正後 APPROVE 相当
  - Minor 4 件 (N-1 prefers-reduced-motion / N-2 ResizeObserver / N-3 filter コスト / N-4 listener 統合) は v1.36.0 へ繰越

- **関連**: オーナー指示 2026-04-30、`reports/dev_scroll_improvement_proposal.md`, `reports/dev_scroll_improvement_done.md`, `reports/review_scroll_improvement.md`

---

## DEC-076: チャット入力欄リデザイン — Floating 停止ピル + textarea 内蔵 send + 開閉 handle bar（**新設 2026-04-30**）

- **意思決定者**: CEO（オーナー指示「停止ボタンが大きく入力欄が圧迫されている / 入力欄を開閉できるように / 底部の冗長ヒント削除 / おしゃれな設計でチャット画面と入力欄の双方を確保」）
- **対象バージョン**: v1.36.0
- **背景**:
  - v1.35.0 時点の `InputArea.tsx` は streaming 中、textarea の右に「停止」「停止して送信」のラベル付き矩形ボタン 2 個が `shrink-0` で並び、textarea 幅を著しく圧迫
  - 底部に「応答中: Ctrl+. または右下の停止ボタンで停止 / そのまま送信すると停止して新しい turn になります」の冗長な静的ヒントが常時表示（既に placeholder + ActivityIndicator + 停止ボタンで同等情報が出る）
  - 入力欄の collapse/expand 機構が store にも UI にも不在。チャット領域を最大化したい場面で対処不能

- **判断**:
  - 提案 3 案（A: アイコン集約 / B: ステータスバー化 / C: floating 停止ピル）を比較し、**案 C + 案 A ハイブリッド** を採択
  - streaming 中の停止ボタンは `MessageList` と `InputArea` の境界に丸ピル形 floating（Claude.ai 風）として配置し、`InputArea` から完全排除
  - textarea 右下角に `<Send />` icon-only ボタンを内蔵
  - 開閉は `InputArea` 上端の handle bar (`h-1.5 hover:h-2 w-12 rounded-full`) クリック + `Ctrl+Shift+I`、collapsed 時は `h-9` の 1 行プレビュー（`<ChevronUp />` + 「メッセージを入力 (クリックで展開)」）
  - 底部冗長ヒント文は削除
  - cleanup の単一 source-of-truth: pane 削除時の `inputCollapsedByPane` cleanup は `chat.ts` の `removePane` action に集約（M-1 対応、レビュー指摘）

- **実装**:
  1. `components/chat/StreamingFloatingStopButton.tsx`（新規）: streaming === true のみ render、`absolute -top-12 right-4 z-10`、`rounded-full bg-background/95 backdrop-blur shadow-lg border-border/80`、Square icon + 「停止」 + `Ctrl+.` kbd、framer-motion fade-in（`useReducedMotion` 尊重）
  2. `components/chat/InputArea.tsx`: 旧矩形 2 ボタン削除、textarea を `rounded-xl border bg-background shadow-sm` 基調に再構築、内蔵 send icon、handle bar、1 行プレビュー、底部ヒント削除、`focus-within:ring-2 ring-primary/50`
  3. `components/chat/ChatPanel.tsx`: `<StreamingFloatingStopButton />` を MessageList と InputArea の境界に挿入、MessageList 末尾 `pb-12` 余白
  4. `components/chat/ChatPaneHeader.tsx`: pane X ボタンの手動 cleanup 呼び出しを削除（cascade に統一）
  5. `components/chat/HelpDialog.tsx`: shortcuts 表に `Ctrl/Cmd + Shift + I` 追加、停止ボタン文言を「floating の停止ピル」に変更
  6. `components/providers/EscapeProvider.tsx`: `Ctrl+Shift+I` でアクティブ pane の collapse toggle 追加
  7. `lib/stores/workspace-layout.ts`: `inputCollapsedByPane: Record<paneId, boolean>` + `setInputCollapsed` / `cleanupInputCollapsed` action、persist version 4 → 5
  8. `lib/stores/chat.ts`: `removePane` action 内に dynamic import で `cleanupInputCollapsed(paneId)` を fire-and-forget cascade（M-1 対応、循環依存回避は既存 `recomputeProjectStatus` パターン踏襲）
  9. `tests/e2e/input-area-redesign.spec.ts`（新規）: floating ピル表示&interrupt / handle bar collapse&expand / `Ctrl+Shift+I` toggle の 3 ケース
  10. version bump 1.35.0 → 1.36.0

- **設計判断**:
  - **floating 停止のレイヤ**: MessageList の末尾 `pb-12` で最終メッセージを逃がし、z-index 衝突を回避
  - **停止文言は controlled tone**: `destructive` (赤) ではなく outline + Square icon で Claude.ai 風の落ち着いた印象
  - **collapsed 時の 1 行プレビュー方式**: 完全非表示より発見性が高く、`aria-expanded={false}` + Enter / Click で展開して textarea へ focus
  - **store の persist version up**: 既存ユーザーの localStorage は 4 → 5 で migration、初期値は全 pane false（展開状態）
  - **cleanup の単一 source-of-truth**: `removePane` 集約により Shell.tsx の viewMode dropdown 経由の pane 縮退でも自動 cleanup（M-1）
  - **`prefers-reduced-motion` 対応**: 全 framer-motion を `useReducedMotion()` で無効化（DEC-075 でも繰越となっていた項目を本リリースで解消）

- **影響範囲**:
  - 修正: `InputArea.tsx`, `ChatPanel.tsx`, `ChatPaneHeader.tsx`, `HelpDialog.tsx`, `EscapeProvider.tsx`, `workspace-layout.ts`, `chat.ts`, `CHANGELOG.md`, version 3 ファイル
  - 新規: `StreamingFloatingStopButton.tsx`, `tests/e2e/input-area-redesign.spec.ts`
  - 旧挙動への影響: streaming 中の interrupt API / send API 契約は維持、`Ctrl+.` / `Enter` / `Shift+Enter` 完全互換

- **品質ゲート**:
  - typecheck: PASS（実装後 + M-1 修正後とも）
  - lint: 新規警告なし
  - E2E: 新規 3/3 + 既存 22/22 = 25/25 PASS（M-1 修正後はポート競合により未実行、Release CI で再検証）
  - レビュー判定: CONDITIONAL APPROVE → M-1 修正後 APPROVE 相当
  - Minor 5 件（m-1 二重 ring / m-2 devtools 衝突可能性 / m-5 kbd aria-hidden 等）は v1.37.0 へ繰越

- **関連**: オーナー指示 2026-04-30、`reports/dev_input_area_redesign_proposal.md`, `reports/dev_input_area_redesign_done.md`, `reports/review_input_area_redesign.md`

---

## DEC-077: チャット UI 残課題 cleanup batch — Minor 8 件一括解消（**新設 2026-04-30**）

- **意思決定者**: CEO（オーナー指示「残課題の対応も実施してください」）
- **対象バージョン**: v1.37.0
- **背景**:
  - DEC-075 (v1.35.0) のレビューで Minor N-2/N-3/N-4 が v1.36.0 へ繰越（N-1 は v1.36.0 で解消済）
  - DEC-076 (v1.36.0) のレビューで Minor m-1〜m-5 が繰越、加えて任意フォロー (collapsed 時の attachment 件数バッジ) も保留
  - 機能的影響は無いが、累積するとコード品質・パフォーマンス・アクセシビリティ・将来の拡張容易性で負債化するため一括解消

- **判断**:
  - 9 件中 **8 件を v1.37.0 で一括解消**（cleanup batch）
  - **m-2 (Tauri devtools `Ctrl+Shift+I` 衝突確認)** は release build + 実機検証が必要なため、本 release で解消対象外。CHANGELOG Notes に明記し、v1.37.0 配布後の dogfood で確認

- **実装**（DEC-076 / DEC-075 別）:

  ### A. DEC-076 繰越（4 件 + 任意フォロー 1 件）
  1. **m-1 focus ring 二重描画整理** (`InputArea.tsx`):
     - wrapper の `focus-within:ring-2` を `has-[textarea:focus]:ring-2` に変更
     - Send button focus 時は親 ring を抑え、textarea focus 時のみ親 ring を表示
  2. **m-3 `pb-12` 依存のコメント明記** (`StreamingFloatingStopButton.tsx` 冒頭):
     - 「ChatPanel.tsx の MessageList wrapper 末尾 `pb-12` に依存。`pb-12` を縮める変更があった場合は本コンポーネントの位置も再検討」を明記
  3. **m-5 floating ピル `<kbd>` の `aria-hidden`** (`StreamingFloatingStopButton.tsx`):
     - aria-label が「応答を停止 (Ctrl+.)」を含むため、子の `<kbd>` を `aria-hidden="true"` で視覚装飾扱い
     - スクリーンリーダーで Ctrl+. の二重読み上げを抑止
  4. **任意: collapsed preview に attachment 件数バッジ** (`InputArea.tsx`):
     - collapsed 状態かつ attachment.length > 0 のみ render
     - `<Paperclip />` icon (lucide) + 数字、aria-label="添付ファイル N 件"

  ### B. DEC-075 繰越（3 件）
  1. **N-2 ResizeObserver で pane リサイズ追従** (`MessageList.tsx`):
     - scrollRef + 親要素を ResizeObserver で監視、リサイズ時に再計算 effect
     - cleanup で `disconnect()` 確実実行
  2. **N-3 user message id Set の useMemo 化** (`MessageList.tsx`):
     - 旧: scroll ごとに `messages.filter(m => m.role === 'user')` 走査 → O(n)
     - 新: `useMemo` で user message ID `Set` を messages 変化時のみ再計算、scroll handler 内は `Set.has()` で O(1) lookup
  3. **N-4 scroll listener の 1 つに統合 + RAF coalesce** (`MessageList.tsx`):
     - 旧: ユーザー上スクロール検知 listener と FAB 表示判定 listener が分散
     - 新: 1 つの handler に統合、`requestAnimationFrame` で coalesce、`passive: true` 維持、cleanup で `cancelAnimationFrame` 確実実行

  ### C. E2E 追加（必須 1 件）
  - `tests/e2e/input-area-redesign.spec.ts` ケース 4 追加:
    - collapsed 状態で `Ctrl+Enter` を押下しても `send_agent_prompt` が呼ばれないこと、textarea が DOM 上不在であることを assert

  ### D. version bump
  - `package.json` / `src-tauri/Cargo.toml` / `src-tauri/tauri.conf.json`: 1.36.0 → 1.37.0
  - `CHANGELOG.md` に `## [v1.37.0] - 2026-04-30` セクション (Changed/Fixed/A11y/Performance/Notes 構成)

- **設計判断**:
  - **m-2 を本 release から除外**: 動作検証に release build + 実機 (Windows/macOS/Linux) が必要で、ローカル `npm run typecheck` だけでは保証できない。配布物 (Tauri bundle) を作って owner が手動確認する性質のため、独立 task として追跡
  - **N-3 は `Set` 化を採用**: indexOf-style の O(log n) でも改善するが、`Set.has()` の O(1) lookup の方が実装上シンプルで読みやすい
  - **`has-[textarea:focus]:`**: Tailwind v3.4.0+ で `:has()` セレクタ対応済 (本アプリは v3.4.17)、shadcn 生成 CSS と互換
  - **ResizeObserver の throttle 不要**: pane リサイズ操作はユーザー手動の drag 程度なので RO のネイティブ throttle で十分、追加 throttle で複雑化させない

- **影響範囲**:
  - 修正: `InputArea.tsx`, `MessageList.tsx`, `StreamingFloatingStopButton.tsx`, `tests/e2e/input-area-redesign.spec.ts`, `CHANGELOG.md`, version 3 ファイル
  - 既存 25 ケース (`chat.spec` / `scroll-improvement` / `input-area-redesign` 1〜3) regression なし（dev は同 beforeEach 流用と説明、CI で fresh runner にて再検証）
  - 旧挙動への影響: streaming / send / interrupt / attachment / scroll 全経路で互換性維持

- **品質ゲート**:
  - typecheck: PASS
  - lint: 新規警告なし
  - E2E: ローカルポート競合により未実行（既知環境問題、Release CI で再検証）
  - レビュー判定: **APPROVE**（Critical 0 / Major 0 / Minor 4 件は v1.38.0 候補）

- **v1.38.0 候補（本 DEC-077 のレビュー指摘）**:
  - m-2 (Tauri devtools `Ctrl+Shift+I` 衝突) の release build 実機検証 → 必要なら binding 変更
  - 1000+ message 規模での IntersectionObserver 化（現状の `Set.has()` lookup は十分高速）
  - attachment バッジの将来クリック削除対応
  - scrollRef の empty state ↔ list state 切替時の effect 依存改善
  - m-2 release build dogfood 手順のドキュメント化

- **関連**: オーナー指示 2026-04-30、`reports/dev_v137_cleanup_done.md`, `reports/review_v137_cleanup.md`、DEC-075 / DEC-076 のレビューレポート

---

## DEC-078: キーバインド編集機能 — 中央 keymap registry + ユーザー override（**新設 2026-05-01**）

- **意思決定者**: CEO（オーナー指示「キーバインドを自分で編集できるようにしたい。実装方法を検討してください」）
- **対象バージョン**: Phase 1 = v1.38.0（本 DEC）、Phase 2 = v1.40.0 想定（後続 DEC）
- **背景**:
  - v1.37.0 時点でキーバインドは **完全 hardcode、7 経路に分散**（react-hotkeys-hook 4 / window.addEventListener 2 / xterm.js 1）。中央定義ファイル不在
  - `KeybindingsSettings.tsx` は 82 行の読み取り専用テーブル（5 binding 列挙のみ）、内部に「カスタム編集は M3 PM-171 の DEC 決定後に実装予定」コメント → **本 DEC タイミング**
  - 実動 binding は ~20 件、UI 露出は 5 件のみ（terminal 系 7 件などが UI から漏れている）
  - HelpDialog / KeybindingsSettings / 実 binding の 3 重 hardcode で保守負荷が累積

- **判断**:
  - 提案 3 案（A: 軽量・最小 / B: VSCode 直系 command 中心 / C: Hybrid 中央 registry + override）を比較し、**案 C ハイブリッド** を採択
  - **理由**: 案 B (~20 binding に command id 抽象化は overkill / when 句 evaluator が伏兵)、案 A (terminal 編集不可で Cursor 移行ユーザー失望、長期負債化)
  - スコープは **Standard (Phase 1+2)** を採択、段階リリース戦略
    - Phase 1 (v1.38.0): 中央 registry + global 8 binding 編集対応、UI 全面書換、HelpDialog 駆動化
    - Phase 2 (v1.40.0 想定): chatInput + terminal context、xterm.js `attachCustomKeyEventHandler` の registry 経由化、conflict 検出 UI 強化、context フィルタ UI

- **Phase 1 実装（v1.38.0）**:
  1. **中央 registry コア** (`lib/keymap/`):
     - `types.ts`: `KeyContext = "global" | "chatInput" | "terminal" | "editor"`、`KeyBindingDefinition`
     - `bindings.ts`: 8 binding を集中定義（`<category>.<verb>` の dot 区切り命名規約）
     - `match.ts`: accel 文字列パース、`Mod` プレースホルダ → OS 解決（Mac=Cmd / Win/Linux=Ctrl）、KeyboardEvent 照合
     - `store.ts`: Zustand persist (`sumi:keybindings` v1)、`safeStorage` + migration boilerplate を `settings.ts` から完コピ
     - `hooks.ts`: `useBoundCallback(bindingId, callback, options?)`
     - `conflicts.ts`: 同 context 内の重複 accel 検出
  2. **登録 binding 8 件**:
     - `chat.stopGeneration` (Mod+.) / `chat.toggleInputCollapse` (Mod+Shift+I)
     - `chat.send` (Mod+Enter) / `chat.pasteImage` (Mod+V)
     - `palette.command` (Mod+K) / `palette.file` (Mod+P) / `palette.search` (Mod+Shift+F)
     - `app.openHelp` (null = override 用 placeholder)
  3. **UI 全面書換**:
     - `KeybindingsSettings.tsx`: registry から表 render、編集 / リセット / unbind ボタン、conflict warning icon、「すべてリセット」
     - `KeyRecorder.tsx` (新規 Dialog): リアルタイム kbd 表示、modifier-only 拒否、Esc キャンセル、Tab 受容、衝突 warning
  4. **既存 5 経路置換**: `EscapeProvider` / `CommandPalette` / `FilePalette` / `SearchPalette` を `useBoundCallback` 経由に
     - `react-hotkeys-hook` は依存維持（Phase 3 で削除検討）
     - `ImagePasteZone.tsx` の paste 経路は browser default と共存させるため Phase 1 では registry 化対象外（理由を bindings.ts コメント / 完了レポート / ナレッジで三重明記）
  5. **HelpDialog の registry 駆動化**: 約 15 件のハードコード shortcut 表を registry 1 ソースから生成、terminal 系 7 件は hardcode 維持で Phase 2 引き継ぎを明示
  6. **テスト**: vitest 41 ケース PASS（match 19 / store 11 / conflicts 11）、E2E 2 ケース新規（CI で再検証想定、ローカルは port 3000 占有で見送り）
  7. **ナレッジ**: `organization/knowledge/keybinding-architecture.md` に id 命名規約 / 新規 binding 追加手順 / context 分類境界 / Phase 2 引き継ぎ事項を整理
  8. version bump 1.37.0 → 1.38.0、vitest 依存と `npm run test` / `test:watch` script 追加

- **設計判断**:
  - **id 命名規約**: `<category>.<verb>` dot 区切り（例: `chat.send` / `palette.command` / `app.openHelp`）。Phase 2/3 でも統一
  - **`Mod` 抽象化**: accel 文字列で `Mod` を使い、`match.ts` 内で OS 判定。UI 側は accel 文字列を渡すだけ
  - **persist version 1 から開始**: 旧 key 不在のため migration 不要、初回 release で固定
  - **未割当 (null) 許容**: `app.openHelp` のように既定 null のものを置く設計、override で null 化 (= unbind) も可能
  - **registry 単一ソース**: HelpDialog / KeybindingsSettings / 実 binding の 3 重 hardcode を解消（副次効果）

- **影響範囲**:
  - 新規: `lib/keymap/{types,bindings,match,store,hooks,conflicts}.ts`, `KeyRecorder.tsx`, `lib/keymap/{match,store,conflicts}.test.ts`, `tests/e2e/keybinding-editor.spec.ts`, `vitest.config.ts`
  - 修正: `KeybindingsSettings.tsx`, `HelpDialog.tsx`, `EscapeProvider.tsx`, `CommandPalette.tsx`, `FilePalette.tsx`, `SearchPalette.tsx`, `app/settings/page.tsx`, `package.json`, `package-lock.json`, `Cargo.toml`, `tauri.conf.json`, `CHANGELOG.md`
  - ナレッジ: `organization/knowledge/keybinding-architecture.md`
  - Phase 1 範囲外（Phase 2 引き継ぎ）: terminal の `attachCustomKeyEventHandler`, `InputArea.tsx` の chatInput context, editor pane

- **品質ゲート**:
  - typecheck: PASS
  - lint: 新規警告ゼロ（既存 32 件 warning は本タスク無関係）
  - vitest: 41/41 PASS
  - E2E: ローカル port 競合により未実行（Release CI で再検証）
  - レビュー判定: **APPROVE**（Critical 0 / Major 0 / Minor 6 件、いずれも release blocker でなく Phase 2 候補）

- **Phase 2 候補（DEC-078 のレビュー指摘 + 提案書から）**:
  - chatInput / terminal context への拡張（terminal binding ~7 件、`attachCustomKeyEventHandler` の registry 経由化）
  - `useBoundCallback` の context options 設計（focused element / scope ref）
  - Mac の Cmd+Ctrl 同時押下の取扱
  - 同 accel + 異 context 同時 active 時の listener 優先順ルール
  - inline callback の `useCallback` memoize で listener 再 bind を抑止（M-1）
  - `match.ts` の不正入力 test 追加（`Mod++` 等、M-3）
  - `chat.pasteImage` の「ブラウザ管轄」UI hint（M-4）
  - `normalizeEventKey` cosmetic 整理（M-5）
  - `app.openHelp` を実際の HelpDialog 起動経路に接続（現状は override placeholder のみ）

- **Phase 3 候補（v2.0 級）**:
  - custom binding 追加、Import / Export JSON、when 句 DSL、Tauri `plugin-store` 移行、`react-hotkeys-hook` 依存削除

- **関連**: オーナー指示 2026-05-01、`reports/dev_keybinding_editor_proposal.md`, `reports/dev_v138_keymap_phase1_done.md`, `reports/review_v138_keymap_phase1.md`, `organization/knowledge/keybinding-architecture.md`

---

## DEC-079: キーバインド編集 Phase 2 — chatInput / terminal context 拡張、conflict 強化、Minor 6 件吸収（**新設 2026-05-01**）

- **意思決定者**: CEO（オーナー指示「Phase 2 (v1.40.0) を進めてください」）
- **対象バージョン**: v1.40.0（v1.39.0 は意図的に skip、Phase 2 完成版として一括 release）
- **背景**:
  - DEC-078 Phase 1 (v1.38.0) で global context の 8 binding 編集を実現
  - DEC-078 のレビューで Phase 2 候補として 6 件 Minor + 主要拡張項目が整理済
  - オーナーは Cursor 移行ユーザーで、terminal binding (Ctrl+Shift+F 等) の編集要求が高い

- **判断**:
  - Phase 2 を v1.40.0 で完成版として一括 release（中間 v1.39.0 を skip）
  - 16 binding 化（global 8 + chatInput 1 + terminal 7）で Cursor 同等の編集体験を完成
  - DEC-078 Minor 6 件すべてを本 release で吸収
  - context フィルタ UI と conflict 検出の severity / cross-context 拡張を実装

- **実装**（v1.40.0）:

  ### 1. context 拡張: chatInput
  - `lib/keymap/bindings.ts` に `chatInput.send` (Mod+Enter) を追加
  - **設計判断**: `useBoundCallback` の ref scope ではなく **selector + onKeyDown 方式** を採用
    - 理由: `useBoundCallback` の ref scope と React onKeyDown の二重発火が IME composition を破壊するリスクを回避
  - `data-chat-input` marker を component 側に付与、`closest()` 二段で context active 判定（DOM 階層非依存）
  - `compositionstart` / `compositionend` / `event.isComposing` の取扱を維持、IME 入力中の誤発火を防止
  - Shift+Enter は textarea native の改行動作で十分のため registry 化対象外

  ### 2. context 拡張: terminal (7 binding)
  - `lib/keymap/bindings.ts` に terminal binding を追加:
    - `terminal.copy` (Ctrl+Shift+C)
    - `terminal.paste` (Ctrl+Shift+V)
    - `terminal.find` (Ctrl+Shift+F)
    - `terminal.newTerminal` / `terminal.closeTerminal` / `terminal.clear` / `terminal.reset` 等（実コードから抽出）
  - **設計判断**: xterm.js の `attachCustomKeyEventHandler` は同期 boolean 戻り値仕様のため React hook 不可 → vanilla helper `findMatchingBinding(event, "terminal")` で同期 dispatch
  - `preventDefault + stopPropagation + return false` で xterm.js 文字入力 + window listener 伝播の両方を抑止
  - `data-terminal-pane` marker で focus 判定、OS native の copy/paste は破壊しない

  ### 3. `useBoundCallback` の context-aware scope
  - options に `scope: "global" | "contextOnly" | { ref: RefObject<HTMLElement> }` を追加
  - registry の context が non-global なら自動で context active 時のみ発火する仕組み
  - 既存 8 global binding (Phase 1) の挙動は変更なし、StrictMode 二重発火耐性 / cleanup 確実

  ### 4. conflict 検出強化
  - `conflicts.ts` の戻り値型を拡張: `{ accel, ids, severity: "error" | "warning", contexts: KeyContext[] }`
  - **severity ルール**:
    - `error`: 同 context 内重複
    - `warning`: cross-context (global vs other-context)
    - 異なる non-global context 同士 (chatInput vs terminal) は **衝突報告しない**（互いに独立）
  - KeybindingsSettings の表に severity 別 icon: `error` = 赤 `<AlertCircle />` / `warning` = 黄 `<AlertTriangle />`
  - tooltip 内容を「`<accel>` は他に <other-binding-name> でも使われています」と詳細化

  ### 5. context フィルタ UI
  - `KeybindingsSettings.tsx` に shadcn `Tabs` で「すべて / Global / ChatIn / Terminal / Editor」フィルタ
  - editor は placeholder（v1.40 範囲外、Phase 3+ 用）
  - empty state: 「該当 context に登録された binding はまだありません」

  ### 6. DEC-078 レビュー Minor 6 件の吸収
  - **M-1**: CommandPalette / FilePalette / SearchPalette / EscapeProvider / InputArea で `useCallback` memoize → listener 再 bind 抑止
  - **M-3**: `match.ts` 不正入力 test +7 ケース（`Mod++` / 空文字 / 末尾 `+` / 連続 `+` / 不明 modifier / 大文字小文字混在 / `'plus' alias` pin）
  - **M-4**: `chat.pasteImage` 行に info icon + tooltip で「ブラウザ管轄」hint。registry binding 定義に汎用 `note?: string` field を追加
  - **M-5**: `normalizeEventKey` cosmetic 整理、JSDoc 追加（動作変更なし）
  - **`app.openHelp` 起動経路接続**: HelpDialog open に bind、既定 accel `Mod+/`
    - 選択理由: VSCode の F1 は webview で OS hotkey と紛らわしい / `/` 単独は textarea 入力に紛れる / 修飾必須の `Mod+/` が安全
  - **Mac の Cmd+Ctrl 同時押下 / context 越え listener 優先順**:
    - match.ts: Mac で Cmd と Ctrl を別 modifier として正しく区別、test 追加で fix
    - 同 accel が global + 別 context にある場合、**より specific な context を優先**するルール
    - hooks.ts のディスパッチで focus 状態を判定し優先順を実現

  ### 7. テスト
  - vitest **66/66 PASS** (Phase 1 41 + Phase 2 +25)
    - 新規: `context.test.ts` 8 / `hooks.test.ts` 6
    - 拡張: `match.test.ts` +7 (M-3) / `conflicts.test.ts` +3 (severity / cross-context) / `store.test.ts` +1 (`app.openHelp` default 変更)
  - E2E `keybinding-editor.spec.ts` に context フィルタ動作の 1 ケース追加
  - ローカル E2E は port 3000 競合で未実行（既知）、CI で 29 ケース再検証想定

  ### 8. ドキュメント
  - `CHANGELOG.md` に `## [v1.40.0] - 2026-05-01` セクション (Added/Changed/Fixed/Notes、v1.39.0 skip 理由を Notes に明記)
  - ナレッジ `organization/knowledge/keybinding-architecture.md` 更新:
    - Phase 2 完了状態
    - focus marker 規約 (`data-chat-input` / `data-terminal-pane`)
    - conflict resolution rule（global vs context-specific の優先順）
    - 新規 binding 追加時の context 判定基準

  ### 9. version bump 1.38.0 → 1.40.0

- **影響範囲**:
  - 修正: `bindings.ts`, `hooks.ts`, `conflicts.ts`, `match.ts`, `types.ts`, `InputArea.tsx`, `TerminalPane.tsx`, `KeybindingsSettings.tsx`, `HelpDialog.tsx`, `EscapeProvider.tsx`, palette 3 件, version 3 ファイル, `CHANGELOG.md`
  - 新規: `lib/keymap/context.ts` + `context.test.ts` + `hooks.test.ts`
  - persist version 1 維持で v1.38.0 ユーザー override の backward compatible 確認済

- **品質ゲート**:
  - typecheck: PASS
  - lint: 新規警告なし
  - vitest: 66/66 PASS
  - E2E: ローカル port 競合で未実行、Release CI で再検証
  - レビュー判定: **APPROVE 無条件**（Critical 0 / Major 0 / Minor 5 件はすべて Phase 3 候補）

- **Phase 3 候補（DEC-079 レビュー指摘 Minor 5 件 + 提案書から）**:
  - **M-Phase2-A**: `useBoundCallback` の `scope: "global"` 命名と auto-context-aware 挙動の乖離 → `scope: "auto"` 等へ rename 検討
  - **M-Phase2-B**: ref scope の `refTarget?.current` が useEffect 内 1 回しか解決されない（現実装は未利用のため実害なし）
  - **M-Phase2-C**: context フィルタ状態の永続化（任意）
  - **M-Phase2-D**: EscapeProvider の rename（v2 で破壊的変更）
  - **M-Phase2-E**: `terminal.reset` の `dispatchTerminalAction` noop 統合（`term.reset()` 直接呼出推奨）
  - その他（提案書から）: custom binding 追加、Import / Export JSON、when 句 DSL、Tauri `plugin-store` 移行、`react-hotkeys-hook` 依存削除

- **関連**: オーナー指示 2026-05-01、`reports/dev_v140_keymap_phase2_done.md`, `reports/review_v140_keymap_phase2.md`, `organization/knowledge/keybinding-architecture.md`、DEC-078 (Phase 1 / v1.38.0)

---

## DEC-080: キーバインド編集 Phase 3a — Import/Export JSON + Minor 4 件吸収（**新設 2026-05-01**）

- **意思決定者**: CEO（オーナー指示「Phase 3 を進めてください」）
- **対象バージョン**: v1.41.0
- **背景**:
  - DEC-078 / DEC-079 で Phase 1+2 が完成し 16 binding 編集が可能化
  - DEC-079 のレビューで Phase 3 候補として Minor 5 件 (M-Phase2-A〜E) と提案書由来の v2.0 級項目が整理済
  - 提案書 Phase 3 のうち、ユーザー価値高 + 後方互換 の項目を v1.41.0 (Phase 3a) で先行リリース、Breaking change を伴うものは v2.0.0 へ温存

- **判断**:
  - **v1.41.0 (Phase 3a) で実施**: Import/Export JSON 機能 + DEC-079 Minor 4 件 (M-Phase2-A / B / C / E) 吸収
  - **v2.0.0 へ温存**: M-Phase2-D (EscapeProvider rename / Shell.tsx import 破壊)、`react-hotkeys-hook` 依存削除、Tauri `plugin-store` 移行、when 句 DSL、custom binding 追加
  - 段階リリース戦略を継続: Phase 1 (v1.38.0) → Phase 2 (v1.40.0) → **Phase 3a (v1.41.0)** → 将来 Phase 3b (v2.0.0)

- **実装**（v1.41.0）:

  ### 1. Import / Export JSON（本リリースの目玉）
  - **新規 `lib/keymap/import-export.ts`** (純粋関数層、Tauri-free でテスタビリティ確保):
    - `buildExportPayload(overrides, appVersion)`
    - `stringifyExport(payload)`
    - `buildExportFilename(date)` → `sumi-keybindings-YYYY-MM-DD.json`
    - `parseImportPayload(jsonString)` → schema/version validate、不正なら throw
    - `applyImport(payload, mode)` → `"replace" | "merge"` 両対応、entry-level skip + warning
  - **スキーマ** (version 1):
    ```json
    {
      "schema": "sumi-keybindings",
      "version": 1,
      "exportedAt": "2026-05-01T...",
      "appVersion": "1.41.0",
      "overrides": { "chat.send": "Mod+Enter", ... }
    }
    ```
  - **validation ルール**:
    - top-level: `schema` / `version` mismatch で throw（safety）
    - entry-level: 不正 binding id (registry に無い) → skip + warning、不正 accel (`match.ts` のパース失敗) → skip
  - **UI 配置**: `KeybindingsSettings.tsx` のヘッダ右に Upload (Import) / Download (Export) ボタン、shadcn `Button variant="outline"` + lucide icon
  - **確認 Dialog**: shadcn `AlertDialog` で 3 ボタン (キャンセル / マージ / 上書き)
    - 上書き (replace): `resetAll()` してから import の overrides を適用
    - マージ (merge): 既存 override に追加・上書き、import に無い既存 override は維持
  - **Tauri 連携**: `@tauri-apps/plugin-dialog` / `@tauri-apps/plugin-fs` 使用、`window.__TAURI_INTERNALS__` 検出で web fallback (disabled + tooltip「Tauri 環境でのみ利用可能」)
  - 保存成功 / import 完了時に toast 通知（成功件数 / skip 件数）

  ### 2. DEC-079 Minor 4 件吸収

  #### M-Phase2-A: `useBoundCallback` の `scope` rename
  - `lib/keymap/types.ts` の `KeyScope` を `"auto" | "global" | "contextOnly" | { ref }` に拡張
  - **新名**: `"auto"`（registry の context が non-global なら自動で context active 時のみ発火、命名と挙動が一致）
  - **後方互換**: `"global"` を `@deprecated` alias として維持（v2.0.0 で削除予定とコメント）
  - 既存コード内の `scope: "global"` 利用箇所を `"auto"` に update
  - vitest `hooks.test.ts` に alias 互換性 test 追加

  #### M-Phase2-B: ref scope の動的解決 + rAF retry
  - 旧: `useEffect` 内 1 回しか `refTarget?.current` を解決しない → ref 後 attach で発火しない race
  - 新: listener 実行時に動的解決、初回 mount で解決失敗なら `requestAnimationFrame` で 1-frame retry
  - vitest で commit-then-attach race を pin する test 追加

  #### M-Phase2-C: context フィルタ状態の永続化
  - **新規 store `lib/keymap/ui-state.ts` (`useKeymapUiStore`)**:
    - persist key: `sumi:keymap-ui-state`（domain state の `sumi:keybindings` と分離）
    - 理由: UI state とドメイン state の責任分離、import/export の対象外にすることでクリーンな registry export を維持
    - state: `{ contextFilter: "all" | "global" | "chatInput" | "terminal" | "editor" }`
    - persist version 1 で初期化、将来の migration 用 boilerplate 完備
  - 起動時に最後に選択していた context が復元

  #### M-Phase2-E: `terminal.reset` の noop 統合
  - 旧: `dispatchTerminalAction` 内で `terminal.reset` は noop、Ctrl+Shift+L が container.addEventListener で別経路 hardcode
  - 新: `resetFnRef` を使って `term.reset()` 直接呼出に統一、container の hardcode listener を撤去
  - `terminal.clear` (Ctrl+Shift+L) は registry 経由で発火

  ### 3. テスト
  - vitest **92/92 PASS** (66 baseline + 26 new):
    - `import-export.test.ts` 22 ケース (schema/version validate / replace / merge / unknown id / invalid accel / null 受理 / 件数)
    - `ui-state.test.ts` 3 ケース (永続化動作)
    - `hooks.test.ts` +1 (alias 互換性)
  - E2E `keybinding-editor.spec.ts` に 2 ケース追加 (Import/Export disabled in browser、フィルタ永続化)
  - ローカル E2E は port 3000 競合で未実行（既知）、CI で 31 ケース再検証

  ### 4. ドキュメント
  - `CHANGELOG.md` に `## [v1.41.0] - 2026-05-01` セクション (Added/Changed/Fixed/Notes、v2.0.0 候補を Notes に明記)
  - ナレッジ `organization/knowledge/keybinding-architecture.md` 更新:
    - Import / Export JSON のスキーマ仕様
    - `scope: "auto"` rename の deprecation policy
    - フィルタ状態永続化の key (`sumi:keymap-ui-state`)
    - v2.0.0 候補のロードマップ

  ### 5. version bump 1.40.0 → 1.41.0

- **設計判断**:
  - **import-export を純粋関数層として分離**: Tauri 依存なしで vitest でテスト可能、KeybindingsSettings は I/O と toast のみ担当
  - **schema "sumi-keybindings" + version 1**: 将来スキーマが変わったら v2 を追加。今回は v1 で固定
  - **不正 binding id の skip**: registry 構造が変わっても古い export を適用したいニーズに対応
  - **UI state を別 store に**: domain state (`sumi:keybindings`) は import/export 対象、UI state は対象外、責任分離が明確
  - **`scope: "auto"` 命名**: VSCode の `when` 句と紛らわしくなく、自動判定であることが伝わる
  - **deprecation alias**: 即時 break ではなく v2.0.0 まで猶予を持たせる、外部利用者への配慮

- **影響範囲**:
  - 新規: `lib/keymap/import-export.ts` + test、`lib/keymap/ui-state.ts` + test
  - 修正: `lib/keymap/hooks.ts` + test、`lib/keymap/types.ts`、`KeybindingsSettings.tsx`、`TerminalPane.tsx`、`tests/e2e/keybinding-editor.spec.ts`、version 3 ファイル、`CHANGELOG.md`
  - persist schema: `sumi:keybindings` v1 維持（変更なし）→ v1.40.0 ユーザー override は完全互換
  - 新 store `sumi:keymap-ui-state` は初回起動でデフォルト初期化（フィルタ "all"）

- **品質ゲート**:
  - typecheck: PASS
  - lint: 新規警告なし
  - vitest: 92/92 PASS
  - E2E: ローカル port 競合で未実行、Release CI で再検証
  - レビュー判定: **APPROVE 無条件**（Critical 0 / Major 0 / Minor 9 件はすべて v2.0.0 候補もしくは UX チューニング）

- **v2.0.0 候補 (Phase 3b 以降、Breaking change を含む)**:
  - **M-Phase2-D**: EscapeProvider の rename（Shell.tsx の import 破壊のため v2 で実施）
  - **M-Phase2-A の deprecation 完了**: `scope: "global"` alias を削除
  - **`react-hotkeys-hook` 依存削除**: 残存利用箇所の確認 + 完全置換
  - **Tauri `plugin-store` 移行**: settings.ts と同タイミングで `safeStorage` から移行
  - **when 句 DSL**: 提案書では「overkill 気味」として保留、需要次第
  - **custom binding 追加**: slash command の trigger キー化等、ニッチユースケース次第
  - **DEC-080 のレビュー Minor 9 件**（UX チューニング）

- **関連**: オーナー指示 2026-05-01、`reports/dev_v141_keymap_phase3a_done.md`, `reports/review_v141_keymap_phase3a.md`、DEC-078 (Phase 1 / v1.38.0)、DEC-079 (Phase 2 / v1.40.0)

---

## DEC-081: Codex 統合 — 現時点での採用見送り（**新設 2026-05-01**）

- **意思決定者**: オーナー（CEO の調査・提案を踏まえた最終判断）
- **対象**: Sumi (PRJ-012) への OpenAI Codex CLI 統合
- **判断**: **現時点での Codex 統合は採用しない**

- **背景・経緯**:
  - オーナーが「Codex のサブスクプランも利用できるようにしたい」と要望（2026-05-01）
  - CEO が 2 段階で徹底調査を実施:
    1. 1 人目調査 (`reports/research_codex_integration_proposal.md`, 約 530 行): 案 A+C ハイブリッド + 3 段階リリース (v1.42.0 / v1.44.0 / v2.0.0) を推奨
    2. 第二の意見調査 (`reports/research_codex_risk_reassessment.md`, 約 600 行): Critical 級リスク 6 件 (うち 4 件は 1 人目漏れ) を発見、Phase 1 スコープ拡張 + Phase 0 半日 POC を強く推奨
  - 第二意見の Critical リスク主要項目:
    - C-α: Plus rate limit 到達時の silent fail (codex#5823 既知バグ)
    - C-β: 両側課金 + MCP 暴走 chain + API key fallback 自動課金暴走
    - C-γ: ChatGPT Plus default で training opt-in (クライアント案件コードが OpenAI の training data に流入リスク)
    - C-δ: クライアント案件 (PRJ-002 / 007) の engine 制限フラグ未実装
    - C-ε: Multi-Project × Multi-Engine の最悪 60 sidecar
    - C-ζ: secret leak via MCP (`.env` / `*key*.json` の OpenAI 流出)

- **見送り理由**（オーナー判断）:
  1. **これまでの Claude Code 単体運用の知見が活用しやすい**: Sumi は v1.34.0 (DEC-074) → v1.41.0 (DEC-080) と Claude Code 専用の Multi-Sidecar / 編集体験 / キーバインド編集等で着実に成熟、累積された設計知見・ナレッジ・テスト資産を Codex 統合で薄めるメリットが現状見いだせない
  2. **Codex 導入のメリットが現時点で不明確**: GPT-5.5 が Claude Sonnet 4.6 / Opus 4.7 を補完する具体的タスクが個人開発で稀少、ベンチマーク差は相対的に小さい
  3. **追加複雑性のコスト**: Critical 6 件 + Major 多数の対応が Phase 1 を 3〜4 週に膨らませる、個人開発者の保守工数 2 倍化、ドキュメント分裂、ナレッジ二重管理
  4. **現時点で Sumi の差別化価値は「Claude Code 専用クライアントとしての完成度」にあり**、マルチ AI で総花的になるより Claude 体験の深掘りを優先

- **保留した内容（将来再検討用に保管）**:
  - `reports/research_codex_integration_proposal.md` (1 人目調査): Codex の本番品質 / `app-server` JSON-RPC / `mcp-server` / AGENTS.md 業界標準化 / 認証フロー / 実装事例
  - `reports/research_codex_risk_reassessment.md` (第二意見): Critical 6 件 / MCP control surface 公式 docs / 「Codex のみ利用」の Phase 別現実解 / 修正版 Phase 1 スコープ
  - 上記 2 文書は **今後 Codex 採用を再検討する際の出発点** として保管。再検討時は ChatGPT Plus rate limit / training opt-in default / Anthropic ToS の最新を再確認すること

- **再検討トリガー（参考、将来このいずれかが揃ったら DEC-081 を再評価）**:
  - GPT-5.5 → GPT-6 等の世代交代で **Claude を明確に上回る** タスク領域が出現
  - ChatGPT Plus が Claude Pro / Max を **明確に下回る** コスト効率に
  - 個人 Sumi 利用者から「Claude のみでは詰む特定ユースケース」が発生
  - Codex CLI の training opt-out が default 化、もしくは Sumi 側の sanitize レイヤが不要になる規約変更
  - Multi-Project × Multi-Engine の sidecar 設計に余裕ができる (`MAX_CONCURRENT_SIDECARS` の上限緩和等)

- **本決定の射程**:
  - Sumi (PRJ-012) アプリへの Codex 統合は当面実装しない
  - claude-code-company 組織側の AI 利用方針は **Claude Code 専用** を継続
  - terminal pane でユーザが個別に `codex` を素手で起動することは妨げない（ただし Sumi 公式機能として位置付けない）
  - CEO の今後の提案で Codex / GPT 系の追加統合を持ち出すときは、本 DEC の見送り理由が解消されているかを必ず確認すること

- **副次効果**:
  - Sumi のロードマップが v1.42.0 以降で「Claude Code 体験の深掘り」に集中可能
  - DEC-080 で示した v2.0.0 候補 (EscapeProvider rename / react-hotkeys-hook 削除 / plugin-store 移行 / when DSL / custom binding 追加) が次のフォーカス
  - PRJ-012 の差別化軸「Cursor 代替の Claude Code 専用クライアント」を明確に堅持

- **関連**:
  - `reports/research_codex_integration_proposal.md` (1 人目調査、保管)
  - `reports/research_codex_risk_reassessment.md` (第二意見、保管)
  - オーナー指示 2026-05-01「方向自体を保留とし、現時点で採用しない方向とします」

---

## DEC-082: サイドバー session-scoped 化 — Multi-Session 表示混線バグの根治（**新設 2026-05-02**）

- **意思決定者**: CEO（オーナー指示「3 session 同時実行時に subagent / context が session 切替で更新されない、理想は選択 session のものが表示される」）
- **対象バージョン**: v1.42.0
- **背景**:
  - オーナーが 3 session 同時実行時に Sidebar の `SubAgentsList` / `ContextGauge` / `TodosList` が session 切替で更新されないバグを報告
  - 推測「最後に実行したものが表示」は半分正解、実態は **3 重混線**:
    1. Rust `MonitorState` がアプリ全体で 1 個の `Arc<RwLock>` (`events/monitor.rs:130`)
    2. 全 sidecar の stdout が同 state に書込、`monitor:tick` も session 識別子なしで global broadcast (`agent.rs:541-571`、引数 `_session_id` は **未使用**)
    3. Sidebar が global `s.monitor` を読む
  - 設計乖離: DEC-063 (v1.17.0) で sidecar handle は `HashMap<session_id, _>` に session 単位化済、PM-984 (v1.8.2) で `useMonitorStore.perSession` + `selectMonitorForSession` 実装済（Tray は乗り換え済）、**Sidebar と Rust monitor pipeline だけ取り残されていた**

- **判断**:
  - 提案 3 案（A: Frontend selector 切替 / B: Rust `MonitorState` HashMap 化 / C: 描画層フィルタ）を比較し、**A+B 一括** を採択
  - 理由: A 単独は subagent / todos 混線が残り「半分治った」状態、B 単独は frontend 引き当てが残る → 両方一括が真の根治。A は B の prefix で捨て実装にならない（合計 ~6h）
  - C は store メモリ膨張で却下

- **実装**（v1.42.0、A + B 一括）:

  ### B. Rust 側の真の根治（案 B）
  - `src-tauri/src/events/monitor.rs`:
    - `MonitorState` を `HashMap<String, SessionMonitor>` に変更（`Arc<RwLock<MonitorStateInner>>` で内包）
    - `SessionMonitor` 構造体に `state` / `counted_request_ids` / `active_task_ids` / `last_emit` を集約（4 つすべて session 単位に降格）
    - 新規 `MonitorTickPayload { session_id, state }` を `#[serde(rename_all = "camelCase")]` で emit
    - 新規 `purge_session(handle, session_id)` async fn: HashMap から指定 session entry を解放
    - 旧 global state 残存ゼロ
  - `src-tauri/src/commands/agent.rs`:
    - `dispatch_to_monitor(session_id)` を必須化、`sessions.entry(session_id)` 経由で session 別に書込・emit
    - 旧 `_session_id` 引数の prefix `_` を外して使用に切替
    - cleanup 3 経路（Terminated handler + `stop_agent_sidecar` + `stop_project_sidecars`）すべてで `purge_session` を非同期 spawn

  ### A. Frontend 側の selector 切替（案 A）
  - `lib/stores/monitor.ts`:
    - global `monitor` state を撤廃、`perSession: Record<sessionId, MonitorRuntimeState>` に統一
    - `setMonitor(sessionId, state)` action
    - 新規 selector `selectContextRatioForSession` / `selectContextPercentForSession` / `selectIsNearLimitForSession`（旧 global 版を全て session-scoped 化、廃止）
  - `hooks/useClaudeMonitor.ts`: payload sessionId 直渡し + graceful skip（古い event は warn log + skip）
  - `components/sidebar/{SubAgentsList,ContextGauge,TodosList}.tsx`: `selectMonitorForSession(currentSessionId)` 経由（TrayContextBar の既存 PM-984 pattern と完全同型）
  - `components/layout/StatusBar.tsx`: model / branch を session-scoped に
  - `components/workspace/TrayContextBar.tsx`: コメント更新（DEC-082 で global fallback を撤廃、session-scoped に統一）

  ### 互換性
  - `MonitorTickPayload` は `#[serde(rename_all = "camelCase")]` で frontend は `sessionId` として受領
  - session_id 不在 event は `console.warn` + skip で graceful（起動初期 / 同時アップグレード対策）
  - persist schema 変更なし（runtime state のみ）
  - 既存 chat / session store には変更なし

  ### テスト
  - **cargo test** 既存 174 → **177 ケース PASS**（新規 5 ケース、うち async test 2 件は test runtime 不在のため ignored 扱い）:
    - `test_three_sessions_are_independent`
    - `test_same_session_tick_composition`
    - `test_request_id_dedup_is_per_session`
    - `test_purge_session_removes_only_target` (async)
    - `test_monitor_tick_payload_camel_case`
  - **vitest** 92 → **102 ケース PASS**（新規 `lib/stores/monitor.test.ts` 10 ケース、3 session 独立性 / selector 切替 / purge / reset）
  - **typecheck** PASS、**lint** 新規警告ゼロ
  - **E2E** はローカル port 3000 競合により skip（既知）、Release CI で再検証

  ### version bump 1.41.0 → 1.42.0

- **設計判断**:
  - **`Map<sessionId, SessionMonitor>` 採用**: 提案書推奨、メモリ効率良し、selector シンプル。per-event broadcast filter 案より概念 clean
  - **broadcast 維持 + payload で sessionId 識別**: 既存 broadcast 経路を維持し payload に sessionId を載せる方式（最小修正、既存 listener は payload を見るだけで OK）
  - **camelCase serde**: Rust 側 `session_id` ↔ TS 側 `sessionId` を `#[serde(rename_all = "camelCase")]` で固定（test_monitor_tick_payload_camel_case で pin）
  - **graceful skip**: 古い tick (sessionId 不在) は warn log + skip、起動初期 / 同時アップグレードでも UI 落ちない
  - **cleanup 3 経路で purge_session**: Terminated handler + `stop_agent_sidecar` + `stop_project_sidecars` すべてから呼ぶことで session 終了時の HashMap 肥大を防止

- **影響範囲**:
  - 修正: `events/monitor.rs`, `commands/agent.rs`, `lib/stores/monitor.ts`, `hooks/useClaudeMonitor.ts`, `SubAgentsList.tsx`, `ContextGauge.tsx`, `TodosList.tsx`, `StatusBar.tsx`, `TrayContextBar.tsx`, version 3 ファイル, `CHANGELOG.md`
  - 新規: `lib/stores/monitor.test.ts` (10 ケース), 監視テスト群 5 ケース
  - 旧挙動への影響: TrayContextBar / 既存 session-scoped 動作は破壊されない、3 session 同時実行時の混線が完全解消

- **品質ゲート**:
  - typecheck: PASS / lint: 新規警告なし
  - cargo test: 177 PASS / vitest: 102 PASS
  - レビュー判定: **APPROVE**（Critical 0 / Major 0 / Minor 3 件はすべて release blocker 不在）
  - Minor 3 件の対応:
    - M-1 (TrayContextBar コメント) と M-2 (CHANGELOG テスト件数表記揺れ) は本 release 内で inline 修正済
    - M-3 (`organization/knowledge/multi-session-architecture.md` への転記) は次 release で実施

- **副次効果**:
  - DEC-074 (auto-compact 通知) が context % を session 別に正確に判定できるようになる
  - 将来 session-scoped state を増やすときの設計 reference として完成（DEC-063 → PM-984 → DEC-082 の段階が完結）

- **関連**: オーナー指示 2026-05-02、`reports/dev_sidebar_session_scoping_proposal.md`, `reports/dev_v142_sidebar_session_scoping_done.md`, `reports/review_v142_sidebar_session_scoping.md`、DEC-063 (v1.17.0 sidecar HashMap), PM-984 (v1.8.2 store perSession)

---

## DEC-083: チャットメッセージへの model/effort 表示機能 — 実 model back-fill + mismatch 検出（**新設 2026-05-02**）

- **意思決定者**: CEO（オーナー指示「チャットで指示した際にユーザーがどのモデルで指示をしたのかを確認できるように、claud から取得した model と effort 設定を表示」）
- **対象バージョン**: v1.43.0
- **背景**:
  - オーナーが送信した user message を後から見返したときに「あれ、これどのモデルで投げたっけ？」が即わかるようにしたい
  - 単に Sumi 側の picker UI 状態を保存するのではなく、**「claud から取得」** で「Sumi UI で選んだ → でも SDK には届いていなかった」のような乖離を検出可能にしたい
  - effort も併せて確認可能にしたい

- **判断**:
  - 提案 3 案（A: 送信時 attach のみ / B: SDK init back-fill のみ / C: A+B ハイブリッド）を比較し、**案 C ハイブリッド** を採択
  - 理由:
    - A 単独では「claud から取得」要望を字義的に満たさない（Sumi 側選択 UI 状態保存に留まる）
    - B 単独では effort が永遠に表示できない（SDK 仕様上 effort は応答に含まれない、公式型 `sdk.d.ts` 確認済）
    - C ハイブリッドは sdkModel back-fill で「claud 取得」を字義満足、uiEffort attach で effort も実用満足、副次的に **「Sumi UI で選んだ model と実 model の乖離」を検出できる安全網** としても機能
  - SDK 公式型から model 取得経路を確認:
    - `SDKSystemMessage (subtype:'init')` の `model: string` (`sdk.d.ts:3101-3132`)
    - `SDKAssistantMessage.message.model` (`sdk.d.ts:2171-2178`、`BetaMessage.model:953`)
    - effort は応答に含まれない（公式型確認済、限界として明示）

- **実装**（v1.43.0）:

  ### 1. 型 / store 拡張
  - `lib/stores/chat.ts` の `ChatMessage` 型に optional `meta` field を追加:
    ```ts
    meta?: {
      uiModel: ModelId | null;       // Sumi UI で選んだ値（即時、案 A）
      uiEffort: EffortLevel | null;
      sdkModel?: string;             // SDK init event 由来（後から back-fill、案 B）
      sentAt: number;                // 送信時刻 (epoch ms)
      mismatch?: boolean;            // family レベル乖離の警告
    }
    ```
  - 新 action `updateMessageMeta(sessionId, messageId, patch)`: 既存 message の meta を partial update + DB 永続化連動
  - `appendMessage` 系の引数に optional `meta` を渡せるよう拡張

  ### 2. ヘルパ (新規)
  - `lib/utils/model-display.ts`:
    - `formatSdkModelName(rawId)`: `"claude-opus-4-7-20251015"` → `"Opus 4.7"` 短縮、prefix match で date suffix 違い吸収、未知 id は raw 返却
    - `compareModelIds(uiId, sdkId)`: family 比較 (opus vs sonnet vs haiku)、suffix 違いだけなら `"match"`、nullish なら `"unknown"`
  - vitest unit 15 ケース

  ### 3. 送信時 attach (案 A 部分)
  - `components/chat/InputArea.tsx` の appendMessage 呼出で `meta = { uiModel, uiEffort, sentAt: Date.now() }` を渡す
  - `uiModel` / `uiEffort` は既存 `useSessionPreferencesStore` の resolve 値（`perQueryOptions` と同じ source）

  ### 4. SDK init event 抽出 (案 B 部分)
  - `hooks/useAllProjectsSidecarListener.ts` に `system` event の `subtype === "init"` branch 追加
  - `payload.model` を取得 → `${reqId}:u` の user message に back-fill
  - `compareModelIds(meta.uiModel, sdkModel)` で family レベル mismatch 判定 → `meta.mismatch = true`
  - 1 prompt あたり最初の init のみ処理する guard (`sdkInitProcessedReqIds: Set`)

  ### 5. DB 永続化
  - `src-tauri/src/commands/history.rs`:
    - `messages` テーブルに `meta_json TEXT NULL` 列を idempotent ALTER TABLE ADD COLUMN
    - `append_message` で `meta` を JSON 直列化して書込
    - 新 Tauri command `update_message_meta(session_id, message_id, meta_json)`
    - `load_session_messages` で `meta_json` を読み出し、JSON parse 失敗時は `None` (defensive)
  - 過去行は `meta_json IS NULL` で存続、frontend は何も表示しない

  ### 6. UI
  - `components/chat/UserMessage.tsx` に bubble の attachments 下に **meta 行**:
    - 通常時: `Opus 4.7 · effort: 高 · 14:32` (text-[11px], opacity-70)
    - mismatch 時: `<AlertTriangle />` icon + `Sonnet 4.6 (実) · UI: Opus 4.7 · effort: 高` + tooltip
    - sdkModel 未到達: `Opus 4.7 (UI 値) · effort: 高 · 14:32` (10 秒タイマーは省略、UX 観点で合理、Phase 2 候補)
    - 過去 message (meta なし): 何も表示しない（defensive fallback）
  - timestamp: 同日 `14:32` / 別日 `4/29 14:32` / 今年外 `2025/12/31 23:59`、`tabular-nums` で等幅

  ### 7. アクセシビリティ
  - `<div role="note" aria-label="送信設定: <model>、effort <level>、<HH時mm分>">`
  - mismatch 時 `aria-live="polite"` で SR 通知
  - 色だけで mismatch を伝えない（icon + text 必須）
  - WCAG AA contrast 確保

  ### 8. 互換性
  - 過去 message (meta なし) は何も表示しない (defensive)
  - DB の `meta_json IS NULL` は parse 段階で `None` 化
  - persist localStorage 影響なし（chat-panes は messages を持たない、DEC-064 以降）
  - 既存 chat / session store には他変更なし

  ### 9. version bump 1.42.0 → 1.43.0

- **設計判断**:
  - **案 C ハイブリッド採択**: 「claud から取得」を sdkModel back-fill で字義満足、effort は uiEffort attach で実用満足
  - **family レベル mismatch 比較**: prefix 正規化後に opus vs sonnet vs haiku のみ比較、date suffix 違いは無視（false positive 防止）
  - **1 prompt あたり最初の init のみ処理**: `sdkInitProcessedReqIds` guard で重複 patch 防止
  - **過去 message へ遡及対応しない**: 「Sumi 側選んだ値」も「claud 使った model」も確実に取れない、誤情報リスク回避、空表示で誠実
  - **monitor.ts (DEC-082) との責務分離**: monitor は session 単位 latest スナップショット、ChatMessage.meta は message 単位の固定履歴、互いに干渉しない

- **影響範囲** (17 ファイル):
  - 新規 3: `lib/utils/model-display.ts` + test、`lib/stores/chat.test.ts`
  - 修正 frontend 9: `lib/stores/chat.ts`、`lib/stores/session.ts`、`lib/types.ts`、`components/chat/InputArea.tsx`、`components/chat/UserMessage.tsx`、`hooks/useAllProjectsSidecarListener.ts`、`tests/e2e/chat.spec.ts`、`tests/e2e/helpers.ts`、CHANGELOG.md
  - 修正 Rust 2: `src-tauri/src/commands/history.rs`、`src-tauri/src/lib.rs`
  - version 3 ファイル

- **品質ゲート**:
  - typecheck: PASS
  - lint: 新規警告ゼロ
  - vitest: 102 → **123 PASS** (新規 21: model-display 15 + chat 6)
  - cargo test: 177 → **182 PASS** (新規 5: meta_json column / migration 冪等 / DDL 2 回適用 / round-trip / NULL INSERT)
  - E2E: 1 ケース追加 (port 競合で local skip、CI 再検証前提)
  - レビュー判定: **CONDITIONAL APPROVE → M-1 (CHANGELOG 数値表記揺れ) を inline 修正後 APPROVE 相当**
  - Minor 3 件 (m-2 spinner / m-3-4 memory cleanup) は Phase 2 候補

- **Phase 2 候補（DEC-083 レビュー指摘 + 計画書 § 5 から）**:
  - sdkModel 未到達時の spinner + 10 秒タイマー (m-2、計画書 § 4.2)
  - `dbRowIdByMessageId` / `sdkInitProcessedReqIds` の memory cleanup を `purgeSessions` と整合 (m-3 / m-4)
  - 「同じ設定で再送」ボタン (計画書 § 4.4)
  - AssistantMessage 側にも meta 表示
  - `SDKResultMessage.modelUsage` 連携で message 単位 cost 推定
  - mismatch サマリ画面（過去 N 件で何回 mismatch があったか）
  - SDK 型 re-export、race window dogfood 観測、date suffix 実機 sampling

- **副次効果**:
  - 「Sumi UI で Opus 選択したのに sidecar が Sonnet で起動」級のバグを **メッセージ単位で常時監視** できる安全網
  - 同一質問を Opus / Sonnet で投げ分けた結果の差分を後から audit 可能
  - DEC-082 で session-scoped 化した monitor との責務分離が明確化

- **関連**: オーナー指示 2026-05-02、`reports/dev_message_model_effort_proposal.md` (計画書、約 600 行)、`reports/dev_v143_message_meta_done.md` (実装完了レポート)、`reports/review_v143_message_meta.md` (品質レビュー)、DEC-082 (session-scoped monitor)

---

## DEC-084: チャット日付グルーピング機能 — 過去日付 collapsed + sticky ヘッダ + search 統合（**新設 2026-05-03**）

- **意思決定者**: CEO（オーナー指示「過去のチャットが多くなりすぎるとスクロールが煩わしい、日付ごとにグルーピングして過去の日付は閉じた状態にし、必要時に開いて確認する形にしたい」）
- **対象バージョン**: v1.44.0
- **背景**:
  - 長 session で過去のチャットが累積し、スクロール量が増えてユーザー認知負荷が高い
  - 日付ごとにグルーピングして「今日」だけ展開、過去日付は折りたたんでおき、必要時に展開する UX 改善要望
  - DB 側は既に `messages.created_at INTEGER` (epoch sec) + `idx_messages_created_at` index が完備 (`history.rs:344-357`)、過去 message の遡及対応は問題なし
  - 但し frontend 側で `StoredMessage.createdAt` を `ChatMessage.timestamp` に伝搬する前提工事が必要 (Phase 0)

- **判断**:
  - 提案 4 案（A: 折りたたみのみ / B: 仮想スクロール / C: 折りたたみ + sticky + 一括 / D: 別画面）を比較し、**案 C ハイブリッド** を採択
  - 理由:
    - 案 A 単独では sticky が無く長 session でヘッダが画面外に消える → UX 中途半端
    - 案 B (仮想スクロール) は DEC-075 (scrollIntoView / FAB) を全面書き直しが必要、オーナー要望「過去日付を閉じる」と方向性違い
    - 案 D (別画面) は UX が大きく変わる、過去 session での連続性失う
    - 案 C は折りたたみで「閉じる」UX を実現しつつ、sticky で常時可視、一括コントロールで操作性良好
  - スコープ: **Phase 0+1+2 を 1 PR で完成版 release**（中間 Phase は段階リリースのオーバーヘッドの方が大きい）

- **実装**（v1.44.0、Phase 0+1+2 一括）:

  ### Phase 0: timestamp 伝搬（前提工事）
  - `lib/stores/chat.ts` の `ChatMessage` 型に `timestamp?: number` field を追加 (epoch ms 精度)
  - `lib/stores/session.ts` の `toChatMessage` で `meta.sentAt` > `createdAt × 1000` の優先順で伝搬
  - DEC-083 `meta.sentAt` (user message のみ ms 精度) を優先源として再利用、無い場合は DB created_at (epoch sec) を ms に変換
  - streaming / append / persist 経路で timestamp 保持

  ### Phase 1: グルーピング + 折りたたみ
  - 新規 store `lib/stores/chat-display.ts`:
    ```ts
    interface ChatDisplayState {
      expandedDateBuckets: Record<sessionId, string[]>;
      toggleDateBucket / setExpandedDates / expandAll / collapseAll(exceptToday) / isExpanded
    }
    ```
    - persist key `sumi:chat-display`、version 1
    - `safeStorage` + migration boilerplate を session-preferences パターンから踏襲
  - 新規ヘルパ `lib/utils/chat-grouping.ts`:
    - `groupMessagesByDate(messages)`: ローカル timezone の YYYY-MM-DD で chunk
    - label 生成: `今日` / `昨日` / `2026-04-30 (金)`
    - timestamp 不在 message は前 message と同 bucket に
  - 新規 component `components/chat/DateBucketHeader.tsx`:
    - chevron icon (`ChevronDown` / `ChevronRight`)
    - `aria-expanded` / `aria-controls` / `id={`date-bucket-header-${dateKey}`}`
    - クリック / Enter / Space で toggle
    - sticky `top-0 z-10 bg-background/95 backdrop-blur-sm`
  - `MessageList.tsx` 改修:
    - 既存の `groupConsecutiveTools` の下流で `groupMessagesByDate` を適用
    - bucket ごとに `<DateBucketHeader />` + `<AnimatePresence>` で expand/collapse
    - **collapsed 時は内容を unmount**（DEC-075 expanded 内 scroll に副作用なし）
    - `appendMessage` 経由で「今日」bucket を必ず auto-expand
    - 初回オープン時は最後の message が含まれる bucket を expanded

  ### Phase 2: sticky + 一括 + search 統合
  - 一括コントロール:
    - 「全て展開」ボタン (`<ChevronsUpDown />`) / 「全て折りたたみ」(`<ChevronsDownUp />`)
    - 「全て折りたたみ」は **今日除外 option** (`exceptToday: true`)
    - shadcn `Button variant="ghost" size="sm"` + aria-label
    - MessageList 上端のツールバー位置
  - search palette 統合:
    - **`SearchPalette.tsx` は無改変**、`MessageList.tsx` 側の `useEffect` で `scrollTargetMessageId` を hook
    - 対象 message の bucket を計算 → `chat-display.toggleDateBucket(sessionId, date)` で auto-expand
    - 既存の 120ms 遅延 scrollIntoView がそのまま動作（framer-motion `<motion.div initial={{height:0}}>` は初期 state でも DOM mount される性質を利用）
    - 「閉じていても自動展開して見せる」UX

  ### アクセシビリティ
  - `aria-expanded` / `aria-controls` / `aria-labelledby` 完備
  - chevron は `aria-hidden`、button 自体に `aria-label`
  - Tab focus 可能、Enter / Space で toggle
  - `useReducedMotion` で reduced 時は瞬時切替 (DEC-077 既存パターン)
  - フォーカスリング `focus-visible:ring-2 ring-ring`

  ### 既存機能との非干渉（最重要）
  - **DEC-075 (scrollIntoView / FAB)**: collapsed bucket は DOM unmount のみ、expanded 内 scroll は完全無改変。FAB は collapsed user を自然 skip = ユーザー意図一致。streaming 完了時の「回答先頭オートスクロール」は今日 bucket 内で既存通り
  - **DEC-076 (InputArea 折畳)**: 完全に別領域、干渉なし
  - **DEC-082 (session-scoped monitor)**: グルーピングも session 単位、整合
  - **DEC-083 (message meta)**: meta 行は個別 message 単位、`meta.sentAt` を timestamp 優先源として再利用 → DEC-083 設計と整合

  ### バージョン bump 1.43.0 → 1.44.0

- **設計判断**:
  - **timestamp の真実の源**: `meta.sentAt` > DB `created_at × 1000` の優先順（ユーザー視点の「今日」を正確に判定）
  - **timezone**: ローカルタイムゾーンで YYYY-MM-DD（UTC ではなくユーザー時計）
  - **bucket key**: `YYYY-MM-DD` ISO 文字列（zero-padded）
  - **collapsed = DOM unmount**: 省メモリ + DEC-075 への副作用ゼロ
  - **「最後の bucket」初期 seed**: 過去 session 再開時も自然な expanded 状態
  - **SearchPalette 無改変 + MessageList 側 hook**: 結合度低、責務分離が秀逸
  - **「全て折りたたみ」は今日除外 option**: ユーザー直感（「今日」を閉じることは稀）
  - **persist 新規 store**: domain state (`sumi:chat`) と UI state (`sumi:chat-display`) の責任分離（DEC-080 と同パターン）

- **影響範囲**:
  - 新規 6: `lib/utils/chat-grouping.ts` + `chat-grouping.test.ts`、`lib/stores/chat-display.ts` + `chat-display.test.ts`、`components/chat/DateBucketHeader.tsx`、`tests/e2e/chat-date-grouping.spec.ts`
  - 修正 4: `lib/stores/chat.ts` (timestamp 配線 + 今日 auto-expand + cascade cleanup)、`lib/stores/session.ts` (`toChatMessage` で `meta.sentAt` > `createdAt × 1000` 優先伝搬)、`lib/stores/chat.test.ts` (timestamp 5 ケース追加)、`components/chat/MessageList.tsx` (bucket render + 一括 toolbar + search auto-expand + reduced-motion)
  - version 3 + CHANGELOG.md
  - persist: 新規 store のみ追加、既存 schema 変更なし

- **品質ゲート**:
  - typecheck: PASS
  - lint: 新規警告ゼロ
  - vitest: 123 → **157 PASS** (新規 34: chat-grouping 16 + chat-display 13 + chat timestamp 5)
  - cargo test: 182 PASS / 3 ignored（Rust 側 schema / API 変更なし）
  - E2E: 1 spec 新規 (3 シナリオ)、ローカル port 競合で skip、CI 再検証前提
  - レビュー判定: **APPROVE**（Critical 0 / Major 0 / Minor 2 件はリリース前 inline 修正済）
  - Minor 2 件（M-1: aria-labelledby の対応 id 不在 / M-2: CHANGELOG テスト件数表記揺れ）は本 release 内で inline 修正済

- **Phase 3 候補（将来）**:
  - 仮想スクロール（案 B 思想、超大規模 session 向け）
  - 日別 cost / usage 集計 dashboard
  - 日付範囲フィルタ（`> 2026-04-01` 等）
  - session export 時の日付グルーピング維持
  - bucket header に「ここで pin」「セクションタイトル付与」など

- **副次効果**:
  - 長時間 session の auditability 向上（日別に何があったか即把握）
  - DEC-083 message meta と組み合わせて「2026-05-01 に Opus 4.7 でこの機能を Claude に書かせた」が直感的に追跡可能
  - 将来の日別 cost 集計 / session export / share 機能の布石

- **関連**: オーナー指示 2026-05-03、`reports/dev_chat_date_grouping_proposal.md` (計画書、約 500 行)、`reports/dev_v144_chat_date_grouping_done.md` (実装完了レポート)、`reports/review_v144_chat_date_grouping.md` (品質レビュー、APPROVE)、DEC-075 (scrollIntoView / FAB)、DEC-082 (session-scoped monitor)、DEC-083 (message meta)

---

## 今後の決定候補（v3.4 路線で更新）

- **DEC-035**: monorepo 採用有無（M2 以降、複数パッケージが必要になった時点）
- **DEC-036**: ccmux-ide TUI のアーカイブ公開可否（M3 以降、Learning Win として OSS 公開か private 維持か）
- **DEC-037**: デザインシステム確定（カラーパレット / アクセント / アニメーション方針、Week3 実装開始時）
- **DEC-038**: 差別化軸 4 つの優先順位（M2 で全部入らない場合どれを先に）
- **DEC-039**: 配布チャネル（GitHub Releases のみ or Homebrew / Winget / Mac App Store 等）
- **DEC-040**: B 案/D 案 PTY 併用モード v4 採用可否（research-pty-cli-mode.md 結果を受けて、M3 後判断）
- **DEC-041**: 正式リネーム（DEC-029 継続、M3 達成後）
- **DEC-042**: session-level sidecar（Option B）昇格可否（v3.3 運用後の並行実行要求に応じて判断）
- **DEC-043**: 組込ターミナル + Codebase semantic search v3.5 採用可否（v3.4 運用後の Cursor 代替実感次第、DEC-040 PTY と統合）
