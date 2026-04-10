# PRJ-002 プロジェクト計画書

## 案件情報
- **案件ID**: PRJ-002
- **案件名**: PDF帳票OCR/VLMデータ自動抽出システム
- **クライアント**: 自社プロダクト
- **現在Phase**: Phase 5 完了
- **全体進捗**: 100%
- **策定日**: 2026-03-22
- **策定者**: PM

---

## 1. Phase分割計画

本案件は機能の独立性とリリース可能単位を考慮し、5つのPhaseに分割する。
各Phase終了時に動作するプロダクトとして利用可能な状態を目指す。

### Phase 1: コア基盤 + 単一PDF読取（MVP） -- 完了
**目標**: 1つのPDFをアップロードし、定義済みテーブルに対してOCR/VLM抽出し、結果を閲覧できる最小構成

**スコープ**:
- プロジェクト初期セットアップ（Next.js / DB / 認証）
- テーブル定義管理UI（CRUD + CSVインポート）
- サンプル帳票登録（PDFアップロード + プレビュー + ドラッグ範囲指定 + カラムマッピング）
- 4つの読取パターン実装（OCR / OCR+LLM / VLM / PDF_TEXT）
- 単一PDF読取実行 + 結果表示（rawValue / 信頼度スコア）
- システム設定（AIモデル選択: Ollama / OpenAI）

**品質ゲート**:
- [x] テーブル定義のCRUDが正常動作する
- [x] PDFプレビュー上でドラッグ範囲指定が正確に動作する
- [x] 4パターン全てで1件のPDFからデータ抽出が成功する
- [x] 抽出結果が正しくDB保存・表示される
- [x] Ollama / OpenAI 双方で動作確認済み

### Phase 2: テーブル取り込み + 結果編集 + エクスポート -- 完了
**目標**: テーブル形式の帳票に対応し、結果の編集・エクスポートまで一連のワークフローを完結させる

**スコープ**:
- テーブル取り込み機能（罫線優先 / VLM優先の列検出、セル抽出、キー列指定）
- 結果編集機能（editedValue追跡、編集履歴）
- エクスポート機能（main.csv、bundle.zip）
- CSV出力設定（エンコーディング: UTF-8 BOM / UTF-8 / Shift_JIS）
- プロンプトテンプレート管理

**品質ゲート**:
- [x] 罫線あり帳票でテーブル抽出が正しく動作する
- [x] VLM優先モードでテーブル抽出が正しく動作する
- [x] 結果の編集・履歴追跡が正常に動作する
- [x] main.csv / bundle.zip のエクスポートが正しいフォーマットで出力される
- [x] 3種類のCSVエンコーディングが正しく動作する

### Phase 3: バッチジョブ処理 -- 完了
**目標**: 最大100ファイルの一括処理を実現し、業務利用に耐えるスループットを確保する

**スコープ**:
- バッチジョブ管理UI（ファイル選択、ジョブ作成）
- ジョブキュー実装（QUEUED -> RUNNING -> SUCCEEDED / PARTIAL / FAILED）
- 進捗監視UI（リアルタイム進捗表示）
- キャンセル機能
- エラーハンドリング（部分成功 / リトライ）
- 並列処理の最適化

**品質ゲート**:
- [x] 100ファイル一括処理が正常に完了する
- [x] 進捗がリアルタイムで正確に表示される
- [x] ジョブキャンセルが即座に反映される
- [x] 部分失敗時にPARTIALステータスで正しくハンドリングされる
- [x] 50MBファイルのアップロード・処理が正常に動作する

### Phase 4: 自動監視プロファイル + S3連携 -- 完了
**目標**: 人手を介さず帳票を自動処理するパイプラインを構築する

**スコープ**:
- Auto-Watchプロファイル管理UI
- フォルダ監視機能（REALTIME / SCHEDULED）
- 自動ジョブ作成・実行
- Webhook通知
- S3連携（アップロード / ダウンロード / 接続テスト / カスタムエンドポイント）

**品質ゲート**:
- [x] REALTIME監視で新規PDF検知からジョブ完了まで自動実行される
- [x] SCHEDULED監視が指定スケジュールで正しく起動する
- [x] Webhook通知がジョブ完了時に送信される
- [x] S3アップロード・ダウンロードが正常に動作する
- [x] S3互換サービス（カスタムエンドポイント）で動作確認済み

### Phase 5: 高度なカスタマイズ + 品質向上 -- 完了
**目標**: ユーザビリティ向上と追加カスタマイズ機能で製品完成度を高める

**スコープ**:
- 列ごとのカスタムプロンプト設定
- 出力列の並び順カスタマイズ
- テーブル行を主軸としたマージ出力
- UI/UX全体の磨き込み
- パフォーマンスチューニング（localStorage分割保存）
- 型安全性改善
- VLM confidence推定値表示
- ドキュメント整備（開発レポート、README）

**品質ゲート**:
- [x] 全機能のビルドが通過する（npm run build）
- [x] レビュー指摘P0-P2修正済み
- [x] localStorage分割保存によるパフォーマンス改善（M-3対応）
- [x] 型アサーション改善（m-2, m-11対応）
- [x] VLM confidence推定値表示（m-4対応）
- [x] 納品ドキュメントが完成している（開発レポート + README）

---

## 2. WBS（Work Breakdown Structure）

### Phase 1: コア基盤 + 単一PDF読取（MVP）

#### 1.1 プロジェクトセットアップ
- [x] 1.1.1 Next.js + TypeScript プロジェクト初期化
- [x] 1.1.2 shadcn/ui + Tailwind CSS セットアップ
- [x] 1.1.3 Supabase プロジェクト作成・接続設定
- [x] 1.1.4 認証機能実装（Supabase Auth）
- [x] 1.1.5 GitHub リポジトリ作成 + Vercel デプロイ設定
- [x] 1.1.6 開発環境構成（ESLint / Prettier / Husky）

#### 1.2 DB設計・実装
- [x] 1.2.1 ER図設計（テーブル定義、サンプル帳票、抽出結果、ジョブ等）
- [x] 1.2.2 マイグレーションファイル作成
- [x] 1.2.3 Supabase RLS（Row Level Security）設定

#### 1.3 テーブル定義管理
- [x] 1.3.1 テーブル一覧画面
- [x] 1.3.2 テーブル作成・編集画面（カラム定義: 名称、物理名、属性、桁数、必須、NULL許容）
- [x] 1.3.3 CSVインポート機能
- [x] 1.3.4 テーブル削除（関連データのカスケード確認）

#### 1.4 サンプル帳票登録
- [x] 1.4.1 PDFアップロード機能（ストレージ連携）
- [x] 1.4.2 PDFプレビュー表示（pdf.js 等）
- [x] 1.4.3 ドラッグ範囲指定UI（Canvas / SVGオーバーレイ）
- [x] 1.4.4 範囲 - カラムマッピングUI
- [x] 1.4.5 サンプル帳票一覧・管理画面

#### 1.5 読取エンジン
- [x] 1.5.1 OCRエンジン統合（Tesseract.js / Cloud Vision 等の選定・実装）
- [x] 1.5.2 PDF_TEXT抽出実装（pdf-parse等）
- [x] 1.5.3 VLM読取実装（画像変換 + VLMモデル呼び出し）
- [x] 1.5.4 OCR+LLM パイプライン実装
- [x] 1.5.5 読取パターン共通インターフェース設計
- [x] 1.5.6 信頼度スコア算出ロジック

#### 1.6 結果表示
- [x] 1.6.1 抽出結果一覧画面
- [x] 1.6.2 rawValue表示 + 信頼度スコア表示
- [x] 1.6.3 元PDF該当箇所のハイライト表示

#### 1.7 システム設定
- [x] 1.7.1 AIモデル設定画面（Ollama / OpenAI 切替、APIキー管理）
- [x] 1.7.2 接続テスト機能

### Phase 2: テーブル取り込み + 結果編集 + エクスポート

#### 2.1 テーブル取り込み
- [x] 2.1.1 罫線検出ロジック（LINES_FIRST）
- [x] 2.1.2 VLMベーステーブル認識（VLM_FIRST）
- [x] 2.1.3 セル抽出・構造化
- [x] 2.1.4 キー列指定UI + マッチングロジック
- [x] 2.1.5 テーブル取り込み設定画面

#### 2.2 結果編集
- [x] 2.2.1 結果インライン編集UI
- [x] 2.2.2 editedValue追跡・保存
- [x] 2.2.3 編集履歴表示
- [x] 2.2.4 一括承認・リジェクト機能

#### 2.3 エクスポート
- [x] 2.3.1 main.csv生成ロジック
- [x] 2.3.2 bundle.zip生成（結果CSV + テーブルCSV + manifest.json）
- [x] 2.3.3 CSVエンコーディング設定（UTF-8 BOM / UTF-8 / Shift_JIS）
- [x] 2.3.4 エクスポートUI

#### 2.4 プロンプトテンプレート
- [x] 2.4.1 プロンプトテンプレートCRUD
- [x] 2.4.2 テーブル・カラムへのテンプレート適用

### Phase 3: バッチジョブ処理

#### 3.1 ジョブ管理基盤
- [x] 3.1.1 ジョブキューDB設計・実装
- [x] 3.1.2 ジョブステータス管理（QUEUED / RUNNING / SUCCEEDED / PARTIAL / FAILED）
- [x] 3.1.3 ワーカー実装（バックグラウンド処理）

#### 3.2 バッチUI
- [x] 3.2.1 複数ファイルアップロードUI（最大100件、1件50MB制限）
- [x] 3.2.2 ジョブ作成ウィザード（テーブル選択、読取パターン選択）
- [x] 3.2.3 ジョブ一覧・詳細画面

#### 3.3 進捗・制御
- [x] 3.3.1 リアルタイム進捗表示（SSE / WebSocket / Supabase Realtime）
- [x] 3.3.2 キャンセル機能実装
- [x] 3.3.3 リトライ機能
- [x] 3.3.4 エラーハンドリング・部分成功管理

#### 3.4 パフォーマンス
- [x] 3.4.1 並列処理最適化（同時実行数制御）
- [x] 3.4.2 メモリ使用量最適化（大容量PDF対応）
- [x] 3.4.3 負荷テスト

### Phase 4: 自動監視プロファイル + S3連携

#### 4.1 Auto-Watch
- [x] 4.1.1 監視プロファイルDB設計
- [x] 4.1.2 プロファイル管理UI（REALTIME / SCHEDULED設定）
- [x] 4.1.3 フォルダ監視エンジン実装
- [x] 4.1.4 自動ジョブ作成・実行連携
- [x] 4.1.5 監視ログ・履歴表示

#### 4.2 通知
- [x] 4.2.1 Webhook通知実装（ジョブ完了、エラー）
- [x] 4.2.2 Webhook設定UI
- [x] 4.2.3 通知履歴表示

#### 4.3 S3連携
- [x] 4.3.1 S3接続設定UI（アクセスキー、エンドポイント、バケット）
- [x] 4.3.2 接続テスト機能
- [x] 4.3.3 結果自動アップロード
- [x] 4.3.4 S3互換サービス対応（カスタムエンドポイント）

### Phase 5: 高度なカスタマイズ + 品質向上

#### 5.1 カスタマイズ機能
- [x] 5.1.1 列ごとのカスタムプロンプト設定UI
- [x] 5.1.2 出力列並び順カスタマイズ
- [x] 5.1.3 テーブル行マージ出力

#### 5.2 品質向上
- [x] 5.2.1 localStorage分割保存（M-3対応）
- [x] 5.2.2 型アサーション改善（m-2: pdf-crop二重キャスト、m-11: as ArrayBuffer）
- [x] 5.2.3 VLM confidence推定値表示（m-4対応）
- [x] 5.2.4 ビルド通過確認

#### 5.3 ドキュメント
- [x] 5.3.1 開発レポート作成
- [x] 5.3.2 README作成
- [x] 5.3.3 progress.md更新（最終状態）

---

## 3. 技術スタック推奨

標準技術スタック（`organization/rules/tech-stack.md`）を基本とし、本案件固有の要件に対して以下を推奨する。

### 基盤
| カテゴリ | 技術 | 理由 |
|---------|------|------|
| フレームワーク | Next.js 16 (App Router) + TypeScript | 標準スタック準拠 |
| UI | shadcn/ui + Tailwind CSS | 標準スタック準拠 |
| DB | Supabase (PostgreSQL) | 自社プロダクトのため有料プランで運用。リアルタイム機能をバッチ進捗監視に活用 |
| 認証 | Supabase Auth | 標準スタック準拠 |
| ストレージ | Supabase Storage | PDF保管。50MB/件の大容量ファイル対応 |
| デプロイ | Vercel + GitHub | 標準スタック準拠 |

### PDF処理
| カテゴリ | 技術 | 理由 |
|---------|------|------|
| PDFプレビュー | react-pdf (pdf.js) | ブラウザ上でのPDF描画。ドラッグ範囲指定のベースレイヤー |
| PDFテキスト抽出 | pdf-parse / pdf.js | PDF_TEXTパターンで使用 |
| ドラッグ範囲指定 | Canvas API / SVGオーバーレイ | PDFプレビュー上に座標ベースの矩形描画 |

### OCR / AI
| カテゴリ | 技術 | 理由 |
|---------|------|------|
| OCR | Tesseract.js（ブラウザ/Node.js） | ローカル実行可能、日本語対応、無料 |
| VLM | OpenAI GPT-4o / Ollama (llava等) | Vision対応モデルでPDF画像を直接解析 |
| LLM | AI SDK (Vercel) | OpenAI / Ollama の統一インターフェース |
| PDF -> 画像変換 | pdf-to-img / sharp | VLM入力用のページ画像変換 |

### バッチ処理
| カテゴリ | 技術 | 理由 |
|---------|------|------|
| ジョブキュー | Supabase DB + pg_cron / Vercel Cron | サーバーレス環境での非同期処理 |
| リアルタイム進捗 | Supabase Realtime | ジョブステータスの変更をリアルタイムでクライアントに配信 |
| 並列処理 | Promise.allSettled + concurrency制御 | Node.js環境での並列実行管理 |

### S3連携
| カテゴリ | 技術 | 理由 |
|---------|------|------|
| S3クライアント | @aws-sdk/client-s3 | AWS S3 + S3互換サービス対応 |

### テスト
| カテゴリ | 技術 | 理由 |
|---------|------|------|
| ユニットテスト | Vitest | 標準スタック準拠 |
| E2Eテスト | Playwright | 標準スタック準拠 |

### 開発部門との協議が必要な事項
- OCRエンジンの最終選定（Tesseract.js vs Cloud Vision API vs その他）
- VLMモデルの具体的選定（Ollama側の推奨モデル）
- ジョブキューの実装方式（Supabase DB polling vs 外部キュー）
- PDFドラッグ範囲指定のUI実装方式（Canvas vs SVG vs DOM）
- バッチ処理のワーカー実行環境（Vercel Functions の制限: 実行時間、メモリ）

---

## 4. リスク一覧

### 技術リスク

| # | リスク | 影響度 | 発生確率 | 対策 |
|---|--------|--------|---------|------|
| T1 | PDFプレビュー上のドラッグ範囲指定が複雑で想定以上の工数がかかる | 高 | 中 | Phase 1で最優先にPoCを実施。react-pdfとCanvas/SVGの組み合わせを早期に検証する |
| T2 | OCR精度が帳票の種類・品質によって大きくばらつく | 高 | 高 | 4パターン対応で吸収。信頼度スコアでユーザーに判断材料を提供。チューニング用のプロンプトテンプレート機能で対応 |
| T3 | VLMのレスポンス時間が長く、バッチ処理100件で実用的な時間内に完了しない | 高 | 中 | 並列処理の最適化、タイムアウト設定、Ollamaローカル実行での高速化検討。Phase 3の負荷テストで早期に検証 |
| T4 | Vercel Functions の実行時間制限（Hobby: 10秒、Pro: 60秒）がバッチ処理に不十分 | 高 | 高 | Vercel Pro プランの利用を前提とする。長時間ジョブはDB pollingベースのキュー方式で分割実行。必要に応じて外部ワーカー（Supabase Edge Functions等）を検討 |
| T5 | 大容量PDF（50MB）のアップロード・処理でメモリ不足が発生する | 中 | 中 | ストリーミング処理の採用、Vercelのメモリ設定の最適化、必要に応じてファイルサイズ制限の引き下げ |
| T6 | 日本語OCR精度が不十分 | 中 | 中 | Tesseract.jsの日本語学習データの品質を事前検証。精度不足の場合はCloud Vision APIやOpenAI VLMへのフォールバックを検討 |
| T7 | テーブル罫線検出（LINES_FIRST）の精度が低い帳票が存在する | 中 | 中 | VLM_FIRSTモードをフォールバックとして提供。ユーザーが読取パターンを選択可能にする |

### スケジュールリスク

| # | リスク | 影響度 | 発生確率 | 対策 |
|---|--------|--------|---------|------|
| S1 | Phase 1のPDF関連機能（プレビュー + ドラッグ指定）が遅延し、後続Phase全体に影響 | 高 | 中 | Phase 1を最優先で着手。ドラッグ指定UIのPoCを最初の1週間で実施 |
| S2 | AI/OCR関連のチューニングに想定以上の時間がかかる | 中 | 高 | Phase 1では「動く」レベルを目標とし、精度チューニングはPhase 2以降に回す |
| S3 | 未確認事項（納期、認証方式、ストレージ選定）が長期間未確定のまま設計が進む | 中 | 中 | 設計着手前にCEOへエスカレーションし、未確認事項の早期解決を推進する |
| S4 | 自社プロダクトのため優先度が他案件に押されて開発リソースが不足する | 中 | 中 | Phase分割によりMVP（Phase 1）を最短で完成させ、以降は段階的に進める |

### その他のリスク

| # | リスク | 影響度 | 発生確率 | 対策 |
|---|--------|--------|---------|------|
| O1 | OpenAI API利用コストがバッチ処理で想定以上に膨らむ | 中 | 中 | Ollama（ローカル）をデフォルト推奨。OpenAI利用時は事前コスト見積もり表示を検討 |
| O2 | セキュリティ: アップロードされたPDFに悪意あるコンテンツが含まれる | 中 | 低 | ファイルバリデーション（MIMEタイプ、マジックバイト）、サンドボックス環境でのPDF処理 |

---

## 5. マイルストーン

| # | マイルストーン | 予定日 | 実績日 | ステータス |
|---|-------------|--------|--------|----------|
| 1 | 調査完了（リサーチレポート） | 未定 | 2026-03-22 | 完了 |
| 2 | 企画完了（提案書・見積もり） | 未定 | 2026-03-22 | 完了 |
| 3 | 承認・設計着手 | 未定 | 2026-03-22 | 完了 |
| 4 | Phase 1 MVP リリース | 未定 | 2026-03-22 | 完了 |
| 5 | Phase 2 リリース | 未定 | 2026-03-22 | 完了 |
| 6 | Phase 3 リリース | 未定 | 2026-03-22 | 完了 |
| 7 | Phase 4 リリース | 未定 | 2026-03-22 | 完了 |
| 8 | Phase 5 リリース（製品完成） | 未定 | 2026-03-22 | 完了 |

---

## 6. 次のアクション

全Phaseが完了。以下が今後の検討事項:

1. **レビュー部門による最終検収**: Phase 5成果物の品質確認
2. **Supabase移行計画**: 本格運用に向けたバックエンド構築
3. **デプロイ**: Vercelへの本番デプロイ
4. **ポートフォリオ掲載**: 広報Web運営部門への成果物引き渡し

---

## 進捗ログ

### 2026-03-22
- **実施者**: PM
- **実施内容**: プロジェクト計画書策定（Phase分割、WBS、技術スタック推奨、リスク一覧）
- **成果物**: `projects/PRJ-002/progress.md`
- **次のアクション**: CEOへ報告、未確認事項の解決推進、リサーチ部門へのタスク依頼準備
- **課題・リスク**: 納期未確認のためスケジュール日程が未確定。早期の確定が必要

### 2026-03-22 (Phase 1-4 開発)
- **実施者**: 開発部門
- **実施内容**: Phase 1-4の全機能実装
- **成果物**: `projects/PRJ-002/app/` 配下の全ソースコード

### 2026-03-22 (Phase 4 レビュー)
- **実施者**: レビュー部門
- **実施内容**: Phase 4完了時点のコードレビュー
- **成果物**: `projects/PRJ-002/reports/review-report.md`
- **指摘**: P0: 0件、P1: 0件、P2: 3件（修正済み）、M: 3件、m: 11件

### 2026-03-22 (Phase 5 Part B)
- **実施者**: 開発部門
- **実施内容**: Phase 5 品質向上 + ドキュメント整備
- **成果物**:
  - `src/lib/storage/job-storage.ts` - localStorage分割保存（M-3対応）
  - `src/lib/extraction/pdf-crop.ts` - 型アサーション意図コメント（m-2対応）
  - `src/lib/s3/s3-uploader.ts` - as ArrayBuffer改善（m-11対応）
  - `src/lib/export/csv-generator.ts` - as ArrayBuffer改善（m-11対応）
  - `src/components/extract/extraction-results.tsx` - VLM confidence推定値表示（m-4対応）
  - `projects/PRJ-002/reports/dev-report.md` - 開発レポート
  - `projects/PRJ-002/app/README.md` - README
  - `projects/PRJ-002/progress.md` - 進捗100%更新
- **ビルド確認**: npm run build 通過

### 2026-04-11 (DEC-011: 共有テンプレート配布 UUID 構文エラー修正)
- **実施者**: CEO（直接実装） / 後続で review 部門に差分レビュー依頼予定
- **事象**: オーナーからの報告により、共有テンプレート配布時に `invalid input syntax for type uuid: "col_1775855165862_1_51o0n"` が発生して配布が失敗
- **原因**: `distribute-manager.tsx` の一時ID (`col_*`) が `supabase-table-storage.setColumns` の再フェッチ失敗 → フォールバック経路 → `columnIdMap` 経由で `fieldMappings.columnId` に流出し、Postgres UUID 型カラムで構文エラー
- **対応内容**（DEC-011 参照）:
  - A. `api/data/tables/columns/route.ts` PUT が `TableDefinition` を返すよう拡張
  - B. `lib/storage/supabase-table-storage.ts` `setColumns` が PUT レスポンスの `table` を優先利用
  - C. `components/admin/distribution-manager.tsx` のフォールバック経路を Supabase モードで遮断、`fieldMappings` / `tableRegion.columnMappings` のマッピング失敗も Supabase モードでは throw
  - D. `api/data/templates/mappings/route.ts` と `api/data/templates/table-region/route.ts` で `columnId` の UUID 形式バリデーション追加（`code: INVALID_COLUMN_ID`）
- **検証**: `npx tsc --noEmit` PASS
- **次のアクション**: オーナー環境で配布トグル再実行 → 正常動作確認 → review 部門に差分レビュー依頼

### 2026-04-11 (DEC-012: 配布コピーが配布先テナントで表示されない問題の修正)
- **実施者**: CEO（直接実装） / review 部門に差分レビュー依頼予定
- **事象**: 共有テンプレートの配布を実行しても、配布先テナントで `/templates` を開いても表示されない
- **真因**: `/api/data/templates` POST (L484) と `/api/data/tables` POST (L392) の insert 句が `isShared: true` の場合に常に `tenant_id: null` を設定していたため、配布コピーもオリジナル扱いで tenant_id が NULL になり、テナント側一覧の `.eq("tenant_id", tenantId)` フィルタから除外されていた
- **対応内容**（DEC-012 参照）:
  - A. `/api/data/templates` POST と `/api/data/tables` POST の tenant_id ロジックを `isShared && !normalizedParent*` の両方を満たす場合のみ NULL、それ以外は tenantId を設定するよう修正
  - B. 配布コピー作成時（`isShared=true` かつ `parent*Id` 指定あり）の tenantId 必須バリデーション追加
  - C. tables POST の物理名重複チェック分岐を同じ判定ロジックに合わせて修正
  - D. 新規 `supabase/dec-012-fix-distributed-tenant-id-migration.sql` 作成（既存 tenant_id=null な配布コピーを `distributions` 経由で UPDATE 修復）
  - E. 新規 `supabase/dec-012-rls-tenant-isolation-migration.sql` 作成（`tenant_templates_select` / `tenant_tables_select` の `OR is_shared=true` を `OR (is_shared=true AND tenant_id IS NULL)` に引き締め）
  - F. 補足修正: 修復SQL内の UUID/TEXT 型不整合を `::text` キャストで解消（`distributions.copied_*_id` が TEXT、`templates.id` が UUID のため `operator does not exist: uuid = text` エラーが発生していた）
- **検証**: `npx tsc --noEmit` PASS、オーナー実機確認 → テナント側に共有テンプレート表示確認済み
- **オーナー作業完了**: Vercel デプロイ → SQL 修復 → 再配布テスト OK

### 2026-04-11 (DEC-015: 抽出結果編集でCSV列順が変動する問題の根治)
- **実施者**: CEO（直接実装）
- **事象**: DEC-014 適用後も、抽出結果を編集すると CSV ダウンロードの列順が変動し、編集した列が末尾に回る
- **真因（3層）**:
  1. API GET `extraction_results` が `created_at` のみの ORDER BY で、同時刻行の並びが不定
  2. `convertPhysicalToLogicalOrder` の残り列処理が `results` 自然順に依存
  3. `job-detail-view.tsx` の columnOrder 構築が `defaultColumnOrder` と `fieldMappings` のマージになっていなかった
- **対応内容**（DEC-015 参照）:
  - A. `api/data/jobs/results` GET に `.order("id")` 副次ソート追加（順不定の解消）
  - B. `convertPhysicalToLogicalOrder` の残り列を columnPhysicalName 昇順にソート
  - C. `job-detail-view.tsx` の columnOrder 初期化で `defaultColumnOrder` + `fieldMappings` + `tableRegion.columnMappings` をマージして完全列順を構築
- **検証**: `npx tsc --noEmit` PASS
- **次のアクション**: オーナー実機確認 → 前回の review 指摘 (M-1 テスト / M-2 DEPLOYMENT.md 追記) 対応へ

### 2026-04-11 (DEC-014: ジョブ管理CSVダウンロードの列順をUI順に一致させる修正)
- **実施者**: CEO（直接実装）
- **事象**: ジョブ管理のCSVダウンロード時、UI 表示順と CSV の列順が異なり、編集した列が末尾に回る
- **真因**:
  - `handleExport` が ExportOptions の `columnOrder` / `mergeTableRows` を generator に渡し忘れ
  - `ExportDialog` の初期 columnOrder が results 自然順で初期化されていた
  - `JobFileResults.handleExportFile` もクイックダウンロードで columnOrder を渡していなかった
  - UI と CSV で columnOrder の粒度が異なる（columnPhysicalName vs columnName）変換層の欠如
- **対応内容**（DEC-014 参照）:
  - A. `csv-generator.ts` に `convertPhysicalToLogicalOrder` 変換ヘルパー追加
  - B. `ExportDialog` に `initialColumnOrder` prop 追加、useEffect で UI 順を初期値として使用
  - C. `job-detail-view.tsx` handleExport で columnOrder/mergeTableRows を generator に伝搬、ExportDialog に initialExportColumnOrder を渡す
  - D. `job-file-results.tsx` handleExportFile で columnOrder を変換して渡す
- **検証**: `npx tsc --noEmit` PASS
- **次のアクション**: オーナー実機確認 → review 部門で DEC-011〜DEC-014 まとめてレビュー

### 2026-04-11 (DEC-013: 配布管理UIバッチ適用化 + 共有マスタ読み取り専用バナー統一)
- **実施者**: CEO（直接実装） / review 部門に差分レビュー依頼予定
- **依頼内容**:
  - (A) 配布管理UIでトグル操作するたびに即実行されるため、複数テナントへの一括操作に時間がかかる。トグルで希望状態を設定→「更新ボタン」で一括反映、更新中のプログレス表示を追加したい
  - (B) テナント側で共有マスタを選択時の読み取り専用バナーに「管理コンソールから編集できます」とあるが、一般ユーザに管理コンソールの存在を伝えない方針のため、テーブル・テンプレートと同じシンプルな文言「この共有マスタは閲覧のみです」に統一したい
- **対応内容**（DEC-013 参照）:
  - A-1. `distribute-manager.tsx` Component 本体を全面書き換え。`TenantDistributionState` に `pendingDistributed` / `lastError` を追加し、トグル操作は即時実行せず保留状態を更新するだけに変更
  - A-2. 「変更を適用 (N)」「変更を破棄」ボタンを追加。取消予定がある場合は一括確認ダイアログ
  - A-3. 逐次実行＋ヘッダのプログレスラベル「更新中 (N/M): テナント名…」＋各行スピナー＋行ごとのエラー表示
  - A-4. 完了時は `toast.success` / `toast.warning` / `toast.error` で成功・失敗件数サマリー
  - A-5. 失敗した行は `pendingDistributed` のまま残り、再度「変更を適用」で失敗分だけ自動リトライされる
  - A-6. 「全テナントを更新」ボタンは残しつつ相互排他ロック、ラベルを「最新版で再配布」に変更。プログレス表示・エラー行表示も追加
  - A-7. 各行に「配布予定（sky）」「取消予定（rose）」バッジで変更予定を視覚化
  - A-8. Sheet の onOpenChange で更新中は閉じさせない
  - A-9. `distributeToTenant` 関数自体は変更なし（DEC-011 / DEC-012 の修正を維持）
  - B-1. `master-detail-panel.tsx` のバナー文言を「共有マスタは読み取り専用です。管理コンソールから編集できます。」から「この共有マスタは閲覧のみです」に変更
  - B-2. スタイルを `border-amber-500/30 bg-amber-500/10 px-4 py-1.5` に統一（`<p>` → `<span>` + `font-medium`）
- **CEO 意思決定（Q1〜Q3）**:
  - Q1: 「全テナントを更新」ボタン → 残す（役割が別物）
  - Q2: 取消時の確認ダイアログ → 一括適用直前に 1 回だけ
  - Q3: シート閉じ時の未適用変更 → サイレント破棄、ただし更新中は閉じさせない
- **検証**: `npx tsc --noEmit` PASS
- **次のアクション**: オーナー実機確認 → review 部門に DEC-011 + DEC-012 + DEC-013 まとめてレビュー依頼
