# パフォーマンスガイドライン

## 概要

本ドキュメントは、アプリケーションのパフォーマンスを最適化するためのガイドラインを定義する。
ユーザー体験の向上とリソース効率化を目指す。

## パフォーマンス目標（SLO）

| メトリクス                     | 目標値  | 測定方法       |
| ------------------------------ | ------- | -------------- |
| LCP (Largest Contentful Paint) | < 2.5s  | Web Vitals     |
| FID (First Input Delay)        | < 100ms | Web Vitals     |
| CLS (Cumulative Layout Shift)  | < 0.1   | Web Vitals     |
| TTFB (Time to First Byte)      | < 600ms | Server Timing  |
| API Response Time (p95)        | < 500ms | Server Metrics |

## フロントエンドパフォーマンス

### バンドルサイズ最適化

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // チャンク分割戦略
        manualChunks: {
          vendor: ["react", "react-dom", "react-router"],
          ui: ["@project/ui-core"],
        },
      },
    },
    // 圧縮設定
    minify: "esbuild",
    // ソースマップは本番では無効化
    sourcemap: process.env.NODE_ENV !== "production",
  },
  plugins: [
    // バンドル分析（ビルド時のみ）
    visualizer({
      filename: "dist/stats.html",
      open: false,
    }),
  ],
});
```

### 遅延ロード

```typescript
// ルートベースのコード分割
// apps/web/app/routes.ts
import { lazy } from 'react'

// 遅延ロードするルート
const AdminDashboard = lazy(() => import('./routes/admin/dashboard'))
const Analytics = lazy(() => import('./routes/analytics'))

// ルート設定で prefetch を活用
export const routes = [
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      {
        path: 'dashboard',
        element: <AdminDashboard />,
        // ホバー時にプリフェッチ
        loader: () => import('./routes/admin/dashboard'),
      },
    ],
  },
]
```

### 画像最適化

```typescript
// 最適化された画像コンポーネント
type OptimizedImageProps = {
  src: string
  alt: string
  width: number
  height: number
  priority?: boolean
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
}: OptimizedImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      // アスペクト比を維持してCLS防止
      style={{ aspectRatio: `${width} / ${height}` }}
    />
  )
}

// WebP/AVIF対応
export function ResponsiveImage({ src, alt, ...props }: OptimizedImageProps) {
  const basePath = src.replace(/\.[^.]+$/, '')

  return (
    <picture>
      <source srcSet={`${basePath}.avif`} type="image/avif" />
      <source srcSet={`${basePath}.webp`} type="image/webp" />
      <OptimizedImage src={src} alt={alt} {...props} />
    </picture>
  )
}
```

### メモ化

```typescript
// React.memo - 不要な再レンダリングを防止
const ExpensiveComponent = memo(function ExpensiveComponent({
  data,
  onAction,
}: Props) {
  return <div>{/* 複雑なUI */}</div>
})

// useMemo - 計算コストの高い値をキャッシュ
function Dashboard({ items }: { items: Item[] }) {
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => b.score - a.score)
  }, [items])

  const totalScore = useMemo(() => {
    return items.reduce((sum, item) => sum + item.score, 0)
  }, [items])

  return <ItemList items={sortedItems} total={totalScore} />
}

