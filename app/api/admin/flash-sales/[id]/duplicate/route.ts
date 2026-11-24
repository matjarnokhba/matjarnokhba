import { prisma } from "@/lib/prisma";
import { requireAdmin, ok, fail, handleError } from "@/lib/api/handler";
import { NotificationService } from "@/services/notification.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const { id: raw } = await params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) return fail("معرف غير صحيح", 400);

    const src = await prisma.flashSale.findUnique({ where: { id }, include: { items: true } });
    if (!src) return fail("الحملة غير موجودة", 404);

    // نسخ عروض الأدمن فقط. عروض التجّار تحتاج مبادرة جديدة منهم.
    const adminItems = src.items.filter((i) => i.source === "ADMIN");
    const isShared = (i: (typeof adminItems)[number]) => Number(i.sellerSharePct) > 0 && i.dealPrice != null;

    const copy = await prisma.flashSale.create({
      data: {
        title: `${src.title} (نسخة)`.slice(0, 80),
        subtitle: src.subtitle,
        startsAt: src.startsAt,
        endsAt: src.endsAt,
        isActive: false,
        showCountdown: src.showCountdown,
        showProgress: src.showProgress,
        items: {
          create: adminItems.map((i) => ({
            productId: i.productId,
            order: i.order,
            dealPrice: i.dealPrice,
            quantityLimit: i.quantityLimit,
            sellerSharePct: i.sellerSharePct,
            status: isShared(i) ? ("PENDING_SELLER" as const) : ("APPROVED" as const),
          })),
        },
      },
    });

    // الحملة الجديدة تحتاج موافقة جديدة من كل تاجر عليه نسبة
    const shared = adminItems.filter(isShared);
    if (shared.length > 0) {
      try {
        const prods = await prisma.product.findMany({
          where: { id: { in: shared.map((i) => i.productId) } },
          select: { id: true, name: true, sellerId: true },
        });
        const sellers = await prisma.seller.findMany({
          where: { id: { in: Array.from(new Set(prods.map((p) => p.sellerId))) } },
          select: { id: true, userId: true },
        });
        const userBySeller = new Map(sellers.map((s) => [s.id, s.userId]));
        const prodById = new Map(prods.map((p) => [p.id, p]));
        for (const i of shared) {
          const p = prodById.get(i.productId);
          const userId = p ? userBySeller.get(p.sellerId) : undefined;
          if (!p || !userId) continue;
          await NotificationService.create({
            userId,
            type: "FLASH_OFFER_REQUESTED",
            title: "طلب مشاركة في عرض محدود",
            message: `تقترح الإدارة عرض «${p.name}» بسعر ${Number(i.dealPrice)} د.م ضمن «${copy.title}». تتحمل ${Number(i.sellerSharePct)}% من الخصم. لن يظهر العرض إلا بموافقتك.`,
            link: "/seller/flash-offers",
            category: "FLASH",
            severity: "INFO",
            metadata: { saleId: copy.id, productId: i.productId },
          });
        }
      } catch (e) {
        console.error("flash duplicate notifications failed", e);
      }
    }
    return ok({ sale: copy }, 201);
  } catch (err) {
    return handleError(err, "admin-flash-duplicate");
  }
}