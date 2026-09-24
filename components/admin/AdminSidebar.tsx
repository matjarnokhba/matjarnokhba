"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Store,
  LogOut,
  Menu,
  X,
} from "lucide-react";

type AdminSidebarProps = {
  userName: string;
  userRole: string;
};

const NAV_ITEMS = [
  { href: "/admin", label: "لوحة التحكم", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "المنتجات", icon: Package, exact: false },
  { href: "/admin/orders", label: "الطلبات", icon: ShoppingCart, exact: false },
  { href: "/admin/users", label: "المستخدمون", icon: Users, exact: false },
];

export default function AdminSidebar({ userName, userRole }: AdminSidebarProps) {
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
      {/* ═══════ Mobile Toggle Button ═══════ */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed right-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-md lg:hidden"
        aria-label="القائمة"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* ═══════ Overlay ═══════ */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ═══════ Sidebar ═══════ */}
      <aside
        className={`fixed bottom-0 right-0 top-0 z-50 w-64 transform bg-white shadow-xl transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ═══ Header ═══ */}
        <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-orange-500 text-sm font-black text-white">
              ن
            </span>
            <div className="leading-none">
              <strong className="block text-sm font-black">متجر نخبة</strong>
              <small className="text-[10px] text-gray-500">لوحة الإدارة</small>
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

        {/* ═══ User Info ═══ */}
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="text-xs text-gray-500">مرحباً</div>
          <div className="mt-0.5 text-sm font-bold text-gray-900">
            {userName}
          </div>
          <span className="mt-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
            {userRole === "SUPER_ADMIN" ? "مدير عام" : "مدير"}
          </span>
        </div>

        {/* ═══ Navigation ═══ */}
        <nav className="flex-1 space-y-1 p-3">
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

        {/* ═══ Footer Actions ═══ */}
        <div className="border-t border-gray-100 p-3">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            <Store className="h-4 w-4" />
            عرض المتجر
          </Link>
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