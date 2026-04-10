# 意思決定ログ - PRJ-002

## DEC-001: 案件受付・プロジェクト開始
- **日時**: 2026-03-22
- **判断者**: CEO
- **判断内容**: PRJ-002として案件登録し、プロジェクトを開始する
- **理由**:
  - 自社プロダクトとして市場性の高いOCR/VLM活用ツール
  - 中小企業向けの明確なペインポイント解決
  - 標準技術スタックで実現可能
  - 要件が詳細に定義されており、実装に進める状態
- **リスク**:
  - PDFプレビュー上のドラッグ範囲指定の技術的難易度
  - AI/OCRの精度保証
  - 大規模ファイル処理のパフォーマンス

## DEC-002: 技術選定（リサーチ部門調査結果に基づく）
- **日時**: 2026-03-22
- **判断者**: CEO（リサーチ部門推奨に基づく）
- **判断内容**: 以下の技術スタックを採用する

### コア技術
| 領域 | 採用技術 | 理由 |
|------|---------|------|
| PDF_TEXTモード | pdf.js (pdfjs-dist) | テキスト埋め込みPDFで100%精度、PDFプレビューにも必須 |
| OCRモード | Tesseract.js v5 | ローカル処理可能、追加コストなし、Apache 2.0 |
| VLM/LLMモード | GPT-4o-mini（本番）+ Qwen2.5-VL 7B（Ollama） | コスト/精度バランス最良 + ローカルオプション |
| PDFプレビュー | react-pdf v9 + Canvas overlay | ドラッグ範囲指定に最適な組み合わせ |
| テーブル抽出 | VLM_FIRST優先実装 → LINES_FIRST追加 | 実装コスト低＋高精度、段階的拡張可能 |
| バッチ処理 | Inngest | Vercelネイティブ、step functions、リトライ/キャンセル内蔵 |
| DB | Supabase (PostgreSQL) | 標準スタック準拠、Realtime対応 |
| ストレージ | Supabase Storage | PDF保存、標準スタック準拠 |

### 判断理由
- リサーチ部門の技術調査で実現性が確認された（推定30-46人日）
- VLMを中核に据えた競合製品は未存在（マーケティング部門調査）
- 標準技術スタック範囲内で実現可能
- Inngestの採用によりVercel Functions実行時間制限を回避可能

### 保留事項
- PaddleOCR（ONNX）: 日本語精度は高いが導入コスト大。Phase 5で再検討
- セルフホスト版提供: 市場反応を見て判断（マーケティング部門提案）

## DEC-003: Phase 1スコープ確定・着手承認
- **日時**: 2026-03-22
- **判断者**: CEO
- **判断内容**: PM部門策定のPhase 1（MVP）スコープで開発を開始する
- **Phase 1スコープ**:
  1. プロジェクト初期セットアップ（Next.js / Supabase / 認証）
  2. テーブル定義管理UI（CRUD + CSVインポート）
  3. サンプル帳票登録（PDF アップロード + プレビュー + ドラッグ範囲指定）
  4. 4つの読取パターン実装（OCR / OCR+LLM / VLM / PDF_TEXT）
  5. 単一PDF読取実行 + 結果表示
  6. システム設定（AIモデル選択）
- **理由**: MVPとして最小限の価値提供が可能。PDFドラッグ範囲指定の技術的検証も含む

## DEC-004: 外部API連携機能の追加方針
- **日時**: 2026-04-07
- **判断者**: CEO（オーナー指示に基づく）
- **判断内容**: PRJ-002にデスクトップクライアント向け外部API連携機能を追加する
- **方針**:
  - PRJ-005への統合ではなく、PRJ-002の機能拡張として実装する
  - 既存コードは一切変更しない（全て新規追加）
  - 既存のブラウザ側抽出精度への影響を回避する
  - 新規プロジェクト（PRJ-007）は作成せず、PRJ-002内で管理する
