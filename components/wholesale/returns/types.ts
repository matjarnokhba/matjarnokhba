export type ReturnListItem = {
  id: number;
  returnNumber: string;
  originalOrderId: number;
  originalOrderNumber: string;
  buyerBusinessUnitId: number;
  sellerBusinessUnitId: number;
  buyerName: string;
  sellerName: string;
  status: string;
  reason: string;
  expectedRefundAmount: number | null;
  approvedRefundAmount: number | null;
  itemsCount: number;
  totalQtyRequested: number;
  firstItemName: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type ReturnDetail = ReturnListItem & {
  items: Array<{
    id: number;
    originalOrderItemId: number;
    productName: string;
    variantAttributes: Array<{ name: string; value: string }>;
    unitPrice: number;
    quantityRequested: number;
    quantityReceived: number;
    quantityAccepted: number;
    condition: string;
  }>;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  creditNotes: Array<{
    id: number;
    amount: number;
    reasonCode: string;
    issuedAt: string;
  }>;
  originalOrder: {
    id: number;
    orderNumber: string;
    status: string;
    total: number;
    deliveredAt: string | null;
  };
  buyer: { id: number; name: string; type: string };
  seller: { id: number; name: string; type: string };
};

export type BUOption = {
  id: number;
  name: string;
  type: string;
};

export const RETURN_STATUS_LABEL: Record<string, string> = {
  REQUESTED: "طلب جديد",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  PENDING_SHIPMENT: "بانتظار الشحن",
  RECEIVED: "تم الاستلام",
  INSPECTED: "تم الفحص",
  PARTIALLY_ACCEPTED: "مقبول جزئيًا",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغى",
};

export const RETURN_STATUS_VARIANT: Record<
  string,
  "green" | "red" | "yellow" | "gray" | "orange" | "blue" | "cyan" | "purple"
> = {
  REQUESTED: "yellow",
  APPROVED: "blue",
  REJECTED: "red",
  PENDING_SHIPMENT: "orange",
  RECEIVED: "cyan",
  INSPECTED: "purple",
  PARTIALLY_ACCEPTED: "orange",
  COMPLETED: "green",
  CANCELLED: "gray",
};

export const RETURN_ITEM_CONDITION_LABEL: Record<string, string> = {
  SELLABLE: "صالح للبيع",
  DAMAGED: "تالف",
  QUARANTINED: "حجر",
  REJECTED_RETURN: "مرفوض",
};

export const RETURN_ITEM_CONDITION_VARIANT: Record<
  string,
  "green" | "red" | "yellow" | "gray"
> = {
  SELLABLE: "green",
  DAMAGED: "red",
  QUARANTINED: "yellow",
  REJECTED_RETURN: "gray",
};

export const BU_TYPE_LABEL: Record<string, string> = {
  FACTORY: "مصنع",
  SHOP: "محل",
  BRANCH: "فرع",
  IMPORTER: "مستورد",
  WHOLESALER: "تاجر جملة",
  DISTRIBUTOR: "موزع",
};

export const RETURN_STEPS: Array<{ key: string; label: string }> = [
  { key: "REQUESTED", label: "طلب جديد" },
  { key: "APPROVED", label: "معتمد" },
  { key: "PENDING_SHIPMENT", label: "بانتظار الشحن" },
  { key: "RECEIVED", label: "تم الاستلام" },
  { key: "INSPECTED", label: "تم الفحص" },
  { key: "COMPLETED", label: "مكتمل" },
];

export function getReturnStepIndex(status: string): number {
  if (status === "REJECTED" || status === "CANCELLED") return -1;
  if (status === "PARTIALLY_ACCEPTED") {
    // Treat as completed
    return RETURN_STEPS.length - 1;
  }
  return RETURN_STEPS.findIndex((s) => s.key === status);
}

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