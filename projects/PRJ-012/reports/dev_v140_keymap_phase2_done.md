# PRJ-012 v1.40.0 (DEC-078 Phase 2): キーバインド編集 Phase 2 完成レポート

> 日付: 2026-05-01 / 担当: dev (シニアエンジニア)
> 対象: PRJ-012 sumi v1.40.0 (v1.39.0 は意図的 skip)
> ベース: `projects/PRJ-012/reports/dev_v138_keymap_phase1_done.md` + `review_v138_keymap_phase1.md`
> DEC: DEC-078 (案 C ハイブリッド + Standard スコープ + 段階リリース)

---

## 0. TL;DR

- **Cursor 同等のキーバインド編集体験を完成**: registry を 8 → 16 binding (chatInput 1 件 + terminal 7 件) に拡大
- terminal の `attachCustomKeyEventHandler` を **vanilla helper `findMatchingBinding(event, "terminal")`** で registry 駆動 dispatch に refactor (~7 binding × override 可)
- `useBoundCallback` に **context-aware scope** 追加 (`global` / `contextOnly` / `{ ref }` の 3 モード)、registry の context が non-global の binding は自動で context active 時のみ発火
- conflict 検出に **severity** 概念 (`error` / `warning`) と **cross-context (global vs other)** 検出を追加、UI tooltip で詳細文を表示
- KeybindingsSettings に **context フィルタ Tabs** (すべて / Global / ChatIn / Terminal / Editor)、note tooltip (info icon) を追加
- DEC-078 レビュー Minor 6 件 (M-1 / M-3 / M-4 / M-5 / app.openHelp 接続) を本 release で吸収
- **typecheck PASS / lint 新規警告ゼロ / vitest 66/66 PASS** (Phase 1 の 41 + Phase 2 追加 25)
- バージョン bump: package.json / Cargo.toml / tauri.conf.json を 1.38.0 → **1.40.0** (v1.39.0 skip)

---

## 1. 新規ファイル一覧

### `lib/keymap/` (2 ファイル新規)

| ファイル                  | 行数 (概算) | 責務                                                       |
| ------------------------- | ----------- | ---------------------------------------------------------- |
| `lib/keymap/context.ts`   | ~110        | `isContextActive(ctx, event)` 実装。chatInput / terminal の focus 判定 (event.target の closest()) |
| `lib/keymap/hooks.test.ts`   | ~120        | `findMatchingBinding` の vitest (terminal context 6 ケース) |
| `lib/keymap/context.test.ts` | ~125        | `isContextActive` の vitest (8 ケース、Element mock) |

### tests/e2e に 1 ケース追加

- `tests/e2e/keybinding-editor.spec.ts` に **context フィルタの動作確認** を追加 (Phase 1 の 2 ケース → Phase 2 の 3 ケース)

---

## 2. 修正ファイル一覧

### registry / keymap core (5 ファイル)

| ファイル                       | 主な変更                                                                |
| ------------------------------ | ----------------------------------------------------------------------- |
| `lib/keymap/types.ts`          | `KeyBindingDefinition` に `note?: string` 追加 (M-4 用)                  |
| `lib/keymap/bindings.ts`       | terminal 7 件追加 / chat.pasteImage / terminal.search / terminal.paste に `note` 追加 / `app.openHelp` defaultAccel を `null` → `Mod+/` |
| `lib/keymap/match.ts`          | `normalizeEventKey` の冗長 check 整理 + JSDoc 追記 (M-5)                |
| `lib/keymap/conflicts.ts`     | `AccelConflict` に `severity` / `contexts` 追加、cross-context warning 検出、`getConflictsForBinding` ヘルパ追加 |
| `lib/keymap/hooks.ts`          | `useBoundCallback` に `scope` option 追加、vanilla helper `findMatchingBinding(event, context)` 追加 |

### components (5 ファイル)

