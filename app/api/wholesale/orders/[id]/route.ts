import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET(
  _request: Request,
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

    const order = await prisma.wholesaleOrder.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true, name: true, email: true, phone: true } },
        supplier: {
          select: {
            id: true,
            displayName: true,
            slug: true,
            city: true,
            region: true,
            activityType: true,
            isVerified: true,
          },
        },
        items: {
          include: {
            offer: {
              select: {
                id: true,
                source: { select: { name: true, city: true } },
              },
            },
            offerVariant: {
              select: { id: true, sku: true, options: true },
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

    const isBuyer = order.buyerUserId === current.user.id;
    const isSupplier = current.user.wholesaleSupplier?.id === order.supplierId;

    if (!isBuyer && !isSupplier) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      role: isSupplier ? "supplier" : "buyer",
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal: Number(order.subtotal),
        total: Number(order.total),
        notes: order.notes,
        rejectionReason: order.rejectionReason,
        createdAt: order.createdAt,
        acceptedAt: order.acceptedAt,
        rejectedAt: order.rejectedAt,
        completedAt: order.completedAt,
        cancelledAt: order.cancelledAt,
        buyer: order.buyer,
        supplier: order.supplier,
        items: order.items.map((i) => ({
          id: i.id,
          productName: i.productName,
          variantName: i.variantName,
          sourceName: i.sourceName,
          qty: i.qty,
          unitPrice: Number(i.unitPrice),
          total: Number(i.total),
          offerId: i.offerId,
          variantId: i.offerVariantId,
          variantSku: i.offerVariant?.sku || null,
          variantOptions: i.offerVariant?.options || null,
        })),
      },
    });
  } catch (error) {
    console.error("Order GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}