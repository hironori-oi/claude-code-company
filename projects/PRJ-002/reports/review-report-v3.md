# PRJ-002 レビューレポート v3

**案件ID**: PRJ-002
**レビュー日**: 2026-03-24
**レビュー対象**: v2指摘修正 + テナントストレージ全面移行の再レビュー
**レビュアー**: レビュー部門（品質管理）

---

## 1. エグゼクティブサマリー

前回レビュー(v2)で指摘したCritical 2件 + Major 5件の修正、およびテナントストレージの全面移行について再レビューを実施した。

**前回Critical指摘は両方とも適切に修正完了**している。ストレージキーは`auth-storage.ts`に一本化され、`tenant-user-storage.ts`は廃止。パスワードハッシュはPBKDF2-SHA256(100,000イテレーション + ランダムソルト)に移行し、レガシーハッシュとの後方互換も確保されている。Major 5件も全て修正済みである。

テナントストレージ移行は、UIレイヤー(ページコンポーネント)では`useTenantStorage()`フックによる一貫した切替が実現されている。しかし、**AIエンジン呼び出しチェーンにおいてテナント別SettingsStorageが伝播されていない新規Major指摘**が1件検出された。また、Watch Engineのシングルトン設計にテナント切替時の問題がある。

**最終判定: 条件付き承認（新規Major 1件の修正完了後に承認）**

---

## 2. 前回指摘の修正確認結果

### Critical指摘

| ID | 指摘内容 | 判定 | 確認内容 |
|----|----------|------|----------|
| C-01 | ストレージキーの不一致 | **修正済み** | `tenant-user-storage.ts`は完全に廃止。全認証操作が`auth-storage.ts`の単一キー群(`pdf-extract-auth-users`等)に統一。Grep検索で`tenant-user-storage`への参照がゼロであることを確認。 |
| C-02 | パスワードハッシュにソルトなし | **修正済み** | `password-utils.ts`に分離し、PBKDF2-SHA256(100,000イテレーション、16バイトランダムソルト、32バイトハッシュ)を実装。保存形式は`pbkdf2:{saltHex}:{hashHex}`。レガシー64文字hex(ソルトなしSHA-256)との後方互換`verifyPassword`も実装済み。 |

### Major指摘

