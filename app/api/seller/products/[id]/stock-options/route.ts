import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/seller-guards";

// خيارات المنتج الموجودة مع المخزون الحالي (لصفحة إضافة المخزون)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireStaffPermission("ADD_STOCK");
    if (!guard.ok) return guard.response;
    const sellerId = guard.current.user.seller!.id;
    const id = parseInt((await ctx.params).id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, message: "رقم غير صالح" }, { status: 400 });
    }

    const product = await prisma.product.findFirst({
      where: { id, sellerId, deletedAt: null },
      select: {
        id: true,
        name: true,
        variants: {
          where: { isActive: true },
          orderBy: { id: "asc" },
          select: {
            id: true,
            sku: true,
            inventory: { select: { quantity: true, reservedQuantity: true, defectiveQuantity: true } },
            optionValues: { select: { optionValue: { select: { value: true, option: { select: { name: true } } } } } },
          },
        },
      },
    });
    if (!product) return NextResponse.json({ success: false, message: "المنتج غير موجود" }, { status: 404 });

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        options: product.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          label:
            v.optionValues.map((o) => `${o.optionValue.option.name}: ${o.optionValue.value}`).join(" / ") ||
            "الخيار الافتراضي",
          stock: v.inventory?.quantity ?? 0,
          reserved: v.inventory?.reservedQuantity ?? 0,
          defective: v.inventory?.defectiveQuantity ?? 0,
        })),
      },
    });
  } catch (e) {
    console.error("Stock options error:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ غير متوقع" }, { status: 500 });
  }
}