---
tags: [index, retrieval, knowledge-mining, prj-019, round14, round15, round16, round17, round18]
index-version: v7
source-PRJ: PRJ-019
source-DEC: [DEC-019-033, DEC-019-056, DEC-019-057, DEC-019-058, DEC-019-059, DEC-019-060, DEC-019-061, DEC-019-062, DEC-019-065, DEC-019-066]
source-Round: [10, 11, 12, 13, 14, 15, 16, 17]
created: 2026-05-05
pii-redacted: true
knowledge-pii-review: pending
supersedes: INDEX-v6.md (補完運用、v6 は historical baseline として保持)
---

# Knowledge Retrieval Index v7

PRJ-019 Round 17 第 1 波（heartbeat 50k load test 実装 / Hitl11WebhookKindSchema zod canonical 拡張 / 17 day path W1 7 control 完成 / Sec hardening 自動化 3 script + 3 SOP）で蓄積された Knowledge ナレッジを集約した v7 index。
INDEX-v6（60 entries）→ **INDEX-v7（70 entries）** に拡張、Round 17 由来追加 10 件（patterns +5 / decisions +1 / pitfalls +2 / playbooks +2 → 計 +10）反映。
DEC-019-033 で確立した 3 サブディレクトリ構造（YAML frontmatter + tag 付け + PRJ-XXX 由来明示）に準拠、`_meta/schema.yaml` v2 + `_meta/tags.yaml` taxonomy と整合。
playbooks サブディレクトリは v7 で論理的に新設（領域不可侵分業 + stagger 圧縮 SOP 連続適用）。物理 dir 起票は Round 18 で別途検討（§8 TODO 9）。

## 0. ファイル全件一覧（patterns 30 + decisions 20 + pitfalls 18 + playbooks 2 = 70 件）

### 0.1 patterns/（30 件、Round 7-17）

| title | file path | tags（抜粋） | source-DEC | source-Round | 1 行 summary |
|---|---|---|---|---|---|
| HITL Gate Dispatcher | `patterns/PAT-001-hitl-gate-dispatcher.md` | hitl, dispatcher, gate | DEC-019-007 | 8 | HITL 11 種を gate dispatcher で集中管理 |
| AI Org Parallel Implementation Playbook | `patterns/ai-org-parallel-implementation-playbook.md` | ai-org, parallel-dispatch | DEC-019-025, DEC-019-056 | 9, 10 | 並列 Agent dispatch 実装規約 |
| AI Three Layer Guard | `patterns/ai-three-layer-guard.md` | guard, three-layer | DEC-019-007 | 8 | AI 暴走の 3 層防御（cap / kill / audit） |
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
| Multilingual NFKC + Kanji Unification | `patterns/multilingual-nfkc-kanji-unification.md` | nfkc, multilingual, kanji-unification, denylist | DEC-019-010, DEC-019-025, DEC-019-053, DEC-019-055, DEC-019-058, DEC-019-059 | 13 | NFKC + 中文/韓/日 35 ペア統一辞書 + locale 自動検出を 1 module 集約 |
| ESLint Bidirectional Dependency Rule | `patterns/eslint-bidirectional-dependency-rule.md` | eslint, dependency-direction, lint-as-architecture | DEC-019-007, DEC-019-008, DEC-019-025, DEC-019-053, DEC-019-054, DEC-019-058, DEC-019-059 | 13 | `no-restricted-imports` 双方向設定で循環/逆 import を CI 検出 |
| Parameterized Runner Multi-Date | `patterns/parameterized-runner-multi-date.md` | test-harness, multi-date, drill-2, cli-arg, 5-candidate-dates | DEC-019-006, DEC-019-007, DEC-019-025, DEC-019-051, DEC-019-053〜DEC-019-059 | 13 | `--date YYYY-MM-DD` で 5 候補日切替 drill #2 1-shot 実機 harness |
| Stagger Compression SOP | `patterns/stagger-compression-sop.md` | stagger, compression, parallel-dispatch, sop | DEC-019-062, DEC-019-061, DEC-019-059 | 15 | 9 並列 dispatch 時の stagger 起動間隔を 90s→45s に圧縮しつつ thundering herd 回避する SOP |
| 9-Parallel Dispatch Plan | `patterns/9-parallel-dispatch-plan.md` | parallel-dispatch, 9-parallel, plan, round-16 | DEC-019-065, DEC-019-062, DEC-019-061 | 16 | Round 16 で確立した 9 並列 dispatch の wave 設計 + I/O port 注入 + audit isolation 統合プラン |
| Zod Schema Canonical SoT | `patterns/zod-schema-canonical-sot.md` | zod, canonical, sot, gate-11, dev-q | DEC-019-066, DEC-019-065, DEC-019-058 | 16 | gate-11 merge 経由で zod schema を canonical SoT 化、IF 重複定義を contract test で防止 |
| **Mulberry32 Deterministic PRNG for Load Test** | `patterns/PAT-061-mulberry32-deterministic-prng-load-test.md` | prng, mulberry32, deterministic, load-test, side-effect-zero, 50k | DEC-019-025, DEC-019-049, DEC-019-062 | **17** | **50k 件 load test で seedrandom 依存追加 0、Math.random() 排除、8 桁再現性担保の決定論 PRNG 内製 pattern** |
| **Vitest Default Include Naming Convention** | `patterns/PAT-062-vitest-default-include-naming-convention.md` | vitest, file-extension, test-naming, include-pattern, harness | DEC-019-025, DEC-019-062 | **17** | **vitest config 不在 harness で `.test.ts` 命名統一による pickup 確実化、`.spec.ts` 命名混在の副作用防止 pattern** |
| **DI Port Injection 17-Day W1 7-Control** | `patterns/PAT-063-di-port-injection-17day-w1.md` | di, port-injection, 17-day, w1, 7-control, side-effect-zero | DEC-019-058, DEC-019-062, DEC-019-065 | **17** | **C-OC-03/04 + P-UI-02/04/05/09 + HITL-10 の 7 control を fetcher / notifier / killer / signer / approver port 注入で副作用 0 設計に統一する pattern** |
| **Sec Hardening Automation 3-Script Bundle** | `patterns/PAT-064-sec-hardening-automation-3-script.md` | sec-hardening, automation, side-effect-zero, emoji-zero, tests-pass-gate, bash | DEC-019-066 | **17** | **副作用 0 / 絵文字 0 / tests PASS gate を bash + git plumbing + perl + node 1 行で外部依存 0 自動化する 3-script bundle pattern** |
| **satisfies Record Exhaustiveness Guard** | `patterns/PAT-065-satisfies-record-exhaustiveness-guard.md` | typescript, satisfies, exhaustiveness, zod, canonical-sot, kindToIdPrefix | DEC-019-066, DEC-019-065 | **17** | **`satisfies Record<KnowledgeKind, string>` で zod enum 拡張時のコンパイル時漏れ検知を保証する pattern（kindToIdPrefix 由来）** |