| ファイル                                          | 主な変更                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `components/terminal/TerminalPane.tsx`            | `attachCustomKeyEventHandler` を registry 駆動化、`dispatchTerminalAction` / `doPaste` ヘルパ追加、wrapper に `data-terminal-pane` marker |
| `components/chat/InputArea.tsx`                   | textarea に `data-chat-input` marker、`chat.send` を hardcode → registry 駆動 (matchesAccel + selector) |
| `components/chat/HelpDialog.tsx`                  | terminal セクション hardcode 7 件削除、registry 駆動セクションに統合 (Ctrl+Tab / Ctrl+V のみ hardcode 残置) |
| `components/providers/EscapeProvider.tsx`         | `app.openHelp` (Mod+/) listener 追加、useDialogStore.openHelp() で起動 |
| `components/palette/CommandPalette.tsx` / `FilePalette.tsx` / `SearchPalette.tsx` | `useCallback` で memoize (M-1 解消)                            |
| `components/settings/KeybindingsSettings.tsx`     | context フィルタ Tabs / note tooltip / severity 別 conflict icon + tooltip 詳細化 |

### test / version / changelog

- `lib/keymap/match.test.ts`: M-3 (不正入力 6 ケース) 追加、`Mod++` の仕様 pin
- `lib/keymap/store.test.ts`: app.openHelp のテストを Mod+/ default に合わせて修正
- `lib/keymap/conflicts.test.ts`: severity / cross-context の test ~5 ケース追加
- `package.json` / `src-tauri/Cargo.toml` / `src-tauri/tauri.conf.json`: 1.38.0 → 1.40.0
- `CHANGELOG.md`: `## [v1.40.0] - 2026-05-01` セクション追加 (Added/Changed/Fixed/Notes)

### ナレッジ

- `organization/knowledge/keybinding-architecture.md`:
  - Phase 2 完了状態を追記
  - context 4 種に Phase 2 完了印
  - **Phase 2 で導入した focus marker** セクション (data-chat-input / data-terminal-pane)
  - **conflict resolution rule** セクション (priority 4 段、具体例)
  - 新規 binding 追加時の注意 (terminal は dispatchTerminalAction の case 追加が必要、chatInput は marker 配置確認)

---

## 3. chatInput context の実装方針

### 3-1. 何を registry 化したか

| binding         | 既定 accel    | 移行先                                                       |
| --------------- | ------------- | ------------------------------------------------------------ |
| `chat.send`     | `Mod+Enter`   | InputArea onKeyDown 内で `matchesAccel(nativeEvent, sendAccel)` 判定 |

### 3-2. 何を意図的に残置したか

| 機能                  | 理由                                                                 |
| --------------------- | -------------------------------------------------------------------- |
| `Shift+Enter` (改行)  | textarea native の改行で十分。registry 化すると IME composition と競合しやすく過剰移行 |
| `Esc` (palette close) | SlashPalette / AtMentionPicker / Radix Dialog の標準 Esc-close と二重発火するリスク |
| `chat.pasteImage` 実 listener | `ImagePasteZone.tsx` の `react-hotkeys-hook` 経由 = browser default paste と共存。Phase 3 で react-hotkeys-hook 削除と同タイミングで再評価 |
| `chat.cancelInput`    | 候補だったが実コード側に対応する単独 hotkey が存在しないため registry 化見送り |

### 3-3. chat.send の実装パターン (selector + onKeyDown 方式)

```tsx
// InputArea.tsx
const sendAccel = useKeybindingsStore((s) =>
  getEffectiveAccelFromState(s, "chat.send")
);

function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
  const isSendAccel =
    sendAccel !== null && matchesAccel(e.nativeEvent, sendAccel);
  // ... palette open 中の slash / at 排他制御 ...
  if (isSendAccel) {
    e.preventDefault();
    void handleSend();
  }
}
```

`useBoundCallback` の `{ ref: textareaRef }` scope ではなく selector + onKeyDown
方式を選んだ理由:
- React の onKeyDown と window listener が二重発火すると IME composition の
  `compositionend` 検出が不安定になる
- textarea 直の onKeyDown は palette open 時の slash/at 排他制御と密結合しているため、
  そこに registry 経由 binding を割り込ませる方が自然

textarea には `data-chat-input` 属性を付与し、`isContextActive("chatInput", event)`
が他 binding (将来追加用) でも正しく判定できるようにした。

---

## 4. terminal context の実装方針

