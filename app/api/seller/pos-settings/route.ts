import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSeller, requireSellerOwner } from "@/lib/seller-guards";
import { parseReturnWindowDays, POS_RETURN_WINDOW_MIN, POS_RETURN_WINDOW_MAX } from "@/services/store-sale-return.service";

const schema = z.object({ posReturnWindowDays: z.number() });

export async function GET() {
  try {
    const guard = await requireSeller();
    if (!guard.ok) return guard.response;
    const seller = await prisma.seller.findUnique({
      where: { id: guard.current.user.seller!.id },
      select: { posReturnWindowDays: true },
    });
    return NextResponse.json({
      success: true,
      posReturnWindowDays: parseReturnWindowDays(seller?.posReturnWindowDays) ?? POS_RETURN_WINDOW_MAX,
      min: POS_RETURN_WINDOW_MIN,
      max: POS_RETURN_WINDOW_MAX,
    });
  } catch (e) {
    console.error("POS settings get error:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ غير متوقع" }, { status: 500 });
  }
}

// تعديل مدة الإرجاع: لصاحب المتجر فقط
export async function PATCH(request: Request) {
  try {
    const guard = await requireSellerOwner();
    if (!guard.ok) return guard.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    const days = parsed.success ? parseReturnWindowDays(parsed.data.posReturnWindowDays) : null;
    if (days === null) {
      return NextResponse.json(
        { success: false, message: `مدة الإرجاع يجب أن تكون بين ${POS_RETURN_WINDOW_MIN} و${POS_RETURN_WINDOW_MAX} أيام` },
        { status: 400 }
      );
    }
    await prisma.seller.update({
      where: { id: guard.current.user.seller!.id },
      data: { posReturnWindowDays: days },
    });
    return NextResponse.json({ success: true, posReturnWindowDays: days });
  } catch (e) {
    console.error("POS settings update error:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ أثناء الحفظ" }, { status: 500 });
  }
}