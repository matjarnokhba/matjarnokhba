import { loadUserNames } from "@/lib/stock-api";
import { movementTypeLabel, referenceLabel, STOCK_SOURCE_LABELS } from "@/lib/stock-labels";

export type MovementHistoryQuery = {
  sellerId: number;
  variantId?: number;
  productId?: number;
  bucket?: "SELLABLE" | "DEFECTIVE";
  page: number;
  limit: number;
};

// سجل حركات المخزون مع تفاصيل المصدر والأشخاص والإيصالات
export async function loadMovementHistory(prisma: any, q: MovementHistoryQuery) {
  const variantWhere: any = { sellerId: q.sellerId };
  if (q.variantId) variantWhere.id = q.variantId;
  if (q.productId) variantWhere.productId = q.productId;
  const where: any = { inventory: { variant: variantWhere } };
  if (q.bucket) where.stockBucket = q.bucket;

  const [rows, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: {
        inventory: {
          select: {
            variant: {
              select: {
                id: true,
                sku: true,
                product: { select: { id: true, name: true } },
                optionValues: { select: { optionValue: { select: { value: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  const receiptItemIds = [...new Set(rows.map((r: any) => r.receiptItemId).filter((x: any) => typeof x === "number"))] as number[];
  const refIds = (t: string) =>
    [...new Set(rows.filter((r: any) => r.referenceType === t && r.referenceId != null).map((r: any) => Number(r.referenceId)))] as number[];
  const saleIds = refIds("STORE_SALE");
  const returnItemIds = refIds("STORE_SALE_RETURN");

  const [receiptItems, sales, returnItems] = await Promise.all([
    receiptItemIds.length
      ? prisma.stockReceiptItem.findMany({
          where: { id: { in: receiptItemIds }, receipt: { sellerId: q.sellerId } },
          select: {
            id: true,
            approvedQuantity: true,
            adjustmentReason: true,
            unitCost: true,
            receipt: {
              select: {
                id: true, sourceType: true, sourceName: true, sourcePhone: true, sourceNote: true,
                invoiceUrl: true, totalCost: true,
                purchasedByUserId: true, receivedByUserId: true, enteredByUserId: true, decidedByUserId: true, decidedAt: true,
              },
            },
          },
        })
      : [],
    saleIds.length
      ? prisma.storeSale.findMany({
          where: { id: { in: saleIds }, sellerId: q.sellerId },
          select: { id: true, receiptNumber: true, customerName: true, customerPhone: true },
        })
      : [],
    returnItemIds.length
      ? prisma.storeSaleReturnItem.findMany({
          where: { id: { in: returnItemIds }, storeReturn: { sellerId: q.sellerId } },
          select: {
            id: true, unitPrice: true, condition: true, note: true,
            storeReturn: { select: { id: true, reason: true, storeSale: { select: { receiptNumber: true } } } },
          },
        })
      : [],
  ]);

  const personIds = new Set<number>();
  for (const r of rows as any[]) if (typeof r.performedById === "number") personIds.add(r.performedById);
  for (const ri of receiptItems as any[]) {
    for (const k of ["purchasedByUserId", "receivedByUserId", "enteredByUserId", "decidedByUserId"]) {
      const v = ri.receipt?.[k];
      if (typeof v === "number") personIds.add(v);
    }
  }
  const names = await loadUserNames(prisma, [...personIds]);
  const person = (id: number | null | undefined) => (id == null ? null : { id, name: names.get(id) ?? null });
  const num = (v: any) => (v == null ? null : Number(v));

  const riMap = new Map<number, any>((receiptItems as any[]).map((x) => [x.id, x]));
  const saleMap = new Map<number, any>((sales as any[]).map((x) => [x.id, x]));
  const retMap = new Map<number, any>((returnItems as any[]).map((x) => [x.id, x]));

  const movements = (rows as any[]).map((m) => {
    const v = m.inventory?.variant;
    const refId = m.referenceId == null ? null : Number(m.referenceId);
    const dto: any = {
      id: String(m.id),
      createdAt: m.createdAt,
      type: m.type,
      typeLabel: movementTypeLabel(m.type),
      bucket: m.stockBucket,
      product: {
        variantId: v?.id ?? null,
        name: v?.product?.name ?? null,
        optionsLabel: (v?.optionValues ?? []).map((o: any) => o.optionValue?.value).filter(Boolean).join(" / "),
        sku: v?.sku ?? null,
      },
      beforeQuantity: m.beforeQuantity,
      afterQuantity: m.afterQuantity,
      quantityChange: m.quantityChange,
      reason: m.reason ?? null,
      performedBy: person(m.performedById),
      source: { type: m.referenceType ?? null, label: referenceLabel(m.referenceType), referenceId: refId },
    };

    if (m.receiptItemId != null && riMap.has(m.receiptItemId)) {
      const ri = riMap.get(m.receiptItemId);
      const rc = ri.receipt;
      dto.receipt = {
        id: rc.id,
        sourceType: rc.sourceType,
        sourceLabel: STOCK_SOURCE_LABELS[rc.sourceType] ?? rc.sourceType,
        sourceName: rc.sourceName ?? null,
        sourcePhone: rc.sourcePhone ?? null,
        sourceNote: rc.sourceNote ?? null,
        invoiceUrl: rc.invoiceUrl ?? null,
        totalCost: num(rc.totalCost),
        unitCost: num(ri.unitCost),
        approvedQuantity: ri.approvedQuantity ?? null,
        adjustmentReason: ri.adjustmentReason ?? null,
        purchasedBy: person(rc.purchasedByUserId),
        receivedBy: person(rc.receivedByUserId),
        enteredBy: person(rc.enteredByUserId),
        approvedBy: person(rc.decidedByUserId),
        approvedAt: rc.decidedAt ?? null,
      };
    }
    if (m.referenceType === "STORE_SALE" && refId != null && saleMap.has(refId)) {
      const s = saleMap.get(refId);
      dto.sale = { id: s.id, receiptNumber: s.receiptNumber, customerName: s.customerName ?? null, customerPhone: s.customerPhone ?? null };
    }
    if (m.referenceType === "STORE_SALE_RETURN" && refId != null && retMap.has(refId)) {
      const r = retMap.get(refId);
      dto.saleReturn = {
        returnId: r.storeReturn.id,
        receiptNumber: r.storeReturn.storeSale.receiptNumber,
        reason: r.storeReturn.reason ?? null,
        condition: r.condition,
        note: r.note ?? null,
        unitPrice: num(r.unitPrice),
      };
    }
    return dto;
  });

  return { total, page: q.page, limit: q.limit, movements };
}