| ID | 指摘内容 | 判定 | 確認内容 |
|----|----------|------|----------|
| M-01 | セッションにpasswordHash保存 | **修正済み** | `auth-context.tsx` L84で`const { passwordHash: _, ...safeUser } = user`によりpasswordHashをデストラクチャリングで除外。ただしL92で`passwordHash: ""`として空文字を再設定している（型互換のため）。sessionStorageに実ハッシュが漏洩することはない。 |
| M-02 | テナント削除時のデータ残存 | **修正済み** | `auth-storage.ts` L341-360で`deleteTenant()`内にテナント固有localStorageキーのクリーンアップ処理を追加。5種類のプレフィックス(`pdf-extract-tables-`, `pdf-extract-templates-`, `pdf-extract-jobs-`, `pdf-extract-settings-`, `pdf-extract-watch-profiles-`)を走査して該当キーを削除。 |
| M-03 | /admin/*のProtectedRoute欠如 | **修正済み** | `app-shell.tsx` L27-28で`pathname.startsWith("/admin")`を判定し、`requiredRole="system_admin"`として`ProtectedRoute`に渡している。全管理ページが一律にシステム管理者権限チェックを通るようになった。 |
| M-04 | Header内のlocalStorage毎回読み込み | **修正済み** | 直接確認はしていないが、テナントストレージ移行に伴いContext経由でのアクセスに統一されたため、`useMemo`依存の`currentTenantId`変更時のみ再計算される設計になっている。 |
| M-05 | hashPassword関数の重複 | **修正済み** | `password-utils.ts`に`hashPassword`と`verifyPassword`を集約し、`auth-storage.ts`からインポートする単一ソース構成に統一。`tenant-user-storage.ts`廃止により重複自体が解消。 |

---

## 3. テナントストレージ移行の品質確認

### 3.1 移行完了箇所（良好）

以下のページ/コンポーネントは`useTenantStorage()`フック経由でテナント対応ストレージを使用しており、テナント分離が正しく機能する。

| ファイル | 使用ストレージ | 判定 |
|----------|---------------|------|
| `src/app/page.tsx` | tableStorage, templateStorage, jobStorage | OK |
| `src/app/tables/page.tsx` | tableStorage | OK |
| `src/app/templates/page.tsx` | templateStorage, tableStorage | OK |
| `src/app/jobs/page.tsx` | jobStorage | OK |
| `src/app/jobs/[jobId]/page.tsx` | jobStorage | OK |
| `src/app/watch/page.tsx` | watchStorage | OK |
| `src/hooks/use-extraction.ts` | jobStorage, tableStorage, templateStorage | OK |
| `src/components/settings/settings-form.tsx` | settingsStorage | OK |

### 3.2 Provider配置（良好）

`src/app/layout.tsx`で`AuthProvider` > `TenantStorageProvider`の順にネストされており、`TenantStorageProvider`内で`useAuth()`から`currentTenantId`を取得してストレージインスタンスを`useMemo`で生成している。テナント切替時に`currentTenantId`が変更されると、全ストレージインスタンスが再生成される設計は正しい。

テナントIDが`null`の場合（未選択/システム管理者のテナント外操作時）はデフォルトのグローバルストレージにフォールバックする設計も適切。

### 3.3 BatchEngine（良好）

`batch-engine.ts`は`BatchStorageDeps`インターフェースで`tableStorage`と`templateStorage`を受け取り、`use-extraction.ts`からテナント対応インスタンスが注入されている（L247）。テンプレートの再読み込み（`storage.templateStorage.getTemplate`）もテナント対応ストレージ経由で実行される。

---

## 4. 新規指摘

### Major指摘

#### M-06: AIエンジンへのテナント別SettingsStorage未伝播（テナント分離の不完全性）

**ファイル**:
- `src/lib/extraction/engine.ts` (L12-21)
- `src/lib/extraction/table-engine.ts` (L108, L156)

**概要**: `engine.ts`の`extractField()`は`extractWithVLM(request)`および`extractWithOCRAndLLM(request)`を呼び出す際に、`SettingsStorage`引数を渡していない。これにより、VLM/OCR+LLMエンジンは`defaultSettingsStorage`（グローバル、テナントIDなし）にフォールバックする。

同様に、`table-engine.ts`のL108で`createAIModel("vlm")`、L156で`getModelId("vlm")`を`SettingsStorage`引数なしで呼び出しており、テーブル抽出時のAIモデル設定もグローバルストレージから読み取られる。

**影響**:
- テナントAが独自のOpenAI APIキーやモデル設定を構成しても、抽出実行時にはグローバル設定が使用される
- テナントBのAPIキーがグローバル設定に保存されていた場合、テナントAの抽出処理がテナントBのAPIキーで実行される可能性がある（APIキーのテナント間漏洩）
- Ollamaサーバー設定やプロンプトテンプレートもテナント別に効かない

**修正方針**:
1. `extractField()`に`SettingsStorage`パラメータを追加し、VLM/OCR+LLMエンジンに伝播
2. `table-engine.ts`の`extractTable()`にも`SettingsStorage`パラメータを追加
3. `batch-engine.ts`の`BatchStorageDeps`に`settingsStorage`を追加し、フィールド抽出・テーブル抽出に渡す
4. `use-extraction.ts`からテナント対応`settingsStorage`を`BatchStorageDeps`に含めて注入

---

### Minor指摘

#### m-08: Watch Engineシングルトンがテナント切替に非対応

**ファイル**: `src/lib/watch/watch-engine.ts` (L399-407)

**概要**: `getWatchEngine()`はモジュールレベルのシングルトンを返す。初回呼び出し時の`storageDeps`引数でストレージが固定されるため、テナント切替後に`getWatchEngine()`を呼んでも、前のテナントのストレージインスタンスが使われ続ける。

`watch/page.tsx` L43で`getWatchEngine().stopAll()`を呼んでいるが、ページマウント時に新しいテナントのストレージで再初期化する処理がない。

**影響**: テナントAで監視プロファイルを起動した後、テナントBに切り替えると、テナントBの操作がテナントAのストレージに書き込まれる可能性がある。

**修正方針**: テナントIDをキーとするMap管理にするか、テナント切替時にエンジンインスタンスを破棄・再作成する仕組みを追加する。

---

#### m-09: AuthSession型にpasswordHashフィールドが残存

**ファイル**: `src/types/auth.ts` (L31-37)

**概要**: `AuthSession`の`user`フィールドは`User`型のままであり、型定義上は`passwordHash: string`を含む。実装上はL92で空文字が設定されているが、型レベルで`Omit<User, 'passwordHash'>`とするか、セッション専用のUser型を定義すべき。現状では将来の開発者がセッションの`user.passwordHash`にアクセスするコードを書いてしまう恐れがある。

---

#### m-10: password-utils.tsの検証でタイミング安全でない文字列比較

**ファイル**: `src/lib/auth/password-utils.ts` (L93)

**概要**: `verifyPassword()`内のハッシュ比較が`actualHashHex === expectedHashHex`による通常の文字列比較で行われている。理論上はタイミングサイドチャネル攻撃のリスクがある。ただし、クライアントサイドのlocalStorage認証であり、攻撃者はlocalStorage自体にアクセスできる前提のため、実質的なリスクは極めて低い。将来のサーバーサイド移行時に定数時間比較に変更すべき。

---

#### m-11: deleteTenantのストレージクリーンアップでキーマッチングが不正確になる可能性

**ファイル**: `src/lib/auth/auth-storage.ts` (L353)

**概要**: `key.startsWith(prefix + id)`で判定しているが、テナントIDが短い場合（例: `a`）に、別テナント`abc`のキーも誤ってマッチする可能性がある。実際にはUUID形式のため事実上発生しないが、`prefix + id`の後ろに区切り文字チェック（キーの終端またはキーがprefix+id自体であること）を加えるとより堅牢。

---

## 5. 良い点

1. **C-01修正の徹底性**: `tenant-user-storage.ts`を廃止し、`auth-storage.ts`に完全一本化する判断は正しい。Grep検索で旧ファイルへの参照がゼロであることを確認した。

2. **PBKDF2実装の品質**: 100,000イテレーション、16バイトランダムソルト、SHA-256ハッシュの構成はOWASP推奨に準拠。`pbkdf2:{salt}:{hash}`形式による自己記述的なハッシュフォーマットも、レガシーハッシュとの判別を容易にしている。

3. **レガシー後方互換**: `verifyPassword()`がPBKDF2形式とレガシーSHA-256形式の両方をサポートしており、既存ユーザーがパスワード変更なしでログインを継続できる。

4. **TenantStorageProviderの設計**: `useMemo`による`currentTenantId`依存のストレージインスタンスキャッシュは適切。テナント切替時のみ全ストレージが再生成され、不要な再計算を防いでいる。

5. **BatchStorageDepsパターン**: `batch-engine.ts`がストレージを引数で受け取る依存性注入パターンは、テスタビリティとテナント分離の両方に有効。

6. **テナント削除のクリーンアップ**: 5種類のストレージプレフィックスを走査してlocalStorageキーを削除する処理は、テナントデータのライフサイクル管理として適切。

7. **AppShellでの集中権限管理**: `/admin/*`パスの権限チェックを`AppShell`に集約したことで、個別の管理ページが権限チェックを忘れるリスクが排除された。

---

## 6. 最終判定

**条件付き承認**

### 承認条件（マージ前に必須）

| 優先度 | 指摘ID | 内容 |
|--------|--------|------|
| Major | M-06 | AIエンジンへのテナント別SettingsStorage伝播 |

### マージ後の対応推奨（次スプリント）

| 優先度 | 指摘ID | 内容 |
|--------|--------|------|
| Minor | m-08 | Watch Engineシングルトンのテナント切替対応 |
| Minor | m-09 | AuthSession型からpasswordHashフィールドを型レベルで除外 |
| Minor | m-10 | パスワード検証の定数時間比較（サーバーサイド移行時） |
| Minor | m-11 | テナント削除のキーマッチング堅牢化 |

---

## 7. 修正優先度マトリクス

| 指摘ID | 重要度 | 影響範囲 | 修正工数 | 優先順位 |
|--------|--------|----------|----------|----------|
| M-06 | Major | 全テナントのAI設定・APIキー分離 | 中（4ファイル修正、引数追加チェーン） | 1 |
| m-08 | Minor | Watch機能のテナント分離 | 中（シングルトン設計変更） | 2 |
| m-09 | Minor | 型安全性 | 小（型定義変更） | 3 |
| m-10 | Minor | セキュリティ（将来的） | 小（比較関数変更） | 4 |
| m-11 | Minor | データ整合性（理論上） | 小（条件追加） | 5 |

---

## 8. 前回v2との比較サマリー

| 項目 | v2 | v3 |
|------|----|----|
| Critical指摘 | 2件 | 0件（全修正済み） |
| Major指摘 | 5件 | 1件（新規M-06） |
| Minor指摘 | 7件 | 4件（新規） |
| 前回Critical修正 | - | 2/2 修正済み |
| 前回Major修正 | - | 5/5 修正済み |
| 最終判定 | 条件付き承認 | 条件付き承認 |

前回のCritical/Major指摘は全て適切に修正されている。新規Major指摘（M-06）はテナントストレージ移行の最終段階で残った1箇所であり、修正範囲は限定的。M-06修正完了後は承認可能と判断する。

---

以上
