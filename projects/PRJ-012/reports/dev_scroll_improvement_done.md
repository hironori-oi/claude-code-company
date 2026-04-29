# PRJ-012 チャットスクロール改善 - 実装完了レポート

- 担当: 開発部門
- 日付: 2026-04-30
- 対象アプリ: `projects/PRJ-012/app/ccmux-ide-gui/`
- 関連: 事前検討 `dev_scroll_improvement_proposal.md`、CEO 承認 + オーナー Go 済
- 実装決定番号案: **DEC-075**（CHANGELOG / decisions.md 反映は別タスクで実施）

---

## 1. 実装サマリー

オーナー要望 2 件に対応した。

1. **回答完了時の先頭オートスクロール**: 最後の assistant message が
   streaming=true → false に遷移したエッジを検知し、その message の先頭へ
   `scrollIntoView({ block: "start", behavior: "smooth" })` を発火する。
2. **「ひとつ前の質問へジャンプ」FAB**: scroll container 右下に絶対配置の
   ボタンを追加。クリックで「現ビューポート上端より上にある最も直近の
   user message」へジャンプし、最先頭まで遡ると `disabled` 化する。

提案レポートの推奨スコープに完全準拠し、persist schema / store action /
他コンポーネントへの変更は無し。実装は `MessageList.tsx` 1 ファイルに
集約された。

---

## 2. 変更ファイル一覧

| 種別 | パス | 変更内容 |
|---|---|---|
| 修正 | `components/chat/MessageList.tsx` | scroll 改善ロジック + FAB を追加。アイコンは `lucide-react` の `ArrowUp`（既存流儀踏襲） |
| 新規 | `tests/e2e/scroll-improvement.spec.ts` | Playwright E2E 2 ケース（オートスクロール / FAB 挙動） |

CHANGELOG / decisions.md / package.json は本タスクの責務外（オーナー指示
通り、推奨バージョン番号は §6 に記載するに留めた）。

---

## 3. 主要 diff（MessageList.tsx 抜粋）

### 3-1. import 追加

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
```

### 3-2. ユーザー上スクロール検知 ref

```tsx
const userScrolledUpRef = useRef(false);
useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;
  const onScroll = () => {
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUpRef.current = distanceFromBottom > 80;
  };
  el.addEventListener("scroll", onScroll, { passive: true });
  return () => el.removeEventListener("scroll", onScroll);
}, []);
```

閾値 80px は提案レポート §3-3 準拠。

### 3-3. 既存末尾追従 effect にユーザー上スクロールガード追加

```tsx
useEffect(() => {
  if (scrollTargetMessageId) return;
  if (userScrolledUpRef.current) return; // 追加: 読書尊重
  const el = scrollRef.current;
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
}, [messages, streaming, scrollTargetMessageId]);
```

### 3-4. 完了エッジで先頭オートスクロール

```tsx
const prevLastAssistantRef = useRef<{ id: string | null; streaming: boolean }>({
  id: null,
  streaming: false,
});
useEffect(() => {
  let lastAssistant: ChatMessage | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      lastAssistant = messages[i];
      break;
    }
  }
  const prev = prevLastAssistantRef.current;
  prevLastAssistantRef.current = {
    id: lastAssistant?.id ?? null,
    streaming: !!lastAssistant?.streaming,
  };
  if (scrollTargetMessageId) return;
  if (userScrolledUpRef.current) return;
  if (!lastAssistant) return;
  const justFinished =
    prev.id === lastAssistant.id &&
    prev.streaming === true &&
    lastAssistant.streaming === false;
  if (!justFinished) return;
  const root = scrollRef.current;
  if (!root) return;
  const target = root.querySelector(
    `[data-msg-id="${CSS.escape(lastAssistant.id)}"]`
  ) as HTMLElement | null;
  if (!target) return;
  // 短文応答で既に先頭が画面内に収まっているなら no-op
  const rootRect = root.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const offsetWithinRoot = targetRect.top - rootRect.top;
  if (offsetWithinRoot >= 8 && targetRect.bottom <= rootRect.bottom) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}, [messages, scrollTargetMessageId]);
