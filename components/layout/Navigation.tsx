"use client";

import type { Category, CategoryId } from "@/lib/data/categories";

type NavigationProps = {
  categories: Category[];
  activeCategoryId: CategoryId | "all";
  onCategoryChange: (id: CategoryId | "all") => void;
};

export default function Navigation({
  categories,
  activeCategoryId,
  onCategoryChange,
}: NavigationProps) {
  return (
    <nav className="border-b border-gray-100 bg-white">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="flex items-center gap-0.5 overflow-x-auto py-1 no-scrollbar sm:gap-1">
          {/* زر "الكل" */}
          <button
            onClick={() => onCategoryChange("all")}
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-bold transition sm:px-3 sm:py-2 sm:text-sm ${
              activeCategoryId === "all"
                ? "bg-[#fff4ed] text-[#ff5c00]"
                : "text-[#111827] hover:bg-gray-50"
            }`}
          >
            الكل
          </button>

          {/* باقي التصنيفات */}
          {categories.map((category) => {
            const isActive = activeCategoryId === category.id;

            return (
              <button
                key={category.id}
                onClick={() => onCategoryChange(category.id)}
                className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition sm:px-3 sm:py-2 sm:text-sm ${
                  isActive
                    ? "bg-[#fff4ed] font-bold text-[#ff5c00]"
                    : "text-[#4b5563] hover:bg-gray-50 hover:text-[#111827]"
                }`}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}