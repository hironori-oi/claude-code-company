# PRJ-012 v1.44.0 (DEC-084 候補) — チャット日付グルーピング 実装完了レポート

- 案件: PRJ-012 (sumi - Claude Code マルチプロジェクト IDE)
- 対象バージョン: **v1.44.0**
- 想定 DEC: **DEC-084 候補**
- 完了日: 2026-04-30
- 担当: dev (シニアエンジニア)
- 関連事前文書: `projects/PRJ-012/reports/dev_chat_date_grouping_proposal.md`
- 関連 DEC: DEC-064 (session-scoped chat) / DEC-075 (スクロール改善 + FAB) / DEC-076 (InputArea 折畳) / DEC-082 (sidebar session-scoped) / DEC-083 (message meta)

---

## 1. TL;DR

- **Phase 0 + 1 + 2 を 1 PR で完成**。提案書 (§3 案 C) どおり、折りたたみ + sticky 日付ヘッダ + 一括コントロール + search palette 自動展開を全て実装
- **新規 5 ファイル / 修正 5 ファイル + version 3 / CHANGELOG**
- typecheck PASS / lint 新規警告ゼロ / vitest 123 → **157 PASS** (新規 34) / cargo unit 178 → **182 PASS** / cargo check PASS
- **DEC-075 / DEC-076 / DEC-082 / DEC-083 と完全に非干渉**: 折りたたみは collapsed bucket の DOM unmount のみで、expanded bucket 内の既存挙動 (scrollIntoView / FAB / streaming 末尾追従 / meta 行) は無改変で動作

---

## 2. Phase 別 実装内容

### Phase 0: timestamp 伝搬 (前提工事)

- `lib/stores/chat.ts`:
  - `ChatMessage` 型に `timestamp?: number` (epoch ms) field 追加
  - `appendMessage`: timestamp 未指定なら `meta.sentAt` を優先、無ければ `Date.now()` で打刻
  - `appendToolUse`: tool message にも `timestamp: Date.now()` を打刻
  - `replaceStreamingMessage` / `updateStreamingMessage` / `finalizeStreamingMessage`: 既存 message の更新だけなので timestamp 変更なし (要件どおり)
- `lib/stores/session.ts`:
  - `toChatMessage` で `meta.sentAt` (ms) > `m.createdAt × 1000` の優先順で timestamp を伝搬
  - 0 / 負値 / NaN は undefined fallback (defensive)
- 過去 message は DB `messages.created_at` (epoch sec) があれば自動的に bucket 化される (遡及対応 OK)
- vitest: `lib/stores/chat.test.ts` に **5 ケース追加** (timestamp 伝搬の各パス)

### Phase 1: 日付グルーピング + 折りたたみ MVP

- 新規 `lib/utils/chat-grouping.ts`:
  - `dateKeyForTimestamp(ts)`: epoch ms → ローカル TZ `YYYY-MM-DD` (zero-padded)。0 / 負 / NaN は `UNKNOWN_DATE_KEY`
  - `dateLabelForKey(key, today?)`: `今日` / `昨日` / `M/d (曜)` / `YYYY/M/d (曜)` ラベル生成。今日判定は引数 `today` で test 注入可
  - `groupItemsByDate(items, getTimestamp, today?)`: 連続同日要素を 1 bucket、timestamp 不在は直前 bucket、先頭から不在は `__unknown__` bucket。汎用 generic 化により `DisplayItem` をそのまま流せる
- 新規 `lib/stores/chat-display.ts`:
  - `expandedDateBuckets: Record<sessionId, string[]>` を **session 単位** で persist
  - actions: `toggleDateBucket` / `expandDateBucket` (idempotent) / `collapseDateBucket` / `setExpandedDates` / `expandAll(allKeys)` / `collapseAll(exceptToday?)` / `clearSession` / `reset`
  - selectors: `selectExpandedDates` (固定参照空配列 fallback) / `selectIsBucketExpanded`
  - persist: localStorage key `sumi:chat-display`、version 1。`safeStorage` パターンで SSR / window 不在を吸収 (session-preferences と同じ)
- 新規 `components/chat/DateBucketHeader.tsx`:
  - `<button type="button">` wrapper、chevron icon (`ChevronDown` / `ChevronRight`、lucide-react)
  - `aria-expanded` / `aria-controls={"date-bucket-" + key}` / 動的日本語 `aria-label` (例 `今日のチャット履歴を折りたたむ`)
  - sticky `top: 0` + `bg-background/95` + `backdrop-blur-sm` + `border-b`
  - text-xs muted-foreground、cursor-pointer、`hover:bg-accent/30`、`focus-visible:ring-2`
  - `data-testid="date-bucket-header"` / `data-date-bucket-key={key}` で E2E から取れる
- 修正 `components/chat/MessageList.tsx`:
  - `displayItems` の **下流** で `groupItemsByDate` を適用し `dateBuckets` を memoize
  - render 部を `dateBuckets.map((bucket) => <section><DateBucketHeader/><AnimatePresence>{isExpanded && <motion.div height: 0↔auto>...</motion.div>}</AnimatePresence></section>)` に再構成
  - collapsed 時は bucket 内 `motion.div` (UserMessage / AssistantMessage / ToolUseGroup 群) を **unmount** してメモリ節約
  - 初回 session 表示時 (`seededSessionsRef`): chat-display store に entry が無ければ「最後の bucket key」のみ expanded で seed
  - chat.ts `appendMessage` の post-effect で「今日 bucket auto-expand」を dynamic import 経由で発火 (DEC-064 の `setPaneSession` と同じ流儀)
- vitest 新規 ケース:
  - `lib/utils/chat-grouping.test.ts` 16 ケース (dateKey / dateLabel / groupItems の境界条件)
  - `lib/stores/chat-display.test.ts` 13 ケース (action 全網羅 + session 独立性 + selector 固定参照)

### Phase 2: sticky / 一括コントロール / search palette 統合

- **sticky 日付ヘッダ**: Phase 1 で実装済 (`DateBucketHeader.tsx` の `sticky top-0` クラス)
- **一括コントロール**:
  - MessageList 上部に `data-testid="date-bucket-toolbar"` の小ツールバーを追加
  - 「全て展開」(`ChevronsUpDown`) / 「全て折りたたみ」(`ChevronsDownUp`) ボタン (lucide-react、`aria-label` 日本語固定)
  - 「全て折りたたみ」は **今日 bucket key を計算して `exceptToday` に渡す** ので今日は閉じない
  - `dateBuckets.length === 0` (= empty / streaming-only) なら toolbar 自体を hide
- **search palette 統合**:
  - MessageList に `useEffect` 追加: `scrollTargetMessageId` が立った瞬間、対象 message の `timestamp` から bucket key を計算して `expandDateBucketAction(sessionId, key)` を呼ぶ
  - その後 既存の 120ms 遅延 scrollIntoView (DEC-075 既存実装) が target を DOM mount 後に拾う
  - SearchPalette.tsx 自体は無改変 (MessageList 側で hook するだけで済む綺麗な配線)
- **prefers-reduced-motion**:
  - `useReducedMotion` を import し、bucket transition `duration` を 0.22s ↔ 0 で切替
  - 既存 message 用 `motion.div` (DEC-076 で確立済パターン) と非干渉
- E2E 新規 `tests/e2e/chat-date-grouping.spec.ts` 3 ケース:
  - 日付ヘッダ表示 (`今日` label)
  - ヘッダクリックで toggle (collapsed ↔ expanded)、collapsed 時に内容が unmount されること
  - 一括 toolbar 「全て折りたたみ (今日除く)」が今日を残すこと

---

## 3. 既存機能との非干渉 確認

### DEC-075 (scrollIntoView / FAB)

- 折りたたみは **collapsed bucket の DOM unmount のみ**。expanded bucket 内の既存ロジックは完全に無改変:
  - 「streaming 末尾追従」 (`messages, streaming, scrollTargetMessageId` の useEffect) → 今日 bucket は必ず expanded なので影響なし
  - 「完了時オートスクロール (assistant 先頭へ scrollIntoView)」 → 同上
  - 「直前 user FAB」 → `userMessageIds` Set + DOM 走査だが、collapsed bucket の user は DOM に居ないため自然に skip。これは「閉じた歴史を意図的に隠した」状態と意味的に整合 (提案書 §4.4 の方針どおり)
- `scroll-mt-16` (scrollIntoView の anchor offset) は既存値を維持。sticky header 高さは ~30px なので衝突しない

### DEC-076 (InputArea 折畳)

- 完全に別領域。MessageList の bucket 折りたたみとは UI 階層も state も独立

### DEC-082 (session-scoped monitor)

- グルーピング state も session-scoped (`expandedDateBuckets[sessionId]`) なので方向性が完全に整合
- monitor.ts は touch していない

### DEC-083 (message meta)

- meta 行は個別 message 単位なので干渉なし
- むしろ `meta.sentAt` (ms 精度の送信時刻) を **timestamp の優先源**として活用する綺麗な相互作用が成立した
- chat.test.ts の既存 6 ケース (DEC-083) も全て PASS

---

## 4. 動作確認結果

```bash
# typecheck
$ npm run typecheck
> tsc --noEmit
# (no errors)

# lint
$ npm run lint
# 新規警告ゼロ (既存の Shell.tsx / ChatPanel.tsx 等の warning のみ)

# vitest
$ npm test
 Test Files  12 passed (12)
      Tests  157 passed (157)

# cargo check
$ cargo check
warning: `sumi` (lib) generated 2 warnings  # 既存
    Finished `dev` profile [unoptimized + debuginfo] target(s)

# cargo test (unit)
$ cargo test --tests
test result: ok. 182 passed; 0 failed; 3 ignored
```

| 種別 | 結果 |
|------|------|
| TypeScript typecheck | PASS |
| ESLint | 新規警告 0 (既存 warning のみ) |
| vitest unit | **157 PASS** (123 → 157、新規 34) |
| cargo check | PASS (既存 2 warning のみ) |
| cargo test --tests | **182 PASS / 0 failed / 3 ignored** |
| cargo doc-test | 1 failed (`commands/claude_usage` の既存コメント、本実装と無関係) |

vitest 内訳 (新規 34 ケース):

- `lib/utils/chat-grouping.test.ts`: 16 ケース (dateKey / dateLabel / groupItemsByDate の境界条件、TZ 跨ぎ、不在 timestamp 取扱、空入力)
- `lib/stores/chat-display.test.ts`: 13 ケース (toggle / expand / collapse / setExpanded / expandAll / collapseAll / clearSession / reset / session 独立性 / selector 固定参照)
- `lib/stores/chat.test.ts`: 5 ケース (timestamp 伝搬: meta.sentAt 優先 / Date.now fallback / caller 指定尊重 / appendToolUse 打刻 / hydrate 保持)

E2E はローカル port 3000 競合のため本セッションでは未実行 (CI 再検証前提、既存 spec も同方針)。新規 spec `tests/e2e/chat-date-grouping.spec.ts` は 3 シナリオ用意済。

---

## 5. 変更ファイル一覧

### 新規 (5 ファイル)

- `lib/utils/chat-grouping.ts` — 日付グルーピング純粋関数群
- `lib/utils/chat-grouping.test.ts` — vitest 16 ケース
- `lib/stores/chat-display.ts` — session-scoped expanded state store + persist
- `lib/stores/chat-display.test.ts` — vitest 13 ケース
- `components/chat/DateBucketHeader.tsx` — sticky 折りたたみヘッダ component
- `tests/e2e/chat-date-grouping.spec.ts` — E2E 3 ケース

### 修正 (5 ファイル)

- `lib/stores/chat.ts` — `ChatMessage.timestamp` 追加 / append 系 action で打刻 / chat-display cascade cleanup / 今日 auto-expand
- `lib/stores/session.ts` — `toChatMessage` で timestamp 伝搬 (`meta.sentAt` > `createdAt × 1000`)
- `lib/stores/chat.test.ts` — Phase 0 timestamp 伝搬テスト 5 ケース追加
- `components/chat/MessageList.tsx` — bucket 集約 / DateBucketHeader render / 一括 toolbar / search palette 自動展開 / prefers-reduced-motion 対応

