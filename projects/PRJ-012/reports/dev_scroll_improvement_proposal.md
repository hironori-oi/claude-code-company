# PRJ-012 チャットスクロール改修 - 実装可否検討レポート

- 担当: 開発部門
- 日付: 2026-04-30
- 対象アプリ: `projects/PRJ-012/app/ccmux-ide-gui/`
- 対象 PRJ: PRJ-012 (sumi - Claude Code マルチプロジェクト IDE)

---

## 1. 要望サマリー

オーナーから以下 2 点の改善要望:

1. **回答先頭オートスクロール**: Claude の回答が完了した時点で、現状は最下部までスクロールされるため毎回手動で先頭に戻す必要がある。回答完了時に「Claude 回答の先頭」へ自動スクロールしてほしい。
2. **直前の質問へジャンプボタン**: 「ひとつ前の自分の質問」へワンクリックで戻れるボタンを追加してほしい。

両者とも「長文応答や tool 連発時のスクロール疲労を減らす」ことが本質的な目的。Cursor 切替難民を解消する PRJ-012 の核心価値（Slack 風 rail + 完全 session 分離）に対し、**読み手の認知負荷低減**という直交軸での体験向上要望。

---

## 2. 現状実装の調査結果

### 2-1. スクロールコンテナと制御ロジック

`components/chat/MessageList.tsx` 1 ファイルにスクロール責務が集約されている。

- スクロールコンテナ: `MessageList` ルートの `<div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">`（L165-173）
- 自動末尾追従: `useEffect` で `messages` / `streaming` / `scrollTargetMessageId` を依存にし、毎回 `el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })` を実行（L107-112）
- 検索ジャンプ: `scrollTargetMessageId` がある間は末尾追従を抑制し、`querySelector('[data-msg-id="..."]').scrollIntoView({ behavior: "smooth", block: "center" })`（L115-131）
- ハイライト: `highlightedMessageId` を 4 秒後に自動クリア。orange ring overlay（L133-139, L208）

**重要観察**:
- ユーザーが手動で上にスクロールしているかを検知する処理は **存在しない**。streaming delta が来るたびに末尾へ強制追従するため、長文応答の途中で読み返そうと上にスクロールしても、次の delta で最下部へ引き戻される（既存の小さな UX 痛点）。
- `el.scrollTo({ top: scrollHeight })` は `messages` 配列の参照変更ごとに発火する。streaming delta 1 件ごとに `sessionMessages[sid]` が新しい配列で書き戻されるため、実質「streaming 中は毎フレーム末尾追従」と等価。
- 各メッセージに `data-msg-id={m.id}` 属性が付与済（L200）。pane scoped query もすでに整備されているため、メッセージへの個別 scrollIntoView インフラは流用可能。

### 2-2. メッセージ描画の DOM 構造

```
<div ref={scrollRef} class="flex-1 overflow-y-auto px-4 py-6">      // scroll container
  <div class="mx-auto flex max-w-3xl flex-col gap-4">
    <AnimatePresence>
      <motion.div data-msg-id="..." class="scroll-mt-16 ...">       // 1 message wrapper
        <UserMessage|AssistantMessage|ToolUseCard ... />
      </motion.div>
      <motion.div ...>                                              // tool group
        <ToolUseGroup messages={...} />
      </motion.div>
      ...
    </AnimatePresence>
    {streaming && !messages.some(streaming) && <Loader2 />}         // 考え中インジケータ
  </div>
</div>
```

- すべての message wrapper は `scroll-mt-16` を持ち、scroll-margin-top 4rem 確保（ヘッダー被り回避用、検索ジャンプ用に既設）。
- `role` は `"user" | "assistant" | "tool"`。tool は `showToolDetails === false` のとき `tool-group` に折り畳まれる。

### 2-3. ストリーミング完了の検知方法

`hooks/useAllProjectsSidecarListener.ts` が sidecar event を受信し、`chat store` の action を呼ぶ。完了の判定点が複数あるが、**いずれも最終的に**:

1. `result` event (L422-438): 残 streaming assistant を `finalizeStreamingMessage` で確定 → `setSessionStreaming(sessionId, false)` → `setSessionActivity({ kind: "complete" })`
2. `done` event (L469-483): 同上
3. `error` / `interrupted`: streaming を false に戻すが、最終アシスタント応答が完成しているとは限らない

