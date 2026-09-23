import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL غير معرّف في .env");
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

// ═══════════════════════════════════════════
// التصنيفات
// ═══════════════════════════════════════════
const CATEGORIES = [
  { slug: "men-clothing", name: "ملابس رجالية" },
  { slug: "women-clothing", name: "ملابس نسائية" },
  { slug: "kids-clothing", name: "ملابس أطفال" },
  { slug: "shoes", name: "أحذية" },
  { slug: "bags", name: "حقائب ومحافظ" },
  { slug: "watches", name: "ساعات" },
  { slug: "jewelry", name: "مجوهرات" },
  { slug: "perfumes", name: "عطور" },
  { slug: "beauty", name: "جمال وعناية" },
  { slug: "phones", name: "هواتف" },
  { slug: "electronics", name: "إلكترونيات" },
  { slug: "home-kitchen", name: "منزل ومطبخ" },
  { slug: "tools", name: "أدوات" },
  { slug: "sports", name: "رياضة" },
  { slug: "toys", name: "ألعاب" },
  { slug: "books", name: "كتب" },
];

// ═══════════════════════════════════════════
// المنتجات (8 تجريبية)
// ═══════════════════════════════════════════
const PRODUCTS = [
  {
    slug: "men-shirt-classic-blue",
    name: "قميص رجالي كلاسيكي",
    categorySlug: "men-clothing",
    price: 149,
    oldPrice: 220,
    brand: "Nokhba Basics",
    rating: 4.7,
    reviewsCount: 128,
    sold: 542,
    badge: "الأكثر مبيعاً",
    freeShipping: false,
    description: "قميص قطني 100% بقصة عصرية مريحة، مثالي للعمل والمناسبات.",
    image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80",
    stock: 45,
  },
  {
    slug: "men-tshirt-premium-white",
    name: "تيشيرت رجالي بريميوم",
    categorySlug: "men-clothing",
    price: 89,
    oldPrice: 129,
    brand: "Nokhba Basics",
    rating: 4.6,
    reviewsCount: 87,
    sold: 312,
    badge: undefined,
    freeShipping: false,
    description: "تيشيرت بقطن مصري عالي الجودة، مريح ويدوم طويلاً.",
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80",
    stock: 78,
  },
  {
    slug: "women-dress-elegant-black",
    name: "فستان نسائي أنيق",
    categorySlug: "women-clothing",
    price: 289,
    oldPrice: 399,
    brand: "Elegance",
    rating: 4.9,
    reviewsCount: 203,
    sold: 412,
    badge: "الأكثر مبيعاً",
    freeShipping: true,
    description: "فستان أنيق بقصة راقية، مثالي للمناسبات الخاصة.",
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=80",
    stock: 28,
  },
  {
    slug: "shoes-sneakers-white",
    name: "حذاء رياضي أبيض",
    categorySlug: "shoes",
    price: 249,
    oldPrice: 349,
    brand: "SportMax",
    rating: 4.7,
    reviewsCount: 234,
    sold: 678,
    badge: "الأكثر مبيعاً",
    freeShipping: false,
    description: "حذاء رياضي مريح بتصميم عصري يناسب كل الإطلالات.",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80",
    stock: 89,
  },
  {
    slug: "bags-leather-women",
    name: "حقيبة يد جلد",
    categorySlug: "bags",
    price: 329,
    oldPrice: 449,
    brand: "Luxury",
    rating: 4.8,
    reviewsCount: 145,
    sold: 189,
    badge: "عرض خاص",
    freeShipping: true,
    description: "حقيبة جلد طبيعي فاخرة بحجم مثالي للاستخدام اليومي.",
    image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80",
    stock: 15,
  },
  {
    slug: "watch-royal-gold",
    name: "ساعة رويال الذهبية",
    categorySlug: "watches",
    price: 499,
    oldPrice: 699,
    brand: "Royal",
    rating: 4.8,
    reviewsCount: 87,
    sold: 156,
    badge: "جديد",
    freeShipping: true,
    description: "ساعة أنيقة مقاومة للماء بسوار معدني مريح.",
    image: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&q=80",
    stock: 12,
  },
  {
    slug: "perfume-amber-nights",
    name: "عطر ليالي العنبر",
    categorySlug: "perfumes",
    price: 289,
    oldPrice: 350,
    brand: "Luxury Scents",
    rating: 4.9,
    reviewsCount: 124,
    sold: 234,
    badge: "الأكثر مبيعاً",
    freeShipping: false,
    description: "مزيج دافئ من العنبر والورد والعود بلمسة فاخرة.",
    image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=600&q=80",
    stock: 34,
  },
  {
    slug: "phone-wireless-earbuds",
    name: "سماعات لاسلكية",
    categorySlug: "phones",
    price: 299,
    oldPrice: 449,
    brand: "TechPro",
    rating: 4.6,
    reviewsCount: 189,
    sold: 512,
    badge: "عرض خاص",
    freeShipping: false,
    description: "سماعات بلوتوث بجودة صوت عالية وعزل ممتاز للضوضاء.",
    image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80",
    stock: 67,
  },
];

