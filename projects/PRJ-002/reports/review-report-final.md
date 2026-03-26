# PRJ-002 最終レビューレポート: Supabase Auth移行

**レビュー部門 品質管理**
**日付**: 2026-03-25
**対象**: Supabase Auth移行完了後の全体コードレビュー

---

## 1. エグゼクティブサマリー

Supabase Auth移行は機能面では概ね完成しており、主要な認証フロー(ログイン/ログアウト/セットアップ/テナント切替)が正常に動作する構造になっている。API routeの認証ガードも適切に実装されており、セキュリティの基本は担保されている。

一方で、以下の構造的課題が残存している:

- **デッドコード**: 旧localStorage専用ファイル`tenant-user-storage.ts`が完全に未使用のまま残存
- **コード重複**: `authFetch`関数が`supabase-auth-storage.ts`と`user-list.tsx`に重複定義、`getServiceClient`と`getAdminClient`が同一ロジックで2ファイルに存在
- **Stubメソッド大量残存**: `supabase-auth-storage.ts`内のAuthStorage interfaceの同期stubメソッドが18個あり、全てconsole.warnを出力。実際にはasync関数群が使われておりstubは呼ばれないが、コードの見通しを悪化させている
- **SQL分散**: 3つのSQLファイルが存在し、`auth-fix-v4.sql`は`auth-setup.sql`に既に統合済みの内容

---

## 2. 改善推奨事項（優先度付き）

### P1 - 高優先度（セキュリティ/正確性に影響）

#### S-1: setup/page.tsx のis_system_admin昇格がクライアント側から実行可能

**ファイル**: `src/app/setup/page.tsx` (行103-122)

`setupWithSupabase()`で、signUp直後にクライアント側Supabaseクライアント経由で`profiles.update({ is_system_admin: true })`を実行している。これはRLSポリシー`profiles_update_own`により自分自身のprofileを更新できるため動作するが、設計上の問題がある:

- RLSが「自分のprofileなら何でも更新可能」になっているため、一般ユーザーも理論上は自分を`is_system_admin: true`に昇格可能
- **推奨**: profilesのUPDATEポリシーで`is_system_admin`カラムの変更はservice_roleのみ許可する。または、セットアップ時もAPI route(service_role)経由で昇格処理を行う

#### S-2: getServiceClient と getAdminClient の重複

**ファイル**: `src/lib/api/auth-guard.ts` (行19-25) と `src/lib/api/admin-client.ts`

全く同じロジックでservice_roleクライアントを生成する関数が2箇所に存在する。`auth-guard.ts`内の`getServiceClient`は内部でのみ使用されている。

- **推奨**: `auth-guard.ts`内の`getServiceClient`を削除し、`getAdminClient`をimportして使用する

#### S-3: tenant-member-list.tsx のインラインauthFetch

**ファイル**: `src/components/admin/tenant-member-list.tsx` (行125-147)

Supabaseモードの新規ユーザー作成時、`@/lib/supabase/client`をdynamic importし、独自にAuthorizationヘッダーを組み立てている。`supabase-auth-storage.ts`の`authFetch`と同一ロジックの重複。

- **推奨**: `authFetch`を共通ユーティリティとしてexportし、`tenant-member-list.tsx`から利用する

#### S-4: user-list.tsx のauthFetchDirect重複

**ファイル**: `src/components/admin/user-list.tsx` (行39-47)

`authFetchDirect`関数が`supabase-auth-storage.ts`の`authFetch`と完全に同一。

- **推奨**: S-3と同様、共通化する

### P2 - 中優先度（保守性/コード品質）

#### M-1: tenant-user-storage.ts の削除

**ファイル**: `src/lib/auth/tenant-user-storage.ts`

このファイルは**どこからもimportされていない**完全なデッドコード。auth-storage.tsのlocalAuthStorageに機能が統合された後の残骸。

- **推奨**: 即座に削除

#### M-2: supabase-auth-storage.ts のstub console.warn群の整理

**ファイル**: `src/lib/auth/supabase-auth-storage.ts` (行132-327)

AuthStorage interfaceの同期メソッド18個がstub実装でconsole.warnを出力する。Supabaseモードでは実際にはasync関数群（supabaseGetAllUsers等）が直接呼ばれるため、これらのstubが呼ばれることはほぼない。

- **推奨**: stubメソッドからconsole.warnを除去するか、throw new Error("Use async method instead")に変更。もしくはAuthStorage interfaceをSync/Asyncに分離する長期リファクタリングを検討

#### M-3: tenant-member-list.tsx で authStorage がimportされるが未使用

**ファイル**: `src/components/admin/tenant-member-list.tsx` (行45)

`import { authStorage, localAuthStorage } from "@/lib/auth/auth-storage"` で`authStorage`をimportしているが、実際に使用されているのは`localAuthStorage`のみ。

- **推奨**: 未使用importの`authStorage`を削除

#### M-4: password-utils.ts の使用範囲の確認

**ファイル**: `src/lib/auth/password-utils.ts`

Supabaseモードではパスワードハッシュはサーバー側(Supabase Auth)で管理される。このファイルはlocalStorageモード(`auth-storage.ts`内)のみで使用されている。

- **推奨**: localStorageモードを将来的に廃止するなら削除候補。現時点では保留

#### M-5: auth-guard.ts の headers() 二重await

**ファイル**: `src/lib/api/auth-guard.ts` (行3-4)

`cookies`と`headers`を両方`next/headers`からimportしている。`headers`はBearerトークンフォールバック用だが、middlewareがcookieを正しくリフレッシュするため、実運用ではBearerフォールバックの出番は少ない。

- **推奨**: Bearer tokenフォールバックは残す価値あり（API外部呼び出し時のため）。コメントでフォールバック理由を明記

### P3 - 低優先度（最適化/整理）

#### L-1: middleware.ts の静的アセット除外パターン

**ファイル**: `src/middleware.ts` (行49)

現在のmatcherは静的ファイル以外全てにマッチする。API route(`/api/admin/*`)へのリクエストでもmiddlewareが実行され、`supabase.auth.getUser()`が呼ばれる。API route側の`auth-guard.ts`でも認証チェックをするため、二重にsession取得が走る。

- **推奨**: パフォーマンス最適化として`/api/*`をmatcherから除外することを検討。ただし、cookie更新が必要なケースがあるため、影響範囲を確認の上判断

#### L-2: create-user/route.ts のリトライ待機

**ファイル**: `src/app/api/admin/create-user/route.ts` (行62-74, 89-101)

triggerによるprofile自動作成を待つために200ms x 5回のリトライループが2箇所ある。最悪ケースで2秒の遅延。

- **推奨**: 長期的にはトリガーの信頼性を高めるか、同一トランザクション内でprofileをinsertすることで待機不要にする

#### L-3: select-tenant/page.tsx のloadTenantsSupabase内console.error

**ファイル**: `src/app/select-tenant/page.tsx` (行116)

本番環境でユーザーに見せるべきでないエラーがconsole.errorに出力される。

- **推奨**: エラーステートとしてUIに表示するか、ログレベルを調整

#### L-4: distribution-manager.tsx のlocalStorage直接操作

**ファイル**: `src/components/admin/distribution-manager.tsx` (行458-488)

`setDistributionFlags`と`setTableDistributionFlags`がlocalStorageを直接操作している。Supabase移行でデータストレージをDBに移す際に必ず対応が必要。

- **推奨**: コメントに既にTODOがあるため、Phase 2で対応。現時点ではOK

---

## 3. 削除推奨ファイル/コード

