# 6/12 D-7 本 Rehearsal 実機実行 Prep Checklist (Direct-Pre Checklist)

## 0. 概要

- **対象**: PRJ-019 / COMPANY-WEBSITE 公開 (2026-06-19 09:00 JST 想定 / 確度 80%)
- **本書 role**: Marketing-O R21 `launch-dry-run-rehearsal-detailed-procedure-2026-06-12.md` (821 行 / 6 Phase / 44 step) を **6/12 09:00 JST 実機実行する直前** (08:00-08:55 JST 1 時間枠) の prep checklist
- **派生元**:
  - Round 21 Marketing-O `launch-dry-run-rehearsal-detailed-procedure-2026-06-12.md` (不変保持)
  - Round 22 Marketing-P `launch-dry-run-pre-rehearsal-execution-2026-06-11.md` (D-8 EOD GREEN 75/75 が前提)
- **構成**: 9 section / 計 50 prep 項目
- **完了基準**: 50/50 GREEN + Web-Ops 1 名記入 + CEO 1 名承認 (08:55 JST まで)
- **副作用**: 0 (前日の D-8 検収結果の継承確認 + 当日 prep のみ)
- **絵文字 0 / Heroicons 参照のみ / API 追加コスト $0**

## 0.1 D-7 当日 prep timeline (1 時間枠)

| 時刻 (JST) | section | 項目数 | 担当 |
|---|---|---|---|
| 08:00-08:10 | §1 D-8 結果継承確認 | 5 | Web-Ops + CEO |
| 08:10-08:25 | §2 必要 access 確認 | 8 | Web-Ops + Dev + Marketing |
| 08:25-08:35 | §3 必要 credential 確認 | 7 | Dev + Marketing |
| 08:35-08:40 | §4 必要 tool / 通信経路確認 | 6 | Web-Ops + Dev |
| 08:40-08:45 | §5 出席確認 + Phase 移行 timing 周知 | 5 | Web-Ops |
| 08:45-08:50 | §6 副作用 0 担保 + Phase 1 環境準備 | 5 | Web-Ops + Dev |
| 08:50-08:53 | §7 D-7 開始 final check + Slack | 6 | Web-Ops |
| 08:53-08:55 | §8 サインオフ | 4 | Web-Ops + CEO |
| 08:55-09:00 | §9 D-7 開始 5 min カウントダウン | 4 | 全員 |
| **合計** | | **50** | |

## 0.2 各項目記述形式

各項目は以下 4 要素で構成:
1. **項目名**
2. **責任者**
3. **完了基準**
4. **完了予定時刻** (08:00 JST 起点)

---

## §1 D-8 結果継承確認 (5 項目 / 08:00-08:10 JST)

| # | 項目 | 責任者 | 完了基準 | 完了予定 | [ ] |
|---|---|---|---|---|---|
| 1.1 | D-8 EOD GREEN 75/75 達成確認 | CEO | `launch-dry-run-pre-rehearsal-execution-2026-06-11.md` §6 完了基準 GREEN 75/75 (or 70+ + blocker 0) | 08:02 | [ ] |
| 1.2 | D-8 Web-Ops sign + CEO sign 取得確認 | CEO | 6/11 17:55 JST sign 2 件確認 | 08:04 | [ ] |
| 1.3 | D-8 EOD Slack post 確認 | Web-Ops | `#launch-dry-2026-06-19` 6/11 17:55 EOD post 残存 | 08:06 | [ ] |
| 1.4 | D-8 から D-7 への state 持ち越し確認 | Web-Ops | preview deploy `Ready` 維持 / cron preview enabled 維持 / Slack ch 維持 | 08:08 | [ ] |
| 1.5 | D-8 SKIP 項目 list (もしあれば) D-7 当日 SKIP 想定として記録 | Web-Ops | SKIP 項目 0-5 件、D-7 PASS 41/44 baseline 維持確認 | 08:10 | [ ] |

**FAIL 時 escalation**:
- 1.1 で GREEN < 70 → CEO 判断: D-7 09:00 開始 hold or 09:30 まで延長 → 不能なら D-3 (6/16) 再 schedule
- 1.2 で sign 不在 → CEO 即時 sign + 記録 (5 min)
- 1.4 で state 喪失 → Web-Ops 緊急復旧 (preview rebuild / cron 再 enable / Slack ch 再活性化)

---

## §2 必要 access 確認 (8 項目 / 08:10-08:25 JST)

