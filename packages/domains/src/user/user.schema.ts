import { z } from 'zod'
import type { User, UserRole } from './user'
import { USER_ROLES } from './user'

const userRoleValues = Object.values(USER_ROLES) as [UserRole, ...UserRole[]]

/**
 * ユーザースキーマ
 */
export const userSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(userRoleValues),
  createdAt: z.date(),
  updatedAt: z.date(),
}) satisfies z.ZodType<User>

/**
 * ユーザー作成用スキーマ
 */
export const createUserSchema = userSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

/**
 * ユーザー更新用スキーマ
 */
export const updateUserSchema = userSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial()
