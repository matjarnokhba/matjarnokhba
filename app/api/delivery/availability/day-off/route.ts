import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  date: z.string(), // YYYY-MM-DD
  reason: z.string().min(3),
});

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || current.user.role !== "DELIVERY") return NextResponse.json({ success: false }, { status: 403 });

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });

    const person = await prisma.deliveryPerson.findUnique({ where: { userId: current.user.id } });
    if (!person) return NextResponse.json({ success: false }, { status: 404 });

    await prisma.driverDayOff.upsert({
      where: { driverId_date: { driverId: person.id, date: new Date(parsed.data.date) } },
      create: { driverId: person.id, date: new Date(parsed.data.date), reason: parsed.data.reason },
      update: { reason: parsed.data.reason }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}