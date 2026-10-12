import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireWarehouse() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const allowed = ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }

  return { user: current.user };
}

export async function GET(request: Request) {
  try {
    const auth = await requireWarehouse();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "ACTIVE";

    let statusFilter: any;
    if (status === "ACTIVE") {
      statusFilter = {
        in: ["READY", "ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"],
      };
    } else if (status === "COMPLETED") {
      statusFilter = {
        in: ["DELIVERED", "PARTIALLY_DELIVERED", "REFUSED", "RETURNED"],
      };
    } else {
      statusFilter = status;
    }

    const shipments = await prisma.shipment.findMany({
      where: { status: statusFilter },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        deliveryPerson: {
          include: {
            user: { select: { name: true, phone: true } },
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            order: {
              select: {
                shippingAddressSnapshot: true,
              },
            },
          },
        },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const formatted = shipments.map((s) => {
      let city: string | null = null;
      let district: string | null = null;

      if (s.items.length > 0) {
        const addr = (s.items[0]?.order?.shippingAddressSnapshot || {}) as any;
        city = addr.city || null;
        district = addr.district || null;
      }

      return {
        id: s.id,
        shipmentNumber: s.shipmentNumber,
        status: s.status,
        totalCOD: Number(s.totalCOD),
        totalOrders: s.totalOrders,
        itemsCount: s._count.items,
        city,
        district,
        customer: s.customer
          ? {
              name: s.customer.name,
              phone: s.customer.phone,
            }
          : null,
        deliveryPerson: s.deliveryPerson
          ? {
              name: s.deliveryPerson.user.name,
              phone: s.deliveryPerson.user.phone,
            }
          : null,
        assignedAt: s.assignedAt,
        createdAt: s.createdAt,
      };
    });

    return NextResponse.json({ success: true, shipments: formatted });
  } catch (error) {
    console.error("Warehouse shipments GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}