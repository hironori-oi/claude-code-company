# Asagi M2 Quick Win Phase — オーナー手動 smoke チェックリスト (改訂版 v2)

- **対象 commit**: `78ad7fe` (AS-HOTFIX-QW3 + QW4、main HEAD) ← `a54f1b1` (QW1) + `7f656ac` (QW2) を含む
- **対象 DEC**: DEC-018-047 (CEO smoke 必須化 + 厳守事項 ⓕⓖⓗ 追加 + DEC-018-046 を CONDITIONAL HOLD)
- **想定所要時間**: 約 120 秒 (アプリ起動 60〜90 秒 + 実 smoke 30〜60 秒)
- **必要環境**: Windows 11 + PowerShell 5.1 / pnpm 既導入 / **Codex CLI は不要** (mock mode)
- **CEO 自動検証済**: cargo test 92/0/1 + vitest 66/66 + cargo fmt clean + Playwright 12/12 PASS
- **CEO 手動 smoke 済**: 本 hand-off 前に CEO 自身が `reports/ceo-smoke-pre-handoff-2026-05-03.md` に納品

---

## 改訂理由 (v1 → v2)

v1 (2026-05-03 初版) で見逃していた以下 3 経路を Step 0/A2/C2 として追加:

1. **DB 初期化が成功していること** = AS-HOTFIX-QW3 の根本原因 (`fts5_version()` → `fts5_source_id()`) が実機 setup() 経路で動作している証跡
2. **idle reaper task が起動していること** = AS-HOTFIX-QW2 (`tauri::async_runtime::spawn` ラップ) が動作している証跡
3. **再ログイン CTA 連打 → console error 0 件** = AS-HOTFIX-QW4 (frontend debounce + Rust lazy spawn fallback) が両側で動作している証跡

v1 は cargo test 緑化を完成判定の根拠としていたが、**Tauri 2 runtime context 経路は cargo unit test では 100% 検出不可** (DEC-018-047 厳守事項 ⓖ)。本 v2 は実機 smoke でしか検出できない経路を 100% 視覚的に確認する設計。

---

## Step 0 — 起動 + DB / idle reaper 起動 sanity check (オーナー手数 1 回 + ログ目視 1 回)

### 操作

`projects/PRJ-018/app/asagi-app/scripts/smoke-m2-qw.ps1` を **PowerShell で実行**。

方法のいずれか:
- **A**: ファイルマネージャで右クリック → 「PowerShell で実行」
- **B**: PowerShell を開いて以下:
  ```powershell
  cd "C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-018\app\asagi-app"
  .\scripts\smoke-m2-qw.ps1
  ```

スクリプトが自動で:
- 短縮 env 5 件 (idle 30min→10sec / reaper 60s→2sec / mock expiry 10min) を設定
- mock mode 明示
- `pnpm tauri:dev` を起動

**初回は 60〜90 秒かかります** (Rust 再ビルド分)。2 回目以降は ~20 秒。

### 観察ポイント (PowerShell コンソールに流れる Tauri 起動 log を目視)

| 観察 | 期待 (PASS 条件) | 失敗時の意味 |
|---|---|---|
| ① `INFO asagi_lib: opening sqlite at ...\.asagi\history.db` | 1 行表示される | DB path 解決失敗 = AS-HOTFIX-QW3 退化 |
| ② `INFO asagi_lib: Asagi database initialized` | 1 行表示される (失敗時は `ERROR ... failed to initialize database: ...`) | **DB 初期化失敗 = AS-HOTFIX-QW3 退化、smoke 中断** |
| ③ `INFO asagi_lib: Sidecar idle reaper started (default 30min threshold)` | 1 行表示される (短縮 env 適用時は値が変わる場合あり) | **idle reaper 未起動 = AS-HOTFIX-QW2 退化、smoke 中断** |
| ④ `INFO asagi_lib: AuthWatchdog started (default 5min polling)` | 1 行表示される | watchdog 未起動 = DEC-018-046 設計優位点 ⓒ 退化 |
| ⑤ `panicked at` / `tokio::spawn called from outside of a Tokio 1.x runtime` | **絶対に出ないこと** | runtime 未配線 = AS-HOTFIX-QW2 退化 |

アプリウィンドウが開いて Welcome ウィザード or 既存 Project rail が見えたら次へ。

### 失敗時

