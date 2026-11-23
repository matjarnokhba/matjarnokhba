import { InventoryService } from "./inventory.service";

// ═══════════════════════════════════════════
// StockReceiptService
// طلبات إضافة المخزون: إنشاء، اعتماد، رفض.
// يجب استدعاء كل دالة داخل prisma.$transaction.
// المخزون بانتظار الموافقة لا يلمس Inventory.quantity أبداً.
// ═══════════════════════════════════════════

export type StockReceiptErrorCode = "VALIDATION" | "CONFLICT" | "NOT_FOUND";

export class StockReceiptError extends Error {
  code: StockReceiptErrorCode;
  constructor(message: string, code: StockReceiptErrorCode) {
    super(message);
    this.name = "StockReceiptError";
    this.code = code;
  }
}

function fail(code: StockReceiptErrorCode, message: string): never {
  throw new StockReceiptError(message, code);
}

export const STOCK_SOURCE_TYPES = [
  "SUPPLIER",
  "FACTORY",
  "OTHER_STORE",
  "WHOLESALE_MARKET",
  "BRANCH_TRANSFER",
  "PLATFORM_TRANSFER",
  "OTHER",
] as const;
export type StockSourceType = (typeof STOCK_SOURCE_TYPES)[number];

const MAX_QTY = 1_000_000;
const MAX_ITEMS = 200;

export type CreateReceiptInput = {
  sellerId: number;
  enteredByUserId: number;
  actorIsOwner: boolean;
  sourceType: StockSourceType;
  sourceName?: string | null;
  sourcePhone?: string | null;
  sourceNote?: string | null;
  totalCost?: number | null;
  invoiceUrl?: string | null;
  invoiceName?: string | null;
  purchasedByUserId?: number | null;
  receivedByUserId?: number | null;
  externalRefType?: string | null;
  externalRefId?: number | null;
  items: { variantId: number; quantity: number; unitCost?: number | null }[];
};

export type ApproveReceiptInput = {
  receiptId: number;
  sellerId: number;
  decidedByUserId: number;
  adjustments?: { itemId: number; approvedQuantity: number; reason?: string | null }[];
};

export type RejectReceiptInput = {
  receiptId: number;
  sellerId: number;
  decidedByUserId: number;
  reason: string;
};

function clean(v: string | null | undefined, max = 500): string | null {
  const t = (v ?? "").trim();
  return t ? t.slice(0, max) : null;
}

