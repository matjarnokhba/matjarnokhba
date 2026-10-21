import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  isFreeShippingEnabled: z.boolean(),
  freeShippingThreshold: z.number().positive(),
});

// جلب الإعدادات
export async function GET() {
  try {
    const current = await SessionService.getCurrent();
    if (!current || (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const policies = await prisma.systemPolicy.findMany({
      where: { key: { in: ["FREE_SHIPPING_ENABLED", "FREE_SHIPPING_THRESHOLD"] } }
    });

    const enabled = policies.find(p => p.key === "FREE_SHIPPING_ENABLED")?.value;
    const threshold = policies.find(p => p.key === "FREE_SHIPPING_THRESHOLD")?.value;

    return NextResponse.json({
      success: true,
      isFreeShippingEnabled: enabled === true,
      freeShippingThreshold: typeof threshold === "number" ? threshold : 300,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

// حفظ الإعدادات
export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });

    const { isFreeShippingEnabled, freeShippingThreshold } = parsed.data;

    await prisma.$transaction(async (tx) => {
      await tx.systemPolicy.upsert({
        where: { key: "FREE_SHIPPING_ENABLED" },
        create: { key: "FREE_SHIPPING_ENABLED", value: isFreeShippingEnabled, updatedById: current.user.id },
        update: { value: isFreeShippingEnabled, updatedById: current.user.id },
      });

      await tx.systemPolicy.upsert({
        where: { key: "FREE_SHIPPING_THRESHOLD" },
        create: { key: "FREE_SHIPPING_THRESHOLD", value: freeShippingThreshold, updatedById: current.user.id },
        update: { value: freeShippingThreshold, updatedById: current.user.id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}