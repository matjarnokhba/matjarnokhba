import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const schema = z.object({
  enabled: z.boolean(),
  deleteBundleRules: z.boolean().optional(),
  requireSizeSelection: z.boolean().optional(),
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
  return { offer };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
    }
    const { id } = await params;
    const offerId = parseInt(id);
    if (isNaN(offerId)) {
      return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    }

    const check = await ensureOwner(offerId, current.user.id);
    if ("error" in check) {
      return NextResponse.json({ success: false, message: check.error }, { status: check.status });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const { enabled, deleteBundleRules, requireSizeSelection } = parsed.data;

    if (enabled && !deleteBundleRules) {
      const rulesCount = await prisma.wholesaleOfferBundleRule.count({
        where: { offerId },
      });
      if (rulesCount > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `يوجد ${rulesCount} قاعدة شراء مرتبطة. يجب حذفها قبل تفعيل التوزيع التلقائي.`,
            requiresConfirmation: true,
            rulesCount,
          },
          { status: 409 }
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      if (enabled && deleteBundleRules) {
        await tx.wholesaleOfferBundleRule.deleteMany({ where: { offerId } });
      }
      const updateData: any = {
        autoBalanceEnabled: enabled,
        autoBalanceUpdatedAt: new Date(),
      };
      if (typeof requireSizeSelection === "boolean") {
        updateData.requireSizeSelection = requireSizeSelection;
      }
      await tx.wholesaleOffer.update({
        where: { id: offerId },
        data: updateData,
      });
    });

    return NextResponse.json({
      success: true,
      autoBalanceEnabled: enabled,
      bundleRulesDeleted: enabled && deleteBundleRules,
    });
  } catch (e) {
    console.error("auto-balance toggle:", e);
    return NextResponse.json({ success: false, message: "حدث خطأ" }, { status: 500 });
  }
}