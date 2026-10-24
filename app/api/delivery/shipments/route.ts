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

    let statusFilter: any = {};
    if (status === "ACTIVE") {
      statusFilter = { in: ["ASSIGNED", "IN_TRANSIT", "OUT_FOR_DELIVERY"] };
    } else if (status === "COMPLETED") {
      statusFilter = {
        in: ["DELIVERED", "REFUSED", "RETURNED", "PARTIALLY_DELIVERED"],
      };
    } else {
      statusFilter = status as any;
    }

    const shipments = await prisma.shipment.findMany({
      where: {
        deliveryPersonId: auth.person.id,
        status: statusFilter,
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        items: {
          select: {
            orderId: true,
            quantity: true,
            order: {
              select: {
                shippingAddressSnapshot: true,
                total: true,
              },
            },
          },
        },
      },
      orderBy: { assignedAt: "desc" },
      take: 100,
    });

    const formatted = shipments.map((s) => {
      let city: string | null = null;
      let calculatedCOD = 0;
      const uniqueOrders = new Set<number>();

      if (s.items.length > 0) {
        const firstAddress = s.items[0]?.order?.shippingAddressSnapshot as any;
        city = firstAddress?.city || null;

        for (const item of s.items) {
          if (!uniqueOrders.has(item.orderId)) {
            uniqueOrders.add(item.orderId);
            calculatedCOD += Number(item.order?.total || 0);
          }
        }
      }

      return {
        id: s.id,
        shipmentNumber: s.shipmentNumber,
        status: s.status,
        totalCOD: calculatedCOD,
        totalOrders: s.totalOrders,
        totalItems: s.items.length,
        customer: s.customer
          ? {
              name: s.customer.name,
              phone: s.customer.phone,
            }
          : null,
        city,
        assignedAt: s.assignedAt,
        completedAt: s.status === "DELIVERED" ? s.updatedAt : null,
        createdAt: s.createdAt,
      };
    });

    return NextResponse.json({ success: true, shipments: formatted });
  } catch (error) {
    console.error("Delivery shipments GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}