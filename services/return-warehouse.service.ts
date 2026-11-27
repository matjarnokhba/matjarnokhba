import { LogisticsError } from "@/lib/logistics-errors";

export const ReturnWarehouseService = {
  /**
   * مستودع المرتجع = مستودع الشحنة التي خرجت منها أصناف الطلب المرتجعة (الأحدث أولاً).
   * إن لم تُحدَّد أصناف أو لم توجد لها شحنة، نأخذ أحدث شحنة للطلب. بلا شحنة: خطأ واضح، لا قيمة افتراضية.
   */
  async resolve(tx: any, input: { orderId: number; orderItemIds: number[] }): Promise<number> {
    const pick = (where: any) =>
      tx.shipmentItem.findFirst({ where, orderBy: { id: "desc" }, select: { shipment: { select: { originWarehouseId: true } } } });
    let row = input.orderItemIds.length > 0 ? await pick({ orderId: input.orderId, orderItemId: { in: input.orderItemIds } }) : null;
    if (!row) row = await pick({ orderId: input.orderId });
    const id = row?.shipment?.originWarehouseId;
    if (id == null) throw new LogisticsError("تعذّر تحديد مستودع المرتجع: لا توجد شحنة لهذا الطلب", 409);
    return id;
  },
};
