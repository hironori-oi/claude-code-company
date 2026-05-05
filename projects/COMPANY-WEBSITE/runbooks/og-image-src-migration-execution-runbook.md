# OG image src 物理化移送 実行手順書 (Runbook)

- 起票: PRJ-019 Round 21 Dev-II
- 起票日: 2026-05-05
- 対象: Round 22 で実施する path A → path B 移送当日の手順
- 関連 spec: `og-image-src-migration-spec.md` / `og-image-vercel-preview-procedure.md` / `og-image-visual-regression-baseline-spec.md`
- 実行 phase: Round 22 (本 runbook は手順起票のみ、実移送は Round 22)

---

## §0 目的

Round 21 で起票した移送 spec を実際に手順化したもの。Round 22 移送当日に本 runbook を上から順に実行することで、副作用最小・rollback 可能な形で path A → path B 移送を完遂する。

各 step に PASS criteria を併記、失敗時は §10 rollback に従う。

---

## §1 pre-condition

### 1.1 path A 動作確認

移送開始前、現状 (path A) で route.tsx の中身を読める状態であること:

```bash
ls -la projects/COMPANY-WEBSITE/app/api/og/route.tsx
# Expected: -rw-r--r-- ... 約 14 KB (395 行)
```

### 1.2 git 状態確認

```bash
git status -s
git log -1 --oneline
```

uncommitted な無関係変更がないこと。あれば事前 stash:

```bash
git stash push -u -m "pre-og-migration"
```

### 1.3 path A の安全保管 (バックアップ)

```bash
cp -r projects/COMPANY-WEBSITE/app/api /tmp/og-path-a-backup-$(date +%Y%m%d-%H%M%S)/
```

→ rollback 用バックアップ。`/tmp` は再起動で消えるため、後日復元が必要なら別 path に移動。

### 1.4 .gitignore whitelist 追加 (前段の前段)

```bash
# .gitignore に以下を追加
echo "" >> .gitignore
echo "# COMPANY-WEBSITE Next.js src dir (override projects/*/app/ rule)" >> .gitignore
echo "!projects/COMPANY-WEBSITE/app/src/" >> .gitignore
echo "!projects/COMPANY-WEBSITE/app/src/**" >> .gitignore
```

検証:

```bash
git check-ignore -v projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
# Expected: ignored 判定が出ない (= tracked 可能)
```

---

## §2 step 1: path B に新規 route.tsx 作成

### 2.1 親ディレクトリ作成

```bash
mkdir -p projects/COMPANY-WEBSITE/app/src/app/api/og
```

### 2.2 path A の内容を path B に copy

```bash
cp projects/COMPANY-WEBSITE/app/api/og/route.tsx \
   projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
```

### 2.3 PASS criteria

```bash
ls -la projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
diff projects/COMPANY-WEBSITE/app/api/og/route.tsx \
     projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
# Expected: diff 結果なし (両者 byte 一致)
```

---

## §3 step 2: import path 調整

### 3.1 path A から path B への相対 import 解消

path A から見て `../../src/lib/og-helpers` のような相対 import を、path B では `@/lib/og-helpers` に書き換え。

検出コマンド:

```bash
grep -nE "from ['\"]\.\.\/" projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
```

### 3.2 書き換え方針

| Before (path A) | After (path B) |
|---|---|
| `from '../../src/lib/og-helpers'` | `from '@/lib/og-helpers'` |
| `from '../../src/data/og-variants'` | `from '@/data/og-variants'` |
| `from '../../src/components/...'` | `from '@/components/...'` |
| `from 'next/og'` | (変更なし) |
| `from 'react'` | (変更なし) |

### 3.3 PASS criteria

```bash
cd projects/COMPANY-WEBSITE/app
pnpm exec tsc --noEmit
# Expected: error 0 件
```

---

## §4 step 3: pnpm install (依存追加なら)

### 4.1 確認

route.tsx 内で新規 import (path A 起票時に未追加の package) があれば pnpm 追加:

```bash
cd projects/COMPANY-WEBSITE/app
pnpm install
```

### 4.2 PASS criteria

- exit code = 0
- `node_modules/next/dist/` に `next/og` が存在
- `pnpm list next` で `16.2.1` 以上

---

## §5 step 4: pnpm build

### 5.1 build 実行

```bash
cd projects/COMPANY-WEBSITE/app
pnpm build
```

### 5.2 PASS criteria

- exit code = 0
- build log に `Route (app)` ブロック内で `/api/og` が表示
- `.next/server/app/api/og/route.js` が生成

### 5.3 FAIL 時

`og-image-src-migration-spec.md` §5.3 のエラー対応表参照。最頻出は import path 不整合 → §3 戻り。

---

## §6 step 5: pnpm dev で curl 8 case

### 6.1 dev 起動

```bash
cd projects/COMPANY-WEBSITE/app
pnpm dev &
DEV_PID=$!
sleep 8  # Next.js 16 の初回 compile を待つ
```

### 6.2 curl 8 case (詳細は src-migration-spec §6.2)

```bash
for variant in home service case updates; do
  for locale in ja en; do
    url="http://localhost:3000/api/og?variant=${variant}&locale=${locale}"
    out="/tmp/og-${variant}-${locale}.png"
    code=$(curl -o "${out}" -s -w "%{http_code}" "${url}")
    size=$(stat -c %s "${out}")
    echo "${variant}/${locale}: HTTP ${code}, ${size} bytes"
  done
done
```

### 6.3 PASS criteria

- 8 case 全て HTTP 200
- 全 PNG が 1000 byte 超
- `file /tmp/og-home-ja.png` で `PNG image data, 1200 x 630` 確認

### 6.4 dev 停止

```bash
kill $DEV_PID
```

---

## §7 step 6: path A 削除

### 7.1 削除前最終確認

§5 と §6 が PASS していること。failure があれば §10 rollback。

### 7.2 削除実行

```bash
cd projects/COMPANY-WEBSITE/app
rm -rf api/
```

### 7.3 PASS criteria

```bash
ls projects/COMPANY-WEBSITE/app/api/ 2>&1
# Expected: No such file or directory
```

---

## §8 step 7: git add path B

### 8.1 stage

```bash
git add .gitignore
git add projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
```

### 8.2 git status 確認

```bash
git status -s
# Expected:
#  M .gitignore
#  A projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
```

path A は untracked のまま `rm` されたため git 操作不要。

---

## §9 step 8: commit + push

### 9.1 commit

```bash
git commit -m "$(cat <<'EOF'
feat(og-image): physical src migration (path A → path B)

- Move route.tsx from projects/COMPANY-WEBSITE/app/api/og/ to
  projects/COMPANY-WEBSITE/app/src/app/api/og/ (Next.js App Router src layout)
- Adjust .gitignore to whitelist projects/COMPANY-WEBSITE/app/src/
- Switch import paths from relative to @/* alias
- pnpm build + 8-case curl verified PASS

PRJ-019 Round 22, see runbooks/og-image-src-migration-spec.md
EOF
)"
```

### 9.2 push

```bash
git push origin main
```

push の可否は Owner formal ack 後 (`og-image-vercel-preview-procedure.md` §8 参照)。

---

## §10 rollback

### 10.1 rollback トリガー

- §5 build FAIL かつ §3 では解消できない
- §6 curl 8 case のうち 1 つでも FAIL し原因不明
- §7 削除後に何らかの問題発覚
- Owner ack で NG 判定

### 10.2 rollback 手順 (case A: 削除前)

§7 削除前であれば、path B のみ削除して path A を残す:

```bash
rm -rf projects/COMPANY-WEBSITE/app/src/app/api/og/
git checkout -- .gitignore
git restore --staged .gitignore projects/COMPANY-WEBSITE/app/src/app/api/og/
```

### 10.3 rollback 手順 (case B: 削除後)

§7 で path A を削除済みなら §1.3 のバックアップから復元:

```bash
cp -r /tmp/og-path-a-backup-<timestamp>/ projects/COMPANY-WEBSITE/app/api/
```

その後 case A の手順で path B を削除。

### 10.4 rollback 手順 (case C: commit 後 push 前)

```bash
git reset --hard HEAD~1
# その後 case A or B
```

### 10.5 rollback 手順 (case D: push 後)

production には別 commit で revert (= 履歴を保持):

```bash
git revert <移送 commit hash>
git push origin main
```

production deploy が path A 状態に戻り、原因調査して再 Round で再挑戦。

---

EOF
