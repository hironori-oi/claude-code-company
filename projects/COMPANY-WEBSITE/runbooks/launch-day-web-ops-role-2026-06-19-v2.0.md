# Runbook: 公開当日 Web-Ops 役割整理 v2.0 (2026-06-19)

**対象案件**: PRJ-019 Open Claw "Clawbridge"（公開 2026-06-19 09:00 JST）
**所有者**: Web-Ops 部門 / Round 22 Web-Ops-I 起票
**バージョン**: v2.0（Round 22 第 1 波 / Round 19 v1.0 = `launch-readiness-consolidation-2026-06-19.md` 130 行を承継）
**用途**: Round 22 までに整備された全 Web-Ops 担当 artifact（OWN-PRE 7 sub-card + OG preview validation + Vercel rollback + DNS / monitoring / RLS）を **1 表化**し、6/19 朝 06:00-12:00 JST の 6 hour で web-ops が担当する task 一覧 + Owner 連絡経路を定義する。

**前提**: Round 19 起票の `launch-readiness-consolidation-2026-06-19.md` は **無改変 single source of truth** として維持。本書 v2.0 は web-ops 役割に **特化** した派生版で、上位 consolidation を破壊しない。

---

## 0. v2.0 update 範囲（v1.0 からの差分）

v1.0（Round 19 = `launch-readiness-consolidation-2026-06-19.md`）= 全 artifact の単一索引（5 大領域 × Owner / CEO / Marketing / Web-Ops 共通）

v2.0（Round 22 = 本書）= **Web-Ops 担当のみ抽出**して時刻軸 task table に再構成 + Round 20-22 で増えた artifact（OWN-PRE 7 sub-card / OG preview validation runbook / Vercel rollback runbook / dry-run シミュレーション / OG preview execution procedure）を取り込み

両書は併存し、Owner / CEO は v1.0 を、Web-Ops オペレータは v2.0 を主参照とする運用分離。

---

## 1. Round 22 までに整備済み Web-Ops 担当 artifact（取り込み元 14 件）

| # | artifact path | Round | 役割 |
|---|---|---|---|
| 1 | `runbooks/launch-pre-ops-checklist.md` | R18 Web-Ops-E | env / DNS / CDN / monitoring / RLS / backup の事前設定全表 |
| 2 | `runbooks/owner-action-card-2026-06-19.md` | R18 Web-Ops-E | Owner 残動作 4 件（CARD A/B/C/D）|
| 3 | `runbooks/public-launch-sop.md` | R18 Web-Ops-E | 公開当日 SOP（Vercel Promote / smoke / 撤回 fallback）|
| 4 | `runbooks/cron-fallback-switch.md` | R18 Web-Ops-E | cron 5 本 fallback / heartbeat 500k SLO |
| 5 | `runbooks/slack-alert-routing.md` | R18 Web-Ops-E | Slack alert routing |
| 6 | `runbooks/og-image-production-spec-2026-06-27.md` | R19 Web-Ops-F | OG image 制作 spec |
| 7 | `runbooks/launch-readiness-consolidation-2026-06-19.md` | R19 Web-Ops-F | 全 artifact 単一索引 v1.0（本書 v2.0 の親）|
| 8 | `runbooks/owner-action-cards/INDEX.md` | R21 Web-Ops-H | OWN-PRE 7 sub-card 一望 |
| 9 | `runbooks/owner-action-cards/OWN-PRE-01〜07-*.md` | R21 Web-Ops-H | 7 sub-card 物理 file（各 72-76 行） |
| 10 | `runbooks/og-image-vercel-preview-validation-runbook.md` | R21 Web-Ops-H | OG preview validation spec（253 行） |
| 11 | `runbooks/public-launch-vercel-rollback-runbook-2026-06-19.md` | R21 Web-Ops-H | 30 秒 SLA rollback runbook（193 行） |
| 12 | `runbooks/owner-action-cards/OWN-PRE-DRY-RUN-2026-06-12.md` | R22 Web-Ops-I | OWN-PRE 7 sub-card dry-run シミュレーション（本日同時起票）|
| 13 | `runbooks/og-preview-validation-execution-procedure-2026-06-12.md` | R22 Web-Ops-I | OG preview validation 実行 procedure（本日同時起票）|
| 14 | `runbooks/launch-day-web-ops-role-2026-06-19-v2.0.md` | R22 Web-Ops-I | **本書** v2.0 役割整理 |

artifact 14 件全てを 6/19 当日に web-ops オペレータが活用する。

---

## 2. 6/19 朝 06:00-12:00 JST の 6 hour で web-ops が担当する 22 task 一覧

| # | 時刻 | task | 参照 artifact | Owner 連絡経路 | 所要 |
|---|---|---|---|---|---|
| W-01 | 06:00 | PC + Vercel Dashboard + Sentry + Supabase + Slack 全 dashboard 事前ログイン | - | - | 10 min |
| W-02 | 06:10 | Slack `#prj-019-launch` で「web-ops on-duty 06:10 JST」投稿 | - | Slack 投稿 | 1 min |
| W-03 | 06:15 | dry-run book §1-§7 / OG preview procedure §1-§14 を再読 | OWN-PRE-DRY-RUN / og-preview-validation-execution-procedure | - | 30 min |
| W-04 | 06:45 | Vercel Production deploy 前回 ID（PIN-A）を Slack pin 確認 | rollback runbook §2 | Slack pin 目視 | 5 min |
| W-05 | 06:50 | Sentry alert ルール Enabled 状態の最終確認（OWN-PRE-05 後段検証） | OWN-PRE-05 | Sentry Dashboard | 5 min |
| W-06 | 06:55 | Supabase RLS 状態最終確認（OWN-PRE-06 後段、抜き打ち 3 table）| OWN-PRE-06 | Supabase Dashboard | 10 min |
| W-07 | 07:05 | Cron 5 本 status 確認（heartbeat / og preview / sitemap revalidate / supabase backup ping / status report） | cron-fallback-switch.md | Vercel Cron Logs | 10 min |
| W-08 | 07:15 | Slack alert routing 動作確認（test alert を `#prj-019-alerts` に発火）| slack-alert-routing.md | Slack 投稿 | 5 min |
| W-09 | 07:20 | DNS TTL 300 秒 維持確認（`dig` 2 レコード）| OWN-PRE-03 | terminal | 5 min |
| W-10 | 07:25 | OG preview baseline sha256 と production deploy 直前 OG response の事前比較（fast-path check） | og-preview-validation-execution-procedure §5 | terminal | 15 min |
| W-11 | 07:40 | Owner DM「web-ops 全 readiness green、08:30 OWN-PRE-07 待機」 | - | Slack DM to Owner | 2 min |
| W-12 | 07:42 | T-2h 以降の monitoring 体制を CEO に Slack 投稿で共有 | - | Slack `#prj-019-launch` | 3 min |
| W-13 | 08:00 | Owner が OWN-PRE-07 着手前のリハーサル支援（Supabase 事前ログイン確認） | OWN-PRE-07 §4 | Slack thread | 5 min |
| W-14 | 08:25-08:35 | Owner OWN-PRE-07 実行を伴走（snapshot ID pin の ack 返信） | OWN-PRE-07 §5 step 8 | Slack ack | 10 min |
| W-15 | 08:35 | snapshot ID を Vercel rollback runbook §2 PIN として確認 / Web-Ops 内部 memo 化 | rollback runbook §2 | Slack pin 確認 | 3 min |
| W-16 | 08:45 | Owner「GO 発声」を待機しつつ smoke test の事前準備（curl コマンド history 整理）| public-launch-sop.md | - | 10 min |
| W-17 | 08:55 | Owner GO 発声待機 / 公開直前 60 秒 readiness 最終確認 | owner-action-card §CARD C | Slack | 5 min |
| W-18 | 09:00 | Vercel production deploy promote 実行 / smoke test 即時実施 | public-launch-sop.md | Slack 報告 | 10 min |
| W-19 | 09:10 | OG image 8 case の本番 curl 検証（preview baseline と sha256 / pixel diff 比較）| og-preview-validation-execution-procedure §4 §5 | Slack 報告 | 15 min |
| W-20 | 09:25 | Sentry / Vercel Analytics で error rate / LCP 監視（rollback trigger 8 条件）| rollback runbook §1 | Slack 報告 | 30 min（継続） |
| W-21 | 10:00 | T+1h 状態報告（heartbeat 500k SLO / OG ヒット率 / 5xx 率 / アクセス概況） | KPI-01 E-2 | Slack `#prj-019-launch` | 15 min |
| W-22 | 11:00 | T+2h 状態報告 + rollback 不要確認 + Owner / CEO への中間サマリー | rollback runbook §5 | Slack + DM | 15 min |

