# 6/12 D-7 本 Rehearsal 詳細手順書 (Detailed Procedure)

## 0. 概要

- **対象**: PRJ-019 / COMPANY-WEBSITE 公開 (2026-06-19 09:00 JST 想定 / 確度 76%)
- **本書 role**: D-7 = 2026-06-12 09:00-12:00 JST 3 時間枠の本 rehearsal を step 単位で完全実行可能化する詳細手順書
- **派生元**:
  - Round 19 Marketing-M `launch-dry-run-sop-machine-executable.md` (v1 / 198 行 / 不変保持)
  - Round 20 Marketing-N `launch-dry-run-sop-machine-executable-v2.md` (355 行 / D-24 mock 反映)
  - Round 20 Marketing-N `launch-dry-run-rehearsal-report-2026-05-26.md` §8.2 D-7 構成 (3h / 6 Phase)
  - Round 20 Marketing-N `launch-dry-run-anomaly-cases.md` (290 行 / 異常 5 case)
- **構成**: 6 Phase × 計 44 step (Phase1=9 / Phase2=9 / Phase3=10 / Phase4=6 / Phase5=5 / Phase6=5)
- **完了基準**: PASS 38/40 + 4 部門 OK reply + confidence 80%+
- **副作用**: 0 (D-7 本 rehearsal も実 cron 起動 / 実 deploy / 実本番 Slack 投稿 / 実 DNS 変更は禁止)
- **絵文字 0 / Heroicons 参照のみ / API 追加コスト $0**
- **関連 DEC**: DEC-019-025 (background dispatch SOP 18 件目) / DEC-019-033 (knowledge 抽出経路) / DEC-018-047 (rollback 継承)

## 0.1 D-7 本 rehearsal 全体時間配分

| Phase | 想定 | 所要 | step 数 | SOP 参照 |
|---|---|---|---|---|
| Phase 1 | T-24h 想定 (実 env) | 60 min | 9 | SOP v2 §SOP 1 |
| Phase 2 | T-2h 想定 (実 env) | 45 min | 9 | SOP v2 §SOP 2 |
| Phase 3 | T-0 公開 (副作用 0 mock) | 15 min | 10 | SOP v2 §SOP 3 |
| Phase 4 | T+1h post-launch (実 env) | 30 min | 6 | SOP v2 §SOP 4 |
| Phase 5 | T+24h KPI (実 env read-only) | 15 min | 5 | SOP v2 §SOP 5 |
| Phase 6 | 異常系演習 5 case | 15 min | 5 | anomaly-cases.md |
| **合計** | | **180 min** | **44** | |

## 0.2 各 step 記述形式 (本書共通)

各 step は以下 7 要素で構成 (Owner formal「引き続き丁寧に」directive 順守):

1. **担当**: 主担当者 (Web-Ops / Dev / Marketing / Review / CEO のいずれか)
2. **所要**: minutes (推奨)
3. **実行 SOP 参照**: SOP v2 の対応 step ID
4. **コマンド (SQL/curl/CLI)**: 実 env で発火する 1 行
5. **期待 output sample**: PASS 判定の output 文字列例
6. **FAIL 時 escalation**: 1 次判断者 / 連絡経路 / 次手順
7. **Owner 拘束**: 推奨 0 min (Owner の rehearsal 立ち会いは Phase 1 冒頭 + Phase 6 末尾の sign のみ)

---

## §1 Phase 1: T-24h 想定 (60 min / 9 step / 09:00-10:00 JST)

### Phase 1 の goal
- SOP v2 §SOP 1 の T24-01 〜 T24-08 を **実 env** で発火 (D-24 mock では 9 件中 PASS 0 / FAIL 3 / SKIP 3 / N/A 3)
- D-7 では **9 件全 PASS** が完了基準
- Pre-condition CARD A-H が GREEN であること (Phase 1 開始前に Web-Ops が確認)

### step 1-1: T24-01 GO/NoGO issue 起票確認

- **担当**: Web-Ops
- **所要**: 3 min
- **SOP**: §SOP 1 T24-01
- **コマンド**:
  ```bash
  gh issue list --repo claude-code-company/internal --label "go-no-go" --state open --json number,title
  ```
- **期待 output**: `[{"number":NN,"title":"GO/NoGO 6/19 公開判断"}]` (1 件以上)
- **FAIL 時**: issue 未起票 → CEO に Slack mention → 即時起票指示 (5 min) → 再 PASS 確認
- **Owner 拘束**: 0 min

### step 1-2: T24-02 GO/NoGO 判断票テンプレ存在確認

- **担当**: Web-Ops
- **所要**: 1 min
- **SOP**: §SOP 1 T24-02
- **コマンド**:
  ```bash
  test -f "dashboard/launch-go-nogo-template-2026-06-26.md" && echo "PASS T24-02" || echo "FAIL T24-02"
  ```
- **期待 output**: `PASS T24-02`
- **FAIL 時**: template 未起票 → Marketing-O へ起票 mention (10 min) → 再確認
- **Owner 拘束**: 0 min

### step 1-3: T24-03 dryrun-result skeleton 確認

- **担当**: Web-Ops
- **所要**: 1 min
- **SOP**: §SOP 1 T24-03
- **コマンド**:
  ```bash
  test -f "dashboard/launch-dryrun-2026-06-19-result.md" && echo "PASS T24-03" || echo "FAIL T24-03"
  ```
