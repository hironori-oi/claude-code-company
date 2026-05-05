---
type: playbook
pattern_id: PATTERN-005
title: AI コスト管理プレイブック
domain_tags: [ai-cost, observability, finops, llm, budget]
tech_tags: [openai, gpt-5-mini, gpt-4.1-mini, batch-api, tts, prompt-caching]
maturity: production-proven
adoption_count: 4
adopted_in: [PRJ-005, PRJ-014, PRJ-016, PRJ-017]
created_date: 2026-04-28
updated_date: 2026-04-28
quality_score: A
author: dev
---

# AI コスト管理プレイブック

> **TL;DR** — AI 機能の **想定コスト試算 → 実測との差分監視 → Budget Alert 自動停止 → 段階再開 → 有償化トリガー記録**を、再現可能な手順として体系化したもの。
> PRJ-017 ホメコトの **DEC-004 訂正事案（¥7,600/月見積 → 真値 ¥200/月 → 最終確定 ¥21.3/月）** のように、**過大見積もりは予算判断・料金設計を直接歪める** ため、初期試算の精度確保 × 実測ベースの継続更新が必須。
> このプレイブックを `cp -r` で出発点として使えば、新規案件の AI コスト試算は**初日 30 分で 80% の精度**、Phase 1 中盤までに **誤差 ±20% 以内** に追い込める。

---

## 1. 問題（Problem）

AI 機能を案件に組み込むと、コスト試算と運用で次の事故が連発する：

- **CRITICAL 事故 1（PRJ-017 DEC-004）**: Dev レポートで「月¥7,600」と試算 → Review が再計算で **130 倍の過大計算**を検出 → 真値月¥200 未満に訂正。**過大見積のまま料金設計に流れたら粗利率を歪めていた**
- **CRITICAL 事故 2（プロンプトインジェクション想定）**: Budget Alert 未設定の状態で大量呼出を喰らうと、月¥3,000 上限なしに走る → オーナー個人カード課金で停止できない
- **HIGH 事故 3（PRJ-016 Phase 1 想定）**: AI コーチ会話量が学習者ごとに不均一 → 当日 ¥10/学習者 cap が無いと 1 名だけで月¥1,000 超
- **HIGH 事故 4**: 「Claude / GPT / Gemini どれが安いか」で意思決定したが、Batch API 50% 引き / Prompt Caching 1/10 等の**ディスカウント機構を見落とし**、実コストの 2〜3 倍で見積
- **HIGH 事故 5**: TTS（合成音声）コストが文字数線形でかかるが、文字数 cap が無くて月次予算を超過
- **MEDIUM 事故 6**: スケール時（β 50 社 → 公開 200 社）の有償化トリガーが記録されておらず、突然の Vercel Pro / Turso 有償化で予算ショック

これら全ての根本原因は「**コスト試算と運用ガードが場当たり的**」。本プレイブックは「想定 → 実測 → 監視 → 段階再開 → 有償化」を体系化する。

---

## 2. コンテキスト

このプレイブックを採用すべき条件:

| 条件 | 説明 |
|---|---|
| C1 | LLM / TTS / Embedding / Moderation の **少なくとも 1 種を本番運用**する |
| C2 | 案件ごとに月次予算（¥1,000〜¥30,000）の枠が設定されている |
| C3 | オーナー個人クレジットで AI API キーを発行（PRJ-017 DEC-027 と同形）|
| C4 | β規模（〜100 名 / 〜50 社）の永続無料運用を志向、有償化判断は CEO 決裁 |
| C5 | Sentry or Vercel Logs などの監視基盤がある |

**採用しない方が良いケース**:

- AI 機能が PoC / 1 セッション完結型でコスト 1 桁円以下
- 法人クレジットで予算管理が経理部門に委任されている（本プレイブックは個人開発前提）

---

## 3. 解決策（Solution）

### 3.1 全体フロー（5 ステージ）

