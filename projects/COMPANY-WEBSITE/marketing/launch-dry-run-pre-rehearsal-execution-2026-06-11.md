# 6/11 D-8 Pre-Rehearsal Validation 実行手順書 (Execution Procedure)

## 0. 概要

- **対象**: PRJ-019 / COMPANY-WEBSITE 公開 (2026-06-19 09:00 JST 想定 / 確度 80% Round 21 完遂時)
- **本書 role**: D-8 = 2026-06-11 09:00-18:00 JST 9 時間枠 で Marketing-O R21 起票の `launch-dry-run-pre-rehearsal-validation-checklist-2026-06-11.md` (75 項目 / 259 行) を **dry-run シミュレーション** として実機実行可能な step 手順書化する
- **派生元**:
  - Round 21 Marketing-O `launch-dry-run-pre-rehearsal-validation-checklist-2026-06-11.md` (検収 checklist 形式 / 75 項目 / 不変保持)
  - Round 21 Marketing-O `launch-dry-run-rehearsal-detailed-procedure-2026-06-12.md` (D-7 詳細手順 821 行 / 不変保持)
  - Round 21 Web-Ops-H `owner-action-cards/INDEX.md` (OWN-PRE-01〜07 / 80 min)
- **構成**: 5 Phase × 計 75 項目を実行 step 化
- **完了基準**: 75/75 GREEN (許容: 70/75 GREEN + blocker 0 件 → CEO 判断で D-7 開始)
- **副作用**: 0 (HEAD / read-only / dry channel post / preview env のみ)
- **絵文字 0 / Heroicons 参照のみ / API 追加コスト $0**
- **関連 DEC**: DEC-019-025 (background dispatch SOP 19 件目) / DEC-019-033 (knowledge 抽出経路) / DEC-019-062 (cron 5 本) / DEC-019-054 (portfolio v3.1 hash)

## 0.1 D-8 全体時間配分 (5 Phase)

| Phase | 時間帯 | 所要 | 対象 § | 項目数 | 主担当 |
|---|---|---|---|---|---|
| Phase 1 | 09:00-11:00 JST | 120 min | §1 env 整合性 + §2 preview deploy | 22 + 11 = 33 | Web-Ops + Dev |
| Phase 2 | 11:00-13:00 JST | 120 min | §3 Slack ch + §6 Supabase preview + §7 OG image | 6 + 6 + 11 = 23 | Web-Ops + Dev + Marketing |
| Phase 3 | 13:00-15:00 JST | 120 min | §4 cron preview + §5 Sentry preview | 5 + 5 = 10 | Web-Ops + Dev |
| Phase 4 | 15:00-17:00 JST | 120 min | §8 各部門参加 + 再 verify pass (1-7) | 9 + 6 spot = 15 | CEO + Marketing |
| Phase 5 | 17:00-18:00 JST | 60 min | §9 集計 + §10 副作用 0 担保 + Slack 報告 | wrap-up | Web-Ops + CEO |
| **合計** | | **540 min (9h)** | | **75** | |

## 0.2 各 step 記述形式

各 step は以下 5 要素で構成 (Owner formal「引き続き丁寧に」directive 順守):

1. **担当**: Web-Ops / Dev / Marketing / Review / CEO / Owner のいずれか
2. **実行 step**: 1-3 行の具体操作 (確認コマンド or 画面操作)
3. **期待結果**: GREEN 判定の output 文字列例 / 状態
4. **FAIL 時 escalation**: 1 次判断者 / 連絡経路 / 再実行 SLA
5. **記入欄**: D-8 当日の実測値 / timestamp / [x]

---

## §1 Phase 1: 09:00-11:00 JST 環境整備 (120 min / 33 項目)

### Phase 1 の goal
- §1 env 整合性 22 項目 + §2 preview deploy 11 項目 = 33 項目を GREEN 化
- D-7 当日に Phase 1 が即時 PASS となる土台を確立

