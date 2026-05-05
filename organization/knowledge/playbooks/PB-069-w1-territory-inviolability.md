---
id: PB-069
type: playbook
title: "17-Day Path W1 Territory Inviolability Playbook (7-control 領域不可侵分業)"
source_prj: PRJ-019
source_decisions: [DEC-019-062, DEC-019-065, DEC-019-066]
source_round: [17, 18]
tags: [playbook, 17-day, w1, territory-inviolability, dev-t-dev-w, file-isolation, parallel-dispatch]
applicable_to: [parallel-multi-agent-dispatch, monorepo-control-implementation, ai-org-9-parallel]
maturity: piloted
confidence: 0.85
last_validated: 2026-05-05
hitl_pii_reviewed: false
hitl_pii_reviewer: null
hitl_pii_review_date: null
sec_k_hardening_applied: true
sec_l_automation_applied: true
related: [PAT-063, DEC-066, PIT-068, PB-070]
created: 2026-05-05
pii-redacted: true
---

# 17-Day Path W1 Territory Inviolability Playbook

## 適用領域 (When to use)

9 並列 dispatch で同一の path skeleton (W1 → W2 → W3) 上に複数 control を実装する際、Agent 間の編集衝突を 0 化したいとき。Round 17 で Dev-T (3 control) と Dev-W (4 control) に 7 control を分担した実例を formal 化したもの。Round 18 で Dev-X (3 control) + Dev-Y (4 control) に同 SOP を継承し再現性を確認 (28 invariants 完遂、衝突 0)。

## 前提条件 (Preconditions)

1. control 実装本体が file granularity で分割されている (1 control = 1 file 原則)
2. control 間の chain 検証は test 層に閉じ込め可能 (Public API 不変性)
3. 共有編集が必要な test fixture は事前に列挙し、衝突解消 SOP を持っている

## 6 ステップ手順 (Procedure)

### Step 1. control 棚卸し + 領域線引き
- 全 control を列挙し、「依存方向」「変更頻度」で 2 グループに分割
- グループ A (Dev-X 系): C-OC-03 / C-OC-04 / P-UI-02 (chain shape の上流)
- グループ B (Dev-Y 系): P-UI-04 / P-UI-05 / P-UI-09 / HITL-10 (audit / rollback の下流)

### Step 2. 領域不可侵契約の宣言
- Agent 受領レポートに「触ってよい file path」を明示列挙
- 他 Agent 領域の pre-existing TS error / lint warning は **そのまま残す** (修正禁止)
- 例: Dev-X が p-ui-09-rls-checklist.ts:122 の TS6133 を発見しても触らず、Dev-Y への申し送りに留める

### Step 3. cross-control invariants の test 層集約
- 各 invariant は test file 1 本に集約 (例: 17day-path-w2-3ctrl.test.ts / 17day-path-w2-4ctrl.test.ts)
- pure helper (例: projectMajorDiffsToEscalation) で chain を表現、Public API 変更 0
- 別 Agent 領域の control を呼ぶ場合は zod schema 経由のみ (importの型のみ参照)

### Step 4. DI port 注入による副作用 0 設計
- KillTerminalSink / PermissionAuditSink / PostRollbackNotifier を optional 引数化
- 省略時 W1 と完全同一挙動 (後方互換 100%)
- 副作用は外部 sink/notifier に委譲、関数本体は zod parse + 状態遷移のみ

### Step 5. 物理的な編集衝突検査
- 各 Agent 完了後に `git diff --stat` で touch ファイル列挙
- 領域不可侵違反があれば即時 revert + 該当 Agent 再 dispatch
- 共有 test fixture は最小編集ルール (2 ケース以下) で事前合意

### Step 6. regression baseline 維持確認
- baseline test 件数 ± 0 を最終 gate で確認 (例: 366 → 377 = +11 / 366 → 394 = +28 純増のみ)
- W1 既存テスト (17day-path-w1-residual.test.ts 21 件 + 17day-path-7ctrl.test.ts 29 件) の PASS 不変

## 成功基準 (Success Criteria)

- 領域不可侵違反 0 件 (`git diff --stat` で確認)
- regression 0 件 (baseline test PASS 件数不変)
- cross-control invariants の vitest 機械検証完遂 (Round 17: 11 invariants / Round 18: 28 invariants)
- TypeScript strict pass (新規 file の TS error 0)
- 副作用 0 / API $0

## 失敗パターン (Anti-patterns)

- 自領域外の pre-existing error を「ついで修正」してしまう (PIT-068 と関連)
- DI port 引数を required にして W1 後方互換を破壊する
- chain test を実装本体に書いて Public API を膨張させる
- 共有 fixture を 3 ケース以上同時編集して merge 衝突を発生させる

## 連動 SOP / 参照

- PAT-063 (DI Port Injection 17-day W1 7-Control) — port 設計の機械的規約
- DEC-066 (Round 17 Territory Inviolability Division) — 採択経緯
- PIT-068 (Test Count Race Cross-Wave Dispatch) — 並走波 baseline drift 防止
- PB-070 (Stagger Compression SOP 連続適用 Playbook) — dispatch 時間軸の連動 SOP

## 履歴

- 2026-05-05 v1.0 起案 (Knowledge-N / Round 18 第 1 波)
- piloted: Round 17 Dev-T+Dev-W (7 control 11 invariants) / Round 18 Dev-X+Dev-Y (7 control 28 invariants)
- adopted への昇格判断は Round 19+ で 3 round 連続適用達成後に検討 (DEC-019-068 fork 連動)
