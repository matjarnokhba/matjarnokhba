import { NextResponse } from "next/server";

// ⚠️ DEPRECATED (v3.4)
// DELIVERY لا يعمل على الطلبات الفردية.
// استخدم: GET /api/delivery/shipments

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message: "هذا المسار لم يعد مستخدمًا. استخدم شاشة الشحنات.",
      code: "DEPRECATED_DELIVERY_ORDERS_LIST",
    },
    { status: 410 }
  );
}