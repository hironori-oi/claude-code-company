# PRJ-012 キーバインド編集機能 - 実現性検討と実装提案

> 作成: 2026-04-30 / 担当: dev (シニアエンジニア兼システム設計者)
> 対象: v1.37.0 (DEC-077 残課題 cleanup 完了) 以降
> 種別: 設計提案 (実装は未着手 / コード変更なし)

---

## 0. TL;DR (CEO 用)

- 現状はキーバインドが **完全 hardcode** で、`KeybindingsSettings.tsx` は **読み取り専用の表組み** (5 件のみ列挙、コメント上「M3 で実装予定」と placeholder 化)。`react-hotkeys-hook` を使う 4 箇所、`useEffect`+`window.addEventListener` を使う 2 箇所、xterm.js の `attachCustomKeyEventHandler` を使う 1 箇所、計 **7 経路** にバラバラに分散している。
- VSCode 互換 (案 B) は migration コストが大きく、Tauri アプリとしてやや過剰。最小 (案 A) は将来 terminal / editor まで広げると破綻する。
- **推奨は案 C (Hybrid)** = 「コア binding の中央 registry + ユーザー override only / custom binding 不可 / context は粗粒度で 4 種」。Phase 1 (Slim) で v1.38.0 release、Phase 2 (Standard) で v1.40.0 級が現実的。
- スコープは **Standard を推奨** (Slim 単独だと「結局 terminal の Ctrl+Shift+F は変えられないの？」という典型的な落胆を生む)。

---

## 1. 現状調査

### 1.1 binding 管理の現状

binding は **3 つの異なる実装手段** に分散している。

```
+---------------------------------------------------------------+
| 経路 1: react-hotkeys-hook (useHotkeys) — DOM 全体で capture |
+---------------------------------------------------------------+
  - components/palette/CommandPalette.tsx  : "mod+k"
  - components/palette/FilePalette.tsx     : "mod+p"
  - components/palette/SearchPalette.tsx   : "mod+shift+f"  (chat 検索)
  - components/chat/ImagePasteZone.tsx     : "ctrl+v, meta+v"

+---------------------------------------------------------------+
| 経路 2: window.addEventListener("keydown") — Provider 直書き |
+---------------------------------------------------------------+
  - components/providers/EscapeProvider.tsx
      Ctrl/Cmd+.       : 応答停止 (DEC-067 / v1.25.0)
      Ctrl/Cmd+Shift+I : 入力欄折りたたみ toggle (DEC-076 / v1.36.0)
  - components/permission/PermissionDialog.tsx
      Enter            : permission 許可 (modal 開放時のみ)

+---------------------------------------------------------------+
| 経路 3: ローカル onKeyDown / 要素 addEventListener           |
+---------------------------------------------------------------+
  - components/chat/InputArea.tsx (textarea onKeyDown)
      Ctrl/Cmd+Enter   : 送信
      Escape           : palette close
  - components/terminal/TerminalPane.tsx
      attachCustomKeyEventHandler:
        Ctrl+Tab / Ctrl+Shift+Tab : terminal cycle
        Ctrl+V / Ctrl+Shift+V    : paste
        Ctrl+Shift+F             : terminal find (SearchPalette より優先)
        Ctrl+Shift+K             : term.clear
        Ctrl+Shift+N             : new terminal in pane
        Ctrl+Shift+W             : close terminal
        Ctrl+Shift+C             : copy selection
      container addEventListener:
        Ctrl+Shift+L             : viewport reset (PM-921)
  - components/sidebar/SessionList.tsx, ProjectTree.tsx, etc.
      Enter / Space / Escape   : ナビ系 (a11y のための慣例実装、binding 編集対象外)
```

**事実関係**:
- 中央定義ファイル (`lib/keyboard.ts` など) は **存在しない**。
- key の表記は文字列 (`"mod+k"`) と event.key 直接比較 (`e.key === "."`) が混在。
- **Mac 対応**は `(ev.ctrlKey || ev.metaKey)` の or で吸収する手書き実装が複数箇所。`lib/utils/platform.ts` の `isMacPlatform()` / `getModifierGlyph()` は **表示用** にしか使われていない (binding 判定には使っていない)。

### 1.2 既存 KeybindingsSettings.tsx の機能レベル

