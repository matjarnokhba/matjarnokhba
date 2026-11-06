export type SerializedListItem = {
  id: number;
  masterCode: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  images: string[];
  status: string;
  version: number;
  createdAt: string;
  category: { id: number; name: string };
  variantCount: number;
  merchantProductCount: number;
};

export type SerializedDetail = SerializedListItem & {
  description: string | null;
  qrCode: string | null;
  createdByUser: { id: number; name: string; email: string };
  approvedByUser: { id: number; name: string } | null;
  approvedAt: string | null;
  updatedAt: string;
  variants: Array<{
    id: number;
    sku: string | null;
    barcode: string | null;
    qrCode: string | null;
    attributes: Array<{ name: string; value: string }>;
    isDefault: boolean;
  }>;
  versions: Array<{
    id: number;
    version: number;
    changeReason: string | null;
    createdAt: string;
    changedByUserId: number;
  }>;
  rejectionReason: string | null;
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: "بانتظار المراجعة",
  ACTIVE: "نشط",
  SUSPENDED: "موقوف",
  ARCHIVED: "مؤرشف",
};

export const STATUS_VARIANT: Record<
  string,
  "green" | "red" | "yellow" | "gray"
> = {
  PENDING_REVIEW: "yellow",
  ACTIVE: "green",
  SUSPENDED: "red",
  ARCHIVED: "gray",
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