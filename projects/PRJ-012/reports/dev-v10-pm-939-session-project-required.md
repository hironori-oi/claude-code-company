# PRJ-012 / PM-939 / dev-v10 — セッションは必ずプロジェクトに紐づく（3 層 validate）

**Date:** 2026-04-20
**Scope:** ccmux-ide-gui v3.5.22
**Target Repo:** `C:\Users\hiron\Desktop\ccmux-ide-gui\`
**Status:** 完了 (cargo check 0 err / cargo test 105 pass / tsc 0 err / next build 成功)

---

## 背景

オーナーからの dogfood 指摘:

> プロジェクトが作成/選択されていない状態でもセッションが作成できてしまう。
> プロジェクト → セッション の順序を強制したい。

旧実装 (v5 Chunk B / DEC-032) は `activeProjectId = null` でも「未分類セッション」として DB に INSERT されていた。これを **新規作成時は拒否** に変更。既存の未分類セッションは読込 / 表示は従来どおり (SessionList の「未分類を表示」トグル経由で閲覧可能)。

## 実装方針

「3 層 validate」で、UI / Store / Backend のどの経路で呼ばれても最終的に rejected になるよう多重防御。

### Layer 1: UI disable (最外層)

ユーザーがそもそもクリックできない状態にする。

| 呼出元 | 実装 |
|---|---|
| `components/sidebar/SessionList.tsx` | 「+新規セッション」Button `disabled={!activeProjectId}`、`title` で理由提示、下に案内 `<p>` |
| `components/chat/ChatPaneHeader.tsx` | Dropdown 内「新規セッション」 `DropdownMenuItem` を `disabled` + サブテキスト表示 |
| `components/palette/CommandPalette.tsx` (Ctrl+K) | `CommandItem` を `disabled` + `（プロジェクトを先に選択）` を追記 |
| `components/chat/InputArea.tsx` (送信時自動作成) | 既存 guard (line 178) で activeProjectId null 時は送信ごと reject、createNewSession まで到達しない |

すべて handler 内にも `if (!activeProjectId) { toast.error(...); return; }` を置いて keyboard (Enter/Space) 経路の二重ガード。

### Layer 2: Store / handler level (防衛層)

`lib/stores/session.ts` の `createNewSession` 冒頭で `readActiveProjectId()` の結果が null なら `Error` を throw。呼出側の try/catch で `toast.error` が出る。

```ts
const projectId = await readActiveProjectId();
if (!projectId) {
  const err = new Error(
    "プロジェクトが選択されていません。左のレールからプロジェクトを作成/選択してから新規セッションを作成してください。"
  );
  set({ error: err.message, isLoading: false });
  throw err;
}
```

slash / keyboard shortcut / 将来追加される呼出経路にも自動適用される。

### Layer 3: Rust backend (最終防衛線)

`src-tauri/src/commands/history.rs` の `create_session` command で `project_id` が `None` または空文字なら `Err` 返却。frontend store でほぼ catch されるため通常は到達しないが、raw invoke 経路 (dev tools / 将来の test / 別 frontend) への defense。

```rust
let pid_present = project_id.as_deref().map(|s| !s.trim().is_empty()).unwrap_or(false);
if !pid_present {
    return Err("プロジェクトが選択されていません。...".to_string());
}
```

**DB schema 変更なし**。`sessions.project_id` は引き続き `TEXT DEFAULT NULL` (既存の未分類 session の後方互換のため NOT NULL にはしない)。

## 変更ファイル

| # | ファイル | 変更量 |
|---|---|---|
| 1 | `lib/stores/session.ts` | `createNewSession` 先頭に null guard 13 行追加 |
| 2 | `components/sidebar/SessionList.tsx` | Button disable + 案内 + EmptyState 分岐 約 30 行 |
| 3 | `components/chat/ChatPaneHeader.tsx` | import `useProjectStore`、DropdownMenuItem disable、handler guard 約 15 行 |
| 4 | `components/palette/CommandPalette.tsx` | import `useProjectStore`、CommandItem disable、handler guard 約 15 行 |
| 5 | `src-tauri/src/commands/history.rs` | `create_session` 冒頭に guard 11 行 |

他の呼出箇所 (`components/chat/ClearSessionDialog.tsx` / `components/chat/InputArea.tsx`) は Layer 2 の throw を既存 try/catch で自然に拾うため変更不要。

## 検証

| コマンド | 結果 |
|---|---|
| `npx tsc --noEmit` | 0 error |
| `cargo check` (src-tauri) | 0 error (既存 warning 3 件のみ、本変更由来ではない) |
| `cargo test --lib` | **105 passed; 0 failed** |
| `npx next build` | 成功 (Route 5 個すべて static export) |

既存 Rust ユニットテスト (`create_session_sql_accepts_project_id_none` 等) は SQL を直接叩くもので tauri command 層を通らないため、Layer 3 guard を足しても影響なし。

## 既存 orphan session の扱い

- DB 上に `project_id IS NULL` の session が残る可能性あり
- **本 PR では削除しない**（後方互換、履歴データ保全）
- SessionList の「未分類を表示」トグルで閲覧可能な状態は維持
- v1.1+ で cleanup script (orphan session を最も近い project に再 attach or 削除選択) の導入を検討
- SQL の WHERE 条件側 (`list_sessions`) は Layer 2/3 の影響なし

## オーナー実機検証手順

tauri dev は自動 hot reload されるはずだが、確実を期すなら WebView リロード (Ctrl+R) 推奨。

### ケース A: プロジェクト未選択 (新規起動直後 + 全プロジェクト削除後)

1. ProjectRail で全プロジェクトを登録解除、または起動直後で 0 件の状態にする
2. サイドバー「セッション」ペインを開く
   - 「+新規セッション」ボタンが **grayed out (disabled)** になっている
   - hover で tooltip 「先にプロジェクトを作成/選択してください」
   - ボタン下に案内テキスト「プロジェクトを選択するとセッションを作成できます」
   - 一覧領域の EmptyState が「プロジェクトを選択してください」に変わっている
3. Chat pane ヘッダの session ドロップダウンを開く
   - 「新規セッション」項目が disabled、下に「プロジェクトを選択してください」表示
4. Ctrl+K で CommandPalette を開く
   - 「新規セッション」項目が disabled、「（プロジェクトを先に選択）」が併記される
5. Chat 入力欄にテキストを打つ
   - Textarea が disabled、placeholder が「プロジェクトを選択してください（左のレールから ＋ で追加）」
   - 送信ボタンも disabled

### ケース B: プロジェクト選択済み (通常時)

1. 適当な project を登録 / 選択
2. 上記すべてのボタン / メニューが enabled に戻る
3. 「+新規セッション」で新規 session が作成でき、DB に `project_id` が attach される
4. Chat 送信で新 session 自動作成 → DB に正しく紐づいている

### ケース C: Layer 3 直接検証 (任意)

開発ツールの Tauri console から:
```js
await window.__TAURI__.core.invoke("create_session", {
  title: "test", projectPath: null, projectId: null
})
```
→ `Error: プロジェクトが選択されていません。プロジェクトを作成/選択してから新規セッションを作成してください。` が reject される。

## UX 設計メモ

- disabled ボタンは color opacity 低下のみ、レイアウトシフトなし
- tooltip / 案内文はすべて日本語統一 (`organization/rules/client-communication.md` 準拠)
- toast のレベル: `toast.error` (ユーザーの操作が拒否されたため、無視できない情報)
- EmptyState の文言は「プロジェクトが選ばれていれば自動作成される」旧案内を削除し、現方針に一致化

## リスク / 今後の作業

- **既存 orphan session の cleanup** (v1.1 候補): project が消された後に残る session を再 attach / 削除する UI
- **E2E tests**: playwright で「未選択状態 → disabled」「選択後 → enable」を cover する Case を追加 (本 PR 範囲外、PM-???)
- **Rust test for `create_session` command**: 現状 SQL のみテスト。tauri command 層の reject 分岐を integration test で cover したい (要 HistoryState 準備の雛形、既存 commands も未実装のため単独 PR で対応)
- **Layer 2 で throw した場合の React error boundary**: 呼出側はすべて `await + try/catch` で受けており、unhandled にはならない

## 完了条件チェックリスト

- [x] プロジェクト未選択時に UI 3 箇所 (SessionList / ChatPaneHeader / CommandPalette) で session 作成 button / item が disabled
- [x] InputArea からの送信も既存 guard (line 178) で session 自動作成前に reject される
- [x] session store の `createNewSession` が null projectId で reject
- [x] Rust `create_session` command が null/empty projectId で Err
- [x] `cargo check` 0 error
- [x] `cargo test --lib` 105 passed / 0 failed
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功
- [x] 既存 orphan session の扱いを明文化 (v1.0 では維持、v1.1 で検討)
- [x] オーナー実機検証手順を記載

---

**工数実績:** 約 1h (調査 20 分 / 実装 20 分 / 検証 + report 20 分)
**次のアクション:** CEO に報告 → オーナーで実機検証 → PM-940 へ移行
