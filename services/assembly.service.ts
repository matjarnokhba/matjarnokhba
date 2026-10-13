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
  // ═══════ إنشاء Assembly File لطلب (Lazy) ═══════
  async ensureForOrder(tx: any, orderId: number) {
    const existing = await tx.assemblyFile.findUnique({
      where: { orderId },
      select: { id: true },
    });
    if (existing) return existing;

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        shippingAddressSnapshot: true,
        items: {
          select: {
            quantity: true,
            fulfillmentItems: {
              select: { id: true, quantity: true },
            },
          },
        },
      },
    });
    if (!order) throw new Error("Order not found");

    const addr = (order.shippingAddressSnapshot || {}) as any;
    const expectedItems = order.items.reduce(
      (s: number, i: any) => s + i.quantity,
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
        orderId: order.id,
        userId: order.userId,
        status: "PENDING",
        expectedItems,
        deliveryCity: addr.city || null,
        deliveryDistrict: addr.district || null,
      },
    });

    // AssemblyItems
    const allFIs = order.items.flatMap((i: any) => i.fulfillmentItems);
    for (const fi of allFIs) {
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
        // Update receivedAt (idempotent)
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
};