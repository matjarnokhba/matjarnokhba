import { LogisticsError } from "@/lib/logistics-errors";
import type { ResolvedScope } from "@/lib/logistics-scope";

/**
 * مستودع المستخدم الفاعل. لا قيمة افتراضية:
 * المحدد إن كان ضمن نطاقه، وإلا مستودعه الوحيد، وإلا خطأ واضح (لا نخمّن).
 */
export function resolveActorWarehouseId(scope: ResolvedScope, requested?: number | null): number {
  if (requested != null) {
    if (scope.warehouseIds.includes(requested)) return requested;
    throw new LogisticsError("المستودع خارج صلاحياتك", 403);
  }
  if (scope.warehouseIds.length === 1) return scope.warehouseIds[0];
  if (scope.warehouseIds.length === 0) throw new LogisticsError("لا تملك صلاحية على أي مستودع", 403);
  throw new LogisticsError("حدد المستودع: لديك صلاحية على أكثر من مستودع", 400);
}