```
┌─────────────────────────────────────────────────────────────────┐
│ Stage 1: 想定コスト試算（Phase 0、初日 30 分）                    │
│   = ユーザー数 × 月次操作数 × トークン単価 × 安全率              │
│   → DEC-XXX「コスト真値確定」として記録                           │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 2: モデル選定 + ディスカウント機構の選択（Phase 0/W1）      │
│   ・gpt-5-mini / gpt-4.1-mini（fallback）                         │
│   ・Batch API 50% 引き / Prompt Caching 1/10                     │
│   ・TTS 6 voice 月次ローテ                                        │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 3: ガード実装（Phase 1、W1〜W2）                            │
│   ・Budget Alert ¥3,000/月（DEC-027 例）                          │
│   ・¥/req cap、当日 ¥/user cap                                    │
│   ・Cron 中断 / レート制限ハンドリング                            │
│   ・課金前 smoke check（DEC-029 pingR2）                          │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 4: 監視 + 実測との差分比較（Phase 1〜運用）                 │
│   ・¥/req メトリクス収集                                          │
│   ・OpenAI Dashboard Usage 月次確認                               │
│   ・実測 > 想定 1.3x → CEO 報告                                   │
│   ・fallback 発火率 / 整合性失敗率                                │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Stage 5: 段階再開 + 有償化トリガー記録（Phase 2）                 │
│   ・Budget Alert 発火後の段階再開手順                             │
│   ・MAU 閾値 / 同時接続閾値 / 月次操作数閾値で有償化              │
│   ・Phase 2 起案時に再上申事項                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 各ステージの責務

| Stage | 責務 | やってはいけないこと |
|---|---|---|
| 1. 想定試算 | 一次ソース（公式 pricing）引用、安全率 1.5〜2x で初期見積 | input/output token を全て 100 で揃えるなど雑な試算（PRJ-017 DEC-004 教訓）|
| 2. モデル選定 | ディスカウント機構を必ず網羅、fallback を環境変数で切替可能に | 「最新モデルだから一律高い」と思い込まない（gpt-5-mini は GPT-5 系最廉価）|
| 3. ガード実装 | Budget Alert / ¥/req cap / 課金前 smoke check の三段構え | Budget Alert を「いつか設定する」と先送りしない（事故時に止められない）|
| 4. 監視 | 1.3x 偏差 で CEO 報告、月次レポートに ¥/req を必ず記載 | 異常検知を Sentry 任せにせず、月次目視も併用 |
| 5. 段階再開 | 停止理由切り分け → 部分再開（読み取りのみ等）→ 全面再開 | 一気に全面再開して再度上限抵触するパターン |

---

## 4. 実装スケッチ

### 4.1 Stage 1: 想定コスト試算テンプレート

#### 4.1.1 試算式

```
月次想定コスト ¥ = Σ(機能ごと):
    ユーザー数
  × 1 ユーザー月次操作数
  × (Input tokens × Input単価/1M + Output tokens × Output単価/1M)
  × USD→JPY 換算（150 円想定）
  × 安全率 (1.5〜2x、初期 Phase は高め)
```

#### 4.1.2 PRJ-017 ホメコト 50 名規模 試算（実数値）

| 機能 | ユーザー × 操作 | Input tok | Output tok | 単価 | コスト/月 |
|---|---|---|---|---|---|
| 投稿フレーバー生成 | 50 × 8 = 400 件 | 880 | 80 | $0.25/$2.00 | **¥14**（Cache 込み）|
| 月次ベスト 3 選定 | 月 1 回 | 53,200 | 1,200 | 同上 | **¥2.4** |
| 月次台本生成 | 月 1 回 | 1,200 | 320 | 同上 | **¥0.14** |
| TTS（announceText 3 件 × 100 字）| 月 3 件 | — | 300 chars | $15/1M chars | **¥4.8** |
| Moderation API | 400 件 | — | — | $0.0001/text | **¥0.5** |
| **合計**（gpt-5-mini）| — | — | — | — | **約 ¥21.8 / 月** |
| Fallback gpt-4.1-mini 想定 | 同上 | 同上 | 同上 | $0.40/$1.60 | 約 ¥34/月（1.6x）|

> PRJ-017 公式実績は **¥21.3/月**（DEC-028）でほぼ一致。

#### 4.1.3 PRJ-016 HANEI（K-6 学習者単価厳守）試算

| 機能 | 単価 | 上限ガード |
|---|---|---|
| AI 学習コーチ（gpt-5-mini streaming）| 学習者あたり ¥4.86/日 | **当日 ¥10/学習者 cap** |
| writing 採点（gpt-5-mini）| ¥1/req cap | **¥1/req hard cap** |
| LLM-as-Judge（Sonnet 4.5、生成 1,600 問評価）| 月 ¥1,500〜¥3,500 | 月次合計上限 |

#### 4.1.4 ¥7,600 → ¥200 訂正事案（PRJ-017 DEC-004）

**過大見積発生時の Dev レポート前提**（仮想再現）:
- input/output 各 1,000 token と思い込み
- 月 400 件 × 1,000 = 400,000 token 入力 + 400,000 token 出力
- $0.25 + $2.00 = $0.000625/req × 400 件 = **$0.25 / 月（≒ ¥38）** ← ここまでは正しい
- だが間違えて「月 4,000 件 × token 高め × USD/JPY 雑」で計算 → ¥7,600

**Review の再計算による真値**: 月¥200 未満（gpt-5-mini ベスト3 選定 ¥32 + tts-1 月次発表 ¥135 程度）

**最終確定**: DEC-028 で **¥21.3 / 月**（OpenAI 従量分のみ、Phase 1 全期間維持）

**教訓 130x 過大の原因**:
1. token 数を全機能で 1,000 と粗くまるめた
2. USD/JPY を 200 円で雑に計算（実際 150 円前後）
3. ディスカウント機構（Cache / Batch）を計上漏れ
4. Phase 0 → Phase 1 の試算精緻化を怠った

> **対策**: 試算は **必ず一次ソース（公式 pricing）の URL 付き**で記録し、Review が再計算して食い違いを潰す（CEO 即決でなく Review pass 必須）。

#### 4.1.5 試算テンプレ（提案書 / DEC 直転用可）

```markdown
## AI コスト試算（PRJ-XXX）

