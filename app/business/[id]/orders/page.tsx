"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ShoppingCart, ArrowLeft, Package, Truck, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown } from "lucide-react";

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
  buyerBusiness: { id: number; name: string; city: string; logo: string | null };
  sellerBusiness: { id: number; name: string; city: string; logo: string | null };
  _count: { items: number };
};

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  DRAFT: { label: "مسودة", color: "bg-gray-100 text-gray-700", Icon: Clock },
  PENDING: { label: "بانتظار القبول", color: "bg-amber-100 text-amber-700", Icon: Clock },
  ACCEPTED: { label: "مقبول", color: "bg-blue-100 text-blue-700", Icon: CheckCircle2 },
  PREPARING: { label: "قيد التجهيز", color: "bg-indigo-100 text-indigo-700", Icon: Package },
  SHIPPED: { label: "تم الشحن", color: "bg-purple-100 text-purple-700", Icon: Truck },
  DELIVERED: { label: "تم التسليم", color: "bg-green-100 text-green-700", Icon: CheckCircle2 },
  COMPLETED: { label: "مكتمل", color: "bg-green-200 text-green-800", Icon: CheckCircle2 },
  REJECTED: { label: "مرفوض", color: "bg-red-100 text-red-700", Icon: XCircle },
  CANCELLED: { label: "ملغى", color: "bg-gray-200 text-gray-700", Icon: XCircle },
};

export default function OrdersListPage() {
  const params = useParams();
  const search = useSearchParams();
  const bizId = parseInt(params.id as string);
  const initialSide = (search.get("side") || "buyer") as "buyer" | "seller";

  const [side, setSide] = useState<"buyer" | "seller">(initialSide);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => { setPage(1); }, [side, statusFilter]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const q = new URLSearchParams({ side, page: String(page), pageSize: "20" });
        if (statusFilter) q.set("status", statusFilter);
        const res = await fetch(`/api/business/${bizId}/orders?${q}`);
        const d = await res.json();
        if (d.success) {
          setOrders(d.items);
          setTotal(d.total);
          setTotalPages(d.totalPages);
        } else setError(d.message);
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [bizId, side, statusFilter, page]);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/business/${bizId}`} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">الطلبات</h1>
          <p className="text-sm text-gray-600">{total} طلب</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setSide("buyer")} className={`flex-1 rounded-lg border p-3 flex items-center justify-center gap-2 ${side === "buyer" ? "bg-orange-500 text-white border-orange-500" : "hover:bg-gray-50"}`}>
          <TrendingDown className="h-5 w-5" />
          <div className="text-right"><p className="font-semibold">مشترياتي</p><p className="text-xs opacity-80">طلبات شراء</p></div>
        </button>
        <button onClick={() => setSide("seller")} className={`flex-1 rounded-lg border p-3 flex items-center justify-center gap-2 ${side === "seller" ? "bg-orange-500 text-white border-orange-500" : "hover:bg-gray-50"}`}>
          <TrendingUp className="h-5 w-5" />
          <div className="text-right"><p className="font-semibold">مبيعاتي</p><p className="text-xs opacity-80">طلبات واردة</p></div>
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter("")} className={`rounded-full px-3 py-1 text-xs border ${!statusFilter ? "bg-orange-500 text-white border-orange-500" : "hover:bg-gray-50"}`}>الكل</button>
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <button key={k} onClick={() => setStatusFilter(k)} className={`rounded-full px-3 py-1 text-xs border ${statusFilter === k ? "bg-orange-500 text-white border-orange-500" : "hover:bg-gray-50"}`}>{v.label}</button>
        ))}
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl bg-white border p-12 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600">لا توجد طلبات</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => {
            const st = STATUS_CONFIG[o.status] || STATUS_CONFIG.PENDING;
            const StIcon = st.Icon;
            const counterparty = side === "buyer" ? o.sellerBusiness : o.buyerBusiness;
            return (
              <Link key={o.id} href={`/business/${bizId}/orders/${o.id}?side=${side}`}
                className="block rounded-xl bg-white border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {counterparty.logo ? <img src={counterparty.logo} alt="" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-gray-400"><Package className="h-6 w-6" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-gray-500">{o.orderNumber}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${st.color}`}><StIcon className="h-3 w-3" />{st.label}</span>
                    </div>
                    <p className="font-semibold mt-1">{side === "buyer" ? "من" : "إلى"}: {counterparty.name}</p>
                    <p className="text-xs text-gray-500">{o._count.items} منتج · {new Date(o.createdAt).toLocaleDateString("ar-MA")}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg text-orange-600">{o.total} <span className="text-sm">{o.currency}</span></p>
                  </div>
                </div>
              </Link>
            );
          })}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50">السابق</button>
              <span className="text-sm py-1">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50">التالي</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}