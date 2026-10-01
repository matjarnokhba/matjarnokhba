import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

// ═══════ GET — قائمة المنتجات (للأدمن) ═══════
export async function GET(request: Request) {
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

    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        seller: { select: { storeName: true, slug: true } },
        category: { select: { name: true } },
        images: { where: { isMain: true }, take: 1 },
        variants: {
          where: { isDefault: true },
          include: { inventory: { select: { quantity: true } } },
        },
        editLogs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const formatted = products.map((p) => {
      const variant = p.variants[0];
      const lastEdit = p.editLogs[0];

      // ═══ تحديد النوع ═══
      let type: "NEW" | "EDITED" | "ACTIVE" | "INACTIVE" = "ACTIVE";

      if (p.status === "DRAFT") {
        type = lastEdit ? "EDITED" : "NEW";
      } else if (p.status === "INACTIVE") {
        type = "INACTIVE";
      }

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        image: p.images[0]?.url || null,
        brand: p.brand,
        categoryName: p.category?.name || "",
        price: variant ? Number(variant.price) : 0,
        stock: variant?.inventory?.quantity ?? 0,
        status: p.status,
        type,
        seller: p.seller?.storeName || "",
        lastEdit: lastEdit
          ? {
              changedFields: lastEdit.changedFields,
              reason: lastEdit.reason,
              requiresReapproval: lastEdit.requiresReapproval,
              createdAt: lastEdit.createdAt,
            }
          : null,
      };
    });

    return NextResponse.json({ success: true, products: formatted });
  } catch (error) {
    console.error("Admin products GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ POST — إنشاء منتج (من الأدمن) ═══════
export async function POST(request: Request) {
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

    const body = await request.json();

    // ═══ التحقق ═══
    if (!body.name?.trim() || body.name.length < 2) {
      return NextResponse.json(
        { success: false, message: "اسم المنتج مطلوب (حرفان على الأقل)" },
        { status: 400 }
      );
    }
    if (!body.slug?.trim()) {
      return NextResponse.json(
        { success: false, message: "الرابط (slug) مطلوب" },
        { status: 400 }
      );
    }
    if (!body.categoryId) {
      return NextResponse.json(
        { success: false, message: "التصنيف مطلوب" },
        { status: 400 }
      );
    }
    if (body.price === undefined || body.price <= 0) {
      return NextResponse.json(
        { success: false, message: "السعر مطلوب" },
        { status: 400 }
      );
    }
    if (
      !body.imageUrls ||
      !Array.isArray(body.imageUrls) ||
      body.imageUrls.length === 0
    ) {
      return NextResponse.json(
        { success: false, message: "صورة واحدة على الأقل مطلوبة" },
        { status: 400 }
      );
    }

    // ═══ جلب البائع الأساسي (متجر نخبة) ═══
    const seller = await prisma.seller.findFirst({
      where: { deletedAt: null },
      orderBy: { id: "asc" },
    });
    if (!seller) {
      return NextResponse.json(
        { success: false, message: "لا يوجد بائع أساسي" },
        { status: 500 }
      );
    }

    // ═══ تحقق من slug ضمن منتجات نفس البائع ═══
    const existing = await prisma.product.findFirst({
      where: {
        sellerId: seller.id,
        slug: body.slug.trim(),
        deletedAt: null,
      },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "الرابط (slug) مستخدم مسبقاً" },
        { status: 400 }
      );
    }

    // ═══ الإنشاء ═══
    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          sellerId: seller.id,
          categoryId: body.categoryId,
          name: body.name.trim(),
          slug: body.slug.trim(),
          description: body.description?.trim() || null,
          brand: body.brand?.trim() || null,
          badge: body.badge?.trim() || null,
          status: "ACTIVE",
          freeShipping: body.freeShipping || false,
        },
      });

      await tx.productImage.createMany({
        data: body.imageUrls.map((url: string, i: number) => ({
          productId: newProduct.id,
          url: url.trim(),
          order: i,
          isMain: i === 0,
        })),
      });

      // ⚠️ sellerId + originalPrice إجباريان
      const variant = await tx.productVariant.create({
        data: {
          productId: newProduct.id,
          sellerId: seller.id,
          sku: `${body.slug}-default`,
          price: body.price,
          originalPrice: body.price,
          discountPrice: body.oldPrice || null,
          isDefault: true,
          isActive: true,
          optionsHash: "DEFAULT",
        },
      });

      await tx.inventory.create({
        data: {
          variantId: variant.id,
          quantity: body.stock || 0,
          reservedQuantity: 0,
          lowStockThreshold: 5,
        },
      });

      return newProduct;
    });

    return NextResponse.json(
      { success: true, product: { id: product.id, slug: product.slug } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Product create error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء إنشاء المنتج" },
      { status: 500 }
    );
  }
}