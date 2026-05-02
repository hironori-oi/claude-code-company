# PRJ-012 v1.44.0 チャット日付グルーピング (DEC-084 候補) - 品質レビュー

- 案件: PRJ-012 (sumi - Claude Code マルチプロジェクト IDE)
- 対象バージョン候補: **v1.44.0** (DEC-084 候補)
- レビュー日: 2026-04-30
- 担当: review (シニアレビュアー)
- レビュー対象: dev による Phase 0 + 1 + 2 一括実装
- 一次資料:
  - 計画書: `projects/PRJ-012/reports/dev_chat_date_grouping_proposal.md`
  - 完了レポート: `projects/PRJ-012/reports/dev_v144_chat_date_grouping_done.md`

---

## 判定: **APPROVE** (条件: 下記 11 章 Minor 2 件は CHANGELOG 文言修正のみ、リリース前 1 分作業)

実装は計画書 (§3 案 C) を Phase 0/1/2 まとめて忠実に再現しており、最重要観点である **DEC-075 (scrollIntoView / FAB) との非干渉が完璧**。typecheck / vitest 157 PASS / Rust 182 PASS をローカル再走で確認。Critical / Major 指摘ゼロ、Minor 2 件のみ。

---

## 1. 仕様遵守 (計画書 § 2 案 C / § 4 UI/UX / § 5 ロードマップ)

### 1-A. Phase 0: timestamp 伝搬 — PASS

| 項目 | 計画書 | 実装 | 評価 |
|------|--------|------|------|
| `ChatMessage.timestamp?: number` 追加 (epoch ms) | 必須 | `lib/stores/chat.ts:112` で実装、JSDoc も完備 | OK |
| `toChatMessage` で `meta.sentAt` > `createdAt × 1000` の優先順 | §4 / §6 表 | `lib/stores/session.ts:146-157` で 3 段階 fallback (`meta.sentAt > 0` → `createdAt > 0` × 1000 → undefined) | OK |
| DB sec → ms 変換 | epoch sec → ms | `m.createdAt * 1000` 正しい | OK |
| append/streaming/persist 経路で timestamp 保持 | §5 Phase 0 | `appendMessage` (L731-737) は `meta.sentAt` を fallback `Date.now()` より優先、caller 既打刻なら尊重 / `appendToolUse` (L839, L852) は `Date.now()` で打刻 / `replaceStreamingMessage` / `updateStreamingMessage` / `finalizeStreamingMessage` は touch せず (要件どおり) | OK |
| 0 / 負値 / NaN 防御 | §6 表 | session.ts L153 `m.createdAt > 0`、chat-grouping.ts L38 で `Number.isFinite && ts > 0` 双方で防御 | OK |

**コメント**: `appendMessage` で `message.timestamp !== undefined` を先に判定する gate により、caller 側 (例えば DB hydrate を経由する `addMessagesToSession` 等) が既に timestamp を持っている場合は二重打刻されない設計。整合性◎。

### 1-B. Phase 1: グルーピング + 折りたたみ — PASS

| 項目 | 計画書 | 実装 | 評価 |
|------|--------|------|------|
| `groupMessagesByDate` 純粋関数 | §5 Phase 1 | `lib/utils/chat-grouping.ts:121-149` `groupItemsByDate<T>` として **generic 化**。`DisplayItem` をそのまま流せる優れた設計 | OK (拡張) |
| ローカル TZ 判定 | §4.1 | `new Date(ts).getFullYear/getMonth/getDate` でローカル TZ、UTC ではない | OK |
| 連続同日 1 bucket | §2 / §4 | L141-145 `last && last.key === key` で同 key 連結 | OK |
| `DateBucketHeader.tsx` の chevron / aria | §4.1 / §4.6 | `components/chat/DateBucketHeader.tsx` 全項目満たす。aria-expanded / aria-controls / 動的 aria-label / focus-visible:ring-2 | OK |
| collapsed 時 DOM unmount | §3 | MessageList L550-632 `<AnimatePresence initial={false}>{isExpanded && <motion.div>...}</motion.div>}</AnimatePresence>` で expanded 時のみ children mount。collapsed では完全 unmount | OK |
| 「今日」auto-expand on new send | §4.3 | chat.ts L754-772 で `appendMessage` 後に dynamic import 経由で `expandDateBucket(sessionId, todayKey)` を発火 | OK |
| 初回 「最後 message bucket」 expanded | §4.3 | MessageList L151-168 `seededSessionsRef` + `getState().expandedDateBuckets[sid]` 直接覗き、persist に既 entry が無ければ最後の bucket key だけ seed | OK (idempotent + persist 復元尊重) |

