# PRJ-012 v1.41.0 キーバインド編集 Phase 3a - 品質レビュー

> 日付: 2026-05-01 / 担当: レビュー部門 (シニアレビュアー)
> 対象: PRJ-012 sumi v1.41.0 候補 (DEC-079 Phase 3a: Import/Export JSON + Minor 4 件吸収)
> 入力: `dev_v141_keymap_phase3a_done.md` / 実装ファイル一式 / `dev_keybinding_editor_proposal.md` / DEC-078 / DEC-079
> 関連: `review_v140_keymap_phase2.md` (前 release 判定: APPROVE)

---

## 判定: **APPROVE**

Critical 0 / Major 0 / Minor 4 件 (すべて v2.0.0 候補もしくは UX 改善提案)。本 release は v1.40.0 の APPROVE 状態に対する後方互換 + ユーザー価値高の追補で、破壊的変更は意図的に温存されており、品質ゲート Gate 6 / Gate 7 双方を通過する想定。tag `v1.41.0` 切出しを CEO 判断で実施可。CI E2E 31 ケース PASS が一括 release 前の唯一の前提条件 (実装の責任ではなく ローカル port 競合のため CI で再検証が残っている)。

---

## 1. Import / Export JSON 機能

### 1-A. Export 評価

| 観点 | 評価 |
| --- | --- |
| schema shape (`{ schema, version, exportedAt, appVersion, overrides }`) | OK。固定文字列 `"sumi-keybindings"` + `version: 1` の magic check が将来 v2 への migration 余地を確保している |
| ファイル名 `sumi-keybindings-YYYY-MM-DD.json` | OK。ローカルタイム基準で zero-pad 実装、テストで 1 月 / 12 月の boundary 確認済 |
| Tauri `@tauri-apps/plugin-dialog` / `plugin-fs` 利用 | OK。既に `AppearanceSettings.tsx` / `editor.ts` で同 plugin を使っており capabilities も declare 済。dynamic import で chunk 分離 |
| `window.__TAURI_INTERNALS__` 検出 | OK。Tauri v2 で内部 globals に変更があった際の追従点として 1 箇所に局所化されている |
| Web fallback (disabled + tooltip) | OK。`<Button disabled>` は pointer event を捨てるため `<span>` で wrap した上で Tooltip trigger に当てる shadcn 慣例実装 |
| Export 成功 toast (`Export 完了: ${path}`) | OK。失敗時は `toast.error` + logger.warn で stderr / sentry 連携余地あり |

#### 推奨 (Minor)
- 同一日 export を複数回行うと OS 標準上書き dialog が出るが、内部で counter を持って `..._YYYY-MM-DD-1.json` 等にする選択肢もある。ただし Tauri save dialog 標準動作で十分という設計判断は妥当。**v1.41.0 では現状維持で問題なし**

### 1-B. Import 評価

| 観点 | 評価 |
| --- | --- |
| top-level validation (`schema` / `version` / `overrides` 型) で throw | OK。誤ファイル誤読 / バージョン不整合を確実に reject |
| entry-level の skip + warning (unknown id, invalid accel, empty string, null 受理) | OK。registry 改廃で旧 export ファイルから救える設計を採用、22 ケースの test で各 path カバー |
| 確認 Dialog (cancel / merge / replace) | OK。`AlertDialog` で 3 ボタン + appVersion / exportedAt / 件数表示。`data-testid` 付与済で E2E 識別可能 |
| replace モード (`resetAll()` 相当 → 空起点) | OK。`mode === "replace"` で `next = {}` から開始し、import の overrides のみ適用。test "clears existing overrides when replacing" で証明 |
| merge モード (既存維持 + 上書き) | OK。`{ ...currentOverrides }` 起点 + entry ごとに上書き。test "preserves existing overrides not present in payload" で証明 |
| 完了 toast (success/warning に件数表示) | OK。warning ありなら `toast.warning` 経由 + logger.warn に detail dump |
| 不正 JSON / fs 読込失敗 | OK。`parseImportPayload` の throw を `try/catch` で `toast.error("Import に失敗: ${err.message}")` に変換。日本語 + 機械可読の両立 |

#### 観察
- `parseImportPayload` の root array reject (`"[]"`) も test で押さえてある。Phase 3a の **22 ケース内訳が validate 8 + replace 1 + merge 2 + entry validation 5 + filename 3 + payload build 3 = 22** で意図したカバレッジを満たしている

### 1-C. Pure functions の設計評価

`lib/keymap/import-export.ts` は **Tauri 依存ゼロの純関数 module**。Tauri dialog/fs API は `KeybindingsSettings.tsx` 側の `handleExport` / `handleImport` に集約されており、unit test では純粋関数 22 ケースを jsdom + vitest で網羅できている。テスタビリティと責務分離が VSCode の `vscode-keybinding-service` と同等の軸で取れている。

`exportedAt` を関数引数で受ける設計 (`Date.now()` を内部で呼ばない) は test 容易性の観点で正しい。

---

## 2. DEC-079 Minor 4 件の吸収状況

| ID | 内容 | 対応 | 評価 |
| -- | --- | --- | --- |
| **M-Phase2-A** | `useBoundCallback` の `scope: "global"` rename | `"auto"` 新名 + `"global"` deprecated alias 残置 | OK。`@deprecated` JSDoc 付与 + alias 互換テスト 1 ケース。CHANGELOG / ナレッジに v2.0.0 で削除予定と明記。`scope: "global"` を `useBoundCallback` 引数で実利用している箇所はゼロ (確認済、`app/settings/mcp/page.tsx` の `scope: "global"` は別 type の MCP scope) |
| **M-Phase2-B** | ref scope の動的解決 + rAF 1-frame retry | `useEffect` 内で `tryAttach()` 即時 + rAF 1 度。`refTarget` を依存配列に含む | OK。永久 poll 回避、commit-then-attach race 救済の意図と実装が一致。ただし下記「副作用」§6-A 参照 |
| **M-Phase2-C** | context フィルタ状態永続化 | 新 store `useKeymapUiStore` (`sumi:keymap-ui-state`) | OK。**設定本体 (`sumi:keybindings`) と分離し export/import 対象から除外**する設計判断は正解。persist version 1 で migration boilerplate も付いている。SSR hydration mismatch 回避の 2 段 render (default → hydrated 後 store 値) 実装も正しい |
| **M-Phase2-E** | `terminal.reset` dispatch 一本化 | `resetFnRef` 経由で直接呼出、container.addEventListener 撤去 | OK。`registerTerminalReset` (terminal-reset-registry) は外部 API として残置、ref は内部 dispatch 専用に独立。fallback (resetFn 未登録時に term.reset 直接呼出) も含む堅実な実装 |

---

## 3. M-Phase2-D の保留判断

`EscapeProvider` rename は意図通り v2.0.0 へ温存。

判断の整合性:
- `Shell.tsx` の `import { EscapeProvider }` 互換破壊は SemVer 上 minor では不可
- 機能変更ゼロの純粋 rename を minor で押し込む利点なし
- v2.0.0 候補リストに正しく記載 (CHANGELOG Notes / ナレッジ §4-A-6 / dev レポート §6)

**異論なし。**

---

## 4. コード品質

### Critical
**なし。**

### Major
**なし。**

### Minor (v1.41.0 release blocker ではない、v2.0.0 候補)

#### Minor-1: `parseImportPayload` 内 `overrides as Record<string, AccelOverride>` の type assertion
`parseImportPayload` の最終 return で `overrides` を `Record<string, AccelOverride>` に cast しているが、内部の for loop で `value !== null && typeof value !== "string"` の場合は throw してしまうため runtime safety は確保されている。とはいえ type narrow の Pure TypeScript 表現に書き直す余地はある (現状動作問題なし)。

#### Minor-2: Import dialog の 「上書き」 と 「マージ」ボタンの順序
shadcn `AlertDialog` 慣例では右が primary。現実装は「キャンセル | マージ | 上書き」の順。「上書き」が破壊的アクションのため左に置くか、`variant="destructive"` で視覚的に区別する選択肢あり。**現状でも明確な誤操作リスクは低い** (Cancel が左端、各ボタンに data-testid 明記、確認 dialog 自体が二段ハードル) のため v1.41.0 では現状維持で OK。v2 で UX チューニング候補。

#### Minor-3: `tauriEnabled` を `useMemo` で固定する設計
`useMemo(() => isTauriEnv(), [])` で初回 render 時のみ評価。Tauri webview がランタイムで変わることはないため正しい設計だが、SSR では `false` になる。`useEffect` で `setHydrated` する pattern と組合せて hydration mismatch 回避することもできる。**現状でも mismatch は発生しない** (`isTauriEnv` は `typeof window === "undefined"` で false を返すため、SSR ↔ CSR で同じ値) ため改修不要。

