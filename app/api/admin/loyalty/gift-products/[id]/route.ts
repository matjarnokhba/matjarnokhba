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

const updateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  tierId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  costPrice: z.number().positive().optional(),
  salePrice: z.number().positive().optional().nullable(),
  stock: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// ═══ PATCH ═══
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const productId = parseInt(id);
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

    const existing = await prisma.loyaltyGiftProduct.findUnique({
      where: { id: productId },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    const data = parsed.data;

    await prisma.loyaltyGiftProduct.update({
      where: { id: productId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description || null,
        }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
        ...(data.tierId && { tierId: data.tierId }),
        ...(data.categoryId && { categoryId: data.categoryId }),
        ...(data.costPrice !== undefined && { costPrice: data.costPrice }),
        ...(data.salePrice !== undefined && {
          salePrice: data.salePrice || null,
        }),
        ...(data.stock !== undefined && { stock: data.stock }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Gift product PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══ DELETE (Soft) ═══
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const productId = parseInt(id);

    // تحقق: لا يوجد مكافآت معلقة تستخدمه
    const activeRewards = await prisma.loyaltyReward.count({
      where: {
        giftProductId: productId,
        status: { in: ["PENDING", "PROCESSING", "SHIPPED"] },
      },
    });

    if (activeRewards > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن الحذف — يوجد ${activeRewards} مكافأة نشطة تستخدم هذا المنتج`,
        },
        { status: 400 }
      );
    }

await prisma.loyaltyGiftProduct.update({
      where: { id: productId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Gift product DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}