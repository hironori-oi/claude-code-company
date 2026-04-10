# PRJ-007 プロジェクト振り返り（KPT）

## プロジェクト概要
- **案件**: PRJ-002 PDF帳票抽出 デスクトップ連携クライアント
- **種別**: PRJ-002（PDF帳票OCR/VLMデータ自動抽出システム）のAPI連携デスクトップアプリ
- **期間**: 2026年4月（Phase 1-2 全タスク完了、v0.1.0リリース済み）
- **技術スタック**: Tauri v2 + React + TypeScript + Vite + Tailwind CSS + shadcn/ui + rusqlite + reqwest
- **成果**: API接続・認証（keyring OSセキュア保存対応）、複数プロファイルCRUD + SQLite永続化、フォルダ監視（ポーリング + サイズ安定チェック）、単一/バッチ抽出パイプライン、CSV出力（UTF-8 BOM / Shift-JIS / 蓄積モード）、処理済みPDFファイル移動、指数バックオフリトライ + エラー分類 + 日本語メッセージ、ネットワーク断検知・自動再接続（30秒間隔）、Windows通知（完了/エラー/接続断/復旧）、システムトレイ常駐（全プロファイル一括開始/停止）、シングルインスタンス制御、自動更新（GitHub Releases + 署名検証）、Windows起動時自動起動、NSISインストーラー（日本語、スタートメニュー登録）、GitHub Actions CI/CD（lint + type-check + build + 署名付きリリース）
- **PRJ-006との関係**: PRJ-006（PRJ-005向けデスクトップクライアント）のTauri v2リサーチ結果を流用。コード共有なし（独立リポジトリ）

---

## Keep（継続すべきこと）

### 1. 先行リサーチ成果の流用によるゼロコスト技術選定

PRJ-006で実施したTauri v2リサーチ結果（`projects/PRJ-006/reports/research-desktop-app.md`）をそのまま流用し、PRJ-007の技術選定工数をゼロにした。

- フレームワーク選定（Tauri v2 vs Electron vs Wails）の比較調査が不要
- Tauriプラグインの動作確認（fs, dialog, notification, shell, single-instance）が済んでいた
- インストーラーサイズ（3-10MB）、メモリ使用量（30-40MB）の目安が既知

**横展開**: 類似技術スタックの案件では、先行案件のリサーチ結果を`organization/knowledge/`に蓄積し、後続案件で再利用する運用を継続する。

---

### 2. API仕様に最適化した独立設計（DEC-001）

PRJ-006のコードを流用せず、PRJ-002のAPI仕様に最適化した独立リポジトリとした判断が正解だった。

- PRJ-002とPRJ-005はAPIエンドポイント、認証方式、レスポンス形式が異なる
- 無理な共通化を避けたことで、APIクライアント（`api_client.rs`）がPRJ-002の仕様にクリーンに対応
- reqwestのHTTPクライアントに`X-API-Key`ヘッダー認証を直接組み込み、余計な抽象化層が不要

**教訓**: API仕様が異なるクライアント間でコード共有を試みると、条件分岐が増えてメンテナンスコストが上がる。独立リポジトリが正解。

---

### 3. Rust IPCコマンドによるフロント/バック分離の明確化

Tauriの`#[tauri::command]`でRust側に14個のIPCコマンドを定義し、フロントエンドとバックエンドの責務を明確に分離した。

```
フロントエンド（React）: UI描画 + ユーザー操作 + invoke() でRust呼び出し
バックエンド（Rust）: DB操作 + API通信 + ファイルI/O + 監視エンジン
```

- フロントエンドはRustの実装詳細を一切知らない
- `tauri-api.ts`のisTauriフラグでブラウザ開発時はモックデータを返す設計により、UI開発のイテレーションが高速化

**横展開**: Tauriプロジェクトでは`tauri-api.ts`のモック切り替えパターンを標準化する。

---

### 4. AppStateによるリソース集約管理

Rustの`AppState`構造体でDB接続、APIクライアント、監視制御フラグを一元管理した。

