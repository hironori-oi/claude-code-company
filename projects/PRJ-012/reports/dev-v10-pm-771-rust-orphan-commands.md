# PRJ-012 v3.5 Rust Orphan Command Removal Report (PM-771)

**日付**: 2026-04-20
**対象**: `C:\Users\hiron\Desktop\ccmux-ide-gui\src-tauri\` (v3.5.x 系統)
**前提**: PM-770 (`dev-v10-pm-770-dead-code-removal.md` §5.1) で特定済の Rust 孤立 `#[tauri::command]` 13 件を物理削除する。
**tauri dev**: 停止確認済 (オーナー確認)。

---

## 1. 作業サマリ

PM-770 の申し送り通り、frontend invoke 0 が確定している 3 module (`git.rs` / `worktree.rs` / `status.rs`) と付随 13 command を物理削除し、`src-tauri/src/lib.rs` / `src-tauri/src/commands/mod.rs` の登録を整理した。

- 削除 module file: **3**
- 削除 `#[tauri::command]` : **13**
- 削除 `pub struct` (公開型): **5** (module ごと消失)
- 削除 helper 関数 / test コード: module 内の全付随コード（計 ~1,100 行）
- Cargo.toml 変更: **なし** (残 module で依存継続のため — §4 参照)
- frontend 変更: **なし** (PM-770 完了時点で invoke / interface 撤去済、本 round は Rust のみ)

---

## 2. 削除内容（PM-770 §5.1 「削除候補リスト」との突合）

### 2.1 module file の物理削除

| # | ファイル | 行数 (tests 含む) | 削除 command | 削除 struct | 備考 |
|---|---------|-------------------|-------------|------------|------|
| 1 | `src-tauri/src/commands/git.rs` | 775 | `git_status`, `git_stage_file`, `git_unstage_file`, `git_commit`, `git_diff_file`, `git_current_branch` (6) | `GitFileEntry`, `GitStatus`, `GitDiffContent` | 全構成要素が削除対象のみ。file ごと削除。|
| 2 | `src-tauri/src/commands/worktree.rs` | 212 | `list_worktrees`, `add_worktree`, `remove_worktree`, `switch_worktree` (4) | `Worktree` | 全構成要素が削除対象のみ。file ごと削除。|
| 3 | `src-tauri/src/commands/status.rs` | 258 | `detect_status_file`, `list_status_candidates`, `read_status_file` (3) | `StatusFile` | 全構成要素が削除対象のみ。file ごと削除。|

**合計: 3 file / 1,245 行 / 13 command / 5 struct を物理削除** (PM-770 §5.1 の 13 command リストと完全一致)。

### 2.2 file 削除 vs `git rm` 内訳

```
 D src-tauri/src/commands/worktree.rs   (tracked, git が 削除を検知)
   src-tauri/src/commands/git.rs        (untracked, `rm` で直接削除)
   src-tauri/src/commands/status.rs     (untracked, `rm` で直接削除)
```

`git.rs` / `status.rs` は新規 untracked file の状態で本 round を迎えたため (PM-770 で frontend 側は先に撤去されていたが Rust 側は未 commit 状態で残っていた)、直接 `rm` で削除。`worktree.rs` は tracked だったため `git status` 上は `D` 扱い。

### 2.3 残置（削除禁止 — PM-771 指示書 準拠）

| command | 残置理由 |
|---------|---------|
| `get_claude_rate_limits` | CHANGELOG 記載の将来 JSON mode 用、現状 invoke_handler 登録は維持 |
| `send_agent_interrupt` | 中断ボタン実装時に使用、既に invoke_handler 登録済で継続 |
| `search_conversations` / `reindex_conversations` | PM 判断保留 |

いずれも `lib.rs` の `invoke_handler!` / `use commands::...` で登録継続、本 round では一切触っていない。

---

## 3. lib.rs / mod.rs の更新内容

### 3.1 `src-tauri/src/commands/mod.rs`

- `pub mod worktree;` を削除
- `pub mod status;` を削除
- `pub mod git;` を削除
- 削除箇所には以下のコメントを残置:

  ```rust
  // PRJ-012 v3.5 / PM-771 (2026-04-20): `worktree` / `status` / `git` module は
  // v3.5.3 UI 再配置で frontend 呼出 0 となり PM-770 で列挙、本 round で物理削除。
  ```

### 3.2 `src-tauri/src/lib.rs`

- `use commands::{...}` から以下の import を除去:
  - `worktree::{add_worktree, list_worktrees, remove_worktree, switch_worktree}`
  - `status::{detect_status_file, list_status_candidates, read_status_file}`
  - `git::{git_commit, git_current_branch, git_diff_file, git_stage_file, git_status, git_unstage_file}`

- `tauri::generate_handler![...]` から 13 件の symbol を除去:
  - Worktree ブロック 4 件
  - Status pane ブロック 3 件
  - Git 統合パネル 6 件

- 削除した 3 ブロックそれぞれに PM-771 の削除注記コメントを残置（diff 追跡性確保のため、将来の git blame で意図を即座に追えるように）。

