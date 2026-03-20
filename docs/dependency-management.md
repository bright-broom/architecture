# 依存関係管理ガイドライン

## 概要

本ドキュメントは、npm依存関係の管理、更新、セキュリティに関するガイドラインを定義する。
安定性とセキュリティを維持しながら、依存パッケージを適切に管理する。

## 依存関係の分類

### dependencies vs devDependencies

```json
{
  "dependencies": {
    // 本番環境で必要
    "react": "^19.0.0",
    "react-router": "^7.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    // 開発・ビルド時のみ必要
    "typescript": "^5.7.0",
    "vitest": "^2.1.0",
    "eslint": "^9.0.0"
  },
  "peerDependencies": {
    // ホストパッケージに依存
    "react": "^18.0.0 || ^19.0.0"
  }
}
```

### モノレポでの依存管理

```json
// ルート package.json
{
  "workspaces": ["apps/*", "packages/*"],
  "devDependencies": {
    // 共通の開発ツールはルートに
    "typescript": "^5.7.0",
    "eslint": "^9.0.0",
    "prettier": "^3.4.0"
  }
}

// packages/domains/package.json
{
  "dependencies": {
    // パッケージ固有の依存
    "zod": "^3.23.0",
    // ワークスペース内のパッケージ参照
    "@project/utils": "*"
  }
}
```

## バージョン指定

### セマンティックバージョニング

```json
{
  "dependencies": {
    // 完全一致（非推奨：柔軟性がない）
    "exact-package": "1.0.0",

    // パッチ更新を許可（推奨）
    "patch-package": "~1.0.0",  // 1.0.x

    // マイナー更新を許可（一般的）
    "minor-package": "^1.0.0",  // 1.x.x

    // 最新（非推奨：予期しない破壊的変更）
    "latest-package": "*"
  }
}
```

### 推奨バージョン戦略

| パッケージ種別 | 戦略 | 理由 |
|---------------|------|------|
| フレームワーク | `^` | 破壊的変更は手動で対応 |
| ユーティリティ | `^` | パッチ・マイナー更新は安全 |
| 型定義 | `^` | TypeScriptバージョンに追従 |
| セキュリティ関連 | 最新を保つ | 脆弱性対策 |

## 依存関係の追加

### 追加前のチェック

```bash
# 1. パッケージの評価
# - ダウンロード数
# - メンテナンス状況（最終更新日）
# - 依存パッケージ数
# - ライセンス

# npm で確認
npm info <package-name>

# bundlephobia でサイズ確認
# https://bundlephobia.com/package/<package-name>
```

### 追加コマンド

```bash
# アプリケーションに追加
npm install react-hook-form -w @project/web

# パッケージに追加
npm install date-fns -w @project/utils

# 開発依存として追加（ルート）
npm install -D vitest

# バージョン指定で追加
npm install zod@^3.23.0
```

### 追加チェックリスト

- [ ] 本当に必要か（自作で代替可能か）
- [ ] メンテナンスされているか
- [ ] ライセンスは適切か
- [ ] バンドルサイズは許容範囲か
- [ ] TypeScript対応か
- [ ] 既存の依存と重複していないか

## 依存関係の更新

### 定期更新

```bash
# 更新可能なパッケージを確認
npm outdated

# 例: 出力
Package         Current  Wanted  Latest
react           18.2.0   18.3.1  19.0.0
typescript      5.5.0    5.7.2   5.7.2
zod             3.22.0   3.23.8  3.23.8
```

### 更新手順

```bash
# 1. パッチ・マイナー更新（低リスク）
npm update

# 2. メジャー更新（高リスク）
# 変更履歴を確認してから手動更新
npm install react@^19.0.0

# 3. 全依存を最新に（注意）
npx npm-check-updates -u
npm install
```

### 更新後の検証

```bash
# 1. 型チェック
npm run typecheck

# 2. リント
npm run lint

# 3. テスト
npm run test

# 4. ビルド
npm run build

# 5. 動作確認
npm run dev
```

## Dependabot

### 設定ファイル

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "Asia/Tokyo"
    open-pull-requests-limit: 10
    groups:
      # プロダクション依存をグループ化
      production-dependencies:
        dependency-type: "production"
        update-types:
          - "minor"
          - "patch"
      # 開発依存をグループ化
      development-dependencies:
        dependency-type: "development"
        update-types:
          - "minor"
          - "patch"
    ignore:
      # メジャー更新は手動で
      - dependency-name: "*"
        update-types: ["version-update:semver-major"]
    labels:
      - "dependencies"
      - "automated"
    commit-message:
      prefix: "chore(deps)"
```

### Dependabot PRの処理

```bash
# 1. CIが通っていることを確認
# 2. 変更内容を確認
# 3. 軽微な更新はマージ
# 4. 重要な更新は動作確認後マージ
```

## セキュリティ

### 脆弱性チェック

```bash
# npm audit で脆弱性チェック
npm audit

# 出力例
found 2 vulnerabilities (1 moderate, 1 high)
  run `npm audit fix` to fix them

# 自動修正（パッチ・マイナー更新の範囲）
npm audit fix

# 強制修正（破壊的変更の可能性）
npm audit fix --force
```

### CI/CDでの自動チェック

```yaml
# .github/workflows/security.yml
name: Security

on:
  schedule:
    - cron: '0 0 * * *'  # 毎日実行
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm audit --audit-level=high
```

### 脆弱性対応フロー

```
1. npm audit で脆弱性検出
      ↓
2. 影響範囲の確認
   - 本番で使用されているか
   - 攻撃可能なパスが存在するか
      ↓
3. 対応方法の決定
   - パッチ更新が利用可能 → npm audit fix
   - メジャー更新が必要 → 手動更新
   - 修正なし → 代替パッケージ or 自作
      ↓
4. テスト・デプロイ
```

## ライセンス管理

### ライセンスチェック

```bash
# license-checker でライセンス一覧を取得
npx license-checker --summary

# 出力例
MIT: 150
ISC: 30
Apache-2.0: 20
BSD-3-Clause: 10
```

### 許可されるライセンス

| ライセンス | 商用利用 | 備考 |
|-----------|---------|------|
| MIT | OK | 最も緩い |
| ISC | OK | MITとほぼ同等 |
| Apache-2.0 | OK | 特許条項あり |
| BSD-3-Clause | OK | 宣伝条項なし |
| BSD-2-Clause | OK | より緩いBSD |

### 注意が必要なライセンス

| ライセンス | 注意点 |
|-----------|--------|
| GPL | 派生物もGPLになる |
| LGPL | ライブラリとしての使用は可 |
| AGPL | ネットワークサービスにも適用 |

## パッケージロックファイル

### package-lock.json

```bash
# ロックファイルの役割
# - 依存バージョンを固定
# - 再現可能なインストール
# - CIでの一貫性確保

# CIでは npm ci を使用（ロックファイルに従う）
npm ci

# 開発では npm install を使用
npm install
```

### ロックファイルの更新

```bash
# ロックファイルを再生成
rm -rf node_modules package-lock.json
npm install

# 特定パッケージのみ更新
npm update <package-name>
```

## トラブルシューティング

### よくある問題

```bash
# 依存関係の競合
npm ls <package-name>

# キャッシュクリア
npm cache clean --force

# node_modules 再構築
rm -rf node_modules
npm install

# 重複パッケージの削除
npm dedupe

# 不要パッケージの削除
npm prune
```

### peer dependency 警告

```bash
# 警告例
npm WARN ERESOLVE overriding peer dependency
npm WARN While resolving: @project/web@1.0.0
npm WARN Found: react@19.0.0
npm WARN peer react@"^18.0.0" from some-package@1.0.0

# 対処
# 1. パッケージを更新してpeer depを解決
# 2. --legacy-peer-deps で無視（非推奨）
```

## チェックリスト

### パッケージ追加時

- [ ] 必要性を検討
- [ ] メンテナンス状況を確認
- [ ] ライセンスを確認
- [ ] サイズを確認
- [ ] TypeScript対応を確認

### 定期メンテナンス

- [ ] 週次: npm audit
- [ ] 月次: npm outdated
- [ ] 四半期: メジャー更新の検討
- [ ] Dependabot PRの処理

## 関連ドキュメント

- [ビルドシステム](./build-system.md)
- [セキュリティ](./security.md)
- [デプロイメント](./deployment.md)