**重要な良設計**: seed ロジックが「persist の `expandedDateBuckets[sid]` が既に存在する」場合は触らない (L160-163) ことで、ユーザーが過去 session で「全部閉じた」状態を session 切替で消さずに復元する。計画書 §4.3 「session を切り替えてから再度同 session に戻ってきた時も persist 経由で復元」を正しく実現。

### 1-C. Phase 2: sticky + 一括 + search 統合 — PASS

| 項目 | 計画書 | 実装 | 評価 |
|------|--------|------|------|
| sticky `top-0 z-10 bg-background/95 backdrop-blur-sm` | §4.1 | `DateBucketHeader.tsx:73` クラス完全一致 (`sticky top-0 z-10 ... bg-background/95 backdrop-blur-sm`) | OK |
| 「全て展開」/「全て折りたたみ (今日除外)」 | §3 | MessageList L502-526 toolbar、L181-188 `handleCollapseAll` で `dateKeyForTimestamp(Date.now())` を計算して `hasToday ? todayKey : undefined` を渡す | OK |
| search palette ヒット auto-expand (SearchPalette 無改変) | §3 / §4.4 | MessageList L194-208 `useEffect` で `scrollTargetMessageId` を hook、`messages.find(...timestamp)` から bucket key を導出して `expandDateBucketAction` 呼出 → 既存 120ms 遅延 scrollIntoView (L307-323) に連鎖。SearchPalette.tsx 自体は完全無改変 (L210-225) | OK (設計が綺麗) |

**Search auto-expand のタイミング懸念は無し**: `<motion.div initial={{height: 0}}>` の DOM mount は初期 state でも即時行われる (height 0 のだけアニメ) ため、`expandDateBucketAction` 発火後 1 frame で children が DOM に存在し、120ms 後の `querySelector` は target を必ず拾う。

---

## 2. store 設計 (`lib/stores/chat-display.ts`)

| 項目 | 確認 | 評価 |
|------|------|------|
| `expandedDateBuckets: Record<sessionId, string[]>` | L40, L124 | OK (Set 互換の使い方を JSON 直列化のため配列化、コメント L20-22 で説明) |
| `toggleDateBucket` / `expandDateBucket` (idempotent) / `collapseDateBucket` | L126-165 | OK、`uniqueAdd` / `withoutKey` ヘルパで参照新生も最小限 |
| `expandAll` / `collapseAll(exceptToday)` / `setExpandedDates` | L167-214 | OK、`expandAll` は `Set<string>` で重複/空文字を排除 |
| `clearSession` (session 削除 cascade) | L216-223 | OK、chat.ts `purgeSessions` から呼ばれる |
| persist key `sumi:chat-display` v1 | L228-230 | OK、命名規約 `sumi:*` 統一 |
| safeStorage SSR fallback | L99-108 | OK (session-preferences と同パターン) |
| 固定参照空配列 fallback | L244-258 | OK (`Object.freeze(EMPTY_KEYS)`、React 19 + zustand getSnapshot 対策) |
| 空 sessionId / 空 dateKey の no-op | L128, L143, L156, L169, L188, L206, L218 | OK (test ケース「空 sessionId / 空 dateKey は no-op」もあり) |

`session-preferences.ts` の persist パターンを忠実に踏襲。**新規 store としての品質は本リポジトリ内既存 store と完全同等。**

---

## 3. ヘルパ品質 (`lib/utils/chat-grouping.ts`)

| 観点 | 評価 |
|------|------|
| 日付判定はローカル TZ の YYYY-MM-DD | OK (L41-43) |
| label 生成: 今日 / 昨日 / `M/d (曜)` / `YYYY/M/d (曜)` / `日付不明` | OK (L64-96) |
| 「今日」「昨日」の境界条件 (今日基準で +1/-1 day) | OK (L82-87) `setDate(today.getDate() - 1)` で月跨ぎ / 年跨ぎも自動正規化 |
| timestamp 不在 message の取扱 | OK (L130-136) 直前 bucket あれば組入れ、無ければ UNKNOWN bucket |
| timezone 境界 (23:59 → 00:01) | test ケース `localDate(2026, 4, 29, 23, 59)` vs `localDate(2026, 4, 30, 0, 1)` で別 bucket になることを検証済 (`chat-grouping.test.ts:150-159`) |
| empty input | OK (L126 で素直に `[]` を return、test L78-81) |
| 日跨ぎ streaming | streaming 中の delta 反映は既存 message を update するだけで timestamp 不変 → 既存 bucket に留まる (計画書 §4.5 と一致) |

**generic 化の利点**: `groupItemsByDate<T>(items, getTimestamp, today)` により `DisplayItem` (`single | tool-group`) のような discriminated union も同関数で処理できる。test では plain `Item` で検証、本実装では tool-group の場合 `item.messages[0]?.timestamp` を返すクロージャで対応 (MessageList L124-129)。

---

## 4. 既存機能との非干渉 (★最重要観点)

### 4-A. DEC-075 (scrollIntoView / FAB) — **完璧 OK**

「最優先で確認」の指示に対し、以下 5 経路を全て検証:

1. **streaming 末尾追従** (`MessageList.tsx:223-229`): `scrollTo({top: scrollHeight})` のみで bucket 構造に依存しない。今日 bucket は新規送信時 auto-expand なので必ず DOM 内、scrollHeight に正しく反映される。**影響なし**
2. **完了時オートスクロール (assistant 先頭へ scrollIntoView)** (`MessageList.tsx:245-304`): `root.querySelector([data-msg-id="..."])` で target を取得。今日 bucket は expanded 維持されるので target は DOM に存在。collapsed bucket の場合は target = null で no-op (安全に degrade)。**影響なし**
3. **FAB「直前 user にジャンプ」** (`MessageList.tsx:429-449`): `userMessageIds` Set + `querySelectorAll("[data-msg-id]")` で DOM 走査。collapsed bucket の user は unmount されているため自然に skip → 「閉じた歴史を意図的に隠した」意味と整合 (計画書 §4.4)。**意図通り**
4. **`hasPrevUserAbove` 再計算** (`MessageList.tsx:361-388`): scroll handler 内 DOM 走査も同様、collapsed user は scope 外。**影響なし**
5. **`scroll-mt-16`** (L576, L605): 既存値維持。sticky header 高さは tailwind `py-1.5 + h-3.5 icon + text-xs` から ~28-30px 程度、scroll-mt-16 (= 4rem ≒ 64px) は十分余裕がありヘッダ下に target が来る。**影響なし**

**追加検証**: 
- collapsed bucket toggle 直後の `scrollHeight` 急減 → `userScrolledUpRef` の判定 (`distanceFromBottom > 80`) が一時的に true になりうるが、L398-401 `useEffect(scheduleRecompute, [scheduleRecompute, messages])` で messages 変化時のみ recompute。bucket toggle は messages 変化なしなので独自の recompute は走らない。これは scroll listener (`onScroll`) からの recompute に任せる設計で、sticky scroll position が大きく動いた場合のみ自然に recompute される。**実害なし** (toggle 直後に streaming も無いため)。
- 「ユーザーが今日 bucket を手動 collapse → 新規送信」: `appendMessage` post-effect で `expandDateBucket(sessionId, todayKey)` が dynamic import で発火し今日 bucket は再 expand される (L754-772)。「自分の発言は必ず見える」要件を満たす。

### 4-B. DEC-076 (InputArea 折畳) — OK

完全に別領域 (MessageList と InputArea は同列 sibling、state も独立)。干渉一切なし。

### 4-C. DEC-082 (session-scoped monitor) — OK

`expandedDateBuckets[sessionId]` が session 単位で persist され、DEC-082 の方向性と完全一致。`monitor.ts` は touch されていない。

### 4-D. DEC-083 (message meta) — OK + **設計の協調が綺麗**

