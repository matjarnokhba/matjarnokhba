import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function requireOfferManage(offerId: number) {
  const current = await SessionService.getCurrent();
  if (!current) {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      ),
    };
  }

  const offer = await prisma.wholesaleOffer.findUnique({
    where: { id: offerId },
    include: {
      business: {
        include: {
          members: {
            where: { userId: current.user.id, deletedAt: null },
            select: { role: true },
          },
        },
      },
    },
  });

  if (!offer || offer.deletedAt) {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "العرض غير موجود" },
        { status: 404 }
      ),
    };
  }

  if (offer.business.status !== "VERIFIED") {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "النشاط غير موثق" },
        { status: 403 }
      ),
    };
  }

  const isOwner = offer.business.ownerUserId === current.user.id;
  const member = offer.business.members[0] || null;
  const canManage =
    isOwner || (member && ["MANAGER", "SALES"].includes(member.role));

  if (!canManage) {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user: current.user, offer };
}

export async function requireOfferRead(offerId: number) {
  const current = await SessionService.getCurrent();
  if (!current) {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "يجب تسجيل الدخول" },
        { status: 401 }
      ),
    };
  }

  const offer = await prisma.wholesaleOffer.findUnique({
    where: { id: offerId },
    include: {
      business: {
        include: {
          members: {
            where: { userId: current.user.id, deletedAt: null },
          },
        },
      },
    },
  });

  if (!offer || offer.deletedAt) {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "العرض غير موجود" },
        { status: 404 }
      ),
    };
  }

  // Public reads: ACTIVE + claimVerified عرض للجميع
  if (offer.isActive && offer.claimVerified && offer.status === "ACTIVE") {
    return { ok: true as const, user: current.user, offer, public: true };
  }

  // Owner/member reads: any status
  const isOwner = offer.business.ownerUserId === current.user.id;
  const isMember = offer.business.members.length > 0;
  if (!isOwner && !isMember) {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user: current.user, offer, public: false };
}