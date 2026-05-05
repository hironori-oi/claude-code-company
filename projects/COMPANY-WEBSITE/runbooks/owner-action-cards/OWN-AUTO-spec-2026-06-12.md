# OWN-AUTO Spec: Owner Action Card 自動化検討仕様書

**対象**: Owner（hironori555@gmail.com） / Web-Ops 部門 / Dev 部門
**所有者**: Web-Ops 部門（仕様確定後 Dev 部門で実装）
**バージョン**: v0.1（Round 22 第 2 波 / Dev-KK 起票）
**親**: `INDEX.md`（OWN-PRE-01〜07 一望） / `../launch-pre-ops-checklist.md` §7
**関連**: `OWN-PRE-01`〜`OWN-PRE-07`（7 sub-card 全件）

---

## 0. 目的と Scope

Round 21 第 2 波で Web-Ops-H が物理化した **OWN-PRE-01〜07 7 sub-card**（Owner 公開前運用設定 / 合計 80 min）は、Owner が手動で Vercel Web UI / Sentry Dashboard / Supabase Dashboard / DNS レジストラ / 1Password / GitHub Settings / Slack を行き来する設計である。

本仕様書は、**各 sub-card の各 step を機械実行可能性別に分類**し、**API 経由で完全自動化 / 半自動化 / Owner 手動必須を切り分け**、Owner の拘束時間を **80 min → 推定 12-19 min** に圧縮する自動化方針を確定する。

### 自動化分類

| 区分 | 定義 | Owner 操作 |
|---|---|---|
| **A: 完全自動化** | API / CLI で人間操作 0 件で完遂可能 | 0 操作（CI / script 起動のみ） |
| **B: 半自動化** | スクリプトが事前準備 / 結果検証を実行、Owner は最終 confirm のみ | 1-2 click（confirm dialog） |
| **C: Owner 手動必須** | secret 取り出し / 物理 ToS / 30 min window 等で機械化不可 | 既存手順の継続 |

### 制約 (DEC-019-025 background dispatch SOP 準拠)

- 自動化 script は **secret 値を直接保持しない**（1Password CLI で都度取得、stdin pipe 経由）
- secret 露出経路は Owner の 1Password CLI（人間 ToS 認証）+ Owner CLI 端末のみ
- API 障害時の fail-closed: 全 step 失敗で旧手動手順 (OWN-PRE-XX) に fallback
- $0 cost 維持（Vercel / Supabase / Sentry の既存 plan に含まれる API のみ使用）
- script 実装は安全 API（execFileNoThrow / spawn 配列形式）のみ使用、shell 注入経路 0 を強制

---

## 1. OWN-PRE-01: Vercel Env GA4 + Sentry DSN 投入

### 1.1 step 別評価

| # | step | 自動化分類 | 機械実行手段 | Owner 拘束 |
|---|---|---|---|---|
| 1 | 1Password を開く | **C** | - | 1Password CLI auth (`op signin`) は Owner 必須 |
| 2 | GA4_ID を copy | **A** | `op item get` で password field 取得 | 0 |
| 3 | Vercel Env 画面へ | **A** | `vercel env ls production` | 0 |
| 4 | GA4 を Add | **A** | `vercel env add NEXT_PUBLIC_GA4_ID production` (stdin pipe) | 0 |
| 5 | Sentry DSN を copy | **A** | `op item get` で password field 取得 | 0 |
| 6 | Sentry を Add | **A** | `vercel env add NEXT_PUBLIC_SENTRY_DSN production` (stdin pipe) | 0 |
| 7 | CLI で確認 | **A** | `vercel env ls production` 結果を grep assertion (2 件) | 0 |
| 8 | Slack 投稿 | **A** | `curl -X POST $SLACK_WEBHOOK_URL` で完了通知 | 0 |

### 1.2 自動化提案

**実装パターン**: 単一 bash script `scripts/own-pre-01-auto.sh` (40 行想定)

- step 1-2: 1Password CLI から GA4_ID 値を取り出し、stdin pipe で Vercel CLI に直接渡す（変数経由なし = 露出経路最小化）
- step 3-6: Vercel CLI 経由で env add (production scope のみ)
- step 7: `vercel env ls production` を解析、2 件存在を assertion (失敗時 exit 1)
- step 8: 完了通知を Slack webhook へ POST

**Owner 拘束圧縮**: 10 min → **2 min**（`op signin` 1 min + script 起動・確認 1 min、API 呼出待ち含む）

