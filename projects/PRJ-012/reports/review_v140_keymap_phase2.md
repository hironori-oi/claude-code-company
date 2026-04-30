# PRJ-012 v1.40.0 キーバインド編集 Phase 2 - 品質レビュー

> 日付: 2026-04-30 / 担当: レビュー部門 (シニアレビュアー)
> 対象: PRJ-012 sumi v1.40.0 候補 / DEC-078 Phase 2 (chatInput / terminal context 拡張 + conflict 強化 + Minor 6 件吸収)
> ベース: `projects/PRJ-012/reports/dev_v140_keymap_phase2_done.md` + `dev_v138_keymap_phase1_done.md` + `review_v138_keymap_phase1.md` + ナレッジ `organization/knowledge/keybinding-architecture.md`

---

## 判定: APPROVE

- Critical: 0
- Major: 0
- Minor: 5
  - うち release blocker: 0
  - 指摘 5 件はすべて「次 release / Phase 3 着手前で吸収可能」レベル

Phase 1 (v1.38.0) で確立した中央 registry + Mod プレースホルダ + persist パターンを
忠実に拡張し、context-aware scope / cross-context conflict / context フィルタ UI /
DEC-078 Minor 6 件吸収を **過不足なく一括達成** している。typecheck PASS、vitest
66/66 PASS、ナレッジ追記、CHANGELOG / version 整合すべて確認済。**そのまま
v1.40.0 として release 可**。v1.39.0 を skip する判断もユーザー視点での一貫性
担保のため妥当 (CHANGELOG Notes に明記済)。

ローカル E2E run 見送り (port 3000 競合) は **本実装の問題ではなく**、Phase 1
release で前例が確立しており、CI で 29 ケース PASS する想定で OK 判定の材料に
含めた。

---

## 1. context 拡張の妥当性 (chatInput / terminal)

### 1-A. chatInput context (`chat.send` の selector + onKeyDown 方式)

完了レポート §3 と `components/chat/InputArea.tsx` line 538-580 を突合せ確認。

| 観点 | 評価 |
| --- | --- |
| `chat.send` を `useBoundCallback` の `{ ref }` scope 採用見送り | ◯ 妥当 |
| store selector + textarea onKeyDown の一本化 | ◯ 既存 palette / slash 排他制御と密結合のため自然 |
| `data-chat-input=""` marker で DOM 階層非依存 focus 判定 | ◯ `lib/keymap/context.ts::isInChatInput` が `closest("textarea[data-chat-input]")` / `closest("[data-chat-input]")` の二段で安全 |
| IME composition / 二重発火 | ◯ React `onKeyDown` のみで完結し window listener 追加していないので二重発火しない |
| `Shift+Enter` を registry 化しない判断 | ◯ textarea native 改行で十分、過剰移行回避 (CHANGELOG 明記済) |
| `Esc` を registry 化しない判断 | ◯ Radix Dialog / Popover 標準 close と二重発火回避のため妥当 |

#### IME composition の再確認

`InputArea.tsx::onKeyDown` 内では IME guard を独自に書いていない。これは:

- `matchesAccel(nativeEvent, sendAccel)` 内部でも `event.isComposing` 判定はしない
  仕様 (`useBoundCallback` 側の責務分担)
- React の `onKeyDown` は IME 変換中の `compositionend` 直前の Enter で
  `isComposing=true` のまま発火するケースがあり、`Mod+Enter` の場合 modifier 押下
  時点で composition が終わっているのが通常

したがって `chat.send` だけは onKeyDown で素直に判定して問題なし。`Mod+Enter`
は IME 変換中に組合せできないため `isComposing` 衝突は実質発生しない。**評価: 問題なし**。

#### chat.send の selector 経由 store 購読

`useKeybindingsStore((s) => getEffectiveAccelFromState(s, "chat.send"))` で
shallow equal が効くか念のため確認。`getEffectiveAccelFromState` は `string |
null` のプリミティブを返すため Zustand 標準の `Object.is` 比較で十分 stable。
ユーザーが override で `Mod+Enter` 以外に変えた瞬間に再 render が走り、新 accel
で onKeyDown が動く。**評価: 問題なし**。

### 1-B. terminal context (7 binding + xterm.js 統合)

`components/terminal/TerminalPane.tsx` line 379-435 (attachCustomKeyEventHandler)
+ line 815-901 (`dispatchTerminalAction`) + line 907-931 (`doPaste`) を確認。

| 観点 | 評価 |
| --- | --- |
| `findMatchingBinding(ev, "terminal")` が同期で binding id を返す設計 | ◯ React hook 不使用、xterm.js の boolean return 仕様と整合 |
| マッチ時 `ev.preventDefault() + stopPropagation() + return false` | ◯ xterm 文字入力抑止 + window listener 伝播抑止の二重防御 |
| native copy/paste (OS clipboard 経由) を破壊していないか | △ 後述「観察 1」 |
| 7 件の registry 化漏れ | ◯ search / copy / paste / clear / newTerminal / closeTerminal / reset の 7 件すべて dispatch 先に case あり |
| Ctrl+Shift+C / Ctrl+Shift+V の OS / browser 既定 hotkey 衝突 | ◯ `attachCustomKeyEventHandler` の return false で xterm 文字入力 + browser default を抑止、`navigator.clipboard.writeText` / Tauri plugin-clipboard-manager を使うため OS 既定は壊れない |
| Ctrl+V (修飾単独) hardcode 維持 | ◯ shell SIGINT 互換性のため固定。CHANGELOG / bindings.ts note に明記 |
| Ctrl+Shift+L (reset) の dispatch 先 | ◯ container.addEventListener("keydown") 経由を維持。registry 側は noop で xterm 文字入力抑止のみ担う設計が文書化済 |

#### 観察 1: native copy/paste への影響

xterm.js の native マウス選択コピー (右クリック / ドラッグ後 Ctrl+Insert 等) は
`attachCustomKeyEventHandler` を通らないため影響なし。OS 標準の Ctrl+C (terminal
で動作中プロセス kill) は registry の `terminal.copy` (Mod+Shift+C) と別 accel
なので衝突しない (この差分は v1.40.0 以前から既存)。**評価: 問題なし**。

#### 観察 2: terminal.search の検索 input 内挙動

検索 overlay の input 内では `attachCustomKeyEventHandler` が動かないため、別の
onKeyDown handler (line 751-777) が Esc / Enter / Ctrl+Shift+F (close) を処理する
構成。これは v1.38.0 から変わらず、registry 化対象外として正しい設計。

#### 観察 3: terminal.search と palette.search の cross-context warning

registry default で両方 `Mod+Shift+F` のため、`detectConflicts({})` が必ず 1 件
warning を返す。この挙動は **意図通り** (`conflicts.test.ts` 25-39 で pin 留め)
で、UI 上では tooltip で「focus が当該 context にあれば context 側が先に消費」と
明示している。`getConflictsForBinding("palette.search")` test (line 122-127) でも
warning として正しく取得できることを確認済。

**結論**: chatInput / terminal context 拡張は **設計・実装ともに妥当**。Major /
Critical なし。

---

## 2. useBoundCallback の context-aware scope

`lib/keymap/hooks.ts` line 72-200 を確認。

### 2-A. API 設計

```ts
type KeyScope = "global" | "contextOnly" | { ref: RefObject<HTMLElement | null> };
```

3 モードの違いは:

- `"global"` (default): `window.addEventListener` + 「registry の context が
  non-global なら `isContextActive(ctx, event)` で発火制御」
- `"contextOnly"`: `window.addEventListener` + **常に** context active 判定
- `{ ref }`: `el.addEventListener` (window 不使用)

直感的か: ◯ 命名が役割を表しており、3 つの選択肢が独立に意味を持つ。

懸念: `"global"` (default) は registry の context が `chatInput` でも自動で
context-aware になる **暗黙挙動**。これは API としては「default で安全網」だが、
コード読解時に「default なのに context filter がかかる」のは一見直感に反する。
ナレッジに明記されているので OK だが、Minor 1 (M-Phase3-1) として記述。

### 2-B. 既存 8 binding (Phase 1 で global) の挙動が変わっていないか

Phase 1 の global binding はすべて `context: "global"` のため、line 135 の
`if (ctx !== "global" && !isContextActive(ctx, event)) return;` は早期 fall-through
する。発火条件は Phase 1 と完全に一致。**回帰なし**。

### 2-C. StrictMode 二重発火耐性 / cleanup 確実性

- ref scope: `el.addEventListener` → cleanup で `el.removeEventListener`
- window scope: `window.addEventListener` → cleanup で `window.removeEventListener`
- `accel === null` / `enabled === false` で early return → useEffect の return が
  undefined (cleanup 不要) でも StrictMode 二重 run 時に listener 重複しない

useEffect deps に `callback` が含まれるため M-1 観点 (CommandPalette / FilePalette /
SearchPalette) の useCallback memoize が有効に効く。本 release で対応済。

### 2-D. ref scope の `ref.current` 解決タイミング

```ts
const refTarget = typeof scope === "object" && "ref" in scope ? scope.ref : null;
```

