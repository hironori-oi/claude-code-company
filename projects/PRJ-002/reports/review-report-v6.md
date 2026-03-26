# レビューレポート v6 - PRJ-002

**レビュー日**: 2026-03-25
**レビュー対象**: v5承認後の差分（テスト抽出、配布管理改善、信頼度削除、共有制御、読取パターン設定）
**レビュアー**: レビュー部門

---

## 1. エグゼクティブサマリー

v6では9項目の変更が実施された。配布管理のトグル方式への刷新（DistributionManager）、共有アイテムの編集不可制御、テスト抽出機能、読取パターンのグローバル設定、信頼度表示の全削除、BOTHモード重複修正、グルーピング表示が主な変更点である。

全体として設計意図が明確で、UIとロジックの整合性が高い。Critical指摘はなし。Major 1件、Minor 3件の指摘がある。

---

## 2. 指摘事項

### Critical: なし

### Major

#### M-1: distribution-manager.tsx - カラムID生成のタイミング衝突リスク

**ファイル**: `src/components/admin/distribution-manager.tsx` L371-413

`distributeToTenant`関数内のカラムコピー処理で、`Date.now()`ベースのIDを同期ループ内で連続生成している。カラム数が多い場合、同一ミリ秒内に複数のIDが生成され、`Math.random()`の7桁スラグのみが差別化要素となる。テーブルリージョンのcolumnMappings/columnDefsも同様。

実運用上は衝突確率が極めて低いが、既存の`generateColumnId()`や`generateMappingId()`等の専用ユーティリティが存在するため、そちらに統一すべき。

```
// 現状（L372）
const newColId = `col_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

// 推奨
import { generateColumnId } from "@/lib/storage/table-storage"
const newColId = generateColumnId()
```

### Minor

#### m-1: job-detail.tsx に信頼度参照が残存

**ファイル**: `src/components/jobs/job-detail.tsx` L209

信頼度表示はUIから全削除されたが、`job-detail.tsx`内で `confidence: extractionResult.confidence` の代入が残っている。表示には使われていないが、型定義（`job-storage.ts` L30）にも `confidence: number` が残っており、将来的な混乱の原因になりうる。表示削除と型定義の整合性を確認し、不要であれば型からも段階的に除去することを推奨。

#### m-2: test-extraction-result-view.tsx - FileResultGroup のステータス判定が不完全

**ファイル**: `src/components/admin/test-extraction-result-view.tsx` L75-97

`fileResultGroups`のuseMemoで、結果がない場合も全て `status: "succeeded"` としている。バッチエンジンの`onFileError`で失敗したファイルの情報がグルーピングに反映されず、テスト結果画面で失敗ファイルが成功として表示される可能性がある。`batchSummary`やfileProgressesの情報を組み合わせて失敗ステータスを反映すべき。

#### m-3: distribution-manager.tsx - setDistributionFlags の直接localStorage操作

**ファイル**: `src/components/admin/distribution-manager.tsx` L443-484

`setDistributionFlags`と`setTableDistributionFlags`が直接`localStorage`を操作している。`createTenantTemplateStorage`/`createTenantTableStorage`のAPIを経由すべきだが、現状のストレージAPIに`isShared`フラグを設定するメソッドがないため直接操作になっている。ストレージ層にフラグ設定メソッドを追加して抽象化を統一することを推奨。

---

## 3. 良い点

### データ整合性
- 配布ON/OFFのトグル操作で、既存コピーの削除 -> 再作成の順序が正しく実装されている（L350-360）
- カラムIDマッピングがテンプレート、フィールドマッピング、テーブルリージョンの全てで一貫して適用されている
- 配布取り消し時にcopiedTemplateId/copiedTableIdを記録に基づいて正確に削除している

### セキュリティ（共有アイテム編集不可）
- `template-list.tsx`: 共有テンプレートの編集/削除ボタンを非表示（L187-198, L209-220）
- `table-list.tsx`: 共有テーブルの編集/削除ボタンを非表示（L84-109）
- `column-editor.tsx`: `isShared`フラグでreadOnly/disabled属性を全入力に適用し、関数レベルでも早期リターン（L72, L82, L99, L108, L124）
- `template-editor.tsx`: noop系ハンドラーで共有時の操作を無効化、バナーで視覚的に閲覧専用を明示

### グローバル設定の分離
- `read-pattern-storage.ts`: テナントIDを含まないストレージキー（`pdf-extract-read-patterns`）で完全にテナントから分離
- `settings-form.tsx`: `isSystemAdmin && !currentTenantId` の条件で管理コンソール限定タブを表示（L106, L155）

### UXの質
- グルーピング表示（テナント/共有の分離）がtemplate-list、table-listの両方で統一的に実装されている
- 共有アイテムに琥珀色のボーダーとロックアイコンバッジで視覚的に区別
- DistributionManagerのSheet UIでトグル操作が直感的、取り消し時の確認ダイアログも適切
- テスト抽出のメモリ限定（非永続）設計が情報バナーで明示されている

### コード品質
- 旧`distribute-dialog`/`distribution-status`の参照が完全に除去されている（grep確認済み）
- BOTHモードの重複修正ロジック（`dedupedResults`）が`extraction-results.tsx`と`job-file-results.tsx`の両方に適用されている
- テスト抽出ページのnoop系コールバックが型安全に定義されている

---

## 4. 最終判定

**承認（条件付き）**

Major指摘1件（ID生成のユーティリティ統一）は既存ユーティリティへの置き換えのみで修正可能。Minor指摘3件は品質向上のための推奨事項であり、次回イテレーションでの対応で問題ない。

機能面・セキュリティ面・UX面いずれも設計意図通りに実装されており、リリースブロッカーとなる問題は検出されなかった。

---

| 区分 | 件数 |
|------|------|
| Critical | 0 |
| Major | 1 |
| Minor | 3 |
| **判定** | **承認（条件付き）** |
