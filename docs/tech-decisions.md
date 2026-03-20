# 技術選定理由（Architecture Decision Records）

本ドキュメントでは、アーキテクチャ上の重要な技術選定についてADR形式で記録する。

---

## ADR-001: React Router v7をフレームワークとして採用

### ステータス
採用

### コンテキスト
Webアプリケーションのフレームワーク選定が必要。主な候補：
- Next.js（App Router）
- Remix
- React Router v7

### 決定
React Router v7を採用する。

### 理由

1. **loader/action分離**
   - データ取得（GET）とデータ変更（POST）の責務が明確
   - サーバーサイドロジックを`.server.ts`で分離可能

2. **SSRのシンプルさ**
   - Remixの設計思想を継承しつつ、React Routerとして統合
   - Web標準（FormData, Request/Response）に準拠

3. **Middleware機能（v7.9+）**
   - 認証やテナント切り替えを共通化
   - `future.v8_middleware: true`で有効化

4. **学習コストと移行容易性**
   - React Router v6からの自然な移行パス
   - RemixからReact Routerへの統合により、長期的なサポートが期待

### 代替案と却下理由

| 候補 | 却下理由 |
|------|----------|
| Next.js App Router | Server Componentsの学習コスト、RSCとClient Componentの境界が複雑 |
| Remix | React Router v7への統合により、Remixは事実上React Routerに |

### 結果
loader/actionの分離により、サーバーサイドロジックとUIの責務が明確になった。

---

## ADR-002: Zodによるランタイム検証

### ステータス
採用

### コンテキスト
TypeScriptの型システムはコンパイル時のみ。外部データ（API、DB）のランタイム検証が必要。

### 決定
Zodをスキーマバリデーションライブラリとして採用する。

### 理由

1. **型推論との統合**
   ```typescript
   const userSchema = z.object({
     id: z.string(),
     email: z.string().email(),
   })
   type User = z.infer<typeof userSchema> // 型が自動生成
   ```

2. **satisfies による型整合性保証**
   ```typescript
   type User = { id: string; email: string }
   const userSchema = z.object({...}) satisfies z.ZodType<User>
   // スキーマと型の乖離をコンパイル時に検出
   ```

3. **エラーメッセージの詳細さ**
   - どのフィールドが、なぜ不正かを明確に報告

4. **エコシステム**
   - conform-to/zodでフォームバリデーション統合
   - React Hook Formとの連携

### 代替案と却下理由

| 候補 | 却下理由 |
|------|----------|
| Yup | 型推論がZodほど強力でない |
| io-ts | 関数型スタイルで学習コストが高い |
| Ajv (JSON Schema) | TypeScript型との統合が弱い |

### 結果
外部データの不正をランタイムで検出し、型安全性を実行時にも保証できるようになった。

---

## ADR-003: tsup + tsc ハイブリッドビルド

### ステータス
採用

### コンテキスト
モノレポ内パッケージのビルド方法を決定する必要がある。

### 決定
型定義（.d.ts）生成はtsc、JavaScriptバンドルはtsupで行う。

### 理由

1. **tsupの高速性**
   - esbuildベースで高速なバンドル
   - tree-shakingによる最適化

2. **tscの正確な型定義**
   - tsupのdts生成は複雑な型で不正確になることがある
   - Project Referencesによる増分ビルド

3. **分離による柔軟性**
   - `dts: false`でtsupの型生成を無効化
   - `clean: false`でtscが出力した.d.tsを保持

### ビルドフロー
```
tsc --project tsconfig.build.json  → .d.ts, .d.ts.map
tsup                                → .js, .cjs, .js.map
```

### 代替案と却下理由

| 候補 | 却下理由 |
|------|----------|
| tscのみ | バンドルが遅い、tree-shakingなし |
| tsupのみ | 複雑な型定義で不正確 |
| Rollup | 設定が複雑、tsupの方がシンプル |

### 結果
高速なJSビルドと正確な型定義を両立できた。

---

## ADR-004: npm workspacesによるモノレポ管理

### ステータス
採用

### コンテキスト
複数パッケージを単一リポジトリで管理する方法を決定する。

### 決定
npm workspaces（npm標準機能）を採用する。

### 理由

1. **追加ツール不要**
   - npm 7以降で標準サポート
   - package.jsonのworkspacesフィールドのみで設定

2. **シンプルな依存管理**
   ```json
   { "dependencies": { "@project/domains": "*" } }
   ```
   - `*`指定でローカルパッケージを自動参照

3. **TypeScript Project Referencesとの相性**
   - workspacesとreferencesを組み合わせて依存管理

### 代替案と却下理由

| 候補 | 却下理由 |
|------|----------|
| Turborepo | 小〜中規模では過剰、学習コスト |
| Nx | 設定が複雑、過剰な機能 |
| Lerna | メンテナンス状況、npm workspacesで代替可能 |
| pnpm workspaces | npmの方が広く使われている |

### 結果
追加ツールなしでモノレポを実現。シンプルな構成を維持できた。

---

## ADR-005: Adapter Patternによるデータソース抽象化

### ステータス
採用

### コンテキスト
データベース（Firestore）への依存を抽象化し、テスト容易性と移行可能性を確保したい。

### 決定
DataSourceインターフェースを定義し、Adapterパターンで実装する。

### 理由

1. **テスト容易性**
   ```typescript
   const adapter = new MockAdapter()
   const repository = new UserRepository(adapter)
   // DBなしでテスト可能
   ```

2. **移行容易性**
   ```typescript
   // Firestore → PostgreSQL移行
   const adapter = new PostgresAdapter(pool)
   const repositories = createRepositories(adapter)
   // Repositoryのコードは変更不要
   ```

3. **責務分離**
   - Repository: ドメインロジック、バリデーション
   - Adapter: データソース固有の実装

### インターフェース設計のポイント

```typescript
interface DataSource {
  get(path: string): Promise<Document | null>
  getAll(path: string, options?: QueryOptions): Promise<Document[]>
  set(path: string, data: Record<string, unknown>): Promise<void>
  // ...
}
```

- パス文字列ベースでFirestoreの階層構造に対応
- QueryOptionsで汎用的なクエリを表現
- PostgreSQL等にも適用可能な抽象度

### 代替案と却下理由

| 候補 | 却下理由 |
|------|----------|
| Prisma | Firestoreに対応していない |
| Drizzle | 同上 |
| 直接Firestore SDK使用 | テスト困難、移行困難 |

### 結果
MockAdapterでユニットテストが高速化。将来のPostgreSQL移行への道筋も確保。

---

## ADR-006: Tailwind CSSによるスタイリング

### ステータス
採用

### コンテキスト
UIコンポーネントのスタイリング方法を決定する。

### 決定
Tailwind CSS + CVA（class-variance-authority）を採用する。

### 理由

1. **ユーティリティファースト**
   - クラス名でスタイルを直接記述
   - カスタムCSSファイルの削減

2. **CVAによるVariant管理**
   ```typescript
   const buttonVariants = cva('px-4 py-2 rounded', {
     variants: {
       intent: {
         primary: 'bg-blue-500 text-white',
         secondary: 'bg-gray-200 text-gray-800',
       },
       size: {
         sm: 'text-sm',
         md: 'text-base',
         lg: 'text-lg',
       },
     },
   })
   ```

3. **tailwind-mergeによるクラス競合解決**
   ```typescript
   import { twMerge } from 'tailwind-merge'
   twMerge('px-2 px-4') // → 'px-4'
   ```

4. **パフォーマンス**
   - 使用クラスのみをビルドに含める
   - CSSファイルサイズの最適化

### 代替案と却下理由

| 候補 | 却下理由 |
|------|----------|
| CSS Modules | クラス名の管理が煩雑 |
| styled-components | ランタイムコスト、SSRでの複雑さ |
| Emotion | 同上 |
| vanilla-extract | 学習コスト、Tailwindの方が広く採用 |

### 結果
一貫したスタイリングと高速な開発サイクルを実現。

---

## ADR-007: Vitestによるテスト

### ステータス
採用

### コンテキスト
テストフレームワークを決定する。

### 決定
Vitestを採用する。

### 理由

1. **高速な実行**
   - Viteベースで高速
   - watch modeの起動が速い

2. **ESMネイティブサポート**
   - `type: "module"`のパッケージと相性が良い

3. **Jest互換API**
   - `describe`, `it`, `expect`などJestと同じAPI
   - 移行コストが低い

4. **TypeScriptサポート**
   - 設定不要でTypeScriptをサポート

### 代替案と却下理由

| 候補 | 却下理由 |
|------|----------|
| Jest | ESMサポートが不完全、設定が複雑 |
| Mocha + Chai | 設定が多い、型サポートが弱い |

### 結果
高速なテスト実行と快適な開発体験を実現。

---

## ADR-008: GitHub Actionsによる CI/CD

### ステータス
採用

### コンテキスト
CI/CDパイプラインの実行環境を決定する。

### 決定
GitHub Actionsを採用する。

### 理由

1. **GitHubとの統合**
   - リポジトリと同じ場所でCI/CD管理
   - PRコメント、Checks APIとの連携

2. **キャッシュ機能**
   ```yaml
   - uses: actions/cache@v4
     with:
       path: node_modules
       key: ${{ hashFiles('package-lock.json') }}
   ```

3. **並列実行**
   - matrixビルドで複数環境を並列テスト

4. **無料枠**
   - パブリックリポジトリは無料
   - プライベートでも一定量無料

### CI構成

```yaml
jobs:
  ci:
    steps:
      - Checkout
      - Setup Node.js
      - Cache node_modules
      - npm ci
      - Cache TypeScript build
      - Typecheck
      - Lint
      - Format check
      - Test
```

### 代替案と却下理由

| 候補 | 却下理由 |
|------|----------|
| CircleCI | 別サービス管理、GitHub統合が間接的 |
| Jenkins | セルフホスト管理コスト |
| GitLab CI | GitHubリポジトリとの統合が間接的 |

### 結果
GitHubとシームレスに統合したCI/CDを実現。

---

## 関連ドキュメント

- [アーキテクチャ](./architecture.md)
- [ビルドシステム](./build-system.md)
- [Repositoryパターン](./repository-pattern.md)
