# 6/19 Launch Dry-Run 機械実行 SOP v2 (Machine-Executable / D-24 mock rehearsal 反映版)

## 概要
- 対象: PRJ-019 / COMPANY-WEBSITE 公開リハーサル (2026-06-19 dry-run)
- 派生元: Round 19 Marketing-M `launch-dry-run-sop-machine-executable.md` (v1 / 198 行 / 不変保持)
- v2 改版理由: Round 20 Marketing-N `launch-dry-run-rehearsal-report-2026-05-26.md` D-24 mock rehearsal で抽出した 10 件 gap 反映
- 改版範囲: dry-run flag option 追加 / 異常系 escalation 整理 / .env.dryrun 雛形固定 / event taxonomy 列挙 / 日付 env 化
- 副作用 0 / 絵文字 0 / API 追加コスト $0 / Heroicons 参照のみ
- v1 baseline は historical 不変保持 (本書は新規ファイル / v1 物理ファイル無編集)
- 関連: DEC-019-025 (background dispatch 17 件目) / DEC-019-033 (knowledge 抽出経路)

## v1 → v2 主要変更点 (10 件)
| # | v1 → v2 変更 | 反映先 §section |
|---|---|---|
| 1 | Owner GO 遅延時 CEO 代行 GO escalation tree 追加 | §SOP 3 末尾 + §異常系 case E |
| 2 | `vercel login` 認証 CARD E 追加 | §Pre-condition CARD E |
| 3 | smoke 8 endpoint を `smoke-endpoints.yml` 抽出 (パス列挙保守化) | §SOP 2 / §SOP 4 |
| 4 | `${TARGET_URL}` env 導入 (dry-run=preview / 本番=prod URL 切替) | §Pre-condition + §SOP 4 / §SOP 5 |
| 5 | 4 部門 OK reply Slack post テンプレ T02-08 step 追加 | §SOP 2 末尾 |
| 6 | TP1-02 Sentry stats fixed window 明示 (`since=$LAUNCH_TIMESTAMP`) | §SOP 4 TP1-02 |
| 7 | TP1-03 GA OAuth token refresh CARD F 追加 | §SOP 4 + §Pre-condition CARD F |
| 8 | T24P-01 GA timezone JST 明示 | §SOP 5 T24P-01 |
| 9 | T24P-02 event taxonomy 固定列挙 (contact_submit / portfolio_view / case_study_open) | §SOP 5 T24P-02 |
| 10 | T24P-03 psql 比較日付 `${LAUNCH_DATE_JST}` env 化 | §SOP 5 T24P-03 + §Pre-condition CARD G |

## .env.dryrun 雛形 (v2 必須化)

```bash
# Web-Ops が D-7 (6/12) までに export 完了させる env list
export PREVIEW_URL=https://...
export TARGET_URL=$PREVIEW_URL  # dry-run時 / 本番では prod URL に切替
export SLACK_WEBHOOK_DRY=https://hooks.slack.com/services/...
export EXPECTED_EN_HASH=...
export EXPECTED_PORTFOLIO_HASH=...
export VERCEL_TEAM=...
export CRON_PROD_PR=...  # cron prod 切替 PR 番号
export CDN_HOST=...
export VERCEL_ANALYTICS_URL=...
export SENTRY_PROJECT_URL=...
export GA_REALTIME_URL=...
export SENTRY_TOKEN=...
export GA_TOKEN=...
export SUPABASE_READONLY_URL=...
export SENTRY_ORG=...
export SENTRY_PROJ=...
export GA_PROP=...
export LAUNCH_DATE_JST=2026-06-19  # 公開日 / 6/27 fallback 切替時は本変数のみ書換
export LAUNCH_TIMESTAMP=2026-06-19T00:00:00Z  # UTC 09:00 JST
```

## Web-Ops Hand-off Pre-condition (v2: CARD E/F/G/H 追加)

本 SOP 実行前に Owner と CEO + Web-Ops + Dev が下記カードを完了させること。未完了の場合 Web-Ops は SOP を発火させない。

