import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireSeller() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };
  if (
    current.user.seller.status === "SUSPENDED" ||
    current.user.seller.status === "CLOSED"
  ) {
    return { error: "متجرك معطّل", status: 403 };
  }
  return { user: current.user, seller: current.user.seller };
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

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  brand: z.string().trim().max(80).optional().nullable(),
  badge: z.string().trim().max(40).optional().nullable(),
  categoryId: z.number().int().positive(),
  price: z.number().positive(),
  oldPrice: z.number().positive().optional().nullable(),
  stock: z.number().int().min(0).default(0),
  freeShipping: z.boolean().default(false),
  imageUrls: z.array(z.string().url()).min(1, "صورة واحدة على الأقل مطلوبة").max(5),
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

// ═══════ GET — قائمة منتجات البائع ═══════
export async function GET() {
  try {
    const auth = await requireSeller();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const products = await prisma.product.findMany({
      where: { sellerId: auth.seller.id, deletedAt: null },
      include: {
        images: { orderBy: { order: "asc" }, take: 1 },
        category: { select: { id: true, name: true } },
        variants: {
          where: { isDefault: true },
          include: { inventory: { select: { quantity: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      image: p.images[0]?.url || null,
      categoryName: p.category.name,
      price: p.variants[0] ? Number(p.variants[0].price) : 0,
      stock: p.variants[0]?.inventory?.quantity || 0,
      status: p.status,
      sold: p.sold,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({ success: true, products: formatted });
  } catch (error) {
    console.error("Seller products GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ POST — إنشاء منتج جديد (مع Variants ديناميكية) ═══════
export async function POST(request: Request) {
  try {
    const auth = await requireSeller();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);

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

    // ═══ slug ═══
    const cleanSlug = data.slug
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    const existing = await prisma.product.findFirst({
      where: {
        sellerId: auth.seller.id,
        slug: cleanSlug,
        deletedAt: null,
      },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "الرابط (slug) مستخدم في منتجاتك" },
        { status: 400 }
      );
    }

    // ═══ الفئة ═══
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    if (!category || category.deletedAt) {
      return NextResponse.json(
        { success: false, message: "التصنيف غير موجود" },
        { status: 400 }
      );
    }

    // ═══ قراءة خصائص الفئة ═══
    const categoryAttributes = await prisma.categoryAttribute.findMany({
      where: { categoryId: data.categoryId, isActive: true },
      include: { values: { where: { isActive: true } } },
    });

    const selectedValues: Record<string, number[]> =
      data.selectedValues || {};

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

    const variantData: Record<string, { price?: number; stock?: number }> =
      data.variantData || {};

    // ═══ إنشاء المنتج ═══
    const product = await prisma.$transaction(
      async (tx) => {
        const p = await tx.product.create({
          data: {
            sellerId: auth.seller.id,
            categoryId: data.categoryId,
            name: data.name,
            slug: cleanSlug,
            description: data.description || null,
            brand: data.brand || null,
            badge: data.badge || null,
            freeShipping: data.freeShipping,
            status: "DRAFT",
            images: {
              create: data.imageUrls.map((url, idx) => ({
                url,
                order: idx,
                isMain: idx === 0,
              })),
            },
          },
        });

        // ═══ بدون خصائص → variant افتراضي ═══
        if (combos.length === 1 && combos[0].length === 0) {
          const d = variantData["DEFAULT"] || {};
          const vPrice = d.price ?? data.price;
          const vStock = d.stock ?? data.stock;

          await tx.productVariant.create({
            data: {
              productId: p.id,
              sellerId: auth.seller.id,
              sku: `${cleanSlug}-default-${Date.now()}`,
              price: vPrice,
              originalPrice: data.price,
              discountPrice: data.oldPrice || null,
              isDefault: true,
              isActive: true,
              optionsHash: "DEFAULT",
              inventory: {
                create: {
                  quantity: vStock,
                  reservedQuantity: 0,
                  lowStockThreshold: 5,
                },
              },
            },
          });

          return p;
        }

        // ═══ إنشاء Options + قيمها ═══
        const povMap = new Map<number, number>();

        for (const attr of activeAttrs) {
          const created = await tx.productOption.create({
            data: {
              productId: p.id,
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
            price: custom.price ?? data.price,
            stock: custom.stock ?? data.stock,
            isDefault: i === 0,
          };
        });

        // ═══ إنشاء variants دفعة واحدة ═══
        const ts = Date.now();
        const createdVariants = await tx.productVariant.createManyAndReturn({
          data: comboData.map((c, i) => ({
            productId: p.id,
            sellerId: auth.seller.id,
            sku: `${cleanSlug}-${i}-${ts}`,
            price: c.price,
            originalPrice: data.price,
            discountPrice: data.oldPrice || null,
            isDefault: c.isDefault,
            isActive: true,
            optionsHash: c.hash,
          })),
          select: { id: true },
        });

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

        return p;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    return NextResponse.json(
      { success: true, product: { id: product.id, slug: product.slug } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Seller product POST error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}