# PRJ-012 チャット入力欄リデザイン - 設計提案

担当: 開発部門 (Senior Engineer / Designer)
対象: `components/chat/InputArea.tsx` および周辺
バージョン基準: v1.35.0 (DEC-075)

---

## 1. 現状調査

### 1.1 ファイル構成

| ファイル | 役割 |
| --- | --- |
| `components/chat/InputArea.tsx` (~1170 行) | 入力欄本体。textarea + 送信/停止ボタン + 添付 chip + slash/at picker。本タスクの主戦場。 |
| `components/chat/ChatPanel.tsx` | 親 layout。`MessageList` + `ActivityIndicator` + `InputArea` を縦に積む flex container。 |
| `components/chat/ChatPaneHeader.tsx` | pane ごとの上部 8px 細ヘッダ (`h-8`)。session 切替 dropdown と pane close 用。`showHeader=false` で 1 pane 時は非表示。 |
| `components/chat/ChatStatusIndicator.tsx` | sidecar status バッジ (PM-978 で SlotHeader へ移管済)。 |
| `components/chat/ActivityIndicator.tsx` | thinking / streaming / tool_use のリッチバッジ (`h-9` 上部 border-t)。InputArea のすぐ上に表示。 |

### 1.2 streaming 状態の読み出し

```tsx
// InputArea.tsx L113
const streaming = useChatStore((s) => selectStreamingForSession(s, currentSessionId));
```

session 単位 (DEC-064)。pane 内の主要 UI (placeholder 文字列、停止ボタン、ヒント) が `streaming && activeProjectId` で分岐。

### 1.3 現状の DOM/Tailwind 構造（InputArea L752-959）

```
<div onDrop={...} className="border-t bg-background ...">
  <div className="mx-auto flex max-w-3xl flex-col gap-2 p-3">

    {/* attachments (条件付き) */}
    <div className="... rounded border border-dashed ..."> ... </div>

    {/* メイン行 - flex items-end gap-2 */}
    <div className="flex items-end gap-2">
      <div className="relative flex-1">
        <Textarea rows={2} className="min-h-[52px] resize-none" />
        <SlashPalette /> <AtMentionPicker />
      </div>

      {/* streaming のみ表示 */}
      {streaming && (
        <Button variant="outline" className="h-10 shrink-0">
          <Square /><span className="ml-1 hidden sm:inline">停止</span>
        </Button>
      )}

      {/* 常時表示 */}
      <Button className="h-10 shrink-0">
        <Send /><span className="ml-1 hidden sm:inline">
          {streaming ? "停止して送信" : "送信"}
        </span>
      </Button>
    </div>

    {/* streaming のみ表示 - 冗長ヒント */}
    {streaming && (
      <div className="text-[10px] text-muted-foreground">
        応答中: <kbd>Ctrl + .</kbd> または右下の停止ボタンで停止 / そのまま送信すると停止して新しい turn になります
      </div>
    )}
  </div>
</div>
```

### 1.4 現状サイズの数値感

- textarea: `rows=2` + `min-h-[52px]`、`resize-none`、autosize 無し（手動拡大不可）
- ボタン: `h-10` + 内部 padding。「停止」「停止して送信」の **テキストラベルが sm 以上で 2 つとも表示** され、文字数が多い (「停止して送信」7 文字) ため幅を強く食う
- 親 container: `max-w-3xl` 中央寄せ。狭幅では textarea の `flex-1` が縮み、ボタン側が `shrink-0` 固定で残るため textarea が極端に圧迫される
- ChatPaneHeader は `h-8` の細い toolbar で「セッション切替 dropdown + 閉じる×」のみ。collapse トグルを置く余地は十分

---

## 2. 問題の分解

### 2.1 ボタンが幅を食っている根本

