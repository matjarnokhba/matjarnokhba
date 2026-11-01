"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Package, Plus, X, Check } from "lucide-react";

type Master = {
  id: number;
  name: string;
  brand: string | null;
  images: string[];
  barcode: string | null;
  isVerified: boolean;
  _count: { variants: number };
};

type MasterVariant = { id: number; sku: string | null; barcode: string | null; options: any };
type MasterDetail = Master & { variants: MasterVariant[] };
type TierInput = { minQty: string; maxQty: string; unitPrice: string };
type VariantStockInput = { masterVariantId: number; stock: string };

const SA_TYPE_LABEL: Record<string, string> = {
  TRADER: "تاجر جملة", FACTORY: "مصنع", COMPANY: "شركة", SUPPLIER: "مورد", IMPORTER: "مستورد",
};
const CLAIM_FROM_SA: Record<string, string> = {
  TRADER: "RESELLER", FACTORY: "MANUFACTURER", COMPANY: "DISTRIBUTOR",
  SUPPLIER: "DISTRIBUTOR", IMPORTER: "IMPORTER",
};

const CLAIM_OPTIONS = [
  { value: "MANUFACTURER", label: "مصنع (أنا المنتج)" },
  { value: "DISTRIBUTOR", label: "موزع" },
  { value: "IMPORTER", label: "مستورد" },
  { value: "RESELLER", label: "معيد بيع" },
];

export default function NewOfferPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const bizId = parseInt(params.id as string);
  const preMasterId = search.get("masterId") ? parseInt(search.get("masterId")!) : null;

  const [step, setStep] = useState<"pick" | "configure">("pick");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [masters, setMasters] = useState<Master[]>([]);
  const [mastersLoading, setMastersLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  const [selectedMaster, setSelectedMaster] = useState<MasterDetail | null>(null);
  const [masterLoading, setMasterLoading] = useState(false);

  const [wholesalePrice, setWholesalePrice] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [minOrderQty, setMinOrderQty] = useState("1");
  const [maxOrderQty, setMaxOrderQty] = useState("");
  const [unit, setUnit] = useState("PIECE");
    type SAOption = { id: number; type: string; name: string; status: string };
  const [supplyActivities, setSupplyActivities] = useState<SAOption[]>([]);
  const [selectedSAId, setSelectedSAId] = useState<number | null>(null);
  const [claimProofUrl, setClaimProofUrl] = useState("");
  const [claimNotes, setClaimNotes] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("3");
  const [notes, setNotes] = useState("");
  const [tiers, setTiers] = useState<TierInput[]>([]);
  const [variantStocks, setVariantStocks] = useState<VariantStockInput[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/business/${bizId}/masters?pageSize=100`);
        const d = await res.json();
        if (d.success) setMasters(d.items);
      } catch {}
      finally { setMastersLoading(false); }
    })();
  }, [bizId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/business/${bizId}/supply-activities`);
        const d = await res.json();
        if (d.success) {
          setSupplyActivities(d.activities || []);
          const firstVerified = (d.activities || []).find((sa: any) => sa.status === "VERIFIED");
          if (firstVerified) setSelectedSAId(firstVerified.id);
        }
      } catch {}
    })();
  }, [bizId]);

  useEffect(() => {
    if (!preMasterId || selectedMaster) return;
    loadMaster(preMasterId);
  }, [preMasterId]);

  async function loadMaster(mid: number) {
    setMasterLoading(true);
    setError("");
    if (!selectedSAId) return setError("اختر الهوية التجارية البائعة");
    try {
      const res = await fetch(`/api/business/${bizId}/masters/${mid}`);
      const d = await res.json();
      if (d.success) {
        setSelectedMaster(d.master);
        setVariantStocks(d.master.variants.map((v: MasterVariant) => ({ masterVariantId: v.id, stock: "0" })));
        setStep("configure");
      } else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setMasterLoading(false); }
  }

  function addTier() {
    setTiers([...tiers, { minQty: "", maxQty: "", unitPrice: "" }]);
  }
  function updateTier(i: number, field: keyof TierInput, value: string) {
    const copy = [...tiers]; copy[i] = { ...copy[i], [field]: value }; setTiers(copy);
  }
  function removeTier(i: number) { setTiers(tiers.filter((_, idx) => idx !== i)); }

  function updateStock(i: number, value: string) {
    const copy = [...variantStocks]; copy[i] = { ...copy[i], stock: value }; setVariantStocks(copy);
  }

  async function handleSubmit() {
    setError("");
    if (!selectedSAId) return setError("اختر الهوية التجارية البائعة");
    if (!selectedMaster) return;
    const wp = parseFloat(wholesalePrice);
    if (!wp || wp <= 0) return setError("سعر الجملة مطلوب");
    const moq = parseInt(minOrderQty);
    if (!moq || moq < 1) return setError("الحد الأدنى للطلب غير صحيح");

    const parsedTiers = tiers.map((t) => ({
      minQty: parseInt(t.minQty) || 0,
      maxQty: t.maxQty.trim() ? parseInt(t.maxQty) : null,
      unitPrice: parseFloat(t.unitPrice) || 0,
    }));
    if (parsedTiers.some(t => t.minQty < 1 || t.unitPrice <= 0)) {
      return setError("يرجى تعبئة جميع الشرائح بشكل صحيح");
    }

    const parsedVariants = variantStocks.map((v) => ({
      masterVariantId: v.masterVariantId,
      stock: parseInt(v.stock) || 0,
    }));
    if (parsedVariants.every(v => v.stock === 0)) {
      return setError("يجب إدخال مخزون لمتغير واحد على الأقل");
    }

    setLoading(true);
    try {
      const body: any = {
        masterId: selectedMaster.id,
        supplyActivityId: selectedSAId,
        wholesalePrice: wp,
        minOrderQty: moq,
        unit,
        tiers: parsedTiers,
        variants: parsedVariants,
      };
      if (retailPrice.trim()) body.retailPrice = parseFloat(retailPrice);
      if (maxOrderQty.trim()) body.maxOrderQty = parseInt(maxOrderQty);
      if (claimProofUrl.trim()) body.claimProofUrl = claimProofUrl.trim();
      if (claimNotes.trim()) body.claimNotes = claimNotes.trim();
      if (leadTimeDays.trim()) body.leadTimeDays = parseInt(leadTimeDays);
      if (notes.trim()) body.notes = notes.trim();

      const res = await fetch(`/api/business/${bizId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.success) router.push(`/business/${bizId}/offers/${d.offer.id}`);
      else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }

  const filteredMasters = masters.filter(m =>
    !searchText || m.name.toLowerCase().includes(searchText.toLowerCase()) || (m.brand || "").toLowerCase().includes(searchText.toLowerCase())
  );

  if (step === "pick") {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/business/${bizId}/offers`} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-2xl font-bold">عرض جديد — اختر منتجًا</h1>
            <p className="text-sm text-gray-600">اختر منتجًا من منتجاتك لإنشاء عرض جملة</p>
          </div>
        </div>
        <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="ابحث..." className="w-full rounded-lg border p-2" />
        {mastersLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
        ) : masters.length === 0 ? (
          <div className="rounded-xl bg-white border p-12 text-center">
            <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 mb-4">لا توجد منتجات</p>
            <Link href={`/business/${bizId}/masters/new`} className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-white text-sm">إضافة منتج أولاً</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredMasters.map((m) => (
              <button key={m.id} onClick={() => loadMaster(m.id)} disabled={masterLoading}
                className="rounded-xl bg-white border p-3 text-right hover:shadow-md transition-shadow disabled:opacity-50">
                <div className="flex gap-3">
                  <div className="h-16 w-16 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                    {m.images?.[0] ? <img src={m.images[0]} alt={m.name} className="w-full h-full object-cover" /> : <Package className="h-full w-full text-gray-300 p-2" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm line-clamp-2">{m.name}</h3>
                    {m.brand && <p className="text-xs text-gray-500">{m.brand}</p>}
                    <p className="text-xs text-gray-500 mt-1">{m._count.variants} متغير</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!selectedMaster) return null;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => { setStep("pick"); setSelectedMaster(null); }} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="text-2xl font-bold">عرض جديد</h1>
          <p className="text-sm text-gray-600">{selectedMaster.name}{selectedMaster.brand && ` · ${selectedMaster.brand}`}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white border p-5 space-y-4">
        <h2 className="font-semibold">السعر والكمية</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">سعر الجملة *</label>
            <input type="number" step="0.01" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} className="w-full rounded-lg border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">سعر التجزئة المقترح</label>
            <input type="number" step="0.01" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} className="w-full rounded-lg border p-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">الحد الأدنى *</label>
            <input type="number" min="1" value={minOrderQty} onChange={(e) => setMinOrderQty(e.target.value)} className="w-full rounded-lg border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">الحد الأقصى</label>
            <input type="number" min="1" value={maxOrderQty} onChange={(e) => setMaxOrderQty(e.target.value)} className="w-full rounded-lg border p-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">الوحدة</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-lg border p-2">
              <option value="PIECE">قطعة</option><option value="BOX">علبة</option><option value="PACK">حزمة</option>
              <option value="KG">كيلوغرام</option><option value="LITER">لتر</option><option value="DOZEN">دستة</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">مدة التجهيز (أيام)</label>
            <input type="number" min="0" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} className="w-full rounded-lg border p-2" />
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">شرائح الأسعار (اختياري)</h2>
          <button onClick={addTier} className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 flex items-center gap-1"><Plus className="h-4 w-4" /> إضافة</button>
        </div>
        {tiers.length === 0 && <p className="text-xs text-gray-500">تُستخدم الأسعار المتدرجة للكميات الكبيرة</p>}
        {tiers.map((t, i) => (
          <div key={i} className="rounded-lg border p-3 bg-gray-50">
            <div className="flex justify-between items-center mb-2"><p className="text-xs font-medium">شريحة #{i+1}</p><button onClick={() => removeTier(i)} className="text-red-500"><X className="h-4 w-4" /></button></div>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" placeholder="من" value={t.minQty} onChange={(e) => updateTier(i, "minQty", e.target.value)} className="rounded border p-1.5 text-sm" />
              <input type="number" placeholder="إلى (اختياري)" value={t.maxQty} onChange={(e) => updateTier(i, "maxQty", e.target.value)} className="rounded border p-1.5 text-sm" />
              <input type="number" step="0.01" placeholder="سعر الوحدة" value={t.unitPrice} onChange={(e) => updateTier(i, "unitPrice", e.target.value)} className="rounded border p-1.5 text-sm" />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white border p-5 space-y-3">
        <h2 className="font-semibold">المخزون لكل متغير *</h2>
        {variantStocks.map((v, i) => {
          const mv = selectedMaster.variants.find(m => m.id === v.masterVariantId);
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{mv?.options ? Object.entries(mv.options).map(([k, val]) => `${k}: ${val}`).join(" / ") : `المتغير #${v.masterVariantId}`}</p>
                {mv?.sku && <p className="text-xs text-gray-500 font-mono">{mv.sku}</p>}
              </div>
              <input type="number" min="0" value={v.stock} onChange={(e) => updateStock(i, e.target.value)} className="w-24 rounded-lg border p-2" placeholder="الكمية" />
            </div>
          );
        })}
      </div>

      <div className="rounded-xl bg-white border p-5 space-y-3">
        <h2 className="font-semibold">الهوية التجارية البائعة</h2>
        <p className="text-xs text-gray-600">اختر الهوية التجارية التي تبيع من خلالها. سيتم تحديد نوع المطالبة تلقائيًا.</p>
        {supplyActivities.length === 0 ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            لا توجد هويات موثقة. أضف هوية تجارية من صفحة "الهويات" أولاً.
          </div>
        ) : (
          <div className="space-y-2">
            {supplyActivities.filter(sa => sa.status === "VERIFIED").map((sa) => (
              <label key={sa.id} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${selectedSAId === sa.id ? "border-orange-500 bg-orange-50" : "hover:bg-gray-50"}`}>
                <input type="radio" name="sa" checked={selectedSAId === sa.id} onChange={() => setSelectedSAId(sa.id)} className="mt-1" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{sa.name}</p>
                  <p className="text-xs text-gray-500">
                    {SA_TYPE_LABEL[sa.type] || sa.type} · المطالبة التلقائية: <span className="font-mono">{CLAIM_FROM_SA[sa.type] || "—"}</span>
                  </p>
                </div>
              </label>
            ))}
            {supplyActivities.filter(sa => sa.status !== "VERIFIED").map((sa) => (
              <div key={sa.id} className="rounded-lg border border-dashed p-3 bg-gray-50 opacity-60">
                <p className="font-medium text-sm">{sa.name}</p>
                <p className="text-xs text-gray-500">{SA_TYPE_LABEL[sa.type] || sa.type} · بانتظار التوثيق</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white border p-5 space-y-3">
        <label className="block text-sm font-medium">ملاحظات إضافية للعرض</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border p-2 text-sm" />
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex gap-3">
        <button onClick={() => { setStep("pick"); setSelectedMaster(null); }} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">رجوع</button>
        <button onClick={handleSubmit} disabled={loading} className="rounded-lg bg-orange-500 px-6 py-2 text-white text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "جارٍ الإنشاء..." : "إنشاء العرض"}
        </button>
      </div>
    </div>
  );
}