### 0.2 decisions/（20 件、Round 9-17）

| title | file path | tags（抜粋） | source-DEC | source-Round | 1 行 summary |
|---|---|---|---|---|---|
| Privilege Escalation 4 Layers | `decisions/DEC-001-priviledge-escalation-4-layers.md` | DEC-001, authz | DEC-001 | — | 4 layer 権限昇格モデル |
| Cross Validation 4 Departments | `decisions/cross-validation-4-departments.md` | cross-validation, organization-design | DEC-019-025, DEC-019-056, DEC-019-057 | 9, 10 | 4 部署独立収斂を最重要意思決定シグナルに昇格 |
| DEC-019-010 13-Domain Rationale | `decisions/dec-019-010-13-domain-rationale.md` | DEC-019-010, denylist | DEC-019-010 | 9 | 13 領域 denylist の根拠 |
| DEC-019-050 Spend Cap $30 | `decisions/dec-019-050-spend-cap-30usd.md` | DEC-019-050, spend-cap | DEC-019-050 | 8 | Anthropic API cap $30 採択経緯 |
| DEC-019-052 NG-3 Plan B 16h/$100 | `decisions/dec-019-052-NG3-plan-B-16h-100usd.md` | DEC-019-052, NG-3 | DEC-019-052 | 8 | NG-3 暫定値 plan B 採択 |
| DEC-019-053 2-Tier Env | `decisions/dec-019-053-2-tier-env.md` | DEC-019-053, env, 2-tier | DEC-019-053 | 8 | dev / prod 2-tier 環境分離 |
| DEC-019-054 Hash Chain | `decisions/dec-019-054-hash-chain.md` | DEC-019-054, hash-chain | DEC-019-054 | 7 | audit hash chain 採択 |
| DEC-019-056 Round 9 6-Parallel Dispatch | `decisions/dec-019-056-round9-6-parallel-dispatch.md` | DEC-019-056, parallel-dispatch | DEC-019-056, DEC-019-055, DEC-019-033 | 9, 10 | Round 9 6 並列 + 5/22 朝公開前倒し |
| DEC-019-057 Case C Hybrid Rationale | `decisions/dec-019-057-case-c-hybrid-rationale.md` | DEC-019-057, case-c-hybrid | DEC-019-057, DEC-019-052, DEC-019-056 | 10 | 5/22 内部運用着手 + 6/27 朝公開維持 二段階 |
| MS-2 Trial Pre-Emption | `decisions/ms-2-trial-pre-emption.md` | milestone, trial-run, pre-emption | DEC-019-057, DEC-019-056 | 10 | 公式 MS 7 日前に trial 投入で確度押上 |
| DEC-019-058 Round 11 9-Parallel Authorization | `decisions/dec-019-058-round11-9-parallel-authorization.md` | DEC-019-058, 9-parallel | DEC-019-058, DEC-019-057, DEC-019-056 | 11 | Round 11 9 並列 dispatch + W3 中核 22 日前倒し |
| Owner Fastest Directive Interpretation | `decisions/owner-fastest-directive-interpretation.md` | owner-directive, ceo-interpretation, methodology | DEC-019-058, DEC-019-057, DEC-019-056 | 9, 10, 11 | Owner「最速」を「選択肢 A 採用」へ converting する CEO 解釈方法論 |
| DEC-019-059 Round 12 10-Parallel + 5/22 Push | `decisions/dec-019-059-round12-10-parallel.md` | DEC-019-059, 10-parallel, 5-22-push-evaluation | DEC-019-059, DEC-019-058, DEC-019-057 | 12 | Round 12 10 並列 + W3-W4 中核 22-30 日前倒し |
| CB-D-W3-01 22-Day Pre-Emption | `decisions/cb-d-w3-01-22-day-pre-emption.md` | pre-emption, w3-w0, 22-day-shift, dependency-zero | DEC-019-010, DEC-019-058, DEC-019-059 | 12 | denylist YAML 化を W3→W0 で 22 日前倒し採択 |
| DEC-019-060 Decision-26 Pre-Emption | `decisions/dec-019-060-decision-26-pre-emption.md` | DEC-019-060, decision-26, pre-emption, 4-candidate-dates | DEC-019-007〜DEC-019-059 | 13 | 議決-26 を 4 候補日（5/5〜5/8）前倒し可否評価 + CEO 推奨 5/6 朝採決 |
| Cross-Validation 3 Departments Pre-Emption | `decisions/cross-validation-3-departments-pre-emption.md` | cross-validation, 3-departments, pm-f, review-e, sec-h, decision-26 | DEC-019-025, DEC-019-057, DEC-019-058, DEC-019-059, DEC-019-060 | 13 | PM-F + Review-E + Sec-H 3 部署独立収斂を議決前倒し意思決定シグナルに昇格 |
| DEC-019-062 Stagger Compression Adoption | `decisions/dec-019-062-stagger-compression.md` | DEC-019-062, stagger, compression, round-15 | DEC-019-062, DEC-019-061, DEC-019-059 | 15 | stagger 90s→45s 圧縮 + thundering herd 回避策（heartbeat jitter）採択 |
| DEC-019-065 PM-I 5/19 Review | `decisions/dec-019-065-pm-i-5-19-review.md` | DEC-019-065, pm-i, 5-19-review, round-16 | DEC-019-065, DEC-019-062, DEC-019-061 | 16 | PM-I 起案、5/19 朝レビューで 9 並列 dispatch plan 確定 |
| DEC-019-066 Sec-K Hardening 4 Items | `decisions/dec-019-066-sec-k-hardening-4-items.md` | DEC-019-066, sec-k, pii-hardening, 5-26-review | DEC-019-066, DEC-019-033, DEC-019-065 | 16 | Sec-K 起案、5/26 朝レビューで PII redaction 4 項目強化（webhook / cloud / 内部名 / BAN 婉曲化） |
| **Round 17 Territory Inviolability Division** | `decisions/DEC-066-round17-territory-inviolability-division.md` | round-17, territory-inviolability, dev-t, dev-w, parallel-dispatch, file-isolation | DEC-019-062, DEC-019-065, DEC-019-066 | **17** | **9 並列 dispatch 時に Dev-T (3 control) と Dev-W (4 control) で領域不可侵分業を採択し、共有 test ファイル 2 ケース最小編集ルールで競合 0 化** |

