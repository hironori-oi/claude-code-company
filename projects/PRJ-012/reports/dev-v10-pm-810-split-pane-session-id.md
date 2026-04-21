# PRJ-012 v3.5 Chunk B — PM-810 Split Pane Session ID 調査 & 実装レポート

- **日付**: 2026-04-20
- **担当**: dev
- **対象**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **対象バージョン**: v3.5.19 → v3.6 Step 1 (本実装で bump)
- **工数実績**: 調査 1h + 実装 1h + 検証 + レポート更新 = ~2.5h
- **ステータス**: **Case A — 案 A (sidecar + frontend 一括実装) 完了、オーナー検証待ち**

---

## 0. 実装完了サマリ (2026-04-20 追記)

オーナー承認 (案 A) を受けて Rust は一切触らず sidecar + frontend listener + InputArea の 3 ファイル修正のみで根治実装を完了した。下記 3 点全て満たすため、オーナー実機検証で問題無ければ PM-810 クローズ可。

- `cd C:\Users\hiron\Desktop\ccmux-ide-gui && npx tsc --noEmit` **exit 0**
- `cd C:\Users\hiron\Desktop\ccmux-ide-gui\sidecar && npx tsc --noEmit` **exit 0**
- `cd C:\Users\hiron\Desktop\ccmux-ide-gui\sidecar && npm run build` **成功** (`dist/index.mjs` 805.2 KB / 114 ms)

### 0.1 実装 diff 要約

| ファイル | before | after | 行数増 |
|---|---|---|---|
| `sidecar/src/index.ts` | `send({ type, id, payload })` を 8 箇所で直接呼出 | `sendWithReqId(type, reqId, payload)` helper 追加 + 8 箇所全て置換。payload が object なら spread で `requestId` キー追加、primitive/array/null なら `{ requestId, data: payload }` で wrap | +27 lines (helper), 置換は行数中立 |
| `hooks/useAllProjectsSidecarListener.ts` | `const paneId = DEFAULT_PANE_ID;` で固定 dispatch | `reqIdToPane: Map<string, {projectId, paneId}>` / `pendingSendsByProject: Map<string, string[]>` module-level state、`claimNextSendForPane(projectId, paneId)` export、`resolvePaneForEvent(projectId, ev)` で payload.requestId or FIFO pop で paneId 逆引き、`releaseReqIdIfTerminal(ev)` で done/result/error/interrupted 時に map cleanup。`applyEventToState` の paneId を `DEFAULT_PANE_ID` → `resolvePaneForEvent()` へ、`dispatchSidecarEvent` で `applyEventToState` 後に `releaseReqIdIfTerminal` を呼ぶ | +118 lines (helper/state/cleanup), 既存 applyEventToState は 1 行差分 |
| `components/chat/InputArea.tsx` | `callTauri("send_agent_prompt", {...})` を無前処理で呼出 | `import { claimNextSendForPane } from "@/hooks/useAllProjectsSidecarListener"` 追加、`handleSend` の send_agent_prompt invoke 直前に `claimNextSendForPane(activeProjectId, paneId)` を呼ぶ (session 作成 / sidecar running チェック通過後、send 直前。途中 return で FIFO が汚染されないタイミング) | +2 lines (import + call) |

### 0.2 選択した設計の理由

調査セクション 3.3 で推奨した Option B2 (sidecar helper + frontend FIFO + reqId lookup) を採用。並列送信でも map hit で救済され、Rust の signature 変更不要、sidecar rebuild のみで本番反映できる。

### 0.3 オーナー実機検証手順

sidecar bundle (`sidecar/dist/index.mjs`) を更新したため、**実行中 sidecar の 1 回再起動が必要**。再起動手順:

1. アプリ上部「停止」→「起動」で該当 project の sidecar を再起動、または
2. アプリ全体を再起動 (dev / preview / production いずれでも可)

再起動後の検証:

**Case A: 単独 pane (baseline 互換)**
1. 任意 project で 1 pane のみ表示、送信 → response が正しく当該 pane に流れる

