import { prisma } from "@/lib/prisma";

// ═══════ مفاتيح الصلاحيات ═══════
export const PERMISSIONS = {
  // ═══ الطلبات ═══
  VIEW_ALL_ORDERS: "VIEW_ALL_ORDERS",
  VIEW_ORDER_DETAILS: "VIEW_ORDER_DETAILS",
  VIEW_CUSTOMER_CONTACT: "VIEW_CUSTOMER_CONTACT",

  // ═══ التجميع والشحن ═══
  VIEW_CONSOLIDATED_ORDERS: "VIEW_CONSOLIDATED_ORDERS",
  CREATE_SHIPMENT: "CREATE_SHIPMENT",
  MANAGE_SHIPMENT_ITEMS: "MANAGE_SHIPMENT_ITEMS",

  // ═══ التوصيل ═══
  ASSIGN_DELIVERY: "ASSIGN_DELIVERY",
  MANAGE_DELIVERY_PERSONS: "MANAGE_DELIVERY_PERSONS",

  // ═══ البائعون ═══
  MANAGE_SELLERS: "MANAGE_SELLERS",
  VIEW_SELLER_FINANCIALS: "VIEW_SELLER_FINANCIALS",

  // ═══ إدارة ═══
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

  // ═══ التجميع والشحن ═══
  {
    key: PERMISSIONS.VIEW_CONSOLIDATED_ORDERS,
    name: "عرض الطلبات للتجميع",
    description: "رؤية طلبات العميل الواحد للتجميع",
    category: "SHIPMENT",
  },
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

  // ═══ إدارة ═══
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
  // ═══ هل المستخدم يملك صلاحية معينة؟ ═══
  async hasPermission(
    userId: number,
    permissionKey: string
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) return false;

    // ═══ SUPER_ADMIN يملك كل الصلاحيات ═══
    if (user.role === "SUPER_ADMIN") return true;

    // ═══ ADMIN يملك معظم الصلاحيات (لكن ليس MANAGE_PERMISSIONS) ═══
    if (user.role === "ADMIN") {
      if (permissionKey === PERMISSIONS.MANAGE_PERMISSIONS) return false;
      return true;
    }

    // ═══ باقي الأدوار: من UserPermission ═══
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

  // ═══ هل يملك كل الصلاحيات المطلوبة؟ ═══
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

  // ═══ هل يملك أي صلاحية من القائمة؟ ═══
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

  // ═══ قائمة صلاحيات المستخدم ═══
  async getUserPermissions(userId: number): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) return [];

    // SUPER_ADMIN → كل الصلاحيات
    if (user.role === "SUPER_ADMIN") {
      const all = await prisma.permission.findMany({
        select: { key: true },
      });
      return all.map((p) => p.key);
    }

    // ADMIN → كل الصلاحيات إلا MANAGE_PERMISSIONS
    if (user.role === "ADMIN") {
      const all = await prisma.permission.findMany({
        where: { key: { not: PERMISSIONS.MANAGE_PERMISSIONS } },
        select: { key: true },
      });
      return all.map((p) => p.key);
    }

    // باقي الأدوار
    const userPerms = await prisma.userPermission.findMany({
      where: { userId, revokedAt: null },
      include: { permission: { select: { key: true } } },
    });

    return userPerms.map((up) => up.permission.key);
  },

  // ═══ منح صلاحية ═══
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

    // إن كان موجود ومُلغى → أعد تفعيله
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
      return existing; // مفعّل مسبقاً
    }

    return prisma.userPermission.create({
      data: {
        userId,
        permissionId: permission.id,
        grantedById: grantedById || null,
      },
    });
  },

  // ═══ سحب صلاحية ═══
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

  // ═══ مزامنة الصلاحيات الافتراضية (Seed) ═══
  async syncDefaults() {
    let created = 0;
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
      }
    }
    return created;
  },
};