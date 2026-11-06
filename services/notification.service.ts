import { prisma } from "@/lib/prisma";

export type NotificationType = 
  | "RETURN_COMPLETED"
  | "ORDER_CREATED"
  | "ORDER_STATUS_CHANGED"
  | "PAYMENT_RECEIVED"
  | "SHIPPING_UPDATED"
  | "RETURN_REQUESTED"
  | "RETURN_APPROVED"
  | "RETURN_REJECTED"
  | "SELLER_ORDER_RECEIVED"
  | "SELLER_PAYOUT_READY"
  | "SELLER_PAYOUT_SENT"
  | "SELLER_PRODUCT_LOW_STOCK"
  | "SELLER_DOCUMENT_APPROVED"
  | "SELLER_DOCUMENT_REJECTED"
  | "SELLER_PERFORMANCE_WARNING"
  | "SELLER_SUSPENDED"
  | "SELLER_VERIFIED"
  | "SELLER_PRODUCT_EDITED"
  | "SELLER_PRODUCT_NEEDS_REVIEW"
  | "SELLER_NEW_REGISTRATION"
  | "REVIEW_SUBMITTED"
  | "WHOLESALE_MASTER_APPROVED"
  | "WHOLESALE_MASTER_REJECTED"
  | "WHOLESALE_OFFER_APPROVED"
  | "WHOLESALE_OFFER_REJECTED"
  | "WHOLESALE_BU_VERIFIED"
  | "WHOLESALE_BU_REJECTED"
  | "WHOLESALE_ORDER_RECEIVED"
  | "WHOLESALE_ORDER_CONFIRMED"
  | "WHOLESALE_ORDER_SHIPPED"
  | "WHOLESALE_ORDER_DELIVERED"
  | "WHOLESALE_ORDER_CANCELLED"
  | "WHOLESALE_RETURN_REQUESTED"
  | "WHOLESALE_RETURN_APPROVED"
  | "WHOLESALE_RETURN_REJECTED"
  | "WHOLESALE_RETURN_COMPLETED";

export const NotificationService = {
  // ═══ Create (works inside or outside transactions) ═══
  async create(
    data: {
      userId: number;
      type: NotificationType;
      title: string;
      message: string;
      link?: string | null;
      metadata?: any;
      category?: string;
      severity?: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
    },
    tx?: any
  ): Promise<void> {
    const db = tx ?? prisma;
    try {
      await db.notification.create({
        data: {
          userId: data.userId,
          type: data.type as any,
          title: data.title,
          message: data.message,
          link: data.link ?? null,
          metadata: data.metadata ?? null,
          category: data.category ?? "WHOLESALE",
          severity: data.severity ?? "INFO",
        },
      });
    } catch (err) {
      // Do not fail the parent transaction if notification fails
      console.error("NotificationService.create failed:", err);
    }
  },

  // كل إشعارات المستخدم
  async getByUser(userId: number, limit = 20) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  // عدد غير المقروءة
  async getUnreadCount(userId: number) {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  },

  // قراءة إشعار واحد
  async markAsRead(notificationId: number, userId: number) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  },

  // قراءة الكل
  async markAllAsRead(userId: number) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  },
};