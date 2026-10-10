import { prisma } from "@/lib/prisma";
import { InventoryService } from "@/services/inventory.service";
import { LoyaltyService } from "@/services/loyalty.service";

// ═══════════════════════════════════════════
// الثوابت
// ═══════════════════════════════════════════
const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 أيام

// ═══════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════
type CreateReturnInput = {
  orderId: number;
  reason: string;
  items: { orderItemId: number; quantity: number }[];
};

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

// تحويل إلى سنتات (عدد صحيح) — لتفادي Float errors
function toCents(amount: number): number {
  return Math.round(amount * 100);
}

// من سنتات إلى MAD
function fromCents(cents: number): number {
  return cents / 100;
}

// حساب Refund لتاريخ معين (Decimal)
function calcRawRefund(
  unitPrice: number,
  quantity: number,
  discount: number,
  subtotal: number
): number {
  if (subtotal === 0) return 0;
  const raw = unitPrice * quantity * (1 - discount / subtotal);
  return Math.max(0, raw);
}

// ═══════════════════════════════════════════
// ReturnService
// ═══════════════════════════════════════════
export const ReturnService = {
  // ═══════ إنشاء طلب إرجاع (العميل) ═══════
  async create(userId: number, data: CreateReturnInput) {
    if (!data.items || data.items.length === 0) {
      throw new Error("يجب اختيار منتج واحد على الأقل");
    }
    if (!data.reason?.trim() || data.reason.trim().length < 5) {
      throw new Error("سبب الإرجاع مطلوب (5 أحرف على الأقل)");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Lock Order
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${data.orderId} FOR UPDATE`;

      const order = await tx.order.findUnique({
        where: { id: data.orderId },
      });

      if (!order) throw new Error("الطلب غير موجود");
      if (order.userId !== userId) throw new Error("غير مصرح");
      if (order.status !== "DELIVERED") {
        throw new Error("يمكن الإرجاع فقط للطلبات المُسلَّمة");
      }

      // 2. نافذة الإرجاع
      if (!order.deliveredAt) throw new Error("تاريخ التسليم مفقود");
      const elapsed = Date.now() - order.deliveredAt.getTime();
      if (elapsed > RETURN_WINDOW_MS) {
        throw new Error("انتهت مدة الإرجاع (7 أيام من التسليم)");
      }

      // 3. جلب OrderItems
      const orderItemIds = data.items.map((i) => i.orderItemId);
      const orderItems = await tx.orderItem.findMany({
        where: {
          id: { in: orderItemIds },
          orderId: order.id,
        },
      });

      if (orderItems.length !== orderItemIds.length) {
        throw new Error("بعض المنتجات لا تنتمي لهذا الطلب");
      }

      // 4. تحقق من الكميات (لا تتجاوز الأصل)
      for (const reqItem of data.items) {
        if (reqItem.quantity <= 0) {
          throw new Error("الكمية يجب أن تكون موجبة");
        }

        const orderItem = orderItems.find((oi) => oi.id === reqItem.orderItemId);
        if (!orderItem) continue;

        // الكميات المطلوبة سابقاً (PENDING + APPROVED + COMPLETED)
        const priorReturnItems = await tx.returnItem.findMany({
          where: {
            orderItemId: reqItem.orderItemId,
            returnRequest: {
              status: { in: ["PENDING", "APPROVED", "COMPLETED"] },
            },
          },
          select: { quantity: true },
        });

        const priorQty = priorReturnItems.reduce((s, ri) => s + ri.quantity, 0);
        if (priorQty + reqItem.quantity > orderItem.quantity) {
          throw new Error(
            `الكمية المطلوبة تتجاوز المتاح للمنتج "${orderItem.productName}"`
          );
        }
      }

      // 5. إنشاء ReturnRequest
      const returnRequest = await tx.returnRequest.create({
        data: {
          orderId: order.id,
          userId,
          status: "PENDING",
          reason: data.reason.trim(),
        },
      });

      // 6. إنشاء ReturnItems
      for (const item of data.items) {
        await tx.returnItem.create({
          data: {
            returnId: returnRequest.id,
            orderItemId: item.orderItemId,
            quantity: item.quantity,
            refundAmount: 0,
          },
        });
      }

      // 7. إشعار العميل
      await tx.notification.create({
        data: {
          userId,
          type: "RETURN_REQUESTED",
          title: "تم استلام طلب الإرجاع",
          message: `طلب الإرجاع للطلب ${order.orderNumber} قيد المراجعة.`,
          link: `/orders/${order.id}`,
          category: "ORDER",
          severity: "INFO",
        },
      });

      // 8. إشعار للأدمن
      const admins = await tx.user.findMany({
        where: {
          role: { in: ["ADMIN", "SUPER_ADMIN"] },
          deletedAt: null,
        },
        select: { id: true },
      });

      const totalItems = data.items.reduce((s, i) => s + i.quantity, 0);

      for (const admin of admins) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            type: "RETURN_REQUESTED",
            title: "↩️ طلب إرجاع جديد",
            message: `إرجاع للطلب ${order.orderNumber} — ${totalItems} منتج. السبب: "${data.reason.slice(0, 60)}${data.reason.length > 60 ? "..." : ""}"`,
            link: `/admin/returns/${returnRequest.id}`,
            category: "ORDER",
            severity: "WARNING",
            metadata: {
              returnId: returnRequest.id,
              orderId: order.id,
              orderNumber: order.orderNumber,
              totalItems,
              reason: data.reason,
              items: data.items,
            },
          },
        });
      }

      return returnRequest;
    }, { timeout: 30000 });
  },

  // ═══════ الموافقة على الإرجاع (Admin) ═══════
  async approve(returnId: number, adminId: number) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ReturnRequest" WHERE id = ${returnId} FOR UPDATE`;

      const ret = await tx.returnRequest.findUnique({
        where: { id: returnId },
        include: { order: true, items: true },
      });

      if (!ret) throw new Error("طلب الإرجاع غير موجود");
      if (ret.status !== "PENDING") {
        throw new Error("لا يمكن الموافقة إلا على طلبات PENDING");
      }

      for (const item of ret.items) {
        const orderItem = await tx.orderItem.findUnique({
          where: { id: item.orderItemId },
        });
        if (!orderItem) throw new Error("منتج مفقود");

        const approvedItems = await tx.returnItem.findMany({
          where: {
            orderItemId: item.orderItemId,
            returnRequest: {
              status: { in: ["APPROVED", "COMPLETED"] },
              id: { not: returnId },
            },
          },
          select: { quantity: true },
        });

        const approvedQty = approvedItems.reduce((s, ri) => s + ri.quantity, 0);
        if (approvedQty + item.quantity > orderItem.quantity) {
          throw new Error("الكمية المقبولة تتجاوز الأصل");
        }
      }

      const updated = await tx.returnRequest.updateMany({
        where: { id: returnId, status: "PENDING" },
        data: {
          status: "APPROVED",
          processedAt: new Date(),
          processedById: adminId,
        },
      });

      if (updated.count === 0) {
        throw new Error("تم تغيير حالة الطلب من عملية أخرى");
      }

      await tx.notification.create({
        data: {
          userId: ret.userId,
          type: "RETURN_APPROVED",
          title: "تمت الموافقة على الإرجاع",
          message: `طلب الإرجاع للطلب ${ret.order.orderNumber} تمت الموافقة عليه.`,
          link: `/orders/${ret.orderId}`,
        },
      });

      return { success: true };
    }, { timeout: 30000 });
  },

  // ═══════ رفض الإرجاع (Admin) ═══════
  async reject(returnId: number, adminId: number, adminNote: string) {
    return prisma.$transaction(async (tx) => {
      const ret = await tx.returnRequest.findUnique({
        where: { id: returnId },
        include: { order: true },
      });

      if (!ret) throw new Error("طلب الإرجاع غير موجود");
      if (ret.status !== "PENDING") {
        throw new Error("لا يمكن الرفض إلا للطلبات PENDING");
      }

      await tx.returnRequest.update({
        where: { id: returnId },
        data: {
          status: "REJECTED",
          processedAt: new Date(),
          processedById: adminId,
          adminNote: adminNote?.trim() || null,
        },
      });

      await tx.notification.create({
        data: {
          userId: ret.userId,
          type: "RETURN_REJECTED",
          title: "تم رفض طلب الإرجاع",
          message: `طلب الإرجاع للطلب ${ret.order.orderNumber} تم رفضه.`,
          link: `/orders/${ret.orderId}`,
        },
      });

      return { success: true };
    });
  },

  // ═══════ إكمال الإرجاع (Admin) — الجزء الأهم ═══════
  async complete(returnId: number, adminId: number) {
    return prisma.$transaction(async (tx) => {
      // 1. Lock ReturnRequest (FOR UPDATE)
      await tx.$queryRaw`SELECT id FROM "ReturnRequest" WHERE id = ${returnId} FOR UPDATE`;

      const ret = await tx.returnRequest.findUnique({
        where: { id: returnId },
        include: {
          order: true,
          items: {
            include: { orderItem: true },
          },
        },
      });

      if (!ret) throw new Error("طلب الإرجاع غير موجود");
      if (ret.status !== "APPROVED") {
        throw new Error("لا يمكن الإكمال إلا للطلبات APPROVED");
      }

      // 2. تحقق أن Order = DELIVERED
      if (ret.order.status !== "DELIVERED") {
        throw new Error("لا يمكن إكمال الإرجاع قبل التسليم");
      }

      const subtotal = Number(ret.order.subtotal);
      const discount = Number(ret.order.discount);

      // 3. Update ReturnRequest = COMPLETED (ذرّي)
      const marked = await tx.returnRequest.updateMany({
        where: { id: returnId, status: "APPROVED" },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
          processedById: adminId,
        },
      });

      if (marked.count === 0) {
        throw new Error("تم تغيير حالة الطلب من عملية أخرى");
      }

      // 4. إرجاع المخزون + حساب Refund لكل item
      for (const item of ret.items) {
        if (item.orderItem.variantId) {
          await InventoryService.returnStock(
            tx,
            item.orderItem.variantId,
            item.quantity,
            returnId,
            "إرجاع منتج",
            "RETURN"
          );
        }

        const raw = calcRawRefund(
          Number(item.orderItem.unitPrice),
          item.quantity,
          discount,
          subtotal
        );
        const rounded = fromCents(toCents(raw));

        await tx.returnItem.update({
          where: { id: item.id },
          data: { refundAmount: rounded },
        });
      }

      // 5. هل الإرجاع الكامل؟
      const isFull = await isFullReturn(tx, ret.orderId);

      // 6. Reconciliation عند الإرجاع الكامل
      if (isFull) {
        await reconcileRefunds(tx, ret.orderId);
      }

      // 7. اجمع refunds هذا الـreturn
      const thisReturnItems = await tx.returnItem.findMany({
        where: { returnId },
        select: { refundAmount: true },
      });
      const thisReturnSum = thisReturnItems.reduce(
        (s, i) => s + Number(i.refundAmount),
        0
      );

      // 8. أضف shipping refund إذا full
      let addShipping = 0;
      if (isFull && !ret.order.shippingRefunded) {
        addShipping = Number(ret.order.shippingCost);
      }

      const newRefundedAmount =
        Number(ret.order.refundedAmount) + thisReturnSum + addShipping;

      // 9. حماية: لا يتجاوز الإجمالي
      if (newRefundedAmount > Number(ret.order.total)) {
        throw new Error(
          `مجموع الاسترداد (${newRefundedAmount}) يتجاوز إجمالي الطلب (${Number(ret.order.total)})`
        );
      }

      // 10. PaymentStatus الجديد
      let newPaymentStatus = ret.order.paymentStatus;
      if (newRefundedAmount >= Number(ret.order.total)) {
        newPaymentStatus = "REFUNDED";
      } else if (newRefundedAmount > 0) {
        newPaymentStatus = "PARTIALLY_REFUNDED";
      }

      // 11. Update Order
      await tx.order.update({
        where: { id: ret.orderId },
        data: {
          refundedAmount: newRefundedAmount,
          shippingRefunded: ret.order.shippingRefunded || isFull,
          paymentStatus: newPaymentStatus,
        },
      });

      // 12. إذا full → Order = RETURNED
      if (isFull) {
        await tx.order.update({
          where: { id: ret.orderId },
          data: { status: "RETURNED" },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: ret.orderId,
            fromStatus: "DELIVERED",
            toStatus: "RETURNED",
            changedById: adminId,
            note: "اكتمال الإرجاع الكامل",
          },
        });
      }

      // ═══ 13. سحب نقاط الولاء المقابلة للمبلغ المسترد ═══
      try {
        const totalRefundThisTime = thisReturnSum + addShipping;

        const revokeResult = await LoyaltyService.revokeForReturn(tx, {
          userId: ret.userId,
          orderId: ret.orderId,
          refundedAmount: totalRefundThisTime,
        });

        if (revokeResult.pointsRevoked > 0) {
          await tx.order.update({
            where: { id: ret.orderId },
            data: {
              loyaltyPointsRevoked: {
                increment: revokeResult.pointsRevoked,
              },
            },
          });

          await tx.notification.create({
            data: {
              userId: ret.userId,
              type: "RETURN_APPROVED",
              title: "تم سحب نقاط الولاء",
              message: `تم سحب ${revokeResult.pointsRevoked} نقطة بسبب الإرجاع. رصيدك الآن: ${revokeResult.balanceAfter} نقطة.`,
              link: `/loyalty`,
              category: "ORDER",
              severity: "WARNING",
              metadata: {
                orderId: ret.orderId,
                returnId,
                pointsRevoked: revokeResult.pointsRevoked,
                balanceAfter: revokeResult.balanceAfter,
              },
            },
          });
        }
      } catch (loyaltyErr) {
        console.error("Loyalty revoke failed during return:", loyaltyErr);
      }

      return { success: true, isFullReturn: isFull };
    }, { timeout: 30000 });
  },

  // ═══════ قراءات ═══════
  async getByOrder(orderId: number, userId: number) {
    return prisma.returnRequest.findMany({
      where: { orderId, userId },
      include: { items: { include: { orderItem: true } } },
      orderBy: { requestedAt: "desc" },
    });
  },

  async getAllForAdmin(status?: string) {
    const where: any = {};
    if (status && status !== "ALL") where.status = status;

    return prisma.returnRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        order: { select: { id: true, orderNumber: true, total: true } },
        items: {
          include: {
            orderItem: {
              select: { productName: true, imageUrl: true, quantity: true },
            },
          },
        },
      },
      orderBy: { requestedAt: "desc" },
    });
  },

  async getById(returnId: number) {
    return prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        order: true,
        items: { include: { orderItem: true } },
      },
    });
  },
};

