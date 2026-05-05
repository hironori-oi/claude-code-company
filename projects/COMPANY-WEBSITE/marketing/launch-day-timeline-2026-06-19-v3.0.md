# 6/19 公開当日 Timeline v3.0 (Launch Day Polish)

## 0. 概要

- **対象**: PRJ-019 / COMPANY-WEBSITE 公開 **2026-06-19 09:00 JST**
- **本書 role**: 公開当日 06:00-12:00 JST 6 時間枠 の操作 timeline (v3.0)
- **派生元**:
  - Marketing-K R17 `launch-rehearsal-execution-script-2026-06-19.md` Section A-E (T-24h / T-2h / T-0 / T+1h / T+24h, Round 18 Marketing-L 拡張 / 不変保持)
  - Round 21 Marketing-O `launch-dry-run-rehearsal-detailed-procedure-2026-06-12.md` (D-7 詳細 / 不変保持)
  - Round 21 Web-Ops-H `owner-action-cards/INDEX.md` (OWN-PRE-01〜07 / 80 min / 5-15 min/card)
  - Round 22 Marketing-P D-7 prep + D-8 execution (本書同 Round)
- **version**: v3.0 (D-7 本 rehearsal 学習反映 + Owner action card 7 sub-card 整合 + 役割明示)
  - v1.0: Marketing-K R17 dry-run script (Chunk 01-10)
  - v2.0: Marketing-L R18 polish (Section A-E)
  - **v3.0**: 本書 (Round 22 Marketing-P / 06:00-12:00 6h timeline + Owner sub-card 整合)
- **完了基準**: T-0 09:00:00 JST 公開瞬間に Owner GO + smoke 8/8 + Lighthouse 4 score >= 90 + 5xx 0 件 + 4 部門同期
- **副作用**: 本書は文書のみ / 副作用 0 / 絵文字 0 / Heroicons 参照のみ / API $0
- **関連 DEC**: DEC-019-025 / DEC-019-033 / DEC-019-054 / DEC-019-062 / DEC-018-047

## 0.1 公開当日 6h timeline (06:00-12:00 JST)

| 時刻 (JST) | Phase | 所要 | 主担当 | OWN-PRE 整合 |
|---|---|---|---|---|
| 06:00-07:00 | §1 T-3h Owner 朝起動 + state 確認 | 60 min | Owner | OWN-PRE-07 (08:30 厳守) prep |
| 07:00-09:00 | §2 T-2h 4 部門最終同期 | 120 min | Web-Ops + Marketing + Dev + Review | OWN-PRE-03 (D-1 完) 継承 |
| 08:30-08:35 | §2.5 OWN-PRE-07 Owner 厳守 window | 5 min | Owner | OWN-PRE-07 実行 |
| 09:00:00-09:05 | §3 T-0 公開瞬間 5 step | 5 min | CEO + Dev + Web-Ops | 全 7 sub-card pre-condition 検証 |
| 09:05-10:00 | §4 T+5min〜T+1h 監視 + 異常検知 standby | 55 min | Web-Ops + Dev | - |
| 10:00-10:30 | §5 T+1h 検証 (Lighthouse / Sentry / GA / smoke) | 30 min | Web-Ops + Dev + Marketing | - |
| 10:30-11:30 | §6 T+1.5h 公報 + KPI 初期取得 | 60 min | Marketing + Web-Ops | - |
| 11:30-12:00 | §7 T+3h Owner 報告 + wrap-up | 30 min | CEO | - |
| **合計** | | **360 min (6h)** | | |

## 0.2 役割マトリクス (Owner / Marketing / Web-Ops / Sec / Dev / Review / CEO)

| Phase | Owner | Marketing | Web-Ops | Sec | Dev | Review | CEO |
|---|---|---|---|---|---|---|---|
| §1 T-3h | 主 (5 step) | 副 (vault) | 副 (state 確認) | 副 (snapshot prep) | - | - | 副 (Owner 接触) |
| §2 T-2h | - | 主 (素材) | 主 (Lighthouse) | 副 (RLS) | 主 (smoke) | 主 (検収 sign) | 副 |
| §2.5 OWN-PRE-07 | **主 (5 min 厳守)** | - | 副 (検証) | 副 (snapshot 確認) | - | - | - |
| §3 T-0 | - | - | 主 (DNS / CDN) | - | 主 (promote) | - | **主 (GO 発声)** |
| §4 監視 | - | - | 主 (smoke 監視) | 副 (Sentry) | 主 (Sentry / GA) | - | 副 |
| §5 T+1h | - | 副 (KPI) | 主 (smoke 8) | - | 主 (Sentry / GA) | - | 副 |
| §6 公報 | 副 (承認) | **主 (X / LinkedIn)** | 副 (smoke 維持) | - | 副 | - | 副 (承認) |
| §7 wrap-up | 副 (1 行報告) | 副 | 副 | - | 副 | 副 (最終 sign) | **主 (Owner 報告)** |

---

## §1 T-3h Owner 朝起動 + state 確認 (06:00-07:00 JST / 60 min)

### Phase 1 の goal
- Owner が 6/19 朝に起床 → 6/12 D-7 本 rehearsal 結果 + D-1 (6/18) final confidence を再読 → 公開最終 GO 心構え
- Owner action card 7 sub-card のうち OWN-PRE-01〜06 (D-7〜D-4 期限) の DONE 状態を 30 秒で再確認

### step 1-1: 06:00 Owner 起床 + Slack `#prj-019-launch` 確認 (5 min)

- **担当**: Owner
- **完了基準**: Slack 最終 24h post を再読 / D-1 final confidence 数値再確認
- **OWN-PRE 整合**: -
- **Owner 拘束**: 5 min

### step 1-2: 06:05 D-7 本 rehearsal 結果 KPI 5 行再確認 (10 min)

- **担当**: Owner
- **完了基準**:
  - D-7 PASS 数 (PASS 41/44 baseline 維持) 確認
  - 4 部門 OK reply 全件確認
  - 異常系 5 case 充足 90%+ 確認
  - OG image 8 case 全 PASS 確認
  - confidence 80%+ 維持確認
- **OWN-PRE 整合**: -
- **Owner 拘束**: 10 min (Marketing-O R21 confidence-spec §3.2 Path A-D 4 path 暗記)

### step 1-3: 06:15 D-1 (6/18) final confidence 再確認 (5 min)

- **担当**: Owner
- **完了基準**: confidence 80%+ → 6/19 公開維持 / 75-80% → CEO 判断 待機 / < 75% → 6/27 fallback 切替済
- **OWN-PRE 整合**: -
- **Owner 拘束**: 5 min

### step 1-4: 06:20 Owner action card 7 sub-card 状態最終確認 (15 min)

- **担当**: Owner
- **完了基準**: 7 sub-card 全件 DONE 状態 (Web-Ops が INDEX.md `状態` 列を DONE 更新済)
  - OWN-PRE-01 (Vercel Env GA4 + Sentry DSN) DONE 確認
  - OWN-PRE-02 (Vercel Env Supabase 3 key) DONE 確認
  - OWN-PRE-03 (DNS TTL 短縮 300 秒, D-1 17:00 期限) DONE 確認
  - OWN-PRE-04 (SLACK_WEBHOOK_URL + CRON_SECRET) DONE 確認
  - OWN-PRE-05 (Sentry alert ルール有効化) DONE 確認
  - OWN-PRE-06 (Supabase RLS 全 table 確認) DONE 確認
  - OWN-PRE-07 (Supabase manual snapshot, **08:30 JST 厳守**) **TODO** 維持確認 (今日実行)
- **OWN-PRE 整合**: 6 件 DONE 確認 + OWN-PRE-07 を §2.5 で実行する旨確認
- **Owner 拘束**: 15 min

### step 1-5: 06:35 朝食 + 心構え + Slack `#prj-019-launch` で 1 行宣言 (25 min)

- **担当**: Owner
- **完了基準**:
  - Slack post: `[D-Day 06:35] Owner ready / 08:30 OWN-PRE-07 実行 / 09:00 公開 GO 待機`
  - CEO + 4 部門責任者 reply 1 件以上
- **OWN-PRE 整合**: -
- **Owner 拘束**: 25 min (実拘束 5 min / 24 min は朝食 / 出社準備)

### Phase 1 集計
- 完了基準: Owner ready 確認 + 7 sub-card のうち OWN-PRE-01〜06 全 DONE 維持
- 不合格時: OWN-PRE-01〜06 のいずれか TODO 残存 → CEO に即時 escalate / 06:00-07:00 内に DONE 化 / 不能なら 09:00 開始 hold

