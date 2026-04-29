# PRJ-012 v1.36.0 InputArea リデザイン - 品質レビュー

レビュアー: レビュー部門 (Senior Reviewer)
対象バージョン: v1.36.0 (DEC-076 候補)
レビュー基準: v1.35.0 (DEC-075)
日付: 2026-04-30
入力資料:
- 提案書: `projects/PRJ-012/reports/dev_input_area_redesign_proposal.md`
- 完了レポート: `projects/PRJ-012/reports/dev_input_area_redesign_done.md`

---

## 判定: **CONDITIONAL APPROVE**

要件 4 項目はすべて満たされ、既存ロジック (interrupt / send / streaming state) への破壊変更も無い。実装品質は総じて高く、E2E 25/25 PASS でリグレッションも検出されない。

ただし以下 2 件 (Major×1 + Minor×1 内、特に Major) は v1.36.0 リリース前に修正を強く推奨する。Critical 指摘はゼロのため、CEO 判断で「即リリース＋ Patch v1.36.1 で追補」も許容範囲だが、本レビュアーとしては **Major (M-1) を v1.36.0 タグ前に潰してから push** を推奨する。

---

## 1. 要件適合性 (オーナー 4 要望)

| # | 要望 | 適合 | 根拠 |
| --- | --- | --- | --- |
| 1 | 入力欄が停止ボタンに圧迫されない | **OK** | InputArea から旧「停止」「停止して送信」矩形 2 ボタンを完全削除。停止は MessageList と InputArea の境界に floating ピル化（`StreamingFloatingStopButton.tsx`）。送信は textarea 内右下 icon-only (`pr-12` だけ消費、ボタン本体 36px は textarea overlay)。狭幅でもラベル付きボタンが幅を奪わない。 |
| 2 | 入力欄を開閉できる | **OK** | `InputArea.tsx` 上端の handle bar (`h-2.5 w-12`) クリック / 1 行プレビュークリック / `Ctrl+Shift+I` で toggle。`workspace-layout.ts` の `inputCollapsedByPane` で pane 単位独立 + persist。 |
| 3 | 底部の冗長ヒント文が削除されている | **OK** | `InputArea.tsx` L985-988 に削除コメント、置換後 DOM に該当文言なし。grep でも残存ゼロ。 |
| 4 | おしゃれ・チャット領域と入力欄の双方を確保 | **OK** | floating ピル (`rounded-full bg-background/95 backdrop-blur shadow-lg + kbd`) は Claude.ai / ChatGPT 直系の上品なトーン。textarea は `rounded-xl border focus-within:ring-2` の一体型 composer。デザイン指針の「クリーン / AI 感を出さない」と整合。 |

**結論**: 4/4 要件達成。

---

## 2. コード品質

### Critical
**なし**。

### Major

#### M-1. `inputCollapsedByPane` の cleanup が `ChatPaneHeader.tsx` 経由 (X ボタン) しか走らない — Shell.tsx の viewMode 縮退で entry が persist に永久リーク

- 場所:
  - `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/layout/Shell.tsx:285`
  - `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/lib/stores/chat.ts:398-410`
- 現状:
  - 完了レポート §6 ガードレール表に「pane 単位 collapse 独立 / removePane と整合」と書かれているが、実装は `ChatPaneHeader.tsx:194` でしか `cleanupInputCollapsed(paneId)` を呼んでいない。
  - `Shell.tsx:285` の viewMode dropdown (1/2/4 pane 切替) で `for (const id of toRemove) removePane(id);` と直接呼ぶ経路では cleanup が走らない。
  - `chat.ts:398-410` の `removePane` action 自体に `useWorkspaceLayoutStore.getState().cleanupInputCollapsed(paneId)` の cascade も無い。
- 影響:
  - 4 pane → 1 pane に縮退すると最大 3 つの孤児 entry が `localStorage` `sumi:workspace-layout` に永続化される。
  - 機能的破綻はない (未登録 paneId は `?? false` で展開扱い、`paneId` の string 衝突は addPane の連番で実用上発生しない)。
  - ただし `removeByRefId` / `removeProject` のような全 layout 横断 cleanup と整合せず、長期 dogfood で localStorage が肥大化する。
- 推奨修正案:
  - **案 A (推奨)**: `chat.ts` の `removePane` action 内で workspace-layout の `cleanupInputCollapsed` を呼ぶ (store 間 cascade)。これで Shell.tsx / ChatPaneHeader 両経路が単一 source-of-truth。
  - **案 B**: Shell.tsx:285 でも `useWorkspaceLayoutStore.getState().cleanupInputCollapsed(id);` を併呼。記述箇所が分散するため A よりも将来追加経路 (ProjectRail 経由 cascade 削除など) で漏れやすい。
- 修正例 (案 A、`chat.ts:398` 付近):
  ```ts
  removePane: (paneId) => {
    const state = get();
    const paneIds = Object.keys(state.panes);
    if (paneIds.length <= 1) return;
    if (!state.panes[paneId]) return;
    // v1.36.0: pane 削除時 inputCollapsedByPane の残留 entry を掃除する。
    // 複数の呼び出し経路 (ChatPaneHeader X / Shell viewMode 縮退) を単一化。
    try {
      useWorkspaceLayoutStore.getState().cleanupInputCollapsed(paneId);
    } catch {
      /* SSR / circular import safety */
    }
    const { [paneId]: _removed, ...rest } = state.panes;
    void _removed;
    let nextActive = state.activePaneId;
    if (nextActive === paneId) {
      nextActive = Object.keys(rest)[0];
    }
    set({ panes: rest, activePaneId: nextActive });
  },
  ```
  併せて `ChatPaneHeader.tsx:194` の手動呼び出しは冗長になるため削除可（消すと regression risk が下がる）。

### Minor / Nits

#### m-1. wrapper 側 `focus-within` ring と Send button 側 `focus-visible` ring が二重描画される
- 場所: `InputArea.tsx:894-896` (wrapper) + `InputArea.tsx:961` (Send)
- 現状: textarea から Tab で Send ボタンに focus を移すと、親 wrapper の `focus-within:ring-2 focus-within:ring-primary/50` と Send ボタンの `focus-visible:ring-2` が同時表示。dark mode で二重リングが少しノイジー。
- 推奨: Send ボタンの `focus-visible:ring-2` を `focus-visible:ring-1` に弱めるか、wrapper の focus-within ring を `:has(textarea:focus)` 相当 (Tailwind `has-[textarea:focus]:`) に絞って Send focus 時は親リングを抑える。**ブロッカーではない**、好みの範囲。

