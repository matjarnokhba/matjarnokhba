import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

export type LedgerTxType = "SALE" | "PAYMENT" | "REFUND" | "ADJUSTMENT";
export type LedgerTxStatus = "CONFIRMED" | "PENDING" | "REJECTED";

/**
 * Balance convention (per LedgerAccount):
 *   positive = counterparty owes us
 *   negative = we owe counterparty
 *
 * Effect of a transaction (debtor D, creditor C, amount A > 0):
 *   SALE / ADJUSTMENT: D's debt to C increases
 *     → account(D,C).balance -= A
 *     → account(C,D).balance += A
 *   PAYMENT / REFUND: D's debt to C decreases
 *     → account(D,C).balance += A
 *     → account(C,D).balance -= A
 */
function getDeltas(type: LedgerTxType, amount: number): { debtorDelta: number; creditorDelta: number } {
  const a = Math.abs(amount);
  switch (type) {
    case "SALE":
    case "ADJUSTMENT":
      return { debtorDelta: -a, creditorDelta: +a };
    case "PAYMENT":
    case "REFUND":
      return { debtorDelta: +a, creditorDelta: -a };
    default:
      throw new Error(`نوع غير معروف: ${type}`);
  }
}

async function ensureAccounts(tx: Prisma.TransactionClient, a: number, b: number) {
  await tx.ledgerAccount.upsert({
    where: { businessId_counterpartyBusinessId: { businessId: a, counterpartyBusinessId: b } },
    update: {},
    create: { businessId: a, counterpartyBusinessId: b, balance: 0 },
  });
  await tx.ledgerAccount.upsert({
    where: { businessId_counterpartyBusinessId: { businessId: b, counterpartyBusinessId: a } },
    update: {},
    create: { businessId: b, counterpartyBusinessId: a, balance: 0 },
  });
}

async function applyToBalances(
  tx: Prisma.TransactionClient,
  debtorId: number,
  creditorId: number,
  type: LedgerTxType,
  amount: number
) {
  const { debtorDelta, creditorDelta } = getDeltas(type, amount);
  await tx.ledgerAccount.update({
    where: { businessId_counterpartyBusinessId: { businessId: debtorId, counterpartyBusinessId: creditorId } },
    data: {
      balance: { increment: debtorDelta },
      lastActivityAt: new Date(),
    },
  });
  await tx.ledgerAccount.update({
    where: { businessId_counterpartyBusinessId: { businessId: creditorId, counterpartyBusinessId: debtorId } },
    data: {
      balance: { increment: creditorDelta },
      lastActivityAt: new Date(),
    },
  });
}

async function revertFromBalances(
  tx: Prisma.TransactionClient,
  debtorId: number,
  creditorId: number,
  type: LedgerTxType,
  amount: number
) {
  // Reverse the delta to undo
  const { debtorDelta, creditorDelta } = getDeltas(type, amount);
  await tx.ledgerAccount.update({
    where: { businessId_counterpartyBusinessId: { businessId: debtorId, counterpartyBusinessId: creditorId } },
    data: { balance: { increment: -debtorDelta } },
  });
  await tx.ledgerAccount.update({
    where: { businessId_counterpartyBusinessId: { businessId: creditorId, counterpartyBusinessId: debtorId } },
    data: { balance: { increment: -creditorDelta } },
  });
}