- **期待 output**: `PASS T24-03`
- **FAIL 時**: CEO に CARD B 未消化を escalate (5 min) → CEO が skeleton 起票 → 再確認
- **Owner 拘束**: 0 min

### step 1-4: T24-04 PII redaction config 確認

- **担当**: Dev
- **所要**: 2 min
- **SOP**: §SOP 1 T24-04
- **コマンド**:
  ```bash
  grep -c "redaction_enabled: true" organization/knowledge/.config.yml
  ```
- **期待 output**: `1` 以上
- **FAIL 時**: PRJ-019 W4 task 前倒し → Dev が `.config.yml` 起票 (15 min) → 再確認
- **Owner 拘束**: 0 min

### step 1-5: T24-05a/b vault hash 一致

- **担当**: Marketing
- **所要**: 5 min (a + b)
- **SOP**: §SOP 1 T24-05
- **コマンド**:
  ```bash
  EN_HASH=$(sha256sum projects/COMPANY-WEBSITE/marketing/en-v1.1.md | awk '{print $1}')
  PORTFOLIO_HASH=$(sha256sum projects/COMPANY-WEBSITE/marketing/portfolio-v3.1.md | awk '{print $1}')
  [ "$EN_HASH" = "$EXPECTED_EN_HASH" ] && echo "PASS T24-05a" || echo "FAIL T24-05a"
  [ "$PORTFOLIO_HASH" = "$EXPECTED_PORTFOLIO_HASH" ] && echo "PASS T24-05b" || echo "FAIL T24-05b"
  ```
- **期待 output**: `PASS T24-05a` + `PASS T24-05b`
- **FAIL 時**: hash 乖離 → Marketing が vault export 値を CARD C で再 export → 再確認 (5 min)
- **Owner 拘束**: 0 min

### step 1-6: T24-06 Slack reachability dry post

- **担当**: Web-Ops
- **所要**: 2 min
- **SOP**: §SOP 1 T24-06
- **コマンド**:
  ```bash
  curl -s -o /dev/null -w "%{http_code}" -X POST "$SLACK_WEBHOOK_DRY" \
    -H 'Content-Type: application/json' \
    -d '{"text":"[D-7 rehearsal] T24-06 reachability"}'
  ```
- **期待 output**: `200`
- **FAIL 時**: 401/403/404 → Case C (Slack outage) escalation tree 適用 → email fallback テスト (15 min)
- **Owner 拘束**: 0 min (本 rehearsal は dry channel `#launch-dry-2026-06-19` 限定)

### step 1-7: T24-07 Owner schedule 確認

- **担当**: CEO
- **所要**: 5 min
- **SOP**: §SOP 1 T24-07 (manual)
- **コマンド**: なし (Owner 自己申告)
- **期待 output**: Owner が「6/19 08:30-10:00 JST blocker-free」を Slack で 1 行宣言
- **FAIL 時**: Owner schedule 未確定 → CEO が代替時刻提案 → CARD H backup contact 経路で代行 GO 確認
- **Owner 拘束**: 1 min (Slack 宣言のみ / D-7 本 rehearsal の唯一の Owner 関与 step)

### step 1-8: T24-08 NoGO SLA 30min pinned 確認

- **担当**: CEO
- **所要**: 3 min
- **SOP**: §SOP 1 T24-08 (manual)
- **コマンド**: Slack `#launch-2026-06-19` の pinned message 確認
- **期待 output**: pinned post に「NoGO SLA: 30min from detection to GO/HOLD decision」明記
- **FAIL 時**: pinned 未設定 → CEO が即時 pin (2 min) → 再確認
- **Owner 拘束**: 0 min

### step 1-9: Phase 1 完了 Slack post + 集計

- **担当**: Web-Ops
- **所要**: 2 min
- **SOP**: §SOP 1 末尾「Owner が CEO に T-24h 完了 1 行返信」
- **コマンド**:
  ```bash
  curl -s -X POST "$SLACK_WEBHOOK_DRY" \
    -H 'Content-Type: application/json' \
    -d '{"text":"[D-7 rehearsal] Phase 1 (T-24h) PASS 9/9 / 開始 09:00 終了 ___:___"}'
  ```
- **期待 output**: PASS 9 / FAIL 0 / SKIP 0
- **FAIL 時**: PASS < 8 → Phase 2 開始 hold → CEO 判断
- **Owner 拘束**: 0 min

### Phase 1 集計
- 完了基準: PASS 9/9 (D-7 では SKIP/FAIL は 1 件以下が許容)
- 9 件全 PASS で Phase 2 移行可

---

## §2 Phase 2: T-2h 想定 (45 min / 9 step / 10:00-10:45 JST)

### Phase 2 の goal
- SOP v2 §SOP 2 の T02-01 〜 T02-08 を **実 env** で発火
- Lighthouse 4 score 実測、smoke 8 endpoint 実 200 確認
- D-24 mock では 9 件中 PASS 1 / FAIL 3 / SKIP 5 → D-7 では **9 件全 PASS** が完了基準

### step 2-1: T02-01a Lighthouse Desktop 実測

