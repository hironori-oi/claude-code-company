# Keybinding アーキテクチャ (PRJ-012 v1.38.0 / DEC-078)

> 起源: PRJ-012 sumi v1.38.0 (2026-05-01) / Phase 1 実装
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

| context     | 有効スコープ                          | Phase 1 / 2 |
| ----------- | ------------------------------------- | ----------- |
| `global`    | アプリ全域 (focus 不問)               | Phase 1 ◯   |
| `chatInput` | chat textarea にフォーカス時          | Phase 2     |
| `terminal`  | xterm canvas にフォーカス時           | Phase 2     |
| `editor`    | Monaco エディタ内 (Monaco 内部委譲)   | Phase 3+    |

Phase 1 は context 判定 (`isContextActive`) を実装せず、`useBoundCallback` は
**常に window で listen** する制約付き。registry 上は context フィールドを
正しく設定し、Phase 2 で context evaluator を入れる時に hook 側だけ書き換えれば
binding 側 (registry / 各 component) は無変更で済む設計。

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
  (例: `app.openHelp` は専用 hotkey 未割当だが UI の編集対象には載せたい)
- 既存 binding と同 context + 同 accel になる場合は `detectConflicts` で warning
  が出る。意図的な共存 (registry 内 default のみ衝突する状況) は避ける
- IME 変換中 (`isComposing` / `keyCode === 229`) の guard は `useBoundCallback`
  内で **自動的に** 行われる。component 側で書く必要なし

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

## 4. Phase 2 への引き継ぎ事項

### Phase 2 (v1.40.0 想定 / 4〜5 営業日) で実装する範囲

1. **context evaluator** の実装
   - `lib/keymap/context.ts` (新規) で 4 種 context のうちどれが現在 active か判定
   - chat textarea / xterm canvas / Monaco の focus 状態を見る
   - `useBoundCallback` 内で `if (!isContextActive(ctx)) return;` の guard を追加

2. **InputArea の `chat.send` / `chat.pasteImage` を registry 経由化**
   - 現状: `components/chat/InputArea.tsx` の onKeyDown 直書き
   - 移行先: `useBoundCallback("chat.send", ..., { context: "chatInput" })`
   - `Escape` で palette を close する分岐は registry 化しない (modal 慣例)

3. **TerminalPane の `attachCustomKeyEventHandler` を registry 経由化**
   - 現状: `components/terminal/TerminalPane.tsx` で xterm.js が直接 KeyboardEvent
     を見る (`Ctrl+Shift+F/K/N/W/C/V/L`、`Ctrl+Tab`)
   - 移行戦略: registry から accel を取得するだけの薄い分岐に refactor。
     dispatch (= 実際の terminal 操作) は xterm.js の `return false` 仕様を保つため
     local 実装のまま。**registry の id だけ統一すれば**、KeybindingsSettings
     から terminal 系も編集可能になる
   - 規模: 7 binding × 1 行差 = 半日程度。ただし「Ctrl+Shift+F が chat / terminal
     どちらで動くか」の context 切替は context evaluator 完成が前提

4. **HelpDialog のターミナルセクション**
   - 現状: hardcode された 8 binding を表示
   - Phase 2: registry 駆動化 (chat / palette と同じ自動生成パスに乗せる)
   - hardcode セクションは削除

### Phase 1 で **意図的に踏み込んでいない** 範囲

- `react-hotkeys-hook` の依存削除 → Phase 3 検討
  - `ImagePasteZone.tsx` の `ctrl+v, meta+v` は browser default paste と共存させる
    ため registry 化対象外。react-hotkeys-hook を残しておくのが事故防止
- custom binding 追加 (新 command id を「拡張ユーザーコマンド」として登録)
  → Phase 3 (overkill 寄り、保留判断あり)
- Import / Export JSON → Phase 3
- Tauri `plugin-store` 移行 → settings.ts と同タイミング (Phase 3)

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
