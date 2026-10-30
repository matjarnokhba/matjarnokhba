"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Loader2, Package, ShoppingBag, FileText, Search, Shield, ShieldCheck,
  ShieldX, X, CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronRight,
  Eye, MapPin, Store, Clock,
} from "lucide-react";

type Tab = "masters" | "offers" | "orders";

type Master = {
  id: number;
  name: string;
  slug: string;
  brand: string | null;
  barcode: string | null;
  qrCode: string | null;
  images: string[];
  category: { id: number; name: string };
  createdBy: { id: number; name: string; email: string };
  manufacturer: { id: number; name: string } | null;
  isVerified: boolean;
  status: string;
  offerCount: number;
  variantCount: number;
  createdAt: string;
};

type Offer = {
  id: number;
  master: { id: number; name: string; images: string[]; brand: string | null; isVerified: boolean };
  supplier: { id: number; displayName: string; isVerified: boolean; activityType: string; city: string };
  source: { id: number; name: string; city: string } | null;
  wholesalePrice: number;
  claimType: string;
  claimVerified: boolean;
  isActive: boolean;
  totalStock: number;
  ordersCount: number;
  createdAt: string;
};

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  total: number;
  itemCount: number;
  buyer: { id: number; name: string; email: string };
  supplier: { id: number; displayName: string; city: string; isVerified: boolean };
  createdAt: string;
};

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: "بانتظار", color: "bg-amber-100 text-amber-700" },
  ACCEPTED: { label: "مقبول", color: "bg-blue-100 text-blue-700" },
  REJECTED: { label: "مرفوض", color: "bg-red-100 text-red-700" },
  PREPARING: { label: "قيد التجهيز", color: "bg-indigo-100 text-indigo-700" },
  READY: { label: "جاهز", color: "bg-purple-100 text-purple-700" },
  COMPLETED: { label: "مكتمل", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "ملغى", color: "bg-gray-100 text-gray-700" },
};

const CLAIM_LABEL: Record<string, string> = {
  MANUFACTURER: "مصنع",
  DISTRIBUTOR: "موزع",
  RESELLER: "إعادة بيع",
};

