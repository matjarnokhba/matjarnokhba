import { prisma } from "@/lib/prisma";
import { CouponService } from "@/services/coupon.service";
import { InventoryService } from "@/services/inventory.service";

const RESERVATION_DURATION_MINUTES = 30;

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

export const OrderService = {
  // ═══════ توليد رقم طلب فريد ═══════
  async generateOrderNumber(tx: any): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await tx.orderSequence.upsert({
      where: { year },
      create: { year, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return `ORD-${year}-${String(seq.lastNumber).padStart(5, "0")}`;
  },

  // ═══════ إنشاء طلبات (تُقسَّم حسب البائع) ═══════
  async createOrder(userId: number, data: CreateOrderInput) {
    // 1. جلب sellerId لكل منتج
    const productIds = [...new Set(data.items.map((i) => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sellerId: true },
    });
    const sellerMap = new Map(products.map((p) => [p.id, p.sellerId]));

    // 2. تجميع العناصر حسب البائع
    const itemsBySeller = new Map<number, OrderItemInput[]>();
    for (const item of data.items) {
      const sellerId = sellerMap.get(item.productId);
      if (!sellerId) {
        throw new Error(`المنتج "${item.productName}" غير موجود`);
      }
      if (!itemsBySeller.has(sellerId)) itemsBySeller.set(sellerId, []);
      itemsBySeller.get(sellerId)!.push(item);
    }

    // 3. تحديد الطلب الذي يحمل الكوبون (الأكبر)
    let couponOrderSellerId: number | null = null;
    if (data.couponId) {
      let maxSubtotal = 0;
      for (const [sellerId, items] of itemsBySeller) {
        const sellerSubtotal = items.reduce(
          (s, i) => s + i.unitPrice * i.quantity,
          0
        );
        if (sellerSubtotal > maxSubtotal) {
          maxSubtotal = sellerSubtotal;
          couponOrderSellerId = sellerId;
        }
      }
    }

    // 4. إنشاء الطلبات في transaction واحدة
    return prisma.$transaction(async (tx) => {
      const createdOrders: Array<{
        id: number;
        orderNumber: string;
        sellerId: number;
        subtotal: number;
        shippingCost: number;
        total: number;
      }> = [];

      for (const [sellerId, items] of itemsBySeller) {
        const sellerSubtotal = items.reduce(
          (s, i) => s + i.unitPrice * i.quantity,
          0
        );

        // نسبة هذا البائع من الإجمالي
        const ratio = data.subtotal > 0 ? sellerSubtotal / data.subtotal : 1;

        // توزيع الشحن والخصم
        const sellerShipping =
          Math.round(data.shippingCost * ratio * 100) / 100;
        const isCouponOrder = sellerId === couponOrderSellerId;
        const sellerDiscount = isCouponOrder ? data.discount : 0;
        const sellerTotal = sellerSubtotal + sellerShipping - sellerDiscount;

        const orderNumber = await this.generateOrderNumber(tx);

        // ═══ إنشاء Order ═══
        const order = await tx.order.create({
          data: {
            orderNumber,
            userId,
            sellerId,
            status: "NEW",
            paymentMethod: "COD",
            paymentStatus: "PENDING",
            subtotal: sellerSubtotal,
            taxAmount: 0,
            shippingCost: sellerShipping,
            discount: sellerDiscount,
            total: sellerTotal,
            shippingAddressSnapshot: data.address,
            customerSnapshot: data.customer,
            items: {
              create: items.map((item) => ({
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
          include: { items: true },
        });

        // ═══ Reservation + Reserve Inventory ═══
        const expiresAt = new Date(
          Date.now() + RESERVATION_DURATION_MINUTES * 60 * 1000
        );

        const reservation = await tx.reservation.create({
          data: {
            orderId: order.id,
            status: "ACTIVE",
            expiresAt,
          },
        });

        for (const item of items) {
          if (!item.variantId) {
            throw new Error(
              `المنتج "${item.productName}" غير قابل للحجز (variant مفقود)`
            );
          }

          await InventoryService.reserve(
            tx,
            item.variantId,
            item.quantity,
            order.id
          );

          await tx.reservationItem.create({
            data: {
              reservationId: reservation.id,
              variantId: item.variantId,
              quantity: item.quantity,
            },
          });
        }

        // ═══ الكوبون (على الطلب الأكبر فقط) ═══
        if (isCouponOrder && data.couponId) {
          await CouponService.applyInTransaction(
            tx,
            data.couponId,
            userId,
            order.id,
            data.discount
          );
        }

        // ═══ إشعار العميل ═══
        await tx.notification.create({
          data: {
            userId,
            type: "ORDER_CREATED",
            title: "تم استلام طلبك",
            message: `طلبك ${orderNumber} قيد المراجعة. لديك 30 دقيقة قبل انتهاء الحجز.`,
            link: `/orders/${order.id}`,
          },
        });

        // ═══ إشعار التاجر ═══
        const seller = await tx.seller.findUnique({
          where: { id: sellerId },
          select: { userId: true },
        });
        if (seller) {
          await tx.notification.create({
            data: {
              userId: seller.userId,
              type: "SELLER_ORDER_RECEIVED",
              title: "طلب جديد 🎉",
              message: `وصلك طلب جديد ${orderNumber}`,
              link: `/seller/orders/${order.id}`,
            },
          });
        }

        createdOrders.push({
          id: order.id,
          orderNumber: order.orderNumber,
          sellerId,
          subtotal: sellerSubtotal,
          shippingCost: sellerShipping,
          total: sellerTotal,
        });
      }

      return createdOrders;
    });
  },

  // ═══════ طلبات المستخدم ═══════
  async getByUser(userId: number) {
    return prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
        seller: { select: { storeName: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  // ═══════ تفاصيل طلب ═══════
  async getById(orderId: number, userId: number) {
    return prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: true,
        statusHistory: true,
        seller: { select: { storeName: true, slug: true } },
      },
    });
  },
};