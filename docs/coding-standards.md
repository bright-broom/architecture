# コーディング規約

## 概要

本ドキュメントは、コードの一貫性、可読性、保守性を確保するためのコーディング規約を定義する。
Google TypeScript Style Guide、Microsoft TypeScript Coding Guidelinesを参考に、本プロジェクトに最適化したルールを採用している。

## 基本原則

### 1. 明確性（Clarity）

コードは書く時間より読む時間の方が長い。常に読み手を意識する。

```typescript
// Bad: 意図が不明確
const d = new Date().getTime() - u.c.getTime();

// Good: 変数名で意図を表現
const daysSinceCreation = differenceInDays(new Date(), user.createdAt);
```

### 2. 一貫性（Consistency）

プロジェクト全体で同じスタイルを維持する。

```typescript
// プロジェクト全体で統一すべき項目:
// - 命名規則（camelCase, PascalCase）
// - インポート順序
// - ファイル構造
// - エラーハンドリングパターン
```

### 3. シンプルさ（Simplicity）

過度な抽象化を避け、必要最小限の複雑さに留める。

```typescript
// Bad: 過度な抽象化
class AbstractUserFactoryBuilderStrategy { ... }

// Good: 直接的な実装
function createUser(data: CreateUserInput): User { ... }
```

## 命名規則

### 変数・関数

| 種別             | 規則                    | 例                                           |
| ---------------- | ----------------------- | -------------------------------------------- |
| 変数             | camelCase               | `userName`, `isActive`                       |
| 定数             | SCREAMING_SNAKE_CASE    | `MAX_RETRY_COUNT`, `API_BASE_URL`            |
| 関数             | camelCase, 動詞始まり   | `getUser`, `calculateTotal`, `validateEmail` |
| ブール変数       | is/has/can/should始まり | `isLoading`, `hasError`, `canEdit`           |
| イベントハンドラ | handle/on始まり         | `handleClick`, `onSubmit`                    |

### 型・クラス・インターフェース

| 種別             | 規則                                   | 例                                   |
| ---------------- | -------------------------------------- | ------------------------------------ |
| 型               | PascalCase                             | `User`, `OrderStatus`                |
| インターフェース | PascalCase（I接頭辞なし）              | `DataSource`, `Repository`           |
| クラス           | PascalCase                             | `UserRepository`, `FirestoreAdapter` |
| Enum             | PascalCase（値はSCREAMING_SNAKE_CASE） | `UserRole.ADMIN`                     |
| ジェネリクス     | T, U, V または意味のある名前           | `T`, `TEntity`, `TResult`            |

### ファイル・ディレクトリ

| 種別           | 規則                          | 例                                |
| -------------- | ----------------------------- | --------------------------------- |
| コンポーネント | kebab-case                    | `user-card.tsx`, `button.tsx`     |
| ユーティリティ | kebab-case                    | `date-utils.ts`, `generate-id.ts` |
| 型定義         | kebab-case または `.types.ts` | `user.ts`, `api.types.ts`         |
| テスト         | `.test.ts` 接尾辞             | `user.repository.test.ts`         |
| ディレクトリ   | kebab-case                    | `user-management/`, `ui-core/`    |

## TypeScript規約

### 型定義

```typescript
// 1. 明示的な型注釈を優先（推論に頼りすぎない）
// Bad
const user = await fetchUser(id)

// Good
const user: User | null = await fetchUser(id)

// 2. anyを禁止、unknownを使用
// Bad
function processData(data: any): void { ... }

// Good
function processData(data: unknown): void {
  if (isValidData(data)) {
    // 型が確定してから処理
  }
}

// 3. as よりも型ガードを使用
// Bad
const user = response.data as User

// Good
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'email' in data
  )
}
if (isUser(response.data)) {
  const user = response.data // 型が確定
}

// 4. satisfies を活用して型の整合性を保証
const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
}) satisfies z.ZodType<User>
```

### インポート

```typescript
// 1. type import を使用
import type { User, UserRole } from "@project/domains";
import { userSchema } from "@project/domains";

// 2. インポート順序（ESLint auto-fix対応）
// - Node.js built-in
// - External packages
// - Internal packages (@project/*)
// - Relative imports
// - Type imports

import { readFile } from "node:fs/promises";

import { z } from "zod";
import React from "react";

import { generateId } from "@project/utils";
import type { User } from "@project/domains";

import { Button } from "../components/button";
import type { ButtonProps } from "../components/button";
```

### Null/Undefined処理

```typescript
// 1. Nullish Coalescing (??) を使用
// Bad
const name = user.name || "Anonymous"; // 空文字列もフォールバック

// Good
const name = user.name ?? "Anonymous"; // null/undefinedのみフォールバック

// 2. Optional Chaining (?.) を使用
// Bad
const city = user && user.address && user.address.city;

// Good
const city = user?.address?.city;

// 3. Non-null assertion (!) は避ける
// Bad
const id = user!.id;

// Good
if (user) {
  const id = user.id;
}
// または
const id = user?.id ?? throwError("User is required");
```

### 非同期処理

