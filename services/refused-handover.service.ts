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
    // 1. إلغاء أي دفعات PENDING سابقة
    const existingBatches = await prisma.refusedHandoverBatch.findMany({
      where: { driverId, status: "PENDING" },
      select: { id: true },
    });

    if (existingBatches.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.refusedHandoverItem.deleteMany({
          where: { batchId: { in: existingBatches.map((b) => b.id) } },
        });
        await tx.refusedHandoverBatch.updateMany({
          where: { id: { in: existingBatches.map((b) => b.id) } },
          data: { status: "CANCELLED" },
        });
      });
    }

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

    // فحص: هل السائق موجود ونشط؟
    const driver = await prisma.deliveryPerson.findUnique({
      where: { id: driverId },
      select: { userId: true, status: true, deletedAt: true },
    });
    if (!driver || driver.deletedAt || driver.status !== "ACTIVE") {
      throw new Error("السائق غير نشط أو محذوف");
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

    try {
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

      // إشعار السائق
      try {
        await prisma.notification.create({
          data: {
            userId: driver.userId,
            type: "ORDER_STATUS_CHANGED",
            title: "📦 يجب تسليم المرتجعات",
            message: `المستودع جاهز لاستلام ${totalQuantity} منتج مرفوض منك. امسح QR في صفحة "تسليم مرتجعات".`,
            link: "/delivery/refused-handover",
            category: "ORDER",
            severity: "INFO",
          },
        });
      } catch (notifErr) {
        console.error("Notification failed:", notifErr);
      }

      return {
        batchId: batch.id,
        batchCode: batch.batchCode,
        qrToken: rawToken,
        totalQuantity: batch.totalQuantity,
        itemsCount: batch.itemsCount,
      };
    } catch (e: any) {
      if (e.code === "P2002") {
        throw new Error(
          "تم إنشاء دفعة جديدة للتو. يرجى تحديث الصفحة والمحاولة."
        );
      }
      throw e;
    }
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
              select: {
                id: true,
                returnedToWarehouseAt: true,
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

    // ═══ فحص أمان: لا تعالج عناصر مُعلَّمة مسبقاً ═══
    const alreadyReturned = batch.items.filter(
      (i) => i.shipmentItem.returnedToWarehouseAt !== null
    );
    if (alreadyReturned.length > 0) {
      throw new Error(
        "بعض العناصر تم تسليمها مسبقاً. يرجى التواصل مع المستودع."
      );
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();

      // ═══ تحديث كل ShipmentItem (بشرط أمان) ═══
      for (const item of batch.items) {
        const updated = await tx.shipmentItem.updateMany({
          where: {
            id: item.shipmentItemId,
            returnedToWarehouseAt: null, // ← شرط أمان
          },
          data: { returnedToWarehouseAt: now },
        });
        if (updated.count === 0) {
          throw new Error("تم تعديل أحد العناصر من عملية أخرى. أعد المحاولة.");
        }
      }

      // ═══ حالة الدفعة → COMPLETED ═══
      await tx.refusedHandoverBatch.update({
        where: { id: batch.id },
        data: { status: "COMPLETED", completedAt: now },
      });

      // ═══ تحديث حظر السائق ═══
      await updateDriverBlockStatus(tx, batch.driverId);
    });

    return {
      batchCode: batch.batchCode,
      totalQuantity: batch.totalQuantity,
      itemsCount: batch.itemsCount,
    };
  },
  // ═══════ دفعات نشطة (للمستودع) ═══════
  async getActiveBatches() {
    return prisma.refusedHandoverBatch.findMany({
      where: { status: "PENDING" },
      include: {
        driver: {
          select: {
            id: true,
            user: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  // ═══════ استرجاع QR للطباعة مجدداً ═══════
  async getRawTokenForBatch(batchId: number) {
    const batch = await prisma.refusedHandoverBatch.findUnique({
      where: { id: batchId },
      select: { qrTokenEnc: true, status: true },
    });
    if (!batch || batch.status !== "PENDING") return null;
    try {
      return ShipmentQRService.decryptToken(batch.qrTokenEnc);
    } catch (e) {
      console.error("Failed to decrypt handover token:", e);
      return null;
    }
  },
};