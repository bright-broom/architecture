# 環境設定ガイドライン

## 概要

本ドキュメントは、環境変数の管理とアプリケーション設定のガイドラインを定義する。
セキュリティと運用効率を考慮した設定管理を実現する。

## 環境変数の管理

### ディレクトリ構成

```
project/
├── .env.example          # サンプル（バージョン管理対象）
├── .env                  # ローカル開発用（バージョン管理対象外）
├── .env.development      # 開発環境固有
├── .env.test             # テスト環境固有
├── .env.production       # 本番環境固有（ローカル参照用）
└── .gitignore            # .env* を除外（.env.exampleは除く）
```

### .gitignore設定

```gitignore
# .gitignore
.env
.env.local
.env.development
.env.test
.env.production

# サンプルはバージョン管理
!.env.example
```

### .env.example

```bash
# .env.example
# このファイルをコピーして .env を作成してください
# cp .env.example .env

# ===================
# アプリケーション
# ===================
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# ===================
# データベース
# ===================
DATABASE_URL=

# ===================
# 認証
# ===================
SESSION_SECRET=
JWT_SECRET=

# ===================
# 外部サービス
# ===================
# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Stripe（オプション）
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# メール（オプション）
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

# ===================
# 監視・ログ
# ===================
SENTRY_DSN=
LOG_LEVEL=debug
```

## 型安全な環境変数

### Zodによる検証

```typescript
// packages/config/src/env.ts
import { z } from "zod";

const envSchema = z.object({
  // Node環境
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // アプリケーション
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url(),

  // データベース
  DATABASE_URL: z.string().url(),

  // 認証
  SESSION_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32).optional(),

  // Firebase
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().transform((key) =>
    // Render等での改行エスケープ対応
    key.replace(/\\n/g, "\n"),
  ),

  // 監視（オプション）
  SENTRY_DSN: z.string().url().optional(),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
```

### アプリケーションでの使用

```typescript
// apps/web/app/utils/config.server.ts
import { env } from "@project/config";

// サーバーサイドでのみ使用
export const config = {
  app: {
    url: env.APP_URL,
    port: env.PORT,
    isDevelopment: env.NODE_ENV === "development",
    isProduction: env.NODE_ENV === "production",
  },
  database: {
    url: env.DATABASE_URL,
  },
  auth: {
    sessionSecret: env.SESSION_SECRET,
    jwtSecret: env.JWT_SECRET,
  },
  firebase: {
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY,
  },
};

export type Config = typeof config;
```

## クライアントサイドの設定

### 公開可能な設定のみ

```typescript
// apps/web/app/utils/config.client.ts

// VITE_ プレフィックスの変数のみクライアントに公開
const clientEnvSchema = z.object({
  VITE_APP_NAME: z.string().default("My App"),
  VITE_API_URL: z.string().url(),
  VITE_GA_TRACKING_ID: z.string().optional(),
  VITE_SENTRY_DSN: z.string().optional(),
});

export const clientConfig = clientEnvSchema.parse({
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_GA_TRACKING_ID: import.meta.env.VITE_GA_TRACKING_ID,
  VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
});
```

### loaderからクライアントへ設定を渡す

```typescript
// apps/web/app/root.tsx

export async function loader() {
  // サーバーサイドで安全な情報のみ選別
  return json({
    ENV: {
      APP_NAME: env.APP_NAME,
      SENTRY_DSN: env.SENTRY_DSN,
      // DATABASE_URL等は含めない
    },
  })
}

export default function App() {
  const { ENV } = useLoaderData<typeof loader>()

  return (
    <html>
      <head>...</head>
      <body>
        <Outlet />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(ENV)}`,
          }}
        />
        <Scripts />
      </body>
    </html>
  )
}
```

## 環境別設定

### 開発環境

```bash
# .env.development
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://localhost:5432/myapp_dev
LOG_LEVEL=debug
```

### テスト環境

```bash
# .env.test
NODE_ENV=test
DATABASE_URL=postgresql://localhost:5432/myapp_test
LOG_LEVEL=error
```

### 本番環境（参照用）

```bash
# .env.production（実際の値はCI/CDで設定）
NODE_ENV=production
PORT=8080
APP_URL=https://myapp.com
DATABASE_URL=  # CI/CDで設定
LOG_LEVEL=info
```

## CI/CDでの環境変数設定

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        env:
          NODE_ENV: production
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
          FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
          FIREBASE_CLIENT_EMAIL: ${{ secrets.FIREBASE_CLIENT_EMAIL }}
          FIREBASE_PRIVATE_KEY: ${{ secrets.FIREBASE_PRIVATE_KEY }}
        run: |
          npm run build
          npm run deploy
```

### GitHub Secrets設定

```
Repository Settings > Secrets and variables > Actions > Repository secrets

DATABASE_URL
SESSION_SECRET
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
SENTRY_DSN
```

## シークレット管理

### 推奨プラクティス

1. **本番シークレットはコードに含めない**
2. **シークレットマネージャーを使用**（AWS Secrets Manager, Google Secret Manager等）
3. **ローテーション可能な設計**
4. **アクセスログの記録**

### シークレットマネージャー例

```typescript
// Google Secret Managerを使用する場合
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const client = new SecretManagerServiceClient();

async function getSecret(name: string): Promise<string> {
  const [version] = await client.accessSecretVersion({
    name: `projects/${projectId}/secrets/${name}/versions/latest`,
  });

  const payload = version.payload?.data?.toString();
  if (!payload) {
    throw new Error(`Secret ${name} not found`);
  }

  return payload;
}

// 起動時にシークレットを取得
export async function loadSecrets() {
  return {
    databaseUrl: await getSecret("database-url"),
    sessionSecret: await getSecret("session-secret"),
  };
}
```

## 設定のバリデーション

### 起動時チェック

```typescript
// apps/web/app/entry.server.tsx

import { env } from "@project/config";

// 起動時に必須設定をチェック
function validateRequiredConfig() {
  const required = ["DATABASE_URL", "SESSION_SECRET", "FIREBASE_PROJECT_ID"];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
    process.exit(1);
  }
}

validateRequiredConfig();
```

### ヘルスチェックでの検証

```typescript
// apps/web/app/routes/health.tsx

export async function loader() {
  const checks = {
    database: await checkDatabaseConnection(),
    firebase: await checkFirebaseConnection(),
    // 外部サービスの接続チェック
  };

  const allHealthy = Object.values(checks).every((c) => c.status === "pass");

  return json(
    { status: allHealthy ? "healthy" : "unhealthy", checks },
    { status: allHealthy ? 200 : 503 },
  );
}
```

## チェックリスト

### 開発時

- [ ] .env.exampleを最新に保つ
- [ ] 機密情報は.envにのみ記載
- [ ] 環境変数はZodで型検証

### デプロイ時

- [ ] 本番シークレットはCI/CDで設定
- [ ] 環境変数が正しく設定されているか確認
- [ ] ヘルスチェックで設定を検証

### セキュリティ

- [ ] .envファイルがバージョン管理外か確認
- [ ] クライアントに機密情報を公開していないか
- [ ] シークレットのローテーション計画

## 関連ドキュメント

- [セキュリティ](./security.md)
- [デプロイメント](./deployment.md)
- [ロギング・オブザーバビリティ](./logging-observability.md)