```typescript
// 1. async/await を使用（Promise chainより可読性が高い）
// Bad
function fetchUser(id: string): Promise<User> {
  return fetch(`/api/users/${id}`)
    .then((res) => res.json())
    .then((data) => data.user);
}

// Good
async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  const data = await res.json();
  return data.user;
}

// 2. 並列実行可能な処理は Promise.all を使用
// Bad（逐次実行）
const user = await fetchUser(userId);
const orders = await fetchOrders(userId);

// Good（並列実行）
const [user, orders] = await Promise.all([
  fetchUser(userId),
  fetchOrders(userId),
]);

// 3. エラーハンドリングを明示
async function fetchUser(id: string): Promise<User> {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) {
      throw new ApiError(`Failed to fetch user: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Network error", { cause: error });
  }
}
```

## React規約

### コンポーネント定義

```typescript
// 1. 関数コンポーネントを使用
// Bad
class UserCard extends React.Component<UserCardProps> { ... }

// Good
const UserCard = ({ user, onEdit }: UserCardProps) => {
  return (...)
}

// 2. Props型を明示的に定義
type UserCardProps = {
  /** ユーザー情報 */
  user: User
  /** 編集コールバック */
  onEdit?: (user: User) => void
  /** カスタムクラス名 */
  className?: string
}

// 3. children の型定義
type LayoutProps = {
  children: React.ReactNode
  sidebar?: React.ReactNode
}

// 4. forwardRef を使用する場合
type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', ...props }, ref) => {
    return <button ref={ref} {...props} />
  }
)
Button.displayName = 'Button'
```

### Hooks

```typescript
// 1. カスタムフックは use 接頭辞
function useUser(id: string): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // ...
  return { user, loading, error };
}

// 2. 依存配列を正確に
useEffect(() => {
  fetchUser(userId);
}, [userId]); // 必要な依存をすべて含める

// 3. useCallback/useMemo は必要な場合のみ
// 不要なメモ化は避ける
const handleClick = () => {
  // シンプルな処理はメモ化不要
};

// 必要な場合のみメモ化
const expensiveValue = useMemo(() => {
  return calculateExpensiveValue(items);
}, [items]);
```

### イベントハンドリング

```typescript
// 1. イベントハンドラの命名
const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault()
  // ...
}

const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value)
}

// 2. インラインハンドラは避ける（テスト容易性のため）
// Bad
<button onClick={() => setCount(count + 1)}>

// Good
const handleIncrement = () => setCount(count + 1)
<button onClick={handleIncrement}>
```

## コメント規約

### JSDoc

```typescript
/**
 * ユーザーを作成する
 *
 * @param data - ユーザー作成データ
 * @returns 作成されたユーザー
 * @throws {ValidationError} データが不正な場合
 *
 * @example
 * const user = await createUser({
 *   email: 'user@example.com',
 *   name: 'John Doe',
 * })
 */
async function createUser(data: CreateUserInput): Promise<User> {
  // ...
}
```

### インラインコメント

```typescript
// 1. なぜそうしているかを説明（何をしているかではなく）
// Bad
// ユーザーを取得
const user = await fetchUser(id);

// Good
// キャッシュを使用して API コールを削減
const user = await cachedFetchUser(id);

// 2. TODO/FIXME は issue 番号と共に
// TODO(#123): パフォーマンス改善のためキャッシュを実装
// FIXME(#456): エッジケースでの null チェックが必要

// 3. 複雑なロジックには説明を
// RFC 5322 に準拠したメールアドレスバリデーション
// 参照: https://tools.ietf.org/html/rfc5322#section-3.4.1
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
```

## ファイル構造

### コンポーネントディレクトリ

```
components/
└── button/
    ├── button.tsx        # メインコンポーネント
    ├── button.test.tsx   # テスト
    ├── button.stories.tsx # Storybook（オプション）
    └── index.ts          # 公開エクスポート
```

### 機能モジュール

```
features/
└── user/
    ├── components/       # 機能固有コンポーネント
    │   └── user-card/
    ├── hooks/           # 機能固有フック
    │   └── use-user.ts
    ├── services/        # API呼び出し等
    │   └── user.service.ts
    ├── types/           # 型定義
    │   └── user.types.ts
    └── index.ts         # 公開API
```

## ESLint / Prettier 設定

### 必須ルール

```javascript
// eslint.config.js
export default [
  {
    rules: {
      // TypeScript
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-non-null-assertion": "error",

      // 一般
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",

      // React
      "react/prop-types": "off", // TypeScriptで代替
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
```

### Prettier設定

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

## コードレビューチェックリスト

レビュー時に確認すべき項目:

- [ ] 命名規則に従っているか
- [ ] 型が適切に定義されているか（any は使用していないか）
- [ ] エラーハンドリングが適切か
- [ ] テストが書かれているか
- [ ] パフォーマンスへの影響は考慮されているか
- [ ] セキュリティ上の問題はないか
- [ ] ドキュメント（JSDoc）が必要な箇所に書かれているか

## 関連ドキュメント

- [アーキテクチャ](./architecture.md)
- [テスト戦略](./testing-strategy.md)
- [エラーハンドリング](./error-handling.md)
