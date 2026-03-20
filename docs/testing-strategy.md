# テスト戦略

## 概要

本ドキュメントは、テストピラミッドに基づいた包括的なテスト戦略を定義する。
品質保証と開発効率のバランスを考慮し、各レイヤーに適切なテストを配置する。

## テストピラミッド

```
                    ┌─────────┐
                    │  E2E    │  少量・遅い・高コスト
                    │ Tests   │
                   ─┴─────────┴─
                 ┌───────────────┐
                 │  Integration  │  中量・中速度
                 │    Tests      │
                ─┴───────────────┴─
              ┌───────────────────────┐
              │      Unit Tests       │  大量・高速・低コスト
              └───────────────────────┘
```

| レベル      | 対象            | 実行速度 | カバレッジ目標 |
| ----------- | --------------- | -------- | -------------- |
| Unit        | 関数、クラス    | 高速     | 80%+           |
| Integration | API、Repository | 中速     | 70%+           |
| E2E         | ユーザーフロー  | 低速     | 主要パス       |

## ディレクトリ構成

```
packages/
├── domains/
│   └── src/
│       └── user/
│           ├── user.ts
│           ├── user.schema.ts
│           └── user.test.ts         # コロケーション
├── repositories/
│   └── src/
│       └── domain/
│           └── users/
│               ├── user.repository.ts
│               └── user.repository.test.ts
└── ui-core/
    └── src/
        └── components/
            └── button/
                ├── button.tsx
                └── button.test.tsx

apps/
└── web/
    ├── app/
    │   └── routes/
    │       └── users/
    │           ├── route.tsx
    │           └── route.test.tsx
    └── e2e/                          # E2Eテスト
        └── user-flow.spec.ts
```

## Vitest設定

### 基本設定

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/index.ts",
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
```

### セットアップファイル

```typescript
// test/setup.ts
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// 各テスト後にクリーンアップ
afterEach(() => {
  cleanup();
});

// グローバルモック
vi.mock("@project/repositories", () => ({
  // 必要に応じてモック
}));
```

## ユニットテスト

### 純粋関数のテスト

```typescript
// packages/utils/src/generate-id.test.ts
import { describe, it, expect } from "vitest";
import { generateId } from "./generate-id";

describe("generateId", () => {
  it("指定したプレフィックスで始まるIDを生成する", () => {
    const id = generateId("user");
    expect(id).toMatch(/^user_[a-z0-9]+$/);
  });

  it("毎回ユニークなIDを生成する", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId("test")));
    expect(ids.size).toBe(100);
  });
});
```

### Zodスキーマのテスト

```typescript
// packages/domains/src/user/user.schema.test.ts
import { describe, it, expect } from "vitest";
import { userSchema, createUserSchema } from "./user.schema";

describe("userSchema", () => {
  const validUser = {
    id: "user_123",
    email: "test@example.com",
    name: "Test User",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("有効なユーザーデータを受け入れる", () => {
    const result = userSchema.safeParse(validUser);
    expect(result.success).toBe(true);
  });

  it("無効なメールアドレスを拒否する", () => {
    const result = userSchema.safeParse({
      ...validUser,
      email: "invalid-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("email");
    }
  });

  it("空の名前を拒否する", () => {
    const result = userSchema.safeParse({
      ...validUser,
      name: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("createUserSchema", () => {
  it("id, createdAt, updatedAtなしでバリデーションが通る", () => {
    const result = createUserSchema.safeParse({
      email: "new@example.com",
      name: "New User",
      role: "user",
    });
    expect(result.success).toBe(true);
  });
});
```

### Reactコンポーネントのテスト

```typescript
// packages/ui-core/src/components/button/button.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './button'

describe('Button', () => {
  it('テキストをレンダリングする', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('クリックイベントを発火する', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click</Button>)

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('disabled状態でクリックを無視する', () => {
    const handleClick = vi.fn()
    render(<Button disabled onClick={handleClick}>Click</Button>)

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it.each([
    ['primary', 'bg-blue-600'],
    ['secondary', 'bg-gray-200'],
    ['destructive', 'bg-red-600'],
  ])('variant=%s のスタイルを適用する', (variant, expectedClass) => {
    render(<Button variant={variant as any}>Button</Button>)
    expect(screen.getByRole('button')).toHaveClass(expectedClass)
  })
})
```

## 統合テスト

### Repositoryのテスト

```typescript
// packages/repositories/src/domain/users/user.repository.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { MockAdapter } from "../../adapters/mock-adapter";
import { UserRepository } from "./user.repository";

describe("UserRepository", () => {
  let adapter: MockAdapter;
  let repository: UserRepository;

  beforeEach(() => {
    adapter = new MockAdapter();
    repository = new UserRepository(adapter);
  });

  describe("create", () => {
    it("新規ユーザーを作成する", async () => {
      const user = await repository.create({
        email: "test@example.com",
        name: "Test User",
        role: "user",
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe("test@example.com");
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it("重複メールアドレスでエラーを返す", async () => {
      await repository.create({
        email: "dup@example.com",
        name: "User 1",
        role: "user",
      });

      // 重複チェックが実装されている場合
      // await expect(repository.create({...})).rejects.toThrow()
    });
  });

  describe("findById", () => {
    it("存在するユーザーを取得する", async () => {
      const created = await repository.create({
        email: "find@example.com",
        name: "Find User",
        role: "user",
      });

      const found = await repository.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.email).toBe("find@example.com");
    });

    it("存在しないIDはnullを返す", async () => {
      const found = await repository.findById("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("update", () => {
    it("ユーザー情報を更新する", async () => {
      const user = await repository.create({
        email: "update@example.com",
        name: "Original Name",
        role: "user",
      });

      await repository.update(user.id, { name: "Updated Name" });
      const updated = await repository.findById(user.id);

      expect(updated?.name).toBe("Updated Name");
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        user.updatedAt.getTime(),
      );
    });
  });

  describe("delete", () => {
    it("ユーザーを削除する", async () => {
      const user = await repository.create({
        email: "delete@example.com",
        name: "Delete User",
        role: "user",
      });

      await repository.delete(user.id);
      const found = await repository.findById(user.id);

      expect(found).toBeNull();
    });
  });
});
```

### loader/actionのテスト

```typescript
// apps/web/app/routes/users/route.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { json } from "react-router";
import { loader, action } from "./route";

// モックの設定
vi.mock("~/server/repositories", () => ({
  getRepositories: vi.fn(() => ({
    user: {
      findAll: vi.fn(),
      create: vi.fn(),
      findById: vi.fn(),
    },
  })),
}));

describe("users route", () => {
  describe("loader", () => {
    it("ユーザー一覧を返す", async () => {
      const mockUsers = [
        { id: "1", name: "User 1", email: "user1@example.com" },
        { id: "2", name: "User 2", email: "user2@example.com" },
      ];

      const { getRepositories } = await import("~/server/repositories");
      vi.mocked(getRepositories().user.findAll).mockResolvedValue(mockUsers);

      const request = new Request("http://localhost/users");
      const response = await loader({ request, params: {}, context: {} });

      expect(response).toBeDefined();
      // レスポンスの検証
    });
  });

  describe("action", () => {
    it("ユーザーを作成する", async () => {
      const formData = new FormData();
      formData.append("email", "new@example.com");
      formData.append("name", "New User");
      formData.append("role", "user");

      const request = new Request("http://localhost/users", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      // リダイレクトまたはJSONレスポンスの検証
    });

    it("バリデーションエラーを返す", async () => {
      const formData = new FormData();
      formData.append("email", "invalid-email");
      formData.append("name", "");

      const request = new Request("http://localhost/users", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      // エラーレスポンスの検証
      expect(response.status).toBe(400);
    });
  });
});
```

## E2Eテスト

### Playwright設定

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2Eテスト例

```typescript
// e2e/user-flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("User Management", () => {
  test.beforeEach(async ({ page }) => {
    // テストデータのセットアップ（APIまたはDB直接）
    await page.goto("/users");
  });

  test("ユーザー一覧を表示する", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("新規ユーザーを作成する", async ({ page }) => {
    await page.getByRole("button", { name: "Add User" }).click();

    await page.getByLabel("Email").fill("new@example.com");
    await page.getByLabel("Name").fill("New User");
    await page.getByRole("combobox", { name: "Role" }).selectOption("user");

    await page.getByRole("button", { name: "Create" }).click();

    // 成功メッセージの確認
    await expect(page.getByText("User created successfully")).toBeVisible();

    // 一覧に新規ユーザーが表示される
    await expect(page.getByText("new@example.com")).toBeVisible();
  });

  test("バリデーションエラーを表示する", async ({ page }) => {
    await page.getByRole("button", { name: "Add User" }).click();

    // 空のまま送信
    await page.getByRole("button", { name: "Create" }).click();

    // エラーメッセージの確認
    await expect(page.getByText("Email is required")).toBeVisible();
    await expect(page.getByText("Name is required")).toBeVisible();
  });

  test("ユーザーを削除する", async ({ page }) => {
    // 削除対象のユーザーを作成
    // ...

    await page
      .getByRole("row", { name: /test@example.com/ })
      .getByRole("button", { name: "Delete" })
      .click();

    // 確認ダイアログ
    await page.getByRole("button", { name: "Confirm" }).click();

    // ユーザーが一覧から消える
    await expect(page.getByText("test@example.com")).not.toBeVisible();
  });
});
```

## モックパターン

### 依存関係のモック

```typescript
// vi.mock によるモジュールモック
vi.mock("@project/repositories", () => ({
  createRepositories: vi.fn(() => ({
    user: {
      findById: vi.fn(),
      create: vi.fn(),
    },
  })),
}));

// スパイを使用した部分モック
import * as utils from "@project/utils";

vi.spyOn(utils, "generateId").mockReturnValue("mock-id");

// モックのリセット
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

### 日時のモック

```typescript
import { vi, beforeEach, afterEach } from "vitest";

describe("Time-dependent tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("現在時刻を使用する処理のテスト", () => {
    const now = new Date();
    expect(now.toISOString()).toBe("2024-01-01T00:00:00.000Z");
  });
});
```

### ネットワークリクエストのモック

```typescript
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("/api/users", () => {
    return HttpResponse.json([
      { id: "1", name: "User 1" },
      { id: "2", name: "User 2" },
    ]);
  }),
  http.post("/api/users", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: "new-id", ...body }, { status: 201 });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## テストデータ管理

### ファクトリパターン

```typescript
// test/factories/user.factory.ts
import type { User } from "@project/domains";

let counter = 0;

export function createUserFactory(overrides?: Partial<User>): User {
  counter++;
  return {
    id: `user_${counter}`,
    email: `user${counter}@example.com`,
    name: `Test User ${counter}`,
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// 使用例
const user = createUserFactory({ role: "admin" });
const users = Array.from({ length: 10 }, () => createUserFactory());
```

### Fixtureパターン

```typescript
// test/fixtures/users.json
{
  "admin": {
    "id": "user_admin",
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "admin"
  },
  "regularUser": {
    "id": "user_regular",
    "email": "user@example.com",
    "name": "Regular User",
    "role": "user"
  }
}

// 使用例
import fixtures from '../fixtures/users.json'

describe('Admin features', () => {
  it('管理者のみアクセス可能', () => {
    const user = fixtures.admin
    // ...
  })
})
```

## CI設定

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main]
  pull_request:

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - run: npm run test -- --coverage
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json

  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## テストのベストプラクティス

### AAA パターン

```typescript
it("ユーザーを作成する", async () => {
  // Arrange（準備）
  const userData = { email: "test@example.com", name: "Test" };

  // Act（実行）
  const user = await repository.create(userData);

  // Assert（検証）
  expect(user.email).toBe("test@example.com");
});
```

### テスト名の命名規則

```typescript
// 「〜する」形式で記述
describe("UserRepository", () => {
  describe("create", () => {
    it("新規ユーザーを作成する", () => {});
    it("無効なメールでエラーを返す", () => {});
    it("重複メールで例外をスローする", () => {});
  });
});
```

### 独立したテスト

```typescript
// Bad: テスト間の依存
let sharedUser: User

it('ユーザーを作成する', async () => {
  sharedUser = await repository.create({...})
})

it('作成したユーザーを取得する', async () => {
  const found = await repository.findById(sharedUser.id)  // 前のテストに依存
})

// Good: 各テストが独立
it('ユーザーを取得する', async () => {
  const created = await repository.create({...})  // 各テスト内で準備
  const found = await repository.findById(created.id)
  expect(found).toEqual(created)
})
```

## 関連ドキュメント

- [コーディング規約](./coding-standards.md)
- [Repositoryパターン](./repository-pattern.md)
- [エラーハンドリング](./error-handling.md)
