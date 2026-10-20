import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
    }

    const sellerId = current.user.seller.id;

    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      select: {
        walletBalance: true,
        heldBalance: true,
        totalRevenue: true,
        totalCommission: true,
      }
    });

    const transactions = await prisma.walletTransaction.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const withdrawals = await prisma.withdrawalRequest.findMany({
      where: { sellerId },
      orderBy: { requestedAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ success: true, seller, transactions, withdrawals });
  } catch (error) {
    console.error("Wallet GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}