**規模**: 50 / 100 / 500 名

### 機能 A: <機能名>
- ユーザーあたり月次操作: N 回
- 1 リクエスト Input: <token 数> tokens
- 1 リクエスト Output: <token 数> tokens
- モデル: gpt-5-mini ($0.25 / $2.00 per 1M tokens)
- Cache ヒット率想定: 40%（システムプロンプト 1,100+ tokens）
- 1 件コスト: $X.XXXXXX
- **月次コスト**: $X.XX ≒ **¥XX**

### 合計（規模別）
| 規模 | 月次コスト | Fallback 時 |
|---|---|---|
| 50 名 | ¥XX | ¥XX |
| 100 名 | ¥XX | ¥XX |
| 500 名 | ¥XX | ¥XX |

### 一次ソース URL
- https://openai.com/api/pricing/
- https://platform.openai.com/docs/models/gpt-5-mini
- https://platform.openai.com/docs/guides/prompt-caching
```

---

### 4.2 Stage 2: モデル選定 + ディスカウント機構

#### 4.2.1 モデル選定基準

| ユースケース | 推奨モデル | 理由 |
|---|---|---|
| 構造化出力 + 短文生成（褒め選定 / 採点）| **gpt-5-mini** | $0.25/$2.00 = GPT-5 系最廉価、272K context、json_schema strict 対応 |
| 高品質推論 / 長文（LLM-as-Judge）| Claude Sonnet 4.5 | 評価軸が複雑な場合 |
| Fallback（gpt-5-mini 失敗時）| **gpt-4.1-mini** | $0.40/$1.60 = SLM カテゴリ標準、互換性高い |
| TTS（音声合成）| **tts-1**（6 voices）| $15/1M chars、月次 voice ローテで体験変化 |
| Embedding | text-embedding-3-small | $0.02/1M tokens（最廉価）|
| Moderation | **omni-moderation-latest** | 無料 or $0.0001 程度 |
| 動画生成 / 画像理解 | **採用見送り**推奨 | 1 オーダー以上高い、本当に必要かを再検討 |

#### 4.2.2 ディスカウント機構の活用順序

| 機構 | 割引率 | 適用条件 | 設計指針 |
|---|---|---|---|
| **Prompt Caching** | input 単価 1/10 | システムプロンプト 1,024 tokens 以上 + 5〜10 分以内に再投入 | システムプロンプトに few-shot 例を増量して 1,100+ tokens に / 安定化させる |
| **Batch API** | input/output 共に 50% 引き | 24 時間以内処理可（即時性不要）| 月次ベスト 3 選定 / 月次台本生成 / 大量採点に適用 |
| **Cached input**（自動）| 1/10 | 自動キャッシュ | システムプロンプトを変更頻度低くする |
| **Tier 上昇**（隠れ割引）| なし（RPM/TPM 緩和）| 累計支払額で自動 | β規模では Tier 1 で十分（500 RPM）|

#### 4.2.3 TTS 6 voice 月次ローテ（PRJ-017 DEC-020）

```ts
// src/lib/ai/tts.ts
const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;

export function pickVoiceForMonth(yearMonth: string): typeof VOICES[number] {
  // yearMonth = '2026-04' → 月番号で巡回
  const monthNum = parseInt(yearMonth.split('-')[1], 10);
  return VOICES[(monthNum - 1) % VOICES.length];
}
```

**目的**: コスト変化なし（同 tts-1 単価）だが、毎月音声が変わって UX に変化を出す。

---

### 4.3 Stage 3: ガード実装

#### 4.3.1 Budget Alert（DEC-027 標準）

OpenAI Dashboard → Usage → Limits で:
- **Soft limit**: 想定月コストの 10x（メール通知）= ¥300（PRJ-017 想定 ¥21.3 × 10x ≈ ¥300）
- **Hard limit**: 想定月コストの 100x（API 自動停止）= **¥3,000**

> 100x の安全係数は「プロンプトインジェクションで暴走しても上限で必ず止まる」目安。PRJ-017 DEC-027 の確立値。

#### 4.3.2 ¥/req hard cap（PRJ-016 writing 採点）

```ts
// src/lib/ai/score-writing.ts
const MAX_COST_PER_REQ_JPY = 1.0; // ¥1/req

