# Runbook: OG Image Vercel Preview Deploy Validation

**対象案件**: PRJ-019 Open Claw "Clawbridge"（公開 2026-06-19 09:00 JST）
**所有者**: Web-Ops 部門 / Round 22 で実 vercel preview deploy を実施する Web-Ops オペレータ向け
**バージョン**: v1.0（Round 21 第 2 波 / Web-Ops-H 起票）
**関連**: `og-image-template-design-v1.md` / `og-image-deploy-preview-checklist.md` / `og-image-e2e-test-spec.md` / `og-image-production-spec-2026-06-27.md` / `app/api/og/route.tsx`

---

## 0. 目的

Round 22 で実施する **実 vercel preview deploy** の準備として、4 variant × 2 locale = 8 case が破綻なく生成されることを「事前手順書」として確定する。本書は spec のみ（副作用 0 / API 追加コスト $0）。実 deploy / 実 baseline PNG 生成 / 実 Slack 投稿は禁止 = 起票のみ。

`og-image-deploy-preview-checklist.md`（Round 20 Web-Ops-G）が「checklist」を提供するのに対し、本書は **detailed step-by-step procedure** を提供。Round 22 Web-Ops オペレータは本書通りに実施することで自己完結可能。

---

## 1. Vercel Project 設定確認（pre-flight, 5 min）

実 preview deploy の前に以下が成立していることを確認:

| # | 項目 | 確認方法 | 期待 |
|---|---|---|---|
| 1.1 | Vercel Project `company-website` 存在 | `vercel projects ls \| grep company-website` | 1 行 hit |
| 1.2 | Project が GitHub repo `4wide/company-website` に link | `vercel link` 確認 / Dashboard → Git Integration | "Connected to 4wide/company-website" |
| 1.3 | `app/api/og/route.tsx` が main branch に存在 | `git ls-files app/api/og/route.tsx` | 1 行 hit |
| 1.4 | `runtime = "edge"` 宣言維持 | `grep -n runtime app/api/og/route.tsx` | `export const runtime = "edge"` |
| 1.5 | 環境変数 `NEXT_PUBLIC_SITE_URL` が Preview scope で設定済み | `vercel env ls preview \| grep SITE_URL` | 1 行 hit |
| 1.6 | font fetch URL `https://fonts.gstatic.com/...` が到達可能 | `curl -sI https://fonts.gstatic.com/s/geist/v1/...woff2` | HTTP 200 |

全 6 項目 green でない場合、preview deploy を実施しない（Web-Ops で原因切り分け後に再実行）。

---

## 2. Vercel Build Local 起動手順（10 min）

local で `vercel build` を実行し、Edge Function build 成果物が壊れていないことを確認:

```bash
cd projects/COMPANY-WEBSITE/app
vercel link              # 未 link なら実行（既存 link あれば skip）
vercel pull --environment=preview  # preview env を local に pull
vercel build             # build artifact を .vercel/output に生成
```

期待出力:
- `.vercel/output/functions/api/og.func/.vc-config.json` に `"runtime": "edge"`
- `.vercel/output/static/_next/static/*` が生成
- build log の最終行に `Build Completed in .vercel/output [XXs]`

failure 時:
- Edge Function 制約違反（Node.js API 使用等）→ Dev に diff 確認依頼
- font fetch timeout → §1.6 再確認 + 別 font CDN を Web-Ops で検討

---

## 3. Preview URL 取得手順（5 min）

```bash
cd projects/COMPANY-WEBSITE/app
vercel deploy --prebuilt
# → 出力例: https://prj019-xxxxx-4wide.vercel.app
```

**禁止**: `vercel --prod` / `vercel deploy --prod` / `vercel promote` の本番昇格コマンドは Round 22 で **絶対に実行しない**（本番 deploy は 6/19 09:00 JST のみ）。

取得した preview URL を以下の形式で記録:

```
PREVIEW_URL=https://prj019-xxxxx-4wide.vercel.app
DEPLOY_ID=dpl_xxxxxxxxxxxxx
DEPLOYED_AT=YYYY-MM-DDTHH:MM:SSZ
```

`DEPLOY_ID` は `vercel inspect $PREVIEW_URL` で取得可能。

---

## 4. 4 variant × 2 locale = 8 case curl test（15 min）

`PREVIEW_URL` に対して 8 case を curl で順次叩く:

```bash
BASE=$PREVIEW_URL

# Case 1: home / ja
curl -sIL "$BASE/api/og?variant=home&locale=ja"
# Case 2: home / en
curl -sIL "$BASE/api/og?variant=home&locale=en"
# Case 3: portfolio / ja
curl -sIL "$BASE/api/og?variant=portfolio&locale=ja"
# Case 4: portfolio / en
curl -sIL "$BASE/api/og?variant=portfolio&locale=en"
# Case 5: case-study / ja with title param
curl -sIL "$BASE/api/og?variant=case-study&title=PRJ-004&locale=ja"
# Case 6: case-study / en with title param
curl -sIL "$BASE/api/og?variant=case-study&title=PRJ-004&locale=en"
# Case 7: about / ja
curl -sIL "$BASE/api/og?variant=about&locale=ja"
# Case 8: about / en
curl -sIL "$BASE/api/og?variant=about&locale=en"
```

各 case で response body を保存（visual baseline 取得用）:

```bash
for i in 1 2 3 4 5 6 7 8; do
  curl -sL "$BASE/api/og?...case-${i}-params..." -o "preview-case-${i}.png"
done
```

---

## 5. 各 case の expected output（詳細）

| # | variant | locale | 期待 status | 期待 content-type | 期待 body byte | 期待 cache-control |
|---|---|---|---|---|---|---|
| 1 | home | ja | 200 | `image/png` | 80,000 - 200,000 byte | `public, max-age=60, s-maxage=86400` |
| 2 | home | en | 200 | `image/png` | 80,000 - 200,000 byte | 同上 |
| 3 | portfolio | ja | 200 | `image/png` | 80,000 - 200,000 byte | 同上 |
| 4 | portfolio | en | 200 | `image/png` | 80,000 - 200,000 byte | 同上 |
| 5 | case-study | ja | 200 | `image/png` | 80,000 - 200,000 byte | 同上 |
| 6 | case-study | en | 200 | `image/png` | 80,000 - 200,000 byte | 同上 |
| 7 | about | ja | 200 | `image/png` | 80,000 - 200,000 byte | 同上 |
| 8 | about | en | 200 | `image/png` | 80,000 - 200,000 byte | 同上 |

各 case の追加検証:
- `x-vercel-id` header に edge region コード（`hnd1` / `nrt1` / 等）が含まれる
- `content-length` が 80KB 以上、200KB 以下（極端な小さすぎ / 大きすぎは生成異常）
- `x-vercel-cache` が初回 `MISS`、2 回目以降 `HIT`

---

## 6. fallback 経路検証（10 min）

異常系入力で fallback が機能することを確認:

| # | 入力 | 期待挙動 |
|---|---|---|
| 6.1 | `?variant=invalid&locale=ja` | variant=home として fallback / 200 / valid PNG |
| 6.2 | `?variant=home&locale=zh` | locale=ja として fallback / 200 / valid PNG |
| 6.3 | `?variant=case-study&title=` + 200 文字 | title が ellipsis でクリップ / 200 / valid PNG |
| 6.4 | `?variant=case-study` (title 省略) | default title `Case Study` で生成 / 200 |
| 6.5 | `?` (全 param 省略) | 全 fallback で home/ja を返す / 200 |
| 6.6 | `?variant=home&locale=<script>` | sanitize 後 ja として処理 / 200 / XSS 不可 |

route.tsx の fallback 実装が `og-image-template-design-v1.md` §1〜§5 と一致することを併せて確認。

---

## 7. visual baseline 取得（Playwright `toHaveScreenshot()` 8 枚, 15 min）

**注意**: 本書は spec 起票のみ。Round 22 で Dev 部門が実 baseline PNG を生成する際の手順を以下に明示:

```ts
// projects/COMPANY-WEBSITE/app/tests/og-visual.spec.ts (Round 22 で起票予定)
import { test, expect } from "@playwright/test";

const BASE = process.env.PREVIEW_URL!;

const cases = [
  { name: "home-ja", path: "/api/og?variant=home&locale=ja" },
  { name: "home-en", path: "/api/og?variant=home&locale=en" },
  { name: "portfolio-ja", path: "/api/og?variant=portfolio&locale=ja" },
  { name: "portfolio-en", path: "/api/og?variant=portfolio&locale=en" },
  { name: "case-study-ja", path: "/api/og?variant=case-study&title=PRJ-004&locale=ja" },
  { name: "case-study-en", path: "/api/og?variant=case-study&title=PRJ-004&locale=en" },
  { name: "about-ja", path: "/api/og?variant=about&locale=ja" },
  { name: "about-en", path: "/api/og?variant=about&locale=en" },
];

for (const c of cases) {
  test(`og-${c.name}`, async ({ page }) => {
    const res = await page.goto(`${BASE}${c.path}`);
    expect(res?.status()).toBe(200);
    await expect(page).toHaveScreenshot(`og-${c.name}.png`, {
      maxDiffPixelRatio: 0.001,
    });
  });
}
```

baseline PNG 8 枚を `tests/og-visual.spec.ts-snapshots/` 配下に保存し、git commit する（branch: `feature/round22-og-baseline`）。

Round 22 でこの spec を実装し、Round 23 以降の deploy で `npm run test:visual` を CI に組み込む（Round 22 着地条件）。

---

## 8. Owner ack 取得手順（5 min）

8 case 全 green 後、Slack `#prj-019-launch` に preview URL 4 件（home / portfolio / case-study / about の representative URL）を pin 投稿:

```
[Round 22 OG preview deploy ack 要請]
deploy ID: dpl_xxxxxxxxxxxxx
home preview: https://prj019-xxxxx-4wide.vercel.app/api/og?variant=home&locale=ja
portfolio preview: https://prj019-xxxxx-4wide.vercel.app/api/og?variant=portfolio&locale=ja
case-study preview: https://prj019-xxxxx-4wide.vercel.app/api/og?variant=case-study&title=PRJ-004&locale=ja
about preview: https://prj019-xxxxx-4wide.vercel.app/api/og?variant=about&locale=ja

Owner: 上記 4 URL を mobile / PC で開き「OG preview ack」と返信お願いします。
```

Owner が「OG preview ack」と返信したら、Web-Ops は thread に「ack received HH:MM」を投稿し、本 runbook の post-condition を満たす。

---

## 9. 失敗時 rollback（Vercel `Promote to Production` 戻し）

preview deploy 結果が NG（8 case のうち 1 件でも fail）でも、preview は production を侵食しないため **本番 rollback は不要**。

ただし、誤って `vercel promote` が実行された場合の戻し手順:

1. Vercel Dashboard → Project → Deployments
2. Round 17 着地版 production deploy を選択（Slack pin で deploy ID 確認）
3. `...` メニュー → `Promote to Production` をクリック
4. confirm ダイアログで OK（30 秒以内）
5. `vercel ls` で active deploy が rollback 先 ID になっていることを確認
6. Slack `#prj-019-launch` に `OG preview 誤 promote rollback 完了 HH:MM JST` 投稿

詳細手順は `public-launch-vercel-rollback-runbook-2026-06-19.md` §3 を参照（同一手順）。

---

## 10. 関連 DEC

- DEC-019-054（portfolio v3.0 公開判断）
- DEC-019-062（v1.1 / v3.1 deploy 確定）
- DEC-019-033（OG visual baseline → knowledge/patterns 候補）
- DEC-018-047（PRJ-018 hotfix rollback 知見継承）
- DEC-019-025（background dispatch SOP / 本書も SOP 実証 18 件目に含まれる）

---

## 11. Round 22 着地条件（本書を参照する Web-Ops オペレータ向け）

Round 22 で本書を実行した結果、以下が green になれば Round 23 以降に進める:

- [ ] §1 pre-flight 6 項目全 green
- [ ] §2 vercel build local 成功
- [ ] §3 preview URL 取得 + DEPLOY_ID 記録
- [ ] §4-§5 8 case 全 200 + content-type / cache-control 期待通り
- [ ] §6 fallback 6 項目全 green
- [ ] §7 visual baseline 8 枚 git commit 済み
- [ ] §8 Owner「OG preview ack」取得済み
- [ ] §9 誤 promote 0 件（preview のみで完結）

全 8 項目 green = Round 23 で本番 OG 切替（DEC-019-062 経路）の前提条件成立。

---

**最終更新**: 2026-05-05（Round 21 第 2 波 / Web-Ops-H 起票）
**次回見直し**: Round 22 着地直後（preview deploy 実施結果反映） / 2026-06-12（D-7 本番直前再点検）
