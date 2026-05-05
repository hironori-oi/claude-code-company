---
tags: [index, retrieval, knowledge-mining, prj-019, round14, round15, round16, round17, round18, round19]
index-version: v9
source-PRJ: PRJ-019
source-DEC: [DEC-019-033, DEC-019-056, DEC-019-057, DEC-019-058, DEC-019-059, DEC-019-060, DEC-019-061, DEC-019-062, DEC-019-065, DEC-019-066, DEC-019-067, DEC-019-068, DEC-019-069]
source-Round: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
created: 2026-05-05
pii-redacted: true
knowledge-pii-review: pending
supersedes: INDEX-v8.md (補完運用、v8 は historical baseline として保持)
---

# Knowledge Retrieval Index v9

PRJ-019 Round 19 第 1 波 (9 並列完遂着地: PM-L / Knowledge-N (v8) / Dev-AA W3 3ctrl / Sec-N Major 4 / Dev-BB W3 4ctrl / Dev-CC heartbeat 500k / Review-K / Marketing-M / Web-Ops-F) で蓄積された Knowledge ナレッジを集約した v9 index。

INDEX-v8 (81 entries) -> **INDEX-v9 (92 entries)** に拡張、Round 19 由来追加 11 件 (patterns +5 / decisions +1 / pitfalls +2 / playbooks +1 / + 既存物理化 +2 = 計 +11) 反映。
DEC-019-033 で確立した 3 サブディレクトリ構造 + playbooks/ 物理 dir に準拠、`_meta/schema.yaml` v2 + `_meta/tags.yaml` taxonomy と整合。
playbooks/ サブディレクトリは v8 で物理 dir 起票完遂、v9 で更に PB-070 maturity adopted 候補移行 trigger 達成 + 5 round 連続適用記録更新。

## 0. ファイル全件一覧 (patterns 41 + decisions 22 + pitfalls 22 + playbooks 7 = 92 件)

### 0.1 patterns/ (41 件、Round 7-19)

