# PRJ-003 Phase 2 詳細タスクリスト

## 文書情報

| 項目 | 内容 |
|------|------|
| 案件ID | PRJ-003 |
| 案件名 | 不定様式PDF VLMデータ抽出システム |
| Phase | Phase 2（精度向上 + バッチ） |
| 期間 | 4週間（Week 5-8） |
| 作成日 | 2026-03-26 |
| 作成者 | PM部門 |
| ステータス | 初版 |

## Phase 2 ゴール

カスケード抽出とフィードバックループにより精度を向上させ、バッチ処理で業務利用に耐えるレベルにする。

**Phase 2 成果物**:
- カスケード抽出（Stage 1 + Stage 2）
- マルチモデル対応（OpenAI / Anthropic / Google / Ollama）
- バッチ処理（最大50ファイル、進捗管理、エラーハンドリング）
- フィードバックループ（修正ログ記録、Few-shot例蓄積、類似帳票検索）
- 信頼度スコア表示改善、手動確認フラグ
- Excelエクスポート
- コスト管理ダッシュボード

---

## Phase 1教訓の適用チェックリスト

Phase 2開発開始前に以下を確認すること:

- [ ] API設計を先に固めてからフロント実装に入る（Phase 1でURLパス不一致が多発）
- [ ] pdfjs-distはlegacy buildの使用を前提とする（Node.js互換性問題）
- [ ] VLMに計算を任せない（読み取りのみVLM、変換/正規化はコードで）
- [ ] AI GatewayではなくダイレクトSDK（ユーザー自身のAPIキー管理）
- [ ] マルチプロバイダー対応は `@ai-sdk/anthropic`, `@ai-sdk/google` の正式SDKを使用（Phase 1のOpenAI互換ラッパーから移行）
- [ ] バッチ処理のDBテーブル（batch_jobs, batch_job_documents）は既に作成済み。UIとAPIの実装に集中する
- [ ] Few-shotテーブル（few_shot_examples）は既に作成済み。蓄積ロジックとプロンプト動的注入に集中する
- [ ] Excelエクスポートにはxlsxパッケージ（SheetJS）の追加が必要

---

## Phase 1 既存インフラ（再実装不要）

Phase 2で活用する既存リソース:

| カテゴリ | 既存リソース |
|---------|------------|
| DB | extraction_schemas, extraction_fields, documents, extraction_results, correction_logs, few_shot_examples, batch_jobs, batch_job_documents, ai_model_configs, api_usage_logs, prompt_templates テーブル全て作成済み |
| 認証 | Supabase Auth + RLSポリシー適用済み |
| AI基盤 | `lib/ai/provider.ts`（OpenAI + Ollamaプロバイダー）、`lib/ai/extractor.ts`（Stage 1抽出）、`lib/ai/schema-to-zod.ts`、プロンプトテンプレート |
| PDF処理 | `lib/pdf/classifier.ts`、`lib/pdf/image-processor.ts`、`lib/pdf/text-extractor.ts` |
| 後処理 | `lib/extraction/pipeline.ts`、`lib/extraction/normalizer.ts`、`lib/extraction/validator.ts`、`lib/extraction/master-matcher.ts` |
| エクスポート | `lib/export/csv-generator.ts`、`lib/export/encoding.ts` |
| UI | 全CRUD画面、抽出ウィザード、結果表示・編集、マスタ照合、ダッシュボード完成済み |
| API | スキーマ/フィールド/ドキュメント/抽出/結果/マスタ/エクスポート/設定 全API実装済み |

---

## Week 5: カスケード抽出（8タスク）

### T-5.1: カスケード抽出 API設計・型定義

| 項目 | 内容 |
|------|------|
| タスク名 | カスケード抽出のAPI設計とTypeScript型定義 |
| 説明 | Phase 2の全API仕様をまず固める（Phase 1教訓: API設計を先に固める）。カスケード抽出（Stage 2）、バッチ処理、フィードバック、Excelエクスポートの全APIパスとリクエスト/レスポンス型を定義。既存APIとの整合性を確認 |
| 成果物 | - `src/types/cascade.ts`（カスケード抽出関連の型: CascadeConfig, Stage2Request, Stage2Result, ConfidenceThreshold）<br>- `src/types/batch.ts`（バッチ処理関連の型: BatchJob, BatchJobDocument, BatchProgress, BatchCreateRequest）<br>- `src/types/feedback.ts`（フィードバック関連の型: CorrectionLog, FewShotExample, SimilarDocument）<br>- `docs/phase2-api-spec.md`（Phase 2全APIのパス・リクエスト・レスポンス仕様書） |
| 依存関係 | なし |
| 推定工数 | 3時間 |
| ステータス | [ ] |

**API仕様概要（Phase 2追加分）**:
```
カスケード抽出:
  PUT  /api/settings/ai-models      -- Stage 1/Stage 2モデル設定の拡張
  POST /api/extract                  -- 既存APIにcascade_enabledオプション追加
  POST /api/ai/test-connection       -- 既存APIにAnthropic/Google対応追加

バッチ処理:
  POST /api/extract/batch            -- バッチジョブ作成・実行
  GET  /api/extract/batch/[jobId]    -- ジョブ状態取得（ポーリング）
  POST /api/extract/batch/[jobId]/cancel  -- ジョブキャンセル
  POST /api/extract/batch/[jobId]/retry   -- 失敗分リトライ

フィードバック:
  POST /api/few-shot                 -- Few-shot例の追加
  GET  /api/few-shot/similar         -- 類似帳票のFew-shot例検索
  GET  /api/feedback/stats           -- 修正パターン統計

Excelエクスポート:
  POST /api/export/excel             -- Excelエクスポート

コスト管理:
  GET  /api/settings/usage           -- API使用量・コスト情報取得
```

---

### T-5.2: Stage 2 高精度VLM抽出エンジン

| 項目 | 内容 |
|------|------|
| タスク名 | Stage 2 高精度VLM抽出エンジンの実装 |
| 説明 | 信頼度0.8未満のフィールドを持つページに対して、高精度モデル（GPT-4o）で再抽出するStage 2エンジンを実装。Stage 1の結果を参考情報としてプロンプトに含め、低信頼度フィールドのみを再抽出する。VLMには読み取りのみ任せ、変換/正規化はコードで行う（Phase 1教訓） |
| 成果物 | - `src/lib/ai/cascade-extractor.ts`（カスケード抽出エンジン: Stage 1結果を受けてStage 2を実行）<br>- `src/lib/ai/prompts/cascade.ts`（Stage 2用プロンプトテンプレート: 低信頼度フィールド再抽出指示） |
| 依存関係 | T-5.1 |
| 推定工数 | 5時間 |
| ステータス | [ ] |

