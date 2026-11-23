// مساعد اختبارات: بديل في الذاكرة لعميل Prisma داخل معاملة (لا يُستعمل في الإنتاج)
type Row = Record<string, any>;

function matches(row: Row, where: Row = {}): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      if ("in" in v) {
        if (!(v as any).in.includes(row[k])) return false;
      }
      continue; // فلاتر العلاقات المتداخلة يتجاهلها هذا البديل
    }
    if (row[k] !== v) return false;
  }
  return true;
}

export function createFakeDb(seed: {
  variants: { id: number; sellerId: number; productId: number; isActive?: boolean }[];
  inventory: { variantId: number; quantity: number; reservedQuantity?: number }[];
  sellers?: { id: number; posReturnWindowDays: number }[];
  sales?: { id: number; sellerId: number; receiptNumber: string; createdAt: Date }[];
  saleItems?: { id: number; storeSaleId: number; variantId: number; quantity: number; unitPrice: number }[];
}) {
  const db = {
    variants: seed.variants.map((v) => ({ isActive: true, ...v })) as Row[],
    inventory: seed.inventory.map((i, n) => ({
      id: n + 1,
      reservedQuantity: 0,
      lowStockThreshold: 5,
      defectiveQuantity: 0,
      ...i,
    })) as Row[],
    movements: [] as Row[],
    receipts: [] as Row[],
    receiptItems: [] as Row[],
    sellers: (seed.sellers ?? []).map((s) => ({ ...s })) as Row[],
    sales: (seed.sales ?? []).map((s) => ({ ...s })) as Row[],
    saleItems: (seed.saleItems ?? []).map((s) => ({ ...s })) as Row[],
    returns: [] as Row[],
    returnItems: [] as Row[],
    locks: [] as number[],
  };
  let mvSeq = 1, receiptSeq = 1, itemSeq = 1, returnSeq = 1, returnItemSeq = 1;

  const withItems = (r: Row) => ({ ...r, items: db.receiptItems.filter((i) => i.receiptId === r.id).map((i) => ({ ...i })) });

  const tx: any = {
    $queryRaw: async (strings: TemplateStringsArray, ...vals: any[]) => {
      const text = strings.join("?");
      if (text.includes('FROM "Inventory"')) {
        const inv = db.inventory.find((i) => i.variantId === vals[0]);
        return inv ? [{ ...inv }] : [];
      }
      if (text.includes('FROM "StoreSale"')) {
        const s = db.sales.find((x) => x.id === vals[0] && x.sellerId === vals[1]);
        if (s) db.locks.push(s.id);
        return s ? [{ id: s.id }] : [];
      }
      return [];
    },
    inventory: {
      update: async ({ where, data }: any) => {
        const inv = db.inventory.find((i) => i.id === where.id);
        if (!inv) throw new Error("fake: inventory not found");
        Object.assign(inv, data);
        return { ...inv };
      },
    },
    inventoryMovement: {
      findFirst: async ({ where }: any) => {
        const vin: number[] | undefined = where.inventory?.variantId?.in;
        const invIds = vin ? db.inventory.filter((i) => vin.includes(i.variantId)).map((i) => i.id) : null;
        const hit = db.movements.find((m) => matches(m, where) && (!invIds || invIds.includes(m.inventoryId)));
        return hit ? { id: hit.id } : null;
      },
      create: async ({ data }: any) => {
        const row = { id: mvSeq++, createdAt: new Date(), stockBucket: "SELLABLE", ...data };
        db.movements.push(row);
        return { ...row };
      },
    },
    productVariant: {
      findMany: async ({ where }: any) => db.variants.filter((v) => matches(v, where)).map((v) => ({ id: v.id, productId: v.productId })),
    },
    stockReceipt: {
      findFirst: async ({ where, include }: any) => {
        const r = db.receipts.find((x) => matches(x, where));
        if (!r) return null;
        return include?.items ? withItems(r) : { ...r };
      },
      create: async ({ data, include }: any) => {
        const { items, ...rest } = data;
        const r: Row = { id: receiptSeq++, createdAt: new Date(), decidedByUserId: null, decidedAt: null, rejectionReason: null, ...rest };
        db.receipts.push(r);
        for (const it of items?.create ?? []) {
          db.receiptItems.push({ id: itemSeq++, receiptId: r.id, approvedQuantity: null, adjustmentReason: null, ...it });
        }
        return include?.items ? withItems(r) : { ...r };
      },
      updateMany: async ({ where, data }: any) => {
        const rows = db.receipts.filter((x) => matches(x, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
    },
    stockReceiptItem: {
      update: async ({ where, data }: any) => {
        const it = db.receiptItems.find((i) => i.id === where.id);
        if (!it) throw new Error("fake: item not found");
        Object.assign(it, data);
        return { ...it };
      },
    },
    seller: {
      findUnique: async ({ where }: any) => {
        const s = db.sellers.find((x) => x.id === where.id);
        return s ? { ...s } : null;
      },
    },
    storeSale: {
      findFirst: async ({ where, include }: any) => {
        const s = db.sales.find((x) => matches(x, where));
        if (!s) return null;
        return include?.items
          ? { ...s, items: db.saleItems.filter((i) => i.storeSaleId === s.id).map((i) => ({ ...i })) }
          : { ...s };
      },
    },
    storeSaleReturnItem: {
      groupBy: async ({ where }: any) => {
        const rows = db.returnItems.filter((r) => matches(r, where));
        const map = new Map<number, number>();
        for (const r of rows) map.set(r.storeSaleItemId, (map.get(r.storeSaleItemId) ?? 0) + r.quantity);
        return [...map.entries()].map(([storeSaleItemId, q]) => ({ storeSaleItemId, _sum: { quantity: q } }));
      },
    },
    storeSaleReturn: {
      create: async ({ data, include }: any) => {
        const { items, ...rest } = data;
        const r: Row = { id: returnSeq++, createdAt: new Date(), ...rest };
        db.returns.push(r);
        const created: Row[] = [];
        for (const it of items?.create ?? []) {
          const row = { id: returnItemSeq++, returnId: r.id, ...it };
          db.returnItems.push(row);
          created.push({ ...row });
        }
        return include?.items ? { ...r, items: created } : { ...r };
      },
    },
  };

  return {
    tx,
    db,
    qty: (variantId: number) => db.inventory.find((i) => i.variantId === variantId)!.quantity as number,
    defective: (variantId: number) => db.inventory.find((i) => i.variantId === variantId)!.defectiveQuantity as number,
  };
}