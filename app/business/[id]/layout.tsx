"use client";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, ShoppingBag, ShoppingCart, Warehouse, BookOpen,
  Building2,
} from "lucide-react";

const TABS = [
  { key: "", label: "نظرة عامة", Icon: LayoutDashboard },
  { key: "masters", label: "المنتجات", Icon: Package },
  { key: "offers", label: "العروض", Icon: ShoppingBag },
  { key: "orders", label: "الطلبات", Icon: ShoppingCart },
  { key: "inventory", label: "المخزون", Icon: Warehouse },
  { key: "ledger", label: "الدفتر", Icon: BookOpen },
];

export default function BusinessDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const bizId = params.id as string;
  const base = `/business/${bizId}`;

  const rest = pathname === base ? "" : pathname.startsWith(base + "/") ? pathname.slice(base.length + 1) : "";
  const firstSegment = rest.split("/")[0] || "";

  function isActive(key: string) {
    if (key === "") return firstSegment === "";
    return firstSegment === key;
  }

  return (
    <div className="space-y-6">
      <nav className="border-b bg-white rounded-lg shadow-sm">
        <div className="flex overflow-x-auto">
          {TABS.map((t) => {
            const active = isActive(t.key);
            const Icon = t.Icon;
            const href = t.key === "" ? base : `${base}/${t.key}`;
            return (
              <Link
                key={t.key}
                href={href}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? "border-orange-500 text-orange-600 bg-orange-50"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </div>
  );
}