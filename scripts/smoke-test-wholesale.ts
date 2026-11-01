/**
 * Smoke test for the full wholesale flow.
 * Creates test data, verifies each step, cleans up.
 * If any step fails, STOP and keep data for inspection.
 *
 * Run: npx tsx scripts/smoke-test-wholesale.ts
 */
import { prisma } from "../lib/prisma";
import { WholesaleOrderService } from "../services/wholesale-order.service";
import { ProductMasterService } from "../services/product-master.service";
import { WholesaleOfferService } from "../services/wholesale-offer.service";
import { WholesaleReturnService } from "../services/wholesale-return.service";

const TS = Date.now();
const TAG = `smoke-${TS}`;
const TEST_EMAIL_SELLER = `${TAG}-seller@test.local`;
const TEST_EMAIL_BUYER = `${TAG}-buyer@test.local`;

type Cleanup = { model: string; where: any }[];

async function cleanup(collected: Cleanup) {
  console.log("\n[CLEANUP] Removing test data (leaf → root)...");
  // Correct deletion order — children before parents
  const ORDER = [
    "wholesaleReturnStatusHistory",
    "wholesaleReturnItem",
    "wholesaleReturnRequest",
    "productLineage",
    "ledgerTransaction",
    "wholesaleOrderStatusHistory",
    "wholesaleOrderItem",
    "wholesaleOrder",
    "wholesaleOfferVariant",
    "wholesaleOfferTier",
    "wholesaleOffer",
    "wholesaleInventory",
    "productMasterVariant",
    "productMaster",
    "inventory",
    "productVariant",
    "productImage",
    "product",
    "ledgerAccount",
    "businessMember",
    "supplyActivity",
    "seller",
    "business",
    "user",
  ];
  const byModel = new Map<string, any[]>();
  for (const c of collected) {
    if (!byModel.has(c.model)) byModel.set(c.model, []);
    byModel.get(c.model)!.push(c.where);
  }
  for (const model of ORDER) {
    const wheres = byModel.get(model);
    if (!wheres || wheres.length === 0) continue;
    try {
      const merged = { OR: wheres };
      const result = await (prisma as any)[model].deleteMany({ where: merged });
      console.log(`  ${model}: ${result.count} deleted`);
    } catch (e: any) {
      console.warn(`  ${model} failed: ${e.message}`);
    }
  }
}

