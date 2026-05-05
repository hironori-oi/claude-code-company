# OG image visual regression baseline 取得 procedure (2026-05-26)

- 起票: PRJ-019 Round 22 Dev-LL
- 起票日: 2026-05-05
- 対象: `og-image-visual-regression-baseline-spec.md` (R21 290 行) で起票された 8 case (4 variant × 2 locale) baseline 画像取得の実行手順
- 関連: `og-image-src-migration-execution-runbook.md` step 9 / `og-image-vercel-preview-procedure.md`
- 実行 phase: Round 22 (path B 物理化 step 9 PASS 後に実行)

---

## §0 目的

R21 spec で「Playwright `toHaveScreenshot()` 採用 + 8 case baseline」の design は確立。本 procedure は Round 22 当日に baseline を実物理生成するための execution-level 手順 (curl 経路 + Playwright 経路の併存) を定義。dev 環境上で 1 度生成し、CI 統合は Round 23+ で再評価する。

---

## §1 8 case 定義 (再掲)

| # | variant | locale | output filename | URL |
|---|---|---|---|---|
| 1 | home | ja | og-home-ja.png | `/api/og?variant=home&locale=ja` |
| 2 | home | en | og-home-en.png | `/api/og?variant=home&locale=en` |
| 3 | service | ja | og-service-ja.png | `/api/og?variant=service&locale=ja` |
| 4 | service | en | og-service-en.png | `/api/og?variant=service&locale=en` |
| 5 | case | ja | og-case-ja.png | `/api/og?variant=case&locale=ja` |
| 6 | case | en | og-case-en.png | `/api/og?variant=case&locale=en` |
| 7 | updates | ja | og-updates-ja.png | `/api/og?variant=updates&locale=ja` |
| 8 | updates | en | og-updates-en.png | `/api/og?variant=updates&locale=en` |

### 1.1 共通仕様

- 画像 dimension: 1200 × 630 px (`PNG image data, 1200 x 630, 8-bit/color RGBA`)
- color depth: 8-bit/color RGBA
- file size 期待: 30 KB - 200 KB (variant により幅あり、空 PNG = 1 KB 未満)
- content-type: `image/png`
- HTTP status: 200

---

## §2 取得 path 候補

### 2.1 候補 A: curl 経路 (簡易、Round 22 推奨)

```bash
pnpm dev &  # localhost:3000 起動
sleep 8
for v in home service case updates; do
  for l in ja en; do
    curl -sSL "http://localhost:3000/api/og?variant=${v}&locale=${l}" \
         -o "projects/COMPANY-WEBSITE/test/og-image-baseline/og-${v}-${l}.png"
  done
done
```

長所: 既存 dev 環境のみで実行可、追加 dependency 不要。
短所: response body の sha256 比較は別 step で実装、Playwright 統合の自動 diff 検出はなし。

### 2.2 候補 B: Playwright 経路 (R23+ 推奨、CI 統合前提)

```bash
pnpm install -D @playwright/test
pnpm exec playwright install chromium
pnpm exec playwright test tests/og-image-baseline.spec.ts --update-snapshots
```

長所: CI 統合容易、`toMatchSnapshot()` の threshold 制御、PR 上で diff 可視化。
短所: Playwright 初回 setup コスト (chromium download 約 130 MB)、Round 22 6/19 直前のタイミングで導入は副作用懸念。

### 2.3 Round 22 採用 = 候補 A

理由:
- 6/19 公開直前で副作用最小を優先
- baseline は本来 design 安定後に取得すれば十分、CI 統合は Round 23+ で導入
- curl で取得した 8 PNG を `test/og-image-baseline/` に commit すれば、Round 23+ で Playwright 経路に切替えても baseline は再利用可能

→ Round 22 では候補 A、Round 23+ で候補 B に move-up。

---

## §3 baseline 保存先

### 3.1 採用 path

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

### 3.2 .gitignore 影響確認

