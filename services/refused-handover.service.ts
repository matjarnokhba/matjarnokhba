import { prisma } from "@/lib/prisma";
import { ShipmentQRService } from "./shipment-qr.service";
import { updateDriverBlockStatus } from "./wallet.service";

export const RefusedHandoverService = {
  // ═══════ جلب السائقين الذين لديهم مرتجعات معلقة ═══════
  async getPendingDrivers(warehouseUserId: number) {
    const items = await prisma.shipmentItem.findMany({
      where: {
        refusedQuantity: { gt: 0 },
        returnedToWarehouseAt: null,
        shipment: {
          deliveryPersonId: { not: null },
          status: { in: ["DELIVERED", "PARTIALLY_DELIVERED", "REFUSED"] },
        },
      },
      include: {
        shipment: {
          select: {
            id: true,
            shipmentNumber: true,
            deliveryPersonId: true,
            deliveryPerson: {
              select: {
                id: true,
                user: { select: { name: true, phone: true } },
              },
            },
          },
        },
        orderItem: {
          select: { productName: true, variantName: true, imageUrl: true },
        },
      },
    });

    // تجميع حسب السائق
    const driverMap = new Map<
      number,
      {
        driverId: number;
        driverName: string;
        driverPhone: string | null;
        totalQuantity: number;
        itemsCount: number;
        items: Array<{
          shipmentItemId: number;
          shipmentNumber: string;
          productName: string;
          variantName: string | null;
          imageUrl: string | null;
          refusedQuantity: number;
          refusedReason: string | null;
        }>;
      }
    >();

    for (const item of items) {
      const driver = item.shipment.deliveryPerson;
      if (!driver) continue;
      const driverId = driver.id;

      if (!driverMap.has(driverId)) {
        driverMap.set(driverId, {
          driverId,
          driverName: driver.user.name,
          driverPhone: driver.user.phone,
          totalQuantity: 0,
          itemsCount: 0,
          items: [],
        });
      }

      const entry = driverMap.get(driverId)!;
      entry.totalQuantity += item.refusedQuantity;
      entry.itemsCount += 1;
      entry.items.push({
        shipmentItemId: item.id,
        shipmentNumber: item.shipment.shipmentNumber,
        productName: item.orderItem.productName,
        variantName: item.orderItem.variantName,
        imageUrl: item.orderItem.imageUrl,
        refusedQuantity: item.refusedQuantity,
        refusedReason: item.refusedReason,
      });
    }

    return Array.from(driverMap.values());
  },

  // ═══════ إنشاء دفعة استلام (QR) ═══════
  async createHandoverBatch(driverId: number, warehouseUserId: number) {
    const pendingItems = await prisma.shipmentItem.findMany({
      where: {
        refusedQuantity: { gt: 0 },
        returnedToWarehouseAt: null,
        refusedHandoverItem: null,
        shipment: {
          deliveryPersonId: driverId,
          status: { in: ["DELIVERED", "PARTIALLY_DELIVERED", "REFUSED"] },
        },
      },
    });

    if (pendingItems.length === 0) {
      throw new Error("لا توجد منتجات مرفوضة معلّقة لهذا السائق");
    }

    const rawToken = ShipmentQRService.generateToken();
    const hash = ShipmentQRService.hashToken(rawToken);
    const encrypted = ShipmentQRService.encryptToken(rawToken);

    const year = new Date().getFullYear();
    const count = await prisma.refusedHandoverBatch.count({
      where: { batchCode: { startsWith: `RHB-${year}-` } },
    });
    const batchCode = `RHB-${year}-${String(count + 1).padStart(5, "0")}`;

    const totalQuantity = pendingItems.reduce(
      (s, i) => s + i.refusedQuantity,
      0
    );

    const batch = await prisma.refusedHandoverBatch.create({
      data: {
        batchCode,
        driverId,
        warehouseId: warehouseUserId,
        status: "PENDING",
        qrTokenHash: hash,
        qrTokenEnc: encrypted,
        totalQuantity,
        itemsCount: pendingItems.length,
        items: {
          create: pendingItems.map((i) => ({
            shipmentItemId: i.id,
            quantity: i.refusedQuantity,
          })),
        },
      },
    });

    return {
      batchId: batch.id,
      batchCode: batch.batchCode,
      qrToken: rawToken,
      totalQuantity: batch.totalQuantity,
      itemsCount: batch.itemsCount,
    };
  },

  // ═══════ السائق يمسح QR للتأكيد ═══════
  async confirmHandover(rawToken: string, driverUserId: number) {
    const hash = ShipmentQRService.hashToken(rawToken);

    const batch = await prisma.refusedHandoverBatch.findUnique({
      where: { qrTokenHash: hash },
      include: {
        driver: { select: { id: true, userId: true } },
        items: {
          include: {
            shipmentItem: {
              include: {
                order: { select: { id: true, orderNumber: true, sellerId: true } },
              },
            },
          },
        },
      },
    });

    if (!batch) throw new Error("رمز QR غير صالح");
    if (batch.status !== "PENDING")
      throw new Error("هذه الدفعة تمت معالجتها بالفعل");
    if (batch.driver.userId !== driverUserId)
      throw new Error("هذه الدفعة ليست لك");

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      // 1. تحديث كل ShipmentItem → returnedToWarehouseAt
      for (const item of batch.items) {
        await tx.shipmentItem.update({
          where: { id: item.shipmentItemId },
          data: { returnedToWarehouseAt: now },
        });
      }

      // 2. حالة الدفعة → COMPLETED
      await tx.refusedHandoverBatch.update({
        where: { id: batch.id },
        data: { status: "COMPLETED", completedAt: now },
      });

      // 3. تحديث حظر السائق
      await updateDriverBlockStatus(tx, batch.driverId);
    });

    return {
      batchCode: batch.batchCode,
      totalQuantity: batch.totalQuantity,
      itemsCount: batch.itemsCount,
    };
  },
};