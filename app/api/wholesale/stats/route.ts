import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.wholesaleSupplier) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const supplierId = current.user.wholesaleSupplier.id;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalOffers,
      activeOffers,
      totalMasters,
      pendingOrders,
      acceptedOrders,
      completedOrders,
      revenue30d,
      recentOrders,
      lowStockVariants,
    ] = await Promise.all([
      prisma.sellerOffer.count({
        where: { wholesaleSupplierId: supplierId, deletedAt: null },
      }),
      prisma.sellerOffer.count({
        where: { wholesaleSupplierId: supplierId, deletedAt: null, isActive: true },
      }),
      prisma.productMaster.count({
        where: { createdByUserId: current.user.id, deletedAt: null },
      }),
      prisma.wholesaleOrder.count({
        where: { supplierId, status: "PENDING" },
      }),
      prisma.wholesaleOrder.count({
        where: { supplierId, status: "ACCEPTED" },
      }),
      prisma.wholesaleOrder.count({
        where: { supplierId, status: "COMPLETED" },
      }),
      prisma.wholesaleOrder.aggregate({
        where: {
          supplierId,
          status: "COMPLETED",
          completedAt: { gte: thirtyDaysAgo },
        },
        _sum: { total: true },
      }),
      prisma.wholesaleOrder.findMany({
        where: { supplierId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          buyer: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.sellerOfferVariant.findMany({
        where: {
          offer: {
            wholesaleSupplierId: supplierId,
            isActive: true,
            deletedAt: null,
          },
          stock: { lt: 5 },
        },
        take: 10,
        include: {
          offer: {
            select: {
              id: true,
              master: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        totalOffers,
        activeOffers,
        totalMasters,
        pendingOrders,
        acceptedOrders,
        completedOrders,
        revenue30d: Number(revenue30d._sum.total || 0),
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: Number(o.total),
        itemCount: o._count.items,
        buyerName: o.buyer.name,
        createdAt: o.createdAt,
      })),
      lowStock: lowStockVariants.map((v) => ({
        variantId: v.id,
        stock: v.stock,
        sku: v.sku,
        offerId: v.offer.id,
        masterName: v.offer.master.name,
      })),
    });
  } catch (error) {
    console.error("Wholesale stats error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}