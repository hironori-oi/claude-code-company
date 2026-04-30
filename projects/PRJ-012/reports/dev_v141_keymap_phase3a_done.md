# PRJ-012 v1.41.0 (DEC-079 Phase 3a): Import/Export JSON + Minor 4 件吸収 完了レポート

> 日付: 2026-05-01 / 担当: dev (シニアエンジニア)
> 対象: PRJ-012 sumi v1.41.0 (Phase 3 候補のうち後方互換 + ユーザー価値高 4 項目を吸収)
> ベース: `projects/PRJ-012/reports/dev_v140_keymap_phase2_done.md` + `dev_keybinding_editor_proposal.md`
> DEC: DEC-078 (案 C ハイブリッド + Standard) / DEC-079 (Phase 2 完成 + Phase 3 候補)

---

## 0. TL;DR

- **Import / Export JSON 機能**を Settings 「キーバインド」に新設。Tauri dialog/fs API
  経由で `sumi-keybindings-YYYY-MM-DD.json` の保存/読込、上書き / マージの 3 択 dialog、
  schema validation + warning 蓄積で部分 import に対応
- DEC-079 レビュー Minor 4 件 (M-Phase2-A / B / C / E) を吸収。M-Phase2-D
  (`EscapeProvider` rename) は **破壊的変更のため v2.0.0 へ温存**
- `useBoundCallback` の `scope: "global"` を **`"auto"`** に rename (`"global"`
  は deprecated alias として残置、v2.0.0 で削除)
- ref scope を listener 実行時動的解決 + rAF 1 度の attach retry に変更し、commit-then-attach 取り逃し race を解消
- `terminal.reset` の dispatch を `dispatchTerminalAction` に一本化、container.addEventListener 別経路を撤去
- KeybindingsSettings の context フィルタ選択状態を `sumi:keymap-ui-state` (別 store) に永続化
- **typecheck PASS / lint 新規警告ゼロ / vitest 92/92 PASS** (Phase 2 の 66 + Phase 3a 追加 26)
- バージョン bump: package.json / Cargo.toml / tauri.conf.json を 1.40.0 → **1.41.0**
- E2E `keybinding-editor.spec.ts` に 2 ケース追加 (Import/Export ボタン disable + filter 永続化)、ローカル run は port 競合で見送り、CI で再検証

---

## 1. 新規ファイル一覧

### `lib/keymap/` (3 ファイル新規)

| ファイル                            | 行数 (概算) | 責務                                                 |
| ----------------------------------- | ----------- | ---------------------------------------------------- |
| `lib/keymap/import-export.ts`       | ~220        | export payload 生成 + parse + applyImport (純粋関数)。Tauri dialog/fs に依存しない |
| `lib/keymap/import-export.test.ts`  | ~250        | vitest 22 ケース (validate / merge / replace / unknown id / invalid accel / 各種 schema 違反) |
| `lib/keymap/ui-state.ts`            | ~95         | KeybindingsSettings の UI 状態 (context フィルタ) を localStorage に永続化する独立 store |
| `lib/keymap/ui-state.test.ts`       | ~30         | vitest 3 ケース (default / set / KeyContext 全値受理) |

---

## 2. 修正ファイル一覧

### registry / keymap core (1 ファイル)

| ファイル                       | 主な変更                                                                |
| ------------------------------ | ----------------------------------------------------------------------- |
| `lib/keymap/hooks.ts`          | `KeyScope` 型に `"auto"` 追加 (M-Phase2-A)、`"global"` を `@deprecated` alias 残置。ref scope の `ref.current` 解決を listener 実行時動的解決 + rAF 1 度の attach retry に変更 (M-Phase2-B) |
| `lib/keymap/hooks.test.ts`     | KeyScope alias の型 pin テスト 1 ケース追加                            |

### components (2 ファイル)

| ファイル                                     | 主な変更                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `components/settings/KeybindingsSettings.tsx` | Import/Export ボタンを Header 行に追加 / Import 確認 AlertDialog (上書き/マージ/キャンセル) / context フィルタ state を `useKeymapUiStore` 経由に切替 / Tauri 環境判定 + browser fallback (disabled + tooltip) |
| `components/terminal/TerminalPane.tsx`       | `resetFnRef` を導入し `dispatchTerminalAction("terminal.reset", ..., resetFnRef)` で直接呼出 (M-Phase2-E)。container.addEventListener("keydown") の Ctrl+Shift+L hardcode 監視を撤去 |

### test / version / changelog

- `tests/e2e/keybinding-editor.spec.ts`: 2 ケース追加 (Import/Export buttons disabled in browser、context filter persists across reload)
- `package.json` / `src-tauri/Cargo.toml` / `src-tauri/tauri.conf.json`: 1.40.0 → 1.41.0
- `CHANGELOG.md`: `## [v1.41.0] - 2026-05-01` セクション追加 (Added/Changed/Fixed/Notes)

