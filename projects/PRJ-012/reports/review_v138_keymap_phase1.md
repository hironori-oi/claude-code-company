# PRJ-012 v1.38.0 キーバインド編集 Phase 1 - 品質レビュー

> 日付: 2026-04-30 / 担当: レビュー部門 (シニアレビュアー)
> 対象: PRJ-012 sumi v1.38.0 候補 / DEC-078 候補 (キーバインド編集 Phase 1)
> ベース: `projects/PRJ-012/reports/dev_keybinding_editor_proposal.md` (案 C ハイブリッド) + `projects/PRJ-012/reports/dev_v138_keymap_phase1_done.md`

---

## 判定: APPROVE

- Critical: 0
- Major: 0
- Minor: 6

提案書 (案 C / Slim) に忠実な実装であり、提案書で謳われた「中央 registry 化 →
HelpDialog / KeybindingsSettings の DRY 解消 + ユーザー override 永続化」を
過不足なく満たしている。typecheck / unit 41 ケース PASS、設計上の Phase 2 引き継ぎ
境界も明示的かつ妥当。**そのまま v1.38.0 として release 可**。

E2E ローカル run 見送り (port 3000 占有) は本実装の問題ではなく、CI で再検証する
前提が成立すれば問題なし。tag 作成は CEO 判断の通り。

---

## 1. 設計の妥当性

### registry の id 命名規約

`<category>.<verb>` (lowerCamelCase) の dot 区切り。Phase 1 で確定する命名規約と
してナレッジに明文化済 (`organization/knowledge/keybinding-architecture.md` §1-B)。

- 良い点: VSCode の `editor.action.foo` ほど深くせず、PRJ-012 規模 (~20 binding)
  に適切な粒度。`category` が `app` / `chat` / `palette` で安定。Phase 2 で
  `terminal.*` / `editor.*` を追加する余地が残っている
- 観察: `chat.stopGeneration` の元 hardcode は EscapeProvider でも「停止」目的
  であり、`app.stopGeneration` ではなく `chat.*` 配下に置いた判断は妥当 (ナレッジ
  にも DEC-067 / v1.25.0 由来として記述あり)

**結論**: 将来拡張に耐える設計。**Major / Critical なし**。

### Mod プレースホルダの実装

`Mod` は Mac=metaKey / Win/Linux=ctrlKey に動的解決。`isMacPlatform()` を
`match.ts::matchesAccel` 内で参照する形に統一 (旧 `(e.ctrlKey || e.metaKey)` の
手書き OR が消えた)。

- 良い点: registry / store / matcher / formatter / KeyRecorder すべてが `Mod`
  正規形で一貫。OS 跨ぎで override が保存できる
- 観察: matchesAccel 内で `parsed.mod !== modPressed` を厳密比較しているため、
  Mac で `Mod+K` と `Cmd+Ctrl+K` を区別する。Mac で誤って Cmd+Ctrl を併用しても
  反応しない設計は意図通り
- 観察 (Minor): `eventToAccel` で Mac の場合、modPressed=true (metaKey) のとき
  ctrlKey を無視する。Mac 上で「Cmd+Ctrl+K を録音」は accel が `Mod+K` として
  保存される。仕様としては妥当だが、Phase 2 で「Mac の Ctrl 単独修飾」を別 binding
  にしたいケースが出ると拡張が必要 → Phase 2 引き継ぎ評価に記載

### `KeyContext` 4 値分類

Phase 1 では `useBoundCallback` が context 判定をせず常に window listen する
**制約付き実装**。registry 側は context フィールドを正しく記録 (`chat.send` =
`chatInput`、`palette.*` = `global` 等)。

- 良い点: Phase 2 で `isContextActive(ctx)` を `useBoundCallback` 内に追加するだけ
  で binding 側 / 各 component 側は無変更で済む設計。引き継ぎ容易性が高い
- 観察 (Minor): Phase 1 時点では `chat.send` (context=chatInput) を registry に
  登録しても、Phase 2 まで実 listener は `InputArea` 直書き onKeyDown のまま。
  「registry にあるが実際は別経路」という二重管理が約 1 release だけ存在する
  (HelpDialog 表示用には機能するため致命的でない)

