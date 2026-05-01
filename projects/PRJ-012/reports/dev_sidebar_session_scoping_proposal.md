# PRJ-012 サイドバー session-scoped 表示 - 調査と修正方針

- **作成日**: 2026-04-30
- **作成**: 開発部門 (シニアエンジニア)
- **対象**: v1.41.0 時点の `ccmux-ide-gui`
- **依頼**: オーナーバグ報告「3 session 同時実行時にサブエージェント / コンテキスト
  表示が session を切替えても同じものが表示される」+ 改善要望「選択中 session の
  値が表示されること」

---

## 0. TL;DR (CEO 用)

- **オーナー推測は正しい**: 「最後の実行が表示されている」≒ **「最後に tick した
  session の値が表示されている」**。3 session 同時稼働では race で勝った 1 session の
  値しか見えない。
- **真因は 1 つ**: Rust 側の `MonitorState` が **アプリ全体で 1 個の `Arc<RwLock>`**。
  全 sidecar の stdout が同じ state に書込み、`monitor:tick` も session 識別子を
  持たずに global broadcast されている。DEC-063 (1 session = 1 sidecar) と
  整合していない。
- **既存の半解** (PM-984/v1.8.2): `useMonitorStore.perSession[sessionId]` で
  frontend 側に session 別 snapshot を保持する仕組みは **既にある**。`TrayContextBar`
  は使っているが、**Sidebar の `ContextGauge` / `SubAgentsList` / `TodosList`
  だけが乗り換え漏れ** している。
- **修正規模**:
  - **必須 (S, 0.5h)**: Sidebar 3 コンポーネントを `selectMonitorForSession` に
    切替 → コンテキストは即治る。
  - **本質修正 (M, 4〜6h)**: Rust 側 `MonitorState` を `HashMap<sessionId, _>` に
    昇格 + `monitor:tick` payload に session_id を載せる → サブエージェント /
    todos も session 別に正確に表示。

---

## 1. 現状調査

### 1.1 関連コンポーネント

`components/sidebar/` 配下 (確認済 9 ファイル):

| ファイル | 役割 | 本件関連 |
|---|---|---|
| `Sidebar.tsx` | 5 タブ親、`monitor` タブで Context/SubAgents/Todos/Usage を縦並び | 描画ホスト |
| `SubAgentsList.tsx` | サブエージェント一覧 (Bot icon + Badge) | **★該当** |
| `ContextGauge.tsx` | コンテキスト使用量ゲージ (% / model / branch) | **★該当** |
| `TodosList.tsx` | TodoWrite 由来の todo 一覧 | **★同根本原因** |
| `UsageStatsCard.tsx` | OAuth API + Stage B JSONL 集計 | 関係なし (sidecar event 非依存) |
| `SessionList.tsx` | session 一覧 / 切替 / 新規作成 | active session 制御元 |
| `ProjectTree.tsx` | ファイルツリー | 関係なし |
| `LocalServersPanel.tsx` | LISTEN port 一覧 | 関係なし |
| `FilePreviewDialog.tsx` | ファイル prev | 関係なし |

### 1.2 データ取得経路 (絶対パス + 行番号)

`SubAgentsList.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/sidebar/SubAgentsList.tsx:24-26`
  ```ts
  const subAgents = useMonitorStore(
    (s) => s.monitor?.sub_agents ?? EMPTY_SUB_AGENTS
  );
  ```
  → `s.monitor` (= **global latest**) を読んでいる。session を見ない。

`ContextGauge.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/sidebar/ContextGauge.tsx:31-33`
  ```ts
  const monitor = useMonitorStore((s) => s.monitor);
  const percent = useMonitorStore(selectContextPercent);
  const nearLimit = useMonitorStore(selectIsNearLimit);
  ```
  `selectContextPercent` も `s.monitor` を引いている (`monitor.ts:103-107`)。**全部 global**。

`TodosList.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/sidebar/TodosList.tsx:24`
  ```ts
  const todos = useMonitorStore((s) => s.monitor?.todos ?? EMPTY_TODOS);
  ```
  → 同じく global。

**対比 (正しい使い方の例)**: `TrayContextBar`
- `components/workspace/TrayContextBar.tsx:38-41`
  ```ts
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const monitor = useMonitorStore((s) =>
    selectMonitorForSession(s, currentSessionId)
  );
  ```
  → `selectMonitorForSession` 経由で session 別 snapshot を引いている。

### 1.3 store のデータ構造

`lib/stores/monitor.ts` 抜粋 (行番号付き):

- L50-67: `MonitorStore` 型
  ```ts
  monitor: MonitorState | null;          // ★ global latest
  perSession: Record<string, MonitorState>;  // ★ session 別 snapshot
  setMonitor: (state: MonitorState, sessionId?: string | null) => void;
  ```
- L73-82: `setMonitor` 実装。**同時に両方** に書く:
  ```ts
  setMonitor: (monitor, sessionId) =>
    set((s) => {
      const next: Partial<MonitorStore> = { monitor };  // global 上書き
      if (sessionId) {
        next.perSession = { ...s.perSession, [sessionId]: monitor };
      }
      return next;
    }),
  ```
- L129-135: `selectMonitorForSession` (PM-985 で fallback 廃止、null 返す)
  ```ts
  export function selectMonitorForSession(s, sessionId) {
    if (!sessionId) return null;
    return s.perSession[sessionId] ?? null;
  }
  ```

→ store 自体は **session-scoped 対応済**。selector も用意されている。
**Sidebar 側がそれを使っていないだけ**。

### 1.4 session の概念整理

DEC 群を読み解くと現状の階層は:

```
Project (RegisteredProject)
  └── Session (1..N, 各々独立 sidecar)        ← DEC-063 (v1.17.0)
        └── Sidecar (Node.js プロセス)
              ├── stdout NDJSON → agent:{sessionId}:raw  ← session prefix 済
              └── Rust dispatch_to_monitor → monitor:tick (★ global、session 識別なし)
```

- **DEC-033 (v3.3, 2026-04-20)**: 1 project = 1 sidecar (Multi-Sidecar 第 1 段階)
- **DEC-063 (v1.17.0, 2026-04-24)**: **1 session = 1 sidecar に昇格**。
  `HashMap<session_id, SidecarHandle>` (`commands/agent.rs:11-25` のコメント参照)。
  Max 8 session 同時起動。
- **DEC-072 (v1.32.0)**: Session 単位起動 UI / 起動数可視化。`active-sidecars`
  store も session 単位 (StatusBar.tsx:51-59 参照)。

→ **backend は DEC-063 以降 session 単位で完結している。chat event も
`agent:{sessionId}:raw` で session 別 routing。`useAllProjectsSidecarListener.ts` も
session_id を payload に乗せて `useChatStore.appendMessage(sessionId, ...)` する。
session 単位 routing が成立している層と、global で漏れている層の不整合が
本件の根**。

### 1.5 sidecar event 受信ロジック

#### chat 系 (session-scoped で正しい)
- `hooks/useAllProjectsSidecarListener.ts:73-130`: 各 session の
  `agent:{sessionId}:raw` を listen し、`dispatchSidecarEvent(projectId, sessionId, ...)`
  → `applyEventToSession(sessionId, ...)` → session 単位 store に dispatch。
- `chat.ts` の `sessionMessages` / `sessionActivity` / `sessionAttachments` は
  全部 `Record<sessionId, _>`。完全に session-scoped。

#### monitor 系 (★ ここが壊れている)
- `src-tauri/src/commands/agent.rs:498-535` が各 sidecar の stdout 行ごとに
  `dispatch_to_monitor(&app_handle, &sid_for_task, &s)` を呼ぶ。
- `agent.rs:541-571` `dispatch_to_monitor`:
  ```rust
  async fn dispatch_to_monitor(
      app: &AppHandle,
      _session_id: &str,   // ★ アンダースコア prefix = 未使用
      raw_line: &str,
  ) {
      let state = match app.try_state::<MonitorHandle>() { ... };
      let mut inner = state.write().await;       // ★ global lock
      let changed = monitor::update_from_sidecar_event(&mut inner, &envelope);
      ...
      monitor::emit_if_due(app, &mut inner, force);  // ★ session 識別なし emit
  }
  ```
- `events/monitor.rs:130` `pub type MonitorHandle = Arc<RwLock<MonitorStateInner>>;`
  → アプリ全体で 1 個。`lib.rs:101` で `manage::<MonitorHandle>(monitor::new_handle())`。
- `events/monitor.rs:484-502` `emit_if_due`:
  ```rust
  app.emit("monitor:tick", &inner.state)  // ★ session_id 付かない
  ```

