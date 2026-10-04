"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { CURRENCY } from "@/lib/data/products";
import type { CartItemV2 } from "@/lib/hooks/useCart";

type CartItemRowProps = {
  item: CartItemV2;
  onQuantityChange: (delta: number) => void;
  onRemove: () => void;
};

export default function CartItemRow({
  item,
  onQuantityChange,
  onRemove,
}: CartItemRowProps) {
  const totalPrice = item.price * item.quantity;
  const atMax =
    typeof item.stockSnapshot === "number" &&
    item.quantity >= item.stockSnapshot;

  return (
    <div className="flex gap-3 border-b border-gray-100 py-3 last:border-0">
      {/* الصورة */}
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-50">
        <img
          src={item.images[0]}
          alt={item.name}
          className="h-full w-full object-cover"
        />
      </div>

      {/* التفاصيل */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-xs font-bold leading-tight text-[#111827]">
            {item.name}
          </h3>
          <button
            onClick={onRemove}
            className="shrink-0 rounded-full p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
            aria-label="حذف"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* الخصائص (label) */}
        {item.variantLabel && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[#6b7280]">
            {item.selectedColor && (
              <span
                className="inline-block h-3 w-3 rounded-full border border-gray-200"
                style={{ backgroundColor: getColorHex(item.selectedColor) }}
              />
            )}
            <span>{item.variantLabel}</span>
          </div>
        )}

        {/* السعر + الكمية */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center overflow-hidden rounded-full border border-gray-200">
            <button
              onClick={() => onQuantityChange(-1)}
              className="flex h-6 w-6 items-center justify-center text-gray-500 transition hover:bg-gray-50"
              aria-label="تقليل"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="min-w-[1.75rem] border-x border-gray-200 py-0.5 text-center text-xs font-bold">
              {item.quantity}
            </span>
            <button
              onClick={() => !atMax && onQuantityChange(1)}
              disabled={atMax}
              className="flex h-6 w-6 items-center justify-center text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="زيادة"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <div className="text-left">
            <strong className="text-sm font-black text-[#ff5c00]">
              {totalPrice.toFixed(2)}
            </strong>
            <span className="mr-1 text-[10px] text-[#6b7280]">
              {CURRENCY}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ ربط سريع لألوان القيم الشائعة (للعرض فقط) ═══
function getColorHex(value: string): string {
  const map: Record<string, string> = {
    أسود: "#000000",
    أبيض: "#FFFFFF",
    رمادي: "#808080",
    فضي: "#C0C0C0",
    أحمر: "#EF4444",
    خمري: "#722F37",
    عنابي: "#7F1D1D",
    وردي: "#EC4899",
    زهري: "#FFB6C1",
    برتقالي: "#F97316",
    أصفر: "#FACC15",
    ذهبي: "#EAB308",
    بني: "#78350F",
    بيج: "#F5F5DC",
    كريمي: "#FFFDD0",
    كاشمير: "#D4B5A0",
    نحاسي: "#B87333",
    أخضر: "#22C55E",
    "أخضر داكن": "#15803D",
    زيتي: "#808000",
    أزرق: "#3B82F6",
    كحلي: "#1E3A8A",
    سماوي: "#87CEEB",
    تركوازي: "#06B6D4",
    نيلي: "#4F46E5",
    بنفسجي: "#8B5CF6",
  };
  return map[value] || "#ccc";
}