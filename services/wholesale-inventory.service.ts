import { prisma } from "@/lib/prisma";
import { WHOLESALE_CONFIG } from "@/lib/wholesale/config";
import {
  ConflictError,
  InsufficientStockError,
  NotFoundError,
  ReservationExpiredError,
  ValidationError,
} from "@/lib/wholesale/errors";
import { logWholesaleAction } from "@/lib/wholesale/audit";

type InventoryMovementType =
  | "PURCHASE_IN"
  | "SALE_OUT"
  | "RETURN_IN"
  | "RETURN_OUT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "ADJUSTMENT"
  | "DAMAGE"
  | "RESERVATION_HOLD"
  | "RESERVATION_RELEASE";

type BatchSourceType = "PURCHASE" | "RETURN" | "TRANSFER" | "OPENING_BALANCE";

type ReserveInput = {
  merchantVariantId: number;
  inventoryAccountId: number;
  quantity: number;
  referenceType: string;
  referenceId: number;
  stage?: "TEMP" | "CONFIRMED";
  expiresAt?: Date | null;
  userId?: number;
};

type TransferInInput = {
  merchantVariantId: number;
  inventoryAccountId: number;
  businessUnitId: number;
  quantity: number;
  unitCost: number;
  sourceType: BatchSourceType;
  sourceReferenceId?: number | null;
  referenceType: string;
  referenceId: number;
  notes?: string;
  userId?: number;
};

type TransferOutInput = {
  merchantVariantId: number;
  inventoryAccountId: number;
  businessUnitId: number;
  quantity: number;
  referenceType: string;
  referenceId: number;
  type: "SALE_OUT" | "TRANSFER_OUT" | "RETURN_OUT" | "DAMAGE" | "ADJUSTMENT";
  notes?: string;
  userId?: number;
};

// ═══ Internal helpers ═══

async function getBalanceOrNull(tx: any, merchantVariantId: number, inventoryAccountId: number) {
  return (tx ?? prisma).inventoryBalance.findUnique({
    where: {
      merchantVariantId_inventoryAccountId: {
        merchantVariantId,
        inventoryAccountId,
      },
    },
  });
}

