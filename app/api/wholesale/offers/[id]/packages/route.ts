import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  sortOrder: z.number().int().min(0).optional(),
  items: z.array(z.object({
    variantId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(100000),
  })).min(1).max(100),
});

async function ensureOwner(offerId: number, userId: number) {
  const offer = await prisma.wholesaleOffer.findFirst({
    where: { id: offerId, deletedAt: null },
    select: {
      id: true, status: true,
      businessUnit: {
        select: {
          owner: { select: { userId: true } },
          members: { where: { userId, isActive: true, deletedAt: null }, select: { permissions: true } },
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
    const packages = await prisma.wholesaleOfferPackage.findMany({
      where: { offerId },
      include: { items: { select: { variantId: true, quantity: true } } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return NextResponse.json({ success: true, packages });
  } catch (e) {
    console.error("packages GET:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(
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
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" }, { status: 400 });
    }
    const variantIds = [...new Set(parsed.data.items.map((i) => i.variantId))];
    const found = await prisma.wholesaleOfferVariant.findMany({
      where: { id: { in: variantIds }, offerId }, select: { id: true },
    });
    if (found.length !== variantIds.length) {
      return NextResponse.json({ success: false, message: "بعض الخيارات لا تنتمي لهذا العرض" }, { status: 400 });
    }
    const pkg = await prisma.wholesaleOfferPackage.create({
      data: {
        offerId, name: parsed.data.name.trim(), sortOrder: parsed.data.sortOrder ?? 0,
        items: { create: parsed.data.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })) },
      },
      include: { items: { select: { variantId: true, quantity: true } } },
    });
    return NextResponse.json({ success: true, package: pkg }, { status: 201 });
  } catch (e) {
    console.error("packages POST:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}