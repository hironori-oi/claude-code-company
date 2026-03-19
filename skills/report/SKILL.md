---
name: report
description: "Generate management reports - weekly, monthly, project-specific, or KPI summary"
metadata:
  priority: 5
---

# 経営レポート

組織全体の経営レポートを生成します。

## 対応するレポート種類
- `weekly` / `週次` : 週次経営レポート
- `monthly` / `月次` : 月次経営レポート
- `project` / `案件` : 案件別詳細レポート
- `KPI` : KPIサマリー

## 実行手順

### データ収集
Plugin Root 配下の以下からデータを取得:
- `dashboard/active-projects.md` から案件データ
- `dashboard/pipeline.md` からパイプラインデータ
- `dashboard/kpi.md` からKPIデータ
- 各 `projects/{案件ID}/progress.md` から進捗データ

### 週次レポート
```
## 週次経営レポート（YYYY-MM-DD）

### 1. エグゼクティブサマリー
{今週の全体状況を3行で}

### 2. 案件別進捗
| 案件ID | 案件名 | Phase | 今週の進捗 | 来週の予定 | リスク |
|--------|--------|-------|-----------|-----------|--------|

### 3. 新規案件・パイプライン
### 4. 完了・納品
### 5. リスク・課題
### 6. リソース状況
### 7. KPIサマリー
### 8. 来週のフォーカス
```

### 月次レポート
```
## 月次経営レポート（YYYY年MM月）

### 1. 月次サマリー
### 2. 案件実績（受注/完了/稼働中/パイプライン）
### 3. 案件別詳細
### 4. KPI達成状況
### 5. ナレッジ・学び
### 6. 来月の計画
### 7. 改善提案
```
