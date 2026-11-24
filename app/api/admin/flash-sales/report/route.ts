import { prisma } from "@/lib/prisma";
import { requireAdmin, ok, handleError } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  title: string;
  startsAt: Date;
  endsAt: Date;
  qty: number;
  discount: unknown;
  subsidy: unknown;
  settled: unknown;
};

// تقرير تكلفة العروض لكل حملة (يستثني البنود الملغاة/المعكوسة)
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT s."id", s."title", s."startsAt", s."endsAt",
        COALESCE(SUM(l."quantity"), 0)::int AS "qty",
        COALESCE(SUM((l."listUnitPrice" - l."dealUnitPrice") * l."quantity"), 0) AS "discount",
        COALESCE(SUM(l."platformSubsidy"), 0) AS "subsidy",
        COALESCE(SUM(CASE WHEN l."settledAt" IS NOT NULL THEN l."platformSubsidy" ELSE 0 END), 0) AS "settled"
      FROM "FlashSale" s
      LEFT JOIN "FlashSaleItem" i ON i."saleId" = s."id"
      LEFT JOIN "FlashSaleOrderLine" l ON l."flashSaleItemId" = i."id" AND l."reversedAt" IS NULL
      GROUP BY s."id"
      ORDER BY s."startsAt" DESC
      LIMIT 50`;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const sales = rows.map((r) => {
      const discount = r2(Number(r.discount));
      const subsidy = r2(Number(r.subsidy));
      const settled = r2(Number(r.settled));
      return {
        id: r.id,
        title: r.title,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        qty: Number(r.qty),
        discount,
        platformSubsidy: subsidy,
        sellerBorne: r2(discount - subsidy),
        settledSubsidy: settled,
        pendingSubsidy: r2(subsidy - settled),
      };
    });
    const total = sales.reduce(
      (s, x) => ({
        qty: s.qty + x.qty,
        discount: r2(s.discount + x.discount),
        platformSubsidy: r2(s.platformSubsidy + x.platformSubsidy),
        sellerBorne: r2(s.sellerBorne + x.sellerBorne),
        settledSubsidy: r2(s.settledSubsidy + x.settledSubsidy),
        pendingSubsidy: r2(s.pendingSubsidy + x.pendingSubsidy),
      }),
      { qty: 0, discount: 0, platformSubsidy: 0, sellerBorne: 0, settledSubsidy: 0, pendingSubsidy: 0 }
    );
    return ok({ sales, total });
  } catch (err) {
    return handleError(err, "admin-flash-report");
  }
}