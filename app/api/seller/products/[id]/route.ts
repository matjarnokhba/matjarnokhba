import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

// ═══════ التحقق من صلاحية البائع + الملكية ═══════
async function requireSellerOwnership(productId: number) {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: { where: { isDefault: true } },
    },
  });

  if (!product || product.deletedAt) {
    return { error: "المنتج غير موجود", status: 404 };
  }

  // ═══ التحقق من الملكية ═══
  if (product.sellerId !== current.user.seller.id) {
    return { error: "غير مصرح", status: 403 };
  }

  return { user: current.user, seller: current.user.seller, product };
}

const updateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  slug: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  brand: z.string().trim().max(80).optional().nullable(),
  badge: z.string().trim().max(40).optional().nullable(),
  categoryId: z.number().int().positive().optional(),
  price: z.number().positive().optional(),
  oldPrice: z.number().positive().optional().nullable(),
  stock: z.number().int().min(0).optional(),
  freeShipping: z.boolean().optional(),
  imageUrls: z.array(z.string().url()).min(1).max(5).optional(),
});

// ═══════════════════════════════════════════
// GET — تفاصيل منتج واحد (للتعديل)
// ═══════════════════════════════════════════
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const auth = await requireSellerOwnership(productId);
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { product } = auth;

    // جلب الصور
    const images = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { order: "asc" },
      select: { url: true },
    });

    const variant = product.variants[0];
    const inventory = variant
      ? await prisma.inventory.findUnique({
          where: { variantId: variant.id },
        })
      : null;

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description || "",
        brand: product.brand || "",
        badge: product.badge || "",
        categoryId: product.categoryId,
        price: variant ? Number(variant.price) : 0,
        oldPrice: variant?.discountPrice ? Number(variant.discountPrice) : null,
        stock: inventory?.quantity || 0,
        freeShipping: product.freeShipping,
        imageUrls: images.map((i) => i.url),
        status: product.status,
      },
    });
  } catch (error) {
    console.error("Seller product GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════
// PATCH — تعديل منتج
// ═══════════════════════════════════════════
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const auth = await requireSellerOwnership(productId);
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
    const { product } = auth;

    // ═══ التحقق من slug مكرر (ضمن منتجات البائع) ═══
    let cleanSlug: string | undefined;
    if (data.slug && data.slug !== product.slug) {
      cleanSlug = data.slug
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      const duplicate = await prisma.product.findFirst({
        where: {
          sellerId: product.sellerId,
          slug: cleanSlug,
          deletedAt: null,
          id: { not: productId },
        },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, message: "الرابط (slug) مستخدم في منتجاتك" },
          { status: 400 }
        );
      }
    }

    // ═══ تعديل في transaction ═══
    await prisma.$transaction(async (tx) => {
      // 1. تعديل Product
      await tx.product.update({
        where: { id: productId },
        data: {
          ...(data.name && { name: data.name }),
          ...(cleanSlug && { slug: cleanSlug }),
          ...(data.description !== undefined && {
            description: data.description || null,
          }),
          ...(data.brand !== undefined && { brand: data.brand || null }),
          ...(data.badge !== undefined && { badge: data.badge || null }),
          ...(data.categoryId && { categoryId: data.categoryId }),
          ...(data.freeShipping !== undefined && {
            freeShipping: data.freeShipping,
          }),
        },
      });

      // 2. تعديل الصور (استبدال كامل)
      if (data.imageUrls && data.imageUrls.length > 0) {
        await tx.productImage.deleteMany({ where: { productId } });
        await tx.productImage.createMany({
          data: data.imageUrls.map((url, idx) => ({
            productId,
            url,
            order: idx,
            isMain: idx === 0,
          })),
        });
      }

      // 3. تعديل Variant + Inventory
      const variant = product.variants[0];
      if (variant) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: {
            ...(data.price !== undefined && { price: data.price }),
            ...(data.oldPrice !== undefined && {
              discountPrice: data.oldPrice || null,
            }),
          },
        });

        if (data.stock !== undefined) {
          await tx.inventory.upsert({
            where: { variantId: variant.id },
            update: { quantity: data.stock },
            create: {
              variantId: variant.id,
              quantity: data.stock,
              reservedQuantity: 0,
              lowStockThreshold: 5,
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Seller product PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════
// DELETE — Soft Delete (من البائع)
// ═══════════════════════════════════════════
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const auth = await requireSellerOwnership(productId);
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    await prisma.product.update({
      where: { id: productId },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Seller product DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}