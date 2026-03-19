---
name: new-project
description: "Register a new client project - assigns ID, creates project directory structure, updates dashboard"
metadata:
  priority: 9
---

# 新規案件登録

新しいクライアント案件を秘書部門として受付・登録し、初期セットアップを行います。

## 実行手順

### 1. 案件ID採番
- Plugin Root 配下の `dashboard/active-projects.md` を確認し、最新の案件IDを取得
- 次の連番で `PRJ-XXX` 形式のIDを採番

### 2. プロジェクトディレクトリ作成
Plugin Root 配下に以下の構造で作成:
```
projects/{案件ID}/
├── brief.md          # 案件概要
├── progress.md       # 進捗管理
├── decisions.md      # 意思決定ログ
└── reports/          # 各部署レポート
```

### 3. 案件概要（brief.md）作成
`organization/templates/project-brief.md` をテンプレートとして使用し、
提供された情報をもとに brief.md を作成する。
不明な項目は「未確認 - ヒアリング必要」と記載する。

### 4. ダッシュボード更新
- `dashboard/active-projects.md` に新規案件を追加（Phase: 受付）
- `dashboard/pipeline.md` にパイプライン情報を追加
- 次の案件ID番号を更新

### 5. 報告
```
## 新規案件登録完了

### 案件ID: {PRJ-XXX}
### 案件名: {案件名}
### クライアント: {クライアント名}
### Phase: 受付

### 作成ファイル
- projects/{案件ID}/brief.md
- projects/{案件ID}/progress.md
- projects/{案件ID}/decisions.md

### ヒアリングが必要な項目
- {不明な項目のリスト}

### 推奨される次のアクション
1. 不明項目のクライアントヒアリング
2. /company:research でリサーチ部門に技術調査依頼
3. /company:marketing でマーケティング部門に市場調査依頼
```
