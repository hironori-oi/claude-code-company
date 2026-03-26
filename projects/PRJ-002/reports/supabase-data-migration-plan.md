# PRJ-002: Supabase PostgreSQL データ移行計画書

**案件ID**: PRJ-002
**作成日**: 2026-03-25
**作成者**: PM部門
**ステータス**: Draft

---

## 1. エグゼクティブサマリー

PRJ-002（PDF帳票OCR/VLMデータ自動抽出システム）は現在、全ビジネスデータをlocalStorageに保存しており、認証基盤のみSupabase Auth + PostgreSQLに移行済みである。本計画は残る10種のデータストレージをSupabase PostgreSQLへ段階的に移行するものである。

### 現状

| レイヤー | 状態 |
|---------|------|
| 認証（profiles, tenants, tenant_memberships） | Supabase Auth + PostgreSQL稼働中 |
| ビジネスデータ（テーブル定義、テンプレート、ジョブ等） | localStorage（テナントIDキー分離） |
| ファイルストレージ（PDF、クロップ画像） | localStorage内base64文字列 |
| ストレージインターフェース | 抽象化済み（差し替え可能な設計） |
| DBスキーマ（schema.sql） | テーブル作成済みだが未使用 |

### 移行の目的

1. **マルチデバイス対応**: ブラウザ間でデータを共有可能にする
2. **データ永続性**: localStorage消失リスクの排除
3. **テナント分離の強化**: RLSによるDB層でのアクセス制御
4. **容量制限の解消**: localStorage上限（5-10MB）の撤廃
5. **共有機能の本格化**: サーバーサイドでの共有テーブル/テンプレート管理

### 移行方針

- Auth移行時の教訓（RLSの問題でservice_role API route方式に変更した経験）を踏まえ、**API Route + service_role方式**を採用する
- 既存のストレージインターフェース（TableStorage, TemplateStorage等）を活かし、実装を差し替える
- localStorage→Supabase自動マイグレーションを提供し、既存ユーザーのデータを保護する

---

## 2. Phase分割

### Phase 1: 基盤整備 + テーブル定義・カラム定義の移行

**スコープ**: table_definitions, column_definitions

**理由**: 他の全データ（テンプレート、ジョブ、結果）がテーブル定義に依存するため、最初に移行する必要がある。データ量が少なく、構造がシンプルなためリスクが最も低い。

**タスク**:
1. schema.sqlにtenant_idカラムを追加するマイグレーション作成
2. API Routes作成（`/api/tables`, `/api/tables/[id]/columns`）
3. Supabase版TableStorage実装（インターフェースはそのまま）
4. TenantStorageProviderでSupabase版に差し替え
5. localStorage→Supabaseマイグレーションユーティリティ作成
6. 共有テーブル定義（shared_table_definitions）のAPI Routes + ストレージ実装

**MVPの定義**: テーブル定義のCRUDがSupabase経由で動作し、既存localStorageデータが自動移行される

**品質ゲート**:
- テーブル定義のCRUD全操作がE2Eで動作すること
- テナント間のデータ分離がRLSで確認できること
- localStorage→Supabaseの自動マイグレーションが動作すること
- 既存のテンプレート機能が壊れないこと（テーブルID参照の整合性）

**推定工数**: 3日

---

### Phase 2: テンプレート + フィールドマッピングの移行

**スコープ**: templates, field_mappings, table_region_definitions, table_column_mappings

**理由**: テーブル定義の次に依存が多いコアデータ。ジョブ実行にはテンプレートが必須。

**タスク**:
1. templates, field_mappings等にtenant_idカラムを追加するマイグレーション
2. PDF base64データをSupabase Storageに移行する仕組み構築
3. API Routes作成（`/api/templates`, `/api/templates/[id]/mappings`等）
4. Supabase版TemplateStorage実装
5. テンプレート複製機能のSupabase版実装
6. 共有テンプレート（shared_templates）のAPI Routes + ストレージ実装
7. 配布記録（distributions）のAPI Routes + ストレージ実装

**MVPの定義**: テンプレートのCRUD、フィールドマッピング設定、テーブル領域定義、PDF表示がSupabase経由で動作する

**品質ゲート**:
- テンプレート作成〜マッピング設定〜PDF表示の一連の操作が動作すること
- テンプレート複製が正しく動作すること
- PDFファイルがSupabase Storageから正常に取得・表示できること
- 共有テンプレートの配布機能が動作すること

**推定工数**: 5日

---

### Phase 3: ジョブ + 抽出結果の移行

**スコープ**: extraction_jobs, extraction_results（+ extraction_files新規）

**理由**: データ量が最大となるため、パフォーマンス検証が必要。Phase 1-2が安定してから着手する。

**タスク**:
1. extraction_jobs, extraction_resultsにtenant_idカラム追加マイグレーション
2. extraction_resultsのスキーマ拡張（edit_history JSONB, processing_time_ms, cropped_image対応）
3. クロップ画像のSupabase Storage移行
4. API Routes作成（`/api/jobs`, `/api/jobs/[id]/results`）
5. Supabase版JobStorage実装
6. 一括置換・編集履歴のSupabase版実装
7. パフォーマンス最適化（ページネーション、結果のストリーミング取得）
8. レガシーマイグレーション（per-jobキー形式からの移行）

**MVPの定義**: ジョブ作成〜PDF抽出実行〜結果表示〜結果編集の全フローがSupabase経由で動作する

**品質ゲート**:
- 100ファイル以上のジョブが問題なく動作すること
- 結果の編集・一括置換が正しく動作すること
- 結果一覧のページネーションが動作すること
- クロップ画像が正常に保存・表示できること
- レスポンスタイム: 結果一覧取得が500ms以下

**推定工数**: 5日

---

### Phase 4: 設定 + 監視 + アクティビティログの移行

**スコープ**: system_settings, watch_profiles（新規テーブル）, activity_log（新規テーブル）, read_pattern_settings

**理由**: 独立性が高く、Phase 1-3に影響しない。最後に移行することでリスクを最小化。

**タスク**:
1. watch_profiles, activity_logの新規テーブル作成マイグレーション
2. system_settingsのテナント対応強化
3. API Routes作成（`/api/settings`, `/api/watch-profiles`, `/api/activity-log`）
4. Supabase版SettingsStorage実装（暗号化フィールドのサーバーサイド処理）
5. Supabase版WatchStorage実装
6. Supabase版ActivityLogStorage実装
7. グローバル読取パターン設定のSupabase対応

**MVPの定義**: 全設定、監視プロファイル、アクティビティログがSupabase経由で動作する

**品質ゲート**:
- 設定の保存・読込が正常に動作すること（暗号化フィールド含む）
- 監視プロファイルの全操作が動作すること
- アクティビティログが正常に記録・表示されること
- APIキー等の機密情報がサーバーサイドで安全に管理されていること

**推定工数**: 3日

---

### Phase 5: localStorage撤去 + クリーンアップ

**スコープ**: localStorageフォールバック除去、移行ツール最終化

**タスク**:
1. 全ストレージのlocalStorage実装コードを除去
2. マイグレーション済みフラグの管理・表示UI
3. localStorageデータのクリーンアップユーティリティ
4. オフライン時のエラーハンドリング改善
5. 総合E2Eテスト

**品質ゲート**:
- localStorage関連コードが全て除去されていること
- 新規環境で全機能が動作すること
- 移行済み環境で全機能が動作すること
- パフォーマンスベンチマーク通過

**推定工数**: 2日

---

## 3. テーブル対応マッピング表

### 3.1 localStorageキー → PostgreSQLテーブル対応