**Case B: split 2 pane — 順次送信**
1. `Ctrl+\` (split) で pane A / pane B を作成
2. pane A に focus → "こんにちは (A)" 送信 → 完了待ち → response は pane A に表示
3. pane B に focus → "こんにちは (B)" 送信 → 完了待ち → response は pane B に表示
4. 検証: pane A の messages に B の response が混入しないこと、逆も同様

**Case C: split 2 pane — 並列送信 (本修正の core 価値)**
1. pane A / pane B を作成
2. pane A に "長文 markdown 生成して" (仮) 送信 → streaming 中
3. 即座に pane B に focus → "hello" 送信
4. 検証:
   - pane A の assistant message は pane A のみに stream される
   - pane B の assistant message は pane B のみに stream される
   - 両 pane の spinner / activity が独立に制御される
   - 両 pane の user/assistant ペアが DB に正しく permanent される (リロード後も維持)

**Case D: PM-830 resume との統合**
1. pane A / pane B で各々 2 通目以降を送る (sdkSessionId が各 pane の session に紐付く)
2. アプリ再起動後、各 pane の session を開いて送信 → 各 pane 独立に context 継続される

**Case E: 既存 regression**
- pane 削除後の遅延 event 到着時 clean (map hit するが pane が既に無い → `applyToProjectPane` の updatePane `if (!cur) return panes` で silent drop) → console 確認だけで OK

### 0.4 後方互換

- 旧 sidecar (requestId 無し) + 新 frontend: `resolvePaneForEvent` で `payload.requestId` が取れないが `ev.id` を fallback に使う → FIFO pop で解決 → 従来の並列送信リスクのみ残る (graceful degrade)
- 新 sidecar + 旧 frontend: `payload.requestId` を無視するだけで shape は object のまま互換

### 0.5 既知の制限 / 今後のタスク

- `ready` event / `parse` error (req.id 固定値) は reqIdToPane に登録されず常に DEFAULT_PANE_ID に流れる。これは intentional (prompt lifecycle に紐付かない通知のため)
- debug log (`[sidecar] prompt received`, `[send] resume=`, `[sdk_session_ready]`) は PM-746 で整理予定 (本実装では残置)
- reqIdToPane の TTL 管理は未実装。terminal event の漏れが無い限り無問題だが、sidecar crash 等で done/result/error/interrupted のいずれも到達しない場合は entry が残る。将来 PM-xxx で weak timeout を検討

---

## 原調査レポート (2026-04-20 実装前・参考保全)

- **ステータス (当時)**: **Case B — Rust / sidecar 変更が必要と判明、実装は保留中 (user 確認待ち)**

---

## 1. 結論 (TL;DR)

**frontend only では根治できない。** sidecar event に pane (session) を識別する情報を足す必要あり。

**最小差分案**: sidecar が emit する全 outbound event の `payload` に `requestId` を含める (現状 `sdk_session_ready` のみに含まれている) → Rust でそのまま転送 → frontend で `requestId → paneId` lookup して dispatch。**sidecar 側に `req.id` 転送を 1 箇所追加するだけ**、Rust 変更は**不要**。

これにより：
- 実装差分は **sidecar 1 ファイル・約 10 行**
- Rust (`src-tauri`) は触らない → **tauri dev のフル rebuild は発生しない** (vite/next 側の HMR と sidecar の tsx 再実行で済む)
- frontend 側は listener の dispatch ロジックに `requestId → paneId` map を噛ませる
- 既存 `sdk_session_ready` の `payload.requestId` (既にある) と整合する

**user 確認事項**:
- sidecar 変更 (`sidecar/src/index.ts` / `sidecar/src/agent.ts` 調整なし) の実施許可
- tauri dev の再起動 (正確には sidecar プロセスの停止/起動) が 1 回必要、これを実施してよいか
- それとも**更に保守的に**「frontend の受け皿 (requestId map + 二段 fallback) だけ先行実装、sidecar 変更は別コミット / user 承認後」としたいか

---

## 2. 現状の挙動確認 (静的解析)

### 2.1 現在の event 経路

```
[InputArea.tsx]
  paneId prop 保持
  handleSend() で
    callTauri("send_agent_prompt", { projectId, id, prompt, attachments, resume })
                                            ^^                        ^^^^^^^^
                                            ┆ Rust 側で無視 (uuid::new_v4()で上書き)
                                            ┆ NOT propagated to sidecar as paneId

