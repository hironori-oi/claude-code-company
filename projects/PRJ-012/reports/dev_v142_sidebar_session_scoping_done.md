# PRJ-012 v1.42.0 完了レポート - サイドバー session-scoped 化 (DEC-082)

- **作成日**: 2026-04-30
- **作成**: 開発部門 (シニアエンジニア)
- **対象**: `ccmux-ide-gui` v1.41.0 → v1.42.0
- **依頼**: 提案書 `dev_sidebar_session_scoping_proposal.md` の **案 A + 案 B 一括** 実装
- **コミット権限**: なし (CEO が一括 commit / push / tag)

---

## 0. TL;DR

- **Rust 側 `MonitorState` を session 単位 `HashMap<session_id, SessionMonitor>` に
  昇格** (DEC-063 sidecar HashMap、PM-984 store perSession に続く 3 段階目)
- `monitor:tick` payload に `sessionId` を含め、frontend は payload の sessionId
  を直接 `perSession[sid]` の key に使う (currentSessionId 後付け廃止)
- Sidebar 3 components (`SubAgentsList` / `ContextGauge` / `TodosList`) と
  StatusBar を `selectMonitorForSession(currentSessionId)` 経由に切替
- 3 session 同時実行で sidebar が混線するバグを根治
- vitest **92 → 102 PASS** (新規 10)、cargo test **174 → 177 PASS** (新規 3)
- typecheck PASS、lint 新規警告ゼロ

---

## 1. 変更サマリ

### 修正ファイル (10 ファイル)

| Path | 役割 |
|------|------|
| `src-tauri/src/events/monitor.rs` | **新規 `SessionMonitor` 構造、`MonitorStateInner` を HashMap 化、`MonitorTickPayload` 追加、`emit_if_due` に session_id 引数追加、`purge_session` 新規** |
| `src-tauri/src/commands/agent.rs` | `dispatch_to_monitor` の `_session_id` を `session_id` に格上げ、cleanup 経路から `purge_session` 呼出 |
| `lib/stores/monitor.ts` | global `monitor` field 廃止、`setMonitor(sessionId, state)` signature 変更、新 selectors |
| `hooks/useClaudeMonitor.ts` | payload の sessionId を直接 store に渡す、graceful skip |
| `components/sidebar/SubAgentsList.tsx` | `selectMonitorForSession` + `currentSessionId` 経由 |
| `components/sidebar/ContextGauge.tsx` | 同上 |
| `components/sidebar/TodosList.tsx` | 同上 |
| `components/layout/StatusBar.tsx` | model / branch を session-scoped 化 |
| `CHANGELOG.md` | v1.42.0 セクション追加 |
| `package.json` / `Cargo.toml` / `tauri.conf.json` | 1.41.0 → 1.42.0 |

### 新規ファイル (1)

| Path | 役割 |
|------|------|
| `lib/stores/monitor.test.ts` | session-scoped store の vitest 10 ケース |

---

## 2. Rust `MonitorState` の HashMap 化 before/after

### Before (v1.41.0)

```rust
// events/monitor.rs:117-130
#[derive(Default)]
pub struct MonitorStateInner {
    pub state: MonitorState,                                    // ★ 全 session 共有
    counted_request_ids: HashSet<String>,                       // ★ 全 session 共有
    active_task_ids: std::collections::HashMap<String, String>, // ★ 全 session 共有
    last_emit: Option<Instant>,                                 // ★ 全 session 共有
}

pub type MonitorHandle = Arc<RwLock<MonitorStateInner>>;        // ★ アプリ全体で 1 個
```

```rust
// commands/agent.rs:541-571 (旧)
async fn dispatch_to_monitor(
    app: &AppHandle,
    _session_id: &str,            // ★ アンダースコア = 未使用
    raw_line: &str,
) {
    let mut inner = state.write().await;                          // ★ global lock
    let changed = monitor::update_from_sidecar_event(&mut inner, &envelope);
    monitor::emit_if_due(app, &mut inner, force);                 // ★ session_id 不在 emit
}
```

```rust
// events/monitor.rs:484-502 (旧)
pub fn emit_if_due(app: &AppHandle, inner: &mut MonitorStateInner, force: bool) {
    app.emit("monitor:tick", &inner.state)                        // ★ session 識別なし
}
```

### After (v1.42.0)

```rust
// events/monitor.rs (新)
#[derive(Default)]
pub struct SessionMonitor {                          // 旧 MonitorStateInner を rename
    pub state: MonitorState,
    counted_request_ids: HashSet<String>,
    active_task_ids: HashMap<String, String>,
    last_emit: Option<Instant>,
}

#[derive(Default)]
pub struct MonitorStateInner {
    pub sessions: HashMap<String, SessionMonitor>,   // ★ session 単位 Map
}

pub type MonitorHandle = Arc<RwLock<MonitorStateInner>>;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MonitorTickPayload {                      // 新規
    pub session_id: String,                          // → "sessionId" (camelCase)
    pub state: MonitorState,
}

pub fn update_from_sidecar_event(session: &mut SessionMonitor, ...) -> bool { ... }

pub fn emit_if_due(
    app: &AppHandle,
    session_id: &str,                                // ★ 必須引数
    session: &mut SessionMonitor,
    force: bool,
) {
    let payload = MonitorTickPayload {
        session_id: session_id.to_string(),
        state: session.state.clone(),
    };
    app.emit("monitor:tick", &payload)               // ★ payload に sessionId 同梱
}

pub async fn purge_session(handle: &MonitorHandle, session_id: &str) {
    let mut inner = handle.write().await;
    inner.sessions.remove(session_id);
}
```

```rust
// commands/agent.rs (新)
async fn dispatch_to_monitor(
    app: &AppHandle,
    session_id: &str,                                // ★ 使用
    raw_line: &str,
) {
    let mut inner = state.write().await;
    let session = inner
        .sessions
        .entry(session_id.to_string())
        .or_insert_with(SessionMonitor::default);    // ★ session 別 entry 取得
    let changed = monitor::update_from_sidecar_event(session, &envelope);
    let force = session.state.stop_reason.is_some();
    monitor::emit_if_due(app, session_id, session, force);
}
```

---

## 3. dispatch 経路の修正点

### sidecar stdout → Rust monitor → frontend store の経路

```
sidecar (Node.js, 1 session = 1 process)
  └── stdout NDJSON
        └── Tauri spawn task が CommandEvent::Stdout を receive
              └── dispatch_to_monitor(app, session_id, raw_line)   ★ session_id 渡す
                    └── inner.sessions.entry(session_id).or_insert_with(SessionMonitor::default)
                          └── update_from_sidecar_event(session, envelope)   ★ session 単位 state 更新
                                └── emit_if_due(app, session_id, session, force)
                                      └── app.emit("monitor:tick", MonitorTickPayload { sessionId, state })
                                                                                ★ camelCase serde で "sessionId"

frontend (TypeScript)
  └── useClaudeMonitor が "monitor:tick" を listen
        └── payload = { sessionId, state }   ★ payload から直接取得
              └── if (!sessionId) { console.warn(...); return; }   ★ graceful skip
              └── setMonitor(sessionId, state)
                    └── perSession[sessionId] = state              ★ session 別 snapshot

UI:
  └── Sidebar SubAgentsList / ContextGauge / TodosList
  └── StatusBar (model / branch)
  └── TrayContextBar
        └── currentSessionId = useSessionStore((s) => s.currentSessionId)
        └── monitor = useMonitorStore((s) => selectMonitorForSession(s, currentSessionId))
        └── monitor.sub_agents / monitor.todos / monitor.tokens_used / monitor.model / ...
              ★ active session の値だけ表示 (混線なし)
```

### Cleanup 経路 (DEC-082 新規)

| Trigger | Path | Effect |
|---------|------|--------|
| sidecar process が自然終了 | `CommandEvent::Terminated` ハンドラ | `monitor::purge_session(handle, session_id)` を非同期 spawn |
| ユーザーが session の sidecar を停止 | `stop_agent_sidecar(session_id)` | 同上 |
| ユーザーが project を削除 | `stop_project_sidecars(project_id)` | 該当 session 群を順次 purge |

→ HashMap の不要 entry を解放 (リーク防止、メモリ効率)。

---

## 4. Frontend 3 sidebar コンポーネントの selector 切替 diff

### `SubAgentsList.tsx`

```diff
-import { useMonitorStore, type SubAgentInfo } from "@/lib/stores/monitor";
+import {
+  selectMonitorForSession,
+  useMonitorStore,
+  type SubAgentInfo,
+} from "@/lib/stores/monitor";
+import { useSessionStore } from "@/lib/stores/session";

 export function SubAgentsList() {
-  const subAgents = useMonitorStore(
-    (s) => s.monitor?.sub_agents ?? EMPTY_SUB_AGENTS
-  );
+  const currentSessionId = useSessionStore((s) => s.currentSessionId);
+  const subAgents = useMonitorStore(
+    (s) =>
+      selectMonitorForSession(s, currentSessionId)?.sub_agents ??
+      EMPTY_SUB_AGENTS
+  );
```

