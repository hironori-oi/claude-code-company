# PRJ-018 Asagi（浅葱）— BRAND 定数まとめ

| 項目 | 内容 |
|---|---|
| 案件 | PRJ-018 Asagi（浅葱）— Codex マルチプロジェクト IDE |
| 文書種別 | ブランド定数 1 ページ要約（開発が import しやすい形） |
| 上位文書 | `reports/design-brand-v1.md`（詳細）／ `reports/design-logo-decision-log.md`（ロゴ判断履歴） |
| 関連 DEC | DEC-018-001（プロダクト名 Asagi）／ DEC-018-006（差別化 4 軸 B = Linear 級デザイン）／ **DEC-018-020（ロゴ v1 公式採用：γ 浅葱滴）** |
| 起案日 | 2026-05-02 (fourth update) |
| 更新ルール | ブランド定数の追加・変更時に PM が更新（DEC 起票必須） |

---

## 1. プロダクト名・ネーミング

| 項目 | 値 |
|---|---|
| 正式名（英表記） | **Asagi** |
| 正式名（和表記） | **浅葱** |
| 読み | あさぎ |
| キャッチ | Codex マルチプロジェクト IDE |
| 兄弟プロダクト | **PRJ-012 Sumi（墨）** — Claude Code 専用 IDE（コード共有禁止、色対比で兄弟） |
| リポジトリ | `hironori-oi/Asagi` (private、DEC-018-013) |

---

## 2. ロゴ（DEC-018-020 確定）

| 項目 | 値 |
|---|---|
| 採用案 | **γ 浅葱滴（あさぎしずく）** |
| 採用ファイル（PNG 原本） | `app/design/logos/logo-v3-gamma-asagi-drop.png` |
| 採用日 | 2026-05-02 (fourth update) |
| 確定 DEC | DEC-018-020 |
| デザインコンセプト | Sumi（橙滴）と完全鏡像構造（紙 + 滴）の兄弟感、浅葱の純粋体現、趣 5 原則（侘び寂び・控えめな美・余白・自然な味わい・即興性）全網羅 |
| 採用理由（CEO） | 兄弟構造最強・浅葱の純粋な体現・趣 5 原則全網羅・スケーラビリティ全軸最高（識別性 5 / スケーラビリティ 5 / 侘び寂び 5） |
| 次フェーズ（AS-DESIGN-04） | SVG ベクター化 → multi-size 展開（16/32/48/128/256/512）→ プラットフォーム別（.ico / .icns / .png）→ PWA maskable → ライト/ダーク色変種 → アプリ組込み |
| 商標 | M3 配布検討時に再判断（OWNER-TODO 6、当面休眠） |

### ロゴ判断履歴（要約）

- v1（漢字「浅」/グラデ円 + モノグラム/葦の葉）: 全案却下（DEC-018-016）
- v2（古銅鏡 / 半月 / 印章）: 全案保留（DEC-018-018）
- v3（α 絞り染め / β 一筆の渦 / **γ 浅葱滴** / δ 家紋月 / ε 朝霞）: **γ 採用確定（DEC-018-020）**
- 詳細: `reports/design-logo-decision-log.md`

---

## 3. カラー（OKLCH ベース）

### 3.1 Primary Accent — Asagi 浅葱色

| 表記 | 値 |
|---|---|
| OKLCH | `oklch(0.72 0.10 200)` |
| Hex 近似 | `#5BB8C4` |
| RGB | `rgb(91, 184, 196)` |
| HSL | `hsl(187, 47%, 56%)` |

### 3.2 Asagi スケール（11 段階、Tailwind v3.4 互換）

| Token | OKLCH | Hex | 主用途 |
|---|---|---|---|
| `asagi-50`  | `oklch(0.97 0.015 200)` | `#EAF5F7` | 最薄背景 |
| `asagi-100` | `oklch(0.94 0.025 200)` | `#D4ECEF` | ライト surface |
| `asagi-200` | `oklch(0.88 0.045 200)` | `#B0DCE2` | ライト border |
| `asagi-300` | `oklch(0.82 0.065 200)` | `#8CCCD4` | ライト muted accent |
| `asagi-400` | `oklch(0.77 0.085 200)` | `#71BFC9` | ホバー accent |
| **`asagi-500`** | `oklch(0.72 0.10 200)`  | `#5BB8C4` | **brand center, dark theme primary accent** |
| `asagi-600` | `oklch(0.65 0.105 200)` | `#41A0AE` | active 状態 |
| `asagi-700` | `oklch(0.56 0.10 200)`  | `#318897` | focus ring 強調 / light theme accent |
| `asagi-800` | `oklch(0.45 0.085 200)` | `#246E7B` | dark surface accent |
| `asagi-900` | `oklch(0.34 0.065 200)` | `#1A535D` | dark muted accent |
| `asagi-950` | `oklch(0.22 0.04 200)`  | `#10353C` | 最深 accent / overlay |

### 3.3 セマンティックトークン（dark / light）

| 役割 | dark | light |
|---|---|---|
| `background` | `oklch(0.20 0.015 230)` `#24283B` | `oklch(0.99 0.005 220)` `#F9FAFC` |
| `foreground` | `oklch(0.93 0.012 220)` `#E8EAF0` | `oklch(0.20 0.015 230)` `#24283B` |
| `surface` | `oklch(0.24 0.018 230)` `#2C3145` | `oklch(0.97 0.008 220)` `#F0F2F6` |
| `border` | `oklch(0.32 0.02 225)` `#414763` | `oklch(0.88 0.012 220)` `#D8DBE3` |
| `muted` | `oklch(0.55 0.015 220)` `#7C8294` | `oklch(0.55 0.015 220)` `#7C8294` |
| `accent` | `oklch(0.72 0.10 200)` `#5BB8C4` | `oklch(0.56 0.10 200)` `#318897` |
| `accent-foreground` | `oklch(0.15 0.01 230)` `#1A1E2E` | `oklch(0.99 0.005 220)` `#F9FAFC` |
| `destructive` | `oklch(0.62 0.16 25)` `#D9614A` | `oklch(0.55 0.18 25)` `#C04A33` |
| `success` | `oklch(0.70 0.14 155)` `#52C28E` | `oklch(0.55 0.15 155)` `#3A9F6E` |
| `warning` | `oklch(0.78 0.13 85)` `#D4B560` | `oklch(0.65 0.14 85)` `#B59440` |
| `info` | `oklch(0.70 0.10 230)` `#5E9DD4` | `oklch(0.55 0.12 230)` `#3F7FB8` |

### 3.4 Sumi との識別性

- Primary accent 色相差 = **155deg**（Sumi 橙 ~45deg vs Asagi 浅葱 ~200deg）
- ProjectRail に並べた際に瞬時に識別可能
- L 値・C 値・レイアウト構造・フォントは完全一致 → 兄弟プロダクト感を担保

### 3.5 実装直結 CSS

実装での参照は `app/design/tokens.css` を import（AS-104 で雛形組込済）。

---

## 4. タイポグラフィ

### 4.1 フォントファミリ

```css
--font-sans: 'Geist Sans', 'Noto Sans JP', system-ui, -apple-system, sans-serif;
--font-mono: 'Geist Mono', 'Cascadia Code', 'Consolas', monospace;
```

| 用途 | フォント |
|---|---|
| UI 本文（欧文） | Geist Sans（next/font 経由、Sumi と共通） |
| 等幅（コード・数値） | Geist Mono |
| 日本語 fallback | Noto Sans JP |
| 絵文字 | **不使用**（CLAUDE.md 絵文字禁止）、アイコンは lucide-react で代替 |

### 4.2 サイズスケール（8 段階、IDE 最適化）

| Token | px | rem | 用途 |
|---|---|---|---|
| `text-xs` | 11 | 0.6875 | StatusBar、トークン残数、タイムスタンプ |
| `text-sm` | 12 | 0.75 | チップ、タグ、補助ラベル |
| `text-base` | 13 | 0.8125 | UI 既定 |
| `text-md` | 14 | 0.875 | チャット本文、Codex 応答 |
| `text-lg` | 16 | 1.0 | 見出し小、主要操作 |
| `text-xl` | 20 | 1.25 | Section heading |
| `text-2xl` | 24 | 1.5 | Page title |
| `text-3xl` | 32 | 2.0 | Splash / Brand display |

### 4.3 ウェイト運用

- `400` Regular: 本文・補助
- `500` Medium: ボタンラベル・active state
- `600` Semibold: 見出し・section heading
- **Bold (700) は不使用**（Linear 流の控えめタイポ）

### 4.4 行間・字詰め

| 文脈 | line-height | letter-spacing |
|---|---|---|
| UI 本文（base） | 1.5 | 0 |
| チャット本文（md） | 1.65 | 0 |
| 見出し（lg〜2xl） | 1.3 | -0.01em |
| 等幅（コード） | 1.55 | 0 |
| 日本語混在時 | 1.7 | 0.02em |

---

## 5. アイコン

| 項目 | 値 |
|---|---|
| ライブラリ | **lucide-react**（DEC-018-006 / Sumi と共通） |
| サイズ既定 | 16px (UI inline) / 20px (button) / 24px (heading) |
| ストローク幅 | 1.75px（既定）／ 2px（強調・active） |
| 絵文字 | 全面禁止（CLAUDE.md 規約） |

