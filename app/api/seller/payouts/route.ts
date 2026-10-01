import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }
    if (!current.user.seller) {
      return NextResponse.json(
        { success: false, message: "ليس لديك متجر" },
        { status: 403 }
      );
    }

    const sellerId = current.user.seller.id;

    // ═══ الإيرادات الكلية ═══
    // كل الطلبات DELIVERED أو RETURNED (بعد خصم المرتجعات)
    const deliveredOrders = await prisma.order.findMany({
      where: {
        sellerId,
        status: { in: ["DELIVERED", "RETURNED"] },
      },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        sellerPayout: true,
        commission: true,
        refundedAmount: true,
        deliveredAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // ═══ Payouts المسجّلة ═══
    const payouts = await prisma.sellerPayout.findMany({
      where: { sellerId },
      orderBy: { periodEnd: "desc" },
    });

    // ═══ الحساب ═══
    const totalEarnings = deliveredOrders.reduce((sum, o) => {
      const payout = o.sellerPayout ? Number(o.sellerPayout) : Number(o.total);
      return sum + payout;
    }, 0);

    const totalPaidOut = payouts
      .filter((p) => p.status === "COMPLETED")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const pendingPayouts = payouts
      .filter((p) => p.status === "PENDING" || p.status === "PROCESSING")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const availableBalance = totalEarnings - totalPaidOut - pendingPayouts;

    // ═══ آخر 30 يوم ═══
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentEarnings = deliveredOrders
      .filter((o) => o.deliveredAt && o.deliveredAt >= thirtyDaysAgo)
      .reduce((sum, o) => {
        const payout = o.sellerPayout ? Number(o.sellerPayout) : Number(o.total);
        return sum + payout;
      }, 0);

    // ═══ هذا الشهر ═══
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthEarnings = deliveredOrders
      .filter((o) => o.deliveredAt && o.deliveredAt >= startOfMonth)
      .reduce((sum, o) => {
        const payout = o.sellerPayout ? Number(o.sellerPayout) : Number(o.total);
        return sum + payout;
      }, 0);

    return NextResponse.json({
      success: true,
      summary: {
        totalEarnings,
        totalPaidOut,
        pendingPayouts,
        availableBalance,
        recentEarnings,
        monthEarnings,
        totalOrdersCount: deliveredOrders.length,
      },
      recentOrders: deliveredOrders.slice(0, 20),
      payouts,
    });
  } catch (error) {
    console.error("Seller payouts GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}