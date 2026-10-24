"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  QrCode,
  Package,
  History,
  LogOut,
  Menu,
  X,
  Warehouse,
  Send,
  RotateCcw,
  Wallet,
  Banknote,
  PackageX,
} from "lucide-react";

type Props = {
  userName: string;
  role: string;
};

const NAV_ITEMS = [
  {
    href: "/warehouse",
    label: "لوحة التحكم",
    icon: LayoutDashboard,
    exact: true,
  },
  { href: "/warehouse/handover", label: "تسليم للإدارة", icon: Banknote, exact: false },
  { href: "/warehouse/scan", label: "مسح QR", icon: QrCode, exact: false },
  {
    href: "/warehouse/receipts",
    label: "استلامات",
    icon: Package,
    exact: false,
  },
  {
    href: "/warehouse/assembly",
    label: "التجميع",
    icon: Package,
    exact: false,
  },
  {
    href: "/warehouse/shipments",
    label: "الشحنات",
    icon: Send,
    exact: false,
  },
  {
    href: "/warehouse/returns",
    label: "الإرجاعات",
    icon: RotateCcw,
    exact: false,
  },
  {
    href: "/warehouse/returns-in-transit",
    label: "مرتجعات في الطريق",
    icon: PackageX,
    exact: false,
  },
  {
    href: "/warehouse/cash-collection",
    label: "تحصيل الكاش",
    icon: Banknote,
    exact: false,
  },
  {
    href: "/warehouse/wallet",
    label: "محفظة المستودع",
    icon: Wallet,
    exact: false,
  },
  {
    href: "/warehouse/driver-payouts",
    label: "دفع أجور السائقين",
    icon: Banknote,
    exact: false,
  },
  { href: "/warehouse/history", label: "السجل", icon: History, exact: false },
];

export default function WarehouseSidebar({ userName, role }: Props) {
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
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed right-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-md lg:hidden"
        aria-label="القائمة"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed bottom-0 right-0 top-0 z-50 flex w-64 flex-col transform bg-white shadow-xl transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-100 bg-gradient-to-l from-teal-50 to-white px-4">
          <Link href="/warehouse" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-600 to-teal-800 text-white">
              <Warehouse className="h-5 w-5" />
            </span>
            <div className="leading-none">
              <strong className="block text-sm font-black">المستودع</strong>
              <small className="text-[10px] text-gray-500">متجر نخبة</small>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-gray-100 px-4 py-3">
          <div className="text-[10px] text-gray-500">المستخدم</div>
          <div className="mt-0.5 truncate text-sm font-bold text-gray-900">
            {userName}
          </div>
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">
            مسؤول المستودع
          </div>
        </div>

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
                    ? "bg-teal-50 text-teal-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

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