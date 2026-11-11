import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/wholesale/errors";

export type PoolMode = "SHARED" | "SPLIT";

export type PoolVariantState = {
  masterVariantId: number;
  quantity: number;
  reservedQuantity: number;
  available: number;
};

export type PoolState = {
  id: number;
  businessUnitId: number;
  masterId: number;
  mode: PoolMode;
  variants: PoolVariantState[];
};

function toPoolState(pool: {
  id: number;
  businessUnitId: number;
  masterId: number;
  mode: string;
  variants: Array<{ masterVariantId: number; quantity: number; reservedQuantity: number }>;
}): PoolState {
  return {
    id: pool.id,
    businessUnitId: pool.businessUnitId,
    masterId: pool.masterId,
    mode: pool.mode as PoolMode,
    variants: pool.variants.map((v) => ({
      masterVariantId: v.masterVariantId,
      quantity: v.quantity,
      reservedQuantity: v.reservedQuantity,
      available: Math.max(0, v.quantity - v.reservedQuantity),
    })),
  };
}

export const PoolService = {
  /**
   * Get or create a pool for (businessUnit, master).
   * If existing pool has a different mode, returns it as-is — mode change
   * is a separate operation (`setMode`) requiring explicit confirmation.
   */
  async getOrCreate(
    businessUnitId: number,
    masterId: number,
    mode: PoolMode = "SPLIT"
  ): Promise<PoolState> {
    const existing = await prisma.inventoryPool.findUnique({
      where: { businessUnitId_masterId: { businessUnitId, masterId } },
      include: { variants: true },
    });
    if (existing) return toPoolState(existing);

    const masterVariants = await prisma.masterVariant.findMany({
      where: { masterId },
      select: { id: true },
    });

    const created = await prisma.inventoryPool.create({
      data: {
        businessUnitId,
        masterId,
        mode: mode as any,
        variants: {
          create: masterVariants.map((v) => ({
            masterVariantId: v.id,
            quantity: 0,
            reservedQuantity: 0,
          })),
        },
      },
      include: { variants: true },
    });
    return toPoolState(created);
  },

  /** Read current pool state. */
  async read(poolId: number): Promise<PoolState> {
    const pool = await prisma.inventoryPool.findUnique({
      where: { id: poolId },
      include: { variants: true },
    });
    if (!pool) throw new NotFoundError("InventoryPool", poolId);
    return toPoolState(pool);
  },

  /** Get pool for a specific product (nullable — legacy products have no pool). */
  async getForProduct(productId: number): Promise<PoolState | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        pool: { include: { variants: true } },
      },
    });
    if (!product?.pool) return null;
    return toPoolState(product.pool);
  },

  /** Increase stock (receiving, opening balance, return). */
  async addStock(
    poolId: number,
    masterVariantId: number,
    qty: number
  ): Promise<void> {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new ValidationError("qty يجب أن يكون عدداً صحيحاً موجباً");
    }
    await prisma.$transaction(async (tx) => {
      await tx.inventoryPoolVariant.upsert({
        where: { poolId_masterVariantId: { poolId, masterVariantId } },
        create: {
          poolId,
          masterVariantId,
          quantity: qty,
          reservedQuantity: 0,
        },
        update: { quantity: { increment: qty } },
      });
      await PoolService.syncPoolToInventory(tx, poolId, masterVariantId, qty);
    });
  },

  /** Atomic deduct (sale without reservation). */
  async deduct(
    poolId: number,
    masterVariantId: number,
    qty: number
  ): Promise<void> {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new ValidationError("qty يجب أن يكون عدداً صحيحاً موجباً");
    }
    await prisma.$transaction(async (tx) => {
      const result = await tx.inventoryPoolVariant.updateMany({
        where: {
          poolId,
          masterVariantId,
          quantity: { gte: qty },
        },
        data: { quantity: { decrement: qty } },
      });
      if (result.count === 0) {
        throw new ConflictError("المخزون غير كافٍ");
      }
      await PoolService.syncPoolToInventory(tx, poolId, masterVariantId, -qty);
    });
  },

  /**
   * Reserve stock (does NOT change quantity, only reservedQuantity).
   * Uses FOR UPDATE lock for atomicity.
   */
  async reserve(
    poolId: number,
    masterVariantId: number,
    qty: number
  ): Promise<void> {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new ValidationError("qty يجب أن يكون عدداً صحيحاً موجباً");
    }
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: number; quantity: number; reservedQuantity: number }>
      >`SELECT id, quantity, "reservedQuantity" FROM "InventoryPoolVariant"
        WHERE "poolId" = ${poolId} AND "masterVariantId" = ${masterVariantId}
        FOR UPDATE`;
      const row = rows[0];
      if (!row) throw new NotFoundError("InventoryPoolVariant", 0);
      const available = row.quantity - row.reservedQuantity;
      if (available < qty) {
        throw new ConflictError(
          `المخزون المتاح (${available}) أقل من المطلوب (${qty})`
        );
      }
      await tx.inventoryPoolVariant.update({
        where: { id: row.id },
        data: { reservedQuantity: { increment: qty } },
      });
    });
  },

  /** Release an active reservation (order cancel / expiry). */
  async releaseReservation(
    poolId: number,
    masterVariantId: number,
    qty: number
  ): Promise<void> {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new ValidationError("qty يجب أن يكون عدداً صحيحاً موجباً");
    }
    const result = await prisma.inventoryPoolVariant.updateMany({
      where: {
        poolId,
        masterVariantId,
        reservedQuantity: { gte: qty },
      },
      data: { reservedQuantity: { decrement: qty } },
    });
    if (result.count === 0) {
      throw new ConflictError("لا يوجد حجز بهذه الكمية");
    }
  },

  /**
   * Commit a reservation (order confirmed + shipped).
   * Decrements both quantity and reservedQuantity — actual stock leaves the pool.
   */
  async commitReservation(
    poolId: number,
    masterVariantId: number,
    qty: number
  ): Promise<void> {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new ValidationError("qty يجب أن يكون عدداً صحيحاً موجباً");
    }
    await prisma.$transaction(async (tx) => {
      const result = await tx.inventoryPoolVariant.updateMany({
        where: {
          poolId,
          masterVariantId,
          quantity: { gte: qty },
          reservedQuantity: { gte: qty },
        },
        data: {
          quantity: { decrement: qty },
          reservedQuantity: { decrement: qty },
        },
      });
      if (result.count === 0) {
        throw new ConflictError("لا يمكن إتمام العملية — حجز أو كمية غير كافية");
      }
      await PoolService.syncPoolToInventory(tx, poolId, masterVariantId, -qty);
    });
  },

  /** Change pool mode (caller must have confirmed with seller). */
  async setMode(poolId: number, mode: PoolMode): Promise<void> {
    await prisma.inventoryPool.update({
      where: { id: poolId },
      data: { mode: mode as any },
    });
  },

  /** Link a product to a pool (one-time setup). */
  async linkProduct(productId: number, poolId: number): Promise<void> {
    await prisma.product.update({
      where: { id: productId },
      data: { poolId },
    });
  },

  /** Link a merchant product to a pool. */
  async linkMerchantProduct(
    merchantProductId: number,
    poolId: number
  ): Promise<void> {
    await prisma.merchantProduct.update({
      where: { id: merchantProductId },
      data: { poolId },
    });
  },
  // ═══ M11.3: tx-aware variants (caller manages transaction) ═══
  async reserveInTx(
    tx: any,
    poolId: number,
    masterVariantId: number,
    qty: number
  ): Promise<void> {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new ValidationError("qty يجب أن يكون عدداً صحيحاً موجباً");
    }
    const rows = await tx.$queryRaw<
      Array<{ id: number; quantity: number; reservedQuantity: number }>
    >`SELECT id, quantity, "reservedQuantity" FROM "InventoryPoolVariant"
      WHERE "poolId" = ${poolId} AND "masterVariantId" = ${masterVariantId}
      FOR UPDATE`;
    const row = rows[0];
    if (!row) throw new NotFoundError("InventoryPoolVariant", 0);
    const available = row.quantity - row.reservedQuantity;
    if (available < qty) {
      throw new ConflictError(
        `المخزون المتاح (${available}) أقل من المطلوب (${qty})`
      );
    }
    await tx.inventoryPoolVariant.update({
      where: { id: row.id },
      data: { reservedQuantity: { increment: qty } },
    });
  },

  async releaseInTx(
    tx: any,
    poolId: number,
    masterVariantId: number,
    qty: number
  ): Promise<void> {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new ValidationError("qty يجب أن يكون عدداً صحيحاً موجباً");
    }
    const result = await tx.inventoryPoolVariant.updateMany({
      where: {
        poolId,
        masterVariantId,
        reservedQuantity: { gte: qty },
      },
      data: { reservedQuantity: { decrement: qty } },
    });
    if (result.count === 0) {
      throw new ConflictError("لا يوجد حجز بهذه الكمية");
    }
  },

  async commitInTx(
    tx: any,
    poolId: number,
    masterVariantId: number,
    qty: number
  ): Promise<void> {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new ValidationError("qty يجب أن يكون عدداً صحيحاً موجباً");
    }
    const result = await tx.inventoryPoolVariant.updateMany({
      where: {
        poolId,
        masterVariantId,
        quantity: { gte: qty },
        reservedQuantity: { gte: qty },
      },
      data: {
        quantity: { decrement: qty },
        reservedQuantity: { decrement: qty },
      },
    });
    if (result.count === 0) {
      throw new ConflictError("لا يمكن إتمام العملية — حجز أو كمية غير كافية");
    }
    // M11.4b: mirror decrement to retail Inventory
    await PoolService.syncPoolToInventory(tx, poolId, masterVariantId, -qty);
  },
  // ═══ M11.4b: two-way quantity sync (SHARED only) ═══
  /**
   * When retail mutates Inventory.quantity, mirror to InventoryPoolVariant.quantity.
   * Delta negative = decrement (validates sufficient stock).
   * Delta positive = increment.
   */
  async syncInventoryToPool(
    tx: any,
    productVariantId: number,
    delta: number
  ): Promise<void> {
    if (delta === 0) return;
    const pv = await tx.productVariant.findUnique({
      where: { id: productVariantId },
      select: {
        masterVariantId: true,
        product: { select: { pool: { select: { id: true, mode: true } } } },
      },
    });
    if (!pv?.masterVariantId) return;
    const pool = pv.product?.pool;
    if (!pool || pool.mode !== "SHARED") return;

    if (delta < 0) {
      const result = await tx.inventoryPoolVariant.updateMany({
        where: {
          poolId: pool.id,
          masterVariantId: pv.masterVariantId,
          quantity: { gte: -delta },
        },
        data: { quantity: { increment: delta } },
      });
      if (result.count === 0) {
        throw new ConflictError("المخزون المشترك غير كافٍ");
      }
    } else {
      await tx.inventoryPoolVariant.updateMany({
        where: { poolId: pool.id, masterVariantId: pv.masterVariantId },
        data: { quantity: { increment: delta } },
      });
    }
  },

  /**
   * When wholesale mutates InventoryPoolVariant.quantity, mirror to all linked
   * ProductVariant.Inventory.quantity (SHARED only).
   */
  async syncPoolToInventory(
    tx: any,
    poolId: number,
    masterVariantId: number,
    delta: number
  ): Promise<void> {
    if (delta === 0) return;
    const pool = await tx.inventoryPool.findUnique({
      where: { id: poolId },
      select: { mode: true },
    });
    if (!pool || pool.mode !== "SHARED") return;

    const pvs = await tx.productVariant.findMany({
      where: { masterVariantId, product: { poolId } },
      select: { id: true },
    });
    for (const pv of pvs) {
      if (delta < 0) {
        const result = await tx.inventory.updateMany({
          where: { variantId: pv.id, quantity: { gte: -delta } },
          data: { quantity: { increment: delta } },
        });
        if (result.count === 0) {
          throw new ConflictError("مخزون التجزئة غير كافٍ");
        }
      } else {
        await tx.inventory.updateMany({
          where: { variantId: pv.id },
          data: { quantity: { increment: delta } },
        });
      }
    }
  },
};