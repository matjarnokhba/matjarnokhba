export type BUOption = {
  id: number;
  name: string;
  type: string;
};

export type LedgerAccount = {
  id: number;
  code: string;
  name: string;
  type: string;
  subtype: string;
  balance: number;
  debitTotal: number;
  creditTotal: number;
};

export type TrialBalance = {
  bookId: number;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  rows: Array<{
    accountId: number;
    code: string;
    name: string;
    type: string;
    debitTotal: number;
    creditTotal: number;
    balance: number;
  }>;
};

export type StatementRow = {
  lineId: number;
  entryId: number;
  date: string;
  referenceType: string;
  referenceId: number;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

export type StatementResult = {
  account: { id: number; code: string; name: string };
  from: string;
  to: string;
  openingBalance: number;
  closingBalance: number;
  rows: StatementRow[];
};

export type InvoiceListItem = {
  id: number;
  invoiceNumber: string;
  invoiceType: string;
  counterpartyBusinessUnitId: number;
  orderId: number | null;
  total: number;
  paidAmount: number;
  status: string;
  issuedAt: string;
  dueAt: string | null;
};

export type InvoiceDetail = InvoiceListItem & {
  businessUnitId: number;
  subtotal: number;
  taxAmount: number;
  notes: string | null;
  creditNote: {
    id: number;
    amount: number;
    reasonCode: string;
    issuedAt: string;
  } | null;
  allocations: Array<{
    id: number;
    allocatedAmount: number;
    refundedAmount: number;
    payment: {
      id: number;
      paymentNumber: string;
      amount: number;
      paidAt: string;
      status: string;
    };
  }>;
};

export type PaymentListItem = {
  id: number;
  paymentNumber: string;
  businessUnitId: number;
  counterpartyBusinessUnitId: number | null;
  amount: number;
  currency: string;
  method: string;
  status: string;
  paidAt: string;
  groupId: number | null;
};

export type PaymentDetail = PaymentListItem & {
  notes: string | null;
  summary: {
    total: number;
    allocated: number;
    refunded: number;
    remaining: number;
  };
  allocations: Array<{
    id: number;
    allocatedAmount: number;
    refundedAmount: number;
    invoice: {
      id: number;
      invoiceNumber: string;
      invoiceType: string;
      total: number;
      paidAmount: number;
      status: string;
    };
  }>;
  refunds: Array<{
    id: number;
    refundNumber: string;
    amount: number;
    method: string;
    status: string;
    reason: string | null;
    processedAt: string | null;
  }>;
  settlement: {
    id: number;
    amount: number;
    status: string;
    settledAt: string | null;
  } | null;
};

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  ASSET: "أصول",
  LIABILITY: "التزامات",
  EQUITY: "حقوق ملكية",
  REVENUE: "إيرادات",
  EXPENSE: "مصروفات",
};

export const ACCOUNT_TYPE_VARIANT: Record<
  string,
  "green" | "red" | "yellow" | "blue" | "orange" | "gray"
> = {
  ASSET: "blue",
  LIABILITY: "red",
  EQUITY: "green",
  REVENUE: "green",
  EXPENSE: "orange",
};

export const INVOICE_TYPE_LABEL: Record<string, string> = {
  SALE: "بيع",
  PURCHASE: "شراء",
  CREDIT_NOTE: "إشعار دائن",
  DEBIT_NOTE: "إشعار مدين",
};

export const INVOICE_TYPE_VARIANT: Record<
  string,
  "green" | "red" | "yellow" | "blue" | "gray"
> = {
  SALE: "green",
  PURCHASE: "blue",
  CREDIT_NOTE: "red",
  DEBIT_NOTE: "yellow",
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "مسودة",
  ISSUED: "صادرة",
  PARTIALLY_PAID: "مدفوعة جزئيًا",
  PAID: "مدفوعة",
  CANCELLED: "ملغاة",
  VOID: "باطلة",
};

export const INVOICE_STATUS_VARIANT: Record<
  string,
  "green" | "red" | "yellow" | "gray" | "blue"
> = {
  DRAFT: "gray",
  ISSUED: "blue",
  PARTIALLY_PAID: "yellow",
  PAID: "green",
  CANCELLED: "red",
  VOID: "gray",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "نقدًا",
  BANK_TRANSFER: "تحويل بنكي",
  CARD: "بطاقة",
  CHECK: "شيك",
  CREDIT: "رصيد",
  OTHER: "أخرى",
};

export const BU_TYPE_LABEL: Record<string, string> = {
  FACTORY: "مصنع",
  SHOP: "محل",
  BRANCH: "فرع",
  IMPORTER: "مستورد",
  WHOLESALER: "تاجر جملة",
  DISTRIBUTOR: "موزع",
};

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ar-MA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ar-MA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatMoney(n: number): string {
  return n.toLocaleString("ar-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}