| 要因 | 詳細 |
| --- | --- |
| ラベル付き 2 ボタン併存 | `streaming` 中だけ「停止」+「停止して送信」が並ぶ。両方ともテキストラベル付き。 |
| `shrink-0` 固定 | textarea 側 `flex-1` が縮むため、狭幅では textarea が消滅寸前まで圧縮 |
| 「停止して送信」が冗長 | 通常時は「送信」、streaming 中も結局 send action は同じ。ラベル切替で UI 形状が変わるのが UX 上のノイズ |
| icon-only 化していない | `sm:inline` でラベル表示。アイコンのみへの折りたたみ条件が無い |

### 2.2 底部ヒントの冗長性

- 表示文: `応答中: Ctrl + . または右下の停止ボタンで停止 / そのまま送信すると停止して新しい turn になります`
- すでに以下で同等情報が露出:
  - `placeholder` の動的差替え (`応答中... (Ctrl+. で停止 / 送信で停止して新しい turn)`)
  - `ActivityIndicator` バッジ ("Claude が考えています" 等)
  - 停止ボタンの `title` tooltip
- → **削除して problem なし**。代替は不要 (placeholder で十分カバー)

### 2.3 入力欄高さの現状

- 固定 `min-h-[52px]` + `rows=2`、autosize 機構**無し**。長文入力時は内部スクロール
- 折りたたみ機構**無し** (collapse 状態の store も無し)
- 手動 resize 不可 (`resize-none`)

### 2.4 streaming / non-streaming の分岐箇所

| 要素 | streaming 時 | 通常時 |
| --- | --- | --- |
| placeholder | 「応答中...」 | 「メッセージを入力（Ctrl+Enter で送信...）」 |
| 停止ボタン | 表示 | 非表示 |
| 送信ボタン aria-label | 「停止して送信」 | 「送信」 |
| 送信ボタン text | 「停止して送信」 | 「送信」 |
| 底部ヒント | 表示 | 非表示 |
| ActivityIndicator | 表示中 (h-9) | idle なら非表示 |

---

## 3. 設計案 A / B / C

すべての案で共通:

- shadcn/ui ベースの既存トークン (background / border / muted-foreground / primary / ring) を踏襲
- アイコン化箇所には `Tooltip` 必須
- `prefers-reduced-motion` 尊重 (既存 ChatPanel 同様 `useReducedMotion`)
- `max-w-3xl` 中央寄せ維持 (Cursor / Claude.ai 準拠)

### 案 A: アイコン集約 + 入力欄 100% 幅 (シンプル堅実)

**コンセプト**: 停止ボタンを icon-only 円形にし textarea の右内側に floating。送信ボタンも textarea 内右下にネストさせ「ChatGPT 風一体型 composer」に。

#### streaming 中レイアウト
```
+------------------------------------------------------------+
|  [textarea ........................................ (●)]  |  ← (●) = stop icon, 内側右上
|  [                                                  (>)]  |  ← (>) = send icon, 内側右下
+------------------------------------------------------------+
```

#### non-streaming 時レイアウト
```
+------------------------------------------------------------+
|  [textarea ........................................     ]  |
|  [                                                  (>)]  |
+------------------------------------------------------------+
```

#### 入力欄開閉 UX
- ChatPaneHeader (`h-8`) にチェブロン `[v / ^]` 追加 (`Ctrl+Shift+I` ショートカット)
- 折りたたみ時: textarea を `h-9` の 1 行プレビューに縮め、placeholder のみ表示。クリックで展開

#### 冗長ヒント
- **削除**。placeholder と ActivityIndicator で十分

#### キーボード
- `Ctrl+Enter` 送信 / `Ctrl+.` 停止 (現行維持)
- `Ctrl+Shift+I` で input collapse toggle (新設)

#### アニメーション
- 停止 icon は `framer-motion` で `scale 0.8 → 1` + 軽いパルス (1 秒周期、reduced-motion 時は静止)
- send icon は hover で `scale 1.05`

