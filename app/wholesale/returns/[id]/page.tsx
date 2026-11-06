import { notFound, redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { ReturnDetail } from "@/components/wholesale/returns/ReturnDetail";
import type { ReturnDetail as ReturnDetailType } from "@/components/wholesale/returns/types";

export default async function ReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/returns");

  const { id } = await params;
  const returnId = parseInt(id, 10);
  if (isNaN(returnId) || returnId <= 0) notFound();

  const ret = await prisma.returnOrder.findUnique({
    where: { id: returnId },
    include: {
      originalOrder: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          deliveredAt: true,
        },
      },
      items: {
        orderBy: { id: "asc" },
        include: {
          originalOrderItem: {
            select: {
              productName: true,
              variantAttributes: true,
              unitPrice: true,
            },
          },
        },
      },
      creditNotes: {
        select: {
          id: true,
          amount: true,
          reasonCode: true,
          issuedAt: true,
        },
      },
    },
  });

  if (!ret) notFound();

  // Auth: user must be in either BU
  const userBUIds = new Set<number>();
  const owner = await prisma.businessOwner.findUnique({
    where: { userId: current.user.id },
    select: { id: true },
  });
  if (owner) {
    const owned = await prisma.businessUnit.findMany({
      where: { ownerId: owner.id, deletedAt: null },
      select: { id: true },
    });
    owned.forEach((b) => userBUIds.add(b.id));
  }
  const memberBUs = await prisma.businessUnitMember.findMany({
    where: { userId: current.user.id, isActive: true, deletedAt: null },
    select: { businessUnitId: true },
  });
  memberBUs.forEach((m) => userBUIds.add(m.businessUnitId));

  const isBuyer = userBUIds.has(ret.buyerBusinessUnitId);
  const isSeller = userBUIds.has(ret.sellerBusinessUnitId);
  const isAdmin =
    current.user.role === "ADMIN" || current.user.role === "SUPER_ADMIN";

  if (!isBuyer && !isSeller && !isAdmin) notFound();

  // Fetch BU info
  const [buyerBU, sellerBU] = await Promise.all([
    prisma.businessUnit.findUnique({
      where: { id: ret.buyerBusinessUnitId },
      select: { id: true, name: true, type: true },
    }),
    prisma.businessUnit.findUnique({
      where: { id: ret.sellerBusinessUnitId },
      select: { id: true, name: true, type: true },
    }),
  ]);

  if (!buyerBU || !sellerBU) notFound();

  const totalQtyRequested = ret.items.reduce(
    (s, i) => s + i.quantityRequested,
    0
  );

  const serialized: ReturnDetailType = {
    id: ret.id,
    returnNumber: ret.returnNumber,
    originalOrderId: ret.originalOrderId,
    originalOrderNumber: ret.originalOrder.orderNumber,
    buyerBusinessUnitId: ret.buyerBusinessUnitId,
    sellerBusinessUnitId: ret.sellerBusinessUnitId,
    buyerName: buyerBU.name,
    sellerName: sellerBU.name,
    status: ret.status,
    reason: ret.reason,
    expectedRefundAmount: ret.expectedRefundAmount
      ? Number(ret.expectedRefundAmount)
      : null,
    approvedRefundAmount: ret.approvedRefundAmount
      ? Number(ret.approvedRefundAmount)
      : null,
    itemsCount: ret.items.length,
    totalQtyRequested,
    firstItemName: ret.items[0]?.originalOrderItem.productName ?? null,
    createdAt: ret.createdAt.toISOString(),
    completedAt: ret.completedAt?.toISOString() ?? null,
    approvedAt: ret.approvedAt?.toISOString() ?? null,
    rejectedAt: ret.rejectedAt?.toISOString() ?? null,
    rejectionReason: ret.rejectionReason,
    items: ret.items.map((i) => ({
      id: i.id,
      originalOrderItemId: i.originalOrderItemId,
      productName: i.originalOrderItem.productName,
      variantAttributes:
        (i.originalOrderItem.variantAttributes as Array<{
          name: string;
          value: string;
        }>) ?? [],
      unitPrice: Number(i.originalOrderItem.unitPrice),
      quantityRequested: i.quantityRequested,
      quantityReceived: i.quantityReceived,
      quantityAccepted: i.quantityAccepted,
      condition: i.condition,
    })),
    creditNotes: ret.creditNotes.map((cn) => ({
      id: cn.id,
      amount: Number(cn.amount),
      reasonCode: cn.reasonCode,
      issuedAt: cn.issuedAt.toISOString(),
    })),
    originalOrder: {
      id: ret.originalOrder.id,
      orderNumber: ret.originalOrder.orderNumber,
      status: ret.originalOrder.status,
      total: Number(ret.originalOrder.total),
      deliveredAt: ret.originalOrder.deliveredAt?.toISOString() ?? null,
    },
    buyer: buyerBU,
    seller: sellerBU,
  };

  return (
    <ReturnDetail
      returnOrder={serialized}
      isBuyer={isBuyer}
      isSeller={isSeller}
      isAdmin={isAdmin}
    />
  );
}