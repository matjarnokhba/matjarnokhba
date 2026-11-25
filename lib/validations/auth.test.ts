import { describe, it, expect } from "vitest";
import { registerSchema } from "./auth";

const base = { name: "أحمد", email: "a@b.com", password: "123456" };

describe("registerSchema phone", () => {
  it("بدون هاتف: مرفوض", () => {
    expect(registerSchema.safeParse(base).success).toBe(false);
  });
  it("هاتف فارغ: مرفوض", () => {
    expect(registerSchema.safeParse({ ...base, phone: "" }).success).toBe(false);
  });
  it("هاتف غير صالح: مرفوض", () => {
    expect(registerSchema.safeParse({ ...base, phone: "12345678" }).success).toBe(false);
  });
  it("هاتف مغربي صالح بصيغ مختلفة: مقبول", () => {
    expect(registerSchema.safeParse({ ...base, phone: "0612345678" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, phone: "+212612345678" }).success).toBe(true);
  });
});