# 6/19 公開 Confidence 評価指標 (Evaluation Spec)

## 0. 目的

- **対象**: PRJ-019 / COMPANY-WEBSITE 6/19 公開の **confidence 数値化** ルール
- **本書 role**: 現在 76% → 80%+ への path を再現可能な算出ルールで定義し、D-7 / D-3 / D-1 の各 milestone で confidence 自動評価を可能にする
- **派生元**: Round 20 Marketing-N `launch-dry-run-rehearsal-report-2026-05-26.md` §8.3 (confidence 80% 以上 / +5pt 以上 baseline) / Round 21 Marketing-O detailed-procedure / pre-rehearsal-validation
- **副作用 0 / 絵文字 0 / API 追加コスト $0 / Heroicons 参照のみ**
- **算出主体**: Marketing 部門 (本書策定) + CEO 承認 (採決) + Web-Ops 記入 (D-7/D-3/D-1 実測)
- **関連 DEC**: DEC-019-025 (background dispatch SOP 18 件目) / DEC-019-033 (knowledge 抽出経路)

---

## §1 加点要素

confidence baseline 76% に対して以下 5 要素で加点。最大 +14pt 加点可能。

### 1.1 D-7 PASS 38/40 達成 (+5pt)

- **指標**: D-7 本 rehearsal log template §7.1 PASS 集計
- **算出ルール**:
  - PASS >= 41/44 (= "PASS 38/40 + DNS 3 SKIP 許容") → **+5pt**
  - PASS = 38-40/44 → +3pt
  - PASS = 35-37/44 → +1pt
  - PASS < 35/44 → 0pt (D-3 再 rehearsal trigger)
- **記入元**: `launch-dry-run-rehearsal-log-template-2026-06-12.md` §7.1 PASS 集計表

### 1.2 OG image 8 case 全 PASS (+3pt)

- **指標**: D-8 pre-rehearsal validation §7 OG image 4 variant × 2 locale = 8 case 全 200
- **算出ルール**:
  - 8/8 case PASS → **+3pt**
  - 7/8 case PASS → +1pt
  - 6/8 case PASS → 0pt
  - 6/8 未満 → -3pt (減点要素 §2.2 参照)
- **記入元**: `launch-dry-run-pre-rehearsal-validation-checklist-2026-06-11.md` §7 OG image table
- **追加チェック**: content-type / size 1200x630 / locale 別テキスト整合 (3 sub-criteria) も加点判定に含める (3/3 sub PASS で +3pt 確定)

### 1.3 異常系 5 case 充足 90%+ (+2pt)

- **指標**: D-7 本 rehearsal Phase 6 異常系演習 5 case (A/B/C/D/E) の walk-through 完了度
- **算出ルール**:
  - 5/5 case 完遂 + D/E staging 演習成功 → **+2pt** (充足度 100%)
  - 5/5 case 完遂 (A/B/C trace + D/E mock) → +1pt (充足度 90%)
  - 4/5 case 完遂 → 0pt (充足度 80%)
  - 3/5 以下 → -3pt (減点 §2.3)
- **記入元**: `launch-dry-run-rehearsal-log-template-2026-06-12.md` §6 + §7.4

### 1.4 4 部門 OK reply 全件取得 (+2pt)

- **指標**: T02-08 で 4 部門責任者 reply 受領
- **算出ルール**:
  - 4/4 部門 reply (web-ops/marketing/dev/review) → **+2pt**
  - 3/4 部門 → +1pt
  - 2/4 以下 → 0pt
- **記入元**: log template §7.2

### 1.5 Lighthouse 4 score >= 95 (+2pt)

- **指標**: D-7 Phase 2 step 2-1 + Phase 4 step 4-1 で Lighthouse 4 score (perf/a11y/best-practices/seo) 全項目 >= 95
- **算出ルール**:
  - desktop + mobile 両方で 4 score >= 95 → **+2pt**
  - desktop のみ >= 95 (mobile 90-94) → +1pt
  - 4 score 90-94 で全項目 PASS → 0pt
- **記入元**: log template §2 / §4

---

## §2 減点要素

baseline 76% から以下 5 要素で減点。最大 -16pt 減点可能。

