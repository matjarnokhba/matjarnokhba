import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🔧 إصلاح cashOwedToDrivers\n");

  const warehouse = await prisma.wallet.findUnique({
    where: { ownerType_ownerId: { ownerType: "WAREHOUSE", ownerId: 1 } },
  });

  if (!warehouse) {
    console.error("❌ محفظة المستودع غير موجودة");
    return;
  }

  const driverWallets = await prisma.wallet.findMany({
    where: { ownerType: "DRIVER" },
  });

  const drivers = await prisma.deliveryPerson.findMany({
    include: { user: { select: { name: true } } },
  });
  const driverMap = new Map(drivers.map((d) => [d.id, d.user.name]));

  console.log("\n📊 محافظ السائقين:");
  let totalOwed = 0;
  for (const w of driverWallets) {
    const name = driverMap.get(w.ownerId) || `Unknown (${w.ownerId})`;
    const bal = Number(w.balance);
    console.log(`  ${name}: ${bal} د.م`);
    totalOwed += bal;
  }

  console.log("\n📊 محفظة المستودع:");
  console.log(`  المخزّنة: ${warehouse.cashOwedToDrivers} د.م`);
  console.log(`  الفعلية: ${totalOwed} د.م`);

  const diff = Number(warehouse.cashOwedToDrivers) - totalOwed;
  if (Math.abs(diff) < 0.01) {
    console.log("\n✅ متطابقة");
    return;
  }

  console.log(`\n⚠️ فرق: ${diff} د.م → جاري التصحيح...`);

  await prisma.wallet.update({
    where: { id: warehouse.id },
    data: { cashOwedToDrivers: totalOwed },
  });

  console.log(`\n✅ تم التصحيح إلى ${totalOwed} د.م`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());