- **担当**: Web-Ops
- **所要**: 5 min
- **SOP**: §SOP 2 T02-01
- **コマンド**:
  ```bash
  npx --yes lighthouse "$TARGET_URL" \
    --only-categories=performance,accessibility,best-practices,seo \
    --preset=desktop --output=json --output-path=./lh-desktop.json --chrome-flags="--headless"
  ```
- **期待 output**: 4 score >= 90 (perf/a11y/best-practices/seo)
- **FAIL 時**: 1 項目 < 90 → 即時 Case D (smoke FAIL) escalation 適用 → CEO に NoGO 提案
- **Owner 拘束**: 0 min

### step 2-2: T02-01b Lighthouse Mobile 実測

- **担当**: Web-Ops
- **所要**: 5 min
- **SOP**: §SOP 2 T02-01
- **コマンド**:
  ```bash
  npx --yes lighthouse "$TARGET_URL" \
    --only-categories=performance,accessibility,best-practices,seo \
    --form-factor=mobile --output=json --output-path=./lh-mobile.json --chrome-flags="--headless"
  ```
- **期待 output**: 4 score >= 90 (mobile)
- **FAIL 時**: step 2-1 と同じ
- **Owner 拘束**: 0 min

### step 2-3: T02-02 cron prod 切替 PR approval 確認

- **担当**: Dev
- **所要**: 2 min
- **SOP**: §SOP 2 T02-02
- **コマンド**:
  ```bash
  gh pr view "$CRON_PROD_PR" --json reviewDecision,mergeable -q '.reviewDecision'
  ```
- **期待 output**: `APPROVED`
- **FAIL 時**: `REVIEW_REQUIRED` → Review 部門へ即時 review 依頼 (15 min) → 再確認 (D-7 本 rehearsal で merge は禁止 / approval 状態のみ確認)
- **Owner 拘束**: 0 min

### step 2-4: T02-03 vault hash 再確認 (T24-05 と同コマンド)

- **担当**: Marketing
- **所要**: 2 min
- **SOP**: §SOP 2 T02-03
- **コマンド**: step 1-5 と完全同一
- **期待 output**: `PASS T02-03a` + `PASS T02-03b`
- **FAIL 時**: hash 乖離 → en/portfolio が Phase 1 - Phase 2 間で改変された可能性 → Marketing 即時調査 (5 min)
- **Owner 拘束**: 0 min

### step 2-5: T02-04a/b social 素材存在確認

- **担当**: Marketing
- **所要**: 1 min (a + b)
- **SOP**: §SOP 2 T02-04
- **コマンド**:
  ```bash
  test -f projects/COMPANY-WEBSITE/marketing/social-x-thread.md && echo "PASS T02-04a"
  test -f projects/COMPANY-WEBSITE/marketing/social-linkedin.md && echo "PASS T02-04b"
  ```
- **期待 output**: `PASS T02-04a` + `PASS T02-04b`
- **FAIL 時**: 素材未起票 → Round 21 Marketing-O が 6/12 までに起票必須 → D-7 本 rehearsal 開始前段で確認すべき
- **Owner 拘束**: 0 min

### step 2-6: T02-05 Slack T-2h sync dry post

- **担当**: Web-Ops
- **所要**: 1 min
- **SOP**: §SOP 2 T02-05
- **コマンド**:
  ```bash
  curl -s -X POST "$SLACK_WEBHOOK_DRY" \
    -H 'Content-Type: application/json' \
    -d '{"text":"[D-7 rehearsal] T-2h sync: web-ops/marketing/dev/review GREEN (mock)"}'
  ```
- **期待 output**: HTTP 200
- **FAIL 時**: Case C (Slack outage) escalation
- **Owner 拘束**: 0 min

### step 2-7: T02-06 smoke 8 endpoint 実測 (HEAD 200)

- **担当**: Web-Ops
- **所要**: 5 min
- **SOP**: §SOP 2 T02-06 (yml 駆動)
- **コマンド**:
  ```bash
  for path in $(yq '.endpoints[]' projects/COMPANY-WEBSITE/marketing/smoke-endpoints.yml); do
    code=$(curl -s -o /dev/null -w "%{http_code}" -I "${TARGET_URL}${path}")
    echo "T02-06 ${path} ${code}"
  done
  ```
- **期待 output**: 8 endpoint 全 200 (`/`, `/case-studies`, `/portfolio`, `/about`, `/contact`, `/en`, `/en/case-studies`, `/en/portfolio`)
- **FAIL 時**: 1 endpoint 以上 200 以外 → Case D (smoke FAIL) escalation tree → CEO 判断 (NoGO/GO_PARTIAL/GO_FULL)
- **Owner 拘束**: NoGO 時 5 min (本 D-7 rehearsal では NoGO 判定 → Phase 3 hold で代用)

### step 2-8: T02-07 Review 部門検収 sign

- **担当**: Review
- **所要**: 2 min
- **SOP**: §SOP 2 T02-07
- **コマンド**:
  ```bash
  grep -c "REVIEW_SIGN_2026_06_19" projects/COMPANY-WEBSITE/reports/review-report.md
  ```
- **期待 output**: 1 以上
- **FAIL 時**: sign 未押 → Review 部門へ即時 sign 依頼 (10 min) → 再確認
- **Owner 拘束**: 0 min

### step 2-9: T02-08 4 部門 OK reply Slack post

