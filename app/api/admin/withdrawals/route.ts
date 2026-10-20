import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const withdrawals = await prisma.withdrawalRequest.findMany({
      include: {
        seller: { select: { storeName: true, user: { select: { name: true, phone: true } } } }
      },
      orderBy: { requestedAt: "desc" },
    });

    return NextResponse.json({ success: true, withdrawals });
  } catch (error) {
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}