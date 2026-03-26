# PRJ-001 紙袋3Dビューアー - 品質レビューレポート

- **レビュー担当**: レビュー部門（品質管理）
- **レビュー日**: 2026-03-21
- **対象**: `projects/PRJ-001/app/src/` 配下 全17ファイル（.ts/.tsx）
- **判定**: **条件付き合格**

---

## 1. レビューサマリー

| 重大度 | 件数 |
|--------|------|
| Critical | 0 |
| Major | 7 |
| Minor | 11 |

Critical指摘はなし。Major指摘が7件あるが、いずれもアプリケーションの安定動作を妨げるものではなく、修正後の再レビューは不要と判断する。よって**条件付き合格**とする。

---

## 2. 指摘事項一覧

### 2.1 Major（強く推奨）

#### M-01: Three.jsジオメトリのメモリリーク
- **ファイル**: `src/components/three/ofj-bag.tsx:167-180`, `kakuzoko-bag.tsx:119-122`, `koban-bag.tsx:108-115`
- **問題**: `useMemo` でジオメトリを生成しているが、依存配列が変わった際に旧ジオメトリの `dispose()` が呼ばれない。サイズ変更を繰り返すとGPUメモリリークが発生する。
- **推奨修正**: `useEffect` のクリーンアップで `geometry.dispose()` を呼ぶか、`useMemo` の代わりに `useEffect` + `useRef` パターンに変更し、旧ジオメトリを確実に破棄する。

#### M-02: useFrame内での毎フレームオブジェクト生成
- **ファイル**: `src/components/three/ofj-bag.tsx:191`, `kakuzoko-bag.tsx:133`, `koban-bag.tsx:126`
- **問題**: `useFrame` コールバック内で毎フレーム `new THREE.Color(materialProps.color)` を生成している。60fpsで毎フレームオブジェクト生成はGCプレッシャーを生じ、フレーム落ちの原因となる。
- **推奨修正**: `targetColor` を `useRef` で保持し、`materialProps.color` が変わったときだけ更新する。

#### M-03: koban-bag.tsx CSG演算のパフォーマンス懸念
- **ファイル**: `src/components/three/koban-bag.tsx:50-63`
- **問題**: `useMemo` 内でCSG（Constructive Solid Geometry）演算を行っているが、サイズ変更のたびに重い演算が走る。CSG失敗時のフォールバックは設けているが、ユーザー操作のレスポンスが悪化する可能性がある。
- **推奨修正**: サイズ変更をデバウンスしてCSG演算の頻度を下げるか、Web Workerでオフスレッド化する。少なくともコンソールに警告ログを出して問題を可視化すべき。

#### M-04: clipboard API のエラーハンドリング欠如
- **ファイル**: `src/components/bag-viewer.tsx:242-244`
- **問題**: `navigator.clipboard.writeText()` の `.catch()` がないため、クリップボードAPIが利用できない環境（HTTP、一部ブラウザ）でPromise rejectionが未処理となる。
- **推奨修正**: `.catch()` を追加し、フォールバック（例: `document.execCommand('copy')` やエラートースト表示）を実装する。

#### M-05: URL パラメータの `bagColor` バリデーション不足
- **ファイル**: `src/components/bag-viewer.tsx:70`
- **問題**: `decodeParamsToConfig` で `bagColor` は `params.get("color") || "default"` としているが、不正な文字列（例: `javascript:` URI、非常に長い文字列）がそのまま `style` の `backgroundColor` に渡される。XSSリスクは低い（Reactがサニタイズする）が、CSSインジェクションの可能性がある。
- **推奨修正**: 色の値を `#` + 6桁の16進数 または `"default"` に限定するバリデーションを追加する。

#### M-06: localStorage読み取り時のデータ検証不足
- **ファイル**: `src/lib/history.ts:26-29`
- **問題**: `JSON.parse(raw) as HistoryEntry[]` でキャストしているが、各エントリの構造（config の各プロパティが存在するか、型が正しいか）を検証していない。他のスクリプトや手動でlocalStorageを改変された場合、ランタイムエラーが発生する。
- **推奨修正**: Zodなどのスキーマバリデーションを導入するか、最低限各フィールドの存在チェックを行う。

#### M-07: 3Dビューアーのキーボードアクセシビリティ不足
- **ファイル**: `src/components/three/bag-scene.tsx:328-338`
- **問題**: プリセットビューボタンに `aria-label` がなく、`title` のみ。また、3Dキャンバス領域がキーボードフォーカスを受け取れるが、Escapeキーでフォーカスを離脱する手段がない。スクリーンリーダーユーザーにとってトラップとなる可能性がある。
- **推奨修正**: プリセットビューボタンに `aria-label` を追加。キャンバス領域に `aria-roledescription="3Dビューアー"` とEscapeキーハンドラを追加する。

---

### 2.2 Minor（改善提案）

#### m-01: useFrame アニメーションロジックの重複
- **ファイル**: `ofj-bag.tsx:187-213`, `kakuzoko-bag.tsx:129-155`, `koban-bag.tsx:122-158`
- **問題**: 3つの袋コンポーネントで色・マテリアルのアニメーションロジックがほぼ同一。
- **推奨修正**: カスタムフック `useMaterialAnimation` に抽出し、DRY原則に従う。

#### m-02: addTriangle / addQuad ヘルパーの重複
- **ファイル**: `ofj-bag.tsx:72-88`, `kakuzoko-bag.tsx:18-33`
- **問題**: 同一のジオメトリ生成ヘルパー関数が2ファイルに存在する。
- **推奨修正**: 共通ユーティリティ `src/lib/geometry-helpers.ts` に抽出する。

#### m-03: マジックナンバーの散在
- **ファイル**: `ofj-bag.tsx:15-17`, `kakuzoko-bag.tsx:10-12`, `koban-bag.tsx:15-17`
- **問題**: `0.005`（mmからシーン単位への変換係数）が各ファイルにハードコードされている。`comparison-objects.tsx:10` と `dimension-lines.tsx:12` では同じ意味の値だが別の定数名 `SCALE` として定義。
- **推奨修正**: `src/types/bag.ts` か `src/lib/constants.ts` に `MM_TO_SCENE_UNIT = 0.005` として一元管理する。

#### m-04: InteractionGuide の role 属性不足
- **ファイル**: `src/components/bag-viewer.tsx:88-175`
- **問題**: モーダル風のオーバーレイだが `role="dialog"` や `aria-modal` が設定されていない。
- **推奨修正**: `role="dialog"` と `aria-modal="true"` を追加し、Escapeキーでの閉じる操作も実装する。

#### m-05: テーマトグルの3状態対応不足
- **ファイル**: `src/components/theme-toggle.tsx:28`
- **問題**: `theme === "dark" ? "light" : "dark"` で2値トグルしているが、`defaultTheme="system"` を使っているため、`theme` が `"system"` の場合もある。初回クリックで意図しない切替が起こる可能性がある。
- **推奨修正**: `resolvedTheme` を使用して現在の実効テーマに基づいてトグルする。

#### m-06: HistorySection のポーリング
- **ファイル**: `src/components/bag-form.tsx:183-186`
- **問題**: `setInterval(refreshHistory, 2000)` で2秒ごとにlocalStorageを読んでいる。パフォーマンスへの影響は軽微だが、不要な処理。同一タブ内の変更はstorageイベントで検知できないため、親コンポーネントからのコールバックで更新トリガーする方が適切。
- **推奨修正**: `BagForm` に `historyVersion` カウンターをpropとして渡し、設定変更時にインクリメントする。

#### m-07: comparison-objects.tsx の side={2} マジックナンバー
- **ファイル**: `src/components/three/comparison-objects.tsx:84`
- **問題**: `side={2}` は `THREE.DoubleSide` の数値リテラル。他のファイルでは `THREE.DoubleSide` を使用しており一貫性がない。
- **推奨修正**: `THREE.DoubleSide` に統一する。

#### m-08: bag-viewer.tsx の updateUrl が replaceState のみ
- **ファイル**: `src/components/bag-viewer.tsx:217`
- **問題**: `window.history.replaceState` のみ使用しているため、ブラウザの「戻る」ボタンで前の設定に戻れない。ユーザビリティとしてはトレードオフだが、意図的な設計判断であるべき。
- **推奨修正**: 設計判断としてコメントを残す。または初期値からの変更時のみ `pushState` にすることを検討。

#### m-09: BagForm の updateConfig が useCallback でない
- **ファイル**: `src/components/bag-form.tsx:233-235`
- **問題**: `updateConfig` 関数が毎レンダリングで再生成される。子コンポーネントへの不要な再レンダリングを引き起こす可能性がある。
- **推奨修正**: `useCallback` でラップするか、`onChange` を直接使用する。

