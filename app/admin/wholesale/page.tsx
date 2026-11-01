"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Building2, Package, ShoppingBag, ArrowRight } from "lucide-react";

export default function AdminWholesaleDashboard() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ businesses: 0, masters: 0, offers: 0 });

  useEffect(() => {
    (async () => {
      try {
        const [b, m, o] = await Promise.all([
          fetch("/api/admin/businesses?status=PENDING&pageSize=1").then(r => r.json()),
          fetch("/api/admin/masters?status=pending&pageSize=1").then(r => r.json()),
          fetch("/api/admin/offers?pageSize=1").then(r => r.json()),
        ]);
        setCounts({
          businesses: b.success ? b.pagination.total : 0,
          masters: m.success ? m.pagination.total : 0,
          offers: o.success ? o.total : 0,
        });
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;

  const cards = [
    { href: "/admin/wholesale/businesses?status=PENDING", label: "أنشطة بانتظار التوثيق", count: counts.businesses, Icon: Building2, color: "from-blue-500 to-blue-600" },
    { href: "/admin/wholesale/masters?status=pending", label: "منتجات بانتظار التوثيق", count: counts.masters, Icon: Package, color: "from-purple-500 to-purple-600" },
    { href: "/admin/wholesale/offers", label: "مطالبات عروض معلقة", count: counts.offers, Icon: ShoppingBag, color: "from-amber-500 to-orange-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">لوحة الإدارة</h2>
        <p className="text-sm text-gray-600">مراجعة وتوثيق عناصر سوق الجملة</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.Icon;
          return (
            <Link key={c.href} href={c.href} className={`rounded-xl bg-gradient-to-br ${c.color} text-white p-6 hover:shadow-lg transition-shadow`}>
              <Icon className="h-10 w-10 mb-4 opacity-80" />
              <p className="text-4xl font-bold mb-1">{c.count}</p>
              <p className="text-sm opacity-90 flex items-center gap-1">{c.label} <ArrowRight className="h-4 w-4" /></p>
            </Link>
          );
        })}
      </div>

      <div className="rounded-xl bg-white border p-6">
        <h3 className="font-semibold mb-3">الإجراءات المتاحة</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>• مراجعة طلبات توثيق الأنشطة التجارية (شركات، مصانع، موردين، تجار)</li>
          <li>• توثيق المنتجات الجديدة قبل ظهورها في السوق</li>
          <li>• الموافقة على/رفض مطالبات العروض (منتج، موزع، مستورد، معيد بيع)</li>
        </ul>
      </div>
    </div>
  );
}