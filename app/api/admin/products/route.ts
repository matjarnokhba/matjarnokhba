import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

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

export async function GET() {
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
          where: { isActive: true },
          orderBy: [{ isDefault: "desc" }, { id: "asc" }],
          take: 1,
          include: { inventory: { select: { quantity: true } } },
        },
        _count: { select: { variants: true } },
        editLogs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const formatted = products.map((p) => {
      const v = p.variants[0];
      const lastEdit = p.editLogs[0];
      let type: "NEW" | "EDITED" | "ACTIVE" | "INACTIVE" = "ACTIVE";
      if (p.status === "DRAFT") type = lastEdit ? "EDITED" : "NEW";
      else if (p.status === "INACTIVE") type = "INACTIVE";

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        image: p.images[0]?.url || null,
        brand: p.brand,
        categoryName: p.category?.name || "",
        price: v ? Number(v.price) : 0,
        stock: v?.inventory?.quantity ?? 0,
        status: p.status,
        type,
        seller: p.seller?.storeName || "",
        variantsCount: p._count.variants,
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

    if (!body.name?.trim() || body.name.length < 2) {
      return NextResponse.json(
        { success: false, message: "اسم المنتج مطلوب" },
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
    if (!body.price || Number(body.price) <= 0) {
      return NextResponse.json(
        { success: false, message: "السعر مطلوب" },
        { status: 400 }
      );
    }
    if (!Array.isArray(body.imageUrls) || body.imageUrls.length === 0) {
      return NextResponse.json(
        { success: false, message: "صورة واحدة على الأقل مطلوبة" },
        { status: 400 }
      );
    }

    // ═══ قراءة الخصائص من الفئة ═══
    const categoryAttributes = await prisma.categoryAttribute.findMany({
      where: { categoryId: body.categoryId, isActive: true },
      include: { values: { where: { isActive: true } } },
    });

    // ═══ خريطة القيم المختارة: attributeId → valueIds (بالترتيب) ═══
    const selectedValues: Record<string, number[]> = body.selectedValues || {};

    type ActiveAttr = {
      attributeId: number;
      name: string;
      order: number;
      values: Array<{ id: number; value: string; order: number }>;
    };

    const activeAttrs: ActiveAttr[] = [];

    for (const attr of categoryAttributes) {
      const ids = selectedValues[String(attr.id)] || [];
      if (ids.length === 0) continue;

      // ترتيب القيم كما اختارها المستخدم، مع التحقق من الانتماء
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

    // ═══ توليد التركيبات ═══
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

    const variantData: Record<string, { price?: number; stock?: number }> =
      body.variantData || {};

    const seller = await prisma.seller.findFirst({
      where: { deletedAt: null },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (!seller) {
      return NextResponse.json(
        { success: false, message: "لا يوجد بائع أساسي" },
        { status: 500 }
      );
    }

    const existing = await prisma.product.findFirst({
      where: {
        sellerId: seller.id,
        slug: body.slug.trim(),
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "الرابط (slug) مستخدم مسبقاً" },
        { status: 400 }
      );
    }

    const basePrice = Number(body.price);
    const oldPrice = body.oldPrice ? Number(body.oldPrice) : null;
    const baseStock = Math.max(0, Number(body.stock) || 0);

    const product = await prisma.$transaction(
      async (tx) => {
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

        // ═══ بدون خصائص → variant افتراضي ═══
        if (combos.length === 1 && combos[0].length === 0) {
          const d = variantData["DEFAULT"] || {};
          const variant = await tx.productVariant.create({
            data: {
              productId: newProduct.id,
              sellerId: seller.id,
              sku: `${body.slug}-default-${Date.now()}`,
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
          return newProduct;
        }

        // ═══ إنشاء Options + قيمها + خريطة (categoryValueId → productOptionValueId) ═══
        const povMap = new Map<number, number>();

        for (const attr of activeAttrs) {
          const created = await tx.productOption.create({
            data: {
              productId: newProduct.id,
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

        // ═══ تجهيز بيانات التركيبات ═══
        const comboData = combos.map((combo, i) => {
          const hash = [...combo].sort((a, b) => a - b).join("|");
          const custom = variantData[hash] || {};
          return {
            combo,
            hash,
            price: custom.price ?? basePrice,
            stock: custom.stock ?? baseStock,
            isDefault: i === 0,
          };
        });

        // ═══ إنشاء variants دفعة واحدة ═══
        const ts = Date.now();
        const createdVariants = await tx.productVariant.createManyAndReturn({
          data: comboData.map((c, i) => ({
            productId: newProduct.id,
            sellerId: seller.id,
            sku: `${body.slug}-${i}-${ts}`,
            price: c.price,
            originalPrice: basePrice,
            discountPrice: oldPrice,
            isDefault: c.isDefault,
            isActive: true,
            optionsHash: c.hash,
          })),
          select: { id: true },
        });

        // ═══ إنشاء Inventory دفعة واحدة ═══
        await tx.inventory.createMany({
          data: createdVariants.map((v, i) => ({
            variantId: v.id,
            quantity: comboData[i].stock,
            reservedQuantity: 0,
            lowStockThreshold: 5,
          })),
        });

        // ═══ ربط الـvariants بقيم الخيارات ═══
        const links: Array<{ variantId: number; optionValueId: number }> = [];
        createdVariants.forEach((v, i) => {
          for (const catValId of comboData[i].combo) {
            const povId = povMap.get(catValId);
            if (povId) links.push({ variantId: v.id, optionValueId: povId });
          }
        });

        if (links.length > 0) {
          await tx.productVariantOptionValue.createMany({ data: links });
        }

        return newProduct;
      },
      { timeout: 30000, maxWait: 10000 }
    );

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