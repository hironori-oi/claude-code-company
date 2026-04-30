# PRJ-012 v1.37.0 残課題 cleanup batch - 品質レビュー

- 案件: PRJ-012 (sumi)
- 対象: v1.36.0 → v1.37.0 (DEC-077 候補, 繰越 Minor 一括解消)
- レビュアー: レビュー部門 シニアレビュアー
- レビュー日: 2026-04-30
- レビュー種別: 修正後コードレビュー (cleanup batch)
- 関連ドキュメント:
  - 完了レポート: `projects/PRJ-012/reports/dev_v137_cleanup_done.md`
  - 直前レビュー: DEC-076 (v1.36.0) / DEC-075 (v1.35.0) の繰越 Minor 9 件

---

## 判定: APPROVE

Critical / Major 指摘ゼロ。Minor 改善提案 4 件（リリース後で可）。

cleanup batch であり新規機能なし、変更ファイルは全て本タスクのスコープ内 (`InputArea.tsx` / `MessageList.tsx` / `StreamingFloatingStopButton.tsx` / 1 spec ファイル / version 3 ファイル / CHANGELOG)。core ロジック (chat / session / sidecar) には未介入のため regression リスクは低い。version bump 整合・CHANGELOG 構造化・release.yml awk 互換いずれも問題なし。

---

## 1. Minor 項目の解消度

DEC-076 / DEC-075 の繰越 9 件中 8 件解消、1 件 (m-2) は明示的にスキップ理由付きで CHANGELOG Notes に繰越記載。

| 区分 | ID | 内容 | 期待 | 実装結果 | 判定 |
|------|----|------|------|---------|------|
| DEC-076 | m-1 | focus ring 二重描画整理 | `has-[textarea:focus]:ring-2` 化 | InputArea.tsx L912 で `has-[textarea:focus]:ring-2 has-[textarea:focus]:ring-primary/50` に置換、Send 側 `focus-visible:ring-2` (L977) は維持 | OK |
| DEC-076 | m-3 | `pb-12` 依存コメント明記 | ファイル冒頭に注意書き | StreamingFloatingStopButton.tsx L17-21 に依存先 (ChatPanel.tsx の `pb-12` / `-top-12` / FAB `bottom-4`) を明示 | OK |
| DEC-076 | m-5 | floating ピル `<kbd>` に `aria-hidden` | screen reader 二重読み上げ防止 | StreamingFloatingStopButton.tsx L108-113 で `<kbd aria-hidden="true">` 化、コメント付き | OK |
| DEC-076 | 任意 | collapsed 状態で attachment 件数バッジ | 0 件時 hidden / SR 件数読み上げ | InputArea.tsx L889-897 で `attachments.length > 0` ガード + Paperclip icon + `aria-label="添付ファイル N 件"` + 内部数字 `aria-hidden` | OK |
| DEC-075 | N-2 | ResizeObserver で pane resize 追従 | ResizeObserver 導入 + cleanup | MessageList.tsx L298-322 で scroll listener と同 effect 内に統合、`scrollRef` + `parentElement` の 2 ターゲット監視、cleanup で `disconnect()` + RAF cancel | OK |
| DEC-075 | N-3 | user message id Set の `useMemo` 化 | filter コスト軽減 / O(1) lookup | MessageList.tsx L238-251 で `useMemo<Set<string>>` + `userMessageIdsRef` ミラー、scroll handler / `handleJumpToPrevUser` 双方が ref 経由で参照 | OK |
| DEC-075 | N-4 | scroll listener 1 個統合 + RAF coalesce | 単一 handler で両 state 更新 | MessageList.tsx L256-291 で `recomputeScrollState` 1 関数 + `scheduleRecompute` (RAF guard)、cleanup で `cancelAnimationFrame` | OK |
| DEC-076 | m-2 | devtools 衝突検証 | release build dogfood | release build + 実機検証要のためスキップ、CHANGELOG Notes (L43) に繰越記載 | スキップ (理由妥当) |
| DEC-075 | N-1 | prefers-reduced-motion 対応 | `useReducedMotion()` 適用 | v1.36.0 で StreamingFloatingStopButton.tsx L57, L73-85 に既導入、本リリースでは追加対応不要 | 既解消 |

**評価**: 8/8 必須完遂、m-2 の繰越判断は release pipeline 構造上正当。

