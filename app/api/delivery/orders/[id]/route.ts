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

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        deliveryAttempts: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      );
    }

    if (order.deliveryPersonId !== auth.person.id) {
      return NextResponse.json(
        { success: false, message: "هذا الطلب ليس مُسنداً إليك" },
        { status: 403 }
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
        source: order.source,
        total: Number(order.total),
        subtotal: Number(order.subtotal),
        shippingCost: Number(order.shippingCost),
        assignedAt: order.assignedAt,
        createdAt: order.createdAt,
        deliveredAt: order.deliveredAt,
        customerName: address?.fullName || customer?.name || "—",
        customerPhone: address?.phone || customer?.phone || null,
        city: address?.city || null,
        street: address?.street || null,
        postalCode: address?.postalCode || null,
        items: order.items.map((i) => ({
          id: i.id,
          productName: i.productName,
          variantName: i.variantName,
          imageUrl: i.imageUrl,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          total: Number(i.total),
        })),
        attempts: order.deliveryAttempts.map((a) => ({
          id: a.id,
          type: a.type,
          reason: a.reason,
          createdAt: a.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Delivery order detail error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}