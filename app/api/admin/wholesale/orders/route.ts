import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const supplierId = url.searchParams.get("supplierId");
    const buyerUserId = url.searchParams.get("buyerUserId");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") || "30")));

    const where: any = {};

    if (status && [
      "PENDING", "ACCEPTED", "REJECTED", "PREPARING", "READY", "COMPLETED", "CANCELLED"
    ].includes(status)) {
      where.status = status;
    }

    if (supplierId) where.supplierId = parseInt(supplierId);
    if (buyerUserId) where.buyerUserId = parseInt(buyerUserId);

    const [total, orders] = await Promise.all([
      prisma.wholesaleOrder.count({ where }),
      prisma.wholesaleOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          buyer: { select: { id: true, name: true, email: true, phone: true } },
          supplier: {
            select: { id: true, displayName: true, slug: true, city: true, isVerified: true },
          },
          _count: { select: { items: true } },
        },
      }),
    ]);

    // Status totals for dashboard
    const statusTotals = await prisma.wholesaleOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    return NextResponse.json({
      success: true,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      statusTotals: statusTotals.reduce(
        (acc, s) => ({ ...acc, [s.status]: s._count._all }),
        {}
      ),
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: Number(o.total),
        itemCount: o._count.items,
        buyer: o.buyer,
        supplier: o.supplier,
        notes: o.notes,
        rejectionReason: o.rejectionReason,
        createdAt: o.createdAt,
        acceptedAt: o.acceptedAt,
        completedAt: o.completedAt,
        cancelledAt: o.cancelledAt,
      })),
    });
  } catch (error) {
    console.error("Admin orders error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}