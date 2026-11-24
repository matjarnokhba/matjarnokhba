import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, parseJson, ok, fail, handleError } from "@/lib/api/handler";
import { NotificationService } from "@/services/notification.service";

const rowSchema = z.object({
  productId: z.number().int().positive(),
  dealPrice: z.number().positive().nullable().optional(),
  quantityLimit: z.number().int().min(1).nullable().optional(),
  sellerSharePct: z.number().min(0).max(100).optional(),
});
const bodySchema = z.object({ items: z.array(rowSchema).max(24) });

const r2 = (n: number) => Math.round(n * 100) / 100;

type Status = "APPROVED" | "PENDING_SELLER" | "REJECTED" | "PENDING_ADMIN" | "WITHDRAWN";

// يستبدل منتجات الحملة بالقائمة المرسلة (بنفس الترتيب) مع سعر العرض والكمية ونسبة التاجر
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const { id: raw } = await params;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, bodySchema);
    if (!parsed.ok) return parsed.response;
    const rows = parsed.data.items;
    const ids = rows.map((r) => r.productId);
    if (new Set(ids).size !== ids.length) return fail("منتج مكرر في القائمة", 400);

    const sale = await prisma.flashSale.findUnique({
      where: { id },
      select: { id: true, title: true, startsAt: true, endsAt: true },
    });
    if (!sale) return fail("الحملة غير موجودة", 404);

    const products = ids.length
      ? await prisma.product.findMany({
          where: { id: { in: ids }, deletedAt: null },
          select: { id: true, name: true, sellerId: true },
        })
      : [];
    if (products.length !== ids.length) return fail("بعض المنتجات غير موجودة", 400);
    const prodMap = new Map(products.map((p) => [p.id, p]));

    // سعر العرض يجب أن يكون أقل من سعر المنتج الحالي
    const priced = rows.filter((r) => r.dealPrice != null);
    const base = new Map<number, number>();
    if (priced.length > 0) {
      const defaults = await prisma.productVariant.findMany({
        where: { productId: { in: priced.map((r) => r.productId) }, isDefault: true },
        select: { productId: true, price: true },
      });
      for (const v of defaults) base.set(v.productId, Number(v.price));
      for (const r of priced) {
        const b = base.get(r.productId);
        if (!b) return fail(`المنتج #${r.productId} بلا سعر افتراضي`, 400);
        if ((r.dealPrice as number) >= b) {
          return fail(`سعر العرض للمنتج #${r.productId} يجب أن يكون أقل من سعره الحالي (${b})`, 400);
        }
      }
    }

    const existing = await prisma.flashSaleItem.findMany({
      where: { saleId: id },
      select: {
        id: true,
        productId: true,
        dealPrice: true,
        quantityLimit: true,
        sellerSharePct: true,
        status: true,
        source: true,
        _count: { select: { orderLines: true } },
      },
    });
    const exMap = new Map(existing.map((e) => [e.productId, e]));
    const blocked = existing.find((e) => !ids.includes(e.productId) && e._count.orderLines > 0);
    if (blocked) return fail("لا يمكن حذف منتج له مبيعات داخل هذا العرض", 400);

    type Plan = {
      order: number;
      productId: number;
      dealPrice: number | null;
      quantityLimit: number | null;
      pct: number;
      status: Status;
      changed: boolean;
      exId: number | null;
      sellerLocked: boolean;
      notify: boolean;
    };
    const plans: Plan[] = rows.map((r, i) => {
      const ex = exMap.get(r.productId);
      const dealPrice = r.dealPrice ?? null;
      const quantityLimit = r.quantityLimit ?? null;
      const pct = dealPrice != null ? r2(r.sellerSharePct ?? 0) : 0;
      if (ex && ex.source === "SELLER") {
        return { order: i, productId: r.productId, dealPrice, quantityLimit, pct, status: ex.status as Status, changed: false, exId: ex.id, sellerLocked: true, notify: false };
      }
      let changed = !ex;
      if (ex) {
        const oldPrice = ex.dealPrice == null ? null : Number(ex.dealPrice);
        const oldPct = Number(ex.sellerSharePct);
        const oldLimit = ex.quantityLimit;
        const qtyUp =
          (quantityLimit === null && oldLimit !== null) ||
          (quantityLimit !== null && oldLimit !== null && quantityLimit > oldLimit);
        changed = oldPrice !== dealPrice || oldPct !== pct || qtyUp;
      }
      let status: Status;
      let notify = false;
      if (pct === 0) {
        status = "APPROVED";
      } else if (changed) {
        status = "PENDING_SELLER";
        notify = true;
      } else {
        status = (ex!.status as Status);
      }
      return { order: i, productId: r.productId, dealPrice, quantityLimit, pct, status, changed, exId: ex?.id ?? null, sellerLocked: false, notify };
    });

    await prisma.$transaction(async (tx) => {
      await tx.flashSaleItem.deleteMany({ where: { saleId: id, productId: { notIn: ids } } });
      for (const p of plans) {
        if (p.sellerLocked) {
          await tx.flashSaleItem.update({ where: { id: p.exId! }, data: { order: p.order } });
          continue;
        }
        const common = {
          order: p.order,
          dealPrice: p.dealPrice,
          quantityLimit: p.quantityLimit,
          sellerSharePct: p.pct,
          status: p.status,
        };
        if (p.exId == null) {
          await tx.flashSaleItem.create({ data: { saleId: id, productId: p.productId, ...common } });
        } else {
          await tx.flashSaleItem.update({
            where: { id: p.exId },
            data: {
              ...common,
              ...(p.changed
                ? { respondedAt: null, respondedById: null, responseNote: null, version: { increment: 1 } }
                : {}),
            },
          });
        }
      }
    });

    // إشعار التجار بطلبات الموافقة (خارج المعاملة، لا يفشل الحفظ بسببه)
    const toNotify = plans.filter((p) => p.notify && p.dealPrice != null);
    let requested = 0;
    if (toNotify.length > 0) {
      try {
        const sellerIds = Array.from(
          new Set(toNotify.map((p) => prodMap.get(p.productId)?.sellerId).filter((x): x is number => !!x))
        );
        const sellers = await prisma.seller.findMany({
          where: { id: { in: sellerIds } },
          select: { id: true, userId: true },
        });
        const userBySeller = new Map(sellers.map((s) => [s.id, s.userId]));
        const when = sale.startsAt.toISOString().slice(0, 16).replace("T", " ");
        for (const p of toNotify) {
          const prod = prodMap.get(p.productId);
          const userId = prod ? userBySeller.get(prod.sellerId) : undefined;
          const b = base.get(p.productId);
          if (!prod || !userId || !b) continue;
          const perUnit = r2(((b - (p.dealPrice as number)) * p.pct) / 100);
          await NotificationService.create({
            userId,
            type: "FLASH_OFFER_REQUESTED",
            title: "طلب مشاركة في عرض محدود",
            message: `تقترح الإدارة عرض «${prod.name}» بسعر ${p.dealPrice} د.م بدل ${b} د.م ضمن «${sale.title}» (يبدأ ${when}). تتحمل ${p.pct}% من الخصم، أي ${perUnit} د.م عن كل قطعة تُباع. لن يظهر العرض إلا بموافقتك.`,
            link: "/seller/flash-offers",
            category: "FLASH",
            severity: "INFO",
            metadata: { saleId: id, productId: p.productId },
          });
          requested++;
        }
      } catch (e) {
        console.error("flash offer notifications failed", e);
      }
    }
    return ok({ requested });
  } catch (err) {
    return handleError(err, "admin-flash-items");
  }
}