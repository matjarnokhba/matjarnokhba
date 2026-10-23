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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireWarehouse();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const shipmentId = parseInt(id);
    if (isNaN(shipmentId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        deliveryPerson: {
          include: {
            user: { select: { name: true, phone: true } },
          },
        },
        items: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                shippingAddressSnapshot: true,
                customerSnapshot: true,
                total: true,
              },
            },
            orderItem: {
              select: {
                id: true,
                productName: true,
                variantName: true,
                imageUrl: true,
                quantity: true,
                unitPrice: true,
                total: true,
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

    // ═══ استخراج المدينة والحي من أول طلب ═══
    let city: string | null = null;
    let district: string | null = null;
    let street: string | null = null;

    if (shipment.items.length > 0) {
      const addr = (shipment.items[0].order.shippingAddressSnapshot ||
        {}) as any;
      city = addr.city || null;
      district = addr.district || null;
      street = addr.street || null;
    }

    // ═══ Serialize Decimal → Number ═══
    const serialized = JSON.parse(
      JSON.stringify(
        {
          id: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          status: shipment.status,
          totalCOD: shipment.items.reduce((sum, item) => {
            if (!item.order?.id) return sum;
            // نحسب من كل orderId مرة واحدة فقط
            const firstForOrder = shipment.items.find((i) => i.orderId === item.orderId);
            if (firstForOrder && firstForOrder.id === item.id) {
              return sum + Number(item.order.total || 0);
            }
            return sum;
          }, 0),
          totalOrders: shipment.totalOrders,
          itemsCount: shipment.items.length,
          city,
          district,
          street,
          customer: shipment.customer
            ? {
                name: shipment.customer.name,
                phone: shipment.customer.phone,
                email: shipment.customer.email,
              }
            : null,
          deliveryPerson: shipment.deliveryPerson
            ? {
                name: shipment.deliveryPerson.user.name,
                phone: shipment.deliveryPerson.user.phone,
              }
            : null,
          assignedAt: shipment.assignedAt,
          createdAt: shipment.createdAt,
          notes: shipment.notes,
          items: shipment.items.map((si) => ({
            id: si.id,
            orderId: si.orderId,
            orderNumber: si.order.orderNumber,
            productName: si.orderItem.productName,
            variantName: si.orderItem.variantName,
            imageUrl: si.orderItem.imageUrl,
            quantity: si.quantity,
            unitPrice: si.orderItem.unitPrice,
            total: si.orderItem.total,
            codAmount: si.codAmount,
          })),
        },
        (_, value) => {
          if (typeof value === "bigint") return value.toString();
          if (
            value !== null &&
            typeof value === "object" &&
            typeof value.toNumber === "function" &&
            typeof value.toFixed === "function"
          ) {
            return value.toNumber();
          }
          return value;
        }
      )
    );

    return NextResponse.json({ success: true, shipment: serialized });
  } catch (error) {
    console.error("Shipment detail error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}