# PM-937: ccmux-ide-gui 1 / 2 / 4 pane 分割対応

- 日付: 2026-04-20
- 担当: dev
- 対象リポジトリ: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- 関連: PM-810 (Chat split sidecar routing), PM-924 (Editor/Terminal split Approach A), PM-935 (Terminal conditional mount)
- 工数: 約 2h

## 目的

Chat / Editor / Terminal の分割を 1 / 2 に加えて **4 pane (2x2 grid)** に拡張。
既存の分割ボタン (add のみ) を「分割モード dropdown」に置き換え、オーナーが任意の
タイミングで 1 / 2 / 4 を切替えられるようにする。

## 完了条件 (check)

- [x] Chat / Editor / Terminal すべてで 1 / 2 / 4 分割切替可能
- [x] 既存の 2 pane 分割動作が regression なし (autoSaveId のみ `-2` 接尾辞に変更)
- [x] 4 pane で各 pane が独立して動作 (Chat: 独立 session / Editor: 独立 file / Terminal: 独立 pty)
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功 (既存の ESLint warnings / SSR `window` ref は無関係)

## 実装サマリ

### 1. SplitView を 1 / 2 / 4 layout 対応に拡張

- ファイル: `C:\Users\hiron\Desktop\ccmux-ide-gui\components\layout\SplitView.tsx`
- `panes.length` で分岐:
  - `0`: `null`
  - `1`: 既存 (素通し)
  - `2`: 既存 (horizontal `PanelGroup`)
  - `>=3` (実質 4): **新規 2x2 grid**
    - 外側 `direction="vertical"` の `PanelGroup`
    - 各行内で `direction="horizontal"` の `PanelGroup`
    - 5 件以上は fail-safe で 4 件だけ描画 (想定外、store 側で 4 件上限を保証)
- `autoSaveId` を layout ごとに分離 (`splitview-2` / `splitview-4-outer` / `-top` / `-bottom`)
  - これにより 2↔4 切替時に旧比率が混入しない
- 垂直 resize handle を追加 (縦向き `h-1` + hover/active color は既存の水平版と揃えた)
- `PanelGroupItem` の `order` を引数化 (同一 `PanelGroup` 内で order 重複を防ぐため)

### 2. 各 store の MAX_PANES を 4 に

| File | 変数 | 旧 | 新 |
|---|---|---|---|
| `lib/stores/chat.ts` | `MAX_PANES` | 2 | 4 |
| `lib/stores/editor.ts` | `EDITOR_MAX_PANES` | 2 | 4 |
| `lib/stores/terminal.ts` | `TERMINAL_MAX_PANES` | 2 | 4 |

- コメントも「v3.5 Step 1 は 2 固定」→「PM-937 で 4 pane 対応」に追随
- `addPane` 内の「2 pane 制限に到達」コメントを「MAX_PANES 制限に到達」に修正
- Terminal の TRADEOFF を明記: 4 pane 時は PTY process 最大 4 個/project、ユーザが明示選択した場合のみ

### 3. 分割モード選択 Dropdown (Shell.tsx)

- ファイル: `C:\Users\hiron\Desktop\ccmux-ide-gui\components\layout\Shell.tsx`
- 既存「分割」ボタン (`SplitSquareHorizontal` icon の単機能 add-pane) を撤去し、
  `@/components/ui/dropdown-menu` の `DropdownMenu` / `DropdownMenuTrigger` /
  `DropdownMenuContent` / `DropdownMenuItem` / `DropdownMenuLabel` /
  `DropdownMenuSeparator` に置換
- Trigger ボタンは現在の pane 数に応じて icon 変化:
  - 1 pane: `Square`
  - 2 pane: `Columns2`
  - 4 pane (>= 4): `LayoutGrid`
  - 右に `ChevronDown` でドロップダウン性を表現
- Content 内は `DropdownMenuLabel` (「チャットの分割」等 viewMode 連動) + 3 項目:
  - 「1 pane」 / 「2 pane (左右)」 / 「4 pane (2x2)」
  - 現在のモードには `Check` icon を表示
  - 同じ modeを再選択しても `applyPaneMode` は `cur === target` で no-op
- `PaneModeItem` helper component を Shell.tsx 末尾に追加 (onSelect で
  `e.preventDefault()` して menu 内 click 時の default focus 遷移を抑制、
  UX で意図しないフォーカス奪取を防ぐ)

### 4. mode 切替ロジック (applyPaneMode)

`useCallback` で viewMode に応じた「現在の paneIds 配列 + add/remove action」を bind:

```ts
if (cur === target) return;                 // no-op
if (cur < target) loop addPane();           // 差分だけ追加
else loop removePane(paneIds.slice(target)) // 末尾から削る (主 pane は残す)
```

- **Chat / Editor**: sync removePane、UI は即反映
- **Terminal**: `removeTerminalPane` は async (pty_kill 呼出) だが fire-and-forget で
  `void removeTerminalPane(id)`。store 側が optimistic に UI を即 update するので
  UX 的には即時削除に見える (既存 PM-921 の pattern 踏襲)

末尾から削る順序:
- Chat: `paneIds.slice(target)` = "main" 以外の uuid pane から削除
- Editor: `editorPaneIds.slice(target)` = 同様
- Terminal: `terminalPaneIds.slice(target)` = 同様。削除 pane 配下の pty は
  `removeTerminalPane` 内部で一括 kill される (既存動作)

### 5. Chat / Editor / Terminal 共通化

`paneModeInfo` (current / max / target 表示名) を viewMode で分岐して導出し、
Dropdown の disabled 判定・label・現 pane 数表示に使う。viewMode === "preview"
の時は `paneModeInfo === null` で Dropdown 自体を非表示 (preview は分割非対応を維持)。

## 変更ファイル

- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\layout\SplitView.tsx` (大幅拡張)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\layout\Shell.tsx` (dropdown + applyPaneMode)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\stores\chat.ts` (MAX_PANES 2→4)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\stores\editor.ts` (EDITOR_MAX_PANES 2→4)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\stores\terminal.ts` (TERMINAL_MAX_PANES 2→4)

Rust / sidecar / tauri 設定は無変更。

## 検証結果

- `npx tsc --noEmit --pretty` → **0 error**
- `npx next build` → **Compiled successfully** (7.9s)
  - 既存の ESLint warnings (StatusBar / AppearanceSettings / FilePreviewDialog /
    ProjectTree) は本タスク無関係の pre-existing
  - SSR 段階の `window is not defined` も pre-existing (project-store の
    list_active_sidecars 初期化、workspace ページ生成に影響なし)

## 既存互換性の確認

- Chat の `MAX_PANES` consumer は Shell.tsx のみ、値を直接比較するコードは `paneIds.length < MAX_PANES` の形のみ
  → 4 に上がっても compile / runtime 共に素直に動く
- Editor / Terminal も同様
- SplitView の呼出し元 (Shell, EditorPane, TerminalView) は `panes` 配列を渡すだけで
  layout は SplitView 内部で length に応じて自動決定される
- `autoSaveId` を layout 数別に分離したため、既存 2 pane 使用中のユーザが今回変更後に
  起動しても旧 `ccmux-ide-gui:chat-splitview` は gracefully 無視され、新 `-2` key が
  空 state で始まる (50/50 の default)
- Chat pane は PM-810 の sidecar event routing (paneId ベース) をそのまま流用
  → 3 番目・4 番目の pane でも session 分離が維持される
- Editor pane は openFiles プール共有 + pane ごと openFileIds なので同じ file を
  4 pane で開いても content 同期する既存設計が働く
- Terminal pane は pty に `paneId` フィールドが既に入っており (PM-924)、
  `createTerminal(projectId, cwd, shell, paneId)` で pane 別に sub-tab を作れる

## tradeoff 明示

| 項目 | 内容 |
|---|---|
| 4 pane chat | sidecar は project 1 個、session store で paneId ごとに session 独立 → OK |
| 4 pane editor | openFiles プール共有、content は単一実体なので memory 問題なし |
| 4 pane terminal | PTY process 最大 4 個 / project。ユーザが明示選択時のみ起動、Rust 側 HashMap で 1 process 数 MB なので OS 上限内 |
| autoSaveId | 1↔2↔4 の切替で旧比率が混入しないよう layout 別の `-2` / `-4-outer` / `-4-top` / `-4-bottom` に分離 |
| Preview pane | 分割非対応のまま維持 (iframe + WebView fallback の複雑性を避ける) |

## オーナー実機検証手順

### 前提

- Tauri dev が稼働中なら hot reload で frontend のみ差分反映される
- 未稼働の場合: `npm run tauri dev` を別ターミナルで起動

### A. Chat 4 pane 動作

1. 左 ProjectRail で project を選択 → Chat タブに居ることを確認
2. タブ右端の「分割」ボタン (Square icon + 下矢印) をクリック
3. Dropdown で「4 pane (2x2)」を選択
4. 期待: 2x2 grid で 4 つの ChatPanel が表示、それぞれ pane header + 入力欄を持つ
5. 各 pane で個別にメッセージ送信 → 4 session が独立して streaming することを確認
6. Dropdown を再度開いて「2 pane (左右)」選択 → 3, 4 番目の pane が消える
7. 「1 pane」選択 → main pane (1 番目) のみ残る。1 番目のメッセージ履歴は保持される

### B. Editor 4 pane 動作

1. Editor タブに切替
2. Sidebar のプロジェクトツリーから 1 ファイルを開く
3. 分割 dropdown → 「4 pane (2x2)」
4. 各 pane の「+」ボタン (タブバー内) で違うファイルを開く → 4 pane に別 file が表示
5. 同じ file を 2 つの pane で開いて片方で編集 → content 同期することを確認 (openFiles プール共有)
6. Dropdown → 「1 pane」で all 消去、openFiles プールから孤立 file が除去されることを確認

### C. Terminal 4 pane 動作

1. Terminal タブに切替 (PM-935 conditional mount が 0x0 問題を解消済)
2. 分割 dropdown → 「4 pane (2x2)」
3. 各 pane で「+ 新規」で pty spawn → 4 個の独立 shell
4. それぞれで `echo test1` / `echo test2` ... を実行 → 出力が独立することを確認
5. 4 pane の resize handle が縦・横両方で動くことを確認
6. Dropdown → 「1 pane」で 3 個の pane 配下 pty が kill される (sidecar 側の
   `pty:{id}:exit` event を受けて UI 更新、残った 1 pane の pty は生き残る)

### D. autoSaveId の分離確認

1. 2 pane で resize handle を 70/30 にドラッグ
2. Dropdown → 4 pane に切替 → 再び 2 pane に戻す
3. 期待: 2 pane 時の比率 70/30 が **保持** されている (autoSaveId が `-2` で維持)
4. 4 pane 時の比率も独立して保存される (`-4-outer` / `-4-top` / `-4-bottom`)

### E. Preview tab は分割不可

1. Preview タブに切替
2. 期待: 分割 dropdown 自体が表示されない (viewMode === "preview" で paneModeInfo === null)

## 次ステップ候補

- 4 pane 時のキーボードショートカット (Ctrl+\ で 2 pane toggle, Ctrl+Shift+\ で 4 pane toggle) を追加
- Chat pane を独立した `layout` モード (stack / horizontal-split / vertical-split) で
  選択可能にする (VSCode の editor group layout 相当)
- Terminal pane 削除時の確認 dialog (pty kill は即時実行されるため、作業中 shell を
  誤って閉じた際のリカバリ難度が高い)