#### frontend 受信
- `hooks/useClaudeMonitor.ts:33-40`:
  ```ts
  unlistenFn = await onTauriEvent<MonitorState>("monitor:tick", (payload) => {
    const sid = useSessionStore.getState().currentSessionId;  // ★ active を被せる
    setMonitor(payload, sid);
  });
  ```
  → tick 時の `currentSessionId` を後付けで key にしている。
  **どの sidecar が出した値かは不明。たまたま見ている session が key になる**。

### 1.6 active session 判定

- `useSessionStore.currentSessionId` (`session.ts:188`) を `loadSession` (L227) で
  set。SessionList クリック → active pane に attach (`chat.ts setPaneSession`) +
  currentSessionId 更新。
- pane の session は `useChatStore.panes[paneId].currentSessionId`。
- `TrayContextBar` は `currentSessionId` (single) を見て session-scoped 値を引く。
- **Sidebar の `ContextGauge` / `SubAgentsList` / `TodosList` は currentSessionId を
  そもそも参照していない** (`grep -n currentSessionId components/sidebar/` で 0 件)。

---

## 2. 問題の分解

### 2.1 真因仮説と検証

| 仮説 | 根拠 | 結果 |
|---|---|---|
| A. sidecar event に session_id が含まれない | Rust は `agent:{session_id}:raw` で出している、受信側でも `sessionId` をクロージャで持っている | **却下** (frontend の chat dispatch は session_id を持っている) |
| B. **Rust monitor が session を区別せず 1 個の state に上書き** | `events/monitor.rs:130` `MonitorHandle = Arc<RwLock<MonitorStateInner>>` が global、`agent.rs:541-571` `_session_id` (未使用) | **真因 1 (root cause)** |
| C. **Sidebar の selector が global `s.monitor` を読んでいる** | `SubAgentsList.tsx:24-26` / `ContextGauge.tsx:31-33` / `TodosList.tsx:24` | **真因 2 (即症状)** |
| D. perSession の key 付けが間違い | `useClaudeMonitor.ts:38` で `currentSessionId` を後付け、tick の発生源と無関係 | **副作用あり** (perSession のキーは tick した sidecar ではなく見ている session に化ける) |

**シナリオ再現の流れ** (3 session 同時実行):

1. session A の sidecar が tool_use (Agent) を吐く → Rust の global state.sub_agents に push → tick → frontend `s.monitor` 上書き、`perSession[currentSessionId(現在 active)]` 上書き
2. ユーザーが session B に切替 (`currentSessionId = B`)
3. session B の sidecar も tool_use を吐く → Rust の **同じ global state** に push (A の subagent も残ったまま!) → tick → `perSession[B]` に **A の sub_agents を含む値** が入る
4. session C も同様、最終的に「**最後に tick した sidecar が global state に積み上げた累計**」が `s.monitor` に居座る
5. Sidebar はその global を読むので、3 session のどれを開いても **同じ amalgam** が出る
6. C の cleanup で `tool_result` が来ても `active_task_ids` は global なので A の Task ID と区別が付かず、タイミング次第で B の subagent が「終わった」扱いに化ける

→ **オーナー観察「最後に実行したものが表示されている」は半分正解**。実際には
**「最後に tick した sidecar の値で global state が上書きされ続ける」+「session 切替で
 上書きが止まる訳ではない」+「異なる session の subagent が同じ HashMap に混ざる」**
という **3 重の混線**。

### 2.2 影響範囲 (他に session-scoped でない箇所)

`s.monitor` (global) を読んでいる箇所 (Grep 全件、L46 の `useMonitorStore`):

| 箇所 | 表示内容 | 状態 |
|---|---|---|
| `components/sidebar/ContextGauge.tsx:31-33` | コンテキスト使用量 / model / branch | **★ session 別であるべき** |
| `components/sidebar/SubAgentsList.tsx:24-26` | サブエージェント一覧 | **★ session 別であるべき** |
| `components/sidebar/TodosList.tsx:24` | TodoWrite todo 一覧 | **★ session 別であるべき** |
| `components/layout/StatusBar.tsx:46` | model / branch (画面下端) | △ 議論余地あり (現状 global で「どの session を見ても同じ」、ただし複数 session で違う model を使う場合は混乱の元) |
| `components/workspace/TrayContextBar.tsx:39-41` | TrayBar 横の % バッジ | **○ 既に session-scoped (PM-984)** |

