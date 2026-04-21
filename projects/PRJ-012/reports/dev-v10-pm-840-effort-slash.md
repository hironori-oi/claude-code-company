# PRJ-012 v10 PM-840 派生: `/effort` slash command 実装レポート

- **日付**: 2026-04-20
- **担当**: 開発部門
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **依頼元**: PM (PM-840 派生指示)
- **想定工数 / 実工数**: 1〜1.5h / 約 30 分

## 概要

`/effort` slash command を新設。`/model` と同等の UX で **推論工数 (thinking
tokens)** を切替できるようにした。実装は **frontend のみ** で完結（Rust /
sidecar には変更なし、PM-840 の `restartSidecarWithModel` を流用）。

## 動作仕様

- スラッシュパレット (`/`) に `/effort` を追加（builtin スコープ）
- `InputArea` で `/effort` 単独入力 → `EffortPickerDialog` を開く
- ダイアログで 5 段階（低 / 中 / 高 / 超高 / 最大）を radio 風 button で選択
- 確定時:
  - active project が **running / error** → `restartSidecarWithModel(id, runningModel ?? selectedModel, draftEffort)` で sidecar を即再起動。会話 context は PM-830 の resume で継続
  - active project が **stopped** → dialog default のみ更新、toast で「次回 Claude 起動時から反映」案内
  - active project **未選択** → dialog default のみ更新、toast で「プロジェクト選択後から反映」案内
- 確定後は `useDialogStore.setSelectedEffort` で sticky 更新（localStorage 永続化）

## Effort 値の定義場所

既存定義を流用（**新規追加なし**）。

- 型: `lib/types.ts:652` `export type EffortLevel = "low" | "medium" | "high" | "xhigh" | "max"`
- 値: `lib/types.ts:666` `export const EFFORT_CHOICES`（5 段階、各 `thinkingTokens` 付き）
  - low: 1,024 tokens / medium: 8,192 / high: 16,384 / xhigh: 32,768 / max: 65,536

依頼書では 3 段階 (low/medium/high, 4096/32768/65536) のフォールバック案が示されていたが、**既存定義が優先**との指示に従い 5 段階定義をそのまま採用。`EffortPickerPopover` (StatusBar) と完全に同じ選択肢になり UX 一貫性が保たれる。

## 作成 / 変更ファイル

### 新規作成 (1)

| File | 概要 |
|---|---|
| `components/chat/EffortPickerDialog.tsx` | `/effort` で開く効果工数選択ダイアログ。`ModelPickerDialog.tsx` を参考に同構造で実装。`EFFORT_CHOICES` 5 件を radio 表示、確定で `restartSidecarWithModel(id, runningModel ?? selectedModel, draft)` を発火。 |

### 変更 (4)

| File | 変更内容 |
|---|---|
| `lib/stores/dialog.ts` | `effortPickerOpen: boolean` / `openEffortPicker()` / `closeEffortPicker()` を `modelPickerOpen` と対称に追加。partialize は据え置き（dialog open 状態は session 限定）。 |
| `lib/builtin-slash.ts` | `BuiltinAction` union に `"open_effort_picker"` を追加。`BUILTIN_SLASH_ACTIONS["/effort"]` を追加。`dispatch()` の switch に `case "open_effort_picker"` で `dialog.openEffortPicker()` を呼ぶ分岐を追加。 |
| `components/chat/InputArea.tsx` | `EffortPickerDialog` を import し、`<ModelPickerDialog />` 直下にマウント。 |
| `components/palette/SlashPalette.tsx` | builtin merge 後に **frontend 限定**の `/effort` エントリを追加（Rust 側 `list_builtin_slashes` を変更しない方針）。Rust 取得失敗時のフォールバックでも `/effort` だけは出るよう保険を入れた。重複追加防止 (`existing` Set) で将来 backend 移管しても安全。 |

## diff 要約

```diff
# lib/stores/dialog.ts
+ effortPickerOpen: boolean;
+ openEffortPicker: () => void;
+ closeEffortPicker: () => void;
+ effortPickerOpen: false,
+ openEffortPicker: () => set({ effortPickerOpen: true }),
+ closeEffortPicker: () => set({ effortPickerOpen: false }),

# lib/builtin-slash.ts
- | "open_model_picker"
+ | "open_model_picker"
+ | "open_effort_picker"
  ...
+ "/effort": "open_effort_picker",
  ...
+ case "open_effort_picker": {
+   dialog.openEffortPicker();
+   return;
+ }

# components/chat/InputArea.tsx
+ import { EffortPickerDialog } from "@/components/chat/EffortPickerDialog";
  ...
+ <EffortPickerDialog />

# components/palette/SlashPalette.tsx
  // builtin fetch 後に frontend-only 追加分を merge
+ const frontendOnly: BuiltinSlashItem[] = [
+   { name: "/effort", description: "推論工数（thinking tokens）を切替",
+     action: "open_effort_picker", source: "builtin" as const },
+ ];
+ const merged = [...fromRust, ...frontendOnly.filter((b) => !existing.has(b.name))];
+ setBuiltinCmds(merged);
+ // catch 側でも /effort 単独 fallback を入れる
```

## 検証結果

### tsc

```
$ npx tsc --noEmit
EXIT=0
```

**0 error / 0 warning** で通過。

### 実機動作

- `/effort` で dialog が開き、確定で `restartSidecarWithModel` 発火 → 実機検証は後日 (依頼書通り)
- スラッシュパレット (`/`) を開いて `/eff` で絞り込み → `/effort` が builtin グループに表示される動線を実装

## 設計判断の補足

### 1. Rust 側 `list_builtin_slashes` を更新しなかった理由

依頼書の「**frontend のみ。Rust / sidecar には変更を入れないこと**」指示に従い、`SlashPalette.tsx` 内で Rust 取得結果に **frontend-only 追加分** を merge する形にした。

- Rust 側テスト (`list_builtin_slashes_returns_seven_items`) を壊さない
- `BUILTIN_SLASH_ACTIONS` map と `BuiltinAction` union だけが intercept の真実 → palette のメタ表示と handler は完全に独立しているので、frontend-only 追加で動作 OK
- 将来 backend に移管したい場合: Rust 側に 1 件追加して `list_builtin_slashes_returns_seven_items` を 8 件に書き換え、SlashPalette の `frontendOnly` 配列を空にすれば良い（重複防止 Set でグレースフルに移行可能）

### 2. `runningModel ?? selectedModel` を渡す理由

`restartSidecarWithModel(id, model, effort)` の `model` 引数に `null` を渡すと sidecar 起動時のデフォルト model が使われてしまう（`modelIdToSdkId(null)` → null）。
ユーザーが明示的に **effort だけ** を変えたい場合は **モデルは現状維持** したいので、`runningModel`（実態）優先、なければ dialog default の `selectedModel` を渡す。これは `EffortPickerPopover` の `modelForRestart` と同じ判定で、UX 一貫性を保つ。

### 3. ModelPickerDialog との対称性

dialog 構造は `ModelPickerDialog.tsx` のテンプレートを忠実に踏襲:
- `runningEffort` 優先 → なければ `dialogDefault` で current 表示
- draft state を dialog 開閉時にリセット
- `isRestartable` 判定 (`running` or `error`) で sidecar 再起動 vs default 更新を分岐
- 確定 toast 文言も model 版とパラレル

これにより review / メンテ時の認知コストを最小化。

## 申し送り

- **/help dialog の文言更新**: `HelpDialog.tsx` 側に `/effort` の説明追記が必要（今回のスコープ外、別タスク化推奨）
- **Rust 側 backend 移管**: 必要になったら `builtin_slash.rs:list_builtin_slashes` に `/effort` を追加し、SlashPalette の `frontendOnly` を空にする
- **e2e テスト**: `tests/e2e/slash-palette.spec.ts` に `/effort` 候補が出ることの assertion を追加すると更に安全（今回スコープ外）
- **review 確認ポイント**: `restartSidecarWithModel` 呼出経路（model パラメータが `null` にならない）、effort default 更新時の toast 文言
