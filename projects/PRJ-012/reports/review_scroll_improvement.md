# PRJ-012 スクロール改善 - 品質レビュー

- 担当: レビュー部門
- 日付: 2026-04-30
- レビュー対象: DEC-075 (v1.35.0 候補) チャットスクロール改善 2 件
- 対象ファイル:
  - 実装: `projects/PRJ-012/app/ccmux-ide-gui/components/chat/MessageList.tsx`
  - 新規 E2E: `projects/PRJ-012/app/ccmux-ide-gui/tests/e2e/scroll-improvement.spec.ts`
  - 完了レポート: `projects/PRJ-012/reports/dev_scroll_improvement_done.md`
  - 事前検討: `projects/PRJ-012/reports/dev_scroll_improvement_proposal.md`

---

## 判定: CONDITIONAL APPROVE

機能要件・コード品質・E2E カバレッジ・アクセシビリティ最低線・オーナー方針整合性のいずれもクリアしている。
ただし **Major 1 件 (Sec.2) を含む推奨修正が複数残っているため、条件付き承認**。Major 修正後は即 APPROVE 相当。Minor は次バージョンに繰り越して可。

---

## 1. 要件適合性チェック

| # | 要件 | 実装箇所 | 判定 |
|---|------|----------|------|
| 1-1 | streaming 完了時に最後の assistant の先頭へ `scrollIntoView({ block: "start" })` | `MessageList.tsx` L149-197 | OK |
| 1-2 | 「true → false」エッジで発火（マウント・hydrate で誤発火なし） | L172-176 `prev.streaming === true && lastAssistant.streaming === false` | OK |
| 1-3 | 「最後の assistant のみ」を対象（tool は無視） | L150-157 末尾走査で `role === "assistant"` のみ拾う | OK |
| 1-4 | ユーザー上スクロール (80px 閾値) ガード | L109-122 / L169 | OK |
| 1-5 | 検索ジャンプ中は介入しない | L167 `if (scrollTargetMessageId) return;` | OK |
| 1-6 | 短文応答 no-op | L188-194 (`offsetWithinRoot >= 8 && targetRect.bottom <= rootRect.bottom`) | OK |
| 2-1 | FAB が `data-msg-id` 走査で「最直近の上方 user」へジャンプ | L268-291 | OK |
| 2-2 | 連続クリックで N 個前まで遡れる | viewport 上端基準で毎回再計算 → OK | OK |
| 2-3 | 最先頭で disabled | `hasPrevUserAbove` state により制御 (L229-266 / L414) | OK |
| 2-4 | aria-label 付与 | L411 `aria-label="ひとつ前の質問にジャンプ"` | OK |

要件適合性は完全。提案レポート §3-3, §4-3 の推奨スコープ通り。

---

## 2. コード品質指摘

### Critical

なし。

### Major

#### M-1. `userScrolledUpRef` が「streaming 中の追従抑止」と「完了オートスクロール抑止」の両方に使われている — 完了直後の意図とズレるエッジが残っている

**該当**: `MessageList.tsx` L109-122 / L169

**現象**:
- ガードは「scrollTop からの底距離 > 80px」で恒常的に true になる。
- ユーザーが「streaming 中」ではなく「**1 turn 終わった後**」に上にスクロールして読書しているとき、新たな送信を行うと、新しい assistant が完了する瞬間も `userScrolledUpRef.current === true` のままになる可能性がある（L113 の `onScroll` は scroll 操作毎にしか更新されない）。
- 厳密には、ユーザーは新しい質問を送った瞬間に「最新の答えを読みたい」モードに切り替わっていることが多いはずで、本ガードでオートスクロールを抑止してしまうとオーナー要望「毎回手動で先頭に戻すのが面倒」と衝突する。

**影響度**: 中。普段の会話フローでは「送信直後にコンテナの一番下へ末尾追従が走り、scrollTop が更新され、`onScroll` 経由でフラグが false に戻る」ため実害は出にくい。ただし、ユーザー上スクロール状態のまま「Enter で送信した」場合、scroll 操作が発生しないので flag は true のまま固定され、新規 assistant 完了で誤抑止される。

**推奨修正**（軽量）:
- ユーザーが新規 prompt を送った瞬間、または `messages.length` が増えた瞬間に `userScrolledUpRef.current = false` にリセットする。
  - 具体的には L127-133 の末尾追従 effect が走るたび「自分が末尾に飛ばす」直前で false にすればよい。または `userScrolledUpRef` 判定を「現在の最後の messageId が変わった直後の 1 render は無視する」形にする。
