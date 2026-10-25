import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const DAYS_AR = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (
      !current ||
      !["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(current.user.role)
    ) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const next7Days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      next7Days.push(d);
    }

    const drivers = await prisma.deliveryPerson.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      include: {
        user: { select: { name: true, phone: true } },
        daysOff: {
          where: { date: { gte: today } },
          orderBy: { date: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const formatted = drivers.map((d) => {
      const workingDays = next7Days.map((day) => {
        const dow = day.getDay();

        if (d.weeklyDayOff === dow) {
          return { date: day, status: "weekly_off", reason: null };
        }

        const dayOff = d.daysOff.find(
          (off) => off.date.getTime() === day.getTime()
        );
        if (dayOff) {
          return { date: day, status: "absent", reason: dayOff.reason };
        }

        return { date: day, status: "working", reason: null };
      });

      return {
        id: d.id,
        name: d.user.name,
        phone: d.user.phone,
        city: d.city,
        weeklyDayOff: d.weeklyDayOff !== null ? DAYS_AR[d.weeklyDayOff] : null,
        workingDays,
      };
    });

    return NextResponse.json({
      success: true,
      drivers: formatted,
      dates: next7Days.map((d) => ({
        date: d,
        label: DAYS_AR[d.getDay()],
        isToday: d.getTime() === today.getTime(),
      })),
    });
  } catch (error) {
    console.error("Driver schedule error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}