- CARD A (Owner): 6/26 朝 09:00 JST に GO/NoGO 判断票テンプレを Owner inbox で受領済
- CARD B (CEO): `dashboard/launch-dryrun-2026-06-19-result.md` を 6/19 朝 09:00 までに skeleton 作成
- CARD C (Marketing): en v1.1 / portfolio v3.1 の Vault hash を `.env.dryrun` に export 済
- CARD D (Dev): `${PREVIEW_URL}` `${TARGET_URL}` `${SLACK_WEBHOOK_DRY}` を Web-Ops shell に export 済
- **CARD E (Web-Ops, v2 新設)**: `vercel login` + `vercel team list` で `$VERCEL_TEAM` 確認済
- **CARD F (Dev, v2 新設)**: `gcloud auth print-access-token` で `$GA_TOKEN` 取得・60min 以内に refresh 手順確認済
- **CARD G (CEO, v2 新設)**: `$LAUNCH_DATE_JST` を `.env.dryrun` に export 済 (6/19 or 6/27 fallback)
- **CARD H (Owner, v2 新設)**: 公開当日 backup contact (家族 or 同僚) 1 名を CEO に共有済 (case E Owner GO 遅延対策)
- 上記 8 件すべて GREEN を Slack #launch-2026-06-19 に CEO が 1 行 post → Web-Ops が SOP run を開始

## ステップ ID 命名規則 (v1 と同一)
- `T24-NN` = T-24h チェックリスト (Section A 由来)
- `T02-NN` = T-2h チェックリスト (Section B 由来)
- `T00-NN` = T-0 公開実行 (Section C 由来)
- `TP1-NN` = T+1h post-launch (Section D 由来)
- `T24P-NN` = T+24h KPI snapshot (Section E 由来)

---

## SOP 1: T-24h チェックリスト (Section A 機械化 / v1 と同一)

```bash
# T24-01: Owner inbox 受信確認 (Web-Ops 補助 / read-only)
gh issue list --repo claude-code-company/internal --label "go-no-go" --state open --json number,title

# T24-02: GO/NoGO 判断票テンプレ存在確認
test -f "dashboard/launch-go-nogo-template-2026-06-26.md" && echo "PASS T24-02" || echo "FAIL T24-02"

# T24-03: 6/19 dry-run 結果サマリ skeleton 確認
test -f "dashboard/launch-dryrun-2026-06-19-result.md" && echo "PASS T24-03" || echo "FAIL T24-03"

# T24-04: PII redaction config 確認 (DEC-019-033 + 第 11 種 HITL)
grep -c "redaction_enabled: true" organization/knowledge/.config.yml || echo "FAIL T24-04"

# T24-05: en v1.1 / portfolio v3.1 SHA256 vault 一致
EN_HASH=$(sha256sum projects/COMPANY-WEBSITE/marketing/en-v1.1.md | awk '{print $1}')
PORTFOLIO_HASH=$(sha256sum projects/COMPANY-WEBSITE/marketing/portfolio-v3.1.md | awk '{print $1}')
[ "$EN_HASH" = "$EXPECTED_EN_HASH" ] && echo "PASS T24-05a" || echo "FAIL T24-05a"
[ "$PORTFOLIO_HASH" = "$EXPECTED_PORTFOLIO_HASH" ] && echo "PASS T24-05b" || echo "FAIL T24-05b"

# T24-06: Slack channel reachability (dry post)
curl -s -o /dev/null -w "%{http_code}" -X POST "$SLACK_WEBHOOK_DRY" -d '{"text":"T24-06 reachability dry"}'

# T24-07: Owner schedule blocker check (本人申告のみ、log に記入)
echo "T24-07 manual: Owner self-declared blocker-free 6/19 08:30-10:00 JST"

# T24-08: NoGO SLA 通達確認 (Slack thread 検索)
echo "T24-08 manual: CEO confirms NoGO SLA 30min documented in #launch-2026-06-19 pinned"
```
- 期待: T24-01〜T24-08 全 PASS、Owner が CEO に「T-24h チェック完了」1 行返信
- 所要: 30 分以内
- v2 変更: なし (v1 と完全同一)

