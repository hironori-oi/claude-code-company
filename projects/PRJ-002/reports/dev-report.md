# PRJ-002 開発レポート

## プロジェクト概要

- **案件名**: PDF帳票OCR/VLMデータ自動抽出システム
- **案件ID**: PRJ-002
- **開発期間**: 2026-03-22 ~
- **技術スタック**: Next.js 16 (App Router) + TypeScript / shadcn/ui + Tailwind CSS v4 / pdfjs-dist / Tesseract.js / AI SDK (OpenAI/Ollama) / Supabase (将来移行用) / AWS SDK S3

## アーキテクチャ

### ディレクトリ構成

```
src/
  app/                  # Next.js App Router ページ
    tables/             # テーブル定義管理
    templates/          # テンプレート管理（PDFマッピング）
    extract/            # 単一PDF抽出実行
    jobs/               # バッチジョブ管理
    watch/              # 自動監視プロファイル
    settings/           # システム設定（AIモデル、S3、CSV、Webhook）
  components/
    ui/                 # shadcn/ui 基盤コンポーネント
    layout/             # レイアウト（サイドバー等）
    tables/             # テーブル定義UI
    templates/          # テンプレートUI（PDFプレビュー、ドラッグ範囲指定）
    extract/            # 抽出結果表示・編集
    jobs/               # ジョブ一覧・詳細
    export/             # エクスポートダイアログ
    settings/           # 設定画面群
    watch/              # 監視プロファイルUI
  hooks/                # カスタムフック
  lib/
    extraction/         # 抽出エンジン群
      engine.ts         # 統合エントリポイント
      ocr-engine.ts     # Tesseract.js OCR
      ocr-llm-engine.ts # OCR + LLM補正パイプライン
      vlm-engine.ts     # VLMダイレクト抽出
      pdf-text-engine.ts# PDFテキスト抽出（pdfjs-dist）
      table-engine.ts   # テーブル抽出（罫線検出 / VLM）
      batch-engine.ts   # バッチ処理（並列制御・キャンセル）
      pdf-crop.ts       # PDF領域クロップ（OffscreenCanvas）
    storage/            # データ永続化層
      job-storage.ts    # ジョブ・結果ストレージ（localStorage、分割保存）
    export/             # エクスポート機能
      csv-generator.ts  # CSV生成（UTF-8/BOM/Shift_JIS）
      zip-generator.ts  # ZIP束ね
    s3/                 # S3連携
      s3-client.ts      # AWS SDK S3ラッパー
      s3-uploader.ts    # ジョブ結果S3アップロード
    ai/                 # AI SDK設定
    watch/              # 自動監視エンジン
    webhook/            # Webhook通知
    supabase/           # Supabase クライアント（将来用）
    utils/              # ユーティリティ
  types/
    database.ts         # 型定義（テーブル定義、テンプレート、リージョン等）
```

### データフロー図

```
[PDF Files]
     |
     v
[Template] --- 領域マッピング --- [Table Definition]
     |                                    |
     v                                    v
[Extraction Engine]                 カラム定義参照
  |-- OCR (Tesseract.js)
  |-- OCR + LLM (Tesseract + AI SDK)
  |-- VLM (AI SDK Vision)
  |-- PDF_TEXT (pdfjs-dist)
  |-- Table (罫線検出 / VLM)
     |
     v
[ExtractionResultRecord]
     |
     +---> [結果表示・編集UI]
     +---> [CSV Export] ---> ローカルDL / S3アップロード
     +---> [Webhook通知]
```

## 実装済み機能一覧

### Phase 1: コア基盤 + 単一PDF読取（MVP）
- Next.js + TypeScript プロジェクト基盤
- テーブル定義CRUD（カラム: 論理名/物理名/型/桁数/必須/NULL許容）
- CSVインポートによるテーブル定義一括登録
- テンプレート管理（PDFアップロード + プレビュー + ドラッグ範囲指定）
- 4読取パターン実装（OCR / OCR+LLM / VLM / PDF_TEXT）
- 単一PDF抽出実行・結果表示
- システム設定（AIモデル: OpenAI / Ollama 切替）

### Phase 2: テーブル取り込み + 結果編集 + エクスポート
- テーブル形式帳票抽出（LINES_FIRST / VLM_FIRST）
- セル単位のインライン結果編集 + 編集履歴追跡
- 一括値置換（文字列 / 正規表現）
- CSV出力（UTF-8 / UTF-8 BOM / Shift_JIS、区切り文字選択）
- ZIPバンドルエクスポート（CSV + manifest.json）

### Phase 3: バッチジョブ処理
- 複数ファイル一括アップロード（最大100件）
- ジョブキュー管理（QUEUED / RUNNING / SUCCEEDED / PARTIAL / FAILED / CANCELLED）
- リアルタイム進捗表示
- キャンセル機能（AbortController）
- 並列処理最適化（同時実行数制御）
- 部分成功・エラーハンドリング

### Phase 4: 自動監視プロファイル + S3連携
- Auto-Watchプロファイル管理（REALTIME / SCHEDULED）
- File System Access API によるフォルダ監視
- 自動ジョブ作成・実行パイプライン
- Webhook通知（成功/エラー）
- S3連携（アップロード / 接続テスト / カスタムエンドポイント対応）
- S3フォルダパターン（FLAT / DATE / PROFILE / PROFILE_DATE）

### Phase 5: 品質向上 + ドキュメント整備
- 列ごとカスタムプロンプト設定
- 出力列並び順カスタマイズ
- テーブル行マージ出力
- localStorage結果データの分割保存（パフォーマンス改善）
- 型アサーション改善（pdf-crop, s3-uploader, csv-generator）
- VLM confidence推定値表示
- 開発ドキュメント整備

## 技術的な意思決定

### localStorage暫定設計の理由とSupabase移行パス

**理由**: 自社プロダクトの初期フェーズとして、バックエンド不要でクライアントサイドのみで完結する構成を採用。これにより開発速度を最大化し、デプロイ・運用コストを最小化した。

**移行パス**: `JobStorage` インターフェースを抽象化しているため、`localStorageJobStorage` を `supabaseJobStorage` に差し替えるだけでバックエンド移行が可能。`supabase/schema.sql` にスキーマ定義済み。

### エンジンアーキテクチャ（4パターン + テーブル抽出）

各読取パターンは共通の `ExtractionResult` 型を返す統一インターフェースで設計。ユーザーが帳票の特性に応じて最適なパターンを選択可能:

| パターン | 用途 | 精度 | 速度 |
|---------|------|------|------|
| OCR (Tesseract.js) | ブラウザ完結、画像ベース | 中 | 中 |
| OCR + LLM | OCR結果をLLMで補正 | 高 | 低 |
| VLM | 画像直接解析 | 高 | 低 |
| PDF_TEXT | テキスト埋め込みPDF | 最高 | 最速 |
| Table (LINES_FIRST) | 罫線あり帳票のテーブル抽出 | 高 | 中 |
| Table (VLM_FIRST) | 罫線なし帳票のテーブル抽出 | 中高 | 低 |

### バッチ処理の設計（並列制御、キャンセル）

- `Promise.allSettled` + semaphoreパターンで同時実行数を制御
- `AbortController` によるキャンセル伝播
- ファイル単位の独立処理により、1件の失敗が他に影響しない
- 進捗はコールバックでリアルタイム通知

## 既知の制限事項

### File System Access API のブラウザ制限
- Chrome/Edge のみサポート（Firefox/Safari未対応）
- Auto-Watch機能はこのAPIに依存するため、対応ブラウザでのみ動作
- HTTPSまたはlocalhostが必須

### クライアントサイドS3アクセスのCORS制約
- S3バケットにCORSポリシーの設定が必要
- アクセスキーがブラウザに露出するセキュリティリスク
- 本番運用ではAPI Routes経由のプロキシを推奨

### localStorage容量制限
- ブラウザのlocalStorage上限は通常5-10MB
- 大量のジョブ結果を保持すると容量超過の可能性
- Phase 5で分割保存に改善済みだが、根本解決はSupabase移行

## Supabase移行ガイド

### 1. Storage層のインターフェース差し替え手順

1. `src/lib/storage/supabase-job-storage.ts` を新規作成
2. `JobStorage` インターフェースを実装（`supabaseJobStorage`）
3. `jobStorage` のエクスポートを差し替え:
   ```typescript
   export const jobStorage: JobStorage = supabaseJobStorage
   ```
4. テーブル定義・テンプレートも同様にSupabase版ストレージを実装

### 2. スキーマ適用

`supabase/schema.sql` に定義済みのスキーマをSupabaseプロジェクトに適用:

```bash
supabase db push
```

### 3. API Routes化が必要な機能

以下の機能はクライアントサイド実行からAPI Routes経由に移行が必要:

- **S3連携**: アクセスキーをサーバーサイドで管理
  - `app/api/s3/upload/route.ts`
  - `app/api/s3/test/route.ts`
- **Webhook通知**: サーバーサイドからの送信に変更
  - `app/api/webhook/notify/route.ts`
- **AI推論**: APIキーのサーバーサイド管理
  - `app/api/extract/route.ts`

### 4. 認証の追加

- Supabase Auth を導入し、全ページにミドルウェアで認証チェック
- RLS（Row Level Security）を有効化してマルチテナント対応

## 今後の拡張候補

- **マルチテナント対応**: Supabase RLS + 組織管理
- **認証機能**: Supabase Auth（メール/Google/GitHub）
- **リアルタイムコラボレーション**: Supabase Realtime でジョブ進捗共有
- **OCRエンジン拡張**: Google Cloud Vision API 連携
- **カスタムVLMモデル**: ファインチューニングされた帳票特化モデル
- **ダッシュボード**: 抽出精度統計、処理量トレンド表示
- **バージョニング**: テンプレートの変更履歴管理
- **国際化（i18n）**: 多言語UI対応
