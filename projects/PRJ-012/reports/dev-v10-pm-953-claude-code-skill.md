# dev-v10 / PM-953 — Claude Code Skill 機能 (Phase 1 / v1.3 MVP)

- **案件**: PRJ-012 ccmux-ide-gui v1.3
- **タスク**: PM-953 — Claude Code skill discovery & SlashPalette 表示
- **担当**: dev
- **日付**: 2026-04-20
- **対象ブランチ**: main
- **対象リポジトリ**: `C:\Users\hiron\Desktop\ccmux-ide-gui\`

## 1. 技術調査結果

### 1.1 Claude Code skill の公式仕様

Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) の型定義を精査した結果、
skill は **公式に first-class な機能** として SDK に組み込まれていることを確認。

**On-disk format（公式仕様）**:

```
~/.claude/skills/<skill-name>/SKILL.md      # Global (user-level)
<project>/.claude/skills/<skill-name>/SKILL.md  # Project-level
```

- 各 skill は **ディレクトリ** であり、その中の `SKILL.md` が metadata + 本文を持つ
- Anthropic SDK (`@anthropic-ai/sdk/src/resources/beta/skills/versions.ts`) のコメントに
  「This is extracted from the SKILL.md file in the skill upload」と明記あり
- frontmatter フィールドは **`name`** と **`description`** の 2 つ（公式確認済）
- Beta ヘッダは `anthropic-beta: skills-2025-10-02`

### 1.2 Claude Agent SDK の skill サポート

sidecar が同梱する `@anthropic-ai/claude-agent-sdk/sdk.d.ts` で `skill` をキーワード検索
した結果、以下の関連 API が存在:

| API | 用途 |
|---|---|
| `AgentDefinition.skills?: string[]` | agent context に preload する skill 名リスト |
| `SDKControlSession.supportedCommands(): Promise<SlashCommand[]>` | session で利用可能な skill/command 一覧 |
| `SKDControlInitializeResponse.skills: string[]` | init 時点で読み込まれた skill ID |
| `Settings.source: 'skills'` | 設定ソース識別子（user / project / plugin と同列） |
| `SDKControlGetContextUsageResponse.skills.skillFrontmatter[]` | context 占有 token 数の skill 別内訳 |
| `skillListingMaxDescChars` / `skillListingBudgetFraction` / `skillOverrides` | listing の挙動チューニング |
| `disableSkillShellExecution?: boolean` | skill 内 shell 実行の無効化 |

**結論**: sidecar が起動する Claude Agent SDK は **session 開始時に `~/.claude/skills/` を
自動走査して認識する**。つまり ccmux-ide-gui 側で明示的に load / register する必要はない。
ユーザー視点では「`~/.claude/skills/<name>/SKILL.md` を配置すれば次回 session から
自動で Claude が認識」という挙動になる。

### 1.3 ccmux-ide-gui での実装指針

上記から、**Phase 1 (v1.3 MVP)** では以下に徹する:

- ファイルシステムを独立に走査し、SlashPalette 上に skill 一覧を **可視化** する
- 選択時は SKILL.md を Monaco で preview（編集可能）
- 「実行」「invoke」の UI トリガは **敢えて提供しない**
  （SDK が自動読込するため、UI からの明示的 trigger は不要。むしろ
  実態と乖離するリスクを避ける）

Phase 2 以降の拡張オプション（本 Chunk では着手せず）:

- sidecar 経由で `supportedCommands()` を取得し、「実際に SDK が認識している skill」
  と「ディスクに置かれている skill」の diff を UI に出す
- `AgentDefinition.skills` preload 設定 UI
- skill 別 enable/disable toggle (`skillOverrides`)

## 2. Phase 1 実装内容

### 2.1 Rust 新規 command

**新規ファイル**: `C:\Users\hiron\Desktop\ccmux-ide-gui\src-tauri\src\commands\skills.rs`

- `SkillDef` struct (camelCase serialize): `name` / `description` / `source` /
  `filePath` / `dirPath`
- `list_skills(project_path: Option<String>)` tauri command:
  `~/.claude/skills/<name>/SKILL.md` + `<project>/.claude/skills/<name>/SKILL.md`
  + cwd chain を走査
- 重複解決は slash.rs と同じ rule: **cwd > project > global**（近い方が勝つ）
- frontmatter parser は slash.rs の簡易 YAML-like parser を流用（`serde_yaml` 依存追加なし）
- SKILL.md が無いサブディレクトリ / hidden dir (`.cache` 等) / 非 dir エントリはスキップ
- `Skill.md` / `skill.md` などの大文字違い fallback を cross-platform 配慮で追加

**登録**:
- `src-tauri/src/commands/mod.rs` に `pub mod skills;` を末尾 append
- `src-tauri/src/lib.rs` の `use commands::{ ... }` に `skills::list_skills` 追加
- `invoke_handler!` macro に `list_skills` 登録

**単体テスト**: 8 件（全 pass）
- frontmatter 解析（name + description 抽出）
- frontmatter 欠落時の空返却
- 本文 1 行目 heading を description に fallback
- `SKILL.md` 欠落サブディレクトリのスキップ
- hidden `.cache` ディレクトリのスキップ
- `Skill.md` alternate casing fallback
- frontmatter `name` 欠落時に dirname を採用
- スコープ順位規則（cwd < project < global）
- 存在しないディレクトリで空返却

### 2.2 TypeScript 型定義

**変更ファイル**: `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\types.ts`

Rust `SkillDef` と 1:1 対応する `interface SkillDef` を export（既存 `SlashCmd`
の直下、末尾 append で他 Chunk との衝突を避ける）。

### 2.3 UI: SlashPalette への skill section 追加

**変更ファイル**: `C:\Users\hiron\Desktop\ccmux-ide-gui\components\palette\SlashPalette.tsx`

- `SlashSource` union に `"skill"` を追加
- `SOURCE_META.skill`: 見出し「スキル (Claude Code skills)」、amber 系 accent
  （既存 builtin は orange、slash は scope ごとに purple/green/blue なので衝突回避）
- `SCOPE_ORDER`: **`builtin → skill → cwd → project → global`** の順序
- `SkillItem` 内部型 + `PaletteItem` union に `skill` kind 追加
- `groupAndLimit` / `matchesQuery` / `totalShown` を skill 対応に拡張
- `useEditorStore(s => s.openFile)` を取得して skill 選択時の Monaco preview に利用
- `list_skills` を open 時に callTauri し、`activeProjectPath` 変化で再取得
  （skill 取得失敗は silent = builtin / custom slash には影響させない）
- `handleSkillClick(item)`: 選択時に SKILL.md を Monaco で open + toast で案内
  （実行はしない。SDK native で自動検知される旨を user に伝達）
- `PaletteRow`: skill kind 用に `Sparkles` アイコン + amber text 色を追加
  （slash の Command アイコン / builtin の Wrench アイコンと視覚的に区別）
- 空 state のメッセージも「commands」→「コマンド / スキル」に拡張し、
  `~/.claude/skills/<name>/SKILL.md` の配置先を案内

### 2.4 検証結果

| チェック | 結果 |
|---|---|
| `cargo check` | OK (0 error, 3 pre-existing warnings unrelated to skills) |
| `cargo test --lib skills::` | OK (8 tests / 8 pass) |
| `npx tsc --noEmit` | OK (exit 0) |
| `npx next build` | OK (7 pages generated, pre-existing warnings のみ) |

## 3. Phase 2 の実装見通し（工数見積）

Phase 2 は **v1.4 以降** の別タスクとして起案推奨。以下の 3 段階に分解可能。

### Phase 2-A: sidecar との実態同期 (約 2〜3h)

- sidecar 側 (`sidecar/src/*.ts`) に `list_supported_commands` IPC endpoint を追加
  （既存 SDK session の `supportedCommands()` を wrap）
- Rust command `list_sidecar_skills(session_id)` で sidecar に問い合わせ
- UI: 「ディスク上のみ」「SDK 認識済み」を badge で区別表示
- **便益**: ユーザーが配置した skill が実際に SDK で有効化されているか可視化

### Phase 2-B: Skill invoke trigger UI (約 2〜3h)

- skill 選択時に、SDK の slash command 経由 (`/<skill-name>`) を prompt に挿入
  （SDK の `SlashCommand.name` は先頭スラッシュ無しで返るため、`/` を prepend）
- InputArea への `/<skill>` 挿入 → send の ergonomic shortcut
- **懸念**: SDK 側の slash 解釈と UI の slash パレット（既存 `/ceo` 等）の衝突。
  skill と slash で name 重複時の優先度設計が必要。

### Phase 2-C: Per-skill enable/disable & preload UI (約 3〜4h)

- `skillOverrides` 設定を `lib/stores/settings.ts` に追加
- Settings タブに skill 一覧 + on / off / name-only / user-invocable-only の 4 択 selector
- `AgentDefinition.skills` preload の project 別設定
- sidecar 起動時に本設定を反映する `start_agent_sidecar` 拡張

**Phase 2 全体**: 合計 7〜10h。v1.4 1 スプリント分として起案可能。

## 4. オーナー実機検証手順

1. **`cargo tauri build` (or `cargo tauri dev`) で ccmux-ide-gui を起動**
   - v1.3 以降の rust side を含む build を使用（本 Chunk の Rust 変更が反映された版）

2. **sample skill を配置**（GUI 外部で手動実施）

   ```powershell
   mkdir "$env:USERPROFILE\.claude\skills\sample-greeter"
   # SKILL.md を以下内容で作成
   ```

   `~\.claude\skills\sample-greeter\SKILL.md`:

   ```markdown
   ---
   name: sample-greeter
   description: Simple greeting skill used to verify ccmux-ide-gui v1.3 SkillPalette integration.
   ---

   # Sample Greeter Skill

   When invoked, greet the user in their preferred language.
   ```

3. **SlashPalette 起動**: ccmux-ide-gui の InputArea で `/` を入力
   - 組込コマンド / **スキル (Claude Code skills)** / カレント / プロジェクト /
     グローバルの順でグループが並ぶことを確認
   - skill グループに `sample-greeter` が `description` とともに表示される
   - amber 系 badge で `skill` と表示される

4. **skill 選択**:
   - `sample-greeter` をクリック / Enter
   - Monaco に SKILL.md が open される
   - toast で「スキル「sample-greeter」の SKILL.md を開きました…」が表示される
   - Palette が close される

5. **project-level skill の動作確認**（任意）:
   - active project の `.claude/skills/<name>/SKILL.md` を配置
   - ProjectRail で当該 project をアクティブ化してから再度 `/`
   - global skill と同時に表示され、同名なら project 側が勝つ

6. **空 state 確認**（任意）:
   - `~/.claude/skills/` を空にした状態で `/` を入力し、`xyz-no-such-skill` などで
     filter したときに「一致するコマンドはありません」が出ることを確認

7. **Claude 実応答での skill 発火確認**（Phase 1 範囲外 / 参考）:
   - sample-greeter skill を配置した状態で新規 session を開き、
     `sample-greeter を使って挨拶して` と送信
   - SDK native の skill 検知が動作すれば Claude が skill を invoke する
   - **本挙動は ccmux-ide-gui ではなく SDK 側の responsibility** であり、
     Phase 1 では UI 上の可視化に留める

## 5. 変更ファイル一覧

- 新規: `C:\Users\hiron\Desktop\ccmux-ide-gui\src-tauri\src\commands\skills.rs`
- 変更: `C:\Users\hiron\Desktop\ccmux-ide-gui\src-tauri\src\commands\mod.rs`
- 変更: `C:\Users\hiron\Desktop\ccmux-ide-gui\src-tauri\src\lib.rs`
- 変更: `C:\Users\hiron\Desktop\ccmux-ide-gui\lib\types.ts`
- 変更: `C:\Users\hiron\Desktop\ccmux-ide-gui\components\palette\SlashPalette.tsx`

## 6. 注意事項 / 申し送り

- **`.github/workflows/`** には一切触っていない（PM-952 CI hotfix との衝突なし）
- logger wrapper (PM-746): 新規 Rust module は既存 slash.rs と同じ `eprintln!`
  スタイル。frontend 側は toast のみで、`logger` util は Palette では未使用の
  既存流儀を踏襲
- diff は最小限。既存 slash 経路・builtin 経路・組込 `/mcp` `/clear` 等は一切
  挙動を変えていない
- sample skill 作成は sandbox 制約で dev agent が自動実施できなかったため、
  上記「実機検証手順 §2」でオーナーに手動作成を依頼
- Phase 2 は別タスク化推奨（本レポート §3 で工数見積提示）

---

**ステータス**: Phase 1 MVP 完了 / Phase 2 は v1.4+ 提案。CEO 報告用サマリは以下:

> PM-953 Phase 1 完了。Claude Code skill を `~/.claude/skills/<name>/SKILL.md`
> 準拠で走査し、SlashPalette に amber 系 `skill` section として表示可能に。
> 選択で SKILL.md を Monaco preview。SDK native の自動認識に依存し、実行 UI は
> Phase 2 (v1.4+) で検討。cargo check / tsc / next build 全パス、skills 単体
> テスト 8/8 pass。
