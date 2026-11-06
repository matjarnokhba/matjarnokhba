import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { CreateOfferWizard } from "@/components/wholesale/offers/CreateOfferWizard";

export default async function NewOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ businessUnitId?: string }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/offers/new");

  const params = await searchParams;
  const initialBusinessUnitId = params.businessUnitId || "";

  // Fetch user's BUs (owner + member)
  const owner = await prisma.businessOwner.findUnique({
    where: { userId: current.user.id },
    select: { id: true },
  });

  const ownerBUs = owner
    ? await prisma.businessUnit.findMany({
        where: {
          ownerId: owner.id,
          deletedAt: null,
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          type: true,
          capabilities: true,
          verificationStatus: true,
        },
      })
    : [];

  const memberBUs = await prisma.businessUnitMember.findMany({
    where: {
      userId: current.user.id,
      isActive: true,
      deletedAt: null,
      businessUnit: { status: "ACTIVE", deletedAt: null },
    },
    select: {
      businessUnit: {
        select: {
          id: true,
          name: true,
          type: true,
          capabilities: true,
          verificationStatus: true,
        },
      },
    },
  });

  // Deduplicate + filter WHOLESALE_SELL
  const buMap = new Map<
    number,
    {
      id: number;
      name: string;
      type: string;
      capabilities: string[];
      verificationStatus: string;
    }
  >();
  for (const b of [...ownerBUs, ...memberBUs.map((m) => m.businessUnit)]) {
    const caps = (b.capabilities as string[]) ?? [];
    if (!caps.includes("WHOLESALE_SELL")) continue;
    if (!buMap.has(b.id)) {
      buMap.set(b.id, {
        id: b.id,
        name: b.name,
        type: b.type,
        capabilities: caps,
        verificationStatus: b.verificationStatus,
      });
    }
  }
  const businessUnits = Array.from(buMap.values());

  // Fetch user's ACTIVE master products
  const masters = await prisma.masterProduct.findMany({
    where: {
      createdByUserId: current.user.id,
      status: "ACTIVE",
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      category: { select: { name: true } },
      _count: { select: { variants: true } },
    },
  });

  const masterOptions = masters.map((m) => ({
    id: m.id,
    name: m.name,
    brand: m.brand,
    images: m.images as string[],
    barcode: m.barcode,
    categoryName: m.category.name,
    variantCount: m._count.variants,
  }));

  return (
    <CreateOfferWizard
      businessUnits={businessUnits}
      masters={masterOptions}
      initialBusinessUnitId={initialBusinessUnitId}
    />
  );
}