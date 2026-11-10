import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { AutoBalanceService } from "@/services/auto-balance.service";

const putSchema = z.object({
  limits: z
    .array(
      z.object({
        size: z.string().trim().min(1).max(50),
        minOrderQty: z.number().int().min(1).max(10000),
      })
    )
    .max(200),
});

async function ensureOwner(offerId: number, userId: number) {
  const offer = await prisma.wholesaleOffer.findFirst({
    where: { id: offerId, deletedAt: null },
    select: {
      id: true,
      status: true,
      businessUnit: {
        select: {
          owner: { select: { userId: true } },
          members: {
            where: { userId, isActive: true, deletedAt: null },
            select: { permissions: true },
          },
        },
      },
    },
  });
  if (!offer) return { error: "العرض غير موجود", status: 404 };
  const isOwner = offer.businessUnit.owner.userId === userId;
  const isManager = offer.businessUnit.members.some((m) => {
    const perms = m.permissions as string[] | null;
    return Array.isArray(perms) && perms.includes("offers.write");
  });
  if (!isOwner && !isManager) return { error: "غير مصرح", status: 403 };
  if (offer.status === "ARCHIVED" || offer.status === "SUSPENDED") {
    return { error: `لا يمكن تعديل عرض بحالة ${offer.status}`, status: 400 };
  }
  return { offer };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
    const { id } = await params;
    const offerId = parseInt(id);
    if (isNaN(offerId)) return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    const check = await ensureOwner(offerId, current.user.id);
    if ("error" in check) return NextResponse.json({ success: false, message: check.error }, { status: check.status });

    const limits = await AutoBalanceService.getSizeLimits(offerId);
    return NextResponse.json({ success: true, limits });
  } catch (e) {
    console.error("size-limits GET:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
    const { id } = await params;
    const offerId = parseInt(id);
    if (isNaN(offerId)) return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    const check = await ensureOwner(offerId, current.user.id);
    if ("error" in check) return NextResponse.json({ success: false, message: check.error }, { status: check.status });

    const body = await request.json();
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    await AutoBalanceService.setSizeLimits(offerId, parsed.data.limits);
    const limits = await AutoBalanceService.getSizeLimits(offerId);
    return NextResponse.json({ success: true, limits });
  } catch (e: any) {
    console.error("size-limits PUT:", e);
    return NextResponse.json(
      { success: false, message: e?.message || "حدث خطأ" },
      { status: 500 }
    );
  }
}