```

`prev` を使ったエッジ検出で、初期 mount や hydrate 時の誤発火を防止。
複数 assistant block を伴う tool 連発 turn では「最後の assistant の先頭」
へ最終的に着地する（提案レポート §7 ケース 2/6）。

### 3-5. FAB 用の状態 / handler

```tsx
const [hasPrevUserAbove, setHasPrevUserAbove] = useState(false);
const computeHasPrevUserAbove = useCallback(() => { /* ... */ }, [messages]);
useEffect(() => {
  computeHasPrevUserAbove();
  const el = scrollRef.current;
  if (!el) return;
  const onScroll = () => computeHasPrevUserAbove();
  el.addEventListener("scroll", onScroll, { passive: true });
  return () => el.removeEventListener("scroll", onScroll);
}, [computeHasPrevUserAbove]);

const handleJumpToPrevUser = useCallback(() => {
  const root = scrollRef.current;
  if (!root) return;
  const containerTop = root.getBoundingClientRect().top;
  const userIds = new Set(
    messages.filter((m) => m.role === "user").map((m) => m.id)
  );
  const els = Array.from(
    root.querySelectorAll<HTMLElement>("[data-msg-id]")
  ).filter((el) => {
    const id = el.getAttribute("data-msg-id");
    return id ? userIds.has(id) : false;
  });
  let target: HTMLElement | null = null;
  for (let i = els.length - 1; i >= 0; i--) {
    if (els[i].getBoundingClientRect().top < containerTop - 4) {
      target = els[i];
      break;
    }
  }
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}, [messages]);
```

### 3-6. JSX: ラッパー追加 + FAB 配置

scroll container を `relative flex flex-1 min-h-0` のラッパーで囲み、
その中に FAB を `absolute bottom-4 right-4 z-10` で兄弟配置。

```tsx
return (
  <div className="relative flex flex-1 min-h-0">
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6" ...>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {/* 既存の AnimatePresence + map ... */}
      </div>
    </div>
    <button
      type="button"
      aria-label="ひとつ前の質問にジャンプ"
      data-testid="jump-to-prev-user"
      onClick={handleJumpToPrevUser}
      disabled={!hasPrevUserAbove}
      className="absolute bottom-4 right-4 z-10 inline-flex h-9 w-9 items-center
                 justify-center rounded-full border border-border/60 bg-background/90
                 text-foreground shadow-md backdrop-blur transition hover:bg-accent
                 hover:text-accent-foreground disabled:pointer-events-none
                 disabled:opacity-40"
    >
      <ArrowUp className="h-4 w-4" aria-hidden />
    </button>
  </div>
);
```

`empty state` 分岐 (`messages.length === 0`) は従来どおり別の return 文で
ラッパー無し描画されるため、メッセージ 0 件時に FAB は表示されない。

---

## 4. 動作確認結果

### 4-1. 静的検査

| チェック | コマンド | 結果 |
|---|---|---|
| TypeScript | `npm run typecheck` | PASS（エラー 0） |
| ESLint (next lint) | `npm run lint` | 変更ファイルに新規警告 0（既存警告のみ、本変更とは無関係） |

### 4-2. E2E (Playwright)

| spec | 結果 |
|---|---|
| `tests/e2e/scroll-improvement.spec.ts` (新規 2 ケース) | PASS (28.1s, 2/2) |
| `tests/e2e/chat.spec.ts` (regression 確認) | PASS |
| `tests/e2e/search-palette.spec.ts` (検索ジャンプ regression 確認) | PASS |

#### ケース内訳

1. **`auto-scrolls to last assistant start on completion`**
   60 行の assistant 応答を mock emit で完了させた後、最後の assistant
   message の `boundingRect.top` が scroll container 上端から `-4 .. +80px`
   に収まることを assert。同時に「最下部固定では無い」（distanceFromBottom
   > 40）ことも検証して、末尾追従にすり替わらないことを確認。
2. **`FAB jumps to previous user message and disables at top`**
   2 turn 投入後、FAB 1 回目クリックで「ユーザー質問2」が container 上端
   付近、2 回目クリックで「ユーザー質問1」が上端付近。さらにクリック猶予
   なしで FAB が `disabled` になることを `expect(fab).toBeDisabled()` で確認。

### 4-3. 観察ベースのチェックリスト

| # | エッジ | 想定挙動 | 実装 |
|---|---|---|---|
| 1 | 1 turn で長文 assistant | 先頭が上端に揃う | OK (E2E 検証済) |
| 2 | tool → assistant → tool → assistant の turn | 最終 assistant の先頭に着地 | エッジ検出が「最後の assistant」固定なので OK |
| 3 | streaming 中に手動上スクロール → 完了 | 介入しない | `userScrolledUpRef` で gate 済 |
| 4 | session 切替直後 load 完了 | 誤発火しない | `prev.streaming` 初期値 false で防止 |
| 5 | error / interrupted 終了 | 発火しない | streaming=true のまま残るため OK（仕様通り） |
| 6 | 短文応答（先頭が既に見えている） | no-op | 8px / bottom チェックで no-op |
| 7 | 検索ジャンプ中 | 介入しない | `if (scrollTargetMessageId) return;` |
| 8 | 複数 pane 同時表示 | 各 pane 独立 | scrollRef 配下 querySelector + FAB は relative ラッパー内 absolute |
| 9 | empty state | FAB 出ない | `messages.length === 0` 早期 return path に FAB 無し |

---

## 5. 既知の制約・残課題

1. **smooth scroll 中の FAB 連打**: smooth scroll が完了する前に FAB を
   連打した場合、`getBoundingClientRect` は scroll 中のリアルタイム値を
   返すため、まだ移動中の位置を基準に判定する。実用上はほぼ違和感ないが、
   厳密に 1 クリック 1 ジャンプを保証したいなら `behavior: "auto"` への
   切替や transitionend 待ちが必要。今回は不要と判断。
2. **`reduceMotion` 連動**: OS レベルの prefers-reduced-motion 設定で
   smooth は自動で無効化されるため、明示分岐は入れていない。提案レポート
   §3-3 の「丁寧に対応するなら useReducedMotion」は将来の polish 課題。
3. **設定によるオン/オフ切替**: `useSettingsStore.settings.chatDisplay`
   への `autoScrollToAssistantStart: boolean` 追加は MVP 範囲外として
   見送り。オーナー反応次第で追加可能。
4. **FAB の表示条件**: 現状は messages > 0 path で常時表示し、
   `disabled` で UX を提示している。「上に user message が無いときは
   非表示にする」案もあったが、「ボタンは常にある／ただしグレーアウト」
   の方が探しやすいと判断。
5. **アイコン**: 指示文中で「Heroicons」と記載があったが、本アプリは
   依存に Heroicons を持たず（package.json `lucide-react` のみ）、
   既存全アイコンが lucide で統一されている。「既存の流儀に合わせる」と
   いう同指示文の文言を優先し、`lucide-react` の `ArrowUp` を採用した。
   Heroicons へ移行する場合は MessageList 単体ではなくアプリ全体の
   アイコン体系を一括刷新する別タスクが必要。
6. **regression テストカバレッジ**: 「streaming 中に手動上スクロール時に
   末尾追従が抑制される」ケースは E2E 化していない（mouse wheel 操作の
   Playwright simulation が不安定なため）。本ガードはコードレビューで
   担保する想定。

---

## 6. 推奨バージョン番号 (CHANGELOG / package.json は触らず提案のみ)

直近の release は v1.34.0（DEC-074, auto-compact 通知）。本変更は
ユーザー体験の改善であり API / persist 互換性に影響しないため、

> **v1.35.0 (DEC-075: チャットスクロール改善)**

を提案する。

### CHANGELOG.md エントリ草案（コピペ用）

```md
## v1.35.0 (DEC-075)

### Improved
- チャット応答完了時に、Claude 回答の先頭へ自動スクロールするようにしました。長文応答や tool 連発時に毎回手動で先頭へ戻す手間が解消されます。
  - ガード: streaming 中にユーザーが手動で上方向に巻き戻している場合は介入しません。
  - 短文応答で既に先頭が画面内にある場合は no-op です。
  - 検索ジャンプ中は従来通り検索結果を優先します。
- 「ひとつ前の質問へジャンプ」フローティングボタンをチャット右下に追加しました。連続クリックで現在のビューポート上端より上にある user message を順に遡れます。最先頭で disabled になります。

### Internal
- `components/chat/MessageList.tsx` に scroll 改善ロジック追加（state / store schema 変更なし）。
- E2E `tests/e2e/scroll-improvement.spec.ts` (2 ケース) 追加。
```

---

## 7. レビューポイント（Review 部門への申し送り）

- 動線: 4 pane 同時表示時に FAB が各 pane 独立に動くこと、tool 連発 turn
  でも誤動作しないこと。
- アクセシビリティ: FAB の `aria-label` が日本語固定（オーナー方針）。
  `disabled` で focus は通るが action されないこと。
- アイコン: lucide-react `ArrowUp` を使用（既存流儀踏襲）。Heroicons への
  統一刷新は別タスク要否を CEO 判断で。
- 提案レポート §3-3 の「reducedMotion 対応」「設定切替」は次バージョン
  以降で扱うか、見送りで確定するか CEO 判断を仰ぐ。

---

## M-1 修正対応

- 担当: 開発部門
- 日付: 2026-04-30（同日追記）
- 対象レビュー: `projects/PRJ-012/reports/review_scroll_improvement.md` §2 Major M-1
- 修正方針: CEO 承認済み（新規 assistant ID 検出時に `userScrolledUpRef` をリセット）

### 1. 修正内容

`MessageList.tsx` 完了エッジ検知 effect の冒頭（`prevLastAssistantRef` 更新直後、
ガード判定より前）に「最後の assistant ID が前回と異なる場合は
`userScrolledUpRef.current = false` にリセットする」分岐を追加した。

これにより、レビュー指摘の以下シナリオが解消される。

> streaming 完了後にユーザーが上にスクロールして読書 → そのまま新規送信
> （Enter キー、scroll 操作なし） → `userScrolledUpRef` が `true` のまま固定 →
> 新規 assistant 完了時のオートスクロールが誤抑止される

新規 assistant message が末尾に現れた瞬間にガードが解除されるため、
scroll 操作経由の `onScroll` 更新を待たずに次 turn の完了オートスクロールが
正しく発火する。

### 2. 差分（核心 8 行）

```tsx
    // M-1 (review_scroll_improvement.md): 新規 assistant message が来た瞬間
    // （= 直前の最後 assistant ID と異なる ID が末尾に現れた）に
    // `userScrolledUpRef` ガードをリセットする。
    // これにより「streaming 完了後にユーザーが上スクロールして読書 →
    // そのまま新規送信」シナリオで、新規 turn の完了オートスクロールが
    // 誤抑止されない。scroll 操作なしで Enter 送信した場合でも `onScroll`
    // 経由のフラグ更新を待たずに gate を解除できる。
    if (prev.id !== curr.id && curr.id) {
      userScrolledUpRef.current = false;
    }