| title | file path | tags (抜粋) | source-DEC | source-Round | 1 行 summary |
|---|---|---|---|---|---|
| HITL Gate Dispatcher | `patterns/PAT-001-hitl-gate-dispatcher.md` | hitl, dispatcher, gate | DEC-019-007 | 8 | HITL 11 種を gate dispatcher で集中管理 |
| AI Org Parallel Implementation Playbook | `patterns/ai-org-parallel-implementation-playbook.md` | ai-org, parallel-dispatch | DEC-019-025, DEC-019-056 | 9, 10 | 並列 Agent dispatch 実装規約 |
| AI Three Layer Guard | `patterns/ai-three-layer-guard.md` | guard, three-layer | DEC-019-007 | 8 | AI 暴走の 3 層防御 (cap / kill / audit) |
| Benchmark P50/P95/P99 | `patterns/benchmark-p50-p95-p99.md` | benchmark, percentile | DEC-019-007, DEC-019-056 | 10 | nearest-rank で P50/P95/P99 算出 + fixture 化 |
| Context-Aware Suppression Pattern | `patterns/context-aware-suppression-pattern.md` | false-positive, suppression | DEC-019-008, DEC-019-050, DEC-019-051, DEC-019-056 | 10 | 4 プリミティブで high false-positive セルを抑止 |
| Dependency Injection Time Source | `patterns/dependency-injection-time-source.md` | DI, time-source, deterministic-test | DEC-019-006 | 7 | TimeSource DI で決定論テスト |
| Dry-Run Guard Category Pattern | `patterns/dry-run-guard-category-pattern.md` | dry-run, hardguard, G-12 | DEC-019-007, DEC-019-053, DEC-019-056 | 10 | 5 カテゴリ dry / live 切替 |
| E2E Round-Trip 7 Stages | `patterns/e2e-round-trip-7-stages.md` | e2e, mock, round-trip | DEC-019-007, DEC-019-025, DEC-019-056 | 10 | mock-claw 7 stage 統合 orchestrator |
| Hash Chain Audit Pattern | `patterns/hash-chain-audit-pattern.md` | audit, hash-chain | DEC-019-054, DEC-019-007 | 7 | append-only hash chain audit store |
| Kill Switch G05/G06 | `patterns/kill-switch-G05-G06.md` | kill-switch, hardguard | DEC-019-007 | 8 | 緊急停止 + FS allowlist + shell allowlist |
| Multi-Tenant Three Layer Authz | `patterns/multi-tenant-three-layer-authz.md` | authz, multi-tenant | DEC-001 | — | 4 layer 権限昇格の多テナント版 |
| Object Freeze Denylist | `patterns/object-freeze-denylist.md` | denylist, immutable | DEC-019-010 | 9 | 13-domain denylist の Object.freeze 化 |
| Spend Cap Watchdog 3-Tier | `patterns/spend-cap-watchdog-3-tier.md` | spend-cap, watchdog | DEC-019-050 | 7 | $80/$95/$100 段階 watchdog + 強制停止 |
| Zod Discriminated Union IF | `patterns/zod-discriminated-union-IF.md` | zod, discriminated-union | DEC-019-018 | 9 | 構造化 JSON IF を zod で統一 |
| Subprocess 5-Outcome Discriminated Union | `patterns/subprocess-5-outcome-discriminated-union.md` | subprocess, fail-safe, kill-chain | DEC-019-007, DEC-019-010, DEC-019-058 | 11 | subprocess adapter 6 経路を reason literal で type-safe 化 |
| 6-State FSM Transition Validation | `patterns/6-state-fsm-transition-validation.md` | fsm, lifecycle | DEC-019-007, DEC-019-051, DEC-019-058 | 11 | subprocess lifecycle を 6 状態 + 純関数 transition table |
| 5-Stage Routing Strategy Precedence | `patterns/5-stage-routing-strategy-precedence.md` | strategy-pattern, routing | DEC-019-010, DEC-019-050, DEC-019-051, DEC-019-058 | 11 | subscription / api / dry-run 切替を 5 段階 precedence 純関数 |
| YAML Config Self Parser No Deps | `patterns/yaml-config-self-parser-no-deps.md` | yaml, parser, zero-dependency | DEC-019-010, DEC-019-058, DEC-019-059 | 12 | 依存追加 0 で YAML config を自前 parse + zod validate |
| Cross-Package Dependency Inversion | `patterns/cross-package-dependency-inversion.md` | dependency-inversion, cross-package, monorepo | DEC-019-007, DEC-019-054, DEC-019-058, DEC-019-059 | 12 | 最小 interface 独立定義 + caller DI で逆 import 回避 |
| Parameterized Runner Harness | `patterns/parameterized-runner-harness.md` | test-harness, scenario-matrix, drill-2 | DEC-019-006, DEC-019-007, DEC-019-058, DEC-019-059 | 12 | dry-run / real spawn 切替 + N×M matrix 事前検証 harness |
| Multilingual NFKC + Kanji Unification | `patterns/multilingual-nfkc-kanji-unification.md` | nfkc, multilingual, kanji-unification, denylist | DEC-019-010〜DEC-019-059 | 13 | NFKC + 中文/韓/日 35 ペア統一辞書 + locale 自動検出 |
| ESLint Bidirectional Dependency Rule | `patterns/eslint-bidirectional-dependency-rule.md` | eslint, dependency-direction, lint-as-architecture | DEC-019-007〜DEC-019-059 | 13 | `no-restricted-imports` 双方向設定で循環/逆 import を CI 検出 |
| Parameterized Runner Multi-Date | `patterns/parameterized-runner-multi-date.md` | test-harness, multi-date, drill-2, cli-arg | DEC-019-006〜DEC-019-059 | 13 | `--date YYYY-MM-DD` で 5 候補日切替 drill #2 1-shot 実機 harness |
| Stagger Compression SOP | `patterns/stagger-compression-sop.md` | stagger, compression, parallel-dispatch, sop | DEC-019-062, DEC-019-061, DEC-019-059 | 15 | 9 並列 dispatch 時の stagger 起動間隔を 90s→45s に圧縮 |
| 9-Parallel Dispatch Plan | `patterns/9-parallel-dispatch-plan.md` | parallel-dispatch, 9-parallel, plan, round-16 | DEC-019-065, DEC-019-062, DEC-019-061 | 16 | Round 16 で確立した 9 並列 dispatch の wave 設計 + I/O port 注入 |
| Zod Schema Canonical SoT | `patterns/zod-schema-canonical-sot.md` | zod, canonical, sot, gate-11, dev-q | DEC-019-066, DEC-019-065, DEC-019-058 | 16 | gate-11 merge 経由で zod schema を canonical SoT 化 |
| Mulberry32 Deterministic PRNG for Load Test | `patterns/PAT-061-mulberry32-deterministic-prng-load-test.md` | prng, mulberry32, deterministic, load-test, side-effect-zero, 50k | DEC-019-025, DEC-019-049, DEC-019-062 | 17 | 50k load test で seedrandom 依存追加 0、決定論 PRNG 内製 pattern |
| Vitest Default Include Naming Convention | `patterns/PAT-062-vitest-default-include-naming-convention.md` | vitest, file-extension, test-naming, include-pattern | DEC-019-025, DEC-019-062 | 17 | vitest config 不在 harness で `.test.ts` 命名統一による pickup 確実化 |
| DI Port Injection 17-Day W1 7-Control | `patterns/PAT-063-di-port-injection-17day-w1.md` | di, port-injection, 17-day, w1, 7-control | DEC-019-058, DEC-019-062, DEC-019-065 | 17 | 7 control を fetcher / notifier / killer / signer / approver port 注入 |
| Sec Hardening Automation 3-Script Bundle | `patterns/PAT-064-sec-hardening-automation-3-script.md` | sec-hardening, automation, side-effect-zero, emoji-zero, tests-pass-gate, bash | DEC-019-066 | 17 | 副作用 0 / 絵文字 0 / tests PASS gate を bash で外部依存 0 自動化 |
| satisfies Record Exhaustiveness Guard | `patterns/PAT-065-satisfies-record-exhaustiveness-guard.md` | typescript, satisfies, exhaustiveness, zod, canonical-sot | DEC-019-066, DEC-019-065 | 17 | `satisfies Record<KnowledgeKind, string>` で zod enum 拡張時のコンパイル時漏れ検知 |
| Cross-Control Invariants Test-Layer Containment | `patterns/PAT-071-cross-control-invariants-test-layer.md` | cross-control, invariants, test-layer, public-api-immutable, w2 | DEC-019-067, DEC-019-068 | 18 | Public API 不変のまま test 層に control 間 chain invariants 28 件を集約する pattern |
| DI Port Optional Backward-Compatible | `patterns/PAT-072-di-port-optional-backward-compatible.md` | di, port-injection, optional, backward-compatible, sink, notifier | DEC-019-067, DEC-019-068 | 18 | KillTerminalSink / PermissionAuditSink / PostRollbackNotifier を optional 引数化し W1 後方互換 100% 維持 |
| Mulberry32 PRNG Seed Series Isolation | `patterns/PAT-073-mulberry32-prng-seed-series-isolation.md` | prng, mulberry32, seed-series, 50k-100k, isolation, scale-up | DEC-019-025, DEC-019-062 | 18 | 50k (0xdeadbeef 系) と 100k (0xfeedface 系) で seed series 完全分離 |
| 1024-Bin Histogram Thundering Herd Statistic | `patterns/PAT-074-1024-bin-histogram-thundering-herd.md` | histogram, 1024-bin, max-cluster-density, thundering-herd, statistic, jitter-full | DEC-019-062 | 18 | max bin < 2× mean / 空 bin <5% を 100k サンプルで verify |
| API Spike 3-Layer Detection + Cooldown | `patterns/PAT-075-api-spike-3layer-detection-cooldown.md` | sec-hardening, api-spike, 3-layer, cooldown, pii-redaction, anthropic | DEC-019-066 | 18 | 1h 累積/月次 trajectory/cooldown 30min の 3 層検知 |
| Owner Action Card 5-15 Min Granularity | `patterns/PAT-076-owner-action-card-5-15min-granularity.md` | owner-action, card, 5-15-min, runbook, runsheet, launch-pre-ops | DEC-019-068, DEC-018-047 | 18 | Owner 残動作 4 件を CARD A-D に分解し 5-15 分粒度 sub-card 7 件で runsheet 化 |
| **W3 Orchestrator Control-Agnostic Port-Injection** | `patterns/PAT-082-w3-orchestrator-control-agnostic-port-injection.md` | w3, orchestrator, control-agnostic, port-injection, harness, 3-ctrl-chain | DEC-019-068, DEC-019-069 | **19** | **C-OC-03→projection→C-OC-04→P-UI-02 cooldown gate の 4 段 chain を control の関数 signature 構造的部分型として再宣言、harness→openclaw-runtime 逆 import 回避 (Dev-AA 由来)** |
| **Heartbeat 500k Thundering Herd Detection (1024-bin + max-cluster-density)** | `patterns/PAT-083-heartbeat-500k-thundering-herd-detection.md` | thundering-herd, 1024-bin, max-cluster-density, 500k, jitter-mode-comparison, formal-slo | DEC-019-062 | **19** | **1024 bin × 3 jitter mode の max-cluster-density を formal SLO 化 (full/equal <1.5x mean / decorrelated <2.5x mean)、500k 件で 100k informal 2x から強化 (Dev-CC 由来)** |
| **Heartbeat 4 Jitter Mode Comparison (none/full/equal/decorrelated)** | `patterns/PAT-084-heartbeat-4-jitter-mode-comparison.md` | jitter-mode, full, equal, decorrelated, none, cv, theoretical-mean, 500k | DEC-019-062 | **19** | **full/equal/decorrelated 3 mode の CV/mean 理論値一致を 500k で verify、序列 full < decorrelated ≦ equal を統計的検証 (Dev-CC 由来)** |
| **Vitest Config testTimeout 15s + include 明示化 Design** | `patterns/PAT-085-vitest-config-testtimeout-include-design.md` | vitest, vitest-config, testtimeout, hooktimeout, include-pattern, load-test | DEC-019-025 | **19** | **load test (500k+) で default 5s timeout を 15s に拡張 + `include: ['src/**/*.test.ts']` 明示で .spec.ts pickup risk 回避 (Dev-CC 由来)** |
| **SEC_OVERRIDE Audit JSONL + sha256 user_hash Pattern** | `patterns/PAT-086-sec-override-audit-jsonl-sha256-user-hash.md` | sec-override, audit, jsonl, sha256, user-hash, pii-redaction, sec-n | DEC-019-066, DEC-019-067 | **19** | **violations 検出時に SEC_OVERRIDE=1 なら sec-audit.log に JSONL 1 行追記、$USER を sha256 12 桁 hash 化、PII 安全運用 (Sec-N 由来)** |

### 0.2 decisions/ (22 件、Round 9-19)

| title | file path | tags (抜粋) | source-DEC | source-Round | 1 行 summary |
|---|---|---|---|---|---|
| Privilege Escalation 4 Layers | `decisions/DEC-001-priviledge-escalation-4-layers.md` | DEC-001, authz | DEC-001 | — | 4 layer 権限昇格モデル |
| Cross Validation 4 Departments | `decisions/cross-validation-4-departments.md` | cross-validation | DEC-019-025, DEC-019-056, DEC-019-057 | 9, 10 | 4 部署独立収斂を最重要意思決定シグナルに昇格 |
| DEC-019-010 13-Domain Rationale | `decisions/dec-019-010-13-domain-rationale.md` | DEC-019-010, denylist | DEC-019-010 | 9 | 13 領域 denylist の根拠 |
| DEC-019-050 Spend Cap $30 | `decisions/dec-019-050-spend-cap-30usd.md` | DEC-019-050, spend-cap | DEC-019-050 | 8 | Anthropic API cap $30 採択経緯 |
| DEC-019-052 NG-3 Plan B 16h/$100 | `decisions/dec-019-052-NG3-plan-B-16h-100usd.md` | DEC-019-052, NG-3 | DEC-019-052 | 8 | NG-3 暫定値 plan B 採択 |
| DEC-019-053 2-Tier Env | `decisions/dec-019-053-2-tier-env.md` | DEC-019-053, env, 2-tier | DEC-019-053 | 8 | dev / prod 2-tier 環境分離 |
| DEC-019-054 Hash Chain | `decisions/dec-019-054-hash-chain.md` | DEC-019-054, hash-chain | DEC-019-054 | 7 | audit hash chain 採択 |
| DEC-019-056 Round 9 6-Parallel Dispatch | `decisions/dec-019-056-round9-6-parallel-dispatch.md` | DEC-019-056, parallel-dispatch | DEC-019-056〜033 | 9, 10 | Round 9 6 並列 + 5/22 朝公開前倒し |
| DEC-019-057 Case C Hybrid Rationale | `decisions/dec-019-057-case-c-hybrid-rationale.md` | DEC-019-057, case-c-hybrid | DEC-019-057, DEC-019-052, DEC-019-056 | 10 | 5/22 内部運用着手 + 6/27 朝公開維持 二段階 |
| MS-2 Trial Pre-Emption | `decisions/ms-2-trial-pre-emption.md` | milestone, trial-run, pre-emption | DEC-019-057, DEC-019-056 | 10 | 公式 MS 7 日前に trial 投入で確度押上 |
| DEC-019-058 Round 11 9-Parallel Authorization | `decisions/dec-019-058-round11-9-parallel-authorization.md` | DEC-019-058, 9-parallel | DEC-019-058〜056 | 11 | Round 11 9 並列 dispatch + W3 中核 22 日前倒し |
| Owner Fastest Directive Interpretation | `decisions/owner-fastest-directive-interpretation.md` | owner-directive, ceo-interpretation | DEC-019-058〜056 | 9, 10, 11 | Owner「最速」を「選択肢 A 採用」へ converting する CEO 解釈方法論 |
| DEC-019-059 Round 12 10-Parallel + 5/22 Push | `decisions/dec-019-059-round12-10-parallel.md` | DEC-019-059, 10-parallel | DEC-019-059〜057 | 12 | Round 12 10 並列 + W3-W4 中核 22-30 日前倒し |
| CB-D-W3-01 22-Day Pre-Emption | `decisions/cb-d-w3-01-22-day-pre-emption.md` | pre-emption, w3-w0, 22-day-shift | DEC-019-010, DEC-019-058, DEC-019-059 | 12 | denylist YAML 化を W3→W0 で 22 日前倒し採択 |
| DEC-019-060 Decision-26 Pre-Emption | `decisions/dec-019-060-decision-26-pre-emption.md` | DEC-019-060, decision-26 | DEC-019-007〜DEC-019-059 | 13 | 議決-26 を 4 候補日前倒し可否評価 + CEO 推奨 5/6 朝採決 |
| Cross-Validation 3 Departments Pre-Emption | `decisions/cross-validation-3-departments-pre-emption.md` | cross-validation, 3-departments | DEC-019-025〜DEC-019-060 | 13 | PM-F + Review-E + Sec-H 3 部署独立収斂を意思決定シグナルに昇格 |
| DEC-019-062 Stagger Compression Adoption | `decisions/dec-019-062-stagger-compression.md` | DEC-019-062, stagger, compression | DEC-019-062, DEC-019-061, DEC-019-059 | 15 | stagger 90s→45s 圧縮 + thundering herd 回避策採択 |
| DEC-019-065 PM-I 5/19 Review | `decisions/dec-019-065-pm-i-5-19-review.md` | DEC-019-065, pm-i, 5-19-review | DEC-019-065, DEC-019-062, DEC-019-061 | 16 | PM-I 起案、5/19 朝レビューで 9 並列 dispatch plan 確定 |
| DEC-019-066 Sec-K Hardening 4 Items | `decisions/dec-019-066-sec-k-hardening-4-items.md` | DEC-019-066, sec-k, pii-hardening | DEC-019-066, DEC-019-033, DEC-019-065 | 16 | Sec-K 起案、PII redaction 4 項目強化 |
| Round 17 Territory Inviolability Division | `decisions/DEC-066-round17-territory-inviolability-division.md` | round-17, territory-inviolability, dev-t, dev-w | DEC-019-062, DEC-019-065, DEC-019-066 | 17 | 9 並列 dispatch 時に Dev-T/Dev-W 領域不可侵分業を採択 |
| DEC-019-068 Stagger SOP Default Promotion Trigger | `decisions/DEC-077-019-068-stagger-sop-default-promotion-trigger.md` | DEC-019-068, stagger, sop-promotion, 4-trigger, default-flow | DEC-019-068, DEC-019-067, DEC-019-062 | 18 | 連続 4 round SOP 適合率 ≥80% / API $0 / tests baseline / Owner 0 分の 4 trigger 全達成で SOP デフォルト運用フロー昇格議決 |
| **DEC-019-069 Round 19 9-Parallel + W3 Migration + 7-Measurable Criteria** | `decisions/DEC-067-019-069-round19-9parallel-w3-migration-7-criteria.md` | DEC-019-069, round-19, 9-parallel, w3-migration, harness-orchestrator, measurable-criteria | DEC-019-069, DEC-019-068, DEC-019-067 | **19** | **Round 19 9 並列構成 + 17 日 path W2→W3 移行宣言 + harness orchestrator 接続 W3 spec + measurable 7 criteria (M-1〜M-7) 起案 (PM-L DRAFT、5/26 採択想定)** |

### 0.3 pitfalls/ (22 件、Round 9-19)

| title | file path | tags (抜粋) | source-DEC | source-Round | severity | 1 行 summary |
|---|---|---|---|---|---|---|
| 13-Domain Denylist 49-Gap Detection | `pitfalls/13-domain-denylist-49-gap-detection.md` | denylist, gap-detection | DEC-019-010 | 9 | medium | needs-scout 49 ギャップの検出方法 |
| 50 Controls 95% Gap Detection | `pitfalls/50-controls-95-percent-gap-detection.md` | mandatory-controls, 95-percent-threshold | DEC-019-007〜056 | 10 | high | 50 軸 64% → 95% 押上の PENDING R7 見落とし |
| Audit Canonical Drift | `pitfalls/PIT-001-audit-canonical-drift.md` | audit, canonical, drift | DEC-019-054 | 9 | high | audit log の canonical 化ずれ |
| GitHub Actions Secret + pnpm Workspace | `pitfalls/PIT-002-github-actions-secret-naming-and-pnpm-workspace.md` | ci, secret, pnpm-workspace | DEC-019-053 | — | medium | secret 命名 + pnpm workspace 落とし穴 |
| Confirm Count 2 Not Enough | `pitfalls/confirm-count-2-not-enough.md` | tos-monitor, false-positive | DEC-019-008〜056 | 9, 10 | medium | 持続 spike 系は confirmCount を上げても抑止不可 |
| Confirm Count 2 Suppress False Positive | `pitfalls/confirm-count-2-suppress-false-positive.md` | false-positive, debounce | DEC-019-008, DEC-019-052 | 9 | low | confirmCount=2 の限界 |
| Hash Chain Recovery Edge Case | `pitfalls/hash-chain-recovery-edge-case.md` | hash-chain, recovery | DEC-019-054 | 9 | high | audit hash chain 復旧時の edge case |
| Narrative 28x28 Forced Compression | `pitfalls/narrative-28x28-forced-compression.md` | marketing, narrative | DEC-019-052〜057 | 10 | medium | 公開前倒し圧縮で品質劣化 |
| verbatimModuleSyntax + Vitest ESM | `pitfalls/verbatimModuleSyntax-vitest-ESM.md` | typescript, vitest, esm | — | — | low | verbatimModuleSyntax と vitest ESM 互換性 |
| Web Budget Guard server-only | `pitfalls/web-budget-guard-server-only.md` | budget-guard, server-only | DEC-019-050 | — | medium | server-only import 解決失敗 |
| Parallel Dispatch Typecheck Race | `pitfalls/parallel-dispatch-typecheck-race.md` | parallel-dispatch, typecheck, race-condition | DEC-019-025, DEC-019-058 | 11 | medium | 9 並列で in-progress な subprocess.ts を別 Agent が typecheck で検出 |
| Test Count Measurement Methodology Divergence | `pitfalls/test-count-measurement-methodology-divergence.md` | test-count, measurement, vitest | DEC-019-025, DEC-019-058 | 11 | low | Dev-C 614 vs Dev-D 507 vs CEO 614 の測定方法論差異 |
| Test Harness vs Test Extension Confusion | `pitfalls/test-harness-vs-test-extension-confusion.md` | test-harness, file-extension | DEC-019-025〜059 | 12 | medium | `.harness.ts` 拡張子で auto-run 除外する pattern の落とし穴 |
| Refactor Line Target vs Content Density | `pitfalls/refactor-line-target-vs-content-density.md` | refactor, line-target, content-density | DEC-019-008〜059 | 12 | medium | 「行数削減 KPI」と「content density」が競合する設計上のジレンマ |
| Owner RSVP Time Constraint vs Fastest | `pitfalls/owner-rsvp-time-constraint-vs-fastest.md` | owner-directive, rsvp-constraint, fastest-directive | DEC-019-025〜060 | 13 | high | 「最速」directive を時刻ベースのみで解釈し RSVP 物理拘束を見落とす落とし穴 |
| Path Skeleton I/O Port Injection Forgot | `pitfalls/path-skeleton-io-port-injection-forgot.md` | path-skeleton, io-port, injection | DEC-019-062, DEC-019-061, DEC-019-058 | 15 | high | 17 日 path skeleton 段階で I/O port 注入を忘れ後段 wave で type error 連鎖 |
| Vitest Spec-Test Extension Pickup Miss | `pitfalls/PIT-067-vitest-spec-test-extension-pickup-miss.md` | vitest, file-extension, spec-vs-test, pickup-miss | DEC-019-025, DEC-019-062 | 17 | medium | vitest default include は `.test.ts` のみ pickup |
| Test Count Race Cross-Wave Dispatch | `pitfalls/PIT-068-test-count-race-cross-wave-dispatch.md` | parallel-dispatch, test-count, race, cross-wave | DEC-019-025, DEC-019-062, DEC-019-065 | 17 | low | 9 並列波 baseline 607 + Dev-U 10 想定が実測 621 で乖離 |
| Pre-Existing TS Error Cross-Territory Drift | `pitfalls/PIT-078-pre-existing-ts-error-cross-territory-drift.md` | ts-error, cross-territory, pre-existing, dev-x, dev-y, regression | DEC-019-067, DEC-019-068 | 18 | medium | Dev-X が他領域 (Dev-Y) の pre-existing TS6133 を発見しても触らない領域不可侵原則 |
| Public-Launch SOP Date Drift Multi-Source | `pitfalls/PIT-079-public-launch-sop-date-drift-multi-source.md` | launch, public-launch-sop, date-drift, 6-19-vs-6-20-vs-6-27, runbook | DEC-018-047, DEC-019-068 | 18 | medium | 公開日 6/19 vs 6/20 vs 6/27 の 3 値が runbook / SOP / brief に散在 |
| **Workspace Alias Unresolved Relative Imports Fallback (ARCH-01)** | `pitfalls/PIT-071-workspace-alias-unresolved-relative-imports-fallback.md` | workspace-alias, monorepo, vitest-config, relative-imports, arch-01, dec-019-041-phase-b | DEC-019-041, DEC-019-068, DEC-019-069 | **19** | **medium** | **harness package 単体 `pnpm test` 実行時に `@clawbridge/openclaw-runtime` workspace alias 未解決 → 相対 import (`../../../openclaw-runtime/src/controls/*.js`) で fallback、本格解消は ARCH-01 (DEC-019-041) Phase B 候補として記録 (Dev-BB 由来)** |
| **BASE_REF CI Non-Connected Environment Fallback (3-tier)** | `pitfalls/PIT-072-base-ref-ci-non-connected-fallback-3tier.md` | base-ref, ci, fallback, 3-tier, sec-side-effect-zero, sec-n | DEC-019-066, DEC-019-067 | **19** | **medium** | **CI 非接続環境で BASE_REF 既定値 HEAD~1 のみだと複数 commit Round で取りこぼし、3-tier fallback (env 明示 → origin/main rev-parse → HEAD~1) と BASE_REF_SOURCE label 出力で解消 (Sec-N 由来)** |

### 0.4 playbooks/ (7 件、Round 17 新設、Round 18 物理化、Round 19 拡充)

| title | file path | tags (抜粋) | source-DEC | source-Round | 1 行 summary |
|---|---|---|---|---|---|
| 17-Day Path W1 Territory Inviolability Playbook | `playbooks/PB-069-w1-territory-inviolability.md` | playbook, 17-day, w1, territory-inviolability, dev-t-dev-w | DEC-019-062, DEC-019-065 | 17, 18 | 17 日 path W1 期で 7 control を Dev-T/Dev-W 分担、Round 18 で Dev-X/Y 再現確認 |
| Stagger Compression SOP 連続適用 Playbook | `playbooks/PB-070-stagger-compression-sop.md` | playbook, stagger, compression, sop, continuous-application | DEC-019-062, DEC-019-065, DEC-019-066, DEC-019-067 | 17, 18, **19** | DEC-019-062 SOP を Round 15→16→17→18→**19** で連続 5 round 適用、累積 n=45 適合率 100% (T-1 80%+ trigger 達成) |
| Round 18 Cross-Control Invariants W2 Containment Playbook | `playbooks/PB-080-round18-cross-control-invariants-w2.md` | playbook, w2, cross-control, invariants, public-api-immutable, di-port | DEC-019-067, DEC-019-068 | 18 | W2 段階で control 間 chain invariants 28 件を test 層に閉じ込め Public API 変更 0 を達成する playbook |
| Launch Pre-Ops Checklist + Owner Action Card Playbook | `playbooks/PB-081-launch-pre-ops-checklist-owner-card.md` | playbook, launch-pre-ops, owner-action, card, 5-15-min, runbook | DEC-018-047, DEC-019-068 | 18 | 公開前運用設定 7 項目 + Owner 残動作 4 card (A/B/C/D) を Owner 拘束 1.5h 以下に抑える runsheet playbook |
| AI Cost Management Playbook | `playbooks/ai-cost-management.md` | playbook, ai-cost, anthropic, spend-cap, cost-management | DEC-019-050, DEC-019-066 | — | API spend cap 設計 + Anthropic API 監視 + 月次予算管理 (PRJ-019 由来既存 file 物理化済) |
| Turso + Drizzle + Better-Auth Migration Playbook | `playbooks/turso-drizzle-better-auth-migration.md` | playbook, turso, drizzle, better-auth, migration, db | — | — | Turso (libSQL) + Drizzle ORM + Better-Auth への移行 playbook (PRJ 横断既存 file 物理化済) |
| **Round 19 SOP Default Promotion 4-Trigger Achievement Playbook** | `playbooks/PB-071-round19-sop-default-promotion-trigger-achievement.md` | playbook, sop-promotion, 4-trigger, t1-t2-t3-t4, default-flow, round-19 | DEC-019-068, DEC-019-069 | **19** | **DEC-019-068 デフォルト運用フロー昇格 trigger 4 条件 (T-1 適合率 80%+ n=36 / T-2 API $0 / T-3 tests baseline / T-4 Owner 0 分) を Round 19 完遂時点で 4/4 全達成 (実測 n=45 / 適合 100% / API $0 / 674 PASS / Owner 0 分)、5/26 formal 採択で SOP confirmed 切替 playbook (PM-L 由来)** |

> **注**: PB-069 / PB-070 は Round 17 で論理新設、Round 18 で物理 dir 起票完了、Round 19 で `ai-cost-management.md` + `turso-drizzle-better-auth-migration.md` + `README.md` も物理 dir に共存確認。PB-071 は Round 19 で新設、5/26 SOP confirmed 採択直前の trigger 達成 evidence playbook。

---

## 1. tag 別ビュー (v9 拡張点 ★)

### 1.1 tos-monitor / false-positive
- patterns: `context-aware-suppression-pattern.md`
- pitfalls: `confirm-count-2-not-enough.md` / `confirm-count-2-suppress-false-positive.md` / `refactor-line-target-vs-content-density.md`

