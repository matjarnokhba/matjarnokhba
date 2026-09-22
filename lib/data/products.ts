import type { CategoryId } from "./categories";
import { getCategoryById } from "./categories";

// ═══════════════════════════════════════════
// الأنواع
// ═══════════════════════════════════════════
export type Product = {
  id: number;
  slug: string;
  name: string;
  categoryId: CategoryId;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  sold: number;
  images: string[];
  colors?: string[];
  sizes?: string[];
  brand?: string;
  stock: number;
  freeShipping: boolean;
  badge?: string;
  description: string;
};

export type CartItem = Product & {
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
};

// ═══════════════════════════════════════════
// الإعدادات
// ═══════════════════════════════════════════
export const SHIPPING_FEE = 30;
export const FREE_SHIPPING_THRESHOLD = 300;
export const CURRENCY = "د.م";

// ═══════════════════════════════════════════
// المنتجات
// ═══════════════════════════════════════════
export const PRODUCTS: Product[] = [
  // ═══════════ ملابس رجالية ═══════════
  {
    id: 1,
    slug: "men-shirt-classic-blue",
    name: "قميص رجالي كلاسيكي",
    categoryId: "men-clothing",
    price: 149,
    oldPrice: 220,
    rating: 4.7,
    reviews: 128,
    sold: 542,
    images: [
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80",
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&q=80",
    ],
    colors: ["#1e40af", "#ffffff", "#000000"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    brand: "Nokhba Basics",
    stock: 45,
    freeShipping: false,
    badge: "الأكثر مبيعاً",
    description: "قميص قطني 100% بقصة عصرية مريحة، مثالي للعمل والمناسبات.",
  },
  {
    id: 2,
    slug: "men-tshirt-premium-white",
    name: "تيشيرت رجالي بريميوم",
    categoryId: "men-clothing",
    price: 89,
    oldPrice: 129,
    rating: 4.6,
    reviews: 87,
    sold: 312,
    images: [
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80",
    ],
    colors: ["#ffffff", "#000000", "#6b7280", "#dc2626"],
    sizes: ["S", "M", "L", "XL"],
    brand: "Nokhba Basics",
    stock: 78,
    freeShipping: false,
    description: "تيشيرت بقطن مصري عالي الجودة، مريح ويدوم طويلاً.",
  },
  {
    id: 3,
    slug: "men-hoodie-winter",
    name: "هودي رجالي شتوي",
    categoryId: "men-clothing",
    price: 199,
    rating: 4.8,
    reviews: 156,
    sold: 220,
    images: [
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&q=80",
    ],
    colors: ["#1f2937", "#7c2d12", "#065f46"],
    sizes: ["M", "L", "XL", "XXL"],
    brand: "Nokhba Warm",
    stock: 34,
    freeShipping: false,
    badge: "جديد",
    description: "هودي دافئ بقماش سميك، مثالي للأجواء الباردة.",
  },
  {
    id: 4,
    slug: "men-jeans-slim",
    name: "بنطال جينز سليم فيت",
    categoryId: "men-clothing",
    price: 179,
    oldPrice: 249,
    rating: 4.5,
    reviews: 94,
    sold: 287,
    images: [
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&q=80",
    ],
    colors: ["#1e3a8a", "#000000"],
    sizes: ["30", "32", "34", "36", "38"],
    brand: "Denim Co.",
    stock: 56,
    freeShipping: false,
    description: "جينز بقصة سليم فيت أنيقة، مرن ومريح.",
  },

  // ═══════════ ملابس نسائية ═══════════
  {
    id: 5,
    slug: "women-dress-elegant-black",
    name: "فستان نسائي أنيق",
    categoryId: "women-clothing",
    price: 289,
    oldPrice: 399,
    rating: 4.9,
    reviews: 203,
    sold: 412,
    images: [
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=80",
    ],
    colors: ["#000000", "#7c2d12", "#be123c"],
    sizes: ["S", "M", "L", "XL"],
    brand: "Elegance",
    stock: 28,
    freeShipping: true,
    badge: "الأكثر مبيعاً",
    description: "فستان أنيق بقصة راقية، مثالي للمناسبات الخاصة.",
  },
  {
    id: 6,
    slug: "women-blouse-silk",
    name: "بلوزة نسائية حرير",
    categoryId: "women-clothing",
    price: 159,
    rating: 4.7,
    reviews: 78,
    sold: 156,
    images: [
      "https://images.unsplash.com/photo-1564257577015-57e88b8e2b74?w=600&q=80",
    ],
    colors: ["#fef3c7", "#fbcfe8", "#bfdbfe"],
    sizes: ["S", "M", "L"],
    brand: "Elegance",
    stock: 42,
    freeShipping: false,
    description: "بلوزة حرير ناعمة بلمسة أنثوية راقية.",
  },
  {
    id: 7,
    slug: "women-handbag-leather",
    name: "حقيبة يد جلد",
    categoryId: "bags",
    price: 329,
    oldPrice: 449,
    rating: 4.8,
    reviews: 145,
    sold: 189,
    images: [
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80",
    ],
    colors: ["#000000", "#7c2d12", "#a16207"],
    brand: "Luxury",
    stock: 15,
    freeShipping: true,
    badge: "عرض خاص",
    description: "حقيبة جلد طبيعي فاخرة بحجم مثالي للاستخدام اليومي.",
  },

  // ═══════════ أحذية ═══════════
  {
    id: 8,
    slug: "shoes-sneakers-white",
    name: "حذاء رياضي أبيض",
    categoryId: "shoes",
    price: 249,
    oldPrice: 349,
    rating: 4.7,
    reviews: 234,
    sold: 678,
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80",
    ],
    colors: ["#ffffff", "#000000", "#dc2626"],
    sizes: ["39", "40", "41", "42", "43", "44"],
    brand: "SportMax",
    stock: 89,
    freeShipping: false,
    badge: "الأكثر مبيعاً",
    description: "حذاء رياضي مريح بتصميم عصري يناسب كل الإطلالات.",
  },
  {
    id: 9,
    slug: "shoes-leather-brown",
    name: "حذاء جلد كلاسيكي",
    categoryId: "shoes",
    price: 399,
    rating: 4.9,
    reviews: 67,
    sold: 89,
    images: [
      "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=600&q=80",
    ],
    colors: ["#7c2d12", "#000000"],
    sizes: ["40", "41", "42", "43", "44"],
    brand: "Classic",
    stock: 23,
    freeShipping: true,
    description: "حذاء جلد طبيعي فاخر، مثالي للعمل والمناسبات الرسمية.",
  },

  // ═══════════ ساعات ═══════════
  {
    id: 10,
    slug: "watch-royal-gold",
    name: "ساعة رويال الذهبية",
    categoryId: "watches",
    price: 499,
    oldPrice: 699,
    rating: 4.8,
    reviews: 87,
    sold: 156,
    images: [
      "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&q=80",
    ],
    colors: ["#d4af37", "#c0c0c0", "#000000"],
    brand: "Royal",
    stock: 12,
    freeShipping: true,
    badge: "جديد",
    description: "ساعة أنيقة مقاومة للماء بسوار معدني مريح.",
  },
  {
    id: 11,
    slug: "watch-classic-leather",
    name: "ساعة كلاسيكية جلدية",
    categoryId: "watches",
    price: 389,
    oldPrice: 490,
    rating: 4.5,
    reviews: 43,
    sold: 78,
    images: [
      "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=600&q=80",
    ],
    colors: ["#7c2d12", "#000000"],
    brand: "Classic",
    stock: 18,
    freeShipping: true,
    description: "ساعة بسوار جلدي إيطالي أنيق، حركة دقيقة.",
  },

  // ═══════════ هواتف ═══════════
  {
    id: 12,
    slug: "phone-wireless-earbuds",
    name: "سماعات لاسلكية",
    categoryId: "phones",
    price: 299,
    oldPrice: 449,
    rating: 4.6,
    reviews: 189,
    sold: 512,
    images: [
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80",
    ],
    colors: ["#ffffff", "#000000"],
    brand: "TechPro",
    stock: 67,
    freeShipping: false,
    badge: "عرض خاص",
    description: "سماعات بلوتوث بجودة صوت عالية وعزل ممتاز للضوضاء.",
  },
  {
    id: 13,
    slug: "phone-power-bank",
    name: "شاحن متنقل سريع",
    categoryId: "phones",
    price: 149,
    rating: 4.7,
    reviews: 234,
    sold: 845,
    images: [
      "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&q=80",
    ],
    colors: ["#000000", "#ffffff", "#3b82f6"],
    brand: "TechPro",
    stock: 123,
    freeShipping: false,
    description: "بطارية متنقلة بقوة 20000mAh مع شحن سريع.",
  },

  // ═══════════ عطور ═══════════
  {
    id: 14,
    slug: "perfume-amber-nights",
    name: "عطر ليالي العنبر",
    categoryId: "perfumes",
    price: 289,
    oldPrice: 350,
    rating: 4.9,
    reviews: 124,
    sold: 234,
    images: [
      "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=600&q=80",
    ],
    brand: "Luxury Scents",
    stock: 34,
    freeShipping: false,
    badge: "الأكثر مبيعاً",
    description: "مزيج دافئ من العنبر والورد والعود بلمسة فاخرة.",
  },
  {
    id: 15,
    slug: "perfume-royal-oud",
    name: "عطر العود الملكي",
    categoryId: "perfumes",
    price: 549,
    rating: 5.0,
    reviews: 312,
    sold: 189,
    images: [
      "https://images.unsplash.com/photo-1615634260167-c8cdede054de?w=600&q=80",
    ],
    brand: "Luxury Scents",
    stock: 8,
    freeShipping: true,
    badge: "حصري",
    description: "عود كمبودي فاخر بلمسة من الورد الطائفي.",
  },

  // ═══════════ جمال وعناية ═══════════
  {
    id: 16,
    slug: "beauty-skincare-set",
    name: "طقم العناية الملكي",
    categoryId: "beauty",
    price: 179,
    oldPrice: 220,
    rating: 4.7,
    reviews: 203,
    sold: 456,
    images: [
      "https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?w=600&q=80",
    ],
    brand: "GlowCare",
    stock: 56,
    freeShipping: false,
    description: "روتين يومي متكامل لبشرة ناعمة ومشرقة.",
  },
  {
    id: 17,
    slug: "beauty-vitamin-c-serum",
    name: "سيروم فيتامين C",
    categoryId: "beauty",
    price: 119,
    oldPrice: 159,
    rating: 4.8,
    reviews: 245,
    sold: 523,
    images: [
      "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&q=80",
    ],
    brand: "GlowCare",
    stock: 78,
    freeShipping: false,
    badge: "توفير 25%",
    description: "يوحّد لون البشرة ويعيد لها نضارتها الطبيعية.",
  },

  // ═══════════ منزل ومطبخ ═══════════
  {
    id: 18,
    slug: "home-coffee-maker",
    name: "ماكينة قهوة إسبريسو",
    categoryId: "home",
    price: 899,
    oldPrice: 1199,
    rating: 4.6,
    reviews: 89,
    sold: 123,
    images: [
      "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&q=80",
    ],
    brand: "HomeChef",
    stock: 15,
    freeShipping: true,
    badge: "عرض خاص",
    description: "ماكينة قهوة احترافية لتحضير إسبريسو مثالي في المنزل.",
  },
  {
    id: 19,
    slug: "home-kitchen-set",
    name: "طقم أدوات مطبخ",
    categoryId: "home",
    price: 249,
    rating: 4.5,
    reviews: 134,
    sold: 289,
    images: [
      "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=600&q=80",
    ],
    brand: "HomeChef",
    stock: 45,
    freeShipping: false,
    description: "طقم أدوات مطبخ ستانلس ستيل عالي الجودة.",
  },
];

// ═══════════════════════════════════════════
// الدوال المساعدة
// ═══════════════════════════════════════════

// المنتجات حسب التصنيف
export function getProductsByCategory(categoryId: CategoryId): Product[] {
  return PRODUCTS.filter((p) => p.categoryId === categoryId);
}

// المنتجات المميزة
export function getFeaturedProducts(limit = 8): Product[] {
  return PRODUCTS.filter((p) => p.badge || p.oldPrice)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, limit);
}

// المنتجات الجديدة
export function getNewProducts(limit = 8): Product[] {
  return PRODUCTS.slice(-limit).reverse();
}

// البحث
export function searchProducts(query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return PRODUCTS;

  return PRODUCTS.filter((p) => {
    const category = getCategoryById(p.categoryId);
    const text = `${p.name} ${p.brand || ""} ${category?.name || ""}`.toLowerCase();
    return text.includes(q);
  });
}