**Stage 2 再抽出ロジック**:
```
入力: Stage 1の抽出結果 + 信頼度スコア + 元画像

1. 信頼度スコアを閾値（デフォルト0.8）でフィルタリング
2. 低信頼度フィールドのリストを抽出
3. Stage 2用プロンプトを構築:
   - システムプロンプト（帳票抽出専門家、高精度モード）
   - Stage 1の結果を参考情報として提供
   - 低信頼度フィールドのみの再抽出を指示
   - 元画像を再度添付
4. 高精度モデル（GPT-4o）で構造化出力
5. Stage 1結果にStage 2結果をマージ（低信頼度フィールドのみ上書き）
6. 後処理・バリデーションパイプラインに渡す
```

---

### T-5.3: Chain-of-Thought（CoT）プロンプト

| 項目 | 内容 |
|------|------|
| タスク名 | Stage 2用Chain-of-Thoughtプロンプトの実装 |
| 説明 | Stage 2で段階的思考プロンプトを適用。帳票種類判定 → レイアウト分析 → フィールド抽出 → 整合性チェックの4段階で推論させる。CoTの途中結果をログに保存し、デバッグ・精度改善に活用 |
| 成果物 | - `src/lib/ai/prompts/cot.ts`（CoTプロンプトテンプレート: 4段階思考プロセス定義）<br>- `src/lib/ai/cot-parser.ts`（CoTレスポンスのパース: 思考過程と最終結果の分離） |
| 依存関係 | T-5.2 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

**CoTプロンプト構造**:
```
Stage 2 CoTプロンプト:
1. [帳票種類判定] この帳票はどのような種類か（請求書/納品書/見積書等）
2. [レイアウト分析] ヘッダー/明細/フッターの配置を分析
3. [フィールド抽出] 指定された低信頼度フィールドを正確に読み取り
4. [整合性チェック] 抽出結果の整合性を検証（金額合計、日付の妥当性等）

出力: { thinking: string, result: StructuredOutput }
```

---

### T-5.4: 信頼度スコア改善・閾値設定

| 項目 | 内容 |
|------|------|
| タスク名 | 信頼度スコアの改善と閾値カスタマイズ |
| 説明 | Phase 1のVLM自己申告信頼度に加え、バリデーション結果・マスタ照合結果を加味した複合信頼度スコアを算出。手動確認フラグの閾値をユーザーが設定画面から変更可能にする。Stage 1 → Stage 2後の信頼度の変化を追跡 |
| 成果物 | - `src/lib/extraction/confidence-scorer.ts`（複合信頼度スコア算出: VLM自己申告 x バリデーション結果 x マスタ照合結果）<br>- `src/app/api/settings/confidence/route.ts`（GET/PUT: 信頼度閾値設定API）<br>- `src/lib/validators/confidence.ts`（閾値設定のZodスキーマ） |
| 依存関係 | T-5.2 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

**複合信頼度算出ロジック**:
```
compositeConfidence = vlmConfidence * 0.6
                    + validationScore * 0.2
                    + masterMatchScore * 0.2

validationScore:
  - バリデーション通過: 1.0
  - バリデーション不合格: 0.3

masterMatchScore:
  - 照合OFF: 1.0（中立）
  - 完全一致: 1.0
  - 類似候補あり: 0.6
  - 一致なし: 0.2
```

---

### T-5.5: 手動確認フラグUI・カスケード結果表示

| 項目 | 内容 |
|------|------|
| タスク名 | 手動確認フラグとカスケード結果表示UIの改善 |
| 説明 | 既存の`confidence-badge.tsx`を拡張し、Stage 1/Stage 2のどちらで抽出されたかを表示。信頼度閾値未満のフィールドに手動確認フラグ（要確認アイコン）を表示。未確認フィールド数のサマリーバッジを結果一覧に追加。フィルタ機能（要確認のみ表示）を追加 |
| 成果物 | - `src/components/results/confidence-badge.tsx`（既存拡張: Stage表示、複合信頼度対応）<br>- `src/components/results/manual-review-flag.tsx`（手動確認フラグアイコン + ツールチップ）<br>- `src/components/results/review-summary-badge.tsx`（未確認フィールド数サマリー）<br>- `src/components/results/review-filter.tsx`（要確認フィルタトグル） |
| 依存関係 | T-5.4 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

---

### T-5.6: カスケード設定UI

| 項目 | 内容 |
|------|------|
| タスク名 | カスケード抽出設定画面の実装 |
| 説明 | 既存の設定画面（`/settings`）にカスケード設定セクションを追加。Stage 1モデル/Stage 2モデルの選択、信頼度閾値の設定、カスケード有効/無効の切り替え、フォールバックモデルの設定UIを実装 |
| 成果物 | - `src/components/settings/cascade-config.tsx`（カスケード設定フォーム: Stage 1/2モデル選択、閾値スライダー、有効/無効トグル、フォールバックモデル選択）<br>- `src/components/settings/confidence-threshold-config.tsx`（信頼度閾値設定: スライダー + プレビュー）<br>- `src/hooks/use-cascade-settings.ts`（カスケード設定のReact Queryフック） |
| 依存関係 | T-5.4, T-5.1 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

---

### T-5.7: 抽出パイプライン統合（カスケード対応）

| 項目 | 内容 |
|------|------|
| タスク名 | 既存の抽出パイプラインにカスケード処理を統合 |
| 説明 | 既存の`lib/extraction/pipeline.ts`を拡張し、カスケード抽出フローを統合。`/api/extract`にcascade_enabledパラメータを追加。カスケード有効時: Stage 1 → 信頼度判定 → Stage 2（低信頼度のみ）→ 後処理。token_usageにStage 1/Stage 2の両方のコストを記録 |
| 成果物 | - `src/lib/extraction/pipeline.ts`（既存拡張: カスケードフロー統合）<br>- `src/app/api/extract/route.ts`（既存拡張: cascade_enabledオプション追加）<br>- `src/lib/ai/usage-tracker.ts`（API使用量トラッキング: api_usage_logsへの書き込み） |
| 依存関係 | T-5.2, T-5.3, T-5.4 |
| 推定工数 | 4時間 |
| ステータス | [ ] |

**拡張フロー**:
```
[既存Stage 1] → [信頼度判定]
                    |
                    +-- 全フィールド高信頼度 → [後処理] → [結果保存]
                    |
                    +-- 低信頼度あり → [Stage 2 再抽出] → [結果マージ] → [後処理] → [結果保存]
                                                                              |
                                                                              v
                                                                     [api_usage_logs記録]
```

---

### T-5.8: カスケード抽出ユニットテスト

| 項目 | 内容 |
|------|------|
| タスク名 | カスケード抽出関連のユニットテスト |
| 説明 | カスケード抽出エンジン、複合信頼度スコア、CoTパーサー、使用量トラッカーのユニットテスト。AIモデル呼び出しはモック化 |
| 成果物 | - `tests/unit/cascade-extractor.test.ts`（カスケード抽出: 全高信頼度でStage 2スキップ、低信頼度でStage 2実行、結果マージ）<br>- `tests/unit/confidence-scorer.test.ts`（複合信頼度: 各要素の重み付け検証）<br>- `tests/unit/cot-parser.test.ts`（CoTパース: 思考過程と結果の分離）<br>- `tests/unit/usage-tracker.test.ts`（使用量記録: Stage 1+Stage 2の合算） |
| 依存関係 | T-5.7 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

---

### Week 5 マイルストーン

| チェック項目 | 基準 |
|-------------|------|
| [ ] Phase 2全APIの仕様書が完成している | docs/phase2-api-spec.mdが作成済み |
| [ ] カスケード抽出が動作する | Stage 1 → 信頼度判定 → Stage 2の一連のフロー |
| [ ] 低信頼度フィールドのみStage 2で再抽出される | 高信頼度フィールドはStage 1の結果を保持 |
| [ ] CoTプロンプトが適用される | Stage 2で4段階の思考プロセスが実行される |
| [ ] 複合信頼度スコアが算出される | VLM + バリデーション + マスタ照合の加重平均 |
| [ ] 手動確認フラグが表示される | 閾値未満のフィールドにフラグが付く |
| [ ] カスケード設定UIが動作する | 設定画面からStage 1/2モデル、閾値を変更できる |
| [ ] ユニットテストが全て通過する | カスケード関連の全テストがグリーン |

---

## Week 6: マルチモデル対応（7タスク）

### T-6.1: Anthropicプロバイダー実装

| 項目 | 内容 |
|------|------|
| タスク名 | @ai-sdk/anthropic によるAnthropicプロバイダーの正式実装 |
| 説明 | `@ai-sdk/anthropic`パッケージをインストールし、既存の`lib/ai/provider.ts`のAnthropicブランチをOpenAI互換ラッパーから正式SDKに置き換え。Claude Sonnet 4.6をStage 2の選択肢として追加。接続テストAPIもAnthropic対応に拡張 |
| 成果物 | - `package.json`（@ai-sdk/anthropic追加）<br>- `src/lib/ai/provider.ts`（既存修正: Anthropicブランチを正式SDK実装に置換）<br>- `src/app/api/ai/test-connection/route.ts`（既存拡張: Anthropic接続テスト対応） |
| 依存関係 | T-5.1 |
| 推定工数 | 2時間 |
| ステータス | [ ] |

**実装方針**:
```typescript
// provider.ts Anthropicブランチの変更
case 'anthropic': {
  const { createAnthropic } = await import('@ai-sdk/anthropic');
  const anthropic = createAnthropic({
    apiKey: apiKey || process.env.ANTHROPIC_API_KEY || '',
  });
  return anthropic(modelId);
}
```

---

### T-6.2: Googleプロバイダー実装

| 項目 | 内容 |
|------|------|
| タスク名 | @ai-sdk/google によるGoogleプロバイダーの正式実装 |
| 説明 | `@ai-sdk/google`パッケージをインストールし、既存の`lib/ai/provider.ts`のGoogleブランチをOpenAI互換ラッパーから正式SDKに置き換え。Gemini 2.5 Flash（Stage 1）、Gemini 2.5 Pro（Stage 2）を選択肢として追加。接続テストAPIもGoogle対応に拡張 |
| 成果物 | - `package.json`（@ai-sdk/google追加）<br>- `src/lib/ai/provider.ts`（既存修正: Googleブランチを正式SDK実装に置換）<br>- `src/app/api/ai/test-connection/route.ts`（既存拡張: Google接続テスト対応） |
| 依存関係 | T-5.1 |
| 推定工数 | 2時間 |
| ステータス | [ ] |

---

### T-6.3: Ollama接続設定・モデル一覧

| 項目 | 内容 |
|------|------|
| タスク名 | Ollama接続設定UIとモデル一覧取得の実装 |
| 説明 | Ollamaローカルサーバーの接続URL設定、接続テスト、利用可能なモデル一覧の自動取得を実装。Ollamaは既にOpenAI互換で動作するため、provider.tsの変更は不要。設定UIとモデル一覧取得APIを追加 |
| 成果物 | - `src/app/api/ai/ollama/models/route.ts`（GET: Ollamaモデル一覧取得 - /api/tags エンドポイント呼び出し）<br>- `src/components/settings/ollama-config.tsx`（Ollama設定: URL入力、接続テストボタン、モデル一覧ドロップダウン）<br>- `src/hooks/use-ollama-models.ts`（Ollamaモデル一覧のReact Queryフック） |
| 依存関係 | T-5.6 |
| 推定工数 | 2時間 |
| ステータス | [ ] |

---

### T-6.4: AIモデル設定UI拡張（マルチプロバイダー）

| 項目 | 内容 |
|------|------|
| タスク名 | AIモデル設定画面のマルチプロバイダー対応 |
| 説明 | 既存の設定画面を拡張し、4プロバイダー（OpenAI / Anthropic / Google / Ollama）の設定をタブで切り替え可能にする。各プロバイダーのAPIキー入力、利用可能モデルの選択、Stage 1/Stage 2への割り当てを管理。モデル一覧はプロバイダーごとにハードコード+Ollamaのみ動的取得 |
| 成果物 | - `src/components/settings/ai-model-config.tsx`（既存拡張: プロバイダータブ切り替え、各プロバイダーのAPIキー・モデル設定フォーム）<br>- `src/components/settings/provider-models.ts`（プロバイダーごとの利用可能モデルリスト定数）<br>- `src/app/api/settings/ai-models/route.ts`（既存拡張: マルチプロバイダーの設定保存・取得） |
| 依存関係 | T-6.1, T-6.2, T-6.3 |
| 推定工数 | 4時間 |
| ステータス | [ ] |

**プロバイダー別モデルリスト**:
```
OpenAI:
  Stage 1: gpt-4o-mini
  Stage 2: gpt-4o

Anthropic:
  Stage 2: claude-sonnet-4-6-20250514

Google:
  Stage 1: gemini-2.5-flash
  Stage 2: gemini-2.5-pro

Ollama:
  Stage 1/2: 動的取得（VLM対応モデル: llava, qwen2.5-vl等）
```

---

### T-6.5: モデルフォールバック機構

| 項目 | 内容 |
|------|------|
| タスク名 | VLMモデルフォールバック機構の実装 |
| 説明 | 第一モデルがAPIエラー（レート制限、タイムアウト、サーバーエラー）で失敗した場合に、設定されたフォールバックモデルに自動切り替えする機構を実装。リトライ回数・間隔も設定可能。フォールバック発生時はapi_usage_logsに記録 |
| 成果物 | - `src/lib/ai/fallback-executor.ts`（フォールバック実行エンジン: 第一モデル失敗 → リトライ → フォールバックモデル）<br>- `src/lib/ai/retry-strategy.ts`（リトライ戦略: 最大3回、指数バックオフ2秒/4秒/8秒）<br>- `src/types/fallback.ts`（フォールバック設定の型定義） |
| 依存関係 | T-6.1, T-6.2 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