---

## 6. アニメーション・トランジション

| 項目 | 値 |
|---|---|
| ライブラリ | **framer-motion** |
| 既定 duration | 180ms（短）／ 240ms（標準）／ 320ms（長） |
| 既定 easing | `[0.4, 0.0, 0.2, 1]`（Material standard）／ `[0.16, 1, 0.3, 1]`（slide in 系） |
| reduced-motion | OS 設定尊重、`prefers-reduced-motion: reduce` で `transform` `opacity` のみに縮退 |

---

## 7. レイアウト基本

| 項目 | 値 |
|---|---|
| 基本構造 | **3 ペイン**: 左 ProjectRail (48px) + Sidebar (240px) + 中央 Chat + 右 Inspector (320px) |
| Top | TitleBar（Tauri カスタム） |
| Bottom | StatusBar（model 表示 / context % / branch / プラン残枠） |
| 角丸（既定） | 6px（small）／ 8px（medium）／ 12px（large、modal/popover） |
| spacing 単位 | 4px grid（Tailwind 標準） |
| 影 | 控えめ（dark theme では border 強調を優先、shadow は modal/popover 限定） |

---

## 8. ブランドトーン

| 軸 | 値 |
|---|---|
| 第一印象目標 | 「英語の Codex 拡張より入りやすい」「画面が落ち着いている」「IDE っぽくない、対話アプリに近い」「Linear / Raycast に並ぶ品質」「Sumi と兄弟だと一目で分かる」 |
| 避けたい印象 | 機械的、AI ぽい未来感、グラデ多用、グラスモーフィズム |
| 文体 | 日本語デフォルト、丁寧語ベース、英語 UI 切替可（next-intl） |
| 隠喩 | 「浅葱の空の下を歩く（対話と発想）」 — Sumi「墨で書く（思索）」との二項対立 |

---

## 9. 開発側 import パス

| 種別 | パス |
|---|---|
| カラートークン CSS | `app/asagi-app/src/styles/tokens.css`（AS-104 で雛形組込済） |
| ロゴ PNG（採用案・原本） | `app/design/logos/logo-v3-gamma-asagi-drop.png` |
| ロゴ SVG マスター（背景込 1024） | `app/design/logos/asagi-icon.svg` |
| ロゴ SVG シンボル（背景透明 1024） | `app/design/logos/asagi-icon-symbol.svg` |
| ロゴ SVG ダーク（紺紙地） | `app/design/logos/asagi-icon-dark.svg` |
| ロゴ SVG ライト（オフホワイト紙地） | `app/design/logos/asagi-icon-light.svg` |
| favicon SVG（簡略 64） | `app/design/logos/asagi-favicon.svg` |
| アイコン multi-size PNG / ICO / ICNS | `app/design/logos/icons/`（asagi-icon-{16,32,48,64,128,256,512,1024}.png / asagi.ico / asagi-favicon.ico / asagi.icns） |
| Tauri アプリ組込アイコン | `app/asagi-app/src-tauri/icons/`（32x32.png / 128x128.png / 128x128@2x.png / icon.ico / icon.icns、`tauri.conf.json` の `bundle.icon` に列挙済 = AS-META-09 完了） |
| Next.js favicon | `app/asagi-app/public/`（favicon.ico / favicon.svg / favicon-16x16.png / favicon-32x32.png / apple-touch-icon.png、`src/app/layout.tsx` の Metadata に登録済） |
| 詳細仕様 | `reports/design-brand-v1.md`（参照用）／ `reports/design-logo-final-gamma.md`（採用記録） |

---

## 10. 関連 DEC

| DEC | 内容 |
|---|---|
| DEC-018-001 | プロダクト名「Asagi（浅葱）」確定 |
| DEC-018-002 | Sumi と完全独立アプリ・独立リポジトリ |
| DEC-018-006 | 差別化 4 軸（A 日本語 / B Linear 級デザイン / C Slack 風 Multi-Project / D ローカル永続化）全踏襲 |
| DEC-018-013 | リポジトリ `hironori-oi/Asagi` 確定 |
| DEC-018-016 | ロゴ v1 全案却下 + v2 方針 |
| DEC-018-018 | ロゴ v2 全案保留 + v3 方針（stitch MCP / 案 C 中心 / 趣方針） |
| **DEC-018-020** | **ロゴ v1 公式採用：γ 浅葱滴 確定** |

---

**v1 起案**: 2026-05-02 (fourth update) PM 部門 ／ **更新ルール**: ブランド定数追加・変更時に PM が更新（DEC 起票必須）。詳細仕様の追加は `reports/design-brand-v1.md` 側に追記し、本 BRAND.md は要約に徹する。
