import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    if (!current.user.seller) {
      return NextResponse.json(
        { success: false, message: "تصفح الجملة متاح للتجار فقط" },
        { status: 403 }
      );
    }

    if (current.user.seller.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "متجرك غير نشط" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const categoryId = url.searchParams.get("categoryId");
    const search = url.searchParams.get("search");
    const city = url.searchParams.get("city");
    const minPrice = url.searchParams.get("minPrice");
    const maxPrice = url.searchParams.get("maxPrice");
    const supplierSlug = url.searchParams.get("supplier");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(48, Math.max(1, parseInt(url.searchParams.get("pageSize") || "24")));

    const where: any = {
      isActive: true,
      deletedAt: null,
      supplier: { status: "ACTIVE", deletedAt: null },
    };

    if (categoryId) {
      where.master = { categoryId: parseInt(categoryId), deletedAt: null };
    }

    if (supplierSlug) {
      where.supplier = { ...where.supplier, slug: supplierSlug };
    }

    if (city) {
      where.OR = [
        { supplier: { ...where.supplier, city } },
        { source: { city } },
      ];
    }

    if (minPrice || maxPrice) {
      where.wholesalePrice = {};
      if (minPrice) where.wholesalePrice.gte = Number(minPrice);
      if (maxPrice) where.wholesalePrice.lte = Number(maxPrice);
    }

    if (search && search.trim()) {
      where.master = {
        ...(where.master || {}),
        OR: [
          { name: { contains: search.trim(), mode: "insensitive" } },
          { brand: { contains: search.trim(), mode: "insensitive" } },
          { barcode: { contains: search.trim() } },
        ],
      };
    }

    const [total, offers] = await Promise.all([
      prisma.sellerOffer.count({ where }),
      prisma.sellerOffer.findMany({
        where,
        orderBy: [{ wholesalePrice: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          master: {
            select: {
              id: true,
              name: true,
              slug: true,
              brand: true,
              images: true,
              barcode: true,
              category: { select: { id: true, name: true, slug: true } },
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
              region: true,
            },
          },
          source: { select: { id: true, name: true, city: true } },
          variants: { select: { id: true, stock: true } },
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
        maxOrderQty: o.maxOrderQty,
        unit: o.unit,
        claimType: o.claimType,
        claimVerified: o.claimVerified,
        totalStock: o.variants.reduce((s, v) => s + v.stock, 0),
        variantCount: o.variants.length,
      })),
    });
  } catch (error) {
    console.error("Browse error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}