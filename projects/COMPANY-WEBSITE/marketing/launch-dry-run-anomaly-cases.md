# Launch Dry-Run 異常系演習 5 件 deep-dive

## 0. 概要
- 対象: PRJ-019 / COMPANY-WEBSITE 公開 (2026-06-19 09:00 JST 確度 75% / 6/27 fallback 確度 92%)
- 派生元: Round 20 Marketing-N `launch-dry-run-rehearsal-report-2026-05-26.md` §6 異常系演習 5 件
- 範囲: 異常 5 件 (A-E) each に **検知 → 判断 → 連絡 → 復旧 → 後始末** の 5 phase 分解
- 各 case に Owner 拘束時間 + 推奨判断者 (Web-Ops / Marketing / CEO) + 連絡 SLA を明示
- 副作用 0 / 絵文字 0 / API 追加コスト $0 / Heroicons 参照のみ
- 本書は walk-through 設計書であり、実 rehearsal は D-7 (6/12) で staging 環境にて実施
- 関連: OPS-E-01 §6 Rollback / OPS-E-04 cron-fallback-switch / OPS-E-05 slack-alert-routing

---

## Case A: rollback trigger (vercel promote 失敗 / 公開後 5xx スパイク)

### 1. 検知 (detection)
- **検知 source**: TP1-02 Sentry stats / TP1-04 smoke 8 endpoint
- **検知トリガ**: error rate > 1% (5 min window) で `#prj-019-alerts` に Slack alert
- **検知時刻**: T-0 〜 T+15min が最頻発帯 / T+1h smoke で再確認
- **判定指標**: 5xx > 50 件/min OR smoke 8 endpoint のうち 2 件以上 200 以外
- **mock walk-through**: T00-02 vercel promote --dry-run が exit 1 (D-24 mock で再現 OK)

### 2. 判断 (decision)
- **推奨判断者**: Web-Ops (一次判断 / 30 sec 以内) → CEO (最終判断 / 2 min 以内)
- **rollback 即時 GO 基準**: 5xx > 100/min OR home `/` で 503/504 持続 1 min
- **rollback 一旦 hold 基準**: 軽微な 5xx (< 50/min) で deploy ID 不変 → 5 min 観測継続
- **判断テンプレ Slack**: `[ROLLBACK CALL] reason=5xx___/min decision=GO|HOLD by=Web-Ops at=HH:MM:SS JST`

### 3. 連絡 (escalation)
- **SLA**: 検知 → Web-Ops 一次判断 30 sec → CEO 通知 30 sec → CEO 最終判断 2 min = **検知から 3 min 以内に rollback 開始**
- **連絡経路**:
  1. `#prj-019-alerts` 自動 alert (Sentry)
  2. Web-Ops が `#prj-019-launch` に 1 行 escalate
  3. CEO が `@channel` で GO/HOLD 発声
  4. Owner には Web-Ops が email 並行 (Slack outage 想定)
- **Owner 拘束**: 通知のみ (1 min 以内に email 着信) / 操作介入なし

### 4. 復旧 (recovery)
- **手順** (OPS-E-01 §6 準拠):
  1. Vercel Dashboard → Deployments → 直前 Production deploy (deploy ID は Slack pin) → `Promote to Production` click (30 sec)
  2. CDN purge: `curl -X POST https://${CDN_HOST}/purge` (30 sec)
  3. smoke 再実行: T02-06 同等 8 endpoint loop (1 min)
  4. Sentry 5xx 鎮静確認 (5 min 観測)
- **所要時間**: 30 sec (promote) + 1 min (smoke) + 5 min (鎮静確認) = **6.5 min**
- **DB rollback は実施しない**: schema 破壊 / data 大量欠損のみ DB rollback (本 case では Vercel rollback のみ)

### 5. 後始末 (postmortem)
- **当日中**: postmortem 下書き → `projects/PRJ-019/reports/postmortem-rollback-YYYYMMDD.md`
- **翌営業日**: review 部門レビュー → CEO 承認 → Owner 通知
- **再発防止**: 5xx スパイク原因 (deploy 内容 / DB migration / config 変更) を特定 → SOP v2 への patch 案
- **knowledge 抽出**: DEC-019-033 経路で `organization/knowledge/pitfalls/rollback-trigger.md` 候補化

