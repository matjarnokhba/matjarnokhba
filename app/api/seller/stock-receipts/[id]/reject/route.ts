import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/seller-guards";
import { StockReceiptService } from "@/services/stock-receipt.service";
import { mapServiceError } from "@/lib/stock-api";

const schema = z.object({ reason: z.string().trim().min(3).max(500) });

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireStaffPermission("APPROVE_STOCK");
    if (!guard.ok) return guard.response;
    const { current } = guard;
    const id = parseInt((await ctx.params).id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, message: "رقم غير صالح" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "اكتب سبب الرفض" }, { status: 400 });
    }

    const result = await prisma.$transaction(
      (tx) =>
        StockReceiptService.rejectReceipt(tx, {
          receiptId: id,
          sellerId: current.user.seller!.id,
          decidedByUserId: current.user.id,
          reason: parsed.data.reason,
        }),
      { timeout: 30000 }
    );
    return NextResponse.json({ success: true, result });
  } catch (e) {
    const mapped = mapServiceError(e);
    if (mapped) return mapped;
    console.error("Reject stock receipt error:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ أثناء الرفض" }, { status: 500 });
  }
}