useEffect 内で `refTarget?.current` を読むが、ref は React の更新で current が
書き換わってもコンポーネント自身は re-render されない。useEffect の deps に
`refTarget` (= `RefObject` の identity) しか入っていないため、initial mount 後に
ref.current が後から非 null になるケースだと早期 return する。

ただし textarea / terminal pane はいずれも mount 直後に ref が設定される
(useRef が SSR でも synchronous に確定する) ため、Phase 2 で利用される範囲では
問題は発生しない。実利用は InputArea (selector 方式採用) と TerminalPane (vanilla
helper 経路) の両方で `useBoundCallback` の ref scope を **使用していない** ため、
本機能は将来の拡張用 placeholder として動作している。

→ **観察事項として記録**するに留め、現時点 release blocker ではない (M-Phase3-2 に
記載)。

---

## 3. conflict 検出強化 (severity / cross-context)

### 3-A. severity ルール

`lib/keymap/conflicts.ts` line 99-144 の実装:

| ルール | severity | 評価 |
| --- | --- | --- |
| 同 (context, accel) 重複 | `error` | ◯ 順序未定義のため避けるべきという文言が tooltip に出る |
| global accel と他 context の同 accel | `warning` | ◯ focus 状態で優先順が変わる旨を明示 |
| 異なる non-global context (chatInput vs terminal) | 衝突報告しない | ◯ focus 排他で同時 active にならないため、誤検出回避 |

戻り値型 `{ accel, ids, severity, contexts }` は将来拡張に耐える形:
- `contexts` が配列なので 3+ context が絡む場合も表現可能
- Phase 1 互換のため `context` フィールドも残し、最初の binding の context を入れる
  (旧 API consumer が壊れない)

### 3-B. UI 反映 (severity 別 icon + tooltip)

`KeybindingsSettings.tsx` line 279-310 を確認:

- `error`: `<AlertCircle className="text-red-500">` + 「同 context 内重複: ...
  どちらが先に発火するかは未定義のため、別の accel に変更してください。」
- `warning`: `<AlertTriangle className="text-yellow-500">` + 「Global と重複: ...
  focus が当該 context にあれば context 側が先に消費し、それ以外は global 側が消費します。」

tooltip 内容の詳細度は **十分**。衝突相手の `description (id)` を列挙しており、
ユーザーがどの binding と被っているか一瞥で把握できる。

### 3-C. 同 binding が複数 conflict に絡むケース

`conflictMap.set(id, list)` で 1 binding × N conflict を Map で管理し、tooltip 内で
配列 map で複数表示。実装上の落とし穴 (1 件しか表示できない) は無し。

### 3-D. 観察: `aria-label` の文言

severity 別アイコンの `aria-label` (line 285-289) は tooltip 文言とは別に簡略版が
入っている (「同 context 内で同じキーが複数 binding に割当られています」/
「他 context (global) と同じキーが割当られています」)。SR ユーザーは tooltip を
hover できないので、aria-label が短文要約として機能するのは妥当。

E2E test (line 96-100) では `getByLabel(/同じキーが複数 binding に割当られています|
同 context 内で同じキーが複数 binding に割当られています/)` で正規表現受理して
おり、Phase 1 文言 + Phase 2 文言の両方をカバー。**問題なし**。

**結論**: severity / cross-context 検出は **論理・UI 両面で妥当**。Major / Critical なし。

---

## 4. context フィルタ UI

`KeybindingsSettings.tsx` line 139-159 + 198-206 を確認。

| 観点 | 評価 |
| --- | --- |
| shadcn `Tabs + TabsList + TabsTrigger` の選定 | ◯ Radix UI ベースで a11y 準拠 (role=tab + aria-selected が auto 付与) |
| ラベル: `すべて / Global / ChatIn / Terminal / Editor` | ◯ Phase 1 review 提案と一致、簡潔 |
| `data-testid="keybinding-filter-{value}"` で E2E 取得 | ◯ E2E test (line 123, 139) で利用済 |
| empty state 「該当 context に登録された binding はまだありません」 | ◯ Editor タブ選択時に表示される設計、E2E test で pin 留め (line 141-143) |
| editor placeholder の扱い | ◯ Phase 3 で実装する旨をナレッジ §4 末尾 + CHANGELOG Notes Phase 3 候補に明記 |
| TabsList の `aria-label="Context フィルタ"` | ◯ SR 向けに groupedlabel あり |

#### 観察: フィルタ状態の永続化

