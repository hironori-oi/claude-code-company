# .gitignore 規則調整 spec (OG src 物理化対応)

- 起票: PRJ-019 Round 22 Dev-LL
- 起票日: 2026-05-05
- 対象: OG image route.tsx を path B = `projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx` に物理化するための .gitignore 規則調整
- 関連: `og-image-src-migration-spec.md` §1.2 / `og-image-src-migration-execution-runbook.md` §1.4
- 実行 phase: Round 22 (本 spec は spec 起票のみ、実 .gitignore 編集は task ② runbook で実施)

---

## §0 背景

リポジトリルート `.gitignore` line 16 に `projects/*/app/` の glob 規則が存在する。これは「各 app は独自 git リポジトリで管理」する方針 (DEC-019-053 系統) に基づくが、PRJ-019 = COMPANY-WEBSITE Next.js プロジェクトは **monorepo 内に同居** している唯一の例外。Round 20 Web-Ops-G の OG route.tsx は path A = `projects/COMPANY-WEBSITE/app/api/og/route.tsx` に置かれているが、これは:

1. Next.js src dir layout 上、App Router root (`src/app/`) の外なので **build 対象外**
2. `.gitignore` の `projects/*/app/` 規則で **untracked**

の 2 重問題を抱える。Round 22 で path B = `projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx` に物理移送するが、path B も `projects/*/app/` 配下のため **そのままでは依然 untracked**。本 spec は最小副作用で OG src を tracked 化する .gitignore 調整案を起票する。

---

## §1 現状 .gitignore 全文

```gitignore
node_modules/
*.log
.DS_Store
Thumbs.db
.claude/

# Environment files
.env
.env.local
.env*.local
*/.env.local
*/.env*.local
projects/PRJ-004/app/.env.local

# プロジェクトアプリケーション（各appは独自gitリポジトリで管理）
projects/*/app/
.aidesigner/*
!.aidesigner/.gitkeep

# PRJ-019 Clawbridge は完全に独立した standalone repo として運用
# (DEC-019-053 v15.2 / Plan A 採択 2026-05-04、リモート: hironori-oi/prj019-claude-code-company)
projects/PRJ-019/
```

### 1.1 `projects/*/app/` の影響範囲

- `projects/PRJ-004/app/` 配下 (いっしょびより React Native) → ignore (意図通り)
- `projects/PRJ-012/app/` 配下 (Sumi IDE) → ignore (意図通り)
- `projects/COMPANY-WEBSITE/app/` 配下 (Next.js HP) → ignore (意図せず)
- `projects/PRJ-019/` は別途 ignore で重複だが優先順位上問題なし

---

## §2 候補案 3 種

### 2.1 案 (a): COMPANY-WEBSITE app/src/ 例外 whitelist 追加 (RECOMMENDED)

```gitignore
# (既存)
projects/*/app/

# COMPANY-WEBSITE は monorepo 同居の例外、Next.js src dir のみ tracked
!projects/COMPANY-WEBSITE/app/src/
!projects/COMPANY-WEBSITE/app/src/**
```

**長所**:
- 最小副作用、既存 `projects/*/app/` ルールを破壊しない
- `app/src/` 配下のみ track、`node_modules/` `.next/` `public/` 等は依然 ignore のまま
- Next.js App Router 規約 (src/app/) と完璧に整合
- 他プロジェクト (PRJ-004 / PRJ-012) には一切影響なし

**短所**:
- gitignore の `!` (negation) は同一階層で対象 dir を unignore する仕様で、`projects/*/app/` で除外された後の whitelist は **親 dir が ignore されていると効かない** という Git の制約あり
- `projects/COMPANY-WEBSITE/app/` 自体は ignore のまま、`src/` 配下の path は再帰的 tracked にする必要 → 2 行 (`!app/src/` + `!app/src/**`) で正しく動作

**検証コマンド**:
```bash
git check-ignore -v projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
# Expected: ignored 判定が出ない (= tracked 可能)
git check-ignore -v projects/COMPANY-WEBSITE/app/node_modules/foo
# Expected: .gitignore:16:projects/*/app/  (= 引き続き ignore)
git check-ignore -v projects/PRJ-004/app/src/foo.ts
# Expected: .gitignore:16:projects/*/app/  (= 影響なし)
```

### 2.2 案 (b): runbook 配下に og-src/ を切り出し symlink

`projects/COMPANY-WEBSITE/og-src/route.tsx` を実体、`app/src/app/api/og/route.tsx` を symlink。

**短所**: Windows symlink は Developer Mode + git config 必須 (環境差リスク)、Next.js Edge runtime / Vercel build の symlink bundle 保証なし、組織ルール不整合、Round 23+ で同 workaround を別 route にも適用する負債蓄積。

**判定**: 不採用。

### 2.3 案 (c): submodule 化

`projects/COMPANY-WEBSITE/app/` を別 repo 化し submodule 参照。

**短所**: 6/19 直前の破壊的変更、Vercel root directory 再構成、DEC-019-053 (Clawbridge standalone) との混乱、Round 22 範囲超過。

**判定**: Round 22 不採用。Round 25+ の選択肢として保留。

---

## §3 推奨案 = (a)

採用理由: 副作用最小 (4 行追加のみ)、既存方針整合 (各 app 独立 repo 原則は他 PRJ で維持)、コメントで「COMPANY-WEBSITE 例外」を明示、rollback 容易 (4 行削除のみ)。

### 3.1 採用 .gitignore patch (差分)

