# Runbook: OG Image Deploy Preview Checklist — 実 deploy 前検証手順

**対象案件**: PRJ-019 Open Claw "Clawbridge"（公開 2026-06-19 09:00 JST）
**所有者**: Web-Ops 部門 / Owner 最終承認
**バージョン**: v1.0（Round 20 第 2 波 / Web-Ops-G 起票）
**関連**: `og-image-production-spec-2026-06-27.md` / `og-image-template-design-v1.md` / `og-image-e2e-test-spec.md` / `app/api/og/route.tsx` / `launch-pre-ops-checklist.md`

---

## 0. 目的

`/api/og` route の **本番 deploy 前** に、Vercel preview 環境で 4 variant × 2 locale = 8 case が破綻なく生成されることを目視 + 機械的に確認する手順を規定する。
本書は Round 19 spec（固定画像 `/og/launch-2026-06-27.png` 制作）と Round 20 動的生成（`/api/og`）の両者を共通の checklist で扱う。

副作用 0 / 絵文字 0 / API 追加コスト $0（Vercel CLI free tier の preview deploy のみ、本番 promote は禁止）。

---

## 1. Vercel preview build 起動手順

### 1.1 ローカル preview（dev）

```bash
cd projects/COMPANY-WEBSITE/app
npm install
npm run dev
# → http://localhost:3000 で /api/og?variant=home を直接開いて確認
```

確認 URL（8 case）:
- `http://localhost:3000/api/og?variant=home&locale=ja`
- `http://localhost:3000/api/og?variant=home&locale=en`
- `http://localhost:3000/api/og?variant=portfolio&locale=ja`
- `http://localhost:3000/api/og?variant=portfolio&locale=en`
- `http://localhost:3000/api/og?variant=case-study&title=PRJ-004&locale=ja`
- `http://localhost:3000/api/og?variant=case-study&title=PRJ-004&locale=en`
- `http://localhost:3000/api/og?variant=about&locale=ja`
- `http://localhost:3000/api/og?variant=about&locale=en`

### 1.2 Vercel preview deploy（推奨：production 環境差異込み検証）

```bash
cd projects/COMPANY-WEBSITE/app
vercel build              # build artifact 生成（local）
vercel deploy             # preview URL 取得（production 化しない）
# → 出力例: https://prj019-xxxxx-4wide.vercel.app
```

`vercel --prod` は **絶対に使わない**（本番昇格防止）。
preview URL を `${BASE}` として `og-image-e2e-test-spec.md` §1.1 の 8 case を全て確認。

---

## 2. 各 variant の preview URL 確認（8 case）

| # | variant | locale | 確認項目 |
|---|---|---|---|
| 1 | home / ja | - | title 日本語 / subtitle 日本語 / WCAG コントラスト |
| 2 | home / en | - | title 英語 / subtitle 英語 / 文字オーバーフロー無 |
| 3 | portfolio / ja | - | meta「公開実績 13 件」表示 / 数字 accent 色 |
| 4 | portfolio / en | - | meta `13 projects shipped` 表示 |
| 5 | case-study / ja | title=PRJ-004 | dynamic param が title に反映 / ellipsis 動作 |
| 6 | case-study / en | title=PRJ-004 | 英語表示 / encoding 崩れ無 |
| 7 | about / ja | - | mission 1 行 / 余白 80px 確保 |
| 8 | about / en | - | "Lean web apps for SMBs..." 表示 |

各 case で:
- 画像が 1200x630 で取得できる
- 文字が safe area (1080x540) 内に収まっている
- 背景 gradient が深紺で表示
- accent dot (12px) と divider line が 1 本ずつ表示
- 絵文字混入が無い（grep で目視）

---

## 3. deploy 直前のチェックリスト 6 件

deploy（promote to production）の **直前** に以下 6 件を順に確認し、全 green でないと deploy しない。

| # | チェック項目 | 確認方法 | 担当 |
|---|---|---|---|
| 1 | E2E test 8 case 全 pass | `og-image-e2e-test-spec.md` §1〜§5 結果 Slack 投稿 | Web-Ops |
| 2 | visual regression baseline diff < 0.1% | Playwright snapshot 比較 (Round 21+ で運用化) | Dev |
| 3 | route.tsx の `runtime = "edge"` 宣言維持 | `git diff main..HEAD app/src/app/api/og/route.tsx` | Web-Ops |
| 4 | font fetch URL が gstatic.com から到達可能 | `curl -sI ${FONT_URL}` で 200 確認 | Web-Ops |
| 5 | `app/page.tsx` の `metadata.openGraph.images` が `/api/og?variant=home` 経路を参照 | grep `/api/og` in app/src/app/ | Web-Ops |
| 6 | Owner ack（OG 動作 OK の Slack 一言） | `#prj-019-launch` で「OG dyn ack」 | Owner |

全 6 件 green → CEO に Slack 投稿で報告 → CEO 承認 → Web-Ops が `vercel promote` 実行（deploy ID Slack pin）。

---

## 4. rollback 手順（Vercel `Promote to Production` 戻し）

### 4.1 trigger 条件

公開後 0〜30 分以内に以下のいずれかを検知した場合、即時 rollback:
- `/api/og?variant=*` の 8 case のうち 1 件でも 5xx
- OG debugger（Facebook / Twitter / LinkedIn）で表示崩れ
- Sentry で route.tsx 由来の error rate > 1%（5 min window）

### 4.2 手順

1. Vercel Dashboard → Project（COMPANY-WEBSITE）→ Deployments
2. 直前の Production deploy（Round 17 着地版または当日 promote 直前版）を選択
3. `...` メニュー → `Promote to Production` をクリック
4. 確認ダイアログで confirm（30 秒以内に切替完了）
5. `vercel ls` で active deploy が rollback 先 ID になっていることを確認
6. Slack `#prj-019-launch` に投稿: `OG rollback 完了 HH:MM JST / 理由 〇〇 / 次手 △△`
7. 並行して `og:image` SEO meta は v1.1 の固定 OG（`/og/launch-2026-06-27.png` または既存汎用 OG）に切替（Round 19 spec §6 fallback と同経路）

### 4.3 rollback 後の対応

- postmortem を当日中に下書き、翌営業日に `projects/PRJ-019/reports/web-ops-og-postmortem-YYYY-MM-DD.md` 提出
- 根本原因が route.tsx ロジック起因の場合、Round 21 で hotfix branch を切り再 deploy
- 根本原因が Vercel 側障害の場合、Vercel Status を引用し SLA 適用判断

---

## 5. 関連 DEC

- DEC-019-054 / DEC-019-062 / DEC-019-033 / DEC-018-047

---

**最終更新**: 2026-05-05（Round 20 第 2 波 / Web-Ops-G 起票）
**次回見直し**: 2026-06-12（D-7 preview deploy 直前）/ 2026-06-19（公開当日 T-2h で再確認）
