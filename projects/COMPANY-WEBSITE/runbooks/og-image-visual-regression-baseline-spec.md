# OG image visual regression baseline 取得 spec

- 起票: PRJ-019 Round 21 Dev-II
- 起票日: 2026-05-05
- 対象: OG image 4 variant × 2 locale = 8 baseline PNG の取得とビジュアル回帰テスト基盤
- 関連: `og-image-template-design-v1.md` / `og-image-e2e-test-spec.md` / `og-image-src-migration-spec.md`
- 実行 phase: Round 22 (本 spec は spec 起票のみ、実 baseline 生成なし)

---

## §0 目的

OG image route (`/api/og?variant=...&locale=...`) のレンダ結果を **画像レベルで回帰検出** するためのテスト基盤を起票する。Round 20 Web-Ops-G の e2e spec は HTTP status / content-type / byte size の検証に留まっており、「レイアウト崩れ」「フォント差」「色味変化」のような視覚的変化は検出されない。本 spec は visual regression test (VRT) を導入し、design 変更の影響範囲を画像 diff で可視化する。

baseline は 4 variant × 2 locale = 8 枚の PNG を保存し、後続の build / deploy では同 8 case のレンダ結果と pixel diff を取る。

---

## §1 ツール選定

### 1.1 候補

| ツール | 形態 | 既存 stack 整合 | コスト | 推奨度 |
|---|---|---|---|---|
| Playwright `toHaveScreenshot()` | OSS、self-host | YES (`testing-policy.md` で Playwright 採用済) | $0 | ★★★ |
| Percy | SaaS | NO (新規導入) | 月額 $149〜 | ★ |
| Chromatic | SaaS、Storybook 連携 | NO | $149〜 | ★ |
| reg-suit + reg-cli | OSS | NO (新規) | $0 | ★★ |
| Pixelmatch + 自前 runner | OSS | YES (Vitest 内で書ける) | $0 | ★★ |

### 1.2 比較軸

- **既存 stack 整合**: Playwright は `testing-policy.md` で Web e2e として採用済、追加導入なし
- **コスト**: 副作用 0 / API 追加コスト $0 の quality gate に整合するのは OSS のみ
- **学習コスト**: Playwright は組織内に既に存在
- **CI 統合性**: Playwright は GitHub Actions matrix と相性が良い

---

## §2 推奨 = Playwright

### 2.1 採用理由

1. `testing-policy.md` で既に E2E ツールとして指定 → 重複導入なし
2. `toHaveScreenshot()` API が visual regression に最適化されている (anti-aliasing 吸収、threshold 設定可)
3. `playwright.config.ts` の `expect.toHaveScreenshot.threshold` で false positive 抑制
4. CI で `--update-snapshots` flag で baseline 更新が容易
5. 結果が PNG diff として artifact 出力 → PR review で目視確認可

### 2.2 不採用理由 (他)

- **Percy / Chromatic**: SaaS = 副作用あり、API key 管理必要、月額コスト発生
- **reg-suit**: 学習コスト高、Playwright で代替可能なため導入する理由なし
- **Pixelmatch 自前**: ローレベル過ぎ、Playwright が同じことを内部で実施

---

## §3 baseline 取得手順

### 3.1 前提

- §2 採用済 = Playwright
- pnpm dev で `localhost:3000` 上で OG route が serve されている (path B 移送後)
- Playwright が `pnpm install -D @playwright/test` 済 (Round 22 確認)

### 3.2 baseline 生成スクリプト案 (`tests/og-image-baseline.spec.ts`)

```ts
import { test, expect } from '@playwright/test';

const variants = ['home', 'service', 'case', 'updates'] as const;
const locales = ['ja', 'en'] as const;

for (const variant of variants) {
  for (const locale of locales) {
    test(`OG image baseline: ${variant} / ${locale}`, async ({ page }) => {
      const url = `/api/og?variant=${variant}&locale=${locale}`;
      const response = await page.goto(url);
      expect(response?.status()).toBe(200);
      expect(response?.headers()['content-type']).toContain('image/png');

      // image content を baseline と比較
      const buffer = await response!.body();
      expect(buffer).toMatchSnapshot(`og-${variant}-${locale}.png`, {
        threshold: 0.001,  // 0.1% pixel diff まで許容
        maxDiffPixelRatio: 0.001,
      });
    });
  }
}
```

### 3.3 初回 baseline 生成コマンド

```bash
cd projects/COMPANY-WEBSITE/app
pnpm exec playwright test tests/og-image-baseline.spec.ts --update-snapshots
```

→ 8 枚の PNG が自動生成される。

---

## §4 baseline 保存先

### 4.1 推奨 path

```
projects/COMPANY-WEBSITE/test/og-image-baseline/
├── og-home-ja.png
├── og-home-en.png
├── og-service-ja.png
├── og-service-en.png
├── og-case-ja.png
├── og-case-en.png
├── og-updates-ja.png
└── og-updates-en.png
```

### 4.2 Playwright snapshot 規約との関係

Playwright デフォルトでは `tests/foo.spec.ts-snapshots/` に保存するが、`playwright.config.ts` の `snapshotPathTemplate` で path 指定可:

```ts
export default defineConfig({
  snapshotPathTemplate: '../../test/og-image-baseline/{arg}{ext}',
});
```

### 4.3 git commit 対象