async function scoreWriting(text: string) {
  const estTokens = Math.ceil(text.length / 2); // 雑に文字数の半分
  const estCost = (estTokens * 0.25 + 200 * 2.00) / 1_000_000 * 150; // gpt-5-mini USD→JPY
  if (estCost > MAX_COST_PER_REQ_JPY) {
    throw new Error(`estimated cost ¥${estCost.toFixed(2)} exceeds cap ¥${MAX_COST_PER_REQ_JPY}`);
  }
  // ... LLM 呼出
}
```

#### 4.3.3 当日 ¥/user cap（PRJ-016 AI コーチ）

```ts
// 学習者ごとに当日累積コストを Redis or Turso に保持
async function checkDailyCostCap(learnerId: string, addCostJpy: number) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `cost:${learnerId}:${today}`;
  const current = await getCost(key); // 当日累積
  if (current + addCostJpy > 10) {
    throw new Error(`learner ${learnerId} exceeded daily cost cap ¥10`);
  }
  await incrementCost(key, addCostJpy);
}
```

#### 4.3.4 課金前 smoke check（PRJ-016 DEC-029 教訓）

```ts
// scripts/generate-tts-bulk.ts main 先頭
async function main() {
  // 1) OPENAI_API_KEY 検証 → 不在なら exit 1
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set');
    process.exit(1);
  }
  // 2) R2 ping 検証 → 401 なら exit 1（OpenAI 課金前に阻止）
  try {
    await pingR2('audio');
  } catch (e) {
    console.error('R2 audio bucket ping failed:', e);
    process.exit(1); // ← OpenAI 呼出前に終了
  }
  // 3) ここから初めて OpenAI 呼出
  // ...
}
```

> **PRJ-016 DEC-029 実証**: R2 環境変数命名ミスマッチで PUT 401 → smoke check が意図通り作動 → OpenAI 課金 ¥0 で停止。**「pingR2 通過後の最初の PUT で 401 が出たら IAM スコープ問題」と DEC-029 で予言した懸念が現実化したが、損害ゼロ**。

#### 4.3.5 Cron 中断 / レート制限ハンドリング

```ts
// 月次 Cron 内 / 1 org ずつ try/catch、失敗 1 org で全体停止しない
async function runMonthlyEventJob() {
  const orgs = await listAllOrganizations();
  const results = [];
  for (const org of orgs) {
    try {
      const r = await processSingleOrg(org);
      results.push({ orgId: org.id, ok: true, ...r });
    } catch (e: any) {
      if (e.status === 429) {
        // Rate limit: 60 秒待ってリトライ 1 回
        await sleep(60_000);
        try { /* retry once */ } catch (e2) { results.push({ orgId: org.id, ok: false, reason: 'rate_limit' }); }
      } else if (e.status === 503) {
        results.push({ orgId: org.id, ok: false, reason: 'service_unavailable' });
      } else {
        results.push({ orgId: org.id, ok: false, reason: e.message });
      }
    }
  }
  return { totalOrgs: orgs.length, succeeded: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results };
}
```

#### 4.3.6 Exponential backoff retry（TTS バルク等）

```ts
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      if (i === maxRetries - 1) throw e;
      const delay = 500 * Math.pow(2, i); // 500ms → 1s → 2s
      await sleep(delay);
    }
  }
  throw new Error('unreachable');
}
```

---

### 4.4 Stage 4: 監視 + 実測との差分比較

#### 4.4.1 ¥/req メトリクス収集

```ts
// src/lib/ai/metrics.ts
import * as Sentry from '@sentry/nextjs';

