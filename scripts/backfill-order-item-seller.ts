import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("🔄 بدء backfill لـ OrderItem.sellerId...\n");

  const itemsWithoutSeller = await prisma.orderItem.findMany({
    where: { sellerId: null },
    select: {
      id: true,
      productId: true,
      product: { select: { sellerId: true } },
    },
  });

  console.log(`📊 عدد OrderItems بدون sellerId: ${itemsWithoutSeller.length}\n`);

  if (itemsWithoutSeller.length === 0) {
    console.log("✅ لا حاجة للـBackfill");
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const item of itemsWithoutSeller) {
    try {
      if (!item.product?.sellerId) {
        console.warn(`  ⚠️ OrderItem #${item.id} — Product #${item.productId} ليس له sellerId`);
        failed++;
        continue;
      }

      await prisma.orderItem.update({
        where: { id: item.id },
        data: { sellerId: item.product.sellerId },
      });
      updated++;
    } catch (err) {
      console.error(`  ❌ فشل OrderItem #${item.id}:`, err);
      failed++;
    }
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`✅ تم التحديث: ${updated}`);
  console.log(`❌ فشل: ${failed}`);
  console.log(`═══════════════════════════════════════`);

  // ═══ التحقق النهائي ═══
  const remaining = await prisma.orderItem.count({
    where: { sellerId: null },
  });

  if (remaining > 0) {
    console.log(`\n⚠️ لا يزال ${remaining} OrderItem بدون sellerId`);
    console.log("   لن نجعله إلزامياً بعد");
  } else {
    console.log("\n🎯 كل OrderItems لها sellerId");
    console.log("   جاهز لجعل الحقل إلزامياً في Migration مستقبلية");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {});