import { DataSourceError } from "@my-project/domains";
import type {
  DataSource,
  Document,
  QueryOptions,
  Transaction,
  Batch,
  QueryCondition,
} from "../core/types";

/** 操作の型定義 */
type Operation = {
  type: "set" | "update" | "delete";
  path: string;
  data?: Record<string, unknown>;
};

/**
 * パスから最後のセグメント（ID）を安全に取得
 */
function getLastSegment(path: string): string {
  const segments = path.split("/").filter(Boolean);
  const last = segments.at(-1);
  if (!last) {
    throw new DataSourceError(
      path,
      "Invalid path: cannot extract ID from empty path",
    );
  }
  return last;
}

/**
 * 型ガード: 数値かどうか
 */
function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

/**
 * 型ガード: 配列かどうか
 */
function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * 単一のクエリ条件にマッチするか判定
 */
function matchesCondition(doc: Document, condition: QueryCondition): boolean {
  const value = doc[condition.field];

  switch (condition.operator) {
    case "==":
      return value === condition.value;
    case "!=":
      return value !== condition.value;
    case "<":
      return (
        isNumber(value) && isNumber(condition.value) && value < condition.value
      );
    case "<=":
      return (
        isNumber(value) && isNumber(condition.value) && value <= condition.value
      );
    case ">":
      return (
        isNumber(value) && isNumber(condition.value) && value > condition.value
      );
    case ">=":
      return (
        isNumber(value) && isNumber(condition.value) && value >= condition.value
      );
    case "in":
      return isArray(condition.value) && condition.value.includes(value);
    default:
      return true;
  }
}

/**
 * 複数のorderBy条件でソート（単一パスで実行）
 */
function compareByMultipleFields(
  a: Document,
  b: Document,
  orderBy: NonNullable<QueryOptions["orderBy"]>,
): number {
  for (const order of orderBy) {
    const aVal = a[order.field];
    const bVal = b[order.field];

    if (aVal === bVal) continue;

    // nullish値の処理
    if (aVal == null) return order.direction === "asc" ? 1 : -1;
    if (bVal == null) return order.direction === "asc" ? -1 : 1;

    const comparison = aVal < bVal ? -1 : 1;
    return order.direction === "asc" ? comparison : -comparison;
  }
  return 0;
}

/**
 * テスト用のモックアダプター
 */
export class MockAdapter implements DataSource {
  private store: Map<string, Record<string, unknown>> = new Map();
  private idCounter = 0;

  async get(path: string): Promise<Document | null> {
    const data = this.store.get(path);
    if (!data) return null;
    const id = getLastSegment(path);
    return { id, ...data };
  }

  async getAll(path: string, options?: QueryOptions): Promise<Document[]> {
    const results: Document[] = [];
    const prefix = path + "/";

    for (const [key, data] of this.store.entries()) {
      if (key.startsWith(prefix) || key === path) {
        const parts = key.replace(prefix, "").split("/");
        if (parts.length === 1 || key === path) {
          const id = getLastSegment(key);
          results.push({ id, ...data });
        }
      }
    }

    // where条件の適用（単一パスで全条件チェック）
    let filtered = results;
    if (options?.where && options.where.length > 0) {
      const conditions = options.where;
      filtered = filtered.filter((doc) =>
        conditions.every((condition) => matchesCondition(doc, condition)),
      );
    }

    // orderByの適用（単一パスでソート）
    if (options?.orderBy && options.orderBy.length > 0) {
      filtered.sort((a, b) => compareByMultipleFields(a, b, options.orderBy!));
    }

    // limitの適用
    if (options?.limit !== undefined) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  async set(path: string, data: Record<string, unknown>): Promise<void> {
    this.store.set(path, data);
  }

  async update(path: string, data: Record<string, unknown>): Promise<void> {
    const existing = this.store.get(path);
    if (!existing) {
      throw new DataSourceError(path, `Document not found at path: ${path}`);
    }
    this.store.set(path, { ...existing, ...data });
  }

  async delete(path: string): Promise<void> {
    this.store.delete(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.store.has(path);
  }

  /**
   * 操作キューをコミット（重複排除用の共通メソッド）
   */
  private async commitOperations(operations: Operation[]): Promise<void> {
    for (const op of operations) {
      switch (op.type) {
        case "set":
          await this.set(op.path, op.data!);
          break;
        case "update":
          await this.update(op.path, op.data!);
          break;
        case "delete":
          await this.delete(op.path);
          break;
      }
    }
  }

  async runTransaction<T>(
    updateFunction: (transaction: Transaction) => Promise<T>,
  ): Promise<T> {
    const operations: Operation[] = [];

    const transaction: Transaction = {
      get: async (path: string) => this.get(path),
      set: (path: string, data: Record<string, unknown>) => {
        operations.push({ type: "set", path, data });
      },
      update: (path: string, data: Record<string, unknown>) => {
        operations.push({ type: "update", path, data });
      },
      delete: (path: string) => {
        operations.push({ type: "delete", path });
      },
    };

    const result = await updateFunction(transaction);
    await this.commitOperations(operations);
    return result;
  }

  batch(): Batch {
    const operations: Operation[] = [];

    return {
      set: (path: string, data: Record<string, unknown>) => {
        operations.push({ type: "set", path, data });
      },
      update: (path: string, data: Record<string, unknown>) => {
        operations.push({ type: "update", path, data });
      },
      delete: (path: string) => {
        operations.push({ type: "delete", path });
      },
      commit: () => this.commitOperations(operations),
    };
  }

  generateId(): string {
    return `mock-id-${++this.idCounter}`;
  }

  /** テスト用: ストアをクリア */
  clear(): void {
    this.store.clear();
    this.idCounter = 0;
  }
}