| # | access | 責任者 | 完了基準 | 完了予定 | [ ] |
|---|---|---|---|---|---|
| 2.1 | GitHub repo (claude-code-company/internal) 読み書き | Web-Ops | `gh auth status` で OK / `gh issue list` で 1 件以上返却 | 08:12 | [ ] |
| 2.2 | Vercel team scope (`$VERCEL_TEAM`) admin or developer | Web-Ops | `vercel ls --scope $VERCEL_TEAM` で project 1 件以上返却 | 08:14 | [ ] |
| 2.3 | Slack workspace + `#launch-dry-2026-06-19` post 権限 | Web-Ops + Marketing | curl webhook で HTTP 200 / channel members に自身が join | 08:16 | [ ] |
| 2.4 | Sentry org `$SENTRY_ORG` member + project `$SENTRY_PROJ` admin | Dev | Sentry Dashboard 開いて project 表示確認 | 08:18 | [ ] |
| 2.5 | GA Property `$GA_PROP` viewer (gcloud auth) | Dev | `gcloud auth print-access-token` でトークン取得成功 | 08:20 | [ ] |
| 2.6 | Supabase project readonly role | Dev | `psql $SUPABASE_READONLY_URL -c "select 1;"` で `1` 返却 | 08:22 | [ ] |
| 2.7 | Vault / 1Password に `EXPECTED_EN_HASH` / `EXPECTED_PORTFOLIO_HASH` 参照可 | Marketing | Vault item 開いて 64 hex 値表示確認 | 08:24 | [ ] |
| 2.8 | Owner email/Slack DM 連絡経路 (CARD H backup contact 含む) | CEO | Owner DM 1 行確認 reply 受領 / backup contact 名 sticky note 記入 | 08:25 | [ ] |

**FAIL 時 escalation**:
- 2.1-2.6 で access 不在 → 該当 admin に DM (10 min) → 09:00 までに復旧 / 不能なら該当 step を SKIP
- 2.8 で Owner reply 未着 → CEO 直接電話 (CARD H 経路) → 5 min 内 reply

---

## §3 必要 credential 確認 (7 項目 / 08:25-08:35 JST)

| # | credential | 責任者 | 完了基準 | 完了予定 | [ ] |
|---|---|---|---|---|---|
| 3.1 | `.env.dryrun` 19 変数 source 完了 | Web-Ops | `source .env.dryrun && env | grep -c -E "^(PREVIEW_URL|TARGET_URL|SLACK_WEBHOOK_DRY|EXPECTED_EN_HASH|EXPECTED_PORTFOLIO_HASH|VERCEL_TEAM|CRON_PROD_PR|CDN_HOST|VERCEL_ANALYTICS_URL|SENTRY_PROJECT_URL|GA_REALTIME_URL|SENTRY_TOKEN|GA_TOKEN|SUPABASE_READONLY_URL|SENTRY_ORG|SENTRY_PROJ|GA_PROP|LAUNCH_DATE_JST|LAUNCH_TIMESTAMP)="` で 19 返却 | 08:27 | [ ] |
| 3.2 | `SENTRY_TOKEN` 失効していない確認 | Dev | curl で stats API 200 (D-8 で確認済 / 08:27 再確認) | 08:28 | [ ] |
| 3.3 | `GA_TOKEN` 60 min 以内 refresh (`gcloud auth print-access-token`) | Dev | token 先頭 5 文字確認 + curl GA realtime API 200 | 08:30 | [ ] |
| 3.4 | `SUPABASE_READONLY_URL` 接続維持確認 | Dev | psql `select 1;` 200 ms 以内応答 | 08:31 | [ ] |
| 3.5 | `SLACK_WEBHOOK_DRY` reachability 再確認 | Web-Ops | `curl -X POST $SLACK_WEBHOOK_DRY -d '{"text":"[D-7 prep 08:32] reachability"}'` HTTP 200 | 08:32 | [ ] |
| 3.6 | Vault hash 値が D-8 から無改変確認 | Marketing | EXPECTED_EN_HASH / EXPECTED_PORTFOLIO_HASH を Vault item と照合 | 08:34 | [ ] |
| 3.7 | `LAUNCH_DATE_JST=2026-06-19` / `LAUNCH_TIMESTAMP=2026-06-19T00:00:00Z` 確認 | CEO | echo で値表示確認 | 08:35 | [ ] |

