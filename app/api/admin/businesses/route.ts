import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !["ADMIN", "SUPER_ADMIN"].includes(current.user.role)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status");
    const typeFilter = url.searchParams.get("type");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") || "30")));

    const where: any = { deletedAt: null };
    if (statusFilter && ["PENDING", "VERIFIED", "SUSPENDED", "REJECTED"].includes(statusFilter)) {
      where.status = statusFilter;
    }
    if (typeFilter && ["INDEPENDENT_SUPPLIER", "WHOLESALE_TRADER"].includes(typeFilter)) {
      where.type = typeFilter;
    }

    const [total, businesses] = await Promise.all([
      prisma.business.count({ where }),
      prisma.business.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { documents: true, productMasters: true, wholesaleOffers: true } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      businesses,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("Admin businesses GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}