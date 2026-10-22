import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🔍 جاري البحث عن الطلبات المحاصرة...");

  // 1. إصلاح الطلبات التي شحنتها "تم التسليم" ولكن حالتها لم تتحدث
  const deliveredShipments = await prisma.shipment.findMany({
    where: { status: "DELIVERED" },
    include: { items: { include: { order: true } } }
  });

  let fixedOrdersCount = 0;
  let fixedFulfillmentsCount = 0;
  const processedOrderIds = new Set<number>();

  for (const shipment of deliveredShipments) {
    for (const item of shipment.items) {
      const order = item.order;
      if (order && order.status !== "DELIVERED" && !processedOrderIds.has(order.id)) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: "DELIVERED",
            paymentStatus: "PAID",
            deliveredAt: new Date()
          }
        });
        console.log(`✅ تم إصلاح الطلب #${order.orderNumber} (كان ${order.status} وأصبح DELIVERED)`);
        processedOrderIds.add(order.id);
        fixedOrdersCount++;
      }
    }
  }

  // 2. إصلاح عناصر التجهيز (FulfillmentItems) المرتبطة بالطلبات التي تم إصلاحها
  if (processedOrderIds.size > 0) {
    const updatedFI = await prisma.fulfillmentItem.updateMany({
      where: {
        orderItem: { orderId: { in: Array.from(processedOrderIds) } },
        status: { not: "DELIVERED" }
      },
      data: { status: "DELIVERED" }
    });
    fixedFulfillmentsCount = updatedFI.count;
  }

  // 3. إصلاح الطلبات التي حالتها "تم التسليم" ولكن عناصر تجهيزها عالقة
  const deliveredOrders = await prisma.order.findMany({
    where: { status: "DELIVERED" },
    select: { id: true }
  });

  if (deliveredOrders.length > 0) {
    const stuckFI = await prisma.fulfillmentItem.updateMany({
      where: {
        orderItem: { orderId: { in: deliveredOrders.map((o: { id: number }) => o.id) } },
        status: { notIn: ["DELIVERED", "RETURNED", "CANCELLED"] }
      },
      data: { status: "DELIVERED" }
    });
    fixedFulfillmentsCount += stuckFI.count;
  }

  console.log(`🎉 اكتمل الإصلاح! تم إصلاح ${fixedOrdersCount} طلب، و ${fixedFulfillmentsCount} عنصر تجهيز.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });