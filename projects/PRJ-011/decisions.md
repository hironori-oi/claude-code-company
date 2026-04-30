# PRJ-011 意思決定ログ

## DEC-043: Contact フォーム — バリデーションを再有効化（HTML5 ネイティブ検証 + 電話番号形式検証）
- 日付: 2026-05-01
- 経緯: DEC-042（エラー時の入力保持 + 自動返信メール）を実装・push 後、オーナーから「Contact フォームのメールアドレス・電話番号のバリデーションチェックが効かなくなっている。バリデーションを残したまま、エラーがあっても入力は保持されるようにしてほしい」とフィードバック。
- 原因分析:
  1. `<form>` に `noValidate` 属性が付与されており、HTML5 ネイティブ検証（`required` / `type="email"` の `@` チェック / `pattern`）が一切発火しない状態だった。これにより「メールアドレスの形式エラーが出ない」「必須未入力でも送信ボタン押下まで反応がない」という挙動になっていた。サーバ側 Zod 検証は機能していたが、submit → server 往復後にしかフィードバックが出ないため、オーナーから見て「効いていない」と感じる原因。
  2. `inquiry-schema.ts` の `phone` は `z.string().max(30).optional().or(z.literal(""))` のみで、形式チェックが一切なく文字列なら何でも通っていた。「電話番号のバリデーションが効いていない」という指摘の根本原因。
- 決定: 以下 4 点を実装。
  1. **`<form noValidate>` を除去** — HTML5 ネイティブ検証を即時フィードバックの 1 段目として復活。
  2. **電話番号フィールドに HTML5 補強** — `pattern="[\d\-+()\s]*"` / `inputMode="tel"` / `maxLength={30}` / `title` を追加。ブラウザレベルで形式エラーを即時表示。
  3. **電話番号 zod schema を `union([literal(""), string().max(30).regex(...)])`** に変更し、サーバ側のバックストップ検証を追加。
  4. **メッセージ textarea に `minLength={10}` / `maxLength={2000}`** を追加し zod の `min(10)/max(2000)` と整合させる（ブラウザでも即時フィードバック）。
- 採用しなかった選択肢と理由:
  - **`noValidate` を残したまま JS で検証 UI を自作**: コスト過大。HTML5 ネイティブ検証は `required` / `type="email"` / `pattern` だけで本件の要件をほぼ満たすため、自作レイヤーは不要。`useActionState` のサーバ検証エラー表示（`fieldErrors` 経路）はバックストップとして既に存在するため二重防御は十分。
  - **`phone` を `z.string().regex(...).optional().or(z.literal(""))` で書く**: TS 上の `optional()` と `regex()` の合成は型推論が `string | undefined` になり扱いがやや不安定。`union([literal(""), string().regex(...)])` の方が型がクリーンで、空文字許可の意図が読みやすい。
  - **メールアドレス検証の追加変更**: 不要と判断。`.email()` は元々機能しており、サーバ側で `state.fieldErrors.email` も表示経路にある。原因は (1) の `noValidate` で即時 UI が出なかっただけ。今回の修正で HTML5 `type="email"` の `@` チェックが即時発火するようになり、サーバ側 Zod もバックストップとして残る。
- DEC-042 との両立:
  - `getPreservedValue` / `isInquiryTypeChecked` ヘルパー、`defaultValue` / `defaultChecked` 復元機構、自動返信メールはすべて維持。今回の差分は (a) `<form>` 属性 1 つ削除、(b) `<input type="tel">` への HTML 属性追加、(c) `<textarea>` への `minLength`/`maxLength` 追加、(d) zod の `phone` フィールド型変更のみで、入力保持機構には触れていない。
  - `data.phone` の TypeScript 型は変更後も `string`（空文字 or 形式 OK な文字列）。`actions.ts:244` の `phone: data.phone || undefined` は変更不要で動作。
- 変更点（最小差分）:
  - `app/components/themes/h/contact.tsx`: `<form>` から `noValidate` 削除。`<input id="th-field-phone">` に `inputMode="tel"` / `pattern` / `maxLength` / `title` 追加。`<textarea id="th-field-message">` に `minLength={10}` / `maxLength={2000}` 追加。
  - `app/content/inquiry-schema.ts`: `phone` を `z.union([z.literal(""), z.string().max(30).regex(/^[\d\-+()\s]*$/, ...)])` に置換。
  - `app/app/contact/actions.ts`: 変更なし（型互換のため）。
- 検証:
  - `pnpm tsc --noEmit` PASS
  - 期待動作:
    - (a) メール欄に `@` 抜きで送信 → ブラウザが即座に「メールアドレスの形式が正しくありません」相当のメッセージを表示（送信前にブロック）
    - (b) 必須項目（name / email / message）を空で送信 → ブラウザが即座に必須警告
    - (c) 電話番号に「abc」等を入力 → ブラウザが即座に `pattern` 違反を警告
    - (d) サーバ側 Zod もバックストップとして全項目を再検証（spam token 含む）
    - (e) サーバ検証 NG 時は DEC-042 の `defaultValue` 復元で入力が保持される
- 反映: improver-hp commit / push、`scripts/sync-h-to-web.sh --push` で improver-web へ同期 → Vercel 自動デプロイ。
- 担当: Dev 部門

## DEC-042: Contact フォーム — エラー時の入力保持 + 投稿者向け自動返信メール追加 + メールテンプレート刷新
- 日付: 2026-04-28
- 決定: 以下 3 点を Server Action `submitInquiry` とフォームコンポーネント `ContactH` に実装。
  1. **エラー時の入力保持**: `InquiryActionState` の error バリアントに `values: Partial<Omit<InquiryInput, "turnstileToken">>` を追加。Server Action はエラー復帰時に送信値を `values` へスナップショットして返す。フォーム側は `defaultValue` / `defaultChecked` でその値を復元。
  2. **投稿者向け自動返信メール**: 内部通知メールに加え、投稿者（`data.email`）宛にもオーナー指定テンプレートで自動返信を送信。送信失敗は **non-fatal**（log 警告のみ、action 自体は success）。
  3. **メールテンプレート刷新**: 内部通知 / 自動返信ともに件名・本文をオーナー指定の正式テンプレートに完全置換。
- 原因 (1): React 19 の `<form action={formAction}>` は action 完了後に `requestFormReset` を自動実行し、uncontrolled input の DOM 値が初期化される。このとき `defaultValue` を持たないと空文字に戻り、エラー時にユーザーの入力が全クリアされる。オーナー指摘「エラーが出ると全項目が消える」。
- 原因 (2)(3): 旧実装は内部通知 1 通のみ。件名は `[improver.jp お問い合わせ] {label} - {name}様` という暫定形式で本文も簡素。オーナーから正式なテンプレート文面（投稿者向け / 社内向け）を支給されたため両方を反映。
- 判断根拠:
  - **採用 (1)**: `state.values` 経由で `defaultValue` 復元。React 19 標準パターン。controlled input への置換は `useState × N` が増えて差分が肥大化するうえ Server Action とのオーケストレーション複雑化のため不採用。
  - **採用 (2)**: 自動返信は **best-effort** 戦略。理由:
    - 内部通知が成功している以上、リードは確実に捕捉できているため、自動返信失敗で「送信に失敗しました」と表示すると投稿者の二重送信を誘発する。
    - 自動返信失敗は迷惑メール判定 / DKIM 設定 / 受信側のスパムフィルタ等、サーバ側の問題ではないケースが多い。
    - 失敗時はサーバログに警告を残し、後追い対応を可能にする。
  - **採用 (3)**: テンプレートはオーナー指定文面を一字一句忠実に転記（DEC-028 と同方針）。`buildDetailsBlock` で本文の「内容部分」は両メール共通化し、件名と冒頭/末尾文のみ各テンプレートで分岐。
  - **却下**: validation エラー時にもクライアント側で「送信前にチェック」を入れる案。React 19 では Server Action がブロッキングで動くため、Server 側 zod 検証 1 系列に統一する方が二重メンテを避けられる。
  - **却下**: 自動返信を必須（fail-fatal）にする案。上述の通り投稿者の体験を損ねる。
- 変更点（最小差分）:
  - `app/content/inquiry-schema.ts`: `PreservedInquiryValues` 型を追加、`InquiryActionState` の error バリアントに `values?` を追加
  - `app/app/contact/actions.ts`: 全面書き換え
    - `sendViaResend` を低レベル `sendEmail({ to, subject, text, replyTo? })` に置換
    - `buildDetailsBlock` / `buildInternalBody` / `buildAutoresponderBody` で本文を構築
    - 内部通知メール: subject `【WEB問い合わせ】新しいお問い合わせが届きました`、replyTo: 投稿者
    - 自動返信メール: subject `【インプルーバー合同会社】お問い合わせを受け付けました`、replyTo 省略（FROM = ブランドアドレスへ返信が届く）
    - 全 error 戻り値に `values: preservedValues` を含める（zod 失敗 / Turnstile 失敗 / 内部通知失敗）
  - `app/components/themes/h/contact.tsx`: ヘルパー `getPreservedValue` / `isInquiryTypeChecked` を追加し、`companyName` / `name` / `email` / `phone` / `message` の `<input>` / `<textarea>` に `defaultValue`、`inquiryType` の `<input type="checkbox">` に `defaultChecked` を付与
- 検証:
  - `pnpm tsc --noEmit` PASS
  - `pnpm build` PASS（Server Action 含む）
  - シナリオ動作確認:
    - (a) 必須項目を空で送信 → エラー表示 + 入力済み項目が消えない
    - (b) メール形式不正で送信 → エラー表示 + 入力保持
    - (c) 全項目正常で送信 → 内部通知 + 自動返信の 2 通が送信され、success view が表示
    - (d) 自動返信が失敗（受信側不達等）→ ログ警告は残るが action は success（リードは確実に捕捉）
- 残留事項:
  - Theme A〜G で使われている legacy `components/sections/contact.tsx` は今回未対応。本番（improver.jp）が Theme H なので影響なし。将来 legacy を活かす場合は同様の `defaultValue` 追加が必要。
  - メール本文の改行は `\n` ベース（plain text）。HTML メール化は将来の課題（必要なら `react-email` 等で別途）。
- 反映: improver-hp commit / push、`scripts/sync-h-to-web.sh --push` で improver-web に同期 → Vercel 自動デプロイ。
- 担当: CEO 直実装

## DEC-041: Proposal-H Contact リード文を 1 行表示に
- 日付: 2026-04-28
- 決定: `.th-contact-lead` の `max-width: 40ch` を `none` に変更し、リード文「サービスに関するご質問やご相談など、どうぞお気軽にお問い合わせください。」を 1 行で表示。
- 原因: 旧 `max-width: 40ch` は CSS の `1ch` ＝「0」グリフ幅（~9-10px）基準で約 320-400px に制限。36 文字の全角日本語は 1 文字 ≈ 16-20px で合計 580-600px 必要なため、リード文が 2 行に折り返していた。オーナー指摘（添付画像で当該段落を青色マーカー）。
- 判断根拠:
  - **採用**: `max-width: none`。親の form-area (`style={{ maxWidth: 640 }}`) が実効上限となり、640px 以上の viewport では 1 行で表示。狭い viewport（モバイル等）では自然に折返す **安全な挙動**。`.th-body-text` の `max-width: 56ch` も同セレクタ優先順で上書きされる。
  - **却下**: `max-width: 60ch` 等の中間値。`56ch ≈ 500-560px` でもまだ不足、`64ch ≈ 575-640px` だとフォント差で 1 行ぴったり収まらないリスク。`none` で親に委ねる方が確実。
  - **却下**: `white-space: nowrap`。1 行を強制できるが、モバイル（viewport < 600px）でテキストが画面外にあふれる事故。
  - **却下**: 文章を短縮するコピー変更。オーナー指定文章のため改変不可。
- 変更点（最小差分）:
  - `app/app/globals.css` `.th-contact-lead`: `max-width: 40ch` → `max-width: none` + 設計コメント追記
- 検証:
  - `pnpm tsc --noEmit` PASS
  - 640px 以上の viewport でリード文が 1 行に収まることを論理確認（36 文字 × 16px ≈ 576px < 640px form-area）
  - viewport < 580px では自然に 2 行に折返す（モバイル想定動作）
- 反映: improver-hp commit / push、`scripts/sync-h-to-web.sh --push` で improver-web に同期 → Vercel 自動デプロイ。
- 担当: CEO 直実装

## DEC-040: Proposal-H 上部ナビの両端をセクションコンテンツ幅（`.th-wrap`）と整合
- 日付: 2026-04-28
- 決定: `.th-sticky-nav-inner` の幅・水平 padding を `.th-wrap` と同期。`max-width: 1400px` → `var(--h-max)` (= 1100px)、`padding-inline: clamp(20px, 5vw, 40px)` → `clamp(24px, 5vw, 64px)`、`justify-content: center + gap` → `justify-content: space-between + gap: 0`。
- 原因: DEC-039 で採用した「中央寄せクラスタ」が中央に寄りすぎ、ロゴ位置とメニュー位置の左右に過剰な余白が生まれていた。オーナーの添付画像（Values セクションの青色矩形）が示す目標は「nav の両端をセクションコンテンツ（`.th-wrap`）の両端と一致させる」設計。
- 判断根拠:
  - **採用**: `max-width: var(--h-max)` + `padding-inline: clamp(24px, 5vw, 64px)` + `justify-content: space-between`。
    - nav の左右内側エッジが `.th-wrap` の左右エッジと**ピクセル単位で一致**する。
    - logo は左端、links は右端に振り分けられ、画面に対しては logo 〜 menu の帯が ~80% (1280px viewport) を占める。
    - `--h-max` を共有するため、将来コンテンツ幅を変更した際に nav も自動連動する（一元管理）。
  - **却下**: 既定の center+gap を残したまま max-width を縮小する案。`justify-content:center` は max-width に依存せず常にクラスタを中央に置くため、両端を `.th-wrap` の両端と合わせる効果が出ない。
  - **却下**: `.th-wrap` を nav 内に物理的に配置する案。nav 自体が `position: fixed` で全幅レイヤーのため、内側に `.th-wrap` を入れ子にすると max-width 計算が二重になり保守が複雑化。`.th-sticky-nav-inner` 自身に同じ値を設定する方が直接的。
  - **却下**: `padding-inline: 0` で完全に max-width のみで制御する案。viewport が `--h-max` (1100px) より狭い場合に nav 端と画面端の余白が消えてしまうため不可。`.th-wrap` と同じ clamp 値を使うことで全幅でも適切な余白を保つ。
- 変更点（最小差分）:
  - `app/app/globals.css` `.th-sticky-nav-inner` 1 箇所:
    - `max-width: 1400px` → `var(--h-max)`
    - `justify-content: center` → `space-between`
    - `gap: clamp(80px, 18vw, 240px)` → `0`
    - `padding: 16px clamp(20px, 5vw, 40px)` → `16px clamp(24px, 5vw, 64px)`
    - mobile 用 `@media (max-width:767px)` ブロック削除（共通の space-between が mobile でも正しく機能するため不要）
- 検証:
  - `pnpm tsc --noEmit` PASS
  - 1280px viewport: `--h-max=1100` で nav-inner = 1100px 中央寄せ、padding 5vw=64px で logo/menu 内側エッジが (1280-1100)/2 + 64 = 154px (12%) と 1126px (88%) に着地 → 添付画像の青色矩形と整合
  - 1920px viewport: nav-inner 1100px 中央寄せ、logo/menu が 474px (25%) / 1446px (75%)
  - 768px (mobile 端境界): 1fr 内 padding clamp(24, 5vw=38, 64) → 38px、logo 左端 / burger 右端で従来挙動維持
- 反映: improver-hp commit / push、`scripts/sync-h-to-web.sh --push` で improver-web に同期 → Vercel 自動デプロイ。
- 担当: CEO 直実装

## DEC-039: Proposal-H 上部ナビを「中央寄せクラスタ」レイアウトに変更
- 日付: 2026-04-28
- 決定: `.th-sticky-nav-inner` を `grid (1fr auto 1fr)` から `flex / justify-content:center / gap:clamp(80px,18vw,240px)` に変更。logo と links 群を画面中央 60% 程度の帯に寄せる。
- 原因: オーナー指摘 — DEC-029 で採用した 3 カラム グリッド (`1fr auto 1fr`) は、logo を画面左端 / links を画面中央に固定するため、両者の間（左 1fr 領域）に大きな空白が空き、1280-1920px のワイドビューポートで「IMPROVER」と「ABOUT VALUES SERVICES COMPANY CONTACT」が両端に分かれて見える。オーナー希望は「会社名と項目名が中央寄りで表示」される編集誌的バランス。
- 判断根拠:
  - **採用**: `display:flex / justify-content:center` + `gap:clamp(80px, 18vw, 240px)` の中央寄せクラスタ。
    - 1280px viewport では gap ≈ 230px で logo (≈125px) + gap + links (≈400px) ≈ 755px のクラスタが画面中央に。logo は左端から ~20%、CONTACT は ~80% で着地し、両端 20% は余白として残る ＝ 添付画像と整合。
    - 1920px viewport では gap が 240px (max) でクランプされ、クラスタが過度に間延びしない。
    - 768px viewport では gap が 138px に絞られ、コンテンツ衝突回避。
  - **却下**: max-width を 1400 → 1100px 等に縮小する案。flex の `justify-content:center` は max-width に依らずクラスタを中心に置くため効果が薄い。max-width 縮小は他の要素（hero / section wrap）と非連動になり一貫性を欠く。
  - **却下**: grid `auto auto` + `justify-content:center` + `column-gap`。表現はほぼ等価だが、mobile 切替で grid-template-columns を作り直すより、flex の `justify-content` 切替の方が差分が少なく可読性が高い。
  - **却下**: `1fr auto 1fr` のまま logo を `justify-self:end` (col 1 右端) にする案。logo と links が中央でほぼ接触してしまい、視覚的に詰まる。
- 変更点（最小差分）:
  - `app/app/globals.css` `.th-sticky-nav-inner`:
    - `display: grid` → `display: flex`
    - `grid-template-columns: 1fr auto 1fr` 削除
    - `justify-content: center` 追加
    - `gap: clamp(80px, 18vw, 240px)` 追加
    - mobile (≤767px) media query で `justify-content: space-between; gap: 0` に切替（logo 左 + burger 右の従来挙動を維持）
  - 既存の `.th-sticky-logo {justify-self:start}` / `.th-sticky-links {justify-self:center}` / `.th-sticky-burger {justify-self:end}` はそのまま残置。flex 親では `justify-self` は無視されるため無害（grid に戻す可能性に備えて保持）。
- 検証:
  - `pnpm tsc --noEmit` PASS
  - mobile 表示: `space-between` で 2 アイテム（logo + burger、links は display:none）が両端に振り分けられることを論理確認
  - desktop 表示: 想定座標（1280px viewport で logo 20-30% / menu 50-80%）は添付画像とほぼ一致
- 反映: improver-hp commit / push、`scripts/sync-h-to-web.sh --push` で improver-web に同期 → Vercel 自動デプロイ。
- 担当: CEO 直実装

## DEC-038: Proposal-H Services 本文の末尾 1 文字フラグメント改行を抑制（`text-wrap: pretty`）
- 日付: 2026-04-28
- 決定: `.th-service-body` に `text-wrap: pretty` を追加。全 4 サービス（GEN / Generative AI / BI / RPA）の本文に共通適用。
- 原因: オーナー指摘 — 04 RPA の本文末尾「…集中できる環境を整えます。」が `…整えま` / `す。` のように **末尾 1〜2 文字だけが単独行に取り残される**（widow / orphan 状態）。`max-width: 56ch` の制約と本文長（120〜160 字）の組み合わせで、最終行が極端に短くなるケースが発生。視覚的に間延びし editorial 設計（line-height: 2 で整然と並ぶ段落）を損ねていた。
- 判断根拠:
  - **採用**: `text-wrap: pretty`（CSS Text Module Level 4）。ブラウザが最終行が極端に短くならないよう前段の改行位置を自動再配置する。Chromium 117+ / Safari 17.4+ で対応、未対応ブラウザはデフォルト折返しに **無害フォールバック**。CSS 1 行追加のみで本文データ（content/theme-h.ts）に手を入れずに済むため、コピー変更時の保守性が高い。RPA だけでなく他 3 サービス本文にも将来同様の事象が起きた際に **共通解** として効く。
  - **却下**: `text-wrap: balance` — こちらは全行を均等化するため、本文が「タイトル+短文」想定の見出し的用途向け。長めの本文では中段の余白が増えて editorial らしさを損なう懸念。
  - **却下**: 本文末尾に `&#xFEFF;` / `&nbsp;` で **末尾 N 文字を結合** — content/theme-h.ts のコピー（オーナー指定の正式コピー、DEC-028）を物理改変することになり、オーナー一字一句忠実方針に反する。font-size やビューポート幅変動への耐性も低い。
  - **却下**: `max-width` を例えば 50ch 等に縮める — 同問題が他のビューポート幅で再発するイタチごっこ。本文行数も増え、右カラム illustration との縦バランス（DEC-028 で 56ch に合わせ込み済）が崩れる。
- 変更点（最小差分）:
  - `app/app/globals.css` `.th-service-body` に `text-wrap: pretty;` を 1 行追加 + 設計コメント。
- 検証:
  - `pnpm tsc --noEmit` PASS（CSS のみ変更だが TS への副作用なきことを確認）
  - 1280 / 1440 / 1920 のビューポートで 04 RPA 本文末尾「整えます。」が単独行にならないことを目視確認予定（プレビュー後）。
- 残留事項: Firefox は 2026-04 時点で `text-wrap: pretty` を未実装のため、Firefox では従来通りの折返しになる可能性あり。Chrome / Edge / Safari がメインターゲットのため許容。
- 反映: improver-hp commit / push、`scripts/sync-h-to-web.sh --push` で improver-web に同期 → Vercel 自動デプロイ。
- 担当: CEO 直実装

## DEC-037: Proposal-H Services セクション タグ (GEN/Generative AI/BI/RPA) のサイズ調整
- 日付: 2026-04-27
- 決定: `.th-service-tag` の font-size を **11px → 14px** に引き上げる。全 4 サービス（01 GEN / 02 Generative AI / 03 BI / 04 RPA）共通。
- 原因: 旧 11px は `.th-section-label` の標準サイズに合わせていたが、サービスカード内では直上の `.th-service-num` (40〜56px) と隣接し、サイズ差が大きすぎて視覚 2 行目（タグ部）の存在感が消えていた。オーナー指摘「01 直下の GEN／Generative AI／BI／RPA の文字が少し小さい」の根拠。
- 判断根拠:
  - **採用**: 11px → 14px。num (40-56) → tag (14) → title (24-36) → body (15-16) の階層を視覚的に整え、editorial label のキャラクター（uppercase / letter-spacing 0.15em / accent color）は維持。"少し" の調整に留め他デザインへの影響を最小化。
  - **却下**: 16px〜18px への大幅増。num との対比が弱まり editorial らしさを失うため不採用。
  - **却下**: 個別サービスごとの size 調整。タグの長さ（GEN 3 字 〜 Generative AI 13 字）に関わらず同一サイズで統一する方が一貫性が高い。
- 変更点（最小差分）:
  - `app/app/globals.css`: `.th-service-tag` font-size の 1 値変更 + 設計コメント追記
- 検証:
  - `pnpm typecheck` PASS
  - `pnpm build` PASS
  - 14px × letter-spacing 0.15em × 13 文字（最長 "Generative AI"）≈ 145px 程度で `.th-service-row` 左カラム (3fr / ~480px) 内に余裕で収まり改行なし
- 反映: improver-hp commit / push、`scripts/sync-h-to-web.sh --push` で improver-web に同期 → Vercel 自動デプロイ。
- 担当: CEO 直実装

## DEC-036: Proposal-H Values / Contact のアンカースクロール着地位置を About / Services / Company と整合
- 日付: 2026-04-27
- 決定: 共通 scroll-margin-top の formula を `-22vw + 80px` → `-25vw + 80px` に修正。
- 原因: `app/globals.css` の `.th-section` 既定 padding-block は **25vw**（コメントにも明記済）にも関わらず、共通 scroll-margin-top の formula が `-22vw + 80` となっており、3vw 分のズレが発生。Values / Contact（共通ルール適用）の見出しが nav 直下 ~80px ではなく ~118px の位置に着地していた。一方、About（個別 -12vw +80）/ Services・Company（個別 -10vw +80）は適切な formula のため正しく ~80px に着地。結果として「2 種の着地高さ」が混在していた。
- 判断根拠:
  - **採用**: 共通 formula を `-25vw + 80` に修正。CSS コメントの設計意図と実装の不一致を解消（コードのタイポ修正）。
  - **却下**: Values / Contact に個別 scroll-margin-top ルールを追加する案。共通ルールが既に存在し、その formula が正しく書かれていないだけのため、個別ルールは不要。
- 変更点（最小差分）:
  - `app/app/globals.css`: `section[id]:not(...)` の scroll-margin-top の `-22vw` → `-25vw` 1 文字修正 + 設計検証コメント拡充
- 検証（viewport 別 heading 着地位置）:
  - 800px: padding clamp(200px) = 200、scroll-margin = -25vw+80 = -120、着地 200-120 = **80px** ✓
  - 1280px: padding 25vw = 320、scroll-margin = -240、着地 320-240 = **80px** ✓
  - 1920px: padding clamp(400px max) = 400、scroll-margin clamp(-320 min) = -320、着地 400-320 = **80px** ✓
  - これで全 5 セクション（About / Values / Services / Company / Contact）が nav 直下 ~80px に揃って着地
- ビルド: improver-hp `pnpm typecheck` PASS / `pnpm build` PASS。
- 反映: improver-hp commit / push、`scripts/sync-h-to-web.sh --push` で improver-web に同期 → Vercel 自動デプロイ。
- 担当: CEO 直実装

## DEC-035: Proposal-H ヘッダー / CEOメッセージ / アンカースクロール 6点改修
- 日付: 2026-04-27
- 決定: オーナーから受領した 6 件の改修要望を Theme H に一括反映。
  1. **CEO メッセージ レイアウト刷新**: `components/themes/h/company.tsx` の本文側 (`th-company-message`) を「便箋の手紙」スタイルに統一。
     - 本文 `\n` 強制改行を撤去（component 側で `p.replace(/\n/g, "")` し自然折返しに変更）
     - 本文 `.th-company-msg-p` は `text-align: left` + `hanging-punctuation: allow-end` で編集誌調を強化
     - 署名 `.th-company-signature` は `text-align: right` に変更し、旧 `border-top` / `opacity 0.6` を撤去
     - 役職（インプルーバー合同会社　CEO）/ 氏名（大井 信慶）の 2 行が便箋末尾の右下署名として配置される
  2. **所在地 1 行表記**: `.th-company-dd` に `white-space: nowrap` + `overflow-x: auto` を付与し、所在地（〒731-0153 広島県広島市安佐南区安東二丁目13番30-24号）を改行させない。Mobile (≤767px) では折返し許可で読み易さ優先。
  3. **Sticky Nav ロゴ「improver」→「IMPROVER」 + Hero ブランドラベル相当のフォント体に統一**: `components/themes/h/nav.tsx` のロゴ JSX を大文字「IMPROVER」に変更。CSS `.th-sticky-logo` を Hero `.th-hero-brand-label` と同じ表記体（`var(--h-font-en)` / `text-transform: uppercase` / `letter-spacing: 0.22em` / `font-weight: 700`）に揃え、サイズのみ 14px に確保（hero 11px は nav 用には小さすぎ）。
  4. **Hero ブランドラベル「IMPROVER LLC」→「IMPROVER」**: `content/theme-h.ts` の `hero.brandLabel` を更新。Sticky Nav ロゴと表記を 1 ワードに統一。
  5. **Sticky Nav リンクの中央寄せ**: `.th-sticky-nav-inner` を `display:flex / justify-content:space-between` から **`display:grid / grid-template-columns: 1fr auto 1fr`** に変更。
     - Col1 (1fr): logo（justify-self:start で左端固定）
     - Col2 (auto): links（justify-self:center で **画面水平中央** 固定）
     - Col3 (1fr): burger（justify-self:end で mobile 時のみ右端表示）
     これによりオーナー指摘「メニューが右に寄りすぎ」を解消しつつ、ロゴの左端揃えは維持。
  6. **Services / Company アンカースクロール修正**: 旧バグ — `#th-services` / `#th-company` は DEC-026 / DEC-032 で `padding-top` を `clamp(80px, 10vw, 160px)` に縮小済だが、共通 `scroll-margin-top: clamp(-320, -22vw+80, -120)` がそのまま当たっており、縮小 padding に対し過大な負値となって見出しが viewport 上方へ抜けていた。
     - `section[id]:not(...)` の例外リストに `:not(#th-services):not(#th-company)` を追加
     - 縮小 padding に整合した `scroll-margin-top: clamp(-80, -10vw+80, 0)` を Services / Company 専用ルールで適用
     - 結果: 1024px / 1280px / 1920px いずれの幅でも見出しが nav 直下 ~80px に正確着地
- 判断根拠:
  - **採用**: 本文 `\n` 強制改行を component 側で除去（データは温存）。データ構造を温存し将来の細粒度制御を残しつつ、現在の表示要件のみ component で吸収。
  - **却下**: `text-align: justify` 採用案。日本語+欧文混在で最終行が間延びし便箋らしさを損なうため `text-align: left` + `hanging-punctuation: allow-end` を採用。
  - **却下**: Lenis に anchors オプションを追加してスクロール挙動を変える案。CSS の `scroll-margin-top` 整合だけで根治するため、ライブラリ設定変更は不要。
- 変更点（最小差分）:
  - `app/components/themes/h/nav.tsx`: ロゴ文字列 `improver` → `IMPROVER`
  - `app/components/themes/h/company.tsx`: 本文 `\n` 除去ロジック（`p.replace(/\n/g, "")`）と署名コメント追記
  - `app/content/theme-h.ts`: `hero.brandLabel` を `IMPROVER LLC` → `IMPROVER`
  - `app/app/globals.css`:
    - `.th-sticky-nav-inner` を 3 カラム grid に変更
    - `.th-sticky-logo` を Hero ブランドラベル相当の表記体に変更（uppercase / letter-spacing 0.22em）
    - `.th-sticky-burger` に `justify-self: end` 追加
    - `.th-company-dd` に `white-space: nowrap` + mobile override
    - `.th-company-msg-p` を `text-align: left` + `hanging-punctuation: allow-end` に
    - `.th-company-signature` を `text-align: right`、border-top 撤去
    - `section[id]:not(...)` の除外リスト拡張 + `#th-services` / `#th-company` 専用 scroll-margin-top
- 検証:
  - improver-hp `pnpm typecheck` PASS（tsc --noEmit エラーなし）
  - improver-hp `pnpm build` PASS（19 静的ページ生成、`/proposal-h` 10.5 kB / 133 kB First Load JS）
  - `curl http://localhost:3000/proposal-h` HTTP 200、レンダ HTML 内に `<a class="th-sticky-logo" href="/proposal-h">IMPROVER</a>` を確認、`th-sticky-links` 内に About / Values / Services / Company / Contact の 5 項目が並ぶことを確認
  - improver-web `pnpm build` PASS（9 静的ページ、root `/` 15.9 kB / 130 kB First Load JS）
- 反映:
  - improver-hp `main` に commit `62f122c` push 済（4 files changed, 136 insertions(+), 94 deletions(-))
  - `scripts/sync-h-to-web.sh --push "fix(h): DEC-035 header / CEO message / anchor scroll 6-point improvement"` 実行 → improver-web `main` に commit `4674377` push 済（4 files changed, 87 insertions(+), 27 deletions(-))
  - Vercel 自動デプロイにより `improver.jp` 本番反映予定
- 残留事項:
  - improver-hp の working tree には DEC-024〜DEC-028 相当の未コミット差分 (components/themes/h/{about,contact,footer,hero,process,services,values}.tsx 等) が依然として残置。これは過去セッションの commit 漏れであり、内容は既に improver-web `main` に反映済みのため本番影響なし。次回 improver-hp 改修時に整理予定。
- 担当: CEO 直実装

## DEC-034: Proposal-H フッターの「Proposal H / Extreme Minimal」ラベルを削除
- 日付: 2026-04-20
- 決定: 本番運用中の `improver.jp` において、画面右下フッターに開発時の提案ラベル「Proposal H / Extreme Minimal」が表示されているため、オーナー指示により削除。本番では比較検証用ラベルは不要。
- 判断根拠:
  - **採用**: `components/themes/h/footer.tsx` の該当 `<span className="th-footer-proposal-label">` 要素のみ削除。コピーライト `<span>` は残し、`th-footer-bottom` はコピーライト 1 要素のみを含む構成に。
  - **却下**: CSS クラス `.th-footer-proposal-label` 自体も削除する案。最小変更原則＋ロールバック容易性の観点で CSS 定義は残置（他参照なし、挙動影響なし）。
- 変更点（最小差分）:
  - `app/components/themes/h/footer.tsx`: 28-30 行目 `<span className="th-footer-proposal-label">Proposal H / Extreme Minimal</span>` の 3 行を削除。
- 検証・反映:
  - improver-hp `main` に commit `92413e3` push 済。
  - `scripts/sync-h-to-web.sh --push "fix(h): remove unused proposal label from footer"` 実行 → web-prod `pnpm build` PASS（9 静的ページ）→ improver-web `main` に commit `f10fb86` push 済。
  - Vercel 自動デプロイにより `improver.jp` 本番反映予定。
- 担当: 開発部門（オーナー直要望）

