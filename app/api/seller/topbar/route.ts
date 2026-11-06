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

    // ═══ Wholesale counts (if user has wholesale BUs) ═══
    let wholesaleOrdersIncoming = 0;
    let wholesaleReturnsPending = 0;
    try {
      const [wholeOwner, wholeMembers] = await Promise.all([
        prisma.businessOwner.findUnique({
          where: { userId },
          select: {
            businessUnits: {
              where: { deletedAt: null, status: "ACTIVE" },
              select: { id: true },
            },
          },
        }),
        prisma.businessUnitMember.findMany({
          where: { userId, isActive: true, deletedAt: null },
          select: { businessUnitId: true },
        }),
      ]);
      const wholeBUIds = [
        ...(wholeOwner?.businessUnits.map((b) => b.id) ?? []),
        ...wholeMembers.map((m) => m.businessUnitId),
      ];
      if (wholeBUIds.length > 0) {
        const [oCount, rCount] = await Promise.all([
          prisma.wholesaleOrder.count({
            where: {
              sellerBusinessUnitId: { in: wholeBUIds },
              status: "PENDING",
            },
          }),
          prisma.returnOrder.count({
            where: {
              sellerBusinessUnitId: { in: wholeBUIds },
              status: "REQUESTED",
            },
          }),
        ]);
        wholesaleOrdersIncoming = oCount;
        wholesaleReturnsPending = rCount;
      }
    } catch (e) {
      // Silently ignore — no wholesale access
    }

    return NextResponse.json({
      success: true,
      counts: {
        notifications,
        ordersNew,
        fulfillmentsPending,
        returnsToConfirm,
        batchesToConfirm,
        productsPendingOwnerApproval,
        wholesaleOrdersIncoming,
        wholesaleReturnsPending,
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