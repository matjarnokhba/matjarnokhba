export type InventoryAccountSummary = {
  id: number;
  type: string;
  locationName: string;
  locationType: string;
  isActive: boolean;
};

export type BalanceRow = {
  merchantVariantId: number;
  inventoryAccountId: number;
  accountType: string;
  locationName: string;
  sku: string | null;
  barcode: string | null;
  productName: string;
  productId: number;
  variantAttributes: Array<{ name: string; value: string }>;
  onHand: number;
  reserved: number;
  available: number;
  updatedAt: string;
};

export type BatchRow = {
  id: number;
  merchantVariantId: number;
  inventoryAccountId: number;
  accountType: string;
  locationName: string;
  productName: string;
  sku: string | null;
  sourceType: string;
  sourceReferenceId: number | null;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number;
  receivedAt: string;
};

export type BUOption = {
  id: number;
  name: string;
  type: string;
};

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  RETAIL: "تجزئة",
  WHOLESALE: "جملة",
  QUARANTINE: "حجر",
  DAMAGED: "تالف",
};

export const ACCOUNT_TYPE_VARIANT: Record<
  string,
  "green" | "orange" | "yellow" | "red" | "blue" | "gray"
> = {
  RETAIL: "blue",
  WHOLESALE: "green",
  QUARANTINE: "yellow",
  DAMAGED: "red",
};

export const BATCH_SOURCE_LABEL: Record<string, string> = {
  PURCHASE: "شراء",
  RETURN: "مرتجع",
  TRANSFER: "تحويل",
  OPENING_BALANCE: "رصيد افتتاحي",
};

export const BATCH_SOURCE_VARIANT: Record<
  string,
  "green" | "orange" | "yellow" | "blue" | "gray"
> = {
  PURCHASE: "green",
  RETURN: "orange",
  TRANSFER: "blue",
  OPENING_BALANCE: "gray",
};

export const BU_TYPE_LABEL: Record<string, string> = {
  FACTORY: "مصنع",
  SHOP: "محل",
  BRANCH: "فرع",
  IMPORTER: "مستورد",
  WHOLESALER: "تاجر جملة",
  DISTRIBUTOR: "موزع",
};

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

export function formatNumber(n: number): string {
  return n.toLocaleString("ar-MA");
}