**フォールバックフロー**:
```
[第一モデル呼び出し]
    |
    +-- 成功 → 結果返却
    |
    +-- 失敗(リトライ可能) → [リトライ(最大3回, 指数バックオフ)]
    |                            |
    |                            +-- 成功 → 結果返却
    |                            |
    |                            +-- 全リトライ失敗 → [フォールバックモデル]
    |                                                     |
    +-- 失敗(リトライ不可) → [フォールバックモデル]          |
                                  |                      |
                                  +-- 成功 → 結果返却（フォールバック使用をログ記録）
                                  |
                                  +-- 失敗 → エラー返却
```

---

### T-6.6: コスト管理ダッシュボード

| 項目 | 内容 |
|------|------|
| タスク名 | API使用量・コスト管理ダッシュボードの実装 |
| 説明 | api_usage_logsテーブルのデータを集計し、モデル別/日別のAPI呼出数・トークン消費量・推定コストを表示するダッシュボードを実装。集計APIとビジュアライゼーションコンポーネントを作成 |
| 成果物 | - `src/app/api/settings/usage/route.ts`（GET: API使用量集計 - モデル別、日別、期間指定対応）<br>- `src/app/(dashboard)/settings/usage/page.tsx`（コスト管理ダッシュボード画面）<br>- `src/components/settings/usage-summary-cards.tsx`（サマリーカード: 今月のトークン数、推定コスト、呼出回数）<br>- `src/components/settings/usage-chart.tsx`（日別推移チャート: recharts使用）<br>- `src/components/settings/usage-by-model.tsx`（モデル別内訳テーブル）<br>- `src/hooks/use-usage-stats.ts`（使用量統計のReact Queryフック） |
| 依存関係 | T-5.7 |
| 推定工数 | 4時間 |
| ステータス | [ ] |

**推定コスト算出**:
```
各モデルの料金レート（1Mトークンあたり）:
  gpt-4o-mini:       input $0.15  / output $0.60
  gpt-4o:            input $2.50  / output $10.00
  claude-sonnet-4-6: input $3.00  / output $15.00
  gemini-2.5-flash:  input $0.15  / output $0.60
  gemini-2.5-pro:    input $1.25  / output $10.00
  ollama:            $0（ローカル実行）

estimated_cost = (input_tokens * input_rate + output_tokens * output_rate) / 1_000_000
```

---

### T-6.7: マルチモデル統合テスト

| 項目 | 内容 |
|------|------|
| タスク名 | マルチモデル対応の統合テスト |
| 説明 | 各プロバイダーのモック環境を構築し、プロバイダー切り替え、フォールバック、接続テスト、コスト記録のテストを実施。実際のAPIキーは使用せず、モック/スタブで検証 |
| 成果物 | - `tests/unit/provider.test.ts`（プロバイダー生成: 4プロバイダーの正しいSDK呼び出し検証）<br>- `tests/unit/fallback-executor.test.ts`（フォールバック: リトライ、フォールバック切替、全失敗）<br>- `tests/unit/usage-stats.test.ts`（コスト集計: モデル別・日別の集計ロジック）<br>- `tests/mocks/ai-providers.ts`（各プロバイダーのモック定義） |
| 依存関係 | T-6.5, T-6.6 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

---

### Week 6 マイルストーン

| チェック項目 | 基準 |
|-------------|------|
| [ ] Anthropicプロバイダーが正式SDKで動作する | @ai-sdk/anthropicによるClaude Sonnet 4.6での抽出成功 |
| [ ] Googleプロバイダーが正式SDKで動作する | @ai-sdk/googleによるGemini 2.5 Flash/Proでの抽出成功 |
| [ ] Ollama接続設定・モデル一覧が動作する | ローカルOllamaのモデル一覧取得、接続テスト成功 |
| [ ] 4プロバイダーの設定がUI上で切り替え可能 | 設定画面からプロバイダー/モデルを選択・保存できる |
| [ ] フォールバックが動作する | 第一モデル失敗時にフォールバックモデルに自動切替 |
| [ ] コスト管理ダッシュボードが表示される | モデル別/日別のコスト情報が正しく表示される |
| [ ] マルチモデル関連テストが全て通過する | 全テストがグリーン |

---

## Week 7: バッチ処理（8タスク）

### T-7.1: 複数PDFアップロードAPI

| 項目 | 内容 |
|------|------|
| タスク名 | 複数PDFの一括アップロードAPI実装 |
| 説明 | 既存の単体アップロードAPI（`/api/documents/upload`）を拡張し、最大50ファイルの一括アップロードに対応。各ファイルのバリデーション（サイズ30MB以下、ページ数50以下、PDF形式チェック）を並列実行。アップロード進捗をレスポンスで返却 |
| 成果物 | - `src/app/api/documents/upload/route.ts`（既存拡張: 複数ファイル対応、個別バリデーション結果返却）<br>- `src/lib/validators/batch-upload.ts`（一括アップロードのZodスキーマ: ファイル数・サイズ・形式チェック） |
| 依存関係 | T-5.1 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

**バリデーション仕様**:
```
ファイル単位:
  - MIMEタイプ: application/pdf
  - ファイルサイズ: 最大30MB
  - ページ数: 最大50ページ

バッチ単位:
  - 最大ファイル数: 50
  - 最大合計サイズ: 500MB

レスポンス:
{
  "uploaded": [{ "document_id": "uuid", "file_name": "..." }],
  "failed": [{ "file_name": "...", "error": "..." }]
}
```

---

### T-7.2: バッチジョブ作成・実行API

| 項目 | 内容 |
|------|------|
| タスク名 | バッチジョブ作成・実行APIの実装 |
| 説明 | アップロード済みドキュメントに対してスキーマを選択し、バッチジョブを作成して実行するAPI。batch_jobsレコード作成 → batch_job_documentsレコード一括作成 → 並列抽出実行（最大5並列）。各ドキュメントの処理はキューイングし、順次実行。処理結果はドキュメント単位でDB更新 |
| 成果物 | - `src/app/api/extract/batch/route.ts`（POST: バッチジョブ作成・実行開始）<br>- `src/lib/batch/batch-executor.ts`（バッチ実行エンジン: 並列度制御、進捗更新、エラーハンドリング）<br>- `src/lib/batch/queue.ts`（簡易キュー: Promise.allSettled + 並列度制御 concurrency limiter） |
| 依存関係 | T-5.7, T-7.1 |
| 推定工数 | 5時間 |
| ステータス | [ ] |

**バッチ実行フロー**:
```
POST /api/extract/batch
  Request: { schema_id, document_ids[], cascade_enabled, model_config }

  1. batch_jobsレコード作成（status: 'queued'）
  2. batch_job_documentsレコード一括作成（各status: 'queued'）
  3. status → 'running', started_at記録
  4. 並列度5でドキュメントを順次処理:
     - batch_job_documents.status → 'processing'
     - 抽出パイプライン実行（カスケード対応）
     - 成功 → status: 'succeeded', processing_time_ms記録
     - 失敗 → status: 'failed', error_message記録
     - batch_jobs.processed_documents++
  5. 全完了後:
     - 全成功 → batch_jobs.status: 'succeeded'
     - 一部失敗 → batch_jobs.status: 'partial'
     - 全失敗 → batch_jobs.status: 'failed'
     - completed_at記録
```

---

### T-7.3: バッチジョブ状態取得・キャンセル・リトライAPI

| 項目 | 内容 |
|------|------|
| タスク名 | バッチジョブの状態取得・キャンセル・リトライAPIの実装 |
| 説明 | 実行中バッチジョブの進捗取得（ポーリング用）、キャンセル、失敗分リトライのAPIを実装。キャンセルは新規処理の停止（実行中の処理は完了まで待つ）。リトライは失敗ドキュメントのみ再実行 |
| 成果物 | - `src/app/api/extract/batch/[jobId]/route.ts`（GET: ジョブ状態 + ドキュメント別進捗一覧）<br>- `src/app/api/extract/batch/[jobId]/cancel/route.ts`（POST: ジョブキャンセル）<br>- `src/app/api/extract/batch/[jobId]/retry/route.ts`（POST: 失敗分リトライ）<br>- `src/lib/batch/batch-state-manager.ts`（バッチ状態管理: キャンセルフラグ、リトライ対象抽出） |
| 依存関係 | T-7.2 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

---

### T-7.4: バッチアップロードUI

| 項目 | 内容 |
|------|------|
| タスク名 | バッチ用複数ファイルアップロードUIの実装 |
| 説明 | 既存のバッチ画面（`/batch`）にドラッグ&ドロップ対応の複数ファイルアップロードUIを実装。アップロード済みファイルのリスト表示、個別削除、スキーマ選択、カスケード設定を含むバッチジョブ作成フォーム |
| 成果物 | - `src/components/batch/batch-upload-dropzone.tsx`（複数ファイルドラッグ&ドロップ: 50ファイル上限、プログレスバー）<br>- `src/components/batch/batch-file-list.tsx`（アップロードファイル一覧: ステータス、サイズ、個別削除）<br>- `src/components/batch/batch-create-form.tsx`（バッチジョブ作成フォーム: スキーマ選択、カスケード設定、実行ボタン）<br>- `src/app/(dashboard)/batch/page.tsx`（既存拡張: バッチアップロード + ジョブ一覧統合） |
| 依存関係 | T-7.1, T-7.2 |
| 推定工数 | 4時間 |
| ステータス | [ ] |

---

### T-7.5: バッチ進捗・結果表示UI

| 項目 | 内容 |
|------|------|
| タスク名 | バッチジョブの進捗表示・結果一覧UIの実装 |
| 説明 | 実行中バッチジョブのリアルタイム進捗表示（ポーリング間隔3秒）、ドキュメント別ステータス一覧、完了後の結果サマリー、キャンセル・リトライ操作UIを実装 |
| 成果物 | - `src/components/batch/batch-progress.tsx`（進捗表示: 全体プログレスバー、処理済み/全体カウント、推定残り時間）<br>- `src/components/batch/batch-document-list.tsx`（ドキュメント別ステータス一覧: queued/processing/succeeded/failedのアイコン表示）<br>- `src/components/batch/batch-result-summary.tsx`（完了サマリー: 成功/失敗数、処理時間、コスト）<br>- `src/components/batch/batch-actions.tsx`（操作ボタン: キャンセル、リトライ、結果エクスポート）<br>- `src/app/(dashboard)/batch/[jobId]/page.tsx`（既存拡張: 進捗 + 結果表示統合）<br>- `src/hooks/use-batch-job.ts`（バッチジョブ状態のReact Queryフック: ポーリング対応） |
| 依存関係 | T-7.3, T-7.4 |
| 推定工数 | 5時間 |
| ステータス | [ ] |

---

### T-7.6: バッチ結果一括エクスポート

| 項目 | 内容 |
|------|------|
| タスク名 | バッチ結果の一括CSV/Excelエクスポート |
| 説明 | バッチジョブの全結果をまとめてCSVまたはExcelでダウンロード。全ドキュメントの結果を1ファイルに統合する方式と、ドキュメントごとに分割する方式の2パターン。Excelエクスポートのためにxlsx（SheetJS）パッケージを導入 |
| 成果物 | - `package.json`（xlsx追加）<br>- `src/lib/export/excel-generator.ts`（Excelエクスポート: xlsxによるワークブック生成、スタイル設定、ヘッダー/テーブル項目の適切なシート構成）<br>- `src/app/api/export/excel/route.ts`（POST: Excelエクスポート - 単体/バッチ対応）<br>- `src/app/api/export/route.ts`（既存拡張: batch_job_id指定による一括エクスポート対応）<br>- `src/components/results/export-button.tsx`（既存拡張: Excel形式の選択肢追加、バッチ一括エクスポートオプション） |
| 依存関係 | T-7.5 |
| 推定工数 | 4時間 |
| ステータス | [ ] |

**Excelエクスポート仕様**:
```
単体エクスポート:
  - Sheet 1: ヘッダー項目（1行）
  - Sheet 2: テーブル項目（N行）

バッチ一括エクスポート（統合モード）:
  - Sheet 1: 全ドキュメントのヘッダー項目（ドキュメントごとに1行）
  - Sheet 2: 全ドキュメントのテーブル項目（document_id列を追加）

バッチ一括エクスポート（分割モード）:
  - ドキュメントごとにシートを分割
```

---

### T-7.7: バッチ処理エラーハンドリング強化

| 項目 | 内容 |
|------|------|
| タスク名 | バッチ処理のエラーハンドリング・回復機構の強化 |
| 説明 | バッチ処理中のエラーパターン（タイムアウト、レート制限、不正PDF、ストレージエラー）ごとのハンドリングを実装。1ドキュメントの失敗がバッチ全体に影響しない設計。タイムアウト（1ページ30秒）、レート制限検知時の自動スロットリング |
| 成果物 | - `src/lib/batch/error-handler.ts`（バッチエラーハンドラー: エラー分類、リトライ可否判定、スロットリング制御）<br>- `src/lib/batch/timeout-manager.ts`（タイムアウト管理: ページ単位30秒、ドキュメント単位の上限設定）<br>- `src/lib/batch/rate-limiter.ts`（レート制限検知・自動スロットリング: 429検知時に並列度を一時的に下げる） |
| 依存関係 | T-7.2 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

---

### T-7.8: バッチ処理テスト

| 項目 | 内容 |
|------|------|
| タスク名 | バッチ処理のユニットテスト・統合テスト |
| 説明 | バッチ実行エンジン、キュー、状態管理、エラーハンドリング、Excelエクスポートのテスト。AIモデル呼び出しはモック化し、バッチフロー全体の統合テストも実施 |
| 成果物 | - `tests/unit/batch-executor.test.ts`（バッチ実行: 並列度制御、進捗更新、部分失敗時の継続）<br>- `tests/unit/batch-state-manager.test.ts`（状態管理: キャンセル、リトライ対象抽出）<br>- `tests/unit/excel-generator.test.ts`（Excelエクスポート: ワークブック構成、データ正確性）<br>- `tests/unit/rate-limiter.test.ts`（レート制限: 429検知、スロットリング）<br>- `tests/integration/batch-flow.test.ts`（統合テスト: アップロード → ジョブ作成 → 実行 → 進捗 → 完了 → エクスポート） |
| 依存関係 | T-7.6, T-7.7 |
| 推定工数 | 4時間 |
| ステータス | [ ] |

---

### Week 7 マイルストーン

| チェック項目 | 基準 |
|-------------|------|
| [ ] 複数PDF一括アップロードが動作する | 最大50ファイルをドラッグ&ドロップでアップロード可能 |
| [ ] バッチジョブが作成・実行される | ジョブ作成 → 並列抽出 → 完了の一連フロー |
| [ ] 進捗がリアルタイムで表示される | ポーリングで処理済み/全体のカウントが更新される |
| [ ] キャンセル・リトライが動作する | 実行中ジョブのキャンセル、失敗分のリトライが可能 |
| [ ] Excelエクスポートが動作する | xlsxフォーマットで正しくダウンロードされる |
| [ ] バッチ結果の一括エクスポートが動作する | 全結果をCSV/Excelでまとめてダウンロード可能 |
| [ ] エラーハンドリングが適切に動作する | 1ドキュメントの失敗がバッチ全体に影響しない |
| [ ] バッチ処理テストが全て通過する | 全テストがグリーン |

---

## Week 8: フィードバックループ（7タスク）

### T-8.1: 修正ログ記録API

| 項目 | 内容 |
|------|------|
| タスク名 | ユーザー修正操作のログ記録API実装 |
| 説明 | 既存の結果修正API（`PUT /api/results/[id]`）を拡張し、修正操作をcorrection_logsテーブルに自動記録。元の値（raw_value）、修正後の値（corrected_value）、修正種別（wrong_value / missing / format_error / extra_field）を保存。インライン編集UIからの修正時に自動でログが記録される |
| 成果物 | - `src/app/api/results/[id]/route.ts`（既存拡張: PUTハンドラーにcorrection_logs書き込みを追加）<br>- `src/lib/feedback/correction-logger.ts`（修正ログ記録ユーティリティ: 差分検出、修正種別自動判定）<br>- `src/lib/validators/correction.ts`（修正ログのZodスキーマ） |
| 依存関係 | T-5.1 |
| 推定工数 | 2時間 |
| ステータス | [ ] |

**修正種別の自動判定**:
```
- raw_value != null && corrected_value != null → 'wrong_value'
- raw_value == null && corrected_value != null → 'missing'
- raw_valueとcorrected_valueが同じ型だが形式が異なる → 'format_error'
- corrected_value == null（フィールド削除） → 'extra_field'
```

---

### T-8.2: Few-shot例蓄積ロジック

| 項目 | 内容 |
|------|------|
| タスク名 | 修正完了後のFew-shot例自動蓄積ロジック |
| 説明 | ユーザーが抽出結果を承認（confirm）した際に、その結果をFew-shot例としてfew_shot_examplesテーブルに蓄積するロジックを実装。帳票種類の自動判定、重複チェック、蓄積上限管理を含む |
| 成果物 | - `src/lib/feedback/few-shot-accumulator.ts`（Few-shot蓄積ロジック: 承認時にfew_shot_examplesへ保存、帳票種類判定、重複チェック）<br>- `src/app/api/results/[id]/confirm/route.ts`（既存拡張: 承認時にFew-shot蓄積を実行）<br>- `src/app/api/few-shot/route.ts`（既存拡張: GET: Few-shot例一覧取得、POST: 手動追加、DELETE: 削除） |
| 依存関係 | T-8.1 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

**蓄積ルール**:
```
1. 結果承認時に自動蓄積候補として判定
2. 同一スキーマ + 同一帳票種類で既に10件以上ある場合、最も古い例を非アクティブ化
3. 抽出結果の修正率が50%以上の場合は低品質として蓄積しない
4. 帳票種類は抽出結果の特徴から自動判定（請求書/納品書/見積書/注文書/領収書/その他）
```

---

### T-8.3: 類似帳票検索（pgvector）

| 項目 | 内容 |
|------|------|
| タスク名 | CLIP埋め込みベクトルによる類似帳票検索の実装 |
| 説明 | 帳票画像のCLIP埋め込みベクトルをpgvectorに保存し、新規帳票入力時にコサイン類似度で類似帳票を検索する機能を実装。CLIP埋め込みは外部API（OpenAI embeddings等）またはローカルモデルで生成。同一発行元の帳票を優先選択するロジックを含む |
| 成果物 | - `src/lib/feedback/embedding-generator.ts`（CLIP埋め込み生成: 帳票画像 → OpenAI embedding API → 512次元ベクトル）<br>- `src/lib/feedback/similar-document-search.ts`（類似帳票検索: pgvectorコサイン類似度、同一発行元優先、上位3件取得）<br>- `src/app/api/few-shot/similar/route.ts`（既存拡張: GET: 類似帳票のFew-shot例検索 - document_id指定） |
| 依存関係 | T-8.2 |
| 推定工数 | 4時間 |
| ステータス | [ ] |

**類似帳票検索フロー**:
```
1. 新規帳票アップロード時（または抽出実行時）にCLIP埋め込みを生成
2. documents.embeddingに保存
3. 抽出実行時に類似帳票検索:
   SELECT f.*, d.file_name,
          1 - (d.embedding <=> input_embedding) as similarity
   FROM few_shot_examples f
   JOIN documents d ON f.document_id = d.id
   WHERE f.schema_id = target_schema_id
     AND f.is_active = true
   ORDER BY
     CASE WHEN d.vendor_name = target_vendor THEN 0 ELSE 1 END,
     d.embedding <=> input_embedding
   LIMIT 3;
4. 取得した例をFew-shotとしてプロンプトに動的注入
```

---

### T-8.4: プロンプトへの動的Few-shot注入

| 項目 | 内容 |
|------|------|
| タスク名 | 類似帳票のFew-shot例をプロンプトに動的注入する機構の実装 |
| 説明 | 抽出実行時に類似帳票検索で取得したFew-shot例を、既存のプロンプトテンプレートに動的に注入する機構を実装。Static Content（キャッシュ対象）とDynamic Content（毎回変動）を分離し、Few-shot例はDynamic Contentとして挿入。例の数（0-3件）に応じたプロンプト構成 |
| 成果物 | - `src/lib/ai/prompts/few-shot-injector.ts`（Few-shot動的注入: 類似帳票のFew-shot例をプロンプトに挿入するユーティリティ）<br>- `src/lib/ai/prompts/extraction.ts`（既存拡張: Dynamic Content部分にFew-shotスロットを追加）<br>- `src/lib/ai/extractor.ts`（既存拡張: 抽出実行前にFew-shot例を取得・注入するフローを追加） |
| 依存関係 | T-8.3 |
| 推定工数 | 3時間 |
| ステータス | [ ] |

**プロンプト構成（Few-shot注入後）**:
```
[System Prompt -- Static/キャッシュ対象]
  帳票抽出専門家ロール、抽出ルール、日本語特有ルール

[Output Schema -- Static/キャッシュ対象]
  Zodスキーマから生成されたJSON Schema

[Fixed Few-shot -- Static/キャッシュ対象]
  固定の代表例（2-3件）

[Dynamic Few-shot -- 毎回変動]
  類似帳票検索で取得した例（0-3件）
  ※ 見つからない場合はこのセクションを省略

[Target Image -- 毎回変動]
  対象の帳票画像

[Additional Instructions -- 毎回変動]
  帳票固有の追加指示
```

---

### T-8.5: Few-shot管理UI

| 項目 | 内容 |
|------|------|
| タスク名 | Few-shotライブラリ管理画面の実装 |
| 説明 | 蓄積されたFew-shot例の一覧表示、詳細確認、手動追加/削除、アクティブ/非アクティブ切替の管理画面を実装。スキーマ別・帳票種類別のフィルタリング、蓄積状況の統計表示を含む |
| 成果物 | - `src/app/(dashboard)/few-shot/page.tsx`（Few-shotライブラリ画面: 一覧 + フィルタ + 統計）<br>- `src/components/few-shot/few-shot-list.tsx`（Few-shot例一覧テーブル: スキーマ名、帳票種類、作成日、アクティブ状態）<br>- `src/components/few-shot/few-shot-detail-dialog.tsx`（詳細ダイアログ: 元画像プレビュー、抽出データ表示）<br>- `src/components/few-shot/few-shot-stats.tsx`（蓄積統計: スキーマ別・帳票種類別の件数）<br>- `src/hooks/use-few-shot.ts`（Few-shot例のReact Queryフック） |
| 依存関係 | T-8.2, T-8.4 |
| 推定工数 | 4時間 |
| ステータス | [ ] |

---

### T-8.6: 修正パターン統計・フィードバックダッシュボード

| 項目 | 内容 |
|------|------|
| タスク名 | 修正パターン統計の集計・可視化 |
| 説明 | correction_logsの修正パターンを集計し、フィールド別・修正種別ごとの頻度を可視化。頻出する修正パターンのレポートを表示。プロンプト改善のヒントとして活用可能な情報を提供 |
| 成果物 | - `src/app/api/feedback/stats/route.ts`（既存拡張: GET: 修正パターン統計 - フィールド別、種別ごと、期間指定）<br>- `src/app/(dashboard)/settings/feedback/page.tsx`（フィードバックダッシュボード画面）<br>- `src/components/feedback/correction-stats.tsx`（修正パターン統計: フィールド別修正率、頻出修正パターンTOP10）<br>- `src/components/feedback/field-accuracy-chart.tsx`（フィールド別精度チャート: recharts使用）<br>- `src/hooks/use-feedback-stats.ts`（フィードバック統計のReact Queryフック） |
| 依存関係 | T-8.1 |
| 推定工数 | 4時間 |
| ステータス | [ ] |

---

### T-8.7: Phase 2品質ゲート確認・統合テスト

| 項目 | 内容 |
|------|------|
| タスク名 | Phase 2品質ゲート確認、統合テスト、最終調整 |
| 説明 | Phase 2の全品質ゲート項目を確認。カスケード抽出による精度90%以上の検証（主要帳票5種）、バッチ処理E2E（10ファイル一括）、フィードバックループ動作確認。不合格項目の修正。ナビゲーション整合性確認（Few-shot画面、設定画面のサブページ追加） |
| 成果物 | - `tests/integration/cascade-e2e.test.ts`（カスケード抽出E2E: 5種帳票 x Stage 1+2 → 精度90%検証）<br>- `tests/integration/batch-e2e.test.ts`（バッチ処理E2E: 10ファイル一括 → 全完了 → エクスポート）<br>- `tests/integration/feedback-loop.test.ts`（フィードバックループE2E: 抽出 → 修正 → 承認 → Few-shot蓄積 → 次回抽出で精度向上）<br>- `src/components/layout/sidebar.tsx`（既存修正: Few-shot、コスト管理、フィードバックへのナビゲーション追加）<br>- `projects/PRJ-003/reports/phase2-completion.md`（Phase 2完了報告書） |
| 依存関係 | T-8.5, T-8.6, T-7.8 |
| 推定工数 | 6時間 |
| ステータス | [ ] |

**Phase 2品質ゲート項目**:
```
1. カスケード抽出による精度90%以上（主要帳票5種: 請求書、納品書、見積書、注文書、領収書）
2. バッチ処理E2E（10ファイル一括処理 → 全完了 → 結果エクスポート）
3. フィードバックループ動作確認（修正 → Few-shot蓄積 → 次回精度向上の検証）
4. コードレビューCRITICAL/HIGH指摘ゼロ
5. マルチモデル動作確認（最低2プロバイダーでの抽出成功）
6. Excelエクスポート動作確認
7. コスト管理ダッシュボード動作確認
```

---

### Week 8 マイルストーン（Phase 2 品質ゲート）

| チェック項目 | 基準 |
|-------------|------|
| [ ] 修正ログが自動記録される | インライン編集 → correction_logsに自動保存 |
| [ ] Few-shot例が蓄積される | 結果承認 → few_shot_examplesに自動保存 |
| [ ] 類似帳票検索が動作する | pgvectorによるコサイン類似度検索で上位3件取得 |
| [ ] Few-shotがプロンプトに動的注入される | 抽出実行時に類似帳票のFew-shot例が含まれる |
| [ ] Few-shot管理UIが動作する | 一覧、詳細、アクティブ切替、削除が可能 |
| [ ] 修正パターン統計が表示される | フィールド別修正率、頻出パターンが可視化される |
| [ ] カスケード抽出で精度90%以上を達成 | 主要帳票5種で検証 |
| [ ] バッチ処理E2Eが成功する | 10ファイル一括 → 全完了 → エクスポート |
| [ ] フィードバックループが動作する | 修正 → Few-shot蓄積 → 次回精度向上の確認 |
| [ ] レビュー部門への検収依頼準備完了 | Phase 2完了報告書ドラフト作成 |

---

## タスクサマリー

### 全タスク一覧

