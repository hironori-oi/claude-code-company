# Theme F (Korean Studio Aesthetic) -- 調査 + 仕様書

## 調査日: 2026-04-16
## 対象: ystudio.co.kr (韓国デザインスタジオ)

---

## Phase 1: 徹底調査結果

### A. ブランドポジション・世界観

ystudio は韓国ソウル拠点のクリエイティブデザインスタジオ。AI時代のデザイン力を前面に打ち出す先進的ポジション。「AI-Driven Creative Studio」を自称し、CreativeIntelligence（創造的知性）をコア概念に据える。

**世界観**: 自信に満ちたプロフェッショナリズム。装飾を排し、作品とタイポグラフィで語るスタイル。韓国デザインスタジオ特有の「洗練されたミニマリズム」が際立つ。

**パーソナリティ**: 知的、自信家、パートナーシップ志向、テクノロジーフレンドリー。

### B. カラーパレット

| 用途 | 色 | 備考 |
|------|-----|------|
| 背景（メイン） | #FFFFFF（白） | 圧倒的な白。余白が主役 |
| 背景（ダーク） | #0A0A0A | セクション切替・コントラスト |
| テキスト（主） | #0A0A0A | 限りなく黒に近い |
| テキスト（補助） | #333333 | 説明文用 |
| テキスト（淡） | #888888 | ラベル・キャプション |
| 罫線 | #E0E0E0 | 非常に薄い |
| アクセント | なし | モノクロ一本。色でアクセントを作らない |

**配色戦略**: 完全モノクロ。白と黒の面積比で視覚的リズムを生む。カラーアクセントに頼らず、タイポグラフィのサイズとウェイトで視線誘導。

### C. タイポグラフィ

**フォント構成**:
- 英字見出し: sans-serif、weight 200-300（極細で巨大）
- 英字ラベル: sans-serif、weight 400-500、letter-spacing 0.1-0.2em、UPPERCASE
- 韓国語本文: ゴシック体（Noto Sans KR 相当）、weight 400
- 韓国語見出し: ゴシック体 weight 700

**サイズ階層**:
- Display（Hero）: 10vw（120px相当）、weight 200、line-height 1.0
- H2（セクション見出し）: 3.5vw（40px相当）、weight 700
- H3（サブ見出し）: 22px、weight 500
- Body: 15px、line-height 1.8-1.9
- Label: 11px、letter-spacing 0.15-0.2em、uppercase

**特徴**:
- Hero の巨大タイポが最大の特徴。4行に分割した単語を画面いっぱいに
- CamelCase合成語（CreativeIntelligence）でブランドコンセプト表現
- 英語と韓国語の二層構造（見出しは英語、説明は韓国語）
- 大文字ラベルで構造を示す（ABOUT, WORKS, CONTACT）

### D. レイアウト

- max-width: 1280px（コンテンツエリア）
- padding: 5vw（レスポンシブ）
- Hero: 100vh、左寄せ
- セクション padding: 12vw（上下）
- グリッド: 2-4カラム、レスポンシブ
- 余白: 非常にジェネラス。セクション間は120-160px

**特徴**: フルブリード Hero + コンテナ内コンテンツの切替。対称ではなく左寄せ基調。

### E. グラフィックデザイン・イラスト

- テクスチャ: **なし**。完全フラット。grain/noise一切排除
- 図形装飾: 水平罫線（* --- *）でセクション区切り
- パターン: なし
- 写真処理: ノーフィルター、sharp corners（border-radius: 0）、hover時に微scale
- イラスト: なし。テキストとフォトで構成
- アイコン: 最小限。矢印のみ
- **特徴**: 装飾を徹底排除。コンテンツ自体が装飾。

### F. アニメーション

**Hero入場**: 
- 4行の単語が下から順にスライドイン
- 各行150msのスタガー
- easing: cubic-bezier(0.22, 1, 0.36, 1) -- fast out, slow settle
- duration: 1000ms

**スクロール連動**:
- fade-up（opacity + translateY 24px）
- IntersectionObserver トリガー
- stagger: 80-150msずつ遅延

**ホバー**:
- 画像: scale(1.03-1.04)、duration 1000ms
- リンク: opacity 0.5、duration 300ms
- ボタン: translateY(-2px) + opacity
- カード: border-color変化

**特徴**: 控えめだが確実なモーション。過度なエフェクトなし。crisp で confident。

### G. テキストスタイル

