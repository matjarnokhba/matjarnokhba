"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, ShoppingBag, ArrowLeft, Truck } from "lucide-react";
import CartItemRow from "./CartItemRow";
import {
  CURRENCY,
  SHIPPING_FEE,
  FREE_SHIPPING_THRESHOLD,
  type CartItem,
} from "@/lib/data/products";

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  onQuantityChange: (
    id: number,
    color: string | undefined,
    size: string | undefined,
    delta: number
  ) => void;
  onRemove: (id: number, color: string | undefined, size: string | undefined) => void;
};

export default function CartDrawer({
  isOpen,
  onClose,
  items,
  subtotal,
  onQuantityChange,
  onRemove,
}: CartDrawerProps) {
  const router = useRouter();

  // ═══════ قفل التمرير في الخلفية ═══════
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // ═══════ ESC للإغلاق ═══════
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEsc);
    }
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // ═══════ حساب الشحن ═══════
  const shipping = subtotal > 0 && subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = subtotal + shipping;

  // ═══════ حساب التوفير المتبقي للشحن المجاني ═══════
  const remainingForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const freeShippingPercent =
    subtotal >= FREE_SHIPPING_THRESHOLD
      ? 100
      : Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  // ═══════ إتمام الطلب ═══════
  function handleCheckout() {
    onClose();
    router.push("/checkout");
  }

  return (
    <>
      {/* ═══════ Overlay ═══════ */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      {/* ═══════ Drawer ═══════ */}
      <aside
        className={`fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        dir="rtl"
      >
        {/* ═══════ Header ═══════ */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff4ed]">
              <ShoppingBag className="h-4 w-4 text-[#ff5c00]" />
            </div>
            <h2 className="text-base font-black">السلة</h2>
            {items.length > 0 && (
              <span className="rounded-full bg-[#ff5c00] px-2 py-0.5 text-[10px] font-black text-white">
                {items.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-gray-100"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ═══════ Content ═══════ */}
        {items.length === 0 ? (
          /* سلة فارغة */
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="text-6xl">🛒</div>
            <h3 className="mt-4 text-lg font-black">سلتك فارغة</h3>
            <p className="mt-2 text-sm text-[#6b7280]">
              أضف منتجات لتبدأ التسوق
            </p>
            <button
              onClick={onClose}
              className="mt-6 flex items-center gap-2 rounded-full bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
            >
              <ArrowLeft className="h-4 w-4" />
              متابعة التسوق
            </button>
          </div>
        ) : (
          <>
            {/* شريط تقدم الشحن المجاني */}
            <div className="border-b border-gray-100 bg-[#fff9f5] px-4 py-2.5">
              <div className="flex items-center gap-2 text-[11px]">
                <Truck className="h-3.5 w-3.5 shrink-0 text-[#ff5c00]" />
                {subtotal >= FREE_SHIPPING_THRESHOLD ? (
                  <span className="font-bold text-green-600">
                    🎉 مبروك! حصلت على شحن مجاني
                  </span>
                ) : (
                  <span className="text-[#4b5563]">
                    أضف{" "}
                    <strong className="text-[#ff5c00]">
                      {remainingForFree} {CURRENCY}
                    </strong>{" "}
                    للحصول على شحن مجاني
                  </span>
                )}
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-gradient-to-l from-[#ff5c00] to-[#ff8a3d] transition-all duration-500"
                  style={{ width: `${freeShippingPercent}%` }}
                />
              </div>
            </div>

            {/* قائمة المنتجات */}
            <div className="flex-1 overflow-y-auto px-4">
              {items.map((item, idx) => (
                <CartItemRow
                  key={`${item.id}-${item.selectedColor || "none"}-${item.selectedSize || "none"}-${idx}`}
                  item={item}
                  onQuantityChange={(delta) =>
                    onQuantityChange(
                      item.id,
                      item.selectedColor,
                      item.selectedSize,
                      delta
                    )
                  }
                  onRemove={() =>
                    onRemove(item.id, item.selectedColor, item.selectedSize)
                  }
                />
              ))}
            </div>

            {/* ═══════ الملخص + الإجراءات ═══════ */}
            <div className="border-t border-gray-100 bg-white p-4">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-[#6b7280]">
                  <span>المجموع الفرعي</span>
                  <span className="font-bold text-[#111827]">
                    {subtotal} {CURRENCY}
                  </span>
                </div>
                <div className="flex justify-between text-[#6b7280]">
                  <span>الشحن</span>
                  <span
                    className={
                      shipping === 0
                        ? "font-bold text-green-600"
                        : "font-bold text-[#111827]"
                    }
                  >
                    {shipping === 0 ? "مجاني" : `${shipping} ${CURRENCY}`}
                  </span>
                </div>
                <div className="flex justify-between border-t border-dashed border-gray-200 pt-2 text-sm">
                  <span className="font-bold">الإجمالي</span>
                  <span className="text-lg font-black text-[#ff5c00]">
                    {total} {CURRENCY}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#e64a00] active:scale-[0.98]"
              >
                إتمام الطلب
                <ArrowLeft className="h-4 w-4" />
              </button>

              <button
                onClick={onClose}
                className="mt-2 w-full text-center text-xs font-bold text-[#6b7280] transition hover:text-[#ff5c00]"
              >
                متابعة التسوق
              </button>
            </div>
          </>
        )}

        {/* Safe Area للهواتف */}
        <div className="h-[env(safe-area-inset-bottom)] bg-white" />
      </aside>
    </>
  );
}