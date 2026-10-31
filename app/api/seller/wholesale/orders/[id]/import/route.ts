import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const buyerSellerId = current.user.seller.id;
    const { id } = await params;
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }

    const order = await prisma.wholesaleOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: {
            id: true, offerId: true, productName: true, variantName: true,
            qty: true, importedQty: true, importedProductId: true,
            salePrice: true, purchaseCost: true, unitPrice: true,
          },
        },
        buyer: { select: { seller: { select: { id: true } } } },
      },
    });
    if (!order) return NextResponse.json({ success: false, message: "الطلب غير موجود" }, { status: 404 });
    if (order.buyer.seller?.id !== buyerSellerId) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const productIds = order.items.map((i: any) => i.importedProductId).filter((pid: any): pid is number => typeof pid === "number");
    const drafts = productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds }, sellerId: buyerSellerId },
          select: {
            id: true, name: true, slug: true, status: true, images: true,
            variants: { select: { id: true, sku: true, price: true, barcode: true } },
          },
        })
      : [];

    return NextResponse.json({
      success: true,
      order: { id: order.id, orderNumber: order.orderNumber, status: order.status },
      items: order.items,
      drafts,
    });
  } catch (error) {
    console.error("Import GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}