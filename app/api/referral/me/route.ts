import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { ReferralService } from "@/services/referral.service";

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: current.user.id },
      select: { referralCode: true, referredById: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "المستخدم غير موجود" },
        { status: 404 }
      );
    }

    const [stats, referredUsers] = await Promise.all([
      ReferralService.getStats(current.user.id),
      ReferralService.getReferredUsers(current.user.id),
    ]);

    return NextResponse.json({
      success: true,
      referralCode: user.referralCode,
      wasReferred: !!user.referredById,
      stats,
      referredUsers,
    });
  } catch (error) {
    console.error("Referral me error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}