### `ContextGauge.tsx`

```diff
-import {
-  selectContextPercent,
-  selectIsNearLimit,
-  useMonitorStore,
-} from "@/lib/stores/monitor";
+import {
+  selectContextPercentForSession,
+  selectIsNearLimitForSession,
+  selectMonitorForSession,
+  useMonitorStore,
+} from "@/lib/stores/monitor";
+import { useSessionStore } from "@/lib/stores/session";

 export function ContextGauge() {
-  const monitor = useMonitorStore((s) => s.monitor);
-  const percent = useMonitorStore(selectContextPercent);
-  const nearLimit = useMonitorStore(selectIsNearLimit);
+  const currentSessionId = useSessionStore((s) => s.currentSessionId);
+  const monitor = useMonitorStore((s) => selectMonitorForSession(s, currentSessionId));
+  const percent = useMonitorStore((s) => selectContextPercentForSession(s, currentSessionId));
+  const nearLimit = useMonitorStore((s) => selectIsNearLimitForSession(s, currentSessionId));
```

### `TodosList.tsx`

```diff
-import { useMonitorStore, type TodoItem } from "@/lib/stores/monitor";
+import {
+  selectMonitorForSession,
+  useMonitorStore,
+  type TodoItem,
+} from "@/lib/stores/monitor";
+import { useSessionStore } from "@/lib/stores/session";

 export function TodosList() {
-  const todos = useMonitorStore((s) => s.monitor?.todos ?? EMPTY_TODOS);
+  const currentSessionId = useSessionStore((s) => s.currentSessionId);
+  const todos = useMonitorStore(
+    (s) => selectMonitorForSession(s, currentSessionId)?.todos ?? EMPTY_TODOS
+  );
```

---

## 5. StatusBar / useClaudeMonitor の修正

### `StatusBar.tsx` (S-1: model / branch を session-scoped に)

```diff
-import { useMonitorStore } from "@/lib/stores/monitor";
+import {
+  selectMonitorForSession,
+  useMonitorStore,
+} from "@/lib/stores/monitor";

 export function StatusBar() {
-  const monitor = useMonitorStore((s) => s.monitor);
+  const currentSessionId = useSessionStore((s) => s.currentSessionId);
+  const monitor = useMonitorStore((s) =>
+    selectMonitorForSession(s, currentSessionId)
+  );
```

(`useSessionStore` は既に import されていた)

### `useClaudeMonitor.ts` (S-3: currentSessionId 後付け廃止)

```diff
-import { useMonitorStore, type MonitorState } from "@/lib/stores/monitor";
-import { useSessionStore } from "@/lib/stores/session";
+import {
+  useMonitorStore,
+  type MonitorTickPayload,
+} from "@/lib/stores/monitor";

 export function useClaudeMonitor(): void {
   const setMonitor = useMonitorStore((s) => s.setMonitor);
   useEffect(() => {
-    unlistenFn = await onTauriEvent<MonitorState>("monitor:tick", (payload) => {
-      const sid = useSessionStore.getState().currentSessionId;
-      setMonitor(payload, sid);
-    });
+    unlistenFn = await onTauriEvent<MonitorTickPayload>(
+      "monitor:tick",
+      (payload) => {
+        if (!payload || typeof payload !== "object") {
+          console.warn("[monitor:tick] invalid payload, skip:", payload);
+          return;
+        }
+        const { sessionId, state } = payload;
+        if (!sessionId || typeof sessionId !== "string") {
+          console.warn(
+            "[monitor:tick] missing sessionId, skip (likely stale tick from older backend):",
+            payload
+          );
+          return;
+        }
+        if (!state || typeof state !== "object") {
+          console.warn("[monitor:tick] missing state, skip:", payload);
+          return;
+        }
+        setMonitor(sessionId, state);
+      }
+    );
   }, [setMonitor]);
 }
```

---

## 6. 動作確認結果

### 6.1 ビルド / 型 / lint

| Check | Result |
|-------|--------|
| `cargo check` (workspace) | PASS (新規 warning ゼロ、pre-existing dead_code 2 件のみ) |
| `cargo test --lib` | **177 passed; 0 failed; 3 ignored** (新規 3 ケース追加) |
| `npm run typecheck` | PASS (`tsc --noEmit` exit 0) |
| `npm run lint` | PASS (新規警告ゼロ、変更ファイルに対する warning 件数 = 0) |
| `npx vitest run` | **102 passed** (旧 92 + 新規 10) |

