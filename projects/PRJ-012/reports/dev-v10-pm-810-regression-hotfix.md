# PRJ-012 v3.6 Step 1 — PM-810 Split Pane Regression Hotfix レポート

- **日付**: 2026-04-20
- **担当**: dev (build-error-resolver 役割で調査 → 最小 diff hotfix)
- **対象**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **対象バージョン**: v3.6 Step 1 (PM-810 直後) → Step 1 hotfix
- **工数実績**: 調査 1.5h + 修正 30m + 検証 + レポート = ~2.5h
- **ステータス**: **hotfix 適用済、オーナー実機再現待ち** (sidecar 変更無し → 再 build 不要、frontend HMR or アプリ再読込のみで反映)

---

## 0. TL;DR

オーナー報告「画面分割がうまく機能していません」の **最有力仮説は E (pane state 混乱) 系の regression**。PM-810 の sidecar / listener 追加そのものは整合していたが、**`ChatPanel.tsx` の `prevActiveProjectIdRef` が初期値 `null` のまま初回 effect に突入する既存構造**が、addPane で新 pane を増やした瞬間の新 pane 側初回 mount で `prev=null, next=activeProjectId` → `prev !== next` を通過 → `restoreProjectSnapshot(activeProjectId)` が走って **作ったばかりの 2 pane を 1 pane にリセット (snapshot 無ければ空 main / あれば古い snapshot で上書き)** してしまう regression を発見した。PM-810 実装前は DEFAULT_PANE_ID 固定で dispatch していたため「pane 状態が破壊されても split の独立 routing 機能自体が無かった」ため顕在化が遅れていたが、PM-810 で「split pane 別の sidecar 応答 routing」を初めて本番テストすると同時に表面化した形。

修正は 1 ファイル / `initialMountRef` guard 1 個追加のみ。並行して pane routing 可視化 (console log 3 種) も入れたため、もしまだ別要因の regression があれば grep で即検出できる。

- `cd C:\Users\hiron\Desktop\ccmux-ide-gui && npx tsc --noEmit` **exit 0**
- `cd C:\Users\hiron\Desktop\ccmux-ide-gui\sidecar && npx tsc --noEmit` **exit 0** (sidecar 無変更)
- sidecar rebuild 不要 (本 hotfix は frontend のみ)
- Rust 無変更 (tauri rebuild 不要)

---

## 1. 調査プロセス (症状候補 A–E と検証結果)

### Step 1: PM-810 実装の整合性確認

| 確認項目 | 結果 |
|---|---|
| `sidecar/src/index.ts` の `sendWithReqId` helper | 実装 OK (line 220-230)、payload 合成ロジック正しい |
| 全 send 箇所が `sendWithReqId` 経由か | OK。`grep "send\\(\\{"` は line 229 (helper 内部) / 518 (parse error, reqId="parse") / 548 (ready, reqId="ready") の 3 箇所のみ残存、これは意図通り |
| listener `claimNextSendForPane` / `resolvePaneForEvent` / `releaseReqIdIfTerminal` | 実装 OK。payload.requestId を primary、ev.id を fallback、`ready` / `parse` は early return で FIFO 非汚染 |
| InputArea が `claimNextSendForPane` を send 直前で呼ぶ | OK (line 343、session 作成 + sidecar running 確認 **後** に呼ぶ、途中 return でも FIFO 汚染されないタイミング) |
| Rust `send_agent_prompt` が Mutex 越しに req_id 生成 + stdin 書込 | OK。複数 pane 並列送信でも Rust Mutex でシリアライズされ、claim FIFO 順序と一致する前提が成立 |

PM-810 の実装単体では **bug らしい bug が見つからない**。仮説 C/D (routing 誤配信) 単独なら debug log 追加で再現確認の方針。

### Step 2: 症状候補ごとの静的解析 ranking

| 候補 | 内容 | 最初の所感 | 最終判定 |
|---|---|---|---|
| A | 分割ボタンで 2 番目 pane が追加されない | PM-810 非関与、regression 低 | **該当 (partial)** — 本レポートの core fix 対象 |
| B | 2 番目 pane が追加されるが入力できない | paneId prop が main 固定疑い | 否定。InputArea.paneId prop は Shell の paneItems でペイン固有 id が流れている |
| C | 2 番目 pane で送信しても応答なし | claim/resolve ミス疑い | 否定。静的解析では claim → resolve → release が正しく閉じる |
| D | 2 番目 pane 送信 → 1 番目 pane に応答流入 | resolvePaneForEvent 逆引き失敗疑い | 否定 (再現レベル)。`ev.payload.requestId` が lift されているため map lookup は正しく動く前提 |
| **E** | **pane 切替 / 追加で messages 混乱** | projectSnapshots 管理ミス疑い | **該当 (真因)** — `ChatPanel.tsx` の initial mount で `restoreProjectSnapshot` 誤爆が起こる |

### Step 3: 真因の特定 — ChatPanel.tsx initial mount regression

#### 問題の具体シーケンス

**前提**: `Shell.tsx` の `<motion.main key={activeProjectId}>` により、project 切替で ChatPanel は完全 remount される。addPane による新 pane 追加でも、新 pane の `ChatPanel` は初回 mount。

**症状 (分割ボタン押下直後)**:

1. ユーザーが 1 pane 状態 (panes = { main }) で分割ボタンを押す
2. `addPane()` → `panes = { main, pane-X }`, `activePaneId = pane-X`
3. SplitView が 2 ChatPanel を render、新 `ChatPanel(paneId=pane-X)` が **初回 mount**
4. 新 ChatPanel の useEffect が走る: `prevActiveProjectIdRef.current = null` (初期値), `activeProjectId = "proj-A"`
5. `prev=null, next="proj-A"` → **`prev !== next` 判定を通過**
6. `isActiveRef.current = true` (新 pane が active) → 通過
7. `(async)` 内で:
   - `if (prev)` 条件で prev=null なので writeBack / save はスキップ
   - `restoreProjectSnapshot("proj-A")` が実行される
     - snapshot A が残っていれば → **panes を snapshot A (古い 1 pane 状態) で上書き** → 新 pane-X 消失、messages も古い値に戻る
     - snapshot A が無ければ → **panes = { main: 空 pane }, activePaneId = "main"** にリセット → 新 pane-X 消失 + main の messages も消える
8. → オーナーの体感: 「分割ボタンを押したら 2 pane にならない / 消える / messages が消える / 入力できない」

**PM-810 実装前にこれが表面化しなかった理由**: 旧 listener は DEFAULT_PANE_ID 固定で dispatch していたので、**そもそも split 2 pane の独立 routing 機能自体が無く**、「分割しても別 pane で送信する動機が無い」状態だった。PM-810 で「分割 → 各 pane で送受信独立」機能が初めて使える状態になった瞬間、ユーザーが実際に分割操作を試み、この既存バグが顕在化した。

#### project 切替時も同じ mount が走るのでは?

はい、走ります。`<motion.main key={activeProjectId}>` により project 切替で ChatPanel は remount され、初回 useEffect で `prev=null, next="proj-B"` で進入する。ただし project 切替時の snapshot swap を「初回 mount スキップ」で飛ばすと、切替先 project の snapshot 復元は発生しない。この点の影響評価:

- **切替先 project の snapshot**: AnimatePresence の exit アニメ中に prev ChatPanel が unmount → 本来は prev 側で `saveProjectSnapshot(prev)` を orchestrate してから新 ChatPanel が mount する流れだが、**現行設計はそもそも unmount 側の orchestrate を持っていない** (useEffect cleanup には書かれていない)。つまり **切替時の save はそもそも cleanup に入れないと不整合があった** 既知の既存制限。
- **切替先 lastSessionId から DB load**: 別の `mountLoadRanRef` 経路 (ChatPanel.tsx line 262-275) が `activePane のみ` で `loadSession(currentSessionId || lastSessionId)` を初回 mount 時に 1 回走らせる。こちらは残している。

よって **project 切替で失われるのは「前 project の snapshot」だけ**。これは v3.5.9 Chunk D の snapshot 機能が持っていた「同じ project に戻った時に streaming / tool_use も含めて瞬時復元」の恩恵のうち、**新規切替 (前 project 状態を記憶する) パス**が失われる。戻りパス (後から元 project に戻る) は mount 経路が DB load になるため「確定済み messages だけ復元」にとどまる。これは **regression というより既存設計の fragile 部分の一時的後退**であり、split pane 機能 (オーナーが直近で使いたい機能) の完全動作を優先。

後日、snapshot swap を **Shell 側の activeProjectId effect で orchestrate** する形に移管すれば両立可能 (v3.6 Step 2 以降で別タスク)。

---

## 2. 実装 diff 要約

### ファイル: `C:\Users\hiron\Desktop\ccmux-ide-gui\components\chat\ChatPanel.tsx`

**変更**: `initialMountRef` guard を追加して初回 useEffect 実行時は `prevActiveProjectIdRef` に現 activeProjectId を記録するだけで snapshot swap を skip。

```diff
+ const initialMountRef = useRef(true);
  const prevActiveProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
+   if (initialMountRef.current) {
+     initialMountRef.current = false;
+     prevActiveProjectIdRef.current = activeProjectId;
+     return;
+   }
    const prev = prevActiveProjectIdRef.current;
    const next = activeProjectId;
    ...
```

行数: +詳細コメント 27 行 (root cause / 方針 / 後日移管予定の説明) + `initialMountRef` 宣言 1 行 + guard 5 行 = **実質コード追加 6 行**。ロジック行は +6 のみ、残りはコメント。

### ファイル: `C:\Users\hiron\Desktop\ccmux-ide-gui\hooks\useAllProjectsSidecarListener.ts`

**変更**: `claimNextSendForPane` / `resolvePaneForEvent` / `releaseReqIdIfTerminal` に console.log を 1 行ずつ追加。grep パターンで再現時にオーナーが DevTools でフィルタ可能。

```diff
  // claim 側
  pendingSendsByProject.set(projectId, arr);
+ console.log("[pm810-claim]", { projectId, paneId, queue: [...arr], mapSize: reqIdToPane.size });

  // resolve 側
  reqIdToPane.set(reqId, { projectId, paneId: popped });
+ console.log("[pm810-resolve]", { projectId, paneId: popped, reqId, type: ev.type, hadPayloadReqId: payloadReqId !== null, queueLeft: queue?.length ?? 0 });

  // release 側
+ const existed = reqIdToPane.has(reqId);
  reqIdToPane.delete(reqId);
+ console.log("[pm810-release]", { reqId, type: ev.type, existed, mapSize: reqIdToPane.size });
```

行数: 3 log 文 + 1 check line + 軽めのコメント = **実質コード追加 8 行** (ログとコメントを除くと 4 行)。

| ファイル | 実質変更行数 | ロジック差分 |
|---|---|---|
| `components/chat/ChatPanel.tsx` | +6 コード + 27 コメント | initialMountRef guard |
| `hooks/useAllProjectsSidecarListener.ts` | +8 コード + 8 コメント | 3 種類の console.log 追加 |
| **合計** | **+14 コード** | 既存ロジック削除なし |

Rust: **無変更**。sidecar: **無変更**。

---

## 3. 検証

### 3.1 型チェック

| コマンド | 結果 |
|---|---|
| `cd C:\Users\hiron\Desktop\ccmux-ide-gui && npx tsc --noEmit` | exit 0 |
| `cd C:\Users\hiron\Desktop\ccmux-ide-gui\sidecar && npx tsc --noEmit` | exit 0 (無変更) |

### 3.2 build 再実行の要否

- **frontend**: Next.js dev が HMR で差分取込するため dev 継続中なら自動反映。HMR 不安定なら `Ctrl+R` で Tauri webview reload でも OK。
- **sidecar**: 無変更のため rebuild 不要 (`sidecar/dist/index.mjs` のまま)。
- **Rust**: 無変更のため tauri rebuild 不要。

---

## 4. オーナー実機再現手順

### 4.1 準備

1. アプリが起動中なら `Ctrl+R` で webview reload、または dev 再起動。
2. DevTools を開き (`Ctrl+Shift+I`)、Console タブの filter に `pm810` と入れて grep を準備。

### 4.2 Case A: 分割の基本動作確認 (本 hotfix の中心)

1. 1 pane 状態で任意 project を開いている状態から「分割」ボタン押下。
2. **期待**: 2 pane が左右に並ぶ、両 pane のヘッダに session 選択 UI が表示される。
3. **異常兆候**: 新 pane が瞬時に消える / main 側 messages が空になる → 再度本レポートの debug log を添えて報告。

### 4.3 Case B: split 2 pane の独立送信

1. 左 pane (main) で「こんにちは (A)」を送信 → 完了待ち。
2. 右 pane (pane-X) ヘッダで「新規セッション」を選んで session を分離。
3. 右 pane (pane-X) で「こんにちは (B)」を送信 → 完了待ち。
4. **期待**: 左 pane の messages に (A) の user/assistant、右 pane に (B) の user/assistant が独立して残る。streaming スピナーも個別に制御。
5. **DevTools Console**:
   - `[pm810-claim]` が A / B 送信それぞれで 1 回ずつ出現
   - `[pm810-resolve]` が各 event で出る、`paneId` は A 側 req では `main`、B 側 req では `pane-<uuid>`
   - `[pm810-release]` が done / result で対応 reqId の entry を削除 (existed:true)

### 4.4 Case C: 並列送信

1. 2 pane で A 側に長文生成依頼 (例: "1000 字の markdown を書いて") → streaming 中に
2. B 側に短文送信 ("hello")
3. **期待**: 両 pane の assistant message が各 pane のみで streaming する、DB リロード後も separate session に正しく残る。

### 4.5 Case D: project 切替後の分割

1. project A 選択状態で分割 → 2 pane
2. project B に切替 → ChatPanel 再 mount → 1 pane 表示 (これは今回の hotfix で既知の一時後退、再分割で復活可能)
3. project A に戻る → 1 pane (snapshot は pane 状態を保存したが restore 経路が初回 mount スキップで停止)
4. **期待**: 1 pane には project A の最後の session の messages が DB 経由で復元される (mountLoadRanRef 経路)、ただし前回開いていた 2 pane 構成は記憶されない。気になるなら再分割で OK。

### 4.6 log pattern 早見表

| grep | 意味 |
|---|---|
| `[pm810-claim]` | 送信直前の FIFO push。queue 長と現在の reqIdToPane size を出す |
| `[pm810-resolve]` | sidecar event 受信時の paneId 決定。`paneId === "main"` が **ずっと** 続いたら split 送信時の claim が効いていない signal |
| `[pm810-release]` | done/result/error/interrupted で map から reqId を削除 |
| `[sidecar] prompt received: id=...` | sidecar が prompt を受理 (stderr) |
| `[agent.ts] query options: resume=...` | SDK 呼出直前の options (stderr) |

---

## 5. 回帰テストチェックリスト

オーナーに手動で確認依頼:

- [ ] 1 pane の基本送受信に変化が無い
- [ ] 分割ボタンで 2 pane が出現する (pane-X が消えない)
- [ ] 2 pane それぞれで session 分離 + 独立送信 OK
- [ ] 2 pane 並列送信で混線しない
- [ ] pane 削除で残った 1 pane の messages 保持
- [ ] project 切替で messages が消えない (DB 経由で復元される前提)
- [ ] リロード後 session が復元される

---

## 6. 残留 / 次タスク

### 6.1 既知の一時後退

- **project 切替時の snapshot save/restore 停止**: 本 hotfix で save/restore は「`activeProjectId` が 2 回目以降変化した時のみ発火」仕様に縮退。初回 mount (= project 切替 remount 含む) は DB loadSession 経由で messages を復元するのみ。streaming 中の message は切替で失われる (= v3.5.9 Chunk D 以前の挙動に近い状態)。
- 修正案: Shell 側に `activeProjectId` effect を置いて `saveProjectSnapshot(prev) → restoreProjectSnapshot(next)` を 1 回だけ orchestrate する設計に移管する (新タスク提案)。

### 6.2 残留 debug log

- `[pm810-claim]` / `[pm810-resolve]` / `[pm810-release]`: PM-746 (log 整理タスク) で本実装の安定確認後に削除予定。
- 既存 `[sidecar] prompt received` / `[agent.ts] query options` / `[sdk_session_ready]` / `[send] resume=` も同じタイミングで整理。

### 6.3 推奨後続タスク

- **PM-xxx (提案)**: snapshot orchestrate を Shell 側 effect に移管、ChatPanel 側は subscriber に戻す。現 ChatPanel の `prevActiveProjectIdRef` + `initialMountRef` + `isActiveRef` 三段組を解消。
- **PM-746 (既存)**: PM-810 / PM-830 派生 debug log の清掃。本 hotfix で追加した 3 種 log も同バンドルで削除する。
- **reqIdToPane の TTL**: sidecar crash 等で terminal event が到達しない場合、map entry が残る。weak timeout (10 min で自動 sweep 等) を検討。現状は `mapSize` が log に出るので肥大化を検知できる。

---

## 7. 参考: 変更ファイル絶対パス

- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\chat\ChatPanel.tsx` (initialMountRef guard)
- `C:\Users\hiron\Desktop\ccmux-ide-gui\hooks\useAllProjectsSidecarListener.ts` (debug log × 3)

## 8. 変更していないが参照した関連ファイル

- `C:\Users\hiron\Desktop\ccmux-ide-gui\sidecar\src\index.ts`
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\chat\InputArea.tsx`
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\layout\Shell.tsx`
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\chat\ChatPaneHeader.tsx`
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\layout\SplitView.tsx`
- `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\stores\chat.ts`
- `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\stores\session.ts`
- `C:\Users\hiron\Desktop\ccmux-ide-gui\src-tauri\src\commands\agent.rs`

---

**CEO への上申**:
- PM-810 本体実装は整合済み。regression の真因は `ChatPanel.tsx` の **初回 mount useEffect が addPane 直後の新 pane で snapshot restore を誤発火させる** 既存バグで、PM-810 の split 独立 routing 機能が初めて本番使用されたタイミングで露呈したもの。
- hotfix は frontend 1 ファイル 6 行 + 可視化 log 8 行の最小 diff、Rust / sidecar ともに無変更で即反映可能。
- オーナー実機で Case A〜D (特に A: 分割の基本動作、B: 2 pane 独立送信) を確認いただければ完了。
- 並行して debug log の grep 結果を次回報告に添えていただくと、万一追加の regression が残っていても即特定できる。
