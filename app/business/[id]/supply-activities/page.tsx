"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Building2, Factory, Truck, PackageSearch, Store, Plus, X, CheckCircle2, ShieldCheck, ShieldAlert, Clock } from "lucide-react";

type SupplyActivity = {
  id: number;
  businessId: number;
  type: string;
  status: string;
  name: string;
  slug: string;
  legalName: string | null;
  description: string | null;
  commercialRegister: string | null;
  taxId: string | null;
  city: string;
  address: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

const TYPE_CONFIG: Record<string, { label: string; Icon: any; color: string }> = {
  TRADER: { label: "تاجر جملة", Icon: Store, color: "bg-blue-100 text-blue-700" },
  FACTORY: { label: "مصنع", Icon: Factory, color: "bg-purple-100 text-purple-700" },
  COMPANY: { label: "شركة", Icon: Building2, color: "bg-indigo-100 text-indigo-700" },
  SUPPLIER: { label: "مورد", Icon: Truck, color: "bg-teal-100 text-teal-700" },
  IMPORTER: { label: "مستورد", Icon: PackageSearch, color: "bg-amber-100 text-amber-700" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: any }> = {
  PENDING: { label: "قيد التوثيق", color: "bg-amber-100 text-amber-700", Icon: Clock },
  VERIFIED: { label: "موثقة", color: "bg-green-100 text-green-700", Icon: ShieldCheck },
  SUSPENDED: { label: "موقوفة", color: "bg-red-100 text-red-700", Icon: ShieldAlert },
  REJECTED: { label: "مرفوضة", color: "bg-gray-100 text-gray-700", Icon: ShieldAlert },
};

export default function SupplyActivitiesPage() {
  const params = useParams();
  const bizId = parseInt(params.id as string);

  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<SupplyActivity[]>([]);
  const [canAdd, setCanAdd] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [type, setType] = useState("FACTORY");
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [commercialRegister, setCommercialRegister] = useState("");
  const [taxId, setTaxId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/business/${bizId}/supply-activities`);
      const d = await res.json();
      if (d.success) {
        setActivities(d.activities);
        setCanAdd(d.canAdd);
      } else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [bizId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("الاسم التجاري مطلوب");
    if (!city.trim()) return setError("المدينة مطلوبة");
    setSubmitting(true);
    try {
      const body: any = { type, name: name.trim(), city: city.trim() };
      if (legalName.trim()) body.legalName = legalName.trim();
      if (address.trim()) body.address = address.trim();
      if (commercialRegister.trim()) body.commercialRegister = commercialRegister.trim();
      if (taxId.trim()) body.taxId = taxId.trim();
      if (description.trim()) body.description = description.trim();

      const res = await fetch(`/api/business/${bizId}/supply-activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.success) {
        setShowForm(false);
        setName(""); setLegalName(""); setCity(""); setAddress(""); setCommercialRegister(""); setTaxId(""); setDescription("");
        await load();
      } else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/business/${bizId}`} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">الهويات التجارية</h1>
          <p className="text-sm text-gray-600">الهويات التي تبيع من خلالها في سوق الجملة</p>
        </div>
        {canAdd && (
          <button onClick={() => setShowForm(true)} className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm hover:bg-orange-600 flex items-center gap-2">
            <Plus className="h-4 w-4" /> هوية جديدة
          </button>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : activities.length === 0 ? (
        <div className="rounded-xl bg-white border p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600">لا توجد هويات</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activities.map((sa) => {
            const t = TYPE_CONFIG[sa.type] || TYPE_CONFIG.TRADER;
            const st = STATUS_CONFIG[sa.status] || STATUS_CONFIG.PENDING;
            const TIcon = t.Icon;
            const StIcon = st.Icon;
            return (
              <div key={sa.id} className="rounded-xl bg-white border p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${t.color}`}><TIcon className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{sa.name}</h3>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${st.color}`}><StIcon className="h-3 w-3" />{st.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{t.label} · {sa.city}</p>
                    {sa.legalName && <p className="text-xs text-gray-500">{sa.legalName}</p>}
                    {sa.rejectionReason && <p className="text-xs text-red-600 mt-1">سبب الرفض: {sa.rejectionReason}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">هوية تجارية جديدة</h2>
              <button type="button" onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">نوع الهوية *</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-lg border p-2">
                <option value="FACTORY">مصنع</option>
                <option value="COMPANY">شركة</option>
                <option value="SUPPLIER">مورد</option>
                <option value="IMPORTER">مستورد</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الاسم التجاري *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الاسم القانوني</label>
              <input value={legalName} onChange={(e) => setLegalName(e.target.value)} className="w-full rounded-lg border p-2" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">المدينة *</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الهاتف</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg border p-2" placeholder="العنوان" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">السجل التجاري</label>
                <input value={commercialRegister} onChange={(e) => setCommercialRegister(e.target.value)} className="w-full rounded-lg border p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الرقم الضريبي</label>
                <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className="w-full rounded-lg border p-2" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الوصف</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border p-2 text-sm" />
            </div>
            <p className="text-xs bg-amber-50 text-amber-800 p-2 rounded">ستحتاج الهوية إلى توثيق من الإدارة قبل أن تتمكن من البيع من خلالها.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">إلغاء</button>
              <button type="submit" disabled={submitting} className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />} إنشاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}