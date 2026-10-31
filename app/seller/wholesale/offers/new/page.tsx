"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2, Search, ArrowLeft, Package, AlertCircle,
  CheckCircle2, X, Plus,
} from "lucide-react";
import QRCodeInput from "@/components/shared/QRCodeInput";

type Master = {
  id: number; name: string; slug: string; brand: string | null;
  barcode: string | null; images: string[]; isVerified: boolean;
  category: { id: number; name: string; slug: string };
  variants: Array<{ id: number; barcode: string | null; sku: string | null; options: any }>;
};

type Source = { id: number; name: string; city: string; type: string };
type CodeType = "BARCODE" | "QR";
type Step = 1 | 2 | 3;

export default function NewOfferPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preMasterId = searchParams.get("masterId");
  const preProductId = searchParams.get("productId");

  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingMaster, setLoadingMaster] = useState(!!(searchParams.get("productId") || searchParams.get("masterId")));
  const [master, setMaster] = useState<Master | null>(null);
  const [codeValue, setCodeValue] = useState("");
  const [codeType, setCodeType] = useState<CodeType>("BARCODE");
  const [searchName, setSearchName] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Master[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [minOrderQty, setMinOrderQty] = useState("1");
  const [maxOrderQty, setMaxOrderQty] = useState("");
  const [unit, setUnit] = useState("PIECE");
  const [sourceId, setSourceId] = useState<string>("");
  const [claimType, setClaimType] = useState("DISTRIBUTOR");
  const [claimNotes, setClaimNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [variantStocks, setVariantStocks] = useState<Record<number, number>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/wholesale/sources");
        const d = await res.json();
        if (d.success) setSources(d.sources);
      } catch {}
    })();
  }, []);

  // Pre-load master from productId (via ensure-master endpoint)
  useEffect(() => {
  if (!preProductId) return;
  if (preMasterId) return;
  (async () => {
    try {
      // Ensure master exists (creates it if missing, preserves barcode)
      const emRes = await fetch(
        `/api/seller/products/${preProductId}/ensure-master`,
        { method: "POST" }
      );
      const emData = await emRes.json();
      if (!emData.success || !emData.masterId) {
        setError(emData.message || "تعذر تحميل هوية المنتج");
        return;
      }
      // Load full master
      const mRes = await fetch(`/api/products/master/${emData.masterId}`);
      const mData = await mRes.json();
      if (mData.success) {
        setMaster(mData.master);
        setStep(2);
      } else {
        setError(mData.message || "تعذر تحميل بيانات المنتج");
      }
    } catch {
      setError("خطأ في الاتصال");
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preProductId, preMasterId]);
  useEffect(() => {
    if (preMasterId) {
      (async () => {
        try {
          const res = await fetch(`/api/products/master/${preMasterId}`);
          const d = await res.json();
          if (d.success) { setMaster(d.master); setStep(2); }
        } catch {}
        finally {
          setLoadingMaster(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preMasterId]);

  async function searchByCode() {
    if (!codeValue.trim()) return;
    setSearching(true); setError(""); setNotFound(false); setSearchResults([]);
    try {
      const res = await fetch("/api/products/master/lookup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeValue.trim(), codeType }),
      });
      const d = await res.json();
      if (d.success && d.found) {
        setMaster(d.master); setStep(2);
      } else {
        setNotFound(true);
      }
    } catch { setError("خطأ في الاتصال"); }
    finally { setSearching(false); }
  }

  async function searchByName() {
    if (!searchName.trim()) return;
    setSearching(true); setError(""); setNotFound(false);
    try {
      const res = await fetch(`/api/wholesale/browse?search=${encodeURIComponent(searchName.trim())}&pageSize=20`);
      const d = await res.json();
      if (d.success) {
        const map = new Map<number, Master>();
        for (const o of d.offers) map.set(o.master.id, { ...o.master, isVerified: false, variants: [] } as Master);
        setSearchResults(Array.from(map.values()));
      }
    } catch { setError("خطأ في الاتصال"); }
    finally { setSearching(false); }
  }

  async function selectMaster(m: Master) {
    setSearching(true); setError("");
    try {
      const res = await fetch(`/api/products/master/${m.id}`);
      const d = await res.json();
      if (d.success) { setMaster(d.master); setStep(2); }
    } catch { setError("خطأ في الاتصال"); }
    finally { setSearching(false); }
  }

  function goToCreateMaster() {
    const params = new URLSearchParams();
    if (codeType === "QR") params.set("qr", codeValue.trim());
    else params.set("barcode", codeValue.trim());
    router.push(`/seller/wholesale/masters/new?${params.toString()}`);
  }

  function nextToStep3() {
    if (!wholesalePrice || Number(wholesalePrice) <= 0) { setError("السعر مطلوب"); return; }
    if (!minOrderQty || Number(minOrderQty) < 1) { setError("الحد الأدنى مطلوب"); return; }
    setError(""); setStep(3);
  }

  async function submit() {
    if (!master) return;
    setError(""); setSaving(true);
    try {
      const variants = master.variants.map((v) => ({ masterVariantId: v.id, stock: variantStocks[v.id] || 0 }));
      const res = await fetch("/api/wholesale/offers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterId: master.id,
          productId: preProductId ? parseInt(preProductId) : null,
          sourceId: sourceId ? parseInt(sourceId) : null,
          wholesalePrice: Number(wholesalePrice), retailPrice: retailPrice ? Number(retailPrice) : null,
          minOrderQty: Number(minOrderQty), maxOrderQty: maxOrderQty ? Number(maxOrderQty) : null,
          unit, claimType, claimNotes: claimNotes.trim() || null, notes: notes.trim() || null, variants,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.message || "فشل");
        return;
      }
      router.push("/seller/wholesale/offers");
    } catch { setError("خطأ في الاتصال"); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mx-auto max-w-2xl">
        <Link href="/seller/wholesale/offers" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]">
          <ArrowLeft className="h-3.5 w-3.5" /> عودة للعروض
        </Link>
        <h1 className="mb-1 text-2xl font-black">عرض جملة جديد</h1>
        <p className="mb-6 text-sm text-gray-500">
          المرحلة {step} من 3 — {step === 1 ? "اختر المنتج" : step === 2 ? "السعر والكمية" : "المخزون والتفاصيل"}
        </p>

        {loadingMaster && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
          </div>
        )}

        {!loadingMaster && step === 1 && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <QRCodeInput
                value={codeValue}
                codeType={codeType}
                onChange={(v, t) => { setCodeValue(v); setCodeType(t); setNotFound(false); }}
                label="بحث بالباركود أو QR"
                helperText="امسح بالكاميرا أو اكتب يدويًا"
                placeholder="امسح أو اكتب..."
              />
              <div className="mt-3">
                <button onClick={searchByCode} disabled={searching || !codeValue.trim()} className="flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2 text-sm font-bold text-white hover:bg-[#e64a00] disabled:opacity-50">
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  بحث
                </button>
              </div>
            </div>

            {notFound && (
              <div className="rounded-xl bg-amber-50 p-4 text-xs text-amber-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex-1">
                    <strong>لم يُعثر على منتج بهذا الكود</strong>
                    <p className="mt-1">أنشئ هوية منتج جديدة بالكود المُدخل:</p>
                    <button onClick={goToCreateMaster} className="mt-2 flex items-center gap-1 rounded-lg bg-amber-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-800">
                      <Plus className="h-3 w-3" /> أنشئ منتجًا جديدًا بهذا الكود
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-black"><Search className="h-4 w-4 text-[#ff5c00]" /> أو ابحث بالاسم</h2>
              <div className="flex gap-2">
                <input type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchByName()} placeholder="اسم المنتج..." className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" />
                <button onClick={searchByName} disabled={searching} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">بحث</button>
              </div>
              {searchResults.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {searchResults.map((m) => (
                    <button key={m.id} onClick={() => selectMaster(m)} className="w-full rounded-lg border border-gray-200 bg-white p-2 text-right hover:bg-gray-50">
                      <div className="text-xs font-bold">{m.name}</div>
                      <div className="text-[10px] text-gray-500">{m.category?.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}
          </div>
        )}

        {step === 2 && master && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {master.images[0] ? <img src={master.images[0]} alt="" className="h-full w-full object-cover" /> : <Package className="h-6 w-6 m-auto text-gray-300" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black">{master.name}</div>
                  <div className="text-[10px] text-gray-500">{master.category?.name} · {master.brand || "—"}</div>
                </div>
                <button onClick={() => { setMaster(null); setStep(1); }} className="rounded-full p-1 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="mb-1 block text-xs font-bold">سعر الجملة (د.م) *</label><input type="number" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} min="0.01" step="0.01" placeholder="100" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" /></div>
                <div><label className="mb-1 block text-xs font-bold">سعر التجزئة</label><input type="number" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} min="0.01" step="0.01" placeholder="150" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" /></div>
                <div><label className="mb-1 block text-xs font-bold">الحد الأدنى *</label><input type="number" value={minOrderQty} onChange={(e) => setMinOrderQty(e.target.value)} min="1" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" /></div>
                <div><label className="mb-1 block text-xs font-bold">الحد الأقصى</label><input type="number" value={maxOrderQty} onChange={(e) => setMaxOrderQty(e.target.value)} min="1" placeholder="بدون حد" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" /></div>
                <div><label className="mb-1 block text-xs font-bold">الوحدة</label><select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]"><option value="PIECE">قطعة</option><option value="PAIR">زوج</option><option value="SET">مجموعة</option><option value="PACK">عبوة</option><option value="BOX">صندوق</option><option value="KG">كيلوغرام</option><option value="GRAM">غرام</option><option value="LITER">لتر</option><option value="ML">مليلتر</option></select></div>
                <div><label className="mb-1 block text-xs font-bold">المصدر</label><select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]"><option value="">— بدون —</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.city})</option>)}</select></div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">ادعاء المصدر</label>
                <select value={claimType} onChange={(e) => setClaimType(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]">
                  <option value="MANUFACTURER">أنا المصنع</option>
                  <option value="DISTRIBUTOR">موزع معتمد</option>
                  <option value="RESELLER">إعادة بيع</option>
                </select>
                {claimType !== "MANUFACTURER" && <input type="text" value={claimNotes} onChange={(e) => setClaimNotes(e.target.value)} placeholder="تفاصيل إضافية (اختياري)" className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-[#ff5c00]" />}
              </div>
              <div><label className="mb-1 block text-xs font-bold">ملاحظات للتجار</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="شروط، تعليمات..." className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]" /></div>
            </div>

            {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-bold">السابق</button>
              <button onClick={nextToStep3} className="flex-1 rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white hover:bg-[#e64a00]">التالي</button>
            </div>
          </div>
        )}

        {step === 3 && master && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-black">مخزون المتغيرات</h2>
              {master.variants.length === 0 ? (
                <p className="text-xs text-gray-500">لا توجد variants. سيُستخدم المخزون الافتراضي.</p>
              ) : (
                <div className="space-y-2">
                  {master.variants.map((v) => (
                    <div key={v.id} className="flex items-center gap-3 rounded-lg bg-gray-50 p-2">
                      <div className="flex-1 text-xs">{v.sku || `Variant #${v.id}`}{v.barcode && ` · ${v.barcode}`}</div>
                      <input type="number" value={variantStocks[v.id] || 0} onChange={(e) => setVariantStocks({ ...variantStocks, [v.id]: parseInt(e.target.value) || 0 })} min="0" className="w-20 rounded border border-gray-200 px-2 py-1 text-xs" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            {error && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>}
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-bold">السابق</button>
              <button onClick={submit} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} إنشاء العرض
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}