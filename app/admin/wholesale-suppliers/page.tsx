"use client";

import { useEffect, useState } from "react";
import {
  Loader2, Building2, CheckCircle2, XCircle, MapPin, Mail, Phone,
  AlertCircle, X,
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
  createdAt: string;
  user: { id: number; name: string; email: string; phone: string | null };
  counts: { sources: number; products: number; orders: number };
};

const ACTIVITY_LABEL: Record<string, string> = {
  COMPANY: "شركة", WORKSHOP: "ورشة", FACTORY: "معمل", WAREHOUSE: "مخزن",
  SHOP: "محل", DISTRIBUTOR: "موزع", INDEPENDENT: "مستقل",
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: "بانتظار", color: "bg-amber-100 text-amber-700" },
  ACTIVE: { label: "نشط", color: "bg-green-100 text-green-700" },
  SUSPENDED: { label: "موقوف", color: "bg-red-100 text-red-700" },
  CLOSED: { label: "مغلق", color: "bg-gray-100 text-gray-700" },
};

export default function AdminWholesaleSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"PENDING" | "ACTIVE" | "ALL">("PENDING");
  const [review, setReview] = useState<Supplier | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const url = filter === "ALL"
        ? "/api/admin/wholesale-suppliers"
        : `/api/admin/wholesale-suppliers?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setSuppliers(data.suppliers || []);
      else setError(data.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  async function action(supplierId: number, act: "approve" | "reject" | "suspend" | "reactivate") {
    setBusyId(supplierId);
    try {
      const res = await fetch(`/api/admin/wholesale-suppliers/${supplierId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.success) { alert(data.message || "فشل الإجراء"); return; }
      setReview(null); setNote("");
      await load();
    } finally { setBusyId(null); }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-black">أصحاب الجملة</h1>
        <p className="mt-1 text-sm text-gray-500">
          راجع طلبات التسجيل ووثّق الحسابات
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {(["PENDING", "ACTIVE", "ALL"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === f ? "bg-[#ff5c00] text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f === "PENDING" ? "بانتظار" : f === "ACTIVE" ? "نشطة" : "الكل"}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <p className="mt-3 text-sm text-gray-500">لا توجد حسابات {filter === "PENDING" ? "بانتظار المراجعة" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suppliers.map((s) => {
            const statusInfo = STATUS_LABEL[s.status] || STATUS_LABEL.PENDING;
            return (
              <div key={s.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black">{s.displayName}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold">
                        {ACTIVITY_LABEL[s.activityType] || s.activityType}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.city}</span>
                      <span className="flex items-center gap-1" dir="ltr"><Mail className="h-3 w-3" />{s.user.email}</span>
                      {s.user.phone && <span className="flex items-center gap-1" dir="ltr"><Phone className="h-3 w-3" />{s.user.phone}</span>}
                    </div>
                    {s.description && (
                      <p className="mt-2 line-clamp-2 text-xs text-gray-600">{s.description}</p>
                    )}
                    <div className="mt-1 text-[10px] text-gray-400">
                      {s.counts.sources} مصدر · {s.counts.products} منتج · {s.counts.orders} طلب
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {s.status === "PENDING" && (
                      <button
                        onClick={() => { setReview(s); setNote(""); }}
                        className="rounded-lg bg-[#ff5c00] px-4 py-2 text-xs font-bold text-white hover:bg-[#e64a00]"
                      >
                        مراجعة
                      </button>
                    )}
                    {s.status === "ACTIVE" && (
                      <button
                        onClick={() => action(s.id, "suspend")}
                        disabled={busyId === s.id}
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                      >
                        إيقاف
                      </button>
                    )}
                    {s.status === "SUSPENDED" && (
                      <button
                        onClick={() => action(s.id, "reactivate")}
                        disabled={busyId === s.id}
                        className="rounded-lg border border-green-200 px-3 py-2 text-xs font-bold text-green-600 hover:bg-green-50"
                      >
                        إعادة تفعيل
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {review && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setReview(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-black">{review.displayName}</h2>
                <p className="text-xs text-gray-500">{ACTIVITY_LABEL[review.activityType]} · {review.city}</p>
              </div>
              <button onClick={() => setReview(null)} className="rounded-full p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-4 space-y-2 text-xs">
              <div><strong>المستخدم:</strong> {review.user.name}</div>
              <div dir="ltr" className="text-left"><strong>Email:</strong> {review.user.email}</div>
              {review.user.phone && <div dir="ltr" className="text-left"><strong>Phone:</strong> {review.user.phone}</div>}
              {review.description && <div><strong>الوصف:</strong> {review.description}</div>}
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-bold">ملاحظة للتاجر (اختياري)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="سبب الرفض أو ملاحظة..."
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => action(review.id, "reject")}
                disabled={busyId === review.id}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100"
              >
                <XCircle className="h-4 w-4" />
                رفض
              </button>
              <button
                onClick={() => action(review.id, "approve")}
                disabled={busyId === review.id}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700"
              >
                {busyId === review.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                موافقة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}