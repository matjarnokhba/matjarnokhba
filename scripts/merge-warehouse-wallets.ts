import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🔍 البحث عن محافظ المستودع المكررة...");

  const wallets = await prisma.wallet.findMany({
    where: { ownerType: "WAREHOUSE" },
    orderBy: { id: "asc" },
  });

  console.log(`وجدت ${wallets.length} محفظة مستودع:`);
  wallets.forEach((w) =>
    console.log(`  - ID ${w.id}: ownerId=${w.ownerId}, balance=${w.balance}, cashInHand=${w.cashInHand}`)
  );

  if (wallets.length <= 1) {
    console.log("✅ لا توجد محافظ مكررة. لا شيء لفعله.");
    return;
  }

  // المحفظة الأساسية = التي ownerId=1
  const primary = wallets.find((w) => w.ownerId === 1);
  if (!primary) {
    throw new Error("❌ لم أجد محفظة بـ ownerId=1! يرجى التحقق يدوياً.");
  }

  const duplicates = wallets.filter((w) => w.id !== primary.id);

  console.log(`\n📦 المحفظة الأساسية: ID=${primary.id} (ownerId=1)`);
  console.log(`📦 سيتم دمج ${duplicates.length} محفظة مكررة إليها...`);

  let totalBalanceAdded = 0;
  let totalCashAdded = 0;

  await prisma.$transaction(async (tx) => {
    for (const dup of duplicates) {
      console.log(`\n  ⏳ دمج محفظة ID=${dup.id} (ownerId=${dup.ownerId})...`);

      // 1. نقل الحركات المالية إلى المحفظة الأساسية
      const movedTxns = await tx.walletTransactionUnified.updateMany({
        where: { walletId: dup.id },
        data: { walletId: primary.id },
      });
      console.log(`     ✅ نُقلت ${movedTxns.count} حركة مالية.`);

      // 2. إضافة الأرصدة
      totalBalanceAdded += Number(dup.balance);
      totalCashAdded += Number(dup.cashInHand);

      // 3. حذف المحفظة المكررة
      await tx.wallet.delete({ where: { id: dup.id } });
      console.log(`     ✅ حُذفت المحفظة المكررة.`);
    }

    // 4. تحديث المحفظة الأساسية بالأرصدة المجمعة
    if (totalBalanceAdded > 0 || totalCashAdded > 0) {
      await tx.wallet.update({
        where: { id: primary.id },
        data: {
          balance: { increment: totalBalanceAdded },
          cashInHand: { increment: totalCashAdded },
        },
      });
      console.log(`\n✅ حُدّثت المحفظة الأساسية: +${totalBalanceAdded} د.م (رصيد) +${totalCashAdded} د.م (كاش).`);
    }
  });

  // 5. التحقق النهائي
  const final = await prisma.wallet.findUnique({
    where: { id: primary.id },
  });

  console.log("\n══════════ النتيجة النهائية ══════════");
  console.log(`المحفظة الوحيدة للمستودع (ID=${final!.id}):`);
  console.log(`  - balance: ${final!.balance} د.م`);
  console.log(`  - cashInHand: ${final!.cashInHand} د.م`);

  console.log("\n🎉 تم دمج كل المحافظ بنجاح!");
}

main()
  .catch((e) => {
    console.error("❌ خطأ:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());