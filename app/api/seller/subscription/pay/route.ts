import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { WalletTransactionType } from "@/app/generated/prisma/enums";

const schema = z.object({
  plan: z.enum(["MONTHLY", "YEARLY"]),
});

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, message: "خطة غير صحيحة" }, { status: 400 });

    const { plan } = parsed.data;
    const sellerId = current.user.seller.id;
    const price = plan === "MONTHLY" ? 50 : 350;
    const days = plan === "MONTHLY" ? 30 : 365;

    const result = await prisma.$transaction(async (tx) => {
      const seller = await tx.seller.findUnique({
        where: { id: sellerId },
        select: { walletBalance: true, subscriptionEndsAt: true }
      });

      if (!seller || Number(seller.walletBalance) < price) {
        throw new Error("رصيد محفظتك غير كافٍ. يرجى سحب أرباحك أو شحن المحفظة أولاً.");
      }

      const beforeBal = Number(seller.walletBalance);
      const afterBal = beforeBal - price;

      // خصم المبلغ
      await tx.seller.update({
        where: { id: sellerId },
        data: { walletBalance: { decrement: price } }
      });

      // تسجيل الحركة
      await tx.walletTransaction.create({
        data: {
          sellerId,
          type: WalletTransactionType.SUBSCRIPTION_PAYMENT,
          amount: -price,
          balanceBefore: beforeBal,
          balanceAfter: afterBal,
          description: `دفع اشتراك (${plan === "MONTHLY" ? "شهري" : "سنوي"}) لنظام البيع في المحل`,
        }
      });

      // حساب تاريخ البداية والنهاية
      const now = new Date();
      const startsAt = seller.subscriptionEndsAt && new Date(seller.subscriptionEndsAt) > now 
        ? new Date(seller.subscriptionEndsAt) // إذا كان ما زال مشتركاً، نضيف المدة الجديدة فوق القديمة
        : now;
      
      const endsAt = new Date(startsAt);
      endsAt.setDate(endsAt.getDate() + days);

      // تحديث حالة الاشتراك
      await tx.seller.update({
        where: { id: sellerId },
        data: {
          subscriptionStatus: "ACTIVE",
          subscriptionEndsAt: endsAt,
        }
      });

      // تسجيل في سجل الاشتراكات
      await tx.subscriptionLog.create({
        data: {
          sellerId,
          plan,
          amount: price,
          startsAt,
          endsAt,
        }
      });

      return { endsAt };
    });

    return NextResponse.json({ success: true, endsAt: result.endsAt });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}