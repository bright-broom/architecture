# ビルドシステム

## 概要

TypeScript Project Referencesとtsupを組み合わせたハイブリッドビルドシステム。
型定義生成（tsc）とJavaScriptバンドル（tsup）を分離し、それぞれの利点を活かす。

## 設計の背景

### 課題

1. **tscのみ**: バンドルが遅い、tree-shakingが効かない
2. **tsupのみ**: 型定義（.d.ts）生成が不正確になることがある
3. **モノレポ**: パッケージ間の依存順序を考慮したビルドが必要

### 解決策

```
tsc → 型定義（.d.ts）を正確に生成
tsup → JavaScriptを高速バンドル
postinstall → 依存順序を制御した並列ビルド
```

## tsconfig構成

### 2つのtsconfigの役割分担

```
packages/domains/
├── tsconfig.json        # 開発時の型チェック用
└── tsconfig.build.json  # ビルド時の型定義出力用
```

### tsconfig.json（開発用）

```json
{
  "extends": "../config/tsconfig/base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**役割**: 開発時のリアルタイム型チェック。出力はしない。

### tsconfig.build.json（ビルド用）

```json
{
  "extends": "../config/tsconfig/build.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./dist/.tsbuildinfo",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"],
  "references": [{ "path": "../utils/tsconfig.build.json" }]
}
```

**役割**: 型定義ファイル（.d.ts）の生成。増分ビルドに対応。

### ルートtsconfig.json（Project References）

```json
{
  "files": [],
  "references": [
    { "path": "./packages/utils/tsconfig.build.json" },
    { "path": "./packages/domains/tsconfig.build.json" },
    { "path": "./packages/repositories/tsconfig.build.json" },
    { "path": "./packages/ui-core/tsconfig.build.json" },
    { "path": "./packages/ui-features/tsconfig.build.json" },
    { "path": "./apps/web/tsconfig.app.json" }
  ]
}
```

**役割**: `tsc -b`で全パッケージを依存順にビルド。

## tsup設定

### tsup.config.ts

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: false, // tscで生成した型定義を使用
  sourcemap: true,
  clean: false, // distを削除しない（型定義を保持）
});
```

**ポイント**:

- `dts: false` - tsupの型定義生成を無効化（tscに任せる）
- `clean: false` - tscが先に出力した.d.tsを削除しない
- `format: ['cjs', 'esm']` - CommonJSとESModules両対応

## ビルドフロー

### npm install時（postinstall）

```
1. utils       → build:types → build:js
2. domains     → build:types → build:js（utilsに依存）
3. ui-core     → build:types → build:js → build:css
4. repositories → build（domainsに依存）
5. ui-features → build（ui-core, domainsに依存）
```

### postinstall.mts

```typescript
import concurrently from "concurrently";

// Step 1: 依存のないパッケージから先にビルド
await concurrently([
  { command: "npm:build:types -w @project/utils", name: "utils" },
]).result;

// Step 2: utilsに依存するパッケージ
await concurrently([
  { command: "npm:build:types -w @project/domains", name: "domains" },
]).result;

// Step 3: 並列ビルド可能なパッケージ
await concurrently([
  { command: "npm:build:js -w @project/utils", name: "utils" },
  { command: "npm:build:js -w @project/domains", name: "domains" },
  { command: "npm:build:types -w @project/ui-core", name: "ui-core" },
]).result;

// ... 続く
```

**設計意図**:

- 依存関係を考慮した順序でビルド
- 可能な限り並列実行で高速化
- `concurrently`でログを見やすく整理

## 出力構成

### ビルド後のdist/

```
packages/domains/dist/
├── index.js          # ESModule
├── index.cjs         # CommonJS
├── index.d.ts        # 型定義
├── index.js.map      # ソースマップ
└── .tsbuildinfo      # 増分ビルド情報
```

### package.jsonのexports

```json
{
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

## 増分ビルド

### tsBuildInfoFile

各パッケージのtsconfig.build.jsonで設定：

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./dist/.tsbuildinfo"
  }
}
```

**効果**: 変更のないファイルはスキップし、ビルド時間を短縮。

### CIでのキャッシュ

```yaml
- name: Cache TypeScript build info
  uses: actions/cache@v4
  with:
    path: |
      packages/*/.tsbuildinfo
      packages/*/dist
    key: ${{ runner.os }}-tsbuild-${{ hashFiles('packages/*/src/**') }}
```

## 型チェック（typecheck）

### typecheckスクリプト

```typescript
// scripts/typecheck.mts
import { execSync } from "child_process";

// React Routerの型生成（appsのみ）
execSync("npx react-router typegen", { cwd: "apps/web" });

// Project Referencesで全パッケージをチェック
execSync("tsc -b");

// 各パッケージのtsconfig.jsonでも検証
execSync("tsc --project packages/domains/tsconfig.json --noEmit");
// ...
```

**なぜ2段階か**:

- `tsc -b`はビルド用tsconfigで検証
- 開発用tsconfigには異なる設定がある場合があるため、両方でチェック

## 開発サーバー（dev）

### dev.mts

```typescript
import concurrently from "concurrently";

// 全パッケージのwatchモードを並列起動
await concurrently([
  { command: "npm:dev -w @project/domains", name: "domains" },
  { command: "npm:dev -w @project/ui-core", name: "ui-core" },
  { command: "npm:dev -w @project/web", name: "web" },
  // ...
]);
```

各パッケージのdev:

- `tsup --watch` でJSを監視
- アプリは`react-router dev`で起動

## トラブルシューティング

### 型エラーが解消されない

```bash
# 増分ビルドキャッシュをクリア
npm run clean:tsbuildinfo
npm run typecheck
```

### distが古い

```bash
# ビルド出力をクリアして再ビルド
npm run clean:build
npm install
```

## 関連ドキュメント

- [モノレポ構造](./monorepo-structure.md) - パッケージ構成
- [設計思想](./architect.md) - 全体設計
- [技術選定サマリー](./tech-decisions.md) - 技術選定一覧
