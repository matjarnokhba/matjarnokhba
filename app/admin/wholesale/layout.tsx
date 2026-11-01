"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Building2, Package, ShoppingBag } from "lucide-react";

const TABS = [
  { href: "/admin/wholesale", label: "نظرة عامة", Icon: Shield },
  { href: "/admin/wholesale/businesses", label: "الأنشطة", Icon: Building2 },
  { href: "/admin/wholesale/masters", label: "المنتجات", Icon: Package },
  { href: "/admin/wholesale/offers", label: "العروض", Icon: ShoppingBag },
];

export default function AdminWholesaleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="py-4 flex items-center gap-3">
            <Shield className="h-6 w-6 text-orange-500" />
            <h1 className="font-bold text-xl">إدارة سوق الجملة</h1>
          </div>
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {TABS.map((t) => {
              const active = t.href === "/admin/wholesale" ? pathname === t.href : pathname?.startsWith(t.href);
              const Icon = t.Icon;
              return (
                <Link key={t.href} href={t.href}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 ${active ? "border-orange-500 text-orange-600" : "border-transparent text-gray-600 hover:text-gray-900"}`}>
                  <Icon className="h-4 w-4" /> {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}