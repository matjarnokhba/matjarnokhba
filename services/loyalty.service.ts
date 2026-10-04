import { prisma } from "@/lib/prisma";

// ═══════ قاعدة الحساب ═══════
// النقاط = floor(value × 0.05 + 0.5)
// → 0.49 = 0، 0.50 = 1، 1.49 = 1، 1.50 = 2
export function calculatePoints(amount: number): number {
  if (amount <= 0) return 0;
  const raw = amount * 0.05;
  return Math.floor(raw + 0.5);
}

// ═══════ الأنواع ═══════
type AwardResult = {
  pointsAwarded: number;
  balanceBefore: number;
  balanceAfter: number;
  unlockedTiers: Array<{
    tierId: number;
    name: string;
    icon: string | null;
    rewardId: number;
  }>;
};

export const LoyaltyService = {
  // ═══════ حساب النقاط من مبلغ ═══════
  calculatePoints,

  // ═══════ جلب/إنشاء حساب الولاء ═══════
  async getOrCreateAccount(tx: any, userId: number) {
    let account = await tx.loyaltyAccount.findUnique({
      where: { userId },
    });
    if (!account) {
      account = await tx.loyaltyAccount.create({
        data: { userId, balance: 0, totalEarned: 0, totalRevoked: 0 },
      });
    }
    return account;
  },

  // ═══════ منح النقاط عند تسليم الطلب ═══════
  async awardForOrder(
    tx: any,
    params: { userId: number; orderId: number; orderTotal: number }
  ): Promise<AwardResult> {
    const { userId, orderId, orderTotal } = params;

    const settings = await tx.loyaltySettings.findUnique({
      where: { id: 1 },
    });
    if (!settings?.isEnabled) {
      return {
        pointsAwarded: 0,
        balanceBefore: 0,
        balanceAfter: 0,
        unlockedTiers: [],
      };
    }

    const points = calculatePoints(orderTotal);
    if (points <= 0) {
      return {
        pointsAwarded: 0,
        balanceBefore: 0,
        balanceAfter: 0,
        unlockedTiers: [],
      };
    }

    const account = await this.getOrCreateAccount(tx, userId);

    const balanceBefore = account.balance;
    const balanceAfter = balanceBefore + points;

    // تحديث الرصيد
    await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        balance: balanceAfter,
        totalEarned: { increment: points },
      },
    });

    // Ledger
    await tx.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        type: "EARN",
        points,
        balanceBefore,
        balanceAfter,
        reason: `نقاط من الطلب #${orderId}`,
        orderId,
      },
    });

    // ═══ فحص المستويات الجديدة ═══
    const tiers = await tx.loyaltyTier.findMany({
      where: {
        isActive: true,
        requiredPoints: { lte: balanceAfter },
      },
      orderBy: { requiredPoints: "asc" },
    });

    const unlocked: AwardResult["unlockedTiers"] = [];

    for (const tier of tiers) {
      const alreadyUnlocked = await tx.loyaltyTierUnlock.findUnique({
        where: {
          accountId_tierId: { accountId: account.id, tierId: tier.id },
        },
      });

      if (!alreadyUnlocked) {
        await tx.loyaltyTierUnlock.create({
          data: { accountId: account.id, tierId: tier.id },
        });

        const reward = await tx.loyaltyReward.create({
          data: {
            accountId: account.id,
            tierId: tier.id,
            status: "PENDING",
          },
        });

        unlocked.push({
          tierId: tier.id,
          name: tier.name,
          icon: tier.icon,
          rewardId: reward.id,
        });
      }
    }

    return {
      pointsAwarded: points,
      balanceBefore,
      balanceAfter,
      unlockedTiers: unlocked,
    };
  },

  // ═══════ سحب النقاط عند الإرجاع ═══════
  async revokeForReturn(
    tx: any,
    params: {
      userId: number;
      orderId: number;
      refundedAmount: number;
    }
  ): Promise<{ pointsRevoked: number; balanceAfter: number }> {
    const { userId, orderId, refundedAmount } = params;

    const points = calculatePoints(refundedAmount);
    if (points <= 0) {
      return { pointsRevoked: 0, balanceAfter: 0 };
    }

    const account = await tx.loyaltyAccount.findUnique({
      where: { userId },
    });
    if (!account) {
      return { pointsRevoked: 0, balanceAfter: 0 };
    }

    const balanceBefore = account.balance;
    // لا نسمح للرصيد أن يصبح سالباً
    const actualRevoke = Math.min(points, balanceBefore);
    const balanceAfter = balanceBefore - actualRevoke;

    if (actualRevoke > 0) {
      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          balance: balanceAfter,
          totalRevoked: { increment: actualRevoke },
        },
      });

      await tx.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          type: "REVOKE",
          points: -actualRevoke,
          balanceBefore,
          balanceAfter,
          reason: `سحب نقاط بسبب إرجاع في الطلب #${orderId}`,
          orderId,
        },
      });
    }

    return { pointsRevoked: actualRevoke, balanceAfter };
  },

  // ═══════ جلب معلومات الحساب الكاملة ═══════
  async getFullInfo(userId: number) {
    const account = await prisma.loyaltyAccount.findUnique({
      where: { userId },
      include: {
        unlocks: { include: { tier: true }, orderBy: { unlockedAt: "desc" } },
        rewards: {
          include: { tier: true, category: true, giftProduct: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const settings = await prisma.loyaltySettings.findUnique({
      where: { id: 1 },
    });

    const allTiers = await prisma.loyaltyTier.findMany({
      where: { isActive: true },
      orderBy: { requiredPoints: "asc" },
    });

    const categories = await prisma.loyaltyRewardCategory.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    });

    if (!account) {
      return {
        balance: 0,
        totalEarned: 0,
        totalRevoked: 0,
        settings,
        tiers: allTiers.map((t) => ({
          ...t,
          unlocked: false,
          unlockedAt: null,
        })),
        categories,
        transactions: [],
        rewards: [],
      };
    }

    const transactions = await prisma.loyaltyTransaction.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unlockMap = new Map(
      account.unlocks.map((u) => [u.tierId, u.unlockedAt])
    );

    return {
      balance: account.balance,
      totalEarned: account.totalEarned,
      totalRevoked: account.totalRevoked,
      settings,
      tiers: allTiers.map((t) => ({
        ...t,
        unlocked: unlockMap.has(t.id),
        unlockedAt: unlockMap.get(t.id) || null,
      })),
      categories,
      transactions,
      rewards: account.rewards,
    };
  },
};