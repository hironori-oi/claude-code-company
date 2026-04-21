# PRJ-012 v1.1 / PM-938 — Welcome Wizard 撤去 + Claude 認証自動検出

- **種別**: dev / startup flow 改善
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`
- **対象バージョン**: v1.1 (pre-release)
- **担当**: dev
- **実装日**: 2026-04-20
- **工数**: 約 1.5h

---

## 1. サマリー

v1.0 まで毎回表示されていた 5 ステップ Welcome Wizard (`/setup`) を撤去し、`~/.claude/.credentials.json` の OAuth token を起動時に Rust 側で自動検出して `/workspace` に直遷移する方式に切替えた。未ログイン時は workspace を表示しつつ `toast.warning` で `claude login` を案内する（UI を block しない）。

| 指標 | Before | After |
| ---- | ------ | ----- |
| 起動から workspace 到達までのクリック | 1 + Wizard 5 ステップ (最短 5 クリック) | 0 クリック（自動） |
| 未ログイン時の導線 | Wizard 内 API Key 入力 / OAuth / Skip | Workspace + toast + 設定タブへの action button |
| アプリ内 OAuth flow の実装 | あり（verifyApiKey 等） | なし（CLI `claude login` に委譲） |
| ルート構成 | `/` (Welcome), `/setup`, `/setup/done`, `/workspace` | `/` (redirect), `/workspace` |

---

## 2. Before / After フロー図

### Before (v1.0)

```
[App 起動]
    ↓
[GET /] Welcome カード（3 機能 + 「始める」）
    ↓ 「始める」クリック
[GET /setup]
    ├── Step 1: BrandIntroStep
    ├── Step 2: ApiKeyStep (OAuth / API Key / Skip)
    ├── Step 3: FirstProjectStep (claude-code-company 検出 or 自分フォルダ or Skip)
    ├── Step 4: PermissionsStep
    └── Step 5: SampleProjectStep (onComplete → router.push("/workspace"))
    ↓
[GET /workspace]
```

→ 再ログイン済みユーザーでも毎回 5 ステップ通過が必要。

### After (v1.1)

```
[App 起動]
    ↓
[GET /]
    ↓ invoke("check_claude_authenticated")  ─── Rust: ~/.claude/.credentials.json 判定
    ↓
    ├─ Authenticated              → router.replace("/workspace") (silent)
    ├─ NotFound / TokenMissing    → router.replace("/workspace") + toast.warning
    │                                  ├─ description: "claude login を実行してください"
    │                                  ├─ duration: 10s
    │                                  └─ action: "設定を開く" → /settings
    └─ invoke 失敗 (dev 単体等)    → router.replace("/workspace") fallback
    ↓
[GET /workspace]
```

→ 認証済みなら 0 クリック、未認証でもアプリは使える状態で案内だけする。

---

## 3. Rust 実装

### 3.1 追加: `check_claude_authenticated` (+ 共通 helper)

**File**: `src-tauri/src/commands/oauth_usage.rs`

既存 `read_access_token` が持っていた「HOME/USERPROFILE 分岐 + `~/.claude/.credentials.json` パス組立」を `credentials_path()` に切り出し、新 command から再利用して重複を無くした。

```rust
fn credentials_path() -> Result<PathBuf, String> {
    let home = if cfg!(windows) {
        std::env::var("USERPROFILE")...
    } else {
        std::env::var("HOME")...
    };
    Ok(PathBuf::from(home).join(".claude").join(".credentials.json"))
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum AuthStatus {
    Authenticated,
    NotFound,
    TokenMissing,
}

#[tauri::command]
pub fn check_claude_authenticated() -> Result<AuthStatus, String> {
    let path = match credentials_path() {
        Ok(p) => p,
        Err(_) => return Ok(AuthStatus::NotFound),
    };
    if !path.exists() {
        return Ok(AuthStatus::NotFound);
    }
    let content = match std::fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return Ok(AuthStatus::TokenMissing),
    };
    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Ok(AuthStatus::TokenMissing),
    };
    let token = json
        .pointer("/claudeAiOauth/accessToken")
        .and_then(|v| v.as_str())
        .or_else(|| json.pointer("/access_token").and_then(|v| v.as_str()))
        .filter(|s| !s.is_empty());
    if token.is_some() { Ok(AuthStatus::Authenticated) } else { Ok(AuthStatus::TokenMissing) }
}
```

### 3.2 セキュリティ方針（既存 oauth_usage.rs と整合）

- token 文字列は**戻り値に入れない**（enum のみ）
- Err メッセージにも token を混ぜない（JSON parse 失敗等も `TokenMissing` に寄せる）
- Network I/O なし（pure local file read）

### 3.3 Serialization 仕様

`#[serde(rename_all = "PascalCase")]` を付けて、frontend から見た文字列を `"Authenticated" | "NotFound" | "TokenMissing"` に固定した（Tauri の default な `{"Authenticated": null}` 形式を避ける）。

### 3.4 テスト追加

`oauth_usage.rs` の `#[cfg(test)] mod tests` に 4 ケース追加（既存 5 → 9）:

| テスト名 | 検証内容 |
| --- | --- |
| `auth_status_serializes_as_pascal_string` | 3 variant が `"Authenticated"` / `"NotFound"` / `"TokenMissing"` に正しく string 化される |
| `auth_status_roundtrip` | `serde_json::to_string` → `from_str` で値が保たれる |
| `token_extraction_mirror_authenticated_path` | `claudeAiOauth.accessToken` 非空で Authenticated 判定に相当 |
| `token_extraction_mirror_empty_is_missing` | accessToken 空文字列は TokenMissing 判定に相当 |
| `token_extraction_mirror_legacy_fallback` | 旧 `access_token` top-level key も fallback で拾う |

`cargo test --lib` 結果: **105 passed; 0 failed**（既存 101 から +4）。

### 3.5 lib.rs への登録

```rust
// import
oauth_usage::{check_claude_authenticated, get_oauth_usage, OAuthUsageCache},

// invoke_handler
get_oauth_usage,
// PRJ-012 v1.1 / PM-938 (2026-04-20): Welcome Wizard 撤去後の起動時
// 認証自動検出。`~/.claude/.credentials.json` の claudeAiOauth.accessToken
// の有無だけを返す（network I/O なし、token 文字列は戻さない）。
check_claude_authenticated,
```

---

## 4. Frontend 実装

### 4.1 `app/page.tsx` 全面書換え

Welcome カードを削除し、`useEffect` 内で `callTauri("check_claude_authenticated")` を呼んで結果に応じて redirect + toast を行う redirect-only ページに変更した。

```tsx
type AuthStatus = "Authenticated" | "NotFound" | "TokenMissing";

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await callTauri<AuthStatus>("check_claude_authenticated");
        if (cancelled) return;
        if (status !== "Authenticated") {
          showLoginPrompt(status, router);
        }
      } catch (e) {
        logger.warn("check_claude_authenticated failed", e);
      } finally {
        if (!cancelled) router.replace("/workspace");
      }
    })();
    return () => { cancelled = true; };
  }, [router]);
  return null;  // redirect 中は何も出さない（flash 防止）
}
```

### 4.2 Toast 通知 UX 設計

| 項目 | 値 | 根拠 |
| ---- | --- | ---- |
| level | `toast.warning` | error ではない（致命的でない）、info より目立つべき |
| title | `"Claude にログインしていません"` | 状態の明示 |
| description | `"~/.claude/.credentials.json が見つかりません。ターミナルで \`claude login\` を実行してください。"` (NotFound 時) / `"OAuth token が取得できませんでした。..."` (TokenMissing 時) | 具体的コマンドを示す |
| duration | `10_000` (10 秒) | 気づかず消えない、かつ永続ではない（UI を占有しない） |
| action | `"設定を開く"` → `router.push("/settings")` | API Key を直接入力したいユーザーへの即応導線 |

**検討した別案 (不採用)**:
- ターミナル action: `viewMode: "terminal"` 切替 + `pty_spawn` で `claude login` 起動 → OAuth flow は browser を開くので pty 内で完結せず、かえって混乱を招く。ユーザーが自分の慣れたターミナルで打つ方が確実。
- banner 方式: workspace top に永続表示 → UI 領域を占有する上に dismiss state 管理が必要で、非侵襲原則に反する。

### 4.3 logger / toast import パターン

既存 UpdateNotifier.tsx の `toast(...)` + `action: { label, onClick }` パターンを踏襲。`logger.warn` は PM-746 wrapper 経由（production でも出力される warn レベル）。

---

## 5. 削除 file 一覧 + 依存検証

### 5.1 削除したファイル