### step 1-1: 09:00-09:05 全員 stand-up (5 min)

- **担当**: Web-Ops
- **実行 step**:
  ```bash
  curl -s -X POST "$SLACK_WEBHOOK_DRY" \
    -H 'Content-Type: application/json' \
    -d '{"text":"[D-8 validation] 09:00 stand-up start / Phase 1 (env + preview deploy) 開始"}'
  ```
- **期待結果**: HTTP 200 / channel `#launch-dry-2026-06-19` に post
- **FAIL 時**: SLACK_WEBHOOK_DRY 未 export → §1.3 step に飛ぶ → 5 min 内復旧
- **記入欄**: timestamp ___:___ / [ ]

### step 1-2 〜 1-20: §1 env 19 変数 export 確認 (09:05-09:45 / 40 min)

- **担当**: Web-Ops (1, 2, 6, 8, 9), Dev (3, 7, 10, 11, 12, 13, 14, 15, 16, 17), Marketing (4, 5), CEO (18, 19)
- **実行 step**: checklist §1 表の 19 行を 1 行ずつ shell で実行:
  ```bash
  source .env.dryrun
  for var in PREVIEW_URL TARGET_URL SLACK_WEBHOOK_DRY EXPECTED_EN_HASH \
             EXPECTED_PORTFOLIO_HASH VERCEL_TEAM CRON_PROD_PR CDN_HOST \
             VERCEL_ANALYTICS_URL SENTRY_PROJECT_URL GA_REALTIME_URL \
             SENTRY_TOKEN GA_TOKEN SUPABASE_READONLY_URL SENTRY_ORG \
             SENTRY_PROJ GA_PROP LAUNCH_DATE_JST LAUNCH_TIMESTAMP; do
    val=$(eval echo "\$$var")
    [ -z "$val" ] && echo "FAIL $var (empty)" || echo "PASS $var (len=${#val})"
  done
  ```
- **期待結果**: 19 行全件 `PASS` 出力 / 期待値 (URL / 64 hex / token 5 文字確認 / 整数 / slug / `2026-06-19` / `2026-06-19T00:00:00Z`)
- **FAIL 時**:
  - 1 変数 empty → 該当担当部門に Slack mention → 15 min 内 export 完了 → 再確認
  - 4 変数以上 empty → CEO エスカレーション → D-8 23:59 JST 延長判断
- **記入欄**: PASS ___ / 19 / FAIL list ___

### step 1-21: 09:45-09:50 §1 sub-criteria 3 項目 (5 min)

- **担当**: Web-Ops
- **実行 step**:
  - [ ] `.env.dryrun` ファイル所在確認 (Vault or 1Password Slack Integration)
  - [ ] Plain text on disk でないことを確認 (`ls -la .env.dryrun` → 600 permission)
  - [ ] `source .env.dryrun` 実行後 19 変数全件非空再確認
- **期待結果**: 3 項目全 [x]
- **FAIL 時**: Plain text あり → 即時 Vault 移管 (Web-Ops 5 min 作業)
- **記入欄**: 3/3 [ ]

### step 1-22 〜 1-32: 09:50-10:50 §2 Vercel preview deploy 11 項目 (60 min)

- **担当**: Web-Ops + Dev
- **実行 step**:
  ```bash
  # 1. Vercel build status
  vercel ls --scope "$VERCEL_TEAM" | grep "$PREVIEW_URL" | grep -q "Ready" && echo "PASS build status"
  
  # 2-9. preview 8 endpoint HEAD 200 確認
  for path in "" "/case-studies" "/portfolio" "/about" "/contact" "/en" "/en/case-studies" "/en/portfolio"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" -I "${PREVIEW_URL}${path}")
    echo "preview ${path:-/} ${code}"
  done
  
  # 10. preview build ログ ERROR 0
  vercel logs "$PREVIEW_URL" --scope "$VERCEL_TEAM" 2>&1 | grep -c "ERROR" 
  
  # 11. NEXT_PUBLIC_* env 反映確認 (favicon / OG image preview URL)
  curl -s "${PREVIEW_URL}/favicon.ico" -o /dev/null -w "%{http_code}\n"
  ```
- **期待結果**:
  - build status `Ready`
  - 8 endpoint 全 200
  - ERROR count = 0
  - favicon 200
- **FAIL 時**:
  - 1 endpoint 非 200 → Dev 緊急 hotfix → preview rebuild → D-8 23:59 JST 再 verify
  - build ERROR > 0 → Dev 即時調査 → root cause 同定 → fix → rebuild
- **記入欄**: PASS ___ / 11 / 各 endpoint code ___

### step 1-33: 10:50-11:00 Phase 1 集計 + Slack 中間報告 (10 min)

- **担当**: Web-Ops
- **実行 step**:
  ```bash
  curl -s -X POST "$SLACK_WEBHOOK_DRY" \
    -d "{\"text\":\"[D-8 validation] Phase 1 done: env ___/22 + preview ___/11 = ___/33\"}"
  ```
- **期待結果**: 33/33 GREEN (許容: 30/33 + blocker 0)
- **FAIL 時**: 30 未満 → CEO 判断 → Phase 2 開始 hold or 並行延長
- **記入欄**: 集計 ___ / 33 / 開始 09:00 / 終了 ___:___

---

## §2 Phase 2: 11:00-13:00 JST SOP 連携系 (120 min / 23 項目)

### Phase 2 の goal
- §3 Slack ch 6 項目 + §6 Supabase preview 6 項目 + §7 OG image 11 項目 = 23 項目を GREEN 化
- D-7 当日 SOP 連携系 (vault hash / Slack reachability / DB read-only / OG 8 case) を全件確認

### step 2-1 〜 2-6: 11:00-11:30 §3 Slack ch 6 項目 (30 min)

- **担当**: Web-Ops + Marketing
- **実行 step**:
  - [ ] Slack channel `#launch-dry-2026-06-19` 存在確認 (Web-Ops が channel admin である事を画面で確認)
  - [ ] webhook URL bind 確認 (Slack admin > Apps > Incoming Webhooks)
  - [ ] reachability test (curl で HTTP 200)
  - [ ] 4 部門責任者 + CEO + Owner join 確認 (channel members 6 名以上)
  - [ ] channel topic 文言確認 (「D-7 rehearsal 用 / 本番投稿禁止」)
  - [ ] pinned message 文言確認 (「NoGO SLA: 30min / Owner 遅延 case E」)
- **期待結果**: 6/6 GREEN
- **FAIL 時**:
  - webhook 401 → Slack admin 再発行 (15 min) → 再 test
  - 部門 join 不在 → 各部門責任者に DM mention (5 min) → join 確認
- **記入欄**: 6/6 [ ]

### step 2-7 〜 2-12: 11:30-12:00 §6 Supabase preview 6 項目 (30 min)

- **担当**: Dev
- **実行 step**:
  ```bash
  # 1. preview branch 存在
  supabase branches list | grep -q "preview" && echo "PASS branch"
  
  # 2. readonly 接続テスト
  psql "$SUPABASE_READONLY_URL" -c "select 1;"
  
  # 3. schema diff
  supabase db diff --linked
  
  # 4. analytics.pageview_event 存在
  psql "$SUPABASE_READONLY_URL" -c "select count(*) from analytics.pageview_event limit 1;"
  
  # 5. public.contact_request 存在
  psql "$SUPABASE_READONLY_URL" -c "select count(*) from public.contact_request limit 1;"
  
  # 6. readonly grant 確認 (INSERT 不可)
  psql "$SUPABASE_READONLY_URL" -c "insert into public.contact_request(email) values ('test');" 2>&1 | grep -q "permission denied" && echo "PASS readonly"
  ```
