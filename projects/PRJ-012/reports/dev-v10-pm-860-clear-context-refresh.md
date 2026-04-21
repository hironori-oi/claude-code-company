# dev-v10-pm-860: `/clear` コンテキストリフレッシュ修正レポート

- **案件**: PRJ-012 ccmux-ide-gui
- **タスク**: PM-860 `/clear` slash でコンテキストが完全にリフレッシュされないバグ修正
- **作業日**: 2026-04-20
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui`
- **修正ブランチ想定**: main（直接）/ または PM-860 feature branch

---

## 1. 現象（オーナー報告）

1. 会話を数ターン進める
2. `/clear` slash command 実行 → 画面上は空になる
3. **ブラウザリロード (F5) すると先ほどまでの会話履歴が復元してしまう**

オーナー要望: 「`/clear` を実行した場合はコンテキストが完全にリフレッシュされるように」

---

## 2. 原因分析（修正前コードの挙動 trace）

### 2.1 `/clear` の処理フロー

1. ユーザが `/clear` を入力 → `InputArea` の送信前 intercept
2. `lib/builtin-slash.ts` の `handleBuiltinSlash` が `/clear` を検知
   → `useDialogStore.getState().openClear()` で確認ダイアログを開く
3. `ClearSessionDialog` の「消去する」ボタン押下 → `handleConfirm` 実行

### 2.2 修正前 `ClearSessionDialog.handleConfirm` の実装

```ts
// 1) 永続化セッションがあれば SQLite から削除（best-effort）
if (currentSessionId) {
  try {
    await callTauri<void>("delete_session", { id: currentSessionId });
                                              ^^^^^^^^^^^^^^^^^^^^^^
                                              引数キーが間違っている
  } catch (e) {
    console.warn("[clear] delete_session failed:", e);
  }
}
// 2) frontend 側 chat state を初期化
clearSession();
setSessionId(null);
```

### 2.3 二重の根本原因

#### 原因 A: `delete_session` 呼出の引数キーが不正

Rust 側 `commands/history.rs` の `delete_session` シグネチャ:

```rust
#[tauri::command]
pub async fn delete_session(
    state: State<'_, HistoryState>,
    session_id: String,  // ← camelCase 化すると sessionId
) -> Result<(), String>
```

修正前は `{ id: currentSessionId }` で呼んでおり、Tauri 側の key match に失敗。
**毎回 silent fail** して catch 句の `console.warn` が出るだけで、DB 上の旧 session
が全く削除されていなかった（`session.ts deleteSession` は `{ sessionId }` で正しく渡している）。

#### 原因 B: project の `lastSessionId` write back 漏れ

`setSessionId(null)` の実装（`lib/stores/chat.ts:842-879`）は、`id` が truthy の時だけ
project store の `lastSessionId` を update する:

```ts
if (id && typeof window !== "undefined") {  // ← null では通らない
  // updateProject lastSessionId
}
```

結果、`/clear` 実行後:
- pane の `currentSessionId` = null（persisted）
- project の `lastSessionId` = **旧 session のまま**（残留）

### 2.4 リロード時に復元される経路

`ChatPanel.tsx` の snapshot-swap useEffect（v3.5.12 追加）:

```ts
// cache miss: persist 復元された currentSessionId を最優先（リロード復元）、
// 次に project の lastSessionId、どちらも無ければ clear。
const persistedSessionId =
  useChatStore.getState().panes[paneId]?.currentSessionId ?? null;
