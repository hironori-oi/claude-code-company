# Runbook: OG Image E2E Test Spec — `/api/og` 動的生成 検証仕様

**対象案件**: PRJ-019 Open Claw "Clawbridge"（公開 2026-06-19 09:00 JST）
**所有者**: Web-Ops 部門 / Dev 部門協力（CI 組込み）
**バージョン**: v1.0（Round 20 第 2 波 / Web-Ops-G 起票）
**関連**: `og-image-production-spec-2026-06-27.md` / `og-image-template-design-v1.md` / `app/api/og/route.tsx` / `og-image-deploy-preview-checklist.md`

---

## 0. 目的

`/api/og` route の **動作 / response / cache / encoding / 視覚的整合** を E2E で検証し、6/19 公開前に 4 variant × 2 locale = 8 case が production preview で破綻なく動くことを物理的に保証する。
本書は仕様 only / 実 deploy / 実 test 実行は禁止（副作用 0）。実行は 6/12 (D-7) 想定で Web-Ops + Dev 部門の共同実施。

副作用 0 / 絵文字 0 / API 追加コスト $0（curl + Playwright + Vercel CLI のみ）。

---

## 1. 各 variant × locale curl test（4 endpoint × 2 locale = 8 case）

### 1.1 test 対象 endpoint 一覧

| # | variant | locale | URL（preview base 想定） |
|---|---|---|---|
| 1 | home | ja | `${BASE}/api/og?variant=home&locale=ja` |
| 2 | home | en | `${BASE}/api/og?variant=home&locale=en` |
| 3 | portfolio | ja | `${BASE}/api/og?variant=portfolio&locale=ja` |
| 4 | portfolio | en | `${BASE}/api/og?variant=portfolio&locale=en` |
| 5 | case-study | ja | `${BASE}/api/og?variant=case-study&title=PRJ-004&subtitle=iPhone%20%E3%82%A2%E3%83%97%E3%83%AA&locale=ja` |
| 6 | case-study | en | `${BASE}/api/og?variant=case-study&title=PRJ-004&subtitle=iPhone%20App&locale=en` |
| 7 | about | ja | `${BASE}/api/og?variant=about&locale=ja` |
| 8 | about | en | `${BASE}/api/og?variant=about&locale=en` |

`${BASE}` は preview deploy URL（例: `https://prj019-xxxxx.vercel.app`）または production（公開後）。

### 1.2 各 case 共通 curl コマンド

```bash
curl -sS -D - -o /tmp/og-${CASE_ID}.png "${URL}"
```

`-D -` でヘッダー出力、`-o` で body を PNG として保存。8 case で `/tmp/og-1.png` 〜 `/tmp/og-8.png` を生成。

---

## 2. response 検証 (status / content-type / body 非空)

各 case で以下 3 項目をチェック:

| 項目 | 期待値 | 検証コマンド例 |
|---|---|---|
| HTTP status | `200 OK` | `curl -o /dev/null -s -w "%{http_code}\n" "${URL}"` → `200` |
| Content-Type | `image/png` | `curl -sI "${URL}" \| grep -i 'content-type'` → `Content-Type: image/png` |
| body size | `> 0 byte`（目標 50KB〜250KB） | `wc -c /tmp/og-${CASE_ID}.png` → 50000 以上 |
| PNG 署名 | 先頭 8 byte = `89 50 4E 47 0D 0A 1A 0A` | `xxd -l 8 /tmp/og-${CASE_ID}.png` で確認 |

**fail 判定**:
- status != 200 → route.tsx 例外 (catch 経路) または routing 未配置を疑う
- content-type が image/svg+xml → SVG fallback 経路 (例外発生) → ログ確認
- body < 1000 byte → ImageResponse 失敗 (font fetch failure 等)

---

## 3. visual regression test（Playwright + Percy or Chromatic）

### 3.1 仕組み

Playwright で 8 case の URL を `<img>` または直接 navigation で開き、screenshot を取得。
ベースライン画像 (Round 20 で初回起票) と差分比較。

### 3.2 設置場所（提案、実装は別 phase）

- test ファイル: `projects/COMPANY-WEBSITE/app/tests/e2e/og-image.spec.ts`（実装は Round 21+）
- baseline 格納: `projects/COMPANY-WEBSITE/app/tests/e2e/__snapshots__/og-image/`（Percy 利用時は Percy 側、Chromatic も同様）
- 差分閾値: pixel diff 0.1% 以下を pass、0.1〜1.0% は warn、1.0% 超は fail

### 3.3 注意点

- Percy / Chromatic は外部サービス契約が必要（API 追加コスト発生 → DEC-019-XXX で別途承認が必要、本書は採用判断保留）
- 内製代替: Playwright `toHaveScreenshot()` + GitHub Actions artifact 保存（コスト 0）
- font の sub-pixel rendering OS 差異を吸収するため `threshold: 0.2`、`maxDiffPixels: 100` 推奨
- 本 spec では Playwright 内製案を一次推奨、Percy / Chromatic は将来オプション