---

## SOP 2: T-2h チェックリスト (Section B 機械化 / v2: smoke-endpoints.yml 抽出 + T02-08 追加)

```bash
# T02-01: Lighthouse Desktop / Mobile / a11y / SEO (preview scope)
npx --yes lighthouse "$TARGET_URL" --only-categories=performance,accessibility,best-practices,seo \
  --preset=desktop --output=json --output-path=./lh-desktop.json --chrome-flags="--headless"
npx --yes lighthouse "$TARGET_URL" --only-categories=performance,accessibility,best-practices,seo \
  --form-factor=mobile --output=json --output-path=./lh-mobile.json --chrome-flags="--headless"

# T02-02: cron prod 切替 PR の approval 状態 (merge せず)
gh pr view "$CRON_PROD_PR" --json reviewDecision,mergeable -q '.reviewDecision'

# T02-03: en v1.1 / portfolio v3.1 SHA256 再確認 (T24-05 と同コマンド)
sha256sum projects/COMPANY-WEBSITE/marketing/en-v1.1.md projects/COMPANY-WEBSITE/marketing/portfolio-v3.1.md

# T02-04: ソーシャル素材 dry-run (本投稿せず)
test -f projects/COMPANY-WEBSITE/marketing/social-x-thread.md && echo "PASS T02-04a"
test -f projects/COMPANY-WEBSITE/marketing/social-linkedin.md && echo "PASS T02-04b"

# T02-05: Slack T-2h 同期 post (dry channel)
curl -s -X POST "$SLACK_WEBHOOK_DRY" \
  -H 'Content-Type: application/json' \
  -d '{"text":"[dry-run] T-2h sync: web-ops/marketing/dev/review GREEN"}'

# T02-06 (v2 改): smoke test 8 endpoint via smoke-endpoints.yml (HEAD 200)
# v2 では projects/COMPANY-WEBSITE/marketing/smoke-endpoints.yml に endpoint 列挙
# 例 yml:
#   endpoints:
#     - /
#     - /case-studies
#     - /portfolio
#     - /about
#     - /contact
#     - /en
#     - /en/case-studies
#     - /en/portfolio
for path in $(yq '.endpoints[]' projects/COMPANY-WEBSITE/marketing/smoke-endpoints.yml); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -I "${TARGET_URL}${path}")
  echo "T02-06 ${path} ${code}"
done

# T02-07: Review 部門検収 sign 存在
grep -c "REVIEW_SIGN_2026_06_19" projects/COMPANY-WEBSITE/reports/review-report.md

# T02-08 (v2 新設): 4 部門 OK reply Slack post (テンプレ化)
# 各部門責任者が下記テンプレで `#launch-2026-06-19` に post
# Web-Ops:  curl -X POST "$SLACK_WEBHOOK_DRY" -d '{"text":"OK web-ops: T-2h checklist 全 PASS"}'
# Marketing: curl -X POST "$SLACK_WEBHOOK_DRY" -d '{"text":"OK marketing: T-2h checklist 全 PASS"}'
# Dev:       curl -X POST "$SLACK_WEBHOOK_DRY" -d '{"text":"OK dev: T-2h checklist 全 PASS"}'
# Review:    curl -X POST "$SLACK_WEBHOOK_DRY" -d '{"text":"OK review: T-2h checklist 全 PASS"}'
echo "T02-08 manual: 4 部門 OK reply 受領完了 (web-ops/marketing/dev/review)"
```
- 期待: T02-01 で 4 score >= 90、T02-06 で 8 endpoint 全 200、T02-07 で sign 1 件以上、T02-08 で 4 部門 reply 全件
- NoGO 兆候: Lighthouse 4 項目のいずれか < 90 → 即時 hold (Case D smoke FAIL escalation 適用)
- v2 変更: T02-06 を yml 駆動に変更 / T02-08 step 新設

---

## SOP 3: T-0 公開実行 (Section C 機械化 / v2: Owner GO 遅延 escalation tree 追加)

```bash
# T00-01: CEO GO 受領を Slack に明示 (dry)
curl -s -X POST "$SLACK_WEBHOOK_DRY" -d '{"text":"[dry-run] T-0 CEO GO received 09:00:00 JST"}'

# T00-02: vercel promote dry-run (副作用 0)
vercel promote "$PREVIEW_URL" --dry-run --scope "$VERCEL_TEAM" 2>&1 | head -20

# T00-03: DNS TTL 確認 + CDN purge 模擬
dig +short company-website.example A
dig +short company-website.example A @8.8.8.8
curl -s -X POST "https://${CDN_HOST}/purge?dry=1" -o /dev/null -w "%{http_code}"

# T00-04: monitoring dashboard URL 健在性
for url in "$VERCEL_ANALYTICS_URL" "$SENTRY_PROJECT_URL" "$GA_REALTIME_URL"; do
  curl -s -o /dev/null -w "%{http_code} $url\n" -I "$url"
done

# T00-05: T-0 完了 reply (dry)
curl -s -X POST "$SLACK_WEBHOOK_DRY" -d '{"text":"[dry-run] T-0 done, T+1h smoke standby"}'

# T00-06: DNS 3 経路一致 (Tokyo / Osaka / Sapporo を public resolver で代替)
dig +short company-website.example A @1.1.1.1   # Tokyo proxy
dig +short company-website.example A @8.8.8.8   # Osaka proxy
dig +short company-website.example A @9.9.9.9   # Sapporo proxy
```

### v2 新設: Owner GO 遅延 escalation tree (Case E)

T-0 (09:00:00 JST) 起算で Owner GO 発声監視を CEO が実施。

- **T+5min Owner 沈黙**: CEO が Owner に Slack DM + email + (可能なら) phone 確認
- **T+10min Owner 沈黙**: CEO が Owner 不在事由を `#launch-2026-06-19` に共有
- **T+15min Owner 沈黙 + Owner 連絡不能**: CEO が代行 GO 発声 (公開実行)
- **T+15min Owner 沈黙 + Owner 連絡可能**: CEO が Owner と協議し GO/Hold 判断
- **T+30min Owner GO 不発 + 連絡不能**: 公開延期 → 翌営業日 Owner 復帰後再判断 (CARD H backup contact 経由連絡継続)

判断テンプレ (CEO):
```
[OWNER DELAY] elapsed=__min owner_status=___ decision=CEO_PROXY_GO|HOLD by=CEO at=HH:MM:SS JST
```

CEO_PROXY_GO 採択時の手順:
```bash
# CEO が #launch-2026-06-19 に CEO_PROXY_GO 発声
curl -s -X POST "$SLACK_WEBHOOK_DRY" \
  -d '{"text":"[CEO_PROXY_GO] Owner unavailable 15min, CEO authorizes launch at HH:MM:SS JST"}'
# Web-Ops は通常 SOP §SOP 3 を T+15min から開始 (公開時刻 09:15 JST 想定)
```

- 期待: T00-02 で `[dry-run]` 表記 + 0 exit、T00-06 の 3 経路で同一 A record
- 異常時: T00-02 が 60 秒以内に応答しない → Case A rollback パスへ
- v2 変更: Owner GO 遅延 escalation tree 末尾追加 (case E 対応)

---

## SOP 4: T+1h post-launch (Section D 機械化 / v2: TARGET_URL 切替 + Sentry fixed window)

