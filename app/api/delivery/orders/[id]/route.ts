import { NextResponse } from "next/server";

// ═══════════════════════════════════════════
// ⚠️ DEPRECATED (v3.4)
// ═══════════════════════════════════════════
//
// هذا المسار لم يعد صالحًا في التدفق الجديد.
//
// التدفق الصحيح:
//   التاجر يجهّز → Collector يجمع → المستودع يستلم
//   → Warehouse ينشئ Shipment → يُسند لـDELIVERY
//   → DELIVERY يعمل على Shipment عبر:
//     GET /api/delivery/shipments/[id]
//
// DELIVERY لا يجب أن يعمل على طلبات فردية.
// ═══════════════════════════════════════════

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message:
        "هذا المسار لم يعد مستخدمًا. استخدم شاشة الشحنات في لوحة التوصيل.",
      code: "DEPRECATED_DELIVERY_ORDER_DETAIL",
    },
    { status: 410 }
  );
}