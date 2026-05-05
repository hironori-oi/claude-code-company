# OWN-PRE-05: Sentry alert ルール有効化手順書

**対象**: Owner（hironori555@gmail.com）
**所有者**: Web-Ops 部門（手順 update）
**バージョン**: v1.0（Round 21 第 2 波 / Web-Ops-H 起票）
**親**: `launch-pre-ops-checklist.md` §7 OWN-PRE-05 / `owner-action-card-2026-06-19.md` CARD A
**関連**: `owner-action-cards/INDEX.md` / `OWN-PRE-01-vercel-env-ga4-sentry.md` / `slack-alert-routing.md`

---

## 0. 何を

Sentry プロジェクト `prj-019-clawbridge` の alert ルール「error rate > 1%（5 min window）」を **有効化（ON）** にする。通知先は `#prj-019-alerts` Slack channel。

## 1. なぜ

- 公開後の error spike を 5 min 以内に検知し、rollback 判断 trigger（`public-launch-vercel-rollback-runbook-2026-06-19.md` §1）に接続するため。
- Sentry プロジェクト作成 / DSN 投入だけでは alert は発火しない（明示的な ON 操作が必要）。
- Owner 1 click で完了する設計（複雑な YAML 編集等は Web-Ops が事前に rule template を投入済み）。

## 2. 所要時間

10 min（Sentry ログイン 2 min + Alerts 画面遷移 2 min + ルール ON 操作 3 min + テスト発火確認 3 min）

## 3. 期限

2026-06-15（D-4）23:59 JST まで（OWN-PRE-01 完了後 3 日以内）

## 4. pre-condition

- [ ] OWN-PRE-01 完了済み（Sentry DSN 投入済み）
- [ ] Sentry プロジェクト `prj-019-clawbridge` が作成済み（Web-Ops 事前投入）
- [ ] Slack `#prj-019-alerts` への Sentry integration 完了（Web-Ops 事前投入）
- [ ] Sentry にて Owner email が Project Member（権限: Admin or Manager）に登録済み

## 5. 実行 step（5-8 step）

1. **Sentry ログイン**: クリック先 `https://sentry.io/auth/login/` / 入力値 `Owner email + 1Password 経由 password` / 期待表示 `Organization トップ画面`
2. **Project に遷移**: クリック先 `Projects → prj-019-clawbridge` / 入力値 -（クリックのみ） / 期待表示 `Project Issues / Performance 画面`
3. **Alerts 画面へ**: クリック先 `左 nav → Alerts` / 入力値 -（クリックのみ） / 期待表示 `Alert Rules 一覧（事前投入済み rule が 1 件 Disabled で表示）`
4. **対象 rule を開く**: クリック先 `"error rate > 1% (5min)" rule 行` / 入力値 -（クリックのみ） / 期待表示 `rule 詳細画面（trigger / actions が表示）`
5. **rule を有効化**: クリック先 `Status トグル "Disabled" → "Enabled"` / 入力値 -（トグルクリック） / 期待表示 `バッジが Disabled grey → Enabled green に変化 / "Saved" 通知`
6. **テスト発火（任意）**: クリック先 `右上 "..." メニュー → "Test Alert"` / 入力値 -（confirm） / 期待表示 `Slack #prj-019-alerts に test 通知が 30 秒以内に届く`
7. **alert 一覧再確認**: クリック先 `Alerts 一覧に戻る` / 入力値 -（戻るボタン） / 期待表示 `rule 行に green badge "Enabled"`
8. **Slack 投稿**: クリック先 `Slack #prj-019-launch` / 入力値 `OWN-PRE-05 done HH:MM / alert ON OK / test 発火確認済` / 期待表示 `投稿表示`

## 6. post-condition

- Sentry Alerts 画面で `error rate > 1% (5min)` rule が `Enabled` 状態
- Slack `#prj-019-alerts` に Sentry test 通知が 1 件以上到着済み
- Sentry Alert Activity ログに rule enable イベントが記録
- Slack `#prj-019-launch` に done 投稿済み

## 7. FAIL 時（Web-Ops 連絡先）

- 連絡 ch: Slack `#prj-019-launch` で `@web-ops` mention
- 連絡先 alt: メール直送
- Web-Ops が代行できる範囲: rule template の修正（trigger 閾値 / time window 変更）
- Slack 通知が届かない場合: Sentry Settings → Integrations → Slack の再認証（Owner 操作必要）
- rule が Disabled に戻る場合: Sentry の billing plan が limit に達している可能性 → Web-Ops に確認

## 8. 関連リンク

- 親 checklist: `launch-pre-ops-checklist.md` §4 Monitoring / §7 OWN-PRE-05 行
- card 親: `owner-action-card-2026-06-19.md` CARD A
- INDEX: `owner-action-cards/INDEX.md`
- 前提 sub-card: `OWN-PRE-01-vercel-env-ga4-sentry.md`（DSN 投入が前提）
- 関連 runbook: `slack-alert-routing.md`（routing 規則） / `public-launch-vercel-rollback-runbook-2026-06-19.md`（alert を trigger として rollback 判断）
- DEC: DEC-019-062 / DEC-018-047（PRJ-018 hotfix での alert 運用知見）

---

**最終更新**: 2026-05-05（Round 21 第 2 波 / Web-Ops-H 起票）
**次回見直し**: 2026-06-16（D-3, alert sample が届いていることを再確認）
