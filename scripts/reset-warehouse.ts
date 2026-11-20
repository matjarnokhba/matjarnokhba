import "dotenv/config";
import { prisma } from "../lib/prisma";

// M12 — Guard rails
if (process.env.NODE_ENV === "production") {
  console.error("🚫 مرفوض: هذا السكربت لا يعمل في production.");
  process.exit(1);
}
if (!process.argv.includes("--confirm-wipe")) {
  console.error("🚫 مرفوض: استخدم --confirm-wipe لتأكيد التصفير.");
  console.error("   مثال: npx tsx --env-file=.env scripts/reset-warehouse.ts --confirm-wipe");
  process.exit(1);
}
const __dbHost = (process.env.DATABASE_URL || "").split("@")[1]?.split("/")[0] ?? "unknown";
console.log(`⚠️  سيتم إعادة ضبط المستودع في: ${__dbHost}`);

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
