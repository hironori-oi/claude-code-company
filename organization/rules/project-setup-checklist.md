# プロジェクト初期セットアップチェックリスト

## 【最優先ルール】作業ディレクトリの格納先

**すべての新規案件のアプリケーション実体は `projects/{案件ID}/app/` 配下に配置する。**

- Desktop 直下や workspace ルートにアプリを作らない
- `create-next-app` / `create-expo-app` / `cargo new` 等は必ず `projects/{案件ID}/app/` に `cd` してから実行する
- 複数アプリ (例: Web + モバイル + CLI) がある場合は `projects/{案件ID}/app/{web,mobile,cli}/` のように分ける
- 既に外部で作成済みのアプリを案件に取り込む場合は、以下いずれかで管理する:
  - 物理移動 (稼働中アプリでなければ推奨)
  - Git submodule 化 (独立 repo として運用する場合)
  - Windows junction / Unix symlink (稼働中で移動困難な場合の暫定措置)
- `projects/{案件ID}/app/` 直下には必ず `README.md` を置き、実体の場所・管理方式を明記する

### 新規案件作成手順 (テンプレート)
```bash
# 1. 案件ID採番後、app ディレクトリを作成
mkdir -p "projects/{案件ID}/app"
cd "projects/{案件ID}/app"

# 2. その中でアプリを生成
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
# または
npx create-expo-app@latest . --template
```

### 既存プロジェクトの app 格納チェック
- [ ] `projects/{案件ID}/app/` ディレクトリが存在する
- [ ] アプリ実体 or 実体へのポインタ (submodule/junction) が `app/` 配下にある
- [ ] `projects/{案件ID}/app/README.md` で管理方式を明記

---

## 新規案件の技術セットアップ手順

### Phase 1: プロジェクト作成
- [ ] **`mkdir -p projects/{案件ID}/app && cd projects/{案件ID}/app`** (最優先ルール参照)
- [ ] `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir`
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
- [ ] Sentry セットアップ（`npx @sentry/wizard@latest -i nextjs`）
- [ ] Vercel Analytics セットアップ（`@vercel/analytics` + `@vercel/speed-insights`）
- [ ] 詳細手順: `organization/templates/monitoring-setup-guide.md`

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
- [ ] 環境変数を Vercel に設定（Sentry 関連含む）
- [ ] `develop` ブランチを作成
- [ ] Vercel のプレビューデプロイを確認
- [ ] CI/CDテンプレートの適用（GitHub Actions / Vercel 自動デプロイ設定）

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

---

## Expo / React Native 新規案件のセットアップ手順

### Phase 1: プロジェクト作成
- [ ] `npx create-expo-app {project-name} --template` でプロジェクト生成
- [ ] `cd {project-name}`
- [ ] NativeWind セットアップ:
  ```
  npm install nativewind tailwindcss
  npx tailwindcss init
  ```
- [ ] Supabase React Native ライブラリをインストール:
  ```
  npm install @supabase/supabase-js @react-native-async-storage/async-storage
  ```

### Phase 2: 基本設定
- [ ] `app.json` / `app.config.ts` の設定（アプリ名、バージョン、バンドルID）
- [ ] `eas.json` の作成（EAS Build設定）
- [ ] ESLint / Prettier 設定の確認（Webと統一）
- [ ] TypeScript `tsconfig.json` の確認
- [ ] `.env.local` の作成（テンプレートから）
- [ ] `.gitignore` の確認（`.env*.local` を含む）
- [ ] Sentry セットアップ（`npx expo install @sentry/react-native`）
- [ ] 詳細手順: `organization/templates/monitoring-setup-guide.md`

### Phase 3: DB・認証セットアップ
- [ ] Supabase プロジェクトを作成（または既存を使用）
- [ ] 環境変数を設定（`EXPO_PUBLIC_` プレフィックス）:
  ```
  EXPO_PUBLIC_SUPABASE_URL=
  EXPO_PUBLIC_SUPABASE_ANON_KEY=
  ```
- [ ] Supabase クライアント設定ファイルを作成（React Native用）
- [ ] AsyncStorage ベースのセッション管理設定
- [ ] 認証フローの実装（Supabase Auth）
- [ ] RLSポリシーの設定

### Phase 4: EAS・デプロイ設定
- [ ] Expo CLIログイン: `npx eas login`
- [ ] EAS プロジェクト初期化: `npx eas init`
- [ ] `eas.json` でビルドプロファイル設定（preview / production）
- [ ] Apple Developer アカウント連携（本番ビルド時）
- [ ] CI/CDテンプレートの適用（EAS Build 自動化設定）
- [ ] Sentry の EAS Secrets 設定（`eas secret:create --name SENTRY_AUTH_TOKEN`）

### Phase 5: UI基盤
- [ ] NativeWind + tailwind.config.js の設定
- [ ] React Native Reusables の導入
- [ ] 基本コンポーネント（Button, Input, Card等）の整備
- [ ] テーマ管理（ダーク/ライトモード）の実装
- [ ] Expo Router のルーティング構成

### Phase 6: セキュリティ・品質基盤（必須）
- [ ] 全API呼び出しに認証トークン添付
- [ ] `.env.local.example` にダミー値のみ記載
- [ ] Supabase RLSルールの設定
- [ ] エラーバウンダリの設定（expo-router ErrorBoundary）
- [ ] `DEPLOYMENT.md` にモバイル固有手順を記載

### Phase 7: ネイティブ機能（該当案件のみ）
- [ ] カメラ/フォトライブラリ（expo-image-picker）
- [ ] 位置情報（expo-location）
- [ ] 地図表示（react-native-maps）
- [ ] プッシュ通知（expo-notifications）
- [ ] デバイス権限の説明文設定（Info.plist等）

## 環境変数テンプレート（モバイル用 .env.local.example）
```env
# App
EXPO_PUBLIC_APP_NAME=MyApp

# Supabase
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# EAS
EAS_PROJECT_ID=
```
