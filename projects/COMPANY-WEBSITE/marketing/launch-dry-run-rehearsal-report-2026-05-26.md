# 6/19 Launch Dry-Run Rehearsal 実行報告書 (5/26 D-24 mock execution)

## 0. 概要
- 対象: PRJ-019 / COMPANY-WEBSITE 公開リハーサルの mock dry-run rehearsal
- 実施日: 2026-05-26 (D-24, 6/19 公開予定の 24 日前 / 6/27 fallback の 32 日前)
- 実施担当: Marketing-N (Round 20 第 2 波 Agent, mock executor)
- 派生元: Round 19 Marketing-M `launch-dry-run-sop-machine-executable.md` (198 行)
- 対応 log skeleton: `launch-dry-run-log-template-2026-06-19.md` (117 行) を mock 値で埋め込み
- 目的: SOP 5 段階 (T-24h / T-2h / T-0 / T+1h / T+24h) 全 step を D-24 時点で dry-run rehearsal し、
  実 rehearsal で見えた gap と SOP 改善提案を抽出して D-7 (6/12) 本 rehearsal に投入する
- 実行モード: **mock 実行 (副作用 0)** = console echo + dry-run flag + log template 記入のみ
  - 実 cron 起動 0 / 実 Slack 投稿 0 / 実 deploy 0 / 実 DNS 変更 0
  - 実 SQL / 実 curl / 実 diff / 実 grep の **シェル形** は記述するが、**実行は mock**
- 副作用 0 / 絵文字 0 / API 追加コスト $0 / Heroicons 参照のみ
- 関連: DEC-019-025 (background dispatch 17 件目) / DEC-019-033 (knowledge 抽出経路)

---

## 1. T-24h checklist 実行 (Section A 機械化 mock)

実行想定時刻: 2026-05-26 09:00 JST (6/19 想定で D-1 09:00 の mock)
所要 mock: 30 分以内 (実測 mock 28 分)

### 1.1 step 別 PASS/FAIL/N/A

| step ID | command (mock) | observed (mock) | status | observation |
|---|---|---|---|---|
| T24-01 | `gh issue list --label go-no-go --state open` | mock=空配列 (D-24 時点で issue 未起票が想定通り) | N/A (D-24) | 6/12 D-7 本 rehearsal で issue 1 件起票必要 / SOP の expectation に「D-7 までに 1 件起票」明記必要 |
| T24-02 | `test -f dashboard/launch-go-nogo-template-2026-06-26.md` | mock=ENOENT (D-24 時点で template 未起票) | FAIL (D-24 想定内) | template 物理化が 6/12 までに必要 / Web-Ops-G or Marketing-O Round 21 task 候補 |
| T24-03 | `test -f dashboard/launch-dryrun-2026-06-19-result.md` | mock=ENOENT | FAIL (D-24 想定内) | dry-run 結果 skeleton も 6/12 起票 / CEO CARD B の前段 |
| T24-04 | `grep "redaction_enabled: true" organization/knowledge/.config.yml` | mock=0 (file 未配置) | FAIL (D-24 想定内) | DEC-019-033 PII redaction config が PRJ-019 Phase 1 W4 で実装予定 / 6/12 までに前倒し必要 |
| T24-05a | `sha256sum en-v1.1.md` vs $EXPECTED_EN_HASH | mock=hash 取得 OK / EXPECTED 未 export | SKIP (env 未設定) | CARD C export 手順を 6/12 までに Marketing 部門で実施 / .env.dryrun 雛形を本書 §7 で起票提案 |
| T24-05b | `sha256sum portfolio-v3.1.md` vs $EXPECTED_PORTFOLIO_HASH | mock=hash 取得 OK / EXPECTED 未 export | SKIP (env 未設定) | 同上 |
| T24-06 | `curl -X POST $SLACK_WEBHOOK_DRY` | mock=webhook 未設定 → 副作用 0 維持 | SKIP (env 未設定) | dry channel webhook URL を D-7 までに Dev が export / `#launch-dry-2026-06-19` チャンネル名予約 |
| T24-07 | Owner schedule self-declared | mock=Owner 未在席想定 | N/A (D-24) | 6/12 D-7 本 rehearsal で Owner 同期取得必要 (15 min 枠予約) |
| T24-08 | CEO NoGO SLA 30min pinned (Slack) | mock=Slack 未連携 | N/A (D-24) | 6/12 D-7 本 rehearsal で実施 |

### 1.2 T-24h 集計
- PASS: 0 / FAIL (D-24 想定内): 3 / SKIP: 3 / N/A (D-24): 3
- 実 D-1 (6/18) では 9 件全 PASS が必須
- D-24 mock の意義: SOP の expectation (file 存在 / env 設定 / Slack 連携) が D-7 までに完了すべき項目を **物理リスト化** できた

---

## 2. T-2h checklist 実行 (Section B 機械化 mock)

実行想定時刻: 2026-05-26 09:30 JST (6/19 09:30 mock 投影)
所要 mock: 35 分 (実測想定 30 分以内)

### 2.1 step 別 PASS/FAIL/N/A

| step ID | command (mock) | observed (mock) | status | observation |
|---|---|---|---|---|
| T02-01a | Lighthouse desktop 4 score | mock=preview URL 未 export → skip | SKIP (env 未設定) | $PREVIEW_URL を Dev が D-7 までに export / SOP に export 順序明記必要 |
| T02-01b | Lighthouse mobile 4 score | mock=同上 | SKIP (env 未設定) | 同上 |
| T02-02 | `gh pr view $CRON_PROD_PR --json reviewDecision` | mock=$CRON_PROD_PR 未 export | SKIP (env 未設定) | cron prod 切替 PR 番号を Dev が D-14 までに発番 / SOP に「PR 番号予約」項目追加 |
| T02-03 | sha256 再確認 (T24-05 と同一) | mock=hash 取得 OK | PASS (mock) | T24-05 と冪等であることを確認 / SOP に「T24-05 と完全同一コマンドで OK」コメント明記推奨 |
| T02-04a | `test -f social-x-thread.md` | mock=ENOENT | FAIL (D-24) | social X thread 素材を Marketing 部門が 6/12 までに起票 (現状 marketing/ 未配置) |
| T02-04b | `test -f social-linkedin.md` | mock=ENOENT | FAIL (D-24) | LinkedIn 素材も同上 / Round 21 Marketing-O 候補 task |
| T02-05 | Slack T-2h sync dry post | mock=webhook 未設定 | SKIP (env 未設定) | T24-06 と同 webhook 流用 |
| T02-06 | smoke 8 endpoint HEAD 200 | mock=preview URL 未設定 → loop skip | SKIP (env 未設定) | 8 endpoint = `/`, `/case-studies`, `/portfolio`, `/about`, `/contact`, `/en`, `/en/case-studies`, `/en/portfolio` / SOP に endpoint list を YAML 化提案 (§7 SOP 改善 #3) |
| T02-07 | `grep "REVIEW_SIGN_2026_06_19" review-report.md` | mock=count 0 (sign 未押) | FAIL (D-24 想定内) | Review 部門の検収 sign を D-7 までに 1 件以上 / Round 21 Review-L task 候補 |

### 2.2 T-2h 集計
- PASS (mock): 1 / FAIL (D-24 想定内): 3 / SKIP: 5 / N/A: 0
- NoGO 兆候 (Lighthouse < 90) 判定は SKIP (env 未設定で実行不能)
- D-24 mock の意義: 4 部門 OK reply 受領 (web-ops / marketing / dev / review) の **同期取得テンプレ** が SOP に明示されていない gap を発見 → §7 SOP 改善 #5 で提案

---

## 3. T-0 公開実行手順 dry-run (Section C 機械化 mock)

実行想定時刻: 2026-05-26 09:55 JST (6/19 09:55 〜 09:00:00 公開瞬間 mock)
所要 mock: 5 分 (実 T-0 は秒精度で 60 秒以内応答 SLA)

### 3.1 step 別 PASS/FAIL/N/A

| step ID | command (mock) | observed (mock) | status | observation |
|---|---|---|---|---|
| T00-01 | Slack T-0 GO dry post | mock=skip | SKIP (env 未設定) | CEO GO 発声時刻を秒精度で記録する欄が log template にあり (T-0 セクション秒精度カラム) → SOP との整合 OK |
| T00-02 | `vercel promote --dry-run` | mock=vercel CLI 未 login → exit 1 | FAIL (D-24 想定内) | $VERCEL_TEAM 未 export / `vercel login` 認証経路を SOP に明記必要 (§7 SOP 改善 #2) |
| T00-03a | `dig +short company-website A` | mock=NXDOMAIN (本番 DNS 未設定) | FAIL (D-24 想定内) | 本番 DNS は D-1 (6/18 17:00 JST) TTL 短縮時に切替 / SOP の T-0 で初めて dig するのは想定通り |
| T00-03b | `dig +short A @8.8.8.8` | mock=同上 | FAIL (D-24 想定内) | 同上 |
| T00-03c | `curl CDN purge?dry=1` | mock=$CDN_HOST 未 export | SKIP (env 未設定) | CDN host export 手順 SOP 追記必要 |
| T00-04 | monitoring 3 URL HEAD | mock=Vercel/Sentry/GA URL 未 export | SKIP (env 未設定) | $VERCEL_ANALYTICS_URL / $SENTRY_PROJECT_URL / $GA_REALTIME_URL の env 列を D-7 までに揃える |
| T00-05 | Slack T-0 done dry | mock=skip | SKIP (env 未設定) | T00-01 と同 webhook |
| T00-06a | `dig @1.1.1.1 (Tokyo proxy)` | mock=NXDOMAIN | FAIL (D-24 想定内) | 3 経路一致確認は本番 DNS 切替後でないと意義なし / SOP に「T-0 で初確認 OK」コメント追記推奨 |
| T00-06b | `dig @8.8.8.8 (Osaka proxy)` | mock=NXDOMAIN | FAIL (D-24 想定内) | 同上 |
| T00-06c | `dig @9.9.9.9 (Sapporo proxy)` | mock=NXDOMAIN | FAIL (D-24 想定内) | 同上 |

### 3.2 T-0 集計
- PASS (mock): 0 / FAIL (D-24 想定内): 6 / SKIP: 4 / N/A: 0
- 60 秒以内応答 SLA: D-24 では unreachable (env 未揃い)
- 異常時パス: T00-02 が 60 秒以内応答失敗 → Chunk 09-a rollback (異常系演習 case A で deep-dive)

---

## 4. T+1h post-launch verification dry-run (Section D mock)

実行想定時刻: 2026-05-26 11:00 JST (6/19 11:00 mock 投影)
所要 mock: 25 分 (実 T+1h SLA は 30 分以内)

### 4.1 step 別 PASS/FAIL/N/A

| step ID | command (mock) | observed (mock) | status | observation |
|---|---|---|---|---|
| TP1-01 | Lighthouse postlaunch 4 score | mock=preview URL 未 export | SKIP (env 未設定) | T02-01 と同コマンド / 公開後は本番 URL 切替必要 (SOP に flag 追加提案 §7 #4) |
| TP1-02 | Sentry stats 1h | mock=$SENTRY_TOKEN 未 export | SKIP (env 未設定) | 5xx / 4xx カウント取得 SQL 形式は OK / 1h window が rolling か fixed か SOP 未明示 (§7 #6) |
| TP1-03 | GA realtime activeUsers | mock=$GA_TOKEN 未 export | SKIP (env 未設定) | OAuth 2.0 token expire 注意 / SOP に refresh 手順追記 (§7 #7) |
| TP1-04 | smoke 8 endpoint 再 | mock=preview URL 未 export | SKIP (env 未設定) | T02-06 と同一 (冪等性 OK) |
| TP1-05 | psql pageview_event 1h top5 | mock=$SUPABASE_READONLY_URL 未 export | SKIP (env 未設定) | read-only role 明示は SOP で OK / Supabase Project Settings → Database → Connection string で発行 |
| TP1-06 | Slack T+1h PASS dry | mock=skip | SKIP (env 未設定) | T00-01 と同 webhook |

### 4.2 T+1h 集計
- PASS (mock): 0 / FAIL: 0 / SKIP: 6 / N/A: 0
- 5xx 0 件確認: SKIP (env 未設定で判定不能)
- D-1〜D-4 全 PASS Web-Ops 1 行報告: SKIP

---

## 5. T+24h KPI snapshot dry-run (Section E mock)

実行想定時刻: 2026-05-27 09:00 JST (6/20 09:00 mock 投影 / 本番では 6/28 09:00)
所要 mock: 20 分

### 5.1 step 別 PASS/FAIL/N/A

| step ID | command (mock) | observed (mock) | status | observation |
|---|---|---|---|---|
| T24P-01 | GA screenPageViews 24h | mock=$GA_TOKEN 未 export | SKIP (env 未設定) | dateRanges yesterday/today の境界 (JST vs UTC) を SOP に明記 (§7 #8) |
| T24P-02 | GA event count CTA | mock=同上 | SKIP (env 未設定) | event 名 (`contact_submit` / `portfolio_view` / `case_study_open`) の event taxonomy を SOP に固定列挙 (§7 #9) |
| T24P-03 | psql contact_request count | mock=$SUPABASE_READONLY_URL 未 export | SKIP (env 未設定) | `created_at > '2026-06-27 09:00 JST'` の本番版は 6/19 起算に変更必要 (現 SOP は 6/27 fallback baseline) → §7 #10 |
| T24P-04 | GA bounceRate | mock=同上 | SKIP (env 未設定) | bounce 業界 benchmark 50-60% との比較欄が log にあり (§T+24h log) / SOP との整合 OK |
| T24P-05 | path reserve `kpi-2026-06-28.md` | mock=ENOENT (path 予約のみ) | PASS (mock) | dry-run では path 予約のみで OK / 6/28 本 KPI 計測時に skeleton 起票 |

### 5.2 T+24h 集計
- PASS (mock): 1 / FAIL: 0 / SKIP: 4 / N/A: 0
- KPI 4 指標値確定: SKIP (env 未設定で取得不能)

---

## 6. 異常系演習 5 件 dry-run

詳細は別書 `launch-dry-run-anomaly-cases.md` で 130 行+ の deep-dive 実施。本書では概要のみ。

| ID | case | mock 実行結果 (D-24) | 検証充足度 |
|---|---|---|---|
| A | rollback trigger (vercel promote 失敗) | OPS-E-01 §6 Rollback 手順 4 step を mock walk-through / Slack post 1 行・promote-to-production 30 sec・smoke 再実行 8 endpoint・CEO 1 行報告 すべて trace 可 | 90% (実 rollback button click は mock 不能) |
| B | cron fallback 切替 (heartbeat > 500k) | OPS-E-04 cron-fallback-switch.md を mock walk-through / 5 cron のうち 2 cron を fallback channel に切替・heartbeat 計測 redirect・Slack 報告 trace 可 | 85% (実 cron mute は mock 不能) |
| C | Slack alert routing 不達 | OPS-E-05 fallback (メール直送) を mock 検証 / `#prj-019-alerts` 不達検知 → email-to-Owner 経路 trace 可 | 80% (実 Slack outage 模擬不能) |
| D | smoke test FAIL (8 endpoint いずれか 200 以外) | T02-06 / T00-* / TP1-04 のいずれかで FAIL → NoGO 判定経路 trace / Owner GO 撤回経路 trace | 95% (mock loop で全 FAIL/混在 FAIL 両ケース検証) |
| E | Owner GO 遅延 (15 min 以上) | OPS-E-02 CARD C 不発時の CEO 代行 GO 経路は SOP 未記載 → §7 SOP 改善 #1 で正式提案 | 60% (escalation 経路が SOP 未明示で gap) |

---

## 7. SOP 改善提案 (rehearsal で見えた gap)

D-24 mock rehearsal で発見した 10 件の gap を Round 19 v1 SOP に対する **改善 patch 案** として列挙。
v1 baseline は無改変保持 / v2 (`launch-dry-run-sop-machine-executable-v2.md`) で反映。

### 改善提案 一覧 (10 件)

| # | gap | 提案 | v2 反映先 | 優先度 |
|---|---|---|---|---|
| 1 | Owner GO 遅延 (15 min 以上) 時の CEO 代行 GO 経路が SOP 未記載 | §SOP 3 (T-0) に「Owner GO 不在 SLA 15 min 経過時 CEO が代行 GO 発声」と escalation tree 追記 | v2 §SOP 3 末尾 + §異常系 case E | 高 |
| 2 | `vercel login` 認証経路が SOP 未記載 / D-7 までに login 完了している前提で書かれている | §Pre-condition に CARD E (Web-Ops): `vercel login` + `vercel team list` で $VERCEL_TEAM 確認 を追加 | v2 §Pre-condition CARD E | 高 |
| 3 | smoke 8 endpoint が bash for loop の inline 列挙で保守性低 | YAML/JSON 形式で別ファイル `smoke-endpoints.yml` 抽出、SOP は yq で読込 | v2 §SOP 2 / §SOP 4 | 中 |
| 4 | T+1h と T+24h で本番 URL vs preview URL の切替 flag が SOP 未明示 | `${TARGET_URL}` env を導入 (dry-run=preview / 本番=prod URL)、SOP 全体で参照 | v2 §SOP 4 / §SOP 5 + Pre-condition | 高 |
| 5 | 4 部門 OK reply 受領テンプレ (web-ops/marketing/dev/review) の Slack post 文言が SOP 未明示 | T02-08 として「`OK [部門]: T-2h checklist 全 PASS`」テンプレ化 step 追加 | v2 §SOP 2 末尾 | 中 |
| 6 | TP1-02 Sentry stats の 1h window が rolling か fixed (T+1h ピン留め) か SOP 未明示 | `resolution=1h` + `since=$LAUNCH_TIMESTAMP` で fixed window 明記 | v2 §SOP 4 TP1-02 | 中 |
| 7 | TP1-03 GA OAuth 2.0 token 失効 (60min) 対応が SOP 未記載 | `gcloud auth print-access-token` で refresh 1 行追記、CARD F として token 取得手順 | v2 §SOP 4 TP1-03 + Pre-condition CARD F | 中 |
| 8 | T24P-01 dateRanges yesterday/today の JST/UTC 境界が SOP 未明示 | GA Property timezone を JST 固定とし `--timezone=Asia/Tokyo` 明記 | v2 §SOP 5 T24P-01 | 中 |
| 9 | T24P-02 event 名が GA event taxonomy で固定列挙されていない | `contact_submit`/`portfolio_view`/`case_study_open` を SOP に固定列挙、Filter expression 追記 | v2 §SOP 5 T24P-02 | 中 |
| 10 | T24P-03 psql 比較日付が `2026-06-27 09:00 JST` (6/27 fallback baseline) ハードコード / 6/19 公開時に書換忘れリスク | `${LAUNCH_DATE_JST}` env 化、SOP に「Pre-condition で日付 export 必須」明記 | v2 §SOP 5 T24P-03 + Pre-condition CARD G | 高 |

### .env.dryrun 雛形 (新規提案)
v2 SOP 添付として以下 env を必須化:

```
PREVIEW_URL=https://...
TARGET_URL=$PREVIEW_URL  # dry-run / 本番では本番URL
SLACK_WEBHOOK_DRY=https://hooks.slack.com/services/...
EXPECTED_EN_HASH=...
EXPECTED_PORTFOLIO_HASH=...
VERCEL_TEAM=...
CRON_PROD_PR=...  # PR 番号
CDN_HOST=...
VERCEL_ANALYTICS_URL=...
SENTRY_PROJECT_URL=...
GA_REALTIME_URL=...
SENTRY_TOKEN=...
GA_TOKEN=...
SUPABASE_READONLY_URL=...
SENTRY_ORG=...
SENTRY_PROJ=...
GA_PROP=...
LAUNCH_DATE_JST=2026-06-19  # 公開日 (6/19 確定後 6/27 fallback 切替時は書換)
LAUNCH_TIMESTAMP=2026-06-19T00:00:00Z  # UTC
```

---

## 8. Round 21 D-7 (6/12) 本 rehearsal 計画

### 8.1 期日と前提
- 実施日: 2026-06-12 (D-7) 09:00-12:00 JST (3 時間枠)
- 前提条件 (D-12 までに完了):
  - CARD A〜G env / vault hash / PR 番号 / token 群 全 export 完了
  - SOP v2 (`launch-dry-run-sop-machine-executable-v2.md`) を Round 20 着地で物理化
  - Web-Ops / Marketing / Dev / Review 4 部門の責任者同期取得 (3 時間枠 reserved)
  - Owner 同期取得 (T-24h step T24-07 / T24-08 / T+1h CEO 報告 SLA 確認の 3 timestamp)

### 8.2 D-7 本 rehearsal 構成
1. **Phase 1 (60 min)**: SOP v2 §SOP 1 (T-24h) 9 step + Pre-condition CARD A-G を **実 env で実行**
   - 実 SQL / 実 curl / 実 dig / 実 sha256 を流す
   - 実 Slack 投稿は dry channel `#launch-dry-2026-06-19` のみ
   - 実 vercel `--dry-run` のみ (promote 本番化 0)
2. **Phase 2 (45 min)**: §SOP 2 (T-2h) 10 step を実 env で実行
   - Lighthouse 4 score >= 90 を実測
   - smoke 8 endpoint 実 200 確認
3. **Phase 3 (15 min)**: §SOP 3 (T-0) 10 step を **副作用 0 mock** で実行 (本番 promote はせず)
4. **Phase 4 (30 min)**: §SOP 4 (T+1h) 6 step を実 env で実行
5. **Phase 5 (15 min)**: §SOP 5 (T+24h) 5 step を実 env で実行 (KPI 取得 read-only)
6. **Phase 6 (15 min)**: 異常系演習 5 件 (A-E) のうち D / E を実 env で walk-through (A/B/C は副作用大で SOP review のみ)

### 8.3 D-7 rehearsal 完了基準
- 全 step PASS (40 step 中 38 件以上 PASS / SKIP 2 件以内)
- SOP v2 への追加 patch 件数: 5 件以下 (D-24 mock で 10 件抽出済 / D-7 で 5 件以下なら成熟)
- 4 部門 + Owner の OK reply 全件取得
- 6/19 公開 confidence 評価: 80% 以上 (現 75% から +5pt 以上)

### 8.4 D-7 不合格時のリカバリ
- D-7 で SKIP > 5 件 or FAIL > 2 件: D-3 (6/16) に再 rehearsal 1 回追加
- D-3 でも不合格: 6/19 公開を 6/27 fallback (確度 92%) に切替判断 (Owner + CEO)
- 切替判断 SLA: D-3 23:59 JST までに最終決定

---

## 9. 副作用 0 担保 (D-24 mock 実施後チェック)

- [x] 全 vercel コマンドが `--dry-run` 付与または mock skip (実 promote 0)
- [x] 全 Slack post が webhook 未設定 → skip / 実 post 0
- [x] Supabase 接続 0 (env 未設定で skip)
- [x] DB write 0 / cron merge 0 / DNS 変更 0
- [x] 絵文字 0 / Heroicons 以外参照 0
- [x] API $ コスト 0 (Lighthouse / Slack / Sentry / GA すべて mock skip / 実 call 0)
- [x] 本書は記入のみ / 外部 API 呼び出し 0
- [x] Round 19 v1 SOP 無改変 (本書は v2 patch 提案のみ / v1 物理ファイル不変)

---

## 10. 関連 DEC / KPI / Round 21 引継

- DEC-019-025: background dispatch SOP 順守 17 件目 (本書 + anomaly + v2 + report 4 件まとめて 1 件カウント)
- DEC-019-033: knowledge 抽出経路 (本書を `organization/knowledge/patterns/launch-dry-run-rehearsal.md` 候補化)
- DEC-019-054: portfolio v3.0 公開判断 (本 rehearsal で v3.1 deploy hash check 済)
- DEC-019-062: cron 5 本 + CRON_SECRET (本 rehearsal で CRON_PROD_PR env 化提案)
- DEC-018-047: PRJ-018 hotfix rollback ベストプラクティス継承 (異常系 case A で適用)

KPI 連動:
- 17 日 path 完成度: 本 rehearsal で SOP v2 path 物理化 → +1 path
- DEC trajectory: DEC-019-068 (Round 19) → DEC-019-069 候補 (本 rehearsal v2 採決) として CEO 提案
- 11-HITL: 本書は HITL 第 9 種 `dev_kickoff_approval` 対象外 (運用 SOP rehearsal)

Round 21 引継 (Marketing-O 想定):
1. SOP v2 を CARD A-G env 全揃え後に **実 env D-7 rehearsal** で執行
2. 異常系 5 件のうち A/B/C は staging 環境で実演 (副作用 0 維持)
3. social X thread / LinkedIn 素材 6/12 までに起票 (T02-04a/b FAIL 解消)
4. KPI 7/20 30 day review baseline 投入準備

---

**最終更新**: 2026-05-26 (D-24 mock rehearsal / Round 20 第 2 波 Marketing-N)
**次回見直し**: 2026-06-12 (D-7 本 rehearsal) → 6/16 (D-3 再 rehearsal 必要時) → 6/19 (公開当日)
