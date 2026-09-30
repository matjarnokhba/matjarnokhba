import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

// ═══════ التحقق من صلاحية البائع ═══════
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
  // PENDING و ACTIVE → يمرون
  return { user: current.user, seller: current.user.seller };
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
});

// ═══════════════════════════════════════════
// GET — قائمة منتجات البائع
// ═══════════════════════════════════════════
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
      where: {
        sellerId: auth.seller.id,
        deletedAt: null,
      },
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

// ═══════════════════════════════════════════
// POST — إنشاء منتج جديد
// ═══════════════════════════════════════════
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

    // ═══ slug فريد ضمن منتجات هذا البائع ═══
    const cleanSlug = data.slug
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    const existing = await prisma.product.findFirst({
      where: { sellerId: auth.seller.id, slug: cleanSlug, deletedAt: null },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "الرابط (slug) مستخدم في منتجاتك" },
        { status: 400 }
      );
    }

    // ═══ التحقق من الفئة ═══
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    if (!category || category.deletedAt) {
      return NextResponse.json(
        { success: false, message: "التصنيف غير موجود" },
        { status: 400 }
      );
    }

    // ═══ إنشاء المنتج + Variant + Inventory في transaction ═══
    const product = await prisma.$transaction(async (tx) => {
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

      const variant = await tx.productVariant.create({
        data: {
          productId: p.id,
          sellerId: auth.seller.id,
          sku: `${cleanSlug}-default-${Date.now()}`,
          price: data.price,
          discountPrice: data.oldPrice || null,
          isDefault: true,
          isActive: true,
          optionsHash: "DEFAULT",
        },
      });

      await tx.inventory.create({
        data: {
          variantId: variant.id,
          quantity: data.stock,
          reservedQuantity: 0,
          lowStockThreshold: 5,
        },
      });

      return p;
    });

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