### 1.3 Risk

- 1Password CLI auth の MFA は Owner 端末必須 → C 分類維持
- Vercel API rate limit (100 req/10s) は本件 4 req で問題なし
- script 失敗時は OWN-PRE-01 手動手順に fallback（pre-condition 不変）

---

## 2. OWN-PRE-02: Vercel Env Supabase 3 key 投入

### 2.1 step 別評価

| # | step | 自動化分類 | 機械実行手段 | Owner 拘束 |
|---|---|---|---|---|
| 1 | 1Password で 3 key 確認 | **C** | `op item list --vault prj-019-secrets` | 0 (auth は C) |
| 2 | SUPABASE_URL を Add (3 scope) | **A** | `vercel env add SUPABASE_URL` を 3 scope 分実行 | 0 |
| 3 | SUPABASE_ANON_KEY を Add (3 scope) | **A** | 同上 × 3 scope | 0 |
| 4 | SUPABASE_SERVICE_ROLE_KEY を Add (Production のみ) | **A** | `vercel env add SUPABASE_SERVICE_ROLE_KEY production` のみ | 0 |
| 5 | scope 隔離 CLI 確認 | **A** | preview / development scope に SERVICE_ROLE 不在を assertion | 0 |
| 6 | Production 全件確認 | **A** | production scope に Supabase 3 件存在を assertion | 0 |
| 7 | Slack 投稿 | **A** | webhook POST で完了通知 | 0 |

### 2.2 自動化提案

**実装パターン**: bash script `scripts/own-pre-02-auto.sh` (60 行想定)

scope 別 add は 7 回の vercel CLI 呼出で完遂。**critical assertion**: SERVICE_ROLE_KEY が preview / development scope に入っていないことを exit code 1 で fail-fast (誤投入防止)。

**Owner 拘束圧縮**: 15 min → **2 min**（OWN-PRE-01 と同 session で連続実行で auth 1 回再利用）

### 2.3 Risk

- vercel CLI は同一 key を同一 scope に重複 add すると error → 既存 env 削除 (`vercel env rm --yes`) を先行実装する idempotency 担保が必要
- `vercel env rm` の確認 prompt は `--yes` flag で suppress（B 分類降格回避）

---

## 3. OWN-PRE-03: DNS TTL 短縮 300 秒

### 3.1 step 別評価

| # | step | 自動化分類 | 機械実行手段 | Owner 拘束 |
|---|---|---|---|---|
| 1 | レジストラログイン | **C** | お名前.com に公式 API 無し（HTTP scrape は ToS 違反） | Owner 手動 |
| 2 | 対象ドメイン選択 | **C** | 同上 | Owner 手動 |
| 3 | DNS 設定画面へ | **C** | 同上 | Owner 手動 |
| 4 | www レコード TTL 変更 | **C** | お名前.com 画面操作 | Owner 手動 |
| 5 | apex レコード TTL 変更 | **C** | 同上 | Owner 手動 |
| 6 | 伝播待機 (dig) | **A** | `dig +nocmd +noall +answer www.4wide.co.jp` から TTL 列抽出 | 0 |
| 7 | apex 確認 (dig) | **A** | 同上 | 0 |
| 8 | Slack 投稿 | **A** | webhook POST | 0 |

### 3.2 自動化提案

**現状**: お名前.com は API 公式提供無し（2026-05 時点）→ step 1-5 は **C 分類維持** (Owner 手動必須)

**部分自動化**: step 6-8 のみ script 化。Owner が画面操作後に `scripts/own-pre-03-verify.sh` を起動すると、dig による TTL 確認 + Slack 投稿が自動完了。

```text
処理 sketch (擬似):
  1. dig コマンドで www / apex の TTL を取得
  2. TTL <= 300 を確認 (assertion)
  3. failed 時は exit 1 で Owner に手動再確認を促す
  4. ok 時は Slack webhook で done 投稿
```

**代替案 A (将来検討)**: Cloudflare DNS / Route 53 / Google DNS への移管で API 化可能（Round 23+ で別 DEC で議論）

**Owner 拘束圧縮**: 10 min → **8 min**（画面操作 6 min + verify script 待ち 2 min、step 1-5 は短縮不可）

### 3.3 Risk

- DNS 移管は Round 22 scope 外（rollback 可能性 + 30 day review 後に検討）
- `dig` の伝播確認 = TTL <= 300 s assertion で誤検出時は手動 fallback

---

## 4. OWN-PRE-04: SLACK_WEBHOOK_URL + CRON_SECRET 投入

### 4.1 step 別評価

| # | step | 自動化分類 | 機械実行手段 | Owner 拘束 |
|---|---|---|---|---|
| 1 | Vercel に SLACK_WEBHOOK_URL | **A** | `op item get ... \| vercel env add SLACK_WEBHOOK_URL production` | 0 |
| 2 | Vercel に CRON_SECRET | **A** | 同上 (Production のみ) | 0 |
| 3 | GitHub Secrets 画面へ | **A** | `gh secret list -R 4wide/company-website` | 0 |
| 4 | GitHub に SLACK_WEBHOOK_URL | **A** | `op item get ... \| gh secret set SLACK_WEBHOOK_URL` | 0 |
| 5 | GitHub に CRON_SECRET | **A** | 同上 | 0 |
| 6 | Vercel CLI 確認 | **A** | production scope に SLACK / CRON 2 件存在を assertion | 0 |
| 7 | GitHub CLI 確認 | **A** | `gh secret list` で SLACK / CRON 2 件存在を assertion | 0 |
| 8 | Slack 投稿 | **A** | webhook POST | 0 |

### 4.2 自動化提案

**実装パターン**: bash script `scripts/own-pre-04-auto.sh` (50 行想定)

両系統 (Vercel + GitHub) を 1 script で処理。`gh` CLI は事前 `gh auth login` 完了前提（Owner GitHub PAT 1 回登録）。

**Owner 拘束圧縮**: 15 min → **2 min**（auth 状態であれば script 1 起動で完遂）

### 4.3 Risk

- `gh secret set` は stdin 取得対応済み → secret 露出 0
- GitHub PAT の有効期限管理は Owner 責務（半年に 1 回 rotate 想定）

---

## 5. OWN-PRE-05: Sentry alert ルール有効化

### 5.1 step 別評価

| # | step | 自動化分類 | 機械実行手段 | Owner 拘束 |
|---|---|---|---|---|
| 1 | Sentry ログイン | **C** | Sentry API は token 必要、Owner UI ログイン不要だが MFA は C | C |
| 2 | Project に遷移 | **A** | API: `GET /api/0/projects/<org>/<proj>/` | 0 |
| 3 | Alerts 画面へ | **A** | API: `GET /api/0/projects/<org>/<proj>/rules/` | 0 |
| 4 | 対象 rule を開く | **A** | rule ID を JSON parse で取得 | 0 |
| 5 | rule を有効化 | **A** | API: `PUT /api/0/projects/<org>/<proj>/rules/<id>/` body `{"status":"active"}` | 0 |
| 6 | テスト発火 | **B** | API: rule actions を直接 trigger 不可 → `Test Alert` 相当の API なし → Owner 任意 | 0-1 click |
| 7 | alert 一覧再確認 | **A** | API: 同 rules endpoint で `status` field assertion | 0 |
| 8 | Slack 投稿 | **A** | webhook POST | 0 |

### 5.2 自動化提案

**実装パターン**: Node.js script `scripts/own-pre-05-auto.mjs` (80 行想定、curl + jq でも代替可)

```text
処理 sketch (擬似 / 実装は execFileNoThrow + fetch のみ使用、shell 注入経路 0):
  1. 1Password CLI から Sentry API token を取り出す (stdin で受け取る)
  2. fetch で Sentry rules 一覧を取得 (Bearer auth)
  3. "error rate > 1%" rule の id を JSON parse で抽出
  4. fetch (PUT) で status='active' に更新
  5. 再度 GET で active 確認 (assertion)
  6. Slack webhook で done 投稿
```

**Owner 拘束圧縮**: 10 min → **2 min**（test 発火確認は省略可、step 7 で active 確認）

### 5.3 Risk

- Sentry API token は別途 1Password 登録必要（OWN-PRE-04 同様の Pattern）
- test 発火 (`Test Alert`) は Sentry API 公式提供無 → 確認したい場合は 1 click 残る (B 分類維持)

---

## 6. OWN-PRE-06: Supabase RLS 全 table 確認

### 6.1 step 別評価

