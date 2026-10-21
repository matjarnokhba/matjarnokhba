import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({ rate: z.number().min(0).max(1) });

export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const policy = await prisma.systemPolicy.findUnique({
      where: { key: "DEFAULT_COMMISSION_RATE" }
    });

    return NextResponse.json({
      success: true,
      rate: typeof policy?.value === "number" ? policy.value : 0.10,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });

    await prisma.systemPolicy.upsert({
      where: { key: "DEFAULT_COMMISSION_RATE" },
      create: { key: "DEFAULT_COMMISSION_RATE", value: parsed.data.rate, updatedById: current.user.id },
      update: { value: parsed.data.rate, updatedById: current.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}