- **担当**: 4 部門責任者 (Web-Ops / Marketing / Dev / Review)
- **所要**: 5 min (4 部門 × 1 min + 集計 1 min)
- **SOP**: §SOP 2 T02-08
- **コマンド** (各部門):
  ```bash
  curl -X POST "$SLACK_WEBHOOK_DRY" \
    -H 'Content-Type: application/json' \
    -d '{"text":"OK [部門名]: T-2h checklist 全 PASS (D-7 rehearsal mock)"}'
  ```
- **期待 output**: 4 部門 reply 全件
- **FAIL 時**: 1 部門以上 reply 不在 → CEO が部門責任者へ mention → 5 min 以内 reply / 不発時は Phase 3 hold
- **Owner 拘束**: 0 min

### Phase 2 集計
- 完了基準: PASS 9/9
- Lighthouse 4 score >= 90 が NoGO 第一指標
- 9 件全 PASS で Phase 3 移行可

---

## §3 Phase 3: T-0 公開実行手順 (副作用 0 mock / 15 min / 10 step / 10:45-11:00 JST)

### Phase 3 の goal
- SOP v2 §SOP 3 の T00-01 〜 T00-06 を **副作用 0 mock** で発火 (本 rehearsal は実 promote 禁止)
- Owner GO 遅延 escalation tree (case E) を mock walk-through

### step 3-1: T00-01 CEO GO 受領 Slack 明示 (dry)

- **担当**: CEO
- **所要**: 1 min
- **SOP**: §SOP 3 T00-01
- **コマンド**:
  ```bash
  curl -s -X POST "$SLACK_WEBHOOK_DRY" \
    -d '{"text":"[D-7 rehearsal] T-0 CEO GO received 09:00:00 JST (mock)"}'
  ```
- **期待 output**: HTTP 200 + 秒精度 timestamp 記録
- **FAIL 時**: Case C escalation
- **Owner 拘束**: 0 min (本 rehearsal は CEO 単独で mock 発声 / Owner 待機不要)

### step 3-2: T00-02 vercel promote --dry-run

- **担当**: Web-Ops
- **所要**: 2 min
- **SOP**: §SOP 3 T00-02
- **コマンド**:
  ```bash
  vercel promote "$PREVIEW_URL" --dry-run --scope "$VERCEL_TEAM" 2>&1 | head -20
  ```
- **期待 output**: `[dry-run] would promote ___ to production` + exit 0
- **FAIL 時**: 60 sec 内応答無 → Case A (rollback) escalation tree (本 rehearsal は実 rollback 禁止 / 経路 trace のみ)
- **Owner 拘束**: 0 min

### step 3-3: T00-03a dig company-website A

- **担当**: Web-Ops
- **所要**: 1 min
- **SOP**: §SOP 3 T00-03
- **コマンド**:
  ```bash
  dig +short company-website.example A
  ```
- **期待 output**: 本番 IP (D-7 では DNS 未切替の可能性 → SKIP 許容)
- **FAIL 時**: NXDOMAIN は D-7 では想定内 → SKIP 記入 (本番 D-1 17:00 JST で初切替)
- **Owner 拘束**: 0 min

### step 3-4: T00-03b dig +short A @8.8.8.8

- **担当**: Web-Ops
- **所要**: 1 min
- **SOP**: §SOP 3 T00-03
- **コマンド**:
  ```bash
  dig +short company-website.example A @8.8.8.8
  ```
- **期待 output**: step 3-3 と同 IP (本番 DNS 切替後)
- **FAIL 時**: step 3-3 と同様 SKIP
- **Owner 拘束**: 0 min

### step 3-5: T00-03c CDN purge dry

- **担当**: Web-Ops
- **所要**: 1 min
- **SOP**: §SOP 3 T00-03
- **コマンド**:
  ```bash
  curl -s -X POST "https://${CDN_HOST}/purge?dry=1" -o /dev/null -w "%{http_code}"
  ```
- **期待 output**: `200` (dry flag 経由)
- **FAIL 時**: 4xx/5xx → CDN_HOST env 確認 → CARD pre-condition 再確認
- **Owner 拘束**: 0 min

### step 3-6: T00-04 monitoring 3 URL 健在性

- **担当**: Web-Ops
- **所要**: 2 min
- **SOP**: §SOP 3 T00-04
- **コマンド**:
  ```bash
  for url in "$VERCEL_ANALYTICS_URL" "$SENTRY_PROJECT_URL" "$GA_REALTIME_URL"; do
    curl -s -o /dev/null -w "%{http_code} $url\n" -I "$url"
  done
  ```
- **期待 output**: 3 URL 全 200/302
- **FAIL 時**: 1 URL 以上 4xx/5xx → 該当 URL 担当部門 (Dev) に escalate (5 min)
- **Owner 拘束**: 0 min

### step 3-7: T00-05 T-0 完了 reply (dry)

- **担当**: Web-Ops
- **所要**: 1 min
- **SOP**: §SOP 3 T00-05
- **コマンド**:
  ```bash
  curl -s -X POST "$SLACK_WEBHOOK_DRY" \
    -d '{"text":"[D-7 rehearsal] T-0 done, T+1h smoke standby (mock)"}'
  ```
- **期待 output**: HTTP 200
- **FAIL 時**: Case C
- **Owner 拘束**: 0 min

### step 3-8: T00-06a/b/c DNS 3 経路一致確認

- **担当**: Web-Ops
- **所要**: 3 min (3 経路)
- **SOP**: §SOP 3 T00-06
- **コマンド**:
  ```bash
  dig +short company-website.example A @1.1.1.1   # Tokyo proxy
  dig +short company-website.example A @8.8.8.8   # Osaka proxy
  dig +short company-website.example A @9.9.9.9   # Sapporo proxy
  ```
- **期待 output**: 3 経路で同一 A record (本番 DNS 切替後)
- **FAIL 時**: 経路間で異なる IP → DNS 伝播待ち (5 min) → 再確認
- **Owner 拘束**: 0 min

### step 3-9: Owner GO 遅延 escalation tree mock walk-through (case E)

- **担当**: CEO
- **所要**: 2 min
- **SOP**: §SOP 3 v2 新設 (case E)
- **コマンド** (mock):
  ```
  # T-0 09:00:00 JST 想定で Owner GO 不発を simulate
  # CEO が以下の判断 tree を Slack に post (mock)
  ```
  ```bash
  curl -s -X POST "$SLACK_WEBHOOK_DRY" \
    -d '{"text":"[D-7 rehearsal mock] [OWNER DELAY] elapsed=15min owner_status=unreachable decision=CEO_PROXY_GO by=CEO at=09:15:00 JST"}'
  ```
- **期待 output**: CEO_PROXY_GO mock post + 4 部門責任者 CC 確認
- **FAIL 時**: escalation tree が SOP に未記載または曖昧 → Round 22 で SOP v3 改版起票
- **Owner 拘束**: 0 min (Owner 不在を simulate するため)

### step 3-10: Phase 3 完了 Slack post

- **担当**: Web-Ops
- **所要**: 1 min
- **SOP**: -
- **コマンド**:
  ```bash
  curl -s -X POST "$SLACK_WEBHOOK_DRY" \
    -d '{"text":"[D-7 rehearsal] Phase 3 (T-0 mock) PASS ___/10"}'
  ```
- **期待 output**: HTTP 200
- **FAIL 時**: PASS < 8 → Phase 4 開始 hold → CEO 判断
- **Owner 拘束**: 0 min

### Phase 3 集計
- 完了基準: PASS 8/10 + DNS step 3-3/3-4/3-8 は SKIP 許容 (本番 DNS 切替前)
- 副作用 0 担保: 全 step が `--dry-run` flag または mock post

---

## §4 Phase 4: T+1h post-launch verification (実 env / 30 min / 6 step / 11:00-11:30 JST)

### Phase 4 の goal
- SOP v2 §SOP 4 の TP1-01 〜 TP1-06 を **実 env** で発火 (read-only)
- 公開後の 5xx 0 件 + smoke 8 endpoint 全 200 を確認

### step 4-1: TP1-01 Lighthouse postlaunch 実測

- **担当**: Web-Ops
- **所要**: 5 min
- **SOP**: §SOP 4 TP1-01
- **コマンド**: step 2-1 と同じ (TARGET_URL 切替: dry-run = preview)
- **期待 output**: 4 score >= 90
- **FAIL 時**: Case D escalation (1 項目 < 90 → 軽微なら hotfix / 重度なら rollback)
- **Owner 拘束**: 0 min

### step 4-2: TP1-02 Sentry stats 1h fixed window

- **担当**: Dev
- **所要**: 3 min
- **SOP**: §SOP 4 TP1-02 (v2 改 / fixed window)
- **コマンド**:
  ```bash
  curl -s -H "Authorization: Bearer $SENTRY_TOKEN" \
    "https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJ}/stats/?stat=received&resolution=1h&since=${LAUNCH_TIMESTAMP}" \
    | head -c 500
  ```
- **期待 output**: 5xx 0 件 / 4xx < 10 件
- **FAIL 時**: 5xx > 50 件/min → Case A (rollback) escalation
- **Owner 拘束**: 0 min

### step 4-3: TP1-03 GA realtime activeUsers

- **担当**: Dev
- **所要**: 3 min
- **SOP**: §SOP 4 TP1-03 (v2 改 / token refresh)
- **コマンド**:
  ```bash
  GA_TOKEN=$(gcloud auth print-access-token)  # 60min 経過時 refresh
  curl -s -H "Authorization: Bearer $GA_TOKEN" \
    "https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROP}:runRealtimeReport" \
    -d '{"metrics":[{"name":"activeUsers"}]}' | head -c 500
  ```
- **期待 output**: activeUsers > 0
- **FAIL 時**: 401 → token refresh 再実行 / 500 → GA 障害は KPI 欠測 (rollback 不要)
- **Owner 拘束**: 0 min

### step 4-4: TP1-04 smoke 8 endpoint 再 (TARGET_URL)

- **担当**: Web-Ops
- **所要**: 5 min
- **SOP**: §SOP 4 TP1-04 (yml 駆動)
- **コマンド**: step 2-7 と同じ (TARGET_URL 切替)
- **期待 output**: 8 endpoint 全 200
- **FAIL 時**: Case D escalation (T+1h 版)
- **Owner 拘束**: 0 min

### step 4-5: TP1-05 psql pageview_event 1h top5