`chat.ts` の `finalizeStreamingMessage`（L634-656）は `messages.map` で対象 message の `streaming: false` 化を行う。**この瞬間が「Claude 回答 1 件分が確定した時点」**。

ただし、Claude SDK が 1 turn 内で複数の assistant メッセージを返すケース（tool 呼び出し → 続きの assistant text）もあり得るため、「直近の確定 assistant」または「streaming flag が false に落ちた瞬間の最後の assistant」を target にするのが素直。

### 2-4. 既存の関連インフラ

- `useChatStore.scrollToMessageId(paneId, messageId)`（chat.ts L857-866）: `scrollTargetMessageId` と `highlightedMessageId` を同時 set する既存 API。SearchPalette が利用中。
- `clearScrollTarget(paneId)` / `clearHighlight(paneId)`: それぞれ MessageList 側 effect で 120ms / 4000ms 後に呼ばれる。

新規にイベントを増やさず、この既存 API を**拡張または別系統で再利用**できる。

---

## 3. 要望 1: 回答先頭オートスクロール

### 3-1. 実装可否

**実装可能**（小〜中規模）。既存の `data-msg-id` + `scrollIntoView` インフラがそのまま流用できる。

### 3-2. 推奨実装方式

#### 方針 A（推奨）: `MessageList` 側で「streaming → 完了」遷移を検知して assistant 先頭にジャンプ

`MessageList.tsx` の useEffect を 1 つ追加:

```tsx
// 直前 render 時の「最後の assistant message id とその streaming 状態」を ref で覚える
const prevLastAssistantRef = useRef<{ id: string | null; streaming: boolean }>({
  id: null,
  streaming: false,
});

useEffect(() => {
  // 検索ジャンプ中は介入しない
  if (scrollTargetMessageId) return;

  // 末尾の assistant message を取得（tool は無視）
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const prev = prevLastAssistantRef.current;
  prevLastAssistantRef.current = {
    id: lastAssistant?.id ?? null,
    streaming: !!lastAssistant?.streaming,
  };

  // 「同じ assistant id がさっきまで streaming=true、今 streaming=false」= 完了の瞬間
  const justFinished =
    !!lastAssistant &&
    prev.id === lastAssistant.id &&
    prev.streaming === true &&
    lastAssistant.streaming === false;
  if (!justFinished) return;

  // 自 pane scope で対象を取得して先頭へ
  const root = scrollRef.current;
  if (!root) return;
  const target = root.querySelector(
    `[data-msg-id="${CSS.escape(lastAssistant.id)}"]`
  ) as HTMLElement | null;
  if (!target) return;

  // 「下方向スクロール抑止」のためのユーザー意図チェック（後述）を入れる場合はここで分岐
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}, [messages, scrollTargetMessageId]);
```

**ポイント**:
- streaming = true → false の **エッジ検知** にすることで、初期マウント時や hydrate 時に誤発火しない。
- `block: "start"` で回答カードの上端をビューポート上端付近に揃える。
- `scroll-mt-16` がすでに付与されているのでヘッダー被りは回避済。
- 末尾追従 useEffect (L107-112) は streaming 中・通常会話時の自然な追従を残しつつ、本 effect が完了瞬間に上書きする形でレースは起きない（`scrollTo` の smooth は上書き発火で目的地が更新されるため、最終的に「先頭」へ収束する）。

#### 方針 B（代替）: `useAllProjectsSidecarListener` の `result` / `done` ハンドラから直接 `scrollToMessageId` を呼ぶ

- メリット: state 駆動 effect ではなく event 駆動なので、エッジ判定が不要で素直。
- デメリット: 既存の `scrollToMessageId` は `block: "center"` + 4 秒ハイライト前提のため、専用の挙動を別 action として追加する必要がある（ハイライトは要望にないため不要）。
- **推奨は方針 A**。理由: 「オーナーが見ている session のみが該当 pane に表示される」ため、view 層で完結させるほうが pane / session 切替時の整合性が取りやすく、ハイライトとも疎結合に保てる。

### 3-3. UX 考慮事項

オーナー要望「読むのに毎回上に戻すのが面倒」をストレートに満たすが、以下のエッジを設計に組み込みたい。

