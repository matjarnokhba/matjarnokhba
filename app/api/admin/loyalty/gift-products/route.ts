import { NextResponse } from "next/server";
import { z } from "zod";
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

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  tierId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  costPrice: z.number().positive(),
  salePrice: z.number().positive().optional().nullable(),
  stock: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

// ═══ GET ═══
export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const products = await prisma.loyaltyGiftProduct.findMany({
      include: {
        tier: { select: { id: true, name: true, icon: true } },
        category: { select: { id: true, name: true, icon: true } },
      },
      orderBy: [{ tier: { order: "asc" } }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      success: true,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        costPrice: Number(p.costPrice),
        salePrice: p.salePrice ? Number(p.salePrice) : null,
        stock: p.stock,
        reservedStock: p.reservedStock,
        available: p.stock - p.reservedStock,
        isActive: p.isActive,
        tier: p.tier,
        category: p.category,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error("Gift products GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══ POST ═══
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
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

    // تحقق من وجود tier + category
    const [tier, category] = await Promise.all([
      prisma.loyaltyTier.findUnique({ where: { id: data.tierId } }),
      prisma.loyaltyRewardCategory.findUnique({
        where: { id: data.categoryId },
      }),
    ]);

    if (!tier || !category) {
      return NextResponse.json(
        { success: false, message: "المستوى أو الفئة غير موجودة" },
        { status: 400 }
      );
    }

    const product = await prisma.loyaltyGiftProduct.create({
      data: {
        name: data.name,
        description: data.description || null,
        imageUrl: data.imageUrl || null,
        tierId: data.tierId,
        categoryId: data.categoryId,
        costPrice: data.costPrice,
        salePrice: data.salePrice || null,
        stock: data.stock,
        isActive: data.isActive,
      },
    });

    return NextResponse.json(
      { success: true, product: { id: product.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Gift product POST error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}