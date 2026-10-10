import { prisma } from "@/lib/prisma";
import { AuditService } from "@/services/audit.service";
import { FulfillmentStatus } from "@/app/generated/prisma/enums";

// ═══════ المهلة الافتراضية للتجهيز ═══════
const DEFAULT_PREP_DEADLINE_MINUTES = 60;

// ═══════ انتقالات الحالة المسموح بها ═══════
const ALLOWED_TRANSITIONS: Record<string, FulfillmentStatus[]> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_COLLECTION", "CANCELLED"],
  READY_FOR_COLLECTION: ["COLLECTED", "CANCELLED"],
  COLLECTED: ["IN_TRANSIT_TO_WAREHOUSE"],
  IN_TRANSIT_TO_WAREHOUSE: ["RECEIVED"],
  RECEIVED: ["VERIFIED", "RETURNED"],
  VERIFIED: ["AVAILABLE_FOR_SHIPMENT", "RETURNED"],
  AVAILABLE_FOR_SHIPMENT: ["ALLOCATED", "RETURNED"],
  ALLOCATED: ["SHIPPED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

// ═══════ الأنواع ═══════
type CreateForOrderInput = {
  orderId: number;
};

type TransitionInput = {
  fulfillmentItemId: number;
  toStatus: FulfillmentStatus;
  changedById: number;
  note?: string;
};

export const FulfillmentService = {
  // ═══════════════════════════════════════════
  // إنشاء FulfillmentItems لطلب
  // (يُستدعى من OrderService بعد إنشاء الطلب)
  // ═══════════════════════════════════════════
  async createForOrder(tx: any, input: CreateForOrderInput): Promise<number> {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        items: {
          select: {
            id: true,
            sellerId: true,
            quantity: true,
            product: { select: { sellerId: true } },
          },
        },
        seller: { select: { id: true } },
      },
    });

    if (!order) {
      throw new Error("الطلب غير موجود");
    }

    // ═══ هل ننشئ FulfillmentItems لهذا الطلب؟ ═══
    // IN_STORE → لا يحتاج Fulfillment (تسليم فوري)
    // ONLINE → يحتاج
    if (order.source === "IN_STORE") {
      return 0;
    }

    // ═══ المهلة ═══
    const deadline = new Date(
      order.createdAt.getTime() + DEFAULT_PREP_DEADLINE_MINUTES * 60 * 1000
    );

    let createdCount = 0;

    for (const item of order.items) {
      // ═══ تحديد sellerId (من OrderItem أو من Product) ═══
      const sellerId = item.sellerId ?? item.product?.sellerId ?? order.seller?.id;

      if (!sellerId) {
        throw new Error(
          `لا يمكن تحديد sellerId للـOrderItem ${item.id} — بيانات ناقصة`
        );
      }

      // ═══ هل يوجد FulfillmentItem لهذا العنصر؟ ═══
      const existing = await tx.fulfillmentItem.findFirst({
        where: { orderItemId: item.id },
        select: { id: true },
      });

      if (existing) continue;

      // ═══ إنشاء FulfillmentItem ═══
      const fulfillmentItem = await tx.fulfillmentItem.create({
        data: {
          orderItemId: item.id,
          sellerId,
          quantity: item.quantity,
          status: "PENDING",
          deadline,
        },
      });

      // ═══ سجل الحالة الأولي ═══
      await tx.fulfillmentStatusHistory.create({
        data: {
          fulfillmentItemId: fulfillmentItem.id,
          fromStatus: null,
          toStatus: "PENDING",
          changedById: order.userId,
          note: "تم إنشاء عنصر التجهيز",
        },
      });

      createdCount++;
    }

    return createdCount;
  },

  // ═══════════════════════════════════════════
  // جلب FulfillmentItem بـID (مع علاقات)
  // ═══════════════════════════════════════════
  async getById(fulfillmentItemId: number) {
    return prisma.fulfillmentItem.findUnique({
      where: { id: fulfillmentItemId },
      include: {
        orderItem: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                source: true,
                status: true,
                createdAt: true,
                customerSnapshot: true,
                shippingAddressSnapshot: true,
              },
            },
            product: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        seller: {
          select: { id: true, storeName: true, slug: true },
        },
        history: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        warehouseReceipts: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  },

  // ═══════════════════════════════════════════
  // قائمة FulfillmentItems حسب السياق
  // ═══════════════════════════════════════════
  async listForSeller(
    sellerId: number,
    filters?: { status?: FulfillmentStatus | FulfillmentStatus[] }
  ) {
    const where: any = { sellerId };

    if (filters?.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
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
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: [{ deadline: "asc" }, { createdAt: "asc" }],
      take: 200,
    });
  },

  async listForWarehouse(filters?: {
    status?: FulfillmentStatus | FulfillmentStatus[];
  }) {
    const where: any = {};

    if (filters?.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    } else {
      // افتراضي: العناصر التي في المستودع أو جاهزة للشحن
      where.status = {
        in: [
          "RECEIVED",
          "VERIFIED",
          "AVAILABLE_FOR_SHIPMENT",
          "ALLOCATED",
        ],
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
                customerSnapshot: true,
              },
            },
          },
        },
        seller: {
          select: { id: true, storeName: true },
        },
      },
      orderBy: [{ warehouseReceivedAt: "asc" }, { createdAt: "asc" }],
      take: 200,
    });
  },

  // ═══════════════════════════════════════════
  // قائمة FulfillmentItems القابلة للجمع
  // ═══════════════════════════════════════════
  async listReadyForCollection(sellerIds?: number[]) {
    const where: any = {
      status: "READY_FOR_COLLECTION",
      // لم تُضف بعد إلى Collection Assignment مفتوح
      collectionItems: {
        none: {
          assignment: {
            status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] },
          },
        },
      },
    };

    if (sellerIds && sellerIds.length > 0) {
      where.sellerId = { in: sellerIds };
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
                createdAt: true,
              },
            },
          },
        },
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            city: true,
          },
        },
      },
      orderBy: [{ sellerId: "asc" }, { readyAt: "asc" }],
      take: 200,
    });
  },

  // ═══════════════════════════════════════════
  // Transition — تغيير الحالة (مع Validation)
  // ═══════════════════════════════════════════
  async transition(input: TransitionInput): Promise<{
    success: boolean;
    fromStatus: FulfillmentStatus;
    toStatus: FulfillmentStatus;
  }> {
    const now = new Date();
    const updates: any = { status: input.toStatus };

    switch (input.toStatus) {
      case "PREPARING":
        updates.preparedAt = now;
        updates.preparedById = input.changedById;
        break;
      case "READY_FOR_COLLECTION":
        updates.readyAt = now;
        break;
      case "COLLECTED":
        updates.collectedAt = now;
        updates.collectedById = input.changedById;
        break;
      case "IN_TRANSIT_TO_WAREHOUSE":
        updates.departedAt = now;
        break;
      case "RECEIVED":
        updates.warehouseReceivedAt = now;
        updates.warehouseReceivedById = input.changedById;
        break;
      case "VERIFIED":
        updates.verifiedAt = now;
        updates.verifiedById = input.changedById;
        break;
    }

    return prisma.$transaction(async (tx) => {
      const item = await tx.fulfillmentItem.findUnique({
        where: { id: input.fulfillmentItemId },
        select: { status: true, orderItemId: true },
      });

      if (!item) throw new Error("عنصر التجهيز غير موجود");

      const allowed = ALLOWED_TRANSITIONS[item.status] || [];
      if (!allowed.includes(input.toStatus)) {
        throw new Error(
          `لا يمكن الانتقال من ${item.status} إلى ${input.toStatus}`
        );
      }

      // ═══ updateMany مع شرط الحالة (ذرّي) ═══
      const updated = await tx.fulfillmentItem.updateMany({
        where: { id: input.fulfillmentItemId, status: item.status },
        data: updates,
      });

      if (updated.count === 0) {
        throw new Error("تم تغيير الحالة من عملية أخرى، أعد المحاولة");
      }

      await tx.fulfillmentStatusHistory.create({
        data: {
          fulfillmentItemId: input.fulfillmentItemId,
          fromStatus: item.status as FulfillmentStatus,
          toStatus: input.toStatus,
          changedById: input.changedById,
          note: input.note || null,
        },
      });

      await FulfillmentService.syncOrderFulfillmentStatus(tx, item.orderItemId);

      return {
        success: true as const,
        fromStatus: item.status as FulfillmentStatus,
        toStatus: input.toStatus,
      };
    });
  },

  // ═══════════════════════════════════════════
  // مزامنة Order.fulfillmentStatus بعد تغيير FulfillmentItem
  // ═══════════════════════════════════════════
  async syncOrderFulfillmentStatus(
    tx: any,
    orderItemId: number
  ): Promise<void> {
    const orderItem = await tx.orderItem.findUnique({
      where: { id: orderItemId },
      select: { orderId: true },
    });
    if (!orderItem) return;

    const allItems = await tx.fulfillmentItem.findMany({
      where: { orderItem: { orderId: orderItem.orderId } },
      select: { status: true },
    });
    if (allItems.length === 0) return;

    const statuses: string[] = allItems.map((i: any) => i.status);
    const current = await tx.order.findUnique({
      where: { id: orderItem.orderId },
      select: { status: true, deliveredAt: true },
    });
    if (!current) return;

    const allDelivered = statuses.every((s) => s === "DELIVERED");
    const allReturned = statuses.every((s) => s === "RETURNED");
    const allCancelled = statuses.every((s) => s === "CANCELLED");
    const allFailed = statuses.every((s) =>
      ["RETURNED", "CANCELLED"].includes(s)
    );
    const allShipped = statuses.every((s) =>
      ["SHIPPED", "DELIVERED"].includes(s)
    );
    const anyShipped = statuses.some((s) =>
      ["SHIPPED", "DELIVERED"].includes(s)
    );

    const orderUpdate: any = {};

    if (allDelivered) {
      orderUpdate.fulfillmentStatus = "DELIVERED";
      if (current.status !== "DELIVERED" && current.status !== "RETURNED") {
        orderUpdate.status = "DELIVERED";
        orderUpdate.deliveredAt = current.deliveredAt ?? new Date();
        orderUpdate.paymentStatus = "PAID";
      }
    } else if (allFailed) {
      orderUpdate.fulfillmentStatus = allReturned ? "RETURNED" : "CANCELLED";
      if (current.status !== "DELIVERED" && current.status !== "RETURNED") {
        orderUpdate.status = "RETURNED";
      }
    } else if (allShipped) {
      orderUpdate.fulfillmentStatus = "SHIPPED";
    } else if (anyShipped) {
      orderUpdate.fulfillmentStatus = "SHIPPED";
      if (
        current.status !== "DELIVERED" &&
        current.status !== "RETURNED" &&
        current.status !== "PARTIALLY_DELIVERED"
      ) {
        orderUpdate.status = "PARTIALLY_DELIVERED";
      }
    } else {
      const orderedStatuses = [
        "PENDING",
        "PREPARING",
        "READY_FOR_COLLECTION",
        "COLLECTED",
        "IN_TRANSIT_TO_WAREHOUSE",
        "RECEIVED",
        "VERIFIED",
        "AVAILABLE_FOR_SHIPMENT",
        "ALLOCATED",
        "SHIPPED",
        "DELIVERED",
      ];
      const active = statuses.filter(
        (s) => !["RETURNED", "CANCELLED"].includes(s)
      );
      let minIndex = orderedStatuses.length - 1;
      for (const s of active) {
        const idx = orderedStatuses.indexOf(s);
        if (idx >= 0 && idx < minIndex) minIndex = idx;
      }
      orderUpdate.fulfillmentStatus = orderedStatuses[minIndex];
    }

    if (Object.keys(orderUpdate).length > 0) {
      await tx.order.update({
        where: { id: orderItem.orderId },
        data: orderUpdate,
      });
    }
  },

  // ═══════════════════════════════════════════
  // إحصائيات التاجر (تأخير/جاهز/مُسلّم)
  // ═══════════════════════════════════════════
  async getSellerStats(sellerId: number) {
    const now = new Date();

    const [
      pending,
      preparing,
      ready,
      collected,
      atWarehouse,
      shipped,
      delivered,
      cancelled,
      overdue,
    ] = await Promise.all([
      prisma.fulfillmentItem.count({
        where: { sellerId, status: "PENDING" },
      }),
      prisma.fulfillmentItem.count({
        where: { sellerId, status: "PREPARING" },
      }),
      prisma.fulfillmentItem.count({
        where: { sellerId, status: "READY_FOR_COLLECTION" },
      }),
      prisma.fulfillmentItem.count({
        where: { sellerId, status: "COLLECTED" },
      }),
      prisma.fulfillmentItem.count({
        where: {
          sellerId,
          status: { in: ["IN_TRANSIT_TO_WAREHOUSE", "RECEIVED", "VERIFIED", "AVAILABLE_FOR_SHIPMENT"] },
        },
      }),
      prisma.fulfillmentItem.count({
        where: { sellerId, status: "SHIPPED" },
      }),
      prisma.fulfillmentItem.count({
        where: { sellerId, status: "DELIVERED" },
      }),
      prisma.fulfillmentItem.count({
        where: { sellerId, status: "CANCELLED" },
      }),
      prisma.fulfillmentItem.count({
        where: {
          sellerId,
          deadline: { lt: now },
          status: { in: ["PENDING", "PREPARING"] },
        },
      }),
    ]);

    return {
      pending,
      preparing,
      ready,
      collected,
      atWarehouse,
      shipped,
      delivered,
      cancelled,
      overdue,
      totalActive: pending + preparing + ready + collected + atWarehouse,
    };
  },

  // ═══════════════════════════════════════════
  // فحص التأخير (يُستخدم من Cron/Admin dashboard)
  // ═══════════════════════════════════════════
  async findOverdue() {
    const now = new Date();
    return prisma.fulfillmentItem.findMany({
      where: {
        deadline: { lt: now },
        status: { in: ["PENDING", "PREPARING"] },
      },
      include: {
        orderItem: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                createdAt: true,
              },
            },
          },
        },
        seller: {
          select: { id: true, storeName: true, userId: true },
        },
      },
      orderBy: { deadline: "asc" },
      take: 200,
    });
  },
};