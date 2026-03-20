# 状態管理ガイドライン

## 概要

本ドキュメントは、React Router v7とReactの標準機能を活用した状態管理のガイドラインを定義する。
過度な状態管理ライブラリに依存せず、シンプルで保守しやすいアプローチを採用する。

## 状態の分類

```
┌─────────────────────────────────────────────────────────────┐
│                     状態の分類                               │
├──────────────────┬──────────────────┬───────────────────────┤
│  Server State    │   Client State   │    URL State          │
│  (サーバー状態)  │  (クライアント)  │   (URL状態)           │
├──────────────────┼──────────────────┼───────────────────────┤
│ - ユーザーデータ │ - UIの開閉状態   │ - ページネーション    │
│ - 商品一覧       │ - フォーム入力   │ - フィルター条件      │
│ - 注文履歴       │ - モーダル状態   │ - ソート順            │
├──────────────────┼──────────────────┼───────────────────────┤
│ loader/action    │ useState/        │ useSearchParams       │
│ useLoaderData    │ useReducer       │                       │
└──────────────────┴──────────────────┴───────────────────────┘
```

## Server State（サーバー状態）

### loader/actionパターン

```typescript
// apps/web/app/routes/users/index.tsx
import { json, type LoaderFunctionArgs } from 'react-router'
import { useLoaderData } from 'react-router'

// サーバーでデータ取得
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request)
  const users = await repositories.user.findAll()

  return json({ users, currentUser: user })
}

// コンポーネントでデータ使用
export default function UsersPage() {
  const { users, currentUser } = useLoaderData<typeof loader>()

  return (
    <div>
      <h1>ユーザー一覧</h1>
      <UserList users={users} />
    </div>
  )
}
```

### データの更新（action）

```typescript
// apps/web/app/routes/users/new.tsx
import { redirect, type ActionFunctionArgs } from 'react-router'
import { Form, useActionData, useNavigation } from 'react-router'

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const result = createUserSchema.safeParse(Object.fromEntries(formData))

  if (!result.success) {
    return json(
      { errors: result.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const user = await repositories.user.create(result.data)
  return redirect(`/users/${user.id}`)
}

export default function NewUserPage() {
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  return (
    <Form method="post">
      <input name="email" />
      {actionData?.errors?.email && (
        <span className="error">{actionData.errors.email}</span>
      )}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '作成中...' : '作成'}
      </button>
    </Form>
  )
}
```

### データの再検証（revalidation）

```typescript
// useFetcher を使った部分更新
import { useFetcher } from 'react-router'

function DeleteUserButton({ userId }: { userId: string }) {
  const fetcher = useFetcher()
  const isDeleting = fetcher.state !== 'idle'

  return (
    <fetcher.Form method="delete" action={`/api/users/${userId}`}>
      <button type="submit" disabled={isDeleting}>
        {isDeleting ? '削除中...' : '削除'}
      </button>
    </fetcher.Form>
  )
}

// 手動での再検証
import { useRevalidator } from 'react-router'

function RefreshButton() {
  const revalidator = useRevalidator()

  return (
    <button
      onClick={() => revalidator.revalidate()}
      disabled={revalidator.state === 'loading'}
    >
      更新
    </button>
  )
}
```

## URL State（URL状態）

### useSearchParams

```typescript
// フィルターやページネーションをURLで管理
import { useSearchParams } from 'react-router'

function UserFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const role = searchParams.get('role') || 'all'
  const page = Number(searchParams.get('page')) || 1

  const handleRoleChange = (newRole: string) => {
    setSearchParams(prev => {
      prev.set('role', newRole)
      prev.set('page', '1')  // フィルター変更時はページをリセット
      return prev
    })
  }

  const handlePageChange = (newPage: number) => {
    setSearchParams(prev => {
      prev.set('page', String(newPage))
      return prev
    })
  }

  return (
    <div>
      <select value={role} onChange={e => handleRoleChange(e.target.value)}>
        <option value="all">すべて</option>
        <option value="admin">管理者</option>
        <option value="user">一般</option>
      </select>

      <Pagination currentPage={page} onPageChange={handlePageChange} />
    </div>
  )
}
```

### URLパラメータをloaderで使用

```typescript
// loader でURL状態を読み取り
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const page = Number(url.searchParams.get('page')) || 1
  const role = url.searchParams.get('role') || undefined

  const result = await repositories.user.findPaginated({
    page,
    limit: 20,
    filters: { role },
  })

  return json({ users: result.items, pagination: result.pagination })
}
```

## Client State（クライアント状態）

### useState（ローカル状態）

```typescript
// UI状態の管理
function UserCard({ user }: { user: User }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div>
      <button onClick={() => setIsExpanded(!isExpanded)}>
        {isExpanded ? '閉じる' : '詳細'}
      </button>
      {isExpanded && <UserDetails user={user} />}
    </div>
  )
}
```

### useReducer（複雑なローカル状態）

