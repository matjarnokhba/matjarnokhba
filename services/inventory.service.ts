import { FlashDealService } from "./flash-deal.service";
import { PoolService } from "./pool.service";

// ═══════════════════════════════════════════
// InventoryService
// البوابة الوحيدة لتعديل المخزون
// المرجع: DECISIONS.md Section 12
// ═══════════════════════════════════════════

type LockedInventory = {
  id: number;
  quantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  defectiveQuantity: number;
};

export const InventoryService = {
  // ═══════ إرجاع سلعة صالحة للبيع من بيع المحل (POS) ═══════
  async returnFromStoreSale(
    tx: any,
    variantId: number,
    quantity: number,
    opts: { returnItemId: number; performedById: number; reason: string }
  ) {
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("الكمية يجب أن تكون موجبة");

    const inv = await this.lockInventory(tx, variantId);

    const already = await this.hasMovement(tx, "STORE_SALE_RETURN", opts.returnItemId, "RETURN", inv.id);
    if (already) return { inventoryId: inv.id, returned: 0, idempotent: true };

    const beforeQty = inv.quantity;
    const afterQty = beforeQty + quantity;

    await tx.inventory.update({ where: { id: inv.id }, data: { quantity: afterQty } });
    await PoolService.syncInventoryToPool(tx, variantId, quantity);

    await tx.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        type: "RETURN",
        beforeQuantity: beforeQty,
        afterQuantity: afterQty,
        quantityChange: quantity,
        beforeReserved: inv.reservedQuantity,
        afterReserved: inv.reservedQuantity,
        reservedChange: 0,
        reason: opts.reason,
        referenceType: "STORE_SALE_RETURN",
        referenceId: BigInt(opts.returnItemId),
        performedById: opts.performedById,
      },
    });

    return { inventoryId: inv.id, returned: quantity, idempotent: false };
  },
  // ═══════ استلام مخزون معتمد من طلب إضافة (StockReceipt) ═══════
  async receiveStock(
    tx: any,
    variantId: number,
    quantity: number,
    opts: { receiptItemId: number; performedById: number; reason: string }
  ) {
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("الكمية يجب أن تكون موجبة");

    const inv = await this.lockInventory(tx, variantId);

    // Idempotency: كل بند في الطلب يُضاف مرة واحدة فقط
    const already = await this.hasMovement(tx, "STOCK_RECEIPT", opts.receiptItemId, "STOCK_IN", inv.id);
    if (already) return { inventoryId: inv.id, added: 0, idempotent: true };

    const beforeQty = inv.quantity;
    const afterQty = beforeQty + quantity;

    await tx.inventory.update({ where: { id: inv.id }, data: { quantity: afterQty } });
    await PoolService.syncInventoryToPool(tx, variantId, quantity);

    await tx.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        type: "STOCK_IN",
        beforeQuantity: beforeQty,
        afterQuantity: afterQty,
        quantityChange: quantity,
        beforeReserved: inv.reservedQuantity,
        afterReserved: inv.reservedQuantity,
        reservedChange: 0,
        reason: opts.reason,
        referenceType: "STOCK_RECEIPT",
        referenceId: BigInt(opts.receiptItemId),
        receiptItemId: opts.receiptItemId,
        performedById: opts.performedById,
      },
    });

    return { inventoryId: inv.id, added: quantity, idempotent: false };
  },

  // ═══════ مخزون العيوب: لا يدخل الكمية القابلة للبيع أبداً ═══════
  async addDefective(
    tx: any,
    variantId: number,
    quantity: number,
    opts: {
      referenceType: "STORE_SALE_RETURN";
      referenceId: number;
      performedById: number;
      reason: string;
    }
  ) {
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("الكمية يجب أن تكون موجبة");

    const inv = await this.lockInventory(tx, variantId);

    const already = await this.hasMovement(tx, opts.referenceType, opts.referenceId, "RETURN", inv.id);
    if (already) return { inventoryId: inv.id, added: 0, idempotent: true };

    const beforeQty = inv.defectiveQuantity ?? 0;
    const afterQty = beforeQty + quantity;

    await tx.inventory.update({ where: { id: inv.id }, data: { defectiveQuantity: afterQty } });

    await tx.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        type: "RETURN",
        stockBucket: "DEFECTIVE",
        beforeQuantity: beforeQty,
        afterQuantity: afterQty,
        quantityChange: quantity,
        beforeReserved: inv.reservedQuantity,
        afterReserved: inv.reservedQuantity,
        reservedChange: 0,
        reason: opts.reason,
        referenceType: opts.referenceType,
        referenceId: BigInt(opts.referenceId),
        performedById: opts.performedById,
      },
    });

    return { inventoryId: inv.id, added: quantity, idempotent: false };
  },
  // ═══════ إخراج سلعة من مخزون العيوب: إتلاف أو إصلاح وإعادة للبيع ═══════
  async resolveDefective(
    tx: any,
    variantId: number,
    quantity: number,
    action: "WRITE_OFF" | "RESTOCK",
    opts: { performedById: number; reason: string }
  ) {
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("الكمية يجب أن تكون موجبة");
    if (action !== "WRITE_OFF" && action !== "RESTOCK") throw new Error("إجراء غير صالح");
    const reason = (opts.reason ?? "").trim();
    if (reason.length < 3) throw new Error("اكتب سبباً واضحاً");

    const inv = await this.lockInventory(tx, variantId);
    const beforeDef = inv.defectiveQuantity ?? 0;
    if (quantity > beforeDef) throw new Error("الكمية أكبر من المعيب المتوفر (" + beforeDef + ")");

    const afterDef = beforeDef - quantity;
    const beforeQty = inv.quantity;
    const afterQty = action === "RESTOCK" ? beforeQty + quantity : beforeQty;

    const data: { defectiveQuantity: number; quantity?: number } = { defectiveQuantity: afterDef };
    if (action === "RESTOCK") data.quantity = afterQty;
    await tx.inventory.update({ where: { id: inv.id }, data });

    if (action === "RESTOCK") {
      await PoolService.syncInventoryToPool(tx, variantId, quantity);
    }

    await tx.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        type: "STOCK_OUT",
        stockBucket: "DEFECTIVE",
        beforeQuantity: beforeDef,
        afterQuantity: afterDef,
        quantityChange: -quantity,
        beforeReserved: inv.reservedQuantity,
        afterReserved: inv.reservedQuantity,
        reservedChange: 0,
        reason: (action === "WRITE_OFF" ? "إتلاف سلعة معيبة - " : "إخراج من المعيب بعد الإصلاح - ") + reason,
        referenceType: "MANUAL",
        performedById: opts.performedById,
      },
    });

    if (action === "RESTOCK") {
      await tx.inventoryMovement.create({
        data: {
          inventoryId: inv.id,
          type: "STOCK_IN",
          stockBucket: "SELLABLE",
          beforeQuantity: beforeQty,
          afterQuantity: afterQty,
          quantityChange: quantity,
          beforeReserved: inv.reservedQuantity,
          afterReserved: inv.reservedQuantity,
          reservedChange: 0,
          reason: "إعادة للبيع بعد الإصلاح - " + reason,
          referenceType: "MANUAL",
          performedById: opts.performedById,
        },
      });
    }

    return { inventoryId: inv.id, action, quantity, defectiveAfter: afterDef, sellableAfter: afterQty };
  },
  // ═══════ قفل المخزون (SELECT ... FOR UPDATE) ═══════
  async lockInventory(tx: any, variantId: number): Promise<LockedInventory> {
    const rows: any[] = await tx.$queryRaw`
      SELECT id, quantity, "reservedQuantity", "lowStockThreshold", "defectiveQuantity"
      FROM "Inventory"
      WHERE "variantId" = ${variantId}
      FOR UPDATE
    `;
    if (!rows[0]) throw new Error("المخزون غير موجود لهذا المنتج");
    return rows[0];
  },

  // ═══════ فحص Idempotency ═══════
  async hasMovement(
    tx: any,
    referenceType: string,
    referenceId: number,
    type: string,
    inventoryId: number
  ): Promise<boolean> {
    const existing = await tx.inventoryMovement.findFirst({
      where: {
        referenceType,
        referenceId: BigInt(referenceId),
        type,
        inventoryId,
      },
      select: { id: true },
    });
    return !!existing;
  },

  // ═══════ بيع مباشر (COD — بدون حجز مسبق) ═══════
  async saleDirect(
    tx: any,
    variantId: number,
    quantity: number,
    orderId: number,
    referenceType: "ORDER" | "STORE_SALE" = "ORDER"
  ) {
    if (quantity <= 0) throw new Error("الكمية يجب أن تكون موجبة");

    const inv = await this.lockInventory(tx, variantId);

    // ═══ Idempotency: هل سبق البيع لنفس الطلب؟ ═══
    const already = await this.hasMovement(tx, referenceType, orderId, "SALE", inv.id);
    if (already) {
      return { inventoryId: inv.id, sold: 0, idempotent: true };
    }

    const beforeQty = inv.quantity;
    const afterQty = beforeQty - quantity;

    if (afterQty < 0) {
      throw new Error("الكمية المطلوبة غير متوفرة في المخزون");
    }

    await tx.inventory.update({
      where: { id: inv.id },
      data: { quantity: afterQty },
    });

    // M11.4b: mirror decrement to shared pool (if linked)
    await PoolService.syncInventoryToPool(tx, variantId, -quantity);

    await tx.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        type: "SALE",
        beforeQuantity: beforeQty,
        afterQuantity: afterQty,
        quantityChange: -quantity,
        beforeReserved: inv.reservedQuantity,
        afterReserved: inv.reservedQuantity,
        reservedChange: 0,
        reason: "بيع مباشر (دفع عند الاستلام)",
        referenceType,
        referenceId: BigInt(orderId),
      },
    });

    return { inventoryId: inv.id, sold: quantity, idempotent: false };
  },

  // ═══════ إرجاع للمخزون (Return / Refuse / Cancel) ═══════
  async returnStock(
    tx: any,
    variantId: number,
    quantity: number,
    referenceId: number,
    reason: string = "إرجاع منتج",
    referenceType: "ORDER" | "RETURN" | "STORE_SALE_RETURN" = "RETURN"
  ) {
    if (quantity <= 0) throw new Error("الكمية يجب أن تكون موجبة");

    const inv = await this.lockInventory(tx, variantId);

    // ═══ Idempotency ═══
    const already = await this.hasMovement(
      tx,
      referenceType,
      referenceId,
      "RETURN",
      inv.id
    );
    if (already) {
      return { inventoryId: inv.id, returned: 0, idempotent: true };
    }

    const beforeQty = inv.quantity;
    const afterQty = beforeQty + quantity;

    await tx.inventory.update({
      where: { id: inv.id },
      data: { quantity: afterQty },
    });

    // M11.4b: mirror increment to shared pool (if linked)
    await PoolService.syncInventoryToPool(tx, variantId, quantity);

    await tx.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        type: "RETURN",
        beforeQuantity: beforeQty,
        afterQuantity: afterQty,
        quantityChange: quantity,
        beforeReserved: inv.reservedQuantity,
        afterReserved: inv.reservedQuantity,
        reservedChange: 0,
        reason,
        referenceType,
        referenceId: BigInt(referenceId),
      },
    });

    // العروض المحدودة: إلغاء/رفض الطلب يعيد حصة العرض ويعكس سجل التسوية
    if (referenceType === "ORDER") {
      await FlashDealService.releaseForOrderVariant(tx, referenceId, variantId);
    }

    return { inventoryId: inv.id, returned: quantity, idempotent: false };
  },

  // ═══════ إرجاع بسبب إلغاء الطلب (COD) — alias للتوافق ═══════
  async cancelReturn(
    tx: any,
    variantId: number,
    quantity: number,
    orderId: number,
    reason: string = "إلغاء الطلب — إرجاع للمخزون"
  ) {
    return this.returnStock(tx, variantId, quantity, orderId, reason, "ORDER");
  },

  // ═══════ إضافة مخزون (Admin / Stock In) ═══════
  async stockIn(
    tx: any,
    variantId: number,
    quantity: number,
    performedById: number,
    reason: string
  ) {
    if (quantity <= 0) throw new Error("الكمية يجب أن تكون موجبة");

    const inv = await this.lockInventory(tx, variantId);

    const beforeQty = inv.quantity;
    const afterQty = beforeQty + quantity;

    await tx.inventory.update({
      where: { id: inv.id },
      data: { quantity: afterQty },
    });

    // M11.4b: mirror increment to shared pool (if linked)
    await PoolService.syncInventoryToPool(tx, variantId, quantity);

    await tx.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        type: "STOCK_IN",
        beforeQuantity: beforeQty,
        afterQuantity: afterQty,
        quantityChange: quantity,
        beforeReserved: inv.reservedQuantity,
        afterReserved: inv.reservedQuantity,
        reservedChange: 0,
        reason,
        referenceType: "MANUAL",
        performedById,
      },
    });

    return { inventoryId: inv.id, added: quantity };
  },

  // ═══════ تعديل مباشر (Admin Adjustment) ═══════
  async adjust(
    tx: any,
    variantId: number,
    newQuantity: number,
    performedById: number,
    reason: string
  ) {
    if (newQuantity < 0) throw new Error("الكمية لا يمكن أن تكون سالبة");

    const inv = await this.lockInventory(tx, variantId);

    if (newQuantity < inv.reservedQuantity) {
      throw new Error("لا يمكن تقليل المخزون تحت الكمية المحجوزة الحالية");
    }

    const beforeQty = inv.quantity;
    const change = newQuantity - beforeQty;

    await tx.inventory.update({
      where: { id: inv.id },
      data: { quantity: newQuantity },
    });

    // M11.4b: mirror change to shared pool (if linked)
    if (change !== 0) {
      await PoolService.syncInventoryToPool(tx, variantId, change);
    }

    await tx.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        type: "ADJUSTMENT",
        beforeQuantity: beforeQty,
        afterQuantity: newQuantity,
        quantityChange: change,
        beforeReserved: inv.reservedQuantity,
        afterReserved: inv.reservedQuantity,
        reservedChange: 0,
        reason,
        referenceType: "MANUAL",
        performedById,
      },
    });

    return { inventoryId: inv.id, adjusted: change };
  },

  // ═══════ قراءة حالة المخزون ═══════
  async getStock(tx: any, variantId: number) {
    const inv = await tx.inventory.findUnique({
      where: { variantId },
      select: {
        quantity: true,
        reservedQuantity: true,
        lowStockThreshold: true,
        defectiveQuantity: true,
      },
    });
    if (!inv) return null;
    return {
      quantity: inv.quantity,
      reservedQuantity: inv.reservedQuantity,
      available: inv.quantity - inv.reservedQuantity,
      isLowStock: inv.quantity <= inv.lowStockThreshold,
      isOutOfStock: inv.quantity === 0,
      defectiveQuantity: inv.defectiveQuantity,
    };
  },
};