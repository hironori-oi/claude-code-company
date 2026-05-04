# CEO smoke re-handoff (AS-HOTFIX-QW6 後) — 2026-05-05

## 1. 状況サマリー

| Phase | 状態 |
|---|---|
| AS-HOTFIX-QW6 実装 + 検証 | **完了** (commit `7d488f5`、本日 origin/main push 済) |
| DEC-018-047 ⑫ 追記 | 完了 (claude-code-company 側 commit 本依頼書と同時実施) |
| オーナー再 smoke | **未実施 (本依頼)** |
| DEC-018-048 (M2 QW 完成宣言再発行) | オーナー smoke PASS 待ち (QW5 + QW6 累積) |

## 2. 前回 smoke (2026-05-05 朝、QW5 後) の確認結果

オーナー報告:
- Q1: stuck 継続 → (a)「認証 確認中」5min+ stuck、(b)「再接続中... (1/3)」無限 stuck
- Q2: Step 0 (`Remove-Item history.db*`) 未実施 → **stale DB が QW5 修正で安全に開けた事実上の real-world 検証 PASS**

QW5 自体 (DB 経路) は実環境で機能していたが、上位 UI バッジ 2 件が新規露呈。本書はその 2 件を解消する QW6 の検証依頼。

## 3. 何を直したか — AS-HOTFIX-QW6

### 真因 2 件

#### (a) AuthWatchdog の固定 interval sleep — 起動直後の死角

| 旧設計 | 影響 |
|---|---|
| `interval(5min)` で `tick().await` → poll 全 active sidecar → sleep | smoke env (`ASAGI_SIDECAR_IDLE_TIMEOUT_MS=10000`) で sidecar が初回 poll 前に消える |
| 新規 spawn された sidecar も次 tick (最大 5min) まで poll されない | UI 起動直後は永久に「認証 確認中」表示 |

#### (b) Retry loop の成功完了通知 event 欠落

| 旧設計 | 影響 |
|---|---|
| 失敗ごとに `on_attempt(SpawnAttempt { last_error: Some(...) })` emit | frontend `useSpawnRetry` は失敗を受信して `'retrying'` に遷移 |
| 成功で抜けたときの完了通知が無い | バッジは `clear()` 手動呼び出しが無い限り永久に「再接続中... (1/3)」 |

### 修正内容

#### Rust (src-tauri)

1. **`SpawnAttempt` struct に `success: bool` 追加** (`retry.rs`)
   - 既存 4 フィールド + 新規 1。retry loop 終了時のみ `true` で 1 回 emit

2. **`spawn_for_with_retry_factory` 成功 branch** (`multi.rs`)
   - `Ok(created)` の前に `on_attempt(SpawnAttempt { success: true, last_error: None, next_sleep_ms: None, ... })` を 1 回 emit
   - 失敗 branch (既存) は `success: false` で互換維持

3. **`AuthWatchdog::start()` を adaptive tick 化** (`auth_watchdog.rs`)
   - tick 周期: `min(interval, 1sec).max(100ms)` で sleep
   - per-pid `last_poll: HashMap<String, Instant>` で実 poll 間隔は interval を維持
   - 新規 spawn された sidecar は次 tick (最大 1sec) で `last_poll` not found → 即 poll
   - 削除された sidecar は `last_poll.retain(|k, _| active.contains(k))` で GC

4. **`SpawnAttemptEventPayload` に `success` フィールド追加** (`commands/codex.rs`)
   - `From<SpawnAttempt>` に追加、既存全 emit pass-through

#### TypeScript (src/lib/codex)

5. **`SpawnAttemptEvent` interface に `success: boolean` 追加** (`schemas.ts`)
   - validator: `typeof x.success === 'boolean' ? x.success : false` で旧 payload 互換

6. **`useSpawnRetry` hook の auto-reset 経路** (`use-spawn-retry.ts`)
   - event handler 先頭で `if (p.success) { setLast(null); setStatus('idle'); return; }`
   - `clear()` 関数は引き続き公開 (UI 側の手動 reset 経路として保持)

#### Smoke 可視化 (scripts)

7. **`smoke-m2-qw.ps1` に `ASAGI_AUTH_POLL_INTERVAL_MS=2000`** 追加
   - 5min → 2sec で認証 state 遷移を smoke 期間中に観察可能

### 新規テスト

| Layer | テスト | 検証内容 |
|---|---|---|
| Rust | `retry_emits_success_event_after_recovery` | retry → 成功で `success=true` event が 1 回だけ emit |
| Rust | `test_start_loop_picks_up_newly_spawned_sidecar_within_tick` | 起動後に spawn された sidecar が 1 tick 以内に poll される |
| TS | `success=true event を受け取ったら status を idle に reset する` | success event で badge auto 消失 |
| TS | `旧サーバ payload (success フィールド欠落) は false で fallback` | 互換性 |

### 検証結果

| Test | 結果 |
|---|---|
| `cargo test --lib --no-default-features` | **97/0/1 PASS** (95 → 97、+2 = 上記 Rust 2 件) |
| `cargo clippy --no-default-features --lib -- -D warnings` | **clean** |
| `cargo fmt --check` | **clean** |
| `pnpm vitest run` | **68/68 PASS** (66 → 68、+2 = 上記 TS 2 件) |

## 4. オーナー再 smoke 手順 (5〜7 分目安)

### Step 0: stale DB の完全クリーンアップ (推奨)

QW5 で半壊 DB は安全に recover するが、完全クリーン状態から検証するため:

```powershell
Remove-Item "$HOME\.asagi\history.db*" -Force -ErrorAction SilentlyContinue
```

`history.db` / `history.db-wal` / `history.db-shm` が存在すれば削除。Not found エラーは無視可。

