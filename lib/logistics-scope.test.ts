import { describe, it, expect } from "vitest";
import {
  resolveScope,
  canAccessWarehouse,
  canAccessCompany,
  hasJobRole,
  hasAnyLogisticsAccess,
  type MembershipLite,
} from "./logistics-scope";

const warehouses = [
  { id: 1, companyId: 1 },
  { id: 2, companyId: 1 },
  { id: 3, companyId: 2 },
];

const wm = (over: Partial<MembershipLite>): MembershipLite => ({
  scope: "WAREHOUSE",
  companyId: null,
  warehouseId: null,
  jobRoles: [],
  status: "ACTIVE",
  ...over,
});

describe("resolveScope", () => {
  it("admin = platform, sees every warehouse", () => {
    const s = resolveScope({ role: "ADMIN", memberships: [], warehouses });
    expect(s.platform).toBe(true);
    expect(canAccessWarehouse(s, 3)).toBe(true);
    expect(canAccessCompany(s, 2)).toBe(true);
    expect(hasJobRole(s, 3, "MANAGER")).toBe(true);
  });

  it("legacy warehouse manager without membership is scoped to warehouse 1", () => {
    const s = resolveScope({ role: "WAREHOUSE_MANAGER", memberships: [], warehouses });
    expect(s.platform).toBe(false);
    expect(canAccessWarehouse(s, 1)).toBe(true);
    expect(canAccessWarehouse(s, 2)).toBe(false);
    expect(hasJobRole(s, 1, "MANAGER")).toBe(true);
  });

  it("warehouse membership does not leak to other warehouses", () => {
    const s = resolveScope({
      role: "WAREHOUSE_MANAGER",
      memberships: [wm({ warehouseId: 2, jobRoles: ["MANAGER"] })],
      warehouses,
    });
    expect(canAccessWarehouse(s, 2)).toBe(true);
    expect(canAccessWarehouse(s, 1)).toBe(false);
    expect(canAccessCompany(s, 1)).toBe(false);
  });

  it("legacy fallback is not applied when an active membership exists", () => {
    const s = resolveScope({
      role: "WAREHOUSE_MANAGER",
      memberships: [wm({ warehouseId: 3, jobRoles: ["MANAGER"] })],
      warehouses,
    });
    expect(canAccessWarehouse(s, 1)).toBe(false);
    expect(canAccessWarehouse(s, 3)).toBe(true);
  });

  it("suspended and revoked memberships are ignored", () => {
    const s = resolveScope({
      role: "COLLECTOR",
      memberships: [
        wm({ warehouseId: 1, status: "SUSPENDED" }),
        wm({ warehouseId: 2, status: "REVOKED" }),
      ],
      warehouses,
    });
    expect(hasAnyLogisticsAccess(s)).toBe(false);
  });

  it("company membership expands to that company's warehouses only", () => {
    const s = resolveScope({
      role: "DELIVERY",
      memberships: [wm({ scope: "COMPANY", companyId: 1, jobRoles: ["MANAGER"] })],
      warehouses,
    });
    expect(canAccessCompany(s, 1)).toBe(true);
    expect(canAccessCompany(s, 2)).toBe(false);
    expect(canAccessWarehouse(s, 1)).toBe(true);
    expect(canAccessWarehouse(s, 2)).toBe(true);
    expect(canAccessWarehouse(s, 3)).toBe(false);
  });

  it("job roles are tracked per warehouse", () => {
    const s = resolveScope({
      role: "DELIVERY",
      memberships: [wm({ warehouseId: 1, jobRoles: ["RECEIVER", "WORKER"] })],
      warehouses,
    });
    expect(hasJobRole(s, 1, "RECEIVER")).toBe(true);
    expect(hasJobRole(s, 1, "MANAGER")).toBe(false);
    expect(hasJobRole(s, 2, "RECEIVER")).toBe(false);
  });

  it("platform membership grants platform scope", () => {
    const s = resolveScope({
      role: "DELIVERY",
      memberships: [wm({ scope: "PLATFORM" })],
      warehouses,
    });
    expect(s.platform).toBe(true);
    expect(canAccessWarehouse(s, 3)).toBe(true);
  });
});