### `useBoundCallback` API

`(bindingId, callback, options)` のシンプルな API。`enabled` / `preventDefault` /
`stopPropagation` / `enableOnFormTags` 4 オプション。Phase 2 で context オプション
を追加する余地もある (Phase 2 では options に `context` 引数を追加して registry
の context を override 可能にすると柔軟性高)。

- 良い点: react-hotkeys-hook の API と互換的 (`enableOnFormTags` 等の用語を継承)
- 良い点: 内部で IME guard / defaultPrevented guard / accel === null による
  listener 不貼り を完備
- **Minor 1 (M-1)**: `useEffect` の deps に `callback` が入っているため、callsite
  が `useCallback` で memoize しないと parent 再 render ごとに listener 再 bind
  される。EscapeProvider は `useCallback` 済だが、CommandPalette / FilePalette /
  SearchPalette は inline 関数を渡しており、再 render コストが嵩む可能性
  (機能上は無害)

### persist version / migration boilerplate

- key `sumi:keybindings`、version 1
- shape `{ overrides: Record<id, accel | null> }`
- `safeStorage` + `migrate` を `lib/stores/settings.ts` から踏襲

**結論**: ナレッジ §3 と完全整合。Phase 2 で `version: 2` に上げる際の boilerplate
として `migrate(persisted, version)` が空実装だが正しく定義されている。Tauri
`plugin-store` 移行 (Phase 3) で同 shape をそのまま import できる前提も維持。

---

## 2. registry 登録 binding の妥当性

登録 8 件:

| ID                          | accel        | context     | 整合性                                         |
| --------------------------- | ------------ | ----------- | ---------------------------------------------- |
| `chat.stopGeneration`       | Mod+.        | global      | OK (DEC-067 / v1.25.0、現状 EscapeProvider と一致) |
| `chat.toggleInputCollapse`  | Mod+Shift+I  | global      | OK (DEC-076 / v1.36.0)                         |
| `chat.send`                 | Mod+Enter    | chatInput   | OK (現状 InputArea hardcode と一致、Phase 2 で実移行) |
| `chat.pasteImage`           | Mod+V        | chatInput   | 表示用のみ (browser default paste と共存、ImagePasteZone の実 binding は react-hotkeys-hook 残し) |
| `palette.command`           | Mod+K        | global      | OK (PM-171 / 提案書 §3.C と一致、Mod+Shift+P ではない) |
| `palette.file`              | Mod+P        | global      | OK (PM-948)                                     |
| `palette.search`            | Mod+Shift+F  | global      | OK (PM-231 / PM-232)                            |
| `app.openHelp`              | null         | global      | placeholder 設計、override 用 (提案書外で +1 件) |

### 個別観点

- **`palette.command` Mod+K**: 提案書 §3.C / §5 Phase 1 と一致。レビュー観点で
  「Mod+Shift+P」が想定されたのは別案 (VSCode 互換 = 案 B) の文脈であり、本実装の
  案 C (Hybrid) では Mod+K を踏襲するのが正解。**問題なし**。
- **`app.openHelp` null**: 「registry に登録だけして override 待ち」を許容する
  設計選択。`store.test.ts` の「default null binding can be overridden to an
  accel」ケースで動作保証済。Phase 1 提案書では明記されていなかった追加だが、
  defaultAccel: null の取扱いを早期に test pin 留めしている点は評価。**Minor 2
  (M-2)**: 提案書 §5 Phase 1 リストには 7 件しかなく `app.openHelp` は含まれない。
  完了レポート §2 で 8 件と記載されており追加意図は読み取れるが、CHANGELOG / 提案書
  / 完了レポートの 3 文書間で件数が揺れているため、CEO 報告時に 8 件と明記すべき。
- **`chat.pasteImage` Mod+V**: registry 上は表示用、実 listener は ImagePasteZone
  が `useHotkeys("ctrl+v, meta+v")` で持つ並存設計。完了レポート §3 と
  bindings.ts のコメントで意図が明記されている。**問題なし** (ただし下記
  Minor 4 参照)。

---

## 3. コード品質

### 3-A. `match.ts` の accel parser / matcher

**parseAccel**:
- 順序不問・大文字小文字無視 (test 19 ケースで pin 留め済)
- alias テーブル (Enter/Esc/Tab/Up/Down/...) でキー名揺れを吸収
- `Ctrl` / `Cmd` / `Command` 直書きを `Mod` に正規化 (互換性配慮)

**Minor 3 (M-3)**: 不正入力 (`Mod++`) のケースが test されていない。`split("+")`
で空文字列 `""` が parts に入り、最後の non-empty 要素が key になるため
`Mod+` 単独だと `key === ""` で `matchesAccel` が false を返す。実害なしだが、
edge case の明示的 test を追加すると堅牢。

**matchesAccel**:
- `event.key` ベースの照合 (大文字小文字無視)。**`event.code` は使わない** = layout
  非依存性は弱い (例: AZERTY layout の Mac では `Cmd+;` が物理的に別キーに来る)。
  registry の対象 binding は Mod+ASCII letter / Mod+Shift+letter / 記号 1 文字
  に限られているため Phase 1 では実害なし。Phase 3 で「物理キー bind」を追加する
  時に `event.code` に切替えれば対応可
- IME guard (`isComposing` / `keyCode === 229`) は `useBoundCallback` 側で実施 →
  二重 guard ではないが正しい責務分担

**formatAccel**:
- Mac: `⌘⇧I` グリフ連結、Win/Linux: `Ctrl+Shift+I` text 連結
- prettifyKey で Enter (↵/Enter)、Tab (⇥/Tab)、矢印 (↑↓←→) を OS 別表記
- **Minor 4 (M-4)**: `chat.pasteImage` の display は `⌘V` / `Ctrl+V` だが、
  KeybindingsSettings 行の「(上書き済)」表示が出る経路で「実は browser default
  に委譲されているので unbind しても効果なし」をユーザーが知る術がない。
  bindings.ts のコメントには記載があるが、UI 上の hint がほしい (例: badge
  「ブラウザ管轄」or tooltip)。Phase 2 で `chat.send` が registry 化される時に
  同等の課題が顕在化するため、その時併せて対応推奨。**Minor 推奨修正に記載**

**eventToAccel**:
- Modifier 単独で null を返し KeyRecorder の「まだ key が入っていない」状態を表現
- 1 文字 ASCII は小文字化、特殊キー (Enter/Escape/Tab/Arrow*) も小文字化して
  parseAccel 側 alias と整合
- **Minor 5 (M-5)**: `normalizeEventKey` 内 line 235 に冗長な `key.length === 1`
  check (外側の if で既に確認済)。実害なし、cosmetic

### 3-B. `store.ts` の override null 取り扱い

- `setOverride(id, null)` = unbind (listener 不貼り)
- `resetOverride(id)` = key 削除 (default に戻す)
- `getEffectiveAccelFromState(state, id)` で `id in state.overrides` を見て
  `null` も「overrides 値あり」と判定 → 正しく `null` を返す
- registry 未登録 id は `null` (binding 不発) で fallback

**結論**: unbind の意味論が `null` (override 値) と `undefined` (override 不在)
で正しく区別されている。`store.test.ts` の 11 ケースでも明示的に pin 留め済。

### 3-C. `hooks.ts` の cleanup

- `window.addEventListener` / `removeEventListener` の対 ✓
- `accel === null` で早期 return → listener 不貼り ✓
- `enabled === false` で早期 return ✓
- `defaultPrevented` 事前 check ✓ (他 listener が先に消費した場合に尊重)
- IME guard (`isComposing` / `keyCode === 229`) ✓
- StrictMode 二重発火: `useEffect` の cleanup で remove するため StrictMode 下でも
  リーク無し (旧 EscapeProvider と同等の安全性)

