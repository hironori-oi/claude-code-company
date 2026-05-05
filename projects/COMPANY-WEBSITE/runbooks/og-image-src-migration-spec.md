# OG image src 物理化移送 spec

- 起票: PRJ-019 Round 21 Dev-II
- 起票日: 2026-05-05
- 対象: `projects/COMPANY-WEBSITE/app/api/og/route.tsx` (path A) → `projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx` (path B)
- 関連: Round 19 Web-Ops-F production spec / Round 20 Web-Ops-G template + e2e + deploy preview
- 実行 phase: Round 22 (本 spec は spec 起票のみ、実移送は実施しない)

---

## §0 概要

Round 20 で Web-Ops-G が作成した OG image route.tsx は `projects/COMPANY-WEBSITE/app/api/og/route.tsx` (= path A) に置かれている。これは「Next.js の app/ 配下」ではなく「`projects/COMPANY-WEBSITE/app/` 直下の `api/` 配下」であるため、Next.js App Router の routing 規約上は **build 対象外**。さらに `.gitignore` に `projects/*/app/` ルールが存在するため、path A は version control からも除外され、リポジトリ単独 clone では復元不能な状態である。

本 spec は、path A の内容を **path B = `projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx`** に移送し、Next.js App Router の標準 routing (`app/api/og`) として認識させ、かつ `.gitignore` の対象外 (= `projects/COMPANY-WEBSITE/app/src/` 配下) で version controlled とする手順を定義する。

実移送は副作用を伴うため Round 21 では実行せず、Round 22 で本 spec に従って Dev 部門が実施する。

---

## §1 現状 (path A)

| 項目 | 値 |
|---|---|
| 物理 path | `projects/COMPANY-WEBSITE/app/api/og/route.tsx` |
| 行数 | 395 行 (Round 20 Web-Ops-G 起票) |
| Next.js App Router 認識 | NO (`app/` ディレクトリは Next.js 上は単なるサブフォルダ、`src/app/` が App Router root) |
| `.gitignore` 影響 | YES (`projects/*/app/` で除外、`git status` 上は untracked) |
| 副作用 | dev 起動時にこの route は serve されない |

### 1.1 path A が機能しない理由

`projects/COMPANY-WEBSITE/app/` 配下の Next.js プロジェクトは `tsconfig.json` の `paths: { "@/*": ["./src/*"] }` および `src/app/` の存在から **src dir layout** を採用している。Next.js 16 (`next: "16.2.1"`) における App Router の root は `src/app/` であり、`api/` をプロジェクトルート直下に置いても route.tsx として認識されない。

### 1.2 .gitignore 確認結果

リポジトリルート `.gitignore` に `projects/*/app/` が含まれており、以下が ignore 対象:
- `projects/COMPANY-WEBSITE/app/api/` (path A の親) → ignore
- `projects/COMPANY-WEBSITE/app/src/` → これも `projects/*/app/` 配下 → **同じく ignore 対象である可能性**

**重要**: 移送先 path B も `projects/COMPANY-WEBSITE/app/src/` 配下であるため、`.gitignore` の解釈次第では path B も依然として untracked となる。Round 22 移送実行前に `.gitignore` を再確認し、必要なら以下のいずれかを採用:

- 案 1: `.gitignore` に `!projects/COMPANY-WEBSITE/app/src/` の whitelist 行を追加 (recommended)
- 案 2: `.gitignore` の `projects/*/app/` ルール自体を `projects/*/app/node_modules/` 等の具体化に変更
- 案 3: 移送先を `projects/COMPANY-WEBSITE/runbooks/og-image-route-source.tsx` 等の runbook 配下にする (App Router 認識は失われる、非推奨)

→ **採用案**: 案 1 (whitelist 追加が最小副作用、Next.js 認識を維持)。

---

## §2 移送先 (path B)

| 項目 | 値 |
|---|---|
| 物理 path | `projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx` |
| URL | `/api/og` (Next.js App Router 規約) |
| Next.js App Router 認識 | YES (src/app/ 配下、route.tsx 規約適合) |
| `.gitignore` 影響 | `.gitignore` whitelist 追加後は NO (tracked) |
| 副作用 | dev / build 双方で `/api/og` route として serve |

