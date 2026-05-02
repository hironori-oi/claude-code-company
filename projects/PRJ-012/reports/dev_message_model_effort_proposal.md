# PRJ-012 チャットメッセージへの model/effort 表示機能 - 実装計画

- 案件: PRJ-012 (sumi - Claude Code マルチプロジェクト IDE)
- 担当: 開発部門（/dev、シニアエンジニア）
- 直近版: v1.42.0 (DEC-082 サイドバー session-scoped 化)
- 想定 DEC: **DEC-083**
- 日付: 2026-04-30
- 種別: 実装計画 (調査 + 複数案 + 推奨)。**実装は含まない**。

---

## 0. TL;DR (CEO 用)

- オーナー要望は「**送信した user message に、その瞬間 Claude が実際に使った
  model と effort を貼り付けて、後から見返せる**」こと。「Sumi UI で選んだ → でも
  SDK には届いていなかった」という乖離を防ぐため **「claud から取得」** が肝。
- 現状: `ChatMessage` 型に model/effort field なし、UserMessage は content と attachments のみ。
  SDK は `system(subtype:'init').model` / `assistant.message.model` で **実際に使った
  model を返してくれる** (公式型 `sdk.d.ts:3114` `2173 + BetaMessage.model:953`)。
  effort は **応答に含まれない** (送信側 `Options.effort` でしか確認不可)。
- 推奨: **案 C ハイブリッド (送信時記録 + assistant init 検知 back-fill)**。実装規模 **M (2〜2.5d)**。
  Sumi UI 値を user message に attach (確実) → SDK の `system:init.model` で正値に back-fill
  (claud 取得) → 乖離があれば warning 表示。effort は SDK 応答に出ないので Sumi 側
  記録のみ (限界として明示)。
- 着手判断: GO 推奨。persist schema 加算 1 field (`meta?`)、後方互換は naturally fallback (既存 message は表示なし)。
- 副次効果: monitor (DEC-082 で session-scoped) と user-message 単位の audit trail
  が両立、cost 推定や「どの model でこのコードを書いた？」の振返りが可能になる。

---

## 1. 現状調査

### 1.1 model / effort のハンドリング (現状)

#### picker UI
- `components/chat/ModelPickerDialog.tsx`、`components/chat/EffortPickerDialog.tsx`
  (Cmd-K palette 由来)
- `components/workspace/TrayModelPicker.tsx:38-70`、
  `components/workspace/TrayEffortPicker.tsx`
  → どちらも **session-preferences store** に書き込む (DEC-057, v1.11.0)。

#### 設定値の保存場所
- `lib/stores/session-preferences.ts:59-93` の `SessionPreferences { model: ModelId | null, effort: EffortLevel | null, permissionMode, allowedTools, deniedTools, chromeEnabled }`
- store 構造 (`SessionPreferencesState`)
  - `perSession: Record<sessionId, SessionPreferences>` — session 単位の現行値
  - `perProject: Record<projectId, SessionPreferences>` — project sticky (新 session の seed 源)
- persist key: `sumi:session-preferences` (localStorage、version 4)

#### 送信時に SDK へ流れる経路
- `components/chat/InputArea.tsx:480-528` でユーザー送信ハンドラが
  `useSessionPreferencesStore` から resolve → `perQueryOptions` に詰めて
  `callTauri<void>("send_agent_prompt", { ..., options: perQueryOptions })`。
- `perQueryOptions` の中身は (line 502-514):
  - `model = modelIdToSdkId(resolvedPrefs.model)` (`"claude-opus-4-7[1m]"` → `"claude-opus-4-7"`)
  - `maxThinkingTokens = effortMeta.thinkingTokens` (effort id を thinking tokens に展開)
  - `permissionMode`、`chromeEnabled`
- Rust 側 `src-tauri/src/commands/agent.rs:596-666` `send_agent_prompt` は
  options を **そのまま JSON で sidecar stdin に書き込む** (line 614-660)。
  model / effort 自体には触らない。
- sidecar `sidecar/src/index.ts:561-621` `handlePrompt` で:
  - `resolvedModel = req.options?.model ?? SIDECAR_DEFAULT_MODEL ?? "claude-opus-4-7"` (line 569-570)
  - `resolvedMaxThinkingTokens = req.options?.maxThinkingTokens ?? SIDECAR_DEFAULT_THINKING_TOKENS ?? undefined` (line 571-572)
  - これを SDK `query()` の `Options.model` / `Options.maxThinkingTokens` に注入 (line 612, 626)

#### **send_agent_prompt の payload に model / effort が含まれているか**
- **model**: 含まれる (camelCase `model: "claude-opus-4-7"` 等)。
- **effort**: 直接の `effort` キーは含まれない。代わりに **`maxThinkingTokens` (数値)** で
  間接表現される。effort id (low/medium/high/xhigh/max) は frontend → sidecar の往路で
  ロストする (sidecar は数値しか見えない)。
- これは「`Options.effort` を SDK に送れていない」という別の根本問題でもある (§ 7 参照)。
  SDK 公式型 `sdk.d.ts:1340` には `effort?: EffortLevel` がある。

### 1.2 Claude SDK の応答に含まれる metadata

`sidecar/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` を読んだ:

#### model を含む event 型
1. **`SDKSystemMessage` (subtype:'init')** — `sdk.d.ts:3101-3132`
   - `type: 'system'`、`subtype: 'init'`
   - `model: string` ← **実際に使われる model 名**
   - `permissionMode: PermissionMode`、`session_id: string`、`tools: string[]`、
     `slash_commands: string[]`、`mcp_servers`、`agents`、`skills`、`plugins`、
     `cwd`、`apiKeySource`、`uuid`、`claude_code_version`
   - **prompt 開始直後に 1 回流れる** (sidecar が既に `sdk_session_ready` 抽出に使用、
     `sidecar/src/index.ts:687-700`)
2. **`SDKAssistantMessage`** — `sdk.d.ts:2171-2178`
   - `type: 'assistant'`、`message: BetaMessage`
   - `BetaMessage.model: MessagesAPI.Model` (`@anthropic-ai/sdk/resources/beta/messages/messages.d.ts:953`)
   - **assistant turn ごとに毎回 model が含まれる** (Rust monitor.rs が既に拾っている、
     `src-tauri/src/events/monitor.rs:241-245`)
3. **`SDKResultMessage` (subtype:'success' / 'error_*')** — `sdk.d.ts:2899-2919`、`2878-2895`
   - `usage: NonNullableUsage`、`modelUsage: Record<string, ModelUsage>` 
     ← **複数 model を跨いだ場合の token 内訳が判る**
   - prompt 終了時に 1 回

#### effort を含む event 型
- **無い**。`Options.effort` は **送信側 (request) のみ** の field。
  SDK が応答ストリームで返却することはない (型定義に該当 field なし)。
- **`maxThinkingTokens`** も同様に応答に含まれない。
- 結論: **「claud から effort を取得」は SDK レベルで不可能**。Sumi 側で送信時に
  記録するしかない (案 A 同等)。

#### 既存の抽出箇所 (frontend)
- `hooks/useAllProjectsSidecarListener.ts` — `ev.type === "sdk_session_ready"` の
  branch (line 246-280) は session_id しか拾っていない。**`"system"` event の
  branch 自体が無い** (Grep で確認済)。
- `lib/stores/monitor.ts:50-63` の `MonitorState.model: string` field あり。
  Rust 側 `src-tauri/src/events/monitor.rs:241-245` で `assistant.message.model` を
  読んで `state.model` を更新している。frontend はこれを `monitor:tick` 経由で受信
  (`useClaudeMonitor.ts`)。**= session 単位の "現在の model" は既に取れている**。
- 但し monitor.model は **session 単位 latest** であり、**user message 単位の履歴** ではない。

### 1.3 UserMessage の描画 (現状)

`components/chat/UserMessage.tsx:30-53`:
```tsx
<div className="flex justify-end">
  <Card className="max-w-[75%] bg-primary p-3 text-primary-foreground shadow-sm">
    <p>{message.content}</p>
    {message.attachments && (...)}  // 画像 / 非画像 chip 列
  </Card>
</div>
```
- model / effort を表示する DOM は **無い**。
- 既存のアクション群 (コピー / 編集 / 再送) も **無い**。シンプルな bubble のみ。
- timestamp 表示も無い (DB の `created_at` は持っているが UI 露出なし)。
- `MessageList.tsx` は role で UserMessage / AssistantMessage / ToolUseGroup を切り替えるだけ。

### 1.4 ChatMessage 型と persist schema

`lib/stores/chat.ts:65-75`:
```ts
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  streaming?: boolean;
  attachments?: Attachment[];
  toolUse?: ToolUseEvent;
}
```
- **model / effort field は無い**。

