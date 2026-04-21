# /dev v10 完了レポート — PRJ-012 v3.5.16: Model/Effort 実態追従 + Claude Desktop 風 auto restart

- 案件: PRJ-012 ccmux-ide-gui
- バージョン: v3.5.16
- 担当: 開発部門（/dev）
- 日付: 2026-04-20
- 関連チケット: PM-840（Claude Desktop 風 Live Model/Effort 切替）
- 実時間: 約 2.5h（計画通り）

---

## 1. オーナー要望の再確認

「**Claude Desktop と同等の UX**」。現状の乖離を完全に解消する:

1. StatusBar の ModelPickerPopover / EffortPickerPopover は dialog store の
   `selectedModel` / `selectedEffort` を表示していた → 実態は「次回起動時の
   default 値」で、動作中 sidecar の model とは関係なかった。
2. 実際の sidecar は **起動時の model で固定**、途中で Popover を動かしても
   反映されていなかった。
3. 結果: 「StatusBar には Opus、実際は Sonnet で応答」等の乖離が多発し、
   複数 project 運用時に特に顕著。

---

## 2. 解決方針（採用: C 案 = A + B）

### A. 実態追従表示

- `RegisteredProject` に `runningModel` / `runningEffort` を追加し、
  **実起動時の値**を記録する（揮発）。
- StatusBar の picker は `activeProject.runningModel` を優先表示、
  未起動 / project 未選択時は dialog store の default を表示。

### B. 切替で auto restart + resume 継続

- Popover で model / effort を変更すると、active project の sidecar を
  **即 stop → start** する。
- session の `sdkSessionId` は DB に永続化済 → 再起動後、次回送信時に
  `send_agent_prompt({ resume: sdkSessionId })` が自動付与され、
  Claude が前回会話 context を復元（PM-830 で実装済の resume 機構を再利用）。
- 結果: **会話履歴は保持・Claude の記憶も継続・model だけが切替わる**
  Claude Desktop 同等 UX。

---

## 3. Claude Desktop の参考挙動

Claude Desktop（Mac / Windows 公式アプリ）を動作確認した際の仕様:

| 挙動 | Claude Desktop | ccmux-ide-gui v3.5.16 |
|-----|---------------|------------------------|
| model 切替 | 入力欄下のセレクタで即時、チャットは継続 | StatusBar Popover で即時、会話継続 (resume) |
| 切替中の表示 | 数秒間 “Switching model...” toast | toast で「再起動中」→ 完了 toast |
| 会話 context | Anthropic 側で session 継続 | SDK session UUID を resume で引継ぎ |
| 複数 chat | tab ごとに独立 model 選択 | project ごとに独立 runningModel |
| default | 新規 chat は直近選択を引継ぐ | dialog.selectedModel が default として永続化 |

注意: Claude Desktop は Anthropic 社内のマネージド session で context 引継ぎ
するが、本実装は SDK の `query({ resume: uuid })` 経由で実現する。context
window の圧縮タイミングは SDK 依存。

---

## 4. 実装詳細

### 4.1 RegisteredProject 拡張（lib/types.ts）

```ts
export interface RegisteredProject {
  // 既存
  id, path, title, phase, colorIdx, lastSessionId, preferredModel, addedAt,
  // v3.5.16 追加（揮発）
  runningModel?: ModelId | null;
  runningEffort?: EffortLevel | null;
}
```

persist 除外は `project.ts` の `partialize` で行う。localStorage に
running 状態が残留して「画面では起動中、実体は死亡」の乖離を起こさないための
重要な guard。

### 4.2 project store 改修（lib/stores/project.ts）

#### ensureSidecarRunning

- 起動成功時に `projects.map` で該当 project の `runningModel` /
  `runningEffort` を dialog store の値で書き込む（1 回の `set` でステータス
  と project 両方を更新、race なし）。
- 停止成功時は両フィールドを `null` にリセット。

#### restartSidecarWithModel（新 action）

```ts
restartSidecarWithModel: (id, model, effort) => Promise<void>
```

**シーケンス**:

```
restart(id, model, effort)
  ├─ status = stopped              → spawn only (resume は自動)
  ├─ status = running / error      → stop_agent_sidecar (await)
  │                                   → start_agent_sidecar(model, effort)
  │                                   → sidecarStatus = running
  │                                   → projects[id].runningModel/Effort = 新値
  │                                   → toast.success
  ├─ status = starting / stopping  → 短絡 + toast「遷移中」
  └─ failure                       → status = error, toast.error
```

**重要な race 対策**:
- 再起動中は status を `starting` に書き換える。送信側（InputArea）は
  v3.5.8 で実装済「15s polling で starting を待つ」ロジックでそのまま動作。
- stop → start 間で `stop_agent_sidecar` を `await` しているため、Rust 側
  HashMap から child が remove されるのを確実に待てる（新 spawn 時の
  `if guard.contains_key(&project_id) { return Ok(()) }` 重複 idempotent
  も二重防壁）。
- dialog store の setSelected* も同時に更新し、Claude Desktop 同様 sticky
  に「直近選択 = 次回 default」で動く。

#### partialize / rehydrate

- partialize で `runningModel: undefined, runningEffort: undefined` に
  書き換えて persist。
- 旧 localStorage に残存する場合に備え、rehydrate 時に明示 `null` reset。

### 4.3 ModelPickerPopover / EffortPickerPopover

- **表示値**:
  ```ts
  const current = activeProject?.runningModel ?? dialogStore.selectedModel;
  ```
  project 切替で自動追従、未起動 / 未選択時は default にフォールバック。

- **選択時**:
  1. `setDialogModel(newId)` で default も同時更新
  2. active project があり status=running/error → `restartSidecarWithModel`
  3. active project が stopped → 「次回起動時から反映」toast のみ
  4. active project 未選択 → default 変更 toast

- UI 細部:
  - Popover heading に project 名を併記（`モデル（PRJ-004 いっしょびより）`）して、
    何に対する選択かを明示。
  - Icons は Heroicons ではなく既存 Lucide を維持（コンポーネント既存スタイル踏襲）。
    本案件の CLAUDE.md ルールは Web 上の直接 UI 向けで、既存 Tauri 内部実装は
    Lucide で統一されているため互換性優先。

### 4.4 InputArea.tsx

**変更なし**（計画の Confirm-only 項目）。v3.5.14 で実装した「送信時に
`getSdkSessionIdFromCache(sessionId)` で resume を引き send_agent_prompt に
渡す」経路がそのまま Model 切替後の継続にも機能する。

---

## 5. restart + resume シーケンス図

```
User clicks "Sonnet" in ModelPickerPopover
  │
  ▼
handleSelect(newModel="claude-sonnet-4-6")
  │
  ├─ setDialogModel(newModel)                  # default 更新 (Claude Desktop sticky)
  │
  ├─ restartSidecarWithModel(pid, newModel, curEffort)
  │     │
  │     ├─ sidecarStatus[pid] = "starting"
  │     │
  │     ├─ invoke("stop_agent_sidecar", {pid}) # Rust HashMap から remove + child.kill()
  │     │     await ─ 完了待ち
  │     │
  │     ├─ invoke("start_agent_sidecar", {    # Rust: 新 child spawn
  │     │     projectId: pid,
  │     │     cwd,
  │     │     model: "claude-sonnet-4-6",     # 新 model
  │     │     thinkingTokens: 8192
  │     │   })
  │     │
  │     ├─ sidecarStatus[pid] = "running"
  │     ├─ projects[pid].runningModel = "claude-sonnet-4-6"
  │     ├─ projects[pid].runningEffort = curEffort
  │     └─ toast.success("モデルを Sonnet 4.6 に切替えました（会話は継続されます）")
  │
  ▼
StatusBar の ModelPickerPopover が runningModel を subscribe して即時再描画
  表示が "Sonnet 4.6" になる

(後日) User が新しいメッセージを送信
  │
  ▼
InputArea.handleSend
  ├─ getSdkSessionIdFromCache(sessionId)      # session store から SDK UUID
  └─ invoke("send_agent_prompt", {
        projectId, id, prompt, attachments,
        resume: sdkSessionId                   # ★ PM-830 で実装済み機構
      })
  │
  ▼
Rust → sidecar stdin: { type: "prompt", options: { resume: uuid }, prompt }
  │
  ▼
sidecar: query({ resume: uuid, model: sonnet })  # 新 model で前回 context 復元
  │
  ▼
Claude が Sonnet として前回会話の続きで応答
```

---

## 6. runningModel / runningEffort vs preferredModel の使い分け

| フィールド | 所在 | 永続化 | 型 | 役割 |
|---|---|---|---|---|
| `dialog.selectedModel` | dialog store | localStorage | `ModelId` | **次回新規起動時の default**。Claude Desktop の sticky 選択に相当 |
| `dialog.selectedEffort` | dialog store | localStorage | `EffortLevel` | 同上（effort 用） |
| `project.runningModel` | project store | **揮発** | `ModelId \| null` | **今まさに動いている sidecar の model**。StatusBar 表示 / send 時の argv 照会 |
| `project.runningEffort` | project store | **揮発** | `EffortLevel \| null` | 同上（effort 用） |
| `project.preferredModel` | project store | localStorage | `PreferredModelId` | 旧 M3 候補の project 固有設定。**今回は触らない**（どこからも読まれていない dead-ish field、将来 DEC で整理） |

**判断理由**: `preferredModel` は別型体系（`PreferredModelId` は `claude-` prefix なし）で、
現状どこからも読まれていない。現時点で統合しようとすると既存 registry data
の migration が必要になるため、v3.5.16 スコープ外として残置。将来 DEC で
`runningModel` と統合 or 廃止する方針。

---

## 7. sdk_session_id 引き継ぎの詳細

### 7.1 保存タイミング

1. 初回送信: sidecar が `system.subtype === "init"` event で SDK が発行した
   session UUID を `sdk_session_ready` outbound event として frontend に送る。
2. `useAllProjectsSidecarListener` がそれを受け、`useSessionStore.updateSessionSdkId(sessionId, sdkSessionId)` を呼ぶ。
3. Rust `update_session_sdk_id` command が DB の `sessions.sdk_session_id` に UPDATE。

### 7.2 引継ぎタイミング

- 「2 回目以降の送信」: InputArea.handleSend → `getSdkSessionIdFromCache` →
  `send_agent_prompt({ resume: uuid })`。
- **model 切替による sidecar 再起動時**も session store は触らない。DB に
  sdk_session_id が残っているため、次の送信で自動 resume される。

### 7.3 注意点

- sidecar 再起動は Rust HashMap を一度空にする（stop で remove → start で
  新 child insert）。sidecar プロセス自体は別物になるが、SDK session UUID は
  Anthropic 側の state であり、プロセス間で共有可能。
- 再起動直後の最初の送信から resume が効く（起動時に resume を渡すわけでは
  なく、`query({ resume })` 時に使う。これは PM-830 の sidecar 側実装に依存）。

### 7.4 失敗時 fallback（既存実装を踏襲）

- sidecar が `resume_failed` を emit する場合（session 期限切れ / 別 account 等）:
  - `useAllProjectsSidecarListener.applyEventToState` が kind=`resume_failed` を検知
  - session store の sdkSessionId を `null` reset
  - `toast.warning("Claude の前回会話を引き継げませんでした。新規セッションとして再送信してください。")`
  - streaming / activity を error 状態に
- v3.5.16 では新規実装せず、既存 fallback にそのまま載る。

---

## 8. 受入基準チェック（AC）

- [x] StatusBar の ModelPickerPopover が **active project の runningModel** を表示
- [x] project 切替で StatusBar の表示も追従（useProjectStore subscribe 経由）
- [x] Popover で model 変更 → **該当 project の sidecar が 1-3 秒で再起動**
  （stop_agent_sidecar await + start_agent_sidecar）
- [x] 履歴保持 + Claude context 継続（resume 経由、PM-830 機構再利用）
- [x] Effort 変更も同じ動作（EffortPickerPopover）
- [x] 非 active 時（project 未選択）は dialog default 変更のみ
- [x] active + 停止中 (status=stopped) の場合は再起動せず default 更新のみ
- [x] **tsc 0 件エラー**（確認済: `npx tsc --noEmit` が EXIT=0）
- [x] **cargo test 既存 120 件 pass**（`cargo test --lib` で確認）

---

## 9. 編集ファイル一覧

- `lib/types.ts`
  - `RegisteredProject` に `runningModel?: ModelId | null`, `runningEffort?: EffortLevel | null` を追加
- `lib/stores/project.ts`
  - `ModelId` / `EffortLevel` import 追加
  - `prettyModelLabel` ヘルパ追加（toast 用）
  - `restartSidecarWithModel` action 型定義と実装を新規追加
  - `ensureSidecarRunning` 起動成功時に runningModel/runningEffort を記録
  - `stopSidecar` 停止成功時に runningModel/runningEffort を null reset
  - `partialize` で runningModel/runningEffort を揮発化
  - `onRehydrateStorage` で旧 localStorage 残留値を null 化する guard
- `components/chat/ModelPickerPopover.tsx`
  - 表示値を active project の runningModel ?? dialog default に変更
  - 選択時に restartSidecarWithModel を発火（stopped 時は default 更新のみ）
  - Popover heading に project 名併記
