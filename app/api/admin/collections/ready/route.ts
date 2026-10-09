import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { PermissionService, PERMISSIONS } from "@/services/permission.service";

export async function GET() {
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
      PERMISSIONS.VIEW_COLLECTIONS
    );
    if (!canView) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const items = await prisma.fulfillmentItem.findMany({
      where: {
        status: "READY_FOR_COLLECTION",
        collectionItems: {
          none: {
            assignment: {
              status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] },
            },
          },
        },
      },
      include: {
        seller: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            city: true,
            region: true,
          },
        },
        orderItem: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: [{ sellerId: "asc" }, { readyAt: "asc" }],
      take: 300,
    });

    // تجميع حسب التاجر
    const bySeller = new Map<
      number,
      {
        sellerId: number;
        sellerName: string;
        sellerSlug: string;
        city: string | null;
        region: string | null;
        items: any[];
      }
    >();

    for (const item of items) {
      if (!bySeller.has(item.sellerId)) {
        bySeller.set(item.sellerId, {
          sellerId: item.sellerId,
          sellerName: item.seller.storeName,
          sellerSlug: item.seller.slug,
          city: item.seller.city,
          region: item.seller.region,
          items: [],
        });
      }

      bySeller.get(item.sellerId)!.items.push({
        id: item.id,
        orderId: item.orderItem.order.id,
        orderNumber: item.orderItem.order.orderNumber,
        productName: item.orderItem.productName,
        variantName: item.orderItem.variantName,
        sku: item.orderItem.sku,
        imageUrl: item.orderItem.imageUrl,
        quantity: item.quantity,
        readyAt: item.readyAt,
      });
    }

    return NextResponse.json({
      success: true,
      sellers: Array.from(bySeller.values()),
      totalItems: items.length,
    });
  } catch (error) {
    console.error("Ready for collection error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}