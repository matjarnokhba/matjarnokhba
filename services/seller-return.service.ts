import { prisma } from "@/lib/prisma";
import { ShipmentQRService } from "./shipment-qr.service";

export const SellerReturnService = {
  // ═══════ جلب التجار الذين لديهم مرتجعات في المستودع ═══════
  async getPendingBySeller() {
    const items = await prisma.shipmentItem.findMany({
      where: {
        refusedQuantity: { gt: 0 },
        returnedToWarehouseAt: { not: null },
        sellerReturnItem: null,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            sellerId: true,
            seller: { select: { id: true, storeName: true, city: true } },
          },
        },
        orderItem: {
          select: { productName: true, variantName: true, imageUrl: true },
        },
      },
    });

    const sellerMap = new Map<
      number,
      {
        sellerId: number;
        storeName: string;
        city: string | null;
        totalQuantity: number;
        itemsCount: number;
        items: Array<{
          shipmentItemId: number;
          orderNumber: string;
          productName: string;
          variantName: string | null;
          imageUrl: string | null;
          quantity: number;
        }>;
      }
    >();

    for (const item of items) {
      const seller = item.order.seller;
      if (!seller) continue;

      if (!sellerMap.has(seller.id)) {
        sellerMap.set(seller.id, {
          sellerId: seller.id,
          storeName: seller.storeName,
          city: seller.city,
          totalQuantity: 0,
          itemsCount: 0,
          items: [],
        });
      }

      const entry = sellerMap.get(seller.id)!;
      entry.totalQuantity += item.refusedQuantity;
      entry.itemsCount += 1;
      entry.items.push({
        shipmentItemId: item.id,
        orderNumber: item.order.orderNumber,
        productName: item.orderItem.productName,
        variantName: item.orderItem.variantName,
        imageUrl: item.orderItem.imageUrl,
        quantity: item.refusedQuantity,
      });
    }

    return Array.from(sellerMap.values());
  },

  // ═══════ إنشاء دفعة إرجاع للتاجر ═══════
  async createBatch(sellerId: number, warehouseUserId: number) {
    const pendingItems = await prisma.shipmentItem.findMany({
      where: {
        refusedQuantity: { gt: 0 },
        returnedToWarehouseAt: { not: null },
        sellerReturnItem: null,
        order: { sellerId },
      },
    });

    if (pendingItems.length === 0) {
      throw new Error("لا توجد مرتجعات معلّقة لهذا التاجر");
    }

    const rawToken = ShipmentQRService.generateToken();
    const hash = ShipmentQRService.hashToken(rawToken);
    const encrypted = ShipmentQRService.encryptToken(rawToken);

    const year = new Date().getFullYear();
    const count = await prisma.sellerReturnBatch.count({
      where: { batchNumber: { startsWith: `SRB-${year}-` } },
    });
    const batchNumber = `SRB-${year}-${String(count + 1).padStart(5, "0")}`;

    const totalQuantity = pendingItems.reduce(
      (s, i) => s + i.refusedQuantity,
      0
    );

    const batch = await prisma.sellerReturnBatch.create({
      data: {
        batchNumber,
        sellerId,
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
      batchNumber: batch.batchNumber,
      qrToken: rawToken,
      totalQuantity: batch.totalQuantity,
      itemsCount: batch.itemsCount,
    };
  },

  // ═══════ الجامع يستلم من المستودع ═══════
  async pickupByCollector(rawToken: string, collectorUserId: number) {
    const hash = ShipmentQRService.hashToken(rawToken);

    const batch = await prisma.sellerReturnBatch.findUnique({
      where: { qrTokenHash: hash },
      include: { seller: { select: { storeName: true } } },
    });

    if (!batch) throw new Error("رمز QR غير صالح");
    if (batch.status !== "PENDING")
      throw new Error("هذه الدفعة تمت معالجتها بالفعل");

    // جلب سجل الجامع
    const collector = await prisma.user.findUnique({
      where: { id: collectorUserId },
      select: { id: true, role: true },
    });

    if (
      !collector ||
      !["COLLECTOR", "WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(
        collector.role
      )
    ) {
      throw new Error("غير مصرح لك باستلام الدفعات");
    }

    await prisma.sellerReturnBatch.update({
      where: { id: batch.id },
      data: {
        status: "PICKED_UP",
        pickedUpAt: new Date(),
        collectorId: collectorUserId,
      },
    });

    return {
      batchNumber: batch.batchNumber,
      storeName: batch.seller.storeName,
      totalQuantity: batch.totalQuantity,
    };
  },

  // ═══════ التاجر يؤكد الاستلام ═══════
  async confirmBySeller(rawToken: string, sellerUserId: number) {
    const hash = ShipmentQRService.hashToken(rawToken);

    const batch = await prisma.sellerReturnBatch.findUnique({
      where: { qrTokenHash: hash },
      include: {
        seller: { select: { id: true, userId: true } },
        items: {
          include: {
            shipmentItem: {
              include: { order: { select: { orderNumber: true } } },
            },
          },
        },
      },
    });

    if (!batch) throw new Error("رمز QR غير صالح");
    if (batch.seller.userId !== sellerUserId)
      throw new Error("هذه الدفعة ليست لك");
    if (!["PENDING", "PICKED_UP"].includes(batch.status))
      throw new Error("هذه الدفعة تمت معالجتها بالفعل");

    const { InventoryService } = await import("@/services/inventory.service");
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // 1. إرجاع المخزون للتاجر
      for (const item of batch.items) {
        if (item.shipmentItem.variantId) {
          await InventoryService.returnStock(
            tx,
            item.shipmentItem.variantId,
            item.quantity,
            batch.id,
            `تأكيد استلام مرتجع - دفعة ${batch.batchNumber}`,
            "RETURN"
          );
        }
      }

      // 2. تحديث حالة الدفعة
      await tx.sellerReturnBatch.update({
        where: { id: batch.id },
        data: {
          status: "CONFIRMED",
          confirmedAt: now,
          ...(batch.status === "PENDING" && { pickedUpAt: now }),
        },
      });

      // 3. إشعار المستودع
      const admins = await tx.user.findMany({
        where: {
          role: { in: ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"] },
          deletedAt: null,
        },
        select: { id: true },
      });
      for (const a of admins) {
        await tx.notification.create({
          data: {
            userId: a.id,
            type: "ORDER_STATUS_CHANGED",
            title: "✅ التاجر استلم المرتجعات",
            message: `التاجر استلم الدفعة ${batch.batchNumber} (${batch.totalQuantity} منتج)`,
            link: `/warehouse/seller-returns`,
            category: "ORDER",
            severity: "INFO",
          },
        });
      }
    });

    return {
      batchNumber: batch.batchNumber,
      totalQuantity: batch.totalQuantity,
    };
  },

  // ═══════ التاجر يرى دفعاته ═══════
  async getBySeller(sellerUserId: number) {
    const seller = await prisma.seller.findFirst({
      where: { userId: sellerUserId },
      select: { id: true },
    });
    if (!seller) return [];

    return prisma.sellerReturnBatch.findMany({
      where: {
        sellerId: seller.id,
        status: { in: ["PENDING", "PICKED_UP"] },
      },
      include: {
        items: {
          include: {
            shipmentItem: {
              include: {
                order: { select: { orderNumber: true } },
                orderItem: {
                  select: { productName: true, variantName: true, imageUrl: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};