import { describe, it, expect } from "vitest";
import { dateUtils } from "./date-utils";

describe("dateUtils", () => {
  describe("format", () => {
    it("日付を指定したフォーマットで文字列化する", () => {
      const date = new Date(2024, 0, 15);
      expect(dateUtils.format(date, "yyyy-MM-dd")).toBe("2024-01-15");
    });
  });

  describe("parseISO", () => {
    it("ISO文字列をDateオブジェクトに変換する", () => {
      const date = dateUtils.parseISO("2024-01-15");
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(15);
    });
  });

  describe("isDate", () => {
    it("Dateオブジェクトの場合trueを返す", () => {
      expect(dateUtils.isDate(new Date())).toBe(true);
    });

    it("Date以外の場合falseを返す", () => {
      expect(dateUtils.isDate("2024-01-15")).toBe(false);
      expect(dateUtils.isDate(1234567890)).toBe(false);
      expect(dateUtils.isDate(null)).toBe(false);
    });
  });

  describe("fromUnixTime", () => {
    it("UnixタイムスタンプをDateに変換する", () => {
      const date = dateUtils.fromUnixTime(1705276800);
      expect(date.getFullYear()).toBe(2024);
    });
  });
});