### 4-1. xterm.js dispatch 戦略

xterm.js の `attachCustomKeyEventHandler` は **同期関数** で boolean を返す
仕様。React hook は呼べないため、vanilla helper `findMatchingBinding(event, "terminal")`
を新設した:

```ts
// lib/keymap/hooks.ts
export function findMatchingBinding(
  event: KeyboardEvent,
  context: KeyContext
): string | null {
  for (const def of BINDINGS) {
    if (def.context !== context) continue;
    const accel = getEffectiveAccel(def.id);  // store.getState() 経由
    if (!accel) continue;
    if (matchesAccel(event, accel)) return def.id;
  }
  return null;
}
```

- registry 走査 + accel 解決 + KeyboardEvent 照合を 1 関数で完結
- React hook を呼ばないため `attachCustomKeyEventHandler` の closure 内で安全
- 戻り値は binding id (or null)。caller (TerminalPane) が switch で local 操作に dispatch

### 4-2. registry 化対象 binding 一覧

| ID                       | 既定 accel    | TerminalPane の dispatch 先                          |
| ------------------------ | ------------- | ---------------------------------------------------- |
| `terminal.search`        | `Mod+Shift+F` | `setSearchOpen((p) => !p)` で検索 overlay toggle    |
| `terminal.copy`          | `Mod+Shift+C` | `term.getSelection() → navigator.clipboard.writeText` |
| `terminal.paste`         | `Mod+Shift+V` | `tauri plugin-clipboard-manager.readText() → term.paste` |
| `terminal.clear`         | `Mod+Shift+K` | `term.clear()` (scrollback 残し viewport クリア)      |
| `terminal.newTerminal`   | `Mod+Shift+N` | `useTerminalStore.createTerminal(...)`               |
| `terminal.closeTerminal` | `Mod+Shift+W` | `useTerminalStore.closeTerminal(ptyId)`              |
| `terminal.reset`         | `Mod+Shift+L` | container handler の Ctrl+Shift+L 経路に委譲 (xterm 文字入力抑止のみ) |

### 4-3. hardcode 維持の binding (registry 化対象外)

| 機能                      | 理由                                                                    |
| ------------------------- | ----------------------------------------------------------------------- |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` (terminal cycle) | 修飾単独 + Tab で textarea focus 移動と紛らわしい。**DEC-079 候補** として Phase 3 で再評価 |
| `Ctrl+V` (修飾単独 paste) | Cursor/VSCode 互換の固定動作 (shell SIGINT 互換性のため)。registry に `terminal.paste` (Mod+Shift+V) で明示版を別立てし、修飾単独 Ctrl+V は固定挙動 |
| `Ctrl+Shift+L` reset の dispatch 先 | container.addEventListener("keydown") 経由で resetFn を呼ぶ既存実装を維持。registry はマッチした事だけ伝えて xterm の文字入力を抑止する役割 |

### 4-4. focus 排他での優先順保証

- TerminalPane の `attachCustomKeyEventHandler` 内で `findMatchingBinding(ev, "terminal")` がマッチしたら **`preventDefault + stopPropagation` 後 `return false`** で xterm の文字入力 + 上位 listener (window) への伝播を両方止める
- これにより `Mod+Shift+F` を terminal focus 時に押す → terminal.search が消費 → SearchPalette (palette.search) は到達しない
- chat / sidebar focus 時は terminal pane の event は飛ばないため、global の palette.search が window listener で受ける

---

## 5. conflict 検出 UI 強化の before/after

### 5-1. before (v1.38.0)

```
| ID                       | 説明                          | キー      | 操作 |
| chat.toggleInputCollapse | 入力欄を折りたたむ            | ⌘⇧I  ⚠   | ... |  ← 黄三角 only
                                                  ↑
                                     tooltip: "同じキーが複数 binding に割当られています"
                                     (severity 概念なし、binding 名表示なし)
