# PRJ-003 コードレビュー: テナント管理

**実施日**: 2026-03-26
**レビュー担当**: レビュー部門
**対象**: テナントデータ分離の実装

---

## 指摘一覧

### CRITICAL

#### C1. extraction_results INSERT に tenant_id が欠落 (`/api/extract/route.ts`)
- **箇所**: line 637-658 (修正前)
- **内容**: 抽出結果の保存時に `user_id: user.id` のみ設定し、`tenant_id` が付与されていなかった。同じテナントの他メンバーが抽出結果を参照できない。
- **修正**: `ownerPayload({ tenantId, userId: user.id })` に変更。
- **ステータス**: 修正済み

#### C2. extraction_results INSERT に tenant_id が欠落 (`/lib/batch/batch-executor.ts`)
- **箇所**: line 484-504 (修正前)
- **内容**: バッチ処理でも同様に `user_id: userId` のみでテナント情報が欠落。
- **修正**: `ownerPayload` を使用して tenant_id を付与。
- **ステータス**: 修正済み

### HIGH

#### H1. resolveTenantIdFromMembership にユーザースコープの supabase 使用 (`/api/extract/route.ts`)
- **箇所**: line 46 (修正前)
- **内容**: `tenant_memberships` テーブルへのクエリにユーザースコープの supabase クライアントを使用。RLS により自身のメンバーシップが読めない可能性あり。他の全APIルートは `getAdminClient()` を使用している。
- **修正**: `getAdminClient()` に変更。
- **ステータス**: 修正済み

#### H2. Storage ダウンロードに admin client 未使用 (`/api/documents/[id]/preview/route.ts`)
- **箇所**: line 32 (修正前)
- **内容**: PDF プレビューのダウンロードにユーザースコープの `supabase.storage` を使用。ファイルはアップロード者の `user_id` フォルダに保存されるため、同テナントの他メンバーがプレビューを表示できない。`/api/extract/route.ts` と `/api/results/[id]/route.ts` では既に admin client を使用済み。
- **修正**: `getAdminClient().storage` に変更。
- **ステータス**: 修正済み

#### H3. バッチ実行時のドキュメント取得が user_id 固定 (`/lib/batch/batch-executor.ts`)
- **箇所**: line 343-348 (修正前)
- **内容**: `.eq("user_id", userId)` でドキュメントを検索しており、同テナントの他メンバーがアップロードしたドキュメントがバッチ処理対象にならない。
- **修正**: tenant_id を解決し、テナントスコープまたはユーザースコープのフィルタに変更。
- **ステータス**: 修正済み

#### H4. correction_logs INSERT に tenant_id が欠落 (`/api/results/[id]/route.ts` + `/lib/feedback/correction-logger.ts`)
- **箇所**: results/[id]/route.ts line 111-117, correction-logger.ts line 114-140 (修正前)
- **内容**: 修正ログの保存時に `tenant_id` が付与されず、`/api/feedback/route.ts` や `/api/feedback/stats/route.ts` で `applyOwnerFilter` を使ってもフィルタできない。
- **修正**: `buildCorrectionLogs` に `tenantId` パラメータを追加し、呼び出し元で resolve して渡すように変更。
- **ステータス**: 修正済み

### MEDIUM

#### M1. settings 系 GET で resolveTenantIdFromMembership 未使用
- **箇所**: `/api/settings/route.ts`, `/api/settings/confidence/route.ts`, `/api/settings/s3/route.ts`, `/api/settings/ai-models/active/route.ts`
- **内容**: これらのルートでは `getTenantIdFromRequest(request)` のみ使用しフォールバック (`resolveTenantIdFromMembership`) がない。クライアント側が常に `tenant_id` クエリパラメータを渡していればデータ取得は正常だが、パラメータが欠落した場合にユーザースコープにフォールバックする。
- **影響**: クライアント側で確実に `tenantQuery` を付与しており、現状では問題ないが、API単体テストや直接呼び出し時に意図しない動作になる可能性がある。
- **ステータス**: 未修正 (影響度を考慮し次回対応)

#### M2. api_usage_logs がユーザースコープ固定 (`/api/settings/usage/route.ts`)
- **箇所**: line 41
- **内容**: `api_usage_logs` テーブルのクエリが `.eq("user_id", user.id)` 固定。テナント内の他メンバーの使用量が集計されない。コメントに「Usage logs are always user-scoped」とあり意図的な設計の可能性あり。
- **ステータス**: 未修正 (設計意図の確認が必要)

### LOW

#### L1. findSimilarFewShots にテナントフィルタなし (`/api/extract/route.ts` line 203-207)
- **箇所**: `findSimilarFewShots` 呼び出し
- **内容**: Few-shot 検索に `schemaId` フィルタのみ使用。スキーマ自体がテナントスコープのため実質的にテナント分離されているが、明示的な tenant_id フィルタがない。
- **ステータス**: 未修正 (スキーマのRLSで実質保護済み)

---

## 確認結果サマリ

### 1. テナントデータ分離
| APIルート | GET (applyOwnerFilter) | POST (ownerPayload) | 判定 |
|-----------|----------------------|---------------------|------|
| /api/schemas | OK | OK | OK |
| /api/masters | OK | OK | OK |
| /api/documents | OK | N/A (GET/DELETE) | OK |
| /api/documents/upload | OK (dup check) | OK | OK |
| /api/results | OK | N/A (GET/PATCH) | OK |
| /api/extract | OK | **修正済み (C1)** | OK |
| /api/extract/batch | OK (GET/POST) | OK (batch_jobs) | OK |
| /api/export | OK | N/A | OK |
| /api/few-shot | OK | OK | OK |
| /api/feedback | OK | N/A (GET only) | OK |
| /api/feedback/stats | OK | N/A | OK |

### 2. クライアント側 tenant_id 伝達
全ダッシュボードページで `currentTenantId` を `?tenant_id=` として付与済み。

### 3. Storage RLS
| 箇所 | admin client 使用 | 判定 |
|------|------------------|------|
| /api/extract (download) | OK | OK |
| batch-executor (download) | OK | OK |
| /api/results/[id] (signed URL) | OK | OK |
| /api/documents/[id]/preview | **修正済み (H2)** | OK |

### 4. バッチ処理テナント対応
- モデル設定取得: OK (tenant-scoped + user-scoped fallback)
- ドキュメント取得: **修正済み (H3)**
- 結果保存: **修正済み (C2)**

### 5. 設定テナント共有
全 settings ルートで applyOwnerFilter / ownerPayload 使用済み。M1 のフォールバック欠如は軽微。

### 6. セキュリティ
- admin APIルート: 全て `requireSystemAdmin` 使用 OK
- api_key_encrypted: `/api/settings/route.ts` GET で `has_api_key` フラグに変換、生キー非露出 OK
- S3 secret_access_key: `/api/settings/s3/route.ts` GET で `has_secret_key` フラグに変換 OK

### 7. ビルド確認
- `npm run build`: 成功
