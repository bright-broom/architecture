# ロギング・オブザーバビリティガイドライン

## 概要

本ドキュメントは、アプリケーションの可観測性（Observability）を確保するためのガイドラインを定義する。
ログ、メトリクス、トレーシングの3本柱により、システムの状態を把握し、問題を迅速に特定・解決する。

## オブザーバビリティの3本柱

```
┌─────────────────────────────────────────────────────────────┐
│                    Observability                            │
├──────────────────┬──────────────────┬──────────────────────┤
│      Logs        │     Metrics      │      Traces          │
│  (何が起きたか)  │   (どれくらいか) │  (どのように流れたか)│
├──────────────────┼──────────────────┼──────────────────────┤
│ - エラーログ     │ - リクエスト数   │ - リクエストフロー   │
│ - アクセスログ   │ - レスポンス時間 │ - サービス間通信     │
│ - 監査ログ       │ - エラー率       │ - データベースクエリ │
│ - デバッグログ   │ - リソース使用率 │ - 外部API呼び出し    │
└──────────────────┴──────────────────┴──────────────────────┘
```

## ロギング

### ログレベル

| レベル | 用途 | 例 |
|--------|------|-----|
| ERROR | 即座に対応が必要なエラー | データベース接続失敗、支払い処理失敗 |
| WARN | 注意が必要な状況 | 非推奨APIの使用、リトライ発生 |
| INFO | 重要なビジネスイベント | ユーザー登録、注文完了 |
| DEBUG | 開発・デバッグ用詳細情報 | 関数の入出力、変数の値 |

### Logger実装

```typescript
// packages/utils/src/logger.ts

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LogContext {
  requestId?: string
  userId?: string
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

class Logger {
  private context: LogContext = {}

  /**
   * リクエストスコープのコンテキストを設定
   */
  withContext(context: LogContext): Logger {
    const child = new Logger()
    child.context = { ...this.context, ...context }
    return child
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log('error', message, context, error)
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, context)
    }
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    // 構造化ログとして出力
    const output = JSON.stringify(entry)

    switch (level) {
      case 'error':
        console.error(output)
        break
      case 'warn':
        console.warn(output)
        break
      default:
        console.log(output)
    }

    // 本番環境ではログサービスに送信
    if (process.env.NODE_ENV === 'production') {
      this.sendToLogService(entry)
    }
  }

  private sendToLogService(entry: LogEntry): void {
    // Cloud Logging, DataDog, etc.
  }
}

export const logger = new Logger()
```

### リクエストロギングミドルウェア

```typescript
// apps/web/app/middleware/logging.ts

import { logger } from '@project/utils'
import { generateId } from '@project/utils'

export async function loggingMiddleware(
  request: Request,
  next: () => Promise<Response>
): Promise<Response> {
  const requestId = request.headers.get('x-request-id') || generateId('req')
  const startTime = Date.now()

  // リクエストスコープのロガー
  const requestLogger = logger.withContext({
    requestId,
    method: request.method,
    path: new URL(request.url).pathname,
    userAgent: request.headers.get('user-agent'),
  })

  requestLogger.info('Request started')

  try {
    const response = await next()
    const duration = Date.now() - startTime

    requestLogger.info('Request completed', {
      status: response.status,
      durationMs: duration,
    })

    // レスポンスヘッダーにリクエストIDを追加
    response.headers.set('x-request-id', requestId)
    return response
  } catch (error) {
    const duration = Date.now() - startTime

    requestLogger.error('Request failed', error as Error, {
      durationMs: duration,
    })

    throw error
  }
}
```

### 機密情報のマスキング

```typescript
// packages/utils/src/logger.ts

const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'authorization',
  'creditCard',
  'ssn',
]

function maskSensitiveData(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data
  }

  if (Array.isArray(data)) {
    return data.map(maskSensitiveData)
  }

  const masked: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    const isSensitive = SENSITIVE_FIELDS.some(field =>
      key.toLowerCase().includes(field.toLowerCase())
    )

    if (isSensitive) {
      masked[key] = '***REDACTED***'
    } else if (typeof value === 'object') {
      masked[key] = maskSensitiveData(value)
    } else {
      masked[key] = value
    }
  }
  return masked
}

// 使用例
logger.info('User created', maskSensitiveData({
  email: 'user@example.com',
  password: 'secret123',  // → '***REDACTED***'
}))
```

## メトリクス

### カスタムメトリクス

