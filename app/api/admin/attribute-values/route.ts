import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

// ═══ GET: قائمة القيم المعلّقة ═══
export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }
    if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "PENDING";

    const values = await prisma.categoryAttributeValue.findMany({
      where: {
        status: status as any,
        sellerId: { not: null },
      },
      include: {
        attribute: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
        },
        seller: {
          select: { id: true, storeName: true, slug: true },
        },
      },
      orderBy: { id: "desc" },
      take: 200,
    });

    return NextResponse.json({
      success: true,
      values: values.map((v) => ({
        id: v.id,
        value: v.value,
        colorHex: v.colorHex,
        status: v.status,
        createdAt: v.attribute.id, // مؤقت
        attributeName: v.attribute.name,
        attributeId: v.attribute.id,
        categoryName: v.attribute.category.name,
        categoryId: v.attribute.category.id,
        sellerId: v.seller?.id,
        sellerName: v.seller?.storeName,
        sellerSlug: v.seller?.slug,
      })),
    });
  } catch (error) {
    console.error("Attribute values GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}