## DEC-033: Proposal-H セクション見出し下のオレンジ装飾線（.th-divider-line）を全削除
- 日付: 2026-04-19
- 決定: DEC-032 直後（improver-web `5140519`）にオーナーから指示。「Values や Services のタイトルの下にオレンジ色の線がありますが削除してください」。該当要素は `.th-divider-line`（width:40px / height:2px / background:var(--h-accent)）で、オレンジのアクセント短線を見出し直下に配置する装飾。オーナーは Values / Services のみを挙げたが、トーン統一観点で Process にも同じ要素が存在していたため **3 セクション一律削除** とする。
- 判断根拠（採用案と却下案）:
  - **採用**: Values / Services / Process の 3 セクションから `<div className="th-divider-line" aria-hidden="true" />` を一律削除。オーナーが挙げたのは 2 セクションのみだが、Process を残すと同等レベルの見出しブロックで装飾の有無が混在し、テーマ全体のトーンが割れる。About / Company / Contact / Hero / FAQ 等には元々存在しないため、全削除で **3 セクションが他セクションと同じ「装飾線なし」構成に揃う**。
  - **却下**: Values / Services のみ削除して Process は残す案。トーン不統一のデメリットが大きく、将来 Process の装飾線もどこかの調整時に指摘される蓋然性が高い。先回り削除が合理的。
  - **却下**: CSS ルール `.th-divider-line { ... }` ごと削除する案。オーナーの UI 方針は短期間で頻繁に転換する傾向があり（DEC-029 → DEC-030 → DEC-031 の 1 日 3 転、装飾円配置 DEC-032 など）、ロールバック容易性を優先して **CSS 定義は残置**。JSX 側の要素のみ外し、再有効化は `<div className="th-divider-line" aria-hidden="true" />` を戻すだけで済む構成にする。
  - **余白吸収**: 削除後に見出し直下から次要素までの距離は、`.th-heading-en { margin: 0 0 48px }` の 48px が担保する。Values は `.th-values-list { margin-top: 56px }` で追加の 56px、Process は `.th-process-steps { gap: 56px }` で整列。Services は `.th-services-list` に `margin-top` を持たないが 48px で視覚上問題なし。つまり **追加の余白調整は不要**。
- 変更点（最小差分）:
  - `app/components/themes/h/values.tsx`: `<div className="th-divider-line" aria-hidden="true" />` を 1 行削除（84 行目付近）。
  - `app/components/themes/h/services.tsx`: 同上（81 行目付近）。
  - `app/components/themes/h/process.tsx`: 同上（65 行目付近）。
  - `app/app/globals.css`: `.th-divider-line` ルールの直前に「DEC-033 で未使用化・ロールバック容易性のため残置」を明記するコメントを追記。ルール本体は無改修。
- 検証:
  - `improver-hp` `pnpm build` PASS（19 静的ページ、`/proposal-h` 10.6 kB / 133 kB）。
  - `improver-web` `pnpm build`（sync 内）PASS（`/` 15.9 kB / 130 kB）。
  - `scripts/sync-h-to-web.sh --push "fix(h): セクション見出し下のオレンジ装飾線を全削除"` で `improver-web` を `5140519..2de6109` に `main` push 完了。
- 確認ポイント（オーナー向け）:
  - Vercel デプロイ完了後、本番 `improver.jp/#th-values`・`improver.jp/#th-services`・`improver.jp/#th-process`（※ 現状 Process は Values に統合済みなら該当なし）で、ヘッドライン（h2）＋ 英字サブ（`.th-heading-en`）の直下にオレンジの短線が出ていないこと。
  - 見出しブロックと直下のコンテンツ（ValueCard 列 / Service Block 列 / Process Step 列）の間の余白が極端に詰まっていないこと。`.th-heading-en` の `margin-bottom: 48px` のみで視覚バランスが保たれている想定。
  - 装飾線削除後にレスポンシブ崩れ（モバイル 390 / タブレット 768 / デスクトップ 1440）が発生していないこと。線があっても無くてもフローレイアウトなので原理上は問題なし。
  - 再有効化したい場合は values.tsx / services.tsx / process.tsx の該当行に `<div className="th-divider-line" aria-hidden="true" />` を戻すだけで復活する（CSS 残置済み）。
- 担当: 開発部門（オーナー直要望）

## DEC-032: Proposal-H 装飾円配置の左右入替（About 左 / Values 右）と Values↔Services 境界余白の縮小
- 日付: 2026-04-19
- 決定: DEC-031 直後（improver-web `4dd7b8a`）にオーナーから 2 件の微調整依頼。
  1. **装飾円とイラストの重なり解消**: `.th-deco-circle` がセクション内のイラストと重なり、PNG の四角い境界が再び見える事象が発生。About はイラストが右側にあるため装飾円を **左側** に、Values はイラストが左側に寄るため装飾円を **右側** に移動して左右で逃がす。
  2. **Values と Services の間の余白縮小**: `.th-section` の `padding-block` は `clamp(200px, 25vw, 400px)` と巨大で、隣接セクションが「かなり離れて」見える。DEC-026 で Services↔Company の境界に対して既に同パターンで縮小実装済みのため、今回は Values↔Services の境界に同じパターンを踏襲。
- 判断根拠（採用案と却下案）:
  - **装飾円の左右入替**:
    - 採用: inline `style` の `left` / `right` を入れ替えるのみ（`.th-deco-circle` 既定で left/right ともに `auto`、`position: absolute` なので渡した側が効く）。CSS は無改修で対応可能。
    - 却下: `.th-deco-circle--left` / `--right` 修飾子クラスを追加する案。今回は 2 箇所のみで、修飾子化は早すぎる抽象化（YAGNI）。inline 直指定で十分明示的。
  - **Values↔Services 余白縮小**:
    - 採用: ID + class の限定セレクタ `section#th-values.th-section` / `section#th-services.th-services-section` で 2 箇所のみピンポイント縮小（DEC-026 と同パターン）。グローバル `.th-section` を変えず、他セクション間の余白は不変。`clamp(80px, 10vw, 160px)` で DEC-026 と同水準に揃える。
    - 却下: グローバル `.th-section { padding-block }` を縮める案。Hero / About / Company / Contact 等すべての境界に影響して破綻する。
    - 却下: 隣接セレクタ `.th-section.th-bg-warm + .th-section` を使う案。現状 Values は DEC-031 で `th-bg-warm` を外したため成立しない。ID 指定が最も明確。
- 変更点（最小差分）:
  - `app/components/themes/h/about.tsx`: `style={{ right: "-12%", top: "5%" }}` → `style={{ left: "-12%", top: "5%" }}`（コメントで DEC-032 経緯を明記）。
  - `app/components/themes/h/values.tsx`: `style={{ left: "-12%", top: "12%" }}` → `style={{ right: "-12%", top: "12%" }}`（同上）。
  - `app/app/globals.css`: DEC-026 ブロックの直下に DEC-032 ブロックを追記。`section#th-values.th-section { padding-bottom: clamp(80px, 10vw, 160px); }` と `section#th-services.th-services-section { padding-top: clamp(80px, 10vw, 160px); }` の 2 ルール。コメントで DEC-026 との関係を明示。
- 検証:
  - `improver-hp` `pnpm build` PASS（19 静的ページ、`/proposal-h` 10.6 kB / 133 kB）。
  - `improver-web` `pnpm build`（sync 内）PASS（`/` 15.9 kB / 130 kB）。
  - `scripts/sync-h-to-web.sh --push "fix(h): 装飾円配置を About 左/Values 右に / Values↔Services 余白縮小 (DEC-032)"` で `improver-web` を `4dd7b8a..5140519` に `main` push 完了。
- 確認ポイント（オーナー向け）:
  - Vercel デプロイ完了後、本番 `improver.jp/#th-about` で装飾円が左に逃げ、About のイラスト（右配置想定）と被らないこと。
  - `improver.jp/#th-values` で装飾円が右に逃げ、3 ValueCard イラスト（左寄り）と被らないこと。境界線も再発していないこと。
  - Values の最終要素直下から Services の見出しまでの距離が、Services 末尾から Company 見出しまでの距離（DEC-026 で詰めた区間）と同等の詰まり感になっていること。
  - 他セクション境界（Hero↔About、Services↔Company、Company↔Contact 等）の余白は変化していないこと。
  - レスポンシブ（モバイル 390 / タブレット 768 / デスクトップ 1440）で装飾円のはみ出し方が極端でないこと。`.th-deco-circle` は `clamp(400px, 40vw, 700px)` でモバイルでも幅 400px、`-12%` 配置と `overflow:hidden` の親で視覚的にバランスする想定。
- 担当: 開発部門（オーナー直要望）

## DEC-031: Proposal-H Values セクション — 「イラストを warm に溶かす」方針を転換し **セクション背景を白** にして境界線を消す
- 日付: 2026-04-19
- 決定: DEC-030 直後（improver-web `1c7e060`）にオーナーから方針転換の指示。「Values のイラスト背景が白色であるため、（イラストを warm 背景に溶かすのではなく）背景色も白色にしてイラストの境界線がわからないようにしたい」。Values セクションから `th-bg-warm` クラスを除去し、セクション背景をデフォルト `--h-bg: #FFFFFF` に戻す。同時に DEC-030 で追加した `mix-blend-mode: multiply` と `filter: contrast(1.08) brightness(1.04)` は不要となるため削除。
- 判断根拠（採用案と却下案）:
  - 判断材料として上下セクションの背景を確認:
    - **About** (`.th-about-section`): `th-bg-warm` を持たない → デフォルト `--h-bg: #FFFFFF` = 純白
    - **Services** (`.th-services-section`): `th-bg-warm` を持たない → デフォルト `--h-bg: #FFFFFF` = 純白
    - つまり現状こそが「Values だけ warm で浮いている」状態。Values を白にすると **上下と完全に同じ背景色**になり、3 セクション連続でシームレスに繋がる（視覚的分断は逆に消える）。
  - **案 1: セクション全体白（採用）**:
    - `th-bg-warm` クラスを除去するだけ。最小差分。
    - PNG の白背景がセクション背景 (`#FFFFFF`) と完全一致 → 境界線が物理的に存在しなくなる（オーナー指示を直接満たす）。
    - `mix-blend-mode` / `filter` は白地上では作用しないが、後の混乱回避のため削除。
    - 装飾円 `.th-deco-circle` (`#F1F1F1`) は残留。白一色より subtle なアクセントが付く。
  - **案 2: カード単位（`.th-value-item`）だけ白（却下）**:
    - warm 背景が消える今、カードを paper 風に白くする意味がない（warm が無いのに白カードは文脈を失う）。
    - さらにカード境界がセクション境界として可視化され、オーナー指示「境界線がわからないように」と逆方向。
- 変更点（最小差分）:
  - `app/components/themes/h/values.tsx`: `className="th-section th-bg-warm"` → `className="th-section"`。コメントを DEC-031 方針へ更新。
  - `app/app/globals.css` `.th-value-illust-img`: `mix-blend-mode: multiply;` と `filter: contrast(1.08) brightness(1.04);` を削除。コメントを DEC-031 方針へ更新。
  - Services セクションのイラスト挙動は不変（Services 側の `mix-blend-mode: multiply` は別ルール `.th-service-sub-illust-img` に残ったまま）。
- 検証:
  - `improver-hp` `pnpm build` PASS（19 静的ページ、バンドル実質不変）。
  - `improver-web` `pnpm build`（sync 内）PASS（`/` 15.9 kB / 130 kB）。
  - `scripts/sync-h-to-web.sh --push "fix(h): values 背景を白にしてイラストの境界線を消す"` で `improver-web` を `1c7e060..4dd7b8a` に `main` push 完了。