### ナレッジ

- `organization/knowledge/keybinding-architecture.md`:
  - title / 最終更新を v1.41.0 に
  - 新セクション §4-A「Phase 3a (v1.41.0) で実装した範囲 — Import / Export + Minor 4 件吸収」追加
    - JSON schema 仕様 (v1)、validation ルール表、Import モード表、Tauri/Web fallback 解説
    - M-Phase2-A / B / C / E の改修内容と理由
    - v2.0.0 へ温存した項目一覧

---

## 3. Import / Export 仕様の詳細

### 3-1. JSON スキーマ (v1)

```jsonc
{
  "schema": "sumi-keybindings",         // 固定値、import 時の magic check に使用
  "version": 1,                           // 現行 v1。将来 schema 変化時は v2 を追加
  "exportedAt": "2026-05-01T12:34:56Z", // ISO8601、参考情報
  "appVersion": "1.41.0",                 // package.json の version、参考情報
  "overrides": {
    "chat.send": "Mod+Enter",          // string = 上書き accel
    "palette.command": "Mod+Shift+K",
    "app.openHelp": null                // null = 明示 unbind
  }
}
```

### 3-2. Validation ルール

**top-level (parseImportPayload で throw)**:

| 状況 | 挙動 |
| --- | --- |
| `JSON.parse` 失敗 | `Error("JSON として読み込めませんでした...")` |
| ルートが object でない | `Error("ルートはオブジェクトである必要があります")` |
| `schema` が一致しない (or 欠落) | `Error("schema field が ... と一致しません")` |
| `version` が 1 でない | `Error("schema version 1 のみ対応...")` |
| `overrides` が object でない | `Error("overrides field は object である必要があります")` |
| `overrides[id]` が string\|null でない | `Error("overrides.<id> は string または null...")` |

**entry-level (applyImport で warning + skip)**:

| 状況 | 挙動 |
| --- | --- |
| `id` が registry に無い | `warning(reason: "unknown-binding-id")` + skip |
| `accel` が parse できない | `warning(reason: "invalid-accel")` + skip |
| `accel` が空文字 / key 部分なし | 同上 (parseAccel が key === "" を返す) |
| `value` が予期せぬ型 | `warning(reason: "invalid-value-type")` + skip (parseImportPayload を通っていれば実質起きない) |
| `null` (明示 unbind) | always 受理 |

「entry skip + warning」設計の理由: registry の id 命名が将来変わっても、
古い export ファイルから **大半の entry は救える** ようにするため。

### 3-3. UX フロー

**Export**:
1. 「Export」ボタン押下
2. Tauri save dialog: `defaultPath = sumi-keybindings-YYYY-MM-DD.json`、フィルタ `*.json`
3. 選択された path に `writeTextFile`
4. 成功で toast.success(`Export 完了: ${path}`)、失敗で toast.error

**Import**:
1. 「Import」ボタン押下
2. Tauri open dialog: 単一ファイル選択、フィルタ `*.json`
3. `readTextFile(selected)` → `parseImportPayload(raw)` → 成功すれば pendingImport state に立てる
4. AlertDialog 表示 (件数 + 上書き/マージの説明 + appVersion / exportedAt 表示)
5. ユーザーが「上書き」「マージ」「キャンセル」を選択
   - 上書き: `applyImport(currentOverrides, payload, "replace")` → `useKeybindingsStore.setState({ overrides: result.overrides })`
   - マージ: 同 + `"merge"` mode
   - キャンセル: pendingImport を null に戻すだけ
6. toast: 警告ゼロ → success(`${applied} 件を適用`)、警告あり → warning(`${applied} 件適用、${warnings.length} 件 skip`)

### 3-4. Tauri / Web fallback

| 環境 | Import / Export ボタン | 検知方法 |
| --- | --- | --- |
| Tauri webview | 有効 (clickable) | `window.__TAURI_INTERNALS__` 存在 |
| Web (Next.js dev) | disabled + tooltip「Tauri 環境でのみ利用可能です」 | 同上 false |

`@tauri-apps/plugin-dialog` / `@tauri-apps/plugin-fs` は既に依存済 (`AppearanceSettings.tsx` で背景画像選択に利用、`MemoryTreeView.tsx` で `watchImmediate` 利用、`editor.ts` で `readTextFile/writeTextFile` 利用)。`tauri-plugin-dialog` / `tauri-plugin-fs` Rust 側 + capabilities 側 (`dialog:allow-save` / `fs:allow-write-text-file` 等) も既にすべて declare 済。

---

## 4. DEC-079 Minor 4 件 (A/B/C/E) の解消状況

