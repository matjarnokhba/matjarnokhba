import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "./auth";

const phone = "0612345678";

describe("registerSchema", () => {
  it("accepts valid input", () => {
    expect(registerSchema.safeParse({ name: "Ali", email: "a@b.com", password: "secret1", phone }).success).toBe(true);
  });
  it("rejects short password", () => {
    expect(registerSchema.safeParse({ name: "Ali", email: "a@b.com", password: "123", phone }).success).toBe(false);
  });
  it("rejects invalid email", () => {
    expect(registerSchema.safeParse({ name: "Ali", email: "not-email", password: "secret1", phone }).success).toBe(false);
  });
  it("lowercases email", () => {
    const r = registerSchema.safeParse({ name: "Ali", email: "A@B.COM", password: "secret1", phone });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("a@b.com");
  });
  it("rejects short name", () => {
    expect(registerSchema.safeParse({ name: "A", email: "a@b.com", password: "secret1", phone }).success).toBe(false);
  });
  it("accepts valid phone", () => {
    expect(registerSchema.safeParse({ name: "Ali", email: "a@b.com", password: "secret1", phone: "0612345678" }).success).toBe(true);
  });
});

describe("registerSchema phone is mandatory", () => {
  const base = { name: "أحمد", email: "a@b.com", password: "123456" };
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

describe("loginSchema", () => {
  it("accepts valid", () => expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true));
  it("rejects empty password", () => expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false));
  it("rejects invalid email", () => expect(loginSchema.safeParse({ email: "bad", password: "x" }).success).toBe(false));
});