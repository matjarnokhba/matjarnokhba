import { prisma } from "@/lib/prisma";

export const NotificationService = {
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