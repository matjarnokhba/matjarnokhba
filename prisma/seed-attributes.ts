import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter } as any);

// ═══════════════════════════════════════════
// خصائص كل فئة (مفتاح = كلمة في اسم الفئة)
// ═══════════════════════════════════════════

type AttrDef = {
  name: string;
  slug: string;
  type?: "select" | "color" | "number" | "text";
  isVariantAxis?: boolean;
  isRequired?: boolean;
  values: Array<{ value: string; slug: string; hex?: string }>;
};

type CategoryAttrs = {
  match: string[];   // كلمات للتعرف على الفئة
  attrs: AttrDef[];
};

const SIZES_CLOTHING = [
  { value: "XS", slug: "xs" },
  { value: "S", slug: "s" },
  { value: "M", slug: "m" },
  { value: "L", slug: "l" },
  { value: "XL", slug: "xl" },
  { value: "XXL", slug: "xxl" },
  { value: "3XL", slug: "3xl" },
];

const SIZES_SHOES = [
  { value: "36", slug: "36" },
  { value: "37", slug: "37" },
  { value: "38", slug: "38" },
  { value: "39", slug: "39" },
  { value: "40", slug: "40" },
  { value: "41", slug: "41" },
  { value: "42", slug: "42" },
  { value: "43", slug: "43" },
  { value: "44", slug: "44" },
  { value: "45", slug: "45" },
  { value: "46", slug: "46" },
];

const COLORS = [
  { value: "أسود", slug: "black", hex: "#000000" },
  { value: "أبيض", slug: "white", hex: "#FFFFFF" },
  { value: "رمادي", slug: "gray", hex: "#808080" },
  { value: "أحمر", slug: "red", hex: "#EF4444" },
  { value: "أزرق", slug: "blue", hex: "#3B82F6" },
  { value: "كحلي", slug: "navy", hex: "#1E3A8A" },
  { value: "أخضر", slug: "green", hex: "#22C55E" },
  { value: "أصفر", slug: "yellow", hex: "#FACC15" },
  { value: "برتقالي", slug: "orange", hex: "#F97316" },
  { value: "وردي", slug: "pink", hex: "#EC4899" },
  { value: "بنفسجي", slug: "purple", hex: "#8B5CF6" },
  { value: "بني", slug: "brown", hex: "#78350F" },
  { value: "بيج", slug: "beige", hex: "#F5F5DC" },
  { value: "ذهبي", slug: "gold", hex: "#EAB308" },
  { value: "فضي", slug: "silver", hex: "#C0C0C0" },
];