```bash
# TP1-01 (v2 改): Lighthouse 本番再計測 / TARGET_URL は本番 URL に切替
# 本番運用時: export TARGET_URL=https://www.4wide.co.jp
npx --yes lighthouse "$TARGET_URL" --only-categories=performance,accessibility,best-practices,seo \
  --output=json --output-path=./lh-postlaunch.json --chrome-flags="--headless"

# TP1-02 (v2 改): Sentry error rate / fixed window from $LAUNCH_TIMESTAMP
curl -s -H "Authorization: Bearer $SENTRY_TOKEN" \
  "https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJ}/stats/?stat=received&resolution=1h&since=${LAUNCH_TIMESTAMP}" \
  | head -c 500

# TP1-03 (v2 改): GA realtime + token refresh 手順明記
# 60min 経過時の refresh 手順:
#   GA_TOKEN=$(gcloud auth print-access-token)
curl -s -H "Authorization: Bearer $GA_TOKEN" \
  "https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROP}:runRealtimeReport" \
  -d '{"metrics":[{"name":"activeUsers"}]}' | head -c 500

# TP1-04 (v2 改): smoke test 8 endpoint via smoke-endpoints.yml (TARGET_URL)
for path in $(yq '.endpoints[]' projects/COMPANY-WEBSITE/marketing/smoke-endpoints.yml); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -I "${TARGET_URL}${path}")
  echo "TP1-04 ${path} ${code}"
done

# TP1-05: 確認 SQL (Supabase read-only)
psql "$SUPABASE_READONLY_URL" -c \
  "select event, count(*) from analytics.pageview_event where created_at > now() - interval '1 hour' group by 1 order by 2 desc limit 5;"

# TP1-06: 完了報告 (dry)
curl -s -X POST "$SLACK_WEBHOOK_DRY" -d '{"text":"[dry-run] T+1h D-1..D-4 PASS"}'
```
- 期待: TP1-01 で 4 score >= 90、TP1-02 で 5xx 0 件 (since=$LAUNCH_TIMESTAMP)、TP1-04 で 8 endpoint 全 200
- v2 変更: TP1-01 (TARGET_URL 切替) / TP1-02 (fixed window) / TP1-03 (token refresh 手順) / TP1-04 (yml 駆動)

---

## SOP 5: T+24h KPI snapshot (Section E 機械化 / v2: timezone JST + event taxonomy + LAUNCH_DATE_JST)

```bash
# T24P-01 (v2 改): Impression / GA timezone JST 明示
curl -s -H "Authorization: Bearer $GA_TOKEN" \
  "https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROP}:runReport" \
  -d '{
    "dateRanges":[{"startDate":"yesterday","endDate":"today"}],
    "metrics":[{"name":"screenPageViews"}],
    "timeZone":"Asia/Tokyo"
  }' | head -c 500

# T24P-02 (v2 改): Click event taxonomy 固定列挙
# event 名: contact_submit / portfolio_view / case_study_open
curl -s -H "Authorization: Bearer $GA_TOKEN" \
  "https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROP}:runReport" \
  -d '{
    "dimensions":[{"name":"eventName"}],
    "metrics":[{"name":"eventCount"}],
    "dimensionFilter":{
      "filter":{
        "fieldName":"eventName",
        "inListFilter":{"values":["contact_submit","portfolio_view","case_study_open"]}
      }
    },
    "timeZone":"Asia/Tokyo"
  }' | head -c 500

# T24P-03 (v2 改): Signup / LAUNCH_DATE_JST env 化
psql "$SUPABASE_READONLY_URL" -c \
  "select count(*) from public.contact_request where created_at > '${LAUNCH_DATE_JST} 09:00 JST';"

# T24P-04 (v2 改): Bounce / GA timezone JST 明示
curl -s -H "Authorization: Bearer $GA_TOKEN" \
  "https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROP}:runReport" \
  -d '{
    "metrics":[{"name":"bounceRate"}],
    "timeZone":"Asia/Tokyo"
  }' | head -c 500

# T24P-05 (v2 改): 出力 path 予約 / LAUNCH_DATE_JST + 1 day で動的算出
KPI_DATE=$(date -d "${LAUNCH_DATE_JST} + 1 day" +%Y-%m-%d 2>/dev/null || gdate -d "${LAUNCH_DATE_JST} + 1 day" +%Y-%m-%d)
test -f "dashboard/launch-kpi-${KPI_DATE}.md" || echo "T24P-05 path reserved: dashboard/launch-kpi-${KPI_DATE}.md (will create on T+24h)"
```
- 期待: T24P-01〜T24P-04 で値が取得可能、T24P-05 で path 予約のみ
- 副作用 0: 全コマンド read-only、書き込みは log template + KPI md 1 ファイルに限定
- v2 変更: T24P-01/02/04 (timezone JST) / T24P-02 (event taxonomy filter) / T24P-03 (LAUNCH_DATE_JST env) / T24P-05 (path 動的算出)