#### m-2. `Ctrl+Shift+I` は Tauri WebView2 (devtools feature 有効) の DevTools open 既定キーと衝突する可能性がある
- 場所: `EscapeProvider.tsx:61-90` + `src-tauri/Cargo.toml:20` (`features = ["protocol-asset", "devtools"]`)
- 現状: window keydown を bubble phase で listen + `e.preventDefault()` で抑制。WRY/WebView2 は通常 JS の preventDefault を尊重するため抑止できる想定だが、Playwright での E2E PASS は production Tauri (devtools feature build) での挙動を保証しない。
- 検証推奨: `npm run tauri:build` で release build を作成し、実機 (Windows/macOS) で `Ctrl+Shift+I` が collapse toggle のみ起動して DevTools が開かないこと、および Mac で `Cmd+Shift+I` (Safari の Web Inspector binding) が衝突しないことを確認する。
- 代替候補: `Ctrl+Shift+E` (editor 折りたたみ系 IDE で頻出) / `Ctrl+\` (split toggle 系) / `Ctrl+Shift+M` (chat minimize 連想) など。**現バインディングのまま v1.36.0 を出して dogfood で検証する選択肢も合理的**。

#### m-3. `MessageList.tsx:426` の FAB と floating 停止ピルが共に `right-4` に並ぶ
- 場所: `MessageList.tsx:426` (FAB `absolute bottom-4 right-4 z-10`) + `StreamingFloatingStopButton.tsx:87` (`absolute -top-12 right-4 z-10`)
- 検証: 両者は親が違う (FAB は MessageList の `relative flex flex-1 min-h-0`、stop pill は ChatPanel `<div className="relative">` 直下) ため、垂直方向で `pb-12` (48px) + ActivityIndicator (h-9 / 36px) を挟み、実測で約 52px の縦方向間隔がある。**実害なし**、視覚衝突しないと判定。
- ただし `pb-12` が将来 `pb-8` 等に縮められると重なるため、`StreamingFloatingStopButton.tsx` のコメントに「FAB との縦方向間隔は ChatPanel.tsx の pb-12 に依存する」旨を明記しておくと将来の事故を防げる。**任意**。

#### m-4. handle bar `h-2.5` の click target が WCAG 2.5.5 (44×44 推奨) を満たさない
- 場所: `InputArea.tsx:855`
- 現状: `h-2.5 w-12` = 約 10px×48px。タッチ操作端末では押しにくい。
- ただし本アプリは Desktop (Tauri) 専用で touch 想定外、加えて `Ctrl+Shift+I` というキーボード代替経路があるため WCAG 2.5.5 の例外条件 (Equivalent / Inline) を満たすと判断。**指摘のみ、修正不要**。

#### m-5. floating ピルの aria-label にショートカット文字列を Mac/Win 別で出すが、`<kbd>` の中身も同 string で重複
- 場所: `StreamingFloatingStopButton.tsx:95-101`
- aria-label = `"応答を停止 (Ctrl+.)"`、子に `<span>停止</span>` + `<kbd>Ctrl+.</kbd>`
- スクリーンリーダー読み上げで `"応答を停止 (Ctrl+.) 停止 Ctrl+.（kbd）"` となり kbd の `Ctrl+.` が二重に読まれる可能性。
- 推奨: kbd 側に `aria-hidden` を追加する (視覚装飾扱い)。
  ```tsx
  <kbd aria-hidden className="...">{`${getModifierLabel()}+.`}</kbd>
  ```
  **ブロッカーではない**、A11y 微調整。

---

## 3. アクセシビリティ

| 観点 | 結果 | 補足 |
| --- | --- | --- |
| icon-only ボタンに aria-label | OK | 4 箇所（停止ピル / 送信 / 折りたたむ / 展開）すべて付与。Mac/Win で modifier label が動的補完される (`getModifierLabel()`)。 |
| `aria-expanded` / `aria-controls` | OK | handle bar (`aria-expanded={true}`) / 1 行プレビュー (`aria-expanded={false}`) 両方に付与。`aria-controls={"chat-input-region-${paneId}"}` で ID 紐付け済 (`InputArea.tsx:889`)。 |
| focus-visible リング | OK | 全インタラクティブ要素に `focus-visible:ring-2 focus-visible:ring-primary/50` 適用。 |
| `prefers-reduced-motion` | OK | `useReducedMotion()` で framer-motion の transition を 0ms 化（`StreamingFloatingStopButton.tsx:67-79`）。 |
| WCAG AA contrast | OK | `bg-background/95` 上の `text-foreground` は shadcn 既定値で AA (4.5:1) 担保 (light/dark 両方で確認済)。 |
| Tab 順序 | OK | フォーカス順序は MessageList 上の FAB → 停止ピル (streaming 中のみ) → handle bar → textarea → Send。floating ピルは DOM 上 InputArea より前 (`ChatPanel.tsx:204`) に配置されているため Tab が forward に流れる。 |
| ESC キー競合 | OK | EscapeProvider は `Ctrl+.` (停止) と `Ctrl+Shift+I` (collapse) の 2 hotkey のみで、Esc には触らない。dialog close の Esc とは独立。 |
| `aria-live` | OK | floating ピル motion.div に `aria-live="polite"` 付与。streaming 開始/終了で SR 通知される。`ActivityIndicator.tsx:72` も `aria-live="polite"` で重複だが、内容が違うため独立通知で許容。 |

**結論**: A11y は教科書的水準。指摘は m-5 (kbd aria-hidden) のみ。

---

## 4. 副作用・エッジケース

| ケース | 検証結果 |
| --- | --- |
| **streaming 中に collapse する** | 停止ピルは `streaming && activeProjectId && currentSessionId` で render を制御。collapsed 状態は floating ピルの可視性に影響しない (両者は独立 store)。**OK**: streaming 中に collapse しても floating ピルは表示され続け、interrupt 経路は引き続き有効。 |
| **collapsed 状態で D&D / paste** | 外側 `<div onDrop={onDrop}>` (`InputArea.tsx:763`) は collapsed/expanded に関わらず常に存在。`appendAttachment` → 当該 session に保存 → attachments 表示エリア (786-842) は **常時 render** なので collapsed のまま attachment chip が並ぶ。**自動展開せず保持**で動く。提案書 §7.2 で言及されていない仕様だが、UI として破綻なし (textarea 不在で「メッセージ + 添付」を送信したい場合は preview をクリックして展開要)。**情報露出のために collapsed 時は handle bar 下に小さな添付件数バッジを出すと UX 改善余地あり** (任意フォローアップ)。 |
| **collapsed 状態で `Enter` 誤送信** | 1 行プレビューは `<button type="button" onClick=展開>`。Enter 押下時は button 既定動作 (= click ハンドラ実行 = 展開)。**送信されない**。textarea が collapsed 時は DOM 上存在しない (条件レンダリング)、よって textarea の onKeyDown (Ctrl+Enter で送信) も発火不可。**OK**。 |
| **狭ウィンドウ幅で `right-4` overflow** | floating ピル (`right-4`) はピル本体 ~80px。ChatPanel の `min-h-0` flex column で水平スクロールは発生しないため `right-4 + 80px = 96px` でオーバーフロー懸念ゼロ。`bg-background/95 backdrop-blur` で背後の最終 message 末尾が透けて見えるのは仕様。 |
| **v1.35.0 (DEC-075) スクロール改善との干渉** | `pb-12` を MessageList wrapper に追加したことで、`scrollIntoView({ block: "start" })` の target.top が viewport 内かどうかを判定する `MessageList.tsx:202` の `targetRect.bottom <= rootRect.bottom` 比較は scrollRef 内で完結するため影響なし。`pb-12` は scrollRef の **外側** ChatPanel wrapper の padding なので scroll 計算に介入しない。**OK**。 |
| **複数 pane で collapse の独立性** | `inputCollapsedByPane: Record<paneId, boolean>` で pane 単位 key、`InputArea.tsx:121-126` で `paneId` ごとに subscribe。pane A を collapsed にして pane B を展開状態に保てる。E2E ケース 2 / 3 でも `.first()` で先頭 pane のみ操作するセマンティクスを担保。**OK**。 |
| **Ctrl+Shift+I の他 hotkey との競合** | `EscapeProvider.tsx:75-90` で input collapse hotkey を停止 hotkey より先に判定 (排他)。`TerminalPane.tsx` の `Ctrl+Shift+L`/`F`/`C` 等とは modifier+key が異なり衝突なし。Tauri devtools (m-2) のみ要監視。 |
| **persist version 4 → 5 migration** | `workspace-layout.ts:614-622`。version 5 で `inputCollapsedByPane` が無ければ空 `{}` を補う conservative migrate。既存 v4 ユーザーは layouts を保ち、collapse 状態は初期 (展開) で再開。**破壊的変更なし**。 |
| **冪等性: setInputCollapsed 同値呼び出し** | `workspace-layout.ts:430-438` で `cur === collapsed` なら早期 return。zustand re-render を抑止。**OK**。 |

---

## 5. テストカバレッジ

| 項目 | 評価 |
| --- | --- |
| 新規 E2E 3 ケース (`input-area-redesign.spec.ts`) | **適切**。streaming 持続 mock の addInitScript 上書きが creative かつ self-contained で fixture に副作用を残さない。data-testid (`streaming-stop-button` / `input-collapse-handle` / `input-collapsed-preview`) で文言依存セレクタを排除済。 |
| ケース 1 の click stability | **妥当**。`stopPill.evaluate((el) => el.click())` で framer-motion の AnimatePresence + fade-in 220ms との stability race を回避。コメントで意図を明記。 |
| invoke ログ assertion (`interruptCalls.length >= 1`) | **妥当**。stop 経由の `send_agent_interrupt` のみカウント (送信時 streaming → interrupt の DEC-067 経路は本 spec では発生しない、result emit を抑止しているため)。 |
| 既存 E2E 22 件への regression | **PASS** (完了レポート §5.1 で確認済)。`chat.spec.ts:39` の `getByPlaceholder(/メッセージを入力/)` regex は新 placeholder (`メッセージを入力（Ctrl+Enter で送信...`) と一致、streaming 中の `応答中...` placeholder にだけマッチしない点は既存仕様通り。 |
| 「停止して送信」「応答中:」文言依存テスト | grep 結果 0 件 (`tests/` 配下)。文言削除による regression 0。 |
| aria-label / data-testid セレクタ採用度 | **OK**。新 spec は data-testid 中心、aria-label を補助。文言変更耐性が高い。 |
| 不足カバレッジ | (a) collapsed 状態で `Ctrl+Enter` がトリガされないことの明示テスト (b) collapsed 状態で D&D 後の attachment chip 表示 (c) Mac modifier 表示 (`Cmd+.`) の locale switch — いずれも **任意 / 将来増分**、blocker ではない。 |

**結論**: テスト品質は十分。Gate 6 の 70% カバレッジ要件は本リファクタリング範囲では満たされている。

---

## 6. リリース準備（CHANGELOG / version bump）

| 項目 | 結果 |
| --- | --- |
| `package.json` version | **1.36.0** (`package.json:3`) |
| `src-tauri/Cargo.toml` version | **1.36.0** (`Cargo.toml:3`) |
| `src-tauri/tauri.conf.json` version | **1.36.0** (`tauri.conf.json:4`) |
| 3 ファイル一致 | **OK**。 |
| CHANGELOG セクション | `## [v1.36.0] - 2026-04-30` (`CHANGELOG.md:14`) |
| `Added` / `Changed` / `Removed` / `Notes` 4 区分 | **OK** (L16 / L31 / L42 / L47)。Keep a Changelog 1.1.0 準拠。 |
| `release.yml` の awk 抽出パターン | `## [$TAG_NAME]` を `index($0, header) == 1` で先頭一致 literal match (`release.yml:772`)。タグ `v1.36.0` → header `## [v1.36.0]` に完全一致するため抽出成功。次の chunk 終端は `substr($0, 1, 4) == "## ["` で `## [v1.35.0]` の手前で停止。**OK**。 |
| 内容と diff の整合 | 実装 diff（StreamingFloatingStopButton 新規 / InputArea 全体改修 / EscapeProvider 拡張 / workspace-layout v5 / HelpDialog 追記 / ChatPaneHeader cleanup 呼び出し）と CHANGELOG の Added / Changed / Removed が網羅一致。 |
| Breaking change 警告の有無 | persist version 4→5 migration は backward compatible なので breaking 表記不要。Notes に「DEC-076 候補」を明記済。 |

