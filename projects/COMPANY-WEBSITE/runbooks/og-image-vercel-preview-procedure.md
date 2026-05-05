# OG image Vercel preview deploy 検証手順

- 起票: PRJ-019 Round 21 Dev-II
- 起票日: 2026-05-05
- 対象: 本番 deploy 前の Vercel preview 環境での OG image route 動作検証
- 関連: `og-image-src-migration-spec.md` / `og-image-deploy-preview-checklist.md` / `launch-pre-ops-checklist.md`
- 実行 phase: Round 22 (本 spec は手順起票のみ、実 deploy は実施しない)

---

## §0 目的

src 物理化 (Round 22 path A → path B 移送) 完了後、本番 production deploy の前段として **Vercel preview environment** で OG image route が期待通り動作することを検証する。preview URL は production と同一の Vercel runtime / Edge / CDN 構成で動作するため、production fidelity の高い最終チェック手段である。

本手順は curl を主とし、副作用 0 で検証可能なものに限定。実 deploy は Round 22 で Owner ack 後に実施。

---

## §1 vercel build 起動

### 1.1 local build 検証 (deploy 前)

```bash
cd projects/COMPANY-WEBSITE/app
vercel build
```

これは Vercel runtime 上での build を local 再現する。`vercel build` は `pnpm build` より厳密で、Edge runtime / Node runtime の bundling 検証も含む。

### 1.2 PASS criteria

- exit code = 0
- `.vercel/output/functions/api/og.func/` が生成される
- `.vercel/output/config.json` に `/api/og` route が含まれる

### 1.3 vercel dev (オプション)

```bash
vercel dev
```

Vercel CLI 経由で local 起動、Edge runtime を local エミュレート。`pnpm dev` との差異は Edge runtime のテストが可能な点。

---

## §2 preview URL 取得

### 2.1 preview deploy コマンド

```bash
cd projects/COMPANY-WEBSITE/app
vercel deploy --prebuilt
```

`--prebuilt` flag は §1.1 で生成済の `.vercel/output/` を使用、追加 build 不要。

### 2.2 preview URL の取得

deploy 成功時、stdout に以下が出力:

```
✅  Production: https://company-website-xxx.vercel.app [copied to clipboard]
```

または preview の場合:

```
✅  Preview: https://company-website-git-feature-og-image-xxx.vercel.app
```

→ この URL を環境変数に保存:

```bash
export PREVIEW_URL="https://company-website-git-feature-og-image-xxx.vercel.app"
```

### 2.3 preview / production の使い分け

- `vercel deploy` (default) = preview environment
- `vercel deploy --prod` = production deploy (Round 22 の最終 step、Owner ack 必須)
- 本検証は **preview のみ**、production は本手順 PASS 後に別 procedure で実施

---

## §3 各 variant の curl test (8 case)

### 3.1 検証スクリプト

```bash
#!/bin/bash
set -e

PREVIEW_URL="${PREVIEW_URL:?PREVIEW_URL is not set}"
RESULT_DIR="/tmp/og-preview-verify-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULT_DIR"

CASES=(
  "home ja"
  "home en"
  "service ja"
  "service en"
  "case ja"
  "case en"
  "updates ja"
  "updates en"
)

for c in "${CASES[@]}"; do
  variant="${c% *}"
  locale="${c#* }"
  url="${PREVIEW_URL}/api/og?variant=${variant}&locale=${locale}"
  out="${RESULT_DIR}/og-${variant}-${locale}.png"

  echo "=== ${variant} / ${locale} ==="
  curl -sSL -D "${out}.headers" -o "${out}" "${url}"
  echo "  status: $(head -1 "${out}.headers")"
  echo "  size: $(stat -c %s "${out}") bytes"
  echo "  type: $(file -b "${out}")"
  echo ""
done

echo "Result dir: ${RESULT_DIR}"
```

### 3.2 期待結果

8 case 全てで:
- HTTP/2 200
- PNG image data, 1200 x 630
- ファイルサイズ > 1000 byte (空 PNG ではない)

---

## §4 response 検証

### 4.1 status code

```bash
curl -o /dev/null -s -w "%{http_code}\n" "${PREVIEW_URL}/api/og?variant=home&locale=ja"
# Expected: 200
```

### 4.2 content-type

```bash
curl -I -s "${PREVIEW_URL}/api/og?variant=home&locale=ja" | grep -i content-type
# Expected: content-type: image/png
```

### 4.3 body byte size

```bash
curl -sSL "${PREVIEW_URL}/api/og?variant=home&locale=ja" | wc -c
# Expected: > 1000 (typically 30000-200000)
```

### 4.4 PNG signature 検証

```bash
curl -sSL "${PREVIEW_URL}/api/og?variant=home&locale=ja" | head -c 8 | xxd
# Expected: 00000000: 8950 4e47 0d0a 1a0a  (PNG signature)
```

### 4.5 image 解像度検証

```bash
curl -sSL "${PREVIEW_URL}/api/og?variant=home&locale=ja" -o /tmp/og.png
file /tmp/og.png
# Expected: PNG image data, 1200 x 630, 8-bit/color RGBA, non-interlaced
```

---