| localStorage Key | テナント分離 | PostgreSQLテーブル | schema.sql既存 | 変更内容 |
|-----------------|------------|-------------------|---------------|---------|
| `pdf-extract-tables-{tenantId}` | あり | `table_definitions` | あり | tenant_id追加, name→logicalNameマッピング |
| (columns embedded in tables) | - | `column_definitions` | あり | tenant_id不要（親テーブルで分離） |
| `pdf-extract-templates-{tenantId}` | あり | `templates` | あり | tenant_id追加, pdfData→Storage移行 |
| (fieldMappings embedded) | - | `field_mappings` | あり | sourceType列追加 |
| (tableRegion embedded) | - | `table_region_definitions` | あり | prompt列追加 |
| (columnMappings embedded) | - | `table_column_mappings` | あり | 変更なし |
| `pdf-extract-jobs-{tenantId}` | あり | `extraction_jobs` | あり | tenant_id追加, templateName列追加, CANCELLED status追加, skippedFiles追加 |
| `pdf-extract-results-{jobId}` | ジョブ経由 | `extraction_results` | あり | edit_history JSONB追加, processing_time_ms追加, cropped_image→Storage |
| `pdf-extract-settings-{tenantId}` | あり | `system_settings` | あり | tenant_id追加（keyをtenant_id:setting_nameに変更） |
| `pdf-extract-watch-profiles-{tenantId}` | あり | `watch_profiles` **新規** | なし | 新規テーブル作成 |
| `pdf-extract-activity-log-{tenantId}` | あり | `activity_log` **新規** | なし | 新規テーブル作成 |
| `pdf-extract-shared-tables` | グローバル | `shared_table_definitions` **新規** | なし | 新規テーブル作成（tenant_id=NULL or 専用テーブル） |
| `pdf-extract-shared-templates` | グローバル | `shared_templates` **新規** | なし | 新規テーブル作成 |
| `pdf-extract-distributions` | グローバル | `distributions` **新規** | なし | 新規テーブル作成 |
| `pdf-extract-read-patterns` | グローバル | `system_settings` | あり | key='global:read_patterns'として統合 |

### 3.2 schema.sqlとの差分詳細

#### 既存テーブルへの変更

```sql
-- 全テナント分離テーブルに追加
ALTER TABLE table_definitions ADD COLUMN tenant_id UUID NOT NULL REFERENCES tenants(id);
ALTER TABLE templates ADD COLUMN tenant_id UUID NOT NULL REFERENCES tenants(id);
ALTER TABLE extraction_jobs ADD COLUMN tenant_id UUID NOT NULL REFERENCES tenants(id);
ALTER TABLE system_settings ADD COLUMN tenant_id UUID REFERENCES tenants(id); -- NULLはグローバル設定

-- table_definitions: logicalName対応
-- schema.sqlのnameカラムをそのまま使用（logicalNameとしてマッピング）

-- templates: 追加カラム
ALTER TABLE templates ADD COLUMN description TEXT;
ALTER TABLE templates ADD COLUMN is_shared BOOLEAN DEFAULT false;
ALTER TABLE templates ADD COLUMN shared_by TEXT;

-- extraction_jobs: 追加カラム・制約変更
ALTER TABLE extraction_jobs ADD COLUMN tenant_id UUID NOT NULL REFERENCES tenants(id);
ALTER TABLE extraction_jobs ADD COLUMN template_name TEXT;
ALTER TABLE extraction_jobs ADD COLUMN skipped_files INTEGER DEFAULT 0;
ALTER TABLE extraction_jobs DROP CONSTRAINT extraction_jobs_status_check;
ALTER TABLE extraction_jobs ADD CONSTRAINT extraction_jobs_status_check
  CHECK (status IN ('QUEUED','RUNNING','SUCCEEDED','PARTIAL','FAILED','CANCELLED'));

-- extraction_results: 追加カラム
ALTER TABLE extraction_results ADD COLUMN edit_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE extraction_results ADD COLUMN processing_time_ms INTEGER;
ALTER TABLE extraction_results ADD COLUMN cropped_image_path TEXT; -- Storage参照

-- field_mappings: 追加カラム
ALTER TABLE field_mappings ADD COLUMN source_type TEXT DEFAULT 'field';
ALTER TABLE field_mappings ADD COLUMN table_column_index INTEGER;
ALTER TABLE field_mappings ADD COLUMN color TEXT;

-- table_region_definitions: 追加カラム
ALTER TABLE table_region_definitions ADD COLUMN prompt TEXT;

-- physical_name UNIQUE制約をテナントスコープに変更
ALTER TABLE table_definitions DROP CONSTRAINT table_definitions_physical_name_key;
ALTER TABLE table_definitions ADD CONSTRAINT table_definitions_tenant_physical_name_unique
  UNIQUE (tenant_id, physical_name);
```

#### 新規テーブル

```sql
-- watch_profiles
CREATE TABLE watch_profiles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  name              TEXT NOT NULL,
  template_id       UUID NOT NULL REFERENCES templates(id),
  template_name     TEXT NOT NULL,
  watch_mode        TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (watch_mode IN ('REALTIME','SCHEDULED')),
  input_folder_name TEXT NOT NULL,
  file_pattern      TEXT NOT NULL DEFAULT '*.pdf',
  include_subfolders BOOLEAN DEFAULT false,
  interval_minutes  INTEGER DEFAULT 30,
  auto_job_name_template TEXT DEFAULT '',
  max_retries       INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  output_format     TEXT DEFAULT 'CSV' CHECK (output_format IN ('CSV','JSON','XLSX')),
  output_folder_name TEXT DEFAULT '',
  webhook_url       TEXT DEFAULT '',
  notify_on_success BOOLEAN DEFAULT true,
  notify_on_error   BOOLEAN DEFAULT true,
  s3_enabled        BOOLEAN DEFAULT false,
  s3_config_id      TEXT DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'PAUSED' CHECK (status IN ('ACTIVE','PAUSED','ERROR')),
  last_scan_at      TIMESTAMPTZ,
  processed_files   JSONB DEFAULT '[]'::jsonb,
  total_processed   INTEGER DEFAULT 0,
  total_errors      INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- activity_log
CREATE TABLE activity_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  user_id     UUID NOT NULL,
  user_name   TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('table','template','job','setting','user','watch')),
  target_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- shared_table_definitions（共有テーブル定義）
CREATE TABLE shared_table_definitions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  physical_name TEXT NOT NULL UNIQUE,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- shared_column_definitions
CREATE TABLE shared_column_definitions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_definition_id UUID NOT NULL REFERENCES shared_table_definitions(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  physical_name       TEXT NOT NULL,
  data_type           TEXT NOT NULL,
  max_length          INTEGER,
  decimal_places      INTEGER,
  is_required         BOOLEAN DEFAULT false,
  is_nullable         BOOLEAN DEFAULT true,
  sort_order          INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- shared_templates（共有テンプレート）
CREATE TABLE shared_templates (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  description         TEXT,
  table_definition_id UUID REFERENCES shared_table_definitions(id),
  pdf_file_path       TEXT,
  pdf_file_name       TEXT,
  extraction_type     TEXT NOT NULL DEFAULT 'FIELD',
  shared_by           TEXT DEFAULT 'system',
  field_mappings      JSONB DEFAULT '[]'::jsonb,
  table_region        JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- distributions（配布記録）
CREATE TABLE distributions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id         UUID NOT NULL REFERENCES shared_templates(id),
  table_id            UUID NOT NULL REFERENCES shared_table_definitions(id),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  copied_template_id  UUID NOT NULL,
  copied_table_id     UUID NOT NULL,
  distributed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  distributed_by      UUID NOT NULL
);
```

---

## 4. RLSポリシー設計

### 4.1 設計方針

Auth移行時の教訓から、**API Route（service_role）経由のアクセスを主体**とする。RLSはセキュリティの多層防御として設定するが、クライアントサイドから直接Supabaseにアクセスするパターンは原則使わない。

### 4.2 テナント分離ポリシー

```sql
-- 既存の "authenticated_full_access" ポリシーを削除し、テナントベースに置き換え

-- テナント分離の基本パターン（table_definitions の例）
DROP POLICY IF EXISTS "authenticated_full_access" ON table_definitions;

-- SELECT: 自テナントのデータのみ参照可能
CREATE POLICY "tenant_select" ON table_definitions
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: 自テナントにのみ作成可能
CREATE POLICY "tenant_insert" ON table_definitions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- UPDATE: 自テナントのデータのみ更新可能
CREATE POLICY "tenant_update" ON table_definitions
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid()
    )
  );

-- DELETE: 自テナントのデータのみ削除可能
CREATE POLICY "tenant_delete" ON table_definitions
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid()
    )
  );
```

### 4.3 子テーブルのRLS

column_definitions, field_mappings等の子テーブルは、親テーブルのtenant_idを参照してポリシーを構成する。

```sql
-- column_definitions: 親テーブル(table_definitions)のtenant_idで制御
CREATE POLICY "tenant_select" ON column_definitions
  FOR SELECT TO authenticated
  USING (
    table_definition_id IN (
      SELECT id FROM table_definitions WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
      )
    )
  );
```

### 4.4 共有テーブル/テンプレートのRLS

```sql
-- shared_table_definitions: システム管理者のみ書き込み、全authenticated読み取り可
CREATE POLICY "shared_tables_read" ON shared_table_definitions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "shared_tables_write" ON shared_table_definitions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_system_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_system_admin = true
    )
  );

-- distributions: システム管理者のみ作成、テナントメンバーは自テナント分のみ参照
CREATE POLICY "distributions_read" ON distributions
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_system_admin = true
    )
  );
```

### 4.5 アクティビティログのRLS

```sql
-- activity_log: 自テナントのログのみ参照可能
CREATE POLICY "activity_log_tenant" ON activity_log
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships WHERE user_id = auth.uid()
    )
  );
```

### 4.6 パフォーマンス考慮

tenant_membershipsへのサブクエリが頻発するため、以下のインデックスを追加する。

```sql
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_id
  ON tenant_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_tenant
  ON tenant_memberships (user_id, tenant_id);
```

---

## 5. API設計方針

### 5.1 アーキテクチャ決定

**方式: API Route + service_role（サーバーサイド）**

| 観点 | クライアントサイド + RLS | API Route + service_role |
|------|------------------------|-------------------------|
| 実装工数 | 少 | 中 |
| RLS管理 | 複雑（全ロジックをSQL） | シンプル（コードで制御） |
| Auth移行の教訓 | RLSで問題が発生した | 安定稼働中 |
| セキュリティ | RLS依存 | 多層防御（API + RLS） |
| パフォーマンス | DB直接で速い | API経由のオーバーヘッド |
| デバッグ | 困難 | ログ/エラーハンドリング容易 |

**決定**: Auth移行で確立したAPI Route + service_roleパターンを踏襲する。RLSは多層防御として設定するが、主要なアクセス制御はAPI Route内のミドルウェアで行う。

### 5.2 API Route一覧

```
# テーブル定義
GET    /api/tables                    - テーブル一覧取得
POST   /api/tables                    - テーブル作成
GET    /api/tables/[id]               - テーブル取得
PUT    /api/tables/[id]               - テーブル更新
DELETE /api/tables/[id]               - テーブル削除
PUT    /api/tables/[id]/columns       - カラム一括設定

# テンプレート
GET    /api/templates                 - テンプレート一覧取得
POST   /api/templates                 - テンプレート作成
GET    /api/templates/[id]            - テンプレート取得
PUT    /api/templates/[id]            - テンプレート更新
DELETE /api/templates/[id]            - テンプレート削除
PUT    /api/templates/[id]/mappings   - フィールドマッピング一括設定
PUT    /api/templates/[id]/table-region - テーブル領域設定
POST   /api/templates/[id]/duplicate  - テンプレート複製
POST   /api/templates/[id]/pdf       - PDFアップロード（Supabase Storage）
GET    /api/templates/[id]/pdf       - PDF取得

# ジョブ
GET    /api/jobs                      - ジョブ一覧取得
POST   /api/jobs                      - ジョブ作成
GET    /api/jobs/[id]                 - ジョブ取得
PUT    /api/jobs/[id]                 - ジョブ更新
DELETE /api/jobs/[id]                 - ジョブ削除
GET    /api/jobs/[id]/results         - 結果取得（ページネーション対応）
POST   /api/jobs/[id]/results         - 結果保存
PUT    /api/jobs/[id]/results/[rid]   - 結果編集
POST   /api/jobs/[id]/results/reset   - 結果リセット
POST   /api/jobs/[id]/results/bulk-replace - 一括置換

# 設定
GET    /api/settings                  - 設定取得
PUT    /api/settings                  - 設定保存
POST   /api/settings/reset            - デフォルトにリセット

# 監視プロファイル
GET    /api/watch-profiles            - プロファイル一覧
POST   /api/watch-profiles            - プロファイル作成
GET    /api/watch-profiles/[id]       - プロファイル取得
PUT    /api/watch-profiles/[id]       - プロファイル更新
DELETE /api/watch-profiles/[id]       - プロファイル削除
POST   /api/watch-profiles/[id]/stats - 統計更新

# アクティビティログ
GET    /api/activity-log              - ログ取得（limit対応）
POST   /api/activity-log              - ログ記録
DELETE /api/activity-log              - ログクリア

# 共有テーブル/テンプレート（システム管理者専用）
GET    /api/shared/tables             - 共有テーブル一覧
POST   /api/shared/tables             - 共有テーブル作成
GET    /api/shared/templates          - 共有テンプレート一覧
POST   /api/shared/templates          - 共有テンプレート作成
POST   /api/shared/distribute         - テナントへ配布

# マイグレーション
POST   /api/migrate/from-localstorage - localStorage→Supabase移行
GET    /api/migrate/status            - 移行ステータス確認
```

