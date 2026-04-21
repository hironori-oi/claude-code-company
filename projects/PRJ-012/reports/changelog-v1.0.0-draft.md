# CHANGELOG v1.0.0 Draft (PRJ-012 ccmux-ide-gui)

- **Target file**: `C:\Users\hiron\Desktop\ccmux-ide-gui\CHANGELOG.md`
- **Draft date**: 2026-04-20
- **Release date**: 2026-04-21
- **作成方針**: ccmux-ide-gui 本体リポジトリへは Agent から書込せず、本 draft を CEO
  が手動で該当 CHANGELOG.md に差込む。タグ `v1.0.0` 抽出のため、awk が検出する
  `## [1.0.0] - 2026-04-21` 行フォーマットを厳守すること（既存 `## [v0.1.0] - ...`
  と別形式だが、release.yml の awk は `## [` 始まりを chunk 区切りとして扱うため
  後方互換あり。ただし **既存 v0.1.0 の見出しを `[v0.1.0]` から `[1.0.0]` に揃える
  規約変更が必要な場合は本 draft と同時に調整**する）

---

## 差込先の指針

既存 CHANGELOG.md は `## [Unreleased]` セクションに Round D' の OAuth Usage API 連携
などが累積されている。v1.0.0 確定時の推奨処理:

1. `## [Unreleased]` 配下の Added/Changed/Known Issues を v1.0.0 セクション側に統合
   （Round D' は v1.0.0 の Added として扱うか、Unreleased で残すかは CEO 判断）
2. 下記 v1.0.0 セクションを `## [v0.1.0]` の直前に挿入
3. 新しい空の `## [Unreleased]` を先頭に再設置

---

## 差込ブロック（Keep a Changelog 形式）

