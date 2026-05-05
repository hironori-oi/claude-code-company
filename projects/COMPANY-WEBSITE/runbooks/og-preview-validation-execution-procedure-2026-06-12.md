# OG Preview Validation Execution Procedure (2026-06-12 D-7 想定)

**対象案件**: PRJ-019 Open Claw "Clawbridge"（公開 2026-06-19 09:00 JST）
**所有者**: Web-Ops 部門 / Round 22 Web-Ops-I 起票
**バージョン**: v1.0（Round 22 第 1 波）
**用途**: Web-Ops-H R21 起票 `og-image-vercel-preview-validation-runbook.md`（spec 253 行）を承継し、**実行 procedure** に変換。8 case (4 variant × 2 locale) curl 実行 + 期待 sha256 + pixel diff 計測 + Vercel preview URL 取得 → 比較 → PASS/FAIL 判定までを単一手順書化。
**前提**: 本書は **execution** 手順書であり、Round 22 で Web-Ops オペレータが本書を追って実行することで preview validation を自己完結化する。R21 spec runbook は無改変参照。

---

## 0. 利用方法

R21 spec runbook が「何を確認するか」「8 case の expected output」「§7 visual baseline 取得」を spec 化したのに対し、本書は実行者の **時刻軸 + コマンド + 比較ロジック + PASS/FAIL 判定** を line-by-line で確定する。

副作用最小（preview deploy 1 件は副作用ありとカウントするが、Round 22 の正式着地物として許容 = R21 spec §3）/ 本番 promote は禁止。

実行者: Web-Ops オペレータ（公開 GO 判断者ではない、技術検証専任）。
実行タイミング: 2026-06-12 D-7（OWN-PRE-01 / 02 / 04 完了直後の同 1 day 内推奨、最低 6/13 D-6 までに着地）。

Dev-LL R22 readiness（visual regression baseline procedure 想定）と整合: §7 で「baseline PNG 8 枚 git commit」を Dev 部門に handoff し、Round 23 以降の deploy で `npm run test:visual` を CI に組み込む。

---

## 1. 実行前 pre-flight（10 min, 6/12 D-7 09:00 想定開始）

R21 spec §1 の 6 項目を厳密に check:

| # | 項目 | 実行コマンド | 期待結果 | 失敗時 fallback |
|---|---|---|---|---|
| 1.1 | Vercel Project 存在 | `vercel projects ls \| grep company-website` | 1 行 hit | Web-Ops で project 再作成（10 min）|
| 1.2 | GitHub repo link | `vercel link` | "Connected to 4wide/company-website" | `vercel link` 再実行 |
| 1.3 | route.tsx main branch 存在 | `git ls-files app/api/og/route.tsx` | 1 行 hit | Dev に main merge 状態確認 |
| 1.4 | runtime = "edge" 維持 | `grep -n runtime app/api/og/route.tsx` | `export const runtime = "edge"` | Dev に PR で edge 化依頼 |
| 1.5 | NEXT_PUBLIC_SITE_URL Preview scope 設定 | `vercel env ls preview \| grep SITE_URL` | 1 行 hit | `vercel env add NEXT_PUBLIC_SITE_URL preview` |
| 1.6 | font fetch 到達可能 | `curl -sI https://fonts.gstatic.com/s/geist/v1/...woff2` | HTTP 200 | 別 font CDN を Web-Ops で検討 |

全 6 項目 green でない場合、preview deploy を実施しない（R21 spec §1 に従う）。

実行ログを `evidence/og-pre-flight-2026-06-12.log` に保存（後段の証憑 chain で参照）。

---

## 2. Vercel Build Local 起動（10 min, 6/12 D-7 09:10 想定）

R21 spec §2 を実行:

```bash
cd projects/COMPANY-WEBSITE/app
vercel link              # 未 link なら実行
vercel pull --environment=preview
vercel build             # build artifact 生成
```