```

### 5-2. after (v1.40.0)

```
| ID                       | 説明                          | キー      | 操作 |
| chat.toggleInputCollapse | 入力欄を折りたたむ            | ⌘⇧I  🛑  | ... |  ← AlertCircle 赤 (error)
                                                  ↑
                                     tooltip: "同 context 内重複: ⌘⇧I が
                                     コマンドパレットを開く (palette.command) にも
                                     割当済です。どちらが先に発火するかは未定義の
                                     ため、別の accel に変更してください。"

| palette.search           | 会話を横断検索                | ⌘⇧F  ⚠   | ... |  ← AlertTriangle 黄 (warning)
                                                  ↑
                                     tooltip: "Global と重複: ⌘⇧F が
                                     ターミナル内を検索 (terminal.search) と同じ
                                     です。focus が当該 context にあれば context
                                     側が先に消費し、それ以外は global 側が消費します。"
```

`renderConflictTooltip` で severity 別に文言を出し分け、衝突相手の `description (id)`
を列挙する。

---

## 6. context フィルタ UI のスクショ相当 ASCII 図

```
+------------------------------------------------------------------+
| キーボードショートカット                  [すべてリセット]        |
|------------------------------------------------------------------|
| registry に登録された binding を表示します。                       |
|                                                                  |
| [すべて] [Global] [ChatIn] [Terminal] [Editor]   ← Tabs フィルタ |
|------------------------------------------------------------------|
| ID                  | 説明              | Context | キー   | 操作  |
|---------------------|-------------------|---------|--------|-------|
| terminal.search     | ターミナル内検索 ⓘ| Terminal| ⌘⇧F⚠  | 編集 ↺|
| terminal.copy       | 選択範囲をコピー | Terminal| ⌘⇧C   | 編集 ↺|
| terminal.paste      | クリップボード貼付ⓘ| Terminal| ⌘⇧V   | 編集 ↺|
| terminal.clear      | ターミナルクリア | Terminal| ⌘⇧K   | 編集 ↺|
| terminal.newTerminal| 新ターミナル追加 | Terminal| ⌘⇧N   | 編集 ↺|
| terminal.closeTerminal| ターミナル閉じる| Terminal| ⌘⇧W   | 編集 ↺|
| terminal.reset      | 表示リセット     | Terminal| ⌘⇧L   | 編集 ↺|
+------------------------------------------------------------------+
                          ↑
                  Terminal フィルタ選択中 = 7 件のみ表示
                  ⓘ = note tooltip (info icon)
                  ⚠ = warning (global vs context cross-context)

[Editor] フィルタ:
+------------------------------------------------------------------+
|                                                                  |
|       該当 context に登録された binding はまだありません            |
|                                                                  |
+------------------------------------------------------------------+
```

---

## 7. DEC-078 Minor 6 件の解消状況

| ID  | 内容                                              | v1.40.0 対応            |
| --- | ------------------------------------------------- | ----------------------- |
| M-1 | inline callback の useCallback memoize             | ✓ 解消 (CommandPalette / FilePalette / SearchPalette の 3 ファイル) |
| M-2 | 提案書 7 件 vs 完了レポート 8 件の件数差          | (documentation 課題のため code 変更不要、本レポートで「Phase 2 完了時点 16 件」と再整理) |
| M-3 | match.test.ts の不正入力テスト追加                | ✓ 解消 (`Mod+` trailing / `Mod++` / 空文字 / 大文字小文字混在 / 不明 modifier 名 / 'plus' alias の 6 ケース) |
| M-4 | chat.pasteImage の「ブラウザ管轄」UI hint        | ✓ 解消 (`KeyBindingDefinition.note` 追加 + KeybindingsSettings の info icon + tooltip) |
| M-5 | normalizeEventKey の cosmetic 整理                | ✓ 解消 (動作変更なし、JSDoc 追記、冗長 check 削除) |
| -   | app.openHelp の HelpDialog 起動経路接続          | ✓ 解消 (defaultAccel: null → Mod+/、EscapeProvider で listen + useDialogStore.openHelp 呼出) |

---

## 8. app.openHelp の bind 経路と既定 accel 選択理由

### 経路

```
EscapeProvider.tsx
  └─ useBoundCallback("app.openHelp", handleOpenHelp, { enableOnFormTags: true })
       └─ handleOpenHelp() → useDialogStore.getState().openHelp()
            └─ useDialogStore: helpOpen = true
                 └─ HelpDialog (InputArea.tsx で mount 済) → Dialog open
