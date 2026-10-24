import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { PartialDeliveryService } from "@/services/partial-delivery.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(current.user.role)) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const shipmentId = parseInt(id);

    const result = await PartialDeliveryService.receiveRefusedItems(shipmentId, current.user.id);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Receive refused error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ success: false, message: msg }, { status: 400 });
  }
}