import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { ReturnsList } from "@/components/wholesale/returns/ReturnsList";
import type {
  ReturnListItem,
  BUOption,
} from "@/components/wholesale/returns/types";

const PAGE_SIZE = 30;

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{
    businessUnitId?: string;
    direction?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/returns");

  const params = await searchParams;
  const buIdRaw = params.businessUnitId || "";
  const direction = params.direction === "seller" ? "seller" : "buyer";
  const status = params.status || "";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  // Fetch user's BUs
  const owner = await prisma.businessOwner.findUnique({
    where: { userId: current.user.id },
    select: { id: true },
  });
  const ownerBUs = owner
    ? await prisma.businessUnit.findMany({
        where: { ownerId: owner.id, deletedAt: null, status: "ACTIVE" },
        select: { id: true, name: true, type: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const memberBUs = await prisma.businessUnitMember.findMany({
    where: {
      userId: current.user.id,
      isActive: true,
      deletedAt: null,
      businessUnit: { status: "ACTIVE", deletedAt: null },
    },
    select: { businessUnit: { select: { id: true, name: true, type: true } } },
  });
  const buMap = new Map<number, BUOption>();
  ownerBUs.forEach((b) => buMap.set(b.id, b));
  memberBUs.forEach((m) => {
    if (!buMap.has(m.businessUnit.id))
      buMap.set(m.businessUnit.id, m.businessUnit);
  });
  const businessUnits = Array.from(buMap.values());

  if (businessUnits.length === 0) {
    return (
      <ReturnsList
        items={[]}
        pagination={{ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 }}
        businessUnits={[]}
        currentBUId={buIdRaw}
        currentDirection={direction}
        currentStatus={status}
      />
    );
  }

  const buIds = businessUnits.map((b) => b.id);
  const buIdFilter = buIdRaw ? parseInt(buIdRaw, 10) : null;
  const effectiveBU =
    buIdFilter && buIds.includes(buIdFilter) ? buIdFilter : buIds[0];

  const where: any = {};
  if (direction === "buyer") where.buyerBusinessUnitId = effectiveBU;
  else where.sellerBusinessUnitId = effectiveBU;
  if (status) where.status = status;

  const [total, rows] = await Promise.all([
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
            originalOrderItem: {
              select: { productName: true },
            },
          },
        },
      },
    }),
  ]);

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

  const items: ReturnListItem[] = rows.map((r) => {
    const totalQty = r.items.reduce((s, i) => s + i.quantityRequested, 0);
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
      totalQtyRequested: totalQty,
      firstItemName: r.items[0]?.originalOrderItem.productName ?? null,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    };
  });

  return (
    <ReturnsList
      items={items}
      pagination={{
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      }}
      businessUnits={businessUnits}
      currentBUId={String(effectiveBU)}
      currentDirection={direction}
      currentStatus={status}
    />
  );
}