```

### 既定 accel: `Mod+/` の選択理由

候補:
- **`Mod+/`** ← 採用
- `F1` (VSCode 標準)
- `?` (vim / less 慣例)
- `Mod+Shift+/` (= `Mod+?`、Mac でも入力しやすい)

採用理由:
- VSCode の「Quick Open Help」が `F1`、Cursor も同じ。だが PRJ-012 のターゲット
  ユーザーは Web 系 Cmd+/ (コメントアウト) に慣れているケースもあり、`F1` は
  Tauri webview で OS 標準 (Win の File explorer help 等) と紛らわしい
- `?` 単独は textarea focus 時に文字入力されてしまうので不可
- `Mod+/` は textarea focus 時でも修飾必須なので入力に紛れない
- chat の SlashPalette は `/` 単独で起動するため、`Mod+/` で「help は help」と
  完全に分離できる
- ユーザーが不要なら override で unbind 可

---

## 9. 動作確認結果

### 9-1. 静的解析

| 項目         | 結果              | 備考                                                  |
| ------------ | ----------------- | ----------------------------------------------------- |
| `typecheck`  | PASS              | `tsc --noEmit` エラーゼロ                              |
| `lint`       | 新規警告ゼロ      | 既存 32 件は手付かず (Shell.tsx の未使用 import 等、無関係) |

### 9-2. ユニットテスト (vitest)

| ファイル                         | ケース | 結果   |
| -------------------------------- | ------ | ------ |
| `lib/keymap/match.test.ts`       | 26     | PASS   |
| `lib/keymap/store.test.ts`       | 12     | PASS   |
| `lib/keymap/conflicts.test.ts`   | 14     | PASS   |
| `lib/keymap/context.test.ts` (新) | 8      | PASS   |
| `lib/keymap/hooks.test.ts` (新)   | 6      | PASS   |
| **合計**                         | **66** | **PASS** |

カバレッジ要点 (Phase 2 追加分):
- `parseAccel` 不正入力: trailing `+` / double `+` / 空文字 / whitespace / 不明 modifier / 大文字小文字混在
- `isContextActive`: global 常 true / chatInput textarea 検出 / terminal wrapper 検出 / target なし時 false / editor 常 false
- `findMatchingBinding`: terminal context 限定 / global は terminal context で拾わない / override 反映 / unbind 時 null
- `detectConflicts` severity: 同 context 重複 = error / global vs other = warning / non-global 同士は衝突報告しない
- `findBindingsUsingAccel(crossContext=true)`: global vs context の cross-context pair を拾う

### 9-3. E2E (Playwright)

新規 spec: `tests/e2e/keybinding-editor.spec.ts` 計 3 ケース (Phase 1 の 2 + Phase 2 の 1)

1. **override の永続化確認** (Phase 1): `chat.stopGeneration` を `Ctrl+/` に編集 → reload → 永続化
2. **衝突 warning 表示** (Phase 1): `palette.command` を `Ctrl+Shift+I` に変更 → 両行に warning icon (label の正規表現を Phase 2 文言にも対応するよう拡張)
3. **context フィルタ動作** (Phase 2 新): すべて → terminal でフィルタすると terminal binding のみ表示、Editor で empty state

#### ローカル run 見送り (Phase 1 と同じ理由)

`playwright.config.ts` の `webServer.url: "http://localhost:3000"` は port 3000 を別 dev server が占有していると失敗。CI で 28 + 1 = 29 ケース PASS 想定。

CEO 側で CI が走るタイミングで再検証を依頼。

---

## 10. 残課題 (Phase 3 候補に整理)

| ID    | 内容                                                                |
| ----- | ------------------------------------------------------------------- |
| P3-1  | `react-hotkeys-hook` の依存削除 (`ImagePasteZone.tsx` の特殊事情整理が前提) |
| P3-2  | custom binding 追加 (新 command id をユーザー定義)                    |
| P3-3  | Import / Export JSON                                                |
| P3-4  | Tauri `plugin-store` 移行 (settings.ts と同タイミング)                |
| P3-5  | terminal.cycleTerminal (Ctrl+Tab) の registry 化 — DEC-079 候補        |
| P3-6  | editor (Monaco) context 統合                                          |
| P3-7  | ImagePasteZone を Mod+V registry override で完全に止められるようにする (現状は browser default paste と共存) |

---

## 11. 成果物パス一覧

### 新規 (本タスク)

```
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/context.ts
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/context.test.ts
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/hooks.test.ts
projects/PRJ-012/reports/dev_v140_keymap_phase2_done.md (本ファイル)
```

### 修正 (本タスク)

```
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/types.ts
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/bindings.ts
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/match.ts
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/match.test.ts
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/store.test.ts
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/conflicts.ts
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/conflicts.test.ts
projects/PRJ-012/app/ccmux-ide-gui/lib/keymap/hooks.ts
projects/PRJ-012/app/ccmux-ide-gui/components/terminal/TerminalPane.tsx
projects/PRJ-012/app/ccmux-ide-gui/components/chat/InputArea.tsx
projects/PRJ-012/app/ccmux-ide-gui/components/chat/HelpDialog.tsx
projects/PRJ-012/app/ccmux-ide-gui/components/providers/EscapeProvider.tsx
projects/PRJ-012/app/ccmux-ide-gui/components/palette/CommandPalette.tsx
projects/PRJ-012/app/ccmux-ide-gui/components/palette/FilePalette.tsx
projects/PRJ-012/app/ccmux-ide-gui/components/palette/SearchPalette.tsx
projects/PRJ-012/app/ccmux-ide-gui/components/settings/KeybindingsSettings.tsx
projects/PRJ-012/app/ccmux-ide-gui/tests/e2e/keybinding-editor.spec.ts
projects/PRJ-012/app/ccmux-ide-gui/package.json (1.38.0 → 1.40.0)
projects/PRJ-012/app/ccmux-ide-gui/src-tauri/Cargo.toml (1.38.0 → 1.40.0)
projects/PRJ-012/app/ccmux-ide-gui/src-tauri/tauri.conf.json (1.38.0 → 1.40.0)
projects/PRJ-012/app/ccmux-ide-gui/CHANGELOG.md (v1.40.0 セクション追加)
organization/knowledge/keybinding-architecture.md (Phase 2 完了状態追記、conflict resolution rule、focus marker 規約追記)
```

---

## 12. CEO 用 release 確認事項

- [x] `npm run typecheck` PASS
- [x] `npm run lint` 新規警告ゼロ (既存 32 件は無関係)
- [x] vitest 66/66 PASS (Phase 1 の 41 + Phase 2 追加 25)
- [ ] CI で E2E 29 ケース PASS (Phase 1 の 28 + Phase 2 新 1、port 3000 がフリーな環境前提)
- [ ] 設定画面 `/settings` → 「キーバインド」タブで registry 16 binding が一覧表示される
- [ ] context フィルタで Terminal を選ぶと 7 件のみ表示される
- [ ] terminal.search を override (例: Mod+Shift+G) → terminal で実発火
- [ ] HelpDialog (Mod+/) が起動する
- [ ] DEC-078 への Phase 2 完了記述追記は CEO 判断
- [ ] tag `v1.40.0` の作成・push は CEO が一括実施 (v1.39.0 は skip)

---

## 13. v1.39.0 を skip した理由 (記録)

- Phase 2 を一気通貫で完成版として release するため
- 中間 release (例: v1.39.0 で chatInput context のみ稼働、v1.40.0 で terminal 追加) だと:
  - conflict 検出 UI と registry の整合が取れない時期が発生する
  - ユーザーから見て一貫性のない状態 (UI には terminal binding があるが実 listener がない、または逆)
  - HelpDialog の terminal セクションも段階的に切替えるとユーザーが混乱する
- 一括 release で Cursor 同等体験を「v1.40.0 で完成」と打ち出す方が release notes と整合性が高い

---

> 本レポートは PRJ-012 v1.40.0 候補 (DEC-078 Phase 2 完成) の実装完了報告。
> tag / DEC 追記 / push は CEO が一括実施。
