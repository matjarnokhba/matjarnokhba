"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, ArrowLeft, Save, AlertCircle, Image as ImageIcon, Package, Shield,
} from "lucide-react";
import ImageUploader from "@/components/admin/ImageUploader";
import QRCodeInput from "@/components/shared/QRCodeInput";

type Category = { id: number; name: string; parentId: number | null; level: number };
type CodeType = "BARCODE" | "QR";
type Master = {
  id: number;
  name: string;
  slug: string;
  brand: string | null;
  description: string | null;
  images: string[];
  barcode: string | null;
  qrCode: string | null;
  category: { id: number; name: string; slug: string };
  isVerified: boolean;
  status: string;
  isOwner: boolean;
};

export default function EditMasterPage() {
  const params = useParams();
  const router = useRouter();
  const masterId = parseInt(params.id as string);

  const [master, setMaster] = useState<Master | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [codeValue, setCodeValue] = useState("");
  const [codeType, setCodeType] = useState<CodeType>("BARCODE");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [parentCategoryId, setParentCategoryId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const [mRes, cRes] = await Promise.all([
          fetch(`/api/products/master/${masterId}`),
          fetch("/api/seller/categories"),
        ]);
        if (mRes.status === 401) { router.push("/login"); return; }
        const mData = await mRes.json();
        const cData = await cRes.json();
        if (!mData.success) { setError(mData.message); return; }
        const m: Master = mData.master;
        setMaster(m);
        setName(m.name);
        setBrand(m.brand || "");
        setDescription(m.description || "");
        // Determine code type from existing data
        if (m.qrCode) {
          setCodeType("QR");
          setCodeValue(m.qrCode);
        } else if (m.barcode) {
          setCodeType("BARCODE");
          setCodeValue(m.barcode);
        }
        setImageUrls(m.images);
        setCategoryId(m.category.id.toString());
        if (cData.success) {
          setCategories(cData.categories);
          const parent = cData.categories.find((c: Category) => c.id === m.category.id)?.parentId;
          if (parent) setParentCategoryId(parent.toString());
        }
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [masterId, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) { setError("الفئة مطلوبة"); return; }
    setError(""); setSaving(true);
    try {
      const res = await fetch(`/api/products/master/${masterId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          brand: brand.trim() || null,
          description: description.trim() || null,
          barcode: codeType === "BARCODE" ? (codeValue.trim() || null) : null,
          qrCode: codeType === "QR" ? (codeValue.trim() || null) : null,
          categoryId: parseInt(categoryId),
          images: imageUrls,
        }),
      });
      const d = await res.json();
      if (!d.success) { setError(d.message); return; }
      router.push("/seller/wholesale/masters");
      router.refresh();
    } catch { setError("خطأ في الاتصال"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" /></div>;
  if (error && !master) return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mx-auto max-w-md rounded-xl bg-red-50 p-6 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
        <p className="mt-3 text-sm font-bold text-red-700">{error}</p>
        <Link href="/seller/wholesale/masters" className="mt-4 inline-block rounded-lg bg-[#ff5c00] px-4 py-2 text-sm font-bold text-white">عودة</Link>
      </div>
    </div>
  );
  if (!master) return null;
  if (!master.isOwner) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
        <div className="mx-auto max-w-md rounded-xl bg-amber-50 p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-600" />
          <p className="mt-3 text-sm font-bold text-amber-800">هذه الهوية لمنشئ آخر — لا يمكنك تعديلها.</p>
          <Link href="/seller/wholesale/masters" className="mt-4 inline-block rounded-lg bg-[#ff5c00] px-4 py-2 text-sm font-bold text-white">عودة</Link>
        </div>
      </div>
    );
  }

  const rootCats = categories.filter((c) => c.parentId === null);
  const childCats = parentCategoryId ? categories.filter((c) => c.parentId === parseInt(parentCategoryId)) : [];

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mx-auto max-w-2xl">
        <Link href="/seller/wholesale/masters" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]">
          <ArrowLeft className="h-3.5 w-3.5" /> عودة للهويات
        </Link>
        <div className="mb-6 flex items-center gap-3">
          <Package className="h-8 w-8 text-[#ff5c00]" />
          <div>
            <h1 className="text-xl font-black">تعديل الهوية</h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500 font-mono">{master.slug}</p>
              {master.isVerified && (
                <span className="flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                  <Shield className="h-2.5 w-2.5" /> موثق
                </span>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl bg-white p-5 shadow-sm space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold">الاسم *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">الماركة</label>
              <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={80} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">الوصف</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" />
            </div>
            <div>
              <QRCodeInput
                value={codeValue}
                codeType={codeType}
                onChange={(v, t) => { setCodeValue(v); setCodeType(t); }}
                label="الباركود أو QR"
                helperText="عدّل الكود الحالي أو امسح كودًا جديدًا"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">الفئة الرئيسية *</label>
              <select value={parentCategoryId} onChange={(e) => { setParentCategoryId(e.target.value); setCategoryId(""); }} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]">
                <option value="">— اختر —</option>
                {rootCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {parentCategoryId && (
              <div>
                <label className="mb-1 block text-xs font-bold">الفئة الفرعية *</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]">
                  <option value="">— اختر —</option>
                  {childCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <label className="mb-2 flex items-center gap-2 text-xs font-bold">
              <ImageIcon className="h-3.5 w-3.5" /> الصور
            </label>
            <ImageUploader value={imageUrls} onChange={(urls) => setImageUrls(urls)} />
          </div>

          {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}

          <div className="flex gap-2">
            <Link href="/seller/wholesale/masters" className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-bold">إلغاء</Link>
            <button type="submit" disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white hover:bg-[#e64a00] disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}