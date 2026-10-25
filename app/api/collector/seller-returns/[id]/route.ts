import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { SellerReturnService } from "@/services/seller-return.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "COLLECTOR") {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const batchId = parseInt(id);
    if (isNaN(batchId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const batch = await SellerReturnService.getBatchForCollector(
      batchId,
      current.user.id
    );

    return NextResponse.json({
      success: true,
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        status: batch.status,
        totalQuantity: batch.totalQuantity,
        itemsCount: batch.itemsCount,
        seller: {
          storeName: batch.seller.storeName,
          city: batch.seller.city,
        },
        items: batch.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          reason: item.shipmentItem.refusedReason,
          orderNumber: item.shipmentItem.order.orderNumber,
          productName: item.shipmentItem.orderItem.productName,
          variantName: item.shipmentItem.orderItem.variantName,
          imageUrl: item.shipmentItem.orderItem.imageUrl,
        })),
      },
    });
  } catch (error) {
    console.error("Collector batch details error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}