export function recordAiCallMetrics(opts: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  feature: string;       // 'select-top3' / 'score-writing' / etc
  cacheHit?: boolean;
}) {
  const inputUsd = (opts.inputTokens / 1_000_000) * (opts.cacheHit ? 0.025 : 0.25);
  const outputUsd = (opts.outputTokens / 1_000_000) * 2.00;
  const totalJpy = (inputUsd + outputUsd) * 150;

  Sentry.metrics.distribution('ai.cost.jpy', totalJpy, {
    tags: { model: opts.model, feature: opts.feature },
  });
  Sentry.metrics.distribution('ai.latency.ms', opts.durationMs, {
    tags: { model: opts.model, feature: opts.feature },
  });
  if (opts.cacheHit !== undefined) {
    Sentry.metrics.increment(opts.cacheHit ? 'ai.cache.hit' : 'ai.cache.miss', 1, {
      tags: { feature: opts.feature },
    });
  }
}
```

#### 4.4.2 月次レポート観点

| 指標 | 集計方法 | 健全性閾値 |
|---|---|---|
| 月次総コスト | OpenAI Dashboard Usage | < 想定 × 1.3 |
| 機能別 ¥/req（P50/P95）| Sentry distribution | feature ごとに想定値 ±30% |
| Prompt Cache ヒット率 | hit / (hit + miss) | > 30%（PRJ-017）|
| Fallback model 発火率 | gpt-4.1-mini 使用比率 | < 5% |
| Moderation flagged 率 | flagged / total | 通常 0.5〜2% |
| Cron 失敗 org 率 | failed / total orgs | < 1% |

#### 4.4.3 異常検知ルール

- 月次コスト **> 想定 × 1.3**（30% 超過）→ CEO 報告 + 原因調査
- Fallback 発火率 **> 10%**（連続 3 日）→ Primary モデルの API 健全性確認
- Hard limit 接近（80%）→ オーナーに **即時通知**
- ¥/req P95 が想定 × 2x → リクエスト個別ログ精査

#### 4.4.4 ダッシュボード設計（推奨）

```
┌──────────────────────────────────────────────────────┐
│ AI Cost Dashboard (PRJ-XXX, 2026-04)                 │
├──────────────────────────────────────────────────────┤
│ 月次総コスト:    ¥21.5 / ¥3,000 hard limit (0.7%)   │
│ 想定との差:     +0.9% (within tolerance)             │
│                                                      │
│ 機能別:                                              │
│   - select-top3:   ¥2.4   /req ¥0.0024               │
│   - praise-flavor: ¥14    /req ¥0.035                │
│   - tts:           ¥4.8   /char $15/1M               │
│   - moderation:    ¥0.5   /req ¥0.00125              │
│                                                      │
│ Cache hit rate:    42% (target: 30%)  ✓             │
│ Fallback rate:     1.2% (target: <5%) ✓             │
│ Crisis L3+ count:  0                                 │
└──────────────────────────────────────────────────────┘
```

> 実装は Vercel Analytics or Grafana。Phase 1 では **Sentry metrics を CSV エクスポート → Notion 月次レポートに転載** で十分（オーバーキル回避）。

---

### 4.5 Stage 5: 段階再開 + 有償化トリガー

#### 4.5.1 Budget Alert 発火後の段階再開手順

```
┌──────────────────────────────────────────────────┐
│ Hard limit 抵触 → API 自動停止                  │
└──────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────┐
│ Step 1: 原因切り分け（30 分）                    │
│   - Sentry で異常リクエスト元特定                │
│   - プロンプトインジェクションか / 想定超過か    │
│   - 単一ユーザー or 全体か                       │
└──────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────┐
│ Step 2: 部分再開（読み取りのみ / モデレーションのみ）│
│   - read-only 機能から再開（select-top3 表示等）  │
│   - 書き込み AI（生成系）は Hard limit 一時引上げ後再開│
└──────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────┐
│ Step 3: 全面再開（24h 以内）                     │
│   - 原因対策実装後（NG ワード追加 / Cache 強化 等）│
│   - 翌月 Hard limit を元に戻す                   │
└──────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────┐
│ Step 4: 振り返り DEC-XXX 起票                    │
│   - 原因 / 対策 / 再発防止策を記録               │
└──────────────────────────────────────────────────┘
```

#### 4.5.2 有償化トリガー記録テンプレ（Phase 2 起案時に再上申）

```markdown
## 有償化トリガー（PRJ-XXX）

| サービス | 無料枠 | 有償化トリガー | 月次コスト見込（有償時）|
|---|---|---|---|
| OpenAI | なし（従量）| Hard limit 抵触 | ¥21.3 → 規模 100x 時 ¥2,130 |
| Turso Hobby | 5GB / 500M reads | MAU 200+ or reads 400M+ | $29/月 (Hobby+) |
| Vercel Hobby | 100GB-Hours | MAU 200+ | $20/月 (Pro) |
| Cloudflare R2 | 10GB / 1M Class A | 容量 8GB 接近 | $0.015/GB |
| Resend Free | 3,000 メール/月 | 月 2,400 メール接近 | $20/月 (Pro) |
| Better Auth | OSS / 永続無料 | なし | 0 |

## MAU 閾値: 200
- 根拠: Vercel Hobby 100GB-Hours / 各種 Free Tier の合計上限
- 発動時アクション: CEO 決裁 → Pro tier 一斉移行（合計 +¥10,000/月想定）