#### 永続化
- `persist({ name: "ccmux-ide-gui:chat-panes", version: 2, ... })` (line 911-912)
- `partialize` (line 925-938): **viewport (pane) のみ persist、`sessionMessages` は揮発**。
- 真の永続化は **DB (Rust SQLite)** 側 — `persistMessageToDb` (line 306-350) が
  `callTauri("append_message", { sessionId, role, content, attachments })`。
- DB schema は `src-tauri/src/commands/history.rs` (要確認だが、本提案の追加 field
  対応で migration が必要)。**model / effort を DB に持たせるなら ALTER TABLE 1 回 必要**。

### 1.5 model 名の表記

`lib/types.ts:179-209`:
- UI ID: `"claude-opus-4-7[1m]"` / `"claude-sonnet-4-6"` / `"claude-haiku-4-5"`
- 短縮 label: `MODEL_CHOICES[*].label`: `"Opus 4.7 (1M)"` / `"Sonnet 4.6"` / `"Haiku 4.5"`
- SDK ID: `modelIdToSdkId()` (line 222-226) で `"[1m]"` を剥がした raw ID。

#### **逆引きヘルパは存在しない**
- SDK 側 `assistant.message.model` で返ってくるのは **raw ID** (`"claude-opus-4-7"` 等)。
  これを UI で `"Opus 4.7"` の短縮表記にする helper は **無い**。
- 加えて Anthropic API は date suffix 付き ID (`"claude-opus-4-7-20251015"` 等) を返す
  ケースもありうる (公式 docs 慣例)。本提案では **prefix match** で吸収する想定:
  - `model.startsWith("claude-opus-4-7")` → "Opus 4.7"
  - `model.startsWith("claude-sonnet-4-6")` → "Sonnet 4.6"
  - 該当しない → raw ID をそのまま表示 (defensive)
- **新規ファイル**: `lib/utils/model-display.ts` (1 関数のみ) を作る方針。

### 1.6 effort の意味と実装

- 公式 SDK 型 `sdk.d.ts:452-460`: `EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max'`。
- **2 つの設定経路**が SDK に存在する:
  1. `Options.effort: EffortLevel` (`sdk.d.ts:1328-1340`) — 推奨される新方式
  2. `Options.maxThinkingTokens: number` (`sdk.d.ts:1341-1349`) — **deprecated**
- **Sumi の現状は (2) のみ**: `InputArea.tsx:507` で
  `perQueryOptions.maxThinkingTokens = effortMeta.thinkingTokens` (1024〜65536) を投げている。
  → SDK は受け取るが **deprecated 経路**。`Options.effort` (文字列) を直接送る方が望ましい。
- **応答側**: §1.2 で見た通り、SDK は応答に effort を含めない (request-only)。
- 表示する値の決定:
  - 「Sumi UI で選んだ EffortLevel」を user message に貼る (それ以外取れない)。
  - 「実際にどう適用されたか」は SDK 応答からは判らない (但し送信値 = 適用値という仮定で
    実用上問題ない、SDK が effort を握り潰す場合は送信前に何らかの error を投げる想定)。

### 1.7 既存類似機能

- `reports/dev-v8-slash-statusbar-pickers.md` — Slash command で StatusBar picker を
  操作する DEC-053 関連の前例 (UI 状態の同期)。**メッセージ単位の表示はカバーしていない**。
- `reports/dev-v10-v35-16-model-effort-live-switch.md` (PM-840) — 「StatusBar 表示と
  実態 sidecar の乖離」を `runningModel` / `runningEffort` で解消した経緯。
  **これは "現在の状態" の話で、"過去メッセージの履歴" は範疇外**。
- 本提案の機能は **過去 message 単位の audit trail** という別軸の機能で、上記 2 件と
  補完関係になる (重複機能ではない)。

---

## 2. 設計案 A / B / C

### 案 A: Sumi UI で送信した値を user message に直接 attach する

#### タイミング
- `InputArea.tsx:329` の `appendMessage(sessionId, { id, role: "user", ... })` で、
  既に `resolvedPrefs` (= 送信時の最終決定値) を計算済 (line 494-498)。
  これを新 field `meta` として一緒に書き込むだけ。

#### 保存場所
- `ChatMessage` 型に `meta?: { model?: ModelId | null, effort?: EffortLevel | null,
   sentAt: number }` を追加。既存メッセージは undefined で fallback。
