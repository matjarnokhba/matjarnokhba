import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { CollectionBatchService } from "@/services/collection-batch.service";

async function requireCollector() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const allowed = ["COLLECTOR", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }

  return { user: current.user };
}

export async function GET() {
  try {
    const auth = await requireCollector();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const batch = await CollectionBatchService.getActiveBatchForCollector(
      auth.user.id
    );

    if (!batch) {
      return NextResponse.json({
        success: true,
        hasActiveBatch: false,
        batch: null,
        qrUrl: null,
      });
    }

    // ═══ توليد الـQR URL ═══
    const rawToken = await CollectionBatchService.getRawToken(batch.id);

    return NextResponse.json({
      success: true,
      hasActiveBatch: true,
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        itemsCount: batch.itemsCount,
        totalOrders: batch.totalOrders,
        status: batch.status,
        departedAt: batch.departedAt,
        preview: batch.qrTokenPreview,
        items: batch.items.map((bi: any) => ({
          seller: bi.fulfillmentItem.seller,
          orderNumber: bi.fulfillmentItem.orderItem.order.orderNumber,
        })),
      },
      qrUrl: rawToken ? `/cb/${rawToken}` : null,
    });
  } catch (error) {
    console.error("Active batch error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}