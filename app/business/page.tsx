"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Building2, ShieldCheck, ShieldAlert, Clock, Package, ShoppingBag, Users, Plus } from "lucide-react";

type Business = {
  id: number;
  type: string;
  status: string;
  name: string;
  slug: string;
  city: string;
  phone: string;
  logo: string | null;
  verifiedAt: string | null;
  linkedSellerId: number | null;
  createdAt: string;
  _count: { members: number; productMasters: number; wholesaleOffers: number };
};

const TYPE_LABEL: Record<string, string> = {
  FACTORY: "مصنع", COMPANY: "شركة", SUPPLIER: "مورد", IMPORTER: "مستورد", WHOLESALE_TRADER: "تاجر جملة",
};

const STATUS_LABEL: Record<string, { label: string; color: string; Icon: any }> = {
  PENDING: { label: "قيد التوثيق", color: "bg-amber-100 text-amber-700", Icon: Clock },
  VERIFIED: { label: "موثق", color: "bg-green-100 text-green-700", Icon: ShieldCheck },
  SUSPENDED: { label: "موقوف", color: "bg-red-100 text-red-700", Icon: ShieldAlert },
  REJECTED: { label: "مرفوض", color: "bg-gray-100 text-gray-700", Icon: ShieldAlert },
};

export default function BusinessListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/business");
        if (res.status === 401) { router.push("/login"); return; }
        const d = await res.json();
        if (d.success) setBusinesses(d.businesses);
        else setError(d.message);
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [router]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">أنشطتي التجارية</h1>
        <p className="text-sm text-gray-600 mt-1">إدارة أنشطتك على سوق الجملة</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">{error}</div>}

      {businesses.length === 0 ? (
        <div className="rounded-xl bg-white border p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold mb-2">لا يوجد لديك أنشطة تجارية بعد</h2>
          <p className="text-sm text-gray-600 mb-6">سجّل نشاطك الأول للبدء في البيع والشراء بالجملة</p>
          <Link href="/business/new" className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3 text-white hover:bg-orange-600">
            <Plus className="h-5 w-5" /> إنشاء نشاط جديد
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {businesses.map((b) => {
            const st = STATUS_LABEL[b.status] || STATUS_LABEL.PENDING;
            const StIcon = st.Icon;
            return (
              <Link key={b.id} href={`/business/${b.id}`} className="rounded-xl bg-white border p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 mb-1">{TYPE_LABEL[b.type]}</p>
                    <h3 className="font-bold text-lg">{b.name}</h3>
                    <p className="text-sm text-gray-600">{b.city}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${st.color}`}>
                    <StIcon className="h-3 w-3" /> {st.label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-gray-50 p-2">
                    <Package className="h-4 w-4 mx-auto text-gray-500 mb-1" />
                    <p className="text-xs text-gray-600">منتجات</p>
                    <p className="font-bold">{b._count.productMasters}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2">
                    <ShoppingBag className="h-4 w-4 mx-auto text-gray-500 mb-1" />
                    <p className="text-xs text-gray-600">عروض</p>
                    <p className="font-bold">{b._count.wholesaleOffers}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2">
                    <Users className="h-4 w-4 mx-auto text-gray-500 mb-1" />
                    <p className="text-xs text-gray-600">أعضاء</p>
                    <p className="font-bold">{b._count.members}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}