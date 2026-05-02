# PRJ-012 チャット日付グルーピング機能 — 実装計画

- 案件: PRJ-012 (sumi - Claude Code マルチプロジェクト IDE)
- 対象バージョン候補: v1.44.0
- 想定 DEC: DEC-084
- 起票: 2026-04-30 (オーナー指示)
- 作成: dev (シニアエンジニア)
- 関連 DEC: DEC-064 (session-scoped chat) / DEC-073 (Editor Slot 多 tab) / DEC-075 (スクロール改善: 回答先頭オートスクロール + FAB) / DEC-076 (InputArea リデザイン) / DEC-082 (sidebar session-scoped) / DEC-083 (message meta)

---

## 0. TL;DR (CEO 用)

- オーナー要望は「長い session でチャットを日付グルーピング、過去日付は collapsed、必要時に展開」。**実装可**。最大の論点は「過去 message の timestamp 取得経路」だが、**DB に `messages.created_at` (epoch s, INTEGER) が既に存在し、index も張られている**ため遡及対応も問題なし。
- ただし frontend の `ChatMessage` 型は現状 timestamp を保持していない (`session.ts:111-152` の `toChatMessage` が `m.createdAt` を捨てている)。**まず `ChatMessage.timestamp` 追加が前提工事 (S)**。
- 推奨は **案 C — 折りたたみ + sticky 日付ヘッダ + 一括展開コントロール**。理由は (1) DEC-075 のスクロール挙動と非干渉に共存可能、(2) 仮想スクロール (案 B) のような大幅 refactor を避けられる、(3) UX が「ヘッダで現在位置がわかる + クリックで開閉」と素直、(4) search palette 統合 (Phase 2) も容易。
- **規模 M — 推定 2〜3 日 (DEC-084 として独立)**。Phase 1 は "折りたたみ + 静的ヘッダ"、Phase 2 で sticky / 一括 / search 自動展開 / FAB 連携を追加。
- **着手判断**: GO 推奨。先に「`ChatMessage.timestamp` 配線 (S, 0.5 日)」をマージし、続けて Phase 1 をリリース。Phase 2 は v1.45.0 候補。

---

## 1. 現状調査

### 1.1 チャット描画 (現状)

- 主ファイル: `projects/PRJ-012/app/ccmux-ide-gui/components/chat/MessageList.tsx`
  - 1 件の scroll container (`overflow-y-auto`、L373) にすべての `displayItems` を flat に並べる。日付ヘッダや `<hr>` のような **境界要素は一切ない** (L380-451)。
  - 表示単位は `groupConsecutiveTools` (L36-62) が返す `DisplayItem` 二択:
    - `{ kind: "single", message }` → `<UserMessage>` / `<AssistantMessage>` / `<ToolUseCard>`
    - `{ kind: "tool-group", id, messages[] }` → `<ToolUseGroup>` (連続 tool を 1 まとめ、`showToolDetails === false` 時のみ)
  - 各 message は `data-msg-id={m.id}` を付け (L406)、search palette などからの jump はこれを CSS escape して `querySelector` する (L210)。
  - framer-motion `<AnimatePresence initial={false}>` で in/out アニメ (L381, L388-411)。`prefers-reduced-motion` の包括無効化は DEC-076 で `useReducedMotion()` 経由に統一済 (decisions L2464)。
  - empty state は別 path (L346-367)。messages > 0 のみ FAB を出す (L462-471)。

- 仮想スクロール: **未導入**。すべての `displayItems` を一度に DOM に乗せている。React 19 + zustand で getSnapshot cache のため `EMPTY_MESSAGES` 固定参照を `selectMessagesForPane` で fallback (`chat.ts:1132-1139`)。

- 表示単位は「個別 message」が基本で、唯一の bundling は連続 tool。**user / assistant / 単発 tool の境界 = chunk 境界として再利用可**。

### 1.2 timestamp / 日付の取得経路

- **DB 側 (Rust)**: `src-tauri/src/commands/history.rs`
  - `messages.created_at INTEGER` (epoch seconds、L344-357)
  - `CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(session_id, created_at)` (L356-357) — **session 単位の created_at order がすでに index 化**
  - `Message` struct は `created_at: i64` を camelCase serialize で持つ (L114-126)
  - `get_session_messages` は `ORDER BY created_at ASC` (L874) → 順序は確定
  - `INSERT INTO messages` は `created_at` を `now` (epoch s) で write (L1638 等)、`append_message` も同様 (L617)