## 同時接続閾値: 月次イベント 800 同時
- 根拠: Polling 1.5s 間隔 × 800 = 533 reads/sec → Turso 500M reads/月 抵触
- 発動時アクション: SSE on Vercel Functions に upgrade（Phase 2 候補）
```

---

## 5. 採用案件

### 5.1 PRJ-005 カミレス（PRJ-002 + PRJ-003 SaaS 統合製品）

- **採用形態**: Supabase + Upstash Redis レート制限
- **特殊事項**: マルチテナント単位のレート制限、AI コストはユーザー数線形

### 5.2 PRJ-014（社内自動 AI 組織並列運用パターン起源）

- **採用形態**: AI SDK + OpenAI / Ollama
- **特殊事項**: 計画 76 人日 → 実績 34 人日（45% 短縮）の組織コスト最適化と AI コストの統合管理
- **位置**: `patterns/ai-org-parallel-implementation-playbook.md`

### 5.3 PRJ-016 HANEI（小学生英検対策）— **¥/user/day cap 起源**

- **採用形態**: AI 学習コーチ（gpt-5-mini streaming）+ writing 採点 + LLM-as-Judge（Sonnet 4.5）
- **特殊事項**:
  - **¥1/req hard cap**（writing 採点）
  - **当日 ¥10/学習者 cap**（コーチ会話）
  - K-6 厳格化方針: AI コストは無料運用前提なのでオーナー個人負担、1 学習者 1 日 ¥10 以下
  - 課金前 R2 smoke check（DEC-029）で OpenAI 呼出前停止 → 損害 ¥0 実証
- **位置**: `projects/PRJ-016/decisions.md` DEC-029 / `dev-w5-backend-implementation.md`

### 5.4 PRJ-017 ホメコト（社内褒め活推進）— **¥21.3/月確定 + ¥7,600→¥200 訂正事案**

- **採用形態**: gpt-5-mini + tts-1 6 voice + Moderation
- **特殊事項**:
  - **DEC-004 訂正事案**: ¥7,600 → 真値 ¥200 → 最終 ¥21.3/月
  - **DEC-027**: OpenAI API キー個人発行 + Budget Alert ¥3,000/月
  - Phase 1 全期間月次コスト ¥21.3 確定（DEC-028）
  - 公開β 30〜50 社想定で月¥800〜¥1,300（予算 ¥10,000 の 13% 以下）
- **位置**: `projects/PRJ-017/decisions.md` DEC-004 / DEC-027 / DEC-028 / `research-w1-llm.md`

### 5.5 採用案件サマリー比較表

| 案件 | 月次想定 | 月次実績 | hard cap 種別 | Budget Alert |
|---|---|---|---|---|
| PRJ-005 | 月 ¥1,000〜¥5,000 | 規模依存 | なし（マルチテナント rate limit）| 案件レベル |
| PRJ-014 | 月 ¥3,000〜¥10,000 | 計画通り | なし | あり |
| PRJ-016 | 月 ¥7,500〜¥12,500（学習者依存）| Phase 1 中 | **¥1/req + ¥10/user/day** | あり |
| PRJ-017 | 月 ¥21.3 確定 | 確定 | なし（小額のため）| **¥3,000/月（100x）**|

---

## 6. トレードオフ

### 6.1 採用しない方が良いケース

| 状況 | 理由 |
|---|---|
| AI 機能が PoC / 単発 | プレイブックのオーバーキル |
| 法人クレジットで予算管理が経理に委任済 | 個別 Budget Alert は不要、経理側で月次集計 |
| AI コストが月¥10 以下に確定 | hard cap や Sentry metrics は overhead が利益を上回る |

### 6.2 既知のトレードオフ

| 項目 | 影響 | 緩和策 |
|---|---|---|
| Budget Alert hard limit が低すぎると正常運用も止まる | 想定 × 100x の安全係数を割らない |
| Cache 効果を最大化するとシステムプロンプト変更が困難 | 月 1 回の安定改善 + Cache invalidation を許容 |
| Batch API 採用で 24h 待機 | 月次系 / 即時性不要なものに限定（PRJ-017 ベスト 3 / 台本生成）|
| ¥/user/day cap で正常ユーザーが詰む | cap 超過時の「明日また使えます」UX を設計 |
| Sentry metrics は無料枠 5K errors/月で metrics 別計測 | 大規模時は Grafana Cloud Free に移行（時系列保持期間延長）|

### 6.3 過大見積もりの典型パターン（DEC-004 教訓）

| アンチパターン | 実害 | 防御策 |
|---|---|---|
| token 数を全機能で粗くまるめる | 130x 過大（PRJ-017）| 機能ごとに input/output を細分化 |
| USD/JPY を 200 円で計算 | 1.3x 過大 | 公式為替（Yahoo finance 等）|
| ディスカウント機構を計上漏れ | 2〜3x 過大 | Cache / Batch / Tier を必ず網羅 |
| 安全率 5x で雑に倍率かける | 余剰見積 | 1.5〜2x が現実的 |
| Phase 0 の試算を Phase 1 で更新しない | 実態乖離 | W1 / W3 / Phase 末で更新義務化 |

---

## 7. アンチパターン

### 7.1 「Budget Alert を後で設定する」

```
ANTI-PATTERN
→ オーナーが「あとで設定する」と言って案件着手 → プロンプトインジェクションで月¥3,000 課金
```

**正しい形**: API キー発行と同時に Budget Alert 設定。発行 → アラート設定 → コード組込の順序を **DEC で明記**（PRJ-017 DEC-027 の T-1 ブロッカー方式）。

### 7.2 「実測コストを月次レポートに含めない」

実測がわからないと、想定との差分が見えない。CEO は「順調っぽい」感覚で見積を放置する。

**正しい形**: 月次レポートに **必ず ¥/req と機能別月コスト**を含める（PRJ-017 形式）。

### 7.3 「Cache ヒット率を測らない」

Cache 効果は「効いている前提」で運用しがちだが、システムプロンプトが頻繁に変わると hit rate 0% になる。

**正しい形**: Sentry metrics で hit / miss を集計、月次レポートに hit rate を出す。30% 未満ならプロンプト安定化を検討。

### 7.4 「Fallback コストを計算しない」

gpt-5-mini の予算で組んだが、実は 30% の req が gpt-4.1-mini に fallback して 1.6x コスト。

**正しい形**: 「Primary モデル + Fallback モデル想定」を併記、fallback 発火率上限を 5% で監視。

### 7.5 「TTS 文字数 cap なし」

announceText が長文化（200→500 字）すると TTS コストが線形に伸びる。

**正しい形**: announceText は zod で max 180 字、`clamp180()` で post-process。

### 7.6 「有償化トリガーを Phase 2 起案時に思い出す」

無料枠抵触の警告メールが来てから慌てる。

**正しい形**: **Phase 1 完了時に有償化トリガーシート（§4.5.2）を起票**、Phase 2 起案時に再上申。

---

## 8. 検証方法

### 8.1 試算精度の検証（Phase 1 W3 末）

| 項目 | 想定値 | 実測値 | 差分 | OK 判定 |
|---|---|---|---|---|
| 月次総コスト | ¥21.3 | ¥21.5 | +0.9% | ✓ |
| select-top3 / req | ¥0.0024 | ¥0.0026 | +8% | ✓ |
| Cache hit rate | 30% | 42% | +12pp | ✓ |
| Fallback rate | < 5% | 1.2% | — | ✓ |

判定基準: **想定の ±30% 以内なら OK**。1.3x 超は要因調査。

### 8.2 ガード動作検証

```bash
# Budget Alert 動作テスト
# 1) Soft limit を一時的に ¥1 に設定
# 2) AI を 10 回呼ぶ
# 3) メール通知が届くことを確認
# 4) Soft limit を戻す