### 2.1 path B の親ディレクトリ

`projects/COMPANY-WEBSITE/app/src/app/api/` は Round 21 時点で未作成。移送実行時に `mkdir -p src/app/api/og` 相当の処理が必要。

### 2.2 path B 配下に同居しうる将来 route

- `src/app/api/og/route.tsx` ← 本移送対象
- `src/app/api/og/[locale]/route.tsx` ← 将来 locale 別 segment 化 (Round 22+ 検討)
- `src/app/api/og/__tests__/` ← Vitest 配置候補 (testing-policy.md に従う)

---

## §3 既存 src layout 確認

### 3.1 ディレクトリツリー (Round 21 時点)

```
projects/COMPANY-WEBSITE/app/
├── src/
│   ├── app/         ← Next.js App Router root
│   ├── components/  ← UI コンポーネント
│   ├── data/        ← 静的データ
│   └── lib/         ← ヘルパ
├── api/             ← path A (移送元、Next.js 非認識)
│   └── og/
│       └── route.tsx
├── public/
├── package.json
├── tsconfig.json    ← paths: { "@/*": ["./src/*"] }
└── next.config.ts
```

### 3.2 移送後ディレクトリツリー

```
projects/COMPANY-WEBSITE/app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── og/
│   │   │       └── route.tsx   ← path B
│   │   └── ...
│   ├── components/
│   ├── data/
│   └── lib/
├── api/             ← 削除 (§8 cleanup)
├── public/
├── package.json
└── tsconfig.json
```

---

## §4 import path 変更

### 4.1 path A 内の import (推定)

Round 20 Web-Ops-G の route.tsx は path A 上で書かれているため、相対 import が以下のように記述されている可能性:
- `import { ogVariants } from '../../src/data/og-variants'`
- `import { renderHero } from '../../src/lib/og-helpers'`

### 4.2 path B での import 形式

path B (`src/app/api/og/route.tsx`) からは alias `@/*` で全て参照可能:
- `import { ogVariants } from '@/data/og-variants'`
- `import { renderHero } from '@/lib/og-helpers'`
- `import { siteConfig } from '@/lib/site-config'`

### 4.3 next/og の import

```ts
import { ImageResponse } from 'next/og';
```
これは path A・path B どちらでも変わらない (絶対 import)。

### 4.4 検証コマンド

移送後、以下で import 不整合を検出:
```bash
cd projects/COMPANY-WEBSITE/app
pnpm exec tsc --noEmit
```
TypeScript の strict mode により unresolved import は build 前に検出される。

---

## §5 build 検証手順

### 5.1 build コマンド

```bash
cd projects/COMPANY-WEBSITE/app
pnpm install   # next 16.2.1 + dependencies
pnpm build     # = next build
```

### 5.2 build 成功条件 (PASS criteria)

- exit code = 0
- `.next/server/app/api/og/route.js` が生成される
- build log に `Route (app)` の中で `ƒ /api/og` (動的 route) が表示される
- warning として `Edge runtime` または `Node runtime` の宣言が表示される (`next/og` は Edge 推奨だが Node でも動作)

### 5.3 build 失敗時の典型エラー

| エラー | 原因 | 対処 |
|---|---|---|
| `Module not found: Can't resolve '@/data/...'` | tsconfig paths 不整合 | tsconfig.json の paths 確認 |
| `next/og not found` | Next.js version < 14 | package.json `next` >= 16.2.1 確認 |
| `Cannot find module 'react'` | React 19 mismatch | pnpm install 再実行 |
| `Type 'Buffer' is not assignable` | font fetch 結果の型不整合 | `as ArrayBuffer` cast |

---

## §6 dev preview 検証手順

### 6.1 dev 起動

```bash
cd projects/COMPANY-WEBSITE/app
pnpm dev
# → http://localhost:3000
```

### 6.2 curl での動作確認 (8 case)