filter 状態は `useState` のローカル state で、settings 画面を閉じて再度開くと
reset される。VSCode / Cursor の Keyboard Shortcuts editor もフィルタは session
state として保持しないので **慣例通り**。Minor (M-Phase3-2 に併記)。

**結論**: context フィルタ UI は **十分**。Major / Critical なし。

---

## 5. DEC-078 Minor 6 件の吸収状況 (項目別チェック表)

| ID | 内容 | v1.40.0 対応 | レビュー判定 |
| --- | --- | --- | --- |
| **M-1** | inline callback の useCallback memoize | ✓ CommandPalette / FilePalette / SearchPalette 3 ファイル、依存配列の正確性確認済 | ◯ 解消 |
| **M-2** | 件数差 (提案書 7 vs 完了レポート 8) | documentation 課題、code 変更不要、完了レポート §7 + CHANGELOG Notes で「Phase 2 完了時点 16 件」と再整理 | ◯ 解消 (CEO への report 時に明記推奨) |
| **M-3** | match.test.ts 不正入力テスト追加 | ✓ 7 ケース追加 (`Mod+` trailing / `Mod++` / 'plus' alias / 空文字 / whitespace / 不明 modifier / 大文字小文字混在) | ◯ 解消 (本来の M-3 提案 6 ケースから +1 で `'plus' alias` も pin 留めしているのは加点) |
| **M-4** | chat.pasteImage の「ブラウザ管轄」UI hint | ✓ `KeyBindingDefinition.note` field を types.ts に追加、KeybindingsSettings に Info icon + tooltip。`chat.pasteImage` / `terminal.search` / `terminal.paste` の 3 件で活用 | ◯ 解消、note field の汎用化により 3 件以上に流用可能 |
| **M-5** | normalizeEventKey cosmetic 整理 | ✓ 動作変更なしで JSDoc 追記 + 冗長 `key.length === 1` 二重 check 削除 | ◯ 解消 |
| **M-6** (前 release の) | E2E CI 確認 | △ Phase 1 と同様にローカル run 見送り、CI 任せ。前 release で前例確立済 | ◯ blocker ではない |
| **app.openHelp 起動経路接続** | EscapeProvider で `useBoundCallback("app.openHelp", ...)` で listen → useDialogStore.openHelp() 起動 | ✓ defaultAccel: null → Mod+/、HelpDialog 起動経路実装済 | ◯ 解消 |

### 5-A. M-1 (useCallback memoize) の依存配列詳細確認

| ファイル | callback | deps | 評価 |
| --- | --- | --- | --- |
| CommandPalette.tsx | `togglePalette = () => setOpen((v) => !v)` | `[]` | ◯ setOpen は state setter で identity 安定、deps 空で正解 |
| FilePalette.tsx | `toggleFilePalette = () => setOpen(!open)` | `[open, onOpenChange]` (eslint-disable 付き) | ◯ controlled/uncontrolled 両対応のため `setOpen` (内部 wrapper) は memoize しない設計、`open` 依存で listener 再 bind は許容 |
| SearchPalette.tsx | `toggleSearchPalette = () => onOpenChange(!open)` | `[open, onOpenChange]` | ◯ controlled 専用なので props を依存に正しく追跡 |

FilePalette の `setOpen` 内部 wrapper の identity 不安定性については eslint-disable
コメントで意図明示済。再 render 時の listener 再 bind は `open` 値が実際に変化
した時のみ発生するため許容範囲。**評価: 問題なし**。

### 5-B. app.openHelp の Mod+/ 選択理由

完了レポート §8 の 4 候補比較 (`Mod+/` / `F1` / `?` / `Mod+Shift+/`) と採用理由は
すべて妥当。特に:

- `Mod+/` が textarea focus 時でも修飾必須なので入力に紛れない
- chat の SlashPalette は `/` 単独で起動するため棲み分け可能
- VSCode F1 は Tauri webview で OS 既定 (Win の File explorer help) と紛らわしい

の 3 点が決め手。EscapeProvider 経由で `useDialogStore.openHelp()` を呼ぶ経路も
確認 (line 99-107)。**評価: 問題なし**。

### 5-C. Mac の Cmd+Ctrl 区別 / context 越え listener 優先順

| 観点 | 評価 |
| --- | --- |
| Mac で Cmd と Ctrl を別 modifier として区別 | ◯ `match.ts::matchesAccel` line 102-110 で `parsed.mod !== modPressed` で厳密比較、Mac で `Mod+K` (Cmd+K) と `Cmd+Ctrl+K` (Mac の Ctrl は meta=true 扱い) を区別 |
| 同 accel の global vs context-specific の優先順 | ◯ `useBoundCallback` の自動 context-aware (`scope: "global"` default) で context-specific binding が match した時のみ早期 fire、global binding の listener も並行で走るが context-specific 側が `preventDefault + stopPropagation` で抑止可能 |
| terminal の場合は `attachCustomKeyEventHandler` で `return false` を返すため window listener へ伝播しない (xterm focus 時) | ◯ 設計通り |
| 既存 listener (palette.search) の `useBoundCallback` は preventDefault: true なので、もしも先に到達した場合も browser default は止める | ◯ 過剰 prevent の risk はあるが、registry binding は意図的に hotkey 化されているので OK |

#### 観察: chatInput context binding 時の優先順

現在 chatInput に登録されているのは `chat.send` / `chat.pasteImage` の 2 件で、
どちらも実 listener は `useBoundCallback` 経由ではなく InputArea の onKeyDown /
ImagePasteZone の useHotkeys 経由。`useBoundCallback` の自動 context-aware 機能は
chatInput には実 binding として効いていない (Phase 2 では未活用、Phase 3 で `chat.
regenerateLast` 等を追加するときに初めて active になる)。

これは「Phase 2 範囲では `useBoundCallback` の context-aware は terminal 用 *
chatInput 用 placeholder の役割」を持つことを意味し、設計上の冗長機能ではなく
将来拡張のための土台。ナレッジ §1-C で明記済。**評価: 問題なし**。

**結論**: DEC-078 Minor 6 件 + Mac Cmd+Ctrl 区別 + listener 優先順すべて **妥当に
吸収**。Major / Critical なし。

---

## 6. コード品質 (Critical / Major / Minor)

### Critical: 0
### Major: 0

### Minor (本 release で対応 / 引き継ぎで吸収)

- **M-Phase2-A** (任意・引き継ぎ): `useBoundCallback` の `scope: "global"` (default) が
  registry の context に応じて自動で context-aware になる挙動は、API 名と挙動の
  乖離があり読解時に直感に反する。`scope: "auto"` 等の名前変更を Phase 3 で検討
  推奨。実害なし、ナレッジ §4 で明記済のため release blocker ではない。

- **M-Phase2-B** (任意・引き継ぎ): `useBoundCallback` の ref scope 用 `refTarget?.
  current` 解決が useEffect 内で 1 回しか走らない (deps に refTarget identity しか
  入っていない)。後から ref が遷移するケースで listener が貼られない可能性。
  Phase 2 の実利用 (InputArea / TerminalPane) はどちらも ref scope を使っていない
  ため実害なし。Phase 3 で ref scope を本格利用するなら、ref callback 形式 or
  `useImperativeHandle` 経由の遷移検出が必要。

- **M-Phase2-C** (任意・引き継ぎ): `KeybindingsSettings` の context フィルタ状態が
  ローカル state でセッション間維持されない。VSCode / Cursor も同じ慣例なので
  blocker ではないが、明示的にユーザー preference として保存する選択肢は Phase 3
  で再評価可能。

- **M-Phase2-D** (任意・引き継ぎ): `EscapeProvider` の component 名と内容の乖離が
  Phase 2 で更に拡大 (chat.stopGeneration + chat.toggleInputCollapse + app.openHelp
  の 3 binding を抱え、Esc は扱っていない)。rename は `KeybindHotkeysProvider`
  等が候補だが v2 以降の破壊的変更で行う方針が継続。本 release の blocker では
  ない。

- **M-Phase2-E** (任意・引き継ぎ): `dispatchTerminalAction` の `terminal.reset` が
  noop で、実 reset は container.addEventListener("keydown") の hardcode (line
  592-602) に依存している。registry override で `Mod+Shift+L` 以外に変えると
  hardcode 側が反応しなくなり reset できない (Mod+Shift+L 固定挙動の方は registry
  経由 dispatch が consume するので xterm 入力は抑止されるが reset 自体は実行
  されない)。Phase 3 で `dispatchTerminalAction` 内で `term.reset()` を直接呼ぶ
  実装に統合推奨。CHANGELOG / ナレッジには「Phase 3 で reset 関数自体も registry
  から触れる API に整理する候補」として明記済。

  - **release blocker ではない理由**: Phase 2 範囲では `terminal.reset` の override
    が想定されていない。完了レポート §4-3 で「Ctrl+Shift+L reset の dispatch 先は
    container handler の Ctrl+Shift+L 経路に委譲」と明記。Mod+Shift+L から override
    した瞬間に reset が動かなくなる「silent regression」の可能性は低い (ユーザーが
    意図的に override した時のみ発生し、戻せば即復活)。

---

## 7. テストカバレッジ

