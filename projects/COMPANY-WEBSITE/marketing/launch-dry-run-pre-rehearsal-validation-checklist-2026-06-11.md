# 6/11 D-8 Pre-Rehearsal Validation Checklist

## 0. 目的

- **対象**: 2026-06-12 D-7 本 rehearsal (3 時間枠 09:00-12:00 JST) の事前環境整備
- **実施日**: 2026-06-11 D-8 EOD (17:00 JST 完了目標)
- **本書 role**: D-7 当日に Phase 1 を即時 PASS に持ち込むための環境変数 / preview deploy / 連携系 / 各部門参加可否を D-8 までに 100% GREEN にする検収 checklist
- **派生元**: Round 21 Marketing-O `launch-dry-run-rehearsal-detailed-procedure-2026-06-12.md` (D-7 詳細手順) / Round 20 v2 SOP §Pre-condition CARD A-H
- **副作用 0 / 絵文字 0 / API 追加コスト $0 / Heroicons 参照のみ**
- **GREEN 基準**: §1〜§8 全項目 [x] 完了 + Web-Ops 1 名記入 + CEO 1 名承認
- **NoGO 基準**: §1〜§8 のうち 1 項目以上 [ ] 残 → CEO 判断で D-8 23:59 JST 延長 / 不能なら D-7 当日 SKIP 増加で対応
- **関連 DEC**: DEC-019-025 (background dispatch SOP 18 件目)

---

## §1 環境変数 (.env.dryrun) 整合性

D-8 EOD までに `.env.dryrun` の全 19 変数が export 済みであること。

| # | 変数名 | 担当 | 確認コマンド | 期待値 | 完了 |
|---|---|---|---|---|---|
| 1 | PREVIEW_URL | Web-Ops | `echo $PREVIEW_URL` | `https://...vercel.app` | [ ] |
| 2 | TARGET_URL | Web-Ops | `echo $TARGET_URL` | `$PREVIEW_URL` (dry-run時) | [ ] |
| 3 | SLACK_WEBHOOK_DRY | Dev | `echo $SLACK_WEBHOOK_DRY` | `https://hooks.slack.com/services/...` | [ ] |
| 4 | EXPECTED_EN_HASH | Marketing | `echo $EXPECTED_EN_HASH` | 64 桁 hex | [ ] |
| 5 | EXPECTED_PORTFOLIO_HASH | Marketing | `echo $EXPECTED_PORTFOLIO_HASH` | 64 桁 hex | [ ] |
| 6 | VERCEL_TEAM | Web-Ops | `echo $VERCEL_TEAM` | team_xxx 文字列 | [ ] |
| 7 | CRON_PROD_PR | Dev | `echo $CRON_PROD_PR` | PR 番号 (整数) | [ ] |
| 8 | CDN_HOST | Web-Ops | `echo $CDN_HOST` | `cdn.example.com` | [ ] |
| 9 | VERCEL_ANALYTICS_URL | Web-Ops | `echo $VERCEL_ANALYTICS_URL` | https URL | [ ] |
| 10 | SENTRY_PROJECT_URL | Dev | `echo $SENTRY_PROJECT_URL` | https URL | [ ] |
| 11 | GA_REALTIME_URL | Dev | `echo $GA_REALTIME_URL` | https URL | [ ] |
| 12 | SENTRY_TOKEN | Dev | `echo $SENTRY_TOKEN \| head -c 5` | token 先頭 5 文字確認 | [ ] |
| 13 | GA_TOKEN | Dev | `gcloud auth print-access-token \| head -c 5` | token 先頭 5 文字確認 | [ ] |
| 14 | SUPABASE_READONLY_URL | Dev | `echo $SUPABASE_READONLY_URL \| head -c 30` | postgres conn URI 先頭 | [ ] |
| 15 | SENTRY_ORG | Dev | `echo $SENTRY_ORG` | org slug | [ ] |
| 16 | SENTRY_PROJ | Dev | `echo $SENTRY_PROJ` | project slug | [ ] |
| 17 | GA_PROP | Dev | `echo $GA_PROP` | GA Property ID | [ ] |
| 18 | LAUNCH_DATE_JST | CEO | `echo $LAUNCH_DATE_JST` | `2026-06-19` | [ ] |
| 19 | LAUNCH_TIMESTAMP | CEO | `echo $LAUNCH_TIMESTAMP` | `2026-06-19T00:00:00Z` | [ ] |

- [ ] 19 変数全 export 完了 (Web-Ops 1 名記入 / CEO 1 名承認)
- [ ] `.env.dryrun` ファイルが Vault または 1Password Slack Integration 経由で安全に保管 (Plain text on disk 禁止)
- [ ] Web-Ops shell で `source .env.dryrun` 実行後、19 変数すべて非空であることを確認

---

## §2 Vercel preview deploy 完成

D-8 までに Vercel preview deploy が **build PASS + URL alive** であること。

- [ ] Vercel preview build status `Ready` (Vercel Dashboard で確認)
- [ ] `curl -I "$PREVIEW_URL"` HTTP 200 (HEAD)
- [ ] `curl -I "${PREVIEW_URL}/case-studies"` HTTP 200
- [ ] `curl -I "${PREVIEW_URL}/portfolio"` HTTP 200
- [ ] `curl -I "${PREVIEW_URL}/about"` HTTP 200
- [ ] `curl -I "${PREVIEW_URL}/contact"` HTTP 200
- [ ] `curl -I "${PREVIEW_URL}/en"` HTTP 200
- [ ] `curl -I "${PREVIEW_URL}/en/case-studies"` HTTP 200
- [ ] `curl -I "${PREVIEW_URL}/en/portfolio"` HTTP 200
- [ ] preview build ログに ERROR 0 件 (`vercel logs` で確認)
- [ ] preview build 内 NEXT_PUBLIC_* env 反映確認 (favicon / OG image preview URL 反映)

担当: Web-Ops + Dev

FAIL 時: D-8 中に preview rebuild → D-8 23:59 JST までに再 PASS

---

## §3 SLACK_WEBHOOK_URL preview ch 接続

D-8 までに Slack `#launch-dry-2026-06-19` channel が活発であること。

- [ ] Slack channel `#launch-dry-2026-06-19` 作成済 (Web-Ops が channel admin)
- [ ] webhook URL を channel に bind (preview ch 専用 / 本番 ch とは別 webhook)
- [ ] reachability test:
  ```bash
  curl -s -o /dev/null -w "%{http_code}" -X POST "$SLACK_WEBHOOK_DRY" \
    -H 'Content-Type: application/json' \
    -d '{"text":"[D-8 validation] SLACK_WEBHOOK_DRY reachability test"}'
  ```
  期待: HTTP 200
- [ ] channel に 4 部門責任者 (Web-Ops / Marketing / Dev / Review) + CEO + Owner が join 済
- [ ] channel topic に「D-7 rehearsal 用 dry channel / 本番投稿禁止」明記
- [ ] channel pinned message に「NoGO SLA: 30min / Owner GO 遅延 case E escalation tree」追記

担当: Web-Ops + Marketing

FAIL 時: D-8 中に webhook 再発行 (Slack admin) → D-8 23:59 JST 再 PASS

---

## §4 cron preview 起動 (実 cron は disable, preview は enable)

D-8 までに preview 環境の cron が enable / 実本番 cron が disable であること。

- [ ] Vercel preview project の cron 5 本 (DEC-019-062 準拠) が `enabled: true`
- [ ] 実本番 (production) project の cron 5 本が `enabled: false` (D-19 まで disabled)
- [ ] cron 5 本の名前確認 (heartbeat / kpi-aggregation / sentry-sync / ga-sync / vault-rotate)
- [ ] preview cron heartbeat が 5 min interval で `#launch-dry-2026-06-19` に dummy post 確認 (10 min 観測)
- [ ] CRON_PROD_PR (env `$CRON_PROD_PR`) が approve 状態 / merge せず保留 (D-19 で Web-Ops merge)

担当: Web-Ops + Dev

FAIL 時: cron 設定 mismatch → Web-Ops が Dashboard で再設定 → D-8 23:59 JST 再確認

---

## §5 Sentry preview project 接続

D-8 までに Sentry preview project が正常稼働であること。

- [ ] Sentry preview project URL accessible (`curl -I "$SENTRY_PROJECT_URL"` HTTP 200)
- [ ] Sentry token (`$SENTRY_TOKEN`) で stats API 取得可:
  ```bash
  curl -s -H "Authorization: Bearer $SENTRY_TOKEN" \
    "https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJ}/stats/?stat=received&resolution=1h" \
    | head -c 100
  ```
  期待: JSON 応答 (200)
- [ ] preview deploy で Sentry SDK 初期化 (`Sentry.init(...)`) が起動 ログで確認
- [ ] preview alert rule `error_rate > 1% (5min window)` 設定済
- [ ] alert routing が `#launch-dry-2026-06-19` (preview 専用) を向いている

担当: Dev

FAIL 時: SENTRY_TOKEN 失効 → 再発行 (Sentry settings) → D-8 23:59 JST 再確認

---

## §6 Supabase preview branch 整合

D-8 までに Supabase preview branch が production schema と整合していること。

- [ ] Supabase preview branch 存在確認 (`supabase branches list` または Dashboard)
- [ ] `$SUPABASE_READONLY_URL` の readonly 接続テスト:
  ```bash
  psql "$SUPABASE_READONLY_URL" -c "select 1;"
  ```
  期待: `1` 返却
- [ ] preview branch の table 構造が production と diff なし (`supabase db diff --linked`)
- [ ] analytics.pageview_event table 存在 (`select count(*) from analytics.pageview_event` で 0 以上)
- [ ] public.contact_request table 存在 (`select count(*) from public.contact_request` で 0 以上)
- [ ] readonly role に対し `SELECT` のみ grant (INSERT/UPDATE/DELETE/DROP 不可確認)

担当: Dev

FAIL 時: schema diff あり → Dev が migration 同期 → D-8 23:59 JST 再確認

---

## §7 OG image preview URL 4 variant × 2 locale = 8 case 全 200 OK

D-8 までに OG image 8 variant が preview URL で 200 返却すること。

| # | locale | variant | URL pattern | HTTP code | 完了 |
|---|---|---|---|---|---|
| 1 | ja | home | `${PREVIEW_URL}/api/og?type=home&lang=ja` | 200 | [ ] |
| 2 | ja | case-studies | `${PREVIEW_URL}/api/og?type=case-studies&lang=ja` | 200 | [ ] |
| 3 | ja | portfolio | `${PREVIEW_URL}/api/og?type=portfolio&lang=ja` | 200 | [ ] |
| 4 | ja | about | `${PREVIEW_URL}/api/og?type=about&lang=ja` | 200 | [ ] |
| 5 | en | home | `${PREVIEW_URL}/api/og?type=home&lang=en` | 200 | [ ] |
| 6 | en | case-studies | `${PREVIEW_URL}/api/og?type=case-studies&lang=en` | 200 | [ ] |
| 7 | en | portfolio | `${PREVIEW_URL}/api/og?type=portfolio&lang=en` | 200 | [ ] |
| 8 | en | about | `${PREVIEW_URL}/api/og?type=about&lang=en` | 200 | [ ] |

確認コマンド (一括):
```bash
for lang in ja en; do
  for type in home case-studies portfolio about; do
    code=$(curl -s -o /dev/null -w "%{http_code}" -I "${PREVIEW_URL}/api/og?type=${type}&lang=${lang}")
    echo "OG ${lang}/${type} ${code}"
  done
done
```

- [ ] 8 case 全 200 (FAIL 1 case でも confidence 評価で -3pt)
- [ ] OG image content-type が `image/png` または `image/jpeg`
- [ ] OG image サイズが 1200x630 (Twitter/Facebook 推奨)
- [ ] OG image 内のテキストがロケール毎に正しい (ja=日本語 / en=英語)

担当: Dev + Marketing

FAIL 時: og 生成 endpoint bug → Dev が hotfix → D-8 23:59 JST 再確認

---

## §8 各部門参加可否確認

D-8 までに 4 部門 + Owner + CEO の D-7 (6/12) 09:00-12:00 JST 同期取得が完了していること。

