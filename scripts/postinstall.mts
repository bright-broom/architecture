import concurrently from 'concurrently'
import { packages } from './packages.mts'

const runOptions = {
  prefix: '[{time}:{name}]',
  timestampFormat: 'HH:mm:ss',
  killOthersOn: ['failure'] as const,
}

// Step 1: utilsの型定義を生成
await concurrently(
  [
    {
      command: 'npm run build:types -w @my-project/utils',
      ...packages.utils,
    },
  ],
  runOptions,
).result.catch(() => process.exit(1))

// Step 2: domainsの型定義を生成（utilsに依存）
await concurrently(
  [
    {
      command: 'npm run build:types -w @my-project/domains',
      ...packages.domains,
    },
  ],
  runOptions,
).result.catch(() => process.exit(1))

// Step 3: 並列ビルド可能なパッケージ
await concurrently(
  [
    {
      command: 'npm run build:js -w @my-project/utils',
      ...packages.utils,
    },
    {
      command: 'npm run build:js -w @my-project/domains',
      ...packages.domains,
    },
    {
      command: 'npm run build:types -w @my-project/ui-core',
      ...packages.uiCore,
    },
  ],
  runOptions,
).result.catch(() => process.exit(1))

// Step 4: UIコアのJS/CSSビルド
await concurrently(
  [
    {
      command: 'npm run build:js -w @my-project/ui-core',
      ...packages.uiCore,
    },
    {
      command: 'npm run build:css -w @my-project/ui-core',
      ...packages.uiCore,
    },
  ],
  runOptions,
).result.catch(() => process.exit(1))

// Step 5: repositoriesをビルド
await concurrently(
  [
    {
      command: 'npm run build -w @my-project/repositories',
      ...packages.repositories,
    },
  ],
  runOptions,
).result.catch(() => process.exit(1))

console.log('✅ All packages built successfully!')
