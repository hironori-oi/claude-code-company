# 技術調査レポート: PRJ-003 不定様式PDF VLMデータ抽出 -- 精度最大化のための技術仕様とアーキテクチャ

| 項目 | 内容 |
|------|------|
| 案件ID | PRJ-003 |
| 調査部門 | リサーチ部門 |
| 調査日 | 2026-03-26 |
| ステータス | 完了 |
| 情報鮮度 | 2026年3月時点 |

---

## 目次

1. [VLMモデル選定（2026年最新）](#1-vlmモデル選定2026年最新)
2. [精度向上テクニック](#2-精度向上テクニック)
3. [アーキテクチャパターン](#3-アーキテクチャパターン)
4. [競合製品・先行事例の分析](#4-競合製品先行事例の分析)
5. [技術的リスクと対策](#5-技術的リスクと対策)
6. [総合推奨と実現性評価](#6-総合推奨と実現性評価)

---

## 1. VLMモデル選定（2026年最新）

### 1.1 候補モデル一覧

| モデル | 提供元 | 日本語帳票精度 | コスト (入力/1Mトークン) | レイテンシ | ローカル対応 | 不定様式適性 |
|--------|--------|--------------|------------------------|-----------|------------|------------|
| **GPT-4o** | OpenAI | 非常に高い (90-95%) | $2.50 | 2-5秒 | 不可 | 高い |
| **GPT-4o-mini** | OpenAI | 高い (85-90%) | $0.15 | 1-3秒 | 不可 | 中-高 |
| **GPT-5.2** | OpenAI | 非常に高い | 要確認 | 2-5秒 | 不可 | 非常に高い |
| **Claude Sonnet 4.6** | Anthropic | 非常に高い (90-95%) | $3.00 | 2-5秒 | 不可 | 非常に高い |
| **Claude Opus 4.6** | Anthropic | 最高 (95%+) | $15.00 | 3-8秒 | 不可 | 最高 |
| **Gemini 2.5 Pro** | Google | 非常に高い (90-95%) | $1.25 | 2-5秒 | 不可 | 非常に高い |
| **Gemini 2.5 Flash** | Google | 高い (85-90%) | $0.15 | 1-2秒 | 不可 | 高い |
| **Qwen3-VL (235B)** | Alibaba | 非常に高い (90-95%) | 無料 (ローカル) / API利用可 | 10-30秒 | 可 (要ハイスペックGPU) | 非常に高い |
| **Qwen2.5-VL (72B)** | Alibaba | 高い (85-90%) | 無料 (ローカル) | 10-20秒 | 可 (24GB+ VRAM) | 高い |
| **Qwen2.5-VL (7B)** | Alibaba | 中-高 (80-85%) | 無料 (ローカル) | 3-8秒 | 可 (8GB VRAM) | 中 |
| **InternVL3-78B** | Shanghai AI Lab | 高い (85-90%) | 無料 (ローカル) | 10-20秒 | 可 (要ハイスペックGPU) | 高い |
| **LLaVA-Next (34B)** | オープンソース | 中-高 (75-85%) | 無料 (ローカル) | 5-15秒 | 可 | 中 |

> **精度の注記**: 上記精度は活字印刷の日本語帳票に対する概算値。手書き混在・旧字体ではいずれも10-20%程度低下する。不確実性が高いため、実際のベンチマークは自社帳票でのPoC実施が必須。

### 1.2 各モデル詳細評価

#### GPT-4o / GPT-4o-mini

- **帳票解析精度**: 複雑なレイアウト、テーブル、手書き混在帳票に対して安定した精度を発揮。Structured Outputs（JSON Mode）との組み合わせで出力の安定性が高い
- **不定様式への強み**: 事前にレイアウトを知らなくても、文脈理解によりフィールドを正確に特定できる
- **日本語対応**: 活字は非常に高精度。縦書きもある程度認識可能だが、横書きほどの精度は出ない
- **コスト最適化**: GPT-4o-miniはGPT-4oの約1/17のコストで、一般的な帳票では十分な精度。Batch API利用で更に50%割引可能。キャッシュ利用で入力トークン50%割引
- **制約**: 画像は1024x1024で約765トークン消費。高解像度モードでは更に増加
- **2026年時点の位置づけ**: GPT-5.2が最新フラッグシップだが、GPT-4oは引き続きコスト対精度で実用的

#### Claude Sonnet 4.6 / Opus 4.6

- **帳票解析精度**: 複雑なデータセットではClaude 3.5の時点で他モデルを上回る評価あり。Claude 4.6世代では更に向上
- **Vision能力**: PDFを直接入力可能（画像変換不要）。テキスト・画像・図表・チャートを統合的に理解
- **不定様式への強み**: 長大なコンテキスト（最大1Mトークン）により、大量の参考例や抽出ルールをプロンプトに含められる
- **日本語対応**: 日本語の文脈理解に優れ、帳票特有の略語や業界用語の推論も可能
- **制約**: ファイルサイズ上限30MB。100ページ超のPDFは分割推奨。空間的な正確なピクセル座標は返せない。手書きは明瞭なもののみ対応
- **コスト**: Sonnet 4.6は$3.00/1M入力で精度が高くバランス良好。Opusは最高精度だがコスト高

#### Gemini 2.5 Pro / Flash

- **帳票解析精度**: PDFレイアウトの完全理解において初のAIモデルとされ、空間的引用のIoUスコア0.804を達成
- **文書理解能力**: 最大1,000ページのPDFをネイティブに処理可能。テキスト・画像・図表・チャート・テーブルを統合分析
- **不定様式への強み**: レイアウト理解が非常に強く、不定様式でも構造を正確に把握
- **抽出精度**: Flash版でもAnswer Recall Score 80.06、難易度の高い抽出タスクで正解率82%
- **日本語対応**: デジタルPDFでは高精度。スキャンPDFでは精度低下
- **コスト**: Flash版は$0.15/1M入力と非常に安価でスクリーニング用途に最適

#### オープンソースVLM -- Ollama対応状況

| モデル | Ollama対応 | 最小VRAM | 日本語帳票適性 | 備考 |
|--------|-----------|---------|-------------|------|
| **Qwen3-VL** | 対応済 | 32GB+ (大型) / 8GB (小型) | CJK最適化、最高クラス | Qwenファミリー最新、テキスト・ビジョン共同事前学習 |
| **Qwen2.5-VL (7B)** | 対応済 | 8GB | 高い | ローカル運用の第一推奨。CJK言語に最適化 |
| **Qwen2.5-VL (72B)** | 対応済 | 48GB+ | 非常に高い | GPT-4Vに匹敵する精度。高スペックGPU必要 |
| **InternVL3-78B** | 対応済 | 48GB+ | 高い | プロプライエタリモデルとのギャップが5-10%以内 |
| **LLaVA-Next (34B)** | 対応済 | 24GB+ | 中 | Qwen2.5-VLに精度で劣る。汎用性は高い |

**Qwen2.5-VL / Qwen3-VLの優位性**: CJK言語に最適化されており、密な文書のOCR精度はLLaVAやオリジナルQwen-VLを大幅に上回る。ラテン/アジア文字で85-90%の精度。請求書等の実務文書からの情報抽出でも高い精度を実証済み。

### 1.3 日本語帳票特有の課題と各モデルの対応力

| 課題 | GPT-4o | Claude 4.6 | Gemini 2.5 | Qwen3-VL | Qwen2.5-VL (7B) |
|------|--------|------------|-----------|---------|-----------------|
| 縦書き | 中-高 | 中-高 | 中 | 高 | 中-高 |
| 旧字体 | 中 | 中 | 中 | 中-高 | 中 |
| 手書き混在 | 高 | 中-高 | 中 | 中 | 低-中 |
| 全角/半角混在 | 高 | 高 | 高 | 高 | 高 |
| 複雑テーブル | 非常に高い | 非常に高い | 非常に高い | 高い | 中-高 |
| 印影・透かし混在 | 中 | 中 | 中 | 中 | 低 |

> **重要な研究知見**: 既存のVLMは縦書き日本語テキストを横書きよりも精度低く認識する傾向がある。合成日本語OCRデータセットでの追加学習により、縦書き未対応モデルの性能が改善されることが確認されている。

### 1.4 コスト vs 精度のトレードオフ分析

#### 月間1,000ページ処理のコスト試算

| モデル | 1ページあたりコスト | 月間コスト | 精度目安 | コスパ評価 |
|--------|------------------|-----------|---------|----------|
| GPT-4o-mini | 約$0.002 | 約$2 | 85-90% | 最良 |
| Gemini 2.5 Flash | 約$0.002 | 約$2 | 85-90% | 最良 |
| GPT-4o | 約$0.03 | 約$30 | 90-95% | 良 |
| Claude Sonnet 4.6 | 約$0.04 | 約$40 | 90-95% | 良 |
| Gemini 2.5 Pro | 約$0.015 | 約$15 | 90-95% | 非常に良 |
| Claude Opus 4.6 | 約$0.18 | 約$180 | 95%+ | コスト高 |
| Qwen2.5-VL (7B) ローカル | GPU電力のみ | 約$5-10 (電力) | 80-85% | インフラ投資次第 |

> **算出根拠**: 1ページあたり約1,000-1,500入力トークン（画像+プロンプト）、出力約200-500トークンとして概算。実際のコストはページの複雑さ、解像度設定、プロンプト長により変動する。

### 1.5 モデル選定の推奨

**本番環境（クラウド）-- 推奨構成**:

| 用途 | 推奨モデル | 理由 |
|------|----------|------|
| スクリーニング（一次抽出） | Gemini 2.5 Flash / GPT-4o-mini | 低コスト・高速。信頼度の低いフィールドのみ高精度モデルへ |
| 高精度抽出（二次抽出） | Gemini 2.5 Pro / GPT-4o | コスト対精度のバランスが最良 |
| 最高精度（重要帳票） | Claude Sonnet 4.6 | 複雑なデータセットでの優位性。長文コンテキスト対応 |
| アンサンブル検証 | 上記の組み合わせ | 多数決で信頼性向上 |

**開発/検証/プライバシー重視（ローカル）**:

| 用途 | 推奨モデル | 理由 |
|------|----------|------|
| 第一推奨 | Qwen2.5-VL (7B) | CJK最適化、8GB VRAMで動作、Ollama対応済 |
| 高精度ローカル | Qwen3-VL (中型) | 最新世代、テキスト能力がQwen3-235Bに匹敵 |
| GPU不足時 | Qwen2.5-VL (3B) | 4GB VRAMでも動作可能 |

---

## 2. 精度向上テクニック

### 2.1 プロンプトエンジニアリング

#### a) 構造化プロンプト（JSON Schema指定）

**手法**: 抽出したいフィールドをJSON Schemaとして厳密に定義し、VLMに出力形式を強制する。

```typescript
// AI SDK + Zod による型安全な構造化抽出
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const extractionSchema = z.object({
  document_type: z.string().describe('帳票の種類（請求書、納品書、見積書等）'),
  issuer: z.object({
    company_name: z.string().nullable(),
    address: z.string().nullable(),
    phone: z.string().nullable(),
  }),
  recipient: z.object({
    company_name: z.string().nullable(),
    department: z.string().nullable(),
  }),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number().nullable(),
    unit_price: z.number().nullable(),
    amount: z.number().nullable(),
  })),
  total_amount: z.number().nullable(),
  date: z.string().nullable().describe('YYYY-MM-DD形式'),
  document_number: z.string().nullable(),
  confidence_scores: z.record(z.string(), z.number().min(0).max(1)),
});

const result = await generateObject({
  model: openai('gpt-4o'),
  schema: extractionSchema,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: [
      { type: 'text', text: extractionPrompt },
      { type: 'image', image: pageImageBuffer },
    ]},
  ],
});
```

**効果**: 出力の安定性が大幅に向上。JSON Modeを使わない場合と比較して、パース失敗率がほぼゼロに。

**適用条件**: OpenAI Structured Outputs、Anthropic Tool Use、Gemini JSON Modeなど、各APIのJSON強制機能を利用すること。

#### b) Chain-of-Thought（段階的思考）の活用

**手法**: VLMに抽出プロセスを段階的に考えさせることで精度を向上させる。

```
## 指示

以下の帳票画像からデータを抽出してください。以下の手順で段階的に処理してください。

### Step 1: 帳票種類の判定
まず、この帳票がどのような種類の文書かを判定してください（請求書、納品書、見積書、注文書、領収書、その他）。
判定の根拠（タイトル、レイアウト特徴等）も記述してください。

### Step 2: レイアウト構造の分析
帳票のレイアウトを分析してください:
- ヘッダー領域（発行元、発行先、日付等）の位置
- 明細テーブルの位置と列構成
- フッター領域（合計、備考等）の位置

### Step 3: フィールド単位の抽出
Step 2で特定した各領域から、以下のフィールドを抽出してください。
読み取れないフィールドはnullとし、各フィールドの信頼度を0.0-1.0で記載してください。

{抽出フィールド定義}

### Step 4: 整合性チェック
- 明細の合計と総合計が一致するか確認
- 日付のフォーマットが妥当か確認
- 数値の桁数が妥当か確認
```

**効果**: 単純な一括抽出と比較して、複雑なレイアウトの帳票で精度5-15%向上が期待できる。特に不定様式帳票では、Step 1の帳票種類判定が後段の抽出精度に大きく寄与する。

**適用条件**: トークン消費量が増加するため、高精度が必要な場合やスクリーニングで信頼度の低かったページに限定適用するのが合理的。

#### c) システムプロンプト最適化

**推奨システムプロンプト構成**:

```
あなたは日本語の業務帳票からデータを抽出する専門家です。
20年以上の経理・事務経験を持ち、様々な様式の帳票を正確に読み取ることができます。

## あなたの能力
- 様々な様式の請求書、納品書、見積書、注文書等を正確に読み取れる
- 日本語の縦書き、旧字体、略字にも対応できる
- テーブル構造を正確に把握し、行列の対応関係を正しく抽出できる
- 印影や透かしがあっても下のテキストを読み取れる

## 抽出ルール
- 値が読み取れない場合は必ずnullを返す（推測で値を生成しない）
- 日付はYYYY-MM-DD形式に統一する（和暦は西暦に変換）
- 金額はカンマなしの整数で返す（税込/税抜を明記）
- 電話番号はハイフン区切りで統一する
- 各フィールドの信頼度を0.0-1.0で自己評価する
- 信頼度0.7未満のフィールドには理由を付記する
```

**効果**: ロールの明確化により、帳票ドメイン特有の知識（和暦変換、全角半角統一等）が適切に適用される。

#### d) 日本語特有のプロンプト設計

**ポイント**:

1. **和暦変換ルールの明示**: 「令和」「平成」「昭和」等の和暦を西暦に変換するルールを明示
2. **全角/半角の正規化ルール**: 数値は半角、単位は全角等のルールを定義
3. **住所の構造化ルール**: 都道府県/市区町村/番地の分離ルール
4. **印鑑・社印の扱い**: 「角印があるが読み取り対象外」等の明示
5. **旧字体の対応**: 「旧字体は新字体に変換して出力」等の指示

### 2.2 Few-shot Learning / In-context Learning

#### a) 過去の成功抽出例をプロンプトに含める手法

**実装パターン**:

```typescript
// Few-shot例の構造
interface ExtractionExample {
  image: Buffer;           // 帳票画像
  expected_output: object; // 正解抽出結果
  document_type: string;   // 帳票種類
  difficulty: string;      // 難易度
}

// プロンプト構築
function buildFewShotPrompt(
  examples: ExtractionExample[],
  targetSchema: ZodSchema,
): Message[] {
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Few-shot例を追加
  for (const example of examples) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: '以下の帳票からデータを抽出してください。' },
        { type: 'image', image: example.image },
      ],
    });
    messages.push({
      role: 'assistant',
      content: JSON.stringify(example.expected_output, null, 2),
    });
  }

  // 対象画像
  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: '以下の帳票からデータを抽出してください。' },
      { type: 'image', image: targetImageBuffer },
    ],
  });

  return messages;
}
```

**効果**: 研究により、Few-shot例の数と抽出精度の間に正の相関が確認されている。特に同一ベンダーの帳票（レイアウト類似性が高い）では、1例のデモンストレーションだけで大幅な精度向上が見られる。

#### b) 類似帳票の自動検索・選択（RAG的アプローチ）

**実装方針**:

```
1. 帳票画像をVLMまたはCLIPモデルで埋め込みベクトル化
2. ベクトルDBに保存（過去の成功抽出例+正解データ）
3. 新規帳票が入力されたら、類似度検索で最も似た帳票を上位K件取得
4. 取得した類似帳票をFew-shot例としてプロンプトに含める
```

**技術選定**:

| コンポーネント | 推奨技術 | 理由 |
|-------------|---------|------|
| 画像埋め込み | CLIP (OpenAI) / SigLIP | 視覚的類似性の高速計算 |
| ベクトルDB | Supabase pgvector | 既存スタックとの統合容易 |
| 類似度指標 | コサイン類似度 | 標準的で効果的 |
| 取得件数 | 2-3件 | トークン消費と精度のバランス |

#### c) 例示の最適数と選び方

**調査結果**:

- **最適例数**: 2-3件がコスト対精度のバランスとして最適。4件以上ではプロンプト長の増加に対して精度向上が逓減する
- **選び方の優先順位**:
  1. 同一ベンダー（発行元）の帳票 -- レイアウトが同一のため最も効果的
  2. 同一帳票種類（請求書→請求書等）-- フィールド配置が類似
  3. 類似レイアウト（テーブル構成、ヘッダー位置等）-- ビジュアル類似度ベース

- **重要な知見**: 不定様式帳票では、有限のベンダーセットからの帳票の場合、内部のバリエーションが低いため、1つの抽出例だけで十分に他の類似帳票にも能力が拡張される

#### d) 動的Few-shot選択の実装パターン

**Anthropicのプロンプトキャッシュ活用**:

```
[Static Content - キャッシュ対象]
- システムプロンプト（抽出ルール、出力スキーマ定義）
- Few-shot例（固定的に使用する2-3件の代表例）
- ツール定義

[Dynamic Content - 毎回変動]
- 動的に選択された類似帳票のFew-shot例（0-2件）
- 対象の帳票画像
- 帳票固有の追加指示
```

**効果**: 静的コンテンツを先頭に配置してキャッシュすることで、コスト最大90%削減、レイテンシ85%削減が可能（Anthropicの公式ガイダンス）。

### 2.3 画像前処理

#### a) 解像度調整（DPI最適化）

**推奨DPI設定**:

| 帳票タイプ | 推奨DPI | 理由 |
|-----------|--------|------|
| 活字印刷（クリア） | 200-300 DPI | 十分な精度を維持しつつトークン消費を抑制 |
| 活字印刷（低品質スキャン） | 300-400 DPI | 細部の認識精度確保 |
| 手書き混在 | 300-400 DPI | 手書き文字の認識に高解像度が必要 |
| 小文字・注釈が多い | 400 DPI | 微細テキストの読み取りに必要 |

**重要**: 200 DPI未満では精度が著しく低下する。600 DPI超はファイルサイズが増大するのみで精度向上なし。低品質スキャンにスーパーレゾリューション前処理を適用することで、72 DPIから80%の精度達成が報告されている（未処理では60%程度）。

#### b) ページ分割戦略（マルチページ帳票の扱い）

**推奨戦略**:

```
1. PDFのページ数を確認
2. 各ページを個別に画像変換
3. ページ単位でVLMに送信（コンテキスト共有なし）
4. 結果をページ番号とともに統合
5. クロスページ参照が必要な場合のみ、関連ページをまとめて送信
```

**理由**: VLMは1ページの画像に対して最も精度が高い。複数ページを一度に送信するとコンテキストが分散し、個別フィールドの精度が低下する傾向がある。ただしGemini 2.5 Proは最大1,000ページのPDFをネイティブ処理可能。

**Claude/Geminiの場合**: PDFを直接入力可能なため、画像変換のステップを省略できる場合がある。ただし画像変換して送信した方が精度が安定する報告もあり、PoCで比較検証すべき。

#### c) 画像品質向上

**推奨前処理パイプライン**:

```typescript
import sharp from 'sharp';

async function preprocessForVLM(pdfPageImage: Buffer): Promise<Buffer> {
  return sharp(pdfPageImage)
    // 1. グレースケール変換（カラー情報が不要な帳票の場合）
    // .grayscale()
    // 2. コントラスト強調
    .normalize()
    // 3. シャープネス強調（ぼやけたスキャンの改善）
    .sharpen({ sigma: 1.5 })
    // 4. 適切なサイズにリサイズ（VLMの入力上限考慮）
    .resize(2048, null, {
      fit: 'inside',
      withoutEnlargement: true
    })
    // 5. PNG出力（ロスレス。JPEGは帳票のテキスト周辺にアーティファクト発生の恐れ）
    .png({ quality: 95 })
    .toBuffer();
}
```

**注意点**:
- カラー帳票はグレースケール化しない（色による区別情報が失われる）
- 傾き補正（deskew）は効果的だが、Node.jsでの実装は複雑。Python（OpenCV）のマイクロサービスを検討
- 二値化（binarization）はOCR向けには有効だがVLMには不要（むしろ情報損失）

#### d) PDF→画像変換の最適パラメータ

**推奨ライブラリ**: `pdf-to-img`（pdf.jsベース）または `sharp` + `pdf-lib`

```typescript
// pdf-to-imgを使用したPDF→画像変換
import { pdf } from 'pdf-to-img';

async function convertPdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
  const images: Buffer[] = [];
  const document = await pdf(pdfBuffer, { scale: 2.0 }); // scale 2.0 = 約200DPI

  for await (const image of document) {
    images.push(image);
  }
  return images;
}
```

**最適パラメータ**:

| パラメータ | 推奨値 | 理由 |
|-----------|-------|------|
| scale | 2.0-3.0 | 300DPI相当。精度とファイルサイズのバランス |
| format | PNG | ロスレス圧縮でテキストエッジを維持 |
| max_width | 2048px | VLMの入力制限と精度のバランス |
| background | white | 透明背景を白に変換（一部VLMが透明背景で誤動作） |

### 2.4 抽出結果の検証・補正

#### a) 複数VLMのアンサンブル（多数決）

**実装方針**:

```typescript
interface ExtractionResult {
  model: string;
  fields: Record<string, { value: string | null; confidence: number }>;
}

async function ensembleExtraction(
  image: Buffer,
  prompt: string,
): Promise<ExtractionResult> {
  // 複数モデルで並列抽出
  const results = await Promise.all([
    extractWithModel('gpt-4o-mini', image, prompt),
    extractWithModel('gemini-2.5-flash', image, prompt),
    extractWithModel('claude-sonnet-4.6', image, prompt),
  ]);

  // フィールドごとに多数決
  const ensembled: Record<string, { value: string | null; confidence: number }> = {};

  for (const field of allFields) {
    const values = results.map(r => r.fields[field]?.value);
    const valueCounts = countValues(values);
    const majorityValue = getMajorityValue(valueCounts);

    // 一致率を信頼度として算出
    const agreementRate = valueCounts[majorityValue] / results.length;

    ensembled[field] = {
      value: majorityValue,
      confidence: agreementRate,
    };
  }

  return { model: 'ensemble', fields: ensembled };
}
```

**効果**: 研究により、5-6モデルのアンサンブルが多様性と速度のバランスとして最適とされる。信頼度スコアと精度の間に強い正の相関が確認されている。

**コスト考慮**: 3モデルのアンサンブルでコストは3倍。全ページに適用するのではなく、信頼度の低いフィールドや重要な帳票に限定適用するのが合理的。

**推奨**: 低コストモデル3種（GPT-4o-mini、Gemini 2.5 Flash、Qwen2.5-VL）でアンサンブルすれば、コストを抑えつつ信頼度を算出可能。

#### b) 信頼度スコアの算出方法

**3つの信頼度算出手法**:

1. **モデル自己申告**: プロンプトでVLMに各フィールドの信頼度を0.0-1.0で自己評価させる。最もシンプルだが主観的
2. **アンサンブル一致率**: 複数モデルの結果一致率を信頼度とする。客観的だがコスト高
3. **Patch Confidence**: VLM出力のMaximum Softmax Probabilityから算出。モデル内部の確信度を利用。技術的に高度だが最も客観的

**推奨**: まずは「モデル自己申告」で実装し、精度が不足する場合にアンサンブルを追加。信頼度閾値は0.8をデフォルトとし、閾値未満のフィールドには手動確認フラグを立てる。

#### c) 正規表現/バリデーションによる後処理

```typescript
// バリデーションルール定義
const validationRules: Record<string, ValidationRule> = {
  date: {
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    transform: (v: string) => normalizeDate(v), // 和暦→西暦変換等
    validate: (v: string) => isValidDate(v),
  },
  phone: {
    pattern: /^\d{2,4}-\d{2,4}-\d{4}$/,
    transform: (v: string) => v.replace(/[^\d-]/g, ''),
  },
  amount: {
    pattern: /^\d+$/,
    transform: (v: string) => v.replace(/[,，、円¥]/g, ''),
    validate: (v: string) => !isNaN(Number(v)),
  },
  postal_code: {
    pattern: /^\d{3}-\d{4}$/,
    transform: (v: string) => v.replace(/[^\d]/g, '').replace(/^(\d{3})(\d{4})$/, '$1-$2'),
  },
};

function postProcess(
  extracted: Record<string, any>,
  rules: Record<string, ValidationRule>,
): Record<string, { value: any; valid: boolean; original: any }> {
  const result: Record<string, any> = {};

  for (const [field, value] of Object.entries(extracted)) {
    const rule = rules[field];
    if (!rule || value === null) {
      result[field] = { value, valid: true, original: value };
      continue;
    }

    const transformed = rule.transform ? rule.transform(String(value)) : value;
    const valid = rule.pattern
      ? rule.pattern.test(String(transformed))
      : rule.validate
        ? rule.validate(String(transformed))
        : true;

    result[field] = { value: transformed, valid, original: value };
  }

  return result;
}
```

#### d) 抽出結果の自動整合性チェック

**チェック項目**:

1. **数値整合性**: 明細行の合計 = 小計、小計 + 消費税 = 合計
2. **日付整合性**: 発行日 <= 納期、見積日 <= 有効期限
3. **必須フィールド**: 帳票種類ごとに必須のフィールドがnullでないか
4. **クロスフィールド**: 単価 x 数量 = 金額（各明細行）
5. **フォーマット**: 郵便番号、電話番号、日付等のフォーマット妥当性

**不整合時のアクション**: 不整合が検出された場合、該当フィールドの信頼度を自動的に下げ、手動確認フラグを立てる。

### 2.5 フィードバックループ

#### a) ユーザーの修正をプロンプト改善に反映する仕組み

**アーキテクチャ**:

```
[ユーザー修正] → [修正ログDB保存] → [定期分析] → [プロンプト/Few-shot例更新]

修正ログのスキーマ:
{
  document_id: string,
  document_type: string,
  field_name: string,
  original_value: string,    // VLMの抽出値
  corrected_value: string,   // ユーザーの修正値
  correction_type: 'wrong_value' | 'missing' | 'format_error' | 'extra_field',
  timestamp: string,
  image_region: { x, y, w, h },  // 該当領域の座標（あれば）
}
```

**活用方法**:

1. **修正パターンの統計分析**: 頻出する修正パターンを特定し、プロンプトにルールとして追加
2. **成功例のFew-shot化**: ユーザーが修正した正しい結果を、将来のFew-shot例として蓄積
3. **エラーパターンのネガティブ例**: 「以下は間違いの例です。このような抽出をしないでください」として提示

#### b) 成功/失敗パターンの蓄積と活用

**DBスキーマ設計（Supabase）**:

```sql
-- 抽出結果の蓄積テーブル
CREATE TABLE extraction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  document_type TEXT,
  model_used TEXT,
  extracted_data JSONB,
  corrected_data JSONB,        -- ユーザー修正後データ（NULLなら修正なし=成功）
  accuracy_score FLOAT,         -- 自動計算: 修正前後の一致率
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ベンダー別の精度統計ビュー
CREATE VIEW vendor_accuracy_stats AS
SELECT
  document_type,
  model_used,
  AVG(accuracy_score) as avg_accuracy,
  COUNT(*) as total_documents,
  COUNT(*) FILTER (WHERE corrected_data IS NULL) as perfect_extractions
FROM extraction_results
GROUP BY document_type, model_used;
```

#### c) Active Learning的アプローチ

**手法**: 信頼度の低い抽出結果を優先的にユーザーにレビュー依頼し、そのフィードバックでモデルの弱点を効率的に改善する。

```
1. VLMで抽出実行
2. 各フィールドの信頼度を算出
3. 信頼度0.7未満のフィールドを含む帳票を「要確認」キューに投入
4. ユーザーが修正 → 修正データをFew-shot例として蓄積
5. 蓄積された修正データから、弱点パターンを自動分析
6. プロンプトの改善ポイントを提示
```

#### d) プロンプトの自動最適化

**実装アプローチ**:

1. **A/Bテスト方式**: 複数のプロンプトバリエーションを用意し、精度を比較して最良のものを採用
2. **エラー駆動型改善**: 頻出エラーパターンに対応するルールをプロンプトに自動追加
3. **メタプロンプト方式**: LLMに過去のエラーログを渡し、プロンプト改善案を生成させる

**注意**: 完全自動化はリスクが高い。プロンプト変更は必ず人間のレビューを経るべき。半自動（改善案の自動生成 + 人間の承認）が現実的。

### 2.6 マルチモーダル戦略

#### a) VLM + OCR ハイブリッド

**戦略**: VLMの視覚理解能力とOCRのテキスト抽出能力を組み合わせる。

```
パイプライン:
1. PDF→画像変換
2. OCR（Tesseract / PaddleOCR）でテキスト全文抽出
3. VLMに画像 + OCRテキストの両方を送信
4. VLMはOCR結果を参考にしつつ、視覚情報で補正・構造化
```

**プロンプト例**:

```
以下の帳票画像からデータを抽出してください。

参考として、OCRで読み取ったテキストを提供します。
OCRテキストには誤認識が含まれる可能性があるため、
画像を直接見て正確な値を判断してください。

--- OCRテキスト ---
{ocr_text}
--- OCRテキストここまで ---

{抽出指示}
```

**効果**: VLM単体と比較して、小さな文字や密な表の読み取り精度が向上する。OCRが正確に読めた部分はVLMの確認作業が軽減され、レイテンシも改善。

#### b) テキスト埋め込みPDFのテキストレイヤー活用

**判定ロジック**:

```typescript
import { getDocument } from 'pdfjs-dist';

async function detectPdfType(pdfBuffer: Buffer): Promise<'text' | 'image' | 'mixed'> {
  const pdf = await getDocument({ data: pdfBuffer }).promise;
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();

  // テキストアイテムの数で判定
  const textLength = textContent.items
    .map((item: any) => item.str)
    .join('')
    .length;

  if (textLength > 100) return 'text';   // テキスト埋め込みPDF
  if (textLength > 10) return 'mixed';    // 一部テキスト
  return 'image';                         // 画像PDF（スキャン）
}
```

**テキストPDFの場合**: pdf.jsでテキスト抽出 → VLMでの構造化（コスト大幅削減）

```
パイプライン:
1. pdf.jsでテキスト+座標情報を抽出（100%精度）
2. テキスト情報をVLMに送信して構造化
3. 画像は送信不要 → トークン消費大幅削減
```

**効果**: テキスト埋め込みPDFの場合、画像送信を省略でき、コストが80-90%削減可能。

#### c) VLM + テキスト情報の統合

**最適な統合方法**: PDF種類に応じた動的パイプライン選択

| PDF種類 | パイプライン | コスト | 精度 |
|---------|-----------|-------|------|
| テキストPDF | pdf.jsテキスト抽出 → LLM構造化 | 最低 | 非常に高い |
| 画像PDF（高品質） | VLM直接解析 | 中 | 高い |
| 画像PDF（低品質） | 前処理 → OCR + VLMハイブリッド | 中-高 | 高い |
| 混在PDF | テキストレイヤー + VLM画像解析の統合 | 中 | 非常に高い |

---

## 3. アーキテクチャパターン

### 3.1 抽出パイプラインの設計

```
[PDF入力]
    |
    v
[1. PDF種類判定] ── テキストPDF → [テキスト抽出パイプライン]
    |                                    |
    | 画像PDF/混在                        |
    v                                    |
[2. 画像前処理]                          |
    | - DPI調整                          |
    | - コントラスト強調                    |
    | - ページ分割                        |
    v                                    |
[3. 一次抽出（スクリーニング）]              |
    | - 軽量モデル（GPT-4o-mini等）         |
    | - 信頼度スコア算出                    |
    v                                    v
[4. 信頼度判定] ──── 高信頼度(>=0.8) → [6. 後処理・バリデーション]
    |                                    |
    | 低信頼度(<0.8)                      |
    v                                    |
[5. 二次抽出（高精度）]                    |
    | - 高精度モデル（GPT-4o等）            |
    | - CoT プロンプト                    |
    | - Few-shot例追加                    |
    | - 必要に応じてアンサンブル             |
    v                                    |
[6. 後処理・バリデーション] <──────────────┘
    | - 正規表現バリデーション
    | - 数値整合性チェック
    | - フォーマット正規化
    v
[7. 結果出力 + 手動確認フラグ]
    |
    v
[8. ユーザー確認・修正]
    |
    v
[9. フィードバック蓄積]
```

### 3.2 バッチ処理のスケーラビリティ

**設計方針**:

```typescript
// キューベースのバッチ処理アーキテクチャ
interface BatchProcessingConfig {
  maxConcurrency: number;       // API並列呼出数（レート制限内）
  retryAttempts: number;        // リトライ回数
  retryDelay: number;           // リトライ間隔（ms）
  timeoutPerPage: number;       // 1ページの処理タイムアウト（ms）
  batchSize: number;            // バッチサイズ
  priorityQueue: boolean;       // 優先度キューの使用
}

const defaultConfig: BatchProcessingConfig = {
  maxConcurrency: 5,            // GPT-4oのレート制限を考慮
  retryAttempts: 3,
  retryDelay: 2000,
  timeoutPerPage: 30000,
  batchSize: 10,
  priorityQueue: true,
};
```

**スケーリング戦略**:

| 処理量 | アーキテクチャ | インフラ |
|--------|------------|---------|
| ~100ページ/日 | シンプルなキュー処理 | Vercel Serverless Functions |
| ~1,000ページ/日 | Worker + キュー | Vercel + Upstash Redis Queue |
| ~10,000ページ/日 | 分散Worker | 専用サーバー + BullMQ |

### 3.3 コスト最適化（カスケード戦略）

**2段階カスケード方式**:

```
Stage 1: スクリーニング（低コストモデル）
  - Gemini 2.5 Flash / GPT-4o-mini
  - 全ページを処理
  - 信頼度スコアを算出
  - コスト: ~$0.002/ページ

Stage 2: 高精度抽出（条件分岐）
  - 信頼度 >= 0.8: Stage 1の結果をそのまま採用
  - 信頼度 < 0.8: GPT-4o / Gemini 2.5 Proで再抽出
  - コスト: ~$0.03/ページ（対象ページのみ）

期待コスト: 仮にStage 2対象が20%の場合
  = $0.002 * 100% + $0.03 * 20% = $0.008/ページ
  （全ページ高精度モデルの場合 $0.03/ページと比較して約73%削減）
```

### 3.4 エラーハンドリングとリトライ戦略

```typescript
async function extractWithRetry(
  image: Buffer,
  config: RetryConfig,
): Promise<ExtractionResult> {
  const models = [
    { name: 'gpt-4o-mini', priority: 1 },
    { name: 'gemini-2.5-flash', priority: 2 },
    { name: 'gpt-4o', priority: 3 },      // フォールバック
  ];

  for (const model of models) {
    for (let attempt = 0; attempt < config.retryAttempts; attempt++) {
      try {
        const result = await extractWithModel(model.name, image);

        // 結果の妥当性チェック
        if (isResultValid(result)) {
          return result;
        }

        // 結果は返ったが妥当でない → 次のモデルへ
        break;
      } catch (error) {
        if (isRateLimitError(error)) {
          await delay(error.retryAfter * 1000);
          continue;
        }
        if (isTimeoutError(error)) {
          continue; // リトライ
        }
        // その他のエラー → 次のモデルへ
        break;
      }
    }
  }

  // 全モデル失敗 → 手動処理キューへ
  return { status: 'failed', requiresManualReview: true };
}
```

---

## 4. 競合製品・先行事例の分析

### 4.1 クラウドAIドキュメント処理サービス

| サービス | 提供元 | 不定様式対応 | 日本語対応 | コスト | 精度 | カスタムモデル |
|---------|--------|------------|-----------|-------|------|-------------|
| **Amazon Textract Queries** | AWS | 高い | 良好 | $1.50/1K枚~ | 94-95% | 不可 |
| **Google Document AI** | Google | 高い | 良好 | $1.50/1K枚~ (大量で$0.60) | 95-96% | 可 |
| **Azure AI Document Intelligence** | Microsoft | 非常に高い | 優秀 | $1.50/1K枚~ | 96% | 可（ラベリング+学習） |
| **Nanonets** | Nanonets | 高い | 良好 | 要見積 | 高い | 可 |
| **Unstructured.io** | Unstructured | 高い | 良好 | OSS版無料 / API版有料 | 高い | 可 |

**各サービスの採用手法**:

- **Amazon Textract**: テーブル抽出が業界最高水準。セルレベルのリレーションシップマッピングとマージセル検出に強い。ただしカスタムモデルの学習不可で「as-is」利用のみ
- **Google Document AI**: エンドツーエンドソリューション。カスタムラベリング+学習が可能。大量処理時のコスト優位性（$0.60/1K枚）
- **Azure AI Document Intelligence**: 旧Form Recognizer。カスタムラベリング+学習対応。印刷テキストベンチマークで96%の最高精度

### 4.2 OSS/スタートアップの先行事例

| プロジェクト/企業 | アプローチ | 特徴 |
|---------------|----------|------|
| **PaddleOCR-VL 1.5** | VLMベースOCR (0.9Bパラメータ) | OmniDocBench v1.5で94.5%の精度。軽量で高精度 |
| **NVIDIA Nemotron Parse 1.1** | VLMベースドキュメントパーサー | 複雑な文書をRAG用構造化データに変換 |
| **OlmOCR-2** | VLMベースOCR | 従来OCR（Tesseract等）を大幅に上回る精度 |
| **MinerU 2.0** | ドキュメントパーシング | VLMベースで85-95%の精度 |
| **Marker** | PDF→Markdown変換 | OCR+VLMハイブリッドで高精度変換 |
| **Docling (IBM)** | ドキュメント理解 | テーブル・図表の構造化抽出 |

**先行事例から学べるポイント**:

1. **カスケード戦略の有効性**: 軽量モデルでスクリーニング → 高精度モデルで再抽出のパターンが一般的
2. **VLM + OCRハイブリッド**: VLM単体よりもOCR結果を補助情報として活用した方が精度向上
3. **ファインチューニングの効果**: 汎用VLMよりもドメイン特化のファインチューニングで精度が大幅向上するが、開発コストが高い
4. **プロンプトキャッシュの活用**: Anthropic等が提供するプロンプトキャッシュで大幅なコスト削減が可能

### 4.3 PRJ-003との差別化ポイント

PRJ-003が上記競合に対して差別化できるポイント:

1. **カスタマイズ性**: ユーザーが抽出フィールドを自由に定義可能（固定スキーマではない）
2. **フィードバックループ**: ユーザーの修正が自動的に精度改善に反映される
3. **マルチモデル対応**: 複数VLMを切り替え可能で、ベンダーロックインを回避
4. **ローカル処理オプション**: 機密帳票をクラウドに送信せずにローカルVLMで処理可能
5. **コスト効率**: カスケード戦略により、クラウドサービスの固定料金より安価に

---

## 5. 技術的リスクと対策

### 5.1 日本語帳票特有の課題

| 課題 | リスク度 | 対策 |
|------|---------|------|
| **縦書きテキスト** | 高 | Qwen系VLMを縦書き用に優先採用。縦書き検出時のプロンプト切替。合成データでのファインチューニング検討 |
| **旧字体** | 中 | プロンプトに「旧字体は新字体に変換」ルールを明示。旧字体マッピングテーブルの後処理 |
| **手書き混在** | 高 | 手書き領域の自動検出 → 高精度モデル（GPT-4o / Claude）で処理。HTRモデルとの併用検討 |
| **全角/半角混在** | 低 | 後処理で正規化。バリデーションルールで統一 |
| **和暦表記** | 低 | 後処理で西暦変換。変換テーブルをシステム内蔵 |
| **印影・社印による文字被り** | 中 | 画像前処理で赤色チャネル除去（多くの印影は朱色）。VLMに「印影の下のテキストを読む」指示 |
| **罫線密度の高い帳票** | 中 | VLMの方がOCRより罫線付き帳票に強い。テーブル構造認識を強化するプロンプト |

### 5.2 VLM APIレート制限への対応

| プロバイダー | レート制限（目安） | 対策 |
|------------|----------------|------|
| OpenAI (GPT-4o) | Tier 1: 500 RPM, 30K TPM | Tier昇格申請、バッチAPI利用（50%OFF + 制限緩和） |
| OpenAI (GPT-4o-mini) | Tier 1: 500 RPM, 200K TPM | トークン制限が緩い。スクリーニング向き |
| Anthropic (Claude) | Tier 1: 50 RPM, 40K TPM | メッセージバッチAPI利用。プロンプトキャッシュ活用 |
| Google (Gemini) | 無料: 15 RPM / 有料: 1000 RPM | 有料プランで十分な制限。最も緩い |

**対策パターン**:

1. **複数プロバイダー分散**: 3社のAPIを輪番で使用し、実質的なレート制限を3倍に
2. **バッチAPI活用**: OpenAI Batch APIは50%割引かつレート制限が緩い（24時間以内の非同期処理）
3. **プロンプトキャッシュ**: 静的部分のキャッシュでトークン消費を削減
4. **リクエストキューイング**: Upstash Redis等でキューを構築し、レート制限内で自動調整

### 5.3 コスト見積もり

#### 月間処理量別コスト見積もり（カスケード戦略適用時）

| 月間処理量 | Stage 1コスト | Stage 2コスト (20%想定) | 合計月間コスト | ページ単価 |
|-----------|-------------|----------------------|-------------|----------|
| 100ページ | $0.20 | $0.60 | **$0.80** | $0.008 |
| 500ページ | $1.00 | $3.00 | **$4.00** | $0.008 |
| 1,000ページ | $2.00 | $6.00 | **$8.00** | $0.008 |
| 5,000ページ | $10.00 | $30.00 | **$40.00** | $0.008 |
| 10,000ページ | $20.00 | $60.00 | **$80.00** | $0.008 |

> **前提条件**: Stage 1はGPT-4o-mini ($0.002/ページ)、Stage 2はGPT-4o ($0.03/ページ、対象20%)。実際のコストはページの複雑さ、解像度、プロンプト長で変動。バッチAPI利用時は更に50%削減可能。

#### 競合クラウドサービスとのコスト比較

| 月間1,000ページ | 自社構築 (カスケード) | Azure Document AI | Google Document AI | Amazon Textract |
|---------------|------------------|------------------|-------------------|----------------|
| コスト | **$8** | $1.50 | $1.50 | $1.50 |
| カスタマイズ性 | 非常に高い | 中 | 中 | 低 |
| フィードバックループ | あり | なし | あり (学習可) | なし |
| ローカル処理 | 可能 | 不可 | 不可 | 不可 |

> **注記**: クラウドサービスの方がページ単価は安いが、不定様式への柔軟な対応、カスタムフィールド定義、フィードバックループによる継続的改善では自社構築が優位。

### 5.4 プライバシー・セキュリティ

| リスク | 深刻度 | 対策 |
|--------|-------|------|
| **機密帳票のクラウド送信** | 高 | ローカルVLM（Qwen2.5-VL）オプションの提供。利用規約の明示 |
| **API通信の傍受** | 中 | TLS 1.3による暗号化通信。API Key管理の徹底 |
| **クラウドでのデータ保持** | 高 | OpenAI/Anthropic/GoogleのData Usage Policy確認。オプトアウト設定の実施 |
| **個人情報の含まれる帳票** | 高 | PII検出 → 自動マスキング → クラウド送信の検討。または全てローカル処理 |
| **アクセス権限管理** | 中 | RBACの実装。帳票データへのアクセスログ記録 |

**各プロバイダーのデータポリシー（2026年3月時点）**:

- **OpenAI API**: API経由のデータはモデル学習に使用されない（デフォルト）。30日間のログ保持後削除
- **Anthropic API**: API経由のデータはモデル学習に使用されない。Safety目的のログ保持あり
- **Google Gemini API**: API経由のデータはモデル改善に使用されない（有料API）。無料版は注意
- **ローカルVLM**: データは一切外部に送信されない。最も安全

**推奨**: 機密度に応じた処理経路の分岐

```
[帳票入力] → [機密度判定]
  |
  ├── 機密度:低 → クラウドVLM（高精度・高速）
  ├── 機密度:中 → クラウドVLM（データ保持オプトアウト設定済）
  └── 機密度:高 → ローカルVLM（Qwen2.5-VL）
```

---

## 6. 総合推奨と実現性評価

### 6.1 推奨アーキテクチャ

PRJ-003の不定様式PDF VLMデータ抽出システムとして、以下のアーキテクチャを推奨する。

**コアコンセプト: カスケード抽出 + フィードバックループ**

```
[PDF入力]
    |
    v
[PDF種類判定] ─── テキストPDF → [pdf.jsテキスト抽出 → LLM構造化]
    |                                                      |
    | 画像PDF                                               |
    v                                                      |
[画像前処理（300DPI, コントラスト強調）]                        |
    |                                                      |
    v                                                      |
[Stage 1: 軽量VLMスクリーニング]                              |
    | Gemini 2.5 Flash / GPT-4o-mini                       |
    | + 動的Few-shot（類似帳票RAG検索）                        |
    |                                                      |
    v                                                      |
[信頼度判定]                                                 |
    |                                                      |
    ├── 高信頼度 → [後処理・バリデーション] ←──────────────────┘
    |                       |
    └── 低信頼度 → [Stage 2: 高精度VLM]
                    | GPT-4o / Gemini 2.5 Pro
                    | + CoTプロンプト
                    | + OCRハイブリッド
                    v
                 [後処理・バリデーション]
                    |
                    v
               [結果出力 + 手動確認フラグ]
                    |
                    v
               [ユーザー確認・修正]
                    |
                    v
               [フィードバックDB蓄積]
                    |
                    v
               [Few-shot例更新 / プロンプト改善]
```

### 6.2 技術スタック推奨

| コンポーネント | 推奨技術 | 理由 |
|-------------|---------|------|
| VLM（スクリーニング） | Gemini 2.5 Flash | 最安価で十分な精度。レート制限も緩い |
| VLM（高精度） | GPT-4o / Claude Sonnet 4.6 | 精度とコストのバランス |
| VLM（ローカル） | Qwen2.5-VL (7B) via Ollama | CJK最適化、8GB VRAMで動作 |
| AI SDK | Vercel AI SDK | マルチプロバイダー対応、Zodスキーマ統合 |
| PDF処理 | pdf.js (pdfjs-dist) | テキスト抽出、ページレンダリング |
| 画像前処理 | sharp | Node.jsネイティブ、高速 |
| 類似帳票検索 | Supabase pgvector + CLIP | 既存スタック活用 |
| バッチ処理キュー | Upstash Redis | Vercel連携、サーバーレス対応 |
| フィードバックDB | Supabase (PostgreSQL) | 既存スタック |

### 6.3 実現性評価

| 項目 | 評価 | 備考 |
|------|------|------|
| 技術的実現可能性 | 高い | 各要素技術は成熟。統合の設計が鍵 |
| 精度目標（90%+） | 達成可能 | カスケード+フィードバックで段階的に改善可能 |
| コスト | 許容範囲 | カスケード戦略で$0.008/ページ程度 |
| 開発工数 | 中-高 | パイプライン全体の実装は2-3ヶ月見込み |
| 日本語対応 | 課題あり | 縦書き・手書きは精度80%台。改善余地あり |
| スケーラビリティ | 高い | キューベースで10,000ページ/日まで対応可能 |
| セキュリティ | 対応可能 | ローカルVLMオプションで機密帳票にも対応 |

### 6.4 PoC実施の推奨

本格実装の前に、以下のPoCを推奨する:

1. **モデル精度比較PoC**: 実際のクライアント帳票10-20種で各VLMの精度を計測
2. **カスケード効果検証**: Stage 1 → Stage 2 のカスケードによるコスト削減効果の検証
3. **プロンプト最適化PoC**: CoT、Few-shot、システムプロンプトの各手法の効果測定
4. **日本語特有ケース検証**: 縦書き、手書き、旧字体の各ケースでの精度計測

---

## 参考情報源

- [VLM: How Vision-Language Models Work (2026 Guide) | Label Your Data](https://labelyourdata.com/articles/machine-learning/vision-language-models)
- [OmniAI OCR Benchmark](https://getomni.ai/blog/ocr-benchmark)
- [Best Vision Language Models for Document Data Extraction | Nanonets](https://nanonets.com/blog/vision-language-model-vlm-for-data-extraction/)
- [Multimodal AI: The Best Open-Source Vision Language Models in 2026 | BentoML](https://www.bentoml.com/blog/multimodal-ai-a-guide-to-open-source-vision-language-models)
- [Top 10 Vision Language Models in 2026 | DataCamp](https://www.datacamp.com/blog/top-vision-language-models)
- [Qwen2.5-VL on Ollama](https://ollama.com/library/qwen2.5vl)
- [Qwen3-VL on Ollama](https://ollama.com/library/qwen3-vl)
- [Qwen3-VL GitHub](https://github.com/QwenLM/Qwen3-VL)
- [Deploy Qwen2.5-VL Locally | Markaicode](https://markaicode.com/deploy-qwen25-vl-vision-language-model-local/)
- [Out-of-the-Box to State-of-the-Art: VLMs for Document Processing | Hyperscience](https://www.hyperscience.ai/blog/out-of-the-box-to-state-of-the-art-how-vision-language-models-are-transforming-document-processing/)
- [Fine-tune VLMs for Multipage Document-to-JSON | AWS](https://aws.amazon.com/blogs/machine-learning/fine-tune-vlms-for-multipage-document-to-json-with-sagemaker-ai-and-swift/)
- [Few-Shot Prompting | Prompt Engineering Guide](https://www.promptingguide.ai/techniques/fewshot)
- [Prompt Engineering Best Practices 2026 | Thomas Wiegold](https://thomas-wiegold.com/blog/prompt-engineering-best-practices-2026/)
- [Evaluating MLLMs on Vertically Written Japanese Text](https://arxiv.org/html/2511.15059v1)
- [Gemini 2.5 Pro PDF Layout Understanding | WinBuzzer](https://winbuzzer.com/2025/04/21/gemini-2-5-pro-appears-to-be-first-ai-model-to-fully-understand-pdf-layouts-enabling-precise-citations-xcxwbn/)
- [Gemini Document Understanding | Google AI](https://ai.google.dev/gemini-api/docs/document-processing)
- [Conquering Large PDF OCR with Gemini 2.5 Flash | Medium](https://medium.com/@xavierjesudhas3/conquering-large-pdf-ocr-with-gemini-2-5-flash-a-streamlined-methodology-babfa172f665)
- [Claude Vision API: Documents at Scale | CallSphere](https://callsphere.tech/blog/claude-vision-api-documents-at-scale)
- [Claude Sonnet 4.6 Specs & Benchmarks](https://ucstrategies.com/news/claude-sonnet-4-6-specs-benchmarks-api-pricing-guide-2026/)
- [GPT-4o API Pricing 2026](https://pricepertoken.com/pricing-page/model/openai-gpt-4o)
- [OpenAI API Pricing](https://openai.com/api/pricing/)
- [OCR AI Updates 2026 | VAO](https://www.vao.world/blogs/OCR%20AI%20Updates%202026:%20What%E2%80%99s%20New%20in%20Accuracy,%20Cost,%20and%20Document%20Automation)
- [AWS Textract vs Google Document AI OCR Comparison 2026 | Braincuber](https://www.braincuber.com/blog/aws-textract-vs-google-document-ai-ocr-comparison)
- [Best AI Document Parser Tools (2026) | Extend](https://www.extend.ai/resources/ai-document-parser)
- [Building Confidence Scores for GenAI | Spotify Engineering](https://engineering.atspotify.com/2024/12/building-confidence-a-case-study-in-how-to-create-confidence-scores-for-genai-applications)
- [Multiple LLM Consensus for Object Detection](https://www.preprints.org/manuscript/202511.0879/v1/download)
- [PaddleOCR-VL-1.5: Multi-Task 0.9B VLM for Document Parsing](https://arxiv.org/html/2601.21957v1)
- [NVIDIA Nemotron Parse 1.1](https://developer.nvidia.com/blog/turn-complex-documents-into-usable-data-with-vlm-nvidia-nemotron-parse-1-1/)
- [Improve OCR Accuracy With Advanced Image Preprocessing | Docparser](https://docparser.com/blog/improve-ocr-accuracy/)
- [VLM-Based Information Extraction | Firstsource](https://www.firstsource.com/insights/whitepapers/document-processing-with-vlm)

---

**調査担当**: リサーチ部門
**次のアクション**: CEOへ報告。PM部門と連携し、PoC計画の策定を推奨。
