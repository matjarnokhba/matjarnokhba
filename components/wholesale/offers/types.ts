export type OfferListItem = {
  id: number;
  masterId: number;
  masterName: string;
  masterBrand: string | null;
  masterImage: string | null;
  businessUnitId: number;
  businessUnitName: string;
  businessUnitType: string;
  wholesalePrice: number;
  minOrderQty: number;
  maxOrderQty: number | null;
  status: string;
  claimType: string;
  claimVerified: boolean;
  reviewLevel: string;
  variantCount: number;
  createdAt: string;
};

export type OfferDetail = OfferListItem & {
  notes: string | null;
  claimProofUrl: string | null;
  claimNotes: string | null;
  approvedAt: string | null;
  updatedAt: string;
  master: {
    id: number;
    name: string;
    brand: string | null;
    description: string | null;
    images: string[];
    barcode: string | null;
  };
  businessUnit: {
    id: number;
    name: string;
    slug: string;
    type: string;
    status: string;
    verificationStatus: string;
  };
  variants: Array<{
    id: number;
    masterVariantId: number;
    attributes: Array<{ name: string; value: string }>;
    tiers: Array<{
      id: number;
      minQty: number;
      maxQty: number | null;
      unitPrice: number;
    }>;
  }>;

  bundleRules?: Array<{
    id: number;
    triggerVariantId: number;
    requiredVariantId: number;
    minQuantity: number;
    notes: string | null;
  }>;};

export type BUOption = {
  id: number;
  name: string;
  type: string;
};

export const OFFER_STATUS_LABEL: Record<string, string> = {
  DRAFT: "مسودة",
  PENDING_REVIEW: "بانتظار المراجعة",
  ACTIVE: "نشط",
  PAUSED: "موقوف مؤقتًا",
  REJECTED: "مرفوض",
  OUT_OF_STOCK: "نفد المخزون",
  SUSPENDED: "موقوف إداريًا",
  ARCHIVED: "مؤرشف",
};

export const OFFER_STATUS_VARIANT: Record<
  string,
  "green" | "red" | "yellow" | "gray" | "orange" | "blue" | "cyan"
> = {
  DRAFT: "gray",
  PENDING_REVIEW: "yellow",
  ACTIVE: "green",
  PAUSED: "orange",
  REJECTED: "red",
  OUT_OF_STOCK: "gray",
  SUSPENDED: "red",
  ARCHIVED: "gray",
};

export const CLAIM_TYPE_LABEL: Record<string, string> = {
  MANUFACTURER: "مصنّع",
  DISTRIBUTOR: "موزع",
  IMPORTER: "مستورد",
  RESELLER: "بائع تجزئة",
};

export const REVIEW_LEVEL_LABEL: Record<string, string> = {
  AUTO: "تلقائي",
  MANUAL: "يدوي",
  TRUSTED: "موثوق",
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

export function computePriceForQty(
  tiers: Array<{ minQty: number; maxQty: number | null; unitPrice: number }>,
  qty: number
): number | null {
  for (const t of tiers) {
    if (qty >= t.minQty && (t.maxQty === null || qty <= t.maxQty)) {
      return t.unitPrice;
    }
  }
  return null;
}