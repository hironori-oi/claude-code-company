# CEO smoke re-handoff (AS-HOTFIX-QW5 後) — 2026-05-03 17:55

## 1. 状況サマリー

| Phase | 状態 |
|---|---|
| AS-HOTFIX-QW5 実装 + 検証 | **完了** (commit `bc1a6c9`、本日 17:55 push 待機中) |
| DEC-018-047 ⑪ 追記 | 完了 (claude-code-company 側 commit 待ち) |
| オーナー再 smoke | **未実施 (本依頼)** |
| DEC-018-048 (M2 QW 完成宣言再発行) | オーナー smoke PASS 待ち |

## 2. 何を直したか — AS-HOTFIX-QW5

### 真因 (1 行)

`PRAGMA journal_mode = WAL;` は新 mode 名 ("wal") を **結果として返す** ため、
rusqlite の `execute_batch` が "Execute returned results" で fail し、
init_database() 全経路が Err 返却 → state.db = None → UI 全 DB 機能停止。

### AS-HOTFIX-QW3 との関係 — pattern bug の隣接 2 件目

| Step | bug | 修正 |
|---|---|---|
| AS-CLEAN-09 | `bundled` 単独で FTS5 無効化 | `bundled-full` に変更 |
| AS-HOTFIX-QW3 | `SELECT fts5_version()` (関数が SQLite に存在しない) を `execute_batch` | `fts5_source_id()` + `query_row` |
| **AS-HOTFIX-QW5** | **`PRAGMA journal_mode = WAL` (値返す) を `execute_batch`** | **`query_row` で値受信 + warn fallback** |

**3 段重ね同型バグ**。QW3 で fts5 sanity を pass させた結果、初めて隣接 6 行内の WAL PRAGMA に到達して fail を露出させた。

### 修正内容

1. **db.rs 実装**
   - `init_database()` を `init_database_at(path: &Path)` に refactor (test から呼べる純粋化)
   - WAL PRAGMA: `query_row` で値受信、"wal" 確認、Windows + 一部 FS で fallback でも warn ログのみで継続
   - synchronous / foreign_keys: `execute` (値返さない)

2. **db.rs テスト強化** (新規 3 件、合計 5 db tests)
   - `init_database_at_fresh_path_succeeds` — tempfile DB 初回 init 全経路
   - `init_database_at_stale_empty_db_recovers` — オーナー環境の 4096-byte 半壊状態を再現
   - `init_database_at_double_init_is_idempotent` — アプリ再起動経路の冪等性

3. **clippy clean-up** (HEAD 78ad7fe で pre-existing 5 件 + 自分の 3 件 = 8 件)
   - mock.rs / protocol.rs doc list overindented (4)
   - commands/mod.rs `loop { match ... }` → `while let` (1)
   - db.rs (3 = 自分の追加分)

### 検証結果

| Test | 結果 |
|---|---|
| `cargo test --lib --no-default-features` | **95/0/1 PASS** (90 → 95、+5 = 既存 db 2 + 新規 db 3) |
| `cargo clippy --no-default-features -- -D warnings` | **clean** (8 → 0) |
| `cargo fmt --check` | **clean** |
| `pnpm vitest run` | **66/66 PASS** (15 ファイル) |

## 3. オーナー再 smoke 手順 (5 分目安)

### Step 0: stale DB の完全クリーンアップ (推奨、再現性確保)

QW5 適用後は半壊 4096-byte DB も安全に開けるが、完全クリーン状態から検証するため:

```powershell
Remove-Item "$HOME\.asagi\history.db*" -Force -ErrorAction SilentlyContinue
```

`history.db` / `history.db-wal` / `history.db-shm` が存在すれば削除。Not found エラーは無視可。

### Step 1: smoke 起動

PowerShell で以下のいずれか:

```powershell
# パターン A: scripts/ から
cd C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-018\app\asagi-app\scripts
.\smoke-m2-qw.ps1

# パターン B: app root から
cd C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-018\app\asagi-app
.\scripts\smoke-m2-qw.ps1
```

