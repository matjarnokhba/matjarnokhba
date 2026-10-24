import { NextResponse } from "next/server";
import { z } from "zod";
import { SessionService } from "@/services/session.service";
import { SellerReturnService } from "@/services/seller-return.service";

const schema = z.object({
  token: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "رمز غير صحيح" },
        { status: 400 }
      );
    }

    const result = await SellerReturnService.pickupByCollector(
      parsed.data.token,
      current.user.id
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Seller return pickup error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}