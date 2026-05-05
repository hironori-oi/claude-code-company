# playbooks/ — 横断的な手順書

## 定義

**「やり方」を再現するためのステップ集**。同じ手順を **2 回以上踏んだら** ここに切り出す。

実装パターン（=設計判断）は `patterns/` へ。手順だけのものはこちら。

## 粒度

- 1 手順 = 1 ファイル（Step 形式、各ステップに検証コマンド付）
- サイズ: **1,000〜8,000字**
- 「ある作業を最短で再現する」ための実用ドキュメント。背景・思想は薄く、手順を厚く

## 命名規則

```
{動詞}-{対象}-{文脈}.md
```

例:
- `setup-supabase-rls.md`
- `vercel-github-auto-deploy.md`
- `tauri-v2-windows-installer.md`
- `enable-dependabot.md`

すべて kebab-case、英小文字。

## YAML フロントマター必須項目

```yaml
---
type: playbook
title: "Supabase RLS 初期設計の標準手順"
domain_tags: [saas, multi-tenant]
tech_tags: [supabase, postgresql, rls]
status: active
created_date: YYYY-MM-DD
updated_date: YYYY-MM-DD
review_due: YYYY-MM-DD
related_projects: [PRJ-002, PRJ-003, PRJ-005]
quality_score: 0
author: dev | research
references: []         # 関連 ADR / Pattern
---
```

## セクション構成（推奨）

1. 目的 / 期待結果
2. 前提（OS / バージョン / 必要権限）
3. 手順（Step 1, 2, 3...）
4. 検証コマンド（各 Step 末）
5. トラブルシュート
6. 関連案件・ナレッジ

## 関連

- テンプレ: `organization/templates/`（playbook-template.md は将来追加）
- 索引: `organization/knowledge/INDEX.md`
