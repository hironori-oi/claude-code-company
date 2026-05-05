# Runbook: OG Image Template Design v1 — 4 Variant ビジュアル仕様

**対象案件**: PRJ-019 Open Claw "Clawbridge"（自社 HP + 案件 LP 統合公開, 2026-06-19 09:00 JST）
**所有者**: Web-Ops 部門 / 制作 owner: Web-Ops-G（Round 19 spec → Round 20 実装）
**バージョン**: v1.0（Round 20 第 2 波 / Web-Ops-G 起票）
**関連**: `og-image-production-spec-2026-06-27.md` (Round 19 Web-Ops-F 110 行) / `app/api/og/route.tsx` (本書と一対一同期) / `organization/rules/design-guidelines.md`

---

## 0. 目的と前提

`/api/og` route が動的に生成する 4 variant の **ビジュアル設計仕様** を 1 枚で規定する。
Round 19 spec (`og-image-production-spec-2026-06-27.md`) が「単一固定画像 = `/og/launch-2026-06-27.png`」を扱うのに対し、本書は **動的生成 4 variant** を扱う（Vercel OG SDK + dynamic params 経路）。両者は併存し、固定画像は launch 当日 fallback、動的生成は通常運用 OG として住み分け。

副作用 0 / 絵文字 0 / Heroicons 参照のみ / WCAG AA 準拠。

---

## 1. 全 variant 共通仕様

### 1.1 寸法・比率
- 解像度: **1200 x 630 px**（OG 標準, aspect 約 1.91:1, 仕様文中の "16:8.4" は 1200:630 = 1.905:1 の概算表記）
- safe area: 中央 1080 x 540 px（LinkedIn / Slack の上下 crop 回避）
- 余白: 全辺 **80 px**（仕様 §共通）
- 形式: PNG（24-bit, sRGB）/ ImageResponse 既定 / fallback SVG は `image/svg+xml`

### 1.2 タイポグラフィ
- フォント: **Geist Sans**（本文・見出し）/ **Geist Mono**（メタ情報・URL・eyebrow）
- 文字サイズ階層:
  - Title (headline): **60 px** Bold（最大）/ 折返し 2 行まで / 60 文字超は 1 文字 ellipsis
  - Subtitle: **32 px** Regular / 1〜2 行 / 80 文字超は ellipsis
  - Eyebrow（上段ラベル）: **22 px** Mono / 文字間 1.2 / アクセント 12px 矩形 dot 添え
  - Meta（下段左）: **22 px** Mono / アクセント色
  - URL（下段右）: **20 px** Mono / 三段目グレー
- letter-spacing: title -0.5 / eyebrow +1.2 / 他 0

### 1.3 カラーパレット（design-guidelines.md §brand-color と同期）

| 役割 | hex | 用途 |
|---|---|---|
| brand-primary (background) | `#0B1F33` | 背景ベース（深紺 / 4wide） |
| surface | `#102A47` | gradient 終点（135deg）|
| text-primary | `#FFFFFF` | title（contrast 16:1 over background, AA AAA pass）|
| text-secondary | `#C8D6E5` | subtitle（contrast 約 9:1, AA pass）|
| text-tertiary | `#8FA4B8` | URL / eyebrow（contrast 約 4.6:1, AA pass）|
| brand-accent | `#3DA9FC` | meta / アクセント dot（contrast 約 5.0:1, AA pass）|
| divider | `rgba(255,255,255,0.12)` | bottom row 区切り線 |

**WCAG AA 検証**: 全テキスト × 背景の組み合わせは 4.5:1 以上を満たす（最小は text-tertiary 4.6:1）。

### 1.4 レイアウト構造（全 variant 共通）

```
+----------------------------------------------------+
| [eyebrow: ■ 4wide.co.jp]                           |  <- top row: 22px mono
|                                                    |
|                                                    |
|  [TITLE: 60px Bold, max 2 lines]                   |  <- middle row
|  [Subtitle: 32px Regular, max 2 lines]             |
|                                                    |
|                                                    |
| ─────────────────────────────────────              |  <- divider
| [meta: 22px mono accent]    [www.4wide.co.jp: 20px]|  <- bottom row
+----------------------------------------------------+
   1200 x 630 / 全辺 80px padding / brand gradient bg
```

中央配置ではなく **上下三段（top / middle / bottom）justify-content: space-between**。
Round 19 spec の center 1 段構成と差別化し、情報密度を上げる（dynamic params 4 種を裁ける器）。

### 1.5 装飾ルール（AI 感を出さない）
- イラスト・写真・ノイズテクスチャ・グラデーション以外の装飾は一切入れない
- アクセント要素は **12 px の矩形 dot 1 個** のみ（eyebrow 横）
- 線は divider 1 本（opacity 12%）のみ
- 絵文字 0 / アイコン Heroicons のみ（本書 v1 では Heroicons 不使用、純テキスト構成）

---

## 2. Variant A: home

**用途**: トップページ (`/`) / 一般 share / `og:image` default 経路。

| 要素 | 値（ja default） | 値（en） |
|---|---|---|
| eyebrow | `■ 4wide.co.jp` | `■ 4wide.co.jp` |
| title | `AI で加速する中小企業向け Web アプリ`（dynamic param 上書き可） | `AI-Augmented Web Apps for SMBs` |
| subtitle | `数週間で立ち上げる、ミニマルな設計` | `Built in Weeks. Lean by design.` |
| meta | `Next.js + Supabase` | `Next.js + Supabase` |
| URL | `www.4wide.co.jp` | 同左 |

**設計意図**: 中小企業 owner が social timeline でスクロール中に「AI / 数週間 / 中小企業」3 keyword を 0.5 秒で認識できる構成。スクリーンショット視認時の F-pattern を意識し、左上 eyebrow → 中央 title → 右下 URL の Z 動線。

---

## 3. Variant B: portfolio

**用途**: `/portfolio` / 案件一覧ページ share / SNS で実績訴求時。

| 要素 | 値（ja default） | 値（en） |
|---|---|---|
| eyebrow | `■ 4wide.co.jp` | 同左 |
| title | `ポートフォリオ`（dynamic param 上書き可） | `Portfolio` |
| subtitle | `Open Claw / Clawbridge — 中小企業向け実績` | `Open Claw / Clawbridge — SMB engagements` |
| meta | `公開実績 13 件`（PRJ-019 含む / 2026-06-19 公開時点） | `13 projects shipped` |
| URL | `www.4wide.co.jp` | 同左 |

**設計意図**: 件数 (13 件) を accent 色で前面化し、量的実績の信頼感を即時伝達。`Open Claw / Clawbridge` ロゴ的扱い (subtitle 中の brand naming) で PRJ-019 の存在を OG 画像に埋め込む。
**件数更新ポリシー**: 案件追加時に `app/api/og/route.tsx` の `PORTFOLIO_PROJECT_COUNT` 定数を更新（Web-Ops 部門責務、PR 1 行で完結）。

---

## 4. Variant C: case-study

**用途**: `/case-studies/[slug]` 各案件詳細ページ share。

| 要素 | 値（ja default, dynamic params 推奨） | 値（en） |
|---|---|---|
| eyebrow | `■ 4wide.co.jp / Portfolio` | 同左 |
| title | `{案件名}`（必ず dynamic param `title=` で渡す） | 同左（en は `&locale=en`） |
| subtitle | `{中小企業向け Web アプリ}`（dynamic param 推奨） | `SMB Web App` 等 |
| meta | `期間: 6 週間` 等（dynamic param 推奨, KPI 1 件採用可） | `Period: 6 weeks` 等 |
| URL | `www.4wide.co.jp` | 同左 |

**設計意図**: 案件名を 60px Bold で大きく見せ、share 先で「どの案件か」を 0.3 秒で識別可能にする。subtitle は業種カテゴリ、meta は期間または最重要 KPI 1 件（例: `LCP 1.8s 達成`、`CV +42%`）。複数 KPI は載せない（情報過多回避）。

**dynamic params 例**:
```
/api/og?variant=case-study&title=PRJ-004%20%E3%81%84%E3%81%A3%E3%81%97%E3%82%87%E3%81%B3%E3%82%88%E3%82%8A&subtitle=iPhone%20%E3%82%A2%E3%83%97%E3%83%AA&locale=ja
```

---

## 5. Variant D: about

**用途**: `/about` / 会社概要ページ share / 信頼性訴求時。

| 要素 | 値（ja default） | 値（en） |
|---|---|---|
| eyebrow | `■ 4wide.co.jp` | 同左 |
| title | `4wide について`（dynamic param 上書き可） | `About 4wide` |
| subtitle | `AI で加速する、ミニマルな中小企業向け Web アプリ。` | `Lean web apps for SMBs, augmented by AI.` |
| meta | `2024 年〜` | `Since 2024` |
| URL | `www.4wide.co.jp` | 同左 |

**設計意図**: ミッション 1 行を subtitle に据え、creation year を meta で添える。装飾を最小化し「AI 感を出さない / クリーン」の design-guidelines を最も強く体現する variant。

---

## 6. アクセシビリティ検証チェック

| 項目 | 基準 | 検証方法 |
|---|---|---|
| コントラスト比 | 全テキスト × 背景 4.5:1 以上 | WebAIM Contrast Checker / `npm run a11y:og` (Round 21 で追加検討) |
| 文字サイズ | 最小 20 px (URL) | Figma source 確認 / 実画像 measure |
| safe area | 1080 x 540 内に重要情報 | LinkedIn preview tester / 実 share 確認 |
| 装飾要素 | dot 1 個 + divider 1 本のみ | code review (route.tsx 静的読解) |
| 絵文字混入 | 0 件 | grep `/[\u{1F300}-\u{1FAFF}]/u` against route.tsx + 本書 |
| ロケール一貫性 | ja / en で fontset / 行間 / 文字数上限が一致 | 4 variant × 2 locale = 8 case の preview 比較 |

---

## 7. 制作物との対応

- 動的生成: `app/api/og/route.tsx` が生成し、各 page の `metadata.openGraph.images` から URL 経由で参照
- 固定画像: `/public/og/launch-2026-06-27.png` (Round 19 spec 由来、launch 当日 fallback / `og:image` SEO meta default 値)
- メタ参照例（Next.js metadata API）:
  ```ts
  // app/page.tsx (例)
  export const metadata = {
    openGraph: {
      images: [{ url: "/api/og?variant=home&locale=ja", width: 1200, height: 630 }],
    },
  };
  ```
- 各 variant が page tier (home / portfolio / case-study / about) と一対一対応するため、metadata 設定は単純（switch 不要）。

---

## 8. 関連 DEC

- DEC-019-054（portfolio v3.0 公開判断）
- DEC-019-062（v1.1 / v3.1 deploy 確定）
- DEC-019-033（ナレッジ自動蓄積機構：本 design v1 も knowledge/patterns 候補, key = `og-template-4-variant`）
- DEC-018-047（PRJ-018 hotfix 由来：rollback ベストプラクティス継承）

---

**最終更新**: 2026-05-05（Round 20 第 2 波 / Web-Ops-G 起票）
**次回見直し**: 2026-06-12（D-7 = OG E2E test 実行直前）/ 2026-06-26（D-1 配置直後 visual verification）/ 2026-07-27（30 day review = lessons-learned 抽出）
