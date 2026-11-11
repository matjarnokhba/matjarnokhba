import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const postSchema = z.object({
  mode: z.enum(["SHARED", "SPLIT"]),
  retailSplit: z.number().int().min(0).optional(),
  variantSplits: z.array(z.object({
    masterVariantId: z.number().int().positive(),
    retailQty: z.number().int().min(0),
  })).optional(),
});

async function ensureOwner(offerId: number, userId: number) {
  const offer = await prisma.wholesaleOffer.findFirst({
    where: { id: offerId, deletedAt: null },
    select: {
      id: true,
      businessUnitId: true,
      masterId: true,
      status: true,
      businessUnit: {
        select: {
          owner: { select: { userId: true } },
          members: {
            where: { userId, isActive: true, deletedAt: null },
            select: { permissions: true },
          },
        },
      },
    },
  });
  if (!offer) return { error: "العرض غير موجود", status: 404 };
  const isOwner = offer.businessUnit.owner.userId === userId;
  const isManager = offer.businessUnit.members.some((m) => {
    const perms = m.permissions as string[] | null;
    return Array.isArray(perms) && perms.includes("offers.write");
  });
  if (!isOwner && !isManager) return { error: "غير مصرح", status: 403 };
  if (offer.status === "ARCHIVED") {
    return { error: "لا يمكن التعديل على عرض مؤرشف", status: 400 };
  }
  return { offer };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
    const { id } = await params;
    const offerId = parseInt(id);
    if (isNaN(offerId)) return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    const check = await ensureOwner(offerId, current.user.id);
    if ("error" in check) return NextResponse.json({ success: false, message: check.error }, { status: check.status });
    const offer = check.offer!;

    const pool = await prisma.inventoryPool.findUnique({
      where: { businessUnitId_masterId: { businessUnitId: offer.businessUnitId, masterId: offer.masterId } },
      include: {
        variants: {
          include: {
            masterVariant: { select: { id: true, sku: true, barcode: true, attributes: true } },
          },
        },
      },
    });
    if (!pool) {
      return NextResponse.json({ success: false, message: "لا يوجد pool لهذا العرض" }, { status: 404 });
    }

    const seller = await prisma.seller.findFirst({
      where: { userId: current.user.id, deletedAt: null },
      select: { id: true },
    });

    // Compute retail qty per masterVariantId + linked products
    const masterVariantIds = pool.variants.map((v) => v.masterVariantId);
    const retailByMv = new Map<number, number>();
    let linkedProducts: Array<{ id: number; name: string; poolId: number | null }> = [];

    if (seller && masterVariantIds.length > 0) {
      const productVariants = await prisma.productVariant.findMany({
        where: { sellerId: seller.id, masterVariantId: { in: masterVariantIds } },
        select: {
          masterVariantId: true,
          inventory: { select: { quantity: true } },
          product: { select: { id: true, name: true, poolId: true } },
        },
      });
      const productIds = new Set<number>();
      for (const pv of productVariants) {
        if (!pv.masterVariantId) continue;
        const q = pv.inventory?.quantity ?? 0;
        retailByMv.set(pv.masterVariantId, (retailByMv.get(pv.masterVariantId) || 0) + q);
        productIds.add(pv.product.id);
      }
      if (productIds.size > 0) {
        linkedProducts = await prisma.product.findMany({
          where: { id: { in: Array.from(productIds) } },
          select: { id: true, name: true, poolId: true },
        });
      }
    }

    const variantSummary = pool.variants.map((v) => ({
      masterVariantId: v.masterVariantId,
      sku: v.masterVariant.sku,
      barcode: v.masterVariant.barcode,
      attributes: v.masterVariant.attributes,
      wholesaleQty: v.quantity,
      reservedQty: v.reservedQuantity,
      retailQty: retailByMv.get(v.masterVariantId) ?? 0,
    }));

    const totalWholesale = variantSummary.reduce((s, v) => s + v.wholesaleQty, 0);
    const totalRetail = variantSummary.reduce((s, v) => s + v.retailQty, 0);

    return NextResponse.json({
      success: true,
      mode: pool.mode,
      poolId: pool.id,
      variants: variantSummary,
      totalWholesale,
      totalRetail,
      linkedProducts,
      hasRetailProduct: linkedProducts.length > 0,
    });
  } catch (e: any) {
    console.error("inventory-mode GET:", e);
    return NextResponse.json({ success: false, message: e?.message || "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) return NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 });
    const { id } = await params;
    const offerId = parseInt(id);
    if (isNaN(offerId)) return NextResponse.json({ success: false, message: "معرف غير صحيح" }, { status: 400 });
    const check = await ensureOwner(offerId, current.user.id);
    if ("error" in check) return NextResponse.json({ success: false, message: check.error }, { status: check.status });
    const offer = check.offer!;

    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "بيانات غير صحيحة" },
        { status: 400 }
      );
    }

    const { mode, retailSplit, variantSplits } = parsed.data;

    const pool = await prisma.inventoryPool.findUnique({
      where: { businessUnitId_masterId: { businessUnitId: offer.businessUnitId, masterId: offer.masterId } },
      include: { variants: true },
    });
    if (!pool) return NextResponse.json({ success: false, message: "pool غير موجود" }, { status: 404 });

    // M11.9c: allow SPLIT→SPLIT with new retailSplit (re-distribute)
    // Only skip when mode === SHARED (already unified) OR SPLIT without new retailSplit
    if (pool.mode === mode && (mode === "SHARED" || (retailSplit === undefined && !variantSplits))) {
      return NextResponse.json({ success: true, mode, changed: false });
    }

    const seller = await prisma.seller.findFirst({
      where: { userId: current.user.id, deletedAt: null },
      select: { id: true },
    });
    if (!seller) return NextResponse.json({ success: false, message: "لا يوجد متجر" }, { status: 400 });

    const masterVariantIds = pool.variants.map((v) => v.masterVariantId);

    if (mode === "SHARED") {
      // Merge: for each mv, retail qty + wholesale qty → new total (in both)
      await prisma.$transaction(async (tx) => {
        for (const mvId of masterVariantIds) {
          const pvs = await tx.productVariant.findMany({
            where: { sellerId: seller.id, masterVariantId: mvId },
            select: { id: true, inventory: { select: { id: true, quantity: true } } },
          });
          const retailTotal = pvs.reduce((s, pv) => s + (pv.inventory?.quantity ?? 0), 0);

          const poolVar = pool.variants.find((v) => v.masterVariantId === mvId)!;
          const newTotal = poolVar.quantity + retailTotal;

          await tx.inventoryPoolVariant.update({
            where: { id: poolVar.id },
            data: { quantity: newTotal },
          });

          // Consolidate: first PV.Inventory gets newTotal, rest 0
          if (pvs.length > 0) {
            const firstInv = pvs[0].inventory;
            if (firstInv) {
              await tx.inventory.update({ where: { id: firstInv.id }, data: { quantity: newTotal } });
              for (let i = 1; i < pvs.length; i++) {
                if (pvs[i].inventory) {
                  await tx.inventory.update({ where: { id: pvs[i].inventory!.id }, data: { quantity: 0 } });
                }
              }
            }
          }
        }

        // Link products
        const productIds = await tx.productVariant.findMany({
          where: { sellerId: seller.id, masterVariantId: { in: masterVariantIds } },
          select: { product: { select: { id: true } } },
          distinct: ["productId"],
        });
        const pIds = productIds.map((p) => p.product.id);
        if (pIds.length > 0) {
          await tx.product.updateMany({
            where: { id: { in: pIds } },
            data: { poolId: pool.id },
          });
        }

        await tx.inventoryPool.update({
          where: { id: pool.id },
          data: { mode: "SHARED" },
        });
      }, { timeout: 30000, maxWait: 10000 });
    } else {
      // mode === "SPLIT" — per-variant retail/wholesale split (batched)
      const wasShared = pool.mode === "SHARED";
      
      const splitMap = new Map<number, number>();
      if (variantSplits) {
        for (const vs of variantSplits) {
          splitMap.set(vs.masterVariantId, vs.retailQty);
        }
      }
      
      await prisma.$transaction(async (tx) => {
        const allPvs = await tx.productVariant.findMany({
          where: { sellerId: seller.id, masterVariantId: { in: masterVariantIds } },
          select: {
            id: true,
            masterVariantId: true,
            inventory: { select: { id: true, quantity: true } },
          },
        });
        
        const pvsByMv = new Map<number, typeof allPvs>();
        for (const pv of allPvs) {
          if (!pv.masterVariantId) continue;
          if (!pvsByMv.has(pv.masterVariantId)) pvsByMv.set(pv.masterVariantId, []);
          pvsByMv.get(pv.masterVariantId)!.push(pv);
        }
        
        const zeroInventoryIds: number[] = [];
        const poolUpdates: Array<{ id: number; quantity: number }> = [];
        const invUpdates: Array<{ id: number; quantity: number }> = [];
        
        for (const poolVar of pool.variants) {
          const mvId = poolVar.masterVariantId;
          const pvs = pvsByMv.get(mvId) ?? [];
          const currentRetail = pvs.reduce((s, pv) => s + (pv.inventory?.quantity ?? 0), 0);
          const totalQty = wasShared ? poolVar.quantity : poolVar.quantity + currentRetail;
          
          let retailTarget: number;
          if (splitMap.has(mvId)) {
            retailTarget = splitMap.get(mvId)!;
          } else if (retailSplit !== undefined) {
            retailTarget = retailSplit;
          } else {
            retailTarget = Math.floor(totalQty / 2);
          }
          
          const clampedRetail = Math.max(0, Math.min(totalQty, retailTarget));
          const wholesaleQty = totalQty - clampedRetail;
          
          poolUpdates.push({ id: poolVar.id, quantity: wholesaleQty });
          
          if (pvs.length > 0 && pvs[0].inventory) {
            invUpdates.push({ id: pvs[0].inventory.id, quantity: clampedRetail });
            for (let i = 1; i < pvs.length; i++) {
              if (pvs[i].inventory) zeroInventoryIds.push(pvs[i].inventory!.id);
            }
          }
        }
        
        await Promise.all(
          poolUpdates.map((u) =>
            tx.inventoryPoolVariant.update({ where: { id: u.id }, data: { quantity: u.quantity } })
          )
        );
        
        await Promise.all(
          invUpdates.map((u) =>
            tx.inventory.update({ where: { id: u.id }, data: { quantity: u.quantity } })
          )
        );
        
        if (zeroInventoryIds.length > 0) {
          await tx.inventory.updateMany({
            where: { id: { in: zeroInventoryIds } },
            data: { quantity: 0 },
          });
        }
        
        await tx.product.updateMany({
          where: { poolId: pool.id },
          data: { poolId: null },
        });
        
        await tx.inventoryPool.update({
          where: { id: pool.id },
          data: { mode: "SPLIT" },
        });
      }, { timeout: 30000, maxWait: 10000 });
    }

    return NextResponse.json({ success: true, mode, changed: true });
  } catch (e: any) {
    console.error("inventory-mode POST:", e);
    return NextResponse.json({ success: false, message: e?.message || "حدث خطأ" }, { status: 500 });
  }
}