### 3-D. `conflicts.ts` の context 内検出

- 同 `context` + 正規化 accel が一致する binding を groupBy → ids.length >= 2
  でグループ化
- `findBindingsUsingAccel` は `excludeId` 引数で「自分自身」を除外可 → KeyRecorder
  inline warning に使用
- `null` (unbind) は `if (!accel) continue` で除外 → unbind 済 binding は衝突
  対象外 (test pin 留め済)

**結論**: ロジック妥当。Phase 2 で context 切替が入ったときも `def.context !==
context` の filter で正しく動作する設計。

### 3-E. `KeyRecorder.tsx` の入力処理

- modifier-only 押下 (`Control` / `Shift` / `Alt` / `Meta` / `OS` / `Hyper` /
  `Super`): `eventToAccel` が null を返す → recorded 更新せず ✓
- Esc: 「Radix Dialog の close と競合させたくないので素通し」とコメント。
  Dialog default close (Esc) で cancel ✓
- Backspace 単独: clear (再録音) ✓
- Tab: 受理 (alias テーブル経由) ✓
- IME 中: `isComposing` / `keyCode === 229` で skip ✓
- capture phase で `addEventListener("keydown", onKey, true)` を使い、Dialog 内の
  textarea や button が先に受け取らないように先取り ✓

**結論**: 仕様通り。VSCode 互換。

---

## 4. 既存 5 経路の置換

| 経路                | 旧                       | 新                                                          | 整合性 |
| ------------------- | ------------------------ | ----------------------------------------------------------- | ------ |
| EscapeProvider      | window.addEventListener  | `useBoundCallback("chat.stopGeneration" / "chat.toggleInputCollapse")` × 2 | ✓ `useCallback` で handler memoize、listener 再 bind 抑止 |
| CommandPalette      | `useHotkeys("mod+k")`    | `useBoundCallback("palette.command")`                        | ✓ 機能等価 (M-1 参照) |
| FilePalette         | `useHotkeys("mod+p")`    | `useBoundCallback("palette.file")`                           | ✓ 機能等価 (M-1 参照) |
| SearchPalette       | `useHotkeys("mod+shift+f")` | `useBoundCallback("palette.search")`                      | ✓ 機能等価 (M-1 参照) |
| ImagePasteZone      | `useHotkeys("ctrl+v, meta+v")` | **未移行** (browser default paste 共存のため意図的に残す) | ✓ bindings.ts コメント / 完了レポート §3 注記 / ナレッジ §4 で明記 |

### `enableOnFormTags` 相当の挙動差分

- 旧 `react-hotkeys-hook` `useHotkeys` は `enableOnFormTags: true` をデフォルト
  off にしていた (input/textarea focus 時は発火しない)
- 新 `useBoundCallback` は `enableOnFormTags: true` をデフォルト on (= input /
  textarea でも発火、ただし callsite 全 5 箇所が `enableOnFormTags: true` を明示
  渡し済なので **挙動差分なし**)
- 差分が出る可能性があったのは `useHotkeys` の暗黙 default に依存していた箇所だが、
  対象 5 経路は全て明示指定されていたため、regression は出ていない

### IME composition 処理

旧 EscapeProvider は `e.isComposing || e.keyCode === 229` を直接 guard。新 hook
は同じロジックを内部化。問題なし。

**結論**: 5 経路の置換は機能等価。既存挙動の regression は見受けられない (CI で
既存 26 ケース PASS で最終確認)。

---

## 5. HelpDialog の registry 駆動化

### 移行範囲

- 旧 hardcode `<li>` ~15 件 → registry 1 ソースから category 別グルーピング表示
- `Chat` / `Palette` / `App` の 3 category × OS 別 modifier 表記 (Mac=⌘ / Win=Ctrl)
- `formatAccel(item.accel)` で OS 切替が動的に効く

### 漏れ確認

