import { NextResponse } from "next/server";
import { ExternalShipmentService } from "@/services/external-shipment.service";
import { CourierPollService } from "@/services/courier-poll.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ success: false, message: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const out: Record<string, unknown> = {};
  try {
    out.retry = await ExternalShipmentService.retryDue(20);
  } catch (error) {
    console.error("courier-sync retry error:", error);
    out.retry = { error: true };
  }
  try {
    out.poll = await CourierPollService.pollTracking(30);
  } catch (error) {
    console.error("courier-sync poll error:", error);
    out.poll = { error: true };
  }
  return NextResponse.json({ success: true, ...out });
}