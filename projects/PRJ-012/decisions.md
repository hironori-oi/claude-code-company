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
