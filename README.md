# My Project Template

モノレポ構成のWebアプリケーションテンプレート。

## クイックスタート

```bash
# 依存関係インストール（自動でパッケージビルドも実行）
npm install

# 開発サーバー起動
npm run dev

# http://localhost:3000 でアクセス
```

## コマンド

```bash
npm run dev          # 開発サーバー起動
npm run build        # 本番ビルド
npm run typecheck    # 型チェック
npm run lint         # ESLint
npm run format       # Prettier
npm run test         # テスト実行
npm run check-all    # 全チェック（typecheck + lint + format）
```

## アーキテクチャの特徴

1. **レイヤードアーキテクチャ** - Presentation / Domain / Data層の分離
2. **TypeScript + Zod** - 静的型チェック + ランタイム検証
3. **Repository + Adapter** - データソースの抽象化
4. **React Router v7** - SSR、loader/action分離
5. **tsup + tsc ハイブリッド** - 高速ビルド + 正確な型定義

## ディレクトリ構造

```
my-project/
├── apps/
│   └── web/                 # React Router v7 アプリ
├── packages/
│   ├── config/              # tsconfig, eslint設定
│   ├── domains/             # 型定義 + Zodスキーマ
│   ├── repositories/        # DataSource + Adapter
│   ├── ui-core/             # 汎用UIコンポーネント
│   └── utils/               # ユーティリティ関数
├── scripts/                 # ビルドスクリプト
├── docs/                    # 設計ドキュメント
└── .github/workflows/       # CI/CD
```

## ドキュメント

### アーキテクチャ・設計

| ドキュメント | 内容 |
|-------------|------|
| [architecture.md](./docs/architecture.md) | 全体設計思想、層構造、スケーラビリティ |
| [monorepo-structure.md](./docs/monorepo-structure.md) | パッケージ構成、各パッケージの責務 |
| [build-system.md](./docs/build-system.md) | ビルドフロー、tsconfig構成 |
| [repository-pattern.md](./docs/repository-pattern.md) | データ層設計、Adapter実装 |
| [tech-decisions.md](./docs/tech-decisions.md) | 技術選定理由（ADR形式） |

### 開発ガイドライン

| ドキュメント | 内容 |
|-------------|------|
| [coding-standards.md](./docs/coding-standards.md) | コーディング規約、命名規則、TypeScript/React規約 |
| [testing-strategy.md](./docs/testing-strategy.md) | テストピラミッド、ユニット/統合/E2Eテスト |
| [error-handling.md](./docs/error-handling.md) | エラー分類、ハンドリングパターン、ユーザー向けメッセージ |
| [state-management.md](./docs/state-management.md) | Server/Client/URL状態、React Router活用 |
| [api-design.md](./docs/api-design.md) | API設計、loader/action、バリデーション |
| [accessibility.md](./docs/accessibility.md) | WCAG準拠、セマンティックHTML、ARIA |

### 運用ガイドライン

| ドキュメント | 内容 |
|-------------|------|
| [security.md](./docs/security.md) | 認証/認可、XSS/CSRF対策、セキュリティヘッダー |
| [logging-observability.md](./docs/logging-observability.md) | ログ、メトリクス、トレーシング |
| [performance.md](./docs/performance.md) | フロントエンド/バックエンド最適化、計測 |
| [environment-configuration.md](./docs/environment-configuration.md) | 環境変数管理、型安全な設定 |
| [deployment.md](./docs/deployment.md) | CI/CD、デプロイ戦略、ロールバック |
| [git-conventions.md](./docs/git-conventions.md) | ブランチ戦略、コミット規約、PR |
| [dependency-management.md](./docs/dependency-management.md) | 依存管理、セキュリティ、更新戦略 |

## 技術スタック

- **フレームワーク**: React Router v7
- **言語**: TypeScript
- **バリデーション**: Zod
- **スタイリング**: Tailwind CSS
- **ビルド**: tsup + tsc
- **テスト**: Vitest
- **CI/CD**: GitHub Actions
