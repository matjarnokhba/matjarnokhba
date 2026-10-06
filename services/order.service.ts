import { prisma } from "@/lib/prisma";
import { CouponService } from "@/services/coupon.service";
import { InventoryService } from "@/services/inventory.service";

const SHIPPING_FEE = 30;
const FREE_SHIPPING_THRESHOLD = 300;
const TRANSACTION_TIMEOUT_MS = 20000;

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
  async generateOrderNumber(tx: any): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await tx.orderSequence.upsert({
      where: { year },
      create: { year, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return `ORD-${year}-${String(seq.lastNumber).padStart(5, "0")}`;
  },

  async createOrder(userId: number, data: CreateOrderInput) {
    if (!data.items || data.items.length === 0) {
      throw new Error("السلة فارغة");
    }

    if (data.items.some((i) => i.quantity <= 0 || i.quantity > 100)) {
      throw new Error("كمية غير صحيحة");
    }

    // ═══ 1. جلب الـVariants ═══
    const variantIds = data.items.map((i) => i.variantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, isActive: true },
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
            images: {
              where: { isMain: true },
              take: 1,
              select: { url: true },
            },
          },
        },
        inventory: { select: { quantity: true, reservedQuantity: true } },
        optionValues: {
          include: {
            optionValue: {
              include: { option: true },
            },
          },
        },
      },
    });

    if (variants.length !== variantIds.length) {
      throw new Error("بعض المنتجات غير متوفرة");
    }

    for (const variant of variants) {
      if (
        !variant.product ||
        variant.product.deletedAt ||
        variant.product.status !== "ACTIVE"
      ) {
        throw new Error("المنتج غير متوفر");
      }
      if (
        !variant.product.seller ||
        variant.product.seller.deletedAt ||
        variant.product.seller.status !== "ACTIVE"
      ) {
        throw new Error("بائع غير متوفر");
      }
    }

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // ═══ 2. التحقق من المخزون (قراءة أولية — التحقق النهائي داخل tx) ═══
    for (const item of data.items) {
      const variant = variantMap.get(item.variantId);
      if (!variant) throw new Error("منتج غير موجود");

      const available = variant.inventory?.quantity ?? 0;

      if (available < item.quantity) {
        throw new Error(
          `الكمية غير متوفرة للمنتج "${variant.product.name}"`
        );
      }
    }

    // ═══ 3. حساب السعر من DB ═══
    const itemsWithPrice = data.items.map((item) => {
      const variant = variantMap.get(item.variantId)!;
      const unitPrice = Number(variant.discountPrice ?? variant.price);
      const lineTotal = unitPrice * item.quantity;

      const sortedOV = [...variant.optionValues].sort(
        (a, b) =>
          (a.optionValue.option.order ?? 0) -
          (b.optionValue.option.order ?? 0)
      );
      const variantName =
        sortedOV.length > 0
          ? sortedOV.map((ov) => ov.optionValue.value).join(" / ")
          : null;

      const imageUrl = variant.product.images[0]?.url ?? null;

      return {
        productId: variant.product.id,
        variantId: variant.id,
        sellerId: variant.product.sellerId,
        productName: variant.product.name,
        variantName,
        imageUrl,
        sku: variant.sku,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      };
    });

    const serverSubtotal = itemsWithPrice.reduce((s, i) => s + i.lineTotal, 0);

    const serverShipping =
      serverSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

    // ═══ 4. تجميع حسب البائع ═══
    const itemsBySeller = new Map<number, typeof itemsWithPrice>();
    for (const item of itemsWithPrice) {
      if (!itemsBySeller.has(item.sellerId)) {
        itemsBySeller.set(item.sellerId, []);
      }
      itemsBySeller.get(item.sellerId)!.push(item);
    }

    // ═══ 5. جلب بيانات التجار ═══
    const sellerIds = Array.from(itemsBySeller.keys());
    const sellersData = await prisma.seller.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, userId: true, storeName: true },
    });
    const sellerMap = new Map(sellersData.map((s) => [s.id, s]));

    // ═══ 6. توزيع الشحن (Largest Remainder) ═══
    const shippingBySeller = new Map<number, number>();

    if (serverShipping > 0 && serverSubtotal > 0) {
      type Share = {
        sellerId: number;
        amountCents: number;
        remainder: number;
      };
      const shares: Share[] = [];
      let sumFloors = 0;

      for (const [sellerId, items] of itemsBySeller) {
        const sellerSubtotal = items.reduce((s, i) => s + i.lineTotal, 0);
        const ratio = sellerSubtotal / serverSubtotal;
        const exactCents = serverShipping * ratio * 100;
        const floorCents = Math.floor(exactCents);
        const remainder = exactCents - floorCents;

        shares.push({ sellerId, amountCents: floorCents, remainder });
        sumFloors += floorCents;
      }

      const totalCents = Math.round(serverShipping * 100);
      let leftoverCents = totalCents - sumFloors;

      shares.sort((a, b) => b.remainder - a.remainder);

      let i = 0;
      while (leftoverCents > 0) {
        shares[i % shares.length].amountCents += 1;
        leftoverCents -= 1;
        i++;
      }

      for (const s of shares) {
        shippingBySeller.set(s.sellerId, s.amountCents / 100);
      }
    } else {
      for (const sellerId of itemsBySeller.keys()) {
        shippingBySeller.set(sellerId, 0);
      }
    }

    // ═══ 7. تحديد طلب الكوبون (الأكبر) ═══
    let couponOrderSellerId: number | null = null;
    if (data.couponCode?.trim()) {
      let maxSubtotal = 0;
      for (const [sellerId, items] of itemsBySeller) {
        const sellerSubtotal = items.reduce((s, i) => s + i.lineTotal, 0);
        if (sellerSubtotal > maxSubtotal) {
          maxSubtotal = sellerSubtotal;
          couponOrderSellerId = sellerId;
        }
      }
    }

    const couponCode = data.couponCode?.trim();

    // ═══ 8. Transaction ═══
    type CreatedOrder = {
      id: number;
      orderNumber: string;
      userId: number;
      sellerId: number;
      sellerUserId: number | null;
      sellerName: string | null;
      subtotal: number;
      shippingCost: number;
      total: number;
      itemsCount: number;
    };

    const createdOrders = await prisma.$transaction(
      async (tx) => {
        const results: CreatedOrder[] = [];

        // ═══ قفل الكوبون + التحقق داخل tx ═══
        let couponLock: { couponId: number; discount: number } | null = null;
        if (couponCode) {
          couponLock = await CouponService.lockAndValidateInTransaction(
            tx,
            couponCode,
            userId,
            serverSubtotal
          );
        }

        for (const [sellerId, items] of itemsBySeller) {
          const sellerSubtotal = items.reduce((s, i) => s + i.lineTotal, 0);
          const sellerShipping = shippingBySeller.get(sellerId) ?? 0;
          const isCouponOrder = sellerId === couponOrderSellerId;

          const beforeDiscount = sellerSubtotal + sellerShipping;
          const requestedDiscount =
            isCouponOrder && couponLock ? couponLock.discount : 0;
          const appliedDiscount = Math.min(requestedDiscount, beforeDiscount);
          const sellerTotal =
            Math.round((beforeDiscount - appliedDiscount) * 100) / 100;

          const orderNumber = await this.generateOrderNumber(tx);

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
              discount: appliedDiscount,
              total: sellerTotal,
              shippingAddressSnapshot: data.address,
              customerSnapshot: data.customer,
              items: {
                create: items.map((item) => ({
                  productId: item.productId,
                  variantId: item.variantId,
                  productName: item.productName,
                  variantName: item.variantName,
                  imageUrl: item.imageUrl,
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

          // ═══ 💰 خصم المخزون مباشرة (COD = Sale فوري) ═══
          const sortedItems = [...items].sort(
            (a, b) => a.variantId - b.variantId
          );

          for (const item of sortedItems) {
            await InventoryService.saleDirect(
              tx,
              item.variantId,
              item.quantity,
              order.id
            );
          }

          // ═══ تسجيل استخدام الكوبون داخل tx ═══
          if (isCouponOrder && couponLock && appliedDiscount > 0) {
            await CouponService.recordUsageInTransaction(
              tx,
              couponLock.couponId,
              userId,
              order.id,
              appliedDiscount
            );
          }

          const seller = sellerMap.get(sellerId);
          results.push({
            id: order.id,
            orderNumber,
            userId,
            sellerId,
            sellerUserId: seller?.userId ?? null,
            sellerName: seller?.storeName ?? null,
            subtotal: sellerSubtotal,
            shippingCost: sellerShipping,
            total: sellerTotal,
            itemsCount: items.length,
          });
        }

        return results;
      },
      { timeout: TRANSACTION_TIMEOUT_MS }
    );

    // ═══ 9. الإشعارات (خارج tx) ═══
    try {
      await this.sendOrderNotifications(createdOrders);
    } catch (notifErr) {
      console.error("Notifications failed:", notifErr);
    }

    return createdOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      sellerId: o.sellerId,
      subtotal: o.subtotal,
      shippingCost: o.shippingCost,
      total: o.total,
    }));
  },

  async sendOrderNotifications(orders: any[]): Promise<void> {
    if (orders.length === 0) return;

    const adminIds = (
      await prisma.user.findMany({
        where: {
          role: { in: ["ADMIN", "SUPER_ADMIN"] },
          deletedAt: null,
        },
        select: { id: true },
      })
    ).map((a) => a.id);

    const notifications: any[] = [];

    for (const o of orders) {
      notifications.push({
        userId: o.userId,
        type: "ORDER_CREATED",
        title: "تم استلام طلبك",
        message: `طلبك ${o.orderNumber} قيد المراجعة. سنتواصل معك قريباً.`,
        link: `/orders/${o.id}`,
      });

      if (o.sellerUserId) {
        notifications.push({
          userId: o.sellerUserId,
          type: "SELLER_ORDER_RECEIVED",
          title: "طلب جديد 🎉",
          message: `وصلك طلب جديد ${o.orderNumber}`,
          link: `/seller/orders/${o.id}`,
          category: "ORDER",
          severity: "INFO",
          metadata: {
            orderId: o.id,
            orderNumber: o.orderNumber,
            sellerId: o.sellerId,
          },
        });
      }

      for (const adminId of adminIds) {
        notifications.push({
          userId: adminId,
          type: "ORDER_CREATED",
          title: "🛒 طلب جديد",
          message: `طلب جديد ${o.orderNumber} — من "${o.sellerName || "تاجر"}" بقيمة ${o.total} د.م`,
          link: `/admin/orders/${o.id}`,
          category: "ORDER",
          severity: "INFO",
          metadata: {
            orderId: o.id,
            orderNumber: o.orderNumber,
            sellerId: o.sellerId,
            sellerName: o.sellerName,
            total: o.total,
            itemsCount: o.itemsCount,
          },
        });
      }
    }

    if (notifications.length > 0) {
      await prisma.notification.createMany({ data: notifications });
    }
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