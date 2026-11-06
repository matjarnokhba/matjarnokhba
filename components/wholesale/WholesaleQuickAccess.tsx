"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";

const STORAGE_KEY = "wholesale_cart_v1";

export function WholesaleQuickAccess() {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const update = () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          setCartCount(0);
          return;
        }
        const items = JSON.parse(raw);
        if (!Array.isArray(items)) {
          setCartCount(0);
          return;
        }
        const count = items.reduce(
          (s: number, i: any) => s + (typeof i?.quantity === "number" ? i.quantity : 0),
          0
        );
        setCartCount(count);
      } catch {
        setCartCount(0);
      }
    };
    update();
    window.addEventListener("storage", update);
    window.addEventListener("focus", update);
    const interval = setInterval(update, 3000);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("focus", update);
      clearInterval(interval);
    };
  }, []);

  return (
    <Link
      href="/wholesale"
      className="fixed bottom-6 left-6 z-30 flex items-center gap-2 rounded-full bg-[#ff5c00] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[#e64a00]"
      aria-label="سوق الجملة"
      title="سوق الجملة"
    >
      <ShoppingBag className="h-5 w-5" />
      <span className="hidden sm:inline">سوق الجملة</span>
      {cartCount > 0 && (
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#ff5c00]">
          {cartCount}
        </span>
      )}
    </Link>
  );
}