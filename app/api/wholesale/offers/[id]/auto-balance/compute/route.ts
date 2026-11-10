import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { AutoBalanceService, type SizeQty } from "@/services/auto-balance.service";

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
    const sizesRaw = url.searchParams.get("sizes");

    let sizesInput: SizeQty[] | number;
    if (sizesRaw && sizesRaw.includes(":")) {
      // New format: "M:100,L:50"
      try {
        sizesInput = sizesRaw
          .split(",")
          .map((e) => {
            const trimmed = e.trim();
            const parts = trimmed.split(":");
            if (parts.length !== 2) {
              throw new Error(`صيغة غير صحيحة: ${trimmed} (استخدم M:100)`);
            }
            const size = parts[0].trim();
            const qty = parseInt(parts[1].trim(), 10);
            if (!size || isNaN(qty) || qty < 1) {
              throw new Error(`كمية أو مقاس غير صحيح: ${trimmed}`);
            }
            return { size, qty };
          })
          .filter((s) => s.qty > 0);
      } catch (e: any) {
        return NextResponse.json(
          { success: false, message: e?.message || "صيغة sizes غير صحيحة" },
          { status: 400 }
        );
      }
      if (sizesInput.length === 0) {
        return NextResponse.json(
          { success: false, message: "sizes فارغة" },
          { status: 400 }
        );
      }
    } else if (qtyRaw) {
      // Legacy wildcard: ?qty=N
      const q = parseInt(qtyRaw, 10);
      if (!q || q < 1) {
        return NextResponse.json(
          { success: false, message: "qty مطلوب (عدد موجب)" },
          { status: 400 }
        );
      }
      sizesInput = q;
    } else {
      return NextResponse.json(
        { success: false, message: "qty أو sizes مطلوب" },
        { status: 400 }
      );
    }

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

    const result = await AutoBalanceService.compute(offerId, sizesInput);
    return NextResponse.json({ success: true, ...result });
  } catch (e: any) {
    console.error("auto-balance compute:", e);
    return NextResponse.json(
      { success: false, message: e?.message || "حدث خطأ" },
      { status: 500 }
    );
  }
}