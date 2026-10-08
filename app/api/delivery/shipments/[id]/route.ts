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
    const shipmentId = parseInt(id);

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        items: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                customerSnapshot: true,
                shippingAddressSnapshot: true,
              },
            },
            orderItem: {
              select: {
                id: true,
                productName: true,
                variantName: true,
                quantity: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, message: "الشحنة غير موجودة" },
        { status: 404 }
      );
    }

    // ═══ التحقق: الشحنة مُسندة لهذا السائق ═══
    if (shipment.deliveryPersonId !== auth.person.id) {
      return NextResponse.json(
        { success: false, message: "هذه الشحنة ليست مُسندة إليك" },
        { status: 403 }
      );
    }

    // ═══ تجميع العناصر حسب الطلب ═══
    const ordersMap = new Map<number, any>();
    for (const item of shipment.items) {
      const oid = item.orderId;
      if (!ordersMap.has(oid)) {
        ordersMap.set(oid, {
          orderId: oid,
          orderNumber: item.order.orderNumber,
          customerSnapshot: item.order.customerSnapshot,
          shippingAddressSnapshot: item.order.shippingAddressSnapshot,
          items: [],
        });
      }
      ordersMap.get(oid).items.push({
        id: item.id,
        productName: item.orderItem.productName,
        variantName: item.orderItem.variantName,
        imageUrl: item.orderItem.imageUrl,
        quantity: item.quantity,
      });
    }

    return NextResponse.json({
      success: true,
      shipment: {
        id: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        status: shipment.status,
        totalCOD: Number(shipment.totalCOD),
        totalOrders: shipment.totalOrders,
        notes: shipment.notes,
        assignedAt: shipment.assignedAt,
        customer: shipment.customer,
        orders: Array.from(ordersMap.values()),
      },
    });
  } catch (error) {
    console.error("Delivery shipment detail error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}