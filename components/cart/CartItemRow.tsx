"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { CURRENCY } from "@/lib/data/products";
import type { CartItem } from "@/lib/data/products";

type CartItemRowProps = {
  item: CartItem;
  onQuantityChange: (delta: number) => void;
  onRemove: () => void;
};

export default function CartItemRow({
  item,
  onQuantityChange,
  onRemove,
}: CartItemRowProps) {
  const totalPrice = item.price * item.quantity;

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
        {/* الاسم + الحذف */}
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

        {/* اللون والمقاس */}
        {(item.selectedColor || item.selectedSize) && (
          <div className="mt-1 flex gap-2 text-[10px] text-[#6b7280]">
            {item.selectedColor && (
              <span className="flex items-center gap-1">
                اللون:
                <span
                  className="inline-block h-3 w-3 rounded-full border border-gray-200"
                  style={{ backgroundColor: item.selectedColor }}
                />
              </span>
            )}
            {item.selectedSize && <span>المقاس: {item.selectedSize}</span>}
          </div>
        )}

        {/* السعر + الكمية */}
        <div className="mt-2 flex items-center justify-between gap-2">
          {/* الكمية */}
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
              onClick={() => onQuantityChange(1)}
              className="flex h-6 w-6 items-center justify-center text-gray-500 transition hover:bg-gray-50"
              aria-label="زيادة"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* السعر الإجمالي */}
          <div className="text-left">
            <strong className="text-sm font-black text-[#ff5c00]">
              {totalPrice}
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