```typescript
// packages/utils/src/metrics.ts

interface MetricPoint {
  name: string
  value: number
  labels: Record<string, string>
  timestamp: number
}

class MetricsCollector {
  private points: MetricPoint[] = []

  /**
   * カウンターをインクリメント
   */
  increment(
    name: string,
    labels: Record<string, string> = {},
    value = 1
  ): void {
    this.record(name, value, labels)
  }

  /**
   * ゲージ値を記録
   */
  gauge(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    this.record(name, value, labels)
  }

  /**
   * 処理時間を計測
   */
  async timing<T>(
    name: string,
    fn: () => Promise<T>,
    labels: Record<string, string> = {}
  ): Promise<T> {
    const start = Date.now()
    try {
      return await fn()
    } finally {
      const duration = Date.now() - start
      this.record(`${name}_duration_ms`, duration, labels)
    }
  }

  private record(
    name: string,
    value: number,
    labels: Record<string, string>
  ): void {
    const point: MetricPoint = {
      name,
      value,
      labels,
      timestamp: Date.now(),
    }
    this.points.push(point)

    // 本番環境ではメトリクスサービスに送信
    if (process.env.NODE_ENV === 'production') {
      this.flush()
    }
  }

  private flush(): void {
    // Cloud Monitoring, DataDog, Prometheus, etc.
  }
}

export const metrics = new MetricsCollector()
```

### メトリクス収集例

```typescript
// apps/web/app/routes/api/users.ts

export async function loader({ request }: LoaderFunctionArgs) {
  return metrics.timing(
    'users_list',
    async () => {
      const users = await repositories.user.findAll()
      metrics.gauge('users_total', users.length)
      return json({ users })
    },
    { route: '/api/users' }
  )
}

export async function action({ request }: ActionFunctionArgs) {
  metrics.increment('user_create_attempt')

  try {
    const user = await repositories.user.create(data)
    metrics.increment('user_create_success')
    return redirect(`/users/${user.id}`)
  } catch (error) {
    metrics.increment('user_create_failure', {
      errorType: error.constructor.name,
    })
    throw error
  }
}
```

## 分散トレーシング

### トレースコンテキストの伝播

```typescript
// packages/utils/src/tracing.ts

interface TraceContext {
  traceId: string
  spanId: string
  parentSpanId?: string
}

class Tracer {
  /**
   * 新しいトレースを開始
   */
  startTrace(): TraceContext {
    return {
      traceId: generateId('trace'),
      spanId: generateId('span'),
    }
  }

  /**
   * 子スパンを作成
   */
  startSpan(parent: TraceContext): TraceContext {
    return {
      traceId: parent.traceId,
      spanId: generateId('span'),
      parentSpanId: parent.spanId,
    }
  }

  /**
   * HTTPヘッダーからトレースコンテキストを抽出
   */
  extractFromHeaders(headers: Headers): TraceContext | null {
    const traceId = headers.get('x-trace-id')
    const spanId = headers.get('x-span-id')

    if (!traceId || !spanId) {
      return null
    }

    return { traceId, spanId }
  }

  /**
   * HTTPヘッダーにトレースコンテキストを注入
   */
  injectToHeaders(headers: Headers, context: TraceContext): void {
    headers.set('x-trace-id', context.traceId)
    headers.set('x-span-id', context.spanId)
    if (context.parentSpanId) {
      headers.set('x-parent-span-id', context.parentSpanId)
    }
  }
}

export const tracer = new Tracer()
```

### スパンの記録

```typescript
// 使用例
async function processOrder(orderId: string, trace: TraceContext) {
  const span = tracer.startSpan(trace)

  logger.info('Processing order', {
    orderId,
    traceId: span.traceId,
    spanId: span.spanId,
  })

  // データベースクエリ
  const dbSpan = tracer.startSpan(span)
  const order = await metrics.timing(
    'db_query',
    () => orderRepository.findById(orderId),
    { operation: 'findById', traceId: span.traceId }
  )

  // 外部API呼び出し
  const apiSpan = tracer.startSpan(span)
  const headers = new Headers()
  tracer.injectToHeaders(headers, apiSpan)
  await fetch('https://api.payment.com/process', { headers })

  logger.info('Order processed', {
    orderId,
    traceId: span.traceId,
    spanId: span.spanId,
    durationMs: Date.now() - startTime,
  })
}
```

## ヘルスチェック