---

## §2 T-2h 4 部門最終同期 (07:00-09:00 JST / 120 min)

### Phase 2 の goal
- Marketing-K R17 Section B (T-2h) ベース + D-7 本 rehearsal 学習反映
- Lighthouse 4 score / smoke 8 endpoint / vault hash / 検収 sign 全 GREEN
- 08:30 JST OWN-PRE-07 厳守 window 確保

### step 2-1: 07:00 Web-Ops Lighthouse 本番 preview 4 score 計測 (15 min)

- **担当**: Web-Ops
- **完了基準**: Desktop + Mobile 両方で perf/a11y/best-practices/seo 4 score >= 90 (>=95 で +2pt)
- **コマンド** (D-7 step 2-1/2-2 と同一):
  ```bash
  npx --yes lighthouse "$TARGET_URL" \
    --only-categories=performance,accessibility,best-practices,seo \
    --preset=desktop --output=json --output-path=./lh-launch-desktop.json
  npx --yes lighthouse "$TARGET_URL" \
    --only-categories=performance,accessibility,best-practices,seo \
    --form-factor=mobile --output=json --output-path=./lh-launch-mobile.json
  ```
- **NoGO 兆候**: 1 score < 90 → 即時 hold + Case D escalation tree (Web-Ops + CEO)

### step 2-2: 07:15 Marketing vault hash 再確認 (10 min)

- **担当**: Marketing
- **完了基準**: en-v1.1 / portfolio-v3.1 SHA256 が `$EXPECTED_EN_HASH` / `$EXPECTED_PORTFOLIO_HASH` と完全一致
- **コマンド**:
  ```bash
  EN_HASH=$(sha256sum projects/COMPANY-WEBSITE/marketing/en-v1.1.md | awk '{print $1}')
  PORTFOLIO_HASH=$(sha256sum projects/COMPANY-WEBSITE/marketing/portfolio-v3.1.md | awk '{print $1}')
  [ "$EN_HASH" = "$EXPECTED_EN_HASH" ] && echo "PASS en" || echo "FAIL en"
  [ "$PORTFOLIO_HASH" = "$EXPECTED_PORTFOLIO_HASH" ] && echo "PASS portfolio" || echo "FAIL portfolio"
  ```
- **NoGO 兆候**: hash 乖離 → vault export 値再 export → 不能なら 09:00 開始 hold

### step 2-3: 07:25 Dev cron prod 切替 PR merge ready 確認 (5 min)

- **担当**: Dev
- **完了基準**: `gh pr view "$CRON_PROD_PR" --json reviewDecision -q '.reviewDecision'` → `APPROVED` (本 step では merge せず、approval のみ整える)
- **NoGO 兆候**: `REVIEW_REQUIRED` → Review 部門に即時 sign 依頼

### step 2-4: 07:30 Marketing social 素材最終 prep + 予約 dry-run (15 min)

- **担当**: Marketing
- **完了基準**:
  - X thread 5 post / LinkedIn 3 post の予約投稿 dry-run 成功
  - 本送信は §6 (T+1h) まで保留
  - 投稿文に絵文字 0 / Heroicons 参照のみ
- **OWN-PRE 整合**: -

### step 2-5: 07:45 Dev smoke 8 endpoint 本番 scope 再実行 (10 min)

- **担当**: Dev
- **完了基準**: 8 endpoint 全 HEAD 200 (`/`, `/case-studies`, `/portfolio`, `/about`, `/contact`, `/en`, `/en/case-studies`, `/en/portfolio`)
- **NoGO 兆候**: 1 endpoint 以上 200 以外 → Case D escalation (CEO 判断: NoGO/GO_PARTIAL/GO_FULL)

### step 2-6: 07:55 Review 部門最終検収 sign Slack 1 行投稿 (5 min)

- **担当**: Review
- **完了基準**: `grep -c "REVIEW_SIGN_2026_06_19" projects/COMPANY-WEBSITE/reports/review-report.md` → 1 以上 + Slack post `OK Review: T-2h 検収 sign / 全項目 PASS`
- **NoGO 兆候**: sign 不在 → Review 部門副責に sign 依頼 (10 min) / 不能なら 09:00 開始 hold

### step 2-7: 08:00 4 部門 OK reply Slack 同期 (10 min)

