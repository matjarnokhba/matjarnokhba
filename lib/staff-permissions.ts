export const STAFF_PERMISSIONS = {
  VIEW_PRODUCTS: "VIEW_PRODUCTS",
  MANAGE_PRODUCTS: "MANAGE_PRODUCTS",
  VIEW_ORDERS: "VIEW_ORDERS",
  UPDATE_ORDER_STATUS: "UPDATE_ORDER_STATUS",
  VIEW_FULFILLMENTS: "VIEW_FULFILLMENTS",
  MANAGE_FULFILLMENTS: "MANAGE_FULFILLMENTS",
  VIEW_RETURNS: "VIEW_RETURNS",
  CONFIRM_RETURNS: "CONFIRM_RETURNS",
  VIEW_BATCHES: "VIEW_BATCHES",
  CONFIRM_BATCHES: "CONFIRM_BATCHES",
  VIEW_REVIEWS: "VIEW_REVIEWS",
  VIEW_NOTIFICATIONS: "VIEW_NOTIFICATIONS",
  VIEW_WALLET: "VIEW_WALLET",
  USE_SCANNER: "USE_SCANNER",
  VIEW_QR: "VIEW_QR",
  VIEW_PERFORMANCE: "VIEW_PERFORMANCE",
} as const;

export type StaffPermissionKey = keyof typeof STAFF_PERMISSIONS;

export const ALL_STAFF_PERMISSIONS: StaffPermissionKey[] = Object.values(
  STAFF_PERMISSIONS
);

export const DEFAULT_STAFF_PERMISSIONS: StaffPermissionKey[] = [
  "VIEW_PRODUCTS",
  "VIEW_ORDERS",
  "VIEW_FULFILLMENTS",
  "VIEW_RETURNS",
  "VIEW_NOTIFICATIONS",
];

export const PERMISSION_LABELS: Record<
  StaffPermissionKey,
  { label: string; group: string; sensitive?: boolean }
> = {
  VIEW_PRODUCTS: { label: "عرض المنتجات", group: "منتجات" },
  MANAGE_PRODUCTS: { label: "إدارة المنتجات", group: "منتجات" },
  VIEW_ORDERS: { label: "عرض الطلبات", group: "طلبات" },
  UPDATE_ORDER_STATUS: { label: "تحديث حالة الطلبات", group: "طلبات" },
  VIEW_FULFILLMENTS: { label: "عرض التجهيزات", group: "تجهيز" },
  MANAGE_FULFILLMENTS: { label: "إدارة التجهيزات", group: "تجهيز" },
  VIEW_RETURNS: { label: "عرض المرتجعات", group: "مرتجعات" },
  CONFIRM_RETURNS: { label: "تأكيد استلام المرتجعات", group: "مرتجعات" },
  VIEW_BATCHES: { label: "عرض الدفعات", group: "دفعات" },
  CONFIRM_BATCHES: { label: "تأكيد استلام الدفعات", group: "دفعات" },
  VIEW_REVIEWS: { label: "عرض التقييمات", group: "تقييمات" },
  VIEW_NOTIFICATIONS: { label: "عرض الإشعارات", group: "إشعارات" },
  VIEW_WALLET: { label: "عرض المحفظة", group: "محفظة", sensitive: true },
  USE_SCANNER: { label: "استخدام الماسح", group: "أدوات" },
  VIEW_QR: { label: "عرض QR", group: "أدوات" },
  VIEW_PERFORMANCE: { label: "عرض الأداء", group: "أداء" },
};

export function isValidStaffPermission(key: string): key is StaffPermissionKey {
  return key in STAFF_PERMISSIONS;
}

export function hasStaffPermission(
  permissions: string[],
  key: StaffPermissionKey
): boolean {
  return permissions.includes(key);
}