**合計 task: 22 件 / 想定範囲 18-25 task の中央値**
**合計実時間: 約 219 min（3.65 hour）+ 監視待機時間 = 6 hour 内に完遂可**

---

## 3. 各 task の Owner 連絡経路 詳細

### 3.1 通常通信（投稿 + 待機）

主経路: Slack `#prj-019-launch` channel への投稿。Owner は同 channel を mobile / PC で常時 watch（事前合意済み）。

経路 fallback:
- Slack 不調時: Slack DM 直接送信（Owner 個人 channel）
- DM も届かない: Email（hironori555@gmail.com）
- Email 不達: 電話（1Password vault `emergency-contacts`、最重要 case のみ）

### 3.2 緊急通信（即時判断 trigger）

trigger 8 条件（rollback runbook §1）のうち 1 件でも合致:
1. Web-Ops が即時 rollback 着手（CEO / Owner 事前承認不要、§3.3 並行通知）
2. 並行で Owner DM「[緊急: rollback 実行中] trigger §1 #X」送信
3. 並行で CEO に Slack `#prj-019-launch` mention（@ceo）
4. rollback 完了直後に rollback runbook §5 投稿テンプレで報告

通信遅延: 各 step は 5 秒以内。30 秒 SLA を保証する。

### 3.3 Web-Ops 内通信（オペレータ間バックアップ）

Web-Ops 担当者が複数いる場合は handoff 時刻を明示:
- 06:00-12:00: Web-Ops-I（本書起票者想定 / 主担当）
- 12:00-24:00: Web-Ops-J 等（後段 round で別担当が引き継ぐ場合）

handoff Slack 投稿テンプレ（12:00 想定）:
```
[Web-Ops handoff 12:00 JST]
06:00-12:00 担当: web-ops-I
12:00-24:00 担当: web-ops-J
引き継ぎ事項:
  - rollback 0 件 / smoke 全 PASS / heartbeat SLO 維持
  - 監視継続要項: OG cache hit 率 90% 以上維持確認、Slack alert 発火 0 件継続
  - 次の milestone: T+24h 6/20 09:00 報告
```

---

## 4. 22 task の依存関係 graph

```
W-01〜W-03 (06:00-06:45)        [readiness 確認]
   └─→ W-04 (PIN-A 確認)         [rollback 前提確立]
   └─→ W-05〜W-09 (07:05-07:25) [事前設定の最終確認]
            └─→ W-10 (OG fast-path check)
                 └─→ W-11〜W-12 (Owner / CEO 通知)
                      └─→ W-13〜W-15 (08:00-08:35 Owner snapshot 伴走)
                           └─→ W-16〜W-17 (08:45-09:00 GO 待機)
                                └─→ W-18 (09:00 deploy)
                                     └─→ W-19 (09:10 OG 検証)
                                          └─→ W-20 (09:25-10:00 監視)
                                               └─→ W-21 (10:00 T+1h 報告)
                                                    └─→ W-22 (11:00 T+2h 報告)
```

クリティカルパス: W-01 → W-04 → W-15 → W-18 → W-22（約 5 hour）。
W-05〜W-09 は並列化可（複数 dashboard を tab 切替で実行）。

---

## 5. リスク / fallback 索引（v1.0 §4 を web-ops 視点で再構成）

| risk | 検知 task | fallback artifact | 影響 |
|---|---|---|---|
| heartbeat 500k 超過 | W-07 / W-21 | OPS-E-04 cron-fallback-switch.md | 公開後 SLO 違反 |
| Vercel deploy 失敗 | W-18 | OPS-E-01 §6 Rollback / rollback runbook | 公開即時影響 |
| OG image 5xx | W-19 | rollback runbook §1 trigger #3 | OG 計測 NG |
| Supabase RLS 異常 | W-06 | OPS-E-01 §5 / OWN-PRE-06 | 情報漏洩 risk |
| Slack alert 経路断絶 | W-08 | OPS-E-05 §fallback メール直送 | rollback trigger 検知遅延 |
| Owner GO 発声不能 | W-17 | OPS-E-02 CARD C / 公開延期判断（CEO 経由）| 公開遅延 |
| OWN-PRE-07 snapshot 取得失敗 | W-14 | OWN-PRE-07 §7 PITR 単独運用切替 | rollback ポイント精度低下 |
| DNS / SSL 異常 | W-09 | rollback runbook §1 trigger #6 | 全公開影響 |
| 30 秒 SLA 未達 | W-20 監視中 | rollback runbook §6 postmortem | postmortem 義務 |
| 法的 / 倫理問題発覚 | W-20 / 外部通報 | rollback runbook §1 trigger #8 | 即時 rollback 最優先 |

---

## 6. 既存 artifact 不変保証

本書 v2.0 は **参照 only**。以下を遵守:

- v1.0 = `launch-readiness-consolidation-2026-06-19.md`（130 行 / R19 Web-Ops-F 起票）への直接編集 0
- OWN-PRE 7 sub-card 物理 file への直接編集 0
- INDEX.md への直接編集 0
- og-image-vercel-preview-validation-runbook.md（253 行）への直接編集 0
- public-launch-vercel-rollback-runbook-2026-06-19.md（193 行）への直接編集 0
- 上記 artifact 内の文言 / リンク / 担当者は本書で再記載しない（path 参照に限定、必要箇所は引用）
- 本書 update 権限は Web-Ops 部門のみ。CEO / Owner からの修正依頼は Web-Ops 経由

---

## 7. 公開後の本書ライフサイクル

- 6/19 09:00 公開直後: 本書を「保存版」として lock
- 6/19 12:00 W-22 完了後: §2 task table の `状態` 列（PASS / FAIL / 実時間）を実績ログ化
- 6/20 T+24h 完了後: 全 22 task の事後検証で抜けがあれば v2.1 起票候補
- 7/27 30 day review: 本書をベースに lessons-learned 抽出 → `organization/knowledge/patterns/launch-day-web-ops-role.md` 候補化（DEC-019-033 経路）

---

## 7.5 Web-Ops オペレータ事前準備チェックリスト（6/18 D-1 18:00 JST まで）

公開当日 06:00 JST から動き出すための事前準備:

- [ ] 6/18 18:00 JST までに本書 v2.0 を再読了
- [ ] 6/18 18:00 までに以下 dashboard 全てで sign-in 状態を確認:
  - Vercel Dashboard（事前 token refresh）
  - Sentry Dashboard
  - Supabase Dashboard
  - Slack Workspace（`#prj-019-launch` + `#prj-019-alerts` 両方）
  - GitHub（`4wide/company-website` repo の Actions tab readyness）
  - 1Password（emergency-contacts vault unlock 確認）
- [ ] 6/18 22:00 までに Slack pinned items を確認:
  - PIN-A: 直前 Production deploy ID（rollback 先）
  - PIN-B: 当日 promote 直後の deploy ID 用 placeholder（公開後即時更新）
  - OWN-PRE-07 snapshot ID（6/19 08:30 JST 取得後 pin）
