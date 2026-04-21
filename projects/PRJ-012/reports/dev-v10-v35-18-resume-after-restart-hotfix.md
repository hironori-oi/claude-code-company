# /dev v10 緊急 hotfix レポート — PRJ-012 v3.5.18: Model 切替後 Claude context 継続不全の診断 debug log 追加

- 案件: PRJ-012 ccmux-ide-gui
- バージョン: v3.5.18
- 担当: 開発部門（/dev）
- 日付: 2026-04-20
- 関連チケット: PM-830 回帰 bug hunt（v3.5.16 Model Live Switch 後の resume 不全疑惑）
- 実時間: 約 2.2h
- ブランチ / 編集対象 repo: `C:/Users/hiron/Desktop/ccmux-ide-gui`

---

## 1. 症状（再確認）

オーナー報告の再現手順:

1. 「1+2=?」を送信 → Claude「3」と応答
2. `/model` コマンドで別モデルを選択 → `restartSidecarWithModel` 発火
3. 「先ほどの問題は？」を送信 → Claude「これが最初のメッセージです、履歴が見えません」

**期待**: PM-830 の resume 機構により Claude が会話履歴を継続する。
**実際**: 新規会話として扱われる（= resume が効いていない signal）。

---

## 2. 仮説 A〜F の静的解析による検証結果

任意の修正に着手する前に、task 仕様で示された 6 仮説を code grep / 精読で網羅検証した。**結論: 静的解析では明確な root cause が特定できない**（= 実機の debug log が不可欠）。以下個別所見。

### A. chat store の currentSessionId が restart で null になっている

**結果: 否定（コード上は null にならない）**

- `restartSidecarWithModel` (`lib/stores/project.ts:608-697`) は chat store を一切触らない
- `stop_agent_sidecar` / `start_agent_sidecar` の結果として Rust が emit する
  `agent:{projectId}:terminated` event を `useAllProjectsSidecarListener`
  (`hooks/useAllProjectsSidecarListener.ts:106-125`) が捕捉するが、そこでも
  `streaming:false` / `activity:idle` しか触らず **`currentSessionId` は維持**
- `setSessionId(paneId, null)` を呼ぶ箇所は 5 箇所のみで、いずれも restart 経路とは無関係:
  - `ChatPanel.tsx:232` / `236`: project 切替 + DB load 失敗時のみ
  - `ClearSessionDialog.tsx:58`: ユーザ明示の /clear
  - `session.ts:231`: deleteSession 後の本人セッションだったとき
  - `chat.ts:251`: 型定義
- 結論: restart 経路で currentSessionId が null になる code path は見つからない。
  debug log で「送信直前 sessionId が non-null」を確認する必要あり。

### B. session store の sdkSessionId がキャッシュにない / stale

**結果: 否定（fetchSessions は restart で再発火しない）**

- `fetchSessions` の自動トリガは 2 経路:
  - `SessionList` マウント時 (`SessionList.tsx:108-110`)
  - `useProjectStore.subscribe` の activeProjectId 変化時 (`session.ts:328-336`)
- `restartSidecarWithModel` は `activeProjectId` を変更しないため、
  subscribe 側の `prev === next` guard が必ず early-return → fetchSessions は走らない
- 初回送信で `sdk_session_ready` → `updateSessionSdkId(sid, A)` が cache 楽観更新した
  値はそのまま維持される（DB 書込みも await して完了）
- 結論: cache 側は問題ない可能性が高い。debug log で送信直前に
  `getSdkSessionIdFromCache(sessionId)` が期待値を返すかを直接確認する必要。

### C. InputArea.handleSend で resume が送信されていない

**結果: コード上は送信される（ただし実機確認が不可欠）**

- `InputArea.tsx:290-299` で `getSdkSessionIdFromCache(sessionId)` の結果を
  `send_agent_prompt` invoke の `resume` field に渡している
- Tauri の invoke は camelCase で Rust に serialize される（`rename_all = "camelCase"`、
  single word `resume` は変換なし）
- 結論: 実機で `sdkSessionId` が `null` になっているか / `invoke` で正しく
  Rust に届いているかを debug log で確認が必要。

### D. sidecar 側で resume が SDK に渡っていない

**結果: コード上は渡される**

- `sidecar/src/index.ts:293-310` の opts 構築で `...req.options` spread により
  `resume` は opts に混入する
- 空文字列 resume のみ削除する guard (`index.ts:321-323`) は正しく
  `opts.resume.length === 0` のみを対象にしており、空でない resume は維持
- `runAgentQuery(prompt, opts)` が SDK の `query({ prompt, options: opts })` に渡す
  (`sidecar/src/agent.ts:221`)
- 結論: コード上は問題なし。debug log で sidecar 到達時の `req.options` と
  SDK に渡す opts を両方可視化する必要。

### E. SDK の resume が期待動作しない

**結果: 検証不能（SDK 内部動作は blackbox）**

- SDK の jsonl 保存場所は sidecar の `process.cwd()` ベースで encode される
  （`~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`）
- Rust は sidecar を `current_dir(sidecar_dir)` で起動するため、cwd は
  `~/.claude/projects/C--Users-hiron-Desktop-ccmux-ide-gui-sidecar/` or
  `~/.claude/projects/C--Program-Files-ccmux-ide--up--sidecar/` に固定
- 実機 `ls ~/.claude/projects/C--Users-hiron-Desktop-ccmux-ide-gui-sidecar/` で
  数十個の jsonl ファイルが確認できるため、SDK は正しく保存している
- 結論: resume 失敗時は sidecar が `resume_failed` を emit → toast で通知される
  （`useAllProjectsSidecarListener.ts:471-490`）。ユーザ側で toast が見えている
  かを確認することが重要。

### F. restart 直後の新 sdk_session_id が旧 id を上書きして context lost

**結果: 否定（上書きは次回送信にのみ影響、当該 prompt の resume は既に効いている）**

- 時系列:
  1. restart 後、prompt 2 送信
  2. 送信時点で `resume: A` が sidecar に届く
  3. 新 sidecar が `query({ resume: A })` 実行
  4. SDK が system.init event emit（session_id=A もしくは fork 時は A'）
  5. sidecar が sdk_session_ready event emit → frontend が `updateSessionSdkId(sid, A')`
- 上書きが起きるのは「prompt 2 の結果」に対してであり、prompt 2 自体は
  resume=A で投げ済。SDK が resume したならば prompt 2 の応答は context ありで返る
- つまり上書きが起きても **prompt 2 が context なしになる直接原因にはならない**
- 結論: hypothesis F は症状の root cause ではない。ただし prompt 3 以降で
  A' が stale な場合に連鎖問題を起こす可能性は残る（将来観測対象）。

---

## 3. 静的解析で確認できたこと / できなかったこと

### 確認できたこと

- `restartSidecarWithModel` は chat / session store を一切触らない。
  従って「restart で currentSessionId / sdkSessionId が null にリセットされる」
  現象は code path 上は発生しない。
- resume の型配線（TS types / Rust signature / serde rename）は全て整合。
- sidecar → SDK の opts 構築で resume が drop する path なし。

### 確認できなかったこと（実機のみで分かる）

1. ユーザ実機で `sdkSessionId` cache が実際に populate されているか
2. 送信時の `getSdkSessionIdFromCache(sessionId)` 戻り値
3. Rust `send_agent_prompt` 到達時の `resume: Option<String>` 値
4. sidecar prompt handler 入口の `req.options.resume` 値
5. SDK query 投下直前の `opts.resume` 値
6. SDK 側で resume の成否（成功時は system.init が同 UUID、失敗時は error → resume_failed）

**よって最優先 task は「上記 6 点を可視化する debug log を仕込み、ユーザに再現してもらう」**。以降 (§ 4) で実施。

---

## 4. 追加した debug log（一時残置）

