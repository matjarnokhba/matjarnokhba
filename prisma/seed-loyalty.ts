import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("🎁 بدء Seed الولاء...\n");

  // ═══ 1. Settings ═══
  await prisma.loyaltySettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      isEnabled: true,
      pointsPer100DH: 5,
      description: "احصل على نقاط مع كل عملية شراء. 5 نقاط لكل 100 درهم.",
    },
    update: {},
  });
  console.log("✅ Settings جاهزة");

  // ═══ 2. Tiers ═══
  const tiers = [
    {
      slug: "elite",
      name: "مفاجأة النخبة",
      description: "مكافأة أولى عند 1000 نقطة",
      icon: "🎁",
      requiredPoints: 1000,
      order: 1,
      rewardValueMin: 30,
      rewardValueMax: 60,
    },
    {
      slug: "premium",
      name: "المفاجأة المميزة",
      description: "مكافأة مميزة عند 5000 نقطة",
      icon: "⭐",
      requiredPoints: 5000,
      order: 2,
      rewardValueMin: 80,
      rewardValueMax: 150,
    },
    {
      slug: "gold",
      name: "المفاجأة الذهبية",
      description: "مكافأة ذهبية عند 10000 نقطة",
      icon: "🏆",
      requiredPoints: 10000,
      order: 3,
      rewardValueMin: 200,
      rewardValueMax: 350,
    },
    {
      slug: "royal",
      name: "المفاجأة الملكية",
      description: "أرقى مكافأة عند 50000 نقطة",
      icon: "👑",
      requiredPoints: 50000,
      order: 4,
      rewardValueMin: 500,
      rewardValueMax: 1000,
    },
  ];

  for (const t of tiers) {
    await prisma.loyaltyTier.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        name: t.name,
        description: t.description,
        icon: t.icon,
        requiredPoints: t.requiredPoints,
        order: t.order,
        rewardValueMin: t.rewardValueMin,
        rewardValueMax: t.rewardValueMax,
        isActive: true,
      },
      update: {
        name: t.name,
        description: t.description,
        icon: t.icon,
        requiredPoints: t.requiredPoints,
        order: t.order,
        rewardValueMin: t.rewardValueMin,
        rewardValueMax: t.rewardValueMax,
      },
    });
    console.log(`   ✓ ${t.icon} ${t.name} (${t.requiredPoints} نقطة)`);
  }

  // ═══ 3. Reward Categories ═══
  const categories = [
    { slug: "clothing", name: "ملابس", icon: "👕", order: 1 },
    { slug: "shoes", name: "أحذية", icon: "👟", order: 2 },
    { slug: "bags", name: "حقائب", icon: "👜", order: 3 },
    { slug: "accessories", name: "إكسسوارات", icon: "⌚", order: 4 },
    { slug: "beauty", name: "عطور وتجميل", icon: "💐", order: 5 },
    { slug: "home", name: "منزل ومطبخ", icon: "🏠", order: 6 },
    { slug: "electronics", name: "إلكترونيات", icon: "📱", order: 7 },
    { slug: "kids", name: "أطفال", icon: "🧸", order: 8 },
    { slug: "sports", name: "رياضة", icon: "⚽", order: 9 },
    { slug: "books", name: "كتب", icon: "📚", order: 10 },
  ];

  for (const c of categories) {
    await prisma.loyaltyRewardCategory.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        name: c.name,
        icon: c.icon,
        order: c.order,
        isActive: true,
      },
      update: {
        name: c.name,
        icon: c.icon,
        order: c.order,
      },
    });
    console.log(`   ✓ ${c.icon} ${c.name}`);
  }

  console.log("\n═══════════════════════════════════════");
  console.log("✅ Seed الولاء اكتمل");
  console.log("═══════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("❌ خطأ:", e);
    process.exit(1);
  })
  .finally(async () => {});