export const LedgerService = {
  /**
   * Record SALE transaction for a delivered order.
   * Must be called INSIDE an existing transaction (delivery atomically creates debt).
   */
  async recordOrderSaleInTx(
    tx: Prisma.TransactionClient,
    params: {
      orderId: number;
      buyerBusinessId: number;
      sellerBusinessId: number;
      amount: number;
      createdByUserId: number;
      orderNumber: string;
    }
  ) {
    if (params.amount <= 0) throw new Error("المبلغ يجب أن يكون موجبًا");
    await ensureAccounts(tx, params.buyerBusinessId, params.sellerBusinessId);
    const created = await tx.ledgerTransaction.create({
      data: {
        type: "SALE",
        status: "CONFIRMED",
        debtorBusinessId: params.buyerBusinessId,
        creditorBusinessId: params.sellerBusinessId,
        amount: params.amount,
        orderId: params.orderId,
        notes: `طلب مكتمل ${params.orderNumber}`,
        createdByUserId: params.createdByUserId,
        confirmedByUserId: params.createdByUserId,
        confirmedAt: new Date(),
      },
    });
    await applyToBalances(tx, params.buyerBusinessId, params.sellerBusinessId, "SALE", params.amount);
    return created;
  },

  /**
   * Record PAYMENT transaction for an order.
   * Must be called INSIDE an existing transaction.
   */
  async recordOrderPaymentInTx(
    tx: Prisma.TransactionClient,
    params: {
      orderId: number;
      buyerBusinessId: number;
      sellerBusinessId: number;
      amount: number;
      createdByUserId: number;
      orderNumber: string;
      notes?: string | null;
    }
  ) {
    if (params.amount <= 0) throw new Error("المبلغ يجب أن يكون موجبًا");
    await ensureAccounts(tx, params.buyerBusinessId, params.sellerBusinessId);
    const created = await tx.ledgerTransaction.create({
      data: {
        type: "PAYMENT",
        status: "CONFIRMED",
        debtorBusinessId: params.buyerBusinessId,
        creditorBusinessId: params.sellerBusinessId,
        amount: params.amount,
        orderId: params.orderId,
        notes: params.notes ?? `دفعة على الطلب ${params.orderNumber}`,
        createdByUserId: params.createdByUserId,
        confirmedByUserId: params.createdByUserId,
        confirmedAt: new Date(),
      },
    });
    await applyToBalances(tx, params.buyerBusinessId, params.sellerBusinessId, "PAYMENT", params.amount);
    return created;
  },

  async recordInternal(params: {
    type: LedgerTxType;
    debtorBusinessId: number;
    creditorBusinessId: number;
    amount: number;
    orderId?: number | null;
    createdByUserId: number;
    notes?: string | null;
    externalRef?: string | null;
  }) {
    if (params.amount <= 0) throw new Error("المبلغ يجب أن يكون موجبًا");
    if (params.debtorBusinessId === params.creditorBusinessId) {
      throw new Error("لا يمكن تسجيل معاملة بين نفس النشاط");
    }
    return prisma.$transaction(async (tx) => {
      await ensureAccounts(tx, params.debtorBusinessId, params.creditorBusinessId);
      const created = await tx.ledgerTransaction.create({
        data: {
          type: params.type,
          status: "CONFIRMED",
          debtorBusinessId: params.debtorBusinessId,
          creditorBusinessId: params.creditorBusinessId,
          amount: params.amount,
          orderId: params.orderId ?? null,
          externalRef: params.externalRef ?? null,
          notes: params.notes ?? null,
          createdByUserId: params.createdByUserId,
          confirmedByUserId: params.createdByUserId,
          confirmedAt: new Date(),
        },
      });
      await applyToBalances(tx, params.debtorBusinessId, params.creditorBusinessId, params.type, params.amount);
      return created;
    });
  },

  async recordExternal(params: {
    type: LedgerTxType;
    ownerBusinessId: number;
    counterpartyBusinessId: number;
    debtorBusinessId: number;
    creditorBusinessId: number;
    amount: number;
    createdByUserId: number;
    notes?: string | null;
    externalRef?: string | null;
  }) {
    if (params.amount <= 0) throw new Error("المبلغ يجب أن يكون موجبًا");
    if (params.debtorBusinessId === params.creditorBusinessId) {
      throw new Error("الطرفان متطابقان");
    }
    const validPair =
      (params.debtorBusinessId === params.ownerBusinessId && params.creditorBusinessId === params.counterpartyBusinessId) ||
      (params.creditorBusinessId === params.ownerBusinessId && params.debtorBusinessId === params.counterpartyBusinessId);
    if (!validPair) throw new Error("أحد الطرفين يجب أن يكون نشاطك");

    return prisma.$transaction(async (tx) => {
      await ensureAccounts(tx, params.ownerBusinessId, params.counterpartyBusinessId);
      // Created with PENDING status — no balance impact until confirmed
      return tx.ledgerTransaction.create({
        data: {
          type: params.type,
          status: "PENDING",
          debtorBusinessId: params.debtorBusinessId,
          creditorBusinessId: params.creditorBusinessId,
          amount: params.amount,
          externalRef: params.externalRef ?? null,
          notes: params.notes ?? null,
          createdByUserId: params.createdByUserId,
        },
      });
    });
  },

  async confirm(transactionId: number, confirmerUserId: number) {
    return prisma.$transaction(async (tx) => {
      const t = await tx.ledgerTransaction.findUnique({ where: { id: transactionId } });
      if (!t) throw new Error("المعاملة غير موجودة");
      if (t.status !== "PENDING") throw new Error(`لا يمكن تأكيد معاملة بحالة ${t.status}`);
      const updated = await tx.ledgerTransaction.update({
        where: { id: transactionId },
        data: { status: "CONFIRMED", confirmedByUserId: confirmerUserId, confirmedAt: new Date() },
      });
      await applyToBalances(tx, t.debtorBusinessId, t.creditorBusinessId, t.type as LedgerTxType, Number(t.amount));
      return updated;
    });
  },

  async reject(transactionId: number, confirmerUserId: number, reason?: string | null) {
    return prisma.$transaction(async (tx) => {
      const t = await tx.ledgerTransaction.findUnique({ where: { id: transactionId } });
      if (!t) throw new Error("المعاملة غير موجودة");
      if (t.status !== "PENDING") throw new Error(`لا يمكن رفض معاملة بحالة ${t.status}`);
      return tx.ledgerTransaction.update({
        where: { id: transactionId },
        data: {
          status: "REJECTED",
          confirmedByUserId: confirmerUserId,
          confirmedAt: new Date(),
          rejectionReason: reason ?? null,
        },
      });
    });
  },

  async voidTransaction(transactionId: number, actorUserId: number, reason?: string | null) {
    return prisma.$transaction(async (tx) => {
      const t = await tx.ledgerTransaction.findUnique({ where: { id: transactionId } });
      if (!t) throw new Error("المعاملة غير موجودة");
      if (t.status !== "CONFIRMED") throw new Error("فقط المعاملات المؤكدة يمكن إلغاؤها");
      // Reverse balance effect, then mark REJECTED
      await revertFromBalances(tx, t.debtorBusinessId, t.creditorBusinessId, t.type as LedgerTxType, Number(t.amount));
      return tx.ledgerTransaction.update({
        where: { id: transactionId },
        data: { status: "REJECTED", confirmedByUserId: actorUserId, confirmedAt: new Date(), rejectionReason: reason ?? "تم الإلغاء" },
      });
    });
  },

  async listAccounts(businessId: number) {
    return prisma.ledgerAccount.findMany({
      where: { businessId },
      orderBy: { updatedAt: "desc" },
      include: {
        counterparty: { select: { id: true, name: true, slug: true, type: true, city: true, logo: true, status: true } },
      },
    });
  },

  async getAccountDetail(businessId: number, counterpartyBusinessId: number) {
    const account = await prisma.ledgerAccount.findUnique({
      where: { businessId_counterpartyBusinessId: { businessId, counterpartyBusinessId } },
      include: {
        counterparty: { select: { id: true, name: true, slug: true, type: true, city: true, logo: true, status: true } },
      },
    });
    const transactions = await prisma.ledgerTransaction.findMany({
      where: {
        OR: [
          { debtorBusinessId: businessId, creditorBusinessId: counterpartyBusinessId },
          { debtorBusinessId: counterpartyBusinessId, creditorBusinessId: businessId },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: { id: true, orderNumber: true } },
        createdBy: { select: { id: true, name: true } },
        confirmedBy: { select: { id: true, name: true } },
      },
    });
    return { account, transactions };
  },

  async listPending(businessId: number) {
    return prisma.ledgerTransaction.findMany({
      where: {
        status: "PENDING",
        OR: [{ debtorBusinessId: businessId }, { creditorBusinessId: businessId }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        debtor: { select: { id: true, name: true } },
        creditor: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
  },
};