`components/settings/KeybindingsSettings.tsx` 全 82 行、機能は **読み取り専用の表 + Badge**。

```tsx
const BINDINGS: Binding[] = [
  { shortcut: "Ctrl+K", action: "コマンドパレットを開く", status: "available" },
  { shortcut: "Ctrl+V", action: "画像を貼り付け", status: "available" },
  { shortcut: "Ctrl+Enter", action: "メッセージを送信", status: "available" },
  { shortcut: "Ctrl+Shift+F", action: "会話を検索", status: "planned" },
  { shortcut: "/", action: "スラッシュコマンド", status: "available" },
];
```

問題点:
- 列挙が **5 件のみ**。実際には ~20 binding が動いている (terminal 系が漏れている)。
- 文字列 `"Ctrl+K"` がただのラベル (実際の binding と紐付いていない)。
- 編集機能・persist・conflict 検出すべて **未実装**。
- ファイル冒頭コメントに `「カスタム編集は M3 PM-171 の DEC 決定後に実装予定」` の文言。**今がその DEC 決定タイミング**。

### 1.3 binding の分類 (context 別)

ユーザーが編集対象を理解するために必須の整理。実装上は **4 つの context** に分かれる。

| Context        | スコープ                           | 例                                                                 |
| -------------- | ---------------------------------- | ------------------------------------------------------------------ |
| **global**     | アプリ全域 (どの pane / フォーカスでも有効) | `Ctrl+.` 停止、`Ctrl+Shift+I` 入力欄 toggle、`Ctrl+K` コマンドパレット、`Ctrl+P` ファイルパレット |
| **chatInput**  | textarea にフォーカス時                | `Ctrl+Enter` 送信、`Esc` palette close                              |
| **terminal**   | xterm canvas にフォーカス時             | `Ctrl+Shift+F/K/N/W/C/V/L`、`Ctrl+Tab`                              |
| **editor**     | Monaco エディタ内 (現状 Monaco 内部処理に委譲) | (Monaco 内部の標準 binding。本提案では編集対象外)                  |

VSCode の `when` 句に近いが、当面は 4 種のドロップダウンで十分。

### 1.4 データの所在

- 現状: **すべて hardcode** (TS リテラル文字列)。persist 一切なし。
- 既存 persist 基盤: `lib/stores/settings.ts` (Zustand `persist` + localStorage、key `sumi:settings`、version 4、migration 実装あり)。
- Tauri `plugin-store` は **未導入** (settings.ts コメント参照)。M3 で導入予定とされているが、現時点では localStorage が事実上の persist 層。
- 関連: `lib/utils/platform.ts` で `isMacPlatform()` / `getModifierGlyph()` (`⌘` / `Ctrl`) / `getShiftGlyph()` を提供済 → 表示には使えるが **binding 判定には未使用**。

---

## 2. 競合実装の比較

| 製品           | 設定ファイル                          | UI                                | context 制御                    | command 抽象化 |
| -------------- | ------------------------------------- | --------------------------------- | ------------------------------- | -------------- |
| **VSCode**     | `keybindings.json` (user)             | Keyboard Shortcuts Editor (record) | `when` 句 (DSL)                 | command id 必須 |
| **Cursor**     | VSCode fork (実質同一)                | 同 VSCode                         | 同 VSCode                       | 同 VSCode      |
| **Zed**        | `keymap.json` (TOML 風 JSON)          | settings UI から JSON edit        | `context` (mode-based、scope 木)  | action id      |
| **Tauri 一般** | アプリ次第 (Tauri 公式は提供せず)     | アプリ次第                        | アプリ次第                       | アプリ次第     |

**含意**:
- VSCode/Cursor 流の「command id + when 句」は強力だが、**少なくとも 50+ command id を切る必要があり**、PRJ-012 規模 (~20 binding) では過剰。
- Zed の context は scope tree で美しいが、scope 解決ロジック自体が中規模実装。
- Tauri アプリでは **「主要 binding を override 可能、custom 追加は不可」** が実用的下限ライン。

---

## 3. 設計案

### 3.A 案 A: 軽量・最小実装

