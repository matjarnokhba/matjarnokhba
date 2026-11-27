import type { ResolvedScope } from "@/lib/logistics-scope";

/** مستودع المستخدم الفاعل: المطلوب إن كان ضمن نطاقه، وإلا أول مستودع له (الأدمن: 1). */
export function resolveActorWarehouseId(scope: ResolvedScope, requested?: number | null): number {
  if (requested && (scope.platform || scope.warehouseIds.includes(requested))) return requested;
  if (scope.platform) return 1;
  return scope.warehouseIds[0] ?? 1;
}