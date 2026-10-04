import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

function toSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
}

export async function POST(
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
    const attributeId = parseInt(id);
    const body = await request.json();

    const value = typeof body.value === "string" ? body.value.trim() : "";
    const colorHex =
      typeof body.colorHex === "string" && body.colorHex.trim()
        ? body.colorHex.trim()
        : null;

    if (!value || value.length < 1 || value.length > 60) {
      return NextResponse.json(
        { success: false, message: "القيمة مطلوبة (1-60 حرف)" },
        { status: 400 }
      );
    }

    const attr = await prisma.categoryAttribute.findUnique({
      where: { id: attributeId },
    });
    if (!attr) {
      return NextResponse.json(
        { success: false, message: "الخاصية غير موجودة" },
        { status: 404 }
      );
    }

    // القيم العامة فقط
    const existing = await prisma.categoryAttributeValue.findFirst({
      where: { attributeId, sellerId: null, value },
    });

    if (existing) {
      if (existing.status !== "APPROVED") {
        const updated = await prisma.categoryAttributeValue.update({
          where: { id: existing.id },
          data: { status: "APPROVED", isActive: true },
        });
        return NextResponse.json({
          success: true,
          value: {
            id: updated.id,
            value: updated.value,
            slug: updated.slug,
            colorHex: updated.colorHex,
          },
        });
      }
      return NextResponse.json({
        success: true,
        value: {
          id: existing.id,
          value: existing.value,
          slug: existing.slug,
          colorHex: existing.colorHex,
        },
      });
    }

    let slug = toSlug(value);
    if (!slug) slug = `v-${Date.now()}`;

    const existingSlug = await prisma.categoryAttributeValue.findFirst({
      where: { attributeId, sellerId: null, slug },
    });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const last = await prisma.categoryAttributeValue.findFirst({
      where: { attributeId, sellerId: null },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const newValue = await prisma.categoryAttributeValue.create({
      data: {
        attributeId,
        value,
        slug,
        colorHex,
        order: (last?.order ?? -1) + 1,
        isActive: true,
        status: "APPROVED",
        sellerId: null,
      },
    });

    return NextResponse.json({
      success: true,
      value: {
        id: newValue.id,
        value: newValue.value,
        slug: newValue.slug,
        colorHex: newValue.colorHex,
      },
    });
  } catch (error) {
    console.error("Admin add attribute value error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}