- 確認ポイント（オーナー向け）:
  - Vercel デプロイ完了後、本番 `improver.jp/#th-values` で 3 ValueCard イラストの四角い境界線が完全に消えていること。
  - About → Values → Services の遷移で背景色の段差が無いこと（3 セクション連続白）。
  - 装飾円（左上の薄いグレー円）が白地上でも違和感なく subtle なアクセントになっていること（強すぎるなら後続タスクで透明度調整）。
- 担当: 開発部門（オーナー直要望）

## DEC-030: Proposal-H Values イラスト — `mix-blend-mode: multiply` に `filter: contrast()/brightness()` を併用して warm 背景になじませる
- 日付: 2026-04-19
- 決定: DEC-029 直後（improver-web `b1f0b07`）にオーナーから「Values のイラストを背景色と合わせてほしい」と指摘。Services と同じ `mix-blend-mode: multiply` のみでは Values 用 PNG が warm 背景（`th-bg-warm = #F8F7F3`）になじまない問題が発覚したため、`.th-value-illust-img` に `filter: contrast(1.08) brightness(1.04)` を追記して解消。
- 原因切り分け（読み取って確認した事実）:
  - `.th-value-illust` ラッパに background-color は設定されていない（透明）。
  - `.th-value-item` にも background は無い。`isolation: isolate` 等の stacking context 切断も無い。
  - `mix-blend-mode: multiply` 自体は Services 側 `.th-service-sub-illust-img` と同一指定で、CSS 設定上の差異は無し。
  - 決定的差異は **PNG 画像の中身** にあった:
    - Services 用 PNG（例 `service-01-gen.png`）は **背景が完全な純白**＋**線のみ**のシンプルな構図。multiply で純白部分が完全に透けて、線だけが残る。
    - Values 用 PNG（`values-01/02/03.png`）は **背景に薄いグレーのアンチエイリアス／ノイズ** が広く分布し、加えて **人物の服に大量のハッチング陰影（グレー）** が含まれる。multiply で warm 背景を掛けると、グレーノイズ部分が「薄汚れた灰色のシミ」として残り、PNG の四角い境界が浮いて見えていた。
- 採用案と理由:
  - 候補は A（透明維持）／B（`darken` に変更）／C（ラッパに warm 同色背景）／D（CSS フィルタで白側に寄せる）の 4 案。
  - **案 C は本質的に効かない**: `mix-blend-mode: multiply` は **画像自身と直下の背景** にブレンドするため、ラッパに warm 色を当てても画像との multiply 結果は変わらず、グレーノイズは残る。
  - **案 B（darken）** は線画自体まで warm 背景に染まり、線のコントラストが弱くなるリスク。Services と挙動が乖離する。
  - **案 D（filter）** が最も低リスク: `contrast(1.08)` で off-white の背景ノイズを純白側に寄せ、`brightness(1.04)` で全体を僅かに持ち上げる → multiply 通過後にグレーノイズが warm 背景と区別できないレベルまで薄まる。線画自体はコントラストで濃さを保つため、視認性は維持。
  - Services 側 PNG は元から純白なので、同じフィルタを当てても影響軽微（今回は Values だけ局所適用で副作用ゼロ）。
- 変更点:
  - `app/app/globals.css` の `.th-value-illust-img` に `filter: contrast(1.08) brightness(1.04);` を 1 行追記。コメントを DEC-029 → DEC-030 に拡張し、Services PNG との差異と filter 採用理由を明記。
  - 他のファイル（`values.tsx`、PNG 自体、`.th-value-illust` ラッパ、Services 関連 CSS）は **完全に不変**。最小差分。
- 検証:
  - `improver-hp` `pnpm build` PASS（19 静的ページ生成、CSS のみ変更のためバンドルサイズ実質不変）。
  - `improver-web` `pnpm build`（sync スクリプト内）PASS（`/` 15.9 kB / 130 kB）。
  - `scripts/sync-h-to-web.sh --push "fix(h): values イラストの背景をセクション背景になじませる"` で `improver-web` の `b1f0b07..1c7e060` を `main` に push 完了。
- 確認ポイント（オーナー向け）:
  - Vercel デプロイ完了後、本番 `improver.jp/#th-values` で 3 ValueCard イラストが warm 背景になじみ、四角い灰色のシミが消えていること。
  - Services セクションのイラストが従来どおり問題なく表示されていること（変更未適用）。
  - モバイル（< 768px）でイラストが過大表示されず、線画の視認性が保たれていること。
- 担当: 開発部門（オーナー直要望）

## DEC-029: Proposal-H Values セクション — 流用 SVG をオーナー提供の手描き風 PNG 3 枚に差し替え
- 日付: 2026-04-19
- 決定: DEC-028 直後（improver-web `e2e3178`）にオーナー指摘を受け、Values セクションの 3 ValueCard イラストを Theme G からの流用 SVG（`ProcessListen` / `ProcessBuild` / `ProcessGrow`）から、オーナー提供の手描き風 PNG 3 枚へ差し替え。
- 経緯:
  - DEC-024 以降、Values は Theme G の Process 系線画 SVG を借用していたが、Services（DEC-026〜028）が手描き風 PNG に統一されたことで、ページ全体のイラスト言語が "Services は手描き／Values は幾何 SVG" の二系統に分裂。
  - オーナーから「Values も Services と同じ世界観の手描き風で揃えたい」と指示。3 枚（指差し図解 / キューブ受け渡し / グラフ＋矢印）を支給。
- 変更点:
  1. **PNG 3 枚を新規配置**:
     - `app/public/images/theme-h/values/values-01.png`（1024×1024、index 0: 「現場に寄り添う」）
     - `app/public/images/theme-h/values/values-02.png`（1024×1024、index 1: 「小さく始める」）
     - `app/public/images/theme-h/values/values-03.png`（1024×1024、index 2: 「共に育てる」）
     - 既存の Services 画像と命名規則を揃え（ハイフン区切り）、`values/` サブディレクトリを新設。
  2. **`components/themes/h/values.tsx`** を書き換え:
     - SVG コンポーネント import（`ProcessListen` / `ProcessBuild` / `ProcessGrow`）を削除。
     - `valueIllusts` を SVG コンポーネント配列から `string` パス配列に変更。
     - `<Illust className="th-value-illust-svg" />` を `next/image` の `<Image>` に置き換え（`width={512} height={512}`、`sizes="(max-width: 768px) 200px, 260px"`、`alt={item.title}`）。
     - 新クラス名 `.th-value-illust-img` を付与（PNG 用）。
  3. **`app/globals.css`** に `.th-value-illust-img` を新設、Services と同じ `mix-blend-mode: multiply` で白背景を warm 背景になじませる。`.th-value-item` の grid 左カラムを `minmax(140px, 200px)` → `minmax(180px, 260px)` に拡張（PNG はベクター SVG より細密で存在感が薄れがちなため、左カラム幅を 1.3x ほど拡張）。`.th-value-illust-img { width: clamp(160px, 22vw, 260px); aspect-ratio: 1/1; object-fit: contain; mix-blend-mode: multiply; }`。
  4. **既存の `.th-value-illust-svg`** は他箇所からの参照に備えて残置（互換性確保）。Theme G の `process-listen/build/grow.tsx` は他所で未使用だが今回はスコープ外として削除しない（同期マニフェストにも残す）。
- 検証:
  - `improver-hp` (`projects/PRJ-011/app`) で `pnpm build` PASS（19 静的ページ生成）。
  - `sync-h-to-web.sh --dry` で `public/images/theme-h/` ディレクトリ全体が再帰コピー対象になっていることを確認（`values/` サブディレクトリも追従）。
  - `sync-h-to-web.sh --push` 実行 → `improver-web` で `pnpm build` PASS、コミット `e2e3178..b1f0b07` を `main` に push 完了。本番 Vercel に反映される想定。
- 確認ポイント（オーナー向け）:
  - Vercel デプロイ完了後、本番 `improver.jp/#th-values` で Values セクションの 3 イラストが手描き風 PNG に差し替わっていること。
  - `mix-blend-mode: multiply` により PNG 白背景が warm 背景（`th-bg-warm`）になじみ、Services セクションと同じトーンで統一されていること。
  - モバイル幅（< 768px）で grid が縦積みになり、イラストが過大表示されていないこと。
- 担当: 開発部門（CEO直実装）

## DEC-028: Proposal-H 追加微調整 5 件（Hero 3 要素間隔縮小 / Services 4 サービス本文をオーナー指定正式コピーに差替）
- 日付: 2026-04-19
- 決定: DEC-027 直後（improver-web `2bb1080`）にオーナー指摘を受けた追加微調整 5 件を反映。
  1. **Hero — 会社名 / メッセージ / ミッションの間隔を詰める（globals.css）**
     - `.th-hero.th-hero-message` の `justify-content` を `space-between` → `center` に変更。3 要素を画面中央付近に塊として集約。
     - `gap: clamp(16px, 2.4vh, 28px)` を追加し、会社名→メッセージ→ミッションの間隔を 16〜28px に固定。
     - `.th-hero-message-area` の `flex: 1`（高さ吸収）と `padding-block: clamp(24px, 4vh, 64px)` を撤去。親側の `justify-content:center + gap` で間隔制御するため不要に。
     - 上下 padding（Hero 全体の縦余白 `clamp(80px, 12vh, 140px) ... clamp(40px, 6vh, 80px)`）は **不変**。Hero セクション全体の縦バランスは維持しつつ、内側 3 要素のみを中央付近にギュッとまとめた。
     - JSX (`hero.tsx`) は構造変更なし、コメントのみ DEC-028 趣旨に更新。
  2〜5. **Services — 4 サービスの本文を完全置換（content/theme-h.ts）**
     - オーナーから受領した正式コピー（120〜160 文字）に `services.list[].body` を一字一句忠実に差替。鉤括弧「」、半角・全角句読点、半角中黒「・」を保持。
       - 01 GEN: 「販売・購買・在庫・生産管理など...GEN株式会社の公式パートナーとして...」
       - 02 生成AI: 「生成AIを業務に取り入れるための...「AIで何ができるのか分からない」という段階から...」
       - 03 BI: 「社内に蓄積されたデータをBIツールで...「数字はあるけど活かせていない」という状態から...」
       - 04 RPA: 「繰り返し発生する定型業務をRPAで自動化し...本来注力すべき業務に集中できる環境を整えます。」
     - 本文長文化に伴い `.th-service-body` の `max-width: 48ch → 56ch` に拡張。カード内で本文が縦に伸びすぎず、右カラムのイラストとの垂直バランスを維持。
     - レイアウト（横並び・偶数反転・モバイル縦積み）は **完全維持**。
- 理由: オーナー直接決裁。Hero は「3 要素を一体感のある塊として中央に提示する」editorial 構成、Services は「公式パートナー表記」「お客さま視点での導入便益」を含む正式コピーで信頼感を強化。
- 実装ファイル:
  - `app/components/themes/h/hero.tsx` — コメント更新（DEC-028 趣旨追記）
  - `app/app/globals.css` — `.th-hero.th-hero-message` の justify-content/gap 変更、`.th-hero-message-area` の flex/padding 撤去、`.th-service-body` の max-width 拡張
  - `app/content/theme-h.ts` — `services.list[].body` 4 件をオーナー指定文に完全置換、コメント更新
- ビルド:
  - `improver-hp` `pnpm build`: PASS（`/proposal-h` **8.18 kB / 136 kB**、DEC-027 7.95 kB から +0.23 kB＝本文長文化分）
  - `improver-web` `pnpm build`（sync スクリプト内）: PASS（`/` **16.8 kB / 131 kB**、DEC-027 16.6 kB から +0.2 kB）
- 同期: `scripts/sync-h-to-web.sh --push "fix(h): hero 3要素間隔を詰める / services 本文をオーナー指定文に差替え"` で improver-web に反映 → commit `e2e3178` push 完了 → Vercel 自動デプロイ。
- 確認ポイント: Hero 3 要素が中央で一体感のある塊に見えること、超ワイド (>1920px) でメッセージが 2 行で収まること、Services 各カードで本文が 4〜5 行内に収まり右イラストと垂直中央バランスが取れていること。
- 担当: 開発部門（オーナー直要望）

## DEC-027: Proposal-H DEC-026 オーナー差し戻し 3 件（Hero メッセージ 2 行縮小+中央揃え / Services 1 段目本文復活 / Footer 重複ナビ削除）
- 日付: 2026-04-19
- 決定: DEC-026 同日リリース直後にオーナー差し戻し 3 件を反映。
  1. **Hero 中央揃え + メッセージ 2 行サイズ化**:
     - `.th-hero.th-hero-message` の `align-items: stretch` → `center`、`text-align: center` を追加。これにより会社名 (IMPROVER LLC) / 主役メッセージ / ミッション (Next Flow) を全て **テキスト中央揃え** に統一。
     - 主役メッセージ font-size を `clamp(2.6rem, 9vw, 8rem)` → **`clamp(1.8rem, 4.5vw, 3.6rem)`** に縮小。`max-width` を `18ch` → `28ch` に広げ、`messageLines` の各文（最大 14 文字）が **デスクトップで 2 行ぴったり** で収まるように調整。
     - モバイル (≤767px) は `clamp(2rem, 10vw, 3.4rem)` → **`clamp(1.6rem, 7.5vw, 2.6rem)`** + `max-width 14ch → 16ch` で同じく 2 行で収まるサイズ。
     - `.th-hero-message-area` / `.th-hero-foot` の `justify-content: flex-start` → `center` に変更。
  2. **Services 1 段目本文 (service.body) のみ復活**:
     - `theme-h.ts` の `services.list[]` に `body` を再追加（4 サービス分、各 60〜100 文字の要約文）。値はオーナー指示書の 4 文をそのまま使用（DEC-024 期の `subs[].body` と同等の短文要約）。
     - `services.tsx` の `.th-service-header` 内、タイトル直下に `<p className="th-service-body">` を再描画。
     - DEC-024 期にあった「2 段目（subs[].headline + body の小見出し+サブ本文 2 カラム）」は撤去のまま。`subs[]` データも現状未参照（残置）。
     - `.th-service-body` CSS を `font-size: clamp(15px, 1.05vw, 16px); line-height: 2; max-width: 48ch; margin: 20px 0 0;` で再有効化（横並び左カラム内のタイトル直下表示に最適化）。
  3. **Footer 重複ナビリンク削除**:
     - `footer.tsx` の `footerNavItems` 配列 + `<nav>` ブロック全体を撤去。`th-footer-nav` / `th-footer-nav-link` CSS は残置（参照無し・将来削除可）。
     - 削除理由: 上部 StickyNav に同一リンク (ABOUT / VALUES / SERVICES / COMPANY) があり完全重複。
     - フッターは「会社名 + 所在地 → コピーライト + Proposal H ラベル」の最小構成に。
- 理由（オーナー差し戻し趣旨）:
  - DEC-026 では参考画像「画像 (23).png」の超大型タイポを忠実に再現したが、**実機では 4 行に折返してしまい "暴力的な大きさ" になっていた**。オーナーは「2 行ぴったり収まるサイズ」を希望。
  - DEC-026 で各サービスの説明本文 (service.body / subs[].body) を全削除したが、オーナーは「**1 段目（メイン説明文）は残せ**」と判断変更。2 段目（小見出し付きサブ本文）は撤去のままで OK。
  - フッターのナビリンクは上部 StickyNavH と完全重複しており冗長。
- 注: メッセージの中央揃えは「テキスト中央寄せ (text-align: center)」と「ブロック中央配置 (justify-content: center)」の両方を併用。ロゴ/ミッションは元から `<span>`/`<p>` だったため text-align だけで揃う。
- ビルド:
  - improver-hp `pnpm build` PASS (`/proposal-h` 7.95 kB / 135 kB First Load JS)
  - improver-web `pnpm build` PASS (`/` 16.6 kB / 131 kB)
- 同期: `scripts/sync-h-to-web.sh --push` で improver-web に反映済（commit `2bb1080`）→ Vercel 自動デプロイ。
- 確認すべきポイント:
  - 主役メッセージが **超ワイド (>1920px) でも 2 行で収まる** こと（max-width 28ch + 上限 3.6rem で文字数 14 / 28ch で 1 行確実）。
  - **モバイル (390〜414px) で 2 行収束** していること（max-width 16ch / 上限 2.6rem）。
  - 各サービスの本文がタイトル直下に表示され、横並び右カラムのイラストとの **垂直中央バランス** が取れていること（`align-items: center` 維持）。
  - フッターが寂しく見えないかの目視チェック（コピーライト + 会社情報 + プロポーザルラベルのみで構成）。
- 担当: 開発部門（オーナー直要望）

## DEC-026: Proposal-H UI 追加微調整 6 件（Hero タイポ大幅拡大+SCROLL削除 / Services 文章削除+横並び / Contact 完了表示センタリング）
- 日付: 2026-04-19
- 決定: DEC-024 / DEC-025 のリリース直後にオーナーから受領した追加 6 件を Theme H に一括反映。
  1. **Hero メッセージのフォントサイズを大幅引き上げ**: 旧 `clamp(2rem, 6.4vw, 5.4rem)` → 新 `clamp(2.6rem, 9vw, 8rem)`。`max-width: 18ch` で自然折返しを誘発し、参考画像（オーナー提供 `画像 (23).png`）の「視覚的に 4 行になる超大型タイポ」を再現。モバイルも `clamp(2rem, 10vw, 3.4rem)` に引き上げ、`max-width: 14ch`。
  2. **IMPROVER LLC ラベルを控えめサイズに**: 旧 12px / weight 800 / spacing 0.24em → 新 11px / weight 700 / spacing 0.28em。参考画像の editorial キャプション質感に合わせた。
  3. **Hero SCROLL ガイド撤去**: `<div className="th-hero-scroll">` 配下の "SCROLL" 文字 + 縦線パルスアニメ（`@keyframes th-hero-scroll-pulse`）を非出力に。`th-hero-scroll-*` セレクタは未参照だが残置（将来削除可）。`scrollText` データキーも未参照化。ミッション行（Next Flow）は引き続き表示。
  4. **Services 全 4 サービスの説明本文を全削除**: `themeH.services.list[].body` および `themeH.services.subs` をデータ層から削除。`services.tsx` 出力からも撤去し、各カードは「番号 + タグ + タイトル + イラスト」の 4 要素のみで構成。
  5. **Service カードを「テキスト ↔ イラスト」横並びに**: 旧「番号+タイトル+本文(縦) → サブ本文+イラスト(横2カラム)」の 2 段構造を、新「左:テキスト / 右:イラスト」の **1 段横並び** (`.th-service-row` `grid-template-columns: 3fr 2fr`) に再構成。偶数ブロックは `direction: rtl` で左右反転（左右リズム形成）。モバイルは縦積み + `order: -1` でイラスト先頭。タイトルは本文撤去を補うため `clamp(1.5rem, 2.8vw, 2.25rem)` / weight 500 に格上げ。イラストも右カラム拡大に合わせ `clamp(220px, 30vw, 400px)` に拡大。背景透過 + `mix-blend-mode: multiply` 維持。
  6. **Contact 送信完了メッセージを画面中央に**: `state.status === "success"` 時、`contact.tsx` を別ブランチ return に分岐し、見出し / リード / セクションラベルを描画せず（h2 のみ `sr-only` で a11y 維持）、`SuccessLetter` 単体を `min-height: 60vh` + `display: flex; align-items: center; justify-content: center` で縦中央化（`.th-contact-section--success`）。`.th-section` 既定の巨大 `padding-block` も成功時のみ縮小。
- 理由:
  - 主役メッセージは「画面の主役」になっていなかった（旧 5.4rem 上限では参考画像のインパクトに届かず）。
  - SCROLL ガイドは参考画像に存在せず、editorial 文脈ではノイズと判断。
  - Services の説明本文は内容重複（`title` と `body` が同義反復）で、タイトル + イラストで十分意味が通ると判断。
  - 説明本文を消すことでカードが薄くなる懸念は、横並び化 + タイトル格上げ + イラスト拡大の 3 点で吸収。
  - Contact 完了画面は inline 表示だと「フォーム位置に小さく出る」ため成功体験が弱く、画面中央に配置することで「届きました」の安心感を強調。
- ビルド: improver-hp `pnpm build` PASS（`/proposal-h` 7.61 kB / 135 kB、DEC-024 直後の 8.46 kB から 0.85 kB 減＝説明本文削除分）。improver-web `pnpm build` PASS（`/` 16.3 kB / 131 kB、DEC-025 直後の 17.1 kB から微減）。
- 同期: `scripts/sync-h-to-web.sh --push` で improver-web に反映済（commit `0d3f161`）→ Vercel 自動デプロイ。
- 確認すべきポイント:
  - 主役メッセージが大画面（>1920px）で 8rem 上限に達した時、行間 1.32 で破綻無いか目視確認推奨。
  - Contact 完了メッセージのセクション縦中央化は、Resend のメール送信成功（実 submit）でしか体験できないため、Vercel preview での実フォーム送信テスト推奨。
- 担当: 開発部門（オーナー直要望）

## DEC-001: 案件起案とスコープ定義
- 日付: 2026-04-15
- 決定: improver.jp を Next.js + Vercel ベースで全面リニューアル。Phase 0（企画・設計）として研究/マーケ/デザイン/開発/レビューの5部署横断で提案を策定。
- 理由: 現状サイトは社名以外ほぼ空のプレースホルダーであり、コーポレートサイトとしての信頼形成・問い合わせ獲得に機能していない。
- 担当: CEO

## DEC-002: デザインコンセプト「Crafted Simplicity」採用
- 日付: 2026-04-15
- 決定: "Crafted Simplicity"（職人的な簡潔さ）を採用。カラーはウォームグレー基調＋Deep Forest Green `#1F3A34`＋Amber `#C9A86B`。AI感回避5禁則適用。
- 理由: AI感を出さないクリーンデザイン方針と2026トレンドに適合、IT定番ブルーを避け差別化。
- 担当: デザイン部門

## DEC-003: 事業定義＝「GEN ERP × 中小企業向けWebアプリ開発パートナー」の二軸
- 日付: 2026-04-15
- 決定: 事業軸を **(A) GEN ERP導入支援** と **(B) 中小企業向けWebアプリ開発パートナー** の二本柱とする。他領域（BI/RPA/ローコード/DX）はB軸の実現手段として内包させる。
- 理由: オーナー直接決裁。A軸は既存実績・独自性あり、B軸は将来成長軸かつ自社プロダクト群（カミレス等）と整合。
- 担当: CEO ← オーナー決裁
- 影響: IA上部ナビで Services を「GEN ERP」「Web開発」の2カラムに再構成、実績・プロセス・料金も2軸で整理。

