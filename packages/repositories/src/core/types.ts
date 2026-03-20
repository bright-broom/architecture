/**
 * データソースに依存しないドキュメントの基本形
 */
export interface Document {
  id: string
  [key: string]: unknown
}

/**
 * クエリ条件の型定義
 */
export interface QueryCondition {
  field: string
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in' | 'array-contains'
  value: unknown
}

/**
 * ソート条件の型定義
 */
export interface OrderByCondition {
  field: string
  direction: 'asc' | 'desc'
}

/**
 * クエリオプション
 */
export interface QueryOptions {
  where?: QueryCondition[]
  orderBy?: OrderByCondition[]
  limit?: number
  offset?: number
}

/**
 * トランザクション操作のインターフェース
 */
export interface Transaction {
  get(path: string): Promise<Document | null>
  set(path: string, data: Record<string, unknown>): void
  update(path: string, data: Record<string, unknown>): void
  delete(path: string): void
}

/**
 * バッチ操作のインターフェース
 */
export interface Batch {
  set(path: string, data: Record<string, unknown>): void
  update(path: string, data: Record<string, unknown>): void
  delete(path: string): void
  commit(): Promise<void>
}

/**
 * データソースの抽象インターフェース
 */
export interface DataSource {
  // 基本的なCRUD操作
  get(path: string): Promise<Document | null>
  getAll(path: string, options?: QueryOptions): Promise<Document[]>
  set(path: string, data: Record<string, unknown>): Promise<void>
  update(path: string, data: Record<string, unknown>): Promise<void>
  delete(path: string): Promise<void>
  exists(path: string): Promise<boolean>

  // トランザクション
  runTransaction<T>(updateFunction: (transaction: Transaction) => Promise<T>): Promise<T>

  // バッチ操作
  batch(): Batch

  // ID生成
  generateId(): string
}
