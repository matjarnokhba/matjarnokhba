import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReturnDeadlineService } from "@/services/return-deadline.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ success: false, message: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await ReturnDeadlineService.processOverdue(prisma);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("auto-approve-returns error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}