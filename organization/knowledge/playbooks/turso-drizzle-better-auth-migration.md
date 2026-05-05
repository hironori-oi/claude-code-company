---
type: playbook
pattern_id: PATTERN-003
title: Turso + Drizzle + Better Auth スタック移行プレイブック
domain_tags: [stack-migration, multi-tenant, saas, auth, database]
tech_tags: [turso, libsql, drizzle, better-auth, nextjs-16, supabase, r2]
maturity: production-proven
adoption_count: 3
adopted_in: [PRJ-015, PRJ-016, PRJ-017]
created_date: 2026-04-28
updated_date: 2026-04-28
quality_score: A
author: dev
---

# Turso + Drizzle + Better Auth スタック移行プレイブック

> **TL;DR** — Supabase（Postgres + Auth + RLS + Realtime + Storage）から **Turso(libSQL) + Drizzle ORM + Better Auth + Cloudflare R2 + TanStack Query Polling** へ移行するときの **再現可能な手順書**。
> PRJ-015 Coatly が確立し、PRJ-016 HANEI / PRJ-017 ホメコトが踏襲して **3 案件すべて 4 人日以内に移行完了**した実績ある運用。
> このプレイブックを `cp -r` で出発点として使えば、次案件の Supabase → Turso 切替は **1.5〜4.0 人日**（雛形流用度に応じて）で完了する。
> RLS が消える代わりに **PATTERN-001（マルチテナント三層認可）を必ず併用**する点だけは絶対の前提。

---

## 1. 問題（Problem）

Supabase は「Postgres + Auth + RLS + Realtime + Storage」のフルスタックを Free Tier で提供する強力な選択肢だが、次の事故・制約を 3 案件で連続して引いた結果、本プレイブックが必要になった：

- **事故 1（PRJ-017 W2 緊急）**: Supabase 無料枠の段階的縮小・課金トリガー読みづらさ → 「永続無料」を約束したオーナーへの説明責任を満たせない懸念。**DEC-026** で 48h 緊急再選定発令、**DEC-028** で Turso 確定。
- **事故 2（PRJ-016）**: Supabase Storage の Egress 課金が β規模で読みづらく、R2 へ早期移行（Egress 完全無料）。
- **事故 3（PRJ-015）**: 「Auth.js v5 + organization 自前実装」で +3〜5 人日の見積膨張 → Better Auth 1.6.9 の OSS / MIT / 永続無料 + organization plugin で吸収。
- **制約 1**: libSQL は SQLite 派生のため、Postgres 固有の `JSONB` / `TIMESTAMPTZ` / `uuid_generate_v4()` / `CREATE POLICY` / `CREATE FUNCTION` / `EXTENSION` がそのままでは動かない。**変換規則を毎案件再発明するのは非効率**。
- **制約 2**: Supabase RLS が無くなる以上、行レベル認可は **アプリ層三層認可（PATTERN-001）に必ずポート**する必要がある。RLS 喪失をそのまま放置すると CRITICAL のテナント漏洩を直撃する。

「気をつける」では再発しないので、**移行手順をプレイブック化する**必要がある。

---

## 2. コンテキスト

このプレイブックを採用すべき条件:

| 条件 | 説明 |
|---|---|
| C1 | バックエンドが Next.js（App Router）+ Server Actions / Route Handlers ベース |
| C2 | β〜小〜中規模 SaaS（MAU 〜数千、月次イベント同時 〜数千）で**永続無料**を最優先 |
| C3 | 多テナント（organization / workspace / tenant）が前提で、PATTERN-001 を併用予定 |
| C4 | Tokyo region（日本ユーザー中心）— libSQL Tokyo region で十分 |
| C5 | 法人化・大規模化はまだ先（Turso Free 5GB / 500M reads/月で半年〜1 年は耐える）|

**採用しない方が良いケース**:

- 既に Supabase Realtime / RLS を業務ロジックの根幹に深く組み込んでいる既存案件（移植コストが利益を上回る）
- Postgres 固有の拡張（pgvector / pgrouting / postgis）に依存している
- TPS / 同時接続数が桁違いに高く、SQLite 系で対応困難
- グローバル展開でマルチリージョン書き込みが必須（libSQL もエッジレプリカは可能だが、フル Postgres の方が成熟）

---

## 3. 解決策（Solution）

### 3.1 移行前後のスタック比較

```
┌──────────────────────────────────┐    ┌──────────────────────────────────┐
│ Supabase スタック（旧）          │    │ Turso スタック（新）             │
├──────────────────────────────────┤    ├──────────────────────────────────┤
│ Database  : Supabase PostgreSQL  │ →  │ Database  : Turso (libSQL/SQLite)│
│ ORM       : @supabase/supabase-js│ →  │ ORM       : Drizzle ORM          │
│ Auth      : Supabase Auth        │ →  │ Auth      : Better Auth + org    │
│ AuthZ     : RLS (CREATE POLICY)  │ →  │ AuthZ     : 三層認可 (PATTERN-001)│
│ Realtime  : Supabase Realtime    │ →  │ Realtime  : TanStack Query Polling│
│ Storage   : Supabase Storage     │ →  │ Storage   : Cloudflare R2 (S3互換)│
│ Mail      : -                     │ →  │ Mail      : Resend Free          │
│ Monitor   : Supabase Logs        │ →  │ Monitor   : Sentry Free          │
│ Hosting   : Vercel               │ →  │ Hosting   : Vercel (変更なし)    │
└──────────────────────────────────┘    └──────────────────────────────────┘
```

### 3.2 移行のフェーズ構成（DAG）

```
[Phase A: 環境準備]                            [Phase D: 認可移植]
  ├─ Turso DB 作成（Tokyo）                     ├─ middleware (proxy.ts)
  ├─ Better Auth secret 生成                    ├─ guards.ts (requireOrgScope...)
  ├─ R2 bucket（split: audio/image）            └─ scopedDb.ts (Drizzle Proxy)
  └─ env.local 整備                                       │
        │                                                 ▼
        ▼                                       [Phase E: 検証]
[Phase B: schema 移植]                          ├─ unit (guards/scoped 計14 件)
  ├─ Postgres → libSQL 変換規則 適用            ├─ MT-1〜MT-7 漏洩 E2E
  ├─ drizzle/migrations/0001_initial.sql 生成   ├─ ESLint no-raw-db
  └─ seed (template 行) を INSERT OR IGNORE     └─ Vercel preview deploy
        │                                                 │
        ▼                                                 ▼
[Phase C: Better Auth 配線]                     [Phase F: 段階リリース]
  ├─ better-auth.ts adapter (drizzle libSQL)    ├─ feature flag で旧経路切替
  ├─ organization plugin 配線                   ├─ Sentry でエラー監視
  ├─ login/signup form 改修                     └─ DEC 記録 + 振り返り
  └─ 5 種 cookie 名暫定許容
```

### 3.3 移行所要時間の実績

| 案件 | 規模 | 工数 | 備考 |
|---|---|---|---|
| PRJ-015 Coatly | 新規（Phase 0 から Turso 採用）| 約 5 人日（schema + Better Auth + 三層認可 + R2 + E2E）| **テンプレ起源案件** |
| PRJ-016 HANEI | 新規（W1 から Turso 採用）| 約 4 人日（PRJ-015 から踏襲、Better Auth 1.6.9 確認のみで通過）| KidSafe 法務側に注力できた |
| PRJ-017 ホメコト | **既存 Supabase scaffold → Turso 移行**（W2 緊急）| **4 人日**（書換工数 9.5〜11.5 人日見積を W2 計画内吸収）| `dev-w2-stack-migration.md` 工数表通り |

**次案件の見積標準値**: **3〜4 人日**（PRJ-017 実績 ベース）= libSQL 移植 1 人日 + Better Auth 配線 0.8 人日 + 三層認可ポート 0.8 人日 + R2/Resend/Polling 0.4 人日 + テスト 0.4 人日 + lint/typecheck/レポート 0.2 人日

---

## 4. 実装スケッチ

### 4.1 Phase A: 環境準備（Turso DB / Better Auth / R2）

**Turso DB 作成（Tokyo）**:

```bash
# Turso CLI（npm or curl install）
npm i -g turso

turso auth signup
turso db create homekoto-prod --location nrt   # nrt = Tokyo
turso db tokens create homekoto-prod --expiration none
# → TURSO_DATABASE_URL = libsql://homekoto-prod-{org}.turso.io
# → TURSO_AUTH_TOKEN  = eyJxxxxx...
```

**`.env.local.example`**（PRJ-017 実装そのまま）:

```bash
# === Database (Turso libSQL) ===
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=

# === Better Auth ===
BETTER_AUTH_SECRET=    # 32+ chars, openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000

# === OAuth ===
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=

# === Storage (Cloudflare R2) ===
R2_S3_ENDPOINT=https://{account}.r2.cloudflarestorage.com
R2_AUDIO_BUCKET=homekoto-audio
R2_AUDIO_PUBLIC_URL=https://audio.homekoto.app
R2_IMAGE_BUCKET=homekoto-image
R2_IMAGE_PUBLIC_URL=https://image.homekoto.app
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=

# === Mail (Resend) ===
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@homekoto.app

# === AI (DEC-027) ===
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
OPENAI_TTS_MODEL=tts-1
OPENAI_TTS_VOICE=alloy

# === Monitor ===
SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# === Cron ===
CRON_SECRET=
```

**Turso 接続クライアント（`src/lib/db/turso.ts`）**:

```ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error('TURSO_DATABASE_URL is not set');

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export type Db = typeof db;
```

> **dev / test の使い分け**: dev は `file:./local.db`、test は `file::memory:?cache=shared`（CI で `npm run test` 完結）。本番は `libsql://...turso.io`。

---

### 4.2 Phase B: schema 移植 — Postgres → libSQL 5 大変換規則

#### 4.2.1 変換規則ハンドブック

