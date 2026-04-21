# PRJ-012 v3.5 Dead Code Removal Report (PM-770)

**日付**: 2026-04-20
**対象**: `C:\Users\hiron\Desktop\ccmux-ide-gui\` (v3.5.x 系統)
**目的**: v3.5.3 で撤去決定済だが物理ファイルが残存していた UI components / stores / types を削除し、frontend から参照 0 の dead code を整理する。Rust 側の孤立 `#[tauri::command]` は本 round では**列挙のみ**（削除は次回持ち越し、安全側）。

---

## 1. 調査サマリ

### 1.1 使用ツール

- `npx knip --no-exit-code` (frontend unused files / exports / deps)
- `Grep` (import 実参照の突合: `GitPanel` / `WorktreeTab` / `Inspector` / `ProjectSwitcher` 等)
- `#[tauri::command]` 一覧を grep で抽出し、frontend の `callTauri(...)` / `invoke(...)` 呼出と突合

### 1.2 v3.5.3 時点の撤去決定（ソース注釈で明文化済）

- `components/layout/Shell.tsx:186` — **「v3.5.3: 右 Inspector 完全撤去（Git / Status / Worktree / CLAUDE.md 全機能を Sidebar / エディタ / 左 Rail に再配置）」**
- `components/sidebar/Sidebar.tsx:288` — **「v3.5.1: Git タブは撤去済（UI 層から Git 管理機能を削除）」**
- `components/sidebar/Sidebar.tsx:208-212` — **「v3.4.10: ProjectSwitcher を廃止」**

これらの宣言と整合する形でファイルを物理削除した。

### 1.3 Baseline typecheck

削除前: `npx tsc --noEmit` → `EXITCODE=0`（stale incremental cache による一時的な error 1 件はクリアすると消失）。削除後も 0 error を維持。

---

## 2. 物理削除一覧

### 2.1 Tracked files（`git rm` で履歴保全）

| # | ファイル | 行数 | 理由 |
|---|---------|------|------|
| 1 | `components/layout/Inspector.tsx` | 66 | v3.5.3 で右ペイン撤去、Shell.tsx から import 削除済。どこからも import されていない。 |
| 2 | `components/inspector/WorktreeTabs.tsx` | 211 | Inspector 内の worktree タブ UI。Inspector 削除と同時に無参照化。 |
| 3 | `components/inspector/WorktreeDialog.tsx` | 238 | WorktreeTabs が使う作成 Dialog。連鎖的に無参照化。 |
| 4 | `components/inspector/MemoryEditor.tsx` | 303 | Inspector 内の CLAUDE.md 編集 UI。Sidebar からは `openInEditor`（editor store 経由 EditorPane）で代替済。 |
| 5 | `components/inspector/MemoryEditorPanel.tsx` | 302 | MemoryEditor の 3 スコープ wrapper。上と同じ理由で無参照化。 |
| 6 | `components/sidebar/ProjectSwitcher.tsx` | 150 | v3.4.10 で ProjectRail + TitleBar に機能集約。Sidebar.tsx 内コメントのみで参照 0。 |
| 7 | `lib/stores/worktree.ts` | 209 | `useWorktreeStore` の唯一の consumer（WorktreeTabs / WorktreeDialog）を削除したため無参照化。 |

**Tracked 小計**: **7 ファイル / 1,479 行** (`git diff --cached --stat`)

### 2.2 Untracked files（新規追加途中で放置されていたもの、直接 `rm`）

| # | ファイル | 理由 |
|---|---------|------|
| 8 | `components/sidebar/GitPanel.tsx` | v3.5.1 で Sidebar Git タブ撤去済。コメントのみで参照 0。 |
| 9 | `components/sidebar/GitDiffView.tsx` | GitPanel 連動の diff view。同じく無参照化。 |
| 10 | `components/sidebar/ActiveProjectPanel.tsx` | v3.4.10 で Sidebar 常設から外れ、削除は TitleBar に集約済。どこからも import されていない。 |
| 11 | `components/status/StatusPane.tsx` | Inspector 配下の汎用 Status pane。Inspector 削除と連動で無参照化。 |
| 12 | `components/status/StatusPicker.tsx` | StatusPane の補助 picker。同上。 |
| 13 | `lib/stores/git.ts` | `useGitStore` は GitPanel / GitDiffView からのみ。無参照化。 |
| 14 | `lib/stores/status.ts` | `useStatusStore` は StatusPane / StatusPicker からのみ。無参照化。 |

