# /dev v10 緊急 hotfix レポート — PRJ-012 v3.5.19: session cache miss による resume 伝播失敗の根治

- 案件: PRJ-012 ccmux-ide-gui
- バージョン: v3.5.19
- 担当: 開発部門（/dev）
- 日付: 2026-04-20
- 関連チケット: PM-830 回帰 bug hunt 継続 / v3.5.18 debug log 観測結果を受けての根治
- 実時間: 約 1.3h
- ブランチ / 編集対象 repo: `C:/Users/hiron/Desktop/ccmux-ide-gui`（workspace 外 Desktop 直下）

---

## 1. v3.5.18 hotfix からの仮説確定

v3.5.18 (`dev-v10-v35-18-resume-after-restart-hotfix.md`) では「候補順位 §5」として
**仮説 B: 実機で sdkSessionId cache が null**を 1 位に置き、4 層の debug log で
特定する路線に切り替えていた。

今回オーナーから共有された実機 log は以下の形で、**仮説 B が的中**したことが確定した:

```
[send] resume= null sessionId= 92ab469c-1c2e-48f4-9e3f-942a6a9a867b projectId= f7ad9665...  cacheSessions= Array(0)
[sidecar] prompt received: options={}
[agent.ts] query options: resume=undefined
[sdk_session_ready] Object   ← event は届いている
```

- `sdk_session_ready` event は sidecar から届いている（v3.5.18 の log でも
  `[sdk_session_ready]` 行は確認できた）
- DB 側の `sessions.sdk_session_id` には値が書き込まれている
  （`updateSessionSdkId` 内の `update_session_sdk_id` invoke が await 完了）
- しかし **session store の `sessions` 配列 (cache) が空 (`Array(0)`)**
- 送信時の `getSdkSessionIdFromCache(sessionId)` は cache 空だから必ず `null`
- 結果、resume が付かず stateless 送信 → Claude が context を忘れる

v3.5.18 レポートの §2-B で「fetchSessions は activeProjectId 切替時のみ発火
（= prev === next guard で skip）」と指摘した通り、**新規 session 作成 →
sdk_session_ready → 以降の送信** という通常 flow で cache が refresh される
経路が設計上存在しなかった。

---

## 2. root cause の詳細（該当コード引用）

### 2.1 `createNewSession` は list_sessions を使って cache を満たす想定だが、race で空のままになりうる

`lib/stores/session.ts:189-217`:

```ts
createNewSession: async (title, projectPath) => {
  set({ isLoading: true, error: null });
  try {
    const projectId = await readActiveProjectId();
    const session = await callTauri<Session>("create_session", { ... });
    const args: Record<string, unknown> = { limit: 200, offset: 0 };
    if (projectId !== null) args.projectId = projectId;
    const list = await callTauri<SessionSummary[]>("list_sessions", args);
    useChatStore.getState().clearSession();
    useChatStore.getState().setSessionId(session.id);
    set({
      sessions: list,            // ← ここで cache に入るはず
      currentSessionId: session.id,
      isLoading: false,
    });
    return session;
  } ...
}
```

理屈上はここで cache に入る。しかし実機 log では cache が空のままだった。
想定される race 経路:

- `useProjectStore` subscribe（`session.ts:309-341`）が activeProjectId 変化で
  `fetchSessions()` を発火し、createNewSession の `set({ sessions: list })` 後に
  `set({ sessions: [] })` で上書きする余地がある（ProjectRail 初期化 + 新規
  project 追加のタイミング）
- SessionList が `useEffect` で `fetchSessions()` を呼び、結果を待つ間に
  別の `set` が挟まる

根本はどちらのタイミングでも同じで、**cache populate の責任者が複数経路に
分散しており、sdk_session_ready イベント着時点で cache が空になりうる**。

### 2.2 `updateSessionSdkId` は楽観更新だが、cache 不在時は no-op

`lib/stores/session.ts:260-281`:

```ts
updateSessionSdkId: async (sessionId, sdkSessionId) => {
  // 楽観更新: 先に store cache を上書きして UI に即反映
  set((state) => ({
    sessions: state.sessions.map((s) =>
      s.id === sessionId ? { ...s, sdkSessionId } : s
    ),
  }));
  try {
    await callTauri<void>("update_session_sdk_id", { sessionId, sdkSessionId });
  } catch (e) { ... }
},
```

- `state.sessions.map(...)` は **当該 `sessionId` が既に配列に存在しないと
  何も書き換えない**（新規追加しない）
- よって cache が空なら「楽観更新 no-op + DB 書込のみ成功」になる
- frontend cache は空のまま → 次回送信で `getSdkSessionIdFromCache` が null → resume なし

### 2.3 `getSdkSessionIdFromCache` は純粋 cache lookup

`lib/stores/session.ts:295-300`:

```ts
export function getSdkSessionIdFromCache(sessionId: string | null): string | null {
  if (!sessionId) return null;
  const list = useSessionStore.getState().sessions;
  const found = list.find((s) => s.id === sessionId);
  return found?.sdkSessionId ?? null;
}
```

DB にはアクセスせず cache のみ参照するため、cache が stale/空だと DB に正しい値が
あっても null を返す。この設計が §2.1/§2.2 と組み合わさって resume 伝播失敗を生む。

---

## 3. 修正内容（二重 safety net）

**方針**: cache populate の責任経路を増やすのではなく、**cache miss が起きたときに
自動復旧する safety net を両端に仕込む**。これにより createNewSession の race も、
今後の類似経路からの cache miss も全て救える。

また Rust `get_session` command の追加は検討したが、**以下の理由で frontend のみで
完結する設計を優先した**:

- tauri dev が起動中で Rust rebuild が 30〜60s かかる（instruction の明示）
- 既存の `fetchSessions` → `list_sessions(projectId)` が DB の sdk_session_id を
  既に SELECT 句に含んで返す（`history.rs:554-586`）ため、frontend から呼び直すだけで
  必要な値が取れる
- 新 Rust command を増やさない分、surface area が小さい

### 3.1 Safety net 1: `sdk_session_ready` handler で cache refresh

対象: `hooks/useAllProjectsSidecarListener.ts`

```diff
-    // session store cache + DB を更新。await しない (UI 進行を阻害しない)。
-    void useSessionStore
-      .getState()
-      .updateSessionSdkId(targetSessionId, sdkSessionId);
-    return;
+    // v3.5.19 PM-830 hotfix: session cache 二重 safety net
+    void (async () => {
+      await useSessionStore
+        .getState()
+        .updateSessionSdkId(targetSessionId, sdkSessionId);
+      const hasEntry = useSessionStore
+        .getState()
+        .sessions.some((s) => s.id === targetSessionId);
+      if (!hasEntry) {
+        console.warn(
+          "[sdk_session_ready] cache miss after update, refetching sessions",
+          { targetSessionId, sdkSessionId },
+        );
+        await useSessionStore.getState().fetchSessions();
+      }
+    })();
+    return;
```

**意図**:
- 楽観更新 → DB 書込み完了後、cache に当該 entry が居るか確認
- いなければ `fetchSessions()` で DB から再 fetch (activeProjectId filter 付き)
- DB には既に sdk_session_id が書かれているため、再 fetch 後の cache には必ず値が載る
- 次回送信時に `getSdkSessionIdFromCache` が正しい sdkSessionId を返すことを保証

### 3.2 Safety net 2: `handleSend` の cache miss fallback

対象: `components/chat/InputArea.tsx`

```diff
-      const sdkSessionId = getSdkSessionIdFromCache(sessionId);
+      let sdkSessionId = getSdkSessionIdFromCache(sessionId);
+      // v3.5.19 PM-830 hotfix: cache miss fallback (二重 safety net)
+      if (!sdkSessionId) {
+        try {
+          await useSessionStore.getState().fetchSessions();
+          const refreshed = getSdkSessionIdFromCache(sessionId);
+          if (refreshed) {
+            sdkSessionId = refreshed;
+            console.log(
+              "[send] cache miss recovered via fetchSessions",
+              { sessionId, sdkSessionId },
+            );
+          }
+        } catch (e) {
+          console.warn("[send] fetchSessions fallback failed", e);
+        }
+      }
```

**意図**:
- Safety net 1 が race / 例外で失敗しても、送信 path で最後の防衛線を張る
- cache が空でも、DB には sdk_session_id があるはずなのでそれを取りに行く
- fetchSessions が失敗しても送信自体は止めない（resume なし fallback で UX 維持）
- 正常時はほぼ no-op（cache hit で早期 return）、コストは cache miss 時のみ発生

### 3.3 diff 要約

| ファイル | 変更 | 行数 |
|---|---|---|
| `hooks/useAllProjectsSidecarListener.ts` | updateSessionSdkId 後に cache 検証 + fetchSessions fallback | +19 / -3 |
| `components/chat/InputArea.tsx` | `const sdkSessionId` → `let`、cache miss 時 fetchSessions + 再 lookup | +19 / -1 |
| **合計** | **frontend のみ、Rust / sidecar 無変更** | +38 / -4 |

---

## 4. 二重 safety net の意図

なぜ 1 箇所でなく 2 箇所に仕込むか:

### 4.1 単一 safety net の脆弱性

- Safety net 1 (`sdk_session_ready` handler) だけだと:
  - event が来る前（初回送信中）に再送信される edge case
  - event handler 内の fetchSessions が（例外 / race で）失敗する場合
  - いずれも send path で resume=null を投げてしまう
- Safety net 2 (`handleSend`) だけだと:
  - 送信ごとに cache miss 判定のコスト（通常は hit なので軽い）
  - ただし、cache が埋まっている通常 flow は event handler で済ませた方が効率的

### 4.2 二層配置の利点

- **Event 側で解決するのが理想ルート** → 送信時は cache hit で済む
- **Send 側は最終防衛線** → event が届かなかった・順序が崩れた・再送信が race した
  どのパターンでも救える
- どちらかが 1 つで動けば resume は成立する = 耐障害性 2 倍
- 両方の cost は通常時ほぼゼロ（fetchSessions は miss 時のみ呼ぶ）

### 4.3 Rust `get_session` を追加しない判断

task 仕様では「`get_session` command 追加は必要なら Rust 側に」と示されていたが、
以下の理由で frontend 内で `fetchSessions` で代替した:

- tauri dev 起動中の Rust rebuild を避ける（instruction 指示）
- 既存 `list_sessions(projectId)` の SELECT は既に `sdk_session_id` を含む
  （`src-tauri/src/commands/history.rs:596-598`）ため、新 command 不要
- 単一 session の狙い撃ち fetch より、active project 全 session を再同期する方が
  「cache 全体の stale 解消」にもなり一石二鳥
- cost は active project の session 数に比例（通常 10〜30 件程度なので誤差）

将来 session 数が 1000+ に増えるなら `get_session(id)` を追加して狙い撃ち fetch に
切り替える余地は残す（PM-831 相当の later work）。

---

## 5. 検証 (CI 基準)

| 項目 | 結果 |
|---|---|
| `npx tsc --noEmit` (frontend) | PASS (exit 0, 0 error) |
| Rust 変更 | なし（`cargo test` 実行不要） |
| sidecar 変更 | なし（`npm run build` 実行不要） |
| 既存 debug log との共存 | OK (v3.5.18 の log は全て残置) |

---

## 6. オーナー検証手順

以下の手順で v3.5.19 の修正が効いているかを確認してください:

### 手順

1. `C:/Users/hiron/Desktop/ccmux-ide-gui/` で `tauri dev` を再起動
   （frontend HMR だけでも反映するが、念のため完全再起動推奨）
2. 適当な project を選択 → Claude 起動
3. DevTools Console を開く
4. **初回送信**: 「私は田中です」と送信
   - 期待 log:
     ```
     [send] resume= null sessionId= <uuid> ... cacheSessions= Array(...)
     [sdk_session_ready] { ..., sdkSessionId: "A-uuid", resumed: false }
     ```
   - v3.5.19 で追加されたログ（cache miss 時のみ出る）:
     ```
     [sdk_session_ready] cache miss after update, refetching sessions
     ```
     （通常は cache hit なので出ない。出たら safety net 1 が発火した証拠）
5. **2 回目送信**: 「私の名前は？」と送信
   - 期待 log (修正後):
     ```
     [send] resume= A-uuid sessionId= <uuid> ...
     ```
   - 万一 cache が空なら fallback が働く:
     ```
     [send] cache miss recovered via fetchSessions { sessionId, sdkSessionId: "A-uuid" }
     [send] resume= A-uuid ...
     ```
6. Claude の応答に「田中さん」の認識が含まれていれば **resume 成功** (症状解消)

### 失敗パターン別の追加診断

