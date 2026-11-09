import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  triggerVariantId: z.number().int().positive(),
  requiredVariantId: z.number().int().positive(),
  minQuantity: z.number().int().min(1).max(10000).default(1),
  isMultiplied: z.boolean().default(false),
  notes: z.string().trim().max(500).optional().nullable(),
});

async function ensureOwner(offerId: number, userId: number) {
  const offer = await prisma.wholesaleOffer.findFirst({
    where: { id: offerId, deletedAt: null },
    select: {
      id: true, businessUnitId: true, status: true,
      businessUnit: {
        select: {
          owner: { select: { userId: true } },
          members: { where: { userId, isActive: true, deletedAt: null }, select: { id: true, permissions: true } },
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
    return { error: `لا يمكن تعديل قواعد عرض بحالة ${offer.status}`, status: 400 };
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
    const rules = await prisma.wholesaleOfferBundleRule.findMany({ where: { offerId }, orderBy: { id: "asc" } });
    return NextResponse.json({ success: true, rules });
  } catch (e) {
    console.error("bundle-rules GET:", e);
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
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }
    const { triggerVariantId, requiredVariantId, minQuantity, isMultiplied, notes } = parsed.data;
    if (triggerVariantId === requiredVariantId) {
      return NextResponse.json({ success: false, message: "لا يمكن أن يكون المشغّل والمطلوب نفس الخيار" }, { status: 400 });
    }
    const variants = await prisma.wholesaleOfferVariant.findMany({
      where: { id: { in: [triggerVariantId, requiredVariantId] }, offerId },
      select: { id: true },
    });
    if (variants.length !== 2) {
      return NextResponse.json({ success: false, message: "أحد الخيارات لا ينتمي لهذا العرض" }, { status: 400 });
    }
    const existing = await prisma.wholesaleOfferBundleRule.findFirst({
      where: { triggerVariantId, requiredVariantId },
    });
    if (existing) {
      return NextResponse.json({ success: false, message: "هذه القاعدة موجودة مسبقًا" }, { status: 409 });
    }
    const rule = await prisma.wholesaleOfferBundleRule.create({
      data: { offerId, triggerVariantId, requiredVariantId, minQuantity, isMultiplied, notes: notes?.trim() || null },
    });
    return NextResponse.json({ success: true, rule });
  } catch (e: any) {
    console.error("bundle-rules POST:", e);
    if (e?.code === "P2002") {
      return NextResponse.json({ success: false, message: "هذه القاعدة موجودة مسبقًا" }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}