# PRJ-012 Sidebar タブ順序変更 リリースレポート

- **リリース ID**: pm-release-sidebar-tab-order
- **日付**: 2026-04-20
- **担当**: dev (サブエージェント)
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **対象バージョン**: v3.5.8（Sidebar 内部コメントの改版番号）

## 背景 / 要望

オーナーから「Sidebar の左タブ順を変更してほしい」との指示。
PM-770 dead code 削除レポートで「4 タブ: ファイル / セッション / ルール / 実行状態」と記載
されていた現状構成に対し、**初回起動時に最も使う導線であるセッションを先頭に持ってきたい**
という UX 要求。

### Before / After

| 順 | Before           | After            |
| -- | ---------------- | ---------------- |
| 1  | ファイル         | **セッション**   |
| 2  | セッション       | **ファイル**     |
| 3  | ルール           | ルール           |
| 4  | 実行状態         | 実行状態         |

加えて **default active tab** は `"files"` → `"sessions"` に変更。

## 変更ファイル一覧

| ファイル | 変更内容 |
| -------- | -------- |
| `components/sidebar/Sidebar.tsx` | TABS 配列順変更 / `SidebarTabId` 型の union 順変更 / default `useState<SidebarTabId>` を `"sessions"` に変更 / JSDoc ヘッダコメント更新 / 変更履歴コメント追記 |

**変更範囲は `components/sidebar/Sidebar.tsx` の 1 ファイルのみ。** Shell.tsx や
Rust 側、他 Sidebar 配下ファイル（`ProjectTree.tsx` / `SessionList.tsx` / `ContextGauge.tsx`
等）には一切手を入れていない。

## diff 要約

### 1. TABS 配列の順序変更（最も核となる変更）

```diff
 const TABS: Array<{ ... }> = [
+  {
+    id: "sessions",
+    label: "セッション",
+    icon: MessageSquare,
+    tooltip: "チャットセッション一覧",
+  },
   {
     id: "files",
     label: "ファイル",
     icon: FolderTree,
     tooltip: "プロジェクトのファイル一覧",
   },
-  {
-    id: "sessions",
-    label: "セッション",
-    icon: MessageSquare,
-    tooltip: "チャットセッション一覧",
-  },
   {
     id: "memory",
     label: "ルール",
     ...
   },
   {
     id: "monitor",
     label: "実行状態",
     ...
   },
 ];
```

展開時の水平タブバー (`grid-cols-4`) と、折畳み時の icon rail (`<nav>`) は
どちらも `TABS.map(...)` で同じ配列を走査しているので、**1 か所の配列変更で両方の
表示順が同期**する（icon rail 側の順序不一致リスクはゼロ）。

### 2. Type union の順序も整合

```diff
-export type SidebarTabId = "files" | "sessions" | "memory" | "monitor";
+export type SidebarTabId = "sessions" | "files" | "memory" | "monitor";
```

型的には順不同だが、**コードを読んだ人が「左から順にこの順で並ぶ」と誤認しないよう**
union 順も UI と一致させた。

### 3. default active tab 変更

```diff
-  const [activeTab, setActiveTab] = useState<SidebarTabId>("files");
+  const [activeTab, setActiveTab] = useState<SidebarTabId>("sessions");
```

### 4. JSDoc / コメント更新

- ファイル冒頭の JSDoc 「タブ構成」リストを新順序 + default active tab 明記に更新。
- 「v3.5.8 (2026-04-20): オーナー要望によりタブ順を…変更」の変更履歴コメントを追加。

## default tab を `"sessions"` にした理由

1. **ユーザー体験の中核**: ccmux-ide-gui は **Claude Code マルチプロジェクト IDE** で
   あり、最も頻度の高い操作は「新規セッション起動 / 既存セッション再開」。
   ファイルツリーはあくまで補助的な参照手段。
2. **初回起動の視線導線**: プロジェクト rail で project を選択 → **sidebar 左列で
   最初に目に入るのがセッション一覧** であるほうが、Cursor から乗り換えた
   ユーザーの学習コストが低い（PRJ-012 の核心価値「Cursor 切替困難の解消」と一致）。
3. **既存ユーザーへの影響ゼロ**: `ACTIVE_TAB_STORAGE_KEY = "ccmux-sidebar-tab"` に
   よる localStorage 永続化があるため、過去に別タブを選んでいたユーザーは
   その状態が復元される。default 値が効くのは **localStorage に何も保存されていない
   新規ユーザーのみ**。

## 副作用チェック

- **tab index ベースで記憶している state**: 存在しない。
  grep で `activeTab` / `tab.id` / `sidebar-panel-` を走査した結果、全て
  tab の `id`（文字列リテラル `"sessions"` / `"files"` / `"memory"` / `"monitor"`）で
  参照されている。インデックス番号依存の処理はなし。
- **localStorage キー**: `ccmux-sidebar-tab` に保存されるのも `id` 文字列なので、
  順序変更の影響を受けない。
- **aria-controls / role="tabpanel"**: id ベースで紐付けられているため整合性維持。
- **collapsed 時の icon rail**: 同じ TABS 配列を共有するため、自動的に新順序で並ぶ。
- **外部参照**: `SidebarTabId` / `TABS` / `ccmux-sidebar-tab` の 3 シンボルを
  リポジトリ全体で grep したが、参照は `Sidebar.tsx` 内部のみ。外部への波及なし。

## 品質チェック

| 項目 | 結果 |
| ---- | ---- |
| `npx tsc --noEmit` | **0 error** (exit 0) |
| 変更ファイル数 | 1 (`components/sidebar/Sidebar.tsx`) |
| Shell.tsx / Rust 側への影響 | なし（別 Agent の Terminal 本格版実装と非衝突） |

## 並列 Agent との衝突確認

並列実行中の Terminal 本格版実装 Agent は
`components/layout/Shell.tsx` / 新規 terminal file 群 / Rust 側を触る範囲のため、
**本作業（`components/sidebar/Sidebar.tsx` 単独編集）とはファイル重複なし**。
マージコンフリクトは発生しない見込み。

## 完了条件チェック

- [x] タブ順が「セッション → ファイル → ルール → 実行状態」に変更
- [x] default active tab が `"sessions"`
- [x] `npx tsc --noEmit` 0 error
- [x] 本レポート作成

---

以上、リリース完了。次のアクション: CEO に報告 → オーナーへ連絡。
