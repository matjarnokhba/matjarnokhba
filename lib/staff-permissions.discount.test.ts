import { describe, it, expect } from "vitest";
import {
  STAFF_PERMISSIONS,
  ALL_STAFF_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  PERMISSION_LABELS,
  isValidStaffPermission,
  hasStaffPermission,
} from "./staff-permissions";

describe("GIVE_DISCOUNT permission", () => {
  it("exists and is valid", () => {
    expect(STAFF_PERMISSIONS.GIVE_DISCOUNT).toBe("GIVE_DISCOUNT");
    expect(isValidStaffPermission("GIVE_DISCOUNT")).toBe(true);
    expect(ALL_STAFF_PERMISSIONS).toContain("GIVE_DISCOUNT");
  });

  it("is labelled and marked sensitive", () => {
    expect(PERMISSION_LABELS.GIVE_DISCOUNT.label.length).toBeGreaterThan(0);
    expect(PERMISSION_LABELS.GIVE_DISCOUNT.sensitive).toBe(true);
  });

  it("is NOT granted by default", () => {
    expect(DEFAULT_STAFF_PERMISSIONS).not.toContain("GIVE_DISCOUNT");
  });

  it("every permission has a label", () => {
    for (const key of ALL_STAFF_PERMISSIONS) {
      expect(PERMISSION_LABELS[key]).toBeDefined();
    }
  });

  it("hasStaffPermission checks the list", () => {
    expect(hasStaffPermission(["GIVE_DISCOUNT"], "GIVE_DISCOUNT")).toBe(true);
    expect(hasStaffPermission(["SELL_ON_POS"], "GIVE_DISCOUNT")).toBe(false);
  });
});