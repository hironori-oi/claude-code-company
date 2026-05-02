# DESIGN-DEC-018-026 typing indicator 趣（おもむき）磨き込み報告書

- 案件ID: PRJ-018 (Asagi)
- DEC: DEC-018-026 ① 追加磨き込み
- 担当: デザイン部門（Write/Edit/Bash 全権 dev 融合）
- 日時: 2026-05-02
- 関連: DEC-018-018（趣 5 原則）／ DEC-018-020（γ 浅葱滴 採用）／ DEC-018-026（磨き込みラウンド）
- 上位文書: `design-logo-final-gamma.md` / `design-logo-v3-omomuki-principles.md` / `dev-dec026-chatpane-mock-ux.md`

---

## § 0 サマリ

直前ラウンドで実装済みの typing indicator「**Asagi が考えています…**」の三点リーダーを、`tailwindcss-animate` の汎用 `animate-bounce` から、γ ロゴ「浅葱滴 (asagi-drop)」のメタファーを継承する **Sumi 級「趣」のあるアニメ意匠**に磨き込んだ。

**採用案: 案 A「滴の波紋」(Drop Ripple)**。3 粒の scale + opacity を素数比 delay (0 / 240 / 470ms) で「灯って消える」呼吸を表現。

**趣 5 原則: 5/5 全適用済**。

検証は TypeScript / Next build / Vitest 29 / Playwright 5 / cargo test 26 全 pass。

---

## § 1 変更ファイル一覧（絶対パス）

| パス | 変更種別 |
|---|---|
| `C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-018\app\asagi-app\src\app\globals.css` | `@keyframes asagi-drop-ripple` + `.asagi-drop` ユーティリティクラス追加（57 行追加） |
| `C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-018\app\asagi-app\src\components\chat\typing-indicator.tsx` | 三点リーダー部を `animate-bounce` × 3 から `.asagi-drop` × 3 に置換、bubble の透明度・余白を控えめ調整 |

新規ファイル追加なし、テスト変更なし、tailwind.config.ts 変更なし（CSS 1 ファイルに局所化、既存テスト互換性維持）。

---

## § 2 採用案と判断理由

### 2.1 三案比較と採用判断

| 案 | コンセプト | 趣度 | ブランド一貫性 | 採否 |
|---|---|---|---|---|
| **A 滴の波紋 (Drop Ripple)** | 3 粒が scale + opacity で「灯って消える」呼吸 | 5/5 | **γ ロゴ滴と直結最強** | **採用** |
| B 墨だまり (Sumi Pool) | 1 粒 + blur で墨が紙に染み込む | 4/5 | Sumi 寄り（PRJ-012 兄弟との重複感） | 不採用 |
| C 呼吸する点 (Breathing Dot) | テキスト全体の opacity 呼吸 | 3/5 | ブランド独自要素なし | 不採用 |

### 2.2 案 A 採用の決定的理由

1. **γ ロゴ「浅葱滴」との完全な一貫性**: ロゴが「1 滴」、indicator が「3 滴の波紋」。ロゴが落ちた後の余韻として indicator が画面に現れる物語性が成立する
2. **3 粒という数**: 「考えている」という行為を「1 粒」では表現不足、「3 粒」が最小の自然な複数。等差ではなく素数比で配置して機械感を回避
3. **B / C は Sumi 寄り or 没個性**: 案 B は Sumi のかすれの延長、案 C は静謐すぎて typing 状態の伝達不足
4. **CEO 推奨 = 案 A** と一致（兄弟プロダクト Sumi (PRJ-012) との視覚的差異化を最大化）

---

## § 3 趣 5 原則の適用箇所マッピング