#### Tailwind class 例
```tsx
<div className="relative">
  <Textarea className="min-h-[88px] resize-none rounded-xl border bg-background pr-12 pb-11 shadow-sm focus-visible:ring-2 focus-visible:ring-primary/50" />
  {streaming && (
    <Button size="icon" variant="destructive"
      className="absolute right-2 top-2 h-8 w-8 rounded-full shadow-md">
      <Square className="h-3.5 w-3.5" />
    </Button>
  )}
  <Button size="icon"
    className="absolute right-2 bottom-2 h-9 w-9 rounded-lg">
    <Send className="h-4 w-4" />
  </Button>
</div>
```

#### Pros / Cons
- **Pros**: ChatGPT/Claude.ai 風で馴染みやすい。textarea 幅を 100% 確保。実装シンプル (Floating だが内部 padding で簡単)。Cursor の composer も同系統。
- **Cons**: 内部 padding で textarea の有効幅が狭まる (`pr-12 pb-11`)。ボタンが textarea の下層に重なるので長文時の視覚衝突に注意。

---

### 案 B: ステータスバー統合 (情報設計優先)

**コンセプト**: textarea **上**に細い 1 行のステータスバーを置き、そこに「mode / model / 停止 / token usage」等のメタ情報を集約。textarea は下で広く取る。Cursor の chat composer に近い。

#### streaming 中レイアウト
```
+------------------------------------------------------------+
| ◐ Claude が考えています        [Sonnet ▾]   [■ 停止]  |   ← status bar h-7
+------------------------------------------------------------+
|                                                            |
|  [textarea 高さ 100px ......................        ]      |
|                                                            |
+------------------------------------------------------------+
|  Ctrl+Enter で送信   1.2K tokens         [送信 →]         |   ← footer bar
+------------------------------------------------------------+
```

#### non-streaming 時レイアウト
```
+------------------------------------------------------------+
| ○ 待機中             [Sonnet ▾]                           |   ← status bar
+------------------------------------------------------------+
|  [textarea ......................                  ]      |
+------------------------------------------------------------+
|  Ctrl+Enter で送信   1.2K tokens         [送信 →]         |
+------------------------------------------------------------+
```

#### 入力欄開閉 UX
- status bar 右端に `[ChevronDown]` トグル (input 全体を折りたたみ)
- 折りたたみ時: status bar のみ `h-8` で残し、空 placeholder バー下部に「+ メッセージを入力...」の細い 1 行 (`h-9`) でクリック展開

#### 冗長ヒント
- 削除。`Ctrl+Enter で送信` を footer bar に常設

#### キーボード
- 同上 + `Ctrl+Shift+I` 折りたたみ

#### アニメーション
- 折りたたみは `framer-motion` height auto アニメ (180ms ease-out)
- status bar の icon は streaming 中のみ `pulse`

#### Pros / Cons
- **Pros**: 情報設計がリッチ (model 切替・token・status を 1 箇所に)。stop/send が **物理的に分離** され誤押しが減る。textarea が上下とも独立して広く取れる。
- **Cons**: 縦スペース消費が増える (status bar 28px + footer bar 36px = 64px 増)。実装量が中。footer bar に何を載せるか議論が必要。

---

### 案 C: フローティング停止ボタン (Claude.ai 風、最もおしゃれ)

**コンセプト**: streaming 中の停止ボタンを **InputArea から完全に削除**し、message area の右下に丸ピル形 floating button として置く。InputArea は streaming/non-streaming で形状が変わらず安定。

#### streaming 中レイアウト
```
+------------------------------------------------------------+
|                                                            |
|              MessageList (scrollable)                      |
|                                            +--------+     |
|                                            | ■ 停止 |     |  ← floating, 右下
|                                            +--------+     |
+------------------------------------------------------------+
| ActivityIndicator: ◐ Claude が考えています...              |  ← 既存の h-9 バッジ
+------------------------------------------------------------+
|  [textarea ........................................ (>)]  |  ← 案A同様 send 内蔵
+------------------------------------------------------------+
```

#### non-streaming 時レイアウト
```
+------------------------------------------------------------+
|              MessageList                                   |
+------------------------------------------------------------+
|  [textarea ........................................ (>)]  |
+------------------------------------------------------------+
```