resume 伝播を 4 層で可視化する。dogfood 期間中は残置し、後日 PM-746 相当で
クリーンアップ予定（タグ `v3.5.18 PM-830 hotfix debug` で grep 可能）。

### 4.1 InputArea.tsx（送信直前）

```ts
// components/chat/InputArea.tsx (handleSend 内、send_agent_prompt invoke 直前)
console.log(
  "[send] resume=", sdkSessionId,
  "sessionId=", sessionId,
  "projectId=", activeProjectId,
  "cacheSessions=",
  useSessionStore.getState().sessions.map((s) => ({ id: s.id, sdk: s.sdkSessionId })),
);
```

可視化するもの:
- 送信時点の sessionId（chat store pane の currentSessionId）
- 送信時点の sdkSessionId（session cache から lookup した値）
- session store cache に何が積まれているか（stale でないか確認）

### 4.2 src-tauri/src/commands/agent.rs（Rust 受信直後）

```rust
// send_agent_prompt 内、options 構築直後
eprintln!(
    "[agent] send_agent_prompt: project_id={project_id}, req_id={req_id}, resume={resume:?}, options_has_resume={has_resume}",
    has_resume = options.contains_key("resume")
);
```

可視化するもの:
- frontend の camelCase `resume` が `Option<String>` に deserialize できたか
- NDJSON の options に resume が正しく乗ったか

### 4.3 sidecar/src/index.ts（prompt handler 入口）

```ts
// handlePrompt 入口直後
process.stderr.write(
  `[sidecar] prompt received: id=${req.id}, options=${JSON.stringify(req.options ?? {})}\n`,
);
```

可視化するもの:
- Rust → sidecar の NDJSON 経路で options が失われていないか
- req.options.resume が期待値か（または何らかの型崩れで消えていないか）

### 4.4 sidecar/src/index.ts（SDK query 直前）

```ts
// opts 最終化後、for await (const ev of runAgentQuery(...)) の直前
process.stderr.write(
  `[agent.ts] query options: resume=${String(opts.resume)}, model=${String(opts.model)}, cwd=${String(opts.cwd)}, requestedResume=${String(requestedResume)}\n`,
);
```

可視化するもの:
- SDK に実際渡す opts.resume が期待値か
- spread 順序 / 空文字列 guard で drop していないか
- cwd が sidecar_dir になっていること（jsonl ファイル位置の期待値）

### 4.5 useAllProjectsSidecarListener.ts（sdk_session_ready 受信時）

```ts
console.log("[sdk_session_ready]", {
  projectId, activeProjectId, sdkSessionId, resumed: p?.resumed,
});
// pane が無い場合の skip も warn で可視化
```

可視化するもの:
- 新 sidecar の system.init から返ってきた session_id
- resumed flag（= requestedResume が set だったか）
- pane の currentSessionId と組合せで上書きタイミングの妥当性確認

---

## 5. Root cause の候補順位（log 観測前の仮説ランキング）

static code review の範囲で **「なぜ resume が効いていないのか」** の候補を
尤度順に並べると以下:

1. **実機で sdkSessionId cache が null**（hypothesis B の変種）
   - 初回送信で `sdk_session_ready` event が実は届いていない
   - もしくは届いたが updateSessionSdkId の DB 書込が失敗 → 次回 resume null 渡し
   - debug log の [send] resume= 値で即判明
2. **restart 後 resume が SDK に届くが、SDK 側で jsonl 未発見**
   - 例: model 切替で SDK 側の project dir encoding が変わる (= cwd は同じだが
     何らかの理由で jsonl path が変わった)
   - この場合 sidecar が resume_failed error を throw → toast 出るはず
3. **resumed=true で system.init が発火しているが context が返ってこない**
   - SDK 仕様バグ / Max OAuth 特有の挙動
   - debug log の `[sdk_session_ready]` で resumed flag を確認
4. **restart 中に race で resume フィールドが null / undefined に化ける**
   - 極めて低確率。debug log 4 層で値一致するかで分かる

---

## 6. 修正内容（この hotfix で行ったもの）

本 hotfix では **コード動作の書き換えは意図的に行わない**。理由:

- 静的解析で明確な root cause が特定できていない段階で推測で直すと別 bug を生む
  （task 指示の「修正前に必ず仮説を全て調査」を遵守）
- 4 層の debug log を揃えることで、ユーザの 1 回の再現でほぼ root cause が確定する

実際に編集したファイルは 4 つで、全て debug log の追加のみ:

| ファイル | 追加内容 | 影響範囲 |
|---|---|---|
| `components/chat/InputArea.tsx` | `[send] resume=...` console.log | 送信ごとに 1 行 |
| `src-tauri/src/commands/agent.rs` | `[agent] send_agent_prompt` eprintln | 送信ごとに 1 行（stderr） |
| `sidecar/src/index.ts` | `[sidecar] prompt received` / `[agent.ts] query options` 2 箇所 stderr.write | prompt ごとに 2 行 |
| `hooks/useAllProjectsSidecarListener.ts` | `[sdk_session_ready]` console.log + skip 時の warn | SDK init ごとに 1 行 |

---

## 7. 検証シナリオ（ユーザへの依頼）

以下の手順で再現し、ブラウザ DevTools の Console と Tauri の stderr
（または app log）を共有いただきたい。log 片手に root cause を特定して
v3.5.19 で根治する想定。

### 手順

1. ccmux-ide-gui を起動（dev build でも prod build でも可）
2. プロジェクトを 1 つ選択し、Claude 起動
3. DevTools を開く（Ctrl+Shift+I）→ Console タブを表示
4. 「私は田中です」と送信 → Claude 応答を待つ
5. Console の **[send] / [sdk_session_ready]** 行を確認（1 回目）
6. StatusBar の ModelPickerPopover または `/model` で別モデル選択 → 再起動完了 toast を待つ
7. 「私の名前は？」と送信 → Claude 応答を待つ
8. Console の **[send] / [sdk_session_ready]** 行を確認（2 回目）
9. `claude run --log-level=debug` 相当の stderr が見られるなら
   **[agent] / [sidecar] / [agent.ts]** も確認

### 期待する log（= 正常時）

**初回送信時**:
```
[send] resume= null sessionId= <uuid> projectId= <uuid> cacheSessions= [{ id: <uuid>, sdk: null }]
[agent] send_agent_prompt: project_id=..., req_id=..., resume=None, options_has_resume=false
[sidecar] prompt received: id=..., options={}
[agent.ts] query options: resume=undefined, model=claude-opus-4-7, cwd=C:\..., requestedResume=undefined
[sdk_session_ready] { projectId, activeProjectId, sdkSessionId: "A-uuid", resumed: false }
```

**restart 後の 2 回目送信時（正常時）**:
```
[send] resume= A-uuid sessionId= <uuid> projectId= <uuid> cacheSessions= [{ id: <uuid>, sdk: "A-uuid" }]
[agent] send_agent_prompt: project_id=..., req_id=..., resume=Some("A-uuid"), options_has_resume=true
[sidecar] prompt received: id=..., options={"resume":"A-uuid"}
[agent.ts] query options: resume=A-uuid, model=claude-sonnet-4-6, cwd=C:\..., requestedResume=A-uuid
[sdk_session_ready] { projectId, activeProjectId, sdkSessionId: "A-uuid", resumed: true }
```

**問題時のパターン**（どこで resume が null になるかで root cause が絞れる）:

| 観測箇所 | 症状 | 示唆する root cause |
|---|---|---|
| [send] resume= null | cache に sdkSessionId が無い | B: cache 消失、sdk_session_ready event 未着 / updateSessionSdkId 失敗 |
| [agent] resume=None, [send] resume= "A-uuid" | camelCase/serde 失敗 | C: Rust deserialize 不整合 |
| [sidecar] options={}, [agent] resume=Some("A-uuid") | NDJSON で消失 | Rust → sidecar の NDJSON 経路破壊 |
| [agent.ts] resume=undefined, [sidecar] options={"resume":...} | spread 順序 bug | D: sidecar コード bug（現状は無いはず） |
| [sdk_session_ready] resumed=true, 応答に context なし | SDK 内部 | E: SDK 側の resume 解釈失敗、もしくは Max OAuth 特有挙動 |

