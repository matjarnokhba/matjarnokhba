import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
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
  orderId: z.number().int().positive().optional(),
  token: z.string().min(20).optional(),
}).refine((d) => d.orderId || d.token, {
  message: "orderId أو token مطلوب",
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

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const { orderId: inputOrderId, token } = parsed.data;

    // ═══ Assembly ═══
    const assembly = await prisma.assemblyFile.findUnique({
      where: { id: assemblyId },
      select: { userId: true },
    });

    if (!assembly) {
      return NextResponse.json(
        { success: false, message: "ملف التجميع غير موجود" },
        { status: 404 }
      );
    }

    // ═══ البحث عن الطلب ═══
    let order;
    if (inputOrderId) {
      order = await prisma.order.findFirst({
        where: { id: inputOrderId, userId: assembly.userId },
        include: {
          items: {
            select: { fulfillmentItems: { select: { status: true } } },
          },
        },
      });
    } else if (token) {
      order = await prisma.order.findFirst({
        where: { deliveryToken: token, userId: assembly.userId },
        include: {
          items: {
            select: { fulfillmentItems: { select: { status: true } } },
          },
        },
      });
    }

    if (!order) {
      return NextResponse.json(
        { success: false, message: "الطلب غير موجود أو لا يخص هذا العميل" },
        { status: 404 }
      );
    }

    // ═══ هل الطلب موجود فعلاً في المستودع؟ ═══
    const allItems = order.items.flatMap((i) => i.fulfillmentItems);
    const hasInWarehouse = allItems.some(
      (fi) =>
        fi.status === "VERIFIED" ||
        fi.status === "RECEIVED" ||
        fi.status === "AVAILABLE_FOR_SHIPMENT"
    );

    if (!hasInWarehouse) {
      return NextResponse.json(
        {
          success: false,
          message: `الطلب ${order.orderNumber} ليس في المستودع بعد`,
        },
        { status: 400 }
      );
    }

    // ═══ Idempotent ═══
    if (order.warehouseScannedAt) {
      const readiness = await prisma.$transaction(async (tx) => {
        return AssemblyService.checkScanReadiness(tx, assemblyId);
      });
      return NextResponse.json({
        success: true,
        alreadyScanned: true,
        orderNumber: order.orderNumber,
        orderId: order.id,
        readiness,
      });
    }

    // ═══ تحديث ═══
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          warehouseScannedAt: new Date(),
          warehouseScannedById: auth.user.id,
        },
      });

      const reqInfo = AuditService.getRequestInfo(request);
      await AuditService.logInTransaction(tx, {
        userId: auth.user.id,
        action: "QR_SCAN",
        entity: "Order",
        entityId: String(order.id),
        newData: {
          orderNumber: order.orderNumber,
          assemblyId,
          action: "warehouse_scan",
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });
    });

    const readiness = await prisma.$transaction(async (tx) => {
      return AssemblyService.checkScanReadiness(tx, assemblyId);
    });

    return NextResponse.json({
      success: true,
      alreadyScanned: false,
      orderNumber: order.orderNumber,
      orderId: order.id,
      readiness,
    });
  } catch (error) {
    console.error("Scan order error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}