| Postgres（旧）| libSQL（新）| Drizzle 表記 |
|---|---|---|
| `JSONB` | `TEXT` + JSON コーデック | `text('config', { mode: 'json' }).$type<MyJsonShape>()` |
| `TIMESTAMPTZ` | `INTEGER` epoch ms | `integer('created_at', { mode: 'timestamp_ms' }).notNull()` |
| `uuid_generate_v4()` / `gen_random_uuid()` | `crypto.randomUUID()`（アプリ層）| `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())` |
| `CREATE POLICY ...` | **削除**（PATTERN-001 三層認可で代替）| — |
| `CREATE FUNCTION` / triggers / `EXTENSION pgvector` | **削除 or アプリ層移植**（必要な計算は Server Action で）| — |
| `text[]` 配列 | `TEXT` (JSON 化) | `text('tags', { mode: 'json' }).$type<string[]>()` |
| `BIGSERIAL` AUTO INCREMENT | `INTEGER PRIMARY KEY AUTOINCREMENT` | `integer('id').primaryKey({ autoIncrement: true })` |

#### 4.2.2 Drizzle スキーマ移植テンプレート（PRJ-017 から引用）

`src/lib/db/schema/auth.ts`（Better Auth 4 表）:

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),                        // Better Auth が文字列 ULID 系
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  name: text('name'),
  image: text('image'),
  displayName: text('display_name'),
  nickname: text('nickname'),
  status: text('status', { enum: ['active', 'suspended'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  activeOrganizationId: text('active_organization_id'), // current org（Better Auth org plugin の慣習）
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  scope: text('scope'),
  password: text('password'),
});

export const verifications = sqliteTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
});
```

`src/lib/db/schema/org.ts`（マルチテナント基盤）:

```ts
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { users } from './auth';

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export const orgMembers = sqliteTable('org_members', {
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull().default('member'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  pk: primaryKey({ columns: [t.organizationId, t.userId] }),
}));

export const invitations = sqliteTable('invitations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull().default('member'),
  status: text('status', { enum: ['pending', 'accepted', 'expired'] }).notNull().default('pending'),
  inviterId: text('inviter_id').notNull().references(() => users.id),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
});
```

`src/lib/db/schema/business.ts`（業務テーブル例 = ホメコトの praises）:

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './auth';
import { organizations } from './org';

export const praises = sqliteTable('praises', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text('organization_id').notNull().references(() => organizations.id),  // ★PATTERN-001 必須
  authorId: text('author_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  animationKey: text('animation_key'),
  audioUrl: text('audio_url'),
  status: text('status', { enum: ['draft', 'published', 'flagged', 'removed'] }).notNull().default('published'),
  moderationStatus: text('moderation_status', { enum: ['pending', 'approved', 'flagged'] }).notNull().default('approved'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

// 集計用 INDEX を必ず (organizationId, ...) で前置
// CREATE INDEX idx_praises_org_created ON praises (organization_id, created_at DESC);
```

#### 4.2.3 マイグレーションファイル生成

```bash
# drizzle.config.ts
# {
#   schema: './src/lib/db/schema/index.ts',
#   out: './drizzle/migrations',
#   dialect: 'turso',
#   dbCredentials: { url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN },
# }

npx drizzle-kit generate              # SQL 生成
npx drizzle-kit push                  # 本番 DB に直接適用 (Phase 1 では push 推奨)
# または
npx drizzle-kit migrate               # migrate スクリプト実行
```

#### 4.2.4 seed（template 行）

`drizzle/migrations/0001_initial.sql` の最後に直接書くか、別途 `scripts/seed-templates.ts` を作る:

```sql
INSERT OR IGNORE INTO animation_templates (id, key, display_name, config, enabled) VALUES
  ('tmpl_confetti',  'confetti',         '紙吹雪',     '{"duration":3000}', 1),
  ('tmpl_fireworks', 'fireworks',        '花火',       '{"duration":4000}', 1),
  ('tmpl_spotlight', 'spotlight',        'スポットライト', '{"duration":3500}', 1),
  ('tmpl_glow',      'gentle-glow',      '優しい光',   '{"duration":3000}', 1),
  ('tmpl_ovation',   'standing-ovation', 'スタンディング', '{"duration":5000}', 1);

INSERT OR IGNORE INTO announcement_templates (id, key, config) VALUES
  ('tmpl_monthly_default', 'monthly-default', '{"slots":["intro","top3","outro"]}');
```

> **`INSERT OR IGNORE` は libSQL の標準**（SQLite 派生）。Postgres の `ON CONFLICT DO NOTHING` の代わりに使う。

---

### 4.3 Phase C: Better Auth 配線（OSS / MIT / 永続無料）

#### 4.3.1 必須依存（PRJ-017 確定バージョン）

```json
{
  "dependencies": {
    "@libsql/client": "^0.14.0",
    "drizzle-orm": "^0.45.2",
    "better-auth": "^1.6.9"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.4",
    "@better-auth/cli": "^1.4.21"
  }
}
```

**インストール時 ERESOLVE 注意**:
- Better Auth の optional peer に `@sveltejs/kit`（vite 7 系）、Next.js 16 配下が vite 8 系で衝突
- → **`npm install --legacy-peer-deps` で固定**（PRJ-015 / PRJ-016 既知ナレッジ）
- `@better-auth/cli ^1.6.9` は ETARGET（cli は別バージョン体系）→ `^1.4.21` を採用

#### 4.3.2 Better Auth adapter（`src/lib/auth/better-auth.ts`）

```ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization, magicLink, nextCookies } from 'better-auth/plugins';
import { db } from '@/lib/db/turso';
import * as schema from '@/lib/db/schema';
import { sendMagicLinkMail } from '@/lib/mail/resend';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',  // libSQL は SQLite として扱う
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: process.env.MICROSOFT_TENANT_ID,
    },
  },
  plugins: [
    organization({
      schema: {
        organization: schema.organizations,
        member: schema.orgMembers,
        invitation: schema.invitations,
      },
      // sendInvitationEmail は Resend 経由
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkMail(email, url);
      },
    }),
    nextCookies(), // Next.js 16 cookie 連携
  ],
});
```

#### 4.3.3 Route Handler（`src/app/api/auth/[...all]/route.ts`）

```ts
import { auth } from '@/lib/auth/better-auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { POST, GET } = toNextJsHandler(auth);
```

#### 4.3.4 `src/lib/auth/session.ts`（middleware 用 cookie 読み取り）

```ts
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAMES = [
  'homekoto.session_token',
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
  '__Secure-homekoto.session_token',
  'session_token',
];

export async function getSessionCookie(req: NextRequest): Promise<string | null> {
  for (const name of SESSION_COOKIE_NAMES) {
    const v = req.cookies.get(name)?.value;
    if (v) return v;
  }
  return null;
}
```

> **5 種許容の理由**: Better Auth のクッキー名は SDK バージョンと環境（`__Secure-` prefix）で複数バリエーションがあり、絞り込みは Phase 1 W4 末に Dev が「最終仕様確認後に絞る」TODO（PRJ-017 T-9）として残す運用。

---

### 4.4 Phase D: 三層認可ポート（**PATTERN-001 を必ず併用**）

詳細は `patterns/multi-tenant-three-layer-authz.md` §10「次案件への移植手順」を参照。要点だけ:

```bash
# PRJ-017 を雛形にコピー
cp $PRJ_SRC/src/proxy.ts                $PRJ_DST/src/proxy.ts
cp $PRJ_SRC/src/lib/auth/guards.ts      $PRJ_DST/src/lib/auth/guards.ts
cp $PRJ_SRC/src/lib/db/scoped.ts        $PRJ_DST/src/lib/db/scoped.ts
cp $PRJ_SRC/eslint-rules/no-raw-db.js   $PRJ_DST/eslint-rules/no-raw-db.js
cp $PRJ_SRC/tests/e2e/multitenancy.spec.ts $PRJ_DST/tests/e2e/multitenancy.spec.ts
```

`next.config.ts` に **`experimental.authInterrupts: true`** を追加（`forbidden()` / `unauthorized()` のため必須）:

```ts
const config: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
};
```

`src/app/forbidden.tsx` / `src/app/unauthorized.tsx` を必ず実装する。

---

### 4.5 Phase E: Realtime 代替 = TanStack Query Polling

Supabase Realtime → 自前 Polling に置換。PRJ-017 DEC-028 で確立した実装パターン:

`src/lib/realtime/polling.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

type PollingOptions<T> = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
  /** 状態に応じた poll interval */
  intervalMs?: number;       // 1500 (live) / 3000 (starting) / undefined (stop)
  enabled?: boolean;
};

export function useEventPolling<T>(opts: PollingOptions<T>) {
  return useQuery({
    queryKey: opts.queryKey,
    queryFn: opts.queryFn,
    refetchInterval: opts.intervalMs ?? false,
    refetchIntervalInBackground: false,  // タブ非表示で停止 → 無料枠を守る
    enabled: opts.enabled ?? true,
    staleTime: 0,
  });
}
```

使用例（月次イベント司会者状態購読）:

```ts
const phase = useEventPolling({
  queryKey: ['monthly-event', eventId, 'state'],
  queryFn: () => fetch(`/api/monthly/${eventId}/state`).then(r => r.json()),
  intervalMs: phase?.status === 'live' ? 1500 : phase?.status === 'starting' ? 3000 : undefined,
  enabled: !!eventId,
});
```

**容量計算の根拠（PRJ-017 DEC-028）**:
- 60 分 × 1,500 名 × 1.5s 間隔 = **3.6M 読取 / event**
- Turso Hobby Free 500M reads / 月の **0.7%**
- 月次イベント 1〜2 本想定なら年間でも 86M 読取（17%）に収まる

---

### 4.6 Phase F: Cloudflare R2 Storage（split bucket 構成）

PRJ-016 DEC-029 確立、PRJ-017 流用。**split → single → default のフォールバック**を必ず実装する:

`src/lib/storage/r2.ts`:

```ts
import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type BucketKind = 'audio' | 'image';

function resolveBucket(kind: BucketKind): { bucket: string; publicUrl: string } {
  // split → single → default の 3 段フォールバック
  const split = {
    audio: { bucket: process.env.R2_AUDIO_BUCKET, publicUrl: process.env.R2_AUDIO_PUBLIC_URL },
    image: { bucket: process.env.R2_IMAGE_BUCKET, publicUrl: process.env.R2_IMAGE_PUBLIC_URL },
  }[kind];
  if (split.bucket && split.publicUrl) return split as never;

  const single = process.env.R2_BUCKET_NAME;
  if (single) return { bucket: single, publicUrl: process.env.R2_PUBLIC_URL ?? `https://${single}.r2.dev` };

  throw new Error(`R2 bucket for "${kind}" is not configured`);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

/** 課金前 smoke check — DEC-029 教訓: OpenAI 呼出前に必ず通す */
export async function pingR2(kind: BucketKind): Promise<void> {
  const { bucket } = resolveBucket(kind);
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
}

export async function putR2Object(kind: BucketKind, key: string, body: Buffer | Uint8Array, contentType: string) {
  const { bucket, publicUrl } = resolveBucket(kind);
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  return { publicUrl: `${publicUrl}/${key}`, storagePath: `${bucket}/${key}` };
}

export async function presignedPutUrl(kind: BucketKind, key: string, contentType: string, expiresInSec = 600) {
  const { bucket } = resolveBucket(kind);
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: expiresInSec });
}
```

**R2 のキー規約**: `${orgId}/${resourceId}/${ulid}.${ext}` を強制（`patterns/scoped-storage-r2-keying.md` 起票予定）。テナント越境を防ぐ。

**容量実績**:
- R2 Free Tier: 10 GB 保管 + 1M Class A + 10M Class B + **Egress 完全無料**
- PRJ-016 で 480 件 / 18,834 chars TTS = ¥42 で完走、容量 < 200 MB

---

## 5. 採用案件

### 5.1 PRJ-015 Coatly（テニス部予算管理 → 他部活 SaaS 拡張）— **テンプレ起源**

- **採用形態**: 新規 / Phase 0 から Turso 採用
- **特殊事項**:
  - Better Auth 1.6.9 確定（OSS / MIT / 永続無料）
  - Drizzle libSQL adapter で `expenses` / `budgets` / `groups` 等を移植
  - 三層認可（明示ヘルパ版 = `scopedExpenses(ctx)` / `scopedBudgets(ctx)`）
  - C1〜C7 マルチテナント漏洩 E2E
- **位置**: `projects/PRJ-015/reports/dev-technical-spec-v2.md` / `research-turso-ecosystem.md`

### 5.2 PRJ-016 HANEI（小学生英検対策）— **R2 split + smoke check 確立**

- **採用形態**: 新規 / W1 から Turso 採用
- **特殊事項**:
  - PRJ-015 から踏襲 + **R2 split bucket（audio / image）**を初導入
  - **`pingR2()` smoke check で OpenAI 課金前阻止**（DEC-029）— 環境変数命名ミスマッチで R2 401 → 401 出たら exit 1 で OpenAI 呼出ゼロを実現
  - TTS バルク 480 件 / 18,834 chars / ¥42.38 で完走
- **位置**: `projects/PRJ-016/reports/dev-w3-report.md` / `decisions.md` DEC-029

### 5.3 PRJ-017 ホメコト（社内褒め活推進）— **既存 Supabase scaffold 緊急移行**

- **採用形態**: **W2 緊急移行**（Supabase → Turso 完全置換）
- **特殊事項**:
  - DEC-026 で 48h 緊急再選定 → DEC-028 で **Phase 1 全期間月次コスト ¥21.3（OpenAI 従量分のみ）に確定**
  - **書換工数 9.5〜11.5 人日見積 → 実績 4 人日で W2 計画内吸収**
  - Realtime → TanStack Query Polling（DEC-028）
  - `scopedDb(orgId)` Drizzle Proxy 方式（PRJ-015 の明示ヘルパ版から進化）
  - MT-1〜MT-7 マルチテナント漏洩 E2E
- **位置**: `projects/PRJ-017/reports/dev-w2-stack-migration.md` / `ceo-w2-stack-final-decision.md`

### 5.4 採用案件サマリー比較表

| 案件 | 移行種別 | 工数 | scopedDb 方式 | R2 構成 | コスト |
|---|---|---|---|---|---|
| PRJ-015 | 新規（Phase 0 から）| 5 人日 | 明示ヘルパ | single | OpenAI のみ |
| PRJ-016 | 新規（W1 から）| 4 人日 | 明示ヘルパ | **split + ping** | OpenAI のみ |
| PRJ-017 | **既存→緊急移行** | **4 人日** | **Drizzle Proxy** | split + ping | **¥21.3/月確定** |

---

## 6. トレードオフ

### 6.1 採用しない方が良いケース

| 状況 | 理由 |
|---|---|
| **Supabase Realtime に深く依存**（タイピング表示・カーソル同期等の即応 UX）| Polling では UX が劣化。SSE / WebSocket 別建ての追加工数が +3〜5 人日 |
| **pgvector / pgrouting / postgis 等 Postgres 拡張に依存** | libSQL では代替不可。サードパーティ vector DB（Pinecone / Qdrant）併用が必要 |
| **既存 Supabase RLS 数十ポリシー**で運用中 | RLS → アプリ層三層認可ポートの工数が利益を上回る可能性。既存案件の途中移行は慎重に |
| **TPS / 同時接続数が桁違い** | SQLite 系は書き込み並列度に上限。Postgres + 専用 DBA 体制の方が現実的 |
| **マルチリージョン書き込み必須** | libSQL もエッジレプリカは可能だが、フル Postgres の方が成熟 |

### 6.2 既知のトレードオフ

| 項目 | 影響 | 緩和策 |
|---|---|---|
| **JSONB のクエリ性能劣化** | libSQL の TEXT JSON は GIN index 不可、JSON 経路の WHERE が遅い | アプリ層フィルタ + `(orgId, kind)` 複合 index で高速化 |
| **TIMESTAMPTZ 喪失** | タイムゾーン情報がアプリ層責任に | `Date.now()` で epoch ms 統一、表示時のみ TZ 変換 |
| **CREATE POLICY 喪失** | RLS 不在 → 認可漏れの致命リスク | **PATTERN-001 三層認可を必ず併用**（ESLint `no-raw-db` で物理強制）|
| **Better Auth クッキー名揺れ** | SDK バージョンで cookie 名が変わる | middleware で 5 種許容 → 安定化後に絞る |
| **Realtime 喪失（Polling 化）**| 1.5s 遅延体感 | UX 演出側で吸収（PRJ-017 月次ホタル演出は「ため」を演出に転化）|
| **Turso Free の上限**| 5GB / 500M reads / 10M writes / 月 | Phase 2 で MAU 200+ になったら有償化（Hobby+ $29/月）|

### 6.3 永続無料の継続条件

PRJ-017 DEC-028 が確立した「永続無料厳守 6 ベンダー分散」の条件:

| ベンダー | 無料枠 | 有償化トリガー |
|---|---|---|
| Turso Hobby | 5GB / 500M reads / 10M writes | MAU 200+ or 月次 reads 400M+ |
| Better Auth | OSS / MIT / 永続無料 | なし（自前ホスト）|
| Cloudflare R2 | 10GB / 1M Class A / 10M Class B / Egress 無料 | 容量 8GB 接近 |
| Resend Free | 3,000 メール/月 | 公開β 50 社（≒ 月 2,400 メール）想定では到達しない |
| Sentry Developer | 5,000 errors/月 | エラー多発時のみ |
| Vercel Hobby | 100 GB-Hours / 100 GB Bandwidth | MAU 200+ |

**監視**: 各ベンダーの Usage ページを月初に確認するチェックリストを `checklists/turso-stack-monthly-check.md` に起票予定。

---

## 7. アンチパターン

### 7.1 「Postgres スキーマをそのままコピペして migrate」

```sql
-- ANTI-PATTERN（libSQL でエラー）
CREATE TABLE praises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- libSQL は UUID 型なし、関数なし
  body JSONB NOT NULL,                              -- libSQL は JSONB なし
  created_at TIMESTAMPTZ DEFAULT NOW()              -- libSQL は TIMESTAMPTZ なし
);
CREATE POLICY org_isolation ON praises USING (...); -- libSQL は CREATE POLICY なし
```

**正しい形**: 4.2.1 の変換規則を**機械的に**全カラムに適用する。Drizzle スキーマで一度書けば SQL は drizzle-kit が出してくれる。

### 7.2 「scopedDb を実装せずに Drizzle 直叩きで本番へ」

RLS が消えたのに `db.select().from(praises).where(...)` を Server Action 内で書く → テナント越境一発で漏洩。**ESLint `no-raw-db` を CI で error にしないと再発する**。PATTERN-001 §4.4 を必ず参照。

### 7.3 「Realtime 喪失を WebSocket 自前実装で埋める」

Supabase Realtime → Vercel WS / Pusher / Ably の自前置換は **無料枠抵触リスク**が高い（PRJ-017 DEC-028 検討済）。Polling で十分な要件か必ず先に検証する。Polling で遅延を吸収できる UX 設計は Marketing / Designer と早期合意。

### 7.4 「OpenAI / TTS の課金トリガーを R2 ping より先に置く」

PRJ-016 DEC-029 教訓: R2 環境変数命名ミスマッチで PUT 401 → 既に OpenAI 課金が走った後では手遅れ。**`pingR2()` を必ず OpenAI 呼出前に置く**。バルクスクリプトの先頭 30 行で全外部依存（OpenAI key / R2 ping / DB 接続）を smoke check する設計が必須。

### 7.5 「Better Auth の cookie 名を 1 種に絞ったまま deploy」

SDK upgrade で cookie 名が変わると middleware が無認証扱い → 全ユーザー sign-in 画面に飛ばされる事故。**最初は 5 種許容で deploy → ログで実発生 cookie 名を確認 → 絞る**の段階を必ず踏む。

---

## 8. 検証方法

### 8.1 schema 移植検証

```bash
# 1) drizzle-kit が SQL を吐けるか
npx drizzle-kit generate

# 2) ローカル file DB に push
TURSO_DATABASE_URL=file:./local.db npx drizzle-kit push

# 3) sqlite3 CLI で table 一覧確認
sqlite3 ./local.db ".tables"
sqlite3 ./local.db ".schema praises"
```

### 8.2 Better Auth smoke test

```bash
# OAuth コールバック URL 動作確認
curl -i http://localhost:3000/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Password123!"}'

# 期待: 200 + Set-Cookie に session_token
```

### 8.3 三層認可検証（PATTERN-001 §8 を参照）

- `src/lib/auth/guards.test.ts`（PRJ-017 で 9 cases）
- `src/lib/db/scoped.test.ts`（PRJ-017 で 5 cases）
- `tests/e2e/multitenancy.spec.ts`（MT-1〜MT-7 = 7 cases）

### 8.4 Polling 動作検証

```bash
# Vercel preview deploy 後
# 1) ブラウザで /dashboard/events/{id} を開く → DevTools Network で /api/monthly/.../state が 1.5s 間隔で叩かれることを確認
# 2) タブを非アクティブにする → polling 停止を確認（refetchIntervalInBackground: false）
# 3) Turso Dashboard で reads が想定通り（60min × N 名 = 4N reads/sec）であることを確認
```

### 8.5 R2 smoke check 検証

```bash
# pingR2 が動くか
node -e "
import('./src/lib/storage/r2.ts').then(async m => {
  await m.pingR2('audio');
  console.log('audio bucket OK');
  await m.pingR2('image');
  console.log('image bucket OK');
});
"
# 401 や 404 が出たら IAM スコープ / バケット名を見直す
```

### 8.6 移行受入チェックリスト（10 項目）

| # | 項目 | 確認方法 |
|---|---|---|
| 1 | Turso DB が Tokyo region で作成されている | `turso db show <name>` |
| 2 | `drizzle-kit push` が成功する | 上記 8.1 |
| 3 | Better Auth で email/password sign-up が成功する | 上記 8.2 |
| 4 | Better Auth Google OAuth が成功する | ブラウザ手動 |
| 5 | `requireOrgScope(orgId)` が forbidden を投げる（非メンバー時）| guards.test.ts |
| 6 | `scopedDb(orgId).select().from(table)` の SQL に `organization_id = ?` が含まれる | scoped.test.ts |
| 7 | ESLint `no-raw-db` が CI で error する | `npm run lint` |
| 8 | MT-1〜MT-7 の 7 ケースすべて pass | Playwright |
| 9 | `pingR2('audio')` / `pingR2('image')` が成功する | 上記 8.5 |
| 10 | Vercel preview deploy で全 page が 200 を返す | curl smoke |

---

## 9. 関連パターン・関連ナレッジ

### 9.1 関連パターン

- **PATTERN-001（マルチテナント三層認可）— 必須併用**: `patterns/multi-tenant-three-layer-authz.md`
- **PATTERN-002（AI 組織並列実装プレイブック）**: `patterns/ai-org-parallel-implementation-playbook.md`
- **PATTERN-004（AI 三層ガード）**: `patterns/ai-three-layer-guard.md`（同 Phase C 第 1 弾）
- **PATTERN-005（AI コスト管理プレイブック）**: `playbooks/ai-cost-management.md`（同 Phase C 第 1 弾）
- 起票予定: `patterns/scoped-storage-r2-keying.md`（R2 キー規約）

### 9.2 関連 ADR / 決裁

- PRJ-017 **DEC-026**: Supabase → Turso 48h 緊急再選定発令
- PRJ-017 **DEC-028**: W2 スタック最終確定（Turso + Better Auth + Polling + R2、月¥21.3 確定）
- PRJ-016 **DEC-029**: R2 環境変数命名フォールバック + pingR2 smoke check 導入
- PRJ-015 設計: `dev-technical-spec-v2.md` / `research-turso-ecosystem.md`

### 9.3 関連 Lessons Learned

- 起票予定: `lessons-learned/prj-017-stack-migration.md`（4 人日吸収のキー教訓）
- 起票予定: `lessons-learned/prj-016-r2-pingcheck.md`（課金前 smoke check の汎用化）

### 9.4 関連 Checklist

- 起票予定: `checklists/turso-stack-monthly-check.md`（無料枠監視月次チェック 6 項目）
- 起票予定: `checklists/turso-migration-readiness.md`（移行前 10 項目）

### 9.5 関連 tech-research

- `tech-research-hono-drizzle.md` — Drizzle ORM 適合性評価（Hono RPC 併設の選択肢）

---

## 10. 次案件への移植手順（`cp -r` 出発点）

### Step 1: PRJ-017 を雛形元として全コピー

```bash
PRJ_SRC=projects/PRJ-017/app
PRJ_DST=projects/PRJ-XXX/app

# DB / Auth / Storage / Polling 中核 10 ファイル
cp $PRJ_SRC/src/lib/db/turso.ts            $PRJ_DST/src/lib/db/turso.ts
cp $PRJ_SRC/src/lib/db/schema/auth.ts      $PRJ_DST/src/lib/db/schema/auth.ts
cp $PRJ_SRC/src/lib/db/schema/org.ts       $PRJ_DST/src/lib/db/schema/org.ts
cp $PRJ_SRC/src/lib/auth/better-auth.ts    $PRJ_DST/src/lib/auth/better-auth.ts
cp $PRJ_SRC/src/lib/auth/session.ts        $PRJ_DST/src/lib/auth/session.ts
cp $PRJ_SRC/src/app/api/auth/[...all]/route.ts $PRJ_DST/src/app/api/auth/[...all]/route.ts
cp $PRJ_SRC/src/lib/storage/r2.ts          $PRJ_DST/src/lib/storage/r2.ts
cp $PRJ_SRC/src/lib/realtime/polling.ts    $PRJ_DST/src/lib/realtime/polling.ts
cp $PRJ_SRC/src/lib/mail/resend.ts         $PRJ_DST/src/lib/mail/resend.ts
cp $PRJ_SRC/drizzle.config.ts              $PRJ_DST/drizzle.config.ts
cp $PRJ_SRC/.env.local.example             $PRJ_DST/.env.local.example

