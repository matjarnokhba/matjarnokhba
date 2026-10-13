import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { ReturnShipmentService } from "@/services/return-shipment.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const returnId = parseInt(id);
    if (isNaN(returnId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const shipment = await prisma.returnShipment.findUnique({
      where: { returnId },
      include: {
        returnRequest: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
            order: {
              select: {
                id: true,
                orderNumber: true,
                customerSnapshot: true,
                shippingAddressSnapshot: true,
              },
            },
            items: {
              include: {
                orderItem: {
                  select: {
                    id: true,
                    productName: true,
                    variantName: true,
                    imageUrl: true,
                    quantity: true,
                    unitPrice: true,
                    seller: { select: { id: true, storeName: true, city: true } },
                  },
                },
              },
            },
          },
        },
        pickupDriver: {
          include: { user: { select: { name: true, phone: true } } },
        },
        returnDriver: {
          include: { user: { select: { name: true, phone: true } } },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, message: "شحنة الإرجاع غير موجودة" },
        { status: 404 }
      );
    }

    // ═══ فحص الصلاحية ═══
    const isAdmin =
      current.user.role === "ADMIN" || current.user.role === "SUPER_ADMIN";
    const isWarehouse = current.user.role === "WAREHOUSE_MANAGER";
    const isCustomer = shipment.returnRequest.userId === current.user.id;

    if (!isAdmin && !isWarehouse && !isCustomer) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    // ═══ QR للأدمن/المستودع فقط ═══
    let tokens: any = { pickupRaw: null, deliveryRaw: null };
    if (isAdmin || isWarehouse) {
      tokens = await ReturnShipmentService.getRawTokens(shipment.id);
    }

    const serialized = JSON.parse(
      JSON.stringify(
        {
          ...shipment,
          pickupRawToken: tokens?.pickupRaw || null,
          deliveryRawToken: tokens?.deliveryRaw || null,
        },
        (_, v) => {
          if (typeof v === "bigint") return v.toString();
          if (
            v !== null &&
            typeof v === "object" &&
            typeof v.toNumber === "function" &&
            typeof v.toFixed === "function"
          ) {
            return v.toNumber();
          }
          return v;
        }
      )
    );

    return NextResponse.json({ success: true, shipment: serialized });
  } catch (error) {
    console.error("Return shipment GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}