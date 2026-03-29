# Phase 2 完了報告書

## プロジェクト: PRJ-003 VLM Extractor
## フェーズ: Phase 2 (高精度抽出 + フィードバックループ)
## 作成日: 2026-03-26

---

## 実装機能一覧

### Week 5: カスケード抽出
- T-5.1: カスケード抽出 API設計・型定義
- T-5.2: Stage 2 高精度VLM抽出エンジン
- T-5.3: Chain-of-Thought (CoT) プロンプト
- T-5.4: 信頼度スコア改善・閾値設定
- T-5.5: 手動確認フラグUI・カスケード結果表示
- T-5.6: カスケード設定UI
- T-5.7: 抽出パイプライン統合 (カスケード対応)
- T-5.8: カスケード抽出ユニットテスト

### Week 6: マルチモデル対応
- T-6.1: Anthropicプロバイダー実装
- T-6.2: Googleプロバイダー実装
- T-6.3: Ollama接続設定・モデル一覧
- T-6.4: AIモデル設定UI拡張 (マルチプロバイダー)
- T-6.5: モデルフォールバック機構
- T-6.6: コスト管理ダッシュボード
- T-6.7: マルチモデル統合テスト

### Week 7: バッチ処理・エクスポート
- T-7.1: 複数PDFアップロードAPI
- T-7.2: バッチジョブ作成・実行API
- T-7.3〜T-7.8: バッチUI、キュー管理、CSV/Excelエクスポート

### Week 8: フィードバックループ
- T-8.1: 修正ログ記録強化 -- correction-logger.ts (差分検出、修正種別自動判定)
- T-8.2: Few-shot例自動蓄積 -- few-shot-accumulator.ts (承認時蓄積、上限管理、帳票種類判定)
- T-8.3: 類似帳票検索 -- embedding-generator.ts + similar-document-search.ts (pgvectorフォールバック付き)
- T-8.4: プロンプトへの動的Few-shot注入 -- few-shot-injector.ts (extraction.tsへの統合)
- T-8.5: Few-shot管理UI -- /(dashboard)/few-shot/ (一覧・詳細・有効切替・削除・統計)
- T-8.6: 修正パターン統計 -- 設定ページ内フィードバックタブ (テーブルベースの統計表示)
- T-8.7: 品質ゲート・最終調整 -- サイドバー更新、テスト追加

---

## 技術スタック

| カテゴリ | 技術 | バージョン |
|---------|------|-----------|
| フレームワーク | Next.js (App Router) | 16.2.1 |
| 言語 | TypeScript | 5.x |
| UI | shadcn/ui + Tailwind CSS | 4.x |
| DB | Supabase (PostgreSQL + pgvector) | - |
| AI SDK | Vercel AI SDK | 6.x |
| テスト | Vitest | 4.x |
| 状態管理 | TanStack React Query | 5.x |

---

## 既知の制限

### 1. pgvector埋め込み検索
- documentsテーブルにembeddingカラムが存在しない場合、ベクトル検索はスキップされる
- フォールバックとしてメタデータベース検索 (schema_id + document_type) を使用
- `match_few_shot_examples` RPCが未作成の場合もフォールバックが動作する

### 2. Few-shot蓄積条件
- 修正率50%超の結果はFew-shot蓄積対象外 (低品質判定)
- 同一document_id + schema_idの重複蓄積は防止される
- スキーマ + 帳票種類あたり最大10件 (超過時は最古を無効化)

### 3. 埋め込み生成
- OpenAI API キーが設定されていない場合、埋め込み生成はスキップ
- text-embedding-3-small (512次元) を使用
- テキスト入力は32,000文字で切り捨て

### 4. 修正パターン統計
- rechartsによるチャート表示は未実装 (テーブルベースで代替)
- リアルタイム更新ではなく、ページ表示時に取得

---

## Phase 3 推奨事項

### 高優先度
1. **pgvector RPCの作成**: `match_few_shot_examples` 関数をSupabaseに作成し、ベクトル類似度検索を有効化
2. **documentsテーブルへのembeddingカラム追加**: `ALTER TABLE documents ADD COLUMN embedding vector(512)`
3. **E2Eテスト**: カスケード抽出 -> 修正 -> 承認 -> Few-shot蓄積 -> 再抽出の全フロー検証

### 中優先度
4. **Few-shot品質評価**: 蓄積されたFew-shotの品質スコアリングと自動クリーンアップ
5. **プロンプト最適化ダッシュボード**: 修正パターンに基づくプロンプト改善提案
6. **バッチFew-shot適用**: バッチ処理時のFew-shot動的注入

### 低優先度
7. **Few-shotエクスポート/インポート**: 環境間のFew-shot移行
8. **A/Bテスト機能**: Few-shot有無での精度比較
9. **修正パターンのチャート表示**: rechartsによる視覚化

---

## テスト結果

- ユニットテスト: correction-logger.test.ts, few-shot-accumulator.test.ts を追加
- 既存テストとの共存確認: 全テスト通過を確認

---

## ファイル一覧 (Week 8 新規・変更)

### 新規ファイル
- `src/lib/feedback/correction-logger.ts`
- `src/lib/feedback/few-shot-accumulator.ts`
- `src/lib/feedback/embedding-generator.ts`
- `src/lib/feedback/similar-document-search.ts`
- `src/lib/validators/correction.ts`
- `src/lib/ai/prompts/few-shot-injector.ts`
- `src/app/api/few-shot/similar/route.ts`
- `src/app/api/feedback/stats/route.ts`
- `src/app/(dashboard)/few-shot/page.tsx`
- `src/components/few-shot/few-shot-list.tsx`
- `src/components/few-shot/few-shot-detail-dialog.tsx`
- `src/components/few-shot/few-shot-stats.tsx`
- `src/components/feedback/correction-stats.tsx`
- `src/hooks/use-few-shot.ts`
- `src/hooks/use-feedback-stats.ts`
- `src/__tests__/correction-logger.test.ts`
- `src/__tests__/few-shot-accumulator.test.ts`

### 変更ファイル
- `src/app/api/results/[id]/route.ts` -- correction-loggerに分離
- `src/app/api/results/[id]/confirm/route.ts` -- Few-shot蓄積追加
- `src/app/api/few-shot/route.ts` -- GET/POST/DELETE/PATCH実装
- `src/app/api/feedback/route.ts` -- GET実装
- `src/lib/ai/extractor.ts` -- fewShotExamplesパラメータ追加
- `src/lib/ai/prompts/extraction.ts` -- Few-shot動的注入
- `src/app/(dashboard)/settings/page.tsx` -- フィードバックタブ追加
- `src/components/layout/sidebar.tsx` -- Few-shotメニュー追加
