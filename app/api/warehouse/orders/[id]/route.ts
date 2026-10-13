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
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                productCode: true,
              },
            },
            fulfillmentItems: {
              select: {
                id: true,
                status: true,
                quantity: true,
                sellerId: true,
                readyAt: true,
                collectedAt: true,
                warehouseReceivedAt: true,
                verifiedAt: true,
              },
            },
          },
        },
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            city: true,
            region: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          take: 30,
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      );
    }

    // ═══ طلبات العميل الأخرى (لعرض السياق الكامل) ═══
    const customerOtherOrders = await prisma.order.findMany({
      where: {
        userId: order.userId,
        id: { not: orderId },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            productName: true,
            imageUrl: true,
            quantity: true,
            fulfillmentItems: {
              select: {
                id: true,
                status: true,
                sellerId: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // ═══ دمج الطلب + طلبات العميل الأخرى ═══
    const combined = {
      ...order,
      customerOtherOrders,
    };

    // ═══ Serialize Decimal → Number ═══
    const serialized = JSON.parse(
      JSON.stringify(combined, (_, value) => {
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
      })
    );

    return NextResponse.json({ success: true, order: serialized });
  } catch (error) {
    console.error("Warehouse order detail error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}