- meta 行 (UserMessage 内の小さい時刻 / model 表示) は個別 message 単位で独立 → bucket 構造と非干渉
- `meta.sentAt` (DEC-083 で打刻された送信時刻 ms) を **timestamp の優先源**として使うことで、user message の「送信時刻」が日付判定に正しく反映される (DB の `created_at` は server-side 受信時刻なので、稀に翌日の 0:00 に跨ったケースで打刻意図とずれる可能性があったのが解消)。
- chat.ts の DEC-083 既存 6 ケースは vitest で全 PASS、回帰なし。

---

## 5. UI / UX (アニメ / a11y)

### 5-A. 表示 — OK

- ヘッダ表記: `今日 · 12 件` / `昨日 · 8 件` / `4/30 (水) · 5 件` / `2025/12/24 (水) · 14 件` (`DateBucketHeader.tsx:81-83`、`chat-grouping.ts:64-96`)
- chevron icon: lucide `ChevronDown` (expanded) / `ChevronRight` (collapsed) — オーナー方針 (Heroicons は Web 標準、本アプリは Tauri Desktop で lucide-react 統一) と整合
- subtle background: `bg-background/95 backdrop-blur-sm border-b border-border/40` (L73)
- text-xs muted-foreground: ✓ (L73)
- sticky z-index: `z-10` (FAB と同じだが視覚的に重ならない、L70 コメント参照)

### 5-B. アニメーション — OK

- framer-motion `<AnimatePresence initial={false}>` + `<motion.div height: 0 ↔ "auto">` (MessageList L550-560)
- `useReducedMotion()` で reduced 時 `duration: 0` (L172, L479-481) — DEC-076 既存パターン踏襲
- bucket transition の `easeOut` 0.22s も既存 motion.div (内 message 用 duration 0.18s) と整合

### 5-C. アクセシビリティ — OK

- `aria-expanded` (動的) / `aria-controls={"date-bucket-" + key}` / `aria-label` 動的日本語 (例: `今日のチャット履歴を折りたたむ`)
- `<button type="button">` ネイティブで Tab focus + Enter/Space 動作
- chevron `aria-hidden`
- `<section aria-labelledby={"date-bucket-header-" + key}>` で bucket level の sectioning content (MessageList L532-538)
  - **微小な Minor (M-1)**: `aria-labelledby` の参照先 id (`date-bucket-header-${key}`) が `DateBucketHeader.tsx` の `<button>` に attach されていない (現状は `id` 指定なし、`aria-controls` だけ)。screen reader が aria-labelledby を辿った先で element が見つからない。**実害は限定的**だが a11y 厳密性のため、DateBucketHeader に `id={`date-bucket-header-${dateKey}`}` を追加するのが望ましい。Phase 3 / 別 PR で十分。
- `focus-visible:ring-2 focus-visible:ring-ring` (L73)
- 一括 toolbar の aria-label も日本語 (`全ての日付を展開する` / `全ての日付を折りたたむ (今日を除く)`)

---

## 6. コード品質 (Critical / Major / Minor)

### Critical: 0 件

### Major: 0 件

### Minor: 2 件

- **M-1 (a11y, 任意修正)**: `MessageList.tsx:534` `aria-labelledby={`date-bucket-header-${bucket.key}`}` が指す id が `DateBucketHeader.tsx` の `<button>` に未付与。修正 1 行: `<button id={`date-bucket-header-${dateKey}`} ...>`。リリース前 1 分対応推奨だが必須ではない。
- **M-2 (CHANGELOG 文言)**: `CHANGELOG.md:71` の vitest 件数が「**約 138 ケース PASS 想定**」と書かれているが、実際の最終結果は **157 ケース PASS** (本レビューで再走確認)。実装途中の見積もりが残ったまま。リリース前に `157 ケース PASS` に更新するのが望ましい。

### 良かった点 (positive callouts)

