import { prisma } from "@/lib/prisma";

// ═══════ مفاتيح الصلاحيات ═══════
export const PERMISSIONS = {
  // ═══ الطلبات ═══
  VIEW_ALL_ORDERS: "VIEW_ALL_ORDERS",
  VIEW_ORDER_DETAILS: "VIEW_ORDER_DETAILS",
  VIEW_CUSTOMER_CONTACT: "VIEW_CUSTOMER_CONTACT",

  // ═══ التجهيز (Fulfillment) ═══
  VIEW_FULFILLMENTS: "VIEW_FULFILLMENTS",
  MANAGE_FULFILLMENTS: "MANAGE_FULFILLMENTS",

  // ═══ التجميع من التجار (Collection) ═══
  VIEW_COLLECTIONS: "VIEW_COLLECTIONS",
  ASSIGN_COLLECTION: "ASSIGN_COLLECTION",
  EXECUTE_COLLECTION: "EXECUTE_COLLECTION",

  // ═══ المستودع (Warehouse) ═══
  VIEW_WAREHOUSE: "VIEW_WAREHOUSE",
  RECEIVE_WAREHOUSE: "RECEIVE_WAREHOUSE",
  VERIFY_WAREHOUSE: "VERIFY_WAREHOUSE",

  // ═══ تجميع طلبات العميل (Grouping) ═══
  VIEW_CONSOLIDATED_ORDERS: "VIEW_CONSOLIDATED_ORDERS",
  MAKE_GROUPING_DECISION: "MAKE_GROUPING_DECISION",

  // ═══ الشحنات (Shipment) ═══
  CREATE_SHIPMENT: "CREATE_SHIPMENT",
  MANAGE_SHIPMENT_ITEMS: "MANAGE_SHIPMENT_ITEMS",
  PRINT_SHIPMENT_LABEL: "PRINT_SHIPMENT_LABEL",

  // ═══ التوصيل (Delivery) ═══
  ASSIGN_DELIVERY: "ASSIGN_DELIVERY",
  MANAGE_DELIVERY_PERSONS: "MANAGE_DELIVERY_PERSONS",
  EXECUTE_DELIVERY: "EXECUTE_DELIVERY",

  // ═══ البائعون ═══
  MANAGE_SELLERS: "MANAGE_SELLERS",
  VIEW_SELLER_FINANCIALS: "VIEW_SELLER_FINANCIALS",

  // ═══ الإدارة ═══
  MANAGE_USERS: "MANAGE_USERS",
  MANAGE_PERMISSIONS: "MANAGE_PERMISSIONS",
  MANAGE_SETTINGS: "MANAGE_SETTINGS",

  // ═══ النظام ═══
  VIEW_AUDIT_LOG: "VIEW_AUDIT_LOG",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

// ═══════ قائمة الصلاحيات الافتراضية ═══════
export const DEFAULT_PERMISSIONS: Array<{
  key: string;
  name: string;
  description: string;
  category: "ORDERS" | "SHIPMENT" | "DELIVERY" | "SELLER" | "ADMIN" | "SYSTEM";
}> = [
  // ═══ الطلبات ═══
  {
    key: PERMISSIONS.VIEW_ALL_ORDERS,
    name: "عرض كل الطلبات",
    description: "الوصول إلى قائمة كل الطلبات في النظام",
    category: "ORDERS",
  },
  {
    key: PERMISSIONS.VIEW_ORDER_DETAILS,
    name: "عرض تفاصيل الطلب",
    description: "فتح تفاصيل أي طلب",
    category: "ORDERS",
  },
  {
    key: PERMISSIONS.VIEW_CUSTOMER_CONTACT,
    name: "عرض بيانات تواصل العميل",
    description: "رؤية هاتف العميل وعنوانه الكامل",
    category: "ORDERS",
  },

  // ═══ التجهيز ═══
  {
    key: PERMISSIONS.VIEW_FULFILLMENTS,
    name: "عرض عمليات التجهيز",
    description: "رؤية FulfillmentItems ومراحل التجهيز",
    category: "ORDERS",
  },
  {
    key: PERMISSIONS.MANAGE_FULFILLMENTS,
    name: "إدارة عمليات التجهيز",
    description: "تحديث حالات التجهيز والملاحظات",
    category: "ORDERS",
  },

  // ═══ التجميع من التجار ═══
  {
    key: PERMISSIONS.VIEW_COLLECTIONS,
    name: "عرض مهام الجمع",
    description: "رؤية CollectionAssignments",
    category: "SHIPMENT",
  },
  {
    key: PERMISSIONS.ASSIGN_COLLECTION,
    name: "تكليف مهام الجمع",
    description: "تعيين السائق لجمع المنتجات من التجار",
    category: "SHIPMENT",
  },
  {
    key: PERMISSIONS.EXECUTE_COLLECTION,
    name: "تنفيذ عمليات الجمع",
    description: "تأكيد استلام المنتجات من التاجر",
    category: "SHIPMENT",
  },

  // ═══ المستودع ═══
  {
    key: PERMISSIONS.VIEW_WAREHOUSE,
    name: "عرض المستودع",
    description: "رؤية عمليات المستودع والاستلامات",
    category: "SHIPMENT",
  },
  {
    key: PERMISSIONS.RECEIVE_WAREHOUSE,
    name: "استلام في المستودع",
    description: "تأكيد استلام المنتجات في المستودع",
    category: "SHIPMENT",
  },
  {
    key: PERMISSIONS.VERIFY_WAREHOUSE,
    name: "التحقق من المستودع",
    description: "فحص المنتجات المستلمة وتوثيق حالتها",
    category: "SHIPMENT",
  },

  // ═══ تجميع طلبات العميل ═══
  {
    key: PERMISSIONS.VIEW_CONSOLIDATED_ORDERS,
    name: "عرض الطلبات للتجميع",
    description: "رؤية طلبات العميل الواحد للتجميع",
    category: "SHIPMENT",
  },
  {
    key: PERMISSIONS.MAKE_GROUPING_DECISION,
    name: "قرار التجميع",
    description: "اتخاذ قرار الانتظار أو الإرسال الجزئي",
    category: "SHIPMENT",
  },

  // ═══ الشحنات ═══
  {
    key: PERMISSIONS.CREATE_SHIPMENT,
    name: "إنشاء شحنة",
    description: "إنشاء شحنة جديدة من طلبات مختارة",
    category: "SHIPMENT",
  },
  {
    key: PERMISSIONS.MANAGE_SHIPMENT_ITEMS,
    name: "إدارة عناصر الشحنة",
    description: "إضافة/إزالة الطلبات والعناصر في الشحنة",
    category: "SHIPMENT",
  },
  {
    key: PERMISSIONS.PRINT_SHIPMENT_LABEL,
    name: "طباعة ملصق الشحنة",
    description: "طباعة ملصق QR للشحنة",
    category: "SHIPMENT",
  },

  // ═══ التوصيل ═══
  {
    key: PERMISSIONS.ASSIGN_DELIVERY,
    name: "إسناد التوصيل",
    description: "تعيين سائق للشحنة",
    category: "DELIVERY",
  },
  {
    key: PERMISSIONS.MANAGE_DELIVERY_PERSONS,
    name: "إدارة أصحاب التوصيل",
    description: "إنشاء وتعديل حسابات السائقين",
    category: "DELIVERY",
  },
  {
    key: PERMISSIONS.EXECUTE_DELIVERY,
    name: "تنفيذ التوصيل",
    description: "تأكيد التسليم/الرفض/التأجيل",
    category: "DELIVERY",
  },

  // ═══ البائعون ═══
  {
    key: PERMISSIONS.MANAGE_SELLERS,
    name: "إدارة البائعين",
    description: "موافقة/رفض/تعليق البائعين",
    category: "SELLER",
  },
  {
    key: PERMISSIONS.VIEW_SELLER_FINANCIALS,
    name: "عرض البيانات المالية للتاجر",
    description: "رؤية أرباح التاجر ومدفوعاته",
    category: "SELLER",
  },

  // ═══ الإدارة ═══
  {
    key: PERMISSIONS.MANAGE_USERS,
    name: "إدارة المستخدمين",
    description: "عرض/تعديل/حظر المستخدمين",
    category: "ADMIN",
  },
  {
    key: PERMISSIONS.MANAGE_PERMISSIONS,
    name: "إدارة الصلاحيات",
    description: "منح/سحب الصلاحيات للمستخدمين",
    category: "ADMIN",
  },
  {
    key: PERMISSIONS.MANAGE_SETTINGS,
    name: "إدارة الإعدادات",
    description: "إعدادات النظام العامة",
    category: "ADMIN",
  },

  // ═══ النظام ═══
  {
    key: PERMISSIONS.VIEW_AUDIT_LOG,
    name: "عرض سجل التدقيق",
    description: "رؤية كل العمليات الحساسة",
    category: "SYSTEM",
  },
];

// ═══════ Service ═══════
export const PermissionService = {
  async hasPermission(
    userId: number,
    permissionKey: string
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) return false;

    // SUPER_ADMIN → كل الصلاحيات
    if (user.role === "SUPER_ADMIN") return true;

    // ADMIN → كل الصلاحيات إلا MANAGE_PERMISSIONS
    if (user.role === "ADMIN") {
      if (permissionKey === PERMISSIONS.MANAGE_PERMISSIONS) return false;
      return true;
    }

    // باقي الأدوار
    const userPerm = await prisma.userPermission.findFirst({
      where: {
        userId,
        revokedAt: null,
        permission: { key: permissionKey },
      },
      select: { id: true },
    });

    return !!userPerm;
  },

  async hasAllPermissions(
    userId: number,
    permissionKeys: string[]
  ): Promise<boolean> {
    for (const key of permissionKeys) {
      const has = await this.hasPermission(userId, key);
      if (!has) return false;
    }
    return true;
  },

  async hasAnyPermission(
    userId: number,
    permissionKeys: string[]
  ): Promise<boolean> {
    for (const key of permissionKeys) {
      const has = await this.hasPermission(userId, key);
      if (has) return true;
    }
    return false;
  },

  async getUserPermissions(userId: number): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) return [];

    if (user.role === "SUPER_ADMIN") {
      const all = await prisma.permission.findMany({
        select: { key: true },
      });
      return all.map((p) => p.key);
    }

    if (user.role === "ADMIN") {
      const all = await prisma.permission.findMany({
        where: { key: { not: PERMISSIONS.MANAGE_PERMISSIONS } },
        select: { key: true },
      });
      return all.map((p) => p.key);
    }

    const userPerms = await prisma.userPermission.findMany({
      where: { userId, revokedAt: null },
      include: { permission: { select: { key: true } } },
    });

    return userPerms.map((up) => up.permission.key);
  },

  async grant(
    userId: number,
    permissionKey: string,
    grantedById?: number
  ) {
    const permission = await prisma.permission.findUnique({
      where: { key: permissionKey },
    });

    if (!permission) {
      throw new Error(`الصلاحية ${permissionKey} غير معرّفة`);
    }

    const existing = await prisma.userPermission.findUnique({
      where: {
        userId_permissionId: {
          userId,
          permissionId: permission.id,
        },
      },
    });

    if (existing) {
      if (existing.revokedAt) {
        return prisma.userPermission.update({
          where: { id: existing.id },
          data: {
            revokedAt: null,
            grantedAt: new Date(),
            grantedById: grantedById || null,
          },
        });
      }
      return existing;
    }

    return prisma.userPermission.create({
      data: {
        userId,
        permissionId: permission.id,
        grantedById: grantedById || null,
      },
    });
  },

  async revoke(userId: number, permissionKey: string) {
    const permission = await prisma.permission.findUnique({
      where: { key: permissionKey },
    });

    if (!permission) throw new Error("الصلاحية غير معرّفة");

    await prisma.userPermission.updateMany({
      where: {
        userId,
        permissionId: permission.id,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  },

  // ═══ مزامنة الصلاحيات الافتراضية ═══
  async syncDefaults() {
    let created = 0;
    let updated = 0;

    for (const perm of DEFAULT_PERMISSIONS) {
      const existing = await prisma.permission.findUnique({
        where: { key: perm.key },
      });

      if (!existing) {
        await prisma.permission.create({
          data: {
            key: perm.key,
            name: perm.name,
            description: perm.description,
            category: perm.category,
          },
        });
        created++;
      } else {
        // نُحدّث الوصف/الاسم إن تغيّرا
        if (
          existing.name !== perm.name ||
          existing.description !== perm.description ||
          existing.category !== perm.category
        ) {
          await prisma.permission.update({
            where: { id: existing.id },
            data: {
              name: perm.name,
              description: perm.description,
              category: perm.category,
            },
          });
          updated++;
        }
      }
    }

    return { created, updated, total: DEFAULT_PERMISSIONS.length };
  },
};