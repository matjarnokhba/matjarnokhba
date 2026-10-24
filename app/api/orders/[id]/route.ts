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
        { success: false, message: "رقم الطلب غير صحيح" },
        { status: 400 }
      );
    }

    // ═══ جلب الطلب مع كل التفاصيل (بما فيها حقول الرفض) ═══
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: current.user.id,
      },
      include: {
        items: {
          select: {
            id: true,
            productName: true,
            variantName: true,
            sku: true,
            imageUrl: true,
            quantity: true,
            unitPrice: true,
            total: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            note: true,
            createdAt: true,
          },
        },
        shipmentItems: {
          select: {
            id: true,
            orderItemId: true,
            refusedAt: true,
            refusedReason: true,
            returnedToWarehouseAt: true,
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

    // ═══ دمج حقول الرفض مع كل منتج ═══
    const refusedMap = new Map<number, any>();
    for (const si of order.shipmentItems) {
      refusedMap.set(si.orderItemId, si);
    }

    const itemsWithRefusal = order.items.map((item) => {
      const refusal = refusedMap.get(item.id);
      return {
        id: item.id,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        total: String(item.total),
        refusedAt: refusal?.refusedAt || null,
        refusedReason: refusal?.refusedReason || null,
        returnedToWarehouseAt: refusal?.returnedToWarehouseAt || null,
      };
    });

    // ═══ Serialize Decimals ═══
    const serialized = {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      subtotal: String(order.subtotal),
      shippingCost: String(order.shippingCost),
      discount: String(order.discount),
      total: String(order.total),
      createdAt: order.createdAt,
      shippingAddressSnapshot: order.shippingAddressSnapshot,
      items: itemsWithRefusal,
      statusHistory: order.statusHistory,
    };

    return NextResponse.json({ success: true, order: serialized });
  } catch (error) {
    console.error("Order detail error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}