PASS 条件:
- `.vercel/output/functions/api/og.func/.vc-config.json` に `"runtime": "edge"`
- `.vercel/output/static/_next/static/*` 生成
- build log 最終行に `Build Completed in .vercel/output [XXs]`

FAIL 条件 + fallback:
- Edge Function 制約違反（Node.js API 使用等）→ Dev に diff 確認依頼 → 修正 PR を待つ → preview validation 中断（Round 22 着地遅延を CEO に escalate）
- font fetch timeout → §1 1.6 再確認 + 別 font CDN を Web-Ops で検討 → fix 後 §2 再実行

build log を `evidence/og-build-local-2026-06-12.log` に保存。

---

## 3. Preview URL 取得（5 min, 6/12 D-7 09:20 想定）

R21 spec §3 を実行:

```bash
cd projects/COMPANY-WEBSITE/app
vercel deploy --prebuilt
# 出力例: https://prj019-xxxxx-4wide.vercel.app
```

**禁止**: `vercel --prod` / `vercel deploy --prod` / `vercel promote` は **絶対実行しない**（本番 deploy は 6/19 09:00 JST のみ）。本書は Web-Ops オペレータの認知負荷を下げるため、コマンド自動補完で `--prod` が混入しないよう shell history を実行前に空にする運用を推奨。

取得した preview URL + DEPLOY_ID + DEPLOYED_AT を以下 format で `evidence/og-preview-meta-2026-06-12.txt` に保存:

```
PREVIEW_URL=https://prj019-xxxxx-4wide.vercel.app
DEPLOY_ID=dpl_xxxxxxxxxxxxx
DEPLOYED_AT=2026-06-12T09:20:00Z
```

DEPLOY_ID は `vercel inspect $PREVIEW_URL` で取得。

---

## 4. 8 case curl 実行 + sha256 取得（15 min, 6/12 D-7 09:25 想定）

R21 spec §4 / §5 を実行 + sha256 計測を追加:

```bash
BASE=$(grep PREVIEW_URL evidence/og-preview-meta-2026-06-12.txt | cut -d= -f2)
mkdir -p evidence/og-preview-2026-06-12
cd evidence/og-preview-2026-06-12

# 8 case の URL list を array で定義
declare -a CASES=(
  "home-ja|/api/og?variant=home&locale=ja"
  "home-en|/api/og?variant=home&locale=en"
  "portfolio-ja|/api/og?variant=portfolio&locale=ja"
  "portfolio-en|/api/og?variant=portfolio&locale=en"
  "case-study-ja|/api/og?variant=case-study&title=PRJ-004&locale=ja"
  "case-study-en|/api/og?variant=case-study&title=PRJ-004&locale=en"
  "about-ja|/api/og?variant=about&locale=ja"
  "about-en|/api/og?variant=about&locale=en"
)

# 各 case の HEAD 取得 → status / content-type / cache-control 確認
for c in "${CASES[@]}"; do
  name="${c%%|*}"
  path="${c##*|}"
  echo "=== $name ===" >> head.log
  curl -sIL "$BASE$path" >> head.log
done

# 各 case の body 保存 + sha256 計測
for c in "${CASES[@]}"; do
  name="${c%%|*}"
  path="${c##*|}"
  curl -sL "$BASE$path" -o "preview-${name}.png"
  sha256sum "preview-${name}.png" >> sha256.txt
done
```

PASS 条件（8 case 全件で以下成立）:
- HTTP status: 200
- content-type: `image/png`
- content-length: 80,000 byte 以上 200,000 byte 以下
- cache-control: `public, max-age=60, s-maxage=86400`
- x-vercel-id header に edge region コード（`hnd1` / `nrt1` / 等）含有
- x-vercel-cache: 初回 `MISS`、2 回目以降 `HIT`
- sha256 が同一 case の連続 2 回 curl で一致（決定論的生成 = font / data 同一なら hash 一致）

FAIL 条件:
- 1 件でも 5xx 返却 → §6 fallback 経路へ
- content-length < 80KB → 生成異常（font fetch 失敗等）→ Dev escalate
- sha256 が連続 curl で異なる → 非決定論的生成（タイムスタンプ混入等）→ Dev に修正依頼

`head.log` + `sha256.txt` を証憑として commit 候補（Round 22 着地物の一部）。

---

## 5. 期待 sha256 baseline の確立（10 min, 6/12 D-7 09:40 想定）

Round 22 で **初回**実行のため、期待 sha256 は本実行の値を baseline として採用（後段の Round 23+ deploy で同 hash が出ることを期待）。

baseline 形式（`evidence/og-preview-2026-06-12/sha256-baseline.txt` に保存）:

```
preview-home-ja.png         <sha256 hash 64 hex>
preview-home-en.png         <sha256 hash 64 hex>
preview-portfolio-ja.png    <sha256 hash 64 hex>
preview-portfolio-en.png    <sha256 hash 64 hex>
preview-case-study-ja.png   <sha256 hash 64 hex>
preview-case-study-en.png   <sha256 hash 64 hex>
preview-about-ja.png        <sha256 hash 64 hex>
preview-about-en.png        <sha256 hash 64 hex>
```

baseline 確立後の運用:
- Round 23 以降の deploy 直前で同 8 case を curl + sha256 比較
- hash 一致 = 完全一致 PASS（pixel diff 不要）
- hash 不一致 = 何かが変わった（font / data / route 改修 等）→ §7 pixel diff へ進む

注意: Vercel Edge ランタイムの font cache 状態 / build hash の差異で sha256 が日次変動する可能性があるため、確実な baseline は §7 pixel diff（maxDiffPixelRatio: 0.001）に依存する。本 §5 の sha256 は first-line check（fast-path）として活用する位置付け。

---

## 6. fallback 経路検証（10 min, 6/12 D-7 09:50 想定）

R21 spec §6 を実行:

| # | 入力 | 期待挙動 | 実行コマンド |
|---|---|---|---|
| 6.1 | `?variant=invalid&locale=ja` | variant=home として fallback / 200 / valid PNG | `curl -sIL "$BASE/api/og?variant=invalid&locale=ja"` |
| 6.2 | `?variant=home&locale=zh` | locale=ja として fallback / 200 | `curl -sIL "$BASE/api/og?variant=home&locale=zh"` |
| 6.3 | `?variant=case-study&title=` + 200 文字 | title が ellipsis でクリップ / 200 | `curl -sIL "$BASE/api/og?variant=case-study&title=$(printf 'a%.0s' {1..200})"` |
| 6.4 | `?variant=case-study` (title 省略) | default title `Case Study` で生成 / 200 | `curl -sIL "$BASE/api/og?variant=case-study"` |
| 6.5 | `?` (全 param 省略) | 全 fallback で home/ja を返す / 200 | `curl -sIL "$BASE/api/og"` |
| 6.6 | `?variant=home&locale=<script>` | sanitize 後 ja として処理 / 200 / XSS 不可 | `curl -sIL "$BASE/api/og?variant=home&locale=%3Cscript%3E"` |

PASS 条件: 全 6 case で HTTP 200 + content-type image/png + content-length 80KB 以上。

FAIL 条件: 1 件でも 5xx / 4xx → R21 spec §6 の route.tsx fallback 実装を `og-image-template-design-v1.md` §1〜§5 と再照合 → Dev escalate。

`evidence/og-fallback-2026-06-12.log` に全 6 case の HEAD 出力を保存。

---

## 7. Pixel diff 計測 procedure（Dev-LL R22 visual regression baseline と整合, 15 min, 6/12 D-7 10:00 想定）

R21 spec §7 を承継し、Dev-LL R22 想定 visual regression と接続。**注意**: 本 §7 は spec 起票（Round 22 で Dev 部門が実 baseline PNG を生成する責務）。Web-Ops は実行 procedure を spec し、Dev に handoff する立場。

Playwright `toHaveScreenshot()` 8 枚の baseline を取得する spec（Dev 部門が実装する想定 file path）:

```
projects/COMPANY-WEBSITE/app/tests/og-visual.spec.ts
```

実装内容（R21 spec §7 と同一、本書で再掲）:

```ts
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

Dev 部門が実装する手順（本書 spec を Dev に handoff）:
1. Playwright project セットアップ（`@playwright/test` 依存追加）
2. `npx playwright test og-visual.spec.ts --update-snapshots` で baseline PNG 8 枚生成
3. `tests/og-visual.spec.ts-snapshots/` 配下に 8 枚 commit（branch: `feature/round22-og-baseline`）
4. PR で Web-Ops が baseline 8 枚を目視確認 → approve
5. main merge 後、Round 23 以降の deploy で `npm run test:visual` を CI に組み込む

PASS 条件: 8 baseline PNG 全てが 1200×630 サイズ、PNG-8 / PNG-24 形式、ファイルサイズ 80-200KB、目視で破綻なし（font 表示 / locale 表示 / variant 別レイアウトが意図通り）。

FAIL 条件: 1 件でも上記未達 → Dev に diff 修正依頼 → §3〜§7 再実行（preview deploy 含む）。

---

## 8. PASS / FAIL 判定 matrix（Round 22 着地条件, 5 min）

R21 spec §11 の 8 項目を本書実行で着地:

| # | 項目 | 確認方法 | 着地時刻（想定）|
|---|---|---|---|
| 8.1 | §1 pre-flight 6 項目全 green | `evidence/og-pre-flight-2026-06-12.log` 6 行全 PASS | 09:10 |
| 8.2 | §2 vercel build local 成功 | `evidence/og-build-local-2026-06-12.log` 最終行 Build Completed | 09:20 |
| 8.3 | §3 preview URL + DEPLOY_ID 取得 | `evidence/og-preview-meta-2026-06-12.txt` 3 行 | 09:25 |
| 8.4 | §4 8 case 全 200 + content-type / cache-control 期待通り | `head.log` 全 8 case で PASS | 09:40 |
| 8.5 | §5 sha256 baseline 確立 | `sha256-baseline.txt` 8 行 | 09:50 |
| 8.6 | §6 fallback 6 項目全 green | `og-fallback-2026-06-12.log` 全 PASS | 10:00 |
| 8.7 | §7 visual baseline 8 枚 git commit 済み（Dev 担当） | `tests/og-visual.spec.ts-snapshots/` 8 枚 + PR merge | 6/13 D-6（Dev 着地） |
| 8.8 | §9 Owner ack 取得 | Slack `#prj-019-launch` で「OG preview ack」reply | 6/12 D-7 当日 |

全 8 項目 green = Round 22 着地完了 / Round 23 で本番 OG 切替（DEC-019-062 経路）の前提条件成立。

---

## 9. Owner ack 取得手順（5 min, 6/12 D-7 10:15 想定）

R21 spec §8 と同一。8 case 全 green 後、Slack `#prj-019-launch` に preview URL 4 件（home / portfolio / case-study / about の representative URL）を pin 投稿:

```
[Round 22 OG preview deploy ack 要請]
deploy ID: dpl_xxxxxxxxxxxxx
home preview: $BASE/api/og?variant=home&locale=ja
portfolio preview: $BASE/api/og?variant=portfolio&locale=ja
case-study preview: $BASE/api/og?variant=case-study&title=PRJ-004&locale=ja
about preview: $BASE/api/og?variant=about&locale=ja

Owner: 上記 4 URL を mobile / PC で開き「OG preview ack」と返信お願いします。
sha256 baseline / fallback / pixel diff baseline は本書 §4-§7 で取得済み（証憑: evidence/og-preview-2026-06-12/）。
```

Owner reply 後、Web-Ops は thread に `ack received HH:MM` 投稿し、本書 §8.8 着地。

---

## 10. 失敗時 rollback（preview のみで完結, 0 sec, R21 spec §9 参照）

preview deploy 結果が NG（8 case のうち 1 件でも fail）でも preview は production を侵食しないため **本番 rollback 不要**。

