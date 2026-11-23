import { NextResponse } from "next/server";
import { StockReceiptError } from "@/services/stock-receipt.service";
import { StoreSaleReturnError } from "@/services/store-sale-return.service";

/** يحوّل أخطاء الخدمات المعروفة إلى رد HTTP، أو null إن لم يكن الخطأ منها */
export function mapServiceError(e: unknown): NextResponse | null {
  if (e instanceof StockReceiptError || e instanceof StoreSaleReturnError) {
    const status = e.code === "VALIDATION" ? 400 : e.code === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ success: false, message: e.message }, { status });
  }
  return null;
}

type ActorLike = { user: { isSellerOwner?: boolean | null; staffPermissions: string[] } };

/** من يرى كل الطلبات، ومن يرى طلباته هو فقط */
export function stockVisibility(current: ActorLike): { all: boolean; own: boolean } {
  if (current.user.isSellerOwner) return { all: true, own: true };
  const p = current.user.staffPermissions;
  return {
    all: p.includes("APPROVE_STOCK") || p.includes("VIEW_STOCK_HISTORY"),
    own: p.includes("ADD_STOCK"),
  };
}

export const RECEIPT_INCLUDE = {
  items: {
    orderBy: { id: "asc" as const },
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          product: { select: { id: true, name: true, images: { orderBy: { order: "asc" as const }, take: 1, select: { url: true } } } },
          optionValues: {
            select: { optionValue: { select: { value: true, option: { select: { name: true } } } } },
          },
        },
      },
    },
  },
};

export function receiptUserIds(rows: any[]): number[] {
  const ids = new Set<number>();
  for (const r of rows) {
    for (const k of ["purchasedByUserId", "receivedByUserId", "enteredByUserId", "decidedByUserId"]) {
      if (typeof r[k] === "number") ids.add(r[k]);
    }
  }
  return [...ids];
}

export function receiptToDto(r: any, names: Map<number, string>) {
  const person = (id: number | null) => (id == null ? null : { id, name: names.get(id) ?? null });
  const num = (v: any) => (v == null ? null : Number(v));
  return {
    id: r.id as number,
    status: r.status as string,
    sourceType: r.sourceType as string,
    sourceName: r.sourceName ?? null,
    sourcePhone: r.sourcePhone ?? null,
    sourceNote: r.sourceNote ?? null,
    totalCost: num(r.totalCost),
    invoiceUrl: r.invoiceUrl ?? null,
    invoiceName: r.invoiceName ?? null,
    purchasedBy: person(r.purchasedByUserId),
    receivedBy: person(r.receivedByUserId),
    enteredBy: person(r.enteredByUserId),
    decidedBy: person(r.decidedByUserId),
    decidedAt: r.decidedAt ?? null,
    rejectionReason: r.rejectionReason ?? null,
    externalRefType: r.externalRefType ?? null,
    externalRefId: r.externalRefId ?? null,
    createdAt: r.createdAt,
    items: (r.items ?? []).map((i: any) => {
      const opts = (i.variant?.optionValues ?? []).map((o: any) => o.optionValue?.value).filter(Boolean);
      return {
        id: i.id as number,
        variantId: i.variantId ?? null,
        productName: i.variant?.product?.name ?? null,
        productImage: i.variant?.product?.images?.[0]?.url ?? null,
        optionsLabel: opts.join(" / "),
        sku: i.variant?.sku ?? null,
        quantity: i.quantity as number,
        approvedQuantity: i.approvedQuantity ?? null,
        adjustmentReason: i.adjustmentReason ?? null,
        unitCost: num(i.unitCost),
      };
    }),
  };
}

export async function loadUserNames(prisma: any, ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const users: { id: number; name: string | null }[] = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name ?? ""]));
}