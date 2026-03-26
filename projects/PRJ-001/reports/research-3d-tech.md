# 紙袋3Dビューアー 技術調査レポート

- **調査日**: 2026-03-20
- **調査担当**: リサーチ部門
- **案件ID**: PRJ-001
- **ステータス**: 完了

---

## 1. 3Dレンダリングライブラリ比較

### 1-1. Three.js + React Three Fiber（R3F）

| 項目 | 評価 |
|------|------|
| React統合 | S（Reactネイティブレンダラー） |
| パフォーマンス | A |
| エコシステム | S（drei, postprocessing等） |
| 学習コスト | B（Three.js知識+React知識が必要） |
| コミュニティ | S（GitHub 30k+ stars, npm 週70万DL） |
| Next.js互換性 | A（公式対応、SSR回避設定が必要） |

**特徴**:
- React Three Fiber（R3F）はThree.jsのReactレンダラー。JSX宣言的に3Dシーンを構築可能
- `@react-three/drei` ライブラリが豊富なヘルパーを提供（OrbitControls、Environment、PBRマテリアル等）
- Three.jsの全機能にアクセス可能でありながら、Reactのコンポーネントモデルで管理できる
- WebGPU対応済み（Three.js r171以降、2025年9月～）、WebGLフォールバックも自動
- Next.js App Routerとの統合にはR3F v9（RCバージョン）を使用する必要あり（React 19対応）

**参考リンク**:
- [React Three Fiber 公式ドキュメント](https://r3f.docs.pmnd.rs/)
- [@react-three/fiber npm](https://www.npmjs.com/package/@react-three/fiber)
- [@react-three/drei npm](https://www.npmjs.com/package/@react-three/drei)

### 1-2. Babylon.js

| 項目 | 評価 |
|------|------|
| React統合 | C（ラッパーはあるが非公式的） |
| パフォーマンス | A |
| エコシステム | A（オールインワン） |
| 学習コスト | B（独自API体系） |
| コミュニティ | B（Microsoft支援、専門サポートあり） |
| Next.js互換性 | C（React統合が弱い） |

**特徴**:
- Microsoft支援のフル3Dエンジン。物理演算、GUI、アニメーション等が組み込み
- VR/AR（WebXR）に強い。ゲーム・シミュレーション向け
- React統合が弱く、Next.js App Routerとの相性に課題あり
- 本プロジェクトの用途（製品プレビュー）に対してはオーバースペック

**参考リンク**:
- [Babylon.js vs React Three Fiber比較](https://aircada.com/blog/babylon-js-vs-react-three-fiber)
- [Babylon.js vs Three.js比較](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)

### 1-3. その他の候補

| ライブラリ | 概要 | 本案件への適性 |
|-----------|------|--------------|
| PlayCanvas | ゲームエンジン寄り、エディタ付き | 不適（React統合なし、オーバースペック） |
| A-Frame | WebVR/AR向け宣言的フレームワーク | 不適（VR用途向け） |
| Model Viewer（Google） | 3Dモデルビューアーコンポーネント | 部分的（プリメイドモデル表示のみ、動的生成不可） |
| Spline | ノーコード3Dツール | 不適（プロシージャル生成不可） |

### 1-4. 比較結論

**React Three Fiber（R3F）が最適**。理由:

1. Next.js + TypeScript + React環境との親和性が最も高い
2. dreiライブラリにより開発効率が大幅に向上
3. プロシージャルジオメトリ生成が柔軟に可能
4. PBRマテリアル（MeshPhysicalMaterial）へのフルアクセス
5. エコシステムが最大で、情報・事例が豊富

---

## 2. 紙袋3Dモデリングのアプローチ

### 2-1. プロシージャルジオメトリ vs プリメイドモデル

| アプローチ | メリット | デメリット |
|-----------|---------|-----------|
| **プロシージャル（コード生成）** | サイズ変更がリアルタイム、ファイル不要、柔軟性高 | 複雑な形状の実装難度が高い |
| **プリメイドモデル（glTF）** | リアルな形状が容易、デザイナー協業可能 | サイズ変更が難しい、ファイル管理が必要 |
| **ハイブリッド** | 両方の利点を活用 | 実装の複雑さが増す |

**推奨: ハイブリッドアプローチ**

- **本体（袋部分）**: プロシージャルジオメトリで生成。BufferGeometryを使い、頂点座標をパラメトリックに計算する。サイズ入力に応じてリアルタイムに形状が変化
- **持ち手・ディテール**: 形状タイプごとにプロシージャルで生成するが、複雑すぎる場合はglTFパーツを用意してスケーリング

### 2-2. 各紙袋タイプの3D形状と実装方針

#### OFJ（手提げ紙袋）

```
形状特徴:
- 直方体ベースの袋本体
- 上部に折り返し（口折り）
- 紐またはリボンの持ち手（2本）
- マチ（側面の折り込み）あり

実装方針:
1. 本体: BoxGeometryベースをカスタム、上部を開口状に変形
2. マチ: 側面を内側に折り込んだ形状をプロシージャル生成
3. 持ち手: TubeGeometryまたはCatmullRomCurve3でアーチ状の紐を生成
4. 口折り: 上端の頂点を外側に折り返す変形
```

#### 角底袋

```
形状特徴:
- 直方体の底面（マチ付き角底）
- 上部は平らに閉じた状態
- 持ち手なし
- マチの折り目が特徴的

実装方針:
1. 本体: カスタムBufferGeometryで直方体+マチを生成
2. 底面: 角底の折り込み構造を頂点操作で表現
3. 上部: 折り畳まれた閉じ口を表現
4. 折り目: NormalMapまたは頂点の微小変位で表現
```

#### 小判抜き袋

```
形状特徴:
- 角底袋ベースの形状
- 上部に楕円形の持ち手穴（小判型）
- 穴の周囲に補強の折り返し

実装方針:
1. 本体: 角底袋と同様のベース形状
2. 持ち手穴: CSG（Constructive Solid Geometry）またはShapeGeometryで
   楕円をくり抜く。three-bvh-csgライブラリが有用
3. 穴の補強: 穴周辺の厚みを持たせる（ExtrudeGeometryで縁取り）
```

### 2-3. 共通実装パターン

```typescript
// パラメトリック紙袋生成の概念コード
interface BagParams {
  width: number;    // 幅 (mm)
  height: number;   // 高さ (mm)
  depth: number;    // 奥行き/マチ (mm)
  type: 'ofj' | 'kakuzoko' | 'koban';
}

// React Three Fiber コンポーネント例
function PaperBag({ width, height, depth, type }: BagParams) {
  const geometry = useMemo(() => {
    return generateBagGeometry(width, height, depth, type);
  }, [width, height, depth, type]);

  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial {...materialProps} />
    </mesh>
  );
}
```

---

## 3. マテリアル・テクスチャ表現

### 3-1. Three.jsのPBRマテリアル体系

Three.jsには2種類のPBRマテリアルがある:

| マテリアル | 用途 | 本案件での使用 |
|-----------|------|--------------|
| **MeshStandardMaterial** | 標準PBR、軽量 | クラフト紙（加工なし） |
| **MeshPhysicalMaterial** | 拡張PBR、clearcoat/sheen対応 | 表面加工あり |

### 3-2. 紙質の表現

#### クラフト紙

```
特徴: 粗い繊維感、温かみのある茶色、マットな質感
実装:
- map: クラフト紙テクスチャ（繊維パターン）
- normalMap: 紙の繊維による凹凸
- roughness: 0.85～0.95（非常にマット）
- metalness: 0.0
- color: #C4A77D（クラフト茶系）
- bumpMap: 微細な紙の凹凸用（オプション）
```

#### A2コート紙

```
特徴: 滑らかな表面、白色、印刷適性が高い
実装:
- map: 平滑な白色テクスチャ
- normalMap: 非常に弱い凹凸（ほぼ平滑）
- roughness: 0.5～0.7（やや光沢あり）
- metalness: 0.0
- color: #F5F5F0（オフホワイト系）
```

### 3-3. 表面加工の表現

MeshPhysicalMaterialの拡張プロパティを活用:

| 加工種類 | roughness | clearcoat | clearcoatRoughness | 視覚効果 |
|---------|-----------|-----------|-------------------|---------|
| **グロスニス** | 0.3 | 0.6 | 0.1 | 明るい光沢、下地の紙質は透ける |
| **マットニス** | 0.7 | 0.3 | 0.6 | 落ち着いたサテン調、微かな光沢 |
| **グロスPP** | 0.1 | 1.0 | 0.05 | 強い鏡面光沢、プラスチック的な反射 |
| **マットPP** | 0.6 | 0.8 | 0.4 | しっとりした質感、指紋がつく感じ |

**clearcoatの活用がポイント**:
- clearcoatは「透明な層が上に被さっている」効果を再現する
- ニス加工・PP加工は、紙の上にコーティング層があるため、clearcoatが物理的に正確
- clearcoatRoughnessでグロス/マットの差を表現

### 3-4. テクスチャリソース

PBRテクスチャセットを入手可能なソース:
- [TextureCan - Paper Textures](https://www.texturecan.com/category/Paper/) - 無料PBRテクスチャ
- [3D Textures - Paper](https://3dtextures.me/tag/paper/) - 無料PBR
- [Poliigon - Paper](https://www.poliigon.com/textures/paper) - 有料・高品質
- [AI Textured](https://aitextured.com/textures/paper/) - AI生成テクスチャ

テクスチャセットに含まれるマップ:
- Base Color Map（Diffuse）
- Normal Map
- Roughness Map
- Displacement Map（オプション）
- Ambient Occlusion Map（オプション）

---

## 4. パフォーマンス考慮

### 4-1. モバイル対応の注意点

| 項目 | 対策 |
|------|------|
| ポリゴン数 | 紙袋は単純形状なので1,000～5,000ポリゴンで十分。LOD不要 |
| テクスチャサイズ | 1024x1024pxを基本、モバイルでは512x512にフォールバック |
| シェーダー複雑度 | MeshPhysicalMaterialは重いため、モバイル検出時にMeshStandardMaterialにダウングレードも検討 |
| ピクセル比 | `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` で上限設定 |
| アンチエイリアス | モバイルではFXAAまたはOFF |
| 影（Shadow） | モバイルではContactShadowまたは簡易シャドウに限定 |

### 4-2. 最適化テクニック

```
1. useMemo: ジオメトリ生成をメモ化、パラメータ変更時のみ再計算
2. useFrame制御: レンダリングループを必要時のみ実行（invalidateOnDemand）
3. テクスチャ圧縮: KTX2形式でGPU圧縮テクスチャを使用
4. instancing: 同じマテリアルの複数オブジェクトはInstancedMeshで
5. Suspense: React.Suspenseでテクスチャロード中のフォールバック表示
```

### 4-3. Next.js App Routerとの共存

```typescript
// 方法1: dynamic importでSSR回避（推奨）
import dynamic from 'next/dynamic';

const BagViewer = dynamic(
  () => import('@/components/BagViewer'),
  { ssr: false }
);

// 方法2: 'use client' ディレクティブ
// BagViewer.tsx
'use client';
import { Canvas } from '@react-three/fiber';
```

**重要なポイント**:
- R3F v9（RCバージョン）を使用すること（React 19 / Next.js 15対応）
- Canvasコンポーネントは必ずクライアントコンポーネントで使用
- `dynamic(() => import(...), { ssr: false })` パターンが最も安全
- Server Componentsページ内にクライアントコンポーネントとして埋め込む構成

**インストールコマンド**:
```bash
npm install three @react-three/fiber@rc @react-three/drei@rc
npm install -D @types/three
```

---

## 5. 類似サービス・事例調査

### 5-1. 主要な紙袋/パッケージ3Dカスタマイザー

| サービス | URL | 特徴 |
|---------|-----|------|
| **Pacdora** | [pacdora.com](https://www.pacdora.com) | 最大手。7,000+モックアップ、紙袋50種以上。3Dクラウドレンダリング。ブラウザ完結 |
| **BOXLAB** | [boxlab.io](https://boxlab.io/) | 3Dプレビュー・レンダリング・エクスポートがブラウザ内で一体化 |
| **Grounded Packaging** | [groundedpackaging.co](https://www.groundedpackaging.co/blueprint) | ダイライン→3Dプロトタイプ変換ツール |
| **PrintXpand** | [printxpand.com](https://www.printxpand.com/package-design-software/) | EC店舗向けカスタムパッケージ3Dプレビュー |
| **Packify** | [packify.ai](https://www.packify.ai/) | AIベースのパッケージデザイン生成 |
| **Canva** | [canva.com](https://www.canva.com/create/paper-bag-mockups/) | モックアップジェネレーター（2D寄り） |

### 5-2. 競合分析から得られる知見

1. **Pacdoraの成功要因**: テンプレートの豊富さ、ワンクリック3Dレンダリング、デザイン入稿→即プレビューの体験
2. **差別化ポイント**: 多くの競合はデザインツール寄り。本プロジェクトは「サイズ指定→即座にリアルタイム3Dプレビュー」という見積もり・発注支援の用途で差別化可能
3. **UX参考**: ドラッグで回転、ピンチでズーム、パラメータスライダーでサイズ変更という操作体系が標準的

---

## 6. 推奨技術スタック

### 最終推奨

| カテゴリ | 技術 | バージョン目安 |
|---------|------|--------------|
| **3Dレンダリング** | Three.js | r170+ |
| **Reactバインディング** | @react-three/fiber | v9 (RC) |
| **ヘルパーライブラリ** | @react-three/drei | v9 (RC) |
| **型定義** | @types/three | 最新 |
| **CSG（穴あけ）** | three-bvh-csg | 最新 |
| **フレームワーク** | Next.js App Router + TypeScript | 15.x |
| **3Dモデリング手法** | ハイブリッド（プロシージャル主体） | - |
| **マテリアル** | MeshPhysicalMaterial (PBR) | - |
| **テクスチャ形式** | KTX2（GPU圧縮）+ PNG/JPGフォールバック | - |

### 推奨理由

1. **React Three Fiber**: Next.js + React環境で3Dを扱う場合の事実上の標準。宣言的APIにより保守性が高く、dreiの豊富なヘルパーで開発速度も確保できる

2. **ハイブリッドモデリング**: サイズのリアルタイム変更が必須要件のため、プロシージャルジオメトリが不可欠。複雑なディテール（持ち手紐など）はパーツ化してスケーリングで対応

3. **MeshPhysicalMaterial**: clearcoat/clearcoatRoughnessプロパティにより、ニス加工・PP加工の「コーティング層」を物理的に正確に再現可能。紙質×表面加工の組み合わせを効率的に表現できる

4. **KTX2テクスチャ**: GPU圧縮テクスチャにより、モバイルでのVRAM使用量とロード時間を大幅に削減

### リスク・注意事項

| リスク | 対策 |
|-------|------|
| R3F v9がRC段階 | 安定版リリースを注視。v8はReact 19非対応のため、v9 RC使用は妥当な判断 |
| プロシージャルジオメトリの複雑さ | 段階的に実装。まずOFJ（最も標準的）から着手し、角底袋・小判抜き袋と拡張 |
| モバイルパフォーマンス | マテリアルのダウングレード戦略を初期段階で設計しておく |
| 小判抜き袋のCSG | CSG演算はやや重いため、結果のキャッシュまたは事前計算を検討 |

### 実装優先度の提案

```
Phase 1: OFJ（手提げ紙袋）+ クラフト紙 + 加工なし
Phase 2: マテリアル拡張（A2コート紙、4種の表面加工）
Phase 3: 角底袋の追加
Phase 4: 小判抜き袋の追加（CSG実装）
Phase 5: パフォーマンス最適化・モバイル対応強化
```

---

## 参考文献・情報源

- [React Three Fiber 公式ドキュメント](https://r3f.docs.pmnd.rs/)
- [React Three Fiber GitHub](https://github.com/pmndrs/react-three-fiber)
- [@react-three/drei GitHub](https://github.com/pmndrs/drei)
- [react-three-next スターターテンプレート](https://github.com/pmndrs/react-three-next)
- [Three.js MeshPhysicalMaterial ドキュメント](https://threejs.org/docs/api/en/materials/MeshPhysicalMaterial.html)
- [Babylon.js vs React Three Fiber 比較](https://aircada.com/blog/babylon-js-vs-react-three-fiber)
- [Three.js vs Babylon.js vs PlayCanvas 比較ガイド 2026](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)
- [TextureCan - Paper PBRテクスチャ](https://www.texturecan.com/category/Paper/)
- [3D Textures - Paper](https://3dtextures.me/tag/paper/)
- [Pacdora 3D Paper Bag Mockup Generator](https://www.pacdora.com/tools/3d-paper-bag-mockup-generator)
- [BOXLAB パッケージデザインツール](https://boxlab.io/)
- [PBR Textures Using Three.js（Medium記事）](https://medium.com/@Makoto_29712/experimenting-with-pbr-textures-usingthree-js-a25aad28ed65)
- [Three.js プロシージャルジオメトリ解説](https://medium.com/@LEM_ing/procedural-generation-of-3d-objects-with-three-js-9874806da449)