```rust
pub struct AppState {
    pub db: Database,                           // SQLite接続（Mutex<Connection>）
    api_client: Mutex<Option<ApiClient>>,        // 遅延初期化対応
    stop_flags: Mutex<HashMap<String, Arc<Mutex<bool>>>>, // 監視停止制御
}
```

- `Mutex`による排他制御でスレッドセーフを保証
- `Option<ApiClient>`で接続設定前の状態を型安全に表現
- `stop_flags`のHashMapで複数プロファイルの独立した監視制御が可能

---

### 5. ファイル書き込み完了チェックの実装

フォルダ監視でPDFファイルの書き込み途中を検知しないよう、サイズ安定確認パターンを採用した。

```
500ms間隔でファイルサイズ（metadata.len()）を取得
2回連続で同一サイズ → 書き込み完了と判定
最大5秒待機（10回 x 500ms）で上限カット
```

- スキャナやコピー処理で書き込み中のファイルを誤って抽出送信するバグを未然防止
- ポーリング方式のため、OS依存のファイルロック機構に頼らず動作が安定

**横展開**: フォルダ監視を伴うデスクトップアプリでは、サイズ安定チェックを標準パターンとして採用する。

---

### 6. CSV出力の柔軟なエンコーディング対応

日本語業務環境を考慮し、3種のエンコーディング（UTF-8 BOM / UTF-8 / Shift-JIS）に対応した。

- Excel（日本語版）ではUTF-8 BOMが最も安全にCSVを開ける
- 業務システムへのCSVインポートではShift-JISが要求されるケースが多い
- Excelロック検出（PermissionDenied → 「Excelで開いていませんか?」メッセージ）は実用的なUX改善

**横展開**: 日本語CSVを出力するデスクトップアプリでは、UTF-8 BOM をデフォルト、Shift-JISをオプションとして提供する。

---

### 7. イベント駆動によるフロントエンド通知

`app.emit("watch-event", WatchEvent)`でRustのバックグラウンド処理からフロントエンドにリアルタイム通知を送信する設計。

```rust
// WatchEvent構造体: 必要十分な情報をフロントに伝達
WatchEvent {
    profile_id, event_type, file_name, message,
    job_id, result_count, processing_time_ms,
}
```

- ポーリング不要でフロントエンドのUI更新が即座に反映される
- フロントは`listen("watch-event")`でイベントを購読するだけ

---

### 8. GitHub Releasesベースの自動更新パイプライン

tauri-plugin-updater + GitHub Releasesの組み合わせで、タグプッシュだけで署名付きリリースが自動公開される。

- latest.jsonマニフェストの自動生成でクライアント側の更新チェックも自動化
- 署名キーはGitHub Secretsに保管、pubkeyはtauri.conf.jsonに埋め込み

**横展開**: Tauriデスクトップアプリの配布にはGitHub Releases + tauri-plugin-updaterの組み合わせを標準とする。

---

### 9. PowerShellによるCI内JSON生成

Windows GitHub Actionsランナーで、bashのheredocやprintfは特殊文字（Base64署名）で失敗する。

- PowerShellの`ConvertTo-Json`が最も安全な方法
- CI上でのファイル操作はランナーOSのネイティブシェルを使うのが確実

**教訓**: Windows CIでは複雑な文字列操作にbashを使わず、PowerShell（`shell: pwsh`）を使用する。

---

## Problem（問題があったこと）

### 1. Cargo.tomlの`[lib]`セクション設定ミスでTauri dev serverがブロック

- **内容**: `[lib]`セクションの設定が不適切で、`tauri dev`実行時にdev serverが起動しない問題が発生
- **原因**: Tauri v2のCargo.toml設定がv1と異なり、`crate-type`の指定方法が変わっていた
- **影響**: 開発初期に数時間のデバッグ時間をロス
- **対策**: Tauri v2プロジェクトのCargo.tomlテンプレートを作成し、`organization/templates/`に追加する

---

### 2. rusqliteのbundled featureが必須（Windows環境）

- **内容**: Windows環境ではSQLiteバイナリがデフォルトでインストールされておらず、`rusqlite`のビルドが失敗
- **原因**: `Cargo.toml`で`rusqlite = { features = ["bundled"] }`を指定しないとリンクエラー
- **影響**: 初回ビルド時にエラーが発生し、原因特定に時間がかかった
- **対策**: Tauri + SQLiteプロジェクトでは`bundled`featureを必須とし、セットアップチェックリストに記載する

---

### 3. tauri-plugin-sqlではなくrusqlite直接使用の判断

- **内容**: Tauri公式のSQLiteプラグイン（`tauri-plugin-sql`）ではなく、`rusqlite`をRustから直接使用した
- **トレードオフ**:
  - メリット: Rustネイティブの型安全性、マイグレーション制御の柔軟性、`Mutex<Connection>`でのスレッド安全制御
  - デメリット: Tauri公式プラグインエコシステムとの不整合、フロントからの直接SQLアクセス不可
- **教訓**: DB操作がRust IPCコマンド経由のみであれば`rusqlite`直接使用が適切。フロントからSQLを直接発行したい場合は`tauri-plugin-sql`を選択する
- **判断基準**: IPCコマンド数が10個以下 → `tauri-plugin-sql`、10個以上 → `rusqlite`（IPCコマンドで抽象化する方が保守しやすい）

---

### 4. APIキーの平文保存（セキュリティリスク）

- **内容**: APIキーをSQLiteデータベースに平文で保存している（タスク1.2.3 `tauri-plugin-keyring`導入がTODO）
- **リスク**: SQLiteファイルが読み取られた場合にAPIキーが漏洩する
- **原因**: 開発初期の動作優先でSQLite保存にし、セキュアストレージ対応を後回しにした
- **対策**: Phase 1完了前に`tauri-plugin-keyring`を導入し、APIキーはOS資格情報マネージャー（Windows Credential Manager / macOS Keychain）に保存する
- **教訓**: 認証情報のセキュア保存はMVPでも後回しにしない。最低限、暗号化保存を初期実装に含める

---

### 5. フロントエンドの状態管理が手実装（TanStack Query未採用）

- **内容**: `useState` + `useCallback`によるローカル状態管理を各コンポーネントで手実装
- **影響**: loading/error/refetchパターンが重複し、コードの一貫性が低下
- **原因**: Tauri IPC呼び出しがHTTP APIとは異なるため、TanStack Queryの適用が自明でなかった
- **改善案**: TanStack Queryの`queryFn`でTauri `invoke()`をラップする構成は問題なく動作する
- **教訓**: PRJ-002、PRJ-004でも同じ問題が発生（3案件連続）。次回は初日から採用を必須とする

```typescript
// TanStack Query + Tauri IPCの組み合わせパターン
const { data, isLoading } = useQuery({
  queryKey: ["templates"],
  queryFn: () => invoke<Template[]>("fetch_templates"),
});
```

---

### 6. Supabase認証の設計変更（途中でアーキテクチャ変更）

- **内容**: 当初のAPIキー認証からSupabase Auth（public Anon Key）方式への変更が開発途中で発生
- **影響**: API接続画面のUIとRust側のApiClientの認証ヘッダー処理を修正
- **原因**: PRJ-002側の認証方式がAPIキーからSupabase Auth対応に拡張された
- **教訓**: 連携先APIの認証方式が確定するまでデスクトップクライアントの認証実装は着手しない。認証レイヤーは差し替え可能な設計にしておく

---

### 7. GitHub Actions Windows BashでのheredocがBase64署名で破壊される

- **内容**: bashのheredoc（`cat << EOF`）でインデントされたEOFが認識されない。printfでBase64文字列（+, /, =, 改行）をフォーマットするとエスケープが壊れる
- **原因**: Windows GitHub ActionsランナーのbashはBase64特殊文字のエスケープ処理が不完全
- **解決**: PowerShell（`shell: pwsh`）のConvertTo-Jsonに切り替え
- **教訓**: Windows CIでは複雑な文字列操作にbashを使わない。ネイティブシェル（PowerShell）を使用する

---

## Try（次回試みること）

### 1. TanStack Queryの初日導入（Tauriプロジェクト含む）

3案件連続（PRJ-002, PRJ-004, PRJ-007）で同じProblemが発生。次回のTauriプロジェクトでもTanStack Queryを初日から導入する。

- `queryFn`に`invoke()`をラップするだけで、キャッシュ・再フェッチ・楽観的更新が得られる
- Tauriの`listen()`イベントと組み合わせて、バックエンドからの通知で`queryClient.invalidateQueries()`を呼ぶパターンを標準化する

---

### 2. Tauri v2プロジェクトテンプレートの整備

PRJ-006/PRJ-007で蓄積したTauri v2の知見をテンプレート化する。

```
templates/tauri-v2/
  ├── Cargo.toml（[lib]セクション、rusqlite bundled、依存関係）
  ├── tauri.conf.json（capabilities、permissions）
  ├── src-tauri/src/lib.rs（AppState、tray、single-instance骨格）
  ├── src/lib/tauri-api.ts（invoke()ラッパー + isTauriモック）
  └── setup-checklist.md（Windows固有の注意事項）
```

- Cargo.tomlの`[lib]`セクション設定ミスを防止
- rusqliteのbundled feature忘れを防止
- tauri-api.tsのモック切り替えパターンを標準化

---

### 3. セキュア認証情報保存をMVPの必須タスクに含める

APIキーやトークンの保存は、開発初期から`tauri-plugin-keyring`（またはOS資格情報マネージャー）を使う。

- SQLiteへの平文保存は開発中であっても避ける
- `tauri-plugin-keyring`のセットアップはプロジェクト初期化タスク（Phase 1.1）に含める
- セットアップチェックリストに「認証情報のセキュア保存」を追加する

---

### 4. 連携先APIの仕様凍結を開発着手の前提条件にする

PRJ-007では開発途中でPRJ-002の認証方式が変更され、手戻りが発生した。

- デスクトップクライアント開発の着手条件として「連携先APIの認証方式とエンドポイント一覧が確定済み」を必須にする
- API仕様書（OpenAPI等）が存在し、バージョンが固定されていることを確認してから着手する
- 認証レイヤーだけは差し替え可能な抽象化を入れておく（Strategy パターン）

---

### 5. ALTERによるマイグレーション戦略の明文化

PRJ-007では`ALTER TABLE ... ADD COLUMN`をエラー無視で実行する方式で既存DBとの互換性を確保しているが、これはスケールしない。

- Phase 2以降でマイグレーションバージョン管理テーブル（`schema_version`）を導入する
- rusqliteの場合は手動マイグレーション（バージョン番号 + ALTER文の配列）が現実的
- `tauri-plugin-sql`採用時は公式のマイグレーション機能を活用する

---

## 横展開可能な技術パターン

### パターン1: Tauri IPC + モック切り替えによるブラウザ開発

```typescript
// src/lib/tauri-api.ts
const isTauri = "__TAURI_INTERNALS__" in window;

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    return tauriInvoke<T>(command, args);
  }
  // ブラウザ開発用モックデータを返す
  return getMockData<T>(command, args);
}
```

- Tauri環境判定でブラウザ開発時はモックデータを返す
- UI開発のイテレーションが高速化（Rustビルド不要）
- 全Tauriプロジェクトの標準パターンとして推奨

### パターン2: Rust AppState + Mutex によるリソース管理

```rust
pub struct AppState {
    pub db: Database,                               // Mutex<Connection>
    api_client: Mutex<Option<ApiClient>>,            // 遅延初期化
    stop_flags: Mutex<HashMap<String, Arc<Mutex<bool>>>>, // 外部停止制御
}

// #[tauri::command] でState<AppState>を受け取る
#[tauri::command]
async fn my_command(state: State<'_, AppState>) -> Result<T, String> {
    let db = state.db.conn.lock().unwrap();
    // ...
}
```

