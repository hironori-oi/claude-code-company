# OWN-PRE-DRY-RUN: 7 sub-card 動作確認 dry-run シミュレーション (2026-06-12 想定)

**対象案件**: PRJ-019 Open Claw "Clawbridge"（公開 2026-06-19 09:00 JST）
**所有者**: Web-Ops 部門（Round 22 / Web-Ops-I 起票）
**バージョン**: v1.0（Round 22 第 1 波）
**親**: `INDEX.md`（R21 Web-Ops-H 物理化）/ `../launch-pre-ops-checklist.md` §7
**用途**: Owner が OWN-PRE-01〜07 を実行する **前** に、Web-Ops が「実行流れ + 期待出力 + FAIL 時 fallback + 圧縮時間内完遂判定 + 証憑記録方法」を spec として確定する dry-run シナリオ集

---

## 0. 利用方法

本書は dry-run **シミュレーション**であり、実際の env 投入 / DNS 操作 / Supabase snapshot は実行しない（副作用 0 / API 追加コスト $0 / 絵文字 0）。
Owner が OWN-PRE-01〜07 を 6/12〜6/19 の期間で実行する際、Web-Ops が伴走できるよう「想定流れ」を 7 sub-card 各約 50 行で詳細化する。

各 sub-card セクションは以下 5 ブロック構造で統一:
- §A. 実行流れ シミュレーション（時刻軸での動作）
- §B. 期待出力サンプル（CLI / Web UI / Slack）
- §C. 圧縮時間内完遂判定（5-15 min 内に収まるかの裏付け）
- §D. FAIL 時 fallback 分岐（3 パターン）
- §E. 証憑記録方法（screenshot / log / API response）

既存 OWN-PRE-01〜07 / INDEX 物理 file は **絶対無改変**。本書はそれらを参照する別 file として並走。

---

## 1. OWN-PRE-01 dry-run（Vercel Env GA4 + Sentry DSN, 10 min target）

### §A. 実行流れ シミュレーション

```
T+0:00  1Password app 起動（master password 入力 / Touch ID）
T+0:30  vault `prj-019-secrets` を開く
T+1:00  GA4_ID_PRODUCTION エントリを click → "copy value" 通知
T+1:30  ブラウザで Vercel Env URL（直接打鍵 or bookmark）
T+2:30  Vercel Env 画面が完全描画（auth セッション継続前提）
T+3:00  "Add New" click → modal 表示
T+3:30  Key: `NEXT_PUBLIC_GA4_ID` 入力 / Value: paste / Production scope check / Save
T+4:30  list 再描画で 1 行追加確認
T+5:00  1Password 戻り → SENTRY_DSN_PRODUCTION copy
T+5:30  Vercel "Add New" → Sentry DSN 投入 / Save
T+7:00  list で 2 件存在確認
T+7:30  terminal 起動 / `vercel env ls production` 実行
T+8:30  出力に GA4_ID + SENTRY_DSN の 2 件 production scope 確認
T+9:00  Slack `#prj-019-launch` で `OWN-PRE-01 done HH:MM` 投稿
T+10:00 完了
```

### §B. 期待出力サンプル

```
$ vercel env ls production
> Loading 23 envs ...

  Name                          Environment    Encrypted    Updated
  NEXT_PUBLIC_GA4_ID           Production     ✓            HH:MM
  NEXT_PUBLIC_SENTRY_DSN       Production     ✓            HH:MM
  ... (他 21 件)
```

### §C. 圧縮時間内完遂判定（10 min target）

実時間内訳: 1Password 操作 1.5 min / Vercel UI 操作 6 min / CLI 確認 1.5 min / Slack 投稿 1 min = 10 min。Owner 側で 1Password 拡張 auto-fill が機能していれば 8 min も可能。**判定: 10 min 内完遂可（裏付け = 操作 step 数 8 件 × 平均 75 秒）**。

### §D. FAIL 時 fallback 分岐（3 パターン）

1. **1Password vault に値が無い**: Web-Ops が GA4 Console / Sentry Dashboard で値を再取得し、1Password に re-add（Owner 操作再開で 5 min 遅延）。
2. **Vercel UI で "Save" が 503**: 1 min 待機 → リトライ（Vercel 側 transient エラー）。3 回失敗で `vercel env add` CLI 経由に切替（Web-Ops が CLI 構文 share）。
3. **scope 誤投入（Preview に GA4_ID）**: `vercel env rm NEXT_PUBLIC_GA4_ID preview` で削除 → step 4 から再実行。値漏洩 risk なし（GA4_ID は client bundle 既知）。

### §E. 証憑記録方法

- screenshot 1: Vercel Env list 画面（GA4_ID + SENTRY_DSN の 2 行 visible / Encrypted 列 green）— `evidence/own-pre-01-vercel-env-list.png`
- log 1: `vercel env ls production` の stdout 全文 — `evidence/own-pre-01-cli.log`
- Slack 投稿: `OWN-PRE-01 done HH:MM` の permalink を pin（後日 audit 用）

---

## 2. OWN-PRE-02 dry-run（Vercel Env Supabase 3 key, 15 min target）

### §A. 実行流れ シミュレーション

```
T+0:00  1Password vault `prj-019-secrets` から SUPABASE_URL / ANON / SERVICE_ROLE 3 件 visible 化
T+1:00  Vercel Env "Add New" → SUPABASE_URL 投入（Production + Preview + Development の 3 scope check）
T+3:00  list で SUPABASE_URL × 3 行確認
T+3:30  "Add New" → SUPABASE_ANON_KEY 投入（同 3 scope）
T+5:30  list で SUPABASE_ANON_KEY × 3 行確認
T+6:00  "Add New" → SUPABASE_SERVICE_ROLE_KEY 投入（**Production のみ** check / Preview / Development はチェック外す）
T+8:00  list で SUPABASE_SERVICE_ROLE_KEY × 1 行（Production）のみ確認
T+9:00  terminal: `vercel env ls preview | grep SERVICE_ROLE` → 0 件期待
T+10:00 `vercel env ls production | grep SUPABASE` → 3 件期待
T+12:00 scope 隔離 OK 判定
T+13:00 Slack `OWN-PRE-02 done HH:MM / service_role 隔離 OK` 投稿
T+15:00 完了
```

### §B. 期待出力サンプル

```
$ vercel env ls production | grep SUPABASE
  SUPABASE_URL                  Production    ✓    HH:MM
  SUPABASE_ANON_KEY             Production    ✓    HH:MM
  SUPABASE_SERVICE_ROLE_KEY     Production    ✓    HH:MM

$ vercel env ls preview | grep SERVICE_ROLE
$ (空 = exit code 1, grep miss)
```

### §C. 圧縮時間内完遂判定（15 min target）

実時間内訳: 1Password 操作 2 min / Vercel UI 操作（3 key × 約 3 min）9 min / CLI 確認 2 min / Slack 投稿 1 min + buffer 1 min = 15 min。3 key 連続投入で flow 化される分、後半ほど高速化。**判定: 15 min 内完遂可（service_role の scope 操作で 30 秒余分にかかるが、buffer 内）**。

### §D. FAIL 時 fallback 分岐（3 パターン）

1. **service_role を Preview に誤投入（最重大）**: 即座に `vercel env rm SUPABASE_SERVICE_ROLE_KEY preview` 実行 → Web-Ops に Slack `@web-ops` mention → Supabase Dashboard で **service_role を rotate**（key 漏洩前提で再発行）→ 1Password 更新 → step 4 から再実行（追加 15 min）。
2. **value 改行混入で paste**: list 画面で行末異常を検知 → `vercel env rm` → 1Password で値再 copy（trim 確認）→ step 再実行。
3. **scope 全外し（保存されない）**: Vercel UI が「at least 1 scope required」エラー → Production 単独 check で再投入。

### §E. 証憑記録方法

- screenshot 1: Vercel Env list の SUPABASE 3 key 表示 — `evidence/own-pre-02-vercel-env-list.png`
- screenshot 2: SERVICE_ROLE が Production のみ表示（scope 隔離証跡）— `evidence/own-pre-02-service-role-scope.png`
- log 1: `vercel env ls production | grep SUPABASE` 出力 + `vercel env ls preview | grep SERVICE_ROLE` 空出力 — `evidence/own-pre-02-cli.log`

---

## 3. OWN-PRE-03 dry-run（DNS TTL 短縮 300 秒, 10 min target）

### §A. 実行流れ シミュレーション

```
T+0:00  レジストラ（お名前.com 想定）ログイン画面 / 1Password auto-fill
T+1:00  Domain Navi トップ → 4wide.co.jp 詳細
T+2:00  DNS 設定画面遷移 / レコード一覧表示
T+2:30  www.4wide.co.jp 行の「編集」click
T+3:00  TTL 入力欄を 3600 → 300 へ書き換え（CNAME 値 = cname.vercel-dns.com は触らない）
T+3:30  保存 → list で TTL 列 = 300 確認
T+4:00  apex（4wide.co.jp）行の「編集」click → TTL 300 → 保存
T+5:00  list で 2 行とも TTL = 300 確認
T+5:30  terminal: `dig +nocmd +noall +answer www.4wide.co.jp` 実行
T+6:00  TTL 列が 300 表示（または 300 未満カウントダウン）確認
T+7:00  apex も dig で確認
T+8:30  Slack `OWN-PRE-03 done HH:MM / TTL 300 OK` 投稿
T+10:00 完了
```

### §B. 期待出力サンプル

```
$ dig +nocmd +noall +answer www.4wide.co.jp
www.4wide.co.jp.    300    IN    CNAME    cname.vercel-dns.com.

$ dig +nocmd +noall +answer 4wide.co.jp
4wide.co.jp.    300    IN    A    76.76.21.21
```

### §C. 圧縮時間内完遂判定（10 min target）

実時間内訳: ログイン 2 min / TTL 編集 4 min（2 レコード）/ 伝播確認 dig 3 min / Slack 1 min = 10 min。レジストラ UI が遅い場合は伝播確認が 5 min かかるが、その時間は他作業（OWN-PRE-04 着手）と並列可。**判定: 10 min 内完遂可（伝播完全反映は 30 min 後だが、TTL 値書き換え + dig での降下開始確認で完遂判定）**。

### §D. FAIL 時 fallback 分岐（3 パターン）

1. **誤って CNAME 値を変更（最重大）**: 即座に Web-Ops `@mention` → `launch-pre-ops-checklist.md` §2 の元値を復元 → 伝播 30-60 min 待機 → 公開判定への影響を CEO に escalate。
2. **TTL 入力欄が変更不可（プラン制限）**: お名前.com の場合「ドメイン Navi」プラン依存で TTL 編集不可なケースあり → サポート chat（24h SLA）→ 6/18 17:00 期限超過時は 3600 秒運用継続（Web-Ops 判断）。
3. **dig 結果が更新されない**: ローカル resolver cache → `dig @8.8.8.8 www.4wide.co.jp` で Google Public DNS 直接問い合わせ → そこも 3600 秒なら反映待機。

### §E. 証憑記録方法

- screenshot 1: レジストラ DNS 設定画面（TTL 列 = 300 で 2 行表示）— `evidence/own-pre-03-registrar-list.png`
- log 1: `dig www.4wide.co.jp` の出力（TTL = 300）— `evidence/own-pre-03-dig-www.log`
- log 2: `dig 4wide.co.jp` の出力 — `evidence/own-pre-03-dig-apex.log`

---

## 4. OWN-PRE-04 dry-run（SLACK_WEBHOOK_URL + CRON_SECRET, 15 min target）

### §A. 実行流れ シミュレーション

```
T+0:00  1Password から SLACK_WEBHOOK_URL_PRODUCTION + CRON_SECRET_PRODUCTION 2 値 visible 化
T+1:00  Vercel Env "Add New" → SLACK_WEBHOOK_URL（Production + Preview check / Development 除外）
T+3:00  Vercel Env "Add New" → CRON_SECRET（Production のみ check）
T+5:00  list で 2 key が期待 scope で並ぶ確認
T+5:30  GitHub Secrets URL 直接打鍵 → Repository secrets 画面
T+6:30  "New repository secret" → SLACK_WEBHOOK_URL 投入
T+8:00  "New repository secret" → CRON_SECRET 投入
T+9:30  list で 2 件存在確認
T+10:00 terminal: `vercel env ls production | grep -E "SLACK|CRON"` → 2 件期待
T+11:00 terminal: `gh secret list -R 4wide/company-website` → 2 件期待
T+12:00 隔離確認: `vercel env ls preview | grep CRON_SECRET` → 0 件
T+13:30 Slack `OWN-PRE-04 done HH:MM / Vercel + GitHub 両投入 OK` 投稿
T+15:00 完了
```

### §B. 期待出力サンプル

```
$ vercel env ls production | grep -E "SLACK|CRON"
  SLACK_WEBHOOK_URL    Production    ✓    HH:MM
  CRON_SECRET          Production    ✓    HH:MM