### Step 1: smoke 起動

```powershell
cd C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-018\app\asagi-app
.\scripts\smoke-m2-qw.ps1
```

PowerShell の `.\` prefix は必須。

### Step 2: 起動 log 確認 (30 秒以内)

PowerShell コンソールに以下が順次表示されることを確認:

| # | 期待 log | 由来 |
|---|---|---|
| 1 | `opening sqlite at C:\Users\hiron/.asagi\history.db` | (db.rs 共通) |
| 2 | 「PRAGMA journal_mode = WAL failed」エラーが出ない | QW5 |
| 3 | `Asagi database initialized successfully` | QW3 + QW5 |
| 4 | `Sidecar idle reaper started` | QW2 |
| 5 | `AuthWatchdog started` | QW2 + QW6 (tick 周期: 1000ms 以下が望ましい) |

### Step 3: アプリウィンドウで確認 (6 シナリオ)

#### シナリオ A — Sessions タブ「DB 未接続」が消える (QW5 既存検証)

- Sidebar 左「セッション」タブをクリック
- **期待**: 「DB 未接続」表示が無い

#### シナリオ B — メッセージ保存成功 (QW5 既存検証)

- 「+ 新規セッション」で session 作成 → タイトル入力 → 保存
- chat 入力欄に「テスト」と入力 → Enter
- **期待**: 「メッセージ保存に失敗しました」toast が出ない、user message + mock assistant response が表示

#### シナリオ C — 認証期限警告 toast (DEC-018-046 既存)

- 起動から 30 秒以内 (smoke env で expiry = 10min、threshold 30min)
- **期待**: 「認証の期限が近づいています」warning toast 表示

#### シナリオ D — idle reaper 動作 (DEC-018-046 既存)

- chat 1 通送信 → そのまま 15 秒待機 (smoke env で idle threshold 10sec)
- **期待**: PowerShell コンソールに `Sidecar idle reaper killed sidecar for project_id` 系 log

#### ★シナリオ E — 認証バッジが 5 秒以内に確定 (QW6 新規メイン: 真因 a)★

- 起動直後、画面右上または status bar に「認証 確認中」バッジ表示
- **期待**: **5 秒以内に**「認証 OK」または「認証期限警告」または「認証エラー」のいずれかに置換
  - smoke env の `ASAGI_AUTH_POLL_INTERVAL_MS=2000` (2sec) + tick (1sec) で最大 3sec 内に poll される設計
  - 余裕を見て 5 秒
- **NG**: 5 秒以上「認証 確認中」のまま → CEO に screenshot + PowerShell log

#### ★シナリオ F — 再接続バッジが 2 秒以内に消失 (QW6 新規メイン: 真因 b)★

- chat に「テスト」入力 → 送信時に「再接続中... (X/3)」バッジが表示されることがある
- **期待**: 表示された場合、**Codex 接続成功と同時 (= 2 秒以内) にバッジ消失**
  - 旧設計 (QW6 前) ではこのバッジが永久に残っていた
- **NG**: バッジが 5 秒以上残る → CEO に screenshot + PowerShell log

### Step 4: 終了 + 報告

- ウィンドウ右上 × でクローズ → PowerShell コンソールも閉じる
- 結果を以下の形式で CEO に報告:

```
シナリオ A: PASS / FAIL
シナリオ B: PASS / FAIL
シナリオ C: PASS / FAIL
シナリオ D: PASS / FAIL
シナリオ E (★QW6 真因 a): PASS / FAIL
シナリオ F (★QW6 真因 b): PASS / FAIL (※ そもそも再接続バッジが出なければ N/A 可)
Step 2 起動 log 5 項目: 1✓ 2✓ 3✓ 4✓ 5✓
所感: (任意)
```

**シナリオ F の N/A 補足**: smoke env では Codex 接続が初回成功する想定で、retry が発火しないことがある。その場合は「F: N/A (retry 発火せず)」で OK。E が PASS であれば auth 経路は確認できる。

## 5. PASS 後の流れ

1. 全シナリオ PASS (or N/A 妥当) 確認
2. CEO が DEC-018-048 起票 (M2 QW Phase 完成宣言の再発行)
3. M2.1 メイン Phase F2/F5/F6/F7 着手承認 (PM (Tomoe) WBS 起票へ)

## 6. FAIL 時の流れ

| FAIL シナリオ | 想定真因 | 次アクション |
|---|---|---|
| A / B | QW5 retreat | 即中断、PowerShell log 全文を CEO へ |
| C | smoke env の AUTH_TTL_MS / WARN_THRESHOLD_MS 設定問題 | env vars 確認 + 再起動 |
| D | idle reaper の sidecar map 同期問題 | PowerShell log 全文を CEO へ |
| ★E | QW6 watchdog tick が回っていない / poll_one fail | PowerShell log 全文 + tick 周期 log 確認 |
| ★F | success event emit されない / frontend 受信 fail | PowerShell log 全文 + DevTools console (F12) 確認 |

FAIL 時は AS-HOTFIX-QW7 起票 → 真因分析 → Dev (Yuto) 派遣 → 再 verification → 再 hand-off。

DEC-018-047 厳守事項 ⓖ により、CEO smoke 単独では完成宣言できない。オーナー smoke PASS が必須。

## 7. 連絡事項

- **commit `7d488f5`** (asagi-app) は origin/main に push 済 (本依頼書発行時点)
- DEC-018-047 ⑫ 追記の commit (claude-code-company) は本依頼書 push と同時に実施
- AS-CLEAN-17 (terminal state event pattern contract — success/failure 完了通知 event の必須化を contract.rs に明文化) は M2.1 着手前評価対象として DEC-018-047 ⑫ 内に記録済

---

ご確認・ご検証をお願いします。