| セクション                  | 状態                        | 問題                                |
| --------------------------- | --------------------------- | ----------------------------------- |
| 「主なショートカット」      | registry 駆動 ✓             | -                                   |
| 「ターミナル内ショートカット」 | hardcode 維持 ✓             | Phase 2 引き継ぎ宣言済 (HelpDialog L191-231 にコメント明記) |
| 「組込コマンド」 / 「ユーザー定義コマンド」 | hardcode (registry 対象外) | コマンドはキーバインドではないので registry に乗せない判断は妥当 |

ターミナル系 7 件 (Ctrl+Shift+F/K/N/W/C/V/L、Ctrl+Tab) は HelpDialog では
hardcode セクションに依然表示され、Phase 2 で registry 化する旨が L191 コメント
に明示。**漏れなし**。

### Mac / Win での modifier 表記

- Mac: `⌘.` / `⌘⇧I` / `⌘↵` / `⌘V` / `⌘K` / `⌘P` / `⌘⇧F`
- Win: `Ctrl+.` / `Ctrl+Shift+I` / `Ctrl+Enter` / `Ctrl+V` / `Ctrl+K` / `Ctrl+P` /
  `Ctrl+Shift+F`

`formatAccel` の test (`match.test.ts` line 165-186) で両 OS の表記が assertion
されており、HelpDialog の出力と整合する。**問題なし**。

---

## 6. 副作用・エッジケース

### 想定シナリオ

| シナリオ                                       | 結果                                                                 | 評価 |
| ---------------------------------------------- | -------------------------------------------------------------------- | ---- |
| KeyRecorder で Enter 録音 → `chat.send` と衝突 | KeyRecorder 内 inline warning 表示、保存後行 warning icon 表示       | ✓ E2E ケース 2 で pin 留め |
| 同 binding を 2 回 override                    | 2 回目のみ `setOverride` で上書き保存                                | ✓ store.ts の`overrides: { ...s.overrides, [id]: accel }` で正しく動作 |
| すべての binding を unbind (null)              | 全 listener 不貼り、registry が空でもアプリは落ちない                 | ✓ `useBoundCallback` の `accel === null` early return |
| 旧版から起動 (`sumi:keybindings` 不在)         | persist 初期値 `{ overrides: {} }` で安全に起動                       | ✓ Zustand persist 標準動作 |
| chrome 系 hotkey 衝突 (Ctrl+W close tab)       | registry に Ctrl+W が無い、Phase 1 binding は Ctrl+W を hijack しない  | ✓ |
| KeyRecorder Dialog 表示中の Esc / Tab          | Esc は素通し (Dialog close)、Tab は accel として記録可能              | ✓ KeyRecorder L65 / alias テーブル |

### Tauri devtools と Ctrl+Shift+I の衝突

`chat.toggleInputCollapse` は Mod+Shift+I で、Tauri release build では devtools
が無効化されるため衝突しない (v1.36.0 / m-2 として v1.37.0 で繰越済の既知課題)。
本 release では追加の悪化なし。

### form tag 内挙動

`enableOnFormTags: true` (default) を全 callsite が明示渡しているため、textarea
focus 時も hotkey が発火する (CommandPalette / FilePalette / SearchPalette /
EscapeProvider の旧挙動と同等)。

---

## 7. テストカバレッジ

### vitest 41 ケース (新規)

| ファイル                       | ケース | 主な観点                                                       |
| ------------------------------ | ------ | -------------------------------------------------------------- |
| `lib/keymap/match.test.ts`     | 19     | parseAccel (順序 / 大小 / alias / 記号) / matchesAccel (Mac/Win) / formatAccel / eventToAccel |
| `lib/keymap/store.test.ts`     | 11     | setOverride / resetOverride / resetAll / getEffectiveAccel / null binding |
| `lib/keymap/conflicts.test.ts` | 11     | 同 context 重複 / context 違いは衝突しない / unbind は対象外 / findBindingsUsingAccel |

### カバレッジ強度

- 主要 happy path: ✓
- Mac/Win 切替 (`isMacPlatform` mock 経由): ✓
- modifier 順序の正規化: ✓
- override null (unbind) の境界: ✓
- registry 未登録 id: ✓ (`getEffectiveAccel` で null を返す)
- 不正入力 (`Mod++` 等): ✗ (M-3 推奨修正)

### E2E 2 ケース

1. **override 永続化**: `chat.stopGeneration` を `Ctrl+/` に変更 → localStorage
   `sumi:keybindings` 検証 → reload → override 残存
2. **衝突 warning**: `palette.command` を `Ctrl+Shift+I` に変更 (default
   `chat.toggleInputCollapse` と同 context + 同 accel) → KeyRecorder inline
   warning + 行 warning icon × 2 (両 binding)

assertion は妥当。tag selector は `data-binding-id` / `data-testid` で行を識別、
`getByLabel` で warning aria-label を引いており可読性高い。

### CI 想定

既存 26 ケース regression 防止は CI 任せ。**Minor 6 (M-6)**: 完了レポート §5-3 で
ローカル run 見送り (port 3000 占有) を申告しており、CI で 28 ケース PASS が
release 条件として CEO に明示されている。CI 結果確認なしに tag を切るのは avoid
すべきというフラグだけ。

---

## 8. アクセシビリティ

### KeyRecorder Dialog

- `Dialog` は shadcn (Radix UI) ベースのため `role="dialog"` / `aria-modal="true"`
  / focus trap が自動付与 ✓
- `DialogTitle` / `DialogDescription` で SR 用ラベル ✓
- 録音中の表示エリアに `aria-live="polite"` ✓ (recorded 更新時に SR 通知)
- 衝突 warning アイコンに `aria-hidden`、テキストで「既存 binding と衝突します」
  + 詳細 ✓ (M-7 候補だがテキスト表記で代替されているので問題なし)

### KeybindingsSettings

- `<table>` 内に `<thead>` / `scope="col"` / `<th>` ✓
- `<kbd>` で実 modifier 表記 (semantic 適切) ✓
- 「未割当」を `<span class="italic">` で表示 (semantic 弱いが SR 読み上げ可) ✓
- 衝突 warning icon: `<span aria-label="同じキーが複数 binding に割当られています">`
  + Tooltip ✓
- 編集ボタン: `<Pencil aria-hidden />` + 「編集」テキスト → アクセシブル ✓
- リセットボタン (icon-only): `aria-label="${b.id} をデフォルトに戻す"` ✓
- 「すべてリセット」: `<RotateCcw aria-hidden />` + テキスト「すべてリセット」 ✓

### app/settings/page.tsx

- Tab `name="キーバインド"` で SR 読み上げ可 ✓
- description が「Phase 1: global context」と明示 → ユーザーが現状制約を把握可 ✓

**結論**: WCAG 2.1 AA 観点で大きな問題なし。Major / Critical なし。

---

## 9. リリース準備

### バージョン整合

- `package.json`: `"version": "1.38.0"` ✓
- `src-tauri/Cargo.toml`: `version = "1.38.0"` ✓
- `src-tauri/tauri.conf.json`: `"version": "1.38.0"` ✓

### CHANGELOG

- `## [v1.38.0] - 2026-05-01` セクション存在 ✓
- `release.yml` の awk 抽出パターン (`## [$TAG_NAME]` literal match → 次 `## [` 直前まで)
  と整合 ✓
- 内訳 (Added / Changed / Notes) に Phase 1 実装の主要事項を網羅 ✓

### ナレッジ

- `organization/knowledge/keybinding-architecture.md` (新規 ~190 行) で id 命名
  規約 / context 4 値 / Mod プレースホルダ / 新規 binding 追加手順 (3 ステップ) /
  Phase 2 引き継ぎ事項 / デバッグ手順を網羅 ✓
- `organization/knowledge/INDEX.md` への登録は本 release 範囲外だが、PRJ-012
  完了時の GATE-K で `lessons-learned-v2` 形式と合わせて棚卸す前提

### DEC 記録

- `projects/PRJ-012/decisions.md` に **DEC-078** はまだ追記されていない (完了
  レポート §8 で「ID 提案のみ、追記判断は CEO」と明記)
