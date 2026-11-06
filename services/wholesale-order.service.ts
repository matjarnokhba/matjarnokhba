import { prisma } from "@/lib/prisma";
import { WHOLESALE_CONFIG } from "@/lib/wholesale/config";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/wholesale/errors";
import { logWholesaleAction } from "@/lib/wholesale/audit";
import {
  assertBusinessUnitCapability,
  assertBusinessUnitPermission,
  getBusinessUnitContext,
} from "@/lib/wholesale/context";
import {
  generateWholesaleOrderGroupNumber,
  generateWholesaleOrderNumber,
} from "@/lib/wholesale/order-number";
import { WholesaleInventoryService } from "./wholesale-inventory.service";
import { NotificationService } from "./notification.service";

type CreateItemInput = {
  offerId: number;
  masterVariantId: number;
  quantity: number;
};

type CreateInput = {
  buyerBusinessUnitId: number;
  items: CreateItemInput[];
  notes?: string;
};

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

async function ensureSetup(tx: any, businessUnitId: number) {
  let loc = await tx.inventoryLocation.findFirst({
    where: { businessUnitId, type: "WAREHOUSE", isActive: true },
    select: { id: true },
  });
  if (!loc) {
    loc = await tx.inventoryLocation.create({
      data: {
        businessUnitId,
        name: "المستودع الرئيسي",
        type: "WAREHOUSE",
        isActive: true,
      },
      select: { id: true },
    });
  }
  let acc = await tx.inventoryAccount.findFirst({
    where: { locationId: loc.id, type: "WHOLESALE", isActive: true },
    select: { id: true },
  });
  if (!acc) {
    acc = await tx.inventoryAccount.create({
      data: {
        locationId: loc.id,
        businessUnitId,
        type: "WHOLESALE",
        isActive: true,
      },
      select: { id: true },
    });
  }
  return { locationId: loc.id, wholesaleAccountId: acc.id };
}

async function resolveOrderAccess(userId: number, orderId: number) {
  const order = await prisma.wholesaleOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new NotFoundError("WholesaleOrder", orderId);

  let isBuyer = false;
  let isSeller = false;
  try {
    await getBusinessUnitContext(userId, order.buyerBusinessUnitId);
    isBuyer = true;
  } catch {}
  try {
    await getBusinessUnitContext(userId, order.sellerBusinessUnitId);
    isSeller = true;
  } catch {}
  if (!isBuyer && !isSeller) {
    throw new ForbiddenError("لا تملك صلاحية الوصول لهذا الطلب");
  }
  return { order, isBuyer, isSeller };
}

