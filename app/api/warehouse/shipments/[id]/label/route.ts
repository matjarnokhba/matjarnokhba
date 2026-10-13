import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { ShipmentQRService } from "@/services/shipment-qr.service";

async function requireWarehouse() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  const allowed = ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireWarehouse();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const shipmentId = parseInt(id);
    if (isNaN(shipmentId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    // ═══ Shipment + items + order data ═══
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        items: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                shippingAddressSnapshot: true,
                customerSnapshot: true,
              },
            },
          },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, message: "الشحنة غير موجودة" },
        { status: 404 }
      );
    }

    // ═══ جلب أسماء التجار (sellerId على ShipmentItem) ═══
    const sellerIds = Array.from(
      new Set(shipment.items.map((i) => i.sellerId))
    );
    const sellers = await prisma.seller.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, storeName: true, city: true },
    });
    const sellerMap = new Map(sellers.map((s) => [s.id, s]));

    // ═══ جلب بيانات العميل ═══
    let customer: { name: string; phone: string | null } | null = null;
    if (shipment.customerId) {
      const user = await prisma.user.findUnique({
        where: { id: shipment.customerId },
        select: { name: true, phone: true },
      });
      if (user) customer = { name: user.name, phone: user.phone };
    }

    // ═══ استخراج العنوان من أول طلب ═══
    const firstItem = shipment.items[0];
    const address = (firstItem?.order?.shippingAddressSnapshot || {}) as any;
    const customerSnapshot = (firstItem?.order?.customerSnapshot || {}) as any;

    // ═══ raw token للـQR ═══
    let rawToken: string | null = null;
    if (!shipment.qrTokenRevokedAt) {
      rawToken = await ShipmentQRService.getRawToken(shipment.id);
    }

    // ═══ عدد الطرود = عدد orderIds المختلفة ═══
    const uniqueOrderIds = new Set(shipment.items.map((i) => i.orderId));

    // ═══ التجار الفريدون ═══
    const uniqueSellers: Array<{
      id: number;
      storeName: string;
      city: string | null;
    }> = [];
    const seenSellers = new Set<number>();
    for (const item of shipment.items) {
      if (seenSellers.has(item.sellerId)) continue;
      seenSellers.add(item.sellerId);
      const s = sellerMap.get(item.sellerId);
      if (s) uniqueSellers.push(s);
    }

    // ═══ Serialize ═══
    const serialized = JSON.parse(
      JSON.stringify(
        {
          id: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          status: shipment.status,
          totalCOD: shipment.totalCOD,
          totalOrders: shipment.totalOrders,
          itemsCount: shipment.items.length,
          createdAt: shipment.createdAt,

          // العميل
          customerName:
            address.fullName ||
            customerSnapshot.name ||
            customer?.name ||
            "—",
          customerPhone:
            address.phone ||
            customerSnapshot.phone ||
            customer?.phone ||
            null,

          // العنوان
          street: address.street || null,
          district: address.district || null,
          city: address.city || null,
          postalCode: address.postalCode || null,

          // عدد الطرود
          parcelCount: uniqueOrderIds.size,

          // التجار (للمرجع)
          sellers: uniqueSellers,

          // QR
          qrToken: rawToken,
          qrPreview: shipment.qrTokenPreview,
        },
        (_, v) => {
          if (typeof v === "bigint") return v.toString();
          if (
            v !== null &&
            typeof v === "object" &&
            typeof v.toNumber === "function" &&
            typeof v.toFixed === "function"
          ) {
            return v.toNumber();
          }
          return v;
        }
      )
    );

    return NextResponse.json({ success: true, label: serialized });
  } catch (error) {
    console.error("Label fetch error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}