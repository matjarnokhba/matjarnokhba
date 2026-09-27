import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
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

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            returnItems: {
              where: {
                returnRequest: {
                  status: { in: ["PENDING", "APPROVED", "COMPLETED"] },
                },
              },
              select: { quantity: true },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      );
    }

    if (order.userId !== current.user.id) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    // تحقق من الحالة + نافذة الإرجاع
    const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const canRequestReturn =
      order.status === "DELIVERED" &&
      order.deliveredAt &&
      now - order.deliveredAt.getTime() <= RETURN_WINDOW_MS;

    // احسب الكميات المتاحة
    const returnableItems = order.items.map((item) => {
      const alreadyRequested = item.returnItems.reduce(
        (s, ri) => s + ri.quantity,
        0
      );
      const available = item.quantity - alreadyRequested;

      return {
        orderItemId: item.id,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        imageUrl: item.imageUrl,
        originalQuantity: item.quantity,
        alreadyRequested,
        availableQuantity: Math.max(0, available),
        unitPrice: item.unitPrice.toString(),
      };
    });

    // معلومات النافذة
    let deadline: string | null = null;
    if (order.deliveredAt) {
      deadline = new Date(
        order.deliveredAt.getTime() + RETURN_WINDOW_MS
      ).toISOString();
    }

    return NextResponse.json({
      success: true,
      canRequestReturn,
      deadline,
      items: returnableItems,
    });
  } catch (error) {
    console.error("Returnable items error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}