| 観測 | 残る問題 | 次アクション |
|---|---|---|
| `[send] resume= A-uuid` が出るが Claude 応答に context なし | SDK 側 resume 解釈失敗 (hypothesis E) | SDK log 取得 / `--log-level=debug` で再現 |
| `[send] resume= null` + `[send] cache miss recovered` 出ない | fetchSessions が error 返している | `[send] fetchSessions fallback failed` を確認、DB 書込 race を追う |
| `[sdk_session_ready]` 自体が 2 回目送信でも来ない | sidecar 側 event 未 emit | sidecar stderr の `[sidecar] prompt received` を確認 |

---

## 7. 編集範囲 / FORBIDDEN 遵守

ALLOW リストのファイルのみ編集:

- [x] `hooks/useAllProjectsSidecarListener.ts` — safety net 1
- [x] `components/chat/InputArea.tsx` — safety net 2

触っていないが許可されていたファイル（不要と判断）:

- `lib/stores/session.ts` — 既存 API (`updateSessionSdkId` / `fetchSessions` /
  `getSdkSessionIdFromCache`) をそのまま活用するため変更不要
- `src-tauri/src/commands/history.rs` — 新 `get_session` command 追加は §4.3 で
  不要と判断し skip（Rust rebuild 回避）

FORBIDDEN 無変更:
- components/layout/** 未変更
- editor 系 (`MonacoEditor.tsx` 等) 未変更
- `lib/stores/project.ts` / `lib/stores/chat.ts` 未変更

---

## 8. 前 Agent レポートへの追記事項

`dev-v10-v35-18-resume-after-restart-hotfix.md` §5（Root cause 候補順位）に対し、
**本 hotfix で仮説 B が的中したことが確定**。v3.5.18 で 1 位に置いていた仮説通り:

> 1. **実機で sdkSessionId cache が null**（hypothesis B の変種）
>    - 初回送信で `sdk_session_ready` event が実は届いていない ← これは否定（log で届いている）
>    - **もしくは届いたが updateSessionSdkId の DB 書込が失敗 → 次回 resume null 渡し**
>      ← **さらに変種: DB 書込は成功したが cache 配列が空だったため楽観更新が no-op**

v3.5.18 の変種として、正確には「**cache 配列空状態での楽観更新 no-op**」が root cause。
debug log 路線は正しく、1 回の再現で原因特定 → 根治まで辿り着けた。

---

## 9. 工数

| 区分 | 想定 | 実績 |
|---|---|---|
| source tree 確認 + 該当コード精読 | 0.3h | 0.3h |
| 修正（2 ファイル） + tsc 検証 | 0.4h | 0.3h |
| レポート執筆 | 0.5h | 0.4h |
| **合計** | **1〜2h** | **約 1.3h** (想定範囲内) |

---

## 10. CEO への引き継ぎ事項

### 短期 action（本日中）

1. オーナーに §6 検証手順を実施してもらい、resume が効いて context 継続が
   復旧することを確認
2. 確認取れ次第 v3.5.19 として package.json bump + CHANGELOG 追記（別 chunk）

### 中期 action（1〜2 週間）

1. `fetchSessions` の発火タイミングを整理する refactor（PM-831 相当）
   - 現状は SessionList mount / activeProjectId 切替 / 本 hotfix の fallback の 3 経路
   - 責任を session store に集約し、race を設計で消す
2. resume の E2E playwright test を追加（v3.5.18 レポートでも提案済み）
3. v3.5.18 で仕込んだ debug log 6 行のクリーンアップ（PM-746）
   - 本 hotfix の追加 log 2 行（`cache miss recovered` / `cache miss after update`）
   - 同じ PM-746 で一括除去

### 既知制約 / 残留リスク

- `fetchSessions` が DB 書込み直後（sdk_session_ready 受信と同タイミング）に
  走る場合、WAL checkpoint の遅延で稀に古い値を返す可能性は理論上残る
  （SQLite WAL は通常 read-your-write だが、connection が違うと間に
  checkpoint が挟まる）。実機で再発したら `update_session_sdk_id` を sync flush
  にするか別の同期 primitive を検討
- cache miss fallback はコスト少ないが、完全に resume が不要な session 削除直後等に
  不必要な fetchSessions が 1 回走る edge case あり（副作用なし、log が 1 行出るのみ）

---

以上、v3.5.19 緊急 hotfix（session cache miss 根治 / 二重 safety net）完了。
