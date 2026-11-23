import { describe, it, expect } from "vitest";
import {
  STAFF_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  PERMISSION_LABELS,
  isValidStaffPermission,
} from "./staff-permissions";

describe("stock and POS-return permissions", () => {
  const keys = ["ADD_STOCK", "APPROVE_STOCK", "VIEW_STOCK_HISTORY", "RETURN_POS_SALE"] as const;

  it("exist and are valid", () => {
    for (const k of keys) {
      expect(STAFF_PERMISSIONS[k]).toBe(k);
      expect(isValidStaffPermission(k)).toBe(true);
    }
  });

  it("are labelled and sensitive", () => {
    for (const k of keys) {
      expect(PERMISSION_LABELS[k].label.length).toBeGreaterThan(0);
      expect(PERMISSION_LABELS[k].sensitive).toBe(true);
    }
  });

  it("are never granted by default", () => {
    for (const k of keys) expect(DEFAULT_STAFF_PERMISSIONS).not.toContain(k);
  });
});