- DB 永続化: `messages` テーブルに `meta_json TEXT NULL` 列を 1 つ追加 (ALTER TABLE)。
  読み出し時 JSON parse、書き込み時 JSON stringify。新規 message のみ詰める。

#### 描画
- UserMessage の bubble 下部に `<MessageMeta meta={message.meta} />` を追加。
  例: `Opus 4.7 · 高`。旧 message (meta なし) は何も出さない。

#### persist 影響
- `ChatMessage` 型の field 追加 → `migrate` は不要 (optional field)。
- DB は ALTER TABLE で `ADD COLUMN meta_json TEXT`。SQLite なら破壊的変化なし。

#### 失敗時挙動
- meta 自体は frontend が組み立てるだけなので失敗経路がない。
  (resolvedPrefs.model が null なら `meta.model = null` → 表示は "default")。

#### 規模
- **S+ (1日)**。touch ファイル: chat.ts (型 + persist) / InputArea.tsx (1行) /
  UserMessage.tsx (UI) / history.rs + DB migration (新列)。

#### 限界
- 「Sumi UI で選んだ → でも SDK には別 model で渡った」という乖離は **検出できない**。
  オーナー要望「claud から取得」を字義通りには満たさない。

---

### 案 B: SDK の `system:init` event から model を抽出して user message に back-fill

#### タイミング
- sidecar `index.ts:680-725` で既に `system` event を frontend に転送済
  (`sendWithReqId("system", req.id, ev)`)。但し frontend listener
  (`useAllProjectsSidecarListener.ts`) は `"system"` event を **未処理** (Grep で確認)。
- 新 branch を listener に追加: `ev.type === "system"` かつ `ev.payload.subtype === "init"` の
  ときに `payload.model: string` を読み、対応 reqId の **直前 user message** に back-fill する。

#### 保存場所
- 案 A と同じ `ChatMessage.meta`。但し書き込みタイミングが「SDK init event 受領時」になる。
- `meta = { model, effort: null }` (effort は init event に無い)。

#### user message との紐づけ
- 既存の reqId mapping: user message の id は `${id}:u` (`InputArea.tsx:330`)、
  assistant id は `${id}:a` (`useAllProjectsSidecarListener.ts:290`)。
  init event の reqId から該当の `${reqId}:u` message を引いて `meta.model` を patch する。
- 既存型として `chat.ts` に `updateMessageMeta(sessionId, messageId, meta)` 新 action 追加。

#### 描画
- 案 A と同じ。但し init event 到達まで **数百ms 〜 数秒の遅延** あり (cold start 時)。
  back-fill されるまで「— · —」を出すか、何も出さないかは UX 判断 (本提案では
  「meta 未到達 = 何も出さない」を推奨、ちらつき防止)。

#### persist 影響
- 案 A と同じ。但し DB 永続化のタイミングが問題になる:
  - user message は `appendMessage` 時点で **即 DB INSERT** されている (`chat.ts:603-608`)。
  - init event back-fill は **その後** に来る → meta 列を **後から UPDATE** する必要あり。
  - → `update_message_meta(messageId, metaJson)` Tauri command を追加。

#### 失敗時挙動
- SDK が init event を出さずに失敗 / sidecar クラッシュ / network 切断:
  → meta 永遠に空。表示「— · —」または非表示。
- init event の payload 形が変わった (SDK upgrade): 防御的 type guard が必須。

#### effort について
- **取れない**。init event に effort field なし。本案単独だと effort 表示は不可能。

#### 規模
- **M (1.5日)**。touch ファイル: useAllProjectsSidecarListener.ts (新 branch) /
  chat.ts (新 action + DB UPDATE 経路) / history.rs (新 command) /
  UserMessage.tsx (UI) / DB migration (新列)。

#### 利点
- **SDK が実際に使った model 名そのもの**を表示できる。「Sumi UI=Opus 表示、実 = Sonnet」
  みたいな乖離が物理的に起こらない (init event の値が真実)。

---

### 案 C: 案 A + 案 B のハイブリッド (**推奨**)

#### タイミング & 保存
1. **送信時** (案 A): `meta = { uiModel, uiEffort, sentAt }` を attach。**effort はここでしか取れない**。
2. **assistant init 受領時** (案 B): listener が `meta.sdkModel` を patch。
3. もし `uiModel` と `sdkModel` の prefix が **不一致** なら `meta.mismatch = true` を立てる。