### 2.1 D-7 FAIL 5 件以上 (-5pt)

- **指標**: D-7 本 rehearsal log template §7.1 FAIL 集計
- **算出ルール**:
  - FAIL >= 5/44 → **-5pt**
  - FAIL 3-4/44 → -3pt
  - FAIL 1-2/44 → -1pt
  - FAIL 0/44 → 0pt
- **記入元**: log template §7.1

### 2.2 OG image 1 case 以上 FAIL (-3pt)

- **指標**: D-8 §7 OG image 8 case で 1 case 以上 200 以外
- **算出ルール**:
  - 6/8 未満 → **-3pt**
  - 6-7/8 PASS → -1pt
  - 8/8 PASS → 0pt (加点要素 §1.2 参照)
- **記入元**: pre-rehearsal §7

### 2.3 異常系充足 70% 未満 (-3pt)

- **指標**: Phase 6 異常系 5 case のうち walk-through 完了が 3/5 以下
- **算出ルール**:
  - 3/5 以下 → **-3pt**
  - 4/5 → -1pt
  - 5/5 → 0pt (加点 §1.3 参照)
- **記入元**: log template §6 + §7.4

### 2.4 4 部門 OK reply 不全 (-2pt)

- **指標**: T02-08 で 1 部門以上 reply 不在
- **算出ルール**:
  - 2/4 以下 → **-2pt**
  - 3/4 → -1pt
  - 4/4 → 0pt (加点 §1.4 参照)
- **記入元**: log template §7.2

### 2.5 Owner 拘束時間 5 min 超過 (-2pt)

- **指標**: D-7 当日 Owner 拘束時間が推奨 1 min を大幅超過
- **算出ルール**:
  - Owner 拘束 > 5 min → **-2pt**
  - 2-5 min → -1pt
  - 0-1 min → 0pt
- **記入元**: log template §7.5

### 2.6 重大 case 単独 FAIL (-3pt, 別枠)

- **指標**: 以下のいずれか 1 件で即時 -3pt:
  - Lighthouse 1 score < 90 (Case D NoGO 兆候)
  - Sentry 5xx > 50/min 検知 (Case A trigger)
  - cron heartbeat > 500k (Case B trigger)
  - Slack alert 10 min 不達 (Case C trigger)
- **算出ルール**: 1 件発生で **-3pt** (重複しない)

---

## §3 80% 確定条件

### 3.1 数式

```
confidence_d7 = 76 (Round 20 baseline)
              + (§1.1 D-7 PASS 加点)
              + (§1.2 OG 加点)
              + (§1.3 異常系加点)
              + (§1.4 4 部門 reply 加点)
              + (§1.5 Lighthouse 加点)
              - (§2.1 D-7 FAIL 減点)
              - (§2.2 OG 減点)
              - (§2.3 異常系減点)
              - (§2.4 4 部門 reply 減点)
              - (§2.5 Owner 拘束減点)
              - (§2.6 重大 case 減点)
```

### 3.2 80% 確定の典型 path

**Path A (D-7 完璧 path)**: 76 + 5 (D-7 PASS) + 3 (OG) + 2 (異常系) = **86%** → 80%+ 確定

**Path B (D-7 良好 path)**: 76 + 5 (D-7 PASS) + 1 (OG 7/8) + 1 (異常系 90%) = **83%** → 80%+ 確定

**Path C (D-7 標準 path)**: 76 + 3 (D-7 PASS 38/44) + 3 (OG) + 1 (異常系 90%) = **83%** → 80%+ 確定

**Path D (D-7 ボーダー path)**: 76 + 3 (D-7 PASS 38/44) + 1 (OG 7/8) + 1 (異常系) + 1 (Lighthouse 95+) = **82%** → 80%+ 確定

### 3.3 80% 未達 path (D-3 再 rehearsal trigger)

- 76 + 1 (D-7 PASS 35-37/44) + 0 (OG 6/8) + 0 (異常系) = 77% → D-3 再 rehearsal 必要
- 76 + 0 (D-7 PASS < 35) - 5 (D-7 FAIL >= 5) = 71% → 6/27 fallback 切替判断 trigger

