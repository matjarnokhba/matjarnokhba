import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const MIN_PRICE_RATIO = 0.5;
const MAX_PRICE_RATIO = 2.0;

async function requireSellerOwnership(productId: number) {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
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

function cartesian(lists: number[][]): number[][] {
  if (lists.length === 0) return [[]];
  return lists.reduce<number[][]>(
    (acc, list) => {
      const next: number[][] = [];
      for (const e of acc) for (const v of list) next.push([...e, v]);
      return next;
    },
    [[]]
  );
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
  selectedValues: z.record(z.string(), z.array(z.number())).optional(),
  variantData: z
    .record(
      z.string(),
      z.object({
        price: z.number().min(0).optional(),
        stock: z.number().int().min(0).optional(),
      })
    )
    .optional(),
});

// ═══════ GET ═══════
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

    // ═══ جلب variants + options ═══
    const [variants, options, categoryAttrs] = await Promise.all([
      prisma.productVariant.findMany({
        where: { productId, isActive: true },
        orderBy: [{ isDefault: "desc" }, { id: "asc" }],
        include: {
          inventory: { select: { quantity: true } },
          optionValues: true,
        },
      }),
      prisma.productOption.findMany({
        where: { productId },
        include: { values: { orderBy: { order: "asc" } } },
      }),
      prisma.categoryAttribute.findMany({
        where: { categoryId: product.categoryId },
        include: { values: true },
      }),
    ]);

    const defaultVariant =
      variants.find((v) => v.isDefault) || variants[0] || null;

    // ═══ بناء selectedValues و variantData ═══
    const selectedValues: Record<number, number[]> = {};
    const variantData: Record<string, { price: number; stock: number }> = {};

    // خريطة: (attributeId + value string) → categoryAttributeValueId
    const valueLookup = new Map<string, number>();
    for (const attr of categoryAttrs) {
      for (const v of attr.values) {
        valueLookup.set(`${attr.id}:${v.value}`, v.id);
      }
    }

    for (const opt of options) {
      if (!opt.categoryAttributeId) continue;
      const ids: number[] = [];
      for (const pov of opt.values) {
        const vid = valueLookup.get(
          `${opt.categoryAttributeId}:${pov.value}`
        );
        if (vid) ids.push(vid);
      }
      if (ids.length > 0) {
        selectedValues[opt.categoryAttributeId] = ids;
      }
    }

    for (const v of variants) {
      variantData[v.optionsHash] = {
        price: Number(v.price),
        stock: v.inventory?.quantity ?? 0,
      };
    }

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        productCode: product.productCode,
        name: product.name,
        slug: product.slug,
        description: product.description || "",
        brand: product.brand || "",
        badge: product.badge || "",
        categoryId: product.categoryId,
        price: defaultVariant ? Number(defaultVariant.price) : 0,
        originalPrice: defaultVariant?.originalPrice
          ? Number(defaultVariant.originalPrice)
          : defaultVariant
            ? Number(defaultVariant.price)
            : 0,
        oldPrice: defaultVariant?.discountPrice
          ? Number(defaultVariant.discountPrice)
          : null,
        stock: defaultVariant?.inventory?.quantity || 0,
        freeShipping: product.freeShipping,
        imageUrls: product.images.map((i) => i.url),
        status: product.status,
        selectedValues,
        variantData,
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