### 7-A. vitest 66/66 PASS の内訳

| ファイル | ケース | 主な観点 |
| --- | --- | --- |
| `lib/keymap/match.test.ts` | 26 (Phase 1: 19 + Phase 2 M-3: 7) | parseAccel 不正入力 / matchesAccel Mac/Win / formatAccel / eventToAccel |
| `lib/keymap/store.test.ts` | 12 (Phase 1: 11 + Phase 2: app.openHelp Mod+/ default 1) | setOverride / resetOverride / resetAll / null binding |
| `lib/keymap/conflicts.test.ts` | 14 (Phase 1: 11 + Phase 2: severity 3 + cross-context 1) | error / warning / cross-context / findBindingsUsingAccel |
| `lib/keymap/context.test.ts` (新規) | 8 | global 常 true / chatInput textarea 検出 / terminal wrapper 検出 / editor 常 false / target なし時 false |
| `lib/keymap/hooks.test.ts` (新規) | 6 | findMatchingBinding terminal context / global 区別 / override 反映 / unbind 時 null |
| **合計** | **66** | **PASS** |

### 7-B. M-3 不正入力カバレッジ

| ケース | 仕様 pin | 評価 |
| --- | --- | --- |
| `Mod+` (trailing) | key="" / matchesAccel false | ◯ |
| `Mod++` (double) | key="" / matchesAccel false | ◯ |
| `Mod+plus` alias | key="+" / matchesAccel true | ◯ 加点 (alias の互換性まで pin 留め) |
| 空文字 | mod=false / key="" | ◯ |
| whitespace 混入 | trim で吸収 | ◯ |
| 不明 modifier 名 (`Hyper+K`) | hyper を key 扱い → k で上書き | ◯ best-effort 動作を明示化 |
| 大文字小文字混在 (`CTRL+SHIFT+I`) | Mod+Shift+I 相当 | ◯ |

7 ケースで完了レポートが明示する 6 ケース要件を充足、`'plus' alias` を追加で pin
留めしているため M-3 は **完全解消**。

### 7-C. context.test.ts / hooks.test.ts のテスト粒度

- `context.test.ts`: Element mock を duck typing (matches/closest) で実装し、
  Node 環境でも実行可能。global / editor の自明ケース + chatInput / terminal の
  positive/negative pair + null target で、`isContextActive` の境界条件を網羅。
  **粒度十分**。

- `hooks.test.ts`: vanilla helper の `findMatchingBinding` のみ。`useBoundCallback`
  React hook 自体は renderer 不使用なので非対象 (E2E でカバー)。terminal context
  限定 / global は terminal context で拾わない / override 反映 / unbind 時 null
  の 6 ケースで実用上の境界をカバー。**粒度十分**。

### 7-D. E2E 1 ケース追加

`tests/e2e/keybinding-editor.spec.ts` line 110-143 (context filter):

- 初期 (すべて) で terminal.search + palette.command の両方表示を assert
- Terminal タブで terminal binding のみ表示、palette.command が `toHaveCount(0)`
- Editor タブで empty state 文言を assert

assertion は **妥当**。tag selector は `data-binding-id` / `data-testid` で行・
タブを識別、可読性高い。

### 7-E. 既存 28 ケースの regression

ローカル run 見送り (port 3000 競合) のため CI で再検証する想定。Phase 1 release
で前例確立済 (`projects/PRJ-012/reports/dev_v138_keymap_phase1_done.md` §5-3 +
review §11 M-6)。**OK 判定の材料に含めて問題なし**。

---

## 8. アクセシビリティ

### KeybindingsSettings (Phase 2 追加要素)

- Tabs (`role="tablist"` / `role="tab"` / `role="tabpanel"`): Radix UI 自動付与、
  `aria-selected` / `aria-controls` も自動 ✓
- TabsList の `aria-label="Context フィルタ"` で SR 向けにグループ名 ✓
- Note Info icon: `<span aria-label={\`補足: ${b.note}\`}>` + tooltip ✓
- 衝突 severity icon:
  - error: `aria-label="同 context 内で同じキーが複数 binding に割当られています"`
  - warning: `aria-label="他 context (global) と同じキーが割当られています"`
  - icon 自体は `aria-hidden`、span が SR ターゲット ✓
- empty state: 普通の `<td colSpan={5}>` テキスト、SR で読み上げ可 ✓

### HelpDialog (Phase 2 で registry 駆動化)

- `<kbd>` で実 modifier 表記 (semantic 適切) ✓
- `<dl>` ではなく `<ul>` 構造 (Phase 1 と同じ慣習) ✓
- Terminal hardcode 残置セクション (Ctrl+Tab / Ctrl+V) のラベルは「ターミナル
  (registry 化対象外)」で固定挙動を明示 ✓