**FAIL 時 escalation**:
- 3.2 SENTRY_TOKEN 失効 → Dev 即時再発行 (10 min) → §1 env 表更新 → 再 verify
- 3.3 GA_TOKEN 失効 → `gcloud auth login` 再実行 (5 min)
- 3.5 Slack 不達 → Case C escalation (email fallback 経路 trace) → 09:00 までに復旧

---

## §4 必要 tool / 通信経路確認 (6 項目 / 08:35-08:40 JST)

| # | tool / 経路 | 責任者 | 完了基準 | 完了予定 | [ ] |
|---|---|---|---|---|---|
| 4.1 | `lighthouse` CLI (`npx lighthouse --version`) | Web-Ops | 11.x or higher | 08:36 | [ ] |
| 4.2 | `gh` CLI (`gh --version`) + `gh auth status` | Web-Ops | 2.x + Logged in to github.com | 08:37 | [ ] |
| 4.3 | `vercel` CLI (`vercel --version`) | Web-Ops | 33.x or higher | 08:37 | [ ] |
| 4.4 | `dig` / `curl` / `psql` / `yq` / `jq` 5 tool 存在 | Web-Ops + Dev | `which dig curl psql yq jq` 全件 path 返却 | 08:38 | [ ] |
| 4.5 | preview URL → 自身 IP の通信経路確認 | Web-Ops | `curl -I $PREVIEW_URL` 200 + `curl -I --connect-timeout 5 $TARGET_URL` 200 | 08:39 | [ ] |
| 4.6 | DNS 経路 3 解決系 (1.1.1.1 / 8.8.8.8 / 9.9.9.9) reachable | Web-Ops | `dig @1.1.1.1 google.com` 各経路で 200 ms 以内応答 | 08:40 | [ ] |

**FAIL 時 escalation**:
- 4.1-4.4 で tool 欠落 → 該当責任者が即時 install (5-10 min)
- 4.5 で TARGET_URL 不通 → preview deploy 復旧 → 09:00 までに rebuild 必要なら D-7 hold 検討
- 4.6 で 1 経路以上不通 → 自身 network 確認 / VPN 切替

---

## §5 出席確認 + Phase 移行 timing 周知 (5 項目 / 08:40-08:45 JST)

| # | 項目 | 責任者 | 完了基準 | 完了予定 | [ ] |
|---|---|---|---|---|---|
| 5.1 | Web-Ops / Marketing / Dev / Review 4 部門責任者 Slack 出席 reply | Web-Ops | `[D-7 08:40] 出席確認 / Phase 1 09:00 開始` post + 4 部門 OK reply 受領 | 08:42 | [ ] |
| 5.2 | CEO 出席確認 | Web-Ops | CEO Slack reply | 08:42 | [ ] |
| 5.3 | Owner 出席確認 (5 min 拘束のみ / T24-07 sign 用) | CEO | Owner Slack 1 行 OK reply (`6/12 09:00-09:05 ready`) | 08:43 | [ ] |
| 5.4 | 6 Phase 開始時刻周知 | Web-Ops | Slack post: `Phase 1 09:00 / Phase 2 10:00 / Phase 3 10:45 / Phase 4 11:00 / Phase 5 11:30 / Phase 6 11:45 / 終了 12:00` | 08:44 | [ ] |
| 5.5 | 各 Phase 担当部門の主担当者 confirm | Web-Ops | Phase 1 主=Web-Ops, P2 主=Web-Ops, P3 主=Web-Ops+CEO, P4 主=Web-Ops+Dev, P5 主=Dev, P6 主=全部署 | 08:45 | [ ] |

**FAIL 時 escalation**:
- 5.1-5.3 で 1 名欠席 → 代理人 (副責) を assign / Owner CARD H 経路 → 5 min 内 reply / 不発時は CEO 判断で D-7 開始 hold

---

## §6 副作用 0 担保 + Phase 1 環境準備 (5 項目 / 08:45-08:50 JST)

