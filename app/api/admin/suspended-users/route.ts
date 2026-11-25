import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export const dynamic = "force-dynamic";

async function requireAdminUser() {
  const current = await SessionService.getCurrent();
  if (!current || (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN")) return null;
  return current;
}

export async function GET() {
  try {
    if (!(await requireAdminUser())) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const users = await prisma.user.findMany({
      where: { suspendedAt: { not: null }, deletedAt: null },
      select: { id: true, name: true, email: true, phone: true, suspendedAt: true, suspendReason: true },
      orderBy: { suspendedAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ success: true, users });
  } catch {
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

const schema = z.object({ userId: z.number().int().positive() });

// رفع الإيقاف عن حساب
export async function POST(request: Request) {
  try {
    if (!(await requireAdminUser())) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: parsed.data.userId },
      data: { suspendedAt: null, suspendReason: null },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}