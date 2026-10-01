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

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
});

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
    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "إجراء غير صحيح" },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        seller: { select: { userId: true, storeName: true } },
      },
    });

    if (!product || product.deletedAt) {
      return NextResponse.json(
        { success: false, message: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    if (parsed.data.action === "approve") {
      await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: productId },
          data: { status: "ACTIVE" },
        });

        await tx.notification.create({
          data: {
            userId: product.seller.userId,
            type: "SELLER_PRODUCT_LOW_STOCK", // ⚠️ مؤقتاً، نُضيف نوعاً جديداً لاحقاً
            title: "تمت الموافقة على منتجك ✓",
            message: `تمت الموافقة على "${product.name}" وأصبح ظاهراً للعملاء.`,
            link: `/seller/products/${product.id}`,
          },
        });
      });
    } else {
      // reject → رجوع لـDRAFT + إشعار
      await prisma.notification.create({
        data: {
          userId: product.seller.userId,
          type: "SELLER_PRODUCT_LOW_STOCK",
          title: "تم رفض منتجك",
          message: `تم رفض "${product.name}".${parsed.data.note ? ` السبب: ${parsed.data.note}` : ""}`,
          link: `/seller/products/${product.id}`,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin product approve error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}