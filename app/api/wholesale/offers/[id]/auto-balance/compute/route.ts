import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { AutoBalanceService } from "@/services/auto-balance.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
    }
    const { id } = await params;
    const offerId = parseInt(id);
    if (isNaN(offerId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }

    const url = new URL(request.url);
    const qtyRaw = url.searchParams.get("qty");
    const qty = qtyRaw ? parseInt(qtyRaw, 10) : 0;
    if (!qty || qty < 1) {
      return NextResponse.json({ success: false, message: "qty مطلوب (عدد موجب)" }, { status: 400 });
    }

    const lockedVariantIdRaw = url.searchParams.get("lockedVariantId");
    const lockedQtyRaw = url.searchParams.get("lockedQty");
    let locked: { variantId: number; qty: number } | undefined;
    if (lockedVariantIdRaw && lockedQtyRaw) {
      const vid = parseInt(lockedVariantIdRaw, 10);
      const lq = parseInt(lockedQtyRaw, 10);
      if (!isNaN(vid) && !isNaN(lq) && lq >= 0) {
        locked = { variantId: vid, qty: lq };
      }
    }
    const sizesRaw = url.searchParams.get("sizes");
    const sizeFilter = sizesRaw
      ? sizesRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

    const offer = await prisma.wholesaleOffer.findUnique({
      where: { id: offerId },
      select: { autoBalanceEnabled: true, deletedAt: true },
    });
    if (!offer || offer.deletedAt) {
      return NextResponse.json({ success: false, message: "العرض غير موجود" }, { status: 404 });
    }
    if (!offer.autoBalanceEnabled) {
      return NextResponse.json(
        { success: false, message: "التوزيع التلقائي غير مفعّل لهذا العرض" },
        { status: 400 }
      );
    }

    const result = await AutoBalanceService.compute(offerId, qty, locked, sizeFilter);
    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    console.error("auto-balance compute:", e);
    return NextResponse.json(
      { success: false, message: e?.message || "حدث خطأ" },
      { status: 500 }
    );
  }
}