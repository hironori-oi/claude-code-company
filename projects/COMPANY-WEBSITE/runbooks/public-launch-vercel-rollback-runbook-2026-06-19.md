# Runbook: 公開当日 Vercel Rollback 即応 (2026-06-19)

**対象案件**: PRJ-019 Open Claw "Clawbridge"（公開 2026-06-19 09:00 JST）
**所有者**: Web-Ops 部門 / 当日 rollback 実行担当
**バージョン**: v1.0（Round 21 第 2 波 / Web-Ops-H 起票）
**関連**: `launch-pre-ops-checklist.md` §6 / `public-launch-sop.md` / `launch-readiness-consolidation-2026-06-19.md` §4 / `owner-action-cards/OWN-PRE-07-supabase-snapshot.md`

---

## 0. 目的

公開当日（2026-06-19 09:00 JST）以降、rollback 判断 trigger 8 条件のうち 1 件でも合致した場合、**30 秒以内** に Vercel Dashboard で `Promote to Production` を旧 deploy に戻し、被害を最小化する。

副作用最小（rollback は production 影響あり、ただし「現状回復」のため許容）/ 30 秒 SLA を SLA 化。

---

## 1. Trigger 8 条件（rollback 発動判断）

以下 8 条件のいずれかを Web-Ops が検知した時点で **即時** rollback プロセスへ。CEO / Owner の事前承認は不要（ただし実行と並行して通知）。

| # | trigger | 検知ソース | 閾値 |
|---|---|---|---|
| 1 | HTTP 5xx エラー率 | Vercel Analytics / Sentry | 直近 5 min で > 1% |
| 2 | LCP（Largest Contentful Paint）劣化 | Web Vitals | 直近 5 min p75 > 4.0s |
| 3 | OG image 8 case 中 1 件以上 5xx | curl 監視 / Sentry | 1 件以上 |
| 4 | Supabase API 403 / 401 異常スパイク | Supabase Logs | 直近 5 min で > 100 件 |
| 5 | Sentry error rate > 1% rule 発火 | Sentry alert | OWN-PRE-05 で設定済み rule |
| 6 | DNS / SSL 異常 | `dig` / SSL Labs | resolve 失敗 / 証明書 invalid |
| 7 | Owner / CEO の「STOP」発声 | Slack `#prj-019-launch` | 1 件以上 |
| 8 | 公開済みコンテンツの法的 / 倫理的問題発覚 | 内外通報 | 1 件以上（最優先） |

trigger 1-6 は技術系で、Web-Ops 一次判断。trigger 7-8 は人的判断 trigger で即時実行。

`launch-readiness-consolidation-2026-06-19.md` §4 のリスク表 + 本書 §1 の 8 条件で整合（重複条件は本書を上位とする）。

---

## 2. Slack `#prj-019-launch` pin の前 deploy ID 確認（10 秒以内）

公開当日は事前に `#prj-019-launch` に以下 2 件の deploy ID が pin 済み:

- **PIN-A**: 直前 Production deploy（Round 17 着地版） = rollback 先候補
- **PIN-B**: 当日 6/19 09:00 JST の promote 直後の deploy ID = 現状

rollback 時は **PIN-A** に戻す。Slack pinned items を開き ID（`dpl_xxxxxxxxxxxxx` 形式）を copy。

並行して Supabase snapshot ID（OWN-PRE-07 で取得 / 同 channel pin）も読み込む（DB rollback 判断用、§3.5 で利用）。

---

## 3. Vercel Dashboard `Promote to Production` 手順（3 click, 20 秒以内）

### 3.1 Click 1: Deployments 画面へ

URL: `https://vercel.com/[team]/company-website/deployments`

### 3.2 Click 2: 旧 deploy を選択

PIN-A の deploy ID と一致する row を click → deploy 詳細画面へ遷移。

### 3.3 Click 3: Promote to Production

右上 `...` メニュー → `Promote to Production` → confirm ダイアログで OK。

完了通知が画面右下に出現（5-15 秒）。並行して `vercel ls` で active deploy が PIN-A になっていることを確認:

```bash
vercel ls --prod | head -3
# 期待: PIN-A の deploy ID が "Ready" status で 1 行目
```

### 3.4 ステップ合計時間

- pin 確認: 10 秒
- 3 click + confirm: 10 秒
- active 確認: 10 秒
- **合計: 30 秒 SLA 内**

### 3.5 DB rollback 判断（条件付き）

trigger 4（Supabase 異常）が原因の場合のみ、Vercel rollback と並行して DB rollback を判断:

- 軽微な query 失敗: DB rollback **しない**（Vercel rollback で再現停止）
- schema 破壊 / data 大量欠損: OWN-PRE-07 取得 snapshot ID を `Restore` → 5-15 min（30 秒 SLA 外）

