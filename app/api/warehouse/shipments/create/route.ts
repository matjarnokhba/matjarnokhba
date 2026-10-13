import { NextResponse } from "next/server";

// ⚠️ DEPRECATED (v3.5) — Use /api/warehouse/assembly/[id]/create-shipment instead

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message:
        "تم استبدال هذا المسار. استخدم شاشة التجميع (/warehouse/assembly) لإنشاء الشحنات.",
      code: "DEPRECATED_CREATE_SHIPMENT",
    },
    { status: 410 }
  );
}