import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

// ═══════ إنشاء منتج ═══════
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

    // ═══ التحقق من البيانات ═══
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
    if (!body.imageUrls || !Array.isArray(body.imageUrls) || body.imageUrls.length === 0) {
      return NextResponse.json(
        { success: false, message: "صورة واحدة على الأقل مطلوبة" },
        { status: 400 }
      );
    }

    // ═══ التحقق من عدم تكرار slug ═══
    const existing = await prisma.product.findUnique({
      where: { slug: body.slug },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "الرابط (slug) مستخدم مسبقاً" },
        { status: 400 }
      );
    }

    // ═══ جلب البائع ═══
    const seller = await prisma.seller.findFirst();
    if (!seller) {
      return NextResponse.json(
        { success: false, message: "لا يوجد بائع" },
        { status: 500 }
      );
    }

    // ═══ إنشاء المنتج (Transaction) ═══
    const product = await prisma.$transaction(async (tx) => {
      // 1. المنتج
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

      // 2. الصور
      await tx.productImage.createMany({
        data: body.imageUrls.map((url: string, i: number) => ({
          productId: newProduct.id,
          url: url.trim(),
          order: i,
          isMain: i === 0,
        })),
      });

      // 3. الـVariant
      const variant = await tx.productVariant.create({
        data: {
          productId: newProduct.id,
          sku: `${body.slug}-default`,
          price: body.price,
          discountPrice: body.oldPrice || null,
          isDefault: true,
          isActive: true,
          optionsHash: "DEFAULT",
        },
      });

      // 4. Inventory
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