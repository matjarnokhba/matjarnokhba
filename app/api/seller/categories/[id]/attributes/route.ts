import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;
    const categoryId = parseInt(id);

    const attributes = await prisma.categoryAttribute.findMany({
      where: { categoryId, isActive: true },
      orderBy: { order: "asc" },
      include: {
        values: {
          where: {
            isActive: true,
            OR: [
              { sellerId: null, status: "APPROVED" },
              { sellerId },
            ],
          },
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      attributes: attributes.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        type: a.type,
        isVariantAxis: a.isVariantAxis,
        isRequired: a.isRequired,
        allowCustom: a.allowCustom,
        values: a.values.map((v) => ({
          id: v.id,
          value: v.value,
          slug: v.slug,
          colorHex: v.colorHex,
          status: v.status,
          isOwn: v.sellerId === sellerId,
        })),
      })),
    });
  } catch (error) {
    console.error("Seller attributes GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}