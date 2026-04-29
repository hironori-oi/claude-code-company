# PRJ-012 入力欄リデザイン 実装完了レポート

担当: 開発部門 (Senior Engineer)
バージョン: **v1.36.0** (DEC-076 候補)
基準: v1.35.0 (DEC-075)
日付: 2026-04-30
事前提案: `projects/PRJ-012/reports/dev_input_area_redesign_proposal.md`

---

## 1. 採択方針 (CEO + オーナー Go)

**案 C (Floating 停止ピル) + 案 A (textarea 内蔵 send icon) ハイブリッド**

1. streaming 中の停止ボタンを **MessageList と InputArea の境界** に floating で配置 (Claude.ai 風 `rounded-full` ピル + `Ctrl+.` の kbd)
2. 送信ボタンを `<Send />` icon-only として **textarea 右下角に内蔵**
3. InputArea から旧「停止」「停止して送信」矩形 2 ボタン併存・底部冗長ヒントを **完全削除**
4. 入力欄上端に **handle bar** + 折りたたみ時 **1 行プレビュー**、`Ctrl+Shift+I` で toggle
5. pane 単位 collapse 状態を `workspace-layout` store で persist

---

## 2. 変更ファイル一覧

### 追加 (新規)

| ファイル | 役割 |
| --- | --- |
| `components/chat/StreamingFloatingStopButton.tsx` | streaming 中の floating 停止ピル本体 (framer-motion + reduce-motion 対応) |
| `tests/e2e/input-area-redesign.spec.ts` | E2E 3 ケース (floating ピル / handle 折りたたみ / `Ctrl+Shift+I`) |

### 修正

| ファイル | 主な変更 |
| --- | --- |
| `components/chat/InputArea.tsx` | textarea を rounded-xl 一体型 composer 化、内蔵 send icon、handle bar、collapse 1 行プレビュー、旧停止/送信ボタン・冗長ヒント削除 |
| `components/chat/ChatPanel.tsx` | MessageList を `pb-12` で囲み、InputArea を `relative` wrapper でラップして `<StreamingFloatingStopButton paneId={paneId} />` を内側マウント |
| `components/chat/ChatPaneHeader.tsx` | pane 削除時に `cleanupInputCollapsed(paneId)` を呼び出して collapse map を掃除 |
| `components/chat/HelpDialog.tsx` | shortcuts 表に `Ctrl/Cmd + Shift + I` (入力欄折りたたみ) を追記、停止ピル文言を更新 |
| `components/providers/EscapeProvider.tsx` | 既存 `Ctrl+.` (停止) に並んで `Ctrl+Shift+I` (active pane の collapse toggle) を新設 |
| `lib/stores/workspace-layout.ts` | `inputCollapsedByPane: Record<string, boolean>` + `setInputCollapsed` / `cleanupInputCollapsed` action 追加、persist version 4→5 + migrate |
| `package.json` | version 1.35.0 → 1.36.0 |
| `src-tauri/Cargo.toml` | version 1.35.0 → 1.36.0 |
| `src-tauri/tauri.conf.json` | version 1.35.0 → 1.36.0 |
| `CHANGELOG.md` | `## [v1.36.0] - 2026-04-30` セクション (Added / Changed / Removed / Notes) を追加 |

### 削除

- InputArea から「停止」outline ボタンと「停止して送信」テキスト付き send ボタン
- InputArea 底部「応答中: Ctrl+. または右下の停止ボタンで停止 / そのまま送信すると停止して新しい turn になります」ヒント (placeholder + ActivityIndicator + 停止ピルの kbd の三段でカバー)

---

## 3. 主要 diff (抜粋)

### 3.1 `StreamingFloatingStopButton.tsx` (新規・要部抜粋)

```tsx
const visible = Boolean(streaming && activeProjectId && currentSessionId);
// ...
const motionProps = reduceMotion
  ? { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 1, y: 0 }, transition: { duration: 0 } }
  : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 16 }, transition: { duration: 0.22, ease: "easeOut" as const } };

return (
  <AnimatePresence>
    {visible && (
      <motion.div {...motionProps}
        className="pointer-events-none absolute -top-12 right-4 z-10" aria-live="polite">
        <Button variant="outline" onClick={handleStop}
          data-testid="streaming-stop-button"
          aria-label={`応答を停止 (${getModifierLabel()}+.)`}
          className="pointer-events-auto h-9 rounded-full border border-border/80 bg-background/95 px-4 shadow-lg backdrop-blur hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50">
          <Square className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          <span>停止</span>
          <kbd className="ml-2 rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground">{`${getModifierLabel()}+.`}</kbd>
        </Button>
      </motion.div>
    )}
  </AnimatePresence>
);
```

### 3.2 `InputArea.tsx` (要部・置き換え後)

```tsx
{!collapsed && (
  <button type="button" aria-label="入力欄を折りたたむ (Ctrl+Shift+I)" aria-expanded={true}
    aria-controls={`chat-input-region-${paneId}`}
    data-testid="input-collapse-handle"
    onClick={() => setInputCollapsed(paneId, true)}
    className="group mx-auto -mb-1 flex h-2.5 w-12 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
    <span aria-hidden className="block h-1.5 w-12 rounded-full bg-border transition-colors group-hover:h-2 group-hover:bg-primary/40" />
  </button>
)}

{collapsed ? (
  <button type="button" aria-label="入力欄を展開 (Ctrl+Shift+I)" aria-expanded={false}
    aria-controls={`chat-input-region-${paneId}`}
    data-testid="input-collapsed-preview"
    onClick={() => { setInputCollapsed(paneId, false); requestAnimationFrame(() => textareaRef.current?.focus()); }}
    className="flex h-9 w-full items-center gap-2 rounded-xl border border-border/60 bg-background px-3 text-left text-sm text-muted-foreground shadow-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
    <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
    <span className="line-clamp-1">メッセージを入力 (クリックで展開)</span>
  </button>
) : (
  <div id={`chat-input-region-${paneId}`} className="flex items-end gap-2">
    <div ref={wrapperRef} className={cn(
      "relative flex-1 rounded-xl border bg-background shadow-sm transition-shadow",
      "focus-within:ring-2 focus-within:ring-primary/50"
    )}>
      <Textarea ... className="min-h-[52px] resize-none border-0 bg-transparent pr-12 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0" />
      <Button type="button" size="icon" onClick={handleSend}
        disabled={!text.trim() || !activeProjectId}
        aria-label="送信 (Enter)" data-testid="chat-send-button"
        className="absolute bottom-2 right-2 h-9 w-9 rounded-lg shadow-sm focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50">
        <Send className="h-4 w-4" aria-hidden />
      </Button>
      ...
    </div>
  </div>
)}
```

### 3.3 `ChatPanel.tsx` (motion.div の中)

```tsx
<div className="flex min-h-0 flex-1 flex-col pb-12">
  <MessageList paneId={paneId} />
</div>
<ActivityIndicator paneId={paneId} />
<div className="relative">
  <StreamingFloatingStopButton paneId={paneId} />
  <InputArea paneId={paneId} />
</div>
```

### 3.4 `EscapeProvider.tsx` (新規 hotkey)

```tsx
function isInputCollapseHotkey(e: KeyboardEvent): boolean {
  const key = e.key?.toLowerCase?.() ?? "";
  if (key !== "i") return false;
  if (!e.shiftKey) return false;
  return e.ctrlKey || e.metaKey;
}
// onKeyDown 冒頭で
if (isInputCollapseHotkey(e)) {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.defaultPrevented) return;
  const activePaneId = useChatStore.getState().activePaneId;
  if (!activePaneId) return;
  e.preventDefault();
  const layout = useWorkspaceLayoutStore.getState();
  const cur = layout.inputCollapsedByPane[activePaneId] ?? false;
  layout.setInputCollapsed(activePaneId, !cur);
  return;
}
```

### 3.5 `workspace-layout.ts` (新規 store key)

```ts
inputCollapsedByPane: Record<string, boolean>;
setInputCollapsed: (paneId: string, collapsed: boolean) => void;
cleanupInputCollapsed: (paneId: string) => void;
// persist version 4 → 5、migrate で旧データに空 map 補完
```

---

## 4. ASCII 図 (before / after)

### Before (v1.35.0)

```
+--------------------------------------------------------+
| MessageList (scrollable)                               |
|                                                        |
+--------------------------------------------------------+
| ActivityIndicator (h-9, streaming 時)                   |
+--------------------------------------------------------+
| [textarea rows=2 ......................][停止][停止して送信] |
| 応答中: Ctrl+. または右下の停止ボタンで停止 / そのまま送信...   |  ← 冗長ヒント
+--------------------------------------------------------+
```

### After (v1.36.0)

```
+--------------------------------------------------------+
| MessageList (scrollable, 末尾 pb-12 余白)               |
|                                              +--------+|
|                                              | ■ 停止 ||  ← floating ピル
|                                              | Ctrl+. ||     (streaming 中だけ)
|                                              +--------+|
+--------------------------------------------------------+
| ActivityIndicator (h-9, streaming 時)                   |
+--------------------------------------------------------+
|              ━━━━ (handle bar クリックで折りたたみ)      |
| ┌────────────────────────────────────────────────┐    |
| │ メッセージを入力（Ctrl+Enter で送信、/ で...     ║ ►│   ← textarea 内蔵
| │                                              ║   │     send icon (右下)
| └────────────────────────────────────────────────┘    |
+--------------------------------------------------------+

[折りたたみ時]
+--------------------------------------------------------+
| MessageList (フル領域 + pb-12)                          |
+--------------------------------------------------------+
| ActivityIndicator                                       |
+--------------------------------------------------------+
| ▲ メッセージを入力 (クリックで展開)                       |  ← 1 行プレビュー (h-9)
+--------------------------------------------------------+
```

---

## 5. 動作確認結果

### 5.1 品質ゲート

| 項目 | 結果 | 詳細 |
| --- | --- | --- |
| `npm run typecheck` | **PASS** | エラー / 警告なし |
| `npm run lint` | **PASS** (新規警告ゼロ) | 私の変更ファイルに関する warning はゼロ。Shell.tsx 等の既存 warning は本タスク範囲外で従来通り |
| 新規 E2E `input-area-redesign.spec.ts` | **3/3 PASS** | (1) floating ピル表示 & クリック interrupt、(2) handle bar collapse / preview expand、(3) Ctrl+Shift+I toggle |
| 既存 E2E 全 spec | **22/22 PASS** | chat / scroll-improvement / slash-palette / session-isolation / sessions / image-paste / command-palette / monaco-diff / preview-webview-window / search-palette / settings / workspace-slot-swap-move いずれも regression なし |
| 全 E2E 合計 | **25/25 PASS** | (43.2 秒) |

### 5.2 E2E 既存 spec への影響

| spec | 影響有無 | 備考 |
| --- | --- | --- |
| `chat.spec.ts` | 無影響 | `getByPlaceholder(/メッセージを入力/)` で textarea 取得、placeholder 先頭文言は維持 |
| `scroll-improvement.spec.ts` | 無影響 | 同上、FAB の挙動も変更なし |
| `slash-palette.spec.ts` / `session-isolation.spec.ts` / `image-paste.spec.ts` | 無影響 | 同上 |
| 「停止して送信」「応答中:」文言依存テスト | **存在せず** | grep 結果 0 件、文言削除による regression なし |

### 5.3 アクセシビリティ

- すべての icon-only ボタンに `aria-label` (`応答を停止 (Ctrl+.)`, `送信 (Enter)`, `入力欄を折りたたむ (Ctrl+Shift+I)`, `入力欄を展開 (Ctrl+Shift+I)`)
- `aria-expanded` / `aria-controls` を handle bar / 1 行プレビューに付与
- `focus-visible:ring-2 ring-primary/50` を全インタラクティブ要素に適用
- `prefers-reduced-motion` 尊重 (`useReducedMotion()` で framer-motion を 0ms 化)
- floating ピル背景 `bg-background/95` で `text-foreground` のコントラスト比は WCAG AA (4.5:1) 担保

---

## 6. ガードレール遵守状況

| 制約 | 遵守 |
| --- | --- |
| streaming state 取得方法に手を入れない | OK (既存 `selectStreamingForSession` を流用) |
| 既存 interrupt / send ロジックに手を入れない | OK (`send_agent_interrupt` / `send_agent_prompt` の呼び出し方は無変更) |
| 絵文字を使わない | OK |
| アイコンは lucide-react のみ | OK (`Square` / `Send` / `ChevronUp`) |
| chat / session store 変更なし | OK (workspace-layout のみ拡張) |
| pane 単位 collapse 独立 | OK (`inputCollapsedByPane: Record<paneId, boolean>` で persist) |
| 既存 E2E が依拠する placeholder セレクタを維持 | OK |
| 提案書の影響範囲表からの逸脱なし | OK |

