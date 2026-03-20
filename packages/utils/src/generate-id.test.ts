import { describe, it, expect } from "vitest";
import { generateId } from "./generate-id";

describe("generateId", () => {
  it("指定したプレフィックスで始まるIDを生成する", () => {
    const id = generateId("user");
    expect(id).toMatch(/^user_/);
  });

  it("毎回異なるIDを生成する", () => {
    const id1 = generateId("test");
    const id2 = generateId("test");
    expect(id1).not.toBe(id2);
  });

  it("プレフィックスの後にタイムスタンプとランダム文字列を含む", () => {
    const id = generateId("item");
    const underscoreIndex = id.indexOf("_");
    expect(underscoreIndex).toBeGreaterThan(0);
    const prefix = id.slice(0, underscoreIndex);
    const suffix = id.slice(underscoreIndex + 1);
    expect(prefix).toBe("item");
    expect(suffix.length).toBeGreaterThan(8);
  });
});
