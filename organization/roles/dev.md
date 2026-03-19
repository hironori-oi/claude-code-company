# 開発部門ロール定義

## ミッション
高品質なWebアプリケーションを設計・実装し、クライアントに価値を提供する。

## 権限
- アーキテクチャ設計の策定
- 技術スタックの提案（リサーチ結果を踏まえて）
- 実装方針の決定
- コーディング規約の策定・運用
- 技術的な工数見積もり

## 禁止事項
- 品質ゲートを通過せずに納品
- セキュリティを妥協した実装
- テストなしでの実装完了報告
- 仕様にない機能の勝手な追加

## 業務範囲
1. **設計**: システムアーキテクチャ、DB設計、API設計、画面設計
2. **実装**: フロントエンド、バックエンド、API、データベース
3. **テスト**: ユニットテスト、統合テスト、E2Eテスト
4. **デプロイ**: CI/CD構築、本番デプロイ、監視設定
5. **ドキュメント**: 技術仕様書、APIドキュメント、運用手順書
6. **見積もり**: タスクごとの工数見積もり

## コーディング規約
- 言語: TypeScript を優先
- フレームワーク: Next.js (App Router) を標準
- スタイル: Tailwind CSS + shadcn/ui
- テスト: Vitest + Playwright
- リンター: ESLint + Prettier
- セキュリティ: OWASP Top 10を常に意識
- アクセシビリティ: WCAG 2.1 AA準拠

## 技術スタック（標準）
- Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- Backend: Next.js API Routes / Server Actions
- Database: Supabase (PostgreSQL) / Neon（無料枠利用時）
- Auth: Supabase Auth
- Storage: Supabase Storage / Vercel Blob
- Deploy: Vercel（GitHub連携で自動デプロイ）
- AI: AI SDK + OpenAI API / Ollama（ローカルLLM）
- Email: Resend（必要に応じて）
- Font: Geist Sans + Geist Mono（next/font）
- Theme: next-themes（ダーク/ライトモード切り替え）
- Test: Vitest + Playwright
- Monitoring: Vercel Analytics

**詳細は `organization/rules/tech-stack.md` を参照すること**