#### `ChatMessage.meta` の最終形
```ts
meta?: {
  uiModel: ModelId | null;       // Sumi UI で選んだ値 (案 A、即時)
  uiEffort: EffortLevel | null;  // 同上
  sdkModel?: string;             // SDK init event 由来 (案 B、後から back-fill)
  sentAt: number;                // 送信時刻 (epoch ms)
  mismatch?: boolean;            // uiModel と sdkModel が乖離していたら true
}
```

#### 描画
- **通常時**: `meta.sdkModel` (or `meta.uiModel`) を短縮表示 + `· effort: high`。
- **mismatch 時**: `Sonnet 4.6 (UI: Opus 4.7) · effort: high` + warning icon (`!` triangle)。
  hover tooltip: 「UI で選択した model と実際に Claude が使った model が異なります」。
- **sdkModel 未到達**: `Opus 4.7 (UI 値) · effort: 高` + 控えめな読み込み中マーク。
  init event 到達で warning 消す。
- **過去 message (meta 全部なし)**: 何も表示しない (旧データは defensive に空表示)。

#### persist 影響
- DB に `meta_json TEXT NULL` 1 列追加。`update_message_meta` command 1 つ追加。
- ChatMessage 型に optional field 追加 (migrate 不要)。

#### 失敗時挙動
- init event 来ない → `sdkModel` undefined のまま → UI は `uiModel` だけ表示 (案 A 同等)。
- back-fill UPDATE 失敗 → 次回 hydrate 時に空、UI は uiModel だけ表示 (実害なし)。

#### 規模
- **M (2〜2.5日)**。案 B のフル実装 + 案 A の attach + 比較ロジック + UI バッジ。

#### 利点
- オーナー要望「claud から取得」を **真摯に満たす** (sdkModel は実値)。
- 「Sumi UI 値と実値の乖離」を **検出して可視化** できる (副次的なバグ検知能力)。
- effort も同時に出せる (uiEffort 経由、claud 取得は SDK 仕様上不可なので限界として明記)。

---

## 3. 推奨案と理由

### 推奨: **案 C (ハイブリッド)**

#### 理由
1. **「claud から取得」要望の字義満足**: 案 A だけだと「Sumi 側の選択 UI 状態を
   保存しているだけ」になり、オーナーが懸念する乖離検出ができない。案 C は
   sdkModel を init event から取るため、claud が実際に使った model 名そのものを
   表示できる。
2. **effort のフェイルセーフ**: SDK 仕様上 effort は応答に含まれないので案 B 単独だと
   effort 表示が永遠にできない。案 A の uiEffort attach を併用することで
   「effort も後から確認できる」を実現する (限界は § 7 で明示)。
3. **ChatMessage 型・DB schema を 1 回しか触らない**: 案 A → 後で案 B 追加、という
   段階拡張だと 2 回 schema 変更が必要 (面倒 + risk)。
4. **副次的効果**: 「UI で Opus 選んでるのに sidecar が Sonnet で起動してた」みたいな
   過去のバグ (PM-840 / DEC で扱った乖離) を **メッセージ単位で常時監視** できる安全網になる。
5. **monitor.ts (DEC-082) との責務分離**: monitor は「session 単位の latest スナップショット」、
   ChatMessage.meta は「message 単位の固定履歴」。両立して干渉しない。

#### 採用しない案の理由
- **案 A 単独**: 簡単だが「claud から取得」要望を字義的に満たさない。
  一度 v1.x で出してから案 C に拡張する 2 段階リリースは 2 度手間。
- **案 B 単独**: effort 表示が永遠にできない (= 要望「`effort` も併せて確認したい」を満たさない)。

---

## 4. UI/UX 詳細

### 4.1 表示位置

UserMessage の **bubble 下部、attachments の更に下** に小さい 1 行を追加:

```
┌─────────────────────────────┐
│ ユーザーの送信文章          │
│                             │
│ [画像] [画像]               │  ← attachments
│ ─────                       │  ← 細い区切り線 (opacity 30%)
│ Opus 4.7 · 高 · 14:32       │  ← meta 行 (text-[11px], muted-foreground)
└─────────────────────────────┘
```

- **bubble 内** にする (外側 / hover tooltip より発見性が高い)。
- 既存の `text-primary-foreground` に対して `opacity-70` で控えめに。
- 1 行 11px、`tabular-nums` で時刻を等幅。

### 4.2 表示する情報の粒度