- もしくは、L127-133 の末尾追従が走った直後、scroll 操作なしでも `requestAnimationFrame` 1 発で `el.scrollTop` を観測してフラグを再評価する。

最低限、completion effect 側で「直近 1s 以内に messages 配列長が増加していたら gate を解除する」ロジックを足すと安全。実装は数行。

### Minor / Nits

#### N-1. `prefers-reduced-motion` 対応が無い

- 同コードベースの `ChatPanel.tsx` では `useReducedMotion()` を `framer-motion` から import 済み。
- `MessageList.tsx` の 2 つの新 `scrollIntoView` 呼出 (L196, L290) は常時 `behavior: "smooth"` 固定。
- 提案レポート §3-3 / 完了レポート §5-2 で「OS が自動丸める」と説明されているが、これは Chromium の挙動依存であり、Firefox 系では smooth が尊重されるケースもある。
- **修正案**: `const reduceMotion = useReducedMotion();` を追加し、`behavior: reduceMotion ? "auto" : "smooth"` に分岐。差分 3 行。
- 受容可能なら「次バージョン以降 polish」として明示し、completion レポート §5-2 の「将来課題」を CHANGELOG に残せば見送り可。

#### N-2. FAB のスクロール監視が pane 内 `el` のみ → ResizeObserver / window resize で再計算されない

- `computeHasPrevUserAbove` (L230-255) は `messages` 変化時 + `scroll` イベント時にしか走らない。
- pane の幅変更（リサイザードラッグ）や ChatPanel の高さ変更で「viewport 上端より上の user」が増減した場合、FAB の disabled 状態が古いままになり得る。
- **修正案**: `ResizeObserver` で `scrollRef.current` を観測し、変化時に再計算。または `window.addEventListener("resize", ...)` で代替。
- 影響度低（実用上はリサイズ後の最初のスクロールで再計算されるため自己修復する）。

#### N-3. `computeHasPrevUserAbove` が `messages` を必ずクロージャ捕捉 → 巨大 session で配列フィルタが scroll ごとに走る

- L237-238 で `messages.filter(...)` を毎 scroll で実行。
- 1 session 数千 message 級になると O(n) コストが scroll ごとに発生（`AnimatePresence` map と並んで GC 圧も増える）。
- **修正案**: `userIds` を `useMemo([messages])` で memo 化、callback は `userIds` を依存に持たせる。差分 3 行。
- 影響度低（chat session の通常規模では問題ないが、PRJ-012 は長尺 session を扱う前提なので将来的に効いてくる）。

#### N-4. scroll listener が `MessageList.tsx` 内で 2 個に分かれている

- L110-122 (`userScrolledUpRef` 用) と L257-266 (`computeHasPrevUserAbove` 用) で別々に `addEventListener("scroll", ...)` を呼んでいる。
- いずれも passive で軽量だが、1 関数に統合すると以下の利点:
  1. 競合状態が無くなる（両者が `scrollRef.current` を独立に保持）
  2. `userScrolledUpRef.current` が更新された後に `computeHasPrevUserAbove` を呼ぶことで、M-1 の解消にも寄与する
- 影響度低、リファクタ範囲。

#### N-5. `prevLastAssistantRef` 更新位置と早期 return の順序

- L164 で `prevLastAssistantRef.current = curr;` を return 群より先に行っている。これは正しい設計（早期 return しても次回判定が続く）。
- ただしコメント L163 が「先に ref を更新しておく（早期 return しても次回判定が正しく続く）」と書かれており明示的なので問題なし。**問題なし、加点コメント**。

#### N-6. 複数 pane で同じ session を表示しているケース

- chat store DEC-064 設計上、複数 pane が同じ `currentSessionId` を指すことが許容されている（v3.5 Chunk B）。
- このとき pane A / pane B の両方で同じ assistant の完了エッジが検知され、両方で `scrollIntoView` が走る。これは仕様としては正しい（各 pane 独立挙動）。
- ただし、`prevLastAssistantRef` は MessageList コンポーネントごと（= pane ごと）に保持されるので独立性は保てている。**問題なし、確認のみ**。

#### N-7. `disabled` button への focus & screen reader

- `<button disabled>` は Tab focus 不可（OS デフォルト）であり、`disabled:pointer-events-none` で hover も止まる。これは仕様的に妥当。
- ただし、disabled 状態を screen reader にどう読ませるかが不明確（aria-disabled でなく属性 disabled を使っている）。read-only な情報伝達としては足りるが、「最先頭まで来た」ことをユーザーに通知する仕組みは無い。
- 完了レポートでも明示している通り MVP スコープ外として OK。