```bash
git check-ignore -v projects/COMPANY-WEBSITE/test/og-image-baseline/og-home-ja.png
# Expected: ignored 判定なし (= app/ 配下ではないため projects/*/app/ 規則に該当しない)
```

`projects/COMPANY-WEBSITE/test/` は `app/` 外なので tracked 可能 (R21 spec §4.3 で確認済の前提)。

### 3.3 親ディレクトリ作成

```bash
mkdir -p projects/COMPANY-WEBSITE/test/og-image-baseline
```

---

## §4 取得手順 step-by-step

### step 1: 前提確認

- path B 物理化 step 9 PASS 済 (= dev 上で 8 case 全て HTTP 200)
- `mkdir -p projects/COMPANY-WEBSITE/test/og-image-baseline` 完了

### step 2: dev 起動

```bash
cd projects/COMPANY-WEBSITE/app
pnpm dev &
DEV_PID=$!
sleep 8
```

### step 3: 8 case curl で baseline 生成

```bash
BASELINE_DIR="projects/COMPANY-WEBSITE/test/og-image-baseline"
mkdir -p "${BASELINE_DIR}"

for variant in home service case updates; do
  for locale in ja en; do
    url="http://localhost:3000/api/og?variant=${variant}&locale=${locale}"
    out="${BASELINE_DIR}/og-${variant}-${locale}.png"
    curl -sSL "${url}" -o "${out}"
    size=$(stat -c %s "${out}")
    echo "${variant}/${locale}: ${size} bytes -> ${out}"
  done
done
```

### step 4: 検証 - dimension

```bash
for f in projects/COMPANY-WEBSITE/test/og-image-baseline/*.png; do
  file "$f"
done
# Expected (8 行): PNG image data, 1200 x 630, 8-bit/color RGBA, non-interlaced
```

### step 5: 検証 - file size

```bash
for f in projects/COMPANY-WEBSITE/test/og-image-baseline/*.png; do
  s=$(stat -c %s "$f")
  [ "$s" -lt 1000 ] && echo "FAIL ${f} ${s}" && continue
  [ "$s" -gt 500000 ] && echo "WARN ${f} ${s}" || echo "OK ${f} ${s}"
done
```

### step 6: 検証 - sha256 hash 記録

```bash
cd projects/COMPANY-WEBSITE/test/og-image-baseline
sha256sum *.png > checksums.txt
cat checksums.txt
```

`checksums.txt` を baseline と並列で commit すれば、後続 build で hash 比較が可能。

### step 7: 安定性検証 - 3 回再生成 diff 0

```bash
# attempt 2,3 を別 dir に生成して baseline と diff
for n in 2 3; do
  mkdir -p /tmp/og-baseline-attempt${n}
  for v in home service case updates; do for l in ja en; do
    curl -sSL "http://localhost:3000/api/og?variant=${v}&locale=${l}" \
         -o "/tmp/og-baseline-attempt${n}/og-${v}-${l}.png"
  done; done
  diff -r projects/COMPANY-WEBSITE/test/og-image-baseline/ /tmp/og-baseline-attempt${n}/
done
```

3 回連続で diff 0 (binary 一致) なら安定 baseline。pixel-level は ImageMagick `compare -metric AE` で 0 を確認。

### step 8: dev 停止

```bash
kill $DEV_PID
```

### step 9: baseline を commit

```bash
git add projects/COMPANY-WEBSITE/test/og-image-baseline/
git commit -m "test(og): VRT baseline 8 cases (4 variant x 2 locale) PRJ-019 R22"
```

---

## §5 pixel diff threshold

### 5.1 R21 spec §5.1 採用閾値

| 項目 | 値 | 根拠 |
|---|---|---|
| pixel diff 許容率 | 0.5% (本 Round 上限調整) | font subpixel + anti-aliasing 吸収 |
| `maxDiffPixels` | 3780 | 1200 × 630 = 756,000 pixel の 0.5% |
| sha256 完全一致期待 | 同一 build / 同一環境内 | 環境跨ぎでは subpixel 差で hash 不一致あり |

