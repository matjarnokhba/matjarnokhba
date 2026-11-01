import { prisma } from "@/lib/prisma";
import { generateReturnNumber } from "@/lib/wholesale-return-number";
import { recordLineage } from "@/lib/lineage";
import { LedgerService } from "@/services/ledger.service";

const TX_TIMEOUT = 60000;

async function assertBusinessMember(tx: any, businessId: number, userId: number, allowedRoles: string[]) {
  const biz = await tx.business.findUnique({
    where: { id: businessId },
    include: { members: { where: { userId, deletedAt: null } } },
  });
  if (!biz || biz.deletedAt) throw new Error("النشاط غير موجود");
  if (biz.status !== "VERIFIED") throw new Error("النشاط غير موثق");
  const isOwner = biz.ownerUserId === userId;
  const member = biz.members[0] || null;
  if (!isOwner && (!member || !allowedRoles.includes(member.role))) {
    throw new Error("غير مصرح");
  }
  return biz;
}

export type ReturnItemInput = {
  orderItemId: number;
  quantity: number;
  condition?: string | null;
  notes?: string | null;
};

export const WholesaleReturnService = {
  async createReturn(params: {
    orderId: number;
    buyerBusinessId: number;
    userId: number;
    reason: string;
    reasonDetails?: string | null;
    items: ReturnItemInput[];
  }) {
    return prisma.$transaction(async (tx) => {
      await assertBusinessMember(tx, params.buyerBusinessId, params.userId, ["MANAGER", "SALES", "INVENTORY"]);

      const order = await tx.wholesaleOrder.findUnique({
        where: { id: params.orderId },
        include: { items: true },
      });
      if (!order) throw new Error("الطلب غير موجود");
      if (order.buyerBusinessId !== params.buyerBusinessId) {
        throw new Error("الطلب لا يخص هذا النشاط");
      }
      if (!["DELIVERED", "COMPLETED"].includes(order.status)) {
        throw new Error("المرتجع متاح فقط بعد التسليم");
      }

      const itemIds = params.items.map((i) => i.orderItemId);
      if (new Set(itemIds).size !== itemIds.length) {
        throw new Error("تكرار في بنود المرتجع");
      }

      const orderItemsById = new Map(order.items.map((oi: any) => [oi.id, oi]));
      for (const input of params.items) {
        if (!orderItemsById.has(input.orderItemId)) {
          throw new Error(`البند #${input.orderItemId} غير موجود في الطلب`);
        }
      }

      // Check cumulative returns per order item (including previous non-rejected returns)
      const priorReturns = await tx.wholesaleReturnItem.findMany({
        where: {
          orderItemId: { in: itemIds },
          returnRequest: { status: { in: ["REQUESTED", "APPROVED", "RECEIVED", "REFUNDED"] } },
        },
        select: { orderItemId: true, quantity: true },
      });
      const priorQtyByItem = new Map<number, number>();
      for (const pr of priorReturns) {
        priorQtyByItem.set(pr.orderItemId, (priorQtyByItem.get(pr.orderItemId) || 0) + pr.quantity);
      }

      let totalAmount = 0;
      const preparedItems: Array<{
        orderItemId: number;
        masterId: number;
        masterVariantId: number;
        quantity: number;
        unitPrice: number;
        subtotal: number;
        condition: string | null;
        notes: string | null;
      }> = [];

      for (const input of params.items) {
        const oi = orderItemsById.get(input.orderItemId)!;
        const priorQty = priorQtyByItem.get(input.orderItemId) || 0;
        const remainingQty = oi.quantity - priorQty;
        if (input.quantity > remainingQty) {
          throw new Error(`لا يمكن إرجاع ${input.quantity} من "${oi.productName}" (المتاح ${remainingQty})`);
        }
        const unitPrice = Number(oi.unitPrice);
        const subtotal = unitPrice * input.quantity;
        totalAmount += subtotal;
        preparedItems.push({
          orderItemId: oi.id,
          masterId: oi.masterId,
          masterVariantId: oi.masterVariantId,
          quantity: input.quantity,
          unitPrice,
          subtotal,
          condition: input.condition ?? null,
          notes: input.notes ?? null,
        });
      }

      // Validate buyer has enough in WholesaleInventory for each variant
      const variantIds = preparedItems.map((i) => i.masterVariantId);
      const inventories = await tx.wholesaleInventory.findMany({
        where: { businessId: params.buyerBusinessId, masterVariantId: { in: variantIds } },
      });
      const invByVariant = new Map(inventories.map((iv: any) => [iv.masterVariantId, iv.quantity]));

      const requestedByVariant = new Map<number, number>();
      for (const item of preparedItems) {
        requestedByVariant.set(item.masterVariantId, (requestedByVariant.get(item.masterVariantId) || 0) + item.quantity);
      }
      for (const [mvId, qty] of requestedByVariant) {
        const available = invByVariant.get(mvId) || 0;
        if (available < qty) {
          throw new Error(`المخزون غير كافٍ للإرجاع (المتاح ${available}، المطلوب ${qty}). المنتجات المستوردة للتجزئة يجب معالجتها بشكل منفصل.`);
        }
      }

      let returnNumber = generateReturnNumber(params.buyerBusinessId);
      let created: any = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          created = await tx.wholesaleReturnRequest.create({
            data: {
              returnNumber,
              orderId: params.orderId,
              buyerBusinessId: params.buyerBusinessId,
              sellerBusinessId: order.sellerBusinessId,
              requestedByUserId: params.userId,
              reason: params.reason,
              reasonDetails: params.reasonDetails ?? null,
              status: "REQUESTED",
              totalAmount,
              items: {
                create: preparedItems.map((pi) => ({
                  orderItemId: pi.orderItemId,
                  masterId: pi.masterId,
                  masterVariantId: pi.masterVariantId,
                  quantity: pi.quantity,
                  unitPrice: pi.unitPrice,
                  subtotal: pi.subtotal,
                  condition: pi.condition,
                  notes: pi.notes,
                })),
              },
            },
          });
          break;
        } catch (e: any) {
          if (e.code === "P2002" && attempt < 4) {
            returnNumber = generateReturnNumber(params.buyerBusinessId);
            continue;
          }
          throw e;
        }
      }
      if (!created) throw new Error("تعذر إنشاء رقم المرتجع");

      await tx.wholesaleReturnStatusHistory.create({
        data: {
          returnId: created.id,
          fromStatus: null,
          toStatus: "REQUESTED",
          changedByUserId: params.userId,
          notes: "تم إنشاء طلب المرتجع",
        },
      });

      return created;
    }, { timeout: TX_TIMEOUT });
  },

  async approveReturn(returnId: number, sellerBusinessId: number, userId: number, approvedAmount?: number | null, sellerNotes?: string | null) {
    return prisma.$transaction(async (tx) => {
      await assertBusinessMember(tx, sellerBusinessId, userId, ["MANAGER", "SALES"]);
      const ret = await tx.wholesaleReturnRequest.findUnique({ where: { id: returnId } });
      if (!ret) throw new Error("المرتجع غير موجود");
      if (ret.sellerBusinessId !== sellerBusinessId) throw new Error("غير مصرح");
      if (ret.status !== "REQUESTED") throw new Error(`لا يمكن القبول بحالة ${ret.status}`);

      const amount = approvedAmount != null ? approvedAmount : Number(ret.totalAmount);
      if (amount <= 0) throw new Error("المبلغ المعتمد يجب أن يكون موجبًا");
      if (amount > Number(ret.totalAmount)) throw new Error("المبلغ المعتمد يتجاوز الإجمالي");

      const updated = await tx.wholesaleReturnRequest.update({
        where: { id: returnId },
        data: { status: "APPROVED", approvedAmount: amount, approvedAt: new Date(), sellerNotes: sellerNotes ?? null },
      });
      await tx.wholesaleReturnStatusHistory.create({
        data: { returnId, fromStatus: "REQUESTED", toStatus: "APPROVED", changedByUserId: userId, notes: sellerNotes ?? `المبلغ المعتمد: ${amount}` },
      });
      return updated;
    });
  },

  async rejectReturn(returnId: number, sellerBusinessId: number, userId: number, rejectionReason?: string | null) {
    return prisma.$transaction(async (tx) => {
      await assertBusinessMember(tx, sellerBusinessId, userId, ["MANAGER", "SALES"]);
      const ret = await tx.wholesaleReturnRequest.findUnique({ where: { id: returnId } });
      if (!ret) throw new Error("المرتجع غير موجود");
      if (ret.sellerBusinessId !== sellerBusinessId) throw new Error("غير مصرح");
      if (ret.status !== "REQUESTED") throw new Error(`لا يمكن الرفض بحالة ${ret.status}`);

      const updated = await tx.wholesaleReturnRequest.update({
        where: { id: returnId },
        data: { status: "REJECTED", rejectionReason: rejectionReason ?? "لم يتم تقديم سبب" },
      });
      await tx.wholesaleReturnStatusHistory.create({
        data: { returnId, fromStatus: "REQUESTED", toStatus: "REJECTED", changedByUserId: userId, notes: rejectionReason ?? null },
      });
      return updated;
    });
  },

  async receiveReturn(returnId: number, sellerBusinessId: number, userId: number) {
    return prisma.$transaction(async (tx) => {
      await assertBusinessMember(tx, sellerBusinessId, userId, ["MANAGER", "SALES", "INVENTORY"]);

      const locked = await tx.$queryRaw<Array<{ id: number; status: string; sellerBusinessId: number; orderId: number; buyerBusinessId: number }>>`
        SELECT "id", "status", "sellerBusinessId", "orderId", "buyerBusinessId"
        FROM "WholesaleReturnRequest" WHERE "id" = ${returnId} FOR UPDATE
      `;
      if (locked.length === 0) throw new Error("المرتجع غير موجود");
      const ret = locked[0];
      if (ret.sellerBusinessId !== sellerBusinessId) throw new Error("غير مصرح");
      if (ret.status !== "APPROVED") throw new Error(`لا يمكن الاستلام بحالة ${ret.status}`);

      const items = await tx.wholesaleReturnItem.findMany({ where: { returnId } });

      for (const item of items) {
        // 1. Decrement buyer's wholesale inventory
        const buyerDec = await tx.$executeRaw`
          UPDATE "WholesaleInventory"
          SET "quantity" = "quantity" - ${item.quantity}
          WHERE "businessId" = ${ret.buyerBusinessId}
            AND "masterVariantId" = ${item.masterVariantId}
            AND "quantity" >= ${item.quantity}
        `;
        if (buyerDec === 0) {
          throw new Error(`مخزون المشتري غير كافٍ للبند ${item.id}`);
        }

        // 2. Increment seller's WholesaleOfferVariant.stock (restock)
        const offerVar = await tx.wholesaleOfferVariant.findFirst({
          where: { masterVariantId: item.masterVariantId, offer: { businessId: sellerBusinessId, deletedAt: null } },
          select: { id: true },
        });
        if (offerVar) {
          await tx.wholesaleOfferVariant.update({
            where: { id: offerVar.id },
            data: { stock: { increment: item.quantity } },
          });
        }

        // 3. Record lineage RETURN
        await recordLineage(tx, {
          masterId: item.masterId,
          masterVariantId: item.masterVariantId,
          fromBusinessId: ret.buyerBusinessId,
          toBusinessId: ret.sellerBusinessId,
          quantity: item.quantity,
          unitPrice: String(item.unitPrice),
          transferType: "RETURN",
          notes: `مرتجع #${ret.id} على الطلب #${ret.orderId}`,
        });
      }

      const updated = await tx.wholesaleReturnRequest.update({
        where: { id: returnId },
        data: { status: "RECEIVED", receivedAt: new Date() },
      });
      await tx.wholesaleReturnStatusHistory.create({
        data: { returnId, fromStatus: "APPROVED", toStatus: "RECEIVED", changedByUserId: userId },
      });
      return updated;
    }, { timeout: TX_TIMEOUT });
  },

  async refundReturn(returnId: number, sellerBusinessId: number, userId: number) {
    return prisma.$transaction(async (tx) => {
      await assertBusinessMember(tx, sellerBusinessId, userId, ["MANAGER", "ACCOUNTANT"]);

      const locked = await tx.$queryRaw<Array<{ id: number; status: string; sellerBusinessId: number; buyerBusinessId: number; orderId: number; approvedAmount: any; totalAmount: any }>>`
        SELECT "id", "status", "sellerBusinessId", "buyerBusinessId", "orderId", "approvedAmount", "totalAmount"
        FROM "WholesaleReturnRequest" WHERE "id" = ${returnId} FOR UPDATE
      `;
      if (locked.length === 0) throw new Error("المرتجع غير موجود");
      const ret = locked[0];
      if (ret.sellerBusinessId !== sellerBusinessId) throw new Error("غير مصرح");
      if (ret.status !== "RECEIVED") throw new Error(`لا يمكن الاسترداد بحالة ${ret.status}`);

      const amount = Number(ret.approvedAmount ?? ret.totalAmount);

      // Ledger REFUND: buyer's debt decreases, seller's credit decreases
      await LedgerService.recordInternal({
        type: "REFUND",
        debtorBusinessId: ret.buyerBusinessId,
        creditorBusinessId: ret.sellerBusinessId,
        amount,
        orderId: ret.orderId,
        createdByUserId: userId,
        notes: `استرداد مرتجع #${returnId}`,
      });

      const updated = await tx.wholesaleReturnRequest.update({
        where: { id: returnId },
        data: { status: "REFUNDED", refundedAt: new Date() },
      });
      await tx.wholesaleReturnStatusHistory.create({
        data: { returnId, fromStatus: "RECEIVED", toStatus: "REFUNDED", changedByUserId: userId, notes: `المبلغ المسترد: ${amount}` },
      });
      return updated;
    });
  },

  async cancelReturn(returnId: number, buyerBusinessId: number, userId: number) {
    return prisma.$transaction(async (tx) => {
      await assertBusinessMember(tx, buyerBusinessId, userId, ["MANAGER", "SALES", "INVENTORY"]);
      const ret = await tx.wholesaleReturnRequest.findUnique({ where: { id: returnId } });
      if (!ret) throw new Error("المرتجع غير موجود");
      if (ret.buyerBusinessId !== buyerBusinessId) throw new Error("غير مصرح");
      if (ret.status !== "REQUESTED") throw new Error("الإلغاء متاح فقط قبل الموافقة");

      const updated = await tx.wholesaleReturnRequest.update({
        where: { id: returnId },
        data: { status: "CANCELLED" },
      });
      await tx.wholesaleReturnStatusHistory.create({
        data: { returnId, fromStatus: "REQUESTED", toStatus: "CANCELLED", changedByUserId: userId },
      });
      return updated;
    });
  },

  async getReturn(returnId: number) {
    return prisma.wholesaleReturnRequest.findUnique({
      where: { id: returnId },
      include: {
        order: { select: { id: true, orderNumber: true, status: true, total: true } },
        buyerBusiness: { select: { id: true, name: true, city: true, logo: true } },
        sellerBusiness: { select: { id: true, name: true, city: true, logo: true } },
        requestedBy: { select: { id: true, name: true } },
        items: {
          include: {
            orderItem: { select: { id: true, productName: true, sku: true, quantity: true } },
            masterVariant: { select: { id: true, sku: true, barcode: true, options: true } },
          },
        },
        statusHistory: {
          orderBy: { createdAt: "asc" },
          include: { changedByUser: { select: { id: true, name: true } } },
        },
      },
    });
  },

  async listReturns(businessId: number, side: "buyer" | "seller", filters: { status?: string; page?: number; pageSize?: number } = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(Math.max(1, filters.pageSize ?? 30), 100);
    const where: any = side === "buyer" ? { buyerBusinessId: businessId } : { sellerBusinessId: businessId };
    if (filters.status) where.status = filters.status;

    const [total, items] = await Promise.all([
      prisma.wholesaleReturnRequest.count({ where }),
      prisma.wholesaleReturnRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          buyerBusiness: { select: { id: true, name: true, logo: true } },
          sellerBusiness: { select: { id: true, name: true, logo: true } },
          order: { select: { id: true, orderNumber: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },
};