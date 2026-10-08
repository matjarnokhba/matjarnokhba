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

    // ═══ التحقق من الصلاحية ═══
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

    // ═══ الطلبات القابلة للتجميع ═══
    // (NEW / PROCESSING / SHIPPED — ليس DELIVERED أو CANCELLED)
    const orders = await prisma.order.findMany({
      where: {
        userId: customerId,
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

    // ═══ بناء الاستجابة (مع حساب العناصر المتبقية) ═══
    const formatted = orders.map((o) => {
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

      // لو كل العناصر مشحونة → لا نُظهر الطلب
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

    // نُظهر فقط الطلبات التي بها عناصر متبقية
    const available = formatted.filter((o) => o.hasRemaining);

    return NextResponse.json({
      success: true,
      customer,
      orders: available,
      totalOrders: available.length,
    });
  } catch (error) {
    console.error("Consolidated orders error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}