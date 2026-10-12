import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireWarehouse() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const allowed = ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }

  return { user: current.user };
}

export async function GET() {
  try {
    const auth = await requireWarehouse();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    // ═══ جلب FulfillmentItems الجاهزة للشحن ═══
    const items = await prisma.fulfillmentItem.findMany({
      where: {
        status: { in: ["VERIFIED", "AVAILABLE_FOR_SHIPMENT"] },
      },
      include: {
        seller: {
          select: { id: true, storeName: true, city: true, region: true },
        },
        orderItem: {
          select: {
            id: true,
            productName: true,
            imageUrl: true,
            quantity: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                userId: true,
                customerSnapshot: true,
                shippingAddressSnapshot: true,
              },
            },
          },
        },
        shipmentItems: {
          select: { id: true, shipmentId: true },
        },
      },
      orderBy: [{ verifiedAt: "asc" }],
      take: 1000,
    });

    // ═══ جلب الشحنات النشطة (لتفادي تكرار الإسناد) ═══
    const activeShipmentItems = await prisma.shipmentItem.findMany({
      where: {
        shipment: {
          status: { in: ["DRAFT", "WAITING_FOR_ITEMS", "READY", "ASSIGNED"] },
        },
      },
      select: { fulfillmentItemId: true },
    });

    const inActiveShipment = new Set(
      activeShipmentItems
        .map((si) => si.fulfillmentItemId)
        .filter((id): id is number => id !== null)
    );

    // ═══ تجميع حسب (orderId + city + district) ═══
    const grouped = new Map<
      string,
      {
        groupKey: string;
        orderId: number;
        orderNumber: string;
        city: string | null;
        district: string | null;
        street: string | null;
        customerName: string;
        customerPhone: string | null;
        itemsCount: number;
        fulfillmentItemIds: number[];
        inActiveShipment: boolean;
        products: Array<{
          id: number;
          name: string;
          imageUrl: string | null;
          quantity: number;
        }>;
        seller: { storeName: string; city: string | null };
      }
    >();

    for (const item of items) {
      // تخطي ما هو بالفعل في شحنة نشطة
      if (inActiveShipment.has(item.id)) continue;

      const order = item.orderItem.order;
      const address = (order.shippingAddressSnapshot || {}) as any;

      const city = address.city || "غير محدد";
      const district = address.district || null;
      const groupKey = `${order.id}::${city}`;

      const existing = grouped.get(groupKey);

      if (!existing) {
        grouped.set(groupKey, {
          groupKey,
          orderId: order.id,
          orderNumber: order.orderNumber,
          city,
          district,
          street: address.street || null,
          customerName: address.fullName || "—",
          customerPhone: address.phone || null,
          itemsCount: item.quantity,
          fulfillmentItemIds: [item.id],
          inActiveShipment: false,
          products: [
            {
              id: item.orderItem.id,
              name: item.orderItem.productName,
              imageUrl: item.orderItem.imageUrl,
              quantity: item.orderItem.quantity,
            },
          ],
          seller: {
            storeName: item.seller.storeName,
            city: item.seller.city,
          },
        });
      } else {
        existing.itemsCount += item.quantity;
        existing.fulfillmentItemIds.push(item.id);
        existing.products.push({
          id: item.orderItem.id,
          name: item.orderItem.productName,
          imageUrl: item.orderItem.imageUrl,
          quantity: item.orderItem.quantity,
        });
      }
    }

    const ready = Array.from(grouped.values());

    // ═══ تجميع حسب المدينة ═══
    const byCity = new Map<string, typeof ready>();
    for (const item of ready) {
      const city = item.city || "غير محدد";
      if (!byCity.has(city)) byCity.set(city, []);
      byCity.get(city)!.push(item);
    }

    const cities = Array.from(byCity.entries()).map(([city, items]) => ({
      city,
      count: items.length,
      totalItems: items.reduce((s, i) => s + i.itemsCount, 0),
      totalFulfillmentItems: items.reduce(
        (s, i) => s + i.fulfillmentItemIds.length,
        0
      ),
    }));

    return NextResponse.json({
      success: true,
      ready,
      cities,
      totalReady: ready.length,
    });
  } catch (error) {
    console.error("Ready for shipment error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}