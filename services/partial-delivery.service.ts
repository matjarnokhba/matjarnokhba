import { prisma } from "@/lib/prisma";
import { FulfillmentStatus } from "@/app/generated/prisma/enums";
import { updateDriverBlockStatus } from "./wallet.service";

type ItemDecision = {
  shipmentItemId: number;
  refusedQuantity: number;
  reason?: string;
};

const PLATFORM_ID = 1;
const WAREHOUSE_ID = 1;

export const PartialDeliveryService = {
  async processPartialDelivery(
    shipmentId: number,
    driverId: number,
    decisions: ItemDecision[]
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
                    discount: true,
                    sellerId: true,
                    status: true,
                    userId: true,
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
          throw new Error(
            `لا يمكن تعديل الشحنة في حالتها الحالية: ${shipment.status}`
          );
        }

        // ═══ التحقق من القرارات ═══
        const decisionMap = new Map<number, ItemDecision>();
        for (const d of decisions) {
          if (d.refusedQuantity < 0)
            throw new Error("الكمية المرفوضة لا يمكن أن تكون سالبة");
          decisionMap.set(d.shipmentItemId, d);
        }

        for (const item of shipment.items) {
          if (!decisionMap.has(item.id)) {
            throw new Error(`يجب إعطاء قرار لكل منتج`);
          }
          const d = decisionMap.get(item.id)!;
          if (d.refusedQuantity > item.quantity) {
            throw new Error(
              `الكمية المرفوضة تتجاوز الكمية الكلية للمنتج`
            );
          }
          if (
            d.refusedQuantity > 0 &&
            (!d.reason || d.reason.trim().length < 3)
          ) {
            throw new Error(
              `سبب الرفض مطلوب للمنتج الذي تم رفض جزء منه`
            );
          }
        }

        // ═══ الحساب لكل عنصر ═══
        const now = new Date();
        const itemData = shipment.items.map((item) => {
          const d = decisionMap.get(item.id)!;
          const acceptedQty = item.quantity - d.refusedQuantity;
          const unitAmount = Number(item.codAmount) / item.quantity;
          const acceptedAmount = unitAmount * acceptedQty;

          return {
            item,
            decision: d,
            acceptedQty,
            acceptedAmount,
            isFullyAccepted: acceptedQty === item.quantity,
            isFullyRefused: acceptedQty === 0,
          };
        });

        // ═══ تجميع لكل أوردر ═══
        const orderMap = new Map<number, typeof shipment.items>();
        for (const item of shipment.items) {
          if (!orderMap.has(item.orderId)) orderMap.set(item.orderId, []);
          orderMap.get(item.orderId)!.push(item);
        }

        let totalCOD = 0;
        const orderUpdates: Array<{
          orderId: number;
          status: "DELIVERED" | "PARTIALLY_DELIVERED" | "RETURNED";
          acceptedSubtotal: number;
          shippingCost: number;
        }> = [];

        for (const [orderId, orderItems] of orderMap) {
          const order = orderItems[0].order;
          let totalAcceptedQty = 0;
          let totalQty = 0;
          let acceptedSubtotal = 0;

          for (const oi of orderItems) {
            const data = itemData.find((i) => i.item.id === oi.id)!;
            totalAcceptedQty += data.acceptedQty;
            totalQty += oi.quantity;
            acceptedSubtotal += data.acceptedAmount;
          }

          const shipping =
            totalAcceptedQty > 0 ? Number(order.shippingCost || 0) : 0;
          totalCOD += acceptedSubtotal + shipping;

          let status: "DELIVERED" | "PARTIALLY_DELIVERED" | "RETURNED";
          if (totalAcceptedQty === 0) status = "RETURNED";
          else if (totalAcceptedQty === totalQty) status = "DELIVERED";
          else status = "PARTIALLY_DELIVERED";

          orderUpdates.push({
            orderId,
            status,
            acceptedSubtotal,
            shippingCost: shipping,
          });
        }

        // ═══ تحديث ShipmentItems + FulfillmentItems ═══
        for (const data of itemData) {
          const item = data.item;
          const d = data.decision;

          await tx.shipmentItem.update({
            where: { id: item.id },
            data: {
              refusedQuantity: d.refusedQuantity,
              refusedAt: d.refusedQuantity > 0 ? now : null,
              refusedReason:
                d.refusedQuantity > 0 ? d.reason || null : null,
            },
          });

          if (item.fulfillmentItemId) {
            const fiStatus: FulfillmentStatus = data.isFullyRefused
              ? "RETURNED"
              : "DELIVERED";

            await tx.fulfillmentItem.update({
              where: { id: item.fulfillmentItemId },
              data: { status: fiStatus },
            });

            await tx.fulfillmentStatusHistory.create({
              data: {
                fulfillmentItemId: item.fulfillmentItemId,
                fromStatus: "SHIPPED" as FulfillmentStatus,
                toStatus: fiStatus,
                changedById: driverId,
                note: data.isFullyRefused
                  ? `رفض كامل: ${d.reason || ""}`
                  : data.isFullyAccepted
                    ? `تسليم كامل`
                    : `رفض جزئي (${d.refusedQuantity}/${item.quantity}): ${d.reason || ""}`,
              },
            });
          }
        }

        // ═══ تحديث Orders ═══
        for (const update of orderUpdates) {
          const originalOrder = shipment.items.find(
            (i) => i.orderId === update.orderId
          )!.order;

          const newTotal = Math.max(
            0,
            update.acceptedSubtotal +
              update.shippingCost -
              Number(originalOrder.discount || 0)
          );

          await tx.order.update({
            where: { id: update.orderId },
            data: {
              status: update.status,
              subtotal: update.acceptedSubtotal,
              total: newTotal,
              ...(update.status !== "RETURNED" && { deliveredAt: now }),
              ...(update.status === "DELIVERED" && {
                paymentStatus: "PAID",
              }),
              ...(update.status === "PARTIALLY_DELIVERED" && {
                paymentStatus: "PARTIALLY_REFUNDED",
              }),
            },
          });

          await tx.orderStatusHistory.create({
            data: {
              orderId: update.orderId,
              fromStatus: originalOrder.status,
              toStatus: update.status,
              changedById: driverId,
              note:
                update.status === "RETURNED"
                  ? "رفض كامل من الزبون"
                  : update.status === "PARTIALLY_DELIVERED"
                    ? "تسليم جزئي"
                    : "تسليم كامل",
            },
          });
        }

        // ═══ حالة الشحنة ═══
        const allOrdersReturned = orderUpdates.every(
          (u) => u.status === "RETURNED"
        );
        const allOrdersDelivered = orderUpdates.every(
          (u) => u.status === "DELIVERED"
        );
        const shipmentStatus = allOrdersReturned
          ? "REFUSED"
          : allOrdersDelivered
            ? "DELIVERED"
            : "PARTIALLY_DELIVERED";

        await tx.shipment.update({
          where: { id: shipmentId },
          data: { status: shipmentStatus, totalCOD },
        });

        // ═══ توزيع الأموال ═══
        if (!allOrdersReturned) {
          const driverFee = Number(shipment.driverFee);

          const existingWallet = await tx.wallet.findUnique({
            where: {
              ownerType_ownerId: { ownerType: "DRIVER", ownerId: driverId },
            },
            select: { cashInHand: true },
          });
          const wasCashZero =
            !existingWallet || Number(existingWallet.cashInHand) === 0;

          const driverWallet = await tx.wallet.upsert({
            where: {
              ownerType_ownerId: { ownerType: "DRIVER", ownerId: driverId },
            },
            create: {
              ownerType: "DRIVER",
              ownerId: driverId,
              balance: driverFee,
              cashInHand: totalCOD,
              cashHeldSince: new Date(),
            },
            update: {
              balance: { increment: driverFee },
              cashInHand: { increment: totalCOD },
              ...(wasCashZero && { cashHeldSince: new Date() }),
            },
          });

          await tx.walletTransactionUnified.create({
            data: {
              walletId: driverWallet.id,
              amount: driverFee,
              type: "EARNING",
              description: `أجر توصيل شحنة #${shipment.shipmentNumber}`,
            },
          });

          const totalAcceptedShipping = orderUpdates.reduce(
            (s, u) => s + u.shippingCost,
            0
          );
          const warehouseProfit = Math.max(
            0,
            totalAcceptedShipping - driverFee
          );

          if (warehouseProfit > 0) {
            const whWallet = await tx.wallet.upsert({
              where: {
                ownerType_ownerId: {
                  ownerType: "WAREHOUSE",
                  ownerId: WAREHOUSE_ID,
                },
              },
              create: {
                ownerType: "WAREHOUSE",
                ownerId: WAREHOUSE_ID,
                balance: warehouseProfit,
              },
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
          const defaultRate =
            typeof policy?.value === "number" ? policy.value : 0.1;

          const sellerSubtotals = new Map<number, number>();
          for (const update of orderUpdates) {
            if (update.acceptedSubtotal <= 0) continue;
            const order = shipment.items.find(
              (i) => i.orderId === update.orderId
            )!.order;
            if (!order.sellerId) continue;
            const cur = sellerSubtotals.get(order.sellerId) || 0;
            sellerSubtotals.set(
              order.sellerId,
              cur + update.acceptedSubtotal
            );
          }

          let totalCommission = 0;
          for (const [sellerId, subtotal] of sellerSubtotals) {
            const seller = await tx.seller.findUnique({
              where: { id: sellerId },
            });
            if (!seller) continue;
            const rate = seller.commissionRateOverride
              ? Number(seller.commissionRateOverride)
              : defaultRate;
            const commission = Math.round(subtotal * rate * 100) / 100;
            const netEarning =
              Math.round((subtotal - commission) * 100) / 100;
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
            const pw = await tx.wallet.upsert({
              where: {
                ownerType_ownerId: {
                  ownerType: "PLATFORM",
                  ownerId: PLATFORM_ID,
                },
              },
              create: {
                ownerType: "PLATFORM",
                ownerId: PLATFORM_ID,
                balance: totalCommission,
              },
              update: { balance: { increment: totalCommission } },
            });
            await tx.walletTransactionUnified.create({
              data: {
                walletId: pw.id,
                amount: totalCommission,
                type: "COMMISSION",
                description: `عمولة من شحنة #${shipment.shipmentNumber}`,
              },
            });
          }
        }

        // ═══ AssemblyFile ═══
        try {
          const { AssemblyService } = await import("./assembly.service");
          const userIds = new Set<number>();
          for (const item of shipment.items) {
            if (item.order?.userId) userIds.add(item.order.userId);
          }
          for (const userId of userIds) {
            await AssemblyService.rebuildForUser(tx, userId);
          }
        } catch (e) {
          console.error("Assembly rebuild failed:", e);
        }

        await updateDriverBlockStatus(tx, driverId);

        return {
          totalCOD,
          allOrdersReturned,
          allOrdersDelivered,
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
              where: {
                refusedQuantity: { gt: 0 },
                returnedToWarehouseAt: null,
              },
              include: {
                orderItem: true,
                order: {
                  select: {
                    id: true,
                    sellerId: true,
                    orderNumber: true,
                    userId: true,
                  },
                },
              },
            },
          },
        });

        if (!shipment) throw new Error("الشحنة غير موجودة");
        if (shipment.items.length === 0)
          throw new Error("لا توجد عناصر مرفوضة لاستلامها");

        const { InventoryService } = await import(
          "@/services/inventory.service"
        );
        const now = new Date();
        let returnedCount = 0;
        const affectedOrders = new Set<number>();
        const affectedUserIds = new Set<number>();

        for (const item of shipment.items) {
          await tx.shipmentItem.update({
            where: { id: item.id },
            data: { returnedToWarehouseAt: now },
          });

          if (item.variantId) {
            await InventoryService.returnStock(
              tx,
              item.variantId,
              item.refusedQuantity,
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
                  message: `الطلبية #${item.order.orderNumber}: ${item.refusedQuantity} منتج تم استلامه. البضاعة عادت لمخزونك.`,
                  link: `/seller/orders/${item.orderId}`,
                  category: "ORDER",
                  severity: "INFO",
                },
              });
            }
          }

          affectedOrders.add(item.orderId);
          affectedUserIds.add(item.order.userId);
          returnedCount += item.refusedQuantity;
        }

        try {
          const { AssemblyService } = await import("./assembly.service");
          for (const userId of affectedUserIds) {
            await AssemblyService.rebuildForUser(tx, userId);
          }
        } catch (e) {
          console.error("Assembly rebuild failed:", e);
        }

        if (shipment.deliveryPersonId) {
          await updateDriverBlockStatus(tx, shipment.deliveryPersonId);
        }

        return {
          returnedCount,
          affectedOrderIds: Array.from(affectedOrders),
        };
      },
      { timeout: 30000 }
    );
  },
};