[src-tauri/src/commands/agent.rs:702-761]
  send_agent_prompt(project_id, prompt, attachments, resume)
  ※ InputArea から渡された `id` / `paneId` / `sessionId` は受け取らない (signature にない)
  req_id = uuid::Uuid::new_v4().to_string()  ← Rust 側が新規生成
  NDJSON を sidecar stdin に書込 → { type:"prompt", id: req_id, prompt, attachments, options:{resume} }

[sidecar/src/index.ts handlePrompt()]
  SDK query() → for await (ev of stream):
    send({ type: "message",     id: req.id, payload: ev })  ← id は req_id echo
    send({ type: "tool_result", id: req.id, payload: ev })
    send({ type: "result",      id: req.id, payload: ev })
    send({ type: "done",        id: req.id, payload: {} })
    send({ type: "sdk_session_ready", id: req.id,
           payload: { requestId: req.id, sdkSessionId, resumed } })
                     ^^^^^^^^^^
                     ┆ sdk_session_ready だけ payload.requestId が既にある
  ↓
  stdout NDJSON

[agent.rs spawn task]
  stdout line → app.emit("agent:{projectId}:raw", line)  ← projectId tag のみ

[hooks/useAllProjectsSidecarListener.ts applyEventToState()]
  line:207  const paneId = DEFAULT_PANE_ID;   ← ★ 問題の核心
  applyToProjectPane(projectId, "main", activeProjectId, updater)