---

## 4. cache-control header 検証

### 4.1 期待値（route.tsx で設定済み）

```
Cache-Control: public, max-age=31536000, immutable, s-maxage=86400, stale-while-revalidate=604800
Content-Type: image/png
X-Content-Type-Options: nosniff
```

### 4.2 検証コマンド

```bash
curl -sI "${URL}" | grep -iE '(cache-control|content-type|x-content-type-options)'
```

### 4.3 fail 判定

- `Cache-Control` に `no-store` / `no-cache` が含まれている → ImageResponse 例外経路 (SVG fallback) を疑う
- `s-maxage` が無い → Vercel CDN 適用が効かない構成、deploy 設定確認
- `immutable` が無い → 短期リフレッシュが起こり OG crawler に負荷、route.tsx ヘッダー再確認

---

## 5. dynamic params の URL encoding 検証

### 5.1 検証対象 params

- `title` (max 60 chars): 日本語 / 半角スペース / 半角記号 (`-` `:` `&`) を含む文字列
- `subtitle` (max 80 chars): 同上
- `variant` (whitelist 4 値): 不正値 → home に silent fallback
- `locale` (whitelist 2 値): 不正値 → ja に silent fallback

### 5.2 test cases

| # | input | encoded | 期待 |
|---|---|---|---|
| 5-1 | `title=PRJ-019 Open Claw` | `title=PRJ-019%20Open%20Claw` | 200 + title 表示 |
| 5-2 | `title=日本語タイトル` | `title=%E6%97%A5%E6%9C%AC%E8%AA%9E%E3%82%BF%E3%82%A4%E3%83%88%E3%83%AB` | 200 + 日本語が崩れず表示 |
| 5-3 | `title=A&B=C` (`&` 含み) | `title=A%26B%3DC` | 200 + `A&B=C` 表示（`&` で param 切れない）|
| 5-4 | `title=` 61 文字超 | 62 文字 | 200 + 60 文字 + ellipsis (`…`) |
| 5-5 | `variant=invalid` | 同上 | 200 + home variant にフォールバック (warn log) |
| 5-6 | `locale=fr` | 同上 | 200 + ja にフォールバック |
| 5-7 | `title=` empty | `title=` | 200 + variant default title 表示 |
| 5-8 | `title=` + script tag | `title=%3Cscript%3Ealert(1)%3C/script%3E` | 200 + テキストとして表示（XSS 不発生 = ImageResponse は SVG escape）|

### 5.3 XSS 観点

ImageResponse は文字列を SVG 経由でラスタ化するため、HTML 注入は理論上発生しない。ただし
- title / subtitle が 1 文字 ellipsis 後に script 識別子っぽく見えても、実体は raster pixel
- response が `image/png` で `Content-Type` 固定 → ブラウザが HTML として解釈しない
- 念のため Round 21 で penetration test 1 case（5-8）を実施し、Sentry へのログ漏れ含めて確認

---

## 6. 6/12 (D-7) 本 test 実行計画

### 6.1 実施スコープ

| 項目 | 担当 | 想定時間 |
|---|---|---|
| §1〜§2 curl 8 case | Web-Ops | 30 min（preview deploy 起動後）|
| §4 cache-control 8 case | Web-Ops | 10 min |
| §5 encoding 8 case | Web-Ops | 30 min |
| §3 visual regression baseline 取得（初回） | Dev | 60 min（Playwright 設定込み）|
| 結果 screenshot を Slack `#prj-019-launch` に投稿 | Web-Ops | 15 min |

合計 約 2.5 時間 / D-7 当日に余裕を持って完了。

### 6.2 pass 条件

- §1〜§2: 8/8 case で 200 + image/png + body > 0
- §4: 8/8 case で Cache-Control が期待ヘッダーと完全一致
- §5: 8/8 case で encoding 期待挙動 (特に `&` 含み / 日本語 / ellipsis)
- §3: baseline 取得完遂（差分比較は次回 D-1 で実施）

### 6.3 fail 時の escalation

- 1 case でも fail → Web-Ops が即時 Slack 投稿、Dev 部門が route.tsx を hotfix
- D-7 fail のまま D-3 を超える場合 → §6 fallback (Round 19 spec の固定 OG 画像で公開) を CEO 経由で承認

### 6.4 D-1 (6/26) 再実行

- launch-readiness-consolidation §2 当日タイムライン T-30min OWN-PRE-07 直後に §1〜§2 + §4 を再実行（smoke 扱い、20 min）
- 結果は OG debugger 3 件（Facebook / Twitter / LinkedIn）で目視確認、KPI E-5 「OG image 配置適合率」3/3 pass を満たす

---

## 7. 関連 DEC

- DEC-019-054 / DEC-019-062 / DEC-019-033 / DEC-018-047

---

**最終更新**: 2026-05-05（Round 20 第 2 波 / Web-Ops-G 起票）
**次回見直し**: 2026-06-12（D-7 実行直前）/ 2026-06-26（D-1 smoke 直前）
