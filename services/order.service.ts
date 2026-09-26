import { prisma } from "@/lib/prisma";
import { CouponService } from "@/services/coupon.service";

// ═══════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════
type OrderItemInput = {
  productId: number;
  variantId?: number;
  productName: string;
  variantName?: string;
  sku: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
};

type AddressInput = {
  fullName: string;
  phone: string;
  city: string;
  street: string;
  postalCode?: string;
};

type CreateOrderInput = {
  items: OrderItemInput[];
  subtotal: number;
  shippingCost: number;
  total: number;
  discount: number;
  couponId?: number;
  address: AddressInput;
  customer: {
    id: number;
    name: string;
    email: string;
  };
};

// ═══════════════════════════════════════════
// OrderService
// ═══════════════════════════════════════════
export const OrderService = {
  // توليد رقم طلب فريد: ORD-2026-00001
  async generateOrderNumber(tx: any): Promise<string> {
    const year = new Date().getFullYear();

    const seq = await tx.orderSequence.upsert({
      where: { year },
      create: { year, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });

    return `ORD-${year}-${String(seq.lastNumber).padStart(5, "0")}`;
  },

  // إنشاء طلب جديد
  async createOrder(userId: number, data: CreateOrderInput) {
    return prisma.$transaction(async (tx) => {
      // 1. توليد رقم الطلب
      const orderNumber = await this.generateOrderNumber(tx);

      // 2. إنشاء الطلب مع العناصر
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          status: "NEW",
          paymentMethod: "COD",
          paymentStatus: "PENDING",
          subtotal: data.subtotal,
          taxAmount: 0,
          shippingCost: data.shippingCost,
          discount: data.discount,
          total: data.total,
          shippingAddressSnapshot: data.address,
          customerSnapshot: data.customer,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              productName: item.productName,
              variantName: item.variantName,
              sku: item.sku,
              imageUrl: item.imageUrl,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.unitPrice * item.quantity,
              taxRate: 0,
              taxAmount: 0,
            })),
          },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: "NEW",
              changedById: userId,
              note: "تم إنشاء الطلب من قبل العميل",
            },
          },
        },
        include: {
          items: true,
        },
      });

      // 3. تطبيق الكوبون (إن وُجد)
      if (data.couponId) {
        await CouponService.applyInTransaction(
          tx,
          data.couponId,
          userId,
          order.id,
          data.discount
        );
      }

      // 4. إنشاء إشعار
      await tx.notification.create({
        data: {
          userId,
          type: "ORDER_CREATED",
          title: "تم استلام طلبك",
          message: `طلبك ${orderNumber} قيد المراجعة. سنتواصل معك قريباً.`,
          link: `/orders/${order.id}`,
        },
      });

      return order;
    });
  },

  // طلبات المستخدم
  async getByUser(userId: number) {
    return prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
  },

  // تفاصيل طلب واحد
  async getById(orderId: number, userId: number) {
    return prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true, statusHistory: true },
    });
  },
};