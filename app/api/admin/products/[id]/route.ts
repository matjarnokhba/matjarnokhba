import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

// ═══════ التحقق من الصلاحية ═══════
async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

// ═══════ تعديل منتج ═══════
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
    const productId = parseInt(id);
    const body = await request.json();

    const existing = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: { where: { isDefault: true } },
        images: { where: { isMain: true }, take: 1 },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    // التحقق من slug إن تغير
    if (body.slug && body.slug !== existing.slug) {
      const duplicate = await prisma.product.findUnique({
        where: { slug: body.slug },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, message: "الرابط (slug) مستخدم" },
          { status: 400 }
        );
      }
    }

    const variant = existing.variants[0];

    await prisma.$transaction(async (tx) => {
      // 1. المنتج
      await tx.product.update({
        where: { id: productId },
        data: {
          name: body.name,
          slug: body.slug,
          description: body.description || null,
          brand: body.brand || null,
          badge: body.badge || null,
          freeShipping: body.freeShipping ?? false,
          categoryId: body.categoryId,
        },
      });

      // 2. الصورة الرئيسية
      if (body.imageUrl && existing.images[0]) {
        await tx.productImage.update({
          where: { id: existing.images[0].id },
          data: { url: body.imageUrl },
        });
      }

      // 3. الـVariant
      if (variant) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: {
            price: body.price,
            discountPrice: body.oldPrice || null,
          },
        });

        // 4. Inventory
        await tx.inventory.updateMany({
          where: { variantId: variant.id },
          data: { quantity: body.stock ?? 0 },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Product update error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ حذف منتج (Soft Delete) ═══════
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
    const productId = parseInt(id);

    // Soft Delete
    await prisma.product.update({
      where: { id: productId },
      data: {
        deletedAt: new Date(),
        status: "INACTIVE",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Product delete error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}