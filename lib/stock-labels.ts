// تسميات عربية لحركات المخزون ومصادرها (تُستعمل في الـ API والواجهات)
export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  STOCK_IN: "إضافة مخزون",
  STOCK_OUT: "إخراج مخزون",
  ADJUSTMENT: "تعديل يدوي",
  SALE: "بيع",
  RETURN: "إرجاع",
  RESERVE: "حجز",
  UNRESERVE: "إلغاء حجز",
  OPENING: "رصيد افتتاحي",
  TRANSFER_IN: "تحويل وارد",
};

export const REFERENCE_LABELS: Record<string, string> = {
  ORDER: "طلب",
  MANUAL: "عملية يدوية",
  SYSTEM: "النظام",
  RETURN: "مرتجع طلب",
  STORE_SALE: "بيع من المحل",
  STORE_SALE_RETURN: "إرجاع بيع المحل",
  STOCK_RECEIPT: "طلب إضافة مخزون",
  TRANSFER: "تحويل من الجملة",
};

export const STOCK_SOURCE_LABELS: Record<string, string> = {
  SUPPLIER: "مورد أو شركة",
  FACTORY: "مصنع",
  OTHER_STORE: "متجر آخر",
  WHOLESALE_MARKET: "سوق الجملة",
  BRANCH_TRANSFER: "تحويل من فرع",
  PLATFORM_TRANSFER: "تحويل من المنصة",
  OTHER: "مصدر آخر",
};

export const BUCKET_LABELS: Record<string, string> = {
  SELLABLE: "المخزون القابل للبيع",
  DEFECTIVE: "مخزون العيوب",
};

export function movementTypeLabel(t: string): string {
  return MOVEMENT_TYPE_LABELS[t] ?? t;
}
export function referenceLabel(t: string | null | undefined): string {
  return t ? REFERENCE_LABELS[t] ?? t : "";
}