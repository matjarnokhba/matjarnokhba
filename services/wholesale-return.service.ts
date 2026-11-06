import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/wholesale/errors";
import { logWholesaleAction } from "@/lib/wholesale/audit";
import { getBusinessUnitContext } from "@/lib/wholesale/context";
import { WholesaleInventoryService } from "./wholesale-inventory.service";
import { WholesaleInvoiceService } from "./wholesale-invoice.service";

// ═══ Types ═══
type ReturnItemCondition = "SELLABLE" | "DAMAGED" | "QUARANTINED" | "REJECTED_RETURN";

type CreateItemInput = {
  originalOrderItemId: number;
  quantityRequested: number;
};

type CreateInput = {
  orderId: number;
  reason: string;
  expectedRefundAmount?: number | null;
  items: CreateItemInput[];
};

type ReceiveItemInput = {
  returnOrderItemId: number;
  quantityReceived: number;
};

type InspectItemInput = {
  returnOrderItemId: number;
  condition: ReturnItemCondition;
  quantityAccepted: number;
};

// ═══ Helpers ═══
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function generateReturnNumber(tx: any): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await tx.orderSequence.upsert({
    where: { year: year + 900000 },
    create: { year: year + 900000, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `WR-${year}-${String(seq.lastNumber).padStart(5, "0")}`;
}

async function resolveReturnAccess(userId: number, returnId: number) {
  const r = await prisma.returnOrder.findUnique({
    where: { id: returnId },
    include: { items: true },
  });
  if (!r) throw new NotFoundError("ReturnOrder", returnId);

  let isBuyer = false;
  let isSeller = false;
  try {
    await getBusinessUnitContext(userId, r.buyerBusinessUnitId);
    isBuyer = true;
  } catch {}
  try {
    await getBusinessUnitContext(userId, r.sellerBusinessUnitId);
    isSeller = true;
  } catch {}
  if (!isBuyer && !isSeller) {
    throw new ForbiddenError("لا تملك صلاحية الوصول لهذا المرتجع");
  }
  return { returnOrder: r, isBuyer, isSeller };
}

async function ensureSetup(tx: any, businessUnitId: number) {
  let loc = await tx.inventoryLocation.findFirst({
    where: { businessUnitId, type: "WAREHOUSE", isActive: true },
    select: { id: true },
  });
  if (!loc) {
    loc = await tx.inventoryLocation.create({
      data: { businessUnitId, name: "المستودع الرئيسي", type: "WAREHOUSE", isActive: true },
      select: { id: true },
    });
  }
  let wholesale = await tx.inventoryAccount.findFirst({
    where: { locationId: loc.id, type: "WHOLESALE", isActive: true },
    select: { id: true },
  });
  if (!wholesale) {
    wholesale = await tx.inventoryAccount.create({
      data: { locationId: loc.id, businessUnitId, type: "WHOLESALE", isActive: true },
      select: { id: true },
    });
  }
  let quarantine = await tx.inventoryAccount.findFirst({
    where: { locationId: loc.id, type: "QUARANTINE", isActive: true },
    select: { id: true },
  });
  if (!quarantine) {
    quarantine = await tx.inventoryAccount.create({
      data: { locationId: loc.id, businessUnitId, type: "QUARANTINE", isActive: true },
      select: { id: true },
    });
  }
  let damaged = await tx.inventoryAccount.findFirst({
    where: { locationId: loc.id, type: "DAMAGED", isActive: true },
    select: { id: true },
  });
  if (!damaged) {
    damaged = await tx.inventoryAccount.create({
      data: { locationId: loc.id, businessUnitId, type: "DAMAGED", isActive: true },
      select: { id: true },
    });
  }
  return { wholesaleAccountId: wholesale.id, quarantineAccountId: quarantine.id, damagedAccountId: damaged.id };
}

// ═══ Service ═══
export const WholesaleReturnService = {
  /**
   * Buyer requests a return on a DELIVERED order.
   */
  async create(tx: any, userId: number, input: CreateInput): Promise<number> {
    if (!input.reason || input.reason.trim().length < 3) {
      throw new ValidationError("سبب الإرجاع مطلوب (3 أحرف على الأقل)");
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new ValidationError("يجب تحديد بند واحد على الأقل للإرجاع");
    }

    const order = await tx.wholesaleOrder.findUnique({
      where: { id: input.orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundError("WholesaleOrder", input.orderId);
    if (order.buyerBusinessUnitId === 0) throw new ValidationError("طلب غير صالح");

    const buyerCtx = await getBusinessUnitContext(userId, order.buyerBusinessUnitId);

    if (order.status !== "DELIVERED") {
      throw new ValidationError(`لا يمكن الإرجاع من طلب بحالة ${order.status}`);
    }

    // Check existing active return
    const activeReturn = await tx.returnOrder.findFirst({
      where: {
        originalOrderId: order.id,
        status: { notIn: ["REJECTED", "CANCELLED", "COMPLETED"] },
      },
      select: { id: true },
    });
    if (activeReturn) {
      throw new ConflictError(
        `يوجد مرتجع نشط (#${activeReturn.id}) لهذا الطلب`
      );
    }

    // Validate items + quantities
    const orderItemMap = new Map<number, any>(order.items.map((i: any) => [i.id, i] as [number, any]));
    const seen = new Set<number>();
    let expectedRefundAmount = 0;

    for (const item of input.items) {
      if (!Number.isInteger(item.quantityRequested) || item.quantityRequested < 1) {
        throw new ValidationError("الكمية المطلوب إرجاعها يجب أن تكون عددًا صحيحًا موجبًا");
      }
      if (seen.has(item.originalOrderItemId)) {
        throw new ValidationError(`بند مكرر: ${item.originalOrderItemId}`);
      }
      seen.add(item.originalOrderItemId);

      const oi = orderItemMap.get(item.originalOrderItemId);
      if (!oi) {
        throw new ValidationError(`البند ${item.originalOrderItemId} لا ينتمي لهذا الطلب`);
      }
      if (item.quantityRequested > oi.quantity) {
        throw new ValidationError(
          `الكمية المطلوب إرجاعها (${item.quantityRequested}) تتجاوز المشتراة (${oi.quantity})`
        );
      }
      expectedRefundAmount += round2(Number(oi.unitPrice) * item.quantityRequested);
    }

    const returnNumber = await generateReturnNumber(tx);

    const created = await tx.returnOrder.create({
      data: {
        returnNumber,
        originalOrderId: order.id,
        buyerBusinessUnitId: order.buyerBusinessUnitId,
        sellerBusinessUnitId: order.sellerBusinessUnitId,
        status: "REQUESTED",
        reason: input.reason.trim(),
        expectedRefundAmount: input.expectedRefundAmount ?? round2(expectedRefundAmount),
      },
    });

    for (const item of input.items) {
      const oi = orderItemMap.get(item.originalOrderItemId)!;
      await tx.returnOrderItem.create({
        data: {
          returnOrderId: created.id,
          originalOrderItemId: item.originalOrderItemId,
          quantityRequested: item.quantityRequested,
          quantityReceived: 0,
          quantityAccepted: 0,
          condition: "SELLABLE",
        },
      });
    }

    await logWholesaleAction(tx, {
      userId,
      businessUnitId: buyerCtx.businessUnit.id,
      action: "return_order.created",
      entityType: "ReturnOrder",
      entityId: created.id,
      after: {
        returnNumber,
        orderId: order.id,
        expectedRefundAmount: round2(expectedRefundAmount),
        itemsCount: input.items.length,
      },
    });

    return created.id;
  },

  /**
   * Seller approves a REQUESTED return.
   */
  async approve(tx: any, userId: number, returnId: number): Promise<void> {
    const { returnOrder, isSeller } = await resolveReturnAccess(userId, returnId);
    if (!isSeller) throw new ForbiddenError("هذه العملية للبائع فقط");
    if (returnOrder.status !== "REQUESTED") {
      throw new ValidationError(`لا يمكن اعتماد مرتجع بحالة ${returnOrder.status}`);
    }

    await tx.returnOrder.update({
      where: { id: returnId },
      data: {
        status: "APPROVED",
        approvedByUserId: userId,
        approvedAt: new Date(),
      },
    });

    await logWholesaleAction(tx, {
      userId,
      businessUnitId: returnOrder.sellerBusinessUnitId,
      action: "return_order.approved",
      entityType: "ReturnOrder",
      entityId: returnId,
    });
  },

  /**
   * Seller rejects a REQUESTED return.
   */
  async reject(tx: any, userId: number, returnId: number, reason: string): Promise<void> {
    if (!reason || reason.trim().length < 3) {
      throw new ValidationError("سبب الرفض مطلوب");
    }
    const { returnOrder, isSeller } = await resolveReturnAccess(userId, returnId);
    if (!isSeller) throw new ForbiddenError("هذه العملية للبائع فقط");
    if (returnOrder.status !== "REQUESTED") {
      throw new ValidationError(`لا يمكن رفض مرتجع بحالة ${returnOrder.status}`);
    }

    await tx.returnOrder.update({
      where: { id: returnId },
      data: {
        status: "REJECTED",
        rejectedByUserId: userId,
        rejectedAt: new Date(),
        rejectionReason: reason.trim(),
      },
    });

    await logWholesaleAction(tx, {
      userId,
      businessUnitId: returnOrder.sellerBusinessUnitId,
      action: "return_order.rejected",
      entityType: "ReturnOrder",
      entityId: returnId,
      metadata: { reason: reason.trim() },
    });
  },

  /**
   * Buyer marks items as sent back (APPROVED → PENDING_SHIPMENT).
   */
  async markSent(tx: any, userId: number, returnId: number): Promise<void> {
    const { returnOrder, isBuyer } = await resolveReturnAccess(userId, returnId);
    if (!isBuyer) throw new ForbiddenError("هذه العملية للمشتري فقط");
    if (returnOrder.status !== "APPROVED") {
      throw new ValidationError(`لا يمكن تحديد الإرسال من حالة ${returnOrder.status}`);
    }

    await tx.returnOrder.update({
      where: { id: returnId },
      data: { status: "PENDING_SHIPMENT" },
    });

    await logWholesaleAction(tx, {
      userId,
      businessUnitId: returnOrder.buyerBusinessUnitId,
      action: "return_order.shipped_by_buyer",
      entityType: "ReturnOrder",
      entityId: returnId,
    });
  },

  /**
   * Seller receives items (PENDING_SHIPMENT → RECEIVED). Records quantities.
   */
  async receive(tx: any, userId: number, returnId: number, items: ReceiveItemInput[]): Promise<void> {
    const { returnOrder, isSeller } = await resolveReturnAccess(userId, returnId);
    if (!isSeller) throw new ForbiddenError("هذه العملية للبائع فقط");
    if (returnOrder.status !== "PENDING_SHIPMENT") {
      throw new ValidationError(`لا يمكن استلام مرتجع بحالة ${returnOrder.status}`);
    }

    const returnItemMap = new Map<number, any>(returnOrder.items.map((i: any) => [i.id, i] as [number, any]));

    for (const input of items) {
      if (!Number.isInteger(input.quantityReceived) || input.quantityReceived < 0) {
        throw new ValidationError("الكمية المستلمة يجب أن تكون عددًا صحيحًا >= 0");
      }
      const ri = returnItemMap.get(input.returnOrderItemId);
      if (!ri) {
        throw new ValidationError(`البند ${input.returnOrderItemId} لا ينتمي لهذا المرتجع`);
      }
      if (input.quantityReceived > ri.quantityRequested) {
        throw new ValidationError(
          `الكمية المستلمة (${input.quantityReceived}) تتجاوز المطلوبة (${ri.quantityRequested})`
        );
      }

      await tx.returnOrderItem.update({
        where: { id: input.returnOrderItemId },
        data: { quantityReceived: input.quantityReceived },
      });
    }

    await tx.returnOrder.update({
      where: { id: returnId },
      data: { status: "RECEIVED" },
    });

    await logWholesaleAction(tx, {
      userId,
      businessUnitId: returnOrder.sellerBusinessUnitId,
      action: "return_order.received",
      entityType: "ReturnOrder",
      entityId: returnId,
    });
  },

  /**
   * Seller inspects items (RECEIVED → INSPECTED). Sets conditions + accepted quantities.
   */
  async inspect(tx: any, userId: number, returnId: number, items: InspectItemInput[]): Promise<void> {
    const { returnOrder, isSeller } = await resolveReturnAccess(userId, returnId);
    if (!isSeller) throw new ForbiddenError("هذه العملية للبائع فقط");
    if (returnOrder.status !== "RECEIVED") {
      throw new ValidationError(`لا يمكن فحص مرتجع بحالة ${returnOrder.status}`);
    }

    const returnItemMap = new Map<number, any>(returnOrder.items.map((i: any) => [i.id, i] as [number, any]));

    for (const input of items) {
      if (!Number.isInteger(input.quantityAccepted) || input.quantityAccepted < 0) {
        throw new ValidationError("الكمية المقبولة يجب أن تكون عددًا صحيحًا >= 0");
      }
      if (!["SELLABLE", "DAMAGED", "QUARANTINED", "REJECTED_RETURN"].includes(input.condition)) {
        throw new ValidationError(`حالة غير صالحة: ${input.condition}`);
      }
      const ri = returnItemMap.get(input.returnOrderItemId);
      if (!ri) {
        throw new ValidationError(`البند ${input.returnOrderItemId} لا ينتمي لهذا المرتجع`);
      }
      if (input.quantityAccepted > ri.quantityReceived) {
        throw new ValidationError(
          `الكمية المقبولة (${input.quantityAccepted}) تتجاوز المستلمة (${ri.quantityReceived})`
        );
      }

      await tx.returnOrderItem.update({
        where: { id: input.returnOrderItemId },
        data: {
          condition: input.condition as any,
          quantityAccepted: input.quantityAccepted,
        },
      });
    }

    await tx.returnOrder.update({
      where: { id: returnId },
      data: { status: "INSPECTED" },
    });

    await logWholesaleAction(tx, {
      userId,
      businessUnitId: returnOrder.sellerBusinessUnitId,
      action: "return_order.inspected",
      entityType: "ReturnOrder",
      entityId: returnId,
    });
  },

  /**
   * Complete the return: 
   * 1) Move accepted items from buyer's inventory OUT (RETURN_OUT)
   * 2) Move them to seller's inventory IN (RETURN_IN, as new batch)
   *    - SELLABLE → seller's WHOLESALE account
   *    - DAMAGED → seller's DAMAGED account
   *    - QUARANTINED → seller's QUARANTINE account
   *    - REJECTED_RETURN → nothing (buyer keeps)
   * 3) Create CreditNote for accepted value
   * 4) If payment was made, refund the credit note amount
   * 5) Status: COMPLETED
   */
  async complete(tx: any, userId: number, returnId: number): Promise<{
    creditNoteId: number | null;
    refundId: number | null;
    inventoryActions: number;
  }> {
    const { returnOrder, isSeller } = await resolveReturnAccess(userId, returnId);
    if (!isSeller) throw new ForbiddenError("هذه العملية للبائع فقط");
    if (returnOrder.status !== "INSPECTED") {
      throw new ValidationError(`لا يمكن إكمال مرتجع بحالة ${returnOrder.status}`);
    }

    // Fetch original order
    const originalOrder = await tx.wholesaleOrder.findUnique({
      where: { id: returnOrder.originalOrderId },
      include: { items: true },
    });
    if (!originalOrder) throw new NotFoundError("WholesaleOrder", returnOrder.originalOrderId);

    const originalItemMap = new Map<number, any>(originalOrder.items.map((i: any) => [i.id, i] as [number, any]));

    // Setup accounts
    const sellerSetup = await ensureSetup(tx, returnOrder.sellerBusinessUnitId);
    const buyerSetup = await ensureSetup(tx, returnOrder.buyerBusinessUnitId);

    // Account mapping by condition
    const targetAccountId = (condition: string): number | null => {
      switch (condition) {
        case "SELLABLE": return sellerSetup.wholesaleAccountId;
        case "DAMAGED": return sellerSetup.damagedAccountId;
        case "QUARANTINED": return sellerSetup.quarantineAccountId;
        case "REJECTED_RETURN": return null;
        default: return null;
      }
    };

    let totalAcceptedValue = 0;
    let inventoryActions = 0;
    let anyPartiallyAccepted = false;

    // Process each return item
    const finalReturnItems: Array<{ returnItemId: number; originalItemId: number; quantityAccepted: number; condition: string; unitPrice: number }> = [];

    for (const ri of returnOrder.items) {
      if (ri.quantityAccepted <= 0) continue;

      const originalItem = originalItemMap.get(ri.originalOrderItemId);
      if (!originalItem) {
        throw new NotFoundError("WholesaleOrderItem", ri.originalOrderItemId);
      }

      const unitPrice = Number(originalItem.unitPrice);
      const lineValue = round2(unitPrice * ri.quantityAccepted);
      totalAcceptedValue += lineValue;

      finalReturnItems.push({
        returnItemId: ri.id,
        originalItemId: ri.originalOrderItemId,
        quantityAccepted: ri.quantityAccepted,
        condition: ri.condition,
        unitPrice,
      });

      if (ri.quantityAccepted < ri.quantityReceived) {
        anyPartiallyAccepted = true;
      }
    }

    if (finalReturnItems.length === 0) {
      throw new ValidationError("لا توجد بنود مقبولة لإكمال الإرجاع");
    }

    // ═══ Inventory movement ═══
    for (const item of finalReturnItems) {
      // Buyer: transfer OUT (RETURN_OUT)
      if (!originalItemMap.get(item.originalItemId)!.merchantVariantId) {
        throw new ValidationError(`البند ${item.originalItemId} بدون merchantVariantId`);
      }

      // Buyer side OUT — need to find the buyer's merchantVariant (may differ from seller's)
      const buyerMp = await tx.merchantProduct.findFirst({
        where: {
          businessUnitId: returnOrder.buyerBusinessUnitId,
          masterId: (await tx.wholesaleOrderItem.findUnique({
            where: { id: item.originalItemId },
            select: { offer: { select: { masterId: true } } },
          }))!.offer!.masterId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (buyerMp) {
        const buyerMv = await tx.merchantVariant.findFirst({
          where: {
            merchantProductId: buyerMp.id,
            masterVariantId: (await tx.wholesaleOrderItem.findUnique({
              where: { id: item.originalItemId },
              select: { masterVariantId: true },
            }))!.masterVariantId,
          },
          select: { id: true },
        });

        if (buyerMv) {
          try {
            await WholesaleInventoryService.transferOut(tx, {
              merchantVariantId: buyerMv.id,
              inventoryAccountId: buyerSetup.wholesaleAccountId,
              businessUnitId: returnOrder.buyerBusinessUnitId,
              quantity: item.quantityAccepted,
              referenceType: "WHOLESALE_RETURN",
              referenceId: returnId,
              type: "RETURN_OUT",
              notes: `إرجاع طلب ${originalOrder.orderNumber}`,
              userId,
            });
            inventoryActions++;
          } catch (e: any) {
            // If buyer has insufficient stock (already consumed it), log and continue
            console.warn(
              `Buyer inventory RETURN_OUT failed for return ${returnId}, item ${item.returnItemId}: ${e?.message}`
            );
          }
        }
      }

      // Seller side IN — only if condition accepts back to stock
      const sellerTargetAccountId = targetAccountId(item.condition);
      if (sellerTargetAccountId) {
        // Find seller's merchantVariant (originalItem.merchantVariantId IS the seller's, set at order creation)
        const sellerMvId = originalItemMap.get(item.originalItemId)!.merchantVariantId;
        if (sellerMvId) {
          await WholesaleInventoryService.transferIn(tx, {
            merchantVariantId: sellerMvId,
            inventoryAccountId: sellerTargetAccountId,
            businessUnitId: returnOrder.sellerBusinessUnitId,
            quantity: item.quantityAccepted,
            unitCost: item.unitPrice,
            sourceType: "RETURN",
            sourceReferenceId: item.returnItemId,
            referenceType: "WHOLESALE_RETURN",
            referenceId: returnId,
            notes: `مرتجع ${item.condition} - طلب ${originalOrder.orderNumber}`,
            userId,
          });
          inventoryActions++;
        }
      }
    }

    // ═══ Credit Note ═══
    let creditNoteId: number | null = null;
    if (totalAcceptedValue > 0) {
      // Find the original SALE invoice for this order
      const saleInvoice = await tx.invoice.findFirst({
        where: {
          orderId: returnOrder.originalOrderId,
          invoiceType: "SALE",
          businessUnitId: returnOrder.sellerBusinessUnitId,
        },
        select: { id: true, paidAmount: true, total: true },
      });

      if (saleInvoice) {
        creditNoteId = await WholesaleInvoiceService.issueCreditNote(tx, {
          originalInvoiceId: saleInvoice.id,
          amount: round2(totalAcceptedValue),
          reasonCode: "RETURN",
          reasonText: `إرجاع ${returnOrder.returnNumber}: ${returnOrder.reason}`,
          returnOrderId: returnId,
          userId,
        });
      }
    }

    // ═══ Refund (if buyer had already paid) ═══
    let refundId: number | null = null;
    if (creditNoteId && totalAcceptedValue > 0) {
      // Find the payment allocations on the original SALE invoice
      const saleInvoice = await tx.invoice.findFirst({
        where: {
          orderId: returnOrder.originalOrderId,
          invoiceType: "SALE",
          businessUnitId: returnOrder.sellerBusinessUnitId,
        },
        select: { id: true },
      });

      if (saleInvoice) {
        const allocation = await tx.paymentAllocation.findFirst({
          where: {
            invoiceId: saleInvoice.id,
            // remaining > 0
          },
          include: {
            payment: { select: { id: true, businessUnitId: true, amount: true, status: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        if (allocation && allocation.payment.status === "CONFIRMED") {
          try {
            refundId = await WholesalePaymentService.refund(tx, {
              paymentId: allocation.paymentId,
              paymentAllocationId: allocation.id,
              amount: round2(totalAcceptedValue),
              method: "CREDIT",
              reason: `إرجاع ${returnOrder.returnNumber}`,
              userId,
            });
          } catch (e: any) {
            console.warn(`Refund failed for return ${returnId}: ${e?.message}`);
          }
        }
      }
    }

    // ═══ Status ═══
    const finalStatus = anyPartiallyAccepted ? "PARTIALLY_ACCEPTED" : "COMPLETED";

    await tx.returnOrder.update({
      where: { id: returnId },
      data: {
        status: finalStatus as any,
        approvedRefundAmount: round2(totalAcceptedValue),
        completedAt: new Date(),
      },
    });

    await logWholesaleAction(tx, {
      userId,
      businessUnitId: returnOrder.sellerBusinessUnitId,
      action: "return_order.completed",
      entityType: "ReturnOrder",
      entityId: returnId,
      after: {
        totalAcceptedValue: round2(totalAcceptedValue),
        creditNoteId,
        refundId,
        inventoryActions,
      },
    });

    return {
      creditNoteId,
      refundId,
      inventoryActions,
    };
  },

  /**
   * Cancel a return (buyer or seller) before completion.
   */
  async cancel(tx: any, userId: number, returnId: number, reason: string): Promise<void> {
    if (!reason || reason.trim().length < 3) {
      throw new ValidationError("سبب الإلغاء مطلوب");
    }
    const { returnOrder, isBuyer, isSeller } = await resolveReturnAccess(userId, returnId);
    if (!["REQUESTED", "APPROVED", "PENDING_SHIPMENT"].includes(returnOrder.status)) {
      throw new ValidationError(`لا يمكن إلغاء مرتجع بحالة ${returnOrder.status}`);
    }

    await tx.returnOrder.update({
      where: { id: returnId },
      data: {
        status: "CANCELLED",
        rejectionReason: reason.trim(),
      },
    });

    await logWholesaleAction(tx, {
      userId,
      businessUnitId: isSeller
        ? returnOrder.sellerBusinessUnitId
        : returnOrder.buyerBusinessUnitId,
      action: "return_order.cancelled",
      entityType: "ReturnOrder",
      entityId: returnId,
      metadata: { reason: reason.trim() },
    });
  },

  /**
   * Read: get return with items.
   */
  async get(userId: number, returnId: number) {
    const { returnOrder } = await resolveReturnAccess(userId, returnId);

    const full = await prisma.returnOrder.findUnique({
      where: { id: returnId },
      include: {
        items: {
          include: {
            originalOrderItem: {
              select: {
                id: true,
                productName: true,
                unitPrice: true,
                quantity: true,
                subtotal: true,
              },
            },
            inventoryReturns: {
              select: {
                id: true,
                inventoryLedgerId: true,
                condition: true,
                quantity: true,
                sourceBatchId: true,
              },
            },
          },
        },
        creditNotes: {
          select: {
            id: true,
            amount: true,
            reasonCode: true,
            issuedAt: true,
          },
        },
        originalOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            deliveredAt: true,
          },
        },
      },
    });

    return full;
  },

  /**
   * Read: list by business unit (buyer or seller).
   */
  async listByBusinessUnit(
    userId: number,
    businessUnitId: number,
    filters: {
      direction?: "buyer" | "seller";
      status?: "REQUESTED" | "APPROVED" | "REJECTED" | "PENDING_SHIPMENT" | "RECEIVED" | "INSPECTED" | "PARTIALLY_ACCEPTED" | "COMPLETED" | "CANCELLED";
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    await getBusinessUnitContext(userId, businessUnitId);

    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 30));

    const where: any = {};
    if (filters.direction === "buyer") {
      where.buyerBusinessUnitId = businessUnitId;
    } else if (filters.direction === "seller") {
      where.sellerBusinessUnitId = businessUnitId;
    } else {
      where.OR = [
        { buyerBusinessUnitId: businessUnitId },
        { sellerBusinessUnitId: businessUnitId },
      ];
    }
    if (filters.status) where.status = filters.status;

    const [total, items] = await Promise.all([
      prisma.returnOrder.count({ where }),
      prisma.returnOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          returnNumber: true,
          originalOrderId: true,
          buyerBusinessUnitId: true,
          sellerBusinessUnitId: true,
          status: true,
          reason: true,
          expectedRefundAmount: true,
          approvedRefundAmount: true,
          createdAt: true,
          completedAt: true,
          _count: { select: { items: true } },
        },
      }),
    ]);

    return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  },
};

// Re-export for internal use
import { WholesalePaymentService } from "./wholesale-payment.service";