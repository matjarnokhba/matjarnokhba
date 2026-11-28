import { describe, it, expect } from "vitest";
import { routingConfigSchema, coverageSetSchema } from "./logistics-routing-validation";

const msg = (r: any) => (r.success ? "" : r.error.issues[0].message);

describe("routingConfigSchema", () => {
  it("يدوي بلا شركات: مقبول", () => {
    expect(routingConfigSchema.safeParse({ platformId: 1, mode: "MANUAL" }).success).toBe(true);
  });
  it("تلقائي أو حسب المدينة بلا شركة رئيسية: مرفوض", () => {
    expect(msg(routingConfigSchema.safeParse({ platformId: 1, mode: "AUTO" }))).toMatch(/الشركة الرئيسية/);
    expect(msg(routingConfigSchema.safeParse({ platformId: 1, mode: "BY_CITY", primaryCompanyId: null }))).toMatch(/الشركة الرئيسية/);
  });
  it("احتياطية بلا رئيسية: مرفوض", () => {
    expect(msg(routingConfigSchema.safeParse({ platformId: 1, mode: "MANUAL", fallbackCompanyId: 2 }))).toMatch(/احتياطية/);
  });
  it("رئيسية = احتياطية: مرفوض", () => {
    expect(msg(routingConfigSchema.safeParse({ platformId: 1, mode: "AUTO", primaryCompanyId: 2, fallbackCompanyId: 2 }))).toMatch(/مختلفتين/);
  });
  it("رئيسية واحتياطية مختلفتان: مقبول", () => {
    expect(routingConfigSchema.safeParse({ platformId: 1, mode: "AUTO", primaryCompanyId: 2, fallbackCompanyId: 3 }).success).toBe(true);
  });
  it("نمط غير معروف: مرفوض", () => {
    expect(routingConfigSchema.safeParse({ platformId: 1, mode: "RANDOM" }).success).toBe(false);
  });
});

describe("coverageSetSchema", () => {
  it("قائمة مدن صحيحة أو فارغة: مقبولة", () => {
    expect(coverageSetSchema.safeParse({ companyId: 1, cityIds: [1, 2, 3] }).success).toBe(true);
    expect(coverageSetSchema.safeParse({ companyId: 1, cityIds: [] }).success).toBe(true);
  });
  it("معرّفات غير صالحة: مرفوضة", () => {
    expect(coverageSetSchema.safeParse({ companyId: 1, cityIds: [0] }).success).toBe(false);
    expect(coverageSetSchema.safeParse({ companyId: 0, cityIds: [] }).success).toBe(false);
  });
});
