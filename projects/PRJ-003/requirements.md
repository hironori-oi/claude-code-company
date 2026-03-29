# PRJ-003 要件定義書: 不定様式PDF VLMデータ抽出システム

## 文書情報

| 項目 | 内容 |
|------|------|
| 案件ID | PRJ-003 |
| 案件名 | 不定様式PDF VLMデータ抽出システム |
| 作成日 | 2026-03-26 |
| 作成者 | PM部門 |
| ステータス | 初版 |
| Phase | 要件定義 |
| 関連案件 | PRJ-002（PDF帳票OCR/VLMデータ自動抽出システム） |

---

## 1. プロダクトビジョンとスコープ

### 1.1 プロダクトビジョン

> 多数の取引先から異なるフォーマットの帳票を受け取る中小企業が、テンプレート定義なしで、「何を抽出したいか」を指定するだけでPDFから必要なデータを自動抽出できるWebアプリケーション。

PRJ-002が「定型帳票のテンプレートベース抽出」であるのに対し、PRJ-003は「不定様式帳票のVLM全体解析ベース抽出」を担う。両者は競合ではなく補完関係であり、将来的に統合プラットフォームとして提供することで、定型+不定型を一つのサービスでカバーする唯一のソリューションとなる。

### 1.2 PRJ-002との関係性

| 観点 | PRJ-002（定型帳票） | PRJ-003（不定様式帳票） |
|------|---------------------|------------------------|
| 対象帳票 | 様式が決まっている帳票 | 様式が不定/未知の帳票 |
| 抽出方法 | テンプレート定義 + ドラッグ範囲指定 | 抽出項目定義 + VLM全体解析 |
| 事前準備 | サンプル帳票登録・エリアマッピング必要 | 抽出項目の定義のみ |
| 精度向上 | 範囲指定の精緻化 | プロンプトチューニング・Few-shot・フィードバック |
| ユースケース | 同一取引先からの定型帳票の大量処理 | 多様な取引先からの異なる様式の帳票処理 |

**統合方針**:
- Phase 1-3はPRJ-003を独立プロダクトとして開発する
- リポジトリは別リポジトリとし、技術スタック・UIコンポーネントの共通化を図る
- 将来的な統合（Phase 4以降）に向けて、認証基盤・データエクスポート形式・APIインターフェースの互換性を維持する
- 統合時の自動判定（定型/不定型の振り分け）は将来要件として設計時に考慮する

### 1.3 解決する課題

| 課題 | 現状 | PRJ-003による解決 |
|------|------|------------------|
| テンプレート作成の手間 | 取引先ごとに帳票様式が異なり、都度テンプレート定義が必要 | テンプレート不要。抽出項目を定義するだけで即利用開始 |
| テンプレート管理コスト | 取引先数 x 帳票種類のテンプレートが必要 | 管理対象は抽出項目セットのみ |
| 新規取引先への対応遅延 | テンプレート作成までリードタイムが発生 | 新しい帳票が届いてもそのまま処理可能 |
| 様式変更への追従 | フォーマット変更時に再設定が必要 | VLMが文脈理解で自動対応 |
| 属人化 | テンプレート定義がベテラン依存 | 抽出項目を選ぶだけで誰でも使える |

### 1.4 ターゲットユーザーペルソナ

**ペルソナ1: 物流・運送業の配車担当 田中さん（35歳）**
- 従業員50名の運送会社で配車業務を担当
- 30社以上の荷主から日々異なる様式の配送依頼書が届く
- FAXやPDFで届く伝票を目視で確認し、配車システムに手入力している
- 1日あたり50-100枚の伝票を処理、入力作業に3-4時間を費やす
- ITスキルは基本的なPC操作レベル

**ペルソナ2: 製造業の仕入れ担当 鈴木さん（42歳）**
- 従業員120名の製造業で仕入れ・調達を担当
- 80社以上のサプライヤーから見積書・納品書・請求書が届く
- 品番・数量・単価の突合作業に毎月丸2日を費やす
- Excel管理で限界を感じている

**ペルソナ3: 税理士事務所スタッフ 佐藤さん（28歳）**
- 顧問先15社を担当する税理士事務所のスタッフ
- 各顧問先の取引先から届く多種多様な領収書・請求書を処理
- 繁忙期（確定申告時期）は1日200枚以上の帳票を処理
- セキュリティに敏感（顧問先の機密情報を扱う）

---

## 2. 機能要件（MoSCoW法）

### 2.1 Must（必須）-- Phase 1-2で実装

#### A. 抽出スキーマ定義（Extraction Schema）

**概要**: ユーザーが帳票から抽出したい項目を定義する機能。

| 機能ID | 機能名 | 詳細 |
|--------|--------|------|
| A-01 | 抽出項目の追加・編集・削除 | 項目名（表示名）、フィールドキー（英数字）、データ型を設定 |
| A-02 | データ型の選択 | テキスト / 数値 / 日付 / 金額 / 電話番号 / 郵便番号 / メールアドレス / 選択肢 |
| A-03 | バリデーションルール | 正規表現パターン、最小値/最大値、文字数制限、カスタムルール |
| A-04 | 必須/任意の設定 | 項目ごとに必須フラグを設定。必須項目がnullの場合は手動確認フラグ |
| A-05 | グループ化 | ヘッダー項目（1帳票1レコード）とテーブル項目（1帳票N行）の区分 |
| A-06 | 項目の説明文 | VLMへの補足指示として使用（例: 「税込金額を抽出」「和暦は西暦に変換」） |
| A-07 | 抽出スキーマの保存・読込 | 複数のスキーマを作成・管理可能 |

**データ型とバリデーション仕様**:

| データ型 | 正規化ルール | バリデーション例 |
|---------|-------------|----------------|
| テキスト | トリム、全角スペース正規化 | 最大文字数 |
| 数値 | カンマ除去、全角→半角変換 | 最小値/最大値、整数/小数 |
| 日付 | YYYY-MM-DD形式に統一、和暦→西暦変換 | 有効な日付か |
| 金額 | カンマ/円記号除去、整数化 | 正の整数か |
| 電話番号 | ハイフン区切りに統一 | XXX-XXXX-XXXX形式 |
| 郵便番号 | ハイフン区切りに統一 | XXX-XXXX形式 |
| メールアドレス | トリム | RFC 5322準拠 |
| 選択肢 | 完全一致/部分一致 | 定義済みリスト内の値か |

#### B. VLM抽出エンジン

**概要**: リサーチ部門推奨のカスケード抽出アーキテクチャを実装する。

| 機能ID | 機能名 | 詳細 |
|--------|--------|------|
| B-01 | PDF種類自動判定 | テキストPDF / 画像PDF / 混在PDFを自動判定し、最適パイプラインを選択 |
| B-02 | 画像前処理パイプライン | DPI調整（200-300DPI）、コントラスト強調、シャープネス、PNGロスレス出力（sharp使用） |
| B-03 | ページ分割処理 | マルチページPDFをページ単位で分割し個別処理 |
| B-04 | Stage 1: 軽量VLMスクリーニング | Gemini 2.5 Flash / GPT-4o-miniによる一次抽出。全ページを処理 |
| B-05 | 信頼度スコア算出 | VLMの自己申告による各フィールドの信頼度（0.0-1.0）を算出 |
| B-06 | Stage 2: 高精度VLM抽出 | 信頼度0.8未満のフィールドを持つページに対し、GPT-4o / Gemini 2.5 Pro / Claude Sonnet 4.6で再抽出 |
| B-07 | 構造化出力 | AI SDK + Zodスキーマによる型安全な構造化抽出（JSON Schema強制） |
| B-08 | Chain-of-Thought抽出 | Stage 2で段階的思考プロンプトを適用（帳票種類判定→レイアウト分析→フィールド抽出→整合性チェック） |
| B-09 | 後処理・バリデーション | データ型に応じた正規化（和暦変換、全角半角統一等）、正規表現バリデーション、数値整合性チェック |
| B-10 | マルチモデル対応 | OpenAI / Anthropic / Google / Ollama（ローカル）の切り替え |
| B-11 | APIキー管理 | プロバイダーごとのAPIキーをシステム設定で管理。サーバーサイドプロキシパターン（PRJ-002実績）で安全に保持 |

**カスケード抽出パイプライン**:

```
[PDF入力]
    |
    v
[PDF種類判定] --- テキストPDF --> [pdf.jsテキスト抽出 --> LLM構造化]
    |                                                      |
    | 画像PDF/混在                                           |
    v                                                      |
[画像前処理（300DPI, コントラスト強調, sharp）]                  |
    |                                                      |
    v                                                      |
[Stage 1: 軽量VLMスクリーニング]                               |
    | Gemini 2.5 Flash / GPT-4o-mini                       |
    | + 構造化出力（Zodスキーマ）                               |
    | + 動的Few-shot（類似帳票検索）                            |
    |                                                      |
    v                                                      |
[信頼度判定]                                                  |
    |                                                      |
    +-- 高信頼度(>=0.8) --> [後処理・バリデーション] <-----------+
    |                               |
    +-- 低信頼度(<0.8) --> [Stage 2: 高精度VLM]
                            | GPT-4o / Gemini 2.5 Pro / Claude Sonnet 4.6
                            | + CoTプロンプト
                            | + OCRハイブリッド（任意）
                            v
                         [後処理・バリデーション]
                            |
                            v
                       [結果出力 + 手動確認フラグ]
```

**VLM+OCRハイブリッド戦略**（Stage 2オプション）:
- 画像PDF（低品質スキャン）の場合、OCR（pdf.jsテキストレイヤー or 外部OCR）で取得したテキストをVLMプロンプトに参考情報として含める
- VLMは画像を直接見つつ、OCRテキストを補助的に参照して精度を向上

**プロンプトテンプレート構成**:

```
[Static Content -- キャッシュ対象]
  - システムプロンプト（帳票抽出専門家ロール、抽出ルール、日本語特有ルール）
  - 出力スキーマ定義（Zodから自動生成）
  - 固定Few-shot例（2-3件の代表例）

[Dynamic Content -- 毎回変動]
  - 動的に選択された類似帳票のFew-shot例（0-2件）
  - 対象の帳票画像
  - 帳票固有の追加指示
```

#### B2. マスタデータ照合（Master Data Matching）

**概要**: 抽出項目ごとに「マスタデータとの照合」のON/OFFを設定可能にし、ONの場合は事前に登録したマスタデータと突合して抽出結果の正確性を検証する機能。

| 機能ID | 機能名 | 詳細 |
|--------|--------|------|
| M-01 | マスタデータ登録 | マスタデータセットの作成（名称、説明）。CSV/手動入力でマスタレコードを登録 |
| M-02 | マスタレコード管理 | マスタレコードのCRUD操作。CSVインポート/エクスポート対応 |
| M-03 | 項目別マスタ照合ON/OFF | 抽出フィールドごとにマスタ照合の有効/無効を切り替え |
| M-04 | 照合対象マスタの選択 | 照合ONのフィールドに対し、どのマスタデータセットと照合するかを選択 |
| M-05 | 照合方式の設定 | 完全一致 / 部分一致（前方/後方/部分） / あいまい一致（レーベンシュタイン距離）から選択 |
| M-06 | 照合結果の表示 | 抽出結果がマスタに含まれている場合は正常表示、含まれていない場合は不一致フラグ付きで強調表示 |
| M-07 | 不一致時の候補提示 | マスタに不一致の場合、類似するマスタレコードの候補を提示（あいまい検索） |
| M-08 | マスタからの選択修正 | 不一致フィールドに対し、マスタレコード一覧から正しい値を選択して修正可能 |

**マスタ照合のユースケース例**:

| 抽出項目 | 照合マスタ | 照合方式 | 目的 |
|---------|-----------|---------|------|
| 得意先名 | 得意先マスタ | あいまい一致 | 表記揺れ（(株) vs 株式会社）を吸収して正規名称に統一 |
| 品目名 | 商品マスタ | 部分一致 | 略称・別称を正規品名に変換 |
| 品番 | 品番マスタ | 完全一致 | 品番の正確性を検証 |
| 勘定科目 | 勘定科目マスタ | 完全一致 | 仕訳の正確性を担保 |

**マスタ照合パイプライン**:

```
[VLM抽出結果]
    |
    v
[フィールドごとにマスタ照合ON/OFFを判定]
    |
    +-- 照合OFF --> そのまま結果出力
    |
    +-- 照合ON --> [マスタデータセット検索]
                      |
                      +-- 一致あり --> 正常表示（マスタ正規値で上書きオプション）
                      |
                      +-- 一致なし --> 不一致フラグ + 類似候補提示
                                        |
                                        v
                                  [ユーザーが候補から選択 or 手動修正]
```

**DBスキーマ追加**:

