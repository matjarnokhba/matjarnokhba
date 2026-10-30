import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from '@/services/session.service';
import { ProductMasterLinker } from '@/services/product-master-linker.service';

const FIELD_NAMES: Record<string, string> = {
  name: "الاسم",
  description: "الوصف",
  imageUrls: "الصور",
  brand: "الماركة",
  badge: "الشارة",
  categoryId: "التصنيف",
  freeShipping: "الشحن المجاني",
  originCountry: "بلد المنشأ",
  videoUrl: "الفيديو",
  minOrderQty: "الحد الأدنى",
  maxOrderQty: "الحد الأقصى",
  price: "السعر",
  stock: "المخزون",
  barcode: "الباركود",
};

const SENSITIVE_FIELDS = new Set([
  "name",
  "description",
  "imageUrls",
  "brand",
  "categoryId",
]);

async function requireSellerProduct(productId: number) {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      images: { orderBy: { order: "asc" } },
      category: { select: { name: true } },
      variants: {
        orderBy: { id: "asc" },
        include: {
          inventory: { select: { quantity: true, reservedQuantity: true } },
          optionValues: {
            select: {
              optionValue: {
                select: {
                  id: true,
                  value: true,
                  option: {
                    select: { id: true, name: true, categoryAttributeId: true },
                  },
                },
              },
            },
          },
        },
      },
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

export async function GET(
  _request: Request,
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

    const auth = await requireSellerProduct(productId);
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { product } = auth;
    const defaultVariant =
      product.variants.find((v) => v.isDefault) || product.variants[0];

    const variantsData = product.variants.map((v) => ({
      id: v.id,
      price: Number(v.price),
      stock: v.inventory?.quantity || 0,
      reservedQuantity: v.inventory?.reservedQuantity || 0,
      barcode: v.barcode || "",
      isDefault: v.isDefault,
      options: v.optionValues.map((ov) => ({
        attributeId: ov.optionValue.option.categoryAttributeId,
        attributeName: ov.optionValue.option.name,
        valueId: ov.optionValue.id,
        value: ov.optionValue.value,
      })),
    }));

    const firstVariantWithOptions = product.variants.find(
      (v) => v.optionValues.length > 0
    );
    const selectedValues: Record<number, number[]> = {};
    if (firstVariantWithOptions) {
      for (const ov of firstVariantWithOptions.optionValues) {
        const attrId = ov.optionValue.option.categoryAttributeId;
        if (!attrId) continue;
        if (!selectedValues[attrId]) selectedValues[attrId] = [];
        for (const v of product.variants) {
          const match = v.optionValues.find(
            (x) => x.optionValue.option.categoryAttributeId === attrId
          );
          if (match && !selectedValues[attrId].includes(match.optionValue.id)) {
            selectedValues[attrId].push(match.optionValue.id);
          }
        }
      }
    }

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
        categoryName: product.category?.name || "",
        price: defaultVariant ? Number(defaultVariant.price) : 0,
        oldPrice: defaultVariant?.discountPrice
          ? Number(defaultVariant.discountPrice)
          : null,
        stock: defaultVariant?.inventory?.quantity || 0,
        barcode: defaultVariant?.barcode || "",
        freeShipping: product.freeShipping,
        imageUrls: product.images.map((img) => img.url),
        status: product.status,
        originCountry: product.originCountry || "",
        videoUrl: product.videoUrl || "",
        minOrderQty: product.minOrderQty,
        maxOrderQty: product.maxOrderQty,
        hasVariants: product.variants.length > 1,
        variantCount: product.variants.length,
        variants: variantsData,
        selectedValues,
        updatedAt: product.updatedAt.toISOString(),
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

const variantPatchSchema = z.object({
  id: z.number().int().positive(),
  price: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  barcode: z.string().trim().nullable().optional(),
});

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
  variants: z.array(variantPatchSchema).optional(),
  expectedUpdatedAt: z.string().optional(),
});

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

    const auth = await requireSellerProduct(productId);
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
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
    const { product } = auth;
    const hasVariants = product.variants.length > 1;

    // ═══ Concurrency check ═══
    if (data.expectedUpdatedAt) {
      if (product.updatedAt.toISOString() !== data.expectedUpdatedAt) {
        return NextResponse.json(
          {
            success: false,
            message:
              "المنتج تغيّر في مكان آخر. أعد تحميل الصفحة وحاول مجددًا.",
            code: "STALE_VERSION",
          },
          { status: 409 }
        );
      }
    }

    // ═══ Guards ═══
    if (
      hasVariants &&
      (data.price !== undefined || data.stock !== undefined) &&
      !data.variants
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "عدّل كل variant على حدة (استخدم جدول المتغيرات).",
        },
        { status: 400 }
      );
    }

    if (
      data.categoryId !== undefined &&
      data.categoryId !== product.categoryId &&
      hasVariants
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "لا يمكن تغيير الفئة بعد إنشاء المتغيرات.",
        },
        { status: 400 }
      );
    }

    if (data.variants && data.variants.length > 0) {
      const productVariantIds = new Set(product.variants.map((v) => v.id));
      for (const v of data.variants) {
        if (!productVariantIds.has(v.id)) {
          return NextResponse.json(
            { success: false, message: `variant #${v.id} لا ينتمي لهذا المنتج` },
            { status: 400 }
          );
        }
      }
    }

    // ═══ Compute changes ═══
    const before: Record<string, unknown> = {
      name: product.name,
      description: product.description,
      brand: product.brand,
      badge: product.badge,
      categoryId: product.categoryId,
      freeShipping: product.freeShipping,
      originCountry: product.originCountry,
      videoUrl: product.videoUrl,
      minOrderQty: product.minOrderQty,
      maxOrderQty: product.maxOrderQty,
      imageUrls: product.images.map((i) => i.url),
    };

    const after: Record<string, unknown> = { ...before };
    if (data.name !== undefined) after.name = data.name.trim();
    if (data.description !== undefined)
      after.description = data.description?.trim() || null;
    if (data.brand !== undefined) after.brand = data.brand?.trim() || null;
    if (data.badge !== undefined) after.badge = data.badge?.trim() || null;
    if (data.categoryId !== undefined) after.categoryId = data.categoryId;
    if (data.freeShipping !== undefined) after.freeShipping = data.freeShipping;
    if (data.originCountry !== undefined)
      after.originCountry = data.originCountry?.trim() || null;
    if (data.videoUrl !== undefined)
      after.videoUrl = data.videoUrl?.trim() || null;
    if (data.minOrderQty !== undefined) after.minOrderQty = data.minOrderQty;
    if (data.maxOrderQty !== undefined)
      after.maxOrderQty = data.maxOrderQty || null;
    if (data.imageUrls !== undefined) after.imageUrls = data.imageUrls;

    const changedKeys: string[] = [];
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    for (const key of Object.keys(after)) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changedKeys.push(key);
        oldValues[key] = before[key];
        newValues[key] = after[key];
      }
    }

    // Variant changes (log separately)
    if (data.variants && data.variants.length > 0) {
      const variantChanges: unknown[] = [];
      for (const vPatch of data.variants) {
        const existing = product.variants.find((v) => v.id === vPatch.id);
        if (!existing) continue;
        const vDiff: Record<string, unknown> = {};
        if (
          vPatch.price !== undefined &&
          vPatch.price !== Number(existing.price)
        ) {
          vDiff.price = {
            before: Number(existing.price),
            after: vPatch.price,
          };
        }
        if (
          vPatch.stock !== undefined &&
          vPatch.stock !== (existing.inventory?.quantity || 0)
        ) {
          vDiff.stock = {
            before: existing.inventory?.quantity || 0,
            after: vPatch.stock,
          };
        }
        if (
          vPatch.barcode !== undefined &&
          (vPatch.barcode || "") !== (existing.barcode || "")
        ) {
          vDiff.barcode = {
            before: existing.barcode || null,
            after: vPatch.barcode || null,
          };
        }
        if (Object.keys(vDiff).length > 0) {
          variantChanges.push({ variantId: vPatch.id, ...vDiff });
          // Add to changed keys (using Arabic labels)
          if (!changedKeys.includes("variants")) changedKeys.push("variants");
        }
      }
      if (variantChanges.length > 0) {
        oldValues.variants = product.variants.map((v) => ({
          id: v.id,
          price: Number(v.price),
          stock: v.inventory?.quantity || 0,
          barcode: v.barcode || null,
        }));
        newValues.variants = variantChanges;
      }
    }

    const sensitiveChanged = changedKeys.filter((k) =>
      SENSITIVE_FIELDS.has(k)
    );
    const requiresReapproval =
      sensitiveChanged.length > 0 && product.status === "ACTIVE";

    // ═══ Apply changes in transaction ═══
    const result = await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.description !== undefined)
        updateData.description = data.description?.trim() || null;
      if (data.brand !== undefined) updateData.brand = data.brand?.trim() || null;
      if (data.badge !== undefined) updateData.badge = data.badge?.trim() || null;
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
      if (requiresReapproval) updateData.status = "DRAFT";

      if (Object.keys(updateData).length > 0) {
        await tx.product.update({ where: { id: productId }, data: updateData });
      }

      // Images
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

      // Variant updates with INVENTORY GUARD
      if (data.variants && data.variants.length > 0) {
        for (let vIdx = 0; vIdx < data.variants.length; vIdx++) {
          const vPatch = data.variants[vIdx];
          const existingVariant = product.variants.find(
            (v) => v.id === vPatch.id
          );
          if (!existingVariant) continue;

          const variantUpdate: Record<string, unknown> = {};
          if (vPatch.price !== undefined) variantUpdate.price = vPatch.price;

          let finalBc: string;
          if (vPatch.barcode === undefined) {
            finalBc =
              existingVariant.barcode || `NK-${productId}-${existingVariant.id}`;
          } else if (!vPatch.barcode || !vPatch.barcode.trim()) {
            finalBc = `NK-${productId}-${existingVariant.id}`;
          } else {
            finalBc = vPatch.barcode.trim();
          }
          variantUpdate.barcode = finalBc;

          if (Object.keys(variantUpdate).length > 0) {
            await tx.productVariant.update({
              where: { id: vPatch.id },
              data: variantUpdate,
            });
          }

          // 🛡️ INVENTORY GUARD
          if (vPatch.stock !== undefined) {
            const inv = await tx.inventory.findUnique({
              where: { variantId: vPatch.id },
              select: { reservedQuantity: true, quantity: true },
            });
            if (!inv) throw new Error("inventory غير موجود");
            if (vPatch.stock < inv.reservedQuantity) {
              throw new Error(
                `لا يمكن تخفيض مخزون المتغير #${vIdx + 1} إلى ${vPatch.stock}. هناك ${inv.reservedQuantity} قطعة محجوزة لطلبات حالية.`
              );
            }
            await tx.inventory.updateMany({
              where: { variantId: vPatch.id },
              data: { quantity: vPatch.stock },
            });
          }
        }
      }

      // Base variant (no variants case) — same guard
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
          const inv = await tx.inventory.findUnique({
            where: { variantId: defaultVariant.id },
            select: { reservedQuantity: true },
          });
          if (!inv) throw new Error("inventory غير موجود");
          if (data.stock < inv.reservedQuantity) {
            throw new Error(
              `لا يمكن تخفيض المخزون إلى ${data.stock}. هناك ${inv.reservedQuantity} قطعة محجوزة.`
            );
          }
          await tx.inventory.updateMany({
            where: { variantId: defaultVariant.id },
            data: { quantity: data.stock },
          });
        }
      }

      // Audit log
      if (changedKeys.length > 0) {
        const arabicChanged = changedKeys
          .filter((k) => k !== "variants")
          .map((k) => FIELD_NAMES[k] || k);
        if (changedKeys.includes("variants")) arabicChanged.push("المتغيرات");

        await tx.productEditLog.create({
          data: {
            productId,
            sellerId: product.sellerId,
            changedFields: arabicChanged,
            oldValues: oldValues as never,
            newValues: newValues as never,
            requiresReapproval,
            reason: requiresReapproval
              ? "تعديل حقل حساس — يتطلب مراجعة"
              : null,
          },
        });
      }

      const updated = await tx.product.findUnique({
        where: { id: productId },
        select: { status: true, updatedAt: true },
      });

      return {
        id: productId,
        status: updated?.status,
        updatedAt: updated?.updatedAt.toISOString(),
        requiresReapproval,
        changedFields: changedKeys,
      };
    });

    try {
      await ProductMasterLinker.ensureMasterForProduct(null, productId);
    } catch (e) {
      console.error("Master linking failed (non-fatal):", e);
    }

    return NextResponse.json({ success: true, product: result });
  } catch (error) {
    console.error("Seller product PATCH error:", error);
    const msg =
      error instanceof Error
        ? error.message
        : "حدث خطأ أثناء حفظ التعديلات";
    return NextResponse.json(
      { success: false, message: msg },
      { status: 400 }
    );
  }
}