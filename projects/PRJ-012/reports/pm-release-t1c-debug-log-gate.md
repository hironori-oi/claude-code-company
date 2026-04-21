# PRJ-012 Tier 1-C (PM-746) — console.log 本番 gate 処理 完了レポート

- 案件 ID: PRJ-012 (ccmux-ide-gui)
- タスク: PM-746 / Tier 1-C release readiness — frontend debug log の production gate 化
- 担当: dev
- 実施日: 2026-04-20
- 対象ブランチ: main (ccmux-ide-gui)
- 作業時間: 約 1h

---

## 1. 背景と目的

readiness audit で frontend console.log の残存が production build で個人 path
(`C:\Users\hiron\...`) や内部 state を browser devtools に露出させるリスクとして
指摘された。Private 運用でも画面キャプチャ共有時に漏洩するため、release 前に
gate しておく。

**方針**: 全削除ではなく **`lib/logger.ts` wrapper + `NODE_ENV` gate** にして
将来の debug も dev 時に容易に出せる設計を残す。

---

## 2. 実装内容

### 2-1. `lib/logger.ts` 新設

`C:\Users\hiron\Desktop\ccmux-ide-gui\lib\logger.ts` を新規作成。

```ts
const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  debug: (...args: unknown[]): void => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  },
  info: (...args: unknown[]): void => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.info(...args);
    }
  },
  warn: (...args: unknown[]): void => {
    // eslint-disable-next-line no-console
    console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    // eslint-disable-next-line no-console
    console.error(...args);
  },
};
```

**設計ポイント**:
- `process.env.NODE_ENV` は Next.js が build 時に静的 inline → dead-code elimination で
  production bundle から `console.log` 呼び出し自体が消える。
- `warn` / `error` は **gate しない**。ユーザ起因エラーの解析に必要。
- wrapper 本体のみ `eslint-disable no-console` を付け、呼出側は logger 経由で自然に通る。

### 2-2. 置換ルール

| before | after | 備考 |
|---|---|---|
| `console.log(...)` | `logger.debug(...)` | 本番 silent |
| `console.debug(...)` | `logger.debug(...)` | 本番 silent |
| `console.info(...)` | `logger.info(...)` | 本番 silent |
| `console.warn(...)` | **残置** | production でも出力 |
| `console.error(...)` | **残置** | production でも出力 |

### 2-3. 置換対象 (frontend のみ)

| file | 置換件数 | 残置 warn/error |
|---|---|---|
| `hooks/useAllProjectsSidecarListener.ts` | 4 (pm810-claim/resolve/release, sdk_session_ready) | warn × 4 |
| `components/sidebar/ProjectTree.tsx` | 5 (invoke 可視化, render debug, drag 可視化) | error × 2 |
| `components/chat/InputArea.tsx` | 3 (send resume log, cache miss recover, drop 可視化) | warn × 1 |
| **合計** | **12 件 / 3 file** | warn 5 + error 2 |

### 2-4. 対象外 (残置)

- `components/onboarding/SampleProjectStep.tsx:180` の `console.log("Hello from ccmux-ide (Node).");`
  → **template string 内の sample code** (`node-hello/index.js` として書き出される文字列)。
  アプリ内部 log ではなくユーザが実行する sample そのもので、削除すると sample
  project の意図が壊れるため対象外。
- `tests/e2e/fixtures.ts` の `console.warn` → tsconfig で test は compile から除外済み。
- 各 store / hook / component の `console.warn` / `console.error` 多数
  → production でも残す方針 (UX 障害 / 致命エラー解析用)。

### 2-5. PM-810 regression hotfix log の扱い

`[pm810-claim]` / `[pm810-resolve]` / `[pm810-release]` の 3 箇所は
`logger.debug` 経由に置換したため、**dev 時は従来どおり console.log として出力**される。
PM-810 の dogfood 可視化要件は維持される (production では silent)。

---

## 3. 検証

### 3-1. 型チェック

```
npx tsc --noEmit
→ 0 error (exit 0)
```

### 3-2. Production build

```
npx next build
→ ✓ Compiled successfully in 11.8s
→ ✓ Generating static pages (9/9)
→ ✓ Exporting (2/2)
```

bundle size は既存とほぼ同等 (104 kB shared / first load 108-191 kB)。

### 3-3. console.log 件数 before/after (frontend 実コード、tsconfig exclude 適用後)

| 種別 | before | after | 備考 |
|---|---|---|---|
| `console.log` | 12 | 0 | 全て logger.debug へ (sample template の 1 件は対象外) |
| `console.debug` | 0 | 0 | 元から無し |
| `console.info` | 0 | 0 | 元から無し |
| `console.warn` | 8 | 8 | 全件残置 (production でも出す方針) |
| `console.error` | 4 | 4 | 全件残置 (production でも出す方針) |
| `logger.debug` | 0 | 12 | 新規 |

※ `console.log` の「before 12」は `tests/` / `sidecar/` / `public/sample-projects/` /
sample template 内を除いた frontend 実コードの集計。

※ readiness audit で指摘された「2722 件」は恐らく node_modules 込みの総計、
または別 tool の集計。frontend source code 実体は 12 件だった
(過去 PM-770 dead-code-removal の副次効果もありそう)。

### 3-4. build ログの非 blocking warning

事前からの既存 warning のみ (本 task で追加/除去したものは無い):
- `StatusBar.tsx` の unused vars × 3
- `AppearanceSettings.tsx` の aria-pressed 非対応
- `FilePreviewDialog.tsx` の `<img>` 推奨警告
- `ProjectTree.tsx` の `treeitem` aria-selected 欠如 × 2
- SSR 時の `list_active_sidecars failed: window is not defined`
  (static page generation 時の既知挙動、Tauri ランタイムでは解決)

---

## 4. Rust / sidecar 側の対応方針 (報告のみ、本 task では touch しない)

### 4-1. Rust (`src-tauri`) の `eprintln!` / `println!`

- Tauri **release build では WebView2 に stdout/stderr が繋がらない** 仕様
  (console pipe 無効) のため、`eprintln!` 出力が user visible な場所に漏れる
  経路は基本的に無い。
- log crate + RUST_LOG 環境変数で gate する選択肢もあるが、**今回は対象外**
  として報告のみ。
- もし将来 `tauri-plugin-log` で file sink を追加する際は、path に
  username を含めない sanitize も合わせて検討。

### 4-2. sidecar (Node.js child process) の `process.stderr.write` / `console.*`

- sidecar の stderr / stdout は Tauri 側 `Command::new` で pipe 経由で受け取り、
  frontend に event (`agent:${projectId}:stderr`) として流している。
- frontend 側 listener (`useAllProjectsSidecarListener.ts:242`) で
  `console.warn("[sidecar stderr:...]", trimmed)` を出しているが、これは
  **ユーザ起因エラー解析に必要**のため残置。
- sidecar 内部の debug log (例: prompt 送受信ログ) は既に `DEBUG_SIDECAR`
  env で gate する運用なので、本 task では手を入れない。

---

## 5. 変更 file 一覧

新規:
- `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\logger.ts`

編集:
- `C:\Users\hiron\Desktop\ccmux-ide-gui\hooks\useAllProjectsSidecarListener.ts`
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\sidebar\ProjectTree.tsx`
- `C:\Users\hiron\Desktop\ccmux-ide-gui\components\chat\InputArea.tsx`

非対象 (方針厳守):
- `package.json` / `package-lock.json` (T1-B 担当)
- `src-tauri/**` (T2-D/E 担当)
- `sidecar/**` / `public/sample-projects/**` (今回対象外と事前合意)
- `tests/**` (tsconfig exclude)

---

## 6. 完了条件チェック

- [x] `lib/logger.ts` 新設
- [x] 対象 console.log/debug/info が全て logger wrapper 経由に置換
- [x] console.warn / console.error は残置 (production でも出す)
- [x] `npx tsc --noEmit` 0 error
- [x] `npx next build` 成功
- [x] 置換件数 before/after 報告
- [x] PM-810 hotfix log (`[pm810-claim]` / `[pm810-resolve]` / `[pm810-release]`)
      を logger.debug 経由に置換して dev での可観測性維持
- [x] 他 Agent (T1-B / T2-D/E) と非干渉
- [x] レポート作成

---

## 7. 次アクション (CEO 判断)

- dogfood で `logger.debug` 経由の pm810 / sdk_session_ready / drop / drag log が
  従来どおり console に流れることを確認 (dev build であれば自動で出る)。
- release build で devtools 開いて `[pm810-claim]` 等が出ないこと、
  `console.error`/`console.warn` のみ残ることを確認。
- Rust / sidecar 側の log gate は別 task として切り出すか、readiness audit
  本体で「今回 scope 外」として記載するか判断が必要。

---

以上、Tier 1-C (PM-746) 完了。
