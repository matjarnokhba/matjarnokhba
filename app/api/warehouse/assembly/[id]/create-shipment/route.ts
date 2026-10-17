import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { ShipmentQRService } from "@/services/shipment-qr.service";
import { AssemblyService } from "@/services/assembly.service";
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
  allowPartial: z.boolean().default(false),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function POST(
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
    const assemblyId = parseInt(id);
    if (isNaN(assemblyId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

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

    const { allowPartial, notes } = parsed.data;

    await prisma.$transaction(async (tx) => {
      await AssemblyService.recompute(tx, assemblyId);
    });

    const assembly: any = await prisma.assemblyFile.findUnique({
      where: { id: assemblyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        items: {
          include: {
            fulfillmentItem: {
              select: {
                id: true,
                status: true,
                sellerId: true,
                quantity: true,
                orderItem: {
                  select: {
                    id: true,
                    orderId: true,
                    variantId: true,
                    productId: true,
                    total: true,
                    sellerId: true,
                    order: {
                      select: {
                        id: true,
                        orderNumber: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!assembly) {
      return NextResponse.json(
        { success: false, message: "ملف التجميع غير موجود" },
        { status: 404 }
      );
    }

    if (assembly.status === "COMPLETED") {
      return NextResponse.json(
        { success: false, message: "كل المنتجات تم شحنها بالفعل" },
        { status: 400 }
      );
    }

    const canShipFull = assembly.status === "READY";
    const canShipPartial =
      allowPartial &&
      (assembly.status === "PENDING" ||
        assembly.status === "PARTIALLY_SHIPPED");

    if (!canShipFull && !canShipPartial) {
      return NextResponse.json(
        {
          success: false,
          message:
            assembly.status === "PENDING"
              ? `لم تكتمل المنتجات — ${assembly.receivedItems}/${assembly.expectedItems}. فعّل "الشحن الجزئي" للمتابعة.`
              : `لا يمكن إنشاء الشحنة — الحالة: ${assembly.status}`,
        },
        { status: 400 }
      );
    }

    const shippableItems = (assembly.items as any[]).filter(
      (ai: any) =>
        !ai.includedInShipment &&
        (ai.fulfillmentItem.status === "VERIFIED" ||
          ai.fulfillmentItem.status === "AVAILABLE_FOR_SHIPMENT")
    );

    if (shippableItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد عناصر جاهزة للشحن" },
        { status: 400 }
      );
    }

    const waitingItems = (assembly.items as any[]).filter(
      (ai: any) => !ai.includedInShipment && !ai.receivedAt
    );

    const isPartial = waitingItems.length > 0;

    // ═══ الطلبات الفريدة داخل الشحنة ═══
    const uniqueOrderIds = Array.from(
      new Set(
        shippableItems.map((ai: any) => ai.fulfillmentItem.orderItem.orderId)
      )
    );

    const totalCOD = shippableItems.reduce(
      (s: number, ai: any) => s + Number(ai.fulfillmentItem.orderItem.total),
      0
    );

    const result = await prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const count = await tx.shipment.count({
        where: { shipmentNumber: { startsWith: `SHP-${year}-` } },
      });
      const shipmentNumber = `SHP-${year}-${String(count + 1).padStart(5, "0")}`;

      const rawToken = ShipmentQRService.generateToken();
      const tokenHash = ShipmentQRService.hashToken(rawToken);
      const encrypted = ShipmentQRService.encryptToken(rawToken);
      const preview = ShipmentQRService.preview(rawToken);

      const shipment = await tx.shipment.create({
        data: {
          shipmentNumber,
          qrTokenHash: tokenHash,
          qrTokenEncrypted: encrypted,
          qrTokenPreview: preview,
          status: "READY",
          createdById: auth.user.id,
          customerId: assembly.userId,
          totalCOD,
          totalOrders: uniqueOrderIds.length, // ← عدد الطلبات الفعلية
          notes: notes || null,
        },
      });

      for (const ai of shippableItems) {
        const fi = ai.fulfillmentItem;

        await tx.shipmentItem.create({
          data: {
            shipmentId: shipment.id,
            orderId: fi.orderItem.orderId,
            orderItemId: fi.orderItem.id,
            fulfillmentItemId: fi.id,
            productId: fi.orderItem.productId,
            variantId: fi.orderItem.variantId,
            sellerId: fi.sellerId,
            quantity: fi.quantity,
            codAmount: fi.orderItem.total,
          },
        });

        await tx.fulfillmentItem.update({
          where: { id: fi.id },
          data: { status: "ALLOCATED" },
        });

        await tx.fulfillmentStatusHistory.create({
          data: {
            fulfillmentItemId: fi.id,
            fromStatus: fi.status as any,
            toStatus: "ALLOCATED",
            changedById: auth.user.id,
            note: isPartial
              ? `شحن جزئي — الشحنة ${shipmentNumber}`
              : `مُخصص للشحنة ${shipmentNumber}`,
          },
        });

        await AssemblyService.markItemShipped(tx, fi.id, shipment.id);
      }

      await AssemblyService.recompute(tx, assemblyId);

      if (isPartial) {
        const remainingCount =
          assembly.expectedItems - assembly.receivedItems;

        await tx.notification.create({
          data: {
            userId: assembly.userId,
            type: "SHIPPING_UPDATED",
            title: "📦 تم شحن جزء من طلباتك",
            message: `تم شحن ${shippableItems.length} منتج من ${uniqueOrderIds.length} طلب. بانتظار ${remainingCount} منتج إضافي.`,
            link: `/orders`,
            category: "ORDER",
            severity: "INFO",
          },
        });
      }

      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "SHIPMENT_CREATE",
        entity: "Shipment",
        entityId: String(shipment.id),
        newData: {
          shipmentNumber,
          assemblyCode: assembly.assemblyCode,
          itemsCount: shippableItems.length,
          ordersCount: uniqueOrderIds.length,
          totalCOD,
          isPartial,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });

      return {
        shipmentId: shipment.id,
        shipmentNumber,
        itemsCount: shippableItems.length,
        ordersCount: uniqueOrderIds.length,
        totalCOD,
        isPartial,
        waitingItems: waitingItems.length,
      };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Assembly create shipment error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}