// useCallback - 関数の参照を安定化
function ParentComponent() {
  const [items, setItems] = useState<Item[]>([])

  const handleDelete = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }, [])

  return <ItemList items={items} onDelete={handleDelete} />
}
```

### 仮想化

```typescript
// 大量リストの仮想化
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // 各行の推定高さ
    overscan: 5, // 画面外にレンダリングする行数
  })

  return (
    <div ref={parentRef} className="h-[400px] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <ItemRow item={items[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

## サーバーサイドパフォーマンス

### データベースクエリ最適化

```typescript
// N+1問題の回避
// Bad: N+1クエリ
async function getOrdersWithItems(userId: string) {
  const orders = await orderRepository.findByUserId(userId);
  for (const order of orders) {
    order.items = await orderItemRepository.findByOrderId(order.id); // N回
  }
  return orders;
}

// Good: 一括取得
async function getOrdersWithItems(userId: string) {
  const orders = await orderRepository.findByUserId(userId);
  const orderIds = orders.map((o) => o.id);
  const allItems = await orderItemRepository.findByOrderIds(orderIds);

  // メモリ内で関連付け
  const itemsByOrderId = groupBy(allItems, "orderId");
  return orders.map((order) => ({
    ...order,
    items: itemsByOrderId[order.id] || [],
  }));
}

// ページネーション
async function getUsers(options: PaginationOptions) {
  const { page = 1, limit = 20 } = options;

  // カーソルベースのページネーション（大量データ向け）
  const users = await userRepository.findAll({
    limit: limit + 1, // 次ページの有無を確認
    after: options.cursor,
    orderBy: [{ field: "createdAt", direction: "desc" }],
  });

  const hasNextPage = users.length > limit;
  const items = hasNextPage ? users.slice(0, -1) : users;
  const nextCursor = hasNextPage ? items[items.length - 1]?.id : null;

  return { items, hasNextPage, nextCursor };
}
```

### キャッシング

```typescript
// インメモリキャッシュ（単一インスタンス向け）
const cache = new Map<string, { data: unknown; expiresAt: number }>();

async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs = 60000,
): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }

  const data = await fn();
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

// 使用例
const popularProducts = await withCache(
  "popular-products",
  () => productRepository.getPopular({ limit: 10 }),
  5 * 60 * 1000, // 5分キャッシュ
);

// Redis等の分散キャッシュ（複数インスタンス向け）
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

async function withRedisCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds = 60,
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached) as T;
  }

  const data = await fn();
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
  return data;
}
```

### Loader での並列データ取得

```typescript
// apps/web/app/routes/dashboard.tsx

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);

  // 並列でデータ取得
  const [stats, recentOrders, notifications] = await Promise.all([
    dashboardService.getStats(user.id),
    orderRepository.findRecent(user.id, { limit: 5 }),
    notificationRepository.findUnread(user.id, { limit: 10 }),
  ]);

  return json({ stats, recentOrders, notifications });
}
```

### ストリーミングレスポンス

```typescript
// 大量データのストリーミング
export async function loader({ request }: LoaderFunctionArgs) {
  // ストリームを返す
  const stream = new ReadableStream({
    async start(controller) {
      const cursor = exportService.createCursor();

      while (true) {
        const batch = await cursor.next(100);
        if (batch.length === 0) break;

        const chunk = batch.map((item) => JSON.stringify(item)).join("\n");
        controller.enqueue(new TextEncoder().encode(chunk + "\n"));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
    },
  });
}
```

## ビルド最適化

### Tree Shaking

```typescript
// Named exportsを使用（tree-shaking対応）
// Good
export { Button } from './button'
export { Input } from './input'

// Bad（バレルファイルでの再エクスポートに注意）
export * from './components'

// package.jsonでsideEffectsを指定
{
  "sideEffects": [
    "*.css",
    "*.scss"
  ]
}
```

### 本番ビルド設定

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    // ターゲットブラウザ
    target: "es2020",

    // チャンクサイズ警告閾値
    chunkSizeWarningLimit: 500,

    // CSS分割
    cssCodeSplit: true,

    // Terserオプション（esbuildより詳細な制御が必要な場合）
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});
```

## パフォーマンス計測

### Web Vitals

```typescript
// apps/web/app/utils/web-vitals.ts
import { onCLS, onFID, onLCP, onTTFB } from "web-vitals";

export function reportWebVitals() {
  onCLS((metric) => sendToAnalytics("CLS", metric));
  onFID((metric) => sendToAnalytics("FID", metric));
  onLCP((metric) => sendToAnalytics("LCP", metric));
  onTTFB((metric) => sendToAnalytics("TTFB", metric));
}

function sendToAnalytics(name: string, metric: Metric) {
  // Google Analytics, DataDog等に送信
  console.log(`${name}: ${metric.value}`);
}
```

### サーバータイミング

```typescript
// Server-Timingヘッダーで計測
export async function loader({ request }: LoaderFunctionArgs) {
  const timings: string[] = []
  const start = Date.now()

  const dbStart = Date.now()
  const data = await fetchData()
  timings.push(`db;dur=${Date.now() - dbStart}`)

  const renderStart = Date.now()
  const html = renderToString(<Component data={data} />)
  timings.push(`render;dur=${Date.now() - renderStart}`)

  timings.push(`total;dur=${Date.now() - start}`)

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Server-Timing': timings.join(', '),
    },
  })
}
```

## チェックリスト

### フロントエンド

- [ ] バンドルサイズを分析・最適化
- [ ] 画像を適切なフォーマット・サイズで配信
- [ ] 遅延ロードを適用
- [ ] 不要な再レンダリングを防止
- [ ] Web Vitalsを計測

### バックエンド

- [ ] N+1クエリを回避
- [ ] 適切なインデックスを設定
- [ ] キャッシュを活用
- [ ] 並列処理を活用
- [ ] レスポンスタイムを計測

### インフラ

- [ ] CDNを活用
- [ ] 圧縮（gzip/brotli）を有効化
- [ ] HTTP/2を有効化
- [ ] キャッシュヘッダーを適切に設定

## 関連ドキュメント

- [ビルドシステム](./build-system.md)
- [ロギング・オブザーバビリティ](./logging-observability.md)
- [デプロイメント](./deployment.md)
