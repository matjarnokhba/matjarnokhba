import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { ShipmentQRService } from "@/services/shipment-qr.service";

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

    // ═══ البحث عبر Hash ═══
    const shipment = await ShipmentQRService.findByToken(token);
    if (!shipment) {
      return NextResponse.json(
        { success: false, message: "الشحنة غير موجودة" },
        { status: 404 }
      );
    }

    // ═══ التحقق: مُسندة لهذا السائق ═══
    if (shipment.deliveryPersonId !== auth.person.id) {
      return NextResponse.json(
        { success: false, message: "هذه الشحنة ليست مُسندة إليك" },
        { status: 403 }
      );
    }

    // ═══ التحقق: الحالة ═══
    if (!["ASSIGNED", "IN_TRANSIT"].includes(shipment.status)) {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن التصرف بهذه الشحنة — حالتها: ${shipment.status}`,
        },
        { status: 400 }
      );
    }

    // ═══ تجميع العناصر ═══
    const ordersMap = new Map<number, any>();
    for (const item of shipment.items) {
      const oid = item.orderId;
      if (!ordersMap.has(oid)) {
        ordersMap.set(oid, {
          orderId: oid,
          orderNumber: item.order.orderNumber,
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
        customer: shipment.customer,
        orders: Array.from(ordersMap.values()),
      },
    });
  } catch (error) {
    console.error("Delivery shipment by-token error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}