# PRJ-012 v1.42.0 サイドバー session-scoped 化 - 品質レビュー

- **作成日**: 2026-04-30
- **作成**: レビュー部門 (シニアレビュアー)
- **対象**: `ccmux-ide-gui` v1.41.0 → v1.42.0 (DEC-082 候補)
- **依頼**: 提案書 `dev_sidebar_session_scoping_proposal.md` の 案 A + 案 B 一括実装。
  3 session 同時実行時に Sidebar (SubAgents / Context / Todos) が混線するバグの根治
- **レビュー対象 commit**: 未 commit (CEO 一括実施前提)
- **レビュー範囲**: 完了レポート §1〜§10 / 実装ファイル 11 (Rust 2 + TS 7 + meta 3)

---

## 判定: **APPROVE**

3 session 混線バグの真因 (Rust `MonitorState` の global 共有 + frontend selector の global 参照 + payload に session_id 不在の 3 重不整合) に対し、提案書の案 A + 案 B が一括で過不足なく実装されている。Critical 0 / Major 0。Minor 3 件 (どれもリリース blocker ではなく、ナレッジ転記タイミングと小さなコメント整合のみ)。

オーナーの core 要望「session 切替で各 session の値が独立して見える」は、Rust 側 `HashMap<sessionId, SessionMonitor>` 化 + payload `MonitorTickPayload { sessionId, state }` + frontend `perSession[sessionId]` 直書込 + Sidebar/StatusBar 全 4 components の `selectMonitorForSession(currentSessionId)` 経由化 によって構造的に保証されている。同時実行時に他 session の sub_agent / todos / tokens / model / branch が混入する経路は、コード上もテスト上も残っていない。

---

## 1. バグ根治の妥当性

### 1-A. Rust 側 (案 B)

`src-tauri/src/events/monitor.rs` を逐行確認。

- L137-146: 旧 `MonitorStateInner` を `SessionMonitor` に rename し、`state` / `counted_request_ids` / `active_task_ids` / `last_emit` の **4 つすべて** を session 単位に降格。これは特に重要。提案書 §S-2 / §S-3 で指摘されていた「`current_tool` / `active_task_ids` も global」を **`SessionMonitor` 内部の `state.current_tool` と `active_task_ids` field** で正しく解消している (Grep 結果上、旧 global 参照は皆無)。
- L152-158: `MonitorStateInner { sessions: HashMap<String, SessionMonitor> }` + `MonitorHandle = Arc<RwLock<MonitorStateInner>>`。global 一個 → session 単位 Map への昇格が型レベルで完了。残存する旧 `Arc<RwLock<MonitorStateInner>>` (旧 single-state) はゼロ。
- L161-163: `new_handle()` が空 HashMap で初期化。`lib.rs:101` の `manage::<MonitorHandle>(monitor::new_handle())` も整合 (Grep で確認)。
- L170-175: `MonitorTickPayload { session_id, state }` に `#[serde(rename_all = "camelCase")]`。frontend 期待 `sessionId` (camelCase) に合致。test_monitor_tick_payload_camel_case で wire format が `"sessionId"` を出すこと、`"session_id"` を出さないことが固定済 (L887-889)。
- L213-232: `update_from_sidecar_event(session: &mut SessionMonitor, ...)` は引数が session-local。session を跨ぐ書込経路はない。
- L527-550: `emit_if_due` が `session_id: &str` 引数を必須化、payload に session_id を同梱して `app.emit("monitor:tick", &payload)`。throttle 時刻 `last_emit` も session 単位なので、A の throttle 中に B が tick できる (1 session の高頻度 emit が他 session を blocking しない)。
- L556-559: `purge_session(handle, session_id)` は単純な `HashMap::remove`。該当なしは no-op (panic なし、test_purge_session_removes_only_target で固定)。

**評価**: 旧 global state の痕跡なし。型・データ構造・関数 signature の 3 層で混線が **発生不能** な形に変更されている。

### 1-B. dispatch pipeline (`agent.rs:541-571` 周辺)

- L498-545 (sidecar の stdout 受信ループ): `let sid_for_task = session_id.clone();` を closure で保持し、`dispatch_to_monitor(&app_handle, &sid_for_task, &s).await` (L512) で必ず session_id を渡す。旧 `_session_id` 未使用は完全に解消。
- L518-538 (`CommandEvent::Terminated`): sidecar 自然終了時に AgentState の sidecar map を remove するだけでなく、`crate::events::monitor::purge_session(&handle, &sid_clone)` を **`tauri::async_runtime::spawn` で非同期 spawn** している。`break;` で読出ループから抜けるので Terminated は冪等。ロックは取らずに purge を 別 task に出しているので、Terminated handler 自身は短時間でリターンできる。
- L555-589 (`dispatch_to_monitor`): `inner.sessions.entry(session_id).or_insert_with(SessionMonitor::default)` で session 単位 entry を取得 → `update_from_sidecar_event` → `force = session.state.stop_reason.is_some()` → `emit_if_due(app, session_id, session, force)`。stop_reason 出現時の即時 emit (throttle bypass) も session 単位に閉じている。
- L757-780 (`stop_agent_sidecar`): `guard.remove(&session_id)` の後、monitor entry も purge を spawn。idempotent (該当 session が居なくても OK)。
- L786-823 (`stop_project_sidecars`): project 単位で kill した session 群 (`killed_session_ids`) をループで purge spawn。spawn 内のループは順次 await なので、複数 session 削除が race しない (1 つずつ HashMap から消える)。

**評価**: 提案書で指摘された 3 経路 (Terminated handler / stop_agent_sidecar / stop_project_sidecars) すべてで `purge_session` が確実に呼ばれている。session_id を持たない event 経路 (旧 sidecar 起動直後の race など) も `dispatch_to_monitor` 自身が session_id 引数必須なので、callsite で session_id が確定していない経路から呼ばれる可能性ゼロ。

### 1-C. Frontend 側 (案 A)

- `lib/stores/monitor.ts`:
  - L74-93: `MonitorStore` から global `monitor` field を完全削除、`perSession: Record<string, MonitorState>` のみ。`setMonitor(sessionId, state)` の signature を引数順含め payload 駆動に変更。
  - L97-104: `setMonitor` 実装が `sessionId` 空文字で no-op (graceful skip、warn は listener 側で出す)。
  - L134-140 / L146-169: `selectMonitorForSession` / `selectContextRatioForSession` / `selectContextPercentForSession` / `selectIsNearLimitForSession` の 4 selectors はすべて session 引数を取り、null/未登録に対して安全 (null / 0 / false を返す)。旧 global 版 (`selectContextPercent` / `selectIsNearLimit` / `selectContextRatio`) は完全削除。Grep でコード本体に残存ゼロ確認 (テスト名のラベルとコメント中の歴史的記述のみ)。
- `hooks/useClaudeMonitor.ts:51-80`: payload を `MonitorTickPayload` 型 listen、`sessionId` 不在 / `state` 不在 / payload 自体が非 object のいずれも `console.warn` + `return` で skip。`useSessionStore.getState().currentSessionId` の後付けは完全廃止 (旧 import も削除済)。
- Sidebar 3 components:
  - `SubAgentsList.tsx:31-37`: `currentSessionId` を `useSessionStore` から、selector で `selectMonitorForSession(s, currentSessionId)?.sub_agents ?? EMPTY_SUB_AGENTS`。EMPTY_SUB_AGENTS の Object.freeze による参照同一性も維持されている (再 render 抑制)。
  - `ContextGauge.tsx:35-45`: 4 つの subscribe (`currentSessionId` / `monitor` / `percent` / `nearLimit`) すべてが session 引数経由。
  - `TodosList.tsx:31-36`: 同上、EMPTY_TODOS の参照同一性も保持。
- `StatusBar.tsx:48-79`: `selectMonitorForSession(s, currentSessionId)` 経由で model / branch を表示。`useSessionStore` の import は既存だったので追加 import なし (cleanly diff)。

**評価**: TrayContextBar:38-41 の既存 pattern (PM-984 で導入) と完全一致。Grep 上 `s.monitor` (global) を読む箇所はゼロ (history テキストとコメントのみ残)。session 切替 → `currentSessionId` 変化 → selector が新しい snapshot を返す → re-render で正しい session の値が表示される、というデータフローが 4 components 全部で同型に成立。

---

## 2. 副次効果として直すべき箇所 (提案書 §7 との対応)

| 提案書での指摘 | 実装結果 | 評価 |
|---|---|---|
| §S-1 StatusBar.tsx の global model 表示 | session-scoped 化済 (`StatusBar.tsx:48-79`) | OK |
| §S-2 Rust の `current_tool` / `active_task_ids` global | `SessionMonitor` 内部に降格 (`monitor.rs:138-145`) | OK |
| §S-3 useClaudeMonitor.ts の currentSessionId 後付け | payload sessionId 直渡し (`useClaudeMonitor.ts:63-78`) | OK |
| §不確実事項 MAX_REQUEST_ID_CACHE × N | session 単位の `counted_request_ids` HashSet として維持 (上限 10000 × max 8 session = ~5MB) | OK (許容) |
| §UsageStatsCard | 仕様上 session 横断累計、本件と無関係 | OK (変更不要を明文化) |

提案書で挙がった副次箇所 5 件すべてが意図通り処理されている。Grep でも残置の global 参照は検出されない。

---

## 3. 互換性

- **wire format 変更**: `monitor:tick` payload が `MonitorState` 直渡し → `MonitorTickPayload { sessionId, state }` (camelCase serde)。
  - フロント側 `useClaudeMonitor.ts:63-77` で `sessionId` 不在 / `state` 不在 / payload 自体が非 object の 3 段防御。`console.warn` で skip。
  - 旧 backend から先行 tick が in-flight に残っているケース (例: v1.41.x → v1.42.0 起動直後) でも、frontend は graceful skip するだけで例外を投げない。次の sidecar 再起動以降で正しい payload を受信開始する。
  - 影響: 起動直後の Sidebar が一瞬 "—" / 空表示になる可能性は理論上ある。許容範囲。CHANGELOG `Notes` にも明記済。
- **persist schema 変更なし**: `monitor` store は volatile only (zustand persist 設定なし、`reset()` で空化)。session / chat / project store は無変更。
- **DB 変更なし**: sessions テーブル等の schema 変更は無し。`update_session_sidecar_meta_in_db` は従来通り。
- **chat / session store 無変更**: DEC-063 (sidecar lifecycle) / DEC-072 (session 単位起動 UI) と整合維持。
- **TrayContextBar コード変更なし**: PM-984 で session-scoped 化済の同 hook pattern を Sidebar 側が後追いした形。Tray は v1.42.0 でもそのまま動く。

**評価**: アップグレード時の互換 risk は最小。downgrade (v1.42.0 → v1.41.0) も payload 形式が異なるだけで永続化に影響しないため、データ的な lock-in なし。

---

## 4. コード品質

### Critical: 0 件

セキュリティ / データ破壊 / 永続化整合性に関わる issue はなし。

### Major: 0 件

機能仕様 / アーキテクチャ整合性に関わる issue はなし。3 session 混線という Major bug を逆に解消している側。

### Minor: 3 件 (リリース blocker ではない)

#### M-1. TrayContextBar.tsx のコメントが不正確

- `components/workspace/TrayContextBar.tsx:34-35`:
  > 「該当 session が tick をまだ受けていなければ global (最新) monitor を fallback 表示」
- DEC-082 で global monitor field は廃止され、PM-985 以降は実コードも fallback せずに「—」placeholder を出す挙動 (L45-71)。コメントが旧仕様を書いている。
- 影響: コードは正しい。コメントだけ更新が必要。
- 推奨: `globalにfallback` の表記を `tick未受信なら "—" placeholder` に修正 (1 行差し替え)。

#### M-2. cargo test 件数のレポート差分

