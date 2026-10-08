import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { InventoryService } from "@/services/inventory.service";

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
    action: z.literal("deferred"),
    reason: z.string().trim().min(3, "سبب التأجيل مطلوب").max(500),
  }),
  z.object({
    action: z.literal("rejected"),
    reason: z.string().trim().min(3, "سبب الرفض مطلوب").max(500),
  }),
  z.object({
    action: z.literal("returned"),
    reason: z.string().trim().min(3, "سبب الإرجاع مطلوب").max(500),
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
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
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

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { select: { variantId: true, quantity: true } },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      );
    }

    // ═══ التحقق من الإسناد ═══
    if (order.deliveryPersonId !== auth.person.id) {
      return NextResponse.json(
        { success: false, message: "هذا الطلب ليس مُسنداً إليك" },
        { status: 403 }
      );
    }

    // ═══ التحقق من الحالة ═══
    if (order.status !== "SHIPPED" && order.status !== "PROCESSING") {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن التصرف بهذا الطلب — حالته: ${order.status}`,
        },
        { status: 400 }
      );
    }

    // ═══ التنفيذ ═══
    await prisma.$transaction(
      async (tx) => {
        // ═══ 1. تسجيل المحاولة ═══
        await tx.deliveryAttempt.create({
          data: {
            orderId: order.id,
            deliveryPersonId: auth.person.id,
            type:
              data.action === "delivered"
                ? "DELIVERED"
                : data.action === "deferred"
                  ? "DEFERRED"
                  : data.action === "rejected"
                    ? "REJECTED"
                    : "RETURNED",
            reason: data.action === "delivered" ? null : data.reason,
          },
        });

        // ═══ 2. الإجراء ═══
        if (data.action === "delivered") {
          // ✅ تم التوصيل
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: "DELIVERED",
              deliveredAt: new Date(),
              paymentStatus: "PAID",
            },
          });

          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: "DELIVERED",
              changedById: auth.user.id,
              note: `تم التسليم بواسطة السائق — ${auth.user.name}`,
            },
          });

          // ═══ تحديث أداء السائق ═══
          await tx.deliveryPerson.update({
            where: { id: auth.person.id },
            data: {
              totalDeliveries: { increment: 1 },
              successfulDeliveries: { increment: 1 },
            },
          });

          // ═══ زيادة المبيعات ═══
          const soldByProduct = new Map<number, number>();
          const items = await tx.orderItem.findMany({
            where: { orderId: order.id },
            select: { productId: true, quantity: true },
          });
          for (const item of items) {
            soldByProduct.set(
              item.productId,
              (soldByProduct.get(item.productId) || 0) + item.quantity
            );
          }
          for (const [productId, qty] of soldByProduct) {
            await tx.product.update({
              where: { id: productId },
              data: { sold: { increment: qty } },
            });
          }

          // ═══ إشعارات ═══
          await tx.notification.create({
            data: {
              userId: order.userId,
              type: "ORDER_STATUS_CHANGED",
              title: "✅ تم توصيل طلبك",
              message: `طلبك ${order.orderNumber} تم توصيله بنجاح. شكراً لثقتك!`,
              link: `/orders/${order.id}`,
              category: "ORDER",
              severity: "INFO",
            },
          });

          // ═══ إشعار للتاجر ═══
          if (order.sellerId) {
            const seller = await tx.seller.findUnique({
              where: { id: order.sellerId },
              select: { userId: true },
            });
            if (seller) {
              await tx.notification.create({
                data: {
                  userId: seller.userId,
                  type: "ORDER_STATUS_CHANGED",
                  title: "✅ طلب تم توصيله",
                  message: `الطلب ${order.orderNumber} تم توصيله بنجاح`,
                  link: `/seller/orders/${order.id}`,
                  category: "ORDER",
                  severity: "INFO",
                },
              });
            }
          }
        } else if (data.action === "deferred") {
          // ⏸️ تأجيل — لا نغيّر الحالة
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: order.status,
              changedById: auth.user.id,
              note: `⏸️ تأجيل التوصيل: ${data.reason}`,
            },
          });

          // إشعار للأدمن
          const admins = await tx.user.findMany({
            where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, deletedAt: null },
            select: { id: true },
          });
          for (const admin of admins) {
            await tx.notification.create({
              data: {
                userId: admin.id,
                type: "ORDER_STATUS_CHANGED",
                title: "⏸️ تأجيل توصيل",
                message: `السائق "${auth.user.name}" أجّل التوصيل ${order.orderNumber}: ${data.reason}`,
                link: `/admin/orders/${order.id}`,
                category: "ORDER",
                severity: "WARNING",
              },
            });
          }
        } else {
          // ❌ رفض أو إرجاع — كلاهما يعيد المخزون
          const isRejected = data.action === "rejected";

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: "RETURNED",
            },
          });

          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: "RETURNED",
              changedById: auth.user.id,
              note: `${isRejected ? "❌ رفض العميل" : "↩️ إرجاع"} — ${data.reason}`,
            },
          });

          // ═══ إرجاع المخزون ═══
          const itemsWithVariant = order.items.filter(
            (i): i is { variantId: number; quantity: number } =>
              i.variantId !== null
          );

          // تحقق idempotency
          const alreadyReturned = await tx.inventoryMovement.findFirst({
            where: {
              referenceType: "ORDER",
              referenceId: BigInt(order.id),
              type: "RETURN",
              reason: { contains: isRejected ? "رفض" : "إرجاع" },
            },
          });

          if (!alreadyReturned) {
            const sorted = [...itemsWithVariant].sort(
              (a, b) => a.variantId - b.variantId
            );
            for (const item of sorted) {
              await InventoryService.cancelReturn(
                tx,
                item.variantId,
                item.quantity,
                order.id
              );
            }
          }

          // ═══ تحديث أداء السائق ═══
          await tx.deliveryPerson.update({
            where: { id: auth.person.id },
            data: {
              totalDeliveries: { increment: 1 },
              failedDeliveries: { increment: 1 },
              returnCount: { increment: 1 },
            },
          });

          // ═══ إشعارات ═══
          await tx.notification.create({
            data: {
              userId: order.userId,
              type: "ORDER_STATUS_CHANGED",
              title: isRejected ? "❌ تم رفض الاستلام" : "↩️ تم إرجاع الطلب",
              message: `طلبك ${order.orderNumber} — ${data.reason}`,
              link: `/orders/${order.id}`,
              category: "ORDER",
              severity: "WARNING",
            },
          });

          // إشعار للأدمن
          const admins = await tx.user.findMany({
            where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, deletedAt: null },
            select: { id: true },
          });
          for (const admin of admins) {
            await tx.notification.create({
              data: {
                userId: admin.id,
                type: "ORDER_STATUS_CHANGED",
                title: isRejected ? "❌ رفض توصيل" : "↩️ إرجاع توصيل",
                message: `السائق "${auth.user.name}" — ${order.orderNumber}: ${data.reason}`,
                link: `/admin/orders/${order.id}`,
                category: "ORDER",
                severity: "WARNING",
              },
            });
          }
        }
      },
      { timeout: 20000 }
    );

    return NextResponse.json({
      success: true,
      message:
        data.action === "delivered"
          ? "تم تسجيل التسليم بنجاح"
          : data.action === "deferred"
            ? "تم تسجيل التأجيل"
            : data.action === "rejected"
              ? "تم تسجيل الرفض"
              : "تم تسجيل الإرجاع",
    });
  } catch (error) {
    console.error("Delivery action error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}