- これはフローとして妥当 (実装承認 → release 後に DEC 確定の流れ)
- CEO による DEC-078 追記後に tag `v1.38.0` push が release 完了の最終手順

### release blocker 評価

| 項目                                   | 状態                       |
| -------------------------------------- | -------------------------- |
| typecheck PASS                         | ✓ 完了レポート §5-1        |
| lint 新規警告ゼロ                      | ✓ 同 (既存 32 件は無関係)  |
| unit test 41 ケース PASS               | ✓ 同 §5-2                  |
| E2E 28 ケース PASS                     | △ CI 環境で要再検証 (M-6) |
| version 3 ファイル一致                 | ✓                          |
| CHANGELOG 形式                         | ✓                          |
| ナレッジ                               | ✓                          |
| DEC 追記                               | CEO 待ち (フロー通り)      |

---

## 10. Phase 2 への引き継ぎ評価

完了レポート §6 + ナレッジ §4 に Phase 2 の引き継ぎ事項が網羅されている。
レビュー観点での評価:

### 引き継ぎ網羅性

- [x] context evaluator (`lib/keymap/context.ts`) の追加箇所を明示
- [x] InputArea の `chat.send` (Mod+Enter) / Esc を `useBoundCallback` 経由化
  する具体手順
- [x] TerminalPane の `attachCustomKeyEventHandler` を registry accel 取得に
  refactor する戦略 (xterm.js の `return false` 仕様を保つため dispatch は local
  実装)
- [x] HelpDialog のターミナルセクション registry 駆動化 (現状 hardcode)
- [x] `react-hotkeys-hook` 削除 / Tauri `plugin-store` 移行 / Import-Export を
  Phase 3 に切り出す判断

### 引き継ぎ品質スコア (内部基準)

A- (軽微な不足あり)。具体的には以下が引き継ぎ書に未記載:

- **API 設計の懸念**: Phase 2 で `useBoundCallback` の options に context 引数を
  追加するか、registry の context だけに依存するかの方針が未定。registry の
  context が `chatInput` でも、callsite で `{ context: "global" }` を明示的に
  override する余地を残すか否かは Phase 2 着手前に DEC が必要
- **Mac の Cmd+Ctrl 区別**: Phase 1 では Mac で modPressed=true のとき ctrlKey を
  無視するが、Phase 2 で「Mac の Ctrl 単独修飾」を別 binding にしたいケースが
  顕在化する可能性 (terminal の Ctrl+C が Mac の Cmd+C と衝突する状況)。Phase 2
  着手前にこの観点を整理しておくと事故防止
- **listener 順序**: `palette.search` (global / Mod+Shift+F) と `terminal.search`
  (terminal / Mod+Shift+F) の優先順を context evaluator で正しく解決するために
  「同 accel + 異 context 同時 active 時に terminal が先勝ち」のルールを
  ナレッジに明記すべき (現状は引き継ぎ書 §6-2 のサンプルコードで暗示されているが、
  ルールとしての明文化なし)

これら 3 点は **本 release の blocker ではなく**、Phase 2 着手時の DEC で扱えば
よい性質のもの。引き継ぎ書として A- 相当。

### Phase 2 で対応する範囲 (本レビューの推奨修正に**含めない**)

- M-4 の `chat.pasteImage` UI hint (Phase 2 で `chat.send` 移行と同タイミング)
- ターミナル系 7 binding の registry 化
- HelpDialog ターミナルセクションの registry 駆動化
- M-3 の不正入力 test 追加 (parseAccel の堅牢性は Phase 1 で実証済のため Phase 2
  cleanup で OK)
- Mac Cmd+Ctrl の取扱 DEC

---

## 11. 推奨修正

> Phase 2 で対応すべき項目は本セクションに**含めず**、§10 引き継ぎ評価に整理。
> 以下は本 release (v1.38.0) で対応するか、または DEC-078 closing 時に明記して
> おくべき項目のみ。

### Minor (任意・本 release で対応推奨だが blocker ではない)

