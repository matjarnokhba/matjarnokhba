import { prisma } from "@/lib/prisma";
import { ReturnService } from "@/services/return.service";
import { IdentityService } from "@/services/identity.service";

// اختبار تكاملي لتدفق الإرجاع على قاعدة بيانات حقيقية. ينشئ بيانات itest-* ثم يحذفها.
if (process.env.ITEST_CONFIRM !== "yes") {
  console.log("Refusing to run: set ITEST_CONFIRM=yes");
  process.exit(1);
}

const db: any = prisma;
const tag = `itest-${Date.now()}`;
const start = new Date(Date.now() - 60_000);
let pass = 0;
let fail = 0;
const fails: string[] = [];
function T(name: string, ok: boolean, info = "") {
  if (ok) { pass++; console.log(`[PASS] ${name}`); }
  else { fail++; fails.push(name); console.log(`[FAIL] ${name} ${info}`); }
}
const num = (v: unknown) => Number(v ?? 0);

const created = { users: [] as number[], orders: [] as number[], returns: [] as number[], products: [] as number[], sellers: [] as number[], identities: new Set<number>() };
let n = 0;

async function mkOrder(sellerId: number, userId: number, productId: number) {
  n++;
  const order = await db.order.create({
    data: {
      orderNumber: `${tag}-${n}`, userId, sellerId, status: "DELIVERED", paymentStatus: "PAID",
      subtotal: 100, shippingCost: 20, total: 120, shippingAddressSnapshot: {}, customerSnapshot: {}, deliveredAt: new Date(),
    },
  });
  created.orders.push(order.id);
  const item = await db.orderItem.create({
    data: { orderId: order.id, productId, sellerId, productName: "itest product", sku: `${tag}-${n}`, quantity: 1, unitPrice: 100, total: 100 },
  });
  return { order, item };
}

async function main() {
  const category = await db.category.findFirst({ select: { id: true } });
  if (!category) { console.log("No Category in DB - cannot create a test product."); process.exitCode = 1; return; }
  const walletsBefore: any[] = await db.wallet.findMany();
  const strikePol = await db.systemPolicy.findUnique({ where: { key: "SELLER_STRIKE_LIMIT" } });
  const strikeLimit = typeof strikePol?.value === "number" ? strikePol.value : 3;

  const phone = "+2126" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const admin = await db.user.create({ data: { email: `${tag}-admin@example.invalid`, name: "itest admin", role: "ADMIN" } });
  const sellerUser = await db.user.create({ data: { email: `${tag}-seller@example.invalid`, name: "itest seller", role: "SELLER" } });
  const customer = await db.user.create({ data: { email: `${tag}-cust@example.invalid`, name: "itest customer", role: "CUSTOMER", phone } });
  created.users.push(admin.id, sellerUser.id, customer.id);
  const seller = await db.seller.create({ data: { userId: sellerUser.id, storeName: `${tag} store`, slug: tag, status: "ACTIVE" } });
  created.sellers.push(seller.id);
  const product = await db.product.create({ data: { sellerId: seller.id, categoryId: category.id, name: tag, slug: tag } });
  created.products.push(product.id);

  const sellerBalance = async () => num((await db.seller.findUnique({ where: { id: seller.id }, select: { walletBalance: true } })).walletBalance);
  const couponValue = async () => {
    const note = await db.notification.findFirst({ where: { userId: customer.id, title: "تم إصدار قسيمة شراء" }, orderBy: { id: "desc" } });
    const code = note?.message?.match(/REF-[0-9A-F]{8}/)?.[0];
    if (!code) return null;
    const c = await db.coupon.findUnique({ where: { code } });
    return c ? num(c.value) : null;
  };
  const mkReturn = async (order: any, item: any, reasonType: string, evidence: string[]) => {
    const r: any = await ReturnService.create(customer.id, {
      orderId: order.id, reason: "اختبار تكاملي للإرجاع", refundMethod: "COUPON", reasonType, evidenceUrls: evidence,
      items: [{ orderItemId: item.id, quantity: 1 }],
    });
    const id = r?.id ?? r?.returnRequest?.id;
    created.returns.push(id);
    return id as number;
  };
  const finish = async (id: number) => {
    await ReturnService.approve(id, admin.id);
    await ReturnService.complete(id, admin.id);
    return db.returnRequest.findUnique({ where: { id } });
  };
  const EVIDENCE = ["https://example.com/itest-proof.jpg"];

  // ── A1: عيب ──
  console.log("\n--- A: DEFECTIVE (seller pays) ---");
  const a1 = await mkOrder(seller.id, customer.id, product.id);
  let threw = false;
  try { await mkReturn(a1.order, a1.item, "DEFECTIVE", []); } catch { threw = true; }
  T("A: defective return WITHOUT evidence is rejected", threw);
  const a1id = await mkReturn(a1.order, a1.item, "DEFECTIVE", EVIDENCE);
  const a1req = await db.returnRequest.findUnique({ where: { id: a1id } });
  const hoursLeft = (new Date(a1req.decisionDueAt).getTime() - Date.now()) / 3_600_000;
  T("A: reasonType + evidence stored", a1req.reasonType === "DEFECTIVE" && a1req.evidenceUrls.length === 1);
  T(`A: decision deadline is ~48h (got ${hoursLeft.toFixed(1)}h)`, hoursLeft > 47 && hoursLeft < 49);
  const bal0 = await sellerBalance();
  const a1done = await finish(a1id);
  const bal1 = await sellerBalance();
  T("A: payer = SELLER", a1done.shippingPayer === "SELLER", `got ${a1done.shippingPayer}`);
  T("A: shipping fee = 20 (original order shipping)", num(a1done.shippingFee) === 20, `got ${a1done.shippingFee}`);
  const tx1 = await db.walletTransaction.findUnique({ where: { idempotencyKey: `retship:${a1id}` } });
  T("A: seller wallet transaction recorded (20)", !!tx1 && Math.abs(num(tx1.amount)) === 20, `got ${tx1?.amount}`);
  T(`A: seller balance dropped by exactly 20 (${bal0} -> ${bal1})`, Math.abs(bal0 - bal1 - 20) < 0.001);
  const cv1 = await couponValue();
  T(`A: customer refund = 120, no shipping deducted (got ${cv1})`, cv1 === 120);

  // ── B: غيّر رأيه بلا بطاقة ──
  console.log("\n--- B: CHANGED_MIND, no card (customer pays) ---");
  const b = await mkOrder(seller.id, customer.id, product.id);
  const bid = await mkReturn(b.order, b.item, "CHANGED_MIND", []);
  const balB0 = await sellerBalance();
  const bdone = await finish(bid);
  T("B: payer = CUSTOMER", bdone.shippingPayer === "CUSTOMER", `got ${bdone.shippingPayer}`);
  T("B: seller NOT charged", Math.abs((await sellerBalance()) - balB0) < 0.001);
  T("B: no seller shipping transaction", !(await db.walletTransaction.findUnique({ where: { idempotencyKey: `retship:${bid}` } })));
  const cvB = await couponValue();
  T(`B: customer refund = 100 (120 - 20 shipping) (got ${cvB})`, cvB === 100);

  // ── C: بطاقة مجانية ──
  console.log("\n--- C: CHANGED_MIND with a free card ---");
  await IdentityService.attachUser(prisma, customer.id);
  const cu = await db.user.findUnique({ where: { id: customer.id }, select: { identityId: true } });
  if (cu.identityId) created.identities.add(cu.identityId);
  T("C: identity attached to customer", !!cu.identityId);
  const card = await db.freeReturnCard.create({ data: { identityId: cu.identityId } });
  const c1 = await mkOrder(seller.id, customer.id, product.id);
  const c1id = await mkReturn(c1.order, c1.item, "CHANGED_MIND", []);
  const c1done = await finish(c1id);
  T("C: payer = PLATFORM (free card)", c1done.shippingPayer === "PLATFORM", `got ${c1done.shippingPayer}`);
  T("C: card linked to the return", c1done.freeCardId === card.id);
  T("C: card is now used", !!(await db.freeReturnCard.findUnique({ where: { id: card.id } })).usedAt);
  const cvC = await couponValue();
  T(`C: customer refund = 120 (got ${cvC})`, cvC === 120);
  const c2 = await mkOrder(seller.id, customer.id, product.id);
  const c2id = await mkReturn(c2.order, c2.item, "CHANGED_MIND", []);
  const c2done = await finish(c2id);
  T("C: card is single-use: next return is paid by CUSTOMER", c2done.shippingPayer === "CUSTOMER", `got ${c2done.shippingPayer}`);

  // ── E: أخطاء متكررة ──
  console.log("\n--- E: repeated seller fault -> admin alert only ---");
  if (strikeLimit === 3) {
    for (let i = 0; i < 2; i++) {
      const o = await mkOrder(seller.id, customer.id, product.id);
      await finish(await mkReturn(o.order, o.item, "DEFECTIVE", EVIDENCE));
    }
    const alert = await db.notification.findFirst({ where: { userId: admin.id, title: { contains: "تكرر عليه نفس الخطأ" } } });
    T("E: admin got an alert after 3 same-type faults", !!alert);
    const st = await db.seller.findUnique({ where: { id: seller.id }, select: { status: true } });
    T(`E: seller NOT suspended automatically (status ${st.status})`, st.status === "ACTIVE");
  } else {
    console.log(`(skipped: SELLER_STRIKE_LIMIT is ${strikeLimit}, test assumes 3)`);
  }

  // ── D: تلاعب ──
  console.log("\n--- D: fraud rejection suspends the customer ---");
  const d = await mkOrder(seller.id, customer.id, product.id);
  const did = await mkReturn(d.order, d.item, "CHANGED_MIND", []);
  await ReturnService.rejectAsFraud(did, admin.id, "itest: ادعاء كاذب");
  const dreq = await db.returnRequest.findUnique({ where: { id: did } });
  const du = await db.user.findUnique({ where: { id: customer.id }, select: { suspendedAt: true } });
  T("D: return REJECTED", dreq.status === "REJECTED");
  T("D: customer account suspended", !!du.suspendedAt);

  // snapshot for cleanup
  return walletsBefore;
}