#### アーキテクチャ
- `KeybindingsSettings.tsx` を直接編集可能化、`overrides` Map を `useSettingsStore` に追加。
- 各 hardcode 箇所はそのまま残し、override が存在するキーだけ「accel 比較関数で検査 → match なら旧 hardcode を抑止」する shim を挿入。
- `lib/utils/keyboard-match.ts` (新設) に `matches(event, accel: string)` を export し、各箇所がこれを呼ぶ。

```
+--------------------+        +------------------------+        +--------------------+
| KeybindingsSettings| -----> | settings.overrides map | -----> | matches() per site |
|   key recorder UI  |        |  { "stop": "Ctrl+." }  |        |  shim each handler |
+--------------------+        +------------------------+        +--------------------+
```

#### migration
- 既存コードに**触らず**、`matches()` shim を 7 経路の各所に 1 行ずつ挟む差分のみ。

#### conflict 検出
- 同 accel への複数 override のみ警告 (context 跨ぎは検出せず → false positive 多発)。

#### UI/UX
- 表 + 各行に「編集」ボタン → `<KeyRecorder>` Dialog。`Ctrl+Shift+I` を押すと確定、Esc でキャンセル。
- 「デフォルトに戻す」ボタン (per-row + global)。

#### Pros
- 1〜2 日で MVP。
- 既存コードの構造を変えない。

#### Cons
- 中央 registry が無いため、**どの binding が override 可能なのか UI 上もコード上も不明瞭** になりやすい。
- terminal の `attachCustomKeyEventHandler` 系は xterm.js 内部で処理するため、shim 挿入位置がトリッキー。
- 規模が育つと結局案 C / B に書き直す → 二度手間。

#### 規模: **S** (実装 1.5〜2 日 / テスト 0.5 日)

---

### 3.B 案 B: VSCode 直系・command 中心

#### アーキテクチャ
すべての shortcut を **command id** で抽象化。

```
lib/keymap/
  commands.ts        // export const COMMANDS = { "chat.send": { ... }, ... }
  default-keymap.ts  // [{ command: "chat.send", key: "Ctrl+Enter", when: "chatInputFocus" }, ...]
  user-keymap.ts     // ユーザー override 読込 (Tauri plugin-store or localStorage)
  registry.ts        // runtime registry: dispatch(commandId, event)
  context.ts         // when 句 evaluator
  match.ts           // accel parser (Ctrl+Shift+I → modifier mask + key)
```

各 hardcode 箇所は `dispatch("chat.send")` を呼ぶ薄い shim に書き換え。グローバル listener は **1 個の window.addEventListener** に集約。

```
+----------------+    +--------------+    +-----------+    +--------+
| keydown event  | -> | accel parser | -> | when eval | -> | dispatch|
+----------------+    +--------------+    +-----------+    +---+----+
                                                              |
                                                              v
                                                      +---------------+
                                                      | command impl  |
                                                      | (chat.send 等)|
                                                      +---------------+
```

#### migration
- 7 経路すべて書き換え。terminal は `attachCustomKeyEventHandler` の中で `dispatch` を呼ぶ shim を作る (terminal-only command を別 namespace で define)。
- InputArea の `onKeyDown` も `dispatch("chat.send", { context: "chatInput" })` に置換。
- 全 binding を 1 PR で migrate するのは事故りやすいので、binding 単位で逐次移行 (= 移行期間中 hardcode と registry が並存する複雑さが残る)。

#### conflict 検出
- 同 accel + 同 when に複数 binding が割り当たった場合 warning。
- when が異なれば許容 (`Ctrl+Shift+F` を terminal と chat 検索で共存させているのが好例)。

#### UI/UX
- VSCode 風: 検索可能な表、ダブルクリックで key recorder、当該 key を奪っている既存 binding を inline 警告、unbind 可、reset 可。
- Import / Export (JSON)。

#### マルチプラットフォーム
- accel 表記は内部的に **正規形** (`Mod+Shift+I` / `Mod` = Mac で Cmd / Win/Linux で Ctrl) に正規化。display 時は `getModifierGlyph()` で `⌘` or `Ctrl`。

#### Pros
- 将来「キーボード driven 操作を増やしたい」要求にすべて応えられる。
- Cursor 移行ユーザーには馴染みのある UI。

#### Cons
- 実装規模 **XL**。command id を 20+ 切る = それぞれ命名・docstring が要る。
- when 句 evaluator は実装は薄いが、context 切替を全 store と整合させる作業が想定外に重い。
- 移行期に regression リスク高 (terminal pane の Ctrl+Shift+F 競合など、現状 hardcode で回避してる微妙な優先順を再現する必要)。

#### 規模: **XL** (実装 2〜3 週 / テスト 1 週)

---

### 3.C 案 C: Hybrid (推奨)

#### アーキテクチャ

```
lib/keymap/
  bindings.ts        // 中央 registry: id, label, defaultAccel, context, handlerRef
  match.ts           // accel parser + KeyboardEvent matcher (Mac の Cmd↔Ctrl 同型化)
  store.ts           // useKeybindingsStore: { overrides: Record<id, accel | null> }
                     // (null = 該当 binding を無効化)
  context.ts         // 4 種 context の判定 (どの pane / どこに focus か)
  hooks.ts           // useBoundCallback(id, fn): 自動で global listener に登録
```

中央 registry の例:

```ts
// lib/keymap/bindings.ts
export const BINDINGS = {
  "app.stopGeneration": {
    label: "応答中の Claude を停止",
    defaultAccel: "Mod+.",           // Mod = Cmd on Mac, Ctrl on Win/Linux
    context: "global",
    description: "DEC-067 / v1.25.0",
  },
  "app.toggleInputCollapse": {
    label: "入力欄を折りたたむ / 展開",
    defaultAccel: "Mod+Shift+I",
    context: "global",
  },
  "palette.command":   { defaultAccel: "Mod+K",       context: "global",   label: "コマンドパレット" },
  "palette.file":      { defaultAccel: "Mod+P",       context: "global",   label: "ファイルパレット" },
  "palette.search":    { defaultAccel: "Mod+Shift+F", context: "global",   label: "会話を検索" },
  "chat.send":         { defaultAccel: "Mod+Enter",   context: "chatInput",label: "メッセージ送信" },
  "chat.pasteImage":   { defaultAccel: "Mod+V",       context: "chatInput",label: "画像を貼り付け" },
  "terminal.search":   { defaultAccel: "Mod+Shift+F", context: "terminal", label: "ターミナル内検索" },
  "terminal.clear":    { defaultAccel: "Mod+Shift+K", context: "terminal", label: "ターミナルクリア" },
  "terminal.new":      { defaultAccel: "Mod+Shift+N", context: "terminal", label: "新規ターミナル" },
  "terminal.close":    { defaultAccel: "Mod+Shift+W", context: "terminal", label: "ターミナル閉じる" },
  "terminal.copy":     { defaultAccel: "Mod+Shift+C", context: "terminal", label: "ターミナル選択コピー" },
  "terminal.reset":    { defaultAccel: "Mod+Shift+L", context: "terminal", label: "ターミナル表示リセット" },
  "terminal.cycle":    { defaultAccel: "Ctrl+Tab",    context: "terminal", label: "次のターミナルに切替" },
} as const;
export type BindingId = keyof typeof BINDINGS;
```

`useKeybindingsStore`:

```ts
type Accel = string; // "Mod+Shift+I" など正規形
interface KeybindingsState {
  overrides: Partial<Record<BindingId, Accel | null>>; // null = 無効化
  setOverride(id: BindingId, accel: Accel | null): void;
  resetOverride(id: BindingId): void;
  resetAll(): void;
}
// localStorage key: "sumi:keybindings", version 1
// (settings.ts と同じ safeStorage / migration パターン)
```

`useBoundCallback` hook:

```ts
function useBoundCallback(id: BindingId, fn: (e: KeyboardEvent) => void) {
  const accel = useKeybindingsStore(s =>
    s.overrides[id] !== undefined ? s.overrides[id] : BINDINGS[id].defaultAccel
  );
  const ctx = BINDINGS[id].context;
  useEffect(() => {
    if (accel === null) return; // ユーザーが無効化
    function onKey(e: KeyboardEvent) {
      if (!isContextActive(ctx)) return;       // 4 種 context の判定
      if (!matches(e, accel)) return;
      if (e.isComposing || e.keyCode === 229) return;
      fn(e);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accel, ctx, fn]);
}
```

#### migration 戦略

**段階的に置き換え**。Phase 1 で global context のみ移行、Phase 2 で chatInput / terminal を移行。terminal の `attachCustomKeyEventHandler` は **当面 Phase 2 で対応**。具体手順:

1. 既存 `react-hotkeys-hook` 呼び出し → `useBoundCallback("palette.command", ...)` に書き換え (4 箇所)。`react-hotkeys-hook` は依然インストールされたまま (依存除去はリスクが大きいため Phase 3)。
2. `EscapeProvider` の 2 binding は `useBoundCallback("app.stopGeneration"...)` に置換。
3. `InputArea` の onKeyDown 内 Ctrl+Enter 判定は `matches(e, getAccel("chat.send"))` で書く。Escape は palette close 用なので registry 化しない (modal 慣例)。
4. terminal の `attachCustomKeyEventHandler` は **registry を読みに行くだけの薄い分岐** に refactor。dispatch は terminal-local handler 直呼び (registry 一元化はせず、accel 取得だけ registry 経由)。

#### conflict 検出

```
function detectConflicts(overrides) {
  // 同 context 内で同 accel が複数の binding に割り当たっている場合のみ warning
  // (terminal の Ctrl+Shift+F vs chat の Ctrl+Shift+F は context 違いなので OK)
}
```

UI 上は当該 row に warning icon + tooltip。confirm ダイアログで「上書きしますか？」を出すかは Phase 2 で判断。

#### UI/UX

```
+---------------------------------------------------------------------------------+
| キーバインド                                              [すべてリセット]      |
|---------------------------------------------------------------------------------|
| 検索: [______________]                       Context: [すべて ▾]                |
|---------------------------------------------------------------------------------|
| ID                       説明                       Context  キー       操作    |
| app.stopGeneration       応答中の Claude を停止     Global   ⌘.        [編集] [↺]
| app.toggleInputCollapse  入力欄を折りたたむ         Global   ⌘⇧I       [編集] [↺]
| palette.command          コマンドパレット           Global   ⌘K        [編集] [↺]
| ...                                                                              |
| chat.send                メッセージ送信             ChatIn   ⌘↵        [編集] [↺]
| ...                                                                              |
| terminal.search          ターミナル内検索           Terminal ⌘⇧F  ⚠   [編集] [↺]
|                          (chat の palette.search と key 同値だが context 違い)  |
+---------------------------------------------------------------------------------+
```

`<KeyRecorder>` Dialog:
- 入力中は `e.preventDefault()` してすべてのキーを捕捉。
- Mac の Cmd を押すと `Mod` として表示 (記録は正規形)。
- 一度押した key を `kbd` 風に表示、Enter で確定 / Esc でキャンセル / Backspace でクリア。
- 既存衝突 binding があれば「`palette.command` は既に `⌘K` に割当済」と inline 表示。

Tailwind class 例 (kbd 表記):
```tsx
<kbd className="rounded border bg-background px-2 py-0.5 font-mono text-xs shadow-sm">
  {displayAccel(accel)}
</kbd>
```

#### マルチプラットフォーム

`Mod` という仮想 modifier を導入し、`matches(event, accel)` 内で OS により Cmd/Ctrl にマップ:

```ts
export function matches(e: KeyboardEvent, accel: string): boolean {
  const parsed = parseAccel(accel);            // {mod, shift, alt, key}
  const modPressed = isMacPlatform() ? e.metaKey : e.ctrlKey;
  return (
    parsed.mod   === modPressed &&
    parsed.shift === e.shiftKey &&
    parsed.alt   === e.altKey &&
    parsed.key.toLowerCase() === e.key.toLowerCase()
  );
}
```

これにより既存の `(e.ctrlKey || e.metaKey)` の手書きが消える。

#### 既存 binding への影響

| 場所                    | Phase 1 | Phase 2 | Phase 3 |
| ----------------------- | ------- | ------- | ------- |
| EscapeProvider          | ◯ 移行  | -       | -       |
| CommandPalette / FilePalette / SearchPalette / ImagePasteZone | ◯ 移行 | - | - |
| InputArea onKeyDown     | -       | ◯ 移行  | -       |
| TerminalPane custom keys | -      | ◯ 移行  | -       |
| Editor (Monaco 内部)    | -       | -       | △ 検討 (Monaco の internal binding は触らない方針) |

#### risk / 運用負荷

- registry の id 命名でヤマが 1 つ (一度切ったら破壊的変更が痛い)。Phase 1 で確定させる。
- terminal の `attachCustomKeyEventHandler` は xterm.js が string event を直接見るため、registry 経由化が他より複雑。**Phase 2 で個別工数 1 日**を確保。
- Mac 対応はテストで検証 (現状 e2e は Win 中心)。

#### Pros / Cons

**Pros**:
- 中央 registry でドキュメント化が自然 (HelpDialog の shortcut 一覧も registry から自動生成可能 → DRY 解消)。
- Phase 切れがあるので「v1.38 で簡易版を release → 反応見て v1.40 で拡張」が可能。
- VSCode 風の体験を 7 割確保しつつ、command 抽象化の負債を負わない。
- `isMacPlatform` 由来の手書き OR が消える (DRY)。

**Cons**:
- 案 A より 2〜3 倍の実装規模。
- 「custom binding 追加 (= 新 command 作成)」はサポートしない (これを欲しがるユーザーは少数派と判断)。

#### 規模: **M** (Phase 1) → **L** (Phase 1+2 累計)

---

## 4. 推奨案と理由

**推奨: 案 C (Hybrid)、スコープは Standard (Phase 1+2)。**

### なぜ案 B でないか

- PRJ-012 の binding 数は ~20。VSCode は 600+。**command id 抽象化のコスト効果が合わない**。
- Cursor 移行ユーザーであっても、「Cursor の `keybindings.json` をそのまま import」を期待していなければ command id 必須にする意味は薄い (オーナーは個人開発者、ロード元 keybindings.json は持ち込んでいない)。
- when 句 evaluator は薄いが、各 store と整合させる作業が **見えない伏兵**。Phase 2 までで release blocking になりやすい。

### なぜ案 A では足りないか

- 「terminal の Ctrl+Shift+F を変えたい」「Ctrl+Shift+N で terminal 増やすのを別キーに」といった **terminal 系 binding を編集できない不満** が Cursor 経験者からは即 1 番に来る。
- 5 binding しか UI にない現状は、ユーザーから見ると「設定画面開いたのに目当ての key が無い」状態。
- 案 A は中央 registry を作らないので、binding を 1 個追加するたびに UI と shim の 2 箇所を編集することになり、**長期的に技術負債**。

### なぜ案 C を選ぶか

- 中央 registry は **HelpDialog / KeybindingsSettings / 実 binding** の 3 重複を解消する副次効果がある (現状 HelpDialog にハードコードされた shortcut 表記 ~15 件は registry 1 ソースから生成できる)。
- Phase 切りがあるので **v1.38.0 で Slim 相当を release → ユーザー反応 → Phase 2** という意思決定リズムに合う。
- terminal binding は「Phase 2 まで触らない」と明確に切れる = Phase 1 のリスクを最小化できる。

---

## 5. 実装ロードマップ (推奨案 = 案 C)

### Phase 1 — Slim (v1.38.0 想定 / 規模 M / 2.5〜3 日)

- [ ] `lib/keymap/bindings.ts` 作成、まず **global context binding 8 件** を登録 (stopGeneration / toggleInputCollapse / palette.command / palette.file / palette.search / chat.send / chat.pasteImage)
- [ ] `lib/keymap/match.ts` (accel parser + Mac 対応 matcher)
- [ ] `lib/keymap/store.ts` (Zustand persist、key `sumi:keybindings`、version 1、migration boilerplate)
- [ ] `lib/keymap/hooks.ts` (`useBoundCallback`)
- [ ] `KeybindingsSettings.tsx` を全面書き換え:
  - registry から表 render
  - `<KeyRecorder>` Dialog、reset、unbind (= override = null) 対応
- [ ] 既存 5 経路を `useBoundCallback` に置換 (CommandPalette / FilePalette / SearchPalette / ImagePasteZone / EscapeProvider)
- [ ] HelpDialog の shortcut セクションを registry から生成
- [ ] e2e: Phase 1 binding を 1 つ override → reload 後も生きていることを確認

### Phase 2 — Standard (v1.39 / v1.40 想定 / 規模 M〜L / 4〜5 日)

