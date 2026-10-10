import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { InventoryService } from "@/services/inventory.service";
import { LoyaltyService } from "@/services/loyalty.service";
import { ReferralService } from "@/services/referral.service";
import { AuditService } from "@/services/audit.service";
import { FulfillmentService } from "@/services/fulfillment.service";
import { FulfillmentStatus } from "@/app/generated/prisma/enums";

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
]);export async function POST(
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
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
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

    if (
      !["ASSIGNED", "IN_TRANSIT", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(
        shipment.status
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن التصرف بهذه الشحنة — حالتها: ${shipment.status}`,
        },
        { status: 400 }
      );
    }

    const orderIds = Array.from(new Set(shipment.items.map((i) => i.orderId)));
    const orderMap = new Map(shipment.items.map((i) => [i.orderId, i.order]));

    await prisma.$transaction(
      async (tx) => {
        if (data.action === "delivered") {
          await tx.shipment.update({
            where: { id: shipmentId },
            data: { status: "DELIVERED" },
          });

          // 1. FulfillmentItems → DELIVERED
          for (const shipmentItem of shipment.items) {
            if (!shipmentItem.fulfillmentItemId) continue;

            const fi = await tx.fulfillmentItem.findUnique({
              where: { id: shipmentItem.fulfillmentItemId },
              select: { status: true },
            });

            if (!fi) continue;
            if (fi.status === "DELIVERED") continue;

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

          // 2. syncOrderFulfillmentStatus لكل orderItem في الشحنة
          const uniqueOrderItemIds = Array.from(
            new Set(shipment.items.map((i) => i.orderItemId))
          );
          for (const oiId of uniqueOrderItemIds) {
            await FulfillmentService.syncOrderFulfillmentStatus(tx, oiId);
          }

          // 3. sold — عناصر الشحنة فقط
          const soldByProduct = new Map<number, number>();
          for (const si of shipment.items) {
            soldByProduct.set(
              si.productId,
              (soldByProduct.get(si.productId) || 0) + si.quantity
            );
          }
          for (const [pid, qty] of soldByProduct) {
            await tx.product.update({
              where: { id: pid },
              data: { sold: { increment: qty } },
            });
          }

          // 4. Loyalty + Referral + Notification — للطلبات التي أصبحت DELIVERED فقط
          for (const orderId of orderIds) {
            const fresh = await tx.order.findUnique({
              where: { id: orderId },
              select: { status: true, userId: true, total: true },
            });
            if (!fresh) continue;
            if (fresh.status !== "DELIVERED") continue;

            try {
              const award = await LoyaltyService.awardForOrder(tx, {
                userId: fresh.userId,
                orderId,
                orderTotal: Number(fresh.total),
              });
              if (award.pointsAwarded > 0) {
                await tx.order.update({
                  where: { id: orderId },
                  data: {
                    loyaltyPointsAwarded: award.pointsAwarded,
                    loyaltyAwardedAt: new Date(),
                  },
                });
              }
            } catch (loyaltyErr) {
              console.error("Loyalty award failed:", loyaltyErr);
            }

            try {
              await ReferralService.awardOnFirstOrder(tx, fresh.userId, orderId);
            } catch (refErr) {
              console.error("Referral award failed:", refErr);
            }

            await tx.notification.create({
              data: {
                userId: fresh.userId,
                type: "ORDER_STATUS_CHANGED",
                title: "تم توصيل طلبك",
                message: "طلبك تم تسليمه بنجاح. شكراً لثقتك!",
                link: `/orders/${orderId}`,
                category: "ORDER",
                severity: "INFO",
              },
            });
          }

          await tx.deliveryPerson.update({
            where: { id: auth.person.id },
            data: {
              totalDeliveries: { increment: 1 },
              successfulDeliveries: { increment: 1 },
            },
          });

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
          await tx.shipment.update({
            where: { id: shipmentId },
            data: { status: "POSTPONED" },
          });

          const reqInfo = AuditService.getRequestInfo(request);
          await AuditService.logInTransaction(tx, {
            userId: auth.user.id,
            action: "DELIVERY_ACTION",
            entity: "Shipment",
            entityId: shipmentId,
            newData: {
              action: "postponed",
              reason: data.reason,
              shipmentNumber: shipment.shipmentNumber,
            },
            ipAddress: reqInfo.ipAddress,
            userAgent: reqInfo.userAgent,
          });

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
          const isRejected = data.action === "refused";
          const newStatus = isRejected ? "REFUSED" : "RETURNED";
          const returnReason = isRejected
            ? "رفض التوصيل — إرجاع للمخزون"
            : "إرجاع الشحنة — إرجاع للمخزون";

          await tx.shipment.update({
            where: { id: shipmentId },
            data: { status: newStatus },
          });

          // 1. FulfillmentItems → RETURNED
          for (const shipmentItem of shipment.items) {
            if (!shipmentItem.fulfillmentItemId) continue;

            const fi = await tx.fulfillmentItem.findUnique({
              where: { id: shipmentItem.fulfillmentItemId },
              select: { status: true },
            });

            if (!fi) continue;
            if (fi.status === "RETURNED") continue;

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

          // 2. إرجاع للمخزون — عناصر الشحنة فقط (idempotent)
          for (const si of shipment.items) {
            if (!si.variantId) continue;
            await InventoryService.returnStock(
              tx,
              si.variantId,
              si.quantity,
              shipmentId,
              returnReason,
              "RETURN"
            );
          }

          // 3. syncOrderFulfillmentStatus لكل orderItem في الشحنة
          const uniqueOrderItemIds = Array.from(
            new Set(shipment.items.map((i) => i.orderItemId))
          );
          for (const oiId of uniqueOrderItemIds) {
            await FulfillmentService.syncOrderFulfillmentStatus(tx, oiId);
          }

          // 4. OrderStatusHistory + Notifications — للطلبات التي أصبحت RETURNED
          for (const orderId of orderIds) {
            const fresh = await tx.order.findUnique({
              where: { id: orderId },
              select: { status: true, userId: true },
            });
            if (!fresh) continue;
            if (fresh.status !== "RETURNED") continue;

            await tx.orderStatusHistory.create({
              data: {
                orderId,
                fromStatus: fresh.status as any,
                toStatus: "RETURNED",
                changedById: auth.user.id,
                note: `${isRejected ? "رفض" : "إرجاع"} عبر الشحنة ${shipment.shipmentNumber} — ${data.reason}`,
              },
            });

            await tx.notification.create({
              data: {
                userId: fresh.userId,
                type: "ORDER_STATUS_CHANGED",
                title: isRejected ? "تم رفض استلام طلبك" : "تم إرجاع طلبك",
                message: `طلبك — ${data.reason}`,
                link: `/orders/${orderId}`,
                category: "ORDER",
                severity: "WARNING",
              },
            });
          }

          await tx.deliveryPerson.update({
            where: { id: auth.person.id },
            data: {
              totalDeliveries: { increment: 1 },
              failedDeliveries: { increment: 1 },
              returnCount: { increment: 1 },
            },
          });

          const reqInfo = AuditService.getRequestInfo(request);
          await AuditService.logInTransaction(tx, {
            userId: auth.user.id,
            action: "DELIVERY_ACTION",
            entity: "Shipment",
            entityId: shipmentId,
            newData: {
              action: data.action,
              reason: data.reason,
              ordersCount: orderIds.length,
              shipmentNumber: shipment.shipmentNumber,
            },
            ipAddress: reqInfo.ipAddress,
            userAgent: reqInfo.userAgent,
          });

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
                title: isRejected ? "رفض شحنة" : "إرجاع شحنة",
                message: `السائق ${auth.user.name} — ${shipment.shipmentNumber}: ${data.reason}`,
                link: `/admin/shipments/${shipmentId}`,
                category: "ORDER",
                severity: "WARNING",
              },
            });
          }
        }
      },
      { timeout: 30000 }
    );

    return NextResponse.json({
      success: true,
      message:
        data.action === "delivered"
          ? "تم تسجيل التسليم"
          : data.action === "postponed"
            ? "تم تسجيل التأجيل"
            : data.action === "refused"
              ? "تم تسجيل الرفض"
              : "تم تسجيل الإرجاع",
    });
  } catch (error) {
    console.error("Shipment action error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}