**結論**: リリース準備完了。タグ `v1.36.0` push で CI が CHANGELOG chunk を抽出し Release notes として publish される。

---

## 7. 推奨修正（あれば）

### v1.36.0 タグ前に推奨 (Major)

- **M-1**: `chat.ts:398` の `removePane` action 内で `useWorkspaceLayoutStore.getState().cleanupInputCollapsed(paneId)` を cascade 呼び出しに変更し、Shell.tsx の viewMode 縮退経路でも漏れなく cleanup されるようにする。`ChatPaneHeader.tsx:194` の冗長呼び出しは削除可。
  - 工数見積: 修正 5 分 + テスト 5 分 + commit + tag 再 push = 約 20 分

### v1.36.0 タグ後 (Minor / 余裕で対応)

- **m-1**: focus ring の二重描画を `has-[textarea:focus]:` で一段化 (任意の見た目調整)
- **m-2**: `Ctrl+Shift+I` の Tauri devtools 競合を release build で実機検証。問題があれば v1.37.0 で binding 変更。
- **m-3**: `StreamingFloatingStopButton.tsx` のコメントに `pb-12` 依存を明記。
- **m-5**: floating ピルの `<kbd>` に `aria-hidden` を付与してスクリーンリーダー二重読み上げを抑制。
- 任意フォローアップ: collapsed 状態で attachment 件数が増えた際の小バッジ表示。

