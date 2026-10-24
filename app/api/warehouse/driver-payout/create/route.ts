import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  driverId: z.number().int().positive(),
  amount: z.number().positive(),
  method: z.enum(["CASH", "BANK"]),
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

    const driverWallet = await prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: parsed.data.driverId } }
    });

    if (!driverWallet) return NextResponse.json({ success: false, message: "محفظة السائق غير موجودة" }, { status: 404 });
    
    // منع الدفع إذا كان السائق محظوراً (لم يسلّم الكاش)
    if (driverWallet.isBlocked) {
      return NextResponse.json({ success: false, message: "لا يمكن الدفع لهذا السائق لأنه لم يقم بتسليم الكاش للمستودع بعد." }, { status: 400 });
    }

    if (parsed.data.amount > Number(driverWallet.balance)) {
      return NextResponse.json({ success: false, message: "المبلغ المطلوب أكبر من رصيد السائق المتاح." }, { status: 400 });
    }

    const payoutToken = crypto.randomUUID();

    const payout = await prisma.driverPayout.create({
      data: {
        driverId: parsed.data.driverId,
        warehouseId: current.user.id,
        amount: parsed.data.amount,
        method: parsed.data.method,
        payoutToken,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, payoutId: payout.id, qrToken: payoutToken });
  } catch (error) {
    console.error("Driver payout create error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}