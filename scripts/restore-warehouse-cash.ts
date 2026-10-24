import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🔧 استرداد أموال المستودع المفقودة...\n");

  // 1. جلب كل التحصيلات المكتملة
  const handovers = await prisma.cashHandover.findMany({
    where: { status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
  });
  const totalCollected = handovers.reduce((s, h) => s + Number(h.amount), 0);

  // 2. جلب كل المدفوعات للسائقين المكتملة
  const payouts = await prisma.driverPayout.findMany({
    where: { status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
  });
  const totalPaidToDrivers = payouts.reduce((s, p) => s + Number(p.amount), 0);

  // 3. جلب كل التحويلات للأدمن المكتملة
  const handoversToAdmin = await prisma.adminCashHandover.findMany({
    where: { status: "COMPLETED" },
  });
  const totalHandedToAdmin = handoversToAdmin.reduce(
    (s, h) => s + Number(h.amount),
    0
  );

  console.log("📊 البيانات الفعلية:");
  console.log(`  تحصيلات من السائقين: ${totalCollected} د.م`);
  console.log(`  دفعات للسائقين: ${totalPaidToDrivers} د.م`);
  console.log(`  تحويلات للأدمن: ${totalHandedToAdmin} د.م`);
  console.log("");

  // 4. الرصيد الفعلي الحالي في المستودع
  const currentCashInHand =
    totalCollected - totalPaidToDrivers - totalHandedToAdmin;

  // 5. جلب التفاصيل من الشحنات لتحديد التوزيع
  const shipments = await prisma.shipment.findMany({
    where: {
      deliveryPersonId: { not: null },
      status: { in: ["DELIVERED", "PARTIALLY_DELIVERED"] },
    },
    include: {
      items: {
        include: {
          order: { select: { id: true, subtotal: true, shippingCost: true } },
        },
      },
    },
  });

  const processedOrders = new Set<number>();
  let platformPortion = 0;
  let driverFeeTotal = 0;

  for (const shipment of shipments) {
    const driverFee = Number(shipment.driverFee);
    driverFeeTotal += driverFee;

    for (const item of shipment.items) {
      if (processedOrders.has(item.order.id)) continue;
      processedOrders.add(item.order.id);
      platformPortion += Number(item.order.subtotal);
    }
  }

  // 6. الحساب النهائي
  const cashOwedToPlatform = Math.max(
    0,
    platformPortion - totalHandedToAdmin
  );
  const cashOwedToDrivers = Math.max(0, driverFeeTotal - totalPaidToDrivers);
  const newBalance = Math.max(
    0,
    currentCashInHand - cashOwedToPlatform - cashOwedToDrivers
  );

  console.log("🎯 التوزيع الجديد:");
  console.log(`  cashInHand: ${currentCashInHand} د.م`);
  console.log(`  cashOwedToPlatform: ${cashOwedToPlatform} د.م`);
  console.log(`  cashOwedToDrivers: ${cashOwedToDrivers} د.م`);
  console.log(`  balance (ربح): ${newBalance} د.م`);
  console.log("");

  // 7. التحديث
  const whWallet = await prisma.wallet.findUnique({
    where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: 1 } },
  });
  if (!whWallet) throw new Error("محفظة المستودع غير موجودة");

  await prisma.wallet.update({
    where: { id: whWallet.id },
    data: {
      cashInHand: currentCashInHand,
      cashOwedToPlatform: cashOwedToPlatform,
      cashOwedToDrivers: cashOwedToDrivers,
      balance: newBalance,
    },
  });

  console.log("✅ تم تحديث محفظة المستودع.");

  // 8. تحديث محفظة الأدمن
  const platformWallet = await prisma.wallet.findUnique({
    where: { ownerType_ownerId: { ownerType: "PLATFORM", ownerId: 1 } },
  });
  if (platformWallet) {
    await prisma.wallet.update({
      where: { id: platformWallet.id },
      data: { cashInHand: totalHandedToAdmin },
    });
    console.log(`✅ محفظة الأدمن - cashInHand: ${totalHandedToAdmin} د.م`);
  }

  console.log("\n🎉 اكتمل الاسترداد!");
}

main()
  .catch((e) => {
    console.error("❌ خطأ:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());