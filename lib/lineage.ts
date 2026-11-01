import { prisma } from "@/lib/prisma";

export type LineageTransferTypeEnum =
  | "INITIAL_CREATION"
  | "WHOLESALE_SALE"
  | "INTERNAL_TRANSFER"
  | "RETAIL_IMPORT"
  | "RETURN";

export type LineageRecordInput = {
  masterId: number;
  masterVariantId: number;
  fromBusinessId: number | null;
  toBusinessId: number;
  orderId?: number | null;
  orderItemId?: number | null;
  quantity: number;
  unitPrice: number | string;
  transferType: LineageTransferTypeEnum;
  notes?: string | null;
  currency?: string;
};

export async function recordLineage(tx: any, params: LineageRecordInput) {
  const db = tx || prisma;
  if (params.quantity <= 0) {
    throw new Error("الكمية في السجل يجب أن تكون أكبر من صفر");
  }
  return db.productLineage.create({
    data: {
      masterId: params.masterId,
      masterVariantId: params.masterVariantId,
      fromBusinessId: params.fromBusinessId,
      toBusinessId: params.toBusinessId,
      orderId: params.orderId ?? null,
      orderItemId: params.orderItemId ?? null,
      quantity: params.quantity,
      unitPrice: params.unitPrice,
      currency: params.currency ?? "MAD",
      transferType: params.transferType,
      notes: params.notes ?? null,
    },
  });
}

export async function getMasterVariantChain(masterVariantId: number) {
  return prisma.productLineage.findMany({
    where: { masterVariantId },
    orderBy: { createdAt: "asc" },
    include: {
      fromBusiness: { select: { id: true, name: true, type: true, city: true } },
      toBusiness: { select: { id: true, name: true, type: true, city: true } },
      order: { select: { id: true, orderNumber: true } },
    },
  });
}

export async function getBusinessInventory(businessId: number) {
  return prisma.wholesaleInventory.findMany({
    where: { businessId, quantity: { gt: 0 } },
    orderBy: { updatedAt: "desc" },
    include: {
      master: {
        select: { id: true, name: true, brand: true, images: true, categoryId: true },
      },
      masterVariant: {
        select: { id: true, options: true, optionsHash: true, sku: true, barcode: true },
      },
    },
  });
}

export async function addWholesaleStock(
  tx: any,
  params: {
    businessId: number;
    masterId: number;
    masterVariantId: number;
    quantity: number;
    unitCost: number | string;
    sourceBusinessId?: number | null;
  }
) {
  const db = tx || prisma;
  if (params.quantity <= 0) throw new Error("الكمية يجب أن تكون أكبر من صفر");

  return db.wholesaleInventory.upsert({
    where: {
      businessId_masterVariantId: {
        businessId: params.businessId,
        masterVariantId: params.masterVariantId,
      },
    },
    update: {
      quantity: { increment: params.quantity },
      lastUnitCost: params.unitCost,
      lastSourceBusinessId: params.sourceBusinessId ?? undefined,
    },
    create: {
      businessId: params.businessId,
      masterId: params.masterId,
      masterVariantId: params.masterVariantId,
      quantity: params.quantity,
      lastUnitCost: params.unitCost,
      lastSourceBusinessId: params.sourceBusinessId ?? null,
    },
  });
}

export async function consumeWholesaleStock(
  tx: any,
  params: {
    businessId: number;
    masterVariantId: number;
    quantity: number;
  }
) {
  const db = tx || prisma;
  if (params.quantity <= 0) throw new Error("الكمية يجب أن تكون أكبر من صفر");

  const result = await db.wholesaleInventory.updateMany({
    where: {
      businessId: params.businessId,
      masterVariantId: params.masterVariantId,
      quantity: { gte: params.quantity },
    },
    data: { quantity: { decrement: params.quantity } },
  });

  if (result.count === 0) {
    throw new Error("المخزون المتاح غير كافٍ");
  }
  return result;
}