- ② が出ず ① だけ → AS-HOTFIX-QW3 退化、`db.rs::fts5_supported` を確認
- ③ が出ず panic → AS-HOTFIX-QW2 退化、`lib.rs::run` の `tauri::async_runtime::spawn` ラップを確認
- どちらも CEO に「Step 0 で fail、log 添付」と即報告 → 後続 Step 中断

---

## Step A (約 30 秒) — Smoke A: idle auto-shutdown + lazy spawn (DB 接続経由)

### 操作

1. 任意のプロジェクトを開く (なければ新規作成、Welcome を進める)
2. **Sidebar Sessions tab を開く** = 「セッション一覧の取得に失敗しました（DB 未接続）」が表示されないことを確認 (AS-HOTFIX-QW3 視覚証跡)
3. チャット入力欄に何でも一文 (例: `hello`) → Enter で送信
4. mock 応答が表示されたら **タブを切替えて 12 秒放置** (chat エリア何も触らない)
5. 12 秒経過後、もう一度同じプロジェクトに戻り、再度 `hello` を送信

### 観察ポイント

| 観察 | 期待 (PASS 条件) | 失敗時の意味 |
|---|---|---|
| ① Sidebar Sessions tab | 「DB 未接続」エラーが**表示されない** (空 list なら OK) | AS-HOTFIX-QW3 退化 |
| ② 12 秒放置中 | ChatStatusBadge が `idle` 表示 → さらに数秒で sidecar 自動 shutdown (内部状態、肉眼では見えなくて OK) | AS-202.1 退化 |
| ③ 12 秒後の 2 回目送信 | **一瞬「lazy-spawning」表示**が出てから ready → 応答が返る (badge に `data-lazy-spawning` 属性 or 浅葱バッジ) | AS-202.2 / AS-HOTFIX-QW4 退化 |
| ④ DevTools (任意) | F12 → Console タブで `agent:*:idle-shutdown` 通知、続けて `agent:*:lazy-spawn` 通知が観測される | event prefix 退化 |

### 失敗時

- ① が NG → AS-HOTFIX-QW3 退化、CEO 報告
- ② が起きない → idle reaper 未起動 (Step 0 で見逃した可能性)、CEO 報告
- ③ で lazy-spawning 表示出ず即座に応答 → 1 回目の sidecar が生きていた (idle threshold 超過してない、もう少し待つ) — fail ではない

---

## Step B (約 15 秒) — Smoke B: 期限警告 toast + 再ログイン CTA (M-1 hotfix)

### 操作

1. (Step A の続きで OK、リロード不要) チャット画面右上 (or サイドバーの auth エリア) を見る
2. 約 5〜10 秒以内に **黄色のドット + 「あと X 分」+ 「再ログイン」CTA ボタン** が表示される (mock の expiry が 10 分後なので警告閾値 30 分以内 → 即発火)

### 観察ポイント

| 観察 | 期待 (PASS 条件) |
|---|---|
| ① 黄色ドット | 表示される (`data-expiry-warning="true"` 属性) |
| ② 「あと N 分」テキスト | 「あと **9** 分」または「あと **10** 分」が表示 (秒単位差分は許容) |
| ③ 「再ログイン」CTA | クリック可能 (押すと OAuth ブラウザが開こうとするが、押さなくて OK) |
| ④ aria-live | DevTools Elements で `role="alert"` + `aria-live="polite"` が確認できる (任意) |

---

## Step C (約 30 秒) — Smoke C: 「再ログイン」CTA 連打 → debounce 500ms + lazy spawn (AS-HOTFIX-QW4 視覚証跡)

### 操作

1. **F12 で DevTools を開く** → Console タブに切替 + Network タブも開く (任意)
2. **Console タブをクリア** (clear ボタンで既存 log を一掃)
3. **「再ログイン」CTA を 1 秒以内に 5 回連打**
4. 10 秒待つ (debounce 完了 + lazy spawn 完了猶予)
5. Console タブのログを目視確認

### 観察ポイント

| 観察 | 期待 (PASS 条件) | 失敗時の意味 |
|---|---|---|
| ① console error 件数 | **0 件** (`[auth-badge] openLogin failed: no sidecar for project_id` が**1 件も出ない**) | AS-HOTFIX-QW4 frontend / Rust いずれか退化 |
| ② OAuth ブラウザ起動回数 | 5 個開かない (1 個または 0 個、Windows shell が起動拒否しても OK) | frontend debounce 退化 |
| ③ DevTools Network | `auth/login/start` 関連 IPC が 1 回のみ | frontend debounce 退化 |
| ④ Tauri log (PowerShell) | sidecar が居ない場合 `agent:{pid}:lazy-spawn` event emit が観測される (sidecar が生きていた場合は観測されない、どちらも OK) | lazy spawn fallback 退化 |

