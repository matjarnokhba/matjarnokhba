import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function loadUserAndOrder(orderId: number, userId: number) {
  const order = await prisma.wholesaleOrder.findUnique({
    where: { id: orderId },
    include: {
      buyerBusiness: {
        include: {
          members: { where: { userId, deletedAt: null }, select: { role: true } },
        },
      },
      sellerBusiness: {
        include: {
          members: { where: { userId, deletedAt: null }, select: { role: true } },
        },
      },
    },
  });
  return order;
}

export async function requireOrderBuyer(orderId: number) {
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

  const order = await loadUserAndOrder(orderId, current.user.id);
  if (!order) {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      ),
    };
  }

  const isOwner = order.buyerBusiness.ownerUserId === current.user.id;
  const isMember = order.buyerBusiness.members.length > 0;
  if (!isOwner && !isMember) {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      ),
    };
  }
  if (order.buyerBusiness.status !== "VERIFIED") {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "نشاط المشتري غير موثق" },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user: current.user, order };
}

export async function requireOrderSeller(orderId: number) {
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

  const order = await loadUserAndOrder(orderId, current.user.id);
  if (!order) {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      ),
    };
  }

  const isOwner = order.sellerBusiness.ownerUserId === current.user.id;
  const member = order.sellerBusiness.members[0] || null;
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
  if (order.sellerBusiness.status !== "VERIFIED") {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "نشاط البائع غير موثق" },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, user: current.user, order };
}

export async function requireOrderParty(orderId: number) {
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

  const order = await loadUserAndOrder(orderId, current.user.id);
  if (!order) {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "الطلب غير موجود" },
        { status: 404 }
      ),
    };
  }

  const isBuyerOwner = order.buyerBusiness.ownerUserId === current.user.id;
  const isBuyerMember = order.buyerBusiness.members.length > 0;
  const isSellerOwner = order.sellerBusiness.ownerUserId === current.user.id;
  const isSellerMember = order.sellerBusiness.members.length > 0;

  if (!isBuyerOwner && !isBuyerMember && !isSellerOwner && !isSellerMember) {
    return {
      ok: false as const,
      response: Response.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true as const,
    user: current.user,
    order,
    side: isBuyerOwner || isBuyerMember ? "buyer" : "seller",
  };
}