- [ ] context evaluator の chatInput / terminal 対応
- [ ] InputArea の Ctrl+Enter / Esc を registry 化 (palette open 時の特殊分岐は維持)
- [ ] TerminalPane の `attachCustomKeyEventHandler` を registry 経由 accel 取得に refactor (~7 binding)
  - dispatch 自体は xterm.js の return false 仕様を保つため local 実装
- [ ] conflict 検出 UI (warning icon + tooltip)
- [ ] context フィルタ UI (ドロップダウン)
- [ ] ナレッジ蓄積: `organization/knowledge/keybinding-architecture.md` (新規 binding 追加手順)

### Phase 3 — Full (v2.0 級 / 規模 L〜XL)

- [ ] custom binding 追加 (新 command id を「拡張ユーザーコマンド」として登録、現実的には slash command の trigger キー化のみ)
- [ ] Import / Export JSON
- [ ] when 句 DSL (例: `terminalFocus && !searchOpen`) — overkill 気味なので採用判断保留
- [ ] Tauri `plugin-store` 移行 (settings.ts と同タイミング)

---

## 6. スコープ提案 (Slim / Standard / Full)

| スコープ      | 含む Phase    | binding 編集対象 | 実装工数 (dev のみ) | release 目安 | 推奨度       |
| ------------- | ------------- | ---------------- | ------------------- | ------------ | ------------ |
| **Slim**      | Phase 1       | global 8 件      | 2.5〜3 日           | v1.38.0      | △ 単独だと不足 |
| **Standard**  | Phase 1+2     | global + chatInput + terminal、~20 件 | 6.5〜8 日 | v1.40.0     | ◎ 推奨       |
| **Full**      | Phase 1+2+3   | + custom 追加 / import-export | 12〜15 日 | v2.0 級    | × 過剰投資   |

**判断要請 (CEO / オーナー)**:
- オーナーが **「Cursor 並みは欲しい」** なら Standard 一択。
- **「とにかくすぐ自分が使うキーだけ変えたい」** なら Slim を v1.38.0 で出して Standard を継続着手 (この場合も中央 registry は Slim の段階で作るので継続コストは均す)。
- 個人的推奨: **Standard を v1.40.0 で。途中 v1.38.0 / v1.39.0 は Phase 1 の subset を細かく release** (2〜3 binding ずつ編集可能化)。

---

## 7. 既存資産の活用方針

- `KeybindingsSettings.tsx` の **テーブル骨格** (Tailwind の table + kbd 表記) は Phase 1 の表 UI でそのまま流用。`<Badge>` の status 列は廃止。
- `lib/utils/platform.ts` の `isMacPlatform` / `getModifierGlyph` / `getShiftGlyph` は **そのまま使える**。`match.ts` の matcher と display formatter で内部呼び出しすれば DRY。
- `lib/stores/settings.ts` の `safeStorage` + version migration パターンを **完コピ** で `lib/keymap/store.ts` を作る (旧 key からの transparent migration は不要、初回 release だから version 1 から)。
- `EscapeProvider.tsx` のコメント (DEC-067 / DEC-076) は registry の `description` フィールドにそのまま転記し、binding ごとの DEC tracking を継続。
- `react-hotkeys-hook` は **Phase 1 では依存維持** (CommandPalette 等の useHotkeys 部分書き換えは内部実装のみで API は変えない)。Phase 3 で削除検討 (依存削減は副次目的)。

---

## 8. CEO への最終提案

> **3 行サマリ**:
> 1. 現状はキーバインドが 7 経路に分散して **完全 hardcode**、`KeybindingsSettings.tsx` は飾りの読み取り専用。
> 2. **案 C (Hybrid: 中央 registry + ユーザー override / custom 追加なし / 4 種 context)** を推奨。VSCode 互換 (案 B) は overkill、最小実装 (案 A) は terminal 系を編集できず不満を生む。
> 3. **スコープは Standard (Phase 1+2 / 約 7 営業日 / v1.40.0)** を推奨。Slim 単独 release も可能だが「目当ての key が UI に無い」典型的不満を残す。

> **判断要請**:
> - スコープ確定: **Slim / Standard / Full** のいずれか
> - release ターゲット: v1.38 (Slim) / v1.40 (Standard)
> - 進行可否: 着手 OK ならば dev は次工程で Phase 1 の DEC ドラフトを起こす (`projects/PRJ-012/decisions.md`、id は DEC-078 想定)
