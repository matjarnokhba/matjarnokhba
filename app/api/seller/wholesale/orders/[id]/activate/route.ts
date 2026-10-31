import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function POST(
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

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.wholesaleOrder.findUnique({
        where: { id: orderId },
        include: {
          items: { select: { id: true, importedProductId: true } },
          buyer: { select: { seller: { select: { id: true } } } },
        },
      });
      if (!order) throw new Error("الطلب غير موجود");
      if (order.buyer.seller?.id !== buyerSellerId) throw new Error("غير مصرح");
      if (order.status !== "IMPORT_PENDING") throw new Error(`حالة الطلب: ${order.status}`);

      const productIds = order.items
        .map((i: any) => i.importedProductId)
        .filter((pid: any): pid is number => typeof pid === "number");
      if (productIds.length === 0) throw new Error("لا توجد منتجات جاهزة للنشر");

      await tx.product.updateMany({
        where: { id: { in: productIds }, sellerId: buyerSellerId },
        data: { status: "ACTIVE" },
      });
      const now = new Date();
      await tx.wholesaleOrderItem.updateMany({
        where: { orderId, importedProductId: { not: null } },
        data: { importedAt: now },
      });
      await tx.wholesaleOrder.update({
        where: { id: orderId },
        data: { status: "ACCEPTED" },
      });
      return { published: productIds.length };
    }, { timeout: 30000 });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Activate error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}