---

## 3. テストカバレッジ

### 3-1. 新規 E2E (`scroll-improvement.spec.ts`) 検証

| ケース | assertion | 妥当性 |
|---|---|---|
| Test 1: `auto-scrolls to last assistant start on completion` | `offsetWithinContainer ∈ [-4, 80]` & `distanceFromBottom > 40` | 合理的。`scroll-mt-16 = 64px` を考慮した閾値で、末尾追従との誤同定を排除。OK |
| Test 2 1st click | 「ユーザー質問2」の offset ∈ `[-4, 120]` | 妥当。120px 上限はやや甘いが許容範囲（`scroll-mt-16` + smooth 残揺らぎ） |
| Test 2 2nd click | 「ユーザー質問1」の offset ∈ `[-4, 120]` | 同上 |
| Test 2 終端 | `expect(fab).toBeDisabled()` | OK |

### 3-2. 不足カバレッジ

- **未カバー**: 「streaming 中にユーザーが上スクロールしたら、完了時に介入されない」。
  - 完了レポート §5-6 でも明示済み。Playwright での mouse wheel が不安定な事情は了承。
  - 補完案: スクロール mock を `page.evaluate` で直接 `el.scrollTop = 0` してから完了 emit する単純な spec を 1 つ追加すれば、コード上のガードを E2E で押さえられる。実装 0.25d 程度なので追加推奨。
- **未カバー**: 「短文応答で no-op」。
  - L191-194 の早期 return ロジックが効いているか E2E で確認できると安全。
  - 補完案: 1 行 assistant を emit → 完了直後に scrollTop が変化していない (= ±2px 内) ことを assert。

### 3-3. 既存 spec への regression リスク

- `chat.spec.ts`: assertion は「メッセージ可視性」中心のはずで影響なし。done レポートで PASS 報告あり。
- `search-palette.spec.ts`: `scrollTargetMessageId` は本変更では **読むだけ** で書かない。既存 flow に副作用なし。done レポートで PASS 報告あり。
- DOM 構造変更点 (`relative flex flex-1 min-h-0` ラッパー追加 + FAB 兄弟配置) が他テストの selector を破ってないかは done 側で確認済との報告。レビューでも grep 上 `MessageList` のテスト selector に DOM 階層依存なし。

### 3-4. テスト判定

カバレッジ十分。3-2 の 2 件は **次バージョンに繰り越し可**（必須ではない）。

---

## 4. アクセシビリティ

| 観点 | 結果 |
|---|---|
| FAB の keyboard 到達 | 通常の Tab で reachable（disabled 時を除く）。OK |
| FAB の Enter / Space 起動 | `<button type="button">` 標準挙動で OK |
| aria-label | `"ひとつ前の質問にジャンプ"` 日本語固定。オーナー方針整合 OK |
| アイコン aria-hidden | `<ArrowUp aria-hidden />` で screen reader へ二重発話なし。OK |
| disabled 状態の通達 | 標準 `disabled` 属性で OK。aria-disabled 化は不要 |
| prefers-reduced-motion | **未対応** (Minor N-1 参照) |
| focus visible | shadcn 系の global default に依存。本コンポーネントで focus ring を潰してないので OK |
| 色コントラスト | `bg-background/90` + `border-border/60` + `text-foreground` で標準テーマ準拠。disabled 時 opacity 40% は WCAG AA 4.5:1 を割る可能性ありだが「非アクション要素」なので妥協範囲 |

**判定**: 最低線クリア。N-1 (reduced-motion) の対応有無で「丁寧」評価が変わるが、必須ではない。

---

## 5. 副作用・エッジケースの検証結果