const CATEGORIES: CategoryAttrs[] = [
  // ═══ ملابس ═══
  {
    match: ["ملابس", "قمصان", "بنطلون", "فساتين", "جاكيت"],
    attrs: [
      { name: "المقاس", slug: "size", type: "select", isVariantAxis: true, values: SIZES_CLOTHING },
      { name: "اللون", slug: "color", type: "color", isVariantAxis: true, values: COLORS },
      { name: "الخامة", slug: "material", type: "select", isVariantAxis: true, values: [
        { value: "قطن", slug: "cotton" },
        { value: "بوليستر", slug: "polyester" },
        { value: "كتان", slug: "linen" },
        { value: "صوف", slug: "wool" },
        { value: "حرير", slug: "silk" },
        { value: "دنيم", slug: "denim" },
        { value: "جلد", slug: "leather" },
      ]},
      { name: "النمط", slug: "style", type: "select", isVariantAxis: false, values: [
        { value: "كاجوال", slug: "casual" },
        { value: "رسمي", slug: "formal" },
        { value: "رياضي", slug: "sport" },
        { value: "تقليدي", slug: "traditional" },
      ]},
    ],
  },
  // ═══ أحذية ═══
  {
    match: ["أحذية", "حذاء", "صندل", "صنادل"],
    attrs: [
      { name: "المقاس", slug: "size", type: "select", isVariantAxis: true, values: SIZES_SHOES },
      { name: "اللون", slug: "color", type: "color", isVariantAxis: true, values: COLORS },
      { name: "الخامة", slug: "material", type: "select", isVariantAxis: false, values: [
        { value: "جلد طبيعي", slug: "real-leather" },
        { value: "جلد صناعي", slug: "faux-leather" },
        { value: "قماش", slug: "fabric" },
        { value: "مطاط", slug: "rubber" },
        { value: "شامواه", slug: "suede" },
      ]},
      { name: "النوع", slug: "shoe-type", type: "select", isVariantAxis: false, values: [
        { value: "رياضي", slug: "sneakers" },
        { value: "رسمي", slug: "formal" },
        { value: "كاجوال", slug: "casual" },
        { value: "صندل", slug: "sandals" },
        { value: "بوت", slug: "boots" },
      ]},
    ],
  },
  // ═══ حقائب ═══
  {
    match: ["حقائب", "حقيبة", "شنط"],
    attrs: [
      { name: "اللون", slug: "color", type: "color", isVariantAxis: true, values: COLORS },
      { name: "الحجم", slug: "size", type: "select", isVariantAxis: true, values: [
        { value: "صغير", slug: "small" },
        { value: "متوسط", slug: "medium" },
        { value: "كبير", slug: "large" },
      ]},
      { name: "الخامة", slug: "material", type: "select", isVariantAxis: true, values: [
        { value: "جلد", slug: "leather" },
        { value: "قماش", slug: "fabric" },
        { value: "نايلون", slug: "nylon" },
        { value: "بوليستر", slug: "polyester" },
      ]},
      { name: "النوع", slug: "bag-type", type: "select", isVariantAxis: false, values: [
        { value: "حقيبة يد", slug: "handbag" },
        { value: "حقيبة ظهر", slug: "backpack" },
        { value: "حقيبة كتف", slug: "shoulder" },
        { value: "حقيبة سفر", slug: "travel" },
      ]},
    ],
  },
  // ═══ ساعات ═══
  {
    match: ["ساعات", "ساعة"],
    attrs: [
      { name: "اللون", slug: "color", type: "color", isVariantAxis: true, values: COLORS },
      { name: "مادة السوار", slug: "strap-material", type: "select", isVariantAxis: true, values: [
        { value: "جلد", slug: "leather" },
        { value: "معدن", slug: "metal" },
        { value: "سيليكون", slug: "silicone" },
        { value: "قماش", slug: "fabric" },
      ]},
      { name: "النوع", slug: "watch-type", type: "select", isVariantAxis: false, values: [
        { value: "كلاسيكية", slug: "classic" },
        { value: "رياضية", slug: "sport" },
        { value: "ذكية", slug: "smart" },
        { value: "فاخرة", slug: "luxury" },
      ]},
    ],
  },
  // ═══ إلكترونيات ═══
  {
    match: ["إلكترونيات", "الكترونيات"],
    attrs: [
      { name: "اللون", slug: "color", type: "color", isVariantAxis: true, values: COLORS },
      { name: "الماركة", slug: "brand", type: "select", isVariantAxis: false, values: [
        { value: "Samsung", slug: "samsung" },
        { value: "Apple", slug: "apple" },
        { value: "Xiaomi", slug: "xiaomi" },
        { value: "Huawei", slug: "huawei" },
        { value: "Sony", slug: "sony" },
        { value: "LG", slug: "lg" },
      ]},
      { name: "السعة", slug: "storage", type: "select", isVariantAxis: true, values: [
        { value: "32GB", slug: "32gb" },
        { value: "64GB", slug: "64gb" },
        { value: "128GB", slug: "128gb" },
        { value: "256GB", slug: "256gb" },
        { value: "512GB", slug: "512gb" },
        { value: "1TB", slug: "1tb" },
      ]},
    ],
  },
  // ═══ هواتف ═══
  {
    match: ["هواتف", "هاتف"],
    attrs: [
      { name: "اللون", slug: "color", type: "color", isVariantAxis: true, values: COLORS },
      { name: "الذاكرة العشوائية", slug: "ram", type: "select", isVariantAxis: true, values: [
        { value: "4GB", slug: "4gb" },
        { value: "6GB", slug: "6gb" },
        { value: "8GB", slug: "8gb" },
        { value: "12GB", slug: "12gb" },
        { value: "16GB", slug: "16gb" },
      ]},
      { name: "التخزين", slug: "storage", type: "select", isVariantAxis: true, values: [
        { value: "64GB", slug: "64gb" },
        { value: "128GB", slug: "128gb" },
        { value: "256GB", slug: "256gb" },
        { value: "512GB", slug: "512gb" },
      ]},
    ],
  },
  // ═══ حواسيب ═══
  {
    match: ["حواسيب", "حاسوب", "لابتوب", "كمبيوتر"],
    attrs: [
      { name: "اللون", slug: "color", type: "color", isVariantAxis: true, values: COLORS },
      { name: "الذاكرة العشوائية", slug: "ram", type: "select", isVariantAxis: true, values: [
        { value: "8GB", slug: "8gb" },
        { value: "16GB", slug: "16gb" },
        { value: "32GB", slug: "32gb" },
        { value: "64GB", slug: "64gb" },
      ]},
      { name: "التخزين", slug: "storage", type: "select", isVariantAxis: true, values: [
        { value: "256GB SSD", slug: "256-ssd" },
        { value: "512GB SSD", slug: "512-ssd" },
        { value: "1TB SSD", slug: "1tb-ssd" },
        { value: "2TB SSD", slug: "2tb-ssd" },
      ]},
    ],
  },
  // ═══ أثاث ═══
  {
    match: ["أثاث", "كنب", "طاولات", "كراسي"],
    attrs: [
      { name: "اللون", slug: "color", type: "color", isVariantAxis: true, values: COLORS },
      { name: "المقاس", slug: "size", type: "select", isVariantAxis: true, values: [
        { value: "صغير", slug: "small" },
        { value: "متوسط", slug: "medium" },
        { value: "كبير", slug: "large" },
      ]},
      { name: "المادة", slug: "material", type: "select", isVariantAxis: true, values: [
        { value: "خشب", slug: "wood" },
        { value: "معدن", slug: "metal" },
        { value: "زجاج", slug: "glass" },
        { value: "بلاستيك", slug: "plastic" },
        { value: "جلد", slug: "leather" },
      ]},
    ],
  },
  // ═══ منزل ومطبخ ═══
  {
    match: ["منزل", "مطبخ", "أدوات"],
    attrs: [
      { name: "اللون", slug: "color", type: "color", isVariantAxis: true, values: COLORS },
      { name: "الحجم", slug: "size", type: "select", isVariantAxis: true, values: [
        { value: "صغير", slug: "small" },
        { value: "متوسط", slug: "medium" },
        { value: "كبير", slug: "large" },
      ]},
      { name: "المادة", slug: "material", type: "select", isVariantAxis: false, values: [
        { value: "ستانلس ستيل", slug: "stainless-steel" },
        { value: "زجاج", slug: "glass" },
        { value: "سيراميك", slug: "ceramic" },
        { value: "خشب", slug: "wood" },
        { value: "بلاستيك", slug: "plastic" },
      ]},
    ],
  },
  // ═══ جمال وعطور ═══
  {
    match: ["جمال", "تجميل", "عطور", "عناية"],
    attrs: [
      { name: "الحجم", slug: "size", type: "select", isVariantAxis: true, values: [
        { value: "30ml", slug: "30ml" },
        { value: "50ml", slug: "50ml" },
        { value: "75ml", slug: "75ml" },
        { value: "100ml", slug: "100ml" },
        { value: "200ml", slug: "200ml" },
      ]},
      { name: "الرائحة", slug: "scent", type: "select", isVariantAxis: true, values: [
        { value: "زهري", slug: "floral" },
        { value: "خشبي", slug: "woody" },
        { value: "حمضي", slug: "citrus" },
        { value: "شرقي", slug: "oriental" },
      ]},
    ],
  },
  // ═══ كتب ═══
  {
    match: ["كتب", "كتاب", "قرطاسية", "مكتبية"],
    attrs: [
      { name: "اللغة", slug: "language", type: "select", isVariantAxis: true, values: [
        { value: "العربية", slug: "arabic" },
        { value: "الفرنسية", slug: "french" },
        { value: "الإنجليزية", slug: "english" },
      ]},
      { name: "نوع الغلاف", slug: "cover", type: "select", isVariantAxis: true, values: [
        { value: "ورقي", slug: "paperback" },
        { value: "مقوى", slug: "hardcover" },
      ]},
      { name: "الإصدار", slug: "edition", type: "select", isVariantAxis: false, values: [
        { value: "الأول", slug: "first" },
        { value: "الثاني", slug: "second" },
        { value: "الثالث", slug: "third" },
      ]},
    ],
  },
  // ═══ رياضة ═══
  {
    match: ["رياضة", "رياضية", "دراجات"],
    attrs: [
      { name: "المقاس", slug: "size", type: "select", isVariantAxis: true, values: SIZES_CLOTHING },
      { name: "اللون", slug: "color", type: "color", isVariantAxis: true, values: COLORS },
      { name: "المادة", slug: "material", type: "select", isVariantAxis: false, values: [
        { value: "بوليستر", slug: "polyester" },
        { value: "نايلون", slug: "nylon" },
        { value: "قطن", slug: "cotton" },
      ]},
    ],
  },
  // ═══ ألعاب أطفال ═══
  {
    match: ["ألعاب", "أطفال", "رضع"],
    attrs: [
      { name: "الفئة العمرية", slug: "age", type: "select", isVariantAxis: true, values: [
        { value: "0-6 أشهر", slug: "0-6m" },
        { value: "6-12 شهر", slug: "6-12m" },
        { value: "1-3 سنوات", slug: "1-3y" },
        { value: "3-6 سنوات", slug: "3-6y" },
        { value: "6-12 سنة", slug: "6-12y" },
      ]},
      { name: "اللون", slug: "color", type: "color", isVariantAxis: true, values: COLORS },
    ],
  },
];

