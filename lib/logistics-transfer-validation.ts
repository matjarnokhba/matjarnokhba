import { z } from "zod";

const ids = z.array(z.number().int().positive()).min(1, "اختر عنصراً واحداً على الأقل").max(200);

export const transferCreateSchema = z
  .object({
    fromWarehouseId: z.number().int().positive("المستودع المصدر مطلوب"),
    toWarehouseId: z.number().int().positive("المستودع الوجهة مطلوب"),
    reason: z.string().trim().min(3, "سبب النقل مطلوب").max(300),
    notes: z.string().trim().max(500).optional(),
    fulfillmentItemIds: ids,
  })
  .refine((d) => d.fromWarehouseId !== d.toWarehouseId, { message: "المصدر والوجهة متطابقان" });

const receiveItem = z
  .object({
    fulfillmentItemId: z.number().int().positive(),
    outcome: z.enum(["RECEIVED", "PARTIAL", "DAMAGED", "MISSING"]),
    receivedQuantity: z.number().int().positive().optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((d) => d.outcome === "RECEIVED" || (d.note && d.note.length >= 3), {
    message: "سبب الفرق مطلوب عند وجود نقص أو تلف",
    path: ["note"],
  });

export const transferActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add_items"), fulfillmentItemIds: ids }),
  z.object({ action: z.literal("remove_items"), fulfillmentItemIds: ids }),
  z.object({ action: z.literal("prepare") }),
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("dispatch"), driverUserId: z.number().int().positive("السائق مطلوب") }),
  z.object({
    action: z.literal("receive"),
    items: z.array(receiveItem).min(1),
    receiptProofUrl: z.string().trim().url().max(500).optional(),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({ action: z.literal("close") }),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().min(3, "سبب الإلغاء مطلوب").max(300) }),
  z.object({
    action: z.literal("resolve_discrepancy"),
    discrepancyId: z.number().int().positive(),
    note: z.string().trim().min(3, "ملاحظة الحسم مطلوبة").max(300),
  }),
]);

export type TransferCreateInput = z.infer<typeof transferCreateSchema>;
export type TransferAction = z.infer<typeof transferActionSchema>;