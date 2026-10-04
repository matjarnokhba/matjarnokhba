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
    if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const categoryId = parseInt(id);

    const attributes = await prisma.categoryAttribute.findMany({
      where: { categoryId, isActive: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      include: {
        values: {
          where: {
            isActive: true,
            OR: [{ sellerId: null }, { status: "APPROVED" }],
          },
          orderBy: [{ order: "asc" }, { id: "asc" }],
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
          isOwn: true,
        })),
      })),
    });
  } catch (error) {
    console.error("Admin attributes GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}