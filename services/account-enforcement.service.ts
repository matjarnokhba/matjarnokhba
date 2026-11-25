const WINDOW_DAYS = 90;
const DEFAULT_LIMIT = 3;
const DAY = 24 * 60 * 60 * 1000;

export const AccountEnforcementService = {
  // تاجر تكرر عليه نفس نوع الخطأ خلال 90 يوماً: تنبيه للأدمن فقط (لا إيقاف تلقائي).
  // الأدمن يتحقق من التفاصيل ثم يقرر الإيقاف أو السماح من صفحة التجار.
  async checkSellerStrikes(tx: any, sellerId: number | null, reasonType: string) {
    if (!sellerId) return { alerted: false as const };
    const pol = await tx.systemPolicy.findUnique({ where: { key: "SELLER_STRIKE_LIMIT" } });
    const limit = typeof pol?.value === "number" ? pol.value : DEFAULT_LIMIT;
    if (limit <= 0) return { alerted: false as const, limit };

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
    if (count < limit) return { alerted: false as const, count, limit };

    const seller = await tx.seller.findUnique({
      where: { id: sellerId },
      select: { storeName: true },
    });
    if (!seller) return { alerted: false as const, count, limit };

    const title = "⚠️ تاجر تكرر عليه نفس الخطأ";
    // لا تكرار للتنبيه لنفس التاجر ونفس النوع ونفس العدد
    const already = await tx.notification.findFirst({
      where: {
        title,
        createdAt: { gte: since },
        AND: [
          { metadata: { path: ["sellerId"], equals: sellerId } },
          { metadata: { path: ["reasonType"], equals: reasonType } },
          { metadata: { path: ["count"], equals: count } },
        ],
      },
      select: { id: true },
    });
    if (already) return { alerted: false as const, count, limit };

    const admins: { id: number }[] = await tx.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, deletedAt: null },
      select: { id: true },
    });
    for (const a of admins) {
      await tx.notification.create({
        data: {
          userId: a.id,
          type: "RETURN_REQUESTED",
          title,
          message: `التاجر «${seller.storeName}» تكرر عليه ${count} مرات خطأ من نوع ${reasonType} خلال ${WINDOW_DAYS} يوماً. راجع الحالات ثم قرر: إيقاف أو سماح من صفحة التجار.`,
          link: "/admin/sellers",
          category: "ORDER",
          severity: "WARNING",
          metadata: { sellerId, reasonType, count },
        },
      });
    }
    return { alerted: true as const, count, limit };
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