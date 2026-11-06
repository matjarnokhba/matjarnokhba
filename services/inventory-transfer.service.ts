import { prisma } from "@/lib/prisma";
import {
  NotFoundError,
  ValidationError,
} from "@/lib/wholesale/errors";
import { getBusinessUnitContext } from "@/lib/wholesale/context";
import { logWholesaleAction } from "@/lib/wholesale/audit";
import { WholesaleInventoryService } from "./wholesale-inventory.service";

type TransferInput = {
  businessUnitId: number;
  merchantVariantId: number;
  fromAccountId: number;
  toAccountId: number;
  quantity: number;
  notes?: string | null;
};

async function generateTransferNumber(tx: any): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await tx.orderSequence.upsert({
    where: { year: year + 1000000 },
    create: { year: year + 1000000, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return `TR-${year}-${String(seq.lastNumber).padStart(5, "0")}`;
}

async function getWeightedAvgCost(
  tx: any,
  merchantVariantId: number,
  inventoryAccountId: number
): Promise<number> {
  const batches = await tx.inventoryBatch.findMany({
    where: {
      merchantVariantId,
      inventoryAccountId,
      quantityRemaining: { gt: 0 },
    },
    select: { quantityRemaining: true, unitCost: true },
  });
  if (batches.length === 0) return 0;
  let totalCost = 0;
  let totalQty = 0;
  for (const b of batches) {
    totalCost += b.quantityRemaining * Number(b.unitCost);
    totalQty += b.quantityRemaining;
  }
  return totalQty > 0 ? Math.round((totalCost / totalQty) * 10000) / 10000 : 0;
}

export const InventoryTransferService = {
  async transfer(
    userId: number,
    input: TransferInput
  ): Promise<{ transferId: number; transferNumber: string }> {
    await getBusinessUnitContext(userId, input.businessUnitId);

    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new ValidationError("الكمية يجب أن تكون عددًا صحيحًا موجبًا");
    }

    if (input.fromAccountId === input.toAccountId) {
      throw new ValidationError(
        "لا يمكن التحويل إلى نفس الحساب — اختر حسابين مختلفين"
      );
    }

    const [fromAcc, toAcc] = await Promise.all([
      prisma.inventoryAccount.findFirst({
        where: {
          id: input.fromAccountId,
          businessUnitId: input.businessUnitId,
        },
        select: { id: true, type: true, isActive: true },
      }),
      prisma.inventoryAccount.findFirst({
        where: {
          id: input.toAccountId,
          businessUnitId: input.businessUnitId,
        },
        select: { id: true, type: true, isActive: true },
      }),
    ]);

    if (!fromAcc) throw new NotFoundError("InventoryAccount", input.fromAccountId);
    if (!toAcc) throw new NotFoundError("InventoryAccount", input.toAccountId);
    if (!fromAcc.isActive) throw new ValidationError("الحساب المصدر غير نشط");
    if (!toAcc.isActive) throw new ValidationError("الحساب الهدف غير نشط");

    const mv = await prisma.merchantVariant.findFirst({
      where: {
        id: input.merchantVariantId,
        merchantProduct: {
          businessUnitId: input.businessUnitId,
          deletedAt: null,
        },
      },
      select: { id: true },
    });
    if (!mv) {
      throw new NotFoundError("MerchantVariant", input.merchantVariantId);
    }

    return prisma.$transaction(async (tx) => {
      const transferNumber = await generateTransferNumber(tx);

      const transfer = await tx.inventoryTransfer.create({
        data: {
          transferNumber,
          businessUnitId: input.businessUnitId,
          merchantVariantId: input.merchantVariantId,
          fromAccountId: input.fromAccountId,
          toAccountId: input.toAccountId,
          quantity: input.quantity,
          notes: input.notes?.trim() || null,
          createdByUserId: userId,
        },
      });

      const unitCost = await getWeightedAvgCost(
        tx,
        input.merchantVariantId,
        input.fromAccountId
      );

      await WholesaleInventoryService.transferOut(tx, {
        merchantVariantId: input.merchantVariantId,
        inventoryAccountId: input.fromAccountId,
        businessUnitId: input.businessUnitId,
        quantity: input.quantity,
        referenceType: "INVENTORY_TRANSFER",
        referenceId: transfer.id,
        type: "TRANSFER_OUT",
        notes: input.notes?.trim() || undefined,
        userId,
      });

      await WholesaleInventoryService.transferIn(tx, {
        merchantVariantId: input.merchantVariantId,
        inventoryAccountId: input.toAccountId,
        businessUnitId: input.businessUnitId,
        quantity: input.quantity,
        unitCost: unitCost > 0 ? unitCost : 0,
        sourceType: "TRANSFER",
        sourceReferenceId: transfer.id,
        referenceType: "INVENTORY_TRANSFER",
        referenceId: transfer.id,
        notes: input.notes?.trim() || undefined,
        userId,
      });

      await logWholesaleAction(tx, {
        userId,
        businessUnitId: input.businessUnitId,
        action: "inventory_transfer.created",
        entityType: "InventoryTransfer",
        entityId: transfer.id,
        after: {
          transferNumber,
          merchantVariantId: input.merchantVariantId,
          fromAccountId: input.fromAccountId,
          toAccountId: input.toAccountId,
          quantity: input.quantity,
          unitCost,
        },
      });

      return { transferId: transfer.id, transferNumber };
    });
  },

  async list(
    userId: number,
    businessUnitId: number,
    filters: {
      merchantVariantId?: number;
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    await getBusinessUnitContext(userId, businessUnitId);
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 30));

    const where: any = { businessUnitId };
    if (filters.merchantVariantId) {
      where.merchantVariantId = filters.merchantVariantId;
    }

    const [total, items] = await Promise.all([
      prisma.inventoryTransfer.count({ where }),
      prisma.inventoryTransfer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  },
};