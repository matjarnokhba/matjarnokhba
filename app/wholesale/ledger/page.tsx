import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { LedgerContent } from "@/components/wholesale/ledger/LedgerContent";
import type { BUOption } from "@/components/wholesale/ledger/types";

export default async function LedgerListPage({
  searchParams,
}: {
  searchParams: Promise<{ businessUnitId?: string }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/ledger");

  const params = await searchParams;
  const buIdRaw = params.businessUnitId || "";

  const owner = await prisma.businessOwner.findUnique({
    where: { userId: current.user.id },
    select: { id: true },
  });
  const ownerBUs = owner
    ? await prisma.businessUnit.findMany({
        where: { ownerId: owner.id, deletedAt: null, status: "ACTIVE" },
        select: { id: true, name: true, type: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const memberBUs = await prisma.businessUnitMember.findMany({
    where: {
      userId: current.user.id,
      isActive: true,
      deletedAt: null,
      businessUnit: { status: "ACTIVE", deletedAt: null },
    },
    select: { businessUnit: { select: { id: true, name: true, type: true } } },
  });
  const buMap = new Map<number, BUOption>();
  ownerBUs.forEach((b) => buMap.set(b.id, b));
  memberBUs.forEach((m) => {
    if (!buMap.has(m.businessUnit.id))
      buMap.set(m.businessUnit.id, m.businessUnit);
  });
  const businessUnits = Array.from(buMap.values());

  const buIds = businessUnits.map((b) => b.id);
  const buIdFilter = buIdRaw ? parseInt(buIdRaw, 10) : null;
  const effectiveBU =
    buIdFilter && buIds.includes(buIdFilter) ? buIdFilter : buIds[0] ?? 0;

  return (
    <LedgerContent
      businessUnits={businessUnits}
      initialBusinessUnitId={effectiveBU}
    />
  );
}