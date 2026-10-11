import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { AuditService } from "@/services/audit.service";

async function requireSeller() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };
  if (current.user.seller.status !== "ACTIVE") {
    return {
      error: "متجرك غير نشط حالياً",
      status: 403,
    };
  }
  return { user: current.user, seller: current.user.seller };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const auth = await requireSeller();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { token } = await params;
    if (!token || token.length < 20) {
      return NextResponse.json(
        { success: false, message: "رمز غير صحيح" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        deliveryToken: token,
        sellerId: auth.seller.id,
      },
      include: {
        items: {
          select: {
            id: true,
            fulfillmentItems: {
              select: { id: true, status: true },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "الطلب غير موجود أو لا يخص متجرك" },
        { status: 404 }
      );
    }

    // ═══ مسح ثانٍ — الطلب جاهز بالفعل ═══
    if (order.status === "SHIPPED") {
      return NextResponse.json({
        success: true,
        alreadyReady: true,
        orderNumber: order.orderNumber,
        orderId: order.id,
      });
    }

    // ═══ حالة غير مسموحة ═══
    if (order.status !== "PROCESSING") {
      const messages: Record<string, string> = {
        NEW: "يجب قبول الطلب أولاً قبل تجهيزه.",
        DELIVERED: "الطلب تم تسليمه بالفعل.",
        CANCELLED: "الطلب ملغى.",
        RETURNED: "الطلب مُرجع.",
      };
      return NextResponse.json(
        {
          success: false,
          message:
            messages[order.status] ||
            `لا يمكن تجهيز طلب بحالة ${order.status}`,
        },
        { status: 400 }
      );
    }

    const allFulfillmentItems = order.items.flatMap(
      (item) => item.fulfillmentItems
    );

    if (allFulfillmentItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "لا توجد عناصر تجهيز لهذا الطلب — تواصل مع الإدارة",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // ═══ 1. Order: PROCESSING → SHIPPED ═══
      await tx.order.update({
        where: { id: order.id },
        data: { status: "SHIPPED" },
      });

      // ═══ 2. FulfillmentItems: PREPARING → READY_FOR_COLLECTION ═══
      for (const fi of allFulfillmentItems) {
        if (fi.status !== "PREPARING") continue;

        await tx.fulfillmentItem.update({
          where: { id: fi.id },
          data: {
            status: "READY_FOR_COLLECTION",
            readyAt: new Date(),
          },
        });

        await tx.fulfillmentStatusHistory.create({
          data: {
            fulfillmentItemId: fi.id,
            fromStatus: "PREPARING",
            toStatus: "READY_FOR_COLLECTION",
            changedById: auth.user.id,
            note: "التاجر أنهى التجهيز",
          },
        });
      }

      // ═══ 3. OrderStatusHistory ═══
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: "PROCESSING",
          toStatus: "SHIPPED",
          changedById: auth.user.id,
          note: "الطرد جاهز للجمع",
        },
      });

      // ═══ 4. إشعارات: Admin + Warehouse Manager ═══
      const recipients = await tx.user.findMany({
        where: {
          role: {
            in: ["ADMIN", "SUPER_ADMIN", "WAREHOUSE_MANAGER"],
          },
          deletedAt: null,
        },
        select: { id: true },
      });

      for (const r of recipients) {
        await tx.notification.create({
          data: {
            userId: r.id,
            type: "ORDER_STATUS_CHANGED",
            title: "📦 طرد جاهز للجمع",
            message: `التاجر "${auth.seller.storeName}" أنهى تجهيز الطلب ${order.orderNumber}. بانتظار مسؤول الجمع.`,
            link: `/admin/orders/${order.id}`,
            category: "ORDER",
            severity: "INFO",
            metadata: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              sellerId: auth.seller.id,
              sellerName: auth.seller.storeName,
              action: "ready_for_collection",
            },
          },
        });
      }

      // ═══ 5. Audit ═══
      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "FULFILLMENT_READY",
        entity: "Order",
        entityId: String(order.id),
        oldData: { status: "PROCESSING" },
        newData: {
          status: "SHIPPED",
          fulfillmentItemsCount: allFulfillmentItems.length,
          sellerId: auth.seller.id,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });
    });

    return NextResponse.json({
      success: true,
      alreadyReady: false,
      orderNumber: order.orderNumber,
      orderId: order.id,
      fulfillmentItemsCount: allFulfillmentItems.length,
    });
  } catch (error) {
    console.error("Order ready-by-token error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}