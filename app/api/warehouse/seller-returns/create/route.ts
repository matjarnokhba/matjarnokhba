import { NextResponse } from "next/server";
import { z } from "zod";
import { SessionService } from "@/services/session.service";
import { SellerReturnService } from "@/services/seller-return.service";

const schema = z.object({
  sellerId: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (
      !current ||
      !["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(current.user.role)
    ) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const result = await SellerReturnService.createBatch(
      parsed.data.sellerId,
      current.user.id
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Seller return create error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}