| # | step | 自動化分類 | 機械実行手段 | Owner 拘束 |
|---|---|---|---|---|
| 1 | Supabase ログイン | **C** | Supabase Admin API token 必要、Owner MFA は C | C |
| 2 | Project 選択 | **A** | API: `GET /v1/projects/<ref>` | 0 |
| 3 | Database → Tables 画面 | **A** | SQL: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'` | 0 |
| 4 | RLS バッジを scan | **A** | 上記 SQL の `rowsecurity` 列で boolean 判定、全 true assertion | 0 |
| 5 | OFF を発見した場合の記録 | **A** | OFF table を JSON 出力、Slack 警告 | 0 |
| 6 | anon 権限の sanity 確認 | **A** | anon key で `select count(*)` 実行、policy 動作確認 | 0 |
| 7 | 集計表作成 | **A** | SQL 結果集計 (N table 中 ON: M / OFF: K) | 0 |
| 8 | Slack 投稿 | **A** | webhook POST | 0 |

### 6.2 自動化提案

**実装パターン**: Node.js script `scripts/own-pre-06-auto.mjs` (90 行想定)

Supabase は `service_role` key で `pg_tables` 直接 query 可能。`rowsecurity` 列で全 table の RLS 状態を一括検証。

```text
処理 sketch (擬似):
  1. service_role key を 1Password CLI 経由で取得 (memory 内のみ)
  2. pg_tables への SELECT で rowsecurity 列を全 table 分取得
  3. rowsecurity=false の table を抽出 (off list)
  4. off list が非空 → Slack に WARN + Dev mention + exit 1
  5. 全 ON → Slack に done 投稿 (集計値含む)
```

**Owner 拘束圧縮**: 15 min → **1 min**（script 起動 + 結果確認のみ、目視 scan が不要に）

### 6.3 Risk

- 4 eyes 原則: 自動化により Dev / Owner の独立検証性が弱まる → Round 22 W5 で Owner 認知のみ強化（script 結果を Slack pin で Owner 自身に通知）
- service_role key を script で利用するため key 露出 risk → 1Password CLI 経由で都度取得、script は memory 内のみ保持

---

## 7. OWN-PRE-07: Supabase manual snapshot 取得

### 7.1 step 別評価

| # | step | 自動化分類 | 機械実行手段 | Owner 拘束 |
|---|---|---|---|---|
| 1 | Supabase ログイン | **C** | Owner MFA 必須 | C |
| 2 | Database → Backups 画面 | **A** | API: `GET /v1/projects/<ref>/database/backups` | 0 |
| 3 | Take a backup を実行 | **B** | API: `POST /v1/projects/<ref>/database/backups` 確認後 trigger | 1 click confirm |
| 4 | 完了待機 | **A** | API: 上記 GET を 5s ごと poll、status='Completed' 待機 | 0 |
| 5 | snapshot ID を copy | **A** | API response の `id` field を抽出 | 0 |
| 6 | Slack に投稿 | **A** | webhook POST | 0 |
| 7 | 投稿を pin | **A** | Slack API: `chat.postMessage` + `pins.add` | 0 |
| 8 | Web-Ops に ack 要求 | **B** | Slack mention は自動、ack 受領は人間判断 | 0 (人間応答は Web-Ops) |

### 7.2 自動化提案

**実装パターン**: Node.js script `scripts/own-pre-07-auto.mjs` (100 行想定)

公開 30 min 前 (08:25 JST) の **window 厳守** が要件のため、cron 起動は禁止（Owner 手動 trigger で時刻 strict）。

```text
処理 sketch (擬似):
  1. wall-clock を確認、JST 08:25-08:35 範囲外なら exit 1 (誤起動防止)
  2. Supabase Admin API へ POST で backup 起動
  3. GET で 5s 間隔 poll、status='COMPLETED' 待機 (max 5 min timeout)
  4. snapshot id を JSON parse で抽出
  5. Slack に投稿 + 同投稿を pin
  6. Slack pin 済み + Web-Ops mention 完了で正常終了
```

**Owner 拘束圧縮**: 5 min → **2 min**（Owner: 起動 1 操作 + 結果確認 1 操作、待機は無人）

### 7.3 Risk

- snapshot 取得 API が Pro plan 限定 → plan 確認後に enable
- 08:25-08:35 window 制約 = script の wall-clock check で fail-fast (誤起動防止)
- pin 操作は Slack OAuth の `pins:write` scope 必要 → Web-Ops が事前準備

---

## 8. 集計: Owner 拘束時間圧縮率

