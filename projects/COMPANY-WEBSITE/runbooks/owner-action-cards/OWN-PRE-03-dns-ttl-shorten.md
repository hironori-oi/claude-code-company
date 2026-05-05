# OWN-PRE-03: DNS TTL 短縮 300 秒 手順書

**対象**: Owner（hironori555@gmail.com）
**所有者**: Web-Ops 部門（手順 update）
**バージョン**: v1.0（Round 21 第 2 波 / Web-Ops-H 起票）
**親**: `launch-pre-ops-checklist.md` §7 OWN-PRE-03 / `owner-action-card-2026-06-19.md` CARD A
**関連**: `owner-action-cards/INDEX.md` / `launch-pre-ops-checklist.md` §2 ドメイン / DNS

---

## 0. 何を

DNS レジストラ（お名前.com 等）で `www.4wide.co.jp` および apex `4wide.co.jp` の TTL を 3600 秒から **300 秒** へ短縮する。

## 1. なぜ

- 公開当日（6/19 09:00 JST）に DNS 変更や rollback が必要になった場合、伝播時間を短縮するため。
- 通常運用は 3600 秒で良いが、公開前後 24h は 300 秒運用が業界標準。
- 公開 30 day review（7/27）後に 3600 秒へ戻す（Round 22+ で別 card 設計予定）。

## 2. 所要時間

10 min（レジストラログイン 2 min + TTL 編集 4 min + 伝播確認 4 min）

## 3. 期限

2026-06-18（D-1）17:00 JST まで（公開 16h 前）

## 4. pre-condition

- [ ] DNS レジストラ（お名前.com 等）の admin 権限ログイン情報を 1Password から取得可
- [ ] 現状 TTL が 3600 秒であることを `dig www.4wide.co.jp` で事前確認
- [ ] CNAME / A レコード等の **値は変更しない**（TTL のみ変更）
- [ ] 6/18 17:00 JST 時点で他の DNS 作業（ACME challenge 等）が走っていない

## 5. 実行 step（5-8 step）

1. **レジストラログイン**: クリック先 `https://www.onamae.com/navi/login.html`（または使用レジストラ） / 入力値 `1Password から ID / pass auto-fill` / 期待表示 `Domain Navi トップ画面`
2. **対象ドメイン選択**: クリック先 `ドメイン一覧 → 4wide.co.jp` / 入力値 -（クリックのみ） / 期待表示 `4wide.co.jp 詳細画面`
3. **DNS 設定画面へ**: クリック先 `DNS 設定 / DNS レコード設定` / 入力値 -（クリックのみ） / 期待表示 `現在のレコード一覧（CNAME / A / MX 等）`
4. **www レコード TTL 変更**: クリック先 `www.4wide.co.jp の編集ボタン` / 入力値 `TTL: 3600 → 300（既存 CNAME 値 = cname.vercel-dns.com は変更しない）` / 期待表示 `保存後 list で TTL 列が 300 と表示`
5. **apex レコード TTL 変更**: クリック先 `4wide.co.jp（apex）の編集ボタン` / 入力値 `TTL: 3600 → 300（既存 ALIAS / A 値は変更しない）` / 期待表示 `list で TTL 列が 300 と表示`
6. **伝播待機**: クリック先 `terminal` / 入力値 `dig +nocmd +noall +answer www.4wide.co.jp`（5 min 後再実行） / 期待表示 `TTL 列が 300 と表示（または 300 未満のカウントダウン）`
7. **apex も確認**: クリック先 `terminal` / 入力値 `dig +nocmd +noall +answer 4wide.co.jp` / 期待表示 `TTL が 300 へ移行`
8. **Slack 投稿**: クリック先 `Slack #prj-019-launch` / 入力値 `OWN-PRE-03 done HH:MM / TTL 300 OK` / 期待表示 `投稿表示`

## 6. post-condition

- `dig www.4wide.co.jp +short` で正しい CNAME が返り、TTL が 300（または 300 以下のカウント値）
- `dig 4wide.co.jp +short` で apex が正しい IP / ALIAS を返し、TTL が 300
- レジストラ画面 list で 2 レコードの TTL 列が 300 表示
- Slack に done 投稿済み

## 7. FAIL 時（Web-Ops 連絡先）

- 連絡 ch: Slack `#prj-019-launch` で `@web-ops` mention
- 連絡先 alt: メール直送
- Web-Ops が代行できる範囲: 操作画面 share / レコード値の事前読み合わせ（ただし TTL 変更ボタンは Owner 自身が押す = レジストラ ToS）
- 伝播が 30 min 経っても反映されない場合: レジストラサポート連絡（お名前.com の場合 24h SLA）
- 誤って CNAME / A 値を変更してしまった場合: **緊急** = Web-Ops に即時連絡 → 元値を `launch-pre-ops-checklist.md` §2 から復元

## 8. 関連リンク

- 親 checklist: `launch-pre-ops-checklist.md` §2 ドメイン / DNS / §7 OWN-PRE-03 行
- card 親: `owner-action-card-2026-06-19.md` CARD A
- INDEX: `owner-action-cards/INDEX.md`
- 公開後 fallback: `OWN-PRE-07-supabase-snapshot.md`（公開 30 min 前で時系列接続）
- 30 day review 後の戻し作業: Round 22+ で別 card 起票予定
- DEC: DEC-019-054 / DEC-019-062

---

**最終更新**: 2026-05-05（Round 21 第 2 波 / Web-Ops-H 起票）
**次回見直し**: 2026-06-18（実行直後）/ 2026-07-27（30 day review で戻し card 設計）
