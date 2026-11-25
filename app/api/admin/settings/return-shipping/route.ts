import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { DEFAULT_RETURN_FEE } from "@/lib/return-policy";

const KEY = "RETURN_SHIPPING_FEE_DEFAULT";
const AUTO_KEY = "RETURN_AUTO_APPROVE_ENABLED";
const STRIKE_KEY = "SELLER_STRIKE_LIMIT";
const schema = z.object({
  defaultFee: z.number().min(0).max(1000),
  autoApprove: z.boolean().optional(),
  strikeLimit: z.number().int().min(0).max(20).optional(),
});

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
    const rows = await prisma.systemPolicy.findMany({ where: { key: { in: [KEY, AUTO_KEY, STRIKE_KEY] } } });
    const fee = rows.find((p) => p.key === KEY)?.value;
    const auto = rows.find((p) => p.key === AUTO_KEY)?.value;
    const strike = rows.find((p) => p.key === STRIKE_KEY)?.value;
    return NextResponse.json({
      success: true,
      defaultFee: typeof fee === "number" ? fee : DEFAULT_RETURN_FEE,
      autoApprove: auto !== false,
      strikeLimit: typeof strike === "number" ? strike : 3,
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
    await prisma.$transaction(async (tx) => {
      await tx.systemPolicy.upsert({
        where: { key: KEY },
        create: { key: KEY, value: parsed.data.defaultFee, updatedById: current.user.id },
        update: { value: parsed.data.defaultFee, updatedById: current.user.id },
      });
      if (typeof parsed.data.autoApprove === "boolean") {
        await tx.systemPolicy.upsert({
          where: { key: AUTO_KEY },
          create: { key: AUTO_KEY, value: parsed.data.autoApprove, updatedById: current.user.id },
          update: { value: parsed.data.autoApprove, updatedById: current.user.id },
        });
      }
      if (typeof parsed.data.strikeLimit === "number") {
        await tx.systemPolicy.upsert({
          where: { key: STRIKE_KEY },
          create: { key: STRIKE_KEY, value: parsed.data.strikeLimit, updatedById: current.user.id },
          update: { value: parsed.data.strikeLimit, updatedById: current.user.id },
        });
      }
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}