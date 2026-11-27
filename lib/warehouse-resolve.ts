/* eslint-disable @typescript-eslint/no-explicit-any */
export const DEFAULT_WAREHOUSE_ID = 1;

/** مستودع الطلب الفعلي = مستودع أحدث شحنة تحوي عناصره (الافتراضي 1). */
export async function resolveOrderWarehouseId(tx: any, orderId: number): Promise<number> {
  const si = await tx.shipmentItem.findFirst({
    where: { orderId },
    orderBy: { id: "desc" },
    select: { shipment: { select: { originWarehouseId: true } } },
  });
  return si?.shipment?.originWarehouseId ?? DEFAULT_WAREHOUSE_ID;
}

export async function resolveShipmentWarehouseId(tx: any, shipmentId: number): Promise<number> {
  const s = await tx.shipment.findUnique({ where: { id: shipmentId }, select: { originWarehouseId: true } });
  return s?.originWarehouseId ?? DEFAULT_WAREHOUSE_ID;
}