### Owner 拘束時間 集計
- **検知**: 0 min (自動)
- **判断**: 0 min (Web-Ops + CEO で完結)
- **連絡受領**: 1 min (email 確認)
- **復旧**: 0 min (Web-Ops 単独操作)
- **後始末**: 5 min (翌営業日の通知確認)
- **合計**: 約 6 min (公開当日 1 min + 翌営業日 5 min)

---

## Case B: cron fallback 切替 (heartbeat > 500k / SLO 違反)

### 1. 検知 (detection)
- **検知 source**: KPI-01 E-2 heartbeat metrics / cron 5 本の実行 log
- **検知トリガ**: heartbeat 数 > 500k/min (SLO 上限) OR cron 1 本以上が 3 連続 fail
- **検知時刻**: T+1h 以降 (公開直後の負荷ピーク帯) / 24h 監視継続
- **判定指標**: heartbeat 500k 超過 持続 5 min OR cron failure rate > 10%
- **mock walk-through**: cron metrics が dry-run で取得不能 → SOP review のみ

### 2. 判断 (decision)
- **推奨判断者**: Web-Ops (単独判断可 / 5 min 以内)
- **fallback 切替 GO 基準**: heartbeat 500k 超過 持続 5 min
- **fallback 切替 hold 基準**: 一時的なスパイク (< 5 min) → 観測継続
- **判断テンプレ Slack**: `[CRON FALLBACK] reason=heartbeat___k decision=GO|HOLD by=Web-Ops at=HH:MM JST`

### 3. 連絡 (escalation)
- **SLA**: 検知 → Web-Ops 判断 5 min → 切替実行 = **検知から 10 min 以内に切替完了**
- **連絡経路**:
  1. KPI dashboard alert (自動)
  2. Web-Ops が `#prj-019-alerts` に 1 行報告
  3. CEO 通知 (情報のみ / 判断介入なし)
  4. Owner 通知不要 (運用範囲内)
- **Owner 拘束**: 0 min (運用イベント / 判断介入不要)

### 4. 復旧 (recovery)
- **手順** (OPS-E-04 cron-fallback-switch.md 準拠):
  1. Vercel Cron Dashboard で対象 cron を pause (10 sec/cron × 最大 5 cron = 50 sec)
  2. fallback channel cron (heartbeat 計測 redirect 先) を enable
  3. heartbeat 計測 redirect 確認 (1 min)
  4. SLO 復帰確認 (5 min 観測)
- **所要時間**: 50 sec + 1 min + 5 min = **約 7 min**
- **副作用**: heartbeat 計測精度が一時的に粗くなる (1 min → 5 min interval) / 公開後 KPI 影響軽微

### 5. 後始末 (postmortem)
- **当日中**: 切替 log → `projects/PRJ-019/reports/cron-fallback-YYYYMMDD.md`
- **翌営業日**: heartbeat 増加原因分析 (traffic spike / bot / 設計問題)
- **fallback 解除**: SLO 復帰 + 原因解消後に Web-Ops 判断で primary cron に戻す
- **knowledge 抽出**: `organization/knowledge/patterns/cron-fallback.md` 候補化

### Owner 拘束時間 集計
- **検知**: 0 min (自動)
- **判断**: 0 min (Web-Ops 単独)
- **連絡受領**: 0 min (情報のみ通知)
- **復旧**: 0 min (Web-Ops 単独操作)
- **後始末**: 0 min (翌営業日 lessons-learned 共有のみ)
- **合計**: 0 min (Owner 拘束なし)

---

## Case C: Slack alert routing 不達 (Slack outage / webhook URL 失効)

### 1. 検知 (detection)
- **検知 source**: Slack heartbeat (5 min interval で `#prj-019-launch` に dummy post) の sent confirmation 不在
- **検知トリガ**: 5 min 連続で Slack post 失敗 OR webhook 401/403/404
- **検知時刻**: いつでも (公開前 D-7 〜 公開後 30 day)
- **判定指標**: Slack heartbeat consecutive fail = 2 (10 min 不達)
- **mock walk-through**: webhook 未設定状態を再現 (D-24 mock で全 Slack step SKIP)

### 2. 判断 (decision)
- **推奨判断者**: Web-Ops (一次 / 5 min) → Marketing (二次 / 連絡経路切替判断 10 min)
- **email fallback GO 基準**: Slack 10 min 不達確認後即時切替
- **判断テンプレ email**: subject `[PRJ-019 SLACK OUTAGE] fallback to email at HH:MM JST`

### 3. 連絡 (escalation)
- **SLA**: 検知 (10 min 不達) → email fallback 切替 5 min = **検知から 15 min 以内に email 経路確立**
- **連絡経路** (OPS-E-05 fallback 準拠):
  1. Slack heartbeat 不達検知 (自動 / dashboard alert)
  2. Web-Ops が email broadcast (Owner / CEO / 4 部門責任者) → subject template
  3. 4 部門責任者が reply で生存確認
  4. Slack 復旧まで email スレッドで運用継続
- **Owner 拘束**: 1 min (email 確認 + reply)

### 4. 復旧 (recovery)
- **手順**:
  1. email broadcast template に従い 4 部門 + Owner + CEO に連絡 (5 min)
  2. Slack status page 確認 (https://status.slack.com)
  3. webhook URL の場合は Slack admin で再発行 (15 min)
  4. Slack 復旧確認後 heartbeat 再開 (5 min 観測)
- **所要時間**: 5 min (broadcast) + 15 min (webhook 再発行 / Slack 復旧待ち) + 5 min (確認) = **約 25 min**
- **公開遅延判断**: T-2h 以降の発生 → 公開時刻維持 (email 経路で続行) / T-24h 以降の発生 → 公開維持判断は CEO

### 5. 後始末 (postmortem)
- **当日中**: outage log → `projects/PRJ-019/reports/slack-outage-YYYYMMDD.md`
- **翌営業日**: webhook URL 二重化検討 (#prj-019-alerts 用 backup webhook)
- **knowledge 抽出**: `organization/knowledge/pitfalls/slack-outage.md` 候補化

### Owner 拘束時間 集計
- **検知**: 0 min (自動)
- **判断**: 0 min (Web-Ops/Marketing で完結)
- **連絡受領**: 1 min (email 確認 + reply)
- **復旧**: 0 min (Web-Ops 単独)
- **後始末**: 5 min (翌営業日 review 確認)
- **合計**: 約 6 min

---

## Case D: smoke test FAIL (8 endpoint いずれか 200 以外)

### 1. 検知 (detection)
- **検知 source**: T02-06 (T-2h) / T00-* (T-0) / TP1-04 (T+1h) いずれかの smoke loop
- **検知トリガ**: 8 endpoint loop で 200 以外の HTTP code 1 件以上
- **検知時刻**: T-2h / T-0 / T+1h の各 phase
- **判定指標**:
  - T-2h で FAIL: 公開 NoGO 判定 1 票 (Lighthouse < 90 と並列)
  - T-0 で FAIL: 即時 rollback Case A 連動
  - T+1h で FAIL: rollback 判断 (5xx 件数依存)
- **mock walk-through**: D-24 mock で env 未設定の SKIP / D-7 本 rehearsal で実 200 確認

### 2. 判断 (decision)
- **推奨判断者**: Web-Ops (一次 / 1 min) → CEO (NoGO 判断 / 5 min)
- **NoGO GO 基準**:
  - T-2h で 1 endpoint 以上 FAIL → CEO に NoGO 提案
  - T-2h で `/` `/portfolio` `/case-studies` のうち 1 件 FAIL → 即時 NoGO
- **GO 維持基準**:
  - T-2h で `/en/*` のみ FAIL → en 一時非公開で GO 維持判断あり
- **判断テンプレ Slack**: `[SMOKE FAIL] failing=___ count=__ decision=NoGO|GO_PARTIAL|GO_FULL by=CEO at=HH:MM JST`

### 3. 連絡 (escalation)
- **SLA**: 検知 → Web-Ops 一次 1 min → CEO 5 min = **検知から 6 min 以内に判断確定**
- **連絡経路**:
  1. T-2h smoke loop 完了直後 Web-Ops が `#prj-019-launch` に結果 post
  2. FAIL 検知時 Web-Ops が CEO mention
  3. CEO が NoGO/GO_PARTIAL/GO_FULL 発声
  4. Owner 通知 (NoGO の場合は email 並行 / GO_PARTIAL/FULL は Slack のみ)
- **Owner 拘束**: NoGO 時 5 min (email 確認 + 公開延期同意 reply) / GO 時 0 min

### 4. 復旧 (recovery)
- **T-2h FAIL**: 公開延期 → Dev 部門 60 min 以内に修正 → smoke 再実行 → CEO 再判断
- **T-0 FAIL**: Case A rollback 連動 (rollback → 復旧後再 GO は CEO 判断)
- **T+1h FAIL**: Sentry / Vercel logs 確認 → 軽微なら hotfix / 重度なら rollback
- **所要時間** (T-2h FAIL の場合): 60 min (Dev 修正) + 5 min (smoke 再実行) = **約 65 min**
- **公開遅延**: 60 min 以内修正可なら 09:00 JST 維持 / 不能なら 1h 後ろ倒し or 6/27 fallback

### 5. 後始末 (postmortem)
- **当日中**: smoke FAIL log → `projects/PRJ-019/reports/smoke-fail-YYYYMMDD.md`
- **翌営業日**: 原因 endpoint の root cause 分析
- **再発防止**: smoke を CI に組込 (D-7 本 rehearsal 結果から判断)
- **knowledge 抽出**: `organization/knowledge/patterns/smoke-test.md` 候補化

### Owner 拘束時間 集計
- **検知**: 0 min (自動)
- **判断**: 0 min (Web-Ops/CEO で完結) / NoGO 時 5 min (Owner 同意)
- **連絡受領**: 0-5 min (NoGO 時 email)
- **復旧**: 0 min (Dev 単独)
- **後始末**: 5 min (翌営業日 review)
- **合計**: NoGO 時約 10 min / GO 時 5 min

---

## Case E: Owner GO 遅延 (15 min 以上)

### 1. 検知 (detection)
- **検知 source**: T-0 (09:00:00 JST) Slack `#prj-019-launch` の Owner 「GO」発声タイムスタンプ
- **検知トリガ**: 09:00 JST 起算で 5 min / 10 min / 15 min Owner GO 不発
- **検知時刻**: T-0 〜 T+15 min
- **判定指標**: T+15 min Owner 発声 0 件
- **mock walk-through**: SOP に escalation tree 未記載 (D-24 mock で gap 発見) → 本書で正式提案

### 2. 判断 (decision)
- **推奨判断者**: CEO (一次 5 min) → CEO 代行 GO 発声判断 (15 min)
- **CEO 代行 GO 基準** (新提案 / SOP v2 §SOP 3 §異常系 case E に正式採用提案):
  - T+5min Owner 沈黙: CEO が Owner に Slack DM + email + (可能なら) phone 確認
  - T+10min Owner 沈黙: CEO が Owner 不在事由を `#prj-019-launch` に共有
  - T+15min Owner 沈黙 + Owner 連絡不能: CEO が代行 GO 発声 (公開実行)
  - T+15min Owner 沈黙 + Owner 連絡可能: CEO が Owner と協議し GO/Hold 判断
  - T+30min Owner GO 不発 + 連絡不能: 公開延期 → 翌営業日 Owner 復帰後再判断
- **判断テンプレ Slack**: `[OWNER DELAY] elapsed=__min owner_status=___ decision=CEO_PROXY_GO|HOLD by=CEO at=HH:MM:SS JST`

### 3. 連絡 (escalation)
- **SLA**: T-0 → 15 min CEO 代行 GO 上限 = **検知から 15 min 以内に最終判断**
- **連絡経路**:
  1. CEO が T-0 で Owner GO 待機 (Slack channel 監視)
  2. T+5min: CEO → Owner DM + email + phone (3 経路同時)
  3. T+10min: CEO → `#prj-019-launch` に進捗共有
  4. T+15min: CEO 代行 GO or Hold 発声 (4 部門責任者全員に CC)
- **Owner 拘束**: 復帰後 1 min (CEO 判断確認 + retroactive 同意)

### 4. 復旧 (recovery)
- **CEO 代行 GO 採択時**:
  1. CEO が `#prj-019-launch` に「CEO PROXY GO」発声
  2. Web-Ops が SOP §SOP 3 を T+15min から開始 (15 min 遅延 / 公開時刻 09:15 JST)
  3. Owner 復帰後に CEO が retroactive 経緯説明
- **Hold 採択時**:
  1. 公開延期決定 (6/27 fallback or 翌営業日)
  2. 4 部門に Slack 通知
  3. CEO がポストモーテム責任者を任命
- **所要時間**: GO 採択時 15 min 遅延で公開実行 / Hold 採択時 fallback まで 8 day 待機

### 5. 後始末 (postmortem)
- **当日中**: Owner GO 遅延 log → `projects/PRJ-019/reports/owner-go-delay-YYYYMMDD.md`
- **翌営業日**: Owner 復帰 → 経緯ヒアリング → 再発防止策合意
- **再発防止**: 公開当日に Owner backup contact (家族 or 同僚) 1 名事前共有
- **knowledge 抽出**: `organization/knowledge/decisions/owner-proxy-go.md` 候補化 / DEC 採決候補

### Owner 拘束時間 集計
- **検知**: 0 min (Owner 不在中なので不可抗)
- **判断**: 0 min (CEO 代行)
- **連絡受領**: 0 min (Owner 連絡不能想定)
- **復旧**: 0 min (CEO 代行 GO 後 Web-Ops 単独実行)
- **後始末**: 復帰後 1 min (CEO retroactive 確認) + 翌営業日 30 min (経緯ヒアリング + 同意)
- **合計**: 復帰後 31 min

---

## サマリ表: 5 case Owner 拘束時間 + 推奨判断者 + 連絡 SLA

| case | 概要 | 推奨判断者 | Owner 拘束 (公開当日) | Owner 拘束 (翌営業日含む) | 連絡 SLA |
|---|---|---|---|---|---|
| A | rollback trigger | Web-Ops + CEO | 1 min (email 確認) | 6 min | 検知 → 3 min 以内 rollback 開始 |
| B | cron fallback 切替 | Web-Ops 単独 | 0 min | 0 min | 検知 → 10 min 以内 切替完了 |
| C | Slack alert 不達 | Web-Ops + Marketing | 1 min (email reply) | 6 min | 検知 → 15 min 以内 email 経路確立 |
| D | smoke test FAIL | Web-Ops + CEO | NoGO 時 5 min / GO 時 0 min | NoGO 時 10 min / GO 時 5 min | 検知 → 6 min 以内 判断確定 |
| E | Owner GO 遅延 15 min | CEO 代行 | 0 min (Owner 不在) | 31 min (復帰後 + 翌営業日) | T-0 → 15 min 以内 CEO 代行 GO |

---

## 関連 DEC / SOP v2 反映先

- DEC-019-025 (background dispatch SOP 17 件目)
- DEC-019-033 (knowledge 抽出経路)
- DEC-018-047 (PRJ-018 hotfix rollback ベストプラクティス継承)
- v2 SOP `launch-dry-run-sop-machine-executable-v2.md` §異常系 escalation tree に case A-E を機械実行 form で組込
- v2 §Pre-condition CARD H として「Owner backup contact 1 名 CEO に共有」を新設 (case E 再発防止)

---

**最終更新**: 2026-05-26 (Round 20 第 2 波 Marketing-N)
**次回見直し**: 2026-06-12 (D-7 本 rehearsal で case D / E を staging 演習) → 6/19 (公開当日 lock)
