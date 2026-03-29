# PRJ-003 Phase 1 完了報告

## 概要

不定様式PDF VLMデータ抽出システムのPhase 1（MVP）開発が完了した。
PDFアップロードからデータ抽出、結果確認・修正、エクスポートまでの一連のワークフローが動作する状態となっている。

## 実装済み機能一覧

### 認証・ユーザー管理
- Supabase Authによるメール/パスワード認証
- ログイン・サインアップページ
- 認証ミドルウェアによるルート保護

### ダッシュボード
- 統計カード（ドキュメント数、結果数、承認率等）
- 最近の抽出結果一覧
- クイックアクション

### スキーマ管理
- 抽出スキーマのCRUD
- フィールド定義（ヘッダー/テーブル、データ型、バリデーション）
- フィールドのドラッグ&ドロップ並べ替え
- マスタ照合設定（フィールド単位でのマッチング有効化）

### ドキュメント管理
- PDFアップロード（Supabase Storage）
- ドキュメント一覧・詳細
- PDFプレビュー（署名付きURL）

### データ抽出
- ウィザード形式の抽出フロー（アップロード→スキーマ選択→実行→結果確認）
- AI SDK v6 + OpenAI連携による抽出処理
- ステージ1/ステージ2の段階的抽出
- 信頼度スコア算出
- バッチジョブ（複数PDF一括処理）

### 結果管理
- 結果一覧ページ（フィルター、一括承認チェックボックス付き）
- 結果詳細ページ（PDFプレビュー並列表示）
- インライン編集（ヘッダー項目・テーブル項目）
- 変更保存ボタン（修正内容のサーバー永続化）
- 単件承認・一括承認
- 修正ログ自動記録（correction_logs）
- 信頼度バッジ表示
- マスタ照合インジケーター
- マスタ候補セレクター（実API連携・静的候補の両モード）

### マスタデータ管理
- マスタデータセットCRUD
- マスタレコードCRUD
- CSV一括インポート・エクスポート
- 照合API（exact / prefix / suffix / partial / fuzzy）

### エクスポート
- CSV出力（UTF-8 BOM / UTF-8 / Shift-JIS 対応）
- Excel出力

### Few-shot / プロンプト管理
- Few-shot例の登録API
- フィードバックAPI

### 設定
- AIモデル設定（プロバイダー/モデルID/ロール/有効/無効）

### 共通基盤
- React Query によるデータフェッチ・キャッシュ管理
- カスタムフック群（use-schemas, use-fields, use-documents, use-masters, use-results）
- Zodバリデーション（フロントエンド・バックエンド共有スキーマ）
- エラーハンドリング統一（error-handler）
- ダーク/ライトテーマ切り替え
- セキュリティヘッダー（HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control）

## 技術スタック

| カテゴリ | 技術 | バージョン |
|---------|------|-----------|
| フレームワーク | Next.js (App Router, Turbopack) | 16.2.1 |
| 言語 | TypeScript | 5.x |
| UI | shadcn/ui + Tailwind CSS | v4 |
| アイコン | lucide-react | 1.7.0 |
| 状態管理 | TanStack React Query | 5.95.2 |
| フォーム | React Hook Form + Zod | 7.72.0 / 4.3.6 |
| AI | AI SDK + @ai-sdk/openai | 6.0.138 / 3.0.48 |
| DB/Auth/Storage | Supabase | 2.100.0 |
| D&D | @dnd-kit | 6.3.1 |
| PDF | pdfjs-dist | 5.5.207 |
| CSV/Excel | papaparse / xlsx | 5.5.3 / 0.18.5 |
| テーマ | next-themes | 0.4.6 |
| テスト | Vitest | 4.1.1 |
| デプロイ | Vercel | - |

## 既知の制限事項

1. **テーブル編集のstate管理**: テーブルセルの編集はフラットキー（`fieldKey.rowIndex`）で保存しており、行の追加/削除には対応していない
2. **Fuzzy照合**: `match_master_fuzzy` RPCがSupabase側に未設定の場合、fuzzyマッチは動作しない（pg_trgm拡張の有効化とRPC関数の作成が必要）
3. **リアルタイム更新なし**: バッチジョブの進捗はポーリングまたは手動リロードが必要（Supabase Realtimeは未実装）
4. **テスト未整備**: Vitest設定はあるがテストケースが不足している
5. **PDFプレビュー**: 署名付きURLの有効期限は1時間。長時間開いたままだと期限切れになる
6. **エラーリトライ**: API呼び出しの自動リトライやオフライン対応は未実装
7. **ページネーション**: 結果一覧はサーバー側でlimit/offsetに対応済みだが、UI側のページネーションコントロールは未実装

## 次フェーズへの推奨事項

### Phase 2（優先度高）
- Playwright E2Eテスト・Vitestユニットテストの整備
- バッチジョブのリアルタイム進捗通知（Supabase Realtime）
- UIページネーションの実装
- テーブル行の追加/削除対応
- エラーバウンダリの追加

### Phase 2（優先度中）
- Fuzzyマッチ用のSupabase RPC関数セットアップ（pg_trgm）
- Few-shot学習のUI（管理画面から例を登録・管理）
- 抽出プロンプトのカスタマイズUI
- 複数ページPDFのページ別抽出結果表示
- CSV/Excelエクスポートのテンプレート機能

### Phase 3（将来）
- Ollama等ローカルLLM対応の本格化
- OCRフォールバック（画像PDF対応強化）
- マルチテナント対応
- API公開（外部システム連携）
- 監査ログ・操作履歴
- パフォーマンスモニタリング（Vercel Analytics）

## 作成日

2026-03-26
