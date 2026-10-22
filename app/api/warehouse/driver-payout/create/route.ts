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

    const { driverId, amount, method } = parsed.data;
    const payoutToken = crypto.randomUUID();

    const payout = await prisma.driverPayout.create({
      data: {
        driverId,
        warehouseId: current.user.id,
        amount,
        method,
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