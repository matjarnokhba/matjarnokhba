import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { PermissionService, PERMISSIONS } from "@/services/permission.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    const canView = await PermissionService.hasPermission(
      current.user.id,
      PERMISSIONS.VIEW_CONSOLIDATED_ORDERS
    );
    if (!canView) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const { userId } = await params;
    const customerId = parseInt(userId);
    if (isNaN(customerId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    // ═══ بيانات العميل ═══
    const customer = await prisma.user.findUnique({
      where: { id: customerId },
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

    // ═══ FulfillmentItems المتاحة للشحن ═══
    const items = await prisma.fulfillmentItem.findMany({
      where: {
        status: "AVAILABLE_FOR_SHIPMENT",
        orderItem: {
          order: {
            userId: customerId,
            status: { in: ["NEW", "PROCESSING", "SHIPPED"] },
            source: { in: ["ONLINE", "IN_STORE"] },
          },
        },
      },
      include: {
        seller: {
          select: { id: true, storeName: true, slug: true },
        },
        orderItem: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                source: true,
                status: true,
                total: true,
                createdAt: true,
                items: { select: { id: true, total: true } },
              },
            },
            product: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [{ readyAt: "asc" }, { createdAt: "asc" }],
      take: 200,
    });

    // ═══ حساب COD لكل عنصر (Server-Side) ═══
    const formatted = items.map((item) => {
      const order = item.orderItem.order;
      const orderItemsTotal = order.items.reduce(
        (s, i) => s + Number(i.total),
        0
      );
      const itemRatio =
        orderItemsTotal > 0
          ? Number(item.orderItem.total) / orderItemsTotal
          : 0;
      const totalForThisItem = Number(order.total) * itemRatio;
      const perUnit = totalForThisItem / item.orderItem.quantity;
      const codAmount =
        Math.round(perUnit * item.quantity * 100) / 100;

      return {
        id: item.id,
        orderItemId: item.orderItem.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderSource: order.source,
        orderStatus: order.status,
        orderCreatedAt: order.createdAt,
        sellerId: item.sellerId,
        sellerName: item.seller.storeName,
        sellerSlug: item.seller.slug,
        productName: item.orderItem.productName,
        variantName: item.orderItem.variantName,
        sku: item.orderItem.sku,
        imageUrl: item.orderItem.imageUrl,
        quantity: item.quantity,
        status: item.status,
        verifiedAt: item.verifiedAt,
        codAmount,
      };
    });

    // ═══ تجميع حسب الطلب ═══
    const ordersMap = new Map<
      number,
      {
        orderId: number;
        orderNumber: string;
        source: string;
        status: string;
        createdAt: Date;
        totalCOD: number;
        items: typeof formatted;
      }
    >();

    for (const item of formatted) {
      if (!ordersMap.has(item.orderId)) {
        ordersMap.set(item.orderId, {
          orderId: item.orderId,
          orderNumber: item.orderNumber,
          source: item.orderSource,
          status: item.orderStatus,
          createdAt: item.orderCreatedAt,
          totalCOD: 0,
          items: [],
        });
      }
      const group = ordersMap.get(item.orderId)!;
      group.items.push(item);
      group.totalCOD =
        Math.round((group.totalCOD + item.codAmount) * 100) / 100;
    }

    const orders = Array.from(ordersMap.values());

    const totalCOD =
      Math.round(
        formatted.reduce((s, i) => s + i.codAmount, 0) * 100
      ) / 100;

    return NextResponse.json({
      success: true,
      customer,
      availableItems: formatted,
      orders,
      summary: {
        totalItems: formatted.length,
        totalOrders: orders.length,
        totalCOD,
      },
    });
  } catch (error) {
    console.error("Available items error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}