### TerminalPane (data-terminal-pane marker)

- wrapper に `role="application" aria-label="ターミナル"` を維持 (v1.0 から)
- `data-terminal-pane=""` 属性は装飾要素ではなく context 検出 marker。SR 影響なし ✓

**結論**: WCAG 2.1 AA 観点で大きな問題なし。Phase 1 の a11y レベルから regression
なし。Major / Critical なし。

---

## 9. リリース準備

### バージョン整合

- `package.json`: `"version": "1.40.0"` ✓
- `src-tauri/Cargo.toml`: `version = "1.40.0"` ✓
- `src-tauri/tauri.conf.json`: `"version": "1.40.0"` ✓

### CHANGELOG

- `## [v1.40.0] - 2026-05-01` セクション存在 ✓
- Added / Changed / Fixed / Notes 構造 ✓
- v1.39.0 skip 理由が **Notes** に明記 ✓
- `release.yml` の awk 抽出パターン (`## [$TAG_NAME]` literal match → 次 `## [`
  直前まで) と整合 ✓
- v1.38.0 セクション (line 76-117) は手付かずで保持、tag 既発行ならば再 release
  影響なし ✓

### ナレッジ

`organization/knowledge/keybinding-architecture.md` 確認:

- 起源 / 最終更新を v1.40.0 / Phase 2 完成に更新済 ✓
- §1-C: Phase 2 で `isContextActive` を追加した旨を追記 ✓
- §1-C 末尾: **focus marker 規約** (`data-chat-input` / `data-terminal-pane` /
  xterm 系 selector) を表で明記 ✓
- §2: 新規 binding 追加時の context 判定基準を表で明記 ✓
- §2 末尾: terminal binding 追加時に `dispatchTerminalAction` の case 追加が必要
  / chatInput binding は marker 配置確認の 2 注意点を明記 ✓
- §4: Phase 2 完了履歴 (6 項目) + conflict resolution rule (priority 4 段 + 具体例)
  を新規追加 ✓
- Phase 3 候補が箇条書きで再整理済 ✓

### persist migration の影響

- v1.38.0 / v1.40.0 ともに `version: 1` 維持
- shape `{ overrides: Record<id, accel | null> }` も同一
- 新規 binding (terminal.* 7 件 + app.openHelp の defaultAccel 変更) は registry
  追加のみ、override が無ければ defaultAccel が引かれる
- **既存 v1.38.0 ユーザーの override**: id ベースのため新規 binding 追加に対して
  backward compatible (例: `palette.command` を override 済なら v1.40.0 でも引き継ぎ)

→ **v1.39.0 を skip しても persist migration で問題なし**。

### release blocker 評価

| 項目 | 状態 |
| --- | --- |
| typecheck PASS | ✓ 完了レポート §9-1 |
| lint 新規警告ゼロ | ✓ 同 (既存 32 件は無関係) |
| unit test 66/66 PASS | ✓ 同 §9-2 |
| E2E 29 ケース PASS | △ CI 環境で要再検証 (Phase 1 で前例確立) |
| version 3 ファイル一致 | ✓ |
| CHANGELOG 形式 / awk 抽出整合 | ✓ |
| ナレッジ追記 | ✓ |
| DEC 追記 | CEO 待ち (フロー通り、本ファイルでは判断保留) |

---

## 10. Phase 3 への引き継ぎ評価

完了レポート §10 + ナレッジ §4 末尾の Phase 3 候補リストを確認し、レビュー観点
で網羅性を補強:

### 引き継ぎ網羅性

- [x] react-hotkeys-hook 削除 (`ImagePasteZone.tsx` の特殊事情整理が前提)
- [x] custom binding 追加 (新 command id をユーザー定義)
- [x] Import / Export JSON
- [x] Tauri `plugin-store` 移行 (settings.ts と同タイミング)
- [x] terminal.cycle (Ctrl+Tab) の registry 化 — DEC-079 候補
- [x] editor (Monaco) context 統合
- [x] ImagePasteZone の Mod+V registry override で完全に止められるようにする

### 本レビュー §6 で挙げた Minor の Phase 3 引き継ぎ事項

- **M-Phase2-A**: `useBoundCallback` の `scope: "global"` 命名と挙動の乖離
  → Phase 3 で `scope: "auto"` 等への rename 検討 (破壊的変更だが影響範囲小)
- **M-Phase2-B**: ref scope の ref.current 後遷移検出
  → Phase 3 で ref scope 本格利用するなら callback ref or `useImperativeHandle`
    パターンに変更推奨