| # | 項目 | 責任者 | 完了基準 | 完了予定 | [ ] |
|---|---|---|---|---|---|
| 6.1 | Phase 3 の `vercel promote --dry-run` flag 必須確認 | Dev | SOP v2 §SOP 3 T00-02 コマンドに `--dry-run` 含まれる | 08:46 | [ ] |
| 6.2 | Phase 6 case A/B/C は trace のみ実施確認 | Web-Ops | anomaly-cases.md の case A/B/C 「実 promote 禁止」「実 cron 操作禁止」「実 send 禁止」明示確認 | 08:47 | [ ] |
| 6.3 | 全 Slack post 先が dry channel `#launch-dry-2026-06-19` 限定確認 | Web-Ops | webhook URL = `$SLACK_WEBHOOK_DRY` のみ使用 / 本番 webhook 0 | 08:48 | [ ] |
| 6.4 | 本番 DNS 変更 0 / 本番 cron merge 0 / 本番 deploy 0 確認 | Web-Ops + Dev | `vercel cron ls --project production` 全 disabled 維持 / DNS 切替は D-1 17:00 に予定 | 08:49 | [ ] |
| 6.5 | 絵文字 0 / Heroicons 参照のみ / API $0 維持 確認 | Marketing | 全実行コマンドに絵文字 0 / 全 icon 参照は Heroicons 限定 | 08:50 | [ ] |

**FAIL 時 escalation**:
- 6.1 で `--dry-run` flag 漏れ → SOP v2 不変保持のため別 wrapper 経由で `--dry-run` 強制 → Dev 即時修正 (5 min)
- 6.3 で 本番 webhook 紛れ込み → 即時 env 修正 → D-7 hold 検討

---

## §7 D-7 開始 final check + Slack (6 項目 / 08:50-08:53 JST)

| # | 項目 | 責任者 | 完了基準 | 完了予定 | [ ] |
|---|---|---|---|---|---|
| 7.1 | log template skeleton open + 記入準備 | Web-Ops | `launch-dry-run-rehearsal-log-template-2026-06-12.md` editor open + 6/12 09:00- timestamp 列 frame OK | 08:51 | [ ] |
| 7.2 | confidence-spec 数式 + Path A-D 4 path 把握確認 | Marketing | `launch-confidence-evaluation-spec.md` §3.2 4 path 暗記 | 08:51 | [ ] |
| 7.3 | anomaly-cases 5 case 概要把握確認 | Web-Ops + CEO | A=rollback / B=cron / C=Slack / D=smoke / E=Owner GO 5 case 暗記 | 08:52 | [ ] |
| 7.4 | NoGO SLA 30 min pinned message 再確認 | CEO | Slack `#launch-2026-06-19` (本番 ch) pinned post 維持確認 | 08:52 | [ ] |
| 7.5 | T24-07 Owner sign 用文言 prep | CEO | Owner に「6/19 08:30-10:00 JST blocker-free」を Slack で 1 行宣言してもらう用テンプレ準備 | 08:53 | [ ] |
| 7.6 | 08:53 JST 「D-7 開始 7 min 前」Slack 集合 post | Web-Ops | `[D-7 08:53] 開始まで 7 min / 4 部門 + Owner + CEO スタンバイ確認` | 08:53 | [ ] |

**FAIL 時 escalation**:
- 7.1-7.3 で準備不足 → 該当責任者 5 min 集中復習 → 不能なら副責 swap

---

## §8 サインオフ (4 項目 / 08:53-08:55 JST)

| # | 項目 | 責任者 | 完了基準 | 完了予定 | [ ] |
|---|---|---|---|---|---|
| 8.1 | Web-Ops prep checklist sign | Web-Ops | 50 項目 GREEN 確認 + sign + timestamp 記入 | 08:54 | [ ] |
| 8.2 | CEO 承認 sign | CEO | 50 項目 GREEN 承認 + sign + timestamp | 08:54 | [ ] |
| 8.3 | D-7 09:00 開始 GO 確定 Slack post | CEO | `[D-7 08:55] D-7 09:00 開始 GO confirmed by=CEO` post | 08:55 | [ ] |
| 8.4 | 各部門担当者 個別 stand-by 状態確認 (画面前 + コマンド ready) | 4 部門責 | 各部門 1 行 OK reply | 08:55 | [ ] |

**FAIL 時 escalation**:
- 8.1-8.2 で sign 不在 → CEO 代行 (PM 部門 head) sign / Owner email 通知
- 8.3 GO 不確定 → CEO 09:00 まで判断保留 → 09:00 開始 hold

---

## §9 D-7 開始 5 min カウントダウン (4 項目 / 08:55-09:00 JST)

