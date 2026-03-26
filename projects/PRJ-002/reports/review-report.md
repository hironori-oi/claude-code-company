# PRJ-002 包括的コード品質レビューレポート

**案件名**: PDF帳票OCR/VLMデータ自動抽出システム
**レビュー日**: 2026-03-22
**レビュー対象**: `src/` 配下全ソースファイル（Phase 1-4 実装完了分）
**レビュー担当**: レビュー部門（品質管理）

---

## 1. エグゼクティブサマリー

全体として、アーキテクチャ設計は明確でモジュール分離が適切に行われている。Storage層のインターフェース抽象化、エンジンの動的インポートによる遅延読み込み、exhaustive switchパターンの活用など、高品質な設計判断が見られる。

一方で、**セキュリティ面で1件のCritical指摘**（APIキー/S3クレデンシャルのlocalStorage平文保存）があり、これは本番運用前に必ず対応が必要である。Major指摘が8件、Minor指摘が11件あるが、アプリケーションの基本機能を阻害するものはない。

**総合評価: 条件付き承認**（Critical 1件の修正完了を条件とする）

---

## 2. Critical指摘一覧（必須修正）

### C-1: APIキー・S3クレデンシャルのlocalStorage平文保存

**対象ファイル**:
- `src/lib/storage/settings-storage.ts`（L105: `localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))`）
- `src/lib/extraction/types.ts`（L31: `apiKey: string`、L58-59: `accessKeyId`/`secretAccessKey`）

**詳細**: `SystemSettings`にOpenAI APIキー（`ai.openai.apiKey`）とS3クレデンシャル（`s3Configs[].accessKeyId`, `s3Configs[].secretAccessKey`）が含まれ、これがlocalStorageにJSON平文で永続化される。localStorageはJavaScriptから自由にアクセス可能であり、XSS脆弱性が1つでもあればクレデンシャルが窃取される。

**修正案**:
1. サーバーサイドで暗号化して保存する（推奨: Next.js API Routeを経由しSupabaseに暗号化保存）
2. 最低限の対策として、ブラウザのWeb Crypto APIで暗号化してからlocalStorageに保存する
3. S3操作はサーバーサイドAPI Route経由で実行し、クレデンシャルをクライアントに露出させない

**OWASP分類**: A02:2021 - Cryptographic Failures

---

## 3. Major指摘一覧（強く推奨）

### M-1: Webhook URLのバリデーション不足

**対象ファイル**:
- `src/lib/webhook/webhook-sender.ts`（L65: `config.url`に対してフォーマット検証なし）
- `src/lib/watch/watch-engine.ts`（L255: `profile.webhookUrl`に対してフォーマット検証なし）
- `src/components/watch/watch-profile-dialog.tsx`（L368-375: URL入力に`type="url"`はあるが、保存時のサーバーサイド検証なし）

**詳細**: Webhook URLに対して、プロトコルの制限（`https://`のみ許可）、プライベートIPアドレスのブロック（SSRF防止）、URLフォーマットの構造検証が行われていない。悪意あるURLが設定されるとSSRF（Server-Side Request Forgery）のリスクがある。

**修正案**: URL送信前に`new URL()`でパース検証し、`https://`プロトコルのみ許可、プライベートIP範囲（10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8）をブロックするバリデーション関数を追加する。

### M-2: bulkReplaceResultsでのReDoS脆弱性

**対象ファイル**: `src/lib/storage/job-storage.ts`（L217: `new RegExp(searchPattern, "g")`）

**詳細**: ユーザー入力の`searchPattern`をそのまま`new RegExp()`に渡している。悪意ある正規表現パターン（例: `(a+)+$`）が入力されるとReDoS攻撃によりブラウザがハングする可能性がある。`try-catch`でパースエラーは捕捉しているが、実行時の計算量爆発は防げない。

**修正案**: 正規表現のタイムアウト機構を実装するか、ユーザーが入力可能な正規表現パターンを制限する（文字クラス、量指定子の入れ子禁止等）。あるいは、正規表現ではなく単純な文字列置換のみをサポートする方針に変更する。

### M-3: localStorage大量データでのパフォーマンス劣化リスク

**対象ファイル**:
- `src/lib/storage/job-storage.ts`（L68-76: `readAllResults()`が全結果を毎回パースして返す）

**詳細**: `readAllResults()`は全ジョブの全結果をlocalStorageから読み込みJSONパースする。100ファイル x 10フィールド = 1,000レコードが蓄積された場合、`getResults(jobId)`（L143）、`updateResult`（L160）、`bulkReplaceResults`（L208）の各操作で毎回全件パース + フィルタ + 全件書き戻しが発生する。これはUIスレッドをブロックし、応答性の低下を招く。

**修正案**:
1. 結果データをジョブIDごとに別キーで分割保存する（`pdf-extract-results-{jobId}`形式）
2. IndexedDBへの移行（構造化クローンでJSONパースオーバーヘッドを回避）
3. Web Workerでの非同期処理

### M-4: OCR Workerのメモリリーク可能性

**対象ファイル**: `src/lib/extraction/ocr-engine.ts`（L3-15: `workerPromise`のグローバルシングルトン）

**詳細**: Tesseract.jsのWorkerがグローバルシングルトンとして保持され、`terminateOCRWorker()`が明示的に呼ばれない限り解放されない。現在のコードベースで`terminateOCRWorker()`を呼び出している箇所が見当たらない。長時間のセッションや大量バッチ処理後にメモリが増加し続ける。

**修正案**: バッチ処理完了時（`batch-engine.ts`の`onBatchComplete`コールバック後）に`terminateOCRWorker()`を呼び出す。または、一定時間アイドル後に自動解放するタイムアウト機構を追加する。

### M-5: base64変換の非効率な実装

**対象ファイル**:
- `src/lib/extraction/pdf-crop.ts`（L55-60, L98-103）
- `src/lib/extraction/ocr-engine.ts`（L43-48）

**詳細**: `Uint8Array`からbase64への変換で、バイトごとに`String.fromCharCode()`で文字列結合 + `btoa()`を使用している。これはO(n^2)に近い性能特性を持ち、大きなPDFページ画像（数MB）で顕著に遅くなる。

**修正案**: 以下のような効率的な実装に置き換える:
```typescript
// チャンク処理でメモリ効率も改善
function uint8ToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return btoa(chunks.join(''));
}
```

### M-6: PDF文書のサイズ制限がクライアントサイドのみ

**対象ファイル**:
- `src/components/extract/file-upload.tsx`（L42: `maxSize: 50 * 1024 * 1024`）
- `src/components/extract/batch-file-upload.tsx`（L15: `MAX_FILE_SIZE = 50 * 1024 * 1024`）

**詳細**: ファイルサイズの検証がreact-dropzoneのクライアントサイドバリデーションのみで行われている。テンプレートへのPDFアップロード（`template-editor.tsx`の`handlePdfUpload`）にはサイズ制限がない。テンプレートPDFはbase64エンコードされてlocalStorageに保存されるため（`template-storage.ts`）、大きなPDFがlocalStorageの容量上限（通常5-10MB）を超過しサイレントに失敗する可能性がある。

**修正案**: テンプレートPDFアップロード時にもサイズ検証を追加する（base64変換後のサイズも考慮し、元ファイル3MB程度を上限とする）。localStorageの容量超過をtry-catchで適切にハンドリングし、ユーザーに分かりやすいエラーメッセージを表示する。

### M-7: Watch EngineのsetInterval競合

**対象ファイル**: `src/lib/watch/watch-engine.ts`（L307: `void executeScan(currentProfile, handle)`）

**詳細**: `setInterval`内で`executeScan`を`void`で非同期実行しているが、前回のスキャンが完了する前に次のインターバルが発火する可能性がある。特に「REALTIME」モード（10秒間隔）で、大量ファイルのバッチ処理が10秒以上かかる場合、同一プロファイルに対して複数の並列スキャンが走り、データ不整合（processedFilesの重複カウント等）が発生する。

**修正案**: スキャン実行中フラグを追加し、前回スキャンが完了するまで次のスキャンをスキップするガード条件を追加する。

### M-8: types/database.tsのExtractionJob型重複

**対象ファイル**:
- `src/types/database.ts`（L92-102: `ExtractionJob`インターフェース）
- `src/lib/storage/job-storage.ts`（L1-14: `ExtractionJob`インターフェース）

**詳細**: `ExtractionJob`型が2箇所で異なるスキーマで定義されている。`database.ts`版はSupabase向け（snake_case、statusが小文字）、`job-storage.ts`版はlocalStorage向け（camelCase、statusが大文字）。同名のインターフェースが異なるプロパティを持つため、import先を間違えるとランタイムエラーの原因になる。

**修正案**: `database.ts`側を`SupabaseExtractionJob`にリネームするか、localStorage版に統一してdatabase.ts側を削除する。もしくは、変換レイヤー（mapper関数）を明示的に定義する。

---

## 4. Minor指摘一覧（改善提案）

### m-1: `(e.target as HTMLInputElement).value`パターンの繰り返し

**対象ファイル**: 複数コンポーネント（`extract/page.tsx` L436、`watch-profile-dialog.tsx` L175等）

**詳細**: Inputコンポーネントの`onChange`で`e.target.value`を取得する際に毎回型アサーション`as HTMLInputElement`を行っている。型安全性が低く、コードの冗長性がある。

**修正案**: `React.ChangeEvent<HTMLInputElement>`を型引数に指定するか、ユーティリティヘルパー関数を作成する。

### m-2: pdf-crop.tsのas unknown二重キャスト

**対象ファイル**: `src/lib/extraction/pdf-crop.ts`（L34-36）

**詳細**: `ctx as unknown as CanvasRenderingContext2D`および`canvas as unknown as HTMLCanvasElement`の二重キャスト。OffscreenCanvasとHTMLCanvasElementの型互換性問題を回避しているが、ランタイム互換性が保証されない場合にサイレントに失敗する可能性がある。

**修正案**: pdfjs-dist公式のOffscreenCanvas対応状況を確認し、型定義の拡張（declaration merging）で対応するか、コメントで意図を明記する。

### m-3: マジックナンバーの散在

**対象ファイル**:
- `src/lib/watch/watch-engine.ts`（L289: `10_000`、L291: `60_000`）
- `src/lib/webhook/webhook-sender.ts`（L27: `TIMEOUT_MS = 10_000`、L28: `MAX_RETRIES = 2`）
- `src/lib/extraction/table-engine.ts`（L179: `3.0`、L291: `10`）
- `src/components/extract/batch-file-upload.tsx`（L14-15）

**詳細**: いくつかのマジックナンバーはファイル先頭で定数化されているが（良い実践）、一部はインラインのまま残っている。特に`table-engine.ts`のL291 `gridRows = 10`はフォールバック値として重要な意味を持つが、定数化されていない。

**修正案**: 全てのマジックナンバーを意味のある定数名で定義する。

### m-4: VLMのconfidenceがハードコード

**対象ファイル**:
- `src/lib/extraction/vlm-engine.ts`（L93: `confidence: 0.85`）
- `src/lib/extraction/table-engine.ts`（L210: `confidence: 0.85`、L337: `confidence: 0.75`）

**詳細**: VLMの信頼度が固定値でハードコードされている。コメント`// VLM confidence is estimated`が記載されているが、実際のモデル出力に基づく動的な信頼度評価がない。ユーザーが信頼度に基づいてフィルタリングする場合、誤解を招く。

**修正案**: ハードコード値であることをUIに明示するか、LLMレスポンスからlog probability等を取得して動的に算出する仕組みを検討する。

### m-5: DRY違反 - AIプロバイダー分岐の重複

**対象ファイル**:
- `src/lib/extraction/vlm-engine.ts`（L39-87: openai/ollama分岐）
- `src/lib/extraction/ocr-llm-engine.ts`（L49-71: openai/ollama分岐）
- `src/lib/extraction/table-engine.ts`（L84-132: `callVlmWithImage`内の分岐）

**詳細**: AIプロバイダー（OpenAI/Ollama）の切り替えロジックが3箇所で実質的に同じコードとして重複している。新しいプロバイダーの追加や設定変更時に全箇所を修正する必要がある。

**修正案**: 共通のAIクライアントファクトリ関数を`src/lib/ai/client-factory.ts`として抽出し、一箇所で管理する。

### m-6: buildPromptのテンプレートインジェクション

**対象ファイル**:
- `src/lib/extraction/vlm-engine.ts`（L6-16）
- `src/lib/extraction/ocr-llm-engine.ts`（L7-16）

**詳細**: `buildPrompt`関数がシンプルな`replaceAll`でテンプレート変数を置換している。ユーザーがカスタムプロンプトに`{{extracted_text}}`等のプレースホルダーを入力した場合、予期しない二重展開が起こる可能性は低いが、変数値自体に`{{variable}}`パターンが含まれる場合に誤展開される。

**修正案**: 変数置換を一度だけ行う仕組み（既に置換済みの部分をスキップする）を導入する。

### m-7: importの未使用・整理

**対象ファイル**: `src/app/page.tsx`（L10: `AlertCircle`がstatusの一部でのみ使用、`CANCELLED`ステータスに対応するバッジがない）

**詳細**: DashboardPageの`statusBadgeSmall`関数で`CANCELLED`ステータスに対するバッジ表示が定義されていない。`ExtractionJob["status"]`型には`"CANCELLED"`が含まれるが、switch文にこのケースがなく、TypeScriptのexhaustive checkが効いていない。

**修正案**: `CANCELLED`ケースを追加し、default句でexhaustive checkを行う。

### m-8: アクセシビリティ - RegionCanvasのキーボード操作

**対象ファイル**: `src/components/templates/region-canvas.tsx`

**詳細**: Canvas要素にマウスイベントのみが設定されており、`role`属性、`aria-label`、`tabIndex`が設定されていない。キーボードのみでの操作が不可能で、スクリーンリーダーからはCanvas内のリージョンが認識できない。

**修正案**: Canvas要素に`role="img"`と`aria-label`を追加し、リージョン一覧を別途テキストで提供する。Deleteキーのハンドリングは実装済みだが、windowレベルのイベントリスナーに依存しており、Canvasにフォーカスが当たっていない場合でも発火する問題がある。

### m-9: アクセシビリティ - 信頼度色分けのカラーコントラスト不足

**対象ファイル**: `src/components/extract/extraction-results.tsx`（L66-93: `confidenceBadge`）

**詳細**: 信頼度バッジの色分け（緑/黄/赤）が色のみで情報を伝達しており、色覚特性を持つユーザーへの配慮が不足。WCAG 2.1 AA基準の1.4.1「Use of Color」に抵触する可能性がある。

**修正案**: パーセント数値は表示されているため最低限の情報は伝わるが、アイコン（チェック/警告/エラー）を併用するとより明確になる。

### m-10: コンポーネントサイズ - extract/page.tsx

**対象ファイル**: `src/app/extract/page.tsx`（675行）

**詳細**: ExtractPageコンポーネントが675行と大きく、状態管理（15個のstate）、コールバック定義、レンダリングが1ファイルに集約されている。

**修正案**: 状態管理ロジックをカスタムフック（`useExtractionJob`等）に抽出し、セットアップ画面・実行画面・結果画面をサブコンポーネントに分割する。

### m-11: 型アサーション `as ArrayBuffer`

**対象ファイル**: `src/lib/s3/s3-uploader.ts`（L98: `csvBytes.buffer as ArrayBuffer`、L135同様）

**詳細**: `Uint8Array.buffer`は`ArrayBufferLike`型を返すが、`uploadFile`は`ArrayBuffer`を期待するため型アサーションで解決している。TypeScript 5.x以降では`ArrayBufferLike`と`ArrayBuffer`の不整合が問題になりうる。

**修正案**: `new ArrayBuffer`を経由するか、`uploadFile`の引数型を`ArrayBufferLike`に変更する。

---

## 5. 良い点（評価できる実装パターン）

### 5.1 アーキテクチャ設計
- **Storage層のインターフェース抽象化**: 全てのStorage（`SettingsStorage`, `JobStorage`, `TableStorage`, `TemplateStorage`, `WatchStorage`）がインターフェースで定義され、localStorage実装が差し替え可能。Supabase移行への準備が整っている。
- **エンジンのdynamic import**: `engine.ts`でread patternに応じた動的インポートを使用し、不要なエンジンコードがバンドルされない設計。

