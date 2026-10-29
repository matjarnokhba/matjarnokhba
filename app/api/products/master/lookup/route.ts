import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  code: z.string().trim().min(3).max(100),
  codeType: z.enum(["BARCODE", "QR"]).default("BARCODE"),
});

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    // Require Seller OR WholesaleSupplier
    const hasSeller = !!current.user.seller;
    const hasSupplier = !!current.user.wholesaleSupplier;

    if (!hasSeller && !hasSupplier) {
      return NextResponse.json(
        {
          success: false,
          message: "البحث بالباركود متاح للتجار فقط",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const { code, codeType } = parsed.data;
    const trimmed = code.trim();

    // Lookup by barcode or QR — check master first, then variant
    let master = null;

    if (codeType === "BARCODE") {
      master = await prisma.productMaster.findFirst({
        where: { barcode: trimmed, deletedAt: null },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          manufacturer: { select: { id: true, name: true } },
          variants: {
            orderBy: { id: "asc" },
            select: { id: true, barcode: true, sku: true, options: true },
          },
          _count: { select: { offers: { where: { isActive: true, deletedAt: null } } } },
        },
      });

      // If not found in master, check variant barcode
      if (!master) {
        const variant = await prisma.productMasterVariant.findFirst({
          where: { barcode: trimmed },
          select: { masterId: true },
        });
        if (variant) {
          master = await prisma.productMaster.findUnique({
            where: { id: variant.masterId },
            include: {
              category: { select: { id: true, name: true, slug: true } },
              manufacturer: { select: { id: true, name: true } },
              variants: {
                orderBy: { id: "asc" },
                select: { id: true, barcode: true, sku: true, options: true },
              },
              _count: { select: { offers: { where: { isActive: true, deletedAt: null } } } },
            },
          });
        }
      }
    } else {
      master = await prisma.productMaster.findFirst({
        where: { qrCode: trimmed, deletedAt: null },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          manufacturer: { select: { id: true, name: true } },
          variants: {
            orderBy: { id: "asc" },
            select: { id: true, barcode: true, sku: true, options: true },
          },
          _count: { select: { offers: { where: { isActive: true, deletedAt: null } } } },
        },
      });
    }

    if (!master) {
      return NextResponse.json({
        success: true,
        found: false,
        code: trimmed,
        codeType,
      });
    }

    return NextResponse.json({
      success: true,
      found: true,
      master: {
        id: master.id,
        name: master.name,
        slug: master.slug,
        brand: master.brand,
        description: master.description,
        images: master.images,
        barcode: master.barcode,
        qrCode: master.qrCode,
        category: master.category,
        manufacturer: master.manufacturer,
        isVerified: master.isVerified,
        variantCount: master.variants.length,
        offerCount: master._count.offers,
        variants: master.variants,
      },
    });
  } catch (error) {
    console.error("Master lookup error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}