$ gh secret list -R 4wide/company-website
SLACK_WEBHOOK_URL    Updated YYYY-MM-DD
CRON_SECRET          Updated YYYY-MM-DD
```

### §C. 圧縮時間内完遂判定（15 min target）

実時間内訳: 1Password 操作 1.5 min / Vercel 投入 4 min / GitHub Secrets 投入 4 min / CLI 確認（vercel + gh）2.5 min / Slack 1 min + buffer 2 min = 15 min。**判定: 15 min 内完遂可（gh CLI 未認証の場合 +2 min で `gh auth login` 必要、ただし buffer 内）**。

### §D. FAIL 時 fallback 分岐（3 パターン）

1. **CRON_SECRET 値が短い（< 64 文字）**: `openssl rand -hex 32` で再生成 → 1Password 更新 → step 2 / 5 再実行（+5 min）。DEC-019-062 で 64 文字以上規定。
2. **webhook URL が 404**: Slack workspace 管理画面で webhook 再発行 → 1Password 更新 → step 1 / 4 再実行（+5 min）。
3. **gh CLI 未インストール**: Web-Ops が `gh secret set CRON_SECRET --body "..."` 風 CLI 構文を Slack で share する代行ルート（ただし Owner 端末で実行してもらう、Web-Ops は値を見ない）。

### §E. 証憑記録方法

- screenshot 1: Vercel Env list（SLACK_WEBHOOK_URL + CRON_SECRET 2 行）— `evidence/own-pre-04-vercel-env.png`
- screenshot 2: GitHub Secrets list（同 2 件）— `evidence/own-pre-04-github-secrets.png`
- log 1: `vercel env ls production | grep -E "SLACK|CRON"` 出力 — `evidence/own-pre-04-vercel-cli.log`
- log 2: `gh secret list` 出力 — `evidence/own-pre-04-gh-cli.log`

---

## 5. OWN-PRE-05 dry-run（Sentry alert ルール有効化, 10 min target）

### §A. 実行流れ シミュレーション

```
T+0:00  Sentry ログイン（https://sentry.io/auth/login/）/ 1Password auto-fill
T+1:30  Organization トップ → Projects → prj-019-clawbridge
T+2:30  左 nav → Alerts → Alert Rules 一覧
T+3:00  事前投入済み rule "error rate > 1% (5min)" 行を click
T+3:30  rule 詳細画面（trigger / actions 表示）
T+4:00  Status トグル "Disabled" → "Enabled" click
T+4:30  badge が grey → green / "Saved" 通知
T+5:00  右上 "..." → "Test Alert" click → confirm
T+5:30  Slack #prj-019-alerts に test 通知到着確認（30 秒以内期待）
T+6:30  Alerts 一覧に戻る → rule 行に Enabled badge 確認
T+8:00  Slack `OWN-PRE-05 done HH:MM / alert ON OK / test 発火確認済` 投稿
T+10:00 完了
```

### §B. 期待出力サンプル

Sentry Alert Rules 画面:
```
Name                              Status     Last Triggered    Actions
error rate > 1% (5min)            Enabled    HH:MM (test)      Slack: #prj-019-alerts
```

Slack `#prj-019-alerts` test 通知:
```
[Sentry Test Alert]
Project: prj-019-clawbridge
Rule: error rate > 1% (5min)
This is a test alert. No action required.
```

### §C. 圧縮時間内完遂判定（10 min target）

実時間内訳: ログイン 1.5 min / 画面遷移 1.5 min / トグル操作 1 min / test 発火確認 2 min / Slack 投稿 1 min + buffer 3 min = 10 min。test 発火が遅い場合 buffer 消費。**判定: 10 min 内完遂可（Sentry SaaS の通常応答時間内 = test 通知は 5-30 秒で到着）**。

