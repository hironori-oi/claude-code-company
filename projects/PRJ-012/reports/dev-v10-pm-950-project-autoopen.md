# PRJ-012 v1.2 — PM-950 前回 active project の auto-restore

**日付**: 2026-04-20
**担当**: dev
**branch**: `v1.2-dev`
**工数**: 約 30 min（要求仕様 1h に対し早期完了）

## ゴール

Cursor / VSCode 同等 UX: アプリ起動時に **前回 active だった project を自動選択**
する。Persist された `activeProjectId` を復元し、stale / invalid なら最初の valid
project にフォールバック、空なら未選択のままにする。

## 実装差分

### 変更ファイル（1 ファイル、frontend のみ）

- `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\stores\project.ts`
  - `onRehydrateStorage` の `pruneStaleProjects` 完了後、`hydrated=true` 前に
    auto-select logic を挿入。
  - 新規コード: 約 30 行（大半がコメント）

### 変更なし

- `components/layout/Shell.tsx` — 読込のみ（変更不要と判断）
- `app/page.tsx` — 読込のみ（変更不要と判断）
- Rust / sidecar — 完全無変更

## 設計判断

### なぜ Shell.tsx ではなく store の `onRehydrateStorage` に入れたか

要求仕様は「Shell.tsx の mount useEffect or app/page.tsx」を示唆していたが、
本リポジトリでは store 側に auto-restore の前処理が既に集約されている:

1. `persist()` middleware が localStorage から `activeProjectId` / `projects` を
   復元
2. `onRehydrateStorage` 内で `pruneStaleProjects()` を await → 削除済みパスを
   除外し、対応する `activeProjectId` も null にリセット
3. 完了後 `hydrated=true` をセット
4. **この直後の空白期間に「auto-select」を差し込むのが最も race-free**

Shell.tsx に mount useEffect を置くと、pruneStale の完了と mount の前後関係に
依存してしまい、snapshot orchestrate（PM-890）や sidecar status restore と
race しうる。store 側に集約することで:

- `hydrated=true` が `true` になった時点で必ず auto-select 済 → subscribe 側は
  追加 guard なしで信頼できる
- ProjectRail / StatusBar など複数 consumer が同じ値を見るので一貫性を担保
- 重複発火がない（Shell.tsx の mount は viewMode 切替等で複数回起こりうる）

### auto-select の判定条件

```ts
const savedIsValid =
  savedActive !== null &&
  projectsAfterPrune.some((p) => p.id === savedActive);
if (!savedIsValid && projectsAfterPrune.length > 0) {
  useProjectStore.setState({
    activeProjectId: projectsAfterPrune[0].id,
  });
}
```

- `savedActive` が valid（persist に残っていて pruneStale 後も生存）→ 何もしない
- 無効 or null で projects が 0 件 → null 維持（初回 user）
- 無効 or null で projects が 1 件以上 → 配列先頭を auto-select

「配列先頭」は `projects` の追加順（`registerProject` 時に push）で固定される
ため、ユーザ視点でも直感的（最初に登録した project）。

### sidecar lifecycle への影響

L465 コメントのとおり v3.5.8 以降、`setActiveProject` は内部で `ensureSidecarRunning`
を呼ばない。本実装は `useProjectStore.setState({ activeProjectId })` で直接
値をセットするだけなので、sidecar は **停止中のまま**。ユーザーが「起動」
ボタンを押すか、下位の `list_active_sidecars` 復元で実態 running が見えるか
のどちらかで起動表示される。要求仕様「既存 sidecar は停止中のまま」を満たす。

### Edge case

| ケース | 動作 |
|---|---|
| 初回 user（localStorage 空） | `projects = []` で auto-select skip → 未選択 |
| persist はあるが projects がすべて削除済 | pruneStale 後 `projects = []` → 未選択 |
| persist の `activeProjectId` が stale path を指す | pruneStale が null 化 → 先頭 auto-select |
| persist の `activeProjectId` が valid | 何もしない（前回 active 維持） |
| SSR (window 無) | persist から空 state → projects 0 件で skip。副作用なし |

## 検証結果

### 型チェック

```
$ npx tsc --noEmit
exit=0
```

### ビルド

```
$ npx next build
✓ Compiled successfully in 4.7s
✓ Generating static pages (7/7)
✓ Exporting (2/2)

Route (app)                                 Size  First Load JS
┌ ○ /                                    1.49 kB         116 kB
├ ○ /_not-found                             1 kB         105 kB
├ ○ /settings                            10.6 kB         158 kB
├ ○ /settings/mcp                        6.52 kB         144 kB
└ ○ /workspace                           6.42 kB         202 kB
```

既存の ESLint warnings（StatusBar の未使用変数、img 要素警告等）のみで、
本 chunk 由来の新規 warning / error は 0 件。

### 並列 Agent (PM-949 Monaco theme) との衝突

- PM-949 担当: `components/editor/*` / `lib/file-icon.ts`
- 本 chunk 担当: `lib/stores/project.ts` のみ
- 衝突なし

## 動作確認シナリオ（手動）

1. **前回 active 維持**: 複数 project 登録 → project B を選択 → アプリ再起動
   → B が selected 状態で表示される
2. **stale fallback**: project B を active のまま B ディレクトリを rename/削除
   → アプリ再起動 → pruneStale で B 除外 → 先頭の project A が auto-select
3. **初回 user**: localStorage clear → アプリ起動 → 未選択（Welcome pane）
4. **sidecar 停止維持**: 前回 active project の sidecar を「停止」で落とす →
   再起動 → project は auto-select されるが sidecar は停止のまま（StatusBar
   表示「停止中」）

## 完了条件チェック

- [x] アプリ起動で前回 active project が自動選択される
- [x] 初回 user / invalid state では graceful fallback
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功
- [x] レポート作成

## CEO への報告

PM-950 実装完了。`lib/stores/project.ts` の `onRehydrateStorage` 内 1 箇所の
追加のみで、`pruneStaleProjects` 完了直後に「activeProjectId が invalid で
projects が非空なら先頭を auto-select」するロジックを追加しました。
frontend のみ・最小 diff・Shell/page.tsx/Rust 側無変更・PM-949 と衝突なし。

Cursor / VSCode 同等の「前回 workspace を自動復元」UX が v1.2 で実現されました。
sidecar は「停止中のまま」の要件も満たしており、既存の v3.5.8 で確立された
「起動はユーザー明示操作のみ」方針を壊していません。