#### 通常時
```
Opus 4.7 · effort: 高
```
- model: 短縮 label (`MODEL_CHOICES[].label` 互換、SDK raw ID は内部のみ)。
- effort: `EFFORT_CHOICES[].label` (低/中/高/超高/最大)。`null` なら「default」または非表示。
- timestamp: 4.3 で詳述。

#### mismatch 時
```
⚠ Sonnet 4.6 (実) · UI: Opus 4.7 · effort: 高
```
- 警告 icon (`exclamation-triangle`、HeroIcons)。
- hover tooltip: 「UI で選択した Opus 4.7 と異なる Sonnet 4.6 で応答されました。
  sidecar 再起動中の可能性があります」

#### sdkModel 未到達 (init event 待ち)
```
Opus 4.7 (UI 値) · effort: 高 · ⏳
```
- spinner icon。10 秒経っても来なければ静かに消す (UI 値表示で確定)。

#### 過去 message (meta なし)
- **何も表示しない**。旧データの defensive fallback。

### 4.3 timestamp の扱い

- 既存 UI に timestamp なし。本提案で **新規導入** するなら meta 行に入れる:
  - 同日: `14:32`
  - 別日: `4/29 14:32`
  - 今年外: `2025/12/31 23:59`
- **代替**: timestamp を出さず model/effort のみにする選択肢もあり。
  CEO 判断で最初は **timestamp 込み**を推奨 (audit trail として価値が高く、
  後で消すのは簡単だが後で足すのは UI 設計やり直しになるため)。

### 4.4 「同じ設定で再送」ボタン

- **今回は実装しない**。スコープ拡大、要望にも含まれない。
- 将来 PRJ-012 で実装する場合に備えて、`message.meta` を読むだけで再現できるよう
  type を残しておく (Phase 2)。

### 4.5 アクセシビリティ

- meta 行は `<div role="note" aria-label="送信設定: Opus 4.7、effort 高、14時32分">`。
- mismatch 時は `aria-live="polite"` で SR に通知。
- 色だけで mismatch を伝えない (icon + text 必須)。
- bubble の background (`bg-primary`) に対して `text-primary-foreground/70` で
  WCAG AA (4.5:1) 確保 (現行の primary-foreground 色をそのまま使えば既に AA)。

---

## 5. 実装ロードマップ (推奨案 C)

### Phase 1 (本 DEC-083 で着手、2〜2.5日)

#### touch ファイル
1. **型 / store**
   - `lib/stores/chat.ts` — `ChatMessage.meta` 追加、`updateMessageMeta(sessionId, messageId, patch)` action 追加。
   - `lib/types.ts` — 必要なら `MessageMeta` 型を export。
2. **ヘルパ (新規)**
   - `lib/utils/model-display.ts` — `formatSdkModelName(rawId): string` (prefix match で短縮 label)、
     `compareModelIds(uiId, sdkId): "match" | "mismatch"`。
3. **送信時 attach (案 A 部分)**
   - `components/chat/InputArea.tsx:329-334` の appendMessage 呼出に `meta: { uiModel, uiEffort, sentAt: Date.now() }` を渡す。
4. **SDK init event 抽出 (案 B 部分)**
   - `hooks/useAllProjectsSidecarListener.ts` に `case ev.type === "system"` 新 branch。
     `ev.payload.subtype === "init"` のとき `meta.sdkModel = payload.model` を `${reqId}:u` に back-fill。
   - mismatch 判定もここで行い `meta.mismatch` を立てる。
5. **DB 永続化**
   - `src-tauri/src/commands/history.rs` — `messages` テーブルに `meta_json TEXT` 列追加 (migration v3 → v4 想定)、
     `append_message` で書き込み、`update_message_meta(message_id, meta_json)` Tauri command 新設、
     `load_session_messages` で読み出して frontend に返す。
6. **UI**
   - `components/chat/UserMessage.tsx` — meta 行レンダ追加。
   - `components/chat/MessageMeta.tsx` (新規、または UserMessage 内 inline component) — 表示ロジック。
7. **テスト**
   - `lib/utils/model-display.test.ts` — formatSdkModelName / compareModelIds の unit。
   - `lib/stores/chat.test.ts` — updateMessageMeta action の挙動 (既存テストが無いなら最小ケース 1 つ)。
   - `tests/e2e/chat.spec.ts` — 送信 → meta 行が現れる E2E (`MessageList` rendering 経路)。

