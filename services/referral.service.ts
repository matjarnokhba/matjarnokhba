import { prisma } from "@/lib/prisma";

const REFERRAL_POINTS = 20;

// ═══════ توليد كود إحالة ═══════
function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const ReferralService = {
  // ═══════ كود فريد ═══════
  async generateUniqueCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = generateReferralCode();
      const exists = await prisma.user.findUnique({
        where: { referralCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    // fallback (نادر جداً)
    return `REF${Date.now().toString(36).toUpperCase()}`;
  },

  // ═══════ ربط المستخدم الجديد بصاحب الإحالة ═══════
  async linkReferral(newUserId: number, referralCode: string) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: referralCode.trim().toUpperCase() },
      select: { id: true },
    });

    if (!referrer) return null;
    if (referrer.id === newUserId) return null;

    // إنشاء سجل الإحالة (بدون منح نقاط)
    try {
      const referral = await prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: newUserId,
        },
      });

      // تحديث referredById للمستخدم الجديد
      await prisma.user.update({
        where: { id: newUserId },
        data: { referredById: referrer.id },
      });

      return referral;
    } catch (err: any) {
      // فريد — قد يفشل لو تربط مسبقاً
      if (err?.code === "P2002") return null;
      throw err;
    }
  },

  // ═══════ منح النقاط عند أول طلب مؤهل ═══════
  async awardOnFirstOrder(
    tx: any,
    userId: number,
    orderId: number
  ): Promise<{ awarded: boolean; pointsAwarded: number }> {
    // هل المستخدم مُحال؟
    const referral = await tx.referral.findUnique({
      where: { referredId: userId },
    });

    if (!referral) return { awarded: false, pointsAwarded: 0 };
    if (referral.rewardedAt) return { awarded: false, pointsAwarded: 0 };

    // حساب نقاط referrer
    const referrerAccount = await tx.loyaltyAccount.findUnique({
      where: { userId: referral.referrerId },
    });

    let accountId: number;
    if (!referrerAccount) {
      const created = await tx.loyaltyAccount.create({
        data: {
          userId: referral.referrerId,
          balance: 0,
          totalEarned: 0,
          totalRevoked: 0,
        },
      });
      accountId = created.id;
    } else {
      accountId = referrerAccount.id;
    }

    const before = referrerAccount?.balance ?? 0;
    const after = before + REFERRAL_POINTS;

    // تحديث الحساب
    await tx.loyaltyAccount.update({
      where: { id: accountId },
      data: {
        balance: after,
        totalEarned: { increment: REFERRAL_POINTS },
      },
    });

    // Ledger
    await tx.loyaltyTransaction.create({
      data: {
        accountId,
        type: "BONUS",
        points: REFERRAL_POINTS,
        balanceBefore: before,
        balanceAfter: after,
        reason: `مكافأة إحالة — أول طلب للعميل المُحال`,
        metadata: {
          referredUserId: userId,
          firstOrderId: orderId,
        },
      },
    });

    // تحديث سجل الإحالة
    await tx.referral.update({
      where: { id: referral.id },
      data: {
        firstOrderId: orderId,
        firstOrderAt: new Date(),
        pointsAwarded: REFERRAL_POINTS,
        rewardedAt: new Date(),
      },
    });

    // إشعار لصاحب الإحالة
    await tx.notification.create({
      data: {
        userId: referral.referrerId,
        type: "ORDER_STATUS_CHANGED",
        title: "🎁 ربحت 20 نقطة إحالة!",
        message: `صديق دعوته أكمل أول عملية شراء. تم إضافة 20 نقطة لرصيدك.`,
        link: `/loyalty`,
        category: "ORDER",
        severity: "INFO",
        metadata: {
          pointsAwarded: REFERRAL_POINTS,
          referredUserId: userId,
          orderId,
        },
      },
    });

    return { awarded: true, pointsAwarded: REFERRAL_POINTS };
  },

  // ═══════ إحصائيات الإحالة لمستخدم ═══════
  async getStats(userId: number) {
    const [total, completed] = await Promise.all([
      prisma.referral.count({ where: { referrerId: userId } }),
      prisma.referral.count({
        where: { referrerId: userId, rewardedAt: { not: null } },
      }),
    ]);

    const totalPoints = completed * REFERRAL_POINTS;

    return {
      totalInvited: total,
      completed,
      pending: total - completed,
      totalPoints,
      pointsPerReferral: REFERRAL_POINTS,
    };
  },

  // ═══════ قائمة المُحالين ═══════
  async getReferredUsers(userId: number) {
    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        referred: {
          select: { id: true, name: true, createdAt: true },
        },
      },
    });

    return referrals.map((r) => ({
      id: r.id,
      name: r.referred.name,
      joinedAt: r.createdAt,
      completed: !!r.rewardedAt,
      firstOrderAt: r.firstOrderAt,
      pointsAwarded: r.pointsAwarded,
    }));
  },
};