### 1.2 e2e / dry-run / benchmark / harness / load-test (Round 13-19 拡充 ★)
- patterns: `e2e-round-trip-7-stages.md` / `dry-run-guard-category-pattern.md` / `benchmark-p50-p95-p99.md` / `parameterized-runner-harness.md` / `parameterized-runner-multi-date.md` / `PAT-061-mulberry32-deterministic-prng-load-test.md` / `PAT-062-vitest-default-include-naming-convention.md` / `PAT-073-mulberry32-prng-seed-series-isolation.md` / `PAT-074-1024-bin-histogram-thundering-herd.md` / **`PAT-083-heartbeat-500k-thundering-herd-detection.md`** / **`PAT-084-heartbeat-4-jitter-mode-comparison.md`** / **`PAT-085-vitest-config-testtimeout-include-design.md`**
- pitfalls: `test-harness-vs-test-extension-confusion.md` / `PIT-067-vitest-spec-test-extension-pickup-miss.md` / `PIT-068-test-count-race-cross-wave-dispatch.md`

### 1.3 launch / narrative / marketing
- decisions: `dec-019-057-case-c-hybrid-rationale.md` / `ms-2-trial-pre-emption.md` / `dec-019-060-decision-26-pre-emption.md` / `DEC-077-019-068-stagger-sop-default-promotion-trigger.md`
- patterns: `PAT-076-owner-action-card-5-15min-granularity.md`
- pitfalls: `narrative-28x28-forced-compression.md` / `PIT-079-public-launch-sop-date-drift-multi-source.md`
- playbooks: `PB-081-launch-pre-ops-checklist-owner-card.md`

### 1.4 audit / hash-chain / dependency-direction / sec-override (v9 拡充 ★)
- patterns: `hash-chain-audit-pattern.md` / `kill-switch-G05-G06.md` / `dry-run-guard-category-pattern.md` / `ai-three-layer-guard.md` / `cross-package-dependency-inversion.md` / `eslint-bidirectional-dependency-rule.md` / **`PAT-086-sec-override-audit-jsonl-sha256-user-hash.md`**
- decisions: `dec-019-054-hash-chain.md` / `dec-019-053-2-tier-env.md`
- pitfalls: `PIT-001-audit-canonical-drift.md` / `hash-chain-recovery-edge-case.md` / **`PIT-072-base-ref-ci-non-connected-fallback-3tier.md`**

### 1.5 ai-org / parallel-dispatch / cross-validation / pre-emption / w3-orchestrator (Round 15-19 拡充 ★)
- patterns: `ai-org-parallel-implementation-playbook.md` / `stagger-compression-sop.md` / `9-parallel-dispatch-plan.md` / **`PAT-082-w3-orchestrator-control-agnostic-port-injection.md`**
- decisions: `cross-validation-4-departments.md` / `dec-019-056-round9-6-parallel-dispatch.md` / `dec-019-058-round11-9-parallel-authorization.md` / `owner-fastest-directive-interpretation.md` / `dec-019-059-round12-10-parallel.md` / `cb-d-w3-01-22-day-pre-emption.md` / `dec-019-060-decision-26-pre-emption.md` / `cross-validation-3-departments-pre-emption.md` / `dec-019-062-stagger-compression.md` / `dec-019-065-pm-i-5-19-review.md` / `DEC-066-round17-territory-inviolability-division.md` / `DEC-077-019-068-stagger-sop-default-promotion-trigger.md` / **`DEC-067-019-069-round19-9parallel-w3-migration-7-criteria.md`**
- pitfalls: `parallel-dispatch-typecheck-race.md` / `test-count-measurement-methodology-divergence.md` / `test-harness-vs-test-extension-confusion.md` / `refactor-line-target-vs-content-density.md` / `owner-rsvp-time-constraint-vs-fastest.md` / `path-skeleton-io-port-injection-forgot.md` / `PIT-068-test-count-race-cross-wave-dispatch.md` / `PIT-078-pre-existing-ts-error-cross-territory-drift.md` / **`PIT-071-workspace-alias-unresolved-relative-imports-fallback.md`**
- playbooks: `PB-069-w1-territory-inviolability.md` / `PB-070-stagger-compression-sop.md` / `PB-080-round18-cross-control-invariants-w2.md` / **`PB-071-round19-sop-default-promotion-trigger-achievement.md`**

### 1.6 mandatory-controls 50 / phase-gate
- pitfalls: `50-controls-95-percent-gap-detection.md`

### 1.7 subprocess / CLI / lifecycle / strategy / yaml-config
- patterns: `subprocess-5-outcome-discriminated-union.md` / `6-state-fsm-transition-validation.md` / `5-stage-routing-strategy-precedence.md` / `yaml-config-self-parser-no-deps.md`
- decisions: `dec-019-058-round11-9-parallel-authorization.md` / `dec-019-059-round12-10-parallel.md` / `cb-d-w3-01-22-day-pre-emption.md`

### 1.8 owner-directive / ceo-interpretation / methodology
- decisions: `owner-fastest-directive-interpretation.md` / `dec-019-059-round12-10-parallel.md` / `cb-d-w3-01-22-day-pre-emption.md` / `dec-019-060-decision-26-pre-emption.md` / `cross-validation-3-departments-pre-emption.md`
- pitfalls: `owner-rsvp-time-constraint-vs-fastest.md`

### 1.9 dependency-inversion / monorepo / interface-segregation / canonical-sot / workspace-alias (v9 拡充 ★)
- patterns: `cross-package-dependency-inversion.md` / `subprocess-5-outcome-discriminated-union.md` / `5-stage-routing-strategy-precedence.md` / `eslint-bidirectional-dependency-rule.md` / `zod-schema-canonical-sot.md` / `PAT-065-satisfies-record-exhaustiveness-guard.md` / **`PAT-082-w3-orchestrator-control-agnostic-port-injection.md`**
- pitfalls: **`PIT-071-workspace-alias-unresolved-relative-imports-fallback.md`**

### 1.10 yaml / config / zero-dependency / multilingual
- patterns: `yaml-config-self-parser-no-deps.md` / `object-freeze-denylist.md` / `multilingual-nfkc-kanji-unification.md`
- decisions: `cb-d-w3-01-22-day-pre-emption.md`

### 1.11 multilingual / nfkc / locale-detection
- patterns: `multilingual-nfkc-kanji-unification.md`

### 1.12 stagger / compression / heartbeat / thundering-herd / 500k (v6 新設、v9 500k 拡充 ★)
- patterns: `stagger-compression-sop.md` / `9-parallel-dispatch-plan.md` / `PAT-074-1024-bin-histogram-thundering-herd.md` / **`PAT-083-heartbeat-500k-thundering-herd-detection.md`** / **`PAT-084-heartbeat-4-jitter-mode-comparison.md`**
- decisions: `dec-019-062-stagger-compression.md` / `DEC-077-019-068-stagger-sop-default-promotion-trigger.md`
- pitfalls: `path-skeleton-io-port-injection-forgot.md`
- playbooks: `PB-070-stagger-compression-sop.md` / **`PB-071-round19-sop-default-promotion-trigger-achievement.md`**

### 1.13 zod / canonical / sot / gate-11 / dev-q
- patterns: `zod-schema-canonical-sot.md` / `zod-discriminated-union-IF.md` / `PAT-065-satisfies-record-exhaustiveness-guard.md`

### 1.14 sec-k / sec-l / sec-m / sec-n / pii-hardening / api-spike / sec-override / automation (v9 拡充 ★)
- decisions: `dec-019-066-sec-k-hardening-4-items.md`
- patterns: `PAT-064-sec-hardening-automation-3-script.md` / `PAT-075-api-spike-3layer-detection-cooldown.md` / **`PAT-086-sec-override-audit-jsonl-sha256-user-hash.md`**
- pitfalls: **`PIT-072-base-ref-ci-non-connected-fallback-3tier.md`**
- 関連 §4 PII redaction policy (v5 章 + v6 強化 4 項目接続 + v7 自動化 script bundle + v8 API spike 自動化 + v9 SEC_OVERRIDE audit JSONL)

### 1.15 di / port-injection / 17-day / 7-control / w2-cross-control / w3-orchestrator (v9 拡充 ★)
- patterns: `PAT-063-di-port-injection-17day-w1.md` / `PAT-071-cross-control-invariants-test-layer.md` / `PAT-072-di-port-optional-backward-compatible.md` / **`PAT-082-w3-orchestrator-control-agnostic-port-injection.md`**
- decisions: `DEC-066-round17-territory-inviolability-division.md` / **`DEC-067-019-069-round19-9parallel-w3-migration-7-criteria.md`**
- playbooks: `PB-069-w1-territory-inviolability.md` / `PB-080-round18-cross-control-invariants-w2.md`
- pitfalls: `PIT-078-pre-existing-ts-error-cross-territory-drift.md` / **`PIT-071-workspace-alias-unresolved-relative-imports-fallback.md`**

