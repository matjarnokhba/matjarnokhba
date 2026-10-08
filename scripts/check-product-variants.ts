import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      productCode: true,
      status: true,
      _count: { select: { variants: true } },
    },
    orderBy: { id: "desc" },
    take: 20,
  });

  console.log("\n📦 آخر 20 منتج:\n");
  for (const p of products) {
    const allVariants = await prisma.productVariant.findMany({
      where: { productId: p.id },
      select: { id: true, isActive: true, optionsHash: true },
    });

    const activeCount = allVariants.filter((v) => v.isActive).length;
    const inactiveCount = allVariants.length - activeCount;

    console.log(
      `#${p.id} — ${p.name}`
    );
    console.log(
      `   Status: ${p.status} · Total: ${allVariants.length} · ✅ Active: ${activeCount} · ❌ Inactive: ${inactiveCount}`
    );
    console.log(
      `   Code: ${p.productCode}`
    );
    console.log("");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {});