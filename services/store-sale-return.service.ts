import { InventoryService } from "./inventory.service";

// ═══════════════════════════════════════════
// StoreSaleReturnService
// الإرجاع من البيع في المحل (POS).
// - سجل البيع الأصلي لا يُعدَّل أبداً؛ الإرجاع سجل مستقل.
// - المبلغ المردود = السعر الذي بيعت به السلعة فعلاً.
// - صالحة للبيع → ترجع للمخزون؛ معيبة → مخزون العيوب.
// يجب استدعاؤها داخل prisma.$transaction.
// ═══════════════════════════════════════════

export type StoreSaleReturnErrorCode = "VALIDATION" | "NOT_FOUND";

export class StoreSaleReturnError extends Error {
  code: StoreSaleReturnErrorCode;
  constructor(message: string, code: StoreSaleReturnErrorCode) {
    super(message);
    this.name = "StoreSaleReturnError";
    this.code = code;
  }
}

function fail(code: StoreSaleReturnErrorCode, message: string): never {
  throw new StoreSaleReturnError(message, code);
}

export type PosReturnCondition = "RESELLABLE" | "DEFECTIVE";
export const POS_RETURN_WINDOW_MIN = 3;
export const POS_RETURN_WINDOW_MAX = 7;

/** يقبل عدداً صحيحاً بين 3 و7 فقط، وإلا null */
export function parseReturnWindowDays(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < POS_RETURN_WINDOW_MIN || value > POS_RETURN_WINDOW_MAX) return null;
  return value;
}

export type CreateStoreSaleReturnInput = {
  sellerId: number;
  storeSaleId: number;
  processedByUserId: number;
  reason?: string | null;
  items: { storeSaleItemId: number; quantity: number; condition: PosReturnCondition; note?: string | null }[];
  now?: Date;
};

function clean(v: string | null | undefined, max: number): string | null {
  const t = (v ?? "").trim();
  return t ? t.slice(0, max) : null;
}