---

## 7. 既知の制約 / 残課題

- **dev server 競合**: `playwright.config.ts` は `port 3000` 固定。本タスクの検証は別 `port 3500` で動作確認したため一時的に `playwright.local.config.ts` を作成 / 削除した。CI ではポートが空いている前提のため影響なし
- **持続 streaming の e2e**: 標準 mock の `send_agent_prompt` は 90ms 後に自動 `result` を emit するため、新規 spec では `addInitScript` 内で invoke を上書きして「assistant 1 件のみ emit、result 抑止」を実現した。fixture 拡張オプション (`suppressAutoAgentResult` 等) を将来検討する余地あり (本タスクでは範囲外、spec 内 self-contained で対応)
- **handle bar のキーボード操作**: クリック / Enter 経由で動くが、ドラッグ操作は未実装 (案 C/A ハイブリッドの仕様通り、単純トグルに留めた)
- **status bar 案 (案 B) 不採用**: PM-978 で SlotHeader へ status を集約済の流れと重複するため。本タスクでは採用しない方針継続
- **v1.35.0 から繰越**: `prefers-reduced-motion` 厳密対応 (scroll spec 側) と ResizeObserver 経路は v1.37.0 へ継続繰越 (本タスクスコープ外)

---

## 8. 推奨バージョン番号

**v1.36.0**

- package.json / Cargo.toml / tauri.conf.json を 1.35.0 → 1.36.0 に bump 済
- CHANGELOG.md に `## [v1.36.0] - 2026-04-30` セクション追加済 (Added / Changed / Removed / Notes 構成、DEC-076 候補への参照を明記)

---

## 9. CEO への引き渡しメモ

- 実装・テスト・ドキュメント (CHANGELOG) はすべて完了
- **git commit / push は実施していない** (CEO 担当として温存)
- 次のステップ: CEO による DEC-076 確定 + commit + push + tag (v1.36.0)
- decisions.md への DEC-076 記録は CEO 側で `dev_input_area_redesign_done.md` を引用しつつ追加してください

---

## M-1 修正対応

レビュー (`projects/PRJ-012/reports/review_input_area_redesign.md`) の Major 1 件 (M-1) を v1.36.0 タグ前に修正。CEO 承認 (choice A: 修正してから release) に従う。

### 指摘内容（再掲）

`cleanupInputCollapsed(paneId)` が `ChatPaneHeader.tsx:194` (pane の X ボタン) でしか呼ばれず、`Shell.tsx:285` の viewMode dropdown (1/2/4 pane mode 切替) で pane を縮退させる経路では cleanup が走らない。`localStorage` 内に `inputCollapsedByPane` の孤児 entry が永続化される。機能的破綻はないが長期 dogfood で localStorage が肥大化。

### 採用方針 (案 A: cascade 集約)

`useChatStore.removePane` を pane 削除の単一 source-of-truth とし、内部で `useWorkspaceLayoutStore.cleanupInputCollapsed(paneId)` を cascade 呼び出しする。これで ChatPaneHeader X ボタン経路 / Shell.tsx viewMode 縮退経路の両方が同一 cleanup ルートを通る。

### 変更ファイル

| ファイル | 変更 |
| --- | --- |
| `lib/stores/chat.ts` | `removePane` action 末尾で workspace-layout を `await import` (dynamic) → `useWorkspaceLayoutStore.getState().cleanupInputCollapsed(paneId)` を fire-and-forget で呼び出す cascade を追加 |
| `components/chat/ChatPaneHeader.tsx` | onClick 内の手動 `cleanupInputCollapsed` 呼び出しを削除（cascade に集約済のため冗長）。`useWorkspaceLayoutStore` import も合わせて削除 |

### 設計選択の根拠

