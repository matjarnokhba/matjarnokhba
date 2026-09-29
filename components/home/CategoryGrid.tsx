"use client";

import Link from "next/link";
import {
  Shirt,
  Footprints,
  Smartphone,
  Home,
  Sparkles,
  Watch,
  ShoppingBag,
  Dumbbell,
  Gamepad2,
  BookOpen,
  LayoutGrid,
  Baby,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useRef } from "react";
import type { Category, CategoryId } from "@/lib/data/categories";

// ═══════ بيانات كل تصنيف ═══════
type CategoryMeta = {
  image: string;
  icon: any;
  bgColor: string;
};

const CATEGORY_META: Record<string, CategoryMeta> = {
  "men-clothing": {
    image: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=150&q=80",
    icon: Shirt,
    bgColor: "bg-blue-600",
  },
  "women-clothing": {
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=150&q=80",
    icon: Shirt,
    bgColor: "bg-pink-600",
  },
  "kids-clothing": {
    image: "https://images.unsplash.com/photo-1519457431-44ccd64a579b?w=150&q=80",
    icon: Baby,
    bgColor: "bg-amber-500",
  },
  shoes: {
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&q=80",
    icon: Footprints,
    bgColor: "bg-orange-500",
  },
  bags: {
    image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=150&q=80",
    icon: ShoppingBag,
    bgColor: "bg-amber-600",
  },
  watches: {
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=150&q=80",
    icon: Watch,
    bgColor: "bg-purple-600",
  },
  jewelry: {
    image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=150&q=80",
    icon: Sparkles,
    bgColor: "bg-rose-500",
  },
  perfumes: {
    image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=150&q=80",
    icon: Sparkles,
    bgColor: "bg-fuchsia-500",
  },
  beauty: {
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=150&q=80",
    icon: Sparkles,
    bgColor: "bg-pink-500",
  },
  phones: {
    image: "https://images.unsplash.com/photo-1592286927505-1def25115558?w=150&q=80",
    icon: Smartphone,
    bgColor: "bg-blue-600",
  },
  electronics: {
    image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=150&q=80",
    icon: Smartphone,
    bgColor: "bg-indigo-600",
  },
  "home-kitchen": {
    image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=150&q=80",
    icon: Home,
    bgColor: "bg-green-600",
  },
  tools: {
    image: "https://images.unsplash.com/photo-1581147036324-c1c88bb6aec3?w=150&q=80",
    icon: Home,
    bgColor: "bg-slate-600",
  },
  sports: {
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=150&q=80",
    icon: Dumbbell,
    bgColor: "bg-red-500",
  },
  toys: {
    image: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=150&q=80",
    icon: Gamepad2,
    bgColor: "bg-amber-500",
  },
  books: {
    image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=150&q=80",
    icon: BookOpen,
    bgColor: "bg-blue-500",
  },
};

const DEFAULT_META: CategoryMeta = {
  image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=150&q=80",
  icon: LayoutGrid,
  bgColor: "bg-gray-600",
};

type CategoryGridProps = {
  categories: Category[];
  activeCategoryId?: CategoryId | "all";
  onCategoryClick?: (id: CategoryId | "all") => void;
};

export default function CategoryGrid({ categories }: CategoryGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const amount = 240;
    scrollRef.current.scrollBy({
      left: direction === "right" ? amount : -amount,
      behavior: "smooth",
    });
  }

  return (
    <section className="overflow-x-hidden bg-white py-3">
      <div className="mx-auto max-w-7xl">
        {/* ═══ العنوان ═══ */}
        <div className="mb-2 flex items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-1 rounded-full bg-[#ff5c00]" />
            <h2 className="text-sm font-black text-[#111827] sm:text-base">
              تسوق حسب الفئة
            </h2>
          </div>

          <div className="flex items-center gap-1">
            {/* أزرار التمرير (سطح المكتب) */}
            <button
              onClick={() => scroll("left")}
              className="hidden h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-[#ff5c00] hover:text-white sm:flex"
              aria-label="تمرير يمين"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="hidden h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-[#ff5c00] hover:text-white sm:flex"
              aria-label="تمرير يسار"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <Link
              href="/#products"
              className="text-[10px] font-bold text-[#ff5c00] hover:underline sm:hidden"
            >
              عرض الكل ←
            </Link>
          </div>
        </div>

        {/* ═══ السطر الواحد ═══ */}
        <div
          ref={scrollRef}
          className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-1 sm:gap-3 sm:px-4"
        >
          {categories.map((category) => {
            const meta = CATEGORY_META[category.slug] || DEFAULT_META;

            return (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="group flex shrink-0 flex-col items-center gap-1"
                style={{ width: "64px" }}
              >
                {/* الدائرة بالصورة */}
                <div className="relative h-14 w-14 overflow-hidden rounded-full bg-gray-100 shadow-sm ring-2 ring-gray-100 transition-all duration-300 group-hover:ring-[#ff5c00] group-hover:shadow-md sm:h-16 sm:w-16">
                  <img
                    src={meta.image}
                    alt={category.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>

                {/* الاسم */}
                <span className="line-clamp-2 w-full text-center text-[9px] font-bold leading-tight text-[#4b5563] transition group-hover:text-[#ff5c00] sm:text-[10px]">
                  {category.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}