- **担当**: 4 部門責任者
- **完了基準**: web-ops / marketing / dev / review 4 部門全件 `OK [部門名]: T-2h checklist 全 PASS` reply
- **NoGO 兆候**: 1 部門以上 reply 不在 → CEO mention → 5 min 内 reply / 不発時は §3 T-0 開始 hold (-2pt confidence)

### step 2-8: 08:10 Web-Ops + Marketing 同期 + state snapshot (10 min)

- **担当**: Web-Ops + Marketing
- **完了基準**:
  - Slack `#launch-2026-06-19` (本番 ch) で「T-2h 完了 / 全項目 GREEN」 1 回報告
  - state snapshot (preview deploy ID + cron PR ID + DNS TTL + Slack pinned message ID) を `dashboard/launch-state-snapshot-2026-06-19-T-2h.md` に記録

### step 2-9: 08:20 CEO 「T-2h 完了 / Owner GO 待機」 Slack post (5 min)

- **担当**: CEO
- **完了基準**: Slack post `[D-Day 08:20] T-2h GREEN / Owner GO 09:00:00 JST 待機 / NoGO SLA 30min pinned`

### step 2-10: 08:25 Owner OWN-PRE-07 実行 5 min 前 alert (5 min)

- **担当**: Web-Ops
- **完了基準**: Owner DM `[OWN-PRE-07] 08:30 厳守 window / Supabase manual snapshot 5 min 作業 開始してください`

---

## §2.5 OWN-PRE-07 Owner 厳守 window (08:30-08:35 JST / 5 min)

### Phase 2.5 の goal
- Owner action card 7 sub-card のうち最後の 1 件 OWN-PRE-07 (Supabase manual snapshot) を **08:25-08:35 厳守 window** で実行
- Round 21 Web-Ops-H sub-card §3 期限「2026-06-19 08:30」と完全整合

### step 2.5-1: 08:30:00 Owner OWN-PRE-07 実行 (5 min)

- **担当**: Owner (主) + Web-Ops (検証)
- **完了基準**:
  - Owner が Supabase Dashboard で manual snapshot 取得開始 click
  - snapshot 完了通知 (Supabase Dashboard 表示) 確認
  - Slack post `OWN-PRE-07 done 08:35 / snapshot ID = ___` (Owner)
  - Web-Ops INDEX.md `状態` 列 OWN-PRE-07 を `TODO → DONE` 更新 PR merge
- **OWN-PRE 整合**: OWN-PRE-07 DONE → CARD A (公開前運用設定) 完了 → CARD C (6/19 公開最終確認) pre-condition 成立
- **Owner 拘束**: 5 min (本 6h timeline 中の Owner 唯一の実拘束)
- **NoGO 兆候**:
  - 08:35 までに snapshot 完了せず → CEO 判断 (snapshot 不在 → rollback 経路 (Case A) 影響大 → 09:00 開始 hold 検討)
  - Supabase Dashboard 障害 → CEO + Dev 即時調査 → 不能なら 6/27 fallback 切替判断 trigger

### Phase 2.5 集計
- 完了基準: OWN-PRE-07 DONE + 7 sub-card 全件 DONE 完成 + CARD A 完了通知

---

## §3 T-0 公開瞬間 5 step (09:00:00-09:05 JST / 5 min)

### Phase 3 の goal
- Marketing-K R17 Section C (5 step) ベース + D-7 本 rehearsal 学習反映
- 09:00:00 → 09:02:00 までに promote → DNS → CDN → monitoring 確立
- 09:02:00 → 09:05 で 4 部門「T-0 完了」reply 集約

### step 3-1: 09:00:00 CEO Owner GO 受領 Slack 明示 (1 行) (30 sec)

- **担当**: CEO
- **完了基準**: Slack post `[D-Day 09:00:00] CEO GO received from Owner at 09:00:00 JST / Phase T-0 開始`
- **OWN-PRE 整合**: 7 sub-card 全 DONE 確認済前提
- **Owner 拘束**: 0 min (Owner sign は §1 step 1-5 で完了 / §2.5 OWN-PRE-07 で完了)
- **NoGO 兆候**:
  - Owner GO 不発 → Case E escalation tree → CEO_PROXY_GO 判断 (T+5min DM / T+10min ch / T+15min CEO_PROXY_GO)

