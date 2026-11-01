import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/wholesale-order-number";
import { resolveUnitPrice } from "@/lib/wholesale-offer-validation";
import { recordLineage } from "@/lib/lineage";

export type CreateOrderItemInput = {
  offerVariantId: number;
  quantity: number;
  notes?: string | null;
};

export type CreateOrderInput = {
  sellerBusinessId: number;
  items: CreateOrderItemInput[];
  shippingCost: number;
  discountAmount: number;
  notes?: string | null;
  estimatedDelivery?: string | null;
};

const TX_TIMEOUT = 60000;

async function assertCanBuy(tx: any, buyerBusinessId: number) {
  const buyer = await tx.business.findUnique({
    where: { id: buyerBusinessId },
    select: { id: true, type: true, status: true, deletedAt: true },
  });
  if (!buyer || buyer.deletedAt) throw new Error("نشاط المشتري غير موجود");
  if (buyer.status !== "VERIFIED") throw new Error("نشاط المشتري غير موثق");
  if (buyer.type !== "WHOLESALE_TRADER") throw new Error("فقط حسابات تجار الجملة يمكنها الشراء");
  return buyer;
}

async function assertSellerEligible(tx: any, sellerBusinessId: number) {
  const seller = await tx.business.findUnique({
    where: { id: sellerBusinessId },
    select: { id: true, type: true, status: true, deletedAt: true },
  });
  if (!seller || seller.deletedAt) throw new Error("نشاط البائع غير موجود");
  if (seller.status !== "VERIFIED") throw new Error("نشاط البائع غير موثق");
  return seller;
}

async function assertActorManagesBusiness(
  tx: any,
  businessId: number,
  actorUserId: number,
  allowedRoles: string[]
) {
  const biz = await tx.business.findUnique({
    where: { id: businessId },
    include: { members: { where: { userId: actorUserId, deletedAt: null } } },
  });
  if (!biz) throw new Error("النشاط غير موجود");
  const isOwner = biz.ownerUserId === actorUserId;
  const member = biz.members[0] || null;
  if (!isOwner && (!member || !allowedRoles.includes(member.role))) {
    throw new Error("غير مصرح");
  }
  return biz;
}

export const WholesaleOrderService = {
  async createOrder(buyerBusinessId: number, buyerUserId: number, input: CreateOrderInput) {
    return prisma.$transaction(async (tx) => {
      const buyer = await assertCanBuy(tx, buyerBusinessId);
      const seller = await assertSellerEligible(tx, input.sellerBusinessId);
      if (buyer.id === seller.id) throw new Error("لا يمكن الشراء من نفس النشاط");

      const variantIds = input.items.map((i) => i.offerVariantId);
      if (new Set(variantIds).size !== variantIds.length) {
        throw new Error("لا يمكن تكرار نفس المتغير في الطلب");
      }

      const variants = await tx.wholesaleOfferVariant.findMany({
        where: { id: { in: variantIds } },
        include: {
          offer: { include: { master: true, tiers: true } },
          masterVariant: true,
        },
      });
      if (variants.length !== variantIds.length) throw new Error("بعض المتغيرات غير موجودة");

      const itemMap = new Map(input.items.map((i) => [i.offerVariantId, i]));
      const preparedItems: Array<{
        v: (typeof variants)[number];
        qty: number;
        unitPrice: number;
        subtotal: number;
        notes: string | null;
      }> = [];
      let subtotal = 0;

      for (const v of variants) {
        const item = itemMap.get(v.id)!;
        if (v.offer.businessId !== seller.id) throw new Error(`العرض "${v.offer.master.name}" لا ينتمي لهذا البائع`);
        if (v.offer.deletedAt) throw new Error(`العرض "${v.offer.master.name}" محذوف`);
        if (v.offer.status !== "ACTIVE" || !v.offer.isActive) throw new Error(`العرض "${v.offer.master.name}" غير نشط`);
        if (!v.offer.claimVerified) throw new Error(`العرض "${v.offer.master.name}" غير موثق`);
        if (item.quantity < v.offer.minOrderQty) {
          throw new Error(`الحد الأدنى للطلب من "${v.offer.master.name}" هو ${v.offer.minOrderQty}`);
        }
        if (v.offer.maxOrderQty && item.quantity > v.offer.maxOrderQty) {
          throw new Error(`الحد الأقصى للطلب من "${v.offer.master.name}" هو ${v.offer.maxOrderQty}`);
        }
        const available = v.stock - v.reserved - v.inTransit;
        if (available < item.quantity) {
          throw new Error(`المخزون المتاح من "${v.offer.master.name}" غير كافٍ (${available} متاح)`);
        }
        const unitPrice = resolveUnitPrice(
          Number(v.offer.wholesalePrice),
          v.offer.tiers.map((t: any) => ({
            minQty: t.minQty,
            maxQty: t.maxQty,
            unitPrice: Number(t.unitPrice),
          })),
          item.quantity
        );
        const itemSubtotal = unitPrice * item.quantity;
        subtotal += itemSubtotal;
        preparedItems.push({
          v,
          qty: item.quantity,
          unitPrice,
          subtotal: itemSubtotal,
          notes: item.notes ?? null,
        });
      }

      const total = subtotal + input.shippingCost - input.discountAmount;
      if (total < 0) throw new Error("الإجمالي السالب غير مسموح");

      let order: any = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          order = await tx.wholesaleOrder.create({
            data: {
              orderNumber: generateOrderNumber(seller.id),
              buyerBusinessId: buyer.id,
              sellerBusinessId: seller.id,
              buyerUserId,
              status: "PENDING",
              subtotal,
              shippingCost: input.shippingCost,
              discountAmount: input.discountAmount,
              total,
              notes: input.notes ?? null,
              estimatedDelivery: input.estimatedDelivery ? new Date(input.estimatedDelivery) : null,
              items: {
                create: preparedItems.map((pi) => ({
                  offerId: pi.v.offerId,
                  offerVariantId: pi.v.id,
                  masterId: pi.v.offer.masterId,
                  masterVariantId: pi.v.masterVariantId,
                  productName: pi.v.offer.master.name,
                  sku: pi.v.masterVariant.sku,
                  barcode: pi.v.masterVariant.barcode,
                  options: pi.v.masterVariant.options ?? undefined,
                  quantity: pi.qty,
                  unitPrice: pi.unitPrice,
                  subtotal: pi.subtotal,
                  notes: pi.notes,
                })),
              },
            },
          });
          break;
        } catch (e: any) {
          if (e.code === "P2002" && attempt < 4) continue;
          throw e;
        }
      }
      if (!order) throw new Error("تعذر إنشاء رقم الطلب بعد عدة محاولات");

      await tx.wholesaleOrderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: null,
          toStatus: "PENDING",
          changedByUserId: buyerUserId,
          notes: "تم إنشاء الطلب",
        },
      });

      return order;
    }, { timeout: TX_TIMEOUT });
  },

  async acceptOrder(orderId: number, actorUserId: number) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: number; status: string; sellerBusinessId: number }>>`
        SELECT "id", "status", "sellerBusinessId" FROM "WholesaleOrder" WHERE "id" = ${orderId} FOR UPDATE
      `;
      if (locked.length === 0) throw new Error("الطلب غير موجود");
      const ord = locked[0];
      if (ord.status !== "PENDING") throw new Error(`لا يمكن القبول بحالة ${ord.status}`);
      await assertActorManagesBusiness(tx, ord.sellerBusinessId, actorUserId, ["OWNER", "MANAGER", "SALES"]);

      const items = await tx.wholesaleOrderItem.findMany({ where: { orderId } });
      for (const item of items) {
        const updated = await tx.$executeRaw`
          UPDATE "WholesaleOfferVariant"
          SET "reserved" = "reserved" + ${item.quantity}
          WHERE "id" = ${item.offerVariantId}
            AND ("stock" - "reserved" - "inTransit") >= ${item.quantity}
        `;
        if (updated === 0) throw new Error(`المخزون غير كافٍ للمنتج "${item.productName}"`);
      }

      const updated = await tx.wholesaleOrder.update({
        where: { id: orderId },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      await tx.wholesaleOrderStatusHistory.create({
        data: { orderId, fromStatus: "PENDING", toStatus: "ACCEPTED", changedByUserId: actorUserId },
      });
      return updated;
    }, { timeout: TX_TIMEOUT });
  },

  async rejectOrder(orderId: number, actorUserId: number, reason?: string | null) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: number; status: string; sellerBusinessId: number }>>`
        SELECT "id", "status", "sellerBusinessId" FROM "WholesaleOrder" WHERE "id" = ${orderId} FOR UPDATE
      `;
      if (locked.length === 0) throw new Error("الطلب غير موجود");
      if (locked[0].status !== "PENDING") throw new Error(`لا يمكن الرفض بحالة ${locked[0].status}`);
      await assertActorManagesBusiness(tx, locked[0].sellerBusinessId, actorUserId, ["OWNER", "MANAGER", "SALES"]);

      const updated = await tx.wholesaleOrder.update({
        where: { id: orderId },
        data: { status: "REJECTED", rejectionReason: reason ?? null },
      });
      await tx.wholesaleOrderStatusHistory.create({
        data: { orderId, fromStatus: "PENDING", toStatus: "REJECTED", changedByUserId: actorUserId, notes: reason ?? null },
      });
      return updated;
    });
  },

  async prepareOrder(orderId: number, actorUserId: number) {
    return prisma.$transaction(async (tx) => {
      const ord = await tx.wholesaleOrder.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, sellerBusinessId: true },
      });
      if (!ord) throw new Error("الطلب غير موجود");
      if (ord.status !== "ACCEPTED") throw new Error(`لا يمكن التجهيز بحالة ${ord.status}`);
      await assertActorManagesBusiness(tx, ord.sellerBusinessId, actorUserId, ["OWNER", "MANAGER", "SALES"]);

      const updated = await tx.wholesaleOrder.update({
        where: { id: orderId },
        data: { status: "PREPARING" },
      });
      await tx.wholesaleOrderStatusHistory.create({
        data: { orderId, fromStatus: "ACCEPTED", toStatus: "PREPARING", changedByUserId: actorUserId },
      });
      return updated;
    });
  },

  async shipOrder(
    orderId: number,
    actorUserId: number,
    opts: { trackingNumber?: string | null; shippingCarrier?: string | null } = {}
  ) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: number; status: string; sellerBusinessId: number }>>`
        SELECT "id", "status", "sellerBusinessId" FROM "WholesaleOrder" WHERE "id" = ${orderId} FOR UPDATE
      `;
      if (locked.length === 0) throw new Error("الطلب غير موجود");
      if (locked[0].status !== "PREPARING") throw new Error(`لا يمكن الشحن بحالة ${locked[0].status}`);
      await assertActorManagesBusiness(tx, locked[0].sellerBusinessId, actorUserId, ["OWNER", "MANAGER", "SALES"]);

      const items = await tx.wholesaleOrderItem.findMany({ where: { orderId } });
      for (const item of items) {
        const updated = await tx.$executeRaw`
          UPDATE "WholesaleOfferVariant"
          SET "reserved" = "reserved" - ${item.quantity},
              "inTransit" = "inTransit" + ${item.quantity}
          WHERE "id" = ${item.offerVariantId}
            AND "reserved" >= ${item.quantity}
        `;
        if (updated === 0) throw new Error(`خطأ في حجز "${item.productName}"`);
      }

      const updated = await tx.wholesaleOrder.update({
        where: { id: orderId },
        data: {
          status: "SHIPPED",
          shippedAt: new Date(),
          trackingNumber: opts.trackingNumber ?? null,
          shippingCarrier: opts.shippingCarrier ?? null,
        },
      });
      await tx.wholesaleOrderStatusHistory.create({
        data: { orderId, fromStatus: "PREPARING", toStatus: "SHIPPED", changedByUserId: actorUserId },
      });
      return updated;
    }, { timeout: TX_TIMEOUT });
  },

  async deliverOrder(orderId: number, actorUserId: number) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: number; status: string; buyerBusinessId: number; sellerBusinessId: number }>
      >`
        SELECT "id", "status", "buyerBusinessId", "sellerBusinessId" FROM "WholesaleOrder" WHERE "id" = ${orderId} FOR UPDATE
      `;
      if (locked.length === 0) throw new Error("الطلب غير موجود");
      const ord = locked[0];
      if (ord.status !== "SHIPPED") throw new Error(`لا يمكن تأكيد الاستلام بحالة ${ord.status}`);
      await assertActorManagesBusiness(tx, ord.buyerBusinessId, actorUserId, ["OWNER", "MANAGER"]);

      const items = await tx.wholesaleOrderItem.findMany({ where: { orderId } });

      for (const item of items) {
        const moved = await tx.$executeRaw`
          UPDATE "WholesaleOfferVariant"
          SET "inTransit" = "inTransit" - ${item.quantity},
              "stock" = "stock" - ${item.quantity}
          WHERE "id" = ${item.offerVariantId}
            AND "inTransit" >= ${item.quantity}
            AND "stock" >= ${item.quantity}
        `;
        if (moved === 0) throw new Error(`خطأ في استلام "${item.productName}"`);

        await tx.wholesaleInventory.upsert({
          where: {
            businessId_masterVariantId: {
              businessId: ord.buyerBusinessId,
              masterVariantId: item.masterVariantId,
            },
          },
          update: {
            quantity: { increment: item.quantity },
            lastUnitCost: item.unitPrice,
            lastSourceBusinessId: ord.sellerBusinessId,
          },
          create: {
            businessId: ord.buyerBusinessId,
            masterId: item.masterId,
            masterVariantId: item.masterVariantId,
            quantity: item.quantity,
            lastUnitCost: item.unitPrice,
            lastSourceBusinessId: ord.sellerBusinessId,
          },
        });

        await recordLineage(tx, {
          masterId: item.masterId,
          masterVariantId: item.masterVariantId,
          fromBusinessId: ord.sellerBusinessId,
          toBusinessId: ord.buyerBusinessId,
          orderId,
          orderItemId: item.id,
          quantity: item.quantity,
          unitPrice: String(item.unitPrice),
          transferType: "WHOLESALE_SALE",
          notes: `تسليم طلب #${orderId}`,
        });
      }

      const updated = await tx.wholesaleOrder.update({
        where: { id: orderId },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
      await tx.wholesaleOrderStatusHistory.create({
        data: { orderId, fromStatus: "SHIPPED", toStatus: "DELIVERED", changedByUserId: actorUserId },
      });
      return updated;
    }, { timeout: TX_TIMEOUT });
  },

  async completeOrder(orderId: number, actorUserId: number) {
    return prisma.$transaction(async (tx) => {
      const ord = await tx.wholesaleOrder.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, buyerBusinessId: true },
      });
      if (!ord) throw new Error("الطلب غير موجود");
      if (ord.status !== "DELIVERED") throw new Error(`لا يمكن الإكمال بحالة ${ord.status}`);
      await assertActorManagesBusiness(tx, ord.buyerBusinessId, actorUserId, ["OWNER", "MANAGER"]);

      const updated = await tx.wholesaleOrder.update({
        where: { id: orderId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await tx.wholesaleOrderStatusHistory.create({
        data: { orderId, fromStatus: "DELIVERED", toStatus: "COMPLETED", changedByUserId: actorUserId },
      });
      return updated;
    });
  },

  async cancelOrder(orderId: number, actorUserId: number, reason?: string | null) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: number; status: string; buyerBusinessId: number }>>`
        SELECT "id", "status", "buyerBusinessId" FROM "WholesaleOrder" WHERE "id" = ${orderId} FOR UPDATE
      `;
      if (locked.length === 0) throw new Error("الطلب غير موجود");
      const ord = locked[0];
      if (!["PENDING", "ACCEPTED", "PREPARING"].includes(ord.status)) {
        throw new Error(`لا يمكن الإلغاء بحالة ${ord.status}`);
      }
      await assertActorManagesBusiness(tx, ord.buyerBusinessId, actorUserId, ["OWNER", "MANAGER", "SALES"]);

      if (ord.status === "ACCEPTED" || ord.status === "PREPARING") {
        const items = await tx.wholesaleOrderItem.findMany({ where: { orderId } });
        for (const item of items) {
          await tx.$executeRaw`
            UPDATE "WholesaleOfferVariant"
            SET "reserved" = "reserved" - ${item.quantity}
            WHERE "id" = ${item.offerVariantId}
              AND "reserved" >= ${item.quantity}
          `;
        }
      }

      const updated = await tx.wholesaleOrder.update({
        where: { id: orderId },
        data: { status: "CANCELLED", cancellationReason: reason ?? null },
      });
      await tx.wholesaleOrderStatusHistory.create({
        data: {
          orderId,
          fromStatus: ord.status as any,
          toStatus: "CANCELLED",
          changedByUserId: actorUserId,
          notes: reason ?? null,
        },
      });
      return updated;
    });
  },

  async getOrder(orderId: number) {
    return prisma.wholesaleOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            master: { select: { id: true, name: true, brand: true, images: true } },
            masterVariant: { select: { id: true, sku: true, barcode: true, options: true } },
          },
        },
        buyerBusiness: { select: { id: true, name: true, slug: true, city: true, logo: true, type: true } },
        sellerBusiness: { select: { id: true, name: true, slug: true, city: true, logo: true, type: true } },
        buyerUser: { select: { id: true, name: true, email: true } },
        statusHistory: {
          orderBy: { createdAt: "asc" },
          include: { changedByUser: { select: { id: true, name: true } } },
        },
      },
    });
  },

  async listOrders(
    businessId: number,
    side: "buyer" | "seller",
    filters: { status?: string; page?: number; pageSize?: number } = {}
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(Math.max(1, filters.pageSize ?? 30), 100);
    const where: any = side === "buyer" ? { buyerBusinessId: businessId } : { sellerBusinessId: businessId };
    if (filters.status) where.status = filters.status;

    const [total, items] = await Promise.all([
      prisma.wholesaleOrder.count({ where }),
      prisma.wholesaleOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          buyerBusiness: { select: { id: true, name: true, city: true, logo: true } },
          sellerBusiness: { select: { id: true, name: true, city: true, logo: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },
};