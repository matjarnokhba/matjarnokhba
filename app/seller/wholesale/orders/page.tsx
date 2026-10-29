"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, FileText, ArrowLeft, Package, Clock, CheckCircle2, XCircle } from "lucide-react";

type Order = {
  id: number; orderNumber: string; status: string; total: number;
  itemCount: number; buyer: { id: number; name: string };
  createdAt: string;
};

const STATUS_INFO: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: "جديد", color: "bg-amber-100 text-amber-700", icon: Clock },
  ACCEPTED: { label: "مقبول", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  REJECTED: { label: "مرفوض", color: "bg-red-100 text-red-700", icon: XCircle },
  PREPARING: { label: "قيد التجهيز", color: "bg-indigo-100 text-indigo-700", icon: Package },
  READY: { label: "جاهز", color: "bg-purple-100 text-purple-700", icon: Package },
  COMPLETED: { label: "مكتمل", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  CANCELLED: { label: "ملغى", color: "bg-gray-100 text-gray-700", icon: XCircle },
};

export default function SupplierOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const url = filter ? `/api/wholesale/orders?role=supplier&status=${filter}` : "/api/wholesale/orders?role=supplier";
        const res = await fetch(url);
        if (res.status === 401) { router.push("/login"); return; }
        const data = await res.json();
        if (data.success) setOrders(data.orders);
        else setError(data.message);
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [filter, router]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mx-auto max-w-4xl">
        <Link href="/seller/wholesale" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]">
          <ArrowLeft className="h-3.5 w-3.5" /> عودة للبوابة
        </Link>
        <h1 className="mb-6 flex items-center gap-2 text-2xl font-black"><FileText className="h-6 w-6 text-[#ff5c00]" /> الطلبات الواردة</h1>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {["", "PENDING", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "REJECTED", "CANCELLED"].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${filter === s ? "bg-[#ff5c00] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              {s === "" ? "الكل" : STATUS_INFO[s].label}
            </button>
          ))}
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
          <div className="space-y-3">
            {orders.map((o) => {
              const info = STATUS_INFO[o.status] || STATUS_INFO.PENDING;
              const Icon = info.icon;
              return (
                <Link key={o.id} href={`/seller/wholesale/orders/${o.id}`} className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black">{o.orderNumber}</span>
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${info.color}`}><Icon className="h-3 w-3" />{info.label}</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-600">مشتري: {o.buyer.name}</div>
                      <div className="mt-0.5 text-[10px] text-gray-500">{o.itemCount} منتج · {new Date(o.createdAt).toLocaleDateString("ar-MA")}</div>
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-black text-[#ff5c00]">{o.total.toFixed(2)}</div>
                      <div className="text-[10px] text-gray-500">د.م</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}