```typescript
// 複雑なフォーム状態
type FormState = {
  values: Record<string, string>
  errors: Record<string, string>
  touched: Record<string, boolean>
  isSubmitting: boolean
}

type FormAction =
  | { type: 'SET_VALUE'; field: string; value: string }
  | { type: 'SET_ERROR'; field: string; error: string }
  | { type: 'SET_TOUCHED'; field: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_END' }
  | { type: 'RESET' }

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_VALUE':
      return {
        ...state,
        values: { ...state.values, [action.field]: action.value },
        errors: { ...state.errors, [action.field]: '' },
      }
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.field]: action.error },
      }
    case 'SET_TOUCHED':
      return {
        ...state,
        touched: { ...state.touched, [action.field]: true },
      }
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true }
    case 'SUBMIT_END':
      return { ...state, isSubmitting: false }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

function useForm(initialValues: Record<string, string>) {
  const [state, dispatch] = useReducer(formReducer, {
    values: initialValues,
    errors: {},
    touched: {},
    isSubmitting: false,
  })

  return {
    ...state,
    setValue: (field: string, value: string) =>
      dispatch({ type: 'SET_VALUE', field, value }),
    setError: (field: string, error: string) =>
      dispatch({ type: 'SET_ERROR', field, error }),
    setTouched: (field: string) =>
      dispatch({ type: 'SET_TOUCHED', field }),
  }
}
```

### Context（グローバル状態）

```typescript
// テーマやユーザー設定などアプリ全体で必要な状態
// apps/web/app/contexts/theme.tsx

type Theme = 'light' | 'dark' | 'system'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system')

  const resolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return theme
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
```

## パターン選択ガイド

```
┌─────────────────────────────────────────────────────────────┐
│                   状態管理の選択フロー                        │
└─────────────────────────────────────────────────────────────┘

データはサーバーから取得するか？
    ├── Yes → loader/action + useLoaderData
    └── No
         │
         └── URLで共有すべきか？（ブックマーク、履歴）
              ├── Yes → useSearchParams
              └── No
                   │
                   └── 複数コンポーネントで共有？
                        ├── Yes → Context または状態を上位に持ち上げ
                        └── No → useState / useReducer
```

## アンチパターン

### 避けるべきパターン

```typescript
// Bad: サーバーデータをクライアント状態にコピー
function UserList() {
  const { users } = useLoaderData<typeof loader>()
  const [localUsers, setLocalUsers] = useState(users)  // 不要な複製

  // loaderからのデータを直接使用すべき
  return <List items={users} />
}

// Bad: URLにすべき状態をlocalStorageに保存
function SearchPage() {
  const [query, setQuery] = useState(
    localStorage.getItem('searchQuery') || ''
  )
  // URLに保存してブックマーク可能にすべき
}

// Bad: 過度なグローバル状態
const GlobalContext = createContext({
  user: null,
  products: [],
  cart: [],
  notifications: [],
  theme: 'light',
  // ...すべてを1つのContextに詰め込む
})
```

### 推奨パターン

```typescript
// Good: loaderデータを直接使用
function UserList() {
  const { users } = useLoaderData<typeof loader>()
  return <List items={users} />
}

// Good: 状態を適切に分離
// - サーバーデータ: loader
// - 検索クエリ: URL
// - ローカルUI状態: useState
function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { results } = useLoaderData<typeof loader>()
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  return (
    <div>
      <SearchInput
        value={searchParams.get('q') || ''}
        onChange={q => setSearchParams({ q })}
      />
      <FilterPanel isOpen={isFilterOpen} onToggle={setIsFilterOpen} />
      <Results items={results} />
    </div>
  )
}
```

## 状態管理ライブラリの使用判断

### 標準機能で十分なケース（大半）

- loader/actionでサーバーデータを管理
- useSearchParamsでURL状態を管理
- useState/useReducerでローカル状態を管理
- Contextでグローバル設定を管理

### 外部ライブラリを検討するケース

- 複雑なリアルタイム同期（WebSocket）
- オフラインファースト
- 複数タブ間の状態同期
- 非常に複雑なクライアント状態ロジック

### 推奨ライブラリ（必要な場合）

| ユースケース | ライブラリ |
|-------------|-----------|
| サーバー状態キャッシュ | TanStack Query |
| 軽量グローバル状態 | Zustand |
| 複雑なフォーム | React Hook Form |

## チェックリスト

### 設計時

- [ ] 状態の種類を正しく分類したか
- [ ] URLにすべき状態をURLで管理しているか
- [ ] サーバーデータをloaderで取得しているか
- [ ] 不要なグローバル状態を作っていないか

### 実装時

- [ ] useState/useReducerは最小スコープで使用
- [ ] Contextは本当にグローバルが必要な場合のみ
- [ ] 状態の更新ロジックは明確か

## 関連ドキュメント

- [アーキテクチャ](./architecture.md)
- [API設計](./api-design.md)
- [パフォーマンス](./performance.md)
