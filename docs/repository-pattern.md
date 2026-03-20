# Repositoryパターン

## 概要

データアクセス層をAdapterパターンで抽象化し、外部依存（Firestore, PostgreSQL等）を差し替え可能にする設計。

## 設計の背景

### 課題

1. **テストの困難さ**: 実DBへの依存でテストが遅く不安定
2. **移行リスク**: DB変更時に全コードの修正が必要
3. **責務の混在**: ビジネスロジックとデータアクセスが混在

### 解決策

```
Repository（ドメインロジック）
    ↓ uses
DataSource（抽象インターフェース）
    ↑ implements
Adapter（具体実装）
```

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  Application Layer (loader/action)                      │
│  const repos = getRepositories()                        │
│  const user = await repos.user.findById(id)            │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  Repository Layer                                       │
│  - UserRepository extends BaseRepository                │
│  - Zodスキーマでバリデーション                          │
│  - ドメインモデルへの変換                               │
└────────────────────────┬────────────────────────────────┘
                         │ DataSource interface
┌────────────────────────▼────────────────────────────────┐
│  Adapter Layer                                          │
│  - FirestoreAdapter implements DataSource               │
│  - PostgresAdapter implements DataSource                │
│  - MockAdapter implements DataSource                    │
└─────────────────────────────────────────────────────────┘
```

## DataSourceインターフェース

### 基本型定義

```typescript
// core/types.ts

/** データソースに依存しないドキュメント型 */
interface Document {
  id: string;
  [key: string]: unknown;
}

/** クエリ条件 */
interface QueryCondition {
  field: string;
  operator: "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "array-contains";
  value: unknown;
}

/** ソート条件 */
interface OrderByCondition {
  field: string;
  direction: "asc" | "desc";
}

/** クエリオプション */
interface QueryOptions {
  where?: QueryCondition[];
  orderBy?: OrderByCondition[];
  limit?: number;
  offset?: number;
}

/** トランザクション */
interface Transaction {
  get(path: string): Promise<Document | null>;
  set(path: string, data: Record<string, unknown>): void;
  update(path: string, data: Record<string, unknown>): void;
  delete(path: string): void;
}

/** バッチ操作 */
interface Batch {
  set(path: string, data: Record<string, unknown>): void;
  update(path: string, data: Record<string, unknown>): void;
  delete(path: string): void;
  commit(): Promise<void>;
}
```

### DataSourceインターフェース

```typescript
interface DataSource {
  // 基本的なCRUD操作
  get(path: string): Promise<Document | null>;
  getAll(path: string, options?: QueryOptions): Promise<Document[]>;
  set(path: string, data: Record<string, unknown>): Promise<void>;
  update(path: string, data: Record<string, unknown>): Promise<void>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;

  // サブコレクション操作（Firestore向けだが汎用化）
  getSubcollection(
    parentPath: string,
    subcollectionName: string,
    options?: QueryOptions,
  ): Promise<Document[]>;
  getSubdocument(
    parentPath: string,
    subcollectionName: string,
    docId: string,
  ): Promise<Document | null>;
  setSubdocument(
    parentPath: string,
    subcollectionName: string,
    docId: string,
    data: Record<string, unknown>,
  ): Promise<void>;

  // トランザクション
  runTransaction<T>(
    updateFunction: (transaction: Transaction) => Promise<T>,
  ): Promise<T>;

  // バッチ操作
  batch(): Batch;

  // ID生成
  generateId(): string;
}
```

## BaseRepository

```typescript
// core/base-repository.ts

abstract class BaseRepository<T> {
  constructor(protected readonly dataSource: DataSource) {}

  /** ドメインオブジェクト → ドキュメント変換（各Repositoryで実装） */
  protected abstract toDocument(entity: T): Record<string, unknown>;

  /** ドキュメント → ドメインオブジェクト変換（各Repositoryで実装） */
  protected abstract fromDocument(doc: Document, ...args: string[]): T;

