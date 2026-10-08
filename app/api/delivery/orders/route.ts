import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireDelivery() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "DELIVERY") {
    return { error: "غير مصرح", status: 403 };
  }

  const deliveryPerson = await prisma.deliveryPerson.findUnique({
    where: { userId: current.user.id },
    select: { id: true, status: true, deletedAt: true, city: true },
  });

  if (
    !deliveryPerson ||
    deliveryPerson.deletedAt ||
    deliveryPerson.status !== "ACTIVE"
  ) {
    return { error: "الحساب غير نشط", status: 403 };
  }

  return { user: current.user, deliveryPerson };
}

export async function GET(request: Request) {
  try {
    const auth = await requireDelivery();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "ACTIVE";

    // ACTIVE = PROCESSING + SHIPPED
    // COMPLETED = DELIVERED + RETURNED
    let statusFilter: any = {};
    if (status === "ACTIVE") {
      statusFilter = { in: ["PROCESSING", "SHIPPED"] };
    } else if (status === "COMPLETED") {
      statusFilter = { in: ["DELIVERED", "RETURNED"] };
    } else {
      statusFilter = status as any;
    }

    const orders = await prisma.order.findMany({
      where: {
        deliveryPersonId: auth.deliveryPerson.id,
        status: statusFilter,
      },
      include: {
        items: { take: 3 },
        _count: { select: { items: true } },
      },
      orderBy: { assignedAt: "desc" },
      take: 100,
    });

    const formatted = orders.map((o) => {
      const address = o.shippingAddressSnapshot as any;
      const customer = o.customerSnapshot as any;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: Number(o.total),
        assignedAt: o.assignedAt,
        createdAt: o.createdAt,
        itemsCount: o._count.items,
        customerName: address?.fullName || customer?.name || "—",
        customerPhone: address?.phone || customer?.phone || null,
        city: address?.city || null,
        street: address?.street || null,
        items: o.items.map((i) => ({
          productName: i.productName,
          variantName: i.variantName,
          imageUrl: i.imageUrl,
          quantity: i.quantity,
        })),
      };
    });

    return NextResponse.json({ success: true, orders: formatted });
  } catch (error) {
    console.error("Delivery orders GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}