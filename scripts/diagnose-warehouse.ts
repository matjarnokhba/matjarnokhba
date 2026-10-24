import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("═══════════ 1. محافظ المستودع الموجودة ═══════════");
  const warehouses = await prisma.wallet.findMany({
    where: { ownerType: "WAREHOUSE" },
    select: {
      id: true,
      ownerId: true,
      balance: true,
      cashInHand: true,
      createdAt: true,
    },
  });
  console.log(warehouses);
  console.log(`\n📊 عدد المحافظ: ${warehouses.length}`);

  console.log("\n═══════════ 2. آخر 5 عمليات CashHandover مكتملة ═══════════");
  const handovers = await prisma.cashHandover.findMany({
    where: { status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    take: 5,
    select: {
      id: true,
      driverId: true,
      warehouseId: true,
      amount: true,
      shortfall: true,
      status: true,
      completedAt: true,
    },
  });
  console.log(handovers);

  console.log("\n═══════════ 3. آخر 10 حركات CASH_COLLECTED ═══════════");
  const cashTxns = await prisma.walletTransactionUnified.findMany({
    where: { type: "CASH_COLLECTED" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      wallet: {
        select: { id: true, ownerType: true, ownerId: true, cashInHand: true },
      },
    },
  });
  console.log(cashTxns.map((t) => ({
    id: t.id,
    amount: t.amount.toString(),
    walletId: t.walletId,
    walletOwner: `${t.wallet.ownerType}/${t.wallet.ownerId}`,
    walletCash: t.wallet.cashInHand.toString(),
    description: t.description,
    createdAt: t.createdAt,
  })));

  console.log("\n═══════════ 4. محفظة الأدمن (PLATFORM) ═══════════");
  const platform = await prisma.wallet.findMany({
    where: { ownerType: "PLATFORM" },
    select: { id: true, ownerId: true, balance: true, cashInHand: true },
  });
  console.log(platform);

  console.log("\n═══════════ 5. محفظة السائق ═══════════");
  const drivers = await prisma.wallet.findMany({
    where: { ownerType: "DRIVER" },
    select: { id: true, ownerId: true, balance: true, cashInHand: true, cashHeldSince: true, isBlocked: true },
  });
  console.log(drivers);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());