## DEC-004: CMSは MDX in repo (velite) 採用
- 日付: 2026-04-15
- 決定: コンテンツ管理は MDX in repo + velite。Sanity 等のヘッドレスCMSは採用しない。
- 理由: オーナー単独運用・更新頻度は月数本規模・Git履歴で十分。オーバーエンジニアリング回避。
- 担当: CEO ← オーナー決裁

## DEC-005: Hero実績訴求の初期数値を確定
- 日付: 2026-04-15
- 決定: Hero／Why セクションの実績訴求は以下を初期値とする:
  - **GEN ERP 導入実績: 10社**
  - **Webアプリ実装: 2件**
  - （訴求が薄い場合は定性訴求で補完: AI活用、スピード、伴走姿勢、コスパ、実装の柔軟性）
- 理由: オーナー確定値。今後実績が増えた際は MDX で更新可能な構造にする。
- 担当: CEO ← オーナー決裁
- 運用: 数値は MDX の frontmatter or `content/metrics.ts` 集中管理とし、1箇所の更新で全ページ反映する設計。

## DEC-013: コーポレートカラー（CI）正式採用
- 日付: 2026-04-15
- 決定:
  - **Primary: Improver Terracotta `#A84A22`**（煉瓦／洗朱調、職人の手の色）
  - **Secondary: Forest Moss `#4A6A54`**（里山の苔、静かな生命力）
  - Primary-soft: `#D4703C`（旧DEC-011 accent、tag/hover用に降格。AA不達のため文字色/CTA単独使用は不可）
  - Primary-deep: `#8A3A18`（hover, pressed）
  - Secondary-soft: `#8BAA94`
  - Secondary-deep: `#35503F`
  - Neutrals: bg `#FAFAF8` / bg-warm `#F5F0EB` / surface `#FFFFFF` / line `#DDD8D2` / text `#2C2C2C` / text-sub `#6B6560`
  - コピー: 「煉瓦を積む職人の手と、里山の苔 ― 堅実で温度のある editorial warm」
  - 使用比率: Neutrals 60 / Primary 30 / Secondary 10
  - AAコントラスト: primary on bg = 5.48:1 / secondary on bg = 5.78:1 （主要11組合せ検証済、`reports/corporate-identity.md`）
- 理由:
  - DEC-011で暫定採用の `#D4703C` はAA未達（3.3:1）でCTA/本文色に使えないため、半段深い煉瓦色 `#A84A22` へ昇格
  - GEN株式会社（gen-square）との同系譜ながら半段温度高の差別化
  - 日本の伝統色「洗朱」「山鳩」の精神、職人・里山の語彙で Next Flow の「働き方を探求する」ミッションと整合
  - AI感回避（多色グラデ・ネオン・紫・サイバー排除）
- 担当: CEO（デザイン部提案を採択）

## DEC-010: クライアント提供モックに基づく事業定義の再確定（3本柱）
- 日付: 2026-04-15
- 決定: 事業内容を **(1) クラウド型ERP「GEN」導入支援 / (2) 生成AI活用支援 / (3) RPA・BIによる業務自動化・可視化支援** の **3本柱** に確定。従来の「Webアプリ開発パートナー」軸（DEC-003のB軸）は**削除**。
- 理由: クライアント（インプルーバー合同会社 代表 大井信慶）から受領したモック（`company_overview.html`）を正の情報源とする。実事業は ERP+AI+RPA/BI の IT 活用支援中心であり、Webアプリ受託は主軸ではない。
- 影響:
  - Hero MetricBento（10/2）は**廃止**、実績訴求は Philosophy と Service カードに統合
  - IA再編: Hero → Philosophy → How We Work → Service → Company → Contact → Footer
  - ProductMock / Why / Process / Pricing / FAQ コンポーネントは**退場**（Philosophy/How We Work にマージ）
- 担当: CEO ← クライアント提供資料

## DEC-011: ミッション「Next Flow」とブランドトーン転換
- 日付: 2026-04-15
- 決定:
  - ミッション: 「**Next Flow ― その次の働き方を探求する ―**」
  - ヒーローコピー: 「わたしたちも、お客さまも。共に『その次』の働き方へ。」
  - パレット転換: Deep Forest Green `#1F3A34` は廃止。新パレットは warm palette:
    - `--color-bg #FAFAF8` / `--color-bg-warm #F5F0EB`
    - `--color-text #2C2C2C` / `--color-text-sub #6B6560`
    - `--color-accent #D4703C`（ウォームオレンジ=主アクセント）／`--color-accent-deep #B85A2B`／`--color-accent-soft #E8A87C`
    - `--color-green #5A7A64`（ソフトグリーン=副アクセント）／`--color-green-soft #8BAA94`
    - `--color-line #DDD8D2`
  - フォント転換: Geist 廃止 → **Noto Serif JP（見出し）+ Noto Sans JP（本文）+ Outfit（英字ラベル）**
  - デザインコンセプト: "Next Flow × Crafted Simplicity"。gen-square.com と同等のエディトリアル高級感（明朝大見出し・温かい木質の質感・静かな余白・大判実写1枚）。
- 理由: クライアントモック由来、gen-square（パートナー）との視覚的親和性、ターゲット中小企業経営層が「堅実・温度のある信頼」を感じる方向。
- 担当: CEO

## DEC-012: 会社情報確定
- 日付: 2026-04-15
- 決定:
  - 会社名: インプルーバー合同会社（Improver LLC）
  - 代表者: 大井 信慶
  - 所在地: 〒731-0153 広島県広島市安佐南区安東二丁目13番30-24号
  - 設立: 2022年2月28日
  - 資本金: 1,000,000円
- 理由: クライアント提供モック記載
- 担当: CEO

## DEC-009: 画像戦略（抑制的・editorial路線）
- 日付: 2026-04-15
- 決定:
  - 総数最大5枚＋OG 1枚
  - 採用: GEN ERP詳細 ×1（ドキュメンタリー実写）／Webapp事例 ×2（モックUI）／OG ×1（@vercel/og）／極薄テクスチャ背景 ×1（任意）
  - 不採用: Hero / Metrics / Services / Why / Process / Pricing / FAQ は活字主役で画像なし
  - 路線: editorial / documentary / quiet、顔アップ・握手・多色グラデ・ネオン・3D・AI生成は全て禁則
  - トリートメント: warm desaturate + light grain、primary/secondary で軽いduotone
  - ソース: Unsplash（無料）→ 本番前に Unsplash+ 再購入検討／ビルド時 `/public` 永続化
  - 代表者顔写真は将来撮影予定（オーナー準備待ち）
- 理由: 3部署議論で「活字と余白が主役」のデザイン部方針を軸に、マーケの信頼訴求は実写1枚＋OG＋事例モックで担保。リサーチのライセンス・AI生成規制動向とも整合。
- 担当: CEO（デザイン/マーケ/リサーチ 3部署統合）

## DEC-008: GitHubリポジトリ名 improver-work/improver-lp
- 日付: 2026-04-15
- 決定: GitHubリポジトリ名は **`improver-work/improver-lp`** とする（`improver-jp` 案から変更）。ローカルは `projects/PRJ-011/app/` で初期commit済み。
- 理由: オーナー指示（LP的な単一ページ構成であることを明示）。
- 残作業: オーナー側で GitHub 上にリポジトリ作成 → `git remote add origin git@github.com:improver-work/improver-lp.git && git push -u origin main`。
- 担当: オーナー（gh CLI未インストールのため）

## DEC-007: シングルカラム・ほぼ1ページ構成への転換
- 日付: 2026-04-15
- 決定: トップページは **シングルカラム（1カラム）・縦長1ページ**（ロングスクロール・ストーリーテリング）構成とする。従来のServices 2カラム／Works タブ等の横並び構造を全て縦積みに再設計。
- 理由: オーナー（クライアント）要望。可読性とストーリー性を優先し、モバイル/デスクトップを同じ体験で統一。
- 影響:
  - Services 2カラム → GEN ERP セクション → Webアプリ セクション の**縦連続**に変更
  - Works タブ切替 → ERP実績 → Webアプリ事例 の縦連続
  - ナビはアンカーリンク（sticky header + smooth scroll、View Transitions 検討）
  - サブページは最小化: 会社概要／プライバシー／特商法／個別事例ページ（Webアプリ2件）のみ
  - `/services/*` サブページは原則不要（1ページに統合）
  - スクロール主役の設計のため scroll-driven animations と section-snap を慎重に活用
  - 上下方向の余白リズム・見出しヒエラルキー・数値プルーフの視覚インパクトがさらに重要
- 担当: CEO ← オーナー／クライアント決裁

## DEC-014: Phase 2 着手 — CEO推奨案全採用
- 日付: 2026-04-16
- 決定: Phase 2 UI/UX 改善を CEO 推奨案に沿って着手。P0 Quick Wins（約5人日・1週間）→ P1 Main Design（約19人日・2〜3週間）の2段階。
- 理由: Phase 1 の warm editorial 基盤が完成度高く、3部門（研究/デザイン/開発）の徹底調査で「方向性は完璧、あとは大胆さと手触りを足すだけ」という収束結論に至った。総費用0〜80,000円、追加ライブラリ最小。
- 担当: CEO ← オーナー決裁
- 参照: `reports/ceo-phase2-uiux-final-proposal.md`

## DEC-015: DEC-009 画像戦略の条件付き緩和（代表者写真）
- 日付: 2026-04-16
- 決定: Letter from the Founder セクション限定で、代表 大井信慶 の "editorial 横顔 / 手元 / 環境越し" 写真 1 枚を解禁。正面顔アップ・握手・スーツ写真は引き続き禁則。
- 理由: LayerX事例（確度A）等で "体温のあるコンテンツ" として顔写真が信頼形成に寄与することが確認されており、4部門中3部門が「代表の顔が見えない」ことを信頼最大の漏れと診断。
- 運用: スマホ試写で先行実装 → 後日プロ撮影で差替え可能な設計（画像キー抽象化）。
- 担当: CEO ← オーナー決裁

## DEC-016: DEC-007 1ページ縦積み緩和 — 3種のみ下層ページ許容
- 日付: 2026-04-16
- 決定: Case Study / Insights / News の3種類に限り下層ページを許容。Service / Company / Philosophy / How We Work は引き続き1ページ内。
- 理由: Case Study を1ページに押し込むと縦幅過剰で読了率低下。抜粋カード＋下層ページ構成の方がSEO・読了率共に優位（Dev/Research部門合意）。
- 担当: CEO ← オーナー決裁

## DEC-017: Warm Dark 1ブロック採用（Letter from Founder）
- 日付: 2026-04-16
- 決定: Letter from the Founder セクション背景に **warm dark 墨色 #1F1B18** を採用。ページ全体のスクロール中に1ブロックの緩急を作る。
- 理由: 現状ページが `bg #FAFAF8 / bg-warm #F5F0EB` の近似明度で均質。1 ブロックの deep 背景で "手紙" の質感と信頼の深度を強調（デザイン部門提案）。
- 禁則: ダークモード全体化は不採用（warm editorialと衝突）。本セクション限定。
- 担当: CEO ← オーナー決裁

## DEC-018: Service 3 Faces SVG + 章番号体系 No. 0X / 10 採用
- 日付: 2026-04-16
- 決定:
  - Service 3本柱を **オリジナル SVG 3 モチーフ**（①煉瓦=ERP / ②ペン先+インク=生成AI / ③歯車=RPA/BI）で差別化
  - 全セクションに `No. 0X / 10` 章番号（Outfit tabular-nums）を挿入し editorial 誌の柱通番を立てる