async function cleanup(walletsBefore: any[] | undefined) {
  console.log("\n--- cleanup ---");
  const left: string[] = [];
  const step = async (name: string, fn: () => Promise<unknown>) => { try { await fn(); } catch (e: any) { left.push(`${name}: ${String(e?.message ?? e).slice(0, 100)}`); } };
  const codes: string[] = [];
  await step("collect coupon codes", async () => {
    const notes = await db.notification.findMany({ where: { userId: { in: created.users }, title: "تم إصدار قسيمة شراء" }, select: { message: true } });
    for (const x of notes) { const m = String(x.message).match(/REF-[0-9A-F]{8}/); if (m) codes.push(m[0]); }
  });
  await step("notifications", () => db.notification.deleteMany({ where: { createdAt: { gte: start } } }));
  await step("coupons", () => db.coupon.deleteMany({ where: { code: { in: codes } } }));
  await step("return items", () => db.returnItem.deleteMany({ where: { returnId: { in: created.returns } } }));
  await step("returns", () => db.returnRequest.deleteMany({ where: { id: { in: created.returns } } }));
  await step("free cards", () => db.freeReturnCard.deleteMany({ where: { identityId: { in: [...created.identities] } } }));
  await step("seller wallet tx", () => db.walletTransaction.deleteMany({ where: { sellerId: { in: created.sellers } } }));
  await step("order items", () => db.orderItem.deleteMany({ where: { orderId: { in: created.orders } } }));
  await step("orders", () => db.order.deleteMany({ where: { id: { in: created.orders } } }));
  await step("product", () => db.product.deleteMany({ where: { id: { in: created.products } } }));
  await step("seller", () => db.seller.deleteMany({ where: { id: { in: created.sellers } } }));
  await step("sessions", () => db.session.deleteMany({ where: { userId: { in: created.users } } }));
  await step("users", () => db.user.deleteMany({ where: { id: { in: created.users } } }));
  await step("identities", () => db.customerIdentity.deleteMany({ where: { id: { in: [...created.identities] } } }));
  if (walletsBefore) {
    await step("restore wallets", async () => {
      const after: any[] = await db.wallet.findMany();
      const beforeIds = new Set(walletsBefore.map((w) => w.id));
      await db.walletTransactionUnified.deleteMany({ where: { createdAt: { gte: start } } });
      for (const w of after) {
        if (!beforeIds.has(w.id)) { await db.wallet.delete({ where: { id: w.id } }); continue; }
        const b = walletsBefore.find((x) => x.id === w.id);
        if (num(b.balance) !== num(w.balance) || num(b.heldBalance) !== num(w.heldBalance)) {
          await db.wallet.update({ where: { id: w.id }, data: { balance: b.balance, heldBalance: b.heldBalance } });
        }
      }
    });
  }
  if (left.length) { console.log("LEFTOVERS (clean manually):"); left.forEach((l) => console.log("  - " + l)); }
  else console.log("cleanup complete: no test data left");
}

(async () => {
  let wb: any[] | undefined;
  try {
    wb = await main();
  } catch (e: any) {
    fail++; fails.push("script crashed");
    console.log("[FAIL] script crashed:", e?.message ?? e);
  } finally {
    await cleanup(wb);
    console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
    if (fails.length) fails.forEach((f) => console.log("  - " + f));
    await db.$disconnect?.();
    process.exit(fail > 0 ? 1 : 0);
  }
})();