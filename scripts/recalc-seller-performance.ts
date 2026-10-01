import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL غير معرّف");

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function recalcSeller(sellerId: number) {
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { storeName: true },
  });
  if (!seller) return null;

  // ═══ الطلبات ═══
  const orders = await prisma.order.findMany({
    where: { sellerId },
    select: {
      id: true,
      status: true,
      total: true,
      sellerPayout: true,
      createdAt: true,
      statusHistory: {
        orderBy: { createdAt: "asc" },
        select: { toStatus: true, createdAt: true },
      },
    },
  });

  const totalOrders = orders.length;
  const deliveredOrders = orders.filter((o) => o.status === "DELIVERED").length;
  const cancelledOrders = orders.filter((o) => o.status === "CANCELLED").length;

  // ═══ معدل القبول ═══
  // = عدد الطلبات التي تحولت من NEW → PROCESSING (قبل الإلغاء)
  let acceptedCount = 0;
  let processingHoursSum = 0;
  let processingCount = 0;

  for (const order of orders) {
    const newEntry = order.statusHistory.find((h) => h.toStatus === "NEW");
    const processingEntry = order.statusHistory.find(
      (h) => h.toStatus === "PROCESSING"
    );

    if (processingEntry) {
      acceptedCount++;
      if (newEntry) {
        const hours =
          (processingEntry.createdAt.getTime() -
            newEntry.createdAt.getTime()) /
          (1000 * 60 * 60);
        processingHoursSum += hours;
        processingCount++;
      }
    }
  }

  const acceptanceRate =
    totalOrders > 0 ? acceptedCount / totalOrders : 0;
  const cancellationRate =
    totalOrders > 0 ? cancelledOrders / totalOrders : 0;
  const avgProcessingHours =
    processingCount > 0 ? processingHoursSum / processingCount : 0;

  // ═══ التقييمات ═══
  const reviews = await prisma.review.findMany({
    where: {
      product: { sellerId },
      isApproved: true,
      deletedAt: null,
    },
    select: { rating: true },
  });

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  // ═══ الإيرادات ═══
  const totalRevenue = orders
    .filter((o) => o.status === "DELIVERED" || o.status === "RETURNED")
    .reduce((s, o) => s + Number(o.sellerPayout || o.total), 0);

  // ═══ COD Refusal ═══
  // = طلبات CANCELLED بعد SHIPPED (رفض عند التسليم)
  const codRefused = orders.filter((o) => {
    if (o.status !== "CANCELLED") return false;
    return o.statusHistory.some((h) => h.toStatus === "SHIPPED");
  }).length;

  const codRejectionRate =
    deliveredOrders + codRefused > 0
      ? codRefused / (deliveredOrders + codRefused)
      : 0;

  // ═══ Returns ═══
  const returnsCount = await prisma.returnRequest.count({
    where: {
      order: { sellerId },
      status: "COMPLETED",
    },
  });

  const returnRate =
    deliveredOrders > 0 ? returnsCount / deliveredOrders : 0;

  // ═══ التحديث ═══
  await prisma.seller.update({
    where: { id: sellerId },
    data: {
      totalOrders,
      totalRevenue,
      acceptanceRate,
      cancellationRate,
      codRejectionRate,
      returnRate,
      avgRating,
      avgProcessingHours,
      lastPerformanceUpdate: new Date(),
    },
  });

  return {
    storeName: seller.storeName,
    totalOrders,
    acceptanceRate: (acceptanceRate * 100).toFixed(1),
    cancellationRate: (cancellationRate * 100).toFixed(1),
    returnRate: (returnRate * 100).toFixed(1),
    avgRating: avgRating.toFixed(2),
    avgProcessingHours: avgProcessingHours.toFixed(1),
    totalRevenue: totalRevenue.toFixed(2),
  };
}

async function main() {
  console.log("📊 إعادة حساب أداء التجار...\n");

  const sellers = await prisma.seller.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });

  let count = 0;
  for (const seller of sellers) {
    const result = await recalcSeller(seller.id);
    if (result) {
      console.log(`✅ ${result.storeName}:`);
      console.log(`   - ${result.totalOrders} طلب`);
      console.log(`   - قبول: ${result.acceptanceRate}%`);
      console.log(`   - إلغاء: ${result.cancellationRate}%`);
      console.log(`   - إرجاع: ${result.returnRate}%`);
      console.log(`   - تقييم: ${result.avgRating} ⭐`);
      console.log(`   - تجهيز: ${result.avgProcessingHours} ساعة`);
      console.log(`   - إيرادات: ${result.totalRevenue} د.م`);
      console.log("");
      count++;
    }
  }

  console.log(`\n✅ تم تحديث ${count} تاجر`);
}

main()
  .catch((e) => {
    console.error("❌ خطأ:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());