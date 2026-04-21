# PRJ-012 v10 / PM-923: UI 小調整 (InputArea 2行 + Terminal 透過強化)

## 概要

dogfood fb 対応の polish 2 点を最小 diff で反映した。frontend のみ、Rust / sidecar は不変更。

- チャット入力欄の初期表示を 3 行 → 2 行に圧縮 (垂直スペースの節約)
- Terminal 背景透過度を `rgba(0,0,0,0.35)` → `rgba(0,0,0,0.18)` に引き下げ (PM-870 背景画像をより強く透かす)

tsc `--noEmit` error 0。Playwright / 機能回帰は変更範囲的に発生し得ない (視覚プロパティのみ)。

## 対象ファイル

| ファイル | 変更内容 |
|---|---|
| `components/chat/InputArea.tsx` | `rows={3}` → `rows={2}`、`min-h-[72px]` → `min-h-[52px]` |
| `components/terminal/TerminalPane.tsx` | fallback `terminalBg` を `rgba(0,0,0,0.35)` → `rgba(0,0,0,0.18)`、コメントに PM-923 を追記 |

`app/globals.css` には `--terminal-bg` CSS variable が未定義のため編集不要 (TerminalPane.tsx の fallback 値がそのまま effective 値)。

## diff 要約

### 1. `components/chat/InputArea.tsx`

```diff
               disabled={streaming || !activeProjectId}
-              rows={3}
-              className="min-h-[72px] resize-none"
+              rows={2}
+              className="min-h-[52px] resize-none"
```

- `rows={2}` で初期表示 2 行
- `min-h-[52px]` は padding (shadcn Textarea は `px-3 py-2` = 上下 8px) + line-height 1.25 * 13px * 2 lines ≒ 48〜52px を目安に設定。従来 `72px` は 3 行 + padding の計算値。
- `resize-none` は既存維持、textarea の auto-grow (`useEffect` による scrollHeight 同期) は本 component には未実装。Shell 的には **純粋に rows 属性 + min-h による初期表示行数制御** のみ。ユーザーが長文を書くと textarea は scroll する想定 (rows=2 は HTML 仕様上の初期高さ、overflow 時は内部スクロール)。
- **複数行入力は維持**: Enter 単体は改行、Ctrl/Cmd+Enter で送信という既存 onKeyDown ロジックは無変更。

### 2. `components/terminal/TerminalPane.tsx`

```diff
-        // PM-922: `--terminal-bg` CSS variable 経由で背景色を可変化。
-        // 未指定時は rgba(0,0,0,0.35) 相当 (半透明黒) で背景画像を透かす。
+        // PM-922 / PM-923: `--terminal-bg` CSS variable 経由で背景色を可変化。
+        // 未指定時は rgba(0,0,0,0.18) 相当 (さらに薄い半透明黒) で背景画像を
+        // はっきり透かす。PM-923 polish で 0.35 → 0.18 に引き下げ。
         // オーナーが globals.css / inline style で上書きすれば微調整できる。
         const bgFromVar =
           typeof window !== "undefined"
             ? getComputedStyle(document.documentElement)
                 .getPropertyValue("--terminal-bg")
                 .trim()
             : "";
-        const terminalBg = bgFromVar || "rgba(0, 0, 0, 0.35)";
+        const terminalBg = bgFromVar || "rgba(0, 0, 0, 0.18)";
```

他の xterm theme 設定 (foreground / ANSI 色 / cursor / selectionBackground) は変更なし。`allowTransparency: true` も既存維持 (canvas renderer で rgba を尊重する前提)。

## 透過度選定理由

- **目標**: 背景画像 (PM-870) をはっきり透かしつつ、ターミナル文字 (`foreground: "#e5e5e5"`) の読みやすさを保つ。
- **探索幅**: 依頼範囲 0.15〜0.20 の中から 0.18 を採用。
- **判断根拠**:
  - `0.15` は薄すぎると判断。PM-870 の背景画像は配色にバリエーションがあり、白系 or 明るい箇所に文字が重なると `#e5e5e5` 前景との contrast が WCAG AA (4.5:1) を下回るリスクが高まる。
  - `0.20` は PM-922 の `0.35` との差分が小さめで「もう少し透過を強く」という fb のニュアンスに対して効きが弱い。
  - `0.18` は 0.15 と 0.20 の中間付近で、視覚的には従来比でおおよそ倍近く背景が見える (0.35 - 0.18 = 0.17 の不透明度差)。ダーク壁紙を想定した dogfood 環境で contrast 下限の最悪ケースでも、ANSI bright 色 (`brightWhite: "#f0f6fc"` 等) が救済するため実運用では問題ないと判断。
- **追加調整経路**: `app/globals.css` に `:root { --terminal-bg: rgba(0,0,0,0.22); }` のように書けば再 build なしで上書き可能 (PM-922 で用意済みの CSS variable hook)。オーナーが微調整したい場合の exit door。

## 影響範囲

- **他 Agent 作業との非干渉**: `Shell.tsx` / `TerminalView.tsx` / `EditorPane.tsx` には触れていない。`InputArea.tsx` / `TerminalPane.tsx` は本 Agent 排他担当であることを事前指示で確認済み。
- **Rust sidecar**: 変更なし (frontend のみ)。
- **機能後退**: 無し。以下をメンタル check 済み:
  - Textarea は rows=2 でも `onKeyDown` (Ctrl+Enter / Enter 単独) / `onChange` / `onDragOver` / `onDrop` / slash & at palette trigger が全て同じ DOM node に付いており挙動不変。
  - xterm Terminal option は `background` の RGBA 不透明度のみ変更。allowTransparency / canvas renderer / fontFamily / scrollback などは無変更。

## 検証

- `npx tsc --noEmit`: **error 0** (stdout 空出力で確認)。
- tauri dev 起動は依頼通り停止中のため目視確認未実施。dogfood 時にオーナーが:
  - (a) 入力欄が 2 行分で描画されること
  - (b) Terminal 背景画像がこれまで以上に透けて見えること
  を確認する運用。

## 次アクション

- 他 Agent (Editor/Terminal 分割、ブラウザ機能調査) の PR と統合後、dogfood で視覚確認。
- もし 0.18 が「まだ不透明」or「薄すぎ」と fb があれば、globals.css の `--terminal-bg` 上書きで即座に 0.15 / 0.22 などに切替可能。再 build (`next dev` HMR) のみで反映される。

## 工数

- 見積 15〜30 分 → 実績 10 分程度 (最小 diff 2 箇所、tsc 1 回のみ)。

## 担当

dev Agent (Claude Opus 4.7 / 1M context)