PowerShell の `.\` prefix は必須 (security default で current location 実行が制限されているため)。

### Step 2: 起動 log 確認 (Step 0 — 30 秒以内)

PowerShell コンソールに以下 5 つが順次表示されることを確認:

| # | 期待 log | AS-HOTFIX 由来 |
|---|---|---|
| 1 | `opening sqlite at C:\Users\hiron/.asagi\history.db` | (db.rs:54 共通) |
| 2 | **「PRAGMA journal_mode = WAL failed」エラーが出ない** | **QW5 (今回)** |
| 3 | `Asagi database initialized successfully` | QW3 + QW5 |
| 4 | `Sidecar idle reaper started` | QW2 |
| 5 | `AuthWatchdog started` | QW2 (元から正常) |

**「PRAGMA journal_mode = WAL failed」「Execute returned results」のいずれかが出たら即中断**して CEO に報告。

### Step 3: アプリウィンドウで確認 (4 シナリオ × 30 秒)

#### シナリオ A — Sessions タブ「DB 未接続」が消える (QW5 メイン)

- Sidebar 左「セッション」タブをクリック
- **期待**: 「DB 未接続」表示が **無い**、空セッションリストまたは「最初のセッションを作成」CTA
- **NG**: 「DB 未接続」表示が残る → CEO に screenshot 送付

#### シナリオ B — メッセージ保存成功 (QW5 メイン)

- 「+ 新規セッション」で session 作成 → タイトル入力 → 保存
- chat 入力欄に「テスト」と入力 → Enter
- **期待**: 「メッセージ保存に失敗しました」toast が **出ない**、chat に user message + mock assistant response が表示
- **NG**: 失敗 toast が出る → CEO に PowerShell コンソール log + screenshot 送付

#### シナリオ C — 認証期限警告 toast (DEC-018-046 既存)

- 起動から 30 秒以内 (smoke env で expiry = 10min、threshold 30min)
- **期待**: 「認証の期限が近づいています」warning toast 表示

#### シナリオ D — idle reaper 動作 (DEC-018-046 既存)

- chat 1 通送信 → そのまま 15 秒待機 (smoke env で idle threshold 10sec)
- **期待**: PowerShell コンソールに `Sidecar idle reaper killed sidecar for project_id` 系 log

### Step 4: 終了 + 報告

- ウィンドウ右上 × でクローズ → PowerShell コンソールも閉じる
- 結果を以下の形式で CEO に報告:

```
シナリオ A: PASS / FAIL (FAIL なら screenshot)
シナリオ B: PASS / FAIL (FAIL なら screenshot + PowerShell log 全文)
シナリオ C: PASS / FAIL
シナリオ D: PASS / FAIL
Step 2 起動 log 5 項目: 1✓ 2✓ 3✓ 4✓ 5✓
所感: (任意)
```

## 4. PASS 後の流れ

1. 全シナリオ PASS 確認
2. CEO が DEC-018-048 起票 (M2 QW Phase 完成宣言の再発行)
3. M2.1 メイン Phase F2/F5/F6/F7 着手承認 (PM (Tomoe) WBS 起票へ)

## 5. FAIL 時の流れ

1. オーナー → CEO に screenshot + log 送付
2. CEO が AS-HOTFIX-QW6 起票 → 真因分析 → Dev (Yuto) 派遣
3. 修正 + 再 verification → 再 hand-off

DEC-018-047 厳守事項 ⓖ により、CEO smoke 単独では完成宣言できない。オーナー smoke PASS が必須。

## 6. 連絡事項

- **commit `bc1a6c9` は asagi-app local main にあるが未 push** — オーナー smoke 完了後に push 予定 (smoke fail なら hotfix を更に追加してから一括 push の方が history が綺麗)
- DEC-018-047 ⑪ 追記の commit は claude-code-company 側で本依頼書 push と同時に実施予定
- AS-CLEAN-16 (`execute_batch` × 値返す SQL を pattern grep で検出する pre-commit hook 検討) は M2.1 着手前評価対象として decisions.md に記録済

---

ご確認・ご検証をお願いします。
