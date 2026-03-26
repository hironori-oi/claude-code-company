# レビューレポート v8 - Supabase Auth移行 (Phase 1) + バグ修正

| 項目 | 内容 |
|------|------|
| 案件ID | PRJ-002 |
| レビュー対象 | Supabase Auth統合、RLS、トリガー、セットアップフロー |
| レビュー日 | 2026-03-25 |
| レビュアー | レビュー部門 |

---

## エグゼクティブサマリー

Supabase Auth Phase 1の実装は、localStorage認証からの移行として適切な設計がなされている。RLS無限再帰問題の修正（`is_system_admin()` SECURITY DEFINER関数）、未認証状態でのセットアップ完了判定（`has_system_admin()` DB関数）、DBトリガーによる自動profile作成など、段階的にバグを修正し安定した状態に到達している。後方互換性も`isSupabaseConfigured()`による自動切替で確保されている。

ただし、**セキュリティ上の改善余地**（handle_new_userトリガーでのis_system_admin信頼問題、profileとauth.usersの二重INSERT）と**SQL管理上の整理**（4ファイルの統合）が必要。Critical指摘1件を除き、本番運用に向けた品質水準に達していると判断する。

---

## Critical指摘

### C-01: handle_new_user トリガーがクライアント送信の is_system_admin を信頼している

**ファイル**: `supabase/auth-fix-v2.sql` L100-112, `supabase/auth-fix.sql` L6-18

```sql
COALESCE((NEW.raw_user_meta_data->>'is_system_admin')::boolean, false)
```

`signUp`のoptions.dataに`is_system_admin: true`を渡せば、**任意のユーザーがシステム管理者としてprofileを作成できる**。`raw_user_meta_data`はクライアントから送信可能なフィールドであり、サーバー側で検証されない。

**影響**: 権限昇格の脆弱性。悪意あるユーザーがブラウザのDevToolsやcURLで直接signUpリクエストを送り、`is_system_admin: true`を設定できる。

**推奨対応**:
- トリガー内で`is_system_admin`を常に`false`に固定する
- 初回セットアップ時のみ、セットアップページから別途`profiles`テーブルを直接UPDATEしてadminフラグを設定する（現在のsetup/page.tsxのフォールバック手動INSERT処理をこの方式に統一）
- または、サービスロールAPIを使ったサーバーサイド処理でのみadminフラグを設定する

---

## Major指摘

### M-01: createUser でprofileが二重INSERTされる可能性

**ファイル**: `src/lib/auth/supabase-auth-storage.ts` L88-134

`createUser`メソッドは:
1. `supabase.auth.signUp()` を呼び出す (→ handle_new_user トリガーが発火し profileが自動INSERT)
2. 直後に `supabase.from('profiles').insert()` で手動INSERTを実行

トリガーが正常に動作する場合、2回目のINSERTでUNIQUE制約違反（PRIMARY KEY重複）が発生する。

**推奨対応**: setup/page.tsxと同様に、トリガーによる自動作成を信頼し、手動INSERTをupsert（`ON CONFLICT DO UPDATE`）またはトリガー完了を待ってからの確認・フォールバック方式に変更する。

### M-02: tenant_memberships の self-referencing RLSポリシー

**ファイル**: `supabase/auth-fix-v2.sql` L88-97

```sql
CREATE POLICY "memberships_manage_tenant_admin" ON tenant_memberships
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = tenant_memberships.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'admin'
    )
  );
```

`tenant_memberships`テーブルのRLSポリシーが同テーブルを自己参照している。profilesでの無限再帰と同じパターン。PostgreSQLのRLSは同テーブルへのサブクエリでもポリシーを適用するため、テナントadminが自分のメンバーシップをSELECTできるポリシー（`memberships_select_own`）が先に評価されることで回避されている可能性が高いが、**INSERT/DELETE操作時に問題が発生するリスク**がある。

**推奨対応**: profilesと同様に`is_tenant_admin(tenant_id)`のようなSECURITY DEFINER関数を作成し、自己参照を排除する。

### M-03: SQLマイグレーションファイルが4つに分散

**ファイル**: `auth-migration.sql`, `auth-fix.sql`, `auth-fix-v2.sql`, `auth-fix-v3.sql`

段階的な修正の結果、4ファイルに分散しており、新しいファイルが古いファイルのポリシーをDROPして再作成している。新規環境セットアップ時にどのファイルをどの順番で実行すべきかが不明確。

**推奨対応**: 最終状態を統合した単一の`auth-migration-final.sql`を作成する。既存ファイルは`archive/`ディレクトリに移動し、変更履歴として保持する。

---

## Minor指摘

### m-01: 同期スタブメソッドが多数のconsole.warnを出力