- DB接続、APIクライアント、制御フラグを1構造体に集約
- `Mutex`で排他制御、`Option`で遅延初期化を型安全に表現
- バックグラウンドタスクの停止制御は`Arc<Mutex<bool>>`のフラグパターン

### パターン3: ポーリング方式フォルダ監視 + サイズ安定チェック

```
監視ループ（tokio::spawn）:
  1. 入力フォルダをスキャン（ReadDir）
  2. .pdf拡張子でフィルタ
  3. 処理済みファイルリストと突合（重複防止）
  4. サイズ安定チェック:
     - 500ms間隔でmetadata.len()取得
     - 2回連続同一 → 書き込み完了
     - 最大5秒（10回）で上限カット
  5. 完了ファイルをキューに追加
  6. app.emit("watch-event", event) でフロントに通知
```

- OS固有のファイルシステムイベント（inotify/FSEvents/ReadDirectoryChangesW）よりポーリング方式が移植性が高い
- スキャナやネットワークドライブからのコピーでの書き込み途中検出を防止
- 日本語ファイル名を含むパスの扱いに注意（WindowsではUTF-16内部変換）

### パターン4: CSV蓄積出力モード（時間単位集約）

```
output_cycle設定:
  "none"   → ファイルごとに個別CSV出力
  "hourly" → 1時間分のデータを1つのCSVに蓄積
  "daily"  → 1日分のデータを1つのCSVに蓄積
  "weekly" → 1週間分のデータを1つのCSVに蓄積

蓄積モードの実装:
  - 既存CSVにヘッダーなしで追記（append mode）
  - ファイル名: {profile名}_{期間開始日時}.csv
  - Excelロック検出: PermissionDenied → リトライ or ユーザー通知
```

- 業務システムへのCSV一括インポートを想定した設計
- 個別出力と蓄積出力をプロファイル単位で切り替え可能
- Excelでの閲覧中にCSV書き込みが失敗するケースへの対処が必須

### パターン5: Tauri v2 システムトレイ + Close-to-Tray

```rust
// setup内でトレイアイコン構築
let tray_menu = MenuBuilder::new(app)
    .text("show", "表示")
    .separator()
    .text("quit", "終了")
    .build()?;
TrayIconBuilder::new()
    .menu(&tray_menu)
    .on_menu_event(|app, event| { /* show/quit処理 */ })
    .on_tray_icon_event(|tray, event| { /* ダブルクリック → 表示 */ })
    .build(app)?;

// ウィンドウ閉じ → トレイ最小化
app.on_window_event(|window, event| {
    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        window.hide().unwrap();
    }
});
```

- フォルダ監視アプリはバックグラウンド常駐が前提のため、Close-to-Trayが必須
- `single-instance`プラグインと組み合わせて、2重起動時に既存ウィンドウをフォーカスする

### パターン6: rusqlite ALTER TABLE マイグレーション（エラー無視方式）

```rust
fn init_tables(conn: &Connection) -> Result<()> {
    // テーブル作成（IF NOT EXISTS）
    conn.execute_batch("CREATE TABLE IF NOT EXISTS ...")?;

    // カラム追加（既存DBとの互換性）
    // ALTER TABLE ... ADD COLUMN はカラムが既に存在する場合にエラーになるため無視
    let _ = conn.execute("ALTER TABLE profiles ADD COLUMN csv_encoding TEXT DEFAULT 'utf8bom'", []);
    let _ = conn.execute("ALTER TABLE profiles ADD COLUMN output_cycle TEXT DEFAULT 'none'", []);
    Ok(())
}
```

- 小規模デスクトップアプリ（テーブル3-5個程度）では実用的
- 大規模になる場合は`schema_version`テーブルによるバージョン管理に移行する
- `let _ =`でエラー無視することで冪等性を確保

---

## 2026-04-10 追記：PRJ-002 AI利用状況のダッシュボード統合