`selectMonitorForSession` を使っているのは現状 TrayContextBar **1 箇所のみ**。

`ChatStatusIndicator` (project.sidecarStatus を読んでいる) と `ActivityIndicator`
(chat store の `selectActivityForSession`) は **既に session-scoped**。本件と無関係。

### 2.3 既存設計との整合性

- **DEC-033 (Multi-Sidecar v3.3)**: project 単位だったが、sidecar event は当時から
  prefix で混線回避していた。monitor は当時 1 sidecar 想定で書かれた v2 流用なので
  global のまま残った (decisions.md:609 「Rust 側の再細分化は不要」と書かれているが、
  これは **「event の細分化は不要」** の文脈。state shard 化は別問題)。
- **DEC-063 (Session-Level Sidecar v1.17.0)**: HashMap<session_id, SidecarHandle>
  に拡張、event prefix も `agent:{sessionId}:raw` に変更。**しかし monitor pipeline
  は更新されなかった** (sidecar handle 一覧のみ session 化、monitor state は据置)。
- **PM-984 (v1.8.2)**: 「session 別コンテキスト使用量」を Tray にだけ shipped。
  Sidebar には浸透していない。CHANGELOG.md L1387-1396 にも「Tray Bar の」と限定明記。
- **PM-985 (v1.10.x)**: TrayContextBar の global fallback 廃止。session の意味を
  厳格化、ただし Sidebar 側は触らず。

→ **DEC-063 直後にやるべきだった backend 改修と Sidebar の selector 移植が
両方残っている**。Tray だけ先行修正されて Sidebar が取り残された形。

---

## 3. 再現手順 (オーナー確認用)

### 前提
- v1.41.0 (現行) で 3 session 同時実行が可能なこと (Max 8 まで)。

### 手順
1. プロジェクトを 1 つ選択 (or 2 つ以上、どちらでも症状は出る)
2. 同 project に session A / B / C を作成 (それぞれ別タイトルで識別)
3. session A を選択 → 「`このプロジェクトのファイル構成を Task サブエージェントで
   調査して`」など、**Agent ツールを呼ぶ指示** を送信。送信直後すぐ次へ
4. session B を選択 → 同様に Agent ツール呼び出しを依頼
5. session C を選択 → 同様
6. 3 session が **すべて running 中** の状態で、SessionList から A → B → C を
   順番にクリックして切替

### 観察ポイント (= バグ)
- Sidebar 「実行状態」タブを開いて切替しながら見る:
  - **サブエージェント** 欄: A/B/C どれを選んでも **同じ subagent 一覧** が出る
    (3 個の Task が混在 or 「最後に tick した state」が出る)
  - **コンテキスト使用量** 欄: A/B/C で **同じ %** (各 session の独立累積になっていない)
  - **TODO** 欄: 同じく混在
- 一方 **Tray Bar** の `ctx %` バッジ (画面右上) は session 切替で値が変わる
  (= PM-984 の session-scoped ロジックは生きている)。

### 期待値
- **session A 選択時**: A の sidecar が出した subagent / context / todo のみ表示
- **session B 選択時**: B のものだけ
- **C 選択時**: C のものだけ

---

## 4. 設計案 (3 案を必ず提示)

### 案 A: Frontend だけで session フィルタ (最小修正)

**内容**: Sidebar 3 コンポーネントを `selectMonitorForSession(currentSessionId)`
+ `useSessionStore.currentSessionId` の組合せに切替 (TrayContextBar の真似)。

```ts
// 例: SubAgentsList.tsx
const currentSessionId = useSessionStore((s) => s.currentSessionId);
const subAgents = useMonitorStore((s) => {
  const m = selectMonitorForSession(s, currentSessionId);
  return m?.sub_agents ?? EMPTY_SUB_AGENTS;
});
```

- **規模**: S (0.5 〜 1h)
- **触るファイル**: 3 ファイル (`SubAgentsList.tsx` / `ContextGauge.tsx` /
  `TodosList.tsx`) + `selectMonitorForSession` への薄いラッパー追加 (任意)
- **Pros**:
  - 即効、TrayContextBar と同じパターンで一貫性 ◎
  - 永続化 schema 影響 0、既存テスト破壊なし
  - persist 対象でない `perSession` (volatile) を活かすだけ
