# OG image src 物理 migration 実行 readiness 評価 (2026-05-26)

- 起票: PRJ-019 Round 22 Dev-LL
- 起票日: 2026-05-05
- 評価対象: Round 21 起票の 4 spec (`og-image-src-migration-spec.md` / `og-image-src-migration-execution-runbook.md` / `og-image-visual-regression-baseline-spec.md` / `og-image-vercel-preview-procedure.md`) の Round 22 実行可否
- 関連: `og-gitignore-adjustment-spec.md` (本 Round 起票)
- 実行 phase: Round 22 (本 readiness は spec 段階の判定、実 migration 実行は別 trigger)

---

## §0 評価方針

Round 21 で Dev-II が起票した 4 spec (合計 1,374 行) について、実行可能性を 4 段階 (design / dev env / staging / production) で評価する。各段階で blocker / risk / unknown を整理し、step-by-step 実行手順 (10-15 step) と rollback 手順を最終化する。本 readiness は Round 22 当日の Dev 担当が「迷わず手が動く」状態を担保するための meta-spec。

---

## §1 4 段階 readiness matrix

| 段階 | 判定 | 根拠 | blocker |
|---|---|---|---|
| (1) design | GO | spec 4 件 (1,374 行) + .gitignore patch spec (本 Round 256 行) で全網羅 | なし |
| (2) dev env | GO with conditions | path A 物理ファイル 14,859 byte 確認済、`.gitignore` patch 適用前は path B が untracked | .gitignore patch 適用が前提 |
| (3) staging | GO with conditions | Vercel preview procedure 起票済 (349 行)、deploy URL は実行時に動的取得 | Vercel CLI auth 状態が unknown、Owner 環境で `vercel login` 確認要 |
| (4) production | NO-GO (現時点) | Owner formal ack 必須、`#prj-019-launch` Slack post + ack 取得が gate | Owner ack 未取得 |

### 1.1 総合判定

**GO with conditions for (1)(2)(3), NO-GO for (4) until Owner ack**

→ Round 22 当日は (1)(2)(3) を順に実行し、(3) PASS 後に Owner ack request を post。ack 取得後に (4) production deploy。

---

## §2 段階 (1) design readiness

### 2.1 既存 spec inventory

| spec | 行数 | 起票 | 役割 |
|---|---|---|---|
| og-image-src-migration-spec.md | 306 | R21 Dev-II | 何を / どこへ / なぜ |
| og-image-src-migration-execution-runbook.md | 329 | R21 Dev-II | 手順 step-by-step |
| og-image-visual-regression-baseline-spec.md | 290 | R21 Dev-II | VRT 基盤 (8 case) |
| og-image-vercel-preview-procedure.md | 349 | R21 Dev-II | preview deploy 検証 |
| og-gitignore-adjustment-spec.md | 256 | R22 Dev-LL | .gitignore patch 詳細 |

合計: 1,530 行。design レベルで覆っていない領域は無い。

### 2.2 design 判定

GO. spec の整合性は Round 21 Dev-II で Cross-check 済、本 Round で .gitignore patch 詳細を補完済。

---

## §3 段階 (2) dev env readiness

### 3.1 環境前提

- OS: Windows 11 Home + Git Bash (MSYS) もしくは WSL
- Node: package.json `engines.node` で固定 (要確認)
- pnpm: 8.x or 9.x 想定
- Next.js: `16.2.1` (path A route.tsx 内 `next/og` import から確認済)

### 3.2 dev env で確認済の事実

```bash
ls -la projects/COMPANY-WEBSITE/app/api/og/route.tsx
# → 14,859 bytes (Round 20 Web-Ops-G 起票済)

ls projects/COMPANY-WEBSITE/app/src/
# → app/ components/ data/ lib/ (4 dir 既存)
```

### 3.3 dev env で要確認 (Round 22 着手時)

- `pnpm install` が一度でも成功するか (`node_modules/` 生成可否)
- `pnpm exec tsc --noEmit` が path A 単独でも (= migration 前) 通るか
- `pnpm dev` で localhost:3000 が serve されるか

### 3.4 dev env 判定

GO with conditions. blocker は `.gitignore` patch 未適用のみ。本 Round task ① 完了後に runbook §1.4 の patch を適用すれば dev env 上は確実に動作する。

---

## §4 段階 (3) staging readiness

### 4.1 staging = Vercel preview environment

- `vercel deploy` (no `--prod`) で preview URL 取得
- preview URL に対して 8 case curl 検証 (`og-image-vercel-preview-procedure.md` §3)
- cache-control / x-vercel-cache HIT 検証 (§5)
- fallback 経路検証 (§7)

### 4.2 staging で要確認

- Vercel CLI auth (`vercel whoami`) が Owner アカウントで通っているか
- Vercel project link (`projects/COMPANY-WEBSITE/app/.vercel/project.json`) が存在するか
- preview deploy が `--prebuilt` flag で 30 秒以内に完了するか

### 4.3 staging 判定

GO with conditions. Vercel CLI auth が前提。Owner 環境で `vercel login` + project link 確認後に実行。

---

## §5 段階 (4) production readiness

### 5.1 production deploy gate

- staging (preview) で 8 case 全 PASS
- VRT baseline 取得済 (本 Round task ③ procedure 参照)
- Owner formal ack (`og-image-vercel-preview-procedure.md` §8 Slack post)
- `vercel deploy --prod` 実行

### 5.2 production 判定

NO-GO (現時点). Owner ack 未取得が唯一の blocker。staging PASS 後に ack request を post し、ack 取得後に GO 化。

---

## §6 step-by-step 実行手順 (Round 22 当日 12 step)

### step 1: pre-condition 確認

```bash
git status -s                    # 無関係変更を stash
git log -1 --oneline             # baseline commit hash 控え
ls projects/COMPANY-WEBSITE/app/api/og/route.tsx  # path A 存在確認
```

### step 2: path A バックアップ

```bash
cp -r projects/COMPANY-WEBSITE/app/api /tmp/og-path-a-backup-$(date +%Y%m%d-%H%M%S)/
```

### step 3: .gitignore patch 適用

`og-gitignore-adjustment-spec.md` §3.1 patch を `.gitignore` に追加。

```bash
git check-ignore -v projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
# Expected: ignored 判定なし (exit 1)
```

### step 4: .gitignore patch を独立 commit

```bash
git add .gitignore
git commit -m "chore(gitignore): whitelist projects/COMPANY-WEBSITE/app/src/ for monorepo Next.js"
```

### step 5: path B ディレクトリ作成 + ファイル copy

```bash
mkdir -p projects/COMPANY-WEBSITE/app/src/app/api/og
cp projects/COMPANY-WEBSITE/app/api/og/route.tsx \
   projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
diff projects/COMPANY-WEBSITE/app/api/og/route.tsx \
     projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
# Expected: diff なし
```

### step 6: import path 調整 (相対 → @/* alias)

`og-image-src-migration-execution-runbook.md` §3 に従い書き換え。

```bash
grep -nE "from ['\"]\.\.\/" projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
# 検出された相対 import を @/* alias に置換
```

### step 7: pnpm install + tsc 検証

```bash
cd projects/COMPANY-WEBSITE/app
pnpm install
pnpm exec tsc --noEmit
# Expected: error 0 件
```

### step 8: pnpm build 検証

```bash
pnpm build
# Expected: exit 0、Route (app) ブロック内に /api/og、.next/server/app/api/og/route.js 生成
```

### step 9: pnpm dev で 8 case curl

```bash
pnpm dev &
DEV_PID=$!
sleep 8

for variant in home service case updates; do
  for locale in ja en; do
    url="http://localhost:3000/api/og?variant=${variant}&locale=${locale}"
    out="/tmp/og-${variant}-${locale}.png"
    code=$(curl -o "${out}" -s -w "%{http_code}" "${url}")
    size=$(stat -c %s "${out}")
    echo "${variant}/${locale}: HTTP ${code}, ${size} bytes"
  done
done

kill $DEV_PID
```

