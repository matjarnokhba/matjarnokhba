import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL غير معرّف");

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔧 إعادة حساب تقييمات كل المنتجات...\n");

  const products = await prisma.product.findMany({
    select: { id: true, name: true },
  });

  let updated = 0;

  for (const product of products) {
    const reviews = await prisma.review.findMany({
      where: {
        productId: product.id,
        isApproved: true,
        deletedAt: null,
      },
      select: { rating: true },
    });

    const count = reviews.length;
    const avg =
      count > 0
        ? reviews.reduce((s, r) => s + r.rating, 0) / count
        : 0;

    const soldAgg = await prisma.orderItem.aggregate({
      where: {
        productId: product.id,
        order: { status: { in: ["DELIVERED", "RETURNED"] } },
      },
      _sum: { quantity: true },
    });
    const sold = soldAgg._sum.quantity ?? 0;

    await prisma.product.update({
      where: { id: product.id },
      data: { rating: avg, reviewsCount: count, sold },
    });

    console.log(
      `  ✅ [${product.id}] ${product.name}: rating=${avg.toFixed(1)}، reviews=${count}، sold=${sold}`
    );
    updated++;
  }

  console.log(`\n✅ تم تحديث ${updated} منتج`);
}

main()
  .catch((e) => {
    console.error("❌ خطأ:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());