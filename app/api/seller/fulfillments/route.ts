import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { PermissionService, PERMISSIONS } from "@/services/permission.service";

async function requireSeller() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };
  if (
    current.user.seller.status === "SUSPENDED" ||
    current.user.seller.status === "CLOSED"
  ) {
    return { error: "متجرك معطّل", status: 403 };
  }
  return { user: current.user, seller: current.user.seller };
}

// ═══════ GET — قائمة تجهيزات التاجر ═══════
export async function GET(request: Request) {
  try {
    const auth = await requireSeller();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status") || "ACTIVE";

    let where: any = { sellerId: auth.seller.id };

    if (statusFilter === "ACTIVE") {
      where.status = {
        in: ["PENDING", "PREPARING", "READY_FOR_COLLECTION"],
      };
    } else if (statusFilter === "IN_PROGRESS") {
      where.status = {
        in: [
          "COLLECTED",
          "IN_TRANSIT_TO_WAREHOUSE",
          "RECEIVED",
          "VERIFIED",
          "AVAILABLE_FOR_SHIPMENT",
          "ALLOCATED",
          "SHIPPED",
        ],
      };
    } else if (statusFilter === "COMPLETED") {
      where.status = { in: ["DELIVERED", "CANCELLED", "RETURNED"] };
    } else if (statusFilter !== "ALL") {
      where.status = statusFilter;
    }

    const now = new Date();

    const items = await prisma.fulfillmentItem.findMany({
      where,
      include: {
        orderItem: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                source: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: [{ deadline: "asc" }, { createdAt: "asc" }],
      take: 200,
    });

    const formatted = items.map((item) => ({
      id: item.id,
      orderId: item.orderItem.order.id,
      orderNumber: item.orderItem.order.orderNumber,
      orderSource: item.orderItem.order.source,
      orderStatus: item.orderItem.order.status,
      orderCreatedAt: item.orderItem.order.createdAt,
      productName: item.orderItem.productName,
      variantName: item.orderItem.variantName,
      sku: item.orderItem.sku,
      imageUrl: item.orderItem.imageUrl,
      quantity: item.quantity,
      status: item.status,
      deadline: item.deadline,
      preparedAt: item.preparedAt,
      readyAt: item.readyAt,
      collectedAt: item.collectedAt,
      warehouseReceivedAt: item.warehouseReceivedAt,
      createdAt: item.createdAt,
      isOverdue:
        item.deadline &&
        item.deadline < now &&
        ["PENDING", "PREPARING"].includes(item.status),
    }));

    // ═══ إحصائيات ═══
    const stats = {
      pending: formatted.filter((i) => i.status === "PENDING").length,
      preparing: formatted.filter((i) => i.status === "PREPARING").length,
      ready: formatted.filter((i) => i.status === "READY_FOR_COLLECTION")
        .length,
      overdue: formatted.filter((i) => i.isOverdue).length,
      total: formatted.length,
    };

    return NextResponse.json({
      success: true,
      fulfillments: formatted,
      stats,
    });
  } catch (error) {
    console.error("Seller fulfillments GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}