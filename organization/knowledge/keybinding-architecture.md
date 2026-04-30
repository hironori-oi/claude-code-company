# Keybinding アーキテクチャ (PRJ-012 v1.38.0 → v1.41.0 / DEC-078 / DEC-079)

> 起源: PRJ-012 sumi v1.38.0 (2026-05-01) / Phase 1 実装
> 最終更新: PRJ-012 sumi v1.41.0 (2026-05-01) / Phase 3a (Import/Export + Minor 4 件吸収)
> ベース提案: `projects/PRJ-012/reports/dev_keybinding_editor_proposal.md` (案 C ハイブリッド)

中央 registry + ユーザー override 方式のキーバインド設計指針。Tauri / Electron 系
デスクトップアプリで「VSCode の `keybindings.json` 全機能までは要らないが、
read-only の hardcode から脱したい」中規模アプリの実用解。

---

## 1. 設計の核

### 1-A. データの流れ

```
+-----------------+        +------------------+        +----------------+
| bindings.ts     |        | store.ts         |        | hooks.ts       |
| 中央 registry   |  --->  | overrides 永続化 |  --->  | useBoundCallback|
| (defaultAccel)  |        | (Zustand+local)  |        | window keydown |
+-----------------+        +------------------+        +----------------+
                                    ^
                                    |
                          +--------------------+
                          | KeybindingsSettings|
                          | + KeyRecorder      |
                          +--------------------+
```

- **registry** は単なる readonly array of `{ id, description, defaultAccel,
  context, category? }`。実装は `lib/keymap/bindings.ts`
- **store** は `overrides: Record<id, accel | null>` の Zustand persist。
  `null` = unbind (binding 不発)。未登録 id = default にフォールバック
- **hook** は registry id に callback を bind する thin wrapper。`accel === null`
  なら listener を貼らない (= 効率的に unbind)
- **UI** は registry を表 render し、KeyRecorder で accel を録音。`detectConflicts`
  で同 context 内重複を warning 表示

### 1-B. ID 命名規約

`<category>.<verb>` の dot 区切り。verb は lowerCamelCase。

良い例:
- `chat.send`, `chat.stopGeneration`, `chat.toggleInputCollapse`
- `palette.command`, `palette.file`, `palette.search`
- `app.openHelp`
- `terminal.search`, `terminal.clear` (Phase 2 で追加予定)

避けるべきパターン:
- `cmdK` / `ctrlK` のような **キー由来の id** (override 後に意味がズレる)
- スコープ無し flat id (`stopGeneration`) — 規模拡大で衝突する
- snake_case (`chat.stop_generation`) — 一貫性のため lowerCamelCase 推奨

### 1-C. context 分類 (4 種)

| context     | 有効スコープ                          | Phase 1 / 2 / 3 |
| ----------- | ------------------------------------- | --------------- |
| `global`    | アプリ全域 (focus 不問)               | Phase 1 ◯       |
| `chatInput` | chat textarea にフォーカス時          | Phase 2 ◯       |
| `terminal`  | xterm canvas にフォーカス時           | Phase 2 ◯       |
| `editor`    | Monaco エディタ内 (Monaco 内部委譲)   | Phase 3+        |

Phase 1 は context 判定 (`isContextActive`) を実装せず、`useBoundCallback` は
**常に window で listen** する制約付きだった。Phase 2 (v1.40.0) で `lib/keymap/
context.ts` に `isContextActive(ctx, event)` を追加し、`useBoundCallback` 内で
event.target を `closest()` で見て context active 判定を入れた。

#### Phase 2 で導入した focus marker

context 判定は `event.target` の `closest()` で行う。各 component で marker
属性を付与する:

| context     | marker (closest 検索 selector)                          | 付与場所                           |
| ----------- | ------------------------------------------------------- | ---------------------------------- |
| `chatInput` | `textarea[data-chat-input]` / `[data-chat-input]`       | `components/chat/InputArea.tsx`    |
| `terminal`  | `[data-terminal-pane]` / `.xterm-helper-textarea` / `.xterm` / `[role="application"][aria-label="ターミナル"]` | `components/terminal/TerminalPane.tsx` |
| `editor`    | (Phase 3 で実装)                                         | -                                  |