| Path | 行数 | 削除理由 |
| ---- | ---- | -------- |
| `app/setup/page.tsx` | 419 | Wizard エントリ（5 ステップ UI） |
| `app/setup/done/page.tsx` | 32 | Wizard 完了画面 |
| `app/setup/` (dir 全体) | — | 上 2 ファイルの親 |
| `components/onboarding/WelcomeWizard.tsx` | 131 | Wizard 本体 |
| `components/onboarding/WizardStep.tsx` | — | Wizard 共通 step wrapper |
| `components/onboarding/BrandIntroStep.tsx` | — | Step 1 |
| `components/onboarding/ApiKeyStep.tsx` | 222 | Step 2（OAuth URL 開く + API Key 保存 + 疎通確認） |
| `components/onboarding/PermissionsStep.tsx` | — | Step 3 |
| `components/onboarding/SampleProjectStep.tsx` | — | Step 4 |
| `tests/e2e/welcome.spec.ts` | 35 | Welcome カード E2E（対象 UI が消滅） |
| `tests/e2e/setup-api-key.spec.ts` | 82 | Setup Wizard E2E（対象 UI が消滅） |

### 5.2 残置した onboarding ファイル

- `components/onboarding/HelloBubble.tsx` — 初回訪問時の挨拶吹き出し（workspace 上に重ねる独立 overlay）。Wizard とは別概念なので残置。`app/(workspace)/workspace/page.tsx` からの import 継続。

### 5.3 依存検証（grep で参照 0 確認済）

削除前後で検索:
```
pattern: WelcomeWizard|WizardStep|BrandIntroStep|ApiKeyStep|PermissionsStep|SampleProjectStep|/setup|app/setup
```

残存するヒット:
- `app/page.tsx:17-18` — Before 節のドキュメントコメント内で `/setup` に言及（意図的、変更履歴として残す）
- `components/settings/ApiKeySettings.tsx:37, 264` — コメント内で旧 ApiKeyStep と同等ロジックを維持している旨の参照（副作用なし）
- `components/preview/PreviewPane.tsx:100` — コメント内の参考記述
- `.github/workflows/*.yml` — `actions/setup-node`（別概念、無関係）
- `README.md` — 「onboarding/ — HelloBubble」に書換え済

削除対象 component を実コードから import している file は **0 件**。

### 5.4 ApiKeyStep の機能継承確認

`ApiKeyStep` が持っていた機能（OAuth URL 起動 / API Key keyring 保存 / 接続テスト）は**すべて `components/settings/ApiKeySettings.tsx` に既に存在**。ApiKeyStep のコメント (`"ApiKeyStep と同じロジック"`) に記された通り、Settings > API Key タブで同等操作が可能。toast の action button「設定を開く」が `/settings` に導線を張っている。

### 5.5 SampleProjectStep / FirstProjectStep の機能継承確認

プロジェクト登録は Sidebar の「+ プロジェクト追加」から可能（既存 UI、`useProjectStore.registerProject` 呼出）。`FirstProjectStep` が持っていた claude-code-company 自動検出は **起動時の自動登録は行わない方針 (DEC-031)** を踏襲しているため、Sidebar から手動選択の動線で十分。SampleProjectStep の node-hello / python-hello サンプルは再利用頻度が低く、Wizard 撤去に伴い撤去（必要なら Settings > Plugins 的な別箇所で提供検討）。

---

## 6. 検証結果

| コマンド | 結果 |
| -------- | ---- |
| `cargo check` (src-tauri) | **0 error**（既存 dead-code warning 3 件は本 round 無関係） |
| `cargo test --lib` (src-tauri) | **105 passed; 0 failed**（+4 新規テスト） |
| `npx tsc --noEmit` | **0 error** |
| `npx next build` | **成功**、Route 構成: `/`, `/_not-found`, `/settings`, `/settings/mcp`, `/workspace` (`/setup` が消滅したことを確認) |

---

## 7. オーナー実機検証手順

**前提**: PC に Claude Code CLI が入っていること。

### 7.1 認証済み (Claude Max ログイン済) の場合

1. ターミナルで `claude login` 済 (`~/.claude/.credentials.json` が存在)
2. `cd C:\Users\hiron\Desktop\ccmux-ide-gui`
3. `npm run tauri:dev` でアプリ起動
4. **期待**:
   - Welcome カードが表示**されない**
   - アプリ起動後、即 workspace（3 ペイン UI）に遷移
   - toast は表示**されない**

### 7.2 未ログインの場合