  /** エラーハンドリング */
  protected handleError(
    operation: string,
    entityName: string,
    error: unknown,
  ): never {
    console.error(`Failed to ${operation} ${entityName}:`, error);
    throw error;
  }

  /** Nullチェック */
  protected requireNotNull<U>(value: U | null | undefined, message: string): U {
    if (value === null || value === undefined) {
      throw new Error(message);
    }
    return value;
  }

  /** 現在時刻（テスト時にオーバーライド可能） */
  protected now(): Date {
    return new Date();
  }

  /** Timestamp → Date変換 */
  protected toDate(value: unknown): Date {
    // Firestore Timestampの場合
    if (value && typeof value === "object" && "toDate" in value) {
      return (value as { toDate: () => Date }).toDate();
    }
    // Dateの場合
    if (value instanceof Date) {
      return value;
    }
    // 文字列の場合
    if (typeof value === "string") {
      return new Date(value);
    }
    return new Date();
  }
}
```

## 具体的なRepository実装

### UserRepository例

```typescript
// domain/users/user.repository.ts

import { userSchema, type User } from "@project/domains";
import { BaseRepository } from "../../core/base-repository";
import { ValidationError } from "@project/domains";

export class UserRepository extends BaseRepository<User> {
  private readonly collectionPath = "users";