DB rollback は CEO + Owner の判断必須（独断禁止）。

---

## 4. 30 秒 SLA の保証

| 項目 | 想定時間 | SLA |
|---|---|---|
| trigger 検知 → 判断 | 0 秒（自動 alert / 即時人的） | - |
| pin 読込 | 10 秒 | 10 秒 |
| 3 click + confirm | 10 秒 | 20 秒 |
| active 切替確認 | 10 秒 | 30 秒 |

SLA 遵守のための前提:
- Web-Ops オペレータが 6/19 09:00-12:00 JST の間 PC 前にスタンバイ（CARD A 完遂後の Web-Ops 担当者）
- Vercel Dashboard が事前ログイン状態
- Slack の pinned items に PIN-A / PIN-B が事前投入済み（D-1 18:00 JST まで）
- Network 遅延 < 200ms（事前計測）

SLA を超過した場合は postmortem で原因分析（§6）。

---

## 5. Rollback 後 Slack 投稿テンプレ（30 秒 + α）

rollback 完了直後（active 切替確認後 1 分以内）に以下を投稿:

```
[ROLLBACK COMPLETED]
時刻: HH:MM JST
trigger: §1 #X (具体的な事象)
rollback 先 deploy: dpl_xxxxxxxxxxxxx (PIN-A, Round 17 着地版)
DB rollback: なし / あり (snapshot ID: <uuid>)
影響範囲: 公開後 N min, 推定 access M 件
次手:
  - postmortem 起票 (期限: 翌営業日 EOD)
  - 根本原因調査開始 (Web-Ops + Dev)
  - 再 deploy 判断: CEO + Owner authorize 後
連絡: @ceo @owner @web-ops
```

投稿は `#prj-019-launch` および `#prj-019-alerts` の 2 ch に同時投稿（後者は alert routing 経由で auto-cross-post 設定済み = `slack-alert-routing.md` §3）。

---

## 6. Postmortem 起票期限（翌営業日 EOD）

- 起票期限: rollback 翌営業日 23:59 JST まで
- 起票場所: `projects/PRJ-019/reports/web-ops-rollback-postmortem-2026-06-19.md`
- 必須セクション:
  - §0 概要（時系列 / 影響）
  - §1 trigger 8 条件のうち何が発火したか
  - §2 検知 → 判断 → 実行までの timing 内訳
  - §3 30 秒 SLA 達成 / 未達成
  - §4 根本原因（5 why）
  - §5 再発防止策
  - §6 関連 DEC 起票候補

postmortem は Review 部門 + CEO レビュー後、`organization/knowledge/pitfalls/` に lessons-learned 抽出（DEC-019-033 経路）。

---

## 7. Owner 連絡（rollback 完了 1 分以内に DM）

Web-Ops は §5 の Slack 投稿に加えて、Owner（hironori555@gmail.com）へ以下を 1 分以内に送信:

### 7.1 Slack DM

```
[緊急: rollback 完了]
公開後 N min で rollback を実行しました。
trigger: <短い説明>
現状: PIN-A (Round 17 着地版) で公開継続中。サイト表示は正常。
次の対応:
  - 1h 以内: 根本原因の暫定 report
  - 翌営業日 EOD: postmortem 完了
GO 判断更新が必要な場合は #prj-019-launch でお知らせください。
```

### 7.2 メール（DM が届かない場合の fallback）

件名: `[緊急] PRJ-019 公開 rollback 完了 HH:MM JST`
本文: §7.1 と同内容 + Slack thread URL

### 7.3 電話（DM / メール双方届かない場合）

trigger 8（法的問題）等の最重要 case のみ電話 escalate（事前合意済み番号、1Password vault `emergency-contacts`）。

---

## 8. 関連 DEC

- DEC-019-054 / DEC-019-062 / DEC-019-033 / DEC-018-047
- DEC-019-025（background dispatch SOP / 本書も SOP 実証 18 件目）

---

## 9. Round 22+ で本書を強化する候補

- 30 秒 SLA を計測する automation script（手作業計測ではなく自動 timing 取得）
- rollback 履歴 dashboard（過去全 rollback の trigger / SLA 達成状況の可視化）
- trigger 1-6 の自動 rollback（人的判断不要で 10 秒 SLA に短縮）= Round 25+ の big rock 候補

---

**最終更新**: 2026-05-05（Round 21 第 2 波 / Web-Ops-H 起票）
**次回見直し**: 2026-06-18（D-1 dry-run 反映） / 2026-06-19 09:00 JST（公開時 lock） / rollback 発生後（postmortem 反映）
