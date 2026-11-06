import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { OrdersList } from "@/components/wholesale/orders/OrdersList";
import type { OrderListItem, BUOption } from "@/components/wholesale/orders/types";

const PAGE_SIZE = 30;

export default async function OrdersPage({
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
  if (!current) redirect("/login?returnTo=/wholesale/orders");

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
      <OrdersList
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
    prisma.wholesaleOrder.count({ where }),
    prisma.wholesaleOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        group: { select: { id: true, groupNumber: true } },
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            subtotal: true,
          },
        },
      },
    }),
  ]);

  // Enrich with BU names
  const allBUs = new Set<number>();
  rows.forEach((r) => {
    allBUs.add(r.sellerBusinessUnitId);
    allBUs.add(r.buyerBusinessUnitId);
  });
  const buLookup = await prisma.businessUnit.findMany({
    where: { id: { in: Array.from(allBUs) } },
    select: { id: true, name: true },
  });
  const buNameMap = new Map(buLookup.map((b) => [b.id, b.name]));

  // Get first item images (from offer's master)
  const firstOfferIds = new Set<number>();
  const offerFirstItems: Array<{ orderId: number; masterId: number }> = [];
  // For simplicity, we won't fetch images for the list — use placeholder
  // (Optimization: could JOIN, but for now skip images)

  const items: OrderListItem[] = rows.map((r) => {
    const totalQty = r.items.reduce((s, i) => s + i.quantity, 0);
    return {
      id: r.id,
      orderNumber: r.orderNumber,
      groupId: r.group?.id ?? null,
      groupNumber: r.group?.groupNumber ?? null,
      sellerBusinessUnitId: r.sellerBusinessUnitId,
      buyerBusinessUnitId: r.buyerBusinessUnitId,
      sellerName: buNameMap.get(r.sellerBusinessUnitId) ?? "—",
      buyerName: buNameMap.get(r.buyerBusinessUnitId) ?? "—",
      subtotal: Number(r.subtotal),
      total: Number(r.total),
      status: r.status,
      paymentStatus: r.paymentStatus,
      fulfillmentStatus: r.fulfillmentStatus,
      itemsCount: r.items.length,
      totalQty,
      firstItemName: r.items[0]?.productName ?? null,
      firstItemImage: null,
      createdAt: r.createdAt.toISOString(),
      confirmedAt: r.confirmedAt?.toISOString() ?? null,
      shippedAt: r.shippedAt?.toISOString() ?? null,
      deliveredAt: r.deliveredAt?.toISOString() ?? null,
    };
  });

  return (
    <OrdersList
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