- **frontend 側**:
  - `lib/types.ts:92-106` の `StoredMessage` は **`createdAt: number` を持っている** (L98)
  - **しかし** `lib/stores/session.ts:111-152` の `toChatMessage` は `id / role / content / attachments / toolUse / meta` だけを返し、**`createdAt` を捨てている** (L141-151)
  - `ChatMessage` 型 (`chat.ts:84-99`) も `meta?: MessageMeta` 経由でしか時刻を持たない:
    - DEC-083 で `meta.sentAt: number (epoch ms)` を user message に attach (`InputArea.tsx:359` で送信時 `Date.now()` を打刻)
    - **assistant / tool message には `meta` 自体が設定されない** (`appendMessage` / `appendToolUse` / `replaceStreamingMessage` のいずれも meta を作らない)
    - つまり `chat.ts:898-909` の `updateMessageMeta` でしか meta は更新できず、現状の path は user message と SDK init 経由の back-fill だけ

- **DEC-083 以前の過去 user message**: meta_json 列が NULL なので frontend 側 `meta = undefined` → `meta.sentAt` でも判定不能
- **assistant / tool は永続的に `meta` なし** → 必ず DB の `created_at` に頼る必要がある

→ **結論**: 日付判定の唯一の正解は **DB の `messages.created_at` を `ChatMessage` に伝搬すること**。DEC-083 の `meta.sentAt` は「ユーザー意図の打刻」として残し、グルーピングは `created_at` を真とする。

### 1.3 既存の境界 / セパレータ

- 「日付ヘッダ」「ここから新しい turn」「`<hr>`」は **存在しない**。現状の唯一の bundling は連続 tool group (§1.1)。
- ChatPaneHeader (`ChatPaneHeader.tsx`) には `DropdownMenuSeparator` があるが、これは menu UI 用 (L13, L152) で message 列とは無関係。
- ToolUseGroup の境界 (DEC-073 では Editor Slot 側、message とは別) は今回の議題と無関係。

→ **結論**: 既存の chunk 境界処理を壊さないかは要監視 (連続 tool group が日付をまたぐ稀なケース) だが、**新規構造の追加はクリーンに行える**。

### 1.4 スクロール / 長い session のパフォーマンス

- 仮想スクロール **なし**。React 19 reconciler + framer-motion `<AnimatePresence>` で全件 render。1 message あたり 1 motion.div + UserMessage/AssistantMessage 内の Markdown render (assistant) が走る。
- 数十 message ではほぼ無感、**数百〜千 turn の session では Markdown render が支配的になる懸念あり** (体感は Bash code block を含む長 turn で顕著)。
- DEC-082 (sidebar session-scoped) は store 側の混線解消で、DOM 描画コストとは独立。
- DEC-075 のスクロール listener は RAF coalesce 済 (`MessageList.tsx:285-291`)、FAB の判定も `userMessageIds` を Set 化 (`MessageList.tsx:238-244`)。スクロール handler 自体は O(n) DOM 走査だが既存パスで耐えている。

→ **結論**: 折りたたみによる「**collapsed 日付の中身 DOM をそもそも mount しない**」だけでも、長 session の体感は大幅改善する。仮想スクロール (案 B) は今回見送りで OK。

### 1.5 関連ストア / persist

- `chat.ts` 本体: persist version 2 (DEC-064)、`partialize` で `activePaneId` と pane viewport (currentSessionId 等) のみ保存 (L1068-1081)。messages / streaming / attachments / activity は揮発。
- `session-preferences.ts`: persist version 4、`perSession` (sessionId → SessionPreferences) と `perProject` (projectId → SessionPreferences sticky) の二段 (`session-preferences.ts:247-503`)。
- 折りたたみ状態 (どの日付 chunk が expanded か) は **session-scoped** が妥当:
  - 同 session を後で開き直したら過去の expand 状態を踏襲したい (オーナー要望「必要な時に開いて確認」と一致)
  - pane-scoped にすると「同 session を別 pane に出した時に開閉が独立」になり混乱する (DEC-064 で session が source-of-truth)
  - project-scoped にすると違う session の状態が混入する → NG
