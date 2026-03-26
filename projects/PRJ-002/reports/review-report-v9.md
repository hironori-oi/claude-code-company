# Review Report v9 - Server-side API Route統一レビュー

**案件ID**: PRJ-002
**レビュー日**: 2026-03-25
**対象**: 全Supabaseデータ操作のserver-side API route統一
**レビュアー**: レビュー部門

---

## エグゼクティブサマリー

全てのSupabaseデータ操作をserver-side API routeに統一し、`service_role_key`でRLSをバイパスするアーキテクチャに移行している。クライアント側(`supabase-auth-storage.ts`)は全ての非同期データ操作を`fetch`経由でAPI routeに委譲しており、設計方針としては一貫性がある。

しかし、**全API routeに認証・認可チェックが一切存在しない**という致命的なセキュリティ問題がある。`middleware.ts`も存在せず、これらのエンドポイントは未認証ユーザーを含む誰でもアクセス可能な状態にある。`service_role_key`による全権操作がインターネットに公開されている。

---

## Critical (対応必須)

### C-1: 全API routeに認証チェックが存在しない

**該当ファイル**: 全6つのAPI route

全てのAPI routeが認証チェックなしで`service_role_key`を使用している。つまり:
- 未認証ユーザーが任意のユーザーを作成・削除・更新可能
- 未認証ユーザーがテナントを自由に作成・削除可能
- 未認証ユーザーがメンバーシップを操作して権限昇格可能
- `isSystemAdmin: true`を指定してシステム管理者を勝手に作成可能

**対応案**: 全API routeの先頭でSupabaseセッションを検証し、`is_system_admin`のチェックを行う共通ミドルウェアまたはヘルパー関数を導入する。

```typescript
// 例: 共通認証ヘルパー
async function requireSystemAdmin(request: NextRequest) {
  const supabase = createServerClient(/* cookies */)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new AuthError(401)
  const { data: profile } = await supabase.from("profiles")
    .select("is_system_admin").eq("id", user.id).single()
  if (!profile?.is_system_admin) throw new AuthError(403)
  return user
}
```

### C-2: ユーザー作成APIで`isSystemAdmin`フラグをクライアントが自由に指定可能

**該当**: `create-user/route.ts` L16, L66-93

リクエストボディの`isSystemAdmin`がそのまま信頼されており、認証チェックもないため、誰でもシステム管理者を作成できる。C-1の認証に加え、このフラグの設定は既存のシステム管理者のみに制限すべき。

### C-3: パスワードがAPI route間を平文で転送されている

**該当**: `create-user/route.ts` L12, `users/route.ts` L113

`createUser`と`PATCH`でパスワードがリクエストボディに平文で含まれる。HTTPS前提とはいえ、サーバーログやエラーレポートに漏洩するリスクがある。パスワード変更は専用のセキュアなエンドポイントに分離することを推奨。

---

## Major (早期対応推奨)

### M-1: `getAdminClient()`の実装が不統一

**該当**: 各API route

- `tenants/route.ts` L5-6: non-null assertion (`!`) で環境変数チェックなし
- `users/route.ts`, `add-membership/route.ts`, `user-memberships/route.ts`: 明示的なnullチェック付き
- `create-user/route.ts`, `tenant-members/route.ts`: インライン実装（ヘルパー関数化されていない）

共通のadminクライアント生成ユーティリティに統一すべき。

### M-2: ユーザー削除のカスケード処理が不完全

**該当**: `users/route.ts` L76-77

`tenant_memberships`の削除エラーが無視されている（`await`の結果を確認していない）。メンバーシップ削除が失敗した場合、外部キー制約によりprofile削除も失敗する可能性がある。また、削除順序がprofile -> auth userだが、profile削除後にauth user削除が失敗した場合、orphaned auth userが残る。トランザクションまたはリカバリロジックが必要。

### M-3: テナント削除時のカスケード処理も同様に不完全

**該当**: `tenants/route.ts` L75

メンバーシップ削除のエラーハンドリングなし。削除が部分的に失敗した場合のデータ不整合リスクがある。

### M-4: `supabaseAddMembership`が偽のIDを返す

**該当**: `supabase-auth-storage.ts` L454-455

API routeの`POST /api/admin/add-membership`は`{ success: true }`しか返さないが、クライアント側では`id: \`${userId}_${tenantId}\``という合成IDを返している。これは実際のDB上のIDと一致しないため、後続処理で不整合が生じる可能性がある。

### M-5: Rate Limitingが存在しない

全API routeにレートリミットがない。認証がない現状では、大量のユーザー作成やデータ取得が無制限に可能。

---

## Minor (改善推奨)

### m-1: 同期スタブメソッドが大量に残っている

**該当**: `supabase-auth-storage.ts` L119-295

`AuthStorage`インターフェースの同期メソッドが`console.warn`付きのスタブとして残っている。これらが呼ばれた場合、ログが汚れるだけで正しく動作しない。インターフェース自体をasync対応に改修するか、明示的にエラーをthrowすべき。

### m-2: エラーメッセージの言語が日英混在

API routeのエラーメッセージが日本語と英語で混在している。統一すべき。

### m-3: `tenant-members/route.ts`だけ`getAdminClient`ヘルパーを使っていない

**該当**: `tenant-members/route.ts` L15-24

他のrouteが(不統一ながらも)`getAdminClient`を使っている中、このファイルだけインラインで環境変数取得とクライアント生成を行っている。

### m-4: `supabaseGetTenantMembers`のパースが冗長

**該当**: `supabase-auth-storage.ts` L510-534

`Record<string, unknown>`にキャストしてから手動でStringに変換する処理が冗長。型付きインターフェースで直接パースする方が安全かつ簡潔。

### m-5: `add-membership`というルート名でDELETE/PATCHも提供

**該当**: `add-membership/route.ts`

リソース名として`memberships`の方が RESTful。`add-membership`は動詞的で、DELETE/PATCHの意味と矛盾する。

---

## 良い点

1. **RLSバイパスの一元化**: `service_role_key`の使用がサーバーサイドに限定され、クライアントには漏洩しない設計になっている。
2. **セッション分離**: `createUser`でadmin APIを使うことで、管理者のセッションが切り替わる問題を回避している。
3. **リトライロジック**: `create-user/route.ts`のprofile更新にリトライ+フォールバック(upsert)が実装されており、トリガーの遅延に対処している。
4. **入力バリデーション**: 各API routeで必須パラメータのチェックが行われている。
5. **try-catchの一貫性**: 全API routeで外側のtry-catchがあり、予期しないエラーでも500を返す。
6. **emailの正規化**: `toLowerCase()`が一貫して適用されている。

---

## 最終判定

**NG - リリース不可**

C-1（認証なし）が未解決の状態では本番デプロイは不可。`service_role_key`相当の権限が認証なしでインターネットに公開されることは、全データの漏洩・改ざん・削除を許容することに等しい。

### 優先対応順序

| 優先度 | ID | 内容 | 想定工数 |
|--------|----|------|----------|
| 1 | C-1 | 全API routeに認証・認可チェック追加 | 2-3h |
| 2 | C-2 | isSystemAdminフラグの権限制限 | C-1と同時 |
| 3 | C-3 | パスワード変更の分離 | 1h |
| 4 | M-1 | getAdminClient共通化 | 30min |
| 5 | M-2, M-3 | 削除カスケードの堅牢化 | 1-2h |
| 6 | M-4 | membership作成レスポンスの修正 | 30min |
| 7 | M-5 | Rate Limiting導入 | 1-2h |

C-1, C-2を解消した上で再レビューを実施する。
