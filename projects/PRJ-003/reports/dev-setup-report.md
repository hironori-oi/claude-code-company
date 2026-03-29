# PRJ-003 開発部門レポート: 初期セットアップ完了

## 報告日: 2026-03-26
## 担当: 開発部門
## フェーズ: Phase 1 Week 1 - プロジェクトセットアップ

---

## 実施内容

### 1. Next.js プロジェクト作成
- Next.js 16.2.1 (App Router, Turbopack) でプロジェクト作成
- パッケージ名: `prj-003-vlm-extractor`
- TypeScript, ESLint, Tailwind CSS v4, src/ ディレクトリ構成
- 配置先: `projects/PRJ-003/app/`

### 2. shadcn/ui セットアップ
- shadcn/ui レジストリが一時的にダウンしていたため、手動セットアップを実施
- components.json 作成済み（後日 `npx shadcn@latest add` でコンポーネント追加可能）
- 以下の21コンポーネントを手動実装:
  - button, card, input, label, select, table, dialog, tabs, toast, toaster
  - dropdown-menu, badge, separator, skeleton, tooltip, sheet, form
  - textarea, checkbox, switch, command, popover
- テーマ: ダーク/ライト切り替え対応（next-themes, CSS変数ベース, oklch色空間）
- Geist Sans + Geist Mono フォント設定済み

### 3. 追加パッケージ
| パッケージ | 用途 |
|-----------|------|
| next-themes | テーマ切り替え |
| @tanstack/react-query | データ取得・キャッシュ（PRJ-002教訓: React Query標準採用） |
| @supabase/supabase-js | DB・認証・ストレージ |
| @supabase/ssr | Next.js SSR対応 |
| ai (Vercel AI SDK) | マルチプロバイダーAI連携 |
| pdfjs-dist | PDF処理 |
| zod v4 | スキーマバリデーション |
| lucide-react | アイコン |
| date-fns | 日付処理 |
| papaparse | CSVパース |
| xlsx | Excelエクスポート |
| react-hook-form + @hookform/resolvers | フォーム管理 |
| Radix UI各種 | UIプリミティブ |

### 4. プロジェクト構成
要件通りのディレクトリ構成を構築:
- 13ページ（Dashboard, Login, Signup, Schemas, Masters, Extract, Batch, Results, Export, Settings）
- 10 APIルート（schemas, masters, documents, extract, results, export, ai, few-shot, feedback, settings）
- 3 Provider（Theme, Query, Supabase）
- 3 レイアウトコンポーネント（Sidebar, Header, ThemeToggle）
- 型定義、Zodバリデータ完備

### 5. 共通ユーティリティ（PRJ-002教訓反映）
- `lib/api/error-handler.ts`: 構造化エラーハンドリング（apiError, withErrorHandler）
- `lib/supabase/client.ts`: ブラウザ用Supabaseクライアント
- `lib/supabase/server.ts`: サーバー用Supabaseクライアント（createServerClient）
- `lib/supabase/middleware.ts`: セッション更新ヘルパー
- `src/proxy.ts`: Next.js 16 Proxy（旧middleware.ts）

### 6. next.config.ts
- セキュリティヘッダー設定済み（HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy）
- Turbopack対応（Next.js 16デフォルト）
- Supabase Storage画像最適化設定
- sharp サーバー外部パッケージ設定

### 7. .env.local.example
- Supabase接続情報（URL, Anon Key, Service Role Key）
- AIプロバイダーAPIキー（OpenAI, Anthropic, Google）
- Ollama接続URL

### 8. DBスキーマ (supabase/schema.sql)
- 13テーブル: extraction_schemas, extraction_fields, master_datasets, master_records, documents, batch_jobs, batch_job_documents, extraction_results, correction_logs, few_shot_examples, prompt_templates, ai_model_configs, api_usage_logs
- 全テーブルにuser_idカラム（将来のマルチテナント対応）
- UNIQUE制約は全て (カラム, user_id) の複合（PRJ-002教訓）
- RLSポリシー完備（PRJ-002教訓: 初期段階でRLS設計確定）
- pgvector拡張有効化（類似帳票検索用VECTOR(512)カラム）
- updated_atトリガー関数
- 適切なインデックス設定
- Supabase Storageバケット設定（コメントとして記載）

---

## ビルド結果
- `npm run build`: 成功
- TypeScript型チェック: パス
- 全22ルート認識済み（静的12 + 動的10）
- Proxy（認証ミドルウェア）認識済み

## PRJ-002教訓の反映状況
| 教訓 | 対応状況 |
|------|---------|
| React Query標準採用 | 導入済み（@tanstack/react-query） |
| RLS初期段階設計 | schema.sqlに全テーブルRLSポリシー含む |
| UNIQUE制約複合化 | 全UNIQUE制約が (カラム, user_id) の複合 |
| エラーハンドリング統一 | error-handler.ts 初期導入済み |
| セキュリティヘッダーテンプレート | next.config.ts に設定済み |
| サーバーサイドプロキシパターン | API Routes構成で準備済み |

## 次のステップ
1. Supabase プロジェクト作成・schema.sql適用
2. 認証フロー実装（Login/Signup画面）
3. 抽出スキーマ定義UI（CRUD）の実装

---

## 備考
- Next.js 16ではmiddleware.tsがproxy.tsにリネームされたため対応済み
- Zod v4ではz.record()の引数が変更されたため対応済み（第1引数にキー型が必須）
- shadcn/uiレジストリが一時的にダウンしていたため手動セットアップ。復旧後は `npx shadcn@latest add` でコンポーネント追加可能