- persist 先候補 (推奨は B):
  - **A: localStorage に `chat.ts` 内で expand state を直接 persist** — 既存 store 拡張、追加 store 不要だが揮発 messages と混ぜたくない
  - **B (推奨): 新規 `lib/stores/chat-display.ts` (or `message-list-display.ts`)** — `expandedDateBuckets: Record<sessionId, string[]>` を session 単位で persist、key は `"sumi:chat-display"`、session-preferences と同じ persist パターン踏襲
  - C: SQLite に列追加 — 過剰、UI state を DB に置くのは不釣合い

---

## 2. 設計案

### 共通前提 (全案で必要な前提工事 — 規模 S)

1. **`ChatMessage.timestamp?: number` (epoch ms) を追加** (`chat.ts:84-99`)
2. **`toChatMessage` で `m.createdAt * 1000` を伝搬** (`session.ts:141-151`)
3. **`appendMessage` / `appendToolUse` / `replaceStreamingMessage` で送信時 `Date.now()` を打刻** (`chat.ts`)
4. **fallback 規則**: `timestamp` が無い message (旧版 cache) は **「直前の message の timestamp を継承」** (DB は ASC order なので chunk としてはその方が安定。完全欠落時は `Date.now()` を最後の砦)

### 案 A: 静的日付ヘッダ + 折りたたみ

- **日付判定**: `ChatMessage.timestamp` の Local TZ 日付 (`yyyy-MM-dd`) を bucket key
- **グループ化**: 既存 `groupConsecutiveTools` の **後段** に `groupByDate(displayItems)` を挟む。`DisplayItem` を `DateGroup` (= `{ key: "yyyy-MM-dd", date: Date, items: DisplayItem[] }`) に集約
- **expand UI**: 日付ヘッダ (button) + chevron icon。クリックで toggle、`<AnimatePresence>` で `height: 0 ↔ auto` トランジション
- **デフォルト**: 「**最後の message が含まれる日付**」のみ expanded、それ以外 collapsed (オーナー要望「過去日付は閉じた状態」をそのまま実装)
- **persist**: §1.5 案 B、`expandedDateBuckets[sessionId] = ["2026-04-30", ...]`、session 単位 localStorage
- **スクロール**:
  - DEC-075 の「完了時 scrollIntoView({block: "start"})」は **expand 済 chunk への scroll なので影響なし** (今日の message は常に expanded)
  - 折りたたみ瞬間は scrollHeight が縮むため `userScrolledUpRef` 判定が一時的にずれる可能性 → toggle 直後 1 frame だけ recompute を強制すれば済む (`MessageList.tsx:296` 経路の流用)
  - 過去日付を expand すると上方向に DOM が増える → ブラウザのデフォルト scroll anchor (CSS `overflow-anchor: auto`) で十分自然 (Chrome / Tauri)
- **規模**: M (実装 1〜1.5 日)
- **長所**: シンプル、既存 MessageList を最小変更、CEO がレビューしやすい
- **短所**: ヘッダが sticky でないため長い 1 日の中でスクロールするとどの日付か視認できない (ユーザーは scrollbar 位置で推測)

### 案 B: 仮想スクロール + 日付ヘッダ (sticky)

- **日付判定**: 案 A と同じ
- **アプローチ**: `@tanstack/react-virtual` を導入、`VirtualItem` として「日付ヘッダ行 + 各 message 行」を flat list 化、`stickyIndices` で日付ヘッダを top sticky
- **expand UI**: 折りたたみという概念を持たず「すべて表示するが画面外は仮想化」
- **デフォルト**: N/A (仮想化のみ)
- **persist**: 不要 (折りたたまない)
- **スクロール**:
  - DEC-075 の `scrollIntoView` は仮想化下では target が unmount されている可能性があり **`scrollToIndex` API への移行が必要** = DEC-075 ロジックを書き直す
  - search palette `chat.scrollToMessageId` 経路 (`SearchPalette.tsx:218-219`) も全面書き換え
  - FAB 「直前 user にジャンプ」も `userIds` から index を逆引きする実装に変更