- **期待結果**: 6/6 GREEN / readonly grant 確認では `permission denied` 文字列を返却
- **FAIL 時**:
  - schema diff ありで Phase 2 hold → Dev migration 同期 → D-8 23:59 JST 再 verify
  - readonly が writable で grant FAIL → 即時 role 修正 (10 min)
- **記入欄**: 6/6 [ ] / 各 query 結果 ___

### step 2-13 〜 2-23: 12:00-13:00 §7 OG image 11 項目 (60 min)

- **担当**: Dev + Marketing
- **実行 step**:
  ```bash
  # 8 case 一括確認
  for lang in ja en; do
    for type in home case-studies portfolio about; do
      url="${PREVIEW_URL}/api/og?type=${type}&lang=${lang}"
      code=$(curl -s -o /dev/null -w "%{http_code}" -I "$url")
      ctype=$(curl -s -I "$url" | grep -i "content-type" | awk '{print $2}' | tr -d '\r')
      echo "OG ${lang}/${type} code=${code} ctype=${ctype}"
    done
  done
  ```
  追加 3 項目:
  - [ ] content-type が `image/png` または `image/jpeg`
  - [ ] image サイズ 1200x630 (`identify` or `file` で確認)
  - [ ] locale 別テキスト整合 (ja=日本語 / en=英語、Marketing 目視確認 5 case sample)
- **期待結果**: 8 case 全 200 + 3 sub 全件 [x] = 11/11
- **FAIL 時**:
  - 1 case 以上 200 以外 → Dev 即時 hotfix (og 生成 endpoint bug) → D-8 中再 verify
  - confidence -3pt 影響 (§2.2 減点) → CEO 判断
- **記入欄**: 8 case ___ / 8 + 3 sub ___ / 3 = 11/11 [ ]

---

## §3 Phase 3: 13:00-15:00 JST cron + Sentry (120 min / 10 項目)

### Phase 3 の goal
- §4 cron preview 5 項目 + §5 Sentry preview 5 項目 = 10 項目を GREEN 化
- preview cron heartbeat 観測 (10 min) + Sentry stats API 動作確認

### step 3-1 〜 3-5: 13:00-13:50 §4 cron preview 5 項目 (50 min)

- **担当**: Web-Ops + Dev
- **実行 step**:
  ```bash
  # 1. preview project cron 5 本 enabled 確認
  vercel cron ls --scope "$VERCEL_TEAM" --project preview | grep -E "(heartbeat|kpi-aggregation|sentry-sync|ga-sync|vault-rotate)" | wc -l
  
  # 2. production project cron disabled 確認
  vercel cron ls --scope "$VERCEL_TEAM" --project production | grep -E "enabled.*false" | wc -l
  
  # 3. 名前確認 (5 本: heartbeat / kpi-aggregation / sentry-sync / ga-sync / vault-rotate)
  
  # 4. preview cron heartbeat 5 min interval 観測 (10 min 観測 = 2 回 post 期待)
  # [ 13:30-13:40 JST に Slack ch を 10 min 観測 ]
  
  # 5. CRON_PROD_PR approve 状態確認
  gh pr view "$CRON_PROD_PR" --json reviewDecision -q '.reviewDecision'
  ```
- **期待結果**:
  - preview 5 本全 enabled
  - production 5 本全 disabled
  - 5 本名前一致
  - 10 min 観測で 2 回 dummy post 確認 (Slack `#launch-dry-2026-06-19`)
  - PR `APPROVED` (merge せず)
- **FAIL 時**:
  - cron mismatch → Web-Ops Dashboard 再設定 (15 min) → 再 verify
  - heartbeat 不発 → Dev cron schedule 確認 → cron expression 修正
  - PR `REVIEW_REQUIRED` → Review 部門 review 依頼 (15 min)
- **記入欄**: 5/5 [ ] / heartbeat post 数 ___

### step 3-6 〜 3-10: 13:50-14:50 §5 Sentry preview 5 項目 (60 min)