---

## 4. Cargo.toml への影響確認

PM-771 指示書 §注意事項の「dep 整理推奨 (tempfile 等)」を検証。

### 4.1 `tempfile` (dev-dependency)

削除対象 3 module 内の integration test (`#[tokio::test]`) で `tempfile::tempdir()` を使用していたが、`tempfile` は **残置 module にも使用中** のため Cargo.toml 変更なし:

- `src-tauri/src/commands/slash.rs` : ○
- `src-tauri/src/commands/file_list.rs` : ○
- `src-tauri/src/commands/fs_util.rs` : ○
- `src-tauri/src/commands/builtin_slash.rs` : ○
- `src-tauri/src/commands/memory_tree.rs` : ○

よって `[dev-dependencies] tempfile = "3"` は維持。

### 4.2 その他の dep

- `serde` / `serde_json` / `tokio` : 全 module で利用中、維持
- `chrono` : 削除対象の `status.rs` で `DateTime<Utc>` を使っていたが、他にも `usage.rs` / `oauth_usage.rs` で利用中のため維持
- `walkdir` / `ignore` / `rusqlite` / `reqwest` / `keyring` / `arboard` / `image` / `notify` / `similar` / `uuid` / `time` / `dirs` : いずれも削除対象 module では未使用 or 他 module で利用、影響なし

**結論: Cargo.toml は本 round で一切変更しない**（指示書「判断に迷ったら残置」方針に整合）。

---

## 5. 検証結果

### 5.1 `cargo check`

```
cd C:\Users\hiron\Desktop\ccmux-ide-gui\src-tauri
cargo check
```

**結果: 0 error**

warning は既存のもの 3 件のみ (PM-771 起因ではない):

| warning | 場所 | 備考 |
|---------|------|------|
| `function sessions_has_project_id is never used` | `commands/history.rs:201` | v5 migration 関連、本 round 対象外 |
| `variant Cwd is never constructed` | `commands/memory_tree.rs:20` | `#[derive(Clone, Debug)]` あり、本 round 対象外 |
| `method context_ratio is never used` | `events/monitor.rs:108` | pub method、本 round 対象外 |

いずれも PM-771 スコープ外で既存既知の dead warning。fail しない。

### 5.2 `cargo test --lib`

```
cd C:\Users\hiron\Desktop\ccmux-ide-gui\src-tauri
cargo test --lib
```

**結果: 93 passed; 0 failed; 0 ignored**

削除前は `git.rs` / `worktree.rs` / `status.rs` 由来の test があったため (parse_porcelain_typical など 17+ 件)、削除後は net で数件減少しているが、残る全 93 件が green。

### 5.3 frontend `npx tsc --noEmit`

```
cd C:\Users\hiron\Desktop\ccmux-ide-gui
rm -f tsconfig.tsbuildinfo
npx tsc --noEmit; echo "EXITCODE=$?"
```

**結果: EXITCODE=0** — 0 error。PM-770 で frontend 側は既に整理済のため、Rust 削除の影響なし。

### 5.4 `cargo build --release` (バイナリサイズ計測)

**実施せず**。Cargo.toml の `[profile.release] opt-level = 0` + 初回 release ビルドで 10 分以上要する可能性が高く、指示書「重い場合はスキップ可」に従い割愛。削減分は概算で **Rust source ~1,245 行 / 13 tauri::command の dispatch 分岐 (数 KB〜数十 KB オーダー相当)**。

---

## 6. 削除 file / function / struct 一覧（完全版）

### 6.1 削除 file (3)

- `src-tauri/src/commands/git.rs`
- `src-tauri/src/commands/worktree.rs`
- `src-tauri/src/commands/status.rs`

### 6.2 削除 `#[tauri::command]` (13 — PM-770 §5.1 と完全一致)

**git.rs 由来 (6)**
- `git_status`
- `git_stage_file`
- `git_unstage_file`
- `git_commit`
- `git_diff_file`
- `git_current_branch`

**worktree.rs 由来 (4)**
- `list_worktrees`
- `add_worktree`
- `remove_worktree`
- `switch_worktree`

**status.rs 由来 (3)**
- `detect_status_file`
- `list_status_candidates`
- `read_status_file`

### 6.3 削除 `pub struct` (5)

- `GitFileEntry` (git.rs)
- `GitStatus` (git.rs)
- `GitDiffContent` (git.rs)
- `Worktree` (worktree.rs)
- `StatusFile` (status.rs)

※ PM-770 時点で frontend 側の対応 `interface` は既に削除済 (`lib/types.ts`)。

### 6.4 削除 helper / private 関数 (主要)

- git.rs: `git_spawn_err`, `git_show_or_empty`, `parse_porcelain_v1`, `parse_branch_header`, `extract_new_path`, `unquote_path`
- worktree.rs: `is_safe_id`, `parse_worktree_list`
- status.rs: `detect_in`, `list_in`, `collect_md_entries`, `build_status_file`