1. **ユーザーが回答完了前に手動で上方へスクロールしていた場合の介入抑制**（推奨追加）
   - `scrollRef.current` に scroll 監視を 1 個追加し、`scrollHeight - scrollTop - clientHeight > 80px` のとき `userScrolledUp = true` にする。
   - 完了 effect 内で `userScrolledUp === true` なら `scrollIntoView` を呼ばない（読みたい場所を尊重）。
   - 完了の瞬間に `false` にリセット。
   - これがないと「オーナーが streaming 中に上のメッセージを見ていたら、完了時に勝手に最新応答へ飛ぶ」副作用が出る。

2. **回答が極めて短く、すでに先頭が見えている場合**
   - `target.getBoundingClientRect().top` がすでに container の見える範囲内なら no-op で良い。`scrollIntoView` は同位置でも一瞬アニメーションが入るため、`Math.abs(top - 0) < 8` 等で early return が望ましい。

3. **設定でオン/オフ切替**（推奨だが MVP では不要）
   - 既存 `useSettingsStore.settings.chatDisplay` に `autoScrollToAssistantStart: boolean` を追加すれば、好み別れ対応が可能。MVP では「常時 ON」で出して、要望が来たら追加でも良い（実装は些末）。

4. **`reducedMotion` 対応**
   - `behavior: "smooth"` は OS 設定で自動 disable されるため、明示対応は不要だが、`window.matchMedia("(prefers-reduced-motion: reduce)")` で `behavior: "auto"` 切替を入れると丁寧。既存 ChatPanel が `useReducedMotion` を使っているため踏襲しやすい。

---

## 4. 要望 2: 直前の質問へジャンプボタン

### 4-1. 実装可否

**実装可能**（小規模）。`messages` 配列を逆走して `role === "user"` を順次選べばよく、既存 `scrollIntoView` インフラで十分。

### 4-2. UI 配置案

#### 案 A（推奨）: 右下の Floating Action Button（FAB）

- 場所: `MessageList` の scrollRef コンテナ内、絶対配置で右下（input area 上部 16px 程度）。
- アイコン: `lucide-react` の `ArrowUp` または `ArrowUpToLine`（`Sparkles` などすでに利用中）。
- 表示条件: `messages` に `role === "user"` が 1 件以上あり、かつ「直近のユーザー質問より下にスクロールされている」ときのみ表示（過剰露出回避）。それ以外は CSS opacity で fade-out。
- aria-label: 「ひとつ前の質問にジャンプ」。

```tsx
<button
  type="button"
  aria-label="ひとつ前の質問にジャンプ"
  onClick={handleJumpToPrevUser}
  className="absolute bottom-4 right-4 rounded-full bg-primary/90 p-2 text-primary-foreground shadow-lg backdrop-blur hover:bg-primary"
>
  <ArrowUp className="h-4 w-4" aria-hidden />
</button>
```

#### 案 B: ChatPaneHeader にツールバーボタンとして追加

- 既存ヘッダ右側のアイコン群に並べる。常時表示で予測可能だが、視線距離が遠く、スクロール中の親指距離も悪い（チャット主操作は下部）。

#### 案 C: メッセージ間のインライン矢印（GitHub PR 風）

- 各 user message のすぐ上に「↑ ひとつ前の質問へ」リンク。
- 実装が冗長で、Tool group 折り畳み時の UX が混乱しやすい。**非推奨**。

**推奨は案 A**。MVP として 1 ボタンで OK。連続クリック仕様（後述）で N 個前まで遡れるようにする。

### 4-3. 動作仕様

#### 4-3-1. 「直前」の定義（重要）

`messages` を逆走し `role === "user"` を集めると U_n, U_(n-1), ..., U_1 の配列ができる（時系列降順）。

- ボタンが目指す target は「**現在のスクロール位置から見て、上方向に最も近い user message のさらに 1 個前**」ではなく、「**現在のビューポート上端より上にある最も直近の user message**」が直感的に正解。
  - これによって連続クリックで自然に上方向へ N 個前へ遡れる。
  - もし「上端より上の user」が無い（最先頭まで来た）場合、ボタンは disabled。

```tsx
const handleJumpToPrevUser = () => {
  const root = scrollRef.current;
  if (!root) return;
  const containerTop = root.getBoundingClientRect().top;

  // 自 pane scope で全 user message DOM を取得（時系列順）
  const userEls = Array.from(
    root.querySelectorAll<HTMLElement>('[data-msg-id]')
  ).filter((el) => {
    const id = el.getAttribute("data-msg-id");
    const m = messages.find((mm) => mm.id === id);
    return m?.role === "user";
  });

  // ビューポート上端より上にある最も直近の user
  const target = [...userEls]
    .reverse()
    .find((el) => el.getBoundingClientRect().top < containerTop - 4);
  if (!target) return; // disabled state

  target.scrollIntoView({ behavior: "smooth", block: "start" });
};
```

