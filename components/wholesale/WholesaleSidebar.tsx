"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Tag,
  ShoppingCart,
  Package,
  Wallet,
  Settings,
  Store,
  LogOut,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";

const NAV_ITEMS = [
  { href: "/wholesale", icon: LayoutDashboard, label: "الرئيسية", enabled: true },
  {
    href: "/wholesale/business-units",
    icon: Building2,
    label: "الأنشطة التجارية",
    enabled: true,
  },
  { href: "/wholesale/offers", icon: Tag, label: "عروض الجملة", enabled: false },
  {
    href: "/wholesale/orders",
    icon: ShoppingCart,
    label: "الطلبات",
    enabled: false,
  },
  { href: "/wholesale/inventory", icon: Package, label: "المخزون", enabled: false },
  { href: "/wholesale/financial", icon: Wallet, label: "المالية", enabled: false },
  {
    href: "/wholesale/settings",
    icon: Settings,
    label: "الإعدادات",
    enabled: false,
  },
] as const;

export interface WholesaleSidebarProps {
  userName: string;
  hasRetailStore: boolean;
}

export function WholesaleSidebar({ userName, hasRetailStore }: WholesaleSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push("/login");
  };

  const renderNav = () => (
    <>
      <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
        <Link
          href="/wholesale"
          className="flex items-center gap-2 text-lg font-black text-[#ff5c00]"
        >
          <Sparkles className="h-5 w-5" />
          <span>نخبة | الجملة</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/wholesale" && pathname.startsWith(item.href + "/"));
          if (!item.enabled) {
            return (
              <div
                key={item.href}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400"
                title="قريبًا"
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                <span className="mr-auto rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                  قريبًا
                </span>
              </div>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#ff5c00]/10 text-[#ff5c00]"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-100 p-3">
        <div className="mb-2 rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500">مسجل الدخول كـ</p>
          <p className="truncate text-sm font-semibold text-gray-900">
            {userName}
          </p>
        </div>
        {hasRetailStore && (
          <Link
            href="/seller"
            className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Store className="h-4 w-4" />
            <span>عودة إلى متجري</span>
          </Link>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
        <Link
          href="/wholesale"
          className="flex items-center gap-2 font-black text-[#ff5c00]"
        >
          <Sparkles className="h-5 w-5" />
          <span>نخبة | الجملة</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-1.5 text-gray-700 hover:bg-gray-100"
          aria-label="القائمة"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-64 flex-col border-l border-gray-200 bg-white lg:flex">
        {renderNav()}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 flex w-72 flex-col bg-white shadow-2xl">
            {renderNav()}
          </aside>
        </div>
      )}
    </>
  );
}