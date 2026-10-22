import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

// جلب إعدادات الأيام
export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "DELIVERY") return NextResponse.json({ success: false }, { status: 403 });

    const person = await prisma.deliveryPerson.findUnique({
      where: { userId: current.user.id },
      include: { daysOff: { where: { date: { gte: new Date() } }, orderBy: { date: "asc" } } }
    });

    return NextResponse.json({ success: true, weeklyDayOff: person?.weeklyDayOff, daysOff: person?.daysOff || [] });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// حفظ يوم الراحة الأسبوعي
export async function PATCH(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "DELIVERY") return NextResponse.json({ success: false }, { status: 403 });

    const body = await request.json();
    const schema = z.object({ weeklyDayOff: z.number().min(0).max(6).nullable() });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false }, { status: 400 });

    await prisma.deliveryPerson.update({
      where: { userId: current.user.id },
      data: { weeklyDayOff: parsed.data.weeklyDayOff }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}