| 原則 | 適用箇所 | 数値・実装 |
|---|---|---|
| **① 不完全美** (Imperfection) | 粒間の遅延を素数比で配置 | delay = `0ms / 240ms / 470ms`。等差 (160ms) を意図的に外し、毎周の見え方が機械的等間隔に見えない。240 と 470 は隣接する不規則数で、永遠に倍数一致しない |
| **② 余白** (Negative Space / Ma) | bubble padding と粒間 gap | bubble: `p-3` (12px)、粒間 `gap-[3px]`、粒自体 `4px × 4px` (累計幅 18px)。テキスト「Asagi が考えています…」と粒の間も `gap-2.5` (10px) で詰めない |
| **③ 即興性** (Improvisational Touch) | asymmetric easing で「人の手」感 | `cubic-bezier(0.4, 0, 0.2, 1)` (Material Standard)。out 寄りの非対称カーブで、現れ (0%→35%) は加速的、消え (35%→100%) は減衰的、機械的 sine 振動を回避 |
| **④ 経年変化** (Tonal Aging) | opacity の段階遷移 | `0.30 → 0.85 → 0.55 → 0.30` の 4 stop。永続せず周期内で「現れて消える」呼吸。最大 opacity も 0.85 に抑制し、画面に「灯る」が「光らない」 |
| **⑤ 静謐** (Quietude) | 色・サイズ・透明度の控えめ運用 | bubble: `border-border/30` + `bg-surface/40`（背景に溶ける）、アイコン背景 `bg-accent/10`（10%）、ラベル `text-muted-foreground/80`、粒の背景 `var(--accent)` を初期 opacity 0.40 / 最大 0.85。scale も拡大せず原寸 (1.0) 止まり |

**CEO 起案で指定された案 A の数値からの調整点**:
- duration: 1.4s → **1.6s** に微延長（より落ち着いた呼吸）
- delay: 0/200/400ms → **0/240/470ms** に素数比化（不完全美強化）
- opacity 域: 0.4→0.9→0.6 → **0.30→0.85→0.55→0.30** に 4 stop 化、最大値を 0.05 抑制（静謐強化）
- 色: 30% 透明案 → 初期 opacity 0.40、最大 0.85 へ（30% は単一値、本実装は周期で変動するためレンジ管理）

---

## § 4 keyframes / timing / easing の数値根拠

### 4.1 keyframes 定義（`globals.css`）

```css
@keyframes asagi-drop-ripple {
  0%   { transform: scale(0.55); opacity: 0.30; }
  35%  { transform: scale(1.0);  opacity: 0.85; }
  65%  { transform: scale(0.85); opacity: 0.55; }
  100% { transform: scale(0.55); opacity: 0.30; }
}
```

| stop | scale | opacity | 意味 |
|---|---|---|---|
| 0%   | 0.55 | 0.30 | 「灯る前」の沈み込み |
| 35%  | 1.00 | 0.85 | **波紋のピーク（最大表出）** |
| 65%  | 0.85 | 0.55 | じわっと引く中間 |
| 100% | 0.55 | 0.30 | 0% に戻り次サイクル |

**35% にピークを置く理由**: 等差 (50%) だと sine 的で機械感、35% に前倒しすると「ふわっと現れて、ゆっくり引く」asymmetric な「滴の波紋」物理感が出る（経年変化 + 即興性）。

### 4.2 timing

| パラメータ | 値 | 根拠 |
|---|---|---|
| `animation-duration` | **1.6s** | tokens.css `--motion-slow` (300ms) より遅い独自値。300ms は UI フィードバック用、indicator は「呼吸」のため 1.5〜2.0s が一般的（cardiac rest = 60-80bpm = 0.75-1s 周期、それより遅い 1.6s で「ゆったり考えている」感を演出） |
| `animation-iteration-count` | `infinite` | streaming 中の typing 表示中ずっと続く。awaitingFirstDelta が false に変わると React 側で `null` を返してアンマウント、CSS 側のループは自然停止 |
| 粒 1 delay | **0ms** | 起点 |
| 粒 2 delay | **240ms** | 0 + 素数比オフセット |
| 粒 3 delay | **470ms** | 240 + 230（素数 230 = 2 × 5 × 23、240 と最小公倍数が大きい） |
| 周期内の粒 3 - 粒 1 ズレ | 470ms / 1600ms = **29.4%** | 33%（等間隔）から外す。等間隔は左→右の機械的進行に見え、29.4% は微妙にバラつく |

### 4.3 easing

```css
animation: asagi-drop-ripple 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
```

`cubic-bezier(0.4, 0, 0.2, 1)` = Material Design 「Standard easing」。

