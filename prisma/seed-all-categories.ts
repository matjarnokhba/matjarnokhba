import "dotenv/config";
import { prisma } from "../lib/prisma";

type Sub = { slug: string; name: string };
type Root = {
  slug: string;
  name: string;
  children: Sub[];
};

const ROOTS: Root[] = [
  // ═══ NEW ROOTS ═══
  {
    slug: "food", name: "أغذية ومشروبات",
    children: [
      { slug: "food-packaged", name: "مواد غذائية معبأة" },
      { slug: "food-beverages", name: "مشروبات" },
      { slug: "food-fresh", name: "منتجات طازجة" },
      { slug: "food-frozen", name: "مبردة ومجمدة" },
      { slug: "food-sweets", name: "حلويات ومخبوزات" },
      { slug: "food-specialty", name: "أغذية متخصصة" },
    ],
  },
  {
    slug: "automotive", name: "سيارات وقطع غيار",
    children: [
      { slug: "auto-parts", name: "قطع غيار السيارات" },
      { slug: "auto-oils", name: "زيوت ومواد استهلاكية" },
      { slug: "auto-accessories", name: "إكسسوارات السيارات" },
      { slug: "auto-motorcycle", name: "دراجات نارية وملحقاتها" },
      { slug: "auto-tools", name: "أدوات ومعدات مهنية" },
      { slug: "auto-building", name: "مواد البناء والتجهيز" },
      { slug: "auto-industrial", name: "معدات صناعية وكهربائية" },
    ],
  },
  {
    slug: "digital", name: "منتجات رقمية",
    children: [
      { slug: "digital-software", name: "برامج وتطبيقات" },
      { slug: "digital-files", name: "كتب وملفات رقمية" },
      { slug: "digital-courses", name: "دورات تعليمية" },
      { slug: "digital-services", name: "خدمات رقمية" },
      { slug: "digital-subscriptions", name: "اشتراكات وتراخيص" },
    ],
  },
  {
    slug: "raw-materials", name: "مواد خام ومستلزمات",
    children: [
      { slug: "raw-fabrics", name: "أقمشة ومنسوجات" },
      { slug: "raw-wood", name: "خشب ومواد خشبية" },
      { slug: "raw-metals", name: "معادن ومواد معدنية" },
      { slug: "raw-construction", name: "مواد بناء خام" },
      { slug: "raw-packaging", name: "مواد تغليف وتعبئة" },
      { slug: "raw-chemicals", name: "مواد كيميائية صناعية" },
      { slug: "raw-factory", name: "مستلزمات مصانع وورش" },
    ],
  },
  // ═══ EXISTING ROOTS — add children ═══
  {
    slug: "phones", name: "هواتف",
    children: [
      { slug: "phones-smart", name: "هواتف ذكية" },
      { slug: "phones-feature", name: "هواتف تقليدية" },
      { slug: "phones-refurbished", name: "هواتف مجددة" },
      { slug: "phones-used", name: "هواتف مستعملة" },
    ],
  },
  {
    slug: "electronics", name: "إلكترونيات",
    children: [
      { slug: "elec-laptops", name: "حواسيب محمولة" },
      { slug: "elec-tablets", name: "أجهزة لوحية" },
      { slug: "elec-tvs-audio", name: "تلفزيونات وصوتيات" },
      { slug: "elec-cameras", name: "كاميرات وتصوير" },
      { slug: "elec-appliances", name: "أجهزة منزلية" },
      { slug: "elec-accessories", name: "ملحقات إلكترونية" },
      { slug: "elec-gaming", name: "ألعاب إلكترونية" },
    ],
  },
  {
    slug: "home-kitchen", name: "منزل ومطبخ",
    children: [
      { slug: "home-furniture", name: "أثاث" },
      { slug: "home-decor", name: "ديكور وتحف" },
      { slug: "home-lighting", name: "إضاءة وكهرباء" },
      { slug: "home-cookware", name: "أدوات مطبخ ومائدة" },
      { slug: "home-textiles", name: "مفروشات ومنسوجات" },
      { slug: "home-cleaning", name: "تنظيف وتنظيم" },
      { slug: "home-garden", name: "حديقة وزراعة" },
    ],
  },
  {
    slug: "tools", name: "أدوات",
    children: [
      { slug: "tools-hand", name: "أدوات يدوية" },
      { slug: "tools-power", name: "أدوات كهربائية" },
      { slug: "tools-measuring", name: "أدوات قياس" },
      { slug: "tools-welding", name: "معدات لحام" },
      { slug: "tools-workshop", name: "معدات ورش" },
    ],
  },
  {
    slug: "sports", name: "رياضة",
    children: [
      { slug: "sports-clothing", name: "ملابس وأحذية رياضية" },
      { slug: "sports-equipment", name: "معدات تمارين ولياقة" },
      { slug: "sports-team", name: "رياضات جماعية وفردية" },
      { slug: "sports-camping", name: "تخييم ورحلات" },
      { slug: "sports-cycling", name: "دراجات وملحقاتها" },
      { slug: "sports-hobbies", name: "ألعاب وهوايات" },
    ],
  },
  {
    slug: "toys", name: "ألعاب",
    children: [
      { slug: "toys-kids", name: "ألعاب أطفال" },
      { slug: "toys-baby", name: "مستلزمات رضع" },
      { slug: "toys-strollers", name: "عربات ومقاعد سيارات" },
      { slug: "toys-furniture", name: "أثاث أطفال" },
      { slug: "toys-school", name: "مستلزمات مدرسية" },
      { slug: "toys-maternity", name: "حمل وأمومة" },
    ],
  },
  {
    slug: "beauty", name: "جمال وعناية",
    children: [
      { slug: "beauty-skincare", name: "عناية بالبشرة" },
      { slug: "beauty-haircare", name: "عناية بالشعر" },
      { slug: "beauty-makeup", name: "مكياج وتجميل" },
      { slug: "beauty-hygiene", name: "نظافة شخصية" },
      { slug: "beauty-devices", name: "أجهزة وأدوات شخصية" },
      { slug: "beauty-health", name: "منتجات صحية" },
    ],
  },
  {
    slug: "perfumes", name: "عطور",
    children: [
      { slug: "perfumes-fragrance", name: "عطور" },
      { slug: "perfumes-deodorant", name: "مزيلات عرق" },
      { slug: "perfumes-home", name: "عطور منزل" },
      { slug: "perfumes-air", name: "معطرات جو" },
    ],
  },
  {
    slug: "books", name: "كتب",
    children: [
      { slug: "books-print", name: "كتب مطبوعة" },
      { slug: "books-dictionaries", name: "قواميس ومعاجم" },
      { slug: "books-educational", name: "كتب تعليمية" },
      { slug: "books-children", name: "كتب أطفال" },
    ],
  },
];

