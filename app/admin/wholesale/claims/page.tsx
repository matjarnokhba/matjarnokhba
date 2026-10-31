"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Loader2, CheckCircle2, XCircle, ShieldCheck, ArrowLeft, Package,
  Store, X,
} from "lucide-react";

type ClaimItem = {
  id: number;
  claimType: string;
  claimProofUrl: string | null;
  claimNotes: string | null;
  wholesalePrice: string | number;
  createdAt: string;
  master: {
    id: number;
    name: string;
    brand: string | null;
    images: string[];
    barcode: string | null;
    isVerified: boolean;
  };
  supplier: {
    id: number;
    displayName: string;
    isVerified: boolean;
    activityType: string;
    city: string;
  };
  source: { id: number; name: string; city: string } | null;
};

type Status = "unverified" | "verified";

export default function ClaimsPage() {
  const [items, setItems] = useState<ClaimItem[]>([]);
  const [status, setStatus] = useState<Status>("unverified");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ClaimItem | null>(null);
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/wholesale/claims?status=${status}`);
      const data = await res.json();
      if (data.success) setItems(data.items);
      else setError(data.message || "فشل التحميل");
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleVerify(action: "approve" | "reject") {
    if (!selected) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/wholesale/claims/${selected.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason || null }),
      });
      const data = await res.json();
      if (data.success) {
        setSelected(null);
        setReason("");
        await load();
      } else {
        setError(data.message || "فشل الإجراء");
      }
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/wholesale" className="rounded-lg border p-2 hover:bg-gray-50" aria-label="عودة">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">مراجعة مطالبات الجملة</h1>
          <p className="text-sm text-gray-600">
            مراجعة مطالبات الموردين (MANUFACTURER / BRAND_OWNER) قبل ظهورها في السوق
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setStatus("unverified")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            status === "unverified" ? "bg-orange-500 text-white" : "bg-white border text-gray-700 hover:bg-gray-50"
          }`}
        >
          بانتظار المراجعة
        </button>
        <button
          onClick={() => setStatus("verified")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            status === "verified" ? "bg-green-600 text-white" : "bg-white border text-gray-700 hover:bg-gray-50"
          }`}
        >
          المؤكدة
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg bg-white border p-12 text-center text-gray-500">
          <ShieldCheck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>لا توجد مطالبات {status === "unverified" ? "بانتظار المراجعة" : "مؤكدة"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg bg-white border p-4 flex gap-4">
              <div className="h-20 w-20 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                {item.master.images?.[0] ? (
                  <img src={item.master.images[0]} alt={item.master.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-400">
                    <Package className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{item.master.name}</h3>
                    <p className="text-sm text-gray-600">{item.master.brand || "—"} · {item.claimType}</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Store className="h-3 w-3" />
                      {item.supplier.displayName} · {item.supplier.city}
                      {item.supplier.isVerified && (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <ShieldCheck className="h-3 w-3" /> موثق
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{Number(item.wholesalePrice)} د.م</p>
                    <p className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString("ar-MA")}</p>
                  </div>
                </div>
                {status === "unverified" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => { setSelected(item); setReason(""); }}
                      className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm text-white hover:bg-orange-600"
                    >
                      مراجعة
                    </button>
                    {item.claimProofUrl && (
                      <a
                        href={item.claimProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        الإثبات
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">مراجعة المطالبة</h2>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <p><strong>المنتج:</strong> {selected.master.name}</p>
              <p><strong>المورد:</strong> {selected.supplier.displayName}</p>
              <p><strong>نوع المطالبة:</strong> {selected.claimType}</p>
              {selected.claimNotes && <p><strong>ملاحظات:</strong> {selected.claimNotes}</p>}
              {selected.claimProofUrl && (
                <p>
                  <a href={selected.claimProofUrl} target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">
                    عرض الإثبات
                  </a>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">سبب الرفض (اختياري)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border p-2 text-sm"
                rows={2}
                placeholder="إن رفضت، اذكر السبب"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => handleVerify("reject")}
                disabled={actionLoading}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                رفض
              </button>
              <button
                onClick={() => handleVerify("approve")}
                disabled={actionLoading}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                موافقة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}