  /** ドメインオブジェクト → ドキュメント */
  protected toDocument(user: User): Record<string, unknown> {
    return {
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /** ドキュメント → ドメインオブジェクト */
  protected fromDocument(doc: Document): User {
    const data = {
      id: doc.id,
      email: doc.email,
      name: doc.name,
      role: doc.role,
      createdAt: this.toDate(doc.createdAt),
      updatedAt: this.toDate(doc.updatedAt),
    };

    // Zodでバリデーション
    const result = userSchema.safeParse(data);
    if (!result.success) {
      throw new ValidationError(`Invalid user data: ${result.error.message}`);
    }
    return result.data;
  }

  /** IDで取得 */
  async findById(id: string): Promise<User | null> {
    const doc = await this.dataSource.get(`${this.collectionPath}/${id}`);
    if (!doc) return null;
    return this.fromDocument(doc);
  }

  /** メールで取得 */
  async findByEmail(email: string): Promise<User | null> {
    const docs = await this.dataSource.getAll(this.collectionPath, {
      where: [{ field: "email", operator: "==", value: email }],
      limit: 1,
    });
    if (docs.length === 0) return null;
    return this.fromDocument(docs[0]);
  }

  /** 作成 */
  async create(
    data: Omit<User, "id" | "createdAt" | "updatedAt">,
  ): Promise<User> {
    const id = this.dataSource.generateId();
    const now = this.now();
    const user: User = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await this.dataSource.set(
      `${this.collectionPath}/${id}`,
      this.toDocument(user),
    );
    return user;
  }

  /** 更新 */
  async update(id: string, data: Partial<User>): Promise<void> {
    await this.dataSource.update(`${this.collectionPath}/${id}`, {
      ...data,
      updatedAt: this.now(),
    });
  }

  /** 削除 */
  async delete(id: string): Promise<void> {
    await this.dataSource.delete(`${this.collectionPath}/${id}`);
  }
}
```

## Adapter実装

### FirestoreAdapter

```typescript
// adapters/firestore-adapter.ts

import type { Firestore, WhereFilterOp } from "firebase-admin/firestore";
import type {
  DataSource,
  Document,
  QueryOptions,
  Transaction,
  Batch,
} from "../core/types";

export class FirestoreAdapter implements DataSource {
  constructor(private readonly firestore: Firestore) {}

  async get(path: string): Promise<Document | null> {
    const doc = await this.firestore.doc(path).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  async getAll(path: string, options?: QueryOptions): Promise<Document[]> {
    let query: FirebaseFirestore.Query = this.firestore.collection(path);

    if (options?.where) {
      for (const condition of options.where) {
        query = query.where(
          condition.field,
          condition.operator as WhereFilterOp,
          condition.value,
        );
      }
    }

    if (options?.orderBy) {
      for (const order of options.orderBy) {
        query = query.orderBy(order.field, order.direction);
      }
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async set(path: string, data: Record<string, unknown>): Promise<void> {
    await this.firestore.doc(path).set(data);
  }

  async update(path: string, data: Record<string, unknown>): Promise<void> {
    await this.firestore.doc(path).update(data);
  }

  async delete(path: string): Promise<void> {
    await this.firestore.doc(path).delete();
  }

  // ... 他のメソッド
}
```

### MockAdapter（テスト用）

```typescript
// adapters/mock-adapter.ts

import type { DataSource, Document, QueryOptions } from "../core/types";

export class MockAdapter implements DataSource {
  private store: Map<string, Record<string, unknown>> = new Map();
  private idCounter = 0;

  async get(path: string): Promise<Document | null> {
    const data = this.store.get(path);
    if (!data) return null;
    const id = path.split("/").pop()!;
    return { id, ...data };
  }

  async getAll(path: string, options?: QueryOptions): Promise<Document[]> {
    const results: Document[] = [];
    const prefix = path + "/";

    for (const [key, data] of this.store.entries()) {
      if (key.startsWith(prefix)) {
        const id = key.split("/").pop()!;
        results.push({ id, ...data });
      }
    }

    // where条件の適用
    let filtered = results;
    if (options?.where) {
      for (const condition of options.where) {
        filtered = filtered.filter((doc) => {
          const value = doc[condition.field];
          switch (condition.operator) {
            case "==":
              return value === condition.value;
            case "!=":
              return value !== condition.value;
            // ... 他の演算子
          }
        });
      }
    }

    return filtered;
  }

  async set(path: string, data: Record<string, unknown>): Promise<void> {
    this.store.set(path, data);
  }

  // ... 他のメソッド

  generateId(): string {
    return `mock-id-${++this.idCounter}`;
  }

  /** テスト用: ストアをクリア */
  clear(): void {
    this.store.clear();
    this.idCounter = 0;
  }
}
```

## Factoryパターン

```typescript
// factory.ts

import type { DataSource } from "./core/types";
import { UserRepository } from "./domain/users";
import { ProjectRepository } from "./domain/projects";
// ... 他のRepository

export function createRepositories(dataSource: DataSource) {
  return {
    user: new UserRepository(dataSource),
    project: new ProjectRepository(dataSource),
    // ... 他のRepository
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
```

### アプリケーションでの使用

```typescript
// apps/web/app/server/repositories.ts

import { getFirestore } from "firebase-admin/firestore";
import { FirestoreAdapter, createRepositories } from "@project/repositories";

let repositories: Repositories | null = null;

export function getRepositories(): Repositories {
  if (!repositories) {
    const firestore = getFirestore();
    const adapter = new FirestoreAdapter(firestore);
    repositories = createRepositories(adapter);
  }
  return repositories;
}
```

## テストパターン

```typescript
// domain/users/user.repository.test.ts

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
    it("新規ユーザーを作成できる", async () => {
      const user = await repository.create({
        email: "test@example.com",
        name: "Test User",
        role: "user",
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe("test@example.com");
      expect(user.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("findById", () => {
    it("存在するユーザーを取得できる", async () => {
      const created = await repository.create({
        email: "test@example.com",
        name: "Test User",
        role: "user",
      });

      const found = await repository.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.email).toBe("test@example.com");
    });

    it("存在しないユーザーはnullを返す", async () => {
      const found = await repository.findById("non-existent-id");
      expect(found).toBeNull();
    });
  });
});
```

## 設計のメリット

1. **テスト容易性**: MockAdapterでDBなしテスト
2. **移行容易性**: Adapterを差し替えるだけでDB移行
3. **責務分離**: バリデーションと変換をRepositoryに集約
4. **型安全性**: Zodでランタイム検証

## 関連ドキュメント

- [設計思想](./architect.md) - 全体設計
- [モノレポ構造](./monorepo-structure.md) - パッケージ構成
- [技術選定サマリー](./tech-decisions.md) - 技術選定一覧