- **設計の綺麗さ**: SearchPalette を無改変のまま MessageList 側で `scrollTargetMessageId` を hook して bucket auto-expand する分離が秀逸。SearchPalette 単体で他用途 (将来の jump 元追加) が壊れない。
- **generic helper**: `groupItemsByDate<T>` の generic 化により `DisplayItem` をそのまま流せ、tool-group 含めた汎用処理が 1 箇所で完結。
- **dynamic import + getState の循環依存回避**: `chat.ts` から `chat-display.ts` を呼ぶ経路を全て `dynamic import + getState` で統一 (L687-695, L760-771)。DEC-064 / DEC-076 既存パターンと一貫。
- **defensive な timestamp バリデーション**: `Number.isFinite && ts > 0` を session.ts / chat-grouping.ts 双方で重ねて、0 / 負値 / NaN を漏れなく弾く。
- **persist 既存 entry 尊重の seed**: `seededSessionsRef` + `getState()` 直接覗きで「persist 復元」と「初回 seed」を競合なく同居させた hook。

---

## 7. テストカバレッジ

### vitest (本レビューで再走確認)

```
 Test Files  12 passed (12)
      Tests  157 passed (157)
   Duration  1.02s
```

| ファイル | ケース数 | カバー範囲 |
|--------|--------|---------|
| `lib/utils/chat-grouping.test.ts` | 16 | dateKeyForTimestamp / dateLabelForKey / groupItemsByDate の境界条件 (TZ 跨ぎ / unknown / 0 / 負 / NaN / 不在 / 空入力 / 重複 / 今日昨日識別) |
| `lib/stores/chat-display.test.ts` | 13 | 全 action (toggle / expand / collapse / setExpanded / expandAll / collapseAll(exceptToday) / clearSession / reset) + session 独立性 + selector 固定参照 + 空 id no-op |
| `lib/stores/chat.test.ts` | 11 (5 新規) | timestamp 伝搬: meta.sentAt 優先 / Date.now fallback / caller 指定尊重 / appendToolUse 打刻 / hydrate 保持 |

**カバレッジ評価**: chat-grouping は境界 8 種を網羅、chat-display は action 全 8 種 + selector を網羅、不足なし。**chat.ts 既存 6 ケース (DEC-083) も全 PASS** で回帰ゼロ。

### typecheck

```
$ npx tsc --noEmit
(no output, exit 0)
```

PASS 確認。

### cargo test

完了レポート参照: 182 PASS / 0 failed / 3 ignored (Rust schema 変更なし、本実装と無関係の `commands/claude_usage` doc-test 1 件 fail は既存)。本レビューで Rust 側は再走未実施だが、touched files が `lib/**`, `components/**`, `tests/e2e/**` のみで Rust source 改変ゼロのため信頼可能。

### E2E

新規 `tests/e2e/chat-date-grouping.spec.ts` 3 シナリオ (ヘッダ表示 / toggle / 一括 toolbar) を確認。各シナリオが `data-testid="date-bucket-header"` / `"date-bucket-toolbar"` を使い実装 component と整合。ローカル port 競合で skip は許容、CI 再検証前提。

---

## 8. 副作用・エッジケース

| ケース | 確認 | 結果 |
|------|------|------|
| timestamp 不在 message が前 message と同 bucket | chat-grouping.ts L130-136 | OK |
| 過去 message (DB created_at あり) の遡及対応 | session.ts L154 `m.createdAt * 1000` | OK |
| streaming 中に日が変わる稀ケース | `replaceStreamingMessage` は timestamp 不変 → 既存 bucket 留まる | OK (計画書 §4.5 と一致) |
| session 切替時の expanded state 復元 | persist `sumi:chat-display` + `seededSessionsRef` の persist 既存 entry 尊重 | OK |
| search palette からのジャンプで auto-expand → scrollIntoView の timing | motion.div は initial state でも即時 mount、120ms 後 querySelector で target 拾える | OK |
| 「全て折りたたみ (今日除外)」で今日が末尾でない session | `dateBuckets.some(b => b.key === todayKey)` で hasToday を判定、今日 bucket が dateBuckets に存在する場合のみ exceptToday 効く (MessageList L184-188) | OK |
| 0 時跨ぎ streaming | timestamp は append 時固定 (`Date.now()` 打刻)、新規送信があった瞬間に新 bucket 生成 | OK |
| 複数 pane で同じ session を表示 | `expandedDateBuckets[sessionId]` は session 単位なので 2 pane で同じ展開状態を共有 (DEC-064 の「session が source-of-truth」と整合) | OK (意図通り) |
| 空 session (messages 0 件) | MessageList L451-472 empty state 別 path、toolbar / bucket 描画なし | OK |
| streaming-only state (messages = 0、streaming = true) | dateBuckets 空 → toolbar hide (L502 ガード)、`<Loader2>` の「考え中...」のみ描画 | OK (L636-647) |
| 1 session で同じ日付が非連続 (ユーザーが日付を巻き戻す session import 等) | groupItemsByDate は連続性で判定 → 同日 key の bucket が 2 つ並ぶ。test L161-174 で意図的に検証済 | 仕様通り (現実には DB ASC sort で発生しない) |

