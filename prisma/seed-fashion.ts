import "dotenv/config";
import { prisma } from "../lib/prisma";

type SubCat = { slug: string; name: string };

const FASHION_SUBCATEGORIES: Record<string, SubCat[]> = {
  "men-clothing": [
    { slug: "men-shirts", name: "القمصان" },
    { slug: "men-tshirts", name: "التيشيرتات" },
    { slug: "men-pants-jeans", name: "السراويل والجينز" },
    { slug: "men-underwear", name: "الملابس الداخلية" },
    { slug: "men-jackets-coats", name: "السترات والمعاطف" },
    { slug: "men-suits-formal", name: "البدلات والملابس الرسمية" },
    { slug: "men-traditional", name: "الملابس التقليدية" },
    { slug: "men-homewear", name: "الملابس المنزلية" },
    { slug: "men-sportswear", name: "الملابس الرياضية" },
    { slug: "men-seasonal", name: "الملابس الشتوية والصيفية" },
    { slug: "men-workwear", name: "ملابس العمل" },
  ],
  "women-clothing": [
    { slug: "women-dresses", name: "الفساتين" },
    { slug: "women-blouses-shirts", name: "البلوزات والقمصان" },
    { slug: "women-skirts", name: "التنانير" },
    { slug: "women-pants-jeans", name: "السراويل والجينز" },
    { slug: "women-underwear", name: "الملابس الداخلية" },
    { slug: "women-homewear", name: "الملابس المنزلية" },
    { slug: "women-abayas-kaftans", name: "العبايات والقفاطين" },
    { slug: "women-jalabiya-traditional", name: "الجلابيب والملابس التقليدية" },
    { slug: "women-sportswear", name: "الملابس الرياضية" },
    { slug: "women-winter", name: "الملابس الشتوية" },
    { slug: "women-occasion", name: "ملابس المناسبات" },
    { slug: "women-swimwear", name: "ملابس السباحة" },
  ],
  "kids-clothing": [
    { slug: "kids-baby", name: "ملابس الرضع" },
    { slug: "kids-boys", name: "ملابس الأولاد" },
    { slug: "kids-girls", name: "ملابس البنات" },
    { slug: "kids-newborn", name: "ملابس حديثي الولادة" },
    { slug: "kids-occasion", name: "ملابس المناسبات" },
    { slug: "kids-school", name: "الملابس المدرسية" },
    { slug: "kids-sportswear", name: "الملابس الرياضية" },
    { slug: "kids-underwear", name: "الملابس الداخلية" },
    { slug: "kids-sleepwear", name: "ملابس النوم" },
  ],
  "shoes": [
    { slug: "shoes-sports", name: "الأحذية الرياضية" },
    { slug: "shoes-formal", name: "الأحذية الرسمية" },
    { slug: "shoes-casual", name: "الأحذية اليومية" },
    { slug: "shoes-sandals", name: "الصنادل" },
    { slug: "shoes-winter", name: "الأحذية الشتوية" },
    { slug: "shoes-women", name: "الأحذية النسائية" },
    { slug: "shoes-kids", name: "أحذية الأطفال" },
    { slug: "shoes-work", name: "أحذية العمل" },
    { slug: "shoes-walking-hiking", name: "أحذية المشي والرحلات" },
  ],
  "bags": [
    { slug: "bags-handbags", name: "حقائب اليد" },
    { slug: "bags-backpacks", name: "حقائب الظهر" },
    { slug: "bags-travel", name: "حقائب السفر" },
    { slug: "bags-laptop", name: "حقائب الحاسوب" },
    { slug: "bags-school", name: "الحقائب المدرسية" },
    { slug: "bags-wallets", name: "المحافظ" },
    { slug: "bags-kids", name: "حقائب الأطفال" },
    { slug: "bags-sports", name: "حقائب الرياضة" },
  ],
  "watches": [
    { slug: "watches-smart", name: "الساعات الذكية" },
    { slug: "watches-classic", name: "الساعات الكلاسيكية" },
    { slug: "watches-sports", name: "الساعات الرياضية" },
    { slug: "watches-kids", name: "ساعات الأطفال" },
  ],
  "jewelry": [
    { slug: "jewelry-rings", name: "الخواتم" },
    { slug: "jewelry-bracelets", name: "الأساور" },
    { slug: "jewelry-necklaces", name: "القلائد" },
    { slug: "jewelry-earrings", name: "الأقراط" },
    { slug: "jewelry-sunglasses", name: "النظارات الشمسية" },
    { slug: "jewelry-belts", name: "الأحزمة" },
    { slug: "jewelry-hats", name: "القبعات" },
    { slug: "jewelry-scarves", name: "الأوشحة" },
    { slug: "jewelry-hair-accessories", name: "إكسسوارات الشعر" },
    { slug: "jewelry-clothing-accessories", name: "إكسسوارات الملابس" },
  ],
};

async function main() {
  console.log("🌱 Seeding fashion subcategories...\n");
  let parentsUpdated = 0;
  let childrenCreated = 0;
  let childrenUpdated = 0;
  let parentsMissing = 0;

  for (const [parentSlug, children] of Object.entries(FASHION_SUBCATEGORIES)) {
    const parent = await prisma.category.findUnique({ where: { slug: parentSlug } });
    if (!parent) {
      console.log(`⚠️  Parent "${parentSlug}" not found — skipping its ${children.length} children`);
      parentsMissing++;
      continue;
    }

    await prisma.category.update({
      where: { id: parent.id },
      data: { isLeaf: false, level: 1 },
    });
    parentsUpdated++;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const exists = await prisma.category.findUnique({ where: { slug: child.slug } });
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: {
          name: child.name,
          parentId: parent.id,
          level: 2,
          isLeaf: true,
          isActive: true,
          order: i + 1,
        },
        create: {
          slug: child.slug,
          name: child.name,
          parentId: parent.id,
          level: 2,
          isLeaf: true,
          isActive: true,
          order: i + 1,
        },
      });
      if (exists) childrenUpdated++;
      else childrenCreated++;
    }
    console.log(`✅ ${parentSlug}: ${children.length} children`);
  }

  console.log("\n════════════════════════════════════════");
  console.log(`✅ Parents updated: ${parentsUpdated}`);
  console.log(`✅ Children created: ${childrenCreated}`);
  console.log(`✅ Children updated: ${childrenUpdated}`);
  if (parentsMissing > 0) console.log(`⚠️  Parents missing: ${parentsMissing}`);
  console.log("════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  });
