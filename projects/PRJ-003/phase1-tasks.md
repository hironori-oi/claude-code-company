# PRJ-003 Phase 1 詳細タスクリスト

## 文書情報

| 項目 | 内容 |
|------|------|
| 案件ID | PRJ-003 |
| 案件名 | 不定様式PDF VLMデータ抽出システム |
| Phase | Phase 1（MVP） |
| 期間 | 4週間 |
| 作成日 | 2026-03-26 |
| 作成者 | PM部門 |
| ステータス | 初版 |

## Phase 1 ゴール

単体PDFに対する基本的な抽出フローを完成させ、VLMの精度を実際の帳票で検証可能にする。

**MVP成果物**:
- 抽出スキーマの作成・編集・削除
- マスタデータ管理（CRUD、CSVインポート/エクスポート）
- 項目別マスタ照合設定（ON/OFF、照合対象マスタ選択、照合方式設定）
- PDFアップロード・プレビュー
- 単体PDF抽出（Stage 1: 軽量VLM 1モデル）
- 抽出結果の表示・インライン編集・差分追跡
- マスタ照合結果の表示（不一致フラグ、類似候補提示、マスタからの選択修正）
- CSVエクスポート（UTF-8 BOM）
- AIモデル設定（1プロバイダー: OpenAI）

---

## PRJ-002教訓の適用チェックリスト

Phase 1開発開始前に以下を確認すること:

- [ ] React Query (TanStack Query) を初期から標準採用（自前SWRキャッシュ禁止）
- [ ] schema.sqlにRLSポリシーを含めて設計（後追い禁止）
- [ ] プロジェクト初期にエラーハンドリングユーティリティを導入
- [ ] 全UNIQUE制約を `(カラム, user_id)` の複合にする
- [ ] API間のデータ形式（raw base64 vs data URL等）を仕様で明確に定義
- [ ] next.config.tsにセキュリティヘッダーテンプレートを初期適用
- [ ] 一覧画面設計時にN+1クエリを意識

---

## Week 1: プロジェクト基盤（7タスク）

### T-1.1: Next.js プロジェクトセットアップ

| 項目 | 内容 |
|------|------|
| タスク名 | Next.js プロジェクト初期セットアップ |
| 説明 | `create-next-app` でApp Router + TypeScriptプロジェクトを作成。shadcn/ui、Tailwind CSS v4、next-themes（ダーク/ライト切替）、Geist Sans + Geist Monoフォントをセットアップ。`.env.local.example` に必要な環境変数を定義 |
| 成果物 | - リポジトリ初期構成<br>- `package.json`（依存パッケージ）<br>- `tailwind.config.ts`<br>- `next.config.ts`（セキュリティヘッダー含む）<br>- `app/layout.tsx`（ThemeProvider、フォント設定）<br>- `.env.local.example` |
| 依存関係 | なし |
| 推定工数 | 2時間 |
| ステータス | [ ] |

**セットアップ詳細**:
```
依存パッケージ:
- next, react, react-dom
- typescript, @types/react, @types/node
- tailwindcss, @tailwindcss/postcss
- shadcn/ui (npx shadcn@latest init)
- next-themes
- @geist-ui/font (Geist Sans + Geist Mono)

next.config.ts セキュリティヘッダー（PRJ-002テンプレート適用）:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()
- Content-Security-Policy（適切に設定）
```

---

### T-1.2: 共通UIコンポーネント基盤

| 項目 | 内容 |
|------|------|
| タスク名 | 共通UIコンポーネント・レイアウト構築 |
| 説明 | shadcn/uiの基本コンポーネントをインストール。アプリ共通レイアウト（サイドバーナビゲーション、ヘッダー、テーマ切替ボタン）を実装。Heroiconsをアイコンライブラリとして導入 |
| 成果物 | - `components/ui/` (shadcn/ui: Button, Input, Card, Table, Dialog, Select, Tabs, Toast, Badge, DropdownMenu, Form, Label, Textarea, Separator)<br>- `components/layout/sidebar.tsx`<br>- `components/layout/header.tsx`<br>- `components/layout/app-layout.tsx`<br>- `app/(dashboard)/layout.tsx` |
| 依存関係 | T-1.1 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

**ナビゲーション構成**:
```
サイドバー:
- ダッシュボード (/)
- スキーマ管理 (/schemas)
- ドキュメント (/documents)
- 抽出 (/extract)
- 結果 (/results)
- マスタ管理 (/masters)
- 設定 (/settings)
```

---

### T-1.3: Supabase接続・認証基盤

| 項目 | 内容 |
|------|------|
| タスク名 | Supabase Auth認証基盤の実装 |
| 説明 | Supabaseプロジェクトを作成し、`@supabase/ssr` でNext.js App Routerと連携。メール/パスワード認証のログイン・サインアップ・ログアウトを実装。認証ミドルウェアによる保護ルートを設定 |
| 成果物 | - `lib/supabase/client.ts`（ブラウザ用クライアント）<br>- `lib/supabase/server.ts`（サーバー用クライアント）<br>- `lib/supabase/middleware.ts`<br>- `middleware.ts`（認証ミドルウェア）<br>- `app/(auth)/login/page.tsx`<br>- `app/(auth)/signup/page.tsx`<br>- `app/(auth)/layout.tsx` |
| 依存関係 | T-1.1 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

---

### T-1.4: DBスキーマ設計・マイグレーション（コアテーブル）

| 項目 | 内容 |
|------|------|
| タスク名 | コアテーブルのDBスキーマ設計とマイグレーション |
| 説明 | 要件定義書のDBスキーマに基づき、コアテーブル（extraction_schemas, extraction_fields, documents, extraction_results）のスキーマを設計。全テーブルにuser_idカラムを含め、RLSポリシーを同時に設計する。UNIQUE制約は全て `(カラム, user_id)` の複合にする |
| 成果物 | - `supabase/migrations/001_core_tables.sql`（テーブル定義 + RLSポリシー + インデックス） |
| 依存関係 | T-1.3 |
| 推定工数 | 4時間 |
| ステータス | [ ] |

**対象テーブル**:
```sql
-- extraction_schemas: 抽出スキーマ定義
-- extraction_fields: 抽出フィールド定義
--   master_matching_enabled, master_dataset_id, master_match_type カラム含む
-- documents: アップロードPDF
-- extraction_results: 抽出結果
--   extracted_data, corrected_data, confidence_scores (JSONB)
-- correction_logs: 修正ログ（Phase 1では記録のみ）

RLSポリシー設計:
- 全テーブルに user_id カラムを追加
- SELECT/INSERT/UPDATE/DELETE で auth.uid() = user_id を検証
- extraction_fields は schema_id 経由で extraction_schemas.user_id を検証
```

---

### T-1.5: DBスキーマ設計・マイグレーション（マスタデータテーブル）

| 項目 | 内容 |
|------|------|
| タスク名 | マスタデータ照合用テーブルのDBスキーマ設計とマイグレーション |
| 説明 | マスタデータ照合機能（M-01〜M-08）に必要なテーブル（master_datasets, master_records）を設計。extraction_fieldsとのFK関連、あいまい検索用のpg_trgmインデックスを含める |
| 成果物 | - `supabase/migrations/002_master_data_tables.sql`（テーブル定義 + RLSポリシー + インデックス + pg_trgmエクステンション） |
| 依存関係 | T-1.4 |
| 推定工数 | 2時間 |
| ステータス | [ ] |

**対象テーブル**:
```sql
-- master_datasets: マスタデータセット
--   id, name, description, user_id, created_at, updated_at
--   UNIQUE(name, user_id)

-- master_records: マスタレコード
--   id, dataset_id (FK), value, aliases (JSONB), metadata (JSONB),
--   sort_order, created_at
--   UNIQUE(dataset_id, value)

-- pg_trgm拡張: あいまい一致検索用
-- GINインデックス: master_records.value に pg_trgm GINインデックス
```

---

### T-1.6: 共通ユーティリティ

| 項目 | 内容 |
|------|------|
| タスク名 | 共通ユーティリティ・基盤ライブラリの実装 |
| 説明 | エラーハンドリングフレームワーク（PRJ-002教訓: 初期導入）、React Query設定、API応答の型定義、Zodバリデーション共通パターンを実装 |
| 成果物 | - `lib/errors.ts`（構造化エラーユーティリティ: apiError, AppError, エラーコード定義）<br>- `lib/react-query/provider.tsx`（QueryClientProvider）<br>- `lib/react-query/config.ts`（デフォルト設定）<br>- `lib/api/response.ts`（APIレスポンス型: ApiResponse<T>, PaginatedResponse<T>）<br>- `lib/validations/common.ts`（共通Zodスキーマ: UUID, pagination等）<br>- `lib/utils.ts`（cn(), formatDate(), truncate()等） |
| 依存関係 | T-1.1 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

**エラーハンドリング設計**:
```typescript
// lib/errors.ts
export class AppError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

export function apiError(
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): NextResponse;

// エラーコード: AUTH_REQUIRED, FORBIDDEN, NOT_FOUND,
// VALIDATION_ERROR, INTERNAL_ERROR, RATE_LIMITED
```

---

### T-1.7: DBスキーマ設計・マイグレーション（補助テーブル）

| 項目 | 内容 |
|------|------|
| タスク名 | 補助テーブル（AIモデル設定、プロンプト、使用量ログ等）のスキーマ設計とマイグレーション |
| 説明 | AIモデル設定、プロンプトテンプレート、API使用量ログ、Few-shot例テーブルを設計。Phase 1ではOpenAI 1プロバイダーのシード値を含める |
| 成果物 | - `supabase/migrations/003_auxiliary_tables.sql`（テーブル定義 + RLSポリシー + シードデータ） |
| 依存関係 | T-1.4 |
| 推定工数 | 2時間 |
| ステータス | [ ] |

**対象テーブル**:
```sql
-- ai_model_configs: AIモデル設定
-- prompt_templates: プロンプトテンプレート
-- api_usage_logs: API使用量ログ
-- few_shot_examples: Few-shot例（Phase 1では空、テーブルのみ作成）
-- correction_logs: 修正ログ（T-1.4で作成済みの場合はスキップ）

-- シードデータ:
--   ai_model_configs: OpenAI GPT-4o-mini (screening), GPT-4o (precision)
--   prompt_templates: デフォルトシステムプロンプト、抽出指示テンプレート
```

---

### Week 1 マイルストーン

| チェック項目 | 基準 |
|-------------|------|
| [ ] プロジェクトが `npm run dev` で起動する | エラーなしでlocalhostにアクセス可能 |
| [ ] ダーク/ライトテーマ切替が動作する | next-themesの動作確認 |
| [ ] ログイン/サインアップが動作する | Supabase Authでメール認証が完了 |
| [ ] 保護ルートが認証を要求する | 未認証ユーザーがログインページにリダイレクトされる |
| [ ] 全マイグレーションが正常に適用される | `supabase db reset` でエラーなし |
| [ ] RLSポリシーが正しく動作する | 認証ユーザーが自分のデータのみアクセスできる |
| [ ] React Queryが設定されている | QueryClientProviderがレイアウトに組み込まれている |
| [ ] エラーハンドリングユーティリティが使用可能 | apiError()でエラーレスポンスを返せる |

---

## Week 2: スキーマ定義 + マスタ管理 + PDFアップロード（8タスク）

### T-2.1: 抽出スキーマCRUD API

| 項目 | 内容 |
|------|------|
| タスク名 | 抽出スキーマのCRUD API実装 |
| 説明 | 抽出スキーマ（extraction_schemas）のCRUD APIを実装。Zodによるサーバーサイドバリデーション、React Queryフック、apiError()によるエラーハンドリングを含む |
| 成果物 | - `app/api/schemas/route.ts`（GET: 一覧, POST: 作成）<br>- `app/api/schemas/[id]/route.ts`（GET: 詳細, PUT: 更新, DELETE: 削除）<br>- `lib/validations/schema.ts`（Zodスキーマ）<br>- `hooks/use-schemas.ts`（React Queryフック: useSchemas, useSchema, useCreateSchema, useUpdateSchema, useDeleteSchema） |
| 依存関係 | T-1.4, T-1.6 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

---

### T-2.2: 抽出フィールド定義CRUD API

| 項目 | 内容 |
|------|------|
| タスク名 | 抽出フィールド定義のCRUD API実装 |
| 説明 | 抽出フィールド（extraction_fields）のCRUD + 並び替えAPIを実装。マスタ照合設定（master_matching_enabled, master_dataset_id, master_match_type）のフィールドを含む |
| 成果物 | - `app/api/schemas/[id]/fields/route.ts`（GET: 一覧, POST: 追加）<br>- `app/api/schemas/[id]/fields/[fieldId]/route.ts`（PUT: 更新, DELETE: 削除）<br>- `app/api/schemas/[id]/fields/reorder/route.ts`（PUT: 並び替え）<br>- `lib/validations/field.ts`（Zodスキーマ）<br>- `hooks/use-fields.ts`（React Queryフック） |
| 依存関係 | T-2.1 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

---

### T-2.3: スキーマ管理UI

| 項目 | 内容 |
|------|------|
| タスク名 | 抽出スキーマ管理画面の実装 |
| 説明 | スキーマ一覧表示（カード形式）、新規作成ダイアログ、編集、削除確認の画面を実装 |
| 成果物 | - `app/(dashboard)/schemas/page.tsx`（スキーマ一覧）<br>- `components/schemas/schema-card.tsx`<br>- `components/schemas/create-schema-dialog.tsx`<br>- `components/schemas/edit-schema-dialog.tsx`<br>- `components/schemas/delete-schema-dialog.tsx` |
| 依存関係 | T-2.1, T-1.2 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

---

### T-2.4: フィールド定義UI

| 項目 | 内容 |
|------|------|
| タスク名 | 抽出フィールド定義画面の実装 |
| 説明 | スキーマ詳細画面でフィールドの追加・編集・削除・並び替えを行うUI。データ型選択、バリデーションルール設定、必須/任意、ヘッダー/テーブルグループ設定、マスタ照合ON/OFF・照合対象マスタ選択・照合方式（完全一致/部分一致/あいまい一致）の設定を含む |
| 成果物 | - `app/(dashboard)/schemas/[id]/page.tsx`（スキーマ詳細・フィールド定義）<br>- `components/fields/field-list.tsx`（ドラッグ並び替え対応）<br>- `components/fields/field-form-dialog.tsx`（フィールド追加/編集ダイアログ）<br>- `components/fields/field-row.tsx`<br>- `components/fields/master-matching-config.tsx`（マスタ照合設定パネル） |
| 依存関係 | T-2.2, T-2.3, T-2.6（マスタAPI） |
| 推定工数 | 5時間 |
| ステータス | [ ] |

**フィールド定義UI仕様**:
```
フォーム項目:
- 表示名（display_name）
- フィールドキー（field_key）: 英数字+アンダースコア
- データ型（data_type）: テキスト/数値/日付/金額/電話番号/郵便番号/メール/選択肢
- グループ（group_type）: ヘッダー項目 / テーブル項目
- 必須（is_required）: ON/OFF
- 説明文（description）: VLMへの補足指示
- バリデーションルール（validation_rules）: データ型に応じた入力
- マスタ照合（master_matching_enabled）: ON/OFF
  - ONの場合: 照合対象マスタデータセット選択（ドロップダウン）
  - ONの場合: 照合方式選択（完全一致/前方一致/後方一致/部分一致/あいまい一致）
```

---

### T-2.5: マスタデータCRUD API

| 項目 | 内容 |
|------|------|
| タスク名 | マスタデータセット・マスタレコードのCRUD API実装 |
| 説明 | マスタデータセット（master_datasets）とマスタレコード（master_records）のCRUD API、CSVインポート/エクスポートAPI、照合実行APIを実装 |
| 成果物 | - `app/api/masters/route.ts`（GET: 一覧, POST: 作成）<br>- `app/api/masters/[id]/route.ts`（GET: 詳細, PUT: 更新, DELETE: 削除）<br>- `app/api/masters/[id]/records/route.ts`（GET: レコード一覧, POST: レコード追加）<br>- `app/api/masters/[id]/records/[recordId]/route.ts`（PUT: 更新, DELETE: 削除）<br>- `app/api/masters/[id]/import/route.ts`（POST: CSVインポート）<br>- `app/api/masters/[id]/export/route.ts`（GET: CSVエクスポート）<br>- `app/api/masters/match/route.ts`（POST: 照合実行）<br>- `lib/validations/master.ts`（Zodスキーマ）<br>- `hooks/use-masters.ts`（React Queryフック） |
| 依存関係 | T-1.5, T-1.6 |
| 推定工数 | 5時間 |
| ステータス | [ ] |

**照合API仕様**:
```
POST /api/masters/match
Request:
{
  "value": "カブシキガイシャ テスト",
  "dataset_id": "uuid",
  "match_type": "fuzzy",  // exact | prefix | suffix | partial | fuzzy
  "limit": 5              // 候補の最大件数
}

Response:
{
  "exact_match": null,
  "candidates": [
    { "id": "uuid", "value": "株式会社テスト", "similarity": 0.85, "aliases": [...] },
    { "id": "uuid", "value": "株式会社テスト商会", "similarity": 0.72, "aliases": [...] }
  ]
}
```

---

### T-2.6: マスタデータ管理UI