### 0.3 pitfalls/（18 件、Round 9-17）

| title | file path | tags（抜粋） | source-DEC | source-Round | severity | 1 行 summary |
|---|---|---|---|---|---|---|
| 13-Domain Denylist 49-Gap Detection | `pitfalls/13-domain-denylist-49-gap-detection.md` | denylist, gap-detection | DEC-019-010 | 9 | medium | needs-scout 49 ギャップの検出方法 |
| 50 Controls 95% Gap Detection | `pitfalls/50-controls-95-percent-gap-detection.md` | mandatory-controls, 95-percent-threshold | DEC-019-007〜056 | 10 | high | 50 軸 64% → 95% 押上の PENDING R7 見落とし |
| Audit Canonical Drift | `pitfalls/PIT-001-audit-canonical-drift.md` | audit, canonical, drift | DEC-019-054 | 9 | high | audit log の canonical 化ずれ |
| GitHub Actions Secret + pnpm Workspace | `pitfalls/PIT-002-github-actions-secret-naming-and-pnpm-workspace.md` | ci, secret, pnpm-workspace | DEC-019-053 | — | medium | secret 命名 + pnpm workspace 落とし穴 |
| Confirm Count 2 Not Enough | `pitfalls/confirm-count-2-not-enough.md` | tos-monitor, false-positive | DEC-019-008, DEC-019-050〜056 | 9, 10 | medium | 持続 spike 系は confirmCount を上げても抑止不可 |
| Confirm Count 2 Suppress False Positive | `pitfalls/confirm-count-2-suppress-false-positive.md` | false-positive, debounce | DEC-019-008, DEC-019-052 | 9 | low | confirmCount=2 の限界 |
| Hash Chain Recovery Edge Case | `pitfalls/hash-chain-recovery-edge-case.md` | hash-chain, recovery | DEC-019-054 | 9 | high | audit hash chain 復旧時の edge case |
| Narrative 28x28 Forced Compression | `pitfalls/narrative-28x28-forced-compression.md` | marketing, narrative | DEC-019-052, DEC-019-056, DEC-019-057 | 10 | medium | 公開前倒し圧縮で品質劣化 |
| verbatimModuleSyntax + Vitest ESM | `pitfalls/verbatimModuleSyntax-vitest-ESM.md` | typescript, vitest, esm | — | — | low | verbatimModuleSyntax と vitest ESM 互換性 |
| Web Budget Guard server-only | `pitfalls/web-budget-guard-server-only.md` | budget-guard, server-only | DEC-019-050 | — | medium | server-only import 解決失敗 |
| Parallel Dispatch Typecheck Race | `pitfalls/parallel-dispatch-typecheck-race.md` | parallel-dispatch, typecheck, race-condition | DEC-019-025, DEC-019-058 | 11 | medium | 9 並列で in-progress な subprocess.ts を別 Agent が typecheck で検出 |
| Test Count Measurement Methodology Divergence | `pitfalls/test-count-measurement-methodology-divergence.md` | test-count, measurement, vitest | DEC-019-025, DEC-019-058 | 11 | low | Dev-C 614 vs Dev-D 507 vs CEO 614 の測定方法論差異 |
| Test Harness vs Test Extension Confusion | `pitfalls/test-harness-vs-test-extension-confusion.md` | test-harness, file-extension, vitest-config | DEC-019-025, DEC-019-058, DEC-019-059 | 12 | medium | `.harness.ts` 拡張子で auto-run 除外する pattern の落とし穴 |
| Refactor Line Target vs Content Density | `pitfalls/refactor-line-target-vs-content-density.md` | refactor, line-target, content-density | DEC-019-008, DEC-019-025, DEC-019-058, DEC-019-059 | 12 | medium | 「行数削減 KPI」と「content density」が競合する設計上のジレンマ |
| Owner RSVP Time Constraint vs Fastest | `pitfalls/owner-rsvp-time-constraint-vs-fastest.md` | owner-directive, rsvp-constraint, fastest-directive, pre-emption-limit, decision-26 | DEC-019-025, DEC-019-057, DEC-019-058, DEC-019-059, DEC-019-060 | 13 | high | 「最速」directive を時刻ベースのみで解釈し RSVP 物理拘束を見落とす落とし穴 |
| Path Skeleton I/O Port Injection Forgot | `pitfalls/path-skeleton-io-port-injection-forgot.md` | path-skeleton, io-port, injection, 17-day, round-15 | DEC-019-062, DEC-019-061, DEC-019-058 | 15 | high | 17 日 path skeleton 段階で I/O port 注入を忘れ、後段 wave で type error 連鎖 |
| **Vitest Spec-Test Extension Pickup Miss** | `pitfalls/PIT-067-vitest-spec-test-extension-pickup-miss.md` | vitest, file-extension, spec-vs-test, default-include, pickup-miss, no-test-files-found | DEC-019-025, DEC-019-062 | **17** | **medium** | **vitest default include は `.test.ts` のみ pickup、`.spec.ts.todo` の `.todo` 剥がし時に `.spec.ts` 命名で「No test files found」となる落とし穴** |
| **Test Count Race Cross-Wave Dispatch** | `pitfalls/PIT-068-test-count-race-cross-wave-dispatch.md` | parallel-dispatch, test-count, race, cross-wave, baseline-drift | DEC-019-025, DEC-019-062, DEC-019-065 | **17** | **low** | **9 並列波で baseline 607 + Dev-U 10 = 617 想定が実測 621 に乖離、並走 Dev エージェントが heartbeat-gap-primitive.test.ts に +4 件追加していた baseline drift 落とし穴** |

### 0.4 playbooks/（2 件、Round 17 新設）★

| title | file path | tags（抜粋） | source-DEC | source-Round | 1 行 summary |
|---|---|---|---|---|---|
| **17-Day Path W1 Territory Inviolability Playbook** | `playbooks/PB-069-17day-path-w1-territory-inviolability.md` | playbook, 17-day, w1, territory-inviolability, dev-t-dev-w, file-isolation | DEC-019-062, DEC-019-065 | **17** | **17 日 path W1 期で 7 control を Dev-T (C-OC-03/04 + P-UI-04) と Dev-W (P-UI-02/05/09 + HITL-10) に分担、共有 test 2 ケース最小編集ルールで領域不可侵を達成する playbook** |
| **Stagger Compression SOP 連続適用 Playbook** | `playbooks/PB-070-stagger-compression-sop-continuous-application.md` | playbook, stagger, compression, sop, continuous-application, round-15-16-17 | DEC-019-062, DEC-019-065, DEC-019-066 | **17** | **DEC-019-062 で確立した stagger 90s→45s 圧縮 SOP を Round 15 → 16 → 17 で連続 3 round 適用、heartbeat jitter + 9 並列 wave 設計と組合せた累積運用 playbook** |

> **注**: heartbeat retry の thundering herd は patterns/stagger-compression-sop.md で「予防 SOP」として正の形で吸収済み。playbooks/ サブディレクトリは v7 で論理新設。物理 dir 起票は Round 18 で別途検討（§8 TODO 9）、当面は patterns/ 配下に併設保管も許容。

---

## 1. tag 別ビュー（v7 拡張点 ★）

### 1.1 tos-monitor / false-positive
- patterns: `context-aware-suppression-pattern.md`
- pitfalls: `confirm-count-2-not-enough.md` / `confirm-count-2-suppress-false-positive.md` / `refactor-line-target-vs-content-density.md`

### 1.2 e2e / dry-run / benchmark / harness（Round 13-17 拡充）
- patterns: `e2e-round-trip-7-stages.md` / `dry-run-guard-category-pattern.md` / `benchmark-p50-p95-p99.md` / `parameterized-runner-harness.md` / `parameterized-runner-multi-date.md` / **`PAT-061-mulberry32-deterministic-prng-load-test.md`** / **`PAT-062-vitest-default-include-naming-convention.md`**
- pitfalls: `test-harness-vs-test-extension-confusion.md` / **`PIT-067-vitest-spec-test-extension-pickup-miss.md`** / **`PIT-068-test-count-race-cross-wave-dispatch.md`**

### 1.3 launch / narrative / marketing
- decisions: `dec-019-057-case-c-hybrid-rationale.md` / `ms-2-trial-pre-emption.md` / `dec-019-060-decision-26-pre-emption.md`
- pitfalls: `narrative-28x28-forced-compression.md`

### 1.4 audit / hash-chain / dependency-direction
- patterns: `hash-chain-audit-pattern.md` / `kill-switch-G05-G06.md` / `dry-run-guard-category-pattern.md` / `ai-three-layer-guard.md` / `cross-package-dependency-inversion.md` / `eslint-bidirectional-dependency-rule.md`
- decisions: `dec-019-054-hash-chain.md` / `dec-019-053-2-tier-env.md`
- pitfalls: `PIT-001-audit-canonical-drift.md` / `hash-chain-recovery-edge-case.md`

### 1.5 ai-org / parallel-dispatch / cross-validation / pre-emption（Round 15-17 拡充 ★）
- patterns: `ai-org-parallel-implementation-playbook.md` / `stagger-compression-sop.md` / `9-parallel-dispatch-plan.md`
- decisions: `cross-validation-4-departments.md` / `dec-019-056-round9-6-parallel-dispatch.md` / `dec-019-058-round11-9-parallel-authorization.md` / `owner-fastest-directive-interpretation.md` / `dec-019-059-round12-10-parallel.md` / `cb-d-w3-01-22-day-pre-emption.md` / `dec-019-060-decision-26-pre-emption.md` / `cross-validation-3-departments-pre-emption.md` / `dec-019-062-stagger-compression.md` / `dec-019-065-pm-i-5-19-review.md` / **`DEC-066-round17-territory-inviolability-division.md`**
- pitfalls: `parallel-dispatch-typecheck-race.md` / `test-count-measurement-methodology-divergence.md` / `test-harness-vs-test-extension-confusion.md` / `refactor-line-target-vs-content-density.md` / `owner-rsvp-time-constraint-vs-fastest.md` / `path-skeleton-io-port-injection-forgot.md` / **`PIT-068-test-count-race-cross-wave-dispatch.md`**
- playbooks: **`PB-069-17day-path-w1-territory-inviolability.md`** / **`PB-070-stagger-compression-sop-continuous-application.md`**

### 1.6 mandatory-controls 50 / phase-gate
- pitfalls: `50-controls-95-percent-gap-detection.md`

### 1.7 subprocess / CLI / lifecycle / strategy / yaml-config
- patterns: `subprocess-5-outcome-discriminated-union.md` / `6-state-fsm-transition-validation.md` / `5-stage-routing-strategy-precedence.md` / `yaml-config-self-parser-no-deps.md`
- decisions: `dec-019-058-round11-9-parallel-authorization.md` / `dec-019-059-round12-10-parallel.md` / `cb-d-w3-01-22-day-pre-emption.md`

### 1.8 owner-directive / ceo-interpretation / methodology
- decisions: `owner-fastest-directive-interpretation.md` / `dec-019-059-round12-10-parallel.md` / `cb-d-w3-01-22-day-pre-emption.md` / `dec-019-060-decision-26-pre-emption.md` / `cross-validation-3-departments-pre-emption.md`
- pitfalls: `owner-rsvp-time-constraint-vs-fastest.md`

### 1.9 dependency-inversion / monorepo / interface-segregation / canonical-sot（v6-v7 拡充 ★）
- patterns: `cross-package-dependency-inversion.md` / `subprocess-5-outcome-discriminated-union.md` / `5-stage-routing-strategy-precedence.md` / `eslint-bidirectional-dependency-rule.md` / `zod-schema-canonical-sot.md` / **`PAT-065-satisfies-record-exhaustiveness-guard.md`**

