# OWN-PRE-01: Vercel Env GA4 + Sentry DSN 投入手順書

**対象**: Owner（hironori555@gmail.com）
**所有者**: Web-Ops 部門（手順 update）
**バージョン**: v1.0（Round 21 第 2 波 / Web-Ops-H 起票）
**親**: `launch-pre-ops-checklist.md` §7 OWN-PRE-01 / `owner-action-card-2026-06-19.md` CARD A
**関連**: `owner-action-cards/INDEX.md` / `OWN-PRE-02-vercel-env-supabase.md`

---

## 0. 何を

Vercel Project の Environment Variables に **Production scope** で `NEXT_PUBLIC_GA4_ID` と `NEXT_PUBLIC_SENTRY_DSN` の 2 件を投入する。

## 1. なぜ

- 公開後の access tracking（GA4）と error tracking（Sentry）を機能させるため。
- `NEXT_PUBLIC_*` prefix なので client bundle に含まれることを許容（公開設計）。
- Production / Preview を別 ID に分離することで、preview noise を本番計測から排除する。

## 2. 所要時間

10 min（1Password 値取り出し 2 min + Vercel Web UI 操作 6 min + 確認 2 min）

## 3. 期限

2026-06-12（D-7）23:59 JST まで

## 4. pre-condition

- [ ] 1Password vault `prj-019-secrets` に `GA4_ID_PRODUCTION` と `SENTRY_DSN_PRODUCTION` が登録済み
- [ ] Vercel Dashboard へ admin 権限でログインできる（Owner email = hironori555@gmail.com）
- [ ] Vercel Project `company-website` が作成済み（Round 14 で完了）
- [ ] ブラウザに 1Password 拡張がインストールされ、auto-fill が機能する

## 5. 実行 step（5-8 step）

1. **1Password を開く**: クリック先 `Apps → 1Password` / 入力値 `master password` / 期待表示 `vaults 一覧`
2. **GA4_ID を copy**: クリック先 `vaults → prj-019-secrets → GA4_ID_PRODUCTION` / 入力値 -（クリックのみ） / 期待表示 `G-XXXXXXX 形式の値が clipboard に copy された通知`
3. **Vercel Env 画面へ**: クリック先 `https://vercel.com/[team]/company-website/settings/environment-variables` / 入力値 -（URL 直接） / 期待表示 `Environment Variables 一覧画面`
4. **GA4 を Add**: クリック先 `Add New ボタン` / 入力値 `Key: NEXT_PUBLIC_GA4_ID / Value: 1Password から paste / Environment: Production のみ check` / 期待表示 `保存後 list に "NEXT_PUBLIC_GA4_ID Production" 1 行追加`
5. **Sentry DSN を copy**: クリック先 `1Password → SENTRY_DSN_PRODUCTION` / 入力値 -（クリックのみ） / 期待表示 `https://...@sentry.io/... 形式の値が clipboard に`
6. **Sentry を Add**: クリック先 `Vercel Add New ボタン` / 入力値 `Key: NEXT_PUBLIC_SENTRY_DSN / Value: 1Password から paste / Environment: Production のみ check` / 期待表示 `list に "NEXT_PUBLIC_SENTRY_DSN Production" 1 行追加`
7. **CLI で確認**: クリック先 `terminal` / 入力値 `vercel env ls production` / 期待表示 `2 件 (GA4_ID + SENTRY_DSN) が production scope で表示`
8. **Slack 投稿**: クリック先 `Slack #prj-019-launch` / 入力値 `OWN-PRE-01 done HH:MM` / 期待表示 `自分の投稿が channel に表示`

## 6. post-condition

- `vercel env ls production` の出力に `NEXT_PUBLIC_GA4_ID` と `NEXT_PUBLIC_SENTRY_DSN` の 2 件が含まれる
- どちらも `Encrypted` 列が green badge
- Preview / Development scope には未存在（隔離維持）
- Slack `#prj-019-launch` に `OWN-PRE-01 done HH:MM` 投稿済み

## 7. FAIL 時（Web-Ops 連絡先）

- 連絡 ch: Slack `#prj-019-launch` で `@web-ops` mention
- 連絡先 alt: メール直送（webops@4wide.co.jp 想定 / 実 alias は Web-Ops-A 起票の slack-alert-routing.md §3）
- Web-Ops が代行できる範囲: Vercel CLI 経由の env 投入（ただし 1Password 値取り出しは Owner 必須、画面 share では NG = secret 露出回避）
- Sentry プロジェクト未作成等の前提崩れの場合は OWN-PRE-05 と統合判断

## 8. 関連リンク

- 親 checklist: `projects/COMPANY-WEBSITE/runbooks/launch-pre-ops-checklist.md` §1 環境変数表 / §7 OWN-PRE-01 行
- card 親: `projects/COMPANY-WEBSITE/runbooks/owner-action-card-2026-06-19.md` CARD A
- INDEX: `projects/COMPANY-WEBSITE/runbooks/owner-action-cards/INDEX.md`
- 次 sub-card: `OWN-PRE-02-vercel-env-supabase.md`（連続実行推奨）
- DEC: DEC-019-054 / DEC-019-062 / DEC-019-033

---

**最終更新**: 2026-05-05（Round 21 第 2 波 / Web-Ops-H 起票）
**次回見直し**: 2026-06-13（D-6, post-condition 全 green 確認時）