---

## 2. コード品質

### `has-[]` selector の Tailwind 互換性 (m-1)

- `package.json` で `tailwindcss: ^3.4.17` を確認。`has-[]` は Tailwind 3.4.0 で公式追加 (https://tailwindcss.com/blog/tailwindcss-v3-4#new-has-variant)、3.4.17 は包含するため compile 可。runtime は `:has()` を使うため modern Chromium / Tauri WebView2 (Win11) / WKWebView (macOS Sonoma+) で動く。Safari は 15.4+ で `:has()` をサポートしているが、Tauri 配布対象は WebView2 / WKWebView のみなので問題なし。
- 副作用として、Send button focus 時は親 wrapper の ring が出ない（Send 側 `focus-visible:ring-2` のみ）→ 仕様通り、二重描画解消が確定。

### ResizeObserver cleanup (N-2)

- MessageList.tsx L314-321: `observer.disconnect()` + `cancelAnimationFrame(rafIdRef.current)` の両方を return で実行。`observer` は局所 let で hoist 済、null safe。
- `typeof ResizeObserver !== "undefined"` ガードあり（SSR / 旧環境）。Tauri WebView は ResizeObserver 必ず存在するが、Next.js dev server の hydration 前は SSR pass を通るため必要なガード。

### useMemo / Ref の依存配列 (N-3)

- `userMessageIds = useMemo(() => Set, [messages])`: 依存 `messages` のみ。`messages` は `selectMessagesForPane` の安定参照（store 内 memo 済、L21-24 に明記）なので過剰再計算なし。
- `userMessageIdsRef.current = userMessageIds` を `useEffect([userMessageIds])` で同期。handler 内で `userMessageIdsRef.current` 参照のため依存配列に messages を入れる必要なし。
- `recomputeScrollState = useCallback(() => ..., [])` 依存空配列。内部で参照する全ての値 (`scrollRef.current` / `userMessageIdsRef.current`) が ref 経由なので stale closure 問題なし。**正しい設計**。
- `handleJumpToPrevUser = useCallback(() => ..., [])` 同様、ref 経由で OK。

### RAF coalesce cleanup (N-4)

- `scheduleRecompute`: rafId が null でない間は新規 `requestAnimationFrame` を発行しないガード (L286)、コールバック先頭で `rafIdRef.current = null` クリア (L288)。1 frame 1 実行が保証される。
- listener cleanup で `cancelAnimationFrame` 呼び出し済 (L317-320)、unmount 時に pending 1 frame が leak しない。

### 統合 listener の passive (N-4)

- L302: `el.addEventListener("scroll", onScroll, { passive: true })` 維持済。`recomputeScrollState` 内で `preventDefault()` を呼ばないため passive で問題なし。

### attachment バッジの render gate (任意)

- InputArea.tsx L889: `{attachments.length > 0 && (...)}` で 0 件 hidden。
- `attachments` は `useChatStore((s) => selectAttachmentsForSession(s, currentSessionId))` (L111-113) で session 単位 subscribe。append/clear で再 render が走るため、increment 時の表示更新は React の通常 re-render に乗る（zustand selector は shallow 比較で参照変化を検知）。
- `aria-label="添付ファイル N 件"` + 内部数字 `aria-hidden` で SR 読み上げは「添付ファイル 1 件」等の単一発話に集約。**良好**。

### コード品質 総評

統合実装に書き換え時のロジックの取りこぼしなし、ref と useMemo の組み合わせは React 19 + zustand の安定 selector 前提で正しい。指摘なし。

---

## 3. パフォーマンス改善の妥当性

### N-3: Set lookup O(1) 化

- L271-281: `nodes = el.querySelectorAll("[data-msg-id]")` で DOM 走査 + 各 node について `userIds.has(id)` で O(1) lookup → break で早期離脱。Set lookup 自体は仕様上 O(1) (実装平均)。
- 旧実装は `messages.filter(m => m.role === "user").map(m => m.id)` を毎 scroll で 2 回 (FAB effect + handleJumpToPrevUser) → 計算量 O(n) × 2 / scroll event。新実装は `useMemo([messages])` で O(n) を 1 回 / messages 変化のみに圧縮、scroll handler の per-frame コストは「DOM 走査 O(m) + Set lookup O(1) m 回」。
- DOM 走査自体は依然 O(m) (m = visible message DOM 数) だが、これは `getBoundingClientRect()` 比較が必要な本質的コストであり、開発レポート §7「IntersectionObserver 化は v1.38+ で検討」の方針通り。**指示と一致**。

### N-4: 統合後の 1 回呼び出し

- 旧: `useEffect` 2 個でそれぞれ `addEventListener("scroll")` を仕掛け → 2 個の handler が独立に走り、`messages.filter` も 2 重実行。新: 1 effect / 1 listener / 1 RAF coalesce で `userScrolledUpRef` (L262) と `setHasPrevUserAbove` (L282) を同一 frame で更新。
- `setHasPrevUserAbove` は pre-compare (`prev === found ? prev : found`) で値変化時のみ react re-render、無駄な render 抑制。**正しい最適化**。

### 大規模 session の見込み

- 100+ message 規模では DOM 走査 m が線形に伸びるが、scroll event は RAF coalesce で 60fps cap、各 frame の per-handler コストは「querySelectorAll + 平均 (m/2) iter」で 1ms 未満（typical Tauri WebView2 上）。**stutter なしの見込み**。
- 1000+ message 規模では querySelectorAll 自体が ~2-5ms に伸びる可能性があるが、本リリースの範囲外（dev レポート §7 で v1.38+ IntersectionObserver 化を提案、妥当）。

### 評価

理論的に意図通りの改善。Critical/Major なし。

---

## 4. 副作用・エッジケース

### N-2 ResizeObserver の暴発

- `observer.observe(el)` + `observer.observe(el.parentElement)` の 2 ターゲット監視。連続ドラッグ resize で複数 RO callback が発火しても、`scheduleRecompute` の RAF guard (L286 `if (rafIdRef.current !== null) return`) で 1 frame 1 実行に圧縮されるため throttling 不要。**問題なし**。
- 高速 resize で `el.parentElement` が null になるエッジ（pane unmount 中）は cleanup で `disconnect()` が走るため leak なし。

### 統合 effect の依存配列

- L322 `useEffect(..., [scheduleRecompute])`: `scheduleRecompute` は `useCallback([recomputeScrollState])`、`recomputeScrollState` は `useCallback([])`。依存チェーン全体が安定参照なので、effect の re-run は initial mount + cleanup のみ。listener が無限再 attach されない。**正しい**。
- ただし scrollRef.current が null から非 null に変わる場合 (ChatPanel mount 直後) は scheduleRecompute の参照は変わらないので effect が再走らないリスクがある。MessageList は `messages.length === 0` の早期 return path (L346-367) があり、その場合 `scrollRef` は別 div に attach される。**懸念点として後述する Minor 提案 #1 に格上げ**。

### attachment バッジの増減と re-render

- attachments は `selectAttachmentsForSession` selector の戻り値 (DEC-064 v1.18.0 で `EMPTY_ATTACHMENTS` 固定参照を返す設計、コメント L45-46 に明記)。append/clear で配列参照が変わり、`useChatStore` の shallow 比較で再 render が trigger される。バッジの数字は `attachments.length` を直接 render するので即時反映。**問題なし**。

### 新規 E2E ケース 4 (collapsed Ctrl+Enter 不発)

- 既存 ケース 3 と同 mock (`Control+Shift+I` で collapse) を流用、preview に focus を移してから `Control+Enter` を押す → textarea が DOM に出現しない & `send_agent_prompt` が 0 回。
- assertion 設計:
  - `await expect(textarea).toBeHidden()` で展開していないことを確認 (L262)
  - `sendCalls.length === 0` で送信が走っていないことを確認 (L267)
  - 200ms 待機 (L259) で event loop が flush され、もし誤発火していれば検知できる
- **assertion ロジックは堅牢**。誤検知リスクは「`Control+Enter` を押した瞬間に preview が unmount される副作用」が起きた場合だが、collapsed=true の状態では preview button の onClick も Enter handler も持っていないため発火経路なし。

### 既存 E2E の PASS 保証

- ケース 1, 2, 3 は v1.36.0 リリース時点で PASS している既知の test。本タスクで `InputArea.tsx` の wrapper class を変更 (`focus-within:ring-2` → `has-[textarea:focus]:ring-2`) したが、selector は `[data-testid="input-collapse-handle"]` / `[data-testid="input-collapsed-preview"]` / `getByPlaceholder(/メッセージを入力/)` に依存し、ring class 変更は assertion に影響しない。
- attachment バッジは `attachments.length > 0` ガードで 0 件時 hidden、既存テストは attachment 操作を行わないため影響なし。**regression リスクなし**。

---

## 5. テストカバレッジ

### 新規ケース 4 の妥当性

- selectors: `getByPlaceholder(/メッセージを入力/)` (textarea), `[data-testid="input-collapsed-preview"]` (preview button) は既存と同じ。
- assertion 妥当性: textarea の `toBeHidden()` + invokeLog の `send_agent_prompt` count === 0 の 2 軸で誤送信を完全に否定。**カバレッジ十分**。

### スコープ外項目（dev レポート §7 で v1.38 候補に明記済）

- collapsed 状態の D&D 後 attachment chip 表示 E2E
- attachment バッジ件数表示 E2E

これらは任意フォローのテスト充実であり cleanup batch のスコープ外。承認を阻害しない。

### ローカル PASS 未確認 / CI 待ち

- ローカル NG 原因 (next.config.ts の static export + dev server port 競合) は dev レポート §4 で詳説、v1.36.0 と同症状で既知。
- 新規ケース 4 は既存 1, 2, 3 と同 beforeEach / 同 mock / 同 selectors を使用、固有要素は `Control+Enter` キーストロークと invoke ログ count のみ。両者は他ケースで実証済の機構。
- **CI fresh runner で再検証されることを前提とした承認**。リスク評価: 既存 25 ケースが歴史的に CI で緑、本ケースが追加で fail する固有要因なし → リスク低。

---

## 6. リリース準備

### version bump 整合

- `package.json`: `"version": "1.37.0"` 確認
- `src-tauri/Cargo.toml`: `version = "1.37.0"` 確認
- `src-tauri/tauri.conf.json`: `"version": "1.37.0"` 確認
- 3 ファイル一致 OK。`Cargo.lock` は次回 `cargo build` で自動更新（dev レポート §5 通り、本タスクで触らないのは妥当）。

### CHANGELOG 構造化

- `## [v1.37.0] - 2026-04-30` ヘッダ確認 (L14)
- セクション: `### Changed` / `### A11y` / `### Performance` / `### Tests` / `### Notes` で構造化済 (L16-46)
- 各 Minor 項目への参照: `(m-1)`, `(m-3)`, `(m-5)`, `(N-2)`, `(N-3)`, `(N-4)` インライン記載済
- DEC-077 候補参照: L45 で明記
- m-2 (devtools 衝突検証) のスキップ・繰越は L43 に明記済

### release.yml awk 互換性

- release.yml L772-776 の awk 抽出ロジック:
  ```awk
  awk -v header="## [$TAG_NAME]" '
    index($0, header) == 1 { flag = 1; print; next }
    flag && substr($0, 1, 4) == "## [" { flag = 0 }
    flag { print }
  '
  ```
- tag `v1.37.0` → header `## [v1.37.0]`、CHANGELOG L14 の `## [v1.37.0] - 2026-04-30` は `index($0, "## [v1.37.0]") == 1` を満たす。
- 終了条件は次の見出し `## [v1.36.0] - 2026-04-30` (L47) の `substr($0, 1, 4) == "## ["` で flag=0、L14-46 のチャンクが正しく抽出される。**抽出可能**。

### m-2 の Notes 明記

- L43: 「m-2 (E2E `Ctrl+Shift+I` と Tauri devtools shortcut の衝突検証): release build + 実機検証が必要なため本リリースではスキップ。**v1.37.0 で release build dogfood 時に確認予定**」
- 検証要件・繰越先の両方が明記済。**OK**。

### 評価

リリース準備の整合は完璧。tag push で release.yml が正常に release notes を生成する見込み。

---

## 7. 推奨修正（Minor、リリース後で可）

いずれも本リリースの承認を阻害しない。次タスク以降で対応推奨。

### Minor #1: scrollRef ref attach タイミングと effect 依存

MessageList の早期 return path (L346-367, `messages.length === 0`) では空 state 用 div に scrollRef が attach され、`messages.length > 0` に変わったタイミングで別 div に再 attach される。`useEffect([scheduleRecompute])` は scheduleRecompute 安定参照のため re-run しない → 旧 div の listener が cleanup されないまま新 div には listener が付かない可能性がある。

実害は限定的（empty state からメッセージ送信した直後、最初の scroll event は recompute されないが、`useEffect([scheduleRecompute, messages])` 側 (L293-296) が messages 変化時に scheduleRecompute を 1 回呼ぶため initial state は確保される）。ただし scroll listener が消失する系統のバグは将来的にデバグしづらい。

**提案**: effect の依存配列に `scrollRef.current` を加えるか、コンポーネントを「empty state」と「list state」で分割する。v1.38.0 候補。

### Minor #2: `data-msg-id` querySelectorAll の DOM 走査

dev レポート §7 で既に IntersectionObserver 化を v1.38+ 候補として記載済。1000+ message 規模で querySelectorAll の実行時間が顕在化する可能性があるため、半年以内に対応推奨。

### Minor #3: attachment バッジのフォーカス可視化

collapsed preview は `<button>` のため focus すると外枠 ring が出る。バッジ自体は `<span>` のためフォーカス対象外で問題なし。ただし将来 attachment クリック削除機能を入れる場合はバッジ内 `<button>` 化と専用 focus ring が必要。今はスコープ外。

### Minor #4: m-2 の検証手順ドキュメント化

release build dogfood で `Ctrl+Shift+I` 衝突を検証する手順を `projects/PRJ-012/checklist/` か `dev_v137_release_build_dogfood.md` 等に記述しておくと、次回 release タグ後の検証漏れを防げる。CEO 判断で別タスクとして登録推奨。

---

## 8. 最終判断と CEO への報告

### 判定: **APPROVE**

- Critical: 0 件
- Major: 0 件
- Minor: 4 件（リリース後で可、いずれも cleanup batch のスコープ外）
- 既解消の繰越項目: 8/9（DEC-076 m-1/m-3/m-5/任意 + DEC-075 N-1/N-2/N-3/N-4）
- 明示繰越: 1/9（DEC-076 m-2、release build 検証要、CHANGELOG Notes に明記済）

### 推奨される CEO アクション

1. **タグ `v1.37.0` push 承認** — release.yml が CHANGELOG `## [v1.37.0] - 2026-04-30` チャンクを抽出して GitHub Release を生成、Win/macOS/Linux の installer + `latest.json` を artifact として upload、tauri-plugin-updater 経由で配信される
2. **release build dogfood で m-2 検証** — `Ctrl+Shift+I` を release build (Win11 / macOS / Linux のうち少なくとも 1 つ) で打鍵し、Tauri devtools が開かないこと（または collapse hotkey の方が優先されること）を確認
   - 衝突した場合の v1.38.0 hotfix 候補は dev レポート §7 で `Ctrl+Shift+M` (Mac は Cmd+Shift+M) が提案済
3. **CI で v1.37.0 タグ push 後の E2E 結果を確認** — 26 ケース（既存 25 + 新規 1）が全 PASS することを必須条件として、もし fail があれば hotfix 1.37.1 で対応

### 残課題管理 (v1.38.0 候補)

dev レポート §7 + 本レビュー §7 の合算:

- m-2 検証 (release build) と、衝突した場合の hotkey 変更 / settings UI で再割当 機能化
- 任意フォロー残: collapsed 状態 D&D 後 chip 表示 / attachment バッジ件数表示の E2E 拡充
- MessageList の IntersectionObserver 化 (1000+ message 規模対応)
- 本レビュー Minor #1 (scrollRef attach タイミングの effect 依存改善)
- 本レビュー Minor #4 (release build dogfood 手順のドキュメント化)

### 総評

cleanup batch として理想的な仕上がり。新規機能なし・core ロジック未介入・繰越 9 件中 8 件解消・残 1 件はスキップ理由が構造的に妥当・version bump と CHANGELOG 整合完璧。コード品質は React 19 + zustand 安定 selector 前提の ref / useMemo / useCallback の使い分けが正確、cleanup (RO disconnect / RAF cancel / listener removeEventListener) も漏れなし。a11y 改善 (m-5 + 任意バッジ) は実用的な細部配慮、リファクタの hygiene 価値も高い。

CEO 判断で v1.37.0 タグ push を進めて差し支えなし。