### 1.10 yaml / config / zero-dependency / multilingual
- patterns: `yaml-config-self-parser-no-deps.md` / `object-freeze-denylist.md` / `multilingual-nfkc-kanji-unification.md`
- decisions: `cb-d-w3-01-22-day-pre-emption.md`

### 1.11 multilingual / nfkc / locale-detection
- patterns: `multilingual-nfkc-kanji-unification.md`

### 1.12 stagger / compression / heartbeat / thundering-herd（v6 新設、v7 playbook 追加 ★）
- patterns: `stagger-compression-sop.md` / `9-parallel-dispatch-plan.md`
- decisions: `dec-019-062-stagger-compression.md`
- pitfalls: `path-skeleton-io-port-injection-forgot.md`
- playbooks: **`PB-070-stagger-compression-sop-continuous-application.md`**

### 1.13 zod / canonical / sot / gate-11 / dev-q（v6 新設、v7 拡充 ★）
- patterns: `zod-schema-canonical-sot.md` / `zod-discriminated-union-IF.md` / **`PAT-065-satisfies-record-exhaustiveness-guard.md`**

### 1.14 sec-k / pii-hardening / sec-l / automation（v6-v7 拡充 ★）
- decisions: `dec-019-066-sec-k-hardening-4-items.md`
- patterns: **`PAT-064-sec-hardening-automation-3-script.md`**
- 関連 §4 PII redaction policy（v5 章 + v6 強化 4 項目接続 + v7 自動化 script bundle）

### 1.15 di / port-injection / 17-day / 7-control（v7 新設 ★）
- patterns: **`PAT-063-di-port-injection-17day-w1.md`**
- decisions: **`DEC-066-round17-territory-inviolability-division.md`**
- playbooks: **`PB-069-17day-path-w1-territory-inviolability.md`**

### 1.16 prng / mulberry32 / deterministic / load-test / 50k（v7 新設 ★）
- patterns: **`PAT-061-mulberry32-deterministic-prng-load-test.md`**
- pitfalls: **`PIT-067-vitest-spec-test-extension-pickup-miss.md`** / **`PIT-068-test-count-race-cross-wave-dispatch.md`**

---

## 2. source-Round 別ビュー

| Round | 件数 | 代表 file |
|---|---|---|
| Round 7 | 3 | `dependency-injection-time-source.md` / `hash-chain-audit-pattern.md` / `spend-cap-watchdog-3-tier.md` |
| Round 8 | 3 | `PAT-001-hitl-gate-dispatcher.md` / `ai-three-layer-guard.md` / `kill-switch-G05-G06.md` |
| Round 9 | 6 | `object-freeze-denylist.md` / `zod-discriminated-union-IF.md` / `13-domain-denylist-49-gap-detection.md` 等 |
| Round 10 (Knowledge-θ) | 17 | `context-aware-suppression-pattern.md` 含む 17 件 |
| Round 11 (Knowledge-G + H) | 10 | subprocess / FSM / strategy / parallel-dispatch 系 |
| Round 12 (Knowledge-I) | 7 | `yaml-config-self-parser-no-deps.md` / `cross-package-dependency-inversion.md` 等 |
| Round 13 | 6 | `multilingual-nfkc-kanji-unification.md` / `eslint-bidirectional-dependency-rule.md` / `parameterized-runner-multi-date.md` / `dec-019-060-decision-26-pre-emption.md` / `cross-validation-3-departments-pre-emption.md` / `owner-rsvp-time-constraint-vs-fastest.md` |
| Round 14 (Knowledge-J 蓄積分) | 0（Round 15-16 で物理化） | — |
| Round 15 (Knowledge-K + DEC-019-062) | 3 | `stagger-compression-sop.md` / `dec-019-062-stagger-compression.md` / `path-skeleton-io-port-injection-forgot.md` |
| Round 16 (Knowledge-L + DEC-019-065/066 + Dev-Q gate-11) | 4 | `9-parallel-dispatch-plan.md` / `zod-schema-canonical-sot.md` / `dec-019-065-pm-i-5-19-review.md` / `dec-019-066-sec-k-hardening-4-items.md` |
| **Round 17 (Knowledge-M + Dev-U/V/T/W + Sec-L)** | **10** | **`PAT-061` PRNG / `PAT-062` vitest naming / `PAT-063` DI port / `PAT-064` Sec automation / `PAT-065` satisfies / `DEC-066` 領域不可侵 / `PIT-067` spec-test pickup miss / `PIT-068` test count race / `PB-069` W1 playbook / `PB-070` stagger SOP 連続適用** |

> Round 17 第 1 波（本タスク）で v7 物理化。+10 entries で計 70 件。

---

## 3. retrieval 試験 14 種（v6 12 種 + v7 で +2 種拡張）

実用的検索 query で v7 retrieval 精度を検証する 14 件。

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
| 10 | 多言語 denylist 正規化 + locale 自動検出 + 議決前倒し RSVP 拘束 | 5 | 5 | 100% |
| 11 | stagger 圧縮 + thundering herd 回避 + 9 並列 dispatch plan | 5 | 5 | 100% |
| 12 | zod canonical SoT + gate-11 merge + Sec hardening PII webhook redaction | 4 | 4 | 100% |
| **13** | **mulberry32 PRNG + 50k load test + 副作用 0 + vitest pickup**（v7 新） | **5** | **5** | **100%** |
| **14** | **17 day path W1 + 領域不可侵分業 + DI port 注入 + Sec automation 3-script**（v7 新） | **6** | **6** | **100%** |
| 合計 | — | **69** | **69** | **100%** |

### 3.13 Query 13 の期待 hit 内訳（v7 新設）
1. `patterns/PAT-061-mulberry32-deterministic-prng-load-test.md`（mulberry32 PRNG 内製 + Math.random 排除）
2. `patterns/PAT-062-vitest-default-include-naming-convention.md`（vitest pickup 命名統一）
3. `pitfalls/PIT-067-vitest-spec-test-extension-pickup-miss.md`（`.spec.ts` pickup miss）
4. `pitfalls/PIT-068-test-count-race-cross-wave-dispatch.md`（並走波 baseline drift）
5. INDEX-v7 §0.1（Round 17 由来 PRNG / vitest naming patterns）

→ tag: prng / mulberry32 / deterministic / load-test / 50k / vitest / file-extension で 5 件 hit。Round 18+ load test 横展開の参照基盤。

### 3.14 Query 14 の期待 hit 内訳（v7 新設）
1. `patterns/PAT-063-di-port-injection-17day-w1.md`（7 control DI port 注入 pattern）
2. `decisions/DEC-066-round17-territory-inviolability-division.md`（領域不可侵分業採択）
3. `playbooks/PB-069-17day-path-w1-territory-inviolability.md`（W1 領域不可侵 playbook）
4. `patterns/PAT-064-sec-hardening-automation-3-script.md`（Sec automation 3-script bundle）
5. `playbooks/PB-070-stagger-compression-sop-continuous-application.md`（stagger SOP 連続適用）
6. `patterns/PAT-065-satisfies-record-exhaustiveness-guard.md`（satisfies guard / kindToIdPrefix 由来）

→ tag: di / port-injection / 17-day / w1 / 7-control / territory-inviolability / sec-hardening / automation / 3-script / continuous-application で 6 件 hit。Phase 1 W2-W4 統合 e2e 構築の参照基盤。

---

## 4. PII redaction policy（HITL 第 11 種接続 + DEC-019-066 hardening 4 項目接続 + v7 自動化）

### 4.1 frontmatter PII 状態（全 70 件）

全 70 件すべて `pii-redacted: true` + `knowledge-pii-review: pending`（Review 部門 ODR-OG-06 で正式化待ち）。
PII / 顧客情報 / API キーは抽出時に自動 redaction、HITL 第 11 種 `knowledge_pii_review` で人間チェック可。
**v7 で `PAT-064-sec-hardening-automation-3-script.md` により絵文字 0 / 副作用 0 / tests PASS gate を bash 自動化（DEC-019-066 §3.2-3.4 を formal 化）**。
**v6 で接続済の DEC-019-066 hardening 4 項目** は維持（§4.2 表）、5/26 formal review で項目 1 (API spike) も含めた 4 項目同時採択予定。

### 4.2 自動 redaction 対象（README §2.1 準拠 + DEC-019-066 強化、v6 維持）

| 種別 | パターン | 置換後 | DEC-019-066 強化 |
|---|---|---|---|
| メールアドレス | `[\w.+-]+@[\w-]+\.[\w.-]+` | `[REDACTED-EMAIL]` | — |
| OpenAI/Anthropic API key | `sk-(?:ant-)?[A-Za-z0-9-_]{20,}` | `[REDACTED-APIKEY]` | — |
| URL token | `?token=[\w-]+` | `?token=[REDACTED]` | — |
| 顧客名 | 案件 frontmatter 登録分 | `[CLIENT-NAME]` | — |
| Slack/Discord/Teams webhook | `https://hooks\.slack\.com/[\w/]+` 等 | `[REDACTED-WEBHOOK]` | 強化（Discord/Teams 追加） |
| AWS/GCP/Azure credentials | `AKIA[A-Z0-9]{16}` 等 | `[REDACTED-CLOUD]` | 強化（Azure SAS / GCP SA key 追加） |
| 内部社員名 | 未登録固有名詞 | `[INTERNAL-NAME]`（HITL 承認後） | 強化（gray-zone v1.1 で 50 → 80 件 expand） |
| BAN リスク具体数値 | `BAN.{0,10}\d+%` | 「重大運用リスクを定量評価」（婉曲化） | 強化（数値範囲 + 文脈一致 regex 追加） |

### 4.3 HITL 第 11 種接続点（v6 維持）

- **spec**: `organization/rules/hitl-gate-11-pii-review-spec-v1.md`（Round 13 確定 v1.0 → Round 17 v1.1 拡張中）
- **grayzone dictionary**: `organization/rules/pii-grayzone-dictionary-v1.md`（Round 13 確定 v1.0 → Round 17 v1.1 拡張中）
- **起動点**: redaction 適用後、Write 前
- **判断者**: Owner（CEO 経由）/ Marketing 補助 / Review 監査 / Sec 部門 cross-check（DEC-019-066）
- **判断粒度**: approve / reject / partial
- **SLA**: 3 営業日（DEC-019-033 §② 既定）
- **reject 時**: `organization/knowledge/.pending-pii/` に隔離、再 redaction 後再申請。3 回 reject で「公開不能」フラグ
- **v7 拡張**: Sec-L 自動化 3 script で絵文字 0 / 副作用 0 / tests PASS gate を CI 統合検討（Round 18 第 1 波）

### 4.4 frontmatter PII 必須 fields（schema.yaml v2 整合、v6 維持）

```yaml
hitl_pii_reviewed: true | false
hitl_pii_reviewer: <name>
hitl_pii_review_date: YYYY-MM-DD
hitl_pii_external_publish: true | false
sec_k_hardening_applied: true | false
sec_l_automation_applied: true | false  # v7 新設（PAT-064 由来）
```

> 現 70 件は v4-v6 期に `pii-redacted: true` / `knowledge-pii-review: pending` 形式で蓄積。schema v2 + sec_k_hardening_applied + sec_l_automation_applied への一括 migration は Round 18-19 Knowledge 部門 backlog（後述 §8 TODO 1）。

---

## 5. YAML frontmatter テンプレ（v7 標準形 / schema.yaml v2 + sec_k_hardening + sec_l_automation 準拠）

### 5.1 patterns/ テンプレ

```yaml
---
id: PAT-NNN
type: pattern
title: <5-200 字>
source_prj: PRJ-XXX
source_decisions: [DEC-XXX-NNN, ...]
source_round: [N, N+1]
tags: [tag-a, tag-b, ...]
applicable_to: [<案件カテゴリ>, ...]
non_applicable_to: [<案件カテゴリ>, ...]
category: architecture | code | ui
confidence: 0.0-1.0
last_validated: YYYY-MM-DD
hitl_pii_reviewed: true | false
hitl_pii_reviewer: <name>
hitl_pii_review_date: YYYY-MM-DD
sec_k_hardening_applied: true | false
sec_l_automation_applied: true | false  # v7 新設
related: [PAT-NNN, DEC-NNN, PIT-NNN, PB-NNN]
created: YYYY-MM-DD
pii-redacted: true | false
---
```

