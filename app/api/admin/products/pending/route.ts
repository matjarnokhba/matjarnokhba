import { NextResponse } from "next/server";
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

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const products = await prisma.product.findMany({
      where: { status: "DRAFT", deletedAt: null },
      include: {
        seller: { select: { id: true, storeName: true, slug: true } },
        category: { select: { name: true, slug: true } },
        images: { orderBy: { order: "asc" } },
        variants: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            price: true,
            barcode: true,
            isDefault: true,
            inventory: { select: { quantity: true } },
            optionValues: {
              select: {
                optionValue: {
                  select: {
                    value: true,
                    option: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
        editLogs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const formatted = products.map((p) => {
      const lastEdit = p.editLogs[0];
      const isNew =
        !lastEdit ||
        p.createdAt.getTime() === p.updatedAt.getTime() ||
        lastEdit.changedFields === null;

      // ✅ المجموع الحقيقي
      const totalStock = p.variants.reduce(
        (sum, v) => sum + (v.inventory?.quantity || 0),
        0
      );

      // ✅ أقل سعر بين المتغيرات
      const minPrice =
        p.variants.length > 0
          ? Math.min(...p.variants.map((v) => Number(v.price)))
          : 0;

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        brand: p.brand,
        badge: p.badge,
        originCountry: p.originCountry,
        videoUrl: p.videoUrl,
        minOrderQty: p.minOrderQty,
        maxOrderQty: p.maxOrderQty,
        freeShipping: p.freeShipping,
        productType: p.productType,
        unit: p.unit,
        weightGrams: p.weightGrams,
        lengthCm: p.lengthCm,
        widthCm: p.widthCm,
        heightCm: p.heightCm,
        salePrice: p.salePrice,
        categoryName: p.category.name,
        images: p.images.map((img) => img.url),
        variants: p.variants.map((v) => ({
          id: v.id,
          price: Number(v.price),
          barcode: v.barcode,
          isDefault: v.isDefault,
          stock: v.inventory?.quantity || 0,
          options: v.optionValues.map(
            (ov) => `${ov.optionValue.option.name}: ${ov.optionValue.value}`
          ),
        })),
        totalStock,
        minPrice,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        isNew,
        seller: {
          id: p.seller.id,
          storeName: p.seller.storeName,
          slug: p.seller.slug,
        },
        lastEdit: lastEdit
          ? {
              id: lastEdit.id,
              changedFields: lastEdit.changedFields,
              oldValues: lastEdit.oldValues,
              newValues: lastEdit.newValues,
              requiresReapproval: lastEdit.requiresReapproval,
              reason: lastEdit.reason,
              createdAt: lastEdit.createdAt,
            }
          : null,
      };
    });

    return NextResponse.json({ success: true, products: formatted });
  } catch (error) {
    console.error("Admin pending products error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}