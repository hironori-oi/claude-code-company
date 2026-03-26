# レビューレポート v5 - PRJ-002

**日時**: 2026-03-25
**レビュー対象**: v4指摘修正 + 共有テーブルCSVインポート機能
**レビュアー**: レビュー部門

---

## 1. 前回指摘の修正確認

### C-01: 共有テーブル削除時の参照整合性チェック -- 修正済み

`src/app/admin/tables/page.tsx` L82-93

- `sharedTemplateStorage.getAllTemplates()` で全テンプレートを取得し、`tableId` が一致するものをフィルタ
- 参照テンプレートが存在する場合、`deleteBlockedTemplates` に名前を格納し削除を阻止
- ダイアログで参照テンプレート名一覧を表示し、「先にテンプレートを削除するか別テーブルに変更」を案内
- `handleDeleteConfirm` でも `deleteBlockedTemplates.length > 0` の場合は早期リターン（二重ガード）

判定: **適切に修正済み**

### C-02: 配布済み上書き時のデータ重複 -- 修正済み

`src/lib/storage/distribution-storage.ts`
- `DistributionRecord` に `copiedTemplateId`, `copiedTableId` フィールドが追加済み（L13-14）
- `getRecord(templateId, tenantId)` メソッドが追加済み（L74-78）

`src/components/admin/distribute-dialog.tsx`
- `distributeToTenant` L282-293: 既存配布記録を `getRecord` で取得し、旧 `copiedTemplateId` / `copiedTableId` を削除してから新規コピーを作成
- 配布記録も `removeRecord` → `addRecord` で更新
- 新規配布記録に `copiedTemplateId`, `copiedTableId` を記録（L362-369）

判定: **適切に修正済み**

### M-02: PdfThumbnailのuseState副作用 -- 修正済み

`src/components/templates/template-list.tsx` L38-84

- `generatedRef` (useRef) で生成済みフラグを管理
- `useEffect` 内で非同期関数 `generateThumbnail` を定義・実行
- `cancelled` フラグによるクリーンアップで、アンマウント後のstate更新を防止
- レンダリング中の副作用（旧実装の問題）は完全に解消

判定: **適切に修正済み**

### M-04: パンくずラベル不足 -- 修正済み

`src/components/layout/breadcrumb.tsx` L7-21 の `PATH_LABELS`

- `/activity`: "アクティビティ" -- 追加済み
- `/admin/tables`: "共有テーブル定義" -- 追加済み
- `/admin/templates`: "共有テンプレート" -- 追加済み
- `/admin/tenants`, `/admin/users` も追加されている

判定: **適切に修正済み**

---

## 2. 追加変更の確認: 共有テーブルCSVインポート

### 対象ファイル
- `src/components/tables/csv-import-dialog.tsx` (新規)
- `src/components/tables/column-editor.tsx` (CSVインポートボタン追加)
- `src/app/admin/tables/page.tsx` (統合)

### 確認結果

**CsvImportDialog** (`csv-import-dialog.tsx`)
- PapaParse によるCSV解析、プレビューテーブル表示、バリデーション付き
- サンプルCSVダウンロード機能あり（BOM付きUTF-8で日本語環境対応）
- 属性バリデーション: `VALID_ATTRIBUTES` に対して検証
- 行数不足、論理名/物理名の必須チェック、エラー表示が適切
- ダイアログ閉じる時に `reset()` でステートクリア

**ColumnEditor連携** (`column-editor.tsx`)
- `onOpenCsvImport` プロップを受け取り、ボタン表示を制御
- オプショナルプロップで既存の使い方に影響なし

**AdminTablesPage統合** (`page.tsx`)
- `handleCsvImport`: インポートされたカラムを既存カラムにマージ（L112-117）
- `setCsvImportOpen` でダイアログの開閉を管理
- テーブル未選択時はCSVインポートボタンが表示されない（ColumnEditorが表示されないため）

判定: **問題なし**

---

## 3. 新規指摘

### N-01 [Low] CSVインポート時のカラム物理名重複チェック未実装

`handleCsvImport` (page.tsx L112-117) は既存カラムとインポートカラムを単純に結合している。同じ `physicalName` を持つカラムが既存にある場合、重複カラムが発生する。

**推奨**: インポート前に物理名の重複をチェックし、警告を表示するか、マージ戦略（上書き/スキップ）を選択させる。

### N-02 [Low] CSVインポートのsortOrder不整合の可能性

`CsvImportDialog` 内で `sortOrder: columns.length` を設定しているが、これはインポートされるカラム群内の相対順序。`handleCsvImport` でマージ後のsortOrderが既存カラムと連続しない可能性がある。

**推奨**: マージ後に `sortOrder` を再採番する処理を追加。

---

## 4. 最終判定

| 区分 | 件数 | 内容 |
|------|------|------|
| Critical(v4) | 2/2 修正済み | C-01, C-02 |
| Major(v4) | 2/2 修正済み | M-02, M-04 (※M-01, M-03は前回v4で確認済み前提) |
| 追加変更 | 問題なし | CSVインポート機能 |
| 新規指摘 | 2件 Low | N-01, N-02 (リリースブロッカーではない) |

### 判定: 承認 (Approved)

前回v4のCritical/Major指摘は全て適切に修正されている。追加のCSVインポート機能も基本的な品質基準を満たしている。新規指摘2件はいずれもLowレベル（エッジケースのUX改善）であり、リリースブロッカーには該当しない。後続イテレーションでの対応を推奨する。
