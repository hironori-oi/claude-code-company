# レビューレポート v4 - PRJ-002 PDF Extract

**レビュー日**: 2026-03-24
**レビュー担当**: レビュー部門（品質管理）
**対象バージョン**: v3後の追加実装分

---

## 1. エグゼクティブサマリー

v3レビュー後に実装された8項目（パンくずナビ、テンプレートサムネイル、テンプレート複製、PDF並列表示、アクティビティログ、テンプレート共有再設計、Select修正、バグ修正）について品質レビューを実施した。

**全体評価**: 実装品質は全般的に高い水準を維持している。共有テンプレートの配布処理はID再採番・カラムIDマッピングが正確に実装されており、overrideStorageパターンによるコンポーネント再利用も設計として適切である。一方、配布処理における参照整合性の欠如（Critical 1件）、セキュリティ上の懸念（Major 1件）、およびいくつかのデータ整合性リスクが確認されたため、修正後に再レビューを推奨する。

**判定**: 条件付き承認（Critical/Major修正後に再レビュー）

---

## 2. Critical指摘

### C-01: 共有テーブル定義削除時の参照整合性チェック欠如

**ファイル**: `src/app/admin/tables/page.tsx` (L78-86), `src/lib/storage/shared-table-storage.ts` (L68-73)

**問題**: `AdminTablesPage.handleDeleteConfirm`では`sharedTableStorage.deleteTable`を呼ぶだけで、そのテーブルを参照している共有テンプレートの存在チェックを行っていない。テーブルが削除されると、そのテーブルを参照する共有テンプレートのtableIdが孤立し、テンプレートエディタでカラム一覧が空になる。さらに、既に配布済みのテナント側テンプレートには影響しないが、管理者側の共有テンプレート管理画面で不整合が発生する。

**影響**: データ破壊。共有テンプレートが参照するテーブルが消え、以後の配布操作やテンプレート編集が正常に機能しない。

**修正案**:
1. 削除前に`sharedTemplateStorage.getAllTemplates()`を走査し、該当tableIdを参照するテンプレートが存在する場合は削除を拒否する（エラーメッセージで参照テンプレート名を表示）
2. または、カスケード削除の確認ダイアログを追加し、関連テンプレートと配布記録も同時に削除する

### C-02: 配布処理の上書き時に旧データが残留する

**ファイル**: `src/components/admin/distribute-dialog.tsx` (L100-135, L272-357)

**問題**: 配布済みテナントへの上書き配布では、`executeDistribution`が再度呼ばれるが、`distributeToTenant`は毎回新規テーブル・テンプレートを作成する。旧テーブル・旧テンプレートは削除されず、テナント側に重複データが蓄積される。配布記録は`addRecord`で追加されるだけで、旧記録の更新もない。

**影響**: テナントのストレージに孤立したテーブル定義とテンプレートが残留し、ユーザーが混乱する。localStorageの容量を不必要に消費する。

**修正案**:
1. 上書き配布時には、旧配布記録から旧テンプレートID・旧テーブルIDを特定し、テナント側の旧データを削除してから新規作成する
2. `distributionStorage`に旧テナント側のテンプレートID・テーブルIDを記録するフィールドを追加し、上書き時の追跡を可能にする

---

## 3. Major指摘

### M-01: 共有ストレージへの権限チェックがクライアントサイドのみ

**ファイル**: `src/lib/storage/shared-table-storage.ts`, `src/lib/storage/shared-template-storage.ts`, `src/lib/storage/distribution-storage.ts`

**問題**: 共有テーブル・共有テンプレート・配布記録のストレージはグローバルシングルトンとしてexportされており、`isSystemAdmin`チェックはページコンポーネント（`AdminTablesPage`, `AdminTemplatesPage`）のUI層でのみ実施されている。ストレージ層自体には権限チェックがないため、ブラウザのDevToolsから直接`sharedTableStorage`のメソッドを呼び出すことで、非管理者でもデータを操作可能。

**影響**: 現状のlocalStorage実装ではブラウザ内の操作であり実害は限定的だが、Supabase移行時にサーバーサイドの権限チェックを確実に実装する必要がある。設計方針として、ストレージインターフェースに権限チェックのフックポイントを用意しておくべき。

**修正案**: 短期的には、各共有ストレージのファクトリ関数にオプションで`authCheck`コールバックを受け取り、操作前にチェックする仕組みを追加する。長期的にはSupabase RLSで対応。

### M-02: PdfThumbnailコンポーネントのuseStateの誤用

**ファイル**: `src/components/templates/template-list.tsx` (L41-65)

**問題**: `PdfThumbnail`コンポーネントで`useState`を副作用の実行に使用している（L41の`useState(() => { ... })`）。`useState`の初期化関数はrender中に同期的に実行され、非同期処理のランチパッドとして使う意図のコードだが、これはReactのルールに反する。初期化関数内でasync関数を起動し、cancelledフラグを返しているが、これはクリーンアップ関数として機能しない（useStateの初期化関数の戻り値はstate値として解釈される）。

**影響**:
- コンポーネントがアンマウントされた後にsetStateが呼ばれる可能性がある（メモリリークやReactの警告）
- cleanupの`cancelled = true`は戻り値がstate値になるだけで、実際にはクリーンアップが機能しない
- Strict Modeで初期化関数が2回呼ばれ、サムネイル生成が重複実行される

**修正案**: `useEffect`に変更する:
```tsx
useEffect(() => {
  let cancelled = false
  async function generateThumbnail() {
    // ... 既存のロジック
  }
  generateThumbnail()
  return () => { cancelled = true }
}, [pdfData])
```

### M-03: 配布処理でのID生成にタイムスタンプ衝突リスク

**ファイル**: `src/components/admin/distribute-dialog.tsx` (L290-334)

**問題**: `distributeToTenant`内でカラムID、テーブルリージョンID、カラムマッピングIDを`Date.now()`ベースで生成している。`sharedTable.columns.map`内のloop中に複数のIDが同じミリ秒で生成されると、`Date.now()`部分が同一になる。`Math.random().toString(36).slice(2, 9)`のランダム部分で一意性は確保されるが、IDの先頭部分が同一になることでデバッグ時の可読性が低下する。

**影響**: 実運用上のID衝突確率は極めて低いが、設計として不統一（他のストレージでは`crypto.randomUUID()`を使用している箇所もある）。

**修正案**: ID生成を統一的なユーティリティ関数に集約する。既存の`generateColumnId`や`generateMappingId`を再利用する。

### M-04: パンくずナビゲーションにadmin系パスとactivityパスのラベルが未定義

**ファイル**: `src/components/layout/breadcrumb.tsx` (L7-18)

**問題**: `PATH_LABELS`に以下のパスが含まれていない:
- `/activity` (アクティビティ)
- `/admin/tables` (共有テーブル定義)
- `/admin/templates` (共有テンプレート)

これらのパスに遷移した際、パンくずにはURLセグメントがそのまま表示される（例: "admin" > "tables"）。

**影響**: UX品質の低下。ユーザーに不自然な英語のパス名が表示される。

**修正案**: `PATH_LABELS`に以下を追加:
```ts
"/activity": "アクティビティ",
"/admin": "管理コンソール",
"/admin/tables": "共有テーブル定義",
"/admin/templates": "共有テンプレート",
```

---

## 4. Minor指摘

### m-01: アクティビティログのtenantIdフィールドが空文字になるケース

**ファイル**: `src/app/extract/page.tsx` (L20)

**問題**: `currentTenantId ?? ""`で空文字をfallbackしている。テナント未選択（システム管理者のテナント外操作時）にアクティビティログが記録される場合、tenantIdが空文字になり、後の検索やフィルタリングで問題になる可能性がある。

**修正案**: テナント未選択時はアクティビティログを記録しない、または記録をスキップするガードを追加。

### m-02: ExtractionResultViewのPDF読み込みでエラーハンドリング不足

**ファイル**: `src/components/extract/extraction-result-view.tsx` (L114-145)

**問題**: `handleToggleFileExpanded`内の`FileReader.onload`にはエラーハンドリングがない。`reader.onerror`が未設定のため、ファイル読み込みに失敗した場合にサイレントに失敗し、PDFプレビューが表示されない状態になる。

**修正案**: `reader.onerror`ハンドラを追加し、エラー時にtoastで通知するか、プレビュー不可の状態を表示する。

### m-03: DistributionStatusコンポーネントでの不要な再計算

**ファイル**: `src/components/admin/distribution-status.tsx` (L32-35)

**問題**: `tenantMap`の構築がレンダリングごとに実行される。テナント数が少ない現状では問題ないが、`useMemo`でメモ化すべき。

**修正案**: `useMemo`で`tenantMap`をメモ化する。

### m-04: result-pdf-viewerのuseEffect依存配列にcurrentPageが含まれている

**ファイル**: `src/components/extract/result-pdf-viewer.tsx` (L88-95)

**問題**: ハイライトフィールドの自動ページ移動useEffectの依存配列に`currentPage`が含まれている。ページ移動時に再評価されるが、`setCurrentPage`による更新が再度effectをトリガーし、不必要な再実行が発生する（実害はないが無駄な処理）。

**修正案**: `currentPage`を依存配列から外し、`setCurrentPage`のコールバック形式で現在ページを参照するか、refで現在ページを追跡する。

### m-05: テンプレート複製ダイアログがshadcn/uiのDialogコンポーネントを使用していない

**ファイル**: `src/components/templates/template-list.tsx` (L253-301)

**問題**: 複製名入力ダイアログが独自の`div`ベースのモーダルで実装されている。アプリケーション全体では`AlertDialog`や`Dialog`コンポーネントが統一的に使用されているが、このダイアログのみ手動実装。アクセシビリティ（フォーカストラップ、aria属性）が不足している。

**修正案**: `Dialog`コンポーネントを使用して統一する。

### m-06: templateEditorのuseEffect依存配列にtableStorage/templateStorageが含まれていない

**ファイル**: `src/components/templates/template-editor.tsx` (L108-196)

**問題**: `useEffect`内で`tableStorage`を使用しているが、依存配列に含まれていない。`overrideTableStorage`が変更された場合（propsの変更）、effectが再実行されない。現状の使い方では`key={selectedTemplate.id}`でコンポーネントごと再生成されるため実害はないが、lintルール上は警告対象。

**修正案**: 依存配列に`tableStorage`を追加するか、ESLintのsuppressionコメントを付与する。

### m-07: 配布処理のsetDistributionFlagsがlocalStorageのキー名をハードコード

**ファイル**: `src/components/admin/distribute-dialog.tsx` (L364-382)

**問題**: `setDistributionFlags`関数でlocalStorageキー`pdf-extract-templates-${tenantId}`を直接参照しているが、このキー名は`template-storage.ts`の`storageKeyForTenant`関数で生成される内部実装の詳細。ストレージキーの変更時に同期が取れなくなるリスクがある。

**修正案**: `TemplateStorage`インターフェースに`isShared`/`sharedBy`を設定するメソッドを追加し、localStorageの直接操作を排除する。またはストレージキー定数を共有モジュールとしてexportする。

---

## 5. 良い点

### overrideStorageパターンの設計

`TemplateEditor`コンポーネントに`overrideTemplateStorage`/`overrideTableStorage`プロパティを導入し、テナント用と管理者用で同一コンポーネントを再利用する設計は優れている。ストレージの切り替えがpropsレベルで行えるため、テスト容易性も高い。