PRJ-002の外部API `/api/v1/ai-usage` を呼び出し、Tauriデスクトップ側でAI利用状況を表示する機能を追加した際の知見。

### Keep

**1. WebアプリのGET APIを外部APIとして横展開**

PRJ-002の内部API `/api/data/ai-usage`（セッションCookie認証）を新規に `/api/v1/ai-usage`（APIキー認証）として再実装。
- ビジネスロジック（集計クエリ、JST日付バケット化）は完全に同一
- 差分は認証層のみ（`requireAuth()` → `requireApiKeyAuth()`）
- tenantIdはAPIキーから自動判定されるためクライアント側のパラメータ不要

**横展開**: 新機能をWebで実装したら、同じビジネスロジックを外部APIとしても公開する二重展開パターンを標準化する。

**2. Rust `api_client` → Tauriコマンド → TS Hook の3層構造**

AI利用状況取得を例にすると:
```
Rust: api_client.rs get_ai_usage() → Azure Foundry HTTP呼び出し
  ↓
Rust: lib.rs #[tauri::command] fetch_ai_usage() → State経由でclient取得
  ↓
TS: tauri-api.ts getAiUsage() → invoke()でIPC呼び出し + mock fallback
  ↓
React: dashboard-page.tsx → useState + useEffect
```

この3層分離により:
- Rust層: HTTP通信・認証
- Tauri層: State管理・Tauri IPC公開
- TS/React層: UI・状態管理
- ブラウザ開発環境（`!isTauri`）ではモックデータでUIを動作可能

**3. Webアプリと同じUIコンポーネントパターンを移植**

Webアプリ（Next.js）で実装した日別チャート（CSS ベースバー棒グラフ）を、そのままReact + CSS変数でTauri側にも移植可能だった。
- rechartsやchart.jsなど外部ライブラリ不要
- Tailwindクラスが使えないTauri側ではCSS変数（`var(--card)`, `var(--border)` 等）に置き換え
- 月全体の日付生成ロジック、0円丸め処理、モデル別集計などはWebアプリから直接コピー可能

### Problem

**1. Rust構造体のserde名前変換の差異**

Azure Foundry APIは `inputTokens` / `outputTokens` を返すが、AI SDKの標準（Vercel AI SDK）では `promptTokens` / `completionTokens` を期待する。
- Rust側で `#[serde(rename_all = "camelCase")]` を使うと、フィールド名は`input_tokens` → `inputTokens` として扱われる
- TSはcamelCase想定のため、型定義でマッピング揺れが起きる
- 対策: Rust側で`#[serde(rename = "inputTokens")]`を明示し、TSの型定義と完全一致させる

**2. Vercel環境のタイムゾーン（UTC）と日本時間の不一致**

GET APIで `created_at`（TIMESTAMPTZ）を日別集計する際、Vercel Functions上で`new Date().getDate()`を使うとUTCで評価される。
- JSTでの日付境界（00:00 JST = 15:00 UTC）で前日に集計される
- 対策: `new Date(utc.getTime() + 9*60*60*1000)` でオフセットを加算し、`getUTC*`メソッドで日付取得
- PRJ-002, PRJ-007共通で発生する問題。今後のWebアプリ+デスクトップ連携案件の共通チェック項目とする

### Try

**1. Tauri側にAPIレスポンスのキャッシュ層を導入**

現在、ダッシュボードを開くたびに `/api/v1/ai-usage` を呼び出している。SQLiteに1時間TTLのキャッシュを持たせることで:
- オフライン時のUX向上
- API呼び出し回数削減（Azure/Geminiの無料枠節約）
- 「更新」ボタンで強制リフレッシュ

---

*最終更新: 2026-04-10*
*対象案件: PRJ-007 PRJ-002 PDF帳票抽出 デスクトップ連携クライアント*
*ステータス: v0.1.0リリース完了 + AI利用状況連携追加*
*参照: projects/PRJ-006/reports/research-desktop-app.md, projects/PRJ-002/api-docs/, https://github.com/improver-work/Kamitoru*
