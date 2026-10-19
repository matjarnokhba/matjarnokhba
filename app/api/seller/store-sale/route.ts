import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { InventoryService } from "@/services/inventory.service";

const schema = z.object({
  items: z.array(
    z.object({
      variantId: z.number(),
      quantity: z.number().min(1),
      unitPrice: z.number().min(0),
    })
  ).min(1),
  customerName: z.string().trim().max(100).optional().nullable(),
  customerPhone: z.string().trim().max(20).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
    }

    const sellerId = current.user.seller.id;
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });
    }

    const { items, customerName, customerPhone, note } = parsed.data;

    const variantIds = items.map((i) => i.variantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, sellerId },
      select: { id: true, price: true, storePrice: true },
    });

    if (variants.length !== variantIds.length) {
      return NextResponse.json({ success: false, message: "بعض المنتجات غير موجودة أو لا تخصك" }, { status: 400 });
    }

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    let totalAmount = 0;
    const saleItemsData = items.map((item) => {
      const variant = variantMap.get(item.variantId)!;
      const finalPrice = item.unitPrice > 0 ? item.unitPrice : (variant.storePrice ? Number(variant.storePrice) : Number(variant.price));
      const lineTotal = finalPrice * item.quantity;
      totalAmount += lineTotal;

      return {
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: finalPrice,
        total: lineTotal,
      };
    });

    const receipt = await prisma.$transaction(async (tx) => {
      const receiptNumber = `POS-${Date.now()}`;

      const sale = await tx.storeSale.create({
        data: {
          sellerId,
          receiptNumber,
          totalAmount,
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          note: note || null,
          items: {
            create: saleItemsData,
          },
        },
      });

      for (const item of items) {
        await InventoryService.saleDirect(tx, item.variantId, item.quantity, sale.id);
      }

      return sale;
    });

    return NextResponse.json({
      success: true,
      sale: {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        total: Number(receipt.totalAmount),
      },
    });

  } catch (error) {
    console.error("Store sale error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ أثناء الحفظ" }, { status: 500 });
  }
}