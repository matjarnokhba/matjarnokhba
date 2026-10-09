import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { PermissionService, PERMISSIONS } from "@/services/permission.service";
import { WarehouseService } from "@/services/warehouse.service";

async function requireWarehousePermission(permissionKey: string) {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const hasPermission = await PermissionService.hasPermission(
    current.user.id,
    permissionKey
  );
  if (!hasPermission) {
    return { error: "غير مصرح", status: 403 };
  }

  return { user: current.user };
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("receive"),
    quantity: z.number().int().positive().optional(),
    notes: z.string().trim().max(500).optional().nullable(),
  }),
  z.object({
    action: z.literal("verify"),
    damagedQuantity: z.number().int().min(0).optional(),
    notes: z.string().trim().max(500).optional().nullable(),
  }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().trim().min(3).max(500),
    notes: z.string().trim().max(500).optional().nullable(),
  }),
  z.object({ action: z.literal("mark_available") }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fulfillmentItemId = parseInt(id);
    if (isNaN(fulfillmentItemId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    // ═══ التحقق من وجود العنصر ═══
    const item = await prisma.fulfillmentItem.findUnique({
      where: { id: fulfillmentItemId },
      select: { id: true, status: true },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, message: "العنصر غير موجود" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);

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

    // ═══════════════════════════════════════════
    // Action: receive
    // ═══════════════════════════════════════════
    if (data.action === "receive") {
      const auth = await requireWarehousePermission(
        PERMISSIONS.RECEIVE_WAREHOUSE
      );
      if ("error" in auth) {
        return NextResponse.json(
          { success: false, message: auth.error },
          { status: auth.status }
        );
      }

      const result = await WarehouseService.receive({
        fulfillmentItemId,
        receivedById: auth.user.id,
        quantity: data.quantity,
        notes: data.notes || null,
      });

      return NextResponse.json({
        success: true,
        message: "تم استلام العنصر في المستودع",
        receipt: {
          id: result.id,
          receiptNumber: result.receiptNumber,
        },
      });
    }

    // ═══════════════════════════════════════════
    // Action: verify
    // ═══════════════════════════════════════════
    if (data.action === "verify") {
      const auth = await requireWarehousePermission(
        PERMISSIONS.VERIFY_WAREHOUSE
      );
      if ("error" in auth) {
        return NextResponse.json(
          { success: false, message: auth.error },
          { status: auth.status }
        );
      }

      // ═══ نجلب آخر Receipt ═══
      const latestReceipt = await prisma.warehouseReceipt.findFirst({
        where: { fulfillmentItemId },
        orderBy: { createdAt: "desc" },
      });

      if (!latestReceipt) {
        return NextResponse.json(
          { success: false, message: "لا يوجد إيصال استلام لهذا العنصر" },
          { status: 400 }
        );
      }

      const result = await WarehouseService.verify({
        receiptId: latestReceipt.id,
        verifiedById: auth.user.id,
        damagedQuantity: data.damagedQuantity || 0,
        notes: data.notes || null,
      });

      return NextResponse.json({
        success: true,
        message:
          data.damagedQuantity && data.damagedQuantity > 0
            ? `تم التحقق — ${data.damagedQuantity} وحدة تالفة`
            : "تم التحقق من العنصر",
        receipt: {
          id: result.id,
          receiptNumber: result.receiptNumber,
          status: result.status,
        },
      });
    }

    // ═══════════════════════════════════════════
    // Action: reject
    // ═══════════════════════════════════════════
    if (data.action === "reject") {
      const auth = await requireWarehousePermission(
        PERMISSIONS.VERIFY_WAREHOUSE
      );
      if ("error" in auth) {
        return NextResponse.json(
          { success: false, message: auth.error },
          { status: auth.status }
        );
      }

      const latestReceipt = await prisma.warehouseReceipt.findFirst({
        where: { fulfillmentItemId },
        orderBy: { createdAt: "desc" },
      });

      if (!latestReceipt) {
        return NextResponse.json(
          { success: false, message: "لا يوجد إيصال استلام لهذا العنصر" },
          { status: 400 }
        );
      }

      const result = await WarehouseService.reject({
        receiptId: latestReceipt.id,
        rejectedById: auth.user.id,
        reason: data.reason,
        notes: data.notes || null,
      });

      return NextResponse.json({
        success: true,
        message: "تم رفض العنصر",
        receipt: {
          id: result.id,
          receiptNumber: result.receiptNumber,
          status: result.status,
        },
      });
    }

    // ═══════════════════════════════════════════
    // Action: mark_available
    // ═══════════════════════════════════════════
    if (data.action === "mark_available") {
      const auth = await requireWarehousePermission(
        PERMISSIONS.VERIFY_WAREHOUSE
      );
      if ("error" in auth) {
        return NextResponse.json(
          { success: false, message: auth.error },
          { status: auth.status }
        );
      }

      await WarehouseService.markAvailableForShipment(
        fulfillmentItemId,
        auth.user.id
      );

      return NextResponse.json({
        success: true,
        message: "العنصر متاح للشحن",
      });
    }

    return NextResponse.json(
      { success: false, message: "إجراء غير معروف" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Warehouse action error:", error);
    const message =
      error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}