### step 3-2: 09:00:30 Dev `vercel promote --prod` 本番実行 (60 sec 以内応答必須) (60 sec)

- **担当**: Dev
- **完了基準**:
  ```bash
  vercel promote "$PREVIEW_URL" --scope "$VERCEL_TEAM"
  # exit 0 + "Production deployment promoted" メッセージ
  ```
  60 sec 以内に応答返却
- **NoGO 兆候**: 60 sec 内応答無 → Case A (rollback) escalation tree (本番化前のため `vercel rollback` ではなく promote 中止)

### step 3-3: 09:01:00 Web-Ops DNS 切替確認 + CDN purge 本番実行 (30 sec)

- **担当**: Web-Ops
- **完了基準**:
  ```bash
  # DNS 切替済 (D-1 17:00 で実施済) → TTL 300 秒で伝播確認
  dig +short company-website.example A
  # CDN purge 本番実行
  curl -s -X POST "https://${CDN_HOST}/purge" -o /dev/null -w "%{http_code}"
  ```
  本番 IP + CDN purge HTTP 200
- **OWN-PRE 整合**: OWN-PRE-03 (DNS TTL 300 秒短縮 D-1 完) 継承
- **NoGO 兆候**: DNS 反映遅延 → 5 min 待機 / CDN purge FAIL → CDN admin (Dev) 即時調査

### step 3-4: 09:01:30 Dev monitoring dashboard 3 画面 open (30 sec)

- **担当**: Dev
- **完了基準**: 以下 3 URL を browser で同時 open:
  - Vercel Analytics (`$VERCEL_ANALYTICS_URL`)
  - Sentry project (`$SENTRY_PROJECT_URL`)
  - GA realtime (`$GA_REALTIME_URL`)
- **OWN-PRE 整合**: OWN-PRE-01 (GA4 + Sentry DSN) + OWN-PRE-05 (Sentry alert) 継承

### step 3-5: 09:02:00 Web-Ops 「T-0 完了」 Slack post + DNS 3 経路一致確認 (60 sec)

- **担当**: Web-Ops
- **完了基準**:
  ```bash
  # 3 経路一致
  dig +short company-website.example A @1.1.1.1
  dig +short company-website.example A @8.8.8.8
  dig +short company-website.example A @9.9.9.9
  # 全 3 経路で同一 A record
  
  curl -s -X POST "$SLACK_WEBHOOK_PROD" \
    -d '{"text":"[D-Day 09:02:00] T-0 完了 / 4 部門 T+1h smoke 待機モード移行"}'
  ```
- **NoGO 兆候**: 3 経路で異なる IP → 5 min 待機 → 不一致継続なら CDN purge 再実行

### step 3-6: 09:02-09:05 4 部門「T-0 完了」 reply (3 min)

- **担当**: 4 部門責任者
- **完了基準**: 4 部門 + CEO 全件 `OK [部門名]: T-0 完了 / T+1h 待機` reply
- **NoGO 兆候**: reply 不全 → CEO 判断 (-1pt confidence)

### Phase 3 集計
- 完了基準: 5 step 全 PASS + 4 部門 OK reply + smoke 即 200 (任意 spot check)
- 異常時: Case A (rollback) → 5 min 以内 rollback 開始

---

## §4 T+5min〜T+1h 監視 + 異常検知 standby (09:05-10:00 JST / 55 min)

### Phase 4 の goal
- 公開直後 55 min の **集中監視 window** (5xx 0 件 / 4xx baseline / GA realtime activeUsers > 0)
- 異常検知時 5 min 以内 escalation (Case A/D)

### step 4-1: 09:05-09:30 Web-Ops smoke 5 min interval 監視 (25 min / 5 回)

- **担当**: Web-Ops
- **完了基準**: 5 min 間隔で smoke 8 endpoint HEAD 200 確認 → 5 回連続 PASS
- **NoGO 兆候**: 1 endpoint 以上 200 以外 → Case D (smoke FAIL) escalation tree

### step 4-2: 09:05-10:00 Dev Sentry 監視 (55 min / 連続)

- **担当**: Dev
- **完了基準**: 5xx 0 件 / 4xx < 10 件 / 1 min interval で alert 発火 0 件
- **OWN-PRE 整合**: OWN-PRE-05 (Sentry alert error_rate > 1% / 5min) 継承
- **NoGO 兆候**: 5xx > 50/min → Case A (rollback) escalation / 4xx baseline +/-10% 超過 → Dev 即時調査

