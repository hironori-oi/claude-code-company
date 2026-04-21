# PM-924: Editor / Terminal SplitView 対応

- **案件**: PRJ-012 ccmux-ide-gui
- **担当**: dev（build-error-resolver agent 経由）
- **日付**: 2026-04-20
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **ブランチ**: （未切替、作業ツリー直）
- **工数実績**: 約 2h
- **関連既存機能**: PM-810 / v3.5 Chunk B（Chat の SplitView 導入）

## 目的

現状 Chat タブのみ左右分割可能だった `SplitView` UX を、Editor と Terminal にも同じ操作感で拡張する。

## 設計判断：Approach A（最小 diff + store 最小拡張）を採用

依頼書で比較された 2 案のうち、**Approach A** を採用した。理由は以下の通り。

- Chat 側 PM-810 が既に同構成（`panes: Record<paneId, ChatPaneState>` + `activePaneId` + `addPane`）で実装済み。同じ形にそろえることで、将来 4 pane 拡張時の mental model が共通化する。
- Approach B（store 内で完全 multi-pane 化）は大規模 refactor になり、レビュー／QA コストが跳ね上がる。本タスクの完了条件（左右 2 pane の split 追加）を満たすだけなら不要。
- `openFiles`（Editor）と `terminals`（Terminal）のリソースプールは pane を跨いで共有した方が自然（例: 同じファイルを両 pane で開く VSCode 的 UX、pty は一意に存在する必要がある）。これは Approach A の「pane は参照リストのみ持つ / リソースは pool で共有」と相性が良い。

### 具体設計

**Editor:**
- `openFiles: OpenFile[]`（既存、content プール）は**全 pane 共有**。1 file が複数 pane に出現可能。
- 新規に `editorPanes: Record<paneId, { openFileIds: string[]; activeFileId: string | null }>` を導入。
- `activeEditorPaneId: string` で focus pane を追跡。
- 既存 action（`openFile` / `closeFile` / `closeOtherFiles` / `setActiveFile`）にオプショナル `paneId` 引数を追加。省略時は `activeEditorPaneId` に作用（後方互換）。
- `activeFileId` state は「active pane の activeFileId」の投影として維持し、既存呼出元が壊れないようにする。
- `addEditorPane` / `removeEditorPane` / `setActiveEditorPane` を追加。
- persist は `version: 2` へ bump。`migrate()` で v1 (`openFiles` + `activeFileId`) を main pane にロスなく移行。

**Terminal:**
- `terminals: Record<ptyId, TerminalState>`（既存）は共有のまま。
- `TerminalState` に **optional** `paneId?: string` を追加（未指定=main 扱い）。
- 新規に `terminalPanes: Record<paneId, { activeTerminalId: string | null }>` を導入。
- `activeTerminalPaneId: string` で focus pane を追跡。
- `createTerminal` / `setActiveTerminal` にオプショナル `paneId` 引数を追加。
- `addTerminalPane` / `removeTerminalPane` / `setActiveTerminalPane` を追加。`removeTerminalPane` は当該 pane 所属 pty を全 kill する。
- persist なし（既存設計そのまま / Rust 側で pty 生存しないため）。

**分割ボタン:**
- `Shell.tsx` の分割ボタンを `viewMode: "chat" | "editor" | "terminal"` で共通化。viewMode に応じて `addPane` / `addEditorPane` / `addTerminalPane` を呼び分ける。disabled 条件と tooltip も同様に切替。

## MAX_PANES の扱い

Chat の既存定数 `MAX_PANES = 2` をそのまま流用するのではなく、**store ごとに定数を分離**して将来的な拡張に備えた：

- `lib/stores/chat.ts` : `MAX_PANES = 2`（既存）
- `lib/stores/editor.ts` : `EDITOR_MAX_PANES = 2`（新規）
- `lib/stores/terminal.ts` : `TERMINAL_MAX_PANES = 2`（新規）

全て 2 に揃えて現状は等価。将来 Editor だけ 3 pane にしたい、などの要望に個別対応できる。

## 変更ファイル一覧

### 新規

| ファイル | 役割 |
|---|---|
| `components/editor/EditorPaneItem.tsx` | 1 pane 分の editor container（タブバー + FileEditor + dirty close dialog）。旧 EditorPane + EditorTabs のロジックを pane スコープに移植。 |
| `components/terminal/TerminalPaneItem.tsx` | 1 pane 分の terminal container（sub-tab + 新規ボタン + auto-spawn + xterm mount）。旧 TerminalView のロジックを pane スコープに移植。 |

### 変更

| ファイル | diff 要約 |
|---|---|
| `lib/stores/editor.ts` | `EditorPaneState` / `editorPanes` / `activeEditorPaneId` / pane lifecycle action 追加。action 引数に optional `paneId` を追加（後方互換）。persist v1→v2 migrate を実装。`EDITOR_DEFAULT_PANE_ID` / `EDITOR_MAX_PANES` export。 |
| `lib/stores/terminal.ts` | `TerminalState.paneId?` / `TerminalPaneState` / `terminalPanes` / `activeTerminalPaneId` / pane lifecycle action 追加。`createTerminal` / `setActiveTerminal` に optional `paneId` 追加。`closeTerminal` が pane の activeTerminalId を同期更新。`TERMINAL_DEFAULT_PANE_ID` / `TERMINAL_MAX_PANES` export。 |
| `components/editor/EditorPane.tsx` | 単一 pane 実装 → `SplitView` + `EditorPaneItem` の wrap に置換。全 pane 空時は既存の空状態カードを表示（初回 UX 継続）。 |
| `components/terminal/TerminalView.tsx` | 単一 pane 実装 → `SplitView` + `TerminalPaneItem` の wrap に置換。pty の sub-tab 管理 / auto-spawn は `TerminalPaneItem` 側へ移動。 |
| `components/layout/Shell.tsx` | 分割ボタンの表示条件を `viewMode === "chat"` 固定 → 3 mode 共通化。`splitButton` ローカル変数で onClick / disabled / tooltip を viewMode 別に算出。 |

### 変更なし（明示）

- `components/editor/FileEditor.tsx` — paneId 非依存（openFileId prop のみ）で既に完結、触らず。
- `components/editor/EditorTabs.tsx` — 新構成で未使用になるが削除せず残置（dead code、将来の clean-up で除去予定）。diff 最小化のため。
- `components/terminal/TerminalPane.tsx` — ptyId prop のみで動作、PM-923 が同時に触っているため触らず。
- `components/chat/InputArea.tsx` — PM-923 担当、触らず。
- sidecar / Rust 側 — 無変更（frontend only）。

## 動作確認

### 静的チェック

- `npx tsc --noEmit` → **0 error** (EXIT=0)
- `npx next build` → **成功** (EXIT=0)。7 route 全て出力、warning は既存の未使用変数 / `<img>` / `role=treeitem` aria 等で本タスクと無関係。

### Chat regression

- Chat 分割（PM-810 の paneId routing）は **chat store / ChatPanel を一切触っていない** ため機能的に無変化。Shell の分割ボタン UI は if/else → 共通化しただけで Chat への経路は温存。

## オーナー実機検証手順

1. **起動**: `C:\Users\hiron\Desktop\ccmux-ide-gui\` で `pnpm tauri:dev`（現在停止中なのでユーザー側で手動起動）。
2. **Editor 分割**:
   1. 左サイドバーから適当なファイルを 1 つクリック → エディタに表示。
   2. タブ領域右上の **「分割」ボタン**（SplitSquareHorizontal icon）をクリック。
   3. 画面が左右 2 pane に分割され、右 pane は「このペインは空です」メッセージ表示。
   4. 右 pane にフォーカス（どこかクリック）した状態で、左サイドバーから別ファイルをクリック → 右 pane で open。
   5. **左 pane と右 pane で別々のファイル** が表示されていることを確認。
   6. 右 pane のヘッダ × ボタンで pane close → 1 pane に戻る。閉じた pane にしかなかった file は自動で閉じる。
   7. 再度分割 → 同じファイルを両 pane で開く → 片方で編集 → 自動で他方にも反映（content プール共有のため）、保存も 1 回で OK。
3. **Terminal 分割**:
   1. Terminal タブに切替。main pane に pty が 1 本自動起動。
   2. 「分割」ボタン → 右 pane が追加され空状態「『+新規』でこのペインにターミナルを起動してください」表示（auto-spawn は main pane のみ / 意図的に無効化、ユーザーが想定しない 2 本起動を防ぐため）。
   3. 右 pane の「+新規」ボタンで pty を起動 → 右 pane で独立 sub-tab として動作。
   4. 左 / 右 pane それぞれで独立に sub-tab 追加 / 削除できることを確認。
   5. 右 pane ヘッダ × → pane 閉じると **所属 pty は全て kill** される（`removeTerminalPane` 内で `pty_kill` fire-and-forget 実行）。
4. **Chat regression**:
   1. Chat タブに切替 → 既存どおり分割ボタン / session 切替 / paneId routing が動作することを確認（特に streaming 中の message / activity dot / ImagePasteZone → activePane）。
5. **viewMode 切替**:
   1. Chat / Editor / Terminal を行き来 → 各 mode の split 状態がそれぞれ保持される（display:none で mount 維持）。
6. **再起動**:
   1. Editor で 2 pane 状態のままアプリ再起動 → split 状態が復元されることを確認（persist v2 migrate が効く）。
   2. Terminal は pty 自体が Rust 側で消える設計のため、main pane に auto-spawn 1 本から再開。

## 留意点 / 既知の制約

- **Terminal の split 新規 pane は auto-spawn しない**：要件的に「split ボタン押下で勝手に pty が 2 本起動する」のはユーザーの想定外になりうるため、main pane のみ初回 auto-spawn を維持し、分割 pane は明示「+新規」で起動する仕様とした。オーナー指示があれば `TerminalPaneItem.tsx` の `paneId !== TERMINAL_DEFAULT_PANE_ID` ガードを外せば全 pane で auto-spawn する。
- **EditorTabs.tsx は dead code 化**：新構成で import されなくなったが、diff 最小化のため削除していない。次回 clean-up で除去。
- **PM-923 / PM-925 との競合**：PM-923 が触る `InputArea.tsx` / `TerminalPane.tsx` の theme、PM-925 の新規ブラウザ機能調査、いずれも本変更範囲と衝突なし。Terminal の xterm 描画 (`TerminalPane.tsx`) は ptyId prop のみで動作するため、PM-923 の theme 変更が来ても merge conflict は発生しない見込み。
- **MAX_PANES = 2 制約**：Chat に合わせた。将来 4 pane に拡張する場合は 3 store の定数を同時に変える + `SplitView` の `defaultSize` / `order` 計算を 4 pane 対応にする必要あり（現状は 50/50 固定）。

## CEO への報告サマリー

- PM-924 完了。Editor / Terminal に Chat と同等の左右分割 UI を追加。
- 完了条件（tsc 0 error / next build 成功 / Chat regression なし）を満たした。
- 実機検証はオーナーが `pnpm tauri:dev` で確認予定。手順は本レポート末尾を参照。
- 他 Agent（PM-923 / PM-925）との衝突は設計上なし。
