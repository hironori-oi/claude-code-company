# 開発レポート: 紙袋3Dビューアー

- **案件ID**: PRJ-001
- **担当**: 開発部門
- **作成日**: 2026-03-20
- **ステータス**: Phase 1 完了（全3タイプ実装済み）

---

## 1. 実装概要

紙袋3DビューアーWebアプリケーションの初期実装を完了した。ユーザーがサイズ・紙袋種類・紙質・表面加工を指定すると、リアルタイムで3Dプレビューが表示される。

### 技術スタック

| カテゴリ | 技術 | バージョン |
|---------|------|-----------|
| フレームワーク | Next.js (App Router) | 16.2.0 |
| 言語 | TypeScript | strict mode |
| UI | shadcn/ui (Base UI) + Tailwind CSS v4 | 最新 |
| 3Dレンダリング | Three.js + React Three Fiber | three@0.183, R3F@9 RC |
| 3Dヘルパー | @react-three/drei | v10 RC |
| CSG演算 | three-bvh-csg | 0.0.18 |
| テーマ | next-themes | 0.4.6 |
| フォント | Geist Sans + Geist Mono | geist パッケージ |

---

## 2. 実装内容

### 2.1 プロジェクト構成

```
src/
├── app/
│   ├── globals.css          # テーマ変数・Tailwind設定
│   ├── layout.tsx           # ルートレイアウト（ThemeProvider）
│   └── page.tsx             # メインページ（dynamic import）
├── components/
│   ├── bag-form.tsx         # 入力フォーム
│   ├── bag-viewer.tsx       # メインビューアー（フォーム+3D）
│   ├── theme-provider.tsx   # next-themes プロバイダー
│   ├── theme-toggle.tsx     # ダーク/ライト切替ボタン
│   ├── ui/                  # shadcn/ui コンポーネント
│   └── three/
│       ├── bag-scene.tsx    # 3Dシーン（Canvas, ライト, 環境）
│       ├── ofj-bag.tsx      # OFJ紙袋モデル
│       ├── kakuzoko-bag.tsx # 角底袋モデル
│       └── koban-bag.tsx    # 小判抜き袋モデル
├── lib/
│   ├── materials.ts         # マテリアル設定
│   └── utils.ts             # cn()ユーティリティ
└── types/
    └── bag.ts               # 型定義・定数
```

### 2.2 入力フォーム

- **サイズ入力**: 幅(100-600mm)・高さ(100-700mm)・奥行き(50-200mm)
  - 数値入力フィールド + スライダーの両方で操作可能
  - デフォルト値: 320 x 400 x 110 mm
- **紙袋の種類**: OFJ / 角底袋 / 小判抜き袋（Select）
- **紙質**: クラフト / A2コート（Select）
- **表面加工**: なし / グロスニス / マットニス / グロスPP / マットPP（Select）
- 現在の設定サマリーをフォーム下部に表示

### 2.3 3Dモデル実装

#### OFJ（手提げ紙袋）
- プロシージャルジオメトリで袋本体を生成
- 上部開口表現（頂点を外側に広げる）
- 口折り（上端の折り返し）
- マチ（側面の折り込み）をV字構造で表現
- CatmullRomCurve3 + TubeGeometryで紐持ち手を2本生成
- サイズパラメータに完全連動

#### 角底袋
- 直方体ベースの本体
- 上部の折り畳み閉じ口を表現
- 底面の折り込み構造（クリース表現）
- 持ち手なし

#### 小判抜き袋
- BoxGeometryベースの本体
- three-bvh-csgによるCSG演算で楕円形持ち手穴をくり抜き
- 穴周囲にShapeGeometryで補強リム
- CSG失敗時のフォールバック処理あり

### 2.4 マテリアルシステム

MeshPhysicalMaterialを使用し、紙質と表面加工の組み合わせを再現。

| 紙質 | color | roughness | metalness |
|------|-------|-----------|-----------|
| クラフト | #C4A77D | 0.9 | 0.0 |
| A2コート | #F5F5F0 | 0.6 | 0.0 |

| 加工 | roughness | clearcoat | clearcoatRoughness |
|------|-----------|-----------|-------------------|
| なし | 紙質デフォルト | 0 | 0 |
| グロスニス | 0.3 | 0.6 | 0.1 |
| マットニス | 0.7 | 0.3 | 0.6 |
| グロスPP | 0.1 | 1.0 | 0.05 |
| マットPP | 0.6 | 0.8 | 0.4 |

### 2.5 シーン設定

- Environment preset="studio" で自然な照明
- ContactShadows でソフトシャドウ
- OrbitControls（回転・ズーム、パン無効）
- カメラ初期位置: 斜め上方から（position=[3, 2.5, 4], fov=40）
- DPR上限: 2（パフォーマンス考慮）

### 2.6 レスポンシブ対応

- デスクトップ: 左側にフォーム(320px)、右側に3Dビューアー
- モバイル: 上部に3Dビューアー(50vh)、下部にフォーム(スクロール可能)
- ヘッダー: sticky、backdrop-blur

### 2.7 ダーク/ライトモード

- next-themesによるシステム設定連動
- Heroiconsスタイルのアイコンで切替ボタン
- suppressHydrationWarning設定済み

---

## 3. パフォーマンス最適化

- `useMemo` でジオメトリとマテリアル設定をメモ化
- `dynamic import` + `ssr: false` で3Dコンポーネントのサーバーサイドレンダリング回避
- `dpr={[1, 2]}` でピクセル比上限設定
- テクスチャ画像不使用（プロシージャル色指定のみ）

---

## 4. ビルド結果

- TypeScript strict mode: エラーなし
- Next.js production build: 成功
- dev server: HTTP 200 レスポンス確認

---

## 5. 対応済みの技術的課題

| 課題 | 対応 |
|------|------|
| Next.js 16でのSSR回避 | page.tsxに`'use client'`追加（Server Componentでは`ssr: false`不可） |
| Geistフォント設定 | geistパッケージをインストール、`@theme inline`にリテラルフォント名を設定 |
| shadcn/ui Slider型 | Base UIベースのSlider、onValueChangeの型をArray対応 |
| R3F Canvas pixelRatio | `gl.pixelRatio`ではなく`dpr`プロップを使用 |

---

## 6. 今後の改善提案

1. **テクスチャ追加**: クラフト紙の繊維感をプロシージャルノイズテクスチャで強化
2. **アニメーション**: 紙袋タイプ切替時のスムーズなトランジション
3. **印刷面プレビュー**: ユーザーが画像をアップロードして紙袋表面に適用
4. **寸法線表示**: 3Dビュー上に寸法を表示するオーバーレイ
5. **スクリーンショット機能**: 3Dビューをダウンロード可能にする
6. **モバイルパフォーマンス**: マテリアルのダウングレード戦略
7. **E2Eテスト**: Playwrightでのビジュアルリグレッションテスト追加

---

## 7. 起動方法

```bash
cd projects/PRJ-001/app
npm install
npm run dev
```

ブラウザで http://localhost:3000 にアクセス