新規 binding を追加する場合、対応する component に上記 marker を付与しないと
`isContextActive(ctx, event)` が常に false を返して binding が発火しない。
逆に marker を付ければ既存 listener には変更なしで context-aware 化される。

### 1-D. Mod プレースホルダ

`Mod` は OS 抽象化された修飾キー。Mac で `Cmd` (metaKey)、Win/Linux で `Ctrl`
(ctrlKey) として解釈される。registry 側は `Mod+Shift+I` の OS 中立形で記述し、
`match.ts` の matcher が動的解決する (既存 `lib/utils/platform.ts::isMacPlatform`
を活用)。

```ts
// registry
{ id: "chat.toggleInputCollapse", defaultAccel: "Mod+Shift+I", ... }

// matcher 内部
const modPressed = isMacPlatform() ? event.metaKey : event.ctrlKey;
if (parsed.mod !== modPressed) return false;
```

ユーザーが KeyRecorder で記録した結果も `Mod+...` 正規形で保存される
(Cmd/Ctrl 直書きにしない → OS 切替時の互換性を担保)。

---

## 2. 新規 binding 追加手順

### 手順 (3 ステップ)

1. `lib/keymap/bindings.ts` の `BINDINGS` array に entry を追加
   ```ts
   { id: "chat.regenerateLast", description: "最後の応答を再生成",
     defaultAccel: "Mod+R", context: "chatInput", category: "Chat" }
   ```
2. 該当 component で `useBoundCallback("chat.regenerateLast", handler)` で listen
3. KeybindingsSettings / HelpDialog に **自動反映** (registry 駆動なので追加実装不要)

### 注意点

- `defaultAccel: null` も許容。「registry に登録だけして override 待ち」できる
  (Phase 1 では `app.openHelp` がこのパターン。Phase 2 で `Mod+/` を割当)
- 既存 binding と同 context + 同 accel になる場合は `detectConflicts` で error
  warning が出る。意図的な共存 (例: `palette.search` global と `terminal.search`
  terminal で同じ Mod+Shift+F) は context が違えば warning 止まりで許容
- IME 変換中 (`isComposing` / `keyCode === 229`) の guard は `useBoundCallback`
  内で **自動的に** 行われる。component 側で書く必要なし

### context 判定基準 (Phase 2 で確定)

新規 binding の context をどれにするかの判定基準:

| 状況 | context |
| ----------------------------------------------- | ------------- |
| アプリ全域で発火させたい (どの focus でも有効)  | `global`      |
| chat textarea focus 時のみ発火                   | `chatInput`   |
| xterm canvas focus 時のみ発火                    | `terminal`    |
| Monaco editor focus 時のみ発火                   | `editor` (Phase 3+) |

迷ったら **global にする方が UX 上の事故は少ない** (Cursor 移行ユーザーは
focus を意識せず操作するため)。terminal 系は xterm.js が文字入力として食って
しまうので必ず terminal 化する必要がある。

### 新規 binding 追加時の注意 (Phase 2 で追加)

- terminal binding を追加した場合、TerminalPane.tsx の `dispatchTerminalAction`
  switch に対応 case を追加する (registry に id を追加するだけでは local 操作が
  発火しない、xterm.js は React hook を呼べない都合)
- chatInput binding を追加した場合、対応する component (textarea を持つ要素) で
  `data-chat-input` 属性が closest で見つかる位置にあるか確認する
- `note?: string` フィールドは「ユーザーが override しても期待通り動かない」
  ような特殊事情 (browser default と共存、固定動作等) を明示するために使う

---

## 3. 永続化レイヤ

### key と version

- localStorage key: `sumi:keybindings`
- shape: `{ state: { overrides: Record<id, accel | null> }, version: 1 }`
- Zustand `persist` の標準形

### migration

Phase 1 = version 1 から開始。旧 key 不在のため transparent migration は不要。
`lib/stores/settings.ts` の `safeStorage` factory を完コピで踏襲し、SSR 安全 +
将来の Tauri `plugin-store` 移行 (settings.ts と同タイミング、Phase 3 想定) で
`{ key: value }` JSON をそのまま新 store にコピーできる shape を維持する。

### unbind の表現

