"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Star,
  TrendingUp,
  Wallet,
  Building2,
  FileText,
  User,
  LogOut,
  Menu,
  X,
  Store,
  Bell,
} from "lucide-react";

type SellerSidebarProps = {
  storeName: string;
  storeSlug: string;
  isVerified: boolean;
};

const NAV_ITEMS = [
  { href: "/seller", label: "لوحة التحكم", icon: LayoutDashboard, exact: true },
  { href: "/seller/notifications", label: "الإشعارات", icon: Bell, exact: false },
  { href: "/seller/products", label: "منتجاتي", icon: Package, exact: false },
  { href: "/seller/orders", label: "طلباتي", icon: ShoppingCart, exact: false },
  { href: "/seller/reviews", label: "التقييمات", icon: Star, exact: false },
  { href: "/seller/performance", label: "أدائي", icon: TrendingUp, exact: false },
  { href: "/seller/payouts", label: "المدفوعات", icon: Wallet, exact: false },
  { href: "/seller/bank-accounts", label: "حساباتي البنكية", icon: Building2, exact: false },
  { href: "/seller/documents", label: "وثائقي", icon: FileText, exact: false },
  { href: "/seller/profile", label: "ملف المتجر", icon: User, exact: false },
];

export default function SellerSidebar({
  storeName,
  storeSlug,
  isVerified,
}: SellerSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  }

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed right-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-md lg:hidden"
        aria-label="القائمة"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed bottom-0 right-0 top-0 z-50 flex w-64 flex-col transform bg-white shadow-xl transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-gray-100 bg-gradient-to-l from-[#fff4ed] to-white px-4">
          <Link href="/seller" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-sm font-black text-white">
              ب
            </span>
            <div className="leading-none">
              <strong className="block text-sm font-black">لوحة البائع</strong>
              <small className="text-[10px] text-gray-500">متجر نخبة</small>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 lg:hidden"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Store Info */}
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="text-[10px] text-gray-500">متجرك</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-gray-900">
              {storeName}
            </span>
            {isVerified && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[8px] font-black text-white">
                ✓
              </span>
            )}
          </div>
          <Link
            href={`/store/${storeSlug}`}
            target="_blank"
            className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#ff5c00] hover:underline"
          >
            <Store className="h-3 w-3" />
            عرض المتجر
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 pb-24">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                  active
                    ? "bg-[#fff4ed] text-[#ff5c00]"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>
    </>
  );
}