import { describe, it, expect } from "vitest";
import {
  warehouseCreateSchema,
  warehouseUpdateSchema,
  companyCreateSchema,
  membershipCreateSchema,
  membershipUpdateSchema,
} from "./logistics-validation";
import { COMPANY_TRANSITIONS, WAREHOUSE_TRANSITIONS, canTransition, codePart } from "./logistics-rules";

describe("logistics validation", () => {
  it("warehouse requires name, company and city", () => {
    expect(warehouseCreateSchema.safeParse({ name: "x", companyId: 1, city: "Casa" }).success).toBe(false);
    expect(warehouseCreateSchema.safeParse({ name: "مستودع الدار البيضاء", companyId: 1, city: "الدار البيضاء" }).success).toBe(true);
  });
  it("lat/lng must come together", () => {
    expect(warehouseCreateSchema.safeParse({ name: "WH One", companyId: 1, city: "Rabat", latitude: 34 }).success).toBe(false);
    expect(warehouseCreateSchema.safeParse({ name: "WH One", companyId: 1, city: "Rabat", latitude: 34, longitude: -6 }).success).toBe(true);
  });
  it("code is normalized to upper case and validated", () => {
    const ok = warehouseCreateSchema.safeParse({ name: "WH One", companyId: 1, city: "Rabat", code: "wh-rab-1" });
    expect(ok.success && ok.data.code).toBe("WH-RAB-1");
    expect(warehouseCreateSchema.safeParse({ name: "WH One", companyId: 1, city: "Rabat", code: "a b" }).success).toBe(false);
  });
  it("updates need at least one field", () => {
    expect(warehouseUpdateSchema.safeParse({}).success).toBe(false);
    expect(membershipUpdateSchema.safeParse({}).success).toBe(false);
    expect(warehouseUpdateSchema.safeParse({ status: "SUSPENDED" }).success).toBe(true);
  });
  it("company kind defaults to INTERNAL", () => {
    const r = companyCreateSchema.safeParse({ name: "شركة التوصيل" });
    expect(r.success && r.data.kind).toBe("INTERNAL");
  });
  it("membership scope rules", () => {
    expect(membershipCreateSchema.safeParse({ userId: 1, scope: "WAREHOUSE", jobRoles: ["WORKER"] }).success).toBe(false);
    expect(membershipCreateSchema.safeParse({ userId: 1, scope: "WAREHOUSE", warehouseId: 2, jobRoles: [] }).success).toBe(false);
    expect(membershipCreateSchema.safeParse({ userId: 1, scope: "WAREHOUSE", warehouseId: 2, jobRoles: ["WORKER"] }).success).toBe(true);
    expect(membershipCreateSchema.safeParse({ userId: 1, scope: "COMPANY" }).success).toBe(false);
    expect(membershipCreateSchema.safeParse({ userId: 1, scope: "COMPANY", companyId: 3, jobRoles: ["MANAGER"] }).success).toBe(true);
    expect(membershipCreateSchema.safeParse({ userId: 1, scope: "PLATFORM", companyId: 3 }).success).toBe(false);
    expect(membershipCreateSchema.safeParse({ userId: 1, scope: "PLATFORM" }).success).toBe(true);
  });
});

describe("logistics rules", () => {
  it("company transitions", () => {
    expect(canTransition(COMPANY_TRANSITIONS, "ACTIVE", "DETACHING")).toBe(true);
    expect(canTransition(COMPANY_TRANSITIONS, "ACTIVE", "DETACHED")).toBe(false);
    expect(canTransition(COMPANY_TRANSITIONS, "DETACHING", "DETACHED")).toBe(true);
    expect(canTransition(COMPANY_TRANSITIONS, "DETACHED", "ACTIVE")).toBe(true);
  });
  it("warehouse transitions", () => {
    expect(canTransition(WAREHOUSE_TRANSITIONS, "ACTIVE", "CLOSED")).toBe(true);
    expect(canTransition(WAREHOUSE_TRANSITIONS, "CLOSED", "SUSPENDED")).toBe(false);
    expect(canTransition(WAREHOUSE_TRANSITIONS, "CLOSED", "ACTIVE")).toBe(true);
  });
  it("codePart falls back to GEN for non-latin names", () => {
    expect(codePart("Casablanca")).toBe("CAS");
    expect(codePart("الدار البيضاء")).toBe("GEN");
  });
});