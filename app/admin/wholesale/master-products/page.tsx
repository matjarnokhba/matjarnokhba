import { prisma } from "@/lib/prisma";
import { MasterProductsAdminList } from "@/components/admin/wholesale/MasterProductsAdminList";

const PAGE_SIZE = 30;

export default async function AdminMasterProductsPage({
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
      { name: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q } },
      { brand: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows, counts] = await Promise.all([
    prisma.masterProduct.count({ where }),
    prisma.masterProduct.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        category: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            variants: true,
            merchantProducts: { where: { deletedAt: null } },
          },
        },
      },
    }),
    prisma.masterProduct.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const c of counts) {
    statusCounts[c.status] = c._count._all;
  }

  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    barcode: r.barcode,
    images: r.images as string[],
    status: r.status,
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    category: r.category,
    createdByUser: r.createdByUser,
    variantCount: r._count.variants,
    merchantProductCount: r._count.merchantProducts,
  }));

  return (
    <MasterProductsAdminList
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