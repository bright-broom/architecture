import { format, parseISO, isDate, fromUnixTime } from 'date-fns'

/**
 * 日付操作のユーティリティ関数群
 */
export const dateUtils = {
  /**
   * 日付をフォーマットする
   */
  format: (date: Date, formatStr: string): string => {
    return format(date, formatStr)
  },

  /**
   * ISO文字列をDateに変換する
   */
  parseISO: (dateString: string): Date => {
    return parseISO(dateString)
  },

  /**
   * Dateオブジェクトかどうかを判定する
   */
  isDate: (value: unknown): value is Date => {
    return isDate(value)
  },

  /**
   * UnixタイムスタンプをDateに変換する
   */
  fromUnixTime: (unixTime: number): Date => {
    return fromUnixTime(unixTime)
  },
}
