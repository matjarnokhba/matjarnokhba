import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { PermissionService, PERMISSIONS } from "@/services/permission.service";

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح", status: 403 };
  }
  const canView = await PermissionService.hasPermission(
    current.user.id,
    PERMISSIONS.VIEW_CONSOLIDATED_ORDERS
  );
  if (!canView) {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { token } = await params;

    // ═══ البحث عن الطلب بالـdeliveryToken ═══
    const order = await prisma.order.findFirst({
      where: { deliveryToken: token },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        status: true,
        source: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      );
    }

    // ═══ بيانات العميل ═══
    const customer = await prisma.user.findUnique({
      where: { id: order.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, message: "العميل غير موجود" },
        { status: 404 }
      );
    }

    // ═══ كل طلبات العميل القابلة للتجميع ═══
    const customerOrders = await prisma.order.findMany({
      where: {
        userId: order.userId,
        status: { in: ["NEW", "PROCESSING", "SHIPPED"] },
        source: { in: ["ONLINE", "IN_STORE"] },
      },
      include: {
        seller: { select: { id: true, storeName: true } },
        items: {
          include: {
            product: { select: { id: true, sellerId: true } },
          },
        },
        shipmentItems: {
          select: {
            id: true,
            shipmentId: true,
            quantity: true,
            orderItemId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // ═══ بناء الاستجابة ═══
    const formatted = customerOrders.map((o) => {
      const items = o.items.map((i) => {
        const shippedQty = o.shipmentItems
          .filter((si) => si.orderItemId === i.id)
          .reduce((sum, si) => sum + si.quantity, 0);

        const remainingQty = i.quantity - shippedQty;

        return {
          id: i.id,
          productName: i.productName,
          variantName: i.variantName,
          sku: i.sku,
          imageUrl: i.imageUrl,
          quantity: i.quantity,
          shippedQuantity: shippedQty,
          remainingQuantity: remainingQty,
          unitPrice: Number(i.unitPrice),
          total: Number(i.total),
          sellerId: i.product.sellerId,
        };
      });

      const hasRemaining = items.some((i) => i.remainingQuantity > 0);

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        source: o.source,
        total: Number(o.total),
        createdAt: o.createdAt,
        seller: o.seller
          ? { id: o.seller.id, storeName: o.seller.storeName }
          : null,
        items,
        hasRemaining,
      };
    });

    const available = formatted.filter((o) => o.hasRemaining);

    return NextResponse.json({
      success: true,
      scannedOrder: {
        id: order.id,
        orderNumber: order.orderNumber,
      },
      customer,
      orders: available,
      totalOrders: available.length,
    });
  } catch (error) {
    console.error("Admin order by-token error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}