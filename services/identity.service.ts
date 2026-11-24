import { normalizeEmail, normalizePhone } from "@/lib/identity";

// هوية واحدة لكل إنسان: الهاتف أولاً ثم الإيميل
export const IdentityService = {
  async attachUser(tx: any, userId: number): Promise<number | null> {
    const u = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, phone: true, identityId: true },
    });
    if (!u) return null;
    if (u.identityId) return u.identityId;

    const phone = normalizePhone(u.phone);
    const email = normalizeEmail(u.email);
    const byPhone = phone ? await tx.customerIdentity.findUnique({ where: { phoneE164: phone } }) : null;
    const byEmail = email ? await tx.customerIdentity.findUnique({ where: { emailNorm: email } }) : null;

    // الهاتف والإيميل ينتميان لهويتين مختلفتين: علّمهما للمراجعة اليدوية
    if (byPhone && byEmail && byPhone.id !== byEmail.id) {
      await tx.customerIdentity.updateMany({
        where: { id: { in: [byPhone.id, byEmail.id] }, flaggedAt: null },
        data: { flaggedAt: new Date(), flagReason: "الهاتف والإيميل ينتميان لهويتين مختلفتين" },
      });
    }

    let identity = byPhone ?? byEmail;
    if (!identity) {
      identity = await tx.customerIdentity.create({ data: { phoneE164: phone, emailNorm: email } });
    } else {
      const data: { phoneE164?: string; emailNorm?: string } = {};
      if (phone && !identity.phoneE164 && !byPhone) data.phoneE164 = phone;
      if (email && !identity.emailNorm && !byEmail) data.emailNorm = email;
      if (Object.keys(data).length > 0) {
        identity = await tx.customerIdentity.update({ where: { id: identity.id }, data });
      }
    }

    await tx.user.update({ where: { id: userId }, data: { identityId: identity.id } });
    return identity.id as number;
  },
};