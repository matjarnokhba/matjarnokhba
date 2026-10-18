import { prisma } from "@/lib/prisma";

const RECEIVED_STATUSES = [
  "RECEIVED",
  "VERIFIED",
  "AVAILABLE_FOR_SHIPMENT",
  "ALLOCATED",
  "SHIPPED",
  "DELIVERED",
];

const SHIPPED_STATUSES = ["ALLOCATED", "SHIPPED", "DELIVERED"];

export const AssemblyService = {
  // ═══════ إنشاء Assembly File لعميل (Lazy) ═══════
  async ensureForUser(tx: any, userId: number) {
    const existing = await tx.assemblyFile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) return existing;

    // ═══ كل عناصر الـfulfillment للعميل (كل طلباته) ═══
    const fulfillmentItems = await tx.fulfillmentItem.findMany({
      where: {
        orderItem: {
          order: {
            userId,
            status: { notIn: ["CANCELLED"] },
          },
        },
      },
      select: {
        id: true,
        quantity: true,
        orderItem: {
          select: {
            order: {
              select: {
                shippingAddressSnapshot: true,
              },
            },
          },
        },
      },
    });

    if (fulfillmentItems.length === 0) return null;

    // ═══ العنوان من أحدث طلب ═══
    const addr = (fulfillmentItems[0]?.orderItem?.order
      ?.shippingAddressSnapshot || {}) as any;

    const expectedItems = fulfillmentItems.reduce(
      (s: number, fi: any) => s + fi.quantity,
      0
    );

    // assemblyCode
    const year = new Date().getFullYear();
    const count = await tx.assemblyFile.count({
      where: { assemblyCode: { startsWith: `ASM-${year}-` } },
    });
    const assemblyCode = `ASM-${year}-${String(count + 1).padStart(5, "0")}`;

    const assembly = await tx.assemblyFile.create({
      data: {
        assemblyCode,
        userId,
        status: "PENDING",
        expectedItems,
        deliveryCity: addr.city || null,
        deliveryDistrict: addr.district || null,
      },
    });

    for (const fi of fulfillmentItems) {
      await tx.assemblyItem.create({
        data: {
          assemblyId: assembly.id,
          fulfillmentItemId: fi.id,
          expectedQuantity: fi.quantity,
        },
      });
    }

    return assembly;
  },

  // ═══════ إعادة الحساب (Idempotent) ═══════
  async recompute(tx: any, assemblyId: number) {
    const items = await tx.assemblyItem.findMany({
      where: { assemblyId },
      include: {
        fulfillmentItem: {
          select: { status: true, quantity: true },
        },
      },
    });

    let expected = 0;
    let received = 0;
    let shipped = 0;

    for (const item of items) {
      expected += item.expectedQuantity;
      const fiStatus = item.fulfillmentItem.status;

      if (RECEIVED_STATUSES.includes(fiStatus)) {
        received += item.expectedQuantity;
        if (!item.receivedAt) {
          await tx.assemblyItem.update({
            where: { id: item.id },
            data: { receivedAt: new Date() },
          });
        }
      }

      if (
        SHIPPED_STATUSES.includes(fiStatus) ||
        item.includedInShipment
      ) {
        shipped += item.expectedQuantity;
      }
    }

    const allReceived = expected > 0 && received >= expected;
    const allShipped = expected > 0 && shipped >= expected;

    let status: string;
    if (allShipped) status = "COMPLETED";
    else if (allReceived) status = "READY";
    else if (shipped > 0) status = "PARTIALLY_SHIPPED";
    else status = "PENDING";

    const current = await tx.assemblyFile.findUnique({
      where: { id: assemblyId },
      select: { readyAt: true, completedAt: true, status: true },
    });

    const updates: any = {
      expectedItems: expected,
      receivedItems: received,
      shippedItems: shipped,
      status,
    };

    if (status === "READY" && !current?.readyAt) {
      updates.readyAt = new Date();
    }
    if (status === "COMPLETED" && !current?.completedAt) {
      updates.completedAt = new Date();
    }

    await tx.assemblyFile.update({
      where: { id: assemblyId },
      data: updates,
    });

    return { expected, received, shipped, status };
  },

  // ═══════ تعليم عنصر كمُشحَن ═══════
  async markItemShipped(
    tx: any,
    fulfillmentItemId: number,
    shipmentId: number
  ) {
    const ai = await tx.assemblyItem.findUnique({
      where: { fulfillmentItemId },
    });
    if (!ai) return;

    await tx.assemblyItem.update({
      where: { id: ai.id },
      data: { includedInShipment: true, shipmentId },
    });
  },
  // ═══════ فحص اكتمال المسح ═══════
  async checkScanReadiness(tx: any, assemblyId: number) {
    const assembly = await tx.assemblyFile.findUnique({
      where: { id: assemblyId },
      select: {
        userId: true,
        items: {
          select: {
            fulfillmentItem: {
              select: {
                status: true,
                orderItem: {
                  select: {
                    orderId: true,
                    order: {
                      select: {
                        id: true,
                        orderNumber: true,
                        warehouseScannedAt: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!assembly) return null;

    // ═══ تجميع حسب Order ═══
    const orderMap = new Map<
      number,
      {
        id: number;
        orderNumber: string;
        scanned: boolean;
        inWarehouse: boolean;   // VERIFIED/RECEIVED (جاهز أو مستلم)
        inTransit: boolean;     // IN_TRANSIT_TO_WAREHOUSE
        shipped: boolean;       // ALLOCATED/SHIPPED/DELIVERED
        rejected: boolean;      // RETURNED/CANCELLED
        itemStatuses: string[];
      }
    >();

    for (const ai of assembly.items) {
      const o = ai.fulfillmentItem.orderItem.order;
      const status = ai.fulfillmentItem.status;

      if (!orderMap.has(o.id)) {
        orderMap.set(o.id, {
          id: o.id,
          orderNumber: o.orderNumber,
          scanned: !!o.warehouseScannedAt,
          inWarehouse: false,
          inTransit: false,
          shipped: false,
          rejected: false,
          itemStatuses: [],
        });
      }

      const entry = orderMap.get(o.id)!;
      entry.itemStatuses.push(status);

      if (status === "VERIFIED" || status === "RECEIVED" || status === "AVAILABLE_FOR_SHIPMENT") {
        entry.inWarehouse = true;
      }
      if (status === "IN_TRANSIT_TO_WAREHOUSE") {
        entry.inTransit = true;
      }
      if (status === "ALLOCATED" || status === "SHIPPED" || status === "DELIVERED") {
        entry.shipped = true;
      }
      if (status === "RETURNED" || status === "CANCELLED") {
        entry.rejected = true;
      }
    }

    const orders = Array.from(orderMap.values());

    // ═══ الطلبات التي يجب أن تُمسح (في المستودع ولم تُمسح ولم تُشحَن) ═══
    const mustScan = orders.filter(
      (o) => o.inWarehouse && !o.scanned && !o.shipped && !o.rejected
    );

    // ═══ الطلبات في الطريق ═══
    const inTransit = orders.filter((o) => o.inTransit && !o.shipped);

    // ═══ هل يمكن إنشاء شحنة كاملة؟ ═══
    const canShipFull = mustScan.length === 0 && inTransit.length === 0;

    // ═══ هل يمكن إنشاء شحنة جزئية (تجاهل الطلبات في الطريق)؟ ═══
    const canShipPartial = mustScan.length === 0;

    return {
      orders,
      mustScan,
      inTransit,
      canShipFull,
      canShipPartial,
    };
  },
};