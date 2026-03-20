import type { DataSource, Document, QueryOptions, Transaction, Batch } from '../core/types'

/**
 * テスト用のモックアダプター
 */
export class MockAdapter implements DataSource {
  private store: Map<string, Record<string, unknown>> = new Map()
  private idCounter = 0

  async get(path: string): Promise<Document | null> {
    const data = this.store.get(path)
    if (!data) return null
    const id = path.split('/').pop()!
    return { id, ...data }
  }

  async getAll(path: string, options?: QueryOptions): Promise<Document[]> {
    const results: Document[] = []
    const prefix = path + '/'

    for (const [key, data] of this.store.entries()) {
      if (key.startsWith(prefix) || key === path) {
        const parts = key.replace(prefix, '').split('/')
        if (parts.length === 1 || key === path) {
          const id = key.split('/').pop()!
          results.push({ id, ...data })
        }
      }
    }

    // where条件の適用
    let filtered = results
    if (options?.where) {
      for (const condition of options.where) {
        filtered = filtered.filter((doc) => {
          const value = doc[condition.field]
          switch (condition.operator) {
            case '==':
              return value === condition.value
            case '!=':
              return value !== condition.value
            case '<':
              return (value as number) < (condition.value as number)
            case '<=':
              return (value as number) <= (condition.value as number)
            case '>':
              return (value as number) > (condition.value as number)
            case '>=':
              return (value as number) >= (condition.value as number)
            case 'in':
              return (condition.value as unknown[]).includes(value)
            default:
              return true
          }
        })
      }
    }

    // orderByの適用
    if (options?.orderBy) {
      for (const order of options.orderBy.reverse()) {
        filtered.sort((a, b) => {
          const aVal = a[order.field]
          const bVal = b[order.field]
          if (aVal === bVal) return 0
          const comparison = aVal! < bVal! ? -1 : 1
          return order.direction === 'asc' ? comparison : -comparison
        })
      }
    }

    // limitの適用
    if (options?.limit !== undefined) {
      filtered = filtered.slice(0, options.limit)
    }

    return filtered
  }

  async set(path: string, data: Record<string, unknown>): Promise<void> {
    this.store.set(path, data)
  }

  async update(path: string, data: Record<string, unknown>): Promise<void> {
    const existing = this.store.get(path)
    if (!existing) {
      throw new Error(`Document not found: ${path}`)
    }
    this.store.set(path, { ...existing, ...data })
  }

  async delete(path: string): Promise<void> {
    this.store.delete(path)
  }

  async exists(path: string): Promise<boolean> {
    return this.store.has(path)
  }

  async runTransaction<T>(updateFunction: (transaction: Transaction) => Promise<T>): Promise<T> {
    const operations: Array<{ type: 'set' | 'update' | 'delete'; path: string; data?: Record<string, unknown> }> = []

    const transaction: Transaction = {
      get: async (path: string) => this.get(path),
      set: (path: string, data: Record<string, unknown>) => {
        operations.push({ type: 'set', path, data })
      },
      update: (path: string, data: Record<string, unknown>) => {
        operations.push({ type: 'update', path, data })
      },
      delete: (path: string) => {
        operations.push({ type: 'delete', path })
      },
    }

    const result = await updateFunction(transaction)

    // 操作をコミット
    for (const op of operations) {
      switch (op.type) {
        case 'set':
          await this.set(op.path, op.data!)
          break
        case 'update':
          await this.update(op.path, op.data!)
          break
        case 'delete':
          await this.delete(op.path)
          break
      }
    }

    return result
  }

  batch(): Batch {
    const operations: Array<{ type: 'set' | 'update' | 'delete'; path: string; data?: Record<string, unknown> }> = []

    return {
      set: (path: string, data: Record<string, unknown>) => {
        operations.push({ type: 'set', path, data })
      },
      update: (path: string, data: Record<string, unknown>) => {
        operations.push({ type: 'update', path, data })
      },
      delete: (path: string) => {
        operations.push({ type: 'delete', path })
      },
      commit: async () => {
        for (const op of operations) {
          switch (op.type) {
            case 'set':
              await this.set(op.path, op.data!)
              break
            case 'update':
              await this.update(op.path, op.data!)
              break
            case 'delete':
              await this.delete(op.path)
              break
          }
        }
      },
    }
  }

  generateId(): string {
    return `mock-id-${++this.idCounter}`
  }

  /** テスト用: ストアをクリア */
  clear(): void {
    this.store.clear()
    this.idCounter = 0
  }
}