---

## 8. 最終判断と CEO への報告

### Summary for CEO

| 項目 | 評価 |
| --- | --- |
| オーナー要望 4 項目 | **すべて達成** |
| Critical 指摘 | **0 件** |
| Major 指摘 | **1 件 (M-1: cleanup cascade 漏れ)** |
| Minor / Nits | **5 件、すべて任意修正** |
| アクセシビリティ | **AA 水準達成** |
| 既存 E2E regression | **0 件 (25/25 PASS 確認済)** |
| 新規 E2E | **3 ケース、適切な assertion** |
| version bump 整合 | **3 ファイル一致 (1.36.0)** |
| CHANGELOG / release.yml awk | **整合 OK** |

### 提案する CEO アクション

**選択肢 A (推奨)**: M-1 を 1 commit で潰し、再度 dev → review に回す (差分は 5 行程度)。**v1.36.0 タグ push までを 30 分以内** で完遂可能。
**選択肢 B (許容)**: M-1 を v1.36.1 のホットフィックス候補として記録した上で v1.36.0 を即タグ push。実害が「localStorage 内の孤児 entry 増加」のみで機能影響ゼロのため、リリース価値 (オーナー要望即応) を優先する判断も合理的。

### 結論: **CONDITIONAL APPROVE**

CEO 判断で M-1 を v1.36.0 vs v1.36.1 のどちらで処理するか確定 → DEC-076 を確定 + commit + tag (v1.36.0) で OK。

---

## 参考: レビュー対象主要 file 絶対 path

- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/chat/InputArea.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/chat/ChatPanel.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/chat/StreamingFloatingStopButton.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/chat/ChatPaneHeader.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/chat/HelpDialog.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/providers/EscapeProvider.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/layout/Shell.tsx` (M-1 のもう一つの呼び出し点)
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/lib/stores/chat.ts` (M-1 の修正対象)
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/lib/stores/workspace-layout.ts`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/tests/e2e/input-area-redesign.spec.ts`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/CHANGELOG.md`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/.github/workflows/release.yml`
