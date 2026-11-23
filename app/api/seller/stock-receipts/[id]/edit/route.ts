import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isSafeDocumentUrl } from "@/lib/url-safety";
import { requireStaffPermission } from "@/lib/seller-guards";
import { StockReceiptService, STOCK_SOURCE_TYPES } from "@/services/stock-receipt.service";
import { mapServiceError } from "@/lib/stock-api";

const safeUrl = z.string().trim().url().max(1000).refine((u) => isSafeDocumentUrl(u), "unsafe url");

const schema = z.object({
  sourceType: z.enum(STOCK_SOURCE_TYPES).optional(),
  sourceName: z.string().trim().max(200).optional().nullable(),
  sourcePhone: z.string().trim().max(40).optional().nullable(),
  sourceNote: z.string().trim().max(1000).optional().nullable(),
  totalCost: z.number().min(0).max(100_000_000).optional().nullable(),
  invoiceUrl: safeUrl.optional().nullable(),
  invoiceName: z.string().trim().max(200).optional().nullable(),
  items: z
    .array(
      z.object({
        itemId: z.number().int().positive(),
        quantity: z.number().int().min(0).max(1_000_000),
        unitCost: z.number().min(0).max(10_000_000).optional().nullable(),
      })
    )
    .max(200)
    .optional(),
});

// تعديل طلب بانتظار الموافقة (صاحب الإدخال فقط، قبل بتّ التاجر)
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireStaffPermission("ADD_STOCK");
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
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });
    }

    const result = await prisma.$transaction(
      (tx) =>
        StockReceiptService.updatePendingReceipt(tx, {
          receiptId: id,
          sellerId: current.user.seller!.id,
          actorUserId: current.user.id,
          ...parsed.data,
        }),
      { timeout: 30000 }
    );
    return NextResponse.json({ success: true, receipt: result });
  } catch (e) {
    const mapped = mapServiceError(e);
    if (mapped) return mapped;
    console.error("Edit stock receipt error:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ أثناء الحفظ" }, { status: 500 });
  }
}