import { ActorWarehouse } from "@/services/actor-warehouse.service";
import { LogisticsError } from "@/lib/logistics-errors";

/**
 * مستودع دفعة (مرفوضات السائق / مرتجعات التاجر) = مستودع الشحنات التي خرجت منها الأصناف المعلّقة.
 * يجب أن يكون ضمن نطاق المستخدم الفاعل. أصناف من أكثر من مستودع: رفض واضح بدل التخمين.
 */
export async function resolveBatchWarehouseId(db: any, shipmentItemIds: number[], actorUserId: number): Promise<number> {
  if (shipmentItemIds.length === 0) throw new LogisticsError("تعذّر تحديد مستودع الدفعة: لا توجد أصناف", 409);
  const rows = await db.shipmentItem.findMany({
    where: { id: { in: shipmentItemIds } },
    select: { shipment: { select: { originWarehouseId: true } } },
  });
  const ids = Array.from(new Set<number>(rows.map((r: any) => r.shipment.originWarehouseId)));
  if (ids.length === 0) throw new LogisticsError("تعذّر تحديد مستودع الدفعة", 409);
  if (ids.length > 1) throw new LogisticsError("الأصناف المعلّقة موزّعة على أكثر من مستودع، عالج كل مستودع على حدة", 409);
  return ActorWarehouse.forUser(actorUserId, ids[0]);
}