// ═══════════════════════════════════════════
// الدالة الرئيسية
// ═══════════════════════════════════════════
async function main() {
  console.log("🌱 بدء Seed...\n");

  // 1. تنظيف البيانات القديمة
  console.log("🗑️  تنظيف البيانات القديمة...");
  await prisma.inventoryMovement.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.productVariantOptionValue.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  console.log("✅ تم التنظيف\n");

  // 2. المستخدم + البائع
  console.log("👤 إنشاء المستخدم والبائع...");
  const user = await prisma.user.upsert({
    where: { email: "admin@matjarnokhba.ma" },
    update: {},
    create: {
      email: "admin@matjarnokhba.ma",
      passwordHash: "SEED_PLACEHOLDER_NOT_FOR_LOGIN",
      name: "مدير نخبة",
      role: "SUPER_ADMIN",
    },
  });

  const seller = await prisma.seller.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      storeName: "متجر نخبة",
      slug: "matjar-nokhba",
      status: "ACTIVE",
    },
  });

  console.log(`✅ البائع: ${seller.storeName}\n`);

  // 3. التصنيفات
  console.log("📁 إنشاء التصنيفات...");
  const categoryMap = new Map<string, number>();

  for (const cat of CATEGORIES) {
    const created = await prisma.category.create({
      data: {
        name: cat.name,
        slug: cat.slug,
        isActive: true,
      },
    });
    categoryMap.set(cat.slug, created.id);
  }

  console.log(`✅ ${CATEGORIES.length} تصنيف\n`);

  // 4. المنتجات
  console.log("📦 إنشاء المنتجات...");
  let successCount = 0;

  for (const p of PRODUCTS) {
    const categoryId = categoryMap.get(p.categorySlug);
    if (!categoryId) {
      console.error(`⚠️  التصنيف "${p.categorySlug}" غير موجود — تخطي ${p.name}`);
      continue;
    }

    try {
      const product = await prisma.product.create({
        data: {
          sellerId: seller.id,
          categoryId,
          name: p.name,
          slug: p.slug,
          description: p.description,
          brand: p.brand,
          badge: p.badge,
          rating: p.rating,
          reviewsCount: p.reviewsCount,
          sold: p.sold,
          freeShipping: p.freeShipping,
          status: "ACTIVE",
          images: {
            create: [
              {
                url: p.image,
                order: 0,
                isMain: true,
              },
            ],
          },
        },
      });

      // Variant افتراضي
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: `${p.slug}-default`,
          price: p.price,
          discountPrice: p.oldPrice,
          isDefault: true,
          isActive: true,
          optionsHash: "DEFAULT",
        },
      });

      // Inventory
      await prisma.inventory.create({
        data: {
          variantId: variant.id,
          quantity: p.stock,
          reservedQuantity: 0,
          lowStockThreshold: 5,
        },
      });

      successCount++;
      console.log(`  ✅ ${p.name}`);
    } catch (err) {
      console.error(`  ❌ ${p.name}:`, err);
    }
  }

  console.log(`\n✅ ${successCount}/${PRODUCTS.length} منتج`);
  console.log("\n🎉 اكتمل Seed بنجاح!");
}

main()
  .catch((e) => {
    console.error("\n❌ فشل Seed:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });