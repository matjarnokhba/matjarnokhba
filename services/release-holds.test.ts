import { describe, it, expect } from "vitest";
import { releasedHeldIds, releaseKey, releaseDescription } from "../lib/release-holds";

describe("releasedHeldIds", () => {
  it("يقرأ المفتاح الجديد", () => {
    const s = releasedHeldIds([{ description: "x", idempotencyKey: releaseKey(42) }]);
    expect(s.has(42)).toBe(true);
  });
  it("يقرأ الوصف القديم بمطابقة الرقم كاملاً", () => {
    const s = releasedHeldIds([{ description: releaseDescription(15), idempotencyKey: null }]);
    expect(s.has(15)).toBe(true);
    expect(s.has(5)).toBe(false);
    expect(s.has(1)).toBe(false);
  });
  it("لا يخلط بين الأرقام المتشابهة ويتجاهل غير المرتبط", () => {
    const s = releasedHeldIds([
      { description: releaseDescription(12), idempotencyKey: null },
      { description: "أرباح محجوزة من الطلب #5 بعد خصم عمولة 10%", idempotencyKey: null },
      { description: "y", idempotencyKey: "held:order:5" },
    ]);
    expect(Array.from(s)).toEqual([12]);
  });
});