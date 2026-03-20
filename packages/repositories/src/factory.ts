import type { DataSource } from './core/types'
import { UserRepository } from './domain/users/user.repository'

/**
 * Repository作成のためのファクトリー関数
 */
export const createRepositories = (dataSource: DataSource) => {
  return {
    user: new UserRepository(dataSource),
  }
}

export type Repositories = ReturnType<typeof createRepositories>