// ═══════════════════════════════════════════
// Helper: هل كل OrderItems مكتملة الإرجاع؟
// ═══════════════════════════════════════════
async function isFullReturn(tx: any, orderId: number): Promise<boolean> {
  const orderItems = await tx.orderItem.findMany({
    where: { orderId },
    select: { id: true, quantity: true },
  });

  for (const oi of orderItems) {
    const completedItems = await tx.returnItem.findMany({
      where: {
        orderItemId: oi.id,
        returnRequest: { status: "COMPLETED" },
      },
      select: { quantity: true },
    });

    const completedQty = completedItems.reduce(
      (s: number, ri: any) => s + ri.quantity,
      0
    );

    if (completedQty < oi.quantity) return false;
  }

  return true;
}

// ═══════════════════════════════════════════
// Helper: Largest Remainder Method
// ═══════════════════════════════════════════
async function reconcileRefunds(tx: any, orderId: number) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { subtotal: true, discount: true },
  });
  if (!order) return;

  const targetCents =
    toCents(Number(order.subtotal)) - toCents(Number(order.discount));

  // كل ReturnItems المكتملة لهذا الطلب
  const items = await tx.returnItem.findMany({
    where: {
      returnRequest: { orderId, status: "COMPLETED" },
    },
    include: { orderItem: true },
    orderBy: { id: "asc" },
  });

  if (items.length === 0) return;

  const subtotal = Number(order.subtotal);
  const discount = Number(order.discount);

  // احسب raw بسنوات (float) لكل item
  const raws: number[] = items.map((it: any) => {
    const raw = calcRawRefund(
      Number(it.orderItem.unitPrice),
      it.quantity,
      discount,
      subtotal
    );
    return raw * 100; // سنتات
  });

  // floor + remainders
  const floors = raws.map((r) => Math.floor(r));
  const remainders = raws.map((r, i) => r - floors[i]);
  const sumFloors = floors.reduce((a, b) => a + b, 0);
  const shortfall = targetCents - sumFloors;

  if (shortfall < 0 || shortfall > items.length) {
    // معطيات غير متوقعة — تجاهل
    console.warn(
      `reconcileRefunds: shortfall = ${shortfall}, items = ${items.length}`
    );
    return;
  }

  // رتّب حسب أكبر remainder
  const indices = remainders.map((_, i) => i);
  indices.sort((a, b) => remainders[b] - remainders[a]);

  const resultCents = [...floors];
  for (let i = 0; i < shortfall; i++) {
    resultCents[indices[i]]++;
  }

  // اكتب القيم + علّم الأخير المعدّل
  for (let i = 0; i < items.length; i++) {
    const newCents = resultCents[i];
    const oldCents = toCents(Number(items[i].refundAmount));
    const isAdjusted = newCents !== Math.round(raws[i]) && i === indices[shortfall - 1];

    await tx.returnItem.update({
      where: { id: items[i].id },
      data: {
        refundAmount: fromCents(newCents),
        isLastAdjustment: isAdjusted ? true : items[i].isLastAdjustment,
      },
    });
  }
}