### 失敗時 (v1 で見逃した本丸)

- ① で `[auth-badge] openLogin failed` が出る → AS-HOTFIX-QW4 退化:
  - error メッセージが `no sidecar for project_id: ...` → Rust 側 `ensure_sidecar_with_lazy_spawn` 退化
  - error メッセージが別の内容 → 別経路の bug (CEO 報告 + log 全文添付)
- ② で 5 個開く → frontend debounce 退化、`use-auth-watchdog.ts::openLogin` の 500ms timeout を確認

---

## Step D — 終了 + 報告

1. アプリウィンドウ右上 × でクローズ
2. PowerShell コンソールも閉じる (env vars はプロセスローカルなので残らない)
3. 結果を以下フォーマットで CEO に報告:

```
Step 0: PASS / FAIL  (※ ① ② ③ ④ ⑤ どれが NG か)
Step A: PASS / FAIL  (※ ① ② ③ ④ どれが NG か)
Step B: PASS / FAIL  (※ ① ② ③ ④ どれが NG か)
Step C: PASS / FAIL  (※ ① ② ③ ④ どれが NG か、5 連打で何回 console error が出たか)
所感: (任意、あれば)
```

CEO はこれを `reports/owner-smoke-m2-qw-2026-05-03.md` に転記し、全 Step PASS であれば DEC-018-048 (M2 QW Phase 完成宣言再発行) を起票 → PM (Tomoe) へ M2.1 (F2/F5/F6/F7) 設計発注に移行します。

---

## 補足: 改訂前 (v1) との差分まとめ

| 項目 | v1 | v2 (本版) |
|---|---|---|
| Step 0 ログ目視 | なし | **DB 初期化 + idle reaper 起動 + tokio panic 不在を 5 項目目視** |
| Step A 観察 ① | なし | **Sidebar Sessions tab で「DB 未接続」が出ないことを視覚確認** (AS-HOTFIX-QW3) |
| Step C 観察 ① | console invoke ログ件数を「1 回だけ」 | **console error 件数 = 0** (`[auth-badge] openLogin failed` が 1 件も出ない) |
| Step C 観察 ④ | なし | **Tauri log で `agent:{pid}:lazy-spawn` emit が観測される** (AS-HOTFIX-QW4 lazy spawn fallback 視覚証跡) |
| 対象 commit | `a54f1b1` (QW1 のみ) | `78ad7fe` (QW1 + QW2 + QW3 + QW4 全部) |
| 対象 DEC | DEC-018-046 完成宣言確定 | **DEC-018-047** (CONDITIONAL HOLD + 厳守事項 ⓕⓖⓗ + smoke PASS 後に DEC-018-048 で再発行) |

---

## 補足: なぜ Smoke 'spawn retry 3 回' (AS-201) が含まれていないか

R-QW-2 (retry storm) mitigation は以下で完全充足済のため、視覚的 smoke は省略:

- cargo `retry_succeeds_on_second_attempt` + `retry_exhausts_after_max_attempts` + 4 timer mock tests = 6 テスト全 PASS
- vitest `use-spawn-retry.test.ts` 4 ケース PASS
- `retry.rs` 5 unit tests (range/cap convergence/jitter stdev>5.0/contract const 一致/concurrent safe) PASS
- `SPAWN_RETRY_MAX=3` golden test (AWS pseudo-rust max=5 汚染防止) PASS
- Review (Hayato) 検収で B-2 PASS (数学的妥当性 + テスト固定化を認定)

視覚的 smoke を行うには Codex CLI を一時的に PATH から外す or 偽パス指定が必要で、オーナー手数が増えるためトレードオフ判断で省略。M3 で `tauri-driver` 導入時に E2E `@spawn-retry-driver` 専用 spec を追加予定 (AS-CLEAN-13 系列)。

---

**所要時間目安**: Step 0〜D で **合計 120 秒** (アプリ起動 60〜90 秒 + 実 smoke 30〜60 秒)。
**オーナー手数**: スクリプト 1 回実行 + Step 0 ログ目視 + Step A〜C のクリック合計 **10 回程度**。
**改訂日**: 2026-05-03 (DEC-018-047 起票直後、CEO smoke 着手前)。