#### persist migration 戦略
- **localStorage 側**: `chat-panes` は messages を持たないので影響なし (DEC-064 以降)。
- **session-preferences 側**: 影響なし (本機能と無関係)。
- **DB 側**: 列追加のみ、既存行は `meta_json IS NULL` で存続。frontend は null fallback で
  meta 行を出さない (1.4 / 4.1 で明記)。
- **過去 message への遡及対応**: しない (meta なしで表示も出ない、defensive に静かに無視)。
  → 「v1.43.0 以降の新規 message のみ meta 表示」と CHANGELOG に明記。

### Phase 2 (将来 / 任意)

- 「同じ設定で再送」ボタン (4.4)
- effort も SDK 応答から取れるようになった場合の back-fill (Anthropic 仕様変更待ち)
- AssistantMessage 側にも同様の meta 表示 (現状は user に貼ることに集中)
- cost 推定 (resultMessage.modelUsage を message-level に attach)

### Phase 3 (将来 / 任意)

- monitor.ts の MonitorState.model と meta の整合検証 dashboard
- 「過去の N 件で何回 mismatch があったか」サマリ画面

---

## 6. 規模感と DEC 番号案

| 項目 | 値 |
|---|---|
| 規模 | **M (2〜2.5日)** |
| Phase 1 着手日数 | 2〜2.5日 (型 0.5d + listener 0.5d + DB 0.5d + UI 0.5d + test 0.5d) |
| 触るファイル数 | 約 7 (frontend 5、rust 1、test 2) |
| persist migration | DB ALTER TABLE 1回 (列追加、後方互換) |
| E2E 影響 | 1 spec 追加 (chat.spec.ts への 1 it 追加) |
| vitest 影響 | 2 ファイル新規 (model-display + chat store) |
| DEC 番号 | **DEC-083** (DEC-082 サイドバー session-scoped 化の次、自然な番号) |
| version | **v1.43.0** (Minor、機能追加) |

---

## 7. 不確実事項

### 7.1 SDK 応答の effort 含有 (検証結果: **含まない**)
- 公式型 `sdk.d.ts` の `SDKSystemMessage` / `SDKAssistantMessage` / `SDKResultMessage`
  全てに `effort` field なし (調査済)。
- 念のため Anthropic の changelog を CEO 着手後に再確認すること。
- → 案 C で「uiEffort attach」の限界として明示。

### 7.2 model 名のフル ID か短縮表記か
- Anthropic API は **date suffix 付き ID** (`"claude-opus-4-7-20251015"`) を返すことがあるとされる。
- prefix match 戦略 (1.5 で詳述) で吸収できる前提。
- 実機で model 名を log し、suffix の挙動を 1 度確認した方が安全。

### 7.3 過去 message (meta 無し) への遡及対応
- **しない方針** (Phase 1 推奨)。後付けで「Sumi 側で選んだ値」も「claud が使った model」も
  確実に取れないため、空表示が誠実。
- もし表示したい場合は session の `default model` (= 当時の perProject) を defensive に
  当てる手があるが、誤情報リスクの方が高い。CEO 判断で stretch。

### 7.4 init event の reqId 紐づけ
- sidecar `index.ts:687-700` で既に `sdkSessionReadyEmitted` guard が「最初の init で
  1 回だけ emit」している。本提案では `system` event 自体は **未 guard で全送信**
  されているので reqId 紐付けは可能 (`sendWithReqId("system", req.id, ev)`)。
- 但し sidecar 全体で 1 prompt あたり init event は **1 回 + α** になる可能性があり、
  「最初に来た init.model だけ採用、後続は ignore」のロジックを listener 側に書く必要あり。

### 7.5 `Options.effort` (deprecated 移行)
- 本提案は **既存の `maxThinkingTokens` 経路を変更しない**。
- 但し公式 SDK は `Options.effort: EffortLevel` (`sdk.d.ts:1340`) を新方式として推奨。
  Sumi が `maxThinkingTokens` を送り続けるか `effort` 文字列に切り替えるかは別チケット
  (PM-761 として既に提起された痕跡あり、`lib/types.ts:760` 周辺コメント)。
- **本機能とは独立**。効率を測りたいなら本機能の延長で捕捉できる。

### 7.6 mismatch 検知の false positive
- prefix match で「`claude-opus-4-7-20251015` vs `claude-opus-4-7`」を mismatch 扱いに
  しないよう、`compareModelIds` は **正規化後** に比較する。
