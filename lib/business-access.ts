import { prisma } from "@/lib/prisma";

export async function checkBusinessAccess(businessId: number, userId: number, allowedRoles?: string[]) {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    include: { members: { where: { userId, deletedAt: null } } },
  });
  if (!biz || biz.deletedAt) {
    return { error: "النشاط غير موجود", status: 404 } as const;
  }
  const isOwner = biz.ownerUserId === userId;
  const member = biz.members[0] || null;
  if (!isOwner && !member) {
    return { error: "غير مصرح", status: 403 } as const;
  }
  const canWrite = isOwner || (member && (allowedRoles ?? ["MANAGER", "SALES"]).includes(member.role));
  return { biz, canWrite, isOwner, member } as const;
}