```typescript
// apps/web/app/routes/health.ts

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded'
  checks: Record<string, {
    status: 'pass' | 'fail' | 'warn'
    latencyMs?: number
    message?: string
  }>
  timestamp: string
}

export async function loader(): Promise<Response> {
  const startTime = Date.now()
  const checks: HealthStatus['checks'] = {}

  // データベース接続チェック
  try {
    const dbStart = Date.now()
    await repositories.health.ping()
    checks.database = {
      status: 'pass',
      latencyMs: Date.now() - dbStart,
    }
  } catch (error) {
    checks.database = {
      status: 'fail',
      message: 'Database connection failed',
    }
  }

  // 外部サービスチェック
  try {
    const apiStart = Date.now()
    await fetch('https://api.external.com/health', { timeout: 5000 })
    checks.externalApi = {
      status: 'pass',
      latencyMs: Date.now() - apiStart,
    }
  } catch (error) {
    checks.externalApi = {
      status: 'warn',
      message: 'External API is slow or unavailable',
    }
  }

  // 全体ステータスの判定
  const hasFailure = Object.values(checks).some(c => c.status === 'fail')
  const hasWarning = Object.values(checks).some(c => c.status === 'warn')

  const status: HealthStatus = {
    status: hasFailure ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy',
    checks,
    timestamp: new Date().toISOString(),
  }

  const httpStatus = hasFailure ? 503 : 200

  return json(status, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
```

## アラート設定

### アラートルール例

```yaml
# アラート設定の例（Cloud Monitoring, DataDog等で設定）

alerts:
  - name: High Error Rate
    condition: error_rate > 5%
    duration: 5m
    severity: critical
    notification:
      - slack: #alerts-critical
      - pagerduty: on-call

  - name: Slow Response Time
    condition: p95_latency > 2000ms
    duration: 10m
    severity: warning
    notification:
      - slack: #alerts-warning

  - name: Database Connection Pool Exhausted
    condition: db_connections_available == 0
    duration: 1m
    severity: critical
    notification:
      - slack: #alerts-critical
      - pagerduty: on-call

  - name: High Memory Usage
    condition: memory_usage > 90%
    duration: 5m
    severity: warning
    notification:
      - slack: #alerts-warning
```

## ダッシュボード

### 主要メトリクス

| カテゴリ | メトリクス | 説明 |
|----------|-----------|------|
| トラフィック | requests_per_second | リクエスト数/秒 |
| レイテンシ | p50_latency, p95_latency, p99_latency | レスポンス時間パーセンタイル |
| エラー | error_rate, errors_by_type | エラー率、エラー種別 |
| リソース | cpu_usage, memory_usage | CPU/メモリ使用率 |
| ビジネス | users_registered, orders_placed | ビジネスKPI |

### ダッシュボード構成例

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Overview                      │
├────────────────┬────────────────┬────────────────┬──────────┤
│ Requests/sec   │ Error Rate     │ p95 Latency    │ Uptime   │
│   1,234        │   0.5%         │   145ms        │  99.99%  │
├────────────────┴────────────────┴────────────────┴──────────┤
│                    Request Latency (ms)                      │
│  [Graph showing p50, p95, p99 over time]                    │
├─────────────────────────────────────────────────────────────┤
│                    Error Rate by Type                        │
│  [Stacked bar chart of error types]                         │
├────────────────────────────────┬────────────────────────────┤
│    Top Endpoints by Latency    │  Top Errors by Count       │
│  1. /api/search - 234ms        │  1. ValidationError - 45   │
│  2. /api/orders - 156ms        │  2. NotFoundError - 23     │
│  3. /api/users - 89ms          │  3. TimeoutError - 12      │
└────────────────────────────────┴────────────────────────────┘
```

## ベストプラクティス

### ログ

- [ ] 構造化ログ（JSON形式）を使用
- [ ] 適切なログレベルを選択
- [ ] リクエストIDでトレース可能に
- [ ] 機密情報をマスク
- [ ] ログローテーションを設定

### メトリクス

- [ ] 重要なビジネスメトリクスを定義
- [ ] SLI/SLOを設定
- [ ] アラート閾値を適切に設定
- [ ] ダッシュボードを整備

### トレーシング

- [ ] サービス間でトレースIDを伝播
- [ ] 重要な操作にスパンを設定
- [ ] サンプリングレートを調整

## 関連ドキュメント

- [エラーハンドリング](./error-handling.md)
- [パフォーマンス](./performance.md)
- [デプロイメント](./deployment.md)
