import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/seller-guards";
import { InventoryService } from "@/services/inventory.service";

const round2 = (n: number) => Math.round(n * 100) / 100;

const schema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(10000),
        // لا يُعتمد إلا كتخفيض من المالك (انظر أدناه)
        unitPrice: z.number().min(0).optional(),
      })
    )
    .min(1),
  customerName: z.string().trim().max(100).optional().nullable(),
  customerPhone: z.string().trim().max(20).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const _sGuard = await requireStaffPermission("SELL_ON_POS");
    if (!_sGuard.ok) return _sGuard.response;
    const current = _sGuard.current;
    const sellerId = current.user.seller!.id;
    const canDiscount = !!current.user.isSellerOwner || current.user.staffPermissions.includes("GIVE_DISCOUNT");

    // ═══ صلاحية الاشتراك ═══
    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      select: { subscriptionStatus: true, subscriptionEndsAt: true },
    });
    if (!seller) {
      return NextResponse.json({ success: false, message: "التاجر غير موجود" }, { status: 404 });
    }
    const isExpired =
      seller.subscriptionEndsAt && new Date(seller.subscriptionEndsAt) < new Date();
    if (isExpired || seller.subscriptionStatus === "EXPIRED") {
      return NextResponse.json(
        { success: false, message: "اشتراك نظام البيع في المحل قد انتهى. يرجى التجديد من صفحة الاشتراك." },
        { status: 403 }
      );
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });
    }
    const { items, customerName, customerPhone, note } = parsed.data;

    // دمج السطور المكررة + ترتيب ثابت (يمنع deadlock)
    const merged = new Map<number, { variantId: number; quantity: number; unitPrice?: number }>();
    for (const it of items) {
      const prev = merged.get(it.variantId);
      if (prev) {
        prev.quantity += it.quantity;
        if (prev.unitPrice !== it.unitPrice) prev.unitPrice = undefined;
      } else {
        merged.set(it.variantId, { ...it });
      }
    }
    const lines = [...merged.values()].sort((a, b) => a.variantId - b.variantId);

    const variants = await prisma.productVariant.findMany({
      where: {
        id: { in: lines.map((l) => l.variantId) },
        sellerId,
        isActive: true,
        product: { deletedAt: null },
      },
      select: {
        id: true,
        price: true,
        storePrice: true,
        inventory: { select: { quantity: true } },
        product: { select: { name: true } },
      },
    });
    if (variants.length !== lines.length) {
      return NextResponse.json(
        { success: false, message: "بعض المنتجات غير موجودة أو غير متاحة أو لا تخصك" },
        { status: 400 }
      );
    }
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    let totalAmount = 0;
    const saleItemsData: { variantId: number; quantity: number; unitPrice: number; total: number }[] = [];
    for (const line of lines) {
      const v = variantMap.get(line.variantId)!;

      if ((v.inventory?.quantity ?? 0) < line.quantity) {
        return NextResponse.json(
          { success: false, message: `الكمية غير متوفرة للمنتج "${v.product.name}"` },
          { status: 400 }
        );
      }

      // السعر من قاعدة البيانات دائماً
      const listPrice = Number(v.storePrice ?? v.price);
      let unitPrice = listPrice;
      // تخفيض مسموح للمالك أو لمن منحه المالك صلاحية GIVE_DISCOUNT
      if (canDiscount && line.unitPrice !== undefined && line.unitPrice > 0 && line.unitPrice < listPrice) {
        unitPrice = line.unitPrice;
      }

      const lineTotal = round2(unitPrice * line.quantity);
      totalAmount += lineTotal;
      saleItemsData.push({
        variantId: line.variantId,
        quantity: line.quantity,
        unitPrice,
        total: lineTotal,
      });
    }
    totalAmount = round2(totalAmount);

    const receipt = await prisma.$transaction(async (tx) => {
      const receiptNumber = `POS-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

      const sale = await tx.storeSale.create({
        data: {
          sellerId,
          receiptNumber,
          totalAmount,
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          note: note || null,
          items: { create: saleItemsData },
        },
      });

      for (const line of lines) {
        await InventoryService.saleDirect(tx, line.variantId, line.quantity, sale.id);
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