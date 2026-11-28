import { describe, it, expect } from "vitest";
import { companyApplySchema, applicationDecisionSchema } from "./logistics-application-validation";

const good = { name: "أحمد", email: "a@b.co", password: "12345678", companyName: "شركة النور", phone: "0600000000" };
describe("companyApplySchema", () => {
  it("بيانات صحيحة: مقبولة", () => {
    expect(companyApplySchema.safeParse(good).success).toBe(true);
  });
  it("كلمة مرور قصيرة أو بريد خاطئ أو اسم شركة قصير: مرفوضة", () => {
    expect(companyApplySchema.safeParse({ ...good, password: "123" }).success).toBe(false);
    expect(companyApplySchema.safeParse({ ...good, email: "x" }).success).toBe(false);
    expect(companyApplySchema.safeParse({ ...good, companyName: "ش" }).success).toBe(false);
  });
});
describe("applicationDecisionSchema", () => {
  it("قبول أو رفض فقط", () => {
    expect(applicationDecisionSchema.safeParse({ action: "approve" }).success).toBe(true);
    expect(applicationDecisionSchema.safeParse({ action: "reject", reason: "ناقصة" }).success).toBe(true);
    expect(applicationDecisionSchema.safeParse({ action: "delete" }).success).toBe(false);
  });
});
