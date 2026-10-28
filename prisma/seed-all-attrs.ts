import "dotenv/config";
import { prisma } from "../lib/prisma";

type AttrValue = string;
type AttrDef = {
  name: string;
  slug: string;
  type: "select" | "color" | "number" | "text";
  isVariantAxis: boolean;
  isRequired: boolean;
  order: number;
  values: AttrValue[];
};

type AttrSet = { rootSlug: string; attrs: AttrDef[] };

const SETS: AttrSet[] = [
  // ═══ NEW ROOT: FOOD ═══
  {
    rootSlug: "food",
    attrs: [
      {
        name: "وحدة البيع", slug: "unit", type: "select",
        isVariantAxis: true, isRequired: true, order: 1,
        values: ["قطعة", "علبة", "عبوة", "صندوق", "كيلوغرام", "غرام", "لتر", "مليلتر"],
      },
      {
        name: "الوزن/الحجم", slug: "pack-size", type: "select",
        isVariantAxis: true, isRequired: false, order: 2,
        values: ["100g", "250g", "500g", "1kg", "2kg", "5kg", "250ml", "500ml", "1L", "2L", "5L"],
      },
      {
        name: "بلد المنشأ", slug: "origin", type: "select",
        isVariantAxis: false, isRequired: false, order: 3,
        values: ["المغرب", "مستورد"],
      },
      {
        name: "شروط التخزين", slug: "storage", type: "select",
        isVariantAxis: false, isRequired: false, order: 4,
        values: ["درجة حرارة الغرفة", "تبريد", "تجميد", "بعيد عن الشمس"],
      },
      {
        name: "شهادة حلال", slug: "halal", type: "select",
        isVariantAxis: false, isRequired: false, order: 5,
        values: ["نعم", "لا"],
      },
    ],
  },

  // ═══ NEW ROOT: AUTOMOTIVE ═══
  {
    rootSlug: "automotive",
    attrs: [
      {
        name: "الماركة", slug: "brand", type: "select",
        isVariantAxis: false, isRequired: false, order: 1,
        values: ["Toyota", "Ford", "Renault", "Peugeot", "Volkswagen", "BMW", "Mercedes", "Hyundai", "Kia", "Dacia", "Fiat", "Citroën", "أخرى"],
      },
      {
        name: "ماركة المركبة", slug: "vehicle-make", type: "select",
        isVariantAxis: false, isRequired: false, order: 2,
        values: ["Toyota", "Renault", "Dacia", "Ford", "Peugeot", "Volkswagen", "Hyundai", "Kia", "Fiat", "Citroën", "أخرى"],
      },
      {
        name: "الحالة", slug: "condition", type: "select",
        isVariantAxis: false, isRequired: false, order: 3,
        values: ["جديد", "مستعمل", "مجدّد"],
      },
      {
        name: "رقم القطعة", slug: "part-number", type: "text",
        isVariantAxis: false, isRequired: false, order: 4,
        values: [],
      },
      {
        name: "سنة الصنع", slug: "year", type: "select",
        isVariantAxis: false, isRequired: false, order: 5,
        values: ["2025", "2024", "2023", "2022", "2021", "2020", "أقدم", "غير محدد"],
      },
    ],
  },

  // ═══ NEW ROOT: DIGITAL ═══
  {
    rootSlug: "digital",
    attrs: [
      {
        name: "الصيغة", slug: "format", type: "select",
        isVariantAxis: false, isRequired: false, order: 1,
        values: ["PDF", "EPUB", "MP4", "MP3", "ZIP", "DOCX", "تصميم (PSD/AI)", "أخرى"],
      },
      {
        name: "المنصة", slug: "platform", type: "select",
        isVariantAxis: false, isRequired: false, order: 2,
        values: ["Windows", "macOS", "Linux", "iOS", "Android", "الويب", "متعدد المنصات"],
      },
      {
        name: "مدة الوصول", slug: "access-duration", type: "select",
        isVariantAxis: false, isRequired: false, order: 3,
        values: ["دائم", "شهر", "3 أشهر", "6 أشهر", "سنة", "حتى تاريخ محدد"],
      },
      {
        name: "نوع الترخيص", slug: "license-type", type: "select",
        isVariantAxis: false, isRequired: false, order: 4,
        values: ["شخصي", "تجاري", "مؤسسي", "تعليمي"],
      },
      {
        name: "اللغة", slug: "language", type: "select",
        isVariantAxis: false, isRequired: false, order: 5,
        values: ["عربي", "فرنسي", "إنجليزي", "متعدد"],
      },
    ],
  },

  // ═══ NEW ROOT: RAW MATERIALS ═══
  {
    rootSlug: "raw-materials",
    attrs: [
      {
        name: "وحدة القياس", slug: "unit", type: "select",
        isVariantAxis: true, isRequired: true, order: 1,
        values: ["كيلوغرام", "غرام", "متر", "متر مربع", "متر مكعب", "لتر", "قطعة", "كرتون"],
      },
      {
        name: "الدرجة/الجودة", slug: "grade", type: "select",
        isVariantAxis: false, isRequired: false, order: 2,
        values: ["ممتاز", "جيد جدًا", "جيد", "اقتصادي"],
      },
      {
        name: "بلد المنشأ", slug: "origin", type: "select",
        isVariantAxis: false, isRequired: false, order: 3,
        values: ["المغرب", "مستورد"],
      },
      {
        name: "الشهادة", slug: "certification", type: "select",
        isVariantAxis: false, isRequired: false, order: 4,
        values: ["ISO", "CE", "CE + ISO", "بدون شهادة"],
      },
    ],
  },

  // ═══ ENHANCE: ELECTRONICS ═══
  {
    rootSlug: "electronics",
    attrs: [
      {
        name: "الحالة", slug: "condition", type: "select",
        isVariantAxis: false, isRequired: false, order: 10,
        values: ["جديد", "مستعمل", "مجدّد"],
      },
      {
        name: "الضمان", slug: "warranty", type: "select",
        isVariantAxis: false, isRequired: false, order: 11,
        values: ["بدون ضمان", "3 أشهر", "6 أشهر", "سنة", "سنتان"],
      },
    ],
  },

  // ═══ ENHANCE: TOYS ═══
  {
    rootSlug: "toys",
    attrs: [
      {
        name: "الفئة العمرية", slug: "age-range", type: "select",
        isVariantAxis: false, isRequired: false, order: 10,
        values: ["0-6 أشهر", "6-12 شهر", "1-3 سنوات", "3-6 سنوات", "6-12 سنة", "12+"],
      },
      {
        name: "معايير السلامة", slug: "safety", type: "select",
        isVariantAxis: false, isRequired: false, order: 11,
        values: ["CE", "ASTM", "EN71", "بدون"],
      },
    ],
  },

  // ═══ ENHANCE: BEAUTY ═══
  {
    rootSlug: "beauty",
    attrs: [
      {
        name: "نوع البشرة", slug: "skin-type", type: "select",
        isVariantAxis: false, isRequired: false, order: 10,
        values: ["دهنية", "جافة", "مختلطة", "حساسة", "جميع الأنواع"],
      },
      {
        name: "الحجم", slug: "volume", type: "select",
        isVariantAxis: true, isRequired: false, order: 11,
        values: ["30ml", "50ml", "100ml", "200ml", "500ml"],
      },
    ],
  },
];

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\u0600-\u06FF-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

