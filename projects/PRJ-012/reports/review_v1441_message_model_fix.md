# PRJ-012 v1.44.1 hotfix - 品質レビュー (focused)

- 案件: PRJ-012 (sumi)
- 対象: v1.44.0 → v1.44.1 hotfix (DEC-083 follow-up)
- 日付: 2026-05-03
- レビュー観点: focused (~10 分、root cause / 設計 / DEC-057 整合 / テスト / リリース)
- 担当: レビュー部門 (シニアレビュアー)
- 関連: DEC-057 (project leak 防止) / DEC-083 (message meta) / DEC-084 (日付グルーピング)

---

## 判定: **APPROVE**

Critical / Major なし。Minor 指摘 2 件は次回チャンクで対処すれば十分。即リリース可。

---

## 1. 根本原因の特定の妥当性

dev レポート § 2.2 の Hypothesis A は **コードで裏付け取れた**:

| 確認項目 | 実コード | 結論 |
|---|---|---|
| `/model` slash dialog の書込先 | `ModelPickerDialog.tsx:36` `setSelected = useDialogStore((s) => s.setSelectedModel)` | dialog 専用 setter のみ |
| 同 dialog が session-preferences を更新するか | `ModelPickerDialog.tsx` に `useSessionPreferencesStore` import / `setPreference` 呼出 **なし** | 更新しない (= 仮説通り) |
| Tray Picker の書込先 | `TrayModelPicker.tsx:47,69` `setPreference(currentSessionId, owningProjectId, { model })` | session-preferences のみ更新 |
| Tray Picker が dialog を更新するか | `useDialogStore` import なし | 非対称 (= 仮説通り) |

**`/model` slash と Tray Picker の非対称性は事実**。slash 経由で model を切替えた場合 `useSessionPreferencesStore` は null のまま → `resolveSessionPreferences` が null を返し → `meta.uiModel = null` で append → `formatSdkModelName(null)` が空文字 → UserMessage の最終 else 分岐で `—` 化、というシナリオは完全に再現可能。Hypothesis A 確定で問題なし。仮説検証マップ § 2.5 の B/D/E/G が「無罪」判定されている根拠も `chat.ts:731` / `session.ts:127` / `update_message_meta` round-trip で確認可。

---

## 2. 修正の設計妥当性

### 2-A. fallback chain の責務分離 ✅

`InputArea.tsx:357-393` で 2 系統が **物理的に分離** されている:

| 用途 | 解決元 | 場所 |
|---|---|---|
| **meta 表示** (`uiModel`/`uiEffort`) | session-prefs ?? dialog default | L376-382 (新設、`resolveMetaUiValues`) |
| **sidecar argv** (`start_agent_sidecar` の model 引数) | session-prefs **のみ** | L422-450 (`startPrefs.model` → `modelIdToSdkId`) |
| **per-query options** (`send_agent_prompt` の options) | session-prefs **のみ** | L539-557 (`resolvedPrefs`) |

→ **DEC-057 (project leak 防止) のセマンティクスは破壊されていない**。dialog default fallback は表示専用で、sidecar 側に dialog 値が漏れるルートは存在しない。これが本 hotfix の最重要不変条件であり、確認最優先項目だったが clear。

`lib/utils/meta-fallback.ts` は 38 行の pure helper で型安全 (`ModelId | null` → `ModelId`)。副作用なし、import は型のみ。test 容易性も担保。

### 2-B. UserMessage の defensive chain ✅

`UserMessage.tsx:108-110`:
```ts
const sdkLabel = meta.sdkModel
  ? formatSdkModelName(meta.sdkModel) || meta.sdkModel
  : null;
```

`formatSdkModelName` が空文字を返す異常系 (辞書外 family) でも raw 値で逃げる。raw を生で出すのは debug 補助になり UX も `—` よりマシ。**意味論として妥当**。`model-display.test.ts:32,46` で「`claude-future-9-9` は raw 返却」が pin 済 → `sdkLabel || meta.sdkModel` の前提が崩れない。

### 2-C. listener guard 順修正 ✅

`useAllProjectsSidecarListener.ts:278-294`: 旧実装は `payload.model` 検証 **前** に `sdkInitProcessedReqIds.add(reqId)` 実行で「異常 init で reqId 永久 block」脆弱性があった。新実装は valid `sdkModel` 取得後にのみ guard 入り。

- 副作用なし (正常 path での挙動は完全に等価)
- 異常 init / user message 不在で `console.warn` を残置 (debug 補助、production noise 低)
- 後続 init を許容するため SDK 仕様変更耐性が向上

修正前後の挙動差分は「異常 init 受信時の reqId 解放」のみで意図通り。

---

## 3. 既存機能との非干渉

| 既存契約 | 影響 |
|---|---|
| **DEC-057** (project leak 防止: dialog 値を sidecar 解決に使わない) | **維持**。meta 表示用 fallback のみ dialog 参照、sidecar argv / per-query options は session-prefs 限定 |
| **DEC-083** (message meta: sdkModel back-fill / mismatch 警告) | 影響なし。`updateMessageMeta` 経路は無改変。`compareModelIds` 入力 (uiModel) が null ではなく valid 値になるため、判定はむしろ堅牢に |
| **DEC-084** (日付グルーピング: `meta.sentAt` 起点) | 影響なし。`meta.sentAt = Date.now()` の打刻挙動・優先順位は無改変 |
| 過去 message (`meta_json IS NULL`) | 影響なし。`{message.meta && <MessageMetaRow />}` で描画自体されない |
| `useDialogStore` 参照増による re-render | InputArea の `handleSend` 内 1 回の `getState()` 呼出のみ。subscribe 追加なし、re-render 増ゼロ |

mismatch 警告の誤発火懸念だが、dialog default `claude-opus-4-7[1m]` と sidecar default `claude-opus-4-7` は同一 family のため `compareModelIds` は "match" を返す (dev レポート § 5.1)。実コードで確認した dialog 初期値 (`lib/stores/dialog.ts:84`) も `claude-opus-4-7[1m]` で整合。

---

## 4. テストカバレッジ

vitest 157 → **165 PASS** (新規 8)。バグ症状を pin する観点で:

| 新規テスト | pin される property |
|---|---|
| `meta-fallback.test.ts` 5 ケース | preference 両 valid / 両 null / 部分 null × 2 / オーナー報告再現 (preferenceModel=null + dialog 永続化値あり → uiModel non-null) |
| `model-display.test.ts:45` | 辞書外 raw でも空文字でなく raw を返す (UserMessage `\|\| meta.sdkModel` 前提) |
| `chat.test.ts:126` | uiModel=null で append + sdkModel back-fill → state に sdkModel が反映され UserMessage が sdkLabel を出せる |
| `chat.test.ts:151` | dialog default fallback 適用後の uiModel が valid ModelId、sdkModel 未到達でも uiLabel ベースで表示可能 |

「両方 null は em-dash」を直接的に pin するケースは入っていないが、これは `MessageMetaRow` の最終 else 分岐 (`UserMessage.tsx:125`) で従来挙動として既に存在。**hotfix は「両方 null になる経路を塞ぐ」のがゴール**であり、塞いだ後の正常 path (preference 両 valid / null + dialog default fallback) を pin する現構成で十分。

cargo test --lib 182 PASS (Rust 側 schema / API 変更なし) も整合。

---

## 5. リリース準備

| 項目 | 状態 |
|---|---|
| `package.json` version | ✅ 1.44.1 |
| `src-tauri/Cargo.toml` version | ✅ 1.44.1 |
| `src-tauri/tauri.conf.json` version | ✅ 1.44.1 |
| CHANGELOG `## [v1.44.1] - 2026-05-03` | ✅ Fixed / Tests / Notes 三段構成、DEC-083 follow-up と明記 |
| `release.yml` awk pattern (`## [$TAG_NAME]`) との整合 | ✅ 見出しが `## [v1.44.1]` で完全一致、tag `v1.44.1` で抽出可能 |
| typecheck / lint | ✅ PASS / 新規警告ゼロ |

---

## 6. 推奨修正

### Minor (次チャンクで OK、本 hotfix の blocking ではない)

1. **listener の `console.warn` を `logger.warn` に統一する**: 既存コードベースに `lib/logger.ts` (推測; PM-746 で `logger.debug` に移行済 path あり、`InputArea.tsx:501` 等) があるため、新規 warn 2 箇所もそちらに揃える方が production noise gate 一括管理しやすい。`eslint-disable-next-line no-console` を使い続ける必要もない。

2. **`/model` `/effort` の dialog → preferences 同期の設計レビュー**: dev レポート § 8 にも記載されている通り、根本治癒には Picker dialog 側を `setPreference` も呼ぶように統一する案がある。表示層 fallback は対症療法として正しいが、中長期的には DEC-057 の意図 (= dialog 値を sidecar に漏らさない) と「slash 経由でも sticky になる」の両立を別 chunk で再設計したい。**現 hotfix の方針と直交するので blocking ではない**。

### Note (informational)

- `console.warn` の production 残置は dev レポート § 8 で意図的と明記されており妥当。次回 PM-746 相当のクリーンアップで再評価方針も書かれている。
- E2E ケース見送りも合理 (vitest pure helper test の方が直接的に property を pin できる、E2E では SDK モック + listener タイミング制御コストが本 hotfix のスコープ超過)。

---

## 7. 最終判断と CEO への報告

### 判定: **APPROVE** (即リリース可)

- **DEC-057 整合 (= sidecar argv は session-preferences 限定維持)** という最優先確認項目は、`InputArea.tsx` の 2 系統分離 (meta 表示用 dialog fallback / sidecar argv 用 session-prefs only) が物理的に守られており **破壊なし**
- 根本原因の特定は実コードで裏付け取れた (`/model` slash と Tray Picker の非対称性、書込先の差異)
- 修正は 3 軸 (fallback 責務分離 / UserMessage defensive chain / listener guard 順) すべて妥当、副作用なし
- DEC-083 / DEC-084 / 過去 message いずれにも regression なし
- vitest 165 PASS / cargo test 182 PASS / typecheck / lint 整合
- リリース 3 ファイル整合、CHANGELOG awk pattern compatible

### CEO への申し送り

1. **本 hotfix は即リリース推奨**。Critical / Major なし。git tag `v1.44.1` push で release.yml が CHANGELOG chunk を抽出してリリース body 自動生成
2. **Minor 改善** (logger 統一 / Picker dialog → preferences 同期統一) は次回 PM 相当チャンクで別途扱う
3. **listener timing race** (新規 session 初回送信で `system:init` を miss する稀ケース) は本 hotfix で warn log 追加による検知性向上のみ。完全解消は別 chunk (listener eager 登録 / event buffering) で対処可
4. オーナー方針整合: 絵文字未使用、lucide-react のみ、既存 chat / session store 変更最小、いずれも遵守済