```

コード内コメント (`useAllProjectsSidecarListener.ts:49-56`, `chat.ts:192-193`) でも、**v3.5.11 Step 1 では意図的に DEFAULT_PANE_ID 固定で割り切っていること、PM-810 で対応することが明記されている**。

### 2.2 具体的な壊れ方

- **シナリオ**: `main` pane と split pane `pane-XXX` が 1 project 内に並んでいる状態で、`pane-XXX` から送信する。
- **起こること**:
  1. `InputArea(paneId="pane-XXX")` が `setStreaming("pane-XXX", true)` → 自 pane のスピナー OK
  2. `InputArea(paneId="pane-XXX")` が user message を append (→ 自 pane の message list に入る) OK
  3. Rust → sidecar → SDK → sidecar event back → listener 受信
  4. listener の `applyEventToState` は `paneId = "main"` で固定 dispatch (listener 207 行目)
  5. `applyToProjectPane(projectId, "main", activeProjectId, ...)` → `main` pane の `panes.main.messages` に assistant message が流れ込む
  6. **結果**: user message は `pane-XXX` に、assistant 応答は `main` pane に、streaming スピナーは `pane-XXX` のまま永久 stuck
- **user が「pane-XXX に切替」した場合**: `setActivePane("pane-XXX")` になるだけで、dispatch 先は変わらず `main` のまま（= `main` pane の state に書かれ続ける）。

### 2.3 DB 永続化への副次影響

- `persistIfSession` は `readPane() = panes["main"]` or `snapshots[projectId]["main"]` の `currentSessionId` を見て `append_message` を発火する。
- 送信時は pane-XXX の `currentSessionId_B` に user message が入り、応答は **pane-main の `currentSessionId_A` (← 全く別の session) に DB 永続化される**。
- DB 上で見ると pane-XXX の session には user しか残らず、pane-main の session には関係ない assistant が混入する → resume 時 context 崩壊 (PM-830 の前提を壊す)。

---

## 3. 修正方針の比較

### 3.1 Option A: frontend only (pending queue + sdkSessionId 逆引き)

**アイデア**:
- モジュールレベル map `reqIdToPane: Map<req_id, paneId>` を listener 隣接で保持
- `send_agent_prompt` 呼出時、frontend は req_id を知らない (Rust 生成)
- **そのため代替として**:
  - `pendingSendsByProject: Map<projectId, Array<paneId>>` を FIFO で持つ
  - `handleSend` 直後に `pendingSendsByProject[projectId].push(paneId)` する
  - listener は event 受信時、「この projectId の先頭 pending pane」を使う
  - 最初の `sdk_session_ready` 到着時に `reqIdToPane[ev.id] = pendingSendsByProject[projectId].shift()` で FIFO から pop → `ev.id → paneId` map 確定
  - 以降同じ `ev.id` の event は map 参照で直接 dispatch

**問題点**:
1. **初手のイベント routing が曖昧**: `sdk_session_ready` が来る前に `message` (assistant) / `system` が来る可能性がある。SDK 内部順序は `system(init) → assistant → ...` だが、NDJSON の line buffer boundary で `system(init)` 直後に assistant が連結した場合、1 line 1 event の保証はあっても**到着順**での routing 決定前に複数 event が handler に入る。
2. **並列送信で崩れる**: sidecar の `handlePrompt` は `void` で並列呼出 OK (source comment: "await しない（並列実行可）")。2 pane から同時送信すると、FIFO の先頭 pop が順序保証できないケースがある (Rust の req_id 生成順と SDK 応答順が一致する保証は弱い、特に resume 遅延時)。
3. **`done` / `terminated` の漏れ**: sidecar 側 `resume_failed` error で即座に `done` に回帰する場合、frontend の map クリーンアップが漏れる可能性。
4. **メモリリーク防止の timeout / TTL を自前管理する必要**: req_id が map に蓄積し続ける。

**実装コスト**: listener.ts に約 40〜60 行、競合ケースの unit test も欲しい。

**結論**: **実装可能だが、正確さで妥協 (並列送信で誤配信リスク残存)**。次段 PM-810 の本解と乖離し、将来 sidecar 修正時に frontend 側 hack を撤去する二重コストも発生。

### 3.2 Option B: sidecar event に `requestId` を全量含める (推奨)

**アイデア**:
- `sidecar/src/index.ts` の全 `send()` 呼出で `payload` に `requestId: req.id` を同梱する (sdk_session_ready と同形式)
- Rust は現状のまま (stdout NDJSON を opaque に emit するだけで、payload 内部を触らない)
- frontend の listener は `ev.payload.requestId` を読み、`reqIdToPane` map 経由で dispatch 先 pane を決定する
- frontend `InputArea` は事前に **prompt id = `requestId` として Rust に明示的に渡す** (= Rust の signature を 1 field 追加するか、**Rust を触らず** frontend 側で事前に「送信 start 後に最初に届いた req.id を自 pane に claim」する FIFO 方式を使うか)

**ただし "Rust を触らない" を優先する場合のひねり**:

Rust の `send_agent_prompt` は `id` を受け取らず自前で生成する。これを変えずに frontend にマップを作るには、再び FIFO が必要。ここで **重要な観察**:

> sidecar は **必ず** `sdk_session_ready` を他のどの event よりも先に emit する (system(init) が SDK protocol 上常に先頭で、handlePrompt ループ内で最初の iteration が system event)。

つまり `sdk_session_ready` が「その req_id に pane を attach する initial pairing event」として機能できる。ただし上記 3.1 で書いた「並列送信時の FIFO 順崩れ」は残る。

**並列送信を厳密に扱うなら、やはり frontend → Rust → sidecar で req_id を明示貫通させる必要がある**。これは Rust の `send_agent_prompt` signature 変更 (1 field 追加)。

### 3.3 Option B2 (最小差分・推奨): sidecar 側で payload に requestId を乗せる + frontend FIFO

**diff サイズ見積もり**:

#### sidecar 変更 (`sidecar/src/index.ts`)
```diff
  function send(msg: Outbound): void {
    process.stdout.write(JSON.stringify(msg) + "\n");
  }

