import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type EstimateItem = { variantId: number; quantity: number };
type EstimateBody = { city?: string; items: EstimateItem[] };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EstimateBody;
    const city = typeof body.city === "string" ? body.city : "";
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json({ success: false, message: "السلة فارغة" }, { status: 400 });
    }

    const variantIds = items.map((i) => i.variantId).filter((id) => typeof id === "number");
    if (variantIds.length === 0) {
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });
    }

    // ═══ قراءة إعدادات الشحن من قاعدة البيانات ═══
    const policies = await prisma.systemPolicy.findMany({
      where: { key: { in: ["FREE_SHIPPING_ENABLED", "FREE_SHIPPING_THRESHOLD"] } }
    });
    const isFreeShippingEnabled = policies.find(p => p.key === "FREE_SHIPPING_ENABLED")?.value === true;
    const freeShippingThreshold = Number(policies.find(p => p.key === "FREE_SHIPPING_THRESHOLD")?.value) || 300;

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
    const sellerTotals = new Map<number, { subtotal: number; isAllFree: boolean }>();

    for (const item of items) {
      const v = variantMap.get(item.variantId);
      if (!v || !v.product || v.product.deletedAt || v.product.status !== "ACTIVE") continue;

      const qty = Math.max(1, Math.min(100, Number(item.quantity) || 1));
      const lineTotal = Number(v.price) * qty;
      subtotal += lineTotal;

      const sellerId = v.product.sellerId;
      const existing = sellerTotals.get(sellerId) || { subtotal: 0, isAllFree: true };
      existing.subtotal += lineTotal;
      if (!v.product.freeShipping) existing.isAllFree = false;
      sellerTotals.set(sellerId, existing);
    }

    let totalShipping = 0;

    for (const [, sellerData] of sellerTotals) {
      if (sellerData.isAllFree) continue;

      // إذا كان الشحن المجاني مفعلاً، وكان الإجمالي تجاوز السقف، لا نضيف شحن
      if (isFreeShippingEnabled && subtotal >= freeShippingThreshold) continue;

      // خلاف ذلك نضيف 20 درهماً
      totalShipping += 20;
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