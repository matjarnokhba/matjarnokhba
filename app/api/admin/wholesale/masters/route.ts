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
    const verified = url.searchParams.get("verified"); // "true" | "false" | null
    const search = url.searchParams.get("search");
    const categoryId = url.searchParams.get("categoryId");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") || "30")));

    const where: any = { deletedAt: null };

    if (verified === "true") where.isVerified = true;
    else if (verified === "false") where.isVerified = false;

    if (categoryId) where.categoryId = parseInt(categoryId);

    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q } },
        { slug: { contains: q } },
      ];
    }

    const [total, masters] = await Promise.all([
      prisma.productMaster.count({ where }),
      prisma.productMaster.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          manufacturer: { select: { id: true, name: true } },
          _count: {
            select: {
              offers: { where: { deletedAt: null } },
              variants: true,
            },
          },
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
      masters: masters.map((m) => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        brand: m.brand,
        barcode: m.barcode,
        qrCode: m.qrCode,
        images: m.images,
        category: m.category,
        createdBy: m.createdBy,
        manufacturer: m.manufacturer,
        isVerified: m.isVerified,
        status: m.status,
        offerCount: m._count.offers,
        variantCount: m._count.variants,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("Admin masters error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}