```diff
 # プロジェクトアプリケーション（各appは独自gitリポジトリで管理）
 projects/*/app/
+
+# COMPANY-WEBSITE は monorepo 同居の例外
+# Next.js src dir layout の src/ 配下のみ tracked にする
+!projects/COMPANY-WEBSITE/app/src/
+!projects/COMPANY-WEBSITE/app/src/**
+
 .aidesigner/*
 !.aidesigner/.gitkeep
```

### 3.2 検証手順

```bash
# 1. 編集前の baseline 確認
git check-ignore -v projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
# Expected before: .gitignore:16:projects/*/app/

# 2. 上記 patch を .gitignore に適用

# 3. 編集後の動作確認
git check-ignore -v projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
# Expected after: ignored 判定なし (exit 1)

# 4. 影響範囲確認
git check-ignore -v projects/COMPANY-WEBSITE/app/node_modules/foo
# Expected: .gitignore:16:projects/*/app/  (= 引き続き ignore)
git check-ignore -v projects/COMPANY-WEBSITE/app/.next/cache/foo
# Expected: .gitignore:16:projects/*/app/  (= 引き続き ignore)
git check-ignore -v projects/PRJ-004/app/src/foo.ts
# Expected: .gitignore:16:projects/*/app/  (= 他 PRJ 無影響)

# 5. dry-run で track 対象を可視化
git status --ignored projects/COMPANY-WEBSITE/app/
```

---

## §4 副作用評価 (案 a)

| 項目 | 影響 | 評価 |
|---|---|---|
| `projects/COMPANY-WEBSITE/app/src/` 配下の全 file が tracked になる | 既存 commit 済 file と重複の可能性 | git status で確認、既 tracked なら無影響 |
| `projects/COMPANY-WEBSITE/app/node_modules/` 等の ignore | 維持される | 影響なし |
| `projects/COMPANY-WEBSITE/app/api/` (path A) | 既存 ignore | 維持 = path A は untracked のまま (削除予定) |
| `projects/COMPANY-WEBSITE/app/.next/` | 既存 ignore | 維持 |
| `projects/COMPANY-WEBSITE/app/public/` | 既存 ignore | path B 採用方針 (§5) に従う |
| 他プロジェクト (PRJ-004, PRJ-012, etc.) | 影響なし | OK |

### 4.1 既存 src/ 配下の状態確認

```bash
ls projects/COMPANY-WEBSITE/app/src/
# Expected: app/ components/ data/ lib/
git ls-files projects/COMPANY-WEBSITE/app/src/ | head -20
```

### 4.2 patch 適用後に意図せず tracked 化される候補

`*.log` は既存 root ignore で cover、`.next/` は `app/.next/` が `projects/*/app/` で cover (whitelist は src/ 配下のみ)。`*.tsbuildinfo` は Round 23+ で必要になれば追加。

---

## §5 public/ ディレクトリの扱い (補足)

`projects/COMPANY-WEBSITE/app/public/` は Next.js の static asset dir。OG image template assets (logo SVG, font woff2) を置く可能性あり。

### 5.1 現状

`projects/*/app/` で ignore されている。

### 5.2 Round 22 での判断

- Round 22 では public/ 配下に新規 asset を追加しない (OG image は dynamic generation、static fallback なし)
- Round 23+ で必要になったら、本 spec を改訂し `!projects/COMPANY-WEBSITE/app/public/` を追加

→ 本 Round では `app/src/` のみ whitelist で十分。

---

## §6 Round 22 適用タイミング

### 6.1 適用 step (execution-readiness §1.4 と整合)

1. Round 22 物理 migration 開始時、最初の git 操作の前に .gitignore patch 適用
2. `git check-ignore -v` で 4 件の検証コマンド全て期待通り動作することを確認
3. その後、§2 step 1 (path B 作成) に進む

### 6.2 commit 順序

```bash
# patch 適用後、まず .gitignore 単独で commit (= 規則変更を独立履歴化)
git add .gitignore
git commit -m "chore(gitignore): whitelist projects/COMPANY-WEBSITE/app/src/ for monorepo Next.js"

# その後 path B を別 commit で追加
git add projects/COMPANY-WEBSITE/app/src/app/api/og/route.tsx
git commit -m "feat(og-image): physical src migration to App Router src layout"
```

→ 2 commit 分離により、もし何か問題が起きた時に「.gitignore 規則変更」と「OG src 物理化」を独立に revert 可能。

---

## §7 rollback

### 7.1 .gitignore patch の rollback

```bash
git revert <gitignore-commit-hash>
# または
git checkout HEAD~1 -- .gitignore
```

### 7.2 rollback 後の状態

- `app/src/` 配下が再度 ignore される
- 既に commit 済の path B file は git tracked のまま (= rollback 後も履歴は残る)
- 物理 file を削除する場合は別途 `rm -rf` + commit

---

## §8 PASS criteria (本 spec 完了判定)

- 採用案: (a)
- patch 内容: §3.1 の 4 行 (コメント + 2 whitelist + 空行)
- 検証 4 case 全て期待通り
- 副作用評価表 (§4): 全項目「無影響」または「意図通り」
- Round 22 runbook (`og-image-src-migration-execution-runbook.md` §1.4) と整合

---

## §9 Round 23+ 引継

- public/ whitelist (§5)、tsbuildinfo ignore (§4.2)、submodule (§2.3) は将来検討
- 新規 API route も `app/src/app/api/` 配下なら本 patch で cover

---

EOF
