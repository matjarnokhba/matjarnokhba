// ═══════════════════════════════════════════
// التصنيفات الرئيسية للمتجر
// ═══════════════════════════════════════════

export type CategoryId =
  | "men-clothing"
  | "women-clothing"
  | "kids-clothing"
  | "shoes"
  | "bags"
  | "phones"
  | "electronics"
  | "home"
  | "tools"
  | "beauty"
  | "perfumes"
  | "watches"
  | "sports"
  | "toys"
  | "books"
  | "jewelry";

export type Category = {
  id: CategoryId;
  name: string;
  slug: string;
  icon: string;
  color: string;
  order: number;
};

// ═══════════════════════════════════════════
// قائمة التصنيفات
// ═══════════════════════════════════════════
export const CATEGORIES: Category[] = [
  {
    id: "men-clothing",
    name: "ملابس رجالية",
    slug: "men-clothing",
    icon: "👔",
    color: "#3b82f6",
    order: 1,
  },
  {
    id: "women-clothing",
    name: "ملابس نسائية",
    slug: "women-clothing",
    icon: "👗",
    color: "#ec4899",
    order: 2,
  },
  {
    id: "kids-clothing",
    name: "ملابس أطفال",
    slug: "kids-clothing",
    icon: "👶",
    color: "#f59e0b",
    order: 3,
  },
  {
    id: "shoes",
    name: "أحذية",
    slug: "shoes",
    icon: "👟",
    color: "#10b981",
    order: 4,
  },
  {
    id: "bags",
    name: "حقائب ومحافظ",
    slug: "bags",
    icon: "👜",
    color: "#8b5cf6",
    order: 5,
  },
  {
    id: "watches",
    name: "ساعات",
    slug: "watches",
    icon: "⌚",
    color: "#0ea5e9",
    order: 6,
  },
  {
    id: "jewelry",
    name: "مجوهرات",
    slug: "jewelry",
    icon: "💎",
    color: "#f43f5e",
    order: 7,
  },
  {
    id: "perfumes",
    name: "عطور",
    slug: "perfumes",
    icon: "🌸",
    color: "#d946ef",
    order: 8,
  },
  {
    id: "beauty",
    name: "جمال وعناية",
    slug: "beauty",
    icon: "💄",
    color: "#fb7185",
    order: 9,
  },
  {
    id: "phones",
    name: "هواتف",
    slug: "phones",
    icon: "📱",
    color: "#22c55e",
    order: 10,
  },
  {
    id: "electronics",
    name: "إلكترونيات",
    slug: "electronics",
    icon: "💻",
    color: "#6366f1",
    order: 11,
  },
  {
    id: "home",
    name: "منزل ومطبخ",
    slug: "home-kitchen",
    icon: "🏠",
    color: "#eab308",
    order: 12,
  },
  {
    id: "tools",
    name: "أدوات",
    slug: "tools",
    icon: "🔧",
    color: "#64748b",
    order: 13,
  },
  {
    id: "sports",
    name: "رياضة",
    slug: "sports",
    icon: "⚽",
    color: "#14b8a6",
    order: 14,
  },
  {
    id: "toys",
    name: "ألعاب",
    slug: "toys",
    icon: "🎮",
    color: "#a855f7",
    order: 15,
  },
  {
    id: "books",
    name: "كتب",
    slug: "books",
    icon: "📚",
    color: "#7c3aed",
    order: 16,
  },
];

// ═══════════════════════════════════════════
// المساعدات
// ═══════════════════════════════════════════

// التصنيفات المميزة (تظهر أولاً في الصفحة الرئيسية)
export const FEATURED_CATEGORY_IDS: CategoryId[] = [
  "men-clothing",
  "women-clothing",
  "shoes",
  "bags",
  "watches",
  "phones",
  "perfumes",
  "beauty",
];

// دالة للبحث عن تصنيف بـ id
export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

// دالة للبحث عن تصنيف بـ slug
export function getCategoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}