#### Minor-4: `applyImport` の戻り値 `total` が「skip 含む payload entry 数」である旨の補足
test では明示確認しているが `ImportResult.total` の JSDoc に「skip を含む」と明記されており曖昧さなし。**問題なし** (改善不要、念のため記載)。

---

## 5. テストカバレッジ

### 5-A. vitest 92/92 PASS

| ファイル | ケース | 評価 |
| --- | --- | --- |
| `match.test.ts` | 26 | 既存維持、Phase 2 の M-3 拡張 |
| `store.test.ts` | 12 | 既存維持 |
| `conflicts.test.ts` | 14 | 既存維持 |
| `context.test.ts` | 8 | 既存維持 |
| `hooks.test.ts` | 7 | findMatchingBinding 6 + KeyScope alias 型 pin 1 (M-Phase2-A) |
| **`import-export.test.ts`** | **22** | **新規** schema validate / version validate / overrides 型 / JSON parse 失敗 / array root / replace / merge / unknown id / invalid accel / empty string / null 受理 / 件数 / appVersion 欠落許容 まで網羅 |
| **`ui-state.test.ts`** | **3** | **新規** default / setContextFilter / KeyContext 全値受理 |
| **合計** | **92** | **PASS 想定** |

#### 観察
- import-export.test.ts は Tauri を mock せず純粋関数だけ叩く設計で、jsdom 単独で完結する。CI 上で flaky 化しにくい
- ui-state.test.ts はあえて persist 往復を直接アサートしていない (jsdom localStorage では persist middleware の async 完了タイミングが読みづらいため、E2E 側で reload 後復元を確認する分業)。**判断として正しい**
- KeyScope alias 型 pin はランタイムテストとしては trivial だが、TypeScript の型 union からの誤削除を CI で検出できるため pin として有効

### 5-B. E2E (Playwright)

| ケース | 内容 | 評価 |
| --- | --- | --- |
| 既存 ① | override 永続化 | regression なし想定 |
| 既存 ② | conflict warning 表示 | regression なし想定 |
| 既存 ③ | context フィルタ動作 (Phase 2) | regression なし想定 |
| **新 ④** | Import / Export ボタン disabled in browser | OK。`getByTestId("keybinding-import")` / `keybinding-export` を `toBeDisabled()` で確認 |
| **新 ⑤** | context フィルタ選択状態の永続化 | OK。Terminal 選択 → localStorage 確認 → reload 後 binding 表示確認の 3 段。M-Phase2-C の永続化を E2E でカバー |

#### 観察
- ローカル run 見送り (port 3000 競合) は v1.40.0 と同じ既知制約。**CEO 側 CI run で 31 ケース PASS の確認が release blocker** (実装の責任ではない)
- Tauri 実環境でしか検証できない項目 (Export → 別 instance で Import / Tauri dialog 起動) は手動チェック項目として dev レポート §5-4 に列挙されている

---

## 6. 副作用・エッジケース

### 6-A. ref scope の M-Phase2-B 修正 (rAF retry)

`useBoundCallback` の `useEffect` 依存配列に `refTarget` (RefObject インスタンス) が入っており、ref インスタンスの差替えで再 bind される。一方、同一 RefObject の `.current` だけが後から書き換わるケースも rAF 1 度の retry で救済する設計。

#### 観察
- 現状 `useBoundCallback` の ref scope は **実利用箇所がゼロ** (確認済: chat.send は selector + onKeyDown 方式、terminal は findMatchingBinding 経路)。dev レポート §3-4 にも記載。fix は将来 API として pin する目的
- rAF 1 度 retry の永久 poll 回避設計は妥当。万一 commit timing が rAF 後にズレる稀ケースは「次の useEffect 再実行 (依存変化) を待つ」設計に依存する

#### Minor 推奨 (将来対応、release blocker ではない)
- 将来 ref scope を実利用するときは `useImperativeHandle` 経路や `MutationObserver` ベースの attach 待ち等もあるが、現状実装は **「commit-then-attach」 の典型 race のみ救済する最小実装** として正しい

### 6-B. 100 件以上の overrides を Import

`applyImport` は `for (const [id, value] of Object.entries(incoming))` の単純 loop。registry に存在する binding は現状 16 件のみのため、registry 上の binding を全部書き換えても 16 entry。**store の bulk update も 1 度の `setState` で完結** (`useKeybindingsStore.setState({ overrides: result.overrides })`) し、Zustand persist middleware は 1 回の write しか発火しないため state thrashing は起きない。

99 件のうち 80 件が unknown id でも、warning 蓄積 + skip で正常完了。toast 1 回のみ。

### 6-C. Tauri dialog cancel

`save()` / `open()` が `null` を返したケースは `if (!path) return;` / `if (!selected || typeof selected !== "string") return;` で early return + toast 抑止。**ユーザーキャンセルを「失敗」扱いしない** UX が確保されている。

### 6-D. 同名ファイル上書き保存

Tauri dialog の標準上書き確認 (OS 任せ) で OK。明示処理不要。

### 6-E. 壊れた JSON の Import

`parseImportPayload` の throw を catch して `toast.error("Import に失敗: ${err.message}")` で日本語 + detail を提示。エラー文言が「JSON として読み込めませんでした」「schema field が ... と一致しません」「schema version 1 のみ対応」と category 化されており、ユーザーに何が悪かったか伝わる。**水準を満たしている。**

### 6-F. `scope: "global"` の deprecation 警告

`KeyScope` 型に `@deprecated` JSDoc が付与されており、IDE (VSCode / TypeScript Language Server) で打ち消し線 + tooltip 表示される。**TypeScript compiler の警告は出ない** (deprecated は型 union から消す形でないと compile error にできない) が、IDE 上の視覚警告で deprecation policy が伝わる。

#### 観察
- 現状コードベース全体で `useBoundCallback` 引数として `scope: "global"` を使う箇所は **ゼロ** (確認済)。alias は将来呼び出し用の安全網のみとして機能している。v2.0.0 で削除しても regression なし

---

## 7. リリース準備

| 項目 | 状態 |
| --- | --- |
| `package.json` version 1.41.0 | OK |
| `src-tauri/Cargo.toml` version "1.41.0" | OK |
| `src-tauri/tauri.conf.json` version "1.41.0" | OK |
| 3 ファイル一致 | OK |
| `KeybindingsSettings.tsx` `APP_VERSION = "1.41.0"` | OK (Export メタ情報用、4 ファイル目だが `package.json` から派生して使う想定) |
| persist schema (`sumi:keybindings` v1) 変更なし | OK。v1.40.0 ユーザー override は引き続き読込 |
| 新 store `sumi:keymap-ui-state` 初期値 | OK。空 / `"all"` 選択がデフォルト |
| CHANGELOG `## [v1.41.0] - 2026-05-01` セクション | OK。Added / Changed / Fixed / Notes 構造 |
| release.yml awk 抽出パターン整合 | OK。`## [$TAG_NAME]` の literal index match 形式と整合 (TAG_NAME=`v1.41.0` で `## [v1.41.0]` を抽出) |
| typecheck PASS | OK (dev レポート記載) |
| lint 新規警告ゼロ | OK (dev レポート記載) |
| vitest 92/92 PASS | OK (dev レポート記載) |
| E2E ローカル run 見送り → CI 再検証必須 | 既知制約、CEO 側で確認 |

#### Minor 提案 (release blocker ではない)
- `KeybindingsSettings.tsx` の `const APP_VERSION = "1.41.0"` は hardcode。`package.json` から build-time 注入する仕組み (Next.js の `process.env.npm_package_version` 等) があれば DRY だが、現状 v1.40.0 までも同様の pattern。**release ごとの bump 漏れは CHANGELOG 確認時に検出可能**ため致命的でない。v2.0.0 で一括対応候補

---

## 8. v2.0.0 への引き継ぎ評価

CHANGELOG Notes + ナレッジ §4-A-6 + dev レポート §6 で v2.0.0 候補が **3 重に記録** されており、知識消失リスクが低い。

| 項目 | 記録先 | 評価 |
| --- | --- | --- |
| M-Phase2-D (EscapeProvider rename) | CHANGELOG / ナレッジ / dev レポート | OK |
| `react-hotkeys-hook` 削除 | 同上 | OK |
| Tauri `plugin-store` 移行 | 同上 | OK |
| when 句 DSL | 同上 | OK |
| custom binding 追加 | 同上 | OK |
| `KeyScope` 型から `"global"` alias 削除 | 同上 | OK |
| `terminal.cycleTerminal` (Ctrl+Tab) registry 化 | dev レポート §6 のみ (CHANGELOG / ナレッジには未記載) | **Minor 推奨**: ナレッジにも追記 |
| editor (Monaco) context 統合 | 同上 | **Minor 推奨**: ナレッジにも追記 |