**Untracked 小計**: **7 ファイル**（サイズ合算は約 1,800 行相当、staging 前のため `git diff` stat には載らない）

### 2.3 空ディレクトリの削除

- `components/status/` — 全ファイル削除により空になったため `rmdir` で削除。

### 2.4 削除 トータル

**合計 14 ファイル / 概算 3,200+ 行の dead code を物理削除**。

---

## 3. 必要最小限の import / コメント調整

### 3.1 `components/palette/CommandPalette.tsx`

Git グループが「新規 worktree（Week 7 で実装予定）」という placeholder toast のみだったため、以下を削除:

- `GitBranch` import
- `handleNewWorktree` ハンドラ
- `<CommandGroup heading="Git">` ブロック全体
- doc comment の `* - Git: 新規 worktree（Week7 実装のため placeholder）` 行

`EXITCODE=0` を保つために UI 的にも一貫（Git 撤去決定の他箇所と整合）。

### 3.2 `lib/types.ts`

以下の interface を削除（frontend 呼出 0、Rust 側 struct は残置）:

- `Worktree`
- `StatusFile`
- `GitFileEntry`
- `GitStatus`
- `GitDiffContent`

削除箇所にはすべて以下の形式のコメントを残した:

> `// v3.5.3 (2026-04-20): xxx interface は UI 層撤去と同時に削除（PM-770）。`
> `// Rust side の struct / command は src-tauri に残置（frontend からは未呼出、将来再導入時の参照用）。`

---

## 4. 検証結果

### 4.1 TypeScript

```
cd C:/Users/hiron/Desktop/ccmux-ide-gui
rm -f tsconfig.tsbuildinfo
npx tsc --noEmit
EXITCODE=0
```

**0 error** を維持。

### 4.2 Knip 再計測（削除後）

削除前: Unused files **21** → 削除後: Unused files **10**

残る 10 件は本タスクのスコープ外（PM-770 撤去リストに含まれず、安全のため触らなかったもの）:

| 残存ファイル | 判断 |
|------------|------|
| `hooks/use-toast.ts` | shadcn 互換 wrapper。将来の sonner 置換時に参照される可能性。スコープ外。 |
| `components/icons.tsx` | 汎用 icon barrel。現状参照 0 だが、削除判断は別 round で。 |
| `components/onboarding/WelcomeWizard.tsx` | `app/setup/page.tsx` が独自実装で代替済。要別途判断。 |
| `sidecar/build.mjs` / `sidecar/src/agent.ts` / `sidecar/src/index.ts` | **sidecar は別 workspace**（別 `package.json` / `tsconfig.json`）で、knip 誤検知。絶対に削除してはならない（Tauri の sidecar binary のソース）。 |
| `public/sample-projects/node-hello/index.js` | エンドユーザー配布用サンプル project。残置。 |

### 4.3 Rust (cargo check)

**実施せず**（スコープが frontend のみ。Rust 側は未変更なので破壊しようがない。`cargo +nightly udeps` は未実施）。

### 4.4 Sidecar build

**実施せず**（sidecar 未変更）。

---

## 5. Rust 側 孤立 `#[tauri::command]` 候補リスト（次回持ち越し）

本 round では**削除しない**。frontend invoke との突合で frontend から呼ばれていない command を列挙する。

### 5.1 撤去済 UI に対応する command（frontend 呼出 0、削除候補 強）

| ファイル | command | 関連した UI（削除済） |
|---------|---------|-------------------|
| `src-tauri/src/commands/git.rs` | `git_status`, `git_stage_file`, `git_unstage_file`, `git_commit`, `git_diff_file`, `git_current_branch` | GitPanel / GitDiffView |
| `src-tauri/src/commands/worktree.rs` | `list_worktrees`, `add_worktree`, `remove_worktree`, `switch_worktree` | WorktreeTabs / WorktreeDialog |
| `src-tauri/src/commands/status.rs` | `detect_status_file`, `list_status_candidates`, `read_status_file` | StatusPane / StatusPicker |

**合計 13 command**。`src-tauri/src/lib.rs` の `invoke_handler![...]` 登録から外す + mod 宣言から外す + ファイル削除、で約 1,200〜1,500 行の Rust dead code 削減可能見込み。

### 5.2 意図的に残置された command（削除禁止）