async function main() {
  console.log("🌱 Seeding all category tree...\n");
  let rootsCreated = 0, rootsUpdated = 0;
  let childrenCreated = 0, childrenUpdated = 0;

  for (const root of ROOTS) {
    const existing = await prisma.category.findUnique({ where: { slug: root.slug } });
    let parentId: number;

    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: { isLeaf: false, level: 1, isActive: true },
      });
      parentId = existing.id;
      rootsUpdated++;
    } else {
      const created = await prisma.category.create({
        data: {
          slug: root.slug,
          name: root.name,
          parentId: null,
          level: 1,
          isLeaf: false,
          isActive: true,
          order: 999,
        },
      });
      parentId = created.id;
      rootsCreated++;
      console.log(`  🆕 root: ${root.slug}`);
    }

    for (let i = 0; i < root.children.length; i++) {
      const child = root.children[i];
      const exists = await prisma.category.findUnique({ where: { slug: child.slug } });
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: {
          name: child.name,
          parentId,
          level: 2,
          isLeaf: true,
          isActive: true,
          order: i + 1,
        },
        create: {
          slug: child.slug,
          name: child.name,
          parentId,
          level: 2,
          isLeaf: true,
          isActive: true,
          order: i + 1,
        },
      });
      if (exists) childrenUpdated++;
      else childrenCreated++;
    }
    console.log(`  ✅ ${root.slug}: ${root.children.length} children`);
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`Roots: +${rootsCreated} created, ${rootsUpdated} updated`);
  console.log(`Children: +${childrenCreated} created, ${childrenUpdated} updated`);
  console.log(`════════════════════════════════════════`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("ERROR:", e); process.exit(1); });
