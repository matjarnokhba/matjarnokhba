import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSeller } from "@/lib/seller-guards";
import {
  stockVisibility,
  RECEIPT_INCLUDE,
  receiptToDto,
  receiptUserIds,
  loadUserNames,
} from "@/lib/stock-api";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireSeller();
    if (!guard.ok) return guard.response;
    const { current } = guard;
    const vis = stockVisibility(current);
    if (!vis.all && !vis.own) {
      return NextResponse.json({ success: false, message: "لا تملك الصلاحية لهذه العملية" }, { status: 403 });
    }
    const id = parseInt((await ctx.params).id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, message: "رقم غير صالح" }, { status: 400 });
    }

    const row = await prisma.stockReceipt.findFirst({
      where: { id, sellerId: current.user.seller!.id, ...(vis.all ? {} : { enteredByUserId: current.user.id }) },
      include: RECEIPT_INCLUDE,
    });
    if (!row) return NextResponse.json({ success: false, message: "الطلب غير موجود" }, { status: 404 });

    const names = await loadUserNames(prisma, receiptUserIds([row]));
    return NextResponse.json({ success: true, receipt: { ...receiptToDto(row, names), canEdit: row.status === "PENDING" && row.enteredByUserId === current.user.id, edited: row.status === "PENDING" && row.updatedAt.getTime() - row.createdAt.getTime() > 2000 } });
  } catch (e) {
    console.error("Get stock receipt error:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ غير متوقع" }, { status: 500 });
  }
}