- **Cons**:
  - **store の中身が依然 dirty**: Rust の global state には A/B/C の subagent が
    全部混ざって積まれている。`perSession[A]` / `[B]` / `[C]` の値は **すべて
    「混ざった global の slice + 後付け key」**。**真の session 別状態にならない**。
  - 例: A だけが Task を呼んだ後、B でメッセージを送ると、`perSession[B]` の値が
    A の Task を含む global state で上書きされる (B は Task 呼んでないのに表示される)
  - tool_result の dedup も global なので A 完了で B の subagent が消える混線が残る
- **症状の改善度**: ◎ コンテキスト % は近似的に正しくなる、× サブエージェント
  /todos は依然混線

### 案 B: Rust 側で `MonitorState` を session 単位 HashMap に昇格 (本質修正)

**内容**: `MonitorHandle` を `Arc<RwLock<HashMap<String, MonitorStateInner>>>` に
昇格、`dispatch_to_monitor` で session_id をキーに dispatch。`monitor:tick` の
payload に `session_id` を含める。frontend は payload の `session_id` で
`perSession` に dispatch (currentSessionId 後付けを廃止)。

```rust
// events/monitor.rs (修正案イメージ)
pub type MonitorHandle = Arc<RwLock<HashMap<String, MonitorStateInner>>>;

// agent.rs dispatch_to_monitor
async fn dispatch_to_monitor(app: &AppHandle, session_id: &str, raw_line: &str) {
    ...
    let mut map = state.write().await;
    let inner = map.entry(session_id.to_string()).or_default();
    let changed = monitor::update_from_sidecar_event(inner, &envelope);
    if changed {
        // payload に session_id を含めて emit
        app.emit("monitor:tick", &MonitorTickPayload {
            session_id: session_id.to_string(),
            state: inner.state.clone(),
        });
    }
}
```

- **規模**: M (4 〜 6h、テスト含)
- **触るファイル**:
  - `src-tauri/src/events/monitor.rs` (HashMap 化、`emit_if_due` の payload 変更)
  - `src-tauri/src/commands/agent.rs` `dispatch_to_monitor` の `_session_id` 解放
  - `src-tauri/src/lib.rs` `manage::<MonitorHandle>` 初期値変更
  - `hooks/useClaudeMonitor.ts` payload 形変更、currentSessionId 後付け廃止
  - `lib/stores/monitor.ts` `setMonitor(state, sessionId)` の sessionId を必須化、
    global `monitor` を deprecate (or 「最後に届いた値」に弱化)
  - `components/sidebar/{ContextGauge,SubAgentsList,TodosList}.tsx` の selector 切替
    (案 A と同じ)
  - `StatusBar.tsx` model 表示も session-scoped 化を検討
- **Pros**:
  - 真の session 別 state、混線ゼロ
  - DEC-063 の建前と完全整合、後の機能拡張で副作用最小
  - `purgeSessions` も自然 (HashMap.remove で完了)
  - Rust 側のテスト (`test_sub_agent_spawn_and_complete` 等) が session 単位で
    意味を持つようになる
- **Cons**:
  - Rust unit test の追加・改修が必要 (現状 6 件のテストはすべて単一 inner 前提)
  - `monitor:tick` の wire format 変更 (payload に `sessionId` 追加) → frontend
    の type も変更
  - HashMap 肥大化の cleanup 必要 (session 削除時の purge を agent.rs から呼ぶ)
- **症状の改善度**: ◎◎ 全症状解消

### 案 C: 描画層で session フィルタ + event log として全部保持

**内容**: Rust monitor は global のまま、ただし sub_agents / todos に
`session_id: String` field を追加し、event 受信時に「source session_id」を持たせる。
frontend は `s.monitor.sub_agents.filter(a => a.sessionId === currentSessionId)` で
描画。

- **規模**: S+ (1 〜 2h)
- **触るファイル**: monitor.rs の構造体追加 + frontend filter
- **Pros**:
  - HashMap 化を避けて差分小
  - 全 session の状態が 1 ヶ所で観測できる (デバッグに有利)
- **Cons**:
  - **state 設計として汚い**: `MonitorState.sub_agents` は「現在稼働中」の意味で
    定義されているのに、複数 session の amalgam になる
  - tokens_used / tokens_max / model / git_branch の **scalar 値は filter で
    救えない** (session_id 紐付けができないため)、結局 HashMap 化が必要
  - `active_task_ids` の dedup ロジックも session を区別する必要が出て、結局
    案 B 相当の改修になる
  - 案 B より中途半端で実装コストの割に綺麗にならない
- **症状の改善度**: ○ (sub_agents / todos のみ、コンテキスト % は治らない)

---

## 5. 推奨案と理由

### 推奨: **案 A を即時投入 + 案 B を続編 PR で**

**Phase 1 (今すぐ、v1.42.0 想定)**: **案 A**
- 0.5h で完了、CEO 着手判断 → 即日 ship 可能
- TrayContextBar と Sidebar の **「session 別 vs global」食い違い** という UX の
  最重大不整合を即解消
- コンテキスト % は完全に正しくなる (Rust が global でも、`perSession[sid]` の
  key 付けがそれっぽく機能する。session が切り替わったあと B の sidecar が
  tick するまでは A の値が `perSession[B]` に乗ってしまうが、B の最初の
  tick で正しい値に更新される。許容できる暫定値)
- **subagent / todos は依然不正確** (global state の混線が残る) という limitation を
  CHANGELOG 明記、続編 PR で根本修正の宣言

**Phase 2 (続編、v1.43.0 想定)**: **案 B**
- Rust HashMap 化で根治
- `monitor:tick` の wire format に `sessionId` を載せる migration
- 案 A の selector はそのまま流用 (perSession のキー付けが正確になるだけ)

理由:
1. **オーナーが今困っている** ＝ 即日ロールアウト可能な案 A を先に出す
2. 案 B のみだと半日〜1 日待たせる、その間 CEO/オーナーは「治った気にならない」
3. 案 A は案 B の **prefix** であり捨て実装ではない (案 B 完成後そのまま生きる)
4. 案 C は中途半端で却下

---

## 6. 実装ロードマップ (推奨案)

### Phase 1: 案 A (frontend だけで session selector 化)

