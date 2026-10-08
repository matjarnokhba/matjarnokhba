import { prisma } from "@/lib/prisma";
import { PermissionService, PERMISSIONS } from "@/services/permission.service";

// ═══════ نتيجة التقييم ═══════
export type AccessResult =
  | { allowed: true; role: "ADMIN" | "SUPER_ADMIN"; scope: "full" }
  | { allowed: true; role: "SELLER"; scope: "seller"; sellerId: number }
  | { allowed: true; role: "CUSTOMER"; scope: "owner"; userId: number }
  | { allowed: true; role: "DELIVERY"; scope: "delivery"; deliveryPersonId: number }
  | { allowed: false; reason: string };

type CurrentUser = {
  id: number;
  role: string;
  seller?: { id: number } | null;
};

export const AccessPolicyService = {
  // ═══════════════════════════════════════════
  // تقييم صلاحية الوصول لطلب
  // ═══════════════════════════════════════════
  async canAccessOrder(
    user: CurrentUser,
    orderId: number
  ): Promise<AccessResult> {
    // ═══ 1. تحقق من وجود الطلب ═══
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        sellerId: true,
        source: true,
        deliveryPersonId: true,
      },
    });

    if (!order) {
      return { allowed: false, reason: "الطلب غير موجود" };
    }

    // ═══ 2. ADMIN / SUPER_ADMIN ═══
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      return {
        allowed: true,
        role: user.role,
        scope: "full",
      };
    }

    // ═══ 3. SELLER ═══
    if (user.role === "SELLER") {
      if (!user.seller) {
        return { allowed: false, reason: "لا يوجد متجر مرتبط بحسابك" };
      }

      // هل التاجر مرتبط بهذا الطلب؟
      if (order.sellerId === user.seller.id) {
        return {
          allowed: true,
          role: "SELLER",
          scope: "seller",
          sellerId: user.seller.id,
        };
      }

      // لو الطلب multi-vendor: نتحقق إن كان للتاجر أي OrderItem
      const hasItems = await prisma.orderItem.findFirst({
        where: {
          orderId,
          product: { sellerId: user.seller.id },
        },
        select: { id: true },
      });

      if (hasItems) {
        return {
          allowed: true,
          role: "SELLER",
          scope: "seller",
          sellerId: user.seller.id,
        };
      }

      return { allowed: false, reason: "هذا الطلب لا يخص متجرك" };
    }

    // ═══ 4. CUSTOMER ═══
    if (user.role === "CUSTOMER") {
      if (order.userId === user.id) {
        return {
          allowed: true,
          role: "CUSTOMER",
          scope: "owner",
          userId: user.id,
        };
      }
      return { allowed: false, reason: "هذا الطلب لا يخصك" };
    }

    // ═══ 5. DELIVERY ═══
    if (user.role === "DELIVERY") {
      const person = await prisma.deliveryPerson.findUnique({
        where: { userId: user.id },
        select: { id: true, status: true, deletedAt: true },
      });

      if (!person || person.deletedAt || person.status !== "ACTIVE") {
        return { allowed: false, reason: "الحساب غير نشط" };
      }

      if (order.deliveryPersonId === person.id) {
        return {
          allowed: true,
          role: "DELIVERY",
          scope: "delivery",
          deliveryPersonId: person.id,
        };
      }

      return {
        allowed: false,
        reason: "هذا الطلب ليس مُسنداً إليك",
      };
    }

    return { allowed: false, reason: "غير مصرح" };
  },

  // ═══════════════════════════════════════════
  // هل يستطيع رؤية بيانات تواصل العميل الكاملة؟
  // ═══════════════════════════════════════════
  async canViewCustomerContact(
    user: CurrentUser,
    orderId: number
  ): Promise<boolean> {
    // ADMIN → نعم (إذا عنده الصلاحية)
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      const hasPerm = await PermissionService.hasPermission(
        user.id,
        PERMISSIONS.VIEW_CUSTOMER_CONTACT
      );
      return hasPerm;
    }

    // SELLER → نعم فقط لطلبات IN_STORE الخاصة به
    if (user.role === "SELLER") {
      if (!user.seller) return false;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { source: true, sellerId: true },
      });

      if (!order) return false;

      // طلب IN_STORE أنشأه التاجر بنفسه → يستطيع رؤية بياناته
      if (
        order.source === "IN_STORE" &&
        order.sellerId === user.seller.id
      ) {
        return true;
      }

      // طلب ONLINE → لا
      return false;
    }

    // DELIVERY → نعم فقط للطلبات المُسندة له
    if (user.role === "DELIVERY") {
      const person = await prisma.deliveryPerson.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!person) return false;

      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          deliveryPersonId: person.id,
        },
        select: { id: true },
      });

      return !!order;
    }

    return false;
  },

  // ═══════════════════════════════════════════
  // تصفية بيانات الطلب حسب الصلاحية
  // ═══════════════════════════════════════════
  filterOrderData(
    order: any,
    access: AccessResult
  ): any {
    if (!access.allowed) return null;

    // ═══ ADMIN → كل شيء ═══
    if (access.scope === "full") {
      return order;
    }

    // ═══ SELLER → فلترة ═══
    if (access.scope === "seller") {
      const sellerId = access.sellerId;

      // فلترة الـitems — فقط منتجات هذا التاجر
      const filteredItems = (order.items || []).filter(
        (item: any) => item.product?.sellerId === sellerId
      );

      // هل الطلب IN_STORE؟
      const isInStore = order.source === "IN_STORE";

      return {
        ...order,
        items: filteredItems,
        // بيانات العميل:
        customerSnapshot: isInStore ? order.customerSnapshot : null,
        shippingAddressSnapshot: isInStore
          ? order.shippingAddressSnapshot
          : null,
        // حجب بيانات حساسة للتاجر لطلبات ONLINE
        userId: isInStore ? order.userId : null,
        ...(isInStore ? {} : { user: undefined }),
      };
    }

    // ═══ CUSTOMER → بياناته فقط ═══
    if (access.scope === "owner") {
      return order;
    }

    // ═══ DELIVERY → بيانات توصيل فقط ═══
    if (access.scope === "delivery") {
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        source: order.source,
        total: order.total,
        customerSnapshot: order.customerSnapshot,
        shippingAddressSnapshot: order.shippingAddressSnapshot,
        items: (order.items || []).map((item: any) => ({
          id: item.id,
          productName: item.productName,
          variantName: item.variantName,
          quantity: item.quantity,
          imageUrl: item.imageUrl,
        })),
      };
    }

    return null;
  },
};