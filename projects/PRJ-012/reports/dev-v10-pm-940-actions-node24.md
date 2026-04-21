# PRJ-012 / PM-940 — GitHub Actions Node.js 24 対応

- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **対象バージョン**: v1.1 向け（local 蓄積、未 push / uncommitted）
- **実施日**: 2026-04-20
- **担当**: dev (Opus 4.7)
- **工数**: 約 30 分
- **関連**: PM-938 / PM-939（同じく v1.1 向け local 蓄積）

---

## 1. 背景

v1.0.0 の Release Actions 実行ログで以下の deprecation warning が出現:

```
Node.js 20 actions are deprecated. Please update the following actions to use Node.js 24:
actions/cache@v4, actions/checkout@v4, actions/setup-node@v4, actions/upload-artifact@v4.
For more information see: https://github.blog/changelog/2025-09-11-github-actions-transitioning-from-node-20-to-node-24/.
Actions will be forced to run with Node.js 24 by default starting June 2nd, 2026.
Node.js 20 will be removed from the runner on September 16th, 2026.
```

**deadline**:
- 2026-06-02: Node.js 20 actions が強制的に Node 24 で実行される（古い dist/ は壊れる可能性）
- 2026-09-16: Node.js 20 runtime が runner から削除

現時点（2026-04-20）では warning のみで動作影響なし。v1.1 release までに upgrade しておく方針。

---

## 2. 採用方針

**方針 A（action major bump）を採用**。
各 action の最新 major は全て Node 24 runtime に移行済みであることを確認したため、暫定策（`FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: 'true'` 環境変数）は不要。

### 2.1 Node 24 runtime 採用確認

各 action の最新 major `action.yml` を WebFetch で参照し、`using: 'node24'` を確認:

| Action | 最新 major | `using:` 値 | Node 24 対応 |
|---|---|---|---|
| `actions/checkout` | v6 (v6.0.2) | `node24` | OK |
| `actions/cache` | v5 (v5.0.5) | `node24` | OK |
| `actions/setup-node` | v6 (v6.4.0) | `node24` | OK |
| `actions/upload-artifact` | v7 (v7.0.1) | `node24` | OK |
| `actions/download-artifact` | v8 (v8.0.1) | `node24` | OK |
| `softprops/action-gh-release` | v3 (v3.0.0) | `node24` | OK |
| `Swatinem/rust-cache` | v2 (v2.9.1) | `node24` | OK（既に v2 系で Node 24 移行済） |
| `dtolnay/rust-toolchain` | stable（composite） | — | composite action、Node ランタイム未使用 |

---

## 3. Before / After 版数比較

| Workflow / Action | Before | After |
|---|---|---|
| **release.yml** | | |
| `actions/checkout` (build job) | `@v4` | `@v6` |
| `actions/setup-node` | `@v4` | `@v6` |
| `Swatinem/rust-cache` | `@v2` | `@v2`（変更なし、既に Node 24） |
| `actions/cache` | `@v4` | `@v5` |
| `actions/upload-artifact` | `@v4` | `@v7` |
| `actions/checkout` (release job) | `@v4` | `@v6` |
| `actions/download-artifact` | `@v4` | `@v8` |
| `softprops/action-gh-release` | `@v2` | `@v3` |
| `dtolnay/rust-toolchain` | `@stable` | `@stable`（composite、変更なし） |
| **build-windows.yml** | | |
| `actions/checkout` | `@v4` | `@v6` |
| `actions/setup-node` | `@v4` | `@v6` |
| `dtolnay/rust-toolchain` | `@stable` | `@stable`（変更なし） |
| `Swatinem/rust-cache` | `@v2` | `@v2`（変更なし） |
| `actions/cache` | `@v4` | `@v5` |
| `actions/upload-artifact` (x3) | `@v4` | `@v7` |
| **e2e.yml** | | |
| `actions/checkout` | `@v4` | `@v6` |
| `actions/setup-node` | `@v4` | `@v6` |
| `actions/cache` (x2) | `@v4` | `@v5` |
| `actions/upload-artifact` (x2) | `@v4` | `@v7` |

---

## 4. 各 workflow の変更 diff 要約

### 4.1 `.github/workflows/release.yml`

- L109: `actions/checkout@v4` → `@v6`
- L134: `actions/setup-node@v4` → `@v6`
- L164: `actions/cache@v4` → `@v5`
- L220: `actions/upload-artifact@v4` → `@v7`
- L265: `actions/checkout@v4` → `@v6`（release job 側）
- L273: `actions/download-artifact@v4` → `@v8`
- L406: `softprops/action-gh-release@v2` → `@v3`