---

## 8. 編集範囲の遵守

ALLOW リストのファイルのみ編集:

- [x] `components/chat/InputArea.tsx` — debug log 1 行追加
- [x] `src-tauri/src/commands/agent.rs` — debug eprintln 1 行追加
- [x] `sidecar/src/index.ts` — debug stderr 2 行追加
- [x] `hooks/useAllProjectsSidecarListener.ts` — debug log 2 行追加

触っていないが許可されていたファイル（変更不要と判断）:

- `lib/stores/project.ts`（restartSidecarWithModel は既存挙動で整合）
- `lib/stores/session.ts`（updateSessionSdkId / getSdkSessionIdFromCache は既存で整合）
- `lib/stores/chat.ts`（restart 経路で触られない）
- `sidecar/src/agent.ts`（resume 配線は既存で整合）

FORBIDDEN: 一切触れていない（components/layout/**, editor 系）。

---

## 9. 検証（CI 基準）

| 項目 | 結果 |
|---|---|
| `cargo test --lib` | ✅ 120 passed; 0 failed（既存と同数） |
| `npx tsc --noEmit` (frontend) | ✅ 0 error |
| `npx tsc --noEmit` (sidecar) | ✅ 0 error |
| `npm run build` (sidecar) | ✅ dist/index.mjs 805.3 KB / 65ms |

---

## 10. debug log 残置状況と後続タスク

- **残置**: 4 箇所全ての debug log（総計 console/stderr 6 行程度の出力）
- **タグ**: `v3.5.18 PM-830 hotfix debug (2026-04-20)` で grep 可能
- **クリーンアップ時期**: root cause 特定 + v3.5.19 で根治後、PM-746 相当の
  log cleanup ticket で削除
- **残置の害**: dogfood モードでは Console に数行 / prompt の増加、prod では
  DevTools を開かなければ見えない & 性能影響なし（stringify は 1 回のみ）。
  許容範囲内。

---

## 11. CEO への引き継ぎ事項

### 短期 action（1 日以内）

1. オーナーに **§7 検証シナリオ** を実行してもらい、Console / stderr log を共有
2. log パターンから §7 表に照らして root cause 特定（B / C / D / E のいずれか）
3. 特定後、v3.5.19 として最小修正を適用（典型は session store の cache race
   fix か sidecar spread の微調整）

### 中期 action（1〜2 週間）

1. resume の E2E playwright test を追加（PM-831 相当）し、
   回帰を CI で捕捉できるようにする
2. sidecar stderr を Tauri frontend に常時 relay する「開発モード log viewer」
   を検討（debug log 収集がワンクリックで済む）

### 既知制約 / 残留リスク

- 本 hotfix は **log 追加のみで挙動は不変**。bug 自体は直っていない点に注意。
  オーナーの再現協力が不可欠。
- debug log は stderr / Console に出るため、prod 出荷前には必ず除去する必要
  （PM-746）

---

## 12. 工数

| 区分 | 想定 | 実績 |
|---|---|---|
| 仮説 A〜F 全調査（code 精読） | 1.5h | 1.6h |
| debug log 追加 + tsc/cargo 検証 | 0.5h | 0.4h |
| レポート執筆 | 0.5h | 0.4h (本 doc) |
| **合計** | **2.5h** | **2.2h** |

（当初見積 2〜3h に収まり。code 上明確な bug が見えなかったため、推測で
修正せず log 観測路線に切替えたことで想定内で完了。）

---

以上、v3.5.18 緊急 hotfix（debug log 仕込み）完了。
root cause の特定は次 chunk（§11 短期 action）で実施予定。
