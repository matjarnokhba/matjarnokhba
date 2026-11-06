export type OrderListItem = {
  id: number;
  orderNumber: string;
  groupId: number | null;
  groupNumber: string | null;
  sellerBusinessUnitId: number;
  buyerBusinessUnitId: number;
  sellerName: string;
  buyerName: string;
  subtotal: number;
  total: number;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  itemsCount: number;
  totalQty: number;
  firstItemName: string | null;
  firstItemImage: string | null;
  createdAt: string;
  confirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
};

export type OrderDetail = OrderListItem & {
  discount: number;
  shippingCost: number;
  notes: string | null;
  expectedShipDate: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  updatedAt: string;
  seller: {
    id: number;
    name: string;
    slug: string;
    type: string;
    status: string;
    verificationStatus: string;
  };
  buyer: {
    id: number;
    name: string;
    slug: string;
    type: string;
    status: string;
    verificationStatus: string;
  };
  items: Array<{
    id: number;
    productName: string;
    variantAttributes: Array<{ name: string; value: string }>;
    quantity: number;
    sellingUnit: string;
    unitPrice: number;
    subtotal: number;
  }>;
};

export type BUOption = {
  id: number;
  name: string;
  type: string;
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "بانتظار التأكيد",
  CONFIRMED: "مؤكد",
  PROCESSING: "قيد التجهيز",
  READY: "جاهز للشحن",
  SHIPPED: "تم الشحن",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغى",
  RETURNED: "مرتجع",
  DISPUTED: "نزاع",
};

export const ORDER_STATUS_VARIANT: Record<
  string,
  "green" | "red" | "yellow" | "gray" | "orange" | "blue" | "cyan"
> = {
  PENDING: "yellow",
  CONFIRMED: "blue",
  PROCESSING: "orange",
  READY: "cyan",
  SHIPPED: "blue",
  DELIVERED: "green",
  CANCELLED: "red",
  RETURNED: "gray",
  DISPUTED: "red",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: "غير مدفوع",
  PARTIAL: "مدفوع جزئيًا",
  PAID: "مدفوع",
  REFUNDED: "مسترجع",
};

export const PAYMENT_STATUS_VARIANT: Record<
  string,
  "green" | "red" | "yellow" | "gray" | "blue"
> = {
  UNPAID: "gray",
  PARTIAL: "yellow",
  PAID: "green",
  REFUNDED: "blue",
};

export const FULFILLMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "بانتظار التجهيز",
  PREPARING: "قيد التجهيز",
  READY: "جاهز",
  SHIPPED: "تم الشحن",
  DELIVERED: "تم التسليم",
};

export const BU_TYPE_LABEL: Record<string, string> = {
  FACTORY: "مصنع",
  SHOP: "محل",
  BRANCH: "فرع",
  IMPORTER: "مستورد",
  WHOLESALER: "تاجر جملة",
  DISTRIBUTOR: "موزع",
};

export const ORDER_STEPS: Array<{ key: string; label: string }> = [
  { key: "PENDING", label: "طلب جديد" },
  { key: "CONFIRMED", label: "مؤكد" },
  { key: "PROCESSING", label: "قيد التجهيز" },
  { key: "READY", label: "جاهز للشحن" },
  { key: "SHIPPED", label: "تم الشحن" },
  { key: "DELIVERED", label: "تم التسليم" },
];

export function getOrderStepIndex(status: string): number {
  if (status === "CANCELLED" || status === "RETURNED" || status === "DISPUTED")
    return -1;
  return ORDER_STEPS.findIndex((s) => s.key === status);
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