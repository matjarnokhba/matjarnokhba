import type { ResolvedScope } from "@/lib/logistics-scope";

/** شرط Prisma يحصر السجلات في مستودعات نطاق المستخدم (الأدمن بلا قيود). */
export function warehouseWhere(scope: ResolvedScope, field = "warehouseRefId"): Record<string, unknown> {
  return scope.platform ? {} : { [field]: { in: scope.warehouseIds } };
}

/** شرط Prisma يحصر السجلات في شركات نطاق المستخدم. */
export function companyWhere(scope: ResolvedScope, field = "companyId"): Record<string, unknown> {
  return scope.platform ? {} : { [field]: { in: scope.companyIds } };
}

export function inWarehouseScope(scope: ResolvedScope, warehouseId: number | null | undefined): boolean {
  if (scope.platform) return true;
  return warehouseId != null && scope.warehouseIds.includes(warehouseId);
}