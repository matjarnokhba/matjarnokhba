import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSellerOwner } from "@/lib/seller-guards";
import { InventoryService } from "@/services/inventory.service";

const schema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(100000),
  action: z.enum(["WRITE_OFF", "RESTOCK"]),
  reason: z.string().trim().min(3).max(300),
});

// قائمة المعيب لدى التاجر
export async function GET() {
  try {
    const guard = await requireSellerOwner();
    if (!guard.ok) return guard.response;
    const sellerId = guard.current.user.seller!.id;

    const variants = await prisma.productVariant.findMany({
      where: {
        product: { sellerId, deletedAt: null },
        inventory: { is: { defectiveQuantity: { gt: 0 } } },
      },
      orderBy: { id: "asc" },
      take: 200,
      select: {
        id: true,
        sku: true,
        product: { select: { name: true } },
        optionValues: { select: { optionValue: { select: { value: true } } } },
        inventory: { select: { quantity: true, defectiveQuantity: true } },
      },
    });

    return NextResponse.json({
      success: true,
      items: variants.map((v) => ({
        variantId: v.id,
        productName: v.product.name,
        optionsLabel: v.optionValues.map((o) => o.optionValue.value).join(" / "),
        sku: v.sku,
        defective: v.inventory?.defectiveQuantity ?? 0,
        sellable: v.inventory?.quantity ?? 0,
      })),
    });
  } catch (e) {
    console.error("Defective stock list error:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ غير متوقع" }, { status: 500 });
  }
}

// إتلاف أو إصلاح وإعادة للبيع
export async function POST(request: Request) {
  try {
    const guard = await requireSellerOwner();
    if (!guard.ok) return guard.response;
    const { current } = guard;
    const sellerId = current.user.seller!.id;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة (الكمية والسبب إجباريان)" }, { status: 400 });
    }

    const variant = await prisma.productVariant.findFirst({
      where: { id: parsed.data.variantId, product: { sellerId } },
      select: { id: true },
    });
    if (!variant) return NextResponse.json({ success: false, message: "المنتج غير موجود" }, { status: 404 });

    const result = await prisma.$transaction(
      (tx) =>
        InventoryService.resolveDefective(tx, variant.id, parsed.data.quantity, parsed.data.action, {
          performedById: current.user.id,
          reason: parsed.data.reason,
        }),
      { timeout: 30000 }
    );
    return NextResponse.json({ success: true, result }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && /^(الكمية|اكتب|إجراء)/.test(e.message)) {
      return NextResponse.json({ success: false, message: e.message }, { status: 400 });
    }
    console.error("Defective stock resolve error:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ أثناء التنفيذ" }, { status: 500 });
  }
}