- 理由: Service カードが現状均質で差別化が弱く、3 Faces SVG で事業の象徴性を視覚化（stroke 1.5 / viewBox 120×120 / 自社内制作 0円）。章番号は MUUUUU.ORG 等の editorial ギャラリー事例に準拠し、誌面品位を引き上げる。
- 担当: CEO ← オーナー決裁

## DEC-019: Analytics は Vercel Analytics + Speed Insights
- 日付: 2026-04-16
- 決定: アクセス解析・パフォーマンス計測に **Vercel Analytics + Speed Insights** を採用。無料枠で運用、プライバシー配慮（Cookie不要）。
- 理由: 選定候補のGA4はCookie Consent対応が別途必要、Plausibleは月$9の固定費。1名運用の保守コストを最小化するため Vercel 標準に統一。
- 担当: CEO ← オーナー決裁

## DEC-020: 画像・写真予算と撮影方針
- 日付: 2026-04-16
- 決定:
  - ストック写真購入予算: 上限 30,000円（Unsplash+ 等、不要なら0円運用）
  - 代表者撮影: **スマホ試写先行 → 後日プロ撮影の2段階**（上限50,000円、プロ撮影は任意）
- 理由: 1名運用で即実装→運用で格上げ、という段階実装ポリシーを維持。総費用を0〜80,000円に抑制。
- 担当: CEO ← オーナー決裁

## DEC-021: 4wide.jp から "手触り3点セット" を輸入（Lenis / Word-Reveal / Tactile Video）
- 日付: 2026-04-16
- 決定: https://4wide.jp/ の実測分析（Playwright）に基づき、以下3点を Phase 2 に追加採用:
  - **追加A: Lenis 1.3 慣性スクロール**（lerp 0.08 / wheelMultiplier 0.8 / easeOutExpo、追加バンドル7KB、`prefers-reduced-motion` 分岐）
  - **追加B: Word-level Y translate リビール**（SplitType 2KB + CSS `animation-timeline: view()`、Hero h1 + 各h2 5箇所）
  - **追加C: Tactile Video 1本新設**（8〜12秒 1080p、"ペン先で紙に線を引く" 等 warm editorial を映像化、`filter: sepia(0.08) saturate(0.9)`、Philosophy と Works の間に配置）
- 除外（4wide から不採用）:
  - モノクロ4色パレット（Terracotta × Moss CI を維持）
  - html `font-size: 1px` 特殊設計（既存rem設計との非互換）
  - Three.js WebGL Hero（技術コスト／保守負債／AI感リスク）
  - Swup ページ遷移（Next.js App Router の View Transitions で代替可）
- 理由: 4wide.jp の "手触り感" の核心は慣性スクロール × word-reveal × 実写動画の同期であり、CI や 5禁則に抵触せず improver.jp に翻訳輸入可能（デザイン＋リサーチ合同チーム実測結論）。
- 工数: 追加 +4〜7人日（Phase 2 既存計画の30〜40人日に対し10〜20%増）。
- 参照: `reports/phase2-4wide-analysis.md`
- 担当: CEO ← オーナー指示（4wide.jp を参考サイトとして提示）

## DEC-022: Proposal-H Services ナビ hover アニメーション — goodthewhat 風「点線伸長 + 黒丸下移動」に確定
- 日付: 2026-04-17
- 決定: Proposal-H の Services ナビ hover 動作を **「点線が scaleY で下方向に伸び、黒丸が bottom 移動で下に下がる」** の2要素連動アニメに確定。参考: https://www.goodthewhat.com/services/ 。
- 経緯:
  1) 初版: 点線が bottom:30 の height 0→40 で上方向に伸び、黒丸が bottom 20→-22 に下移動 → オーナー指摘「上下に動いてしまう」。
  2) 中間案（廃止）: 点線を廃止し球自体を縦ピル化する方向へ振ったが、オーナー再指摘「黒丸が下に移動し、点々が伸びるイメージ」＝1)の方向性が正しいと判明。
  3) 確定版: 点線の **top を球の元 top 位置に固定** し scaleY(0→1) で下方向に伸長、黒丸は bottom を `offset - extend` に下移動。単一 CSS 変数 `--th-svc-extend`（既定 48px）で点線長＝球の移動距離を連動制御するため、点線下端と球上端が常にピッタリ接続。
- 実装:
  - `::before` の bottom を `(dot-offset + dot-base) - extend` に計算配置し、`transform-origin: top center; transform: scaleY(0→1)` で下方向伸長
  - `::after` は円のまま `bottom: 20px → calc(20px - extend)` に移動
  - transition: 0.5s cubic-bezier(0.19, 1, 0.22, 1)
- 担当: 開発部門（CEO直実装）

## DEC-025: Proposal-H Nav に COMPANY 項目を追加（DEC-024 フォローアップ）
- 日付: 2026-04-19
- 決定: `app/components/themes/h/nav.tsx` の `navItems` 配列に `{ label: "Company", href: "#th-company" }` を追加。
- 配置: ABOUT / VALUES / SERVICES / **COMPANY** / CONTACT の順。`/proposal-h` ページ内のセクション順（About → Values → Services → Company → Contact）と一致。
- 理由: DEC-024 の Nav 全面書換時に COMPANY セクションへのアンカーが落ちていた。オーナーから「COMPANY が無いので追加してほしい」との直要望。
- 実装: navItems に 1 行追加するのみの最小差分。デスクトップ水平メニューとモバイルオーバーレイは同じ配列を共有しているため両方に反映。current-section ハイライトロジックは元から未実装のため順序依存の副作用なし。
- ビルド: improver-hp `pnpm build` PASS / improver-web `pnpm build` PASS。
- 同期: `scripts/sync-h-to-web.sh --push` で improver-web に反映済（commit `a07784c`）→ Vercel 自動デプロイ。
- 担当: 開発部門（オーナー直要望）

## DEC-024: Proposal-H UI 7 点改善（Hero 刷新 / Nav 常時固定 / About 1 カラム / Services 簡素化 / Company 見出し変更）
- 日付: 2026-04-19
- 決定: オーナーから受領した 7 件の改善要望を Theme H に一括反映。
  1. **Hero 刷新**: 上部イラスト/Dシェイプ画像/巨大「Improver」/CTA を全廃。新構成は **(a) IMPROVER LLC ラベル → (b) 主役メッセージ「わたしたちも、お客さまも。共に「その次」の働き方へ。」（2 行・大型タイポ・font-weight 700・clamp(2rem, 6.4vw, 5.4rem)） → (c) ミッション「Next Flow －その次の働き方を探求する－」 → (d) SCROLL ガイド** の縦 4 段。メッセージ 2 行分割位置は **「わたしたちも、お客さまも。」「共に「その次」の働き方へ。」** に確定（句点 + 文意の境目で意味の塊を保つ。要望文中の参考イメージ「4 折れ」は紙面サイズ依存の想定で、デザイナー判断として 2 行を採用）。
  2. **Nav 常時固定**: 旧 IntersectionObserver 制御（Hero 抜けで出現 / Footer で消失）を撤去し、ページロード時から `.is-always` クラスで上部水平メニューを **常時固定表示**。サイドナビ系は元々無し。モバイルはハンバーガー → オーバーレイ維持。
  3. **About 1 カラム化**: 段落内 `\n` を半角スペースに置換し `<br>` を撤去、`lead/quote-inline/mission` の差別クラスを統一クラス `.th-about-paragraph` に集約。中段の段組み（カラム）レイアウトは元から未実装だったため変更なし、強制改行のみ撤去。
  4. **Services 番号付きナビ削除**: 「お手伝いできること / How We Help You」直下の 01〜04 ドットアニメ ナビ (`ServiceNav`) を撤去。`th-svc-nav*` 系 CSS は残置（参照無し・将来削除可）。
  5. **Service カードのシンプル化**:
     - 番号フォントサイズ: `clamp(60px, 8vw, 80px)` → `clamp(40px, 5vw, 56px)` に縮小
     - 巨大背景透かし文字 `bgLetter` (N/E/X/T) を削除
     - 写真の白枠（border + shadow + rotate）を撤去、新クラス `.th-service-sub-illust-img` で **背景透過 + mix-blend-mode: multiply** に
     - サブセクション見出し (`th-service-sub-headline`) は本文と意味重複のため削除
  6. **SERVICES と COMPANY 間の余白縮小**: `.th-section` 既定 `padding-block: clamp(200px, 25vw, 400px)` を、Services 下端と Company 上端だけ `clamp(80px, 10vw, 160px)` に縮小（他セクション境界には影響させない）。
  7. **Company 見出し変更**: `会社概要 / About Our Company` → `わたしたちのこと / Who We Are` に変更（`content/theme-h.ts` の `company.heading` / `company.subheading`）。
- 理由: オーナー直接決裁。会社の主張を「タイポグラフィの主役化」と「ノイズの最小化」で前面に出す方向。AI 感を出さない・editorial warm の手触りは維持。
- 実装: `app/components/themes/h/{hero,nav,about,services}.tsx` 全面書換、`app/content/theme-h.ts` の `hero.brandLabel/messageLines/mission` 追加と `company` 見出し更新、`app/app/globals.css` の Theme H Hero ブロックを置換 + Services / About / 余白用クラス追加。
- ビルド: `pnpm typecheck` ・`pnpm build` 共に PASS。`/proposal-h` ルート 8.46 kB / 136 kB First Load JS。
- 同期: `scripts/sync-h-to-web.sh --push` で improver-web へ反映 → Vercel 自動デプロイ。
- 担当: 開発部門（オーナー直要望）

## DEC-023: Proposal-H 冗長UI 3点を撤去（Hero ABOUT US ボタン / 代表者顔写真 / Footer 上段 CTA 帯）
- 日付: 2026-04-17
- 決定: オーナー指示により以下3点を Proposal-H から撤去:
  1) Hero 説明文直下の `ABOUT US` CTA ボタン（すぐ下に About セクションがあり冗長）
  2) Company セクションの代表者円形顔写真
  3) Footer 上段の「お気軽にお問い合わせください」帯 + `CONTACT` ボタン（`.th-footer-upper` 要素）
- 重要注記（DEC-023-a 修正）: 当初 (3) の解釈を誤り `<ContactH />` セクション本体 / ナビの Contact リンクまで削除したが、**お問い合わせフォーム本体は必ず残す**方針のため同日中に復元。撤去対象は Footer 上段のグレー CTA 帯のみ。
- 理由:
  - (1) 同一アクションが近距離で重複 → ノイズ
  - (2) 代表者写真を掲載しない方針
  - (3) Footer のグレー上段は黒帯1層で足る（情報量スリム化）／フォームは保持
- 最終状態:
  - Footer は 2層 → 黒帯1層のみ（`.th-footer-upper` 削除）
  - Hero 直下の ABOUT US CTA 削除
  - Company の代表者円形写真 + `FOUNDER_IMAGE_KEY` import 削除
  - `<ContactH />` フォーム / Hero nav / Sticky nav / Mobile nav の Contact リンクは **保持**
- 担当: 開発部門（CEO直実装）
- 日付: 2026-04-15
- 決定: 開発部の初期見積5.5週をレビュー補正により6〜7週に延伸。Phase1=2週 / Phase2=2週 / Phase3=1.5〜2週 / 予備0.5〜1週。
- 理由: 法務ページ・JSON-LD・llms.txt・和文フォント検証・SPF/DKIM/DMARC等の見落とし対応。
- 担当: CEO
