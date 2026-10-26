import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/seller-guards";

export async function GET() {
  try {
    const guard = await requireStaffPermission("VIEW_WALLET");
    if (!guard.ok) return guard.response;
    const current = guard.current;

    const sellerId = current.user.seller!.id;

    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      select: {
        walletBalance: true,
        heldBalance: true,
        totalRevenue: true,
        totalCommission: true,
      },
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

    return NextResponse.json({
      success: true,
      seller,
      transactions,
      withdrawals,
      isSellerOwner: current.user.isSellerOwner,
    });
  } catch (error) {
    console.error("Wallet GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}