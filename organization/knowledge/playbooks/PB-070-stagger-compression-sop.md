---
id: PB-070
type: playbook
title: "Stagger Compression SOP 連続適用 Playbook (90s→45s 圧縮 + thundering herd 回避)"
source_prj: PRJ-019
source_decisions: [DEC-019-062, DEC-019-065, DEC-019-066, DEC-019-067]
source_round: [15, 16, 17, 18]
tags: [playbook, stagger, compression, sop, continuous-application, parallel-dispatch, heartbeat-jitter, thundering-herd]
applicable_to: [parallel-multi-agent-dispatch, ai-org-9-parallel, dispatch-cadence-tuning]
maturity: piloted
confidence: 0.85
last_validated: 2026-05-05
hitl_pii_reviewed: false
hitl_pii_reviewer: null
hitl_pii_review_date: null
sec_k_hardening_applied: true
sec_l_automation_applied: true
related: [PAT-061, PAT-064, DEC-066, PB-069]
created: 2026-05-05
pii-redacted: true
---

# Stagger Compression SOP 連続適用 Playbook

## 適用領域 (When to use)

9 並列 (もしくは 6-10 並列) Agent dispatch を「累積で複数 Round 連続適用」する際に、stagger 起動間隔を 90 秒 → 45 秒 に圧縮しても thundering herd を発生させずに dispatch スループットを 2x 化したいとき。Round 15 で確立した DEC-019-062 SOP を Round 16 / 17 / 18 と 4 round 連続適用し、累積 n=36 まで実機検証した結果を formal 化したもの。Round 18 完遂時点で SOP 適合率 80%+ trigger (DEC-019-068 T-1) を満たすか否かが昇格判断の中心軸。

## 前提条件 (Preconditions)

1. heartbeat 系プリミティブが mulberry32 等の決定論 PRNG + jitter='full' で uniform 分布になっている (PAT-061 接続)
2. 並列 Agent が個別 audit isolation + I/O port 注入で副作用 0 設計になっている (PAT-063 接続)
3. dispatch cadence の計測点 (start_at / first_response_at / completed_at) が timestamp として記録される
4. baseline test 件数の drift が wave 跨ぎでも検出可能 (PIT-068 防止)

## 7 ステップ手順 (Procedure)

### Step 1. baseline stagger interval の宣言
- pre-compression baseline = 90 秒 (DEC-019-058 既定値)
- compression target = 45 秒 (DEC-019-062 採択値)
- 圧縮率 50% を Round 計画書に明示記載

### Step 2. heartbeat jitter mode の確認
- 全 Agent dispatch が retry に jitter='full' を使用していること
- 1024 bin histogram で max bin < 2× mean (thundering herd 否定統計、Dev-Z R18 100k 検証)
- 空 bin <5% を uniform spread の最低条件として gate

### Step 3. 9 並列 wave 設計
- 第 1 波: 5 Agent / 第 2 波: 4 Agent (9 並列を 2 wave に分割)
- 第 1 波内の stagger は 45 秒固定、第 1 波→第 2 波の wave 間 gap は 5-10 分 (Round の長さに応じ調整)
- wave 跨ぎでの baseline drift を Round 完遂後に必ず再計測 (PIT-068 防止)

### Step 4. dispatch 実行 + telemetry 記録
- 各 Agent の start_at / first_response_at / completed_at を記録
- start_at の inter-arrival time が 45±5 秒範囲に収まることを 9 件すべてで verify
- 異常 inter-arrival (例 < 30 秒) は thundering 候補として log 化

### Step 5. SOP 適合率の計測
- 適合定義 = (a) inter-arrival 45±5s / (b) wave 跨ぎ baseline drift 0 / (c) regression 0 / (d) Owner 拘束 0 分
- 4/4 達成 = 適合 1 / 1 (この Round で SOP 適合)
- 連続 3 round 累計 n=27 で 80%+ trigger を観測 → DEC-019-068 fork

### Step 6. 連続適用の累積評価
- Round n の SOP 適合フラグ ∈ {0, 1} を時系列で記録
- 累計 n round 中 ≥ 0.8 × n round で適合 = SOP 安定運用 OK
- 5+ round で 70% 割れ = SOP v2 改訂 trigger (DEC-019-062 v2 別 DEC 起案)

### Step 7. デフォルト運用フロー昇格判断
- DEC-019-068 trigger 4 条件 (T-1〜T-4) を全達成 → Round 19 で正式議決として SOP confirmed 切替
- PRJ-018 / PRJ-012 への横展開検討開始
- adopted maturity への昇格は 3 round 以上の連続適用達成後 (DEC-019-068 fork 連動)

## 成功基準 (Success Criteria)

- 累計 n=36 (4 round × 9 並列) 中 SOP 適合率 ≥ 80%
- API $0 / 副作用 0 / 絵文字 0 / tests 0 件 regression を 4 round 連続維持
- 1024 bin histogram max-cluster-density < 2× mean を全 Round で再現
- Owner 拘束 0 分維持 (dispatch 自動化のみで実行)

## 失敗パターン (Anti-patterns)

- stagger 圧縮を 30 秒以下にして heartbeat retry が同期化 (thundering herd 復活)
- jitter='equal' / jitter=none に切替えると uniform 分布が崩壊 (max bin 2-3× mean)
- wave 跨ぎ baseline drift を計測せず +N tests 加算で混乱 (PIT-068 再発)
- 単一 Round の適合だけで「SOP confirmed」と早合点 (連続 3 round 未達で昇格不可)

## 連動 SOP / 参照

- PAT-061 (Mulberry32 Deterministic PRNG for Load Test) — 決定論 PRNG 内製による thundering 検証基盤
- PAT-064 (Sec Hardening Automation 3-Script Bundle) — 副作用 0 / 絵文字 0 / tests PASS gate の自動 enforcement
- DEC-066 (Round 17 Territory Inviolability Division) — 並列 dispatch の領域分業契約
- PB-069 (17-Day Path W1 Territory Inviolability Playbook) — dispatch 領域軸の連動 SOP
- PIT-068 (Test Count Race Cross-Wave Dispatch) — wave 跨ぎ baseline drift の落とし穴

## 履歴

- 2026-05-05 v1.0 起案 (Knowledge-N / Round 18 第 1 波)
- piloted: Round 15 (DEC-019-062 採択) / Round 16 (9 並列 dispatch plan) / Round 17 (3 round 連続) / Round 18 (4 round 連続 + DEC-019-068 DRAFT trigger 評価)
- adopted への昇格判断は DEC-019-068 confirmed 採択 (Round 19 想定) と連動
