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