### step 4-3: 09:05-10:00 Dev GA realtime 監視 (55 min / 連続)

- **担当**: Dev
- **完了基準**: GA realtime activeUsers > 0 / 主要 page (/, /case-studies, /portfolio) view 比率確認
- **OWN-PRE 整合**: OWN-PRE-01 (GA4 DSN) 継承

### step 4-4: 09:30 Web-Ops 中間報告 Slack (5 min)

- **担当**: Web-Ops
- **完了基準**: Slack post `[T+30min] smoke 5/5 PASS / Sentry 5xx 0 / GA active > 0`

### step 4-5: 10:00 Web-Ops 「T+1h 突入」 Slack 集合 post (5 min)

- **担当**: Web-Ops
- **完了基準**: Slack post `[T+1h 10:00] §5 T+1h 検証 開始 / Lighthouse / Sentry / GA / smoke 4 検証`

### Phase 4 集計
- 完了基準: 55 min 監視で 5xx 0 件 + smoke 5/5 PASS

---

## §5 T+1h 検証 (10:00-10:30 JST / 30 min)

### Phase 5 の goal
- Marketing-K R17 Section D (4 検証) ベース + D-7 本 rehearsal 学習反映
- Lighthouse 本番再計測 + Sentry stats fixed window + GA realtime + smoke 8 endpoint

### step 5-1: 10:00 Web-Ops Lighthouse 本番再計測 (10 min)

- **担当**: Web-Ops
- **完了基準**: Desktop + Mobile 両方で 4 score >= 90 (>=95 で confidence +2pt)
- **コマンド**: §2.1 と同一 (TARGET_URL = 本番 URL)
- **NoGO 兆候**: 1 score < 90 → Case D escalation

### step 5-2: 10:05 Dev Sentry stats fixed window (5 min)

- **担当**: Dev
- **完了基準**:
  ```bash
  curl -s -H "Authorization: Bearer $SENTRY_TOKEN" \
    "https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJ}/stats/?stat=received&resolution=1h&since=${LAUNCH_TIMESTAMP}"
  ```
  5xx 0 件 / 4xx baseline +/-10% 以内
- **NoGO 兆候**: 5xx > 0 → Sentry trace を Dev 5 min 以内分類 (cache 起因 → purge / code 起因 → rollback 検討)

### step 5-3: 10:10 Dev GA realtime activeUsers + 国別分布 (5 min)

- **担当**: Dev
- **完了基準**:
  - activeUsers > 0
  - 国別分布 取得
  - 主要 page view 比率確認

### step 5-4: 10:15 Web-Ops smoke 8 endpoint 本番 scope (5 min)

- **担当**: Web-Ops
- **完了基準**: 8 endpoint 全 HEAD 200

### step 5-5: 10:20 Dev Supabase pageview_event 1h 集計 (5 min)

- **担当**: Dev
- **完了基準**:
  ```bash
  psql "$SUPABASE_READONLY_URL" -c \
    "select event, count(*) from analytics.pageview_event where created_at > '2026-06-19 09:00 JST' group by 1 order by 2 desc limit 5;"
  ```
  top5 events 取得

### step 5-6: 10:25 Web-Ops 「T+1h 検証完了」 1 行報告 (5 min)

- **担当**: Web-Ops
- **完了基準**: Slack post `[T+1h 10:25] D-1〜D-5 全 PASS / 公開成功`

### Phase 5 集計
- 完了基準: D-1〜D-5 全 PASS + 4 部門 OK reply

---

## §6 T+1.5h 公報 + KPI 初期取得 (10:30-11:30 JST / 60 min)

### Phase 6 の goal
- Marketing 主導: X thread + LinkedIn 本送信 + KPI 初期 snapshot
- Web-Ops 副: smoke 維持監視継続

### step 6-1: 10:30 Marketing X thread 5 post 本送信 (15 min)

- **担当**: Marketing
- **完了基準**: 5 post 順次送信 (5 min interval) + 各 post に絵文字 0 / Heroicons 参照のみ
- **CEO 承認**: 10:30 直前に CEO 1 行 OK

### step 6-2: 10:45 Marketing LinkedIn 3 post 本送信 (15 min)

