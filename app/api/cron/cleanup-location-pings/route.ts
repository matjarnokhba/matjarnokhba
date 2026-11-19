import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PING_RETENTION_DAYS = 7;
const OFFLINE_MARKER_HOURS = 24;

export async function GET(request: Request) {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    if (!expectedSecret || authHeader !== "Bearer " + expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const pingCutoff = new Date(
      now.getTime() - PING_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
    const markerCutoff = new Date(
      now.getTime() - OFFLINE_MARKER_HOURS * 60 * 60 * 1000
    );

    // 1. Delete old location pings
    const deletedPings = await prisma.deliveryLocationPing.deleteMany({
      where: { recordedAt: { lt: pingCutoff } },
    });

    // 2. Clear stale location markers for offline drivers
    // (don't show ghost markers for drivers who stopped > 24h ago)
    const clearedMarkers = await prisma.deliveryPerson.updateMany({
      where: {
        isOnline: false,
        lastLocationAt: { lt: markerCutoff, not: null },
      },
      data: {
        currentLatitude: null,
        currentLongitude: null,
        locationAccuracy: null,
      },
    });

    console.log(
      `[cleanup-location-pings] deleted ${deletedPings.count} pings, cleared ${clearedMarkers.count} markers`
    );

    return NextResponse.json({
      success: true,
      deletedPings: deletedPings.count,
      clearedMarkers: clearedMarkers.count,
      pingCutoff: pingCutoff.toISOString(),
      markerCutoff: markerCutoff.toISOString(),
      pingRetentionDays: PING_RETENTION_DAYS,
      offlineMarkerHours: OFFLINE_MARKER_HOURS,
    });
  } catch (e) {
    console.error("cleanup-location-pings error:", e);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}