export type UpdateReceiptInput = {
  receiptId: number;
  sellerId: number;
  actorUserId: number;
  sourceType?: StockSourceType;
  sourceName?: string | null;
  sourcePhone?: string | null;
  sourceNote?: string | null;
  totalCost?: number | null;
  invoiceUrl?: string | null;
  invoiceName?: string | null;
  items?: { itemId: number; quantity: number; unitCost?: number | null }[];
};
export const StockReceiptService = {
  // ═══════ إنشاء طلب إضافة مخزون ═══════
  async createReceipt(tx: any, input: CreateReceiptInput) {
    if (!STOCK_SOURCE_TYPES.includes(input.sourceType)) fail("VALIDATION", "مصدر المخزون غير صالح");
    if (!Array.isArray(input.items) || input.items.length === 0) fail("VALIDATION", "أضف عنصراً واحداً على الأقل");
    if (input.items.length > MAX_ITEMS) fail("VALIDATION", "عدد العناصر أكبر من المسموح");

    const merged = new Map<number, { quantity: number; unitCost: number | null }>();
    for (const it of input.items) {
      if (!Number.isInteger(it.variantId) || it.variantId <= 0) fail("VALIDATION", "خيار المنتج غير صالح");
      if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > MAX_QTY) {
        fail("VALIDATION", "الكمية يجب أن تكون عدداً صحيحاً موجباً");
      }
      const cost = it.unitCost ?? null;
      if (cost !== null && (!Number.isFinite(cost) || cost < 0)) fail("VALIDATION", "تكلفة الوحدة غير صالحة");
      const cur = merged.get(it.variantId);
      if (cur) {
        cur.quantity += it.quantity;
        if (cur.quantity > MAX_QTY) fail("VALIDATION", "الكمية أكبر من المسموح");
      } else {
        merged.set(it.variantId, { quantity: it.quantity, unitCost: cost });
      }
    }

    const totalCost = input.totalCost ?? null;
    if (totalCost !== null && (!Number.isFinite(totalCost) || totalCost < 0)) fail("VALIDATION", "التكلفة الإجمالية غير صالحة");

    if (input.sourceType === "OTHER" && !clean(input.sourceNote) && !clean(input.sourceName)) {
      fail("VALIDATION", "اكتب تفاصيل المصدر");
    }

    const extType = clean(input.externalRefType, 40);
    const extId = input.externalRefId ?? null;
    if ((extType === null) !== (extId === null)) fail("VALIDATION", "مرجع العملية ناقص");
    if (extId !== null && (!Number.isInteger(extId) || extId <= 0)) fail("VALIDATION", "مرجع العملية غير صالح");
    if (input.sourceType === "PLATFORM_TRANSFER" && extType === null) {
      fail("VALIDATION", "التحويل من المنصة يتطلب مرجع العملية");
    }

    const ids = [...merged.keys()].sort((a, b) => a - b);
    const variants: { id: number; productId: number }[] = await tx.productVariant.findMany({
      where: { id: { in: ids }, sellerId: input.sellerId, isActive: true, product: { deletedAt: null } },
      select: { id: true, productId: true },
    });
    if (variants.length !== ids.length) fail("VALIDATION", "بعض الخيارات غير موجودة أو غير نشطة في متجرك");
    const productOf = new Map(variants.map((v) => [v.id, v.productId]));

    // ═══ منع التكرار: بمرجع العملية لا بمطابقة المنتج والعدد ═══
    if (extType !== null && extId !== null) {
      const dup = await tx.stockReceipt.findFirst({
        where: { sellerId: input.sellerId, externalRefType: extType, externalRefId: extId },
        select: { id: true },
      });
      if (dup) fail("CONFLICT", `هذه العملية مسجلة مسبقاً (طلب #${dup.id})`);

      if (extType === "TRANSFER") {
        const auto = await tx.inventoryMovement.findFirst({
          where: {
            referenceType: "TRANSFER",
            referenceId: BigInt(extId),
            inventory: { variantId: { in: ids } },
          },
          select: { id: true },
        });
        if (auto) fail("CONFLICT", "هذه الكمية أُضيفت تلقائياً من عملية التحويل ولا تُدخل يدوياً");
      }
    }

    const receipt = await tx.stockReceipt.create({
      data: {
        sellerId: input.sellerId,
        status: "PENDING",
        sourceType: input.sourceType,
        sourceName: clean(input.sourceName, 200),
        sourcePhone: clean(input.sourcePhone, 40),
        sourceNote: clean(input.sourceNote, 1000),
        totalCost: totalCost === null ? null : Number(totalCost.toFixed(2)),
        invoiceUrl: clean(input.invoiceUrl, 1000),
        invoiceName: clean(input.invoiceName, 200),
        purchasedByUserId: input.purchasedByUserId ?? null,
        receivedByUserId: input.receivedByUserId ?? input.enteredByUserId,
        enteredByUserId: input.enteredByUserId,
        externalRefType: extType,
        externalRefId: extId,
        items: {
          create: ids.map((variantId) => ({
            productId: productOf.get(variantId)!,
            variantId,
            quantity: merged.get(variantId)!.quantity,
            unitCost: merged.get(variantId)!.unitCost,
          })),
        },
      },
      include: { items: true },
    });

    if (input.actorIsOwner) {
      const r = await this.approveReceipt(tx, {
        receiptId: receipt.id,
        sellerId: input.sellerId,
        decidedByUserId: input.enteredByUserId,
      });
      return { receiptId: receipt.id as number, status: "APPROVED" as const, added: r.added };
    }
    return { receiptId: receipt.id as number, status: "PENDING" as const, added: 0 };
  },

  // ═══════ اعتماد الطلب (مع إمكانية تعديل الكميات بسبب موثّق) ═══════
  async approveReceipt(tx: any, input: ApproveReceiptInput) {
    const receipt = await tx.stockReceipt.findFirst({
      where: { id: input.receiptId, sellerId: input.sellerId },
      include: { items: true },
    });
    if (!receipt) fail("NOT_FOUND", "طلب الإضافة غير موجود");
    if (receipt.status !== "PENDING") fail("CONFLICT", "تم البت في هذا الطلب مسبقاً");

    const items: any[] = [...receipt.items].sort((a, b) => (a.variantId ?? 0) - (b.variantId ?? 0));
    const adj = new Map<number, { approvedQuantity: number; reason: string | null }>();
    for (const a of input.adjustments ?? []) {
      const item = items.find((i) => i.id === a.itemId);
      if (!item) fail("VALIDATION", "بند التعديل لا يتبع هذا الطلب");
      if (!Number.isInteger(a.approvedQuantity) || a.approvedQuantity < 0 || a.approvedQuantity > MAX_QTY) {
        fail("VALIDATION", "الكمية المعتمدة غير صالحة");
      }
      const reason = clean(a.reason, 300);
      if (a.approvedQuantity !== item.quantity && (!reason || reason.length < 3)) {
        fail("VALIDATION", "اكتب سبب تعديل الكمية (خطأ في الكتابة أو غيره)");
      }
      adj.set(a.itemId, { approvedQuantity: a.approvedQuantity, reason });
    }

    let accepted = 0;
    for (const it of items) {
      if (it.variantId == null) fail("VALIDATION", "الخيار الجديد غير مدعوم بعد في هذه النسخة");
      accepted += adj.has(it.id) ? adj.get(it.id)!.approvedQuantity : it.quantity;
    }
    if (accepted <= 0) fail("VALIDATION", "لا توجد كمية معتمدة، استخدم الرفض بدلاً من ذلك");

    // ═══ مطالبة ذرّية: طلب واحد يُعتمد مرة واحدة فقط ═══
    const claimed = await tx.stockReceipt.updateMany({
      where: { id: input.receiptId, sellerId: input.sellerId, status: "PENDING" },
      data: { status: "APPROVED", decidedByUserId: input.decidedByUserId, decidedAt: new Date() },
    });
    if (claimed.count !== 1) fail("CONFLICT", "تم البت في هذا الطلب مسبقاً");
    // إعادة قراءة البنود بعد المطالبة: أي تعديل من الموظف أثناء الاعتماد يُبطل العملية (تتراجع المعاملة)
    const after = await tx.stockReceipt.findFirst({
      where: { id: input.receiptId, sellerId: input.sellerId },
      include: { items: true },
    });
    const sig = (arr: any[]) => arr.map((i) => `${i.id}:${i.variantId}:${i.quantity}`).sort().join("|");
    if (!after || sig(after.items) !== sig(items)) {
      fail("CONFLICT", "عُدّل الطلب أثناء الاعتماد، راجعه وأعد المحاولة");
    }

    for (const it of items) {
      const a = adj.get(it.id);
      const qty = a ? a.approvedQuantity : it.quantity;
      await tx.stockReceiptItem.update({
        where: { id: it.id },
        data: { approvedQuantity: qty, adjustmentReason: a?.reason ?? null },
      });
      if (qty > 0) {
        await InventoryService.receiveStock(tx, it.variantId, qty, {
          receiptItemId: it.id,
          performedById: input.decidedByUserId,
          reason:
            `اعتماد طلب إضافة مخزون #${receipt.id}` +
            (a && a.approvedQuantity !== it.quantity ? ` (كمية معدّلة: ${a.reason})` : ""),
        });
      }
    }
    return { receiptId: receipt.id as number, status: "APPROVED" as const, added: accepted };
  },

  // ═══════ تعديل طلب بانتظار الموافقة (صاحب الإدخال فقط، قبل بتّ التاجر) ═══════
  async updatePendingReceipt(tx: any, input: UpdateReceiptInput) {
    const receipt = await tx.stockReceipt.findFirst({
      where: { id: input.receiptId, sellerId: input.sellerId },
      include: { items: true },
    });
    if (!receipt) fail("NOT_FOUND", "طلب الإضافة غير موجود");
    if (receipt.enteredByUserId !== input.actorUserId) {
      fail("CONFLICT", "يمكنك تعديل الطلبات التي أدخلتها أنت فقط");
    }
    if (receipt.status !== "PENDING") fail("CONFLICT", "تم البت في هذا الطلب ولم يعد التعديل ممكناً");

    const data: Record<string, unknown> = {};
    const setIf = (key: string, next: unknown, cur: unknown) => {
      if ((next ?? null) !== (cur ?? null)) data[key] = next ?? null;
    };

    if (input.sourceType !== undefined) {
      if (!STOCK_SOURCE_TYPES.includes(input.sourceType)) fail("VALIDATION", "مصدر المخزون غير صالح");
      if (input.sourceType !== receipt.sourceType && receipt.externalRefType !== null) {
        fail("VALIDATION", "لا يمكن تغيير مصدر طلب مرتبط بعملية تحويل");
      }
      setIf("sourceType", input.sourceType, receipt.sourceType);
    }
    if (input.sourceName !== undefined) setIf("sourceName", clean(input.sourceName, 200), receipt.sourceName);
    if (input.sourcePhone !== undefined) setIf("sourcePhone", clean(input.sourcePhone, 40), receipt.sourcePhone);
    if (input.sourceNote !== undefined) setIf("sourceNote", clean(input.sourceNote, 1000), receipt.sourceNote);
    if (input.invoiceUrl !== undefined) setIf("invoiceUrl", clean(input.invoiceUrl, 1000), receipt.invoiceUrl);
    if (input.invoiceName !== undefined) setIf("invoiceName", clean(input.invoiceName, 200), receipt.invoiceName);
    if (input.totalCost !== undefined) {
      const c = input.totalCost;
      if (c !== null && (!Number.isFinite(c) || c < 0)) fail("VALIDATION", "التكلفة الإجمالية غير صالحة");
      setIf(
        "totalCost",
        c === null ? null : Number(c.toFixed(2)),
        receipt.totalCost == null ? null : Number(receipt.totalCost)
      );
    }

    const finalType = "sourceType" in data ? data.sourceType : receipt.sourceType;
    const finalName = "sourceName" in data ? data.sourceName : receipt.sourceName;
    const finalNote = "sourceNote" in data ? data.sourceNote : receipt.sourceNote;
    if (finalType === "OTHER" && !finalName && !finalNote) fail("VALIDATION", "اكتب تفاصيل المصدر");

    const itemUpdates: { id: number; data: { quantity: number; unitCost: number | null } }[] = [];
    const seen = new Set<number>();
    const finalQty = new Map<number, number>(receipt.items.map((i: any) => [i.id, i.quantity]));
    for (const u of input.items ?? []) {
      const item = receipt.items.find((i: any) => i.id === u.itemId);
      if (!item) fail("VALIDATION", "بند التعديل لا يتبع هذا الطلب");
      if (seen.has(u.itemId)) fail("VALIDATION", "بند مكرر في التعديل");
      seen.add(u.itemId);
      if (!Number.isInteger(u.quantity) || u.quantity < 0 || u.quantity > MAX_QTY) {
        fail("VALIDATION", "الكمية يجب أن تكون عدداً صحيحاً");
      }
      const curCost = item.unitCost == null ? null : Number(item.unitCost);
      let nextCost = curCost;
      if (u.unitCost !== undefined) {
        if (u.unitCost !== null && (!Number.isFinite(u.unitCost) || u.unitCost < 0)) {
          fail("VALIDATION", "تكلفة الوحدة غير صالحة");
        }
        nextCost = u.unitCost === null ? null : Number(u.unitCost.toFixed(2));
      }
      finalQty.set(u.itemId, u.quantity);
      if (u.quantity !== item.quantity || nextCost !== curCost) {
        itemUpdates.push({ id: u.itemId, data: { quantity: u.quantity, unitCost: nextCost } });
      }
    }
    let total = 0;
    for (const q of finalQty.values()) total += q;
    if (total <= 0) fail("VALIDATION", "يجب أن تبقى كمية واحدة على الأقل في الطلب");
    if (Object.keys(data).length === 0 && itemUpdates.length === 0) fail("VALIDATION", "لا توجد تغييرات للحفظ");

    // مطالبة ذرّية: تفشل إن بتّ التاجر في الطلب في هذه الأثناء
    const claimed = await tx.stockReceipt.updateMany({
      where: {
        id: input.receiptId,
        sellerId: input.sellerId,
        status: "PENDING",
        enteredByUserId: input.actorUserId,
      },
      data: { ...data, updatedAt: new Date() },
    });
    if (claimed.count !== 1) fail("CONFLICT", "تم البت في هذا الطلب ولم يعد التعديل ممكناً");

    for (const u of itemUpdates) {
      await tx.stockReceiptItem.update({ where: { id: u.id }, data: u.data });
    }
    return { receiptId: input.receiptId, status: "PENDING" as const };
  },

  // ═══════ رفض الطلب (لا أثر على المخزون، ويبقى السجل) ═══════
  async rejectReceipt(tx: any, input: RejectReceiptInput) {
    const reason = clean(input.reason, 500);
    if (!reason || reason.length < 3) fail("VALIDATION", "اكتب سبب الرفض");

    const claimed = await tx.stockReceipt.updateMany({
      where: { id: input.receiptId, sellerId: input.sellerId, status: "PENDING" },
      data: {
        status: "REJECTED",
        decidedByUserId: input.decidedByUserId,
        decidedAt: new Date(),
        rejectionReason: reason,
      },
    });
    if (claimed.count !== 1) {
      const exists = await tx.stockReceipt.findFirst({
        where: { id: input.receiptId, sellerId: input.sellerId },
        select: { id: true },
      });
      if (!exists) fail("NOT_FOUND", "طلب الإضافة غير موجود");
      fail("CONFLICT", "تم البت في هذا الطلب مسبقاً");
    }
    return { receiptId: input.receiptId, status: "REJECTED" as const };
  },
};