- [ ] 6/18 23:00 までに 6/19 当日 06:00 JST 起床 alarm 設定
- [ ] 6/19 05:30 JST に PC 起動 / network speed test（< 200ms 遅延を確認）
- [ ] 6/19 06:00 JST sharp で W-01 着手

事前準備が 1 件でも未達の場合: 6/18 23:00 までに CEO に Slack escalate → 公開判断見直し議論。

---

## 7.6 22 task の累積時間内訳（6 hour budget の使用率）

| 時間帯 | 主要 task | 累積時間 | 6 hour budget 残 |
|---|---|---|---|
| 06:00-07:00 | W-01〜W-06 readiness 確認 | 61 min | 299 min |
| 07:00-08:00 | W-07〜W-12 事前検証 + Owner / CEO 通知 | 50 min | 249 min |
| 08:00-09:00 | W-13〜W-17 Owner snapshot 伴走 + GO 待機 | 33 min | 216 min |
| 09:00-10:00 | W-18〜W-20 公開実行 + 直後検証 + 監視 | 55 min | 161 min |
| 10:00-12:00 | W-21〜W-22 T+1h / T+2h 状態報告 | 30 min | 131 min |
| **合計** | **22 task** | **229 min（3.8 hour）** | **131 min budget 残** |

131 min（2.2 hour）は監視 / 即応 / 想定外対応 buffer。rollback 発動時の postmortem 起票や handoff 引き継ぎにも充当可。

---

## 8. 関連 DEC

- DEC-019-054（portfolio v3.0 公開判断）
- DEC-019-055（4 部署並列化）
- DEC-019-062（v1.1 / v3.1 deploy 確定 + cron 5 本 + CRON_SECRET）
- DEC-019-033（ナレッジ自動蓄積機構：本書も knowledge/patterns 候補）
- DEC-018-047（PRJ-018 hotfix rollback ベストプラクティス継承）
- DEC-019-025（background dispatch SOP / 本書も SOP 実証）

---

## 9. 関連 artifact（path 全列挙）

- `runbooks/launch-readiness-consolidation-2026-06-19.md`（v1.0 上位、無改変）
- `runbooks/launch-pre-ops-checklist.md`
- `runbooks/owner-action-card-2026-06-19.md`
- `runbooks/public-launch-sop.md`
- `runbooks/cron-fallback-switch.md`
- `runbooks/slack-alert-routing.md`
- `runbooks/og-image-production-spec-2026-06-27.md`
- `runbooks/owner-action-cards/INDEX.md`
- `runbooks/owner-action-cards/OWN-PRE-01-vercel-env-ga4-sentry.md`
- `runbooks/owner-action-cards/OWN-PRE-02-vercel-env-supabase.md`
- `runbooks/owner-action-cards/OWN-PRE-03-dns-ttl-shorten.md`
- `runbooks/owner-action-cards/OWN-PRE-04-vercel-env-slack-cron.md`
- `runbooks/owner-action-cards/OWN-PRE-05-sentry-alert.md`
- `runbooks/owner-action-cards/OWN-PRE-06-supabase-rls-check.md`
- `runbooks/owner-action-cards/OWN-PRE-07-supabase-snapshot.md`
- `runbooks/owner-action-cards/OWN-PRE-DRY-RUN-2026-06-12.md`
- `runbooks/og-image-vercel-preview-validation-runbook.md`
- `runbooks/og-preview-validation-execution-procedure-2026-06-12.md`
- `runbooks/public-launch-vercel-rollback-runbook-2026-06-19.md`
- `dashboard/kpi-definition.md` §E PRJ-019

---

**最終更新**: 2026-05-05（Round 22 / Web-Ops-I 起票）
**次回見直し**: 2026-06-12（D-7 OWN-PRE 完遂後の §2 reality check）/ 2026-06-18（D-1 dry-run 直前）/ 2026-06-19 09:00 JST（公開時 lock）/ 2026-06-19 12:00 JST（実績ログ追記）