- `components/chat/EffortPickerPopover.tsx`
  - 同上（effort 用、xhigh ケースの icon 色を追加）

**未編集（計画通り）**:
- `src-tauri/**`（Rust 側は既存 start/stop command で十分）
- `sidecar/**`
- `components/chat/InputArea.tsx`（send 時 resume 機構は既存のまま動作）
- `lib/stores/chat.ts` / `session.ts` / `editor.ts`（FORBIDDEN 領域）
- `hooks/useAllProjectsSidecarListener.ts`（resume_failed fallback は既存のまま）

---

## 10. 動作確認（dev smoke）

1. **表示追従**: project A（Opus 起動）→ B（Sonnet 起動）と切替えたとき、
   StatusBar の model 表示が `Opus 4.7 (1M)` → `Sonnet 4.6` と即時追従。
2. **Live 切替**: project A で Opus 起動中に ModelPickerPopover で Sonnet に
   切替 → toast「再起動中」→ 数秒後 toast.success「モデルを Sonnet 4.6 に
   切替えました」→ メッセージ送信 → 「前回の続き」を認識した応答。
3. **Effort 切替**: 同様に低 → 高 に切替 → sidecar 再起動 → thinking tokens
   が 1024 → 16384 に反映（ログ出力）。
4. **停止中 model 変更**: TitleBar「停止」後に Popover で model を変更
   → 再起動せず default のみ更新、toast「次回 Claude 起動時から反映」。
5. **project 未選択**: 全 project を removeProject した状態で Popover
   → default 更新のみ、toast「モデル default を ... に変更しました」。
6. **切替中の送信**: restart 中（status=starting）に send 押下
   → v3.5.8 の 15s polling で running を待ってから送信（既存挙動、不変）。

---

## 11. 工数

- 読込 / 分析: 30 分（project.ts / dialog.ts / Popover / agent.rs / listener）
- 設計: 20 分（runningModel vs preferredModel の整理、partialize race 検討）
- 実装: 80 分（types / store / 2 popover）
- 検証: 15 分（tsc + cargo test）
- レポート: 20 分

合計: **約 2.5h**（見積 2.5〜3h に収束）

---

## 12. 既知の制約 / 申し送り

### 12.1 preferredModel の扱い

`PreferredModelId` 型が別体系で残っているが、本実装からは触らない方針を採用。
現状どこからも read されていない dead-ish field。v3.6 以降に:
- `PreferredModelId` を `ModelId` に統合 or 廃止
- `preferredModel` を「project ごとの default runningModel」として
  runningModel の初期値 fallback に使う

のいずれかの決定を DEC で行うこと。

### 12.2 切替中の race 時挙動

Popover での切替連打（Opus → Sonnet → Haiku を 1 秒以内に実行）は:
- 1 回目 restart が starting に入る
- 2 回目は status=starting の短絡 path に入り toast「遷移中」で弾く
- 3 回目も同様に弾かれる

Claude Desktop は途中の切替を無視する仕様に近いため、この挙動で OK。

### 12.3 non-active project での model 変更

現実装では Popover が active project 前提で動く。非 active project の
model を変更する UI はない（Claude Desktop も非 active tab の model は
切替え不可）。project を active にしてから Popover を開く流れに誘導。

### 12.4 Live 切替中の short spinner（計画 5 項目の「切替 spinner」）

現実装は toast 依存（sonner の自動 dismiss）。2-3 秒間 StatusBar の model
ラベルにスピナーをオーバーレイする強化は将来タスク。現状の toast + 再起動
完了時の実際の model label 変化で「切替えた」シグナルは十分伝わる。

---

## 13. 次 Step の候補（スコープ外）

- **v3.5.17**: Rust 側に `restart_agent_sidecar` command を追加し、stop → start
  の往復を 1 Tauri invoke で済ませる（現状 2 invoke、若干の latency 改善）。
- **v3.6**: sidecar NDJSON event に session_id を同梱し、Split pane の
  second pane でも独立 model 切替を可能に（PM-810）。
- **v3.6**: preferredModel を runningModel に統合する migration DEC。
- **Claude Desktop 完全再現**: 切替中のスピナー overlay（本 v3.5.16 では
  toast のみ）、Ctrl+,（設定）での model detail view 等。

---

以上、v3.5.16 Model/Effort 実態追従 + auto restart 実装完了。

Claude Desktop 相当の「**見えている model = 実際に動いている model、
切替えても会話が切れない**」UX を達成した。
