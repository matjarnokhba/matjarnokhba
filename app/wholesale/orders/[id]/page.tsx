import { notFound, redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { OrderDetail } from "@/components/wholesale/orders/OrderDetail";
import type { OrderDetail as OrderDetailType } from "@/components/wholesale/orders/types";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/orders");

  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (isNaN(orderId) || orderId <= 0) notFound();

  const order = await prisma.wholesaleOrder.findUnique({
    where: { id: orderId },
    include: {
      group: { select: { id: true, groupNumber: true, status: true } },
      items: { orderBy: { id: "asc" } },
    },
  });

  if (!order) notFound();

  // Auth: check user belongs to either BU
  const userBUIds = new Set<number>();
  const owner = await prisma.businessOwner.findUnique({
    where: { userId: current.user.id },
    select: { id: true },
  });
  if (owner) {
    const ownedBUs = await prisma.businessUnit.findMany({
      where: { ownerId: owner.id, deletedAt: null },
      select: { id: true },
    });
    ownedBUs.forEach((b) => userBUIds.add(b.id));
  }
  const memberBUs = await prisma.businessUnitMember.findMany({
    where: {
      userId: current.user.id,
      isActive: true,
      deletedAt: null,
    },
    select: { businessUnitId: true },
  });
  memberBUs.forEach((m) => userBUIds.add(m.businessUnitId));

  const isBuyer = userBUIds.has(order.buyerBusinessUnitId);
  const isSeller = userBUIds.has(order.sellerBusinessUnitId);
  const isAdmin =
    current.user.role === "ADMIN" || current.user.role === "SUPER_ADMIN";

  if (!isBuyer && !isSeller && !isAdmin) notFound();

  // Fetch BU details
  const [sellerBU, buyerBU] = await Promise.all([
    prisma.businessUnit.findUnique({
      where: { id: order.sellerBusinessUnitId },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        status: true,
        verificationStatus: true,
      },
    }),
    prisma.businessUnit.findUnique({
      where: { id: order.buyerBusinessUnitId },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        status: true,
        verificationStatus: true,
      },
    }),
  ]);

  if (!sellerBU || !buyerBU) notFound();

  const firstItem = order.items[0];
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

  // Fetch first item image via offer → master
  let firstItemImage: string | null = null;
  if (firstItem?.offerId) {
    const offer = await prisma.wholesaleOffer.findUnique({
      where: { id: firstItem.offerId },
      select: { master: { select: { images: true } } },
    });
    const images = offer?.master.images as string[] | undefined;
    firstItemImage = images?.[0] ?? null;
  }

  const serialized: OrderDetailType = {
    id: order.id,
    orderNumber: order.orderNumber,
    groupId: order.group?.id ?? null,
    groupNumber: order.group?.groupNumber ?? null,
    sellerBusinessUnitId: order.sellerBusinessUnitId,
    buyerBusinessUnitId: order.buyerBusinessUnitId,
    sellerName: sellerBU.name,
    buyerName: buyerBU.name,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    shippingCost: Number(order.shippingCost),
    total: Number(order.total),
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    itemsCount: order.items.length,
    totalQty,
    firstItemName: firstItem?.productName ?? null,
    firstItemImage,
    createdAt: order.createdAt.toISOString(),
    confirmedAt: order.confirmedAt?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancellationReason: order.cancellationReason,
    updatedAt: order.updatedAt.toISOString(),
    notes: order.notes,
    expectedShipDate: order.expectedShipDate?.toISOString() ?? null,
    seller: sellerBU,
    buyer: buyerBU,
    items: order.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      variantAttributes:
        (i.variantAttributes as Array<{ name: string; value: string }>) ?? [],
      quantity: i.quantity,
      sellingUnit: i.sellingUnit,
      unitPrice: Number(i.unitPrice),
      subtotal: Number(i.subtotal),
    })),
  };

  return (
    <OrderDetail
      order={serialized}
      isBuyer={isBuyer}
      isSeller={isSeller}
      isAdmin={isAdmin}
    />
  );
}