| ID | 内容 | v1.41.0 対応 |
| -- | --- | --- |
| **M-Phase2-A** | `useBoundCallback` の `scope: "global"` 命名と auto-context-aware 挙動の乖離 | ✓ 解消: `"auto"` を新名として導入、`"global"` は `@deprecated` alias で残置 (v2.0.0 で削除予定) |
| **M-Phase2-B** | ref scope の `refTarget?.current` が useEffect 内 1 回しか解決されない (mount 後 attach に対応できない) | ✓ 解消: useEffect 内で `tryAttach()` を即時 + rAF 1 度 retry。同一 ref が後から `.current` 更新されても次 frame で attach |
| **M-Phase2-C** | context フィルタ状態の永続化 | ✓ 解消: 新 store `useKeymapUiStore` (`sumi:keymap-ui-state`) を独立で作成し、keymap 設定本体 (`sumi:keybindings`) と分離。reload で復元 |
| **M-Phase2-E** | `terminal.reset` の `dispatchTerminalAction` noop 統合 | ✓ 解消: `resetFnRef` 経由で直接呼出。container.addEventListener("keydown") 別経路を撤去 |

### M-Phase2-D を v2.0.0 に温存した理由再確認

`EscapeProvider` の rename (実体は「応答停止 + 折りたたみ + ヘルプ起動 hotkey provider」、現名は v1.21.0 の DEC-067 由来で「Esc 系を集約した provider」だった頃の名残) は:

- **`Shell.tsx` の import を破壊する** (`import { EscapeProvider } from ...` が壊れる)
- ファイル名 / 関数名の同時改名が必要で、import の追従修正が他 component に飛ぶ可能性あり
- 機能的価値はゼロ (純粋に命名整理)

破壊的変更を minor release で押し込むと、ユーザー側で動かなくなる訳ではない (component 内部 API なので) ものの、**git history / 検索性 / IDE jump-to-def の観点で「過去 v1.x の調査」がやりにくくなる**。Semantic Versioning に照らして v2.0.0 でのまとめ実施が妥当と判断。

---

## 5. 動作確認結果

### 5-1. 静的解析

| 項目         | 結果              | 備考                                                  |
| ------------ | ----------------- | ----------------------------------------------------- |
| `typecheck`  | PASS              | `tsc --noEmit` エラーゼロ                              |
| `lint`       | 新規警告ゼロ      | 既存 ~32 件は手付かず (Shell.tsx の未使用 import 等、無関係) |

### 5-2. ユニットテスト (vitest)

| ファイル                              | ケース | 結果   |
| ------------------------------------- | ------ | ------ |
| `lib/keymap/match.test.ts`            | 26     | PASS   |
| `lib/keymap/store.test.ts`            | 12     | PASS   |
| `lib/keymap/conflicts.test.ts`        | 14     | PASS   |
| `lib/keymap/context.test.ts`          | 8      | PASS   |
| `lib/keymap/hooks.test.ts` (拡張)      | 7      | PASS   |
| `lib/keymap/import-export.test.ts` (新) | 22     | PASS   |
| `lib/keymap/ui-state.test.ts` (新)     | 3      | PASS   |
| **合計**                              | **92** | **PASS** |

カバレッジ要点 (Phase 3a 追加分):
- `buildExportPayload`: schema/version 固定値、overrides の shallow clone (caller mutation isolation)、null override 保持
- `stringifyExport`: pretty-print + parse 往復可能
- `buildExportFilename`: YYYY-MM-DD format (1月や12月の zero-pad)
- `parseImportPayload`: 正常 / schema 違反 / version 違反 / overrides 型違反 / JSON parse 失敗 / array root / 必須以外 field 欠落の許容
- `applyImport(replace)`: 既存 override 全消し + 適用、warning 0 件
- `applyImport(merge)`: 既存維持 + 上書き
- `applyImport`: unknown id skip、invalid accel skip、null override 受理、empty string skip、件数 (total / applied / warnings)
- `useKeymapUiStore`: default 値、setContextFilter、KeyContext 全値受理
- KeyScope 型に `"auto"` / `"global"` 両方が受理されることの型 pin

### 5-3. E2E (Playwright)

`tests/e2e/keybinding-editor.spec.ts` 計 5 ケース (Phase 1 の 2 + Phase 2 の 1 + Phase 3a の 2):

1. override の永続化確認 (Phase 1)
2. 衝突 warning 表示 (Phase 1)
3. context フィルタ動作 (Phase 2)
4. **Import / Export ボタン disabled in browser (Phase 3a 新)**
5. **context フィルタ選択状態の永続化 (Phase 3a 新)**

#### ローカル run 見送り

`playwright.config.ts` の `webServer.url: "http://localhost:3000"` は port 3000 を別 dev server (HANEI 等) が占有していると失敗。CI で 28 + 1 + 2 = 31 ケース PASS 想定。