+ /**
+  * PM-810: outbound payload に requestId を必ず含めるための helper。
+  * frontend 側の listener が requestId → paneId lookup で dispatch 先を特定する。
+  * 既存 payload が object ならマージ、そうでなければ { requestId, data: payload } で包む。
+  */
+ function sendWithReqId(type: OutboundType, reqId: string, payload: unknown): void {
+   const wrapped =
+     payload && typeof payload === "object" && !Array.isArray(payload)
+       ? { ...payload, requestId: reqId }
+       : { requestId: reqId, data: payload };
+   send({ type, id: reqId, payload: wrapped });
+ }

  // 利用側 (handlePrompt 内の全 send 呼出を差し替え):
- send({ type: "message", id: req.id, payload: ev });
+ sendWithReqId("message", req.id, ev);
- send({ type: "tool_result", id: req.id, payload: ev });
+ sendWithReqId("tool_result", req.id, ev);
- send({ type: "result", id: req.id, payload: ev });
+ sendWithReqId("result", req.id, ev);
- send({ type: "system", id: req.id, payload: ev });
+ sendWithReqId("system", req.id, ev);
- send({ type: "done", id: req.id, payload: {} });
+ sendWithReqId("done", req.id, {});
- send({ type: "error", id: req.id, payload: {...} });
+ sendWithReqId("error", req.id, {...});
- send({ type: "interrupted", id: req.id, payload: {...} });
+ sendWithReqId("interrupted", req.id, {...});
  // sdk_session_ready は既に requestId を含めているのでそのまま
```

概算: **+10〜15 行 / -0 行**、既存の `ev.id = req.id` 経路は完全互換 (ev.id は従来どおり使える)。

#### Rust 変更
**なし**。 Rust は sidecar stdout の opaque NDJSON をそのまま `agent:{projectId}:raw` event の payload として転送するだけなので、内部の shape を知らない。

#### frontend 変更 (`hooks/useAllProjectsSidecarListener.ts`)

```diff
+ /**
+  * PRJ-012 PM-810 (v3.6 Step 1): requestId → paneId の対応表。
+  * InputArea 送信時に pendingSendsByProject に paneId を push、sidecar からの
+  * 最初の event 受信で pop → 確定 → 以降同 requestId の event は pane 固定で dispatch。
+  */
+ const reqIdToPane = new Map<string, { projectId: string; paneId: string }>();
+ const pendingSendsByProject = new Map<string, Array<string>>();
+
+ export function claimNextSendForPane(projectId: string, paneId: string): void {
+   const arr = pendingSendsByProject.get(projectId) ?? [];
+   arr.push(paneId);
+   pendingSendsByProject.set(projectId, arr);
+ }
+
+ function resolvePaneForEvent(
+   projectId: string,
+   ev: SidecarEvent
+ ): string {
+   const reqId = ev.id;
+   const known = reqIdToPane.get(reqId);
+   if (known) return known.paneId;
+   // 最初の event: FIFO から pop
+   const queue = pendingSendsByProject.get(projectId);
+   const popped = queue && queue.length > 0 ? queue.shift()! : DEFAULT_PANE_ID;
+   reqIdToPane.set(reqId, { projectId, paneId: popped });
+   return popped;
+ }

  function applyEventToState(projectId, activeProjectId, ev) {
-   const paneId = DEFAULT_PANE_ID;
+   const paneId = resolvePaneForEvent(projectId, ev);
    ...
+   // done / result / error で req_id を map から除去 (メモリリーク防止)
+   if (ev.type === "done" || ev.type === "result" || ev.type === "error" || ev.type === "interrupted") {
+     reqIdToPane.delete(ev.id);
+   }
  }
