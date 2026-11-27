/* eslint-disable @typescript-eslint/no-explicit-any */
import { LogisticsError } from "@/lib/logistics-errors";
import { assignmentDeniedMessage } from "@/lib/shipment-assignment-messages";
import { inWarehouseScope } from "@/lib/logistics-query-scope";
import type { ResolvedScope } from "@/lib/logistics-scope";
import { LogisticsScopeService } from "@/services/logistics-scope.service";
import { LogisticsTenancyService } from "@/services/logistics-tenancy.service";

/** كود منصة المتجر. مؤقت: حتى يحمل الطلب منصته (مرحلة لاحقة). */
export const STORE_PLATFORM_CODE = "NOKHBA";

export type ShipmentAssignment = { originWarehouseId: number; companyId: number; platformId: number };

export const ShipmentAssignmentService = {
  /**
   * يحدد المستودع والشركة والمنصة لشحنة جديدة، أو يفشل برسالة واضحة.
   * لا قيم افتراضية: المستودع من نطاق المستخدم، والشركة من المستودع، والمنصة من كود المتجر،
   * ثم يتحقق resolveAccess من أن المنصة والشركة والربط كلها نشطة.
   * يُستدعى داخل معاملة الإنشاء. scope اختياري (للاختبار).
   */
  async resolve(tx: any, input: { userId: number; warehouseId?: number | null; scope?: ResolvedScope; fulfillmentItemIds?: number[] }): Promise<ShipmentAssignment> {
    let scope = input.scope;
    if (!scope) {
      const u = await tx.user.findUnique({ where: { id: input.userId }, select: { role: true } });
      if (!u) throw new LogisticsError("المستخدم غير موجود", 403);
      scope = await LogisticsScopeService.forUser(input.userId, u.role);
    }

    let warehouseId: number;
    if (input.warehouseId != null) {
      if (!inWarehouseScope(scope, input.warehouseId)) throw new LogisticsError("المستودع خارج صلاحياتك", 403);
      warehouseId = input.warehouseId;
    } else if (scope.warehouseIds.length === 1) {
      warehouseId = scope.warehouseIds[0];
    } else if (scope.warehouseIds.length === 0) {
      throw new LogisticsError("لا تملك صلاحية على أي مستودع", 403);
    } else {
      throw new LogisticsError("حدد المستودع: لديك صلاحية على أكثر من مستودع", 400);
    }

    const w = await tx.warehouse.findUnique({ where: { id: warehouseId }, select: { id: true, companyId: true, status: true } });
    if (!w) throw new LogisticsError("المستودع غير موجود", 404);
    if (w.status !== "ACTIVE") throw new LogisticsError("المستودع غير مفعّل", 409);

    const p = await tx.clientPlatform.findUnique({ where: { code: STORE_PLATFORM_CODE }, select: { id: true } });
    if (!p) throw new LogisticsError("منصة المتجر غير معرّفة", 409);

    const access = await LogisticsTenancyService.resolveAccess(p.id, w.companyId, { tx });
    if (!access.allowed) throw new LogisticsError(assignmentDeniedMessage(access.reason), 409);

    const ids = input.fulfillmentItemIds ?? [];
    if (ids.length > 0) {
      const rows = await tx.fulfillmentItem.findMany({ where: { id: { in: ids } }, select: { id: true, warehouseRefId: true } });
      const elsewhere = rows.filter((r: any) => r.warehouseRefId != null && r.warehouseRefId !== w.id);
      if (elsewhere.length > 0) throw new LogisticsError("بعض المنتجات موجودة في مستودع آخر غير المستودع المحدد للشحنة", 409);
    }

    return { originWarehouseId: w.id, companyId: w.companyId, platformId: p.id };
  },
};