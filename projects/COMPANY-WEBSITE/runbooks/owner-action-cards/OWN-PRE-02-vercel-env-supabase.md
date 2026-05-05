# OWN-PRE-02: Vercel Env Supabase 3 key 投入手順書

**対象**: Owner（hironori555@gmail.com）
**所有者**: Web-Ops 部門（手順 update）
**バージョン**: v1.0（Round 21 第 2 波 / Web-Ops-H 起票）
**親**: `launch-pre-ops-checklist.md` §7 OWN-PRE-02 / `owner-action-card-2026-06-19.md` CARD A
**関連**: `owner-action-cards/INDEX.md` / `OWN-PRE-01-vercel-env-ga4-sentry.md` / `OWN-PRE-04-vercel-env-slack-cron.md`

---

## 0. 何を

Vercel Project の Environment Variables に Supabase 3 key を投入する: `SUPABASE_URL`、`SUPABASE_ANON_KEY`（Production / Preview / Development の 3 scope）、`SUPABASE_SERVICE_ROLE_KEY`（**Production scope のみ**）。

## 1. なぜ

- アプリの DB / Auth / Storage 接続を成立させるため。
- `SUPABASE_SERVICE_ROLE_KEY` は server-only secret であり、Production scope のみに隔離することで Preview / Development からの誤露出を防ぐ。
- anon key は client bundle に含まれるが、RLS が機能している前提で公開設計として許容（OWN-PRE-06 で確認）。

## 2. 所要時間

15 min（1Password 値取り出し 3 min + Vercel Web UI 操作 9 min + 確認 3 min）

## 3. 期限

2026-06-12（D-7）23:59 JST まで

## 4. pre-condition

- [ ] 1Password vault に Supabase 3 key（`SUPABASE_URL_PRODUCTION` / `SUPABASE_ANON_PRODUCTION` / `SUPABASE_SERVICE_ROLE_PRODUCTION`）が登録済み
- [ ] Supabase project URL（`https://xxxxx.supabase.co`）が確定している
- [ ] OWN-PRE-01 完了済み（Vercel Env 画面の使い方を 1 度経験している前提）
- [ ] Vercel Project `company-website` admin 権限保持

## 5. 実行 step（5-8 step）

1. **1Password で 3 key を確認**: クリック先 `1Password → prj-019-secrets` / 入力値 -（vault 一覧表示） / 期待表示 `SUPABASE_URL / SUPABASE_ANON / SUPABASE_SERVICE_ROLE の 3 entry が見える`
2. **SUPABASE_URL を Add**: クリック先 `Vercel Env 画面 → Add New` / 入力値 `Key: SUPABASE_URL / Value: 1Password から paste / Environment: Production + Preview + Development の 3 scope check` / 期待表示 `list に SUPABASE_URL × 3 scope 追加`
3. **SUPABASE_ANON_KEY を Add**: クリック先 `Add New` / 入力値 `Key: SUPABASE_ANON_KEY / Value: 1Password から paste / Environment: Production + Preview + Development` / 期待表示 `list に SUPABASE_ANON_KEY × 3 scope`
4. **SUPABASE_SERVICE_ROLE_KEY を Add（重要）**: クリック先 `Add New` / 入力値 `Key: SUPABASE_SERVICE_ROLE_KEY / Value: 1Password から paste / Environment: Production のみ check（Preview / Development は外す）` / 期待表示 `list に SUPABASE_SERVICE_ROLE_KEY が Production のみ表示`
5. **scope 隔離を CLI 確認**: クリック先 `terminal` / 入力値 `vercel env ls preview | grep SERVICE_ROLE` / 期待表示 `0 件（grep が exit code 1）`
6. **Production 全件確認**: クリック先 `terminal` / 入力値 `vercel env ls production | grep SUPABASE` / 期待表示 `3 件（URL / ANON / SERVICE_ROLE）`
7. **Slack 投稿**: クリック先 `Slack #prj-019-launch` / 入力値 `OWN-PRE-02 done HH:MM / service_role 隔離 OK` / 期待表示 `自分の投稿が表示`

## 6. post-condition

- `vercel env ls production` に Supabase 3 key（URL / ANON / SERVICE_ROLE）が表示
- `vercel env ls preview` に SUPABASE_URL + SUPABASE_ANON_KEY の 2 件のみ（SERVICE_ROLE 不在）
- `vercel env ls development` も同様（SERVICE_ROLE 不在）
- Slack に done 投稿済み

## 7. FAIL 時（Web-Ops 連絡先）

- 連絡 ch: Slack `#prj-019-launch` で `@web-ops` mention
- 連絡先 alt: メール直送
- Web-Ops が代行できる範囲: 値以外（key 名 / scope 設定）の修正
- value 誤投入の場合: `vercel env rm <key> <scope>` で削除し step 2-4 を再実行
- service_role が Preview に誤投入された場合: **緊急** = Web-Ops に即時連絡 → 該当 key を Supabase Dashboard で rotate 後、再投入

## 8. 関連リンク

- 親 checklist: `launch-pre-ops-checklist.md` §1 環境変数表 / §7 OWN-PRE-02 行
- card 親: `owner-action-card-2026-06-19.md` CARD A
- INDEX: `owner-action-cards/INDEX.md`
- 前 sub-card: `OWN-PRE-01-vercel-env-ga4-sentry.md`
- 次 sub-card: `OWN-PRE-04-vercel-env-slack-cron.md`（環境変数系の連続実行推奨）
- 関連 sub-card: `OWN-PRE-06-supabase-rls-check.md`（RLS 確認で本 key を検証）
- DEC: DEC-019-054 / DEC-019-062

---

**最終更新**: 2026-05-05（Round 21 第 2 波 / Web-Ops-H 起票）
**次回見直し**: 2026-06-13（D-6, post-condition 全 green 確認時）
