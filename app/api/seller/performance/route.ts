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

    // ═══ أداء التاجر ═══
    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      select: {
        totalOrders: true,
        totalRevenue: true,
        totalCommission: true,
        acceptanceRate: true,
        cancellationRate: true,
        codRejectionRate: true,
        returnRate: true,
        avgRating: true,
        avgProcessingHours: true,
        lastPerformanceUpdate: true,
        createdAt: true,
      },
    });

    // ═══ الطلبات الأخيرة (آخر 30 يوم) ═══
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentOrders = await prisma.order.groupBy({
      by: ["status"],
      where: {
        sellerId,
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: true,
    });

    const recent: any = {
      NEW: 0,
      PROCESSING: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
      RETURNED: 0,
      total: 0,
    };
    for (const s of recentOrders) {
      recent[s.status] = s._count;
      recent.total += s._count;
    }

    // ═══ الإيرادات الشهرية (آخر 6 شهور) ═══
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyOrders = await prisma.order.findMany({
      where: {
        sellerId,
        status: { in: ["DELIVERED", "RETURNED"] },
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        total: true,
        sellerPayout: true,
        createdAt: true,
      },
    });

    const monthlyData: Record<string, { revenue: number; orders: number }> = {};
    for (const o of monthlyOrders) {
      const key = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyData[key]) monthlyData[key] = { revenue: 0, orders: 0 };
      monthlyData[key].revenue += Number(o.sellerPayout || o.total);
      monthlyData[key].orders += 1;
    }

    return NextResponse.json({
      success: true,
      seller,
      recent,
      monthly: monthlyData,
    });
  } catch (error) {
    console.error("Seller performance GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}