```markdown
## [1.0.0] - 2026-04-21

### Added
- 組込ターミナル本格版（xterm.js + portable-pty、interactive cmd / bash / vim / git 対応）
  (PM-920 / DEC-045)
- Preview タブ（外部ブラウザ連携、プロジェクトごとに URL 保存 / last URL 復元）
  (PM-925 / PM-936 / DEC-046 / DEC-048)
- Editor / Terminal の 1 / 2 / 4 pane 分割（Approach A: リソース共有 + pane 参照リスト）
  (PM-924 / PM-937 / DEC-049 / DEC-050)
- `/effort` slash command（model-level effort 切替 UI 連携）(PM-840)
- tool content の JSON 整形表示（assistant tool_use / tool_result を humanize） (PM-831)

### Changed
- `/clear` で sidecar 再起動による完全 context リフレッシュ（従来は conversation reset
  のみ、pm810-hotfix 経路も同時にクリア）(PM-910)
- Sidebar タブ順序: ファイル / セッション / ルール / 実行状態 → **セッション / ファイル
  / ルール / 実行状態**（default active tab も sessions に変更、pm-release-sidebar-tab-order）
- Terminal Shell は conditional mount に変更（`display:hidden` 常時 mount の race を
  構造的に解消、0x0 canvas 問題の根本修正）(PM-935 / DEC-047)

### Fixed
- Split Sessions で message が誤 pane に届く regression（pm810-claim/resolve/release
  の 3-phase routing で sidecar event を正しい pane に配送）(PM-810)
- Session cache stale で resume 失敗する regression（v3.5.19: session 選択時の cache
  invalidation をタイミング制御）
- 背景画像が起動時に反映されない bug（AppearanceSettings 初期化と apply-accent の
  race）(PM-870)
- Next.js CVE-2025-66478（HTTP smuggling / SSRF / RCE / DoS 系 15 アドバイザリ）を
  15.0.3 → 15.5.15 で解消（`npm audit` critical 1 → 0）(T1-B)
- React 19 + zustand infinite loop 3 件を修正（MessageList / InputArea /
  ActivityIndicator の selector memoize）
- `tailwind.config.ts` の ESM require エラーを ESM import に移行

### Security
- Tauri asset protocol scope 絞込: `$HOME/**` → 8 具体 path
  （`$APPLOCALDATA/**` / `$APPDATA/ccmux-images/**` / `$HOME/.claude/**` /
  `$HOME/.ccmux-ide-gui/**` / `$HOME/Pictures/**` / `$HOME/Desktop/**` /
  `$HOME/Downloads/**` / `$HOME/Documents/**`）(T2-D)
- Frontend 2722 件の console.log を `lib/logger.ts` wrapper で `NODE_ENV` gate 化
  （実コード 12 件を logger.debug に置換、warn / error は production でも残置）(T1-C)
- Capability の `fs:scope $HOME/**` と `shell:allow-spawn args:true` は保持
  （project cwd / sidecar args 可変要件のため、v1.1 で Rust 側 dynamic scope
  実装 + whitelist 化に移行予定）(T2-E)

### Removed
- Frontend dead code 14 ファイル（PM-770）: `GitPanel` / `WorktreeTabs` / `Inspector`
  / `ProjectSwitcher` ほか、過去の実験 UI で現在参照されていないもの
- Rust 孤立 command 13 個（PM-771）: `git_*` / `worktree_*` / `status_*` 系
  （frontend から invoke されていない v3.4 以前の残骸）

### Known Issues
- Terminal 4 pane は PTY process が project 当たり最大 4 個生成、メモリ消費増
  （ユーザ明示選択時のみ）
- Terminal conditional mount の tradeoff として tab 切替で xterm scrollback が reset
  （PTY 自体は維持、v1.1 で data stream buffering 検討）
- Preview は iframe 撤退のため完全な IDE 内 preview ではなく外部ブラウザ起動式
  （v1.1 で Tauri 2 secondary webview window / Phase 4 案 D を再検証）
- Tauri `fs:scope` の `$HOME/**` は当面維持（v1.1 で dynamic scope 化予定）

### Credits
- Based on [ccmux](https://github.com/Shin-sibainu/ccmux) by
  [@Shin-sibainu](https://github.com/Shin-sibainu), MIT Licensed.
- 組織運営統合は [claude-code-company](https://github.com/hironori-oi/claude-code-company)
  のメタ設計に基づく

### Acceptance
- v1.0 readiness audit: `projects/PRJ-012/reports/pm-release-readiness-audit.md`
- Tier 1（version / CVE / debug log）/ Tier 2-D/E（asset protocol / capability）
  完了、Tier 2-G Error Boundary は v1.1 候補
```

---

## 付記: 既存 `## [Unreleased]` の扱い（CEO 判断が必要な点）

- Round D' の公式 OAuth Usage API 連携（StatusBar 5h/7d ゲージ復活、サイドバー
  UsageStatsCard 実値化）は **v1.0.0 の Added に統合推奨**（ユーザ可視の新機能）
- `claude-usage.ts` / `useClaudeRateLimits.ts` 削除 → OAuth API ベースに置換の
  Changed は **v1.0.0 の Changed に統合推奨**
- Known Issues の OAuth Beta schema 崩壊耐性 / `claude login` 依存は **v1.0.0 の
  Known Issues に統合**

推奨構成:

```markdown
## [Unreleased]
（空、次 patch/minor 用）

## [1.0.0] - 2026-04-21
（上記ブロック + Round D' 統合）

## [v0.1.0] - 2026-04-19
（既存維持、または `[0.1.0]` にフォーマット揃え）
```

---

## 完了条件（ccmux-ide-gui 側 CHANGELOG 差込時のチェックリスト）

- [ ] `## [1.0.0] - 2026-04-21` 見出しが awk 抽出で chunk 化される
      （`.github/workflows/release.yml` の `## [` パターンと整合）
- [ ] Added / Changed / Fixed / Security / Removed / Known Issues / Credits /
      Acceptance セクションが揃う
- [ ] tag `v1.0.0` と見出し `[1.0.0]` のバージョン表記一致
- [ ] 既存 `## [Unreleased]` からの移送項目が漏れなく統合
- [ ] v1.0.0 リリース後、`## [Unreleased]` を空で再設置

---

以上、CEO による手動差込み待ち。
