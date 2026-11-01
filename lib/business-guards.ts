import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export type BusinessAccess = {
  business: any;
  isOwner: boolean;
  role: string;
  permissions: Record<string, boolean>;
};

export async function getBusinessAccess(
  businessId: number,
  userId: number
): Promise<BusinessAccess | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { members: { where: { userId, deletedAt: null } } },
  });
  if (!business || business.deletedAt) return null;
  if (business.status !== "VERIFIED") return null;

  const isOwner = business.ownerUserId === userId;
  const member = business.members[0] || null;
  if (!isOwner && !member) return null;

  const permissions =
    member?.permissions && typeof member.permissions === "object"
      ? (member.permissions as Record<string, boolean>)
      : {};

  return {
    business,
    isOwner,
    role: isOwner ? "OWNER" : member!.role,
    permissions,
  };
}

export async function requireBusinessOwner(businessId: number) {
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
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerUserId: true, status: true, deletedAt: true },
  });
  if (!business || business.deletedAt) {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "النشاط غير موجود" },
        { status: 404 }
      ),
    };
  }
  if (business.ownerUserId !== current.user.id) {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      ),
    };
  }
  if (business.status !== "VERIFIED") {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "النشاط غير موثق" },
        { status: 403 }
      ),
    };
  }
  return { ok: true as const, user: current.user, business };
}