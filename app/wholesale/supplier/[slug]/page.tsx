"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Package, Store, MapPin, BadgeCheck,
  Phone, Mail, Building2, Factory, Warehouse, Truck, ShoppingBag, Briefcase,
} from "lucide-react";

type Supplier = {
  id: number;
  displayName: string;
  slug: string;
  activityType: string;
  description: string | null;
  city: string;
  region: string | null;
  logo: string | null;
  isVerified: boolean;
  status: string;
  counts: { sources: number; products: number; orders: number };
};

type Offer = {
  id: number;
  master: {
    id: number;
    name: string;
    slug: string;
    brand: string | null;
    images: string[];
    category: { id: number; name: string; slug: string };
  };
  source: { id: number; name: string; city: string } | null;
  wholesalePrice: number;
  retailPrice: number | null;
  minOrderQty: number;
  maxOrderQty: number | null;
  unit: string;
  claimType: string;
  claimVerified: boolean;
  totalStock: number;
  variantCount: number;
};

const ACTIVITY_LABEL: Record<string, string> = {
  COMPANY: "شركة تجارية", WORKSHOP: "ورشة", FACTORY: "معمل / مصنع",
  WAREHOUSE: "مخزن", SHOP: "محل تجاري", DISTRIBUTOR: "موزع / مورد",
  INDEPENDENT: "بائع جملة مستقل",
};

const ACTIVITY_ICON: Record<string, any> = {
  COMPANY: Building2, WORKSHOP: Briefcase, FACTORY: Factory,
  WAREHOUSE: Warehouse, SHOP: ShoppingBag, DISTRIBUTOR: Truck,
  INDEPENDENT: Store,
};

const CLAIM_LABEL: Record<string, string> = {
  MANUFACTURER: "من المصنع", DISTRIBUTOR: "موزع", RESELLER: "إعادة بيع",
};

export default function SupplierPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/wholesale/browse?supplier=${encodeURIComponent(slug)}&pageSize=48`);
        if (res.status === 401) { router.push(`/login?next=/wholesale/supplier/${slug}`); return; }
        if (res.status === 403) { setError("تصفح الجملة متاح للتجار الموثقين فقط"); return; }
        const data = await res.json();
        if (!data.success) { setError(data.message); return; }
        if (data.offers.length === 0) { setError("لا توجد عروض نشطة من هذا المورد"); return; }
        setOffers(data.offers);
        // Derive supplier from first offer
        const firstSupplier = data.offers[0].supplier;
        setSupplier({
          id: firstSupplier.id,
          displayName: firstSupplier.displayName,
          slug: firstSupplier.slug,
          activityType: firstSupplier.activityType,
          description: null,
          city: firstSupplier.city,
          region: firstSupplier.region,
          logo: null,
          isVerified: firstSupplier.isVerified,
          status: "ACTIVE",
          counts: { sources: 0, products: data.offers.length, orders: 0 },
        });
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [slug, router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" /></div>;
  }

  if (error || !supplier) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 py-12" dir="rtl">
        <div className="mx-auto max-w-md rounded-xl bg-red-50 p-6 text-center">
          <Package className="mx-auto h-10 w-10 text-red-600" />
          <p className="mt-3 text-sm font-bold text-red-700">{error || "المورد غير موجود"}</p>
          <Link href="/wholesale/browse" className="mt-4 inline-block rounded-lg bg-[#ff5c00] px-4 py-2 text-sm font-bold text-white">
            عودة للسوق
          </Link>
        </div>
      </div>
    );
  }

  const ActivityIcon = ACTIVITY_ICON[supplier.activityType] || Store;

  return (
    <div className="min-h-screen bg-gray-50 p-4 py-8" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <Link href="/wholesale/browse" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]">
          <ArrowLeft className="h-3.5 w-3.5" /> عودة للسوق
        </Link>

        {/* Header */}
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#fff4ed]">
              <ActivityIcon className="h-8 w-8 text-[#ff5c00]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black text-gray-900">{supplier.displayName}</h1>
                {supplier.isVerified && <BadgeCheck className="h-5 w-5 text-blue-500" />}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span className="rounded bg-orange-50 px-2 py-0.5 font-bold text-[#ff5c00]">
                  {ACTIVITY_LABEL[supplier.activityType]}
                </span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{supplier.city}{supplier.region && ` - ${supplier.region}`}</span>
                <span>· {offers.length} منتج معروض</span>
              </div>
            </div>
          </div>
          {supplier.description && (
            <p className="mt-3 text-sm text-gray-600">{supplier.description}</p>
          )}
        </div>

        {/* Offers grid */}
        <h2 className="mb-3 text-sm font-black text-gray-900">المنتجات المعروضة ({offers.length})</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((o) => (
            <Link
              key={o.id}
              href={`/wholesale/master/${o.master.id}?offer=${o.id}`}
              className="group flex flex-col overflow-hidden rounded-xl bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="aspect-square bg-gray-100">
                {o.master.images[0] ? (
                  <img src={o.master.images[0]} alt={o.master.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center"><Package className="h-12 w-12 text-gray-300" /></div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-3">
                <div className="mb-1 flex items-center gap-1 text-[10px] text-gray-500">
                  <span>{o.master.category.name}</span>
                  {o.claimVerified && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">{CLAIM_LABEL[o.claimType]}</span>}
                </div>
                <div className="line-clamp-2 text-sm font-black text-gray-900">{o.master.name}</div>
                {o.master.brand && <div className="mt-0.5 text-[11px] text-gray-500">{o.master.brand}</div>}
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-lg font-black text-[#ff5c00]">{o.wholesalePrice.toFixed(2)}</span>
                  <span className="text-[10px] text-gray-500">د.م / {o.unit}</span>
                </div>
                <div className="mt-1 text-[10px] text-gray-500">الحد الأدنى: {o.minOrderQty} {o.unit}</div>
                <div className="mt-1 text-[10px] text-gray-400">
                  المخزون: {o.totalStock} {o.unit}{o.variantCount > 1 && ` · ${o.variantCount} خيار`}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}