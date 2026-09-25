"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Grid3x3, Package, User, ShoppingCart } from "lucide-react";

type BottomNavProps = {
  cartCount: number;
  onCartClick: () => void;
};

// ═══════════════════════════════════════════
// عتبات ضبط السلوك
// ═══════════════════════════════════════════
const TOP_THRESHOLD = 20;      // دائماً ظاهر عند أعلى الصفحة
const HIDE_AFTER = 100;         // اخفِ بعد 100px تمرير لأسفل متراكمة
const SHOW_AFTER = 50;          // أظهر بعد 50px تمرير لأعلى متراكمة

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

        // ─── في أعلى الصفحة → ظاهر دائماً ───
        if (currentY < TOP_THRESHOLD) {
          setIsVisible(true);
          accumulatedDown.current = 0;
          accumulatedUp.current = 0;
        }
        // ─── نمرر لأسفل ───
        else if (diff > 0) {
          accumulatedDown.current += diff;
          accumulatedUp.current = 0;

          if (accumulatedDown.current >= HIDE_AFTER) {
            setIsVisible(false);
            accumulatedDown.current = 0;
          }
        }
        // ─── نمرر لأعلى ───
        else if (diff < 0) {
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

  const items = [
    { label: "الرئيسية", icon: Home, href: "/", type: "link" as const },
    { label: "الفئات", icon: Grid3x3, href: "/#categories", type: "link" as const },
    { label: "طلباتي", icon: Package, href: "/orders", type: "link" as const },
    { label: "دخول", icon: User, href: "/login", type: "link" as const },
    { label: "السلة", icon: ShoppingCart, type: "cart" as const },
  ];

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.06)] transition-transform duration-300 ease-out sm:hidden ${
        isVisible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.type === "link" && pathname === item.href;

          if (item.type === "cart") {
            return (
              <button
                key={item.label}
                onClick={onCartClick}
                className="relative flex flex-col items-center gap-0 py-1.5 text-[#6b7280] transition hover:text-[#ff5c00]"
                aria-label={item.label}
              >
                <div className="relative">
                  <Icon className="h-[18px] w-[18px]" />
                  {cartCount > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#ff5c00] px-1 text-[8px] font-black text-white">
                      {cartCount}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-bold">{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center gap-0 py-1.5 transition ${
                isActive
                  ? "text-[#ff5c00]"
                  : "text-[#6b7280] hover:text-[#ff5c00]"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="text-[9px] font-bold">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}