/**
 * バリデーションエラー
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * リソースが見つからないエラー
 */
export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`);
    this.name = "NotFoundError";
  }
}

/**
 * 認証エラー
 */
export class AuthenticationError extends Error {
  constructor(message = "Authentication failed") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * リポジトリ操作エラー
 */
export class RepositoryError extends Error {
  public readonly operation: string;
  public readonly entityName: string;
  public override readonly cause?: unknown;

  constructor(operation: string, entityName: string, cause?: unknown) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    super(`Failed to ${operation} ${entityName}: ${causeMessage}`);
    this.name = "RepositoryError";
    this.operation = operation;
    this.entityName = entityName;
    this.cause = cause;
  }
}

/**
 * データソースエラー
 */
export class DataSourceError extends Error {
  public readonly path: string;
  public override readonly cause?: unknown;

  constructor(path: string, message: string, cause?: unknown) {
    super(message);
    this.name = "DataSourceError";
    this.path = path;
    this.cause = cause;
  }
}
