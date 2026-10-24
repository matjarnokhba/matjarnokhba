import { prisma } from "@/lib/prisma";
import { FulfillmentStatus } from "@/app/generated/prisma/enums";
import { updateDriverBlockStatus } from "./wallet.service";

type RefusedOrder = {
  orderId: number;
  reason: string;
};

const PLATFORM_ID = 1;
const WAREHOUSE_ID = 1;

export const PartialDeliveryService = {
  async processPartialDelivery(
    shipmentId: number,
    driverId: number,
    acceptedOrderIds: number[],
    refusedOrders: RefusedOrder[]
  ) {
    return prisma.$transaction(
      async (tx) => {
        const shipment = await tx.shipment.findUnique({
          where: { id: shipmentId },
          include: {
            items: {
              include: {
                order: {
                  select: {
                    id: true,
                    orderNumber: true,
                    total: true,
                    subtotal: true,
                    shippingCost: true,
                    sellerId: true,
                    status: true,
                  },
                },
                orderItem: true,
              },
            },
          },
        });

        if (!shipment) throw new Error("الشحنة غير موجودة");
        if (shipment.deliveryPersonId !== driverId)
          throw new Error("هذه الشحنة ليست مُسندة إليك");
        if (!["OUT_FOR_DELIVERY", "PICKED_UP"].includes(shipment.status)) {
          throw new Error(`لا يمكن تعديل الشحنة في حالتها الحالية: ${shipment.status}`);
        }

        const allOrderIds = Array.from(new Set(shipment.items.map((i) => i.orderId)));
        const acceptedSet = new Set(acceptedOrderIds);
        const refusedSet = new Set(refusedOrders.map((r) => r.orderId));

        for (const id of acceptedSet) {
          if (!allOrderIds.includes(id)) throw new Error(`الطلبية ${id} ليست ضمن هذه الشحنة`);
        }
        for (const r of refusedOrders) {
          if (!allOrderIds.includes(r.orderId))
            throw new Error(`الطلبية ${r.orderId} ليست ضمن هذه الشحنة`);
          if (!r.reason || r.reason.trim().length < 3)
            throw new Error(`سبب رفض الطلبية ${r.orderId} مطلوب`);
        }
        for (const id of allOrderIds) {
          if (!acceptedSet.has(id) && !refusedSet.has(id))
            throw new Error(`يجب تحديد الطلبية ${id}`);
          if (acceptedSet.has(id) && refusedSet.has(id))
            throw new Error(`الطلبية ${id} مكررة`);
        }

        const uniqueAcceptedOrders = new Map<number, any>();
        const uniqueRefusedOrders = new Map<number, any>();
        for (const item of shipment.items) {
          if (acceptedSet.has(item.orderId) && !uniqueAcceptedOrders.has(item.orderId)) {
            uniqueAcceptedOrders.set(item.orderId, item.order);
          }
          if (refusedSet.has(item.orderId) && !uniqueRefusedOrders.has(item.orderId)) {
            uniqueRefusedOrders.set(item.orderId, item.order);
          }
        }

        const acceptedOrders = Array.from(uniqueAcceptedOrders.values());
        const isFullRefusal = acceptedOrders.length === 0;
        const isFullDelivery = refusedOrders.length === 0;

        const COD = acceptedOrders.reduce((s, o) => s + Number(o.total), 0);
        const driverFee = isFullRefusal ? 0 : Number(shipment.driverFee);

        const totalShipping = acceptedOrders.reduce(
          (s, o) => s + Number(o.shippingCost || 0),
          0
        );
        const warehouseProfit = isFullRefusal
          ? 0
          : Math.max(0, totalShipping - driverFee);

        const now = new Date();
        for (const item of shipment.items) {
          if (refusedSet.has(item.orderId)) {
            await tx.shipmentItem.update({
              where: { id: item.id },
              data: {
                refusedAt: now,
                refusedReason:
                  refusedOrders.find((r) => r.orderId === item.orderId)?.reason ||
                  "رفض من الزبون",
              },
            });
            if (item.fulfillmentItemId) {
              await tx.fulfillmentItem.update({
                where: { id: item.fulfillmentItemId },
                data: { status: "RETURNED" as FulfillmentStatus },
              });
            }
          } else {
            if (item.fulfillmentItemId) {
              await tx.fulfillmentItem.update({
                where: { id: item.fulfillmentItemId },
                data: { status: "DELIVERED" as FulfillmentStatus },
              });
            }
          }
        }

        for (const orderId of uniqueAcceptedOrders.keys()) {
          await tx.order.update({
            where: { id: orderId },
            data: { status: "DELIVERED", deliveredAt: now, paymentStatus: "PAID" },
          });
        }
        for (const orderId of uniqueRefusedOrders.keys()) {
          await tx.order.update({ where: { id: orderId }, data: { status: "RETURNED" } });
        }

        const newStatus = isFullRefusal
          ? "REFUSED"
          : isFullDelivery
            ? "DELIVERED"
            : "PARTIALLY_DELIVERED";

        await tx.shipment.update({
          where: { id: shipmentId },
          data: { status: newStatus, totalCOD: COD },
        });

        if (!isFullRefusal) {
          // ═══ السائق: كاش بدون حظر فوري ═══
          const existingWallet = await tx.wallet.findUnique({
            where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: driverId } },
            select: { cashInHand: true },
          });
          const wasCashZero = !existingWallet || Number(existingWallet.cashInHand) === 0;

          const driverWallet = await tx.wallet.upsert({
            where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: driverId } },
            create: {
              ownerType: "DRIVER",
              ownerId: driverId,
              balance: driverFee,
              cashInHand: COD,
              cashHeldSince: new Date(),
            },
            update: {
              balance: { increment: driverFee },
              cashInHand: { increment: COD },
              ...(wasCashZero && { cashHeldSince: new Date() }),
            },
          });

          await tx.walletTransactionUnified.create({
            data: {
              walletId: driverWallet.id,
              amount: driverFee,
              type: "EARNING",
              description: `أجر توصيل شحنة #${shipment.shipmentNumber} (تسليم ${isFullDelivery ? "كامل" : "جزئي"})`,
            },
          });

          if (warehouseProfit > 0) {
            const whWallet = await tx.wallet.upsert({
              where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: WAREHOUSE_ID } },
              create: { ownerType: "WAREHOUSE", ownerId: WAREHOUSE_ID, balance: warehouseProfit },
              update: { balance: { increment: warehouseProfit } },
            });
            await tx.walletTransactionUnified.create({
              data: {
                walletId: whWallet.id,
                amount: warehouseProfit,
                type: "SHIPPING_PROFIT",
                description: `أرباح شحن شحنة #${shipment.shipmentNumber}`,
              },
            });
          }

          const policy = await tx.systemPolicy.findUnique({
            where: { key: "DEFAULT_COMMISSION_RATE" },
          });
          const defaultRate = typeof policy?.value === "number" ? policy.value : 0.1;

          const sellerSubtotals = new Map<number, number>();
          for (const order of acceptedOrders) {
            if (!order.sellerId) continue;
            const current = sellerSubtotals.get(order.sellerId) || 0;
            sellerSubtotals.set(order.sellerId, current + Number(order.subtotal));
          }

          let totalCommission = 0;
          for (const [sellerId, subtotal] of sellerSubtotals) {
            const seller = await tx.seller.findUnique({ where: { id: sellerId } });
            if (!seller) continue;

            const rate = seller.commissionRateOverride
              ? Number(seller.commissionRateOverride)
              : defaultRate;
            const commission = Math.round(subtotal * rate * 100) / 100;
            const netEarning = Math.round((subtotal - commission) * 100) / 100;
            totalCommission += commission;

            await tx.seller.update({
              where: { id: sellerId },
              data: {
                heldBalance: { increment: netEarning },
                totalRevenue: { increment: subtotal },
                totalCommission: { increment: commission },
              },
            });

            await tx.walletTransaction.create({
              data: {
                sellerId,
                type: "HELD_EARNING",
                amount: netEarning,
                balanceBefore: Number(seller.heldBalance),
                balanceAfter: Number(seller.heldBalance) + netEarning,
                description: `أرباح محجوزة من شحنة #${shipment.shipmentNumber}`,
              },
            });
          }

          if (totalCommission > 0) {
            const platformWallet = await tx.wallet.upsert({
              where: { ownerType_ownerId: { ownerType: "PLATFORM", ownerId: PLATFORM_ID } },
              create: { ownerType: "PLATFORM", ownerId: PLATFORM_ID, balance: totalCommission },
              update: { balance: { increment: totalCommission } },
            });
            await tx.walletTransactionUnified.create({
              data: {
                walletId: platformWallet.id,
                amount: totalCommission,
                type: "COMMISSION",
                description: `عمولة من شحنة #${shipment.shipmentNumber}`,
              },
            });
          }
        }

        // ═══ لا نحظر السائق هنا — الحظر يحدث فقط بعد 24 ساعة ═══
        await updateDriverBlockStatus(tx, driverId);

        return {
          COD,
          driverFee,
          acceptedCount: acceptedOrders.length,
          refusedCount: refusedOrders.length,
          isFullRefusal,
          isFullDelivery,
        };
      },
      { timeout: 30000 }
    );
  },

  async receiveRefusedItems(shipmentId: number, warehouseUserId: number) {
    return prisma.$transaction(
      async (tx) => {
        const shipment = await tx.shipment.findUnique({
          where: { id: shipmentId },
          include: {
            items: {
              where: { refusedAt: { not: null }, returnedToWarehouseAt: null },
              include: {
                orderItem: true,
                order: { select: { id: true, sellerId: true, orderNumber: true } },
              },
            },
          },
        });

        if (!shipment) throw new Error("الشحنة غير موجودة");
        if (shipment.items.length === 0) throw new Error("لا توجد عناصر مرفوضة لاستلامها");

        const { InventoryService } = await import("@/services/inventory.service");
        const now = new Date();
        let returnedCount = 0;
        const affectedOrders = new Set<number>();

        for (const item of shipment.items) {
          await tx.shipmentItem.update({
            where: { id: item.id },
            data: { returnedToWarehouseAt: now },
          });

          if (item.variantId) {
            await InventoryService.returnStock(
              tx,
              item.variantId,
              item.quantity,
              shipmentId,
              "استلام مرتجع من السائق",
              "RETURN"
            );
          }

          if (item.order.sellerId) {
            const seller = await tx.seller.findUnique({
              where: { id: item.order.sellerId },
              select: { userId: true },
            });
            if (seller) {
              await tx.notification.create({
                data: {
                  userId: seller.userId,
                  type: "ORDER_STATUS_CHANGED",
                  title: "↩️ استلام مرتجع في المستودع",
                  message: `الطلبية #${item.order.orderNumber} تم استلامها. البضاعة عادت لمخزونك.`,
                  link: `/seller/orders/${item.orderId}`,
                  category: "ORDER",
                  severity: "INFO",
                },
              });
            }
          }

          affectedOrders.add(item.orderId);
          returnedCount++;
        }

        if (shipment.deliveryPersonId) {
          await updateDriverBlockStatus(tx, shipment.deliveryPersonId);
        }

        return { returnedCount, affectedOrderIds: Array.from(affectedOrders) };
      },
      { timeout: 30000 }
    );
  },
};