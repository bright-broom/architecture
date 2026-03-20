import { userSchema, ValidationError, type User } from '@my-project/domains'
import { BaseRepository } from '../../core/base-repository'
import type { Document } from '../../core/types'

/**
 * ユーザーリポジトリ
 */
export class UserRepository extends BaseRepository<User> {
  private readonly collectionPath = 'users'

  protected toDocument(user: User): Record<string, unknown> {
    return {
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }

  protected fromDocument(doc: Document): User {
    const data = {
      id: doc.id,
      email: doc.email,
      name: doc.name,
      role: doc.role,
      createdAt: this.toDate(doc.createdAt),
      updatedAt: this.toDate(doc.updatedAt),
    }

    const result = userSchema.safeParse(data)
    if (!result.success) {
      throw new ValidationError(`Invalid user data: ${result.error.message}`)
    }
    return result.data
  }

  /**
   * IDでユーザーを取得
   */
  async findById(id: string): Promise<User | null> {
    const doc = await this.dataSource.get(`${this.collectionPath}/${id}`)
    if (!doc) return null
    return this.fromDocument(doc)
  }

  /**
   * メールアドレスでユーザーを取得
   */
  async findByEmail(email: string): Promise<User | null> {
    const docs = await this.dataSource.getAll(this.collectionPath, {
      where: [{ field: 'email', operator: '==', value: email }],
      limit: 1,
    })
    const doc = docs[0]
    if (!doc) return null
    return this.fromDocument(doc)
  }

  /**
   * 全ユーザーを取得
   */
  async findAll(): Promise<User[]> {
    const docs = await this.dataSource.getAll(this.collectionPath)
    return docs.map((doc) => this.fromDocument(doc))
  }

  /**
   * ユーザーを作成
   */
  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const id = this.generateId('user')
    const now = this.now()
    const user: User = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    }

    await this.dataSource.set(`${this.collectionPath}/${id}`, this.toDocument(user))
    return user
  }

  /**
   * ユーザーを更新
   */
  async update(id: string, data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    await this.dataSource.update(`${this.collectionPath}/${id}`, {
      ...data,
      updatedAt: this.now(),
    })
  }

  /**
   * ユーザーを削除
   */
  async delete(id: string): Promise<void> {
    await this.dataSource.delete(`${this.collectionPath}/${id}`)
  }
}