| 役割 | 担当者 | 同期取得 | 代理人 | 完了 |
|---|---|---|---|---|
| Web-Ops | _____ | 6/12 09:00-12:00 reserved | _____ | [ ] |
| Marketing | _____ | 6/12 09:00-12:00 reserved | _____ | [ ] |
| Dev | _____ | 6/12 09:00-12:00 reserved | _____ | [ ] |
| Review | _____ | 6/12 09:00-12:00 reserved (10:00-10:45 必須) | _____ | [ ] |
| CEO | _____ | 6/12 09:00-12:00 reserved (Phase 1/3/6 必須) | _____ | [ ] |
| Owner | _____ | 6/12 09:00-09:05 reserved (T24-07 sign のみ / 5 min) | (CARD H) | [ ] |

- [ ] 6 名全員から calendar 確認 reply 受領
- [ ] 1 名でも欠席 → 代理人 (各部門副責) を assign / Owner は CARD H backup contact 経由
- [ ] D-7 09:00 開始 5 min 前 (08:55) に Slack で全員出席確認 post 予定 (Web-Ops 担当)

担当: CEO + Marketing

FAIL 時: 部門欠席 → CEO 判断で代理人 assign / D-8 23:59 JST までに reply 全件取得

---

## §9 D-8 EOD 集計 (Web-Ops 1 名記入 / CEO 1 名承認)

### §1〜§8 集計

| § | section | 項目数 | GREEN 数 | 完了 |
|---|---|---|---|---|
| §1 | env 整合性 | 19 + 3 | __ / 22 | [ ] |
| §2 | preview deploy | 11 | __ / 11 | [ ] |
| §3 | Slack ch | 6 | __ / 6 | [ ] |
| §4 | cron preview | 5 | __ / 5 | [ ] |
| §5 | Sentry preview | 5 | __ / 5 | [ ] |
| §6 | Supabase preview | 6 | __ / 6 | [ ] |
| §7 | OG image 8 case | 8 + 3 | __ / 11 | [ ] |
| §8 | 各部門参加 | 6 + 3 | __ / 9 | [ ] |
| **合計** | | **75** | **__ / 75** | [ ] |

### GREEN 基準
- 75 項目全 [x] 完了 → D-7 本 rehearsal 開始 GO
- 70 項目以上 [x] かつ blocker 0 件 → CEO 判断で D-7 開始 (SKIP 想定)
- 70 項目未満 → D-7 当日 09:00 開始 hold → 09:30 まで延長 → 不能なら D-3 (6/16) に再 schedule

### サインオフ
- Web-Ops 記入: ___________________ (sign + timestamp)
- CEO 承認: ___________________ (sign + timestamp)
- D-8 EOD timestamp: 2026-06-11 ___:___ JST

### Slack 報告 (D-8 EOD)
```bash
curl -s -X POST "$SLACK_WEBHOOK_DRY" \
  -d '{"text":"[D-8 validation] GREEN __/75 / D-7 09:00 開始 GO|HOLD by=CEO at=2026-06-11 17:00 JST"}'
```

---

## §10 副作用 0 担保 (D-8 検収後チェック)

- [ ] 全 curl コマンドが HEAD or read-only (POST は Slack dry channel のみ)
- [ ] Supabase 接続が readonly role 限定
- [ ] Vercel preview deploy 1 件のみ (production deploy 0)
- [ ] Sentry alert rule 設定は preview project に限定
- [ ] cron preview enable / production cron disable 維持
- [ ] DB write 0 / 本番 DNS 変更 0 / 本番 Slack 投稿 0 / 絵文字 0
- [ ] API $ コスト 0 (Lighthouse / Sentry / GA / Slack 既存契約 free tier 内)

---

**最終更新**: 2026-05-05 (Round 21 第 2 波 / Marketing-O / D-8 pre-rehearsal validation 起票)
**派生元**: Round 21 Marketing-O `launch-dry-run-rehearsal-detailed-procedure-2026-06-12.md` / Round 20 v2 SOP §Pre-condition CARD A-H
**次回見直し**: 2026-06-11 17:00 JST (D-8 EOD 検収) → 6/12 09:00 JST (D-7 本 rehearsal 開始)
