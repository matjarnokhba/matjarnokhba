import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "./auth";

describe("registerSchema", () => {
  it("accepts valid input", () => {
    expect(registerSchema.safeParse({ name: "Ali", email: "a@b.com", password: "secret1" }).success).toBe(true);
  });
  it("rejects short password", () => {
    expect(registerSchema.safeParse({ name: "Ali", email: "a@b.com", password: "123" }).success).toBe(false);
  });
  it("rejects invalid email", () => {
    expect(registerSchema.safeParse({ name: "Ali", email: "not-email", password: "secret1" }).success).toBe(false);
  });
  it("lowercases email", () => {
    const r = registerSchema.safeParse({ name: "Ali", email: "A@B.COM", password: "secret1" });
    if (r.success) expect(r.data.email).toBe("a@b.com");
  });
  it("rejects short name", () => {
    expect(registerSchema.safeParse({ name: "A", email: "a@b.com", password: "secret1" }).success).toBe(false);
  });
  it("accepts optional phone", () => {
    expect(registerSchema.safeParse({ name: "Ali", email: "a@b.com", password: "secret1", phone: "0612345678" }).success).toBe(true);
  });
});

describe("loginSchema", () => {
  it("accepts valid", () => expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true));
  it("rejects empty password", () => expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false));
  it("rejects invalid email", () => expect(loginSchema.safeParse({ email: "bad", password: "x" }).success).toBe(false));
});