**ファイル**: `src/lib/auth/supabase-auth-storage.ts` (多数箇所)

Supabaseモード時、同期APIのスタブ（`getUserByEmail`, `getUser`, `getAllUsers`, `createTenant`, 等）が`console.warn`を出力する。これらが実際に呼ばれた場合、コンソールが警告で埋まる。

**推奨対応**: 開発中は有用だが、本番前に以下いずれかを検討:
- スタブが呼ばれないようAuthStorageインターフェースをsync/asyncに分離
- または`console.warn`を`if (process.env.NODE_ENV === 'development')`で囲む

### m-02: setup/page.tsx の setTimeout(500ms) による待機

**ファイル**: `src/app/setup/page.tsx` L99

```typescript
await new Promise((resolve) => setTimeout(resolve, 500))
```

トリガー完了をsleepで待つのは不確実。ネットワーク遅延やDB負荷によっては500msでは不十分な場合がある。

**推奨対応**: リトライループ（最大3回、100ms間隔）でprofileの存在を確認する方式に変更する。

### m-03: loginSupabase でprofileのマッピングがProfileRow型を経由していない

**ファイル**: `src/lib/auth/auth-context.tsx` L234-242

`loginSupabase`内でprofileデータを手動で`as string` / `as boolean`キャストしてUserオブジェクトを構築しているが、`supabase-auth-storage.ts`には`profileToUser`マッパー関数が既に存在する。

**推奨対応**: `profileToUser`をexportして再利用し、マッピングロジックの重複を排除する。

### m-04: switchTenant で async IIFE がエラーを握りつぶしている

**ファイル**: `src/lib/auth/auth-context.tsx` L341-369

```typescript
;(async () => {
  // ...
})()
```

Supabaseモードのテナント切替がasync IIFEで実行されているが、`.catch()`がないためPromiseの拒否が未処理になる可能性がある。

**推奨対応**: `.catch(console.error)` を追加するか、switchTenant自体をasyncにしてUI側でエラーハンドリングする。

### m-05: email UNIQUEインデックスが未定義

**ファイル**: `supabase/auth-migration.sql`

`profiles`テーブルの`email`カラムにインデックス（L90）はあるがUNIQUE制約がない。`supabaseGetUserByEmail`は`.single()`を使用しているため、同じメールで複数のprofileが存在するとエラーになる。

**推奨対応**: `CREATE UNIQUE INDEX`に変更するか、テーブル定義に`UNIQUE`制約を追加する。

### m-06: passwordHash フィールドが空文字列で返される

**ファイル**: `src/lib/auth/supabase-auth-storage.ts` L52

Supabase Authがパスワードを管理するため`passwordHash: ''`を返しているが、User型にpasswordHashが必須フィールドとして残っている。

**推奨対応**: User型からpasswordHashをオプショナルにするか、Supabase専用のUser型を検討する（Phase 2以降で対応可）。

---

## 良い点

1. **`isSupabaseConfigured()`による透過的な切替**: 環境変数の有無だけでlocalStorage/Supabase Authを自動切替する設計は、開発体験と本番移行の両立に優れている。

2. **RLS無限再帰の適切な修正**: `is_system_admin()` SECURITY DEFINER関数で再帰を断ち切る手法は正しいアプローチ。`STABLE`マークによるクエリ最適化も適切。

3. **`has_system_admin()`によるanon対応**: 未認証状態でのセットアップ完了判定をDB関数で実現し、anonロールにGRANTする設計は堅実。フォールバックロジック（L644-651）も備えている。

4. **テナントセッションのsessionStorage永続化**: ブラウザリロード時のテナント選択状態をsessionStorageで保持する設計は、Supabase Authのステートレスな性質を適切に補完している。

5. **async helper関数の分離**: 同期インターフェースのスタブと非同期ヘルパー関数を分離し、段階的移行を可能にしている。

6. **DBトリガーによるprofile自動作成**: auth.usersとprofilesの同期をトリガーで自動化し、既存ユーザーの修復クエリも含めている点は堅実。

7. **エラーメッセージの日本語化**: ユーザー向けエラーメッセージが適切に日本語化されており、UXに配慮されている。

---

## 最終判定

| 判定 | **条件付き承認** |
|------|-----------------|
| 条件 | C-01（is_system_admin権限昇格脆弱性）の修正完了後にマージ可 |

**必須対応（マージブロッカー）**:
- C-01: handle_new_userトリガーでis_system_adminをクライアントメタデータから取得しない

**推奨対応（次スプリント以内）**:
- M-01: createUserの二重INSERT問題の解消
- M-02: tenant_memberships自己参照RLSの安全化
- M-03: SQLマイグレーションファイルの統合

**任意対応（技術的負債として管理）**:
- m-01 ~ m-06: 品質改善として順次対応
