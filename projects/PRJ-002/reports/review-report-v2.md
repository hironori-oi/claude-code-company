# PRJ-002 レビューレポート v2

**案件ID**: PRJ-002
**レビュー日**: 2026-03-24
**レビュー対象**: Phase 4完了後の追加機能（マルチテナント認証、テーブルエディタ、BOTH抽出、OCR改善等）
**レビュアー**: レビュー部門（品質管理）

---

## 1. エグゼクティブサマリー

Phase 4以降に追加されたマルチテナント認証システム、管理UI、抽出エンジン改善を包括的にレビューした。全体として機能設計は適切であり、テナント分離やUI/UXの品質は高い水準にある。

しかし、**Critical指摘が2件、Major指摘が5件**検出された。特に認証データストレージの二重管理（異なるlocalStorageキー）は、ユーザーが作成されても認証できない致命的なバグに直結する。また、パスワードハッシュがソルトなしSHA-256単独で実装されている点は、開発段階であっても早期に対処すべきセキュリティ上の懸念である。

**最終判定: 条件付き承認（Critical 2件の修正完了後に承認）**

---

## 2. Critical指摘（必須修正）

### C-01: 認証ストレージキーの不一致（データ不整合）

**ファイル**:
- `src/lib/auth/auth-storage.ts` (L16-18)
- `src/lib/auth/tenant-user-storage.ts` (L9-11)

**概要**: 2つのモジュールがユーザー・テナント・メンバーシップの同一データに対して**異なるlocalStorageキー**を使用している。

| データ種別 | auth-storage.ts | tenant-user-storage.ts |
|-----------|----------------|----------------------|
| Users | `pdf-extract-auth-users` | `pdf-extract-users` |
| Tenants | `pdf-extract-auth-tenants` | `pdf-extract-tenants` |
| Memberships | `pdf-extract-auth-memberships` | `pdf-extract-memberships` |

**影響**:
- セットアップ画面(`/setup`)で `auth-storage.ts` 経由で作成したシステム管理者ユーザーが `pdf-extract-auth-users` に保存される
- ログイン処理も `auth-storage.ts` を使うため、この段階では動作する
- しかし、管理画面(`/admin/users`, `/admin/tenants`)で `tenant-user-storage.ts` を使ってユーザーやテナントを作成すると `pdf-extract-users`, `pdf-extract-tenants` に保存される
- `tenant-user-storage.ts` で作成されたユーザーはログインできない（`auth-storage.ts` の `verifyPassword` は `pdf-extract-auth-users` を参照するため）
- 逆にセットアップで作成されたシステム管理者は管理画面のユーザー一覧に表示されない

**修正方針**: ストレージキーを統一する。`tenant-user-storage.ts` のキーを `auth-storage.ts` に合わせるか、共通の定数ファイルに切り出す。

---

### C-02: パスワードハッシュにソルトなし（セキュリティ脆弱性）

**ファイル**:
- `src/lib/auth/auth-storage.ts` (L32-38)
- `src/lib/auth/tenant-user-storage.ts` (L39-45)

**概要**: パスワードハッシュが `SHA-256(password)` のみで計算されている。ソルトもストレッチングも適用されていない。

```typescript
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  // ...
}
```

**リスク**:
- 同一パスワードを持つ全ユーザーのハッシュ値が同一になる
- レインボーテーブル攻撃に対して完全に無防備
- localStorageに保存されたハッシュ値がDevToolsで閲覧可能であり、XSSと組み合わさると即座にオフライン辞書攻撃が可能

**修正方針**:
- ユーザーごとにランダムソルトを生成し、User型に `salt: string` フィールドを追加
- PBKDF2（Web Crypto APIで利用可能）を使用したストレッチングを適用（最低10,000イテレーション推奨）
- 現在は開発モードのlocalStorageベースであり本番ではSupabase Auth移行予定とのことだが、開発環境でも攻撃を受ける可能性はあるため対応すべき

---

## 3. Major指摘（強く推奨）

### M-01: セッションにUser全体（passwordHash含む）を保存

**ファイル**: `src/lib/auth/auth-storage.ts` (L376-379), `src/types/auth.ts` (L31-37)

**概要**: `AuthSession` 型がユーザーオブジェクト全体を保持しており、`sessionStorage` に `passwordHash` を含むUserオブジェクトがJSON保存される。

```typescript
export interface AuthSession {
  userId: string
  tenantId: string | null
  role: SystemRole
  user: User        // <-- passwordHashが含まれる
  tenant: Tenant | null
}
```

**リスク**: XSS脆弱性が1つでもあれば、攻撃者は `sessionStorage` から全セッション情報とパスワードハッシュを窃取可能。