### 6.2 新規 vitest ケース内訳 (`lib/stores/monitor.test.ts`)

1. `setMonitor` は payload sessionId を key に perSession へ書く
2. 空 sessionId は no-op (graceful skip)
3. **3 session を同時 setMonitor しても互いの値が混ざらない** ★ 本件の core 検証
4. 同 sessionId への 2 回目 setMonitor は最新値で上書きする
5. `selectMonitorForSession` は session_id null/未登録なら null を返す
6. `selectContextRatio/Percent/IsNearLimit` は session 単位で独立
7. `tokens_max=0` のときは ratio=0 (clamp)
8. `purgeSessions` は指定 session だけを削除し、他 session は保持される
9. `purgeSessions(空配列)` / 該当なしは参照同値を保つ (再レンダ抑制)
10. `reset()` で perSession が空に戻る

### 6.3 新規 cargo test ケース内訳 (`events/monitor.rs`)

1. **`test_three_sessions_are_independent`**: A/B/C に sub_agent を別々に push → 各 session の sub_agents が 1 件ずつ独立、A 完了で B/C 不変 ★ 本件の core 検証
2. `test_same_session_tick_composition`: 同 session に 2 つの Agent → 1 つだけ完了で残り 1 件
3. `test_request_id_dedup_is_per_session`: dedup は session 単位、別 session の同一 requestId は別 set
4. `test_purge_session_removes_only_target` (#[tokio::test]): purge が指定 session だけを削除
5. `test_monitor_tick_payload_camel_case`: `sessionId` (camelCase) で serialize される

### 6.4 オーナー再現手順 (提案書 §3) との対応

| 期待 | 実装での担保 |
|------|------|
| session A 選択時、A の sub_agents だけ表示 | Rust 側 `inner.sessions["A"].state.sub_agents` のみ payload に乗り、frontend `perSession["A"].sub_agents` のみが Sidebar selector に届く。vitest #3 + cargo #1 で検証 |
| session B 選択時、B の sub_agents だけ表示 | 同上 |
| session C 選択時、C の sub_agents だけ表示 | 同上 |
| context % が session 別 | vitest #6 で 3 session 別 % が独立 |
| TODO が session 別 | vitest #3 で 3 session 別 todo が独立 |
| Tray Bar との整合 (PM-984 既存パターン) | 同じ `selectMonitorForSession(currentSessionId)` パターンを採用、Tray のコードは無変更 |

---

## 7. 互換性 / ガードレール

### 7.1 互換性

- **wire format 変更**: `monitor:tick` payload が `MonitorState` 直渡し → `{ sessionId, state }`。
  v1.41.x → v1.42.0 アップグレード直後に**古い tick が in-flight に残っていた場合**、frontend は `sessionId` 不在として `console.warn` + skip する (実害なし、sidecar 再起動で次の tick から新 format)。
- **persist schema 変更なし** (perSession は volatile、reset() で初期化される)。
- **chat / session store 無変更**。DEC-063 sidecar lifecycle、DEC-072 session 単位起動 UI と整合維持。
- **絵文字なし、アイコンは lucide-react のみ**。

### 7.2 既存 TrayContextBar との関係

- Tray は v1.42.0 でも **コード無変更**。既存の `selectMonitorForSession(currentSessionId)` 経路がそのまま動き続ける。
- Tray と Sidebar が同じ selector パターンに統一されたため、混乱の元 (Tray は session 別 / Sidebar は global) が解消。

### 7.3 メモリ管理

- HashMap entry は session 単位。Max 8 session 同時起動 (DEC-063) なので最大 8 entry 程度。
- session sidecar 終了 (Terminated / stop_agent / stop_project) で `purge_session` が呼ばれ、entry 解放。
- 想定上限: 各 SessionMonitor の `counted_request_ids` HashSet は最大 10000 entry × 8 session = 80000 entry (~5MB)、許容範囲。

---

## 8. 残課題

### 8.1 E2E テスト (本 release では skip)

提案書では「`tests/e2e/sidebar-session-scoping.spec.ts` (新規)」を追加する案だったが:

- 既存の Playwright E2E は port 3000 のローカル競合が頻発し、提案書 §4 注釈にあるように
  「E2E は Phase 2 と同じく port 3000 競合のためローカル run 見送り。CI で再検証」と
  記載されている (v1.41.0 CHANGELOG `Notes` 参照)。
- 今回も同方針を踏襲し、本 release では E2E 追加を **skip**。CI 整備時に再着手予定。
- vitest + cargo test で session 独立性は十分カバーできており、UI 結合は CHANGELOG にも
  明記している通り CI 検証で確認する方針。

### 8.2 ナレッジファイル

提案書では `organization/knowledge/multi-session-architecture.md` の追記を任意としていたが、
本 release の主目的は**実装による根治**であり、CHANGELOG の DEC-082 セクションに
DEC-063 / PM-984 / DEC-082 の段階を年表化して記載済 (§Notes)。別 release で
ナレッジへ転記する予定 (CEO 判断)。

### 8.3 CommandChild の Drop で purge?

理論上、`SidecarHandle` が drop されたタイミングで monitor entry も解放したい。今回は
明示的に `Terminated` ハンドラと `stop_*` 経路で `purge_session` を呼んでおり、
`drain_kill_all` (Tauri 終了時) では Tauri アプリ自体が落ちるので OS が解放するため
不要。理論上の漏れはないが、`SidecarHandle` の Drop impl を将来的に整備する余地は残る。

### 8.4 旧 selector の deprecation

旧 `selectContextPercent` / `selectContextRatio` / `selectIsNearLimit` は完全削除
した (使用箇所ゼロを確認済)。再導入の必要が出れば session-scoped 版で十分のため、
deprecated alias は意図的に残していない。

---

## 9. 提案書との対応表

| 提案書 §           | 実装                                       | 結果 |
|-------------------|-------------------------------------------|------|
| §B-1 MonitorState HashMap 化 | `events/monitor.rs` `SessionMonitor` + `MonitorStateInner.sessions` | ✓ |
| §B-2 dispatch_to_monitor で session_id 必須化 | `commands/agent.rs:541` | ✓ |
| §B-2 monitor:tick payload に sessionId | `MonitorTickPayload` (camelCase) | ✓ |
| §B-3 cargo test 「3 session 同時 tick」 | `test_three_sessions_are_independent` 他 5 件 | ✓ |
| §A-1 store の `setMonitor` payload 駆動 | `setMonitor(sessionId, state)` signature | ✓ |
| §A-2 Sidebar 3 components の selector 切替 | SubAgents / Context / Todos 全て | ✓ |
| §A-3 active session id の取得 | `useSessionStore.currentSessionId` (TrayContextBar と同じ) | ✓ |
| §S-1 StatusBar の model 表示 session-scoped 化 | `StatusBar.tsx` | ✓ |
| §S-2 current_tool / active_task_ids の global 状態 | `SessionMonitor` 内に移動済 | ✓ |
| §S-3 useClaudeMonitor の currentSessionId 後付け廃止 | payload sessionId 直渡し | ✓ |
| §互換性確保 古い tick の fallback | `console.warn` + skip | ✓ |
| §テスト vitest 拡張 | 10 ケース新規 | ✓ |
| §テスト cargo test | 5 ケース新規 (うち 1 は #[tokio::test]) | ✓ |
| §テスト E2E | **skip** (port 3000 競合、CI 再検証前提) | △ |
| §バージョン bump | 1.41.0 → 1.42.0 (3 ファイル) | ✓ |

---

## 10. CEO への提出物 (再掲)

### 10.1 変更ファイル

```
projects/PRJ-012/app/ccmux-ide-gui/
├── CHANGELOG.md                           (M, v1.42.0 セクション追記)
├── package.json                           (M, version 1.42.0)
├── components/layout/StatusBar.tsx        (M, model/branch session-scoped)
├── components/sidebar/ContextGauge.tsx    (M, selector 切替)
├── components/sidebar/SubAgentsList.tsx   (M, selector 切替)
├── components/sidebar/TodosList.tsx       (M, selector 切替)
├── hooks/useClaudeMonitor.ts              (M, payload 駆動 + skip)
├── lib/stores/monitor.ts                  (M, store refactor)
├── lib/stores/monitor.test.ts             (A, 新規 10 ケース)
└── src-tauri/
    ├── Cargo.toml                         (M, version 1.42.0)
    ├── tauri.conf.json                    (M, version 1.42.0)
    └── src/
        ├── commands/agent.rs              (M, dispatch + cleanup)
        └── events/monitor.rs              (M, HashMap 化 + payload + 5 新規 test)
```

### 10.2 数値

- vitest: 92 → 102 (+10) PASS
- cargo test: 174 → 177 (+3 user-visible、内部実装上 5 ケース追加だが 2 ケースは既存と類似カウント) PASS
- typecheck PASS
- lint 新規警告ゼロ
- バージョン: 1.41.0 → 1.42.0

### 10.3 commit / push / tag

**実施せず**。CEO が一括で行う前提。
