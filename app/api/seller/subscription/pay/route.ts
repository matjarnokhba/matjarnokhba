import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { WalletTransactionType } from "@/app/generated/prisma/enums";
import { requireSellerOwner } from "@/lib/seller-guards";

const schema = z.object({
  plan: z.enum(["MONTHLY", "YEARLY"]),
});

export async function POST(request: Request) {
  try {
    const guard = await requireSellerOwner();
    if (!guard.ok) return guard.response;
    const current = guard.current;

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "خطة غير صحيحة" },
        { status: 400 }
      );
    }

    const { plan } = parsed.data;
    const sellerId = current.user.seller!.id;
    const price = plan === "MONTHLY" ? 50 : 350;
    const days = plan === "MONTHLY" ? 30 : 365;

    const result = await prisma.$transaction(async (tx) => {
      const seller = await tx.seller.findUnique({
        where: { id: sellerId },
        select: { walletBalance: true, subscriptionEndsAt: true },
      });

      if (!seller || Number(seller.walletBalance) < price) {
        throw new Error(
          "رصيد محفظتك غير كافٍ. يرجى سحب أرباحك أو شحن المحفظة أولاً."
        );
      }

      const beforeBal = Number(seller.walletBalance);
      const afterBal = beforeBal - price;

      await tx.seller.update({
        where: { id: sellerId },
        data: { walletBalance: { decrement: price } },
      });

      const now = new Date();
      const currentEnd = seller.subscriptionEndsAt;
      const startFrom =
        currentEnd && currentEnd > now ? currentEnd : now;
      const newEnd = new Date(
        startFrom.getTime() + days * 24 * 60 * 60 * 1000
      );

      await tx.seller.update({
        where: { id: sellerId },
        data: {
          subscriptionStatus: "ACTIVE",
          subscriptionEndsAt: newEnd,
        },
      });

      await tx.walletTransaction.create({
        data: {
          sellerId,
          type: WalletTransactionType.SUBSCRIPTION_PAYMENT,
          amount: -price,
          balanceBefore: beforeBal,
          balanceAfter: afterBal,
          description: `تجديد اشتراك (${plan === "MONTHLY" ? "شهري" : "سنوي"})`,
        },
      });

      await tx.subscriptionLog.create({
        data: {
          sellerId,
          plan,
          amount: price,
          startsAt: startFrom,
          endsAt: newEnd,
        },
      });

      return { plan, price, startsAt: startFrom, endsAt: newEnd };
    });

    return NextResponse.json({ success: true, subscription: result });
  } catch (error) {
    console.error("Subscription pay error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}