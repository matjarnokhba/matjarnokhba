import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireWarehouse() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  const allowed = ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

const ONLINE_THRESHOLD_MS = 90_000; // 90s
const STALE_THRESHOLD_MS = 300_000; // 5min

type StaffStatus = "ONLINE" | "STALE" | "OFFLINE" | "NEVER";

function computeStatus(
  isOnline: boolean,
  lastLocationAt: Date | null
): StaffStatus {
  if (!lastLocationAt) return "NEVER";
  const elapsed = Date.now() - lastLocationAt.getTime();
  if (!isOnline) return "OFFLINE";
  if (elapsed > STALE_THRESHOLD_MS) return "OFFLINE"; // left without stopping
  if (elapsed > ONLINE_THRESHOLD_MS) return "STALE";
  return "ONLINE";
}

export async function GET() {
  try {
    const auth = await requireWarehouse();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const staff = await prisma.deliveryPerson.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: {
        id: true,
        userId: true,
        phone: true,
        city: true,
        isOnline: true,
        currentLatitude: true,
        currentLongitude: true,
        locationAccuracy: true,
        lastLocationAt: true,
        user: { select: { name: true, email: true } },
        deliveryAssignments: {
          where: {
            status: { notIn: ["COMPLETED", "CANCELLED"] },
          },
          take: 1,
          orderBy: { assignedAt: "desc" },
          select: {
            id: true,
            status: true,
            shipment: { select: { shipmentNumber: true } },
          },
        },
        collectionAssignments: {
          where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, assignmentNumber: true },
        },
      },
      orderBy: [{ isOnline: "desc" }, { lastLocationAt: "desc" }],
    });

    const rows = staff.map((s) => {
      const status = computeStatus(s.isOnline, s.lastLocationAt);
      const deliveryA = s.deliveryAssignments[0];
      const collectionA = s.collectionAssignments[0];
      const currentAssignment =
        deliveryA
          ? {
              type: "DELIVERY" as const,
              id: deliveryA.id,
              status: deliveryA.status,
              label: deliveryA.shipment?.shipmentNumber ?? `#${deliveryA.id}`,
            }
          : collectionA
            ? {
                type: "COLLECTION" as const,
                id: collectionA.id,
                status: collectionA.status,
                label: collectionA.assignmentNumber ?? `#${collectionA.id}`,
              }
            : null;

      return {
        id: s.id,
        userId: s.userId,
        name: s.user.name,
        email: s.user.email,
        phone: s.phone,
        city: s.city,
        isOnline: s.isOnline,
        status,
        latitude: s.currentLatitude,
        longitude: s.currentLongitude,
        accuracy: s.locationAccuracy,
        lastLocationAt: s.lastLocationAt?.toISOString() ?? null,
        currentAssignment,
      };
    });

    const counts = {
      total: rows.length,
      online: rows.filter((r) => r.status === "ONLINE").length,
      stale: rows.filter((r) => r.status === "STALE").length,
      offline: rows.filter((r) => r.status === "OFFLINE").length,
      never: rows.filter((r) => r.status === "NEVER").length,
      withLocation: rows.filter(
        (r) => r.latitude != null && r.longitude != null
      ).length,
    };

    return NextResponse.json({
      success: true,
      staff: rows,
      counts,
      thresholds: {
        onlineMs: ONLINE_THRESHOLD_MS,
        staleMs: STALE_THRESHOLD_MS,
      },
    });
  } catch (e) {
    console.error("warehouse tracking live:", e);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}