- **規模**: L (実装 4〜5 日 + DEC-075 周辺の regression 確認)
- **長所**: 数千 turn でも O(viewport) で render、UX がサクサク
- **短所**:
  - **オーナー要望「過去日付を閉じる」を満たさない** (= 折りたたみ概念がない) — 個別の質問 + 回答でも可だがオーナー意図は「閉じる」
  - DEC-075 / search-palette / chat.spec / scroll-improvement.spec の全面 regression が必要
  - framer-motion の layout animation と相性が悪い (motion.div を捨てる必要あり)

### 案 C (推奨): 案 A + sticky 日付ヘッダ + 一括展開コントロール

- **日付判定**: 案 A と同じ (`ChatMessage.timestamp` から Local TZ 日付 key)
- **グループ化**: 案 A と同じ
- **expand UI**: 案 A + ヘッダに `position: sticky; top: 0` を付与、scroll 中も「今読んでいる日付」が画面上端に常駐
- **追加コントロール**: MessageList 上部に小さなツールバー (or ChatPaneHeader 内) に「すべて展開 / すべて折りたたみ」ボタン (= `Maximize2` / `Minimize2` icon、Heroicons 規約遵守)
- **デフォルト**: 案 A と同じ (最後 message の日付のみ expanded)
- **persist**: §1.5 案 B
- **スクロール**:
  - 案 A と同じだが、sticky ヘッダ分の offset (例 `scroll-mt-12`) を message に追加して scrollIntoView の anchor がヘッダ下にくる調整が必要
  - DEC-075 の `scroll-mt-16` (`MessageList.tsx:392, L415-416`) を **`scroll-mt-20` 程度に微調整** (具体値は実装で fine-tune)
- **既存機能との非干渉**:
  - search palette ヒット → DEC-075 既存実装 (120ms 遅延 scrollIntoView, `MessageList.tsx:202-218`) に **「先に対象日付を expand する 1 行」を追加**: `expandDateForMessageId(messageId)` を chat-display store に生やし、search palette `handleSelect` (SearchPalette.tsx:210) と MessageList `scrollTargetMessageId` 経路の前段で呼ぶ
  - DEC-075 FAB「直前 user ジャンプ」: collapsed 日付に user message があると現在の DOM 走査では HitTest できない → **FAB 自身は「visible (= expanded chunk 内) の直近 user」だけを対象とする**で OK。collapsed の user は概念的に「閉じた歴史」なので跳ばさなくて自然 (ユーザー要望と一致)
  - streaming 中: 新規送信 = 必ず「今日」の日付チャンク = 必ず expanded → 影響なし。streaming 中に日付が変わる稀ケース (= 0 時跨ぎ) は **streaming 完了時に新日付ヘッダを生成、新日付チャンクを auto-expand** (実装は `groupByDate` の純粋関数で自動的に達成される)
- **規模**: M〜L (実装 2〜2.5 日)、Phase 分割で M (1 日) + M (1.5 日) に縮小可能
- **長所**:
  - オーナー要望を完全に満たす + UX が現代的
  - 仮想スクロールを避けるので DEC-075 / DEC-076 / DEC-083 と非干渉
  - 一括コントロールで「全部見たい」「全部閉じたい」を 1 click で実現 (オーナーの monitor 用途と相性◎)
- **短所**: sticky 実装で z-index と背景の調整が必要 (border-b + bg-background/95 backdrop-blur で既視感のある実装に統一)

### 案 D: 「今日のみ表示、過去は別画面 (Drawer / Modal)」

- **アプローチ**: MessageList は今日の message だけを描画、ChatPaneHeader に「履歴」ボタン → Drawer で過去日付の messages を閲覧
- **デフォルト**: 常に「今日」のみ
- **persist**: 不要 (常に「今日」)
- **スクロール**: MessageList 自体は短くなるので DEC-075 の scrollIntoView との衝突なし
- **既存機能との非干渉**: search palette は Drawer も検索対象にする等の追加 UX 設計が要る
- **規模**: L (Drawer + 履歴 view + search palette 統合)
- **長所**: スクロールが極限まで短くなる
- **短所**:
  - **オーナー意図「**必要な時に**開いて確認**」とずれる (= 別画面遷移より同画面 expand の方が一貫)
  - context が「同じ画面の中で時間を遡れる」連続性が失われる
  - 実装規模が大きい割に UX 利得が案 C を超えない