# ¥/req cap 動作テスト
# 1) MAX_COST_PER_REQ_JPY=0.001 に設定
# 2) 通常リクエスト送信 → throw されることを確認
# 3) 設定戻す
```

### 8.3 Cron 中断テスト

```bash
# 50 org の Cron で 5 番目の org を rate limit にしても他は完走することを確認
TURSO_DATABASE_URL=file:./e2e.db E2E_RATE_LIMIT_ORG_INDEX=5 \
  npx tsx scripts/test-monthly-cron.ts
# 期待: failed=1 / succeeded=49
```

### 8.4 課金前 smoke check 検証（PRJ-016 DEC-029 形式）

```bash
# R2 環境変数を意図的に壊す
R2_AUDIO_BUCKET=nonexistent npx tsx scripts/generate-tts-bulk.ts --month 2026-04
# 期待: pingR2 で 404 → exit 1 / OpenAI Usage に記録なし（¥0）
```

### 8.5 月次運用チェックリスト（10 項目）

| # | 項目 | 確認方法 |
|---|---|---|
| 1 | OpenAI Dashboard で月次コスト確認 | ブラウザ |
| 2 | Sentry metrics で機能別コスト確認 | ダッシュボード |
| 3 | Cache hit rate > 30% 維持 | 同上 |
| 4 | Fallback rate < 5% 維持 | 同上 |
| 5 | Budget Alert hard limit 抵触なし | OpenAI Dashboard |
| 6 | Cron 失敗 org < 1% | 月次レポート |
| 7 | TTS 文字数 cap 内 | DB クエリ |
| 8 | Moderation flagged 率 0.5〜2% | Sentry |
| 9 | crisis L3+ 件数（KidSafe 案件のみ）| 通知ログ |
| 10 | 月次レポート起票 | `projects/PRJ-XXX/reports/monthly-ai-cost-{YYYY-MM}.md` |

---

## 9. 関連パターン・関連ナレッジ

### 9.1 関連パターン

- **PATTERN-001（マルチテナント三層認可）**: scopedDb 経由で AI 呼出時の org スコープを担保
- **PATTERN-003（Turso 移行プレイブック）**: 永続無料 6 ベンダー分散の前提
- **PATTERN-004（AI 三層ガード）**: Moderation / System Prompt / zod の実装詳細はこちら参照
- 起票予定: `patterns/llm-as-judge.md`（PRJ-016）/ `patterns/openai-prompt-caching.md`

### 9.2 関連 ADR / 決裁

- PRJ-017 **DEC-004**: コスト試算の真値確定（¥7,600 → ¥200 訂正、Review 検出）
- PRJ-017 **DEC-027**: OpenAI API キー個人発行 + Budget Alert ¥3,000/月
- PRJ-017 **DEC-028**: Phase 1 全期間月次コスト ¥21.3 確定
- PRJ-017 **DEC-020**: TTS 6 voice 月次ローテ
- PRJ-017 **DEC-021**: gpt-4.1-mini fallback
- PRJ-016 **DEC-029**: R2 環境変数 + pingR2（課金前 smoke check）

### 9.3 関連 tech-research

- `tech-research-hono-drizzle.md`（Drizzle 採用判断）
- `projects/PRJ-017/reports/research-w1-llm.md` §3「想定 token 数の精緻化」/ §7「Prompt Caching 詳細」/ §8「Batch API 活用検討」

### 9.4 関連 Checklist

- 起票予定: `checklists/ai-cost-monthly-check.md`（§8.5 の 10 項目）
- 起票予定: `checklists/ai-cost-initial-estimate.md`（§4.1.5 の試算テンプレ）

---

## 10. 次案件への移植手順（`cp -r` 出発点）

### Step 1: 試算テンプレ + DEC 雛形をコピー

```bash
PRJ_SRC=projects/PRJ-017
PRJ_DST=projects/PRJ-XXX

