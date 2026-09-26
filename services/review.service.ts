import { prisma } from "@/lib/prisma";

type CreateReviewInput = {
  orderItemId: number;
  rating: number;
  comment?: string;
};

export const ReviewService = {
  // ═══════ إنشاء مراجعة ═══════
  async create(userId: number, data: CreateReviewInput) {
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: data.orderItemId },
      include: {
        order: { select: { userId: true, status: true } },
      },
    });

    if (!orderItem) throw new Error("المنتج غير موجود");
    if (orderItem.order.userId !== userId) throw new Error("غير مصرح");
    if (orderItem.order.status !== "DELIVERED") {
      throw new Error("يمكن التقييم فقط بعد استلام الطلب");
    }
    if (data.rating < 1 || data.rating > 5) {
      throw new Error("التقييم يجب أن يكون من 1 إلى 5");
    }

    const existing = await prisma.review.findUnique({
      where: {
        productId_userId: {
          productId: orderItem.productId,
          userId,
        },
      },
    });

    if (existing) throw new Error("لقد قمت بتقييم هذا المنتج مسبقاً");

    return prisma.review.create({
      data: {
        productId: orderItem.productId,
        userId,
        orderId: orderItem.orderId,
        orderItemId: orderItem.id,
        rating: data.rating,
        comment: data.comment?.trim() || null,
        isApproved: false,
      },
    });
  },

  // ═══════ مراجعات منتج (للعرض العام) ═══════
  async getByProduct(productId: number) {
    return prisma.review.findMany({
      where: { productId, isApproved: true, deletedAt: null },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  },

  // ═══════ مراجعات طلب ═══════
  async getByOrder(orderId: number, userId: number) {
    return prisma.review.findMany({
      where: { orderId, userId, deletedAt: null },
      select: {
        id: true,
        orderItemId: true,
        productId: true,
        rating: true,
        comment: true,
        isApproved: true,
      },
    });
  },

  // ═══════ كل المراجعات (Admin) ═══════
  async getAllForAdmin(filter: "PENDING" | "APPROVED" | "ALL" = "PENDING") {
    const where: any = { deletedAt: null };
    if (filter === "PENDING") where.isApproved = false;
    if (filter === "APPROVED") where.isApproved = true;

    return prisma.review.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  // ═══════ إحصائيات ═══════
  async getStats() {
    const [pending, approved, total] = await Promise.all([
      prisma.review.count({ where: { isApproved: false, deletedAt: null } }),
      prisma.review.count({ where: { isApproved: true, deletedAt: null } }),
      prisma.review.count({ where: { deletedAt: null } }),
    ]);

    return { pending, approved, total };
  },

  // ═══════ الموافقة ═══════
  async approve(reviewId: number) {
    return prisma.$transaction(async (tx) => {
      const review = await tx.review.update({
        where: { id: reviewId },
        data: { isApproved: true },
      });

      console.log(`[approve] Review ${reviewId} approved, productId = ${review.productId}`);

      await recalcProductStats(tx, review.productId);

      return review;
    });
  },

  // ═══════ الرفض (Soft Delete) ═══════
  async reject(reviewId: number) {
    return prisma.$transaction(async (tx) => {
      const review = await tx.review.update({
        where: { id: reviewId },
        data: { deletedAt: new Date(), isApproved: false },
      });

      console.log(`[reject] Review ${reviewId} rejected, productId = ${review.productId}`);

      await recalcProductStats(tx, review.productId);

      return review;
    });
  },
};

// ═══════ Helper: إعادة حساب تقييم المنتج ═══════
async function recalcProductStats(tx: any, productId: number) {
  console.log(`[recalcProductStats] بدء للمنتج ${productId}`);

  const reviews = await tx.review.findMany({
    where: {
      productId,
      isApproved: true,
      deletedAt: null,
    },
    select: { rating: true },
  });

  const count = reviews.length;
  const avg =
    count > 0
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / count
      : 0;

  console.log(`[recalcProductStats] المنتج ${productId}: ${count} مراجعة، متوسط = ${avg}`);

  const updated = await tx.product.update({
    where: { id: productId },
    data: {
      rating: avg,
      reviewsCount: count,
    },
  });

  console.log(`[recalcProductStats] ✅ تم التحديث:`, {
    id: updated.id,
    rating: updated.rating,
    reviewsCount: updated.reviewsCount,
  });
}