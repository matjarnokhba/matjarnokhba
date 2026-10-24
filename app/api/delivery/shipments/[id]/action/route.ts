import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { WalletService } from "@/services/wallet.service";
import { FulfillmentService } from "@/services/fulfillment.service";
import { FulfillmentStatus } from "@/app/generated/prisma/enums";
import { AuditService } from "@/services/audit.service";
import { InventoryService } from "@/services/inventory.service";

class ShipmentAlreadyProcessedError extends Error {
  constructor() {
    super("Shipment already processed");
  }
}

async function requireDelivery() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "DELIVERY") {
    return { error: "غير مصرح", status: 403 };
  }

  const person = await prisma.deliveryPerson.findUnique({
    where: { userId: current.user.id },
    select: { id: true, status: true, deletedAt: true },
  });

  if (!person || person.deletedAt || person.status !== "ACTIVE") {
    return { error: "الحساب غير نشط", status: 403 };
  }

  return { user: current.user, person };
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delivered") }),
  z.object({ action: z.literal("picked_up") }),
  z.object({
    action: z.literal("postponed"),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("refused"),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("returned"),
    reason: z.string().trim().min(3).max(500),
  }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireDelivery();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const shipmentId = parseInt(id);
    if (isNaN(shipmentId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        items: {
          include: {
            order: {
              select: {
                id: true,
                userId: true,
                status: true,
                total: true,
                subtotal: true,
                shippingCost: true,
                sellerId: true,
              },
            },
          },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, message: "الشحنة غير موجودة" },
        { status: 404 }
      );
    }

    if (shipment.deliveryPersonId !== auth.person.id) {
      return NextResponse.json(
        { success: false, message: "هذه الشحنة ليست مُسندة إليك" },
        { status: 403 }
      );
    }

    const orderIds = Array.from(new Set(shipment.items.map((i) => i.orderId)));

    await prisma.$transaction(
      async (tx) => {
        // ═══════════════════════════════════════════
        // PICKED_UP — الخروج للتوزيع
        // ═══════════════════════════════════════════
        if (data.action === "picked_up") {
          const statusUpdated = await tx.shipment.updateMany({
            where: {
              id: shipmentId,
              status: { in: ["ASSIGNED", "IN_TRANSIT"] },
            },
            data: { status: "OUT_FOR_DELIVERY" },
          });
          if (statusUpdated.count === 0) {
            throw new ShipmentAlreadyProcessedError();
          }

          // تحديث كل FulfillmentItems إلى SHIPPED
          const fiIds = shipment.items
            .filter((i) => i.fulfillmentItemId !== null)
            .map((i) => i.fulfillmentItemId!);

          if (fiIds.length > 0) {
            const itemsToUpdate = await tx.fulfillmentItem.findMany({
              where: {
                id: { in: fiIds },
                status: { in: ["AVAILABLE_FOR_SHIPMENT", "ALLOCATED"] },
              },
              select: { id: true, status: true },
            });

            for (const fi of itemsToUpdate) {
              await tx.fulfillmentItem.update({
                where: { id: fi.id },
                data: { status: "SHIPPED" },
              });

              await tx.fulfillmentStatusHistory.create({
                data: {
                  fulfillmentItemId: fi.id,
                  fromStatus: fi.status as FulfillmentStatus,
                  toStatus: "SHIPPED",
                  changedById: auth.user.id,
                  note: `تم التحميل في سيارة السائق (شحنة ${shipment.shipmentNumber})`,
                },
              });
            }
          }

          // إعادة حساب Assembly Files
          try {
            const { AssemblyService } = await import(
              "@/services/assembly.service"
            );
            const userIds = new Set<number>();
            for (const item of shipment.items) {
              if (item.order?.userId) userIds.add(item.order.userId);
            }
            for (const userId of userIds) {
              await AssemblyService.recomputeForUser(tx, userId);
            }
          } catch (e) {
            console.error("Assembly recompute failed:", e);
          }

          // Audit
          const reqInfo = AuditService.getRequestInfo(request);
          await AuditService.logInTransaction(tx, {
            userId: auth.user.id,
            action: "SHIPMENT_PICKUP",
            entity: "Shipment",
            entityId: String(shipmentId),
            oldData: { status: "ASSIGNED" },
            newData: {
              status: "OUT_FOR_DELIVERY",
              shipmentNumber: shipment.shipmentNumber,
            },
            ipAddress: reqInfo.ipAddress,
            userAgent: reqInfo.userAgent,
          });

          return;
        }

        // ═══════════════════════════════════════════
        // DELIVERED — تسليم كامل
        // ═══════════════════════════════════════════
        if (data.action === "delivered") {
          const statusUpdated = await tx.shipment.updateMany({
            where: {
              id: shipmentId,
              status: {
                in: [
                  "ASSIGNED",
                  "IN_TRANSIT",
                  "PICKED_UP",
                  "OUT_FOR_DELIVERY",
                ],
              },
            },
            data: { status: "DELIVERED" },
          });
          if (statusUpdated.count === 0) {
            throw new ShipmentAlreadyProcessedError();
          }

          for (const shipmentItem of shipment.items) {
            if (!shipmentItem.fulfillmentItemId) continue;
            const fi = await tx.fulfillmentItem.findUnique({
              where: { id: shipmentItem.fulfillmentItemId },
              select: { status: true },
            });
            if (!fi || fi.status === "DELIVERED") continue;

            await tx.fulfillmentItem.update({
              where: { id: shipmentItem.fulfillmentItemId },
              data: { status: "DELIVERED" },
            });

            await tx.fulfillmentStatusHistory.create({
              data: {
                fulfillmentItemId: shipmentItem.fulfillmentItemId,
                fromStatus: fi.status as FulfillmentStatus,
                toStatus: "DELIVERED",
                changedById: auth.user.id,
                note: `تم التسليم عبر الشحنة ${shipment.shipmentNumber}`,
              },
            });
          }

          const uniqueOrderItemIds = Array.from(
            new Set(shipment.items.map((i) => i.orderItemId))
          );
          for (const oiId of uniqueOrderItemIds) {
            await FulfillmentService.syncOrderFulfillmentStatus(tx, oiId);
          }

          for (const orderId of orderIds) {
            const fresh = await tx.order.findUnique({
              where: { id: orderId },
              select: {
                status: true,
                userId: true,
                total: true,
                subtotal: true,
                shippingCost: true,
                sellerId: true,
                orderNumber: true,
              },
            });
            if (!fresh) continue;
            if (fresh.status !== "DELIVERED") continue;

            let commissionAmount = 0;
            if (fresh.sellerId) {
              const result = await WalletService.addHeldEarning(
                tx,
                fresh.sellerId,
                orderId,
                Number(fresh.total),
                Number(fresh.subtotal)
              );
              if (result) commissionAmount = result.commissionAmount;
            }

            await WalletService.processDeliveryFinancials(
              tx,
              fresh,
              auth.person.id
            );
          }

          await tx.deliveryPerson.update({
            where: { id: auth.person.id },
            data: {
              totalDeliveries: { increment: 1 },
              successfulDeliveries: { increment: 1 },
            },
          });

          try {
            const { AssemblyService } = await import(
              "@/services/assembly.service"
            );
            const userIds = new Set<number>();
            for (const item of shipment.items) {
              if (item.order?.userId) userIds.add(item.order.userId);
            }
            for (const userId of userIds) {
              await AssemblyService.recomputeForUser(tx, userId);
            }
          } catch (e) {
            console.error("Assembly recompute failed:", e);
          }

          const reqInfo = AuditService.getRequestInfo(request);
          await AuditService.logInTransaction(tx, {
            userId: auth.user.id,
            action: "DELIVERY_ACTION",
            entity: "Shipment",
            entityId: shipmentId,
            newData: {
              action: "delivered",
              ordersCount: orderIds.length,
              shipmentNumber: shipment.shipmentNumber,
            },
            ipAddress: reqInfo.ipAddress,
            userAgent: reqInfo.userAgent,
          });
        } else if (data.action === "postponed") {
          const statusUpdated = await tx.shipment.updateMany({
            where: {
              id: shipmentId,
              status: {
                in: [
                  "ASSIGNED",
                  "IN_TRANSIT",
                  "PICKED_UP",
                  "OUT_FOR_DELIVERY",
                ],
              },
            },
            data: { status: "POSTPONED" },
          });
          if (statusUpdated.count === 0) {
            throw new ShipmentAlreadyProcessedError();
          }

          const admins = await tx.user.findMany({
            where: {
              role: { in: ["ADMIN", "SUPER_ADMIN"] },
              deletedAt: null,
            },
            select: { id: true },
          });
          for (const a of admins) {
            await tx.notification.create({
              data: {
                userId: a.id,
                type: "ORDER_STATUS_CHANGED",
                title: "تأجيل توصيل شحنة",
                message: `السائق ${auth.user.name} أجّل الشحنة ${shipment.shipmentNumber}: ${data.reason}`,
                link: `/admin/shipments/${shipmentId}`,
                category: "ORDER",
                severity: "WARNING",
              },
            });
          }
        } else {
          // refused / returned
          const isRejected = data.action === "refused";
          const newStatus = isRejected ? "REFUSED" : "RETURNED";

          const statusUpdated = await tx.shipment.updateMany({
            where: {
              id: shipmentId,
              status: {
                in: [
                  "ASSIGNED",
                  "IN_TRANSIT",
                  "PICKED_UP",
                  "OUT_FOR_DELIVERY",
                ],
              },
            },
            data: { status: newStatus },
          });
          if (statusUpdated.count === 0) {
            throw new ShipmentAlreadyProcessedError();
          }

          for (const shipmentItem of shipment.items) {
            if (!shipmentItem.fulfillmentItemId) continue;
            const fi = await tx.fulfillmentItem.findUnique({
              where: { id: shipmentItem.fulfillmentItemId },
              select: { status: true },
            });
            if (!fi || fi.status === "RETURNED") continue;

            await tx.fulfillmentItem.update({
              where: { id: shipmentItem.fulfillmentItemId },
              data: { status: "RETURNED" },
            });
            await tx.fulfillmentStatusHistory.create({
              data: {
                fulfillmentItemId: shipmentItem.fulfillmentItemId,
                fromStatus: fi.status as FulfillmentStatus,
                toStatus: "RETURNED",
                changedById: auth.user.id,
                note: `${isRejected ? "رفض" : "إرجاع"} عبر الشحنة ${shipment.shipmentNumber} — ${data.reason}`,
              },
            });
          }

          for (const si of shipment.items) {
            if (!si.variantId) continue;
            await InventoryService.returnStock(
              tx,
              si.variantId,
              si.quantity,
              shipmentId,
              isRejected ? "رفض التوصيل" : "إرجاع الشحنة",
              "RETURN"
            );
          }

          const uniqueOrderItemIds = Array.from(
            new Set(shipment.items.map((i) => i.orderItemId))
          );
          for (const oiId of uniqueOrderItemIds) {
            await FulfillmentService.syncOrderFulfillmentStatus(tx, oiId);
          }

          await tx.deliveryPerson.update({
            where: { id: auth.person.id },
            data: {
              totalDeliveries: { increment: 1 },
              failedDeliveries: { increment: 1 },
              returnCount: { increment: 1 },
            },
          });
        }
      },
      { timeout: 30000 }
    );

    return NextResponse.json({ success: true, message: "تمت العملية بنجاح" });
  } catch (error) {
    if (error instanceof ShipmentAlreadyProcessedError) {
      return NextResponse.json(
        { success: false, message: "تمت معالجة الشحنة بالفعل" },
        { status: 409 }
      );
    }
    console.error("Shipment action error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}