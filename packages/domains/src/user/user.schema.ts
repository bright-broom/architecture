import { z } from "zod";
import type { User, UserRole } from "./user";
import { USER_ROLES } from "./user";

const userRoleValues = Object.values(USER_ROLES) as [UserRole, ...UserRole[]];

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
}) satisfies z.ZodType<User>;

/** システムフィールド（自動生成されるフィールド）の共通定義 */
const systemFieldsToOmit = {
  id: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * ユーザー作成用スキーマ
 */
export const createUserSchema = userSchema.omit(systemFieldsToOmit);

/**
 * ユーザー更新用スキーマ
 */
export const updateUserSchema = userSchema.omit(systemFieldsToOmit).partial();