### §D. FAIL 時 fallback 分岐（3 パターン）

1. **rule が事前投入されていない**: Web-Ops が Sentry Dashboard で rule template を即時投入（5 min）→ Owner step 4 から再開。
2. **Slack integration 切断（test 通知届かない）**: Sentry Settings → Integrations → Slack の re-auth（Owner 操作必要、+3 min）→ test 再発火。
3. **rule が再 Disabled に勝手に戻る**: Sentry billing plan が limit / quota 到達 → Web-Ops が plan 確認 → 必要なら Owner に upgrade 提案（公開後 review 候補）。

### §E. 証憑記録方法

- screenshot 1: Sentry Alert Rules 画面（rule が Enabled badge 表示）— `evidence/own-pre-05-sentry-rule-enabled.png`
- screenshot 2: Slack `#prj-019-alerts` に test 通知到着 — `evidence/own-pre-05-slack-test-alert.png`
- API response: Sentry API `GET /api/0/projects/{org}/{proj}/alert-rules/` の json で該当 rule の `status: "active"` 確認 — `evidence/own-pre-05-sentry-api.json`

---

## 6. OWN-PRE-06 dry-run（Supabase RLS 全 table 確認, 15 min target）

### §A. 実行流れ シミュレーション

```
T+0:00  Supabase Dashboard ログイン / 1Password auto-fill
T+1:30  Projects 一覧 → prj-019-clawbridge
T+2:30  左 nav → Database → Tables（public schema 表示）
T+3:30  全 table 行 scan（最大 20 件想定: case_studies / portfolio_items / contact_submissions / og_cache / heartbeat_log 等）
T+8:00  各行で "RLS enabled" green badge 確認 / メモに table 名を順次書き出し
T+9:00  SQL Editor → `select count(*) from public.case_studies;` を anon role で実行 → RLS policy 通りの結果（全件返却ではない）確認
T+11:00 集計表作成: 全 N table 中 RLS ON: M / OFF: K / 不明: L
T+12:00 OFF table があれば Slack に table 名列挙 + @dev mention（無ければ「全 N table green」記載）
T+13:30 Slack `OWN-PRE-06 done HH:MM / N table 中 RLS ON: M` 投稿
T+15:00 完了
```

### §B. 期待出力サンプル

Supabase Database → Tables 画面:
```
Schema: public
Name                  Rows    Size      RLS
case_studies          18      24 KB     [Enabled]
portfolio_items       12      18 KB     [Enabled]
contact_submissions   3       4 KB      [Enabled]
og_cache              N/A     N/A       [Enabled]
heartbeat_log         12,400  340 KB    [Enabled]
... (15+ rows all Enabled)
```

SQL Editor (anon role 想定):
```sql
> select count(*) from public.case_studies;
count
-----
3       -- public 公開許可された 3 件のみ（全 18 件中）= RLS 機能
```

Slack:
```
OWN-PRE-06 done 14:38 / 全 17 table green / anon select RLS 通り (3 / 18 rows)
```

### §C. 圧縮時間内完遂判定（15 min target）

実時間内訳: ログイン 1.5 min / 画面遷移 1 min / table scan 8 min（20 件 × 24 秒）/ SQL 確認 1.5 min / 集計 1 min / Slack 1 min + buffer 1 min = 15 min。table 数が多い案件（30+）の場合は scan を 10 min に拡張可。**判定: 15 min 内完遂可（PRJ-019 想定 table 数 = 17-20 件、24 秒 / 件で十分）**。

### §D. FAIL 時 fallback 分岐（3 パターン）

1. **OFF table 発見**: Owner は **修正しない**（4 eyes 原則）→ Slack で table 名列挙 + `@dev` mention → Dev が `alter table public.xxx enable row level security;` 実行 → Owner が再確認（+15 min, 6/16 D-3 までに着地）。
2. **SQL Editor で anon role が選べない**: Supabase Dashboard の SQL Editor は通常 service_role 権限実行 → "Run as anon" toggle 利用 / または curl で REST API 経由テスト（Web-Ops が curl 文 share）。
3. **table 数が想定外（30+）で 15 min に収まらない**: scan を「最重要 5 table（contact_submissions 等の PII 含有）+ 残り全件 RLS badge 一括目視」に圧縮（10 min 内完遂）。

