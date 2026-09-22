"use client";

import type { Category, CategoryId } from "@/lib/data/categories";

type CategoryGridProps = {
  categories: Category[];
  activeCategoryId: CategoryId | "all";
  onCategoryClick: (id: CategoryId | "all") => void;
};

export default function CategoryGrid({
  categories,
  activeCategoryId,
  onCategoryClick,
}: CategoryGridProps) {
  return (
    <section className="bg-white py-6">
      <div className="mx-auto max-w-7xl px-4">
        {/* العنوان */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#111827] sm:text-xl">
            🛍️ تسوق حسب الفئة
          </h2>
          <button className="text-xs font-bold text-[#ff5c00] hover:underline">
            عرض الكل ←
          </button>
        </div>

        {/* الشبكة الأفقية القابلة للتمرير */}
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar sm:grid sm:grid-cols-8 sm:gap-5 lg:grid-cols-16">
          {categories.map((category) => {
            const isActive = activeCategoryId === category.id;

            return (
              <button
                key={category.id}
                onClick={() => onCategoryClick(category.id)}
                className="group flex shrink-0 flex-col items-center gap-2 transition sm:shrink"
              >
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl shadow-md transition-all group-hover:scale-110 group-hover:shadow-lg sm:h-18 sm:w-18 sm:text-3xl ${
                    isActive
                      ? "ring-2 ring-[#ff5c00] ring-offset-2"
                      : ""
                  }`}
                  style={{
                    backgroundColor: `${category.color}20`,
                  }}
                >
                  <span>{category.icon}</span>
                </div>
                <span className="text-center text-[10px] font-bold text-[#4b5563] sm:text-xs">
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}