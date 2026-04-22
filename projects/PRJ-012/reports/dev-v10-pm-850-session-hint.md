# PM-850: session 継続性 system hint 付与 — 完了レポート

- 案件: PRJ-012 ccmux-ide-gui v1.2
- チケット: PM-850
- 担当: dev (build-error-resolver delegation)
- 日付: 2026-04-20
- branch: `v1.2-dev`
- 対象リポジトリ: `C:\Users\hiron\Desktop\ccmux-ide-gui\`

## 背景

PM-810 multi-pane routing / v3.5.19 session cache / PM-910 /clear context refresh
実装済にも関わらず、Claude 側応答揺らぎで **resume 中でも「新規会話です」的な
応答** を返すケースが dogfood で散見された。prompt 側に継続性を明示する hint を
付与して挙動を安定化させる。

## 実装範囲

- `sidecar/src/agent.ts` の `runAgentQuery()` に PM-850 ブロックを追加
- `opts.resume` が 非空文字列 のときに限り、`systemPrompt` に
  continuation hint を additive に append
- 既存 `systemPrompt` (string / preset object / undefined) の 3 形態を型安全に分岐
- stderr に 1 行 log を出し、`opts.resume` 値と併せて付与事実を可視化

## 差分概要

### 変更ファイル
- `sidecar/src/agent.ts` (+36 / -0)

### Hint 文面
```
Note: This is an ongoing session with prior messages. Refer to earlier context when relevant.
```

英語 1 文に抑制。CLAUDE.md など既存 user system prompt とのトーン衝突を避ける
最小フレーズとした。

### 3 形態への対応

| 既存 `systemPrompt` | 付与後 |
|---|---|
| `undefined` | hint (string) |
| `string` (user が設定) | `${existing}\n\n${hint}` |
| `{ type: "preset", preset: "claude_code", append?: string }` | `{ ...existing, append: <既存 append + hint>` or `hint>` }` |

preset object の場合は SDK 契約に合わせ `append` フィールドに連結する。
これにより Claude Code の built-in system prompt (CLAUDE.md 等) は保持される。

### 条件

- `resume` 未指定 / 空文字列 → 何もしない (新規 session なので当然)
- `resume` あり → hint を必ず append (idempotency は不要 / 毎 prompt で再付与)

## 完了条件チェック

| 項目 | 結果 | 備考 |
|---|---|---|
| resume 時に continuation hint が system prompt に append | OK | 3 形態分岐で実装 |
| 既存 user systemPrompt を壊さない | OK | additive (append 方式) |
| `cd sidecar && npx tsc --noEmit` 0 error | OK | 無出力 / exit 0 |
| `cd sidecar && npm run build` 成功 | OK | `dist/index.mjs` 806.1 KB / 196ms |
| `cd .. && npx tsc --noEmit` (frontend) 0 error | OK | 無出力 / exit 0 |
| bundle に hint 文字列が含まれる | OK | `dist/index.mjs` L18090 で確認 |

## 注意事項 / 引き継ぎ

- **tauri dev 利用者は sidecar restart が必要** (rebundle 反映のため)。
  通常の `npm run tauri dev` 再起動で十分。
- `resume` は sidecar が `opts` に必ず早期正規化する (空文字 → delete) ため、
  hint 条件判定は runAgentQuery 側で `length > 0` を再チェックして二重安全化。
- PM-949 / PM-950 との conflict 回避のため、touch したのは `sidecar/src/agent.ts`
  のみ。frontend / rust / index.ts には一切手を入れていない。
- 過度な refactor 禁止ルールに準拠し、既存 stderr log パターン
  (`process.stderr.write(...)`) をそのまま踏襲。PM-746 の logger wrapper が
  正式統合されたタイミングで他の log 行と一括移行予定。

## 検証方法 (手動 dogfood 想定)

1. ccmux-ide-gui を `npm run tauri dev` で起動
2. 任意の project で 1 通目送信 → sdk_session_id が DB 保存されることを確認
3. 2 通目送信時に sidecar stderr に
   `[agent.ts] PM-850: appended continuation hint to systemPrompt (resume=...)`
   が出力されることを確認
4. Claude 応答で「新規会話」扱いする発言が有意に減るか dogfood observation

## ファイル参照 (絶対パス)

- 実装: `C:\Users\hiron\Desktop\ccmux-ide-gui\sidecar\src\agent.ts`
- ビルド出力: `C:\Users\hiron\Desktop\ccmux-ide-gui\sidecar\dist\index.mjs`
- レポート: `C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-012\reports\dev-v10-pm-850-session-hint.md`

---

build-error-resolver delegation 完了。CEO への報告をお願いします。