- **位置付け**: 参考案。**採用しない**。

---

## 3. 推奨案と理由

**案 C 採用** (折りたたみ + sticky 日付ヘッダ + 一括コントロール)。

判断軸別の比較:

| 軸 | 案 A | 案 B | **案 C** | 案 D |
|----|----|----|----|----|
| オーナー要望 (UX 改善) | ◎ | △ (折りたたみ概念なし) | ◎ | △ (画面分離) |
| 実装規模 | M | L | **M〜L** | L |
| DEC-075 (scroll) との整合 | ◎ | × (全面書直) | **◎** | ◎ |
| DEC-076 (InputArea) との整合 | ◎ | ◎ | **◎** | ◎ |
| DEC-082 (session-scoped) との整合 | ◎ | ◎ | **◎** | ◎ |
| DEC-083 (meta) との整合 | ◎ | ◎ | **◎** | ◎ |
| 過去 message 遡及対応 | ◎ (DB created_at) | ◎ | **◎** | ◎ |
| search palette 統合 | ○ (要 +1 工数) | × (要書直) | **◎ (Phase 2)** | △ (Drawer 連携) |
| streaming 中干渉 | ◎ | ◎ | **◎** | △ |
| E2E regression 影響 | 小 | 大 | **小〜中** | 中 |

**根拠**:

1. **DB に `messages.created_at` が既にあり index 化されている** (`history.rs:357`) ため、過去 message の日付判定は DB 復元経路の `toChatMessage` の 1 行追加で完結
2. **DEC-075 の scrollIntoView / FAB との非干渉が完璧** — 折りたたみは collapsed chunk を unmount するだけで、expand 済 chunk 内の scroll 挙動は既存通り
3. **search palette 統合は実装容易** — `expandDateForMessageId` を 1 関数追加するだけで、`scrollTargetMessageId` 経路の前段に挿入可能
4. オーナー要望の「**必要な時に開いて確認**」を最も素直に表現
5. CEO への提示が容易 (既存 UI に日付ヘッダが追加されるだけ、視覚 diff が小さい)

---

## 4. UI/UX 詳細

### 4.1 日付ヘッダ

- **表記例** (`UserMessage.tsx:73-91` の `formatSentAt` と整合した日本語ロケール):
  - 今日: `今日 · 12 件` (左 chevron + 日付テキスト + 右件数)
  - 昨日: `昨日 · 8 件`
  - 同年: `4/29 (火) · 5 件`
  - 過去年: `2025/12/24 (水) · 14 件`
  - 件数は `displayItems` (tool group は 1 件カウント) ベース、tool-group の中の tool 個別は数えない (UX 一貫性)
- **icon**: `lucide-react` (アプリ既存) の `ChevronDown` (expanded) / `ChevronRight` (collapsed) — `MessageList.tsx:5` ですでに lucide-react を import 済
  - **注**: CLAUDE.md は Heroicons を Web の標準としているが、本アプリは Tauri Desktop で既に lucide-react 採用 (`MessageList.tsx:5`、`ArrowUp` / `Loader2` / `Sparkles`)、本 UI も統一のため lucide-react を踏襲
- **スタイル**: `text-xs text-muted-foreground`、左右 `px-3 py-1.5`、ヘッダ全体に `bg-background/90 backdrop-blur-sm border-b border-border/40`、cursor-pointer + `hover:bg-accent/30`
- **sticky**: `position: sticky; top: 0; z-index: 5`、scroll container の `overflow-y-auto` 内で sticky として効く
- **a11y**: `<button type="button" aria-expanded={isExpanded} aria-controls={"date-bucket-" + key}>` で wrap、ヘッダ内テキストは `<span>`

### 4.2 expand / collapse アニメーション

- framer-motion `<AnimatePresence initial={false}>` + `<motion.div>` で `height: 0 ↔ auto` トランジション (DEC-075 / DEC-076 と同方針)
- duration 0.18s, ease "easeOut" (`MessageList.tsx:391` の既存 transition と統一)
- `prefers-reduced-motion` 尊重 — DEC-076 で `useReducedMotion()` 統一済 (decisions L2464) なので、その hook を使い `transition: { duration: 0 }` に切替
- 「すべて展開 / 折りたたみ」一括トグル時はアニメーション抑制 (= 同時に多数 mount/unmount するため)

### 4.3 デフォルト state

- **session 初回表示時**: 「最後の message が含まれる日付」のみ expanded
  - 実装: `groupByDate(displayItems)` で生成された buckets のうち **最後の bucket key** を `expandedDateBuckets[sessionId]` 初期値にする
  - メッセージが 0 件の session は何もしない (empty state)
- **「今日 = 必ず expanded」ルール**: 新規送信は必ず「今日」の bucket、その bucket は expanded として作る (= store action `appendMessage` の post-effect で `expandedDateBuckets` に bucket key を add する。ただし「今日」が既に閉じられていた場合 = ユーザーが手動で閉じた場合は **尊重して開かない** か **新規送信があれば開く** かはオーナー判断要、推奨は後者「自分の発言は必ず見える」)
- **過去日付**: 一度 expand したらその session が開いている間 expanded を維持。session を切り替えてから再度同 session に戻ってきた時も persist 経由で復元

### 4.4 検索 / ジャンプとの統合 (Phase 2)

- search palette (`SearchPalette.tsx:210-225` `handleSelect`):
  - `loadSession` (DB から messages 復元) → `chat.scrollToMessageId` の **前段に `expandDateForMessageId(sessionId, messageId)`** を 1 行挿入
  - `expandDateForMessageId` は chat-display store の action で、当該 message の `timestamp` から日付 key を導出して `expandedDateBuckets[sessionId]` に追加 (idempotent)
  - その後既存の 120ms 遅延 scrollIntoView (`MessageList.tsx:202-218`) が正常動作 (target が DOM に mount された状態で query できる)
- DEC-075 FAB「直前 user ジャンプ」:
  - 既存実装 (`MessageList.tsx:324-344`) は `userMessageIds` Set + DOM 走査 → **collapsed 日付の message は DOM に居ない**ので「自然と skip」される
  - これはオーナー期待値とも一致 (折りたたみは「歴史を意図的に隠した」状態、そこに自動 jump で開かない方が自然)
  - 必要なら Phase 2 で「collapsed の場合は自動 expand」オプションを追加検討

### 4.5 streaming 中の挙動

- 新規送信は `appendMessage` (`chat.ts:698-716`) → user message が「今日」の bucket に追加 → bucket は必ず expanded (4.3 のルール)
- streaming 中の assistant message は `replaceStreamingMessage` (`chat.ts:736-752`) で content 更新、bucket 移動はない (timestamp は append 時に固定打刻)
- DEC-075 の「streaming 末尾追従」 (`MessageList.tsx:118-124`) と「完了時オートスクロール」 (`MessageList.tsx:140-199`) は両方とも expanded chunk 内での scroll なので **影響なし**
- 0 時跨ぎ: streaming 終了時刻が次の日に入ると assistant message の timestamp は append 時 = 今日のままなので bucket は変わらない (DB created_at と整合)。ユーザーが新規送信した瞬間に新日付 bucket が生成される

### 4.6 アクセシビリティ

- ヘッダ button: `aria-expanded`, `aria-controls`, `aria-label="2026年4月30日のチャット履歴を折りたたむ" or "展開する"` (動的)
- 折りたたみ中の content: `aria-hidden="true"` を `<motion.div>` に付与
- 一括コントロール: `<button aria-label="すべての日付を展開する">` / `<button aria-label="すべての日付を折りたたむ">`
- キーボード:
  - `Tab` で日付ヘッダにフォーカス可能
  - `Enter` / `Space` で toggle
  - chevron icon は `aria-hidden`
