# セキュリティガイドライン

## 概要

本ドキュメントは、OWASP Top 10やGoogle/Microsoftのセキュリティベストプラクティスに基づき、
アプリケーションのセキュリティを確保するためのガイドラインを定義する。

## セキュリティ原則

### 1. 最小権限の原則（Principle of Least Privilege）

必要最小限の権限のみを付与する。

```typescript
// ロールベースアクセス制御の例
type Permission = "read" | "write" | "delete" | "admin";

const rolePermissions: Record<UserRole, Permission[]> = {
  admin: ["read", "write", "delete", "admin"],
  editor: ["read", "write"],
  viewer: ["read"],
};

function hasPermission(user: User, permission: Permission): boolean {
  return rolePermissions[user.role].includes(permission);
}
```

### 2. 多層防御（Defense in Depth）

単一の対策に依存せず、複数のセキュリティレイヤーを設ける。

### 3. セキュリティバイデザイン（Security by Design）

開発の初期段階からセキュリティを考慮する。

## 入力バリデーション

### Zodによるランタイム検証

すべての外部入力（ユーザー入力、API、DB）をZodで検証する。

```typescript
// スキーマ定義
const createUserSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().min(1).max(100),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[^A-Za-z0-9]/, "Must contain special character"),
});

// loader/actionでの使用
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const rawData = Object.fromEntries(formData);

  // バリデーション
  const result = createUserSchema.safeParse(rawData);
  if (!result.success) {
    return json(
      { errors: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // 検証済みデータを使用
  const user = await createUser(result.data);
  return redirect(`/users/${user.id}`);
}
```

### 危険な文字のサニタイズ

```typescript
import DOMPurify from 'dompurify'

// HTMLをレンダリングする場合は必ずサニタイズ
function SafeHtml({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href'],
  })
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />
}

// SQLインジェクション対策（パラメータ化クエリを使用）
// Bad
const query = `SELECT * FROM users WHERE email = '${email}'`

// Good（Firestoreの場合は自動的にパラメータ化）
const docs = await dataSource.getAll('users', {
  where: [{ field: 'email', operator: '==', value: email }],
})
```

## 認証（Authentication）

### セッション管理

```typescript
// セッション設定の推奨値
const sessionConfig = {
  name: "__session",
  httpOnly: true, // JavaScriptからアクセス不可
  secure: true, // HTTPS必須
  sameSite: "lax", // CSRF対策
  maxAge: 60 * 60 * 24 * 7, // 7日間
  path: "/",
};

// セッションの検証
async function requireAuth(request: Request): Promise<User> {
  const session = await getSession(request);
  const userId = session.get("userId");

  if (!userId) {
    throw redirect("/login");
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    throw redirect("/login");
  }

  // セッションハイジャック対策: IPアドレスやUser-Agentの検証（オプション）
  const currentFingerprint = generateFingerprint(request);
  if (session.get("fingerprint") !== currentFingerprint) {
    await destroySession(session);
    throw redirect("/login");
  }

  return user;
}
```

### パスワードセキュリティ

```typescript
import { hash, verify } from "@node-rs/argon2";

// パスワードハッシュ化（Argon2id推奨）
async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    memoryCost: 65536, // 64 MiB
    timeCost: 3, // 3 iterations
    parallelism: 4, // 4 parallel threads
  });
}

// パスワード検証
async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return verify(hashedPassword, password);
}

// パスワード強度ポリシー
const passwordPolicy = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .refine(
    (password) => /[A-Z]/.test(password),
    "Password must contain at least one uppercase letter",
  )
  .refine(
    (password) => /[a-z]/.test(password),
    "Password must contain at least one lowercase letter",
  )
  .refine(
    (password) => /[0-9]/.test(password),
    "Password must contain at least one number",
  )
  .refine(
    (password) => /[^A-Za-z0-9]/.test(password),
    "Password must contain at least one special character",
  );
```

### JWT（使用する場合）

```typescript
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const issuer = "my-project";
const audience = "my-project-app";

// トークン生成
async function generateToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime("1h") // 短い有効期限
    .sign(secret);
}

// トークン検証
async function verifyToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret, {
    issuer,
    audience,
  });

  if (!payload.sub) {
    throw new AuthenticationError("Invalid token");
  }

  return payload.sub;
}

// リフレッシュトークンパターン
// - アクセストークン: 短い有効期限（15分〜1時間）
// - リフレッシュトークン: 長い有効期限（7日〜30日）、DBに保存
```

## 認可（Authorization）

### ロールベースアクセス制御（RBAC）

```typescript
// ミドルウェアでの認可チェック
async function requireRole(
  request: Request,
  ...roles: UserRole[]
): Promise<User> {
  const user = await requireAuth(request);

  if (!roles.includes(user.role)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return user;
}

// loader での使用例
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireRole(request, "admin", "editor");
  // ...
}
```

### 属性ベースアクセス制御（ABAC）

```typescript
// より細かいアクセス制御
interface AccessContext {
  user: User;
  resource: Resource;
  action: "read" | "write" | "delete";
}

function canAccess(context: AccessContext): boolean {
  const { user, resource, action } = context;

  // 管理者は全操作可能
  if (user.role === "admin") return true;

  // リソース所有者のチェック
  if (resource.ownerId === user.id) {
    return ["read", "write", "delete"].includes(action);
  }

  // チームメンバーの読み取り権限
  if (resource.teamId && user.teamIds.includes(resource.teamId)) {
    return action === "read";
  }

  return false;
}

// リソースアクセス時のチェック
async function getResource(id: string, user: User): Promise<Resource> {
  const resource = await resourceRepository.findById(id);

  if (!resource) {
    throw new NotFoundError("Resource", id);
  }

  if (!canAccess({ user, resource, action: "read" })) {
    throw new Response("Forbidden", { status: 403 });
  }

  return resource;
}
```

