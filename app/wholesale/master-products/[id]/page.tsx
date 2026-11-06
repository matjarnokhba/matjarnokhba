import { notFound, redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { MasterProductDetail } from "@/components/wholesale/master-products/MasterProductDetail";
import type { SerializedDetail } from "@/components/wholesale/master-products/types";

export default async function MasterProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/master-products");

  const { id } = await params;
  const masterId = parseInt(id, 10);
  if (isNaN(masterId) || masterId <= 0) notFound();

  const master = await prisma.masterProduct.findFirst({
    where: { id: masterId, deletedAt: null },
    include: {
      category: { select: { id: true, name: true } },
      createdByUser: { select: { id: true, name: true, email: true } },
      approvedByUser: { select: { id: true, name: true } },
      variants: {
        orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      },
      versions: {
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          changeReason: true,
          createdAt: true,
          changedByUserId: true,
        },
      },
      _count: {
        select: {
          variants: true,
          merchantProducts: { where: { deletedAt: null } },
        },
      },
    },
  });

  if (!master) notFound();

  // Auth: only creator or admin can view full details
  const isAdmin =
    current.user.role === "ADMIN" || current.user.role === "SUPER_ADMIN";
  if (master.createdByUserId !== current.user.id && !isAdmin) notFound();

  // Fetch rejection reason if rejected/archived
  let rejectionReason: string | null = null;
  if (master.status === "ARCHIVED") {
    const audit = await prisma.operationAuditLog.findFirst({
      where: {
        entityType: "MasterProduct",
        entityId: masterId,
        action: "master_product.rejected",
      },
      orderBy: { createdAt: "desc" },
      select: { metadata: true },
    });
    if (audit?.metadata) {
      const meta = audit.metadata as Record<string, any>;
      rejectionReason = typeof meta.reason === "string" ? meta.reason : null;
    }
  }

  const serialized: SerializedDetail = {
    id: master.id,
    masterCode: master.masterCode,
    name: master.name,
    brand: master.brand,
    barcode: master.barcode,
    qrCode: master.qrCode,
    images: master.images as string[],
    status: master.status,
    version: master.version,
    createdAt: master.createdAt.toISOString(),
    updatedAt: master.updatedAt.toISOString(),
    description: master.description,
    category: master.category,
    createdByUser: master.createdByUser,
    approvedByUser: master.approvedByUser,
    approvedAt: master.approvedAt?.toISOString() ?? null,
    variants: master.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      barcode: v.barcode,
      qrCode: v.qrCode,
      attributes: (v.attributes as Array<{ name: string; value: string }>) ?? [],
      isDefault: v.isDefault,
    })),
    versions: master.versions.map((v) => ({
      id: v.id,
      version: v.version,
      changeReason: v.changeReason,
      createdAt: v.createdAt.toISOString(),
      changedByUserId: v.changedByUserId,
    })),
    rejectionReason,
    variantCount: master._count.variants,
    merchantProductCount: master._count.merchantProducts,
  };

  return (
    <MasterProductDetail
      master={serialized}
      isAdmin={isAdmin}
      isOwner={master.createdByUserId === current.user.id}
    />
  );
}