- **担当**: Marketing
- **完了基準**: 3 post 順次送信 (5 min interval)

### step 6-3: 10:30-11:30 Web-Ops smoke 維持監視 (60 min / 連続)

- **担当**: Web-Ops
- **完了基準**: 10 min interval で smoke 8 endpoint HEAD 200 (6 回 連続 PASS)

### step 6-4: 11:00 Marketing KPI 初期 snapshot (10 min)

- **担当**: Marketing
- **完了基準**: T+2h 時点で以下 4 指標 snapshot:
  - Impression (GA page view 累積)
  - Click (CTA click count)
  - Signup (contact_request count)
  - Bounce rate
- **記録先**: `dashboard/launch-kpi-2026-06-19-T+2h.md` (新規作成)

### step 6-5: 11:15 Marketing 「公報完了」 Slack 報告 (5 min)

- **担当**: Marketing
- **完了基準**: Slack post `[T+2h 15min] 公報完了 / X 5 post / LinkedIn 3 post / KPI snapshot 取得`

### step 6-6: 11:20 Web-Ops 「smoke 維持継続」 1 行報告 (5 min)

- **担当**: Web-Ops
- **完了基準**: Slack post `[T+2h 20min] smoke 維持 6/6 PASS`

### Phase 6 集計
- 完了基準: 公報 8 post 全送信 + KPI snapshot 取得 + smoke 維持

---

## §7 T+3h Owner 報告 + wrap-up (11:30-12:00 JST / 30 min)

### Phase 7 の goal
- CEO Owner 報告 + Review 最終 sign + Slack wrap-up
- T+24h KPI snapshot は Marketing-K R17 Section E (6/20 09:00 JST) で別途実施

### step 7-1: 11:30 CEO Owner 報告 (10 min)

- **担当**: CEO
- **完了基準**: Owner DM `[D-Day 11:30] 公開成功 / KPI 初期 snapshot 取得 / Sentry 5xx 0 / smoke 維持 / Lighthouse 4 score >=90 維持` + Owner 1 行 reply 受領
- **Owner 拘束**: 1 min (1 行 reply のみ)

### step 7-2: 11:40 Review 最終 sign (5 min)

- **担当**: Review
- **完了基準**: Slack post `OK Review: 公開当日 全項目 PASS / 検収最終 sign`

### step 7-3: 11:45 各部門 wrap-up 1 行 (10 min)

- **担当**: 4 部門責任者 + Sec
- **完了基準**: 各部門 1 行 wrap-up post:
  - Web-Ops: smoke 8/8 維持 / Lighthouse 4 score 維持
  - Marketing: 公報 8 post / KPI 初期 snapshot
  - Dev: Sentry 5xx 0 / GA realtime active 確認
  - Review: 検収最終 sign
  - Sec: snapshot 確認 / RLS 確認

### step 7-4: 11:55 CEO 「公開当日 wrap-up 完了」 Slack post (5 min)

- **担当**: CEO
- **完了基準**: Slack post `[D-Day 11:55] 公開当日 wrap-up 完了 / 6/20 T+24h KPI snapshot は別 timeline / 7/19 30 day review baseline 投入準備`

### Phase 7 集計
- 完了基準: Owner 報告完了 + 4 部門 + Sec + Review wrap-up post 全件 + CEO post

---

## §8 公開当日完了基準

| 項目 | 基準 | 確認 |
|---|---|---|
| OWN-PRE-07 (08:30 JST) | DONE | [ ] |
| Owner GO (09:00:00) | 受領済 | [ ] |
| vercel promote (09:00:30) | 60 sec 内応答 | [ ] |
| DNS 3 経路一致 (09:02) | 全一致 | [ ] |
| smoke 8/8 (T+0 / T+1h) | 全 PASS | [ ] |
| Lighthouse 4 score (T+1h) | >=90 (>=95 で +2pt) | [ ] |
| Sentry 5xx (T+1h) | 0 件 | [ ] |
| GA realtime active (T+1h) | > 0 | [ ] |
| 4 部門 OK reply (T+0 / T+1h) | 全件 | [ ] |
| 公報 X 5 + LinkedIn 3 (T+2h) | 8 post 全送信 | [ ] |
| KPI 初期 snapshot (T+2h) | 4 指標取得 | [ ] |
| Owner 報告 (T+3h) | reply 受領 | [ ] |
| Review 最終 sign (T+3h) | sign 取得 | [ ] |