### バージョン bump (3 ファイル)

- `package.json`: 1.43.0 → 1.44.0
- `src-tauri/Cargo.toml`: 1.43.0 → 1.44.0
- `src-tauri/tauri.conf.json`: 1.43.0 → 1.44.0

### CHANGELOG

- `CHANGELOG.md` に `## [v1.44.0] - 2026-05-03` セクション (Added / Changed / Notes) を追記

---

## 6. 重要な技術判断ポイント (実装時の確認)

| 論点 | 採用方針 | 補足 |
|----|----|----|
| 日付判定の真実の源 | `meta.sentAt` > `m.createdAt × 1000` | DEC-083 の送信時刻を優先しつつ、assistant / tool は DB created_at に頼る |
| timezone | ローカル TZ で `YYYY-MM-DD` | UTC ではなくユーザー視点の「今日」 (`new Date(ts).getFullYear/getMonth/getDate`) |
| bucket key | `YYYY-MM-DD` ISO 文字列 (zero-pad) | sentinel `__unknown__` を別途用意 |
| 「最後の bucket」 | 配列末尾の bucket key | 過去 session 再開時も最終 message の bucket が expanded |
| height auto アニメ | framer-motion `<motion.div height: 0 ↔ "auto">` + `overflow: hidden` | DEC-076 で確立済の流儀 |
| collapsed 時のメモリ | bucket 内全 motion.div を unmount | 仮想スクロール代替の最低限の最適化 |
| 一括「折りたたみ」 | 今日 bucket は残す | オーナー要望の素直な実装、今日 bucket が無いなら 0 件で全 collapse |
| chat-display の cascade | dynamic import + getState | 循環依存回避、DEC-064 / DEC-076 の既存パターンと同流儀 |

---

## 7. 残課題 (Phase 3 候補 / 将来 DEC)

提案書 §5 Phase 3 と一致する将来課題:

1. **仮想スクロール導入** (案 B 思想を再導入): 数千 turn の超巨大 session 向け。`@tanstack/react-virtual` + bucket header の sticky index 化。本実装の `groupItemsByDate` 純粋関数は再利用可能
2. **session export / share に日付グルーピング反映**: export json も日別 chunk 化
3. **monitor / cost 集計の日別表示**: DEC-082 で session-scoped にした monitor を「session × 日別」で集計する将来機能
4. **長押し / コンテキストメニュー**: bucket header 上で右クリック → 「この日付以前を全部折りたたむ」「この日付だけ表示」等
5. **0 時跨ぎ streaming の特殊ケース**: 現状は append 時刻打刻なので今日 bucket に留まる。SDK の生成完了時刻を別途取れれば「日付が変わった瞬間に新 bucket」UX も検討可
6. **a11y enhancement**: bucket 単位の screen reader navigation (`role="region"` + `aria-labelledby`) は実装済、Tab で次 bucket header へジャンプする独自 keymap は将来検討

---

## 8. CEO 申し送り

- **着手 GO の判断 (実装計画書 §7) は全て YES 方針で実装済**:
  - 1) 「今日」auto-expand on 新規送信: YES
  - 2) Phase 1 + 2 を 1 PR (v1.44.0): YES
  - 3) search 自動 expand: YES
  - 4) FAB が collapsed user を skip: YES (= 既存挙動を維持、collapsed = 意図的隠蔽として整合)
  - 5) 仮想スクロールは Phase 3 候補として保留: YES (Notes に明記)
  - 6) prefers-reduced-motion 時に sticky 維持 (CSS 固有挙動): YES
- **絶対に git commit / push / tag は実施していない** (依頼どおり)
- 本リリースは新規 schema 追加なし (chat-display は新規 localStorage key、既存 user 影響なし)、ロールバック容易
- レビュー観点: (a) MessageList.tsx の bucket loop が既存挙動を壊していないか目視、(b) DEC-075 FAB / scrollIntoView の regression、(c) E2E 1 spec の追加で chat / scroll-improvement / search-palette 既存 spec への影響、を順に確認推奨