---

## 異常系 escalation tree (v2 統合 / 5 case まとめ)

詳細は `launch-dry-run-anomaly-cases.md` で 130 行+ 記述。本書は 1 行サマリ + escalation 入口のみ。

| case | 検知 step | 一次判断者 | 最終判断者 | 連絡 SLA | Owner 拘束 |
|---|---|---|---|---|---|
| A: rollback trigger | TP1-02 / TP1-04 | Web-Ops | CEO | 検知 → 3 min | 当日 1 min |
| B: cron fallback | KPI-01 E-2 heartbeat | Web-Ops | Web-Ops | 検知 → 10 min | 0 min |
| C: Slack alert 不達 | Slack heartbeat | Web-Ops | Marketing | 検知 → 15 min | 当日 1 min |
| D: smoke FAIL | T02-06 / T00-* / TP1-04 | Web-Ops | CEO | 検知 → 6 min | NoGO 5 min |
| E: Owner GO 遅延 | T-0 監視 | CEO | CEO | T-0 → 15 min | 復帰後 31 min |

---

## ログ記入規約 / 整合性 / 副作用 0 担保 (v1 と同一 + v2 追補)

- 各 step 実行直後に `launch-dry-run-log-template-2026-06-19.md` の対応セクションへ転記
- timestamp は `date -u +%Y-%m-%dT%H:%M:%SZ` で UTC 取得後 JST 換算、status は PASS / FAIL / SKIP
- FAIL の場合 notes に Slack thread URL 必須記入、Web-Ops 1 名記入 + CEO 1 名承認の 4 眼チェック
- 本 SOP は v1 SOP の Section A-E を 1:1 機械化、v1 baseline 不変保持
- 6/19 本番版は本 SOP を `launch-prod-sop-machine-executable.md` に複製 + dry flag を本番 flag に置換
- 副作用 0: vercel `--dry-run` 固定 / Slack dry webhook / Supabase read-only / Lighthouse preview URL / DB write 0 / cron merge 0 / DNS 変更 0 / 絵文字 0 / Heroicons 専用
- v2 追補: TARGET_URL 切替時も dry-run 期間中は preview URL 固定 / 本番 URL は 6/19 09:00 以降のみ使用

---

## v2 採用基準 (D-7 本 rehearsal で確証)

D-7 (6/12) 本 rehearsal で以下を満たした場合、v2 を 6/19 公開 SOP に正式採用:

- [ ] 8 CARD (A-H) 全 GREEN
- [ ] §SOP 1-5 で PASS 38 件以上 / SKIP 2 件以内 / FAIL 0 件
- [ ] 異常系 case D / E の staging 演習で escalation tree 通過
- [ ] 6/19 公開 confidence 評価: 80% 以上 (現 75% から +5pt)
- [ ] CEO + Owner 承認 sign 取得

未達時は v3 改版または 6/27 fallback 切替を CEO + Owner が判断 (D-3 23:59 JST までに最終決定)

---

**最終更新**: 2026-05-26 (Round 20 第 2 波 / Marketing-N v2 起票 / D-24 mock rehearsal 反映)
**v1 baseline**: `launch-dry-run-sop-machine-executable.md` (Round 19 Marketing-M / 198 行 / 不変保持)
**次回見直し**: 2026-06-12 (D-7 本 rehearsal で v2 採用判定) → 6/19 (公開当日 lock)