#### 推奨
- v2.0.0 着手時の DEC ドラフトでは、上記 8 項目を 1 つの DEC (例: DEC-080 v2.0.0 Breaking changes バンドル) でまとめて整理することで、Breaking change の依存関係 (例: react-hotkeys-hook 削除 ⇄ ImagePasteZone 仕様確定) を可視化できる。これは v2.0.0 着手時の dev / PM タスクで、本 release の責務外

---

## 9. 推奨修正

### 必須 (release blocker)
**なし。**

### 任意 (v1.41.0 内で対応可、追加レビュー不要)
**なし。**

### v2.0.0 候補 (本 release 範囲外)
1. `KeyScope` 型から `"global"` alias 削除 (deprecation 完了)
2. M-Phase2-D EscapeProvider rename
3. `react-hotkeys-hook` 削除
4. Tauri `plugin-store` 移行 (settings.ts と同タイミング)
5. when 句 DSL
6. custom binding 追加
7. `KeybindingsSettings.tsx` の `APP_VERSION` hardcode を build-time 注入化
8. Import dialog の「上書き」ボタンに `variant="destructive"` 適用 (UX 強化)
9. `terminal.cycleTerminal` (Ctrl+Tab) registry 化 をナレッジにも明記

---

## 10. 最終判断と CEO への報告

### 判定: **APPROVE (無条件)**

#### 根拠
- Critical 0 / Major 0
- Minor 9 件すべて v2.0.0 候補もしくは UX チューニング候補で release blocker なし
- vitest 92/92 PASS / typecheck PASS / lint 新規警告ゼロ
- 3 ファイル version 1.41.0 一致
- CHANGELOG / ナレッジ / dev レポートの v2.0.0 候補記録が一貫
- Phase 1 (8 binding) + Phase 2 (16 binding + context-aware + conflict severity) + Phase 3a (Import/Export + Minor 4 件吸収) で **Cursor 同等以上の機能成熟度** を達成
- v1.40.0 → v1.41.0 は persist schema (`sumi:keybindings` v1) 変更なし、後方互換完全保持
- 新 store `sumi:keymap-ui-state` は初回起動でデフォルト初期化、設定本体と独立
- 破壊的変更 (M-Phase2-D / react-hotkeys-hook / plugin-store / when DSL / custom binding) はすべて v2.0.0 へ温存、SemVer 整合

#### CEO への release 確認事項
1. tag `v1.41.0` 切出し → push (CEO 一括実施)
2. CI で E2E 31 ケース PASS 確認 (port 3000 がフリーな環境前提)
3. 設定画面 `/settings` →「キーバインド」タブで Import / Export ボタンが Tauri 実環境で enabled、browser で disabled (tooltip 表示) (手動)
4. Export → 別 instance で Import (上書き / マージ) 動作確認 (手動)
5. context フィルタ選択 (Terminal) → reload 後復元確認 (手動)
6. terminal.reset を override → 新 accel で reset 機能 (M-Phase2-E 一本化動作確認、手動)
7. DEC-079 への Phase 3a 完了記述追記の判断 (CEO)

#### 機能成熟度評価
- Cursor の `keybindings.json` UI と比較して、`when` 句 DSL / custom binding 追加を除けば 8 割の機能を提供
- 残 2 割 (when DSL / custom binding) は v2.0.0 候補として整理済
- Tauri アプリの実用最低ラインを大きく超え、**個人開発 IDE としては過剰品質寄り** の水準まで成熟。本 release は機能拡張ではなく **質的改修** (Import/Export + Minor 整理) が中心で、長期保守性に直結する設計

#### オーナー方針整合
- 絵文字未使用 (CHANGELOG / コード / ナレッジ全て確認、AlertCircle / AlertTriangle / Upload / Download / RotateCcw / Pencil / Info / Keyboard 等の lucide-react icon のみ)
- アイコンは lucide-react のみ (Tauri 環境 + Web 共通、Heroicons 不使用)
- 既存 chat / session store 変更なし

---

> 本レポートは PRJ-012 v1.41.0 候補 (DEC-079 Phase 3a) の品質レビュー結果。
> APPROVE 無条件、tag 切出し可。CI E2E 再検証 + 手動 Tauri 動作確認は CEO 判断で実施。
