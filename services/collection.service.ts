import { prisma } from "@/lib/prisma";
import { AuditService } from "@/services/audit.service";
import { CollectionStatus, FulfillmentStatus } from "@/app/generated/prisma/enums";

// ═══════ انتقالات حالة التكليف ═══════
const ALLOWED_TRANSITIONS: Record<string, CollectionStatus[]> = {
  PENDING: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

// ═══════ الأنواع ═══════
type CreateInput = {
  deliveryPersonId: number;
  createdById: number;
  fulfillmentItemIds: number[];
  scheduledAt?: Date | null;
  notes?: string | null;
};

type PickupInput = {
  assignmentId: number;
  fulfillmentItemId: number;
  pickedUpById: number;
  quantity?: number;
  notes?: string | null;
};

type DepartInput = {
  assignmentId: number;
  fulfillmentItemId: number;
  departedById: number;
  notes?: string | null;
};

export const CollectionService = {
  // ═══════════════════════════════════════════
  // توليد رقم تكليف فريد
  // ═══════════════════════════════════════════
  async generateAssignmentNumber(tx: any): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `COL-${year}-`;

    const last = await tx.collectionAssignment.findFirst({
      where: { assignmentNumber: { startsWith: prefix } },
      orderBy: { assignmentNumber: "desc" },
      select: { assignmentNumber: true },
    });

    let next = 1;
    if (last) {
      const parts = last.assignmentNumber.split("-");
      const lastNum = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastNum)) next = lastNum + 1;
    }

    return `${prefix}${String(next).padStart(5, "0")}`;
  },

  // ═══════════════════════════════════════════
  // إنشاء تكليف جمع
  // ═══════════════════════════════════════════
  async create(input: CreateInput) {
    if (!input.fulfillmentItemIds || input.fulfillmentItemIds.length === 0) {
      throw new Error("يجب اختيار عنصر تجهيز واحد على الأقل");
    }

    // ═══ التحقق من السائق ═══
    const person = await prisma.deliveryPerson.findUnique({
      where: { id: input.deliveryPersonId },
      select: { id: true, status: true, deletedAt: true, city: true },
    });

    if (!person || person.deletedAt || person.status !== "ACTIVE") {
      throw new Error("السائق غير نشط أو غير موجود");
    }

    // ═══ جلب الـFulfillmentItems ═══
    const items = await prisma.fulfillmentItem.findMany({
      where: { id: { in: input.fulfillmentItemIds } },
      include: {
        seller: {
          select: { id: true, storeName: true, city: true },
        },
        orderItem: {
          select: { id: true, orderId: true },
        },
      },
    });

    if (items.length !== input.fulfillmentItemIds.length) {
      throw new Error("بعض عناصر التجهيز غير موجودة");
    }

    // ═══ التحقق: كل العناصر يجب أن تكون READY_FOR_COLLECTION ═══
    const invalidStatus = items.find(
      (i) => i.status !== "READY_FOR_COLLECTION"
    );
    if (invalidStatus) {
      throw new Error(
        `العنصر #${invalidStatus.id} ليس جاهزاً للجمع (حالته: ${invalidStatus.status})`
      );
    }

    // ═══ التحقق: لا يوجد تكليف نشط لهذه العناصر ═══
    const existingAssignments = await prisma.collectionAssignmentItem.findMany({
      where: {
        fulfillmentItemId: { in: input.fulfillmentItemIds },
        assignment: {
          status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] },
        },
      },
      select: { fulfillmentItemId: true },
    });

    if (existingAssignments.length > 0) {
      const ids = existingAssignments.map((a) => a.fulfillmentItemId).join(", ");
      throw new Error(
        `العناصر التالية لها تكليف جمع نشط بالفعل: ${ids}`
      );
    }

    // ═══ Transaction ═══
    const assignment = await prisma.$transaction(
      async (tx) => {
        const assignmentNumber = await this.generateAssignmentNumber(tx);

        const newAssignment = await tx.collectionAssignment.create({
          data: {
            assignmentNumber,
            deliveryPersonId: input.deliveryPersonId,
            assignedById: input.createdById,
            status: "ASSIGNED",
            scheduledAt: input.scheduledAt || null,
            notes: input.notes || null,
          },
        });

        // ═══ إضافة العناصر ═══
        for (const item of items) {
          await tx.collectionAssignmentItem.create({
            data: {
              assignmentId: newAssignment.id,
              fulfillmentItemId: item.id,
              sellerId: item.sellerId,
              quantity: item.quantity,
            },
          });
        }

        // ═══ Audit ═══
        await AuditService.logInTransaction(tx, {
          userId: input.createdById,
          action: "COLLECTION_ASSIGN",
          entity: "CollectionAssignment",
          entityId: newAssignment.id,
          newData: {
            assignmentNumber,
            deliveryPersonId: input.deliveryPersonId,
            itemsCount: items.length,
            sellerIds: [...new Set(items.map((i) => i.sellerId))],
            totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
          },
        });

        return newAssignment;
      },
      { timeout: 30000 }
    );

    return assignment;
  },

  // ═══════════════════════════════════════════
  // جلب تكليف بالمعرّف (مع كل العلاقات)
  // ═══════════════════════════════════════════
  async getById(assignmentId: number) {
    return prisma.collectionAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        deliveryPerson: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
        items: {
          include: {
            fulfillmentItem: {
              include: {
                seller: {
                  select: {
                    id: true,
                    storeName: true,
                    slug: true,
                    city: true,
                    region: true,
                  },
                },
                orderItem: {
                  include: {
                    order: {
                      select: {
                        id: true,
                        orderNumber: true,
                        createdAt: true,
                      },
                    },
                    product: {
                      select: { id: true, name: true, slug: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  },

  // ═══════════════════════════════════════════
  // قائمة التكليفات للأدمن
  // ═══════════════════════════════════════════
  async listAll(filters?: { status?: CollectionStatus | CollectionStatus[] }) {
    const where: any = {};

    if (filters?.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    return prisma.collectionAssignment.findMany({
      where,
      include: {
        deliveryPerson: {
          include: {
            user: { select: { name: true, phone: true } },
          },
        },
        items: {
          select: {
            id: true,
            sellerId: true,
            quantity: true,
            collectedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  // ═══════════════════════════════════════════
  // قائمة تكليفات السائق
  // ═══════════════════════════════════════════
  async listForDeliveryPerson(
    deliveryPersonId: number,
    filters?: { status?: CollectionStatus | CollectionStatus[] }
  ) {
    const where: any = { deliveryPersonId };

    if (filters?.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    return prisma.collectionAssignment.findMany({
      where,
      include: {
        items: {
          include: {
            fulfillmentItem: {
              include: {
                seller: {
                  select: {
                    id: true,
                    storeName: true,
                    city: true,
                    region: true,
                  },
                },
                orderItem: {
                  include: {
                    product: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
  },

  // ═══════════════════════════════════════════
  // بدء التنفيذ (ASSIGNED → IN_PROGRESS)
  // ═══════════════════════════════════════════
  async start(assignmentId: number, startedById: number) {
    const assignment = await prisma.collectionAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new Error("التكليف غير موجود");
    }

    if (assignment.status !== "ASSIGNED") {
      throw new Error(
        `لا يمكن بدء تكليف بحالة ${assignment.status}`
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.collectionAssignment.update({
        where: { id: assignmentId },
        data: {
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
      });

      await AuditService.logInTransaction(tx, {
        userId: startedById,
        action: "COLLECTION_PICKUP",
        entity: "CollectionAssignment",
        entityId: assignmentId,
        oldData: { status: "ASSIGNED" },
        newData: { status: "IN_PROGRESS" },
      });

      return updated;
    });
  },

  // ═══════════════════════════════════════════
  // تأكيد استلام عنصر من التاجر (Pickup)
  // ═══════════════════════════════════════════
  async pickup(input: PickupInput) {
    const item = await prisma.collectionAssignmentItem.findFirst({
      where: {
        assignmentId: input.assignmentId,
        fulfillmentItemId: input.fulfillmentItemId,
      },
      include: {
        assignment: true,
        fulfillmentItem: true,
      },
    });

    if (!item) {
      throw new Error("العنصر غير موجود في هذا التكليف");
    }

    // ═══ التحقق من التكليف ═══
    if (
      !["ASSIGNED", "IN_PROGRESS"].includes(item.assignment.status)
    ) {
      throw new Error(
        `لا يمكن الجمع من تكليف بحالة ${item.assignment.status}`
      );
    }

    // ═══ Idempotency: هل تم الجمع مسبقاً؟ ═══
    if (item.collectedAt) {
      throw new Error("تم جمع هذا العنصر مسبقاً");
    }

    // ═══ التحقق: FulfillmentItem جاهز ═══
    if (item.fulfillmentItem.status !== "READY_FOR_COLLECTION") {
      throw new Error(
        `العنصر ليس جاهزاً للجمع (حالته: ${item.fulfillmentItem.status})`
      );
    }

    // ═══ Transaction ═══
    return prisma.$transaction(
      async (tx) => {
        // 1. تحديث CollectionAssignmentItem
        const updatedItem = await tx.collectionAssignmentItem.update({
          where: { id: item.id },
          data: {
            collectedAt: new Date(),
            collectedById: input.pickedUpById,
            notes: input.notes || null,
          },
        });

        // 2. تحديث FulfillmentItem → COLLECTED
        const oldStatus = item.fulfillmentItem.status;

        await tx.fulfillmentItem.update({
          where: { id: input.fulfillmentItemId },
          data: {
            status: "COLLECTED",
            collectedAt: new Date(),
            collectedById: input.pickedUpById,
          },
        });

        // 3. سجل FulfillmentStatusHistory
        await tx.fulfillmentStatusHistory.create({
          data: {
            fulfillmentItemId: input.fulfillmentItemId,
            fromStatus: oldStatus as FulfillmentStatus,
            toStatus: "COLLECTED",
            changedById: input.pickedUpById,
            note: `تم الجمع بواسطة السائق — تكليف ${item.assignment.assignmentNumber}`,
          },
        });

        // 4. مزامنة Order.fulfillmentStatus
        const orderItem = await tx.fulfillmentItem.findUnique({
          where: { id: input.fulfillmentItemId },
          select: { orderItemId: true },
        });
        if (orderItem) {
          // نُعيد استخدام منطق FulfillmentService
          const { FulfillmentService } = await import("@/services/fulfillment.service");
          await FulfillmentService.syncOrderFulfillmentStatus(
            tx,
            orderItem.orderItemId
          );
        }

        // 5. Audit
        await AuditService.logInTransaction(tx, {
          userId: input.pickedUpById,
          action: "COLLECTION_PICKUP",
          entity: "CollectionAssignmentItem",
          entityId: item.id,
          oldData: { status: "READY_FOR_COLLECTION" },
          newData: {
            status: "COLLECTED",
            sellerId: item.sellerId,
            quantity: item.quantity,
          },
        });

        return updatedItem;
      },
      { timeout: 15000 }
    );
  },

  // ═══════════════════════════════════════════
  // تأكيد المغادرة من التاجر
  // (COLLECTED → IN_TRANSIT_TO_WAREHOUSE)
  // ═══════════════════════════════════════════
  async depart(input: DepartInput) {
    const item = await prisma.collectionAssignmentItem.findFirst({
      where: {
        assignmentId: input.assignmentId,
        fulfillmentItemId: input.fulfillmentItemId,
      },
      include: {
        assignment: true,
        fulfillmentItem: true,
      },
    });

    if (!item) {
      throw new Error("العنصر غير موجود في هذا التكليف");
    }

    if (!item.collectedAt) {
      throw new Error("لم يتم جمع هذا العنصر بعد");
    }

    if (item.fulfillmentItem.status !== "COLLECTED") {
      throw new Error(
        `لا يمكن المغادرة — حالة العنصر: ${item.fulfillmentItem.status}`
      );
    }

    return prisma.$transaction(async (tx) => {
      const oldStatus = item.fulfillmentItem.status;

      await tx.fulfillmentItem.update({
        where: { id: input.fulfillmentItemId },
        data: {
          status: "IN_TRANSIT_TO_WAREHOUSE",
          departedAt: new Date(),
        },
      });

      await tx.fulfillmentStatusHistory.create({
        data: {
          fulfillmentItemId: input.fulfillmentItemId,
          fromStatus: oldStatus as FulfillmentStatus,
          toStatus: "IN_TRANSIT_TO_WAREHOUSE",
          changedById: input.departedById,
          note: input.notes || "غادر مع السائق نحو المستودع",
        },
      });

      // مزامنة Order
      const orderItem = await tx.fulfillmentItem.findUnique({
        where: { id: input.fulfillmentItemId },
        select: { orderItemId: true },
      });
      if (orderItem) {
        const { FulfillmentService } = await import("@/services/fulfillment.service");
        await FulfillmentService.syncOrderFulfillmentStatus(
          tx,
          orderItem.orderItemId
        );
      }

      // Audit
      await AuditService.logInTransaction(tx, {
        userId: input.departedById,
        action: "COLLECTION_DEPART",
        entity: "FulfillmentItem",
        entityId: input.fulfillmentItemId,
        oldData: { status: "COLLECTED" },
        newData: { status: "IN_TRANSIT_TO_WAREHOUSE" },
      });

      return { success: true };
    });
  },

  // ═══════════════════════════════════════════
  // إكمال التكليف (IN_PROGRESS → COMPLETED)
  // ═══════════════════════════════════════════
  async complete(assignmentId: number, completedById: number) {
    const assignment = await prisma.collectionAssignment.findUnique({
      where: { id: assignmentId },
      include: { items: true },
    });

    if (!assignment) {
      throw new Error("التكليف غير موجود");
    }

    if (assignment.status !== "IN_PROGRESS") {
      throw new Error(
        `لا يمكن إكمال تكليف بحالة ${assignment.status}`
      );
    }

    // ═══ هل تم جمع كل العناصر؟ ═══
    const uncollected = assignment.items.filter(
      (i) => !i.collectedAt
    );

    if (uncollected.length > 0) {
      throw new Error(
        `يوجد ${uncollected.length} عنصر لم يتم جمعه بعد`
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.collectionAssignment.update({
        where: { id: assignmentId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      await AuditService.logInTransaction(tx, {
        userId: completedById,
        action: "COLLECTION_PICKUP",
        entity: "CollectionAssignment",
        entityId: assignmentId,
        oldData: { status: "IN_PROGRESS" },
        newData: {
          status: "COMPLETED",
          itemsCount: assignment.items.length,
        },
      });

      return updated;
    });
  },

  // ═══════════════════════════════════════════
  // إلغاء التكليف
  // ═══════════════════════════════════════════
  async cancel(
    assignmentId: number,
    cancelledById: number,
    reason: string
  ) {
    if (!reason || reason.trim().length < 3) {
      throw new Error("سبب الإلغاء مطلوب");
    }

    const assignment = await prisma.collectionAssignment.findUnique({
      where: { id: assignmentId },
      include: { items: true },
    });

    if (!assignment) {
      throw new Error("التكليف غير موجود");
    }

    if (["COMPLETED", "CANCELLED"].includes(assignment.status)) {
      throw new Error(
        `لا يمكن إلغاء تكليف بحالة ${assignment.status}`
      );
    }

    // ═══ لا يمكن الإلغاء إذا كانت العناصر قد جُمعت ═══
    const collected = assignment.items.filter((i) => i.collectedAt);
    if (collected.length > 0) {
      throw new Error(
        `لا يمكن إلغاء التكليف — ${collected.length} عنصر تم جمعه`
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.collectionAssignment.update({
        where: { id: assignmentId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: reason.trim(),
        },
      });

      await AuditService.logInTransaction(tx, {
        userId: cancelledById,
        action: "UPDATE",
        entity: "CollectionAssignment",
        entityId: assignmentId,
        oldData: { status: assignment.status },
        newData: {
          status: "CANCELLED",
          reason: reason.trim(),
        },
      });

      return updated;
    });
  },

  // ═══════════════════════════════════════════
  // إحصائيات
  // ═══════════════════════════════════════════
  async getStats() {
    const [pending, assigned, inProgress, completed, cancelled] =
      await Promise.all([
        prisma.collectionAssignment.count({
          where: { status: "PENDING" },
        }),
        prisma.collectionAssignment.count({
          where: { status: "ASSIGNED" },
        }),
        prisma.collectionAssignment.count({
          where: { status: "IN_PROGRESS" },
        }),
        prisma.collectionAssignment.count({
          where: { status: "COMPLETED" },
        }),
        prisma.collectionAssignment.count({
          where: { status: "CANCELLED" },
        }),
      ]);

    return {
      pending,
      assigned,
      inProgress,
      completed,
      cancelled,
      totalActive: pending + assigned + inProgress,
    };
  },
};