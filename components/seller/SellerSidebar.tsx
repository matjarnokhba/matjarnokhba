"use client";

import { useState, useEffect } from "react";
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
  X,
  Store,
  Bell,
  QrCode,
  ScanLine,
  RotateCcw,
  BadgeCheck,
  PackageX,
  Users,
} from "lucide-react";

type SellerSidebarProps = {
  storeName: string;
  storeSlug: string;
  isVerified: boolean;
  isSellerOwner?: boolean;
  staffPermissions?: string[];
};

type NavItem = {
  href: string;
  label: string;
  icon: any;
  exact: boolean;
  ownerOnly?: boolean;
  permission?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/seller", label: "لوحة عامة", icon: LayoutDashboard, exact: true },
  { href: "/seller/notifications", label: "الإشعارات", icon: Bell, exact: false, permission: "VIEW_NOTIFICATIONS" },
  { href: "/seller/fulfillments", label: "تجهيزاتي", icon: Package, exact: false, permission: "VIEW_FULFILLMENTS" },
  { href: "/seller/scanner", label: "ماسح المنتجات", icon: ScanLine, exact: false, permission: "USE_SCANNER" },
  { href: "/seller/products", label: "منتجاتي", icon: Package, exact: false, permission: "VIEW_PRODUCTS" },
  { href: "/seller/qr", label: "QR المتجر", icon: QrCode, exact: false, permission: "VIEW_QR" },
  { href: "/seller/orders", label: "طلباتي", icon: ShoppingCart, exact: false, permission: "VIEW_ORDERS" },
  { href: "/seller/returns", label: "المرتجعات", icon: RotateCcw, exact: false, permission: "VIEW_RETURNS" },
  { href: "/seller/returns-batches", label: "مرتجعات من المستودع", icon: PackageX, exact: false, permission: "VIEW_BATCHES" },
  { href: "/seller/reviews", label: "التقييمات", icon: Star, exact: false, permission: "VIEW_REVIEWS" },
  { href: "/seller/performance", label: "أدائي", icon: TrendingUp, exact: false, permission: "VIEW_PERFORMANCE" },
  { href: "/seller/subscription", label: "اشتراك المحل", icon: BadgeCheck, exact: false, ownerOnly: true },
  { href: "/seller/wallet", label: "محفظتي", icon: Wallet, exact: false, permission: "VIEW_WALLET" },
  { href: "/seller/bank-accounts", label: "حساباتي البنكية", icon: Building2, exact: false, ownerOnly: true },
  { href: "/seller/documents", label: "وثائقي", icon: FileText, exact: false, ownerOnly: true },
  { href: "/seller/profile", label: "ملف المتجر", icon: User, exact: false, ownerOnly: true },
  { href: "/seller/staff", label: "الموظفون", icon: Users, exact: false, ownerOnly: true },
];

export default function SellerSidebar({
  storeName,
  storeSlug,
  isVerified,
  isSellerOwner = true,
  staffPermissions = [],
}: SellerSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setMobileOpen(true);
    window.addEventListener("openSidebar", handler);
    return () => window.removeEventListener("openSidebar", handler);
  }, []);

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

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (isSellerOwner) return true;
    if (item.ownerOnly) return false;
    if (item.permission && !staffPermissions.includes(item.permission)) {
      return false;
    }
    return true;
  });

  return (
    <>
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

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 pb-24">
          {visibleItems.map((item) => {
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