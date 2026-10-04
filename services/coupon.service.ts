import { prisma } from "@/lib/prisma";

type ValidateResult = {
  valid: boolean;
  message?: string;
  coupon?: {
    id: number;
    code: string;
    type: "PERCENTAGE" | "FIXED";
    value: number;
  };
  discount?: number;
};

// ═══ حساب الخصم من كوبون (دالة مشتركة) ═══
function calcDiscount(
  type: "PERCENTAGE" | "FIXED",
  value: number,
  subtotal: number
): number {
  let discount = type === "PERCENTAGE" ? (subtotal * value) / 100 : value;
  if (discount > subtotal) discount = subtotal;
  if (discount < 0) discount = 0;
  return Math.round(discount * 100) / 100;
}

export const CouponService = {
  // ═══════ تحقق للعرض المسبق (Client Preview — غير موثوق) ═══════
  async validate(
    code: string,
    userId: number,
    subtotal: number
  ): Promise<ValidateResult> {
    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode) {
      return { valid: false, message: "أدخل كود الكوبون" };
    }

    const coupon = await prisma.coupon.findUnique({
      where: { code: cleanCode },
    });

    if (!coupon || coupon.deletedAt) {
      return { valid: false, message: "كود غير صحيح" };
    }

    if (!coupon.isActive) {
      return { valid: false, message: "الكوبون غير مفعّل" };
    }

    const now = new Date();
    if (now < coupon.startDate) {
      return { valid: false, message: "الكوبون لم يبدأ بعد" };
    }
    if (now > coupon.endDate) {
      return { valid: false, message: "انتهت صلاحية الكوبون" };
    }

    if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
      return {
        valid: false,
        message: `الحد الأدنى للطلب ${coupon.minOrderAmount} د.م`,
      };
    }

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return { valid: false, message: "تم استهلاك الكوبون بالكامل" };
    }

    const userUsageCount = await prisma.couponUsage.count({
      where: { couponId: coupon.id, userId },
    });

    if (userUsageCount >= coupon.maxUsesPerUser) {
      return { valid: false, message: "لقد استخدمت هذا الكوبون من قبل" };
    }

    const couponValue = Number(coupon.value);
    const discount = calcDiscount(coupon.type, couponValue, subtotal);

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: couponValue,
      },
      discount,
    };
  },

  // ═══════ قفل + تحقق داخل Transaction (آمن ضد Race) ═══════
  async lockAndValidateInTransaction(
    tx: any,
    code: string,
    userId: number,
    subtotal: number
  ): Promise<{ couponId: number; discount: number }> {
    const cleanCode = code.trim().toUpperCase();

    // 1. قفل صف الكوبون
    const rows: any[] = await tx.$queryRaw`
      SELECT id
      FROM "Coupon"
      WHERE code = ${cleanCode} AND "deletedAt" IS NULL
      FOR UPDATE
    `;

    if (!rows[0]) {
      throw new Error("كود غير صحيح");
    }

    const coupon = await tx.coupon.findUnique({
      where: { id: rows[0].id },
    });

    if (!coupon) {
      throw new Error("كود غير صحيح");
    }

    // 2. إعادة التحقق الكامل داخل tx
    if (!coupon.isActive) {
      throw new Error("الكوبون غير مفعّل");
    }

    const now = new Date();
    if (now < coupon.startDate) {
      throw new Error("الكوبون لم يبدأ بعد");
    }
    if (now > coupon.endDate) {
      throw new Error("انتهت صلاحية الكوبون");
    }

    if (coupon.minOrderAmount && subtotal < Number(coupon.minOrderAmount)) {
      throw new Error(`الحد الأدنى للطلب ${coupon.minOrderAmount} د.م`);
    }

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new Error("تم استهلاك الكوبون بالكامل");
    }

    const userUsageCount = await tx.couponUsage.count({
      where: { couponId: coupon.id, userId },
    });

    if (userUsageCount >= coupon.maxUsesPerUser) {
      throw new Error("لقد استخدمت هذا الكوبون من قبل");
    }

    // 3. حساب الخصم
    const couponValue = Number(coupon.value);
    const discount = calcDiscount(coupon.type, couponValue, subtotal);

    return { couponId: coupon.id, discount };
  },

  // ═══════ تسجيل الاستخدام داخل Transaction ═══════
  async recordUsageInTransaction(
    tx: any,
    couponId: number,
    userId: number,
    orderId: number,
    discount: number
  ): Promise<void> {
    await tx.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });

    await tx.couponUsage.create({
      data: {
        couponId,
        userId,
        orderId,
        discount,
      },
    });
  },
};