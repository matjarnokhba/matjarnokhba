"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Package, ShieldCheck, ShieldAlert, Edit, Save, X } from "lucide-react";

type Master = {
  id: number;
  name: string;
  slug: string;
  brand: string | null;
  description: string | null;
  images: string[];
  barcode: string | null;
  qrCode: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  category: { id: number; name: string };
  createdByBusiness: { id: number; name: string; type: string };
  variants: Array<{ id: number; sku: string | null; barcode: string | null; options: any }>;
  _count: { wholesaleOffers: number };
};

export default function MasterDetailPage() {
  const params = useParams();
  const bizId = parseInt(params.id as string);
  const mid = parseInt(params.masterId as string);

  const [loading, setLoading] = useState(true);
  const [master, setMaster] = useState<Master | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/business/${bizId}/masters/${mid}`);
        const d = await res.json();
        if (d.success) {
          setMaster(d.master);
          setName(d.master.name);
          setBrand(d.master.brand || "");
          setDescription(d.master.description || "");
        } else setError(d.message);
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [bizId, mid]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const body: any = {};
      if (name !== master?.name) body.name = name;
      if (brand !== (master?.brand || "")) body.brand = brand || null;
      if (description !== (master?.description || "")) body.description = description || null;
      if (Object.keys(body).length === 0) { setEditing(false); setSaving(false); return; }

      const res = await fetch(`/api/business/${bizId}/masters/${mid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.success) {
        setMaster({ ...master!, ...d.master });
        setEditing(false);
      } else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;
  if (!master) return <div className="max-w-4xl mx-auto p-6"><div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">{error || "المنتج غير موجود"}</div></div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/business/${bizId}/masters`} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{master.name}</h1>
            {master.isVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-green-100 text-green-700"><ShieldCheck className="h-3 w-3" /> موثق</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-700"><ShieldAlert className="h-3 w-3" /> بانتظار التوثيق</span>
            )}
          </div>
          <p className="text-sm text-gray-600">{master.category.name}{master.brand ? ` · ${master.brand}` : ""}</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"><Edit className="h-4 w-4" /> تعديل</button>
        )}
      </div>

      {master.images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {master.images.map((url, i) => (
            <div key={i} className="aspect-square rounded-lg overflow-hidden border bg-gray-100">
              <img src={url} alt={`${master.name} ${i+1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl bg-white border p-5 space-y-4">
        <h2 className="font-semibold">المعلومات</h2>
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">الاسم</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">العلامة التجارية</label>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full rounded-lg border p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الوصف</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border p-2" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="rounded-lg border px-4 py-2 text-sm">إلغاء</button>
              <button onClick={handleSave} disabled={saving} className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                حفظ
              </button>
            </div>
          </div>
        ) : (
          <dl className="space-y-2 text-sm">
            {master.description && <div><dt className="text-gray-500">الوصف:</dt> <dd className="whitespace-pre-wrap">{master.description}</dd></div>}
            {master.barcode && <div><dt className="text-gray-500">الباركود:</dt> <dd className="font-mono">{master.barcode}</dd></div>}
            {master.qrCode && <div><dt className="text-gray-500">QR:</dt> <dd className="font-mono">{master.qrCode}</dd></div>}
            <div><dt className="text-gray-500">العروض النشطة:</dt> <dd>{master._count.wholesaleOffers}</dd></div>
          </dl>
        )}
      </div>

      <div className="rounded-xl bg-white border p-5">
        <h2 className="font-semibold mb-3">المتغيرات ({master.variants.length})</h2>
        <div className="space-y-2">
          {master.variants.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">
                  {v.options ? Object.entries(v.options).map(([k, val]) => `${k}: ${val}`).join(" / ") : `المتغير #${v.id}`}
                </p>
                <p className="text-xs text-gray-500 font-mono">
                  {v.sku && `SKU: ${v.sku}`}{v.sku && v.barcode && " · "}{v.barcode && `باركود: ${v.barcode}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
    </div>
  );
}