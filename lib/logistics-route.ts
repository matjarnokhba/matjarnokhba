import { NextResponse } from "next/server";
import { LogisticsError } from "@/lib/logistics-errors";

export function logisticsErrorResponse(e: unknown) {
  if (e instanceof LogisticsError) {
    return NextResponse.json({ success: false, message: e.message }, { status: e.status });
  }
  console.error("Logistics API error:", e);
  return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
}

export function parseId(v: string | null | undefined): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function zodMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "بيانات غير صحيحة";
}