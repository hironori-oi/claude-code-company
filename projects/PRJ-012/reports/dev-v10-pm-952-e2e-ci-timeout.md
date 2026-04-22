# PRJ-012 v1.2.x hotfix — PM-952 E2E CI apt-get stuck 対応レポート

- **案件ID**: PRJ-012 (ccmux-ide-gui)
- **Ticket**: PM-952
- **対象 branch**: `main` (v1.2.x patch, tag なし)
- **担当**: 開発 (dev) エージェント
- **日時**: 2026-04-22
- **工数実績**: 約 15 分 (目安 30 分)
- **commit**: `1236c5c` (main 直 push 済、`b7f0f45 → 1236c5c`)

---

## 1. 事象 (オーナー提供ログより)

```
2026-04-22T15:54:25.9576297Z Installing dependencies...
2026-04-22T15:54:26.0769748Z Get:1 file:/etc/apt/apt-mirrors.txt Mirrorlist [144 B]
2026-04-22T15:54:56.3682063Z Ign:2 http://azure.archive.ubuntu.com/ubuntu noble InRelease
...  (Azure mirror 30 秒 IGN → Ubuntu main mirror にフェイルオーバ)
2026-04-22T16:14:32.1055266Z ##[error]The operation was canceled.
```

- `.github/workflows/e2e.yml` の `npx playwright install --with-deps chromium`
  が内部的に `sudo apt-get update && sudo apt-get install` を走らせており、
  Azure Ubuntu mirror (noble / 24.04) への接続が stuck。
- workflow `timeout-minutes: 20` に到達して cancel。
- playwright の chromium binary ダウンロード自体には到達前に killed。

## 2. 根本原因

| 層 | 原因 |
|----|------|
| インフラ | GitHub Actions の Azure Ubuntu mirror が 2026-04-22 時点で不安定 (断続的 IGN → fallback 遅延) |
| CI 設定 | `--with-deps` に依存し、apt 障害がそのまま CI 全体の死に直結 |
| 二重化 | cache hit 時にも `npx playwright install-deps chromium` (apt のみ) を必ず走らせる step が別途存在し、cache hit でも同じ stuck が発生しうる構造 |

## 3. 採用方針: Option A (`--with-deps` 削除)

ブリーフに提示された 3 案のうち **Option A** を採用。

- ubuntu-24.04 runner は chromium 実行に必要な OS deps
  (libnss3, libasound2t64, libxkbcommon0, libdrm2, libgbm1, libxshmfence1, fonts-liberation 等)
  を pre-install 済。
- Playwright 1.48 の chromium (Chrome for Testing 147) はこれら pre-install deps で起動可能。
- 最小 diff (apt 呼び出しを完全除去) で mirror 障害の影響を遮断。
- 失敗が再発した場合は Option C (`apt-get install -y --no-install-recommends <必要 package 列挙>`)
  に昇格する方針を workflow 内コメントにも明記。

Option B (retry + timeout) は「mirror が継続的にダメな場合に 3 回 × 5 分 = 15 分消費して
最終的に失敗」となり根治にならないため却下。

## 4. 変更内容

**ファイル**: `C:/Users/hiron/Desktop/ccmux-ide-gui/.github/workflows/e2e.yml`

### diff (要旨)

```diff
+      # Hotfix (v1.2.x / PM-952): Azure Ubuntu mirror 障害で apt-get update が stuck し
+      # 20 分 timeout で workflow が cancel される問題に対応するため --with-deps を削除。
+      # ubuntu-24.04 runner は chromium 実行に必要な OS deps (libnss3, libasound2t64,
+      # libxkbcommon0, libdrm2 等) を pre-install 済のため、browser binary のみ入れれば
+      # 動作する。失敗が再発した場合は Option C (apt で明示 install) に昇格する。
       - name: Install Playwright Chromium
         if: steps.playwright-cache.outputs.cache-hit != 'true'
-        run: npx playwright install --with-deps chromium
-
-      # deps だけ再インストール（cache hit 時も dep packages 必要）
-      - name: Ensure Playwright deps
-        if: steps.playwright-cache.outputs.cache-hit == 'true'
-        run: npx playwright install-deps chromium
+        run: npx playwright install chromium
```

- 論理変更: 6 insertions / 6 deletions (うち 5 行は日本語コメント)。
- 機能変更は実質 2 箇所:
  1. `--with-deps` フラグ除去
  2. cache hit 時の `install-deps` step を step 単位で削除
    (両方とも apt 依存のため)

## 5. 検証

| 項目 | 結果 |
|------|------|
| YAML syntax (`python -c "import yaml; yaml.safe_load(...)"`) | OK |
| `npx playwright install chromium --dry-run` (local) | OK (Chrome for Testing 147.0.7727.15 / playwright chromium v1217 が解決) |
| git diff レビュー | OK (意図した最小差分のみ) |
| push | OK (`b7f0f45..1236c5c main -> main`) |
| 他 Agent (PM-953 skill) との衝突 | `.github/workflows/e2e.yml` のみ touch、components/lib/app 未修整のため衝突可能性 0 |

CI 実機検証はブリーフ通り **次回オーナー push 時** に確認する運用。
e2e.yml の `paths:` フィルタ上、この commit 自体 (`.github/workflows/e2e.yml` 変更) は
push trigger を満たすため、push 後ただちに e2e workflow が 1 回走っている想定。

## 6. 影響範囲 / リスク

- **Product 影響**: なし (CI 専用ファイルの変更)
- **他 workflow**: `build-windows.yml` / `release.yml` には触れず
- **version tag**: v1.2.x patch tag 不要 (ブリーフ指示通り)
- **回帰リスク**: 低。cache hit 時に走っていた `install-deps` step を消したため、
  万一 runner image が将来 deps を削った場合に e2e が壊れる可能性があるが、
  その際はログに playwright の `missing dependencies` が明示されるため即座に診断可能。
  その場合は Option C (apt で明示 install) に昇格する旨を yaml コメントに残した。

## 7. フォローアップ / 次アクション

- [ ] (自動) 次回 push で E2E workflow が apt stuck なしで完走することを確認
- [ ] 万一失敗したら Option C へ昇格:
      `sudo apt-get install -y --no-install-recommends libwebkit2gtk-4.1-0 libasound2t64 libxshmfence1 libxkbcommon0`
- [ ] v1.2.x CHANGELOG に「CI 安定化: apt-get stuck 回避」1 行追記の余地あり
      (product binary 影響なしのため必須ではない)
- [ ] 同じ `--with-deps` 依存が他 workflow に無いか横断チェック
      → `build-windows.yml` / `release.yml` は Windows 系で apt 非依存、clean

## 8. CEO 向けサマリ

- PM-952 (E2E CI の apt-get stuck タイムアウト) を main に直 hotfix 済 (commit `1236c5c`)。
- `.github/workflows/e2e.yml` から `--with-deps` を削除し、apt 経由の OS deps install を廃止。
- ubuntu-24.04 runner の pre-installed deps で chromium は動作想定、失敗時は Option C へ昇格の
  エスカレーションパスを yaml コメントに明記済。
- product binary 影響なしのため v1.2.x patch tag は不要、CHANGELOG 追記は任意。
- 次回 push 時の CI 完走を実機確認する運用で CLOSE 可。

---

以上。
