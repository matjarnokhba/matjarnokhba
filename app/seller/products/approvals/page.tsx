"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle, Package, User, AlertTriangle } from "lucide-react";

type Pending = {
  id: number; name: string; description: string | null; image: string | null;
  price: number; categoryName: string; createdAt: string; staffName: string;
};

export default function ApprovalsPage() {
  const [products, setProducts] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/seller/products/approvals", { cache: "no-store" });
      const data = await res.json();
      if (data.success) setProducts(data.products || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function handle(id: number, action: "approve" | "reject") {
    setBusyId(id);
    try {
      const res = await fetch("/api/seller/products/approvals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id, action }),
      });
      const data = await res.json();
      if (data.success) setProducts((p) => p.filter((x) => x.id !== id));
      else alert(data.message);
    } catch { alert("خطأ"); } finally { setBusyId(null); }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <AlertTriangle className="h-6 w-6 text-[#ff5c00]" />
          منتجات بانتظار الموافقة
        </h1>
        <p className="mt-1 text-sm text-gray-500">منتجات أضافها موظفوك وتحتاج موافقتك</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" /></div>
      ) : products.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <p className="mt-3 text-sm text-gray-500">لا توجد منتجات بانتظار الموافقة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-2xl border-2 border-amber-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start gap-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {p.image ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" /> : (
                    <div className="flex h-full w-full items-center justify-center"><Package className="h-8 w-8 text-gray-300" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black">{p.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                    <span className="rounded bg-gray-100 px-2 py-0.5">{p.categoryName}</span>
                    <span className="font-bold text-[#ff5c00]">{p.price.toFixed(2)} د.م</span>
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />{p.staffName}</span>
                  </div>
                  {p.description && <p className="mt-2 line-clamp-2 text-[11px] text-gray-600">{p.description}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link href={`/seller/products/${p.id}`} className="flex h-9 items-center rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-700 hover:bg-gray-50">عرض</Link>
                  <button onClick={() => handle(p.id, "approve")} disabled={busyId === p.id} className="flex h-9 items-center gap-1 rounded-lg bg-green-600 px-3 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50">
                    {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} موافقة
                  </button>
                  <button onClick={() => handle(p.id, "reject")} disabled={busyId === p.id} className="flex h-9 items-center gap-1 rounded-lg border-2 border-red-500 bg-red-50 px-3 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">
                    <XCircle className="h-4 w-4" /> رفض
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
