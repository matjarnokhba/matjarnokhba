import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { PermissionService, PERMISSIONS } from "@/services/permission.service";
import { AuditService } from "@/services/audit.service";
import { ShipmentService } from "@/services/shipment.service";

// ═══════ Schema ═══════
const createSchema = z.object({
  fulfillmentItemIds: z
    .array(z.number().int().positive())
    .min(1, "اختر عنصراً واحداً على الأقل")
    .max(100, "الحد الأقصى 100 عنصر"),
  notes: z.string().trim().max(500).optional().nullable(),
});

// ═══════ GET — قائمة الشحنات ═══════
export async function GET(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    const canView = await PermissionService.hasPermission(
      current.user.id,
      PERMISSIONS.VIEW_CONSOLIDATED_ORDERS
    );
    if (!canView) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "ALL";

    const where: any = {};
    if (status !== "ALL") where.status = status;

    const shipments = await prisma.shipment.findMany({
      where,
      include: {
        deliveryPerson: {
          include: {
            user: { select: { name: true, phone: true } },
          },
        },
        customer: {
          select: { id: true, name: true, phone: true },
        },
        items: {
          select: { orderId: true, quantity: true },
        },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const formatted = shipments.map((s) => ({
      id: s.id,
      shipmentNumber: s.shipmentNumber,
      status: s.status,
      totalCOD: Number(s.totalCOD),
      totalOrders: s.totalOrders,
      totalItems: s._count.items,
      customer: s.customer
        ? {
            id: s.customer.id,
            name: s.customer.name,
            phone: s.customer.phone,
          }
        : null,
      deliveryPerson: s.deliveryPerson
        ? {
            name: s.deliveryPerson.user.name,
            phone: s.deliveryPerson.user.phone,
          }
        : null,
      createdAt: s.createdAt,
      assignedAt: s.assignedAt,
    }));

    return NextResponse.json({ success: true, shipments: formatted });
  } catch (error) {
    console.error("Shipments GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ POST — إنشاء شحنة من FulfillmentItems ═══════
export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    const canCreate = await PermissionService.hasPermission(
      current.user.id,
      PERMISSIONS.CREATE_SHIPMENT
    );
    if (!canCreate) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // ═══ ShipmentService يتولى كل الـValidation ═══
    const result = await ShipmentService.createFromFulfillmentItems({
      fulfillmentItemIds: data.fulfillmentItemIds,
      createdById: current.user.id,
      notes: data.notes || null,
    });

    // ═══ Audit مع معلومات الطلب ═══
    const reqInfo = AuditService.getRequestInfo(request);
    await AuditService.log({
      userId: current.user.id,
      action: "SHIPMENT_CREATE",
      entity: "Shipment",
      entityId: result.shipment.id,
      newData: {
        shipmentNumber: result.shipment.shipmentNumber,
        totalCOD: Number(result.shipment.totalCOD),
        totalOrders: result.shipment.totalOrders,
        itemsCount: data.fulfillmentItemIds.length,
      },
      ipAddress: reqInfo.ipAddress,
      userAgent: reqInfo.userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        shipment: {
          id: result.shipment.id,
          shipmentNumber: result.shipment.shipmentNumber,
          rawToken: result.rawToken,
          totalCOD: Number(result.shipment.totalCOD),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Shipment POST error:", error);
    const message =
      error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}