#### m-10: screenshot機能のフォント指定
- **ファイル**: `src/components/bag-viewer.tsx:267`
- **問題**: `ctx.font` で `sans-serif` を指定しているが、ユーザー環境によりフォントが異なる。スクリーンショットの一貫性が保てない。
- **推奨修正**: Geist Sansを読み込んでいるので、フォントファミリに `"Geist", sans-serif` を指定する（Canvas APIでWebFontが利用可能かは別途確認要）。

#### m-11: SceneControls の onControlsRef が useEffect 依存配列で不安定
- **ファイル**: `src/components/three/bag-scene.tsx:146-149`
- **問題**: `onControlsRef` が依存配列に入っているが、親で `useCallback` されているとはいえ、`controlsRef.current` の設定タイミングと `useEffect` の発火タイミングが一致しない可能性がある。
- **推奨修正**: コールバックrefパターン（`ref` propにコールバック関数を渡す）の使用を検討。

---

## 3. 良い点（特に評価できるコード品質）

### 3.1 型安全性
- `BagType`, `PaperType`, `SurfaceFinish` がユニオン型で定義され、`Record<BagType, string>` でラベルマップと連動している。型レベルで網羅性が保証されており、新しい袋種類の追加時にコンパイルエラーで漏れを検知できる。`any` の使用は一切ない。

### 3.2 アクセシビリティへの配慮
- `buildAriaLabel` で3Dビューアーの内容をテキストで説明している。
- `aria-pressed` でトグルボタンの状態を伝えている。
- `aria-label` が全てのアイコンボタンに設定されている。
- `role="status"` と `aria-live="polite"` でトースト通知をスクリーンリーダーに伝えている。
- `useReducedMotion` で `prefers-reduced-motion` を尊重し、自動回転を無効化している。

### 3.3 パフォーマンス最適化
- `PerformanceMonitor` で動的にDPRとSSAOを調整する適応型パフォーマンス管理が実装されている。
- `dynamic import` + `ssr: false` で3Dライブラリをクライアント限定にし、バンドルサイズを最適化。
- 履歴保存のデバウンス（500ms）で不要なlocalStorage書き込みを抑制。
- `useMemo` によるジオメトリとマテリアルプロパティのキャッシュ。

### 3.4 URL共有機能
- URLパラメータによる設定の永続化と共有が適切に実装されている。`decodeParamsToConfig` で不正値のフォールバックも設けている。

### 3.5 コンポーネント設計
- 責務が明確に分離されている（フォーム / 3Dシーン / 各袋モデル / 寸法線 / 比較オブジェクト）。
- `BagConfig` を単一のデータモデルとして全コンポーネントで共有し、データフローが一方向で追いやすい。

### 3.6 UX品質
- 初回訪問時の操作ガイド表示（再訪時は非表示）。
- マテリアル変更時のスムーズなアニメーション遷移。
- カメラ遷移のイージング処理。
- プリセット設定による素早い体験開始。

### 3.7 エラーハンドリング
- `history.ts` で localStorage アクセスを全て try-catch で保護。
- `koban-bag.tsx` でCSG演算失敗時のフォールバックを実装。
- SSR環境での `typeof window === "undefined"` ガード。

---

## 4. 総合評価

PRJ-001「紙袋3Dビューアー」は全体として高い品質で実装されている。TypeScriptの型安全性、アクセシビリティ、パフォーマンス最適化、UX品質のいずれにおいても良好なレベルにある。

**最優先で対応すべき事項:**
1. **M-01 ジオメトリのメモリリーク** -- サイズをリアルタイム変更する性質上、長時間使用でメモリ不足に至る可能性がある
2. **M-02 useFrame内のオブジェクト生成** -- 60fpsで動作する処理のため、パフォーマンスへの影響が大きい
3. **M-04 clipboard APIのエラーハンドリング** -- HTTP環境で例外が発生しユーザー体験を損なう

**次点で対応すべき事項:**
4. M-05 URLパラメータのバリデーション強化
5. M-06 localStorageデータの検証
6. M-07 キーボードアクセシビリティの強化

Minor指摘はリファクタリングフェーズでの対応を推奨する。特にm-01（アニメーションロジックの重複抽出）とm-03（マジックナンバーの一元管理）は保守性向上に直結する。

**判定: 条件付き合格** -- Major指摘（特にM-01, M-02, M-04）の修正を条件とする。修正後の再レビューは不要。
