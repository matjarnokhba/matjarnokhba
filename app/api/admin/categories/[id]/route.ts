import { NextResponse } from "next/server";
import { z } from "zod";
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

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  slug: z.string().trim().min(2).max(100).optional(),
  image: z.string().trim().optional().nullable(),
  parentId: z.number().int().positive().optional().nullable(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// ═══════ PATCH — تعديل تصنيف ═══════
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const categoryId = parseInt(id);
    if (isNaN(categoryId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!existing || existing.deletedAt) {
      return NextResponse.json(
        { success: false, message: "التصنيف غير موجود" },
        { status: 404 }
      );
    }

    // slug منع التكرار
    let cleanSlug: string | undefined;
    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      cleanSlug = parsed.data.slug
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      const duplicate = await prisma.category.findUnique({
        where: { slug: cleanSlug },
      });
      if (duplicate && !duplicate.deletedAt) {
        return NextResponse.json(
          { success: false, message: "الرابط (slug) مستخدم" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(parsed.data.name && { name: parsed.data.name }),
        ...(cleanSlug && { slug: cleanSlug }),
        ...(parsed.data.image !== undefined && {
          image: parsed.data.image || null,
        }),
        ...(parsed.data.parentId !== undefined && {
          parentId: parsed.data.parentId || null,
        }),
        ...(parsed.data.order !== undefined && { order: parsed.data.order }),
        ...(parsed.data.isActive !== undefined && {
          isActive: parsed.data.isActive,
        }),
      },
    });

    return NextResponse.json({ success: true, category: updated });
  } catch (error) {
    console.error("Admin category PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ DELETE — Soft Delete ═══════
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const categoryId = parseInt(id);
    if (isNaN(categoryId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    // تحقق: هل يوجد منتجات في التصنيف؟
    const productCount = await prisma.product.count({
      where: { categoryId, deletedAt: null },
    });

    if (productCount > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن الحذف — يوجد ${productCount} منتج في هذا التصنيف`,
        },
        { status: 400 }
      );
    }

    await prisma.category.update({
      where: { id: categoryId },
      data: { deletedAt: new Date(), isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin category DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}