### 5.3 認証ガード

既存の`requireSystemAdmin`パターンを拡張し、テナント認証ガードを追加する。

```typescript
// /api/auth-guard.ts に追加
export async function requireTenantMember(tenantId: string) {
  // 1. セッション検証
  // 2. tenant_memberships確認
  // 3. テナントIDの整合性チェック
}

export async function requireTenantAdmin(tenantId: string) {
  // テナント管理者権限チェック
}
```

### 5.4 Supabase Storage設計

```
bucket: pdf-extract-files
  ├── templates/{tenant_id}/{template_id}/template.pdf
  ├── results/{tenant_id}/{job_id}/{result_id}/crop.png
  └── shared/templates/{template_id}/template.pdf
```

---

## 6. 移行戦略

### 6.1 自動マイグレーション

ユーザーがログイン後にlocalStorageにデータが存在する場合、自動的にSupabaseへ移行を試みる。

```
フロー:
1. ログイン成功
2. localStorageのキー一覧をスキャン
3. テナントID付きキーが存在する場合、マイグレーションフラグを確認
4. 未移行の場合、POST /api/migrate/from-localstorage に一括送信
5. 成功後、localStorageのマイグレーション済みフラグを設定
6. UIにマイグレーション完了通知を表示
```

### 6.2 IDマッピング

localStorageのIDは`tbl_1234_abc`形式、PostgreSQLはUUID形式のため、マイグレーション時にIDマッピングテーブルを作成する。

```sql
CREATE TABLE migration_id_map (
  old_id    TEXT NOT NULL,
  new_id    UUID NOT NULL,
  entity    TEXT NOT NULL, -- 'table', 'template', 'job', etc.
  tenant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (old_id, entity, tenant_id)
);
```

移行中は外部キー参照を旧IDから新UUIDに変換し、全ての関連データの整合性を保つ。

### 6.3 フォールバック戦略

移行期間中は以下の戦略をとる:

1. **Phase 1-4実装中**: Supabase版ストレージ実装をfeature flagで切り替え可能にする
2. **移行失敗時**: localStorageからの読み取りにフォールバック
3. **ロールバック**: feature flagをOFFにすることで即座にlocalStorageに戻せる

```typescript
// feature flag
const USE_SUPABASE_STORAGE = process.env.NEXT_PUBLIC_USE_SUPABASE_STORAGE === 'true'

// TenantStorageProviderでの切り替え
const storages = useMemo(() => {
  if (USE_SUPABASE_STORAGE && currentTenantId) {
    return createSupabaseStorages(currentTenantId)
  }
  return createLocalStorages(currentTenantId)
}, [currentTenantId])
```

---

## 7. リスク一覧と対策

### 7.1 パフォーマンスリスク

| リスク | 影響度 | 対策 |
|-------|-------|------|
| localStorage即時 vs API呼び出しのレイテンシ | 高 | React Queryでキャッシュ管理。楽観的更新（optimistic update）を実装 |
| 大量結果データの取得 | 高 | ページネーション必須。1ページ100件。無限スクロール対応 |
| PDF base64データのアップロード/ダウンロード | 中 | Supabase Storage直接URL。署名付きURLでCDN活用 |
| RLSのサブクエリによるDB負荷 | 中 | tenant_membershipsのインデックス最適化。API Route主体でRLSアクセス頻度低減 |

### 7.2 データ整合性リスク

| リスク | 影響度 | 対策 |
|-------|-------|------|
| マイグレーション中のID変換失敗 | 高 | トランザクション内で全データ移行。失敗時は全ロールバック |
| テンプレート-テーブル定義間のFK参照不整合 | 高 | マイグレーション順序を厳守（テーブル定義→テンプレート→ジョブ） |
| 同時に複数デバイスからマイグレーション実行 | 中 | migration_id_mapでON CONFLICT DO NOTHING。冪等性を保証 |
| localStorageデータの破損 | 低 | JSON.parse失敗時はスキップし、ログに記録 |

### 7.3 機能リスク

| リスク | 影響度 | 対策 |
|-------|-------|------|
| オフライン対応の喪失 | 中 | Phase 5でService Worker + IndexedDBキャッシュ検討（スコープ外） |
| テンプレートPDFの容量増大 | 中 | Supabase Storageの無料枠（1GB）内に収まるか監視。超過時はプラン変更 |
| 暗号化設定のサーバーサイド移行 | 中 | API Route内でサーバーサイド暗号化に切り替え。Web Crypto→Node.js暗号化 |
| クロップ画像の大量生成 | 低 | 一定期間後に自動削除するTTLポリシー設定 |

### 7.4 運用リスク

| リスク | 影響度 | 対策 |
|-------|-------|------|
| Supabaseの無料枠超過 | 中 | データ量監視ダッシュボード。500MB到達時にアラート |
| マイグレーション中のUX劣化 | 低 | プログレスバー付きマイグレーションUI。バックグラウンド実行 |
| API Routeの追加によるVercel Functions消費 | 低 | 関連エンドポイントをまとめてhandler数を最小化 |

---

## 8. 推定工数サマリー

| Phase | 内容 | 工数 | 累計 |
|-------|------|------|------|
| Phase 1 | 基盤 + テーブル定義移行 | 3日 | 3日 |
| Phase 2 | テンプレート + マッピング移行 | 5日 | 8日 |
| Phase 3 | ジョブ + 結果移行 | 5日 | 13日 |
| Phase 4 | 設定 + 監視 + ログ移行 | 3日 | 16日 |
| Phase 5 | localStorage撤去 + クリーンアップ | 2日 | 18日 |
| **合計** | | **18日** | |

### 前提条件
- 開発者1名での実施を想定
- 各Phaseの品質ゲート確認を含む
- E2Eテスト作成を含む
- 設計変更やバグ対応のバッファは含まない（別途20%のバッファ推奨 → 実質22日）

---

## 9. 技術的決定事項

| 決定 | 理由 | 記録日 |
|------|------|-------|
| API Route + service_role方式を採用 | Auth移行時にRLS直接アクセスで問題が発生した教訓から | 2026-03-25 |
| React Queryを導入してキャッシュ管理 | localStorage即時性の代替としてoptimistic updateが必要 | 2026-03-25 |
| PDFはSupabase Storageに移行 | localStorage容量制限（5-10MB）の解消 | 2026-03-25 |
| 共有テーブル/テンプレートは専用テーブルに分離 | RLSポリシーの簡素化、テナントデータとの明確な分離 | 2026-03-25 |
| feature flagによる段階的切り替え | ロールバック可能性の確保 | 2026-03-25 |
| IDはUUIDに統一 | PostgreSQLネイティブ、既存schema.sqlとの整合性 | 2026-03-25 |

---

## 10. 次のアクション

1. **CEOへの報告**: 本計画書のレビュー依頼
2. **Phase 1着手準備**: マイグレーションSQL作成開始
3. **React Query導入**: package.jsonへの追加、基本設定
4. **feature flag設計**: 環境変数の定義、TenantStorageProviderの改修設計
