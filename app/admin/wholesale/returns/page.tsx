import { prisma } from "@/lib/prisma";
import { ReturnsAdminList } from "@/components/admin/wholesale/ReturnsAdminList";

const PAGE_SIZE = 30;

export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status || "ALL";
  const search = params.search || "";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  const where: any = {};
  if (status && status !== "ALL") where.status = status;
  if (search.trim().length >= 2) {
    const q = search.trim();
    where.returnNumber = { contains: q, mode: "insensitive" };
  }

  const [total, rows, counts] = await Promise.all([
    prisma.returnOrder.count({ where }),
    prisma.returnOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        originalOrder: { select: { orderNumber: true } },
        items: {
          select: {
            quantityRequested: true,
            quantityAccepted: true,
            originalOrderItem: {
              select: { productName: true },
            },
          },
        },
      },
    }),
    prisma.returnOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  let totalAll = 0;
  for (const c of counts) {
    statusCounts[c.status] = c._count._all;
    totalAll += c._count._all;
  }
  statusCounts.ALL = totalAll;

  // Enrich with BU names
  const allBUs = new Set<number>();
  rows.forEach((r) => {
    allBUs.add(r.buyerBusinessUnitId);
    allBUs.add(r.sellerBusinessUnitId);
  });
  const buLookup = await prisma.businessUnit.findMany({
    where: { id: { in: Array.from(allBUs) } },
    select: { id: true, name: true },
  });
  const buNameMap = new Map(buLookup.map((b) => [b.id, b.name]));

  const items = rows.map((r) => {
    const totalQtyRequested = r.items.reduce(
      (s, i) => s + i.quantityRequested,
      0
    );
    const totalQtyAccepted = r.items.reduce(
      (s, i) => s + i.quantityAccepted,
      0
    );
    return {
      id: r.id,
      returnNumber: r.returnNumber,
      originalOrderId: r.originalOrderId,
      originalOrderNumber: r.originalOrder.orderNumber,
      buyerBusinessUnitId: r.buyerBusinessUnitId,
      sellerBusinessUnitId: r.sellerBusinessUnitId,
      buyerName: buNameMap.get(r.buyerBusinessUnitId) ?? "—",
      sellerName: buNameMap.get(r.sellerBusinessUnitId) ?? "—",
      status: r.status,
      reason: r.reason,
      expectedRefundAmount: r.expectedRefundAmount
        ? Number(r.expectedRefundAmount)
        : null,
      approvedRefundAmount: r.approvedRefundAmount
        ? Number(r.approvedRefundAmount)
        : null,
      itemsCount: r.items.length,
      totalQtyRequested,
      totalQtyAccepted,
      firstItemName: r.items[0]?.originalOrderItem.productName ?? null,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    };
  });

  return (
    <ReturnsAdminList
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