期待: 8 case 全て HTTP 200 + size > 1000 byte + `file` で `PNG image data, 1200 x 630`。

### step 10: path A 削除 + path B commit

```bash
cd projects/COMPANY-WEBSITE/app
rm -rf api/
cd ../../..
git add projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
git status -s
# Expected: A projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
git commit -m "feat(og-image): physical src migration to App Router src layout (PRJ-019 R22)"
```

### step 11: Vercel preview deploy

```bash
cd projects/COMPANY-WEBSITE/app
vercel build
vercel deploy --prebuilt
# preview URL を export PREVIEW_URL=...
```

`og-image-vercel-preview-procedure.md` §3-§7 に従い 8 case curl + cache + fallback 検証。

### step 12: Owner ack request

`og-image-vercel-preview-procedure.md` §8.2 のテンプレで `#prj-019-launch` に post。ack 取得後に `vercel deploy --prod`。

---

## §7 rollback 手順

### 7.1 case A: step 9 までで FAIL

```bash
rm -rf projects/COMPANY-WEBSITE/app/src/app/api/og/
git checkout HEAD~1 -- .gitignore
git reset HEAD .gitignore projects/COMPANY-WEBSITE/app/src/app/api/og/
# path A は無傷で残存、システム正常
```

### 7.2 case B: step 10 で path A 削除済みの後 FAIL

```bash
cp -r /tmp/og-path-a-backup-<ts>/ projects/COMPANY-WEBSITE/app/api/
rm -rf projects/COMPANY-WEBSITE/app/src/app/api/og/
git reset HEAD~2  # gitignore commit + og commit を 2 つ取消
git checkout -- .gitignore
```

### 7.3 case C: commit 後 push 前

```bash
git reset --hard HEAD~2  # 2 commit 取消
# その後 case A or B
```

### 7.4 case D: production deploy 後

```bash
git revert <og-commit>
git revert <gitignore-commit>
git push origin main
vercel deploy --prod
```

production が path A 状態に戻る (= /api/og 404)。原因調査後に再 Round で再挑戦。

---

## §8 risk register

| risk | likelihood | impact | mitigation |
|---|---|---|---|
| Windows 環境で `mkdir -p` / `cp -r` の動作差 | 低 | 中 | Git Bash (MSYS) で実行、path 区切りは forward slash 統一 |
| import path 書換漏れ | 中 | 高 | step 7 の `tsc --noEmit` で検出、漏れ 0 件確認 |
| Vercel CLI auth 期限切れ | 中 | 中 | step 11 前に `vercel whoami` で確認 |
| pnpm install の lock 不整合 | 低 | 中 | `pnpm install --frozen-lockfile` で再現性確保 |
| `next/og` Edge runtime warning | 高 | 低 | warning は無視、エラーでなければ build 成功 |
| baseline 取得時 false positive | 中 | 低 | task ③ procedure §3 で 3 回連続 diff 0 確認 |

---

## §9 実行 readiness 最終判定

- design (1): **GO**
- dev env (2): **GO with conditions** (.gitignore patch 適用前提)
- staging (3): **GO with conditions** (Vercel auth 確認前提)
- production (4): **NO-GO** (Owner ack 取得後に GO 化)

総合: Round 22 当日に step 1-11 を実行可能。step 12 (production) は ack 取得まで保留。

### 9.1 Round 22 担当への引継

- step 1-10: dev 担当が単独実行可
- step 11: Vercel CLI auth が必要、Owner 環境で実行
- step 12: Owner ack 必須、ack 後に dev 担当が `vercel deploy --prod` 実行

---

## §10 Round 23+ 引継

- VRT baseline 取得 (本 Round task ③ procedure に従い実行)
- VRT CI 統合 (`og-image-visual-regression-baseline-spec.md` §6 案)
- public/ 配下の whitelist 化検討 (`og-gitignore-adjustment-spec.md` §5)
- locale segment 化 (`/api/og/[locale]/route.tsx`) 検討

---

EOF