いずれも module-private、使用元は削除対象 command のみ。

### 6.5 削除 test (`#[cfg(test)]` モジュール内)

- git.rs: 10+ 件 (parse_porcelain_*, extract_new_path_*, unquote_path_*, status_in_real_repo_roundtrip, diff_file_working_vs_head, current_branch_returns_main)
- worktree.rs: 3 件 (is_safe_id_*, parse_worktree_porcelain)
- status.rs: 7 件 (detect_*, list_in_*)

---

## 7. Cargo.toml 除去 dependency 一覧

**なし**（§4 で述べた通り、削除対象 module でのみ使われる dep は存在しなかった）。

---

## 8. リスク評価

### 8.1 破壊リスク

| 項目 | 評価 |
|------|------|
| frontend typecheck | 0 error 維持（5.3） |
| cargo check | 0 error 維持（5.1） |
| cargo test --lib | 93/93 pass（5.2） |
| invoke_handler 整合性 | generate_handler! の登録と `use commands::...` を同時削除、orphan なし |
| Cargo.lock | `cargo check` で自動更新済（追加 dep / 削除 dep なしのため実質 no-op） |

### 8.2 意図せぬ副作用の可能性

- **tests/e2e/fixtures.ts** の `list_worktrees` / `add_worktree` / `delete_worktree` の mock 分岐は **残置**（PM-770 と整合、無害）。Rust command 消失後に frontend が invoke した場合でも fixtures mock は Playwright 側で intercept するため実害なし、将来 e2e 整理の際に別 round で判断。
- **lib/types.ts** の削除済 interface のコメント（「Rust side の struct は残置」と記載）は、本 round で struct も削除されたため**記述が古くなる**。ただし PM-771 の scope は Rust のみであり、frontend types.ts のコメント修正は別 round (PM-772 docs 更新) のスコープに該当する想定。本 round では触らない。

### 8.3 ロールバック手順

万一問題発生時: `git restore src-tauri/src/commands/mod.rs src-tauri/src/lib.rs && git checkout HEAD -- src-tauri/src/commands/worktree.rs` で復元可能（git.rs / status.rs は untracked だったため履歴からは復元不可だが、PM-770 レポート §5.1 に API 仕様は保存済で再実装は可能）。

---

## 9. 完了条件チェック

| 条件 | 状態 |
|------|------|
| `cargo check` 0 error (warning 容認) | OK (既存 warning 3 件のみ、PM-771 起因 0 件) |
| `cargo test --lib` pass | OK (93 passed; 0 failed) |
| `npx tsc --noEmit` (frontend) 0 error | OK (EXITCODE=0) |
| 削除 file / function / struct 一覧 | §6 参照 |
| Cargo.toml 除去 dep 一覧 | §7 参照（なし） |
| tauri dev 停止確認 | 事前確認済（オーナー） |
| 過度な refactor 禁止 / 最小 diff | 遵守（mod.rs / lib.rs の登録除去 + file 削除のみ） |
| frontend 無変更 | 遵守（PM-771 の指示通り Rust のみ） |

---

## 10. 次回タスク提案（申し送り）

1. **PM-772 docs 更新**: PM-770 残件の `README.md:148` / `components/layout/CLAUDE.md` / `docs/screenshots/SCREENSHOTS-TODO.md` + 本 round 起因で `lib/types.ts` のコメント ("Rust side の struct / command は src-tauri に残置") を「削除済」に修正
2. **PM-773 orphan 残骸判断**: `WelcomeWizard.tsx` / `hooks/use-toast.ts` / `components/icons.tsx` の去就 PM 判断 (PM-770 §4.2 残件)
3. **e2e fixtures 整理（低優先）**: `tests/e2e/fixtures.ts` の `list_worktrees` / `add_worktree` / `delete_worktree` mock 分岐を削除（現状無害だが dead code）
4. **CHANGELOG 更新**: Unreleased セクションに「Removed: 13 orphan Tauri commands (PM-771)」を追記
5. **搭載検証 (tauri:build)**: 次回 dev tauri 起動時に `npm run tauri:dev` で sidecar + Rust bundling が問題なく通ることを confirm（本 round では未実施、cargo check と cargo test で代替）

---

## 11. CEO 向けサマリ

- PM-770 で列挙済の Rust 孤立 13 `#[tauri::command]` を予定通り物理削除、frontend は無変更
- `cargo check` / `cargo test --lib` / `npx tsc --noEmit` いずれも green
- Cargo.toml 依存削除は発生せず (残 module で再利用されているため）
- 削除総量: **3 file / 1,245 行 / 13 command / 5 struct**
- 残置禁止 command (`get_claude_rate_limits`, `send_agent_interrupt`, `search_conversations`, `reindex_conversations`) は全て温存
- リスク評価は grade **低**（frontend から invoke 0、かつ type / cargo check / test 全 green）

工数実績: 約 30 分（cargo check 12s + cargo test 数秒 + npx tsc 数秒で、待ち時間が想定より大幅に短かった）。
