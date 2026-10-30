import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { WholesaleOrderService } from "@/services/wholesale-order.service";

const schema = z.object({
  action: z.enum(["accept", "reject", "prepare", "ready", "complete", "cancel"]),
  reason: z.string().trim().max(500).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
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
        { success: false, message: "إجراء غير صحيح" },
        { status: 400 }
      );
    }

    const order = await prisma.wholesaleOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        supplier: { select: { userId: true, id: true } },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      );
    }

    const { action, reason } = parsed.data;
    const isSupplier =
      current.user.wholesaleSupplier?.id === order.supplierId;
    const isBuyer = order.buyerUserId === current.user.id;

    const supplierActions = ["accept", "reject", "prepare", "ready", "complete"];
    const buyerActions = ["cancel"];

    if (supplierActions.includes(action) && !isSupplier) {
      return NextResponse.json(
        { success: false, message: "هذا الإجراء للبائع فقط" },
        { status: 403 }
      );
    }
    if (buyerActions.includes(action) && !isBuyer) {
      return NextResponse.json(
        { success: false, message: "هذا الإجراء للمشتري فقط" },
        { status: 403 }
      );
    }

    const allowed: Record<string, string[]> = {
      accept: ["PENDING"],
      reject: ["PENDING"],
      prepare: ["ACCEPTED"],
      ready: ["PREPARING"],
      complete: ["READY"],
      cancel: ["PENDING", "ACCEPTED"],
    };

    if (!allowed[action].includes(order.status)) {
      return NextResponse.json(
        {
          success: false,
          message: `لا يمكن تنفيذ "${action}" على طلب بحالة "${order.status}"`,
        },
        { status: 400 }
      );
    }

    // ─── ACCEPT: copy products to buyer ───
    if (action === "accept") {
      try {
        const result = await WholesaleOrderService.acceptOrder(
          orderId,
          current.user.id
        );
        return NextResponse.json({
          success: true,
          order: { id: orderId, status: "ACCEPTED" },
          result,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "حدث خطأ";
        return NextResponse.json(
          { success: false, message: msg },
          { status: 400 }
        );
      }
    }

    // ─── OTHER ACTIONS: simple state updates ───
    const statusMap: Record<string, string> = {
      reject: "REJECTED",
      prepare: "PREPARING",
      ready: "READY",
      complete: "COMPLETED",
      cancel: "CANCELLED",
    };
    const timestampField: Record<string, string> = {
      reject: "rejectedAt",
      complete: "completedAt",
      cancel: "cancelledAt",
    };

    const updateData: Record<string, unknown> = {
      status: statusMap[action],
    };
    if (timestampField[action]) {
      updateData[timestampField[action]] = new Date();
    }
    if (action === "reject" && reason) {
      updateData.rejectionReason = reason;
    }

    const updated = await prisma.wholesaleOrder.update({
      where: { id: orderId },
      data: updateData,
    });

    const notifyUserId = isSupplier ? order.buyerUserId : order.supplier.userId;
    if (notifyUserId) {
      const titles: Record<string, string> = {
        reject: "تم رفض الطلب",
        prepare: "الطلب قيد التجهيز",
        ready: "الطلب جاهز",
        complete: "تم إكمال الطلب",
        cancel: "تم إلغاء الطلب",
      };
      await prisma.notification.create({
        data: {
          userId: notifyUserId,
          type: "ORDER_STATUS_CHANGED" as any,
          title: titles[action] || "تحديث الطلب",
          message: `الطلب ${order.orderNumber}${reason ? `: ${reason}` : ""}`,
          link: isSupplier
            ? `/wholesale/orders/${order.id}`
            : `/seller/wholesale/orders/${order.id}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      order: { id: updated.id, status: updated.status },
    });
  } catch (error) {
    console.error("Order action error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}