"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Tag,
  Building2,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";

const TABS = [
  {
    href: "/admin/wholesale",
    label: "نظرة عامة",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/admin/wholesale/master-products",
    label: "المنتجات الأصلية",
    icon: Package,
  },
  {
    href: "/admin/wholesale/offers",
    label: "عروض الجملة",
    icon: Tag,
  },
  {
    href: "/admin/wholesale/business-units",
    label: "الأنشطة التجارية",
    icon: Building2,
  },
  {
    href: "/admin/wholesale/returns",
    label: "المرتجعات",
    icon: RotateCcw,
  },
] as const;

export function WholesaleAdminNav() {
  const pathname = usePathname();

  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-gray-200">
      {TABS.map((t) => {
        const Icon = t.icon;
        const isExact = "exact" in t && t.exact === true;
        const active = isExact
          ? pathname === t.href
          : pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-[#ff5c00] text-[#ff5c00]"
                : "border-transparent text-gray-500 hover:text-gray-900"
            )}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}