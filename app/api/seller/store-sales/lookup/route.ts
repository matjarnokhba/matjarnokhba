import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/seller-guards";
import { parseReturnWindowDays, POS_RETURN_WINDOW_MAX } from "@/services/store-sale-return.service";

// البحث عن إيصال بيع من المحل لعرض ما يمكن إرجاعه
export async function GET(request: Request) {
  try {
    const guard = await requireStaffPermission("RETURN_POS_SALE");
    if (!guard.ok) return guard.response;
    const sellerId = guard.current.user.seller!.id;

    const receipt = (new URL(request.url).searchParams.get("receipt") || "").trim();
    if (receipt.length < 4 || receipt.length > 60) {
      return NextResponse.json({ success: false, message: "اكتب رقم الإيصال" }, { status: 400 });
    }

    const sale = await prisma.storeSale.findFirst({
      where: { sellerId, receiptNumber: receipt },
      include: {
        items: {
          orderBy: { id: "asc" },
          include: {
            variant: {
              select: {
                sku: true,
                product: { select: { name: true } },
                optionValues: { select: { optionValue: { select: { value: true } } } },
              },
            },
          },
        },
      },
    });
    if (!sale) return NextResponse.json({ success: false, message: "الإيصال غير موجود" }, { status: 404 });

    const seller = await prisma.seller.findUnique({ where: { id: sellerId }, select: { posReturnWindowDays: true } });
    const days = parseReturnWindowDays(seller?.posReturnWindowDays) ?? POS_RETURN_WINDOW_MAX;
    const deadline = new Date(sale.createdAt.getTime() + days * 86400000);

    const returned = await prisma.storeSaleReturnItem.groupBy({
      by: ["storeSaleItemId"],
      where: { storeSaleItemId: { in: sale.items.map((i) => i.id) } },
      _sum: { quantity: true },
    });
    const returnedMap = new Map(returned.map((r) => [r.storeSaleItemId, r._sum.quantity ?? 0]));

    return NextResponse.json({
      success: true,
      sale: {
        id: sale.id,
        receiptNumber: sale.receiptNumber,
        createdAt: sale.createdAt,
        total: Number(sale.totalAmount),
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
      },
      window: { days, deadline, expired: Date.now() > deadline.getTime() },
      items: sale.items.map((i) => {
        const ret = returnedMap.get(i.id) ?? 0;
        return {
          id: i.id,
          variantId: i.variantId,
          productName: i.variant.product.name,
          optionsLabel: i.variant.optionValues.map((o) => o.optionValue.value).join(" / "),
          sku: i.variant.sku,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          returned: ret,
          remaining: Math.max(0, i.quantity - ret),
        };
      }),
    });
  } catch (e) {
    console.error("Store sale lookup error:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ غير متوقع" }, { status: 500 });
  }
}