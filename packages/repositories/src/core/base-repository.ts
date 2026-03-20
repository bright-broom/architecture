import { generateId, dateUtils } from "@my-project/utils";
import { RepositoryError } from "@my-project/domains";
import type { DataSource, Document } from "./types";

/**
 * Repository共通の基底クラス
 */
export abstract class BaseRepository<T> {
  constructor(protected readonly dataSource: DataSource) {}

  /**
   * ドメインオブジェクトをデータソース用に変換
   */
  protected abstract toDocument(entity: T): Record<string, unknown>;

  /**
   * データソースドキュメントをドメインオブジェクトに変換
   */
  protected abstract fromDocument(doc: Document): T;

  /**
   * エラーハンドリング - RepositoryErrorでラップして再スロー
   */
  protected handleError(
    operation: string,
    entityName: string,
    error: unknown,
  ): never {
    throw new RepositoryError(operation, entityName, error);
  }

  /**
   * Nullチェック
   */
  protected requireNotNull<U>(value: U | null | undefined, message: string): U {
    if (value === null || value === undefined) {
      throw new Error(message);
    }
    return value;
  }

  /**
   * 現在時刻の取得
   */
  protected now(): Date {
    return new Date();
  }

  /**
   * ID生成
   */
  protected generateId(prefix: string): string {
    return generateId(prefix);
  }

  /**
   * Timestamp/文字列/数値をDateに変換
   */
  protected toDate(value: unknown): Date {
    if (!value) {
      return new Date();
    }

    // toDateメソッドを持つオブジェクト（Firestore Timestamp等）
    if (
      value &&
      typeof value === "object" &&
      "toDate" in value &&
      typeof value.toDate === "function"
    ) {
      return value.toDate();
    }

    // Dateオブジェクト
    if (dateUtils.isDate(value)) {
      return value;
    }

    // 文字列
    if (typeof value === "string") {
      return dateUtils.parseISO(value);
    }

    // 数値（ミリ秒）
    if (typeof value === "number") {
      return dateUtils.fromUnixTime(value / 1000);
    }

    return new Date();
  }
}