baseline PNG は git tracked (= リポジトリに含める) とする。理由:
- 別 dev 環境でも同 baseline で diff 検証できる
- CI 上での再現性確保
- design 変更時の履歴追跡 (PR で baseline diff が見える)

ただし `.gitignore` の `projects/*/app/` ルールで `projects/COMPANY-WEBSITE/test/` が ignore されていないか Round 22 移送実行前に確認 (現時点 `app/` 配下ではないため OK と推定)。

---

## §5 diff 閾値

### 5.1 採用閾値

| 項目 | 値 | 根拠 |
|---|---|---|
| `threshold` | 0.001 (0.1%) | font subpixel rendering 差を吸収 |
| `maxDiffPixels` | 1000 | 1200×630 = 756,000 pixel の 0.13% |
| `maxDiffPixelRatio` | 0.001 | 同上 |

### 5.2 PASS / FAIL 判定

- diff pixel ratio < 0.1% → PASS
- 0.1% <= ratio < 1% → WARN (CI は緑、目視 review 推奨)
- ratio >= 1% → FAIL (PR block)

### 5.3 false positive 経験的対策

- font fallback の影響: `next/og` が emoji font を fallback した場合、subpixel が変わる → §8 で対処
- runtime 違い (Edge vs Node): pixel-perfect で同一とは限らない → CI 環境固定が必須

---

## §6 CI 統合可否

### 6.1 Round 21 時点判定

**CI 統合は Round 22 では未実施、Round 23+ で workflow 検討** とする。理由:

- visual regression は本来 deploy 直前の checkpoint であり、Round 22 = 6/19 公開直前のタイミングでは workflow 失敗が deploy block 要因になる
- baseline 取得 → diff 検証 の安定性確認に最低 1 sprint 必要
- CI 統合前に local での 1 週間動作確認が望ましい

### 6.2 Round 23+ で検討する CI 構成案

```yaml
# .github/workflows/og-image-vrt.yml (案)
name: OG Image Visual Regression
on:
  pull_request:
    paths:
      - 'projects/COMPANY-WEBSITE/app/src/app/api/og/**'
      - 'projects/COMPANY-WEBSITE/app/src/data/og-variants.ts'
      - 'projects/COMPANY-WEBSITE/test/og-image-baseline/**'
jobs:
  vrt:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm exec playwright install chromium
      - run: pnpm exec playwright test tests/og-image-baseline.spec.ts
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: vrt-diff
          path: test-results/
```

### 6.3 CI 統合の事前条件

- baseline が安定 (3 回連続で diff 0 を local で確認)
- false positive 対策 (§8) 完了
- Round 22 deploy が成功し production 動作が確認済

---

## §7 baseline 更新ポリシー

### 7.1 更新トリガー

baseline を更新するのは以下のケース **のみ**:

1. design 変更 (色 / フォント / レイアウト変更) を含む PR
2. `og-image-template-design-v1.md` の改訂を伴う変更
3. `next/og` major version up に伴う renderer 仕様変更

### 7.2 更新手順

```bash
cd projects/COMPANY-WEBSITE/app
pnpm exec playwright test tests/og-image-baseline.spec.ts --update-snapshots
git add ../test/og-image-baseline/
git commit -m "chore(og): update VRT baseline due to design change"
```

### 7.3 更新時の PR review 必須項目

- baseline PNG の git diff を **目視確認** (PR の File changed タブで PNG diff が表示される)
- 意図した変更のみで、想定外の崩れがないこと
- 他の変更で意図せず再生成された場合は revert

### 7.4 禁止事項

- CI 上で `--update-snapshots` を自動実行しない (= 無条件 baseline 更新は VRT の意義を消す)
- 「失敗したから更新」は禁止、必ず原因調査後に更新

---

## §8 false positive 対策

### 8.1 想定原因

| 原因 | 影響 | 対策 |
|---|---|---|
| font subpixel rendering 差 | 1-2 px ずれ | `threshold: 0.001` で吸収 |
| emoji font fallback | 大幅 diff | OG image 内に絵文字を含めない (組織 rule = 絵文字 0) |
| timezone 差 | 日付描画変化 | OG image は日付を描画しない (variant は静的) |
| OS font hinting | 枠線にじみ | CI 環境を Linux 固定 (ubuntu-latest) |
| GPU 加速差 | アンチエイリアス差 | Playwright headless で固定 |

### 8.2 環境固定方針

- CI: `ubuntu-latest` 固定
- Local: Docker 経由で `playwright/python:focal` 等の固定 image 推奨 (Round 23 検討)
- Node version: package.json `engines.node` で固定

### 8.3 fallback font の自前 bundling

`next/og` は font 引数を受け取れる:

```ts
import { ImageResponse } from 'next/og';

export async function GET() {
  const fontData = await fetch(
    new URL('@/assets/fonts/GeistSans.woff2', import.meta.url)
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(<Hero />, {
    width: 1200,
    height: 630,
    fonts: [{ name: 'GeistSans', data: fontData, style: 'normal' }],
  });
}
```

→ system font fallback を排除し、CI / local / production で同一 font 描画 = baseline 安定。

### 8.4 検証チェックリスト

Round 22 baseline 取得時:
- [ ] 同一マシン上で `--update-snapshots` を 3 回実行し、すべて diff 0 になることを確認
- [ ] CI と local で同一 baseline が PASS することを確認
- [ ] 1 case わざと文字を変えて FAIL することを確認 (= 検出能力テスト)

---

EOF
