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
    if (!current.user.seller) {
      return NextResponse.json(
        { success: false, message: "ليس لديك متجر" },
        { status: 403 }
      );
    }

    const sellerId = current.user.seller.id;
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

    // ═══ البحث عن قيمة مطابقة ═══
    const existingSameValue = await prisma.categoryAttributeValue.findFirst({
      where: {
        attributeId,
        value,
        OR: [{ sellerId: null }, { sellerId }],
      },
    });

    if (existingSameValue) {
      if (existingSameValue.status === "REJECTED") {
        const updated = await prisma.categoryAttributeValue.update({
          where: { id: existingSameValue.id },
          data: {
            status: "PENDING",
            rejectionReason: null,
            reviewedAt: null,
            reviewedById: null,
            isActive: true,
          },
        });
        return NextResponse.json({
          success: true,
          value: {
            id: updated.id,
            value: updated.value,
            slug: updated.slug,
            colorHex: updated.colorHex,
          },
          status: "PENDING",
        });
      }

      return NextResponse.json({
        success: true,
        value: {
          id: existingSameValue.id,
          value: existingSameValue.value,
          slug: existingSameValue.slug,
          colorHex: existingSameValue.colorHex,
        },
        status: existingSameValue.status,
      });
    }

    let slug = toSlug(value);
    if (!slug) slug = `v-${Date.now()}`;

    const existingSlug = await prisma.categoryAttributeValue.findFirst({
      where: {
        attributeId,
        slug,
        OR: [{ sellerId: null }, { sellerId }],
      },
    });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const last = await prisma.categoryAttributeValue.findFirst({
      where: {
        attributeId,
        OR: [{ sellerId: null }, { sellerId }],
      },
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
        status: "PENDING",
        sellerId,
      },
    });

    try {
      const admins = await prisma.user.findMany({
        where: {
          role: { in: ["ADMIN", "SUPER_ADMIN"] },
          deletedAt: null,
        },
        select: { id: true },
      });

      const seller = await prisma.seller.findUnique({
        where: { id: sellerId },
        select: { storeName: true },
      });

      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            type: "SELLER_PRODUCT_NEEDS_REVIEW" as const,
            title: "🎨 قيمة جديدة تحتاج مراجعة",
            message: `بائع "${seller?.storeName || ""}" أضاف قيمة "${value}" لخاصية "${attr.name}"`,
            link: `/admin/attribute-values`,
            category: "PRODUCT",
            severity: "INFO",
            metadata: {
              valueId: newValue.id,
              attributeId,
              attributeName: attr.name,
              value,
              sellerId,
              sellerName: seller?.storeName,
            },
          })),
        });
      }
    } catch (notifErr) {
      console.error("Notification failed:", notifErr);
    }

    return NextResponse.json({
      success: true,
      value: {
        id: newValue.id,
        value: newValue.value,
        slug: newValue.slug,
        colorHex: newValue.colorHex,
      },
      status: "PENDING",
    });
  } catch (error) {
    console.error("Seller add attribute value error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}