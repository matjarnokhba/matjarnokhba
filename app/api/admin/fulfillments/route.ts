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
      PERMISSIONS.VIEW_FULFILLMENTS
    );
    if (!canView) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const filter = url.searchParams.get("filter") || "ACTIVE";
    const sellerId = url.searchParams.get("sellerId");
    const search = url.searchParams.get("q")?.trim() || "";

    let statuses: string[] = [];
    if (filter === "ACTIVE") {
      statuses = ["PENDING", "PREPARING", "READY_FOR_COLLECTION"];
    } else if (filter === "IN_TRANSIT") {
      statuses = [
        "COLLECTED",
        "IN_TRANSIT_TO_WAREHOUSE",
        "RECEIVED",
        "VERIFIED",
        "AVAILABLE_FOR_SHIPMENT",
        "ALLOCATED",
        "SHIPPED",
      ];
    } else if (filter === "COMPLETED") {
      statuses = ["DELIVERED", "CANCELLED", "RETURNED"];
    } else if (filter === "OVERDUE") {
      statuses = ["PENDING", "PREPARING"];
    }

    const where: any = {};

    if (statuses.length > 0) {
      where.status = { in: statuses };
    }

    if (sellerId) {
      where.sellerId = parseInt(sellerId);
    }

    if (filter === "OVERDUE") {
      where.deadline = { lt: new Date() };
    }

    if (search) {
      where.OR = [
        { orderItem: { productName: { contains: search, mode: "insensitive" } } },
        { orderItem: { order: { orderNumber: { contains: search, mode: "insensitive" } } } },
        { seller: { storeName: { contains: search, mode: "insensitive" } } },
      ];
    }

    const items = await prisma.fulfillmentItem.findMany({
      where,
      include: {
        seller: {
          select: { id: true, storeName: true, slug: true, city: true },
        },
        orderItem: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                source: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: [{ deadline: "asc" }, { createdAt: "asc" }],
      take: 200,
    });

    const now = new Date();

    const formatted = items.map((item) => ({
      id: item.id,
      status: item.status,
      quantity: item.quantity,
      deadline: item.deadline,
      preparedAt: item.preparedAt,
      readyAt: item.readyAt,
      collectedAt: item.collectedAt,
      warehouseReceivedAt: item.warehouseReceivedAt,
      verifiedAt: item.verifiedAt,
      createdAt: item.createdAt,
      sellerId: item.sellerId,
      sellerName: item.seller.storeName,
      sellerCity: item.seller.city,
      orderId: item.orderItem.order.id,
      orderNumber: item.orderItem.order.orderNumber,
      orderSource: item.orderItem.order.source,
      orderStatus: item.orderItem.order.status,
      orderCreatedAt: item.orderItem.order.createdAt,
      productName: item.orderItem.productName,
      variantName: item.orderItem.variantName,
      sku: item.orderItem.sku,
      imageUrl: item.orderItem.imageUrl,
      isOverdue:
        item.deadline !== null &&
        item.deadline < now &&
        ["PENDING", "PREPARING"].includes(item.status),
    }));

    const stats = {
      pending: formatted.filter((i) => i.status === "PENDING").length,
      preparing: formatted.filter((i) => i.status === "PREPARING").length,
      ready: formatted.filter((i) => i.status === "READY_FOR_COLLECTION").length,
      inTransit: formatted.filter((i) =>
        [
          "COLLECTED",
          "IN_TRANSIT_TO_WAREHOUSE",
          "RECEIVED",
          "VERIFIED",
        ].includes(i.status)
      ).length,
      available: formatted.filter(
        (i) => i.status === "AVAILABLE_FOR_SHIPMENT"
      ).length,
      overdue: formatted.filter((i) => i.isOverdue).length,
      total: formatted.length,
    };

    const sellers = await prisma.seller.findMany({
      where: { deletedAt: null },
      select: { id: true, storeName: true },
      orderBy: { storeName: "asc" },
    });

    return NextResponse.json({
      success: true,
      fulfillments: formatted,
      stats,
      sellers,
    });
  } catch (error) {
    console.error("Admin fulfillments GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}