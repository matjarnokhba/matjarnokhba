import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { CheckoutContent } from "@/components/marketplace/CheckoutContent";
import type { BuyerBU } from "@/components/marketplace/types";

export default async function CheckoutPage() {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/checkout");

  const owner = await prisma.businessOwner.findUnique({
    where: { userId: current.user.id },
    select: { id: true },
  });

  let buyerBUs: BuyerBU[] = [];
  if (owner) {
    const owned = await prisma.businessUnit.findMany({
      where: { ownerId: owner.id, deletedAt: null, status: "ACTIVE" },
      select: { id: true, name: true, type: true, capabilities: true },
    });
    buyerBUs = owned
      .filter((b) =>
        ((b.capabilities as string[]) ?? []).includes("WHOLESALE_BUY")
      )
      .map((b) => ({ id: b.id, name: b.name, type: b.type }));
  }

  const memberBUs = await prisma.businessUnitMember.findMany({
    where: {
      userId: current.user.id,
      isActive: true,
      deletedAt: null,
      businessUnit: { status: "ACTIVE", deletedAt: null },
    },
    select: {
      businessUnit: {
        select: { id: true, name: true, type: true, capabilities: true },
      },
    },
  });
  for (const m of memberBUs) {
    const bu = m.businessUnit;
    const caps = (bu.capabilities as string[]) ?? [];
    if (
      caps.includes("WHOLESALE_BUY") &&
      !buyerBUs.some((x) => x.id === bu.id)
    ) {
      buyerBUs.push({ id: bu.id, name: bu.name, type: bu.type });
    }
  }

  return <CheckoutContent buyerBUs={buyerBUs} />;
}