- **担当**: Dev
- **実行 step**:
  ```bash
  # 1. Sentry preview project URL accessible
  curl -s -o /dev/null -w "%{http_code}" -I "$SENTRY_PROJECT_URL"
  
  # 2. Sentry stats API 動作確認
  curl -s -H "Authorization: Bearer $SENTRY_TOKEN" \
    "https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJ}/stats/?stat=received&resolution=1h" \
    | head -c 100
  
  # 3. preview deploy で Sentry SDK 初期化 ログ確認
  vercel logs "$PREVIEW_URL" --scope "$VERCEL_TEAM" 2>&1 | grep "Sentry.init" | head -1
  
  # 4. preview alert rule `error_rate > 1% (5min)` 設定確認 (Sentry Dashboard 画面確認)
  
  # 5. alert routing が `#launch-dry-2026-06-19` を向いている (Sentry Integrations 画面確認)
  ```
- **期待結果**:
  - URL 200/302
  - stats API JSON 応答 200
  - Sentry.init ログ 1 件以上
  - alert rule + routing GREEN
- **FAIL 時**:
  - SENTRY_TOKEN 失効 → 再発行 (Sentry settings) → §1 env 表更新 → 再 verify
  - alert rule 未設定 → Dev Sentry Dashboard で即時設定 (15 min)
- **記入欄**: 5/5 [ ]

### step 3-11: 14:50-15:00 Phase 3 集計 + 中間報告 (10 min)

- **担当**: Web-Ops
- **実行 step**:
  ```bash
  curl -s -X POST "$SLACK_WEBHOOK_DRY" \
    -d "{\"text\":\"[D-8 validation] Phase 3 done: cron ___/5 + Sentry ___/5 = ___/10\"}"
  ```
- **期待結果**: 10/10 GREEN (許容: 9/10 + blocker 0)
- **FAIL 時**: 9 未満 → CEO 判断 → Phase 4 hold
- **記入欄**: 10/10 [ ]

---

## §4 Phase 4: 15:00-17:00 JST 部門参加 + spot 再 verify (120 min / 15 項目)

### Phase 4 の goal
- §8 各部門参加 9 項目を GREEN 化
- 加えて Phase 1-3 で残った FAIL/SKIP の spot 再 verify (最大 6 件)

### step 4-1 〜 4-9: 15:00-16:30 §8 各部門参加 9 項目 (90 min)

- **担当**: CEO + Marketing
- **実行 step**:
  - [ ] Web-Ops 担当者氏名 + 6/12 09:00-12:00 reserved 確認 + 代理人 assign
  - [ ] Marketing 担当者氏名 + reserved 確認 + 代理人
  - [ ] Dev 担当者氏名 + reserved 確認 + 代理人
  - [ ] Review 担当者氏名 + 6/12 10:00-10:45 必須 reserved + 代理人
  - [ ] CEO 氏名 + Phase 1/3/6 必須 reserved + 代理人
  - [ ] Owner 氏名 + 6/12 09:00-09:05 (T24-07 sign 5 min) reserved + CARD H backup contact 名 確認
  - [ ] 6 名全員から calendar reply 受領 (Slack DM or email)
  - [ ] 1 名でも欠席 → 代理人 assign 完了 / Owner は CARD H 経路
  - [ ] D-7 09:00 開始 5 min 前 (08:55) Slack 出席確認 post 予定担当: Web-Ops 確定
- **期待結果**: 9/9 GREEN
- **FAIL 時**:
  - 1 名欠席 → CEO が代理人 assign (15 min)
  - Owner reply 未着 → CEO 直接電話 (CARD H backup contact) → 5 min 以内 reply
- **記入欄**: 9/9 [ ]

### step 4-10 〜 4-15: 16:30-17:00 spot 再 verify 最大 6 件 (30 min)

- **担当**: 各 FAIL 担当部門
- **実行 step**: Phase 1-3 で FAIL/blocker 判定された項目を再実行
  - 最大 6 件想定 (env 1-2, preview 1-2, OG 1, Sentry 1)
  - 各 5 min × 6 = 30 min
- **期待結果**: 全件 GREEN 化
- **FAIL 時**: 再 verify 後も FAIL → CEO 判断 → D-8 23:59 JST 延長 / D-7 当日 SKIP 想定
- **記入欄**: 再 verify 件数 ___ / 全件 GREEN [ ]

---

## §5 Phase 5: 17:00-18:00 JST 集計 + wrap-up (60 min)

### Phase 5 の goal
- §9 集計 (75 項目) + §10 副作用 0 担保 + Slack 報告 + サインオフ
- D-7 09:00 GO / HOLD 判定確定

### step 5-1: 17:00-17:30 §9 集計 (30 min)

- **担当**: Web-Ops
- **実行 step**: checklist §9 表 8 行を集計:

  | § | section | 項目数 | GREEN | 完了 |
  |---|---|---|---|---|
  | §1 | env 整合性 | 22 | __/22 | [ ] |
  | §2 | preview deploy | 11 | __/11 | [ ] |
  | §3 | Slack ch | 6 | __/6 | [ ] |
  | §4 | cron preview | 5 | __/5 | [ ] |
  | §5 | Sentry preview | 5 | __/5 | [ ] |
  | §6 | Supabase preview | 6 | __/6 | [ ] |
  | §7 | OG image | 11 | __/11 | [ ] |
  | §8 | 各部門参加 | 9 | __/9 | [ ] |
  | **合計** | | **75** | **__/75** | [ ] |

- **期待結果**: 75/75 GREEN (D-7 開始 GO 確定) / 70/75 + blocker 0 (CEO 判断 GO) / 70 未満 (D-7 hold)
- **FAIL 時**: 70 未満 → CEO 判断 → D-7 09:00 開始 hold → 09:30 まで延長 → 不能なら D-3 (6/16) 再 schedule
- **記入欄**: 75/75 集計 ___

### step 5-2: 17:30-17:45 §10 副作用 0 担保チェック (15 min)

- **担当**: Web-Ops
- **実行 step**: checklist §10 7 項目を [x]:
  - [ ] 全 curl コマンド HEAD or read-only
  - [ ] Supabase 接続 readonly role 限定
  - [ ] Vercel preview deploy 1 件のみ (production deploy 0)
  - [ ] Sentry alert rule preview project 限定
  - [ ] cron preview enable / production disable 維持
  - [ ] DB write 0 / 本番 DNS 変更 0 / 本番 Slack 投稿 0 / 絵文字 0
  - [ ] API $ コスト 0 (Lighthouse / Sentry / GA / Slack 全 free tier 内)
- **期待結果**: 7/7 [x]
- **FAIL 時**: 1 項目以上 → CEO 即時報告 → 副作用発生案件として Round 22 引継
- **記入欄**: 7/7 [ ]

### step 5-3: 17:45-17:55 サインオフ (10 min)

- **担当**: Web-Ops 記入 + CEO 承認
- **実行 step**:
  - Web-Ops sign + timestamp 記入
  - CEO sign + timestamp 記入
  - D-8 EOD timestamp: `2026-06-11 17:55 JST`
- **期待結果**: 2 sign 取得
- **FAIL 時**: CEO 不在 → CEO 代行 (PM 部門 head) sign / Owner email 通知
- **記入欄**: Web-Ops _____ / CEO _____ / timestamp _____

### step 5-4: 17:55-18:00 Slack EOD 報告 (5 min)

- **担当**: Web-Ops
- **実行 step**:
  ```bash
  curl -s -X POST "$SLACK_WEBHOOK_DRY" \
    -d "{\"text\":\"[D-8 validation] EOD GREEN __/75 / D-7 09:00 開始 GO|HOLD by=CEO at=2026-06-11 17:55 JST\"}"
  ```
- **期待結果**: HTTP 200 / 4 部門 + Owner + CEO 全員確認
- **FAIL 時**: Slack 不達 → email broadcast template (Case C) 適用 / Round 22 引継
- **記入欄**: timestamp ___:___ / [ ]

---

## §6 完了基準 (D-8 全体)

| 集計 | 数値 | GO 条件 |
|---|---|---|
| GREEN 75 項目中 | __ / 75 | 75/75 → GO 確定 / 70-74 + blocker 0 → CEO 判断 / 70 未満 → HOLD |
| 副作用 0 担保 | __ / 7 | 7/7 必須 |
| Web-Ops sign | _____ | 必須 |
| CEO sign | _____ | 必須 |
| Slack EOD post | [ ] | 必須 |
| D-7 09:00 開始 GO/HOLD | [GO/HOLD] | CEO 確定 |

## §7 不合格時 fallback

### D-8 不合格基準
- GREEN < 70/75 (FAIL > 5)
- Web-Ops or CEO sign 不在
- Slack EOD post 不発

### D-8 23:59 JST 延長
- 17:55 時点で 70 未満 → CEO 判断で 23:59 JST まで延長
- Web-Ops + Dev は残業で復旧作業 (FAIL 項目 spot 修正)
- 23:59 JST までに 70 達成不能 → D-7 09:00 開始 hold + D-3 (6/16) 再 schedule

### D-7 当日 SKIP 想定
- D-8 で 70-74 GREEN + blocker 0 → D-7 当日に SKIP 項目を識別 (許容: 最大 5 件 SKIP)
- D-7 PASS 38/40 baseline は維持

---

## §8 関連 DEC / KPI / Round 22 引継

- DEC-019-025: background dispatch SOP 19 件目 (本書 + D-7 prep + 6/19 timeline + 報告書 4 件まとめて 1 件カウント)
- DEC-019-033: knowledge 抽出経路 (本書を `organization/knowledge/patterns/d8-prerehearsal-execution.md` 候補化)
- DEC-019-054: portfolio v3.1 hash check (§1.5 + §2.4)
- DEC-019-062: cron 5 本 + CRON_SECRET (§4 cron preview + §3 step 2-3)

KPI 連動:
- 17 日 path 完成度: 本書で D-8 execution 物理化 → +1 path
- DEC trajectory: DEC-019-070 (Round 21 候補) → DEC-019-071 候補 (D-8 execution 採決) として CEO 提案
- 11-HITL: 本書は HITL 第 9 種 `dev_kickoff_approval` 対象外 (運用 SOP 詳細手順)

Round 23 引継 (Marketing-Q 想定):
1. D-8 実測値の本書反映 (実 GREEN 数 + FAIL list)
2. D-7 当日結果による confidence 実測値 path 反映
3. D-3 再 rehearsal 必要時の prep checklist (本書 fork)

---

## §9 副作用 0 担保 (D-8 検収後チェック)

- [ ] 全 curl コマンド HEAD or POST (Slack dry channel のみ)
- [ ] Supabase 接続 readonly role 限定
- [ ] Vercel preview 1 件のみ
- [ ] Sentry alert rule preview project 限定
- [ ] cron preview enable / production disable 維持
- [ ] DB write 0 / 本番 DNS 変更 0 / 本番 Slack 投稿 0 / 絵文字 0
- [ ] API $ コスト 0
- [ ] Round 21 4 ファイル (detailed-procedure / pre-rehearsal-validation / log-template / confidence-spec) 無改変
- [ ] Marketing-L R18 launch-rehearsal-execution-script 無改変
- [ ] Heroicons 参照のみ / 他アイコン 0

---

**最終更新**: 2026-05-05 (Round 22 / Marketing-P / D-8 pre-rehearsal execution 起票)
**派生元**: Round 21 Marketing-O 4 ファイル / Round 21 Web-Ops-H Owner action card INDEX
**次回見直し**: 2026-06-11 17:55 JST (D-8 EOD 検収) → 6/12 09:00 JST (D-7 本 rehearsal 開始)