### 3.4 公開最終判断 SLA
- **D-7 (6/12) EOD**: confidence >= 80% → 6/19 公開維持
- **D-7 EOD**: 80% > confidence >= 75% → D-3 (6/16) 再 rehearsal で再評価
- **D-3 EOD**: confidence < 75% → 6/27 fallback (確度 92%) 切替判断 (Owner + CEO 23:59 JST まで決定)
- **D-1 (6/18)**: 最終 confidence 確定 → Owner GO/NoGO 通達

---

## §4 6/27 fallback 切替 trigger

### 4.1 切替条件

以下いずれか 1 件以上で 6/27 fallback (確度 92%) 切替判断 trigger:

- D-7 PASS < 35/44 (かつ D-3 再 rehearsal でも改善なし)
- D-3 confidence < 75%
- D-7 + D-3 で重大 case (§2.6) が複数発生 (累積 -6pt 以上)
- 4 部門責任者 1 名以上が D-19 までに病欠 / 不在
- Sentry / GA / Slack の 1 つ以上で 24h 障害発生 (D-7 直前 1 週間以内)

### 4.2 切替判断者

- **一次判断**: CEO (D-3 23:59 JST まで)
- **最終承認**: Owner (CEO 提案後 D-3 EOD 1h 以内 reply)
- **判断後手順**: SOP v2 §Pre-condition CARD G の `LAUNCH_DATE_JST=2026-06-19` を `2026-06-27` に書換のみ (本書 + 関連手順書再起票不要)

### 4.3 切替時の confidence 想定
- 6/19: 確度 76% (Round 20 完遂時)
- 6/27 fallback: 確度 92% (Round 19 baseline)
- 切替判断による net 確度向上: +16pt

### 4.4 切替後の rehearsal 再実施
- 6/27 切替時、D-7 (6/20) 再 rehearsal は不要 (本書の D-7 結果を 6/27 baseline として継承)
- D-3 (6/24) のみ追加 light rehearsal を実施 (CARD A-H 再確認 + smoke 8 endpoint 確認 / 1h 枠)

---

## §5 副作用 0 担保 (本書策定後チェック)

- [x] 本書は数式・ルール定義のみ / 実 rehearsal 実行 0
- [x] 本書記入時に外部 API 呼び出し 0 / Slack post 0 / curl 0
- [x] 副作用 0 / 絵文字 0 / Heroicons 以外参照 0
- [x] API $ コスト 0
- [x] Round 20 v2 SOP / anomaly-cases / Round 21 detailed-procedure / pre-rehearsal-validation / log template 無改変

---

## §6 関連 DEC / KPI / Round 22 引継

- DEC-019-025: background dispatch SOP 18 件目 (本書 + 4 ファイル + 報告書まとめて 1 件カウント)
- DEC-019-033: knowledge 抽出経路 (本書を `organization/knowledge/decisions/launch-confidence-spec.md` 候補化)
- DEC-019-068 (Round 19) → DEC-019-070 候補 (本書 + D-7 procedure 採決)

KPI 連動:
- 17 日 path 完成度: 本書で confidence 評価指標物理化 → +1 path
- DEC trajectory: 本書策定 = +1 件議決候補
- 11-HITL: 本書は HITL 第 9 種 `dev_kickoff_approval` 対象外 (運用判断 spec)

Round 22 引継 (Marketing-P 想定):
1. D-7 結果による confidence 実測値の本書反映 (新 path E/F 例追記)
2. 6/19 公開当日 confidence 評価 (D-1 final → 公開後 T+1h / T+24h で再評価)
3. 6/27 fallback 切替時の本書再評価 (LAUNCH_DATE_JST 書換のみで継承)

---

**最終更新**: 2026-05-05 (Round 21 第 2 波 / Marketing-O / confidence 評価指標起票)
**派生元**: Round 20 Marketing-N rehearsal-report §8.3 / Round 21 detailed-procedure §7 / pre-rehearsal §9 / log template §7
**次回見直し**: 2026-06-12 (D-7 結果反映) → 6/16 (D-3 結果反映) → 6/18 (D-1 final) → 6/19 (公開当日)
