# プロジェクト初期セットアップチェックリスト

## 新規案件の技術セットアップ手順

### Phase 1: プロジェクト作成
- [ ] `npx create-next-app@latest {project-name} --typescript --tailwind --eslint --app --src-dir`
- [ ] `cd {project-name}`
- [ ] `npx shadcn@latest init` （shadcn/ui 初期化）
- [ ] よく使うコンポーネントを追加:
  ```
  npx shadcn@latest add button card input label form dialog toast table tabs
  ```

### Phase 2: 基本設定
- [ ] `next-themes` をインストール（ダーク/ライトモード）
- [ ] Geist フォントの設定（`next/font`）
- [ ] ESLint / Prettier 設定の確認
- [ ] `.env.local` の作成（テンプレートから）
- [ ] `.gitignore` の確認（`.env*.local` が含まれていること）

### Phase 3: DB・認証セットアップ

#### Supabase を使う場合
- [ ] Supabase プロジェクトを作成
- [ ] `npm install @supabase/supabase-js @supabase/ssr`
- [ ] 環境変数を設定:
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  ```
- [ ] Supabase クライアント設定ファイルを作成
- [ ] 認証フローの実装（Supabase Auth）
- [ ] RLS（Row Level Security）ポリシーの設定

#### Neon を使う場合
- [ ] Neon プロジェクトを作成
- [ ] `npm install @neondatabase/serverless`
- [ ] 環境変数を設定:
  ```
  DATABASE_URL=
  ```
- [ ] ORM の設定（Prisma or Drizzle）

### Phase 4: ホスティング・デプロイ
- [ ] GitHub リポジトリを作成（Private）
- [ ] Vercel プロジェクトを作成・連携
- [ ] 環境変数を Vercel に設定
- [ ] `develop` ブランチを作成
- [ ] Vercel のプレビューデプロイを確認

### Phase 5: 追加機能（必要に応じて）
- [ ] AI機能: `npm install ai @ai-sdk/openai` （OpenAI利用時）
- [ ] メール: `npm install resend` （メール送信が必要な場合）
- [ ] ファイルアップロード: Supabase Storage or Vercel Blob の設定

### Phase 6: セキュリティ・品質基盤（必須）
- [ ] `next.config.ts` にセキュリティヘッダーを設定:
  - Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options
  - Referrer-Policy, Permissions-Policy
- [ ] API共通エラーハンドラー `apiError()` を作成（構造化JSONログ出力）
- [ ] 全APIルートに `requireAuth()` を追加
- [ ] `.env.local.example` にダミー値のみ記載（実際のキーを含めない）
- [ ] `DEPLOYMENT.md` にマイグレーション手順・環境変数・確認事項を記載

### Phase 7: パフォーマンス基盤（推奨）
- [ ] SWRキャッシュユーティリティ `storage-cache.ts` を配置
  - `cachedFetch()`: TTL内キャッシュ返却、TTL切れはAPI再取得
  - `cacheGetSync()`: useState初期値用の同期読み出し
  - `cacheInvalidateByPrefix()`: 書き込み操作時の無効化
- [ ] テナントストレージプロバイダーにプリフェッチ処理を追加
- [ ] 各ページのuseState初期値にcacheGetSync()を適用

### Phase 8: マルチテナント（該当案件のみ）
- [ ] 全テーブルに `tenant_id` カラムを追加
- [ ] RLSポリシーをテナントスコープで設定
- [ ] UNIQUE制約は必ず `(カラム, tenant_id)` の複合にする
- [ ] ストレージインターフェースをasyncで設計
- [ ] Supabase Storageバケットにテナント分離RLSを設定

## 環境変数テンプレート（.env.local.example）
```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase（使用する場合）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Neon（使用する場合）
DATABASE_URL=

# AI（使用する場合）
OPENAI_API_KEY=

# Email（使用する場合）
RESEND_API_KEY=
```