### 配布処理のIDマッピング実装

`distributeToTenant`関数でのカラムIDマッピング（`columnIdMap`）の実装は正確。テーブル定義のカラムID、テンプレートのfieldMappings内のcolumnId、tableRegionのcolumnMappingsのcolumnIdを全て正しく再採番している。

### アクティビティログの設計

`ActivityLogStorage`インターフェースがシンプルかつ必要十分。最大件数制御（MAX_ENTRIES = 500）、テナント分離、ダッシュボード連携が適切に実装されている。noopストレージによるテナント未選択時のfallbackも良い設計。

### パンくずナビゲーション

動的セグメント対応（ジョブ詳細のIDを短縮表示）、aria-label付きのアクセシブルな実装。AppShellへの統合もクリーン。

### ResultPdfViewerのホバー連携

フィールドIDベースのホバー連携は疎結合で良い設計。ハイライト時の自動ページ遷移も便利な機能。

### DistributeDialogのUX

テナント選択UIのチェックボックスリスト、配布済みバッジ表示、上書き確認ダイアログの3段階は適切なUXフロー。キーボード操作（Enter/Space/Escape）にも対応している。

---

## 6. 最終判定

| 項目 | 判定 |
|------|------|
| 機能完成度 | A（全8項目が実装完了） |
| データ整合性 | C（Critical 2件の修正が必要） |
| セキュリティ | B（クライアントサイド限定チェック、Supabase移行前に要設計） |
| パフォーマンス | B+（PdfThumbnailの実装修正が必要だが影響は軽微） |
| UX品質 | B+（パンくずラベル追加で改善可能） |
| コード品質 | B+（overrideStorageパターンは優秀、一部のReactアンチパターンあり） |
| **総合判定** | **条件付き承認** |

### 承認条件
1. **C-01** (共有テーブル削除時の参照整合性) を修正すること
2. **C-02** (上書き配布時の旧データ残留) を修正すること
3. **M-02** (PdfThumbnailのuseState誤用) を修正すること

上記3件を修正後、再レビューを実施する。その他のMajor/Minor指摘は次回スプリントでの対応可。

---

## 7. 修正優先度マトリクス

| 優先度 | ID | 内容 | 影響度 | 工数見積 |
|--------|-----|------|--------|----------|
| P0(即時) | C-01 | 共有テーブル削除時の参照整合性チェック | データ破壊 | 0.5h |
| P0(即時) | C-02 | 上書き配布時の旧データ削除 | データ肥大化 | 1.5h |
| P1(今週) | M-02 | PdfThumbnailのuseState→useEffect修正 | メモリリーク | 0.25h |
| P1(今週) | M-04 | パンくずラベル追加 | UX低下 | 0.25h |
| P2(次週) | M-01 | 共有ストレージの権限チェック設計 | セキュリティ | 1h |
| P2(次週) | M-03 | ID生成のユーティリティ統一 | 保守性 | 0.5h |
| P3(バックログ) | m-01 | tenantId空文字ガード | データ品質 | 0.25h |
| P3(バックログ) | m-02 | FileReaderエラーハンドリング | 堅牢性 | 0.25h |
| P3(バックログ) | m-03 | DistributionStatusのuseMemo | パフォーマンス | 0.1h |
| P3(バックログ) | m-04 | useEffect依存配列の最適化 | コード品質 | 0.1h |
| P3(バックログ) | m-05 | 複製ダイアログのコンポーネント統一 | 一貫性 | 0.5h |
| P3(バックログ) | m-06 | useEffect依存配列のlint対応 | コード品質 | 0.1h |
| P3(バックログ) | m-07 | setDistributionFlagsのlocalStorage直接操作排除 | 保守性 | 0.5h |

**合計見積工数**: 約5.25h（P0-P1: 約2.5h / P2: 約1.5h / P3: 約1.8h）

---

*レビュー部門 - PRJ-002 品質管理*
