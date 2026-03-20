# 技術選定サマリー（ADR索引）

本ドキュメントは、技術選定の決定事項を一覧化したものです。
詳細な理由は [設計思想.md](./設計思想.md) および [architect.md](./architect.md) を参照してください。

---

## 採用技術一覧

| 分野           | 採用技術           | 却下した代替案                 | 詳細                                                                                                   |
| -------------- | ------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| フレームワーク | React Router v7    | Next.js, Remix                 | [設計思想.md#react-router-v7を採用した理由](./設計思想.md#react-router-v7を採用した理由nextjsとの比較) |
| UIライブラリ   | React 19           | Vue, Svelte                    | [設計思想.md#reactを採用している理由](./設計思想.md#reactを採用している理由)                           |
| バリデーション | Zod                | Yup, io-ts, Ajv                | [architect.md#型システム](./architect.md#型システム)                                                   |
| ビルド         | tsup + tsc         | tscのみ, Rollup                | [build-system.md](./build-system.md)                                                                   |
| モノレポ       | npm workspaces     | Turborepo, Nx, Lerna           | [monorepo-structure.md](./monorepo-structure.md)                                                       |
| データアクセス | Adapter Pattern    | Prisma, 直接SDK                | [repository-pattern.md](./repository-pattern.md)                                                       |
| スタイリング   | Tailwind CSS + CVA | CSS Modules, styled-components | [architect.md#スタイリング](./architect.md#スタイリング)                                               |
| テスト         | Vitest             | Jest, Mocha                    | [architect.md#品質保証戦略](./architect.md#品質保証戦略)                                               |
| CI/CD          | GitHub Actions     | CircleCI, Jenkins              | [architect.md#cicd](./architect.md#cicd)                                                               |
| データベース   | Firestore          | PostgreSQL, MongoDB            | [設計思想.md#適していないプロジェクト](./設計思想.md#適していないプロジェクト)                         |

---

## 主要な設計判断

### 1. Server Components (RSC) を採用しない

**理由**: Context API非互換、テストの複雑さ、既存ライブラリとの互換性問題

**代替策**: React Router v7のloader/actionパターンでSSRを実現

→ 詳細: [設計思想.md#server-componentsを採用しない理由](./設計思想.md#3-server-componentsを採用しない理由)

### 2. Vercel以外でホスティング

**理由**: Google Cloud Run（asia-northeast1）を使用、ベンダーロックイン回避

**影響**: Next.jsの最適化恩恵を受けられないが、デプロイ先の柔軟性を確保

→ 詳細: [設計思想.md#nextjsを採用しなかった理由](./設計思想.md#4-nextjsを採用しなかった理由)

### 3. 型定義とZodスキーマを分離

**理由**: `satisfies`演算子で同期を保証しつつ、役割を明確化

**構成**: `*.ts`（型定義）+ `*.schema.ts`（Zodスキーマ）

→ 詳細: [設計思想.md#typescript型定義戦略](./設計思想.md#typescript型定義戦略)

---

## 関連ドキュメント

- [設計思想.md](./設計思想.md) - テンプレート適合性、技術選定の詳細理由
- [architect.md](./architect.md) - 設計原則、パターン、品質保証
- [build-system.md](./build-system.md) - ビルド設定の詳細
- [monorepo-structure.md](./monorepo-structure.md) - パッケージ構成
- [repository-pattern.md](./repository-pattern.md) - データアクセス層の実装
