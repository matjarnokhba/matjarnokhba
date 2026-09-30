"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Store,
  Search,
  ChevronLeft,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldX,
} from "lucide-react";

type Seller = {
  id: number;
  storeName: string;
  slug: string;
  logo: string | null;
  city: string | null;
  status: string;
  isVerified: boolean;
  avgRating: string;
  createdAt: string;
  user: { id: number; name: string; email: string; phone: string | null };
  _count: { products: number; orders: number };
};

type Stats = {
  PENDING: number;
  ACTIVE: number;
  SUSPENDED: number;
  CLOSED: number;
  total: number;
};

const STATUS_INFO: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  PENDING: {
    label: "بانتظار الموافقة",
    color: "text-amber-700",
    bg: "bg-amber-100",
    icon: Clock,
  },
  ACTIVE: {
    label: "نشط",
    color: "text-green-700",
    bg: "bg-green-100",
    icon: CheckCircle2,
  },
  SUSPENDED: {
    label: "معلّق",
    color: "text-red-700",
    bg: "bg-red-100",
    icon: ShieldX,
  },
  CLOSED: {
    label: "مغلق",
    color: "text-gray-700",
    bg: "bg-gray-100",
    icon: XCircle,
  },
};

type Filter = "ALL" | "PENDING" | "ACTIVE" | "SUSPENDED" | "CLOSED";

export default function AdminSellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [stats, setStats] = useState<Stats>({
    PENDING: 0,
    ACTIVE: 0,
    SUSPENDED: 0,
    CLOSED: 0,
    total: 0,
  });
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("status", filter);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/admin/sellers?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setSellers(data.sellers);
        setStats(data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== "") loadData();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">إدارة التجار</h1>
        <p className="mt-1 text-sm text-gray-500">
          الموافقة على المتاجر وإدارة حالة البائعين
        </p>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-black text-gray-900">{stats.total}</div>
          <div className="mt-1 text-xs text-gray-500">الإجمالي</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-black text-amber-600">
            {stats.PENDING}
          </div>
          <div className="mt-1 text-xs text-gray-500">بانتظار</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-black text-green-600">
            {stats.ACTIVE}
          </div>
          <div className="mt-1 text-xs text-gray-500">نشط</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-black text-red-600">
            {stats.SUSPENDED}
          </div>
          <div className="mt-1 text-xs text-gray-500">معلّق</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-black text-gray-600">
            {stats.CLOSED}
          </div>
          <div className="mt-1 text-xs text-gray-500">مغلق</div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم المتجر أو صاحب المتجر..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00]"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["PENDING", "ACTIVE", "SUSPENDED", "CLOSED", "ALL"] as Filter[]).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                filter === f
                  ? "bg-[#ff5c00] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f === "PENDING" && "بانتظار الموافقة"}
              {f === "ACTIVE" && "النشطة"}
              {f === "SUSPENDED" && "المعلّقة"}
              {f === "CLOSED" && "المغلقة"}
              {f === "ALL" && "الكل"}
            </button>
          )
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : sellers.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <div className="text-5xl">🏪</div>
          <h3 className="mt-4 text-lg font-black">لا يوجد تجار</h3>
          <p className="mt-2 text-sm text-gray-500">
            {filter === "PENDING"
              ? "لا توجد طلبات انضمام بانتظار المراجعة"
              : "لا يوجد تجار بهذه الحالة"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sellers.map((seller) => {
            const info = STATUS_INFO[seller.status] || STATUS_INFO.PENDING;
            const Icon = info.icon;

            return (
              <Link
                key={seller.id}
                href={`/admin/sellers/${seller.id}`}
                className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-4">
                  {/* Logo */}
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                    {seller.logo ? (
                      <img
                        src={seller.logo}
                        alt={seller.storeName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-500 text-lg font-black text-[#0a1a35]">
                        {seller.storeName.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-gray-900">
                        {seller.storeName}
                      </span>
                      {seller.isVerified && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500">
                          <ShieldCheck className="h-3 w-3 text-white" />
                        </span>
                      )}
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${info.bg} ${info.color}`}
                      >
                        <Icon className="h-3 w-3" />
                        {info.label}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      {seller.user.name} · {seller.user.email}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-gray-400">
                      <span>{seller._count.products} منتج</span>
                      <span>·</span>
                      <span>{seller._count.orders} طلب</span>
                      {seller.city && (
                        <>
                          <span>·</span>
                          <span>{seller.city}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <ChevronLeft className="h-5 w-5 shrink-0 text-gray-300" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}