`overrides: { "chat.send": null }` は「ユーザーが明示的に unbind した」状態を
表す。`undefined` (= overrides に key が無い) は「default を使う」状態と区別する。

```
| state               | overrides[id]   | 効く accel        |
| ------------------- | --------------- | ----------------- |
| 未操作              | undefined       | defaultAccel      |
| ユーザー上書き      | "Mod+Shift+S"   | 上書き値          |
| ユーザー unbind     | null            | null (listener 無)|
```

---

## 4. Phase 2 (v1.40.0) で実装した範囲 — 完了履歴

1. **context evaluator** (`lib/keymap/context.ts` 新規)
   - `isContextActive(ctx, event)` を実装。chatInput / terminal を `event.target`
     の `closest()` で判定 (上記 §1-C の marker)
   - `useBoundCallback` の `scope` option (default `"global"` で context-aware)
     に組込まれ、registry の context が non-global なら自動で context active 時
     のみ発火する

2. **InputArea の `chat.send` を registry 経由化**
   - `useKeybindingsStore` selector で `getEffectiveAccelFromState(s, "chat.send")`
     を購読し、textarea onKeyDown 内で `matchesAccel(nativeEvent, sendAccel)` 判定
   - `useBoundCallback` の `{ ref: ... }` scope ではなく selector 方式を選んだ理由:
     React の onKeyDown と window listener の二重発火が起こると IME composition
     state が壊れるため、textarea 直の onKeyDown 経路で完結させた
   - `Shift+Enter` (改行) と `Esc` (palette/picker close) は **registry 化しない**
     方針 (textarea native の改行 / Radix Dialog 標準の Esc-close との二重発火回避)

3. **TerminalPane の `attachCustomKeyEventHandler` を registry 経由化**
   - 新規 vanilla helper `findMatchingBinding(event, "terminal")` で同期的に
     registry を引く (xterm.js は React hook を呼べない)
   - `dispatchTerminalAction(id, term, ptyId, setSearchOpen)` で local 操作 dispatch
   - registry 化対象 7 件: `terminal.search` / `.copy` / `.paste` / `.clear` /
     `.newTerminal` / `.closeTerminal` / `.reset`
   - hardcode 維持 2 件: `Ctrl+Tab` (terminal cycle、修飾単独 + Tab で textarea
     focus 移動と紛らわしい / DEC-079 候補)、`Ctrl+V` 修飾単独 paste
     (Cursor/VSCode 互換の固定動作、shell SIGINT 互換性のため)

4. **HelpDialog のターミナルセクション**
   - registry 駆動化完了。Terminal category として「主なショートカット」内に
     自動表示。hardcode 残置は Ctrl+Tab / Ctrl+V のみ

5. **conflict 検出の severity 強化**
   - `AccelConflict.severity = "error" | "warning"`
   - error: 同 context 重複 (赤 icon)
   - warning: global vs other-context (黄 icon、focus で優先順が変わる旨を tooltip)
   - 異なる non-global context 同士は衝突報告しない (focus 排他)

6. **context フィルタ UI**
   - `KeybindingsSettings` 上部に Tabs で「すべて / Global / ChatIn / Terminal /
     Editor」。empty state 対応

### conflict resolution rule (Phase 2 で確定)

```
priority:
  1. terminal context binding が xterm.js focus 時に最先で消費
     (attachCustomKeyEventHandler で preventDefault + stopPropagation 後 return false)
  2. chatInput context binding が textarea focus 時に消費 (selector 経由 or scope ref)
  3. global binding が window listener で消費 (上記が consume せず到達した場合)
  4. browser default (consume されなかった accel)
```

具体例:
- `Mod+Shift+F` を terminal focus 時に押す → `terminal.search` (TerminalPane の
  `findMatchingBinding` で消費) → SearchPalette (`palette.search`) には到達しない
- 同 `Mod+Shift+F` を chat focus 時に押す → terminal pane の event は飛んで
  来ないため、global の `palette.search` が window listener で消費 → SearchPalette
  起動

KeybindingsSettings の warning icon は「ユーザーが意図せず global と context-
specific が衝突しているかも」を伝えるためのもので、上記 rule で正しく resolve
されることは保証されている。

### Phase 1 / Phase 2 で **意図的に踏み込んでいない** 範囲 (Phase 3 候補)