#### 4-3-2. 連続クリック挙動

上記実装は「**現在のビューポート基準で 1 個ずつ上へ**」自動的に遡るため、連打で N 個前まで到達できる。state を持つ必要がない。アニメーション中（smooth scroll 中）に連打されても DOM 位置は最新化されるため、自然な挙動になる（次クリック時の `getBoundingClientRect` は最新位置を返す）。

#### 4-3-3. ハイライト

- SearchPalette と同じ orange ring を再利用するかは判断ポイント。
  - **推奨は ring なし**。理由: 「ジャンプ先がユーザー自身の質問」であり、視覚的に明らかに右寄せ青吹き出しなので識別容易。ring を出すと「検索結果」の意味と被るため意味が霞む。
  - もし入れるならごく短時間（1.5 秒程度）で fade。

---

## 5. 影響範囲とテスト

### 5-1. 触るファイル

- `components/chat/MessageList.tsx` (主、両機能ともここに集約推奨)
- 任意: `lib/stores/settings.ts` (auto-scroll on/off 設定追加時のみ)
- 任意: `lib/stores/chat.ts` (専用 action を切る場合のみ。本提案では追加不要)

### 5-2. 既存テストへの影響

- `tests/e2e/` 配下を grep した限り、`scroll` をキーワードに使うテストは **0 件**。`search-palette.spec.ts` が `scrollToMessageId` 経路を間接的に通している可能性はあるが、本提案はその経路に手を入れない（既存 `scrollTargetMessageId` はそのまま）。
- chat.spec.ts (送信・streaming テスト) は assertion を「メッセージが描画されること」中心に書かれていれば影響なし。`scrollHeight` 検証をしている場合は調整が必要だが、grep 上はそのような assertion は無い。
- **新規テスト**: 完了時オートスクロールと「直前ジャンプ」ボタン用に Playwright テストを 2 ケース追加推奨。
  - assistant 完了直後に最後の assistant カードが viewport 上端付近にあること（`boundingBox.y` を assert）。
  - FAB クリックで直前 user メッセージが viewport 上端付近に来ること。

### 5-3. 互換性

- persist schema 変更なし（chat.ts の partialize には触らない）。
- 既存の `scrollTargetMessageId` flow（SearchPalette）と並行稼働するが、相互排他ガードを冒頭に置けば干渉しない（`if (scrollTargetMessageId) return;`）。
- 多 pane 環境: 各 MessageList instance が自身の `scrollRef` を持ち、`querySelector` を `scrollRef` 配下にスコープすれば pane 間干渉なし（既存と同じ pattern）。

---

## 6. 推定作業量

| 項目 | サイズ |
|---|---|
| 要望 1 (完了時オートスクロール、ユーザー上スクロール検知込み) | **S+** (実装 0.5d / 動作確認 0.5d) |
| 要望 2 (FAB + 連続ジャンプ) | **S** (実装 0.5d) |
| 既存 末尾追従 effect とのレース確認・調整 | S (0.25d) |
| Playwright テスト 2 ケース | S (0.5d) |
| Changelog / decisions.md / 動作デモ用スクショ | XS (0.25d) |
| **合計** | **M (約 2 day, 約 1.5 開発日相当)** |

---

## 7. 副作用・エッジケース

