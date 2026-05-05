# 6/12 D-7 本 Rehearsal Log Template (recording skeleton)

## 0. 概要

- **対象**: 2026-06-12 D-7 本 rehearsal (3 時間枠 09:00-12:00 JST) の実行記録
- **対応 procedure**: Round 21 Marketing-O `launch-dry-run-rehearsal-detailed-procedure-2026-06-12.md` (44 step / 6 Phase)
- **派生元**: Round 19 Marketing-M `launch-dry-run-log-template-2026-06-19.md` (117 行 / forward-port + 強化)
- **記入者**: Web-Ops (1 名 / 主) + 各 Phase 担当部門 (副), 承認者: CEO (1 名)
- **形式**: 各 step に PASS/FAIL/N/A 判定 + 実 output 貼付 + 異常 escalation 記入欄 + Owner 拘束時間記入
- **副作用 0 / 絵文字 0 / API 追加コスト $0 / Heroicons 参照のみ**
- **凡例**: PASS = 期待通り / FAIL = 期待値乖離 (Slack URL 必須) / N/A = 実行不能 (理由必須) / SKIP = 意図的 skip (D-7 の DNS 3 経路など)

---

## 実行前 Pre-condition (Web-Ops 確認 / D-8 EOD 状態)

D-8 EOD pre-rehearsal validation checklist (`launch-dry-run-pre-rehearsal-validation-checklist-2026-06-11.md`) で全 75 項目 GREEN を確認:

- [ ] §1 env 整合性 22/22 GREEN
- [ ] §2 preview deploy 11/11 GREEN
- [ ] §3 Slack ch 6/6 GREEN
- [ ] §4 cron preview 5/5 GREEN
- [ ] §5 Sentry preview 5/5 GREEN
- [ ] §6 Supabase preview 6/6 GREEN
- [ ] §7 OG image 8 case 11/11 GREEN
- [ ] §8 各部門参加 9/9 GREEN
- 全 75 項目 GREEN → D-7 09:00 開始 GO

CARD A-H (SOP v2 §Pre-condition):
- [ ] CARD A (Owner): GO/NoGO 判断票受領
- [ ] CARD B (CEO): dryrun-result skeleton 作成
- [ ] CARD C (Marketing): vault hash export 済
- [ ] CARD D (Dev): PREVIEW_URL / SLACK_WEBHOOK_DRY export 済
- [ ] CARD E (Web-Ops): vercel login + team list 確認済
- [ ] CARD F (Dev): GA_TOKEN 取得・refresh 手順確認済
- [ ] CARD G (CEO): LAUNCH_DATE_JST export 済
- [ ] CARD H (Owner): backup contact 1 名 CEO に共有済

CEO 全件 GREEN を Slack `#launch-dry-2026-06-19` に 1 行 post → 本 log の Phase 1 セクション開始

---

## §1 Phase 1: T-24h log (60 min / 9 step / 09:00-10:00 JST)

| timestamp (JST) | step ID | command (要約) | observed (output 先頭 1 行) | PASS/FAIL/N/A | 異常 escalation | Owner 拘束 |
|---|---|---|---|---|---|---|
|  | T24-01 | `gh issue list --label go-no-go` | | | | 0 min |
|  | T24-02 | `test -f go-nogo-template-2026-06-26` | | | | 0 min |
|  | T24-03 | `test -f dryrun-result-2026-06-19` | | | | 0 min |
|  | T24-04 | `grep redaction_enabled .config.yml` | | | | 0 min |
|  | T24-05a | `sha256 en-v1.1 vs $EXPECTED_EN_HASH` | | | | 0 min |
|  | T24-05b | `sha256 portfolio-v3.1 vs $EXPECTED_PORTFOLIO_HASH` | | | | 0 min |
|  | T24-06 | `curl Slack reachability dry post` | http __ | | | 0 min |
|  | T24-07 | Owner schedule self-declared | | | | 1 min (Slack 宣言) |
|  | T24-08 | CEO NoGO SLA 30min pinned | | | | 0 min |

### Phase 1 集計
- PASS: ___ / 9
- FAIL: ___ / 9 (FAIL 時 Slack thread URL 必須 → ____________)
- N/A: ___ / 9 (N/A 理由必須 → ____________)
- 開始: 09:___ JST / 終了: ___:___ JST / 差分: ___ 分
- 完了基準 PASS 9/9 達成: [ ] YES / [ ] NO
- 4 部門 + Owner OK reply 受領: [ ] (Phase 1 末尾の 1-9 step で集計)

---

## §2 Phase 2: T-2h log (45 min / 9 step / 10:00-10:45 JST)

| timestamp (JST) | step ID | command (要約) | observed | PASS/FAIL/N/A | 異常 escalation | Owner 拘束 |
|---|---|---|---|---|---|---|
|  | T02-01a | lighthouse desktop 4 score | perf=__ a11y=__ bp=__ seo=__ | | | 0 min |
|  | T02-01b | lighthouse mobile 4 score | perf=__ a11y=__ bp=__ seo=__ | | | 0 min |
|  | T02-02 | gh pr view $CRON_PROD_PR | reviewDecision=__ | | | 0 min |
|  | T02-03 | sha256 vault 再確認 | | | | 0 min |
|  | T02-04a | test -f social-x-thread | | | | 0 min |
|  | T02-04b | test -f social-linkedin | | | | 0 min |
|  | T02-05 | Slack T-2h sync dry | http __ | | | 0 min |
|  | T02-06 | smoke 8 endpoint HEAD | / __ /case __ /portfolio __ /about __ /contact __ /en __ /en/case __ /en/portfolio __ | | | 0 min |
|  | T02-07 | grep REVIEW_SIGN_2026_06_19 | count=__ | | | 0 min |
|  | T02-08 | 4 部門 OK reply Slack post | 4/4 件 | | | 0 min |

### Phase 2 集計
- PASS: ___ / 9
- FAIL: ___ / 9 (FAIL 時 Slack thread URL 必須 → ____________)
- N/A: ___ / 9 (N/A 理由必須 → ____________)
- 開始: 10:___ JST / 終了: ___:___ JST / 差分: ___ 分
- NoGO 判定: Lighthouse 4 score いずれか < 90 → [ ] (該当時 Case D escalation)
- 4 部門 OK reply 受領: web-ops [ ] marketing [ ] dev [ ] review [ ]
- 完了基準 PASS 9/9 達成: [ ] YES / [ ] NO

---

## §3 Phase 3: T-0 log (副作用 0 mock / 15 min / 10 step / 10:45-11:00 JST)

| timestamp (JST, 秒精度) | step ID | command (要約) | observed | PASS/FAIL/N/A/SKIP | 異常 escalation | Owner 拘束 |
|---|---|---|---|---|---|---|
|  | T00-01 | Slack T-0 GO dry post | http __ | | | 0 min |
|  | T00-02 | vercel promote --dry-run | exit __ / out=__ | | | 0 min |
|  | T00-03a | dig company-website A | | (SKIP 許容) | | 0 min |
|  | T00-03b | dig +short @8.8.8.8 | | (SKIP 許容) | | 0 min |
|  | T00-03c | curl CDN purge dry | http __ | | | 0 min |
|  | T00-04 | monitoring 3 URL HEAD | vercel __ sentry __ ga __ | | | 0 min |
|  | T00-05 | Slack T-0 done dry | http __ | | | 0 min |
|  | T00-06a | dig @1.1.1.1 (Tokyo proxy) | | (SKIP 許容) | | 0 min |
|  | T00-06b | dig @8.8.8.8 (Osaka proxy) | | (SKIP 許容) | | 0 min |
|  | T00-06c | dig @9.9.9.9 (Sapporo proxy) | | (SKIP 許容) | | 0 min |
|  | T00-Eextra | Owner GO 遅延 case E mock walk-through | CEO_PROXY_GO mock post | | | 0 min |

注: step 数 11 (10 step + Owner GO 遅延 mock walk-through 1 step) / Phase 3 は detailed-procedure §3 と整合

### Phase 3 集計
- PASS: ___ / 11
- SKIP (DNS 3 経路 + 必要に応じて): ___ / 11
- FAIL: ___ / 11
- 3 経路 A record 一致 (本番 DNS 切替後想定): [ ] (D-7 では SKIP 許容)
- T00-02 60 秒以内応答: [ ] (NG なら Case A escalation)
- Owner GO 遅延 mock walk-through 完了: [ ]
- 開始: 10:45:___ JST / 終了: ___:___ JST / 差分: ___ 分秒
- 完了基準 PASS 8/11 + SKIP 3/11 達成: [ ] YES / [ ] NO

---

## §4 Phase 4: T+1h log (実 env / 30 min / 6 step / 11:00-11:30 JST)

