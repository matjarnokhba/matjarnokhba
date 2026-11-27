/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { PartialDeliveryService } from "@/services/partial-delivery.service";
import { resolveShipmentWarehouseId } from "@/lib/warehouse-resolve";
import { LogisticsError } from "@/lib/logistics-errors";
import { logLogisticsAudit } from "@/lib/logistics-audit";
import type { Actor } from "@/services/logistics-admin.service";

type Opts = { tx?: any };

function run<T>(opts: Opts | undefined, fn: (tx: any) => Promise<T>): Promise<T> {
  if (opts?.tx) return fn(opts.tx);
  return (prisma as any).$transaction(fn, { timeout: 30000, maxWait: 10000 });
}

const money = (n: unknown) => Math.round(Number(n ?? 0) * 100) / 100;

export const ExternalDeliveryService = {
  /**
   * الإغلاق المالي لشحنة خارجية بعد إبلاغ الشركة بالتسليم أو الإرجاع.
   * يعيد استعمال منطق التسليم الداخلي (الطلبات، أرباح البائع المحجوزة، العمولة) بوضع خارجي:
   * بلا أجر سائق ولا نقد ولا ربح مستودع. يُسجَّل COD كدَين على الشركة حتى تسوية كشفها.
   */
  async close(actor: Actor, id: number, opts?: Opts) {
    if (!actor.scope.platform) throw new LogisticsError("هذه العملية للأدمن فقط", 403);
    return run(opts, async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ExternalShipment" WHERE "id" = ${id} FOR UPDATE`;
      const es = await tx.externalShipment.findUnique({
        where: { id },
        select: { id: true, shipmentId: true, providerId: true, companyId: true, status: true, active: true, closedAt: true },
      });
      if (!es) throw new LogisticsError("الشحنة الخارجية غير موجودة", 404);
      if (!es.active) throw new LogisticsError("الشحنة الخارجية غير نشطة", 409);
      if (es.closedAt) throw new LogisticsError("أُغلقت هذه الشحنة مالياً سابقاً", 409);
      const outcome = es.status === "DELIVERED" ? "DELIVERED" : es.status === "RETURNED" ? "RETURNED" : null;
      if (!outcome) throw new LogisticsError("لا يمكن الإغلاق إلا بعد إبلاغ الشركة بتسليم أو إرجاع", 409);

      const items = await tx.shipmentItem.findMany({ where: { shipmentId: es.shipmentId }, select: { id: true, orderId: true, quantity: true } });
      if (items.length === 0) throw new LogisticsError("الشحنة بلا عناصر", 409);
      const decisions = items.map((i: any) =>
        outcome === "RETURNED"
          ? { shipmentItemId: i.id, refusedQuantity: i.quantity, reason: "مرتجع من شركة التوصيل الخارجية" }
          : { shipmentItemId: i.id, refusedQuantity: 0 }
      );

      let r: any;
      try {
        r = await PartialDeliveryService.processPartialDelivery(es.shipmentId, 0, decisions, { tx, external: { actorId: actor.id } });
      } catch (e: any) {
        if (e instanceof LogisticsError) throw e;
        throw new LogisticsError(String(e?.message ?? "تعذّر الإغلاق").slice(0, 300), 409);
      }

      let receivableId: number | null = null;
      let shippingCharged = 0;
      if (outcome === "DELIVERED") {
        const orderIds: number[] = Array.from(new Set<number>(items.map((i: any) => i.orderId)));
        const orders = await tx.order.findMany({ where: { id: { in: orderIds } }, select: { shippingCost: true } });
        shippingCharged = money(orders.reduce((s: number, o: any) => s + Number(o.shippingCost ?? 0), 0));
        const warehouseId = await resolveShipmentWarehouseId(tx, es.shipmentId);
        const rec = await tx.externalCodReceivable.create({
          data: {
            externalShipmentId: es.id,
            shipmentId: es.shipmentId,
            providerId: es.providerId,
            companyId: es.companyId,
            warehouseId: warehouseId ?? null,
            amountDue: money(r.totalCOD),
            shippingCharged,
          },
          select: { id: true },
        });
        receivableId = rec.id;
      }
      await tx.externalShipment.update({ where: { id: es.id }, data: { closedAt: new Date(), closeOutcome: outcome } });
      await logLogisticsAudit(tx, {
        userId: actor.id,
        action: "LOGISTICS_EXTERNAL_CLOSE",
        entityType: "ExternalShipment",
        entityId: es.id,
        after: { outcome, totalCOD: money(r.totalCOD), shippingCharged, receivableId },
      });
      return { outcome, totalCOD: money(r.totalCOD), shippingCharged, receivableId };
    });
  },
};