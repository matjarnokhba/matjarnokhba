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
      where: {
        status: "DRAFT",
        deletedAt: null,
      },
      include: {
        seller: { select: { id: true, storeName: true, slug: true } },
        category: { select: { name: true } },
        images: { orderBy: { order: "asc" }, take: 1 },
        variants: {
          where: { isDefault: true },
          include: { inventory: { select: { quantity: true } } },
        },
        // ═══ آخر تعديل ═══
        editLogs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
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

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        image: p.images[0]?.url || null,
        categoryName: p.category.name,
        price: p.variants[0] ? Number(p.variants[0].price) : 0,
        stock: p.variants[0]?.inventory?.quantity || 0,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        isNew, // 🆕 منتج جديد vs ✏️ مُعدَّل
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