1. `~/.claude/.credentials.json` を一時的に rename (e.g. `.credentials.json.bak`)
2. `npm run tauri:dev` でアプリ起動
3. **期待**:
   - Welcome カードが表示**されない**
   - 即 workspace に遷移
   - 右下に toast（warning 色）:
     - タイトル: `Claude にログインしていません`
     - 説明: `~/.claude/.credentials.json が見つかりません。ターミナルで \`claude login\` を実行してください。`
     - 「設定を開く」ボタンあり
     - 10 秒後に自動で消える
4. 「設定を開く」クリック → `/settings` に遷移、API Key タブで直接入力可能
5. 検証後、rename を戻す

### 7.3 token 空 (TokenMissing) の場合（任意）

1. `~/.claude/.credentials.json` を `{ "claudeAiOauth": { "accessToken": "" } }` に書換え
2. アプリ起動
3. **期待**:
   - workspace 遷移 + toast
   - 説明文: `OAuth token が取得できませんでした。ターミナルで \`claude login\` を再実行してください。`

### 7.4 `/setup` 直打ち（404 確認）

1. アプリ起動後、URL 欄は無いので DevTools Console から:
   ```js
   window.location.href = '/setup'
   ```
2. **期待**: 404 (Next.js `_not-found` が表示される)

---

## 8. 注意事項・既知の制約

- **Rust 変更あり** → 初回 `tauri:dev` / `tauri:build` で rebuild が走る。
- `app/page.tsx` は `"use client"` + `useRouter` のため SSR されない（Tauri webview は静的 export を読む、問題なし）。
- CI / E2E: `welcome.spec.ts` / `setup-api-key.spec.ts` を削除したため、Playwright suite のテスト数が 2 件減る（他 spec に影響なし、helper の `hasSeenWelcome` 抑制は HelloBubble 用として残置）。
- `check_claude_authenticated` は token の**有効性 (期限)** までは確認しない（ファイル有無 + JSON 形状のみ）。期限切れは従来通り `/api/oauth/usage` の 401 応答で判明する（既存 `get_oauth_usage` のエラーメッセージ「OAuth token が期限切れ / 無効です。`claude login` で再認証してください。」）。
- `HelloBubble` は v1.0 と同じく workspace 初回訪問時に出る（`localStorage.hasSeenWelcome`）、Wizard 撤去とは独立。

---

## 9. 変更ファイル一覧

### 変更

- `src-tauri/src/commands/oauth_usage.rs` — `credentials_path()` / `AuthStatus` / `check_claude_authenticated` 追加 + テスト 4 件
- `src-tauri/src/lib.rs` — `check_claude_authenticated` を import + invoke_handler に登録
- `app/page.tsx` — Welcome カードを auto-detect redirect に全面書換え
- `README.md` — onboarding ディレクトリ説明を更新 / app ルート構成を更新

### 削除

- `app/setup/page.tsx`
- `app/setup/done/page.tsx`
- `app/setup/` (dir)
- `components/onboarding/WelcomeWizard.tsx`
- `components/onboarding/WizardStep.tsx`
- `components/onboarding/BrandIntroStep.tsx`
- `components/onboarding/ApiKeyStep.tsx`
- `components/onboarding/PermissionsStep.tsx`
- `components/onboarding/SampleProjectStep.tsx`
- `tests/e2e/welcome.spec.ts`
- `tests/e2e/setup-api-key.spec.ts`

### 維持

- `components/onboarding/HelloBubble.tsx` — workspace 初回訪問の挨拶吹き出し（Wizard と独立）
- `components/settings/ApiKeySettings.tsx` — 旧 ApiKeyStep 相当の機能は Settings > API Key タブが保有（削除なし、toast action の遷移先）

---

## 10. CEO 向けサマリー

- **完了条件** すべて達成: Wizard 表示なし / 認証済は即 workspace / 未認証は workspace + toast 案内 / `cargo check` + `cargo test --lib` + `tsc --noEmit` + `next build` すべて成功
- **最小 diff 原則** 遵守: 既存の `read_access_token` 実装から `credentials_path()` helper を切り出して再利用（新規ロジック重複なし）
- **セキュリティ**: token 文字列は enum-only で frontend に渡さない（既存 oauth_usage.rs と整合）
- **UX 改善**: 再起動ごとの 5 クリック Wizard 通過 → 0 クリックで workspace 到達、未ログイン時も UI を block しない
- **実機検証手順** 整備済（§7）
