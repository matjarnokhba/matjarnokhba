import { NextResponse } from "next/server";

// ═══════════════════════════════════════════
// ⚠️ DEPRECATED (v3.4)
// ═══════════════════════════════════════════
//
// هذا المسار لم يعد صالحًا في التدفق الجديد.
//
// التدفق الصحيح:
//   SHIPPED → Collector → COLLECTED → IN_TRANSIT_TO_WAREHOUSE
//   → Warehouse RECEIVED → Warehouse ينشئ Shipment
//   → Delivery يعمل على Shipment عبر:
//     POST /api/delivery/shipments/[id]/action
//
// DELIVERY لا يجب أن يعمل على طلبات فردية.
// ═══════════════════════════════════════════

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message:
        "هذا المسار لم يعد مستخدمًا. التوصيل يتم عبر شحنات المستودع. استخدم QR الشحنة (/sd/...).",
      code: "DEPRECATED_DELIVERY_ORDER_ACTION",
    },
    { status: 410 }
  );
}