### 5.2 decisions/ テンプレ

```yaml
---
id: DEC-NNN
type: adr
title: <5-200 字>
source_prj: PRJ-XXX
source_dec: DEC-XXX-NNN
source_round: [N]
tags: [tag-a, ...]
status: adopted | superseded | deprecated
superseded_by: DEC-NNN | null
supersedes: [DEC-NNN, ...]
confidence: 0.0-1.0
last_validated: YYYY-MM-DD
hitl_pii_reviewed: true | false
sec_k_hardening_applied: true | false
sec_l_automation_applied: true | false  # v7 新設
related: [...]
created: YYYY-MM-DD
---
```

### 5.3 pitfalls/ テンプレ

```yaml
---
id: PIT-NNN
type: anti-pattern | operational | security
title: <5-200 字>
source_prj: PRJ-XXX
source_decisions: [DEC-XXX-NNN, ...]
source_round: [N]
tags: [tag-a, ...]
severity: critical | high | medium | low
confidence: 0.0-1.0
last_validated: YYYY-MM-DD
hitl_pii_reviewed: true | false
hitl_pii_external_publish: true | false
sec_k_hardening_applied: true | false
sec_l_automation_applied: true | false  # v7 新設
related: [...]
created: YYYY-MM-DD
---
```

### 5.4 playbooks/ テンプレ（v7 新設）

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
related: [PAT-NNN, DEC-NNN, PIT-NNN, PB-NNN]
created: YYYY-MM-DD
---
```

---

## 6. tag 一覧（v7 時点、taxonomy + extension）

### 6.1 _meta/tags.yaml 基本 30 件
tech-stack: nextjs / tauri / expo / react-native / supabase / vercel / typescript
risk: security-risk / tos-violation / ban-risk / data-leak / dependency-risk
cost: cost-cap / free-tier / paid-plan-trigger
hitl: owner-in-the-loop / hitl-gate / dispatcher / escalation
observability: audit-log / dashboard / monitoring / changelog-monitor
compliance: acceptable-use / license-compliance / data-retention
（共通）: harness / permission-boundary / canonicalization / mock-first

### 6.2 PRJ-019 由来 extension tags（v7 で 22 系統に拡張、+4）
1. parallel-dispatch / cross-validation / 3-departments / 4-departments / 9-parallel / 10-parallel
2. owner-directive / fastest-directive / option-a-adoption / ceo-interpretation / methodology
3. pre-emption / w3-w0 / 22-day-shift / decision-26 / 4-candidate-dates / 5-candidate-dates
4. tos-monitor / context-aware-suppression / confirm-count
5. drill-2 / dry-run / real-spawn-toggle / scenario-matrix
6. spend-cap / watchdog / three-tier / DEC-019-050
7. denylist / 13-domain / object-freeze / yaml-config / zero-dependency
8. subprocess / fail-safe / kill-chain / G-05 / G-06 / fsm / lifecycle
9. dependency-inversion / cross-package / monorepo / interface-segregation / pid-guard
10. nfkc / multilingual / kanji-unification / locale-detection
11. eslint / dependency-direction / lint-as-architecture / harness-notify
12. test-harness / file-extension / vitest-config / auto-run / multi-date
13. refactor / line-target / content-density / kpi-design
14. rsvp-constraint / pre-emption-limit / time-budget / physical-constraint
15. audit-isolation / hash-chain / canonical / immutable
16. stagger / compression / heartbeat-jitter / thundering-herd / 90s-to-45s
17. zod-canonical-sot / gate-11 / dev-q / contract-test / if-deduplication
18. sec-k / pii-hardening / webhook-redaction / cloud-cred-strengthen / internal-name-escape / ban-cipher
19. **prng / mulberry32 / deterministic / load-test / 50k / 8-digit-reproducibility**（v7 新設）
20. **vitest-pickup / spec-vs-test / default-include / naming-convention / no-test-files-found**（v7 新設）
21. **di / port-injection / 17-day / w1 / 7-control / territory-inviolability / file-isolation**（v7 新設）
22. **sec-l / sec-automation / 3-script-bundle / side-effect-zero / emoji-zero / tests-pass-gate / continuous-application**（v7 新設）

### 6.3 alias（_meta/tags.yaml §aliases）
- canonical: hitl-gate ← [hitl, human-in-the-loop, owner-loop-gate]
- canonical: changelog-monitor ← [issue-monitor, upstream-watch]
- canonical: tos-violation ← [tos-bypass, aup-violation]
- canonical: cost-cap ← [budget-cap, monthly-budget]
- canonical: stagger ← [stagger-window, dispatch-stagger, parallel-stagger]
- canonical: zod-canonical-sot ← [zod-sot, schema-sot, single-source-truth-zod]
- **canonical: territory-inviolability ← [file-isolation, area-no-overlap, dispatch-no-overlap]**（v7 新設）
- **canonical: prng ← [pseudo-random, deterministic-rng, mulberry32-family]**（v7 新設）
- **canonical: vitest-pickup ← [vitest-include, test-file-discovery, default-include]**（v7 新設）

---

## 7. 検索用 metadata 仕様（retrieval 実装の前提）

| field | 用途 | retrieval 戦略 |
|---|---|---|
| `tags` | 主検索キー、kebab-case | tag 一致 → 上位 5 |
| `applicable_to` | 案件カテゴリ整合 | applicable_to 一致 → 上位 5 |
| `confidence` | 自信度 0.0-1.0 | 0.80 以上で primary、未満は補助候補 |
| `last_validated` | 鮮度 | 6 ヶ月以内のみ primary |
| `source_dec` / `source_decisions` | 上位決裁参照 | 提案書 §(b) 一致で boost |
| `source_round` | 起源 Round | 直近 Round ほど priority |
| `related` | 双方向リンク | hit 候補の隣接展開（hop 1） |
| `severity` (pitfalls) | 危険度 | high/critical を提案書 §(d) リスク欄に必ず引用 |
| `status` (decisions) | 採否 | adopted のみ primary、superseded は履歴参照 |
| `maturity` (playbooks) | 成熟度 | adopted > piloted > draft で primary boost（v7 新） |
| `sec_k_hardening_applied` (v6) | Sec-K hardening 適用済 flag | PII 機微案件で primary boost |
| **`sec_l_automation_applied`** (v7 新) | **Sec-L 自動化適用済 flag** | **CI integration 案件で primary boost** |

### 7.1 retrieval flow（README §1 + 本 §7 統合）

```
PRJ 起案
  → HITL 第 9 種 dev_kickoff_approval 直前
    → tag 一致（taxonomy + extension）上位 5
    → applicable_to 一致 上位 5
    → confidence ≥ 0.80 + last_validated ≤ 6mo フィルタ
    → sec_k_hardening_applied=true で PII 機微案件 boost
    → sec_l_automation_applied=true で CI integration 案件 boost（v7 新）
    → maturity=adopted で playbook primary boost（v7 新）
    → related hop 1 展開
    → 最終上位 7 件を提案書テンプレ §(f) 既存ナレッジ参照に自動引用