### §E. 証憑記録方法

- screenshot 1: Supabase Tables 画面（全 RLS Enabled badge）— `evidence/own-pre-06-supabase-tables.png`
- screenshot 2: SQL Editor の anon role select 結果（RLS 通りの行数）— `evidence/own-pre-06-sql-anon.png`
- log 1: 集計表（table 名 + RLS 状態の text list）— `evidence/own-pre-06-rls-tally.txt`

---

## 7. OWN-PRE-07 dry-run（Supabase manual snapshot, 5 min target / 厳守 window 08:25-08:35 JST）

### §A. 実行流れ シミュレーション（6/19 当日 08:25 JST 開始想定）

```
T+0:00  (08:25 JST) Supabase Dashboard 既ログイン状態（08:00 JST 時点で sign-in 確認済み）
T+0:30  prj-019-clawbridge プロジェクト直接表示
T+1:00  左 nav → Database → Backups
T+1:30  右上 "Take a backup" / "Create backup" click
T+2:00  confirm dialog で OK
T+2:30  "Backup in progress" 表示 → 通常 30-90 秒で Completed
T+3:30  新規 snapshot 行が "Completed" status / uuid 表示
T+4:00  "..." → "Copy ID" click / clipboard copy 通知
T+4:30  Slack `#prj-019-launch` 投稿: `OWN-PRE-07 done 08:HH JST / snapshot ID: <uuid> / 公開時 rollback ポイント`
T+5:00  自分の投稿を pin / Web-Ops に @mention で ack 要求
T+5:00  完了（08:30 JST）
```

### §B. 期待出力サンプル

Supabase Backups 画面:
```
Name                                           Status       Created
manual-2026-06-19-0828                        Completed    2026-06-19 08:28 JST
[uuid: a1b2c3d4-5678-90ab-cdef-1234567890ab]
auto-pitr-2026-06-19-08                       Completed    2026-06-19 08:00 JST (PITR)
... (過去履歴)
```

Slack:
```
OWN-PRE-07 done 08:30 JST / snapshot ID: a1b2c3d4-5678-90ab-cdef-1234567890ab / 公開時 rollback ポイント
[pinned by hironori555]
```

### §C. 圧縮時間内完遂判定（5 min target / 厳守 10 min window 08:25-08:35）

実時間内訳: 画面遷移 1 min / snapshot 取得 wait 90 秒 / ID copy 30 秒 / Slack 投稿 + pin 60 秒 + buffer 30 秒 = 5 min。**判定: 5 min target 達成可（ただし Supabase 側で 90 秒以上 wait が発生した場合は window の後半 35 JST まで使う想定で安全）**。重要: 6/19 08:00 JST に **事前ログイン確認**を Owner runbook に追加済み（pre-condition で確保）。

### §D. FAIL 時 fallback 分岐（3 パターン）

1. **snapshot 取得が 90 秒以上完了しない**: Supabase Status page（status.supabase.com）確認 → 異常なら **CEO に即時 escalate**（公開判定 GO 発声に重大影響）→ PITR 単独運用に切替判断（Web-Ops 判断、CEO ack 必須）。
2. **plan 制限で manual snapshot 不可（Pro plan 未購入等）**: PITR 7 日保持で代替（PITR 取得時刻 = 公開直前最終 PITR の uuid を Slack pin）→ rollback 時の精度劣化を Owner / CEO に明示。
3. **ID copy 失敗（clipboard 不調）**: snapshot 行の URL 末尾 uuid を手動読み取り Slack 投稿（Web-Ops が thread で字面確認）。

### §E. 証憑記録方法

- screenshot 1: Supabase Backups 画面（manual-2026-06-19-0828 が Completed 表示）— `evidence/own-pre-07-supabase-backup.png`
- log 1: snapshot ID（uuid）の text 記録 — `evidence/own-pre-07-snapshot-id.txt`
- Slack permalink: pinned 投稿の URL を `evidence/own-pre-07-slack-pin.txt` に記録（rollback runbook §2 で参照される）

---

## 8. 7 sub-card 合計時間予測 + dry-run 完遂判定

| sub-card | target | dry-run 予測実時間 | buffer | 合計判定 |
|---|---|---|---|---|
| OWN-PRE-01 | 10 min | 8-10 min | 0-2 min | 完遂可 |
| OWN-PRE-02 | 15 min | 13-15 min | 0-2 min | 完遂可 |
| OWN-PRE-03 | 10 min | 9-10 min | 0-1 min | 完遂可（伝播待機は並列化）|
| OWN-PRE-04 | 15 min | 13-15 min | 0-2 min | 完遂可 |
| OWN-PRE-05 | 10 min | 7-10 min | 0-3 min | 完遂可 |
| OWN-PRE-06 | 15 min | 13-15 min | 0-2 min | 完遂可（table 数 17-20 想定）|
| OWN-PRE-07 | 5 min | 4-5 min | 0-1 min | 完遂可（厳守 window 内）|
| **合計** | **80 min** | **67-80 min** | **0-13 min** | **全 7 sub-card 80 min 内完遂可** |

実行 session 推奨（INDEX §2 timeline 踏襲）:
- 6/12 D-7: OWN-PRE-01 → 02 → 04 連続実行（40 min 1 session）
- 6/15 D-4: OWN-PRE-05 → 06 連続実行（25 min 1 session）
- 6/18 D-1 17:00 まで: OWN-PRE-03 単独（10 min）
- 6/19 D-Day 08:25-08:35: OWN-PRE-07 厳守 window（5 min）

---

## 9. dry-run 自体の証憑（本書の運用エビデンス）

本書を Owner / Web-Ops が事前読み合わせした証跡:

- 6/11 D-8: Web-Ops が本書を Slack `#prj-019-launch` に share（pin）→ Owner が 30 min 内に「dry-run 読了」reply
- 6/12 D-7 当日: Owner が OWN-PRE-01 / 02 / 04 着手前に本書 §1 / §2 / §4 を再読
- 6/15 D-4: §5 / §6 を再読
- 6/18 D-1: §3 を再読
- 6/19 D-Day 08:00 JST: §7 を再読（snapshot 取得 30 min 前のリハーサル）