## XSS対策

### React での自動エスケープ

```typescript
// ReactはデフォルトでXSS対策済み
// Bad: dangerouslySetInnerHTML の不適切な使用
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// Good: 通常のJSXを使用
<div>{userContent}</div>

// どうしてもHTMLを挿入する必要がある場合
import DOMPurify from 'dompurify'

function SafeContent({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html)
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />
}
```

### Content Security Policy (CSP)

```typescript
// root.tsx または middleware
export function headers() {
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // インラインスクリプト（必要な場合のみ）
      "style-src 'self' 'unsafe-inline'", // Tailwind CSS用
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.example.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  };
}
```

## CSRF対策

### SameSite Cookie

```typescript
// セッションCookieにSameSite属性を設定
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const, // 通常のリクエストでCookie送信を許可
};
```

### CSRFトークン（必要な場合）

```typescript
import { createCookie } from 'react-router'
import { randomBytes } from 'crypto'

// CSRFトークン生成
function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
}

// フォームでのトークン埋め込み
function Form({ action }: FormProps) {
  const csrfToken = useLoaderData<{ csrfToken: string }>().csrfToken

  return (
    <form action={action} method="post">
      <input type="hidden" name="_csrf" value={csrfToken} />
      {/* フォームフィールド */}
    </form>
  )
}

// actionでの検証
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const csrfToken = formData.get('_csrf')
  const session = await getSession(request)

  if (csrfToken !== session.get('csrfToken')) {
    throw new Response('Invalid CSRF token', { status: 403 })
  }

  // 処理を続行
}
```

## セキュリティヘッダー

```typescript
// middleware.ts または root.tsx
export function headers() {
  return {
    // XSS保護
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",

    // HTTPS強制
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",

    // リファラー制御
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // 機能ポリシー
    "Permissions-Policy": ["camera=()", "microphone=()", "geolocation=()"].join(
      ", ",
    ),
  };
}
```

## 機密情報の取り扱い

### 環境変数

```typescript
// .env は .gitignore に含める
// Bad: ハードコーディング
const apiKey = "sk-1234567890abcdef";

// Good: 環境変数から取得
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY environment variable is required");
}

// 型安全な環境変数（Zodで検証）
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  API_KEY: z.string(),
  NODE_ENV: z.enum(["development", "production", "test"]),
});

export const env = envSchema.parse(process.env);
```

### ログにおける機密情報

```typescript
// Bad: 機密情報をログに出力
console.log("User login:", { email, password });

// Good: 機密情報をマスク
console.log("User login:", { email, password: "***" });

// ログユーティリティでの自動マスク
const sensitiveFields = ["password", "token", "apiKey", "secret"];

function sanitizeForLogging(obj: object): object {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if (
        sensitiveFields.some((field) =>
          key.toLowerCase().includes(field.toLowerCase()),
        )
      ) {
        return [key, "***REDACTED***"];
      }
      if (typeof value === "object" && value !== null) {
        return [key, sanitizeForLogging(value)];
      }
      return [key, value];
    }),
  );
}
```

## 依存関係のセキュリティ

### 定期的な脆弱性チェック

```bash
# npm audit で脆弱性チェック
npm audit

# 自動修正
npm audit fix

# CIでの実行（ciワークフローに追加）
npm audit --audit-level=high
```

### Dependabot設定

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    groups:
      production-dependencies:
        dependency-type: "production"
      development-dependencies:
        dependency-type: "development"
```

## セキュリティチェックリスト

### 開発時

- [ ] すべての入力をZodでバリデーション
- [ ] SQLインジェクション対策（パラメータ化クエリ）
- [ ] XSS対策（dangerouslySetInnerHTMLを避ける）
- [ ] CSRF対策（SameSite Cookie、CSRFトークン）
- [ ] 認証・認可の実装
- [ ] 機密情報の環境変数化
- [ ] セキュリティヘッダーの設定

### コードレビュー時

- [ ] ハードコードされた機密情報がないか
- [ ] ユーザー入力を信頼していないか
- [ ] 適切なエラーハンドリング（情報漏洩防止）
- [ ] 認可チェックが適切か
- [ ] ログに機密情報が含まれていないか

### デプロイ前

- [ ] npm audit での脆弱性チェック
- [ ] 本番環境の環境変数設定
- [ ] HTTPS設定
- [ ] CSP、HSTS等のセキュリティヘッダー

## インシデント対応

### セキュリティインシデント発生時

1. **検知**: 異常なアクセスパターン、エラー率の上昇
2. **封じ込め**: 影響範囲の特定、必要に応じてサービス停止
3. **調査**: ログ分析、原因特定
4. **復旧**: 脆弱性の修正、パッチ適用
5. **事後対応**: 報告書作成、再発防止策

```typescript
// セキュリティログの出力例
logger.security({
  event: "suspicious_activity",
  userId: user.id,
  ipAddress: request.headers.get("x-forwarded-for"),
  userAgent: request.headers.get("user-agent"),
  details: "Multiple failed login attempts",
  timestamp: new Date().toISOString(),
});
```

## 関連ドキュメント

- [アーキテクチャ](./architecture.md)
- [エラーハンドリング](./error-handling.md)
- [ロギング・オブザーバビリティ](./logging-observability.md)
- [環境設定](./environment-configuration.md)