| # | 項目 | 責任者 | 完了基準 | 完了予定 | [ ] |
|---|---|---|---|---|---|
| 9.1 | 08:55 JST 「5 min」Slack 集合 post | Web-Ops | `[D-7 08:55] 開始まで 5 min` | 08:55 | [ ] |
| 9.2 | 08:58 JST 「2 min」Slack 集合 post | Web-Ops | `[D-7 08:58] 開始まで 2 min / 全員ターミナル open` | 08:58 | [ ] |
| 9.3 | 08:59:50 JST 「10 sec」Slack 集合 post | Web-Ops | `[D-7 08:59:50] 開始まで 10 sec` | 08:59:50 | [ ] |
| 9.4 | 09:00:00 JST 「Phase 1 開始」Slack post | Web-Ops | `[D-7 09:00:00] Phase 1 (T-24h) 開始 / step 1-1 T24-01 から実行` | 09:00:00 | [ ] |

**FAIL 時 escalation**:
- 9.4 09:00:00 post 不発 → 09:00:30 まで猶予 → 不発なら CEO 判断で開始 hold

---

## §10 prep 完了基準 (D-7 09:00 開始 GO 条件)

| 集計 | 数値 | GO 条件 |
|---|---|---|
| GREEN 50 項目中 | __ / 50 | 50/50 → GO 確定 / 47-49 + blocker 0 → CEO 判断 / 47 未満 → 09:30 延長 |
| Web-Ops sign | _____ | 必須 |
| CEO sign | _____ | 必須 |
| 4 部門 + Owner + CEO 出席 | __ / 6 | 6/6 必須 (代理人 assign 可) |
| Slack 09:00:00 開始 post | [ ] | 必須 |

### サインオフ
- Web-Ops 記入: ___________________ (sign + timestamp)
- CEO 承認: ___________________ (sign + timestamp)
- D-7 prep 完了 timestamp: 2026-06-12 ___:___ JST

---

## §11 副作用 0 担保 (D-7 prep 検収後チェック)

- [ ] 全コマンド HEAD or read-only or `--dry-run` flag 付与
- [ ] Slack post は dry channel `#launch-dry-2026-06-19` 限定
- [ ] Supabase 接続 readonly role 限定
- [ ] Vercel preview deploy 1 件のみ (production deploy 0 / promote 0)
- [ ] cron preview enable / production disable 維持
- [ ] DB write 0 / 本番 DNS 変更 0 / 本番 Slack 投稿 0 / 絵文字 0
- [ ] API $ コスト 0
- [ ] Round 21 4 ファイル無改変 (detailed-procedure 821 行 / pre-rehearsal-validation 259 行 / log-template / confidence-spec)
- [ ] Marketing-L R18 launch-rehearsal-execution-script 無改変
- [ ] Round 22 D-8 execution 文書 (本書同 Round) 無改変
- [ ] Heroicons 参照のみ / 他アイコン 0

---

## §12 関連 DEC / KPI / Round 23 引継

- DEC-019-025: background dispatch SOP 19 件目
- DEC-019-033: knowledge 抽出経路 (本書を `organization/knowledge/patterns/d7-execution-prep.md` 候補化)
- DEC-019-054: portfolio v3.1 hash check (§3.6 Vault hash 確認)
- DEC-019-062: cron 5 本 (§4 cron preview 確認 + §6.4 production cron disable 確認)
- DEC-018-047: PRJ-018 hotfix rollback ベストプラクティス継承 (Phase 6 case A 経路)

KPI 連動:
- 17 日 path 完成度: 本書で D-7 prep 物理化 → +1 path
- DEC trajectory: DEC-019-071 候補 (D-7 prep + D-8 execution + 6/19 timeline 採決)
- 11-HITL: 本書は HITL 第 9 種 `dev_kickoff_approval` 対象外

Round 23 引継 (Marketing-Q 想定):
1. D-7 当日実測値の本書反映 (50 項目 GREEN 数 + FAIL list)
2. D-3 (6/16) 再 rehearsal 必要時の prep checklist (本書 fork)
3. 6/19 公開当日 6:00-12:00 timeline v3.0 (Round 22 Marketing-P 起票) と本書の cross-link

---

**最終更新**: 2026-05-05 (Round 22 / Marketing-P / D-7 prep checklist 起票)
**派生元**: Round 21 Marketing-O detailed-procedure 821 行 / R22 Marketing-P D-8 execution
**次回見直し**: 2026-06-12 08:55 JST (D-7 prep EOD 検収) → 6/12 09:00 JST (D-7 本 rehearsal 開始)
