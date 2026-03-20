# API設計ガイドライン

## 概要

本ドキュメントは、一貫性のある、使いやすいAPIを設計するためのガイドラインを定義する。
RESTful原則とReact Router v7のloader/actionパターンに基づく。

## 設計原則

### 1. リソース指向

URLはリソース（名詞）を表し、HTTPメソッドで操作を表現する。

```
GET    /users           # ユーザー一覧取得
GET    /users/:id       # 特定ユーザー取得
POST   /users           # ユーザー作成
PUT    /users/:id       # ユーザー更新（全体）
PATCH  /users/:id       # ユーザー更新（部分）
DELETE /users/:id       # ユーザー削除
```

### 2. 一貫性

同じパターンをプロジェクト全体で適用する。

### 3. 予測可能性

開発者が直感的に理解できるAPI設計。

## URL設計

### 基本ルール

```
# 複数形を使用
/users (Good)
/user (Bad)

# ネストは2階層まで
/users/:userId/orders (Good)
/users/:userId/orders/:orderId/items/:itemId (Bad - 深すぎる)

# クエリパラメータでフィルタリング
/users?role=admin&status=active (Good)
/users/admin/active (Bad)

# ケバブケースを使用
/user-profiles (Good)
/userProfiles (Bad)
/user_profiles (Bad)
```

### React Router v7でのルート設計

```typescript
// apps/web/app/routes.ts
import { type RouteConfig, route, index, layout } from '@react-router/dev/routes'

export default [
  // 公開ルート
  index('routes/home.tsx'),
  route('login', 'routes/auth/login.tsx'),
  route('register', 'routes/auth/register.tsx'),

  // 認証必須ルート
  layout('routes/layouts/authenticated.tsx', [
    route('dashboard', 'routes/dashboard.tsx'),

    // ユーザー管理
    route('users', 'routes/users/index.tsx'),
    route('users/new', 'routes/users/new.tsx'),
    route('users/:id', 'routes/users/$id.tsx'),
    route('users/:id/edit', 'routes/users/$id.edit.tsx'),

    // 注文管理（ネストリソース）
    route('users/:userId/orders', 'routes/users/$userId.orders.tsx'),
  ]),

  // API エンドポイント
  route('api/users', 'routes/api/users.tsx'),
  route('api/users/:id', 'routes/api/users.$id.tsx'),
] satisfies RouteConfig
```

## loader/action パターン

### loader（データ取得）

```typescript
// apps/web/app/routes/users/index.tsx
import { json, type LoaderFunctionArgs } from 'react-router'
import { z } from 'zod'

// クエリパラメータのスキーマ
const searchParamsSchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  role: z.enum(['admin', 'user']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request)

  const url = new URL(request.url)
  const params = searchParamsSchema.parse(
    Object.fromEntries(url.searchParams)
  )

  const result = await repositories.user.findPaginated({
    page: params.page,
    limit: params.limit,
    filters: {
      role: params.role,
      search: params.search,
    },
    sort: {
      field: params.sortBy,
      direction: params.sortOrder,
    },
  })

  return json({
    users: result.items,
    pagination: {
      page: params.page,
      limit: params.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / params.limit),
    },
  })
}
```

### action（データ変更）

```typescript
// apps/web/app/routes/users/new.tsx
import { redirect, json, type ActionFunctionArgs } from 'react-router'
import { createUserSchema } from '@project/domains'

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireAuth(request)

  // 権限チェック
  if (user.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 })
  }

  const formData = await request.formData()
  const rawData = Object.fromEntries(formData)

  // バリデーション
  const result = createUserSchema.safeParse(rawData)
  if (!result.success) {
    return json(
      {
        success: false,
        errors: result.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  try {
    const newUser = await repositories.user.create(result.data)

    // 成功時はリダイレクト
    return redirect(`/users/${newUser.id}`)
  } catch (error) {
    if (error instanceof ConflictError) {
      return json(
        {
          success: false,
          errors: { email: ['このメールアドレスは既に使用されています'] },
        },
        { status: 409 }
      )
    }
    throw error
  }
}
```

## レスポンス形式

### 成功レスポンス

```typescript
// 単一リソース
{
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "Test User",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}

// コレクション
{
  "data": [
    { "id": "user_123", ... },
    { "id": "user_456", ... }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}

// 作成成功
{
  "data": { ... },
  "message": "User created successfully"
}
```

### エラーレスポンス

```typescript
// バリデーションエラー (400)
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fieldErrors": {
      "email": ["Invalid email format"],
      "name": ["Name is required"]
    }
  }
}

// 認証エラー (401)
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Authentication required"
  }
}

// 認可エラー (403)
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Permission denied"
  }
}

// リソース未発見 (404)
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User with id 'user_123' not found"
  }
}

// サーバーエラー (500)
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

## ページネーション

### オフセットベース

```typescript
// クエリパラメータ
GET /users?page=2&limit=20

// レスポンス
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

### カーソルベース（大量データ向け）

```typescript
// クエリパラメータ
GET /users?cursor=user_abc&limit=20

// レスポンス
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "nextCursor": "user_xyz",
    "hasMore": true
  }
}
```

## フィルタリング・ソート

```typescript
// フィルタリング
GET /users?role=admin&status=active

// 検索
GET /users?search=john

// ソート
GET /users?sortBy=createdAt&sortOrder=desc

// 複合条件
GET /users?role=admin&search=john&sortBy=name&sortOrder=asc&page=1&limit=20
```

## バリデーション

### Zodスキーマの活用

```typescript
// packages/domains/src/user/user.schema.ts

// 作成用スキーマ
export const createUserSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  name: z.string()
    .min(1, '名前は必須です')
    .max(100, '名前は100文字以内で入力してください'),
  role: z.enum(['admin', 'user']).default('user'),
})

// 更新用スキーマ（部分更新対応）
export const updateUserSchema = createUserSchema.partial()

// クエリパラメータスキーマ
export const userQuerySchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  role: z.enum(['admin', 'user']).optional(),
  search: z.string().max(100).optional(),
})

// IDパラメータスキーマ
export const userIdSchema = z.object({
  id: z.string().regex(/^user_[a-z0-9]+$/, '無効なユーザーIDです'),
})
```

### パラメータ検証ユーティリティ

```typescript
// apps/web/app/utils/validation.ts

export function validateSearchParams<T extends z.ZodType>(
  request: Request,
  schema: T
): z.infer<T> {
  const url = new URL(request.url)
  const params = Object.fromEntries(url.searchParams)
  return schema.parse(params)
}

export function validateParams<T extends z.ZodType>(
  params: Record<string, string | undefined>,
  schema: T
): z.infer<T> {
  return schema.parse(params)
}

// 使用例
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { id } = validateParams(params, userIdSchema)
  const query = validateSearchParams(request, userQuerySchema)
  // ...
}
```

## 認証・認可

### 認証ミドルウェア

```typescript
// apps/web/app/utils/auth.server.ts

export async function requireAuth(request: Request): Promise<User> {
  const session = await getSession(request)
  const userId = session.get('userId')

  if (!userId) {
    throw redirect('/login', {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    })
  }

  const user = await repositories.user.findById(userId)
  if (!user) {
    throw redirect('/login')
  }

  return user
}

export async function requireRole(
  request: Request,
  ...roles: UserRole[]
): Promise<User> {
  const user = await requireAuth(request)

  if (!roles.includes(user.role)) {
    throw new Response('Forbidden', { status: 403 })
  }

  return user
}
```

## バージョニング

### URLベース（推奨）

```
/api/v1/users
/api/v2/users
```

### ヘッダーベース

```
Accept: application/vnd.myapp.v1+json
```

## APIドキュメント

### OpenAPI/Swagger

```yaml
# openapi.yaml
openapi: 3.0.3
info:
  title: My Project API
  version: 1.0.0

paths:
  /api/users:
    get:
      summary: ユーザー一覧を取得
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            minimum: 1
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserListResponse'
```

## チェックリスト

### 設計時

- [ ] リソース指向のURL設計
- [ ] 適切なHTTPメソッドの使用
- [ ] 一貫したレスポンス形式
- [ ] 適切なステータスコード

### 実装時

- [ ] Zodによるバリデーション
- [ ] 認証・認可の実装
- [ ] エラーハンドリング
- [ ] ページネーション対応

### ドキュメント

- [ ] OpenAPI仕様の作成
- [ ] エンドポイント一覧
- [ ] リクエスト/レスポンス例

## 関連ドキュメント

- [エラーハンドリング](./error-handling.md)
- [セキュリティ](./security.md)
- [テスト戦略](./testing-strategy.md)
