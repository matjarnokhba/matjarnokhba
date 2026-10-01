import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireSeller() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };
  return { user: current.user, seller: current.user.seller };
}

const updateSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(2, "اسم المتجر يجب أن يكون حرفين على الأقل")
    .max(80)
    .optional(),
  description: z.string().trim().max(500).optional().nullable(),
  logo: z.string().url().optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  region: z.string().trim().max(80).optional().nullable(),
});

// ═══ GET — قراءة ملف المتجر ═══
export async function GET() {
  try {
    const auth = await requireSeller();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const seller = await prisma.seller.findUnique({
      where: { id: auth.seller.id },
      select: {
        id: true,
        storeName: true,
        slug: true,
        description: true,
        logo: true,
        city: true,
        region: true,
        status: true,
        isVerified: true,
        createdAt: true,
        _count: {
          select: {
            products: { where: { deletedAt: null } },
            orders: true,
          },
        },
      },
    });

    if (!seller) {
      return NextResponse.json(
        { success: false, message: "المتجر غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, seller });
  } catch (error) {
    console.error("Seller profile GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══ PATCH — تعديل ملف المتجر ═══
export async function PATCH(request: Request) {
  try {
    const auth = await requireSeller();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // ⚠️ ملاحظة: slug لا يُعدَّل — لأنه يؤثر على كل روابط المنتجات
    const updated = await prisma.seller.update({
      where: { id: auth.seller.id },
      data: {
        ...(data.storeName !== undefined && {
          storeName: data.storeName.trim(),
        }),
        ...(data.description !== undefined && {
          description: data.description || null,
        }),
        ...(data.logo !== undefined && { logo: data.logo || null }),
        ...(data.city !== undefined && { city: data.city || null }),
        ...(data.region !== undefined && { region: data.region || null }),
      },
    });

    return NextResponse.json({
      success: true,
      seller: {
        id: updated.id,
        storeName: updated.storeName,
        slug: updated.slug,
        description: updated.description,
        logo: updated.logo,
        city: updated.city,
        region: updated.region,
      },
    });
  } catch (error) {
    console.error("Seller profile PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}