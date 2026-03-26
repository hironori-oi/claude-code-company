# 技術調査レポート: PRJ-002 PDF帳票OCR/VLMデータ自動抽出システム

| 項目 | 内容 |
|------|------|
| 案件ID | PRJ-002 |
| 調査部門 | リサーチ部門 |
| 調査日 | 2026-03-22 |
| ステータス | 完了 |
| 情報鮮度 | 2026年3月時点 |

---

## 目次

1. [OCRライブラリ比較](#1-ocrライブラリ比較)
2. [VLM/LLM連携](#2-vlmllm連携)
3. [PDFプレビュー + 範囲選択の技術実現](#3-pdfプレビュー--範囲選択の技術実現)
4. [テーブル抽出技術](#4-テーブル抽出技術)
5. [バッチ処理アーキテクチャ](#5-バッチ処理アーキテクチャ)
6. [参考サービス分析](#6-参考サービス分析)
7. [総合推奨と実現性評価](#7-総合推奨と実現性評価)

---

## 1. OCRライブラリ比較

### 1.1 候補一覧

| ライブラリ | 種別 | 日本語対応 | ランタイム | ライセンス | npm DL/月 (概算) |
|-----------|------|-----------|-----------|-----------|-----------------|
| **Tesseract.js** (v5) | OCRエンジン | jpn / jpn_vert 学習データあり | Browser / Node.js | Apache 2.0 | ~200K |
| **pdf.js** (pdfjs-dist) | PDF解析+テキスト抽出 | テキスト埋め込みPDFのみ | Browser / Node.js | Apache 2.0 | ~3M |
| **PaddleOCR (ONNX Runtime)** | OCRエンジン | 中日韓に強い | Node.js (ONNX) | Apache 2.0 | - |
| **EasyOCR (Python)** | OCRエンジン | 良好 | Python (API経由) | Apache 2.0 | - |
| **Google Cloud Vision API** | クラウドOCR | 優秀 | REST API | 従量課金 | - |

### 1.2 詳細評価

#### Tesseract.js (v5)

- **概要**: Tesseract OCRエンジンのWebAssembly移植版。ブラウザとNode.jsの両方で動作
- **日本語精度**: 中程度。活字帳票であれば70-85%程度の認識率。手書きには弱い
- **長所**:
  - 完全ローカル処理が可能（プライバシー面で有利）
  - 追加コストなし
  - Worker APIでマルチスレッド処理可能
  - 学習データのカスタマイズが可能
- **短所**:
  - 日本語の認識精度は英語に比べて劣る
  - 帳票のレイアウト解析は弱い（単純なテキスト抽出向き）
  - 処理速度は画像サイズに依存し、大きな画像では遅い
- **推奨用途**: PDF_TEXTモードのフォールバック、低コスト要件時のOCRモード

#### pdf.js (pdfjs-dist)

- **概要**: MozillaのPDFレンダリングライブラリ。テキストレイヤー抽出とCanvas描画を提供
- **日本語精度**: テキスト埋め込みPDFでは100%（OCRではなくテキスト抽出のため）
- **長所**:
  - PDFプレビュー表示に必須（react-pdfの基盤）
  - テキスト埋め込みPDFからは完全な精度でテキスト抽出可能
  - 座標情報付きでテキスト位置を取得可能（`getTextContent()`）
  - 安定した大規模OSSプロジェクト
- **短所**:
  - スキャンPDF（画像PDF）からはテキスト抽出不可
  - OCR機能は持たない
- **推奨用途**: PDF_TEXTモードの主力エンジン、PDFプレビュー表示

#### PaddleOCR (ONNX Runtime Web / Node)

- **概要**: BaiduのOCRエンジン。ONNX形式で出力すればNode.jsから利用可能
- **日本語精度**: 高い。特に印刷文字に対して90%以上の精度
- **長所**:
  - CJK言語に最適化されており日本語帳票に強い
  - テキスト検出 + テキスト認識 + 方向判定の3段パイプライン
  - ONNX Runtime経由でNode.jsから利用可能
- **短所**:
  - Node.js向けの成熟したnpmパッケージがない（自前ラッピングが必要）
  - モデルサイズが大きい（数十MB）
  - セットアップの複雑さ
- **推奨用途**: 日本語帳票の高精度OCRが必要な場合の候補（ただし導入コスト高）
- **不確実性**: Node.js環境でのONNX Runtime安定性は要検証

### 1.3 OCRライブラリ推奨

| 読取パターン | 推奨技術 | 理由 |
|-------------|---------|------|
| **PDF_TEXT** | pdf.js (`getTextContent()`) | テキスト埋め込みPDFから100%精度で抽出。座標情報も取得可能 |
| **OCR** | Tesseract.js | ローカル完結、コストゼロ。精度不足はVLMモードで補完する設計 |
| **OCR+LLM** | Tesseract.js + GPT-4 / Ollama | OCR結果をLLMで補正・構造化。コスト対精度のバランスが良い |
| **VLM** | GPT-4 Vision / LLaVA (Ollama) | 画像を直接解析。最も高精度だがコスト高 |

**根拠**: 4つの読取パターンが要件に明記されており、各パターンに最適な技術を割り当てる。OCR単体の精度限界をLLM/VLMで補完する階層設計が合理的。

---

## 2. VLM/LLM連携

### 2.1 VLMモデル比較

| モデル | 提供元 | 日本語帳票精度 | コスト | レイテンシ | ローカル対応 |
|--------|--------|--------------|--------|-----------|------------|
| **GPT-4o** | OpenAI | 非常に高い | $2.50/1M入力トークン (画像込) | 2-5秒 | 不可 |
| **GPT-4o-mini** | OpenAI | 高い | $0.15/1M入力トークン | 1-3秒 | 不可 |
| **LLaVA 1.6 (34B)** | Ollama | 中-高 | 無料（ローカルGPU必要） | 5-15秒 | 可 |
| **LLaVA 1.6 (13B)** | Ollama | 中 | 無料（ローカルGPU必要） | 3-8秒 | 可 |
| **Qwen2.5-VL (72B)** | Ollama | 高い（CJK最適化） | 無料（ハイスペックGPU必要） | 10-30秒 | 可 |
| **Qwen2.5-VL (7B)** | Ollama | 中-高 | 無料（8GB VRAM可） | 3-8秒 | 可 |
| **Claude 3.5 Sonnet** | Anthropic | 非常に高い | $3.00/1M入力トークン | 2-5秒 | 不可 |

### 2.2 推奨モデル構成

**本番環境（クラウド）**:
- 第一推奨: **GPT-4o-mini** -- コスト対精度のバランスが最も良い。日本語帳票の認識精度も十分実用レベル
- 高精度が必要な場合: **GPT-4o** -- 複雑なレイアウトや手書き混在帳票に強い

**開発/検証/プライバシー重視（ローカル）**:
- 第一推奨: **Qwen2.5-VL (7B)** -- CJK言語に最適化されており、7Bモデルでも日本語帳票に対する認識精度が高い。8GB VRAMで動作
- GPU不足時: **LLaVA 1.6 (13B)** -- 汎用性が高くコミュニティのサポートも充実

### 2.3 プロンプト設計パターン

帳票OCR用のプロンプトは以下の3段階構成を推奨する。

#### パターン1: 単一フィールド抽出

```
あなたは帳票データ抽出の専門家です。
以下の帳票画像から指定されたフィールドの値を抽出してください。

抽出対象フィールド:
- フィールド名: {column_name}
- データ型: {data_type}
- 桁数上限: {max_length}

ルール:
- 値が読み取れない場合は null を返してください
- 日付は YYYY-MM-DD 形式に統一してください
- 金額はカンマなしの数値で返してください
- 信頼度を 0.0-1.0 で併記してください

JSON形式で回答:
{"value": "...", "confidence": 0.95, "raw_text": "..."}
```

#### パターン2: 複数フィールド一括抽出

```
以下の帳票画像から、定義されたスキーマに従ってデータを抽出してください。

スキーマ定義:
{schema_json}

出力形式:
{
  "fields": [
    {"column": "物理名", "value": "値", "confidence": 0.0-1.0, "raw_text": "元テキスト"}
  ],
  "document_type": "帳票種別の推定",
  "extraction_notes": "特記事項"
}
```

#### パターン3: テーブル構造抽出

```
以下の帳票画像に含まれるテーブル（表）のデータを抽出してください。

テーブル定義:
- 列: {columns_definition}
- キー列: {key_column}

ルール:
- 各行を配列として返してください
- 空セルは null としてください
- ヘッダ行は除外してください
- 罫線で区切られたセルを正確に識別してください

出力形式:
{
  "rows": [
    {"col1": "val1", "col2": "val2", ...}
  ],
  "row_count": 10,
  "confidence": 0.9
}
```

### 2.4 構造化データ抽出のベストプラクティス

1. **Structured Outputs / JSON Mode の利用**: OpenAI APIの`response_format: { type: "json_object" }`を指定し、確実にJSON出力を得る
2. **Zod スキーマによるバリデーション**: AI SDKの`generateObject()`を使い、Zodスキーマで出力型を強制する
3. **信頼度スコアの活用**: モデルに信頼度を自己申告させ、閾値以下は手動確認フラグを立てる
4. **フォールバック戦略**: VLMが失敗した場合にOCR+LLMにフォールバックする多段パイプライン
5. **画像前処理**: コントラスト強調、傾き補正、ノイズ除去をOCR/VLM送信前に実施

**AI SDK統合コード概要**:

```typescript
// AI SDKのgenerateObjectでVLM抽出（型安全）
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const result = await generateObject({
  model: openai('gpt-4o-mini'),
  schema: z.object({
    fields: z.array(z.object({
      column: z.string(),
      value: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    })),
  }),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image', image: croppedImageBuffer },
      ],
    },
  ],
});
```

---

## 3. PDFプレビュー + 範囲選択の技術実現

### 3.1 PDFプレビューライブラリ比較

| ライブラリ | Stars | 最終更新 | Next.js対応 | 機能 |
|-----------|-------|---------|------------|------|
| **react-pdf** (v9) | ~9K | 活発 | 良好 (SSR注意) | pdf.jsラッパー。ページ表示、テキストレイヤー |
| **@react-pdf-viewer/core** | ~2K | 活発 | 良好 | プラグイン型。ハイライト、検索等 |
| **pdf.js 直接利用** | ~49K | 活発 | 要設定 | 最大の自由度。Canvas直接描画 |

### 3.2 推奨: react-pdf + Canvas オーバーレイ

**構成**:

```
react-pdf (PDFレンダリング)
  └── Canvas overlay (ドラッグ範囲選択)
        └── 座標計算 → 画像クロップ → OCR/VLM送信
```

**選定理由**:
- react-pdfはpdf.jsのReactラッパーとして最も成熟しており、Next.js App Routerとの互換性も確認されている
- Canvasオーバーレイによるドラッグ選択は、PDF表示とは独立したレイヤーで実装できるため、保守性が高い
- テキストレイヤーを有効にすれば、PDF_TEXTモードでの座標ベーステキスト抽出も可能

### 3.3 ドラッグ範囲選択の実装方針

#### Step 1: PDFページをCanvas上にレンダリング

```typescript
// react-pdfのPageコンポーネントでCanvasレンダリング
<Document file={pdfFile}>
  <Page pageNumber={pageNum} scale={scale} canvasRef={canvasRef} />
</Document>
```

#### Step 2: Canvasオーバーレイでドラッグ範囲選択

実装方法は2つ考えられる:

**方法A: 透明Canvasオーバーレイ**（推奨）
- PDF表示用Canvasの上に透明なCanvasを重ねる
- `mousedown` / `mousemove` / `mouseup` イベントで矩形描画
- 選択領域を半透明の矩形で表示

**方法B: SVGオーバーレイ**
- SVG要素を重ねて矩形を描画
- リサイズハンドル等のUI実装が容易
- ただしCanvas→SVG間の座標変換が必要

**推奨: 方法A**。PDF表示もCanvasのため、座標系が統一されて座標変換の問題が発生しにくい。

#### Step 3: 座標 → 画像クロップ → OCR/VLM送信パイプライン

```
1. ドラッグ座標 (x, y, width, height) を取得（表示スケール上の座標）
2. PDFの実際の解像度に合わせて座標を変換（scale係数で除算）
3. CanvasのdrawImage()でクロップ領域を別Canvasに描画
4. canvas.toBlob()でPNG/JPEG画像を取得
5. 読取パターンに応じて:
   - PDF_TEXT: pdf.jsのgetTextContent()で座標範囲内のテキスト抽出
   - OCR: Tesseract.jsにクロップ画像を送信
   - OCR+LLM: Tesseract.js結果をLLMで構造化
   - VLM: クロップ画像をGPT-4o / LLaVAに送信
```

### 3.4 技術的注意点

- **pdf.js のWorker設定**: Next.jsではWeb Workerのパス設定が必要。`pdfjs.GlobalWorkerOptions.workerSrc` を設定するか、CDNから読み込む
- **SSR回避**: react-pdfはブラウザAPIに依存するため、`dynamic(() => import(...), { ssr: false })` でクライアント専用にする
- **高DPIスクリーン対応**: `window.devicePixelRatio` を考慮したCanvas解像度設定が必要
- **パフォーマンス**: 大きなPDF（50MB制限）のレンダリングはメモリを消費する。ページ単位の遅延レンダリングを実装すべき

---

## 4. テーブル抽出技術

### 4.1 手法比較

| 手法 | 精度 | 実装コスト | 日本語対応 | ランタイム |
|------|------|-----------|-----------|-----------|
| **pdf.js テキスト座標分析** | 中（テキストPDFのみ） | 中 | 良好 | Node.js |
| **罫線ベース検出 (Canvas画像処理)** | 中-高 | 高 | 関係なし | Node.js/Browser |
| **VLM直接テーブル抽出** | 高 | 低 | 高 | API呼出 |
| **Tabula (Java)** | 高 | 中（子プロセス呼出） | 良好 | Java JVM必要 |
| **Camelot (Python)** | 高 | 中（子プロセス呼出） | 良好 | Python必要 |
| **Unstructured.io** | 高 | 低（API） | 良好 | REST API |

### 4.2 要件の読取パターンとの対応

要件に記載の2つのテーブル検出モード:

#### LINES_FIRST（罫線優先）

1. PDFページをCanvas上にレンダリング（高解像度）
2. 画像処理で水平線・垂直線を検出（Hough変換的アプローチ、またはピクセル走査）
3. 交点からセル領域を特定
4. 各セルをOCR/VLMで読み取り

**Node.js での実装案**:
- **sharp** ライブラリでPDFページを画像変換
- 画像のグレースケール化 → 二値化 → 水平/垂直エッジ検出
- 純粋な画像処理でNode.jsで完結可能
- または、pdf.jsの`getOperatorList()`でPDFの描画命令（line/rect）を解析し、罫線座標を直接取得する方法もある（テキストPDF限定だが高速・高精度）

#### VLM_FIRST（VLM優先）

1. PDFページ（またはテーブル領域）の画像をVLMに送信
2. VLMがテーブル構造を認識し、JSON/CSVで返却
3. キー列を指定して行を識別

**実装案**:
- VLMにテーブルスキーマ定義（列名、データ型）を渡し、構造化出力を要求
- AI SDKの`generateObject()`で型安全に受け取る
- 大きなテーブルは分割して処理（1回のAPI呼出しで処理可能な行数には限界がある）

### 4.3 推奨アプローチ

**段階的実装を推奨**:

1. **Phase 1**: VLM_FIRSTを先に実装（実装コストが低く、精度も高い）
2. **Phase 2**: LINES_FIRSTをpdf.jsの描画命令解析ベースで実装（テキストPDF向けの高速・低コスト処理）
3. **Phase 3**: 画像ベースの罫線検出を追加（スキャンPDF対応）

**根拠**: VLMによるテーブル抽出は実装が最もシンプルで、GPT-4oクラスのモデルであれば日本語帳票のテーブル認識精度は十分に高い。罫線検出はスキャンPDF対応として後から追加する形が効率的。

### 4.4 PythonツールのNode.js代替

| Pythonツール | Node.js代替案 | 備考 |
|-------------|-------------|------|
| Camelot | pdf.js描画命令解析 + カスタムロジック | 罫線ベースのテーブル検出 |
| Tabula | tabula-js (Javaラッパー) | JVMが必要でVercelデプロイ不可 |
| pdfplumber | pdf.js `getTextContent()` + 座標グルーピング | テキストPDFのみ |
| img2table | sharp + カスタム画像処理 | 実装コスト高 |

**結論**: Node.js単体で完全なテーブル検出は難しいが、pdf.jsの座標情報 + VLMの組み合わせで実用上は十分な精度を達成可能。Vercelデプロイを考慮するとJava/Python依存は避けるべき。

---

## 5. バッチ処理アーキテクチャ

### 5.1 課題

- 最大100ファイルの一括処理（1ファイル最大50MB）
- 各ファイルにOCR/VLM処理が必要（1ファイルあたり数秒〜数十秒）
- 進捗監視、キャンセル、ステータス管理が必須
- Vercelの実行時間制限（Hobby: 10秒、Pro: 60秒、Enterprise: 900秒）

### 5.2 アーキテクチャ比較

| 方式 | Vercel対応 | スケーラビリティ | 実装コスト | 進捗管理 |
|------|-----------|----------------|-----------|---------|
| **Inngest** | 良好 | 高 | 低 | 組み込み |
| **Vercel Cron + DB Queue** | 良好 | 中 | 中 | 自前実装 |
| **BullMQ + Redis** | 不可(Vercel) / VPS必要 | 非常に高 | 中 | 組み込み |
| **Trigger.dev** | 良好 | 高 | 低 | 組み込み |
| **QStash (Upstash)** | 良好 | 高 | 低 | 部分的 |

### 5.3 詳細評価

#### Inngest（推奨）

- **概要**: Vercelネイティブ対応のイベント駆動型ジョブキュー。Next.js API Routesと直接統合可能
- **長所**:
  - Vercel Marketplaceから導入可能
  - ステップ関数でジョブを分割し、Vercelの実行時間制限を回避できる
  - リトライ、キャンセル、進捗トラッキングが組み込み
  - TypeScriptネイティブ
  - ダッシュボードでジョブ監視可能
  - 無料プランで月10,000ステップ
- **短所**:
  - 外部サービス依存
  - 大規模利用時はコストが発生
- **バッチ処理設計**:

```typescript
// Inngestでのバッチジョブ設計例
const processJob = inngest.createFunction(
  { id: "process-pdf-batch" },
  { event: "batch/started" },
  async ({ event, step }) => {
    const { jobId, files } = event.data;

    // ファイルごとにステップを分割（Vercelタイムアウト回避）
    for (const file of files) {
      await step.run(`process-${file.id}`, async () => {
        // 1. PDFをレンダリング
        // 2. 読取パターンに応じてOCR/VLM処理
        // 3. 結果をDBに保存
        // 4. ステータス更新
      });
    }

    await step.run("finalize", async () => {
      // バッチ結果の集約、CSVエクスポート生成
    });
  }
);
```

#### Trigger.dev (v3)

- **概要**: オープンソースのバックグラウンドジョブプラットフォーム。Vercel対応
- **長所**:
  - Inngestと同様にVercelデプロイ対応
  - 実行時間制限が長い（最大5分/タスク、有料プランでさらに長い）
  - TypeScriptネイティブ
  - セルフホスト可能
- **短所**:
  - Inngestほどのエコシステムの成熟度はない
  - ドキュメントがやや不足

#### BullMQ + Redis

- **概要**: Node.jsの高機能ジョブキューライブラリ
- **長所**: 非常に細かい制御が可能、並行処理数の制御、優先度キュー
- **短所**: Vercelでは動作不可（常駐Workerが必要）。VPS/Docker環境が必要
- **判断**: Vercelデプロイが要件のため、**現時点では不採用**。将来的にスケーラビリティ要件が厳しくなった場合に再検討

### 5.4 推奨アーキテクチャ

```
[ユーザー] → [Next.js API Route] → [Inngest Event] → [Inngest Function]
                                                          │
                                                          ├── Step 1: ファイル検証
                                                          ├── Step 2-N: 各ファイルのOCR/VLM処理
                                                          └── Step N+1: 結果集約・CSV生成

[ステータス管理] ← Supabase DB (jobs テーブル)
[進捗通知] ← Supabase Realtime (ステータス変更をリアルタイムプッシュ)
[ファイルストレージ] ← Supabase Storage (PDF原本 + 抽出結果)
```

**ステータス遷移**: QUEUED → RUNNING → SUCCEEDED / PARTIAL / FAILED（要件通り）

**キャンセル対応**: 各ステップの開始時にDBのジョブステータスを確認し、CANCELLEDならスキップ

### 5.5 スケーラビリティ考慮

| 規模 | 同時ジョブ数 | 推奨構成 |
|------|------------|---------|
| 小規模（初期） | 1-5 | Inngest + Vercel Pro |
| 中規模 | 5-20 | Inngest + 並行ステップ + Vercel Pro |
| 大規模 | 20+ | BullMQ + VPS Worker（Vercelから分離） |

**初期リリースはInngest + Vercel Proで十分**。100ファイルのバッチ処理もステップ分割で対応可能。

---

## 6. 参考サービス分析

### 6.1 smart-data-collector（スマコレ）

- **URL**: https://www.home.smart-data-collector.com/
- **概要**: AI-OCRベースのデータ収集・帳票読取SaaS
- **推定機能**:
  - 帳票テンプレート定義（読取範囲指定）
  - OCRによる自動データ抽出
  - テーブル構造認識
  - バッチ処理対応
  - CSV/Excelエクスポート
- **推定アーキテクチャ**:
  - フロントエンド: React系SPAと推定
  - バックエンド: Python (Flask/FastAPI) + OCRエンジン（Tesseract / Google Vision）と推定
  - PDFプレビュー: pdf.js系ライブラリ
  - ジョブキュー: Celery / RQ（Python系）と推定
- **PRJ-002との差別化ポイント**:
  - VLM対応（GPT-4 Vision / Ollama）はスマコレにはない可能性が高い
  - ローカルLLM対応（Ollama）によるプライバシー確保
  - Next.js + TypeScriptによるモダンなフロントエンド

### 6.2 競合AI-OCR SaaS比較

| サービス | 特徴 | 料金帯 | 日本語対応 |
|---------|------|--------|-----------|
| **スマコレ** | 帳票テンプレート型OCR | 月額制（推定数万円〜） | あり |
| **AI inside (DX Suite)** | エンタープライズ向けAI-OCR | 月額10万円〜 | 非常に高精度 |
| **Yoom** | ノーコードOCR自動化 | 月額数千円〜 | あり |
| **LegalForce** | 契約書特化OCR | 月額制 | あり |
| **ABBYY FlexiCapture** | エンタープライズOCR | 高額 | あり |

### 6.3 PRJ-002の競合優位性

1. **VLM統合**: GPT-4 Vision / Ollamaによる次世代OCRは競合の多くが未対応
2. **セルフホスト対応**: Ollamaによるローカル処理で、クラウドにデータを送らないオプション
3. **低コスト**: 中小企業向けの価格設定が可能（大手OCR SaaSは高額）
4. **カスタマイズ性**: オープンソース技術ベースで柔軟にカスタマイズ可能
5. **モダンUX**: Next.js + shadcn/uiによるクリーンなUI

---

## 7. 総合推奨と実現性評価

### 7.1 推奨技術スタック

| レイヤー | 技術 | 備考 |
|---------|------|------|
| PDFプレビュー | **react-pdf** (v9) + pdf.js | Next.js App Router対応確認済み |
| 範囲選択UI | **Canvas オーバーレイ** (自前実装) | mouseイベントによる矩形選択 |
| PDF_TEXT抽出 | **pdf.js** `getTextContent()` | テキスト埋め込みPDF用 |
| OCR | **Tesseract.js** (v5) | ローカルOCR処理 |
| VLM (クラウド) | **GPT-4o-mini** / **GPT-4o** | AI SDK経由。コスト/精度で使い分け |
| VLM (ローカル) | **Qwen2.5-VL (7B)** via Ollama | CJK最適化モデル |
| LLM構造化 | **AI SDK** `generateObject()` + Zod | 型安全な構造化データ抽出 |
| テーブル検出 | **VLM優先** + pdf.js罫線解析 | 段階的に実装 |
| バッチ処理 | **Inngest** | Vercelネイティブ、ステップ分割 |
| DB | **Supabase** (PostgreSQL) | ジョブ管理、結果格納、Realtime通知 |
| ストレージ | **Supabase Storage** | PDFファイル保存 |
| 画像処理 | **sharp** | PDFページ→画像変換、クロップ、前処理 |

### 7.2 実現性評価

| 機能 | 実現性 | 難易度 | リスク | 備考 |
|------|--------|--------|--------|------|
| PDFプレビュー | 高 | 低 | 低 | react-pdfで実績多数 |
| ドラッグ範囲選択 | 高 | 中 | 低 | Canvas実装。座標変換に注意 |
| PDF_TEXT抽出 | 高 | 低 | 低 | pdf.js標準機能 |
| OCR (Tesseract.js) | 高 | 低 | 中 | 日本語精度に限界あり |
| VLM帳票解析 | 高 | 中 | 中 | APIコスト管理、レイテンシ考慮 |
| Ollama連携 | 高 | 中 | 中 | ユーザーのGPU環境に依存 |
| テーブル抽出 (VLM) | 高 | 中 | 低 | VLMの構造認識精度は十分 |
| テーブル抽出 (罫線) | 中 | 高 | 中 | 画像処理の実装コスト |
| バッチ処理 (100ファイル) | 高 | 中 | 低 | Inngestのステップ分割で対応 |
| CSVエクスポート | 高 | 低 | 低 | 標準的な実装 |
| Auto-Watch (将来) | 中 | 高 | 中 | ファイル監視はサーバー常駐が理想 |
| S3連携 (将来) | 高 | 低 | 低 | AWS SDK利用 |

### 7.3 主要リスクと対策

| リスク | 影響度 | 発生確率 | 対策 |
|--------|--------|---------|------|
| 日本語OCR精度不足 | 高 | 中 | VLMモードを主力にし、OCRはフォールバックと位置づける |
| VLM APIコスト超過 | 中 | 中 | GPT-4o-miniを標準に。範囲指定でクロップ画像を小さくしてトークン削減 |
| Vercel実行時間制限 | 高 | 低 | Inngestのステップ分割で確実に回避 |
| 大容量PDF (50MB) のメモリ不足 | 中 | 中 | ページ単位の遅延処理。Vercel Proの1024MBメモリで通常は十分 |
| Ollamaモデルの精度ばらつき | 中 | 高 | Qwen2.5-VLを推奨モデルとして案内。モデル切り替え可能な設計に |
| テーブル構造の複雑さ | 中 | 中 | 結合セル等の複雑な表はVLMに依存。手動修正UIを充実させる |

### 7.4 開発工数見積（概算）

| 機能 | 工数（人日） | 優先度 |
|------|------------|--------|
| DB設計・テーブル定義UI | 3-5 | Must |
| PDFプレビュー + 範囲選択 | 5-7 | Must |
| OCR/VLMパイプライン実装 | 5-7 | Must |
| テーブル抽出（VLM_FIRST） | 3-4 | Must |
| テーブル抽出（LINES_FIRST） | 5-8 | Must |
| バッチ処理 (Inngest) | 3-5 | Must |
| 結果閲覧・編集UI | 3-5 | Must |
| CSVエクスポート | 1-2 | Must |
| システム設定画面 | 2-3 | Must |
| Auto-Watch | 3-5 | Should |
| S3連携 | 1-2 | Should |
| **合計（Must）** | **30-46** | - |
| **合計（全体）** | **34-53** | - |

### 7.5 最終推奨

本案件は技術的に十分実現可能であり、既存の標準技術スタック（Next.js + TypeScript + Supabase）の範囲内で構築できる。

**追加導入が必要な主要ライブラリ**:
- `react-pdf` / `pdfjs-dist` -- PDFプレビュー
- `tesseract.js` -- OCRエンジン
- `sharp` -- 画像処理
- `inngest` -- バッチジョブ処理
- `@ai-sdk/openai` / `ollama-ai-provider` -- VLM/LLM連携

**開発の推奨順序**:
1. DB設計 + テーブル定義UI
2. PDFプレビュー + 範囲選択
3. PDF_TEXT / OCRパイプライン（最も単純な読取パターンから）
4. VLM連携 + 構造化抽出
5. テーブル抽出（VLM_FIRST → LINES_FIRST）
6. バッチ処理
7. 結果閲覧・編集UI + エクスポート
8. システム設定
9. Auto-Watch / S3連携（Should要件）

---

*以上、リサーチ部門からの技術調査レポートです。技術選定の最終決定はCEO/開発部門と協議の上、決定をお願いいたします。*