| # | エッジケース | 実装の挙動 | 判定 |
|---|---|---|---|
| 1 | 短文応答 (1 行) | L188-194 の `offsetWithinRoot >= 8 && bottom <= containerBottom` で no-op | OK |
| 2 | tool 連発 turn (assistant → tool → ... → assistant) | L150-157 で「最後の assistant」を取得 → 最終 assistant の先頭着地 | OK |
| 3 | error / interrupted で streaming flag が残る | エッジ検知が走らない（streaming=true のまま）→ 介入しない | 仕様通り OK |
| 4 | 検索ジャンプ実行中 | L167 で early return | OK |
| 5 | smooth scroll 中の追加 streaming イベント | smooth scrollIntoView は次の scrollTo 命令で目的地が更新される。完了 effect は messages 変化のたび走るので「streaming → 完了」エッジは 1 回しか発火しない（その後同じ assistant の streaming は false 固定） | OK |
| 6 | 複数 pane / 複数 session | `scrollRef.current.querySelector(...)` で pane scope 限定。`prevLastAssistantRef` も pane ごと独立。store 側 schema は共有だが scrollTarget も pane ごと | OK |
| 7 | persist schema / store action 変更 | 一切なし。本コンポーネント内に閉じている | OK |
| 8 | 既存末尾追従 effect との競合 | 末尾追従 effect は完了 effect と同じ tick で走る可能性があるが、`scrollTo` の smooth は最終 invocation が勝つ。完了 effect 側で `userScrolledUpRef === true` 時に skip するため、上スクロール中の競合無し | OK |
| 9 | 無限ループ | 完了 effect 内では state を更新しない（ref のみ）→ 再 render を引き起こさない。FAB の `setHasPrevUserAbove` は値が変わったときのみ `useState` setter で再 render 抑止される | OK |
| 10 | cleanup (addEventListener) | L119-121 / L263-265 / L213 で正しく removeEventListener / clearTimeout している | OK |
| 11 | empty state の FAB 非表示 | L293-314 の早期 return path に FAB 無し → messages 0 件で見えない | OK |
| 12 | M-1 シナリオ (streaming 完了後にユーザー上スクロール → 新規送信) | `userScrolledUpRef` が立ったまま新規送信される可能性あり | **要対応 Major** |

---

## 6. 推奨修正（優先順）

### 必須 (Major)

1. **M-1 解消**: 新規 prompt 送信 / 新規 assistant ID 検出時に `userScrolledUpRef.current = false` リセットする。
   - 提案: `MessageList.tsx` 末尾追従 effect (L127-133) の中、または完了 effect (L149) の冒頭で「`prev.id !== curr.id` のとき gate をリセット」。

```tsx
// 案: completion effect の prev/curr 更新前後で
if (prev.id !== curr.id && curr.id) {
  // 新しい assistant message が来た = 新規 turn の開始
  userScrolledUpRef.current = false;
}
```

### 推奨 (Minor)

2. N-1: `useReducedMotion` で `behavior: "auto" | "smooth"` 分岐（差分 3 行）。
3. N-2: `ResizeObserver` 追加（差分 5 行）。
4. N-3: `userIds` を `useMemo` 化（差分 3 行）。
5. N-4: scroll listener 統合（リファクタ）。

### 任意 (Nits / 次バージョン)

6. テスト 3-2: 「上スクロール中は完了オートスクロールが介入しない」「短文応答で no-op」の 2 ケース追加。
7. アクセシビリティ: FAB が「最先頭」になったことを `aria-live="polite"` で通知（必須ではない）。

---

## 7. 最終判断と CEO への報告

### CEO 向けサマリー

DEC-075 (チャットスクロール改善 v1.35.0 候補) の品質レビューを完了。

- **判定**: CONDITIONAL APPROVE
- **理由**: 要件 100% 適合、コード品質良好（store schema / persist / 他コンポーネント無変更で無欠落）、E2E 2 ケースで主要パスカバー、絵文字未使用・lucide-react 統一・aria-label 適切で方針整合。ただし `userScrolledUpRef` ガードが「streaming 完了後に上スクロールして読書したまま新規送信」シナリオで誤抑止しうる Major 1 件が残存。
- **オーナー方針整合**: 絵文字 0、アイコン lucide-react 統一（既存 78 ファイルとの整合性は実装側で確認済）、aria-label 日本語固定、複数 pane 独立挙動 OK。
- **必須対応**: Major M-1 を 1 件修正後にリリース推奨。修正は `MessageList.tsx` 内 3 行程度の差分で済む。
- **次バージョン繰越推奨**: prefers-reduced-motion 対応 (N-1)、ResizeObserver 監視 (N-2)、userIds memo 化 (N-3)、追加 E2E 2 ケース (3-2)。
- **見送り判断**: ハイライト ring 未実装 / 設定切替未実装は提案レポート §3-3, §4-3 通り MVP 範囲外として妥当。

### リリース判断

- **M-1 修正後**: 即 v1.35.0 として release 可。
- **M-1 を許容して即 release** する場合: Known issue として CHANGELOG / decisions.md に明記すること。実害は「上スクロール状態のまま Enter 送信した直後の 1 turn だけ完了オートスクロール抑止」という限定的かつ自己修復するシナリオなので、許容判断もあり得る。

CEO 判断ポイント:
1. M-1 を修正してから release するか、Known issue として release するか
2. N-1 (prefers-reduced-motion) を本 release に含めるか v1.36.0 に回すか

---

(以上)