- フォーカスリング: 既存 Tailwind ring utility (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`) を流用
- screen reader ナビゲーション: 日付ヘッダを `<h3>` ではなく `<button>` にし、`<section role="region" aria-labelledby={"date-header-" + key}>` で sectioning content を構成 (chunk 単位の navigation がしやすくなる)

---

## 5. 実装ロードマップ

### Phase 0 (前提工事 — 必須、規模 S, ~0.5 日)

- `lib/stores/chat.ts:84-99` `ChatMessage` に `timestamp?: number` (epoch ms) を追加
- `lib/stores/session.ts:111-152` `toChatMessage` で `timestamp: m.createdAt * 1000` を伝搬 (DB は秒、frontend は ms 統一)
- `chat.ts` の以下 action で `timestamp: Date.now()` を打刻:
  - `appendMessage` (L698): user / assistant 新規時
  - `appendToolUse` (L778): tool message 生成時
  - `replaceStreamingMessage` (L736) は既存 message を更新するだけなので timestamp 変更不要
- `lib/stores/chat.test.ts` に timestamp 伝搬 unit test を 1 ケース追加

### Phase 1 (折りたたみ MVP — 規模 M, ~1 日)

**触るファイル:**

- 新規: `lib/stores/chat-display.ts` (or 別 dedicated store)
  - `expandedDateBuckets: Record<sessionId, string[]>` (yyyy-MM-dd の配列)
  - `toggleDateBucket(sessionId, dateKey)` / `expandDateForMessageId(sessionId, messageId)` (Phase 2 用) / `setAllExpanded(sessionId, dates)` / `setAllCollapsed(sessionId)`
  - persist key `"sumi:chat-display"`、version 1
  - session-preferences の persist パターンを踏襲 (createJSONStorage + window guard + migrate)
- 更新: `components/chat/MessageList.tsx`
  - `groupByDate(displayItems): DateGroup[]` を追加 (純粋関数、useMemo)
  - render 部 (L380-451) を `DateGroup` ループに変更、各 group は `<DateBucketHeader>` + 中身の motion.div 群
  - 既存の `<AnimatePresence>` + motion.div は bucket 内に保持
- 新規: `components/chat/DateBucketHeader.tsx` (sticky / collapsed UI)
- 更新: `lib/stores/chat.ts`
  - `appendMessage` の post-effect で「今日 bucket を expanded に追加」(chat-display 側を dynamic import で呼ぶ既存パターン踏襲、L520-527 / L1004-1010 と同じ流儀)

**Phase 1 で扱う range:**

- 静的日付ヘッダ (sticky なし、まず動作確認)
- 折りたたみ on/off
- デフォルト「最後の bucket のみ expanded」
- session-scoped persist
- prefers-reduced-motion 尊重

### Phase 2 (UX 強化 — 規模 M, ~1〜1.5 日)

- sticky 日付ヘッダ (`position: sticky; top: 0`)
- 「すべて展開 / 折りたたみ」一括コントロール (ChatPaneHeader 内 or MessageList 上部)
- search palette ヒット時の対象日付自動 expand (`SearchPalette.tsx:210` 修正)
- DEC-075 FAB との詳細整合 (もし regression が出れば)
- E2E spec 追加: `tests/e2e/chat-date-grouping.spec.ts`

### Phase 3 (将来拡張、別 DEC 候補)

- 仮想スクロール導入 (案 B 思想を再導入)
- session export / share に日付グルーピングを反映
- monitor / cost 集計を日別に出す

### persist migration 戦略

- 新規 store なので migration は最小 (`version: 1` から開始)
- 既存 user の localStorage には影響なし (key 別)
- chat.ts persist (version 2 → 据置) は触らない

---

## 6. 規模感と DEC 番号案

- **DEC 番号**: DEC-084 (DEC-083 の次)
- **対象バージョン**: v1.44.0 (Phase 1) → v1.45.0 (Phase 2)
- **総工数**: 2〜3 日 (Phase 0 + 1 + 2 を 1 PR か 2 PR に分割)
  - Phase 0: 0.5 日
  - Phase 1: 1 日
  - Phase 2: 1〜1.5 日

### 既存テスト影響

- `tests/e2e/chat.spec.ts` (129 行): 影響あり。「user message 表示」「assistant streaming」のアサートが `MessageList` 構造変更で壊れる可能性 → 最低限の修正想定 (data-msg-id 経由は維持されるので大半は通る)
- `tests/e2e/scroll-improvement.spec.ts` (290 行): **要注意**。`getScrollMetrics` が「`overflow-y-auto` の唯一の div」を辿る (L41-44)、bucket 構造を入れても scroll container は親 1 つに保つ前提なら影響なし。FAB テストも「expanded chunk 内の user」を target にする限り通る
- `tests/e2e/search-palette.spec.ts` (58 行): Phase 1 では search が collapsed bucket にヒットする可能性 → fixture 内の messages を Phase 1 ロード時に最後の bucket だけ expanded で生成する mock 状態にすれば通る。Phase 2 で `expandDateForMessageId` が入れば自然解消
- `lib/stores/chat.test.ts`: timestamp 伝搬の unit test 追加が必要
- 新規: `lib/stores/chat-display.test.ts` (toggle / expandFor / persist の vitest)
- 新規 E2E: `tests/e2e/chat-date-grouping.spec.ts` (Phase 2 で追加、最低 3 シナリオ: ヘッダクリック toggle / デフォルト最終 bucket expanded / 一括展開)

### 規模ラベル: **M** (Phase 1 単独) / **M〜L** (Phase 1 + 2 まとめて)

---

## 7. 不確実事項 (CEO 判断要)

1. **「今日」bucket を新規送信時に必ず expand するか？**
   - 推奨: **YES**。ユーザー自身の発言は必ず見える方が自然
   - NO の場合は「ユーザーが閉じた状態を尊重」するが、新規送信時に閉じたままだと混乱する懸念

2. **Phase 1 と Phase 2 を別 PR / 別 version で出すか、1 つにまとめるか？**
   - 推奨: **1 PR (v1.44.0)** で sticky と一括コントロールまで含める。Phase 2 の search 統合のみ別出し (= v1.45.0 with DEC-084 part-2) でも可

3. **search palette ヒット時、collapsed bucket を自動 expand するか？**
   - 推奨: **YES**。jump 先が見えない UX は壊れている

4. **FAB「直前 user にジャンプ」が collapsed bucket の user を skip する挙動は OK か？**
   - 推奨: **OK**。collapsed = 意図的に隠した歴史。skip が自然 (詳細は §4.4)

5. **仮想スクロール (案 B 思想) を将来課題として明示するか？**
   - 推奨: **YES**。Phase 3 候補として decisions に記録、ただし今回着手しない

6. **`prefers-reduced-motion` 時に sticky だけは残すか？**
   - 推奨: **YES** (sticky は CSS 固有挙動でアニメではない)

---

## 8. 副次効果

- **長時間 session の auditability 向上**: 「いつのやり取りか」が一目で見える、デバッグや過去発言レビューが容易
- **session export / share 機能 (将来) の布石**: 日付グルーピングが既にあれば export json も日別 chunk 化が自然 (claude.ai の Share と同等以上の UI に近づける)
- **monitor / cost 集計の日別表示の布石**: DEC-082 で session-scoped にした monitor を、さらに「session × 日別」で集計する将来機能 (DEC-X) で本実装の `groupByDate` 純粋関数が再利用可能
- **長 session の体感パフォーマンス改善**: 折りたたみで Markdown render を後回しにできるため、数百 turn session の初回描画が体感で軽くなる
- **a11y 強化**: section 構造 (date bucket = region) が screen reader navigation を改善
- **DEC-073 (Editor Slot) との将来の協調**: editor 側の tab-per-file パターンと、chat 側の bucket-per-date パターンが「コンテキスト集約 UI」として方向性が揃う (sumi の世界観の一貫性)

---

## 9. CEO への最終提案 (3 行サマリ + 着手判断要請)

- **実装可。推奨は案 C (折りたたみ + sticky 日付ヘッダ + 一括コントロール)、規模 M、想定 v1.44.0 (DEC-084)。**
- **前提工事として `ChatMessage.timestamp` の配線 (S, 0.5 日) を先行マージし、続けて Phase 1 (1 日) → Phase 2 (1〜1.5 日) で UX を仕上げる。DEC-075 / DEC-083 と非干渉で実装可能。**
- **CEO 判断要: §7 不確実事項 1〜3 (新規送信時 auto-expand / Phase 統合 / search 自動 expand) の方針確認。問題なければ着手 GO。**