// ═══════════════════════════════════════════
// التشغيل
// ═══════════════════════════════════════════

async function main() {
  console.log("🚀 بدء إضافة خصائص الفئات...\n");

  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true },
  });

  console.log(`📂 عدد الفئات الموجودة: ${categories.length}\n`);

  let totalAttrs = 0;
  let totalValues = 0;
  let unmatched = 0;

  for (const cat of categories) {
    // ابحث عن تعريف يناسب الفئة
    const def = CATEGORIES.find((c) =>
      c.match.some((m) => cat.name.includes(m) || cat.slug.includes(m))
    );

    if (!def) {
      unmatched++;
      continue;
    }

    console.log(`📌 ${cat.name} (${cat.slug}):`);

    for (const attr of def.attrs) {
      const created = await prisma.categoryAttribute.upsert({
        where: {
          categoryId_slug: { categoryId: cat.id, slug: attr.slug },
        },
        create: {
          categoryId: cat.id,
          name: attr.name,
          slug: attr.slug,
          type: attr.type || "select",
          isVariantAxis: attr.isVariantAxis ?? true,
          isRequired: attr.isRequired ?? false,
          values: {
            create: attr.values.map((v, i) => ({
              value: v.value,
              slug: v.slug,
              colorHex: v.hex || null,
              order: i,
            })),
          },
        },
        update: {
          name: attr.name,
          type: attr.type || "select",
          isVariantAxis: attr.isVariantAxis ?? true,
        },
        include: { values: true },
      });

      totalAttrs++;
      totalValues += created.values.length;

      console.log(`   ✓ ${attr.name} (${created.values.length} قيمة)`);
    }

    console.log("");
  }

  console.log("═══════════════════════════════════════");
  console.log(`✅ الفئات المُحدّثة: ${categories.length - unmatched}`);
  console.log(`⏭️  الفئات بدون خصائص: ${unmatched}`);
  console.log(`📋 إجمالي الخصائص: ${totalAttrs}`);
  console.log(`🎨 إجمالي القيم: ${totalValues}`);
  console.log("═══════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("❌ خطأ:", e);
    process.exit(1);
  })
  