| # | 状況 | 想定挙動 / 対策 |
|---|---|---|
| 1 | 1 turn で長文 assistant が来て viewport より大きい | `block: "start"` で先頭が上端に揃う = 想定どおり。下端は途切れるが、これは要望に合致。 |
| 2 | tool 呼び出しを多発する turn (assistant → tool → assistant → tool → assistant) | 「直近の `role === "assistant"` の streaming=true → false エッジ」を拾うため、最終 assistant の先頭へ飛ぶ。途中 tool で誤動作しないことが要件。実装はこれを満たす。 |
| 3 | streaming 中にユーザーが上スクロール → 完了 | UX 考慮 1 のガード未実装だと意図に反して下へ飛ぶ。**ガードを必ず入れる**。 |
| 4 | session 切替直後に load 完了 | `messages` 配列が空 → load 後に確定済 assistant が積まれる。streaming=true→false エッジは経由しないため誤発火しない (ref 初期値 streaming=false)。 |
| 5 | error / interrupted で終了 | `setSessionStreaming(false)` は走るが、`finalizeStreamingMessage` が走らない経路もある（error 時の L463 直後に finalize 呼ばずに return）。エッジ判定は assistant message の streaming flag に依存しているため、interrupted 時に最後の assistant が streaming=true のまま残るとオートスクロールが発火しない。これは仕様的に妥当（中断応答の先頭に誘導しても価値が薄い）。 |
| 6 | 単一 turn で複数 assistant block (text → tool → text) | finalize は **各 message** に対して走る（L425-427 で filter してから loop）。各 finalize で都度オートスクロールが発火するため、最終応答 block の先頭に最終的に着地する。途中 jitter は smooth scroll の上書きで吸収。 |
| 7 | assistant message がほぼ画面 1 行（短い相槌） | 対策 2 (UX 考慮 3-3-2) の早期 return で no-op 化。さもなくば smooth scroll の細かい揺れが目障り。 |
| 8 | reduceMotion 設定 | OS 側で smooth が auto に丸め込まれるため、明示分岐は無くても破綻はしない。丁寧にやるなら useReducedMotion で `behavior: "auto"` 化。 |
| 9 | `prev.streaming` 初期値が undefined だと初回 mount で誤発火する可能性 | ref 初期値 `{ id: null, streaming: false }` で防止 (上記コード片どおり)。 |
| 10 | FAB 表示位置が ImagePasteZone / Loader2 と重なる | `bottom-4 right-4` + `z-10` で input area 上部に配置すれば、ImagePasteZone は input 内に閉じているため衝突しない。Loader2 は中央寄せで衝突しない。 |
| 11 | FAB が messages 0 件のときに見える | empty state 早期 return (L141-162) のためそもそも MessageList の通常 return は通らず、FAB 込みコードはこちらの return path にのみ置けば安全。 |
| 12 | 4 pane 同時表示で全 pane が個別 FAB を表示 | これは仕様どおり。各 pane で独立に動くべき。z-index 衝突は pane 内 absolute なので無関係。 |

---

## 8. 推奨アプローチ（CEO への最終提案）

**両要望ともに実装推奨。サイズ M（約 2 開発日）で投資対効果が高い。**

### 推奨スコープ（最小・無欠落）

1. **要望 1**: `MessageList.tsx` に「streaming → 完了エッジ検知」effect を 1 個追加。`block: "start"` で `scrollIntoView`。ユーザー上スクロール検知ガード（`scrollHeight - scrollTop - clientHeight > 80px`）を必ず同梱する（要望と矛盾するアグレッシブ介入を防ぐため必須）。
2. **要望 2**: 同 `MessageList.tsx` に右下 FAB 1 個追加。「現ビューポート上端より上の最も直近の user message」へ jump。連続クリックで自然に N 個前まで遡れる。最先頭に到達したら disabled。

### スコープ外（次バージョン以降）

- 設定画面 (`Settings → Chat Display`) でのオン/オフ trigger。MVP リリース後にオーナー反応次第。
- ハイライト ring の再利用（ノイズ過多になる懸念から MVP では除外）。

### 実装上の注意

- 既存の末尾追従 effect (L107-112) は **削除しない**。普通の会話 / streaming 中追従としては有用。新 effect は完了エッジでの override という位置付け。
- 検索ジャンプ (`scrollTargetMessageId`) との相互排他ガードを両 effect・FAB ハンドラの先頭に置く。
- DEC-064（v1.18.0 session 単位 store）の設計を尊重し、**pane scope** で `scrollRef.current.querySelector` する。グローバル `document.querySelector` は厳禁（複数 pane 同時表示で誤動作）。
- Changelog / decisions.md に DEC 番号付きで記録。Playwright テスト 2 ケース追加。

### 想定リスク

- **低**。既存スクロール挙動は壊さず、新 effect / 新 FAB を **加算的** に載せる構造のため、regress 範囲は限定的。最大のリスクは「ユーザー上スクロール検知ガードを入れ忘れて streaming 中の手動スクロールが奪われる」点だが、これは実装時のチェックリスト 1 行で防げる。

---

(以上)
