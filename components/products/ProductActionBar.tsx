"use client";

import { ShoppingCart, Zap } from "lucide-react";

type ProductActionBarProps = {
  onAddToCart: () => void;
  onBuyNow: () => void;
  disabled?: boolean;
};

export default function ProductActionBar({
  onAddToCart,
  onBuyNow,
  disabled = false,
}: ProductActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.08)] sm:hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        {/* زر "أضف للسلة" */}
        <button
          onClick={onAddToCart}
          disabled={disabled}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 border-[#ff5c00] bg-white py-2.5 text-xs font-bold text-[#ff5c00] transition active:scale-[0.98] disabled:opacity-50"
        >
          <ShoppingCart className="h-4 w-4" />
          أضف للسلة
        </button>

        {/* زر "اشتري الآن" */}
        <button
          onClick={onBuyNow}
          disabled={disabled}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#ff5c00] py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#e64a00] active:scale-[0.98] disabled:opacity-50"
        >
          <Zap className="h-4 w-4" />
          اشتري الآن
        </button>
      </div>

      {/* Safe Area للهواتف */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}