const sessionToLoad = persistedSessionId ?? lastSessionId;
//                    null (clear した)    旧 session id（残留）
if (sessionToLoad) {
  await useSessionStore.getState().loadSession(sessionToLoad);
  // ← 旧 session の messages を DB から復元！
}
```

`/clear` で `persistedSessionId` が null になっても、`lastSessionId` が残っているため
fallback で旧 session がロードされてしまう。かつ原因 A により旧 session の DB row も
消えていないので、messages が復元できてしまう。

**→ オーナー報告の「リロードで会話履歴が復元する」が再現する。**

---

## 3. 修正内容

### 3.1 方針（オーナー指定どおり・Claude Desktop / Claude Code CLI と同等）

1. `createNewSession()` で新しい空 session を作成
2. 旧 session は **削除しない**（DB に残る → セッション一覧から閲覧可能）
3. 新 session は `sdkSessionId = null` で始まる → 次回送信時 resume なし
   = Claude 側にも新規会話として認識される

### 3.2 なぜ新 session 作成で問題が解決するか

`useSessionStore.createNewSession()` は内部で以下を行う（`lib/stores/session.ts:189-217`）:

1. Rust `create_session` 呼出（activeProjectId 自動 attach）
2. `useChatStore.getState().clearSession()` で現 pane の messages / attachments を空に
3. `useChatStore.getState().setSessionId(newSession.id)` で currentSessionId を切替
   → この setSessionId 内で project の `lastSessionId` も自動で新 session に write back

結果、`/clear` 後の状態:
- pane `currentSessionId` = 新 session id（空）
- project `lastSessionId` = 新 session id（空）
- 旧 session は DB / session list にそのまま残留

リロード後の復元経路:
- `persistedSessionId` = 新 session id
- `loadSession(newId)` → DB に messages なし → 空表示を保持
- 次回送信時: sdkSessionIdCache に新 session の entry なし → resume なしで送信

### 3.3 diff 要約

変更ファイル: `components/chat/ClearSessionDialog.tsx`（1 ファイルのみ、最小 diff）

- **削除**: `callTauri<void>("delete_session", ...)` 呼出（引数キー不正 + 仕様変更で不要）
- **削除**: `clearSession()` / `setSessionId(null)` 直接呼出
- **追加**: `useSessionStore.getState().createNewSession()` 1 行
- **保険**: `clearAttachments()` 明示呼出（createNewSession → clearSession 側で既にクリアされるが冗長化）
- **更新**: toast メッセージを「会話をリセットしました。次の送信から新規 Claude セッションです」に
- **更新**: ダイアログ文言を「消去」→「リセット」に変更（履歴は残ることを明示）
- **更新**: 冒頭 JSDoc に PM-860 の修正経緯 + 新仕様を追記

仕様上不要になった import を削除（`callTauri` / 直接的な `clearSession` / `setSessionId` 参照）、
追加で `useSessionStore` を import。

### 3.4 行数変化

修正前: 93 行 / 修正後: 105 行（コメント拡充分を含む、コード行は実質 15 行程度 → 12 行）

---

## 4. 旧 session を残す設計理由

### 4.1 オーナー要件

「旧 session は DB に残す（履歴として閲覧可、session 一覧に表示）」

### 4.2 UX 上の根拠

- Claude Desktop / Claude Code CLI の `/clear` はコンテキストをリセットするだけで、
  履歴を削除しない（サイドバーから過去会話に戻れる）。同等挙動が期待される。
- `/clear` を「誤爆」しても履歴から辿り直せる保険。
- 完全削除したい場合は SessionList 側の右クリックメニュー（`deleteSession` 経由）で
  明示的に削除する導線が別途存在する。

### 4.3 技術上の根拠

- 旧 session の `sdkSessionId` は DB に残り、将来 session 一覧から resume する際に
  正しく Claude 側の会話 id にも繋がる（履歴閲覧専用にする場合は sdkSessionId を
  無視して単に messages を read-only 表示すればよい）。
- `ON DELETE CASCADE` の cascade 削除を避けられるため、間接的に attachments / files
  の誤削除リスクも下がる。

---

## 5. 検証手順（オーナー実機検証用）

### 5.1 事前準備

- `cd C:\Users\hiron\Desktop\ccmux-ide-gui`
- `npm run tauri dev` （もしくは既存の tauri dev プロセスが稼働していれば Next hot reload で反映）

### 5.2 検証ステップ

1. プロジェクトを 1 つ選択（未選択だと createNewSession が未分類で作られるので注意）
2. Claude に何か送信して 2〜3 ターン会話
   - 例: 「hello」「what's 2+2」「write a haiku」
3. `/clear` を入力して送信 → 確認ダイアログが開く
4. 「リセットする」をクリック
   - 期待: toast「会話をリセットしました。次の送信から新規 Claude セッションです」
   - 期待: 画面上の messages が即座に空になる
5. **サイドバーの SessionList を確認**:
   - 旧 session が `history` として残っていること（タイトル / 時刻で確認可能）
   - 新 session も表示されること（最新の空 session）
6. **ブラウザリロード (F5)**:
   - 期待: 画面は空のまま、旧 messages が復元されない ← **本修正のコア**
7. 新しく「hello」と送信:
   - 期待: Claude が「初対面」として応答する（「前のやり取りで〜」等の文脈を持たない）
   - 期待: sidecar の `sdk_session_ready` event で新 session に sdkSessionId が attach される
8. 旧 session をサイドバーから選択:
   - 期待: 過去の会話履歴が DB から loadSession で復元され、閲覧可能

### 5.3 異常系の確認

- プロジェクト未選択状態で `/clear` → activeProjectId が null → 未分類 session が作成される
  （この挙動は session.ts の仕様どおり、破壊的ではない）
- `createNewSession` が例外で失敗した場合 → toast.error「セッションの初期化に失敗しました」
  + 旧 session がそのまま残る（UX 上「失敗した」だけ、画面の整合性は維持）

---

## 6. 静的検証

- `npx tsc --noEmit` → **EXIT 0**（0 error）
- 触ったファイル: `components/chat/ClearSessionDialog.tsx` のみ
- 並列実行中の他 Agent (PM-810 / PM-831) との衝突なし
  - `InputArea.tsx` / `useAllProjectsSidecarListener.ts` / `Message*.tsx` に変更なし
  - builtin-slash.ts / chat.ts / session.ts は **読み取り専用** で調査のみ
- Rust / sidecar 側への変更なし（frontend only）

---

## 7. 未対応 / 将来課題

### 7.1 「旧 session の sdkSessionId 流用」による意図せぬ resume リスク

現在の session store の実装では、SessionList から旧 session を再選択すると
sdkSessionId 経由で Claude 側の元会話を resume できる。`/clear` の意図が
「完全にコンテキストを切る」なら、旧 session を閲覧可能にしても resume は
ブロックする UX の方が厳密かもしれない。ただしオーナー要件では「履歴として閲覧可」
とあり、現時点では resume 可能のまま残す。PM-870 以降で再検討。

### 7.2 lastSessionId 残留に対する防御層

本修正で根治したが、`setSessionId(null)` を呼んだ時に project の lastSessionId も
null にする防御層を追加しても良い（意味論的に「どこも指していない」が自然）。
影響範囲調査が必要なため、PM-860 scope 外として申し送り。

### 7.3 Split Pane 時の挙動

現状 `/clear` は activePane にしか作用しない（`ClearSessionDialog` は activePaneId の
currentSessionId を参照）。Split Session 中に両 pane を同時にリセットしたい需要が
出たら UX 検討（v3.6 以降）。

---

## 8. まとめ

- 根本原因: `delete_session` の引数キー不正（silent fail） + `lastSessionId` 残留
- 修正: `createNewSession()` 方式に切替（Claude Desktop / CLI と同等挙動）
- 効果: リロード後もコンテキストがリセット状態を保持、旧 session は履歴として残存
- 最小 diff: 1 ファイル / 実質 12 行のコード変更
- 型検査 OK / 他 Agent との衝突なし

以上、CEO に報告します。