```
-- マスタデータセット
master_datasets
  - id: UUID PK
  - name: TEXT NOT NULL
  - description: TEXT
  - user_id: UUID FK
  - created_at: TIMESTAMPTZ
  - updated_at: TIMESTAMPTZ

-- マスタレコード
master_records
  - id: UUID PK
  - dataset_id: UUID FK -> master_datasets(id) ON DELETE CASCADE
  - value: TEXT NOT NULL
  - aliases: JSONB (別名・略称のリスト)
  - metadata: JSONB (追加情報、例: 電話番号、住所等)
  - sort_order: INT DEFAULT 0
  - created_at: TIMESTAMPTZ
  - UNIQUE(dataset_id, value)
```

**API追加**:

| メソッド | パス | 概要 |
|---------|------|------|
| GET | /api/masters | マスタデータセット一覧取得 |
| POST | /api/masters | マスタデータセット作成 |
| GET | /api/masters/[id] | マスタデータセット詳細取得 |
| PUT | /api/masters/[id] | マスタデータセット更新 |
| DELETE | /api/masters/[id] | マスタデータセット削除 |
| GET | /api/masters/[id]/records | マスタレコード一覧取得 |
| POST | /api/masters/[id]/records | マスタレコード追加（単体/CSV一括） |
| PUT | /api/masters/[id]/records/[recordId] | マスタレコード更新 |
| DELETE | /api/masters/[id]/records/[recordId] | マスタレコード削除 |
| POST | /api/masters/[id]/import | CSVインポート |
| GET | /api/masters/[id]/export | CSVエクスポート |
| POST | /api/masters/match | 照合実行（値 + データセットID → 一致/候補） |

#### C. フィードバックループ（精度向上の核心機構）

| 機能ID | 機能名 | 詳細 |
|--------|--------|------|
| C-01 | 修正ログの記録 | ユーザーの修正操作（元の値、修正後の値、修正種別）をDBに記録 |
| C-02 | 成功抽出例のFew-shotライブラリ化 | ユーザーが修正した正しい結果を、将来のFew-shot例として蓄積 |
| C-03 | 帳票類似度による動的例示選択 | 新規帳票の入力時に、類似帳票の成功例をFew-shotとして自動選択（2-3件） |
| C-04 | 修正パターンの統計分析 | 頻出する修正パターンを集計し、管理画面で可視化 |
| C-05 | プロンプト改善の半自動化 | 修正パターン分析結果から改善案を提示し、管理者の承認でプロンプトに反映 |

**修正ログのデータモデル**:

```
correction_logs:
  - id: UUID
  - document_id: UUID (FK -> documents)
  - extraction_schema_id: UUID (FK -> extraction_schemas)
  - field_key: TEXT
  - raw_value: TEXT (VLMの抽出値)
  - corrected_value: TEXT (ユーザーの修正値)
  - correction_type: ENUM ('wrong_value', 'missing', 'format_error', 'extra_field')
  - created_at: TIMESTAMPTZ
```

**類似帳票検索の実装方針**:
- 帳票画像のCLIP埋め込みベクトルをSupabase pgvectorに保存
- 新規帳票入力時にコサイン類似度で最も似た成功抽出例を上位2-3件取得
- 取得した例をFew-shotとしてプロンプトに動的追加
- 同一ベンダー（発行元）の帳票は最優先で選択

#### D. 抽出結果の表示・編集

| 機能ID | 機能名 | 詳細 |
|--------|--------|------|
| D-01 | 抽出結果一覧表示 | ヘッダー項目 + テーブル項目を帳票単位で一覧表示 |
| D-02 | 信頼度スコア表示 | フィールドごとに信頼度を色分け表示（高: 緑 / 中: 黄 / 低: 赤） |
| D-03 | 手動確認フラグ | 信頼度0.8未満、バリデーション不合格のフィールドにフラグ表示 |
| D-04 | インライン編集 | 各フィールドをクリックして直接編集可能 |
| D-05 | 差分追跡 | rawValue（VLM抽出値）と editedValue（ユーザー修正値）を保持 |
| D-06 | PDFプレビュー連携 | 抽出元PDFをサイドバイサイドで表示し、対象箇所を目視確認可能 |
| D-07 | 一括承認 | 信頼度が高い結果をまとめて承認する操作 |

#### E. バッチ処理

| 機能ID | 機能名 | 詳細 |
|--------|--------|------|
| E-01 | 複数PDFアップロード | ドラッグ&ドロップまたはファイル選択で複数PDF一括アップロード（最大50ファイル） |
| E-02 | バッチジョブ作成 | アップロードされたPDF群に対して抽出スキーマを選択し、バッチジョブを作成 |
| E-03 | 進捗管理 | ジョブ全体の進捗（処理済み/全体）をリアルタイム表示 |
| E-04 | ステータス管理 | QUEUED -> RUNNING -> SUCCEEDED / PARTIAL / FAILED の状態遷移 |
| E-05 | エラーハンドリング | 個別PDF単位でのエラーハンドリング。失敗PDFがあってもバッチ全体は継続 |
| E-06 | リトライ | 失敗したPDFのみ再処理可能 |
| E-07 | キャンセル | 実行中バッチジョブのキャンセル |

**バッチ処理仕様**:
- 最大同時処理ファイル数: 50ファイル/バッチ
- 1ファイル最大サイズ: 30MB
- 1ファイル最大ページ数: 50ページ
- API並列呼出数: 5（レート制限考慮、設定で変更可能）
- タイムアウト: 1ページあたり30秒
- リトライ: 最大3回、2秒間隔
- モデルフォールバック: 第一モデル失敗時は代替モデルに自動切替

#### F. エクスポート

| 機能ID | 機能名 | 詳細 |
|--------|--------|------|
| F-01 | CSVエクスポート | 抽出結果をCSV形式でダウンロード。エンコーディング選択（UTF-8 BOM / UTF-8 / Shift_JIS） |
| F-02 | Excelエクスポート | 抽出結果をExcel形式（.xlsx）でダウンロード |
| F-03 | バッチ結果一括エクスポート | バッチジョブの全結果をまとめてCSV/Excelでダウンロード |

### 2.2 Should（希望）-- Phase 2-3で実装

#### G. プリセットテンプレート

| 機能ID | 機能名 | 詳細 |
|--------|--------|------|
| G-01 | 請求書プリセット | 発行元、発行先、請求日、請求番号、明細（品名/数量/単価/金額）、合計金額、消費税、振込先 |
| G-02 | 納品書プリセット | 納品先、納品日、納品書番号、明細（品名/数量）、備考 |
| G-03 | 見積書プリセット | 見積先、見積日、有効期限、明細（品名/数量/単価/金額）、合計金額、備考 |
| G-04 | 注文書プリセット | 発注先、発注日、注文番号、明細（品名/品番/数量/単価/金額）、納期 |
| G-05 | 領収書プリセット | 発行元、宛名、金額、日付、但し書き |
| G-06 | カスタムプリセット作成 | ユーザーが独自のプリセットを作成・保存可能 |

#### H. 高度な信頼度スコアリング

| 機能ID | 機能名 | 詳細 |
|--------|--------|------|
| H-01 | アンサンブル検証 | 重要帳票に対して複数モデルで並列抽出し、一致率を信頼度として算出 |
| H-02 | 信頼度閾値のカスタマイズ | 手動確認フラグの閾値（デフォルト0.8）をユーザーが変更可能 |
| H-03 | 精度統計ダッシュボード | 帳票種類別・フィールド別の精度統計を可視化 |

#### I. S3連携

| 機能ID | 機能名 | 詳細 |
|--------|--------|------|
| I-01 | S3アップロード | 抽出結果CSVをS3バケットに自動アップロード |
| I-02 | S3接続設定 | エンドポイント、バケット名、アクセスキーの設定。S3互換サービス対応 |
| I-03 | S3接続テスト | 保存前に接続テスト実行可能 |

### 2.3 Could（あれば嬉しい）-- Phase 4以降

| 機能ID | 機能名 | 詳細 |
|--------|--------|------|
| J-01 | PRJ-002との統合 | 定型/不定型の自動判定と振り分け |
| J-02 | 抽出結果API提供 | 外部システム連携用REST API |
| J-03 | Webhook通知 | バッチ完了時のWebhook送信 |
| J-04 | 自動監視プロファイル | フォルダ監視による自動バッチジョブ作成 |
| J-05 | 学習データの自動最適化 | 蓄積されたフィードバックから自動的にFew-shot例を最適化 |

### 2.4 Won't（対象外）

| 項目 | 理由 |
|------|------|
| モバイルアプリ | 初期リリースではWebのみ |
| 手書き文字認識 | 初期リリースでは印刷文字のみ（手書き混在帳票の印刷部分は対象） |
| マルチテナント | Phase 1ではシングルテナント。将来的にマルチテナント化を見据えた設計にする |
| 多言語対応 | 初期リリースでは日本語帳票のみ |
| VLMファインチューニング | 開発コストが高く、プロンプトエンジニアリングで十分な精度が期待できる |

### 2.5 システム管理機能

| 機能ID | 機能名 | 詳細 |
|--------|--------|------|
| K-01 | AIモデル設定 | プロバイダー選択（OpenAI / Anthropic / Google / Ollama）、モデル選択、APIキー設定 |
| K-02 | カスケード設定 | Stage 1/Stage 2のモデル選択、信頼度閾値、フォールバックモデルの設定 |
| K-03 | プロンプトカスタマイズ | システムプロンプト、抽出指示テンプレートの編集 |
| K-04 | コスト管理ダッシュボード | モデル別/日別のAPI呼出数・トークン消費量・推定コストの表示 |
| K-05 | Ollama接続設定 | ローカルOllamaサーバーのURL設定、接続テスト、利用可能モデル一覧取得 |
| K-06 | 画像前処理設定 | DPI設定、コントラスト強調有無、最大画像サイズの設定 |

---

## 3. 非機能要件

### 3.1 パフォーマンス要件

| 指標 | 目標値 | 備考 |
|------|--------|------|
| ページ読み込み（SPA遷移） | 200ms以下 | SWRキャッシュ+同期初期値パターン適用（PRJ-002実績） |
| 初回ページ読み込み | 2.5秒以下（LCP） | |
| API応答（CRUD操作） | 500ms以下 | |
| 1ページあたり抽出時間（Stage 1） | 3秒以下 | 軽量モデル使用時 |
| 1ページあたり抽出時間（Stage 2） | 10秒以下 | 高精度モデル使用時 |
| バッチ処理スループット | 100ページ/10分 | API並列呼出5並列時 |
| Core Web Vitals | LCP < 2.5s, INP < 200ms, CLS < 0.1 | |

### 3.2 セキュリティ要件

| 要件 | 仕様 |
|------|------|
| 認証 | Supabase Auth（メール/パスワード認証） |
| 通信暗号化 | TLS 1.3（HTTPS必須） |
| APIキーの管理 | サーバーサイドのみで保持。環境変数またはDB暗号化カラム |
| VLM APIプロキシ | ブラウザ -> API Route -> VLM API の3層構成（PRJ-002実績） |
| PDFファイルの保管 | Supabase Storage（RLSでアクセス制御） |
| セキュリティヘッダー | next.config.tsで標準セキュリティヘッダーを設定（CSP, X-Frame-Options等） |
| 入力バリデーション | サーバーサイドでZodスキーマによるバリデーション |
| レートリミット | API Route単位でのレート制限 |
| 機密帳票のローカル処理 | Ollama利用時はデータが一切外部に送信されない設計 |
| 各VLMプロバイダーのデータポリシー | API経由のデータはモデル学習に使用されない設定をデフォルトにする |

### 3.3 スケーラビリティ

| 処理量 | アーキテクチャ | インフラ |
|--------|-------------|---------|
| ~100ページ/日 | シンプルなキュー処理 | Vercel Serverless Functions |
| ~1,000ページ/日 | Worker + キュー | Vercel + Upstash Redis Queue |
| ~10,000ページ/日 | 分散Worker | 専用サーバー + BullMQ |

Phase 1では~100ページ/日を目標とし、Vercel Serverless Functionsで実装する。処理量の増加に応じてUpstash Redisキューを導入する。

### 3.4 可用性

| 指標 | 目標 |
|------|------|
| アプリケーション可用性 | 99.5%（Vercel SLA準拠） |
| データバックアップ | Supabaseの自動バックアップ（日次） |
| 障害復旧時間 | 4時間以内 |
| VLM API障害時の対応 | マルチプロバイダーフォールバックで可用性を確保 |

---

## 4. 技術アーキテクチャ概要

### 4.1 システム構成

```
[ブラウザ（Next.js App Router, React, Tailwind CSS, shadcn/ui）]
    |
    v
[Vercel Edge / Serverless Functions]
    |
    +---> [Supabase PostgreSQL] -- データ永続化
    |         +-- pgvector (類似帳票検索)
    |
    +---> [Supabase Storage] -- PDFファイル保管
    |
    +---> [Supabase Auth] -- 認証
    |
    +---> [VLM API Proxy (API Routes)]
    |         +---> OpenAI API (GPT-4o / GPT-4o-mini)
    |         +---> Anthropic API (Claude Sonnet 4.6)
    |         +---> Google AI API (Gemini 2.5 Pro / Flash)
    |         +---> Ollama Local Server (Qwen2.5-VL)
    |
    +---> [Upstash Redis] -- バッチ処理キュー（Phase 2以降）
```

### 4.2 技術スタック

| カテゴリ | 技術 | 選定理由 |
|---------|------|---------|
| フレームワーク | Next.js (App Router) + TypeScript | 社内標準スタック。PRJ-002と共通 |
| UI | shadcn/ui + Tailwind CSS | 社内標準。PRJ-002と統一感のあるUI |
| テーマ | next-themes（ダーク/ライト） | 社内標準 |
| フォント | Geist Sans + Geist Mono | 社内標準 |
| 状態管理/データ取得 | React Query (TanStack Query) | PRJ-002教訓: 自前SWRキャッシュからの改善。標準ライブラリで同等機能 |
| DB | Supabase (PostgreSQL) + pgvector | 社内標準 + 類似帳票検索用ベクトル拡張 |
| 認証 | Supabase Auth | 社内標準 |
| ファイルストレージ | Supabase Storage | 社内標準。PDFファイルの保管 |
| AI連携 | Vercel AI SDK | マルチプロバイダー対応、Zodスキーマ統合、構造化出力 |
| PDF処理 | pdfjs-dist (pdf.js) | テキスト抽出、ページレンダリング、PDF種類判定 |
| 画像前処理 | sharp | Node.jsネイティブ、高速。DPI調整/コントラスト強調 |
| バッチ処理キュー | Upstash Redis（Phase 2以降） | Vercel連携、サーバーレス対応 |
| デプロイ | Vercel | 社内標準。GitHub自動デプロイ |
| テスト | Vitest + Playwright | 社内標準 |
| エラーハンドリング | 構造化エラーユーティリティ | PRJ-002教訓: 初期から統一フレームワークを導入 |

### 4.3 PRJ-002との技術共有方針

PRJ-002の教訓を反映し、以下のパターン・コンポーネントを共通化する:

| 共有対象 | 方針 |
|---------|------|
| サーバーサイドプロキシパターン | PRJ-002で確立した外部API連携のプロキシ構成を踏襲 |
| SWRキャッシュ → React Queryへの移行 | PRJ-002の自前実装の教訓を活かし、React Queryを標準採用 |
| セキュリティヘッダーテンプレート | next.config.tsの共通テンプレートを適用 |
| エラーハンドリングユーティリティ | 構造化ログ+apiError()を初期から導入 |
| UIコンポーネント | shadcn/uiベースの共通コンポーネント設計 |
| CSVエクスポート機能 | エンコーディング選択（UTF-8 BOM / UTF-8 / Shift_JIS）対応 |

### 4.4 DBスキーマ概要

```
-- 抽出スキーマ定義
extraction_schemas
  - id: UUID PK
  - name: TEXT NOT NULL
  - description: TEXT
  - created_at: TIMESTAMPTZ
  - updated_at: TIMESTAMPTZ

-- 抽出フィールド定義
extraction_fields
  - id: UUID PK
  - schema_id: UUID FK -> extraction_schemas(id) ON DELETE CASCADE
  - field_key: TEXT NOT NULL
  - display_name: TEXT NOT NULL
  - data_type: TEXT NOT NULL (text|number|date|amount|phone|postal_code|email|choice)
  - is_required: BOOLEAN DEFAULT false
  - group_type: TEXT NOT NULL (header|table)
  - validation_rules: JSONB
  - description: TEXT
  - sort_order: INT DEFAULT 0
  - master_matching_enabled: BOOLEAN DEFAULT false
  - master_dataset_id: UUID FK -> master_datasets(id) (NULLable)
  - master_match_type: TEXT (exact|prefix|suffix|partial|fuzzy) DEFAULT 'exact'
  - created_at: TIMESTAMPTZ
  - UNIQUE(schema_id, field_key)

-- ドキュメント（アップロードされたPDF）
documents
  - id: UUID PK
  - file_name: TEXT NOT NULL
  - file_path: TEXT NOT NULL (Supabase Storage path)
  - file_size: INT
  - page_count: INT
  - pdf_type: TEXT (text|image|mixed)
  - embedding: VECTOR(512) (CLIP埋め込み -- 類似帳票検索用)
  - created_at: TIMESTAMPTZ

-- バッチジョブ
batch_jobs
  - id: UUID PK
  - schema_id: UUID FK -> extraction_schemas(id)
  - status: TEXT NOT NULL (queued|running|succeeded|partial|failed|cancelled)
  - total_documents: INT
  - processed_documents: INT DEFAULT 0
  - failed_documents: INT DEFAULT 0
  - started_at: TIMESTAMPTZ
  - completed_at: TIMESTAMPTZ
  - created_at: TIMESTAMPTZ

-- バッチジョブ - ドキュメント中間テーブル
batch_job_documents
  - id: UUID PK
  - batch_job_id: UUID FK -> batch_jobs(id) ON DELETE CASCADE
  - document_id: UUID FK -> documents(id)
  - status: TEXT NOT NULL (queued|processing|succeeded|failed)
  - error_message: TEXT
  - processing_time_ms: INT
  - created_at: TIMESTAMPTZ

-- 抽出結果
extraction_results
  - id: UUID PK
  - document_id: UUID FK -> documents(id) ON DELETE CASCADE
  - schema_id: UUID FK -> extraction_schemas(id)
  - batch_job_id: UUID FK -> batch_jobs(id) (NULLable -- 単体処理の場合)
  - page_number: INT
  - model_used: TEXT
  - stage: TEXT (stage1|stage2|text_extraction)
  - extracted_data: JSONB (フィールドごとの抽出結果)
  - corrected_data: JSONB (ユーザー修正後データ、NULLなら修正なし)
  - confidence_scores: JSONB (フィールドごとの信頼度スコア)
  - is_confirmed: BOOLEAN DEFAULT false
  - processing_time_ms: INT
  - token_usage: JSONB (input_tokens, output_tokens, model, cost)
  - created_at: TIMESTAMPTZ
  - updated_at: TIMESTAMPTZ

-- 修正ログ（フィードバックループ用）
correction_logs
  - id: UUID PK
  - document_id: UUID FK -> documents(id)
  - schema_id: UUID FK -> extraction_schemas(id)
  - field_key: TEXT NOT NULL
  - raw_value: TEXT
  - corrected_value: TEXT
  - correction_type: TEXT (wrong_value|missing|format_error|extra_field)
  - created_at: TIMESTAMPTZ

-- Few-shot例ライブラリ
few_shot_examples
  - id: UUID PK
  - schema_id: UUID FK -> extraction_schemas(id)
  - document_id: UUID FK -> documents(id)
  - document_type: TEXT (invoice|delivery_note|quotation|purchase_order|receipt|other)
  - extraction_data: JSONB (正解の抽出結果)
  - embedding: VECTOR(512) (CLIP埋め込み)
  - is_active: BOOLEAN DEFAULT true
  - created_at: TIMESTAMPTZ

-- プロンプトテンプレート
prompt_templates
  - id: UUID PK
  - name: TEXT NOT NULL
  - template_type: TEXT (system|extraction|cot)
  - content: TEXT NOT NULL
  - is_default: BOOLEAN DEFAULT false
  - created_at: TIMESTAMPTZ
  - updated_at: TIMESTAMPTZ

-- AIモデル設定
ai_model_configs
  - id: UUID PK
  - provider: TEXT NOT NULL (openai|anthropic|google|ollama)
  - model_id: TEXT NOT NULL
  - api_key_encrypted: TEXT (Ollamaの場合はNULL)
  - base_url: TEXT (Ollamaのカスタムエンドポイント等)
  - role: TEXT NOT NULL (screening|precision|local)
  - is_active: BOOLEAN DEFAULT true
  - settings: JSONB (temperature, max_tokens等)
  - created_at: TIMESTAMPTZ

-- API使用量ログ（コスト管理用）
api_usage_logs
  - id: UUID PK
  - model_config_id: UUID FK -> ai_model_configs(id)
  - document_id: UUID FK -> documents(id)
  - input_tokens: INT
  - output_tokens: INT
  - estimated_cost: DECIMAL(10, 6)
  - created_at: TIMESTAMPTZ
```

**RLS設計方針**（PRJ-002教訓: 初期段階でRLS設計を確定する）:
- Phase 1はシングルテナントのため、認証ユーザーに対するシンプルなRLSポリシーを設定
- 将来のマルチテナント化を見据え、全テーブルにuser_idまたはtenant_idカラムを初期から含める
- UNIQUE制約は全て `(カラム, user_id)` の複合にする（PRJ-002教訓: マルチテナント不整合の防止）
- schema.sql作成時にRLSポリシーも含めて設計する

### 4.5 API設計概要

| メソッド | パス | 概要 |
|---------|------|------|
| **抽出スキーマ** | | |
| GET | /api/schemas | スキーマ一覧取得 |
| POST | /api/schemas | スキーマ作成 |
| GET | /api/schemas/[id] | スキーマ詳細取得 |
| PUT | /api/schemas/[id] | スキーマ更新 |
| DELETE | /api/schemas/[id] | スキーマ削除 |
| GET | /api/schemas/presets | プリセット一覧取得 |
| **抽出フィールド** | | |
| GET | /api/schemas/[id]/fields | フィールド一覧取得 |
| POST | /api/schemas/[id]/fields | フィールド追加 |
| PUT | /api/schemas/[id]/fields/[fieldId] | フィールド更新 |
| DELETE | /api/schemas/[id]/fields/[fieldId] | フィールド削除 |
| PUT | /api/schemas/[id]/fields/reorder | フィールド並び替え |
| **ドキュメント** | | |
| POST | /api/documents/upload | PDFアップロード（単体/複数） |
| GET | /api/documents | ドキュメント一覧取得 |
| GET | /api/documents/[id] | ドキュメント詳細取得 |
| DELETE | /api/documents/[id] | ドキュメント削除 |
| GET | /api/documents/[id]/preview | PDFプレビュー取得 |
| **抽出処理** | | |
| POST | /api/extract | 単体抽出実行 |
| POST | /api/extract/batch | バッチ抽出実行 |
| GET | /api/extract/batch/[jobId] | バッチジョブ状態取得 |
| POST | /api/extract/batch/[jobId]/cancel | バッチジョブキャンセル |
| POST | /api/extract/batch/[jobId]/retry | 失敗分リトライ |
| **抽出結果** | | |
| GET | /api/results | 結果一覧取得 |
| GET | /api/results/[id] | 結果詳細取得 |
| PUT | /api/results/[id] | 結果修正（編集値保存 + 修正ログ記録） |
| POST | /api/results/[id]/confirm | 結果承認 |
| POST | /api/results/bulk-confirm | 結果一括承認 |
| **エクスポート** | | |
| POST | /api/export/csv | CSVエクスポート |
| POST | /api/export/excel | Excelエクスポート |
| POST | /api/export/s3 | S3アップロード（Phase 2以降） |
| **VLM プロキシ** | | |
| POST | /api/ai/extract | VLM抽出実行（サーバーサイドプロキシ） |
| GET | /api/ai/models | 利用可能モデル一覧取得 |
| POST | /api/ai/test-connection | AI接続テスト |
| **Few-shot/フィードバック** | | |
| GET | /api/few-shot/similar | 類似帳票のFew-shot例検索 |
| POST | /api/few-shot | Few-shot例の追加 |
| GET | /api/feedback/stats | 修正パターン統計 |
| **システム設定** | | |
| GET | /api/settings/ai-models | AIモデル設定取得 |
| PUT | /api/settings/ai-models | AIモデル設定更新 |
| GET | /api/settings/prompts | プロンプトテンプレート取得 |
| PUT | /api/settings/prompts | プロンプトテンプレート更新 |
| GET | /api/settings/usage | API使用量・コスト情報取得 |

### 4.6 画面構成

| 画面 | パス | 概要 |
|------|------|------|
| ダッシュボード | / | 最近の抽出結果、バッチジョブ状態、精度統計サマリー |
| スキーマ管理 | /schemas | 抽出スキーマ一覧、作成、編集 |
| スキーマ詳細 | /schemas/[id] | フィールド定義の編集、プリセット適用 |
| ドキュメント一覧 | /documents | アップロード済みPDF一覧 |
| 単体抽出 | /extract | PDFアップロード → スキーマ選択 → 抽出実行 → 結果表示 |
| バッチ抽出 | /batch | 複数PDFアップロード → バッチジョブ作成 → 進捗表示 |
| バッチ結果 | /batch/[jobId] | バッチジョブの結果一覧、個別結果の確認・修正 |
| 結果詳細 | /results/[id] | 抽出結果の詳細表示・編集（PDF並列表示） |
| エクスポート | /export | 結果の選択・エクスポート実行 |
| Few-shotライブラリ | /few-shot | 蓄積されたFew-shot例の管理 |
| マスタ管理 | /masters | マスタデータセット一覧、作成、CSVインポート/エクスポート |
| マスタ詳細 | /masters/[id] | マスタレコードの管理・編集 |
| 設定 | /settings | AIモデル設定、プロンプト、コスト管理 |

---

## 5. Phase分割計画

### Phase 1: コア機能（MVP） -- 4週間

**目標**: 単体PDFに対する基本的な抽出フローを完成させ、VLMの精度を実際の帳票で検証可能にする。

| 週 | スコープ | 成果物 |
|----|---------|--------|
| 1 | プロジェクトセットアップ、DBスキーマ設計・マイグレーション、認証基盤 | schema.sql（RLSポリシー含む）、プロジェクト骨格 |
| 2 | 抽出スキーマ定義UI（CRUD）、マスタデータ管理UI、PDFアップロード・プレビュー | スキーマ管理画面、マスタ管理画面、ドキュメントアップロード画面 |
| 3 | VLM抽出エンジン（Stage 1のみ）、構造化出力、後処理バリデーション | 単体抽出機能 |
| 4 | 抽出結果表示・編集UI、CSVエクスポート、結合テスト | 結果確認・修正画面、MVP完成 |

**Phase 1の成果物**:
- 抽出スキーマの作成・編集・削除
- マスタデータ管理（CRUD、CSVインポート/エクスポート）
- 項目別マスタ照合設定（ON/OFF、照合対象マスタ選択、照合方式設定）
- PDFアップロード・プレビュー
- 単体PDF抽出（Stage 1: 軽量VLM 1モデル）
- 抽出結果の表示・インライン編集・差分追跡
- マスタ照合結果の表示（不一致フラグ、類似候補提示、マスタからの選択修正）
- CSVエクスポート（UTF-8 BOM）
- AIモデル設定（1プロバイダー: OpenAI）

**品質ゲート**:
- 基本CRUDのE2Eテスト合格
- 請求書10種での抽出テスト実施（精度目標80%以上）
- セキュリティヘッダー設定完了
- RLSポリシー動作確認

### Phase 2: 精度向上 + バッチ -- 4週間

**目標**: カスケード抽出とフィードバックループにより精度を向上させ、バッチ処理で業務利用に耐えるレベルにする。

| 週 | スコープ | 成果物 |
|----|---------|--------|
| 5 | カスケード抽出（Stage 2追加）、信頼度スコア、手動確認フラグ | 2段階カスケードパイプライン |
| 6 | マルチモデル対応（Anthropic / Google / Ollama追加）、CoTプロンプト | マルチプロバイダー対応 |
| 7 | バッチ処理（アップロード、ジョブ管理、進捗、エラーハンドリング） | バッチ抽出機能 |
| 8 | フィードバックループ（修正ログ、Few-shot蓄積、類似帳票検索）、Excelエクスポート | フィードバック機構、Phase 2完成 |

**Phase 2の成果物**:
- カスケード抽出（Stage 1 + Stage 2）
- マルチモデル対応（OpenAI / Anthropic / Google / Ollama）
- バッチ処理（最大50ファイル、進捗管理、エラーハンドリング）
- フィードバックループ（修正ログ記録、Few-shot例蓄積、類似帳票検索）
- 信頼度スコア表示、手動確認フラグ
- Excelエクスポート
- コスト管理ダッシュボード

**品質ゲート**:
- カスケード抽出による精度90%以上の達成（主要帳票5種で検証）
- バッチ処理のE2Eテスト合格（10ファイル一括処理）
- フィードバックループの動作確認（修正→Few-shot蓄積→次回精度向上の検証）
- コードレビュー完了（CRITICAL/HIGH指摘ゼロ）

### Phase 3: 強化 + 本番準備 -- 3週間

**目標**: プリセット、S3連携等のShouldを実装し、本番運用に向けた安定性・パフォーマンスを確保する。

| 週 | スコープ | 成果物 |
|----|---------|--------|
| 9 | プリセットテンプレート、精度統計ダッシュボード、画像前処理パイプライン強化 | プリセット機能、統計画面 |
| 10 | S3連携、プロンプト改善半自動化、パフォーマンスチューニング | S3連携、プロンプト最適化 |
| 11 | E2Eテスト充実、セキュリティレビュー、本番デプロイ準備 | Phase 3完成、本番リリース候補 |

**Phase 3の成果物**:
- プリセットテンプレート（請求書、納品書、見積書、注文書、領収書）
- S3連携
- 精度統計ダッシュボード
- 修正パターン分析・プロンプト改善提案
- 画像前処理パイプライン強化（低品質スキャン対応）
- E2Eテスト充実
- 本番デプロイ

**品質ゲート**:
- 全機能のE2Eテスト合格
- セキュリティレビュー完了
- パフォーマンス目標達成（Core Web Vitals合格）
- レビュー部門の最終検収合格

### Phase 4以降（将来計画）

- PRJ-002との統合（定型/不定型自動判定・振り分け）
- API提供（外部システム連携）
- Webhook通知
- 自動監視プロファイル
- マルチテナント対応

### 5.1 マイルストーン

| マイルストーン | 時期 | 基準 |
|-------------|------|------|
| M1: MVP完成 | Phase 1終了（4週目） | 単体抽出フローがE2Eで動作する |
| M2: 精度目標達成 | Phase 2終了（8週目） | 主要帳票5種で抽出精度90%以上 |
| M3: 本番リリース | Phase 3終了（11週目） | 全品質ゲート通過、本番デプロイ完了 |

### 5.2 PRJ-002教訓の反映事項