その他のロジック（matrix、updater manifest 生成、GitHub Release body 等）には一切手を加えていない。

### 4.2 `.github/workflows/build-windows.yml`

- L71: `actions/checkout@v4` → `@v6`
- L81: `actions/setup-node@v4` → `@v6`
- L125: `actions/cache@v4` → `@v5`
- L196, L206, L218: `actions/upload-artifact@v4` → `@v7`（3 箇所）
- コメント文の `(後述の actions/cache@v4 と…)` → `(後述の actions/cache@v5 と…)` も追随修正

### 4.3 `.github/workflows/e2e.yml`

- L50: `actions/checkout@v4` → `@v6`
- L55: `actions/setup-node@v4` → `@v6`
- L63, L77: `actions/cache@v4` → `@v5`
- L97, L106: `actions/upload-artifact@v4` → `@v7`

---

## 5. 暫定策（env var）の採否

**不採用**。理由:

- 各 action の最新 major が全て Node 24 runtime で正式 release 済み
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` は 2026-06-02 まで migration 期間限定の逃げ道として GitHub が用意しているもの
- 最新 major への bump で根治できるなら env var 併用は冗長

万一 upgrade 後に regression が出た場合は pin version（例: `actions/checkout@v5`）に rollback、または最悪 env var を job env に追加する fallback を取る。

---

## 6. 検証

- `python -c "import yaml; yaml.safe_load(open(...))"` で 3 yml 全て parse 成功（syntax OK）
- `release.yml` の `workflow_dispatch` に `dry_run` input が既に存在するため、commit 前 or 後に手動で dry-run 可能（本タスクでは静的検証まで）
- 実 release 時（v1.1 tag push）までに 1 回 workflow_dispatch で smoke test しておくと安全

---

## 7. 次回 release 時の注意

1. **v1.1 tag push 前に workflow_dispatch dry-run を実施**
   - `release.yml` の dry_run=true で matrix build を一通り流して、upload-artifact@v7 の挙動（retention、artifact 名）に regression がないか確認
2. **upload-artifact@v4 → v7 の breaking change**
   - v5 で「同名 artifact の上書き不可、並列 job で衝突するとエラー」が入っている（既に `ccmux-ide-${{ matrix.platform.label }}` と matrix 分けしているので問題なし）
   - v7 では `include-hidden-files: false` がデフォルト（元々 hidden file を意図的に含めていないので影響なし）
3. **download-artifact@v4 → v8 の breaking change**
   - v5 で `pattern` + `merge-multiple: true` の組合せ仕様が確定。既存指定 (`pattern: ccmux-ide-*`, `merge-multiple: true`) は v8 でもそのまま動く
4. **softprops/action-gh-release@v2 → v3**
   - v3 で deprecated だった `body_path` 相対パス指定などに変更あり。本 workflow は `body_path: release-notes.md`（workspace ルート相対）で書いているため互換
   - `fail_on_unmatched_files: false` は v3 でもサポート継続
5. **rebuild 要否**: 既存 v1.0.0 Release の artifact を再 upload する必要はなし。v1.1 tag を新規に push すれば新版 action で artifact 生成される

---

## 8. 未対応 / フォロー項目

- **`dtolnay/rust-toolchain@stable`**: composite action なので Node 24 の warning 対象外。別途 `rustls 1.94.0` pin 変更時にレビュー
- **`Swatinem/rust-cache@v2`**: v2 系最新（v2.9.1）で既に Node 24 対応済みのため今回 bump 不要
- **local の uncommitted 変更は PM-940 作業分のみ**。PM-938 / PM-939 の変更には触れていない
- commit / push はオーナーの指示待ち（本タスクでは local 保存のみ）

---

## 9. 完了状況

- [x] 全 workflow の `@v4` actions を最新 major に更新
- [x] YAML syntax valid（Python yaml.safe_load 通過）
- [x] Before/After 版数比較表 作成
- [x] 各 workflow 差分要約 作成
- [x] 次回 release 時の注意事項 作成
- [x] 他 Agent (PM-890 snapshot) の作業対象（`components/*`）には未接触
- [ ] 実 CI 実行（workflow_dispatch dry-run）→ オーナー判断、本タスク対象外

---

**報告**: CEO 経由でオーナーへ。Node.js 24 強制切替（2026-06-02）までに実 dry-run 1 回の実施を推奨。