export default function AdminWholesalePage() {
  const [tab, setTab] = useState<Tab>("masters");

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">إدارة سوق الجملة</h1>
          <p className="mt-1 text-sm text-gray-500">
            مراقبة الهويات والعروض والطلبات عبر المنصة
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setTab("masters")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition ${
              tab === "masters"
                ? "border-b-2 border-[#ff5c00] text-[#ff5c00]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Package className="h-4 w-4" />
            الهويات
          </button>
          <button
            onClick={() => setTab("offers")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition ${
              tab === "offers"
                ? "border-b-2 border-[#ff5c00] text-[#ff5c00]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
            العروض
          </button>
          <button
            onClick={() => setTab("orders")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition ${
              tab === "orders"
                ? "border-b-2 border-[#ff5c00] text-[#ff5c00]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <FileText className="h-4 w-4" />
            الطلبات
          </button>
        </div>

        {tab === "masters" && <MastersTab />}
        {tab === "offers" && <OffersTab />}
        {tab === "orders" && <OrdersTab />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Masters Tab
// ═══════════════════════════════════════════════
function MastersTab() {
  const [masters, setMasters] = useState<Master[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (p: number = 1) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      if (search.trim()) params.set("search", search.trim());
      if (verifiedFilter) params.set("verified", verifiedFilter);
      const res = await fetch(`/api/admin/wholesale/masters?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setMasters(data.masters);
        setPagination(data.pagination);
      } else setError(data.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }, [search, verifiedFilter]);

  useEffect(() => { load(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function action(masterId: number, act: "verify" | "unverify" | "suspend" | "activate") {
    setBusyId(masterId);
    try {
      const res = await fetch(`/api/admin/wholesale/masters/${masterId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act }),
      });
      const d = await res.json();
      if (!d.success) { alert(d.message); return; }
      await load(page);
    } finally { setBusyId(null); }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(1)}
            placeholder="ابحث بالاسم، الباركود، الماركة..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00]"
          />
        </div>
        <select value={verifiedFilter} onChange={(e) => { setVerifiedFilter(e.target.value as any); setPage(1); setTimeout(() => load(1), 0); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold outline-none focus:border-[#ff5c00]">
          <option value="">كل الهويات</option>
          <option value="true">موثقة</option>
          <option value="false">غير موثقة</option>
        </select>
        <button onClick={() => load(1)} className="rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#e64a00]">بحث</button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" /></div>
      ) : masters.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Package className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">لا توجد هويات</p>
        </div>
      ) : (
        <>
          {pagination && <div className="mb-3 text-xs text-gray-500">{pagination.total} هوية — صفحة {pagination.page}/{pagination.totalPages}</div>}
          <div className="space-y-2">
            {masters.map((m) => (
              <div key={m.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {m.images[0] ? <img src={m.images[0]} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-6 w-6 text-gray-300" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black">{m.name}</span>
                      {m.isVerified && (
                        <span className="flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                          <ShieldCheck className="h-2.5 w-2.5" /> موثق
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                      <span>{m.category.name}</span>
                      {m.brand && <span>· {m.brand}</span>}
                      <span>· منشئ: {m.createdBy.name}</span>
                      <span>· {m.offerCount} عرض · {m.variantCount} خيار</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Link href={`/admin/wholesale/masters/${m.id}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                    {!m.isVerified && (
                      <button onClick={() => action(m.id, "verify")} disabled={busyId === m.id} className="flex items-center gap-1 rounded-lg bg-green-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-green-700 disabled:opacity-50">
                        {busyId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
                        توثيق
                      </button>
                    )}
                    {m.isVerified && (
                      <button onClick={() => action(m.id, "unverify")} disabled={busyId === m.id} className="rounded-lg border border-gray-200 px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                        إلغاء التوثيق
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button onClick={() => { setPage(page - 1); load(page - 1); }} disabled={page === 1} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              <span className="text-xs font-bold">{page} / {pagination.totalPages}</span>
              <button onClick={() => { setPage(page + 1); load(page + 1); }} disabled={page === pagination.totalPages} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Offers Tab
// ═══════════════════════════════════════════════
function OffersTab() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [claimFilter, setClaimFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const load = useCallback(async (p: number = 1) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      if (activeFilter) params.set("active", activeFilter);
      if (claimFilter) params.set("claimType", claimFilter);
      const res = await fetch(`/api/admin/wholesale/offers?${params.toString()}`);
      const data = await res.json();
      if (data.success) { setOffers(data.offers); setPagination(data.pagination); }
      else setError(data.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }, [activeFilter, claimFilter]);

  useEffect(() => { load(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <select value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value as any); setPage(1); setTimeout(() => load(1), 0); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold outline-none focus:border-[#ff5c00]">
          <option value="">كل العروض</option>
          <option value="true">نشطة</option>
          <option value="false">معطّلة</option>
        </select>
        <select value={claimFilter} onChange={(e) => { setClaimFilter(e.target.value); setPage(1); setTimeout(() => load(1), 0); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold outline-none focus:border-[#ff5c00]">
          <option value="">كل الأنواع</option>
          <option value="MANUFACTURER">من المصنع</option>
          <option value="DISTRIBUTOR">موزع</option>
          <option value="RESELLER">إعادة بيع</option>
        </select>
        <button onClick={() => load(1)} className="rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#e64a00]">تحديث</button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" /></div>
      ) : offers.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <ShoppingBag className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">لا توجد عروض</p>
        </div>
      ) : (
        <>
          {pagination && <div className="mb-3 text-xs text-gray-500">{pagination.total} عرض — صفحة {pagination.page}/{pagination.totalPages}</div>}
          <div className="space-y-2">
            {offers.map((o) => (
              <div key={o.id} className={`rounded-xl bg-white p-4 shadow-sm ${!o.isActive ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {o.master.images[0] ? <img src={o.master.images[0]} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-6 w-6 text-gray-300" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black">{o.master.name}</span>
                      {o.master.isVerified && <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />}
                      {!o.isActive && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold text-gray-700">معطّل</span>}
                      {o.claimVerified && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">{CLAIM_LABEL[o.claimType]}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1"><Store className="h-3 w-3" />{o.supplier.displayName}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{o.supplier.city}</span>
                      <span>· {o.wholesalePrice.toFixed(2)} د.م</span>
                      <span>· مخزون: {o.totalStock}</span>
                      {o.ordersCount > 0 && <span className="text-[#ff5c00]">· {o.ordersCount} طلب</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button onClick={() => { setPage(page - 1); load(page - 1); }} disabled={page === 1} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              <span className="text-xs font-bold">{page} / {pagination.totalPages}</span>
              <button onClick={() => { setPage(page + 1); load(page + 1); }} disabled={page === pagination.totalPages} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Orders Tab
// ═══════════════════════════════════════════════
function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [statusTotals, setStatusTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const load = useCallback(async (p: number = 1) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/wholesale/orders?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
        setPagination(data.pagination);
        setStatusTotals(data.statusTotals || {});
      } else setError(data.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const totalOrders = Object.values(statusTotals).reduce((s, v) => s + v, 0);

  return (
    <div>
      {/* Status totals */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="text-lg font-black">{totalOrders}</div>
          <div className="text-[10px] text-gray-500">الإجمالي</div>
        </div>
        {Object.entries(STATUS_LABEL).map(([key, info]) => (
          <div key={key} className="rounded-lg bg-white p-3 shadow-sm">
            <div className="text-lg font-black">{statusTotals[key] || 0}</div>
            <div className="text-[10px] text-gray-500">{info.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); setTimeout(() => load(1), 0); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold outline-none focus:border-[#ff5c00]">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => load(1)} className="rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#e64a00]">تحديث</button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" /></div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">لا توجد طلبات</p>
        </div>
      ) : (
        <>
          {pagination && <div className="mb-3 text-xs text-gray-500">{pagination.total} طلب — صفحة {pagination.page}/{pagination.totalPages}</div>}
          <div className="space-y-2">
            {orders.map((o) => {
              const info = STATUS_LABEL[o.status] || STATUS_LABEL.PENDING;
              return (
                <div key={o.id} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-black">{o.orderNumber}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${info.color}`}>{info.label}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                        <span>مشتري: {o.buyer.name}</span>
                        <span>· بائع: {o.supplier.displayName} ({o.supplier.city})</span>
                        <span>· {o.itemCount} منتج</span>
                        <span>· {new Date(o.createdAt).toLocaleDateString("ar-MA")}</span>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-black text-[#ff5c00]">{o.total.toFixed(2)}</div>
                      <div className="text-[10px] text-gray-500">د.م</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button onClick={() => { setPage(page - 1); load(page - 1); }} disabled={page === 1} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              <span className="text-xs font-bold">{page} / {pagination.totalPages}</span>
              <button onClick={() => { setPage(page + 1); load(page + 1); }} disabled={page === pagination.totalPages} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}