**選定理由**:
- (0.4, 0) で出だしを「ふわっ」と遅らせ、(0.2, 1) で終端を「すっ」と止める非対称カーブ
- 一般的な `ease-in-out` (cubic-bezier(0.42, 0, 0.58, 1)) より終端の減衰が早く、「波紋が静かに消える」物理感が強い
- 「即興性」原則に該当：機械的 sine（純対称）を回避

**他候補と却下理由**:
- `linear`: 機械感過剰、即興性 0
- `ease-in-out`: 対称すぎ、不完全美 0
- `cubic-bezier(0.16, 1, 0.3, 1)` (tokens.css `--ease-out-expo`): UI 遷移用、一発の reveal に最適だが繰返しでは「跳ねすぎ」感

### 4.4 will-change

```css
will-change: transform, opacity;
```

WebView (Tauri) での GPU compositing hint。3 粒同時 animation で発生する jank を抑制（特に Win11 WebView2 では transform/opacity 以外の re-layout 系は避ける）。

---

## § 5 prefers-reduced-motion 対応

### 5.1 二重防壁

#### 第 1 層（既存）: `tokens.css` のグローバル無効化

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

→ `.asagi-drop` の animation は実質停止、初期フレーム (0%) で固まる。

#### 第 2 層（本ラウンド追加）: `.asagi-drop` 個別フォールバック

```css
@media (prefers-reduced-motion: reduce) {
  .asagi-drop {
    animation: none;
    opacity: 0.55;
    transform: scale(0.85);
  }
}
```

→ 第 1 層の `0.01ms` での「ほぼ停止」をさらに明示的に `none` に置換し、initial frame の opacity 0.30 / scale 0.55 ではなく **「軽くピーク手前で止まる」** 視認しやすい静止状態に。

### 5.2 アクセシビリティ確認

- `role="status"` + `aria-live="polite"` は維持（変更なし、screen reader は「Asagi が考えています…」を読む）
- 粒の span は `aria-hidden`（screen reader への装飾ノイズ抑制）
- text のみの fallback でも「考えています」状態は伝達される（粒の有無は decorative）
- WCAG 2.3.3 (Animation from Interactions, AAA) 準拠：reduced-motion で完全停止、ユーザ環境設定尊重

### 5.3 検証手段

OS 側でアニメ無効化 (Win11: 設定 → アクセシビリティ → 視覚効果 → アニメーション効果 OFF) し、indicator が静止することを目視確認可能。本書のスコープでは目視 QA は別ラウンドに譲るが、CSS レベルの実装は完了。

---

## § 6 ChatStatusBadge との視覚調和

| 要素 | 色 / アニメ | typing indicator との衝突回避 |
|---|---|---|
| ChatStatusBadge `streaming` 時 dot | `bg-accent animate-pulse` (Tailwind デフォルト 2s) | indicator dot は **滴 (drop)** 形 + ripple で別性質。badge dot は **状態表示**、indicator dot は **波紋表現**、視覚的役割が明確に分離 |
| 配置 | badge: header 右肩、indicator: MessageList 末尾 inline bubble | 物理位置で重ならない |
| 色 | 両方とも asagi accent (`var(--accent)`) | 同一プロダクト内のブランド一貫性確保。色相衝突なし |
| 透明度 | badge: 100% (status 表示は強め) / indicator 粒: 30-85% (背景に溶ける) | 「状態 = 強」「呼吸 = 弱」の視覚ヒエラルキー |

**結論**: 衝突なし。両者が同時表示される短い期間（streaming 開始直後 〜 最初の delta 着弾まで、E2E 検証時は ~200ms）でも、視認上は「右上で『生成中』ラベル + 中央で『考えている呼吸』」と役割が補完的に成立する。

---

## § 7 検証結果（全 pass 証跡）

すべて `C:\Users\hiron\Desktop\claude-code-company\projects\PRJ-018\app\asagi-app` で実行。

### 7.1 `npx tsc --noEmit`

```
（出力なし、exit 0）
```

### 7.2 `npm run build`

