import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🧹 بدء تنظيف مخلفات المستودع...");

  // 1. إصلاح عناصر التجهيز (FulfillmentItems) التي حالتها عالقة في المستودع
  // نبحث عن أي عنصر في المستودع، وننظر لحالة الطلب الأصلي
  const stuckItems = await prisma.fulfillmentItem.findMany({
    where: {
      status: {
        in: ["RECEIVED", "VERIFIED", "AVAILABLE_FOR_SHIPMENT", "ALLOCATED", "IN_TRANSIT_TO_WAREHOUSE", "COLLECTED", "READY_FOR_COLLECTION"]
      }
    },
    include: {
      orderItem: {
        include: { order: { select: { status: true, orderNumber: true } } }
      }
    }
  });

  let fixedFulfillments = 0;

  for (const item of stuckItems) {
    const orderStatus = item.orderItem.order.status;
    let newStatus: any = null;

    if (orderStatus === "DELIVERED") newStatus = "DELIVERED";
    else if (orderStatus === "CANCELLED") newStatus = "CANCELLED";
    else if (orderStatus === "RETURNED") newStatus = "RETURNED";

    if (newStatus && item.status !== newStatus) {
      await prisma.fulfillmentItem.update({
        where: { id: item.id },
        data: { status: newStatus }
      });
      console.log(`✅ تم إصلاح عنصر تجهيز للطلب #${item.orderItem.order.orderNumber} (من ${item.status} إلى ${newStatus})`);
      fixedFulfillments++;
    }
  }

  // 2. إصلاح الشحنات (Shipments) العالقة التي تم تسليم طلباتها بالفعل
  const stuckShipments = await prisma.shipment.findMany({
    where: {
      status: { in: ["DRAFT", "WAITING_FOR_ITEMS", "READY", "ASSIGNED"] }
    },
    include: {
      items: {
        include: {
          order: { select: { status: true, orderNumber: true } }
        }
      }
    }
  });

  let fixedShipments = 0;

  for (const shipment of stuckShipments) {
    if (shipment.items.length > 0) {
      const allDelivered = shipment.items.every(i => i.order.status === "DELIVERED");
      const allReturned = shipment.items.every(i => i.order.status === "RETURNED" || i.order.status === "CANCELLED");

      if (allDelivered) {
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: { status: "DELIVERED" }
        });
        console.log(`✅ تم إغلاق الشحنة #${shipment.shipmentNumber} (لأن جميع طلباتها مسلمة)`);
        fixedShipments++;
      } else if (allReturned) {
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: { status: "RETURNED" }
        });
        console.log(`✅ تم إغلاق الشحنة #${shipment.shipmentNumber} (لأن جميع طلباتها مرتجعة)`);
        fixedShipments++;
      }
    }
  }

  console.log(`🎉 اكتمل التنظيف! تم إصلاح ${fixedFulfillments} عنصر تجهيز، و ${fixedShipments} شحنة.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });