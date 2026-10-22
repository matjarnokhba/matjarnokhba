import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🧹 بدء إعادة ضبط المستودع ومسح المخلفات...");

  // 1. إلغاء جميع الطلبات التي لم تكتمل (لكي تختفي من شاشة المستودع)
  const stuckOrders = await prisma.order.updateMany({
    where: {
      status: { in: ["NEW", "PROCESSING", "SHIPPED", "PARTIALLY_DELIVERED"] }
    },
    data: { status: "CANCELLED" }
  });
  console.log(`✅ تم إلغاء ${stuckOrders.count} طلب قديم عالق.`);

  // 2. تحويل جميع عناصر التجهيز العالقة إلى "ملغاة" لتختفي من قوائم المستودع
  const stuckFulfillments = await prisma.fulfillmentItem.updateMany({
    where: {
      status: { in: ["PENDING", "PREPARING", "READY_FOR_COLLECTION", "COLLECTED", "IN_TRANSIT_TO_WAREHOUSE", "RECEIVED", "VERIFIED", "AVAILABLE_FOR_SHIPMENT", "ALLOCATED"] }
    },
    data: { status: "CANCELLED" }
  });
  console.log(`✅ تم إلغاء ${stuckFulfillments.count} عنصر تجهيز عالق في المستودع.`);

  // 3. حذف جميع ملفات التجميع (AssemblyFiles) بالكامل لأنها أصبحت غير صالحة
  const deletedAssemblyItems = await prisma.assemblyItem.deleteMany({});
  const deletedAssemblyFiles = await prisma.assemblyFile.deleteMany({});
  console.log(`✅ تم حذف ${deletedAssemblyFiles.count} ملف تجميع، و ${deletedAssemblyItems.count} عنصر تجميع.`);

  // 4. حذف أي شحنات مسودة أو معلقة
  const deletedShipments = await prisma.shipment.deleteMany({
    where: {
      status: { in: ["DRAFT", "WAITING_FOR_ITEMS", "READY", "ASSIGNED"] }
    }
  });
  console.log(`✅ تم حذف ${deletedShipments.count} شحنة عالقة.`);

  console.log(`🎉 اكتمل التنظيف الشامل! شاشة المستودع أصبحت فارغة تماماً وجاهزة للتجربة من الصفر.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