| 教訓 | PRJ-002での問題 | PRJ-003での対策 |
|------|----------------|----------------|
| React Query採用 | 自前SWRキャッシュ実装の工数 | React Query (TanStack Query)を初期から標準採用 |
| 初期RLS設計 | Phase追加ごとにRLSポリシーを後追い | schema.sql作成時にRLSポリシーも含めて設計 |
| エラーハンドリング統一 | apiError()が後追い導入 | プロジェクト初期に構造化ログ+エラーハンドリングフレームワークを導入 |
| ストレージ抽象化 | localStorage→Supabase移行で不整合 | 最初からasyncインターフェースで設計 |
| UNIQUE制約の複合化 | 単体UNIQUE制約でマルチテナント不整合 | 全てのUNIQUE制約を (カラム, user_id) の複合にする |
| データ形式の契約 | PDFデータURLの二重プレフィックス | API間のデータ形式（raw base64 vs data URL等）を仕様書で明確に定義 |
| セキュリティヘッダー | 後から追加 | プロジェクトセットアップ時にnext.config.tsテンプレートを適用 |
| N+1クエリ防止 | テナント一覧でN+1発生 | 一覧画面設計時にN+1を意識、React Queryでバッチ取得 |

---

## 6. リスクと対策

### 6.1 技術リスク

| リスク | 深刻度 | 発生確率 | 対策 |
|--------|--------|---------|------|
| VLM精度が目標（90%）に達しない | 極めて高い | 中 | カスケード抽出、フィードバックループ、CoTプロンプト、Few-shot学習の段階的適用。PoC実施で早期検証 |
| 日本語帳票特有の課題（縦書き、旧字体、印影） | 高い | 高 | Qwen系VLM（CJK最適化）の優先採用。プロンプトに日本語特有ルールを明示。後処理で正規化 |
| VLM API レート制限によるバッチ処理の遅延 | 中 | 中 | マルチプロバイダー分散、バッチAPI活用（OpenAI 50%割引）、プロンプトキャッシュ（Anthropic） |
| VLM API のコスト超過 | 中 | 中 | カスケード戦略（Stage 1で73%コスト削減）、テキストPDF判定による画像送信省略、コスト管理ダッシュボード |
| ローカルVLM（Ollama）の精度限界 | 中-高 | 高 | クラウドVLMとローカルVLMの精度比較を透明に提示。用途に応じた推奨モデルガイドの提供 |
| PDF→画像変換の品質問題 | 中 | 中 | sharp + pdf-to-img でDPI/品質を最適化。低品質スキャンにはコントラスト強調+シャープネスを適用 |

### 6.2 ビジネスリスク

| リスク | 深刻度 | 発生確率 | 対策 |
|--------|--------|---------|------|
| 顧客の精度期待値と現実のギャップ | 極めて高い | 高 | 「100%自動化」ではなく「80%の作業を自動化、残り20%を人間が確認」というポジショニング。信頼度スコアの透明な表示 |
| 大手クラウド（Google/Amazon/Microsoft）の日本語帳票対応強化 | 高い | 中 | UI/UXの完成度、ローカルAI対応、PRJ-002統合という独自価値で差別化。先行者優位でユーザーベース構築 |
| 競合AI-OCR企業のVLM対応 | 中-高 | 中 | 価格面の優位性維持、中小企業特化のポジション堅持 |
| PRJ-002の開発遅延による統合プラン提供の遅れ | 中 | 中 | PRJ-003を独立製品として先行リリースできる設計 |
| 個人情報保護への懸念 | 中-高 | 中 | ローカルAI対応を前面に打ち出し、プライバシーポリシー整備。VLMプロバイダーのデータポリシー明示 |

### 6.3 プロジェクトリスク

| リスク | 深刻度 | 発生確率 | 対策 |
|--------|--------|---------|------|
| カスケード抽出パイプラインの実装複雑度 | 高い | 中 | Phase 1ではStage 1のみ実装し、Phase 2でStage 2を追加。段階的に複雑度を上げる |
| pgvector + CLIP統合の技術難度 | 中 | 中 | Phase 2で実装。代替案として単純なメタデータ（帳票種類、発行元）での検索から開始 |
| VLM API の仕様変更・価格変動 | 中 | 中 | AI SDK抽象化レイヤーによるプロバイダー切替の容易化。マルチプロバイダー対応で依存を分散 |

---

## 7. 前提条件と制約

### 7.1 前提条件

- VLMの精度はプロンプトエンジニアリング + フィードバックループで実用レベル（90%+）に到達可能
- 対象帳票は活字印刷の日本語帳票（手書きは対象外）
- ユーザーはブラウザから操作する（デスクトップPC想定）
- インターネット接続が利用可能（ローカルVLM使用時はLAN内のOllamaサーバーにアクセス可能）

### 7.2 制約条件

- 社内標準技術スタック（Next.js + Supabase + Vercel）に準拠
- AIモデルへのファインチューニングは行わない（プロンプトエンジニアリングで対応）
- Phase 1はシングルテナント
- PRJ-002とは別リポジトリで開発
- デザインはPRJ-002と統一感のあるクリーンなデザイン（AI感を出さない）

### 7.3 未確認事項（CEOへのエスカレーション）

- [ ] 納期の確定（本要件定義では11週間のPhase計画を提案）
- [ ] 予算規模の確認（VLM APIの月額コスト見積もりに基づく）
- [ ] PRJ-002との技術基盤共有方針の最終承認（別リポジトリ/モノレポ）
- [ ] 対応するPDFの種類・言語の範囲の確定（日本語のみの方針で問題ないか）
- [ ] マーケティング部門提案の価格戦略の承認
- [ ] 初期ターゲット（物流・運送業）の承認
- [ ] PoC実施計画の承認

---

## 8. 用語集

| 用語 | 定義 |
|------|------|
| VLM | Vision Language Model。画像とテキストの両方を理解できるAIモデル |
| カスケード抽出 | 軽量モデルで一次抽出し、信頼度の低い部分のみ高精度モデルで再抽出する戦略 |
| Few-shot学習 | 少数の例示をプロンプトに含めて、AIの出力を誘導する手法 |
| フィードバックループ | ユーザーの修正を記録し、将来の抽出精度向上に活用する仕組み |
| 信頼度スコア | VLMが抽出した各フィールドの確信度を0.0-1.0で表した数値 |
| 抽出スキーマ | ユーザーが定義する「帳票から何を抽出したいか」の項目セット |
| CoT | Chain-of-Thought。AIに段階的に思考させることで精度を向上させるプロンプト手法 |
| pgvector | PostgreSQLのベクトル検索拡張。類似帳票の検索に使用 |
| CLIP | 画像とテキストの対応関係を学習したモデル。帳票の類似度計算に使用 |
| RLS | Row Level Security。PostgreSQLの行レベルセキュリティ機能 |

---

**作成**: PM部門
**次のアクション**: CEOへ報告。開発部門と連携し、Phase 1の詳細設計を開始。
