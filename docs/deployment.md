# デプロイメントガイドライン

## 概要

本ドキュメントは、アプリケーションのビルド、デプロイ、運用に関するガイドラインを定義する。
継続的デリバリー（CD）のベストプラクティスに基づく。

## デプロイメントフロー

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    開発     │    │    CI/CD    │    │  ステージング │    │    本番     │
│   ブランチ  │ →  │   パイプライン│ →  │    環境     │ →  │    環境     │
│  (feature)  │    │  (GitHub    │    │  (staging)  │    │ (production)│
│             │    │   Actions)  │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                  │                  │                  │
      │                  │                  │                  │
    PR作成          自動テスト          手動確認            自動/手動
                   リンター            動作確認            デプロイ
                   型チェック          パフォーマンス
                                      セキュリティ
```

## ビルドプロセス

### 本番ビルド

```typescript
// scripts/build.mts
import { execSync } from "child_process";
import concurrently from "concurrently";

// 1. 型チェック
console.log("Running type check...");
execSync("npm run typecheck", { stdio: "inherit" });

// 2. パッケージのビルド（依存順）
console.log("Building packages...");
await buildPackagesInOrder();

// 3. アプリケーションのビルド
console.log("Building application...");
execSync("npm run build -w @project/web", { stdio: "inherit" });

// 4. ビルド成果物の検証
console.log("Verifying build output...");
verifyBuildOutput();

console.log("Build completed successfully!");
```

### Dockerfile

```dockerfile
# Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# 依存関係のインストール
COPY package*.json ./
COPY packages/*/package.json ./packages/
COPY apps/*/package.json ./apps/
RUN npm ci

# ソースコードのコピーとビルド
COPY . .
RUN npm run build

# 本番イメージ
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# 必要なファイルのみコピー
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/*/dist ./packages/
COPY --from=builder /app/apps/web/build ./apps/web/build

EXPOSE 3000

CMD ["node", "apps/web/build/server/index.js"]
```

## CI/CDパイプライン

### GitHub Actions（完全版）

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    types: [opened, synchronize, ready_for_review]

env:
  NODE_VERSION: "22"

jobs:
  # ===============================
  # CI: テスト・検証
  # ===============================
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    if: ${{ github.event_name != 'pull_request' || !github.event.pull_request.draft }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npm run format

      - name: Unit tests
        run: npm run test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  # ===============================
  # Security: 脆弱性チェック
  # ===============================
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Audit dependencies
        run: npm audit --audit-level=high

  # ===============================
  # Build: ビルド検証
  # ===============================
  build:
    runs-on: ubuntu-latest
    needs: [ci, security]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: |
            apps/web/build
            packages/*/dist

  # ===============================
  # Deploy: ステージング
  # ===============================
  deploy-staging:
    runs-on: ubuntu-latest
    needs: [build]
    if: github.ref == 'refs/heads/develop'
    environment: staging

    steps:
      - uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build

      - name: Deploy to staging
        env:
          DEPLOY_TOKEN: ${{ secrets.STAGING_DEPLOY_TOKEN }}
        run: |
          # デプロイコマンド（プラットフォームに応じて変更）
          echo "Deploying to staging..."

  # ===============================
  # Deploy: 本番
  # ===============================
  deploy-production:
    runs-on: ubuntu-latest
    needs: [build]
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build

      - name: Deploy to production
        env:
          DEPLOY_TOKEN: ${{ secrets.PRODUCTION_DEPLOY_TOKEN }}
        run: |
          echo "Deploying to production..."

      - name: Notify deployment
        if: success()
        run: |
          # Slack等への通知
          echo "Deployment successful!"
```

## 環境構成

### ステージング環境

```yaml
# 本番に近い環境で検証
- URL: https://staging.example.com
- 目的: 機能テスト、統合テスト、パフォーマンステスト
- データ: 本番データの匿名化コピー or テストデータ
- アクセス: 開発チームのみ
```

### 本番環境

```yaml
# 実際のユーザーが使用する環境
- URL: https://example.com
- 目的: サービス提供
- データ: 実データ
- アクセス: 全ユーザー
```

## デプロイ戦略

### ブルーグリーンデプロイ

```
        ┌─────────────────────────────────────────┐
        │           Load Balancer                 │
        └─────────────────┬───────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
    ┌─────▼─────┐                   ┌─────▼─────┐
    │   Blue    │                   │   Green   │
    │  (現行)   │                   │  (新版)   │
    │  v1.0.0   │                   │  v1.1.0   │
    └───────────┘                   └───────────┘
          │                               │
          │    1. Green環境にデプロイ      │
          │    2. 動作確認                │
          │    3. トラフィックを切り替え   │
          │    4. Blue環境を待機          │
```

### ローリングデプロイ

```
Instance 1: [v1] → [v2] ─────────────────────►
Instance 2: [v1] ──────► [v2] ───────────────►
Instance 3: [v1] ─────────────► [v2] ────────►
            ────────────────────────────────►
                        Time
```

## ロールバック

### 即座のロールバック

```bash
# 前のバージョンに戻す
# プラットフォームに応じたコマンド

# Cloud Run
gcloud run services update-traffic SERVICE \
  --to-revisions=PREVIOUS_REVISION=100

# Kubernetes
kubectl rollout undo deployment/web

# Vercel
vercel rollback
```

### ロールバック判断基準

| 指標                 | 閾値    | アクション          |
| -------------------- | ------- | ------------------- |
| エラー率             | > 5%    | 自動ロールバック    |
| レスポンスタイム p95 | > 2秒   | アラート + 手動判断 |
| ヘルスチェック失敗   | 3回連続 | 自動ロールバック    |

## モニタリング

### デプロイ後のチェック

```typescript
// デプロイ後の自動チェック
async function postDeploymentChecks() {
  const checks = [
    checkHealthEndpoint(),
    checkCriticalPaths(),
    checkErrorRates(),
    checkLatency(),
  ];

  const results = await Promise.all(checks);
  const allPassed = results.every((r) => r.passed);

  if (!allPassed) {
    console.error("Post-deployment checks failed:", results);
    await triggerRollback();
  }
}

async function checkHealthEndpoint() {
  const response = await fetch("https://example.com/health");
  return {
    name: "health",
    passed: response.ok,
    details: await response.json(),
  };
}

async function checkCriticalPaths() {
  const paths = ["/", "/login", "/dashboard"];
  const results = await Promise.all(
    paths.map(async (path) => {
      const response = await fetch(`https://example.com${path}`);
      return { path, status: response.status };
    }),
  );

  return {
    name: "critical-paths",
    passed: results.every((r) => r.status === 200),
    details: results,
  };
}
```

## チェックリスト

### デプロイ前

- [ ] すべてのテストがパス
- [ ] コードレビュー完了
- [ ] 環境変数の設定確認
- [ ] データベースマイグレーション（必要な場合）
- [ ] 依存サービスの準備

### デプロイ中

- [ ] ビルド成功
- [ ] デプロイ進行中の監視
- [ ] ヘルスチェック確認

### デプロイ後

- [ ] ヘルスチェックエンドポイント確認
- [ ] 主要機能の動作確認
- [ ] エラー率の監視
- [ ] パフォーマンス指標の確認
- [ ] ロールバック準備

## 関連ドキュメント

- [ビルドシステム](./build-system.md)
- [環境設定](./environment-configuration.md)
- [ロギング・オブザーバビリティ](./logging-observability.md)