- **理由**:
  - PRJ-002の抽出精度が安定しており、影響を避けたい（オーナー要件）
  - コードベースが同一のため、PRJ-002内での拡張が自然
  - PRJ-006等のデスクトップクライアントから連携可能にし、ユーザーの運用コストを低減する
- **実装計画**:
  - Phase A: APIキー認証基盤（api_keysテーブル、認証ミドルウェア、管理API）
  - Phase B: サーバーサイド抽出エンジン（PDF画像化、OCR/VLM、バッチ処理）
  - Phase C: 公開API整備（/api/v1/* ルート、バージョニング）
  - Phase D: Webhook強化・APIドキュメント
- **リスク**:
  - サーバーサイドPDF画像化でブラウザCanvasとの描画差異の可能性（新規APIの精度のみ。既存には影響なし）
  - Vercel Functions実行時間制約（大容量PDF）

## DEC-007: 範囲画像サイズ切り替えトグルボタン追加
- **日時**: 2026-04-08
- **判断者**: CEO（オーナー承認済み）
- **判断内容**: ジョブ管理の範囲画像について、通常サイズ（h-10/40px）と拡大サイズ（h-24/96px）をUI上で切り替えられるトグルボタンを追加
- **実装方針**:
  - `ExtractionResults`コンポーネントのToolbarにトグルボタンを配置
  - アイコン: Maximize2（通常→拡大）/ Minimize2（拡大→通常）
  - ユーザー設定の永続化: localStorage（キー: `prj002-crop-image-expanded`）
  - デフォルト: 拡大表示（改善要望の趣旨を尊重）
  - 範囲画像がない結果セットではトグル非表示
- **修正ファイル**: `extraction-results.tsx`（1ファイルのみ）
- **理由**: フィールド数が多い帳票では拡大表示だと縦スクロールが長くなる一方、確認作業時は大きく見たいというニーズの両立。オーナー提案による改善。

## DEC-006: UI改善 - ボタンデザイン統一・範囲画像拡大
- **日時**: 2026-04-08
- **判断者**: CEO
- **判断内容**: クライアント改善要望2件に対応
- **改善内容**:
  1. テンプレート一覧の新規作成ボタンをテーブル定義と同一デザインに統一（ghost icon-only → テキスト付きボタン "新規"）
  2. ジョブ管理の範囲画像を拡大表示（h-10→h-24、ダイアログ640px→900px、プレビュー画像400px→600px）
- **修正ファイル**: template-list.tsx, extraction-results.tsx, job-file-results.tsx（計3ファイル9箇所）
- **デザイン判断理由**: 範囲画像はクリックせずとも文字が読める程度の大きさ（96px高）に設定。プレビューダイアログも広幅化して確認効率を向上

## DEC-005: 外部API連携機能 Phase A〜D 実装完了
- **日時**: 2026-04-07
- **判断者**: CEO
- **判断内容**: Phase A〜D全ての実装が完了し、外部連携APIが利用可能になった
- **実装結果**:
  - Phase A（APIキー認証基盤）: 3ファイル — api_keysテーブル、SHA-256ハッシュ認証、管理API
  - Phase B（サーバーサイド抽出）: 6ファイル — sharp使用PDF画像化、OCR/VLM/PDF_TEXT全4パターン対応
  - Phase C（公開API整備）: 4ファイル — バッチAPI、ジョブ管理、JSON/CSV結果取得、レート制限
  - Phase D（Webhook・ドキュメント）: 5ファイル — HMAC-SHA256署名Webhook、管理API、OpenAPI仕様書
  - 合計: 18ファイル新規追加、既存コード変更ゼロ
- **技術的決定**:
  - サーバーサイドPDF画像化にsharp（libvips）を採用（追加依存なし、既存パッケージ）
  - 既存vlm-engine/engine/client-factory/csv-generatorをサーバーサイドから直接再利用
  - Webhook署名: HMAC-SHA256（timestamp.body形式）、送信ログDB管理
  - レート制限: テナント単位30req/min（DB基盤）
- **次のステップ**:
  - webhook-endpoints-migration.sqlのSupabase実行
  - PRJ-006デスクトップクライアントからの結合テスト
  - 精度検証（ブラウザ版とサーバー版の抽出結果比較）

## DEC-008: 配布テンプレート紐付けを parent_template_id FK化、ON DELETE SET NULL を採用
- **日時**: 2026-04-10
- **判断者**: CEO（コードレビュー指摘を踏まえた判断）
- **判断内容**:
  - `templates.parent_template_id` / `table_definitions.parent_table_definition_id` を UUID FK として追加し、配布コピーと配布元オリジナルを明示的に紐付ける
  - FK 制約は `ON DELETE SET NULL` を採用
  - 配布処理は `createTemplate` / `createTable` の時点で親IDをアトミックに設定（2ステップの updateTemplate 呼び出しは廃止）
  - parent フィールドの書き換えはシステム管理者限定とし、指し先が `shared_original_templates` ビューに実在することを API 層で検証
- **背景**:
  - 旧実装は `shared_by = 'system'` というハードコード文字列で配布コピーを判別し、`template_distribution_summary` ビューが **name ベースの JOIN** になっていた
  - 同名オリジナルが複数テナントに存在する場合に誤カウントする構造的欠陥があり、PRJ-002 lessons-learned Problem-1 (CRITICAL) と同系統のリスク
- **ON DELETE 方針の選択理由**:
  - **採用: SET NULL** — 配布元オリジナル削除時に各テナントの配布コピー自体は温存し、FK のみ NULL にする。各テナントの運用データを巻き込み削除するリスクを回避
  - 不採用: CASCADE — オリジナル削除でテナント側のデータが消えるのは事業上許容できない
  - 不採用: RESTRICT — オリジナル削除時に全配布先で revoke してからでないと削除できない制約は、運用フロー（管理者の片付け作業）を煩雑化させる
  - トレードオフ: 配布履歴（過去どのテナントに配布したか）はオリジナル削除時点で `template_distribution_summary` から消える。履歴が必要な場合は将来 append-only の `distribution_log` テーブル導入を検討
- **セキュリティ強化**:
  - API PATCH / POST で `parentTemplateId`, `sharedBy` の書き換えをシステム管理者限定
  - 親 ID の整合性バリデーション（`shared_original_templates` ビュー経由で存在確認）
  - 空文字列を自動的に NULL に正規化
  - 関連ビューに `WITH (security_invoker = true)` を明示し、`anon` への GRANT SELECT を削除
- **次のステップ**:
  - `view-hardening-migration.sql` を Supabase で実行
  - デプロイ後、一般ユーザアカウントで PATCH を叩いて 403 が返ることを検証
  - 中長期: `shared_by` フィールドの廃止 or 意味の一本化を検討（現状は parent_template_id と役割が重複気味）
- **CRITICAL-2（バックフィル SQL のテナント越境リスク）に関する運用判断**:
  - `parent-id-migration.sql` のバックフィル条件は `DISTINCT ON (name)` / `DISTINCT ON (physical_name)` で同名最古オリジナルを紐付ける実装。テナント境界の条件が欠落しており、テナント間で同名テンプレート・同一 physical_name が存在する場合に誤紐付けが発生しうる
  - 本番では適用前に検証クエリ（同名が複数テナントに存在するか確認）を実行し、**0 行であることを確認した上で適用した**
  - そのためSQLファイル自体は現状未修正。ただし **他環境（ステージング・ローカル等）で再適用する際は、必ず同じ検証クエリを事前実行すること**
  - 将来、同じ改修を他プロジェクトに横展開する際は、バックフィル時点でテナントID結合条件を入れる or 既存の配布記録（`distribution_records` 等）から引くようにマイグレーション設計をやり直すこと
- **PDF アップロード silent swallow の修正（2026-04-10 再レビュー MEDIUM-6）**:
  - `supabase-template-storage.ts` / `supabase-shared-template-storage.ts` の `createTemplate` 内で PDF アップロード失敗を空 catch でスワローしていた問題を修正
  - 修正方針: PDF アップロード失敗時は作成済みテンプレート本体を DELETE してから throw。呼び出し元の try/catch で自然にロールバックされる
  - これにより「テンプレート本体は作成済みだが PDF だけ欠落した壊れた配布コピー」の発生を構造的に防止
- **参照ドキュメント**:
  - コードレビュー報告書: `projects/PRJ-002/reports/2026-04-10-parent-template-id-review.md`（予定）
  - マイグレーション SQL: `projects/PRJ-002/app/supabase/parent-id-migration.sql`, `view-hardening-migration.sql`

## DEC-011: 共有テンプレート配布の UUID 構文エラー対応（`col_*` 一時ID流出）
- **日時**: 2026-04-11
- **判断者**: CEO（オーナー承認済み）
- **事象**:
  - 共有テンプレート配布時に `invalid input syntax for type uuid: "col_1775855165862_1_51o0n"` が発生し、配布に失敗
  - エラー値は `distribute-manager.tsx` の `uniqueId("col")` が生成する一時ID (`col_<ts>_<counter>_<rand>`) と完全一致
- **根本原因**:
  1. 配布処理 (`distributeToTenant`) は新カラムに `col_*` 形式の一時IDを付与して `setColumns()` に送る。API 側 (`/api/data/tables/columns` PUT) は `col_*` をクライアント生成IDとして DB自動UUIDに置換する設計（正常）
  2. `supabase-table-storage.setColumns()` は PUT 後に `/api/data/tables?id=...` を **再フェッチ** して戻り値を得ていた。この再フェッチが失敗もしくは空 `columns` を返すと `updatedTable` が null/空になる
  3. 呼び出し元の `distribute-manager.tsx` は `updatedTable` 不在時に **localStorage 向けのフォールバック経路** に落ち、`columnIdMap` に `newColumns[i].id` (= `col_*` 一時ID) を格納
  4. この `col_*` が `fieldMappings.columnId` や `tableRegion.columnMappings.columnId` に流れ、`/api/data/templates/mappings` PUT → Postgres の UUID 型カラムで構文エラー
- **対策A（根本）: setColumns の再フェッチ依存を排除**
  - `api/data/tables/columns/route.ts` PUT のレスポンスに `table: TableDefinition` を追加（既存の `columns` も後方互換で残す）
  - `lib/storage/supabase-table-storage.ts` の `setColumns()` は PUT レスポンスの `table` を優先利用し、存在しない場合のみ旧方式で再フェッチ
  - Supabase のread整合性や権限差異による空 columns 返却の影響を排除
- **対策B（即効・防衛）: フォールバック経路を Supabase モードで遮断**
  - `distribute-manager.tsx` L489 のフォールバックを `!useSupabaseData` 条件で囲み、Supabase モードでは **明示的に throw** して配布を中断
  - `fieldMappings` / `tableRegion.columnMappings` のマッピング失敗時 (`columnIdMap.get(...) === undefined`) も Supabase モードでは throw に変更
  - 既存の `catch` ブロック (L648-657) で作成済みリソースは自動ロールバック
- **対策C（API層の防衛）: mappings / table-region API で UUID 形式バリデーション**
  - `api/data/templates/mappings/route.ts` と `api/data/templates/table-region/route.ts` の PUT で、`columnId` が UUID 形式でなければ 400 (`code: INVALID_COLUMN_ID`) を返す
  - サイレントな Postgres パースエラー ("invalid input syntax for type uuid") を早期検知し、原因特定を容易化
- **対策D（運用）: 既存孤立データの確認**
  - 配布失敗が途中で止まった場合、配布先テナントに孤立データが残っている可能性がある
  - `distributeToTenant` の try/catch には既にクリーンアップ経路があるが、マスタコピー以降の失敗ケースは配布記録が残らず孤立が検知しづらい
  - 運用としてオーナー環境で配布失敗発生テナントの `templates` / `table_definitions` を点検（同一 `physical_name` の既存テーブルは `replaceExisting` フローで上書きされるため、通常は次回配布で自動解消）
- **影響ファイル**:
  - `projects/PRJ-002/app/src/app/api/data/tables/columns/route.ts`（PUT が TableDefinition を返すよう拡張）
  - `projects/PRJ-002/app/src/lib/storage/supabase-table-storage.ts`（setColumns を PUT レスポンス優先に）
  - `projects/PRJ-002/app/src/components/admin/distribution-manager.tsx`（フォールバック遮断・マッピング失敗の厳格化）
  - `projects/PRJ-002/app/src/app/api/data/templates/mappings/route.ts`（UUID バリデーション追加）
  - `projects/PRJ-002/app/src/app/api/data/templates/table-region/route.ts`（UUID バリデーション追加）
- **検証**:
  - `npx tsc --noEmit` による型チェック: PASS
  - 動作確認: 修正後、オーナーが実環境で配布トグルを再実行して正常動作を確認
- **未対応・今後の検討**:
  - 観測性（`console.error` / 構造化ログ）を route handler 群に追加することが vercel-functions ベストプラクティスとして推奨されたが、本件の修正スコープ外。別タスクで review 部門に洗い出しを依頼する
  - `distribute-manager.tsx` の `uniqueId` ヘルパーは将来的に `crypto.randomUUID()` ベースに置き換えることでプレフィックス由来の混乱を根本解消できる（B plan）
- **参照ドキュメント**:
  - オーナー報告: 配布時エラー `invalid input syntax for type uuid: "col_1775855165862_1_51o0n"`
  - 関連コード: `distribute-manager.tsx:408-411 (uniqueId)`, `distribute-manager.tsx:476-499 (columnIdMap 構築)`, `distribute-manager.tsx:527-547 (fieldMappings/columnMappings 書き換え)`

## DEC-012: 配布コピーの tenant_id が NULL で保存され配布先テナントに表示されない問題の修正
- **日時**: 2026-04-11
- **判断者**: CEO（オーナー承認のもと即実装）
- **事象**:
  - 共有テンプレートを配布しても、配布先テナントでログインすると `/templates` にテンプレートが表示されない
  - DEC-011 の配布処理修正でエラーなく配布が完了しても依然として見えない
- **根本原因**:
  - `/api/data/templates` POST (L484) と `/api/data/tables` POST (L392) のインサート句が、`isShared: true` のリクエスト全てに対して `tenant_id: body.isShared ? null : tenantId` として **tenant_id を NULL** に設定していた
  - 配布処理は `createTemplate({ isShared: true, parentTemplateId: ..., ... })` を呼ぶため、配布コピーも同じ分岐を通り **配布先テナント ID ではなく NULL** で保存されていた
  - 一方テナント側の一覧クエリは `.from("templates").eq("tenant_id", tenantId)` で厳密に tenant_id フィルタをかけるため、`tenant_id IS NULL` の配布コピーは **常に除外** されていた
  - 旧実装は「オリジナル共有テンプレート（`tenant_id=null`）」だけを想定した分岐で、「配布コピー（テナント所有だが `is_shared=true`）」というケースを想定していなかった
- **副次的問題**:
  - RLS ポリシー `tenant_templates_select` / `tenant_tables_select` に `OR is_shared = true` の無条件可視条項があり、誤って全テナントの配布コピーがオリジナル扱いで見える状態だった（service_role 経由では表面化していなかったが、直接 DB 参照する将来クライアントに対する分離違反）
- **対策A（アプリ層）**:
  - `/api/data/templates` POST と `/api/data/tables` POST のインサート時に `isShared && !normalizedParent*` の **両方を満たす場合のみ tenant_id=null**、それ以外（配布コピー・通常テンプレート/テーブル）は tenantId を設定するよう修正
  - 配布コピー作成時（`isShared=true` かつ `parent*Id` 指定あり）は **tenantId を必須** とするバリデーションを追加
  - tables POST の重複チェックも同じ判定 (`isSharedOriginal`) に合わせて修正
- **対策B（データ修復）**:
  - 新規 SQL `supabase/dec-012-fix-distributed-tenant-id-migration.sql` を作成
  - 既存の `parent_template_id IS NOT NULL AND tenant_id IS NULL` な配布コピーを `distributions` テーブルから配布先テナント ID を引いて UPDATE 修復
  - 同様に `parent_table_definition_id IS NOT NULL AND tenant_id IS NULL` な配布テーブルコピーも修復
  - 棚卸し用の事前/事後確認クエリと、`distributions` に紐付かない完全孤立行の削除クエリも（コメントアウトで）同梱
- **対策C（RLS 引き締め・補助）**:
  - 新規 SQL `supabase/dec-012-rls-tenant-isolation-migration.sql` を作成
  - `tenant_templates_select` / `tenant_tables_select` の `OR is_shared = true` を `OR (is_shared = true AND tenant_id IS NULL)` に変更
  - オリジナル共有テンプレート/テーブルのみ全テナントに公開し、配布コピーは自テナント所有のみ可視化
  - 現行はアプリ層が service_role 経由なのでユーザ動作には影響しないが、将来の防衛策
- **影響ファイル**:
  - `app/src/app/api/data/templates/route.ts`（POST の tenant_id ロジック + バリデーション）
  - `app/src/app/api/data/tables/route.ts`（POST の tenant_id ロジック + 重複チェック分岐 + バリデーション）
  - `app/supabase/dec-012-fix-distributed-tenant-id-migration.sql`（新規・データ修復）
  - `app/supabase/dec-012-rls-tenant-isolation-migration.sql`（新規・RLS 引き締め）
- **検証**:
  - `npx tsc --noEmit` による型チェック: PASS
  - オーナーによる実機再配布動作確認 → 配布先テナントで「共有テンプレート」セクションに表示されることを確認
- **実行順序（オーナー作業）**:
  1. コードデプロイ完了を待つ
  2. Supabase SQL エディタで `dec-012-fix-distributed-tenant-id-migration.sql` を実行（事前確認クエリで件数チェック → 本体 UPDATE → 事後確認で 0 行を確認）
  3. 任意のタイミングで `dec-012-rls-tenant-isolation-migration.sql` を実行
  4. 配布管理 UI から共有テンプレートを任意のテナントに再配布し、配布先テナントでログインして `/templates` に表示されることを確認
- **未対応・今後の検討**:
  - 配布処理末尾に `addRecord` の前で `getTemplate(newTemplate.id)` による実体検証を追加する案（将来の不整合予防）
  - 配布管理 UI に「実体整合性チェック」機能を追加（孤立した配布レコードを検出・修復）
  - 配布処理のログ（`console.info`）を各ステップに追加して原因特定を容易化
  - 上記 3 点は次回の配布管理 UI 改善タスクと合わせて検討
- **参照ドキュメント**:
  - オーナー報告: 「共有テンプレートが配布先のテナントで表示されていませんでした」
  - 関連コード: `/api/data/templates/route.ts:477-490 (旧 insert 句)`, `/api/data/tables/route.ts:386-398 (旧 insert 句)`, `distribute-manager.tsx:514-523 (createTemplate 呼び出し)`
  - 関連マイグレーション: `parent-id-migration.sql` (DEC-008), `shared-templates-view.sql`, `data-migration-phase1.sql` (RLS), `data-migration-phase2.sql` (templates RLS)
