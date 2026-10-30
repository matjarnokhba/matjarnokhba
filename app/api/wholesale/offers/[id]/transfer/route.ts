import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { InventoryService } from "@/services/inventory.service";

const schema = z.object({
  offerVariantId: z.number().int().positive(),
  retailVariantId: z.number().int().positive(),
  qty: z.number().int().min(1),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json(
        { success: false, message: "يجب أن يكون لديك متجر" },
        { status: 403 }
      );
    }

    if (current.user.seller.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, message: "متجرك غير نشط" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const offerId = parseInt(id);
    if (isNaN(offerId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const { offerVariantId, retailVariantId, qty, notes } = parsed.data;

    const offer = await prisma.sellerOffer.findUnique({
      where: { id: offerId },
      include: {
        variants: { where: { id: offerVariantId } },
        supplier: { select: { userId: true, id: true } },
      },
    });

    if (!offer || offer.deletedAt) {
      return NextResponse.json({ success: false, message: "العرض غير موجود" }, { status: 404 });
    }

    if (offer.supplier.userId !== current.user.id) {
      return NextResponse.json(
        { success: false, message: "فقط مالك العرض يمكنه التحويل من مخزونه" },
        { status: 403 }
      );
    }

    const offerVariant = offer.variants[0];
    if (!offerVariant) {
      return NextResponse.json(
        { success: false, message: "variant العرض غير موجود" },
        { status: 404 }
      );
    }

    if (offerVariant.stock < qty) {
      return NextResponse.json(
        {
          success: false,
          message: `المخزون غير كافٍ — المتوفر: ${offerVariant.stock}`,
        },
        { status: 400 }
      );
    }

    const retailVariant = await prisma.productVariant.findUnique({
      where: { id: retailVariantId },
      include: {
        product: { select: { sellerId: true } },
      },
    });

    if (!retailVariant) {
      return NextResponse.json(
        { success: false, message: "variant المحل غير موجود" },
        { status: 404 }
      );
    }

    if (retailVariant.product.sellerId !== current.user.seller.id) {
      return NextResponse.json(
        { success: false, message: "variant المحل ليس لك" },
        { status: 403 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const decremented = await tx.sellerOfferVariant.updateMany({
        where: { id: offerVariantId, stock: { gte: qty } },
        data: { stock: { decrement: qty } },
      });
      if (decremented.count === 0) {
        throw new Error("تعذر خصم المخزون — قد يكون تغيّر");
      }

      await InventoryService.stockIn(
        tx,
        retailVariantId,
        qty,
        current.user.id,
        `تحويل من مخزون الجملة عرض #${offerId}`
      );

      await tx.wholesaleStockTransfer.create({
        data: {
          offerVariantId,
          retailVariantId,
          qty,
          type: "OFFER_TO_RETAIL",
          notes: notes || null,
        },
      });

      return { offerVariantId, retailVariantId, qty };
    });

    return NextResponse.json({ success: true, transfer: result });
  } catch (error) {
    console.error("Transfer error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}