- `react-hotkeys-hook` の依存削除 → Phase 3+ 検討
  - `ImagePasteZone.tsx` の `ctrl+v, meta+v` は browser default paste と共存させる
    ため registry 化対象外。react-hotkeys-hook を残しておくのが事故防止
- custom binding 追加 (新 command id を「拡張ユーザーコマンド」として登録)
  → v2.0.0 (overkill 寄り、保留判断あり)
- Tauri `plugin-store` 移行 → settings.ts と同タイミング (v2.0.0)
- `terminal.cycleTerminal` (Ctrl+Tab) の registry 化 → DEC-079 候補
- editor (Monaco) context 統合 → Phase 3+ (Monaco 内部 binding と整合させる
  作業が独立で重い)
- `EscapeProvider` の rename (実体は「応答停止 + 折りたたみ + ヘルプ起動 hotkey
  provider」だが、Shell.tsx の import 互換のため Phase 2 まで保留) → v2.0.0
  (M-Phase2-D)

---

## 4-A. Phase 3a (v1.41.0) で実装した範囲 — Import / Export + Minor 4 件吸収

DEC-079 のレビュー指摘 Minor 5 件のうち、後方互換 + ユーザー価値高の 4 件
(M-Phase2-A / B / C / E) を吸収。M-Phase2-D (`EscapeProvider` rename) は
破壊的変更のため v2.0.0 へ温存。

### 4-A-1. Import / Export JSON (v1.41.0)

#### スキーマ仕様 (v1)

```jsonc
{
  "schema": "sumi-keybindings",         // 固定値、validation 必須
  "version": 1,                           // 現行 v1。将来は v2 を追加で migrate
  "exportedAt": "2026-05-01T12:34:56Z", // ISO8601、参考情報
  "appVersion": "1.41.0",                 // package.json の version、参考情報
  "overrides": {
    "chat.send": "Mod+Enter",          // string = 上書き accel
    "palette.command": "Mod+Shift+K",
    "app.openHelp": null                // null = 明示 unbind
  }
}
```

#### Validation ルール (Import 時)

| 状況 | 挙動 |
| --- | --- |
| `schema` が一致しない | top-level throw |
| `version` が 1 以外 | top-level throw |
| `overrides` が object でない / 値が string\|null でない | top-level throw |
| 個別 entry: registry に無い id | warning として記録 + 当該 entry skip、import 継続 |
| 個別 entry: parse 不能な accel | warning として記録 + 当該 entry skip、import 継続 |
| 個別 entry: null override | always 受理 (= 明示 unbind として保存) |

「entry skip + warning」を採用した理由は、registry の改廃で古い export ファイル
が将来 schema mismatch しても **大半の entry は救える** ようにするため。

#### Import モード

| モード | 挙動 |
| --- | --- |
| `replace` (上書き) | `resetAll()` 相当 → 空から import の overrides を適用 |
| `merge` (マージ) | 既存 override を起点に上書き / 追加。import に無い既存 override は維持 |
| キャンセル | 何もしない |

UI (`KeybindingsSettings.tsx`) は shadcn `AlertDialog` で 3 択を提示。各ボタンに
`data-testid="import-replace"` / `import-merge"` / `import-cancel"` を付与し
E2E から識別可能。

#### Tauri / Web fallback

- Tauri 環境: `@tauri-apps/plugin-dialog` の `save()` / `open()` でファイル選択、
  `@tauri-apps/plugin-fs` の `writeTextFile` / `readTextFile` で I/O
- Web (Next.js dev / static export browser): `window.__TAURI_INTERNALS__` が
  存在しないため Import / Export ボタンを **disabled**、shadcn Tooltip で
  「Tauri 環境でのみ利用可能です」と表示

純粋関数層 (`lib/keymap/import-export.ts`) は I/O 抜きで vitest 可能。
`buildExportPayload` / `parseImportPayload` / `applyImport` の 3 つを export。

### 4-A-2. `useBoundCallback` の `scope: "auto"` rename (M-Phase2-A)

| 旧名 | 新名 | 後方互換 |
| --- | --- | --- |
| `"global"` | `"auto"` | `"global"` は **deprecated alias として残置**、v2.0.0 で削除予定 |

