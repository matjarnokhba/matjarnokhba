import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { AssemblyService } from "@/services/assembly.service";

async function main() {
  console.log("🔍 Finding orders without assembly files...");

  const orders = await prisma.order.findMany({
    where: {
      assemblyFile: null,
      items: { some: { fulfillmentItems: { some: {} } } },
    },
    select: { id: true, orderNumber: true },
  });

  console.log(`Found ${orders.length} orders.`);

  let created = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      await prisma.$transaction(async (tx) => {
        await AssemblyService.ensureForOrder(tx, order.id);
        await tx.assemblyFile
          .findUnique({ where: { orderId: order.id } })
          .then((a) => {
            if (a) return AssemblyService.recompute(tx, a.id);
          });
      });
      created++;
      if (created % 10 === 0) {
        console.log(`✅ ${created}/${orders.length}`);
      }
    } catch (err) {
      console.error(`❌ Order ${order.orderNumber}:`, err);
      failed++;
    }
  }

  console.log("\n📊 Summary:");
  console.log(`  Created: ${created}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total: ${orders.length}`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));