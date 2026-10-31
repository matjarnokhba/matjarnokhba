import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const itemSchema = z.object({
  orderItemId: z.number().int().positive(),
  salePrice: z.number().positive(),
  purchaseCost: z.number().positive().optional().nullable(),
  qty: z.number().int().positive(),
});

const schema = z.object({
  items: z.array(itemSchema).min(1),
});

export async function POST(
  request: Request,
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

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.wholesaleOrder.findUnique({
        where: { id: orderId },
        include: {
          items: { select: { id: true, importedProductId: true, qty: true } },
          buyer: { select: { seller: { select: { id: true } } } },
        },
      });
      if (!order) throw new Error("الطلب غير موجود");
      if (order.buyer.seller?.id !== buyerSellerId) throw new Error("غير مصرح");
      if (order.status !== "IMPORT_PENDING") throw new Error(`حالة الطلب: ${order.status}`);

      const orderItemMap = new Map(order.items.map((i: any) => [i.id, i] as const));
      let published = 0;

      for (const edit of parsed.data.items) {
        const oi = orderItemMap.get(edit.orderItemId);
        if (!oi) throw new Error(`بند غير موجود: ${edit.orderItemId}`);
        if (!oi.importedProductId) throw new Error(`بند بلا منتج: ${edit.orderItemId}`);
        if (edit.qty > oi.qty) throw new Error(`الكمية المختارة أكبر من المشتراة (بند ${edit.orderItemId})`);

        const variants = await tx.productVariant.findMany({
          where: { productId: oi.importedProductId, sellerId: buyerSellerId },
          select: { id: true },
        });
        if (variants.length === 0) throw new Error(`منتج بلا متغيرات: ${oi.importedProductId}`);

        // update price on all variants
        await tx.productVariant.updateMany({
          where: { productId: oi.importedProductId, sellerId: buyerSellerId },
          data: { price: edit.salePrice, isActive: true },
        });

        // distribute qty: evenly
        const base = Math.floor(edit.qty / variants.length);
        const rem = edit.qty % variants.length;
        for (let i = 0; i < variants.length; i++) {
          const q = base + (i < rem ? 1 : 0);
          await tx.inventory.updateMany({
            where: { variantId: variants[i].id },
            data: { quantity: q },
          });
        }

        // update order item
        await tx.wholesaleOrderItem.update({
          where: { id: oi.id },
          data: {
            importedQty: edit.qty,
            salePrice: edit.salePrice,
            purchaseCost: edit.purchaseCost ?? null,
            importedAt: new Date(),
          },
        });

        // publish product
        await tx.product.update({
          where: { id: oi.importedProductId },
          data: { status: "ACTIVE" },
        });
        published++;
      }

      await tx.wholesaleOrder.update({
        where: { id: orderId },
        data: { status: "ACCEPTED" },
      });

      return { published };
    }, { timeout: 45000 });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Activate error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}