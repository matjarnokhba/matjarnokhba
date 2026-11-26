import "dotenv/config";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { InventoryService } from "../services/inventory.service";

// Concurrency tests for InventoryService (real parallel transactions on the test DB).
// Creates temporary data and removes it at the end. Never runs in production.
if (process.env.NODE_ENV === "production") {
  console.error("🚫 مرفوض: هذا السكربت للاختبار فقط ولا يعمل في production.");
  process.exit(1);
}

type Result = { name: string; passed: boolean; detail: string };
const results: Result[] = [];
function add(name: string, passed: boolean, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}
const msg = (e: unknown) => String((e as Error)?.message ?? e).split("\n").filter(Boolean).slice(-1)[0].slice(0, 160);
const TX_OPTS = { timeout: 30000, maxWait: 30000 };

async function main() {
  const prefix = `CC-${crypto.randomBytes(3).toString("hex")}`;
  const orderBase = 20000000 + Math.floor(Math.random() * 1000000);
  let userId = 0;
  let sellerId = 0;
  let productId = 0;
  const variantIds: number[] = [];

  async function makeVariant(idx: number, quantity: number): Promise<number> {
    const v = await prisma.productVariant.create({
      data: {
        productId,
        sellerId,
        sku: `SKU-${prefix}-${idx}`,
        price: 100,
        isDefault: idx === 1,
        isActive: true,
        optionsHash: `H-${prefix}-${idx}`,
        barcode: `BC-${prefix}-${idx}`,
        inventory: { create: { quantity, reservedQuantity: 0, lowStockThreshold: 5 } },
      },
    });
    variantIds.push(v.id);
    return v.id;
  }

  async function finalQty(variantId: number): Promise<number> {
    const inv = await prisma.inventory.findUnique({ where: { variantId }, select: { quantity: true } });
    return inv?.quantity ?? -1;
  }

  async function checkLedger(label: string, variantId: number, initial: number) {
    const inv = await prisma.inventory.findUnique({ where: { variantId }, select: { id: true, quantity: true } });
    if (!inv) { add(`${label} ledger chain`, false, "no inventory row"); return; }
    const moves = await prisma.inventoryMovement.findMany({
      where: { inventoryId: inv.id },
      orderBy: { id: "asc" },
      select: { beforeQuantity: true, afterQuantity: true, quantityChange: true },
    });
    let prev = initial;
    let ok = true;
    for (const m of moves) {
      if (m.beforeQuantity !== prev || m.afterQuantity !== m.beforeQuantity + m.quantityChange) ok = false;
      prev = m.afterQuantity;
    }
    ok = ok && prev === inv.quantity;
    add(`${label} ledger chain is consistent`, ok, `movements=${moves.length}, last=${prev}, stock=${inv.quantity}`);
  }

  try {
    try { await prisma.$queryRaw`SELECT 1`; add("Database", true); } catch (e) { add("Database", false, msg(e)); return; }
    const category = await prisma.category.findFirst();
    if (!category) { add("Category exists", false, "لا يوجد"); return; }

    const passwordHash = await bcrypt.hash("Test123!", 10);
    const u = await prisma.user.create({
      data: {
        email: `${prefix}-s@test.local`,
        passwordHash,
        name: "تاجر",
        phone: `06${crypto.randomInt(10000000, 99999999)}`,
        role: "SELLER",
        referralCode: `REF-${prefix}-S`,
      },
    });
    userId = u.id;
    const s = await prisma.seller.create({
      data: { userId: u.id, storeName: `متجر ${prefix}`, slug: `seller-${prefix}`, city: "الدار البيضاء", status: "ACTIVE" },
    });
    sellerId = s.id;
    const p = await prisma.product.create({
      data: { sellerId, categoryId: category.id, name: `منتج ${prefix}`, slug: `product-${prefix}`, status: "ACTIVE" },
    });
    productId = p.id;
    add("Setup", true, `seller=${sellerId} product=${productId}`);

    // ── A: no oversell on the last unit ──
    const vA = await makeVariant(1, 1);
    const resA = await Promise.allSettled(
      [1, 2, 3, 4, 5].map((n) => prisma.$transaction((tx) => InventoryService.saleDirect(tx, vA, 1, orderBase + n), TX_OPTS))
    );
    const okA = resA.filter((r) => r.status === "fulfilled").length;
    const qA = await finalQty(vA);
    add("A: 5 parallel sales on 1 unit -> exactly 1 succeeds", okA === 1 && qA === 0, `succeeded=${okA}, final=${qA}`);
    await checkLedger("A:", vA, 1);

    // ── B: same order sold in parallel is idempotent ──
    const vB = await makeVariant(2, 10);
    const resB = await Promise.allSettled(
      [1, 2, 3, 4, 5].map(() => prisma.$transaction((tx) => InventoryService.saleDirect(tx, vB, 1, orderBase + 100), TX_OPTS))
    );
    const failedB = resB.filter((r) => r.status === "rejected").length;
    const qB = await finalQty(vB);
    const invB = await prisma.inventory.findUnique({ where: { variantId: vB }, select: { id: true } });
    const saleRowsB = invB ? await prisma.inventoryMovement.count({ where: { inventoryId: invB.id, type: "SALE" } }) : -1;
    add("B: same order x5 in parallel -> deducted once", failedB === 0 && qB === 9 && saleRowsB === 1, `failed=${failedB}, final=${qB}, SALE rows=${saleRowsB}`);
    await checkLedger("B:", vB, 10);

    // ── C: sales and transfers racing on one row (no lost updates) ──
    const vC = await makeVariant(3, 10);
    const ops: Promise<unknown>[] = [];
    for (let n = 1; n <= 6; n++) {
      ops.push(prisma.$transaction((tx) => InventoryService.saleDirect(tx, vC, 1, orderBase + 200 + n), TX_OPTS));
      ops.push(prisma.$transaction((tx) => InventoryService.transferDelta(tx, vC, 2, userId, "concurrency test"), TX_OPTS));
    }
    const resC = await Promise.allSettled(ops);
    const failedC = resC.filter((r) => r.status === "rejected").length;
    const qC = await finalQty(vC);
    add("C: 6 sales + 6 transfers racing -> exact final stock", failedC === 0 && qC === 10 - 6 + 12, `failed=${failedC}, final=${qC}, expected=16`);
    await checkLedger("C:", vC, 10);
  } catch (e) {
    add("Unexpected error", false, msg(e));
  } finally {
    console.log("\n🧹 تنظيف...");
    for (const vid of variantIds) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.allow_movement_delete', 'on', true)`;
          await tx.inventoryMovement.deleteMany({ where: { inventory: { variantId: vid } } });
          await tx.inventory.deleteMany({ where: { variantId: vid } });
          await tx.productVariant.delete({ where: { id: vid } });
        });
      } catch (e) { console.log("cleanup variant " + vid + " failed: " + msg(e)); }
    }
    if (productId) { try { await prisma.product.delete({ where: { id: productId } }); } catch (e) { console.log("cleanup product failed: " + msg(e)); } }
    if (sellerId) { try { await prisma.seller.delete({ where: { id: sellerId } }); } catch (e) { console.log("cleanup seller failed: " + msg(e)); } }
    if (userId) { try { await prisma.user.delete({ where: { id: userId } }); } catch (e) { console.log("cleanup user failed: " + msg(e)); } }
    console.log("✅ تم التنظيف");
  }

  const failed = results.filter((r) => !r.passed);
  console.log("\n" + "═".repeat(60));
  console.log(`📊 ${results.length - failed.length}/${results.length} نجح · ${failed.length} فشل`);
  console.log("═".repeat(60));
  process.exitCode = failed.length > 0 ? 1 : 0;
}

main()
  .catch((e) => { console.log("FATAL: " + msg(e)); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });