# Review Report v10 - 多段フォールバック認証レビュー

**案件ID**: PRJ-002
**レビュー日**: 2026-03-25
**対象**: `auth-guard.ts`（多段フォールバック認証）、`supabase-auth-storage.ts`（authFetch）、全API route認証維持確認
**レビュアー**: レビュー部門
**前回**: v9（C-1: 認証なし -> Critical NG）

---

## エグゼクティブサマリー

v9で指摘したC-1（全API routeに認証なし）は解消済み。全6つのAPI routeに適切な認証・認可ガード（`requireSystemAdmin`/`requireAdminOrSystemAdmin`/`requireTenantMember`/`requireAuth`）が導入されている。C-2（isSystemAdminフラグの権限制限）もrequireSystemAdmin通過後のみ有効となり解消。C-3（パスワードログ漏洩）もcatchブロックでbody全体を出力しない修正が確認できた。

新規導入された`auth-guard.ts`の3段階フォールバック認証と、`authFetch()`のBearerトークン付与について、セキュリティ・正確性・パフォーマンスの観点で以下に指摘する。

---

## Critical (対応必須)

### C-1: `authFetch()`が`getSession()`を使用している

**該当**: `supabase-auth-storage.ts` L84

```typescript
const { data: { session } } = await supabase.auth.getSession()
```

`getSession()`はローカルストレージ/メモリ上のセッションを返すだけで、Supabaseサーバーに対してトークンの有効性を検証しない。期限切れや無効化されたトークンがそのまま使用される可能性がある。

**対応案**: `getUser()`に変更してサーバー側で検証するか、最低限`getSession()`後に有効期限チェック（`session.expires_at`）を行い、期限切れ時は`refreshSession()`を呼ぶ。ただし`authFetch()`はブラウザ側のヘルパーであり、APIルート側の`auth-guard.ts`で`getUser(token)`による再検証が行われるため、実害は限定的。それでも防御的に`getUser()`への変更を推奨する。

**重大度補足**: APIルート側でトークンの再検証が行われるため、実際の認証バイパスには至らない。ただしベストプラクティスからの逸脱であり、将来の保守者が誤解するリスクがある。

### C-2: Method 3のcookie直接解析がSupabase v2のcookie形式と不整合

**該当**: `auth-guard.ts` L78-115

Method 3は`auth-token`を含むcookie名を探し、その値をJSONパースして`access_token`を取り出す。しかし:

- Supabase SSR (`@supabase/ssr`) v0.5以降はcookieをチャンク分割して`sb-<ref>-auth-token.0`, `sb-<ref>-auth-token.1`...のように複数cookieに分散保存する。Method 3は最初にマッチした1つのcookieしか見ないため、チャンク分割されたトークンでは不完全な値を取得し、認証に失敗する。
- パース失敗時のフォールバック（L104-109）でcookieの生の値をそのままトークンとして送信しているが、チャンク化されたbase64の断片はJWTとして無効であり、Supabaseに無効なトークンを送りつけるだけになる。

**対応案**: Method 3を削除する。Method 1（`createServerClient`によるcookieベースセッション）がSupabaseのcookieチャンク化を正しくハンドルするため、Method 3の存在意義がない。Method 1が失敗してMethod 3が成功するシナリオは論理的に存在しない（両方とも同じcookieソースを使う）。

---

## Major (早期対応推奨)

### M-1: Method 2でservice_role_keyを使ってトークン検証している

**該当**: `auth-guard.ts` L67-68

```typescript
const adminClient = getAdminClientForAuth()
const { data: { user } } = await adminClient.auth.getUser(token)
```

`getAdminClientForAuth()`は`SUPABASE_SERVICE_ROLE_KEY`を使用する。Bearerトークンの検証に`service_role`クライアントを使う必要はない。`anon_key`クライアントでも`getUser(token)`はSupabase Authサーバーにトークンを送信して検証するため、結果は同じ。service_roleの不必要な使用は攻撃面を広げる。

**対応案**: Method 2のトークン検証には`anon_key`ベースのクライアントを使う。

### M-2: `getAdminClientForAuth()`がリクエストごとに新規クライアントを生成

**該当**: `auth-guard.ts` L19-25

`requireAuth()`内でMethod 2、Method 3、profile取得と最大3回`getAdminClientForAuth()`が呼ばれ、そのたびにSupabaseクライアントが新規生成される。1リクエスト内で1つのadminClientを共有すべき。

**対応案**: `requireAuth()`内で一度だけ生成し、変数に保持して再利用する。

