export type SerializableBusinessUnit = {
  id: number;
  name: string;
  slug: string;
  type: string;
  status: string;
  capabilities: string[];
  verificationStatus: string;
  registrationStatus: string;
  description: string | null;
  logo: string | null;
  createdAt: string;
};

export type SerializableMember = {
  id: number;
  userId: number;
  role: "OWNER" | "MANAGER" | "STAFF";
  permissions: string[];
  isActive: boolean;
  userName: string;
  userEmail: string;
};

export type BUStats = {
  productCount: number;
  offerCount: number;
  orderCount: number;
  inventoryOnHand: number;
};

export const TYPE_LABEL: Record<string, string> = {
  FACTORY: "مصنع",
  SHOP: "محل تجاري",
  BRANCH: "فرع",
  IMPORTER: "مستورد",
  WHOLESALER: "تاجر جملة",
  DISTRIBUTOR: "موزع",
};

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "نشط",
  SUSPENDED: "موقوف",
  CLOSED: "مغلق",
};

export const STATUS_VARIANT: Record<string, "green" | "red" | "gray"> = {
  ACTIVE: "green",
  SUSPENDED: "red",
  CLOSED: "gray",
};

export const VERIF_LABEL: Record<string, string> = {
  PENDING: "قيد التحقق",
  VERIFIED: "موثّق",
  REJECTED: "مرفوض",
};

export const VERIF_VARIANT: Record<
  string,
  "green" | "red" | "yellow"
> = {
  PENDING: "yellow",
  VERIFIED: "green",
  REJECTED: "red",
};

export const CAPABILITY_LABEL: Record<string, string> = {
  RETAIL: "بيع بالتجزئة",
  WHOLESALE_BUY: "شراء بالجملة",
  WHOLESALE_SELL: "بيع بالجملة",
};

export const ROLE_LABEL: Record<string, string> = {
  OWNER: "مالك",
  MANAGER: "مدير",
  STAFF: "موظف",
};

export function getCapLabel(cap: string): string {
  return CAPABILITY_LABEL[cap] ?? cap;
}