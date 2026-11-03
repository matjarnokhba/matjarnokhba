import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/wholesale/errors";
import { logWholesaleAction } from "@/lib/wholesale/audit";
import { getBusinessUnitContext } from "@/lib/wholesale/context";
import { FinancialLedgerService } from "./financial-ledger.service";

// ═══ Types ═══
type PaymentMethodType = string;

type CreatePaymentInput = {
  businessUnitId: number;
  counterpartyBusinessUnitId?: number | null;
  amount: number;
  method: PaymentMethodType;
  currency?: string;
  paidAt?: Date;
  notes?: string;
  userId: number;
  groupId?: number | null;
  allocations?: Array<{ invoiceId: number; amount: number }>;
};

type CreatePaymentGroupInput = {
  businessUnitId: number;
  totalAmount: number;
  referenceOrderGroupId?: number | null;
  userId: number;
};

type RefundInput = {
  paymentId: number;
  paymentAllocationId?: number | null;
  amount: number;
  method: PaymentMethodType;
  reason: string;
  userId: number;
};

type CreateSettlementInput = {
  paymentId: number;
  businessUnitId: number;
  amount: number;
  userId: number;
};

// ═══ Helpers ═══
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function generateNumber(
  tx: any,
  prefix: string,
  offset: number
): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await tx.orderSequence.upsert({
    where: { year: year + offset },
    create: { year: year + offset, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `${prefix}-${year}-${String(seq.lastNumber).padStart(5, "0")}`;
}

async function computePaymentRemaining(
  tx: any,
  paymentId: number
): Promise<{ total: number; allocated: number; refunded: number; remaining: number }> {
  const p = await tx.payment.findUnique({
    where: { id: paymentId },
    select: { amount: true },
  });
  if (!p) throw new NotFoundError("Payment", paymentId);

  const agg = await tx.paymentAllocation.aggregate({
    where: { paymentId },
    _sum: { allocatedAmount: true, refundedAmount: true },
  });
  const allocated = round2(Number(agg._sum.allocatedAmount ?? 0));
  const refunded = round2(Number(agg._sum.refundedAmount ?? 0));
  const remaining = round2(Number(p.amount) - allocated + refunded);

  return { total: Number(p.amount), allocated, refunded, remaining };
}

// ═══ Service ═══
export const WholesalePaymentService = {
  // ═══ Create a single payment ═══
  async createPayment(tx: any, input: CreatePaymentInput): Promise<number> {
    if (typeof input.amount !== "number" || input.amount <= 0) {
      throw new ValidationError("المبلغ يجب أن يكون > 0");
    }
    if (!input.method || input.method.trim().length < 2) {
      throw new ValidationError("طريقة الدفع مطلوبة");
    }

    const ctx = await getBusinessUnitContext(input.userId, input.businessUnitId);

    // If counterparty set, ensure it's a different BU
    if (input.counterpartyBusinessUnitId === input.businessUnitId) {
      throw new ValidationError("لا يمكن الدفع للنفس");
    }

    // If groupId set, verify group belongs to same payer
    if (input.groupId) {
      const group = await tx.paymentGroup.findUnique({
        where: { id: input.groupId },
        select: { businessUnitId: true, status: true },
      });
      if (!group) throw new NotFoundError("PaymentGroup", input.groupId);
      if (group.businessUnitId !== input.businessUnitId) {
        throw new ValidationError("المجموعة لا تنتمي لهذا النشاط");
      }
      if (group.status === "COMPLETED") {
        throw new ValidationError("المجموعة مكتملة");
      }
    }

    const paymentNumber = await generateNumber(tx, "PM", 600000);
    const amount = round2(input.amount);
    const paidAt = input.paidAt ?? new Date();
    const currency = input.currency ?? "MAD";

    const payment = await tx.payment.create({
      data: {
        groupId: input.groupId ?? null,
        paymentNumber,
        businessUnitId: input.businessUnitId,
        counterpartyBusinessUnitId: input.counterpartyBusinessUnitId ?? null,
        amount,
        currency,
        method: input.method.trim(),
        status: "CONFIRMED",
        paidAt,
        notes: input.notes?.trim() || null,
        createdByUserId: input.userId,
      },
    });

    // ═══ Payer book entry: DR AP, CR Cash ═══
    const payerBookId = await FinancialLedgerService.ensureBook(
      input.businessUnitId,
      input.userId,
      tx
    );
    const apId = await FinancialLedgerService.accountIdByCode(payerBookId, "2000");
    const cashId = await FinancialLedgerService.accountIdByCode(payerBookId, "1000");

    await FinancialLedgerService.postEntry(
      {
        bookId: payerBookId,
        referenceType: "PAYMENT",
        referenceId: payment.id,
        description: `دفعة ${paymentNumber} — ${input.method}`,
        lines: [
          { accountId: apId, debit: amount },
          { accountId: cashId, credit: amount },
        ],
        userId: input.userId,
      },
      tx
    );

    // ═══ Receiver book entry: DR Cash, CR AR ═══
    if (input.counterpartyBusinessUnitId) {
      const recvBookId = await FinancialLedgerService.ensureBook(
        input.counterpartyBusinessUnitId,
        input.userId,
        tx
      );
      const cashId2 = await FinancialLedgerService.accountIdByCode(recvBookId, "1000");
      const arId2 = await FinancialLedgerService.accountIdByCode(recvBookId, "1200");

      await FinancialLedgerService.postEntry(
        {
          bookId: recvBookId,
          referenceType: "PAYMENT_RECEIPT",
          referenceId: payment.id,
          description: `استلام دفعة ${paymentNumber} من BU#${input.businessUnitId}`,
          lines: [
            { accountId: cashId2, debit: amount },
            { accountId: arId2, credit: amount },
          ],
          userId: input.userId,
        },
        tx
      );
    }

    // ═══ Allocations ═══
    if (input.allocations && input.allocations.length > 0) {
      let sumAllocated = 0;
      for (const alloc of input.allocations) {
        if (alloc.amount <= 0) {
          throw new ValidationError("مبلغ التخصيص يجب أن يكون > 0");
        }
        sumAllocated += alloc.amount;
      }
      if (round2(sumAllocated) > amount + 0.01) {
        throw new ValidationError(
          "مجموع التخصيصات يتجاوز مبلغ الدفعة"
        );
      }
      for (const alloc of input.allocations) {
        await this.allocateToInvoice(tx, {
          paymentId: payment.id,
          invoiceId: alloc.invoiceId,
          amount: alloc.amount,
        });
      }
    }

    await logWholesaleAction(tx, {
      userId: input.userId,
      businessUnitId: input.businessUnitId,
      action: "payment.created",
      entityType: "Payment",
      entityId: payment.id,
      after: {
        paymentNumber,
        amount,
        method: input.method,
        counterparty: input.counterpartyBusinessUnitId ?? null,
      },
    });

    return payment.id;
  },

  // ═══ Create a payment group ═══
  async createPaymentGroup(
    tx: any,
    input: CreatePaymentGroupInput
  ): Promise<number> {
    if (typeof input.totalAmount !== "number" || input.totalAmount <= 0) {
      throw new ValidationError("المبلغ الإجمالي يجب أن يكون > 0");
    }
    await getBusinessUnitContext(input.userId, input.businessUnitId);

    const groupNumber = await generateNumber(tx, "PG", 800000);

    const group = await tx.paymentGroup.create({
      data: {
        groupNumber,
        businessUnitId: input.businessUnitId,
        totalAmount: round2(input.totalAmount),
        status: "PENDING",
        referenceOrderGroupId: input.referenceOrderGroupId ?? null,
      },
    });

    await logWholesaleAction(tx, {
      userId: input.userId,
      businessUnitId: input.businessUnitId,
      action: "payment_group.created",
      entityType: "PaymentGroup",
      entityId: group.id,
      after: { groupNumber, totalAmount: input.totalAmount },
    });

    return group.id;
  },

  // ═══ Allocate payment to invoice ═══
  async allocateToInvoice(
    tx: any,
    params: { paymentId: number; invoiceId: number; amount: number }
  ): Promise<number> {
    const amount = round2(params.amount);
    if (amount <= 0) {
      throw new ValidationError("مبلغ التخصيص يجب أن يكون > 0");
    }

    const payment = await tx.payment.findUnique({
      where: { id: params.paymentId },
      select: { id: true, businessUnitId: true, amount: true, status: true },
    });
    if (!payment) throw new NotFoundError("Payment", params.paymentId);
    if (payment.status !== "CONFIRMED") {
      throw new ValidationError(`لا يمكن التخصيص لدفعة بحالة ${payment.status}`);
    }

    const invoice = await tx.invoice.findUnique({
      where: { id: params.invoiceId },
      select: {
        id: true,
        businessUnitId: true,
        total: true,
        paidAmount: true,
        status: true,
      },
    });
    if (!invoice) throw new NotFoundError("Invoice", params.invoiceId);
    if (!["ISSUED", "PARTIALLY_PAID"].includes(invoice.status)) {
      throw new ValidationError(
        `لا يمكن تخصيص دفعة لفاتورة بحالة ${invoice.status}`
      );
    }
    if (payment.businessUnitId !== invoice.businessUnitId) {
      throw new ValidationError(
        "الدفعة والفاتورة يجب أن تكونا لنفس النشاط التجاري"
      );
    }

    // Check payment remaining
    const rem = await computePaymentRemaining(tx, params.paymentId);
    if (amount > rem.remaining + 0.01) {
      throw new ValidationError(
        `المبلغ المتبقي في الدفعة (${rem.remaining}) أقل من المخصص (${amount})`
      );
    }

    // Check invoice remaining
    const invoiceRemaining = round2(
      Number(invoice.total) - Number(invoice.paidAmount)
    );
    if (amount > invoiceRemaining + 0.01) {
      throw new ValidationError(
        `المتبقي على الفاتورة (${invoiceRemaining}) أقل من المخصص (${amount})`
      );
    }

    // Ensure no duplicate allocation for this (payment, invoice) pair
    const existing = await tx.paymentAllocation.findUnique({
      where: {
        paymentId_invoiceId: {
          paymentId: params.paymentId,
          invoiceId: params.invoiceId,
        },
      },
      select: { id: true, allocatedAmount: true },
    });

    let allocationId: number;
    if (existing) {
      // Update existing allocation
      await tx.paymentAllocation.update({
        where: { id: existing.id },
        data: {
          allocatedAmount: {
            increment: amount,
          },
        },
      });
      allocationId = existing.id;
    } else {
      const created = await tx.paymentAllocation.create({
        data: {
          paymentId: params.paymentId,
          invoiceId: params.invoiceId,
          allocatedAmount: amount,
          refundedAmount: 0,
        },
      });
      allocationId = created.id;
    }

    // Update invoice paidAmount + status
    const newPaid = round2(Number(invoice.paidAmount) + amount);
    let newStatus: any = "PARTIALLY_PAID";
    if (newPaid >= Number(invoice.total) - 0.01) newStatus = "PAID";

    await tx.invoice.update({
      where: { id: params.invoiceId },
      data: { paidAmount: newPaid, status: newStatus },
    });

    return allocationId;
  },

  // ═══ Refund (full or partial) ═══
  async refund(tx: any, input: RefundInput): Promise<number> {
    if (typeof input.amount !== "number" || input.amount <= 0) {
      throw new ValidationError("مبلغ الاسترداد يجب أن يكون > 0");
    }
    if (!input.reason || input.reason.trim().length < 3) {
      throw new ValidationError("سبب الاسترداد مطلوب");
    }

    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      select: {
        id: true,
        paymentNumber: true,
        businessUnitId: true,
        counterpartyBusinessUnitId: true,
        amount: true,
        status: true,
      },
    });
    if (!payment) throw new NotFoundError("Payment", input.paymentId);
    if (payment.status !== "CONFIRMED") {
      throw new ValidationError(`لا يمكن استرداد دفعة بحالة ${payment.status}`);
    }

    // Verify refund limit
    const rem = await computePaymentRemaining(tx, input.paymentId);
    // remaining = total - allocated + refunded; refundable = allocated - refunded
    const refundable = round2(rem.allocated - rem.refunded);
    if (input.amount > refundable + 0.01) {
      throw new ValidationError(
        `المبلغ القابل للاسترداد (${refundable}) أقل من المطلوب (${input.amount})`
      );
    }

    // If linked to allocation, validate its remaining
    let alloc: any = null;
    if (input.paymentAllocationId) {
      alloc = await tx.paymentAllocation.findUnique({
        where: { id: input.paymentAllocationId },
        select: {
          id: true,
          paymentId: true,
          invoiceId: true,
          allocatedAmount: true,
          refundedAmount: true,
        },
      });
      if (!alloc) throw new NotFoundError("PaymentAllocation", input.paymentAllocationId);
      if (alloc.paymentId !== input.paymentId) {
        throw new ValidationError("التخصيص لا ينتمي لهذه الدفعة");
      }
      const allocRemaining = round2(
        Number(alloc.allocatedAmount) - Number(alloc.refundedAmount)
      );
      if (input.amount > allocRemaining + 0.01) {
        throw new ValidationError(
          `المتبقي في التخصيص (${allocRemaining}) أقل من مبلغ الاسترداد`
        );
      }
    }

    const amount = round2(input.amount);
    const refundNumber = await generateNumber(tx, "RF", 700000);

    // Create Refund record
    const refund = await tx.refund.create({
      data: {
        refundNumber,
        paymentId: input.paymentId,
        paymentAllocationId: input.paymentAllocationId ?? null,
        amount,
        method: input.method,
        status: "COMPLETED",
        reason: input.reason.trim(),
        processedAt: new Date(),
      },
    });

    // Update allocation + invoice if linked
    if (alloc) {
      await tx.paymentAllocation.update({
        where: { id: alloc.id },
        data: { refundedAmount: { increment: amount } },
      });

      // Reduce invoice paidAmount
      const invoice = await tx.invoice.findUnique({
        where: { id: alloc.invoiceId },
        select: { id: true, total: true, paidAmount: true, status: true },
      });
      if (invoice) {
        const newPaid = Math.max(
          0,
          round2(Number(invoice.paidAmount) - amount)
        );
        let newStatus: any = "ISSUED";
        if (newPaid > 0.01 && newPaid < Number(invoice.total) - 0.01) {
          newStatus = "PARTIALLY_PAID";
        } else if (newPaid >= Number(invoice.total) - 0.01) {
          newStatus = "PAID";
        }
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { paidAmount: newPaid, status: newStatus },
        });
      }
    }

    // ═══ Payer book: DR Cash, CR AP (reverse) ═══
    const payerBookId = await FinancialLedgerService.ensureBook(
      payment.businessUnitId,
      input.userId,
      tx
    );
    const apId = await FinancialLedgerService.accountIdByCode(payerBookId, "2000");
    const cashId = await FinancialLedgerService.accountIdByCode(payerBookId, "1000");

    await FinancialLedgerService.postEntry(
      {
        bookId: payerBookId,
        referenceType: "REFUND",
        referenceId: refund.id,
        description: `استرداد ${refundNumber} — ${input.reason}`,
        lines: [
          { accountId: cashId, debit: amount },
          { accountId: apId, credit: amount },
        ],
        userId: input.userId,
      },
      tx
    );

    // ═══ Receiver book: DR AR, CR Cash (reverse receipt) ═══
    if (payment.counterpartyBusinessUnitId) {
      const recvBookId = await FinancialLedgerService.ensureBook(
        payment.counterpartyBusinessUnitId,
        input.userId,
        tx
      );
      const cashId2 = await FinancialLedgerService.accountIdByCode(recvBookId, "1000");
      const arId2 = await FinancialLedgerService.accountIdByCode(recvBookId, "1200");

      await FinancialLedgerService.postEntry(
        {
          bookId: recvBookId,
          referenceType: "REFUND_OUT",
          referenceId: refund.id,
          description: `استرداد دفعة ${payment.paymentNumber} — ${refundNumber}`,
          lines: [
            { accountId: arId2, debit: amount },
            { accountId: cashId2, credit: amount },
          ],
          userId: input.userId,
        },
        tx
      );
    }

    await logWholesaleAction(tx, {
      userId: input.userId,
      businessUnitId: payment.businessUnitId,
      action: "payment.refunded",
      entityType: "Refund",
      entityId: refund.id,
      after: {
        refundNumber,
        amount,
        paymentId: input.paymentId,
        reason: input.reason,
      },
    });

    return refund.id;
  },

  // ═══ Settlement (platform intermediated) ═══
  async createSettlement(
    tx: any,
    input: CreateSettlementInput
  ): Promise<number> {
    if (typeof input.amount !== "number" || input.amount <= 0) {
      throw new ValidationError("مبلغ التسوية يجب أن يكون > 0");
    }

    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      select: {
        id: true,
        paymentNumber: true,
        amount: true,
        status: true,
      },
    });
    if (!payment) throw new NotFoundError("Payment", input.paymentId);
    if (payment.status !== "CONFIRMED") {
      throw new ValidationError(`لا يمكن تسوية دفعة بحالة ${payment.status}`);
    }

    const existing = await tx.settlement.findUnique({
      where: { paymentId: input.paymentId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError("تسوية موجودة مسبقًا لهذه الدفعة");
    }

    if (input.amount > Number(payment.amount) + 0.01) {
      throw new ValidationError(
        "مبلغ التسوية يتجاوز مبلغ الدفعة"
      );
    }

    await getBusinessUnitContext(input.userId, input.businessUnitId);

    const amount = round2(input.amount);

    const settlement = await tx.settlement.create({
      data: {
        paymentId: input.paymentId,
        businessUnitId: input.businessUnitId,
        amount,
        status: "SETTLED",
        settledAt: new Date(),
      },
    });

    // ═══ Beneficiary book: DR Cash, CR AR ═══
    // (In practice, platform tracks AP to seller, then pays them)
    const bookId = await FinancialLedgerService.ensureBook(
      input.businessUnitId,
      input.userId,
      tx
    );
    const cashId = await FinancialLedgerService.accountIdByCode(bookId, "1000");
    const arId = await FinancialLedgerService.accountIdByCode(bookId, "1200");

    await FinancialLedgerService.postEntry(
      {
        bookId,
        referenceType: "SETTLEMENT",
        referenceId: settlement.id,
        description: `تسوية دفعة ${payment.paymentNumber}`,
        lines: [
          { accountId: cashId, debit: amount },
          { accountId: arId, credit: amount },
        ],
        userId: input.userId,
      },
      tx
    );

    await logWholesaleAction(tx, {
      userId: input.userId,
      businessUnitId: input.businessUnitId,
      action: "settlement.created",
      entityType: "Settlement",
      entityId: settlement.id,
      after: { paymentId: input.paymentId, amount },
    });

    return settlement.id;
  },

  // ═══ Read: get payment ═══
  async get(userId: number, paymentId: number) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        group: { select: { id: true, groupNumber: true, status: true } },
        allocations: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                invoiceType: true,
                total: true,
                paidAmount: true,
                status: true,
              },
            },
          },
        },
        refunds: {
          select: {
            id: true,
            refundNumber: true,
            amount: true,
            method: true,
            status: true,
            reason: true,
            processedAt: true,
          },
        },
        settlement: { select: { id: true, amount: true, status: true, settledAt: true } },
      },
    });
    if (!payment) throw new NotFoundError("Payment", paymentId);

    let authorized = false;
    try { await getBusinessUnitContext(userId, payment.businessUnitId); authorized = true; } catch {}
    if (!authorized && payment.counterpartyBusinessUnitId) {
      try { await getBusinessUnitContext(userId, payment.counterpartyBusinessUnitId); authorized = true; } catch {}
    }
    if (!authorized) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (u?.role === "ADMIN" || u?.role === "SUPER_ADMIN") authorized = true;
    }
    if (!authorized) throw new ForbiddenError("لا تملك صلاحية الوصول لهذه الدفعة");

    // Compute remaining
    const allocated = round2(
      payment.allocations.reduce((s, a) => s + Number(a.allocatedAmount), 0)
    );
    const refunded = round2(
      payment.allocations.reduce((s, a) => s + Number(a.refundedAmount), 0)
    );
    const remaining = round2(Number(payment.amount) - allocated + refunded);

    return {
      ...payment,
      summary: {
        total: Number(payment.amount),
        allocated,
        refunded,
        remaining,
      },
    };
  },

  // ═══ Read: list by BU ═══
  async listByBusinessUnit(
    userId: number,
    businessUnitId: number,
    filters: {
      direction?: "sent" | "received";
      from?: Date;
      to?: Date;
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    await getBusinessUnitContext(userId, businessUnitId);

    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 30));

    const where: any = {};
    if (filters.direction === "sent") {
      where.businessUnitId = businessUnitId;
    } else if (filters.direction === "received") {
      where.counterpartyBusinessUnitId = businessUnitId;
    } else {
      where.OR = [
        { businessUnitId },
        { counterpartyBusinessUnitId: businessUnitId },
      ];
    }
    if (filters.from || filters.to) {
      where.paidAt = {};
      if (filters.from) where.paidAt.gte = filters.from;
      if (filters.to) where.paidAt.lte = filters.to;
    }

    const [total, items] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { paidAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          paymentNumber: true,
          businessUnitId: true,
          counterpartyBusinessUnitId: true,
          amount: true,
          currency: true,
          method: true,
          status: true,
          paidAt: true,
          groupId: true,
        },
      }),
    ]);

    return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  },

  // ═══ Read: list by invoice ═══
  async listByInvoice(userId: number, invoiceId: number) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { businessUnitId: true, counterpartyBusinessUnitId: true },
    });
    if (!invoice) throw new NotFoundError("Invoice", invoiceId);

    let authorized = false;
    try { await getBusinessUnitContext(userId, invoice.businessUnitId); authorized = true; } catch {}
    if (!authorized) {
      try { await getBusinessUnitContext(userId, invoice.counterpartyBusinessUnitId); authorized = true; } catch {}
    }
    if (!authorized) throw new ForbiddenError("لا تملك صلاحية");

    const allocations = await prisma.paymentAllocation.findMany({
      where: { invoiceId },
      include: {
        payment: {
          select: {
            id: true,
            paymentNumber: true,
            method: true,
            paidAt: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return allocations.map((a) => ({
      id: a.id,
      allocatedAmount: Number(a.allocatedAmount),
      refundedAmount: Number(a.refundedAmount),
      remaining: round2(
        Number(a.allocatedAmount) - Number(a.refundedAmount)
      ),
      payment: a.payment,
      createdAt: a.createdAt,
    }));
  },

  // ═══ Helper: compute remaining for a payment ═══
  async getPaymentRemaining(userId: number, paymentId: number) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { businessUnitId: true, counterpartyBusinessUnitId: true },
    });
    if (!payment) throw new NotFoundError("Payment", paymentId);
    let authorized = false;
    try { await getBusinessUnitContext(userId, payment.businessUnitId); authorized = true; } catch {}
    if (!authorized && payment.counterpartyBusinessUnitId) {
      try { await getBusinessUnitContext(userId, payment.counterpartyBusinessUnitId); authorized = true; } catch {}
    }
    if (!authorized) throw new ForbiddenError("لا تملك صلاحية");

    return computePaymentRemaining(prisma, paymentId);
  },
};