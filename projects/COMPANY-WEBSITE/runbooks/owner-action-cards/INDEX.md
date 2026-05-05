# INDEX: Owner Action Cards (公開前運用設定 7 sub-card)

**対象**: Owner（hironori555@gmail.com）
**用途**: PRJ-019 Open Claw 公開（2026-06-19 09:00 JST）に向けた CARD A = 公開前運用設定の **7 sub-card 一望** lookup
**所有者**: Web-Ops 部門
**バージョン**: v1.0（Round 21 第 2 波 / Web-Ops-H 起票）
**親**: `../launch-pre-ops-checklist.md` §7 / `../owner-action-card-2026-06-19.md` CARD A

---

## 0. 利用方法

本 INDEX は Owner が「次に何をやるか」を 30 秒で判別する単一 entry。各 sub-card の **要約 + 期限 + 所要 + 状態** を 1 表で表示。詳細手順は各 sub-card ファイル参照。

---

## 1. 7 sub-card lookup 表

| ID | title | 期限 | 所要 | sub-card ファイル | 状態 |
|---|---|---|---|---|---|
| OWN-PRE-01 | Vercel Env GA4 + Sentry DSN 投入 | 2026-06-12 | 10 min | [OWN-PRE-01-vercel-env-ga4-sentry.md](OWN-PRE-01-vercel-env-ga4-sentry.md) | TODO |
| OWN-PRE-02 | Vercel Env Supabase 3 key 投入 | 2026-06-12 | 15 min | [OWN-PRE-02-vercel-env-supabase.md](OWN-PRE-02-vercel-env-supabase.md) | TODO |
| OWN-PRE-03 | DNS TTL 短縮 300 秒 | 2026-06-18 17:00 | 10 min | [OWN-PRE-03-dns-ttl-shorten.md](OWN-PRE-03-dns-ttl-shorten.md) | TODO |
| OWN-PRE-04 | SLACK_WEBHOOK_URL + CRON_SECRET 投入 | 2026-06-12 | 15 min | [OWN-PRE-04-vercel-env-slack-cron.md](OWN-PRE-04-vercel-env-slack-cron.md) | TODO |
| OWN-PRE-05 | Sentry alert ルール有効化 | 2026-06-15 | 10 min | [OWN-PRE-05-sentry-alert.md](OWN-PRE-05-sentry-alert.md) | TODO |
| OWN-PRE-06 | Supabase RLS 全 table 確認 | 2026-06-15 | 15 min | [OWN-PRE-06-supabase-rls-check.md](OWN-PRE-06-supabase-rls-check.md) | TODO |
| OWN-PRE-07 | Supabase manual snapshot 取得 | 2026-06-19 08:30 | 5 min | [OWN-PRE-07-supabase-snapshot.md](OWN-PRE-07-supabase-snapshot.md) | TODO |

**合計所要**: 80 min（実時間、待機時間除く）
**完了 marker**: 7 件全て `状態` 列が DONE になれば CARD A 完了 / OPS-E-01 §7 全 green

---

## 2. 期限 timeline（Owner 一望）

```
2026-06-12 (D-7) 23:59 JST まで:
  - OWN-PRE-01 (10 min)
  - OWN-PRE-02 (15 min)
  - OWN-PRE-04 (15 min)
  ── 合計 40 min ──

2026-06-15 (D-4) 23:59 JST まで:
  - OWN-PRE-05 (10 min)
  - OWN-PRE-06 (15 min)
  ── 合計 25 min ──

2026-06-18 (D-1) 17:00 JST まで:
  - OWN-PRE-03 (10 min)
  ── 合計 10 min ──

2026-06-19 (D-Day) 08:30 JST:
  - OWN-PRE-07 (5 min, 厳守 window 08:25-08:35)
  ── 合計 5 min ──
```

推奨実行順:
1. **6/12 までに環境変数 3 件まとめ**: OWN-PRE-01 → OWN-PRE-02 → OWN-PRE-04 を連続実行（40 min 1 セッション）
2. **6/15 までに監視 / DB 2 件**: OWN-PRE-05 → OWN-PRE-06（25 min 1 セッション）
3. **6/18 17:00 までに DNS**: OWN-PRE-03 単独（10 min）
4. **6/19 08:30 厳守**: OWN-PRE-07（5 min, snapshot 取得）

---

## 3. 依存関係

```
OWN-PRE-01 ──┐
             ├──> OWN-PRE-05 (Sentry alert は DSN 投入後)
             │
OWN-PRE-02 ──┴──> OWN-PRE-06 (RLS 確認は Supabase key 投入後)
                  └──> OWN-PRE-07 (snapshot は Supabase 接続前提)

OWN-PRE-03 ─── (独立、DNS 単独)
OWN-PRE-04 ─── (独立、env 系列)
```

依存関係から:
- **OWN-PRE-01 / 02** = 全体の起点（最初に完了させる）
- **OWN-PRE-05 / 06** = OWN-PRE-01 / 02 の後段（依存解消後実行）
- **OWN-PRE-03 / 04** = 独立並列実行可
- **OWN-PRE-07** = 全件完了後の最終確認的位置（公開直前）

---

## 4. 進捗トラッキング

各 sub-card 完了時に Owner は Slack `#prj-019-launch` に以下形式で投稿:

```
OWN-PRE-XX done HH:MM
```

Web-Ops は本 INDEX の `状態` 列を `TODO → DONE` に更新（PR で 1 行修正、merge 即時反映）。

7 件全 DONE になった時点で:
- Web-Ops が `launch-pre-ops-checklist.md` §7 の OWN-PRE-01〜07 行に green check
- CEO に「CARD A 完了」を Slack 通知
- CARD C（6/19 公開最終確認）の pre-condition が成立

---

## 5. 個別手順書のフォーマット（共通構造）

各 sub-card は以下 9 セクション構造で統一（Web-Ops-H 起票方針）:

- §0 何を
- §1 なぜ
- §2 所要時間
- §3 期限
- §4 pre-condition (3-5 件)
- §5 実行 step (5-8 step、各 step に "クリック先 / 入力値 / 期待表示" を 1 行ずつ)
- §6 post-condition
- §7 FAIL 時 (Web-Ops 連絡先)
- §8 関連リンク

Owner は §5 を追って実行することで、画面操作で迷う場面を最小化。

---

## 6. 関連 artifact

- 親 checklist: `../launch-pre-ops-checklist.md`
- card 親: `../owner-action-card-2026-06-19.md`（CARD A〜D）
- launch readiness 索引: `../launch-readiness-consolidation-2026-06-19.md`（全 artifact 単一索引）
- rollback runbook: `../public-launch-vercel-rollback-runbook-2026-06-19.md`（OWN-PRE-07 snapshot を参照）
- OG preview validation: `../og-image-vercel-preview-validation-runbook.md`（環境変数前提が OWN-PRE-01 / 02）

---

## 7. 関連 DEC

- DEC-019-054 / DEC-019-062 / DEC-019-033 / DEC-018-047
- DEC-019-025（background dispatch SOP / 本 INDEX も SOP 実証物）

---

**最終更新**: 2026-05-05（Round 21 第 2 波 / Web-Ops-H 起票）
**次回見直し**: 2026-06-12（D-7, OWN-PRE-01 / 02 / 04 完了確認時）/ 2026-06-15（D-4, OWN-PRE-05 / 06 完了確認時）/ 2026-06-19（D-Day, OWN-PRE-07 完了で本 INDEX を「保存版」化）