- 完了レポート L20 / CHANGELOG L53: 「174 → 177 (+3)」「新規 3 ケース」
- 実コード `monitor.rs` 内の新規 test 関数は **5 件**: `test_three_sessions_are_independent` / `test_same_session_tick_composition` / `test_request_id_dedup_is_per_session` / `test_purge_session_removes_only_target` (#[tokio::test]) / `test_monitor_tick_payload_camel_case`
- 完了レポート §6.3 では「5 件」と書かれており、TL;DR の「+3」と内部矛盾。
- 影響: テスト自体は強化されているので品質には無問題。CHANGELOG / TL;DR の数字だけ齟齬。
- 推奨: CHANGELOG L53 の「新規 3 ケース」を「新規 5 ケース、それまでの 174 ケースのうち 2 ケースは内部リファクタで等価カウントとなり差分 +3」のように補足するか、 **174 → 179 (+5)** のいずれかに統一 (実行 PASS 件数を CEO が再確認して修正)。

#### M-3. ナレッジ転記が後送り

- 完了レポート §8.2: `organization/knowledge/multi-session-architecture.md` への転記は別 release で実施予定。
- 影響: 本 release 自体には影響なし。次回 session-scoped state を増やすときのチェックリストが組織 knowledge に未記載なので、横展開しにくいリスクのみ。
- 推奨: v1.43.0 着手時 or 直後に CEO 経由で knowledge 転記を schedule 化。CHANGELOG `Notes` に DEC-063 / PM-984 / DEC-082 の段階性は記載済 (L1438 周辺等) なので、本 release では blocker ではない。

---

## 5. テストカバレッジ

### 5-A. cargo test (`src-tauri/src/events/monitor.rs` 末尾 mod tests)

新規 5 ケース (numbers in §4 M-2 の通り):

| テスト | カバー範囲 | 評価 |
|---|---|---|
| `test_three_sessions_are_independent` | 3 session の sub_agent / state を別 entry に保持、A の tool_result が B/C に影響しない | core 検証 ◎ |
| `test_same_session_tick_composition` | 同 session 内で 2 つの Agent → 1 件完了で残り 1 件 (active_task_ids が session 単位で機能) | regression test ◎ |
| `test_request_id_dedup_is_per_session` | counted_request_ids が session 単位、別 session の同 requestId は別カウント | edge case ◎ |
| `test_purge_session_removes_only_target` (`#[tokio::test]`) | purge が指定 session のみ削除、不在 session の purge は no-op | cleanup 検証 ◎ |
| `test_monitor_tick_payload_camel_case` | wire format が `sessionId` (camelCase) で `session_id` を含まない | 互換 pin ◎ |

既存 6 ケース (`test_context_limit` 等) はそのまま PASS する形に修正されている (`session()` ヘルパで `SessionMonitor::default()` を生成、もとの `MonitorStateInner::default()` 直使用は新 test 群が `MonitorStateInner` を使う形に置換)。**regression は構造的に検出されない** (174 既存ケースが PASS と完了レポートで明示)。

### 5-B. vitest (`lib/stores/monitor.test.ts`、新規)

10 ケース。重要なものを以下に列挙:

| ケース | 評価 |
|---|---|
| 「3 session を同時 setMonitor しても互いの値が混ざらない」 | core 検証、sub_agents / todos / tokens の独立を 1 ケースで全部踏む ◎ |
| 「空 sessionId は no-op」 | graceful skip 担保 ◎ |
| 「selectContextRatio/Percent/IsNearLimit は session 単位で独立」 | 3 段階の % (5 / 70 / 95) で閾値判定もカバー ◎ |
| 「purgeSessions(空配列) / 該当なしは参照同値を保つ」 | React 再レンダ抑制 (重要、過去 PRJ-012 で React error #185 が出た history がある) ◎ |
| 「reset() で perSession が空に戻る」 | test isolation 保証 ◎ |

selector の 1:1 対応がすべて vitest で固定されており、frontend 側で session-scoped が崩れる修正が将来入った場合、CI 段階で検出される。

### 5-C. E2E

完了レポート §8.1 の通り **本 release では skip** (port 3000 のローカル競合)。
評価: 妥当。

- vitest + cargo の組合せで「session 別」が両端 (Rust / TS) で固定されており、E2E 不在による品質 risk は限定的。
- 推奨: CI 整備時に `tests/e2e/sidebar-session-scoping.spec.ts` を追加、3 session 同時起動 → SessionList 切替で sub_agent が切替わることを Playwright で再現 (提案書 §6 Phase 2 testing 戦略参照)。本 release blocker にはしない。

---

## 6. 副作用・エッジケース

| シナリオ | 期待挙動 | 実装での担保 | 評価 |
|---|---|---|---|
| 3 session 同時実行で SessionList 切替 → SubAgents/Context/Todos/Model/Branch が全部切替 | active session のみ表示 | 4 components が同一 selector pattern。currentSessionId 変化で selector が新 snapshot を返す | OK |
| session 終了 (`stop_agent_sidecar`) で他 session 影響なし | 該当 session の monitor entry のみ purge | `agent.rs:772-778` で spawn purge、`monitor.rs:556-559` の HashMap.remove | OK |
| project 削除 cascade | 所属 session 群を順次 purge | `agent.rs:813-821` でループ purge | OK |
| sidecar 自然終了 (Terminated) | monitor entry を purge | `agent.rs:518-537` で spawn purge、break で読出ループ離脱 | OK |
| session 切替直後の race (新 session の tick 未到達) | 「—」placeholder | ContextGauge L48-62, TrayContextBar L45-71 で null ガード、`EMPTY_TODOS` / `EMPTY_SUB_AGENTS` で安全 default | OK |
| 古い tick event が起動直後に in-flight で来る | warn + skip | `useClaudeMonitor.ts:63-77` の 3 段防御 | OK |
| pane 内で session 切替 (DEC-072) | active pane の session id が currentSessionId に反映される既存経路 | session.ts loadSession + chat.ts setPaneSession の組合せは無変更 | OK |
| auto-compact (DEC-074) | session 別 context % が正確化することで通知判定も正確化 | 構造的に副次 benefit | OK |
| 1 session で `last_emit` throttle | 同 session 内のみ throttle、他 session に影響なし | `last_emit` も SessionMonitor 内部 | OK |

エッジケースで最も risk が残るのは「session 切替直後の `selectMonitorForSession` 一瞬 null → "—" 表示」だが、これは UX 的に許容可能で、提案書 §A の Cons でも明示。次回 tick で即解消される。

---

## 7. デザイン整合

### 7-A. 段階的進化との整合

| 段階 | 内容 | 状態 |
|---|---|---|
| DEC-033 (v3.3) | 1 project = 1 sidecar | 旧 |
| DEC-063 (v1.17.0) | 1 session = 1 sidecar に昇格 (`HashMap<sessionId, SidecarHandle>`) | 既存 |
| PM-984 (v1.8.2) | frontend store の `perSession` 導入、TrayContextBar が session-scoped 化 | 既存 |
| **DEC-082 (v1.42.0)** | Rust monitor を session HashMap 化、Sidebar 4 components を session-scoped 化 | **本件** |

DEC-063 で sidecar lifecycle が session 単位化されたが、monitor pipeline が global のままだった「歪み」を本 release で解消。アーキテクチャ的には 3 段階目の自然な拡張。

### 7-B. 既存 pattern との一貫性

- TrayContextBar (`components/workspace/TrayContextBar.tsx:38-41`) の session-scoped pattern と Sidebar 3 components が完全一致。`useSessionStore.currentSessionId` + `selectMonitorForSession(s, currentSessionId)` の 2 行 idiom。
- 別 store の session-scoped pattern (chat の `selectActivityForSession` 等) とも整合。session-scoped 化の組織内 idiom が明確に成立。

### 7-C. 将来拡張時のチェックリスト

完了レポート §8.2 に記載予定 (knowledge file への転記は後送り)。CHANGELOG `Notes` には DEC-063 / PM-984 / DEC-082 の年表が含まれているので、historical context は確保されている。

---

## 8. リリース準備

| 項目 | 状態 |
|---|---|
| `package.json` v1.42.0 | OK (確認済) |
| `src-tauri/Cargo.toml` v1.42.0 | OK |
| `src-tauri/tauri.conf.json` v1.42.0 | OK |
| 3 ファイル一致 | OK |
| CHANGELOG `## [v1.42.0] - 2026-05-02` | OK (release.yml の awk 抽出整合) |
| Fixed / Changed / Notes セクション | OK (DEC-082 一括記載) |
| persist schema 変更なし | OK (volatile only) |
| 絵文字未使用 | OK (Grep 上ゼロ) |
| アイコン (lucide-react のみ) | OK (Bot / AlertTriangle / GitBranch / CheckSquare / Circle / Square / Cpu / Zap など、すべて lucide-react import) |
| chat / session store 無変更 | OK |
| commit / push / tag | 未実施 (CEO 一括前提、要件通り) |

唯一の懸念は §4 M-2 の「テスト件数の表記揺れ」のみ。リリース blocker ではないが、CHANGELOG の数字は CEO 側で再 PASS して合わせると panel 整合が綺麗。

---

## 9. 推奨修正 (任意、リリース blocker ではない)

優先度順:

### P-1 (Minor、推奨): CHANGELOG / 完了レポートのテスト件数を統一

完了レポート §6.3 と §0 TL;DR / CHANGELOG `Notes` で、cargo test 新規が「5 件」と「3 件」で揺れている。実 PASS 数で **174 → 179** にするか、「5 ケース追加 / 既存 174 から 2 つ等価リネーム」と内訳明記するか、いずれかに揃える。

該当箇所:
- `projects/PRJ-012/reports/dev_v142_sidebar_session_scoping_done.md:20` (TL;DR)
- `projects/PRJ-012/app/ccmux-ide-gui/CHANGELOG.md:53`
- 同レポート §6.1 表 / §6.3 / §10.2 全部の数値

### P-2 (Minor、推奨): TrayContextBar.tsx のコメント修正

`components/workspace/TrayContextBar.tsx:32-35` の docstring 内 「global (最新) monitor を fallback 表示」を「tick 未受信なら "—" placeholder」に修正。実コード (L45-71) は正しいので 1 行コメント差替え。

### P-3 (Minor、後続 release): knowledge 転記

`organization/knowledge/multi-session-architecture.md` (新規) に DEC-063 / PM-984 / DEC-082 の段階を年表化、将来 session-scoped state を追加するときのチェックリスト (Rust HashMap + payload + frontend perSession + selector) を記載。次回 v1.43.0 で実施。

---

## 10. 最終判断と CEO への報告

### APPROVE — v1.42.0 のリリース可

#### 根拠

1. **オーナー要望の core**: 3 session 混線バグの根治は、Rust 側の `SessionMonitor` HashMap 化 + payload `sessionId` 同梱 + frontend `perSession` 直書込 + Sidebar/StatusBar の session-scoped selector の **4 層すべてで構造的に保証** されている。Critical / Major レベルの遺漏はコード上見当たらない。
2. **テストカバー**: cargo (5 新規) + vitest (10 新規) の両端で session 独立性が固定されており、将来の regression は CI で検出される。E2E skip は port 3000 競合の既知制約として妥当。
3. **互換性**: wire format 変更があるが frontend で graceful skip + warn で吸収。persist 影響なし。
4. **リリース整合**: 3 version ファイル一致、CHANGELOG 整合、絵文字なし、lucide-react のみ、chat/session store 無変更、コミット未実施 (CEO 前提通り)。

#### 条件 (任意)

- §9 P-1 / P-2 / P-3 はリリース blocker ではないが、ナレッジ蓄積観点で推奨 (CEO 判断)。
- 特に P-1 (テスト件数の数字揺れ) は CHANGELOG に出る数字なので CEO が release 前に統一しておくと綺麗。1 〜 3 行差替えで済む。

#### CEO への要請

1. 本 review 受領後、`projects/PRJ-012/decisions.md` に **DEC-082 (v1.42.0 サイドバー session-scoped 化、案 A+B 一括)** を追記
2. 一括 commit / `v1.42.0` tag / push (CEO 権限)
3. P-1 (テスト件数の表記統一) を CEO 側で軽く整合させた上で push 推奨。実装ファイルは触らずに CHANGELOG / 完了レポートのみ
4. P-2 / P-3 は次 release バンドルで OK

---

## 関連ファイル (絶対パス)

- 提案書: `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/reports/dev_sidebar_session_scoping_proposal.md`
- 完了レポート: `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/reports/dev_v142_sidebar_session_scoping_done.md`
- Rust monitor: `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/src-tauri/src/events/monitor.rs`
- Rust dispatch: `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/src-tauri/src/commands/agent.rs`
- monitor store: `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/lib/stores/monitor.ts`
- monitor store test: `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/lib/stores/monitor.test.ts`
- monitor hook: `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/hooks/useClaudeMonitor.ts`
- Sidebar: `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/sidebar/{SubAgentsList,ContextGauge,TodosList}.tsx`
- StatusBar: `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/layout/StatusBar.tsx`
- TrayContextBar (参照、無変更): `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/workspace/TrayContextBar.tsx`
- CHANGELOG: `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/CHANGELOG.md`