async function run() {
  const cleanupList: Cleanup = [];
  const startTime = Date.now();
  let step = 0;

  function log(msg: string) {
    step++;
    console.log(`\n[${step}] ${msg}`);
  }

  function assert(cond: any, msg: string) {
    if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  }

  try {
    // ─── Setup: 2 users ───
    log("Create seller + buyer users");
    const sellerUser = await prisma.user.create({
      data: {
        name: `${TAG} Seller`,
        email: TEST_EMAIL_SELLER,
        passwordHash: "$2a$12$dummy",
        emailVerified: true,
        role: "CUSTOMER",
        referralCode: `S${TS.toString().slice(-10)}`,
      },
    });
    cleanupList.push({ model: "user", where: { id: sellerUser.id } });

    const buyerUser = await prisma.user.create({
      data: {
        name: `${TAG} Buyer`,
        email: TEST_EMAIL_BUYER,
        passwordHash: "$2a$12$dummy",
        emailVerified: true,
        role: "CUSTOMER",
        referralCode: `B${TS.toString().slice(-10)}`,
      },
    });
    cleanupList.push({ model: "user", where: { id: buyerUser.id } });
    console.log(`  seller: ${sellerUser.id}, buyer: ${buyerUser.id}`);

    // ─── Get a category ───
    log("Get existing category");
    const category = await prisma.category.findFirst({
      where: { deletedAt: null },
      select: { id: true, name: true },
    });
    assert(category, "No category found — create one first");
    console.log(`  category: ${category!.id} - ${category!.name}`);

    // ─── Create 2 businesses ───
    log("Create seller + buyer businesses (FACTORY / WHOLESALE_TRADER)");
    const sellerBiz = await prisma.business.create({
      data: {
        type: "INDEPENDENT_SUPPLIER",
        status: "VERIFIED",
        name: `${TAG} Factory`,
        slug: `${TAG}-factory`,
        city: "Casablanca",
        phone: "+212600000001",
        ownerUserId: sellerUser.id,
        verifiedAt: new Date(),
      },
    });
    cleanupList.push({ model: "business", where: { id: sellerBiz.id } });
    const sellerSA = await prisma.supplyActivity.create({
      data: {
        businessId: sellerBiz.id,
        type: "FACTORY",
        status: "VERIFIED",
        name: sellerBiz.name,
        slug: `${TAG}-factory-sa`,
        city: sellerBiz.city,
        verifiedAt: new Date(),
      },
    });
    cleanupList.push({ model: "supplyActivity", where: { id: sellerSA.id } });
    const sellerMember = await prisma.businessMember.create({
      data: { businessId: sellerBiz.id, userId: sellerUser.id, role: "OWNER" },
    });
    cleanupList.push({ model: "businessMember", where: { id: sellerMember.id } });

    const buyerBiz = await prisma.business.create({
      data: {
        type: "WHOLESALE_TRADER",
        status: "VERIFIED",
        name: `${TAG} Trader`,
        slug: `${TAG}-trader`,
        city: "Rabat",
        phone: "+212600000002",
        ownerUserId: buyerUser.id,
        verifiedAt: new Date(),
      },
    });
    cleanupList.push({ model: "business", where: { id: buyerBiz.id } });
    const buyerSA = await prisma.supplyActivity.create({
      data: {
        businessId: buyerBiz.id,
        type: "TRADER",
        status: "VERIFIED",
        name: buyerBiz.name,
        slug: `${TAG}-trader-sa`,
        city: buyerBiz.city,
        verifiedAt: new Date(),
      },
    });
    cleanupList.push({ model: "supplyActivity", where: { id: buyerSA.id } });

    // ─── A4a: SupplyActivity management ───
    log("A4a: Trader adds COMPANY supply activity");
    const { SupplyActivityService } = await import("../services/supply-activity.service");
    const companySA = await SupplyActivityService.createForTrader(buyerBiz.id, buyerUser.id, {
      type: "COMPANY",
      name: `${TAG} Importer Co`,
      city: buyerBiz.city,
    });
    cleanupList.push({ model: "supplyActivity", where: { id: companySA.id } });
    assert(companySA.type === "COMPANY", "Company SA type should be COMPANY");
    assert(companySA.status === "PENDING", "New SA should be PENDING");
    console.log(`  ✅ COMPANY SA created: ${companySA.id}, status PENDING`);

    log("A4a: Trader tries to add TRADER (should fail)");
    let traderBlocked = false;
    try {
      await SupplyActivityService.createForTrader(buyerBiz.id, buyerUser.id, {
        type: "TRADER" as any, name: "test", city: "x",
      });
    } catch (e: any) {
      if (e.message.includes("TRADER") || e.message.includes("موجود")) traderBlocked = true;
    }
    assert(traderBlocked, "Adding TRADER should be blocked");
    console.log(`  ✅ TRADER addition blocked`);

    log("A4a: List SAs for buyerBiz (expect 2: TRADER + COMPANY)");
    const saList = await SupplyActivityService.listForBusiness(buyerBiz.id);
    assert(saList.length === 2, `Should have 2 SAs, got ${saList.length}`);
    console.log(`  ✅ SA list has 2 items`);

    log("A4a: Admin verifies COMPANY SA");
    await SupplyActivityService.adminVerify(companySA.id, sellerUser.id, true, null);
    const verifiedSA = await prisma.supplyActivity.findUnique({ where: { id: companySA.id } });
    assert(verifiedSA!.status === "VERIFIED", "Company SA should be VERIFIED");
    console.log(`  ✅ Company SA verified`);
    const buyerMember = await prisma.businessMember.create({
      data: { businessId: buyerBiz.id, userId: buyerUser.id, role: "OWNER" },
    });
    // P30.1b: create linked seller (required by assertCanBuy before order creation)
    const buyerSeller = await prisma.seller.create({
      data: {
        userId: buyerUser.id,
        storeName: `${TAG} Retail Store`,
        slug: `${TAG}-retail`,
        isVerified: true,
        status: "ACTIVE",
      },
    });
    cleanupList.push({ model: "seller", where: { id: buyerSeller.id } });
    await prisma.business.update({
      where: { id: buyerBiz.id },
      data: { linkedSellerId: buyerSeller.id },
    });
    console.log(`  buyerSeller: ${buyerSeller.id}, linked to buyerBiz`);
    cleanupList.push({ model: "businessMember", where: { id: buyerMember.id } });
    console.log(`  sellerBiz: ${sellerBiz.id}, buyerBiz: ${buyerBiz.id}`);

    // ─── Create master ───
    log("Create ProductMaster with 2 variants");
    const master = await ProductMasterService.createMaster(sellerBiz.id, sellerUser.id, {
      name: `${TAG} T-Shirt`,
      categoryId: category!.id,
      brand: "SmokeBrand",
      description: "Test product for smoke test",
      images: ["https://via.placeholder.com/400"],
      barcode: `SMOKE-M-${TS}`,
      variants: [
        { sku: `${TAG}-S`, barcode: `SMOKE-V-S-${TS}`, options: { size: "S" } },
        { sku: `${TAG}-M`, barcode: `SMOKE-V-M-${TS}`, options: { size: "M" } },
      ],
    });
    cleanupList.push({ model: "productLineage", where: { masterId: master.id } });
    cleanupList.push({ model: "productMasterVariant", where: { masterId: master.id } });
    cleanupList.push({ model: "productMaster", where: { id: master.id } });
    assert(master.variants.length === 2, "Master should have 2 variants");
    console.log(`  master: ${master.id}, variants: ${master.variants.map(v => v.id).join(",")}`);

    // Verify INITIAL_CREATION lineage
    const initialLineage = await prisma.productLineage.findFirst({
      where: { masterId: master.id, transferType: "INITIAL_CREATION" },
    });
    assert(initialLineage, "INITIAL_CREATION lineage missing");
    console.log(`  ✅ initial lineage: id=${initialLineage!.id}`);

    // ─── Verify master (admin approval simulation) ───
    log("Verify master");
    await ProductMasterService.adminVerify(master.id, true, sellerUser.id);
    const verified = await prisma.productMaster.findUnique({ where: { id: master.id } });
    assert(verified!.isVerified === true, "Master not verified");
    console.log(`  ✅ master verified`);

    // ─── Create offer ───
    log("Create WholesaleOffer with 2 tiers");
    const masterVariantS = master.variants.find((v: any) => v.options?.size === "S")!;
    const masterVariantM = master.variants.find((v: any) => v.options?.size === "M")!;
    
    const offer = await WholesaleOfferService.createOffer(sellerBiz.id, {
      masterId: master.id,
      wholesalePrice: 40,
      retailPrice: 70,
      minOrderQty: 5,
      maxOrderQty: 100,
      unit: "PIECE",
      claimType: "MANUFACTURER",
      leadTimeDays: 2,
      tiers: [
        { minQty: 10, maxQty: 49, unitPrice: 38 },
        { minQty: 50, maxQty: null, unitPrice: 35 },
      ],
      variants: [
        { masterVariantId: masterVariantS.id, stock: 60 },
        { masterVariantId: masterVariantM.id, stock: 40 },
      ],
    });
    cleanupList.push({ model: "wholesaleOfferVariant", where: { offerId: offer.id } });
    cleanupList.push({ model: "wholesaleOfferTier", where: { offerId: offer.id } });
    cleanupList.push({ model: "wholesaleOffer", where: { id: offer.id } });
    assert(offer.claimVerified === true, "Factory should auto-verify MANUFACTURER claim");
    assert(offer.status === "DRAFT", "Offer should start as DRAFT");
    assert(offer.variants.length === 2, "Offer should have 2 variants");
    assert(offer.supplyActivityId === sellerSA.id, `Offer.supplyActivityId should be ${sellerSA.id}, got ${offer.supplyActivityId}`);
    console.log(`  offer: ${offer.id}, total stock: 100, auto-verified: ✅`);
    console.log(`  ✅ supplyActivityId = ${sellerSA.id} (linked correctly)`);

    // ─── Activate offer ───
    log("Activate offer");
    await WholesaleOfferService.updateOfferStatus(offer.id, sellerBiz.id, "activate");
    const activated = await prisma.wholesaleOffer.findUnique({ where: { id: offer.id } });
    assert(activated!.status === "ACTIVE" && activated!.isActive === true, "Offer not active");
    console.log(`  ✅ offer active`);

    // ─── Marketplace visibility ───
    log("Verify marketplace shows offer");
    const market = await WholesaleOfferService.listPublicOffers({ search: "SmokeBrand" });
    const found = market.items.find((o: any) => o.id === offer.id);
    assert(found, "Offer not visible in marketplace");
    assert(found!.availableStock === 100, `Available should be 100, got ${found!.availableStock}`);
    console.log(`  ✅ marketplace: ${market.total} results, stock: ${found!.availableStock}`);

    // ─── Create order ───
    log("Create order (buyer → seller, qty: 15 of variant S)");
    const order = await WholesaleOrderService.createOrder(buyerBiz.id, buyerUser.id, {
      sellerBusinessId: sellerBiz.id,
      items: [
        { offerVariantId: offer.variants.find((v: any) => v.masterVariantId === masterVariantS.id)!.id, quantity: 15 },
      ],
      shippingCost: 0,
      discountAmount: 0,
    });
    cleanupList.push({ model: "wholesaleOrderStatusHistory", where: { orderId: order.id } });
    cleanupList.push({ model: "wholesaleOrderItem", where: { orderId: order.id } });
    cleanupList.push({ model: "wholesaleOrder", where: { id: order.id } });
    assert(order.status === "PENDING", "Order should be PENDING");
    console.log(`  order: ${order.id}, number: ${order.orderNumber}, status: PENDING`);

    // Verify tier applied: 15 pieces should get tier [10-49] = 38/piece
    const orderItem = await prisma.wholesaleOrderItem.findFirst({ where: { orderId: order.id } });
    assert(Number(orderItem!.unitPrice) === 38, `Tier price should be 38, got ${orderItem!.unitPrice}`);
    console.log(`  ✅ tier applied: 38/piece (expected)`);

    // ─── Accept order ───
    log("Seller accepts order → reserved += 15");
    await WholesaleOrderService.acceptOrder(order.id, sellerUser.id);
    const offerVarS = await prisma.wholesaleOfferVariant.findFirst({
      where: { offerId: offer.id, masterVariantId: masterVariantS.id },
    });
    assert(offerVarS!.reserved === 15, `reserved should be 15, got ${offerVarS!.reserved}`);
    assert(offerVarS!.stock === 60, `stock should stay 60, got ${offerVarS!.stock}`);
    console.log(`  ✅ stock=60, reserved=15`);

    // ─── Prepare ───
    log("Seller prepares order");
    await WholesaleOrderService.prepareOrder(order.id, sellerUser.id);
    const afterPrepare = await prisma.wholesaleOrder.findUnique({ where: { id: order.id } });
    assert(afterPrepare!.status === "PREPARING", "Should be PREPARING");
    console.log(`  ✅ PREPARING`);

    // ─── Ship ───
    log("Seller ships order → reserved -= 15, inTransit += 15");
    await WholesaleOrderService.shipOrder(order.id, sellerUser.id, { trackingNumber: "TRACK-001" });
    const afterShip = await prisma.wholesaleOfferVariant.findFirst({
      where: { offerId: offer.id, masterVariantId: masterVariantS.id },
    });
    assert(afterShip!.reserved === 0, `reserved should be 0, got ${afterShip!.reserved}`);
    assert(afterShip!.inTransit === 15, `inTransit should be 15, got ${afterShip!.inTransit}`);
    assert(afterShip!.stock === 60, `stock should be 60, got ${afterShip!.stock}`);
    console.log(`  ✅ stock=60, reserved=0, inTransit=15`);

    // ─── Deliver ───
    log("Buyer confirms delivery → stock -= 15, inTransit -= 15, buyer inventory += 15, lineage recorded");
    await WholesaleOrderService.deliverOrder(order.id, buyerUser.id);
    const afterDeliver = await prisma.wholesaleOfferVariant.findFirst({
      where: { offerId: offer.id, masterVariantId: masterVariantS.id },
    });
    assert(afterDeliver!.stock === 45, `stock should be 45, got ${afterDeliver!.stock}`);
    assert(afterDeliver!.inTransit === 0, `inTransit should be 0, got ${afterDeliver!.inTransit}`);
    
    const buyerInv = await prisma.wholesaleInventory.findFirst({
      where: { businessId: buyerBiz.id, masterVariantId: masterVariantS.id },
    });
    assert(buyerInv, "Buyer inventory missing");
    assert(buyerInv!.quantity === 15, `buyer qty should be 15, got ${buyerInv!.quantity}`);
    cleanupList.push({ model: "wholesaleInventory", where: { businessId: buyerBiz.id } });

    const salesLineage = await prisma.productLineage.findFirst({
      where: { orderId: order.id, transferType: "WHOLESALE_SALE" },
    });
    assert(salesLineage, "WHOLESALE_SALE lineage missing");
    assert(salesLineage!.quantity === 15, "Lineage qty should be 15");
    assert(salesLineage!.fromBusinessId === sellerBiz.id, "Lineage from should be seller");
    assert(salesLineage!.toBusinessId === buyerBiz.id, "Lineage to should be buyer");
    console.log(`  ✅ seller stock=45, buyer qty=15, lineage recorded`);

    // ─── Complete ───
    log("Buyer completes order");
    await WholesaleOrderService.completeOrder(order.id, buyerUser.id);
    const completed = await prisma.wholesaleOrder.findUnique({ where: { id: order.id } });
    assert(completed!.status === "COMPLETED", "Should be COMPLETED");
    console.log(`  ✅ COMPLETED`);

    // ─── Ledger test (after delivery) ───
    log("Verify SALE ledger transaction created at DELIVERY");
    const saleTx = await prisma.ledgerTransaction.findFirst({
      where: { orderId: order.id, type: "SALE", status: "CONFIRMED" },
    });
    assert(saleTx, "SALE transaction missing");
    assert(Number(saleTx!.amount) === Number(order.total), `SALE amount mismatch (${saleTx!.amount} vs ${order.total})`);
    assert(saleTx!.debtorBusinessId === buyerBiz.id, "Debtor should be buyer");
    assert(saleTx!.creditorBusinessId === sellerBiz.id, "Creditor should be seller");
    cleanupList.push({ model: "ledgerTransaction", where: { orderId: order.id } });
    console.log(`  ✅ SALE ledger: ${saleTx!.amount} MAD`);

    log("Verify buyer ledger balance = -total, seller = +total");
    const buyerAcct = await prisma.ledgerAccount.findUnique({
      where: { businessId_counterpartyBusinessId: { businessId: buyerBiz.id, counterpartyBusinessId: sellerBiz.id } },
    });
    const sellerAcct = await prisma.ledgerAccount.findUnique({
      where: { businessId_counterpartyBusinessId: { businessId: sellerBiz.id, counterpartyBusinessId: buyerBiz.id } },
    });
    assert(buyerAcct, "Buyer ledger account missing");
    assert(sellerAcct, "Seller ledger account missing");
    assert(Number(buyerAcct!.balance) === -Number(order.total), `buyer balance should be -${order.total}, got ${buyerAcct!.balance}`);
    assert(Number(sellerAcct!.balance) === Number(order.total), `seller balance should be +${order.total}, got ${sellerAcct!.balance}`);
    cleanupList.push({ model: "ledgerAccount", where: { businessId: buyerBiz.id } });
    cleanupList.push({ model: "ledgerAccount", where: { businessId: sellerBiz.id } });
    console.log(`  ✅ balances: buyer=${buyerAcct!.balance}, seller=${sellerAcct!.balance}`);

    log("Buyer records partial payment (100 MAD)");

    const payment1 = await WholesaleOrderService.recordPayment(order.id, buyerBiz.id, buyerUser.id, 100, "دفعة أولى");
    assert(Number(payment1.amount) === 100, "Payment 1 amount should be 100");
    const buyerAcct2 = await prisma.ledgerAccount.findUnique({
      where: { businessId_counterpartyBusinessId: { businessId: buyerBiz.id, counterpartyBusinessId: sellerBiz.id } },
    });
    const expectedBalance = -Number(order.total) + 100;
    assert(Number(buyerAcct2!.balance) === expectedBalance, `buyer balance should be ${expectedBalance}, got ${buyerAcct2!.balance}`);
    console.log(`  ✅ paid 100, buyer balance: ${buyerAcct2!.balance}`);

    log("Verify overpayment is blocked");
    const overAmount = Number(order.total) - 100 + 1;
    let overBlocked = false;
    try {
      await WholesaleOrderService.recordPayment(order.id, buyerBiz.id, buyerUser.id, overAmount, "زائد");
    } catch (e: any) {
      if (e.message.includes("يتجاوز الدين")) overBlocked = true;
    }
    assert(overBlocked, "Overpayment should be blocked");
    console.log(`  ✅ overpayment blocked`);

    log("Buyer pays remaining (${order.total} - 100)");
    const remaining = Number(order.total) - 100;
    await WholesaleOrderService.recordPayment(order.id, buyerBiz.id, buyerUser.id, remaining, "الدفعة النهائية");
    const buyerAcct3 = await prisma.ledgerAccount.findUnique({
      where: { businessId_counterpartyBusinessId: { businessId: buyerBiz.id, counterpartyBusinessId: sellerBiz.id } },
    });
    const sellerAcct3 = await prisma.ledgerAccount.findUnique({
      where: { businessId_counterpartyBusinessId: { businessId: sellerBiz.id, counterpartyBusinessId: buyerBiz.id } },
    });
    assert(Number(buyerAcct3!.balance) === 0, `buyer balance should be 0, got ${buyerAcct3!.balance}`);
    assert(Number(sellerAcct3!.balance) === 0, `seller balance should be 0, got ${sellerAcct3!.balance}`);
    console.log(`  ✅ fully paid, balances settled: buyer=0, seller=0`);

    // ─── Returns test ───
    log("Create return request (5 units, reason DAMAGED)");
    const returnOrderItem = await prisma.wholesaleOrderItem.findFirst({ where: { orderId: order.id } });
    assert(returnOrderItem, "Order item missing");
    const returnReq = await WholesaleReturnService.createReturn({
      orderId: order.id,
      buyerBusinessId: buyerBiz.id,
      userId: buyerUser.id,
      reason: "DAMAGED",
      reasonDetails: "3 units arrived damaged",
      items: [{ orderItemId: returnOrderItem!.id, quantity: 5 }],
    });
    cleanupList.push({ model: "wholesaleReturnStatusHistory", where: { returnId: returnReq.id } });
    cleanupList.push({ model: "wholesaleReturnItem", where: { returnId: returnReq.id } });
    cleanupList.push({ model: "wholesaleReturnRequest", where: { id: returnReq.id } });
    assert(returnReq.status === "REQUESTED", "Return should be REQUESTED");
    assert(Number(returnReq.totalAmount) === 190, `Total should be 190, got ${returnReq.totalAmount}`);
    const buyerInvAfterReq = await prisma.wholesaleInventory.findFirst({
      where: { businessId: buyerBiz.id, masterVariantId: masterVariantS.id },
    });
    assert(buyerInvAfterReq!.quantity === 15, "Inventory should be unchanged at REQUESTED");
    console.log(`  ✅ return #${returnReq.id}: REQUESTED, 190 MAD, inventory unchanged`);

    log("Verify over-quantity return is blocked");
    let overReturnBlocked = false;
    try {
      await WholesaleReturnService.createReturn({
        orderId: order.id,
        buyerBusinessId: buyerBiz.id,
        userId: buyerUser.id,
        reason: "OTHER",
        items: [{ orderItemId: returnOrderItem!.id, quantity: 15 }],
      });
    } catch (e: any) {
      if (e.message.includes("لا يمكن إرجاع")) overReturnBlocked = true;
    }
    assert(overReturnBlocked, "Over-quantity return should be blocked");
    console.log(`  ✅ over-quantity blocked`);

    log("Verify buyer cannot approve own return");
    let buyerApproveBlocked = false;
    try {
      await WholesaleReturnService.approveReturn(returnReq.id, buyerBiz.id, buyerUser.id);
    } catch (e: any) {
      if (e.message.includes("غير مصرح")) buyerApproveBlocked = true;
    }
    assert(buyerApproveBlocked, "Buyer should not be able to approve");
    console.log(`  ✅ buyer approve blocked`);

    log("Seller approves (full amount 190)");
    const approvedRet = await WholesaleReturnService.approveReturn(returnReq.id, sellerBiz.id, sellerUser.id);
    assert(approvedRet.status === "APPROVED", "Should be APPROVED");
    assert(Number(approvedRet.approvedAmount) === 190, "Approved amount should be 190");
    console.log(`  ✅ APPROVED, amount=190`);

    log("Verify cancel-after-approve is blocked");
    let cancelAfterApproveBlocked = false;
    try {
      await WholesaleReturnService.cancelReturn(returnReq.id, buyerBiz.id, buyerUser.id);
    } catch (e: any) {
      cancelAfterApproveBlocked = true;
    }
    assert(cancelAfterApproveBlocked, "Cancel after approve should be blocked");
    console.log(`  ✅ cancel-after-approve blocked`);

    log("Seller receives return (restock + buyer decrement + lineage)");
    await WholesaleReturnService.receiveReturn(returnReq.id, sellerBiz.id, sellerUser.id);
    const buyerInvAfterRecv = await prisma.wholesaleInventory.findFirst({
      where: { businessId: buyerBiz.id, masterVariantId: masterVariantS.id },
    });
    const sellerStockAfterRecv = await prisma.wholesaleOfferVariant.findFirst({
      where: { offerId: offer.id, masterVariantId: masterVariantS.id },
    });
    assert(buyerInvAfterRecv!.quantity === 10, `buyer qty should be 10, got ${buyerInvAfterRecv!.quantity}`);
    assert(sellerStockAfterRecv!.stock === 50, `seller stock should be 50, got ${sellerStockAfterRecv!.stock}`);
    const returnLineage = await prisma.productLineage.findFirst({
      where: { masterVariantId: masterVariantS.id, transferType: "RETURN" },
    });
    assert(returnLineage, "RETURN lineage missing");
    assert(returnLineage!.quantity === 5, "Return lineage qty should be 5");
    console.log(`  ✅ RECEIVED: buyer=10, seller.stock=50, lineage RETURN recorded`);

    log("Seller issues refund (ledger REFUND)");
    await WholesaleReturnService.refundReturn(returnReq.id, sellerBiz.id, sellerUser.id);
    const refundLedger = await prisma.ledgerTransaction.findFirst({
      where: {
        type: "REFUND",
        amount: 190,
        debtorBusinessId: buyerBiz.id,
        creditorBusinessId: sellerBiz.id,
        status: "CONFIRMED",
      },
    });
    assert(refundLedger, "REFUND ledger transaction missing");
    const buyerBalAfterRefund = await prisma.ledgerAccount.findUnique({
      where: { businessId_counterpartyBusinessId: { businessId: buyerBiz.id, counterpartyBusinessId: sellerBiz.id } },
    });
    const sellerBalAfterRefund = await prisma.ledgerAccount.findUnique({
      where: { businessId_counterpartyBusinessId: { businessId: sellerBiz.id, counterpartyBusinessId: buyerBiz.id } },
    });
    assert(Number(buyerBalAfterRefund!.balance) === 190, `buyer balance should be +190, got ${buyerBalAfterRefund!.balance}`);
    assert(Number(sellerBalAfterRefund!.balance) === -190, `seller balance should be -190, got ${sellerBalAfterRefund!.balance}`);
    console.log(`  ✅ REFUNDED: buyer.balance=+190 (seller owes), seller.balance=-190, ledger REFUND`);

    log("Create 2nd return for 3 units, then cancel it");
    const returnReq2 = await WholesaleReturnService.createReturn({
      orderId: order.id,
      buyerBusinessId: buyerBiz.id,
      userId: buyerUser.id,
      reason: "OTHER",
      items: [{ orderItemId: returnOrderItem!.id, quantity: 3 }],
    });
    cleanupList.push({ model: "wholesaleReturnStatusHistory", where: { returnId: returnReq2.id } });
    cleanupList.push({ model: "wholesaleReturnItem", where: { returnId: returnReq2.id } });
    cleanupList.push({ model: "wholesaleReturnRequest", where: { id: returnReq2.id } });
    await WholesaleReturnService.cancelReturn(returnReq2.id, buyerBiz.id, buyerUser.id);
    const cancelled = await prisma.wholesaleReturnRequest.findUnique({ where: { id: returnReq2.id } });
    assert(cancelled!.status === "CANCELLED", "Should be CANCELLED");
    const buyerInvAfterCancel = await prisma.wholesaleInventory.findFirst({
      where: { businessId: buyerBiz.id, masterVariantId: masterVariantS.id },
    });
    assert(buyerInvAfterCancel!.quantity === 10, "Inventory should still be 10 after cancel");
    console.log(`  ✅ 2nd return CANCELLED, inventory unchanged (10)`);

    // ─── Retail Import test ───
    log("Setup: buyer seller already created at step 3");

    log("Import 10 units to retail (retailPrice: 65)");
    const { RetailImportService } = await import("../services/retail-import.service");
    const importResult = await RetailImportService.importToRetail({
      businessId: buyerBiz.id,
      masterVariantId: masterVariantS.id,
      quantity: 10,
      retailPrice: 65,
    });
    cleanupList.push({ model: "inventory", where: { variantId: importResult.variantId } });
    cleanupList.push({ model: "productVariant", where: { id: importResult.variantId } });
    cleanupList.push({ model: "productImage", where: { productId: importResult.productId } });
    cleanupList.push({ model: "product", where: { id: importResult.productId } });

    assert(importResult.quantity === 10, "Imported qty should be 10");
    assert(importResult.productCreated === true, "Product should be created");
    assert(importResult.variantCreated === true, "Variant should be created");
    console.log(`  ✅ retail product: ${importResult.productId}, variant: ${importResult.variantId}`);

    // Verify: retail inventory = 10, wholesale inventory dropped to 5
    const retailInv = await prisma.inventory.findUnique({
      where: { variantId: importResult.variantId },
    });
    assert(retailInv!.quantity === 10, `retail qty should be 10, got ${retailInv!.quantity}`);
    const wsInvAfter = await prisma.wholesaleInventory.findFirst({
      where: { businessId: buyerBiz.id, masterVariantId: masterVariantS.id },
    });
    assert(wsInvAfter!.quantity === 0, `wholesale inventory should be 0, got ${wsInvAfter!.quantity}`);
    console.log(`  ✅ retail qty=10, wholesale qty=0`);

    const retailInvFinal = await prisma.inventory.findUnique({
      where: { variantId: importResult.variantId },
    });
    assert(retailInvFinal!.quantity === 10, `retail qty should be 10, got ${retailInvFinal!.quantity}`);
    console.log(`  ✅ retail final qty=10, wholesale qty=0`);

    // ─── Verify lineage chain ───
    log("Verify lineage chain (INITIAL_CREATION → WHOLESALE_SALE → RETURN → RETAIL_IMPORT)");
    const chain = await prisma.productLineage.findMany({
      where: { masterVariantId: masterVariantS.id },
      orderBy: { createdAt: "asc" },
    });
    assert(chain.length === 4, `Chain should have 4 records, got ${chain.length}`);
    assert(chain[0].transferType === "INITIAL_CREATION", "First should be INITIAL_CREATION");
    assert(chain[1].transferType === "WHOLESALE_SALE", "Second should be WHOLESALE_SALE");
    assert(chain[2].transferType === "RETURN", "Third should be RETURN");
    assert(chain[3].transferType === "RETAIL_IMPORT", "Fourth should be RETAIL_IMPORT");
    console.log(`  ✅ chain complete: INITIAL_CREATION → WHOLESALE_SALE → RETURN → RETAIL_IMPORT`);

    // ─── All passed ───
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ ALL TESTS PASSED (${step} steps, ${elapsed}s)`);
    console.log(`${"=".repeat(60)}`);
    
    console.log("\n[CLEANUP] Starting...");
    await cleanup(cleanupList);
    console.log("\n✅ Test data cleaned up — DB is back to original state");
    
    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ TEST FAILED at step ${step}`);
    console.error(`   ${error.message}`);
    console.error(`\n⚠️  Test data preserved for inspection.`);
    console.error(`   To clean up manually: DELETE FROM "Business" WHERE slug LIKE 'smoke-%'; (cascades)`);
    console.error(`   Then: DELETE FROM "User" WHERE email LIKE 'smoke-%@test.local';`);
    await prisma.$disconnect();
    process.exit(1);
  }
}

run();