| 対象 | 種類 | 理由 |
|------|------|------|
| `src/lib/auth/tenant-user-storage.ts` | ファイル削除 | どこからもimportされていないデッドコード |
| `src/lib/api/auth-guard.ts` 内 `getServiceClient()` (行19-25) | 関数削除 | `admin-client.ts`の`getAdminClient`と重複 |
| `src/components/admin/user-list.tsx` 内 `authFetchDirect()` (行39-47) | 関数削除 | 共通authFetchを使用すべき |
| `src/components/admin/tenant-member-list.tsx` 内 `authStorage` import | import削除 | 未使用 |
| `supabase/auth-fix-v4.sql` | ファイル削除 | auth-setup.sqlに統合済み |
| `supabase/fix-warnings.sql` | ファイル削除(条件付き) | auth-setup.sqlに統合済み。ただしschema.sql関連のDROP POLICY文は別途保持が必要 |

---

## 4. SQL統合の推奨

### 現状

| ファイル | 内容 |
|---------|------|
| `supabase/auth-setup.sql` | 統合済みの完全セットアップSQL。テーブル/RLS/関数/トリガー全て含む |
| `supabase/auth-fix-v4.sql` | `is_same_tenant_member`関数 + `profiles_select_same_tenant`ポリシー |
| `supabase/fix-warnings.sql` | 全SECURITY DEFINER関数のsearch_path修正 + データテーブルの過剰RLSポリシー削除 |

### 分析

- **auth-fix-v4.sql**: `auth-setup.sql`の行99-110に既に統合済み（ただしauth-fix-v4.sqlでは`SET search_path = ''`が欠落している旧版）。削除可能
- **fix-warnings.sql**: search_path修正は`auth-setup.sql`に既に反映済み。データテーブルのDROP POLICY文（行74-87）はauth-setup.sqlに含まれていないが、これはschema.sql側の問題であり、auth-setup.sqlに含める必要はない

### 推奨

1. `auth-fix-v4.sql`を削除する
2. `fix-warnings.sql`のデータテーブルRLS削除部分（行72-87）を`supabase/cleanup-data-rls.sql`として残し、本体は削除する。または`schema.sql`側を修正してRLSポリシーを最初から作らないようにする
3. `auth-setup.sql`のヘッダコメントに「これが唯一のauth setup SQLである」旨を追記する

---

## 5. セキュリティ総合評価

| 項目 | 評価 | 備考 |
|------|------|------|
| API route認証チェック | OK | 全routeでrequireAuth/requireSystemAdmin/requireAdminOrSystemAdminが適切に使用されている |
| service_role_keyの取り扱い | OK | サーバーサイドのみで使用。クライアントに露出していない |
| RLSポリシー | 要注意 | S-1のis_system_admin昇格問題あり |
| CSRF対策 | OK | cookieベース認証 + Bearer tokenフォールバック |
| パスワード管理 | OK | Supabase Auth側で管理。localStorageモードではPBKDF2使用 |
| セッション管理 | OK | Supabase SSR middleware + 適切なcookie更新 |
| テナント分離 | OK | API routeでテナントメンバーシップ検証あり |

---

## 6. 最終判定

### 判定: 条件付き合格

Supabase Auth移行は機能的に完成しており、本番運用に向けた基盤は整っている。

**リリース前に必須対応**:
1. **S-1**: setup/page.tsxのis_system_admin昇格問題（RLSポリシー修正 or API route経由化）
2. **M-1**: tenant-user-storage.tsの削除（デッドコードの除去）

**リリース後に対応推奨**:
1. **S-2, S-3, S-4**: getServiceClient/authFetchの重複統合
2. **M-2, M-3**: stub console.warn整理、未使用import除去
3. **SQL統合**: auth-fix-v4.sql削除、fix-warnings.sql整理

**将来検討**:
1. **L-1**: middleware.tsのパフォーマンス最適化
2. **L-2**: create-user/route.tsのリトライ待機除去
3. **L-4**: distribution-manager.tsのlocalStorage直接操作をDB移行

---

**レビュー担当**: レビュー部門（品質管理）
**レビュー完了日**: 2026-03-25
