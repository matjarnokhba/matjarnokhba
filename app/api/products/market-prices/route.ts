import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  masterIds: z.array(z.number().int().positive()).min(1).max(50),
});

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    if (!current || !current.user.seller) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 });
    }
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "بيانات غير صحيحة" }, { status: 400 });
    }

    const variants = await prisma.productVariant.findMany({
      where: {
        isActive: true,
        product: {
          masterId: { in: parsed.data.masterIds },
          status: "ACTIVE",
          deletedAt: null,
        },
      },
      select: {
        price: true,
        product: { select: { masterId: true } },
      },
    });

    const agg: Record<number, { sum: number; count: number; min: number; max: number }> = {};
    for (const v of variants) {
      const mid = v.product.masterId;
      if (!mid) continue;
      const p = Number(v.price);
      const a = agg[mid] || { sum: 0, count: 0, min: Infinity, max: -Infinity };
      a.sum += p;
      a.count += 1;
      if (p < a.min) a.min = p;
      if (p > a.max) a.max = p;
      agg[mid] = a;
    }

    const prices: Record<number, { avg: number; min: number; max: number; count: number }> = {};
    for (const [mid, a] of Object.entries(agg)) {
      prices[Number(mid)] = {
        avg: Math.round((a.sum / a.count) * 100) / 100,
        min: a.min,
        max: a.max,
        count: a.count,
      };
    }

    return NextResponse.json({ success: true, prices });
  } catch (error) {
    console.error("Market prices error:", error);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}