## §5 cache-control header 検証

### 5.1 期待 header

```
Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800
```

### 5.2 検証コマンド

```bash
curl -I -s "${PREVIEW_URL}/api/og?variant=home&locale=ja" | grep -iE 'cache-control|x-vercel-cache|age'
```

### 5.3 期待 output (初回 = MISS)

```
cache-control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800
x-vercel-cache: MISS
age: 0
```

### 5.4 期待 output (2 回目 = HIT)

同 URL を再 curl:

```
cache-control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800
x-vercel-cache: HIT
age: 5
```

→ `x-vercel-cache: HIT` が確認できれば CDN cache が機能している。

---

## §6 dynamic params URL encoding 検証

### 6.1 想定 query parameter

| param | 値 | URL encoding |
|---|---|---|
| `variant` | `home` / `service` / `case` / `updates` | 不要 (英数のみ) |
| `locale` | `ja` / `en` | 不要 |
| `title` (optional) | 任意の string | encodeURIComponent 必要 |

### 6.2 日本語 title での encoding test

```bash
TITLE_JA="$(printf '%s' '中小企業のためのAIエージェント' | python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read()))')"
curl -I -s "${PREVIEW_URL}/api/og?variant=home&locale=ja&title=${TITLE_JA}"
# Expected: 200, image/png
```

### 6.3 special character での encoding test

```bash
# & を含む title
TITLE="A%26B"
curl -I -s "${PREVIEW_URL}/api/og?variant=home&locale=ja&title=${TITLE}"

# space を含む title
TITLE="hello%20world"
curl -I -s "${PREVIEW_URL}/api/og?variant=home&locale=ja&title=${TITLE}"
```

---

## §7 fallback 経路検証

### 7.1 variant 不正値

```bash
curl -I -s "${PREVIEW_URL}/api/og?variant=invalid&locale=ja"
```

期待動作 (Round 20 e2e spec §6 fallback 戦略に基づく):
- HTTP 200 (フォールバック画像を返す)
- variant=home の image を返す or デフォルト variant を返す
- もしくは HTTP 400 で明示エラー

→ Round 20 spec に従い、**HTTP 200 + variant=home fallback** が正解。

### 7.2 locale 不正値

```bash
curl -I -s "${PREVIEW_URL}/api/og?variant=home&locale=fr"
```

期待動作:
- HTTP 200
- locale=ja (default) の image を返す

### 7.3 文字数超過 (title)

```bash
LONG_TITLE="$(python3 -c 'print("x" * 500)')"
curl -I -s "${PREVIEW_URL}/api/og?variant=home&locale=ja&title=${LONG_TITLE}"
```

期待動作:
- HTTP 200
- title が ellipsis (`...`) で truncate された image を返す
- truncate 閾値は Round 20 template-design-v1 で定義 (推定 60 chars)

### 7.4 query parameter 完全欠落

```bash
curl -I -s "${PREVIEW_URL}/api/og"
```

期待動作:
- HTTP 200
- variant=home, locale=ja の default image を返す

### 7.5 fallback 検証マトリクス

| input | 期待 status | 期待 variant | 期待 locale |
|---|---|---|---|
| `?variant=invalid&locale=ja` | 200 | home (fallback) | ja |
| `?variant=home&locale=fr` | 200 | home | ja (fallback) |
| `?variant=&locale=` | 200 | home | ja |
| (no params) | 200 | home | ja |
| `?title=<long>` | 200 | home | ja, title truncated |

---

## §8 Owner ack 取得手順

### 8.1 ack 必要性

Round 22 で本 spec に従い preview deploy が成功し §3-§7 全 PASS した後、Vercel production deploy を実行する前に Owner の formal ack を取得する。理由: 6/19 公開直前のタイミングでの production 反映は不可逆的影響あり。

### 8.2 Slack post 内容

post 先: `#prj-019-launch` channel

```
[Round 22] OG image preview deploy ack request

preview URL (variant 4 種、各 ja/en):
- https://<preview>.vercel.app/api/og?variant=home&locale=ja
- https://<preview>.vercel.app/api/og?variant=home&locale=en
- https://<preview>.vercel.app/api/og?variant=service&locale=ja
- https://<preview>.vercel.app/api/og?variant=service&locale=en
- https://<preview>.vercel.app/api/og?variant=case&locale=ja
- https://<preview>.vercel.app/api/og?variant=case&locale=en
- https://<preview>.vercel.app/api/og?variant=updates&locale=ja
- https://<preview>.vercel.app/api/og?variant=updates&locale=en

curl 8 case status: ALL 200
content-type: ALL image/png
PNG signature: ALL OK
cache-control: 期待値一致
x-vercel-cache: HIT 確認
fallback (§7.1-7.4): 全 PASS

production deploy 可否を ack 願います。
NG の場合は対象 variant を指定願います。
```

### 8.3 pin 推奨

各 preview URL を 4 種 (= variant 数) Slack に pin → Owner が後追い確認できる状態を維持。

### 8.4 ack 取得後の production deploy

```bash
vercel deploy --prod
```

これは本 spec の対象外。`launch-pre-ops-checklist.md` または `public-launch-sop.md` に従う。

---

EOF