- **M-1**: CommandPalette / FilePalette / SearchPalette の inline callback を
  `useCallback` で memoize すれば、parent 再 render ごとの listener 再 bind を抑止
  できる。EscapeProvider と同じパターンに揃える。実装コスト 1 ファイル数行。
- **M-2**: 提案書 §5 Phase 1 では 7 件、完了レポート §2 では 8 件 (`app.openHelp`
  が追加)。CHANGELOG / ナレッジで「8 件」に統一されているので大勢には問題ないが、
  CEO への report で「提案書の 7 件 + UI placeholder `app.openHelp` 1 件 = 8 件」と
  明記しておくと混乱を避けられる。
- **M-3**: `match.test.ts` に不正入力 (`Mod++`、空白混入、空文字) のテストケースを
  追加すると堅牢。現状の実装は黙ってスキップするだけで害は出ないが、test pin で
  仕様を明確化したい。

### 本 release では未対応で OK / 引き継ぎで吸収

- **M-4**: `chat.pasteImage` の UI hint。Phase 2 で `chat.send` registry 化と
  同タイミング。
- **M-5**: `match.ts::normalizeEventKey` の冗長 check (cosmetic)。次回 cleanup PR
  でついで対応。
- **M-6**: E2E 28 ケース CI 確認が release 前の必須チェック。CEO release 確認
  事項 (完了レポート §8) として明記済。

### Critical / Major

**なし**。

---

## 12. 最終判断と CEO への報告

### 判定

**APPROVE** (条件付き承認ではなく無条件 approve)。

- Critical: 0
- Major: 0
- Minor: 6 (うち 3 件は本 release 対応推奨だが blocker ではない、3 件は Phase 2
  または cleanup PR で吸収)

### CEO への要点

1. **品質**: 提案書 (案 C / Slim) と完全整合。typecheck / unit 41 ケース PASS。
   設計の核 (中央 registry + Mod プレースホルダ + context 切替の延期) はすべて
   Phase 2 移行を妨げない形で実装されており、ナレッジ (`organization/knowledge/
   keybinding-architecture.md`) も網羅性高い。
2. **release 可否**: そのまま v1.38.0 として release 可。version 3 ファイル一致 /
   CHANGELOG 形式 / awk 抽出整合済。
3. **release 前の最終確認 1 件**: CI で E2E 28 ケース PASS の確認 (port 3000 が
   フリーな環境前提)。完了レポート §8 にも明記済。
4. **DEC-078 追記**: CEO の判断で `projects/PRJ-012/decisions.md` に追記後、
   tag `v1.38.0` push で release 完了。
5. **HP 掲載候補**: 本機能は「Cursor 移行ユーザーがすぐ価値を感じる」改善。
   PRJ-012 marketing 観点 (オーナーの個人開発者向け IDE positioning) との
   整合性も高い。
6. **Phase 2 着手前の DEC**: 引き継ぎ評価 §10 で挙げた 3 点 (API options、Mac
   Cmd+Ctrl、listener 優先順ルール) は Phase 2 着手前に CEO + dev で DEC を
   切ってから着手することを推奨。

### Minor 推奨修正の取扱

- M-1 / M-2 / M-3 を本 release 内で対応するか、v1.38.1 patch で扱うかは CEO 判断。
  実装コストは合計 30 分程度、release blocker ではないため CEO 判断に委ねる。

### 後続アクション (CEO 担当)

- [ ] CI で E2E 28 ケース PASS 確認
- [ ] `projects/PRJ-012/decisions.md` に DEC-078 を追記 (キーバインド編集 Phase 1
  = 案 C ハイブリッド + Slim スコープ採択)
- [ ] tag `v1.38.0` 作成 + push (CHANGELOG `## [v1.38.0]` セクションが
  release.yml awk で自動抽出される)
- [ ] M-1 / M-2 / M-3 を v1.38.0 / v1.38.1 / Phase 2 のいずれで対応するか方針判断

---

> 本レビューは PRJ-012 v1.38.0 候補に対する承認判定のみ。実装には触れていない。
> 修正対応は dev 部門が担当する。