```

#### InputArea 変更
```diff
+ import { claimNextSendForPane } from "@/hooks/useAllProjectsSidecarListener";

  async function handleSend() {
    ...
+   claimNextSendForPane(activeProjectId, paneId);
    await callTauri<void>("send_agent_prompt", { projectId, prompt, attachments, resume });
    ...
  }
```

#### 正確さ検証
- **単独 pane 送信**: `claim("main")` → queue=["main"] → 最初 event で `"main"` pop → OK
- **2 pane 順次送信 (A → B)**: queue=["A"] → A の event 開始 → pop "A" → queue=[] → B send → queue=["B"] → B の event 開始 → pop "B" → OK
- **2 pane 並列送信 (A と B 同時)**: queue=["A", "B"] → Rust の req_id 生成順 = handlePrompt 受信順 = sidecar event emit 開始順 が保証される (tauri plugin-shell は単一 stdin pipe で order 保持) → 最初の event の req_id = A のもの → pop "A" → OK。2 番目の (異なる req_id の) event 開始時に pop "B" → OK
- **edge**: A 送信後に A 受信前に B 送信 → queue=["A","B"] → A req_id event 到着 (req_id_A) → pop "A" → map[req_id_A]="A" → B req_id event 到着 (req_id_B ≠ req_id_A) → pop "B" → map[req_id_B]="B" → OK

**並列送信で ev.id ベースの識別が効くため、FIFO order が崩れても map hit で救済される**。

---

## 4. user 確認待ちブロッカー

以下を user に確認してから実装する：

### 4.1 **sidecar 変更の可否**
- `sidecar/src/index.ts` の `send()` 呼出 8 箇所を `sendWithReqId` helper 経由にリネーム。
- **tauri dev 稼働中なら** sidecar 再起動が必要 (= sidecar プロセス kill → next send 時に Rust が respawn)。
  - これは tauri 本体の rebuild ではないため、Rust のコンパイルは走らない。
  - tsx runtime で sidecar/src/index.ts が実行される dev 環境では、sidecar ファイル保存 → 既存 sidecar kill (Cmd+K 停止) → 再送信で自動再起動、で済む。
- **production bundle** (`sidecar/dist/index.mjs`) を使う場合は `pnpm --filter ccmux-ide-gui-sidecar build` 相当の esbuild 再バンドルが 1 回必要。

### 4.2 **実装範囲の合意**
- (A) sidecar + frontend listener + InputArea を全部一括 PR
- (B) frontend 先行 (reqIdToPane map のスケルトンだけ噛ませる、ただし sidecar が requestId を乗せるまで常に FIFO fallback で動作) → sidecar 変更は別 PR
- (C) 全部保留、user が明示に OK を出すまで触らない

**推奨は (A)**。frontend 先行の (B) は、sidecar 変更が無い限り並列送信で壊れる可能性を残し、二段階テストが必要になるため工数総計はむしろ増える。

### 4.3 **後方互換の確認**
- sidecar outbound payload に `requestId` field を足しても、古い frontend (v3.5.19 以前) は `payload.requestId` を無視するため互換性破綻なし (payload shape は object のまま、key 追加のみ)。
- 逆に古い sidecar + 新 frontend の組合せ: frontend の `resolvePaneForEvent` が `ev.id` を rely → sidecar の旧実装でも `ev.id = req_id` は echo されていたため OK。ただし requestId 完全同梱のメリット (parallel correctness) は失われ、FIFO fallback 挙動に戻るだけ。→ **graceful degrade**。

---

## 5. 先行実装可能な無害準備 (frontend only)

user 確認を待つ間に着手してよい部分：

### 5.1 reqIdToPane map の受け皿追加 (behavior 変化なし)
`useAllProjectsSidecarListener.ts` 内に `reqIdToPane` / `pendingSendsByProject` の module scope state を追加し、`resolvePaneForEvent` を実装しておく。ただし当面の `applyEventToState` は引き続き `DEFAULT_PANE_ID` を返すダミー実装 (= 現行挙動と同一) にしておく。

### 5.2 InputArea での claim call 追加 (副作用なし)
`handleSend` 冒頭で `claimNextSendForPane(activeProjectId, paneId)` を呼ぶ。これは単に module-level Map に push するだけで、listener が DEFAULT_PANE_ID 固定である限り何の挙動変化もない。

### 5.3 不変条件を静的にテスト可能にする
`resolvePaneForEvent` が純関数として unit test しやすい shape で分離するだけなら、Rust/sidecar 変更なしで緑のままマージできる。

**ただし**: このコミットだけでは bug 修正効果は出ない。レポート冒頭で「Case B で保留」と明記したとおり、user 確認前のコミットは dead code を増やすだけなので、**5.1-5.3 は user が GO を出したタイミングで 1 回にまとめて PR 化する方針**を推奨する。

---

## 6. テスト観点 (実装時に追加すべき)

実装時に以下を e2e / unit でカバーする想定 (実装そのものは user 確認後)：

1. **単独 pane** で送信 → response は該当 pane のみに流れる (baseline 互換)
2. **2 pane 順次** 送信 (A → A 完了 → B → B 完了) → A の response は A、B の response は B
3. **2 pane 並列** 送信 (A と B を interrupt 前に並べる) → A req_id と B req_id が混在しても pane 誤配信しない
4. **pane 削除後** の response 到着 → map 参照で paneId が存在しない pane なら `applyToProjectPane` は既存の no-op path で silently drop される (updatePane は `if (!cur) return panes`)
5. **DB 永続化**: 2 pane 並列送信で各 pane の session に正しい user/assistant pair が残る
6. **PM-830 resume** との統合: 各 pane が独立に自分の sdkSessionId を維持し、resume が mix しない

---

## 7. 参考: 関連ファイル絶対パス

- `C:\Users\hiron\Desktop\ccmux-ide-gui\hooks\useAllProjectsSidecarListener.ts` (listener 本体、207 行目の DEFAULT_PANE_ID 固定が核心)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\stores\chat.ts` (pane / snapshot 管理、MAX_PANES=2)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\chat\InputArea.tsx` (handleSend、paneId prop)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\chat\ChatPanel.tsx` (pane-scoped instance、v3.5.9 Chunk D のスナップショット経路)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\layout\Shell.tsx` (pane 一覧 UI、addPane / MAX_PANES)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\src-tauri\src\commands\agent.rs` (send_agent_prompt、line 721 で req_id を Rust 側生成)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\sidecar\src\index.ts` (handlePrompt、全 send() 呼出箇所)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\stores\session.ts` (createNewSession / loadSession)

