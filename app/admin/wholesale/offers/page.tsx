import { prisma } from "@/lib/prisma";
import { OffersAdminList } from "@/components/admin/wholesale/OffersAdminList";

const PAGE_SIZE = 30;

export default async function AdminOffersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status || "PENDING_REVIEW";
  const search = params.search || "";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  const where: any = { deletedAt: null };
  if (status && status !== "ALL") where.status = status;
  if (search.trim().length >= 2) {
    const q = search.trim();
    where.OR = [
      { master: { name: { contains: q, mode: "insensitive" } } },
      { businessUnit: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, rows, counts] = await Promise.all([
    prisma.wholesaleOffer.count({ where }),
    prisma.wholesaleOffer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        master: {
          select: {
            id: true,
            name: true,
            brand: true,
            images: true,
            barcode: true,
          },
        },
        businessUnit: {
          select: {
            id: true,
            name: true,
            type: true,
            verificationStatus: true,
          },
        },
        variants: {
          include: {
            tiers: { orderBy: { minQty: "asc" } },
          },
        },
        _count: { select: { variants: true } },
      },
    }),
    prisma.wholesaleOffer.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const c of counts) {
    statusCounts[c.status] = c._count._all;
  }

  const items = rows.map((r) => {
    // Compute price range
    const prices: number[] = [];
    for (const v of r.variants) {
      for (const t of v.tiers) {
        prices.push(Number(t.unitPrice));
      }
    }
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    return {
      id: r.id,
      masterId: r.master.id,
      masterName: r.master.name,
      masterBrand: r.master.brand,
      masterImage: (r.master.images as string[])[0] ?? null,
      masterBarcode: r.master.barcode,
      businessUnitId: r.businessUnit.id,
      businessUnitName: r.businessUnit.name,
      businessUnitType: r.businessUnit.type,
      businessUnitVerification: r.businessUnit.verificationStatus,
      wholesalePrice: Number(r.wholesalePrice),
      minPrice,
      maxPrice,
      minOrderQty: r.minOrderQty,
      status: r.status,
      claimType: r.claimType,
      claimVerified: r.claimVerified,
      reviewLevel: r.reviewLevel,
      variantCount: r._count.variants,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return (
    <OffersAdminList
      items={items}
      statusCounts={statusCounts}
      currentStatus={status}
      currentSearch={search}
      pagination={{
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      }}
    />
  );
}