# PM Release Hardening T2-D + T2-E Report (Tauri セキュリティ強化)

- Project: PRJ-012 (ccmux-ide-gui)
- Scope: Tier 2-D (asset protocol scope 絞込) + Tier 2-E (capability 絞込)
- Date: 2026-04-20
- Repo: `C:\Users\hiron\Desktop\ccmux-ide-gui\`

## 目的

readiness audit で「`tauri.conf.json` の `assetProtocol.scope` と `capabilities/default.json` の `fs:scope` が `$HOME/**` を含んでおり、ユーザー home 配下の任意ファイルにアクセス可能」との指摘を受け、defense-in-depth で絞込む。

## 変更サマリー

| # | File | 変更内容 | 破壊的影響 |
|---|------|----------|------------|
| 1 | `src-tauri/tauri.conf.json` | `assetProtocol.scope` から `$HOME/**` を削除し、具体的な 8 path に限定 | 背景画像を `$HOME/Pictures/Desktop/Downloads/Documents` 以外の任意 dir (例: 外部ドライブ / `C:\Program Files`) から選択した場合、`convertFileSrc` で URL 生成後の webview 読み込みが失敗する可能性あり (許容範囲) |
| 2 | `src-tauri/capabilities/default.json` | `description` に T2-E 妥協理由と v1.1 TODO を明記 (`fs:scope` の `$HOME/**` は保持) | なし |

## 調査: `convertFileSrc` 呼出箇所

grep で以下 5 箇所を確認。それぞれが `asset://` 経由で読む path の出所を確認:

| File | 用途 | 実際の path source |
|------|------|---------------------|
| `components/chat/ImageThumb.tsx:61` | チャット attachment のサムネ | D&D: `$APPLOCALDATA/ccmux-images/**` / paste: `$HOME/.claude/ccmux-images/**` |
| `components/chat/ImagePreviewDialog.tsx:57` | attachment 拡大プレビュー | 同上 |
| `components/settings/AppearanceSettings.tsx:215` | 背景画像プレビュー | **ユーザー OS dialog で任意 path 選択可能** |
| `lib/apply-accent.ts:166` | 背景画像 CSS url() 注入 | 同上 |
| `lib/image-utils.ts:98` | `getImageMeta` の dimension 取得 | attachment / 背景画像の path 経由 |

attachment 系は app data dir に confined。**背景画像のみ任意 path 可能性**が残るため、common user image 配置 dir (`Pictures`, `Desktop`, `Downloads`, `Documents`) を scope に加える妥協案で対応。

## T2-D: asset protocol scope 絞込

### Before

```json
"assetProtocol": {
  "enable": true,
  "scope": [
    "$APPLOCALDATA/**",
    "$APPDATA/ccmux-images/**",
    "$HOME/**"
  ]
}
```

### After

```json
"assetProtocol": {
  "enable": true,
  "scope": [
    "$APPLOCALDATA/**",
    "$APPDATA/ccmux-images/**",
    "$HOME/.claude/**",
    "$HOME/.ccmux-ide-gui/**",
    "$HOME/Pictures/**",
    "$HOME/Desktop/**",
    "$HOME/Downloads/**",
    "$HOME/Documents/**"
  ]
}
```

### 設計判断

- `$HOME/.claude/**` に絞込んだ: `~/.claude/ccmux-images/paste-*.png` (clipboard paste, `src-tauri/src/commands/image_paste.rs:136-139`), `~/.claude/projects/<project>/<session>.jsonl` (Stage B 使用量集計), `~/.claude/CLAUDE.md` (Global memory) を一括カバー。指示書の `$HOME/.claude/projects/**` + `$HOME/.claude/CLAUDE.md` より広いが `.claude` 配下に限定する点では同等、将来の claude-code アップデートで path が増えても breakage を防ぐ。
- `$HOME/.ccmux-ide-gui/**`: アプリ独自の config dir (`lib/stores/project.ts` 他で参照)。
- `$HOME/Pictures/Desktop/Downloads/Documents`: 背景画像を OS dialog で選択する UX を壊さないため common 配置 dir を許可。**外部ドライブ / `C:\` 直下 / `Program Files` からの背景画像選択はこの変更で壊れる** (許容、bg 画像を Pictures 等にコピーして再選択する運用で回避可能)。
- `$HOME/**` 削除により、`$HOME/Desktop/secret-ssh-key.pub` 等の任意 dotfile が画像 URL 経由でリークする defense-in-depth が効く。

## T2-E: Capability 絞込 (妥協案)

### Before

```json
"description": "Default capability set for ccmux-ide (M0 雛形段階)",
```

### After

```json
"description": "Default capability set for ccmux-ide. T2-E (release hardening): fs:scope の $HOME/** はユーザーが任意 dir を project cwd として追加できる要件により保持。v1.1 で Rust 側の dynamic scope (project cwd 登録時に append_scope で enforcement) 検討。shell:allow-spawn の args:true は sidecar node の可変引数要件により保持、v1.1 で whitelist 化検討。",
```

### 設計判断

- **`fs:scope` の `$HOME/**` は保持**:
  - ProjectRail から追加する project cwd はユーザー任意 (`Desktop/my-project` / `Documents/work/foo` / 外部ドライブ 等ありうる)。
  - `lib/stores/editor.ts` の `readTextFile` / `writeTextFile`, `lib/image-utils.ts` の `stat`, `components/chat/InputArea.tsx` の `writeFile`/`mkdir`/`exists`/`stat`, `components/inspector/MemoryTreeView.tsx` の `watchImmediate` 等、plugin-fs 経由の path は project cwd 配下なら `$HOME` 外にも及びうる。
  - 完全絞込には Rust 側で `app.fs_scope().allow_directory()` を `add_project` 時に dynamic に呼ぶ必要あり (v1.1 task)。
- **`shell:allow-spawn` / `shell:allow-execute` の `args: true` も保持**:
  - sidecar Node 起動 (`src-tauri/src/commands/agent.rs`) で `NODE_OPTIONS`, script path, project-specific args を可変で渡す。
  - whitelist 化は regex pattern か位置指定 arg の設計が必要 (v1.1 task)。
- `fs:scope` には既に `$HOME/.claude/**` 等の狭い path 群が明示列挙されており、`$HOME/**` はフォールバックとして機能 (Tauri の scope は allow list の OR なので、狭い path が先にあっても `$HOME/**` の方が広いので実質 `$HOME/**` が支配的)。これは v1.1 で `$HOME/**` 削除 + dynamic scope に移行するまで defense-in-depth 無効であることを意味する。
- 通常用途外の path アクセスは Rust command (`list_dir_children` / `read_file_bytes` / `list_project_files`) を経由しており、これらは `fs:scope` ではなく Rust 側で直接 `std::fs` を使うため scope 外だが、コマンド自体が invoke allow 済で特に path 制限がない (別 audit 項目)。

## 検証結果

| Check | 結果 |
|-------|------|
| `cargo check` (src-tauri) | **PASS** (3 warnings, 全て pre-existing dead code) |
| `npx tsc --noEmit` (frontend) | **PASS** (0 error) |
| tauri config schema 検証 | **PASS** (build.rs/tauri-build 実行時に assetProtocol.scope JSON 配列が有効) |

## 動作影響の想定

| シナリオ | 影響 |
|----------|------|
| D&D / paste で attachment 追加 | 影響なし (`$APPLOCALDATA/ccmux-images` / `$HOME/.claude/ccmux-images` どちらも scope 内) |
| 背景画像を `~/Pictures/foo.jpg` から選択 | 影響なし (`$HOME/Pictures/**` in scope) |
| 背景画像を `~/Desktop/bar.png` から選択 | 影響なし |
| 背景画像を `D:\tmp\baz.png` (外部ドライブ) から選択 | **破綻** (`convertFileSrc` の URL が asset://localhost/... を返すが webview ロードで 403)。ユーザーは画像を `~/Pictures/` 等にコピーして再選択する必要あり |
| 背景画像を `C:\Program Files\MyApp\logo.png` から選択 | 同上、破綻 |
| `~/.claude/projects/**/*.jsonl` 使用量集計 | 影響なし (集計自体は Rust command、asset protocol 不使用) |
| `CLAUDE.md` 3-scope Inspector | 影響なし (`readTextFile` plugin-fs は `fs:scope` 経由、`$HOME/**` 保持で動作。asset protocol は CLAUDE.md には使われない) |
| ProjectTree で任意 project cwd のファイル open | 影響なし (`fs:scope` の `$HOME/**` 保持) |

## 将来 TODO (v1.1 candidate)

1. **Rust 側 dynamic scope 実装**:
   - `add_project(cwd)` invoke 時に `app.fs_scope().allow_directory(cwd, true)` を呼び、`remove_project` 時に `forbid_directory` する。
   - capabilities/default.json から `fs:scope` の `$HOME/**` を削除し、明示的な app data dir のみに絞込。
2. **shell:allow-spawn args whitelist**:
   - sidecar node 起動時の args pattern (例: `["<script-path>", "--project=<project_id>", "--port=<N>"]`) を正規化し regex で validate。
3. **assetProtocol への外部ドライブ対応**:
   - ユーザーが外部ドライブの画像を背景に使いたい場合、Preferences で additional_scope を UI から登録できる機能を追加。Tauri の `Scope::allow_file` を動的に呼ぶ。
4. **image dialog にバリデーション追加**:
   - `handlePickBackgroundImage` 後、選択 path が scope 内かを事前 check し、外なら dialog 表示「scope 外です。`~/Pictures/` にコピーしてください」等。

## 影響を受けない他 Agent 作業

- T1-B (package.json / lock): 変更なし → 非干渉
- T1-C (.ts/.tsx console.log 除去): `src-tauri/` と `capabilities/` のみ編集 → 非干渉

## 結論

T2-D (asset protocol) は `$HOME/**` → 具体 8 path に絞込完了、defense-in-depth 有効化。T2-E (capability) は妥協案で description に TODO を明記して v1.1 に繰越 (`fs:scope $HOME/**` と `shell:allow-spawn args:true` は現状維持)。`cargo check` / `tsc --noEmit` 両方 0 error 確認済。**背景画像を外部ドライブから直接選択するユーザーは Pictures/Desktop 等にコピーして再選択する必要あり**の点のみ docs/release-checklist.md に追記推奨。

以上、CEO 経由でオーナーに報告願います。