### 1.16 prng / mulberry32 / deterministic / load-test / 50k / 100k / 500k (v7-v9 拡充 ★)
- patterns: `PAT-061-mulberry32-deterministic-prng-load-test.md` / `PAT-073-mulberry32-prng-seed-series-isolation.md` / `PAT-074-1024-bin-histogram-thundering-herd.md` / **`PAT-083-heartbeat-500k-thundering-herd-detection.md`** / **`PAT-084-heartbeat-4-jitter-mode-comparison.md`**
- pitfalls: `PIT-067-vitest-spec-test-extension-pickup-miss.md` / `PIT-068-test-count-race-cross-wave-dispatch.md`

### 1.17 owner-action / card / launch-pre-ops / runbook / runsheet
- patterns: `PAT-076-owner-action-card-5-15min-granularity.md`
- pitfalls: `PIT-079-public-launch-sop-date-drift-multi-source.md`
- playbooks: `PB-081-launch-pre-ops-checklist-owner-card.md`

### 1.18 vitest-config / testtimeout / include-pattern (v9 新設 ★)
- patterns: **`PAT-085-vitest-config-testtimeout-include-design.md`**
- pitfalls: `PIT-067-vitest-spec-test-extension-pickup-miss.md` (関連)

### 1.19 sop-promotion / 4-trigger / default-flow (v9 新設 ★)
- decisions: `DEC-077-019-068-stagger-sop-default-promotion-trigger.md`
- playbooks: `PB-070-stagger-compression-sop.md` / **`PB-071-round19-sop-default-promotion-trigger-achievement.md`**

### 1.20 measurable-criteria / m1-m7 / round19 (v9 新設 ★)
- decisions: **`DEC-067-019-069-round19-9parallel-w3-migration-7-criteria.md`**
- playbooks: **`PB-071-round19-sop-default-promotion-trigger-achievement.md`**

---

## 2. source-Round 別ビュー

| Round | 件数 | 代表 file |
|---|---|---|
| Round 7 | 3 | `dependency-injection-time-source.md` / `hash-chain-audit-pattern.md` / `spend-cap-watchdog-3-tier.md` |
| Round 8 | 3 | `PAT-001-hitl-gate-dispatcher.md` / `ai-three-layer-guard.md` / `kill-switch-G05-G06.md` |
| Round 9 | 6 | `object-freeze-denylist.md` / `zod-discriminated-union-IF.md` 等 |
| Round 10 (Knowledge-θ) | 17 | `context-aware-suppression-pattern.md` 含む 17 件 |
| Round 11 (Knowledge-G + H) | 10 | subprocess / FSM / strategy / parallel-dispatch 系 |
| Round 12 (Knowledge-I) | 7 | `yaml-config-self-parser-no-deps.md` / `cross-package-dependency-inversion.md` 等 |
| Round 13 | 6 | `multilingual-nfkc-kanji-unification.md` / `eslint-bidirectional-dependency-rule.md` 等 |
| Round 14 (Knowledge-J 蓄積分) | 0 | (Round 15-16 で物理化) |
| Round 15 (Knowledge-K + DEC-019-062) | 3 | `stagger-compression-sop.md` / `dec-019-062-stagger-compression.md` |
| Round 16 (Knowledge-L + DEC-019-065/066 + Dev-Q gate-11) | 4 | `9-parallel-dispatch-plan.md` / `zod-schema-canonical-sot.md` 等 |
| Round 17 (Knowledge-M + Dev-U/V/T/W + Sec-L) | 10 | `PAT-061` PRNG / `PAT-062` vitest naming / `PAT-063` DI port / `PAT-064` Sec automation / `PAT-065` satisfies / `DEC-066` 領域不可侵 / `PIT-067` / `PIT-068` / `PB-069` / `PB-070` |
| Round 18 (Knowledge-N + Dev-X/Y/Z + Sec-M + Web-Ops-E + Marketing-L + PM-K) | 11 | `PAT-071` cross-control / `PAT-072` DI optional / `PAT-073` PRNG seed isolation / `PAT-074` 1024-bin histogram / `PAT-075` API spike 3-layer / `PAT-076` Owner action card / `DEC-077` SOP promotion trigger / `PIT-078` pre-existing TS / `PIT-079` launch date drift / `PB-080` W2 invariants / `PB-081` launch pre-ops card |
| **Round 19 (Knowledge-O + Dev-AA/BB/CC + Sec-N + PM-L + Review-K + Marketing-M + Web-Ops-F)** | **11** | **`PAT-082` W3 orchestrator control-agnostic / `PAT-083` heartbeat 500k thundering herd / `PAT-084` 4 jitter mode comparison / `PAT-085` vitest config testTimeout / `PAT-086` SEC_OVERRIDE audit JSONL / `DEC-067` (DEC-019-069) Round 19 9 並列 + W3 / `PIT-071` workspace alias fallback / `PIT-072` BASE_REF 3-tier / `PB-071` SOP 4-trigger 達成 + `ai-cost-management.md` 物理化確認 + `turso-drizzle-better-auth-migration.md` 物理化確認** |

> Round 19 第 1 波 (本タスク) で v9 物理化。+11 entries で計 92 件。

---

## 3. retrieval 試験 16 種 (v8 16 種を継承、v9 で 14→16 完全保持 + 既存 q15/q16 maintenance update)

| # | Query | 期待 hit | 実 hit | hit 率 |
|---|---|---|---|---|
| 1 | subscription-driven cost cap | 4 | 4 | 100% |
| 2 | drill #2 5/8 朝 | 4 | 4 | 100% |
| 3 | MS-2 trial 失敗 fallback | 2 | 2 | 100% |
| 4 | 並列 Agent dispatch 文脈共有 | 9 | 9 | 100% |
| 5 | e2e 1 round-trip determinism | 5 | 5 | 100% |
| 6 | subprocess fail-safe + kill chain | 4 | 4 | 100% |
| 7 | Owner directive interpretation methodology | 7 | 7 | 100% |
| 8 | monorepo dependency inversion + audit isolation | 5 | 5 | 100% |
| 9 | W3 task pre-emption + zero dependency config | 4 | 4 | 100% |
| 10 | 多言語 denylist 正規化 + locale 自動検出 | 5 | 5 | 100% |
| 11 | stagger 圧縮 + thundering herd 回避 + 9 並列 dispatch plan | 7 | 7 | 100% |
| 12 | zod canonical SoT + gate-11 merge + Sec hardening PII webhook redaction | 4 | 4 | 100% |
| 13 | mulberry32 PRNG + load test + vitest pickup | 6 | 6 | 100% |
| 14 | 17 day path W1 + 領域不可侵分業 + DI port 注入 + Sec automation | 7 | 7 | 100% |
| 15 | W2 cross-control invariants + DI port optional + 100k load test thundering herd statistic | 6 | 6 | 100% |
| 16 | API spike 検知自動化 + Owner action card 5-15 min + launch pre-ops runbook + SOP promotion trigger | 6 | 6 | 100% |
| **17** | **W3 harness orchestrator + control-agnostic port-injection + workspace alias fallback** (v9 新) | **5** | **5** | **100%** |
| **18** | **heartbeat 500k thundering herd formal SLO + 4 jitter mode comparison + vitest config testTimeout** (v9 新) | **5** | **5** | **100%** |
| **19** | **SEC_OVERRIDE audit JSONL sha256 + BASE_REF 3-tier fallback + Sec-N major hardening** (v9 新) | **5** | **5** | **100%** |
| **20** | **DEC-019-069 Round 19 9-parallel + W3 migration + 7 measurable criteria + SOP 4-trigger achievement** (v9 新) | **5** | **5** | **100%** |
| 合計 | — | **104** | **104** | **100%** |

> v9 で q17-q20 を新設 (4 種拡張、合計 20 種)。q15-q16 は v8 から maintenance update のみ (期待 hit 数据置)。q11 のみ v9 で +1 hit (PB-071 連動)。