**触るファイル**:
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/sidebar/SubAgentsList.tsx`
  - `useSessionStore.currentSessionId` 追加 import
  - `useMonitorStore` の selector を `selectMonitorForSession` ベースに変更
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/sidebar/ContextGauge.tsx`
  - 同上、`selectContextPercent` / `selectIsNearLimit` を session 引数を取る版に
    refactor (or 直接 monitor から計算)
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/sidebar/TodosList.tsx`
  - 同上
- (任意) `lib/stores/monitor.ts` に
  `selectContextPercentForSession(s, sessionId)` 等の便利 selector を追加

**persist schema 影響**: なし (全部 volatile)

**既存 E2E への影響**:
- `playwright/` 配下に「コンテキストゲージ表示確認」テストが**ある**かは未確認だが、
  仮にあっても session 1 個の通常フローは挙動不変 (`currentSessionId` が
  `perSession` に key 入りすれば従来と同じ値)

**testing 戦略**:
- Vitest unit: `selectMonitorForSession` を 3 セッション分 setMonitor し、引いた
  値が混ざらないこと
- Playwright (任意): 2 session 作成 → 各 session で異なる model を起動 → Sidebar
  ContextGauge の Badge model 表示が session 切替で変わること

### Phase 2: 案 B (Rust HashMap 化)

**触るファイル**:
- `src-tauri/src/events/monitor.rs`
  - `MonitorHandle = Arc<RwLock<HashMap<String, MonitorStateInner>>>` 化
  - `emit_if_due` を `(session_id: &str)` 受け取り、payload に session_id 含める
  - `purge_session(sessionId)` 追加 (session 削除 cascade で呼ぶ)
  - 既存テスト 6 件を 1 session 用に書換
- `src-tauri/src/commands/agent.rs`
  - `dispatch_to_monitor` の `_session_id` を `session_id` に
  - `stop_agent_sidecar` 後に monitor の当該 session entry を purge
- `src-tauri/src/lib.rs`
  - `manage::<MonitorHandle>` の初期値を空 HashMap に
- `hooks/useClaudeMonitor.ts`
  - payload 型を `{ sessionId: string; state: MonitorState }` に変更
  - `setMonitor(state, sessionId)` の sessionId を payload から取る (currentSessionId 後付け廃止)
- `lib/stores/monitor.ts`
  - global `monitor` field を deprecate or 「最終受信 (デバッグ専用)」コメント
  - `setMonitor` の sessionId を非 nullable に
- `lib/stores/purge-project.ts`
  - 既存の `purgeSessions` は frontend 側のみ。Rust 側 purge command を追加 invoke

**persist schema 影響**: なし (volatile only)

**既存 E2E への影響**:
- `monitor:tick` の payload 形変更 → frontend 側 hook の整合だけ取れば既存 UI は
  そのまま動く
- 「`s.monitor` を読んでいる古い code」(StatusBar.tsx:46 など) は session-scoped
  に切替えるか、deprecation 期間を経て削除

**testing 戦略**:
- Rust unit: 2 session が独立した state を持つこと、tool_result が他 session の
  subagent を消さないこと、purge が指定 session のみ消すこと
- Vitest: `useClaudeMonitor` mock で 2 session 分 `monitor:tick` を流し
  `perSession` が正しく分離されること
- Playwright: 再現手順を自動化 (3 session で Agent 呼び → SessionList 切替で
  subagent 一覧が変わること)

---

## 7. 副次効果として直すべき箇所

優先度順:

1. **`StatusBar.tsx:46` の global model 表示**
   - 現在 global `s.monitor.model` 表示。複数 session で異なる model 利用時、
     どの model を出しているか不明瞭
   - 案 B 後、active session の model を表示する変更を推奨 (Tray の
     ModelPicker と整合)

2. **Rust 側 `current_tool` field**
   - `MonitorState.current_tool` も global なので、A の tool 実行中に B が
     違う tool を呼ぶと混ざる
   - 案 B で session 別 HashMap 化 → 自動解消

3. **`active_task_ids` (Rust 内部) の dedup**
   - 現状 global HashMap。A の `toolu_xxx` と B の `toolu_yyy` が同じ
     map に乗る。tool_result が片方だけ来ると整合崩れる可能性 (理論上は
     UUID 衝突しないので動く可能性高、ただし状態として汚い)

4. **`UsageStatsCard` (関係なし)**:
   - 本件と独立。OAuth API + JSONL 集計でアプリ全体の累計を出す仕様、
     session 別である必要なし。**変更不要**

5. **`useClaudeMonitor.ts:38` の currentSessionId 後付け**:
   - 案 B 採用後は payload の `sessionId` を使うべき。後付け廃止。
   - そもそも tick 発生源と active session が一致する保証がないので、現状の
     後付けは「ユーザーが見ている session に値が貼り付く」という直感に反する
     副作用を生んでいる (本件の C の混線シナリオの一部)

---

## 8. 不確実事項

- **sidecar (Node.js) 側の修正は不要**: stdout NDJSON の format は変更しない、
  agent.rs の dispatcher 側で session_id を載せる方針なので sidecar は無関係。
  確認済 (`sidecar/src/index.ts` の出力は既存通り、Rust が wrap する形)。
- **MAX_REQUEST_ID_CACHE (10000)**: 案 B で session ごとに HashSet を持つので
  上限 10000 × N session になる。N=8 で 80000 entry、~5MB 程度。許容範囲。
  気になれば session 単位に絞ったほうが正確 (request_id は session 内で unique
  なので区別する意味はある)。
- **`monitor:tick` を listen している外部コード**: Grep 済、frontend 内
  `useClaudeMonitor` のみ。外部購読者なし。
- **DEC-074 (auto-compact) との干渉**: auto-compact 通知は session 単位で判定される
  はず。本件修正後、context % が session 別に正確になることで auto-compact 検知
  も正確化する **副次的 benefit** あり。

---

## 9. CEO への最終提案

> **オーナー報告のバグは事実、Rust 側 monitor が DEC-063 (session 単位 sidecar
> 化) に追従できておらず global state を共有している。Tray は PM-984 で session
> 化済だが Sidebar 3 components が乗り換え漏れしている。Phase 1 (frontend のみ
> 0.5h) で症状の大半を即解消、Phase 2 (Rust HashMap 化 4-6h) で根治。**

**着手判断要請**:
- [ ] Phase 1 のみ即時着手 (0.5h、v1.42.0 hotfix 想定)
- [ ] Phase 1 + Phase 2 を v1.43.0 として一気にまとめて実装 (5-7h)
- [ ] Phase 1 を skip して Phase 2 のみ着手 (clean cut、ただし 1 日待たせる)

開発部門推奨は **Phase 1 即時 → Phase 2 続編** (上記推奨案 5)。
