"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, Package, FileText, Warehouse, Settings, ArrowLeft, Clock,
  CheckCircle2, AlertCircle, TrendingUp, ShoppingBag, Store, Plus,
  ShieldCheck, AlertTriangle,
} from "lucide-react";

type Stats = {
  totalOffers: number;
  activeOffers: number;
  totalMasters: number;
  pendingOrders: number;
  acceptedOrders: number;
  completedOrders: number;
  revenue30d: number;
};

type RecentOrder = {
  id: number;
  orderNumber: string;
  status: string;
  total: number;
  itemCount: number;
  buyerName: string;
  createdAt: string;
};

type LowStock = {
  variantId: number;
  stock: number;
  sku: string | null;
  offerId: number;
  masterName: string;
};

type Supplier = {
  displayName: string;
  slug: string;
  status: string;
  isVerified: boolean;
  activityType: string;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: "جديد", color: "bg-amber-100 text-amber-700" },
  ACCEPTED: { label: "مقبول", color: "bg-blue-100 text-blue-700" },
  REJECTED: { label: "مرفوض", color: "bg-red-100 text-red-700" },
  PREPARING: { label: "قيد التجهيز", color: "bg-indigo-100 text-indigo-700" },
  READY: { label: "جاهز", color: "bg-purple-100 text-purple-700" },
  COMPLETED: { label: "مكتمل", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "ملغى", color: "bg-gray-100 text-gray-700" },
};

export default function SellerWholesalePage() {
  const router = useRouter();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lowStock, setLowStock] = useState<LowStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [notRegistered, setNotRegistered] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/wholesale/me");
        const meData = await meRes.json();
        if (!meData.success || !meData.supplier) {
          setNotRegistered(true);
          setLoading(false);
          return;
        }
        setSupplier(meData.supplier);

        const statsRes = await fetch("/api/wholesale/stats");
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(statsData.stats);
          setRecentOrders(statsData.recentOrders);
          setLowStock(statsData.lowStock);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" /></div>;
  }

  if (notRegistered) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <Store className="mx-auto h-12 w-12 text-gray-300" />
          <h2 className="mt-4 text-lg font-black text-gray-900">ليس لديك حساب جملة</h2>
          <p className="mt-2 text-sm text-gray-500">افتح حساب بيع بالجملة وابدأ البيع للتجار</p>
          <Link href="/wholesale/register" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#e64a00]">
            <Plus className="h-4 w-4" /> افتح حساب جملة
          </Link>
        </div>
      </div>
    );
  }

  if (!supplier || !stats) return null;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-gray-900">بوابة البيع بالجملة</h1>
              {supplier.isVerified && (
                <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                  <ShieldCheck className="h-3 w-3" /> موثق
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">{supplier.displayName}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/wholesale/dashboard" className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
              لوحة الجملة <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Status alert */}
        {supplier.status === "PENDING" && (
          <div className="mb-6 flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-xs text-amber-800">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <strong>حسابك قيد المراجعة.</strong> يمكنك إضافة العروض، لكنها ستظهر للتجار بعد الموافقة.
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100">
              <FileText className="h-4 w-4 text-[#ff5c00]" />
            </div>
            <div className="mt-2 text-2xl font-black">{stats.pendingOrders}</div>
            <div className="text-[11px] text-gray-500">طلبات جديدة</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
              <Package className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-black">{stats.activeOffers}</div>
            <div className="text-[11px] text-gray-500">عروض نشطة</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <div className="mt-2 text-2xl font-black">{stats.revenue30d.toFixed(0)}</div>
            <div className="text-[11px] text-gray-500">إيرادات (30 يوم) د.م</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
              <CheckCircle2 className="h-4 w-4 text-purple-600" />
            </div>
            <div className="mt-2 text-2xl font-black">{stats.completedOrders}</div>
            <div className="text-[11px] text-gray-500">طلبات مكتملة</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/seller/wholesale/offers/new" className="flex items-center gap-3 rounded-xl bg-gradient-to-l from-[#fff4ed] to-white p-4 shadow-sm ring-1 ring-orange-100 transition hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ff5c00]"><Plus className="h-5 w-5 text-white" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black">عرض جديد</div>
              <div className="text-[10px] text-gray-500">أضف منتجًا للبيع</div>
            </div>
          </Link>
          <Link href="/seller/wholesale/offers" className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50"><Package className="h-5 w-5 text-[#ff5c00]" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black">عروضي</div>
              <div className="text-[10px] text-gray-500">{stats.totalOffers} عرض</div>
            </div>
          </Link>
          <Link href="/seller/wholesale/orders" className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50"><FileText className="h-5 w-5 text-[#ff5c00]" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black">الطلبات</div>
              <div className="text-[10px] text-gray-500">{stats.pendingOrders} جديد</div>
            </div>
          </Link>
          <Link href="/seller/wholesale/masters" className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50"><Warehouse className="h-5 w-5 text-[#ff5c00]" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black">الهويات</div>
              <div className="text-[10px] text-gray-500">{stats.totalMasters} هوية</div>
            </div>
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Recent Orders */}
          <div className="rounded-xl bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black">آخر الطلبات</h2>
              <Link href="/seller/wholesale/orders" className="text-[10px] font-bold text-[#ff5c00] hover:underline">عرض الكل ←</Link>
            </div>
            {recentOrders.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500">
                <ShoppingBag className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2">لا توجد طلبات بعد</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentOrders.map((o) => {
                  const info = STATUS_LABEL[o.status] || STATUS_LABEL.PENDING;
                  return (
                    <Link key={o.id} href={`/seller/wholesale/orders/${o.id}`} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-2.5 transition hover:bg-gray-100">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold">{o.orderNumber}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${info.color}`}>{info.label}</span>
                        </div>
                        <div className="text-[10px] text-gray-500">{o.buyerName} · {o.itemCount} منتج</div>
                      </div>
                      <div className="text-xs font-black text-[#ff5c00]">{o.total.toFixed(0)} د.م</div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Low Stock */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-black">مخزون منخفض</h2>
            </div>
            {lowStock.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500">
                <CheckCircle2 className="mx-auto h-6 w-6 text-green-500" />
                <p className="mt-1">كل المخزونات جيدة</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {lowStock.map((ls) => (
                  <Link key={ls.variantId} href={`/seller/wholesale/offers/${ls.offerId}`} className="flex items-center justify-between rounded-lg bg-amber-50 p-2 text-[11px]">
                    <span className="truncate">{ls.masterName}</span>
                    <span className="font-black text-amber-700">{ls.stock}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}