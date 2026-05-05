# OWN-PRE-04: SLACK_WEBHOOK_URL + CRON_SECRET 投入手順書

**対象**: Owner（hironori555@gmail.com）
**所有者**: Web-Ops 部門（手順 update）
**バージョン**: v1.0（Round 21 第 2 波 / Web-Ops-H 起票）
**親**: `launch-pre-ops-checklist.md` §7 OWN-PRE-04 / `owner-action-card-2026-06-19.md` CARD A
**関連**: `owner-action-cards/INDEX.md` / `OWN-PRE-02-vercel-env-supabase.md` / `cron-fallback-switch.md`

---

## 0. 何を

`SLACK_WEBHOOK_URL` と `CRON_SECRET` を Vercel Env と GitHub Secrets の **両方** に投入する。Vercel = ランタイム経由の通知 / cron 起動、GitHub Secrets = CI 経由の Slack 通知 / cron テスト用。

## 1. なぜ

- Slack alert routing（`#prj-019-alerts` / `#prj-019-launch`）を機能させるため。
- Vercel Cron 5 本（heartbeat / og preview / sitemap revalidate / supabase backup ping / status report）が `CRON_SECRET` で保護されることを保証するため。
- Vercel と GitHub の **両方** に投入しないと、CI 経由の Slack 通知（PR merge 通知等）が漏れる。

## 2. 所要時間

15 min（1Password から 2 値取り出し 3 min + Vercel 投入 5 min + GitHub Secrets 投入 5 min + 確認 2 min）

## 3. 期限

2026-06-12（D-7）23:59 JST まで

## 4. pre-condition

- [ ] 1Password vault に `SLACK_WEBHOOK_URL_PRODUCTION` と `CRON_SECRET_PRODUCTION` が登録済み
- [ ] Slack workspace `#prj-019-alerts` channel が作成され、incoming webhook 発行済み
- [ ] CRON_SECRET 値は 64 文字以上の random 文字列（DEC-019-062 で確定）
- [ ] OWN-PRE-01 / OWN-PRE-02 が完了済み（Vercel Env 操作経験あり）
- [ ] GitHub repo `4wide/company-website`（または同等）の admin 権限あり

## 5. 実行 step（5-8 step）

1. **Vercel に SLACK_WEBHOOK_URL を投入**: クリック先 `Vercel Env → Add New` / 入力値 `Key: SLACK_WEBHOOK_URL / Value: 1Password から paste / Environment: Production + Preview check（Development は除外）` / 期待表示 `list に追加`
2. **Vercel に CRON_SECRET を投入**: クリック先 `Vercel Env → Add New` / 入力値 `Key: CRON_SECRET / Value: 1Password から paste / Environment: Production のみ check` / 期待表示 `list に Production のみで追加`
3. **GitHub Secrets 画面へ**: クリック先 `https://github.com/4wide/company-website/settings/secrets/actions` / 入力値 -（URL 直接） / 期待表示 `Repository secrets 一覧画面`
4. **GitHub に SLACK_WEBHOOK_URL を投入**: クリック先 `New repository secret` / 入力値 `Name: SLACK_WEBHOOK_URL / Secret: 1Password から paste` / 期待表示 `list に SLACK_WEBHOOK_URL added 表示`
5. **GitHub に CRON_SECRET を投入**: クリック先 `New repository secret` / 入力値 `Name: CRON_SECRET / Secret: 1Password から paste` / 期待表示 `list に CRON_SECRET added`
6. **Vercel CLI 確認**: クリック先 `terminal` / 入力値 `vercel env ls production | grep -E "SLACK|CRON"` / 期待表示 `2 件（SLACK_WEBHOOK_URL + CRON_SECRET）が production scope で表示`
7. **GitHub CLI 確認（任意）**: クリック先 `terminal` / 入力値 `gh secret list -R 4wide/company-website` / 期待表示 `2 件（SLACK_WEBHOOK_URL + CRON_SECRET）表示`
8. **Slack 投稿**: クリック先 `Slack #prj-019-launch` / 入力値 `OWN-PRE-04 done HH:MM / Vercel + GitHub 両投入 OK` / 期待表示 `投稿表示`

## 6. post-condition

- Vercel Production scope に SLACK_WEBHOOK_URL + CRON_SECRET の 2 件存在
- GitHub Repository secrets に SLACK_WEBHOOK_URL + CRON_SECRET の 2 件存在
- Vercel Preview scope に SLACK_WEBHOOK_URL のみ存在（CRON_SECRET 不在 = 隔離維持）
- Slack に done 投稿済み

## 7. FAIL 時（Web-Ops 連絡先）

- 連絡 ch: Slack `#prj-019-launch` で `@web-ops` mention
- 連絡先 alt: メール直送
- Web-Ops が代行できる範囲: Vercel CLI 経由の env 投入、GitHub `gh secret set` 経由の投入（ただし 1Password 値取り出しは Owner 必須）
- webhook URL が 404 を返す場合: Slack workspace 管理画面で webhook 再発行 → 1Password 更新 → step 1 / 4 再実行
- CRON_SECRET 値の長さが不足する場合: `openssl rand -hex 32` で再生成 → 1Password 更新 → step 2 / 5 再実行

## 8. 関連リンク

- 親 checklist: `launch-pre-ops-checklist.md` §1 環境変数表 / §7 OWN-PRE-04 行
- card 親: `owner-action-card-2026-06-19.md` CARD A
- INDEX: `owner-action-cards/INDEX.md`
- 関連 runbook: `cron-fallback-switch.md`（CRON_SECRET 利用先）/ `slack-alert-routing.md`（webhook 利用先）
- 前 sub-card: `OWN-PRE-02-vercel-env-supabase.md`
- 次 sub-card: `OWN-PRE-05-sentry-alert.md`
- DEC: DEC-019-062（CRON_SECRET 確定）

---

**最終更新**: 2026-05-05（Round 21 第 2 波 / Web-Ops-H 起票）
**次回見直し**: 2026-06-13（D-6, post-condition 全 green 確認時）
