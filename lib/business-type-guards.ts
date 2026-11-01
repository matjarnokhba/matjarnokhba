import { prisma } from "@/lib/prisma";

export async function getBusinessType(businessId: number): Promise<string | null> {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { type: true, deletedAt: true },
  });
  if (!biz || biz.deletedAt) return null;
  return biz.type;
}

export async function isWholesaleTrader(businessId: number): Promise<boolean> {
  return (await getBusinessType(businessId)) === "WHOLESALE_TRADER";
}

export async function isIndependentSupplier(businessId: number): Promise<boolean> {
  return (await getBusinessType(businessId)) === "INDEPENDENT_SUPPLIER";
}

export async function getBusinessTypeWithSeller(businessId: number): Promise<{
  type: string | null;
  hasLinkedSeller: boolean;
} | null> {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { type: true, deletedAt: true, linkedSellerId: true },
  });
  if (!biz || biz.deletedAt) return null;
  return { type: biz.type, hasLinkedSeller: !!biz.linkedSellerId };
}
export async function canCreateMasters(businessId: number): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { type: true, deletedAt: true, status: true },
  });
  if (!biz || biz.deletedAt) return { allowed: false, reason: "النشاط غير موجود" };
  if (biz.status !== "VERIFIED") return { allowed: false, reason: "النشاط غير موثق" };
  if (biz.type === "INDEPENDENT_SUPPLIER") return { allowed: true };

  const nonTraderSA = await prisma.supplyActivity.findFirst({
    where: { businessId, status: "VERIFIED", type: { not: "TRADER" }, deletedAt: null },
    select: { id: true },
  });
  if (!nonTraderSA) {
    return {
      allowed: false,
      reason: "لإنشاء منتجات، يجب إضافة هوية تجارية موثقة (مصنع/شركة/مورد/مستورد) من صفحة الهويات أولاً",
    };
  }
  return { allowed: true };
}