import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  driverId: z.number().int().positive(),
  expectedAmount: z.number().positive(), // المبلغ المفروض
  actualAmount: z.number().min(0),       // المبلغ الذي جلبه السائق فعلياً
});

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(current.user.role)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });

    const { driverId, expectedAmount, actualAmount } = parsed.data;
    const shortfall = expectedAmount - actualAmount;

    // إنشاء رمز QR فريد
    const handoverToken = crypto.randomUUID();

    const handover = await prisma.cashHandover.create({
      data: {
        driverId,
        warehouseId: current.user.id,
        amount: actualAmount,
        shortfall: shortfall > 0 ? shortfall : 0,
        handoverToken,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      handoverId: handover.id,
      qrToken: handoverToken,
      shortfall: shortfall > 0 ? shortfall : 0,
    });

  } catch (error) {
    console.error("Cash handover create error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}