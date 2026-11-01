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

const TS = Date.now();
const TAG = `smoke-${TS}`;
const TEST_EMAIL_SELLER = `${TAG}-seller@test.local`;
const TEST_EMAIL_BUYER = `${TAG}-buyer@test.local`;

type Cleanup = { model: string; where: any }[];

async function cleanup(collected: Cleanup) {
  console.log("\n[CLEANUP] Removing test data (leaf → root)...");
  // Correct deletion order — children before parents
  const ORDER = [
    "productLineage",
    "wholesaleOrderStatusHistory",
    "wholesaleOrderItem",
    "wholesaleOrder",
    "wholesaleOfferVariant",
    "wholesaleOfferTier",
    "wholesaleOffer",
    "wholesaleInventory",
    "productMasterVariant",
    "productMaster",
    "businessMember",
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
        type: "FACTORY",
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
    const buyerMember = await prisma.businessMember.create({
      data: { businessId: buyerBiz.id, userId: buyerUser.id, role: "OWNER" },
    });
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
    console.log(`  offer: ${offer.id}, total stock: 100, auto-verified: ✅`);

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

    // ─── Verify lineage chain ───
    log("Verify lineage chain (INITIAL_CREATION → WHOLESALE_SALE)");
    const chain = await prisma.productLineage.findMany({
      where: { masterVariantId: masterVariantS.id },
      orderBy: { createdAt: "asc" },
    });
    assert(chain.length === 2, `Chain should have 2 records, got ${chain.length}`);
    assert(chain[0].transferType === "INITIAL_CREATION", "First should be INITIAL_CREATION");
    assert(chain[1].transferType === "WHOLESALE_SALE", "Second should be WHOLESALE_SALE");
    console.log(`  ✅ chain complete: INITIAL_CREATION → WHOLESALE_SALE`);

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