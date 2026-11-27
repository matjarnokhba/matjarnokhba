import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { LogisticsScopeService } from "@/services/logistics-scope.service";
import { hasAnyLogisticsAccess } from "@/lib/logistics-scope";
import { driverWhere } from "@/lib/warehouse-route-scope";

async function requireWarehouse() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };

  const scope = await LogisticsScopeService.forUser(current.user.id, current.user.role);
  if (!hasAnyLogisticsAccess(scope)) {
    return { error: "غير مصرح", status: 403 };
  }

  return { user: current.user, scope };
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

    // حساب تاريخ اليوم وغداً للتحقق من الأجندة
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDayOfWeek = today.getDay();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDayOfWeek = tomorrow.getDay();

    const drivers = await prisma.deliveryPerson.findMany({
      where: {
        ...(await driverWhere(auth.scope)),
        status: "ACTIVE",
        deletedAt: null,
        // استبعاد السائقين الذين في يوم راحتهم الأسبوعي (اليوم أو غداً)
        OR: [
          { weeklyDayOff: null },
          { weeklyDayOff: { notIn: [todayDayOfWeek, tomorrowDayOfWeek] } }
        ],
        // استبعاد السائقين الذين سجلوا غياباً طارئاً (اليوم أو غداً)
        daysOff: {
          none: { date: { in: [today, tomorrow] } }
        }
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        _count: {
          select: {
            shipments: {
              where: {
                status: { in: ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"] },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const formatted = drivers.map((d) => ({
      id: d.id,
      userId: d.user.id,
      name: d.user.name,
      phone: d.user.phone,
      city: d.city,
      cities: d.cities,
      districts: d.districts,
      vehicleType: d.vehicleType,
      activeShipments: d._count.shipments,
    }));

    return NextResponse.json({ success: true, drivers: formatted });
  } catch (error) {
    console.error("Available drivers error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}