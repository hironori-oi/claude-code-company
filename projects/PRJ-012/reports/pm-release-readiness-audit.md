# PRJ-012 v1.0 Release Readiness Audit

- **案件 ID**: PRJ-012 ccmux-ide-gui
- **対象バージョン**: v1.0.0（タグ `v1.0.0`、リリース予定 2026-04-21）
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **監査日**: 2026-04-20
- **監査実施**: PM（調査 Agent ae877b66921d34877 の本文記載を正規レポート化）
- **最終化**: 2026-04-20（v1.0 実施状況を反映）

---

## 0. エグゼクティブサマリー

v1.0 リリースに向けた readiness audit を 3 層（Tier 1 release-blocker / Tier 2 hardening
/ Tier 3 nice-to-have）で実施。**Tier 1 / Tier 2-D/E は完了**、Tier 2-G（Error Boundary）
は v1.1 候補として繰越、Tier 3 は post-v1 で順次実施。

v1.0 リリース判定: **GO**（Tier 1 全項目 clean、Tier 2 は security-critical を網羅済）。

---

## 1. Tier 1 — Release-blocker（全完了）

| ID | 項目 | 状態 | 対応レポート |
|----|------|------|--------------|
| T1-A | version 表記統一 | **完了** | package.json / tauri.conf.json / Cargo.toml の version を v1.0.0 で揃え |
| T1-B | Next.js CVE-2025-66478 等 15 件 | **完了** | `pm-release-t1b-nextjs-cve-patch.md`（15.0.3 → 15.5.15） |
| T1-C | Frontend console.log 本番 gate | **完了** | `pm-release-t1c-debug-log-gate.md`（`lib/logger.ts` + NODE_ENV gate） |

### T1-A: Version 表記統一

- `package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` の version を
  v1.0.0 に揃え（既存 ccmux-ide 由来の `0.1.x` 系から明示的に major bump）
- GitHub Release 用タグ `v1.0.0` と CHANGELOG 見出し `[1.0.0]` の整合を確認
- `.github/workflows/release.yml` の awk chunk 抽出が新形式で動作することを
  changelog-v1.0.0-draft で確認済

### T1-B: Next.js CVE 対応

- `next@15.0.3 → 15.5.15`、`eslint-config-next` も同期更新
- `npm audit`: critical 1 件（15 アドバイザリ含）→ **0 件**に解消
- 解消した CVE 系統:
  - CVE-2025-66478（HTTP smuggling）
  - GHSA-9qr9-h5gf-34mp（React flight RCE、critical）
  - GHSA-f82v-jwr5-mffw（Middleware authz bypass、critical）
  - ほか HTTP smuggling / SSRF / DoS / cache poisoning / ARIA bypass 系 12 件
- 検証: `npx tsc --noEmit` 0 error / `npx next build` 成功（36.0s、9 routes）
- 影響範囲: `package.json` / `package-lock.json` の 2 ファイルのみ、ソースコード無変更

### T1-C: Debug log gate

- `lib/logger.ts` 新設（`process.env.NODE_ENV !== "production"` で gate）
- 置換対象 frontend 実コード 12 件 → `logger.debug`
  - `hooks/useAllProjectsSidecarListener.ts`（pm810-claim / resolve / release /
    sdk_session_ready）
  - `components/sidebar/ProjectTree.tsx`（invoke / render / drag 可視化 5 件）
  - `components/chat/InputArea.tsx`（send resume / cache miss / drop 3 件）
- `console.warn` / `console.error` は production でも残置（UX 障害 / 致命エラー解析用）
- Next.js dead-code elimination により production bundle から `logger.debug` 呼出自体
  が消える
- 検証: `npx tsc --noEmit` 0 error / `npx next build` 成功

---

## 2. Tier 2 — Hardening

### 2-1. Tier 2-D: Tauri Asset Protocol scope 絞込（**完了**）

- 対応レポート: `pm-release-t2de-tauri-hardening.md`
- Before: `scope: ["$APPLOCALDATA/**", "$APPDATA/ccmux-images/**", "$HOME/**"]`
- After: `$HOME/**` を削除し **8 具体 path に限定**
  - `$APPLOCALDATA/**`
  - `$APPDATA/ccmux-images/**`
  - `$HOME/.claude/**`
  - `$HOME/.ccmux-ide-gui/**`
  - `$HOME/Pictures/**`
  - `$HOME/Desktop/**`
  - `$HOME/Downloads/**`
  - `$HOME/Documents/**`
- 効果: `$HOME/Desktop/secret-ssh-key.pub` 等の任意 dotfile が画像 URL 経由で
  漏洩する defense-in-depth が有効化
- 既知の副作用: 外部ドライブ / `C:\Program Files` 配下の画像を背景画像として
  直接選択する操作は破綻（`~/Pictures/` 等にコピーして再選択する運用で回避）

### 2-2. Tier 2-E: Capability 絞込（**完了 — 妥協案**）

- 対応レポート: `pm-release-t2de-tauri-hardening.md`
- `capabilities/default.json` の `description` に妥協理由と v1.1 TODO を明記
- **保持（v1.0 では絞込不能）**:
  - `fs:scope` の `$HOME/**`: ユーザー任意の project cwd を add_project で許可する
    要件。完全絞込には Rust 側 dynamic scope（`app.fs_scope().allow_directory()`）が必要
  - `shell:allow-spawn` / `shell:allow-execute` の `args: true`: sidecar Node 起動の
    可変引数要件。whitelist 化には regex / 位置指定 arg の設計が必要
- **v1.1 TODO**:
  1. Rust 側 dynamic scope 実装（add_project / remove_project 連動）
  2. shell:allow-spawn args whitelist 化
  3. assetProtocol の外部ドライブ対応（Preferences で additional_scope 登録 UI）
  4. image dialog に scope 外警告

### 2-3. Tier 2-F: PM-933 で追加した CSP / capability / additionalBrowserArgs

- DEC-046 / DEC-048 で Preview iframe 撤退したが、追加設定は **v1.1 secondary
  webview 復活時の前提として維持**
- 攻撃面の増分は限定的（iframe 読込自体は撤退済で、CSP 緩和のみ残存）
- **v1.1 で再検証**: secondary webview 採用時に devCsp / dangerousDisableAssetCspModification
  を本格活用するか、撤退時点で削除するかを判定

### 2-4. Tier 2-G: Error Boundary（**未実施 — v1.1 候補**）

- 状況: v1.0 時点で React Error Boundary は未導入
- 現状の fallback:
  - Next.js App Router の default error page（`app/error.tsx` も未設置）
  - Tauri WebView2 の crash 時は window 全体が停止
- **v1.1 での推奨実装**:
  - Route level: `app/error.tsx` + `app/global-error.tsx`
  - Component level: `ChatPanel` / `FileEditor` / `TerminalView` / `PreviewPane`
    の 4 主要 pane ごとに境界設置
  - エラー時に該当 pane のみ fallback UI に切替、他 pane は継続動作
- **v1.0 での許容理由**:
  - dogfood 期間中に主要 crash 経路は潰されている（PM-810 regression hotfix / session cache / xterm race 等）
  - Error Boundary 無しでも個人配布の private 運用で致命的でない

---

## 3. Tier 3 — Nice-to-have（post-v1）

| ID | 項目 | 推定工数 | 優先度 |
|----|------|----------|--------|
| T3-A | Rust `eprintln!` / `println!` を `log` crate + `RUST_LOG` gate | 4h | 低（release build では stdout が繋がらないため実害小） |
| T3-B | sidecar `DEBUG_SIDECAR` env gate の既定化 | 2h | 低 |
| T3-C | ESLint warning 解消（unused vars / img → next/image / aria） | 6h | 中 |
| T3-D | SSR 時の `list_active_sidecars failed: window is not defined` を dynamic import で解決 | 3h | 中 |
| T3-E | `.npmrc` の `legacy-peer-deps=true` 削除検討（playwright peer 調整後） | 2h | 低 |
| T3-F | Rust 側 `cargo audit` / `cargo deny` の CI 組込 | 4h | 中 |
| T3-G | `tauri-plugin-log` file sink 追加（path sanitize 付き） | 6h | 中 |
| T3-H | E2E（Playwright）の CI 回帰実行（`npm run test:e2e`） | 8h | 高（v1.1 で必須化推奨） |
| T3-I | Windows NSIS / macOS DMG / Linux AppImage の署名検証（updater pubkey Ed25519） | 12h | 高（M3 PM-304 として積まれている） |
| T3-J | Terminal scrollback の Rust 側 shadow copy + replay（DEC-047 tradeoff 解消） | 10h | 中 |
| T3-K | Preview 再挑戦（Tauri 2 secondary webview window / Phase 4 案 D） | 8h | 中 |

---

## 4. v1.0 リリース判定

### 4-1. GO 判定の根拠

- **Tier 1 全完了**: version / CVE / debug log の release-blocker 3 件は clean
- **Tier 2-D/E 完了**: asset protocol の defense-in-depth 有効化、capability は
  description で妥協理由を文書化
- **ビルド成功**:
  - `npx tsc --noEmit` 0 error
  - `npx next build` 成功
  - `cargo check` PASS（pre-existing dead code warning のみ）
- **セキュリティ監査**:
  - `npm audit` 0 vulnerabilities
  - Tauri asset protocol defense-in-depth 有効
- **dogfood 実績**:
  - PM-810 regression / v3.5.19 session cache / PM-870 background image / PM-935
    terminal race / PM-936 preview 撤退 と連続 hotfix を経て stable 域
  - オーナーが日常で Cursor / 公式 Claude Code Desktop を開かずに作業継続可能
    （DEC-025 Gate-E2v3 の AC2-1 達成）

### 4-2. 既知の制約（release notes / README で明示）

- Tauri `fs:scope $HOME/**` は v1.1 で dynamic 絞込（現時点では attack surface あり）
- Terminal 4 pane 時の PTY process 数（最大 4 / project）
- Terminal tab 切替で scrollback reset（DEC-047 tradeoff）
- Preview は外部ブラウザ起動式（iframe 撤退、DEC-046/048）
- 自己署名なし配布のため SmartScreen / Gatekeeper 警告あり

### 4-3. v1.1 で必須対応となるもの

- T2-G Error Boundary（route + component 2 層）
- T3-I 署名 / updater pubkey Ed25519 化（M3 PM-304）
- T3-H E2E Playwright CI 回帰

### 4-4. v1.1 で段階的対応が望ましいもの

- T2-E の Rust dynamic scope / shell args whitelist
- T3-A Rust log gate
- T3-C ESLint warning 解消
- T3-J Terminal scrollback shadow copy
- T3-K Preview 再挑戦（secondary webview）

---

## 5. 参照

### 5-1. 関連 DEC

- DEC-045: Terminal 本格版 v1.0 同梱
- DEC-046: Preview Phase 1 iframe → v1.0 撤退
- DEC-047: Terminal Shell conditional mount
- DEC-048: Preview iframe 撤退、外部ブラウザ一本化
- DEC-049: 1/2/4 pane 分割対応
- DEC-050: Editor / Terminal split 対応

### 5-2. 関連レポート

- `pm-release-t1b-nextjs-cve-patch.md`
- `pm-release-t1c-debug-log-gate.md`
- `pm-release-t2de-tauri-hardening.md`
- `pm-release-sidebar-tab-order.md`
- `dev-v10-pm-910-clear-full-refresh.md`
- `dev-v10-pm-920-terminal-implementation.md`〜`pm-935-shell-conditional-mount.md`
- `dev-v10-pm-936-preview-iframe-retreat.md`
- `dev-v10-pm-937-quad-split.md`
- `changelog-v1.0.0-draft.md`（同フォルダ）

### 5-3. 関連社内ルール

- `organization/rules/quality-gates.md`
- `organization/rules/project-lifecycle.md`（Phase 5 リリース準拠）
- `organization/rules/testing-policy.md`

---

## 6. 結論

**v1.0.0 は release GO**。Tier 1 / Tier 2-D/E は網羅、Tier 2-G は v1.1 候補として
明示的に繰越。Tier 3 は post-v1 で優先度順に吸収する。

本 readiness audit の所見を CHANGELOG v1.0.0（`changelog-v1.0.0-draft.md`）の
Known Issues / Security セクションに反映済。

以上、CEO への報告事項。オーナーへのリリース実施判断を仰ぐ。
