import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { PermissionService, PERMISSIONS } from "@/services/permission.service";

export async function GET(request: Request) {
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
      PERMISSIONS.VIEW_WAREHOUSE
    );
    if (!canView) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const tab = url.searchParams.get("tab") || "INCOMING";

    let statuses: string[];
    if (tab === "INCOMING") {
      // في الطريق للمستودع + في المستودع + تم التحقق (بانتظار الشحن)
      statuses = [
        "IN_TRANSIT_TO_WAREHOUSE",
        "RECEIVED",
        "VERIFIED",
        "AVAILABLE_FOR_SHIPMENT",
      ];
    } else if (tab === "DAMAGED") {
      statuses = ["RETURNED"];
    } else {
      statuses = [
        "IN_TRANSIT_TO_WAREHOUSE",
        "RECEIVED",
        "VERIFIED",
        "AVAILABLE_FOR_SHIPMENT",
      ];
    }

    const items = await prisma.fulfillmentItem.findMany({
      where: { status: { in: statuses as any } },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            city: true,
          },
        },
        orderItem: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                userId: true,
                customerSnapshot: true,
              },
            },
          },
        },
        warehouseReceipts: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [
        { status: "asc" },
        { warehouseReceivedAt: "asc" },
        { departedAt: "asc" },
      ],
      take: 300,
    });

    const formatted = items.map((item) => ({
      id: item.id,
      status: item.status,
      quantity: item.quantity,
      sellerId: item.sellerId,
      sellerName: item.seller.storeName,
      sellerCity: item.seller.city,
      orderId: item.orderItem.order.id,
      orderNumber: item.orderItem.order.orderNumber,
      customerId: item.orderItem.order.userId,
      productName: item.orderItem.productName,
      variantName: item.orderItem.variantName,
      sku: item.orderItem.sku,
      imageUrl: item.orderItem.imageUrl,
      departedAt: item.departedAt,
      warehouseReceivedAt: item.warehouseReceivedAt,
      verifiedAt: item.verifiedAt,
      latestReceipt: item.warehouseReceipts[0]
        ? {
            id: item.warehouseReceipts[0].id,
            receiptNumber: item.warehouseReceipts[0].receiptNumber,
            status: item.warehouseReceipts[0].status,
            quantity: item.warehouseReceipts[0].quantity,
            damagedQuantity: item.warehouseReceipts[0].damagedQuantity,
          }
        : null,
    }));

    // ═══ إحصائيات ═══
    const stats = {
      inTransit: formatted.filter(
        (i) => i.status === "IN_TRANSIT_TO_WAREHOUSE"
      ).length,
      received: formatted.filter((i) => i.status === "RECEIVED").length,
      verified: formatted.filter((i) => i.status === "VERIFIED").length,
      available: formatted.filter(
        (i) => i.status === "AVAILABLE_FOR_SHIPMENT"
      ).length,
    };

    return NextResponse.json({
      success: true,
      items: formatted,
      stats,
    });
  } catch (error) {
    console.error("Warehouse incoming error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}