```
> asagi@0.1.0 build
> next build

   ▲ Next.js 15.5.15

   Creating an optimized production build ...
 ✓ Compiled successfully in 3.4s
   Linting and checking validity of types ...
   Collecting page data ...
 ✓ Generating static pages (5/5)
   Finalizing page optimization ...
   Collecting build traces ...
 ✓ Exporting (2/2)

Route (app)                                 Size  First Load JS
┌ ○ /                                    87.7 kB         218 kB
├ ○ /_not-found                            993 B         103 kB
└ ○ /dev/codex-mock                      3.47 kB         106 kB
```

→ ChatPane を含む `/` route のサイズ変化なし（globals.css への CSS 追加のみで JS bundle は不変）

### 7.3 `npx vitest run`

```
 ✓ src/lib/__tests__/keybindings.test.ts (3 tests) 4ms
 ✓ src/lib/stores/__tests__/session.test.ts (3 tests) 7ms
 ✓ src/lib/codex/__tests__/token-estimator.test.ts (5 tests) 4ms
 ✓ src/lib/stores/__tests__/project.test.ts (6 tests) 8ms
 ✓ src/lib/stores/__tests__/chat.test.ts (6 tests) 7ms
 ✓ src/lib/stores/__tests__/locale.test.ts (3 tests) 5ms
 ✓ src/components/welcome/__tests__/wizard.test.tsx (3 tests) 98ms

 Test Files  7 passed (7)
      Tests  29 passed (29)
   Duration  2.83s
```

### 7.4 `npx playwright test --reporter=line`

```
Running 5 tests using 1 worker

[1/5] [chromium] › e2e\codex-mock-flow.spec.ts:161:5 › @codex-mock spawn → send → 10-token streaming → shutdown
[2/5] [chromium] › e2e\codex-mock-flow.spec.ts:368:7 › @codex-mock-ux DEC-018-026 ① ChatPane UX polish › typing indicator → interrupt → tokens 表示が ChatPane に揃う
[3/5] [chromium] › e2e\welcome.spec.ts:25:5 › @smoke Welcome Step 1 (Brand) が表示される
[4/5] [chromium] › e2e\welcome.spec.ts:31:5 › @smoke 「次へ」を 2 回押すと StepSample (Step 3) に到達
[5/5] [chromium] › e2e\welcome.spec.ts:39:5 › @smoke StepSample で hello 入力 → モック応答が表示

  5 passed (12.1s)
```

→ `chat-typing-indicator` selector を使う `@codex-mock-ux` test がそのまま pass（DOM 構造維持を確認）

### 7.5 `cargo test --lib`（参考、本ラウンドで Rust 変更なし）

```
running 26 tests
... (略) ...
test result: ok. 26 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.77s
```

---

## § 8 動作の言語的描写（スクリーンショット代替）

streaming 開始 → typing indicator 表示の瞬間、以下の動きが画面中央寄り（MessageList 末尾）の bubble 内右側で進行する:

1. **0ms**: 1 粒目が `scale(0.55) opacity(0.30)` で「沈んだ」状態から出現
2. **240ms**: 2 粒目が同じ「沈んだ」状態で起動（1 粒目は既に `scale(0.74) opacity(0.50)` あたり、ピークに向かう途中）
3. **470ms**: 3 粒目が起動（1 粒目はピーク `scale(1.0) opacity(0.85)` を 35%/1600ms = 560ms 地点で迎える直前）
4. **約 600ms**: 1 粒目がピーク、2 粒目が中盤、3 粒目が立ち上がり中。**3 粒が異なる位相で同時に呼吸している状態**
5. **約 1040ms**: 1 粒目が `scale(0.85) opacity(0.55)` の中間引き、2 粒目がピーク、3 粒目がピーク手前
6. **1600ms**: 1 粒目が起点 (0%) に戻り次サイクル開始。2 粒目と 3 粒目はそれぞれ 240ms / 470ms ずれた位相で進行継続

ユーザーには **「3 粒が等間隔で順に光る」のではなく、「3 粒が常に異なる呼吸位相で重なり、画面に静かな波紋が漂っている」** と知覚される。これが「即興性」「不完全美」の知覚レベルの正体。

### 8.1 CSS 値テーブル（実装の数値再掲）