| 項目 | 内容 |
|------|------|
| タスク名 | マスタデータ管理画面の実装 |
| 説明 | マスタデータセット一覧、新規作成、マスタレコードの一覧・追加・編集・削除、CSVインポート/エクスポートの画面を実装 |
| 成果物 | - `app/(dashboard)/masters/page.tsx`（マスタデータセット一覧）<br>- `app/(dashboard)/masters/[id]/page.tsx`（マスタレコード管理）<br>- `components/masters/dataset-card.tsx`<br>- `components/masters/create-dataset-dialog.tsx`<br>- `components/masters/record-table.tsx`（マスタレコード一覧テーブル）<br>- `components/masters/record-form-dialog.tsx`（レコード追加/編集）<br>- `components/masters/csv-import-dialog.tsx`（CSVインポート）<br>- `components/masters/csv-export-button.tsx` |
| 依存関係 | T-2.5, T-1.2 |
| 推定工数 | 5時間 |
| ステータス | [ ] |

**CSVインポート仕様**:
```
CSVフォーマット:
value,aliases,metadata
"株式会社テスト","(株)テスト;テスト社","{""tel"":""03-1234-5678""}"

- ヘッダー行必須
- value列は必須
- aliases列はセミコロン区切り（JSONBに変換）
- metadata列はJSON文字列（省略可）
- エンコーディング: UTF-8 BOM / UTF-8 / Shift_JIS を自動判定
```

---

### T-2.7: PDFアップロードAPI

| 項目 | 内容 |
|------|------|
| タスク名 | PDFアップロード・ドキュメント管理APIの実装 |
| 説明 | PDFファイルをSupabase Storageにアップロードし、documentsテーブルにメタデータを保存するAPI。PDF種類判定（テキスト/画像/混在）、ページ数取得を含む。データ形式はraw base64を標準とし、data URLは使用しない（PRJ-002教訓） |
| 成果物 | - `app/api/documents/upload/route.ts`（POST: PDFアップロード）<br>- `app/api/documents/route.ts`（GET: ドキュメント一覧）<br>- `app/api/documents/[id]/route.ts`（GET: 詳細, DELETE: 削除）<br>- `app/api/documents/[id]/preview/route.ts`（GET: PDFプレビューデータ取得）<br>- `lib/pdf/analyzer.ts`（PDF種類判定、ページ数取得）<br>- `lib/validations/document.ts`（Zodスキーマ）<br>- `hooks/use-documents.ts`（React Queryフック） |
| 依存関係 | T-1.4, T-1.6 |
| 推定工数 | 4時間 |
| ステータス | [ ] |

**データ形式の契約（PRJ-002教訓）**:
```
- Storage保存: Supabase Storageのファイルパス
- プレビューAPI: raw base64を返却（data:プレフィックスなし）
- クライアント側: 受け取ったraw base64にプレフィックスを付与して表示
- この契約をlib/pdf/constants.tsに明文化する
```

---

### T-2.8: PDFアップロード・プレビューUI

| 項目 | 内容 |
|------|------|
| タスク名 | PDFアップロード画面・プレビューコンポーネントの実装 |
| 説明 | ドラッグ&ドロップ対応のPDFアップロード画面、アップロード済みドキュメント一覧、PDFプレビューコンポーネント（pdfjs-dist使用）を実装 |
| 成果物 | - `app/(dashboard)/documents/page.tsx`（ドキュメント一覧 + アップロード）<br>- `components/documents/upload-dropzone.tsx`（ドラッグ&ドロップ）<br>- `components/documents/document-list.tsx`<br>- `components/documents/document-card.tsx`<br>- `components/documents/pdf-preview.tsx`（pdfjs-distによるPDFビューア）<br>- `lib/pdf/viewer.ts`（PDFビューアヘルパー） |
| 依存関係 | T-2.7, T-1.2 |
| 推定工数 | 4時間 |
| ステータス | [ ] |

---

### Week 2 マイルストーン

| チェック項目 | 基準 |
|-------------|------|
| [ ] スキーマの作成・編集・削除が動作する | CRUD操作がUIから完了できる |
| [ ] フィールド定義の追加・編集・削除・並び替えが動作する | 全データ型、バリデーションルール、マスタ照合設定が保存される |
| [ ] マスタデータセットの作成・管理が動作する | CRUD操作がUIから完了できる |
| [ ] マスタレコードのCSVインポート/エクスポートが動作する | UTF-8 BOMのCSVで正常にインポート/エクスポートできる |
| [ ] PDFアップロードが動作する | Supabase Storageに保存され、メタデータがDBに記録される |
| [ ] PDFプレビューが表示される | pdfjs-distでPDFがレンダリングされる |
| [ ] N+1クエリが発生していない | 一覧画面で不要なAPIコールがないことを確認 |

---

## Week 3: VLM抽出エンジン（7タスク）

### T-3.1: AIモデル設定API・UI

| 項目 | 内容 |
|------|------|
| タスク名 | AIモデル設定のAPI・管理画面実装 |
| 説明 | AIモデル設定（ai_model_configs）のCRUD API・UI。Phase 1ではOpenAIのみ対応。APIキーはサーバーサイドのみで保持（サーバーサイドプロキシパターン）。接続テスト機能を含む |
| 成果物 | - `app/api/settings/ai-models/route.ts`（GET/PUT）<br>- `app/api/ai/test-connection/route.ts`（POST: 接続テスト）<br>- `app/(dashboard)/settings/page.tsx`（設定画面）<br>- `components/settings/ai-model-config.tsx`<br>- `lib/ai/provider.ts`（AIプロバイダー抽象化） |
| 依存関係 | T-1.7 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

---

### T-3.2: PDF種類自動判定・ページ分割

| 項目 | 内容 |
|------|------|
| タスク名 | PDF種類自動判定とページ分割処理の実装 |
| 説明 | pdfjs-distを使用してPDF種類（テキスト/画像/混在）を自動判定。マルチページPDFのページ単位分割。テキストPDFの場合はテキストレイヤーからテキストを抽出 |
| 成果物 | - `lib/pdf/classifier.ts`（PDF種類判定: テキスト密度による分類）<br>- `lib/pdf/splitter.ts`（ページ分割処理）<br>- `lib/pdf/text-extractor.ts`（テキストPDFのテキスト抽出） |
| 依存関係 | T-2.7 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

**PDF種類判定ロジック**:
```
1. pdfjs-distでPDFを読み込み
2. 各ページのテキストコンテンツを取得
3. テキスト密度を算出:
   - 高密度（テキスト文字数 > 100/ページ）→ テキストPDF
   - 低密度（テキスト文字数 < 10/ページ）→ 画像PDF
   - 中間 → 混在PDF
4. 結果をdocuments.pdf_typeに保存
```

---

### T-3.3: 画像前処理パイプライン

| 項目 | 内容 |
|------|------|
| タスク名 | 画像前処理パイプラインの実装 |
| 説明 | sharpを使用した画像前処理パイプライン。PDF→画像変換（pdf-to-img）、DPI調整（300DPI）、コントラスト強調、シャープネス、PNGロスレス出力を実装 |
| 成果物 | - `lib/pdf/image-processor.ts`（画像前処理パイプライン）<br>- `lib/pdf/pdf-to-image.ts`（PDF→画像変換） |
| 依存関係 | T-3.2 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

**前処理パイプライン**:
```
PDF → pdf-to-img(300DPI) → sharp処理:
  1. リサイズ（最大幅2048px、アスペクト比維持）
  2. コントラスト強調（linear: true）
  3. シャープネス（sharpen()）
  4. PNG出力（ロスレス）
→ base64エンコード → VLMに送信
```

---

### T-3.4: VLM抽出コア（Stage 1: 構造化出力）

| 項目 | 内容 |
|------|------|
| タスク名 | VLM抽出エンジンのコア実装（Stage 1） |
| 説明 | Vercel AI SDKを使用し、Stage 1の軽量VLMスクリーニングを実装。抽出スキーマからZodスキーマを動的生成し、構造化出力（JSON Schema強制）で抽出。各フィールドの信頼度スコア（自己申告）も含めて出力。Phase 1ではOpenAI GPT-4o-miniを使用 |
| 成果物 | - `lib/ai/extractor.ts`（VLM抽出エンジン本体）<br>- `lib/ai/schema-to-zod.ts`（extraction_fieldsからZodスキーマを動的生成）<br>- `lib/ai/prompts/system.ts`（システムプロンプト）<br>- `lib/ai/prompts/extraction.ts`（抽出指示テンプレート）<br>- `app/api/extract/route.ts`（POST: 単体抽出実行）<br>- `app/api/ai/extract/route.ts`（POST: VLM抽出プロキシ） |
| 依存関係 | T-3.1, T-3.3, T-2.2 |
| 推定工数 | 6時間 |
| ステータス | [ ] |

**構造化出力の設計**:
```typescript
// lib/ai/schema-to-zod.ts
// extraction_fieldsの定義から動的にZodスキーマを生成

// 入力: extraction_fields[]
// 出力: z.object({
//   header: z.object({
//     [field_key]: z.object({
//       value: z.string() | z.number() | ...,
//       confidence: z.number().min(0).max(1),
//       raw_text: z.string().optional(),
//     }),
//     ...
//   }),
//   table: z.array(z.object({
//     [field_key]: z.object({
//       value: z.string() | z.number() | ...,
//       confidence: z.number().min(0).max(1),
//       raw_text: z.string().optional(),
//     }),
//     ...
//   })),
// })
```

**システムプロンプト構成**:
```
あなたは日本語帳票のデータ抽出専門家です。
提供された帳票画像から、指定されたフィールドの値を正確に抽出してください。

ルール:
- 日本語の帳票に特化して処理してください
- 和暦（令和、平成等）は西暦に変換してください
- 全角数字は半角に変換してください
- 金額のカンマや円記号は除去してください
- 値が見つからない場合はnullを返してください
- 各フィールドの信頼度（0.0〜1.0）を自己評価してください
```

---

### T-3.5: 後処理・バリデーションパイプライン

| 項目 | 内容 |
|------|------|
| タスク名 | 抽出結果の後処理・バリデーション実装 |
| 説明 | VLM抽出結果に対する後処理（データ型に応じた正規化）とバリデーション（正規表現パターン、数値範囲、日付有効性等）を実装 |
| 成果物 | - `lib/extraction/normalizer.ts`（データ型別正規化: 和暦→西暦、全角→半角、カンマ除去等）<br>- `lib/extraction/validator.ts`（バリデーション: 正規表現、数値範囲、日付有効性）<br>- `lib/extraction/pipeline.ts`（後処理パイプライン統合） |
| 依存関係 | T-3.4 |
| 推定工数 | 4時間 |
| ステータス | [ ] |

**正規化ルール実装**:
```typescript
// lib/extraction/normalizer.ts
const normalizers: Record<DataType, (value: string) => string> = {
  text: (v) => v.trim().replace(/\s+/g, ' '),
  number: (v) => toHalfWidth(v).replace(/[,，]/g, ''),
  date: (v) => convertWareki(v) || parseDate(v),  // YYYY-MM-DD形式に統一
  amount: (v) => toHalfWidth(v).replace(/[,，円¥￥]/g, ''),
  phone: (v) => formatPhone(toHalfWidth(v)),       // XXX-XXXX-XXXX形式
  postal_code: (v) => formatPostal(toHalfWidth(v)), // XXX-XXXX形式
  email: (v) => v.trim().toLowerCase(),
  choice: (v) => v.trim(),
};
```

---

### T-3.6: マスタ照合パイプライン

| 項目 | 内容 |
|------|------|
| タスク名 | マスタデータ照合パイプラインの実装 |
| 説明 | 抽出結果に対してフィールドごとにマスタ照合を実行。完全一致/部分一致/あいまい一致（レーベンシュタイン距離、pg_trgm）の照合ロジック。照合結果（一致/不一致、候補リスト）を抽出結果に付与 |
| 成果物 | - `lib/extraction/master-matcher.ts`（マスタ照合エンジン）<br>- `lib/extraction/fuzzy-match.ts`（あいまい一致ユーティリティ: レーベンシュタイン距離）<br>- 後処理パイプライン（T-3.5）への統合 |
| 依存関係 | T-3.5, T-2.5 |
| 推定工数 | 4時間 |
| ステータス | [ ] |

**照合ロジック**:
```typescript
// lib/extraction/master-matcher.ts
interface MatchResult {
  field_key: string;
  original_value: string;
  match_status: 'matched' | 'unmatched' | 'skipped';
  matched_record?: { id: string; value: string; similarity: number };
  candidates?: { id: string; value: string; similarity: number }[];
}

// 照合フロー:
// 1. フィールドのmaster_matching_enabledを確認
// 2. OFFならskipped
// 3. ONなら指定のmaster_dataset_idからレコードを取得
// 4. master_match_typeに応じた照合を実行:
//    - exact: value === record.value || record.aliases.includes(value)
//    - prefix/suffix/partial: LIKE検索
//    - fuzzy: pg_trgm similarity() またはレーベンシュタイン距離
// 5. 一致あり → matched + matched_record
// 6. 一致なし → unmatched + 類似候補（上位5件）
```

---

### T-3.7: 抽出フロー統合・単体抽出画面

| 項目 | 内容 |
|------|------|
| タスク名 | 単体抽出フローの統合と抽出実行画面の実装 |
| 説明 | PDF選択 → スキーマ選択 → 抽出実行 → 結果保存の一連のフローを統合。抽出実行画面のUIを実装（ステップ形式: ファイル選択 → スキーマ選択 → 実行 → 結果表示） |
| 成果物 | - `app/(dashboard)/extract/page.tsx`（単体抽出画面）<br>- `components/extract/extract-wizard.tsx`（ステップウィザード）<br>- `components/extract/schema-selector.tsx`（スキーマ選択コンポーネント）<br>- `components/extract/extraction-progress.tsx`（抽出進捗表示）<br>- `hooks/use-extraction.ts`（抽出実行React Queryフック） |
| 依存関係 | T-3.4, T-3.5, T-3.6, T-2.8 |
| 推定工数 | 4時間 |
| ステータス | [ ] |

---

### Week 3 マイルストーン

| チェック項目 | 基準 |
|-------------|------|
| [ ] AIモデル設定でOpenAI APIキーを保存・接続テストができる | 接続テスト成功 |
| [ ] PDF種類の自動判定が正しく動作する | テキストPDF、画像PDF各1件で判定結果が正しい |
| [ ] 画像前処理パイプラインが動作する | 300DPI、コントラスト強調後の画像が出力される |
| [ ] VLM抽出が動作する | GPT-4o-miniで構造化出力が得られる |
| [ ] 後処理・バリデーションが動作する | 和暦→西暦変換、全角→半角変換が正しく処理される |
| [ ] マスタ照合が動作する | 完全一致/あいまい一致で照合結果が返される |
| [ ] 単体抽出フローがE2Eで動作する | PDF選択→スキーマ選択→抽出→結果保存が一連で動作 |

---

## Week 4: 結果表示 + エクスポート + 統合テスト（7タスク）

### T-4.1: 抽出結果一覧画面

| 項目 | 内容 |
|------|------|
| タスク名 | 抽出結果一覧画面の実装 |
| 説明 | 抽出結果の一覧表示（日付順、スキーマ別フィルタ、確認済み/未確認フィルタ）。各結果のサマリー（ファイル名、スキーマ名、抽出日時、信頼度平均、確認状態）を表示 |
| 成果物 | - `app/api/results/route.ts`（GET: 結果一覧）<br>- `app/(dashboard)/results/page.tsx`（結果一覧画面）<br>- `components/results/result-list.tsx`<br>- `components/results/result-card.tsx`<br>- `components/results/result-filters.tsx`<br>- `hooks/use-results.ts`（React Queryフック） |
| 依存関係 | T-3.7 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

---

### T-4.2: 抽出結果詳細・表示UI

| 項目 | 内容 |
|------|------|
| タスク名 | 抽出結果詳細画面の実装（信頼度・マスタ照合結果表示） |
| 説明 | 抽出結果の詳細表示。ヘッダー項目とテーブル項目を分けて表示。フィールドごとの信頼度を色分け表示（高:緑/中:黄/低:赤）。マスタ照合結果の表示（一致:正常/不一致:フラグ付き強調表示）。PDFサイドバイサイド表示 |
| 成果物 | - `app/api/results/[id]/route.ts`（GET: 詳細, PUT: 修正）<br>- `app/(dashboard)/results/[id]/page.tsx`（結果詳細画面）<br>- `components/results/header-fields.tsx`（ヘッダー項目表示）<br>- `components/results/table-fields.tsx`（テーブル項目表示）<br>- `components/results/confidence-badge.tsx`（信頼度バッジ）<br>- `components/results/master-match-indicator.tsx`（マスタ照合結果表示）<br>- `components/results/pdf-side-panel.tsx`（PDFサイドパネル） |
| 依存関係 | T-4.1, T-2.8 |
| 推定工数 | 5時間 |
| ステータス | [ ] |

**信頼度表示仕様**:
```
信頼度 >= 0.9: 緑バッジ（高信頼度）
信頼度 >= 0.7: 黄バッジ（中信頼度）+ 手動確認フラグ
信頼度 < 0.7:  赤バッジ（低信頼度）+ 手動確認フラグ

マスタ照合結果:
- matched: 正常表示（チェックマークアイコン）
- unmatched: 赤色ボーダー + 警告アイコン + 「マスタ不一致」ラベル
- skipped: 照合なし（通常表示）
```

---

### T-4.3: インライン編集・マスタ選択修正

| 項目 | 内容 |
|------|------|
| タスク名 | 抽出結果のインライン編集・マスタからの選択修正の実装 |
| 説明 | 各フィールドをクリックして直接編集可能なインライン編集機能。差分追跡（rawValue vs editedValue）。マスタ不一致フィールドでは類似候補をドロップダウンで表示し、選択修正可能。修正ログをcorrection_logsに記録 |
| 成果物 | - `components/results/inline-editor.tsx`（インライン編集コンポーネント）<br>- `components/results/master-candidate-selector.tsx`（マスタ候補選択ドロップダウン）<br>- `app/api/results/[id]/route.ts`（PUT: 修正保存 + correction_logs記録 -- T-4.2と同ファイル）<br>- `app/api/results/[id]/confirm/route.ts`（POST: 結果承認）<br>- `app/api/results/bulk-confirm/route.ts`（POST: 一括承認） |
| 依存関係 | T-4.2, T-2.5 |
| 推定工数 | 5時間 |
| ステータス | [ ] |

**インライン編集フロー**:
```
1. フィールドをクリック → 編集モードに切替
2. 値を編集 → Enter/Blurで確定
3. マスタ不一致の場合:
   a. 類似候補がドロップダウンで表示される
   b. 候補を選択すると値が置き換わる
   c. 手動入力も可能
4. 保存時:
   a. extraction_results.corrected_data を更新
   b. correction_logs にログを記録
   c. 差分表示（元の値 → 修正後の値）
```

---

### T-4.4: CSVエクスポート

| 項目 | 内容 |
|------|------|
| タスク名 | CSVエクスポート機能の実装 |
| 説明 | 抽出結果をCSV形式でダウンロード。エンコーディング選択（UTF-8 BOM / UTF-8 / Shift_JIS）。ヘッダー項目とテーブル項目を適切にフォーマット。修正済みの値がある場合は修正後の値を出力 |
| 成果物 | - `app/api/export/csv/route.ts`（POST: CSVエクスポート）<br>- `lib/export/csv-generator.ts`（CSV生成ユーティリティ）<br>- `lib/export/encoding.ts`（エンコーディング変換: iconv-lite使用）<br>- `components/results/export-button.tsx`（エクスポートボタン + エンコーディング選択） |
| 依存関係 | T-4.2 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

---

### T-4.5: ダッシュボード画面

| 項目 | 内容 |
|------|------|
| タスク名 | ダッシュボード画面の実装 |
| 説明 | トップページとして、最近の抽出結果サマリー、登録済みスキーマ数、ドキュメント数、クイックアクション（新規抽出、スキーマ作成）を表示 |
| 成果物 | - `app/(dashboard)/page.tsx`（ダッシュボード）<br>- `components/dashboard/recent-results.tsx`<br>- `components/dashboard/stats-cards.tsx`<br>- `components/dashboard/quick-actions.tsx` |
| 依存関係 | T-4.1, T-2.3 |
| 推定工数 | 2時間 |
| ステータス | [ ] |

---

### T-4.6: E2Eテスト・結合テスト

| 項目 | 内容 |
|------|------|
| タスク名 | E2Eテスト・結合テストの作成 |
| 説明 | Playwrightによる基本CRUDのE2Eテスト、Vitestによるユニットテスト（正規化処理、バリデーション、マスタ照合）。請求書サンプル10種での抽出テスト実施 |
| 成果物 | - `tests/e2e/auth.spec.ts`（認証フロー）<br>- `tests/e2e/schema-crud.spec.ts`（スキーマCRUD）<br>- `tests/e2e/master-crud.spec.ts`（マスタデータCRUD）<br>- `tests/e2e/extraction-flow.spec.ts`（抽出フロー）<br>- `tests/unit/normalizer.test.ts`（正規化処理）<br>- `tests/unit/validator.test.ts`（バリデーション）<br>- `tests/unit/master-matcher.test.ts`（マスタ照合）<br>- `tests/fixtures/`（テスト用PDFサンプル） |
| 依存関係 | T-4.3, T-4.4 |
| 推定工数 | 6時間 |
| ステータス | [ ] |

**テスト観点**:
```
E2Eテスト:
- ログイン → スキーマ作成 → フィールド追加 → PDF抽出 → 結果確認 → CSVエクスポート
- マスタデータ作成 → CSVインポート → マスタ照合付き抽出 → 不一致の修正

ユニットテスト:
- 和暦→西暦変換（令和, 平成, 昭和）
- 全角→半角変換
- 金額正規化（カンマ、円記号）
- 電話番号フォーマット
- マスタ照合（完全一致、部分一致、あいまい一致）

抽出テスト:
- 請求書10種（異なるフォーマット）での抽出精度検証
- 精度目標: 80%以上（フィールド単位の正解率）
```

---

### T-4.7: 品質ゲート確認・最終調整

| 項目 | 内容 |
|------|------|
| タスク名 | Phase 1品質ゲート確認と最終調整 |
| 説明 | Phase 1の全品質ゲート項目を確認。不合格項目の修正。レビュー部門への検収依頼準備。Vercelデプロイの確認 |
| 成果物 | - 品質ゲートチェックリスト（全項目合格）<br>- バグ修正・UI調整<br>- Vercelデプロイ成功確認<br>- `projects/PRJ-003/reports/phase1-completion.md`（Phase 1完了報告書） |
| 依存関係 | T-4.6 |
| 推定工数 | 4時間 |
| ステータス | [ ] |

---

### Week 4 マイルストーン（Phase 1 品質ゲート）

| チェック項目 | 基準 |
|-------------|------|
| [ ] 基本CRUDのE2Eテスト合格 | 全E2Eテストがグリーン |
| [ ] 請求書10種での抽出テスト実施 | 精度目標80%以上 |
| [ ] セキュリティヘッダー設定完了 | next.config.tsの全ヘッダーが適用済み |
| [ ] RLSポリシー動作確認 | 認証ユーザーが自分のデータのみアクセスできることを検証 |
| [ ] マスタ照合フローが動作する | 照合ON→不一致検出→候補提示→選択修正の一連のフロー |
| [ ] CSVエクスポートが動作する | UTF-8 BOMで正しくエクスポートされる |
| [ ] Vercelデプロイが成功する | 本番URLでアクセス可能 |
| [ ] レビュー部門の検収依頼準備完了 | 検収依頼書ドラフト作成 |

---

## タスクサマリー

### 全タスク一覧

| Week | タスクID | タスク名 | 推定工数 | 依存関係 |
|------|---------|---------|---------|---------|
| 1 | T-1.1 | Next.js プロジェクトセットアップ | 2h | - |
| 1 | T-1.2 | 共通UIコンポーネント基盤 | 3h | T-1.1 |
| 1 | T-1.3 | Supabase接続・認証基盤 | 3h | T-1.1 |
| 1 | T-1.4 | DBスキーマ（コアテーブル） | 4h | T-1.3 |
| 1 | T-1.5 | DBスキーマ（マスタデータテーブル） | 2h | T-1.4 |
| 1 | T-1.6 | 共通ユーティリティ | 3h | T-1.1 |
| 1 | T-1.7 | DBスキーマ（補助テーブル） | 2h | T-1.4 |
| 2 | T-2.1 | 抽出スキーマCRUD API | 3h | T-1.4, T-1.6 |
| 2 | T-2.2 | 抽出フィールド定義CRUD API | 3h | T-2.1 |
| 2 | T-2.3 | スキーマ管理UI | 3h | T-2.1, T-1.2 |
| 2 | T-2.4 | フィールド定義UI | 5h | T-2.2, T-2.3, T-2.6 |
| 2 | T-2.5 | マスタデータCRUD API | 5h | T-1.5, T-1.6 |
| 2 | T-2.6 | マスタデータ管理UI | 5h | T-2.5, T-1.2 |
| 2 | T-2.7 | PDFアップロードAPI | 4h | T-1.4, T-1.6 |
| 2 | T-2.8 | PDFアップロード・プレビューUI | 4h | T-2.7, T-1.2 |
| 3 | T-3.1 | AIモデル設定API・UI | 3h | T-1.7 |
| 3 | T-3.2 | PDF種類自動判定・ページ分割 | 3h | T-2.7 |
| 3 | T-3.3 | 画像前処理パイプライン | 3h | T-3.2 |
| 3 | T-3.4 | VLM抽出コア（Stage 1） | 6h | T-3.1, T-3.3, T-2.2 |
| 3 | T-3.5 | 後処理・バリデーション | 4h | T-3.4 |
| 3 | T-3.6 | マスタ照合パイプライン | 4h | T-3.5, T-2.5 |
| 3 | T-3.7 | 抽出フロー統合・単体抽出画面 | 4h | T-3.4, T-3.5, T-3.6, T-2.8 |
| 4 | T-4.1 | 抽出結果一覧画面 | 3h | T-3.7 |
| 4 | T-4.2 | 抽出結果詳細・表示UI | 5h | T-4.1, T-2.8 |
| 4 | T-4.3 | インライン編集・マスタ選択修正 | 5h | T-4.2, T-2.5 |
| 4 | T-4.4 | CSVエクスポート | 3h | T-4.2 |
| 4 | T-4.5 | ダッシュボード画面 | 2h | T-4.1, T-2.3 |
| 4 | T-4.6 | E2Eテスト・結合テスト | 6h | T-4.3, T-4.4 |
| 4 | T-4.7 | 品質ゲート確認・最終調整 | 4h | T-4.6 |

### 工数サマリー

| Week | タスク数 | 合計工数 |
|------|---------|---------|
| Week 1 | 7 | 19h |
| Week 2 | 8 | 32h |
| Week 3 | 7 | 27h |
| Week 4 | 7 | 28h |
| **合計** | **29** | **106h** |

### 依存関係図（クリティカルパス）

```
T-1.1 ─┬─ T-1.2 ──────────────────── T-2.3 ── T-2.4
        │                                        │
        ├─ T-1.3 ── T-1.4 ─┬─ T-1.5 ── T-2.5 ── T-2.6
        │                   │                     │
        │                   ├─ T-1.7 ── T-3.1 ────┤
        │                   │                     │
        ├─ T-1.6 ──────────┼─ T-2.1 ── T-2.2 ───┤
        │                   │                     │
        │                   ├─ T-2.7 ── T-2.8 ────┤
        │                   │     │               │
        │                   │     T-3.2 ── T-3.3  │
        │                   │              │      │
        │                   │         T-3.4 ──────┤
        │                   │              │      │
        │                   │         T-3.5 ──────┤
        │                   │              │      │
        │                   │         T-3.6 ──────┤
        │                   │              │      │
        │                   │         T-3.7 ──────┤
        │                   │              │      │
        │                   │         T-4.1 ──────┤
        │                   │              │      │
        │                   │    T-4.2 ── T-4.3   │
        │                   │         │           │
        │                   │    T-4.4 T-4.5      │
        │                   │         │           │
        │                   │    T-4.6 ───────────┘
        │                   │         │
        │                   │    T-4.7
```

**クリティカルパス**: T-1.1 → T-1.3 → T-1.4 → T-2.1 → T-2.2 → T-3.4 → T-3.5 → T-3.6 → T-3.7 → T-4.1 → T-4.2 → T-4.3 → T-4.6 → T-4.7

---

## リスク管理

| リスク | 影響度 | 対策 |
|--------|--------|------|
| VLM抽出精度がPhase 1目標（80%）に達しない | 高 | Week 3前半でサンプル帳票での精度検証を早期実施。プロンプト改善の余地を確保 |
| sharp/pdf-to-imgのVercelデプロイ互換性 | 中 | Week 3序盤で早期にVercel環境でのビルド・動作確認 |
| pg_trgmのSupabase対応 | 低 | Supabaseはpg_trgmをサポート済み。万一の場合はアプリケーション側でレーベンシュタイン距離を計算 |
| Week 2のタスク密度が高い（32h） | 中 | T-2.4（フィールド定義UI）はマスタ照合設定を簡略化し、Week 3に一部移動可能 |

---

## 備考

- Phase 1ではOpenAI 1プロバイダーのみ対応。マルチプロバイダー（Anthropic/Google/Ollama）はPhase 2で実装
- Phase 1ではStage 1（軽量VLM）のみ実装。Stage 2（高精度VLM）はPhase 2で実装
- Phase 1ではバッチ処理は対象外。単体PDF抽出のみ
- Phase 1ではFew-shot例の動的選択は対象外。テーブルのみ作成し、Phase 2で実装
- マスタ照合機能（M-01〜M-08）はPhase 1スコープに含める（DEC-002に基づく）