```bash
# variant=home, locale=ja
curl -i 'http://localhost:3000/api/og?variant=home&locale=ja' -o /tmp/og-home-ja.png

# variant=home, locale=en
curl -i 'http://localhost:3000/api/og?variant=home&locale=en' -o /tmp/og-home-en.png

# variant=service
curl -i 'http://localhost:3000/api/og?variant=service&locale=ja' -o /tmp/og-service-ja.png
curl -i 'http://localhost:3000/api/og?variant=service&locale=en' -o /tmp/og-service-en.png

# variant=case
curl -i 'http://localhost:3000/api/og?variant=case&locale=ja' -o /tmp/og-case-ja.png
curl -i 'http://localhost:3000/api/og?variant=case&locale=en' -o /tmp/og-case-en.png

# variant=updates
curl -i 'http://localhost:3000/api/og?variant=updates&locale=ja' -o /tmp/og-updates-ja.png
curl -i 'http://localhost:3000/api/og?variant=updates&locale=en' -o /tmp/og-updates-en.png
```

### 6.3 PASS criteria

- 全 8 case で HTTP 200
- `Content-Type: image/png`
- `Content-Length` > 1000 (空 PNG ではない)
- ファイルサイズ概ね 30KB-200KB (variant により幅あり)
- `file /tmp/og-*.png` で `PNG image data, 1200 x 630, 8-bit/color RGBA` を確認

---

## §7 cache-control header 維持確認

### 7.1 Round 20 Web-Ops-G で定義された cache 戦略

```ts
return new ImageResponse(<Hero ... />, {
  width: 1200,
  height: 630,
  headers: {
    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
  },
});
```

### 7.2 移送後の検証

```bash
curl -I 'http://localhost:3000/api/og?variant=home&locale=ja' | grep -i cache-control
# Expected: Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800
```

### 7.3 注意

- Vercel deploy 時、Edge runtime の場合は `Cache-Control` が CDN 層でも honor される
- `s-maxage=86400` (1 日) は CDN 層 cache、`max-age=3600` (1 時間) は browser cache
- `stale-while-revalidate=604800` (7 日) は Vercel CDN の SWR 動作を活性化

---

## §8 移送後の path A 削除手順

### 8.1 削除対象

- `projects/COMPANY-WEBSITE/app/api/og/route.tsx` (file)
- `projects/COMPANY-WEBSITE/app/api/og/` (dir)
- `projects/COMPANY-WEBSITE/app/api/` (dir、他に何も無ければ)

### 8.2 削除コマンド

```bash
cd projects/COMPANY-WEBSITE/app
rm -rf api/
```

### 8.3 削除前の安全確認

- path B が `pnpm build` で成功している
- path B 経由で curl 8 case 全て PASS
- git status で path A が untracked のまま (= もともと commit されていない、削除しても git 履歴は失われない)

### 8.4 削除後の git 操作

path A は `.gitignore` 配下で untracked のため、`git rm` は不要。`rm -rf api/` のみで完了。

### 8.5 rollback

万一移送に問題があった場合:
- `git stash` で path B の変更を退避
- path A の route.tsx は削除前に `cp -r api/ /tmp/og-path-a-backup/` でバックアップしておく
- 詳細手順は `og-image-src-migration-execution-runbook.md` §10 を参照

---

## §9 副作用 0 担保

本 spec は spec 起票のみ。Round 21 では以下を **実施しない**:
- 実 file 作成 (path B route.tsx)
- 実 file 削除 (path A route.tsx)
- 実 git add / commit
- 実 pnpm install / build / dev
- 実 .gitignore 編集

Round 22 でこれらを実行する際は、本 spec + `og-image-src-migration-execution-runbook.md` を併読。

---

## §10 Round 22 引継事項

- `.gitignore` whitelist 追加 (`!projects/COMPANY-WEBSITE/app/src/`)
- path B 物理化 (mkdir + cp)
- import path 修正 (相対 → `@/*` alias)
- pnpm build 検証
- pnpm dev で curl 8 case 検証
- path A 削除
- Vercel preview deploy (別 spec `og-image-vercel-preview-procedure.md` 参照)
- visual regression baseline 取得 (別 spec `og-image-visual-regression-baseline-spec.md` 参照)

---

EOF