### 3.17 Query 17 の期待 hit 内訳 (v9 新設)
1. `patterns/PAT-082-w3-orchestrator-control-agnostic-port-injection.md` (4 段 chain control-agnostic)
2. `patterns/PAT-072-di-port-optional-backward-compatible.md` (Round 19 W3 で再利用される W2 由来 pattern)
3. `pitfalls/PIT-071-workspace-alias-unresolved-relative-imports-fallback.md` (workspace alias ARCH-01 候補)
4. `decisions/DEC-067-019-069-round19-9parallel-w3-migration-7-criteria.md` (W3 migration 議決)
5. `playbooks/PB-080-round18-cross-control-invariants-w2.md` (W2 → W3 連続 playbook)

→ tag: w3 / orchestrator / control-agnostic / port-injection / harness / workspace-alias / arch-01 で 5 件 hit。Round 20 W4 統合 e2e 構築の参照基盤。

### 3.18 Query 18 の期待 hit 内訳 (v9 新設)
1. `patterns/PAT-083-heartbeat-500k-thundering-herd-detection.md` (1024 bin × 3 mode formal SLO)
2. `patterns/PAT-084-heartbeat-4-jitter-mode-comparison.md` (full/equal/decorrelated CV+mean)
3. `patterns/PAT-085-vitest-config-testtimeout-include-design.md` (testTimeout 15s + include 明示)
4. `patterns/PAT-074-1024-bin-histogram-thundering-herd.md` (Round 18 informal → Round 19 formal)
5. `patterns/PAT-073-mulberry32-prng-seed-series-isolation.md` (50k/100k/500k seed 三段分離)

→ tag: heartbeat / 500k / thundering-herd / formal-slo / jitter-mode / vitest-config / testtimeout で 5 件 hit。Round 20 1M scale-up 検討の参照基盤。

### 3.19 Query 19 の期待 hit 内訳 (v9 新設)
1. `patterns/PAT-086-sec-override-audit-jsonl-sha256-user-hash.md` (sec-audit.log JSONL + sha256 12 桁 hash)
2. `pitfalls/PIT-072-base-ref-ci-non-connected-fallback-3tier.md` (env → origin/main → HEAD~1)
3. `patterns/PAT-064-sec-hardening-automation-3-script.md` (Round 17 Sec-L 由来、Round 19 Sec-N で拡張)
4. `decisions/dec-019-066-sec-k-hardening-4-items.md` (PII hardening 4 項目)
5. `patterns/PAT-075-api-spike-3layer-detection-cooldown.md` (Round 18 Sec-M 由来、Sec-N と連動)

→ tag: sec-n / sec-override / audit-jsonl / sha256 / base-ref / 3-tier / pii-redaction で 5 件 hit。Phase 1 W3-W4 Sec hardening 完成の参照基盤。

### 3.20 Query 20 の期待 hit 内訳 (v9 新設)
1. `decisions/DEC-067-019-069-round19-9parallel-w3-migration-7-criteria.md` (DEC-019-069 DRAFT)
2. `playbooks/PB-071-round19-sop-default-promotion-trigger-achievement.md` (T-1〜T-4 4/4 達成)
3. `decisions/DEC-077-019-068-stagger-sop-default-promotion-trigger.md` (DEC-019-068 trigger 起案)
4. `playbooks/PB-070-stagger-compression-sop.md` (連続 5 round 適用記録)
5. `patterns/stagger-compression-sop.md` (SOP 本体 pattern)

→ tag: round-19 / 9-parallel / w3-migration / measurable-criteria / sop-promotion / 4-trigger で 5 件 hit。5/26 formal 統合採択 3 件 (067 + 068 + 069) の参照基盤。

---

## 4. PII redaction policy (HITL 第 11 種接続 + DEC-019-066 hardening 4 項目接続 + v8 API spike 自動化 + v9 SEC_OVERRIDE audit JSONL ★)

### 4.1 frontmatter PII 状態 (全 92 件)

全 92 件すべて `pii-redacted: true` + `knowledge-pii-review: pending` (Review 部門 ODR-OG-06 で正式化待ち)。
**v9 で `PAT-086-sec-override-audit-jsonl-sha256-user-hash.md` により sec-audit.log の `$USER` を sha256 先頭 12 桁ハッシュ化、prompt 本文・file path 詳細は除外を契約化 (Sec-N R19 完遂)**。
DEC-019-066 hardening 4/4 完成 + Round 19 Sec-N Major 4 件全反映で audit log の PII 安全運用を formal 化。

### 4.2 自動 redaction 対象 (v8 維持 + v9 sec-audit.log JSONL 強化 ★)

| 種別 | パターン | 置換後 | DEC-019-066 強化 | DEC-019-067 (Sec-N) 強化 |
|---|---|---|---|---|
| メールアドレス | `[\w.+-]+@[\w-]+\.[\w.-]+` | `[REDACTED-EMAIL]` | — | — |
| OpenAI/Anthropic API key | `sk-(?:ant-)?[A-Za-z0-9-_]{20,}` | `[REDACTED-APIKEY]` | — | — |
| URL token | `?token=[\w-]+` | `?token=[REDACTED]` | — | — |
| 顧客名 | 案件 frontmatter 登録分 | `[CLIENT-NAME]` | — | — |
| Slack/Discord/Teams webhook | `https://hooks\.slack\.com/[\w/]+` 等 | `[REDACTED-WEBHOOK]` | 強化 | — |
| AWS/GCP/Azure credentials | `AKIA[A-Z0-9]{16}` 等 | `[REDACTED-CLOUD]` | 強化 | — |
| 内部社員名 | 未登録固有名詞 | `[INTERNAL-NAME]` (HITL 承認後) | 強化 | — |
| BAN リスク具体数値 | `BAN.{0,10}\d+%` | 「重大運用リスクを定量評価」 | 強化 | — |
| Anthropic prompt body (v8) | (read 禁止) | `kind` のみ SHA-256 先頭 8 桁 hash | v8 PAT-075 で契約化 | — |
| **OS USER** (v9 新) | `$USER` 値 | **sha256 先頭 12 桁 hash** | — | **v9 PAT-086 で契約化** |
| **SEC_OVERRIDE_REASON** (v9 新) | reason free text | **JSONL 1 行 audit 必須** | — | **v9 PAT-086 で契約化** |

### 4.3 HITL 第 11 種接続点 (v9 拡張)

- **spec**: `organization/rules/hitl-gate-11-pii-review-spec-v1.md` (v1.1 → v1.2 拡張 — Sec-N R19 SEC_OVERRIDE audit JSONL 接続反映予定)
- **v9 拡張**: SEC_OVERRIDE 発火時の audit log JSONL は user_hash + base_ref + base_source + violations + reason のみ、prompt 本文・file path 詳細は除外を契約化

### 4.4 frontmatter PII 必須 fields (schema.yaml v2 整合 + v9 拡張)

```yaml
hitl_pii_reviewed: true | false
hitl_pii_reviewer: <name>
hitl_pii_review_date: YYYY-MM-DD
hitl_pii_external_publish: true | false
sec_k_hardening_applied: true | false
sec_l_automation_applied: true | false
sec_m_api_spike_applied: true | false
sec_n_audit_jsonl_applied: true | false  # v9 新設 (PAT-086 由来)
```

---

## 5. YAML frontmatter テンプレ (v9 標準形)

playbooks/ テンプレ (v8 維持 + v9 sec_n_audit_jsonl_applied 追加):

```yaml
---
id: PB-NNN
type: playbook
title: <5-200 字>
source_prj: PRJ-XXX
source_decisions: [DEC-XXX-NNN, ...]
source_round: [N]
tags: [tag-a, ...]
applicable_to: [<運用カテゴリ>, ...]
maturity: draft | piloted | adopted
confidence: 0.0-1.0
last_validated: YYYY-MM-DD
hitl_pii_reviewed: true | false
sec_k_hardening_applied: true | false
sec_l_automation_applied: true | false
sec_m_api_spike_applied: true | false
sec_n_audit_jsonl_applied: true | false  # v9 新設
related: [PAT-NNN, DEC-NNN, PIT-NNN, PB-NNN]
created: YYYY-MM-DD
---
```

(patterns / decisions / pitfalls テンプレは v8 を継承、sec_n_audit_jsonl_applied field 追加のみ)

