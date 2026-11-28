import { LogisticsError } from "@/lib/logistics-errors";

/** السائق يجب أن يتبع نفس شركة المستودع، وإلا رفض واضح بدل خطأ من حارس القاعدة. */
export async function assertDriverWarehouseMatch(db: any, driverId: number, warehouseId: number): Promise<void> {
  const [drv, wh] = await Promise.all([
    db.deliveryPerson.findUnique({ where: { id: driverId }, select: { companyId: true } }),
    db.warehouse.findUnique({ where: { id: warehouseId }, select: { companyId: true } }),
  ]);
  if (!wh) throw new LogisticsError("المستودع غير موجود", 404);
  if (!drv) throw new LogisticsError("السائق غير موجود", 404);
  if (drv.companyId !== wh.companyId) throw new LogisticsError("السائق لا يتبع الشركة التي يتبعها هذا المستودع", 409);
}
