"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, User, ShoppingCart } from "lucide-react";

type BottomNavProps = {
  cartCount: number;
  onCartClick: () => void;
};

// ═══════ عتبات Scroll ═══════
const TOP_THRESHOLD = 20;
const HIDE_AFTER = 100;
const SHOW_AFTER = 50;

export default function BottomNav({ cartCount, onCartClick }: BottomNavProps) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const accumulatedDown = useRef(0);
  const accumulatedUp = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const diff = currentY - lastScrollY.current;

        if (currentY < TOP_THRESHOLD) {
          setIsVisible(true);
          accumulatedDown.current = 0;
          accumulatedUp.current = 0;
        } else if (diff > 0) {
          accumulatedDown.current += diff;
          accumulatedUp.current = 0;

          if (accumulatedDown.current >= HIDE_AFTER) {
            setIsVisible(false);
            accumulatedDown.current = 0;
          }
        } else if (diff < 0) {
          accumulatedUp.current += Math.abs(diff);
          accumulatedDown.current = 0;

          if (accumulatedUp.current >= SHOW_AFTER) {
            setIsVisible(true);
            accumulatedUp.current = 0;
          }
        }

        lastScrollY.current = currentY;
        ticking.current = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ═══ 4 عناصر فقط (بدون "الفئات") ═══
  const items = [
    { label: "الرئيسية", icon: Home, href: "/", type: "link" as const },
    { label: "طلباتي", icon: Package, href: "/orders", type: "link" as const },
    { label: "حسابي", icon: User, href: "/profile", type: "link" as const },
    { label: "السلة", icon: ShoppingCart, type: "cart" as const },
  ];

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.06)] transition-transform duration-300 ease-out sm:hidden ${
        isVisible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.type === "link" && pathname === item.href;

          if (item.type === "cart") {
            return (
              <button
                key={item.label}
                onClick={onCartClick}
                className="relative flex flex-col items-center gap-0 py-2 text-[#6b7280] transition hover:text-[#ff5c00]"
                aria-label={item.label}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff5c00] px-1 text-[9px] font-black text-white">
                      {cartCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold">{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center gap-0 py-2 transition ${
                isActive
                  ? "text-[#ff5c00]"
                  : "text-[#6b7280] hover:text-[#ff5c00]"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-bold">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}