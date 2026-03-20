# プロジェクトアーキテクチャ設計思想

このドキュメントでは、プロジェクトプロジェクトの設計思想、アーキテクチャ、技術選定の理由を包括的に説明します。転職活動や他のエンジニアへの説明、他プロジェクトへの転用時の参考資料として活用できます。

---

## 目次

1. [プロジェクト概要](#プロジェクト概要)
2. [設計思想・原則](#設計思想原則)
3. [アーキテクチャ概要](#アーキテクチャ概要)
4. [技術スタック選定理由](#技術スタック選定理由)
5. [設計パターン詳細](#設計パターン詳細)
6. [品質保証戦略](#品質保証戦略)
7. [Claude Code構成](#claude-code構成)
8. [運用・デプロイメント](#運用デプロイメント)
9. [このプロジェクトで得られるスキル](#このプロジェクトで得られるスキル)

---

## プロジェクト概要

### 何を作っているのか

プロジェクトは、土木インフラ点検業務向けのWebアプリケーションです。

| アプリ                         | 対象ユーザー | 主な機能                                     |
| ------------------------------ | ------------ | -------------------------------------------- |
| 内業アプリ (`apps/app`)        | 内業担当者   | 点検結果編集、調書アップロード、レポート出力 |
| 現場アプリ (`apps/inspection`) | 現場作業者   | 構造物確認、損傷図、損傷データ管理           |
| Python API (`python/`)         | システム     | CAD処理（DXF→SVG変換）、データ解析           |

### 解決している課題

1. 紙ベースの点検記録のデジタル化: 現場での入力から調書出力までをシームレスに
2. 複数担当者間のリアルタイム共有: 内業・現場の情報同期
3. 専門的なCADデータの可視化: DXFファイルをWebブラウザで表示
4. マルチテナント対応: 複数の顧客企業が同一システムを利用

### ビジネスコンテキスト

- 業界: 土木インフラ（道路橋、鉄道橋等）
- ユーザー規模: 複数テナント × 複数プロジェクト × 複数構造物
- データ特性: 階層的（テナント → 案件 → 構造物 → 点検 → 損傷）

---

## 設計思想・原則

### 1. 型安全性の徹底（Type Safety First）

思想: コンパイル時とランタイム両方で型を保証し、不正なデータがシステムに入り込む余地を排除する。

実装方法:

```
TypeScript（コンパイル時）
    ↓
Zod スキーマ（ランタイム検証）
    ↓
satisfies 演算子（型とスキーマの同期保証）
```

なぜ重要か:

- Firestoreは型なしのドキュメントDB → 取得データの型安全性は保証されない
- 外部入力（フォーム、API）は常に信頼できない
- 型エラーの早期発見でバグを本番環境に持ち込まない

### 2. SSRファースト（Server-Side Rendering First）

思想: データフェッチはサーバーサイドで行い、クライアントJavaScriptの責務を最小化する。

実装方法:

```
loader（サーバー）→ データ取得
    ↓
Component（クライアント）→ 表示のみ
    ↓
action（サーバー）→ データ変更
```

なぜ重要か:

- 初期表示が高速（SEO、UX向上）
- Firebase Admin SDKをクライアントに含めない（セキュリティ）
- JavaScriptなしでもフォームが動作（プログレッシブエンハンスメント）

### 3. 関心の分離（Separation of Concerns）

思想: 各層・各パッケージは単一の責務を持ち、依存関係は一方向にする。

実装方法:

```
packages/
├── domains/       → ビジネスルール（型、スキーマ、純粋関数）
├── repositories/  → データアクセス（Firestore抽象化）
├── ui-core/       → 汎用UI（Button、Form、Card）
├── ui-features/   → ドメインUI（DamageEditor、StructureList）
├── utils/         → 純粋ユーティリティ（日付、文字列）
└── auth-server/   → 認証ロジック（Firebase Auth）
```

依存関係ルール:

```
utils → domains → repositories → apps
            ↓
         ui-core → ui-features → apps
```

### 4. テスト容易性（Testability）

思想: ビジネスロジックをUIから分離し、単体テストを容易にする。

実装方法:

- Repository層に`MockAdapter`を注入可能
- ドメインロジックは純粋関数として実装
- UIコンポーネントはテスト不要（ロジックがない）

### 5. 漸進的な拡張性（Progressive Enhancement）

思想: 最小限の機能から始め、段階的に機能を追加できる構造にする。

実装方法:

- React Router v7の3モード（declarative → data → framework）
- モノレポでパッケージを後から追加可能
- Firebaseの無料枠でプロトタイプ → スケール

### 6. Web標準準拠（Web Standards）

思想: フレームワーク固有のAPIより、Web標準APIを優先する。

実装方法:

```typescript
// React Router v7: Web標準API
const formData = await request.formData(); // FormData API
const headers = new Headers(); // Headers API
return redirect("/path", { headers }); // Response API
```

なぜ重要か:

- フレームワーク変更時の移行コスト削減
- 学習コストの削減（Web標準は普遍的）
- JavaScriptなしでも動作

---

## アーキテクチャ概要

### レイヤードアーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                   │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │   apps/app      │  │ apps/inspection │              │
│  │  (内業アプリ)    │  │  (現場アプリ)    │              │
│  └────────┬────────┘  └────────┬────────┘              │
└───────────┼────────────────────┼────────────────────────┘
            │                    │
┌───────────┼────────────────────┼────────────────────────┐
│           ▼                    ▼                        │
│  ┌─────────────────────────────────────────────┐       │
│  │              ui-features                     │       │
│  │  (ドメイン固有UIコンポーネント)               │       │
│  └─────────────────────┬───────────────────────┘       │
│                        │                                │
│  ┌─────────────────────▼───────────────────────┐       │
│  │                ui-core                       │       │
│  │  (汎用UIコンポーネント)                       │       │
│  └─────────────────────────────────────────────┘       │
│                    UI Layer                             │
└─────────────────────────────────────────────────────────┘
            │
┌───────────┼─────────────────────────────────────────────┐
│           ▼                                             │
│  ┌─────────────────────────────────────────────┐       │
│  │              repositories                    │       │
│  │  (データアクセス層)                           │       │
│  │  ┌─────────────┐  ┌─────────────┐           │       │
│  │  │FirestoreAdpt│  │ MockAdapter │           │       │
│  │  └─────────────┘  └─────────────┘           │       │
│  └─────────────────────┬───────────────────────┘       │
│                        │                                │
│  ┌─────────────────────▼───────────────────────┐       │
│  │                domains                       │       │
│  │  (ドメインモデル、Zodスキーマ、純粋関数)       │       │
│  └─────────────────────────────────────────────┘       │
│                  Domain Layer                           │
└─────────────────────────────────────────────────────────┘
            │
┌───────────┼─────────────────────────────────────────────┐
│           ▼                                             │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │    Firestore    │  │  Firebase Auth  │              │
│  └─────────────────┘  └─────────────────┘              │
│                Infrastructure Layer                     │
└─────────────────────────────────────────────────────────┘
```

### データフロー

```
1. ブラウザ: GET /structures/:structureId
       │
       ▼
2. Middleware連鎖
   ├── require-auth: 認証チェック → context.set(user)
   └── structure-layout: 構造物検索 → context.set(structure)
       │
       ▼
3. Loader: context.get() でデータ取得
       │
       ▼
4. Component: useLoaderData() で表示
       │
       ▼
5. Form送信: POST
       │
       ▼
6. Action: Zod検証 → Firestore更新
       │
       ▼
7. Revalidation: Loader再実行 → 画面更新
```

### Firestoreデータ構造

```
tenants/{tenantId}
├── name, address, plan, ...
├── projects/{projectId}
│   ├── name, status, ...
│   └── structures/{structureId}
│       ├── name, kind, ...
│       └── inspections/{inspectionId}
│           ├── status, startDate, ...
│           └── damageLocations/{locationId}
│               ├── annotation, entityType, ...
│               └── damageDetails/{detailId}
│                   └── category, severity, ...
└── users/{userId}
    └── name, email, role, ...
```

---

## 技術スタック選定理由

### フロントエンドフレームワーク

#### React 19

| 選定理由     | 詳細                                           |
| ------------ | ---------------------------------------------- |
| エコシステム | 最大規模の開発者プール、豊富なライブラリ       |
| 採用実績     | 大規模組織の68%が採用（2025年）                |
| 後方互換性   | 段階的なアップグレードが可能                   |
| 新機能       | Actions、useOptimistic、use() hookによるUX向上 |

#### React Router v7（Framework Mode）

| 比較項目   | React Router v7    | Next.js       |
| ---------- | ------------------ | ------------- |
| 設計思想   | Web標準準拠        | RSCファースト |
| デプロイ先 | 任意のNode.js環境  | Vercel最適化  |
| 学習曲線   | 既存RR経験者に低い | RSC理解が必要 |

選定理由:

1. Google Cloud Run（非Vercel）でのホスティング
2. Remixからの低コスト移行
3. RSCのContext API非互換問題を回避
4. Web標準準拠による将来の移行容易性

参考: [Comparison | TanStack Start vs Next.js vs React Router](https://tanstack.com/start/latest/docs/framework/react/comparison)

### 状態管理

#### loader/action パターン（サーバー状態）

```typescript
// サーバーでデータ取得
export async function loader({ request }: LoaderFunctionArgs) {
  const data = await repositories.findAll()
  return { data }
}

// クライアントで表示のみ
export default function Component() {
  const { data } = useLoaderData<typeof loader>()
  return <View data={data} />
}
```

選定理由:

- Redux/Zustandのような状態管理ライブラリ不要
- キャッシュ管理不要（React Routerが自動）
- データフェッチとUIの責務分離

#### useState/useMemo（UI状態のみ）

```typescript
const [page, setPage] = useState(1)  // ページネーション
const [isOpen, setIsOpen] = useState(false)  // ダイアログ
const filtered = useMemo(() => data.filter(...), [data])  // 派生データ
```

### 型システム

#### TypeScript（strict mode）

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

選定理由:

- コンパイル時のバグ検出
- IDEサポート（自動補完、リファクタリング）
- チーム開発での型によるコントラクト明示

#### Zod（ランタイム検証）

```typescript
// TypeScriptの型とZodスキーマを同期
export const damageDetailSchema = z.object({
  id: z.string().min(1),
  category: z.string(),
  // ...
}) satisfies z.ZodType<DamageDetail>;
```

選定理由:

- 外部データ（Firestore、フォーム）のランタイム検証
- TypeScriptとの統合（z.infer、satisfies）
- 依存ゼロ、小さなバンドルサイズ

参考: [TypeScript vs Zod: Clearing up validation confusion](https://blog.logrocket.com/when-use-zod-typescript-both-developers-guide/)

### データベース

#### Firestore

| 利点                           | 制限                              |
| ------------------------------ | --------------------------------- |
| サーバーレス、自動スケーリング | 10,000 writes/秒の制限            |
| リアルタイム同期               | 複雑なクエリ不可（OR、NOT、JOIN） |
| 階層的データ構造               | ベンダーロックイン                |
| 無料枠あり                     | 集計クエリが限定的                |

選定理由:

- 階層的なデータ構造（テナント → 案件 → 構造物）に適合
- サーバーレスでインフラ管理不要
- Admin SDK でサーバーサイドからのみアクセス（セキュリティ）

参考: [Usage and limits | Firestore](https://firebase.google.com/docs/firestore/quotas)

### スタイリング

#### Tailwind CSS + CVA

```typescript
const buttonVariants = cva("inline-flex items-center", {
  variants: {
    variant: { contained: "...", outlined: "..." },
    size: { sm: "h-8", md: "h-9", lg: "h-10" },
  },
});
```

選定理由:

- ユーティリティファーストで高速開発
- CVAでvariant管理（型安全）
- PurgeCSSで未使用CSSを自動削除（10KB未満）

参考: [Tailwind CSS Best Practices for Enterprise Projects](https://sanfordev.com/blog/tailwind-best-practices/)

### ビルドツール

#### tsup（JSバンドル）+ tsc（型定義）

```json
{
  "scripts": {
    "build:types": "tsc --project tsconfig.build.json",
    "build:js": "tsup"
  }
}
```

選定理由:

- 役割分担: tsup（高速JSバンドル）、tsc（正確な型定義）
- CJS/ESM両対応
- 設定ファイルが簡潔

#### npm workspaces + Project References

```json
// tsconfig.json
{
  "references": [
    { "path": "./packages/domains/tsconfig.build.json" },
    { "path": "./packages/repositories/tsconfig.build.json" }
  ]
}
```

選定理由:

- 依存関係順の自動ビルド
- 増分ビルド（変更ファイルのみ）
- 追加ツール不要（Nx、Turborepo等）

参考: [Managing TypeScript Packages in Monorepos](https://nx.dev/blog/managing-ts-packages-in-monorepos)

### Python API

#### FastAPI + ezdxf

```python
@router.post("/cad/dxf2svg")
async def convert_dxf_to_svg(file: UploadFile):
    doc = ezdxf.readfile(file)
    # SVG変換処理
    return Response(content=svg_string, media_type="image/svg+xml")
```

選定理由:

- DXF処理ライブラリはPythonが最も充実
- FastAPIの高速な非同期処理
- マイクロサービスとして分離（Node.jsアプリと独立）

---

## 設計パターン詳細

### 1. Repository パターン

目的: データアクセス層を抽象化し、ビジネスロジックからFirestoreの詳細を隠蔽

```typescript
// インターフェース
interface DataSource {
  get(path: string): Promise<Document | null>
  getAll(path: string, options?: QueryOptions): Promise<Document[]>
  set(path: string, data: Record<string, unknown>): Promise<void>
  delete(path: string): Promise<void>
}

// 本番実装
class FirestoreAdapter implements DataSource { ... }

// テスト実装
class MockAdapter implements DataSource { ... }

// Repository
class ProjectRepository extends BaseRepository<Project> {
  constructor(private dataSource: DataSource) { ... }

  async findById(tenantId: string, projectId: string): Promise<Project | null> {
    const doc = await this.dataSource.get(`tenants/${tenantId}/projects/${projectId}`)
    return doc ? projectSchema.parse(doc) : null
  }
}
```

利点:

- テスト時にMockAdapterを注入可能
- Firestore以外のDBへの移行が容易
- Zodスキーマで取得データを常に検証

### 2. Middleware連鎖パターン

目的: 横断的関心事（認証、コンテキスト設定）をloader/actionから分離

```typescript
// layouts/structure-layout/middleware.ts
const structureMiddleware: Route.MiddlewareFunction = async (
  { params, context },
  next,
) => {
  const structure = await repositories.structure.findById(params.structureId);
  context.set(structureContext, { structure });
  return await next();
};

// routes/structures.[structureId]/loader.ts
export async function loader({ context }: LoaderFunctionArgs) {
  const { structure } = context.get(structureContext); // 型安全に取得
  // ...
}
```

利点:

- 認証チェックの重複排除
- コンテキスト情報の型安全な共有
- Pathless Layoutで柔軟な適用範囲

### 3. Intent パターン（フォーム分岐）

目的: 1つのルートで複数のアクションを処理

```typescript
// action.server.ts
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData()
  const intent = formData.get('intent')

  switch (intent) {
    case 'UPDATE_BASIC':
      return handleUpdateBasic(formData)
    case 'CHANGE_PASSWORD':
      return handleChangePassword(formData)
    case 'DELETE_ACCOUNT':
      return handleDeleteAccount(formData)
  }
}

// component.tsx
<Form method="post">
  <input type="hidden" name="intent" value="UPDATE_BASIC" />
  ...
</Form>
```

### 4. スキーマ段階化パターン

目的: CRUD操作ごとに適切なスキーマを提供

```typescript
// 完全スキーマ（読み取り用）
export const projectSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  status: z.enum(["ACTIVE", "ARCHIVED"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// 作成スキーマ（id、timestampsを除外）
export const createProjectSchema = projectSchema.omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
});

// 更新スキーマ（partial）
export const updateProjectSchema = createProjectSchema.partial();

// ドキュメントスキーマ（Firestore保存用）
export const projectDocumentSchema = projectSchema.omit({
  id: true,
  tenantId: true,
});
```

### 5. Toast通知パターン

目的: サーバーアクションの結果をクライアントに通知

```typescript
// サーバー側
const toastHeaders = await createToastHeaders(
  request,
  "success",
  "保存しました",
);
return redirect("/path", { headers: toastHeaders });

// クライアント側（root.tsx）
useEffect(() => {
  const toast = loaderData.toast;
  if (toast) showToast(toast.variant, toast.message);
}, [loaderData.toast]);
```

---

## 品質保証戦略

### テスト戦略

| レイヤー     | テスト対象               | テスト手法                 |
| ------------ | ------------------------ | -------------------------- |
| domains      | 純粋関数、ユーティリティ | 単体テスト（Vitest）       |
| repositories | CRUD操作、バリデーション | 単体テスト（MockAdapter）  |
| ui-core      | UIコンポーネント         | テスト不要（ロジックなし） |
| apps         | loader/action            | 統合テスト（E2E）          |

テスト3種類:

1. 正常系: 期待通りの入出力
2. バリデーション: Zodスキーマ違反でエラー
3. エラーハンドリング: 例外処理の適切性

### コード品質管理

```bash
npm run check-all  # 以下を一括実行
├── npm run typecheck   # TypeScript型チェック
├── npm run lint        # ESLint
├── npm run format      # Prettier
└── npm run test        # Vitest
```

### CI/CD

```yaml
# .github/workflows/ci.yml
- Run TypeScript type check
- Run ESLint
- Check Prettier formatting
- Run test coverage
```

特徴:

- Draft PRはスキップ
- node_modules、.tsbuildinfo をキャッシュ
- カバレッジレポートを成果物として保存

---

## Claude Code構成

このプロジェクトでは、Claude Code（Anthropic公式CLI）を高度にカスタマイズして開発効率を最大化しています。

### 設定ファイル構成

```
.claude/
├── settings.json           # プラグイン、フック、パーミッション設定
├── commands/
│   └── commit-push.md      # コミット・プッシュコマンド
└── skills/
    ├── analyze-refactoring/
    │   ├── SKILL.md        # リファクタリング分析スキル
    │   └── references/
    │       ├── checklist.md
    │       └── plan-template.md
    ├── create-issue/
    │   ├── SKILL.md        # Issue作成スキル
    │   └── references/
    │       └── issue-templates.md
    ├── import-previous-inspection/
    │   └── SKILL.md        # 前回点検インポートスキル
    └── update-docs/
        ├── SKILL.md        # ドキュメント更新スキル
        └── references/
            └── claude-md-guide.md
```

### プラグイン（Plugins）

| プラグイン名        | 目的                                   |
| ------------------- | -------------------------------------- |
| `context7`          | 最新ドキュメント取得（ライブラリ参照） |
| `typescript-lsp`    | TypeScript言語サーバー連携             |
| `code-review`       | コードレビュー支援                     |
| `pr-review-toolkit` | PR レビュー支援                        |
| `feature-dev`       | 機能開発支援                           |

設定場所: `.claude/settings.json`

```json
{
  "enabledPlugins": {
    "context7@claude-plugins-official": true,
    "typescript-lsp@claude-plugins-official": true,
    "code-review@claude-plugins-official": true,
    "pr-review-toolkit@claude-plugins-official": true,
    "feature-dev@claude-plugins-official": true
  }
}
```

### フック（Hooks）

PostToolUse フック: ファイル編集後にPrettierを自動実行

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write \"$CLAUDE_FILE_PATHS\""
          }
        ]
      }
    ]
  }
}
```

効果:

- Claude Codeがファイルを編集/作成するたびに自動フォーマット
- 人間とAIのコードスタイルを統一
- フォーマット忘れを防止

### パーミッション（Permissions）

承認なしで実行可能なコマンドを明示的に許可：

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run:*)",
      "Bash(npm test:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(gh pr view:*)",
      "WebSearch",
      "Skill(*)"
    ]
  }
}
```

設計意図:

- 開発に必要なコマンドの即座実行
- 危険なコマンド（git push --force等）は除外
- 作業フローの中断を最小化

### スキル（Skills）

#### 1. analyze-refactoring（リファクタリング分析）

発動条件: 「リファクタリングしたい」「コード品質を改善したい」「技術的負債を解消したい」

機能:

- コードベース全体を網羅的に調査
- 優先度付きの改善リストを生成
- 設計書テンプレートに基づいた提案

チェック項目（8カテゴリ、計36項目）:

1. 型安全性（anyの使用、as型アサーション、型ガード不足など）
2. エラーハンドリング（try-catch粒度、エラー境界など）
3. パフォーマンス（useMemo/useCallback、N+1クエリなど）
4. セキュリティ（入力検証、dangerouslySetInnerHTMLなど）
5. コード構造（責務分離、ファイルサイズなど）
6. テスト品質（カバレッジ、モック設計など）
7. ドキュメント（CLAUDE.md、README同期など）
8. 依存関係（バージョン管理、循環依存など）

参照ファイル:

- `.claude/skills/analyze-refactoring/references/checklist.md`
- `.claude/skills/analyze-refactoring/references/plan-template.md`

#### 2. create-issue（GitHub Issue作成）

発動条件: 「issueを作って」「バグを報告して」「機能リクエストを登録して」

機能:

- コンテキストから適切なIssue内容を自動検出
- テンプレートに基づいたフォーマット
- ラベル自動付与（bug, feature, refactor等）

対応テンプレート:

- バグ報告（bug）
- 機能リクエスト（feature）
- リファクタリング提案（refactor）
- ドキュメント改善（docs）
- パフォーマンス改善（performance）
- テスト追加（test）

参照ファイル: `.claude/skills/create-issue/references/issue-templates.md`

#### 3. import-previous-inspection（前回点検インポート）

発動条件: 「PDFから点検データをインポートしたい」「前回点検を取り込みたい」

機能:

- 点検調書PDF（Excel方眼紙をPDF化したもの）をマルチモーダルで読み取り
- Firestoreへのデータ投入用マイグレーションスクリプトを生成
- Zodバリデーション込みの型安全なスクリプト

生成ファイル:

```
scripts/migrations/YYYY-MM-DD_import-previous-inspection-{structure-name}.ts
```

特徴:

- `--staging`オプションでステージング環境対応
- `--dry-run`オプションで事前確認可能
- 「レビュー対象」セクションでPDF抽出データを明示

#### 4. update-docs（ドキュメント更新）

発動条件: 「CLAUDE.mdを更新して」「READMEを最新化して」「ドキュメントを整理して」

機能:

- CLAUDE.md、README.mdの最新化
- package.jsonとの整合性確認
- 冗長な情報の削除、重要情報の優先配置

CLAUDE.md最適化ガイドライン:

- 目標行数: 250-350行
- 構成: 最重要ルール → クイックリファレンス → システム概要 → 開発ワークフロー
- 削除対象: 詳細な型定義リスト、50行超の実装例、重複情報

参照ファイル: `.claude/skills/update-docs/references/claude-md-guide.md`

### コマンド（Commands）

#### commit-push（コミット・プッシュ）

発動方法: `/commit-push` または「コミットしてプッシュして」

機能:

- 変更内容の論理的グルーピング
- 適切なコミットメッセージ自動生成
- 連続したコミットとプッシュの実行

ワークフロー:

1. `git status`で変更ファイルを確認
2. 変更を論理単位でグルーピング
3. 各グループに対してコミットメッセージを生成
4. 順次コミット実行
5. リモートにプッシュ

### 推奨する追加設定

最新のClaude Code機能（2025年10月以降）に基づく推奨追加設定：

#### 1. MCP（Model Context Protocol）サーバー

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@anthropic/claude-mcp-server-filesystem",
        "/path/to/allowed/dir"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/claude-mcp-server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

効果: ファイルシステムやGitHub APIへの直接アクセス

#### 2. PreToolUse フック（確認プロンプト）

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "confirm",
            "message": "Execute: $CLAUDE_COMMAND?"
          }
        ]
      }
    ]
  }
}
```

効果: 危険なコマンド実行前の確認

#### 3. テスト自動実行フック

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "npm run test -- --related $CLAUDE_FILE_PATHS --passWithNoTests"
          }
        ]
      }
    ]
  }
}
```

効果: ファイル編集後に関連テストを自動実行

#### 4. 追加推奨スキル

| スキル名         | 目的                                   |
| ---------------- | -------------------------------------- |
| `review-pr`      | PRの自動レビュー（セキュリティ、品質） |
| `generate-tests` | テストコード自動生成                   |
| `db-migration`   | データベースマイグレーション支援       |
| `api-docs`       | OpenAPI/Swagger仕様書生成              |

### Claude Code活用の設計思想

1. 自動化の最大化: 繰り返し作業（フォーマット、テスト、コミット）を自動化
2. コンテキスト理解: CLAUDE.mdで一貫した指示を維持
3. 型安全性の強制: TypeScript LSPプラグインでリアルタイム型チェック
4. 品質ゲート: フックでコード品質を自動担保
5. ドメイン知識の蓄積: スキルに業務固有のワークフローを定義

---

## 運用・デプロイメント

### デプロイ先

| 環境       | URL                                             | インフラ  |
| ---------- | ----------------------------------------------- | --------- |
| Production | app.プロジェクト.jp, inspection.プロジェクト.jp | Cloud Run |
| Staging    | staging.app.プロジェクト.jp                     | Cloud Run |
| Local      | localhost:3001, localhost:3002                  | Node.js   |

### 環境変数管理

- 本番: Cloud Run環境変数、Secret Manager
- ローカル: .env.local（gitignore）

### セキュリティ

| 対策     | 実装                       |
| -------- | -------------------------- |
| 認証     | Firebase Auth（Admin SDK） |
| 認可     | テナントID単位のデータ分離 |
| 入力検証 | Zodスキーマで全入力を検証  |
| XSS対策  | Reactの自動エスケープ      |
| CSRF対策 | SameSite Cookie            |

---

## このプロジェクトで得られるスキル

### 技術スキル

| カテゴリ       | スキル                                                   |
| -------------- | -------------------------------------------------------- |
| フロントエンド | React 19、React Router v7（SSR）、TypeScript strict mode |
| 状態管理       | loader/actionパターン、Middleware連鎖                    |
| 型システム     | Zod、satisfies演算子、Project References                 |
| スタイリング   | Tailwind CSS 4、CVA、デザインシステム構築                |
| バックエンド   | Firebase Admin SDK、Firestore設計                        |
| テスト         | Vitest、MockAdapterパターン、カバレッジ管理              |
| ビルド         | tsup/tsc分離、npm workspaces、増分ビルド                 |
| CI/CD          | GitHub Actions、Cloud Build                              |
| Python         | FastAPI、非同期処理、CADデータ処理                       |

### アーキテクチャスキル

| スキル                   | 詳細                                       |
| ------------------------ | ------------------------------------------ |
| モノレポ設計             | パッケージ分割戦略、依存関係管理           |
| レイヤードアーキテクチャ | Presentation/Domain/Infrastructure層の分離 |
| DDD                      | エンティティ、集約、値オブジェクトの設計   |
| DIパターン               | Adapterパターン、テスト容易性の確保        |
| SSR設計                  | loader/action、Middleware、Context共有     |

### AI支援開発スキル

| スキル               | 詳細                                       |
| -------------------- | ------------------------------------------ |
| Claude Code設定      | プラグイン、フック、パーミッションの最適化 |
| カスタムスキル開発   | ドメイン固有ワークフローの自動化           |
| CLAUDE.md設計        | AIへの効果的な指示書作成                   |
| MCP連携              | Model Context Protocolによるツール拡張     |
| AI駆動コードレビュー | 自動品質チェック、セキュリティスキャン     |

### ソフトスキル

| スキル           | 詳細                           |
| ---------------- | ------------------------------ |
| 技術選定         | トレードオフを考慮した意思決定 |
| ドキュメント作成 | CLAUDE.md、設計ドキュメント    |
| コードレビュー   | PR Review、CI/CD設計           |
| チーム開発       | パッケージ境界による責務分担   |

---

## 転職活動でのアピールポイント

### 1. 設計力

> 「型安全性を最優先に、TypeScript strict modeとZodによるランタイム検証を組み合わせ、外部データの型安全性を保証する設計を行いました。satisfies演算子で型とスキーマの同期を強制し、ドメインモデル変更時の漏れを防いでいます。」

### 2. アーキテクチャ経験

> 「React Router v7のSSRを採用し、loader/actionパターンでサーバーサイドデータフェッチを実装しました。Middleware連鎖パターンで認証・認可を横断的に処理し、loaderの責務を最小化しています。」

### 3. モノレポ運用

> 「npm workspacesとTypeScript Project Referencesでモノレポを構築し、packages/（共有ライブラリ）とapps/（アプリケーション）を分離しました。依存関係順の段階的ビルドで、ビルド時間を最適化しています。」

### 4. テスト戦略

> 「Repository層にMockAdapterパターンを導入し、Firestoreに依存しない単体テストを実現しました。正常系・バリデーション・エラーハンドリングの3種類のテストで、ビジネスロジックの品質を保証しています。」

### 5. 技術選定の理由

> 「Next.jsではなくReact Router v7を選定した理由は、(1) Cloud Runでのホスティング（非Vercel）、(2) RSCのContext API非互換問題の回避、(3) Web標準準拠による将来の移行容易性です。」

### 6. AI支援開発の実践

> 「Claude Codeを活用したAI支援開発環境を構築しました。カスタムスキル（リファクタリング分析、Issue作成、ドキュメント更新等）を開発し、ドメイン固有のワークフローを自動化しています。PostToolUseフックでPrettierを自動実行し、コードスタイルの一貫性を担保。CLAUDE.mdで250-350行の最適化された指示書を維持し、AIとの協働品質を最大化しています。」

---

## 関連ドキュメント

- [テンプレート適合性ガイド](./設計思想.md) - どのプロジェクトに適しているか
- [技術選定サマリー](./tech-decisions.md) - 採用技術と却下理由
- [ビルドシステム](./build-system.md) - ビルド設定の詳細
- [モノレポ構造](./monorepo-structure.md) - パッケージ構成
- [Repositoryパターン](./repository-pattern.md) - データアクセス層の実装

---

最終更新: 2026-03-20
