import { prisma } from "@/lib/prisma";
import { PermissionService, PERMISSIONS } from "@/services/permission.service";

// ═══════ نتائج تقييم الوصول ═══════
export type OrderAccessResult =
  | { allowed: true; role: "ADMIN" | "SUPER_ADMIN"; scope: "full" }
  | { allowed: true; role: "SELLER"; scope: "seller"; sellerId: number }
  | { allowed: true; role: "CUSTOMER"; scope: "owner"; userId: number }
  | { allowed: true; role: "DELIVERY"; scope: "delivery"; deliveryPersonId: number }
  | { allowed: false; reason: string };

export type ShipmentAccessResult =
  | { allowed: true; role: "ADMIN" | "SUPER_ADMIN"; scope: "full" }
  | { allowed: true; role: "DELIVERY"; scope: "assigned"; deliveryPersonId: number; assignmentId: number }
  | { allowed: false; reason: string };

export type FulfillmentAccessResult =
  | { allowed: true; role: "ADMIN" | "SUPER_ADMIN"; scope: "full" }
  | { allowed: true; role: "SELLER"; scope: "owner"; sellerId: number }
  | { allowed: false; reason: string };

type CurrentUser = {
  id: number;
  role: string;
  seller?: { id: number } | null;
};

export const AccessPolicyService = {
  // ═══════════════════════════════════════════
  // الطلبات (Orders)
  // ═══════════════════════════════════════════
  async canAccessOrder(
    user: CurrentUser,
    orderId: number
  ): Promise<OrderAccessResult> {
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

    // ADMIN / SUPER_ADMIN
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      return { allowed: true, role: user.role, scope: "full" };
    }

    // SELLER
    if (user.role === "SELLER") {
      if (!user.seller) {
        return { allowed: false, reason: "لا يوجد متجر مرتبط بحسابك" };
      }

      if (order.sellerId === user.seller.id) {
        return {
          allowed: true,
          role: "SELLER",
          scope: "seller",
          sellerId: user.seller.id,
        };
      }

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

    // CUSTOMER
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

    // DELIVERY
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

      return { allowed: false, reason: "هذا الطلب ليس مُسنداً إليك" };
    }

    return { allowed: false, reason: "غير مصرح" };
  },

  // ═══════════════════════════════════════════
  // بيانات تواصل العميل
  // ═══════════════════════════════════════════
  async canViewCustomerContact(
    user: CurrentUser,
    orderId: number
  ): Promise<boolean> {
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      return PermissionService.hasPermission(
        user.id,
        PERMISSIONS.VIEW_CUSTOMER_CONTACT
      );
    }

    if (user.role === "SELLER") {
      if (!user.seller) return false;

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { source: true, sellerId: true },
      });

      if (!order) return false;

      // IN_STORE من التاجر نفسه → يستطيع
      if (
        order.source === "IN_STORE" &&
        order.sellerId === user.seller.id
      ) {
        return true;
      }

      return false;
    }

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
  // تصفية بيانات الطلب
  // ═══════════════════════════════════════════
  filterOrderData(order: any, access: OrderAccessResult): any {
    if (!access.allowed) return null;

    if (access.scope === "full") {
      return order;
    }

    if (access.scope === "seller") {
      const sellerId = access.sellerId;

      const filteredItems = (order.items || []).filter(
        (item: any) => item.product?.sellerId === sellerId
      );

      const isInStore = order.source === "IN_STORE";

      return {
        ...order,
        items: filteredItems,
        customerSnapshot: isInStore ? order.customerSnapshot : null,
        shippingAddressSnapshot: isInStore
          ? order.shippingAddressSnapshot
          : null,
        userId: isInStore ? order.userId : null,
        ...(isInStore ? {} : { user: undefined }),
      };
    }

    if (access.scope === "owner") {
      return order;
    }

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

  // ═══════════════════════════════════════════
  // Fulfillment
  // ═══════════════════════════════════════════
  async canAccessFulfillment(
    user: CurrentUser,
    fulfillmentItemId: number
  ): Promise<FulfillmentAccessResult> {
    const item = await prisma.fulfillmentItem.findUnique({
      where: { id: fulfillmentItemId },
      select: { id: true, sellerId: true },
    });

    if (!item) {
      return { allowed: false, reason: "العنصر غير موجود" };
    }

    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      return { allowed: true, role: user.role, scope: "full" };
    }

    if (user.role === "SELLER") {
      if (!user.seller) {
        return { allowed: false, reason: "لا يوجد متجر مرتبط" };
      }

      if (item.sellerId === user.seller.id) {
        return {
          allowed: true,
          role: "SELLER",
          scope: "owner",
          sellerId: user.seller.id,
        };
      }

      return { allowed: false, reason: "هذا العنصر لا يخص متجرك" };
    }

    return { allowed: false, reason: "غير مصرح" };
  },

  // ═══════════════════════════════════════════
  // Shipment
  // ═══════════════════════════════════════════
  async canAccessShipment(
    user: CurrentUser,
    shipmentId: number
  ): Promise<ShipmentAccessResult> {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, deliveryPersonId: true },
    });

    if (!shipment) {
      return { allowed: false, reason: "الشحنة غير موجودة" };
    }

    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      return { allowed: true, role: user.role, scope: "full" };
    }

    if (user.role === "DELIVERY") {
      const person = await prisma.deliveryPerson.findUnique({
        where: { userId: user.id },
        select: { id: true, status: true, deletedAt: true },
      });

      if (!person || person.deletedAt || person.status !== "ACTIVE") {
        return { allowed: false, reason: "الحساب غير نشط" };
      }

      // نبحث عن DeliveryAssignment نشط
      const assignment = await prisma.deliveryAssignment.findFirst({
        where: {
          shipmentId,
          deliveryPersonId: person.id,
          status: {
            in: ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"],
          },
        },
        select: { id: true },
      });

      if (assignment) {
        return {
          allowed: true,
          role: "DELIVERY",
          scope: "assigned",
          deliveryPersonId: person.id,
          assignmentId: assignment.id,
        };
      }

      // backward compat: لو الشحنة نفسها تحمل deliveryPersonId
      if (shipment.deliveryPersonId === person.id) {
        return {
          allowed: true,
          role: "DELIVERY",
          scope: "assigned",
          deliveryPersonId: person.id,
          assignmentId: 0, // legacy
        };
      }

      return { allowed: false, reason: "هذه الشحنة ليست مُسندة إليك" };
    }

    return { allowed: false, reason: "غير مصرح" };
  },

  // ═══════════════════════════════════════════
  // Collection Assignment
  // ═══════════════════════════════════════════
  async canAccessCollectionAssignment(
    user: CurrentUser,
    assignmentId: number
  ): Promise<boolean> {
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      return true;
    }

    if (user.role === "DELIVERY") {
      const person = await prisma.deliveryPerson.findUnique({
        where: { userId: user.id },
        select: { id: true, status: true, deletedAt: true },
      });

      if (!person || person.deletedAt || person.status !== "ACTIVE") {
        return false;
      }

      const assignment = await prisma.collectionAssignment.findFirst({
        where: {
          id: assignmentId,
          deliveryPersonId: person.id,
          status: { in: ["ASSIGNED", "IN_PROGRESS"] },
        },
        select: { id: true },
      });

      return !!assignment;
    }

    return false;
  },
};