ただし誤って `vercel promote` 実行された場合の戻し手順は R21 spec §9 を参照（同一手順、本書では再記載しない / 破壊禁止参照のみ）。

---

## 11. 証憑 file 一覧（Round 22 着地時の commit 対象候補）

```
evidence/
├── og-pre-flight-2026-06-12.log        (§1, 6 項目 PASS/FAIL)
├── og-build-local-2026-06-12.log       (§2, vercel build stdout)
├── og-preview-meta-2026-06-12.txt      (§3, PREVIEW_URL + DEPLOY_ID + DEPLOYED_AT)
├── og-preview-2026-06-12/
│   ├── head.log                        (§4, 8 case の HEAD response 全文)
│   ├── sha256.txt                      (§4, 8 ファイル sha256)
│   ├── sha256-baseline.txt             (§5, baseline として保存)
│   ├── preview-home-ja.png 〜 about-en.png  (§4, 8 ファイル本体, 各 80-200KB)
└── og-fallback-2026-06-12.log          (§6, 6 fallback case PASS/FAIL)
```

※ baseline PNG 8 枚（Playwright snapshot, §7）は Dev 部門 PR で `tests/og-visual.spec.ts-snapshots/` に別途配置（本書範囲外、本書からは spec のみ）。

---

## 12. 関連 artifact

- R21 Web-Ops-H spec runbook: `og-image-vercel-preview-validation-runbook.md`（253 行、本書の上位 spec / 無改変参照）
- 親 launch readiness: `launch-readiness-consolidation-2026-06-19.md` §1.3 OPS-F-01 / §4 OG image fallback
- 本日同時起票: `owner-action-cards/OWN-PRE-DRY-RUN-2026-06-12.md`（OWN-PRE 7 sub-card dry-run）
- 本日同時起票: `launch-day-web-ops-role-2026-06-19-v2.0.md`（公開当日役割整理 v2.0）
- OG image 制作 spec: `og-image-production-spec-2026-06-27.md`
- OG image template design: `og-image-template-design-v1.md`
- OG e2e test spec: `og-image-e2e-test-spec.md`
- OG deploy preview checklist: `og-image-deploy-preview-checklist.md`（R20 Web-Ops-G、checklist 形式の上位）

---

## 13. 関連 DEC

- DEC-019-054（portfolio v3.0 公開判断）
- DEC-019-062（v1.1 / v3.1 deploy 確定 + 本番 OG 切替経路）
- DEC-019-033（OG visual baseline → knowledge/patterns 候補）
- DEC-018-047（PRJ-018 hotfix rollback 知見継承）
- DEC-019-025（background dispatch SOP / 本書も SOP 実証 19 件目）

---

## 14. Round 22 内での実行スケジュール（参考）

```
2026-06-12 (D-7) JST
  09:00  pre-flight 開始（§1, 10 min）
  09:10  vercel build local（§2, 10 min）
  09:20  preview URL 取得（§3, 5 min）
  09:25  8 case curl + sha256（§4, 15 min）
  09:40  baseline 確立（§5, 10 min）
  09:50  fallback 検証（§6, 10 min）
  10:00  pixel diff spec handoff to Dev（§7, 15 min, Dev 着地は 6/13 D-6）
  10:15  Owner ack 要請投稿（§9, 5 min）
  10:20  Web-Ops オペレータの session 完了
  
  実行者: Web-Ops オペレータ 1 名
  所要: 80 min（実時間）+ Dev pixel diff baseline 着地待ち（最大 24h）
  着地: 6/13 D-6 23:59 JST までに §8 全 8 項目 green
```

---

**最終更新**: 2026-05-05（Round 22 / Web-Ops-I 起票）
**次回見直し**: 2026-06-11（D-8 実行直前 readiness 再確認）/ 2026-06-12（D-7 実行直後の実時間反映）/ 2026-06-13（D-6 §7 Dev pixel diff baseline 着地反映）/ Round 23 着手時（本番 OG 切替前提条件確認）
