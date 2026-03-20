# エラーハンドリングガイドライン

## 概要

本ドキュメントは、アプリケーション全体で一貫したエラーハンドリングを実現するためのガイドラインを定義する。
適切なエラー処理により、デバッグ効率、ユーザー体験、システム信頼性を向上させる。

## エラーの分類

### 1. ドメインエラー（ビジネスロジックエラー）

ビジネスルールに違反した場合に発生。予測可能で、ユーザーに具体的なメッセージを表示。

```typescript
// packages/domains/src/errors/errors.ts

/**
 * ドメインエラーの基底クラス
 */
export abstract class DomainError extends Error {
  abstract readonly code: string
  abstract readonly statusCode: number

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = this.constructor.name
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
    }
  }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR'
  readonly statusCode = 400
  readonly fieldErrors: Record<string, string[]>

  constructor(
    message: string,
    fieldErrors: Record<string, string[]> = {},
    options?: ErrorOptions
  ) {
    super(message, options)
    this.fieldErrors = fieldErrors
  }

  toJSON() {
    return {
      ...super.toJSON(),
      fieldErrors: this.fieldErrors,
    }
  }
}

/**
 * リソースが見つからないエラー
 */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND'
  readonly statusCode = 404

  constructor(resource: string, id: string, options?: ErrorOptions) {
    super(`${resource} with id '${id}' not found`, options)
  }
}

/**
 * 認証エラー
 */
export class AuthenticationError extends DomainError {
  readonly code = 'AUTHENTICATION_ERROR'
  readonly statusCode = 401

  constructor(message = 'Authentication required', options?: ErrorOptions) {
    super(message, options)
  }
}

/**
 * 認可エラー
 */
export class AuthorizationError extends DomainError {
  readonly code = 'AUTHORIZATION_ERROR'
  readonly statusCode = 403

  constructor(message = 'Permission denied', options?: ErrorOptions) {
    super(message, options)
  }
}

/**
 * ビジネスルール違反
 */
export class BusinessRuleError extends DomainError {
  readonly code = 'BUSINESS_RULE_VIOLATION'
  readonly statusCode = 422

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
}

/**
 * 競合エラー（楽観的ロック失敗など）
 */
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT'
  readonly statusCode = 409

  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
}
```

### 2. インフラストラクチャエラー

外部サービス（DB、API等）との通信失敗。リトライやフォールバックを検討。

```typescript
// packages/repositories/src/errors/infrastructure-errors.ts

export class InfrastructureError extends Error {
  readonly isRetryable: boolean

  constructor(
    message: string,
    isRetryable = false,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'InfrastructureError'
    this.isRetryable = isRetryable
  }
}

export class DatabaseError extends InfrastructureError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, true, options)
    this.name = 'DatabaseError'
  }
}

export class ExternalServiceError extends InfrastructureError {
  readonly serviceName: string
  readonly statusCode?: number

  constructor(
    serviceName: string,
    message: string,
    statusCode?: number,
    options?: ErrorOptions
  ) {
    super(message, true, options)
    this.name = 'ExternalServiceError'
    this.serviceName = serviceName
    this.statusCode = statusCode
  }
}

export class NetworkError extends InfrastructureError {
  constructor(message = 'Network error', options?: ErrorOptions) {
    super(message, true, options)
    this.name = 'NetworkError'
  }
}
```

### 3. プログラミングエラー

バグによるエラー。修正が必要で、ユーザーには汎用メッセージを表示。

```typescript
// これらは修正が必要なバグ
// - TypeError: undefined の参照
// - RangeError: 配列範囲外アクセス
// - 予期しない状態
```

## エラーハンドリングパターン

### Repository層

```typescript
// packages/repositories/src/domain/users/user.repository.ts

export class UserRepository extends BaseRepository<User> {
  async findById(id: string): Promise<User | null> {
    try {
      const doc = await this.dataSource.get(`users/${id}`)
      if (!doc) return null
      return this.fromDocument(doc)
    } catch (error) {
      // インフラエラーをラップ
      if (error instanceof Error) {
        throw new DatabaseError(`Failed to fetch user: ${error.message}`, {
          cause: error,
        })
      }
      throw error
    }
  }

  async create(data: CreateUserInput): Promise<User> {
    // バリデーション
    const result = createUserSchema.safeParse(data)
    if (!result.success) {
      throw new ValidationError(
        'Invalid user data',
        result.error.flatten().fieldErrors
      )
    }

    // 重複チェック
    const existing = await this.findByEmail(data.email)
    if (existing) {
      throw new ConflictError(`User with email '${data.email}' already exists`)
    }

    try {
      const id = this.generateId('user')
      const now = this.now()
      const user: User = {
        ...result.data,
        id,
        createdAt: now,
        updatedAt: now,
      }
      await this.dataSource.set(`users/${id}`, this.toDocument(user))
      return user
    } catch (error) {
      throw new DatabaseError('Failed to create user', { cause: error })
    }
  }
}
```

### loader/action層

```typescript
// apps/web/app/routes/users.$id.tsx
import { json, redirect } from 'react-router'
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router'
import {
  NotFoundError,
  ValidationError,
  AuthorizationError,
} from '@project/domains'

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request)
    const targetUser = await getRepositories().user.findById(params.id!)

    if (!targetUser) {
      throw new NotFoundError('User', params.id!)
    }

    // 権限チェック
    if (!canViewUser(user, targetUser)) {
      throw new AuthorizationError('You cannot view this user')
    }

    return json({ user: targetUser })
  } catch (error) {
    // ドメインエラーはそのままthrow（ErrorBoundaryで処理）
    if (error instanceof DomainError) {
      throw error
    }

    // 予期しないエラーをログ出力して汎用エラーをthrow
    console.error('Unexpected error in user loader:', error)
    throw new Response('Internal Server Error', { status: 500 })
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const user = await requireAuth(request)
    const formData = await request.formData()

    const result = updateUserSchema.safeParse(Object.fromEntries(formData))
    if (!result.success) {
      return json(
        { errors: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    await getRepositories().user.update(params.id!, result.data)
    return redirect(`/users/${params.id}`)
  } catch (error) {
    if (error instanceof ValidationError) {
      return json(
        { errors: error.fieldErrors, message: error.message },
        { status: 400 }
      )
    }

    if (error instanceof NotFoundError) {
      return json({ message: error.message }, { status: 404 })
    }

    if (error instanceof AuthorizationError) {
      return json({ message: error.message }, { status: 403 })
    }

    console.error('Unexpected error in user action:', error)
    return json({ message: 'An unexpected error occurred' }, { status: 500 })
  }
}
```

### ErrorBoundary

```typescript
// apps/web/app/root.tsx
import { useRouteError, isRouteErrorResponse } from 'react-router'

export function ErrorBoundary() {
  const error = useRouteError()

  // HTTPエラーレスポンス
  if (isRouteErrorResponse(error)) {
    return (
      <ErrorLayout>
        <h1>{error.status} {error.statusText}</h1>
        <p>{getErrorMessage(error.status)}</p>
        {error.status === 404 && (
          <Link to="/">ホームに戻る</Link>
        )}
      </ErrorLayout>
    )
  }

  // ドメインエラー
  if (error instanceof DomainError) {
    return (
      <ErrorLayout>
        <h1>エラーが発生しました</h1>
        <p>{error.message}</p>
        <Link to="/">ホームに戻る</Link>
      </ErrorLayout>
    )
  }

  // 予期しないエラー（本番では詳細を隠す）
  return (
    <ErrorLayout>
      <h1>予期しないエラーが発生しました</h1>
      <p>しばらく待ってから再度お試しください。</p>
      {process.env.NODE_ENV === 'development' && error instanceof Error && (
        <pre>{error.stack}</pre>
      )}
      <Link to="/">ホームに戻る</Link>
    </ErrorLayout>
  )
}

function getErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'リクエストが不正です。'
    case 401:
      return 'ログインが必要です。'
    case 403:
      return 'アクセス権限がありません。'
    case 404:
      return 'ページが見つかりませんでした。'
    case 500:
      return 'サーバーエラーが発生しました。'
    default:
      return 'エラーが発生しました。'
  }
}
```

## リトライパターン

```typescript
// packages/utils/src/retry.ts

interface RetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  retryableErrors?: Array<new (...args: any[]) => Error>
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    retryableErrors = [],
  } = options

  let lastError: Error | undefined
  let delay = initialDelayMs

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // リトライ可能かチェック
      const isRetryable =
        retryableErrors.length === 0 ||
        retryableErrors.some((ErrorClass) => error instanceof ErrorClass) ||
        (error instanceof InfrastructureError && error.isRetryable)

      if (!isRetryable || attempt === maxAttempts) {
        throw error
      }

      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, {
        error: lastError.message,
      })

      await sleep(delay)
      delay = Math.min(delay * backoffMultiplier, maxDelayMs)
    }
  }

  throw lastError
}

// 使用例
const user = await withRetry(
  () => userRepository.findById(id),
  {
    maxAttempts: 3,
    retryableErrors: [DatabaseError, NetworkError],
  }
)
```

