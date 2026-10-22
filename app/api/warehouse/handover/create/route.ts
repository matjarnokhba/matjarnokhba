import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({ amount: z.number().positive() });

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !["WAREHOUSE_MANAGER"].includes(current.user.role)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });

    const handoverToken = crypto.randomUUID();

    const handover = await prisma.adminCashHandover.create({
      data: {
        warehouseId: current.user.id,
        amount: parsed.data.amount,
        handoverToken,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, qrToken: handoverToken });
  } catch (error) {
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}