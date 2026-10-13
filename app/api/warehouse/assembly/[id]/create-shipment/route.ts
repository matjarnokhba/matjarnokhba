import { NextResponse } from "next/server";
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

    // ═══ Recompute first ═══
    await prisma.$transaction(async (tx) => {
      await AssemblyService.recompute(tx, assemblyId);
    });

    const assembly = await prisma.assemblyFile.findUnique({
      where: { id: assemblyId },
      include: {
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

    if (assembly.status !== "READY") {
      return NextResponse.json(
        {
          success: false,
          message:
            assembly.status === "PENDING"
              ? `لم تكتمل المنتجات — ${assembly.receivedItems}/${assembly.expectedItems}`
              : `لا يمكن إنشاء الشحنة — الحالة: ${assembly.status}`,
        },
        { status: 400 }
      );
    }

    const validItems = assembly.items.filter(
      (ai) =>
        ai.fulfillmentItem.status === "VERIFIED" ||
        ai.fulfillmentItem.status === "AVAILABLE_FOR_SHIPMENT"
    );

    if (validItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد عناصر جاهزة للشحن" },
        { status: 400 }
      );
    }

    const totalCOD = validItems.reduce(
      (s, ai) => s + Number(ai.fulfillmentItem.orderItem.total),
      0
    );

    const result = await prisma.$transaction(async (tx) => {
      // ═══ 1. رقم الشحنة ═══
      const year = new Date().getFullYear();
      const count = await tx.shipment.count({
        where: { shipmentNumber: { startsWith: `SHP-${year}-` } },
      });
      const shipmentNumber = `SHP-${year}-${String(count + 1).padStart(5, "0")}`;

      // ═══ 2. QR ═══
      const rawToken = ShipmentQRService.generateToken();
      const tokenHash = ShipmentQRService.hashToken(rawToken);
      const encrypted = ShipmentQRService.encryptToken(rawToken);
      const preview = ShipmentQRService.preview(rawToken);

      // ═══ 3. Shipment ═══
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
          totalOrders: 1,
        },
      });

      // ═══ 4. ShipmentItems + FulfillmentItem → ALLOCATED ═══
      for (const ai of validItems) {
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
            note: `مُخصص للشحنة ${shipmentNumber}`,
          },
        });

        // ═══ 5. Mark in assembly ═══
        await AssemblyService.markItemShipped(tx, fi.id, shipment.id);
      }

      // ═══ 6. Recompute assembly ═══
      await AssemblyService.recompute(tx, assemblyId);

      // ═══ 7. Audit ═══
      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "SHIPMENT_CREATE",
        entity: "Shipment",
        entityId: String(shipment.id),
        newData: {
          shipmentNumber,
          assemblyCode: assembly.assemblyCode,
          itemsCount: validItems.length,
          totalCOD,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });

      return {
        shipmentId: shipment.id,
        shipmentNumber,
        itemsCount: validItems.length,
        totalCOD,
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