export type LogisticsScopeKind = "PLATFORM" | "COMPANY" | "WAREHOUSE";
export type LogisticsMembershipState = "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface MembershipLite {
  scope: LogisticsScopeKind;
  companyId: number | null;
  warehouseId: number | null;
  jobRoles: string[];
  status: LogisticsMembershipState;
}

export interface WarehouseLite {
  id: number;
  companyId: number;
}

export interface ResolvedScope {
  platform: boolean;
  companyIds: number[];
  warehouseIds: number[];
  jobRolesByWarehouse: Record<number, string[]>;
}

/** المستودع الافتراضي: السلوك القديم (مدير مستودع واحد) يُعامل كعضوية في هذا المستودع. */
export const LEGACY_DEFAULT_WAREHOUSE_ID = 1;

const PLATFORM_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);

export function resolveScope(input: {
  role: string;
  memberships: MembershipLite[];
  warehouses: WarehouseLite[];
}): ResolvedScope {
  const active = input.memberships.filter((m) => m.status === "ACTIVE");
  const platform =
    PLATFORM_ROLES.has(input.role) || active.some((m) => m.scope === "PLATFORM");

  const companyIds = new Set<number>();
  const warehouseIds = new Set<number>();
  const roles: Record<number, Set<string>> = {};

  const addWarehouse = (id: number, jobRoles: string[]) => {
    warehouseIds.add(id);
    if (!roles[id]) roles[id] = new Set<string>();
    for (const r of jobRoles) roles[id].add(r);
  };

  for (const m of active) {
    if (m.scope === "COMPANY" && m.companyId != null) {
      companyIds.add(m.companyId);
      for (const w of input.warehouses) {
        if (w.companyId === m.companyId) addWarehouse(w.id, m.jobRoles);
      }
    } else if (m.scope === "WAREHOUSE" && m.warehouseId != null) {
      addWarehouse(m.warehouseId, m.jobRoles);
    }
  }

  if (input.role === "WAREHOUSE_MANAGER" && active.length === 0) {
    addWarehouse(LEGACY_DEFAULT_WAREHOUSE_ID, ["MANAGER"]);
  }

  if (platform) {
    for (const w of input.warehouses) warehouseIds.add(w.id);
  }

  const jobRolesByWarehouse: Record<number, string[]> = {};
  for (const key of Object.keys(roles)) {
    jobRolesByWarehouse[Number(key)] = Array.from(roles[Number(key)]);
  }

  return {
    platform,
    companyIds: Array.from(companyIds),
    warehouseIds: Array.from(warehouseIds),
    jobRolesByWarehouse,
  };
}

export function canAccessWarehouse(scope: ResolvedScope, warehouseId: number): boolean {
  return scope.platform || scope.warehouseIds.includes(warehouseId);
}

export function canAccessCompany(scope: ResolvedScope, companyId: number): boolean {
  return scope.platform || scope.companyIds.includes(companyId);
}

export function hasJobRole(scope: ResolvedScope, warehouseId: number, jobRole: string): boolean {
  if (scope.platform) return true;
  return (scope.jobRolesByWarehouse[warehouseId] ?? []).includes(jobRole);
}

export function hasAnyLogisticsAccess(scope: ResolvedScope): boolean {
  return scope.platform || scope.warehouseIds.length > 0 || scope.companyIds.length > 0;
}