---

## 9. リリース準備

| 項目 | 確認 | 評価 |
|------|------|------|
| `package.json` v1.44.0 | L3 | OK |
| `src-tauri/Cargo.toml` v1.44.0 | L3 | OK |
| `src-tauri/tauri.conf.json` v1.44.0 | L4 | OK |
| 3 version ファイル一致 | grep 結果一致 | OK |
| CHANGELOG `## [v1.44.0] - 2026-05-03` | L14 | OK (release.yml awk pattern `## [$TAG_NAME]` と整合) |
| Added / Changed / Notes セクション完備 | L16-74 | OK (Notes に DEC-075 / DEC-076 / DEC-082 / DEC-083 非干渉まで明記) |
| persist 新規 key `sumi:chat-display` v1 | chat-display.ts L228-230 | OK (既存 user 影響なし、ロールバック容易) |
| Rust schema 変更なし | history.rs touch なし | OK |
| 新規 file 6 / 修正 4 / version 3 / CHANGELOG | git status 整合 | OK |

**Minor 修正推奨 (M-2)**: CHANGELOG L71 の `約 138 ケース PASS 想定` を `157 ケース PASS` に修正。

---

## 10. Phase 3 への引き継ぎ評価

完了レポート §7 の Phase 3 候補は計画書 §5 Phase 3 と一致しており、申し送り完備:

1. 仮想スクロール導入 (`@tanstack/react-virtual` + bucket header sticky index 化) — `groupItemsByDate` 純粋関数は再利用可
2. session export / share への日付グルーピング反映
3. monitor / cost の日別集計
4. bucket header の context menu
5. 0 時跨ぎ streaming の特殊 UX
6. bucket level keyboard navigation

本実装は generic helper / session-scoped store / persist 設計のいずれも Phase 3 拡張に開かれている。

---

## 11. 推奨修正

### リリース前 (任意、合計 ~2 分)

- **M-1**: `DateBucketHeader.tsx` の `<button>` に `id={`date-bucket-header-${dateKey}`}` を追加。MessageList の `aria-labelledby` の参照先を実体化。
- **M-2**: `CHANGELOG.md` L71 の `約 138 ケース PASS 想定` を `157 ケース PASS (vitest), 182 ケース PASS (cargo)` に更新。

### Phase 3 候補 (任意)

- bucket level の Tab keyboard navigation (header → 次 header にジャンプする keymap)
- collapsed bucket の user に FAB が当たった時の「自動展開して jump」オプション (現状は skip 、スイッチで切替可能に)

---

## 12. 最終判断と CEO への報告

**判定: APPROVE**

- Critical / Major 指摘ゼロ、Minor 2 件のみ (CHANGELOG 文言修正と a11y 微調整、いずれもリリース前 1-2 分の任意修正)
- 計画書 §3 案 C を Phase 0/1/2 完全網羅、quality gate 全項目通過
- vitest 157 PASS / typecheck PASS をローカル再走で確認、回帰ゼロ
- **DEC-075 (scrollIntoView / FAB) との非干渉が完璧** — collapsed unmount だけで expanded 内挙動を一切壊さず、search palette → bucket auto-expand → scrollIntoView の連鎖タイミングも framer-motion `initial={{height:0}}` の即時 mount 性質により安全
- 設計の綺麗さ (SearchPalette 無改変 / generic helper / dynamic import 循環依存回避) は本リポジトリ既存パターンを尊重しつつ拡張性も担保

CEO へは「**v1.44.0 (DEC-084 候補) リリース推奨。Minor 2 件は文言修正レベルで blocker ではない。タグ打ち前に CHANGELOG L71 のテスト件数だけ 157 に更新を依頼**」として申し送り。
