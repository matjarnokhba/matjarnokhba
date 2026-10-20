import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FREE_SHIPPING_THRESHOLD = 300;

type EstimateItem = { variantId: number; quantity: number };
type EstimateBody = { city?: string; items: EstimateItem[] };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EstimateBody;
    const city = typeof body.city === "string" ? body.city : "";
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, message: "السلة فارغة" },
        { status: 400 }
      );
    }

    const variantIds = items.map((i) => i.variantId).filter((id) => typeof id === "number");
    if (variantIds.length === 0) {
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });
    }

    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, isActive: true },
      select: {
        id: true,
        price: true,
        product: {
          select: {
            sellerId: true,
            freeShipping: true,
            status: true,
            deletedAt: true,
            seller: { select: { city: true } },
          },
        },
      },
    });

    const variantMap = new Map(variants.map((v) => [v.id, v]));
    let subtotal = 0;
    
    // تجميع المبالغ حسب التاجر
    const sellerTotals = new Map<number, { subtotal: number; isAllFree: boolean; sellerCity: string }>();

    for (const item of items) {
      const v = variantMap.get(item.variantId);
      if (!v || !v.product || v.product.deletedAt || v.product.status !== "ACTIVE") continue;

      const qty = Math.max(1, Math.min(100, Number(item.quantity) || 1));
      const lineTotal = Number(v.price) * qty;
      subtotal += lineTotal;

      const sellerId = v.product.sellerId;
      const existing = sellerTotals.get(sellerId) || { subtotal: 0, isAllFree: true, sellerCity: v.product.seller?.city || "" };
      
      existing.subtotal += lineTotal;
      if (!v.product.freeShipping) existing.isAllFree = false;
      
      sellerTotals.set(sellerId, existing);
    }

    const customerCity = city.trim().toLowerCase();
    let totalShipping = 0;

    for (const [, sellerData] of sellerTotals) {
      // إذا كان كل منتجات التاجر شحن مجاني، أو تجاوز الإجمالي 300، الشحن مجاني
      if (sellerData.isAllFree || sellerData.subtotal >= FREE_SHIPPING_THRESHOLD) {
        continue;
      }
      
      const sellerCity = sellerData.sellerCity.trim().toLowerCase();
      const isSameCity = customerCity !== "" && sellerCity === customerCity;
      
      totalShipping += isSameCity ? 20 : 35;
    }

    return NextResponse.json({
      success: true,
      subtotal: Math.round(subtotal * 100) / 100,
      shippingCost: Math.round(totalShipping * 100) / 100,
    });
  } catch (error) {
    console.error("Shipping estimate error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}