| Week | タスクID | タスク名 | 推定工数 | 依存関係 |
|------|---------|---------|---------|---------|
| 5 | T-5.1 | カスケード抽出 API設計・型定義 | 3h | - |
| 5 | T-5.2 | Stage 2 高精度VLM抽出エンジン | 5h | T-5.1 |
| 5 | T-5.3 | Chain-of-Thought（CoT）プロンプト | 3h | T-5.2 |
| 5 | T-5.4 | 信頼度スコア改善・閾値設定 | 3h | T-5.2 |
| 5 | T-5.5 | 手動確認フラグUI・カスケード結果表示 | 3h | T-5.4 |
| 5 | T-5.6 | カスケード設定UI | 3h | T-5.4, T-5.1 |
| 5 | T-5.7 | 抽出パイプライン統合（カスケード対応） | 4h | T-5.2, T-5.3, T-5.4 |
| 5 | T-5.8 | カスケード抽出ユニットテスト | 3h | T-5.7 |
| 6 | T-6.1 | Anthropicプロバイダー実装 | 2h | T-5.1 |
| 6 | T-6.2 | Googleプロバイダー実装 | 2h | T-5.1 |
| 6 | T-6.3 | Ollama接続設定・モデル一覧 | 2h | T-5.6 |
| 6 | T-6.4 | AIモデル設定UI拡張（マルチプロバイダー） | 4h | T-6.1, T-6.2, T-6.3 |
| 6 | T-6.5 | モデルフォールバック機構 | 3h | T-6.1, T-6.2 |
| 6 | T-6.6 | コスト管理ダッシュボード | 4h | T-5.7 |
| 6 | T-6.7 | マルチモデル統合テスト | 3h | T-6.5, T-6.6 |
| 7 | T-7.1 | 複数PDFアップロードAPI | 3h | T-5.1 |
| 7 | T-7.2 | バッチジョブ作成・実行API | 5h | T-5.7, T-7.1 |
| 7 | T-7.3 | バッチジョブ状態取得・キャンセル・リトライAPI | 3h | T-7.2 |
| 7 | T-7.4 | バッチアップロードUI | 4h | T-7.1, T-7.2 |
| 7 | T-7.5 | バッチ進捗・結果表示UI | 5h | T-7.3, T-7.4 |
| 7 | T-7.6 | バッチ結果一括エクスポート | 4h | T-7.5 |
| 7 | T-7.7 | バッチ処理エラーハンドリング強化 | 3h | T-7.2 |
| 7 | T-7.8 | バッチ処理テスト | 4h | T-7.6, T-7.7 |
| 8 | T-8.1 | 修正ログ記録API | 2h | T-5.1 |
| 8 | T-8.2 | Few-shot例蓄積ロジック | 3h | T-8.1 |
| 8 | T-8.3 | 類似帳票検索（pgvector） | 4h | T-8.2 |
| 8 | T-8.4 | プロンプトへの動的Few-shot注入 | 3h | T-8.3 |
| 8 | T-8.5 | Few-shot管理UI | 4h | T-8.2, T-8.4 |
| 8 | T-8.6 | 修正パターン統計・フィードバックダッシュボード | 4h | T-8.1 |
| 8 | T-8.7 | Phase 2品質ゲート確認・統合テスト | 6h | T-8.5, T-8.6, T-7.8 |

### 工数サマリー

| Week | タスク数 | 合計工数 |
|------|---------|---------|
| Week 5 | 8 | 27h |
| Week 6 | 7 | 20h |
| Week 7 | 8 | 31h |
| Week 8 | 7 | 26h |
| **合計** | **30** | **104h** |

### 依存関係図（クリティカルパス）

```
T-5.1 ─┬─ T-5.2 ─┬─ T-5.3 ──────────────────────────────────┐
        │         │                                           │
        │         ├─ T-5.4 ─┬─ T-5.5                         │
        │         │          │                                │
        │         │          ├─ T-5.6 ── T-6.3 ── T-6.4      │
        │         │          │                                │
        │         └──────────┴─ T-5.7 ─┬─ T-5.8              │
        │                              │                      │
        │                              ├─ T-6.6 ── T-6.7     │
        │                              │                      │
        │                              ├─ T-7.2 ─┬─ T-7.3 ──┤
        │                              │          │           │
        │                              │          │  T-7.7 ──┤
        │                              │          │           │
        ├─ T-6.1 ─┬─ T-6.4           │          │           │
        │          │                   │          │           │
        ├─ T-6.2 ─┤                   │          │           │
        │          │                   │          │           │
        │          └─ T-6.5 ── T-6.7  │          │           │
        │                              │          │           │
        ├─ T-7.1 ─┬───────────────────┘          │           │
        │          │                              │           │
        │          └─ T-7.4 ── T-7.5 ── T-7.6    │           │
        │                                  │      │           │
        │                                  └──────┴─ T-7.8    │
        │                                              │      │
        ├─ T-8.1 ─┬─ T-8.2 ─┬─ T-8.3 ── T-8.4 ──┐  │      │
        │          │          │                     │  │      │
        │          │          └────────────── T-8.5 │  │      │
        │          │                           │    │  │      │
        │          └─ T-8.6                    └────┴──┴── T-8.7
```

**クリティカルパス**: T-5.1 → T-5.2 → T-5.4 → T-5.7 → T-7.2 → T-7.3 → T-7.5 → T-7.6 → T-7.8 → T-8.7

このパスの合計工数: 3 + 5 + 3 + 4 + 5 + 3 + 5 + 4 + 4 + 6 = **42h**

---

## リスク管理

| リスク | 影響度 | 発生確率 | 対策 |
|--------|--------|---------|------|
| カスケード抽出でPhase 2精度目標（90%）に達しない | 高 | 中 | Week 5でサンプル帳票5種の精度を早期検証。CoTプロンプトのチューニング余地を確保。閾値の調整で精度/コストバランスを最適化 |
| マルチプロバイダーSDKのAPI互換性問題 | 中 | 中 | @ai-sdk/anthropic, @ai-sdk/googleの最新ドキュメントを事前確認。構造化出力（Zodスキーマ）の互換性を早期検証。非対応の場合はOpenAI互換ラッパーをフォールバックとして残す |
| pgvectorのCLIP埋め込み生成コスト | 中 | 低 | OpenAI embedding APIのコストを試算（1画像あたり約$0.001以下）。コスト懸念時はアップロード時ではなく承認時のみ埋め込み生成に変更 |
| Week 7のバッチ処理タスク密度が高い（31h） | 中 | 中 | T-7.7（エラーハンドリング強化）はWeek 7前半で着手し、T-7.6（一括エクスポート）と並行して進める。最悪の場合T-7.6の分割モードをWeek 8に延期可能 |
| Vercel Serverless Functionsのタイムアウト（バッチ処理） | 高 | 中 | バッチ実行はバックグラウンド処理パターンを採用。Vercel Hobby: 60秒、Pro: 300秒の制限に注意。大量バッチは分割実行で対応 |
| xlsxパッケージのバンドルサイズ | 低 | 低 | dynamic import()でExcelエクスポート時のみ読み込み。サーバーサイドでの生成のためバンドルサイズへの影響は限定的 |

---

## 備考

- Phase 2ではPhase 1で作成済みのDBテーブルを活用するため、マイグレーション作業は最小限
- マルチプロバイダー対応は正式SDKへの移行が主な作業。Ollamaは既にOpenAI互換で動作するため変更不要
- バッチ処理の並列度（デフォルト5）は設定画面から変更可能にする
- Few-shot蓄積の上限（スキーマあたり30件）は初期値として設定し、運用状況に応じて調整
- Phase 3（プリセットテンプレート、S3連携、プロンプト改善半自動化）への引き継ぎ事項は、Phase 2完了報告書に記載する
- rechartsはコスト管理ダッシュボードとフィードバックダッシュボードの両方で使用するため、Week 6で導入しWeek 8で再利用する