- **担当**: Dev
- **所要**: 3 min
- **SOP**: §SOP 4 TP1-05 (read-only)
- **コマンド**:
  ```bash
  psql "$SUPABASE_READONLY_URL" -c \
    "select event, count(*) from analytics.pageview_event where created_at > now() - interval '1 hour' group by 1 order by 2 desc limit 5;"
  ```
- **期待 output**: top5 events (`pageview_home`, `pageview_portfolio`, etc) + counts
- **FAIL 時**: connection error → SUPABASE_READONLY_URL env 確認 → CARD D 再確認
- **Owner 拘束**: 0 min

### step 4-6: TP1-06 完了報告 Slack (dry)

- **担当**: Web-Ops
- **所要**: 1 min
- **SOP**: §SOP 4 TP1-06
- **コマンド**:
  ```bash
  curl -s -X POST "$SLACK_WEBHOOK_DRY" \
    -d '{"text":"[D-7 rehearsal] T+1h D-1..D-4 PASS (mock)"}'
  ```
- **期待 output**: HTTP 200
- **FAIL 時**: Case C
- **Owner 拘束**: 0 min

### Phase 4 集計
- 完了基準: PASS 6/6
- 5xx 0 件 + smoke 8/8 + Lighthouse 4 score >= 90 が必須

---

## §5 Phase 5: T+24h KPI snapshot (実 env read-only / 15 min / 5 step / 11:30-11:45 JST)

### Phase 5 の goal
- SOP v2 §SOP 5 の T24P-01 〜 T24P-05 を **実 env read-only** で発火
- KPI 4 指標 (impression / click / signup / bounce) 取得確認

### step 5-1: T24P-01 GA screenPageViews 24h (timezone JST)

- **担当**: Dev
- **所要**: 3 min
- **SOP**: §SOP 5 T24P-01 (v2 改)
- **コマンド**:
  ```bash
  curl -s -H "Authorization: Bearer $GA_TOKEN" \
    "https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROP}:runReport" \
    -d '{"dateRanges":[{"startDate":"yesterday","endDate":"today"}],"metrics":[{"name":"screenPageViews"}],"timeZone":"Asia/Tokyo"}' \
    | head -c 500
  ```
- **期待 output**: screenPageViews > 0
- **FAIL 時**: 401 → token refresh / 500 → GA 障害
- **Owner 拘束**: 0 min

### step 5-2: T24P-02 GA event count CTA (3 event 固定)

- **担当**: Dev
- **所要**: 3 min
- **SOP**: §SOP 5 T24P-02 (v2 改 / event taxonomy)
- **コマンド**:
  ```bash
  curl -s -H "Authorization: Bearer $GA_TOKEN" \
    "https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROP}:runReport" \
    -d '{"dimensions":[{"name":"eventName"}],"metrics":[{"name":"eventCount"}],"dimensionFilter":{"filter":{"fieldName":"eventName","inListFilter":{"values":["contact_submit","portfolio_view","case_study_open"]}}},"timeZone":"Asia/Tokyo"}' \
    | head -c 500
  ```
- **期待 output**: 3 event 件数取得
- **FAIL 時**: 401 → token refresh
- **Owner 拘束**: 0 min

### step 5-3: T24P-03 psql contact_request count

- **担当**: Dev
- **所要**: 2 min
- **SOP**: §SOP 5 T24P-03 (v2 改 / LAUNCH_DATE_JST env)
- **コマンド**:
  ```bash
  psql "$SUPABASE_READONLY_URL" -c \
    "select count(*) from public.contact_request where created_at > '${LAUNCH_DATE_JST} 09:00 JST';"
  ```
- **期待 output**: 数値 (D-7 rehearsal では 0 想定で OK)
- **FAIL 時**: env 未設定 → CARD G 再確認
- **Owner 拘束**: 0 min

### step 5-4: T24P-04 GA bounceRate

- **担当**: Dev
- **所要**: 3 min
- **SOP**: §SOP 5 T24P-04 (v2 改)
- **コマンド**:
  ```bash
  curl -s -H "Authorization: Bearer $GA_TOKEN" \
    "https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROP}:runReport" \
    -d '{"metrics":[{"name":"bounceRate"}],"timeZone":"Asia/Tokyo"}' \
    | head -c 500
  ```
- **期待 output**: bounceRate 取得 (業界 benchmark 50-60%)
- **FAIL 時**: 401 → token refresh
- **Owner 拘束**: 0 min

### step 5-5: T24P-05 path 動的算出

- **担当**: Web-Ops
- **所要**: 2 min
- **SOP**: §SOP 5 T24P-05 (v2 改)
- **コマンド**:
  ```bash
  KPI_DATE=$(date -d "${LAUNCH_DATE_JST} + 1 day" +%Y-%m-%d 2>/dev/null || gdate -d "${LAUNCH_DATE_JST} + 1 day" +%Y-%m-%d)
  test -f "dashboard/launch-kpi-${KPI_DATE}.md" || echo "T24P-05 path reserved: dashboard/launch-kpi-${KPI_DATE}.md"
  ```
- **期待 output**: path reserved (D-7 では 6/20 path / 本番では 6/20 path)
- **FAIL 時**: date コマンド OS 違い → gdate 経由を確認
- **Owner 拘束**: 0 min

