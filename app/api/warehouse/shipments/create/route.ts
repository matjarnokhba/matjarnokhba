import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { ShipmentQRService } from "@/services/shipment-qr.service";
import { AuditService } from "@/services/audit.service";

async function requireWarehouse() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const allowed = ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }

  return { user: current.user };
}

const schema = z.object({
  fulfillmentItemIds: z
    .array(z.number().int().positive())
    .min(1, "اختر عنصرًا واحدًا على الأقل")
    .max(200, "الحد الأقصى 200 عنصر"),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireWarehouse();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const { fulfillmentItemIds, notes } = parsed.data;

    // ═══ جلب العناصر ═══
    const items = await prisma.fulfillmentItem.findMany({
      where: { id: { in: fulfillmentItemIds } },
      include: {
        orderItem: {
          select: {
            id: true,
            orderId: true,
            variantId: true,
            productId: true,
            quantity: true,
            total: true,
            sellerId: true,
            order: {
              select: {
                id: true,
                userId: true,
                total: true,
              },
            },
          },
        },
      },
    });

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد عناصر صالحة" },
        { status: 400 }
      );
    }

    if (items.length !== fulfillmentItemIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: `${fulfillmentItemIds.length - items.length} عنصر غير موجود`,
        },
        { status: 400 }
      );
    }

    // ═══ تحقق: كل العناصر VERIFIED / AVAILABLE ═══
    const notReady = items.filter(
      (i) =>
        i.status !== "VERIFIED" && i.status !== "AVAILABLE_FOR_SHIPMENT"
    );

    if (notReady.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `${notReady.length} عنصر ليس جاهزًا للشحن`,
        },
        { status: 400 }
      );
    }

    // ═══ تحقق: كل العناصر لنفس العميل ═══
    const userIds = Array.from(
      new Set(items.map((i) => i.orderItem.order.userId))
    );

    if (userIds.length > 1) {
      return NextResponse.json(
        {
          success: false,
          message: "لا يمكن تجميع طلبات من عملاء مختلفين في شحنة واحدة",
        },
        { status: 400 }
      );
    }

    const customerId = userIds[0];

    // ═══ Transaction ═══
    const result = await prisma.$transaction(async (tx) => {
      // 1. رقم الشحنة
      const year = new Date().getFullYear();
      const count = await tx.shipment.count({
        where: { shipmentNumber: { startsWith: `SHP-${year}-` } },
      });
      const shipmentNumber = `SHP-${year}-${String(count + 1).padStart(5, "0")}`;

      // 2. حساب totalCOD
      const totalCOD = items.reduce(
        (s, i) => s + Number(i.orderItem.total),
        0
      );

      // 3. QR Token
      const rawToken = ShipmentQRService.generateToken();
      const tokenHash = ShipmentQRService.hashToken(rawToken);
      const encrypted = ShipmentQRService.encryptToken(rawToken);
      const preview = ShipmentQRService.preview(rawToken);

      // 4. إنشاء Shipment
      const shipment = await tx.shipment.create({
        data: {
          shipmentNumber,
          qrTokenHash: tokenHash,
          qrTokenEncrypted: encrypted,
          qrTokenPreview: preview,
          status: "READY",
          createdById: auth.user.id,
          customerId,
          totalCOD,
          totalOrders: new Set(items.map((i) => i.orderItem.orderId)).size,
          notes: notes || null,
        },
      });

      // 5. إنشاء ShipmentItems
      for (const item of items) {
        await tx.shipmentItem.create({
          data: {
            shipmentId: shipment.id,
            orderId: item.orderItem.orderId,
            orderItemId: item.orderItem.id,
            fulfillmentItemId: item.id,
            productId: item.orderItem.productId,
            variantId: item.orderItem.variantId,
            sellerId: item.sellerId,
            quantity: item.quantity,
            codAmount: item.orderItem.total,
          },
        });

        // 6. تحديث FulfillmentItem → ALLOCATED
        await tx.fulfillmentItem.update({
          where: { id: item.id },
          data: { status: "ALLOCATED" },
        });

        await tx.fulfillmentStatusHistory.create({
          data: {
            fulfillmentItemId: item.id,
            fromStatus: item.status as any,
            toStatus: "ALLOCATED",
            changedById: auth.user.id,
            note: `مُخصص للشحنة ${shipmentNumber}`,
          },
        });
      }

      // 7. Audit
      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "SHIPMENT_CREATE",
        entity: "Shipment",
        entityId: String(shipment.id),
        newData: {
          shipmentNumber,
          itemsCount: items.length,
          totalCOD,
          ordersCount: new Set(items.map((i) => i.orderItem.orderId)).size,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });

      return {
        shipmentId: shipment.id,
        shipmentNumber,
        itemsCount: items.length,
        totalCOD,
        rawToken,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Create shipment error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}