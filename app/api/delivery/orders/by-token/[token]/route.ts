import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const auth = await requireDelivery();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { token } = await params;

    const order = await prisma.order.findFirst({
      where: { deliveryToken: token },
      include: {
        items: true,
        user: { select: { name: true, email: true } },
        deliveryPerson: {
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      );
    }

    // ═══ التحقق: مُسند لهذا السائق ═══
    if (order.deliveryPersonId !== auth.person.id) {
      return NextResponse.json(
        {
          success: false,
          message: "هذا الطلب ليس مُسنداً إليك",
        },
        { status: 403 }
      );
    }

    // ═══ التحقق: الحالة ═══
    if (order.status !== "SHIPPED" && order.status !== "PROCESSING") {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن التصرف بهذا الطلب — حالته: ${order.status}`,
          order: { id: order.id, orderNumber: order.orderNumber, status: order.status },
        },
        { status: 400 }
      );
    }

    const address = order.shippingAddressSnapshot as any;
    const customer = order.customerSnapshot as any;

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: Number(order.total),
        customerName: address?.fullName || customer?.name || "—",
        customerPhone: address?.phone || customer?.phone || null,
        city: address?.city || null,
        street: address?.street || null,
        postalCode: address?.postalCode || null,
        itemsCount: order.items.length,
        items: order.items.map((i) => ({
          id: i.id,
          productName: i.productName,
          variantName: i.variantName,
          imageUrl: i.imageUrl,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          total: Number(i.total),
        })),
      },
    });
  } catch (error) {
    console.error("Delivery by-token error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}