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

const patchSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  brand: z.string().trim().max(80).nullable().optional(),
  badge: z.string().trim().max(40).nullable().optional(),
  categoryId: z.number().int().positive().optional(),
  price: z.number().positive().optional(),
  oldPrice: z.number().positive().nullable().optional(),
  stock: z.number().int().min(0).optional(),
  freeShipping: z.boolean().optional(),
  imageUrls: z.array(z.string().url()).min(1).max(5).optional(),
  originCountry: z.string().trim().max(80).nullable().optional(),
  videoUrl: z.string().trim().nullable().optional(),
  minOrderQty: z.number().int().min(1).optional(),
  maxOrderQty: z.number().int().min(1).nullable().optional(),
  barcode: z.string().trim().nullable().optional(),
});

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
    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
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

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: { orderBy: { order: "asc" } },
        variants: {
          orderBy: { id: "asc" },
          include: { inventory: { select: { quantity: true } } },
        },
      },
    });

    if (!product || product.deletedAt) {
      return NextResponse.json(
        { success: false, message: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    const hasVariants = product.variants.length > 1;
    if (hasVariants && (data.price !== undefined || data.stock !== undefined)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "لا يمكن تعديل السعر/المخزون الأساسي عند وجود متغيرات متعددة.",
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.description !== undefined)
        updateData.description = data.description?.trim() || null;
      if (data.brand !== undefined)
        updateData.brand = data.brand?.trim() || null;
      if (data.badge !== undefined)
        updateData.badge = data.badge?.trim() || null;
      if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
      if (data.freeShipping !== undefined)
        updateData.freeShipping = data.freeShipping;
      if (data.originCountry !== undefined)
        updateData.originCountry = data.originCountry?.trim() || null;
      if (data.videoUrl !== undefined)
        updateData.videoUrl = data.videoUrl?.trim() || null;
      if (data.minOrderQty !== undefined)
        updateData.minOrderQty = data.minOrderQty;
      if (data.maxOrderQty !== undefined)
        updateData.maxOrderQty = data.maxOrderQty || null;

      if (Object.keys(updateData).length > 0) {
        await tx.product.update({
          where: { id: productId },
          data: updateData,
        });
      }

      if (data.imageUrls !== undefined) {
        await tx.productImage.deleteMany({ where: { productId } });
        await tx.productImage.createMany({
          data: data.imageUrls.map((url, i) => ({
            productId,
            url: url.trim(),
            order: i,
            isMain: i === 0,
          })),
        });
      }

      if (!hasVariants && product.variants.length > 0) {
        const defaultVariant = product.variants[0];
        const variantUpdate: Record<string, unknown> = {};
        if (data.price !== undefined) variantUpdate.price = data.price;
        if (data.oldPrice !== undefined)
          variantUpdate.discountPrice = data.oldPrice || null;
        if (data.barcode !== undefined)
          variantUpdate.barcode = data.barcode?.trim() || null;

        if (Object.keys(variantUpdate).length > 0) {
          await tx.productVariant.update({
            where: { id: defaultVariant.id },
            data: variantUpdate,
          });
        }

        if (data.stock !== undefined) {
          await tx.inventory.updateMany({
            where: { variantId: defaultVariant.id },
            data: { quantity: data.stock },
          });
        }
      }

      return { id: productId };
    });

    return NextResponse.json({ success: true, product: result });
  } catch (error) {
    console.error("Admin product PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء حفظ التعديلات" },
      { status: 500 }
    );
  }
}