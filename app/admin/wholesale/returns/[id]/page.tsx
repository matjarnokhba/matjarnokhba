import { notFound, redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { ReturnAdminDetail } from "@/components/admin/wholesale/ReturnAdminDetail";

export default async function AdminReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/admin/wholesale/returns");

  if (
    current.user.role !== "ADMIN" &&
    current.user.role !== "SUPER_ADMIN"
  ) {
    redirect("/");
  }

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
          inventoryReturns: {
            select: {
              id: true,
              condition: true,
              quantity: true,
              sourceBatchId: true,
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

  const [buyerBU, sellerBU] = await Promise.all([
    prisma.businessUnit.findUnique({
      where: { id: ret.buyerBusinessUnitId },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        verificationStatus: true,
        owner: {
          select: {
            displayName: true,
            user: { select: { email: true } },
          },
        },
      },
    }),
    prisma.businessUnit.findUnique({
      where: { id: ret.sellerBusinessUnitId },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        verificationStatus: true,
        owner: {
          select: {
            displayName: true,
            user: { select: { email: true } },
          },
        },
      },
    }),
  ]);

  if (!buyerBU || !sellerBU) notFound();

  // Find invoices on original order
  const invoices = await prisma.invoice.findMany({
    where: { orderId: ret.originalOrderId },
    select: {
      id: true,
      invoiceNumber: true,
      invoiceType: true,
      total: true,
      paidAmount: true,
      status: true,
      businessUnitId: true,
    },
    orderBy: { issuedAt: "asc" },
  });

  const totalQtyRequested = ret.items.reduce(
    (s, i) => s + i.quantityRequested,
    0
  );
  const totalQtyAccepted = ret.items.reduce(
    (s, i) => s + i.quantityAccepted,
    0
  );

  const serialized = {
    id: ret.id,
    returnNumber: ret.returnNumber,
    originalOrderId: ret.originalOrderId,
    originalOrderNumber: ret.originalOrder.orderNumber,
    buyerBusinessUnitId: ret.buyerBusinessUnitId,
    sellerBusinessUnitId: ret.sellerBusinessUnitId,
    status: ret.status,
    reason: ret.reason,
    expectedRefundAmount: ret.expectedRefundAmount
      ? Number(ret.expectedRefundAmount)
      : null,
    approvedRefundAmount: ret.approvedRefundAmount
      ? Number(ret.approvedRefundAmount)
      : null,
    totalQtyRequested,
    totalQtyAccepted,
    itemsCount: ret.items.length,
    createdAt: ret.createdAt.toISOString(),
    approvedAt: ret.approvedAt?.toISOString() ?? null,
    rejectedAt: ret.rejectedAt?.toISOString() ?? null,
    rejectionReason: ret.rejectionReason,
    completedAt: ret.completedAt?.toISOString() ?? null,
    buyer: {
      id: buyerBU.id,
      name: buyerBU.name,
      slug: buyerBU.slug,
      type: buyerBU.type,
      verificationStatus: buyerBU.verificationStatus,
      ownerName: buyerBU.owner.displayName,
      ownerEmail: buyerBU.owner.user.email,
    },
    seller: {
      id: sellerBU.id,
      name: sellerBU.name,
      slug: sellerBU.slug,
      type: sellerBU.type,
      verificationStatus: sellerBU.verificationStatus,
      ownerName: sellerBU.owner.displayName,
      ownerEmail: sellerBU.owner.user.email,
    },
    originalOrder: {
      id: ret.originalOrder.id,
      orderNumber: ret.originalOrder.orderNumber,
      status: ret.originalOrder.status,
      total: Number(ret.originalOrder.total),
      deliveredAt: ret.originalOrder.deliveredAt?.toISOString() ?? null,
    },
    items: ret.items.map((i) => ({
      id: i.id,
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
      inventoryReturns: i.inventoryReturns.map((ir) => ({
        id: ir.id,
        condition: ir.condition,
        quantity: ir.quantity,
        sourceBatchId: ir.sourceBatchId,
      })),
    })),
    creditNotes: ret.creditNotes.map((cn) => ({
      id: cn.id,
      amount: Number(cn.amount),
      reasonCode: cn.reasonCode,
      issuedAt: cn.issuedAt.toISOString(),
    })),
    invoices: invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceType: inv.invoiceType,
      total: Number(inv.total),
      paidAmount: Number(inv.paidAmount),
      status: inv.status,
      businessUnitId: inv.businessUnitId,
    })),
  };

  return <ReturnAdminDetail returnOrder={serialized} />;
}