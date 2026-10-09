import { prisma } from "@/lib/prisma";
import { AuditService } from "@/services/audit.service";
import { FulfillmentService } from "@/services/fulfillment.service";
import { ShipmentQRService } from "@/services/shipment-qr.service";
import { FulfillmentStatus } from "@/app/generated/prisma/enums";

type CreateFromFulfillmentInput = {
  fulfillmentItemIds: number[];
  createdById: number;
  notes?: string | null;
};

type AssignDeliveryInput = {
  shipmentId: number;
  deliveryPersonId: number;
  assignedById: number;
  notes?: string | null;
};

export const ShipmentService = {
  async generateShipmentNumber(tx: any): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SH-${year}-`;

    const last = await tx.shipment.findFirst({
      where: { shipmentNumber: { startsWith: prefix } },
      orderBy: { shipmentNumber: "desc" },
      select: { shipmentNumber: true },
    });

    let next = 1;
    if (last) {
      const parts = last.shipmentNumber.split("-");
      const lastNum = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastNum)) next = lastNum + 1;
    }

    return `${prefix}${String(next).padStart(5, "0")}`;
  },

  async createFromFulfillmentItems(input: CreateFromFulfillmentInput) {
    if (!input.fulfillmentItemIds || input.fulfillmentItemIds.length === 0) {
      throw new Error("يجب اختيار عنصر واحد على الأقل");
    }

    const items = await prisma.fulfillmentItem.findMany({
      where: { id: { in: input.fulfillmentItemIds } },
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
                total: true,
                items: { select: { id: true, total: true } },
              },
            },
          },
        },
      },
    });

    if (items.length !== input.fulfillmentItemIds.length) {
      throw new Error("بعض عناصر التجهيز غير موجودة");
    }

    const invalidStatus = items.find(
      (i) => i.status !== "AVAILABLE_FOR_SHIPMENT"
    );
    if (invalidStatus) {
      throw new Error(
        `العنصر #${invalidStatus.id} ليس متاحاً للشحن (حالته: ${invalidStatus.status})`
      );
    }

    const existingShipmentItems = await prisma.shipmentItem.findMany({
      where: {
        fulfillmentItemId: { in: input.fulfillmentItemIds },
        shipment: {
          status: { notIn: ["CANCELLED", "RETURNED"] },
        },
      },
      select: { fulfillmentItemId: true },
    });

    if (existingShipmentItems.length > 0) {
      const ids = existingShipmentItems
        .map((s) => s.fulfillmentItemId)
        .join(", ");
      throw new Error(`العناصر التالية في شحنة نشطة: ${ids}`);
    }

    const customerIds = new Set(
      items.map((i) => i.orderItem.order.userId)
    );
    if (customerIds.size !== 1) {
      throw new Error(
        `لا يمكن تجميع عناصر من عملاء مختلفين (${customerIds.size} عملاء)`
      );
    }

    const customerId = items[0].orderItem.order.userId;

    for (const item of items) {
      const order = item.orderItem.order;
      if (!["NEW", "PROCESSING", "SHIPPED"].includes(order.status)) {
        throw new Error(
          `الطلب ${order.orderNumber} في حالة غير قابلة للشحن: ${order.status}`
        );
      }
    }

    const orderItemMap = new Map<
      number,
      {
        orderItemId: number;
        orderId: number;
        orderTotal: number;
        orderItemsTotal: number;
        itemTotal: number;
        quantity: number;
      }
    >();

    for (const item of items) {
      if (orderItemMap.has(item.orderItemId)) continue;

      const order = item.orderItem.order;
      const orderItemsTotal = order.items.reduce(
        (s, i) => s + Number(i.total),
        0
      );

      orderItemMap.set(item.orderItemId, {
        orderItemId: item.orderItemId,
        orderId: order.id,
        orderTotal: Number(order.total),
        orderItemsTotal,
        itemTotal: Number(item.orderItem.total),
        quantity: item.orderItem.quantity,
      });
    }

    let totalCOD = 0;
    const codByFulfillmentItem = new Map<number, number>();

    for (const item of items) {
      const orderItem = orderItemMap.get(item.orderItemId)!;
      const itemRatio =
        orderItem.orderItemsTotal > 0
          ? orderItem.itemTotal / orderItem.orderItemsTotal
          : 0;
      const totalForThisItem = orderItem.orderTotal * itemRatio;
      const perUnit = totalForThisItem / orderItem.quantity;
      const cod = Math.round(perUnit * item.quantity * 100) / 100;

      codByFulfillmentItem.set(item.id, cod);
      totalCOD += cod;
    }

    totalCOD = Math.round(totalCOD * 100) / 100;

    const uniqueOrders = new Set(items.map((i) => i.orderItem.orderId));

    const rawToken = ShipmentQRService.generateToken();
    const tokenHash = ShipmentQRService.hashToken(rawToken);
    const tokenEncrypted = ShipmentQRService.encryptToken(rawToken);
    const tokenPreview = ShipmentQRService.preview(rawToken);

    const shipment = await prisma.$transaction(
      async (tx) => {
        const shipmentNumber = await this.generateShipmentNumber(tx);

        const newShipment = await tx.shipment.create({
          data: {
            shipmentNumber,
            qrTokenHash: tokenHash,
            qrTokenEncrypted: tokenEncrypted,
            qrTokenPreview: tokenPreview,
            status: "READY",
            createdById: input.createdById,
            packedById: input.createdById,
            customerId,
            totalCOD,
            totalOrders: uniqueOrders.size,
            notes: input.notes || null,
          },
        });

        for (const item of items) {
          const cod = codByFulfillmentItem.get(item.id) ?? 0;
          const orderItem = item.orderItem;

          await tx.shipmentItem.create({
            data: {
              shipmentId: newShipment.id,
              orderId: orderItem.orderId,
              orderItemId: orderItem.id,
              fulfillmentItemId: item.id,
              productId: orderItem.productId,
              variantId: orderItem.variantId,
              sellerId: item.sellerId,
              quantity: item.quantity,
              codAmount: cod,
            },
          });

          const oldStatus = item.status;

          await tx.fulfillmentItem.update({
            where: { id: item.id },
            data: { status: "ALLOCATED" },
          });

          await tx.fulfillmentStatusHistory.create({
            data: {
              fulfillmentItemId: item.id,
              fromStatus: oldStatus as FulfillmentStatus,
              toStatus: "ALLOCATED",
              changedById: input.createdById,
              note: `أُضيف إلى الشحنة ${shipmentNumber}`,
            },
          });
        }

        const affectedOrderIds = [
          ...new Set(items.map((i) => i.orderItem.orderId)),
        ];
        for (const orderId of affectedOrderIds) {
          const orderItems = await tx.orderItem.findMany({
            where: { orderId },
            select: { id: true },
          });
          for (const oi of orderItems) {
            await FulfillmentService.syncOrderFulfillmentStatus(tx, oi.id);
          }
        }

        await AuditService.logInTransaction(tx, {
          userId: input.createdById,
          action: "SHIPMENT_CREATE",
          entity: "Shipment",
          entityId: newShipment.id,
          newData: {
            shipmentNumber,
            customerId,
            itemsCount: items.length,
            ordersCount: uniqueOrders.size,
            totalCOD,
            sellerIds: [...new Set(items.map((i) => i.sellerId))],
          },
        });

        return newShipment;
      },
      { timeout: 30000 }
    );

    return { shipment, rawToken };
  },async getById(shipmentId: number) {
    return prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        deliveryPerson: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
        items: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                source: true,
                userId: true,
                customerSnapshot: true,
                shippingAddressSnapshot: true,
              },
            },
            orderItem: {
              select: {
                id: true,
                productName: true,
                variantName: true,
                sku: true,
                imageUrl: true,
                quantity: true,
                unitPrice: true,
              },
            },
            fulfillmentItem: {
              select: {
                id: true,
                status: true,
                sellerId: true,
                seller: { select: { id: true, storeName: true } },
              },
            },
          },
        },
        deliveryAssignments: {
          include: {
            deliveryPerson: {
              include: {
                user: { select: { id: true, name: true, phone: true } },
              },
            },
          },
          orderBy: { assignedAt: "desc" },
        },
      },
    });
  },

  async listAll(filters?: { status?: string | string[] }) {
    const where: any = {};

    if (filters?.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    return prisma.shipment.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        deliveryPerson: {
          include: {
            user: { select: { name: true, phone: true } },
          },
        },
        items: {
          select: { id: true, orderId: true, quantity: true },
        },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  async assignDelivery(input: AssignDeliveryInput) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: input.shipmentId },
      select: { id: true, status: true, shipmentNumber: true },
    });

    if (!shipment) {
      throw new Error("الشحنة غير موجودة");
    }

    if (["DELIVERED", "CANCELLED", "RETURNED"].includes(shipment.status)) {
      throw new Error(
        `لا يمكن إسناد شحنة بحالة ${shipment.status}`
      );
    }

    const person = await prisma.deliveryPerson.findUnique({
      where: { id: input.deliveryPersonId },
      select: { id: true, status: true, deletedAt: true, city: true },
    });

    if (!person || person.deletedAt || person.status !== "ACTIVE") {
      throw new Error("السائق غير نشط أو غير موجود");
    }

    return prisma.$transaction(
      async (tx) => {
        const currentAssignments = await tx.deliveryAssignment.findMany({
          where: {
            shipmentId: input.shipmentId,
            status: { in: ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"] },
          },
          select: { id: true, deliveryPersonId: true },
        });

        let reassignedFromId: number | null = null;

        for (const ca of currentAssignments) {
          if (ca.deliveryPersonId === input.deliveryPersonId) {
            return { shipment, assignmentId: ca.id };
          }

          await tx.deliveryAssignment.update({
            where: { id: ca.id },
            data: {
              status: "REASSIGNED",
              cancelledAt: new Date(),
              cancelReason: "إعادة إسناد لسائق آخر",
            },
          });

          reassignedFromId = ca.id;
        }

        const assignment = await tx.deliveryAssignment.create({
          data: {
            shipmentId: input.shipmentId,
            deliveryPersonId: input.deliveryPersonId,
            assignedById: input.assignedById,
            status: "ASSIGNED",
            reassignedFromId,
            notes: input.notes || null,
          },
        });

        await tx.shipment.update({
          where: { id: input.shipmentId },
          data: {
            status: "ASSIGNED",
            deliveryPersonId: input.deliveryPersonId,
            assignedAt: new Date(),
            assignedById: input.assignedById,
          },
        });

        await AuditService.logInTransaction(tx, {
          userId: input.assignedById,
          action: "DELIVERY_ASSIGN",
          entity: "DeliveryAssignment",
          entityId: assignment.id,
          newData: {
            shipmentId: input.shipmentId,
            shipmentNumber: shipment.shipmentNumber,
            deliveryPersonId: input.deliveryPersonId,
          },
        });

        return { shipment, assignmentId: assignment.id };
      },
      { timeout: 15000 }
    );
  },

  async removeItem(
    shipmentId: number,
    shipmentItemId: number,
    removedById: number,
    reason?: string
  ) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, status: true, shipmentNumber: true },
    });

    if (!shipment) {
      throw new Error("الشحنة غير موجودة");
    }

    if (shipment.status !== "DRAFT") {
      throw new Error(
        "يمكن إزالة العناصر فقط من شحنة بحالة DRAFT"
      );
    }

    const item = await prisma.shipmentItem.findFirst({
      where: { id: shipmentItemId, shipmentId },
      include: { fulfillmentItem: true },
    });

    if (!item) {
      throw new Error("العنصر غير موجود في هذه الشحنة");
    }

    return prisma.$transaction(async (tx) => {
      await tx.shipmentItem.delete({
        where: { id: shipmentItemId },
      });

      if (item.fulfillmentItem) {
        const oldStatus = item.fulfillmentItem.status;

        await tx.fulfillmentItem.update({
          where: { id: item.fulfillmentItemId! },
          data: { status: "AVAILABLE_FOR_SHIPMENT" },
        });

        await tx.fulfillmentStatusHistory.create({
          data: {
            fulfillmentItemId: item.fulfillmentItemId!,
            fromStatus: oldStatus as FulfillmentStatus,
            toStatus: "AVAILABLE_FOR_SHIPMENT",
            changedById: removedById,
            note: reason || "أُزيل من الشحنة",
          },
        });
      }

      const remaining = await tx.shipmentItem.findMany({
        where: { shipmentId },
        select: { codAmount: true, orderId: true },
      });

      const newTotalCOD =
        Math.round(
          remaining.reduce((s, i) => s + Number(i.codAmount), 0) * 100
        ) / 100;
      const newTotalOrders = new Set(remaining.map((i) => i.orderId)).size;

      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          totalCOD: newTotalCOD,
          totalOrders: newTotalOrders,
        },
      });

      await AuditService.logInTransaction(tx, {
        userId: removedById,
        action: "SHIPMENT_ITEM_REMOVE",
        entity: "ShipmentItem",
        entityId: shipmentItemId,
        oldData: {
          shipmentId,
          orderId: item.orderId,
          quantity: item.quantity,
        },
        newData: { reason: reason || null },
      });

      return { success: true };
    });
  },async deleteDraft(shipmentId: number, deletedById: number) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { items: true },
    });

    if (!shipment) {
      throw new Error("الشحنة غير موجودة");
    }

    if (shipment.status !== "DRAFT") {
      throw new Error(
        "يمكن حذف الشحنات التي في حالة DRAFT فقط. يمكنك إلغاؤها بدلاً من ذلك."
      );
    }

    return prisma.$transaction(async (tx) => {
      for (const item of shipment.items) {
        if (!item.fulfillmentItemId) continue;

        await tx.fulfillmentItem.update({
          where: { id: item.fulfillmentItemId },
          data: { status: "AVAILABLE_FOR_SHIPMENT" },
        });
      }

      await tx.shipmentItem.deleteMany({ where: { shipmentId } });

      await tx.shipment.delete({ where: { id: shipmentId } });

      await AuditService.logInTransaction(tx, {
        userId: deletedById,
        action: "DELETE",
        entity: "Shipment",
        entityId: shipmentId,
        oldData: {
          shipmentNumber: shipment.shipmentNumber,
          itemsCount: shipment.items.length,
        },
      });

      return { success: true };
    });
  },

  async cancel(
    shipmentId: number,
    cancelledById: number,
    reason: string
  ) {
    if (!reason || reason.trim().length < 3) {
      throw new Error("سبب الإلغاء مطلوب");
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, status: true, shipmentNumber: true },
    });

    if (!shipment) {
      throw new Error("الشحنة غير موجودة");
    }

    if (["DELIVERED", "CANCELLED", "RETURNED"].includes(shipment.status)) {
      throw new Error(
        `لا يمكن إلغاء شحنة بحالة ${shipment.status}`
      );
    }

    return prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: "CANCELLED" },
      });

      const items = await tx.shipmentItem.findMany({
        where: { shipmentId },
        select: { fulfillmentItemId: true },
      });

      for (const item of items) {
        if (!item.fulfillmentItemId) continue;

        await tx.fulfillmentItem.update({
          where: { id: item.fulfillmentItemId },
          data: { status: "AVAILABLE_FOR_SHIPMENT" },
        });
      }

      await tx.deliveryAssignment.updateMany({
        where: {
          shipmentId,
          status: { in: ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"] },
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: reason.trim(),
        },
      });

      await AuditService.logInTransaction(tx, {
        userId: cancelledById,
        action: "UPDATE",
        entity: "Shipment",
        entityId: shipmentId,
        oldData: { status: shipment.status },
        newData: { status: "CANCELLED", reason: reason.trim() },
      });

      return { success: true };
    });
  },

  async regenerateQR(shipmentId: number, performedById: number) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, shipmentNumber: true, status: true },
    });

    if (!shipment) {
      throw new Error("الشحنة غير موجودة");
    }

    if (["DELIVERED", "CANCELLED", "RETURNED"].includes(shipment.status)) {
      throw new Error(
        `لا يمكن إعادة توليد QR لشحنة بحالة ${shipment.status}`
      );
    }

    const result = await ShipmentQRService.regenerateToken(shipmentId);

    await AuditService.log({
      userId: performedById,
      action: "SHIPMENT_UPDATE",
      entity: "Shipment",
      entityId: shipmentId,
      newData: {
        action: "regenerate_qr",
        shipmentNumber: shipment.shipmentNumber,
      },
    });

    return result;
  },

  async getStats() {
    const [
      draft,
      ready,
      assigned,
      outForDelivery,
      delivered,
      returned,
      cancelled,
    ] = await Promise.all([
      prisma.shipment.count({ where: { status: "DRAFT" } }),
      prisma.shipment.count({ where: { status: "READY" } }),
      prisma.shipment.count({ where: { status: "ASSIGNED" } }),
      prisma.shipment.count({
        where: { status: { in: ["PICKED_UP", "OUT_FOR_DELIVERY", "IN_TRANSIT"] } },
      }),
      prisma.shipment.count({ where: { status: "DELIVERED" } }),
      prisma.shipment.count({ where: { status: "RETURNED" } }),
      prisma.shipment.count({ where: { status: "CANCELLED" } }),
    ]);

    return {
      draft,
      ready,
      assigned,
      outForDelivery,
      delivered,
      returned,
      cancelled,
      totalActive: ready + assigned + outForDelivery,
    };
  },
};