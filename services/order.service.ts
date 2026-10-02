import { prisma } from "@/lib/prisma";
import { CouponService } from "@/services/coupon.service";
import { InventoryService } from "@/services/inventory.service";

const RESERVATION_DURATION_MINUTES = 30;

// ═══════ ثوابت الشحن (نفس قيم lib/data/products.ts) ═══════
const SHIPPING_FEE = 30;
const FREE_SHIPPING_THRESHOLD = 300;

// ═══════ الأنواع ═══════
type OrderItemInput = {
  productId: number;
  variantId: number;
  quantity: number;
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
  couponCode?: string;
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

  // ═══════ إنشاء طلبات (Server-Side Calculation) ═══════
  async createOrder(userId: number, data: CreateOrderInput) {
    // ═══ 1. التحقق من المدخلات ═══
    if (!data.items || data.items.length === 0) {
      throw new Error("السلة فارغة");
    }

    if (data.items.some((i) => i.quantity <= 0 || i.quantity > 100)) {
      throw new Error("كمية غير صحيحة");
    }

    // ═══ 2. جلب الـVariants من DB (المصدر الوحيد للحقيقة) ═══
    const variantIds = data.items.map((i) => i.variantId);
    const variants = await prisma.productVariant.findMany({
      where: {
        id: { in: variantIds },
        isActive: true,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sellerId: true,
            status: true,
            deletedAt: true,
            seller: {
              select: { status: true, deletedAt: true },
            },
          },
        },
        inventory: { select: { quantity: true, reservedQuantity: true } },
      },
    });

    if (variants.length !== variantIds.length) {
      throw new Error("بعض المنتجات غير متوفرة");
    }

    // ═══ 3. التحقق من حالة المنتجات والتجار ═══
    for (const variant of variants) {
      if (
        !variant.product ||
        variant.product.deletedAt ||
        variant.product.status !== "ACTIVE"
      ) {
        throw new Error(`المنتج غير متوفر`);
      }
      if (
        !variant.product.seller ||
        variant.product.seller.deletedAt ||
        variant.product.seller.status !== "ACTIVE"
      ) {
        throw new Error(`بائع غير متوفر`);
      }
    }

    // ═══ 4. بناء خريطة للوصول السريع ═══
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // ═══ 5. التحقق من المخزون ═══
    for (const item of data.items) {
      const variant = variantMap.get(item.variantId);
      if (!variant) throw new Error("منتج غير موجود");

      const available =
        (variant.inventory?.quantity ?? 0) -
        (variant.inventory?.reservedQuantity ?? 0);

      if (available < item.quantity) {
        throw new Error(
          `الكمية غير متوفرة للمنتج "${variant.product.name}"`
        );
      }
    }

    // ═══ 6. حساب السعر الحقيقي (من DB — ليس من العميل) ═══
    const itemsWithPrice = data.items.map((item) => {
      const variant = variantMap.get(item.variantId)!;
      const unitPrice = Number(variant.discountPrice ?? variant.price);
      const lineTotal = unitPrice * item.quantity;

      return {
        productId: variant.product.id,
        variantId: variant.id,
        sellerId: variant.product.sellerId,
        productName: variant.product.name,
        sku: variant.sku,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      };
    });

    const serverSubtotal = itemsWithPrice.reduce(
      (s, i) => s + i.lineTotal,
      0
    );

    // ═══ 7. حساب الشحن ═══
    const serverShipping =
      serverSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

    // ═══ 8. تحقق من الكوبون + حساب الخصم (Server-Side) ═══
    let couponId: number | undefined;
    let serverDiscount = 0;

    if (data.couponCode?.trim()) {
      const couponResult = await CouponService.validate(
        data.couponCode,
        userId,
        serverSubtotal
      );

      if (!couponResult.valid) {
        throw new Error(couponResult.message || "كوبون غير صحيح");
      }

      couponId = couponResult.coupon?.id;
      serverDiscount = couponResult.discount || 0;
    }

    // ═══ 9. حساب الإجمالي الحقيقي ═══
    const serverTotal = Math.max(
      0,
      serverSubtotal + serverShipping - serverDiscount
    );

    // ═══ 10. تجميع العناصر حسب البائع ═══
    const itemsBySeller = new Map<number, typeof itemsWithPrice>();
    for (const item of itemsWithPrice) {
      if (!itemsBySeller.has(item.sellerId)) {
        itemsBySeller.set(item.sellerId, []);
      }
      itemsBySeller.get(item.sellerId)!.push(item);
    }

    // ═══ 11. تحديد الطلب الذي يحمل الكوبون (الأكبر) ═══
    let couponOrderSellerId: number | null = null;
    if (couponId) {
      let maxSubtotal = 0;
      for (const [sellerId, items] of itemsBySeller) {
        const sellerSubtotal = items.reduce(
          (s, i) => s + i.lineTotal,
          0
        );
        if (sellerSubtotal > maxSubtotal) {
          maxSubtotal = sellerSubtotal;
          couponOrderSellerId = sellerId;
        }
      }
    }

    // ═══ 12. الإنشاء في Transaction ═══
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
        const sellerSubtotal = items.reduce((s, i) => s + i.lineTotal, 0);

        // توزيع الشحن والخصم بنسبة كل بائع
        const ratio = serverSubtotal > 0 ? sellerSubtotal / serverSubtotal : 1;
        const sellerShipping =
          Math.round(serverShipping * ratio * 100) / 100;
        const isCouponOrder = sellerId === couponOrderSellerId;
        const sellerDiscount = isCouponOrder ? serverDiscount : 0;
        const sellerTotal =
          Math.round(
            (sellerSubtotal + sellerShipping - sellerDiscount) * 100
          ) / 100;

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
                sku: item.sku,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.lineTotal,
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

        // ═══ تطبيق الكوبون (على الطلب الأكبر فقط) ═══
        if (isCouponOrder && couponId) {
          await CouponService.applyInTransaction(
            tx,
            couponId,
            userId,
            order.id,
            sellerDiscount
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
          select: { userId: true, storeName: true },
        });

        if (seller) {
          await tx.notification.create({
            data: {
              userId: seller.userId,
              type: "SELLER_ORDER_RECEIVED",
              title: "طلب جديد 🎉",
              message: `وصلك طلب جديد ${orderNumber}`,
              link: `/seller/orders/${order.id}`,
              category: "ORDER",
              severity: "INFO",
              metadata: {
                orderId: order.id,
                orderNumber,
                sellerId,
              },
            },
          });
        }

        // ═══ إشعار الأدمن ═══
        const admins = await tx.user.findMany({
          where: {
            role: { in: ["ADMIN", "SUPER_ADMIN"] },
            deletedAt: null,
          },
          select: { id: true },
        });

        for (const admin of admins) {
          await tx.notification.create({
            data: {
              userId: admin.id,
              type: "ORDER_CREATED",
              title: "🛒 طلب جديد",
              message: `طلب جديد ${orderNumber} — من "${seller?.storeName || "تاجر"}" بقيمة ${sellerTotal} د.م`,
              link: `/admin/orders/${order.id}`,
              category: "ORDER",
              severity: "INFO",
              metadata: {
                orderId: order.id,
                orderNumber,
                sellerId,
                sellerName: seller?.storeName,
                total: sellerTotal,
                itemsCount: items.length,
              },
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