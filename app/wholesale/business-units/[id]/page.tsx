import { notFound, redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { BusinessUnitDetail } from "@/components/wholesale/business-units/BusinessUnitDetail";
import type {
  SerializableBusinessUnit,
  SerializableMember,
  BUStats,
} from "@/components/wholesale/business-units/types";

export default async function BusinessUnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale");

  const { id } = await params;
  const buId = parseInt(id, 10);
  if (isNaN(buId) || buId <= 0) notFound();

  const bu = await prisma.businessUnit.findFirst({
    where: { id: buId, deletedAt: null },
    include: {
      owner: { select: { userId: true, displayName: true } },
      members: {
        where: { deletedAt: null },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { invitedAt: "asc" },
      },
    },
  });

  if (!bu) notFound();

  const isAdmin =
    current.user.role === "ADMIN" || current.user.role === "SUPER_ADMIN";
  const isOwner = bu.owner.userId === current.user.id;
  const memberRecord = bu.members.find(
    (m) => m.userId === current.user.id && m.isActive
  );
  if (!isOwner && !memberRecord && !isAdmin) notFound();

  // Stats
  const [productCount, offerCount, orderCount, inventoryAgg] =
    await Promise.all([
      prisma.merchantProduct.count({
        where: { businessUnitId: buId, deletedAt: null },
      }),
      prisma.wholesaleOffer.count({
        where: { businessUnitId: buId, deletedAt: null },
      }),
      prisma.wholesaleOrder.count({
        where: {
          OR: [
            { sellerBusinessUnitId: buId },
            { buyerBusinessUnitId: buId },
          ],
        },
      }),
      prisma.inventoryBalance.aggregate({
        where: { inventoryAccount: { businessUnitId: buId } },
        _sum: { quantity: true },
      }),
    ]);

  const stats: BUStats = {
    productCount,
    offerCount,
    orderCount,
    inventoryOnHand: Number(inventoryAgg._sum.quantity ?? 0),
  };

  const serializableBU: SerializableBusinessUnit = {
    id: bu.id,
    name: bu.name,
    slug: bu.slug,
    type: bu.type,
    status: bu.status,
    capabilities: (bu.capabilities as string[]) ?? [],
    verificationStatus: bu.verificationStatus,
    registrationStatus: bu.registrationStatus,
    description: bu.description,
    logo: bu.logo,
    createdAt: bu.createdAt.toISOString(),
  };

  const serializableMembers: SerializableMember[] = bu.members.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role as "OWNER" | "MANAGER" | "STAFF",
    permissions: (m.permissions as string[]) ?? [],
    isActive: m.isActive,
    userName: m.user.name,
    userEmail: m.user.email,
  }));

  return (
    <BusinessUnitDetail
      businessUnit={serializableBU}
      isOwner={isOwner}
      currentUserId={current.user.id}
      stats={stats}
      initialMembers={serializableMembers}
    />
  );
}