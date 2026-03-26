# レビューレポート v11 - create-user API統合レビュー

**案件ID**: PRJ-002
**日付**: 2026-03-25
**対象**: ユーザー作成+テナント割り当て統合API及び関連クライアントコード

---

## 総合判定: PASS (軽微な指摘あり)

統合APIの設計は適切で、セキュリティ・エラーハンドリングともに十分なレベル。

---

## 1. create-user API (`src/app/api/admin/create-user/route.ts`)

### PASS - 認証・認可
- `requireSystemAdmin()` でシステム管理者のみに制限。問題なし。
- `getAdminClient()` (service_role) を使い、RLSバイパスで正しく操作。

### PASS - テナント割り当て統合
- ユーザー作成 -> プロフィール待機 -> メンバーシップ作成の流れは正しい。
- `upsert` + `onConflict` で冪等性を確保。

### PASS - 部分成功ハンドリング
- メンバーシップ作成失敗時に `success: true` + `membershipError` を返す設計は妥当。ユーザーは作成済みなので全体ロールバックは不適切。
- 呼び出し元 (`user-list.tsx` L123-124) で `toast.warning` として部分失敗をUIに通知済み。

### 指摘 (軽微)

| # | 種別 | 箇所 | 内容 |
|---|------|------|------|
| 1 | WARNING | L63-73, L90-100 | プロフィールtrigger待機のリトライ (5回 x 200ms = 最大1秒) が2箇所に重複。`isSystemAdmin && tenantId` の両方が指定された場合、最大2秒待つ可能性。共通関数への抽出を推奨。 |
| 2 | INFO | L87 | `tenantId` のみ指定して `tenantRole` を省略した場合、メンバーシップが作成されない。バリデーションで片方のみの指定をエラーにすると親切。 |
| 3 | INFO | L102-120 | `profileExists` が false の場合 (trigger未発火) にメンバーシップ作成がスキップされるが、エラー通知がない。ログまたはレスポンスに含めるべき。 |

---

## 2. クライアント側呼び出し

### user-list.tsx
- PASS: `authFetchDirect` でセッショントークンを付与。統合APIを1回呼び出しに集約。
- PASS: 部分成功時の `membershipError` を `toast.warning` で表示。

### tenant-member-list.tsx
- PASS: 既存ユーザーは `supabaseAddMembership` (別API)、新規ユーザーは統合APIと正しく使い分け。
- PASS: try-catch でエラーをトーストに表示。

### 指摘 (軽微)

| # | 種別 | 箇所 | 内容 |
|---|------|------|------|
| 4 | WARNING | user-list.tsx L39-47 | `authFetchDirect` は `supabase-auth-storage.ts` の `authFetch` と同一ロジック。重複を排除し、共通モジュールからインポートすべき。 |
| 5 | WARNING | tenant-member-list.tsx L125-129 | 同じくセッション取得+fetch を直接インラインで実装。`authFetch` を使うべき。 |
| 6 | INFO | tenant-member-list.tsx L147 | `result.userId!` の non-null assertion。APIが `userId` を返さないケースは `success: false` でガードされているが、型安全性のためnullチェック追加を推奨。 |

---

## 3. auth-guard.ts

- PASS: Cookie -> Bearerトークンの2段階認証フロー。v10からの変更なし。
- PASS: プロフィール参照に service_role クライアントを使用し、RLSを正しくバイパス。
- 問題なし。

---

## 4. supabase-auth-storage.ts (authFetch)

- PASS: `authFetch` は全APIリクエストにアクセストークンを付与。
- PASS: `createUser` メソッドで統合APIを呼び出し。テナント情報なしの基本的なユーザー作成パス。
- 問題なし。

---

## 対応優先度

| 優先度 | 件数 | 内容 |
|--------|------|------|
| 高 (ブロッカー) | 0 | - |
| 中 (WARNING) | 3 | #1 リトライ重複、#4 #5 authFetch重複 |
| 低 (INFO) | 3 | #2 バリデーション、#3 スキップ通知、#6 型安全性 |

WARNINGはリファクタリング案件。現時点の機能・セキュリティに問題はないため、リリースブロッカーではない。
