import { notFound, redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { PaymentDetail } from "@/components/wholesale/financial/PaymentDetail";
import type { PaymentDetail as PaymentDetailType } from "@/components/wholesale/financial/types";

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/financial");

  const { id } = await params;
  const paymentId = parseInt(id, 10);
  if (isNaN(paymentId) || paymentId <= 0) notFound();

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      group: { select: { id: true, groupNumber: true } },
      allocations: {
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              invoiceType: true,
              total: true,
              paidAmount: true,
              status: true,
            },
          },
        },
      },
      refunds: {
        select: {
          id: true,
          refundNumber: true,
          amount: true,
          method: true,
          status: true,
          reason: true,
          processedAt: true,
        },
      },
      settlement: {
        select: {
          id: true,
          amount: true,
          status: true,
          settledAt: true,
        },
      },
    },
  });

  if (!payment) notFound();

  // Auth
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
  const isPayer = userBUIds.has(payment.businessUnitId);
  const isReceiver =
    payment.counterpartyBusinessUnitId !== null &&
    userBUIds.has(payment.counterpartyBusinessUnitId);

  if (!isAdmin && !isPayer && !isReceiver) notFound();

  // Compute summary
  const allocated = payment.allocations.reduce(
    (s, a) => s + Number(a.allocatedAmount),
    0
  );
  const refunded = payment.allocations.reduce(
    (s, a) => s + Number(a.refundedAmount),
    0
  );
  const remaining = Math.round((Number(payment.amount) - allocated + refunded) * 100) / 100;

  // Fetch BU names
  const [bu, counterparty] = await Promise.all([
    prisma.businessUnit.findUnique({
      where: { id: payment.businessUnitId },
      select: { id: true, name: true, type: true },
    }),
    payment.counterpartyBusinessUnitId
      ? prisma.businessUnit.findUnique({
          where: { id: payment.counterpartyBusinessUnitId },
          select: { id: true, name: true, type: true },
        })
      : Promise.resolve(null),
  ]);

  const serialized: PaymentDetailType & {
    businessUnit: { id: number; name: string; type: string } | null;
    counterparty: { id: number; name: string; type: string } | null;
  } = {
    id: payment.id,
    paymentNumber: payment.paymentNumber,
    businessUnitId: payment.businessUnitId,
    counterpartyBusinessUnitId: payment.counterpartyBusinessUnitId,
    amount: Number(payment.amount),
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    paidAt: payment.paidAt.toISOString(),
    groupId: payment.groupId,
    notes: payment.notes,
    summary: {
      total: Number(payment.amount),
      allocated: Math.round(allocated * 100) / 100,
      refunded: Math.round(refunded * 100) / 100,
      remaining,
    },
    allocations: payment.allocations.map((a) => ({
      id: a.id,
      allocatedAmount: Number(a.allocatedAmount),
      refundedAmount: Number(a.refundedAmount),
      invoice: {
        id: a.invoice.id,
        invoiceNumber: a.invoice.invoiceNumber,
        invoiceType: a.invoice.invoiceType,
        total: Number(a.invoice.total),
        paidAmount: Number(a.invoice.paidAmount),
        status: a.invoice.status,
      },
    })),
    refunds: payment.refunds.map((r) => ({
      id: r.id,
      refundNumber: r.refundNumber,
      amount: Number(r.amount),
      method: r.method,
      status: r.status,
      reason: r.reason,
      processedAt: r.processedAt?.toISOString() ?? null,
    })),
    settlement: payment.settlement
      ? {
          id: payment.settlement.id,
          amount: Number(payment.settlement.amount),
          status: payment.settlement.status,
          settledAt: payment.settlement.settledAt?.toISOString() ?? null,
        }
      : null,
    businessUnit: bu,
    counterparty,
  };

  return <PaymentDetail payment={serialized} />;
}