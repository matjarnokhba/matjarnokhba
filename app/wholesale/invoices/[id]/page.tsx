import { notFound, redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { InvoiceDetail } from "@/components/wholesale/financial/InvoiceDetail";
import type { InvoiceDetail as InvoiceDetailType } from "@/components/wholesale/financial/types";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/financial");

  const { id } = await params;
  const invoiceId = parseInt(id, 10);
  if (isNaN(invoiceId) || invoiceId <= 0) notFound();

  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      creditNote: {
        select: {
          id: true,
          amount: true,
          reasonCode: true,
          issuedAt: true,
        },
      },
      allocations: {
        include: {
          payment: {
            select: {
              id: true,
              paymentNumber: true,
              amount: true,
              paidAt: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!inv) notFound();

  // Auth: user must belong to either BU, or be admin
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

  const isAdmin =
    current.user.role === "ADMIN" || current.user.role === "SUPER_ADMIN";
  const isInvolved =
    userBUIds.has(inv.businessUnitId) ||
    userBUIds.has(inv.counterpartyBusinessUnitId);

  if (!isAdmin && !isInvolved) notFound();

  // Fetch BU names
  const [bu, counterparty] = await Promise.all([
    prisma.businessUnit.findUnique({
      where: { id: inv.businessUnitId },
      select: { id: true, name: true, type: true },
    }),
    prisma.businessUnit.findUnique({
      where: { id: inv.counterpartyBusinessUnitId },
      select: { id: true, name: true, type: true },
    }),
  ]);

  const serialized: InvoiceDetailType & {
    businessUnit: { id: number; name: string; type: string } | null;
    counterparty: { id: number; name: string; type: string } | null;
  } = {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    invoiceType: inv.invoiceType,
    counterpartyBusinessUnitId: inv.counterpartyBusinessUnitId,
    businessUnitId: inv.businessUnitId,
    orderId: inv.orderId,
    total: Number(inv.total),
    paidAmount: Number(inv.paidAmount),
    subtotal: Number(inv.subtotal),
    taxAmount: Number(inv.taxAmount),
    status: inv.status,
    issuedAt: (inv.issuedAt ?? inv.createdAt).toISOString(),
    dueAt: inv.dueAt?.toISOString() ?? null,
    notes: inv.notes,
    creditNote: inv.creditNote
      ? {
          id: inv.creditNote.id,
          amount: Number(inv.creditNote.amount),
          reasonCode: inv.creditNote.reasonCode,
          issuedAt: inv.creditNote.issuedAt.toISOString(),
        }
      : null,
    allocations: inv.allocations.map((a) => ({
      id: a.id,
      allocatedAmount: Number(a.allocatedAmount),
      refundedAmount: Number(a.refundedAmount),
      payment: {
        id: a.payment.id,
        paymentNumber: a.payment.paymentNumber,
        amount: Number(a.payment.amount),
        paidAt: a.payment.paidAt.toISOString(),
        status: a.payment.status,
      },
    })),
    businessUnit: bu,
    counterparty,
  };

  return <InvoiceDetail invoice={serialized} />;
}