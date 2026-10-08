import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { PermissionService, PERMISSIONS } from "@/services/permission.service";
import { AuditService } from "@/services/audit.service";
import { ShipmentQRService } from "@/services/shipment-qr.service";
import { ShipmentService } from "@/services/shipment.service";

// ═══════ Schema ═══════
const createSchema = z.object({
  customerId: z.number().int().positive(),
  items: z
    .array(
      z.object({
        orderItemId: z.number().int().positive(),
        quantity: z.number().int().positive().max(1000),
      })
    )
    .min(1, "اختر عنصراً واحداً على الأقل"),
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
      totalItems: s.items.length,
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

// ═══════ POST — إنشاء شحنة جديدة ═══════
export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }

    // ═══ التحقق من الصلاحية ═══
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

    // ═══ التحقق من العميل ═══
    const customer = await prisma.user.findUnique({
      where: { id: data.customerId },
      select: { id: true, name: true },
    });
    if (!customer) {
      return NextResponse.json(
        { success: false, message: "العميل غير موجود" },
        { status: 404 }
      );
    }

    // ═══ جلب كل الـOrderItems المطلوبة ═══
    const orderItemIds = data.items.map((i) => i.orderItemId);
    const orderItems = await prisma.orderItem.findMany({
      where: {
        id: { in: orderItemIds },
      },
      include: {
        order: {
          select: {
            id: true,
            userId: true,
            status: true,
            source: true,
          },
        },
        product: { select: { sellerId: true } },
        shipmentItems: {
          select: { quantity: true },
        },
      },
    });

    if (orderItems.length !== orderItemIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "بعض العناصر غير موجودة",
        },
        { status: 400 }
      );
    }

    // ═══ التحقق: كل العناصر لعميل واحد ═══
    for (const item of orderItems) {
      if (item.order.userId !== data.customerId) {
        return NextResponse.json(
          {
            success: false,
            message: "كل العناصر يجب أن تكون لنفس العميل",
          },
          { status: 400 }
        );
      }

      // ═══ التحقق: الطلب قيد المعالجة ═══
      if (!["NEW", "PROCESSING", "SHIPPED"].includes(item.order.status)) {
        return NextResponse.json(
          {
            success: false,
            message: `طلب ${item.order.id} ليس في حالة قابلة للشحن`,
          },
          { status: 400 }
        );
      }
    }

    // ═══ التحقق: الكميات المتبقية ═══
    for (const reqItem of data.items) {
      const orderItem = orderItems.find((oi) => oi.id === reqItem.orderItemId);
      if (!orderItem) continue;

      const alreadyShipped = orderItem.shipmentItems.reduce(
        (sum, si) => sum + si.quantity,
        0
      );
      const remaining = orderItem.quantity - alreadyShipped;

      if (reqItem.quantity > remaining) {
        return NextResponse.json(
          {
            success: false,
            message: `الكمية المطلوبة من "${orderItem.productName}" تتجاوز المتبقي (${remaining})`,
          },
          { status: 400 }
        );
      }
    }

    // ═══ توليد Token وHash + تشفير للطباعة ═══
    const rawToken = ShipmentQRService.generateToken();
    const tokenHash = ShipmentQRService.hashToken(rawToken);
    const tokenEncrypted = ShipmentQRService.encryptToken(rawToken);
    const tokenPreview = ShipmentQRService.preview(rawToken);

    // ═══ رقم الشحنة ═══
    const shipmentNumber = await ShipmentService.generateShipmentNumber();

    // ═══ حساب إجماليات من DB (Server-Side) ═══
    // نسبة العنصر من Order.total
    const codByOrder = new Map<number, number>();

    for (const reqItem of data.items) {
      const orderItem = orderItems.find((oi) => oi.id === reqItem.orderItemId);
      if (!orderItem) continue;

      const order = await prisma.order.findUnique({
        where: { id: orderItem.orderId },
        select: {
          id: true,
          total: true,
          subtotal: true,
          discount: true,
          shippingCost: true,
          items: { select: { id: true, total: true } },
        },
      });
      if (!order) continue;

      // حساب نسبة هذا العنصر من إجمالي الطلب
      const orderItemsTotal = order.items.reduce(
        (s, i) => s + Number(i.total),
        0
      );
      const itemTotal = Number(orderItem.total);
      const itemRatio = orderItemsTotal > 0 ? itemTotal / orderItemsTotal : 0;

      const totalForThisItem = Number(order.total) * itemRatio;
      const perUnit = totalForThisItem / orderItem.quantity;
      const codForThis = perUnit * reqItem.quantity;

      codByOrder.set(
        order.id,
        (codByOrder.get(order.id) || 0) + codForThis
      );
    }

    const totalCOD = Array.from(codByOrder.values()).reduce(
      (s, v) => s + v,
      0
    );

    // ═══ عدد الطلبات الفريدة ═══
    const uniqueOrders = new Set(orderItems.map((oi) => oi.orderId));

    // ═══ Transaction ═══
    const shipment = await prisma.$transaction(
      async (tx) => {
        const newShipment = await tx.shipment.create({
          data: {
            shipmentNumber,
            qrTokenHash: tokenHash,
            qrTokenEncrypted: tokenEncrypted,
            qrTokenPreview: tokenPreview,
            status: "DRAFT",
            createdById: current.user.id,
            packedById: current.user.id,
            customerId: data.customerId,
            totalCOD: Math.round(totalCOD * 100) / 100,
            totalOrders: uniqueOrders.size,
            notes: data.notes || null,
          },
        });

        // ═══ ShipmentItems ═══
        for (const reqItem of data.items) {
          const orderItem = orderItems.find(
            (oi) => oi.id === reqItem.orderItemId
          );
          if (!orderItem) continue;

          // حساب COD لهذا العنصر
          const order = await tx.order.findUnique({
            where: { id: orderItem.orderId },
            select: { total: true, items: { select: { id: true, total: true } } },
          });
          const orderItemsTotal = (order?.items || []).reduce(
            (s, i) => s + Number(i.total),
            0
          );
          const itemRatio =
            orderItemsTotal > 0
              ? Number(orderItem.total) / orderItemsTotal
              : 0;
          const codPerUnit =
            orderItem.quantity > 0
              ? (Number(order?.total || 0) * itemRatio) / orderItem.quantity
              : 0;

          await tx.shipmentItem.create({
            data: {
              shipmentId: newShipment.id,
              orderId: orderItem.orderId,
              orderItemId: orderItem.id,
              productId: orderItem.productId,
              variantId: orderItem.variantId,
              sellerId: orderItem.product.sellerId,
              quantity: reqItem.quantity,
              codAmount: Math.round(codPerUnit * reqItem.quantity * 100) / 100,
            },
          });
        }

        // ═══ Audit Log ═══
        const reqInfo = AuditService.getRequestInfo(request);
        await AuditService.logInTransaction(tx, {
          userId: current.user.id,
          action: "SHIPMENT_CREATE",
          entity: "Shipment",
          entityId: newShipment.id,
          newData: {
            shipmentNumber,
            totalCOD: newShipment.totalCOD,
            totalOrders: newShipment.totalOrders,
            itemsCount: data.items.length,
          },
          ipAddress: reqInfo.ipAddress,
          userAgent: reqInfo.userAgent,
        });

        return newShipment;
      },
      { timeout: 20000 }
    );

    return NextResponse.json(
      {
        success: true,
        shipment: {
          id: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          rawToken, // ← يُعرض مرة واحدة فقط للطباعة
          totalCOD: Number(shipment.totalCOD),
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
      { status: 500 }
    );
  }
}