## §9 異常時 fallback (Case A-E 適用)

D-7 本 rehearsal §6 異常系演習 5 case + Round 22 D-7 prep §7.3 5 case を当日 trigger 時に即座適用:

- **Case A (rollback)**: Sentry 5xx > 50/min → 5 min 以内 rollback 開始 → CEO @channel GO 発声
- **Case B (cron fallback)**: heartbeat > 500k → 10 min 以内 切替 → cron pause + fallback enable
- **Case C (Slack outage)**: Slack 10 min 不達 → 15 min 以内 email broadcast → fallback channel 確立
- **Case D (smoke FAIL)**: smoke 1 endpoint 以上 FAIL → 6 min 以内 CEO 判断 (NoGO/GO_PARTIAL/GO_FULL)
- **Case E (Owner GO 遅延)**: Owner GO 不発 15 min 経過 → CEO_PROXY_GO 判断 → CARD H backup contact

各 case の手順詳細は `launch-dry-run-anomaly-cases.md` (Round 20 / 不変保持) 参照。

## §10 副作用 0 担保 (本書策定後チェック)

- [x] 本書は文書のみ / 実行 0
- [x] 本書記入時に Slack post 0 / curl 0 / cron 操作 0 / DNS 操作 0
- [x] 副作用 0 / 絵文字 0 / Heroicons 以外参照 0
- [x] API $ コスト 0
- [x] Marketing-K R17 launch-rehearsal-execution-script (Section A-E) 無改変
- [x] Round 21 4 ファイル無改変 (detailed-procedure / pre-rehearsal-validation / log-template / confidence-spec)
- [x] Round 22 同 Round (D-8 execution / D-7 prep) 整合性確保
- [x] Round 21 Web-Ops-H Owner action card INDEX + 7 sub-card 無改変

## §11 関連 DEC / KPI / Round 23 引継

- DEC-019-025: background dispatch SOP 19 件目
- DEC-019-033: knowledge 抽出経路 (本書を `organization/knowledge/patterns/launch-day-timeline.md` 候補化)
- DEC-019-054: portfolio v3.1 hash check (§2.2)
- DEC-019-062: cron 5 本 + CRON_SECRET (§2.3 + Phase 4 監視)
- DEC-018-047: PRJ-018 hotfix rollback ベストプラクティス継承 (§9 Case A)

KPI 連動:
- 17 日 path 完成度: 本書で 6/19 timeline v3.0 物理化 → +1 path
- DEC trajectory: DEC-019-071 候補 (D-8 / D-7 prep / 6/19 timeline 3 件まとめて 1 議決)
- 11-HITL: 本書は HITL 第 9 種 `dev_kickoff_approval` 対象外

Round 23 引継 (Marketing-Q 想定):
1. D-7 本 rehearsal 結果による本書 v3.1 改版 (FAIL/SKIP step の handling 追加)
2. T+24h (6/20 09:00 JST) KPI snapshot 別 timeline 起票 (本書 §7 で別 timeline 言及)
3. 7/19 30 day review baseline 投入準備
4. 6/27 fallback 切替時の本書再評価 (LAUNCH_DATE_JST 書換 + DATE 連鎖)

---

## §12 confidence 寄与 (本書策定による)

- baseline (Round 21 完遂時): 80% (Round 21 4 ファイル + procedure 物理化)
- 本書 v3.0 物理化: +1pt (Owner sub-card 7 整合 + Phase 7 段階明示 + 役割マトリクス確立)
- D-8 execution + D-7 prep 物理化 (本 Round 同時): +1pt (実行可能化)
- **Round 22 完遂時 confidence**: **82%** (+2pt)
- D-7 当日結果次第で +5pt 加点 path 維持 → **最大 87%** (Path A 完璧 path)

---

**最終更新**: 2026-05-05 (Round 22 / Marketing-P / 6/19 timeline v3.0 起票)
**派生元**: Marketing-K R17 Section A-E / Round 21 4 ファイル / Round 21 Web-Ops-H Owner action card 7 sub-card
**次回見直し**: 2026-06-12 (D-7 結果反映 v3.1) → 6/16 (D-3 必要時) → 6/19 (公開当日 lock)
