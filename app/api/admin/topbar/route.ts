import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (
      !current ||
      (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const userId = current.user.id;

    const [
      notifications,
      sellersPending,
      productsPending,
      documentsPending,
      bankAccountsPending,
      withdrawalsPending,
      legalNoticesActive,
      handoverPending,
      unreadList,
    ] = await Promise.all([
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.seller.count({ where: { status: "PENDING", deletedAt: null } }),
      prisma.product.count({ where: { status: "DRAFT", deletedAt: null } }),
      prisma.sellerDocument.count({
        where: { status: "PENDING", deletedAt: null },
      }),
      prisma.sellerBankAccount.count({
        where: { verificationStatus: "PENDING", deletedAt: null },
      }),
      prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
      prisma.driverLegalNotice.count({
        where: { status: { in: ["WARNING", "ESCALATED"] } },
      }),
      prisma.adminCashHandover.count({ where: { status: "PENDING" } }),
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

    // ═══ Wholesale counts ═══
    const [
      wholesaleMastersPending,
      wholesaleOffersPending,
      wholesaleBUsPending,
      wholesaleReturnsPending,
    ] = await Promise.all([
      prisma.masterProduct.count({
        where: { status: "PENDING_REVIEW", deletedAt: null },
      }),
      prisma.wholesaleOffer.count({
        where: { status: "PENDING_REVIEW", deletedAt: null },
      }),
      prisma.businessUnit.count({
        where: {
          verificationStatus: "PENDING",
          deletedAt: null,
          status: "ACTIVE",
        },
      }),
      prisma.returnOrder.count({
        where: {
          status: { in: ["REQUESTED", "PENDING_SHIPMENT"] as any },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      counts: {
        notifications,
        sellersPending,
        productsPending,
        documentsPending,
        bankAccountsPending,
        withdrawalsPending,
        legalNoticesActive,
        handoverPending,
        wholesaleMastersPending,
        wholesaleOffersPending,
        wholesaleBUsPending,
        wholesaleReturnsPending,
      },
      notificationsList: unreadList,
    });
  } catch (error) {
    console.error("Admin topbar error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}