async function main() {
  console.log("🌱 Seeding attributes for 4 new roots + 3 enhanced...\n");
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const set of SETS) {
    const root = await prisma.category.findUnique({ where: { slug: set.rootSlug } });
    if (!root) {
      console.log(`⚠️  Root "${set.rootSlug}" not found — skipping`);
      continue;
    }

    let created = 0, skipped = 0;

    for (const attr of set.attrs) {
      const existing = await prisma.categoryAttribute.findUnique({
        where: { categoryId_slug: { categoryId: root.id, slug: attr.slug } },
        select: { id: true },
      });
      if (existing) { skipped++; continue; }

      await prisma.categoryAttribute.create({
        data: {
          categoryId: root.id,
          name: attr.name,
          slug: attr.slug,
          type: attr.type,
          isVariantAxis: attr.isVariantAxis,
          isRequired: attr.isRequired,
          allowCustom: false,
          order: attr.order,
          isActive: true,
          values: {
            create: attr.values.map((v, i) => ({
              value: v,
              slug: toSlug(v) || `val-${i}`,
              order: i + 1,
              isActive: true,
            })),
          },
        },
      });
      created++;
    }

    console.log(`  ✅ ${set.rootSlug}: +${created} created, ${skipped} skipped`);
    totalCreated += created;
    totalSkipped += skipped;
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`✅ Total attributes created: ${totalCreated}`);
  console.log(`✅ Total skipped: ${totalSkipped}`);
  console.log(`════════════════════════════════════════`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("ERROR:", e); process.exit(1); });