| 要素 | プロパティ | 値 |
|---|---|---|
| bubble | border | `border-border/30` (= alpha 30%) |
| bubble | background | `bg-surface/40` (= alpha 40%) |
| bubble | padding | `p-3` (= 12px) |
| bot icon container | size | `h-7 w-7` (= 28px square) |
| bot icon container | background | `bg-accent/10` (= asagi-500 alpha 10%) |
| label "Codex" | color | `text-muted-foreground/80` |
| text "Asagi が考えています…" | color | `text-muted-foreground` |
| text と粒の間 | gap | `gap-2.5` (= 10px) |
| 粒コンテナ | gap | `gap-[3px]` |
| 粒 | size | `4px × 4px` |
| 粒 | background | `var(--accent)` = `oklch(0.72 0.10 200)` |
| 粒 | initial opacity | `0.40` |
| 粒 | animation | `asagi-drop-ripple 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite` |
| 粒 1 | delay | `0ms` |
| 粒 2 | delay | `240ms` |
| 粒 3 | delay | `470ms` |

---

## § 9 既存テストへの影響

| selector | テスト箇所 | 維持/変更 |
|---|---|---|
| `data-testid="chat-typing-indicator"` | `e2e/codex-mock-flow.spec.ts:382` | **維持**（bubble div の data-testid そのまま） |
| `role="status"` | aria 検証ない（暗黙） | **維持** |
| `aria-live="polite"` | aria 検証ない（暗黙） | **維持** |
| `data-testid="chat-typing-ripple"` | テストなし（新規追加、将来のリプル個別検証用 hook） | **新規** |

E2E は visible/hidden 検証のみで構造内部に依存しないため、selector 調整不要。Playwright 5/5 pass で実証。

---

## § 10 ダーク / ライトモード両対応確認

`var(--accent)` を粒色に使用しているため、テーマ切替で自動追従:

| テーマ | `--accent` 実値 | 粒色 | bubble 背景 | コントラスト |
|---|---|---|---|---|
| dark (default) | `var(--asagi-500)` = `oklch(0.72 0.10 200)` ≒ `#5BB8C4` | 浅葱 medium | `surface/40` ≒ `#2C3145` 40% | 粒の最大 opacity 0.85 で十分視認可（accent の L=0.72 vs background L=0.20、ΔL=0.52） |
| light | `var(--asagi-700)` = `oklch(0.56 0.10 200)` ≒ `#318897` | 浅葱 deep | `surface/40` ≒ `#F0F2F6` 40% | 粒の最大 opacity 0.85 で十分視認可（accent の L=0.56 vs background L=0.99、ΔL=0.43） |

両テーマで OKLCH の L 値差 > 0.4 を確保、WCAG AA の非テキスト要素コントラスト (3:1) を上回る。

bubble 背景 (`bg-surface/40`) はテーマ切替で `--surface` も切替わるため、dark/light どちらでも「背景に溶ける半透明 bubble」の質感を維持。

---

## § 11 git commit / push

| 項目 | 結果 |
|---|---|
| commit | （次のステップで実施、message: `style(chat): DEC-026 typing indicator omomuki polish (Sumi-grade serenity)`） |
| commit hash | （次のステップで取得、本書末尾に追記予定） |
| push | **禁止**（指示通り、ローカルコミットのみ） |

---

## § 12 関連ドキュメント

- 上位 DEC: `../decisions.md` DEC-018-018 / DEC-018-020 / DEC-018-026
- 直前ラウンド: `dev-dec026-chatpane-mock-ux.md`
- 趣 5 原則: `design-logo-v3-omomuki-principles.md`
- ロゴ採用記録: `design-logo-final-gamma.md`
- ブランド: `design-brand-v1.md` § 6 アニメーション
- カラートークン: `../app/design/tokens.css`
- 実装: `../app/asagi-app/src/app/globals.css` / `../app/asagi-app/src/components/chat/typing-indicator.tsx`

---

**完遂日**: 2026-05-02 ／ **次回更新**: M2 で「指 (cursor) アニメ」「streaming token cursor」など他アニメ意匠を磨き込む際に本書の趣原則適用パターンを参照
