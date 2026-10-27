import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const userId = current.user.id;
    const sellerId = current.user.seller.id;

    const [
      notifications,
      ordersNew,
      fulfillmentsPending,
      returnsToConfirm,
      batchesToConfirm,
      productsPendingOwnerApproval,
      unreadList,
    ] = await Promise.all([
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.order.count({ where: { sellerId, status: "NEW" } }),
      prisma.fulfillmentItem.count({
        where: { sellerId, status: { in: ["PENDING", "PREPARING"] } },
      }),
      prisma.returnShipment.count({
        where: {
          status: "IN_TRANSIT_TO_SELLER",
          returnRequest: { order: { sellerId } },
        },
      }),
      prisma.sellerReturnBatch.count({
        where: { sellerId, status: "PICKED_UP" },
      }),
      prisma.product.count({
        where: { sellerId, pendingOwnerApproval: true, deletedAt: null },
      }),
      prisma.notification.findMany({
        where: { userId, isRead: false },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          message: true,
          link: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      counts: {
        notifications,
        ordersNew,
        fulfillmentsPending,
        returnsToConfirm,
        batchesToConfirm,
        productsPendingOwnerApproval,
      },
      notificationsList: unreadList,
    });
  } catch (error) {
    console.error("Seller topbar error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}