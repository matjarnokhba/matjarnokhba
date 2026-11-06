import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { FinancialPage } from "@/components/wholesale/financial/FinancialPage";
import type {
  BUOption,
  LedgerAccount,
  TrialBalance,
  InvoiceListItem,
  PaymentListItem,
} from "@/components/wholesale/financial/types";

const PAGE_SIZE = 30;

export default async function FinancialServerPage({
  searchParams,
}: {
  searchParams: Promise<{
    businessUnitId?: string;
    page?: string;
    pageInv?: string;
    pagePay?: string;
  }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/financial");

  const params = await searchParams;
  const buIdRaw = params.businessUnitId || "";

  // Fetch BUs
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
      <FinancialPage
        businessUnits={[]}
        initialBusinessUnitId={0}
        accounts={[]}
        trialBalance={{
          bookId: 0,
          totalDebit: 0,
          totalCredit: 0,
          isBalanced: true,
          rows: [],
        }}
        invoices={[]}
        payments={[]}
        invoicesPagination={{ page: 1, total: 0, totalPages: 0 }}
        paymentsPagination={{ page: 1, total: 0, totalPages: 0 }}
      />
    );
  }

  const buIds = businessUnits.map((b) => b.id);
  const buIdFilter = buIdRaw ? parseInt(buIdRaw, 10) : null;
  const effectiveBU =
    buIdFilter && buIds.includes(buIdFilter) ? buIdFilter : buIds[0];

  // Ensure ledger book exists (needed for accounts)
  const book = await prisma.ledgerBook.findFirst({
    where: { businessUnitId: effectiveBU, isPrimary: true, isActive: true },
  });

  // Accounts + balances
  let accounts: LedgerAccount[] = [];
  let trialBalance: TrialBalance = {
    bookId: book?.id ?? 0,
    totalDebit: 0,
    totalCredit: 0,
    isBalanced: true,
    rows: [],
  };

  if (book) {
    const accountsRaw = await prisma.ledgerAccount.findMany({
      where: { bookId: book.id, isActive: true },
      orderBy: { code: "asc" },
      include: {
        balances: {
          where: { currency: book.currency },
          select: { debitTotal: true, creditTotal: true, balance: true },
        },
      },
    });

    accounts = accountsRaw.map((a) => {
      const b = a.balances[0];
      return {
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        balance: Number(b?.balance ?? 0),
        debitTotal: Number(b?.debitTotal ?? 0),
        creditTotal: Number(b?.creditTotal ?? 0),
      };
    });

    let totalDebit = 0;
    let totalCredit = 0;
    const rows = accounts.map((a) => {
      totalDebit += a.debitTotal;
      totalCredit += a.creditTotal;
      return {
        accountId: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        debitTotal: a.debitTotal,
        creditTotal: a.creditTotal,
        balance: a.balance,
      };
    });

    trialBalance = {
      bookId: book.id,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      rows,
    };
  }

  // Invoices
  const pageInv = Math.max(1, parseInt(params.pageInv || "1", 10) || 1);
  const [invTotal, invRows] = await Promise.all([
    prisma.invoice.count({ where: { businessUnitId: effectiveBU } }),
    prisma.invoice.findMany({
      where: { businessUnitId: effectiveBU },
      orderBy: { issuedAt: "desc" },
      skip: (pageInv - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const invoices: InvoiceListItem[] = invRows.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    invoiceType: i.invoiceType,
    counterpartyBusinessUnitId: i.counterpartyBusinessUnitId,
    orderId: i.orderId,
    total: Number(i.total),
    paidAmount: Number(i.paidAmount),
    status: i.status,
    issuedAt: (i.issuedAt ?? i.createdAt).toISOString(),
    dueAt: i.dueAt?.toISOString() ?? null,
  }));

  // Payments
  const pagePay = Math.max(1, parseInt(params.pagePay || "1", 10) || 1);
  const [payTotal, payRows] = await Promise.all([
    prisma.payment.count({
      where: {
        OR: [
          { businessUnitId: effectiveBU },
          { counterpartyBusinessUnitId: effectiveBU },
        ],
      },
    }),
    prisma.payment.findMany({
      where: {
        OR: [
          { businessUnitId: effectiveBU },
          { counterpartyBusinessUnitId: effectiveBU },
        ],
      },
      orderBy: { paidAt: "desc" },
      skip: (pagePay - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const payments: PaymentListItem[] = payRows.map((p) => ({
    id: p.id,
    paymentNumber: p.paymentNumber,
    businessUnitId: p.businessUnitId,
    counterpartyBusinessUnitId: p.counterpartyBusinessUnitId,
    amount: Number(p.amount),
    currency: p.currency,
    method: p.method,
    status: p.status,
    paidAt: p.paidAt.toISOString(),
    groupId: p.groupId,
  }));

  return (
    <FinancialPage
      businessUnits={businessUnits}
      initialBusinessUnitId={effectiveBU}
      accounts={accounts}
      trialBalance={trialBalance}
      invoices={invoices}
      payments={payments}
      invoicesPagination={{
        page: pageInv,
        total: invTotal,
        totalPages: Math.ceil(invTotal / PAGE_SIZE),
      }}
      paymentsPagination={{
        page: pagePay,
        total: payTotal,
        totalPages: Math.ceil(payTotal / PAGE_SIZE),
      }}
    />
  );
}