```

実装基盤: Phase 1 W4 で pgvector or Postgres FTS（Dev 部門評価中、X2 残課題）。
W4 完成までは `tags.yaml` ベースのキーワード grep + 本 INDEX-v7.md table 直引き。

---

## 8. Round 18+ 引継 TODO

| # | TODO | 担当 | 期限 |
|---|---|---|---|
| 1 | INDEX-v7 → v8（Round 18 で蓄積する DEC-019-067〜070 関連 entries 追加 + Phase 1 W2-W4 物理化反映） | Knowledge | Round 18 第 2 波 |
| 2 | 70 件 frontmatter を schema.yaml v2 + sec_k_hardening_applied + sec_l_automation_applied 形式へ一括 migration | Knowledge | Round 18-19 |
| 3 | HITL 第 11 種 spec v1.0 → v1.1 拡張（DEC-019-066 hardening 4 項目反映 + Sec-L automation 3 script 接続） | Review + Sec + Knowledge | Phase 1 W2 |
| 4 | grayzone dictionary v1.0 → v1.1 拡張（内部社員名 50→80 expand） | Knowledge + Sec | Round 18 |
| 5 | 提案書テンプレ §(f) 自動引用機構実装（70 件全件を retrieval 候補） | Dev + Knowledge | Phase 1 W4 |
| 6 | Round 15-17 由来 17 件の cross-link 強化（stagger SOP ⇄ 9 並列 plan ⇄ path skeleton I/O pitfall ⇄ zod canonical SoT ⇄ Sec-K hardening ⇄ Sec-L automation ⇄ DI port 17-day ⇄ 領域不可侵 playbook） | Knowledge | Round 18 |
| 7 | INDEX.md（v1）と INDEX-v7.md の統合検討（v1 = lessons-learned 主目録 / v7 = patterns/decisions/pitfalls/playbooks 主目録の役割分担明示化） | PM + Knowledge | Round 19 |
| 8 | Round 17 第 2 波で thundering herd pitfall を独立 entry 化検討（v6-v7 では SOP 内吸収、独立化の必要性は heartbeat retry 実装 telemetry で判断） | Knowledge + Dev | Round 18 |
| 9 | playbooks/ サブディレクトリの物理 dir 起票検討（v7 で論理新設、`organization/knowledge/playbooks/` の物理 dir 作成と 2 件 file 物理化） | Knowledge | Round 18 |
| 10 | API spike 検知本実装の Knowledge 反映（Sec-M 担当 / Round 18 第 1 波予定 / DEC-019-066 §3.1 完納時 entry 追加） | Sec + Knowledge | Round 18-19 |

---

## 9. 既存 INDEX との関係（v1 〜 v7 補完運用）

- `INDEX.md`（v1.5）= lessons-learned 全件 + domain-guides + playbooks の主目録（KNOWLEDGE-OPS 由来）
- `INDEX-v2.md`（v2）= 33 entries（Round 10/11 Knowledge-θ/G）
- `INDEX-v3.md`（v3）= 40 entries（+ Knowledge-H）
- `INDEX-v4.md`（v4）= 47 entries（+ Knowledge-I / Round 12）
- `INDEX-v5.md`（v5）= 53 entries（+ Round 13 Dev-A/B/C + Sec-H + PM-F + Review-E 由来 6 件）
- `INDEX-v6.md`（v6）= 60 entries（+ Round 15-16 Knowledge-K/L + DEC-019-062/065/066 + Dev-Q gate-11 由来 7 件）
- **`INDEX-v7.md`（本書）= 70 entries（+ Round 17 Dev-U/V/T/W + Sec-L 由来 10 件 / patterns +5 / decisions +1 / pitfalls +2 / playbooks +2）**

INDEX v1〜v7 は **補完関係**、v6 を改変せず v7 を別ファイルで起票（Round 18 タスク制約「副作用 0、v6 改変禁止」遵守）。
将来 v8 以降での統合は §8 TODO 7 で検討。

---

**v7 起案**: 2026-05-05 Round 18 第 1 波 Knowledge-M
**正式採択予定**: 2026-05-26 Phase 1 W2 議決-29 連動採択（Owner sign-off + Sec-L automation 3 script 検収を含む）
**v7 確定差分**: patterns 25→30（+5: PAT-061 mulberry32 PRNG / PAT-062 vitest naming / PAT-063 DI port 17-day / PAT-064 Sec automation 3-script / PAT-065 satisfies guard）+ decisions 19→20（+1: DEC-066 領域不可侵分業）+ pitfalls 16→18（+2: PIT-067 spec-test pickup miss / PIT-068 test count race）+ playbooks 0→2（+2: PB-069 W1 領域不可侵 / PB-070 stagger SOP 連続適用）= 60→70 entries（+10）+ retrieval 試験 12→14 種（+2: PRNG/load-test 13 / 17-day W1 全景 14）+ tag taxonomy 18→22 系統（+4: PRNG 19 / vitest-pickup 20 / DI 17-day 21 / sec-l 22）+ schema v2 に sec_l_automation_applied field 新設 + playbooks template 新設

(v7 / Round 18 第 1 波 Knowledge-M 完遂)
