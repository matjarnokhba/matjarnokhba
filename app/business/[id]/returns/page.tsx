"use client";
import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, RotateCcw, TrendingDown, TrendingUp, Clock, CheckCircle2, XCircle, Package, DollarSign } from "lucide-react";

type Return = {
  id: number;
  returnNumber: string;
  status: string;
  reason: string;
  totalAmount: number;
  approvedAmount: number | null;
  createdAt: string;
  buyerBusiness: { id: number; name: string; logo: string | null };
  sellerBusiness: { id: number; name: string; logo: string | null };
  order: { id: number; orderNumber: string };
  _count: { items: number };
};

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  REQUESTED: { label: "بانتظار القرار", color: "bg-amber-100 text-amber-700", Icon: Clock },
  APPROVED: { label: "مقبول", color: "bg-blue-100 text-blue-700", Icon: CheckCircle2 },
  REJECTED: { label: "مرفوض", color: "bg-red-100 text-red-700", Icon: XCircle },
  RECEIVED: { label: "مستلم", color: "bg-purple-100 text-purple-700", Icon: Package },
  REFUNDED: { label: "مسترد", color: "bg-green-100 text-green-700", Icon: DollarSign },
  CANCELLED: { label: "ملغى", color: "bg-gray-200 text-gray-700", Icon: XCircle },
};

const REASON_LABEL: Record<string, string> = {
  DAMAGED: "منتج تالف", WRONG_PRODUCT: "منتج مختلف", NOT_AS_DESCRIBED: "مخالف للوصف", QUALITY_ISSUE: "مشكلة جودة", OTHER: "أخرى",
};

function ReturnsList() {
  const params = useParams();
  const search = useSearchParams();
  const bizId = parseInt(params.id as string);
  const initialSide = (search.get("side") || "buyer") as "buyer" | "seller";

  const [side, setSide] = useState<"buyer" | "seller">(initialSide);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Return[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true); setError("");
      try {
        const q = new URLSearchParams({ side });
        if (statusFilter) q.set("status", statusFilter);
        const res = await fetch(`/api/business/${bizId}/returns?${q}`);
        const d = await res.json();
        if (d.success) { setItems(d.items); setTotal(d.total); }
        else setError(d.message);
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [bizId, side, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><RotateCcw className="h-6 w-6 text-orange-500" /> المرتجعات</h2>
          <p className="text-sm text-gray-600">{total} مرتجع</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setSide("buyer")} className={`flex-1 rounded-lg border p-3 flex items-center justify-center gap-2 ${side === "buyer" ? "bg-orange-500 text-white border-orange-500" : "hover:bg-gray-50"}`}>
          <TrendingDown className="h-5 w-5" />
          <div className="text-right"><p className="font-semibold">طلباتي</p><p className="text-xs opacity-80">مرتجعات أنشأتها</p></div>
        </button>
        <button onClick={() => setSide("seller")} className={`flex-1 rounded-lg border p-3 flex items-center justify-center gap-2 ${side === "seller" ? "bg-orange-500 text-white border-orange-500" : "hover:bg-gray-50"}`}>
          <TrendingUp className="h-5 w-5" />
          <div className="text-right"><p className="font-semibold">مرتجعات عليّ</p><p className="text-xs opacity-80">مطالبات من مشترين</p></div>
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
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-white border p-12 text-center">
          <RotateCcw className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600">لا توجد مرتجعات</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => {
            const st = STATUS_CONFIG[r.status] || STATUS_CONFIG.REQUESTED;
            const StIcon = st.Icon;
            const counterparty = side === "buyer" ? r.sellerBusiness : r.buyerBusiness;
            return (
              <Link key={r.id} href={`/business/${bizId}/returns/${r.id}?side=${side}`}
                className="block rounded-xl bg-white border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {counterparty.logo ? <img src={counterparty.logo} alt="" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-gray-400"><RotateCcw className="h-6 w-6" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-gray-500">{r.returnNumber}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${st.color}`}><StIcon className="h-3 w-3" />{st.label}</span>
                    </div>
                    <p className="font-semibold mt-1">{side === "buyer" ? "إلى" : "من"}: {counterparty.name}</p>
                    <p className="text-xs text-gray-500">
                      {REASON_LABEL[r.reason] || r.reason} · {r._count.items} منتج · طلب <span className="font-mono">{r.order.orderNumber}</span>
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg text-orange-600">{r.approvedAmount != null ? Number(r.approvedAmount) : Number(r.totalAmount)} <span className="text-sm">د.م</span></p>
                    {r.approvedAmount != null && Number(r.approvedAmount) !== Number(r.totalAmount) && <p className="text-xs text-gray-400 line-through">{Number(r.totalAmount)}</p>}
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

export default function Page() {
  return <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>}><ReturnsList /></Suspense>;
}