/* eslint-disable @typescript-eslint/no-explicit-any */
export type ShipmentCheck = { ok: true; warehouseId: number | null } | { ok: false; message: string };

/** الشحنة الواحدة تخرج من مستودع واحد فقط. */
export function checkSingleWarehouse(warehouseIds: Array<number | null | undefined>): ShipmentCheck {
  const set = new Set<number>();
  for (const w of warehouseIds) if (typeof w === "number") set.add(w);
  if (set.size > 1) {
    return { ok: false, message: "العناصر موزعة على مستودعات مختلفة (" + Array.from(set).join("، ") + ")؛ انقلها إلى مستودع واحد أولاً" };
  }
  return { ok: true, warehouseId: set.size === 1 ? Array.from(set)[0] : null };
}

/** فحص مسبق برسالة واضحة (الضمان الحقيقي في قاعدة البيانات). */
export async function checkShipmentItems(db: any, fulfillmentItemIds: number[]): Promise<ShipmentCheck> {
  if (fulfillmentItemIds.length === 0) return { ok: true, warehouseId: null };
  const holds = await db.transferDiscrepancy.findMany({
    where: { fulfillmentItemId: { in: fulfillmentItemIds }, resolvedAt: null },
    select: { fulfillmentItemId: true },
  });
  if (holds.length > 0) {
    return { ok: false, message: "العناصر " + holds.map((h: any) => h.fulfillmentItemId).join("، ") + " عليها فرق نقل غير محسوم ولا يمكن شحنها" };
  }
  const items = await db.fulfillmentItem.findMany({ where: { id: { in: fulfillmentItemIds } }, select: { warehouseRefId: true } });
  return checkSingleWarehouse(items.map((i: any) => i.warehouseRefId));
}