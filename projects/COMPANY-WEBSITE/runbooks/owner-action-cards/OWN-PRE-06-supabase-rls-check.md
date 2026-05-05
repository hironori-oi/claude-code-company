# OWN-PRE-06: Supabase RLS 全 table 確認手順書

**対象**: Owner（hironori555@gmail.com）
**所有者**: Web-Ops 部門（手順 update）
**バージョン**: v1.0（Round 21 第 2 波 / Web-Ops-H 起票）
**親**: `launch-pre-ops-checklist.md` §7 OWN-PRE-06 / `owner-action-card-2026-06-19.md` CARD A
**関連**: `owner-action-cards/INDEX.md` / `OWN-PRE-02-vercel-env-supabase.md`

---

## 0. 何を

Supabase Dashboard で `public` schema の全 table の **RLS（Row Level Security）が ON** であることを目視確認する。修正は Dev 部門が行うため、Owner は **確認のみ**。

## 1. なぜ

- 公開後 anon key が client bundle に含まれる前提のため、RLS が OFF の table があると全データが anon から read / write 可能となり情報漏洩 risk。
- Owner check は Dev による確認の独立検証として機能する（4 eyes 原則）。
- 6/19 公開直前まで table 追加が走るため、D-4（6/15）時点で再確認することが必須。

## 2. 所要時間

15 min（Supabase ログイン 2 min + Database 画面遷移 2 min + table 一覧 scan 8 min + 集計 / 報告 3 min）

## 3. 期限

2026-06-15（D-4）23:59 JST まで

## 4. pre-condition

- [ ] OWN-PRE-02 完了済み（Supabase project URL を知っている）
- [ ] Supabase Dashboard へ Owner 権限でログインできる
- [ ] Supabase project `prj-019-clawbridge`（または当該 project）の Member に Owner email が登録済み（権限: Owner / Admin）
- [ ] Dev 部門の事前 RLS 設定報告（Slack `#prj-019-launch`）を読了済み

## 5. 実行 step（5-8 step）

1. **Supabase ログイン**: クリック先 `https://supabase.com/dashboard` / 入力値 `Owner email + password（1Password）` / 期待表示 `Projects 一覧`
2. **Project 選択**: クリック先 `prj-019-clawbridge プロジェクト` / 入力値 -（クリックのみ） / 期待表示 `Project Home（Database / Auth / Storage / Edge Functions tab）`
3. **Database → Tables 画面へ**: クリック先 `左 nav → Database → Tables` / 入力値 -（クリックのみ） / 期待表示 `public schema の全 table 一覧（最大 20 件想定: case_studies / portfolio_items / contact_submissions 等）`
4. **RLS バッジを scan**: クリック先 `各 table 行の右側` / 入力値 -（scroll） / 期待表示 `全 table 行に "RLS enabled" green badge`
5. **OFF を発見した場合の記録**: クリック先 -（メモ） / 入力値 `table 名 + 行番号を memo` / 期待表示 -（記録のみ、本人による修正は禁止）
6. **anon 権限の sanity 確認**: クリック先 `SQL Editor` / 入力値 `select count(*) from public.case_studies;`（anon role で実行） / 期待表示 `RLS で許可された行数のみ返却（全件返却なら policy 問題）`
7. **集計表作成**: クリック先 -（手元 memo） / 入力値 `全 N table のうち RLS ON: M / OFF: K / 不明: L` / 期待表示 -（数値確定）
8. **Slack 投稿**: クリック先 `Slack #prj-019-launch` / 入力値 `OWN-PRE-06 done HH:MM / N table 中 RLS ON: M（全 green の場合は "全 N table green" と記載）` / 期待表示 `投稿表示`

## 6. post-condition

- Supabase Dashboard で全 public table 行に RLS ON badge 表示
- もし OFF table があれば Slack 投稿に table 名を列挙し、Dev 部門に @mention で修正依頼
- SQL editor で anon 経由 select が RLS policy 通りの結果を返す（全件返却ではない）
- Slack `#prj-019-launch` に集計値付き done 投稿済み

## 7. FAIL 時（Web-Ops 連絡先）

- 連絡 ch: Slack `#prj-019-launch` で `@web-ops` + `@dev` mention
- 連絡先 alt: メール直送
- Web-Ops が代行できる範囲: 画面 share / 確認手順の伴走（ただし RLS 修正は Dev 部門のみ）
- OFF table 発見時: Owner は **修正しない**（Dev に報告のみ）。Dev が `alter table public.xxx enable row level security;` を実行 → Owner が再確認
- public schema 以外（auth / storage 等）の table は本確認の対象外

## 8. 関連リンク

- 親 checklist: `launch-pre-ops-checklist.md` §5 RLS / Supabase / §7 OWN-PRE-06 行
- card 親: `owner-action-card-2026-06-19.md` CARD A
- INDEX: `owner-action-cards/INDEX.md`
- 前提 sub-card: `OWN-PRE-02-vercel-env-supabase.md`（key 投入が前提）
- 次 sub-card: `OWN-PRE-07-supabase-snapshot.md`（DB backup が時系列接続）
- DEC: DEC-019-054 / DEC-019-062 / DEC-018-047（PRJ-018 hotfix で RLS 起因 incident 知見）

---

**最終更新**: 2026-05-05（Round 21 第 2 波 / Web-Ops-H 起票）
**次回見直し**: 2026-06-16（D-3, OFF table 修正完了の最終確認）
