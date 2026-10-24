import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(current.user.role)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: 1 } },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    return NextResponse.json({
      success: true,
      balance: wallet ? Number(wallet.balance) : 0,
      cashInHand: wallet ? Number(wallet.cashInHand) : 0,
      cashOwedToPlatform: wallet ? Number(wallet.cashOwedToPlatform) : 0,
      cashOwedToDrivers: wallet ? Number(wallet.cashOwedToDrivers) : 0,
      transactions: wallet?.transactions || [],
    });
  } catch (error) {
    console.error("Warehouse wallet GET error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}