# 試算テンプレ（research-w1-llm.md §3〜§4 を参考に新規作成 or 雛形コピー）
cp $PRJ_SRC/reports/research-w1-llm.md $PRJ_DST/reports/research-w1-llm-cost-estimate.md
# DEC-004 / DEC-027 を雛形として転写
```

### Step 2: 機能別 token 数を細分化して試算

§4.1.5 のテンプレに沿って **必ず一次ソース URL を引用**しながら埋める。Review に再計算を依頼する（PRJ-017 DEC-004 の教訓）。

### Step 3: Budget Alert 設定（API キー発行と同時）

OpenAI Dashboard → Usage → Limits:
- Soft limit: 想定 × 10x
- Hard limit: 想定 × 100x（最低 ¥1,000、最大 ¥10,000 程度）

### Step 4: ガード実装（PATTERN-004 と併用）

```bash
cp $PRJ_SRC/app/src/lib/ai/moderation.ts        $PRJ_DST/app/src/lib/ai/moderation.ts
cp $PRJ_SRC/app/src/lib/ai/select-top3.ts       $PRJ_DST/app/src/lib/ai/select-top3.ts
# ¥/req cap、当日 ¥/user cap が必要なら PRJ-016 の score-writing.ts を参考
```

### Step 5: Sentry metrics 配線（§4.4.1）

```ts
// src/lib/ai/metrics.ts を新規作成 or 雛形コピー
// 各 AI 呼出箇所で recordAiCallMetrics() を呼ぶ
```

### Step 6: 月次レポート雛形を起票

```bash
mkdir -p $PRJ_DST/reports/monthly-ai-cost
# テンプレ:
# # PRJ-XXX 月次 AI コストレポート YYYY-MM
# - 想定: ¥XX
# - 実測: ¥YY (差分: +Z%)
# - 機能別 ¥/req
# - Cache hit rate
# - Fallback rate
# - 異常検知: なし / あり
```

### Step 7: 有償化トリガーシート起票

§4.5.2 のテンプレを `decisions.md` に DEC として記録。Phase 2 起案時に再上申。

---

## 11. 移植所要時間の見積もり

新規案件への移植工数:

| 工程 | 工数（人時）|
|---|---|
| 試算テンプレ埋め（一次ソース引用込み）| 2 時間 |
| Review に再計算依頼 + 訂正反映 | 1 時間 |
| Budget Alert 設定（オーナー手動）| 30 分 |
| ¥/req cap / ¥/user cap 実装（必要時）| 2 時間 |
| Sentry metrics 配線 | 2 時間 |
| 月次レポート雛形 + 有償化トリガーシート起票 | 1 時間 |
| 動作確認（smoke check 含む）| 1.5 時間 |
| **合計** | **10 時間 ≒ 1.3 人日** |

雛形 cp + 用語置換だけなら **0.5 人日** で完了。

---

## 12. 改訂履歴

| 日付 | 版 | 改訂内容 | 起草 |
|---|---|---|---|
| 2026-04-28 | v1.0 | 初版起票（PRJ-005/014/016/017 横断抽出、CEO DEC-003 Phase C 第 1 弾）| dev |

---

## 13. 参考文献・一次ソース

- `projects/PRJ-017/decisions.md` DEC-004 / DEC-020 / DEC-021 / DEC-027 / DEC-028
- `projects/PRJ-017/reports/research-w1-llm.md`（gpt-5-mini 仕様 + token 試算 + Prompt Caching + Batch API）
- `projects/PRJ-016/decisions.md` DEC-029（R2 smoke check）
- `projects/PRJ-016/reports/dev-w5-backend-implementation.md`（writing 採点 ¥1/req cap）
- `organization/knowledge/patterns/ai-three-layer-guard.md`（PATTERN-004）
- OpenAI Pricing: https://openai.com/api/pricing/
- OpenAI Models: https://platform.openai.com/docs/models
- OpenAI Prompt Caching: https://platform.openai.com/docs/guides/prompt-caching
- OpenAI Batch API: https://platform.openai.com/docs/guides/batch
- OpenAI Rate Limits: https://platform.openai.com/docs/guides/rate-limits
- Sentry Metrics: https://docs.sentry.io/product/metrics/
