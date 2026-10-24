import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({ amount: z.number().positive() });

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "WAREHOUSE_MANAGER") {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });

    // التحقق من أن المبلغ أقل أو يساوي الكاش الموجود في حوزة المستودع
    const warehouseWallet = await prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: 1 } }
    });

    const cashInHand = warehouseWallet ? Number(warehouseWallet.cashInHand) : 0;
    if (parsed.data.amount > cashInHand) {
      return NextResponse.json({ success: false, message: `المبلغ المطلوب (${parsed.data.amount}) يتجاوز الكاش الموجود في حوزتك (${cashInHand})` }, { status: 400 });
    }

    const handoverToken = crypto.randomUUID();

    await prisma.adminCashHandover.create({
      data: {
        warehouseId: current.user.id,
        amount: parsed.data.amount,
        handoverToken,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, qrToken: handoverToken, amount: parsed.data.amount });
  } catch (error) {
    console.error("Handover create error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}