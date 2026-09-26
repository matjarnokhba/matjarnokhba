"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  ShoppingCart,
  User,
  Menu,
  Heart,
  X,
} from "lucide-react";
import BrandLogo from "@/components/ui/Logo";
import UserMenu from "@/components/UserMenu";
import NotificationDropdown from "@/components/layout/NotificationDropdown";
import { useFavorites } from "@/lib/hooks/useFavorites";
import Link from "next/link";

type HeaderProps = {
  search: string;
  onSearchChange: (value: string) => void;
  cartCount: number;
  onCartClick: () => void;
};

const SHOW_AT_TOP = 40;
const HIDE_AT_SCROLL = 150;

export default function Header({
  search,
  onSearchChange,
  cartCount,
  onCartClick,
}: HeaderProps) {
  const { count: favoritesCount } = useFavorites();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(true);
  const ticking = useRef(false);

  // ═══════════════════════════════════════════
  // تتبع التمرير — عتبات لمنع الاهتزاز
  // ═══════════════════════════════════════════
  useEffect(() => {
    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const y = window.scrollY;

        if (y <= SHOW_AT_TOP) {
          setShowSearchBar(true);
        } else if (y >= HIDE_AT_SCROLL) {
          setShowSearchBar(false);
        }

        ticking.current = false;
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white shadow-sm">
      {/* ═══════ الصف الرئيسي ═══════ */}
      <div className="mx-auto flex h-11 max-w-7xl items-center justify-between gap-2 px-3 sm:h-14 sm:gap-4 sm:px-4">
        {/* ═══ اليمين: القائمة + اللوغو ═══ */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-gray-100 lg:hidden"
            aria-label="القائمة"
          >
            <Menu className="h-4 w-4 text-[#111827]" />
          </button>

          <BrandLogo size="sm" />
        </div>

        {/* ═══ الوسط: البحث (سطح المكتب فقط) ═══ */}
        <div className="hidden flex-1 lg:flex lg:max-w-2xl">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ابحث عن منتجات، فئات، علامات تجارية..."
              className="w-full rounded-full border-2 border-[#ff5c00] bg-white py-1.5 pr-10 pl-4 text-sm outline-none transition focus:border-[#e64a00]"
              aria-label="البحث عن منتج"
            />
          </div>
        </div>

        {/* ═══ اليسار: الأيقونات (مثبّتة دائماً) ═══ */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {/* زر بحث صغير (يظهر عند إخفاء الشريط) */}
          {!showSearchBar && (
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-gray-100 lg:hidden"
              aria-label="البحث"
            >
              <Search className="h-[18px] w-[18px] text-[#111827]" />
            </button>
          )}

          {/* المفضلة */}
          <Link
            href="/favorites"
            className="relative flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-gray-100 sm:h-9 sm:w-9"
            aria-label="المفضلة"
          >
            <Heart className="h-[18px] w-[18px] text-[#111827]" />
            {favoritesCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {favoritesCount}
              </span>
            )}
          </Link>

          {/* الحساب — UserMenu */}
          <UserMenu />

          {/* الإشعارات */}
          <NotificationDropdown />

          {/* السلة */}
          <button
            onClick={onCartClick}
            className="relative flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-gray-100 sm:h-9 sm:w-9"
            aria-label="السلة"
          >
            <ShoppingCart className="h-[18px] w-[18px] text-[#111827]" />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff5c00] px-1 text-[9px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ═══════ بحث الهاتف — منزلق ═══════ */}
      <div
        className={`overflow-hidden bg-white transition-[max-height,opacity] duration-300 ease-out lg:hidden ${
          showSearchBar
            ? "max-h-20 border-t border-gray-100 opacity-100"
            : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-3 py-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ابحث عن منتجات، فئات..."
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-1.5 pr-9 pl-3 text-xs outline-none focus:border-[#ff5c00]"
              aria-label="البحث عن منتج"
            />
          </div>
        </div>
      </div>

      {/* ═══════ نافذة بحث مؤقتة ═══════ */}
      {searchOpen && !showSearchBar && (
        <div className="border-t border-gray-100 bg-white px-3 py-1.5 lg:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ابحث عن منتجات، فئات..."
              autoFocus
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-1.5 pr-9 pl-9 text-xs outline-none focus:border-[#ff5c00]"
              aria-label="البحث عن منتج"
            />
            <button
              onClick={() => setSearchOpen(false)}
              className="absolute left-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
              aria-label="إغلاق البحث"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}