import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/seller-guards";
import { StoreSaleReturnService } from "@/services/store-sale-return.service";
import { mapServiceError } from "@/lib/stock-api";

const schema = z.object({
  storeSaleId: z.number().int().positive(),
  reason: z.string().trim().max(500).optional().nullable(),
  items: z
    .array(
      z.object({
        storeSaleItemId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(100000),
        condition: z.enum(["RESELLABLE", "DEFECTIVE"]),
        note: z.string().trim().max(300).optional().nullable(),
      })
    )
    .min(1)
    .max(100),
});

// تنفيذ إرجاع من إيصال بيع المحل
export async function POST(request: Request) {
  try {
    const guard = await requireStaffPermission("RETURN_POS_SALE");
    if (!guard.ok) return guard.response;
    const { current } = guard;

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
        StoreSaleReturnService.createReturn(tx, {
          sellerId: current.user.seller!.id,
          storeSaleId: parsed.data.storeSaleId,
          processedByUserId: current.user.id,
          reason: parsed.data.reason,
          items: parsed.data.items,
        }),
      { timeout: 30000 }
    );
    return NextResponse.json({ success: true, result }, { status: 201 });
  } catch (e) {
    const mapped = mapServiceError(e);
    if (mapped) return mapped;
    console.error("Store sale return error:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ أثناء الإرجاع" }, { status: 500 });
  }
}