**文体**: 断言調。「わたしたちは〜と考えています」「〜を支えてきました」
**英語使い**: 見出し・ラベル・タグラインは英語、説明文は韓国語（→日本語に翻訳）
**CTA**: シンプルなテキストリンク + 矢印
**特徴**: パートナーシップを強調する語彙。AIを「置き換え」ではなく「支え」として位置付け。

---

## Phase 2: Theme F 仕様書

### コンセプト

**Theme F: Korean Studio Aesthetic**

ystudio.co.kr のデザイン言語を improver に翻訳。モノクロの力強さ、巨大タイポグラフィ、装飾排除の哲学を踏襲しつつ、広島の中小企業向けDX支援会社としてのオリジナルコンテンツで構成。

### 差別化ポイント

| テーマ | 方向性 | Theme F との違い |
|--------|--------|-----------------|
| A | warm editorial（煉瓦 × 苔） | F は完全モノクロ、装飾なし |
| B | monochrome editorial（墨 × 紙） | F はより大胆なタイポ、韓国的洗練 |
| C | corporate brand firm（白 × 紺） | F は企業感よりスタジオ感 |
| D | creative studio（warm × forest） | F は色を排除、テキスト主導 |
| E | 和モダン editorial（和紙 × 枯茶） | F は洋のミニマリズム、左寄せ |

### セクション構成

1. **Nav**: 固定ヘッダー。ロゴ左 + リンク右。モバイルハンバーガー
2. **Hero**: 100vh、巨大4行テキスト（Business / Intelligence / AI / Driven）
3. **About**: コンセプトワード + 日本語本文 + 画像ギャラリー
4. **Power**: ダーク背景、3カラムの強み紹介 + オリジナルSVG図形
5. **Works**: 2カラムグリッドのポートフォリオカード + バッジ
6. **Services**: 4つのサービスカード（ボーダー付き）
7. **Clients**: 業種タグのグリッド + 装飾SVG
8. **Contact**: ダーク背景、巨大 "Get In Touch" + CTA
9. **Footer**: ミニマル1行構成

### カラー仕様

```css
--f-bg: #FFFFFF;
--f-bg-alt: #F7F7F5;
--f-ink: #0a0a0a;
--f-ink-sub: #333333;
--f-mute: #888888;
--f-line: #E0E0E0;
--f-dark: #0a0a0a;
--f-light: #FFFFFF;
```

### タイポグラフィ仕様

```css
--f-display: clamp(48px, 10vw, 120px);  /* Hero巨大文字 */
--f-h1: clamp(36px, 7vw, 80px);
--f-h2: clamp(24px, 3.5vw, 40px);
--f-h3: clamp(16px, 1.8vw, 22px);
--f-body: 15px;
--f-label: 11px;
```

### アニメーション仕様

- fade-up: translateY(24px) → 0、opacity 0 → 1、600ms
- Hero stagger: 150ms/行
- hover image: scale(1.03-1.04)、1000ms ease-out
- hover link: opacity 0.5、300ms
- scroll indicator: pulse animation 2s infinite
- prefers-reduced-motion: 全アニメ停止

### グラフィック仕様

- grain/noise: **なし**（韓国スタジオのクリーンさ）
- 装飾SVG: 幾何学図形（円・四角・三角）をPowerセクションに
- 同心円SVG: Clientsセクションの装飾
- 罫線: * --- * パターン（ystudio準拠）
- 写真: border-radius: 0、hover scale

### コピー戦略

- **全テキスト improver オリジナル**（ystudio原文転載なし）
- 文体: ystudio風の断言調 + パートナーシップ語彙
- 英日二層: 見出し英語 + 説明日本語
- CamelCase: BusinessIntelligence（CreativeIntelligence手法の翻訳）
- 事業内容: GEN ERP / 生成AI / RPA・BI / 広島 / 大井信慶 / 2022年

### 画像

全画像 Pexels CC0:
- work-erp.jpg: Pexels #6476589
- work-ai.jpg: Pexels #8386434
- work-bi.jpg: Pexels #7947541
- work-web.jpg: Pexels #196644
- about-1.jpg: Pexels #3184291
- about-2.jpg: Pexels #3184339

### 実装詳細

- CSS変数スコープ: `[data-theme="f"]`
- 全クラスプレフィックス: `tf-`
- コンポーネント: 9ファイル（nav/hero/about/power/works/services/clients/contact/footer）
- コンテンツ: `content/theme-f.ts`
- ルーティング: `app/proposal-f/`
- ThemeSwitch: 6択に拡張（A/B/C/D/E/F）
- ConditionalFooter: /proposal-f 除外追加
- prefers-reduced-motion: 全アニメ分岐済み
- 追加ライブラリ: 0
