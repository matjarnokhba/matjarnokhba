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
};

export const InventoryService = {
  // ═══════ قفل المخزون (SELECT ... FOR UPDATE) ═══════
  async lockInventory(tx: any, variantId: number): Promise<LockedInventory> {
    const rows: any[] = await tx.$queryRaw`
      SELECT id, quantity, "reservedQuantity", "lowStockThreshold"
      FROM "Inventory"
      WHERE "variantId" = ${variantId}
      FOR UPDATE
    `;
    if (!rows[0]) throw new Error("المخزون غير موجود لهذا المنتج");
    return rows[0];
  },

  // ═══════ بيع مباشر (COD — بدون حجز مسبق) ═══════
  async saleDirect(
    tx: any,
    variantId: number,
    quantity: number,
    orderId: number
  ) {
    if (quantity <= 0) throw new Error("الكمية يجب أن تكون موجبة");

    const inv = await this.lockInventory(tx, variantId);

    const beforeQty = inv.quantity;
    const afterQty = beforeQty - quantity;

    if (afterQty < 0) {
      throw new Error("الكمية المطلوبة غير متوفرة في المخزون");
    }

    await tx.inventory.update({
      where: { id: inv.id },
      data: { quantity: afterQty },
    });

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
        referenceType: "ORDER",
        referenceId: BigInt(orderId),
      },
    });

    return { inventoryId: inv.id, sold: quantity };
  },

  // ═══════ إرجاع بسبب إلغاء الطلب (COD) ═══════
  async cancelReturn(
    tx: any,
    variantId: number,
    quantity: number,
    orderId: number,
    reason: string = "إلغاء الطلب — إرجاع للمخزون"
  ) {
    if (quantity <= 0) throw new Error("الكمية يجب أن تكون موجبة");

    const inv = await this.lockInventory(tx, variantId);

    const beforeQty = inv.quantity;
    const afterQty = beforeQty + quantity;

    await tx.inventory.update({
      where: { id: inv.id },
      data: { quantity: afterQty },
    });

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
        referenceType: "ORDER",
        referenceId: BigInt(orderId),
      },
    });

    return { inventoryId: inv.id, returned: quantity };
  },

  // ═══════ حجز مخزون (للمستقبل — الدفع الإلكتروني) ═══════
  async reserve(
    tx: any,
    variantId: number,
    quantity: number,
    orderId: number
  ) {
    if (quantity <= 0) throw new Error("الكمية يجب أن تكون موجبة");

    const inv = await this.lockInventory(tx, variantId);
    const available = inv.quantity - inv.reservedQuantity;

    if (available < quantity) {
      throw new Error("الكمية المطلوبة غير متوفرة في المخزون");
    }

    const beforeReserved = inv.reservedQuantity;
    const afterReserved = beforeReserved + quantity;

    await tx.inventory.update({
      where: { id: inv.id },
      data: { reservedQuantity: afterReserved },
    });

    await tx.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        type: "RESERVE",
        beforeQuantity: inv.quantity,
        afterQuantity: inv.quantity,
        quantityChange: 0,
        beforeReserved,
        afterReserved,
        reservedChange: quantity,
        reason: "حجز مؤقت عند الطلب",
        referenceType: "ORDER",
        referenceId: BigInt(orderId),
      },
    });

    return { inventoryId: inv.id, reserved: quantity };
  },

  // ═══════ تحرير الحجز (للمستقبل) ═══════
  async unreserve(
    tx: any,
    variantId: number,
    quantity: number,
    orderId: number,
    reason: string
  ) {
    const inv = await this.lockInventory(tx, variantId);

    const beforeReserved = inv.reservedQuantity;

    if (quantity > beforeReserved) {
      throw new Error(
        "محاولة تحرير " + quantity + " من أصل " + beforeReserved + " محجوز فقط"
      );
    }

    const afterReserved = beforeReserved - quantity;

    await tx.inventory.update({
      where: { id: inv.id },
      data: { reservedQuantity: afterReserved },
    });

    await tx.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        type: "UNRESERVE",
        beforeQuantity: inv.quantity,
        afterQuantity: inv.quantity,
        quantityChange: 0,
        beforeReserved,
        afterReserved,
        reservedChange: -quantity,
        reason,
        referenceType: "ORDER",
        referenceId: BigInt(orderId),
      },
    });

    return { inventoryId: inv.id, released: quantity };
  },

  // ═══════ تأكيد البيع (للمستقبل — عند تحويل Reservation إلى Sale) ═══════
  async commitSale(
    tx: any,
    variantId: number,
    quantity: number,
    orderId: number
  ) {
    const inv = await this.lockInventory(tx, variantId);

    const beforeQty = inv.quantity;
    const afterQty = beforeQty - quantity;
    if (afterQty < 0) {
      throw new Error("لا يمكن بيع أكثر من الكمية المتوفرة");
    }

    const beforeReserved = inv.reservedQuantity;

    if (quantity > beforeReserved) {
      throw new Error(
        "محاولة بيع " + quantity + " من أصل " + beforeReserved + " محجوز فقط"
      );
    }

    const afterReserved = beforeReserved - quantity;

    await tx.inventory.update({
      where: { id: inv.id },
      data: {
        quantity: afterQty,
        reservedQuantity: afterReserved,
      },
    });

    await tx.inventoryMovement.create({
      data: {
        inventoryId: inv.id,
        type: "SALE",
        beforeQuantity: beforeQty,
        afterQuantity: afterQty,
        quantityChange: -quantity,
        beforeReserved,
        afterReserved,
        reservedChange: -quantity,
        reason: "تأكيد البيع",
        referenceType: "ORDER",
        referenceId: BigInt(orderId),
      },
    });

    return { inventoryId: inv.id, sold: quantity };
  },

  // ═══════ إرجاع للمخزون (Return) ═══════
  async returnStock(
    tx: any,
    variantId: number,
    quantity: number,
    returnRequestId: number
  ) {
    const inv = await this.lockInventory(tx, variantId);

    const beforeQty = inv.quantity;
    const afterQty = beforeQty + quantity;

    await tx.inventory.update({
      where: { id: inv.id },
      data: { quantity: afterQty },
    });

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
        reason: "إرجاع منتج",
        referenceType: "RETURN",
        referenceId: BigInt(returnRequestId),
      },
    });

    return { inventoryId: inv.id, returned: quantity };
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
      },
    });
    if (!inv) return null;
    return {
      quantity: inv.quantity,
      reservedQuantity: inv.reservedQuantity,
      available: inv.quantity - inv.reservedQuantity,
      isLowStock: inv.quantity <= inv.lowStockThreshold,
      isOutOfStock: inv.quantity === 0,
    };
  },
};