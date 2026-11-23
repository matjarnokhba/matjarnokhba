import { describe, it, expect } from "vitest";
import { STAFF_PERMISSIONS, ALL_STAFF_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS, hasStaffPermission, isValidStaffPermission } from "./staff-permissions";

describe("STAFF_PERMISSIONS", () => {
  it("has 22 permissions", () => expect(Object.keys(STAFF_PERMISSIONS).length).toBe(22));
  it("includes SELL_ON_POS", () => expect(STAFF_PERMISSIONS.SELL_ON_POS).toBe("SELL_ON_POS"));
  it("includes UPDATE_ORDER_STATUS", () => expect(STAFF_PERMISSIONS.UPDATE_ORDER_STATUS).toBe("UPDATE_ORDER_STATUS"));
  it("ALL equals values", () => expect(ALL_STAFF_PERMISSIONS.length).toBe(22));
  it("DEFAULT has 5 perms", () => expect(DEFAULT_STAFF_PERMISSIONS.length).toBe(5));
});

describe("isValidStaffPermission", () => {
  it("true for SELL_ON_POS", () => expect(isValidStaffPermission("SELL_ON_POS")).toBe(true));
  it("false for unknown", () => expect(isValidStaffPermission("HACK")).toBe(false));
  it("false for empty", () => expect(isValidStaffPermission("")).toBe(false));
});

describe("hasStaffPermission", () => {
  it("true when present", () => expect(hasStaffPermission(["SELL_ON_POS","VIEW_ORDERS"], "SELL_ON_POS")).toBe(true));
  it("false when absent", () => expect(hasStaffPermission(["VIEW_ORDERS"], "SELL_ON_POS")).toBe(false));
  it("false for empty array", () => expect(hasStaffPermission([], "SELL_ON_POS")).toBe(false));
});