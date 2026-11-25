import { ReturnService } from "@/services/return.service";
import { isSellerFault } from "@/lib/return-policy";

const AUTO_NOTE = "اعتُمد تلقائياً بعد تجاوز مهلة القرار (48 ساعة) — الخطأ محتسب على التاجر";
const ESCALATE_TITLE = "⏰ طلب إرجاع تجاوز مهلة القرار";

export const ReturnDeadlineService = {
  async processOverdue(db: any, now: Date = new Date()) {
    const polRow = await db.systemPolicy.findUnique({ where: { key: "RETURN_AUTO_APPROVE_ENABLED" } });
    const autoEnabled = polRow?.value !== false;

    const overdue = await db.returnRequest.findMany({
      where: { status: "PENDING", decisionDueAt: { lte: now } },
      select: {
        id: true,
        reasonType: true,
        evidenceUrls: true,
        order: { select: { orderNumber: true, seller: { select: { userId: true } } } },
      },
      orderBy: { decisionDueAt: "asc" },
      take: 100,
    });

    let approved = 0;
    let escalated = 0;
    let failed = 0;
    let admins: { id: number }[] | null = null;

    for (const r of overdue) {
      const canAuto = autoEnabled && isSellerFault(r.reasonType) && (r.evidenceUrls?.length ?? 0) > 0;

      if (canAuto) {
        try {
          await ReturnService.approve(r.id, 0);
          await db.returnRequest.updateMany({ where: { id: r.id }, data: { adminNote: AUTO_NOTE } });
          const sellerUserId = r.order?.seller?.userId;
          if (sellerUserId) {
            await db.notification.create({
              data: {
                userId: sellerUserId,
                type: "RETURN_APPROVED",
                title: "اعتماد إرجاع تلقائي على طلبك",
                message: `اعتُمد إرجاع الطلب #${r.order.orderNumber} بسبب عيب أو خطأ مع دليل العميل، وسيُخصم شحن المرتجع من رصيدك.`,
                link: "/seller/returns",
                category: "ORDER",
                severity: "WARNING",
                metadata: { returnId: r.id },
              },
            });
          }
          approved++;
        } catch (e) {
          failed++;
          console.error("auto-approve failed", r.id, e);
        }
        continue;
      }

      // لا اعتماد تلقائي: نبّه الأدمن مرة واحدة فقط
      try {
        const already = await db.notification.findFirst({
          where: { title: ESCALATE_TITLE, metadata: { path: ["returnId"], equals: r.id } },
          select: { id: true },
        });
        if (already) continue;
        if (!admins) {
          admins = await db.user.findMany({
            where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, deletedAt: null },
            select: { id: true },
          });
        }
        for (const a of admins ?? []) {
          await db.notification.create({
            data: {
              userId: a.id,
              type: "RETURN_REQUESTED",
              title: ESCALATE_TITLE,
              message: `طلب الإرجاع #${r.id} (الطلب ${r.order?.orderNumber ?? ""}) تجاوز مهلة 48 ساعة ويحتاج قراراً.`,
              link: `/admin/returns/${r.id}`,
              category: "ORDER",
              severity: "WARNING",
              metadata: { returnId: r.id },
            },
          });
        }
        escalated++;
      } catch (e) {
        failed++;
        console.error("escalate failed", r.id, e);
      }
    }
    return { overdue: overdue.length, approved, escalated, failed, autoEnabled };
  },
};