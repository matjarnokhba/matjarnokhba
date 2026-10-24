import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { InventoryService } from "@/services/inventory.service";
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

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify") }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().trim().min(5, "السبب مطلوب (5 أحرف)").max(500),
    returnToSeller: z.boolean().default(true),
  }),
  z.object({
    action: z.literal("postpone"),
    reason: z.string().trim().min(5, "السبب مطلوب (5 أحرف)").max(500),
  }),
]);

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
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
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

    const data = parsed.data;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        seller: { select: { storeName: true } },
        items: {
          select: {
            id: true,
            variantId: true,
            quantity: true,
            fulfillmentItems: {
              select: {
                id: true,
                status: true,
                quantity: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      );
    }

    const allItems = order.items.flatMap((i) => i.fulfillmentItems);

    if (allItems.length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد عناصر" },
        { status: 400 }
      );
    }

    // ═══════════════════════════════════════════
    // VERIFY — مع إنشاء AssemblyFile تلقائياً
    // ═══════════════════════════════════════════
    if (data.action === "verify") {
      const notReceived = allItems.filter((i) => i.status !== "RECEIVED");
      if (notReceived.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `${notReceived.length} عنصر لم يستلم بعد`,
          },
          { status: 400 }
        );
      }

      const { AssemblyService } = await import("@/services/assembly.service");

      await prisma.$transaction(async (tx) => {
        const now = new Date();

        for (const fi of allItems) {
          await tx.fulfillmentItem.update({
            where: { id: fi.id },
            data: {
              status: "VERIFIED",
              verifiedAt: now,
              verifiedById: auth.user.id,
            },
          });

          await tx.fulfillmentStatusHistory.create({
            data: {
              fulfillmentItemId: fi.id,
              fromStatus: "RECEIVED",
              toStatus: "VERIFIED",
              changedById: auth.user.id,
              note: "تم فحص الطلبية — الحالة سليمة",
            },
          });

          await tx.warehouseReceipt.updateMany({
            where: { fulfillmentItemId: fi.id, status: "RECEIVED" },
            data: {
              status: "VERIFIED",
              verifiedAt: now,
              verifiedById: auth.user.id,
            },
          });
        }

        // ═══ إنشاء/تحديث ملف التجميع للعميل + إعادة الحساب ═══
        const assembly = await AssemblyService.ensureForUser(tx, order.userId);
        if (assembly) {
          await AssemblyService.recompute(tx, assembly.id);
        }

        const reqInfo = AuditService.getRequestInfo(request);
        await AuditService.logInTransaction(tx, {
          userId: auth.user.id,
          action: "WAREHOUSE_VERIFY",
          entity: "Order",
          entityId: String(orderId),
          newData: {
            orderNumber: order.orderNumber,
            itemsCount: allItems.length,
            action: "verify",
            assemblyId: assembly?.id || null,
          },
          ipAddress: reqInfo.ipAddress,
          userAgent: reqInfo.userAgent,
        });
      });

      return NextResponse.json({
        success: true,
        action: "verify",
        orderNumber: order.orderNumber,
      });
    }

    // ═══════════════════════════════════════════
    // REJECT — مع إعادة بناء AssemblyFile
    // ═══════════════════════════════════════════
    if (data.action === "reject") {
      const { AssemblyService } = await import("@/services/assembly.service");

      await prisma.$transaction(async (tx) => {
        const now = new Date();

        for (const fi of allItems) {
          await tx.fulfillmentItem.update({
            where: { id: fi.id },
            data: {
              status: "RETURNED",
              rejectedAt: now,
              rejectedReason: data.reason,
              rejectedById: auth.user.id,
            },
          });

          await tx.fulfillmentStatusHistory.create({
            data: {
              fulfillmentItemId: fi.id,
              fromStatus: fi.status as any,
              toStatus: "RETURNED",
              changedById: auth.user.id,
              note: `رفض في المستودع: ${data.reason}`,
            },
          });
        }

        // ═══ إرجاع المخزون ═══
        const itemsToReturn = order.items
          .filter(
            (i): i is typeof i & { variantId: number } => i.variantId !== null
          )
          .sort((a, b) => a.variantId - b.variantId);

        for (const item of itemsToReturn) {
          await InventoryService.returnStock(
            tx,
            item.variantId,
            item.quantity,
            orderId,
            `رفض في المستودع: ${data.reason}`,
            "ORDER"
          );
        }

        // ═══ Order → RETURNED ═══
        await tx.order.update({
          where: { id: orderId },
          data: { status: "RETURNED" },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: order.status,
            toStatus: "RETURNED",
            changedById: auth.user.id,
            note: `رفض في المستودع: ${data.reason}`,
          },
        });

        // ═══ إعادة بناء AssemblyFile للعميل ═══
        try {
          await AssemblyService.rebuildForUser(tx, order.userId);
        } catch (e) {
          console.error("Assembly rebuild failed on reject:", e);
        }

        // ═══ إشعارات: تاجر + عميل + أدمن ═══
        const recipients = await tx.user.findMany({
          where: {
            OR: [
              { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
              { id: order.userId },
            ],
            deletedAt: null,
          },
          select: { id: true },
        });

        if (order.sellerId) {
          const seller = await tx.seller.findUnique({
            where: { id: order.sellerId },
            select: { userId: true },
          });
          if (seller) {
            recipients.push({ id: seller.userId });
          }
        }

        const uniqueRecipients = Array.from(
          new Set(recipients.map((r) => r.id))
        );

        for (const rId of uniqueRecipients) {
          await tx.notification.create({
            data: {
              userId: rId,
              type: "ORDER_STATUS_CHANGED",
              title: "❌ رفض طلبية في المستودع",
              message: `الطلب ${order.orderNumber} — السبب: ${data.reason}`,
              link: `/orders/${orderId}`,
              category: "ORDER",
              severity: "WARNING",
              metadata: {
                orderId,
                orderNumber: order.orderNumber,
                reason: data.reason,
                rejectedById: auth.user.id,
              },
            },
          });
        }

        const reqInfo = AuditService.getRequestInfo(request);
        await AuditService.logInTransaction(tx, {
          userId: auth.user.id,
          action: "STATUS_CHANGE",
          entity: "Order",
          entityId: String(orderId),
          newData: {
            orderNumber: order.orderNumber,
            action: "reject",
            reason: data.reason,
            itemsCount: allItems.length,
          },
          ipAddress: reqInfo.ipAddress,
          userAgent: reqInfo.userAgent,
        });
      });

      return NextResponse.json({
        success: true,
        action: "reject",
        orderNumber: order.orderNumber,
      });
    }

    // ═══════════════════════════════════════════
    // POSTPONE (لا يغير الحالة — لا يحتاج Assembly update)
    // ═══════════════════════════════════════════
    if (data.action === "postpone") {
      await prisma.$transaction(async (tx) => {
        const now = new Date();

        for (const fi of allItems) {
          await tx.fulfillmentItem.update({
            where: { id: fi.id },
            data: {
              postponedAt: now,
              postponedReason: data.reason,
            },
          });

          await tx.fulfillmentStatusHistory.create({
            data: {
              fulfillmentItemId: fi.id,
              fromStatus: fi.status as any,
              toStatus: fi.status as any,
              changedById: auth.user.id,
              note: `تأجيل: ${data.reason}`,
            },
          });
        }

        const admins = await tx.user.findMany({
          where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, deletedAt: null },
          select: { id: true },
        });

        for (const a of admins) {
          await tx.notification.create({
            data: {
              userId: a.id,
              type: "ORDER_STATUS_CHANGED",
              title: "⏸️ تأجيل طلبية",
              message: `الطلب ${order.orderNumber} — السبب: ${data.reason}`,
              link: `/admin/orders/${orderId}`,
              category: "ORDER",
              severity: "WARNING",
              metadata: {
                orderId,
                orderNumber: order.orderNumber,
                reason: data.reason,
              },
            },
          });
        }

        const reqInfo = AuditService.getRequestInfo(request);
        await AuditService.logInTransaction(tx, {
          userId: auth.user.id,
          action: "STATUS_CHANGE",
          entity: "Order",
          entityId: String(orderId),
          newData: {
            orderNumber: order.orderNumber,
            action: "postpone",
            reason: data.reason,
          },
          ipAddress: reqInfo.ipAddress,
          userAgent: reqInfo.userAgent,
        });
      });

      return NextResponse.json({
        success: true,
        action: "postpone",
        orderNumber: order.orderNumber,
      });
    }

    return NextResponse.json(
      { success: false, message: "إجراء غير معروف" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Warehouse action error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}