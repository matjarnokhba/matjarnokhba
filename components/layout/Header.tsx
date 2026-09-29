"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  ShoppingCart,
  User,
  Menu,
  Heart,
  X,
  Home,
  Package,
  Bell,
  ChevronLeft,
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

type Category = {
  id: number;
  name: string;
  slug: string;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const ticking = useRef(false);

  // ═══════ تتبع التمرير ═══════
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

  // ═══════ جلب التصنيفات (مرة واحدة) ═══════
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch("/api/categories");
        const data = await res.json();
        if (data.success) setCategories(data.categories);
      } catch {
        // silent
      }
    }
    loadCategories();
  }, []);

  // ═══════ منع التمرير عند فتح Drawer ═══════
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white shadow-sm">
        {/* ═══════ الصف الرئيسي ═══════ */}
        <div className="mx-auto flex h-11 max-w-7xl items-center justify-between gap-2 px-3 sm:h-14 sm:gap-4 sm:px-4">
          {/* اليمين: القائمة + اللوغو */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-gray-100 lg:hidden"
              aria-label="القائمة"
            >
              <Menu className="h-4 w-4 text-[#111827]" />
            </button>

            <BrandLogo size="sm" />
          </div>

          {/* الوسط: البحث (سطح المكتب) */}
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

          {/* اليسار: الأيقونات */}
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            {!showSearchBar && (
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-gray-100 lg:hidden"
                aria-label="البحث"
              >
                <Search className="h-[18px] w-[18px] text-[#111827]" />
              </button>
            )}

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

            <UserMenu />
            <NotificationDropdown />

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

      {/* ═══════════════════════════════════════════
          Drawer القائمة الجانبية (الهاتف فقط)
      ═══════════════════════════════════════════ */}

      {/* Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* القائمة الجانبية */}
      <aside
        className={`fixed bottom-0 right-0 top-0 z-[61] flex w-80 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
        dir="rtl"
      >
        {/* ═══ رأس القائمة ═══ */}
        <div className="flex h-14 items-center justify-between border-b border-gray-100 bg-gradient-to-l from-[#fff4ed] to-white px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-md">
              <span className="text-base font-black text-[#0a1a35]">ن</span>
            </div>
            <div className="leading-none">
              <div className="text-sm font-black text-gray-900">متجر نخبة</div>
              <div className="mt-0.5 text-[10px] text-gray-500">
                القائمة الرئيسية
              </div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ═══ المحتوى — قابل للتمرير ═══ */}
        <div className="flex-1 overflow-y-auto">
          {/* روابط سريعة */}
          <div className="border-b border-gray-100 p-3">
            <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              روابط سريعة
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 transition hover:bg-[#fff4ed]"
              >
                <Home className="h-4 w-4 text-[#ff5c00]" />
                <span className="text-xs font-bold text-gray-700">
                  الرئيسية
                </span>
              </Link>

              <Link
                href="/orders"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 transition hover:bg-[#fff4ed]"
              >
                <Package className="h-4 w-4 text-[#ff5c00]" />
                <span className="text-xs font-bold text-gray-700">
                  طلباتي
                </span>
              </Link>

              <Link
                href="/favorites"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 transition hover:bg-[#fff4ed]"
              >
                <Heart className="h-4 w-4 text-[#ff5c00]" />
                <span className="text-xs font-bold text-gray-700">
                  المفضلة
                </span>
                {favoritesCount > 0 && (
                  <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {favoritesCount}
                  </span>
                )}
              </Link>

              <Link
                href="/notifications"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5 transition hover:bg-[#fff4ed]"
              >
                <Bell className="h-4 w-4 text-[#ff5c00]" />
                <span className="text-xs font-bold text-gray-700">
                  الإشعارات
                </span>
              </Link>
            </div>
          </div>

          {/* التصنيفات */}
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                التصنيفات
              </span>
              <Link
                href="/#products"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[10px] font-bold text-[#ff5c00] hover:underline"
              >
                عرض الكل ←
              </Link>
            </div>

            <div className="space-y-0.5">
              {categories.length === 0 ? (
                <div className="flex justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-[#ff5c00]" />
                </div>
              ) : (
                categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/category/${cat.slug}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="group flex items-center justify-between rounded-lg px-3 py-2.5 transition hover:bg-[#fff4ed]"
                  >
                    <span className="text-sm font-bold text-gray-700 group-hover:text-[#ff5c00]">
                      {cat.name}
                    </span>
                    <ChevronLeft className="h-4 w-4 text-gray-300 transition group-hover:-translate-x-1 group-hover:text-[#ff5c00]" />
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ═══ Footer — زر الحساب ═══ */}
        <div className="border-t border-gray-100 bg-gray-50 p-3">
          <Link
            href="/profile"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 shadow-sm transition hover:bg-[#fff4ed]"
          >
            <User className="h-4 w-4 text-[#ff5c00]" />
            <span className="text-sm font-bold text-gray-700">
              حسابي
            </span>
          </Link>
        </div>

        <div className="h-[env(safe-area-inset-bottom)]" />
      </aside>
    </>
  );
}