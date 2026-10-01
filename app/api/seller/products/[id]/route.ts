import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

// ═══════ حدود السعر — تُقارن ضد السعر الأصلي (originalPrice) ═══════
const MIN_PRICE_RATIO = 0.5;
const MAX_PRICE_RATIO = 2.0;

async function requireSellerOwnership(productId: number) {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: { where: { isDefault: true } },
      images: { orderBy: { order: "asc" } },
    },
  });

  if (!product || product.deletedAt) {
    return { error: "المنتج غير موجود", status: 404 };
  }

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
// GET — تفاصيل منتج واحد
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
        originalPrice: variant?.originalPrice
          ? Number(variant.originalPrice)
          : variant
            ? Number(variant.price)
            : 0,
        oldPrice: variant?.discountPrice
          ? Number(variant.discountPrice)
          : null,
        stock: inventory?.quantity || 0,
        freeShipping: product.freeShipping,
        imageUrls: product.images.map((i) => i.url),
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
// PATCH — تعديل منتج (مع تسجيل كامل)
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
    const variant = product.variants[0];
    const currentInventory = variant
      ? await prisma.inventory.findUnique({ where: { variantId: variant.id } })
      : null;

    // ═══════ التحقق من slug ═══════
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

    // ═══════════════════════════════════════════
    // 📋 كشف كل التغييرات
    // ═══════════════════════════════════════════
    const changes: Array<{
      field: string;
      oldValue: any;
      newValue: any;
      sensitive: boolean;
    }> = [];

    if (data.name !== undefined && data.name !== product.name) {
      changes.push({
        field: "الاسم",
        oldValue: product.name,
        newValue: data.name,
        sensitive: true,
      });
    }

    if (cleanSlug && cleanSlug !== product.slug) {
      changes.push({
        field: "الرابط",
        oldValue: product.slug,
        newValue: cleanSlug,
        sensitive: true,
      });
    }

    if (
      data.description !== undefined &&
      (data.description || null) !== product.description
    ) {
      changes.push({
        field: "الوصف",
        oldValue: product.description,
        newValue: data.description,
        sensitive: true,
      });
    }

    if (data.brand !== undefined && (data.brand || null) !== product.brand) {
      changes.push({
        field: "الماركة",
        oldValue: product.brand,
        newValue: data.brand,
        sensitive: true,
      });
    }

    if (data.badge !== undefined && (data.badge || null) !== product.badge) {
      changes.push({
        field: "الشارة",
        oldValue: product.badge,
        newValue: data.badge,
        sensitive: true,
      });
    }

    if (data.categoryId && data.categoryId !== product.categoryId) {
      changes.push({
        field: "التصنيف",
        oldValue: product.categoryId,
        newValue: data.categoryId,
        sensitive: true,
      });
    }

    if (data.imageUrls && data.imageUrls.length > 0) {
      const currentUrls = product.images.map((i) => i.url);
      if (JSON.stringify(currentUrls) !== JSON.stringify(data.imageUrls)) {
        changes.push({
          field: "الصور",
          oldValue: currentUrls,
          newValue: data.imageUrls,
          sensitive: true,
        });
      }
    }

    // ═══════ السعر — يُقارن ضد originalPrice ═══════
    let priceOutOfRange = false;
    let priceWarning: string | null = null;

    if (data.price !== undefined && variant) {
      const currentPrice = Number(variant.price);
      const originalPrice = variant.originalPrice
        ? Number(variant.originalPrice)
        : currentPrice;

      if (data.price !== currentPrice) {
        const minPrice = originalPrice * MIN_PRICE_RATIO;
        const maxPrice = originalPrice * MAX_PRICE_RATIO;

        if (data.price < minPrice) {
          priceOutOfRange = true;
          priceWarning = `السعر الجديد (${data.price}) أقل من 50% من السعر الأصلي (${originalPrice})`;
        } else if (data.price > maxPrice) {
          priceOutOfRange = true;
          priceWarning = `السعر الجديد (${data.price}) يتجاوز ضعف السعر الأصلي (${originalPrice})`;
        }

        changes.push({
          field: "السعر",
          oldValue: currentPrice,
          newValue: data.price,
          sensitive: priceOutOfRange,
        });
      }
    }

    if (data.oldPrice !== undefined) {
      const currentOld = variant?.discountPrice
        ? Number(variant.discountPrice)
        : null;
      const newOld = data.oldPrice || null;
      if (currentOld !== newOld) {
        changes.push({
          field: "السعر القديم",
          oldValue: currentOld,
          newValue: newOld,
          sensitive: false,
        });
      }
    }

    if (data.stock !== undefined) {
      const currentStock = currentInventory?.quantity ?? 0;
      if (data.stock !== currentStock) {
        changes.push({
          field: "المخزون",
          oldValue: currentStock,
          newValue: data.stock,
          sensitive: false,
        });
      }
    }

    if (
      data.freeShipping !== undefined &&
      data.freeShipping !== product.freeShipping
    ) {
      changes.push({
        field: "شحن مجاني",
        oldValue: product.freeShipping,
        newValue: data.freeShipping,
        sensitive: false,
      });
    }

    // ═══════ هل يحتاج موافقة؟ ═══════
    const requiresReapproval = changes.some((c) => c.sensitive);
    const hasAnyChange = changes.length > 0;

    if (!hasAnyChange) {
      return NextResponse.json({
        success: true,
        message: "لا توجد تغييرات",
      });
    }

    // ═══════ التعديل + تسجيل ═══════
    await prisma.$transaction(async (tx) => {
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
          ...(requiresReapproval && { status: "DRAFT" }),
        },
      });

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

      if (variant) {
        const variantUpdate: any = {
          ...(data.price !== undefined && { price: data.price }),
          ...(data.oldPrice !== undefined && {
            discountPrice: data.oldPrice || null,
          }),
        };

        // ⚠️ تعبئة originalPrice إن لم يكن موجوداً (للمنتجات القديمة)
        if (data.price !== undefined && !variant.originalPrice) {
          variantUpdate.originalPrice = Number(variant.price);
        }

        await tx.productVariant.update({
          where: { id: variant.id },
          data: variantUpdate,
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

      // ═══ سجل التعديل ═══
      await tx.productEditLog.create({
        data: {
          productId,
          sellerId: auth.seller.id,
          changedFields: changes.map((c) => c.field),
          oldValues: Object.fromEntries(
            changes.map((c) => [c.field, c.oldValue])
          ),
          newValues: Object.fromEntries(
            changes.map((c) => [c.field, c.newValue])
          ),
          requiresReapproval,
          reason: priceWarning || null,
        },
      });

      // ═══ إشعار للتاجر ═══
      if (requiresReapproval) {
        await tx.notification.create({
          data: {
            userId: auth.user.id,
            type: "SELLER_PRODUCT_LOW_STOCK",
            title: "منتجك بانتظار إعادة الموافقة",
            message: `تم تعديل: ${changes
              .filter((c) => c.sensitive)
              .map((c) => c.field)
              .join(", ")}${priceWarning ? ` · ${priceWarning}` : ""}`,
            link: `/seller/products/${productId}`,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      requiresReapproval,
      changedFields: changes.map((c) => c.field),
      priceWarning,
      message: requiresReapproval
        ? "تم الحفظ — المنتج بانتظار موافقة الإدارة"
        : "تم الحفظ بنجاح",
    });
  } catch (error) {
    console.error("Seller product PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════
// DELETE — Soft Delete
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