### 5.2 型安全性
- **Exhaustive switch**: `engine.ts`（L28）と`table-engine.ts`（L371）で`never`型によるexhaustive checkが実装されている。新しいパターン追加時にコンパイルエラーで気づける。
- **型定義の充実**: `types/database.ts`と`lib/extraction/types.ts`で主要な型が網羅的に定義されている。

### 5.3 エラーハンドリング
- **バッチ処理の部分失敗対応**: `batch-engine.ts`で個別フィールドのエラーがバッチ全体を停止せず、エラー結果として記録される（L100-120）。
- **ストレージの安全なフォールバック**: 全てのStorage read関数で`typeof window === "undefined"`チェックとtry-catchによるフォールバックが実装されている。

### 5.4 UX設計
- **ローディング状態の適切な表示**: バッチ処理のプログレス表示、エクスポート中のLoading状態、S3/Webhook接続テスト中のスピナー表示が一貫して実装されている。
- **空状態のハンドリング**: Dashboard、Job List、Table一覧等で空状態の案内メッセージが表示される。
- **ファイルサイズ・数制限**: BatchFileUploadでMAX_FILES（100）、MAX_FILE_SIZE（50MB）の制限と重複排除が実装されている。
- **編集履歴の追跡**: ExtractionResultRecordに`editHistory`が実装され、全ての編集操作が追跡可能。

### 5.5 コード品質
- **関数の適切な分離**: CSV生成、ZIP生成、S3アップロード、Webhook送信がそれぞれ独立したモジュール。
- **キャンセル機能**: バッチ処理のキャンセル機構が`BatchJob.cancel()`として提供されている。
- **PDF Workerのシングルトン管理**: Tesseract.jsワーカーの共有インスタンス管理。

---

## 6. 最終判定

### **条件付き承認**

以下のCritical指摘の修正完了を持って承認とする:

| 優先度 | ID | 修正条件 |
|--------|-----|---------|
| **必須** | C-1 | APIキー・S3クレデンシャルの平文保存を解消する |

---

## 7. 修正優先度マトリクス

| 優先度 | ID | 種別 | タイトル | 影響度 | 修正コスト |
|--------|-----|------|---------|--------|-----------|
| **P0** | C-1 | Security | APIキー・クレデンシャルの平文保存 | 高 | 中 |
| **P1** | M-1 | Security | Webhook URLバリデーション不足 | 中 | 低 |
| **P1** | M-2 | Security | bulkReplaceのReDoSリスク | 中 | 低 |
| **P1** | M-7 | Bug | Watch Engineのスキャン競合 | 中 | 低 |
| **P2** | M-3 | Performance | localStorage大量データ劣化 | 中 | 高 |
| **P2** | M-4 | Resource | OCR Workerメモリリーク | 中 | 低 |
| **P2** | M-5 | Performance | base64変換の非効率実装 | 低 | 低 |
| **P2** | M-6 | Robustness | テンプレートPDFのサイズ制限 | 低 | 低 |
| **P2** | M-8 | Maintainability | ExtractionJob型重複 | 低 | 低 |
| **P3** | m-1 | Quality | 型アサーションパターンの重複 | 低 | 低 |
| **P3** | m-2 | Quality | as unknown二重キャスト | 低 | 低 |
| **P3** | m-3 | Quality | マジックナンバー | 低 | 低 |
| **P3** | m-4 | Quality | VLM confidenceハードコード | 低 | 中 |
| **P3** | m-5 | DRY | AIプロバイダー分岐の重複 | 低 | 中 |
| **P3** | m-6 | Security | テンプレートインジェクション | 低 | 低 |
| **P3** | m-7 | Bug | CANCELLEDステータス未対応 | 低 | 低 |
| **P3** | m-8 | A11y | Canvas要素のキーボード操作 | 低 | 中 |
| **P3** | m-9 | A11y | 信頼度色分けのカラーコントラスト | 低 | 低 |
| **P3** | m-10 | Quality | コンポーネントサイズ | 低 | 中 |
| **P3** | m-11 | Quality | 型アサーション as ArrayBuffer | 低 | 低 |

---

**レポート作成**: レビュー部門（品質管理）
**次回レビュー**: Critical修正完了後に再レビューを実施
