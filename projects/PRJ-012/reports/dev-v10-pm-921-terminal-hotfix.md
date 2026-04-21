# PRJ-012 v1.0 / PM-921 — 組込ターミナル hotfix (Bug 1: /exit 後 prompt 描画崩れ / Bug 2: × ボタンで UI freeze)

- **案件**: PRJ-012 Claude Code マルチプロジェクト IDE
- **タスク**: PM-921 / PM-920 の直後に発覚した 2 件の bug を hotfix
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **日付**: 2026-04-21
- **担当**: 開発部門 (dev-v10)
- **関連**: PM-920 (DEC-045 組込ターミナル v1.0 本実装)

## 0. サマリー

PM-920 実装直後にオーナーから報告された 2 件の bug を最小 diff で修正した。

- **Bug 1 (/exit 後 prompt 描画位置ずれ)**: `term.reset() + fit.fit()` を呼ぶ「クリア」ボタン + Ctrl+Shift+L shortcut + exit event 契機の auto-reset を追加。
- **Bug 2 (× ボタンで UI freeze)**: Rust 側は `portable-pty::ChildKiller` (clone_killer で取得する独立 handle) を導入し、`wait()` が保持する child mutex と kill 側の競合 deadlock を根絶。frontend 側は `closeTerminal` を optimistic 更新 + fire-and-forget 化し UI 応答性を確保。
- **テスト**: `cargo check` 0 error、`cargo test --lib` 100/100 pass (新規 1 test)、`npx tsc --noEmit` 0 error、`npx next build` 成功。
- **refactor なし**: 既存 API / event / データフローに非破壊、PM-920 の契約を維持。

## 1. 変更ファイル一覧

### 新規作成

| File | 役割 |
|---|---|
| `components/terminal/terminal-reset-registry.ts` | xterm viewport reset 関数の module-level Map (SSR-safe)。TerminalPane が mount 時に `registerTerminalReset` で登録、TerminalView / useTerminalListener が `resetTerminalViewport(ptyId)` 経由で呼出。 |

### 既存ファイルへの最小 diff

| File | 変更点 |
|---|---|
| `src-tauri/src/commands/pty.rs` | `PtyHandle` に `killer: Arc<Mutex<Box<dyn ChildKiller + Send + Sync>>>` 追加。`pty_spawn` で `child.clone_killer()` を取得し保持。`pty_kill` / `drain_kill_all` / `Drop` を killer 経由に変更 (child mutex 非依存)。unit test を 1 件追加 (`pty_handle_killer_is_send_sync`)。 |
| `components/terminal/TerminalPane.tsx` | reset 関数を registry に登録 (`registerTerminalReset` / `unregisterTerminalReset`) + Ctrl+Shift+L で手動 reset するキーボードハンドラ追加。 |
| `components/terminal/TerminalView.tsx` | sub-tab bar に「クリア」ボタン (RotateCcw icon) を追加。`resetTerminalViewport(activeTerminalId)` を呼ぶ。 |
| `hooks/useTerminalListener.ts` | exit event 受信時に `resetTerminalViewport(id)` を呼び auto-reset を試行。 |
| `lib/stores/terminal.ts` | `closeTerminal` を「先に store 削除 → pty_kill を fire-and-forget」の optimistic flow に変更。 |

### 変更なし (意図的)

- `src-tauri/Cargo.toml`: `portable-pty = "0.8"` はそのまま (0.8 に `ChildKiller` 同梱済み、バージョン変更不要)
- `src-tauri/src/lib.rs`: `PtyState::drain_kill_all` は API 不変、setup / on_window_event の hook も不変
- `components/layout/Shell.tsx`: タブ構成 / `useTerminalListener()` 呼出位置ともに不変

## 2. Bug 1 分析と修正

### 2-1. 現象

- Terminal で `claude` コマンド実行 → Claude Code CLI の TUI が起動 (alternate screen buffer 使用)
- `/exit` で終了後、cmd.exe の prompt が左端から描画されず左側が欠ける (例: `C:\Users\hiron\Desktop\claude-code-company>` が `e-company>` に見える)

### 2-2. 原因仮説 (採用)

claude CLI は終了時に alt screen buffer の復帰 (`\033[?1049l`) は送るものの、**scroll region reset (`\033[r`)** や **cursor position reset (`\033[H`)** を十分送っておらず、ConPTY 経由で xterm.js に届く時点で viewport の state (margin / scroll region / cursor column) が残留する。cmd.exe の新規 prompt は絶対位置 (col=0) ではなく現在の cursor column の続きに描画されるため、残留 offset が左端欠損として現れる。

ConPTY の Windows 側挙動・claude CLI の terminfo 非完全性・cmd.exe の prompt rendering 順序の 3 者が絡むため、**単一の escape sequence 補正では完全自動化できない**と判断。

### 2-3. 採用修正案: 手動 reset (主) + 自動 reset (補助)

#### 主: 「クリア」ボタン + Ctrl+Shift+L
ユーザーがいつでも viewport を復旧できる手段を提供する。中身は:

```ts
term.reset();  // xterm.js 内部の scroll region / cursor / viewport を全部初期化
fit.fit();     // 現在の container サイズに合わせて cols/rows を再計算
term.focus();
```

- UI: `TerminalView.tsx` の sub-tab bar 右端に `<RotateCcw />` アイコン + 「クリア」ラベルのボタンを追加 (`ml-auto` で右寄せ)
- shortcut: `TerminalPane.tsx` の container に `keydown` listener を attach し、`Ctrl+Shift+L` で同一の reset 関数を呼ぶ (Shift 無しの Ctrl+L は shell の `clear` コマンドと衝突する慣習のため回避)
- どちらからも共通の reset 関数を呼ぶため挙動は 1 種類のみ

#### 補助: exit event 契機の auto-reset
`useTerminalListener` の exit event handler 内で `resetTerminalViewport(ptyId)` を呼ぶ。これで claude CLI 以外のコマンド (vim `:q` / python REPL `exit()` 等) でも終了直後に viewport が再整列される。

ただし claude CLI は `/exit` を shell exit と独立に扱い shell プロセス自体は終了しない (= pty:exit event は発火しない) ため、claude の `/exit` だけ見れば auto-reset は効かない。これはあえて「手動 reset を第一の復旧手段」と位置付けて受容する (MCP spec 外の CLI 固有挙動を追尾するのは無限後追いになるため)。

### 2-4. なぜ「escape sequence 自動送信」を選ばなかったか

`resetFn` 内で `pty_write` に `\033[H\033[2J\033[3J\033[r` 等の escape sequence を送る方針も検討したが:
- cmd.exe は多くの escape sequence を無視する (Windows OSS 情報によれば ConPTY はフィルタする)
- 送信タイミングによって shell の prompt 表示を二重発火させるリスク
- 副作用が shell 固有 (bash / zsh / pwsh / cmd / busybox ash で挙動が違う)

ため、**xterm.js の viewport のみを reset** するに留めた。shell 側が cursor を正しい位置に置き直すかはユーザ次第 (cmd.exe なら `cls`、bash なら `clear`、もしくは Enter 押下で新 prompt 描画)。

## 3. Bug 2 分析と修正

### 3-1. 現象

- Terminal sub-tab の × (close) ボタン押下で UI がフリーズ
- pty が正常に kill されていない疑い

### 3-2. 原因仮説 (採用)

**Root cause は Rust 側 deadlock-like 挙動。** `PtyHandle` は v1.0 で以下の構造:

```rust
pub struct PtyHandle {
    pub child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
    ...
}
```

exit watcher task (spawn_blocking) が `child.wait()` を呼ぶのに `child.lock()` を取得し、**wait() の blocking 間中ずっと mutex を保持し続ける**:

```rust
let exit_status = match child_for_exit.lock() {
    Ok(mut child) => child.wait(),   // ← ここで blocking。mutex 保持 !!
    ...
};
```

`pty_kill` command は同じ `handle.child.lock()` を取って `kill()` を呼ぼうとするため、child が実際に終了するまで mutex 解放されず **invoke("pty_kill") が永久に返らない**。frontend 側の `closeTerminal` は `await pty_kill` していたため UI 更新が止まり、× ボタン操作が固まって見える。

### 3-3. 採用修正案: ChildKiller の独立 handle + frontend optimistic update

#### Rust 側: `clone_killer()` で kill 専用 handle を分離

portable-pty 0.8 の `Child` trait は `ChildKiller` を extend しており、`fn clone_killer(&self) -> Box<dyn ChildKiller + Send + Sync>` で **kill 機能のみを持つ別 handle** を複製できる (Windows では CreateProcess の HANDLE を DuplicateHandle、unix では pid の拷貝)。

`PtyHandle` に `killer` field を追加し、`pty_kill` / `drain_kill_all` / `Drop` は `killer.lock()` を取る。exit watcher の `child.lock()` とは別 mutex のため競合しない。結果:

- `pty_kill` は killer lock を即取得 → `kill()` 発行 → 即 return
- exit watcher の `child.wait()` は kill 後ほぼ直ちに EOF で抜け、`pty:{id}:exit` event が正常 emit される
- HashMap からの remove は `pty_kill` と exit watcher 双方に存在するが `HashMap::remove` は idempotent なのでレースしない

diff summary (pty.rs):

```diff
- use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
+ use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};

  pub struct PtyHandle {
      pub master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
      pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
+     #[allow(dead_code)]  // exit watcher が Arc::clone で保持、field 直接 read はなし
      pub child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
+     pub killer: Arc<Mutex<Box<dyn ChildKiller + Send + Sync>>>,
      ...
  }

  // pty_spawn 内
+ let killer = child.clone_killer();  // boxing 前に kill handle を複製
  ...
+ let killer_arc: Arc<Mutex<Box<dyn ChildKiller + Send + Sync>>> =
+     Arc::new(Mutex::new(killer));

  // pty_kill (completely rewritten)
  pub fn pty_kill(state: State<'_, PtyState>, pty_id: String) -> Result<(), String> {
-     let mut guard = state.ptys.lock().map_err(...)?;
-     if let Some(handle) = guard.remove(&pty_id) {
-         if let Ok(mut child) = handle.child.lock() {
-             let _ = child.kill();  // ← child mutex が wait() で保持されていて deadlock
-         }
-     }
+     // state.ptys lock は killer 取得のみで解放し、kill() 時は state lock 非保持
+     let killer_opt = {
+         let mut guard = state.ptys.lock().map_err(...)?;
+         guard.remove(&pty_id).map(|h| h.killer)
+     };
+     if let Some(killer_arc) = killer_opt {
+         if let Ok(mut killer) = killer_arc.lock() {
+             let _ = killer.kill();
+         }
+     }
      Ok(())
  }
```

`drain_kill_all` / `Drop` も `handle.child.lock()` → `handle.killer.lock()` に変更 (shutdown 時の hang 予防)。

#### Frontend 側: optimistic store update + fire-and-forget kill

UI 応答性の保険として `closeTerminal` を変更:

```diff
- try { await callTauri("pty_kill", { ptyId }); } catch ...
- set((state) => ({ ... UI から削除 ... }));
+ set((state) => ({ ... UI から先に削除 ... }));  // optimistic
+ void callTauri("pty_kill", { ptyId }).catch((e) =>
+   logger.warn("[terminal-store] kill failed (UI は既に削除済):", e)
+ );
```

これにより Rust 側の kill が仮に遅延しても × ボタン押下後すぐに TerminalPane が unmount され UI が返る。Rust 側の修正と二重の防衛線になる。

### 3-4. 新規テスト

```rust
#[test]
fn pty_handle_killer_is_send_sync() {
    fn assert_send_sync<T: Send + Sync>() {}
    assert_send_sync::<
        std::sync::Arc<std::sync::Mutex<Box<dyn portable_pty::ChildKiller + Send + Sync>>>,
    >();
}
```

Tauri state が require する Send + Sync を compile-time で保証。

## 4. 検証結果

### Rust

```
$ cd src-tauri && cargo check --lib
warning: 3 pre-existing warnings (history / memory_tree / events::monitor — 本 hotfix 無関係)
Finished `dev` profile in 2.62s

$ cargo test --lib
test result: ok. 100 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

新規 1 test (`pty_handle_killer_is_send_sync`)、既存 99 test 含め 100/100 pass。PM-920 時点では 99 だったため 1 件増。

### TypeScript

```
$ npx tsc --noEmit
(0 error)
```

### Next build

```
$ npx next build
✓ Compiled successfully in 11.5s
✓ Generating static pages (9/9)
✓ Exporting (2/2)
```

warnings は pre-existing の 5 件 (StatusBar / AppearanceSettings / FilePreviewDialog / ProjectTree × 2) のみで本 hotfix 起因なし。`ReferenceError: window is not defined` の `list_active_sidecars` SSG エラーも PM-920 時点から同じ。

## 5. オーナー実機検証手順

### 前提
- tauri dev 停止済 (Rust 側 Cargo.toml は未変更だが .rs が変わったので再 build 必要)

### Bug 1 検証手順

1. `cd C:\Users\hiron\Desktop\ccmux-ide-gui && npm run tauri:dev` で起動
2. 「ターミナル」タブを開く (auto-spawn で cmd.exe 起動)
3. `claude` コマンドを実行 → Claude Code CLI TUI に入る
4. `/exit` で終了
5. **期待**: cmd.exe の prompt が左端から正しく描画される
6. もし prompt 描画が崩れた場合:
   - sub-tab bar 右端の「クリア」(RotateCcw icon) ボタンを押下 → viewport が即時 reset、prompt 再描画
   - または Terminal にフォーカスを置いたまま `Ctrl+Shift+L` 押下 → 同様に reset
7. exit event 契機の auto-reset を確認:
   - cmd.exe で `python` を起動 → REPL に入る → `exit()` で REPL 終了
   - この時点で python プロセスが死に `pty:exit` event が発火するため viewport が自動 reset される (claude CLI のようなケースでは `/exit` しても shell 自体は生きているので auto-reset は効かない、手動で「クリア」を使う)

### Bug 2 検証手順

1. 同様に起動して「ターミナル」タブを開く
2. sub-tab の「+新規」で 2〜3 個の pty を open
3. 各 sub-tab の × (close) ボタンを連続押下
4. **期待**: 押下後ただちに該当 sub-tab が消え、UI フリーズしない。他 pty は継続稼働
5. `claude` を実行中 (TUI 表示中) の pty で × を押す
   - **期待**: 即座に pty が消え、Claude Code の子プロセスも kill される (タスクマネージャで `node.exe` / `claude.exe` が残っていないことを確認)
6. アプリ全体を閉じる (ウィンドウ × or Ctrl+Q)
   - **期待**: 全 pty が drain_kill_all で kill される。タスクマネージャで `cmd.exe` / `bash` / `python` / `node.exe` (claude CLI 起因) が残っていないこと

### 非干渉確認

- チャットタブで Claude に送信可能 (PRJ-012 本体の挙動が従来通り)
- エディタタブでファイル編集可能
- Split (分割) が従来どおり動作
- project 切替で pty 一覧が切替 (v1.0 と同じ)
- Agent sidecar (並列) の起動・停止・prompt 送信は不変

## 6. 既知の未修正事項 (v1.1 候補)

| 項目 | 内容 | 対応方針 |
|---|---|---|
| claude CLI `/exit` の完全自動 reset | `/exit` は shell 子プロセスを終了せず `pty:exit` も発火しないため auto-reset が効かない。現状は手動「クリア」で復旧 | v1.1 で「連続 2 回の改行 + 特定 regex 検知」等による heuristic auto-reset を検討 (ただし false positive リスクあり、優先度低) |
| cmd.exe の prompt 自動再描画 | reset 後 cmd.exe は自発的に prompt を再描画しない (次の Enter 押下で描画される)。shell 非依存のため `term.reset()` だけでは埋められない | v1.1 で shell の種別検知後に `echo.` 等の safe no-op を送る手もあるが、副作用評価が必要 |
| reset 中の scrollback 消失 | `term.reset()` は scrollback buffer を wipe するため、直前の出力履歴は失われる。Ctrl+Shift+L を押すとログが消える UX | v1.1 で「soft reset」(`\033[r\033[H\033[2J` のみで scrollback は残す) を alternative として検討 |

いずれも v1.0 の主要 UX (/exit 後に復旧手段がある / × でフリーズしない) を満たしていれば許容範囲。

## 7. レポート終わり

完了条件:
- [x] Bug 1 修正: /exit 後の prompt 描画を復旧する手段 (クリアボタン + Ctrl+Shift+L) を提供、exit event 契機の auto-reset も併設
- [x] Bug 2 修正: × ボタンで UI フリーズせず Terminal が消える (Rust deadlock 解消 + frontend optimistic)
- [x] `cargo check` 0 error
- [x] `cargo test --lib` 100/100 pass (新規 1 件)
- [x] `npx tsc --noEmit` (frontend) 0 error
- [x] `npx next build` 成功
- [x] logger wrapper 経由 (console.log 直呼び出しなし)
- [x] 過度な refactor なし、最小 diff

工数実績: 約 1.5h (Rust crate 内部調査 + 修正 + 検証込み)。CEO に報告願います。
