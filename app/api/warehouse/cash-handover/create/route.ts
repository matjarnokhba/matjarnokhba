import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  driverId: z.number().int().positive(),
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

    // جلب محفظة السائق لمعرفة الكاش الفعلي
    const driverWallet = await prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: parsed.data.driverId } }
    });

    const cashExpected = driverWallet ? Number(driverWallet.cashInHand) : 0;

    if (cashExpected <= 0) {
      return NextResponse.json({ success: false, message: "هذا السائق لا يحمل أي كاش حالياً" }, { status: 400 });
    }

    const handoverToken = crypto.randomUUID();

    const handover = await prisma.cashHandover.create({
      data: {
        driverId: parsed.data.driverId,
        warehouseId: current.user.id,
        amount: cashExpected, // المبلغ المتوقع (120)
        shortfall: 0,
        handoverToken,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      handoverId: handover.id,
      qrToken: handoverToken,
      expectedAmount: cashExpected,
    });
  } catch (error) {
    console.error("Cash handover create error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}