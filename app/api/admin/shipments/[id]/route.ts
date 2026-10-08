import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { PermissionService, PERMISSIONS } from "@/services/permission.service";
import { AuditService } from "@/services/audit.service";

// ═══════ Helpers ═══════
async function requirePermission(
  userId: number,
  permissionKey: string
): Promise<boolean> {
  return PermissionService.hasPermission(userId, permissionKey);
}

// ═══════ GET — تفاصيل شحنة ═══════
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    const canView = await requirePermission(
      current.user.id,
      PERMISSIONS.VIEW_CONSOLIDATED_ORDERS
    );
    if (!canView) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
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

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        items: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                source: true,
                customerSnapshot: true,
                shippingAddressSnapshot: true,
              },
            },
            orderItem: {
              select: {
                id: true,
                productName: true,
                variantName: true,
                sku: true,
                imageUrl: true,
                quantity: true,
                unitPrice: true,
              },
            },
          },
        },
        deliveryPerson: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, message: "الشحنة غير موجودة" },
        { status: 404 }
      );
    }

    // ═══ تجميع العناصر حسب الطلب ═══
    const itemsByOrder = new Map<number, any>();
    for (const item of shipment.items) {
      const orderId = item.orderId;
      if (!itemsByOrder.has(orderId)) {
        itemsByOrder.set(orderId, {
          orderId,
          orderNumber: item.order.orderNumber,
          orderStatus: item.order.status,
          orderSource: item.order.source,
          customerSnapshot: item.order.customerSnapshot,
          shippingAddressSnapshot: item.order.shippingAddressSnapshot,
          items: [],
        });
      }
      itemsByOrder.get(orderId).items.push({
        id: item.id,
        orderItemId: item.orderItemId,
        productName: item.orderItem.productName,
        variantName: item.orderItem.variantName,
        sku: item.orderItem.sku,
        imageUrl: item.orderItem.imageUrl,
        quantity: item.quantity,
        codAmount: Number(item.codAmount),
      });
    }

    return NextResponse.json({
      success: true,
      shipment: {
        id: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        status: shipment.status,
        qrTokenPreview: shipment.qrTokenPreview,
        qrTokenRevokedAt: shipment.qrTokenRevokedAt,
        totalCOD: Number(shipment.totalCOD),
        totalOrders: shipment.totalOrders,
        notes: shipment.notes,
        createdAt: shipment.createdAt,
        assignedAt: shipment.assignedAt,
        customer: shipment.customer,
        deliveryPerson: shipment.deliveryPerson
          ? {
              id: shipment.deliveryPerson.id,
              name: shipment.deliveryPerson.user.name,
              phone: shipment.deliveryPerson.user.phone,
            }
          : null,
        orders: Array.from(itemsByOrder.values()),
      },
    });
  } catch (error) {
    console.error("Shipment GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ PATCH — تحديث الشحنة (Status / Assign / Notes) ═══════
const patchSchema = z.object({
  status: z
    .enum([
      "DRAFT",
      "READY",
      "ASSIGNED",
      "IN_TRANSIT",
      "DELIVERED",
      "PARTIALLY_DELIVERED",
      "POSTPONED",
      "REFUSED",
      "RETURNED",
      "CANCELLED",
    ])
    .optional(),
  deliveryPersonId: z.number().int().positive().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
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

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

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

    // ═══ الشحنة الحالية ═══
    const existing = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "الشحنة غير موجودة" },
        { status: 404 }
      );
    }

    const updates: any = {};

    // ═══ تغيير الحالة ═══
    if (data.status !== undefined) {
      const canChange = await requirePermission(
        current.user.id,
        PERMISSIONS.MANAGE_SHIPMENT_ITEMS
      );
      if (!canChange) {
        return NextResponse.json(
          { success: false, message: "غير مصرح بتغيير الحالة" },
          { status: 403 }
        );
      }

      // لا نسمح بتعديل شحنة مُسلَّمة/ملغاة
      if (["DELIVERED", "CANCELLED", "RETURNED"].includes(existing.status)) {
        return NextResponse.json(
          {
            success: false,
            message: `لا يمكن تعديل شحنة بحالة ${existing.status}`,
          },
          { status: 400 }
        );
      }

      updates.status = data.status;
    }

    // ═══ إسناد سائق ═══
    if (data.deliveryPersonId !== undefined) {
      const canAssign = await requirePermission(
        current.user.id,
        PERMISSIONS.ASSIGN_DELIVERY
      );
      if (!canAssign) {
        return NextResponse.json(
          { success: false, message: "غير مصرح بإسناد السائق" },
          { status: 403 }
        );
      }

      if (data.deliveryPersonId === null) {
        // إلغاء الإسناد
        updates.deliveryPersonId = null;
        updates.assignedAt = null;
        updates.assignedById = null;
      } else {
        // تحقق من السائق
        const person = await prisma.deliveryPerson.findUnique({
          where: { id: data.deliveryPersonId },
        });

        if (!person || person.deletedAt || person.status !== "ACTIVE") {
          return NextResponse.json(
            { success: false, message: "السائق غير نشط" },
            { status: 400 }
          );
        }

        updates.deliveryPersonId = data.deliveryPersonId;
        updates.assignedAt = new Date();
        updates.assignedById = current.user.id;

        // إن كانت الشحنة DRAFT/READY → ASSIGNED
        if (
          data.status === undefined &&
          (existing.status === "DRAFT" || existing.status === "READY")
        ) {
          updates.status = "ASSIGNED";
        }
      }
    }

    // ═══ ملاحظات ═══
    if (data.notes !== undefined) {
      updates.notes = data.notes || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد تغييرات" },
        { status: 400 }
      );
    }

    // ═══ Transaction ═══
    const reqInfo = AuditService.getRequestInfo(request);

    const updated = await prisma.$transaction(
      async (tx) => {
        const result = await tx.shipment.update({
          where: { id: shipmentId },
          data: updates,
        });

        // ═══ Audit Log ═══
        await AuditService.logInTransaction(tx, {
          userId: current.user.id,
          action: data.deliveryPersonId !== undefined
            ? "DELIVERY_ASSIGN"
            : "SHIPMENT_UPDATE",
          entity: "Shipment",
          entityId: shipmentId,
          oldData: {
            status: existing.status,
            deliveryPersonId: existing.deliveryPersonId,
          },
          newData: updates,
          ipAddress: reqInfo.ipAddress,
          userAgent: reqInfo.userAgent,
        });

        return result;
      },
      { timeout: 15000 }
    );

    return NextResponse.json({
      success: true,
      shipment: {
        id: updated.id,
        shipmentNumber: updated.shipmentNumber,
        status: updated.status,
        deliveryPersonId: updated.deliveryPersonId,
      },
    });
  } catch (error) {
    console.error("Shipment PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ DELETE — إلغاء شحنة (DRAFT فقط) ═══════
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    const canManage = await requirePermission(
      current.user.id,
      PERMISSIONS.MANAGE_SHIPMENT_ITEMS
    );
    if (!canManage) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const shipmentId = parseInt(id);

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      return NextResponse.json(
        { success: false, message: "الشحنة غير موجودة" },
        { status: 404 }
      );
    }

    // ═══ فقط DRAFT يمكن حذفها ═══
    if (shipment.status !== "DRAFT") {
      return NextResponse.json(
        {
          success: false,
          message: "لا يمكن حذف شحنة بعد تجهيزها. يمكنك إلغاؤها فقط.",
        },
        { status: 400 }
      );
    }

    const reqInfo = AuditService.getRequestInfo(request);

    await prisma.$transaction(async (tx) => {
      // حذف الـitems أولاً (cascade موجود لكن صريح أفضل)
      await tx.shipmentItem.deleteMany({
        where: { shipmentId },
      });

      // حذف الشحنة
      await tx.shipment.delete({
        where: { id: shipmentId },
      });

      // Audit
      await AuditService.logInTransaction(tx, {
        userId: current.user.id,
        action: "DELETE",
        entity: "Shipment",
        entityId: shipmentId,
        oldData: {
          shipmentNumber: shipment.shipmentNumber,
          status: shipment.status,
        },
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Shipment DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}