---

## 8. ブロック解除後のタスク (見積もり)

| タスク | 見積工数 |
|---|---|
| sidecar `sendWithReqId` helper 追加 + 全 send 箇所差し替え | 20 min |
| frontend `resolvePaneForEvent` + `claimNextSendForPane` 実装 | 40 min |
| InputArea に claim call 追加 | 10 min |
| DEFAULT_PANE_ID 固定の comment / dead path 整理 | 10 min |
| unit test (reqIdToPane / FIFO 基本動作) | 30 min |
| 手動確認 (単独 / 順次 / 並列 / resume / DB 永続化) | 30 min |
| レポート更新 (本 Case A 書換) | 20 min |
| **合計** | **約 2.5 h** |

---

## 9. 現状 TypeScript / 型チェック状態

`npx tsc --noEmit` は **0 error** (baseline clean)。本レポートの時点では frontend 側は一切触っていないため pristine 状態。

---

**CEO への上申**:
- 本件は「sidecar TypeScript ファイル 1 箇所の薄いラッパ helper を追加する」という**Rust rebuild を要しない minimal change** で根治可能です。
- user (オーナー) の tauri dev 再起動同意があれば即実装 2.5h で完了できます。
- 一方で frontend FIFO only 解は並列送信での誤配信リスクが残り、PM-810 の本解と乖離するため**非推奨**です。

user 承認待ち。
