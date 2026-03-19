# Git ワークフロー

## ブランチ戦略: Feature Branch Flow

個人開発 + Claude Code の開発スタイルに最適化したシンプルなブランチ戦略。

```
main（本番）
  ├── develop（開発統合）
  ├── feature/xxx（機能開発）
  ├── fix/xxx（バグ修正）
  └── hotfix/xxx（緊急修正）
```

## ブランチ運用ルール

### main ブランチ
- **用途**: 本番環境のコード（Vercel本番デプロイ対象）
- **ルール**: 直接コミット禁止、develop または hotfix からのマージのみ
- **デプロイ**: main への push で Vercel 本番に自動デプロイ

### develop ブランチ
- **用途**: 開発統合ブランチ（Vercelプレビューデプロイ対象）
- **ルール**: feature/fix ブランチからのマージ先
- **デプロイ**: develop への push で Vercel プレビューに自動デプロイ

### feature/ ブランチ
- **命名規則**: `feature/{機能名}` （例: `feature/user-auth`, `feature/payment-form`）
- **起点**: develop から作成
- **マージ先**: develop
- **用途**: 新機能の開発

### fix/ ブランチ
- **命名規則**: `fix/{修正内容}` （例: `fix/login-error`, `fix/responsive-layout`）
- **起点**: develop から作成
- **マージ先**: develop
- **用途**: バグ修正

### hotfix/ ブランチ
- **命名規則**: `hotfix/{修正内容}` （例: `hotfix/security-patch`）
- **起点**: main から作成
- **マージ先**: main と develop の両方
- **用途**: 本番環境の緊急修正

## コミットメッセージ規約

### フォーマット
```
{type}: {簡潔な説明}

{詳細な説明（必要な場合）}
```

### Type 一覧
| Type | 用途 |
|------|------|
| `feat` | 新機能追加 |
| `fix` | バグ修正 |
| `docs` | ドキュメント変更 |
| `style` | コードフォーマット（機能に影響しない変更） |
| `refactor` | リファクタリング |
| `test` | テスト追加・修正 |
| `chore` | ビルド設定、依存関係の更新等 |
| `perf` | パフォーマンス改善 |

### 例
```
feat: ユーザー認証機能を追加
fix: ログインフォームのバリデーションエラーを修正
docs: API仕様書を更新
```

## リポジトリ初期化チェックリスト

新規案件のリポジトリを作成する際:
- [ ] GitHub にリポジトリを作成（Private）
- [ ] `.gitignore` を設定（Next.js テンプレート）
- [ ] `main` ブランチを保護設定
- [ ] `develop` ブランチを作成
- [ ] Vercel プロジェクトと連携
- [ ] 環境変数を設定
- [ ] README.md にプロジェクト概要を記載

## GitHub管理タイミング
- モック・プロトタイプが完成した段階でGitHubリポジトリを作成
- それ以前のプロトタイピング段階ではローカルで管理してもよい
