import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const platformId = 1;

    const wallet = await prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: "PLATFORM", ownerId: platformId } },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 50,
        }
      }
    });

    const subRevenue = await prisma.subscriptionLog.aggregate({
      _sum: { amount: true }
    });

    return NextResponse.json({
      success: true,
      balance: wallet ? Number(wallet.balance) : 0,
      heldBalance: wallet ? Number(wallet.heldBalance) : 0,
      transactions: wallet?.transactions || [],
      subscriptionRevenue: Number(subRevenue._sum.amount || 0),
    });
  } catch (error) {
    console.error("Admin wallet GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}