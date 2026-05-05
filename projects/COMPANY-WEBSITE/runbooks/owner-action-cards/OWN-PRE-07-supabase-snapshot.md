# OWN-PRE-07: Supabase manual snapshot 取得手順書

**対象**: Owner（hironori555@gmail.com）
**所有者**: Web-Ops 部門（手順 update）
**バージョン**: v1.0（Round 21 第 2 波 / Web-Ops-H 起票）
**親**: `launch-pre-ops-checklist.md` §7 OWN-PRE-07 / `owner-action-card-2026-06-19.md` CARD A
**関連**: `owner-action-cards/INDEX.md` / `OWN-PRE-06-supabase-rls-check.md` / `public-launch-vercel-rollback-runbook-2026-06-19.md`

---

## 0. 何を

公開当日 6/19 09:00 JST の **30 分前**（08:30 JST）に Supabase Dashboard で manual snapshot を取得し、snapshot ID を Slack `#prj-019-launch` に pin する。

## 1. なぜ

- 公開直後の DB 操作で schema 破壊や data 大量欠損が発生した場合の rollback ポイントを明示するため。
- 自動 PITR は 7 日保持されるが、特定の「公開直前」時点を指定 restore する場合は manual snapshot が確実。
- snapshot ID を Slack pin することで、rollback 時に判断者全員が同じ ID を即時参照できる。

## 2. 所要時間

5 min（Supabase ログイン 1 min + snapshot 取得 2 min + ID copy / Slack pin 2 min）

## 3. 期限

2026-06-19 08:30 JST（公開 30 分前 = 厳守、08:25-08:35 の 10 min window）

## 4. pre-condition

- [ ] OWN-PRE-06 完了済み（Supabase Dashboard 操作経験あり / Member 権限確認済み）
- [ ] 6/19 08:25 JST 時点で Supabase Dashboard にログイン可能（事前 6/19 08:00 にログイン確認推奨）
- [ ] Supabase Pro plan 以上（manual snapshot 機能が plan 依存）
- [ ] Slack `#prj-019-launch` の pin 操作権限あり（Owner / Web-Ops）

## 5. 実行 step（5-8 step）

1. **Supabase ログイン**: クリック先 `https://supabase.com/dashboard` / 入力値 `Owner email + password（1Password、08:25 JST までに完了）` / 期待表示 `Projects 一覧 / 直接 prj-019 を表示`
2. **Database → Backups 画面へ**: クリック先 `左 nav → Database → Backups` / 入力値 -（クリックのみ） / 期待表示 `Backups 一覧（PITR 設定 + 過去 manual snapshot 履歴）`
3. **Take a backup を実行**: クリック先 `右上 "Take a backup" or "Create backup" ボタン` / 入力値 -（confirm dialog で OK） / 期待表示 `"Backup in progress" 表示 / 通常 30-90 秒で完了`
4. **完了待機**: クリック先 -（画面リロード） / 入力値 -（自動更新） / 期待表示 `新規 snapshot 行が "Completed" status で表示 / ID（uuid 形式）が表示`
5. **snapshot ID を copy**: クリック先 `snapshot 行 → "..." メニュー → "Copy ID"` / 入力値 -（クリック） / 期待表示 `clipboard に uuid copy / "Copied" 通知`
6. **Slack に投稿**: クリック先 `Slack #prj-019-launch` / 入力値 `OWN-PRE-07 done 08:XX JST / snapshot ID: <uuid> / 公開時 rollback ポイント` / 期待表示 `投稿表示`
7. **投稿を pin**: クリック先 `自分の投稿 → "..." → "Pin to channel"` / 入力値 -（confirm） / 期待表示 `投稿に pin badge 表示 / channel pinned items に追加`
8. **Web-Ops に ack 要求**: クリック先 `投稿に thread reply` / 入力値 `@web-ops snapshot pin 確認お願いします` / 期待表示 `Web-Ops から thumbs up reaction または "ack" 返信`

## 6. post-condition

- Supabase Backups 画面に当日 08:30 JST 取得の snapshot が `Completed` で存在
- Slack `#prj-019-launch` に snapshot ID 付き投稿が **pinned** 状態
- Web-Ops から ack 取得済み
- 公開後の rollback 判断者（Owner / Web-Ops / CEO）の 3 名が同じ ID を即時参照可

## 7. FAIL 時（Web-Ops 連絡先）

- 連絡 ch: Slack `#prj-019-launch` で `@web-ops` mention（最優先）
- 連絡先 alt: 直接電話 / Web-Ops 部門 Slack DM
- Web-Ops が代行できる範囲: snapshot 取得は Owner / Admin 権限必須なので **代行不可**（Owner が必ず実行）
- snapshot 取得が 90 秒経っても完了しない場合: Supabase Status page を確認 → Status 異常なら公開判断（CARD C GO 発声）に重大影響 → CEO へ即時 escalate
- ID copy 失敗の場合: snapshot 行の URL 末尾 uuid を手動で読み取り Slack 投稿
- snapshot 取得自体が plan 制限で不可の場合: PITR 単独運用に切替（Web-Ops 判断）

## 8. 関連リンク

- 親 checklist: `launch-pre-ops-checklist.md` §6 Backup / Rollback / §7 OWN-PRE-07 行
- card 親: `owner-action-card-2026-06-19.md` CARD A / CARD C（公開最終確認の前提）
- INDEX: `owner-action-cards/INDEX.md`
- 前提 sub-card: `OWN-PRE-06-supabase-rls-check.md`
- 直後接続 runbook: `public-launch-vercel-rollback-runbook-2026-06-19.md`（rollback 時に本 snapshot ID を参照）
- DEC: DEC-019-062 / DEC-018-047（PRJ-018 hotfix で snapshot rollback 知見）

---

**最終更新**: 2026-05-05（Round 21 第 2 波 / Web-Ops-H 起票）
**次回見直し**: 2026-06-19 08:00 JST（実行 30 分前のリハーサル確認）
