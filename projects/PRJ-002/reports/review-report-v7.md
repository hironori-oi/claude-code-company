# レビューレポート v7 - PRJ-002

**レビュー日**: 2026-03-25
**レビュー担当**: レビュー部門（品質管理）
**対象範囲**: v6以降の変更（APIキーマスキング、監視エンジン安定化、配布管理改善、グローバル読取パターン、LLMモデル条件表示 等）

---

## エグゼクティブサマリー

v7はセキュリティ（APIキーマスキング）、安定性（監視エンジンのインスタンス管理）、UX（配布トグル方式、LLMモデル条件表示）の3領域で改善が行われた。全体的にコード品質は良好で、Critical指摘は1件。APIキー編集時の入力フィールドが`type="text"`である点はセキュリティ上の懸念があり修正が必要。それ以外はMajor 2件、Minor 3件であり、修正後リリース可と判断する。

---

## 指摘事項

### Critical (1件)

#### C-1: APIキー編集フィールドが `type="text"` で平文表示される
- **ファイル**: `src/components/settings/ai-model-settings.tsx` L171
- **内容**: APIキー入力中の`<Input type="text">`により、入力値がスクリーン上で平文表示される。ショルダーハッキングや画面共有時の漏洩リスクがある。
- **修正案**: `type="password"` に変更する。入力中に目のアイコンで表示/非表示を切り替えるトグルを追加してもよい。

### Major (2件)

#### M-1: watch-profile-list.tsx で `engine` 変数がシャドーイングされている
- **ファイル**: `src/components/watch/watch-profile-list.tsx` L62-74, L151
- **内容**: コンポーネント上部で `useRef` + `useMemo` により安定化した `engine` を定義しているが、`profiles.map()` コールバック内（L151）で `const engine = getWatchEngine()` を再度呼び出している。これにより:
  - 外部の安定化された `engine`（folderHandles を保持）がシャドーイングされる
  - `getWatchEngine()` が引数なしで呼ばれるためグローバルフォールバックインスタンスが返り、テナント固有のストレージが使われない
  - `isRunning` の判定が安定化エンジンとは別インスタンスに対して行われ、不正確になる可能性がある
- **修正案**: L151の `const engine = getWatchEngine()` を削除し、外部スコープの安定化された `engine` を使用する。

#### M-2: `_idCounter` がモジュールレベル変数で並行呼び出し時に競合する
- **ファイル**: `src/components/admin/distribution-manager.tsx` L341-353
- **内容**: `_idCounter` はモジュールスコープのミュータブル変数。`distributeToTenant` 呼び出し冒頭で `_idCounter = 0` にリセットしているが、`handleUpdateAll` で複数テナントへ連続配布する際、同期処理のため実害は限定的だが、将来的に非同期化した場合にID衝突の危険がある。
- **修正案**: `_idCounter` をリセットせず単調増加にする、または `distributeToTenant` 内でローカルカウンタを使い `uniqueId` をクロージャ化する。

### Minor (3件)

#### m-1: `maskApiKey` で短いキーの扱いが不自然
- **ファイル**: `src/components/settings/ai-model-settings.tsx` L46-51
- **内容**: キー長が12以下の場合は全桁マスクされるが、先頭5文字+末尾4文字の表示閾値と不整合（9文字以上12文字以下のキーは先頭/末尾を見せてもよいはず）。実用上OpenAI APIキーは十分長いため影響は軽微。

#### m-2: `setDistributionFlags` / `setTableDistributionFlags` が直接 localStorage を操作
- **ファイル**: `src/components/admin/distribution-manager.tsx` L452-481
- **内容**: コメントにも記載されている通り、ストレージAPIを経由せずlocalStorageを直接操作している。テナントストレージの抽象化レイヤーをバイパスしており、将来Supabase移行時に漏れやすい。既知の技術負債として追跡を推奨。

#### m-3: `ai-model-settings.tsx` で `getReadPatternSettings()` がレンダー毎に呼ばれる
- **ファイル**: `src/components/settings/ai-model-settings.tsx` L64
- **内容**: `getReadPatternSettings()` はコンポーネント本体で直接呼ばれており、レンダー毎にlocalStorageの読み取りが発生する。`useState` + `useEffect` または親からpropsで渡す方が効率的。現状のパフォーマンス影響は軽微。

---

## 良い点

1. **APIキーマスキングの設計**: 表示時にマスクし、編集時は新しい値の入力のみ受け付ける方式は、既存キーが編集フォームに露出しない点で安全な設計。`confirmApiKey` 時に空入力をスキップする防御もある。

2. **監視エンジンのインスタンス安定化**: `useRef` + `useMemo` パターンによりコンポーネントのライフサイクル中にエンジンインスタンスが維持される設計は正しい。`watch-profile-detail.tsx` でも同様のパターンが適用されており一貫性がある。

3. **`getWatchEngine` のDI対応**: `storageDeps` を受け取る設計により、テナント固有ストレージの注入が可能になっている。テスタビリティも向上。

4. **配布管理のトグルUI**: Switch + 取り消し確認ダイアログの組み合わせは、誤操作防止と操作性のバランスが良い。一括更新機能も実用的。

5. **読取パターンのグローバル設定分離**: テナント設定から完全に分離し、システム管理者のみが管理画面で制御できる設計（`isSystemAdmin && !currentTenantId` の条件）は適切。

6. **LLMモデル設定の条件表示**: OCR+LLMモード有効時のみLLMモデル選択を表示する設計は、不要な設定項目を隠してUXを改善している。OpenAI/Ollama両方のセクションで一貫適用されている。

---

## 最終判定

**条件付き承認（Conditional Approve）**

- C-1（APIキー入力フィールドのtype変更）は必須修正
- M-1（engineシャドーイング）は必須修正（データ整合性リスク）
- M-2以降は次回イテレーションでの対応可

上記2点の修正確認後、リリース可とする。