// ═══════ PATCH ═══════
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

    // ═══ قراءات متوازية ═══
    const [defaultVariant, currentInventory, existingVariants, categoryAttrs] =
      await Promise.all([
        prisma.productVariant.findFirst({
          where: { productId, isDefault: true },
        }),
        prisma.productVariant
          .findFirst({ where: { productId, isDefault: true } })
          .then((v) =>
            v
              ? prisma.inventory.findUnique({ where: { variantId: v.id } })
              : null
          ),
        prisma.productVariant.findMany({
          where: { productId },
          select: {
            id: true,
            optionsHash: true,
            _count: { select: { orderItems: true } },
          },
        }),
        prisma.categoryAttribute.findMany({
          where: { categoryId: data.categoryId || product.categoryId, isActive: true },
          include: { values: { where: { isActive: true } } },
        }),
      ]);

    // ═══ التحقق من slug ═══
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
          { success: false, message: "الرابط (slug) مستخدم" },
          { status: 400 }
        );
      }
    }

    // ═══ كشف التغييرات ═══
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

    // ═══ السعر الأساسي (يُقارن ضد originalPrice) ═══
    let priceOutOfRange = false;
    let priceWarning: string | null = null;

    if (data.price !== undefined && defaultVariant) {
      const currentPrice = Number(defaultVariant.price);
      const originalPrice = defaultVariant.originalPrice
        ? Number(defaultVariant.originalPrice)
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

    if (data.oldPrice !== undefined && defaultVariant) {
      const currentOld = defaultVariant.discountPrice
        ? Number(defaultVariant.discountPrice)
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

    // ═══ تحضير الخصائص ═══
    const selectedValues: Record<string, number[]> =
      data.selectedValues || {};
    const variantData: Record<string, { price?: number; stock?: number }> =
      data.variantData || {};

    type ActiveAttr = {
      attributeId: number;
      name: string;
      order: number;
      values: Array<{ id: number; value: string; order: number }>;
    };

    const activeAttrs: ActiveAttr[] = [];

    for (const attr of categoryAttrs) {
      const ids = selectedValues[String(attr.id)] || [];
      if (ids.length === 0) continue;
      const vals: Array<{ id: number; value: string; order: number }> = [];
      ids.forEach((vid, idx) => {
        const found = attr.values.find((v) => v.id === vid);
        if (found) {
          vals.push({ id: found.id, value: found.value, order: idx });
        }
      });
      if (vals.length > 0) {
        activeAttrs.push({
          attributeId: attr.id,
          name: attr.name,
          order: attr.order,
          values: vals,
        });
      }
    }

    const valueLists = activeAttrs.map((a) => a.values.map((v) => v.id));
    const combos = cartesian(valueLists);

    if (combos.length > 100) {
      return NextResponse.json(
        {
          success: false,
          message: `عدد التركيبات كبير جداً (${combos.length}). الحد 100.`,
        },
        { status: 400 }
      );
    }

    // ═══ هل تغيّرت الخصائص؟ (يحتاج مراجعة) ═══
    const optionsChanged =
      (body.selectedValues !== undefined || body.variantData !== undefined) &&
      JSON.stringify(selectedValues) !== "{}";

    if (optionsChanged) {
      // نعتبره تعديلاً حسّاساً
      const hasOptionsInChanges = changes.some(
        (c) => c.field === "الخصائص"
      );
      if (!hasOptionsInChanges) {
        changes.push({
          field: "الخصائص",
          oldValue: "(سابق)",
          newValue: "(جديد)",
          sensitive: true,
        });
      }
    }

    const requiresReapproval = changes.some((c) => c.sensitive);
    const hasAnyChange = changes.length > 0;

    if (!hasAnyChange) {
      return NextResponse.json({
        success: true,
        message: "لا توجد تغييرات",
      });
    }

    const basePrice = data.price ?? (defaultVariant ? Number(defaultVariant.price) : 0);
    const oldPrice =
      data.oldPrice !== undefined
        ? data.oldPrice
        : defaultVariant?.discountPrice
          ? Number(defaultVariant.discountPrice)
          : null;
    const baseStock = data.stock ?? currentInventory?.quantity ?? 0;

    const existingByHash = new Map(
      existingVariants.map((v) => [v.optionsHash, v])
    );
    const newHashes = new Set(
      combos.map((c) => {
        if (c.length === 0) return "DEFAULT";
        return [...c].sort((a, b) => a - b).join("|");
      })
    );

    // ═══ Transaction ═══
    await prisma.$transaction(
      async (tx) => {
        // 1. المنتج
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

        // 2. الصور
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

        // 3. حذف الخيارات القديمة
        await tx.productOption.deleteMany({ where: { productId } });

        // 4. حالة بدون خصائص
        if (combos.length === 1 && combos[0].length === 0) {
          if (defaultVariant) {
            await tx.productVariant.update({
              where: { id: defaultVariant.id },
              data: {
                price: basePrice,
                originalPrice: defaultVariant.originalPrice ?? basePrice,
                discountPrice: oldPrice,
                isActive: true,
                isDefault: true,
              },
            });
            await tx.inventory.upsert({
              where: { variantId: defaultVariant.id },
              update: { quantity: baseStock },
              create: {
                variantId: defaultVariant.id,
                quantity: baseStock,
                reservedQuantity: 0,
                lowStockThreshold: 5,
              },
            });
          } else {
            const d = variantData["DEFAULT"] || {};
            await tx.productVariant.create({
              data: {
                productId,
                sellerId: product.sellerId,
                sku: `${product.slug}-default-${Date.now()}`,
                price: d.price ?? basePrice,
                originalPrice: basePrice,
                discountPrice: oldPrice,
                isDefault: true,
                isActive: true,
                optionsHash: "DEFAULT",
                inventory: {
                  create: {
                    quantity: d.stock ?? baseStock,
                    reservedQuantity: 0,
                    lowStockThreshold: 5,
                  },
                },
              },
            });
          }
        } else {
          // 5. إنشاء الخيارات الجديدة
          const povMap = new Map<number, number>();

          for (const attr of activeAttrs) {
            const created = await tx.productOption.create({
              data: {
                productId,
                categoryAttributeId: attr.attributeId,
                name: attr.name,
                order: attr.order,
                values: {
                  create: attr.values.map((v) => ({
                    value: v.value,
                    order: v.order,
                  })),
                },
              },
              include: { values: { orderBy: { order: "asc" } } },
            });
            attr.values.forEach((v, idx) => {
              povMap.set(v.id, created.values[idx].id);
            });
          }

          // 6. تحديث/إنشاء
          const toUpdate: Array<{
            combo: number[];
            hash: string;
            price: number;
            stock: number;
            isDefault: boolean;
            variantId: number;
          }> = [];
          const toCreate: Array<{
            combo: number[];
            hash: string;
            price: number;
            stock: number;
            isDefault: boolean;
          }> = [];

          combos.forEach((combo, i) => {
            const hash = [...combo].sort((a, b) => a - b).join("|");
            const custom = variantData[hash] || {};
            const price = custom.price ?? basePrice;
            const stock = custom.stock ?? baseStock;
            const isDefault = i === 0;

            const existing = existingByHash.get(hash);
            if (existing) {
              toUpdate.push({
                combo,
                hash,
                price,
                stock,
                isDefault,
                variantId: existing.id,
              });
            } else {
              toCreate.push({ combo, hash, price, stock, isDefault });
            }
          });

          // تحديث الموجود
          for (const u of toUpdate) {
            await tx.productVariant.update({
              where: { id: u.variantId },
              data: {
                price: u.price,
                originalPrice: basePrice,
                discountPrice: oldPrice,
                isActive: true,
                isDefault: u.isDefault,
              },
            });

            await tx.productVariantOptionValue.deleteMany({
              where: { variantId: u.variantId },
            });
            const newLinks: Array<{ optionValueId: number }> = [];
            for (const cvId of u.combo) {
              const povId = povMap.get(cvId);
              if (povId) newLinks.push({ optionValueId: povId });
            }
            if (newLinks.length > 0) {
              await tx.productVariantOptionValue.createMany({
                data: newLinks.map((l) => ({
                  variantId: u.variantId,
                  optionValueId: l.optionValueId,
                })),
              });
            }

            await tx.inventory.upsert({
              where: { variantId: u.variantId },
              update: { quantity: u.stock },
              create: {
                variantId: u.variantId,
                quantity: u.stock,
                reservedQuantity: 0,
                lowStockThreshold: 5,
              },
            });
          }

          // إنشاء الجديدة دفعة واحدة
          if (toCreate.length > 0) {
            const ts = Date.now();
            const created = await tx.productVariant.createManyAndReturn({
              data: toCreate.map((c, i) => ({
                productId,
                sellerId: product.sellerId,
                sku: `${product.slug}-${i}-${ts}`,
                price: c.price,
                originalPrice: basePrice,
                discountPrice: oldPrice,
                isDefault: c.isDefault,
                isActive: true,
                optionsHash: c.hash,
              })),
              select: { id: true },
            });

            await tx.inventory.createMany({
              data: created.map((v, i) => ({
                variantId: v.id,
                quantity: toCreate[i].stock,
                reservedQuantity: 0,
                lowStockThreshold: 5,
              })),
            });

            const links: Array<{
              variantId: number;
              optionValueId: number;
            }> = [];
            created.forEach((v, i) => {
              for (const cvId of toCreate[i].combo) {
                const povId = povMap.get(cvId);
                if (povId)
                  links.push({ variantId: v.id, optionValueId: povId });
              }
            });
            if (links.length > 0) {
              await tx.productVariantOptionValue.createMany({ data: links });
            }
          }
        }

        // 7. حذف/تعطيل variants القديمة
        const toDeactivate: number[] = [];
        const toDelete: number[] = [];

        for (const v of existingVariants) {
          if (newHashes.has(v.optionsHash)) continue;
          if (v._count.orderItems > 0) toDeactivate.push(v.id);
          else toDelete.push(v.id);
        }

        if (toDeactivate.length > 0) {
          await tx.productVariant.updateMany({
            where: { id: { in: toDeactivate } },
            data: { isActive: false },
          });
        }
        if (toDelete.length > 0) {
          await tx.productVariant.deleteMany({
            where: { id: { in: toDelete } },
          });
        }

        // 8. سجل التعديل
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

        // 9. إشعار للتاجر
        if (requiresReapproval) {
          await tx.notification.create({
            data: {
              userId: auth.user.id,
              type: "SELLER_PRODUCT_NEEDS_REVIEW",
              title: "منتجك بانتظار إعادة الموافقة",
              message: `تم تعديل: ${changes
                .filter((c) => c.sensitive)
                .map((c) => c.field)
                .join(", ")}${priceWarning ? ` · ${priceWarning}` : ""}`,
              link: `/seller/products/${productId}`,
            },
          });
        }

        // 10. إشعار للأدمن
        const admins = await tx.user.findMany({
          where: {
            role: { in: ["ADMIN", "SUPER_ADMIN"] },
            deletedAt: null,
          },
          select: { id: true },
        });

        const changedFieldNames = changes.map((c) => c.field).join(", ");

        for (const admin of admins) {
          await tx.notification.create({
            data: {
              userId: admin.id,
              type: requiresReapproval
                ? "SELLER_PRODUCT_NEEDS_REVIEW"
                : "SELLER_PRODUCT_EDITED",
              title: requiresReapproval
                ? "⚠️ منتج يحتاج مراجعة"
                : "✏️ منتج تم تعديله",
              message: `بائع "${auth.seller.storeName}" عدّل "${product.name}": ${changedFieldNames}${
                priceWarning ? ` · ${priceWarning}` : ""
              }`,
              link: requiresReapproval
                ? `/admin/products/pending`
                : `/admin/products/${productId}`,
              category: "PRODUCT",
              severity: requiresReapproval ? "WARNING" : "INFO",
              metadata: {
                productId,
                productName: product.name,
                sellerId: auth.seller.id,
                sellerName: auth.seller.storeName,
                changedFields: changes.map((c) => c.field),
                priceWarning,
                requiresReapproval,
              },
            },
          });
        }
      },
      { timeout: 30000, maxWait: 10000 }
    );

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

// ═══════ DELETE ═══════
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