#### 入力欄開閉 UX
- ChatPaneHeader にチェブロン (`Ctrl+Shift+I`)
- 折りたたみ時: 細い「+ メッセージを入力...」バー (`h-9`、フォーカスで展開)

#### 冗長ヒント
- 削除。停止 floating の `aria-label` + `title` で代替

#### キーボード
- `Ctrl+Enter` 送信 / `Ctrl+.` 停止 (現行)
- floating ボタンは streaming 中のみ DOM にマウント (focusable、Tab 移動で到達可能)

#### アニメーション
- floating ボタンは `framer-motion` で `y: 16, opacity: 0 → y: 0, opacity: 1` フェードイン (220ms)
- pulse する細い border で生存感を出す (reduced-motion 時は静止)
- 停止クリック後は短い fade-out で離脱

#### Tailwind class 例
```tsx
{/* MessageList のすぐ下、InputArea の上に floating コンテナ */}
<div className="relative">
  <AnimatePresence>
    {streaming && (
      <motion.div
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }}
        className="absolute -top-12 right-4 z-10">
        <Button variant="outline"
          className="h-9 rounded-full bg-background/95 px-4 shadow-lg backdrop-blur
                     border-border/80 hover:bg-muted">
          <Square className="mr-1.5 h-3.5 w-3.5" />
          停止
          <kbd className="ml-2 rounded border bg-muted px-1 font-mono text-[10px]">
            Ctrl+.
          </kbd>
        </Button>
      </motion.div>
    )}
  </AnimatePresence>
  {/* InputArea 本体 */}
</div>
```

#### Pros / Cons
- **Pros**: 最もおしゃれ。Claude.ai / ChatGPT (新版) と同等の「streaming UI」感。textarea は streaming 中も常に同形・最大幅。停止 hotkey の `kbd` 表示で学習導線も自然。「停止して送信」も内蔵 send が代替するため二重ボタン解消。
- **Cons**: floating 配置は MessageList のスクロール領域とのレイヤ管理が必要 (z-index、overflow)。MessageList の右下が常に確保されるため、最後のメッセージが少し読みにくくなる可能性 (`pb-12` で逃がす)。ToolUseCard 等とのモバイル衝突は注意。

---

## 4. 入力欄開閉の設計

### 4.1 トグル配置候補

| 案 | 場所 | 利点 | 欠点 |
| --- | --- | --- | --- |
| (a) ChatPaneHeader 右端 (1pane時はSlotHeader) | 既存 toolbar に並ぶ | 既存 X / dropdown と整合 | 1pane モードで showHeader=false の現行と矛盾 → ヘッダ常時表示が必要 |
| (b) InputArea 上端の細い handle bar | 視覚的に折りたたむ対象に直結 | UX が直感的 (ドラッグ ≒ 折りたたむ) | 縦スペース 6px 増 |
| (c) ショートカット (`Ctrl+Shift+I`) のみ | スペース 0、上級者向け | 発見性が低い | 初見ユーザー fmt |

→ **推奨: (b) + (c) の併用**。InputArea 上端に `h-1.5` の handle bar (hover で `h-2`、`cursor-pointer`) を置き、シンプルなクリックで toggle。`Ctrl+Shift+I` も binding (kbd 表示は help dialog 経由)。

### 4.2 collapsed 時の見せ方

| 案 | 詳細 | 推奨度 |
| --- | --- | --- |
| 完全に隠して handle のみ | 6px の細線が border-t に残る。クリックで展開 | △ 折りたたんだことがわからない |
| **1 行プレビュー (推奨)** | `h-9`、placeholder 風の薄い文字「メッセージを入力 (クリックで展開)」、左に `▲ChevronUp` icon | ◎ 上品で発見性高い |
| 完全削除 + フッター ToggleHandle | 隠した瞬間にチャット領域がフル展開。再表示は handle | ○ 没入感は最高だが、復帰の発見性弱 |

→ **推奨: 1 行プレビュー方式**。`h-9` で placeholder 表示、`aria-expanded={false}`、Enter / Click で展開して focus を textarea へ。

### 4.3 ChatPaneHeader 既存 toggle との整合性

- 既存 ChatPaneHeader は `showHeader=true` のときのみ表示 (分割時)。1pane 時の collapse 操作は **InputArea 上端 handle が唯一の入口**になる。
- store: `lib/stores/workspace-layout.ts` に `inputCollapsedByPane: Record<paneId, boolean>` を追加 (persist 対象、pane 単位で独立)。`Shell` から hydrate される既存パターンを踏襲。

---

## 5. 推奨案と理由

### 推奨: **案 C (Floating 停止ボタン) + 案 A の Send 内蔵**

ハイブリッド構成:
1. 停止ボタンは **MessageList と InputArea の境界に floating** (案 C)
2. 送信ボタンは **textarea 内右下に内蔵** (案 A)
3. InputArea からはラベル付き矩形ボタンを **完全排除**
4. 折りたたみは **入力欄上端 handle bar (1 行プレビュー方式)** + `Ctrl+Shift+I`
5. 冗長ヒントは削除、Activity Indicator + placeholder + 停止 floating の `kbd` で十分カバー

#### 理由

| 評価軸 | A | B | C+A ハイブリッド |
| --- | --- | --- | --- |
| おしゃれさ | ○ | △ | ◎ Claude.ai/ChatGPT 直系 |
| 入力欄優先 (幅 100%) | ◎ | ○ | ◎ |
| streaming 中の安定 (形状不変) | △ ボタンが増減 | △ status バー変動 | ◎ 完全不変 |
| 開閉対応 | ○ | ◎ | ○ (handle 方式で十分上品) |
| 冗長ヒント削除 | ○ | ◎ | ◎ |
| 実装容量 | S | M | M (floating + handle) |
| 既存 store/persist 影響 | 小 | 中 (status bar の model picker など要連携) | 中 (workspace-layout 追加 1 key) |

→ C+A は **「形状の安定性」「最大幅」「上質感」「最小実装」のバランスが最良**。B はステータスバーが魅力的だが、PM-978 で SlotHeader へ status を集約済の流れと重複し、二重表示になる。

---

## 6. 実装影響範囲・推定作業量

### 6.1 触るファイル (最小限)

| ファイル | 変更内容 | 規模 |
| --- | --- | --- |
| `components/chat/InputArea.tsx` | 矩形ボタン削除、textarea を rounded-xl + 内蔵 send icon、停止ボタン削除、底部ヒント削除、collapse 状態の参照と handle bar 追加 | 中 |
| `components/chat/ChatPanel.tsx` | InputArea の上に `<StreamingFloatingStopButton paneId={paneId} />` を追加、`pb-12` 等で MessageList の余白調整 | 小 |
| `components/chat/StreamingFloatingStopButton.tsx` | **新規**。streaming 中のみ render、`framer-motion` で fade、Ctrl+. の hint 表示 | 小〜中 |
| `lib/stores/workspace-layout.ts` | `inputCollapsedByPane: Record<string, boolean>` + setter 追加、persist | 小 |
| `lib/keyboard.ts` (該当箇所) | `Ctrl+Shift+I` でアクティブ pane の collapse toggle 追加 | 小 |
| `components/chat/HelpDialog.tsx` | shortcuts 表に `Ctrl+Shift+I` 追加 | XS |

### 6.2 store / persist 変更

- `workspace-layout` store に新 key `inputCollapsedByPane`。pane を removePane したら同 key も掃除 (既存 cleanup と整合)。
- 既存 chat / session store には**変更不要**。streaming state も既存 selector 流用。

### 6.3 E2E への影響

