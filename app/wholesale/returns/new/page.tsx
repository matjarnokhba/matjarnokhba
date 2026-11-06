import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { CreateReturnWizard } from "@/components/wholesale/returns/CreateReturnWizard";

const TERMINAL_STATUSES = [
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
  "PARTIALLY_ACCEPTED",
] as const;

export default async function NewReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/returns/new");

  const params = await searchParams;
  const initialOrderId = params.orderId || "";

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
  const buMap = new Map<number, { id: number; name: string; type: string }>();
  ownerBUs.forEach((b) => buMap.set(b.id, b));
  memberBUs.forEach((m) => {
    if (!buMap.has(m.businessUnit.id))
      buMap.set(m.businessUnit.id, m.businessUnit);
  });
  const businessUnits = Array.from(buMap.values());

  if (businessUnits.length === 0) {
    return (
      <CreateReturnWizard
        businessUnits={[]}
        orders={[]}
        initialOrderId=""
      />
    );
  }

  const buIds = businessUnits.map((b) => b.id);

  // Fetch DELIVERED orders (as buyer)
  const ordersRaw = await prisma.wholesaleOrder.findMany({
    where: {
      buyerBusinessUnitId: { in: buIds },
      status: "DELIVERED",
    },
    orderBy: { deliveredAt: "desc" },
    take: 200,
    include: {
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productName: true,
          variantAttributes: true,
          unitPrice: true,
          quantity: true,
        },
      },
    },
  });

  if (ordersRaw.length === 0) {
    return (
      <CreateReturnWizard
        businessUnits={businessUnits}
        orders={[]}
        initialOrderId=""
      />
    );
  }

  const orderIds = ordersRaw.map((o) => o.id);
  const itemIds = ordersRaw.flatMap((o) => o.items.map((i) => i.id));

  // Aggregate accepted quantities per item
  const acceptedAgg = await prisma.returnOrderItem.groupBy({
    by: ["originalOrderItemId"],
    where: {
      originalOrderItemId: { in: itemIds },
      returnOrder: {
        originalOrderId: { in: orderIds },
        status: { in: ["COMPLETED", "PARTIALLY_ACCEPTED"] },
      },
    },
    _sum: { quantityAccepted: true },
  });
  const acceptedMap = new Map(
    acceptedAgg.map((a) => [a.originalOrderItemId, a._sum.quantityAccepted ?? 0])
  );

  // Active returns per order
  const activeReturns = await prisma.returnOrder.findMany({
    where: {
      originalOrderId: { in: orderIds },
      status: { notIn: TERMINAL_STATUSES as any },
    },
    select: { originalOrderId: true },
  });
  const ordersWithActiveReturn = new Set(
    activeReturns.map((r) => r.originalOrderId)
  );

  // Fetch seller BU names
  const sellerBUIds = [
    ...new Set(ordersRaw.map((o) => o.sellerBusinessUnitId)),
  ];
  const sellerBUs = await prisma.businessUnit.findMany({
    where: { id: { in: sellerBUIds } },
    select: { id: true, name: true, type: true },
  });
  const sellerMap = new Map(sellerBUs.map((b) => [b.id, b]));

  const orders = ordersRaw
    .map((o) => {
      const seller = sellerMap.get(o.sellerBusinessUnitId);
      const items = o.items
        .map((i) => {
          const alreadyReturned = acceptedMap.get(i.id) ?? 0;
          const remaining = Math.max(0, i.quantity - alreadyReturned);
          return {
            id: i.id,
            productName: i.productName,
            variantAttributes:
              (i.variantAttributes as Array<{
                name: string;
                value: string;
              }>) ?? [],
            unitPrice: Number(i.unitPrice),
            quantity: i.quantity,
            quantityRemaining: remaining,
          };
        })
        .filter((i) => i.quantityRemaining > 0);

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        sellerBusinessUnitId: o.sellerBusinessUnitId,
        sellerName: seller?.name ?? "—",
        sellerType: seller?.type ?? "",
        total: Number(o.total),
        deliveredAt: o.deliveredAt?.toISOString() ?? null,
        hasActiveReturn: ordersWithActiveReturn.has(o.id),
        items,
      };
    })
    .filter((o) => o.items.length > 0); // only returnable orders

  return (
    <CreateReturnWizard
      businessUnits={businessUnits}
      orders={orders}
      initialOrderId={initialOrderId}
    />
  );
}