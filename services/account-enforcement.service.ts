const WINDOW_DAYS = 90;
const DEFAULT_LIMIT = 3;
const DAY = 24 * 60 * 60 * 1000;

export const AccountEnforcementService = {
  // تاجر تكرر عليه نفس نوع الخطأ (إرجاع محتسب عليه) خلال 90 يوماً: يُوقف
  async checkSellerStrikes(tx: any, sellerId: number | null, reasonType: string) {
    if (!sellerId) return { suspended: false as const };
    const pol = await tx.systemPolicy.findUnique({ where: { key: "SELLER_STRIKE_LIMIT" } });
    const limit = typeof pol?.value === "number" ? pol.value : DEFAULT_LIMIT;
    if (limit <= 0) return { suspended: false as const, limit };

    const since = new Date(Date.now() - WINDOW_DAYS * DAY);
    const count: number = await tx.returnRequest.count({
      where: {
        status: "COMPLETED",
        shippingPayer: "SELLER",
        reasonType,
        order: { sellerId },
        processedAt: { gte: since },
      },
    });
    if (count < limit) return { suspended: false as const, count, limit };

    const seller = await tx.seller.findUnique({
      where: { id: sellerId },
      select: { status: true, userId: true, storeName: true },
    });
    if (!seller || seller.status !== "ACTIVE") return { suspended: false as const, count, limit };

    await tx.seller.update({ where: { id: sellerId }, data: { status: "SUSPENDED" } });

    await tx.notification.create({
      data: {
        userId: seller.userId,
        type: "RETURN_COMPLETED",
        title: "تم إيقاف متجرك مؤقتاً",
        message: `تكرر ${count} مرات نفس الخطأ في المرتجعات خلال ${WINDOW_DAYS} يوماً، فأُوقف متجرك مؤقتاً. تواصل مع الإدارة.`,
        link: "/seller",
        category: "ORDER",
        severity: "WARNING",
        metadata: { sellerId, reasonType, count },
      },
    });
    const admins: { id: number }[] = await tx.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, deletedAt: null },
      select: { id: true },
    });
    for (const a of admins) {
      await tx.notification.create({
        data: {
          userId: a.id,
          type: "RETURN_REQUESTED",
          title: "🚫 إيقاف تاجر تلقائياً",
          message: `أُوقف التاجر «${seller.storeName}» بعد ${count} أخطاء من نوع ${reasonType} خلال ${WINDOW_DAYS} يوماً. يمكنك رفع الإيقاف من صفحة التجار.`,
          link: "/admin/sellers",
          category: "ORDER",
          severity: "WARNING",
          metadata: { sellerId, reasonType, count },
        },
      });
    }
    return { suspended: true as const, count, limit };
  },

  // إيقاف حساب عميل وإنهاء كل جلساته وتعليم هويته
  async suspendCustomer(tx: any, input: { userId: number; reason: string }) {
    const user = await tx.user.update({
      where: { id: input.userId },
      data: { suspendedAt: new Date(), suspendReason: input.reason },
      select: { identityId: true },
    });
    await tx.session.updateMany({
      where: { userId: input.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (user?.identityId) {
      await tx.customerIdentity.updateMany({
        where: { id: user.identityId, flaggedAt: null },
        data: { flaggedAt: new Date(), flagReason: `تلاعب: ${input.reason}` },
      });
    }
    return { suspended: true as const };
  },
};