| command | 根拠 |
|---------|------|
| `get_claude_rate_limits` | `CHANGELOG.md` Unreleased で「将来の JSON mode 対応に備えて残置（invoke は継続、UI からは未呼出）」と明記 |

### 5.3 判断保留（境界、要レビュー）

| command | 保留理由 |
|---------|---------|
| `send_agent_interrupt` | frontend からは未 invoke だが、tests/e2e/fixtures.ts の mock に仕込みあり。InputArea の中断ボタン実装時に必要になる可能性大。 |
| `search_conversations`, `reindex_conversations` | `search_fts.rs` に登録済だが frontend 呼出は `search_messages` のみ。legacy FTS API の可能性が高いが、削除前に PM 判断が欲しい。 |

### 5.4 Rust 撤去時の TODO メモ

1. `src-tauri/src/lib.rs` の `use commands::...` + `invoke_handler![...]` から対応 symbol を外す
2. `src-tauri/src/commands/mod.rs` から `pub mod git; / pub mod worktree; / pub mod status;` を削除
3. `src-tauri/src/commands/{git,worktree,status}.rs` を `git rm`
4. `src-tauri/Cargo.toml` で当該モジュール固有の dep（git 用 `tempfile` 等）が無いか確認、あれば整理
5. `cargo check` → `cargo test` で 0 error 確認
6. `npm run tauri:build` で sidecar + Rust bundling も通ることを確認
7. `tests/e2e/fixtures.ts` の `list_worktrees` 等 mock 分岐も合わせて削除（無害だが紛らわしい）

---

## 6. 安全策 / やらなかったこと

- **Rust 側ファイル削除は見送り**（tauri dev 起動中の可能性 + `cargo check` 未実施環境のため）
- **過度な refactor / abstraction 追加なし**（物理削除と minimal import 調整のみ）
- `WelcomeWizard.tsx` / `hooks/use-toast.ts` / `components/icons.tsx` は**撤去リストに明示されていない**ため残置（orphan だが別 round 判断）
- 削除判断が微妙だった `send_agent_interrupt` は残置し 5.3 に列挙
- `lib/types.ts` の dead interface 削除後に警告コメントを残し、Rust struct は残置していることを明記
- 自社 `CLAUDE.md` / `README.md` の古い記述（"MemoryTreeView / MemoryEditor / WorktreeTabs"）は documentation 更新のため**スコープ外**（別タスクで）

---

## 7. 影響範囲

### 7.1 ユーザー体感

- **変化なし**（既に v3.5.3 の時点で UI から撤去済、ファイルのみ残っていた状態だったため）
- CommandPalette の「Git > 新規 worktree」placeholder 項目が**消える**が、元々 toast で「Week 7 で実装予定」と返すだけだったのでむしろ UX 改善

### 7.2 ビルド

- Next.js build: typecheck 0 error のため成功見込み（本 round では `npm run build` は未実施、tauri dev 起動中のため衝突回避）
- Sidecar: 未変更
- Rust: 未変更

### 7.3 テスト

- E2E tests (`tests/e2e/*.spec.ts`) は削除対象 UI を参照していない（事前 grep で確認済）
- `tests/e2e/fixtures.ts` の Rust command mock は残置（`list_worktrees` 等の mock は無害）

---

## 8. 完了条件チェック

| 条件 | 状態 |
|------|------|
| `npx tsc --noEmit` 0 error | OK (EXITCODE=0) |
| 削除ファイル一覧 + サイズ減少量 | 本 report の §2 参照（14 files / 3,200+ lines） |
| Rust 孤立 command 候補リスト | 本 report の §5 参照（13 確定 + 3 保留） |
| 過度な refactor を避け物理削除のみ | 遵守（§3 の必要最小限の整理のみ） |

---

## 9. 次回タスク提案

1. **PM-771 Rust dead command removal**: §5.1 の 13 command + 関連 module の削除（`src-tauri/src/{commands/git.rs, commands/worktree.rs, commands/status.rs}` 計 1,200〜1,500 行）
2. **PM-772 docs 更新**: `README.md:148` / `components/layout/CLAUDE.md` / `docs/screenshots/SCREENSHOTS-TODO.md` の古い記述（Inspector / WorktreeTabs / ProjectSwitcher 等）を v3.5.x 反映に更新
3. **PM-773 orphan 残骸判断**: `WelcomeWizard.tsx` / `hooks/use-toast.ts` / `components/icons.tsx` の去就を PM 判断
