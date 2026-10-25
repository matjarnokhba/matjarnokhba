import { prisma } from "@/lib/prisma";

const WARNING_DAYS = 15;

export const LegalNoticeService = {
  // ═══════ فحص السائق وإنشاء/تحديث الإنذار ═══════
  async syncForDriver(tx: any, driverId: number) {
    const wallet = await tx.wallet.findUnique({
      where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: driverId } },
    });
    if (!wallet) return;

    const cashInHand = Number(wallet.cashInHand);

    const pendingRefused = await tx.shipmentItem.count({
      where: {
        shipment: { deliveryPersonId: driverId },
        refusedQuantity: { gt: 0 },
        returnedToWarehouseAt: null,
      },
    });

    const hasIssue = cashInHand > 0 || pendingRefused > 0;

    // ═══ لا توجد مشاكل → إغلاق أي إنذار نشط ═══
    if (!hasIssue) {
      const active = await tx.driverLegalNotice.findFirst({
        where: { driverId, status: { in: ["WARNING", "ESCALATED"] } },
      });

      if (active) {
        await tx.driverLegalNotice.update({
          where: { id: active.id },
          data: { status: "RESOLVED", resolvedAt: new Date() },
        });

        const driver = await tx.deliveryPerson.findUnique({
          where: { id: driverId },
          select: { userId: true },
        });

        if (driver) {
          await tx.notification.create({
            data: {
              userId: driver.userId,
              type: "ORDER_STATUS_CHANGED",
              title: "✅ تم إغلاق الإنذار القانوني",
              message: `تمت تسوية مستحقاتك بنجاح. شكراً لتعاونك.`,
              link: "/delivery",
              category: "ORDER",
              severity: "INFO",
            },
          });
        }
      }
      return;
    }

    // ═══ يوجد إنذار نشط؟ تحديث المبلغ فقط ═══
    const active = await tx.driverLegalNotice.findFirst({
      where: { driverId, status: { in: ["WARNING", "ESCALATED"] } },
    });

    let reason = "";
    if (cashInHand > 0) reason += `كاش ${cashInHand.toFixed(2)} د.م في الحوزة. `;
    if (pendingRefused > 0) reason += `${pendingRefused} منتج مرفوض. `;

    if (active) {
      await tx.driverLegalNotice.update({
        where: { id: active.id },
        data: { amountOwed: cashInHand, reason: reason.trim() },
      });
      return;
    }

    // ═══ إنشاء إنذار جديد ═══
    const deadlineAt = new Date();
    deadlineAt.setDate(deadlineAt.getDate() + WARNING_DAYS);

    const notice = await tx.driverLegalNotice.create({
      data: {
        driverId,
        amountOwed: cashInHand,
        reason: reason.trim(),
        status: "WARNING",
        deadlineAt,
      },
    });

    // إشعار فوري للسائق + الأدمن
    const driver = await tx.deliveryPerson.findUnique({
      where: { id: driverId },
      select: { userId: true, user: { select: { name: true } } },
    });

    if (driver) {
      await tx.notification.create({
        data: {
          userId: driver.userId,
          type: "ORDER_STATUS_CHANGED",
          title: "⚠️ إنذار قانوني - 15 يوم",
          message: `لديك مستحقات غير مسددة (${reason.trim()}). يجب تسويتها خلال 15 يوماً، وإلا سنضطر لاتخاذ إجراءات قانونية.`,
          link: "/delivery/wallet",
          category: "ORDER",
          severity: "WARNING",
        },
      });
    }

    const admins = await tx.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, deletedAt: null },
      select: { id: true },
    });

    for (const admin of admins) {
      await tx.notification.create({
        data: {
          userId: admin.id,
          type: "ORDER_STATUS_CHANGED",
          title: "🚨 إنذار قانوني جديد",
          message: `السائق ${driver?.user.name || driverId}: ${reason.trim()} - مهلة 15 يوم.`,
          link: `/admin/legal-notices/${notice.id}`,
          category: "ORDER",
          severity: "WARNING",
        },
      });
    }

    return notice;
  },

  // ═══════ رفع الإنذارات المنتهية (Cron) ═══════
  async escalateExpired() {
    const now = new Date();
    const expired = await prisma.driverLegalNotice.findMany({
      where: {
        status: "WARNING",
        deadlineAt: { lt: now },
      },
      include: {
        driver: { select: { userId: true, user: { select: { name: true } } } },
      },
    });

    let escalated = 0;

    for (const notice of expired) {
      await prisma.driverLegalNotice.update({
        where: { id: notice.id },
        data: { status: "ESCALATED", escalatedAt: now },
      });

      await prisma.notification.create({
        data: {
          userId: notice.driver.userId,
          type: "ORDER_STATUS_CHANGED",
          title: "🚨 انتهت المهلة - إجراء قانوني",
          message: `انتهت مهلة 15 يوماً. سيتم اتخاذ إجراءات قانونية. يرجى التواصل فوراً.`,
          link: "/delivery/wallet",
          category: "ORDER",
          severity: "WARNING",
        },
      });

      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, deletedAt: null },
        select: { id: true },
      });

      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            type: "ORDER_STATUS_CHANGED",
            title: "🚨 سائق متأخر - جاهز للقانوني",
            message: `السائق ${notice.driver.user.name}: انتهت مهلته. المبلغ: ${notice.amountOwed} د.م.`,
            link: `/admin/legal-notices/${notice.id}`,
            category: "ORDER",
            severity: "WARNING",
          },
        });
      }

      escalated++;
    }

    return { escalated, total: expired.length };
  },

  // ═══════ جلب كل الإنذارات (للأدمن) ═══════
  async getAll(filter?: "WARNING" | "ESCALATED" | "RESOLVED" | "ALL") {
    const where: any = {};
    if (filter && filter !== "ALL") where.status = filter;

    return prisma.driverLegalNotice.findMany({
      where,
      include: {
        driver: {
          select: {
            id: true,
            city: true,
            user: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: [{ status: "asc" }, { deadlineAt: "asc" }],
      take: 200,
    });
  },

  // ═══════ جلب تفاصيل إنذار واحد ═══════
  async getById(noticeId: number) {
    return prisma.driverLegalNotice.findUnique({
      where: { id: noticeId },
      include: {
        driver: {
          select: {
            id: true,
            city: true,
            user: { select: { name: true, phone: true } },
          },
        },
      },
    });
  },

  // ═══════ إغلاق إنذار يدوياً ═══════
  async resolveManually(noticeId: number, note: string) {
    const notice = await prisma.driverLegalNotice.findUnique({
      where: { id: noticeId },
      include: { driver: { select: { userId: true } } },
    });

    if (!notice) throw new Error("الإنذار غير موجود");
    if (notice.status === "RESOLVED") throw new Error("الإنذار مغلق مسبقاً");

    await prisma.$transaction(async (tx) => {
      await tx.driverLegalNotice.update({
        where: { id: noticeId },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          reason: notice.reason
            ? `${notice.reason} | ملاحظة الأدمن: ${note}`
            : note,
        },
      });

      await tx.notification.create({
        data: {
          userId: notice.driver.userId,
          type: "ORDER_STATUS_CHANGED",
          title: "✅ تم إغلاق إنذارك",
          message: `تم إغلاق الإنذار القانوني بواسطة الإدارة. ${note}`,
          link: "/delivery",
          category: "ORDER",
          severity: "INFO",
        },
      });
    });
  },
};