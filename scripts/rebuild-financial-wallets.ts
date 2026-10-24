import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🔧 إعادة بناء محافظ المستودع والأدمن بناءً على الشحنات المحصّلة...\n");

  // ═══ 1. جمع كل الشحنات المحصّلة ═══
  const collectedShipments = await prisma.shipment.findMany({
    where: {
      cashCollectedAt: { not: null },
      status: { in: ["DELIVERED", "PARTIALLY_DELIVERED"] },
    },
    include: {
      items: {
        include: { order: { select: { subtotal: true, shippingCost: true } } },
      },
    },
  });

  let totalPlatformAmount = 0;
  let totalDriversAmount = 0;
  let totalWarehouseProfit = 0;
  const processedOrderIds = new Set<number>();

  for (const shipment of collectedShipments) {
    const driverFee = Number(shipment.driverFee);
    totalDriversAmount += driverFee;

    for (const item of shipment.items) {
      if (processedOrderIds.has(item.orderId)) continue;
      processedOrderIds.add(item.orderId);
      const subtotal = Number(item.order.subtotal);
      const shipping = Number(item.order.shippingCost || 0);
      totalPlatformAmount += subtotal;
      totalWarehouseProfit += Math.max(0, shipping - driverFee);
    }
  }

  // ═══ 2. ما تم تسليمه فعلاً ═══
  const handovers = await prisma.adminCashHandover.aggregate({
    where: { status: "COMPLETED" },
    _sum: { amount: true },
  });
  const totalHandedToAdmin = Number(handovers._sum.amount || 0);

  const payouts = await prisma.driverPayout.aggregate({
    where: { status: "COMPLETED" },
    _sum: { amount: true },
  });
  const totalPaidToDrivers = Number(payouts._sum.amount || 0);

  // ═══ 3. الحساب الجديد ═══
  const newCashOwedToPlatform = Math.max(0, totalPlatformAmount - totalHandedToAdmin);
  const newCashOwedToDrivers = Math.max(0, totalDriversAmount - totalPaidToDrivers);
  const newCashInHand = newCashOwedToPlatform + newCashOwedToDrivers + totalWarehouseProfit;
  const newBalance = totalWarehouseProfit;

  console.log("📊 البيانات المستخرجة:");
  console.log(`  عدد الشحنات المحصّلة: ${collectedShipments.length}`);
  console.log(`  إجمالي أموال المنصة: ${totalPlatformAmount} د.م`);
  console.log(`  إجمالي مستحقات السائقين: ${totalDriversAmount} د.م`);
  console.log(`  إجمالي ربح المستودع: ${totalWarehouseProfit} د.م`);
  console.log(`  سُلِّم للأدمن: ${totalHandedToAdmin} د.م`);
  console.log(`  دُفع للسائقين: ${totalPaidToDrivers} د.م\n`);

  console.log("🎯 الحالة الجديدة:");
  console.log(`  cashInHand: ${newCashInHand} د.م`);
  console.log(`  cashOwedToPlatform: ${newCashOwedToPlatform} د.م`);
  console.log(`  cashOwedToDrivers: ${newCashOwedToDrivers} د.م`);
  console.log(`  balance: ${newBalance} د.م\n`);

  // ═══ 4. تحديث محفظة المستودع ═══
  const whWallet = await prisma.wallet.findUnique({
    where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: 1 } },
  });
  if (!whWallet) throw new Error("محفظة المستودع غير موجودة");

  console.log("📊 محفظة المستودع - قبل:");
  console.log(`  cashInHand: ${whWallet.cashInHand}`);
  console.log(`  cashOwedToPlatform: ${whWallet.cashOwedToPlatform}`);
  console.log(`  cashOwedToDrivers: ${whWallet.cashOwedToDrivers}`);
  console.log(`  balance: ${whWallet.balance}\n`);

  await prisma.wallet.update({
    where: { id: whWallet.id },
    data: {
      cashInHand: newCashInHand,
      cashOwedToPlatform: newCashOwedToPlatform,
      cashOwedToDrivers: newCashOwedToDrivers,
      balance: newBalance,
    },
  });

  console.log("✅ تم إصلاح محفظة المستودع.\n");

  // ═══ 5. تحديث محفظة الأدمن (cashInHand) ═══
  const platformWallet = await prisma.wallet.findUnique({
    where: { ownerType_ownerId: { ownerType: "PLATFORM", ownerId: 1 } },
  });

  if (platformWallet) {
    console.log("📊 محفظة الأدمن - قبل:");
    console.log(`  cashInHand: ${platformWallet.cashInHand}`);
    console.log(`  balance: ${platformWallet.balance}`);
    console.log(`  heldBalance: ${platformWallet.heldBalance}\n`);

    await prisma.wallet.update({
      where: { id: platformWallet.id },
      data: { cashInHand: totalHandedToAdmin },
    });

    console.log(`✅ محفظة الأدمن - cashInHand بعد: ${totalHandedToAdmin} د.م`);
  }

  console.log("\n🎉 اكتملت إعادة البناء!");
}

main()
  .catch((e) => {
    console.error("❌ خطأ:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());