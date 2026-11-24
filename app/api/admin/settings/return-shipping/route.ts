import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { DEFAULT_RETURN_FEE } from "@/lib/return-policy";

const KEY = "RETURN_SHIPPING_FEE_DEFAULT";
const schema = z.object({ defaultFee: z.number().min(0).max(1000) });

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
    const policy = await prisma.systemPolicy.findUnique({ where: { key: KEY } });
    return NextResponse.json({
      success: true,
      defaultFee: typeof policy?.value === "number" ? policy.value : DEFAULT_RETURN_FEE,
    });
  } catch {
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireAdminUser();
    if (!current) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });
    }
    await prisma.systemPolicy.upsert({
      where: { key: KEY },
      create: { key: KEY, value: parsed.data.defaultFee, updatedById: current.user.id },
      update: { value: parsed.data.defaultFee, updatedById: current.user.id },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}