async function lockBalance(tx: any, merchantVariantId: number, inventoryAccountId: number) {
  const rows: any[] = await tx.$queryRaw`
    SELECT id, quantity, "lastLedgerId"
    FROM "InventoryBalance"
    WHERE "merchantVariantId" = ${merchantVariantId}
      AND "inventoryAccountId" = ${inventoryAccountId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

async function sumActiveReservations(
  tx: any,
  merchantVariantId: number,
  inventoryAccountId: number
): Promise<number> {
  const agg = await (tx ?? prisma).stockReservation.aggregate({
    where: { merchantVariantId, inventoryAccountId, status: "ACTIVE" },
    _sum: { quantity: true },
  });
  return Number(agg._sum.quantity ?? 0);
}

async function consumeFifo(
  tx: any,
  merchantVariantId: number,
  inventoryAccountId: number,
  quantity: number
): Promise<Array<{ batchId: number; quantityConsumed: number; unitCost: number }>> {
  const batches = await tx.inventoryBatch.findMany({
    where: {
      merchantVariantId,
      inventoryAccountId,
      quantityRemaining: { gt: 0 },
    },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
    take: WHOLESALE_CONFIG.BATCH_ALLOCATION_MAX_BATCHES,
  });

  let remaining = quantity;
  const allocations: Array<{ batchId: number; quantityConsumed: number; unitCost: number }> = [];

  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(b.quantityRemaining, remaining);
    allocations.push({
      batchId: b.id,
      quantityConsumed: take,
      unitCost: Number(b.unitCost),
    });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new InsufficientStockError(
      `variant ${merchantVariantId}`,
      quantity,
      quantity - remaining
    );
  }

  return allocations;
}

async function applyOutMovement(
  tx: any,
  input: TransferOutInput,
  reservationsToRelease?: number
): Promise<{ ledgerId: number; allocations: Array<{ batchId: number; quantityConsumed: number; unitCost: number }> }> {
  const locked = await lockBalance(
    tx,
    input.merchantVariantId,
    input.inventoryAccountId
  );
  if (!locked) {
    throw new NotFoundError(
      "InventoryBalance",
      `${input.merchantVariantId}/${input.inventoryAccountId}`
    );
  }

  const reserved = await sumActiveReservations(
    tx,
    input.merchantVariantId,
    input.inventoryAccountId
  );
  const available = locked.quantity - reserved + (reservationsToRelease ?? 0);

  if (available < input.quantity) {
    throw new InsufficientStockError(
      `variant ${input.merchantVariantId}`,
      input.quantity,
      Math.max(0, available)
    );
  }

  // FIFO
  const allocations = await consumeFifo(
    tx,
    input.merchantVariantId,
    input.inventoryAccountId,
    input.quantity
  );

  // Create ledger
  const ledger = await tx.inventoryLedger.create({
    data: {
      merchantVariantId: input.merchantVariantId,
      inventoryAccountId: input.inventoryAccountId,
      inventoryBatchId: null,
      businessUnitId: input.businessUnitId,
      type: input.type as any,
      quantity: -input.quantity,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      notes: input.notes ?? null,
      createdByUserId: input.userId ?? null,
    },
  });

  // Apply batch allocations
  for (const a of allocations) {
    await tx.inventoryBatchAllocation.create({
      data: {
        batchId: a.batchId,
        inventoryLedgerId: ledger.id,
        quantityConsumed: a.quantityConsumed,
        unitCostSnapshot: a.unitCost,
      },
    });
    await tx.inventoryBatch.update({
      where: { id: a.batchId },
      data: { quantityRemaining: { decrement: a.quantityConsumed } },
    });
  }

  // Update balance
  await tx.inventoryBalance.update({
    where: {
      merchantVariantId_inventoryAccountId: {
        merchantVariantId: input.merchantVariantId,
        inventoryAccountId: input.inventoryAccountId,
      },
    },
    data: {
      quantity: { decrement: input.quantity },
      lastLedgerId: ledger.id,
    },
  });

  return { ledgerId: ledger.id, allocations };
}

// ═══ Service ═══
export const WholesaleInventoryService = {
  /**
   * Reserve stock. Creates StockReservation with TEMP or CONFIRMED stage.
   * For TEMP: expiresAt must be set (default 15 min from now).
   * For CONFIRMED: no expiry (order confirmed).
   */
  async reserve(tx: any, input: ReserveInput): Promise<{ reservationId: number }> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new ValidationError("الكمية يجب أن تكون عددًا صحيحًا موجبًا");
    }

    const locked = await lockBalance(
      tx,
      input.merchantVariantId,
      input.inventoryAccountId
    );
    if (!locked) {
      throw new InsufficientStockError(
        `variant ${input.merchantVariantId}`,
        input.quantity,
        0
      );
    }

    const reserved = await sumActiveReservations(
      tx,
      input.merchantVariantId,
      input.inventoryAccountId
    );
    const available = locked.quantity - reserved;

    if (available < input.quantity) {
      throw new InsufficientStockError(
        `variant ${input.merchantVariantId}`,
        input.quantity,
        Math.max(0, available)
      );
    }

    const stage = input.stage ?? "TEMP";
    let expiresAt: Date | null = input.expiresAt ?? null;
    if (stage === "TEMP" && !expiresAt) {
      expiresAt = new Date(
        Date.now() + WHOLESALE_CONFIG.TEMP_RESERVATION_MINUTES * 60 * 1000
      );
    }
    if (stage === "CONFIRMED") expiresAt = null;

    const reservation = await tx.stockReservation.create({
      data: {
        merchantVariantId: input.merchantVariantId,
        inventoryAccountId: input.inventoryAccountId,
        quantity: input.quantity,
        stage: stage as any,
        status: "ACTIVE",
        expiresAt,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      },
    });

    await logWholesaleAction(tx, {
      userId: input.userId ?? null,
      action: "inventory.reserved",
      entityType: "StockReservation",
      entityId: reservation.id,
      after: {
        merchantVariantId: input.merchantVariantId,
        quantity: input.quantity,
        stage,
      },
    });

    return { reservationId: reservation.id };
  },

  /**
   * Confirm a TEMP reservation (moves to CONFIRMED, no expiry).
   */
  async confirmReservation(tx: any, reservationId: number): Promise<void> {
    const r = await tx.stockReservation.findUnique({
      where: { id: reservationId },
    });
    if (!r) throw new NotFoundError("StockReservation", reservationId);
    if (r.status !== "ACTIVE") {
      throw new ConflictError(`الحجز بحالة ${r.status} لا يمكن تأكيده`);
    }
    if (r.stage === "CONFIRMED") return;

    if (r.expiresAt && r.expiresAt < new Date()) {
      throw new ReservationExpiredError();
    }

    await tx.stockReservation.update({
      where: { id: reservationId },
      data: { stage: "CONFIRMED", expiresAt: null },
    });
  },

  /**
   * Release a reservation without consuming stock.
   */
  async releaseReservation(
    tx: any,
    reservationId: number,
    reason?: string
  ): Promise<void> {
    const r = await tx.stockReservation.findUnique({
      where: { id: reservationId },
    });
    if (!r) throw new NotFoundError("StockReservation", reservationId);
    if (r.status !== "ACTIVE") return; // already released/consumed

    await tx.stockReservation.update({
      where: { id: reservationId },
      data: { status: "RELEASED" },
    });

    await logWholesaleAction(tx, {
      userId: null,
      action: "inventory.reservation_released",
      entityType: "StockReservation",
      entityId: reservationId,
      metadata: { reason: reason ?? null },
    });
  },

  /**
   * Commit a reservation: consume stock via SALE_OUT + FIFO, mark reservation CONSUMED.
   */
  async commitReservation(
    tx: any,
    reservationId: number,
    referenceType: string,
    referenceId: number,
    businessUnitId: number,
    userId?: number
  ): Promise<{ ledgerId: number }> {
    const r = await tx.stockReservation.findUnique({
      where: { id: reservationId },
    });
    if (!r) throw new NotFoundError("StockReservation", reservationId);
    if (r.status !== "ACTIVE") {
      throw new ConflictError(`الحجز بحالة ${r.status} لا يمكن تنفيذه`);
    }
    if (r.expiresAt && r.expiresAt < new Date()) {
      throw new ReservationExpiredError();
    }

    const out = await applyOutMovement(
      tx,
      {
        merchantVariantId: r.merchantVariantId,
        inventoryAccountId: r.inventoryAccountId,
        businessUnitId,
        quantity: r.quantity,
        referenceType,
        referenceId,
        type: "SALE_OUT",
        userId,
      },
      r.quantity // release this reservation before checking available
    );

    await tx.stockReservation.update({
      where: { id: reservationId },
      data: { status: "CONSUMED" },
    });

    await logWholesaleAction(tx, {
      userId: userId ?? null,
      action: "inventory.reservation_committed",
      entityType: "StockReservation",
      entityId: reservationId,
      after: { ledgerId: out.ledgerId, quantity: r.quantity },
    });

    return { ledgerId: out.ledgerId };
  },

  /**
   * Transfer stock IN (creates a new batch + PURCHASE_IN ledger + updates balance).
   */
  async transferIn(tx: any, input: TransferInInput): Promise<{ ledgerId: number; batchId: number }> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new ValidationError("الكمية يجب أن تكون عددًا صحيحًا موجبًا");
    }
    if (typeof input.unitCost !== "number" || input.unitCost < 0) {
      throw new ValidationError("تكلفة الوحدة يجب أن تكون >= 0");
    }

    // Ensure balance exists (create with 0 if not)
    await tx.inventoryBalance.upsert({
      where: {
        merchantVariantId_inventoryAccountId: {
          merchantVariantId: input.merchantVariantId,
          inventoryAccountId: input.inventoryAccountId,
        },
      },
      create: {
        merchantVariantId: input.merchantVariantId,
        inventoryAccountId: input.inventoryAccountId,
        quantity: 0,
      },
      update: {},
    });

    // Lock balance
    await lockBalance(tx, input.merchantVariantId, input.inventoryAccountId);

    // Create batch
    const batch = await tx.inventoryBatch.create({
      data: {
        merchantVariantId: input.merchantVariantId,
        inventoryAccountId: input.inventoryAccountId,
        sourceType: input.sourceType as any,
        sourceReferenceId: input.sourceReferenceId ?? null,
        quantityReceived: input.quantity,
        quantityRemaining: input.quantity,
        unitCost: input.unitCost,
      },
    });

    // Create ledger
    const ledger = await tx.inventoryLedger.create({
      data: {
        merchantVariantId: input.merchantVariantId,
        inventoryAccountId: input.inventoryAccountId,
        inventoryBatchId: batch.id,
        businessUnitId: input.businessUnitId,
        type: (input.sourceType === "TRANSFER" ? "TRANSFER_IN" : input.sourceType === "RETURN" ? "RETURN_IN" : "PURCHASE_IN") as any,
        quantity: input.quantity,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        notes: input.notes ?? null,
        createdByUserId: input.userId ?? null,
      },
    });

    // Update balance
    await tx.inventoryBalance.update({
      where: {
        merchantVariantId_inventoryAccountId: {
          merchantVariantId: input.merchantVariantId,
          inventoryAccountId: input.inventoryAccountId,
        },
      },
      data: {
        quantity: { increment: input.quantity },
        lastLedgerId: ledger.id,
      },
    });

    await logWholesaleAction(tx, {
      userId: input.userId ?? null,
      businessUnitId: input.businessUnitId,
      action: "inventory.transferred_in",
      entityType: "InventoryBatch",
      entityId: batch.id,
      after: {
        quantity: input.quantity,
        unitCost: input.unitCost,
        sourceType: input.sourceType,
      },
    });

    return { ledgerId: ledger.id, batchId: batch.id };
  },

  /**
   * Transfer stock OUT (FIFO from batches + SALE_OUT/TRANSFER_OUT ledger).
   */
  async transferOut(tx: any, input: TransferOutInput): Promise<{ ledgerId: number }> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new ValidationError("الكمية يجب أن تكون عددًا صحيحًا موجبًا");
    }

    const out = await applyOutMovement(tx, input);

    await logWholesaleAction(tx, {
      userId: input.userId ?? null,
      businessUnitId: input.businessUnitId,
      action: "inventory.transferred_out",
      entityType: "InventoryLedger",
      entityId: out.ledgerId,
      after: {
        quantity: input.quantity,
        type: input.type,
        allocationsCount: out.allocations.length,
      },
    });

    return { ledgerId: out.ledgerId };
  },

  /**
   * Get current balance + available (balance - active reservations).
   */
  async getBalance(merchantVariantId: number, inventoryAccountId: number) {
    const bal = await prisma.inventoryBalance.findUnique({
      where: {
        merchantVariantId_inventoryAccountId: {
          merchantVariantId,
          inventoryAccountId,
        },
      },
      select: { quantity: true, lastLedgerId: true, updatedAt: true },
    });
    const reserved = await sumActiveReservations(
      prisma,
      merchantVariantId,
      inventoryAccountId
    );
    const onHand = bal?.quantity ?? 0;
    return {
      onHand,
      reserved,
      available: Math.max(0, onHand - reserved),
      lastLedgerId: bal?.lastLedgerId ?? null,
      updatedAt: bal?.updatedAt ?? null,
    };
  },

  /**
   * Get all balances for a merchant variant (across all accounts).
   */
  async getBalancesByVariant(merchantVariantId: number) {
    const rows = await prisma.inventoryBalance.findMany({
      where: { merchantVariantId },
      include: {
        // inventoryAccount relation not defined — return raw
      },
    });
    const result = [];
    for (const r of rows) {
      const reserved = await sumActiveReservations(
        prisma,
        r.merchantVariantId,
        r.inventoryAccountId
      );
      result.push({
        inventoryAccountId: r.inventoryAccountId,
        onHand: r.quantity,
        reserved,
        available: Math.max(0, r.quantity - reserved),
      });
    }
    return result;
  },

  /**
   * List active batches for a variant+account (for FIFO audit).
   */
  async listActiveBatches(merchantVariantId: number, inventoryAccountId: number) {
    return prisma.inventoryBatch.findMany({
      where: {
        merchantVariantId,
        inventoryAccountId,
        quantityRemaining: { gt: 0 },
      },
      orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        sourceType: true,
        sourceReferenceId: true,
        quantityReceived: true,
        quantityRemaining: true,
        unitCost: true,
        receivedAt: true,
      },
    });
  },

  /**
   * Release expired TEMP reservations (cron helper).
   */
  async releaseExpiredReservations(limit = 100): Promise<{ released: number }> {
    const expired = await prisma.stockReservation.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lt: new Date() },
      },
      take: limit,
      select: { id: true },
    });

    let released = 0;
    for (const r of expired) {
      try {
        const updated = await prisma.stockReservation.updateMany({
          where: { id: r.id, status: "ACTIVE" },
          data: { status: "EXPIRED" },
        });
        if (updated.count > 0) released++;
      } catch {
        // skip
      }
    }

    return { released };
  },
};