## Result型パターン（オプション）

例外を使わないエラーハンドリングパターン。

```typescript
// packages/utils/src/result.ts

type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

function ok<T>(data: T): Result<T, never> {
  return { success: true, data }
}

function err<E>(error: E): Result<never, E> {
  return { success: false, error }
}

// 使用例
async function findUser(id: string): Promise<Result<User, NotFoundError>> {
  const user = await repository.findById(id)
  if (!user) {
    return err(new NotFoundError('User', id))
  }
  return ok(user)
}

// 呼び出し側
const result = await findUser(id)
if (!result.success) {
  // エラー処理
  return json({ error: result.error.message }, { status: 404 })
}
// result.data はUser型として利用可能
```

## ユーザー向けエラーメッセージ

### 原則

1. **具体的**: 何が問題かを明確に
2. **アクショナブル**: 次に何をすべきか示す
3. **非技術的**: 専門用語を避ける
4. **安全**: 機密情報を含めない

```typescript
// Bad
"Error: ECONNREFUSED 127.0.0.1:5432"
"NullPointerException at line 42"

// Good
"データベースに接続できませんでした。しばらく待ってから再度お試しください。"
"ユーザー情報の取得に失敗しました。ページを更新してください。"
```

### エラーメッセージマッピング

```typescript
// apps/web/app/utils/error-messages.ts

const errorMessages: Record<string, string> = {
  VALIDATION_ERROR: '入力内容に誤りがあります。',
  NOT_FOUND: 'お探しの情報が見つかりませんでした。',
  AUTHENTICATION_ERROR: 'ログインが必要です。',
  AUTHORIZATION_ERROR: 'この操作を行う権限がありません。',
  CONFLICT: 'この操作は既に行われています。',
  NETWORK_ERROR: 'ネットワークエラーが発生しました。接続を確認してください。',
  DATABASE_ERROR: 'データの処理中にエラーが発生しました。',
  DEFAULT: '予期しないエラーが発生しました。しばらく待ってから再度お試しください。',
}

export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof DomainError) {
    return errorMessages[error.code] || error.message
  }
  if (error instanceof InfrastructureError) {
    return errorMessages.DATABASE_ERROR
  }
  return errorMessages.DEFAULT
}
```

## フォームエラー表示

```typescript
// apps/web/app/components/form-field.tsx

type FormFieldProps = {
  name: string
  label: string
  errors?: string[]
  children: React.ReactNode
}

export function FormField({ name, label, errors, children }: FormFieldProps) {
  const hasError = errors && errors.length > 0

  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hasError && (
        <ul className="text-sm text-red-600" role="alert">
          {errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// 使用例
function UserForm() {
  const actionData = useActionData<{ errors?: Record<string, string[]> }>()

  return (
    <Form method="post">
      <FormField
        name="email"
        label="メールアドレス"
        errors={actionData?.errors?.email}
      >
        <input
          type="email"
          name="email"
          className={actionData?.errors?.email ? 'border-red-500' : ''}
        />
      </FormField>
      {/* 他のフィールド */}
    </Form>
  )
}
```

## エラーログ

```typescript
// エラーログの出力例
function logError(error: unknown, context: Record<string, unknown> = {}) {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    code: error instanceof DomainError ? error.code : undefined,
    ...context,
  }

  // 本番環境ではログサービスに送信
  if (process.env.NODE_ENV === 'production') {
    // Sentry, DataDog, etc.
    sendToLoggingService(errorInfo)
  } else {
    console.error('Error:', errorInfo)
  }
}

// 使用例
try {
  await riskyOperation()
} catch (error) {
  logError(error, {
    operation: 'riskyOperation',
    userId: currentUser.id,
    requestId: request.headers.get('x-request-id'),
  })
  throw error
}
```

## チェックリスト

### 実装時

- [ ] 適切なエラー型を使用しているか
- [ ] エラーメッセージがユーザーフレンドリーか
- [ ] 機密情報がエラーに含まれていないか
- [ ] リトライが必要な操作には実装されているか
- [ ] ErrorBoundaryでキャッチされるか

### コードレビュー時

- [ ] 例外を握りつぶしていないか
- [ ] エラーログが適切に出力されるか
- [ ] cause を使ってエラーチェーンを保持しているか
- [ ] 予期しないエラーの処理があるか

## 関連ドキュメント

- [ロギング・オブザーバビリティ](./logging-observability.md)
- [テスト戦略](./testing-strategy.md)
- [セキュリティ](./security.md)
