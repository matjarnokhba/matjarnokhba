import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

async function main() {
  const orders = await prisma.order.findMany({
    where: { deliveryToken: null },
    select: { id: true, orderNumber: true },
  });

  console.log(`عدد الطلبات بدون deliveryToken: ${orders.length}`);

  for (const order of orders) {
    await prisma.order.update({
      where: { id: order.id },
      data: { deliveryToken: randomUUID() },
    });
    console.log(`  ✓ ${order.orderNumber}`);
  }

  console.log(`\n✅ تم تحديث ${orders.length} طلب`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {});