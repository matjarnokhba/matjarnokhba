import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/seller-guards";
import { buildWalletSummary, RETURN_SHIPPING_PREFIX, REJECTED_WITHDRAWAL_PREFIX } from "@/lib/wallet-summary";

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

    type TxType = "REFUND_DEDUCTION" | "MANUAL_ADJUSTMENT" | "SUBSCRIPTION_PAYMENT" | "WITHDRAWAL";
    const sumOf = async (type: TxType, prefix?: string) => {
      const a = await prisma.walletTransaction.aggregate({
        where: { sellerId, type, ...(prefix ? { description: { startsWith: prefix } } : {}) },
        _sum: { amount: true },
      });
      return Number(a._sum.amount ?? 0);
    };
    const [refundDeductionSum, returnShippingSum, subscriptionSum, withdrawalSum, rejectedWithdrawalSum] = await Promise.all([
      sumOf("REFUND_DEDUCTION"),
      sumOf("MANUAL_ADJUSTMENT", RETURN_SHIPPING_PREFIX),
      sumOf("SUBSCRIPTION_PAYMENT"),
      sumOf("WITHDRAWAL"),
      sumOf("MANUAL_ADJUSTMENT", REJECTED_WITHDRAWAL_PREFIX),
    ]);
    const summary = buildWalletSummary({
      totalRevenue: Number(seller?.totalRevenue ?? 0),
      totalCommission: Number(seller?.totalCommission ?? 0),
      refundDeductionSum,
      returnShippingSum,
      subscriptionSum,
      withdrawalSum,
      rejectedWithdrawalSum,
    });
    return NextResponse.json({
      success: true,
      seller,
      summary,
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