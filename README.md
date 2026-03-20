# My Project Template

モノレポ構成のWebアプリケーションテンプレート。モダンなフロントエンド開発のベストプラクティスを集約。

---

## 目次

- [クイックスタート](#クイックスタート)
- [このプロジェクトで実践したこと](#このプロジェクトで実践したこと)
- [技術スタックと選定理由](#技術スタックと選定理由)
- [アーキテクチャ](#アーキテクチャ)
- [実装パターンと工夫点](#実装パターンと工夫点)
- [品質保証](#品質保証)
- [面接想定Q&A](#面接想定qa)
- [コードサンプル](#コードサンプル)
- [ドキュメント](#ドキュメント)

---

## クイックスタート

```bash
# 依存関係インストール（自動でパッケージビルドも実行）
npm install

# 開発サーバー起動
npm run dev

# http://localhost:3000 でアクセス
```

### コマンド一覧

```bash
npm run dev          # 開発サーバー起動
npm run build        # 本番ビルド
npm run typecheck    # 型チェック
npm run lint         # ESLint
npm run format       # Prettier
npm run test         # テスト実行
npm run check-all    # 全チェック（typecheck + lint + format）
```

---

## このプロジェクトで実践したこと

### 設計・アーキテクチャ

| 実践内容                     | 詳細                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| **レイヤードアーキテクチャ** | Presentation / Domain / Data 層の明確な分離                    |
| **Repository Pattern**       | DataSource インターフェースによるデータアクセスの抽象化        |
| **モノレポ設計**             | npm workspaces + TypeScript Project References                 |
| **依存関係の方向制御**       | 循環依存を防ぎ、各層を独立してテスト可能に                     |
| **エラー分類設計**           | ドメインエラー / インフラエラー / プログラミングエラーの明確化 |

### 型安全性

| 実践内容                     | 詳細                                        |
| ---------------------------- | ------------------------------------------- |
| **TypeScript strict mode**   | 厳密な型チェックで実行前にバグを検出        |
| **Zod によるランタイム検証** | 外部データ（API、DB）の実行時バリデーション |
| **satisfies 演算子**         | 型定義と Zod スキーマの同期を強制           |
| **型ガード関数**             | `isNumber`, `isArray` 等で安全な型絞り込み  |
| **noUncheckedIndexedAccess** | 配列・オブジェクトアクセスの安全性向上      |

### コード品質

| 実践内容                 | 詳細                               |
| ------------------------ | ---------------------------------- |
| **ESLint 9 Flat Config** | モダンな設定形式で TypeScript 統合 |
| **Prettier**             | 一貫したコードフォーマット         |
| **Vitest**               | 高速な単体テスト                   |
| **MockAdapter パターン** | DB に依存しないテスト設計          |

### CI/CD・自動化

| 実践内容           | 詳細                                            |
| ------------------ | ----------------------------------------------- |
| **GitHub Actions** | PR ごとに typecheck / lint / format / test 実行 |
| **キャッシュ戦略** | node_modules、.tsbuildinfo で CI 時間短縮       |
| **増分ビルド**     | Project References で変更ファイルのみ再ビルド   |

---

## 技術スタックと選定理由

### フレームワーク: React Router v7

**選定理由:**

1. **SSR 対応**: loader/action パターンでサーバーサイドデータ取得
2. **Web 標準準拠**: FormData, Request/Response 等の標準 API 使用
3. **デプロイ柔軟性**: Vercel 以外（Cloud Run 等）でも最適動作
4. **シンプルさ**: RSC の複雑さを回避、既存ライブラリとの高い互換性

**Next.js を選ばなかった理由:**

- RSC（React Server Components）の学習コストと互換性問題
- Vercel 以外でのデプロイ時に最適化恩恵が減少

### バリデーション: Zod

**選定理由:**

1. **型推論**: `z.infer<typeof schema>` で型を自動生成
2. **satisfies 演算子**: 型定義とスキーマの乖離をコンパイル時に検出
3. **詳細なエラー**: フィールドごとの検証エラーを明確に報告

```typescript
// 型とスキーマの同期を強制
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
}) satisfies z.ZodType<User>;
```

### ビルド: tsup + tsc ハイブリッド

**選定理由:**

| ツール | 役割        | 特徴                   |
| ------ | ----------- | ---------------------- |
| tsup   | JS バンドル | 高速（esbuild ベース） |
| tsc    | 型定義生成  | 正確な .d.ts 出力      |

- 役割分担で高速化と正確性を両立
- CJS/ESM 両対応

### モノレポ: npm workspaces + Project References

**選定理由:**

- **追加ツール不要**: Nx、Turborepo なしでモノレポ管理
- **増分ビルド**: 変更ファイルのみ再ビルドで CI 高速化
- **依存関係順ビルド**: `tsc -b` で自動的に正しい順序でビルド

---

## アーキテクチャ

### レイヤー構成

```
┌─────────────────────────────────────┐
│         Presentation Layer          │  apps/web（React Router）
│         └── loader / action         │
├─────────────────────────────────────┤
│            UI Layer                 │  ui-core（Button, Form 等）
├─────────────────────────────────────┤
│           Domain Layer              │  domains（型定義、スキーマ、純粋関数）
├─────────────────────────────────────┤
│            Data Layer               │  repositories（Repository Pattern）
├─────────────────────────────────────┤
│       Infrastructure Layer          │  Firestore, Firebase Auth
└─────────────────────────────────────┘
```

### ディレクトリ構造

```
my-project/
├── apps/
│   └── web/                    # React Router v7 アプリ
├── packages/
│   ├── config/                 # 共有設定（TypeScript, ESLint）
│   ├── domains/                # 型定義 + Zod スキーマ + エラークラス
│   ├── repositories/           # DataSource + Adapter（Repository Pattern）
│   ├── ui-core/                # 汎用 UI コンポーネント
│   └── utils/                  # ユーティリティ関数
├── scripts/                    # ビルド・開発スクリプト
├── docs/                       # 設計ドキュメント
└── .github/workflows/          # CI/CD
```

### 依存関係ルール

```
utils（依存なし）
  ↓
domains（utils のみ使用可）
  ↓
repositories（domains, utils 使用可）
  ↓
apps/web（全パッケージ使用可）

ui-core（独立、domains 等に依存しない）
```

**この設計のメリット:**

- 循環依存を防止
- 各層を独立してテスト可能
- 下位層の変更が上位層に影響しにくい

---

## 実装パターンと工夫点

### 1. Repository Pattern

**目的:** データアクセスの抽象化によるテスト容易性と移行容易性

```typescript
// インターフェース定義
interface DataSource {
  get(path: string): Promise<Document | null>;
  getAll(path: string, options?: QueryOptions): Promise<Document[]>;
  set(path: string, data: Record<string, unknown>): Promise<void>;
  // ...
}

// 本番: FirestoreAdapter
// テスト: MockAdapter
```

**メリット:**

- テスト時に MockAdapter を注入 → DB 不要で高速テスト
- Firestore から別 DB への移行が容易

### 2. エラーハンドリング

**エラーの分類:**

```typescript
// ドメインエラー（予測可能、ユーザーに通知）
export class ValidationError extends Error { ... }
export class NotFoundError extends Error { ... }

// インフラエラー（リトライ可能性あり）
export class RepositoryError extends Error {
  constructor(operation: string, entityName: string, cause?: unknown) {
    super(`Failed to ${operation} ${entityName}: ${causeMessage}`);
    this.cause = cause;  // エラーチェーン保持
  }
}
```

### 3. 型安全なスキーマ設計

```typescript
// 型定義
type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

// Zod スキーマ（satisfies で型同期を強制）
export const userSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(["admin", "user"]),
  createdAt: z.date(),
  updatedAt: z.date(),
}) satisfies z.ZodType<User>;

// CRUD 用スキーマの派生
const systemFieldsToOmit = {
  id: true,
  createdAt: true,
  updatedAt: true,
} as const;
export const createUserSchema = userSchema.omit(systemFieldsToOmit);
export const updateUserSchema = userSchema.omit(systemFieldsToOmit).partial();
```

### 4. 型ガード関数

```typescript
function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// 使用例: クエリ条件のマッチング
function matchesCondition(doc: Document, condition: QueryCondition): boolean {
  if (condition.operator === ">") {
    return (
      isNumber(doc[condition.field]) &&
      isNumber(condition.value) &&
      doc[condition.field] > condition.value
    );
  }
  // ...
}
```

### 5. ID 生成戦略

```typescript
export const generateId = (prefix: string): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
};
// 結果例: "user_1f2h4k8jk9a0b1c2"
```

**特徴:** プレフィックス付き、タイムスタンプベース（ソート可能）、UUID より短い

---

## 品質保証

### TypeScript 設定

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

| オプション                 | 効果                                    |
| -------------------------- | --------------------------------------- |
| `strict`                   | 全ての厳密チェック有効                  |
| `noUncheckedIndexedAccess` | 配列アクセス時の undefined チェック強制 |
| `noImplicitOverride`       | override キーワードの明示強制           |

### CI/CD パイプライン

```yaml
# .github/workflows/ci.yml
- TypeScript 型チェック
- ESLint
- Prettier フォーマットチェック
- Vitest 単体テスト
- ドラフト PR はスキップ（効率化）
- キャッシュ: node_modules, .tsbuildinfo
```

### テスト戦略

| レベル | 対象                      | ツール             |
| ------ | ------------------------- | ------------------ |
| 単体   | utils, domains の純粋関数 | Vitest             |
| 統合   | Repository + MockAdapter  | Vitest             |
| E2E    | ブラウザ操作              | Playwright（推奨） |

---

## 面接想定Q&A

### Q1: なぜ TypeScript strict mode を使うのか？

> 「strict mode では any 型の使用禁止、null/undefined チェックの強制が有効になります。
> このプロジェクトでは Zod との組み合わせで、コンパイル時とランタイムの両方で型を保証しています。
> 特に Firestore 等の外部データソースから取得したデータの型安全性が確保できます。」

### Q2: Repository Pattern のメリットは？

> 「主に3つあります。
> 第1に、テスト時に MockAdapter を注入することで、DB に依存しない高速なテストが可能です。
> 第2に、DataSource インターフェースを実装するだけで、Firestore から PostgreSQL への移行が容易です。
> 第3に、バリデーションやドメインモデルへの変換を Repository 層に集約することで、各層の責務が明確になります。」

### Q3: satisfies 演算子の価値は？

> 「satisfies 演算子により、TypeScript の型定義と Zod スキーマが必ず同期されます。
> 例えば、User 型に新しいフィールドを追加した場合、userSchema の定義も同時に修正が強制されます。
> これにより、型定義の変更がランタイム検証に反映されないバグを事前に防げます。」

### Q4: npm workspaces と Project References の組み合わせは？

> 「npm workspaces でパッケージ間の依存関係を管理し、TypeScript Project References で依存関係順の増分ビルドを実現しています。
> これにより、Nx や Turborepo のような外部ツール不要で、複雑なモノレポ構成を効率的に管理できます。」

### Q5: React Router v7 を選んだ理由は？

> 「3つの理由があります。
> 第1に、Cloud Run 等 Vercel 以外でホスティングするため、Next.js の最適化恩恵が少ないこと。
> 第2に、RSC は既存ライブラリとの互換性問題があること。
> 第3に、Web 標準 API に準拠することで、フレームワーク変更時の移行コストを最小化できます。」

### Q6: エラーハンドリングの設計思想は？

> 「エラーを3つに分類しています。
> 第1に、ドメインエラー（ValidationError 等）は予測可能でユーザーに通知します。
> 第2に、インフラエラー（RepositoryError 等）は外部サービス失敗で、リトライを検討できます。
> 第3に、プログラミングエラーはバグなので修正が必須です。
> この分類により、適切なエラー処理戦略を適用できます。」

### Q7: CI/CD で工夫した点は？

> 「GitHub Actions のキャッシュを node_modules と .tsbuildinfo に適用し、CI 実行時間を短縮しています。
> 特に tsbuildinfo キャッシュにより、変更ファイルだけの増分型チェックが可能で、フィードバック速度が向上します。
> また、ドラフト PR はスキップすることで、無駄な CI 実行を削減しています。」

---

## コードサンプル

### 型安全なバリデーション

```typescript
const result = userSchema.safeParse(data);
if (!result.success) {
  throw new ValidationError("Invalid user data");
}
return result.data; // User 型として完全に型安全
```

### テスト容易な Repository

```typescript
// テスト時のセットアップ
const mockAdapter = new MockAdapter();
const userRepository = new UserRepository(mockAdapter);

// テストケース
it("新規ユーザーを作成できる", async () => {
  const user = await userRepository.create({
    email: "test@example.com",
    name: "Test User",
    role: "user",
  });

  expect(user.id).toBeDefined();
  expect(user.createdAt).toBeInstanceOf(Date);
});
```

### loader/action パターン

```typescript
// loader: データ取得（GET）
export async function loader({ params }: LoaderFunctionArgs) {
  const user = await getRepositories().user.findById(params.id!);
  if (!user) throw new Response("Not Found", { status: 404 });
  return { user };
}

// action: データ変更（POST）
export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const result = updateUserSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return json(
      { errors: result.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  await getRepositories().user.update(params.id!, result.data);
  return redirect(`/users/${params.id}`);
}
```

---

## ドキュメント

| ドキュメント                                          | 内容                               |
| ----------------------------------------------------- | ---------------------------------- |
| [architect.md](./docs/architect.md)                   | 設計原則、パターン、品質保証       |
| [設計思想.md](./docs/設計思想.md)                     | テンプレート適合性、技術選定理由   |
| [tech-decisions.md](./docs/tech-decisions.md)         | 技術選定サマリー（ADR 索引）       |
| [monorepo-structure.md](./docs/monorepo-structure.md) | パッケージ構成、各パッケージの責務 |
| [build-system.md](./docs/build-system.md)             | ビルドフロー、tsconfig 構成        |
| [repository-pattern.md](./docs/repository-pattern.md) | データ層設計、Adapter 実装         |

---

## 技術スタック一覧

| カテゴリ       | 技術                       |
| -------------- | -------------------------- |
| フレームワーク | React 19, React Router v7  |
| 言語           | TypeScript 5 (strict mode) |
| バリデーション | Zod                        |
| スタイリング   | Tailwind CSS v4, CVA       |
| ビルド         | tsup, tsc, Vite            |
| テスト         | Vitest                     |
| リンター       | ESLint 9 (Flat Config)     |
| フォーマッター | Prettier                   |
| CI/CD          | GitHub Actions             |
| パッケージ管理 | npm workspaces             |

---

## アピールポイントまとめ

1. **設計力**: 型安全性を最優先に、コンパイル時 + ランタイムの二重検証
2. **アーキテクチャ経験**: モノレポ設計、レイヤードアーキテクチャ、SSR
3. **技術選定の理由付け**: 各技術のトレードオフを理解した上での選択
4. **テスト戦略**: MockAdapter パターンで DB に依存しないテスト設計
5. **品質保証**: CI/CD パイプライン構築、キャッシュ戦略で最適化
6. **ドキュメント作成**: 詳細な設計思想と技術選定理由の文書化