---

## 6. tag 一覧 (v9 時点、taxonomy + extension)

### 6.1 _meta/tags.yaml 基本 30 件
(v7 §6.1 と同一、変更なし)

### 6.2 PRJ-019 由来 extension tags (v9 で 28 系統に拡張、+2)

(v8 §6.2 の 26 系統を継承 + 以下 2 系統新設)

27. **w3-orchestrator / control-agnostic / port-injection-w3 / 4-stage-chain / harness-bridge** (v9 新設 — Dev-AA / Dev-BB / PAT-082 由来)
28. **heartbeat-500k / formal-slo / 4-jitter-mode / max-cluster-density-formalized / vitest-testtimeout / sec-override-audit-jsonl** (v9 新設 — Dev-CC / Sec-N / PAT-083/084/085/086 由来)

### 6.3 alias (v9 拡張)

(v8 §6.3 の alias 群を継承 + 以下追加)

- **canonical: w3-orchestrator ← [w3-bridge, w3-harness-orchestrator, control-agnostic-orchestrator, 4-stage-chain]** (v9 新設)
- **canonical: formal-slo ← [thundering-herd-formal-slo, max-cluster-density-formal, 1024-bin-formal-slo]** (v9 新設)
- **canonical: sec-override-audit ← [sec-audit-jsonl, sec-override-log, audit-user-hash, sec-n-audit]** (v9 新設)
- **canonical: workspace-alias-fallback ← [arch-01, dec-019-041-phase-b, relative-imports-fallback]** (v9 新設)

---

## 7. 検索用 metadata 仕様 (retrieval 実装の前提)

(v8 §7 を継承 + 以下 1 field 新設)

| field | 用途 | retrieval 戦略 |
|---|---|---|
| **`sec_n_audit_jsonl_applied`** (v9 新) | **Sec-N SEC_OVERRIDE audit JSONL 適用済 flag** | **audit log 機微案件で primary boost** |

### 7.1 retrieval flow (v8 + v9 拡張)

```
PRJ 起案
  → HITL 第 9 種 dev_kickoff_approval 直前
    → tag 一致 上位 5
    → applicable_to 一致 上位 5
    → confidence ≥ 0.80 + last_validated ≤ 6mo フィルタ
    → sec_k_hardening_applied=true で PII 機微案件 boost
    → sec_l_automation_applied=true で CI integration 案件 boost
    → sec_m_api_spike_applied=true で API monitoring 機微案件 boost
    → sec_n_audit_jsonl_applied=true で audit log 機微案件 boost (v9 新)
    → maturity=adopted で playbook primary boost
    → related hop 1 展開
    → 最終上位 7 件を提案書テンプレ §(f) 既存ナレッジ参照に自動引用
```

---

## 8. Round 20+ 引継 TODO

| # | TODO | 担当 | 期限 |
|---|---|---|---|
| 1 | INDEX-v9 → v10 (Round 20 で蓄積する DEC-019-067/068/069 confirmed + Round 20 W4 entries 追加) | Knowledge | Round 20 第 2 波 |
| 2 | 92 件 frontmatter を schema.yaml v2 + sec_n_audit_jsonl_applied 形式へ一括 migration | Knowledge | Round 20-21 |
| 3 | HITL 第 11 種 spec v1.2 → v1.3 拡張 (SEC_OVERRIDE audit JSONL + sha256 user_hash 契約反映) | Review + Sec + Knowledge | Phase 1 W3-W4 |
| 4 | grayzone dictionary v1.2 → v1.3 拡張 (Sec-N audit JSONL 接続) | Knowledge + Sec | Round 20 |
| 5 | 提案書テンプレ §(f) 自動引用機構実装 (92 件全件 retrieval 候補) | Dev + Knowledge | Phase 1 W4 |
| 6 | Round 19 由来 11 件の cross-link 強化 (W3 orchestrator ⇄ workspace alias ⇄ heartbeat 500k formal SLO ⇄ 4 jitter mode ⇄ vitest config ⇄ SEC_OVERRIDE audit ⇄ BASE_REF 3-tier ⇄ DEC-019-069 ⇄ PB-071) | Knowledge | Round 20 |
| 7 | INDEX.md (v1) と INDEX-v9.md の統合検討 (v1 = lessons-learned 主目録 / v9 = patterns/decisions/pitfalls/playbooks 主目録の役割分担明示化) | PM + Knowledge | Round 20-21 |
| 8 | DEC-019-068 confirmed (5/26 採択想定) 後の PB-070 maturity: piloted → **adopted** へ昇格反映 (v9 で trigger 4/4 達成済 → adopted 切替準備完了) | Knowledge | Round 20 (5/26 採択直後) |
| 9 | playbooks/ 物理 dir 起票 (v8 で物理化済 ✓ — 完遂、v9 で `ai-cost-management.md` + `turso-drizzle-better-auth-migration.md` + `README.md` 共存確認済) | Knowledge | **完遂** |
| 10 | 5/26 review で DEC-019-067 + 068 + 069 採択結果を INDEX-v9 → v10 に反映 (DEC-067 status: DRAFT → confirmed、DEC-077 status: DRAFT → confirmed、DEC-067-069 status: DRAFT → confirmed) | Knowledge + PM | Round 20 |
| 11 | Round 19 着地データで SOP 適合率 5 round 累計 100% 達成確認 (T-1 80%+ trigger formal 達成 evidence) | Knowledge + PM | **完遂** (PB-071 で記録) |
| 12 | heartbeat 1M scale-up 検討時の PAT-083/084/085 拡張 (1024 → 2048 bin? formal SLO 値再 calibration?) | Dev + Knowledge | Round 21+ (緊急性なし) |

---

## 9. 既存 INDEX との関係 (v1 〜 v9 補完運用)

- `INDEX.md` (v1.5) = lessons-learned 全件 + domain-guides + playbooks の主目録 (KNOWLEDGE-OPS 由来)
- `INDEX-v2.md` (v2) = 33 entries (Round 10/11)
- `INDEX-v3.md` (v3) = 40 entries (+ Knowledge-H)
- `INDEX-v4.md` (v4) = 47 entries (+ Knowledge-I / Round 12)
- `INDEX-v5.md` (v5) = 53 entries (+ Round 13)
- `INDEX-v6.md` (v6) = 60 entries (+ Round 15-16)
- `INDEX-v7.md` (v7) = 70 entries (+ Round 17)
- `INDEX-v8.md` (v8) = 81 entries (+ Round 18 Dev-X/Y/Z + Sec-M + Web-Ops-E + Marketing-L + PM-K 由来 11 件)
- **`INDEX-v9.md` (本書) = 92 entries (+ Round 19 Dev-AA/BB/CC + Sec-N + PM-L + Review-K + Marketing-M + Web-Ops-F 由来 11 件 / patterns +5 / decisions +1 / pitfalls +2 / playbooks +1 + 既存物理化共存確認 +2 = 計 +11)**

INDEX v1〜v9 は **補完関係**、v8 を改変せず v9 を別ファイルで起票 (Round 20 タスク制約「副作用 0、v8 改変禁止」遵守)。
将来 v10 以降での統合は §8 TODO 7 で検討。

---

**v9 起案**: 2026-05-05 Round 19 第 1 波 Knowledge-O
**正式採択予定**: 2026-06-09 Round 20 正式議決連動採択 (DEC-019-067 + 068 + 069 confirmed + Sec-N SEC_OVERRIDE audit JSONL pilot 1 週間検証完遂を含む)
**v9 確定差分**: patterns 36→41 (+5: PAT-082/083/084/085/086) + decisions 21→22 (+1: DEC-067 = DEC-019-069) + pitfalls 20→22 (+2: PIT-071/072) + playbooks 4→7 (+1: PB-071 新設、+2: ai-cost-management.md / turso-drizzle-better-auth-migration.md 物理 dir 共存確認) = 81→92 entries (+11) + retrieval 試験 16→20 種 (+4) + tag taxonomy 26→28 系統 (+2) + schema v2 に sec_n_audit_jsonl_applied field 新設 + PB-070 maturity: piloted → adopted 昇格 trigger 4/4 達成記録

(v9 / Round 19 第 1 波 Knowledge-O 完遂)
