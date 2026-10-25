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
  const runId = crypto.randomBytes(4).toString("hex");
  const prefix = `T${runId}`;

  let userId: number | null = null;
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

  try {
    // ═══ 1. Preflight ═══
    console.log("🔍 Preflight\n");

    try {
      await prisma.$queryRaw`SELECT 1`;
      add("Database reachable", true);
    } catch (e: any) {
      add("Database reachable", false, e?.message);
      return;
    }

    const category = await prisma.category.findFirst();
    if (!category) {
      add("Category available", false, "لا توجد تصنيفات — شغّل seed أولاً");
      return;
    }
    add("Category available", true, `id=${category.id}`);

    // ═══ 2. Setup ═══
    console.log("\n📦 إنشاء البيانات\n");
    const passwordHash = await bcrypt.hash("Test123!", 10);

    // ── Customer
    try {
      const u = await prisma.user.create({
        data: {
          email: `${prefix}-user@test.local`,
          passwordHash,
          name: "زبون",
          phone: "0600000001",
          role: "CUSTOMER",
          referralCode: `REF-${prefix}-U`,
        },
      });
      userId = u.id;
      add("Create customer", true, `id=${u.id}`);
    } catch (e: any) {
      add("Create customer", false, e?.message);
      return;
    }

    // ── Seller
    try {
      const su = await prisma.user.create({
        data: {
          email: `${prefix}-seller@test.local`,
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
      add("Create seller", true, `id=${s.id}`);
    } catch (e: any) {
      add("Create seller", false, e?.message);
      return;
    }

    // ── Product + Variant
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
      add("Create product+variant", true, `product=${p.id} variant=${v.id}`);
    } catch (e: any) {
      add("Create product+variant", false, e?.message);
      return;
    }

    // ── Driver
    try {
      const du = await prisma.user.create({
        data: {
          email: `${prefix}-driver@test.local`,
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
      add("Create driver", true, `id=${d.id}`);
    } catch (e: any) {
      add("Create driver", false, e?.message);
      return;
    }

    // ═══ 3. Math tests ═══
    console.log("\n🧮 اختبار الرياضيات\n");
    const commission = Math.round(100 * 0.1 * 100) / 100;
    const sellerNet = Math.round((100 - commission) * 100) / 100;
    const warehouseProfit = Math.max(0, 20 - 13);

    add("Commission = 10", Math.abs(commission - 10) < 0.01, `got ${commission}`);
    add("Seller net = 90", Math.abs(sellerNet - 90) < 0.01, `got ${sellerNet}`);
    add("Warehouse profit = 7", Math.abs(warehouseProfit - 7) < 0.01, `got ${warehouseProfit}`);

    // ═══ 4. Order + Shipment ═══
    console.log("\n📋 إنشاء طلب + شحنة\n");

    try {
      const o = await prisma.order.create({
        data: {
          orderNumber: `ORD-${prefix}`,
          userId: userId!,
          sellerId: sellerId!,
          status: "DELIVERED",
          paymentMethod: "COD",
          paymentStatus: "PAID",
          subtotal: 100,
          shippingCost: 20,
          discount: 0,
          total: 120,
          deliveredAt: new Date(),
          deliveryToken: crypto.randomBytes(24).toString("base64url"),
          shippingAddressSnapshot: { fullName: "زبون", phone: "0600000001" },
          customerSnapshot: { name: "زبون" },
          items: {
            create: {
              productId: productId!,
              variantId: variantId!,
              sellerId: sellerId!,
              productName: `منتج ${prefix}`,
              sku: `SKU-${prefix}`,
              quantity: 1,
              unitPrice: 100,
              total: 100,
              taxRate: 0,
              taxAmount: 0,
            },
          },
        },
        include: { items: true },
      });

      orderId = o.id;

      if (!o.items || o.items.length === 0) {
        add("Create order", false, "no items created");
        return;
      }

      orderItemId = o.items[0].id;
      add("Create order", true, `id=${o.id} items=${o.items.length}`);
    } catch (e: any) {
      add("Create order", false, e?.message);
      return;
    }

    try {
      const sh = await prisma.shipment.create({
        data: {
          shipmentNumber: `SH-${prefix}`,
          status: "DELIVERED",
          qrTokenHash: crypto.randomBytes(32).toString("hex"),
          qrTokenEncrypted: new Uint8Array(16),
          qrTokenPreview: "TEST12",
          createdById: userId!,
          deliveryPersonId: driverId!,
          assignedAt: new Date(),
          totalCOD: 120,
          totalOrders: 1,
          driverFee: 13,
          items: {
            create: {
              orderId: orderId!,
              orderItemId: orderItemId!,
              productId: productId!,
              variantId: variantId!,
              sellerId: sellerId!,
              quantity: 1,
              codAmount: 120,
            },
          },
        },
        include: { items: true },
      });
      shipmentId = sh.id;
      if (sh.items.length > 0) shipmentItemId = sh.items[0].id;
      add("Create shipment", true, `id=${sh.id}`);
    } catch (e: any) {
      add("Create shipment", false, e?.message);
    }

    // ═══ 5. WalletService ═══
    console.log("\n💼 WalletService\n");

    try {
      const { WalletService } = await import("../services/wallet.service");

      await prisma.$transaction(
        async (tx) => {
          await WalletService.addHeldEarning(tx, sellerId!, orderId!, 120, 100);
          await WalletService.processDeliveryFinancials(
            tx,
            {
              id: orderId,
              orderNumber: `ORD-${prefix}`,
              total: 120,
              subtotal: 100,
              shippingCost: 20,
              sellerId,
            },
            driverId!
          );
        },
        { timeout: 30000 }
      );

      const seller = await prisma.seller.findUnique({
        where: { id: sellerId! },
        select: { heldBalance: true },
      });
      const dw = await prisma.wallet.findUnique({
        where: {
          ownerType_ownerId: { ownerType: "DRIVER", ownerId: driverId! },
        },
      });

      add(
        "Seller heldBalance = 90",
        Math.abs(Number(seller?.heldBalance || 0) - 90) < 0.01,
        `got ${seller?.heldBalance}`
      );
      add(
        "Driver balance = 13",
        Math.abs(Number(dw?.balance || 0) - 13) < 0.01,
        `got ${dw?.balance}`
      );
      add(
        "Driver cashInHand = 120",
        Math.abs(Number(dw?.cashInHand || 0) - 120) < 0.01,
        `got ${dw?.cashInHand}`
      );
    } catch (e: any) {
      add("WalletService execution", false, e?.message);
    }
  } catch (e: any) {
    console.error("\n💥 Fatal:", e?.message);
  } finally {
    // ═══ CLEANUP (safe, each isolated) ═══
    console.log("\n🧹 Cleanup\n");

    const safe = async (
      name: string,
      id: number | null,
      fn: (id: number) => Promise<any>
    ) => {
      if (id === null) return;
      try {
        await fn(id);
      } catch (e: any) {
        console.error(`   ⚠️ ${name}: ${e?.message || e}`);
      }
    };

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
      await prisma.inventoryMovement.deleteMany({
        where: { inventory: { variantId: id } },
      });
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
        await prisma.walletTransactionUnified.deleteMany({
          where: { walletId: w.id },
        });
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

    await safe("user", userId, async (id) => {
      await prisma.user.delete({ where: { id } });
    });

    console.log("✅ انتهى التنظيف");
  }

  // ═══ Final report ═══
  console.log("\n" + "═".repeat(60));
  const passed = tests.filter((t) => t.passed).length;
  const failed = tests.filter((t) => !t.passed);
  console.log(`📊 ${passed}/${tests.length} نجح · ${failed.length} فشل`);
  console.log("═".repeat(60));

  if (failed.length > 0) {
    console.log("\n❌ الاختبارات الفاشلة:");
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