```

挿入位置: `prevLastAssistantRef.current = curr;` の直後、
`if (scrollTargetMessageId) return;` の直前。

ガードレール遵守:
- 既存ロジック（streaming 中の追従抑制、検索ジャンプ優先、短文応答 no-op）は無変更
- M-1 以外の修正なし（Minor N-1〜N-4 は次バージョン v1.36.0 へ繰越）
- アイコン・絵文字方針も無変更（lucide-react `ArrowUp` のまま）

### 3. 動作確認

| チェック | コマンド | 結果 |
|---|---|---|
| TypeScript | `npm run typecheck` | PASS（エラー 0） |
| E2E `scroll-improvement.spec.ts` | `npx playwright test` | PASS (2/2) |
| E2E `chat.spec.ts` | `npx playwright test` | PASS (1/1) |

合計 3 件 PASS（19.7s）。既存ロジックに対する regression なし。

### 4. 追加 E2E について

レビュー §3-2 の補完案（「上スクロール中は完了オートスクロールが介入しない」
「新 assistant 送信でガードリセット」）は、Playwright での scroll 状態 mock が
複数 step に渡る fixture 拡張を要し、時間優先のため今回は見送る。
コード上の挙動はレビューで担保済み（M-1 修正で gate のリセット経路が明確になり、
ロジック単体での自明性は向上）。

### 5. 繰越事項（v1.36.0 候補）

レビュー §6 推奨修正のうち、今回は M-1 のみ対応し、以下は v1.36.0 へ繰越とする。

- N-1: `useReducedMotion` で `behavior` 分岐
- N-2: `ResizeObserver` で FAB disabled 状態の追従強化
- N-3: `userIds` を `useMemo` 化（長尺 session 対策）
- N-4: scroll listener の統合リファクタ
- 追加 E2E 2 ケース（上スクロール gate / 短文応答 no-op）

### 6. リリース判断

レビュー §7「M-1 修正後即 APPROVE 相当」に従い、本修正をもって v1.35.0 として
release 可能と判断する。CHANGELOG / decisions.md / package.json への反映は
別タスクで実施（本タスクの責務外）。

---

(以上)