| テスト | 影響 | 対応 |
| --- | --- | --- |
| 「送信ボタンの click」を text セレクタで取っているテスト | aria-label `送信` は維持 | aria-label / role=button で検索する想定。lucide icon-only でも `aria-label` 維持で OK |
| 「停止して送信」テキスト依存テスト | 文言が消える | 当該テストを `[aria-label="送信"]` 単一に修正 |
| streaming 中の停止ボタン位置検証テスト | 場所が floating に変わる | 新 testid (`data-testid="streaming-stop-button"`) を floating に付与 |

→ E2E 改修は数ケース程度、規模は小。

### 6.4 推定作業量

| Phase | 作業 | 規模 |
| --- | --- | --- |
| 実装 | InputArea リデザイン + StreamingFloatingStopButton 新規 + store/keyboard 拡張 | **M** (1.5 日) |
| QA | E2E 修正 + Playwright スナップショット差替 | **S** (0.5 日) |
| ドキュメント | DEC-076 起案、changelog、HelpDialog | **S** (0.25 日) |
| **合計** | | **M (~2.25 日)** |

---

## 7. スタイリング・アクセシビリティ考慮

### 7.1 デザイントーン整合 (dark 中心、shadcn/ui)

- textarea: `rounded-xl border bg-background shadow-sm` + `focus-visible:ring-2 focus-visible:ring-primary/50`
- floating 停止: `rounded-full bg-background/95 backdrop-blur shadow-lg border-border/80`、dark mode で `bg-background/90` に微調整
- handle bar: `h-1.5 bg-border hover:bg-primary/40 cursor-pointer rounded-full mx-auto w-12`
- accent color: 既存の `primary` トークンを send icon hover、focus ring に。停止は `destructive` (赤) ではなく **outline + Square icon** で controlled / 上品な印象 (Claude.ai 準拠)

### 7.2 アクセシビリティ

| 要件 | 対応 |
| --- | --- |
| フォーカスリング | `focus-visible:ring-2 ring-primary/50 ring-offset-2` を全ボタンに |
| `aria-expanded` | collapse handle に `aria-expanded={!collapsed}` + `aria-controls="chat-input-region"` |
| `aria-label` | アイコン only ボタン全てに必須 (`送信`, `応答を停止`, `入力欄を折りたたむ`) |
| Tooltip | `delayDuration={400}` で全アイコンに kbd 付き説明 (`title` ではなく shadcn Tooltip) |
| ESC キー | streaming 中の floating button focus 時 ESC で停止 (現行 `Ctrl+.` を保持しつつ補強) |
| keyboard reachable | floating button は `tabindex` 暗黙 (Button)。Tab 巡回で到達可能 |
| WCAG AA contrast | 停止 floating の文字は `text-foreground` (`bg-background/95` で 4.5:1 担保) |

### 7.3 prefers-reduced-motion

- `useReducedMotion()` で全 framer-motion を 0ms 化 (既存 ChatPanel と同パターン)
- floating の pulse / collapse の height アニメは reduced 時は瞬時切替

---

## 8. CEO への最終提案 (3 行サマリ)

1. **streaming 中の 2 ボタン併存をやめ、停止ボタンは MessageList 右下に floating ピル化、送信ボタンは textarea 右下に内蔵する** (Claude.ai / ChatGPT 互換のおしゃれな composer)。
2. **入力欄は ChatPaneHeader 直下の 1.5px handle bar クリック / `Ctrl+Shift+I` で 1 行プレビューに折りたためる** (`workspace-layout` store に pane 単位 persist)。
3. **底部の冗長ヒントは削除し、placeholder + ActivityIndicator + 停止 floating 内蔵 `kbd` の三段で情報をカバー**。実装は M (約 2.25 日)、E2E 軽微改修のみ、DEC-076 として記録予定。

---

## 参考: 主要 file 絶対 path

- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/chat/InputArea.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/chat/ChatPanel.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/chat/ChatPaneHeader.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/chat/ActivityIndicator.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/components/chat/ChatStatusIndicator.tsx`
- `C:/Users/hiron/Desktop/claude-code-company/projects/PRJ-012/app/ccmux-ide-gui/lib/stores/workspace-layout.ts`
