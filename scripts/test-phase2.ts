import "dotenv/config";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

type Test = { name: string; passed: boolean; detail: string };
const tests: Test[] = [];
function add(name: string, passed: boolean, detail = "") {
  tests.push({ name, passed, detail });
  console.log(`${passed ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

async function main() {
  const prefix = `P2-${crypto.randomBytes(3).toString("hex")}`;

  // Trace IDs
  let adminUserId: number | null = null;
  let customerUserId: number | null = null;
  let sellerUserId: number | null = null;
  let sellerId: number | null = null;
  let productId: number | null = null;
  let variantId: number | null = null;
  let driverUserId: number | null = null;
  let driverId: number | null = null;
  let orderId: number | null = null;
  let orderItemId: number | null = null;
  let shipmentId: number | null = null;
  let shipmentItemId: number | null = null;
  let noticeId: number | null = null;

  try {
    // ═══ 0. Preflight ═══
    console.log("🔍 Preflight\n");

    try {
      await prisma.$queryRaw`SELECT 1`;
      add("Database", true);
    } catch (e: any) {
      add("Database", false, e?.message);
      return;
    }

    const admin = await prisma.user.findFirst({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, deletedAt: null },
    });
    if (!admin) {
      add("Admin user exists", false, "لا يوجد admin");
      return;
    }
    adminUserId = admin.id;
    add("Admin user exists", true, `id=${admin.id}`);

    const category = await prisma.category.findFirst();
    if (!category) {
      add("Category", false, "لا يوجد");
      return;
    }
    add("Category", true, `id=${category.id}`);

    const passwordHash = await bcrypt.hash("Test123!", 10);

    // ═══ 1. Setup: customer + seller + product + driver ═══
    console.log("\n📦 Setup\n");

    try {
      const u = await prisma.user.create({
        data: {
          email: `${prefix}-u@test.local`,
          passwordHash,
          name: "زبون",
          phone: "0600000001",
          role: "CUSTOMER",
          referralCode: `REF-${prefix}-U`,
        },
      });
      customerUserId = u.id;
      add("Customer", true, `id=${u.id}`);
    } catch (e: any) {
      add("Customer", false, e?.message);
      return;
    }

    try {
      const su = await prisma.user.create({
        data: {
          email: `${prefix}-s@test.local`,
          passwordHash,
          name: "تاجر",
          phone: "0600000002",
          role: "SELLER",
          referralCode: `REF-${prefix}-S`,
        },
      });
      sellerUserId = su.id;
      const s = await prisma.seller.create({
        data: {
          userId: su.id,
          storeName: `متجر ${prefix}`,
          slug: `seller-${prefix}`,
          city: "الدار البيضاء",
          status: "ACTIVE",
        },
      });
      sellerId = s.id;
      add("Seller", true, `id=${s.id}`);
    } catch (e: any) {
      add("Seller", false, e?.message);
      return;
    }

    try {
      const p = await prisma.product.create({
        data: {
          sellerId,
          categoryId: category.id,
          name: `منتج ${prefix}`,
          slug: `product-${prefix}`,
          status: "ACTIVE",
        },
      });
      productId = p.id;
      const v = await prisma.productVariant.create({
        data: {
          productId: p.id,
          sellerId,
          sku: `SKU-${prefix}`,
          price: 100,
          isDefault: true,
          isActive: true,
          optionsHash: `H-${prefix}`,
          barcode: `BC-${prefix}`,
          inventory: {
            create: { quantity: 50, reservedQuantity: 0, lowStockThreshold: 5 },
          },
        },
      });
      variantId = v.id;
      add("Product+Variant", true, `product=${p.id} variant=${v.id}`);
    } catch (e: any) {
      add("Product+Variant", false, e?.message);
      return;
    }

    try {
      const du = await prisma.user.create({
        data: {
          email: `${prefix}-d@test.local`,
          passwordHash,
          name: "سائق",
          phone: "0600000003",
          role: "DELIVERY",
          referralCode: `REF-${prefix}-D`,
        },
      });
      driverUserId = du.id;
      const d = await prisma.deliveryPerson.create({
        data: {
          userId: du.id,
          city: "الدار البيضاء",
          phone: "0600000003",
          status: "ACTIVE",
        },
      });
      driverId = d.id;
      add("Driver", true, `id=${d.id}`);
    } catch (e: any) {
      add("Driver", false, e?.message);
      return;
    }

    // ═══ 2. Legal Notice Lifecycle ═══
    console.log("\n⚖️  Legal Notice Lifecycle\n");

    // Setup driver wallet with stale cash
    await prisma.wallet.upsert({
      where: { ownerType_ownerId: { ownerType: "DRIVER", ownerId: driverId! } },
      create: {
        ownerType: "DRIVER",
        ownerId: driverId!,
        balance: 13,
        cashInHand: 120,
        cashHeldSince: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
      update: {
        cashInHand: 120,
        cashHeldSince: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
    });

    try {
      const { LegalNoticeService } = await import("../services/legal-notice.service");

      await prisma.$transaction(async (tx) => {
        await LegalNoticeService.syncForDriver(tx, driverId!);
      });

      const notice = await prisma.driverLegalNotice.findFirst({
        where: { driverId: driverId!, status: "WARNING" },
      });

      if (notice) {
        noticeId = notice.id;
        add("Create notice", true, `id=${notice.id} amount=${notice.amountOwed}`);

        const deadlineDays = Math.round(
          (new Date(notice.deadlineAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        add(
          "Deadline ≈ 15 days",
          deadlineDays >= 14 && deadlineDays <= 15,
          `got ${deadlineDays} days`
        );
      } else {
        add("Create notice", false, "لم يُنشأ");
      }
    } catch (e: any) {
      add("Create notice", false, e?.message);
    }

    // Escalate expired notice
    try {
      if (noticeId) {
        await prisma.driverLegalNotice.update({
          where: { id: noticeId },
          data: { deadlineAt: new Date(Date.now() - 60 * 60 * 1000) },
        });

        const { LegalNoticeService } = await import("../services/legal-notice.service");
        const result = await LegalNoticeService.escalateExpired();

        const notice = await prisma.driverLegalNotice.findUnique({
          where: { id: noticeId },
        });
        add(
          "Escalate expired",
          notice?.status === "ESCALATED",
          `status=${notice?.status} escalated=${result.escalated}`
        );
      }
    } catch (e: any) {
      add("Escalate expired", false, e?.message);
    }

    // Resolve manually
    try {
      if (noticeId) {
        const { LegalNoticeService } = await import("../services/legal-notice.service");
        await LegalNoticeService.resolveManually(noticeId, "اختبار آلي — تم الحل");

        const notice = await prisma.driverLegalNotice.findUnique({
          where: { id: noticeId },
        });
        add("Resolve manual", notice?.status === "RESOLVED", `status=${notice?.status}`);
      }
    } catch (e: any) {
      add("Resolve manual", false, e?.message);
    }

    // ═══ 3. Refused Handover + Seller Return (full cycle) ═══
    console.log("\n↩️  Refused Handover + Seller Return\n");

    // Setup: order + shipment + shipmentItem with refusedQuantity
    try {
      const o = await prisma.order.create({
        data: {
          orderNumber: `ORD-${prefix}`,
          userId: customerUserId!,
          sellerId: sellerId!,
          status: "PARTIALLY_DELIVERED",
          paymentMethod: "COD",
          paymentStatus: "PAID",
          subtotal: 100,
          shippingCost: 20,
          discount: 0,
          total: 100,
          deliveredAt: new Date(),
          deliveryToken: crypto.randomBytes(24).toString("base64url"),
          shippingAddressSnapshot: { fullName: "زبون" },
          customerSnapshot: { name: "زبون" },
          items: {
            create: {
              productId: productId!,
              variantId: variantId!,
              sellerId: sellerId!,
              productName: `منتج ${prefix}`,
              sku: `SKU-${prefix}`,
              quantity: 2,
              unitPrice: 50,
              total: 100,
              taxRate: 0,
              taxAmount: 0,
            },
          },
        },
        include: { items: true },
      });
      orderId = o.id;
      orderItemId = o.items[0].id;

      const sh = await prisma.shipment.create({
        data: {
          shipmentNumber: `SH-${prefix}`,
          status: "PARTIALLY_DELIVERED",
          qrTokenHash: crypto.randomBytes(32).toString("hex"),
          qrTokenEncrypted: new Uint8Array(16),
          qrTokenPreview: "P2TEST",
          createdById: adminUserId!,
          deliveryPersonId: driverId!,
          assignedAt: new Date(),
          totalCOD: 100,
          totalOrders: 1,
          driverFee: 13,
          items: {
            create: {
              orderId,
              orderItemId,
              productId: productId!,
              variantId: variantId!,
              sellerId: sellerId!,
              quantity: 2,
              codAmount: 100,
              refusedQuantity: 1,
              refusedAt: new Date(),
              refusedReason: "اختبار آلي — منتج تالف",
            },
          },
        },
        include: { items: true },
      });
      shipmentId = sh.id;
      shipmentItemId = sh.items[0].id;
      add("Setup refused item", true, `order=${orderId} shipment=${shipmentId}`);
    } catch (e: any) {
      add("Setup refused item", false, e?.message);
    }

    // RefusedHandoverService: getPendingDrivers
    try {
      const { RefusedHandoverService } = await import("../services/refused-handover.service");
      const pending = await RefusedHandoverService.getPendingDrivers(adminUserId!);
      const driverInList = pending.find((d) => d.driverId === driverId);
      add(
        "getPendingDrivers finds driver",
        !!driverInList,
        `found=${!!driverInList} total=${pending.length}`
      );
    } catch (e: any) {
      add("getPendingDrivers", false, e?.message);
    }

    // RefusedHandoverService: createHandoverBatch
    let handoverToken: string | null = null;
    let handoverBatchId: number | null = null;
    try {
      const { RefusedHandoverService } = await import("../services/refused-handover.service");
      const batch = await RefusedHandoverService.createHandoverBatch(
        driverId!,
        adminUserId!
      );
      handoverToken = batch.qrToken;
      handoverBatchId = batch.batchId;
      add("createHandoverBatch", true, `code=${batch.batchCode} qty=${batch.totalQuantity}`);
    } catch (e: any) {
      add("createHandoverBatch", false, e?.message);
    }

    // RefusedHandoverService: confirmHandover
    try {
      if (handoverToken && driverUserId) {
        const { RefusedHandoverService } = await import("../services/refused-handover.service");
        const result = await RefusedHandoverService.confirmHandover(
          handoverToken,
          driverUserId
        );

        const item = await prisma.shipmentItem.findUnique({
          where: { id: shipmentItemId! },
        });

        add(
          "confirmHandover sets returnedAt",
          !!item?.returnedToWarehouseAt,
          `returnedAt=${item?.returnedToWarehouseAt ? "✓" : "✗"}`
        );

        const batch = await prisma.refusedHandoverBatch.findUnique({
          where: { id: handoverBatchId! },
        });
        add(
          "Handover batch COMPLETED",
          batch?.status === "COMPLETED",
          `status=${batch?.status}`
        );

        // Seller Return: getPendingBySeller
        const { SellerReturnService } = await import("../services/seller-return.service");
        const sellers = await SellerReturnService.getPendingBySeller();
        const sellerInList = sellers.find((s) => s.sellerId === sellerId);
        add(
          "Seller appears in pending returns",
          !!sellerInList,
          `found=${!!sellerInList} total=${sellers.length}`
        );

        // Seller Return: createBatch
        const sellerBatch = await SellerReturnService.createBatch(
          sellerId!,
          adminUserId!
        );
        add(
          "createBatch seller return",
          true,
          `code=${sellerBatch.batchNumber} qty=${sellerBatch.totalQuantity}`
        );

        // Seller Return: pickupByCollector
        await SellerReturnService.pickupByCollector(
          sellerBatch.qrToken,
          adminUserId!
        );
        const pickedUpBatch = await prisma.sellerReturnBatch.findUnique({
          where: { id: sellerBatch.batchId },
        });
        add(
          "pickupByCollector → PICKED_UP",
          pickedUpBatch?.status === "PICKED_UP",
          `status=${pickedUpBatch?.status}`
        );

        // Seller Return: confirmBySeller
        const invBefore = await prisma.inventory.findUnique({
          where: { variantId: variantId! },
        });
        const beforeQty = Number(invBefore?.quantity || 0);

        await SellerReturnService.confirmBySeller(
          sellerBatch.qrToken,
          sellerUserId!
        );

        const invAfter = await prisma.inventory.findUnique({
          where: { variantId: variantId! },
        });
        const afterQty = Number(invAfter?.quantity || 0);

        add(
          "confirmBySeller increases inventory",
          afterQty > beforeQty,
          `before=${beforeQty} after=${afterQty}`
        );

        const finalBatch = await prisma.sellerReturnBatch.findUnique({
          where: { id: sellerBatch.batchId },
        });
        add(
          "Batch CONFIRMED",
          finalBatch?.status === "CONFIRMED",
          `status=${finalBatch?.status}`
        );
      }
    } catch (e: any) {
      add("Refused+Seller return cycle", false, e?.message);
    }
  } catch (e: any) {
    console.error("\n💥 Fatal:", e?.message);
  } finally {
    // ═══ Cleanup ═══
    console.log("\n🧹 Cleanup\n");
    const safe = async (name: string, id: number | null, fn: (id: number) => Promise<any>) => {
      if (id === null) return;
      try { await fn(id); } catch (e: any) {
        console.error(`   ⚠️ ${name}: ${e?.message || e}`);
      }
    };

    // Handover batches + items
    if (driverId) {
      try {
        await prisma.refusedHandoverItem.deleteMany({
          where: { batch: { driverId } },
        });
        await prisma.refusedHandoverBatch.deleteMany({ where: { driverId } });
      } catch (e: any) {
        console.error(`   ⚠️ handover batches: ${e?.message}`);
      }
    }

    // Seller return batches
    if (sellerId) {
      try {
        await prisma.sellerReturnItem.deleteMany({
          where: { batch: { sellerId } },
        });
        await prisma.sellerReturnBatch.deleteMany({ where: { sellerId } });
      } catch (e: any) {
        console.error(`   ⚠️ seller return batches: ${e?.message}`);
      }
    }

    // Legal notices
    if (driverId) {
      try {
        await prisma.driverLegalNotice.deleteMany({ where: { driverId } });
      } catch (e: any) {
        console.error(`   ⚠️ notices: ${e?.message}`);
      }
    }

    // Shipment + order
    await safe("shipment", shipmentId, async (id) => {
      await prisma.shipmentItem.deleteMany({ where: { shipmentId: id } });
      await prisma.shipment.delete({ where: { id } });
    });

    await safe("order", orderId, async (id) => {
      await prisma.orderStatusHistory.deleteMany({ where: { orderId: id } });
      await prisma.orderItem.deleteMany({ where: { orderId: id } });
      await prisma.order.delete({ where: { id } });
    });

    await safe("variant", variantId, async (id) => {
      await prisma.inventoryMovement.deleteMany({ where: { inventory: { variantId: id } } });
      await prisma.inventory.deleteMany({ where: { variantId: id } });
      await prisma.productVariant.delete({ where: { id } });
    });

    await safe("product", productId, async (id) => {
      await prisma.product.delete({ where: { id } });
    });

    await safe("seller", sellerId, async (id) => {
      await prisma.seller.delete({ where: { id } });
    });

    await safe("driver wallet", driverId, async (id) => {
      const w = await prisma.wallet.findFirst({
        where: { ownerType: "DRIVER", ownerId: id },
      });
      if (w) {
        await prisma.walletTransactionUnified.deleteMany({ where: { walletId: w.id } });
        await prisma.wallet.delete({ where: { id: w.id } });
      }
      await prisma.deliveryPerson.delete({ where: { id } });
    });

    await safe("driver user", driverUserId, async (id) => {
      await prisma.user.delete({ where: { id } });
    });
    await safe("seller user", sellerUserId, async (id) => {
      await prisma.user.delete({ where: { id } });
    });
    await safe("customer user", customerUserId, async (id) => {
      await prisma.user.delete({ where: { id } });
    });

    console.log("✅ تم التنظيف");
  }

  // ═══ Report ═══
  console.log("\n" + "═".repeat(60));
  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.filter((t) => !t.passed);
  console.log(`📊 ${passed}/${tests.length} نجح · ${failed.length} فشل`);
  console.log("═".repeat(60));

  if (failed.length > 0) {
    console.log("\n❌ الفاشلة:");
    failed.forEach((t) => console.log(`   ${t.name} — ${t.detail}`));
    await prisma.$disconnect();
    process.exit(1);
  } else {
    console.log("\n🎉 كل الاختبارات نجحت!");
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error("💥", e);
  await prisma.$disconnect();
  process.exit(1);
});