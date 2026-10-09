import { prisma } from "@/lib/prisma";
import { AuditService } from "@/services/audit.service";
import { FulfillmentService } from "@/services/fulfillment.service";
import { FulfillmentStatus, WarehouseReceiptStatus } from "@/app/generated/prisma/enums";

// ═══════ الأنواع ═══════
type ReceiveInput = {
  fulfillmentItemId: number;
  receivedById: number;
  quantity?: number;
  notes?: string | null;
};

type VerifyInput = {
  receiptId: number;
  verifiedById: number;
  damagedQuantity?: number;
  notes?: string | null;
};

type RejectInput = {
  receiptId: number;
  rejectedById: number;
  reason: string;
  notes?: string | null;
};

export const WarehouseService = {
  // ═══════════════════════════════════════════
  // توليد رقم استلام فريد
  // ═══════════════════════════════════════════
  async generateReceiptNumber(tx: any): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `WH-${year}-`;

    const last = await tx.warehouseReceipt.findFirst({
      where: { receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: "desc" },
      select: { receiptNumber: true },
    });

    let next = 1;
    if (last) {
      const parts = last.receiptNumber.split("-");
      const lastNum = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastNum)) next = lastNum + 1;
    }

    return `${prefix}${String(next).padStart(5, "0")}`;
  },

  // ═══════════════════════════════════════════
  // استلام عنصر في المستودع
  // (IN_TRANSIT_TO_WAREHOUSE → RECEIVED)
  // ═══════════════════════════════════════════
  async receive(input: ReceiveInput) {
    const fulfillmentItem = await prisma.fulfillmentItem.findUnique({
      where: { id: input.fulfillmentItemId },
      include: {
        orderItem: {
          select: { id: true, orderId: true },
        },
        seller: {
          select: { id: true, storeName: true },
        },
      },
    });

    if (!fulfillmentItem) {
      throw new Error("عنصر التجهيز غير موجود");
    }

    // ═══ التحقق: يجب أن يكون IN_TRANSIT_TO_WAREHOUSE ═══
    if (fulfillmentItem.status !== "IN_TRANSIT_TO_WAREHOUSE") {
      throw new Error(
        `لا يمكن استلام عنصر بحالة ${fulfillmentItem.status}`
      );
    }

    // ═══ Idempotency: هل تم استلامه مسبقاً؟ ═══
    const existingReceipt = await prisma.warehouseReceipt.findFirst({
      where: { fulfillmentItemId: input.fulfillmentItemId },
      select: { id: true, status: true },
    });

    if (existingReceipt) {
      throw new Error(
        `تم استلام هذا العنصر مسبقاً (الإيصال #${existingReceipt.id})`
      );
    }

    const quantity = input.quantity ?? fulfillmentItem.quantity;

    if (quantity <= 0 || quantity > fulfillmentItem.quantity) {
      throw new Error(
        `الكمية يجب أن تكون بين 1 و ${fulfillmentItem.quantity}`
      );
    }

    // ═══ Transaction ═══
    return prisma.$transaction(
      async (tx) => {
        const receiptNumber = await this.generateReceiptNumber(tx);

        // 1. إنشاء WarehouseReceipt
        const receipt = await tx.warehouseReceipt.create({
          data: {
            receiptNumber,
            fulfillmentItemId: input.fulfillmentItemId,
            quantity,
            status: "RECEIVED",
            receivedById: input.receivedById,
            notes: input.notes || null,
          },
        });

        // 2. تحديث FulfillmentItem → RECEIVED
        const oldStatus = fulfillmentItem.status;

        await tx.fulfillmentItem.update({
          where: { id: input.fulfillmentItemId },
          data: {
            status: "RECEIVED",
            warehouseReceivedAt: new Date(),
            warehouseReceivedById: input.receivedById,
          },
        });

        // 3. سجل الحالة
        await tx.fulfillmentStatusHistory.create({
          data: {
            fulfillmentItemId: input.fulfillmentItemId,
            fromStatus: oldStatus as FulfillmentStatus,
            toStatus: "RECEIVED",
            changedById: input.receivedById,
            note: `استلام في المستودع — إيصال ${receiptNumber}`,
          },
        });

        // 4. مزامنة Order
        await FulfillmentService.syncOrderFulfillmentStatus(
          tx,
          fulfillmentItem.orderItemId
        );

        // 5. Audit
        await AuditService.logInTransaction(tx, {
          userId: input.receivedById,
          action: "WAREHOUSE_RECEIVE",
          entity: "WarehouseReceipt",
          entityId: receipt.id,
          newData: {
            receiptNumber,
            fulfillmentItemId: input.fulfillmentItemId,
            sellerId: fulfillmentItem.sellerId,
            sellerName: fulfillmentItem.seller.storeName,
            quantity,
          },
        });

        return receipt;
      },
      { timeout: 20000 }
    );
  },

  // ═══════════════════════════════════════════
  // التحقق من عنصر مستلم
  // (RECEIVED → VERIFIED)
  // ═══════════════════════════════════════════
  async verify(input: VerifyInput) {
    const receipt = await prisma.warehouseReceipt.findUnique({
      where: { id: input.receiptId },
      include: {
        fulfillmentItem: {
          include: {
            orderItem: { select: { id: true, orderId: true } },
          },
        },
      },
    });

    if (!receipt) {
      throw new Error("إيصال الاستلام غير موجود");
    }

    // ═══ التحقق: حالة الإيصال ═══
    if (receipt.status !== "RECEIVED") {
      throw new Error(
        `لا يمكن التحقق من إيصال بحالة ${receipt.status}`
      );
    }

    // ═══ التحقق: حالة FulfillmentItem ═══
    if (receipt.fulfillmentItem.status !== "RECEIVED") {
      throw new Error(
        `العنصر ليس بحالة RECEIVED (حالته: ${receipt.fulfillmentItem.status})`
      );
    }

    const damagedQty = input.damagedQuantity ?? 0;

    if (damagedQty < 0 || damagedQty > receipt.quantity) {
      throw new Error(
        `الكمية التالفة يجب أن تكون بين 0 و ${receipt.quantity}`
      );
    }

    const newReceiptStatus: WarehouseReceiptStatus =
      damagedQty > 0 ? "DAMAGED" : "VERIFIED";

    // ═══ Transaction ═══
    return prisma.$transaction(
      async (tx) => {
        // 1. تحديث WarehouseReceipt
        const updatedReceipt = await tx.warehouseReceipt.update({
          where: { id: input.receiptId },
          data: {
            status: newReceiptStatus,
            verifiedAt: new Date(),
            verifiedById: input.verifiedById,
            damagedQuantity: damagedQty,
            notes: input.notes || receipt.notes,
          },
        });

        // 2. تحديث FulfillmentItem → VERIFIED
        const oldStatus = receipt.fulfillmentItem.status;

        await tx.fulfillmentItem.update({
          where: { id: receipt.fulfillmentItemId },
          data: {
            status: "VERIFIED",
            verifiedAt: new Date(),
            verifiedById: input.verifiedById,
          },
        });

        // 3. سجل الحالة
        await tx.fulfillmentStatusHistory.create({
          data: {
            fulfillmentItemId: receipt.fulfillmentItemId,
            fromStatus: oldStatus as FulfillmentStatus,
            toStatus: "VERIFIED",
            changedById: input.verifiedById,
            note:
              damagedQty > 0
                ? `تم التحقق — ${damagedQty} وحدة تالفة`
                : "تم التحقق بنجاح",
          },
        });

        // 4. مزامنة Order
        await FulfillmentService.syncOrderFulfillmentStatus(
          tx,
          receipt.fulfillmentItem.orderItemId
        );

        // 5. Audit
        await AuditService.logInTransaction(tx, {
          userId: input.verifiedById,
          action: "WAREHOUSE_VERIFY",
          entity: "WarehouseReceipt",
          entityId: receipt.id,
          oldData: { status: "RECEIVED" },
          newData: {
            status: newReceiptStatus,
            damagedQuantity: damagedQty,
          },
        });

        return updatedReceipt;
      },
      { timeout: 20000 }
    );
  },

  // ═══════════════════════════════════════════
  // رفض عنصر مستلم (لأسباب تشغيلية)
  // (RECEIVED → REJECTED)
  // ═══════════════════════════════════════════
  async reject(input: RejectInput) {
    if (!input.reason || input.reason.trim().length < 3) {
      throw new Error("سبب الرفض مطلوب (3 أحرف على الأقل)");
    }

    const receipt = await prisma.warehouseReceipt.findUnique({
      where: { id: input.receiptId },
      include: {
        fulfillmentItem: {
          include: {
            orderItem: { select: { id: true, orderId: true } },
          },
        },
      },
    });

    if (!receipt) {
      throw new Error("إيصال الاستلام غير موجود");
    }

    if (receipt.status !== "RECEIVED") {
      throw new Error(
        `لا يمكن رفض إيصال بحالة ${receipt.status}`
      );
    }

    // ═══ Transaction ═══
    return prisma.$transaction(
      async (tx) => {
        // 1. تحديث WarehouseReceipt → REJECTED
        const updatedReceipt = await tx.warehouseReceipt.update({
          where: { id: input.receiptId },
          data: {
            status: "REJECTED",
            verifiedAt: new Date(),
            verifiedById: input.rejectedById,
            rejectionReason: input.reason.trim(),
            notes: input.notes || receipt.notes,
          },
        });

        // 2. تحديث FulfillmentItem → RETURNED
        const oldStatus = receipt.fulfillmentItem.status;

        await tx.fulfillmentItem.update({
          where: { id: receipt.fulfillmentItemId },
          data: {
            status: "RETURNED",
            notes: `رُفض في المستودع: ${input.reason.trim()}`,
          },
        });

        // 3. سجل الحالة
        await tx.fulfillmentStatusHistory.create({
          data: {
            fulfillmentItemId: receipt.fulfillmentItemId,
            fromStatus: oldStatus as FulfillmentStatus,
            toStatus: "RETURNED",
            changedById: input.rejectedById,
            note: `رفض في المستودع: ${input.reason.trim()}`,
          },
        });

        // 4. مزامنة Order
        await FulfillmentService.syncOrderFulfillmentStatus(
          tx,
          receipt.fulfillmentItem.orderItemId
        );

        // 5. Audit
        await AuditService.logInTransaction(tx, {
          userId: input.rejectedById,
          action: "WAREHOUSE_VERIFY",
          entity: "WarehouseReceipt",
          entityId: receipt.id,
          oldData: { status: "RECEIVED" },
          newData: {
            status: "REJECTED",
            reason: input.reason.trim(),
          },
        });

        return updatedReceipt;
      },
      { timeout: 20000 }
    );
  },

  // ═══════════════════════════════════════════
  // تعيين عنصر كمتاح للشحن
  // (VERIFIED → AVAILABLE_FOR_SHIPMENT)
  // ═══════════════════════════════════════════
  async markAvailableForShipment(
    fulfillmentItemId: number,
    performedById: number,
    note?: string
  ) {
    const item = await prisma.fulfillmentItem.findUnique({
      where: { id: fulfillmentItemId },
      include: {
        orderItem: { select: { id: true, orderId: true } },
      },
    });

    if (!item) {
      throw new Error("عنصر التجهيز غير موجود");
    }

    if (item.status !== "VERIFIED") {
      throw new Error(
        `لا يمكن تعيين عنصر بحالة ${item.status} كمتاح للشحن`
      );
    }

    return prisma.$transaction(async (tx) => {
      await tx.fulfillmentItem.update({
        where: { id: fulfillmentItemId },
        data: { status: "AVAILABLE_FOR_SHIPMENT" },
      });

      await tx.fulfillmentStatusHistory.create({
        data: {
          fulfillmentItemId,
          fromStatus: "VERIFIED",
          toStatus: "AVAILABLE_FOR_SHIPMENT",
          changedById: performedById,
          note: note || "متاح للشحن",
        },
      });

      await FulfillmentService.syncOrderFulfillmentStatus(
        tx,
        item.orderItemId
      );

      await AuditService.logInTransaction(tx, {
        userId: performedById,
        action: "WAREHOUSE_VERIFY",
        entity: "FulfillmentItem",
        entityId: fulfillmentItemId,
        oldData: { status: "VERIFIED" },
        newData: { status: "AVAILABLE_FOR_SHIPMENT" },
      });

      return { success: true };
    });
  },

  // ═══════════════════════════════════════════
  // جلب إيصال بالمعرّف
  // ═══════════════════════════════════════════
  async getReceiptById(receiptId: number) {
    return prisma.warehouseReceipt.findUnique({
      where: { id: receiptId },
      include: {
        fulfillmentItem: {
          include: {
            seller: {
              select: { id: true, storeName: true, slug: true },
            },
            orderItem: {
              include: {
                order: {
                  select: { id: true, orderNumber: true, createdAt: true },
                },
                product: {
                  select: { id: true, name: true, slug: true },
                },
              },
            },
          },
        },
      },
    });
  },

  // ═══════════════════════════════════════════
  // قائمة الإيصالات
  // ═══════════════════════════════════════════
  async listReceipts(filters?: {
    status?: WarehouseReceiptStatus | WarehouseReceiptStatus[];
  }) {
    const where: any = {};

    if (filters?.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    return prisma.warehouseReceipt.findMany({
      where,
      include: {
        fulfillmentItem: {
          include: {
            seller: { select: { id: true, storeName: true } },
            orderItem: {
              include: {
                order: {
                  select: { id: true, orderNumber: true },
                },
              },
            },
          },
        },
      },
      orderBy: { receivedAt: "desc" },
      take: 100,
    });
  },

  // ═══════════════════════════════════════════
  // العناصر الجاهزة للشحن (لدعم Grouping)
  // ═══════════════════════════════════════════
  async listAvailableForShipment(customerId?: number) {
    const where: any = {
      status: "AVAILABLE_FOR_SHIPMENT",
    };

    if (customerId) {
      where.orderItem = {
        order: { userId: customerId },
      };
    }

    return prisma.fulfillmentItem.findMany({
      where,
      include: {
        orderItem: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                userId: true,
                source: true,
                status: true,
                customerSnapshot: true,
                shippingAddressSnapshot: true,
              },
            },
            product: {
              select: { id: true, name: true },
            },
          },
        },
        seller: {
          select: { id: true, storeName: true },
        },
      },
      orderBy: [{ sellerId: "asc" }, { verifiedAt: "asc" }],
      take: 200,
    });
  },

  // ═══════════════════════════════════════════
  // إحصائيات المستودع
  // ═══════════════════════════════════════════
  async getStats() {
    const [received, verified, damaged, rejected, available] =
      await Promise.all([
        prisma.warehouseReceipt.count({ where: { status: "RECEIVED" } }),
        prisma.warehouseReceipt.count({ where: { status: "VERIFIED" } }),
        prisma.warehouseReceipt.count({ where: { status: "DAMAGED" } }),
        prisma.warehouseReceipt.count({ where: { status: "REJECTED" } }),
        prisma.fulfillmentItem.count({
          where: { status: "AVAILABLE_FOR_SHIPMENT" },
        }),
      ]);

    return {
      received,
      verified,
      damaged,
      rejected,
      available,
      pendingVerification: received,
    };
  },
};