| timestamp (JST) | step ID | command (要約) | observed | PASS/FAIL/N/A | 異常 escalation | Owner 拘束 |
|---|---|---|---|---|---|---|
|  | TP1-01 | lighthouse postlaunch 4 score | perf=__ a11y=__ bp=__ seo=__ | | | 0 min |
|  | TP1-02 | Sentry stats 1h fixed window | 5xx=__ 4xx=__ | | | 0 min |
|  | TP1-03 | GA realtime activeUsers | activeUsers=__ | | | 0 min |
|  | TP1-04 | smoke 8 endpoint 再 | / __ /case __ /portfolio __ /about __ /contact __ /en __ /en/case __ /en/portfolio __ | | | 0 min |
|  | TP1-05 | psql pageview_event 1h top5 | top5 events: __ | | | 0 min |
|  | TP1-06 | Slack T+1h PASS dry | http __ | | | 0 min |

### Phase 4 集計
- PASS: ___ / 6
- FAIL: ___ / 6
- 5xx 0 件確認 (TP1-02): [ ]
- smoke 8 endpoint 全 200 (TP1-04): [ ]
- Lighthouse 4 score >= 90 (TP1-01): [ ]
- D-1〜D-4 全 PASS Web-Ops 1 行報告: [ ]
- 開始: 11:___ JST / 終了: ___:___ JST / 差分: ___ 分
- 完了基準 PASS 6/6 達成: [ ] YES / [ ] NO

---

## §5 Phase 5: T+24h KPI log (実 env read-only / 15 min / 5 step / 11:30-11:45 JST)

| timestamp (JST) | step ID | command (要約) | observed | PASS/FAIL/N/A | 異常 escalation | Owner 拘束 |
|---|---|---|---|---|---|---|
|  | T24P-01 | GA screenPageViews 24h JST | screenPageViews=__ | | | 0 min |
|  | T24P-02 | GA event count 3 event | contact=__ portfolio=__ case=__ | | | 0 min |
|  | T24P-03 | psql contact_request count | count=__ | | | 0 min |
|  | T24P-04 | GA bounceRate | bounceRate=__ | | | 0 min |
|  | T24P-05 | path reserve kpi md | path: __ | | | 0 min |

### Phase 5 集計
- PASS: ___ / 5
- FAIL: ___ / 5
- KPI 4 指標値確定: impression=___ click=___ signup=___ bounce=___
- bounce 業界 benchmark 50-60% との比較: [ ] 範囲内 / [ ] 超過 ___%
- KPI path 予約完了 (`dashboard/launch-kpi-2026-06-20.md`): [ ]
- 開始: 11:30:___ JST / 終了: ___:___ JST / 差分: ___ 分
- 完了基準 PASS 5/5 達成: [ ] YES / [ ] NO

---

## §6 Phase 6: 異常系演習 5 case log (15 min / 5 step / 11:45-12:00 JST)

| timestamp (JST) | case ID | 演習タイトル | mock / staging | walk-through 完了 | 異常 escalation | Owner 拘束 |
|---|---|---|---|---|---|---|
|  | A | rollback trigger | mock (trace のみ) | [ ] | | 0 min |
|  | B | cron fallback 切替 | mock (trace のみ) | [ ] | | 0 min |
|  | C | Slack alert 不達 | mock (trace のみ) | [ ] | | 0 min |
|  | D | smoke FAIL | staging 演習 | [ ] | | 0 min |
|  | E | Owner GO 遅延 | staging 演習 (mock) | [ ] | | 0 min |

### Phase 6 集計
- PASS (walk-through 完了): ___ / 5
- 5 case 充足度: ___ % (case D/E は staging 演習で +1pt 加算可)
- A/B/C trace 完了: [ ]
- D 演習完了 (staging で smoke FAIL → CEO GO_PARTIAL/NoGO 判断 trace): [ ]
- E 演習完了 (Owner GO 不発 → T+15min CEO_PROXY_GO mock): [ ]
- 開始: 11:45:___ JST / 終了: ___:___ JST / 差分: ___ 分
- 完了基準 PASS 5/5 達成: [ ] YES / [ ] NO

---

## §7 全体サマリ (CEO 承認欄)

### 7.1 PASS 38/40 集計表 (完了基準 PASS 41/44 = "PASS 38/40 + DNS 3 SKIP")

| Phase | step 数 | PASS | FAIL | SKIP | N/A | 達成 |
|---|---|---|---|---|---|---|
| Phase 1 | 9 | __ | __ | __ | __ | [ ] |
| Phase 2 | 9 | __ | __ | __ | __ | [ ] |
| Phase 3 | 11 | __ | __ | __ (DNS 3 経路) | __ | [ ] |
| Phase 4 | 6 | __ | __ | __ | __ | [ ] |
| Phase 5 | 5 | __ | __ | __ | __ | [ ] |
| Phase 6 | 5 | __ | __ | __ | __ | [ ] |
| **合計** | **45** | **__** | **__** | **__** | **__** | [ ] |

完了基準: PASS >= 38/40 (= PASS 41/45 with 4 SKIP 許容)

### 7.2 4 部門 OK reply 受領
- web-ops: [ ] (timestamp ___:___)
- marketing: [ ] (timestamp ___:___)
- dev: [ ] (timestamp ___:___)
- review: [ ] (timestamp ___:___)

### 7.3 confidence 評価 (詳細は launch-confidence-evaluation-spec.md)
- Round 20 完遂時 baseline: 76%
- D-7 PASS 38/40 達成: +5pt → 81%
- OG image 8 case 全 PASS (D-8 §7): +3pt
- 異常系 5 case 充足 90%+: +2pt
- 減点 (D-7 FAIL 5 件以上 / OG image FAIL 1 件 / 異常系充足 70% 未満): -__pt
- D-7 評価後 confidence: ___%
- 80% 確定: [ ] YES / [ ] NO

### 7.4 異常パターン演習接続
- Case A (rollback): 適用 [ ] 不要 [ ]
- Case B (cron fallback): 適用 [ ] 不要 [ ]
- Case C (Slack outage): 適用 [ ] 不要 [ ]
- Case D (smoke FAIL): 適用 [ ] 不要 [ ]
- Case E (Owner GO 遅延): 適用 [ ] 不要 [ ]

### 7.5 Owner 拘束時間 集計
- Phase 1 step 1-7 Owner self-declared: ___ min (推奨 1 min)
- Phase 6 case E Owner walk-through (mock): ___ min (推奨 0 min)
- Owner 累計拘束時間: ___ min (推奨 ≤ 1 min)

### 7.6 結果転記先
- 本 dry-run 結果転記先: `dashboard/launch-dryrun-2026-06-19-result.md` (Round 21 Marketing-O より参照)
- 不合格時 D-3 (6/16) 再 rehearsal trigger: [ ] YES / [ ] NO
- 6/27 fallback 切替 trigger (D-3 でも改善なし): [ ] YES / [ ] NO

### 7.7 サインオフ
- Web-Ops 記入: ___________________ (sign + timestamp)
- CEO 承認: ___________________ (sign + timestamp)
- Owner 受領 (1 行返信 timestamp): ___________________
- D-7 実施 timestamp: 2026-06-12 ___:___ JST 〜 ___:___ JST

### 7.8 Slack 報告 (D-7 EOD)
```bash
curl -s -X POST "$SLACK_WEBHOOK_DRY" \
  -d '{"text":"[D-7 rehearsal] 完了 PASS=__/45 FAIL=__ SKIP=__ N/A=__ confidence=__% by=Web-Ops at=2026-06-12 12:00 JST"}'
```

---

## §8 副作用 0 担保 (記入後チェック)

- [ ] 全 vercel コマンドに `--dry-run` 付与 or mock skip
- [ ] 全 Slack post が dry channel `#launch-dry-2026-06-19` 経由
- [ ] Supabase 接続が readonly role
- [ ] DB write 0 / cron merge 0 / DNS 変更 0
- [ ] 絵文字 0 / Heroicons 以外参照 0
- [ ] API $ コスト 0 (Lighthouse / Slack / Sentry / GA すべて既存契約 free tier 内)
- [ ] vercel promote 本番化 0
- [ ] 異常系 A/B/C は trace のみ / D/E は staging 限定
- [ ] Round 19 v1 SOP / Round 20 v2 SOP / anomaly-cases / 5/26 D-24 log template 無改変

---

**最終更新**: 2026-05-05 (Round 21 第 2 波 / Marketing-O / D-7 log template 起票)
**派生元**: Round 19 Marketing-M `launch-dry-run-log-template-2026-06-19.md` (forward-port + 強化) / Round 21 Marketing-O detailed-procedure §1-§6
**次回見直し**: 2026-06-12 (D-7 当日記入) → 6/16 (D-3 再 rehearsal 必要時 fork) → 6/19 (公開当日記入は別 log で)
