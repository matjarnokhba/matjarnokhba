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
        console.warn(
          `⚠️ لا يمكن تحديد sellerId للـOrderItem ${item.id}`
        );
        continue;
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
    const item = await prisma.fulfillmentItem.findUnique({
      where: { id: input.fulfillmentItemId },
    });

    if (!item) {
      throw new Error("عنصر التجهيز غير موجود");
    }

    const allowed = ALLOWED_TRANSITIONS[item.status] || [];

    if (!allowed.includes(input.toStatus)) {
      throw new Error(
        `لا يمكن الانتقال من ${item.status} إلى ${input.toStatus}`
      );
    }

    const now = new Date();
    const updates: any = { status: input.toStatus };

    // ═══ طوابع زمنية حسب الحالة ═══
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

    // ═══ تنفيذ التغيير ═══
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.fulfillmentItem.update({
        where: { id: input.fulfillmentItemId },
        data: updates,
      });

      await tx.fulfillmentStatusHistory.create({
        data: {
          fulfillmentItemId: input.fulfillmentItemId,
          fromStatus: item.status as FulfillmentStatus,
          toStatus: input.toStatus,
          changedById: input.changedById,
          note: input.note || null,
        },
      });

      // ═══ مزامنة Order.fulfillmentStatus ═══
      await FulfillmentService.syncOrderFulfillmentStatus(
        tx,
        item.orderItemId
      );

      return updated;
    });

    return {
      success: true,
      fromStatus: item.status as FulfillmentStatus,
      toStatus: result.status as FulfillmentStatus,
    };
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
      where: {
        orderItem: { orderId: orderItem.orderId },
      },
      select: { status: true },
    });

    if (allItems.length === 0) return;

    // ═══ تحديد الحالة المشتركة ═══
    const statuses = allItems.map((i: any) => i.status);

    // أولوية: لو الكل DELIVERED → DELIVERED
    // لو الكل SHIPPED → SHIPPED
    // لو الكل CANCELLED → CANCELLED
    // وإلا: نأخذ أدنى حالة متقدمة مشتركة

    const allDelivered = statuses.every((s: string) => s === "DELIVERED");
    const allShipped = statuses.every((s: string) =>
      ["SHIPPED", "DELIVERED"].includes(s)
    );
    const allCancelled = statuses.every((s: string) => s === "CANCELLED");
    const allReady = statuses.every((s: string) =>
      ["READY_FOR_COLLECTION", "COLLECTED", "IN_TRANSIT_TO_WAREHOUSE",
       "RECEIVED", "VERIFIED", "AVAILABLE_FOR_SHIPMENT", "ALLOCATED",
       "SHIPPED", "DELIVERED"].includes(s)
    );

    let orderFulfillmentStatus: FulfillmentStatus;

    if (allDelivered) {
      orderFulfillmentStatus = "DELIVERED";
    } else if (allShipped) {
      orderFulfillmentStatus = "SHIPPED";
    } else if (allCancelled) {
      orderFulfillmentStatus = "CANCELLED";
    } else if (allReady) {
      orderFulfillmentStatus = "AVAILABLE_FOR_SHIPMENT";
    } else {
      // أدنى حالة (الأقل تقدمًا)
      const order = [
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

      let minIndex = order.length - 1;
      for (const s of statuses) {
        const idx = order.indexOf(s);
        if (idx >= 0 && idx < minIndex) minIndex = idx;
      }
      orderFulfillmentStatus = order[minIndex] as FulfillmentStatus;
    }

    await tx.order.update({
      where: { id: orderItem.orderId },
      data: { fulfillmentStatus: orderFulfillmentStatus },
    });
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