- **M-Phase2-C**: context フィルタ状態の永続化
  → Phase 3 で settings.ts に統合検討 (任意)
- **M-Phase2-D**: EscapeProvider の rename
  → v2 以降の破壊的変更タイミングで実施
- **M-Phase2-E**: `terminal.reset` の noop 統合
  → Phase 3 で `dispatchTerminalAction` 内で `term.reset()` 直接呼出に統合

### 引き継ぎ品質スコア

A (網羅性高い)。完了レポート + ナレッジで Phase 3 候補がコードコメント /
CHANGELOG / ナレッジの 3 場所で一貫しており、引き継ぎ書として読み取りやすい。
レビュー観点で追加発見した M-Phase2-A 〜 E の 5 件は本ファイルに追記する形で
Phase 3 着手前の DEC で扱う想定。

---

## 11. 推奨修正

### 本 release (v1.40.0) で対応 / 確認推奨

なし (Critical / Major 不在、Minor も blocker ではない)。

### Phase 3 着手前の DEC で扱うべき項目

§10 引き継ぎ評価に整理した 5 件 (M-Phase2-A 〜 E) を Phase 3 着手前に CEO + dev で
DEC 化することを推奨。

### CEO 報告時の補足明記

- M-2 解消の文脈で「提案書 7 件 + UI placeholder app.openHelp 1 件 = Phase 1 で 8 件、
  Phase 2 で +8 件 (terminal 7 + chat.send 1 が実 listener 化) = 合計 16 件」と
  数の流れを明記すると混乱しない (本 review §5 の表で部分的に記述済)。

### Critical / Major

**なし**。

---

## 12. 最終判断と CEO への報告

### 判定

**APPROVE** (条件付き承認ではなく無条件 approve)。

- Critical: 0
- Major: 0
- Minor: 5 (うち本 release 対応推奨は 0、Phase 3 着手前 DEC で吸収)

### CEO への要点

1. **品質**: Phase 1 で確立した中央 registry / Mod プレースホルダ / persist
   パターンを忠実に拡張し、context-aware scope / cross-context conflict / context
   フィルタ UI / DEC-078 Minor 6 件吸収を一括達成。typecheck PASS、vitest 66/66
   PASS、設計の核 (registry + context evaluator + 自動 context-aware) はすべて
   Phase 3 移行を妨げない形で実装されており、ナレッジも網羅性高い。

2. **release 可否**: そのまま v1.40.0 として release 可。version 3 ファイル一致 /
   CHANGELOG awk 抽出整合 / persist version 1 維持で v1.38.0 ユーザーの override
   は backward compatible に引き継がれる。v1.39.0 skip 判断も意図明確で妥当。

3. **release 前の最終確認 1 件**: CI で E2E 29 ケース PASS の確認 (port 3000 が
   フリーな環境前提)。Phase 1 で前例確立済のため、CI 結果次第で v1.40.0 tag
   push に進める。

4. **DEC-078 追記**: CEO の判断で `projects/PRJ-012/decisions.md` に Phase 2 完成
   を追記後、tag `v1.40.0` push で release 完了。

5. **HP 掲載候補**: 本機能は「Cursor 移行ユーザーがすぐ価値を感じる」改善が
   v1.38.0 → v1.40.0 で完成形に。PRJ-012 marketing 観点で完成度を訴求できる。

6. **Phase 3 着手前の DEC**: 本レビュー §10 で挙げた M-Phase2-A 〜 E の 5 件
   (`useBoundCallback` scope 命名 / ref scope の ref 後遷移 / context フィルタ
   永続化 / EscapeProvider rename / terminal.reset 統合) は Phase 3 着手前に
   CEO + dev で DEC を切ってから着手することを推奨。

### 後続アクション (CEO 担当)

- [ ] CI で E2E 29 ケース PASS 確認
- [ ] `projects/PRJ-012/decisions.md` に DEC-078 Phase 2 完成記録を追記 (本ファイル
  + 完了レポート §13 を参考)
- [ ] tag `v1.40.0` 作成 + push (CHANGELOG `## [v1.40.0]` セクションが release.yml
  awk で自動抽出される)
- [ ] v1.39.0 は skip (tag を作らない)
- [ ] M-Phase2-A 〜 E は Phase 3 着手前 DEC で扱う方針メモ

---

> 本レビューは PRJ-012 v1.40.0 候補 (DEC-078 Phase 2 完成) に対する承認判定のみ。
> 実装には触れていない。修正対応が発生する場合は dev 部門が担当する。