### 5.2 threshold 採用方針

- **同一環境** (= 同 OS / 同 Node version / 同 Next.js version) では sha256 完全一致を期待 (diff 0)
- **環境跨ぎ** (例: dev local vs Vercel preview) では pixel diff 0.5% 以内を許容
- 差が 0.5% を超える場合は font fallback / runtime 差を疑い、`og-image-visual-regression-baseline-spec.md` §8 false positive 対策に従う

### 5.3 sha256 比較スクリプト

```bash
(cd projects/COMPANY-WEBSITE/test/og-image-baseline && sha256sum *.png | sort) > /tmp/b.txt
(cd /tmp/og-actual && sha256sum *.png | sort) > /tmp/a.txt
diff /tmp/b.txt /tmp/a.txt   # Expected: 全 8 case sha256 一致 (diff なし)
```

### 5.4 pixel diff 比較スクリプト (ImageMagick)

```bash
TOTAL=$((1200 * 630)); THRESHOLD=$((TOTAL * 5 / 1000))  # 0.5%
for f in projects/COMPANY-WEBSITE/test/og-image-baseline/*.png; do
  name=$(basename "$f")
  diff=$(compare -metric AE "$f" "/tmp/og-actual/${name}" /tmp/diff.png 2>&1)
  [ "$diff" -gt "$THRESHOLD" ] && echo "FAIL ${name} ${diff}" || echo "PASS ${name} ${diff}"
done
```

---

## §6 Vercel preview baseline (補助)

dev local だけでなく Vercel preview 環境でも baseline を取得しておくと、production deploy 後の比較に有用。execution-readiness step 11 (preview deploy) PASS 直後に取得。

```bash
PREVIEW_URL="https://company-website-xxx.vercel.app"
PDIR="projects/COMPANY-WEBSITE/test/og-image-baseline-preview"
mkdir -p "${PDIR}"
for v in home service case updates; do for l in ja en; do
  curl -sSL "${PREVIEW_URL}/api/og?variant=${v}&locale=${l}" -o "${PDIR}/og-${v}-${l}.png"
done; done
cd "${PDIR}" && sha256sum *.png > checksums.txt
```

dev local baseline との checksum diff: 完全一致が理想だが、Edge vs Node runtime の subpixel 差で 1-2 case の hash 不一致は許容。pixel diff 0.5% 以内なら PASS。

---

## §7 false positive 対策 (Round 22 当日チェック)

R21 spec §8.4 のチェックリスト 3 項目:

- [ ] 同一マシン上で curl 取得を 3 回実行し、すべて sha256 一致になることを確認 (§4 step 7)
- [ ] dev local と Vercel preview で sha256 一致 or pixel diff 0.5% 以内を確認 (§6.3)
- [ ] 1 case わざと URL を `?variant=invalid` に変えて取得結果が baseline と不一致になることを確認 (= 検出能力テスト)

---

## §8 Round 23+ 引継 (CI 統合)

- Playwright 移行: 本 Round の baseline 8 PNG をそのまま `toMatchSnapshot` で再利用 (threshold 0.005, maxDiffPixelRatio 0.005)、`snapshotPathTemplate` で `test/og-image-baseline/{arg}{ext}` 固定
- GitHub Actions workflow: `.github/workflows/og-image-vrt.yml` を起票 (R21 spec §6.2 案参照)
- baseline 更新ポリシー: design 変更 PR のみ `--update-snapshots`、CI 自動更新禁止 (R21 spec §7)

---

## §9 PASS criteria (本 procedure 完了判定)

- 8 PNG が `projects/COMPANY-WEBSITE/test/og-image-baseline/` に存在
- 全 PNG の dimension が 1200 × 630
- 全 PNG の size が 1000 byte 超 500 KB 未満
- `checksums.txt` が生成され、3 回再取得で hash 同一
- baseline + checksums.txt が git tracked + commit 済

---

EOF
