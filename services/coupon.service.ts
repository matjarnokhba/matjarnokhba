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

export const CouponService = {
  // ═══════ التحقق من كود كوبون ═══════
  async validate(
    code: string,
    userId: number,
    subtotal: number
  ): Promise<ValidateResult> {
    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode) {
      return { valid: false, message: "أدخل كود الكوبون" };
    }

    const coupon = await prisma.coupon.findFirst({
      where: {
        code: cleanCode,
        deletedAt: null,
      },
    });

    if (!coupon) {
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

    // عدد استخدامات المستخدم
    const userUsageCount = await prisma.couponUsage.count({
      where: { couponId: coupon.id, userId },
    });

    if (userUsageCount >= coupon.maxUsesPerUser) {
      return { valid: false, message: "لقد استخدمت هذا الكوبون من قبل" };
    }

    // حساب الخصم
    const couponValue = Number(coupon.value);
    let discount = 0;

    if (coupon.type === "PERCENTAGE") {
      discount = (subtotal * couponValue) / 100;
    } else {
      discount = couponValue;
    }

    // الخصم لا يتجاوز subtotal
    if (discount > subtotal) discount = subtotal;

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: couponValue,
      },
      discount: Math.round(discount * 100) / 100,
    };
  },

  // ═══════ تطبيق كوبون (داخل Transaction) ═══════
  async applyInTransaction(
    tx: any,
    couponId: number,
    userId: number,
    orderId: number,
    discount: number
  ) {
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