挙動 (window で listen + registry の context が non-global なら自動で context
active 時のみ発火) は同じ。命名と挙動の乖離 (「global なのに contextOnly 相当」)
を解消することが目的。`KeyScope` 型に `@deprecated` JSDoc を付与。

### 4-A-3. ref scope の動的解決 (M-Phase2-B)

旧実装: `useEffect` 内で `ref.current` を 1 度だけ読む → mount 後 attach さ
れる ref では永遠に null のまま listener 不発。

新実装: `useEffect` 内で `tryAttach()` を即時 + `requestAnimationFrame` 1 度。
mount 後の commit-then-attach パターン (next frame で ref が attach される)
を救済。永久 poll は避け 1 frame に留める (慣例の `useLayoutEffect` 相当のタイ
ミングを担保)。

### 4-A-4. context フィルタ状態の永続化 (M-Phase2-C)

`KeybindingsSettings` の Tabs 選択状態を新 store `useKeymapUiStore`
(localStorage key `sumi:keymap-ui-state`) に保存。**keymap 設定本体
(`sumi:keybindings`) とは別 store** にして、export/import の対象に含めない。

| key | shape | 用途 |
| --- | --- | --- |
| `sumi:keybindings` | `{ overrides: Record<id, accel\|null>, version }` | 設定本体 (export/import の対象) |
| `sumi:keymap-ui-state` | `{ contextFilter: "all" \| KeyContext, version }` | UI 操作履歴 (export/import 対象外) |

SSR / hydration mismatch を避けるため初回 render は default `"all"`、mount 後
に store 値で再 render する 2 段構成。

### 4-A-5. `terminal.reset` の dispatch 一本化 (M-Phase2-E)

旧実装は `dispatchTerminalAction` の `case "terminal.reset"` が **noop** で、
別途 `container.addEventListener("keydown")` で Ctrl+Shift+L を hardcode 監視
し `resetFn()` を呼んでいた。これにより:

- ユーザーが `terminal.reset` を override しても旧 hardcode 経路が常に発火
- 二重経路の preventDefault / stopPropagation の優先順が読みづらい

新実装: `resetFnRef` を ref で保持し、`dispatchTerminalAction("terminal.reset",
..., resetFnRef)` で直接呼び出す。container 側の hardcode listener は撤去。
override 時の挙動が registry 経由で一貫する。

### 4-A-6. v2.0.0 へ温存した項目

- **M-Phase2-D**: `EscapeProvider` の rename (実体は「応答停止 + 折りたたみ +
  ヘルプ起動 hotkey provider」)。Shell.tsx の import 互換を保つため、破壊的
  変更として v2.0.0 で実施
- `react-hotkeys-hook` の依存削除 (ImagePasteZone の特殊事情整理が前提)
- `plugin-store` 移行 (settings.ts と同タイミング)
- when 句 DSL
- custom binding 追加
- `KeyScope` 型から `"global"` alias を削除 (deprecation 完了)

---

## 5. デバッグ / トラブルシューティング

### binding が効かない

1. `useKeybindingsStore.getState().overrides` を console で確認 (unbind か?)
2. `getEffectiveAccel(id)` の戻り値が null でないか
3. registry の context フィールドが正しいか (Phase 1 では実質 global しか動かない)
4. `useBoundCallback` の `enabled: true` か / `preventDefault` で他 listener と
   競合していないか

### ユーザーが override を消したい

KeybindingsSettings の **「すべてリセット」** ボタン or 各行の **デフォルト復元**
ボタン (RotateCcw icon)。内部的には `resetAll()` / `resetOverride(id)` を呼ぶ。

### 衝突しているか確認したい

`detectConflicts(overrides?)` を呼ぶと `[{ accel, context, ids: [...] }, ...]`
が返る。`isBindingConflicting(id)` で 1 binding 単位の判定も可。

---

## 6. 参考

- 提案書: `projects/PRJ-012/reports/dev_keybinding_editor_proposal.md`
  (案 A / B / C 比較、competitor 調査、規模見積り)
- 完了レポート: `projects/PRJ-012/reports/dev_v138_keymap_phase1_done.md`
- VSCode keybindings: <https://code.visualstudio.com/docs/getstarted/keybindings>
- Zed keymap: <https://zed.dev/docs/key-bindings>
