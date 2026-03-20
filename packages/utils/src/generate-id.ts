/**
 * プレフィックス付きのユニークIDを生成する
 * @param prefix - IDのプレフィックス（例: 'user', 'project'）
 * @returns プレフィックス付きのユニークID
 */
export const generateId = (prefix: string): string => {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `${prefix}_${timestamp}${random}`
}
