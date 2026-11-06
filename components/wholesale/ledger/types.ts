export type BUOption = {
  id: number;
  name: string;
  type: string;
};

export type LedgerContactItem = {
  id: number;
  name: string;
  contactType: string;
  phone: string | null;
  email: string | null;
  currentBalance: number;
  openingBalance: number;
  isActive: boolean;
  createdAt: string;
};

export type LedgerEntry = {
  id: number;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  entryDate: string;
  referenceType: string | null;
  referenceId: number | null;
  attachmentUrl: string | null;
  createdAt: string;
};

export type LedgerContactDetail = {
  id: number;
  name: string;
  contactType: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  linkedUserId: number | null;
  linkedBUId: number | null;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LedgerSummary = {
  totalContacts: number;
  netBalance: number;
};

export const CONTACT_TYPE_LABEL: Record<string, string> = {
  PLATFORM_TRADER: "تاجر من المنصة",
  EXTERNAL: "طرف خارجي",
  EMPLOYEE: "موظف",
  SUPPLIER: "مورد",
};

export const CONTACT_TYPE_VARIANT: Record<
  string,
  "green" | "blue" | "purple" | "orange" | "gray"
> = {
  PLATFORM_TRADER: "blue",
  EXTERNAL: "gray",
  EMPLOYEE: "purple",
  SUPPLIER: "orange",
};

export const ENTRY_TYPE_LABEL: Record<string, string> = {
  GAVE: "أعطيته",
  TOOK: "أخذت منه",
  SETTLEMENT: "تسوية",
};

export const ENTRY_TYPE_VARIANT: Record<
  string,
  "green" | "red" | "gray"
> = {
  GAVE: "green",
  TOOK: "red",
  SETTLEMENT: "gray",
};

export function formatBalance(n: number): {
  text: string;
  label: string;
  color: string;
  badgeVariant: "green" | "red" | "gray";
} {
  if (Math.abs(n) < 0.01) {
    return {
      text: "0.00",
      label: "مسدد",
      color: "text-gray-500",
      badgeVariant: "gray",
    };
  }
  if (n > 0) {
    return {
      text: n.toFixed(2),
      label: "مدين لنا",
      color: "text-emerald-700",
      badgeVariant: "green",
    };
  }
  return {
    text: Math.abs(n).toFixed(2),
    label: "مدينون له",
    color: "text-red-600",
    badgeVariant: "red",
  };
}