# PATTERN-001 三層認可 5 ファイル（同時に必須）
cp $PRJ_SRC/src/proxy.ts                   $PRJ_DST/src/proxy.ts
cp $PRJ_SRC/src/lib/auth/guards.ts         $PRJ_DST/src/lib/auth/guards.ts
cp $PRJ_SRC/src/lib/db/scoped.ts           $PRJ_DST/src/lib/db/scoped.ts
cp $PRJ_SRC/eslint-rules/no-raw-db.js      $PRJ_DST/eslint-rules/no-raw-db.js
cp $PRJ_SRC/tests/e2e/multitenancy.spec.ts $PRJ_DST/tests/e2e/multitenancy.spec.ts
```

### Step 2: ドメイン用語の置換

| PRJ-017 用語 | 案件用語に置換（例 PRJ-XXX）|
|---|---|
| `homekoto` | `<案件名>` |
| `praises` / `praise_attachments` | 案件業務テーブル |
| `monthly_events` / `ai_announcements` | 案件固有のイベント表 |
| `R2_AUDIO_BUCKET` / `R2_IMAGE_BUCKET` | 案件のメディア種別に合わせ追加 |

### Step 3: Turso DB 作成 + db:push

```bash
turso db create <案件名>-prod --location nrt
turso db tokens create <案件名>-prod --expiration none
# .env.local に TURSO_DATABASE_URL / TURSO_AUTH_TOKEN を設定
npx drizzle-kit push
```

### Step 4: Better Auth secret + OAuth 発行

```bash
openssl rand -base64 32  # → BETTER_AUTH_SECRET

# Google: https://console.cloud.google.com/apis/credentials
# Microsoft: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps
# コールバック URL: ${BETTER_AUTH_URL}/api/auth/callback/{provider}
```

### Step 5: R2 bucket（split）+ Resend ドメイン認証

```bash
# Cloudflare Dashboard → R2 → 2 bucket を作成（audio / image）
# 各 bucket に public access 設定 + custom domain 紐付け（任意）
# IAM: R2 access key 発行 → R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY

# Resend: https://resend.com → ドメイン追加 → SPF/DKIM 設定
```

### Step 6: 三層認可 + ESLint 設定統合（PATTERN-001 §10 参照）

### Step 7: 受入チェックリスト（§8.6）10 項目を全 pass で完了

---

## 11. 移植所要時間の見積もり

PRJ-017 W2 実績（Supabase scaffold → Turso 完全置換）:

| 工程 | 工数（人日）|
|---|---|
| 依存・環境セットアップ（peer dep / cli バージョン解決含む）| 0.4 |
| schema 移植 + drizzle migration（20 表 + seed）| 1.0 |
| Better Auth 統合（adapter / handler / org / magicLink / login form 改修）| 0.8 |
| 三層認可（middleware / guards / scopedDb / ESLint rule）| 0.8 |
| R2 + Resend + Polling ライブラリ | 0.4 |
| テスト（guards 9 / scoped 5 / 既存維持確認）| 0.4 |
| lint / typecheck / 動作確認 / レポート | 0.2 |
| **合計** | **4.0 人日** |

**3〜4 人日が次案件の標準工数**:
- libSQL 移植 = 1 人日
- 三層認可ポート = 0.8〜1 人日（PATTERN-001 § 11 と整合）
- Better Auth 配線 = 0.8 人日
- R2 + Resend + Polling = 0.4 人日
- テスト + lint = 0.4〜0.6 人日
- レポート = 0.2 人日

**新規案件**（Phase 0 から Turso 採用 = PRJ-015 / PRJ-016 形）なら **更に 0.5〜1 人日短縮**できる（Supabase 経由しないため schema を一発で書ける）。

---

## 12. 改訂履歴

| 日付 | 版 | 改訂内容 | 起草 |
|---|---|---|---|
| 2026-04-28 | v1.0 | 初版起票（PRJ-015/016/017 の横断抽出、CEO DEC-003 Phase C 第1弾）| dev |

---

## 13. 参考文献・一次ソース

- `projects/PRJ-015/reports/dev-technical-spec-v2.md`
- `projects/PRJ-015/reports/research-turso-ecosystem.md`
- `projects/PRJ-016/reports/dev-w3-report.md`
- `projects/PRJ-016/decisions.md` DEC-029（R2 命名フォールバック + pingR2）
- `projects/PRJ-017/reports/dev-w2-stack-migration.md` §1〜§7
- `projects/PRJ-017/reports/ceo-w2-stack-final-decision.md`
- `projects/PRJ-017/decisions.md` DEC-026 / DEC-028
- `organization/knowledge/patterns/multi-tenant-three-layer-authz.md`（必須併用）
- `organization/knowledge/tech-research-hono-drizzle.md`（Drizzle 評価）
- Better Auth: https://www.better-auth.com/docs
- Turso: https://docs.turso.tech/
- Drizzle ORM: https://orm.drizzle.team/
- Cloudflare R2: https://developers.cloudflare.com/r2/