export const StoreSaleReturnService = {
  async createReturn(tx: any, input: CreateStoreSaleReturnInput) {
    if (!Number.isInteger(input.storeSaleId) || input.storeSaleId <= 0) fail("VALIDATION", "رقم الإيصال غير صالح");
    if (!Array.isArray(input.items) || input.items.length === 0) fail("VALIDATION", "اختر بنداً واحداً على الأقل للإرجاع");
    if (input.items.length > 100) fail("VALIDATION", "عدد البنود أكبر من المسموح");

    const wanted = new Map<string, { storeSaleItemId: number; condition: PosReturnCondition; quantity: number; note: string | null }>();
    for (const it of input.items) {
      if (!Number.isInteger(it.storeSaleItemId) || it.storeSaleItemId <= 0) fail("VALIDATION", "بند الإيصال غير صالح");
      if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 100000) fail("VALIDATION", "الكمية يجب أن تكون عدداً صحيحاً موجباً");
      if (it.condition !== "RESELLABLE" && it.condition !== "DEFECTIVE") fail("VALIDATION", "حالة السلعة غير صالحة");
      const note = clean(it.note, 300);
      if (it.condition === "DEFECTIVE" && (!note || note.length < 3)) fail("VALIDATION", "اكتب وصف العيب");
      const key = `${it.storeSaleItemId}:${it.condition}`;
      const cur = wanted.get(key);
      if (cur) cur.quantity += it.quantity;
      else wanted.set(key, { storeSaleItemId: it.storeSaleItemId, condition: it.condition, quantity: it.quantity, note });
    }

    // قفل صف البيع: يمنع إرجاعين متزامنين من تجاوز الكمية المباعة
    const rows = await tx.$queryRaw`
      SELECT id FROM "StoreSale"
      WHERE id = ${input.storeSaleId} AND "sellerId" = ${input.sellerId}
      FOR UPDATE
    `;
    if (!rows || !rows[0]) fail("NOT_FOUND", "الإيصال غير موجود");

    const sale = await tx.storeSale.findFirst({
      where: { id: input.storeSaleId, sellerId: input.sellerId },
      include: { items: true },
    });
    if (!sale) fail("NOT_FOUND", "الإيصال غير موجود");

    const seller = await tx.seller.findUnique({
      where: { id: input.sellerId },
      select: { posReturnWindowDays: true },
    });
    const days = parseReturnWindowDays(seller?.posReturnWindowDays) ?? POS_RETURN_WINDOW_MAX;
    const now = input.now ?? new Date();
    if (now.getTime() - new Date(sale.createdAt).getTime() > days * 86400000) {
      fail("VALIDATION", `انتهت مدة الإرجاع (${days} أيام من تاريخ البيع)`);
    }

    const saleItems = new Map<number, any>((sale.items as any[]).map((i) => [i.id, i]));
    const itemIds = [...new Set([...wanted.values()].map((w) => w.storeSaleItemId))];
    for (const id of itemIds) {
      if (!saleItems.has(id)) fail("VALIDATION", "أحد البنود لا يتبع هذا الإيصال");
    }

    const prev: any[] = await tx.storeSaleReturnItem.groupBy({
      by: ["storeSaleItemId"],
      where: { storeSaleItemId: { in: itemIds } },
      _sum: { quantity: true },
    });
    const returned = new Map<number, number>(prev.map((p) => [p.storeSaleItemId, p._sum.quantity ?? 0]));

    const requested = new Map<number, number>();
    for (const w of wanted.values()) requested.set(w.storeSaleItemId, (requested.get(w.storeSaleItemId) ?? 0) + w.quantity);
    for (const [id, qty] of requested) {
      const remaining = saleItems.get(id).quantity - (returned.get(id) ?? 0);
      if (remaining <= 0) fail("VALIDATION", "تم إرجاع كامل كمية هذا البند مسبقاً");
      if (qty > remaining) fail("VALIDATION", `الكمية المتاحة للإرجاع ${remaining} فقط`);
    }

    const lines = [...wanted.values()]
      .sort((a, b) => a.storeSaleItemId - b.storeSaleItemId || a.condition.localeCompare(b.condition))
      .map((w) => {
        const si = saleItems.get(w.storeSaleItemId);
        const unitPrice = Number(si.unitPrice);
        return {
          storeSaleItemId: w.storeSaleItemId,
          variantId: si.variantId as number,
          quantity: w.quantity,
          unitPrice,
          total: Number((w.quantity * unitPrice).toFixed(2)),
          condition: w.condition,
          note: w.note,
        };
      });
    const refundTotal = Number(lines.reduce((s, l) => s + l.total, 0).toFixed(2));

    const created = await tx.storeSaleReturn.create({
      data: {
        sellerId: input.sellerId,
        storeSaleId: input.storeSaleId,
        processedByUserId: input.processedByUserId,
        reason: clean(input.reason, 500),
        refundMethod: "CASH",
        refundTotal,
        items: { create: lines },
      },
      include: { items: true },
    });

    const items: any[] = [...created.items].sort((a, b) => a.variantId - b.variantId || a.id - b.id);
    let resellableQty = 0;
    let defectiveQty = 0;
    for (const it of items) {
      const base = `إرجاع من بيع المحل (إيصال ${sale.receiptNumber})`;
      if (it.condition === "RESELLABLE") {
        await InventoryService.returnFromStoreSale(tx, it.variantId, it.quantity, {
          returnItemId: it.id,
          performedById: input.processedByUserId,
          reason: base + (it.note ? ` - ${it.note}` : ""),
        });
        resellableQty += it.quantity;
      } else {
        await InventoryService.addDefective(tx, it.variantId, it.quantity, {
          referenceType: "STORE_SALE_RETURN",
          referenceId: it.id,
          performedById: input.processedByUserId,
          reason: `${base} - سلعة معيبة: ${it.note}`,
        });
        defectiveQty += it.quantity;
      }
    }

    return { returnId: created.id as number, refundTotal, resellableQty, defectiveQty };
  },
};