CEO 側で CI が走るタイミングで再検証を依頼。

### 5-4. Tauri 実環境での実動作確認 (手動チェック想定項目)

ローカル `tauri:dev` で次を確認することを推奨 (本タスクでは静的解析 + vitest + E2E spec ケース追加までで完結):

- [ ] 設定画面 `/settings` →「キーバインド」タブ → Import / Export ボタンが Tauri 環境で **enabled** になる
- [ ] Export ボタン → save dialog 起動 → ファイル選択 → JSON 出力に schema/version/overrides が含まれる
- [ ] 出力 JSON を別 instance で Import → AlertDialog で 3 択提示 → マージ で既存維持 + 追加、上書きで全消し + 適用
- [ ] context フィルタを Terminal にして reload → 復元される
- [ ] terminal.reset を override (例: Mod+Shift+R) → terminal で Mod+Shift+R を押すと viewport reset (term.reset + fit) が走り、旧 default の Mod+Shift+L は何も起こらない (= 一本化が機能している)

---

## 6. v2.0.0 候補項目の整理

本 release で意図的に温存した項目:

| 項目 | 理由 | 期待される release |
| --- | --- | --- |
| **M-Phase2-D** EscapeProvider rename | Shell.tsx の import 互換破壊 / SemVer 整合 | v2.0.0 |
| `react-hotkeys-hook` 依存削除 | ImagePasteZone の特殊事情整理が前提、依存削除自体が破壊的 | v2.0.0 |
| Tauri `plugin-store` 移行 | settings.ts と同タイミングで実施したい (storage shape 連動) | v2.0.0 |
| when 句 DSL | `terminalFocus && !searchOpen` 等。overkill 寄りで実装規模 L | v2.0.0+ |
| custom binding 追加 | 新 command id をユーザー定義で追加。実装規模 L、UX 設計が独立で重い | v2.0.0+ |
| `KeyScope` 型から `"global"` alias 削除 | deprecation 完了 | v2.0.0 |
| `terminal.cycleTerminal` (Ctrl+Tab) の registry 化 | DEC-079 候補のまま、Tab 修飾単独問題の検証要 | v1.42+ or v2.0.0 |
| editor (Monaco) context 統合 | Monaco 内部 binding と整合させる作業が独立で重い | Phase 3+ |

---

## 7. 成果物パス一覧

### 新規 (本タスク)

```
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/import-export.ts
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/import-export.test.ts
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/ui-state.ts
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/ui-state.test.ts
projects/PRJ-012/reports/dev_v141_keymap_phase3a_done.md (本ファイル)
```

### 修正 (本タスク)

```
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/hooks.ts
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/hooks.test.ts
projects/PRJ-012/app/ccmux-ide-gui/components/settings/KeybindingsSettings.tsx
projects/PRJ-012/app/ccmux-ide-gui/components/terminal/TerminalPane.tsx
projects/PRJ-012/app/ccmux-ide-gui/tests/e2e/keybinding-editor.spec.ts
projects/PRJ-012/app/ccmux-ide-gui/package.json (1.40.0 → 1.41.0)
projects/PRJ-012/app/ccmux-ide-gui/src-tauri/Cargo.toml (1.40.0 → 1.41.0)
projects/PRJ-012/app/ccmux-ide-gui/src-tauri/tauri.conf.json (1.40.0 → 1.41.0)
projects/PRJ-012/app/ccmux-ide-gui/CHANGELOG.md (v1.41.0 セクション追加)
organization/knowledge/keybinding-architecture.md (Phase 3a セクション追記、Title 更新)
```

---

## 8. CEO 用 release 確認事項

- [x] `npm run typecheck` PASS
- [x] `npm run lint` 新規警告ゼロ (既存 ~32 件は無関係)
- [x] vitest 92/92 PASS (Phase 2 の 66 + Phase 3a 追加 26)
- [ ] CI で E2E 31 ケース PASS (Phase 1 の 28 + Phase 2 の 1 + Phase 3a の 2、port 3000 がフリーな環境前提)
- [ ] 設定画面 `/settings` →「キーバインド」タブで Import / Export ボタンが Tauri 実環境で enabled、browser で disabled (tooltip 表示)
- [ ] Export → 別 instance で Import (上書き / マージ) で期待通り反映される
- [ ] context フィルタ選択 (Terminal) → reload 後復元される
- [ ] terminal.reset を override → 新 accel で reset が機能する (= M-Phase2-E 一本化が機能)
- [ ] DEC-079 への Phase 3a 完了記述追記は CEO 判断
- [ ] tag `v1.41.0` の作成・push は CEO が一括実施

---

> 本レポートは PRJ-012 v1.41.0 候補 (DEC-079 Phase 3a) の実装完了報告。
> tag / DEC 追記 / push は CEO が一括実施。