### M-3: v9のM-2/M-3（削除カスケード不完全）が未修正

**該当**: `users/route.ts` L77, `tenants/route.ts` L90

`tenant_memberships`削除のエラーチェックが依然として行われていない。メンバーシップ削除が失敗した場合のデータ不整合リスクは残存。

### M-4: v9のM-4（supabaseAddMembershipの偽ID）が未修正

**該当**: `supabase-auth-storage.ts` L467-468

`id: \`${userId}_${tenantId}\``は依然としてDB上の実際のIDと一致しない。

### M-5: v9のM-5（Rate Limiting未導入）が未修正

認証が追加されたことでリスクは軽減されたが、認証済みユーザーによるAPI乱用の可能性は残る。

---

## Minor (改善推奨)

### m-1: Method 1とMethod 3のcookieStore取得が重複

**該当**: `auth-guard.ts` L38, L81

`await cookies()`が2回呼ばれている。Method 3の削除（C-2対応）で自動解消される。

### m-2: フォールバックの空catchが多すぎる

**該当**: `auth-guard.ts` L56, L73, L103, L112

4箇所の空catchがデバッグを困難にする。最低限`console.debug`レベルでログ出力すべき。

### m-3: v9のm-1（同期スタブ大量残存）が未修正

**該当**: `supabase-auth-storage.ts` L119-295

将来的にインターフェースのasync対応が望ましい。

### m-4: v9のm-5（`add-membership`のルート名）が未修正

REST命名規則としては`memberships`が適切。

---

## v9指摘の解消状況

| v9 ID | 内容 | 状態 |
|-------|------|------|
| C-1 | 全API routeに認証チェックなし | **解消** -- 全routeに適切なガード導入 |
| C-2 | isSystemAdminフラグの権限制限 | **解消** -- requireSystemAdmin通過後のみ |
| C-3 | パスワードログ漏洩 | **解消** -- catchでbody非出力化 |
| M-1 | getAdminClient不統一 | **解消** -- `admin-client.ts`に共通化 |
| M-2 | ユーザー削除カスケード不完全 | 未修正 |
| M-3 | テナント削除カスケード不完全 | 未修正 |
| M-4 | membership偽ID | 未修正 |
| M-5 | Rate Limiting未導入 | 未修正 |

---

## API Route認証チェック一覧

| Route | Method | 認証ガード | 適切性 |
|-------|--------|-----------|--------|
| `/api/admin/create-user` | POST | `requireSystemAdmin` | OK |
| `/api/admin/users` | GET/DELETE/PATCH | `requireSystemAdmin` | OK |
| `/api/admin/tenants` | GET/POST/DELETE/PATCH | `requireSystemAdmin` | OK |
| `/api/admin/add-membership` | POST/DELETE/PATCH | `requireAdminOrSystemAdmin(tenantId)` | OK |
| `/api/admin/tenant-members` | GET | `requireTenantMember(tenantId)` | OK |
| `/api/admin/user-memberships` | GET | `requireAuth` + 行レベル権限チェック | OK |

全API routeに認証・認可が正しく適用されている。権限レベルもリソースの機密度に応じた適切な粒度で設定されている。

---

## パフォーマンス評価

3段階フォールバックのオーバーヘッドについて:

- **Method 1（cookie）が成功する場合**: Supabase Auth 1回のみ。これが大半のケースでありオーバーヘッドなし。
- **Method 2まで到達する場合**: Supabase Auth 2回。Bearerトークン利用時のみで許容範囲。
- **Method 3まで到達する場合**: Supabase Auth最大3回。ただしC-2で述べた通りMethod 3は実質無意味であり、削除推奨。
- **profile取得**: 認証成功後に必ず1回のDB問い合わせ。適切。

Method 3を削除すれば最大2回のAuth呼び出しに限定され、パフォーマンス上の懸念はない。

---

## 最終判定

**条件付きOK**

v9のCritical指摘は全て解消された。認証基盤としてのアーキテクチャは健全。

ただし以下の対応を本番デプロイ前に求める:

| 優先度 | ID | 内容 | 想定工数 |
|--------|----|------|----------|
| 1 | C-2 | Method 3（cookie直接解析）の削除 | 15min |
| 2 | C-1 | authFetchの`getSession()`を`getUser()`に変更 | 15min |
| 3 | M-1 | Method 2のトークン検証をanon_keyクライアントに変更 | 15min |
| 4 | M-2 | adminClient生成の重複排除 | 15min |

上記C-1/C-2を対応後、再レビュー不要（軽微な変更のため）。M-3~M-5は次スプリントで対応可。