### Phase 5 集計
- 完了基準: PASS 5/5
- KPI 4 指標値確定 (impression/click/signup/bounce 取得)

---

## §6 Phase 6: 異常系演習 5 case (15 min / 5 step / 11:45-12:00 JST)

### Phase 6 の goal
- anomaly-cases.md §Case A-E の 5 case を **walk-through** (副作用 0)
- D-7 本 rehearsal では D / E は staging 演習、A / B / C は SOP review のみ (副作用大のため)

### step 6-1: Case A rollback trigger walk-through

- **担当**: Web-Ops + CEO
- **所要**: 3 min
- **SOP**: anomaly-cases §Case A
- **mock 内容**:
  - Sentry 5xx > 50/min を simulate (mock 想定値)
  - Web-Ops が `[ROLLBACK CALL] reason=5xx100/min decision=GO by=Web-Ops at=11:45:00 JST` を Slack mock post
  - CEO が `@channel` で GO 発声 (mock)
  - rollback 手順 (Vercel promote / CDN purge / smoke 再) を **trace のみ** (実 promote 禁止)
- **期待 output**: 検知 → 3 min 以内 rollback 開始 経路 trace OK
- **FAIL 時**: escalation tree が SOP に未記載 → Round 22 で v3 改版
- **Owner 拘束**: 0 min (mock では Owner email は post せず)

### step 6-2: Case B cron fallback 切替 walk-through

- **担当**: Web-Ops
- **所要**: 3 min
- **SOP**: anomaly-cases §Case B
- **mock 内容**:
  - heartbeat 500k 超過を simulate
  - Web-Ops が `[CRON FALLBACK] reason=heartbeat550k decision=GO by=Web-Ops at=11:48:00 JST` を Slack mock post
  - cron pause + fallback enable を **trace のみ** (実 cron 操作禁止)
- **期待 output**: 検知 → 10 min 以内 切替完了 経路 trace OK
- **FAIL 時**: SOP review 結果を Round 22 引継
- **Owner 拘束**: 0 min

### step 6-3: Case C Slack alert 不達 walk-through

- **担当**: Web-Ops + Marketing
- **所要**: 3 min
- **SOP**: anomaly-cases §Case C
- **mock 内容**:
  - Slack heartbeat 不達を simulate
  - Web-Ops が email broadcast template を準備 (subject `[PRJ-019 SLACK OUTAGE]`) (mock 送信せず)
  - 4 部門 + Owner + CEO の email 経路を **trace のみ** (実 send 禁止)
- **期待 output**: 検知 → 15 min 以内 email 経路確立 trace OK
- **FAIL 時**: webhook backup URL 未準備 → Round 22 で Dev に二重化依頼
- **Owner 拘束**: 0 min (mock では email 送信せず)

### step 6-4: Case D smoke FAIL staging 演習

- **担当**: Web-Ops + CEO
- **所要**: 3 min
- **SOP**: anomaly-cases §Case D
- **staging 演習内容** (副作用 0 staging で実演):
  - staging で smoke `/en/case-studies` を 404 に意図的に変更 (preview branch のみ)
  - T02-06 smoke loop で FAIL 検知 → Web-Ops が CEO mention
  - CEO が `[SMOKE FAIL] failing=/en/case-studies count=1 decision=GO_PARTIAL by=CEO at=11:54:00 JST` を Slack mock post
  - en 一時非公開で GO 維持判断の trace
- **期待 output**: 検知 → 6 min 以内 判断確定 + GO_PARTIAL/NoGO/GO_FULL 3 経路 walk-through
- **FAIL 時**: SOP review で perceived gap を Round 22 引継
- **Owner 拘束**: 0 min (mock では NoGO email を Owner に送らず)

### step 6-5: Case E Owner GO 遅延 staging 演習

- **担当**: CEO
- **所要**: 3 min
- **SOP**: anomaly-cases §Case E
- **staging 演習内容**:
  - Owner GO 不発 15 min 経過を simulate
  - T+5min CEO → Owner DM (mock)
  - T+10min CEO → `#prj-019-launch` 進捗共有 (mock)
  - T+15min CEO → `[OWNER DELAY] elapsed=15min owner_status=unreachable decision=CEO_PROXY_GO by=CEO at=11:57:00 JST` (mock)
  - CARD H backup contact 経路 (家族 or 同僚) trace
- **期待 output**: T-0 → 15 min 以内 CEO 代行 GO 経路 trace OK
- **FAIL 時**: backup contact CARD H 未消化 → Owner に共有依頼 (5 min)
- **Owner 拘束**: 0 min (mock では Owner 不在を simulate)

### Phase 6 集計
- 完了基準: PASS 5/5 (5 case walk-through 完了)
- A/B/C は trace のみ (副作用大) / D/E は staging 演習可 (副作用 0)

---

## §7 完了基準 (D-7 全体)

### PASS 38/40 集計

| Phase | step 数 | PASS 必須 | SKIP 許容 | FAIL 許容 |
|---|---|---|---|---|
| Phase 1 | 9 | 9 | 0 | 0 |
| Phase 2 | 9 | 9 | 0 | 0 |
| Phase 3 | 10 | 7 | 3 (DNS 3 経路) | 0 |
| Phase 4 | 6 | 6 | 0 | 0 |
| Phase 5 | 5 | 5 | 0 | 0 |
| Phase 6 | 5 | 5 (walk-through) | 0 | 0 |
| **合計** | **44** | **41** | **3** | **0** |

