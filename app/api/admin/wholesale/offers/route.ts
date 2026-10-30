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
    const active = url.searchParams.get("active"); // "true" | "false" | null
    const claimType = url.searchParams.get("claimType");
    const supplierId = url.searchParams.get("supplierId");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") || "30")));

    const where: any = { deletedAt: null };

    if (active === "true") where.isActive = true;
    else if (active === "false") where.isActive = false;

    if (claimType && ["MANUFACTURER", "DISTRIBUTOR", "RESELLER"].includes(claimType)) {
      where.claimType = claimType;
    }

    if (supplierId) where.wholesaleSupplierId = parseInt(supplierId);

    const [total, offers] = await Promise.all([
      prisma.sellerOffer.count({ where }),
      prisma.sellerOffer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          master: {
            select: {
              id: true,
              name: true,
              slug: true,
              images: true,
              brand: true,
              barcode: true,
              isVerified: true,
            },
          },
          supplier: {
            select: {
              id: true,
              displayName: true,
              slug: true,
              isVerified: true,
              activityType: true,
              city: true,
            },
          },
          source: { select: { id: true, name: true, city: true } },
          variants: { select: { id: true, stock: true } },
          _count: { select: { orderItems: true } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      offers: offers.map((o) => ({
        id: o.id,
        master: o.master,
        supplier: o.supplier,
        source: o.source,
        wholesalePrice: Number(o.wholesalePrice),
        retailPrice: o.retailPrice ? Number(o.retailPrice) : null,
        minOrderQty: o.minOrderQty,
        unit: o.unit,
        claimType: o.claimType,
        claimVerified: o.claimVerified,
        isActive: o.isActive,
        totalStock: o.variants.reduce((s, v) => s + v.stock, 0),
        variantCount: o.variants.length,
        ordersCount: o._count.orderItems,
        createdAt: o.createdAt,
      })),
    });
  } catch (error) {
    console.error("Admin offers error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}