| sub-card | 現手動 (min) | 自動化後 (min) | 圧縮率 | 自動化分類 (主) |
|---|---|---|---|---|
| OWN-PRE-01 | 10 | 2 | **80%** | A |
| OWN-PRE-02 | 15 | 2 | **87%** | A |
| OWN-PRE-03 | 10 | 8 | **20%** | C (DNS) |
| OWN-PRE-04 | 15 | 2 | **87%** | A |
| OWN-PRE-05 | 10 | 2 | **80%** | A (B 1 step) |
| OWN-PRE-06 | 15 | 1 | **93%** | A |
| OWN-PRE-07 | 5 | 2 | **60%** | A (B 1 step) |
| **合計** | **80** | **19** | **76%** | mixed |

**Round 22 W5 実装後の Owner 拘束**: 80 min → **19 min**（圧縮率 76%、全 7 件で auth 1 回再利用想定なら 12-15 min まで圧縮可能）

---

## 9. 実装計画 (Round 22 W5 / W6)

### 9.1 Phase 1: A 分類 script 物理化 (W5、約 4h)

- `scripts/own-pre-01-auto.sh` / `scripts/own-pre-02-auto.sh` / `scripts/own-pre-04-auto.sh` (環境変数系 3 件まとめ)
- 6/12 期限 sub-card を最優先（Owner 6/12 23:59 までの 40 min 拘束を 6 min に圧縮）

### 9.2 Phase 2: API 系 script (W5、約 6h)

- `scripts/own-pre-05-auto.mjs` (Sentry) / `scripts/own-pre-06-auto.mjs` (Supabase RLS) / `scripts/own-pre-07-auto.mjs` (snapshot)
- Sentry / Supabase API token を 1Password に追加登録 (Web-Ops 起票)

### 9.3 Phase 3: 部分自動化 + verify script (W6、約 2h)

- `scripts/own-pre-03-verify.sh`（DNS dig 確認のみ、画面操作は Owner 手動）
- 全 script 共通の `lib/own-auto-common.sh` 整備（Slack 投稿 / 1Password CLI / fail-fast）

### 9.4 Phase 4: dry-run + Owner 教育資料 (W6、約 2h)

- 各 script に `--dry-run` flag 実装（実投入せず予定 action を出力）
- Owner 向け使い方手順書 1 枚（OWN-AUTO-quickstart.md 想定）

### 9.5 不退転 line

- 各 script 失敗時は OWN-PRE-XX 手動手順 (R21 物理化済) に fallback 可能 = **本仕様は Web-Ops-H 起票手順を historical baseline として完全保護**
- script の merge は Web-Ops Review (DEC-Web-XXX 必要) → Round 22 末で議決

---

## 10. リスクと制約 (まとめ)

| Risk | 緩和 |
|---|---|
| お名前.com API 不在 | OWN-PRE-03 step 1-5 は C 維持、Round 23+ で DNS 移管検討 |
| Sentry / Supabase API token 露出 | 1Password CLI で都度取得、script は memory 内のみ保持 |
| script bug で誤投入 (環境変数誤入) | `--dry-run` 標準提供、production 投入前に Owner 確認 |
| GitHub PAT 有効期限切れ | rotation policy 確立 (Round 22 末で SOP 化) |
| 4 eyes 原則弱化 | Slack pin で Owner 認知強化、Web-Ops が ack で 2 nd eye |
| script-level fail-closed | 各 script exit 1 時に Slack alert + 手動手順 (OWN-PRE-XX) URL 提示 |
| shell 注入 risk | 全 script は execFileNoThrow / spawn 配列形式で実装、文字列連結 exec 禁止 |

---

## 11. 関連 DEC / 引継

- **本仕様承認 (Round 22 末予定)**: DEC-Web-XXX として議決、後続 W5/W6 実装段階の前提
- **DEC-019-025** (background dispatch SOP): script 並列起動時の SOP 適用
- **DEC-019-062** (CRON_SECRET 確定 / Slack pin policy): OWN-PRE-04 / 07 自動化前提
- **次 Round (Web-Ops 担当)**: 各 script の物理化 + Owner quickstart 整備
- **historical baseline 保護**: OWN-PRE-01〜07 (Web-Ops-H R21 起票) は本仕様で参照のみ、無改変

---

**最終更新**: 2026-05-05（Round 22 第 2 波 / Dev-KK 起票）
**次回見直し**: 2026-05-19 (Round 23 W5 開始時 / 9.1 Phase 1 着手判断)
