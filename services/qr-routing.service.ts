import { prisma } from "@/lib/prisma";
import { AccessPolicyService } from "./access-policy.service";

export type QRRoutingView =
  | "guest"
  | "customer_owner"
  | "customer_other"
  | "seller"
  | "collector"
  | "warehouse_manager"
  | "delivery_assigned"
  | "delivery_other"
  | "admin";

export type QRRouteResult = {
  view: QRRoutingView;
  redirect?: string;
  order?: any;
  shipment?: any;
  actions: string[];
};

type CurrentUser = {
  id: number;
  name: string;
  role: string;
  seller?: { id: number; slug: string } | null;
};

type CurrentSession = {
  user: CurrentUser;
} | null;

// ═══════════════════════════════════════════
// Actions per role/state
// ═══════════════════════════════════════════

function getCustomerActions(order: any): string[] {
  const actions: string[] = [];
  if (order.status === "DELIVERED") {
    actions.push("review");
    actions.push("return");
  }
  if (order.status === "NEW" || order.status === "PROCESSING") {
    actions.push("cancel");
  }
  return actions;
}

function getSellerActions(order: any): string[] {
  const actions: string[] = [];
  if (order.source === "IN_STORE") {
    actions.push("view_invoice");
  }
  return actions;
}

function getDeliveryActions(entity: any): string[] {
  const actions: string[] = [];

  // ═══ للأغراض الشحنات (Shipment) فقط ═══
  // الطلبات الفردية لا يستطيع DELIVERY التصرف عليها مباشرة
  // التدفق: SHIPPED → Collector → Warehouse → Shipment → DELIVERY
  if (entity.status === "OUT_FOR_DELIVERY" || entity.status === "PICKED_UP") {
    actions.push("delivered");
    actions.push("postponed");
    actions.push("refused");
  }

  return actions;
}

function getCollectorActions(_order: any): string[] {
  return ["view_fulfillment", "collect", "arrive"];
}

function getWarehouseActions(_order: any): string[] {
  return ["view_fulfillment", "view_shipment"];
}

function getAdminActions(_order: any): string[] {
  return ["view_admin", "change_status"];
}

// ═══════════════════════════════════════════
// Main Service
// ═══════════════════════════════════════════

export const QRRoutingService = {
  // ═══════════════════════════════════════════
  // Resolve Order Token
  // ═══════════════════════════════════════════
  async resolveOrderToken(
    token: string,
    current: CurrentSession
  ): Promise<QRRouteResult> {
    // 1. Guest
    if (!current) {
      return {
        view: "guest",
        redirect: "/login?redirect=/d/" + encodeURIComponent(token),
        actions: [],
      };
    }

    // 2. جلب الطلب مع fulfillmentItems (تحتاجها واجهة Collector)
    const order = await prisma.order.findFirst({
      where: { deliveryToken: token },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, sellerId: true, name: true },
            },
            fulfillmentItems: {
              select: {
                id: true,
                status: true,
                sellerId: true,
                readyAt: true,
                collectedAt: true,
                departedAt: true,
              },
            },
          },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        deliveryPerson: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
        shipmentItems: {
          select: {
            id: true,
            shipmentId: true,
            quantity: true,
            shipment: {
              select: {
                id: true,
                shipmentNumber: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return {
        view: "guest",
        redirect: "/",
        actions: [],
      };
    }

    // ═══ ADMIN / SUPER_ADMIN ═══
    if (
      current.user.role === "ADMIN" ||
      current.user.role === "SUPER_ADMIN"
    ) {
      return {
        view: "admin",
        order,
        actions: getAdminActions(order),
      };
    }

    // ═══ CUSTOMER ═══
    if (current.user.role === "CUSTOMER") {
      if (order.userId === current.user.id) {
        return {
          view: "customer_owner",
          order,
          actions: getCustomerActions(order),
        };
      }
      return {
        view: "customer_other",
        redirect: "/",
        actions: [],
      };
    }

    // ═══ SELLER ═══
    if (current.user.role === "SELLER") {
      if (!current.user.seller) {
        return {
          view: "customer_other",
          redirect: "/",
          actions: [],
        };
      }

      const sellerId = current.user.seller.id;

      const hasItems = order.items.some(
        (item) => item.sellerId === sellerId
      );

      if (!hasItems) {
        return {
          view: "customer_other",
          redirect: "/seller",
          actions: [],
        };
      }

      const access = await AccessPolicyService.canAccessOrder(
        current.user,
        order.id
      );

      const filtered = AccessPolicyService.filterOrderData(order, access);

      return {
        view: "seller",
        order: filtered,
        actions: getSellerActions(order),
      };
    }

    // ═══ DELIVERY ═══
    // ⚠️ DELIVERY لا يتفاعل مع الطلبات الفردية — فقط الشحنات
    if (current.user.role === "DELIVERY") {
      return {
        view: "delivery_other",
        redirect: "/delivery/shipments",
        actions: [],
      };
    }

    // ═══ COLLECTOR ═══
    if (current.user.role === "COLLECTOR") {
      return {
        view: "collector",
        order,
        actions: getCollectorActions(order),
      };
    }

    // ═══ WAREHOUSE_MANAGER ═══
    if (current.user.role === "WAREHOUSE_MANAGER") {
      return {
        view: "warehouse_manager",
        order,
        actions: getWarehouseActions(order),
      };
    }

    // Fallback
    return {
      view: "guest",
      redirect: "/",
      actions: [],
    };
  },

  // ═══════════════════════════════════════════
  // Resolve Shipment Token
  // ═══════════════════════════════════════════
  async resolveShipmentToken(
    token: string,
    current: CurrentSession
  ): Promise<QRRouteResult> {
    // 1. Guest
    if (!current) {
      return {
        view: "guest",
        redirect: "/login?redirect=/sd/" + encodeURIComponent(token),
        actions: [],
      };
    }

    // 2. جلب الشحنة عبر ShipmentQRService
    const { ShipmentQRService } = await import("./shipment-qr.service");
    const shipment = await ShipmentQRService.findByToken(token);

    if (!shipment) {
      return {
        view: "guest",
        redirect: "/",
        actions: [],
      };
    }

    // ═══ ADMIN ═══
    if (
      current.user.role === "ADMIN" ||
      current.user.role === "SUPER_ADMIN"
    ) {
      return {
        view: "admin",
        shipment,
        actions: ["view_admin"],
      };
    }

    // ═══ DELIVERY ═══
    if (current.user.role === "DELIVERY") {
      const person = await prisma.deliveryPerson.findUnique({
        where: { userId: current.user.id },
        select: { id: true, status: true, deletedAt: true },
      });

      if (!person || person.deletedAt || person.status !== "ACTIVE") {
        return {
          view: "delivery_other",
          redirect: "/",
          actions: [],
        };
      }

      const assignment = await prisma.deliveryAssignment.findFirst({
        where: {
          shipmentId: shipment.id,
          deliveryPersonId: person.id,
          status: {
            in: ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"],
          },
        },
        select: { id: true },
      });

      if (assignment || shipment.deliveryPersonId === person.id) {
        return {
          view: "delivery_assigned",
          shipment,
          actions: getDeliveryActions(shipment),
        };
      }

      return {
        view: "delivery_other",
        redirect: "/delivery",
        actions: [],
      };
    }

    // ═══ CUSTOMER ═══
    if (current.user.role === "CUSTOMER") {
      const ownedOrder = await prisma.order.findFirst({
        where: {
          userId: current.user.id,
          shipmentItems: {
            some: { shipmentId: shipment.id },
          },
        },
        select: { id: true },
      });

      if (ownedOrder) {
        return {
          view: "customer_owner",
          shipment,
          actions: [],
        };
      }

      return {
        view: "customer_other",
        redirect: "/",
        actions: [],
      };
    }

    // ═══ WAREHOUSE_MANAGER ═══
    if (current.user.role === "WAREHOUSE_MANAGER") {
      return {
        view: "warehouse_manager",
        shipment,
        actions: ["view_shipment"],
      };
    }

    // ═══ SELLER ═══
    if (current.user.role === "SELLER") {
      if (!current.user.seller) {
        return {
          view: "customer_other",
          redirect: "/",
          actions: [],
        };
      }

      const sellerId = current.user.seller.id;

      const hasItems = shipment.items.some(
        (item: any) => item.sellerId === sellerId
      );

      if (!hasItems) {
        return {
          view: "customer_other",
          redirect: "/seller",
          actions: [],
        };
      }

      return {
        view: "seller",
        shipment,
        actions: [],
      };
    }

    // ═══ COLLECTOR ═══
    if (current.user.role === "COLLECTOR") {
      return {
        view: "collector",
        shipment,
        actions: [],
      };
    }

    return {
      view: "guest",
      redirect: "/",
      actions: [],
    };
  },
};