async function ensureBuyerMerchantProduct(
  tx: any,
  userId: number,
  order: any,
  masterId: number,
  retailPrice: number
) {
  const existing = await tx.merchantProduct.findFirst({
    where: {
      businessUnitId: order.buyerBusinessUnitId,
      masterId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const master = await tx.masterProduct.findUnique({
    where: { id: masterId },
    select: {
      id: true,
      name: true,
      description: true,
      images: true,
    },
  });
  if (!master) throw new NotFoundError("MasterProduct", masterId);

  const mp = await tx.merchantProduct.create({
    data: {
      businessUnitId: order.buyerBusinessUnitId,
      masterId,
      displayName: master.name,
      displayImages: master.images as string[],
      displayDescription: master.description,
      retailPrice,
      status: "DRAFT",
      isFromWholesale: true,
      sourceWholesaleOrderId: order.id,
    },
  });

  await logWholesaleAction(tx, {
    userId,
    businessUnitId: order.buyerBusinessUnitId,
    action: "merchant_product.auto_created_from_order",
    entityType: "MerchantProduct",
    entityId: mp.id,
    after: { masterId, sourceWholesaleOrderId: order.id },
  });

  return mp.id;
}

async function ensureBuyerMerchantVariant(
  tx: any,
  merchantProductId: number,
  masterVariantId: number,
  basePrice: number
) {
  const existing = await tx.merchantVariant.findFirst({
    where: { merchantProductId, masterVariantId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const mv = await tx.masterVariant.findUnique({
    where: { id: masterVariantId },
    select: { id: true, sku: true, barcode: true, attributes: true },
  });
  if (!mv) throw new NotFoundError("MasterVariant", masterVariantId);

  const anyExisting = await tx.merchantVariant.findFirst({
    where: { merchantProductId },
    select: { id: true },
  });

  const created = await tx.merchantVariant.create({
    data: {
      merchantProductId,
      masterVariantId,
      displayAttributes: (mv.attributes as any) ?? [],
      baseUnitPrice: basePrice,
      sku: mv.sku || `M-${merchantProductId}-${masterVariantId}`,
      barcode: mv.barcode ?? null,
      isDefault: !anyExisting,
      isActive: true,
    },
  });

  if (!anyExisting) {
    const su = await tx.sellingUnit.findFirst({
      where: { merchantProductId, name: "PIECE", isActive: true },
      select: { id: true },
    });
    if (!su) {
      await tx.sellingUnit.create({
        data: {
          merchantProductId,
          name: "PIECE",
          conversionFactor: 1,
          price: basePrice,
          isActive: true,
          validFrom: new Date(),
        },
      });
    }
  }

  return created.id;
}

// ═══════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════

export const WholesaleOrderService = {
  async create(
    userId: number,
    input: CreateInput
  ): Promise<{ groupId: number; orderIds: number[]; orderNumbers: string[] }> {
    const buyerCtx = await getBusinessUnitContext(
      userId,
      input.buyerBusinessUnitId
    );
    assertBusinessUnitCapability(buyerCtx, "WHOLESALE_BUY");
    assertBusinessUnitPermission(buyerCtx, "orders.write");

    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new ValidationError("السلة فارغة");
    }
    if (input.items.length > WHOLESALE_CONFIG.MAX_ITEMS_PER_ORDER) {
      throw new ValidationError(
        `الحد الأقصى ${WHOLESALE_CONFIG.MAX_ITEMS_PER_ORDER} سطر`
      );
    }

    const merged = new Map<string, CreateItemInput>();
    for (const item of input.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new ValidationError("الكمية يجب أن تكون عددًا صحيحًا موجبًا");
      }
      const key = `${item.offerId}:${item.masterVariantId}`;
      if (merged.has(key)) {
        merged.get(key)!.quantity += item.quantity;
      } else {
        merged.set(key, { ...item });
      }
    }
    const items = Array.from(merged.values());

    const offerIds = [...new Set(items.map((i) => i.offerId))];
    if (offerIds.length > WHOLESALE_CONFIG.MAX_ORDERS_PER_GROUP) {
      throw new ValidationError(
        `الحد الأقصى ${WHOLESALE_CONFIG.MAX_ORDERS_PER_GROUP} مورد`
      );
    }

    const offers = await prisma.wholesaleOffer.findMany({
      where: { id: { in: offerIds }, deletedAt: null },
      include: {
        master: { select: { id: true, name: true, status: true } },
        businessUnit: { select: { id: true, status: true } },
        variants: {
          include: {
            masterVariant: { select: { id: true, attributes: true } },
            tiers: { orderBy: { minQty: "asc" } },
          },
        },
      },
    });
    const offerMap = new Map(offers.map((o) => [o.id, o]));

    for (const item of items) {
      const offer = offerMap.get(item.offerId);
      if (!offer) throw new NotFoundError("WholesaleOffer", item.offerId);
      if (offer.status !== "ACTIVE") throw new ValidationError(`عرض ${item.offerId} غير نشط`);
      if (offer.businessUnit.status !== "ACTIVE") throw new ValidationError("بائع العرض غير نشط");
      if (offer.businessUnit.id === input.buyerBusinessUnitId) throw new ValidationError("لا يمكنك الشراء من نفسك");
      if (offer.master.status !== "ACTIVE") throw new ValidationError("منتج العرض غير نشط");
      if (item.quantity < offer.minOrderQty) {
        throw new ValidationError(`الحد الأدنى ${offer.minOrderQty} للعرض ${offer.master.name}`);
      }
      if (offer.maxOrderQty && item.quantity > offer.maxOrderQty) {
        throw new ValidationError(`الحد الأقصى ${offer.maxOrderQty} للعرض ${offer.master.name}`);
      }
      const ov = offer.variants.find((v) => v.masterVariantId === item.masterVariantId);
      if (!ov) throw new ValidationError(`variant ${item.masterVariantId} غير موجود في العرض`);
    }

    const bySeller = new Map<number, CreateItemInput[]>();
    for (const item of items) {
      const offer = offerMap.get(item.offerId)!;
      if (!bySeller.has(offer.businessUnitId)) bySeller.set(offer.businessUnitId, []);
      bySeller.get(offer.businessUnitId)!.push(item);
    }

    return prisma.$transaction(
      async (tx) => {
        const groupNumber = await generateWholesaleOrderGroupNumber(tx);
        let groupTotal = 0;
        const orderIds: number[] = [];
        const orderNumbers: string[] = [];

        const group = await tx.wholesaleOrderGroup.create({
          data: {
            buyerBusinessUnitId: input.buyerBusinessUnitId,
            groupNumber,
            totalAmount: 0,
            status: "PENDING",
          },
        });

        for (const [sellerBUId, sellerItems] of bySeller) {
          const setup = await ensureSetup(tx, sellerBUId);
          const orderNumber = await generateWholesaleOrderNumber(tx);

          const order = await tx.wholesaleOrder.create({
            data: {
              groupId: group.id,
              orderNumber,
              sellerBusinessUnitId: sellerBUId,
              buyerBusinessUnitId: input.buyerBusinessUnitId,
              subtotal: 0,
              discount: 0,
              shippingCost: 0,
              total: 0,
              status: "PENDING",
              paymentStatus: "UNPAID",
              fulfillmentStatus: "PENDING",
              notes: input.notes ?? null,
            },
          });

          let sellerSubtotal = 0;

          for (const item of sellerItems) {
            const offer = offerMap.get(item.offerId)!;
            const ov = offer.variants.find((v) => v.masterVariantId === item.masterVariantId)!;

            const tier = ov.tiers.find(
              (t) =>
                item.quantity >= t.minQty &&
                (t.maxQty === null || item.quantity <= t.maxQty)
            );
            if (!tier) {
              throw new ValidationError(`لا توجد شريحة سعر للكمية ${item.quantity}`);
            }
            const unitPrice = Number(tier.unitPrice);
            const subtotal = unitPrice * item.quantity;
            sellerSubtotal += subtotal;

            const sellerMp = await tx.merchantProduct.findFirst({
              where: { businessUnitId: sellerBUId, masterId: offer.masterId, deletedAt: null },
              select: { id: true },
            });
            if (!sellerMp) {
              throw new ValidationError(
                `البائع لا يملك MerchantProduct لـ "${offer.master.name}". ` +
                `على البائع إنشاء منتج في متجره من نفس المنتج الأصلي.`
              );
            }
            const sellerMv = await tx.merchantVariant.findFirst({
              where: { merchantProductId: sellerMp.id, masterVariantId: item.masterVariantId },
              select: { id: true },
            });
            if (!sellerMv) {
              throw new ValidationError(
                `البائع لا يملك variant لـ "${offer.master.name}".`
              );
            }

            await tx.wholesaleOrderItem.create({
              data: {
                orderId: order.id,
                offerId: offer.id,
                masterVariantId: item.masterVariantId,
                merchantVariantId: sellerMv.id,
                productName: offer.master.name,
                variantAttributes: (ov.masterVariant.attributes as any) ?? [],
                quantity: item.quantity,
                sellingUnit: "PIECE",
                conversionFactor: 1,
                unitPrice,
                subtotal,
              },
            });

            await WholesaleInventoryService.reserve(tx, {
              merchantVariantId: sellerMv.id,
              inventoryAccountId: setup.wholesaleAccountId,
              quantity: item.quantity,
              referenceType: "WHOLESALE_ORDER",
              referenceId: order.id,
              stage: "TEMP",
              userId,
            });
          }

          await tx.wholesaleOrder.update({
            where: { id: order.id },
            data: { subtotal: sellerSubtotal, total: sellerSubtotal },
          });

          groupTotal += sellerSubtotal;
          orderIds.push(order.id);
          orderNumbers.push(orderNumber);

          await logWholesaleAction(tx, {
            userId,
            businessUnitId: input.buyerBusinessUnitId,
            action: "wholesale_order.created",
            entityType: "WholesaleOrder",
            entityId: order.id,
            after: { orderNumber, total: sellerSubtotal },
          });
          await NotificationService.createForBU({
            businessUnitId: sellerBUId,
            type: "WHOLESALE_ORDER_RECEIVED",
            title: "طلب جملة جديد",
            message: `وصل طلب جديد ${orderNumber} بقيمة ${sellerSubtotal.toFixed(2)} د.م`,
            link: `/wholesale/orders/${order.id}?direction=seller`,
            severity: "INFO",
          }, tx);
        }

        await tx.wholesaleOrderGroup.update({
          where: { id: group.id },
          data: { totalAmount: groupTotal },
        });

        return { groupId: group.id, orderIds, orderNumbers };
      },
      { timeout: 30000 }
    );
  },

  async confirm(userId: number, orderId: number): Promise<void> {
    const { order, isSeller } = await resolveOrderAccess(userId, orderId);
    if (order.status !== "PENDING") {
      throw new ValidationError(`لا يمكن تأكيد طلب بحالة ${order.status}`);
    }

    await prisma.$transaction(async (tx) => {
      const reservations = await tx.stockReservation.findMany({
        where: {
          referenceType: "WHOLESALE_ORDER",
          referenceId: orderId,
          status: "ACTIVE",
        },
      });
      for (const r of reservations) {
        await WholesaleInventoryService.confirmReservation(tx, r.id);
      }
      await tx.wholesaleOrder.update({
        where: { id: orderId },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      await NotificationService.createForBU({
        businessUnitId: isSeller ? order.buyerBusinessUnitId : order.sellerBusinessUnitId,
        type: "WHOLESALE_ORDER_CONFIRMED",
        title: "تم تأكيد الطلب",
        message: `تم تأكيد طلب ${order.orderNumber}`,
        link: `/wholesale/orders/${orderId}`,
        severity: "SUCCESS",
      }, tx);
      await logWholesaleAction(tx, {
        userId,
        businessUnitId: isSeller
          ? order.sellerBusinessUnitId
          : order.buyerBusinessUnitId,
        action: "wholesale_order.confirmed",
        entityType: "WholesaleOrder",
        entityId: orderId,
      });
    });
  },

  async cancel(userId: number, orderId: number, reason: string): Promise<void> {
    if (!reason || reason.trim().length < 3) {
      throw new ValidationError("سبب الإلغاء مطلوب");
    }
    const { order, isSeller } = await resolveOrderAccess(userId, orderId);
    if (!["PENDING", "CONFIRMED"].includes(order.status)) {
      throw new ValidationError(`لا يمكن إلغاء طلب بحالة ${order.status}`);
    }

    await prisma.$transaction(async (tx) => {
      const reservations = await tx.stockReservation.findMany({
        where: {
          referenceType: "WHOLESALE_ORDER",
          referenceId: orderId,
          status: "ACTIVE",
        },
      });
      for (const r of reservations) {
        await WholesaleInventoryService.releaseReservation(tx, r.id, "order_cancelled");
      }
      await tx.wholesaleOrder.update({
        where: { id: orderId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: reason.trim(),
        },
      });
      await NotificationService.createForBU({
        businessUnitId: isSeller ? order.buyerBusinessUnitId : order.sellerBusinessUnitId,
        type: "WHOLESALE_ORDER_CANCELLED",
        title: "تم إلغاء الطلب",
        message: `تم إلغاء طلب ${order.orderNumber}. السبب: ${reason.trim()}`,
        link: `/wholesale/orders/${orderId}`,
        severity: "WARNING",
      }, tx);
      await logWholesaleAction(tx, {
        userId,
        businessUnitId: isSeller
          ? order.sellerBusinessUnitId
          : order.buyerBusinessUnitId,
        action: "wholesale_order.cancelled",
        entityType: "WholesaleOrder",
        entityId: orderId,
        metadata: { reason: reason.trim() },
      });
    });
  },

  async process(userId: number, orderId: number): Promise<void> {
    const { order, isSeller } = await resolveOrderAccess(userId, orderId);
    if (!isSeller) throw new ForbiddenError("هذه العملية للبائع فقط");
    if (order.status !== "CONFIRMED") {
      throw new ValidationError(`لا يمكن بدء التجهيز من حالة ${order.status}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.wholesaleOrder.update({
        where: { id: orderId },
        data: { status: "PROCESSING", fulfillmentStatus: "PREPARING" },
      });
      await logWholesaleAction(tx, {
        userId,
        businessUnitId: order.sellerBusinessUnitId,
        action: "wholesale_order.processing_started",
        entityType: "WholesaleOrder",
        entityId: orderId,
      });
    });
  },

  async markReady(userId: number, orderId: number): Promise<void> {
    const { order, isSeller } = await resolveOrderAccess(userId, orderId);
    if (!isSeller) throw new ForbiddenError("هذه العملية للبائع فقط");
    if (order.status !== "PROCESSING") {
      throw new ValidationError(`لا يمكن تحديد الجاهزية من حالة ${order.status}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.wholesaleOrder.update({
        where: { id: orderId },
        data: { status: "READY", fulfillmentStatus: "READY" },
      });
      await logWholesaleAction(tx, {
        userId,
        businessUnitId: order.sellerBusinessUnitId,
        action: "wholesale_order.marked_ready",
        entityType: "WholesaleOrder",
        entityId: orderId,
      });
    });
  },

  async ship(userId: number, orderId: number): Promise<void> {
    const { order, isSeller } = await resolveOrderAccess(userId, orderId);
    if (!isSeller) throw new ForbiddenError("هذه العملية للبائع فقط");
    if (order.status !== "READY") {
      throw new ValidationError(`لا يمكن الشحن من حالة ${order.status}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.wholesaleOrder.update({
        where: { id: orderId },
        data: {
          status: "SHIPPED",
          fulfillmentStatus: "SHIPPED",
          shippedAt: new Date(),
        },
      });
      await NotificationService.createForBU({
        businessUnitId: order.buyerBusinessUnitId,
        type: "WHOLESALE_ORDER_SHIPPED",
        title: "طلبك في الطريق",
        message: `تم شحن طلب ${order.orderNumber}`,
        link: `/wholesale/orders/${orderId}`,
        severity: "INFO",
      }, tx);
      await logWholesaleAction(tx, {
        userId,
        businessUnitId: order.sellerBusinessUnitId,
        action: "wholesale_order.shipped",
        entityType: "WholesaleOrder",
        entityId: orderId,
      });
    });
  },

  async receive(userId: number, orderId: number): Promise<void> {
    const { order, isBuyer } = await resolveOrderAccess(userId, orderId);
    if (!isBuyer) throw new ForbiddenError("هذه العملية للمشتري فقط");
    if (order.status !== "SHIPPED") {
      throw new ValidationError(`لا يمكن الاستلام من حالة ${order.status}`);
    }

    const buyerSetup = await prisma.$transaction(async (tx) =>
      ensureSetup(tx, order.buyerBusinessUnitId)
    );

    await prisma.$transaction(
      async (tx) => {
        for (const item of order.items) {
          if (!item.merchantVariantId) {
            throw new ValidationError(
              `بند ${item.id} بدون merchantVariantId`
            );
          }

          const reservation = await tx.stockReservation.findFirst({
            where: {
              merchantVariantId: item.merchantVariantId,
              referenceType: "WHOLESALE_ORDER",
              referenceId: order.id,
              status: "ACTIVE",
            },
            select: { id: true, quantity: true },
          });

          if (reservation) {
            await WholesaleInventoryService.commitReservation(
              tx,
              reservation.id,
              "WHOLESALE_ORDER",
              order.id,
              order.sellerBusinessUnitId,
              userId
            );
          } else {
            await WholesaleInventoryService.transferOut(tx, {
              merchantVariantId: item.merchantVariantId,
              inventoryAccountId: (await ensureSetup(tx, order.sellerBusinessUnitId))
                .wholesaleAccountId,
              businessUnitId: order.sellerBusinessUnitId,
              quantity: item.quantity,
              referenceType: "WHOLESALE_ORDER",
              referenceId: order.id,
              type: "SALE_OUT",
              userId,
            });
          }

          const buyerMpId = await ensureBuyerMerchantProduct(
            tx,
            userId,
            order,
            (await tx.wholesaleOrderItem.findUnique({
              where: { id: item.id },
              select: { offer: { select: { masterId: true } } },
            }))!.offer!.masterId,
            Number(item.unitPrice)
          );

          const buyerMvId = await ensureBuyerMerchantVariant(
            tx,
            buyerMpId,
            item.masterVariantId,
            Number(item.unitPrice)
          );

          await WholesaleInventoryService.transferIn(tx, {
            merchantVariantId: buyerMvId,
            inventoryAccountId: buyerSetup.wholesaleAccountId,
            businessUnitId: order.buyerBusinessUnitId,
            quantity: item.quantity,
            unitCost: Number(item.unitPrice),
            sourceType: "PURCHASE",
            sourceReferenceId: item.id,
            referenceType: "WHOLESALE_ORDER",
            referenceId: order.id,
            notes: `استلام طلب ${order.orderNumber}`,
            userId,
          });
        }

        await tx.wholesaleOrder.update({
          where: { id: order.id },
          data: {
            status: "DELIVERED",
            fulfillmentStatus: "DELIVERED",
            deliveredAt: new Date(),
          },
        });
        await NotificationService.createForBU({
          businessUnitId: order.sellerBusinessUnitId,
          type: "WHOLESALE_ORDER_DELIVERED",
          title: "تم استلام الطلب",
          message: `استلم المشتري طلب ${order.orderNumber}`,
          link: `/wholesale/orders/${order.id}?direction=seller`,
          severity: "SUCCESS",
        }, tx);

        if (order.groupId) {
          const remaining = await tx.wholesaleOrder.count({
            where: {
              groupId: order.groupId,
              status: { notIn: ["DELIVERED", "CANCELLED", "RETURNED"] },
            },
          });
          if (remaining === 0) {
            await tx.wholesaleOrderGroup.update({
              where: { id: order.groupId },
              data: { status: "COMPLETED" },
            });
          }
        }

        await logWholesaleAction(tx, {
          userId,
          businessUnitId: order.buyerBusinessUnitId,
          action: "wholesale_order.received",
          entityType: "WholesaleOrder",
          entityId: order.id,
        });
      },
      { timeout: 30000 }
    );
  },

  async get(userId: number, orderId: number) {
    const { order } = await resolveOrderAccess(userId, orderId);
    const full = await prisma.wholesaleOrder.findUnique({
      where: { id: orderId },
      include: {
        items: { orderBy: { id: "asc" } },
        group: { select: { id: true, groupNumber: true, status: true } },
      },
    });
    return full;
  },

  async getGroup(userId: number, groupId: number) {
    const group = await prisma.wholesaleOrderGroup.findUnique({
      where: { id: groupId },
      include: {
        orders: {
          include: {
            items: { select: { id: true, quantity: true, subtotal: true } },
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!group) throw new NotFoundError("WholesaleOrderGroup", groupId);

    let authorized = false;
    try {
      await getBusinessUnitContext(userId, group.buyerBusinessUnitId);
      authorized = true;
    } catch {}
    if (!authorized) {
      for (const o of group.orders) {
        try {
          await getBusinessUnitContext(userId, o.sellerBusinessUnitId);
          authorized = true;
          break;
        } catch {}
      }
    }
    if (!authorized) throw new ForbiddenError("لا تملك صلاحية");
    return group;
  },

  async listByBuyer(
    userId: number,
    buyerBusinessUnitId: number,
    filters: {
      status?: "PENDING" | "CONFIRMED" | "PROCESSING" | "READY" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED" | "DISPUTED";
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    await getBusinessUnitContext(userId, buyerBusinessUnitId);
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 30));
    const where: any = { buyerBusinessUnitId };
    if (filters.status) where.status = filters.status;

    const [total, items] = await Promise.all([
      prisma.wholesaleOrder.count({ where }),
      prisma.wholesaleOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          group: { select: { id: true, groupNumber: true, status: true } },
          items: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              unitPrice: true,
              subtotal: true,
            },
          },
        },
      }),
    ]);

    return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  },

  async listBySeller(
    userId: number,
    sellerBusinessUnitId: number,
    filters: {
      status?: "PENDING" | "CONFIRMED" | "PROCESSING" | "READY" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED" | "DISPUTED";
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    await getBusinessUnitContext(userId, sellerBusinessUnitId);
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 30));
    const where: any = { sellerBusinessUnitId };
    if (filters.status) where.status = filters.status;

    const [total, items] = await Promise.all([
      prisma.wholesaleOrder.count({ where }),
      prisma.wholesaleOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          items: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              unitPrice: true,
              subtotal: true,
            },
          },
        },
      }),
    ]);

    return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  },
};