- model id の date suffix 違いだけなら mismatch とせず、family 違い (opus vs sonnet) のみ
  mismatch と判定。

---

## 8. 副次効果

### 8.1 monitor 経由の値より精度の高い audit trail
- monitor.ts (`MonitorState.model`) は session 単位 latest なので、session 内で
  model を切り替えた場合に過去の message が「現 model で送られた」と誤認される。
- 本機能は **message 単位の固定値**なので、後から正確に「この message は Opus、
  次は Sonnet で送った」を再現できる。

### 8.2 cost / usage の message 単位推定への布石
- `SDKResultMessage.modelUsage: Record<string, ModelUsage>` (`sdk.d.ts:2911`) と組み合わせると、
  「prompt N の concrete cost」を概算できる。Phase 3 候補。

### 8.3 ナレッジ蓄積 (オーナー組織の運営観点)
- 「同じ問題に Opus / Sonnet で投げ分けた結果の差分」を後から audit できる。
- Sumi の dogfood 中 (DEC-074 の auto-compact 通知などと同じ系譜) で価値を発揮。

### 8.4 mismatch detection によるバグ早期検知
- 「sidecar 再起動が必要だったのに発火していなかった」「runningModel と
  preference が剥離していた」みたいな PM-840 系統のバグを、ユーザー操作なしに検知できる。

---

## 9. CEO への最終提案

1. **採用案: C (ハイブリッド)** — 「claud から取得」を sdkModel back-fill で字義満足、
   effort は SDK 制約により uiEffort attach で実用満足。乖離検知 (mismatch) という
   副産物まで取れる。
2. **規模: M (2〜2.5日)、DEC-083、v1.43.0**。 触るファイル ~7、DB 列追加 1、後方互換 OK
   (旧 message は静かに非表示)。
3. **着手判断: GO 推奨**。要望は明確で、SDK 仕様の制約 (effort 非応答) は本提案で誠実に
   切り分け済み。Phase 1 で完結し、Phase 2/3 への自然な拡張余地もある。

---

## 付録 A: 主要参照ファイル (絶対パス + 行番号)

| 役割 | ファイル | 該当行 |
|---|---|---|
| ChatMessage 型 | `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/lib/stores/chat.ts` | 65-75 |
| chat.ts persist | 同上 | 911-967 |
| persistMessageToDb | 同上 | 306-350 |
| SessionPreferences 型 | `lib/stores/session-preferences.ts` | 59-93 |
| InputArea 送信 | `components/chat/InputArea.tsx` | 320-528 |
| user message append | 同上 | 329-334 |
| perQueryOptions 構築 | 同上 | 480-514 |
| send_agent_prompt 呼出 | 同上 | 516-528 |
| Rust send_agent_prompt | `src-tauri/src/commands/agent.rs` | 596-666 |
| sidecar handlePrompt | `sidecar/src/index.ts` | 561-733 |
| sidecar system event 転送 | 同上 | 680-725 |
| sidecar init から sdk_session_id 抽出 | 同上 | 687-700 |
| Rust monitor model 抽出 | `src-tauri/src/events/monitor.rs` | 241-245 |
| MonitorState 型 | `lib/stores/monitor.ts` | 50-63 |
| frontend listener (system 未処理) | `hooks/useAllProjectsSidecarListener.ts` | 220-281, 540-557 |
| ModelId 型 + label | `lib/types.ts` | 179-209 |
| modelIdToSdkId | 同上 | 222-226 |
| EffortLevel 型 + EFFORT_CHOICES | 同上 | 742-767 |
| UserMessage UI | `components/chat/UserMessage.tsx` | 30-53 |
| TrayModelPicker | `components/workspace/TrayModelPicker.tsx` | 38-110 |
| SDK SDKSystemMessage 型 | `sidecar/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` | 3101-3132 |
| SDK SDKAssistantMessage 型 | 同上 | 2171-2178 |
| SDK Options.effort | 同上 | 1328-1340 |
| SDK Options.maxThinkingTokens (deprecated) | 同上 | 1341-1349 |
| SDK EffortLevel | 同上 | 452-460 |
| BetaMessage.model | `sidecar/node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts` | 953 |
| 過去 DEC: model/effort live switch | `projects/PRJ-012/reports/dev-v10-v35-16-model-effort-live-switch.md` | 1-50 |
| 過去 DEC-082 | `projects/PRJ-012/decisions.md` | 2920+ |

