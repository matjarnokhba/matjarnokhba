import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

export async function requireMasterWrite(businessId: number) {
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
    include: {
      members: {
        where: { userId: current.user.id, deletedAt: null },
        select: { role: true, permissions: true },
      },
    },
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

  if (business.status !== "VERIFIED") {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "النشاط غير موثق" },
        { status: 403 }
      ),
    };
  }

  const isOwner = business.ownerUserId === current.user.id;
  const member = business.members[0] || null;

  if (!isOwner && !member) {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      ),
    };
  }

  if (!isOwner && member!.role !== "MANAGER") {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "غير مصرح — صلاحية إدارة المنتجات مطلوبة" },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user: current.user, business };
}