- 注: §0.1 では「PASS 38/40」と Round 20 §8.3 baseline で記述。本書では Phase 構成 6 に拡張し step 総数 44。完了基準は **PASS 41/44 (= PASS 38 = 公開可、 + DNS 3 SKIP 許容、 + 異常 Phase 6 = 5 walk-through)** を維持
- 4 部門 OK reply: web-ops / marketing / dev / review 全件
- 6/19 公開 confidence: 80% 以上 (現 76% から +4pt 以上)
- CEO + Owner 承認 sign 取得

### 4 部門 OK reply 受領基準
- T02-08 で 4 部門が Slack `OK [部門名]: T-2h checklist 全 PASS` を post
- Phase 2 末尾 (step 2-9) で 4 件全件確認

### confidence 80%+ 算出 (詳細は launch-confidence-evaluation-spec.md)
- 現 76% (Round 20 完遂時 +1pt)
- D-7 PASS 41/44 達成 +5pt → 81%
- 加点要素 (OG image 8 case 全 PASS / 異常系 5 case 充足) でさらに +5pt 可能性
- 80% 確定条件は別書で詳述

---

## §8 不合格時 fallback

### D-7 不合格判定基準
- PASS < 38/44 (FAIL > 3 件 OR SKIP > 5 件)
- 4 部門 OK reply 不全 (1 部門以上欠落)
- confidence 76% から横ばい or 低下

### D-3 (6/16) 再 rehearsal
- D-7 不合格時 D-3 09:00-11:00 JST 2 時間枠で再実施
- 焦点: D-7 で FAIL/SKIP した step のみ集中再実行
- D-7 PASS 38 件は再確認不要 (状態維持)
- 4 部門 + Owner 同期取得は再実施

### 6/27 fallback 切替
- D-3 でも PASS < 38/44 → 6/27 fallback (確度 92%) に切替判断
- 切替判断 SLA: D-3 23:59 JST までに最終決定 (Owner + CEO)
- 切替手順: SOP v2 の `LAUNCH_DATE_JST` env を `2026-06-27` に書換のみ (本書再起票不要)

### Round 22 引継 task
- D-3 再 rehearsal が必要な場合 Round 22 Marketing-P で詳細手順書起票
- 6/19 公開当日手順書 finalize (本書を本番 procedure に複製 + dry flag 削除)

---

## §9 副作用 0 担保 (D-7 本 rehearsal 実施後チェック)

- [ ] 全 vercel コマンドが `--dry-run` 付与または mock skip
- [ ] 全 Slack post が dry channel `#launch-dry-2026-06-19` 経由
- [ ] Supabase 接続 read-only role
- [ ] DB write 0 / cron merge 0 / DNS 変更 0 (本番 DNS は D-1 で別途)
- [ ] 絵文字 0 / Heroicons 以外参照 0
- [ ] API $ コスト 0 (Lighthouse / Slack / Sentry / GA すべて既存契約 free tier 内)
- [ ] vercel promote 本番化 0 (Phase 3 は完全 mock)
- [ ] 異常系 A/B/C は trace のみ / D/E は staging 限定
- [ ] Round 19 v1 SOP / Round 20 v2 SOP / anomaly-cases 無改変

---

## §10 関連 DEC / KPI / Round 22 引継

- DEC-019-025: background dispatch SOP 順守 18 件目 (本書 + pre-rehearsal validation + log template + confidence + 報告書 5 件まとめて 1 件カウント)
- DEC-019-033: knowledge 抽出経路 (本書を `organization/knowledge/patterns/d7-rehearsal-procedure.md` 候補化)
- DEC-019-054: portfolio v3.0 公開判断 (本書 §1.5 で v3.1 hash check)
- DEC-019-062: cron 5 本 + CRON_SECRET (本書 §2.3 で CRON_PROD_PR approval 確認)
- DEC-018-047: PRJ-018 hotfix rollback ベストプラクティス継承 (Phase 6 step 6-1)

KPI 連動:
- 17 日 path 完成度: 本書で D-7 procedure 物理化 → +1 path
- DEC trajectory: DEC-019-069 (Round 20 候補) → DEC-019-070 候補 (D-7 procedure 採決) として CEO 提案
- 11-HITL: 本書は HITL 第 9 種 `dev_kickoff_approval` 対象外 (運用 SOP 詳細手順)

Round 22 引継 (Marketing-P 想定):
1. D-3 再 rehearsal 詳細手順書起票 (D-7 結果による)
2. 6/19 公開当日手順書 finalize (本書を本番 procedure に複製)
3. social X thread / LinkedIn 素材最終化 (T02-04 PASS 維持)
4. KPI 7/20 30 day review baseline 投入準備

---

**最終更新**: 2026-05-05 (Round 21 第 2 波 / Marketing-O / D-7 詳細手順書起票)
**派生元**: Round 19 v1 SOP / Round 20 v2 SOP / Round 20 anomaly-cases / Round 20 rehearsal-report §8.2
**次回見直し**: 2026-06-12 (D-7 本 rehearsal 当日) → 6/16 D-3 再 rehearsal (必要時) → 6/19 (公開当日 lock)
