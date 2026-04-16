# Theme D 仕様書 -- Creative Studio / Portfolio-driven

## 1. 調査結果サマリー

### 1.1 参照サイト概要: goodthewhat.com

GoodTheWhat Inc. は日本のクリエイティブ企画・デザイン会社。ブランディング、グラフィックデザイン、Webサイト制作を主業務とし、「心にグッとザワッとするサービス」をモットーに掲げる。

### 1.2 ブランドポジション

- **業態**: クリエイティブ企画・デザイン会社
- **世界観**: プロフェッショナルだが温かみがある。ストーリーテリングを重視し、「ストーリーにこだわる」姿勢が全体を貫く
- **トーン**: 誠実、丁寧、職人気質。過度な装飾より中身で語る
- **パーソナリティ**: 控えめだが自信がある。クライアントワークの質で勝負する

### 1.3 カラーパレット分析

| 用途 | 色 | 備考 |
|------|-----|------|
| 背景 (Primary) | 白 / オフホワイト (#FFFFFF 〜 #FAFAFA) | 清潔感、コンテンツ主役 |
| 背景 (Alt) | ごく薄いグレー (#F5F5F3) | セクション切替用 |
| テキスト | ダークチャコール (#1A1A1A 〜 #333333) | 高コントラスト、読みやすさ重視 |
| サブテキスト | ミディアムグレー (#666666 〜 #888888) | キャプション・メタ情報 |
| アクセント | 落ち着いたブルー (#0066CC 相当) | リンク・アイコン限定 |
| ボーダー | 薄いグレー (#E5E5E5 〜 #DDDDDD) | セクション区切り |
| フッター背景 | ダーク (#1A1A1A 〜 #222222) | 情報密度の高いフッター |
| グラデーション/透過 | 使用控えめ | 写真 overlay で暗転程度 |

**配色戦略**: モノトーン基調に 1 色アクセント。多色グラデーション・ネオン・紫系は一切なし。写真の色味がページの彩度を担う。

### 1.4 タイポグラフィ分析

| 要素 | 推定値 | 特徴 |
|------|--------|------|
| H1 (Hero) | 32-52px fluid | 和文 sans-serif、600 weight |
| H2 (Section) | 24-38px fluid | 和文中心、控えめなサイズ |
| H3 (Sub) | 18-22px | カード・リスト見出し |
| 本文 | 15px | line-height 1.85-1.9 |
| ラベル | 11-12px | 英字大文字、letter-spacing 0.12-0.18em |
| キャプション | 12px | 英字、tabular-nums |

- **フォント構成**: Sans-serif 主体。見出し・本文ともにゴシック体（類似: Noto Sans JP）
- **英字ラベル**: セクション識別子として小さめの英字 ALL CAPS を使用
- **テキスト処理**: 大文字変換はラベル・ナビのみ。本文は自然な和文
- **行間**: ゆったり（1.85-1.9）で読みやすさを確保

### 1.5 レイアウト分析

| 要素 | 値 | 備考 |
|------|-----|------|
| max-width | 1200px | コンテンツ領域 |
| padding-inline | 20-48px fluid | 画面幅に応じて可変 |
| セクション間隔 | 80-160px fluid | 十分な呼吸 |
| Grid | 1-3 cols responsive | モバイル 1col → デスクトップ 3col |
| Hero 高さ | 100vh | フルスクリーン |
| カード比率 | 4:3 / 3:2 | ポートフォリオ画像 |

- **左右非対称**: About セクションでテキスト左・画像右の非対称グリッド
- **画像主導**: ポートフォリオ/サービスで画像が先、テキストが従
- **余白のリズム**: セクション間は広く、セクション内は密にまとめる

### 1.6 グラフィックデザイン分析

| 要素 | 使用状況 | 再現方法 |
|------|----------|----------|
| テクスチャ | 控えめな grain/紙質感 | 既存 grain-layer を opacity 0.02 で |
| 図形装飾 | セクションラベル前の横線 | ::before 擬似要素で 16px ライン |
| 写真処理 | 軽い彩度落とし + contrast 微調整 | saturate(0.92) contrast(1.02) |
| 影 | ほぼなし、hover 時のみ微shadow | translateY(-3px) + box-shadow |
| ボーダー | セクション区切りの 1px ライン | border-top/bottom |
| 背景装飾 | なし（写真とテキストのみ） | -- |
| セクション境界 | 色変化（白 ↔ オフホワイト）| background 交互 |
| overlay | Hero 画像に暗転グラデーション | linear-gradient rgba |

### 1.7 アニメーション分析

| アニメーション | 手法 | 実装 |
|----------------|------|------|
| 入場フェード | translateY(24px) + opacity | IntersectionObserver + CSS transition |
| スクロール連動 | view() timeline (対応ブラウザ) | CSS animation-timeline: view() |
| 画像 reveal | clip-path inset mask | scroll-driven animation |
| hover: 画像 | scale(1.03-1.04) | CSS transition 600-1000ms |
| hover: カード | translateY(-3px) + shadow | CSS transition 600ms |
| hover: リンク | underline scaleX + 色変化 | ::after pseudo + transform |
| hover: 矢印 | translateX(4px) | CSS transition 300ms |
| Hero 画像 | ゆっくり scale(1.03) | 8s transition on hover |
| スクロールインジケーター | 呼吸するライン | keyframes scaleY + opacity |
| easing | cubic-bezier(0.22, 1, 0.36, 1) | ease-out 系の「粘り」 |
| duration | 300-1000ms | fast/med/slow の 3 段階 |

### 1.8 インタラクション分析

| 要素 | スタイル |
|------|----------|
| ナビゲーション | ThemeSwitch で固定右上表示 |
| CTA ボタン | bordered (透明背景 + 1px ボーダー) |
| CTA リンク | 下線アニメ + 矢印 translateX |
| フォーム | 本テーマでは Contact リンクのみ |
| ジャーナル行 | hover で背景色変化 |
| カスタムカーソル | なし |
| ローディング | なし |

## 2. Theme D 設計仕様

### 2.1 ポジショニング

| Theme | 方向性 | キーワード |
|-------|--------|-----------|
| A | Warm Editorial | Terracotta x Moss、明朝+ゴシック |
| B | Monochrome Editorial | Ink x Paper、モノクロ写真 |
| C | Corporate Brand Firm | 白 x Navy、整然グリッド |
| **D** | **Creative Studio** | **画像主導、温かみ sans-serif、ストーリー** |

Theme D の差別化ポイント:
- **画像が主役**: Hero は全画面背景写真。Services/Projects も画像ファースト
- **温かみのある配色**: off-white (#FAF9F6) + forest green (#3A6B52) アクセント
- **ストーリーテリング**: About セクションで語りかけ調の長文
- **sans-serif 統一**: 明朝体を使わず、全体をゴシック体で統一
- **ポートフォリオ重視**: Projects セクションが大きな面積を占める

### 2.2 CSS 変数体系

```css
[data-theme="d"] {
  --d-bg: #FAF9F6;        /* warm off-white */
  --d-bg-alt: #F2F0EB;    /* section 切替用 */
  --d-ink: #1C1C1C;       /* メインテキスト */
  --d-ink-sub: #3D3D3D;   /* サブテキスト */
  --d-mute: #8A8580;      /* キャプション・ラベル */
  --d-line: #DBD8D2;      /* 罫線 */
  --d-line-strong: #1C1C1C; /* 強い罫線（フッター等） */
  --d-surface: #FFFFFF;    /* カード背景 */
  --d-accent: #3A6B52;    /* forest green アクセント */
  --d-accent-soft: #5A8A6A;
  --d-warm: #C4956A;      /* warm accent（未使用予備） */
}
```

### 2.3 セクション構成

1. **Hero**: 全画面背景画像 + overlay + 中央下テキスト + スクロールインジケーター
2. **About**: セクションラベル + H2 + 語りかけ調長文 + 右に画像
3. **Services**: 3 カードグリッド（画像上 + テキスト下）、hover scale
4. **Projects**: 3 カラムポートフォリオグリッド、カテゴリ + 年度 + タイトル
5. **Process**: 4 ステップ横並び、ボーダー区切り
6. **Journal**: 罫線リスト行、日付 + タグ + タイトル
7. **Company**: dl テーブル（罫線区切り）
8. **Contact**: 中央揃え CTA + メールリンク
9. **Footer**: 3 カラム情報フッター + コピーライト

### 2.4 画像仕様

| ファイル | 用途 | ソース | 処理 |
|---------|------|--------|------|
| hero.jpg | Hero 背景 | Pexels #3183150 | overlay gradient |
| about-workspace.jpg | About 右 | Pexels #4050291 | hover scale |
| service-erp.jpg | サービス 1 | Pexels #6801648 | hover scale |
| service-ai.jpg | サービス 2 | Pexels #8386440 | hover scale |
| service-bi.jpg | サービス 3 | Pexels #7947541 | hover scale |
| project-erp.jpg | 実績 1 | Pexels #5483077 | saturate(0.92) |
| project-ai.jpg | 実績 2 | Pexels #8438922 | saturate(0.92) |
| project-bi.jpg | 実績 3 | Pexels #7681091 | saturate(0.92) |

全画像 Pexels License (CC0 相当)。

### 2.5 コピーライティング方針

- **文体**: 語りかけ調。「わたしたちは〜」「〜しています」
- **リズム**: 1 文 20-40 字。重要箇所は体言止め
- **英字**: セクションラベルのみ。本文は和文
- **数値**: 具体的に。「月次 40 時間」「応答時間を 1/5 に」
- **マーケティング語回避**: 「No.1」「お任せ」「実現」等は不使用
- **goodthewhat のコピーは一字も転載していない**

### 2.6 アニメーション方針

- IntersectionObserver で `.is-visible` を付与し、CSS transition で fade-up
- `animation-timeline: view()` 対応ブラウザでは scroll-driven animation
- 非対応ブラウザは即表示（フォールバック）
- `prefers-reduced-motion: reduce` で全アニメーション停止
- 追加ライブラリ 0（既存の Lenis のみ）
- easing: `cubic-bezier(0.22, 1, 0.36, 1)` — 粘りのある ease-out

### 2.7 ファイル構成

```
app/proposal-d/
  layout.tsx          (data-theme="d" wrapper)
  page.tsx            (9 セクション RSC)

components/themes/d/
  hero.tsx            (use client)
  about.tsx           (use client)
  services.tsx        (use client)
  projects.tsx        (use client)
  process.tsx         (use client)
  journal.tsx         (use client)
  company.tsx         (use client)
  contact.tsx         (use client)
  footer.tsx          (RSC)
  use-in-view.ts      (use client, shared hook)

content/
  theme-d.ts          (全コピー)

public/images/theme-d/
  hero.jpg, about-workspace.jpg, service-*.jpg, project-*.jpg
  ATTRIBUTION.md
```

### 2.8 非破壊確認

- Theme A (`/`): 変更なし
- Theme B (`/proposal-b`): 変更なし
- Theme C (`/proposal-c`): 変更なし
- `globals.css`: Theme D ブロックを追加のみ。既存セレクタに影響なし
- `theme-switch.tsx`: D を追加、A/B/C のパス判定ロジックは保持
- `conditional-footer.tsx`: `/proposal-d` 判定を追加のみ

### 2.9 パフォーマンス

- First Load JS: 128 kB (shared) + 5.54 kB (page) = 133.54 kB
- Theme C と同程度（129 kB + 5.92 kB = 134.92 kB）
- 画像: next/image で自動最適化（AVIF/WebP、responsive sizes）
- Client Component: 8 ファイル（hero, about, services, projects, process, journal, company, contact）
- RSC: footer.tsx（use client 不要）