**修正方針**: セッションに保存するUserオブジェクトから `passwordHash` を除外する。`Omit<User, 'passwordHash'>` を使用するか、保存前にフィールドを削除する。

---

### M-02: テナント削除時にテナント固有ストレージデータが残存

**ファイル**: `src/lib/auth/tenant-user-storage.ts` (L89-98)

**概要**: `deleteTenant()` はメンバーシップの削除のみ実行する。テナントに紐づくlocalStorageデータ（`pdf-extract-templates-{tenantId}`, `pdf-extract-tables-{tenantId}` 等）は削除されない。

**影響**: テナント削除後もテンプレートやテーブル定義データがlocalStorageに永続的に残り続ける。テナントIDが衝突した場合（実質起こらないがUUIDではないため）に古いデータが見える可能性がある。また、ユーザーが「データを削除した」と認識しても実際にはブラウザに残り続ける。

**修正方針**: テナント削除時に当該テナントのストレージキーもクリーンアップする。各ストレージモジュールに `clearForTenant(tenantId)` メソッドを追加する。

---

### M-03: 認証チェックの欠如（/admin/*ページ）

**ファイル**:
- `src/app/admin/tenants/page.tsx`
- `src/app/admin/users/page.tsx`

**概要**: 管理ページはクライアントサイドで `isSystemAdmin` をチェックしているが、`ProtectedRoute` ラッパーを使用していない。直接URLアクセス時にログインしていないユーザーが一瞬コンテンツを見る可能性がある（`useAuth` がローディング中は `isSystemAdmin === false` となり「アクセス権限がありません」が表示されるが、認証ページへのリダイレクトが発生しない）。

**修正方針**: `/admin/*` ページに `ProtectedRoute` コンポーネントでラップし、`requiredRole="system_admin"` を指定する。

---

### M-04: header.tsxでレンダリング毎にlocalStorage読み込み

**ファイル**: `src/components/layout/header.tsx` (L40-43)

**概要**: `Header` コンポーネントが毎レンダリング時に `authStorage.getUserMemberships(session.userId)` を呼び出し、localStorage全体を読み込み・パースしている。

```typescript
let memberships: (TenantMembership & { tenant: Tenant })[] = []
if (isAuthenticated && session) {
  memberships = authStorage.getUserMemberships(session.userId)
}
```

**影響**: Headerは全ページで表示され、状態更新のたびに再レンダリングされる。大量のテナント/メンバーシップがある場合にパフォーマンス低下を招く。

**修正方針**: `useMemo` または `useState` + `useEffect` でキャッシュし、`session` の変更時のみ再取得する。

---

### M-05: hashPassword関数の重複定義

**ファイル**:
- `src/lib/auth/auth-storage.ts` (L32-38)
- `src/lib/auth/tenant-user-storage.ts` (L39-45)

**概要**: 同一の `hashPassword` 関数が2つのファイルで独立して定義されている。将来的にハッシュアルゴリズムを変更する場合、両方を更新する必要があり、片方だけ更新した場合にログイン不能になる。

**修正方針**: 共通ユーティリティに切り出し、単一ソースとする。

---

## 4. Minor指摘（改善提案）

### m-01: ROLE_HIERARCHY定数の重複定義

**ファイル**:
- `src/lib/auth/auth-context.tsx` (L16-20)
- `src/components/auth/permission-gate.tsx` (L11-15)

**概要**: ロール階層定数が2箇所で独立定義されている。将来ロールを追加する場合に不整合のリスクがある。共通定数として1箇所に統合すべき。

---

### m-02: getTenantMembersの引数名が不正確

**ファイル**: `src/lib/auth/auth-storage.ts` (L98-99)

```typescript
getTenantMembers(
  userId: string  // <-- 実際にはtenantIdとして使われている
): (TenantMembership & { user: User })[]
```

**概要**: インターフェース定義の引数名が `userId` だが、実装ではパラメータを `tenantId` として使用している。紛らわしいバグの原因になりうる。

---

### m-03: ユーザーダイアログのパスワード強度検証なし

**ファイル**: `src/components/admin/user-dialog.tsx`

**概要**: セットアップページ(`/setup`)では8文字以上のバリデーションがあるが、管理画面からのユーザー作成ダイアログでは空文字チェックのみ。1文字のパスワードでもユーザーを作成できてしまう。

**修正方針**: セットアップと同様に8文字以上のバリデーションを追加する。

---

### m-04: テナントメンバーリストのメール検索が大文字小文字を区別しない統一性なし

**ファイル**: `src/lib/auth/tenant-user-storage.ts` (L110-112)

```typescript
export function getUserByEmail(email: string): User | null {
  return getAllUsers().find((u) => u.email === email) ?? null
}
```

`auth-storage.ts` の `getUserByEmail` は `toLowerCase()` で比較しているが、`tenant-user-storage.ts` は厳密比較（`===`）を使用している。

---

### m-05: VLMの固定confidence値

**ファイル**: `src/lib/extraction/vlm-engine.ts` (L93)

```typescript
confidence: 0.85, // VLM confidence is estimated
```

VLMの信頼度が常に固定値0.85である。将来的には応答のメタデータやヒューリスティクスから信頼度を推定する仕組みを検討すべき。

---

### m-06: region-canvas.tsxのイベントハンドラがインラインで再生成

**ファイル**: `src/components/templates/region-canvas.tsx`

**概要**: `handleMouseDown`, `handleMouseMove`, `handleMouseUp`, `handleMouseLeave`, `handleKeyDown` がレンダー関数内で毎回再生成される。`useCallback` でメモ化すると、特にCanvasへのイベントリスナー付与時にパフォーマンスが安定する。ただし現状refベースの実装で機能上は問題ない。

---

### m-07: batch-engine.tsでjobIdが空文字で渡されている

**ファイル**: `src/lib/extraction/batch-engine.ts` (L364, L372, L381等)

```typescript
"", // jobId will be set by the caller
```

jobIdが空文字で結果レコードに保存される。呼び出し元で上書きされると推測されるが、上書きされなかった場合にジョブとの紐付けが不可能になる。

---

## 5. 良い点

1. **テナント分離アーキテクチャ**: `TenantStorageProvider` による設計は明確。localStorage キーにテナントIDを付与する方式はシンプルかつ効果的で、将来のSupabase移行時もインターフェースが安定する。

2. **認証フローの段階的設計**: 初期セットアップ -> ログイン -> テナント選択 -> メインアプリ のフローが明確に分離されており、各段階のリダイレクト制御も適切。

3. **OCR前処理の品質**: 大津の二値化、アップスケーリング、パディングの実装は教科書的に正確。CJKスペース除去のループ処理も適切。

4. **Canvas操作のUX**: リサイズハンドル、ドラッグ移動、カラムディバイダーのドラッグが滑らかに動作する設計。`requestAnimationFrame` の適切な使用、`clampPct` による範囲制限も良い。

5. **VLMプロンプト厳格化**: system promptで「Output ONLY the raw extracted value」と明示し、`cleanExtractedValue` で後処理も実装。LLMの冗長な応答に対する堅牢性が高い。

6. **ArrayBuffer detach対策**: `.slice(0)` による防御的コピーが全箇所で適用されている。

7. **アクセシビリティ**: `sr-only` テキスト、`aria-label`、`aria-live` リージョンが適切に配置されている。

8. **開発モードバナー**: localStorage認証であることを全認証関連画面で明示しており、本番環境との混同リスクを低減している。

---

## 6. 最終判定

**条件付き承認**

### 承認条件（マージ前に必須）

| 優先度 | 指摘ID | 内容 |
|--------|--------|------|
| Critical | C-01 | ストレージキーの統一 |
| Critical | C-02 | パスワードハッシュへのソルト+ストレッチング適用 |

### マージ後の対応推奨（次スプリント）

| 優先度 | 指摘ID | 内容 |
|--------|--------|------|
| Major | M-01 | セッションからpasswordHash除外 |
| Major | M-02 | テナント削除時のストレージクリーンアップ |
| Major | M-03 | /admin/*ページのProtectedRouteラップ |
| Major | M-04 | Header内のlocalStorage読み込みキャッシュ化 |
| Major | M-05 | hashPassword関数の共通化 |

---

## 7. 修正優先度マトリクス

| 指摘ID | 重要度 | 影響範囲 | 修正工数 | 優先順位 |
|--------|--------|----------|----------|----------|
| C-01 | Critical | 全認証・管理機能 | 小（キー名変更） | 1 |
| C-02 | Critical | 全ユーザーのパスワード安全性 | 中（ハッシュロジック+マイグレーション） | 2 |
| M-01 | Major | セッションセキュリティ | 小（型変更+フィルタ） | 3 |
| M-03 | Major | 管理画面セキュリティ | 小（ProtectedRoute追加） | 4 |
| M-05 | Major | コード保守性 | 小（リファクタリング） | 5 |
| M-02 | Major | データライフサイクル | 中（各ストレージに機能追加） | 6 |
| M-04 | Major | パフォーマンス | 小（useMemo追加） | 7 |
| m-01〜m-07 | Minor | 各種 | 小 | 8+ |

---

以上