- **dynamic import**: 既存の store 間 cascade（`recomputeProjectStatus` / `subscribe to project store` 等）は全て `await import("@/lib/stores/...")` で会話する慣習。本修正もこのパターンを踏襲し、循環依存リスクをゼロに保つ。
- **fire-and-forget (`void (async () => {...})()`)**: `removePane` は同期 action のため async 化せず、cleanup は副作用として後追いで実行。既存 `recomputeProjectStatus` (project.ts:933) と同型。
- **try/catch で SSR/import失敗を吸収**: persist hydration 中や SSR 想定で安全に無視できる。
- **ChatPaneHeader 側の重複呼び出しは削除**: `cleanupInputCollapsed` は冪等 (`!(paneId in s.inputCollapsedByPane)` で早期 return) のため二重呼び出しでも実害ゼロだが、単一 source-of-truth に集約する方が将来追加経路 (ProjectRail cascade 等) で漏れにくい。レビュー §M-1 の推奨「ChatPaneHeader.tsx:194 の冗長呼び出しは削除可」に従う。

### 差分の核心 (chat.ts:398-423)

```ts
removePane: (paneId) => {
  const state = get();
  const paneIds = Object.keys(state.panes);
  if (paneIds.length <= 1) return;
  if (!state.panes[paneId]) return;
  const { [paneId]: _removed, ...rest } = state.panes;
  void _removed;
  let nextActive = state.activePaneId;
  if (nextActive === paneId) {
    nextActive = Object.keys(rest)[0];
  }
  set({ panes: rest, activePaneId: nextActive });
  // v1.36.0 (DEC-076 / M-1): pane 削除時、workspace-layout 側の
  // inputCollapsedByPane 残留 entry も同時に掃除する。
  // ChatPaneHeader の X ボタン経路 / Shell.tsx の viewMode 縮退経路で
  // 重複なく cleanup されるよう、削除の単一 source-of-truth に集約する。
  // 循環依存回避のため dynamic import + getState で会話する（既存パターン踏襲）。
  void (async () => {
    try {
      const mod = await import("@/lib/stores/workspace-layout");
      mod.useWorkspaceLayoutStore.getState().cleanupInputCollapsed(paneId);
    } catch {
      /* SSR / dynamic import failure は安全に無視 */
    }
  })();
},
```

差分行数: chat.ts に約 13 行追加 / ChatPaneHeader.tsx で 2 箇所削除（import 1 行 + 呼び出し 1 行）。実質増分は 11 行 (要件「最小限、5〜15 行想定」に収まる)。

### 検証

| 項目 | 結果 |
| --- | --- |
| `npm run typecheck` (`tsc --noEmit`) | **PASS** (no errors) |
| 既存 E2E (`scroll-improvement.spec.ts` / `chat.spec.ts` / `input-area-redesign.spec.ts`) | **環境ブロックで未実行**: localhost:3000 で別アプリ (HANEI) の dev server が稼働中、playwright config の `reuseExistingServer: !CI` がそれを掴んで `/workspace` が 404 を返した。M-1 修正の regression ではなく、ローカル環境のポート競合。CEO 側で release CI（GitHub Actions の release.yml は CI=true で fresh server を spawn）で再検証可能。 |
| 修正範囲のロジック確認 | コードレビュー: removePane の `set({ panes: rest, ... })` 後に cleanup を発火するため、UI から pane が消えた直後に async で localStorage が清掃される。既存 streaming / interrupt / sidecar event 経路は触っていないため副作用ゼロ。 |
| editor / terminal pane 影響 | `inputCollapsedByPane` は chat pane 専用 (InputArea は ChatPanel 内のみ存在)。editor.removeEditorPane / terminal.removeTerminalPane への cleanup cascade 追加は不要 (孤児 entry が発生しえない)。 |

### 残課題（M-1 範囲外、繰越）

- 新規 E2E ケース「pane 縮退で localStorage 孤児 entry が残らないこと」は時間優先で見送り（要件で許容）。v1.37.0 の追補 spec として記録。
- ガードレール準拠: Minor 指摘 (m-1 focus ring / m-2 Ctrl+Shift+I devtools 衝突 / m-3 pb-12 コメント / m-5 kbd aria-hidden) には一切手を出していない（v1.37.0 へ繰越）。

### CEO への引き渡し

- M-1 修正は完了（typecheck PASS）。コードレビューレベルでは regression 無し。
- E2E は環境制約により未実行。CEO 側で (a) release CI に任せる、または (b) 別ポートでローカル再検証 のいずれかを判断ください。
- バージョン番号は **v1.36.0 のまま** (タグ未打ち時点の patch、bump 不要)。
- 次のステップ: CEO による commit + tag (v1.36.0) push。
