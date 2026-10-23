import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(current.user.role)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const orderId = parseInt(id);
    if (isNaN(orderId)) return NextResponse.json({ success: false }, { status: 400 });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        seller: { select: { storeName: true } },
      },
    });

    if (!order) return NextResponse.json({ success: false, message: "الطلب غير موجود" }, { status: 404 });

    const address = (order.shippingAddressSnapshot as any) || {};
    const customer = (order.customerSnapshot as any) || {};
    const customerFullName = address.fullName || customer.name || "—";

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        deliveryToken: order.deliveryToken,
        customerFullName,
        shippingCityColor: order.shippingCityColor,
        shippingDistrictColor: order.shippingDistrictColor,
        items: order.items.map(i => ({
          id: i.id,
          productName: i.productName,
          variantName: i.variantName,
          quantity: i.quantity,
        })),
        seller: {
          storeName: order.seller?.storeName || "متجر",
        }
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}