各 milestone での Owner ack を Slack で証跡化（permalink を本書末尾に追記する形で update）。

---

## 10. 関連 artifact

- 親 INDEX: `INDEX.md`（R21 Web-Ops-H 物理化）
- 各 sub-card 物理 file: `OWN-PRE-01〜07-*.md`（R21 Web-Ops-H 起票、本書から無改変参照）
- 親 checklist: `../launch-pre-ops-checklist.md` §7
- card 親: `../owner-action-card-2026-06-19.md` CARD A
- launch readiness 索引: `../launch-readiness-consolidation-2026-06-19.md`
- OG preview validation procedure: `../og-preview-validation-execution-procedure-2026-06-12.md`（Round 22 Web-Ops-I 同時起票、6/12 D-7 で並走）
- 公開当日 web-ops 役割 v2.0: `../launch-day-web-ops-role-2026-06-19-v2.0.md`（Round 22 Web-Ops-I 同時起票）

---

## 11. 関連 DEC

- DEC-019-054（portfolio v3.0 公開判断）
- DEC-019-062（v1.1 / v3.1 deploy 確定 + cron 5 本 + CRON_SECRET）
- DEC-019-033（ナレッジ自動蓄積機構：本書も knowledge/patterns 候補 = "owner-action-card dry-run 標準パターン"）
- DEC-018-047（PRJ-018 hotfix から rollback / snapshot 知見継承）
- DEC-019-025（background dispatch SOP / 本書も SOP 実証）

---

**最終更新**: 2026-05-05（Round 22 / Web-Ops-I 起票）
**次回見直し**: 2026-06-11（D-8 Owner 事前読み合わせ）/ 2026-06-12（D-7 OWN-PRE-01 / 02 / 04 完遂後の実時間反映）/ 2026-06-15（D-4 OWN-PRE-05 / 06 完遂後）/ 2026-06-19 09:00 JST（公開時 lock + 全 7 sub-card 実時間ログを追記）
