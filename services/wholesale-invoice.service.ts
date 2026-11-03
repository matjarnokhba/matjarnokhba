import { prisma } from "@/lib/prisma";
import {
  NotFoundError,
  ValidationError,
} from "@/lib/wholesale/errors";
import { logWholesaleAction } from "@/lib/wholesale/audit";
import { getBusinessUnitContext } from "@/lib/wholesale/context";
import { FinancialLedgerService } from "./financial-ledger.service";

type InvoiceType = "SALE" | "PURCHASE" | "CREDIT_NOTE" | "DEBIT_NOTE";
type CreditNoteReason = "RETURN" | "PARTIAL_REFUND" | "DISPUTE" | "OVERPAYMENT" | "OTHER";

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

export const WholesaleInvoiceService = {
  // ═══ SALE invoice (seller side) ═══
  async issueSaleInvoiceForOrder(
    tx: any,
    orderId: number,
    userId: number
  ): Promise<number> {
    const order = await tx.wholesaleOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true, orderNumber: true, subtotal: true, total: true,
        sellerBusinessUnitId: true, buyerBusinessUnitId: true, status: true,
      },
    });
    if (!order) throw new NotFoundError("WholesaleOrder", orderId);
    if (!["SHIPPED", "DELIVERED"].includes(order.status)) {
      throw new ValidationError(`لا يمكن إصدار فاتورة لطلب بحالة ${order.status}`);
    }

    const existing = await tx.invoice.findFirst({
      where: { orderId, invoiceType: "SALE", businessUnitId: order.sellerBusinessUnitId },
      select: { id: true },
    });
    if (existing) return existing.id;

    const bookId = await FinancialLedgerService.ensureBook(order.sellerBusinessUnitId, userId, tx);
    const arId = await FinancialLedgerService.accountIdByCode(bookId, "1200");
    const salesId = await FinancialLedgerService.accountIdByCode(bookId, "4000");
    const taxId = await FinancialLedgerService.accountIdByCode(bookId, "2100");

    const subtotal = Number(order.subtotal);
    const total = Number(order.total);
    const taxAmount = Math.max(0, total - subtotal);

    const invoiceNumber = await generateNumber(tx, "SA", 300000);

    const inv = await tx.invoice.create({
      data: {
        bookId, invoiceNumber, invoiceType: "SALE",
        businessUnitId: order.sellerBusinessUnitId,
        counterpartyBusinessUnitId: order.buyerBusinessUnitId,
        orderId: order.id, subtotal, taxAmount, total,
        paidAmount: 0, status: "ISSUED", issuedAt: new Date(),
        notes: `طلب جملة ${order.orderNumber}`,
      },
    });

    const lines: any[] = [
      { accountId: arId, debit: total },
      { accountId: salesId, credit: subtotal },
    ];
    if (taxAmount > 0) lines.push({ accountId: taxId, credit: taxAmount });

    await FinancialLedgerService.postEntry({
      bookId, referenceType: "INVOICE", referenceId: inv.id,
      description: `فاتورة بيع ${invoiceNumber}`, lines, userId,
    }, tx);

    await logWholesaleAction(tx, {
      userId, businessUnitId: order.sellerBusinessUnitId,
      action: "invoice.sale_issued", entityType: "Invoice", entityId: inv.id,
      after: { invoiceNumber, total },
    });

    return inv.id;
  },

  // ═══ PURCHASE invoice (buyer side) ═══
  async issuePurchaseInvoiceForOrder(
    tx: any,
    orderId: number,
    userId: number
  ): Promise<number> {
    const order = await tx.wholesaleOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true, orderNumber: true, subtotal: true, total: true,
        sellerBusinessUnitId: true, buyerBusinessUnitId: true, status: true,
      },
    });
    if (!order) throw new NotFoundError("WholesaleOrder", orderId);
    if (!["SHIPPED", "DELIVERED"].includes(order.status)) {
      throw new ValidationError(`لا يمكن إصدار فاتورة لطلب بحالة ${order.status}`);
    }

    const existing = await tx.invoice.findFirst({
      where: { orderId, invoiceType: "PURCHASE", businessUnitId: order.buyerBusinessUnitId },
      select: { id: true },
    });
    if (existing) return existing.id;

    const bookId = await FinancialLedgerService.ensureBook(order.buyerBusinessUnitId, userId, tx);
    const inventoryId = await FinancialLedgerService.accountIdByCode(bookId, "1100");
    const taxId = await FinancialLedgerService.accountIdByCode(bookId, "2100");
    const apId = await FinancialLedgerService.accountIdByCode(bookId, "2000");

    const subtotal = Number(order.subtotal);
    const total = Number(order.total);
    const taxAmount = Math.max(0, total - subtotal);

    const invoiceNumber = await generateNumber(tx, "PU", 400000);

    const inv = await tx.invoice.create({
      data: {
        bookId, invoiceNumber, invoiceType: "PURCHASE",
        businessUnitId: order.buyerBusinessUnitId,
        counterpartyBusinessUnitId: order.sellerBusinessUnitId,
        orderId: order.id, subtotal, taxAmount, total,
        paidAmount: 0, status: "ISSUED", issuedAt: new Date(),
        notes: `شراء جملة ${order.orderNumber}`,
      },
    });

    const lines: any[] = [{ accountId: inventoryId, debit: subtotal }];
    if (taxAmount > 0) lines.push({ accountId: taxId, debit: taxAmount });
    lines.push({ accountId: apId, credit: total });

    await FinancialLedgerService.postEntry({
      bookId, referenceType: "INVOICE", referenceId: inv.id,
      description: `فاتورة شراء ${invoiceNumber}`, lines, userId,
    }, tx);

    await logWholesaleAction(tx, {
      userId, businessUnitId: order.buyerBusinessUnitId,
      action: "invoice.purchase_issued", entityType: "Invoice", entityId: inv.id,
      after: { invoiceNumber, total },
    });

    return inv.id;
  },

  // ═══ Both invoices atomically ═══
  async issueBothForOrder(tx: any, orderId: number, userId: number) {
    const saleInvoiceId = await this.issueSaleInvoiceForOrder(tx, orderId, userId);
    const purchaseInvoiceId = await this.issuePurchaseInvoiceForOrder(tx, orderId, userId);
    return { saleInvoiceId, purchaseInvoiceId };
  },

  // ═══ Credit note ═══
  async issueCreditNote(
    tx: any,
    params: {
      originalInvoiceId: number;
      amount: number;
      reasonCode: CreditNoteReason;
      reasonText?: string | null;
      returnOrderId?: number | null;
      userId: number;
    }
  ): Promise<number> {
    if (typeof params.amount !== "number" || params.amount <= 0) {
      throw new ValidationError("قيمة الإشعار الدائن يجب أن تكون > 0");
    }

    const original = await tx.invoice.findUnique({
      where: { id: params.originalInvoiceId },
      select: {
        id: true, bookId: true, invoiceNumber: true, invoiceType: true,
        businessUnitId: true, counterpartyBusinessUnitId: true,
        orderId: true, total: true,
      },
    });
    if (!original) throw new NotFoundError("Invoice", params.originalInvoiceId);
    if (!["SALE", "PURCHASE"].includes(original.invoiceType)) {
      throw new ValidationError(`لا يمكن إصدار إشعار دائن لفاتورة نوعها ${original.invoiceType}`);
    }

    const existingCredit = await tx.creditNote.aggregate({
      where: { originalInvoiceId: original.id },
      _sum: { amount: true },
    });
    const alreadyCredited = Number(existingCredit._sum.amount ?? 0);
    if (alreadyCredited + params.amount > Number(original.total) + 0.01) {
      throw new ValidationError("مجموع الإشعارات الدائنة يتجاوز قيمة الفاتورة");
    }

    const invoiceNumber = await generateNumber(tx, "CN", 500000);

    const newInv = await tx.invoice.create({
      data: {
        bookId: original.bookId, invoiceNumber, invoiceType: "CREDIT_NOTE",
        originalInvoiceId: original.id,
        businessUnitId: original.businessUnitId,
        counterpartyBusinessUnitId: original.counterpartyBusinessUnitId,
        orderId: original.orderId,
        returnOrderId: params.returnOrderId ?? null,
        subtotal: params.amount, taxAmount: 0, total: params.amount,
        paidAmount: 0, status: "ISSUED", issuedAt: new Date(),
        notes: params.reasonText?.trim() || null,
      },
    });

    await tx.creditNote.create({
      data: {
        invoiceId: newInv.id, originalInvoiceId: original.id,
        returnOrderId: params.returnOrderId ?? null,
        amount: params.amount,
        reasonCode: params.reasonCode as any,
        reasonText: params.reasonText?.trim() || null,
        issuedByUserId: params.userId, issuedAt: new Date(),
      },
    });

    const amount = params.amount;
    if (original.invoiceType === "SALE") {
      const arId = await FinancialLedgerService.accountIdByCode(original.bookId, "1200");
      const salesId = await FinancialLedgerService.accountIdByCode(original.bookId, "4000");
      await FinancialLedgerService.postEntry({
        bookId: original.bookId, referenceType: "CREDIT_NOTE",
        referenceId: newInv.id,
        description: `إشعار دائن ${invoiceNumber}`,
        lines: [
          { accountId: salesId, debit: amount },
          { accountId: arId, credit: amount },
        ],
        userId: params.userId,
      }, tx);
    } else {
      const inventoryId = await FinancialLedgerService.accountIdByCode(original.bookId, "1100");
      const apId = await FinancialLedgerService.accountIdByCode(original.bookId, "2000");
      await FinancialLedgerService.postEntry({
        bookId: original.bookId, referenceType: "CREDIT_NOTE",
        referenceId: newInv.id,
        description: `إشعار دائن ${invoiceNumber}`,
        lines: [
          { accountId: apId, debit: amount },
          { accountId: inventoryId, credit: amount },
        ],
        userId: params.userId,
      }, tx);
    }

    await logWholesaleAction(tx, {
      userId: params.userId, businessUnitId: original.businessUnitId,
      action: "invoice.credit_note_issued", entityType: "CreditNote",
      entityId: newInv.id,
      after: { amount, originalInvoiceId: original.id },
    });

    return newInv.id;
  },

  // ═══ Helper: mark invoice paid/partially-paid ═══
  async updatePaymentStatus(tx: any, invoiceId: number, newPaidAmount: number): Promise<void> {
    const inv = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, total: true, status: true },
    });
    if (!inv) throw new NotFoundError("Invoice", invoiceId);
    if (["CANCELLED", "VOID"].includes(inv.status)) {
      throw new ValidationError(`لا يمكن تعديل فاتورة بحالة ${inv.status}`);
    }

    const total = Number(inv.total);
    const paid = Math.min(newPaidAmount, total);
    let status: any = "ISSUED";
    if (paid >= total - 0.01) status = "PAID";
    else if (paid > 0.01) status = "PARTIALLY_PAID";

    await tx.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount: paid, status },
    });
  },

  // ═══ Read: get invoice ═══
  async get(userId: number, invoiceId: number) {
    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        creditNote: { select: { id: true, amount: true, reasonCode: true, issuedAt: true } },
        allocations: {
          include: {
            payment: {
              select: { id: true, paymentNumber: true, amount: true, paidAt: true, status: true },
            },
          },
        },
      },
    });
    if (!inv) throw new NotFoundError("Invoice", invoiceId);

    let authorized = false;
    try { await getBusinessUnitContext(userId, inv.businessUnitId); authorized = true; } catch {}
    if (!authorized) {
      try { await getBusinessUnitContext(userId, inv.counterpartyBusinessUnitId); authorized = true; } catch {}
    }
    if (!authorized) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (u?.role === "ADMIN" || u?.role === "SUPER_ADMIN") authorized = true;
    }
    if (!authorized) throw new NotFoundError("Invoice", invoiceId);

    return inv;
  },

  // ═══ Read: list by BU ═══
  async listByBusinessUnit(
    userId: number,
    businessUnitId: number,
    filters: {
      invoiceType?: InvoiceType;
      status?: "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED" | "VOID";
      from?: Date;
      to?: Date;
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    await getBusinessUnitContext(userId, businessUnitId);

    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 30));

    const where: any = { businessUnitId };
    if (filters.invoiceType) where.invoiceType = filters.invoiceType;
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.issuedAt = {};
      if (filters.from) where.issuedAt.gte = filters.from;
      if (filters.to) where.issuedAt.lte = filters.to;
    }

    const [total, items] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        orderBy: { issuedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, invoiceNumber: true, invoiceType: true,
          counterpartyBusinessUnitId: true, orderId: true,
          total: true, paidAmount: true, status: true, issuedAt: true, dueAt: true,
        },
      }),
    ]);

    return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  },

  // ═══ Read: list by order ═══
  async listByOrder(userId: number, orderId: number) {
    const order = await prisma.wholesaleOrder.findUnique({
      where: { id: orderId },
      select: { buyerBusinessUnitId: true, sellerBusinessUnitId: true },
    });
    if (!order) throw new NotFoundError("WholesaleOrder", orderId);

    let authorized = false;
    try { await getBusinessUnitContext(userId, order.buyerBusinessUnitId); authorized = true; } catch {}
    if (!authorized) {
      try { await getBusinessUnitContext(userId, order.sellerBusinessUnitId); authorized = true; } catch {}
    }
    if (!authorized) throw new NotFoundError("WholesaleOrder", orderId);

    return prisma.invoice.findMany({
      where: { orderId },
      orderBy: { issuedAt: "asc" },
      select: {
        id: true, invoiceNumber: true, invoiceType: true,
        businessUnitId: true, counterpartyBusinessUnitId: true,
        total: true, paidAmount: true, status: true, issuedAt: true,
      },
    });
  },

  // ═══ Helper: generate payment number (for PaymentService) ═══
  async generatePaymentNumber(tx: any): Promise<string> {
    return generateNumber(tx, "PM", 600000);
  },
};